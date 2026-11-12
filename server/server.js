'use strict';
/*
 * DEBONE server: website, shop, academy, live classes, chat, assignments and admin.
 * No npm dependencies. Runs on Node 18+.
 *
 * Make an admin:      node server/server.js --make-admin you@example.com
 * Or set ADMIN_EMAILS in server/.env (comma separated); those accounts become admins on login.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PRIVATE_DIR = path.join(__dirname, 'private');
const { createStore, SUPABASE, DATA_DIR } = require('./store');
const SECRET_FILE = path.join(DATA_DIR, 'session.secret');
const ON_VERCEL = !!process.env.VERCEL;
const COURSES_FILE = path.join(__dirname, 'courses.json');
const SITE_TZ = process.env.SITE_TZ || 'Africa/Lagos';   // lessons open on the calendar day of their class, in this time zone
const QR_PERCENT = Number(process.env.QR_DISCOUNT_PERCENT) || 15;   // discount for people who register by scanning an advert's QR code
const QR_DAYS = Number(process.env.QR_DISCOUNT_DAYS) || 7;          // how long the discount stays available after they register
// "2026-11-19" for a moment in time, as a calendar day in the school's time zone
const dayKey = d => new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));

/* ---------- Config ---------- */
(function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const R2_BUCKET = process.env.R2_BUCKET || '';
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const r2Ready = () => !!(R2_BUCKET && R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
let r2Client;
function r2() {
  if (!r2Ready()) throw httpError(503, 'Private recording storage is not configured. Contact the administrator.');
  if (!r2Client) r2Client = new S3Client({ region: 'auto', forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
  return r2Client;
}
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = (process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').replace(/\/$/, '');
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || /^https:\/\//.test(PUBLIC_URL);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  // On Vercel nothing can be saved to disk, so a missing secret is derived from the Supabase key (stable across restarts)
  if (SUPABASE) return crypto.createHash('sha256').update('debone-session:' + process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 });
  return s;
})();

/* ---------- Database (JSON file, written atomically) ---------- */
const DB_DEFAULT = () => ({
  users: [], enrollments: [], progress: [], payments: [],
  courses: null, announcements: [],
  sessions: [], chat: [], assignments: [], submissions: [], passwordResets: [], newsletter: [], feedback: [], applications: [], webinars: [], webinarRegistrations: [], reviews: [], certificates: [], digitalProducts: [], purchases: [], bundles: [], threads: [], replies: [], portfolios: [], challenges: [], challengeEntries: [], bookings: [], refunds: [], scheduleNotices: [], pageViews: {}, referralEvents: [], withdrawals: [], certRequests: [], attendance: [], notes: [], orders: [], communityMsgs: [], waitlist: [], communityMigrated: false, qrStats: {}
});
const store = createStore(DB_DEFAULT);
let db = DB_DEFAULT();
// Every change is saved before the response is sent (see the request handler), so save() only needs to mark the data as changed
function save() { /* changes are written by store.flush() at the end of the request */ }

const seed = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));
const CURRENCY = seed.currency || 'NGN';
const productSeed = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));
const worksSeed = JSON.parse(fs.readFileSync(path.join(__dirname, 'works.json'), 'utf8'));
const servicesSeed = JSON.parse(fs.readFileSync(path.join(__dirname, 'services.json'), 'utf8'));
const seedTime = new Date().toISOString();
const COURSE_CATEGORIES = [
  { id: 'ai', label: 'Artificial Intelligence & Automation', group: 'A' },
  { id: 'video', label: 'Video Editing & Film Production', group: 'B' },
  { id: 'web', label: 'Website Development', group: 'C' },
  { id: 'marketing', label: 'Social Media & Digital Marketing', group: 'D' },
  { id: 'design', label: 'Graphic Design', group: 'E' },
  { id: 'entrepreneur', label: 'Digital Entrepreneurship', group: 'F' },
  { id: 'advanced', label: 'Advanced Technology', group: 'G', comingSoon: true }
];
const COURSE_DETAIL_KEYS = ['category', 'instructor', 'startDate', 'duration', 'schedule', 'classesPerWeek', 'sessionsTotal', 'minStudents', 'originalPrice', 'offerEnds'];
const SETTINGS_DEFAULTS = {
  businessName: 'DEBONE Photos & Video Editing Studio', tagline: 'Since 1997, in Port Harcourt.',
  phone1: '0803 598 8889', phone2: '0813 976 3301', whatsapp: '2348035988889', email: '',
  address: '179 Old Refinery Road, Elelenwo, Port Harcourt, Rivers State, Nigeria',
  hours: 'Monday to Saturday, 8:00 am to 6:00 pm', facebook: '', instagram: '', tiktok: '', youtube: '',
  announcement: '', announcementOn: false,
  // Business rules. These are defaults: change them in Site settings.
  replayDays: 14, downloadLimit: 3, downloadDays: 365, depositPercent: 50,
  referralDiscountPercent: 10, referrerRewardPercent: 10, withdrawMinReferrals: 5, noticeDays: 7, refundWindowDays: 7,
  certMinPercent: 50, allowResubmission: true,
  bankOneBank: 'OPay', bankOneName: 'Godwin Chidi Ugwuala', bankOneNumber: '8035988889',
  bankTwoBank: 'First Bank', bankTwoName: 'Godwin Chidi Ugwuala', bankTwoNumber: '3196941733'
};
const cfg = k => { const v = Number((db.settings || {})[k] !== undefined ? db.settings[k] : SETTINGS_DEFAULTS[k]); return Number.isFinite(v) ? v : Number(SETTINGS_DEFAULTS[k]); };
function genReferralCode() { return 'DBR' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function makePdf(content) {
  const objs = [];
  const add = v => { objs.push(v); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>');
  add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}
const pdfText = t => String(t || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\()]/g, '\\$&');
const cfgBool = k => { const v = (db.settings || {})[k]; return v === undefined ? !!SETTINGS_DEFAULTS[k] : !!v; };

/* Fills in the starting content (courses, products, services, works, settings) the first time, and refreshes course details from courses.json. Runs once after the database is loaded. */
function bootstrap() {
  if (!db.courses) {
    db.courses = JSON.parse(JSON.stringify(seed.courses));
    db.announcements = seed.announcements;
    save();
  }
  if (!db.products) db.products = productSeed.products.map(p => ({ id: p.id, name: p.name, cat: p.cat, summary: p.summary || '', description: p.description || '', price: p.price, imageUrl: p.image || null, imageData: null, createdAt: seedTime, updatedAt: seedTime }));
  if (!db.settings) db.settings = Object.assign({}, SETTINGS_DEFAULTS);
  if (!db.services) db.services = servicesSeed.services.map((sv, i) => Object.assign({ order: i + 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, sv));
  (function normaliseServiceOrder() {
    const sorted = db.services.map((sv, i) => ({ sv, i })).sort((a, b) => ((a.sv.order || 0) - (b.sv.order || 0)) || (a.i - b.i));
    let changed = false;
    sorted.forEach((x, n) => { if (x.sv.order !== n + 1) { x.sv.order = n + 1; changed = true; } });
    if (changed) save();
  })();
  (function upgradeServiceDescriptions() {
    let changed = false;
    servicesSeed.services.forEach(seedSv => {
      const sv = db.services.find(x => x.id === seedSv.id);
      if (sv && seedSv.description && seedSv.description !== seedSv.summary && (!sv.description || sv.description === sv.summary || sv.description === seedSv.summary)) { sv.description = seedSv.description; changed = true; }
    });
    if (changed) save();
  })();
  if (!db.works) db.works = worksSeed.works.map(w => Object.assign({ createdAt: seedTime, updatedAt: seedTime }, w));
  seed.courses.forEach(sc => {
    const dc = db.courses.find(c => c.id === sc.id);
    // The admin controls "coming soon" from the course editor, so the seed value is only a starting point and never overrides a saved choice
    if (dc) ['comingSoon', 'liveStart', 'liveLabel'].forEach(k => { if (sc[k] !== undefined && (k !== 'comingSoon' || dc[k] === undefined)) dc[k] = sc[k]; });
    if (dc) COURSE_DETAIL_KEYS.forEach(k => { if (dc[k] === undefined && sc[k] !== undefined) dc[k] = sc[k]; });
  });
}

/* ---------- Helpers ---------- */
const uid = (n = 12) => crypto.randomBytes(n).toString('hex');
const now = () => new Date().toISOString();
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
const httpError = (status, message) => Object.assign(new Error(message), { status });
// Live updates: every open page is told when something changes
const clients = new Set();
function sendEvent(userId, type, data) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data || {})}\n\n`;
  for (const c of clients) if (userId === null || c.userId === userId) c.res.write(msg);
}
let revPending = null, revAt = 0;
function broadcastRefresh() { revAt = 0; sendEvent(null, 'refresh', {}); }
function notify(userId, title, body, link, extra) { sendEvent(userId, 'notice', Object.assign({ title, body, link: link || '', kind: 'update', at: new Date().toISOString() }, extra || {})); }
function gradeOf(marks, max) {
  const pct = max ? (marks / max) * 100 : 0;
  if (pct >= 75) return { key: 'distinction', label: 'Distinction' };
  if (pct >= 50) return { key: 'pass', label: 'Pass' };
  return { key: 'fail', label: 'Fail' };
}
function slugify(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item'; }
function validImage(data) {
  const m = String(data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw httpError(400, 'Please upload a JPG, PNG or WebP image.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 220 * 1024) throw httpError(400, 'That image is too large. Please use an image under 200 KB.');
  const ok = (m[1] === 'image/jpeg' && buf[0] === 0xFF && buf[1] === 0xD8) || (m[1] === 'image/png' && buf.slice(1, 4).toString() === 'PNG') ||
    (m[1] === 'image/webp' && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP');
  if (!ok) throw httpError(400, 'That file is not a valid image.');
  return { mime: m[1], b64: m[2] };
}
function productView(p) {
  return { id: p.id, name: p.name, cat: p.cat, summary: p.summary, description: p.description, price: p.price,
    free: false, image: p.imageData ? `/api/products/${p.id}/image?v=${encodeURIComponent(p.updatedAt)}` : (p.imageUrl || null), hasImage: !!p.imageData };
}
function workView(w) {
  return { id: w.id, title: w.title, category: w.category, caption: w.caption || w.category, alt: w.alt || w.title,
    image: w.imageData ? `/api/works/${w.id}/image?v=${encodeURIComponent(w.updatedAt)}` : (w.imageUrl || null), hasImage: !!w.imageData };
}
function categoriesOf() { return productSeed.categories; }
function newCoupon() { return 'DBN' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function couponFor(u) {
  const r = (db.newsletter || []).find(n => n.email === u.email && n.coupon && !n.couponUsed);
  return r ? { code: r.coupon, discount: 30 } : null;
}
const htmlEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sha256 = v => crypto.createHash('sha256').update(String(v)).digest('hex');
async function sendEmail(to, subject, html, text) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email not configured] To: ${to} | ${subject} | ${text}`);
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'DEBONE <onboarding@resend.dev>', to: [to], subject, html, text })
  });
  if (!r.ok) console.error('Email could not be sent. Provider status:', r.status);
}
const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(pw, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function sign(value) { return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url'); }
function sessionCookie(user, remember) {
  const days = remember ? 30 : 7;
  const exp = Date.now() + days * 24 * 3600 * 1000;
  const ver = String(user.tokenVersion || 0);
  const value = `${user.id}.${exp}.${ver}`;
  return `dsid=${value}.${sign(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${COOKIE_SECURE ? '; Secure' : ''}`;
}
function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}
function clearCookie() { return `dsid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${COOKIE_SECURE ? '; Secure' : ''}`; }
function readSession(req) {
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('dsid='));
  if (!raw) return null;
  const parts = raw.slice(5).split('.');
  if (parts.length !== 4) return null;
  const [userId, exp, ver, sig] = parts;
  const expected = sign(`${userId}.${exp}.${ver}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Date.now() > Number(exp)) return null;
  const user = db.users.find(u => u.id === userId);
  if (!user || String(user.tokenVersion || 0) !== ver || user.suspended) return null;
  return user;
}

const hits = new Map();
function limited(key, max = 10, windowMs = 60000) {
  const t = Date.now();
  const arr = (hits.get(key) || []).filter(x => t - x < windowMs);
  arr.push(t);
  hits.set(key, arr);
  return arr.length > max;
}

const PROFILE_SPEC = {
  dob: { type: 'date' },
  gender: { type: 'enum', values: ['Female', 'Male', 'Prefer not to say'] },
  state: { type: 'text', max: 60 },
  city: { type: 'text', max: 60 },
  address: { type: 'text', max: 200 },
  occupation: { type: 'enum', values: ['Student', 'Employed', 'Self-employed', 'Unemployed', 'Other'] },
  educationLevel: { type: 'enum', values: ['Primary', 'Secondary', 'OND / NCE', 'HND / Bachelor', 'Postgraduate', 'Other'] },
  institution: { type: 'text', max: 120 },
  howHeard: { type: 'enum', values: ['Friend or family', 'Social media', 'Google', 'WhatsApp', 'Walk-in', 'Other'] },
  goals: { type: 'text', max: 500 },
  nokName: { type: 'text', max: 80 },
  nokPhone: { type: 'phone' }
};
const COMPLETION_REQUIRED = ['name', 'phone', 'avatar', 'dob', 'gender', 'state', 'city', 'occupation', 'educationLevel', 'goals', 'nokName', 'nokPhone'];
function cleanProfile(input, existing) {
  const out = Object.assign({}, existing || {});
  for (const k of Object.keys(PROFILE_SPEC)) {
    if (input[k] === undefined) continue;
    const spec = PROFILE_SPEC[k];
    const v = clean(input[k], spec.max || 200);
    if (spec.type === 'enum' && v && !spec.values.includes(v)) throw httpError(400, 'Please choose a valid option.');
    if (spec.type === 'date' && v) {
      const age = (Date.now() - Date.parse(v)) / (365.25 * 864e5);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)) || age < 5 || age > 100) throw httpError(400, 'Enter a valid date of birth.');
    }
    if (spec.type === 'phone' && v && !/^[+0-9 ()-]{7,20}$/.test(v)) throw httpError(400, 'Enter a valid emergency contact phone number.');
    out[k] = v;
  }
  return out;
}
function completion(u) {
  const p = u.profile || {};
  const has = { name: !!u.name, phone: !!u.phone, avatar: !!u.avatar };
  Object.keys(PROFILE_SPEC).forEach(k => { has[k] = !!p[k]; });
  const missing = COMPLETION_REQUIRED.filter(k => !has[k]);
  return { percent: Math.round(((COMPLETION_REQUIRED.length - missing.length) / COMPLETION_REQUIRED.length) * 100), missing };
}
// The advert-QR discount: 15% on the first purchase, for 7 days after registering with the QR code
function qrOffer(u) {
  if (!u || !u.qrSource || !u.qrUntil || Date.now() > new Date(u.qrUntil).getTime()) return null;
  if (db.payments.some(x => x.userId === u.id && x.status === 'success')) return null;
  return { percent: QR_PERCENT, until: u.qrUntil, source: u.qrSource };
}
function qrSourceOf(v) { return clean(v, 30).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30); }
function recordQrSignup(user, src) {
  if (!src) return;
  user.qrSource = src; user.qrUntil = new Date(Date.now() + QR_DAYS * 86400000).toISOString();
  const st = db.qrStats[src] = db.qrStats[src] || { scans: 0 }; st.lastSignupAt = now();
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role || 'student', createdAt: u.createdAt,
    zoomName: u.zoomName || '', profile: u.profile || {}, hasAvatar: !!u.avatar, completion: completion(u), coupon: couponFor(u), qrOffer: qrOffer(u) };
}
const isAdmin = u => !!u && u.role === 'admin';
const isStaff = u => !!u && (u.role === 'admin' || u.role === 'instructor');

function enrollmentFor(userId, courseId) {
  return db.enrollments.find(e => e.userId === userId && e.courseId === courseId && e.status === 'active');
}
function courseAccess(user, course) {
  if (!user) return false;
  return course.price === 0 || !!enrollmentFor(user.id, course.id);
}
// Everyone who can open a course: all students for a free course, enrolled students for a paid one
function studentsWithAccess(course) {
  return db.users.filter(u => !isStaff(u) && courseAccess(u, course));
}
// Resources are typed as one per line: "Title | https://link"
function parseResources(text) {
  return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [t, ...rest] = l.split('|');
    const url = rest.join('|').trim();
    return { title: clean(t, 120) || 'Resource', url: /^https?:\/\//.test(url) ? url : '' };
  }).filter(r => r.url).slice(0, 20);
}
function findLesson(id) {
  for (const c of db.courses) {
    const l = c.lessons.find(x => x.id === id);
    if (l) return { course: c, lesson: l };
  }
  return null;
}
function enrolledCount(course) {
  return db.enrollments.filter(e => e.courseId === course.id && e.status === 'active').length;
}
function courseDetailInput(b, c) {
  const out = {};
  if (b.category !== undefined) {
    if (b.category && !COURSE_CATEGORIES.some(x => x.id === b.category)) throw httpError(400, 'Please choose a valid category.');
    out.category = b.category || null;
  }
  if (b.instructor !== undefined) out.instructor = clean(b.instructor, 120) || null;
  if (b.duration !== undefined) out.duration = clean(b.duration, 60) || null;
  if (b.schedule !== undefined) out.schedule = clean(b.schedule, 240) || null;
  if (b.startDate !== undefined) {
    if (b.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate))) throw httpError(400, 'Enter the start date as a date.');
    out.startDate = b.startDate || null;
  }
  const num = (v, max) => {
    if (v === '' || v == null) return null;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 1 || n > max) throw httpError(400, 'Numbers must be between 1 and ' + max + '.');
    return n;
  };
  if (b.classesPerWeek !== undefined) out.classesPerWeek = num(b.classesPerWeek, 7);
  if (b.sessionsTotal !== undefined) out.sessionsTotal = num(b.sessionsTotal, 60);
  if (b.minStudents !== undefined) out.minStudents = num(b.minStudents, 5000);
  // Coming soon: the course is shown but cannot be bought. Students join a waiting list instead.
  if (b.comingSoon !== undefined) out.comingSoon = b.comingSoon === true || b.comingSoon === 'true';
  // Offer: the "normal" price shown crossed out, and an optional last day for the discount
  if (b.originalPrice !== undefined) out.originalPrice = Number(b.originalPrice) > 0 ? num(b.originalPrice, 100000000) : null;
  if (b.offerEnds !== undefined) {
    if (b.offerEnds && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.offerEnds))) throw httpError(400, 'Enter the offer end date as a date.');
    out.offerEnds = b.offerEnds || null;
  }
  const price = b.price !== undefined ? Math.max(0, Math.round(Number(b.price) || 0)) : c.price;
  const orig = out.originalPrice !== undefined ? out.originalPrice : c.originalPrice;
  if (orig && !(price > 0 && orig > price)) throw httpError(400, 'The normal price must be higher than the selling price, and the course must not be free.');
  return out;
}
/* ---------- Lesson journey: a lesson opens only after the previous one is finished ----------
   Finishing a lesson means: its live class is done (joined live, or the recording watched) and its assignment is submitted.
   Staff are never held back. A lesson a student has already completed always stays open. */
const REQUIRE_NOTE = false;   // set to true to also require a written note before a lesson can be finished
function lessonSessions(course, lesson) {
  return db.sessions.filter(s => s.courseId === course.id && s.lessonId === lesson.id)
    .sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || ''));
}
function lessonRequirements(user, course, lesson) {
  const sessions = lessonSessions(course, lesson);
  const mine = sessions.map(s => db.attendance.find(a => a.sessionId === s.id && a.userId === user.id)).filter(Boolean);
  const classDone = sessions.length === 0 || mine.length > 0;
  // 'live' = joined the live class, 'recording' = missed it and watched the recorded video
  const classHow = mine.length ? (mine.some(a => a.how === 'live') ? 'live' : 'recording') : null;
  const assignments = db.assignments.filter(a => a.courseId === course.id && a.lessonId === lesson.id);
  const submitted = assignments.length > 0 && assignments.every(a => db.submissions.some(x => x.assignmentId === a.id && x.userId === user.id));
  const note = (db.notes.find(n => n.userId === user.id && n.lessonId === lesson.id) || {}).text || '';
  const noteDone = !REQUIRE_NOTE || note.trim().length > 0;
  const missing = [];
  if (!classDone) missing.push('Join the live class, or watch the recorded video if you missed it');
  if (!assignments.length) missing.push('Wait for your instructor to publish the assignment');
  else if (!submitted) missing.push('Submit every assignment for this lesson');
  if (!noteDone) missing.push('Write your lesson note');
  return { hasClass: sessions.length > 0, classDone, classHow, hasAssignment: assignments.length > 0, submitted, noteDone, ready: missing.length === 0, missing };
}
const fmtDay = k => new Date(k + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
// The calendar day a lesson opens: the day of its first live class. Lesson 1 and lessons without a class are not held back by date.
function lessonOpensOn(course, lesson, index) {
  if (index <= 0) return null;
  const first = lessonSessions(course, lesson).find(s => s.startsAt);
  return first ? dayKey(first.startsAt) : null;
}
// A saved progress record is not proof of completion when lesson requirements are unmet.
function validLessonCompletion(user, course, lesson) {
  if (!user || !db.progress.some(p => p.userId === user.id && p.lessonId === lesson.id)) return false;
  return isStaff(user) || lessonRequirements(user, course, lesson).ready;
}
// A limited-time offer: the crossed-out normal price, how much is saved, and when it ends. Null when there is no live offer.
function offerFor(course) {
  const orig = Number(course.originalPrice) || 0;
  if (!(course.price > 0 && orig > course.price)) return null;
  let endsAt = null;
  if (course.offerEnds) {
    endsAt = new Date(course.offerEnds + 'T23:59:59').toISOString();
    if (new Date(endsAt).getTime() < Date.now()) return null;   // the offer has finished
  }
  const save = orig - course.price;
  return { originalPrice: orig, save, percent: Math.round((save / orig) * 100), endsAt };
}
function courseView(course, user) {
  // Revoke stale completion records created before the assignment gate existed.
  // Without this, submitting an assignment later could resurrect an old completion.
  if (user && !isStaff(user)) {
    const lessonIds = new Set(course.lessons.map(l => l.id));
    const before = db.progress.length;
    db.progress = db.progress.filter(p => p.userId !== user.id || !lessonIds.has(p.lessonId) ||
      validLessonCompletion(user, course, course.lessons.find(l => l.id === p.lessonId)));
    if (db.progress.length !== before) save();
  }
  const enrolled = courseAccess(user, course);
  const done = new Set(user ? course.lessons.filter(l => validLessonCompletion(user, course, l)).map(l => l.id) : []);
  const held = !!user && !isStaff(user);
  const lessons = course.lessons.map((l, i) => {
    const prev = i > 0 ? course.lessons[i - 1] : null;
    const preview = !!l.free && course.price > 0;   // a free preview lesson inside a paid course stays open
    // A lesson opens only when ALL of these hold: the previous lesson is completed, the class day has arrived,
    // and staff have actually started the lesson's live class (a calendar date alone never opens it).
    const adminStarted = lessonSessions(course, l).some(s => !!s.liveStartedAt || s.status === 'live');
    const prevUndone = held && enrolled && !preview && !!prev && !done.has(prev.id) && !done.has(l.id);
    const opensOn = lessonOpensOn(course, l, i);
    const early = held && enrolled && !preview && !done.has(l.id) && !!opensOn && dayKey(Date.now()) < opensOn;
    const notStarted = held && enrolled && !preview && !done.has(l.id) && i > 0 && !adminStarted;
    const gated = prevUndone || early || notStarted;
    let lockReason = '';
    if (prevUndone) lockReason = 'Finish lesson ' + i + ' (its live class and assignment) to unlock this lesson.';
    else if (early) lockReason = 'This lesson opens on ' + fmtDay(opensOn) + ', the day of its class.';
    else if (notStarted) lockReason = 'This lesson opens when your instructor starts its live class.';
    return {
      id: l.id, number: i + 1, title: l.title, free: !!l.free,
      locked: !(enrolled || l.free) || gated, gated, completed: done.has(l.id),
      waiting: (early || notStarted) && !prevUndone, opensOn: opensOn, lockReason
    };
  });
  const completed = lessons.filter(l => l.completed).length;
  return {
    id: course.id, title: course.title, subtitle: course.subtitle, summary: course.summary, level: course.level,
    price: course.price, free: course.price === 0, enrolled, lessons, completed, total: lessons.length,
    comingSoon: !!course.comingSoon, liveStart: course.liveStart || null, liveLabel: course.liveLabel || null, hasImage: !!course.image,
    category: course.category || null, categoryLabel: (COURSE_CATEGORIES.find(c => c.id === course.category) || {}).label || null,
    instructor: course.instructor || null, startDate: course.startDate || null, duration: course.duration || null,
    schedule: course.schedule || null, classesPerWeek: course.classesPerWeek || null, sessionsTotal: course.sessionsTotal || null,
    offer: offerFor(course), originalPrice: course.originalPrice || 0, offerEnds: course.offerEnds || null, waitlistCount: (db.waitlist || []).filter(w => w.courseId === course.id).length,
    onWaitlist: !!user && (db.waitlist || []).some(w => w.courseId === course.id && w.userId === user.id),
    minStudents: course.minStudents || null, enrolledCount: enrolledCount(course),
    progress: lessons.length ? Math.round((completed / lessons.length) * 100) : 0,
    rating: ratingFor(course.id)
  };
}

function youtubeId(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|live\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
// A class is over when the instructor ended it, or when its time (plus a short grace period) has passed and it was never left running
function sessionEnded(s) {
  if (s.status === 'ended') return true;
  if (s.status === 'live' || !s.startsAt) return false;
  return Date.now() > new Date(s.startsAt).getTime() + ((Number(s.durationMinutes) || 120) + 30) * 60000;
}
function safeYouTubeEmbed(value) {
  const id = youtubeId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&controls=0&fs=1&playsinline=1` : null;
}
function sessionView(s, user) {
  const course = db.courses.find(c => c.id === s.courseId);
  const timing = sessionTiming(s, user);
  const liveAllowed = s.status === 'live' && timing.liveOpen;
  const replayAllowed = sessionEnded(s) && !!(s.r2RecordingKey || s.recordingUrl) && replayOpen(s);
  return {
    id: s.id, courseId: s.courseId, courseTitle: course ? course.title : '', title: s.title, lessonId: s.lessonId || null,
    startsAt: s.startsAt || null, status: s.status || 'scheduled', ended: sessionEnded(s),
    // Playback identifiers are only returned to an authenticated, enrolled student.
    // YouTube embeds are not DRM and can still be extracted by a determined viewer.
    embedUrl: liveAllowed ? safeYouTubeEmbed(s.youtubeUrl) : null,
    recordingAvailable: replayAllowed, recordingUrl: null,
    joinUrl: null, hasJoinLink: !!s.joinUrl,
    durationMinutes: Number(s.durationMinutes) || 120, ...timing,
    replayUntil: replayUntilFor(s), replayExpired: !!(s.r2RecordingKey || s.recordingUrl) && !replayOpen(s),
    chatOpen: s.chatOpen !== false
  };
}
// Join window: opens 15 minutes before the start and stays open for the length of the class
function sessionTiming(s, user) {
  const start = s.startsAt ? new Date(s.startsAt).getTime() : null;
  const dur = (Number(s.durationMinutes) || 120) * 60000;
  const nowMs = Date.now();
  const inWindow = start !== null && nowMs >= start - 15 * 60000 && nowMs <= start + dur;
  const joinOpen = !!s.joinUrl && (s.status === 'live' || inWindow);
  const attendanceRecord = user && db.attendance.find(a => a.sessionId === s.id && a.userId === user.id);
  const attended = !!attendanceRecord;
  return { joinOpen, attendanceType: attendanceRecord ? attendanceRecord.how : null, attendedHow: attendanceRecord ? (attendanceRecord.how === 'recording' ? 'recording' : 'live') : null, liveOpen: s.status === 'live' || inWindow, countdownTo: start && start > nowMs ? s.startsAt : null, attended,
    attendees: db.attendance.filter(a => a.sessionId === s.id).length };
}
// Reminders: enrolled students are told one hour before a class starts
function runSessionReminders() {
  let changed = false;
  const hour = 60 * 60000;
  db.sessions.forEach(s => {
    if (!s.startsAt || s.reminded) return;
    const left = new Date(s.startsAt).getTime() - Date.now();
    if (left <= 0 || left > hour) return;
    db.enrollments.filter(e => e.courseId === s.courseId && e.status === 'active').forEach(e => {
      notify(e.userId, 'Live class starts soon', `${s.title} starts in about ${Math.max(1, Math.round(left / 60000))} minutes. Open Live classes to join.`, '#live', { kind: 'live' });
    });
    s.reminded = true; changed = true;
  });
  if (changed) save();
}
// Replays stay available for a set number of days after the last class of the whole course
function courseEndFor(courseId) {
  const dates = db.sessions.filter(x => x.courseId === courseId && x.startsAt).map(x => new Date(x.startsAt).getTime());
  const course = db.courses.find(c => c.id === courseId);
  if (course && course.startDate) dates.push(new Date(course.startDate + 'T23:59:59').getTime());
  return dates.length ? Math.max(...dates) : null;
}
function replayUntilFor(s) {
  const end = courseEndFor(s.courseId);
  return end ? new Date(end + cfg('replayDays') * 86400000).toISOString() : null;
}
function replayOpen(s) {
  const until = replayUntilFor(s);
  return !until || Date.now() <= new Date(until).getTime();
}

/* ---------- Paystack ---------- */
async function paystack(method, pathname, body) {
  if (!PAYSTACK_SECRET) throw httpError(503, 'Online payments are not configured yet. Please contact us on WhatsApp.');
  const r = await fetch(PAYSTACK_BASE + pathname, {
    method, headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status === false) throw httpError(502, j.message || 'Payment provider error. Please try again.');
  return j.data;
}
// Referral: every successful payment of a referred student earns the referrer a share of what was paid.
function recordReferralReward(pay) {
  if (!pay || pay.status !== 'success' || (pay.kind || 'course') === 'deposit') return;
  if (db.referralEvents.some(e => e.reference === pay.reference)) return;
  const payer = db.users.find(u => u.id === pay.userId);
  if (!payer || !payer.referredBy) return;
  const referrer = db.users.find(u => u.referralCode === payer.referredBy);
  if (!referrer || referrer.id === payer.id) return;
  const paid = pay.amountKobo / 100;
  const reward = Math.round(paid * cfg('referrerRewardPercent') / 100);
  db.referralEvents.push({ id: uid(8), referrerId: referrer.id, refereeId: payer.id, reference: pay.reference, paidNaira: paid, rewardNaira: reward, withdrawalId: null, createdAt: now() });
  notify(referrer.id, 'Referral reward added', `${payer.name.split(' ')[0]} paid ₦${paid.toLocaleString('en-US')}. ₦${reward.toLocaleString('en-US')} has been added to your balance.`, '#referrals', { kind: 'payment' });
}
function reconcileReferralRewards() {
  let changed = false;
  db.payments.filter(p => p.status === 'success').forEach(p => {
    const before = db.referralEvents.length; recordReferralReward(p);
    if (db.referralEvents.length !== before) changed = true;
  });
  if (changed) save();
}
function referralSummary(user) {
  const open = db.referralEvents.filter(e => e.referrerId === user.id && !e.withdrawalId);
  const friends = new Set(open.map(e => e.refereeId));
  const min = cfg('withdrawMinReferrals');
  const pending = db.withdrawals.find(w => w.userId === user.id && w.status === 'requested');
  const balance = open.reduce((t, e) => t + e.rewardNaira, 0);
  return { balance, paidFriends: friends.size, min, needed: Math.max(0, min - friends.size), pending: !!pending,
    eligible: friends.size >= min && balance > 0 && !pending };
}
function bankAccounts() {
  const s = Object.assign({}, SETTINGS_DEFAULTS, db.settings || {});
  return [1, 2].map(i => ({ bank: s['bank' + (i === 1 ? 'One' : 'Two') + 'Bank'] || '', name: s['bank' + (i === 1 ? 'One' : 'Two') + 'Name'] || '', number: s['bank' + (i === 1 ? 'One' : 'Two') + 'Number'] || '' }));
}
function createOrder(user, o) {
  const order = { id: uid(8), reference: 'DBO-' + uid(6).toUpperCase(), userId: user ? user.id : null,
    contactEmail: user ? user.email : '', contactName: user ? user.name : '', status: 'awaiting_transfer',
    createdAt: now(), updatedAt: now(), proof: null, rejectReason: '' };
  Object.assign(order, o, { amountNaira: Math.round(o.amountNaira) });
  if (o.contactEmail) order.contactEmail = o.contactEmail;
  if (o.contactName) order.contactName = o.contactName;
  db.orders.push(order); save();
  return order;
}
function orderItem(o) {
  if (o.kind === 'product') return (db.digitalProducts.find(x => x.id === o.productId) || {}).title || 'Digital product';
  if (o.kind === 'bundle') return (db.bundles.find(x => x.id === o.bundleId) || {}).title || 'Course bundle';
  if (o.kind === 'deposit') return 'Studio deposit';
  return (db.courses.find(x => x.id === o.courseId) || {}).title || 'Course';
}
function orderView(o) {
  return { id: o.id, reference: o.reference, kind: o.kind || 'course', item: orderItem(o), amount: o.amountNaira, status: o.status,
    rejectReason: o.rejectReason || '', proofName: o.proof ? o.proof.name : '', createdAt: o.createdAt, updatedAt: o.updatedAt,
    student: o.contactName || '', email: o.contactEmail || '', bankAccounts: bankAccounts(), courseId: o.courseId || null };
}
// The admin approves a proof of transfer: the payment is recorded and access is granted, exactly like a confirmed payment
function approveOrder(o) {
  const pay = { id: uid(), reference: o.reference, userId: o.userId, kind: o.kind || 'course', courseId: o.courseId || null,
    productId: o.productId || null, bundleId: o.bundleId || null, bookingId: o.bookingId || null,
    amountKobo: Math.round(o.amountNaira * 100), status: 'pending', createdAt: o.createdAt, channel: 'bank transfer' };
  db.payments.push(pay);
  pay.status = 'success'; pay.paidAt = now();
  grantPaid(pay, pay.reference);
  o.status = 'approved'; o.updatedAt = now();
}
// Gives access once a payment is confirmed: enrolment, product download, bundle courses or studio deposit
function grantPaid(pay, reference) {
  const kind = pay.kind || 'course';
  if (kind === 'product') {
    const prod = db.digitalProducts.find(x => x.id === pay.productId);
    db.purchases.push({ id: uid(8), userId: pay.userId, productId: pay.productId, reference, createdAt: now(), downloads: 0,
      expiresAt: new Date(Date.now() + cfg('downloadDays') * 86400000).toISOString() });
    notify(pay.userId, 'Purchase complete', (prod ? prod.title : 'Your product') + ' is ready. Open Downloads to get it.', '#downloads', { kind: 'payment' });
  } else if (kind === 'bundle') {
    const bundle = db.bundles.find(x => x.id === pay.bundleId);
    (bundle ? bundle.courseIds : []).forEach(cid => {
      if (!db.courses.find(c => c.id === cid)) return;
      if (!enrollmentFor(pay.userId, cid)) db.enrollments.push({ id: uid(), userId: pay.userId, courseId: cid, status: 'active', enrolledAt: now(), via: 'bundle', reference, bundleId: pay.bundleId });
    });
    notify(pay.userId, 'Bundle unlocked', (bundle ? bundle.title : 'Your bundle') + ' is unlocked. Every course is in My courses.', '#courses', { kind: 'payment' });
  } else if (kind === 'deposit') {
    const bk = db.bookings.find(x => x.id === pay.bookingId);
    if (bk) { bk.status = 'deposit_paid'; bk.depositPaidAt = now(); }
  } else if (!enrollmentFor(pay.userId, pay.courseId)) {
    db.enrollments.push({ id: uid(), userId: pay.userId, courseId: pay.courseId, status: 'active', enrolledAt: now(), via: 'paystack', reference });
  }
  recordReferralReward(pay);
  save();
  if (pay.userId) {
    sendEvent(pay.userId, 'unlock', { courseId: pay.courseId });
    if (kind === 'course') notify(pay.userId, 'Payment confirmed', 'Your course is unlocked. Start learning now.', '#courses', { kind: 'payment' });
  }
}
async function fulfil(reference) {
  const pay = db.payments.find(p => p.reference === reference);
  if (!pay) throw httpError(404, 'Payment not found');
  if (pay.status === 'success') return pay;
  const data = await paystack('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
  if (pay.status === 'success') return pay;
  if (data.status !== 'success') {
    if (data.status === 'failed') { pay.status = 'failed'; save(); }
    return pay;
  }
  if (data.amount !== pay.amountKobo || (data.currency && data.currency !== CURRENCY)) {
    pay.status = 'mismatch'; save();
    throw httpError(409, 'Payment amount did not match the course price. Please contact us.');
  }
  pay.status = 'success';
  pay.paidAt = now();
  pay.channel = data.channel || null;
  if (pay.coupon) { const sub = (db.newsletter || []).find(n => n.coupon === pay.coupon); if (sub) sub.couponUsed = true; }
  grantPaid(pay, reference);
  return pay;
}

/* ---------- Routing ---------- */
const routes = [];
function route(method, pattern, handler) {
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, n) => `(?<${n}>[^/]+)`) + '$');
  routes.push({ method, re, handler });
}
function requireUser(ctx) { if (!ctx.user) throw httpError(401, 'Please log in to continue.'); return ctx.user; }
function requireStaff(ctx, admin = false) {
  const u = requireUser(ctx);
  if (admin ? !isAdmin(u) : !isStaff(u)) throw httpError(403, 'You do not have permission to do that.');
  return u;
}
function json(res, status, obj, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(httpError(413, 'Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit = 100 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw httpError(400, 'Invalid request'); }
}
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';


/* ---------- Auth ---------- */
route('POST', '/api/auth/signup', async ctx => {
  if (limited('signup:' + clientIp(ctx.req), 8)) throw httpError(429, 'Too many attempts. Please wait a minute and try again.');
  const b = ctx.body;
  const name = clean(b.name, 80), email = clean(b.email, 120).toLowerCase(), phone = clean(b.phone, 20);
  const refCode = clean(b.referralCode, 20).toUpperCase();
  const password = String(b.password || '');
  if (name.length < 2) throw httpError(400, 'Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Please enter a valid email address.');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters.');
  if (db.users.some(u => u.email === email)) throw httpError(409, 'An account with this email already exists. Try logging in.');
  const referrer = refCode ? db.users.find(u => u.referralCode === refCode && u.email !== email) : null;
  const user = { id: uid(), name, email, phone, role: 'student', passHash: hashPassword(password), createdAt: now(), referralCode: genReferralCode(), referredBy: referrer ? referrer.referralCode : null };
  recordQrSignup(user, qrSourceOf(b.qr));
  db.users.push(user);
  save();
  json(ctx.res, 201, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(user) });
});

route('POST', '/api/auth/login', async ctx => {
  if (limited('login:' + clientIp(ctx.req), 10)) throw httpError(429, 'Too many attempts. Please wait a minute and try again.');
  const email = clean(ctx.body.email, 120).toLowerCase();
  const password = String(ctx.body.password || '');
  const user = db.users.find(u => u.email === email);
  if (!user || !verifyPassword(password, user.passHash)) throw httpError(401, 'Incorrect email or password.');
  if (isStaff(user)) throw httpError(403, 'Staff accounts log in at the staff login page.');
  if (user.suspended) throw httpError(403, 'This account has been suspended. Please contact us on WhatsApp.');
  json(ctx.res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(user, !!ctx.body.remember) });
});

