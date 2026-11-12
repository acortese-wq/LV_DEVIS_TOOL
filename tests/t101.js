/* t101: Planungsfokus – Knopf «Auf Bestand zoomen» neben dem Zoomfeld; Eigenschaften: nur das gewählte Element offen, übrige eingeklappt; Parzellenplan: erst ab Zoomstufe, darunter graue Landeskarte mit Hinweis, beim Hineinzoomen wieder da */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(), pg = await mk(b, 1440, 900); const req = [];
  await pg.route('**/*', r => { const u = r.request().url(); if (/cadastralwebmap/.test(u)) { req.push(u); return r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64') }); } return /wmts|wms\.geo|api3|SearchServer|swisstopo/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); localStorage.removeItem('lvd-km-base'); }); await pg.waitForTimeout(900);
  await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(2200);
  // 1) Knopf neben dem Zoomfeld
  const g = await pg.evaluate(() => { const z = document.querySelector('.leaflet-control-zoom').getBoundingClientRect(), f = document.querySelector('.kmfitc'); if (!f) return null; const r = f.getBoundingClientRect(), a = f.querySelector('a'); return { zr: z.right, zt: z.top, fl: r.left, ft: r.top, w: r.width, label: a.getAttribute('aria-label'), svg: !!a.querySelector('svg') }; });
  ok(!!g && g.fl >= g.zr && Math.abs(g.ft - g.zt) < 6, 'Knopf «Auf Bestand zoomen» steht neben dem Zoomfeld (x ' + Math.round(g && g.fl) + ' ≥ ' + Math.round(g && g.zr) + ', y ' + Math.round(g && g.ft) + '/' + Math.round(g && g.zt) + ')');
  ok(g && g.svg && /Bestand/.test(g.label), 'Symbol mit Beschriftung «' + (g && g.label) + '»');
  await pg.evaluate(() => window.__KM.map().setZoom(9, { animate: false })); await pg.waitForTimeout(500);
  const z0 = await pg.evaluate(() => window.__KM.map().getZoom()); await pg.click('.kmfitc a'); await pg.waitForTimeout(700);
  const z1 = await pg.evaluate(() => window.__KM.map().getZoom()), inb = await pg.evaluate(() => { const M = window.__KM.M(), m = window.__KM.map(), bb = m.getBounds(); return M.lines.every(l => l.pts.every(p => bb.contains(window.__KM.ll(p)))); });
  ok(z1 > z0 && inb, 'Klick zoomt auf den Bestand (Zoom ' + z0 + ' → ' + z1 + ', alle Linien im Ausschnitt)');
  // 2) Eigenschaften: nur das gewählte Element offen
  const ids = await pg.evaluate(() => window.__KM.M().lines.map(l => l.id));
  await pg.evaluate(id => window.__KM.select(id), ids[0]); await pg.waitForTimeout(500);
  const st = () => pg.evaluate(() => [...document.querySelectorAll('#kmObj .kmrow')].map(r => ({ id: r.getAttribute('data-rid'), closed: r.classList.contains('kmclosed') })));
  let s0 = await st(); ok(s0.length > 2 && s0.filter(x => !x.closed).length === 1 && !s0.find(x => x.id === ids[0]).closed, 'Auswahl Linie 1: nur dieses Element offen, ' + (s0.length - 1) + ' übrige eingeklappt');
  await pg.evaluate(id => window.__KM.select(id), ids[1]); await pg.waitForTimeout(500);
  s0 = await st(); ok(s0.filter(x => !x.closed).length === 1 && !s0.find(x => x.id === ids[1]).closed, 'Auswahl Linie 2: nur Linie 2 offen');
  const sid = await pg.evaluate(() => { const p = window.__KM.M().pts[0]; return p && p.id; });
  if (sid) { await pg.evaluate(id => window.__KM.select(id), sid); await pg.waitForTimeout(500); s0 = await st(); ok(s0.filter(x => !x.closed).length === 1 && !s0.find(x => x.id === sid).closed, 'Auswahl Schacht: nur der Schacht offen'); }
  // 3) Parzellenplan
  const n0 = req.length, imgs = () => pg.evaluate(() => [...document.querySelectorAll('.leaflet-image-layer')].length), tiles = () => pg.evaluate(() => [...document.querySelectorAll('.leaflet-tile-pane img')].length);
  await pg.evaluate(() => window.__KM.map().setZoom(17, { animate: false })); await pg.waitForTimeout(1500);
  ok((await imgs()) >= 1, 'Zoom 17: Parzellenbild vorhanden (' + (await imgs()) + ' Bild)');
  await pg.evaluate(() => window.__KM.map().setZoom(11, { animate: false })); await pg.waitForTimeout(1200);
  const msg = await pg.evaluate(() => (document.querySelector('.kmparzhint') || {}).textContent || '');
  ok((await imgs()) === 0 && /Zoomstufe 15/.test(msg), 'Zoom 11: kein leeres weisses Parzellenbild, Hinweis «' + msg.slice(0, 60) + '…»');
  await pg.evaluate(() => window.__KM.map().setZoom(17, { animate: false })); await pg.waitForTimeout(1500);
  ok((await imgs()) >= 1, 'wieder hineingezoomt: Parzellenbild ist wieder da');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
