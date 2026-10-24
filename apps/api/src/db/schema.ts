import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Every tenant-owned table carries tenant_id. Money is NUMERIC(18,2), rates are
 * NUMERIC(9,4) percentages, business dates are DATE and event times TIMESTAMPTZ (UTC).
 */
const money = (name: string) => numeric(name, { precision: 18, scale: 2 });
const ratePct = (name: string) => numeric(name, { precision: 9, scale: 4 });
const pk = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const tenantRef = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id);

export const roleEnum = pgEnum("role", [
  "platform_admin",
  "institution_admin",
  "credit_officer",
  "credit_manager",
  "cashier",
  "accountant",
  "auditor",
  "borrower",
]);
export const interestMethodEnum = pgEnum("interest_method", ["reducing_balance", "flat", "flat_term", "interest_only"]);
export const frequencyEnum = pgEnum("repayment_frequency", ["daily", "weekly", "fortnightly", "monthly"]);
export const channelEnum = pgEnum("payment_channel", ["cash", "bank", "mtn_momo", "airtel_money"]);
export const applicationStatusEnum = pgEnum("application_status", ["submitted", "approved", "rejected", "cancelled"]);
export const loanStatusEnum = pgEnum("loan_status", ["pending_disbursement", "active", "closed", "written_off"]);
export const kycStatusEnum = pgEnum("kyc_status", ["pending", "verified", "rejected"]);
export const accountTypeEnum = pgEnum("account_type", ["asset", "liability", "equity", "income", "expense"]);
export const componentEnum = pgEnum("allocation_component", ["penalty", "fee", "interest", "principal"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);
export const disbursementStatusEnum = pgEnum("disbursement_status", ["requested", "completed", "rejected"]);
export const paymentStatusEnum = pgEnum("payment_status", ["posted", "reversed"]);
export const applicationChannelEnum = pgEnum("application_channel", ["branch", "self_service"]);
export const collectionStatusEnum = pgEnum("collection_status", ["pending", "succeeded", "failed"]);
export const activityTypeEnum = pgEnum("collection_activity_type", ["call", "sms", "visit", "promise_to_pay", "note"]);

// ── Tenancy ──────────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: pk(),
  name: text("name").notNull(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  currency: varchar("currency", { length: 3 }).notNull().default("ZMW"),
  timezone: text("timezone").notNull().default("Africa/Lusaka"),
  plan: text("plan").notNull().default("starter"),
  status: text("status").notNull().default("active"),
  /** Company details printed on receipts and shown to borrowers. */
  profile: jsonb("profile").$type<CompanyProfile>().notNull().default({}),
  createdAt: createdAt(),
});

export interface CompanyProfile {
  tradingName?: string;
  tagline?: string;
  address?: string;
  phones?: string;
  email?: string;
  licenceNumber?: string;
  receiptNote?: string;
}