route('POST', '/api/auth/logout', async ctx => json(ctx.res, 200, { ok: true }, { 'Set-Cookie': clearCookie() }));

route('GET', '/api/me', async ctx => json(ctx.res, 200, { user: publicUser(requireUser(ctx)) }));

/* Zoom Basic: compulsory registered display name before releasing meeting links. */
/* Staff-only Zoom waiting-room roster. No meeting URLs or passcodes exposed. */
route('GET', '/api/staff/zoom-verification', async ctx => {
  requireStaff(ctx);
  const rows = db.users.filter(u => (u.role || 'student') === 'student').map(u => {
    const enrollments = db.enrollments.filter(e => e.userId === u.id && e.status === 'active');
    const courses = enrollments.map(e => db.courses.find(c => c.id === e.courseId)).filter(Boolean).map(c => ({ id: c.id, title: c.title }));
    return { id: u.id, name: u.name || '', zoomName: u.zoomName || '', courses, eligible: courses.length > 0, zoomNameUpdatedAt: u.zoomNameUpdatedAt || null };
  });
  const counts = new Map();
  rows.forEach(r => { if (r.zoomName) { const k = r.zoomName.trim().toLocaleLowerCase(); counts.set(k, (counts.get(k) || 0) + 1); } });
  rows.forEach(r => { r.duplicate = !!r.zoomName && counts.get(r.zoomName.trim().toLocaleLowerCase()) > 1; });
  json(ctx.res, 200, { students: rows });
});

route('PUT', '/api/me/zoom-name', async ctx => {
  const user = requireUser(ctx);
  const name = clean(ctx.body.zoomName, 80).replace(/\s+/g, ' ').trim();
  if (name.length < 3 || !/[a-zA-Z\u00c0-\u024f]/.test(name)) throw httpError(400, 'Enter your actual Zoom display name (at least 3 characters).');
  if (/https?:|zoom\.us|[<>]/i.test(name)) throw httpError(400, 'Enter a display name, not a meeting link.');
  const duplicate = db.users.find(u => u.id !== user.id && String(u.zoomName || '').toLowerCase() === name.toLowerCase());
  if (duplicate) throw httpError(409, 'This Zoom display name is already registered. Use a distinct name in Zoom, then try again.');
  user.zoomName = name; user.zoomNameUpdatedAt = now(); save();
  json(ctx.res, 200, { ok: true, zoomName: name });
});


route('PATCH', '/api/me', async ctx => {
  const user = requireUser(ctx);
  const b = ctx.body;
  const name = b.name !== undefined ? clean(b.name, 80) : user.name;
  const phone = b.phone !== undefined ? clean(b.phone, 20) : user.phone;
  if (name.length < 2) throw httpError(400, 'Please enter your full name.');
  if (phone && !/^[+0-9 ()-]{7,20}$/.test(phone)) throw httpError(400, 'Please enter a valid phone number.');
  if (b.profile && typeof b.profile === 'object') user.profile = cleanProfile(b.profile, user.profile);
  user.name = name; user.phone = phone;
  save();
  json(ctx.res, 200, { user: publicUser(user) });
});

