import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { settlementQuote, todayIn } from '@anzelu/finance';
import { and, desc, eq } from 'drizzle-orm';
import { AuthUser, CurrentUser, RequireRoles } from '../common/auth';
import { DB, InjectDb } from '../db/database';
import { customers, loanProducts, loans, payments } from '../db/schema';
import { itemStatus, positionOf, scheduleRows, scheduleRowsByLoan, toServicingItem } from '../loans/servicing';

/** Borrower self-service: a borrower only ever sees loans of the customer record linked to their login. */
@Controller('borrower')
@RequireRoles('borrower')
export class BorrowerController {
  constructor(@InjectDb() private readonly db: DB) {}

  private owner(user: AuthUser) {
    if (!user.customerId || !user.tenantId) throw new NotFoundException('No customer profile is linked to this login');
    return and(eq(loans.tenantId, user.tenantId), eq(loans.customerId, user.customerId))!;
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const [c] = await this.db
      .select({ firstName: customers.firstName, lastName: customers.lastName, customerNumber: customers.customerNumber, phone: customers.phone })
      .from(customers)
      .where(and(eq(customers.id, user.customerId!), eq(customers.tenantId, user.tenantId!)));
    return { ...c, institution: user.tenantName };
  }

  @Get('loans')
  async loans(@CurrentUser() user: AuthUser) {
    const rows = await this.db
      .select({ loan: loans, productName: loanProducts.name })
      .from(loans)
      .innerJoin(loanProducts, eq(loans.productId, loanProducts.id))
      .where(this.owner(user))
      .orderBy(desc(loans.createdAt));
    const asOf = todayIn(user.timezone);
    const schedules = await scheduleRowsByLoan(this.db, user.tenantId!, rows.map((r) => r.loan.id));
    return rows.map((r) => ({
      id: r.loan.id,
      loanNumber: r.loan.loanNumber,
      productName: r.productName,
      principal: r.loan.principal,
      status: r.loan.status,
      disbursedOn: r.loan.disbursedOn,
      maturityDate: r.loan.maturityDate,
      position: positionOf(schedules.get(r.loan.id) ?? [], asOf),
    }));
  }

  @Get('loans/:id')
  async loan(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const [row] = await this.db
      .select({ loan: loans, productName: loanProducts.name })
      .from(loans)
      .innerJoin(loanProducts, eq(loans.productId, loanProducts.id))
      .where(and(eq(loans.id, id), this.owner(user)));
    if (!row) throw new NotFoundException('Loan not found');
    const asOf = todayIn(user.timezone);
    const schedule = await scheduleRows(this.db, user.tenantId!, id);
    const paid = await this.db
      .select({ receiptNumber: payments.receiptNumber, amount: payments.amount, channel: payments.channel, receivedOn: payments.receivedOn, status: payments.status })
      .from(payments)
      .where(and(eq(payments.loanId, id), eq(payments.tenantId, user.tenantId!)))
      .orderBy(desc(payments.receivedOn));
    return {
      id,
      loanNumber: row.loan.loanNumber,
      productName: row.productName,
      principal: row.loan.principal,
      annualRatePct: row.loan.annualRatePct,
      interestMethod: row.loan.interestMethod,
      frequency: row.loan.frequency,
      status: row.loan.status,
      disbursedOn: row.loan.disbursedOn,
      maturityDate: row.loan.maturityDate,
      position: positionOf(schedule, asOf),
      settlement: row.loan.status === 'active' ? settlementQuote(schedule.map(toServicingItem), asOf) : null,
      schedule: schedule.map((s) => ({
        installmentNo: s.installmentNo,
        dueDate: s.dueDate,
        principalDue: s.principalDue,
        interestDue: s.interestDue,
        penaltyDue: s.penaltyDue,
        paid: (Number(s.principalPaid) + Number(s.interestPaid) + Number(s.penaltyPaid) + Number(s.feePaid)).toFixed(2),
        status: itemStatus(s, asOf),
      })),
      payments: paid,
      payInstructions: `Pay via MTN MoMo or Airtel Money using account reference ${row.loan.loanNumber}.`,
    };
  }
}
