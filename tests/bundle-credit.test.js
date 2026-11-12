'use strict';
// Isolated regression tests for the exact bundle-credit implementation in server/server.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../server/server.js'), 'utf8');
const start = source.indexOf('function bundleCredit(userId, b) {');
const end = source.indexOf("route('GET', '/api/bundles'", start);
assert.ok(start > 0 && end > start);
const body = source.slice(start, end);
function credit(enrolled, payments, refunds, price = 150000) {
 const ctx = {db: {payments, refunds}, enrollmentFor: (userId, courseId) => enrolled.includes(courseId)};
 vm.createContext(ctx);
 vm.runInContext(body + '\nresult = bundleCredit("student1", {courseIds:["c1","c2"], price:' + price + '});', ctx);
 return JSON.parse(JSON.stringify(ctx.result));
}
const pay = (cid, amount, status='success', ref=cid) => ({userId:'student1',kind:'course',courseId:cid,status,amountKobo:amount*100,reference:ref});
assert.equal(credit([], [], []).remaining, 150000, 'No course owned');
assert.equal(credit(['c1'], [pay('c1',30000)], []).remaining, 120000, 'Previously paid course');
assert.equal(credit(['c1','c2'], [pay('c1',30000),pay('c2',50000)], []).remaining, 70000, 'Two previously paid courses');
assert.equal(credit(['c1','c2'], [pay('c1',30000),pay('c2',150000)], []).remaining, 0, 'Credit capped at bundle price');
assert.equal(credit(['c1'], [pay('c1',30000,'pending')], []).remaining, 150000, 'Pending payment excluded');
assert.equal(credit(['c1'], [pay('c1',30000)], [{paymentReference:'c1',status:'paid'}]).remaining, 150000, 'Refunded payment excluded');
assert.equal(credit(['c1'], [pay('c1',30000)], [{paymentReference:'c1',status:'approved'}]).remaining, 150000, 'Approved refund excluded');
assert.equal(credit(['c1'], [pay('c1',30000)], [{paymentReference:'c1',status:'declined'}]).remaining, 120000, 'Declined refund does not remove credit');
assert.equal(credit(['c1'], [pay('c1',30000),pay('c1',30000,'success','second')], []).remaining, 120000, 'Repeated payment not double counted');
assert.equal(credit(['c1'], [pay('c1',30000,'success','c1'),pay('c2',90000,'success','c2')], []).remaining, 120000, 'Unowned course payment excluded');
console.log('10 bundle credit regression tests passed');
