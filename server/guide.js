'use strict';
/*
 * The DEBONE guide: one set of content files (server/guide/*.json) feeds the tour, the on-screen guide,
 * the voice reader and the PDF. Numbers that the owner can change in Business rules are written as {{name}}
 * in the content and are filled in with the live values every time, so the guide never goes out of date.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'guide');
let CACHE = null;
function load() {
  if (!CACHE) {
    const read = n => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));
    CACHE = { student: read('student.json'), staff: read('staff.json'), better: read('better.json') };
  }
  return CACHE;
}

const TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
function fmt(v) {
  if (typeof v === 'number' && Math.abs(v) >= 1000) return v.toLocaleString('en-US');
  return String(v);
}
function fill(node, vals) {
  if (typeof node === 'string') return node.replace(TOKEN, (m, k) => (vals[k] !== undefined && vals[k] !== '' ? fmt(vals[k]) : m));
  if (Array.isArray(node)) return node.map(x => fill(x, vals));
  if (node && typeof node === 'object') { const o = {}; for (const k of Object.keys(node)) o[k] = fill(node[k], vals); return o; }
  return node;
}
function tokensIn(node, out) {
  out = out || new Set();
  if (typeof node === 'string') { let m; const re = new RegExp(TOKEN.source, 'g'); while ((m = re.exec(node))) out.add(m[1]); }
  else if (Array.isArray(node)) node.forEach(x => tokensIn(x, out));
  else if (node && typeof node === 'object') Object.keys(node).forEach(k => tokensIn(node[k], out));
  return out;
}

/* audience: 'student' | 'staff'.  admin: true for admins (instructors do not get the admin-only sections). */
function content(audience, settings, admin) {
  const all = load();
  const base = audience === 'staff' ? all.staff : all.student;
  const out = JSON.parse(JSON.stringify(base));
  if (audience === 'staff' && !admin) out.sections = out.sections.filter(s => !s.adminOnly);
  out.better = all.better;
  out.role = audience === 'staff' ? (admin ? 'admin' : 'instructor') : 'student';
  return fill(out, settings || {});
}

/* ---------------- PDF ---------------- */
const GOLD = '#B98900', INK = '#0B0B0B', TEXT = '#1d1d1b', MUTE = '#6b6a66', RULE = '#dcd8cf', SOFT = '#f6f1e4';
const MAP = { '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"', '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u20A6': 'NGN ', '\u00A0': ' ', '\u2022': '-' };
const clean = s => String(s == null ? '' : s).replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u20A6\u00A0\u2022]/g, c => MAP[c]).replace(/[^\x09\x0A\x20-\x7E\u00A3\u00A9\u00AE\u00B7]/g, '');

