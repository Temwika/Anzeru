import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ApplicationCreateInput, ApplicationDocumentType, ApplicationStatus, BorrowerApplicationInput } from "@anzelu/contracts";
import { assessAffordability, dec, generateSchedule, m, todayIn } from "@anzelu/finance";
import { aliasedTable, and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { assertBranchAccess, AuthUser, scope, tenantOf } from "../common/auth";
import { BusinessRuleError, Paged, paging } from "../common/http";
import { AuditService } from "../core/audit.service";
import { NumberingService } from "../core/numbering.service";
import { DB, InjectDb } from "../db/database";
import { storageRoot } from "../customers/customers.service";
import {
  applicationDocuments,
  collateral,
  creditDecisions,
  customerDocuments,
  customers,
  guarantors,
  loanApplications,
  loanProducts,
  loans,
  users,
} from "../db/schema";
import { positionOf, scheduleRowsByLoan } from "../loans/servicing";
import { Assessment, score } from "./scorecard";

const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];

/** What must be on file before a loan can be approved, shown to staff as a checklist. */
export interface CaptureChecklist {
  clientNrc: boolean;
  borrowerSigned: boolean;
  guarantorsRequired: boolean;
  guarantorsComplete: boolean;
  collateralRequired: boolean;
  collateralRecorded: boolean;
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, q: { status?: string; search?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, offset } = paging(q);
    const conditions = [scope(user, loanApplications.tenantId, loanApplications.branchId)];
    if (q.status) conditions.push(inArray(loanApplications.status, q.status.split(",") as ApplicationStatus[]));
    if (q.search) {
      const t = `%${q.search.trim()}%`;
      conditions.push(or(ilike(loanApplications.applicationNumber, t), ilike(customers.firstName, t), ilike(customers.lastName, t), ilike(customers.nrc, t))!);
    }
    const where = and(...conditions);
    const officer = aliasedTable(users, "officer");
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: loanApplications.id,
          applicationNumber: loanApplications.applicationNumber,
          amount: loanApplications.amount,
          term: loanApplications.term,
          status: loanApplications.status,
          channel: loanApplications.channel,
          submittedAt: loanApplications.submittedAt,
          customerId: customers.id,
          customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
          productName: loanProducts.name,
          frequency: loanProducts.repaymentFrequency,
          officerName: officer.fullName,
          grade: sql<string>`${loanApplications.assessment}->>'grade'`,
          collateralValue: sql<string>`(select coalesce(sum(${collateral.estimatedValue}), 0)::text from ${collateral} where ${collateral.applicationId} = ${loanApplications.id})`,
          guarantorCount: sql<number>`(select count(*)::int from ${guarantors} where ${guarantors.applicationId} = ${loanApplications.id})`,
          recommendation: sql<string>`${loanApplications.assessment}->>'recommendation'`,
        })
        .from(loanApplications)
        .innerJoin(customers, eq(loanApplications.customerId, customers.id))
        .innerJoin(loanProducts, eq(loanApplications.productId, loanProducts.id))
        .innerJoin(officer, eq(loanApplications.submittedBy, officer.id))
        .where(where)
        .orderBy(desc(loanApplications.submittedAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(loanApplications)
        .innerJoin(customers, eq(loanApplications.customerId, customers.id))
        .where(where),
    ]);
    return new Paged(rows, count, page, pageSize);
  }

  async get(user: AuthUser, id: string) {
    const officer = aliasedTable(users, "officer");
    const [row] = await this.db
      .select({ application: loanApplications, customer: customers, product: loanProducts, officerName: officer.fullName })
      .from(loanApplications)
      .innerJoin(customers, eq(loanApplications.customerId, customers.id))
      .innerJoin(loanProducts, eq(loanApplications.productId, loanProducts.id))
      .innerJoin(officer, eq(loanApplications.submittedBy, officer.id))
      .where(and(eq(loanApplications.id, id), scope(user, loanApplications.tenantId, loanApplications.branchId)));
    if (!row) throw new NotFoundException("Application not found");
    const tenantId = row.application.tenantId;
    const [guarantorRows, collateralRows, documents, [clientNrc], decisions, [loan]] = await Promise.all([
      this.db
        .select()
        .from(guarantors)
        .where(and(eq(guarantors.applicationId, id), eq(guarantors.tenantId, tenantId))),
      this.db
        .select()
        .from(collateral)
        .where(and(eq(collateral.applicationId, id), eq(collateral.tenantId, tenantId)))
        .orderBy(collateral.createdAt),
      this.db
        .select({
          id: applicationDocuments.id,
          docType: applicationDocuments.docType,
          guarantorId: applicationDocuments.guarantorId,
          collateralId: applicationDocuments.collateralId,
          fileName: applicationDocuments.fileName,
          mimeType: applicationDocuments.mimeType,
          createdAt: applicationDocuments.createdAt,
        })
        .from(applicationDocuments)
        .where(and(eq(applicationDocuments.applicationId, id), eq(applicationDocuments.tenantId, tenantId)))
        .orderBy(applicationDocuments.createdAt),
      this.db
        .select({ id: customerDocuments.id, mimeType: customerDocuments.mimeType })
        .from(customerDocuments)
        .where(and(eq(customerDocuments.customerId, row.customer.id), eq(customerDocuments.tenantId, tenantId), eq(customerDocuments.docType, "nrc")))
        .orderBy(desc(customerDocuments.createdAt))
        .limit(1),
      this.db
        .select({
          id: creditDecisions.id,
          decision: creditDecisions.decision,
          reason: creditDecisions.reason,
          decidedAt: creditDecisions.decidedAt,
          decidedBy: users.fullName,
        })
        .from(creditDecisions)
        .innerJoin(users, eq(creditDecisions.decidedBy, users.id))
        .where(and(eq(creditDecisions.applicationId, id), eq(creditDecisions.tenantId, tenantId)))
        .orderBy(desc(creditDecisions.decidedAt)),
      this.db
        .select({ id: loans.id, loanNumber: loans.loanNumber, status: loans.status })
        .from(loans)
        .where(and(eq(loans.applicationId, id), eq(loans.tenantId, tenantId))),
    ]);
    const canDecide =
      user.permissions.includes("applications:decide") &&
      row.application.status === "submitted" &&
      row.application.submittedBy !== user.id &&
      dec(user.approvalLimit).gte(dec(row.application.amount));
    return {
      ...row.application,
      assessment: row.application.assessment as Assessment,
      customer: row.customer,
      product: row.product,
      officerName: row.officerName,
      guarantors: guarantorRows,
      collateral: collateralRows,
      documents,
      clientNrcDocument: clientNrc ?? null,
      checklist: checklistFor(row.product, row.application, !!clientNrc, guarantorRows, collateralRows.length, documents),
      decisions,
      loan: loan ?? null,
      canDecide,
    };
  }

  async create(user: AuthUser, input: ApplicationCreateInput, ip?: string, submittedOn?: Date) {
    const tenantId = tenantOf(user);
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, input.customerId), scope(user, customers.tenantId, customers.branchId)));
    if (!customer) throw new BusinessRuleError("INVALID_CUSTOMER", "Select a customer from your branch");
    assertBranchAccess(user, customer.branchId);
    return this.submit(user, tenantId, customer, input, "branch", ip, submittedOn);
  }

  /**
   * A borrower applying from the portal, always for their own customer record.
   * It joins the same credit queue as branch applications, so scoring,
   * maker-checker and approval limits apply unchanged.
   */
  async createForBorrower(user: AuthUser, input: BorrowerApplicationInput, ip?: string) {
    const tenantId = tenantOf(user);
    if (!user.customerId) throw new NotFoundException("No customer profile is linked to this login");
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, user.customerId), eq(customers.tenantId, tenantId)));
    if (!customer) throw new NotFoundException("No customer profile is linked to this login");
    const [inFlight] = await this.db
      .select({ applicationNumber: loanApplications.applicationNumber })
      .from(loanApplications)
      .where(and(eq(loanApplications.tenantId, tenantId), eq(loanApplications.customerId, customer.id), eq(loanApplications.status, "submitted")));
    if (inFlight) {
      throw new BusinessRuleError(
        "APPLICATION_IN_REVIEW",
        `Application ${inFlight.applicationNumber} is still being reviewed; we will let you know the outcome first`,
      );
    }
    return this.submit(user, tenantId, customer, { ...input, customerId: customer.id }, "self_service", ip);
  }

  private async submit(
    user: AuthUser,
    tenantId: string,
    customer: typeof customers.$inferSelect,
    input: ApplicationCreateInput,
    channel: "branch" | "self_service",
    ip?: string,
    submittedOn?: Date,
  ) {
    const [product] = await this.db
      .select()
      .from(loanProducts)
      .where(and(eq(loanProducts.id, input.productId), eq(loanProducts.tenantId, tenantId)));
    if (!product || !product.isActive) throw new BusinessRuleError("INVALID_PRODUCT", "Select an active loan product");

    const amount = dec(input.amount);
    if (amount.lt(dec(product.minAmount)) || amount.gt(dec(product.maxAmount))) {
      throw new BusinessRuleError("AMOUNT_OUT_OF_RANGE", `${product.name} lends between K${product.minAmount} and K${product.maxAmount}`);
    }
    if (input.term < product.minTerm || input.term > product.maxTerm) {
      throw new BusinessRuleError("TERM_OUT_OF_RANGE", `${product.name} allows ${product.minTerm} to ${product.maxTerm} instalments`);
    }

    const assessment = await this.assess(tenantId, customer, product, input);

    return this.db.transaction(async (tx) => {
      const [app] = await tx
        .insert(loanApplications)
        .values({
          tenantId,
          branchId: customer.branchId,
          applicationNumber: await this.numbering.next(tx, tenantId, "application"),
          customerId: customer.id,
          productId: product.id,
          amount: m(input.amount),
          term: input.term,
          purpose: input.purpose,
          monthlyIncome: m(input.monthlyIncome),
          monthlyExpenses: m(input.monthlyExpenses),
          existingDebtRepayments: m(input.existingDebtRepayments),
          channel,
          assessment,
          submittedBy: user.id,
          ...(input.borrowerSignature ? { borrowerSignature: input.borrowerSignature, borrowerSignedAt: new Date() } : {}),
          ...(submittedOn ? { submittedAt: submittedOn } : {}),
        })
        .returning();
      const guarantorRows = input.guarantors.length
        ? await tx
            .insert(guarantors)
            .values(input.guarantors.map((g) => ({ ...g, signedAt: g.signature ? new Date() : null, tenantId, applicationId: app.id })))
            .returning({ id: guarantors.id, nrc: guarantors.nrc })
        : [];
      const collateralRows = input.collateral.length
        ? await tx
            .insert(collateral)
            .values(input.collateral.map((c) => ({ ...c, estimatedValue: m(c.estimatedValue), tenantId, applicationId: app.id })))
            .returning({ id: collateral.id })
        : [];
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: "application.submitted",
        entityType: "loan_application",
        entityId: app.id,
        data: {
          applicationNumber: app.applicationNumber,
          amount: app.amount,
          channel,
          score: assessment.score,
          recommendation: assessment.recommendation,
          guarantors: guarantorRows.length,
          collateral: collateralRows.length,
        },
        ip,
      });
      // The signature is evidence on file; it is not echoed back in the response.
      const { borrowerSignature: _signature, ...created } = app;
      return { ...created, assessment, guarantors: guarantorRows, collateral: collateralRows };
    });
  }

  private async assess(
    tenantId: string,
    customer: typeof customers.$inferSelect,
    product: typeof loanProducts.$inferSelect,
    input: ApplicationCreateInput,
  ): Promise<Assessment> {
    const preview = generateSchedule({
      principal: input.amount,
      annualRatePct: product.annualRatePct,
      term: input.term,
      method: product.interestMethod,
      frequency: product.repaymentFrequency,
      startDate: todayIn("Africa/Lusaka"),
      processingFeePct: product.processingFeePct,
    });
    const affordability = assessAffordability({
      monthlyIncome: input.monthlyIncome,
      monthlyExpenses: input.monthlyExpenses,
      existingDebtRepayments: input.existingDebtRepayments,
      installment: preview.installmentAmount,
      frequency: product.repaymentFrequency,
      maxDtiPct: product.maxDtiPct,
    });

    const history = await this.db
      .select({ id: loans.id, status: loans.status })
      .from(loans)
      .where(and(eq(loans.tenantId, tenantId), eq(loans.customerId, customer.id)));
    const active = history.filter((l) => l.status === "active");
    const schedules = await scheduleRowsByLoan(
      this.db,
      tenantId,
      active.map((l) => l.id),
    );
    const asOf = todayIn("Africa/Lusaka");
    const worstDpd = Math.max(0, ...active.map((l) => positionOf(schedules.get(l.id) ?? [], asOf).daysPastDue));

    return {
      installmentAmount: preview.installmentAmount,
      totalRepayable: preview.totals.repayable,
      totalInterest: preview.totals.interest,
      processingFee: preview.processingFee,
      aprPct: preview.disclosure.aprPct,
      affordability,
      ...score({
        affordability,
        maxDtiPct: product.maxDtiPct,
        kycVerified: customer.kycStatus === "verified",
        hasEmployer: Boolean(customer.employer),
        priorClosedLoans: history.filter((l) => l.status === "closed").length,
        worstCurrentDpd: worstDpd,
        activeLoans: active.length,
        guarantorRequired: product.requiresGuarantor,
        guarantorCount: input.guarantors.length,
      }),
    };
  }

  /**
   * Maker-checker credit decision. The approver must not be the officer who
   * submitted the application, and the amount must be within their delegated limit.
   */
  async decide(user: AuthUser, id: string, decision: "approve" | "reject", reason: string, ip?: string) {
    const tenantId = tenantOf(user);
    return this.db.transaction(async (tx) => {
      const [app] = await tx
        .select()
        .from(loanApplications)
        .where(and(eq(loanApplications.id, id), scope(user, loanApplications.tenantId, loanApplications.branchId)))
        .for("update");
      if (!app) throw new NotFoundException("Application not found");
      if (app.status !== "submitted") throw new BusinessRuleError("ALREADY_DECIDED", `This application is already ${app.status}`);
      if (app.submittedBy === user.id) {
        throw new ForbiddenException({ code: "MAKER_CHECKER", message: "You cannot decide an application you submitted" });
      }

      let loanId: string | null = null;
      if (decision === "approve") {
        if (dec(app.amount).gt(dec(user.approvalLimit))) {
          throw new ForbiddenException({
            code: "APPROVAL_LIMIT",
            message: `K${app.amount} exceeds your approval limit of K${user.approvalLimit}; refer to a senior approver`,
          });
        }
        const [customer] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, app.customerId), eq(customers.tenantId, tenantId)));
        if (customer.kycStatus !== "verified") throw new BusinessRuleError("KYC_NOT_VERIFIED", "Verify the customer’s KYC before approving");
        const [product] = await tx.select().from(loanProducts).where(eq(loanProducts.id, app.productId));
        const [gs, [{ items }], docs, [nrc]] = await Promise.all([
          tx.select().from(guarantors).where(eq(guarantors.applicationId, app.id)),
          tx
            .select({ items: sql<number>`count(*)::int` })
            .from(collateral)
            .where(eq(collateral.applicationId, app.id)),
          tx
            .select({ docType: applicationDocuments.docType, guarantorId: applicationDocuments.guarantorId })
            .from(applicationDocuments)
            .where(eq(applicationDocuments.applicationId, app.id)),
          tx
            .select({ id: customerDocuments.id })
            .from(customerDocuments)
            .where(and(eq(customerDocuments.customerId, app.customerId), eq(customerDocuments.docType, "nrc")))
            .limit(1),
        ]);
        const check = checklistFor(product, app, !!nrc, gs, items, docs);
        if (!check.clientNrc) throw new BusinessRuleError("CLIENT_NRC_MISSING", "Capture a photo of the client’s NRC before approving");
        if (product.requiresGuarantor && !gs.length) throw new BusinessRuleError("GUARANTOR_REQUIRED", `${product.name} requires a guarantor`);
        if (!check.guarantorsComplete) {
          throw new BusinessRuleError("GUARANTOR_INCOMPLETE", "Every guarantor needs their NRC photo and signature on file before approval");
        }
        if (product.requiresCollateral && !items) throw new BusinessRuleError("COLLATERAL_REQUIRED", `${product.name} requires collateral to be recorded`);
        const [loan] = await tx
          .insert(loans)
          .values({
            tenantId,
            branchId: app.branchId,
            loanNumber: await this.numbering.next(tx, tenantId, "loan"),
            applicationId: app.id,
            customerId: app.customerId,
            productId: app.productId,
            officerId: app.submittedBy,
            approvedBy: user.id,
            principal: app.amount,
            annualRatePct: product.annualRatePct,
            interestMethod: product.interestMethod,
            frequency: product.repaymentFrequency,
            term: app.term,
            processingFee: m(dec(app.amount).times(dec(product.processingFeePct)).div(100)),
            penaltyPct: product.penaltyPct,
            graceDays: product.graceDays,
          })
          .returning({ id: loans.id, loanNumber: loans.loanNumber });
        loanId = loan.id;
      }

      await tx
        .update(loanApplications)
        .set({ status: decision === "approve" ? "approved" : "rejected", decidedAt: new Date() })
        .where(eq(loanApplications.id, app.id));
      await tx.insert(creditDecisions).values({
        tenantId,
        applicationId: app.id,
        decision,
        reason,
        approverLimit: user.approvalLimit,
        decidedBy: user.id,
      });
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: `application.${decision === "approve" ? "approved" : "rejected"}`,
        entityType: "loan_application",
        entityId: app.id,
        data: { amount: app.amount, reason, loanId },
        ip,
      });
      return { id: app.id, status: decision === "approve" ? "approved" : "rejected", loanId };
    });
  }

  /** Loads an application the caller may act on, for the capture endpoints below. */
  private async editable(user: AuthUser, id: string) {
    const [app] = await this.db
      .select({
        id: loanApplications.id,
        tenantId: loanApplications.tenantId,
        status: loanApplications.status,
        applicationNumber: loanApplications.applicationNumber,
      })
      .from(loanApplications)
      .where(and(eq(loanApplications.id, id), scope(user, loanApplications.tenantId, loanApplications.branchId)));
    if (!app) throw new NotFoundException("Application not found");
    return app;
  }

  /** Stores a guarantor NRC photo or collateral photo against the application. */
  async addDocument(
    user: AuthUser,
    id: string,
    input: { docType: ApplicationDocumentType; guarantorId?: string; collateralId?: string },
    file?: Express.Multer.File,
    ip?: string,
  ) {
    const app = await this.editable(user, id);
    if (app.status !== "submitted") throw new BusinessRuleError("ALREADY_DECIDED", `Application ${app.applicationNumber} is already ${app.status}`);
    if (!file) throw new BusinessRuleError("FILE_REQUIRED", "Attach a photo");
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BusinessRuleError("FILE_TYPE", "Upload a JPEG or PNG photo, or a PDF");
    const isGuarantorDoc = input.docType.startsWith("guarantor_");
    if (isGuarantorDoc) {
      const [g] = input.guarantorId
        ? await this.db
            .select({ id: guarantors.id })
            .from(guarantors)
            .where(and(eq(guarantors.id, input.guarantorId), eq(guarantors.applicationId, id)))
        : [];
      if (!g) throw new BusinessRuleError("INVALID_GUARANTOR", "Choose a guarantor on this application");
    } else {
      const [c] = input.collateralId
        ? await this.db
            .select({ id: collateral.id })
            .from(collateral)
            .where(and(eq(collateral.id, input.collateralId), eq(collateral.applicationId, id)))
        : [];
      if (!c) throw new BusinessRuleError("INVALID_COLLATERAL", "Choose a collateral item on this application");
    }
    const key = join(app.tenantId, randomUUID());
    mkdirSync(join(storageRoot(), app.tenantId), { recursive: true });
    writeFileSync(join(storageRoot(), key), file.buffer);
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    return this.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(applicationDocuments)
        .values({
          tenantId: app.tenantId,
          applicationId: id,
          guarantorId: isGuarantorDoc ? input.guarantorId : null,
          collateralId: isGuarantorDoc ? null : input.collateralId,
          docType: input.docType,
          fileName: file.originalname.slice(0, 200),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: key,
          sha256,
          uploadedBy: user.id,
        })
        .returning({ id: applicationDocuments.id, docType: applicationDocuments.docType });
      await this.audit.record(tx, {
        tenantId: app.tenantId,
        userId: user.id,
        action: "application.document_uploaded",
        entityType: "loan_application",
        entityId: id,
        data: { documentId: doc.id, docType: input.docType, guarantorId: input.guarantorId, collateralId: input.collateralId, sha256 },
        ip,
      });
      return doc;
    });
  }

  async getDocument(user: AuthUser, id: string, docId: string) {
    const app = await this.editable(user, id);
    const [doc] = await this.db
      .select()
      .from(applicationDocuments)
      .where(and(eq(applicationDocuments.id, docId), eq(applicationDocuments.applicationId, id), eq(applicationDocuments.tenantId, app.tenantId)));
    if (!doc) throw new NotFoundException("Document not found");
    return { ...doc, path: join(storageRoot(), doc.storageKey) };
  }

  /** Records a guarantor's signature captured on screen (e.g. when they come to the branch after the application). */
  async signGuarantor(user: AuthUser, id: string, guarantorId: string, signature: string, ip?: string) {
    const app = await this.editable(user, id);
    if (app.status !== "submitted") throw new BusinessRuleError("ALREADY_DECIDED", `Application ${app.applicationNumber} is already ${app.status}`);
    return this.db.transaction(async (tx) => {
      const [g] = await tx
        .update(guarantors)
        .set({ signature, signedAt: new Date() })
        .where(and(eq(guarantors.id, guarantorId), eq(guarantors.applicationId, id)))
        .returning({ id: guarantors.id, fullName: guarantors.fullName, signedAt: guarantors.signedAt });
      if (!g) throw new NotFoundException("Guarantor not found");
      await this.audit.record(tx, {
        tenantId: app.tenantId,
        userId: user.id,
        action: "application.guarantor_signed",
        entityType: "loan_application",
        entityId: id,
        data: { guarantorId },
        ip,
      });
      return g;
    });
  }
}

function checklistFor(
  product: { requiresGuarantor: boolean; requiresCollateral: boolean },
  app: { borrowerSignature: string | null },
  clientNrc: boolean,
  gs: { id: string; signature: string | null }[],
  collateralItems: number,
  docs: { docType: string; guarantorId: string | null }[],
): CaptureChecklist {
  const nrcOnFile = (gid: string) => docs.some((d) => d.guarantorId === gid && d.docType === "guarantor_nrc_front");
  return {
    clientNrc,
    borrowerSigned: !!app.borrowerSignature,
    guarantorsRequired: product.requiresGuarantor,
    guarantorsComplete: gs.every((g) => !!g.signature && nrcOnFile(g.id)) && (!product.requiresGuarantor || gs.length > 0),
    collateralRequired: product.requiresCollateral,
    collateralRecorded: collateralItems > 0,
  };
}
