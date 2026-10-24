import { Body, Controller, Get, HttpCode, Ip, Post, Res, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { LoginInput, loginSchema, mfaCodeSchema } from '@anzelu/contracts';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { AuthUser, CurrentUser, loadAuthUser, Public, SESSION_COOKIE } from '../common/auth';
import { BusinessRuleError, ZodPipe } from '../common/http';
import { AuditService } from '../core/audit.service';
import { DB, InjectDb } from '../db/database';
import { users } from '../db/schema';
import { generateTotpSecret, otpauthUrl, verifyPassword, verifyTotp } from './crypto';

const SESSION_HOURS = 8;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

@Controller('auth')
export class AuthController {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
    const [user] = await this.db.select().from(users).where(eq(users.email, body.email));
    // Same message for unknown email and wrong password to avoid account enumeration.
    const invalid = () => new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' });
    if (!user || !user.isActive) throw invalid();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: `Too many failed attempts. Try again after ${user.lockedUntil.toISOString().slice(11, 16)} UTC.`,
      });
    }

    if (!(await verifyPassword(body.password, user.passwordHash))) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
      await this.db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ failedLogins: lock ? 0 : failed, lockedUntil: lock })
          .where(eq(users.id, user.id));
        await this.audit.record(tx, {
          tenantId: user.tenantId,
          userId: user.id,
          action: lock ? 'auth.locked' : 'auth.login_failed',
          entityType: 'user',
          entityId: user.id,
          ip,
        });
      });
      throw invalid();
    }

    if (user.mfaEnabled) {
      if (!body.mfaCode) throw new UnauthorizedException({ code: 'MFA_REQUIRED', message: 'Enter the code from your authenticator app' });
      if (!user.mfaSecret || !verifyTotp(user.mfaSecret, body.mfaCode)) {
        throw new UnauthorizedException({ code: 'MFA_INVALID', message: 'That code is not valid — try the latest one' });
      }
    }

    const authUser = await loadAuthUser(this.db, user.id);
    if (!authUser) throw new UnauthorizedException({ code: 'INSTITUTION_SUSPENDED', message: 'Your institution account is suspended' });

    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
      await this.audit.record(tx, { tenantId: user.tenantId, userId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, ip });
    });

    const token = await this.jwt.signAsync({ sub: user.id, tid: user.tenantId, role: user.role }, { expiresIn: `${SESSION_HOURS}h` });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_HOURS * 3600_000,
      path: '/',
    });
    return { user: authUser, mfaRecommended: !authUser.mfaEnabled && authUser.role !== 'borrower' };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    await this.audit.record(this.db, { tenantId: user.tenantId, userId: user.id, action: 'auth.logout', entityType: 'user', entityId: user.id });
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /** Step 1 of MFA enrolment: issue a secret to add to an authenticator app. */
  @Post('mfa/setup')
  async mfaSetup(@CurrentUser() user: AuthUser) {
    if (user.mfaEnabled) throw new BusinessRuleError('MFA_ALREADY_ENABLED', 'Two-factor authentication is already on');
    const secret = generateTotpSecret();
    await this.db.update(users).set({ mfaSecret: secret }).where(eq(users.id, user.id));
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  /** Step 2: confirm a code from the app, which switches MFA on. */
  @Post('mfa/enable')
  @HttpCode(200)
  async mfaEnable(@CurrentUser() user: AuthUser, @Body(new ZodPipe(mfaCodeSchema)) body: { code: string }) {
    const [row] = await this.db.select({ secret: users.mfaSecret }).from(users).where(eq(users.id, user.id));
    if (!row?.secret) throw new BusinessRuleError('MFA_NOT_STARTED', 'Start two-factor setup first');
    if (!verifyTotp(row.secret, body.code)) throw new BusinessRuleError('MFA_INVALID', 'That code is not valid — try the latest one');
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ mfaEnabled: true }).where(eq(users.id, user.id));
      await this.audit.record(tx, { tenantId: user.tenantId, userId: user.id, action: 'auth.mfa_enabled', entityType: 'user', entityId: user.id });
    });
    return { mfaEnabled: true };
  }
}