export const branches = pgTable(
  "branches",
  {
    id: pk(),
    tenantId: tenantRef(),
    name: text("name").notNull(),
    code: varchar("code", { length: 8 }).notNull(),
    address: text("address"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("branches_tenant_code_uq").on(t.tenantId, t.code)],
);

/** Sequential human-readable numbers (CUS-000001, LN-000001 …) per tenant. */
export const counters = pgTable(
  "counters",
  {
    tenantId: tenantRef(),
    key: text("key").notNull(),
    value: integer("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);

// ── Identity ─────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: pk(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: roleEnum("role").notNull(),
    approvalLimit: money("approval_limit").notNull().default("0"),
    customerId: uuid("customer_id"),
    isActive: boolean("is_active").notNull().default(true),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    mfaSecret: text("mfa_secret"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_tenant_idx").on(t.tenantId)],
);

export const userBranchAccess = pgTable(
  "user_branch_access",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    tenantId: tenantRef(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.branchId] })],
);

// ── Customers ────────────────────────────────────────────────────────────────
export const customers = pgTable(
  "customers",
  {
    id: pk(),
    tenantId: tenantRef(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    customerNumber: varchar("customer_number", { length: 20 }).notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    nrc: varchar("nrc", { length: 11 }).notNull(),
    phone: varchar("phone", { length: 16 }).notNull(),
    email: text("email"),
    dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
    gender: text("gender").notNull(),
    address: text("address").notNull(),
    employer: text("employer"),
    occupation: text("occupation"),
    monthlyIncome: money("monthly_income").notNull(),
    nextOfKinName: text("next_of_kin_name"),
    nextOfKinPhone: text("next_of_kin_phone"),
    groupId: uuid("group_id").references(() => loanGroups.id),
    kycStatus: kycStatusEnum("kyc_status").notNull().default("pending"),
    kycNote: text("kyc_note"),
    kycDecidedBy: uuid("kyc_decided_by"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("customers_tenant_nrc_uq").on(t.tenantId, t.nrc),
    uniqueIndex("customers_tenant_number_uq").on(t.tenantId, t.customerNumber),
    index("customers_tenant_phone_idx").on(t.tenantId, t.phone),
    index("customers_branch_idx").on(t.tenantId, t.branchId),
  ],
);

/** A borrower group, e.g. traders at one market who meet and repay together. */
export const loanGroups = pgTable(
  "loan_groups",
  {
    id: pk(),
    tenantId: tenantRef(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    name: text("name").notNull(),
    meetingPlace: text("meeting_place"),
    meetingDay: text("meeting_day"),
    officerId: uuid("officer_id").references(() => users.id),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("loan_groups_tenant_name_uq").on(t.tenantId, sql`lower(${t.name})`), index("loan_groups_branch_idx").on(t.tenantId, t.branchId)],
);

export const customerDocuments = pgTable("customer_documents", {
  id: pk(),
  tenantId: tenantRef(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  docType: text("doc_type").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  createdAt: createdAt(),
});

// ── Products & origination ───────────────────────────────────────────────────
export const loanProducts = pgTable(
  "loan_products",
  {
    id: pk(),
    tenantId: tenantRef(),
    name: text("name").notNull(),
    code: varchar("code", { length: 16 }).notNull(),
    description: text("description"),
    interestMethod: interestMethodEnum("interest_method").notNull(),
    annualRatePct: ratePct("annual_rate_pct").notNull(),
    repaymentFrequency: frequencyEnum("repayment_frequency").notNull(),
    minAmount: money("min_amount").notNull(),
    maxAmount: money("max_amount").notNull(),
    minTerm: integer("min_term").notNull(),
    maxTerm: integer("max_term").notNull(),
    processingFeePct: ratePct("processing_fee_pct").notNull().default("0"),
    penaltyPct: ratePct("penalty_pct").notNull().default("0"),
    graceDays: integer("grace_days").notNull().default(0),
    maxDtiPct: ratePct("max_dti_pct").notNull().default("40"),
    requiresGuarantor: boolean("requires_guarantor").notNull().default(false),
    requiresCollateral: boolean("requires_collateral").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("loan_products_tenant_code_uq").on(t.tenantId, t.code)],
);

export const loanApplications = pgTable(
  "loan_applications",
  {
    id: pk(),
    tenantId: tenantRef(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    applicationNumber: varchar("application_number", { length: 20 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => loanProducts.id),
    amount: money("amount").notNull(),
    term: integer("term").notNull(),
    purpose: text("purpose").notNull(),
    monthlyIncome: money("monthly_income").notNull(),
    monthlyExpenses: money("monthly_expenses").notNull(),
    existingDebtRepayments: money("existing_debt_repayments").notNull(),
    status: applicationStatusEnum("status").notNull().default("submitted"),
    /** Where the application came from: keyed in at a branch, or submitted by the borrower online. */
    channel: applicationChannelEnum("channel").notNull().default("branch"),
    assessment: jsonb("assessment").notNull(),
    submittedBy: uuid("submitted_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** The borrower's signature on the loan application, as a PNG data URL captured on screen. */
    borrowerSignature: text("borrower_signature"),
    borrowerSignedAt: timestamp("borrower_signed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("applications_tenant_number_uq").on(t.tenantId, t.applicationNumber), index("applications_status_idx").on(t.tenantId, t.status)],
);

export const guarantors = pgTable("guarantors", {
  id: pk(),
  tenantId: tenantRef(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => loanApplications.id),
  fullName: text("full_name").notNull(),
  nrc: varchar("nrc", { length: 11 }).notNull(),
  phone: varchar("phone", { length: 16 }).notNull(),
  relationship: text("relationship").notNull(),
  address: text("address"),
  /** The guarantor's signature, as a PNG data URL captured on screen. */
  signature: text("signature"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
});

/** Security pledged against a loan application: goods, a vehicle, title deeds, livestock and so on. */
export const collateral = pgTable("collateral", {
  id: pk(),
  tenantId: tenantRef(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => loanApplications.id),
  type: text("type").notNull(),
  description: text("description").notNull(),
  identifier: text("identifier"),
  estimatedValue: money("estimated_value").notNull(),
  location: text("location"),
  createdAt: createdAt(),
});

/** Files captured for an application: guarantor NRC photos and collateral photos. Stored privately like customer documents. */
export const applicationDocuments = pgTable("application_documents", {
  id: pk(),
  tenantId: tenantRef(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => loanApplications.id),
  guarantorId: uuid("guarantor_id").references(() => guarantors.id),
  collateralId: uuid("collateral_id").references(() => collateral.id),
  docType: text("doc_type").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  createdAt: createdAt(),
});

export const creditDecisions = pgTable("credit_decisions", {
  id: pk(),
  tenantId: tenantRef(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => loanApplications.id),
  decision: text("decision").notNull(),
  reason: text("reason").notNull(),
  approverLimit: money("approver_limit").notNull(),
  decidedBy: uuid("decided_by").notNull(),
  decidedAt: createdAt(),
});

// ── Loan accounts ────────────────────────────────────────────────────────────
export const loans = pgTable(
  "loans",
  {
    id: pk(),
    tenantId: tenantRef(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    loanNumber: varchar("loan_number", { length: 20 }).notNull(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => loanApplications.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => loanProducts.id),
    officerId: uuid("officer_id").notNull(),
    approvedBy: uuid("approved_by").notNull(),
    principal: money("principal").notNull(),
    annualRatePct: ratePct("annual_rate_pct").notNull(),
    interestMethod: interestMethodEnum("interest_method").notNull(),
    frequency: frequencyEnum("frequency").notNull(),
    term: integer("term").notNull(),
    processingFee: money("processing_fee").notNull(),
    penaltyPct: ratePct("penalty_pct").notNull(),
    graceDays: integer("grace_days").notNull(),
    status: loanStatusEnum("status").notNull().default("pending_disbursement"),
    disbursedOn: date("disbursed_on", { mode: "string" }),
    maturityDate: date("maturity_date", { mode: "string" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("loans_tenant_number_uq").on(t.tenantId, t.loanNumber),
    uniqueIndex("loans_application_uq").on(t.applicationId),
    index("loans_status_idx").on(t.tenantId, t.status),
    index("loans_customer_idx").on(t.tenantId, t.customerId),
  ],
);

export const loanScheduleItems = pgTable(
  "loan_schedule_items",
  {
    id: pk(),
    tenantId: tenantRef(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id),
    installmentNo: integer("installment_no").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    principalDue: money("principal_due").notNull(),
    interestDue: money("interest_due").notNull(),
    feeDue: money("fee_due").notNull().default("0"),
    penaltyDue: money("penalty_due").notNull().default("0"),
    principalPaid: money("principal_paid").notNull().default("0"),
    interestPaid: money("interest_paid").notNull().default("0"),
    feePaid: money("fee_paid").notNull().default("0"),
    penaltyPaid: money("penalty_paid").notNull().default("0"),
    penaltyAppliedAt: timestamp("penalty_applied_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("schedule_loan_installment_uq").on(t.loanId, t.installmentNo),
    index("schedule_due_idx").on(t.tenantId, t.dueDate),
    check("schedule_paid_not_negative", sql`principal_paid >= 0 AND interest_paid >= 0 AND fee_paid >= 0 AND penalty_paid >= 0`),
  ],
);

export const loanDisbursements = pgTable("loan_disbursements", {
  id: pk(),
  tenantId: tenantRef(),
  loanId: uuid("loan_id")
    .notNull()
    .references(() => loans.id),
  amount: money("amount").notNull(),
  fee: money("fee").notNull(),
  netAmount: money("net_amount").notNull(),
  channel: channelEnum("channel").notNull(),
  destination: text("destination").notNull(),
  valueDate: date("value_date", { mode: "string" }).notNull(),
  status: disbursementStatusEnum("status").notNull().default("requested"),
  providerRef: text("provider_ref"),
  note: text("note"),
  requestedBy: uuid("requested_by").notNull(),
  requestedAt: createdAt(),
  decidedBy: uuid("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  journalEntryId: uuid("journal_entry_id"),
});

// ── Transactions ─────────────────────────────────────────────────────────────
export const payments = pgTable(
  "payments",
  {
    id: pk(),
    tenantId: tenantRef(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id),
    receiptNumber: varchar("receipt_number", { length: 20 }).notNull(),
    amount: money("amount").notNull(),
    unallocated: money("unallocated").notNull().default("0"),
    channel: channelEnum("channel").notNull(),
    externalRef: text("external_ref"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: paymentStatusEnum("status").notNull().default("posted"),
    receivedOn: date("received_on", { mode: "string" }).notNull(),
    recordedBy: uuid("recorded_by"),
    journalEntryId: uuid("journal_entry_id"),
    /** Early-settlement interest waived per instalment, restored if the payment is reversed. */
    interestWaivers: jsonb("interest_waivers").$type<{ itemId: string; interest: string }[]>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("payments_tenant_idem_uq").on(t.tenantId, t.idempotencyKey),
    uniqueIndex("payments_tenant_receipt_uq").on(t.tenantId, t.receiptNumber),
    index("payments_loan_idx").on(t.loanId),
    check("payments_amount_positive", sql`amount > 0`),
  ],
);

/**
 * Borrower-initiated mobile-money collections (request-to-pay). The provider
 * prompts the borrower's phone; once they approve, the payment is posted with
 * the request id as its idempotency key, so a request can never post twice.
 */
export const collectionRequests = pgTable(
  "collection_requests",
  {
    id: pk(),
    tenantId: tenantRef(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id),
    requestedBy: uuid("requested_by").notNull(),
    channel: channelEnum("channel").notNull(),
    msisdn: varchar("msisdn", { length: 15 }).notNull(),
    amount: money("amount").notNull(),
    /** Settlement requests waive future interest when they post; instalment requests do not. */
    settlement: boolean("settlement").notNull().default(false),
    status: collectionStatusEnum("status").notNull().default("pending"),
    providerRef: text("provider_ref"),
    paymentId: uuid("payment_id"),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("collection_requests_loan_idx").on(t.tenantId, t.loanId), check("collection_requests_amount_positive", sql`amount > 0`)],
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: pk(),
    tenantId: tenantRef(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    scheduleItemId: uuid("schedule_item_id")
      .notNull()
      .references(() => loanScheduleItems.id),
    component: componentEnum("component").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [index("allocations_payment_idx").on(t.paymentId)],
);

export const paymentReversals = pgTable("payment_reversals", {
  id: pk(),
  tenantId: tenantRef(),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id),
  reason: text("reason").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  requestedBy: uuid("requested_by").notNull(),
  requestedAt: createdAt(),
  decidedBy: uuid("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  note: text("note"),
  journalEntryId: uuid("journal_entry_id"),
});

// ── Collections ──────────────────────────────────────────────────────────────
export const collectionActivities = pgTable(
  "collection_activities",
  {
    id: pk(),
    tenantId: tenantRef(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id),
    type: activityTypeEnum("type").notNull(),
    note: text("note").notNull(),
    promisedAmount: money("promised_amount"),
    promisedDate: date("promised_date", { mode: "string" }),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("collection_activities_loan_idx").on(t.loanId)],
);

// ── Accounting ───────────────────────────────────────────────────────────────
export const chartOfAccounts = pgTable(
  "chart_of_accounts",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: varchar("code", { length: 10 }).notNull(),
    name: text("name").notNull(),
    type: accountTypeEnum("type").notNull(),
  },
  (t) => [uniqueIndex("coa_tenant_code_uq").on(t.tenantId, t.code)],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: pk(),
    tenantId: tenantRef(),
    entryNumber: varchar("entry_number", { length: 20 }).notNull(),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"),
    reversalOfId: uuid("reversal_of_id"),
    postedBy: uuid("posted_by"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("journal_tenant_number_uq").on(t.tenantId, t.entryNumber), index("journal_date_idx").on(t.tenantId, t.entryDate)],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: pk(),
    tenantId: tenantRef(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => chartOfAccounts.id),
    debit: money("debit").notNull().default("0"),
    credit: money("credit").notNull().default("0"),
  },
  (t) => [
    index("journal_lines_entry_idx").on(t.entryId),
    index("journal_lines_account_idx").on(t.tenantId, t.accountId),
    check("journal_line_one_side", sql`debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit + credit) > 0`),
  ],
);

// ── Communication & governance ───────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    tenantId: tenantRef(),
    channel: text("channel").notNull(),
    recipient: text("recipient").notNull(),
    template: text("template").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("queued"),
    dedupeKey: text("dedupe_key"),
    relatedType: text("related_type"),
    relatedId: uuid("related_id"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("notifications_dedupe_uq").on(t.tenantId, t.dedupeKey)],
);

export const webhookEvents = pgTable("webhook_events", {
  id: pk(),
  tenantId: uuid("tenant_id"),
  provider: text("provider").notNull(),
  externalRef: text("external_ref"),
  payload: jsonb("payload").notNull(),
  signatureValid: boolean("signature_valid").notNull(),
  outcome: text("outcome").notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

/** Tamper-evident: each row's hash covers its content and the previous row's hash (per tenant). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id"),
    userId: uuid("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    data: jsonb("data").notNull(),
    ip: text("ip"),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("audit_tenant_seq_idx").on(t.tenantId, t.seq)],
);
