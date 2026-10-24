import { Body, Controller, Get, Ip, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, Res } from "@nestjs/common";
import { BulkSmsInput, bulkSmsSchema, CompanyInput, companySchema, SMS_AUDIENCES, SmsAudience, TransferInput, transferSchema } from "@anzelu/contracts";
import { todayIn } from "@anzelu/finance";
import { randomUUID } from "node:crypto";
import { and, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Response } from "express";
import { AuthUser, CurrentUser, RequirePermissions, scope, tenantOf } from "../common/auth";
import { BusinessRuleError, ZodPipe } from "../common/http";
import { AuditService } from "../core/audit.service";
import { NotificationsService } from "../core/notifications.service";
import { DB, InjectDb } from "../db/database";
import * as schema from "../db/schema";
import { auditLogs, branches, customers, loans, tenants, userBranchAccess, users } from "../db/schema";
import { ReportsService } from "../reports/reports.service";

/** Tables copied into a backup file, in restore order. Secrets (password hashes, MFA keys) are left out. */
const BACKUP_TABLES = [
  "branches",
  "users",
  "userBranchAccess",
  "loanGroups",
  "customers",
  "customerDocuments",
  "loanProducts",
  "loanApplications",
  "guarantors",
  "creditDecisions",
  "loans",
  "loanScheduleItems",
  "loanDisbursements",
  "payments",
  "paymentAllocations",
  "paymentReversals",
  "collectionActivities",
  "chartOfAccounts",
  "journalEntries",
  "journalLines",
  "notifications",
  "auditLogs",
] as const;

