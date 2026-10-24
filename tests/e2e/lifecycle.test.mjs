// End-to-end lifecycle test: boots the compiled API against a throwaway
// in-memory PostgreSQL (PGlite), seeds the demo institution, then drives the
// full lending cycle over HTTP — including the controls that must say "no".
//
// Run: npm run build && npm run test:e2e
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { dirname, join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 4100 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'Demo2026!pass';
const WEBHOOK_SECRET = 'e2e-webhook-secret';
let server;

async function waitForHealth(timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API did not start');
}

/** A signed-in client with its own cookie jar. */
async function as(email) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(res.status, 200, `login ${email}`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const call = async (method, path, body, headers = {}) => {
    const r = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: { cookie, ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => null);
    return { status: r.status, data: json?.data, error: json?.error, meta: json?.meta };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b, h) => call('POST', p, b, h),
  };
}

before(async () => {
  server = spawn(process.execPath, [join(root, 'apps/api/dist/main.js')], {
    cwd: join(root, 'apps/api'),
    env: { ...process.env, PORT: String(PORT), DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'memory://', SEED_DEMO: 'true', DISABLE_SCHEDULER: 'true', MOMO_WEBHOOK_SECRET: WEBHOOK_SECRET, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.on('data', (d) => (logs += d));
  server.stderr.on('data', (d) => (logs += d));
  server.on('exit', (code) => code && console.error(logs.slice(-4000)));
  await waitForHealth();
});

after(() => server?.kill());

describe('lending lifecycle', () => {
  const s = {};

  test('staff sign in; bad passwords are rejected', async () => {
    const bad = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'officer@demo.zm', password: 'wrong-password' }),
    });
    assert.equal(bad.status, 401);
    s.officer = await as('officer@demo.zm');
    s.officer2 = await as('officer.copperbelt@demo.zm');
    s.manager = await as('manager@demo.zm');
    s.accountant = await as('accountant@demo.zm');
    s.cashier = await as('cashier@demo.zm');
    s.platform = await as('platform@anzelu.io');
    const me = await s.officer.get('/auth/me');
    assert.equal(me.data.role, 'credit_officer');
  });

  test('unauthenticated requests are refused', async () => {
    const r = await fetch(`${BASE}/api/v1/loans`);
    assert.equal(r.status, 401);
  });

  test('officer registers a customer with KYC documents; manager verifies', async () => {
    const branches = await s.officer.get('/branches');
    const lusaka = branches.data.find((b) => b.code === 'LSK');
    const customer = {
      branchId: lusaka.id,
      firstName: 'Test',
      lastName: 'Borrower',
      nrc: '555555/55/1',
      phone: '0977000111',
      dateOfBirth: '1988-04-12',
      gender: 'female',
      address: 'Plot 1, Rhodes Park, Lusaka',
      employer: 'Ministry of Finance',
      monthlyIncome: '15000',
      consent: true,
    };
    const c = await s.officer.post('/customers', customer);
    assert.equal(c.status, 201, JSON.stringify(c.error));
    s.customerId = c.data.id;

    const dup = await s.officer.post('/customers', { ...customer, phone: '0977000999' });
    assert.equal(dup.status, 409, 'duplicate NRC is blocked');

    const early = await s.manager.post(`/customers/${s.customerId}/kyc`, { status: 'verified' });
    assert.equal(early.status, 422, 'KYC cannot be verified without documents');

    const form = new FormData();
    form.set('docType', 'nrc');
    form.set('file', new Blob([Buffer.from('%PDF-1.4\n%%EOF')], { type: 'application/pdf' }), 'nrc.pdf');
    const up = await s.officer.post(`/customers/${s.customerId}/documents`, form);
    assert.equal(up.status, 201, JSON.stringify(up.error));

    const kyc = await s.manager.post(`/customers/${s.customerId}/kyc`, { status: 'verified', note: 'Original sighted' });
    assert.equal(kyc.status, 201);
  });

  test('branch scoping hides other branches’ customers', async () => {
    const r = await s.officer2.get(`/customers/${s.customerId}`);
    assert.equal(r.status, 404);
  });

  test('application is assessed; maker cannot approve; manager approves', async () => {
    const products = await s.officer.get('/loan-products?active=true');
    const sal = products.data.find((p) => p.code === 'SAL');
    const app = await s.officer.post('/applications', {
      customerId: s.customerId,
      productId: sal.id,
      amount: '12000',
      term: 12,
      purpose: 'School fees',
      monthlyIncome: '15000',
      monthlyExpenses: '5000',
      existingDebtRepayments: '0',
    });
    assert.equal(app.status, 201, JSON.stringify(app.error));
    assert.equal(app.data.assessment.installmentAmount, '1300.00'); // 12,000 at 30% flat over 12 months
    assert.ok(app.data.assessment.checks.every((c) => !c.hard || c.passed));
    s.applicationId = app.data.id;

    const own = await s.officer.post(`/applications/${s.applicationId}/decisions`, { decision: 'approve', reason: 'self' });
    assert.equal(own.status, 403, 'credit officers cannot decide');

    const ok = await s.manager.post(`/applications/${s.applicationId}/decisions`, { decision: 'approve', reason: 'Affordable, verified employer' });
    assert.equal(ok.status, 201, JSON.stringify(ok.error));
    s.loanId = ok.data.loanId;
    assert.ok(s.loanId);
  });

  test('disbursement needs a separate authoriser and posts a balanced journal', async () => {
    const req = await s.officer.post(`/loans/${s.loanId}/disbursements`, { channel: 'mtn_momo', destination: '0977000111' });
    assert.equal(req.status, 201, JSON.stringify(req.error));
    assert.equal(req.data.netAmount, '11640.00'); // 3% processing fee deducted

    const mgr = await s.manager.post(`/loans/${s.loanId}/disbursements/decision`, { decision: 'authorise' });
    assert.equal(mgr.status, 403, 'approver lacks the authorise permission');

    const acc = await s.accountant.post(`/loans/${s.loanId}/disbursements/decision`, { decision: 'authorise' });
    assert.equal(acc.status, 201, JSON.stringify(acc.error));

    const loan = await s.manager.get(`/loans/${s.loanId}`);
    assert.equal(loan.data.status, 'active');
    assert.equal(loan.data.schedule.length, 12);
    assert.equal(loan.data.position.principalOutstanding, '12000.00');
    assert.equal(loan.data.position.totalOutstanding, '15600.00');
  });

  test('repayments are idempotent and allocated interest-first', async () => {
    const body = { loanId: s.loanId, amount: '1300', channel: 'cash', idempotencyKey: 'e2e-payment-0001' };
    const first = await s.cashier.post('/payments', body);
    assert.equal(first.status, 201, JSON.stringify(first.error));
    assert.equal(first.data.duplicate, false);
    const again = await s.cashier.post('/payments', body);
    assert.equal(again.data.duplicate, true);
    assert.equal(again.data.receiptNumber, first.data.receiptNumber);
    s.paymentId = first.data.id;

    const loan = await s.manager.get(`/loans/${s.loanId}`);
    assert.equal(loan.data.position.totalOutstanding, '14300.00');
    assert.equal(loan.data.payments.filter((p) => p.status === 'posted').length, 1);
    const receipt = await s.cashier.get(`/payments/${s.paymentId}`);
    const interest = receipt.data.allocations.find((a) => a.component === 'interest');
    assert.equal(interest.amount, '300.00');
  });

  test('ledger stays balanced', async () => {
    const tb = await s.accountant.get('/accounting/trial-balance');
    assert.equal(tb.status, 200);
    assert.equal(tb.data.totals.balanced, true, JSON.stringify(tb.data.totals));
  });

  test('reversal requires a different approver and restores balances', async () => {
    const req = await s.cashier.post(`/payments/${s.paymentId}/reversals`, { reason: 'Receipted to the wrong account' });
    assert.equal(req.status, 201, JSON.stringify(req.error));
    const self = await s.cashier.post(`/reversals/${req.data.id}/decision`, { decision: 'approve' });
    assert.equal(self.status, 403);
    const ok = await s.accountant.post(`/reversals/${req.data.id}/decision`, { decision: 'approve' });
    assert.equal(ok.status, 201, JSON.stringify(ok.error));

    const loan = await s.manager.get(`/loans/${s.loanId}`);
    assert.equal(loan.data.position.totalOutstanding, '15600.00');
    const tb = await s.accountant.get('/accounting/trial-balance');
    assert.equal(tb.data.totals.balanced, true);
  });

  test('mobile-money callbacks are signature-checked and deduplicated', async () => {
    const loan = await s.manager.get(`/loans/${s.loanId}`);
    const payload = JSON.stringify({ transactionId: 'MP261024.0001', accountReference: loan.data.loanNumber, amount: '500.00', msisdn: '260977000111' });
    const sign = (b) => createHmac('sha256', WEBHOOK_SECRET).update(b).digest('hex');
    const send = (body, signature) =>
      fetch(`${BASE}/api/v1/integrations/mtn_momo/callback/DEMO`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': signature }, body });

    const forged = await send(payload, 'a'.repeat(64));
    assert.equal(forged.status, 403);
    const first = await (await send(payload, sign(payload))).json();
    assert.equal(first.data.status, 'processed');
    const retry = await (await send(payload, sign(payload))).json();
    assert.equal(retry.data.status, 'duplicate');
    assert.equal(retry.data.receiptNumber, first.data.receiptNumber);
  });

  test('tenant isolation: platform admins cannot read institution data', async () => {
    const r = await s.platform.get('/customers');
    assert.equal(r.status, 403);
    const tenants = await s.platform.get('/admin/tenants');
    assert.equal(tenants.status, 200);
    assert.ok(tenants.data.some((t) => t.code === 'DEMO'));
  });

  test('end-of-day job, reports and the audit chain', async () => {
    const eod = await s.accountant.post('/jobs/end-of-day');
    assert.equal(eod.status, 200, JSON.stringify(eod.error));
    const dash = await s.manager.get('/reports/dashboard');
    assert.equal(dash.status, 200);
    assert.ok(Number(dash.data.kpis.outstandingPrincipal) > 0);
    const tb = await s.accountant.get('/accounting/trial-balance');
    assert.equal(tb.data.totals.balanced, true);
    const auditor = await as('auditor@demo.zm');
    const chain = await auditor.get('/audit/verify');
    assert.equal(chain.data.valid, true, JSON.stringify(chain.data));
    assert.ok(chain.data.checked > 100);
  });
});
