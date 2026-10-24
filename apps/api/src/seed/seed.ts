import { INestApplicationContext, Logger } from '@nestjs/common';
import { Channel, Role } from '@anzelu/contracts';
import { addDays, addMonths, dec, m, todayIn } from '@anzelu/finance';
import { and, asc, eq } from 'drizzle-orm';
import { ApplicationsService } from '../applications/applications.service';
import { hashPassword } from '../auth/crypto';
import { AuthUser, loadAuthUser } from '../common/auth';
import { AuditService } from '../core/audit.service';
import { ACCOUNTS, LedgerService } from '../core/ledger.service';
import { CustomersService } from '../customers/customers.service';
import { DB, DB_TOKEN } from '../db/database';
import { branches, customers, loanProducts, loanScheduleItems, tenants, userBranchAccess, users } from '../db/schema';
import { LoansService } from '../loans/loans.service';
import { PaymentsService } from '../payments/payments.service';

/** Demo password for every seeded account (development data only). */
export const DEMO_PASSWORD = 'Demo2026!pass';

/** Deterministic PRNG so every fresh database gets the same demo book. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const FIRST = ['Chanda', 'Mwila', 'Bwalya', 'Mutale', 'Natasha', 'Kondwani', 'Thandiwe', 'Musonda', 'Chilufya', 'Mapalo', 'Lubinda', 'Nalukui', 'Kalaba', 'Mulenga', 'Chipo', 'Kabwe', 'Lweendo', 'Inonge', 'Mwansa', 'Zyambo', 'Namakau', 'Chisanga', 'Taonga', 'Chomba', 'Mukuka', 'Precious', 'Sepo', 'Kasonde', 'Mubanga', 'Nchimunya', 'Chimwemwe', 'Luyando', 'Mwape', 'Kunda', 'Malama', 'Chabala'];
const LAST = ['Banda', 'Phiri', 'Mwanza', 'Tembo', 'Zulu', 'Mulenga', 'Chileshe', 'Lungu', 'Sakala', 'Mumba', 'Ngoma', 'Kaunda', 'Mwale', 'Daka', 'Chirwa', 'Siame', 'Musonda', 'Hamoonga', 'Simukonda', 'Kapembwa'];
const EMPLOYERS = ['Ministry of Health', 'Zambia Revenue Authority', 'ZESCO Limited', 'Copperbelt University', 'Lusaka City Council', 'Shoprite Zambia', 'Zambia National Commercial Bank', 'Ministry of Education', null, null, null];
const PURPOSES = ['School fees', 'Restock shop inventory', 'Medical expenses', 'Home improvement', 'Purchase farming inputs', 'Working capital', 'Vehicle repairs', 'Buy a freezer for the business'];

type Behaviour = 'good' | 'late' | 'stopped' | 'early';

export async function seedDemo(app: INestApplicationContext) {
  const log = new Logger('Seed');
  const db = app.get<DB>(DB_TOKEN);
  const ledger = app.get(LedgerService);
  const audit = app.get(AuditService);
  const customersSvc = app.get(CustomersService);
  const applicationsSvc = app.get(ApplicationsService);
  const loansSvc = app.get(LoansService);
  const paymentsSvc = app.get(PaymentsService);
  const rand = rng(20261024);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const today = todayIn('Africa/Lusaka');
  log.log('Seeding demo institution…');

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [tenant] = await db.insert(tenants).values({ name: 'Kwacha Growth Microfinance', code: 'DEMO', plan: 'growth' }).returning();
  const tenantId = tenant.id;
  await ledger.seedChart(db, tenantId);
  await db.insert(tenants).values({ name: 'Copperbelt Teachers SACCO', code: 'CBTSACCO', plan: 'starter' });

  const [lsk, ktw, ndl] = await db
    .insert(branches)
    .values([
      { tenantId, name: 'Lusaka Main', code: 'LSK', address: 'Cairo Road, Lusaka' },
      { tenantId, name: 'Kitwe', code: 'KTW', address: 'Obote Avenue, Kitwe' },
      { tenantId, name: 'Ndola', code: 'NDL', address: 'Broadway, Ndola' },
    ])
    .returning();

  const staff: { key: string; email: string; fullName: string; role: Role; limit?: string; branches?: string[]; tenant?: boolean }[] = [
    { key: 'platform', email: 'platform@anzelu.io', fullName: 'Platform Operator', role: 'platform_admin', tenant: false },
    { key: 'admin', email: 'admin@demo.zm', fullName: 'Grace Mwansa', role: 'institution_admin' },
    { key: 'officer', email: 'officer@demo.zm', fullName: 'Joseph Banda', role: 'credit_officer', branches: [lsk.id] },
    { key: 'officer2', email: 'officer.copperbelt@demo.zm', fullName: 'Ruth Chileshe', role: 'credit_officer', branches: [ktw.id, ndl.id] },
    { key: 'manager', email: 'manager@demo.zm', fullName: 'Peter Mulenga', role: 'credit_manager', limit: '150000' },
    { key: 'cashier', email: 'cashier@demo.zm', fullName: 'Agnes Tembo', role: 'cashier', branches: [lsk.id, ktw.id, ndl.id] },
    { key: 'accountant', email: 'accountant@demo.zm', fullName: 'Mwila Phiri', role: 'accountant' },
    { key: 'auditor', email: 'auditor@demo.zm', fullName: 'Inonge Siame', role: 'auditor' },
  ];
  const ids: Record<string, string> = {};
  for (const s of staff) {
    const [u] = await db
      .insert(users)
      .values({
        tenantId: s.tenant === false ? null : tenantId,
        email: s.email,
        passwordHash,
        fullName: s.fullName,
        role: s.role,
        approvalLimit: s.limit ?? '0',
      })
      .returning({ id: users.id });
    ids[s.key] = u.id;
    for (const b of s.branches ?? []) await db.insert(userBranchAccess).values({ userId: u.id, branchId: b, tenantId });
  }
  const as = async (key: string) => (await loadAuthUser(db, ids[key])) as AuthUser;
  const [officer, officer2, manager, accountant, cashier] = await Promise.all(['officer', 'officer2', 'manager', 'accountant', 'cashier'].map(as));

  // Lending capital injected nine months ago.
  await ledger.post(db, {
    tenantId,
    date: addMonths(today, -9),
    description: 'Capital injection: lending fund',
    sourceType: 'capital',
    postedBy: ids.accountant,
    lines: [
      { account: ACCOUNTS.bank, debit: '2500000' },
      { account: ACCOUNTS.capital, credit: '2500000' },
    ],
  });

  const productRows = await db
    .insert(loanProducts)
    .values([
      { tenantId, name: 'Salary Advance', code: 'SAL', description: 'Payroll-backed loans for formally employed customers', interestMethod: 'flat', annualRatePct: '30', repaymentFrequency: 'monthly', minAmount: '1000', maxAmount: '50000', minTerm: 1, maxTerm: 12, processingFeePct: '3', penaltyPct: '5', graceDays: 3, maxDtiPct: '40' },
      { tenantId, name: 'SME Working Capital', code: 'SME', description: 'Amortising loans for registered small businesses', interestMethod: 'reducing_balance', annualRatePct: '36', repaymentFrequency: 'monthly', minAmount: '5000', maxAmount: '250000', minTerm: 3, maxTerm: 24, processingFeePct: '2.5', penaltyPct: '5', graceDays: 5, maxDtiPct: '45', requiresGuarantor: true },
      { tenantId, name: 'Market Trader Weekly', code: 'MKT', description: 'Small weekly-repayment loans for market traders', interestMethod: 'flat', annualRatePct: '52', repaymentFrequency: 'weekly', minAmount: '500', maxAmount: '10000', minTerm: 4, maxTerm: 26, processingFeePct: '2', penaltyPct: '3', graceDays: 1, maxDtiPct: '50' },
      { tenantId, name: 'Agri Input Bullet', code: 'AGR', description: 'Seasonal input finance: monthly interest, principal at harvest', interestMethod: 'interest_only', annualRatePct: '30', repaymentFrequency: 'monthly', minAmount: '2000', maxAmount: '80000', minTerm: 3, maxTerm: 9, processingFeePct: '2', penaltyPct: '5', graceDays: 7, maxDtiPct: '45' },
    ])
    .returning();
  const product = Object.fromEntries(productRows.map((p) => [p.code, p]));

  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const fakeFile = (name: string) => ({ originalname: name, mimetype: 'application/pdf', size: pdf.length, buffer: pdf }) as Express.Multer.File;

  let loanCount = 0;
  const N = 36;
  for (let i = 0; i < N; i++) {
    const branch = i % 3 === 0 ? lsk : i % 3 === 1 ? ktw : ndl;
    const maker = branch.id === lsk.id ? officer : officer2;
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    const employer = pick(EMPLOYERS);
    const income = Math.round((4000 + rand() * 26000) / 50) * 50;
    const c = await customersSvc.create(maker, {
      branchId: branch.id,
      firstName: first,
      lastName: last,
      nrc: `${String(100000 + Math.floor(rand() * 899999))}/${String(10 + Math.floor(rand() * 89))}/1`,
      phone: `09${pick(['6', '7', '5'])}${String(1000000 + Math.floor(rand() * 8999999))}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase(),
      dateOfBirth: `${1965 + Math.floor(rand() * 35)}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 27)).padStart(2, '0')}`,
      gender: i % 2 ? 'male' : 'female',
      address: `Plot ${100 + i}, ${pick(['Kabulonga', 'Chelstone', 'Matero', 'Nkana East', 'Riverside', 'Kansenshi', 'Northrise', 'Woodlands'])}`,
      employer: employer ?? undefined,
      occupation: employer ? 'Salaried employee' : pick(['Trader', 'Farmer', 'Shop owner', 'Tailor', 'Transporter']),
      monthlyIncome: String(income),
      nextOfKinName: `${pick(FIRST)} ${last}`,
      nextOfKinPhone: `097${String(1000000 + Math.floor(rand() * 8999999))}`,
      consent: true,
    });
    await customersSvc.addDocument(maker, c.id, 'nrc', fakeFile(`nrc-${c.customerNumber}.pdf`));
    if (i >= N - 2) continue; // two brand-new customers awaiting KYC
    await customersSvc.decideKyc(manager, c.id, 'verified', 'NRC sighted and verified against original');

    const code = employer ? (rand() < 0.75 ? 'SAL' : 'SME') : pick(['MKT', 'MKT', 'SME', 'AGR']);
    const p = product[code];
    const term = code === 'MKT' ? pick([8, 12, 16, 20]) : code === 'AGR' ? pick([4, 6]) : code === 'SAL' ? pick([6, 9, 12]) : pick([6, 12, 18]);
    const maxForIncome = Math.min(Number(p.maxAmount), income * (code === 'MKT' ? 1.2 : 3));
    const amount = String(Math.max(Number(p.minAmount), Math.round((maxForIncome * (0.4 + rand() * 0.5)) / 100) * 100));

    // Disbursed between ~8 months and 1 week ago; the last few stay in the pipeline.
    const pipeline = i >= N - 8 ? (['submitted', 'submitted', 'rejected', 'approved', 'requested', 'submitted'] as const)[i - (N - 8)] : null;
    const valueDate = pipeline ? today : addDays(today, -Math.floor(7 + rand() * 235));
    const app = await applicationsSvc.create(
      maker,
      {
        customerId: c.id,
        productId: p.id,
        amount,
        term,
        purpose: pick(PURPOSES),
        monthlyIncome: String(income),
        monthlyExpenses: String(Math.round(income * (0.25 + rand() * 0.2))),
        existingDebtRepayments: String(rand() < 0.3 ? Math.round(income * 0.08) : 0),
        guarantors: p.requiresGuarantor ? [{ fullName: `${pick(FIRST)} ${pick(LAST)}`, nrc: `${String(200000 + i * 1371)}/11/1`, phone: `0966${String(100000 + i * 911).padStart(6, '0')}`, relationship: 'Business partner' }] : [],
      },
      undefined,
      new Date(`${addDays(valueDate, -2)}T09:00:00Z`),
    );
    if (pipeline === 'submitted') continue;
    if (pipeline === 'rejected') {
      await applicationsSvc.decide(manager, app.id, 'reject', 'Debt service ratio too high after including informal borrowings disclosed at interview');
      continue;
    }
    const decision = await applicationsSvc.decide(manager, app.id, 'approve', 'Meets affordability policy; employer and references confirmed');
    const loanId = decision.loanId!;
    if (pipeline === 'approved') continue;

    const channel: Channel = code === 'MKT' ? pick(['mtn_momo', 'airtel_money']) : code === 'SAL' ? 'bank' : pick(['bank', 'mtn_momo']);
    await loansSvc.requestDisbursement(maker, loanId, {
      channel,
      destination: channel === 'bank' ? `Zanaco ****${String(1000 + i * 37).slice(-4)}` : c.phone,
      valueDate,
    });
    if (pipeline === 'requested') continue;
    await loansSvc.decideDisbursement(accountant, loanId, 'authorise', 'Funds released');
    loanCount++;

    const behaviour: Behaviour = pick(['good', 'good', 'good', 'good', 'late', 'late', 'stopped', 'early']);
    const schedule = await db
      .select()
      .from(loanScheduleItems)
      .where(and(eq(loanScheduleItems.tenantId, tenantId), eq(loanScheduleItems.loanId, loanId)))
      .orderBy(asc(loanScheduleItems.installmentNo));
    const stopAfter = behaviour === 'stopped' ? Math.floor(rand() * 3) : Infinity;
    let k = 0;
    for (const item of schedule) {
      if (item.dueDate >= today || k >= stopAfter) break;
      k++;
      const due = dec(item.principalDue).plus(dec(item.interestDue));
      let paidOn = addDays(item.dueDate, behaviour === 'late' ? Math.floor(rand() * 20) : -Math.floor(rand() * 3));
      if (paidOn > today) paidOn = today;
      if (behaviour === 'late' && rand() < 0.3) continue; // skipped instalment
      const amount = behaviour === 'late' && rand() < 0.4 ? m(due.times(0.6)) : m(due);
      await paymentsSvc.record(cashier, {
        loanId,
        amount,
        channel: channel === 'bank' ? 'bank' : channel,
        externalRef: `TX${item.installmentNo}${loanId.slice(0, 6).toUpperCase()}`,
        idempotencyKey: `seed-${loanId}-${item.installmentNo}`,
        receivedAt: paidOn,
      });
    }
    if (behaviour === 'early' && k > 0) {
      // Settles the rest early with a lump sum (any overpayment becomes a customer credit).
      const detail = await loansSvc.get(cashier, loanId);
      if (detail.settlement && dec(detail.settlement.total).gt(0)) {
        await paymentsSvc.record(cashier, {
          loanId,
          amount: detail.position.totalOutstanding,
          channel: 'bank',
          externalRef: `SETTLE-${detail.loanNumber}`,
          idempotencyKey: `seed-settle-${loanId}`,
          receivedAt: today,
        });
      }
    }
  }

  // A reversal awaiting approval: a cashier keyed a receipt against the wrong loan.
  const recent = await paymentsSvc.list(cashier, { status: 'posted', pageSize: '1' });
  if (recent.items[0]) await paymentsSvc.requestReversal(cashier, recent.items[0].id, 'Receipt captured against the wrong loan account');

  // Borrower portal account for the first customer.
  const [firstCustomer] = await db.select().from(customers).where(eq(customers.tenantId, tenantId)).orderBy(asc(customers.createdAt)).limit(1);
  const [borrower] = await db
    .insert(users)
    .values({ tenantId, email: 'borrower@demo.zm', passwordHash, fullName: `${firstCustomer.firstName} ${firstCustomer.lastName}`, role: 'borrower', customerId: firstCustomer.id })
    .returning({ id: users.id });
  await audit.record(db, { tenantId, userId: null, action: 'seed.completed', entityType: 'tenant', entityId: tenantId, data: { borrowerUserId: borrower.id } });

  log.log(`Seeded ${N} customers and ${loanCount} disbursed loans for ${tenant.name}`);
}
