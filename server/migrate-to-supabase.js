'use strict';
/* Copies an existing server/data/db.json (from the old file-based version) into Supabase.
 * Only needed if the site already has real students, orders or payments.
 * Run once from your computer, with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env:
 *   npm run migrate -- path/to/db.json
 */
const fs = require('fs');
const path = require('path');
(function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();
const { createStore, SUPABASE } = require('./store');
(async () => {
  if (!SUPABASE) { console.log('Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to server/.env first.'); process.exit(1); }
  const file = process.argv[2] || path.join(__dirname, 'data', 'db.json');
  if (!fs.existsSync(file)) { console.log('Cannot find ' + file); process.exit(1); }
  const old = JSON.parse(fs.readFileSync(file, 'utf8'));
  const store = createStore(() => ({}));
  const db = await store.load();
  const existing = Object.keys(db).filter(k => Array.isArray(db[k]) && db[k].length);
  if (existing.length && !process.argv.includes('--force')) {
    console.log('Supabase already has data (' + existing.join(', ') + '). Add --force to merge the old file over it.');
    process.exit(1);
  }
  Object.assign(db, old);
  await store.flush(db);
  console.log('Done. Copied ' + Object.keys(old).length + ' collections into Supabase.');
  const proofs = path.join(path.dirname(file), 'proofs');
  if (fs.existsSync(proofs)) {
    for (const n of fs.readdirSync(proofs)) {
      const ext = path.extname(n).slice(1);
      const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' }[ext] || 'application/octet-stream';
      await store.putFile('proofs/' + n, fs.readFileSync(path.join(proofs, n)), mime);
    }
    console.log('Payment receipts copied too.');
  }
})().catch(e => { console.error(e.message); process.exit(1); });
