/* t123: Handy/Tablet (V142) – Touch: Bedienelemente ≥ 44 px (klassisch und Planungsfokus iPad quer), Mindestschrift 12 px auf Handy,
   ruhiger Start (Seite erst nach dem Aufbau sichtbar, kaum Layoutverschiebung), Computer unverändert kompakt */
const K = require('./lib/k.js'), { chromium, ok, INDEX } = K;
const pw = (() => { for (const t of [process.env.PW, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) { try { return require(t); } catch (e) { } } })();   /* Gerätevorlagen (iPhone, iPad) */
const probe = () => { const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const top = document.querySelector('dialog[open]') || document;
  const it = [...top.querySelectorAll('button:not(.kmgrab), input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), select, summary, [role=tab]')].filter(vis);
  const txt = [...top.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2) && vis(e));
  return { n: it.length, small: it.filter(e => e.getBoundingClientRect().height < 39.5).map(e => (e.id || e.className || e.textContent.trim()).toString().slice(0, 20)), fs: txt.filter(e => parseFloat(getComputedStyle(e).fontSize) < 11.95).length, ov: document.documentElement.scrollWidth > innerWidth + 1 }; };
async function open(b, dev, ly) {
  const ctx = await b.newContext(Object.assign({}, pw.devices[dev] || {}, dev === 'pc' ? { viewport: { width: 1440, height: 900 } } : {})); const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.goto(INDEX); await pg.evaluate(ly => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', ly); localStorage.setItem('lvd-ribbon', 'min'); }, ly); await pg.waitForTimeout(500); await pg.reload(); await pg.waitForTimeout(ly === 'a' ? 3500 : 1500); return pg;
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ph = await open(b, 'iPhone 14', 'classic'); let r = await ph.evaluate(probe); errs.push(...ph.errs);
  ok(r.small.length === 0, 'iPhone: alle Knöpfe, Felder und Reiter mindestens 40–44 px hoch (' + r.n + ' geprüft) ' + r.small.join(','));
  ok(r.fs === 0 && !r.ov, 'iPhone: keine Schrift unter 12 px, kein Seitenüberlauf');
  const pa = await open(b, 'iPhone 14', 'a'); r = await pa.evaluate(probe); errs.push(...pa.errs);
  ok(r.small.length === 0 && !r.ov, 'iPhone Planungsfokus: Bedienelemente fingertauglich (' + r.n + ') ' + r.small.join(','));
  const ip = await open(b, 'iPad Pro 11 landscape', 'a'); r = await ip.evaluate(probe); errs.push(...ip.errs);
  ok(r.small.length === 0 && !r.ov, 'iPad quer Planungsfokus: Kopf, Reiter, Werkzeuge, Statusleiste ≥ 40 px (' + r.n + ') ' + r.small.join(','));
  const z = await ip.evaluate(() => { const a = document.querySelector('.kmdlg .leaflet-control-zoom-in'); return a ? a.getBoundingClientRect().height : 44; }); ok(z >= 44, 'iPad: Zoomknöpfe 44 px (' + z + ')');
  const pc = await open(b, 'pc', 'a'); const h = await pc.evaluate(() => { const e = document.querySelector('.kmdlg.kmlya .lylang .btn'); return e ? e.getBoundingClientRect().height : 0; }); errs.push(...pc.errs);
  ok(h > 0 && h < 40, 'Computer (Maus): Planungsfokus bleibt kompakt (' + Math.round(h) + ' px)');
  // Ruhiger Start: Inhalt erst nach dem Aufbau sichtbar, Layoutverschiebung klein
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await ctx.newPage();
  await pg.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); localStorage.setItem('lvd-layout', 'classic'); });
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.goto(INDEX); await pg.waitForTimeout(2000);
  const st = await pg.evaluate(() => ({ cls: window.__cls, ready: document.documentElement.classList.contains('lvready'), vis: getComputedStyle(document.querySelector('.sheet')).visibility }));
  ok(st.ready && st.vis === 'visible', 'Start: Seite nach dem Aufbau sichtbar (lvready)');
  ok(st.cls < 0.1, 'Start: Layoutverschiebung (CLS) unter 0.1 (' + st.cls.toFixed(3) + ')');
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
