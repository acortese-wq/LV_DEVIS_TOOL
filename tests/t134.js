/* t134: UX-Runde 11/2026 P1 – Startkarte bei leerem Projekt (Layout A)
   - Startkarte im sichtbaren Kartenbereich: Suche «Adresse, Gemeinde oder Koordinate», 3 Vorlagen, Beispielprojekt, Projekt laden
   - Suche (Koordinate LV95 und geo.admin-Treffer) → Zoomstufe ≥ 17; Vorlage aktiviert nur das Werkzeug (keine Mengen)
   - verschwindet beim ersten Objekt/Werkzeug, Esc und × blenden aus
   - Start in der Gemeinde aus den Projektangaben, sonst am zuletzt benutzten Ausschnitt (lvd-km-view)
   - Parzellen-Hinweis: × und 6 s, pro Sitzung einmal; Handy 390 px ohne Überlauf; axe ohne Verstösse */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX, fs } = K;
const URL0 = process.env.LVD_URL || INDEX;
const HIT = { results: [{ attrs: { lat: 46.8508, lon: 9.5320, label: '<b>Chur (GR)</b>' } }] };
async function pageA(b, vp, init) {
  const ctx = await b.newContext(vp || { viewport: { width: 1440, height: 900 } }); const pg = await ctx.newPage(); pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.addInitScript(init || (() => { localStorage.setItem('lvd-layout', 'a'); }));
  await pg.route('**/*', r => { const u = r.request().url(); if (/SearchServer/.test(u)) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(HIT) }); return /wmts|wms\.geo|api3|cadastral|3d\.geo|profile\.json/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
  await pg.goto(URL0); await pg.waitForTimeout(2500); return pg;
}
const st = pg => pg.evaluate(() => { const c = document.querySelector('.kmstart'); if (!c) return null; const r = c.getBoundingClientRect(), rb = document.querySelector('.lyrb'), m = document.querySelector('#kmMap').getBoundingClientRect(), top = rb && rb.offsetParent ? rb.getBoundingClientRect().bottom : m.top;
  return { top: r.top, bot: r.bottom, l: r.left, r: r.right, vTop: top, mBot: m.bottom, ph: c.querySelector('#kmStQ').placeholder, n: c.querySelectorAll('.kmst-b').length, txt: c.textContent }; });
