import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { groupMembersSchema, LoanGroupInput, loanGroupSchema, loanGroupUpdateSchema } from "@anzelu/contracts";
import { m, portfolioAtRisk, sum, todayIn } from "@anzelu/finance";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { assertBranchAccess, AuthUser, CurrentUser, RequirePermissions, scope, tenantOf } from "../common/auth";
import { BusinessRuleError, ZodPipe } from "../common/http";
import { AuditService } from "../core/audit.service";
import { DB, InjectDb } from "../db/database";
import { branches, customers, loanGroups, loanProducts, loans, users } from "../db/schema";
import { positionOf, scheduleRowsByLoan } from "../loans/servicing";

/** Officers manage the groups they run; administrators can manage any. */
function canManage(user: AuthUser) {
  if (!user.permissions.includes("customers:write") && !user.permissions.includes("settings:manage")) {
    throw new ForbiddenException("You do not have permission to manage borrower groups");
  }
}

/** Borrower groups, e.g. traders at one market who meet and repay together. */
@Controller("loan-groups")
export class LoanGroupsController {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly audit: AuditService,
  ) {}

  private async find(user: AuthUser, id: string) {
    const [g] = await this.db
      .select()
      .from(loanGroups)
      .where(and(eq(loanGroups.id, id), scope(user, loanGroups.tenantId, loanGroups.branchId)));
    if (!g) throw new NotFoundException("Group not found");
    return g;
  }

  /** Active loans of the given borrowers with live balances. */
  private async loansOf(user: AuthUser, customerIds: string[]) {
    if (!customerIds.length) return [];
    const rows = await this.db
      .select({
        id: loans.id,
        loanNumber: loans.loanNumber,
        customerId: loans.customerId,
        principal: loans.principal,
        maturityDate: loans.maturityDate,
        productName: loanProducts.name,
      })
      .from(loans)
      .innerJoin(loanProducts, eq(loans.productId, loanProducts.id))
      .where(and(eq(loans.tenantId, tenantOf(user)), inArray(loans.customerId, customerIds), eq(loans.status, "active")));
    const schedules = await scheduleRowsByLoan(
      this.db,
      tenantOf(user),
      rows.map((r) => r.id),
    );
    const asOf = todayIn(user.timezone);
    return rows.map((r) => ({ ...r, position: positionOf(schedules.get(r.id) ?? [], asOf) }));
  }

  @Get()
  @RequirePermissions("customers:read")
  async list(@CurrentUser() user: AuthUser) {
    const groups = await this.db
      .select({ g: loanGroups, branchName: branches.name, officerName: users.fullName })
      .from(loanGroups)
      .innerJoin(branches, eq(loanGroups.branchId, branches.id))
      .leftJoin(users, eq(loanGroups.officerId, users.id))
      .where(scope(user, loanGroups.tenantId, loanGroups.branchId))
      .orderBy(asc(loanGroups.name));
    const members = groups.length
      ? await this.db
          .select({ id: customers.id, groupId: customers.groupId })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantOf(user)),
              inArray(
                customers.groupId,
                groups.map((g) => g.g.id),
              ),
            ),
          )
      : [];
    const book = await this.loansOf(
      user,
      members.map((c) => c.id),
    );
    return groups.map(({ g, branchName, officerName }) => {
      const ids = new Set(members.filter((c) => c.groupId === g.id).map((c) => c.id));
      const ls = book.filter((l) => ids.has(l.customerId));
      return {
        ...g,
        branchName,
        officerName,
        members: ids.size,
        activeLoans: ls.length,
        outstanding: m(sum(ls.map((l) => l.position.totalOutstanding))),
        overdue: m(sum(ls.map((l) => l.position.overdueAmount))),
        par30: portfolioAtRisk(
          ls.map((l) => l.position),
          30,
        ),
      };
    });
  }

  @Get(":id")
  @RequirePermissions("customers:read")
  async get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    const g = await this.find(user, id);
    const [meta] = await this.db
      .select({ branchName: branches.name, officerName: users.fullName })
      .from(loanGroups)
      .innerJoin(branches, eq(loanGroups.branchId, branches.id))
      .leftJoin(users, eq(loanGroups.officerId, users.id))
      .where(eq(loanGroups.id, id));
    const people = await this.db
      .select({
        id: customers.id,
        customerNumber: customers.customerNumber,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
        kycStatus: customers.kycStatus,
      })
      .from(customers)
      .where(and(eq(customers.tenantId, g.tenantId), eq(customers.groupId, id)))
      .orderBy(asc(customers.firstName));
    const book = await this.loansOf(
      user,
      people.map((p) => p.id),
    );
    const members = people.map((p) => {
      const ls = book.filter((l) => l.customerId === p.id);
      return {
        ...p,
        loans: ls.map((l) => ({
          id: l.id,
          loanNumber: l.loanNumber,
          productName: l.productName,
          principal: l.principal,
          maturityDate: l.maturityDate,
          ...l.position,
        })),
        outstanding: m(sum(ls.map((l) => l.position.totalOutstanding))),
        overdue: m(sum(ls.map((l) => l.position.overdueAmount))),
        daysPastDue: Math.max(0, ...ls.map((l) => l.position.daysPastDue)),
      };
    });
    return {
      ...g,
      ...meta,
      members,
      totals: {
        members: members.length,
        activeLoans: book.length,
        outstanding: m(sum(book.map((l) => l.position.totalOutstanding))),
        overdue: m(sum(book.map((l) => l.position.overdueAmount))),
        dueToday: m(sum(book.filter((l) => l.position.nextDueDate === todayIn(user.timezone)).map((l) => l.position.nextDueAmount))),
        par30: portfolioAtRisk(
          book.map((l) => l.position),
          30,
        ),
      },
    };
  }

  @Post()
  @RequirePermissions("customers:read")
  async create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(loanGroupSchema)) body: LoanGroupInput) {
    canManage(user);
    const tenantId = tenantOf(user);
    assertBranchAccess(user, body.branchId);
    return this.db.transaction(async (tx) => {
      const [dupe] = await tx
        .select({ id: loanGroups.id })
        .from(loanGroups)
        .where(and(eq(loanGroups.tenantId, tenantId), sql`lower(${loanGroups.name}) = lower(${body.name})`));
      if (dupe) throw new BusinessRuleError("GROUP_EXISTS", "A group with this name already exists");
      const [g] = await tx
        .insert(loanGroups)
        .values({ ...body, tenantId, createdBy: user.id })
        .returning();
      await this.audit.record(tx, { tenantId, userId: user.id, action: "group.created", entityType: "loan_group", entityId: g.id, data: body });
      return g;
    });
  }

  @Patch(":id")
  @RequirePermissions("customers:read")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(loanGroupUpdateSchema)) body: z.infer<typeof loanGroupUpdateSchema>,
  ) {
    canManage(user);
    const before = await this.find(user, id);
    if (body.branchId) assertBranchAccess(user, body.branchId);
    return this.db.transaction(async (tx) => {
      const [g] = await tx.update(loanGroups).set(body).where(eq(loanGroups.id, id)).returning();
      await this.audit.record(tx, {
        tenantId: before.tenantId,
        userId: user.id,
        action: "group.updated",
        entityType: "loan_group",
        entityId: id,
        data: { before, change: body },
      });
      return g;
    });
  }

  @Post(":id/members")
  @RequirePermissions("customers:read")
  async addMembers(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(groupMembersSchema)) body: { customerIds: string[] },
  ) {
    canManage(user);
    const g = await this.find(user, id);
    return this.db.transaction(async (tx) => {
      const found = await tx
        .select({ id: customers.id, groupId: customers.groupId })
        .from(customers)
        .where(and(scope(user, customers.tenantId, customers.branchId), inArray(customers.id, body.customerIds)));
      if (found.length !== body.customerIds.length) throw new NotFoundException("One or more borrowers were not found");
      await tx.update(customers).set({ groupId: id }).where(inArray(customers.id, body.customerIds));
      await this.audit.record(tx, {
        tenantId: g.tenantId,
        userId: user.id,
        action: "group.members_added",
        entityType: "loan_group",
        entityId: id,
        data: { customerIds: body.customerIds, movedFrom: found.filter((c) => c.groupId && c.groupId !== id).map((c) => ({ id: c.id, groupId: c.groupId })) },
      });
      return { added: found.length };
    });
  }

  @Delete(":id/members/:customerId")
  @RequirePermissions("customers:read")
  async removeMember(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Param("customerId", ParseUUIDPipe) customerId: string) {
    canManage(user);
    const g = await this.find(user, id);
    return this.db.transaction(async (tx) => {
      const [c] = await tx
        .update(customers)
        .set({ groupId: null })
        .where(and(eq(customers.id, customerId), eq(customers.groupId, id), scope(user, customers.tenantId, customers.branchId)))
        .returning({ id: customers.id });
      if (!c) throw new NotFoundException("This borrower is not in the group");
      await this.audit.record(tx, {
        tenantId: g.tenantId,
        userId: user.id,
        action: "group.member_removed",
        entityType: "loan_group",
        entityId: id,
        data: { customerId },
      });
      return { removed: 1 };
    });
  }
}
