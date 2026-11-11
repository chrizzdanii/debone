'use strict';
/*
 * Storage layer for DEBONE.
 *  - Supabase mode (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set): data lives in the `docs` table, files in a Storage bucket.
 *  - File mode (no Supabase keys): data lives in server/data/db.json, files in server/data/. Used for local testing.
 *
 * The server keeps the whole database in memory as one object (`db`). This module loads it, pulls in changes made by
 * other server instances, and saves only the records that changed. No npm packages are needed.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'debone';
const SUPABASE = !!(URL_BASE && KEY);

/* ---------- Turn the db object into records, and back ---------- */
const isRecordArray = v => Array.isArray(v) && v.every(x => x && typeof x === 'object' && !Array.isArray(x) && (typeof x.id === 'string' || typeof x.id === 'number'))
  && new Set(v.map(x => String(x.id))).size === v.length && v.every(x => !String(x.id).startsWith('__'));

function recordsOf(db) {
  const out = new Map();
  for (const [coll, v] of Object.entries(db)) {
    if (v === undefined) continue;
    if (isRecordArray(v)) {
      out.set(coll + '\u0000__arr__', { coll, id: '__arr__', json: 'true' });
      for (const item of v) out.set(coll + '\u0000' + String(item.id), { coll, id: String(item.id), json: JSON.stringify(item) });
    } else {
      out.set(coll + '\u0000__all__', { coll, id: '__all__', json: JSON.stringify(v === undefined ? null : v) });
    }
  }
  return out;
}