(async () => {
  const b = await chromium.launch(), errs = [];
  // 1) Startkarte sichtbar, im freien Kartenbereich
  let pg = await pageA(b);
  let s = await st(pg);
  ok(s && s.n === 3 && /Hausanschluss/.test(s.txt) && /Grabenstrecke/.test(s.txt) && /Werkloch/.test(s.txt) && /Beispielprojekt öffnen/.test(s.txt) && /Projekt laden \(JSON\)/.test(s.txt), 'Startkarte mit 3 Vorlagen, Beispielprojekt und Projekt laden');
  ok(s.ph === 'Adresse, Gemeinde oder Koordinate', 'Suchfeld «Adresse, Gemeinde oder Koordinate»');
  ok(s.top >= s.vTop - 1 && s.bot <= s.mBot + 1, 'vollständig im sichtbaren Kartenbereich (' + Math.round(s.top) + '–' + Math.round(s.bot) + ' px, frei ab ' + Math.round(s.vTop) + ')');
  await pg.addScriptTag({ path: K.AXE }); const ax = await pg.evaluate(() => axe.run('.kmstart').then(r => r.violations.map(v => v.id + ' ' + v.nodes[0].target)));
  ok(ax.length === 0, 'Startkarte ohne axe-Verstösse ' + ax.join('|'));
  // Koordinate LV95
  await pg.fill('#kmStQ', "2'759'000 / 1'191'000"); await pg.press('#kmStQ', 'Enter'); await pg.waitForTimeout(300);
  ok(/E 2.759.000 \/ N 1.191.000/.test(await pg.textContent('#kmStHits')), 'Koordinate LV95 wird erkannt');
  await pg.click('#kmStHits .kmhit'); await pg.waitForTimeout(600);
  let v = await pg.evaluate(() => { const m = window.__KM.map(), c = m.getCenter(), e = KARTE.toLV95(c.lat, c.lng); return { z: m.getZoom(), e: e[0], n: e[1], card: !!document.querySelector('.kmstart') }; });
  ok(v.z >= 17 && Math.abs(v.e - 2759000) < 3 && Math.abs(v.n - 1191000) < 3 && v.card, 'Sprung zur Koordinate, Zoom ' + v.z + ', Startkarte bleibt für die Vorlage');
  // Ortssuche (geo.admin, Treffer simuliert)
  await pg.fill('#kmStQ', 'Chur'); await pg.press('#kmStQ', 'Enter'); await pg.waitForTimeout(500);
  ok((await pg.textContent('#kmStHits .kmhit')) === 'Chur (GR)', 'Treffer der Ortssuche (ohne HTML)');
  await pg.click('#kmStHits .kmhit'); await pg.waitForTimeout(600);
  v = await pg.evaluate(() => { const m = window.__KM.map(), c = m.getCenter(); return { z: m.getZoom(), d: c.distanceTo([46.8508, 9.5320]) }; });
  ok(v.z >= 17 && v.d < 5, 'Treffer → Zoomstufe ' + v.z);
  // Vorlage Grabenstrecke → nur Werkzeug, keine Mengen
  const n0 = await pg.evaluate(() => JSON.stringify(window.__LVD.S().recs));
  await pg.click('.kmst-b[data-st=graben]'); await pg.waitForTimeout(400);
  v = await pg.evaluate(() => ({ card: !!document.querySelector('.kmstart'), on: document.querySelector('#kmToolsBody [data-k=mline]').getAttribute('aria-pressed'), M: window.__KM.M().lines.length, toast: (document.querySelector('.kmtoast') || {}).textContent || '' }));
  ok(!v.card && v.on === 'true' && v.M === 0 && /Doppelklick/.test(v.toast), 'Vorlage «Grabenstrecke»: Werkzeug Linie aktiv, keine Objekte, Hinweis');
  ok(n0 === await pg.evaluate(() => JSON.stringify(window.__LVD.S().recs)), 'Vorlage erzeugt keine Mengen (Datensätze unverändert)');
  // letzter Ausschnitt gemerkt (UI-Einstellung) → nächste Sitzung startet dort (frische Seite statt Neuladen: localStorage geht beim Neuladen unter Last verloren)
  await pg.waitForTimeout(800); const LV = await pg.evaluate(() => localStorage.getItem('lvd-km-view')), inS = await pg.evaluate(() => JSON.stringify(window.__LVD.S()).indexOf('lvd-km-view'));
  errs.push(...pg.errs); await pg.context().close();
  pg = await pageA(b, null, new Function('localStorage.setItem("lvd-layout","a"); localStorage.setItem("lvd-km-view", ' + JSON.stringify(LV) + ');'));
  v = await pg.evaluate(() => { const m = window.__KM.map(), c = m.getCenter(); return { z: m.getZoom(), d: c.distanceTo([46.8508, 9.5320]), card: !!document.querySelector('.kmstart') }; });
  ok(!!LV && inS < 0 && v.z >= 17 && v.d < 5 && v.card, 'leeres Projekt startet am letzten Ausschnitt (Zoom ' + v.z + ', ' + Math.round(v.d) + ' m), nur UI-Einstellung');
  // Esc blendet aus
  await pg.focus('#kmStQ'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  ok(!(await pg.locator('.kmstart').count()) && (await pg.locator('dialog.kmdlg[open]').count()) === 1, 'Esc blendet die Startkarte aus (Karte bleibt offen)');
  errs.push(...pg.errs); await pg.context().close();
  // × und erstes Objekt
  pg = await pageA(b); await pg.click('.kmst-x'); await pg.waitForTimeout(200);
  ok(!(await pg.locator('.kmstart').count()), '× blendet die Startkarte aus');
  errs.push(...pg.errs); await pg.context().close();
  pg = await pageA(b);
  await pg.evaluate(() => { const M = window.__KM.M(); M.pts.push({ id: 'pT', pt: [2759000, 1191000], typ: '', mode: 'neu' }); window.__KM.refresh(); });
  ok(!(await pg.locator('.kmstart').count()), 'erstes Objekt → Startkarte verschwindet');
  // Parzellen-Hinweis: beim Laden (Zoom 8, Parzellen) schon erschienen → nach Schliessen nicht nochmals
  const shown0 = await pg.evaluate(() => { const h = document.querySelector('.kmparzhint'); if (h) h.querySelector('button').click(); return !!h || sessionStorage.getItem('lvd-parzhint') === '1'; });
  await pg.evaluate(() => { const m = window.__KM.map(); document.querySelector('[data-lyb=farbe]').click(); m.setZoom(9); document.querySelector('[data-lyb=kataster]').click(); }); await pg.waitForTimeout(800);
  ok(shown0 && !(await pg.locator('.kmparzhint').count()), 'Parzellen-Hinweis erscheint pro Sitzung nur einmal');
  errs.push(...pg.errs); await pg.context().close();
  pg = await pageA(b); await pg.evaluate(() => { window.__KM.map().setZoom(10); document.querySelector('.kmst-x').click(); document.querySelector('[data-lyb=kataster]').click(); }); await pg.waitForTimeout(800);
  ok(await pg.locator('.kmparzhint .kmph-x').count() === 1, 'neue Sitzung: Parzellen-Hinweis mit ×');
  await pg.click('.kmparzhint .kmph-x'); await pg.waitForTimeout(200); ok(!(await pg.locator('.kmparzhint').count()), '× schliesst den Hinweis');
  errs.push(...pg.errs); await pg.context().close();
  pg = await pageA(b); await pg.evaluate(() => { window.__KM.map().setZoom(10); document.querySelector('.kmst-x').click(); document.querySelector('[data-lyb=kataster]').click(); }); await pg.waitForTimeout(800);
  ok(await pg.locator('.kmparzhint').count() === 1, 'Hinweis sichtbar'); await pg.waitForTimeout(6300);
  ok(!(await pg.locator('.kmparzhint').count()), 'Hinweis schliesst nach 6 s');
  errs.push(...pg.errs); await pg.context().close();
  // 2) Gemeinde/Ort aus den Projektangaben (Zustand vor dem Laden gesetzt)
  pg = await pageA(b, null, () => { localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify({ v: 2, lang: 'de', tab: 'graben', kopf: { projekt: '', ort: 'Chur', bearb: '', datum: '', rolle: 'bhv' }, recs: { graben: [] }, idx: {} })); });
  for (let t = 0; t < 30 && (await pg.evaluate(() => window.__KM && window.__KM.map() ? window.__KM.map().getZoom() : 0)) !== 16; t++) await pg.waitForTimeout(200);
  v = await pg.evaluate(() => { const m = window.__KM.map(), c = m.getCenter(); return { z: m.getZoom(), d: c.distanceTo([46.8508, 9.5320]), ort: window.__LVD.S().kopf.ort }; });
  ok(v.z === 16 && v.d < 5, 'Ort «' + v.ort + '» aus den Projektangaben → Karte startet dort (Zoom ' + v.z + ')');
  // 3) Beispielprojekt öffnen
  await pg.click('.kmst-f [data-st=demo]'); await pg.waitForTimeout(3000);
  v = await pg.evaluate(() => ({ open: !!document.querySelector('dialog.kmdlg[open]'), L: window.__KM.M().lines.length, card: !!document.querySelector('.kmstart'), p: window.__LVD.S().kopf.projekt }));
  ok(v.open && v.L === 4 && !v.card && /Beispielprojekt/.test(v.p), 'Beispielprojekt öffnen → Karte mit 4 Leitungen, ohne Startkarte');
  const J = JSON.stringify({ v: 2, tool: 'LV-Devis Tiefbau', data: await pg.evaluate(() => { const c = JSON.parse(JSON.stringify(window.__LVD.S())); delete c.ui; return c; }) }); const jf = K.tmp('t134.json'); fs.writeFileSync(jf, J);
  errs.push(...pg.errs); await pg.context().close();
  // 4) Projekt laden (JSON)
  pg = await pageA(b); await pg.setInputFiles('.kmstart .kmst-f input[type=file]', jf); await pg.waitForTimeout(3000);
  v = await pg.evaluate(() => ({ open: !!document.querySelector('dialog.kmdlg[open]'), L: window.__KM.M().lines.length }));
  ok(v.open && v.L === 4, 'Projekt laden (JSON) → Karte mit dem geladenen Projekt');
  errs.push(...pg.errs); await pg.context().close();
  // 5) Handy 390 px
  pg = await pageA(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  s = await st(pg); const ov = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(s && s.l >= 0 && s.r <= 390 && !ov, 'Handy: Startkarte passt (' + Math.round(s.l) + '–' + Math.round(s.r) + ' px), kein Überlauf');
  errs.push(...pg.errs); await pg.context().close();
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