/** Company details, backups, bulk SMS and moving borrowers between branches and officers. */
@Controller()
export class CompanyController {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly reports: ReportsService,
  ) {}

  private async tenant(user: AuthUser) {
    const [t] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantOf(user)));
    if (!t) throw new NotFoundException("Institution not found");
    return t;
  }

  /** Company details for receipts and headers; any signed-in staff member may read them. */
  @Get("company")
  async company(@CurrentUser() user: AuthUser) {
    const t = await this.tenant(user);
    return { name: t.name, code: t.code, ...t.profile };
  }

  @Put("settings/company")
  @RequirePermissions("settings:manage")
  async updateCompany(@CurrentUser() user: AuthUser, @Body(new ZodPipe(companySchema)) body: CompanyInput, @Ip() ip: string) {
    const before = await this.tenant(user);
    const { name, ...profile } = body;
    return this.db.transaction(async (tx) => {
      const [t] = await tx.update(tenants).set({ name, profile }).where(eq(tenants.id, before.id)).returning();
      await this.audit.record(tx, {
        tenantId: t.id,
        userId: user.id,
        action: "company.updated",
        entityType: "tenant",
        entityId: t.id,
        data: { before: { name: before.name, ...before.profile }, after: body },
        ip,
      });
      return { name: t.name, code: t.code, ...t.profile };
    });
  }

  /* ------------------------------------------------------------------ Backups */

  @Get("settings/backups")
  @RequirePermissions("settings:manage")
  async backups(@CurrentUser() user: AuthUser) {
    return this.db
      .select({ at: auditLogs.createdAt, by: users.fullName, data: auditLogs.data })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(eq(auditLogs.tenantId, tenantOf(user)), eq(auditLogs.action, "backup.downloaded")))
      .orderBy(desc(auditLogs.seq))
      .limit(20);
  }

  /** A complete copy of this institution's records as one JSON file. */
  @Get("settings/backup")
  @RequirePermissions("settings:manage")
  async backup(@CurrentUser() user: AuthUser, @Ip() ip: string, @Res() res: Response) {
    const t = await this.tenant(user);
    const data: Record<string, unknown[]> = {};
    for (const name of BACKUP_TABLES) {
      const table = schema[name] as unknown as PgTable;
      const cols = getTableColumns(table) as Record<string, unknown>;
      const rows =
        "tenantId" in cols
          ? await this.db
              .select()
              .from(table)
              .where(eq(cols.tenantId as never, t.id))
          : [];
      data[name] = name === "users" ? rows.map(({ passwordHash: _p, mfaSecret: _m, ...u }: Record<string, unknown>) => u) : rows;
    }
    const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
    await this.audit.record(this.db, {
      tenantId: t.id,
      userId: user.id,
      action: "backup.downloaded",
      entityType: "tenant",
      entityId: t.id,
      data: { counts },
      ip,
    });
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${t.code.toLowerCase()}-backup-${stamp}.json"`);
    res.send(
      JSON.stringify({
        format: "chilimbitso-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        tenant: { id: t.id, name: t.name, code: t.code, profile: t.profile },
        counts,
        data,
      }),
    );
  }

  /* ----------------------------------------------------------------- Bulk SMS */

  /** Who an audience reaches: one entry per borrower, with the amount relevant to the message. */
  private async recipients(user: AuthUser, input: { audience: SmsAudience; groupId?: string; branchId?: string }) {
    const tenantId = tenantOf(user);
    if (input.audience === "due_today" || input.audience === "arrears" || input.audience === "active_loans") {
      const asOf = todayIn(user.timezone);
      const book = (await this.reports.portfolio(user, asOf)).filter((l) =>
        input.audience === "due_today" ? l.position.nextDueDate === asOf : input.audience === "arrears" ? l.position.daysPastDue > 0 : !l.position.paidOff,
      );
      const byCustomer = new Map<string, { customerId: string; name: string; phone: string; amount: number; loan: string }>();
      for (const l of book) {
        const amount = Number(
          input.audience === "due_today" ? l.position.nextDueAmount : input.audience === "arrears" ? l.position.overdueAmount : l.position.totalOutstanding,
        );
        const prev = byCustomer.get(l.customerId);
        byCustomer.set(l.customerId, {
          customerId: l.customerId,
          name: l.customerName.split(" ")[0],
          phone: l.phone,
          amount: (prev?.amount ?? 0) + amount,
          loan: prev ? `${prev.loan}, ${l.loanNumber}` : l.loanNumber,
        });
      }
      return [...byCustomer.values()];
    }
    const conds = [scope(user, customers.tenantId, customers.branchId)];
    if (input.audience === "group") conds.push(eq(customers.groupId, input.groupId!));
    if (input.audience === "branch") conds.push(eq(customers.branchId, input.branchId!));
    const rows = await this.db
      .select({ customerId: customers.id, name: customers.firstName, phone: customers.phone })
      .from(customers)
      .where(and(...conds, eq(customers.tenantId, tenantId)));
    return rows.map((r) => ({ ...r, amount: 0, loan: "" }));
  }

  @Get("sms/preview")
  @RequirePermissions("settings:manage")
  async smsPreview(
    @CurrentUser() user: AuthUser,
    @Query("audience") audience: string,
    @Query("groupId") groupId?: string,
    @Query("branchId") branchId?: string,
  ) {
    if (!SMS_AUDIENCES.includes(audience as SmsAudience)) throw new BusinessRuleError("BAD_AUDIENCE", "Choose who should receive the message");
    const list = await this.recipients(user, { audience: audience as SmsAudience, groupId: groupId || undefined, branchId: branchId || undefined });
    return { count: list.length, sample: list.slice(0, 5).map((r) => ({ name: r.name, phone: r.phone, amount: r.amount.toFixed(2), loan: r.loan })) };
  }

  @Get("sms/campaigns")
  @RequirePermissions("settings:manage")
  async campaigns(@CurrentUser() user: AuthUser) {
    return this.db
      .select({ at: auditLogs.createdAt, by: users.fullName, data: auditLogs.data })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(eq(auditLogs.tenantId, tenantOf(user)), eq(auditLogs.action, "sms.bulk_sent")))
      .orderBy(desc(auditLogs.seq))
      .limit(20);
  }

  /** Sends one SMS per borrower. {name}, {amount} and {loan} are filled in for each person. */
  @Post("sms/bulk")
  @RequirePermissions("settings:manage")
  async bulkSms(@CurrentUser() user: AuthUser, @Body(new ZodPipe(bulkSmsSchema)) body: BulkSmsInput, @Ip() ip: string) {
    const tenantId = tenantOf(user);
    const list = await this.recipients(user, body);
    if (!list.length) throw new BusinessRuleError("NO_RECIPIENTS", "Nobody matches this audience right now");
    const campaignId = randomUUID();
    const fill = (r: (typeof list)[number]) =>
      body.message
        .replaceAll("{name}", r.name)
        .replaceAll("{amount}", `K${r.amount.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
        .replaceAll("{loan}", r.loan);
    return this.db.transaction(async (tx) => {
      let sent = 0;
      for (const r of list) {
        const ok = await this.notifications.send(tx, {
          tenantId,
          channel: "sms",
          recipient: r.phone,
          template: "bulk_sms",
          message: fill(r),
          relatedType: "customer",
          relatedId: r.customerId,
          dedupeKey: `bulk:${campaignId}:${r.customerId}`,
        });
        if (ok) sent++;
      }
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: "sms.bulk_sent",
        entityType: "sms_campaign",
        entityId: campaignId,
        data: { audience: body.audience, groupId: body.groupId, branchId: body.branchId, message: body.message, recipients: list.length, sent },
        ip,
      });
      return { campaignId, recipients: list.length, sent };
    });
  }

  /* ----------------------------------------------------------- Transfer client */

  /** Moves a borrower, and their open loans, to another branch and loan officer. */
  @Post("customers/:id/transfer")
  @RequirePermissions("settings:manage")
  async transfer(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(transferSchema)) body: TransferInput,
    @Ip() ip: string,
  ) {
    const tenantId = tenantOf(user);
    const [c] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
    if (!c) throw new NotFoundException("Borrower not found");
    const [branch] = await this.db
      .select()
      .from(branches)
      .where(and(eq(branches.id, body.branchId), eq(branches.tenantId, tenantId)));
    if (!branch) throw new NotFoundException("Branch not found");
    const [officer] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, body.officerId), eq(users.tenantId, tenantId), eq(users.isActive, true)));
    if (!officer || officer.role === "borrower") throw new BusinessRuleError("BAD_OFFICER", "Choose an active staff member as the new loan officer");
    const access = await this.db.select({ branchId: userBranchAccess.branchId }).from(userBranchAccess).where(eq(userBranchAccess.userId, officer.id));
    if (access.length && !access.some((a) => a.branchId === branch.id)) {
      throw new BusinessRuleError("OFFICER_NOT_IN_BRANCH", `${officer.fullName} is not assigned to ${branch.name}. Give them access under Staff first.`);
    }
    return this.db.transaction(async (tx) => {
      await tx.update(customers).set({ branchId: branch.id }).where(eq(customers.id, id));
      const moved = await tx
        .update(loans)
        .set({ branchId: branch.id, officerId: officer.id })
        .where(and(eq(loans.customerId, id), inArray(loans.status, ["pending_disbursement", "active"])))
        .returning({ id: loans.id, loanNumber: loans.loanNumber });
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: "customer.transferred",
        entityType: "customer",
        entityId: id,
        data: { fromBranchId: c.branchId, toBranchId: branch.id, officerId: officer.id, loans: moved.map((l) => l.loanNumber), reason: body.reason },
        ip,
      });
      return { customerId: id, branch: branch.name, officer: officer.fullName, loansMoved: moved.length };
    });
  }

  /** Recent transfers for the Transfer Client page. */
  @Get("transfers")
  @RequirePermissions("settings:manage")
  async transfers(@CurrentUser() user: AuthUser) {
    return this.db
      .select({
        at: auditLogs.createdAt,
        by: users.fullName,
        customerId: auditLogs.entityId,
        customerName: sql<string>`(select first_name || ' ' || last_name from customers where id::text = ${auditLogs.entityId})`,
        data: auditLogs.data,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(eq(auditLogs.tenantId, tenantOf(user)), eq(auditLogs.action, "customer.transferred")))
      .orderBy(desc(auditLogs.seq))
      .limit(20);
  }
}
