import { Body, ConflictException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  branchSchema,
  LoanProductInput,
  loanProductSchema,
  tenantCreateSchema,
  tenantStatusSchema,
  userCreateSchema,
  userUpdateSchema,
} from '@anzelu/contracts';
import { m } from '@anzelu/finance';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { hashPassword } from '../auth/crypto';
import { AuthUser, CurrentUser, RequirePermissions, tenantOf } from '../common/auth';
import { BusinessRuleError, Paged, paging, ZodPipe } from '../common/http';
import { AuditService } from '../core/audit.service';
import { LedgerService } from '../core/ledger.service';
import { DB, InjectDb } from '../db/database';
import { auditLogs, branches, customers, loanProducts, loans, notifications, tenants, userBranchAccess, users } from '../db/schema';

const loanProductUpdateSchema = z.object({ isActive: z.boolean() });

/** Institution configuration: branches, staff, products. */
@Controller()
export class SettingsController {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly audit: AuditService,
  ) {}

  @Get('branches')
  branches(@CurrentUser() user: AuthUser) {
    return this.db.select().from(branches).where(eq(branches.tenantId, tenantOf(user))).orderBy(asc(branches.name));
  }

  @Post('branches')
  @RequirePermissions('settings:manage')
  async createBranch(@CurrentUser() user: AuthUser, @Body(new ZodPipe(branchSchema)) body: { name: string; code: string; address?: string }) {
    const tenantId = tenantOf(user);
    return this.db.transaction(async (tx) => {
      const [b] = await tx.insert(branches).values({ ...body, tenantId }).returning();
      await this.audit.record(tx, { tenantId, userId: user.id, action: 'branch.created', entityType: 'branch', entityId: b.id, data: body });
      return b;
    });
  }

  @Get('loan-products')
  products(@CurrentUser() user: AuthUser, @Query('active') active?: string) {
    const conds = [eq(loanProducts.tenantId, tenantOf(user))];
    if (active === 'true') conds.push(eq(loanProducts.isActive, true));
    return this.db.select().from(loanProducts).where(and(...conds)).orderBy(asc(loanProducts.name));
  }

  @Post('loan-products')
  @RequirePermissions('settings:manage')
  async createProduct(@CurrentUser() user: AuthUser, @Body(new ZodPipe(loanProductSchema)) body: LoanProductInput) {
    const tenantId = tenantOf(user);
    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .insert(loanProducts)
        .values({ ...body, tenantId, minAmount: m(body.minAmount), maxAmount: m(body.maxAmount) })
        .returning();
      await this.audit.record(tx, { tenantId, userId: user.id, action: 'product.created', entityType: 'loan_product', entityId: p.id, data: { ...body } });
      return p;
    });
  }

  /** Product terms are snapshotted onto each loan, so only activation can change after creation. */
  @Patch('loan-products/:id')
  @RequirePermissions('settings:manage')
  async updateProduct(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(loanProductUpdateSchema)) body: { isActive: boolean }) {
    const tenantId = tenantOf(user);
    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .update(loanProducts)
        .set(body)
        .where(and(eq(loanProducts.id, id), eq(loanProducts.tenantId, tenantId)))
        .returning();
      if (!p) throw new NotFoundException('Product not found');
      await this.audit.record(tx, { tenantId, userId: user.id, action: body.isActive ? 'product.activated' : 'product.deactivated', entityType: 'loan_product', entityId: id });
      return p;
    });
  }

  @Get('users')
  @RequirePermissions('settings:manage')
  async users(@CurrentUser() user: AuthUser) {
    const tenantId = tenantOf(user);
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        approvalLimit: users.approvalLimit,
        isActive: users.isActive,
        mfaEnabled: users.mfaEnabled,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(asc(users.fullName));
    const access = await this.db
      .select({ userId: userBranchAccess.userId, branchId: userBranchAccess.branchId, name: branches.name })
      .from(userBranchAccess)
      .innerJoin(branches, eq(userBranchAccess.branchId, branches.id))
      .where(eq(userBranchAccess.tenantId, tenantId));
    return rows.map((r) => ({ ...r, branches: access.filter((a) => a.userId === r.id).map((a) => ({ id: a.branchId, name: a.name })) }));
  }

  @Post('users')
  @RequirePermissions('settings:manage')
  async createUser(@CurrentUser() user: AuthUser, @Body(new ZodPipe(userCreateSchema)) body: z.infer<typeof userCreateSchema>) {
    const tenantId = tenantOf(user);
    const [exists] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
    if (exists) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'A user with this email already exists' });
    await this.assertBranches(tenantId, body.branchIds);
    const passwordHash = await hashPassword(body.password);
    return this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ tenantId, email: body.email, fullName: body.fullName, role: body.role, passwordHash, approvalLimit: m(body.approvalLimit) })
        .returning({ id: users.id, email: users.email, fullName: users.fullName, role: users.role });
      if (body.branchIds.length) await tx.insert(userBranchAccess).values(body.branchIds.map((branchId) => ({ userId: u.id, branchId, tenantId })));
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: 'user.created',
        entityType: 'user',
        entityId: u.id,
        data: { email: body.email, role: body.role, approvalLimit: body.approvalLimit, branchIds: body.branchIds },
      });
      return u;
    });
  }

  @Patch('users/:id')
  @RequirePermissions('settings:manage')
  async updateUser(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(userUpdateSchema)) body: z.infer<typeof userUpdateSchema>) {
    const tenantId = tenantOf(user);
    if (id === user.id && body.isActive === false) throw new BusinessRuleError('SELF_DEACTIVATION', 'You cannot deactivate your own account');
    if (body.branchIds) await this.assertBranches(tenantId, body.branchIds);
    return this.db.transaction(async (tx) => {
      const [target] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
      if (!target) throw new NotFoundException('User not found');
      const set: Partial<typeof users.$inferInsert> = {};
      if (body.isActive !== undefined) set.isActive = body.isActive;
      if (body.approvalLimit !== undefined) set.approvalLimit = m(body.approvalLimit);
      if (Object.keys(set).length) await tx.update(users).set(set).where(eq(users.id, id));
      if (body.branchIds) {
        await tx.delete(userBranchAccess).where(eq(userBranchAccess.userId, id));
        if (body.branchIds.length) await tx.insert(userBranchAccess).values(body.branchIds.map((branchId) => ({ userId: id, branchId, tenantId })));
      }
      await this.audit.record(tx, { tenantId, userId: user.id, action: 'user.updated', entityType: 'user', entityId: id, data: body });
      return { id, ...body };
    });
  }

  @Get('notifications')
  @RequirePermissions('settings:manage')
  async notifications(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    const { page, pageSize, offset } = paging(q);
    const where = eq(notifications.tenantId, tenantOf(user));
    const [rows, [{ count }]] = await Promise.all([
      this.db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(pageSize).offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(where),
    ]);
    return new Paged(rows, count, page, pageSize);
  }

  private async assertBranches(tenantId: string, ids: string[]) {
    if (!ids.length) return;
    const found = await this.db.select({ id: branches.id }).from(branches).where(and(eq(branches.tenantId, tenantId), inArray(branches.id, ids)));
    if (found.length !== new Set(ids).size) throw new BusinessRuleError('INVALID_BRANCH', 'One or more branches do not belong to your institution');
  }
}

