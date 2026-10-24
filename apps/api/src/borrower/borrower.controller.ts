import { Body, Controller, Get, Ip, NotFoundException, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  BorrowerApplicationInput,
  borrowerApplicationSchema,
  BorrowerPayInput,
  borrowerPaySchema,
  DocumentType,
  documentTypeSchema,
} from '@anzelu/contracts';
import { settlementQuote, todayIn } from '@anzelu/finance';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { ApplicationsService } from '../applications/applications.service';
import { AuthUser, CurrentUser, RequireRoles } from '../common/auth';
import { ZodPipe } from '../common/http';
import { CustomersService } from '../customers/customers.service';
import { DB, InjectDb } from '../db/database';
import { customerDocuments, customers, loanApplications, loanProducts, loans, loanScheduleItems, payments } from '../db/schema';
import { itemStatus, positionOf, scheduleRows, scheduleRowsByLoan, toServicingItem } from '../loans/servicing';
import { CollectionsService } from './collections.service';

type ScheduleRow = typeof loanScheduleItems.$inferSelect;

/** Instalments fully paid out of the total, for the borrower's progress ring. */
function progressOf(rows: ScheduleRow[], asOf: string) {
  return { paid: rows.filter((r) => itemStatus(r, asOf) === 'paid').length, total: rows.length };
}

/**
 * A good payer is offered a top-up: an active loan that is up to date with at
 * least half its instalments paid. The offer is an invitation to apply; the
 * application is still scored and approved by a person.
 */
function topUpEligible(rows: ScheduleRow[], asOf: string) {
  const p = progressOf(rows, asOf);
  return p.total > 0 && positionOf(rows, asOf).daysPastDue === 0 && p.paid * 2 >= p.total;
}

