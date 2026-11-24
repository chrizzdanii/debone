'use strict';
// Regression tests for the installment engine in server/server.js (schedule maths, offers, and the late-payment ladder).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../server/server.js'), 'utf8');
const start = source.indexOf('const INSTALLMENT_SPLITS');
const end = source.indexOf('// Resources are typed as one per line', start);
assert.ok(start > 0 && end > start);
const DAY = 86400000;
function sandbox(settings, courses, plans) {
  const ctx = { db: { sessions: [], plans: plans || [], orders: [], users: [] }, Date, Math, Intl, Number, String, Array, Object, Promise, console,
    dayKey: d => new Date(d).toISOString().slice(0, 10), cfg: k => Number(settings[k]), cfgBool: k => !!settings[k], uid: () => 'x', now: () => new Date().toISOString(),
    notify() {}, sendEmail: () => Promise.resolve(), htmlEsc: s => s, httpError: (s, m) => Object.assign(new Error(m), { status: s }), PUBLIC_URL: 'http://x', save() {}, sendEvent() {} };
  vm.createContext(ctx); vm.runInContext(source.slice(start, end) + '\nthis.dayDiff = dayDiff;', ctx);
  return ctx;
}
const S = { installmentsOn: true, installmentMinPrice: 30000, installmentIntervalDays: 14, installmentGraceDays: 3, installmentDefaultDays: 14 };
const iso = ms => new Date(ms).toISOString().slice(0, 10);

// 1. Splits always add up to the total and never produce a zero or negative payment
{
  const c = sandbox(S);
  for (const total of [30000, 45500, 50000, 99999, 150000]) for (const n of [2, 3]) {
    const sch = c.buildSchedule(total, n, 14);
    assert.equal(sch.reduce((t, s) => t + s.amountNaira, 0), total, `split of ${total} into ${n}`);
    assert.ok(sch.every(s => s.amountNaira > 0));
    assert.ok(sch[0].amountNaira >= sch[sch.length - 1].amountNaira, 'first payment is the biggest');
  }
  assert.deepEqual(Array.from(c.buildSchedule(100000, 2, 14), s => s.amountNaira), [60000, 40000]);
  assert.deepEqual(Array.from(c.buildSchedule(100000, 3, 14), s => s.amountNaira), [50000, 30000, 20000]);
}
// 2. Offers: minimum price, global switch, per-course switch
{
  const c = sandbox(S);
  assert.equal(c.installmentOffer([{ id: 'a' }], 29999).length, 0, 'below minimum price');
  assert.equal(c.installmentOffer([{ id: 'a' }], 50000).length, 2, 'both plans offered');
  assert.deepEqual(Array.from(c.installmentOffer([{ id: 'a', installmentPlans: [3] }], 50000), o => o.count), [3]);
  assert.equal(c.installmentOffer([{ id: 'a', installmentPlans: [] }], 50000).length, 0, 'course set to pay-once only');
  assert.equal(sandbox(Object.assign({}, S, { installmentsOn: false })).installmentOffer([{ id: 'a' }], 50000).length, 0, 'switched off');
}
// 3. Every payment falls due before the course ends; short courses squeeze the gaps; too-late enrolment gets no plan
{
  const c = sandbox(S);
  const course = days => ({ id: 'a', startDate: iso(Date.now() + days * DAY), duration: '2 weeks' });
  const offer = c.installmentOffer([course(10)], 60000);               // ends in 24 days, last payment due by day 21
  assert.equal(offer.length, 2);
  for (const o of offer) assert.ok(c.dayDiff(iso(Date.now()), o.schedule[o.count - 1].dueOn) <= 21, 'last payment due before the end');
  assert.equal(c.installmentOffer([course(-12)], 60000).length, 0, 'course almost over: pay in full only');
  assert.equal(c.parseDurationDays('6 weeks'), 42); assert.equal(c.parseDurationDays('1 month'), 30); assert.equal(c.parseDurationDays('10 days'), 10); assert.equal(c.parseDurationDays('soon'), 0);
}
// 4. The late-payment ladder
{
  const c = sandbox(S);
  const plan = lateDays => ({ id: 'p', userId: 'u', status: 'active', courseIds: ['a'], title: 'T', schedule: [{ no: 1, amountNaira: 1, status: 'paid' }, { no: 2, amountNaira: 1, status: 'pending', dueOn: iso(Date.now() - lateDays * DAY) }] });
  const health = d => c.planState(plan(d)).health;
  assert.equal(health(-10), 'on_track'); assert.equal(health(-3), 'due_soon'); assert.equal(health(0), 'due_soon');
  assert.equal(health(1), 'overdue'); assert.equal(health(3), 'overdue', 'still open on the last grace day');
  assert.equal(health(4), 'paused'); assert.equal(health(14), 'paused'); assert.equal(health(15), 'defaulted');
  assert.equal(c.planState(plan(4)).blocked, true); assert.equal(c.planState(plan(3)).blocked, false);
  const held = plan(30); held.refundPending = true; assert.equal(c.planState(held).blocked, false, 'no pausing while a refund is under review');
  const done = plan(30); done.schedule.forEach(s => { s.status = 'paid'; }); done.status = 'completed'; assert.equal(c.planState(done).blocked, false);
  c.db.plans = [plan(4)]; assert.equal(c.planBlocks('u', 'a'), true); assert.equal(c.planBlocks('u', 'other'), false); assert.equal(c.planBlocks('someone', 'a'), false);
  assert.equal(c.planOwing('u', 'a'), true);
}
// 5. Reminders go out once per step, and only the newest step is sent
{
  const sent = []; const c = sandbox(S);
  c.notify = (u, title) => sent.push(title);
  const p = { id: 'p', userId: 'u', status: 'active', courseIds: ['a'], title: 'T', schedule: [{ no: 1, amountNaira: 1, status: 'paid' }, { no: 2, amountNaira: 5000, status: 'pending', dueOn: iso(Date.now() - 6 * DAY) }] };
  c.db.plans = [p]; c.db.users = [{ id: 'u', name: 'Ada Eze', email: 'a@x.com' }];
  c.runInstallmentChecks(); c.runInstallmentChecks();
  assert.equal(sent.length, 1, 'one message even after two sweeps, not one per missed step'); assert.match(sent[0], /paused/i);
}
console.log('installment engine tests passed');
