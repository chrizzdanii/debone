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
// 6. Due dates follow the live classes (weeks of training), not the checkout date
{
  const c = sandbox(S);
  const today = iso(Date.now());
  const at = (days, extra) => Object.assign({ id: 'a', startDate: iso(Date.now() + days * DAY), duration: '8 weeks' }, extra);
  const due = (o, n) => o.schedule.map(s => s.dueOn);
  // Student buys 10 days before an 8-week course starts (weekly classes on start + 0, 7, ... 49)
  const pre = c.installmentOffer([at(10)], 100000);
  const p2 = pre.find(o => o.count === 2), p3 = pre.find(o => o.count === 3);
  assert.equal(p2.schedule[0].dueOn, today);
  assert.equal(p2.schedule[1].dueOn, iso(Date.now() + (10 + 4 * 7 - 1) * DAY), '60/40: due the day before class 5 (after 4 of 8 classes)');
  assert.match(p2.schedule[1].note, /Before live class 5 of 8/);
  assert.deepEqual(Array.from(p3.schedule, s => s.dueOn), [today, iso(Date.now() + (10 + 4 * 7 - 1) * DAY), iso(Date.now() + (10 + 6 * 7 - 1) * DAY)], '50/30/20: before classes 5 and 7');
  // Last payment is always at least 3 days before the course ends
  const end = Date.now() + (10 + 56) * DAY;
  for (const o of pre) assert.ok(c.dayDiff(o.schedule[o.count - 1].dueOn, iso(end)) >= 3);
  // Late joiner: the course started 3 weeks ago, so only the classes still ahead are used
  const late = c.installmentOffer([at(-21)], 100000);
  const l2 = late.find(o => o.count === 2);
  assert.ok(l2, 'late joiner still gets a plan');
  const firstAhead = Date.now() + (-21 + 21 + 7) * DAY;   // class 4 (index 3) is the first one in the future
  assert.ok(c.dayDiff(today, l2.schedule[1].dueOn) >= 5 && c.dayDiff(l2.schedule[1].dueOn, iso(end - 3 * DAY)) >= 0, 'compressed into the weeks that remain');
  assert.ok(l2.schedule[1].dueOn > iso(firstAhead - DAY * 2), 'not due before the first class still ahead');
  // Real scheduled sessions beat the calendar: the 2nd payment is due the day before the matching live class
  const c2 = sandbox(S);
  const day = n => new Date(Date.now() + n * DAY).toISOString();
  c2.db.sessions = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30].map(n => ({ courseId: 'r', startsAt: day(n) }));
  const real = c2.installmentOffer([{ id: 'r' }], 100000).find(o => o.count === 2);
  assert.equal(real.schedule[1].dueOn, iso(Date.now() + (3 + 6 * 3 - 1) * DAY), '60% of 10 classes = 6 done, due before class 7');
  assert.match(real.schedule[1].note, /class 7 of 10/);
  // Too late for a plan: one class left
  assert.equal(c.installmentOffer([at(-49)], 100000).length, 0);
  // Bundle: dates land on the class days of all its courses, notes name the date only
  c2.db.sessions.push(...[5, 10, 20, 40].map(n => ({ courseId: 'r2', startsAt: day(n) })));
  const b = c2.installmentOffer([{ id: 'r' }, { id: 'r2' }], 100000);
  assert.ok(b.length >= 1 && b[0].schedule[1].note.startsWith('Before your live class on'));
}
console.log('installment engine tests passed');
