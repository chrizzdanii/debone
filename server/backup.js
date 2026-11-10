/* Saves a copy of the database to server/data/backups and keeps the newest 30 copies.
 * Run with:  npm run backup   (copy the backups folder off the server regularly) */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'data');
const src = path.join(dir, 'db.json');
if (!fs.existsSync(src)) { console.log('No database yet, so there is nothing to back up.'); process.exit(0); }
const bdir = path.join(dir, 'backups');
fs.mkdirSync(bdir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(src, path.join(bdir, `db-${stamp}.json`));
const files = fs.readdirSync(bdir).filter(f => f.startsWith('db-')).sort();
files.slice(0, -30).forEach(f => fs.unlinkSync(path.join(bdir, f)));
console.log(`Backup saved to server/data/backups (${Math.min(files.length, 30)} kept).`);