/* ---------- Supabase helpers ---------- */
async function sb(method, pathAndQuery, { body, headers, raw } = {}) {
  const res = await fetch(URL_BASE + pathAndQuery, {
    method,
    headers: Object.assign(KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: 'Bearer ' + KEY }, headers || {}),
    body,
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Supabase ${method} ${pathAndQuery.split('?')[0]} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  if (raw) return res;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ---------- The store ---------- */
function createStore(defaultDb) {
  const snapshot = new Map();   // record key -> JSON as last loaded or saved
  let since = '1970-01-01T00:00:00Z';   // newest updated_at seen in Supabase
  let lastSync = 0;
  let dbMtime = 0;
  let flushing = Promise.resolve();

  function applyRow(db, row) {
    const { coll, id } = row;
    if (id === '__arr__') {
      if (!Array.isArray(db[coll])) db[coll] = [];
      snapshot.set(coll + '\u0000__arr__', 'true');
      return;
    }
    if (id === '__all__') {
      const key = coll + '\u0000__all__';
      const cur = db[coll] === undefined ? undefined : JSON.stringify(db[coll]);
      if (row.deleted) { delete db[coll]; snapshot.delete(key); return; }
      if (cur !== undefined && snapshot.has(key) && cur !== snapshot.get(key)) return;   // unsaved local change wins
      db[coll] = row.data;
      snapshot.set(key, JSON.stringify(row.data));
      return;
    }
    if (!Array.isArray(db[coll])) db[coll] = [];
    const arr = db[coll];
    const key = coll + '\u0000' + id;
    const idx = arr.findIndex(x => String(x.id) === id);
    if (row.deleted) {
      if (idx >= 0 && JSON.stringify(arr[idx]) === snapshot.get(key)) arr.splice(idx, 1);
      snapshot.delete(key);
      return;
    }
    if (idx < 0) {
      arr.push(row.data);
    } else {
      const cur = JSON.stringify(arr[idx]);
      if (snapshot.has(key) && cur !== snapshot.get(key)) return;   // unsaved local change wins
      const target = arr[idx];
      for (const k of Object.keys(target)) delete target[k];   // keep the same object, other code may hold it
      Object.assign(target, row.data);
    }
    const now = idx < 0 ? row.data : arr[idx];
    snapshot.set(key, JSON.stringify(now));
  }

  function noteSince(rows) {
    for (const r of rows) if (r.updated_at && r.updated_at > since) since = r.updated_at;
  }

  async function fetchRows(query) {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await sb('GET', `/rest/v1/docs?select=coll,id,data,deleted,updated_at&${query}&order=seq.asc&limit=1000&offset=${offset}`);
      rows.push(...page);
      if (page.length < 1000) break;
    }
    return rows;
  }

  return {
    mode: SUPABASE ? 'supabase' : 'file',

    /* Load the full database */
    async load() {
      snapshot.clear();
      const db = defaultDb();
      if (!SUPABASE) {
        if (fs.existsSync(DB_FILE)) Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
        try { dbMtime = fs.statSync(DB_FILE).mtimeMs; } catch (e) { /* first run */ }
        return db;
      }
      const rows = await fetchRows('deleted=eq.false');
      noteSince(rows);
      // Collections that exist in Supabase start empty so that "missing" and "empty" can be told apart
      for (const r of rows) if (r.id === '__arr__') db[r.coll] = [];
      for (const r of rows) applyRow(db, r);
      lastSync = Date.now();
      return db;
    },

    /* Pull in changes made by other server instances. Returns a new object only in file mode. */
    async refresh(db, force) {
      if (!SUPABASE) {
        try {
          const m = fs.statSync(DB_FILE).mtimeMs;
          if (m !== dbMtime) { dbMtime = m; return Object.assign(defaultDb(), JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); }
        } catch (e) { /* ignore */ }
        return db;
      }
      // Always check: a person who just signed up may land on a different server instance for their next request
      const from = new Date(Date.parse(since) - 3000).toISOString();
      const rows = await fetchRows('updated_at=gte.' + encodeURIComponent(from));
      noteSince(rows);
      for (const r of rows) applyRow(db, r);
      lastSync = Date.now();
      return db;
    },

    /* A short string that changes whenever the data changes (here or on another server instance) */
    rev() { return SUPABASE ? since : String(dbMtime); },

    /* Save everything that changed since the last save */
    flush(db, opts) {
      const run = async () => {
        const skip = (opts && opts.skipColls) || [];
        const current = recordsOf(db);
        const changed = [];
        for (const [key, rec] of current) {
          if (skip.includes(rec.coll)) continue;
          if (snapshot.get(key) !== rec.json) changed.push([key, rec]);
        }
        const removed = [];
        for (const key of snapshot.keys()) {
          const coll = key.split('\u0000')[0];
          if (!current.has(key) && !skip.includes(coll)) removed.push(key);
        }
        if (!changed.length && !removed.length) return;
        if (!SUPABASE) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
          const tmp = DB_FILE + '.tmp';
          fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
          fs.renameSync(tmp, DB_FILE);
          try { dbMtime = fs.statSync(DB_FILE).mtimeMs; } catch (e) { /* ignore */ }
          for (const [key, rec] of changed) snapshot.set(key, rec.json);
          for (const key of removed) snapshot.delete(key);
          return;
        }
        const rows = changed.map(([, rec]) => ({ coll: rec.coll, id: rec.id, data: JSON.parse(rec.json), deleted: false }));
        for (const key of removed) {
          const [coll, id] = key.split('\u0000');
          rows.push({ coll, id, data: null, deleted: true });
        }
        // Send in chunks of about 1.5 MB
        let chunk = [], size = 0;
        const send = async () => {
          if (!chunk.length) return;
          await sb('POST', '/rest/v1/docs?on_conflict=coll,id', {
            body: JSON.stringify(chunk),
            headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
          });
          chunk = []; size = 0;
        };
        for (const row of rows) {
          const n = JSON.stringify(row).length;
          if (size + n > 1.5 * 1024 * 1024) await send();
          chunk.push(row); size += n;
        }
        await send();
        for (const [key, rec] of changed) snapshot.set(key, rec.json);
        for (const key of removed) snapshot.delete(key);
      };
      // Saves run one after another so two requests never write at the same moment
      const p = flushing.then(run, run);
      flushing = p.catch(() => {});
      return p;
    },

    /* ---------- Files (payment receipts, backups) ---------- */
    async putFile(name, buf, mime) {
      if (!SUPABASE) {
        const f = path.join(DATA_DIR, name);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, buf);
        return;
      }
      await sb('POST', `/storage/v1/object/${BUCKET}/${name}`, { body: buf, headers: { 'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' } });
    },
    async getFile(name) {
      if (!SUPABASE) {
        const f = path.join(DATA_DIR, name);
        return fs.existsSync(f) ? fs.readFileSync(f) : null;
      }
      try {
        const res = await sb('GET', `/storage/v1/object/${BUCKET}/${name}`, { raw: true });
        return Buffer.from(await res.arrayBuffer());
      } catch (e) {
        if (e.status === 400 || e.status === 404) return null;
        throw e;
      }
    },
    /* Newest file names under a prefix, e.g. 'backups/' */
    async listFiles(prefix) {
      if (!SUPABASE) {
        const d = path.join(DATA_DIR, prefix);
        if (!fs.existsSync(d)) return [];
        return fs.readdirSync(d).map(n => ({ name: n, at: fs.statSync(path.join(d, n)).mtime.toISOString() })).sort((a, b) => b.at.localeCompare(a.at));
      }
      const list = await sb('POST', `/storage/v1/object/list/${BUCKET}`, {
        body: JSON.stringify({ prefix: prefix.replace(/\/$/, ''), limit: 100, sortBy: { column: 'created_at', order: 'desc' } }),
        headers: { 'Content-Type': 'application/json' }
      });
      return (list || []).filter(x => x.name && x.id).map(x => ({ name: x.name, at: x.created_at || x.updated_at }));
    },
    async deleteFiles(names) {
      if (!names.length) return;
      if (!SUPABASE) { names.forEach(n => { try { fs.unlinkSync(path.join(DATA_DIR, n)); } catch (e) { /* ignore */ } }); return; }
      await sb('DELETE', `/storage/v1/object/${BUCKET}`, { body: JSON.stringify({ prefixes: names }), headers: { 'Content-Type': 'application/json' } });
    }
  };
}

module.exports = { createStore, SUPABASE, DATA_DIR };