/** Borrower self-service: a borrower only ever sees and acts on the customer record linked to their login. */
@Controller('borrower')
@RequireRoles('borrower')
export class BorrowerController {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly applications: ApplicationsService,
    private readonly customersSvc: CustomersService,
    private readonly collections: CollectionsService,
  ) {}

  private owner(user: AuthUser) {
    if (!user.customerId || !user.tenantId) throw new NotFoundException('No customer profile is linked to this login');
    return and(eq(loans.tenantId, user.tenantId), eq(loans.customerId, user.customerId))!;
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const [c] = await this.db
      .select({
        firstName: customers.firstName,
        lastName: customers.lastName,
        customerNumber: customers.customerNumber,
        phone: customers.phone,
        monthlyIncome: customers.monthlyIncome,
        kycStatus: customers.kycStatus,
      })
      .from(customers)
      .where(and(eq(customers.id, user.customerId!), eq(customers.tenantId, user.tenantId!)));
    return { ...c, institution: user.tenantName };
  }

  @Get('loans')
  async loans(@CurrentUser() user: AuthUser) {
    const rows = await this.db
      .select({ loan: loans, productName: loanProducts.name, productId: loanProducts.id })
      .from(loans)
      .innerJoin(loanProducts, eq(loans.productId, loanProducts.id))
      .where(this.owner(user))
      .orderBy(desc(loans.createdAt));
    const asOf = todayIn(user.timezone);
    const schedules = await scheduleRowsByLoan(this.db, user.tenantId!, rows.map((r) => r.loan.id));
    return rows.map((r) => {
      const schedule = schedules.get(r.loan.id) ?? [];
      return {
        id: r.loan.id,
        loanNumber: r.loan.loanNumber,
        productId: r.productId,
        productName: r.productName,
        principal: r.loan.principal,
        status: r.loan.status,
        disbursedOn: r.loan.disbursedOn,
        maturityDate: r.loan.maturityDate,
        position: positionOf(schedule, asOf),
        progress: progressOf(schedule, asOf),
        topUpEligible: r.loan.status === 'active' && topUpEligible(schedule, asOf),
      };
    });
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
      .orderBy(desc(payments.receivedOn), desc(payments.createdAt));
    return {
      id,
      loanNumber: row.loan.loanNumber,
      productId: row.loan.productId,
      productName: row.productName,
      principal: row.loan.principal,
      annualRatePct: row.loan.annualRatePct,
      interestMethod: row.loan.interestMethod,
      frequency: row.loan.frequency,
      status: row.loan.status,
      disbursedOn: row.loan.disbursedOn,
      maturityDate: row.loan.maturityDate,
      position: positionOf(schedule, asOf),
      progress: progressOf(schedule, asOf),
      topUpEligible: row.loan.status === 'active' && topUpEligible(schedule, asOf),
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

  /** Sends a mobile-money approval prompt to the borrower's phone. Poll the returned request for the outcome. */
  @Post('loans/:id/pay')
  pay(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(borrowerPaySchema)) body: BorrowerPayInput) {
    return this.collections.request(user, id, body);
  }

  @Get('payment-requests/:id')
  paymentRequest(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.collections.get(user, id);
  }

  /** Products the borrower can apply for, with everything needed to quote them. */
  @Get('products')
  products(@CurrentUser() user: AuthUser) {
    return this.db
      .select({
        id: loanProducts.id,
        name: loanProducts.name,
        code: loanProducts.code,
        description: loanProducts.description,
        interestMethod: loanProducts.interestMethod,
        annualRatePct: loanProducts.annualRatePct,
        repaymentFrequency: loanProducts.repaymentFrequency,
        minAmount: loanProducts.minAmount,
        maxAmount: loanProducts.maxAmount,
        minTerm: loanProducts.minTerm,
        maxTerm: loanProducts.maxTerm,
        processingFeePct: loanProducts.processingFeePct,
        requiresGuarantor: loanProducts.requiresGuarantor,
      })
      .from(loanProducts)
      .where(and(eq(loanProducts.tenantId, user.tenantId!), eq(loanProducts.isActive, true)))
      .orderBy(asc(loanProducts.minAmount));
  }

  @Get('applications')
  async applicationList(@CurrentUser() user: AuthUser) {
    this.owner(user);
    return this.db
      .select({
        id: loanApplications.id,
        applicationNumber: loanApplications.applicationNumber,
        productName: loanProducts.name,
        amount: loanApplications.amount,
        term: loanApplications.term,
        frequency: loanProducts.repaymentFrequency,
        status: loanApplications.status,
        channel: loanApplications.channel,
        submittedAt: loanApplications.submittedAt,
        decidedAt: loanApplications.decidedAt,
        installmentAmount: sql<string>`${loanApplications.assessment}->>'installmentAmount'`,
        loanId: loans.id,
        loanStatus: loans.status,
      })
      .from(loanApplications)
      .innerJoin(loanProducts, eq(loanApplications.productId, loanProducts.id))
      .leftJoin(loans, eq(loans.applicationId, loanApplications.id))
      .where(and(eq(loanApplications.tenantId, user.tenantId!), eq(loanApplications.customerId, user.customerId!)))
      .orderBy(desc(loanApplications.submittedAt));
  }

  @Post('applications')
  async apply(@CurrentUser() user: AuthUser, @Body(new ZodPipe(borrowerApplicationSchema)) body: BorrowerApplicationInput, @Ip() ip: string) {
    const app = await this.applications.createForBorrower(user, body, ip);
    return { id: app.id, applicationNumber: app.applicationNumber, status: app.status, installmentAmount: app.assessment.installmentAmount };
  }

  @Get('documents')
  documents(@CurrentUser() user: AuthUser) {
    this.owner(user);
    return this.db
      .select({ id: customerDocuments.id, docType: customerDocuments.docType, fileName: customerDocuments.fileName, createdAt: customerDocuments.createdAt })
      .from(customerDocuments)
      .where(and(eq(customerDocuments.tenantId, user.tenantId!), eq(customerDocuments.customerId, user.customerId!)))
      .orderBy(desc(customerDocuments.createdAt));
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() user: AuthUser, @Body(new ZodPipe(documentTypeSchema)) body: { docType: DocumentType }, @UploadedFile() file: Express.Multer.File) {
    this.owner(user);
    return this.customersSvc.storeDocument(user.tenantId!, user.customerId!, user.id, body.docType, file);
  }
}