/** Platform-owner console: lending institutions (tenants) on the SaaS. */
@Controller('admin/tenants')
@RequirePermissions('tenants:manage')
export class TenantsController {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  @Get()
  async list() {
    const rows = await this.db.select().from(tenants).orderBy(asc(tenants.createdAt));
    const stats = await this.db
      .select({
        tenantId: loans.tenantId,
        activeLoans: sql<number>`count(*) FILTER (WHERE ${loans.status} = 'active')::int`,
        disbursed: sql<string>`COALESCE(sum(${loans.principal}) FILTER (WHERE ${loans.status} <> 'pending_disbursement'), 0)::text`,
      })
      .from(loans)
      .groupBy(loans.tenantId);
    const people = await this.db
      .select({ tenantId: users.tenantId, staff: sql<number>`count(*) FILTER (WHERE ${users.role} <> 'borrower')::int` })
      .from(users)
      .groupBy(users.tenantId);
    const custs = await this.db.select({ tenantId: customers.tenantId, count: sql<number>`count(*)::int` }).from(customers).groupBy(customers.tenantId);
    return rows.map((t) => ({
      ...t,
      activeLoans: stats.find((s) => s.tenantId === t.id)?.activeLoans ?? 0,
      lifetimeDisbursed: stats.find((s) => s.tenantId === t.id)?.disbursed ?? '0',
      staff: people.find((p) => p.tenantId === t.id)?.staff ?? 0,
      customers: custs.find((c) => c.tenantId === t.id)?.count ?? 0,
    }));
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(tenantCreateSchema)) body: z.infer<typeof tenantCreateSchema>) {
    const [taken] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, body.adminEmail));
    if (taken) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'The administrator email is already in use' });
    const passwordHash = await hashPassword(body.adminPassword);
    return this.db.transaction(async (tx) => {
      const [t] = await tx.insert(tenants).values({ name: body.name, code: body.code, plan: body.plan }).returning();
      await this.ledger.seedChart(tx, t.id);
      const [b] = await tx.insert(branches).values({ tenantId: t.id, name: 'Head Office', code: 'HQ' }).returning();
      const [admin] = await tx
        .insert(users)
        .values({ tenantId: t.id, email: body.adminEmail, fullName: body.adminName, role: 'institution_admin', passwordHash })
        .returning({ id: users.id });
      await tx.insert(userBranchAccess).values({ userId: admin.id, branchId: b.id, tenantId: t.id });
      await this.audit.record(tx, { tenantId: null, userId: user.id, action: 'tenant.created', entityType: 'tenant', entityId: t.id, data: { code: t.code, plan: t.plan } });
      return t;
    });
  }

  @Patch(':id/status')
  async status(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(tenantStatusSchema)) body: { status: 'active' | 'suspended' }) {
    return this.db.transaction(async (tx) => {
      const [t] = await tx.update(tenants).set({ status: body.status }).where(eq(tenants.id, id)).returning();
      if (!t) throw new NotFoundException('Institution not found');
      await this.audit.record(tx, { tenantId: null, userId: user.id, action: `tenant.${body.status}`, entityType: 'tenant', entityId: id });
      return t;
    });
  }
}

@Controller('audit')
@RequirePermissions('audit:read')
export class AuditController {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    const { page, pageSize, offset } = paging(q);
    const conds = [user.tenantId ? eq(auditLogs.tenantId, user.tenantId) : isNull(auditLogs.tenantId)];
    if (q.action) conds.push(sql`${auditLogs.action} ILIKE ${`${q.action}%`}`);
    const where = and(...conds);
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          seq: auditLogs.seq,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          data: auditLogs.data,
          ip: auditLogs.ip,
          hash: auditLogs.hash,
          createdAt: auditLogs.createdAt,
          userName: users.fullName,
          userRole: users.role,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(where)
        .orderBy(desc(auditLogs.seq))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
    ]);
    return new Paged(rows, count, page, pageSize);
  }

  @Get('verify')
  verify(@CurrentUser() user: AuthUser) {
    return this.audit.verify(user.tenantId);
  }
}