function pdf(audience, settings, admin) {
  let PDFDocument;
  try { PDFDocument = require('pdfkit'); } catch (e) { return Promise.reject(Object.assign(new Error('PDF maker is not installed. Run npm install.'), { status: 503 })); }
  const c = content(audience, settings, admin);
  const bizName = clean((settings && settings.businessName) || 'DEBONE Photos & Video Editing Studio');
  const M = 56;
  const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M + 14, left: M, right: M }, bufferPages: true,
    info: { Title: c.title, Author: bizName, Subject: c.subtitle } });
  const chunks = [];
  doc.on('data', d => chunks.push(d));
  const done = new Promise((res, rej) => { doc.on('end', () => res(Buffer.concat(chunks))); doc.on('error', rej); });

  const W = () => doc.page.width - M * 2;
  const room = () => doc.page.height - doc.page.margins.bottom - doc.y;
  const need = h => { if (room() < h) doc.addPage(); };
  const H = (txt, font, size, width) => { doc.font(font).fontSize(size); return doc.heightOfString(clean(txt), { width: width || W() }); };

  // ---- cover
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(INK);
  doc.rect(M, 150, 56, 4).fill('#E0A800');
  doc.fillColor('#E0A800').font('Helvetica-Bold').fontSize(10).text(clean(bizName).toUpperCase(), M, 120, { characterSpacing: 2.2 });
  doc.fillColor('#F4F4F0').font('Helvetica-Bold').fontSize(44).text(clean(c.title).toUpperCase(), M, 190, { width: W(), lineGap: 4 });
  doc.moveDown(0.6).fillColor('#CFCFC9').font('Helvetica').fontSize(15).text(clean(c.subtitle), { width: W() });
  doc.fillColor('#9B9B95').fontSize(10).text('Since 1997, in Port Harcourt', M, doc.page.height - 130);
  doc.text('Edition: ' + new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), M, doc.page.height - 114);
  doc.text('Read it, listen to it, or download it from the Guide button in your dashboard.', M, doc.page.height - 98, { width: W() });

  // ---- reserved contents page(s) filled in at the end
  doc.addPage();
  const tocPage = doc.bufferedPageRange().count - 1;
  doc.addPage();

  const toc = [];
  const mark = (title, level) => toc.push({ title: clean(title), page: doc.bufferedPageRange().count - 1, level: level || 0 });

  const para = (txt, o) => { o = o || {}; doc.fillColor(o.color || TEXT).font(o.font || 'Helvetica').fontSize(o.size || 10.5).text(clean(txt), o.x || M, doc.y, { width: o.width || W(), lineGap: 3, align: 'left' }); };
  const heading = (txt, size, color) => { doc.fillColor(color || INK).font('Helvetica-Bold').fontSize(size).text(clean(txt), M, doc.y, { width: W(), lineGap: 2 }); };
  const label = txt => { need(40); doc.moveDown(0.5); doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(8.5).text(clean(txt).toUpperCase(), M, doc.y, { characterSpacing: 1.6 }); doc.moveDown(0.35); };

  // ---- how to use
  heading('How to use this guide', 20); doc.moveDown(0.4);
  doc.rect(M, doc.y, 44, 3).fill('#E0A800'); doc.moveDown(0.8);
  c.intro.forEach(p => { para(p, { size: 11.5 }); doc.moveDown(0.6); });
  label('Three ways to learn');
  [['Take a tour', 'A guided walk through the screen. Press the Take a tour button at the top of any page.'],
   ['Read this guide', 'Every page of the dashboard, explained in simple words, step by step. Search it online to jump to any page.'],
   ['Listen to it', 'Online, press the speaker button and the guide is read to you from start to finish until you stop it.']]
    .forEach(r => { need(46); para(r[0], { font: 'Helvetica-Bold', size: 11 }); para(r[1], { color: MUTE, size: 10.5 }); doc.moveDown(0.5); });

  // ---- sections
  let lastGroup = null;
  c.sections.forEach((s, i) => {
    const estimate = H(s.title, 'Helvetica-Bold', 17) + H(s.summary || '', 'Helvetica', 11) + 90;
    if (room() < Math.min(estimate + 60, 260)) doc.addPage(); else doc.moveDown(1.3);
    if (s.group !== lastGroup) { lastGroup = s.group; doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(8.5).text(clean(s.group).toUpperCase(), M, doc.y, { characterSpacing: 1.8 }); doc.moveDown(0.3); }
    mark(s.title);
    heading((i + 1) + '.  ' + s.title, 17);
    if (s.adminOnly) { doc.moveDown(0.2); para('Admin only', { color: GOLD, font: 'Helvetica-Bold', size: 9 }); }
    doc.moveDown(0.35);
    if (s.summary) { para(s.summary, { color: MUTE, font: 'Helvetica-Oblique', size: 11 }); doc.moveDown(0.5); }
    label('What this is for'); para(s.what);
    if (s.steps && s.steps.length) {
      label('Step by step');
      s.steps.forEach((st, n) => {
        const h = H(st, 'Helvetica', 10.5, W() - 30);
        need(Math.min(h + 10, 70));
        const y = doc.y;
        doc.circle(M + 9, y + 7, 8.5).fill('#E0A800');
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.5).text(String(n + 1), M + 0.5, y + 3.4, { width: 17, align: 'center' });
        doc.fillColor(TEXT).font('Helvetica').fontSize(10.5).text(clean(st), M + 30, y, { width: W() - 30, lineGap: 3 });
        doc.y = Math.max(doc.y, y + 18); doc.moveDown(0.35);
      });
    }
    const bullets = (title, arr, tint) => {
      if (!arr || !arr.length) return;
      label(title);
      arr.forEach(t => {
        const h = H(t, 'Helvetica', 10.5, W() - 22);
        need(Math.min(h + 10, 60));
        const y = doc.y;
        doc.rect(M, y - 1, 3, h + 3).fill(tint);
        doc.fillColor(TEXT).font('Helvetica').fontSize(10.5).text(clean(t), M + 14, y, { width: W() - 14, lineGap: 3 });
        doc.moveDown(0.4);
      });
    };
    bullets('Good to know', s.tips, '#E0A800');
    bullets('If something goes wrong', s.mistakes, '#c4553a');
  });

  // ---- why better
  doc.addPage(); mark('Why the DEBONE dashboard is better');
  heading(c.better.title, 20); doc.moveDown(0.4); doc.rect(M, doc.y, 44, 3).fill('#E0A800'); doc.moveDown(0.8);
  para(c.better.intro, { size: 11 }); doc.moveDown(0.8);
  c.better.points.forEach((p, i) => {
    const h = H(p.title, 'Helvetica-Bold', 12.5) + H(p.text, 'Helvetica', 10.5) + H('The usual way: ' + p.usual, 'Helvetica-Oblique', 9.5) + 18;
    need(Math.min(h, 160));
    para((i + 1) + '.  ' + p.title, { font: 'Helvetica-Bold', size: 12.5, color: INK });
    doc.moveDown(0.15); para(p.text);
    doc.moveDown(0.15); para('The usual way: ' + p.usual, { font: 'Helvetica-Oblique', size: 9.5, color: MUTE });
    doc.moveDown(0.7);
  });
  need(200); doc.moveDown(0.4); label('Side by side');
  const cols = [W() * 0.46, W() * 0.14, W() * 0.40];
  const rowH = 22;
  const row = (cells, head) => {
    need(rowH + 6); const y = doc.y; let x = M;
    if (head) doc.rect(M, y, W(), rowH).fill(INK); else if (Math.round((y - 0) / rowH) % 2) doc.rect(M, y, W(), rowH).fill(SOFT);
    cells.forEach((t, k) => { doc.fillColor(head ? '#F4F4F0' : (k === 1 ? GOLD : TEXT)).font(head || k === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).text(clean(t), x + 8, y + 6.5, { width: cols[k] - 14, height: rowH, ellipsis: true, lineBreak: false }); x += cols[k]; });
    doc.y = y + rowH;
  };
  row(['What you need', 'DEBONE', 'The usual way'], true);
  c.better.table.forEach(r => row(r));

  // ---- glossary
  doc.addPage(); mark('Words explained'); heading('Words explained', 20); doc.moveDown(0.4); doc.rect(M, doc.y, 44, 3).fill('#E0A800'); doc.moveDown(0.8);
  c.glossary.forEach(g => { need(40); para(g[0], { font: 'Helvetica-Bold', size: 11 }); para(g[1], { color: MUTE }); doc.moveDown(0.5); });

  // ---- faq
  doc.moveDown(0.8); need(120); mark('Common questions'); heading('Common questions', 20); doc.moveDown(0.4); doc.rect(M, doc.y, 44, 3).fill('#E0A800'); doc.moveDown(0.8);
  c.faq.forEach(q => { need(70); para(q[0], { font: 'Helvetica-Bold', size: 11, color: INK }); doc.moveDown(0.15); para(q[1]); doc.moveDown(0.7); });

  // ---- contact
  doc.moveDown(0.8); need(130); mark('Need a person?'); heading('Need a person?', 20); doc.moveDown(0.4); doc.rect(M, doc.y, 44, 3).fill('#E0A800'); doc.moveDown(0.8);
  const s = settings || {};
  para('If this guide does not answer your question, contact the studio.', { size: 11 }); doc.moveDown(0.5);
  [['Phone', [s.phone1, s.phone2].filter(Boolean).join('  /  ')], ['Address', s.address], ['Opening hours', s.hours]].forEach(r => { if (r[1]) { para(r[0], { font: 'Helvetica-Bold', size: 10 }); para(r[1], { color: MUTE }); doc.moveDown(0.4); } });

  // ---- fill in contents
  doc.switchToPage(tocPage);
  doc.y = M; heading('Contents', 20); doc.moveDown(0.4); doc.rect(M, doc.y, 44, 3).fill('#E0A800'); doc.moveDown(0.9);
  const step = Math.min(17, (doc.page.height - M * 2 - 90) / Math.max(1, toc.length));
  toc.forEach(t => {
    const y = doc.y;
    doc.fillColor(TEXT).font('Helvetica').fontSize(10).text(clean(t.title), M, y, { width: W() - 40, lineBreak: false, ellipsis: true });
    doc.fillColor(GOLD).font('Helvetica-Bold').text(String(t.page + 1), M + W() - 30, y, { width: 30, align: 'right', lineBreak: false });
    doc.y = y + step;
  });

  // ---- footers
  const n = doc.bufferedPageRange().count;
  for (let i = 1; i < n; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(M, doc.page.height - 44).lineTo(doc.page.width - M, doc.page.height - 44).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.fillColor(MUTE).font('Helvetica').fontSize(8).text(clean(bizName) + '  |  ' + clean(c.title), M, doc.page.height - 36, { width: W() - 60, lineBreak: false });
    doc.text('Page ' + (i + 1) + ' of ' + n, M + W() - 60, doc.page.height - 36, { width: 60, align: 'right', lineBreak: false });
    doc.page.margins.bottom = keep;
  }
  doc.end();
  return done;
}

module.exports = { content, pdf, load, tokensIn };