route('POST', '/api/me/avatar', async ctx => {
  const user = requireUser(ctx);
  const m = String(ctx.body.data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw httpError(400, 'Please upload a JPG, PNG or WebP image.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 250 * 1024) throw httpError(400, 'That photo is too large. Please choose a smaller one.');
  const valid = (m[1] === 'image/jpeg' && buf[0] === 0xFF && buf[1] === 0xD8) ||
    (m[1] === 'image/png' && buf.slice(1, 4).toString() === 'PNG') ||
    (m[1] === 'image/webp' && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP');
  if (!valid) throw httpError(400, 'That file is not a valid image.');
  user.avatar = { mime: m[1], b64: m[2] };
  save();
  json(ctx.res, 200, { ok: true });
});

route('GET', '/api/me/avatar', async ctx => {
  const user = requireUser(ctx);
  if (!user.avatar) throw httpError(404, 'No profile photo yet.');
  ctx.res.writeHead(200, { 'Content-Type': user.avatar.mime, 'Cache-Control': 'private, no-cache' });
  ctx.res.end(Buffer.from(user.avatar.b64, 'base64'));
});

route('DELETE', '/api/me/avatar', async ctx => {
  const user = requireUser(ctx);
  delete user.avatar;
  save();
  json(ctx.res, 200, { ok: true });
});

route('POST', '/api/me/password', async ctx => {
  const user = requireUser(ctx);
  if (limited('pw:' + user.id, 5)) throw httpError(429, 'Too many attempts. Please wait a minute and try again.');
  if (!verifyPassword(String(ctx.body.current || ''), user.passHash)) throw httpError(401, 'Your current password is incorrect.');
  const next = String(ctx.body.next || '');
  if (next.length < 8) throw httpError(400, 'New password must be at least 8 characters.');
  user.passHash = hashPassword(next);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  save();
  json(ctx.res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(user) });
});

route('POST', '/api/staff/login', async ctx => {
  if (limited('stafflogin:' + clientIp(ctx.req), 6, 15 * 60 * 1000)) throw httpError(429, 'Too many attempts. Please try again in 15 minutes.');
  const email = clean(ctx.body.email, 120).toLowerCase();
  const password = String(ctx.body.password || '');
  const user = db.users.find(u => u.email === email);
  const ok = !!user && verifyPassword(password, user.passHash);
  if (!ok || !isStaff(user)) throw httpError(401, 'Incorrect email or password, or this account does not have staff access.');
  json(ctx.res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(user) });
});

/* ---------- Notifications (both student and staff) ---------- */
route('GET', '/api/notifications', async ctx => {
  const user = requireUser(ctx);
  const staff = isStaff(user);
  const items = [];
  db.announcements.forEach((a, i) => items.push({ id: 'ann-' + i, kind: 'announcement', title: a.title, body: a.body || '', createdAt: a.createdAt || '', link: '#overview' }));
  if (staff) {
    db.submissions.filter(s => s.marks == null).forEach(s => {
      const a = db.assignments.find(x => x.id === s.assignmentId);
      const u = db.users.find(x => x.id === s.userId);
      items.push({ id: 'sub-' + s.id, kind: 'submission', title: 'New submission to mark', body: (u ? u.name : 'A student') + ' submitted ' + (a ? a.title : 'an assignment'), createdAt: s.submittedAt || '', link: '#assignments' });
    });
  } else {
    const ids = db.courses.filter(c => courseAccess(user, c)).map(c => c.id);
    db.sessions.filter(s => ids.includes(s.courseId) && s.status !== 'ended').forEach(s => {
      const c = db.courses.find(x => x.id === s.courseId);
      items.push({ id: 'ses-' + s.id, kind: 'live', title: (s.status === 'live' ? 'Live now: ' : 'Class scheduled: ') + s.title, body: c ? c.title : '', createdAt: (s.status === 'live' ? (s.liveStartedAt || s.startedAt || s.updatedAt || s.createdAt) : s.createdAt) || '', link: '#live/' + s.id });
    });
    db.assignments.filter(a => ids.includes(a.courseId)).forEach(a => {
      items.push({ id: 'asg-' + a.id, kind: 'assignment', title: 'New assignment: ' + a.title, body: 'Due ' + (a.dueAt || 'no date'), createdAt: a.createdAt || '', link: '#assignments' });
    });
    db.submissions.filter(s => s.userId === user.id && s.marks != null).forEach(s => {
      const a = db.assignments.find(x => x.id === s.assignmentId);
      items.push({ id: 'grd-' + s.id, kind: 'graded', title: 'Your work was marked: ' + (a ? a.title : 'assignment'), body: s.marks + ' / ' + (a ? a.maxMarks : '') + (s.feedback ? ' · ' + s.feedback : ''), createdAt: s.gradedAt || '', link: '#assignments' });
    });
  }
  items.sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
  const seenAt = user.notificationsSeenAt || '';
  const unread = items.filter(i => i.createdAt && i.createdAt > seenAt).length;
  json(ctx.res, 200, { items: items.slice(0, 40), unread, seenAt });
});

route('POST', '/api/notifications/read', async ctx => {
  const user = requireUser(ctx);
  user.notificationsSeenAt = now(); save();
  json(ctx.res, 200, { ok: true });
});

route('POST', '/api/auth/forgot', async ctx => {
  if (limited('forgot:' + clientIp(ctx.req), 5, 15 * 60 * 1000)) throw httpError(429, 'Too many requests. Please try again in 15 minutes.');
  const email = clean(ctx.body.email, 120).toLowerCase();
  const user = db.users.find(u => u.email === email);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    db.passwordResets = db.passwordResets.filter(r => r.userId !== user.id && r.expiresAt > now());
    db.passwordResets.push({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() });
    save();
    const link = `${PUBLIC_URL}/reset-password.html#${token}`;
    try {
      await sendEmail(user.email, 'Reset your DEBONE password',
        `<p>Hi ${htmlEsc(user.name)},</p><p>Use this link to choose a new password. It expires in one hour.</p><p><a href="${link}">Reset my password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
        `Reset your DEBONE password (valid for one hour): ${link}`);
    } catch (e) { console.error('Reset email failed:', e.message); }
  }
  json(ctx.res, 200, { ok: true, message: 'If that email is registered, a reset link is on its way. Check your inbox and spam folder.' });
});

route('POST', '/api/auth/reset', async ctx => {
  if (limited('reset:' + clientIp(ctx.req), 10, 15 * 60 * 1000)) throw httpError(429, 'Too many attempts. Please try again in 15 minutes.');
  const token = String(ctx.body.token || '');
  const password = String(ctx.body.password || '');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters.');
  const rec = db.passwordResets.find(r => r.tokenHash === sha256(token) && r.expiresAt > now());
  const user = rec && db.users.find(u => u.id === rec.userId);
  if (!user) throw httpError(400, 'This reset link is invalid or has expired. Please request a new one.');
  user.passHash = hashPassword(password);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  db.passwordResets = db.passwordResets.filter(r => r.userId !== user.id);
  save();
  json(ctx.res, 200, { ok: true });
});

route('GET', '/api/me/performance', async ctx => {
  const user = requireUser(ctx);
  const subs = db.submissions.filter(x => x.userId === user.id && x.marks != null)
    .sort((a, b) => (b.gradedAt || '').localeCompare(a.gradedAt || ''));
  const rows = subs.map(x => {
    const a = db.assignments.find(y => y.id === x.assignmentId);
    const c = a && db.courses.find(y => y.id === a.courseId);
    const max = a ? a.maxMarks : 100;
    return { id: x.id, assignment: a ? a.title : 'Assignment', course: c ? c.title : '', marks: x.marks, max,
      pct: Math.round((x.marks / max) * 100), grade: gradeOf(x.marks, max), gradedAt: x.gradedAt || null, feedback: x.feedback || '' };
  });
  const avg = rows.length ? Math.round(rows.reduce((t, r) => t + r.pct, 0) / rows.length) : null;
  const counts = { distinction: rows.filter(r => r.grade.key === 'distinction').length, pass: rows.filter(r => r.grade.key === 'pass').length, fail: rows.filter(r => r.grade.key === 'fail').length };
  const byCourse = {};
  rows.forEach(r => { (byCourse[r.course] = byCourse[r.course] || []).push(r.pct); });
  const courses = Object.keys(byCourse).map(k => ({ course: k, avg: Math.round(byCourse[k].reduce((t, v) => t + v, 0) / byCourse[k].length), count: byCourse[k].length }));
  json(ctx.res, 200, {
    rows, avg, counts, courses,
    trend: rows.slice().reverse().map(r => ({ label: r.assignment, pct: r.pct, grade: r.grade.key })),
    pending: db.submissions.filter(x => x.userId === user.id && x.marks == null).length,
    best: rows.length ? Math.max(...rows.map(r => r.pct)) : null,
    latest: rows[0] || null
  });
});

route('POST', '/api/staff/courses/:id/image', async ctx => {
  requireStaff(ctx, true);
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Course not found');
  const m = String(ctx.body.data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw httpError(400, 'Please upload a JPG, PNG or WebP image.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 220 * 1024) throw httpError(400, 'That image is too large. Please use an image under 200 KB.');
  const valid = (m[1] === 'image/jpeg' && buf[0] === 0xFF && buf[1] === 0xD8) ||
    (m[1] === 'image/png' && buf.slice(1, 4).toString() === 'PNG') ||
    (m[1] === 'image/webp' && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP');
  if (!valid) throw httpError(400, 'That file is not a valid image.');
  c.image = { mime: m[1], b64: m[2] };
  save();
  json(ctx.res, 200, { ok: true });
});

route('DELETE', '/api/staff/courses/:id/image', async ctx => {
  requireStaff(ctx, true);
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Course not found');
  delete c.image; save();
  json(ctx.res, 200, { ok: true });
});

route('GET', '/api/courses/:id/image', async ctx => {
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c || !c.image) throw httpError(404, 'No image for this course.');
  ctx.res.writeHead(200, { 'Content-Type': c.image.mime, 'Cache-Control': 'no-cache' });
  ctx.res.end(Buffer.from(c.image.b64, 'base64'));
});

/* ---------- Site settings (edited by admins, shown on every page) ---------- */
route('GET', '/api/settings', async ctx => {
  json(ctx.res, 200, { settings: Object.assign({}, SETTINGS_DEFAULTS, db.settings) });
});
route('PUT', '/api/staff/settings', async ctx => {
  requireStaff(ctx, true);
  const b = ctx.body, out = {};
  Object.keys(SETTINGS_DEFAULTS).forEach(k => {
    if (b[k] === undefined) return;
    if (typeof SETTINGS_DEFAULTS[k] === 'boolean') out[k] = !!b[k];
    else out[k] = clean(b[k], k === 'address' || k === 'hours' || k === 'announcement' ? 240 : 120);
  });
  const phoneOk = v => v === '' || /^[+0-9 ()-]{7,20}$/.test(v);
  if (!phoneOk(out.phone1 || '') || !phoneOk(out.phone2 || '')) throw httpError(400, 'Please enter valid phone numbers.');
  if (out.whatsapp !== undefined && out.whatsapp !== '' && !/^\d{10,15}$/.test(out.whatsapp)) throw httpError(400, 'WhatsApp number must be digits with the country code, for example 2348035988889.');
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw httpError(400, 'Please enter a valid email address.');
  db.settings = Object.assign({}, SETTINGS_DEFAULTS, db.settings || {}, out);
  save();
  json(ctx.res, 200, { settings: db.settings });
});

/* ---------- Health and set-up status (for the admin and the hosting provider) ---------- */
route('GET', '/api/health', async ctx => { json(ctx.res, 200, { ok: true, time: now() }); });
route('GET', '/api/staff/status', async ctx => {
  requireStaff(ctx, true);
  let lastBackup = null;
  try { const f = (await store.listFiles('backups'))[0]; if (f) lastBackup = f.at; } catch (e) { /* storage not reachable */ }
  const checks = [
    { key: 'paystack', label: 'Online payments (Paystack secret key)', ok: !!process.env.PAYSTACK_SECRET_KEY, fix: 'Add PAYSTACK_SECRET_KEY to server/.env, then set the Paystack webhook URL to PUBLIC_URL/api/paystack/webhook.' },
    { key: 'mail', label: 'Email for password resets and newsletter', ok: !!process.env.RESEND_API_KEY, fix: 'Create a Resend account, add RESEND_API_KEY and MAIL_FROM to server/.env.' },
    { key: 'google', label: 'Sign in with Google', ok: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), fix: 'Create a Google OAuth client and add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' },
    { key: 'storage', label: 'Database and file storage (Supabase)', ok: SUPABASE, fix: 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the hosting settings.' },
    { key: 'https', label: 'Site address uses HTTPS', ok: /^https:\/\//.test(PUBLIC_URL), fix: 'Set PUBLIC_URL to your https:// address and COOKIE_SECURE=true.' },
    { key: 'admin', label: 'At least one admin account', ok: db.users.some(u => u.role === 'admin'), fix: 'Create an admin with: node server/server.js --create-admin email "password" "Name".' },
    { key: 'settings', label: 'Business details reviewed in Site settings', ok: !!(db.settings && db.settings.phone1 && db.settings.address), fix: 'Open Site settings and check phone numbers, WhatsApp and address.' },
    { key: 'backup', label: 'A recent backup exists', ok: !!lastBackup, fix: 'Use Create backup on this page, then download it regularly.' },
    { key: 'courses', label: 'Every open paid course has an instructor, start date and schedule',
      ok: db.courses.filter(c => c.price > 0 && !c.comingSoon).every(c => c.instructor && c.startDate && c.schedule),
      fix: 'Open each paid course in Courses & lessons and fill in the instructor, start date and class schedule.' }
  ];
  json(ctx.res, 200, { checks, ready: checks.every(c => c.ok), lastBackup, publicUrl: PUBLIC_URL,
    counts: { students: db.users.filter(u => u.role === 'student').length, courses: db.courses.length, products: db.products.length, works: db.works.length, subscribers: (db.newsletter || []).length } });
});
route('POST', '/api/staff/backup', async ctx => {
  requireStaff(ctx, true);
  const name = 'db-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  await store.putFile('backups/' + name, Buffer.from(JSON.stringify(db)), 'application/json');
  try { const old = (await store.listFiles('backups')).slice(30); await store.deleteFiles(old.map(f => 'backups/' + f.name)); } catch (e) { /* keep going */ }
  json(ctx.res, 200, { ok: true, name });
});
route('GET', '/api/staff/backup/download', async ctx => {
  requireStaff(ctx, true);
  const body = Buffer.from(JSON.stringify(db, null, 2));
  ctx.res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="debone-backup-' + new Date().toISOString().slice(0, 10) + '.json"', 'Cache-Control': 'no-store' });
  ctx.res.end(body);
});

/* ---------- Services (what we do): create, edit, delete, images ---------- */
function serviceView(sv, index) {
  return { id: sv.id, number: index + 1, title: sv.title, summary: sv.summary || '', description: sv.description || '',
    image: sv.imageData ? `/api/services/${sv.id}/image?v=${encodeURIComponent(sv.updatedAt)}` : (sv.imageUrl || null), hasImage: !!sv.imageData };
}
function orderedServices() { return db.services.slice().sort((a, b) => (a.order || 0) - (b.order || 0)); }
route('GET', '/api/services', async ctx => {
  json(ctx.res, 200, { services: orderedServices().map((sv, i) => serviceView(sv, i)) });
});
route('GET', '/api/services/:id', async ctx => {
  const list = orderedServices();
  const i = list.findIndex(x => x.id === ctx.params.id);
  if (i < 0) throw httpError(404, 'Service not found');
  json(ctx.res, 200, { service: serviceView(list[i], i), related: list.filter(x => x.id !== list[i].id).slice(0, 3).map(x => serviceView(x, list.indexOf(x))) });
});
route('GET', '/api/services/:id/image', async ctx => {
  const sv = db.services.find(x => x.id === ctx.params.id);
  if (!sv || !sv.imageData) throw httpError(404, 'No image');
  ctx.res.writeHead(200, { 'Content-Type': sv.imageData.mime, 'Cache-Control': 'no-cache' });
  ctx.res.end(Buffer.from(sv.imageData.b64, 'base64'));
});
function serviceInput(b) {
  const title = clean(b.title, 120);
  if (title.length < 2) throw httpError(400, 'Please enter the service name.');
  return { title, summary: clean(b.summary, 220), description: clean(b.description, 3000) };
}
route('POST', '/api/staff/services', async ctx => {
  requireStaff(ctx, true);
  const input = serviceInput(ctx.body);
  let id = slugify(input.title), n = 2;
  while (db.services.some(x => x.id === id)) id = slugify(input.title) + '-' + n++;
  const order = db.services.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;
  const sv = Object.assign({ id, order, imageUrl: null, imageData: null, createdAt: now(), updatedAt: now() }, input);
  if (ctx.body.data) sv.imageData = validImage(ctx.body.data);
  db.services.push(sv); save();
  json(ctx.res, 201, { service: serviceView(sv, orderedServices().indexOf(sv)) });
});
route('PATCH', '/api/staff/services/:id', async ctx => {
  requireStaff(ctx, true);
  const sv = db.services.find(x => x.id === ctx.params.id);
  if (!sv) throw httpError(404, 'Service not found');
  Object.assign(sv, serviceInput(ctx.body), { updatedAt: now() });
  save();
  json(ctx.res, 200, { service: serviceView(sv, orderedServices().indexOf(sv)) });
});
route('POST', '/api/staff/services/:id/move', async ctx => {
  requireStaff(ctx, true);
  const list = orderedServices();
  const i = list.findIndex(x => x.id === ctx.params.id);
  const j = i + (ctx.body.direction === 'up' ? -1 : 1);
  if (i < 0) throw httpError(404, 'Service not found');
  if (j >= 0 && j < list.length) { const oa = list[i].order, ob = list[j].order; list[i].order = ob; list[j].order = oa; save(); }
  json(ctx.res, 200, { ok: true });
});
route('DELETE', '/api/staff/services/:id', async ctx => {
  requireStaff(ctx, true);
  db.services = db.services.filter(x => x.id !== ctx.params.id);
  save();
  json(ctx.res, 200, { ok: true });
});
route('POST', '/api/staff/services/:id/image', async ctx => {
  requireStaff(ctx, true);
  const sv = db.services.find(x => x.id === ctx.params.id);
  if (!sv) throw httpError(404, 'Service not found');
  sv.imageData = validImage(ctx.body.data); sv.imageUrl = null; sv.updatedAt = now(); save();
  json(ctx.res, 200, { ok: true });
});
route('DELETE', '/api/staff/services/:id/image', async ctx => {
  requireStaff(ctx, true);
  const sv = db.services.find(x => x.id === ctx.params.id);
  if (!sv) throw httpError(404, 'Service not found');
  sv.imageData = null; sv.imageUrl = null; sv.updatedAt = now(); save();
  json(ctx.res, 200, { ok: true });
});

/* ---------- Assistant: answers questions in the student dashboard ---------- */
const GUIDES = [
  { id: 'enrol', q: ['enrol', 'enroll', 'sign up for a course', 'join a course', 'buy a course', 'pay for a course', 'how do i get a course'],
    a: 'To enrol: open Browse courses in the menu, choose a course and press Enrol. Free courses open straight away. Paid courses take you to Paystack’s secure payment page. Once payment succeeds, the course unlocks on your screen by itself.' },
  { id: 'payment', q: ['payment', 'paid', 'paystack', 'unlock', 'locked', 'not unlocked', 'money deducted', 'debited', 'payment failed'],
    a: 'Payments are checked on our server, so the course unlocks as soon as Paystack confirms the payment, even if you close the page. Check Payments in the menu to see the status of each payment. If you were debited but the course is still locked after a few minutes, send us the payment reference on WhatsApp and we will fix it.' },
  { id: 'coupon', q: ['coupon', 'discount', '30%', 'promo', 'promo code', 'voucher'],
    a: 'Your 30% coupon appears on the Overview page after you subscribe to the newsletter with your account email. Press Enrol on a course, paste the code in the box (or press Use it), and the price is reduced at checkout. Each coupon works once.' },
  { id: 'assignment', q: ['assignment', 'submit', 'homework', 'upload my work', 'send my work', 'submission'],
    a: 'Open Assignments in the menu. Press Submit on the assignment, write your answer or paste a link to your work (Google Drive or YouTube), then press Submit assignment. You can update your work until your instructor marks it.' },
  { id: 'grades', q: ['grade', 'marks', 'result', 'fail', 'pass', 'distinction', 'score'],
    a: 'Results are shown in colour: red means Fail (below 50%), green means Pass (50% to 74%), and gold means Distinction (75% and above). Open View result on a marked assignment to see your marks and your instructor’s feedback.' },
  { id: 'performance', q: ['performance', 'progress', 'improve', 'how am i doing', 'track'],
    a: 'Open Performance in the menu. It shows your average score, your best score, a chart of each marked assignment, your results by course, and a tip for your next step.' },
  { id: 'profile', q: ['profile', 'photo', 'picture', 'avatar', 'account details', 'personal details', 'complete my profile'],
    a: 'Open Profile in the menu. Add your photo and your details (date of birth, gender, state, city, education, learning goals and an emergency contact). The percentage shows how complete your profile is, and the list shows what is still needed.' },
  { id: 'password', q: ['password', 'forgot', 'reset', 'can not log in', 'cannot log in', 'login problem', 'log in'],
    a: 'If you forgot your password, use Forgot password on the login page. We email you a link that works for one hour. Check your spam folder if it does not arrive within a few minutes. You can also change your password from Profile when you are logged in.' },
  { id: 'live', q: ['live', 'live class', 'class', 'zoom', 'meet', 'youtube', 'recording', 'video room'],
    a: 'Open Live classes in the menu. Your instructor schedules each class there, with the join link and the time. Use the class chat to ask questions during a live session, and watch past recordings from the same page.' },
  { id: 'notifications', q: ['notification', 'notice', 'bell', 'alert', 'popup', 'pop up'],
    a: 'New announcements, live classes, assignments and marks appear as a pop-up in the top right corner, and in the bell icon at the top. Click a pop-up to go straight to it.' },
  { id: 'tour', q: ['tour', 'tutorial', 'how to use', 'how do i use', 'guide me', 'show me around'],
    a: 'Press Take a tour at the top of the dashboard. It walks you through every part of the dashboard in about a minute, and you can start it again at any time.' },
  { id: 'price', q: ['price', 'cost', 'how much', 'fee', 'naira', '₦'],
    a: 'Each course shows its price on the Browse courses page. Free courses show Free. Courses marked Coming soon are not open for enrolment yet. Shop prices are on the Shop page, and some products are priced on request.' },
  { id: 'refund', q: ['refund', 'money back', 'cancel'],
    a: 'Refunds follow our refund policy, which is linked in the footer of the website. For a refund request, contact us on WhatsApp with your name, your account email and the payment reference.' },
  { id: 'contact', q: ['contact', 'phone', 'whatsapp', 'call', 'speak to', 'human', 'support', 'agent', 'staff', 'address', 'where are you', 'hours', 'open'],
    a: 'You can reach the studio on WhatsApp or by phone, or visit us. Use the button below to message us on WhatsApp, and include your account email so we can find your account quickly.' },
  { id: 'hello', q: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'thanks', 'thank you'],
    a: 'Hello, and welcome. I can help with enrolling, payments, coupons, assignments, results, your profile, live classes and passwords. What would you like help with?' }
];
function guideAnswer(text) {
  const t = String(text || '').toLowerCase();
  let best = null, score = 0;
  GUIDES.forEach(g => {
    const hits = g.q.filter(k => t.includes(k)).length;
    if (hits > score) { score = hits; best = g; }
  });
  return best;
}
function studentContext(user) {
  const enrolled = db.enrollments.filter(e => e.userId === user.id && e.status === 'active').map(e => {
    const c = db.courses.find(x => x.id === e.courseId); return c ? c.title : null;
  }).filter(Boolean);
  const payments = db.payments.filter(p => p.userId === user.id);
  const pending = db.submissions.filter(x => x.userId === user.id && x.marks == null).length;
  return { name: user.name, enrolled, paymentsSuccessful: payments.filter(p => p.status === 'success').length,
    paymentsPending: payments.filter(p => p.status === 'pending').length, profileComplete: completion(user).percent,
    profileMissing: completion(user).missing, awaitingMarks: pending, coupon: couponFor(user) ? true : false };
}
route('POST', '/api/chat', async ctx => {
  const user = requireUser(ctx);
  if (limited('chat:' + user.id, 40, 10 * 60 * 1000)) throw httpError(429, 'You are sending messages very quickly. Please wait a few minutes and try again.');
  const input = Array.isArray(ctx.body.messages) ? ctx.body.messages.slice(-10) : [];
  const messages = input.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 1200) }));
  const last = messages.filter(m => m.role === 'user').pop();
  if (!last) throw httpError(400, 'Please type your question.');
  const settings = Object.assign({}, SETTINGS_DEFAULTS, db.settings);
  const whatsapp = 'https://wa.me/' + String(settings.whatsapp || '2348035988889').replace(/\D/g, '');
  const sug = ['How do I enrol?', 'My payment went through but the course is locked', 'How do I submit an assignment?', 'What do the grade colours mean?'];
  if (process.env.ANTHROPIC_API_KEY) {
    const courses = db.courses.map(c => `- ${c.title}: ${c.free ? 'free' : '₦' + c.price}${c.comingSoon ? ' (coming soon, not open yet)' : ''}${c.liveLabel ? ' · ' + c.liveLabel : ''}`).join('\n');
    const system = [
      `You are the friendly support assistant inside the student dashboard of ${settings.businessName}, a photography, video, printing and computer services studio in Port Harcourt, Nigeria, with an online academy.`,
      'Answer in clear, short, friendly English. Use simple steps when explaining how to do something. Never invent prices, dates or policies that are not listed here.',
      'For payment problems, refunds, account-specific issues you cannot check, or anything needing a person, say so and suggest contacting the studio on WhatsApp.',
      'Never ask for or repeat passwords or card details. Never reveal other students’ information.',
      `Studio contact: phones ${settings.phone1}, ${settings.phone2}; WhatsApp ${settings.whatsapp}; ${settings.address}; hours: ${settings.hours}.`,
      'Courses:\n' + courses,
      'Dashboard guide: Browse courses to enrol; Payments shows payment status; Assignments to submit work and see results (red Fail below 50%, green Pass 50 to 74%, gold Distinction 75% and above); Performance shows progress; Live classes; Profile for photo and details; Take a tour button; bell for notifications; coupons for newsletter subscribers are entered at checkout.',
      'This student: ' + JSON.stringify(studentContext(user))
    ].join('\n');
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.CHAT_MODEL || 'claude-3-5-haiku-latest', max_tokens: 700, system, messages })
      });
      const data = await r.json();
      const reply = data.content && data.content.find(b => b.type === 'text');
      if (r.ok && reply) return json(ctx.res, 200, { reply: reply.text, source: 'ai', suggestions: sug, handoff: whatsapp });
      console.error('Assistant provider error:', r.status);
    } catch (e) { console.error('Assistant provider failed:', e.message); }
  }
  const g = guideAnswer(last.content);
  const reply = g ? g.a : 'I can help with enrolling, payments, coupons, assignments, results, your profile, live classes and passwords. If your question is about something else, message the studio on WhatsApp and a person will reply.';
  json(ctx.res, 200, { reply, source: g ? 'guide' : 'fallback', suggestions: sug, handoff: whatsapp });
});

/* ============ Feedback and suggestions ============ */
route('POST', '/api/feedback', async ctx => {
  if (limited('feedback:' + clientIp(ctx.req), 5, 15 * 60 * 1000)) throw httpError(429, 'Too many messages. Please try again later.');
  const b = ctx.body;
  const message = clean(b.message, 2000);
  if (message.length < 10) throw httpError(400, 'Please write a little more so we understand your suggestion.');
  const email = clean(b.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Please enter a valid email address.');
  const cats = ['Feature idea', 'New course', 'Improvement', 'Problem with the website', 'Other'];
  const category = cats.includes(b.category) ? b.category : 'Other';
  const f = { id: uid(8), name: clean(b.name, 80) || 'Anonymous', email, category, message, status: 'new', note: '', createdAt: now() };
  db.feedback.push(f); save();
  json(ctx.res, 201, { ok: true, message: 'Thank you. Your suggestion has been sent to the DEBONE team.' });
});
route('GET', '/api/staff/feedback', async ctx => {
  requireStaff(ctx);
  json(ctx.res, 200, { feedback: db.feedback.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});
route('PATCH', '/api/staff/feedback/:id', async ctx => {
  requireStaff(ctx);
  const f = db.feedback.find(x => x.id === ctx.params.id);
  if (!f) throw httpError(404, 'Feedback not found');
  const st = ['new', 'reviewing', 'planned', 'done', 'declined'];
  if (ctx.body.status !== undefined) { if (!st.includes(ctx.body.status)) throw httpError(400, 'Invalid status.'); f.status = ctx.body.status; }
  if (ctx.body.note !== undefined) f.note = clean(ctx.body.note, 500);
  save(); json(ctx.res, 200, { ok: true });
});

/* ============ Instructor applications ============ */
route('POST', '/api/instructor-applications', async ctx => {
  if (limited('apply:' + clientIp(ctx.req), 3, 60 * 60 * 1000)) throw httpError(429, 'You have sent several applications recently. Please try again later.');
  const b = ctx.body;
  const fullName = clean(b.fullName, 100);
  const email = clean(b.email, 120).toLowerCase();
  if (fullName.length < 3) throw httpError(400, 'Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Please enter a valid email address.');
  const expertise = clean(b.expertise, 120);
  const proposedCourse = clean(b.proposedCourse, 160);
  if (!expertise || !proposedCourse) throw httpError(400, 'Please tell us your area of expertise and the course you would like to teach.');
  const portfolio = clean(b.portfolio, 300);
  if (portfolio && !/^https?:\/\//i.test(portfolio)) throw httpError(400, 'The portfolio link must start with http:// or https://');
  const a = { id: uid(8), fullName, email, phone: clean(b.phone, 20), expertise, experience: clean(b.experience, 1000),
    portfolio, proposedCourse, availability: clean(b.availability, 300), status: 'new', note: '', createdAt: now() };
  db.applications.push(a); save();
  json(ctx.res, 201, { ok: true, message: 'Thank you. We review every application and will reply by email.' });
});
route('GET', '/api/staff/applications', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { applications: db.applications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});
route('PATCH', '/api/staff/applications/:id', async ctx => {
  requireStaff(ctx, true);
  const a = db.applications.find(x => x.id === ctx.params.id);
  if (!a) throw httpError(404, 'Application not found');
  const st = ['new', 'under_review', 'approved', 'declined'];
  if (ctx.body.status !== undefined) { if (!st.includes(ctx.body.status)) throw httpError(400, 'Invalid status.'); a.status = ctx.body.status; }
  if (ctx.body.note !== undefined) a.note = clean(ctx.body.note, 800);
  save(); json(ctx.res, 200, { ok: true });
});

/* ============ Webinars ============ */
function webinarView(w, user) {
  const regs = db.webinarRegistrations.filter(r => r.webinarId === w.id);
  const mine = user ? regs.find(r => r.userId === user.id) : null;
  return { id: w.id, title: w.title, description: w.description, instructor: w.instructor || '', startsAt: w.startsAt,
    durationMinutes: w.durationMinutes || 60, capacity: w.capacity || null, registered: regs.length,
    seatsLeft: w.capacity ? Math.max(0, w.capacity - regs.length) : null,
    past: new Date(w.startsAt).getTime() < Date.now(), registered_by_me: !!mine,
    link: mine ? (w.link || '') : '' };
}
route('GET', '/api/webinars', async ctx => {
  json(ctx.res, 200, { webinars: db.webinars.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(w => webinarView(w, ctx.user)) });
});
route('POST', '/api/webinars/:id/register', async ctx => {
  const user = requireUser(ctx);
  const w = db.webinars.find(x => x.id === ctx.params.id);
  if (!w) throw httpError(404, 'Webinar not found');
  if (new Date(w.startsAt).getTime() < Date.now()) throw httpError(400, 'This webinar has already taken place.');
  if (db.webinarRegistrations.some(r => r.webinarId === w.id && r.userId === user.id)) return json(ctx.res, 200, { ok: true, already: true });
  const count = db.webinarRegistrations.filter(r => r.webinarId === w.id).length;
  if (w.capacity && count >= w.capacity) throw httpError(403, 'This webinar is full.');
  db.webinarRegistrations.push({ id: uid(8), webinarId: w.id, userId: user.id, name: user.name, email: user.email, createdAt: now() });
  save();
  notify(user.id, 'You are registered', w.title + '\nStarts ' + new Date(w.startsAt).toLocaleString('en-GB'), '#overview', { kind: 'live' });
  json(ctx.res, 201, { ok: true, link: w.link || '' });
});
route('GET', '/api/staff/webinars', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { webinars: db.webinars.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(w => Object.assign(webinarView(w, null), { link: w.link || '' })) });
});
function webinarInput(b) {
  const title = clean(b.title, 120);
  if (title.length < 3) throw httpError(400, 'Give the webinar a title.');
  const when = new Date(b.startsAt);
  if (!b.startsAt || isNaN(when)) throw httpError(400, 'Choose the date and time of the webinar.');
  const capacity = b.capacity === '' || b.capacity == null ? null : Math.round(Number(b.capacity));
  if (capacity !== null && (!Number.isFinite(capacity) || capacity < 1)) throw httpError(400, 'Capacity must be a number of 1 or more, or left empty.');
  const link = clean(b.link, 300);
  if (link && !/^https?:\/\//i.test(link)) throw httpError(400, 'The join link must start with http:// or https://');
  return { title, description: clean(b.description, 1500), instructor: clean(b.instructor, 120), startsAt: when.toISOString(),
    durationMinutes: Math.max(10, Math.min(480, Math.round(Number(b.durationMinutes) || 60))), capacity, link };
}
route('POST', '/api/staff/webinars', async ctx => {
  requireStaff(ctx, true);
  const w = Object.assign({ id: uid(8), createdAt: now() }, webinarInput(ctx.body));
  db.webinars.push(w); save();
  json(ctx.res, 201, { ok: true });
});
route('PATCH', '/api/staff/webinars/:id', async ctx => {
  requireStaff(ctx, true);
  const w = db.webinars.find(x => x.id === ctx.params.id);
  if (!w) throw httpError(404, 'Webinar not found');
  Object.assign(w, webinarInput(ctx.body));
  save(); json(ctx.res, 200, { ok: true });
});
route('DELETE', '/api/staff/webinars/:id', async ctx => {
  requireStaff(ctx, true);
  db.webinars = db.webinars.filter(x => x.id !== ctx.params.id);
  db.webinarRegistrations = db.webinarRegistrations.filter(r => r.webinarId !== ctx.params.id);
  save(); json(ctx.res, 200, { ok: true });
});
route('GET', '/api/staff/webinars/:id/registrants', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { registrants: db.webinarRegistrations.filter(r => r.webinarId === ctx.params.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
});

/* ============ Course reviews (students rate; the team approves) ============ */
function ratingFor(courseId) {
  const rs = db.reviews.filter(r => r.courseId === courseId && r.status === 'approved');
  return { avg: rs.length ? Math.round((rs.reduce((t, r) => t + r.rating, 0) / rs.length) * 10) / 10 : null, count: rs.length };
}
route('GET', '/api/courses/:id/reviews', async ctx => {
  const list = db.reviews.filter(r => r.courseId === ctx.params.id && r.status === 'approved')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(r => ({ id: r.id, rating: r.rating, text: r.text, name: r.name, createdAt: r.createdAt }));
  json(ctx.res, 200, Object.assign({ reviews: list }, ratingFor(ctx.params.id)));
});
route('GET', '/api/me/reviews', async ctx => {
  const user = requireUser(ctx);
  json(ctx.res, 200, { reviews: db.reviews.filter(r => r.userId === user.id).map(r => ({ id: r.id, courseId: r.courseId, rating: r.rating, text: r.text, status: r.status, createdAt: r.createdAt })) });
});
route('POST', '/api/courses/:id/reviews', async ctx => {
  const user = requireUser(ctx);
  const course = db.courses.find(c => c.id === ctx.params.id);
  if (!course) throw httpError(404, 'Course not found');
  if (!courseAccess(user, course)) throw httpError(403, 'You can review a course once you are enrolled in it.');
  const rating = Math.round(Number(ctx.body.rating));
  if (!(rating >= 1 && rating <= 5)) throw httpError(400, 'Choose a rating from 1 to 5 stars.');
  const text = clean(ctx.body.text, 600);
  if (text.length < 10) throw httpError(400, 'Please write a few words about the course.');
  if (db.reviews.some(r => r.courseId === course.id && r.userId === user.id)) throw httpError(400, 'You have already reviewed this course.');
  db.reviews.push({ id: uid(8), courseId: course.id, userId: user.id, name: user.name.split(' ')[0] + (user.name.split(' ')[1] ? ' ' + user.name.split(' ')[1][0] + '.' : ''), rating, text, status: 'pending', createdAt: now() });
  save();
  json(ctx.res, 201, { ok: true, message: 'Thank you. Your review will appear once our team has checked it.' });
});
route('GET', '/api/staff/reviews', async ctx => {
  requireStaff(ctx);
  json(ctx.res, 200, { reviews: db.reviews.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => ({ ...r, courseTitle: (db.courses.find(c => c.id === r.courseId) || {}).title || '' })) });
});
route('PATCH', '/api/staff/reviews/:id', async ctx => {
  requireStaff(ctx);
  const r = db.reviews.find(x => x.id === ctx.params.id);
  if (!r) throw httpError(404, 'Review not found');
  if (!['approved', 'rejected', 'pending'].includes(ctx.body.status)) throw httpError(400, 'Invalid status.');
  r.status = ctx.body.status; save(); json(ctx.res, 200, { ok: true });
});
route('DELETE', '/api/staff/reviews/:id', async ctx => {
  requireStaff(ctx);
  db.reviews = db.reviews.filter(x => x.id !== ctx.params.id); save(); json(ctx.res, 200, { ok: true });
});

/* ============ Certificates ============ */
function courseProgress(user, course) {
  const lessonIds = course.lessons.map(l => l.id);
  const done = new Set(course.lessons.filter(l => validLessonCompletion(user, course, l)).map(l => l.id));
  const lessonsDone = lessonIds.filter(id => done.has(id)).length;
  const graded = db.assignments.filter(a => a.courseId === course.id).map(a => {
    const s = db.submissions.find(x => x.assignmentId === a.id && x.userId === user.id);
    return { a, s, passed: !!s && s.marks != null && (s.marks / a.maxMarks) >= 0.5 };
  });
  const missing = [];
  if (lessonsDone < lessonIds.length) missing.push((lessonIds.length - lessonsDone) + ' lesson(s) still to finish');
  graded.forEach(g => {
    if (!g.s) missing.push('Submit "' + g.a.title + '"');
    else if (g.s.marks == null) missing.push('Waiting for marks: "' + g.a.title + '"');
    else if (!g.passed) missing.push('Reach 50% or more in "' + g.a.title + '"');
  });
  const complete = lessonIds.length > 0 && missing.length === 0;
  return { complete, lessonsDone, lessonsTotal: lessonIds.length, missing };
}
function ensureCertificates() { /* certificates are issued only after the team approves a request */ }
route('GET', '/api/me/certificates', async ctx => {
  const user = requireUser(ctx);
  const progress = db.courses.filter(c => courseAccess(user, c)).map(c => Object.assign({ courseId: c.id, courseTitle: c.title }, courseProgress(user, c)));
  const requests = db.certRequests.filter(r => r.userId === user.id).map(r => ({ id: r.id, courseId: r.courseId, status: r.status, reason: r.reason || '', createdAt: r.createdAt }));
  json(ctx.res, 200, { certificates: db.certificates.filter(c => c.userId === user.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)), progress, requests });
});
route('GET', '/api/certificates/verify', async ctx => {
  const code = clean(ctx.query.get('code'), 40).toUpperCase();
  const c = code && db.certificates.find(x => x.code === code);
  json(ctx.res, 200, c ? { valid: true, code: c.code, studentName: c.studentName, courseTitle: c.courseTitle, issuedAt: c.issuedAt } : { valid: false });
});
route('GET', '/api/staff/certificates', async ctx => {
  requireStaff(ctx);
  json(ctx.res, 200, { certificates: db.certificates.slice().sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)) });
});

/* ============ Certificate as a PDF ============ */
/* Recordings library: late registrants can watch every recorded class of a course they are enrolled in, until the replay window closes */
/* ============ Live classes: check-in and reminders ============ */
route('POST', '/api/sessions/:id/attend', async ctx => {
  const user = requireUser(ctx);
  const s = db.sessions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Class not found');
  const course = db.courses.find(c => c.id === s.courseId);
  if (!course || !courseAccess(user, course)) throw httpError(403, 'Enrol in this course to check in.');
  const t = sessionTiming(s, user);
  if (!(t.joinOpen || t.liveOpen)) throw httpError(400, 'Check-in opens 15 minutes before the class starts.');
  if (!db.attendance.some(a => a.sessionId === s.id && a.userId === user.id)) {
    db.attendance.push({ id: uid(8), sessionId: s.id, userId: user.id, at: now(), how: 'live' }); save();
  }
  json(ctx.res, 200, { ok: true, attended: true });
});
/* Release the Zoom link only after a fresh enrollment and join-window check.
   Zoom Basic still relies on Waiting Room/manual identity verification. */
route('GET', '/api/sessions/:id/join', async ctx => {
  const user = requireUser(ctx);
  const s = db.sessions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Class not found');
  const course = db.courses.find(c => c.id === s.courseId);
  if (!course || !courseAccess(user, course)) throw httpError(403, 'Paid course enrollment is required.');
  if (!user.zoomName || !String(user.zoomName).trim()) throw httpError(403, 'Register your Zoom display name in My Courses before joining the live class.');
  if (!s.joinUrl || !/^https:\/\/(?:[a-z0-9-]+\.)?zoom\.us\//i.test(s.joinUrl)) throw httpError(400, 'A valid Zoom meeting link has not been configured.');
  if (s.status === 'ended' || !sessionTiming(s, user).joinOpen) throw httpError(403, 'The Zoom classroom is not open yet.');
  ctx.res.setHeader('Cache-Control', 'no-store');
  json(ctx.res, 200, { url: s.joinUrl });
});
/* A student who missed the live class opens the recording: that counts as doing the class */
route('POST', '/api/sessions/:id/watched', async ctx => {
  const user = requireUser(ctx);
  const s = db.sessions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Class not found');
  const course = db.courses.find(c => c.id === s.courseId);
  if (!course || !courseAccess(user, course)) throw httpError(403, 'Enrol in this course to watch the recording.');
  if (!(s.r2RecordingKey || s.recordingUrl) || !replayOpen(s)) throw httpError(400, 'The recording is not available yet.');
  if (!sessionEnded(s)) throw httpError(400, 'The recording opens once the live class has ended.');
  if (!db.attendance.some(a => a.sessionId === s.id && a.userId === user.id)) {
    db.attendance.push({ id: uid(8), sessionId: s.id, userId: user.id, at: now(), how: 'recording' }); save();
  }
  json(ctx.res, 200, { ok: true, message: 'Recording access verified.' });
});
route('GET', '/api/staff/sessions/:id/attendance', async ctx => {
  requireStaff(ctx);
  json(ctx.res, 200, { count: db.attendance.filter(a => a.sessionId === ctx.params.id).length,
    students: db.attendance.filter(a => a.sessionId === ctx.params.id).map(a => (db.users.find(u => u.id === a.userId) || {}).name || '') });
});

/* ============ Lesson notes (private to each student) ============ */
route('PUT', '/api/lessons/:id/note', async ctx => {
  const user = requireUser(ctx);
  const entry = findLesson(ctx.params.id);
  if (!entry || !courseAccess(user, entry.course)) throw httpError(403, 'Enrol in this course to take notes.');
  const text = clean(ctx.body.text, 4000);
  let n = db.notes.find(x => x.userId === user.id && x.lessonId === entry.lesson.id);
  if (!n) { n = { id: uid(8), userId: user.id, lessonId: entry.lesson.id, text: '', updatedAt: now() }; db.notes.push(n); }
  n.text = text; n.updatedAt = now();
  save(); json(ctx.res, 200, { ok: true, savedAt: n.updatedAt });
});
/* Staff-only R2 diagnostic: checks connectivity and bucket authorization without exposing credentials. */
route('GET', '/api/staff/r2-diagnostics', async ctx => {
  requireStaff(ctx);
  if (!r2Ready()) return json(ctx.res, 200, { configured: false, serverReachable: false, issue: 'Missing one or more R2 environment variables in Vercel.' });
  try {
    await r2().send(new HeadBucketCommand({ Bucket: R2_BUCKET }));
    json(ctx.res, 200, { configured: true, serverReachable: true, issue: null });
  } catch (e) {
    const status = e?.$metadata?.httpStatusCode || null;
    const name = String(e?.name || 'UnknownError').slice(0, 60);
    const code = String(e?.code || e?.cause?.code || '').slice(0, 50);
    // Avoid leaking S3 signed URLs, keys, or credential values in diagnostics.
    const issue = status === 403 ? 'R2 rejected bucket access (403). Check token permissions and bucket scope.'
      : status === 404 ? 'R2 bucket not found (404). Check bucket name and account ID.'
      : code === 'ENOTFOUND' ? 'R2 hostname could not be resolved from Vercel (ENOTFOUND).'
      : code === 'ETIMEDOUT' || code === 'ECONNRESET' ? 'Vercel network connection to R2 failed (' + code + ').'
      : 'R2 request failed: ' + name + (code ? ' [' + code + ']' : '') + (status ? ' HTTP ' + status : '') + '.';
    json(ctx.res, 200, { configured: true, serverReachable: false, status, issue });
  }
});
/* R2 direct browser uploads: MP4 bytes go to private R2, never through the app's JSON request body. */
route('POST', '/api/staff/sessions/:id/r2-upload', async ctx => {
  requireStaff(ctx);
  const s = db.sessions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Class not found.');
  const size = Number(ctx.body.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > 2 * 1024 ** 3) throw httpError(400, 'MP4 must be smaller than 2 GB.');
  if (!/\.mp4$/i.test(String(ctx.body.filename || ''))) throw httpError(400, 'Choose an MP4 video.');
  const key = `recordings/${s.id}/${crypto.randomUUID()}.mp4`;
  const url = await getSignedUrl(r2(), new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: 'video/mp4' }), { expiresIn: 600 });
  json(ctx.res, 200, { url, key, contentType: 'video/mp4', maxBytes: 2 * 1024 ** 3 });
});
route('POST', '/api/staff/sessions/:id/r2-publish', async ctx => {
  requireStaff(ctx);
  const s = db.sessions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Class not found.');
  const key = String(ctx.body.key || '');
  if (!key.startsWith(`recordings/${s.id}/`) || !/^recordings\/[^/]+\/[0-9a-f-]{36}\.mp4$/.test(key)) throw httpError(400, 'Invalid upload identifier.');
  const head = await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  if (!head.ContentLength || head.ContentLength > 2 * 1024 ** 3 || head.ContentType !== 'video/mp4') throw httpError(400, 'Uploaded video could not be verified.');
  s.r2RecordingKey = key;
  s.recordingUrl = ''; // remove old YouTube recording URL; private R2 takes precedence
  s.recordingPublishedAt = now();
  save();
  json(ctx.res, 200, { ok: true, recordingAvailable: true });
});
route('GET', '/api/me/recordings', async ctx => {
  const user = requireUser(ctx);
  const sessions = db.sessions.filter(s => {
    const course = db.courses.find(c => c.id === s.courseId);
    return course && courseAccess(user, course);
  }).sort((a, b) => (b.startsAt || '').localeCompare(a.startsAt || ''));
  json(ctx.res, 200, { recordings: sessions.map(s => {
    const course = db.courses.find(c => c.id === s.courseId) || {};
    const open = replayOpen(s);
    const status = !(s.r2RecordingKey || s.recordingUrl) ? (s.startsAt && new Date(s.startsAt).getTime() > Date.now() ? 'upcoming' : 'processing')
      : (open && sessionEnded(s) ? 'available' : open ? 'processing' : 'expired');
    return { id: s.id, courseId: s.courseId, courseTitle: course.title || '', title: s.title || 'Live class', startsAt: s.startsAt || null,
      status, recordingAvailable: open && sessionEnded(s), replayUntil: replayUntilFor(s) };
  }) });
});
// Playback is issued only after a fresh authenticated enrollment and expiry check.
route('GET', '/api/sessions/:id/playback', async ctx => {
  const user = requireUser(ctx);
  const s = db.sessions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Class not found');
  if (!canSeeCourse(user, s.courseId)) throw httpError(403, 'You must enrol in this course to watch.');
  const type = ctx.query.get('type') === 'recording' ? 'recording' : 'live';
  if (type === 'recording') {
    if (s.status !== 'ended' || !(s.r2RecordingKey || s.recordingUrl) || !replayOpen(s)) throw httpError(403, 'Recording is not available.');
  } else if (s.status !== 'live' || !sessionTiming(s, user).liveOpen) {
    throw httpError(403, 'Live playback is not available yet.');
  }
  if (type === 'recording' && s.r2RecordingKey) {
    const videoUrl = await getSignedUrl(r2(), new GetObjectCommand({ Bucket: R2_BUCKET, Key: s.r2RecordingKey }), { expiresIn: 120 });
    ctx.res.setHeader('Cache-Control', 'private, no-store');
    return json(ctx.res, 200, { videoUrl, title: s.title, type, format: 'mp4', expiresIn: 120 });
  }
  const embedUrl = safeYouTubeEmbed(type === 'recording' ? s.recordingUrl : s.youtubeUrl);
  if (!embedUrl) throw httpError(400, 'A valid YouTube video is not configured.');
  ctx.res.setHeader('Cache-Control', 'private, no-store');
  json(ctx.res, 200, { embedUrl, title: s.title, type });
});
route('GET', '/api/me/certificates/:code/pdf', async ctx => {
  const user = requireUser(ctx);
  const c = db.certificates.find(x => x.code === ctx.params.code);
  if (!c || (c.userId !== user.id && !isStaff(user))) throw httpError(404, 'Certificate not found');
  const W = 842, centre = (t, size, font, y) => `BT /${font} ${size} Tf ${Math.max(40, (W - pdfText(t).length * size * 0.5) / 2).toFixed(1)} ${y} Td (${pdfText(t)}) Tj ET`;
  const date = new Date(c.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const content = [
    '0.88 0.66 0 RG 8 w 28 28 786 539 re S', '0.88 0.66 0 RG 1.5 w 40 40 762 515 re S',
    centre('DEBONE DIGITAL ACADEMY', 16, 'F2', 500), centre('CERTIFICATE OF COMPLETION', 12, 'F1', 468),
    centre('This certifies that', 13, 'F1', 400), centre(c.studentName, 34, 'F2', 350),
    centre('has successfully completed', 13, 'F1', 300), centre(c.courseTitle, 22, 'F2', 255),
    centre('Issued ' + date, 11, 'F1', 150), centre('Verification code: ' + c.code, 11, 'F1', 125),
    centre('Verify at ' + PUBLIC_URL + '/certificate.html', 10, 'F1', 100)
  ].join('\n');
  const pdf = makePdf(content);
  ctx.res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="DEBONE-certificate-' + c.code + '.pdf"', 'Cache-Control': 'no-store' });
  ctx.res.end(pdf);
});

/* ============ Bank transfer orders: pay, upload proof, admin approves ============ */
// A student uses their own order. A studio client (no account) may use the order of their booking, with the booking token.
function orderFor(ctx, id) {
  const user = ctx.user;
  const o = db.orders.find(x => x.id === id);
  if (!o) throw httpError(404, 'Order not found');
  if (user && o.userId === user.id) return o;
  if (o.kind === 'deposit') {
    const bk = db.bookings.find(b => b.id === o.bookingId);
    const token = clean(ctx.query.get('token') || (ctx.body && ctx.body.token), 40);
    if (bk && token && bk.token === token) return o;
  }
  throw httpError(user ? 404 : 401, user ? 'Order not found' : 'Please log in.');
}
route('GET', '/api/orders/:id', async ctx => {
  const o = orderFor(ctx, ctx.params.id);
  json(ctx.res, 200, { order: orderView(o) });
});
route('POST', '/api/orders/:id/transfer-made', async ctx => {
  const o = orderFor(ctx, ctx.params.id);
  if (!['awaiting_transfer', 'rejected'].includes(o.status)) throw httpError(400, 'This order is already waiting for review or approved.');
  o.status = 'awaiting_proof'; o.updatedAt = now(); save();
  json(ctx.res, 200, { order: orderView(o) });
});
route('POST', '/api/orders/:id/proof', async ctx => {
  const o = orderFor(ctx, ctx.params.id);
  if (!['awaiting_transfer', 'awaiting_proof', 'rejected'].includes(o.status)) throw httpError(400, 'Proof is not needed for this order.');
  const m = /^data:(image\/jpeg|image\/png|image\/webp|application\/pdf);base64,([A-Za-z0-9+\/=]+)$/.exec(String(ctx.body.dataUrl || ''));
  if (!m) throw httpError(400, 'Upload a photo (JPG, PNG or WebP) or a PDF of your receipt.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) throw httpError(413, 'The receipt is larger than 3 MB. Please upload a smaller photo or PDF.');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[m[1]];
  await store.putFile('proofs/' + o.id + '.' + ext, buf, m[1]);
  o.proof = { file: o.id + '.' + ext, mime: m[1], name: clean(ctx.body.name, 120) || ('receipt.' + ext), uploadedAt: now() };
  o.status = 'proof_uploaded'; o.updatedAt = now(); save();
  json(ctx.res, 200, { order: orderView(o), message: 'Thank you. Your receipt has been sent to our team. We will confirm it and open your course.' });
});
route('GET', '/api/me/orders', async ctx => {
  const user = requireUser(ctx);
  json(ctx.res, 200, { orders: db.orders.filter(o => o.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(orderView) });
});
route('GET', '/api/me/orders/:id', async ctx => {
  const user = requireUser(ctx);
  const o = db.orders.find(x => x.id === ctx.params.id && x.userId === user.id);
  if (!o) throw httpError(404, 'Order not found');
  json(ctx.res, 200, { order: orderView(o) });
});
route('GET', '/api/staff/orders', async ctx => {
  requireStaff(ctx);
  const f = clean(ctx.query.get('status'), 30);
  const list = db.orders.filter(o => !f || o.status === f).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  json(ctx.res, 200, { orders: list.map(o => Object.assign(orderView(o), { hasProof: !!o.proof, proofName: o.proof ? o.proof.name : '', proofMime: o.proof ? o.proof.mime : '' })) });
});
route('GET', '/api/staff/orders/:id/proof', async ctx => {
  requireStaff(ctx);
  const o = db.orders.find(x => x.id === ctx.params.id);
  if (!o || !o.proof) throw httpError(404, 'No receipt uploaded');
  const fileData = await store.getFile('proofs/' + o.proof.file);
  if (!fileData) throw httpError(404, 'Receipt file missing');
  ctx.res.writeHead(200, { 'Content-Type': o.proof.mime, 'Cache-Control': 'no-store', 'Content-Disposition': 'inline; filename="' + o.proof.file + '"' });
  ctx.res.end(fileData);
});
route('PATCH', '/api/staff/orders/:id', async ctx => {
  requireStaff(ctx, true);
  const o = db.orders.find(x => x.id === ctx.params.id);
  if (!o) throw httpError(404, 'Order not found');
  if (o.status !== 'proof_uploaded') throw httpError(400, 'This order is not waiting for approval.');
  if (ctx.body.status === 'approved') {
    approveOrder(o); save();
    if (o.userId) notify(o.userId, 'Payment confirmed', 'Your transfer has been confirmed. Your course, product or bundle is now open.', '#courses', { kind: 'payment' });
    return json(ctx.res, 200, { ok: true, status: 'approved' });
  }
  if (ctx.body.status === 'rejected') {
    const reason = clean(ctx.body.reason, 400);
    if (reason.length < 5) throw httpError(400, 'Tell the student briefly why the receipt was rejected.');
    o.status = 'rejected'; o.rejectReason = reason; o.updatedAt = now(); save();
    if (o.userId) notify(o.userId, 'Receipt needs attention', reason + ' Please upload a clear receipt again.', '#payments', { kind: 'update' });
    return json(ctx.res, 200, { ok: true, status: 'rejected' });
  }
  throw httpError(400, 'Choose approved or rejected.');
});

/* ============ Digital products store and downloads ============ */
function productPublic(p) {
  return { id: p.id, title: p.title, author: p.author || '', description: p.description || '', category: p.category || '',
    price: p.price, pages: p.pages || null, formats: p.formats || '', toc: p.toc || [], previewUrl: p.previewUrl || '',
    image: p.imageData ? `/api/store/${p.id}/image?v=${encodeURIComponent(p.updatedAt)}` : null, hasImage: !!p.imageData };
}
function productInputDigital(b) {
  const title = clean(b.title, 120);
  if (title.length < 3) throw httpError(400, 'Give the product a title.');
  const price = Math.max(0, Math.round(Number(b.price) || 0));
  const fileUrl = clean(b.fileUrl, 500);
  if (fileUrl && !/^https?:\/\//i.test(fileUrl)) throw httpError(400, 'The file link must start with http:// or https://');
  const previewUrl = clean(b.previewUrl, 500);
  if (previewUrl && !/^https?:\/\//i.test(previewUrl)) throw httpError(400, 'The preview link must start with http:// or https://');
  const toc = (Array.isArray(b.toc) ? b.toc : String(b.toc || '').split('\n')).map(x => clean(x, 160)).filter(Boolean).slice(0, 40);
  return { title, author: clean(b.author, 120), description: clean(b.description, 2000), category: clean(b.category, 60),
    price, pages: b.pages ? Math.max(1, Math.round(Number(b.pages))) : null, formats: clean(b.formats, 60), toc, previewUrl, fileUrl,
    active: b.active !== false && b.active !== 'false' };
}
route('GET', '/api/store', async ctx => {
  json(ctx.res, 200, { products: db.digitalProducts.filter(p => p.active).map(productPublic) });
});
route('GET', '/api/store/:id', async ctx => {
  const p = db.digitalProducts.find(x => x.id === ctx.params.id && x.active);
  if (!p) throw httpError(404, 'Product not found');
  const owned = ctx.user ? db.purchases.some(x => x.userId === ctx.user.id && x.productId === p.id) : false;
  json(ctx.res, 200, { product: productPublic(p), owned });
});
route('GET', '/api/store/:id/image', async ctx => {
  const p = db.digitalProducts.find(x => x.id === ctx.params.id);
  if (!p || !p.imageData) throw httpError(404, 'No image');
  ctx.res.writeHead(200, { 'Content-Type': p.imageData.mime, 'Cache-Control': 'no-cache' });
  ctx.res.end(Buffer.from(p.imageData.b64, 'base64'));
});
route('POST', '/api/store/:id/buy', async ctx => {
  const user = requireUser(ctx);
  const p = db.digitalProducts.find(x => x.id === ctx.params.id && x.active);
  if (!p) throw httpError(404, 'Product not found');
  if (!p.fileUrl) throw httpError(400, 'This product is not ready to buy yet.');
  if (db.purchases.some(x => x.userId === user.id && x.productId === p.id)) return json(ctx.res, 200, { alreadyOwned: true });
  if (p.price === 0) {
    db.purchases.push({ id: uid(8), userId: user.id, productId: p.id, reference: 'FREE-' + uid(4), createdAt: now(), downloads: 0, expiresAt: new Date(Date.now() + cfg('downloadDays') * 86400000).toISOString() });
    save(); return json(ctx.res, 200, { free: true });
  }
  return json(ctx.res, 200, { order: orderView(createOrder(user, { kind: 'product', productId: p.id, amountNaira: p.price })) });
});
route('GET', '/api/me/downloads', async ctx => {
  const user = requireUser(ctx);
  const limit = cfg('downloadLimit');
  json(ctx.res, 200, { limit, downloads: db.purchases.filter(x => x.userId === user.id).map(x => {
    const p = db.digitalProducts.find(y => y.id === x.productId) || {};
    const expired = new Date(x.expiresAt).getTime() < Date.now();
    return { id: x.id, title: p.title || 'Product', author: p.author || '', formats: p.formats || '', purchasedAt: x.createdAt,
      expiresAt: x.expiresAt, downloadsUsed: x.downloads || 0, downloadsLeft: Math.max(0, limit - (x.downloads || 0)),
      available: !expired && (x.downloads || 0) < limit && !!p.fileUrl, reason: expired ? 'expired' : (x.downloads || 0) >= limit ? 'limit' : (!p.fileUrl ? 'not ready' : '') };
  }) });
});
route('GET', '/api/downloads/:id', async ctx => {
  const user = requireUser(ctx);
  const x = db.purchases.find(y => y.id === ctx.params.id && y.userId === user.id);
  if (!x) throw httpError(404, 'Download not found');
  const p = db.digitalProducts.find(y => y.id === x.productId);
  if (!p || !p.fileUrl) throw httpError(404, 'This file is not available yet. Please contact us.');
  if (new Date(x.expiresAt).getTime() < Date.now()) throw httpError(403, 'This download has expired. Please contact us to renew it.');
  if ((x.downloads || 0) >= cfg('downloadLimit')) throw httpError(403, 'You have used all your downloads for this product. Please contact us.');
  x.downloads = (x.downloads || 0) + 1; save();
  redirect(ctx.res, p.fileUrl);
});
route('GET', '/api/staff/products', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { products: db.digitalProducts.map(p => Object.assign(productPublic(p), { active: p.active, fileUrl: p.fileUrl || '', sales: db.purchases.filter(x => x.productId === p.id).length })) });
});
route('POST', '/api/staff/products/digital', async ctx => {
  requireStaff(ctx, true);
  const p = Object.assign({ id: uid(8), createdAt: now(), updatedAt: now(), imageData: null }, productInputDigital(ctx.body));
  if (ctx.body.data) p.imageData = validImage(ctx.body.data);
  db.digitalProducts.push(p); save();
  json(ctx.res, 201, { ok: true, id: p.id });
});
route('PATCH', '/api/staff/products/digital/:id', async ctx => {
  requireStaff(ctx, true);
  const p = db.digitalProducts.find(x => x.id === ctx.params.id);
  if (!p) throw httpError(404, 'Product not found');
  Object.assign(p, productInputDigital(ctx.body), { updatedAt: now() });
  if (ctx.body.data) p.imageData = validImage(ctx.body.data);
  save(); json(ctx.res, 200, { ok: true });
});
route('DELETE', '/api/staff/products/digital/:id', async ctx => {
  requireStaff(ctx, true);
  db.digitalProducts = db.digitalProducts.filter(x => x.id !== ctx.params.id); save(); json(ctx.res, 200, { ok: true });
});
route('GET', '/api/staff/purchases', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { purchases: db.purchases.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(x => ({
    id: x.id, productTitle: (db.digitalProducts.find(p => p.id === x.productId) || {}).title || '', buyer: (db.users.find(u => u.id === x.userId) || {}).email || '',
    downloads: x.downloads || 0, expiresAt: x.expiresAt, createdAt: x.createdAt })) });
});

/* ============ Course bundles ============ */
function bundleView(b) {
  const courses = (b.courseIds || []).map(id => db.courses.find(c => c.id === id)).filter(Boolean);
  const courseTotal = courses.reduce((t, c) => t + (c.price || 0), 0);
  // The crossed-out "normal price". If admin typed one it is used until the offer end date passes; otherwise the courses' own prices added together.
  const manual = Number(b.originalPrice) > b.price ? Number(b.originalPrice) : 0;
  let offerEndsAt = null, offerOver = false;
  if (b.offerEnds) { offerEndsAt = new Date(b.offerEnds + 'T23:59:59').toISOString(); offerOver = new Date(offerEndsAt).getTime() < Date.now(); }
  const value = manual ? (offerOver ? b.price : manual) : courseTotal;
  return { id: b.id, title: b.title, description: b.description || '', price: b.price, active: b.active !== false,
    comingSoon: !!b.comingSoon, originalPrice: manual || 0, offerEnds: b.offerEnds || null, offerEndsAt: manual && !offerOver ? offerEndsAt : null, courseTotal,
    waitlistCount: (db.waitlist || []).filter(w => w.bundleId === b.id).length,
    hasImage: !!b.image, imageV: b.image ? b.image.length % 100000 : 0, value, savings: Math.max(0, value - b.price), savingsPercent: value > b.price ? Math.round(((value - b.price) / value) * 100) : 0,
    students: db.enrollments.filter(e => e.status === 'active' && (b.courseIds || []).includes(e.courseId)).length,
    courses: courses.map(c => ({ id: c.id, title: c.title, comingSoon: !!c.comingSoon, price: c.price || 0, startDate: c.startDate || null, schedule: c.schedule || null, instructor: c.instructor || null, lessons: (c.lessons || []).length })) };
}
function bundleInput(b) {
  const title = clean(b.title, 120);
  if (title.length < 3) throw httpError(400, 'Give the bundle a title.');
  const ids = (Array.isArray(b.courseIds) ? b.courseIds : []).map(String);
  if (ids.length < 2) throw httpError(400, 'A bundle needs at least two courses.');
  const courses = ids.map(id => db.courses.find(c => c.id === id));
  if (courses.some(c => !c)) throw httpError(400, 'One of the chosen courses does not exist.');
  const comingSoon = b.comingSoon === true || b.comingSoon === 'true';
  if (!comingSoon && courses.some(c => c.comingSoon)) throw httpError(400, 'A course in this bundle is still coming soon. Set the bundle to "Coming soon" too, or choose open courses only.');
  for (let i = 0; i < courses.length; i++) for (let j = i + 1; j < courses.length; j++) {
    const a = courses[i], c2 = courses[j];
    if (a.startDate && a.startDate === c2.startDate && a.schedule && a.schedule === c2.schedule)
      throw httpError(400, `${a.title} and ${c2.title} are scheduled at the same time. Change one schedule so students can attend both.`);
  }
  const price = Math.max(0, Math.round(Number(b.price) || 0));
  if (!price) throw httpError(400, 'Set the bundle price in naira.');
  const originalPrice = Math.max(0, Math.round(Number(b.originalPrice) || 0));
  if (originalPrice && originalPrice <= price) throw httpError(400, 'The normal (crossed-out) price must be higher than the bundle price.');
  const offerEnds = b.offerEnds ? String(b.offerEnds) : '';
  if (offerEnds && !/^\d{4}-\d{2}-\d{2}$/.test(offerEnds)) throw httpError(400, 'Enter the offer end date as a date.');
  const image = String(b.image || '');
  if (image && !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(image)) throw httpError(400, 'Upload a PNG, JPEG or WebP image.');
  if (image.length > 700000) throw httpError(400, 'Bundle image is too large (maximum 500 KB).');
  return { title, image, description: clean(b.description, 1000), price, originalPrice: originalPrice || null, offerEnds: offerEnds || null, comingSoon, courseIds: ids, active: b.active !== false && b.active !== 'false' };
}
// Credit only verified successful individual-course payments, not catalogue prices or pending transfers.
function bundleCredit(userId, b) {
  const owned = (b.courseIds || []).filter(cid => !!enrollmentFor(userId, cid));
  const credits = owned.map(cid => {
    const paid = db.payments.filter(p => p.userId === userId && p.kind === 'course' && p.courseId === cid && p.status === 'success' && !(db.refunds || []).some(r => r.paymentReference === p.reference && ['paid', 'approved', 'processing'].includes(r.status)));
    const amount = paid.reduce((m, p) => Math.max(m, Math.round((Number(p.amountKobo) || 0) / 100)), 0);
    return { courseId: cid, amount };
  });
  const total = credits.reduce((sum, x) => sum + x.amount, 0);
  return { credits, total: Math.min(b.price, total), remaining: Math.max(0, b.price - total) };
}
route('GET', '/api/bundles', async ctx => json(ctx.res, 200, { bundles: db.bundles.filter(b => b.active !== false).map(b => {
  const v = bundleView(b);
  // For a signed-in student: which courses of the bundle they already own
  if (ctx.user) { v.courses.forEach(c => { c.owned = !!enrollmentFor(ctx.user.id, c.id); }); v.ownedCount = v.courses.filter(c => c.owned).length; v.owned = v.ownedCount === v.courses.length; v.paymentCredit = bundleCredit(ctx.user.id, b); v.onWaitlist = (db.waitlist || []).some(w => w.bundleId === b.id && w.userId === ctx.user.id); }
  return v;
}) }));
route('POST', '/api/bundles/:id/buy', async ctx => {
  const user = requireUser(ctx);
  const b = db.bundles.find(x => x.id === ctx.params.id && x.active !== false);
  if (!b) throw httpError(404, 'Bundle not found');
  if (b.comingSoon) throw httpError(403, 'This bundle is coming soon. Join the waiting list and we will tell you the moment it opens.');
  if (b.courseIds.every(cid => enrollmentFor(user.id, cid))) return json(ctx.res, 200, { alreadyOwned: true });
  const credit = bundleCredit(user.id, b);
  const qr = qrOffer(user);
  const discounted = qr ? Math.round(b.price * (100 - qr.percent) / 100) : b.price;
  const price = Math.max(0, discounted - credit.total);
  if (price === 0) {
    // A fully credited bundle is granted without creating a zero-naira bank transfer.
    const ref = 'DBC-' + uid(6).toUpperCase();
    for (const cid of b.courseIds) if (!enrollmentFor(user.id, cid)) db.enrollments.push({ id: uid(), userId: user.id, courseId: cid, status: 'active', enrolledAt: now(), via: 'bundle-credit', reference: ref, bundleId: b.id });
    db.orders.push({ id: uid(8), reference: ref, userId: user.id, contactEmail: user.email, contactName: user.name, kind: 'bundle', bundleId: b.id, amountNaira: 0, creditApplied: credit.total, status: 'approved', createdAt: now(), updatedAt: now() });
    save(); return json(ctx.res, 200, { alreadyOwned: true, credited: true });
  }
  return json(ctx.res, 200, { order: orderView(createOrder(user, { kind: 'bundle', bundleId: b.id, amountNaira: price, creditApplied: credit.total })) });
});
route('GET', '/api/staff/bundles', async ctx => { requireStaff(ctx, true); json(ctx.res, 200, { bundles: db.bundles.map(b => Object.assign(bundleView(b), { courseIds: b.courseIds, sold: db.payments.filter(p => p.status === 'success' && p.bundleId === b.id).length })) }); });
route('GET', '/api/bundles/:id/image', async ctx => {
  const b = db.bundles.find(x => x.id === ctx.params.id);
  const m = b && b.image ? /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(b.image) : null;
  if (!m) throw httpError(404, 'No picture for this bundle.');
  ctx.res.writeHead(200, { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
  ctx.res.end(Buffer.from(m[2], 'base64'));
});
route('POST', '/api/staff/bundles', async ctx => {
  requireStaff(ctx, true);
  const b = Object.assign({ id: uid(8), createdAt: now() }, bundleInput(ctx.body));
  db.bundles.push(b); save(); json(ctx.res, 201, { ok: true, id: b.id });
});
route('PATCH', '/api/staff/bundles/:id', async ctx => {
  requireStaff(ctx, true);
  const b = db.bundles.find(x => x.id === ctx.params.id);
  if (!b) throw httpError(404, 'Bundle not found');
  const input = bundleInput(ctx.body);
  // Keep the current picture unless a new one was sent or it was removed
  if (ctx.body.image === undefined && ctx.body.removeImage !== true) input.image = b.image || '';
  const wasSoon = !!b.comingSoon;
  Object.assign(b, input);
  if (wasSoon && !b.comingSoon) notifyBundleWaitlist(b);
  save(); json(ctx.res, 200, { ok: true });
});
function notifyBundleWaitlist(b) {
  let told = 0;
  (db.waitlist || []).filter(w => w.bundleId === b.id && !w.notifiedAt).forEach(w => {
    w.notifiedAt = now(); told++;
    notify(w.userId, b.title + ' is now open!', 'The bundle you were waiting for has launched. Get it before the offer ends.', '#bundle/' + b.id, { kind: 'update' });
  });
  return told;
}
route('POST', '/api/bundles/:id/waitlist', async ctx => {
  const user = requireUser(ctx);
  const b = db.bundles.find(x => x.id === ctx.params.id && x.active !== false);
  if (!b) throw httpError(404, 'Bundle not found');
  if (!b.comingSoon) throw httpError(400, 'This bundle is already open. You can buy it now.');
  db.waitlist = db.waitlist || [];
  if (!db.waitlist.some(w => w.bundleId === b.id && w.userId === user.id)) {
    db.waitlist.push({ id: uid(6), bundleId: b.id, userId: user.id, name: user.name, email: user.email, phone: user.phone || '', createdAt: now(), notifiedAt: null });
  }
  save(); json(ctx.res, 200, { ok: true, waitlistCount: db.waitlist.filter(w => w.bundleId === b.id).length });
});
route('DELETE', '/api/bundles/:id/waitlist', async ctx => {
  const user = requireUser(ctx);
  db.waitlist = (db.waitlist || []).filter(w => !(w.bundleId === ctx.params.id && w.userId === user.id));
  save(); json(ctx.res, 200, { ok: true });
});
route('POST', '/api/staff/bundles/:id/launch', async ctx => {
  requireStaff(ctx, true);
  const b = db.bundles.find(x => x.id === ctx.params.id);
  if (!b) throw httpError(404, 'Bundle not found');
  const wasSoon = !!b.comingSoon;
  if (b.courseIds.some(cid => (db.courses.find(c => c.id === cid) || {}).comingSoon)) throw httpError(400, 'A course inside this bundle is still marked Coming soon. Launch that course first.');
  b.comingSoon = false;
  const told = wasSoon ? notifyBundleWaitlist(b) : 0;
  save(); json(ctx.res, 200, { ok: true, notified: told });
});
route('DELETE', '/api/staff/bundles/:id', async ctx => {
  requireStaff(ctx, true);
  db.bundles = db.bundles.filter(x => x.id !== ctx.params.id); save(); json(ctx.res, 200, { ok: true });
});

/* ============ Studio bookings, quotes and deposits ============ */
const BOOKING_SERVICES = ['Photography', 'Video coverage', 'Music video production', 'Film and movie production', 'Cinematography', 'Drone coverage', 'Livestreaming', 'Video editing', 'Photo editing', 'Graphic design', 'Event media coverage', 'Website development', 'E-commerce website', 'AI video production', 'AI image creation', 'Social media content', 'Business automation', 'Branding and creative services', 'General enquiry'];
function bookingPublic(b) {
  return { id: b.id, service: b.service, eventDate: b.eventDate, location: b.location, status: b.status,
    quoteAmount: b.quoteAmount || null, depositAmount: b.depositAmount || null, depositPercent: b.depositPercent || null,
    depositPaid: !!b.depositPaidAt, description: b.description || '' };
}
route('POST', '/api/bookings', async ctx => {
  if (limited('book:' + clientIp(ctx.req), 5, 60 * 60 * 1000)) throw httpError(429, 'You have sent several requests recently. Please try again later.');
  const b = ctx.body;
  const name = clean(b.name, 100), email = clean(b.email, 120).toLowerCase(), phone = clean(b.phone, 20);
  if (name.length < 2) throw httpError(400, 'Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Please enter a valid email address.');
  const service = clean(b.service, 80);
  if (!BOOKING_SERVICES.includes(service)) throw httpError(400, 'Please choose a service.');
  const description = clean(b.description, 2000);
  if (description.length < 10) throw httpError(400, 'Describe the project in a few words.');
  const bk = { id: uid(8), token: uid(16), name, email, phone, service, eventDate: clean(b.eventDate, 20), location: clean(b.location, 200),
    description, status: 'requested', quoteAmount: null, depositPercent: null, depositAmount: null, createdAt: now() };
  db.bookings.push(bk); save();
  json(ctx.res, 201, { ok: true, token: bk.token, message: 'Thank you. We will reply with a quotation by email and WhatsApp.' });
});
route('GET', '/api/staff/bookings', async ctx => { requireStaff(ctx); json(ctx.res, 200, { bookings: db.bookings.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(b => Object.assign({ token: b.token }, bookingPublic(b), { name: b.name, email: b.email, phone: b.phone })) }); });
route('PATCH', '/api/staff/bookings/:id', async ctx => {
  requireStaff(ctx);
  const bk = db.bookings.find(x => x.id === ctx.params.id);
  if (!bk) throw httpError(404, 'Booking not found');
  const b = ctx.body;
  if (b.quoteAmount !== undefined && b.quoteAmount !== '') {
    const q = Math.round(Number(b.quoteAmount));
    if (!(q > 0)) throw httpError(400, 'Enter the quotation amount in naira.');
    bk.quoteAmount = q;
    bk.depositPercent = Math.min(100, Math.max(0, Math.round(Number(b.depositPercent !== undefined && b.depositPercent !== '' ? b.depositPercent : cfg('depositPercent')))));
    bk.depositAmount = Math.round(q * bk.depositPercent / 100);
    if (bk.status === 'requested') bk.status = 'quoted';
  }
  const st = ['requested', 'quoted', 'accepted', 'deposit_paid', 'completed', 'cancelled'];
  if (b.status !== undefined) { if (!st.includes(b.status)) throw httpError(400, 'Invalid status.'); bk.status = b.status; }
  if (b.note !== undefined) bk.note = clean(b.note, 800);
  save(); json(ctx.res, 200, { ok: true });
});
route('GET', '/api/bookings/by-token', async ctx => {
  const bk = db.bookings.find(x => x.token === clean(ctx.query.get('token'), 40));
  if (!bk) throw httpError(404, 'We could not find this quotation. Check the link in your message.');
  json(ctx.res, 200, { booking: bookingPublic(bk), studio: (db.settings || {}).businessName || 'DEBONE' });
});
route('POST', '/api/bookings/accept', async ctx => {
  const bk = db.bookings.find(x => x.token === clean(ctx.body.token, 40));
  if (!bk || bk.status !== 'quoted') throw httpError(400, 'This quotation cannot be accepted right now.');
  bk.status = 'accepted'; bk.acceptedAt = now(); save(); json(ctx.res, 200, { ok: true });
});
route('POST', '/api/bookings/deposit', async ctx => {
  const bk = db.bookings.find(x => x.token === clean(ctx.body.token, 40));
  if (!bk || !['quoted', 'accepted'].includes(bk.status) || !bk.depositAmount) throw httpError(400, 'The deposit cannot be paid right now.');
  return json(ctx.res, 200, { order: orderView(createOrder(null, { kind: 'deposit', bookingId: bk.id, amountNaira: bk.depositAmount, contactEmail: bk.email, contactName: bk.name })) });
});

/* ============ Minimum students: notice, choice, refund ============ */
function runScheduleChecks() {
  const day = 86400000, noticeDays = cfg('noticeDays');
  let changed = false;
  db.courses.forEach(c => {
    if (!c.minStudents || !c.startDate || c.comingSoon) return;
    const days = (new Date(c.startDate + 'T00:00:00').getTime() - Date.now()) / day;
    if (days < 0 || days > noticeDays) return;
    if (enrolledCount(c) >= c.minStudents) return;
    if (c.minNoticeSentFor === c.startDate) return;
    db.enrollments.filter(e => e.courseId === c.id && e.status === 'active').forEach(e => {
      db.scheduleNotices.push({ id: uid(8), courseId: c.id, userId: e.userId, startDate: c.startDate, status: 'open', choice: null, createdAt: now() });
      notify(e.userId, 'Your course may not run', `${c.title} needs ${c.minStudents} students to run and currently has fewer. Choose a new date or a refund.`, '#notices', { kind: 'update' });
    });
    c.minNoticeSentFor = c.startDate; changed = true;
  });
  if (changed) save();
}
route('GET', '/api/me/schedule-notices', async ctx => {
  const user = requireUser(ctx);
  json(ctx.res, 200, { notices: db.scheduleNotices.filter(n => n.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(n => ({
    id: n.id, status: n.status, choice: n.choice, startDate: n.startDate, newStartDate: n.newStartDate || null,
    courseTitle: (db.courses.find(c => c.id === n.courseId) || {}).title || 'Course', createdAt: n.createdAt })) });
});
route('POST', '/api/me/schedule-notices/:id/choose', async ctx => {
  const user = requireUser(ctx);
  const n = db.scheduleNotices.find(x => x.id === ctx.params.id && x.userId === user.id);
  if (!n || n.status !== 'open') throw httpError(400, 'This choice has already been made.');
  const choice = ctx.body.choice;
  if (choice === 'new_date') { n.status = 'waiting'; n.choice = 'new_date'; notify(user.id, 'Thank you', 'We will confirm a new start date and tell you here.', '#notices', { kind: 'update' }); }
  else if (choice === 'refund') {
    const pay = db.payments.find(p => p.userId === user.id && p.courseId === n.courseId && p.status === 'success');
    if (!pay) throw httpError(400, 'We could not find your payment for this course. Please contact us.');
    db.refunds.push({ id: uid(8), paymentReference: pay.reference, userId: user.id, courseId: n.courseId, kind: 'course', amountKobo: pay.amountKobo, reason: 'Course did not reach its minimum number of students', status: 'requested', createdAt: now() });
    n.status = 'refund_requested'; n.choice = 'refund';
    notify(user.id, 'Refund requested', 'Your refund request is with our team.', '#notices', { kind: 'update' });
  } else throw httpError(400, 'Choose "new date" or "refund".');
  save(); json(ctx.res, 200, { ok: true });
});
route('GET', '/api/staff/schedule-notices', async ctx => {
  requireStaff(ctx);
  json(ctx.res, 200, { notices: db.scheduleNotices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(n => ({
    id: n.id, status: n.status, choice: n.choice, startDate: n.startDate, newStartDate: n.newStartDate || null,
    courseTitle: (db.courses.find(c => c.id === n.courseId) || {}).title || '', student: (db.users.find(u => u.id === n.userId) || {}).name || '' })) });
});

/* ============ Refunds ============ */
route('POST', '/api/me/payments/:reference/refund', async ctx => {
  const user = requireUser(ctx);
  const pay = db.payments.find(p => p.reference === ctx.params.reference && p.userId === user.id && p.status === 'success');
  if (!pay) throw httpError(404, 'Payment not found');
  if (db.refunds.some(r => r.paymentReference === pay.reference && r.status !== 'declined')) throw httpError(400, 'A refund has already been requested for this payment.');
  const reason = clean(ctx.body.reason, 500);
  if (reason.length < 5) throw httpError(400, 'Tell us briefly why you want a refund.');
  const kind = pay.kind || 'course';
  const paidAt = new Date(pay.paidAt || pay.createdAt).getTime();
  if (Date.now() - paidAt > cfg('refundWindowDays') * 86400000) throw httpError(400, `Refunds can be requested within ${cfg('refundWindowDays')} days of payment.`);
  if (kind === 'course') {
    const c = db.courses.find(x => x.id === pay.courseId);
    if (c && c.startDate && new Date(c.startDate + 'T00:00:00').getTime() <= Date.now()) throw httpError(400, 'This course has already started, so a refund is not available. Please contact us.');
  }
  if (kind === 'product' && db.purchases.some(x => x.reference === pay.reference && (x.downloads || 0) > 0)) throw httpError(400, 'This product has already been downloaded, so a refund is not available.');
  db.refunds.push({ id: uid(8), paymentReference: pay.reference, userId: user.id, courseId: pay.courseId || null, productId: pay.productId || null, bundleId: pay.bundleId || null, kind,
    amountKobo: pay.amountKobo, reason, status: 'requested', createdAt: now() });
  save(); json(ctx.res, 201, { ok: true, message: 'Your refund request has been received. We will reply within a few working days.' });
});
route('GET', '/api/me/refunds', async ctx => {
  const user = requireUser(ctx);
  json(ctx.res, 200, { refunds: db.refunds.filter(r => r.userId === user.id).map(r => ({ id: r.id, reference: r.paymentReference, amount: r.amountKobo / 100, status: r.status, reason: r.reason, createdAt: r.createdAt })) });
});
route('GET', '/api/staff/refunds', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { refunds: db.refunds.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => ({
    id: r.id, reference: r.paymentReference, amount: r.amountKobo / 100, status: r.status, reason: r.reason, kind: r.kind, createdAt: r.createdAt,
    student: (db.users.find(u => u.id === r.userId) || {}).name || '', email: (db.users.find(u => u.id === r.userId) || {}).email || '',
    item: (db.courses.find(c => c.id === r.courseId) || db.digitalProducts.find(p => p.id === r.productId) || db.bundles.find(b => b.id === r.bundleId) || {}).title || '' })) });
});
route('PATCH', '/api/staff/refunds/:id', async ctx => {
  requireStaff(ctx, true);
  const r = db.refunds.find(x => x.id === ctx.params.id);
  if (!r) throw httpError(404, 'Refund not found');
  const decision = ctx.body.status;
  if (!['approved', 'declined'].includes(decision)) throw httpError(400, 'Choose approved or declined.');
  if (r.status !== 'requested') throw httpError(400, 'This refund has already been decided.');
  if (decision === 'declined') { r.status = 'declined'; r.decidedAt = now(); save(); return json(ctx.res, 200, { ok: true, status: 'declined' }); }
  let status = 'approved', note = 'Approved. Process the refund in your Paystack dashboard, then mark it paid here.';
  if (PAYSTACK_SECRET) {
    try { await paystack('POST', '/refund', { transaction: r.paymentReference, amount: r.amountKobo }); status = 'paid'; note = 'Refunded through Paystack.'; }
    catch (e) { note = 'Paystack refund failed: ' + e.message; }
  }
  r.status = status; r.decidedAt = now(); r.note = note;
  if (status === 'paid') {
    if (r.kind === 'course' && r.courseId) db.enrollments.filter(e => e.userId === r.userId && e.courseId === r.courseId).forEach(e => { e.status = 'refunded'; });
    if (r.kind === 'product' && r.productId) db.purchases = db.purchases.filter(x => !(x.userId === r.userId && x.productId === r.productId && x.reference === r.paymentReference));
  }
  notify(r.userId, 'Refund ' + (status === 'paid' ? 'paid' : 'approved'), 'Your refund of ₦' + (r.amountKobo / 100).toLocaleString('en-US') + ' is being processed.', '#payments', { kind: 'payment' });
  save(); json(ctx.res, 200, { ok: true, status, note });
});
route('PATCH', '/api/staff/refunds/:id/mark-paid', async ctx => {
  requireStaff(ctx, true);
  const r = db.refunds.find(x => x.id === ctx.params.id);
  if (!r || r.status !== 'approved') throw httpError(400, 'Only approved refunds can be marked paid.');
  r.status = 'paid'; r.decidedAt = now(); r.note = 'Marked paid by the team.';
  if (r.kind === 'course' && r.courseId) db.enrollments.filter(e => e.userId === r.userId && e.courseId === r.courseId).forEach(e => { e.status = 'refunded'; });
  save(); json(ctx.res, 200, { ok: true });
});

/* ============ Reports and analytics ============ */
route('GET', '/api/staff/reports/revenue', async ctx => {
  requireStaff(ctx, true);
  const ok = db.payments.filter(p => p.status === 'success');
  const label = p => p.kind === 'product' ? ((db.digitalProducts.find(x => x.id === p.productId) || {}).title || 'Product')
    : p.kind === 'bundle' ? ((db.bundles.find(x => x.id === p.bundleId) || {}).title || 'Bundle')
    : p.kind === 'deposit' ? 'Studio deposit'
    : ((db.courses.find(c => c.id === p.courseId) || {}).title || 'Course');
  const byItem = {}, byMonth = {}, byKind = {};
  ok.forEach(p => {
    const k = p.kind || 'course', l = label(p), m = (p.paidAt || p.createdAt).slice(0, 7);
    byItem[l] = byItem[l] || { item: l, kind: k, count: 0, amount: 0 }; byItem[l].count++; byItem[l].amount += p.amountKobo / 100;
    byMonth[m] = (byMonth[m] || 0) + p.amountKobo / 100;
    byKind[k] = (byKind[k] || 0) + p.amountKobo / 100;
  });
  const refunded = db.refunds.filter(r => r.status === 'paid').reduce((t, r) => t + r.amountKobo / 100, 0);
  const gross = ok.reduce((t, p) => t + p.amountKobo / 100, 0);
  const report = { gross, refunded, net: gross - refunded, orders: ok.length,
    byItem: Object.values(byItem).sort((a, b) => b.amount - a.amount), byMonth: Object.keys(byMonth).sort().map(m => ({ month: m, amount: byMonth[m] })), byKind };
  if (ctx.query.get('format') === 'csv') {
    const rows = [['item', 'type', 'orders', 'amount_naira']].concat(report.byItem.map(i => [i.item, i.kind, i.count, i.amount]));
    rows.push([], ['gross', '', '', gross], ['refunded', '', '', refunded], ['net', '', '', gross - refunded]);
    ctx.res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="debone-revenue.csv"' });
    return ctx.res.end(rows.map(r => r.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  }
  json(ctx.res, 200, report);
});
route('GET', '/api/staff/analytics', async ctx => {
  requireStaff(ctx, true);
  const days = []; for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const pages = Object.keys(db.pageViews || {}).map(pg => ({ page: pg, views: days.reduce((t, d) => t + ((db.pageViews[pg] || {})[d] || 0), 0) })).sort((a, b) => b.views - a.views);
  const signups = days.map(d => ({ day: d, count: db.users.filter(u => u.role === 'student' && (u.createdAt || '').slice(0, 10) === d).length }));
  const topCourses = db.courses.map(c => ({ title: c.title, students: enrolledCount(c) })).sort((a, b) => b.students - a.students);
  const topProducts = db.digitalProducts.map(p => ({ title: p.title, sales: db.purchases.filter(x => x.productId === p.id).length })).sort((a, b) => b.sales - a.sales);
  json(ctx.res, 200, { pages: pages.slice(0, 20), totalViews: pages.reduce((t, p) => t + p.views, 0), signups, topCourses, topProducts,
    students: db.users.filter(u => u.role === 'student').length, subscribers: (db.newsletter || []).length });
});

/* ============ Live reports: one call the admin dashboard repeats every few seconds ============ */
const presence = new Map();   // visitor key -> { at, userId, name, page }
function touchPresence(req, user, pathname) {
  const key = user ? 'u:' + user.id : 'ip:' + clientIp(req);
  const prev = presence.get(key);
  const page = /\.html$/.test(pathname) || pathname === '/' ? pathname : (prev && prev.page) || '';
  presence.set(key, { at: Date.now(), userId: user ? user.id : null, name: user ? user.name : '', role: user ? user.role : '', page });
  if (presence.size > 5000) for (const [k, v] of presence) if (Date.now() - v.at > 600000) presence.delete(k);
}
route('POST', '/api/qr/scan', async ctx => {
  const src = qrSourceOf(ctx.body.src);
  if (!src || limited('qrscan:' + clientIp(ctx.req), 30)) return json(ctx.res, 200, { ok: true });
  const st = db.qrStats[src] = db.qrStats[src] || { scans: 0 };
  st.scans++; st.lastScanAt = now(); save();
  json(ctx.res, 200, { ok: true, percent: QR_PERCENT, days: QR_DAYS });
});
function qrReport() {
  const names = new Set([...Object.keys(db.qrStats || {}), ...db.users.map(u => u.qrSource).filter(Boolean)]);
  return [...names].map(src => {
    const users = db.users.filter(u => u.qrSource === src);
    const buyers = users.filter(u => db.payments.some(p => p.userId === u.id && p.status === 'success')).length;
    const st = (db.qrStats || {})[src] || {};
    return { src, scans: st.scans || 0, signups: users.length, buyers, lastScanAt: st.lastScanAt || null };
  }).sort((a, b) => b.scans - a.scans);
}
route('GET', '/api/staff/live-stats', async ctx => {
  requireStaff(ctx, true);
  const nowMs = Date.now(), DAY = 86400000;
  const days = []; for (let i = 29; i >= 0; i--) days.push(dayKey(nowMs - i * DAY));
  const today = days[days.length - 1];
  const kobo = p => (p.amountKobo || 0) / 100;
  const paid = db.payments.filter(p => p.status === 'success');
  const paidDay = p => dayKey(p.paidAt || p.createdAt);
  const sumBy = fn => { const m = {}; paid.forEach(p => { const k = fn(p); m[k] = (m[k] || 0) + kobo(p); }); return m; };
  const revByDay = sumBy(paidDay);
  const countByDay = (list, get) => { const m = {}; list.forEach(x => { const t = get(x); if (t) { const k = dayKey(t); m[k] = (m[k] || 0) + 1; } }); return m; };
  const students = db.users.filter(u => (u.role || 'student') === 'student');
  const signupByDay = countByDay(students, u => u.createdAt);
  const enrolByDay = countByDay(db.enrollments.filter(e => e.status === 'active'), e => e.enrolledAt);
  const doneByDay = countByDay(db.progress, p => p.completedAt);
  const viewsByDay = {};
  Object.values(db.pageViews || {}).forEach(pv => Object.keys(pv).forEach(d => { viewsByDay[d] = (viewsByDay[d] || 0) + pv[d]; }));
  const series = key => days.map(d => key[d] || 0);
  const sum = (arr, n) => arr.slice(-n).reduce((t, v) => t + v, 0);
  const revenue = series(revByDay);
  const refunded = db.refunds.filter(r => r.status === 'paid').reduce((t, r) => t + (r.amountKobo || 0) / 100, 0);
  // Courses: learners, finished lessons, completion rate
  const courses = db.courses.filter(c => !c.comingSoon).map(c => {
    const learners = db.enrollments.filter(e => e.courseId === c.id && e.status === 'active');
    const lessonIds = new Set((c.lessons || []).map(l => l.id));
    const done = db.progress.filter(p => lessonIds.has(p.lessonId) && learners.some(e => e.userId === p.userId)).length;
    const possible = learners.length * lessonIds.size;
    const earned = paid.filter(p => (p.kind || 'course') === 'course' && p.courseId === c.id).reduce((t, p) => t + kobo(p), 0);
    return { id: c.id, title: c.title, students: learners.length, completion: possible ? Math.round((done / possible) * 100) : 0, revenue: earned };
  }).sort((a, b) => b.students - a.students);
  const byKind = {};
  paid.forEach(p => { const k = p.kind || 'course'; byKind[k] = (byKind[k] || 0) + kobo(p); });
  // Right now
  const online = [...presence.values()].filter(v => nowMs - v.at < 5 * 60000);
  const liveSessions = db.sessions.filter(s => s.status === 'live' || (s.startsAt && sessionTiming(s, null).liveOpen && !sessionEnded(s))).map(s => ({
    id: s.id, title: s.title, course: (db.courses.find(c => c.id === s.courseId) || {}).title || '', attendees: db.attendance.filter(a => a.sessionId === s.id).length }));
  // Attendance quality: live vs recording
  const att = db.attendance.length, attLive = db.attendance.filter(a => a.how !== 'recording').length;
  // Activity feed (newest first)
  const nameOf = id => ((db.users.find(u => u.id === id) || {}).name || 'Someone').split(' ')[0];
  const feed = [];
  paid.slice(-12).forEach(p => feed.push({ t: p.paidAt || p.createdAt, kind: 'sale', text: nameOf(p.userId) + ' paid ' + '₦' + Math.round(kobo(p)).toLocaleString('en-US') }));
  students.slice(-12).forEach(u => feed.push({ t: u.createdAt, kind: 'signup', text: u.name.split(' ')[0] + ' created an account' }));
  db.enrollments.filter(e => e.status === 'active').slice(-12).forEach(e => feed.push({ t: e.enrolledAt, kind: 'enrol', text: nameOf(e.userId) + ' enrolled in ' + ((db.courses.find(c => c.id === e.courseId) || {}).title || 'a course') }));
  db.submissions.slice(-12).forEach(x => feed.push({ t: x.submittedAt, kind: 'work', text: nameOf(x.userId) + ' submitted an assignment' }));
  db.attendance.slice(-12).forEach(a => feed.push({ t: a.at, kind: 'class', text: nameOf(a.userId) + (a.how === 'recording' ? ' watched a class recording' : ' joined a live class') }));
  db.progress.slice(-12).forEach(p => feed.push({ t: p.completedAt, kind: 'lesson', text: nameOf(p.userId) + ' completed a lesson' }));
  feed.sort((a, b) => String(b.t).localeCompare(String(a.t)));
  const pages = Object.keys(db.pageViews || {}).map(pg => ({ page: pg, views: days.reduce((t, d) => t + ((db.pageViews[pg] || {})[d] || 0), 0), today: (db.pageViews[pg] || {})[today] || 0 })).sort((a, b) => b.views - a.views).slice(0, 8);
  json(ctx.res, 200, {
    at: now(), days,
    kpi: {
      revenueToday: revenue[29], revenue7: sum(revenue, 7), revenue30: sum(revenue, 30), revenueAll: paid.reduce((t, p) => t + kobo(p), 0), refunded,
      orders: paid.length, students: students.length, enrollments: db.enrollments.filter(e => e.status === 'active').length,
      signupsToday: signupByDay[today] || 0, lessonsToday: doneByDay[today] || 0, viewsToday: viewsByDay[today] || 0,
      online: online.length, onlineStudents: online.filter(v => v.userId).length, liveNow: liveSessions.length,
      pendingGrading: db.submissions.filter(s => s.marks == null).length,
      pendingOrders: db.orders.filter(o => ['proof_uploaded', 'awaiting_proof'].includes(o.status)).length,
      pendingRefunds: db.refunds.filter(r => r.status === 'pending').length,
      pendingCerts: (db.certRequests || []).filter(r => r.status === 'pending').length,
      liveShare: att ? Math.round((attLive / att) * 100) : 0, messagesToday: db.communityMsgs.filter(m => m.createdAt && dayKey(m.createdAt) === today && !m.deletedAt).length
    },
    series: { revenue, signups: series(signupByDay), enrolments: series(enrolByDay), lessons: series(doneByDay), views: series(viewsByDay) },
    courses, byKind, liveSessions, pages, qr: qrReport(), qrPercent: QR_PERCENT, qrDays: QR_DAYS,
    activeNow: online.filter(v => v.userId).slice(0, 8).map(v => ({ name: v.name.split(' ')[0], page: v.page })),
    feed: feed.slice(0, 14)
  });
});

/* ============ Community: a WhatsApp-style group chat for each course ============
   Students send text, pictures and files, reply to a message, and delete their own messages.
   Staff can hide or delete any message. Files live in storage; the message only keeps a small record of them. */
const COMMUNITY_FILE_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv', zip: 'application/zip'
};
const COMMUNITY_FILE_MAX = 2.4 * 1024 * 1024;
function migrateCommunity() {
  if (db.communityMigrated) return;
  (db.threads || []).forEach(t => db.communityMsgs.push({ id: t.id, courseId: t.courseId, userId: t.userId, authorName: t.authorName, role: 'student', text: t.title && t.body.indexOf(t.title) !== 0 ? t.title + '\n' + t.body : t.body, replyTo: null, file: null, createdAt: t.createdAt, hidden: !!t.hidden }));
  (db.replies || []).forEach(r => { const t = (db.threads || []).find(x => x.id === r.threadId); if (t) db.communityMsgs.push({ id: r.id, courseId: t.courseId, userId: r.userId, authorName: r.authorName, role: 'student', text: r.body, replyTo: t.id, file: null, createdAt: r.createdAt, hidden: !!r.hidden }); });
  db.communityMigrated = true; save();
}
function communityMsgView(m, user, byId) {
  const gone = !!m.deletedAt;
  const parent = m.replyTo ? byId.get(m.replyTo) : null;
  return {
    id: m.id, name: m.authorName, role: m.role || 'student', mine: m.userId === user.id, createdAt: m.createdAt,
    deleted: gone, text: gone ? '' : m.text || '',
    file: !gone && m.file ? { id: m.file.id, name: m.file.name, size: m.file.size, kind: m.file.kind, mime: m.file.mime } : null,
    replyTo: parent ? { id: parent.id, name: parent.authorName, text: parent.deletedAt ? 'This message was deleted' : (parent.text || (parent.file ? (parent.file.kind === 'image' ? 'Photo' : parent.file.name) : '')).slice(0, 90) } : null
  };
}
route('GET', '/api/courses/:id/community/chat', async ctx => {
  const user = requireUser(ctx);
  if (!canSeeCourse(user, ctx.params.id)) throw httpError(403, 'Join this course to see its community.');
  migrateCommunity();
  const all = db.communityMsgs.filter(m => m.courseId === ctx.params.id && !m.hidden).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const byId = new Map(all.map(m => [m.id, m]));
  const msgs = all.slice(-300).map(m => communityMsgView(m, user, byId));
  const course = db.courses.find(c => c.id === ctx.params.id);
  json(ctx.res, 200, { messages: msgs, members: course ? enrolledCount(course) : 0, serverTime: now() });
});
route('POST', '/api/courses/:id/community/chat', async ctx => {
  const user = requireUser(ctx);
  if (!canSeeCourse(user, ctx.params.id)) throw httpError(403, 'Join this course to post.');
  migrateCommunity();
  if (limited('cmsg:' + user.id, 40, 60 * 1000)) throw httpError(429, 'You are sending messages too fast. Please slow down.');
  const text = clean(ctx.body.text, 2000);
  let file = null;
  const up = ctx.body.file;
  if (up && up.dataUrl) {
    const m = /^data:[^;,]*;base64,([A-Za-z0-9+\/=]+)$/.exec(String(up.dataUrl));
    if (!m) throw httpError(400, 'That file could not be read. Please try again.');
    const name = clean(up.name, 120).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'file';
    const ext = (name.split('.').pop() || '').toLowerCase();
    const mime = COMMUNITY_FILE_TYPES[ext];
    if (!mime) throw httpError(400, 'That file type is not allowed. You can share pictures, PDF, Word, Excel, PowerPoint, text and zip files.');
    const buf = Buffer.from(m[1], 'base64');
    if (!buf.length) throw httpError(400, 'That file is empty.');
    if (buf.length > COMMUNITY_FILE_MAX) throw httpError(413, 'That file is larger than 2.4 MB. Please send a smaller one.');
    const isImg = mime.startsWith('image/');
    if (isImg) {
      const ok = (mime === 'image/jpeg' && buf[0] === 0xFF && buf[1] === 0xD8) || (mime === 'image/png' && buf.slice(1, 4).toString() === 'PNG') ||
        (mime === 'image/webp' && buf.slice(0, 4).toString() === 'RIFF') || (mime === 'image/gif' && buf.slice(0, 3).toString() === 'GIF');
      if (!ok) throw httpError(400, 'That picture is not a valid image.');
    }
    const id = uid(10);
    await store.putFile('community/' + id, buf, mime);
    file = { id, name, mime, size: buf.length, kind: isImg ? 'image' : 'file' };
  }
  if (!text && !file) throw httpError(400, 'Type a message or attach a file first.');
  let replyTo = null;
  if (ctx.body.replyTo) {
    const p = db.communityMsgs.find(x => x.id === String(ctx.body.replyTo) && x.courseId === ctx.params.id);
    if (p) replyTo = p.id;
  }
  const msg = { id: uid(10), courseId: ctx.params.id, userId: user.id, authorName: isStaff(user) ? user.name : user.name.split(' ')[0], role: isStaff(user) ? 'staff' : 'student', text, replyTo, file, createdAt: now(), hidden: false };
  db.communityMsgs.push(msg);
  if (db.communityMsgs.length > 20000) db.communityMsgs = db.communityMsgs.slice(-20000);
  save();
  sendEvent(null, 'community', { courseId: ctx.params.id });
  const byId = new Map([[msg.id, msg]]);
  if (replyTo) byId.set(replyTo, db.communityMsgs.find(x => x.id === replyTo));
  json(ctx.res, 201, { message: communityMsgView(msg, user, byId) });
});
route('DELETE', '/api/community/chat/:id', async ctx => {
  const user = requireUser(ctx);
  const m = db.communityMsgs.find(x => x.id === ctx.params.id);
  if (!m) throw httpError(404, 'That message is already gone.');
  if (m.userId !== user.id && !isStaff(user)) throw httpError(403, 'You can only delete your own messages.');
  if (m.file) { store.deleteFiles(['community/' + m.file.id]).catch(() => {}); }
  // Keep a small "this message was deleted" mark so replies to it still make sense, like WhatsApp
  m.deletedAt = now(); m.text = ''; m.file = null; m.deletedBy = user.id;
  save();
  sendEvent(null, 'community', { courseId: m.courseId });
  json(ctx.res, 200, { ok: true });
});
route('GET', '/api/community/files/:id', async ctx => {
  const user = requireUser(ctx);
  const m = db.communityMsgs.find(x => x.file && x.file.id === ctx.params.id);
  if (!m || !canSeeCourse(user, m.courseId)) throw httpError(404, 'File not found');
  const data = await store.getFile('community/' + m.file.id);
  if (!data) throw httpError(404, 'File not found');
  const inline = m.file.kind === 'image' && ctx.query.get('download') !== '1';
  ctx.res.writeHead(200, { 'Content-Type': m.file.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': (inline ? 'inline' : 'attachment') + '; filename="' + m.file.name.replace(/"/g, '') + '"', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
  ctx.res.end(data);
});
// Admin moderation: top-level messages show as posts, replies underneath
route('GET', '/api/staff/community', async ctx => {
  requireStaff(ctx);
  migrateCommunity();
  const all = db.communityMsgs.filter(m => !m.deletedAt);
  const label = m => m.text || (m.file ? '[' + (m.file.kind === 'image' ? 'Photo' : 'File') + ': ' + m.file.name + ']' : '');
  const tops = all.filter(m => !m.replyTo || !all.some(x => x.id === m.replyTo)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300);
  json(ctx.res, 200, { threads: tops.map(t => ({ id: t.id, title: label(t).slice(0, 60), body: label(t), authorName: t.authorName, hidden: !!t.hidden, createdAt: t.createdAt,
    course: (db.courses.find(c => c.id === t.courseId) || {}).title || '', replies: all.filter(r => r.replyTo === t.id).map(r => ({ id: r.id, body: label(r), authorName: r.authorName, hidden: !!r.hidden })) })) });
});
route('PATCH', '/api/staff/community/:kind/:id', async ctx => {
  requireStaff(ctx);
  if (!['threads', 'replies'].includes(ctx.params.kind)) throw httpError(404, 'Not found');
  const it = db.communityMsgs.find(x => x.id === ctx.params.id);
  if (!it) throw httpError(404, 'Not found');
  it.hidden = !!ctx.body.hidden; save();
  sendEvent(null, 'community', { courseId: it.courseId });
  json(ctx.res, 200, { ok: true });
});
route('DELETE', '/api/staff/community/:kind/:id', async ctx => {
  requireStaff(ctx);
  if (!['threads', 'replies'].includes(ctx.params.kind)) throw httpError(404, 'Not found');
  const it = db.communityMsgs.find(x => x.id === ctx.params.id);
  if (!it) throw httpError(404, 'Not found');
  const gone = new Set([it.id]);
  if (ctx.params.kind === 'threads') db.communityMsgs.forEach(r => { if (r.replyTo === it.id) gone.add(r.id); });
  const files = db.communityMsgs.filter(m => gone.has(m.id) && m.file).map(m => 'community/' + m.file.id);
  if (files.length) store.deleteFiles(files).catch(() => {});
  db.communityMsgs = db.communityMsgs.filter(m => !gone.has(m.id));
  save(); sendEvent(null, 'community', { courseId: it.courseId });
  json(ctx.res, 200, { ok: true });
});
route('POST', '/api/staff/users/:id/suspend', async ctx => {
  requireStaff(ctx, true);
  const u = db.users.find(x => x.id === ctx.params.id);
  if (!u || u.role !== 'student') throw httpError(404, 'Student not found');
  u.suspended = !!ctx.body.suspended; save(); json(ctx.res, 200, { ok: true, suspended: u.suspended });
});

/* ============ Talent: student portfolios (approved by the team) ============ */
route('GET', '/api/me/portfolio', async ctx => {
  const user = requireUser(ctx);
  const p = db.portfolios.find(x => x.userId === user.id) || null;
  json(ctx.res, 200, { portfolio: p, hasCertificate: db.certificates.some(c => c.userId === user.id) });
});
route('POST', '/api/me/portfolio', async ctx => {
  const user = requireUser(ctx);
  if (!db.certificates.some(c => c.userId === user.id)) throw httpError(403, 'Portfolios are for students who have earned a certificate.');
  const b = ctx.body;
  const headline = clean(b.headline, 120), bio = clean(b.bio, 800), workUrl = clean(b.workUrl, 300);
  const skills = (Array.isArray(b.skills) ? b.skills : String(b.skills || '').split(',')).map(x => clean(x, 40)).filter(Boolean).slice(0, 12);
  if (headline.length < 5) throw httpError(400, 'Add a short headline, for example "Video editor for brands".');
  if (workUrl && !/^https?:\/\//i.test(workUrl)) throw httpError(400, 'The work link must start with http:// or https://');
  const existing = db.portfolios.find(x => x.userId === user.id);
  const data = { headline, bio, skills, workUrl, status: 'pending', updatedAt: now() };
  if (existing) Object.assign(existing, data); else db.portfolios.push(Object.assign({ id: uid(8), userId: user.id, name: user.name, createdAt: now() }, data));
  save(); json(ctx.res, 200, { ok: true, message: 'Thank you. Your profile is waiting for approval.' });
});
route('GET', '/api/talent', async ctx => {
  json(ctx.res, 200, { talent: db.portfolios.filter(p => p.status === 'approved').map(p => ({ id: p.id, name: p.name.split(' ')[0] + (p.name.split(' ')[1] ? ' ' + p.name.split(' ')[1][0] + '.' : ''), headline: p.headline, bio: p.bio, skills: p.skills, workUrl: p.workUrl,
    verified: db.certificates.some(c => c.userId === p.userId) })) });
});
route('GET', '/api/staff/portfolios', async ctx => {
  requireStaff(ctx);
  json(ctx.res, 200, { portfolios: db.portfolios.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).map(p => Object.assign({}, p, { email: (db.users.find(u => u.id === p.userId) || {}).email || '' })) });
});
route('PATCH', '/api/staff/portfolios/:id', async ctx => {
  requireStaff(ctx);
  const p = db.portfolios.find(x => x.id === ctx.params.id);
  if (!p) throw httpError(404, 'Profile not found');
  if (!['pending', 'approved', 'rejected'].includes(ctx.body.status)) throw httpError(400, 'Invalid status.');
  p.status = ctx.body.status; save();
  if (p.status === 'approved') notify(p.userId, 'Your profile is live', 'Your talent profile is now visible to customers.', '#portfolio', { kind: 'update' });
  json(ctx.res, 200, { ok: true });
});

/* ============ Challenges: monthly student competitions ============ */
route('GET', '/api/challenges', async ctx => {
  const user = ctx.user;
  json(ctx.res, 200, { challenges: db.challenges.slice().sort((a, b) => (b.deadline || '').localeCompare(a.deadline || '')).map(c => {
    const winners = db.challengeEntries.filter(e => e.challengeId === c.id && e.winner);
    return { id: c.id, title: c.title, description: c.description, rules: c.rules, category: c.category, deadline: c.deadline,
      open: new Date(c.deadline + 'T23:59:59').getTime() > Date.now(), entries: db.challengeEntries.filter(e => e.challengeId === c.id).length,
      winners: winners.map(w => ({ name: w.name, link: w.link, note: w.note })),
      showcase: db.challengeEntries.filter(e => e.challengeId === c.id && e.showcased).map(w => ({ name: w.name, link: w.link, note: w.note })),
      entered: user ? db.challengeEntries.some(e => e.challengeId === c.id && e.userId === user.id) : false };
  }) });
});
route('POST', '/api/challenges/:id/enter', async ctx => {
  const user = requireUser(ctx);
  const c = db.challenges.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Challenge not found');
  if (new Date(c.deadline + 'T23:59:59').getTime() < Date.now()) throw httpError(400, 'This challenge has closed.');
  if (db.challengeEntries.some(e => e.challengeId === c.id && e.userId === user.id)) throw httpError(400, 'You have already entered this challenge.');
  const link = clean(ctx.body.link, 300), note = clean(ctx.body.note, 400);
  if (!/^https?:\/\//i.test(link)) throw httpError(400, 'Paste a link to your work (Google Drive or YouTube).');
  db.challengeEntries.push({ id: uid(8), challengeId: c.id, userId: user.id, name: user.name.split(' ')[0], link, note, status: 'entered', winner: false, showcased: false, createdAt: now() });
  save(); json(ctx.res, 201, { ok: true, message: 'Your entry is in. Good luck!' });
});
route('GET', '/api/staff/challenges', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { challenges: db.challenges.map(c => Object.assign({}, c, { entries: db.challengeEntries.filter(e => e.challengeId === c.id).length })) });
});
route('POST', '/api/staff/challenges', async ctx => {
  requireStaff(ctx, true);
  const b = ctx.body, title = clean(b.title, 120);
  if (title.length < 3) throw httpError(400, 'Give the challenge a title.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.deadline || ''))) throw httpError(400, 'Choose the closing date.');
  db.challenges.push({ id: uid(8), title, description: clean(b.description, 1000), rules: clean(b.rules, 1000), category: clean(b.category, 60), deadline: b.deadline, createdAt: now() });
  save(); json(ctx.res, 201, { ok: true });
});
route('PATCH', '/api/staff/challenges/:id', async ctx => {
  requireStaff(ctx, true);
  const c = db.challenges.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Challenge not found');
  const b = ctx.body;
  if (b.title !== undefined) c.title = clean(b.title, 120);
  if (b.description !== undefined) c.description = clean(b.description, 1000);
  if (b.rules !== undefined) c.rules = clean(b.rules, 1000);
  if (b.category !== undefined) c.category = clean(b.category, 60);
  if (b.deadline !== undefined) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.deadline))) throw httpError(400, 'Choose a valid closing date.'); c.deadline = b.deadline; }
  save(); json(ctx.res, 200, { ok: true });
});
route('DELETE', '/api/staff/challenges/:id', async ctx => {
  requireStaff(ctx, true);
  db.challenges = db.challenges.filter(x => x.id !== ctx.params.id); db.challengeEntries = db.challengeEntries.filter(e => e.challengeId !== ctx.params.id);
  save(); json(ctx.res, 200, { ok: true });
});
route('GET', '/api/staff/challenges/:id/entries', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { entries: db.challengeEntries.filter(e => e.challengeId === ctx.params.id).map(e => Object.assign({}, e, { email: (db.users.find(u => u.id === e.userId) || {}).email || '' })) });
});
route('PATCH', '/api/staff/challenge-entries/:id', async ctx => {
  requireStaff(ctx, true);
  const e = db.challengeEntries.find(x => x.id === ctx.params.id);
  if (!e) throw httpError(404, 'Entry not found');
  if (ctx.body.winner === true) {
    db.challengeEntries.filter(x => x.challengeId === e.challengeId && x.winner).forEach(x => { x.winner = false; });
    e.winner = true; e.showcased = true;
    notify(e.userId, 'You won!', 'Your entry was picked as the winner. Congratulations from DEBONE.', '#overview', { kind: 'update' });
  }
  if (ctx.body.winner === false) e.winner = false;
  if (ctx.body.showcased !== undefined) e.showcased = !!ctx.body.showcased;
  save(); json(ctx.res, 200, { ok: true });
});

/* ============ Referrals ============ */
route('GET', '/api/staff/referrals', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { referrers: db.users.filter(u => u.referralCode && db.users.some(x => x.referredBy === u.referralCode)).map(u => ({
    name: u.name, email: u.email, code: u.referralCode, referred: db.users.filter(x => x.referredBy === u.referralCode).length,
    paidFriends: new Set(db.referralEvents.filter(e => e.referrerId === u.id).map(e => e.refereeId)).size,
    earned: db.referralEvents.filter(e => e.referrerId === u.id).reduce((t, e) => t + e.rewardNaira, 0),
    balance: db.referralEvents.filter(e => e.referrerId === u.id && !e.withdrawalId).reduce((t, e) => t + e.rewardNaira, 0) })) });
});
route('POST', '/api/me/certificates/request', async ctx => {
  const user = requireUser(ctx);
  const course = db.courses.find(c => c.id === clean(ctx.body.courseId, 80));
  if (!course || !courseAccess(user, course)) throw httpError(404, 'Course not found');
  if (db.certificates.some(c => c.userId === user.id && c.courseId === course.id)) throw httpError(400, 'You already have this certificate.');
  if (db.certRequests.some(r => r.userId === user.id && r.courseId === course.id && r.status === 'requested')) throw httpError(400, 'Your request is already waiting for approval.');
  if (!courseProgress(user, course).complete) throw httpError(400, 'Finish every lesson and pass every assignment (50% or more) before you request a certificate.');
  db.certRequests.push({ id: uid(8), userId: user.id, courseId: course.id, status: 'requested', createdAt: now() });
  save(); json(ctx.res, 201, { ok: true, message: 'Request sent. Our team will review it and issue your certificate.' });
});
route('GET', '/api/staff/cert-requests', async ctx => {
  requireStaff(ctx);
  json(ctx.res, 200, { requests: db.certRequests.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => {
    const u = db.users.find(x => x.id === r.userId) || {}, c = db.courses.find(x => x.id === r.courseId) || {};
    return { id: r.id, status: r.status, reason: r.reason || '', createdAt: r.createdAt, student: u.name || '', email: u.email || '', course: c.title || '' };
  }) });
});
route('POST', '/api/staff/cert-requests/:id/approve', async ctx => {
  requireStaff(ctx, true);
  const r = db.certRequests.find(x => x.id === ctx.params.id);
  if (!r || r.status !== 'requested') throw httpError(400, 'This request has already been decided.');
  const u = db.users.find(x => x.id === r.userId), c = db.courses.find(x => x.id === r.courseId);
  if (!u || !c) throw httpError(404, 'Student or course not found');
  if (!db.certificates.some(x => x.userId === u.id && x.courseId === c.id)) {
    db.certificates.push({ id: uid(8), code: 'DBNC-' + uid(3).toUpperCase(), userId: u.id, courseId: c.id, courseTitle: c.title, studentName: u.name, issuedAt: now() });
  }
  r.status = 'approved'; r.decidedAt = now();
  notify(u.id, 'Certificate issued', 'Your certificate for ' + c.title + ' is ready. Open Certificates to download it.', '#certificates', { kind: 'update' });
  save(); json(ctx.res, 200, { ok: true });
});
route('POST', '/api/staff/cert-requests/:id/decline', async ctx => {
  requireStaff(ctx, true);
  const r = db.certRequests.find(x => x.id === ctx.params.id);
  if (!r || r.status !== 'requested') throw httpError(400, 'This request has already been decided.');
  const reason = clean(ctx.body.reason, 400);
  if (reason.length < 5) throw httpError(400, 'Tell the student briefly why it was declined.');
  r.status = 'declined'; r.reason = reason; r.decidedAt = now();
  const c = db.courses.find(x => x.id === r.courseId) || {};
  notify(r.userId, 'Certificate request declined', (c.title || 'Your course') + ': ' + reason, '#certificates', { kind: 'update' });
  save(); json(ctx.res, 200, { ok: true });
});

/* ============ Referral rewards and withdrawals ============ */
route('GET', '/api/me/referral', async ctx => {
  const user = requireUser(ctx);
  if (!user.referralCode) { user.referralCode = genReferralCode(); save(); }
  const sum = referralSummary(user);
  const referred = db.users.filter(u => u.referredBy === user.referralCode).map(u => {
    const ev = db.referralEvents.filter(e => e.referrerId === user.id && e.refereeId === u.id);
    return { name: u.name.split(' ')[0], paid: ev.length > 0, paidTotal: ev.reduce((t, e) => t + e.paidNaira, 0), earned: ev.reduce((t, e) => t + e.rewardNaira, 0) };
  });
  json(ctx.res, 200, { code: user.referralCode, link: `${PUBLIC_URL}/signup.html?ref=${user.referralCode}`, discountPercent: cfg('referralDiscountPercent'),
    rewardPercent: cfg('referrerRewardPercent'), min: sum.min, paidFriends: sum.paidFriends, needed: sum.needed, balance: sum.balance, eligible: sum.eligible, pending: sum.pending,
    totalEarned: db.referralEvents.filter(e => e.referrerId === user.id).reduce((t, e) => t + e.rewardNaira, 0),
    withdrawn: db.withdrawals.filter(w => w.userId === user.id && w.status === 'approved').reduce((t, w) => t + w.amountNaira, 0),
    withdrawals: db.withdrawals.filter(w => w.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(w => ({ id: w.id, amount: w.amountNaira, status: w.status, createdAt: w.createdAt, bankName: w.bankName })),
    referred });
});
route('POST', '/api/me/withdrawals', async ctx => {
  const user = requireUser(ctx);
  const sum = referralSummary(user);
  if (sum.pending) throw httpError(400, 'You already have a withdrawal waiting for approval.');
  if (sum.paidFriends < sum.min) throw httpError(400, `You need ${sum.min} referred friends who have paid before you can withdraw. You have ${sum.paidFriends} so far.`);
  if (sum.balance <= 0) throw httpError(400, 'Your balance is empty.');
  const b = ctx.body;
  const bankName = clean(b.bankName, 80), accountName = clean(b.accountName, 120), accountNumber = clean(b.accountNumber, 20).replace(/\s/g, '');
  if (bankName.length < 3) throw httpError(400, 'Enter your bank name.');
  if (accountName.length < 3) throw httpError(400, 'Enter the account name.');
  if (!/^\d{10}$/.test(accountNumber)) throw httpError(400, 'Enter a 10-digit account number.');
  const open = db.referralEvents.filter(e => e.referrerId === user.id && !e.withdrawalId);
  const w = { id: uid(8), userId: user.id, amountNaira: sum.balance, eventIds: open.map(e => e.id), bankName, accountName, accountNumber, status: 'requested', createdAt: now() };
  open.forEach(e => { e.withdrawalId = w.id; });
  db.withdrawals.push(w); save();
  json(ctx.res, 201, { ok: true, message: `Withdrawal of ₦${w.amountNaira.toLocaleString('en-US')} requested. We will send it to your account once it is approved.` });
});
route('GET', '/api/staff/withdrawals', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { withdrawals: db.withdrawals.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(w => {
    const u = db.users.find(x => x.id === w.userId) || {};
    return { id: w.id, status: w.status, amount: w.amountNaira, createdAt: w.createdAt, student: u.name || '', email: u.email || '', bankName: w.bankName, accountName: w.accountName, accountNumber: w.accountNumber, friends: new Set(db.referralEvents.filter(e => w.eventIds.includes(e.id)).map(e => e.refereeId)).size };
  }) });
});
route('PATCH', '/api/staff/withdrawals/:id', async ctx => {
  requireStaff(ctx, true);
  const w = db.withdrawals.find(x => x.id === ctx.params.id);
  if (!w || w.status !== 'requested') throw httpError(400, 'This withdrawal has already been decided.');
  if (ctx.body.status === 'approved') {
    w.status = 'approved'; w.decidedAt = now();
    notify(w.userId, 'Withdrawal approved', '₦' + w.amountNaira.toLocaleString('en-US') + ' is being sent to your bank account. Start referring again to earn your next withdrawal.', '#referrals', { kind: 'payment' });
  } else if (ctx.body.status === 'declined') {
    w.status = 'declined'; w.decidedAt = now();
    db.referralEvents.filter(e => e.withdrawalId === w.id).forEach(e => { e.withdrawalId = null; });
    notify(w.userId, 'Withdrawal not approved', 'Your rewards are back in your balance. Contact us on WhatsApp if you have questions.', '#referrals', { kind: 'update' });
  } else throw httpError(400, 'Choose approved or declined.');
  save(); json(ctx.res, 200, { ok: true });
});

/* ---------- Shop products (create, edit, delete, images) ---------- */
route('GET', '/api/products', async ctx => {
  json(ctx.res, 200, { categories: categoriesOf(), products: db.products.map(productView) });
});
route('GET', '/api/products/:id', async ctx => {
  const p = db.products.find(x => x.id === ctx.params.id);
  if (!p) throw httpError(404, 'Product not found');
  json(ctx.res, 200, { product: productView(p), categories: categoriesOf() });
});
route('GET', '/api/products/:id/image', async ctx => {
  const p = db.products.find(x => x.id === ctx.params.id);
  if (!p || !p.imageData) throw httpError(404, 'No image');
  ctx.res.writeHead(200, { 'Content-Type': p.imageData.mime, 'Cache-Control': 'no-cache' });
  ctx.res.end(Buffer.from(p.imageData.b64, 'base64'));
});
function productInput(b, existing) {
  const name = clean(b.name, 120);
  if (name.length < 2) throw httpError(400, 'Please enter the product name.');
  const cat = clean(b.cat, 40);
  if (!categoriesOf().some(c => c.id === cat)) throw httpError(400, 'Please choose a category.');
  const priceRaw = String(b.price == null ? '' : b.price).trim();
  let price = null;
  if (priceRaw !== '') {
    price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0 || price > 100000000) throw httpError(400, 'Enter a valid price, or leave it blank for "Price on request".');
  }
  return { name, cat, summary: clean(b.summary, 200), description: clean(b.description, 2000), price };
}
route('POST', '/api/staff/products', async ctx => {
  requireStaff(ctx, true);
  const input = productInput(ctx.body);
  let id = slugify(input.name), n = 2;
  while (db.products.some(p => p.id === id)) id = slugify(input.name) + '-' + n++;
  const p = Object.assign({ id, imageUrl: null, imageData: null, createdAt: now(), updatedAt: now() }, input);
  db.products.push(p); save();
  json(ctx.res, 201, { product: productView(p) });
});
route('PATCH', '/api/staff/products/:id', async ctx => {
  requireStaff(ctx, true);
  const p = db.products.find(x => x.id === ctx.params.id);
  if (!p) throw httpError(404, 'Product not found');
  Object.assign(p, productInput(ctx.body, p), { updatedAt: now() });
  save();
  json(ctx.res, 200, { product: productView(p) });
});
route('DELETE', '/api/staff/products/:id', async ctx => {
  requireStaff(ctx, true);
  db.products = db.products.filter(x => x.id !== ctx.params.id);
  save();
  json(ctx.res, 200, { ok: true });
});
route('POST', '/api/staff/products/:id/image', async ctx => {
  requireStaff(ctx, true);
  const p = db.products.find(x => x.id === ctx.params.id);
  if (!p) throw httpError(404, 'Product not found');
  p.imageData = validImage(ctx.body.data); p.imageUrl = null; p.updatedAt = now(); save();
  json(ctx.res, 200, { product: productView(p) });
});
route('DELETE', '/api/staff/products/:id/image', async ctx => {
  requireStaff(ctx, true);
  const p = db.products.find(x => x.id === ctx.params.id);
  if (!p) throw httpError(404, 'Product not found');
  p.imageData = null; p.imageUrl = null; p.updatedAt = now(); save();
  json(ctx.res, 200, { product: productView(p) });
});

/* ---------- Selected work (homepage "Recent frames") ---------- */
route('GET', '/api/works', async ctx => {
  json(ctx.res, 200, { works: db.works.slice().reverse().map(workView) });
});
route('GET', '/api/works/:id/image', async ctx => {
  const w = db.works.find(x => x.id === ctx.params.id);
  if (!w || !w.imageData) throw httpError(404, 'No image');
  ctx.res.writeHead(200, { 'Content-Type': w.imageData.mime, 'Cache-Control': 'no-cache' });
  ctx.res.end(Buffer.from(w.imageData.b64, 'base64'));
});
function workInput(b) {
  const title = clean(b.title, 120);
  if (title.length < 2) throw httpError(400, 'Please enter a title for this work.');
  const category = slugify(b.category || 'studio');
  return { title, category, caption: clean(b.caption, 40) || category, alt: clean(b.alt, 160) || title };
}
route('POST', '/api/staff/works', async ctx => {
  requireStaff(ctx, true);
  const input = workInput(ctx.body);
  const w = Object.assign({ id: 'work-' + uid(6), imageUrl: null, imageData: null, createdAt: now(), updatedAt: now() }, input);
  if (ctx.body.data) w.imageData = validImage(ctx.body.data); else throw httpError(400, 'Please add an image for this work.');
  db.works.push(w); save();
  json(ctx.res, 201, { work: workView(w) });
});
route('PATCH', '/api/staff/works/:id', async ctx => {
  requireStaff(ctx, true);
  const w = db.works.find(x => x.id === ctx.params.id);
  if (!w) throw httpError(404, 'Work not found');
  Object.assign(w, workInput(ctx.body), { updatedAt: now() });
  save();
  json(ctx.res, 200, { work: workView(w) });
});
route('DELETE', '/api/staff/works/:id', async ctx => {
  requireStaff(ctx, true);
  db.works = db.works.filter(x => x.id !== ctx.params.id);
  save();
  json(ctx.res, 200, { ok: true });
});
route('POST', '/api/staff/works/:id/image', async ctx => {
  requireStaff(ctx, true);
  const w = db.works.find(x => x.id === ctx.params.id);
  if (!w) throw httpError(404, 'Work not found');
  w.imageData = validImage(ctx.body.data); w.imageUrl = null; w.updatedAt = now(); save();
  json(ctx.res, 200, { work: workView(w) });
});

/* ---------- Newsletter (footer sign-up) ---------- */
route('POST', '/api/newsletter', async ctx => {
  if (limited('nl:' + clientIp(ctx.req), 6, 15 * 60 * 1000)) throw httpError(429, 'Too many attempts. Please try again later.');
  const email = clean(ctx.body.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Please enter a valid email address.');
  if (!db.newsletter) db.newsletter = [];
  const existing = db.newsletter.find(n => n.email === email);
  if (existing) {
    if (!existing.coupon) { existing.coupon = newCoupon(); save(); }
    return json(ctx.res, 200, { ok: true, message: "You are already subscribed. Here is your coupon.", coupon: existing.couponUsed ? null : existing.coupon, discount: 30 });
  }
  const rec = { email, createdAt: now(), coupon: newCoupon(), couponUsed: false };
  db.newsletter.push(rec);
  save();
  json(ctx.res, 201, { ok: true, message: 'Thank you. Your 30% coupon is ready.', coupon: rec.coupon, discount: 30 });
});

route('GET', '/api/staff/newsletter', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { subscribers: (db.newsletter || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});

route('DELETE', '/api/staff/newsletter', async ctx => {
  requireStaff(ctx, true);
  const email = clean(ctx.query.get('email'), 120).toLowerCase();
  db.newsletter = (db.newsletter || []).filter(n => n.email !== email);
  save();
  json(ctx.res, 200, { ok: true });
});

route('GET', '/api/auth/google', async ctx => {
  if (!process.env.GOOGLE_CLIENT_ID) return redirect(ctx.res, '/login.html?error=google');
  const state = crypto.randomBytes(16).toString('hex');
  const remember = ctx.query.get('remember') === '1' ? '1' : '0';
  const ref = clean(ctx.query.get('ref'), 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const qr = qrSourceOf(ctx.query.get('qr'));
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${PUBLIC_URL}/api/auth/google/callback`,
    response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account'
  });
  redirect(ctx.res, 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(),
    { 'Set-Cookie': [`gstate=${state}.${remember}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${COOKIE_SECURE ? '; Secure' : ''}`,
      `gref=${ref}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${COOKIE_SECURE ? '; Secure' : ''}`,
      `gqr=${qr}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${COOKIE_SECURE ? '; Secure' : ''}`] });
});

route('GET', '/api/auth/google/callback', async ctx => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return redirect(ctx.res, '/login.html?error=google');
  const raw = (ctx.req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('gstate='));
  const [savedState, remember] = raw ? raw.slice(7).split('.') : [];
  const code = ctx.query.get('code');
  if (!savedState || !code || savedState !== ctx.query.get('state')) return redirect(ctx.res, '/login.html?error=google');
  try {
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${PUBLIC_URL}/api/auth/google/callback`, grant_type: 'authorization_code' })
    });
    const tok = await tr.json();
    if (!tok.access_token) throw new Error('no token');
    const info = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } })).json();
    if (!info.email || info.email_verified === false) throw new Error('email not verified');
    const email = String(info.email).toLowerCase();
    let user = db.users.find(u => u.email === email);
    if (!user) {
      const gr = (ctx.req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('gref='));
      const refCode = gr ? gr.slice(5).toUpperCase() : '';
      const referrer = refCode ? db.users.find(u => u.referralCode === refCode && u.email !== email) : null;
      user = { id: uid(), name: clean(info.name || email.split('@')[0], 80), email, phone: '', role: 'student',
        passHash: hashPassword(crypto.randomBytes(24).toString('hex')), createdAt: now(), profile: {},
        referralCode: genReferralCode(), referredBy: referrer ? referrer.referralCode : null };
      const gq = (ctx.req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('gqr='));
      recordQrSignup(user, gq ? qrSourceOf(gq.slice(4)) : '');
      db.users.push(user); save();
    }
    if (isStaff(user)) return redirect(ctx.res, '/staff-login.html');
    return redirect(ctx.res, '/dashboard.html', { 'Set-Cookie': sessionCookie(user, remember === '1') });
  } catch (e) {
    console.error('Google sign-in failed:', e.message);
    return redirect(ctx.res, '/login.html?error=google');
  }
});

/* ---------- Student dashboard ---------- */
route('GET', '/api/dashboard', async ctx => {
  const user = requireUser(ctx);
  const courses = db.courses.map(c => courseView(c, user));
  const enrolled = courses.filter(c => c.enrolled);
  let next = null;
  for (const c of enrolled) {
    const l = c.lessons.find(x => !x.completed && !x.locked);
    if (l) { next = { courseId: c.id, courseTitle: c.title, lessonId: l.id, lessonTitle: l.title }; break; }
  }
  const payments = db.payments.filter(p => p.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
    .map(p => ({ reference: p.reference, courseTitle: (db.courses.find(c => c.id === p.courseId) || {}).title || 'Course', amount: p.amountKobo / 100, status: p.status, createdAt: p.createdAt }));
  const liveNow = db.sessions.filter(s => s.status === 'live' && enrolled.some(c => c.id === s.courseId))
    .map(s => sessionView(s, user));
  json(ctx.res, 200, {
    user: publicUser(user),
    stats: {
      enrolled: enrolled.length,
      completedLessons: enrolled.reduce((s, c) => s + c.completed, 0),
      totalLessons: enrolled.reduce((s, c) => s + c.total, 0),
      avgProgress: enrolled.length ? Math.round(enrolled.reduce((s, c) => s + c.progress, 0) / enrolled.length) : 0
    },
    next, courses, liveNow, announcements: db.announcements, payments
  });
});

/* ---------- Courses and lessons ---------- */
route('GET', '/api/course-categories', async ctx => json(ctx.res, 200, { categories: COURSE_CATEGORIES }));
route('GET', '/api/courses', async ctx => json(ctx.res, 200, { currency: CURRENCY, courses: db.courses.map(c => courseView(c, ctx.user)) }));

route('GET', '/api/courses/:id', async ctx => {
  const course = db.courses.find(c => c.id === ctx.params.id);
  if (!course) throw httpError(404, 'Course not found');
  json(ctx.res, 200, { course: courseView(course, ctx.user) });
});

route('POST', '/api/courses/:id/enroll', async ctx => {
  const user = requireUser(ctx);
  const course = db.courses.find(c => c.id === ctx.params.id);
  if (!course) throw httpError(404, 'Course not found');
  if (course.comingSoon) throw httpError(403, 'This course is coming soon. Enrolment will open later.');
  if (course.price === 0) return json(ctx.res, 200, { free: true, courseId: course.id });
  if (enrollmentFor(user.id, course.id)) return json(ctx.res, 200, { alreadyEnrolled: true, courseId: course.id });
  let amountKobo = course.price * 100, couponCode = '';
  const code = clean(ctx.body.coupon, 20).toUpperCase();
  if (code) {
    const sub = (db.newsletter || []).find(n => n.coupon === code);
    if (!sub || sub.email !== user.email || sub.couponUsed) throw httpError(400, 'That coupon code is not valid for your account.');
    amountKobo = Math.round(course.price * 100 * 0.7);
    couponCode = code;
  } else {
    const first = !db.payments.some(x => x.userId === user.id && x.status === 'success');
    const refPct = user.referredBy && first ? cfg('referralDiscountPercent') : 0, qr = qrOffer(user), qrPct = qr ? qr.percent : 0;
    const pct = Math.max(refPct, qrPct);   // one discount only: whichever is bigger
    if (pct > 0) { amountKobo = Math.round(course.price * 100 * (100 - pct) / 100); couponCode = qrPct >= refPct ? 'QR' + qr.source.toUpperCase().slice(0, 12) : 'REFERRAL'; }
  }
  return json(ctx.res, 200, { order: orderView(createOrder(user, { kind: 'course', courseId: course.id, amountNaira: amountKobo / 100 })) });
});

route('GET', '/api/payments', async ctx => {
  const user = requireUser(ctx);
  const list = db.payments.filter(p => p.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(p => ({ reference: p.reference, courseId: p.courseId, courseTitle: (db.courses.find(c => c.id === p.courseId) || {}).title || 'Course', amount: p.amountKobo / 100, status: p.status, createdAt: p.createdAt, paidAt: p.paidAt || null }));
  json(ctx.res, 200, { payments: list });
});

route('GET', '/api/payments/verify', async ctx => {
  const user = requireUser(ctx);
  const reference = ctx.query.get('reference') || '';
  if (!db.payments.find(p => p.reference === reference && p.userId === user.id)) throw httpError(404, 'Payment not found');
  const result = await fulfil(reference);
  json(ctx.res, 200, { status: result.status, courseId: result.courseId });
});

route('GET', '/api/lessons/:id', async ctx => {
  const user = requireUser(ctx);
  const entry = findLesson(ctx.params.id);
  if (!entry) throw httpError(404, 'Lesson not found');
  const { course, lesson } = entry;
  if (!(lesson.free || courseAccess(user, course))) {
    return json(ctx.res, 403, { error: 'locked', message: 'This lesson unlocks when you enrol in the course.', course: { id: course.id, title: course.title, price: course.price, comingSoon: !!course.comingSoon } });
  }
  const idx = course.lessons.findIndex(l => l.id === lesson.id);
  const done = validLessonCompletion(user, course, lesson);
  const cv = courseView(course, user).lessons[idx];
  if (cv && cv.gated) {
    const prevL = course.lessons[idx - 1];
    return json(ctx.res, 403, { error: 'This lesson is still locked.', gated: true, waiting: !!cv.waiting, opensOn: cv.opensOn || null, opensOnLabel: cv.opensOn ? fmtDay(cv.opensOn) : null, message: cv.lockReason, previous: { id: prevL.id, title: prevL.title, number: idx } });
  }
  const nextLesson = course.lessons[idx + 1];
  const nextCv = nextLesson ? courseView(course, user).lessons[idx + 1] : null;
  const journey = {
    requirements: lessonRequirements(user, course, lesson),
    sessions: lessonSessions(course, lesson).map(s => sessionView(s, user)),
    assignments: db.assignments.filter(a => a.courseId === course.id && a.lessonId === lesson.id).map(a => {
      const mine = db.submissions.find(x => x.assignmentId === a.id && x.userId === user.id);
      return { id: a.id, title: a.title, instructions: a.instructions, dueAt: a.dueAt || null, maxMarks: a.maxMarks,
        submission: mine ? { text: mine.text, link: mine.link, submittedAt: mine.submittedAt, marks: mine.marks ?? null, feedback: mine.feedback || '', graded: mine.marks != null } : null };
    }),
    nextTitle: course.lessons[idx + 1] ? course.lessons[idx + 1].title : null,
    nextLocked: !!(nextCv && nextCv.gated), nextLockReason: nextCv ? nextCv.lockReason : '',
    nextOpensOn: nextCv ? (nextCv.opensOn || null) : null,
    nextOpensLabel: nextCv && nextCv.opensOn ? fmtDay(nextCv.opensOn) : null,
    nextOpenNow: !nextCv || !nextCv.gated
  };
  json(ctx.res, 200, {
    journey,
    lesson: { id: lesson.id, title: lesson.title, body: lesson.body },
    course: { id: course.id, title: course.title },
    prev: course.lessons[idx - 1]?.id || null, next: course.lessons[idx + 1]?.id || null, completed: done,
    nextLocked: !!(nextCv && nextCv.gated), nextWaiting: !!(nextCv && nextCv.waiting),
    position: idx + 1, total: course.lessons.length,
    resources: (lesson.resources || []).filter(r => r && /^https?:\/\//.test(r.url)).map(r => ({ title: clean(r.title, 120) || 'Resource', url: r.url })),
    note: (db.notes.find(n => n.userId === user.id && n.lessonId === lesson.id) || {}).text || '',
    minutes: lesson.minutes || null
  });
});

route('POST', '/api/lessons/:id/complete', async ctx => {
  const user = requireUser(ctx);
  const entry = findLesson(ctx.params.id);
  if (!entry) throw httpError(404, 'Lesson not found');
  if (!(entry.lesson.free || courseAccess(user, entry.course))) throw httpError(403, 'This lesson is locked.');
  if (!isStaff(user)) {
    const li = entry.course.lessons.findIndex(l => l.id === entry.lesson.id);
    const cv = courseView(entry.course, user).lessons[li];
    if (cv && cv.gated) throw httpError(403, cv.lockReason);
    const req = lessonRequirements(user, entry.course, entry.lesson);
    if (!req.ready) throw httpError(400, 'Not finished yet: ' + req.missing.join('; ') + '.');
  }
  if (!db.progress.find(p => p.userId === user.id && p.lessonId === entry.lesson.id)) {
    db.progress.push({ userId: user.id, lessonId: entry.lesson.id, completedAt: now() }); save();
  }
  json(ctx.res, 200, { ok: true });
});

/* ---------- Live classes (YouTube Live or Google Meet / Zoom links) ---------- */
function canSeeCourse(user, courseId) {
  const c = db.courses.find(x => x.id === courseId);
  return !!c && (isStaff(user) || courseAccess(user, c));
}

route('GET', '/api/courses/:id/sessions', async ctx => {
  const user = requireUser(ctx);
  if (!canSeeCourse(user, ctx.params.id)) throw httpError(403, 'Enrol in this course to join its live classes.');
  const list = db.sessions.filter(s => s.courseId === ctx.params.id)
    .sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || '')).map(s => sessionView(s, user));
  json(ctx.res, 200, { sessions: list });
});

route('GET', '/api/sessions/:id/chat', async ctx => {
  const user = requireUser(ctx);
  const s = db.sessions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Session not found');
  if (!canSeeCourse(user, s.courseId)) throw httpError(403, 'Enrol in this course to join the chat.');
  const after = ctx.query.get('after') || '';
  const msgs = db.chat.filter(m => m.sessionId === s.id && (!after || m.createdAt > after)).slice(-200)
    .map(m => ({ id: m.id, name: m.name, role: m.role, text: m.text, createdAt: m.createdAt, mine: m.userId === user.id }));
  json(ctx.res, 200, { messages: msgs, serverTime: now() });
});

route('POST', '/api/sessions/:id/chat', async ctx => {
  const user = requireUser(ctx);
  const s = db.sessions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Session not found');
  if (!canSeeCourse(user, s.courseId)) throw httpError(403, 'Enrol in this course to join the chat.');
  if (s.chatOpen === false && !isStaff(user)) throw httpError(403, 'Chat is closed for this class.');
  if (limited('chat:' + user.id, 25)) throw httpError(429, 'You are sending messages too fast. Please slow down.');
  const text = clean(ctx.body.text, 500);
  if (!text) throw httpError(400, 'Type a message first.');
  const msg = { id: uid(), sessionId: s.id, userId: user.id, name: user.name, role: user.role, text, createdAt: now() };
  db.chat.push(msg);
  if (db.chat.length > 5000) db.chat = db.chat.slice(-5000);
  save();
  json(ctx.res, 201, { message: { id: msg.id, name: msg.name, role: msg.role, text: msg.text, createdAt: msg.createdAt, mine: true } });
});

/* ---------- Assignments ---------- */
route('GET', '/api/courses/:id/assignments', async ctx => {
  const user = requireUser(ctx);
  if (!canSeeCourse(user, ctx.params.id)) throw httpError(403, 'Enrol in this course to see its assignments.');
  const list = db.assignments.filter(a => a.courseId === ctx.params.id).sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || '')).map(a => {
    const mine = db.submissions.find(s => s.assignmentId === a.id && s.userId === user.id);
    return {
      id: a.id, lessonId: a.lessonId || null, title: a.title, instructions: a.instructions, dueAt: a.dueAt || null, maxMarks: a.maxMarks,
      submission: mine ? { id: mine.id, text: mine.text, link: mine.link, submittedAt: mine.submittedAt, marks: mine.marks ?? null, feedback: mine.feedback || '', gradedAt: mine.gradedAt || null, grade: mine.marks == null ? null : gradeOf(mine.marks, a.maxMarks) } : null
    };
  });
  json(ctx.res, 200, { assignments: list });
});

route('POST', '/api/assignments/:id/submit', async ctx => {
  const user = requireUser(ctx);
  const a = db.assignments.find(x => x.id === ctx.params.id);
  if (!a) throw httpError(404, 'Assignment not found');
  if (!canSeeCourse(user, a.courseId)) throw httpError(403, 'Enrol in this course to submit.');
  const text = clean(ctx.body.text, 5000);
  const link = clean(ctx.body.link, 500);
  if (!text && !link) throw httpError(400, 'Write your answer or paste a link to your work.');
  if (link && !/^https?:\/\//i.test(link)) throw httpError(400, 'The link must start with http:// or https://');
  let sub = db.submissions.find(s => s.assignmentId === a.id && s.userId === user.id);
  if (sub && sub.marks != null && !(sub.resubmitRequested && cfgBool('allowResubmission'))) throw httpError(409, 'This assignment has been graded and can no longer be changed.');
  if (sub && sub.marks != null) { sub.marks = null; sub.gradedAt = null; sub.resubmitRequested = false; }
  if (sub) { sub.text = text; sub.link = link; sub.submittedAt = now(); }
  else { sub = { id: uid(), assignmentId: a.id, userId: user.id, text, link, submittedAt: now(), marks: null, feedback: '' }; db.submissions.push(sub); }
  save();
  json(ctx.res, 201, { ok: true, submittedAt: sub.submittedAt });
});

/* ---------- Staff: live classes, chat, assignments ---------- */
const SESSION_STATUS = ['scheduled', 'live', 'ended'];

route('POST', '/api/staff/sessions', async ctx => {
  requireStaff(ctx);
  const b = ctx.body;
  const course = db.courses.find(c => c.id === b.courseId);
  if (!course) throw httpError(400, 'Choose a course.');
  const title = clean(b.title, 120);
  if (title.length < 3) throw httpError(400, 'Give the live class a title.');
  const status = SESSION_STATUS.includes(b.status) ? b.status : 'scheduled';
  const lessonId = b.lessonId && course.lessons.some(l => l.id === b.lessonId) ? b.lessonId : null;
  const s = { id: uid(), courseId: course.id, lessonId, title, startsAt: clean(b.startsAt, 40) || null, status, durationMinutes: Math.min(600, Math.max(15, Math.round(Number(b.durationMinutes) || 120))), youtubeUrl: clean(b.youtubeUrl, 300), joinUrl: clean(b.joinUrl, 300), recordingUrl: clean(b.recordingUrl, 300), chatOpen: true, createdAt: now() };
  if (b.youtubeUrl && !youtubeId(b.youtubeUrl)) throw httpError(400, 'That YouTube link is not valid.');
  db.sessions.push(s); save();
  studentsWithAccess(course).forEach(u => notify(u.id, 'Live class scheduled', s.title + (s.startsAt ? '\nStarts ' + s.startsAt : ''), '#live', { kind: 'live', course: course.title }));
  json(ctx.res, 201, { session: sessionView(s, null) });
});

route('PATCH', '/api/staff/sessions/:id', async ctx => {
  requireStaff(ctx);
  const s = db.sessions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Session not found');
  const b = ctx.body;
  if (b.title !== undefined) s.title = clean(b.title, 120);
  if (b.startsAt !== undefined) s.startsAt = clean(b.startsAt, 40) || null;
  if (b.durationMinutes !== undefined) s.durationMinutes = Math.min(600, Math.max(15, Math.round(Number(b.durationMinutes) || 120)));
  if (b.youtubeUrl !== undefined) {
    if (b.youtubeUrl && !youtubeId(b.youtubeUrl)) throw httpError(400, 'That YouTube link is not valid.');
    s.youtubeUrl = clean(b.youtubeUrl, 300);
  }
  if (b.joinUrl !== undefined) s.joinUrl = clean(b.joinUrl, 300);
  if (b.recordingUrl !== undefined) s.recordingUrl = clean(b.recordingUrl, 300);
  if (b.status !== undefined && SESSION_STATUS.includes(b.status)) {
    const wasLive = s.status === 'live';
    s.status = b.status;
    if (s.status === 'live' && !wasLive) {
      s.liveStartedAt = s.liveStartedAt || now();
      const c = db.courses.find(x => x.id === s.courseId);
      if (c) studentsWithAccess(c).forEach(u => notify(u.id, 'Class is live now', s.title + '\nJoin from your lesson or the Live classes page.', '#live', { kind: 'live', course: c.title }));
    }
  }
  if (b.chatOpen !== undefined) s.chatOpen = !!b.chatOpen;
  if (b.lessonId !== undefined) {
    const c = db.courses.find(x => x.id === s.courseId);
    s.lessonId = b.lessonId && c && c.lessons.some(l => l.id === b.lessonId) ? b.lessonId : null;
  }
  save();
  json(ctx.res, 200, { session: sessionView(s, null) });
});

route('DELETE', '/api/staff/sessions/:id', async ctx => {
  requireStaff(ctx, true);
  db.sessions = db.sessions.filter(s => s.id !== ctx.params.id);
  db.chat = db.chat.filter(m => m.sessionId !== ctx.params.id);
  save(); json(ctx.res, 200, { ok: true });
});

route('GET', '/api/staff/sessions/:id/chat', async ctx => {
  requireStaff(ctx);
  json(ctx.res, 200, { messages: db.chat.filter(m => m.sessionId === ctx.params.id).slice(-300).map(m => ({ id: m.id, name: m.name, role: m.role, text: m.text, createdAt: m.createdAt })) });
});

route('DELETE', '/api/staff/chat/:id', async ctx => {
  requireStaff(ctx);
  db.chat = db.chat.filter(m => m.id !== ctx.params.id); save();
  json(ctx.res, 200, { ok: true });
});

route('POST', '/api/staff/assignments', async ctx => {
  requireStaff(ctx);
  const b = ctx.body;
  const course = db.courses.find(c => c.id === b.courseId);
  if (!course) throw httpError(400, 'Choose a course.');
  const title = clean(b.title, 120);
  if (title.length < 3) throw httpError(400, 'Give the assignment a title.');
  const maxMarks = Math.max(1, Math.min(1000, Number(b.maxMarks) || 100));
  const lessonId = b.lessonId && course.lessons.some(l => l.id === b.lessonId) ? b.lessonId : null;
  const a = { id: uid(), courseId: course.id, lessonId, title, instructions: clean(b.instructions, 5000), dueAt: clean(b.dueAt, 40) || null, maxMarks, createdAt: now() };
  db.assignments.push(a); save();
  studentsWithAccess(course).forEach(u => notify(u.id, 'New assignment: ' + a.title,
    [a.instructions ? a.instructions.slice(0, 220) : '', a.dueAt ? 'Due ' + a.dueAt : ''].filter(Boolean).join('\n') || 'Open your assignments to see the details.',
    '#assignments', { kind: 'assignment', course: course.title, marks: a.maxMarks }));
  json(ctx.res, 201, { assignment: a });
});

route('PATCH', '/api/staff/assignments/:id', async ctx => {
  requireStaff(ctx);
  const a = db.assignments.find(x => x.id === ctx.params.id);
  if (!a) throw httpError(404, 'Assignment not found');
  const b = ctx.body;
  if (b.title !== undefined) a.title = clean(b.title, 120);
  if (b.instructions !== undefined) a.instructions = clean(b.instructions, 5000);
  if (b.dueAt !== undefined) a.dueAt = clean(b.dueAt, 40) || null;
  if (b.maxMarks !== undefined) a.maxMarks = Math.max(1, Math.min(1000, Number(b.maxMarks) || a.maxMarks));
  if (b.lessonId !== undefined) {
    const c = db.courses.find(x => x.id === a.courseId);
    a.lessonId = b.lessonId && c && c.lessons.some(l => l.id === b.lessonId) ? b.lessonId : null;
  }
  save(); json(ctx.res, 200, { assignment: a });
});

route('DELETE', '/api/staff/assignments/:id', async ctx => {
  requireStaff(ctx, true);
  db.assignments = db.assignments.filter(a => a.id !== ctx.params.id);
  db.submissions = db.submissions.filter(s => s.assignmentId !== ctx.params.id);
  save(); json(ctx.res, 200, { ok: true });
});

route('GET', '/api/staff/assignments/:id/submissions', async ctx => {
  requireStaff(ctx);
  const a = db.assignments.find(x => x.id === ctx.params.id);
  if (!a) throw httpError(404, 'Assignment not found');
  const rows = db.submissions.filter(s => s.assignmentId === a.id).map(s => {
    const u = db.users.find(x => x.id === s.userId);
    return { id: s.id, studentName: u ? u.name : 'Student', studentEmail: u ? u.email : '', text: s.text, link: s.link, submittedAt: s.submittedAt, marks: s.marks ?? null, feedback: s.feedback || '', grade: s.marks == null ? null : gradeOf(s.marks, a.maxMarks) };
  });
  json(ctx.res, 200, { assignment: { id: a.id, title: a.title, maxMarks: a.maxMarks }, submissions: rows });
});

route('POST', '/api/staff/submissions/:id/grade', async ctx => {
  requireStaff(ctx);
  const s = db.submissions.find(x => x.id === ctx.params.id);
  if (!s) throw httpError(404, 'Submission not found');
  const a = db.assignments.find(x => x.id === s.assignmentId);
  const marks = Number(ctx.body.marks);
  if (!Number.isFinite(marks) || marks < 0 || marks > a.maxMarks) throw httpError(400, `Marks must be between 0 and ${a.maxMarks}.`);
  s.marks = marks; s.feedback = clean(ctx.body.feedback, 2000); s.gradedAt = now(); s.resubmitRequested = !!ctx.body.requestResubmit; save();
  notify(s.userId, 'Your work was marked', `${a.title}: ${marks} / ${a.maxMarks} (${gradeOf(marks, a.maxMarks).label})` + (s.feedback ? '\n' + s.feedback.slice(0, 200) : ''), '#assignments', { kind: 'graded' });
  json(ctx.res, 200, { ok: true });
});

/* ---------- Admin: overview, users, courses, payments ---------- */
route('GET', '/api/staff/overview', async ctx => {
  requireStaff(ctx);
  const paid = db.payments.filter(p => p.status === 'success');
  json(ctx.res, 200, {
    users: db.users.length,
    students: db.users.filter(u => (u.role || 'student') === 'student').length,
    instructors: db.users.filter(u => u.role === 'instructor').length,
    admins: db.users.filter(u => u.role === 'admin').length,
    courses: db.courses.length,
    enrollments: db.enrollments.filter(e => e.status === 'active').length,
    revenue: paid.reduce((s, p) => s + p.amountKobo / 100, 0),
    payments: db.payments.length,
    liveNow: db.sessions.filter(s => s.status === 'live').length,
    pendingGrading: db.submissions.filter(s => s.marks == null).length,
    currency: CURRENCY
  });
});

route('GET', '/api/staff/users', async ctx => {
  requireStaff(ctx, true);
  json(ctx.res, 200, { users: db.users.map(u => ({ ...publicUser(u), enrolled: db.enrollments.filter(e => e.userId === u.id && e.status === 'active').length })) });
});

route('PATCH', '/api/staff/users/:id', async ctx => {
  const admin = requireStaff(ctx, true);
  const u = db.users.find(x => x.id === ctx.params.id);
  if (!u) throw httpError(404, 'User not found');
  const role = ctx.body.role;
  if (!['student', 'instructor', 'admin'].includes(role)) throw httpError(400, 'Choose a valid role.');
  if (u.id === admin.id && role !== 'admin') throw httpError(400, 'You cannot remove your own admin access.');
  u.role = role; save();
  json(ctx.res, 200, { user: publicUser(u) });
});

route('POST', '/api/staff/courses', async ctx => {
  requireStaff(ctx, true);
  const b = ctx.body;
  const title = clean(b.title, 120);
  if (title.length < 3) throw httpError(400, 'Give the course a title.');
  const price = Math.max(0, Math.round(Number(b.price) || 0));
  let id = slug(title);
  while (db.courses.some(c => c.id === id)) id = slug(title) + '-' + uid(2);
  const c = Object.assign({ id, title, subtitle: clean(b.subtitle, 80), summary: clean(b.summary, 500), level: clean(b.level, 30) || 'Beginner', price, lessons: [] }, courseDetailInput(b, {}));
  db.courses.push(c); save();
  json(ctx.res, 201, { course: courseView(c, null) });
});

route('PATCH', '/api/staff/courses/:id', async ctx => {
  requireStaff(ctx, true);
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Course not found');
  const b = ctx.body;
  const detail = courseDetailInput(b, c);   // validates first, so a bad value changes nothing
  const wasSoon = !!c.comingSoon;
  if (b.title !== undefined) c.title = clean(b.title, 120);
  if (b.subtitle !== undefined) c.subtitle = clean(b.subtitle, 80);
  if (b.summary !== undefined) c.summary = clean(b.summary, 500);
  if (b.level !== undefined) c.level = clean(b.level, 30);
  if (b.price !== undefined) c.price = Math.max(0, Math.round(Number(b.price) || 0));
  const oldStart = c.startDate;
  Object.assign(c, detail);
  if (wasSoon && !c.comingSoon) {
    // The class has been launched: tell everyone who asked to be told
    (db.waitlist || []).filter(w => w.courseId === c.id && !w.notifiedAt).forEach(w => {
      w.notifiedAt = now();
      notify(w.userId, c.title + ' is now open!', 'The course you were waiting for has launched. Enrol now before the offer ends.', '#course/' + c.id, { kind: 'update' });
    });
  }
  if (c.startDate && c.startDate !== oldStart) {
    db.scheduleNotices.filter(n => n.courseId === c.id && n.status === 'waiting').forEach(n => {
      n.status = 'rescheduled'; n.newStartDate = c.startDate;
      notify(n.userId, 'New start date: ' + c.title, 'Your course now starts on ' + c.startDate + '. Your place is kept.', '#courses', { kind: 'live' });
    });
  }
  save(); json(ctx.res, 200, { course: courseView(c, null) });
});

/* ---------- Course waiting list (coming-soon courses) ---------- */
route('POST', '/api/courses/:id/waitlist', async ctx => {
  const user = requireUser(ctx);
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Course not found');
  if (!c.comingSoon) throw httpError(400, 'This course is already open for enrolment.');
  db.waitlist = db.waitlist || [];
  if (!db.waitlist.some(w => w.courseId === c.id && w.userId === user.id)) {
    db.waitlist.push({ id: uid(6), courseId: c.id, userId: user.id, name: user.name, email: user.email, phone: user.phone || '', createdAt: now(), notifiedAt: null });
  }
  save(); json(ctx.res, 200, { ok: true, course: courseView(c, user) });
});
route('DELETE', '/api/courses/:id/waitlist', async ctx => {
  const user = requireUser(ctx);
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Course not found');
  db.waitlist = (db.waitlist || []).filter(w => !(w.courseId === c.id && w.userId === user.id));
  save(); json(ctx.res, 200, { ok: true, course: courseView(c, user) });
});
// Admin: who is waiting for which course, so the class can be launched when demand is high enough
route('GET', '/api/staff/waitlist', async ctx => {
  requireStaff(ctx, true);
  const list = db.waitlist || [];
  const courses = db.courses.map(c => {
    const people = list.filter(w => w.courseId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { id: c.id, title: c.title, comingSoon: !!c.comingSoon, price: c.price, minStudents: c.minStudents || null, count: people.length,
      people: people.map(w => { const u = db.users.find(x => x.id === w.userId) || {}; return { id: w.id, name: u.name || w.name, email: u.email || w.email, phone: u.phone || w.phone || '', createdAt: w.createdAt, notified: !!w.notifiedAt }; }) };
  }).filter(c => c.count > 0 || c.comingSoon);
  const bundles = db.bundles.map(b => {
    const people = list.filter(w => w.bundleId === b.id).sort((a, c) => a.createdAt.localeCompare(c.createdAt));
    return { kind: 'bundle', id: b.id, title: b.title, comingSoon: !!b.comingSoon, price: b.price, minStudents: null, count: people.length,
      people: people.map(w => { const u = db.users.find(x => x.id === w.userId) || {}; return { id: w.id, name: u.name || w.name, email: u.email || w.email, phone: u.phone || w.phone || '', createdAt: w.createdAt, notified: !!w.notifiedAt }; }) };
  }).filter(c => c.count > 0 || c.comingSoon);
  json(ctx.res, 200, { courses: courses.concat(bundles).sort((a, b) => b.count - a.count), total: list.length });
});
route('POST', '/api/staff/courses/:id/launch', async ctx => {
  requireStaff(ctx, true);
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Course not found');
  const wasSoon = !!c.comingSoon;
  c.comingSoon = false;
  let told = 0;
  if (wasSoon) (db.waitlist || []).filter(w => w.courseId === c.id && !w.notifiedAt).forEach(w => {
    w.notifiedAt = now(); told++;
    notify(w.userId, c.title + ' is now open!', 'The course you were waiting for has launched. Enrol now before the offer ends.', '#course/' + c.id, { kind: 'update' });
  });
  save(); json(ctx.res, 200, { ok: true, notified: told, course: courseView(c, null) });
});

route('DELETE', '/api/staff/courses/:id', async ctx => {
  requireStaff(ctx, true);
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Course not found');
  if (db.enrollments.some(e => e.courseId === c.id && e.status === 'active')) throw httpError(409, 'Students are enrolled in this course, so it cannot be deleted.');
  db.courses = db.courses.filter(x => x.id !== c.id);
  save(); json(ctx.res, 200, { ok: true });
});

route('POST', '/api/staff/courses/:id/lessons', async ctx => {
  requireStaff(ctx, true);
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Course not found');
  const title = clean(ctx.body.title, 120);
  if (title.length < 3) throw httpError(400, 'Give the lesson a title.');
  const body = clean(ctx.body.body, 20000).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const lesson = { id: slug(c.id + '-' + title) + '-' + uid(2), title, free: !!ctx.body.free, body: body.length ? body : ['Lesson content coming soon.'], resources: parseResources(ctx.body.resources), minutes: Math.max(0, Math.round(Number(ctx.body.minutes) || 0)) || null };
  c.lessons.push(lesson); save();
  json(ctx.res, 201, { lesson });
});

route('PATCH', '/api/staff/lessons/:id', async ctx => {
  requireStaff(ctx, true);
  const f = findLesson(ctx.params.id);
  if (!f) throw httpError(404, 'Lesson not found');
  const b = ctx.body;
  if (b.title !== undefined) f.lesson.title = clean(b.title, 120);
  if (b.free !== undefined) f.lesson.free = !!b.free;
  if (b.resources !== undefined) f.lesson.resources = parseResources(b.resources);
  if (b.minutes !== undefined) f.lesson.minutes = Math.max(0, Math.round(Number(b.minutes) || 0)) || null;
  if (b.body !== undefined) {
    const body = clean(b.body, 20000).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    f.lesson.body = body.length ? body : ['Lesson content coming soon.'];
  }
  save(); json(ctx.res, 200, { lesson: f.lesson });
});

route('DELETE', '/api/staff/lessons/:id', async ctx => {
  requireStaff(ctx, true);
  const f = findLesson(ctx.params.id);
  if (!f) throw httpError(404, 'Lesson not found');
  f.course.lessons = f.course.lessons.filter(l => l.id !== f.lesson.id); save();
  json(ctx.res, 200, { ok: true });
});

route('POST', '/api/staff/announcements', async ctx => {
  requireStaff(ctx, true);
  const title = clean(ctx.body.title, 120), body = clean(ctx.body.body, 500);
  if (!title) throw httpError(400, 'Give the announcement a title.');
  db.announcements.unshift({ title, body, createdAt: now() });
  db.announcements = db.announcements.slice(0, 20); save();
  db.users.filter(u => !isStaff(u)).forEach(u => notify(u.id, title, body || 'Open your dashboard to read the full announcement.', '#overview', { kind: 'announcement' }));
  json(ctx.res, 201, { ok: true });
});

route('GET', '/api/staff/payments', async ctx => {
  requireStaff(ctx, true);
  const rows = db.payments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(p => {
    const u = db.users.find(x => x.id === p.userId);
    return { reference: p.reference, studentName: u ? u.name : '', studentEmail: u ? u.email : '', courseTitle: (db.courses.find(c => c.id === p.courseId) || {}).title || '', amount: p.amountKobo / 100, status: p.status, createdAt: p.createdAt, paidAt: p.paidAt || null };
  });
  json(ctx.res, 200, { payments: rows });
});

/* Staff reads a course's full lesson list (including drafts) */
route('GET', '/api/staff/courses/:id', async ctx => {
  requireStaff(ctx);
  const c = db.courses.find(x => x.id === ctx.params.id);
  if (!c) throw httpError(404, 'Course not found');
  json(ctx.res, 200, { course: { ...courseView(c, null), lessons: c.lessons.map(l => ({ id: l.id, title: l.title, free: !!l.free, body: l.body.join('\n\n'), minutes: l.minutes || '', resources: (l.resources || []).map(r => r.title + ' | ' + r.url).join('\n') })), sessions: db.sessions.filter(s => s.courseId === c.id).map(s => Object.assign(sessionView(s, null), { recordingRaw: s.recordingUrl || '', r2Uploaded: !!s.r2RecordingKey })), assignments: db.assignments.filter(a => a.courseId === c.id) } });
});

route('GET', '/api/staff/me', async ctx => {
  const u = requireStaff(ctx);
  json(ctx.res, 200, { user: publicUser(u) });
});

/* Paystack webhook (server to server) */
route('POST', '/api/paystack/webhook', async ctx => {
  const raw = await readBody(ctx.req, 256 * 1024);
  const sig = String(ctx.req.headers['x-paystack-signature'] || '');
  const expected = PAYSTACK_SECRET ? crypto.createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex') : '';
  if (!expected || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return json(ctx.res, 401, { error: 'Invalid signature' });
  }
  let event = {};
  try { event = JSON.parse(raw.toString('utf8')); } catch { /* ignore */ }
  if (event.event === 'charge.success' && event.data && event.data.reference) {
    await fulfil(event.data.reference).catch(err => console.error('Webhook fulfil failed:', err.message));
  }
  json(ctx.res, 200, { received: true });
});

/* ---------- Static files ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
let pageViewsDirty = false;
function countView(p) {
  if (!/\.html$/.test(p)) return;
  const day = new Date().toISOString().slice(0, 10);
  db.pageViews = db.pageViews || {};
  db.pageViews[p] = db.pageViews[p] || {};
  db.pageViews[p][day] = (db.pageViews[p][day] || 0) + 1;
  pageViewsDirty = true;
}
function serveStatic(req, res, pathname, user) {
  let p = decodeURIComponent(pathname);
  if (p === '/') p = '/index.html';
  if (p === '/dashboard' || p === '/admin') p += '.html';   // Vercel serves clean URLs without .html
  countView(p);
  if (p === '/dashboard.html' && !user) { res.writeHead(302, { Location: '/login.html?next=dashboard' }); return res.end(); }
  if (p === '/admin.html' && !isStaff(user)) { res.writeHead(302, { Location: '/staff-login.html' }); return res.end(); }
  // The dashboard and admin pages sit outside public/ so that only signed-in people can load them (Vercel serves public/ to everyone)
  const baseDir = (p === '/dashboard.html' || p === '/admin.html') ? PRIVATE_DIR : PUBLIC_DIR;
  let file = path.join(baseDir, path.normalize(p));
  if (!file.startsWith(baseDir + path.sep) && file !== baseDir) { res.writeHead(403); return res.end('Forbidden'); }
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1 style="font-family:sans-serif">Page not found</h1><p><a href="/">Back to home</a></p>');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), geolocation=(), payment=()',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

/* ---------- Server ---------- */
/* ---------- Loading and saving the database ---------- */
let readyPromise = null;
function ensureReady() {
  if (!readyPromise) readyPromise = (async () => {
    db = await store.load();
    bootstrap();
    reconcileReferralRewards();
    await store.flush(db);
  })().catch(err => { readyPromise = null; throw err; });
  return readyPromise;
}
let lastPageViewSave = 0, lastReminderRun = 0, lastScheduleRun = 0;
function persist() {
  // Page-view counters change on almost every visit, so they are saved at most once a minute
  const skip = (pageViewsDirty && Date.now() - lastPageViewSave < 60000) ? ['pageViews'] : [];
  if (!skip.length && pageViewsDirty) { pageViewsDirty = false; lastPageViewSave = Date.now(); }
  return store.flush(db, { skipColls: skip });
}
// On a serverless host the process can stop the moment a response is sent, so every response waits until its changes are saved
function saveBeforeReply(res) {
  const realWriteHead = res.writeHead.bind(res), realEnd = res.end.bind(res);
  let head = null, finished = false;
  res.writeHead = function (...a) { head = a; return res; };
  res.end = function (...a) {
    if (finished) return res;
    finished = true;
    persist().then(() => {
      if (head) realWriteHead(...head);
      realEnd(...a);
    }, err => {
      console.error('Saving to the database failed:', err.message);
      realWriteHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      realEnd(JSON.stringify({ error: 'Something went wrong while saving. Please try again.' }));
    });
    return res;
  };
}
// Things the old server did on timers. They now run when the site is visited (and once a day from the Vercel cron job).
function runDueTasks(force) {
  const t = Date.now();
  if (force || t - lastReminderRun > 60 * 1000) { lastReminderRun = t; runSessionReminders(); }
  if (force || t - lastScheduleRun > 60 * 60 * 1000) { lastScheduleRun = t; runScheduleChecks(); }
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    if (pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(`User-agent: *\nDisallow: /api/\nDisallow: /dashboard.html\nDisallow: /admin.html\nDisallow: /staff-login.html\nDisallow: /reset-password.html\nDisallow: /forgot-password.html\n\nSitemap: ${PUBLIC_URL}/sitemap.xml\n`);
    }
    if (pathname === '/sitemap.xml') {
      const pages = ['', 'works.html', 'services.html', 'products.html', 'nin.html', 'academy.html', 'privacy.html', 'terms.html', 'refund-policy.html'];
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        pages.map(p => `  <url><loc>${PUBLIC_URL}/${p}</loc></url>`).join('\n') + '\n</urlset>\n';
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(xml);
    }
    if (pathname === '/api/events' && ON_VERCEL) {
      // Serverless functions cannot hold a connection open. 204 tells the browser to stop; the page then checks for updates every few seconds instead.
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }
    if (pathname === '/api/events') {
      await ensureReady();
      const user = readSession(req);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 4000\n\n');
      const client = { res, userId: user ? user.id : null };
      clients.add(client);
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clearInterval(ping); clients.delete(client); });
      return;
    }
    await ensureReady();
    if (pathname === '/api/live/rev') {
      // Tiny "has anything changed?" check that pages ask about every second. It skips the heavy save work below.
      if (!revPending || Date.now() - revAt > 300) {
        revAt = Date.now();
        revPending = store.refresh(db).then(d => { db = d; return store.rev(); }).catch(() => store.rev());
      }
      const rev = await revPending;
      return json(res, 200, { rev });
    }
    saveBeforeReply(res);
    db = await store.refresh(db);
    if (ADMIN_EMAILS.length) db.users.forEach(u => { if (ADMIN_EMAILS.includes(String(u.email).toLowerCase()) && u.role !== 'admin') u.role = 'admin'; });
    runDueTasks(false);
    if (pathname === '/api/cron') {
      // Called once a day by Vercel Cron. Vercel sends the CRON_SECRET as a bearer token.
      if (!process.env.CRON_SECRET || req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) return json(res, 401, { error: 'Not allowed' });
      runDueTasks(true);
      return json(res, 200, { ok: true, ran: ['reminders', 'schedule checks'] });
    }
    if (pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        // Browsers send Origin on every change request. Reject requests made from another website.
        const origin = req.headers.origin;
        if (origin) {
          let oh = '';
          try { oh = new URL(origin).host; } catch (e) { oh = ''; }
          const allowed = [req.headers.host, new URL(PUBLIC_URL).host];
          if (!oh || !allowed.includes(oh)) return json(res, 403, { error: 'This request was blocked for security reasons.' });
        }
      }
      const found = routes.map(r => ({ r, m: r.method === req.method ? r.re.exec(pathname) : null })).find(x => x.m);
      if (!found) {
        const exists = routes.some(r => r.re.test(pathname));
        return json(res, exists ? 405 : 404, { error: exists ? 'Method not allowed' : 'Not found' });
      }
      const ctx = { req, res, params: found.m.groups || {}, query: url.searchParams, user: readSession(req), body: null };
      if (!/^\/api\/(events|live|staff\/live-stats)/.test(pathname)) touchPresence(req, ctx.user, pathname);
      if (['POST', 'PATCH', 'PUT'].includes(req.method) && !pathname.endsWith('/webhook')) ctx.body = await readJson(req, pathname.endsWith('/proof') ? 4.2 * 1024 * 1024 : pathname.endsWith('/community/chat') ? 3.6 * 1024 * 1024 : (pathname.endsWith('/avatar') || pathname.endsWith('/image') || pathname.startsWith('/api/staff/works') || pathname.startsWith('/api/staff/bundles') || pathname.startsWith('/api/staff/products') || pathname.startsWith('/api/staff/services')) ? 400 * 1024 : 100 * 1024);
      const out = await found.r.handler(ctx);
      if (req.method !== 'GET' && !/\/(chat|notifications|events|qr\/scan)/.test(pathname)) broadcastRefresh();
      return out;
    }
    { const u = readSession(req); if (/\.html$|^\/$/.test(pathname)) touchPresence(req, u, pathname); return serveStatic(req, res, pathname, u); }
  } catch (err) {
    if (err.status) return json(res, err.status, { error: err.message });
    console.error(err);
    return json(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
const server = http.createServer(handler);

/* Command line tools and the local server. Not used on Vercel, which loads this file as a function (see api/index.js). */
async function main() {
  await ensureReady();
  const caIdx = process.argv.indexOf('--create-admin');
  if (caIdx > -1) {
    const email = String(process.argv[caIdx + 1] || '').toLowerCase().trim();
    const password = String(process.argv[caIdx + 2] || '');
    const name = String(process.argv[caIdx + 3] || 'Administrator').slice(0, 80);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      console.log('Usage: node server/server.js --create-admin you@example.com "your password (8+ characters)" "Your Name"');
      process.exit(1);
    }
    const existing = db.users.find(u => u.email === email);
    if (existing) { existing.role = 'admin'; existing.passHash = hashPassword(password); }
    else db.users.push({ id: uid(), name, email, phone: '', role: 'admin', passHash: hashPassword(password), createdAt: now() });
    await store.flush(db);
    console.log(`Admin account ready: ${email}. Log in at ${PUBLIC_URL}/staff-login.html`);
    process.exit(0);
  }

  const mkIdx = process.argv.indexOf('--make-admin');
  if (mkIdx > -1) {
    const email = String(process.argv[mkIdx + 1] || '').toLowerCase();
    const u = db.users.find(x => x.email === email);
    if (!u) { console.log('No account with that email. Sign up on the website first, then run this again.'); process.exit(1); }
    u.role = 'admin';
    await store.flush(db);
    console.log(`${email} is now an admin.`);
    process.exit(0);
  }

  function shutdown(signal) {
    console.log(`${signal} received. Closing the server.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  server.listen(PORT, () => {
    console.log(`DEBONE running at http://localhost:${PORT} (data: ${store.mode})`);
    if (!PAYSTACK_SECRET) console.log('Note: PAYSTACK_SECRET_KEY is not set. Paid enrolment is disabled until it is.');
  });
}

module.exports = handler;
if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });
