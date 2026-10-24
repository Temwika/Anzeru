export const INTEREST_METHODS = ["reducing_balance", "flat", "flat_term", "interest_only"] as const;
export type InterestMethod = (typeof INTEREST_METHODS)[number];

export const FREQUENCIES = ["daily", "weekly", "fortnightly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const CHANNELS = ["cash", "bank", "mtn_momo", "airtel_money"] as const;
export type Channel = (typeof CHANNELS)[number];

export const APPLICATION_STATUSES = ["submitted", "approved", "rejected", "cancelled"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const LOAN_STATUSES = ["pending_disbursement", "active", "closed", "written_off"] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const KYC_STATUSES = ["pending", "verified", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const COLLECTION_ACTIVITY_TYPES = ["call", "sms", "visit", "promise_to_pay", "note"] as const;
export type CollectionActivityType = (typeof COLLECTION_ACTIVITY_TYPES)[number];

export const DOCUMENT_TYPES = ["nrc", "payslip", "bank_statement", "proof_of_address", "business_licence", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const AGEING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

export const LABELS = {
  interestMethod: {
    reducing_balance: "Reducing balance",
    flat: "Flat rate",
    flat_term: "Flat % per loan",
    interest_only: "Interest only (bullet)",
  } satisfies Record<InterestMethod, string>,
  frequency: {
    daily: "Daily",
    weekly: "Weekly",
    fortnightly: "Fortnightly",
    monthly: "Monthly",
  } satisfies Record<Frequency, string>,
  channel: {
    cash: "Cash",
    bank: "Bank transfer",
    mtn_momo: "MTN Mobile Money",
    airtel_money: "Airtel Money",
  } satisfies Record<Channel, string>,
  documentType: {
    nrc: "NRC copy",
    payslip: "Payslip",
    bank_statement: "Bank statement",
    proof_of_address: "Proof of address",
    business_licence: "Business licence",
    other: "Other",
  } satisfies Record<DocumentType, string>,
};

/** How a product or loan rate reads to people: "30% p.a." or, for flat_term, "40% per loan". */
export function rateText(method: InterestMethod, ratePct: string | number, plain = false): string {
  const r = Number(ratePct);
  if (method === "flat_term") return plain ? `${r}% for the whole loan` : `${r}% per loan`;
  return plain ? `${r}% a year` : `${r}% p.a.`;
}
