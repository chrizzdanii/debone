'use strict';
/*
 * Guards the guide so that "nothing is missing" stays true.
 * If someone adds a menu item to the student dashboard or the admin panel and forgets to explain it,
 * this test fails and says exactly which one.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const guide = require('../server/guide.js');

const ROOT = path.join(__dirname, '..');
const html = f => fs.readFileSync(path.join(ROOT, 'server', 'private', f), 'utf8');
const menu = f => [...html(f).matchAll(/data-view="([^"]+)"/g)].map(m => m[1]);
const adminOnly = () => new Set([...html('admin.html').matchAll(/<a href="#([\w-]+)" data-view="[^"]+" class="admin-only"/g)].map(m => m[1]));
const DEFAULTS = {
  replayDays: 14, downloadLimit: 3, downloadDays: 365, depositPercent: 50, referralDiscountPercent: 10, referrerRewardPercent: 10,
  withdrawMinReferrals: 5, noticeDays: 7, refundWindowDays: 7, certMinPercent: 50, installmentMinPrice: 30000,
  installmentGraceDays: 3, installmentDefaultDays: 14, installmentIntervalDays: 14
};

test('every student dashboard menu item is explained in the student guide', () => {
  const have = new Set(guide.load().student.sections.map(s => s.view).filter(Boolean));
  const missing = menu('dashboard.html').filter(v => !have.has(v));
  assert.deepStrictEqual(missing, [], 'Missing from the student guide: ' + missing.join(', '));
});

test('every admin menu item is explained in the staff guide, with the right admin-only flag', () => {
  const secs = guide.load().staff.sections;
  const have = new Set(secs.map(s => s.view).filter(Boolean));
  const missing = menu('admin.html').filter(v => !have.has(v));
  assert.deepStrictEqual(missing, [], 'Missing from the staff guide: ' + missing.join(', '));
  const ao = adminOnly();
  const wrong = secs.filter(s => s.view && ao.has(s.view) !== !!s.adminOnly).map(s => s.view);
  assert.deepStrictEqual(wrong, [], 'Wrong adminOnly flag for: ' + wrong.join(', '));
});

test('instructors only get the guide sections for pages they can open', () => {
  const c = guide.content('staff', DEFAULTS, false);
  assert.ok(c.sections.length > 0 && c.sections.every(s => !s.adminOnly));
  const a = guide.content('staff', DEFAULTS, true);
  assert.ok(a.sections.length > c.sections.length);
});

test('every {{token}} in the guide is a real setting and gets filled in', () => {
  const all = guide.load(), used = new Set();
  Object.keys(all).forEach(k => guide.tokensIn(all[k], used));
  const unknown = [...used].filter(k => !(k in DEFAULTS));
  assert.deepStrictEqual(unknown, [], 'Unknown tokens: ' + unknown.join(', '));
  const text = JSON.stringify(guide.content('staff', DEFAULTS, true)) + JSON.stringify(guide.content('student', DEFAULTS, false));
  assert.ok(!/\{\{/.test(text), 'A token was left unfilled');
});

test('every section has what, steps and a plain summary; ids are unique', () => {
  const all = guide.load();
  for (const a of ['student', 'staff']) {
    const ids = new Set();
    for (const s of all[a].sections) {
      assert.ok(!ids.has(s.id), 'Duplicate id ' + s.id); ids.add(s.id);
      assert.ok(s.title && s.summary && s.what && s.steps && s.steps.length >= 2, 'Section too thin: ' + s.id);
    }
  }
});

test('the PDF is a real PDF for students, instructors and admins', async () => {
  for (const [aud, adm] of [['student', false], ['staff', false], ['staff', true]]) {
    const buf = await guide.pdf(aud, Object.assign({ phone1: '0800 000 0000' }, DEFAULTS), adm);
    assert.strictEqual(buf.slice(0, 5).toString(), '%PDF-');
    assert.ok(buf.length > 15000);
  }
});
