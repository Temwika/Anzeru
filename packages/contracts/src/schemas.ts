import { z } from 'zod';
import { ROLES } from './access';
import {
  CHANNELS,
  COLLECTION_ACTIVITY_TYPES,
  DOCUMENT_TYPES,
  FREQUENCIES,
  INTEREST_METHODS,
  KYC_STATUSES,
} from './enums';

/**
 * Validation schemas shared by the API (request validation) and the web app
 * (form validation). Money travels as decimal strings, never floats.
 */
export const MONEY_RE = /^\d{1,13}(\.\d{1,2})?$/;
export const RATE_RE = /^\d{1,3}(\.\d{1,4})?$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Zambian National Registration Card format: 123456/78/1 */
export const NRC_RE = /^\d{6}\/\d{2}\/\d$/;
/** Zambian mobile numbers: +260 97x xxx xxx or 097x xxx xxx */
export const PHONE_RE = /^(\+260|0)\d{9}$/;

const trimmed = (v: unknown) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : v);
export const money = (label = 'Amount') =>
  z.preprocess(trimmed, z.string().regex(MONEY_RE, `${label} must be a number with up to 2 decimals`));
export const rate = (label = 'Rate') =>
  z.preprocess(trimmed, z.string().regex(RATE_RE, `${label} must be a percentage, e.g. 24 or 3.5`));
export const isoDate = (label = 'Date') => z.string().regex(DATE_RE, `${label} must be YYYY-MM-DD`);
const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(500).optional());
const uuid = z.uuid('Select a valid record');
const int = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^\d{6}$/, 'Enter the 6-digit code').optional()),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export const customerCreateSchema = z.object({
  branchId: uuid,
  firstName: z.string().trim().min(2, 'First name is required').max(80),
  lastName: z.string().trim().min(2, 'Last name is required').max(80),
  nrc: z.string().trim().regex(NRC_RE, 'NRC must look like 123456/78/1'),
  phone: z.string().trim().regex(PHONE_RE, 'Phone must look like 0971234567 or +260971234567'),
  email: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().email('Enter a valid email').optional()),
  dateOfBirth: isoDate('Date of birth'),
  gender: z.enum(['female', 'male', 'other']),
  address: z.string().trim().min(5, 'Physical address is required').max(300),
  employer: optionalText,
  occupation: optionalText,
  monthlyIncome: money('Monthly income'),
  nextOfKinName: optionalText,
  nextOfKinPhone: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().trim().regex(PHONE_RE, 'Phone must look like 0971234567').optional(),
  ),
  consent: z.literal(true, { error: 'The customer must consent to data processing and credit checks' }),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

export const kycDecisionSchema = z.object({
  status: z.enum(KYC_STATUSES).exclude(['pending']),
  note: optionalText,
});

export const documentTypeSchema = z.object({ docType: z.enum(DOCUMENT_TYPES) });

export const loanProductSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{2,16}$/, 'Code: 2-16 letters, digits or dashes'),
    description: optionalText,
    interestMethod: z.enum(INTEREST_METHODS),
    annualRatePct: rate('Annual interest rate'),
    repaymentFrequency: z.enum(FREQUENCIES),
    minAmount: money('Minimum amount'),
    maxAmount: money('Maximum amount'),
    minTerm: int('Minimum term', 1, 520),
    maxTerm: int('Maximum term', 1, 520),
    processingFeePct: rate('Processing fee'),
    penaltyPct: rate('Penalty'),
    graceDays: int('Grace days', 0, 60),
    maxDtiPct: rate('Maximum debt-to-income'),
    requiresGuarantor: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((p) => Number(p.maxAmount) >= Number(p.minAmount), {
    path: ['maxAmount'],
    message: 'Maximum amount must be at least the minimum amount',
  })
  .refine((p) => p.maxTerm >= p.minTerm, { path: ['maxTerm'], message: 'Maximum term must be at least the minimum term' });
export type LoanProductInput = z.infer<typeof loanProductSchema>;

export const guarantorSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  nrc: z.string().trim().regex(NRC_RE, 'NRC must look like 123456/78/1'),
  phone: z.string().trim().regex(PHONE_RE, 'Phone must look like 0971234567'),
  relationship: z.string().trim().min(2).max(60),
});

