import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { BRANCH_SCOPED_ROLES, Permission, permissionsFor, Role } from '@anzelu/contracts';
import { and, eq, inArray, SQL, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Request } from 'express';
import { DB, InjectDb } from '../db/database';
import { tenants, userBranchAccess, users } from '../db/schema';

export const SESSION_COOKIE = 'anz_session';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
  currency: string;
  timezone: string;
  branchIds: string[];
  permissions: Permission[];
  approvalLimit: string;
  customerId: string | null;
  mfaEnabled: boolean;
}

const PUBLIC_KEY = 'isPublic';
const PERMISSIONS_KEY = 'permissions';
const ROLES_KEY = 'roles';

export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** The caller must hold every listed permission. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
export const RequireRoles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
});

/**
 * Global guard: authenticates the session cookie (or bearer token), reloads the
 * user so deactivation and branch changes take effect immediately, then checks
 * route permissions. Nothing is reachable without it unless marked @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectDb() private readonly db: DB,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    const token = req.cookies?.[SESSION_COOKIE] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw new UnauthorizedException('Sign in to continue');

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Your session has expired — sign in again');
    }
    const user = await loadAuthUser(this.db, payload.sub);
    if (!user) throw new UnauthorizedException('Account is disabled');
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException('This area is not available for your role');

    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, targets) ?? [];
    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length) throw new ForbiddenException(`You do not have permission: ${missing.join(', ')}`);
    return true;
  }
}

export async function loadAuthUser(db: DB, userId: string): Promise<AuthUser | null> {
  const [row] = await db
    .select({ user: users, tenant: tenants })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.id, userId));
  if (!row || !row.user.isActive) return null;
  if (row.tenant && row.tenant.status !== 'active') return null;
  const branchRows = await db
    .select({ branchId: userBranchAccess.branchId })
    .from(userBranchAccess)
    .where(eq(userBranchAccess.userId, userId));
  const u = row.user;
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    tenantId: u.tenantId,
    tenantName: row.tenant?.name ?? null,
    currency: row.tenant?.currency ?? 'ZMW',
    timezone: row.tenant?.timezone ?? 'Africa/Lusaka',
    branchIds: branchRows.map((b) => b.branchId),
    permissions: permissionsFor(u.role),
    approvalLimit: u.approvalLimit,
    customerId: u.customerId,
    mfaEnabled: u.mfaEnabled,
  };
}

/** The caller's institution; platform admins have none and cannot act inside one. */
export function tenantOf(user: AuthUser): string {
  if (!user.tenantId) throw new ForbiddenException('This action needs an institution account');
  return user.tenantId;
}

/**
 * Tenant filter plus, for branch-scoped roles, a branch filter. Every query on
 * tenant data composes this so isolation cannot be forgotten per endpoint.
 */
export function scope(user: AuthUser, tenantCol: PgColumn, branchCol?: PgColumn): SQL {
  const conditions: SQL[] = [eq(tenantCol, tenantOf(user))];
  if (branchCol && BRANCH_SCOPED_ROLES.includes(user.role)) {
    conditions.push(user.branchIds.length ? inArray(branchCol, user.branchIds) : sql`false`);
  }
  return and(...conditions)!;
}

export function assertBranchAccess(user: AuthUser, branchId: string) {
  if (BRANCH_SCOPED_ROLES.includes(user.role) && !user.branchIds.includes(branchId)) {
    throw new ForbiddenException('This record belongs to a branch you are not assigned to');
  }
}
