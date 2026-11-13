'use strict';
/* Checks that every editable photo/text in studio.html, about.html and services.html matches server/page-slots.js.
   Run: node tests/page-slots.test.js */
const fs = require('fs'), path = require('path');
const { SLOTS, SLOT_MAP } = require('../server/page-slots');
const dec = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&rsquo;/g, '’');
const used = new Set(); let bad = 0;
const fail = m => { bad++; console.log('FAIL', m); };
['studio', 'about', 'services'].forEach(name => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', name + '.html'), 'utf8');
  for (const m of html.matchAll(/<img[^>]*data-pc-img="([^"]+)"[^>]*>/g)) {
    const s = SLOT_MAP.get(m[1]); if (!s) { fail(name + ': unknown image slot ' + m[1]); continue; }
    used.add(m[1]);
    const src = (m[0].match(/\ssrc="([^"]*)"/) || [])[1];
    if (dec(src) !== s.def) fail(name + ': ' + m[1] + ' default photo differs');
  }
  for (const m of html.matchAll(/<(\w+)[^>]*data-pc="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const s = SLOT_MAP.get(m[2]); if (!s) { fail(name + ': unknown text slot ' + m[2]); continue; }
    used.add(m[2]);
    if (dec(m[3]).trim() !== s.def) fail(name + ': ' + m[2] + ' default text differs');
  }
});
SLOTS.forEach(s => { if (!used.has(s.key)) fail('slot never used on a page: ' + s.key); });
console.log(bad ? bad + ' problem(s)' : 'OK: ' + SLOTS.length + ' slots match the pages');
process.exit(bad ? 1 : 0);