export const applicationCreateSchema = z.object({
  customerId: uuid,
  productId: uuid,
  amount: money('Loan amount'),
  term: int('Term', 1, 520),
  purpose: z.string().trim().min(3, 'Describe the loan purpose').max(300),
  monthlyIncome: money('Monthly income'),
  monthlyExpenses: money('Monthly expenses'),
  existingDebtRepayments: money('Existing debt repayments'),
  guarantors: z.array(guarantorSchema).max(3).default([]),
});
export type ApplicationCreateInput = z.infer<typeof applicationCreateSchema>;

/** A borrower applying from the portal: the customer is always the borrower's own record. */
export const borrowerApplicationSchema = applicationCreateSchema.omit({ customerId: true });
export type BorrowerApplicationInput = z.infer<typeof borrowerApplicationSchema>;

/**
 * Borrower-initiated mobile-money payment. A settlement pays off the loan today
 * (the server sets the amount from its own quote); otherwise an amount is required.
 */
export const borrowerPaySchema = z
  .object({
    channel: z.enum(['mtn_momo', 'airtel_money']),
    msisdn: z.string().trim().regex(PHONE_RE, 'Enter the wallet number, e.g. 0971234567'),
    amount: money('Amount').optional(),
    settlement: z.boolean().default(false),
  })
  .refine((v) => v.settlement || v.amount !== undefined, { path: ['amount'], message: 'Enter the amount to pay' });
export type BorrowerPayInput = z.infer<typeof borrowerPaySchema>;

export const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3, 'Record the reason for this decision').max(500),
});

export const disbursementRequestSchema = z.object({
  channel: z.enum(CHANNELS),
  destination: z.string().trim().min(3, 'Enter the account or mobile number').max(120),
  valueDate: isoDate('Value date').optional(),
});

export const disbursementDecisionSchema = z.object({
  decision: z.enum(['authorise', 'reject']),
  note: optionalText,
});

export const paymentCreateSchema = z.object({
  loanId: uuid,
  amount: money('Payment amount'),
  channel: z.enum(CHANNELS),
  externalRef: optionalText,
  idempotencyKey: z.string().trim().min(8).max(100),
  receivedAt: isoDate('Received date').optional(),
});
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const reversalRequestSchema = z.object({
  reason: z.string().trim().min(5, 'Explain why this payment must be reversed').max(500),
});

export const reversalDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: optionalText,
});

export const collectionActivitySchema = z
  .object({
    type: z.enum(COLLECTION_ACTIVITY_TYPES),
    note: z.string().trim().min(3, 'Add a note').max(1000),
    promisedAmount: z.preprocess((v) => (v === '' || v == null ? undefined : v), money('Promised amount').optional()),
    promisedDate: z.preprocess((v) => (v === '' ? undefined : v), isoDate('Promised date').optional()),
  })
  .refine((a) => a.type !== 'promise_to_pay' || (a.promisedAmount && a.promisedDate), {
    path: ['promisedAmount'],
    message: 'A promise to pay needs an amount and a date',
  });

export const branchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, 'Code: 2-8 letters or digits'),
  address: optionalText,
});

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a digit');

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(3).max(120),
  role: z.enum(ROLES).exclude(['platform_admin', 'borrower']),
  password: passwordSchema,
  branchIds: z.array(uuid).default([]),
  approvalLimit: money('Approval limit').default('0'),
});

export const userUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  approvalLimit: money('Approval limit').optional(),
  branchIds: z.array(uuid).optional(),
});

export const tenantCreateSchema = z.object({
  name: z.string().trim().min(3).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,12}$/, 'Code: 3-12 letters or digits'),
  plan: z.enum(['starter', 'growth', 'enterprise']).default('starter'),
  adminName: z.string().trim().min(3).max(120),
  adminEmail: z.string().trim().toLowerCase().email(),
  adminPassword: passwordSchema,
});

export const tenantStatusSchema = z.object({ status: z.enum(['active', 'suspended']) });

export const quoteSchema = z.object({
  amount: money('Loan amount'),
  term: int('Term', 1, 520),
  annualRatePct: rate('Annual interest rate'),
  interestMethod: z.enum(INTEREST_METHODS),
  frequency: z.enum(FREQUENCIES),
  processingFeePct: rate('Processing fee').default('0'),
  startDate: isoDate('Start date').optional(),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const reconciliationSchema = z.object({
  channel: z.enum(CHANNELS),
  lines: z
    .array(z.object({ reference: z.string().trim().min(1), amount: money(), date: isoDate().optional() }))
    .min(1)
    .max(5000),
});
