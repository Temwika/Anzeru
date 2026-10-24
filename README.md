# Chilimbitso: loan management platform

Chilimbitso is a multi-tenant loan management system for Zambian microfinance institutions, SACCOs and digital lenders. It covers the whole loan lifecycle: customer onboarding and KYC, credit assessment, approval, disbursement, repayment, collections, accounting and reporting. Financial controls are enforced by the server and the database, not just the UI.

| Layer | Technology |
|---|---|
| Web | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, TanStack Query, react-hook-form + Zod |
| API | NestJS 11 (Express 5), Drizzle ORM, Swagger at `/api/docs` |
| Database | PostgreSQL 17. In development an embedded PGlite (Postgres in WASM) runs with zero setup. |
| Shared | `@anzelu/contracts` (roles, permissions, Zod schemas), `@anzelu/finance` (decimal-exact loan maths) |

## Quick start (development)

Requires Node 22.12+. Docker is not needed.

```bash
npm install
npm run dev          # builds shared packages, then API on :4000 and web on :3000
```

On first start the API creates an embedded database in `apps/api/.data`, runs the migrations, and seeds a demo institution. Open http://localhost:3000 and sign in. The login page has a **Demo accounts** panel in development.

To reset the demo, stop the API and delete `apps/api/.data` and `apps/api/storage`.

### Demo accounts

All demo users share one password, defined as `DEMO_PASSWORD` in `apps/api/src/seed/seed.ts`.

| Email | Role | What to try |
|---|---|---|
| `officer@demo.zm` | Credit officer (Lusaka) | Onboard a customer, upload KYC, submit an application, request disbursement |
| `manager@demo.zm` | Credit manager (limit K150,000) | Verify KYC, approve/reject applications from **Approvals** |
| `accountant@demo.zm` | Accountant | Authorise payouts, approve reversals, trial balance, reconciliation |
| `cashier@demo.zm` | Cashier | Record repayments, request reversals, collections |
| `admin@demo.zm` | Institution admin | Products, branches, users, notifications, end-of-day |
| `auditor@demo.zm` | Auditor | Read-only everything + hash-chain audit verification |
| `platform@chilimbitso.zm` | Platform operator | Onboard / suspend institutions |
| `borrower@demo.zm` | Borrower | Self-service portal: balance, schedule, receipts |

## A full loan in five sign-ins

1. **Officer**: Customers → New customer → upload an NRC → Applications → New application.
2. **Manager**: Verify the customer's KYC → Approvals → Review → Approve. A loan is booked as *pending disbursement*.
3. **Officer**: open the loan → Request disbursement (MTN MoMo / Airtel / bank).
4. **Accountant**: Approvals → Authorise. The sandbox pays out, generates the schedule, posts the journal and queues an SMS.
5. **Cashier**: open the loan → Record payment. It is allocated to penalty → fee → interest → principal, oldest instalment first.

The same flow, plus every control below, runs automatically in `npm test`.

## Financial controls

- **Maker-checker everywhere.** Nobody can approve their own application, authorise a payout they requested or approved credit for, or approve a reversal they requested. Credit managers have approval limits.
- **Branch scoping.** Officers and cashiers only see customers and loans in their branches. Every query is also scoped to the tenant.
- **Exact money.** All amounts are decimal strings end to end and are computed with `decimal.js` (half-up to the ngwee). Floats are never used.
- **Idempotent payments.** Each receipt carries a unique idempotency key per tenant, so double clicks, retries and duplicate mobile-money callbacks return the original receipt.
- **Double-entry ledger.** A deferred database trigger rejects any unbalanced journal. Journals, allocations, payments and audit logs are immutable at the database level. Corrections post mirror reversal journals.
- **Tamper-evident audit trail.** Each audit entry stores the SHA-256 of its content plus the previous entry's hash. *Audit → Verify integrity* re-walks the chain.
- **Transparent credit scoring.** A rules-based scorecard runs with hard policy checks (KYC, DTI limit, product limits, guarantor). Every point is explained to the approver.
- **Cost-of-credit disclosure.** APR including fees is computed with IRR, as required for consumer disclosure.

## Security

- Sessions use a JWT in an `httpOnly`, `SameSite=Lax` cookie (8 h). The web app proxies `/api/v1/*` so the cookie is first-party.
- Passwords are hashed with scrypt. Accounts lock for 15 minutes after 5 failed logins, and the login route is rate-limited.
- Optional TOTP two-factor authentication (Settings → My security). The users list shows who has it on.
- KYC documents are stored outside the web root and only served through an authorised, audited endpoint. Uploads are type- and size-checked and SHA-256 fingerprinted.
- The CSV export guards against formula injection. The web app sends security headers (X-Frame-Options DENY, nosniff, referrer and permissions policies).
- The API refuses to start in production without a 32+ character `JWT_SECRET`.

## Integrations (sandboxed)

| Integration | Status |
|---|---|
| MTN MoMo / Airtel Money payouts | Sandbox adapter returns a provider reference. Swap in the real adapter in `apps/api/src/integrations/providers.ts`. |
| Mobile-money repayment callbacks | `POST /api/v1/integrations/:provider/callback/:tenantCode`, HMAC-SHA256 signed with `MOMO_WEBHOOK_SECRET`, logged and idempotent |
| SMS | Messages are written to the notification log (Settings → Notifications) and not delivered |
| Bank / MoMo reconciliation | Paste a statement in Accounting → Reconciliation. Matching is by reference and posts nothing. |

## End-of-day processing

The API runs end of day hourly in-process: late penalties after each product's grace period, reminders 3 days before due dates, and overdue notices. Every step is idempotent per day. Run it on demand from Settings → Operations, or with `POST /api/v1/jobs/end-of-day`. Set `DISABLE_SCHEDULER=true` when running several API replicas and trigger the job from one scheduler instead.

## Configuration (`apps/api/.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgres://…`. Leave empty for embedded PGlite (development only). |
| `JWT_SECRET` | Session signing key, 32+ characters (required in production) |
| `MOMO_WEBHOOK_SECRET` | Shared secret for provider callback signatures |
| `SEED_DEMO` | `true` seeds demo data into an empty database |
| `DOCUMENT_STORAGE_DIR` | Where KYC files are stored |
| `DISABLE_SCHEDULER` | `true` turns off the in-process end-of-day job |

The web app reads `API_URL` (default `http://localhost:4000`) at build time for the `/api/v1` proxy.

## Production with Docker

```bash
cp .env.docker.example .env      # set POSTGRES_PASSWORD, JWT_SECRET, MOMO_WEBHOOK_SECRET
docker compose up --build
```

This runs PostgreSQL 17, the API (migrations run on start) and the web app. Put TLS in front of the web service. The session cookie is marked `Secure` when `NODE_ENV=production`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + web with hot reload |
| `npm run build` / `npm start` | Production build / run |
| `npm test` | Finance engine unit tests + end-to-end lifecycle test against an in-memory database |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run seed` | Seed demo data into the configured database |
| `npm run db:generate -w @anzelu/api` | Generate a migration after editing `apps/api/src/db/schema.ts` |

## Repository layout

```
packages/contracts   roles, permission matrix, enums, Zod schemas shared by API and web
packages/finance     schedules (reducing / flat / interest-only), allocation, ageing, PAR, settlement, APR
apps/api             NestJS modular monolith: auth, customers, applications, loans, payments,
                     reports, accounting, settings, jobs, integrations, borrower portal
apps/api/drizzle     SQL migrations, including ledger-immutability triggers
apps/web             Next.js staff console (app/(app)/*), borrower portal (app/borrower), login
tests/e2e            end-to-end lifecycle and controls test
```
