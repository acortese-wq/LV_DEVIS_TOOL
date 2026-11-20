/* t132: Mein Standort (GPS, V144) – Knopf unter dem Zoom, Karte springt zum Standort, blauer Punkt mit Genauigkeit, Anzeige «± m»,
   «Punkt hier setzen» mit dem aktiven Werkzeug (Schacht), Warnung bei schlechter Genauigkeit, «Aus» beendet die Ortung; Handy-Ansicht ohne Überlauf.
   Der Standort wird über Playwright simuliert (Chur, Bahnhofplatz). */
const K = require('./lib/k.js'), { chromium, ok, INDEX } = K;
(async () => {
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, geolocation: { latitude: 46.8530, longitude: 9.5293, accuracy: 6 }, permissions: ['geolocation'] });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { window.__LVD_LAYOUT_DEFAULT = 'classic'; window.__LVD_RIBBON_DEFAULT = 'min'; });
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.goto(INDEX); await pg.waitForTimeout(800);
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1200);
  ok(await pg.locator('.kmgpsc a[data-k=gps]').count() === 1, 'Knopf «Mein Standort (GPS)» unter dem Zoom');
  await pg.click('.kmgpsc a[data-k=gps]'); await pg.waitForTimeout(1200);
  const st = await pg.evaluate(() => { const s = window.__KM_GPS.st(), c = window.__KM.map().getCenter(); return { on: s.on, acc: s.pos && s.pos.acc, d: c.distanceTo([46.8530, 9.5293]), z: window.__KM.map().getZoom() }; });
  ok(st.on && st.acc === 6 && st.d < 3 && st.z >= 19, 'Karte springt zum Standort (Zoom ' + st.z + ', Abweichung ' + Math.round(st.d) + ' m)');
  ok(/Mein Standort ± 6 m/.test(await pg.textContent('.kmgps')), 'Anzeige «Mein Standort ± 6 m»');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#kmMap path.leaflet-interactive, #kmMap path')].some(p => p.getAttribute('fill') === '#1a73e8')), 'blauer Punkt mit Genauigkeitskreis');
  // Punkt hier setzen ohne Werkzeug → Hinweis
  await pg.evaluate(() => { const b0 = document.querySelector('[data-k=medit]'); if (b0 && b0.getAttribute('aria-pressed') === 'true') b0.click(); });
  const n0 = await pg.evaluate(() => window.__KM.M().pts.length);
  await pg.evaluate(() => document.querySelector('[data-k=mpt]').click()); await pg.waitForTimeout(200);
  await pg.click('.kmgps [data-gps=here]'); await pg.waitForTimeout(600);
  const p1 = await pg.evaluate(() => { const M = window.__KM.M(), p = M.pts[M.pts.length - 1], ll = window.__KM.ll(p.pt); return { n: M.pts.length, d: L.latLng(ll).distanceTo([46.8530, 9.5293]) }; });
  ok(p1.n === n0 + 1 && p1.d < 1, 'Schacht am Standort gesetzt (Abweichung ' + p1.d.toFixed(2) + ' m)');
  // schlechte Genauigkeit → Rückfrage
  await ctx.setGeolocation({ latitude: 46.8532, longitude: 9.5296, accuracy: 25 }); await pg.waitForTimeout(1500);
  let asked = ''; pg.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await pg.click('.kmgps [data-gps=here]'); await pg.waitForTimeout(500);
  ok(/± 25 m/.test(asked) && (await pg.evaluate(() => window.__KM.M().pts.length)) === n0 + 1, 'Genauigkeit ± 25 m: Rückfrage, abgelehnt → kein Punkt');
  await pg.click('.kmgps [data-gps=off]'); await pg.waitForTimeout(300);
  ok(!(await pg.evaluate(() => window.__KM_GPS.st().on)) && (await pg.locator('.kmgps').count()) === 0, '«Aus» beendet die Ortung');
  // Handy
  const ph = await b.newContext(Object.assign({}, K.pw ? {} : {}, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, geolocation: { latitude: 46.8530, longitude: 9.5293, accuracy: 4 }, permissions: ['geolocation'] }));
  const pm = await ph.newPage(); pm.on('pageerror', e => errs.push(e.message)); await pm.addInitScript(() => { localStorage.setItem('lvd-layout', 'a'); });
  await pm.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pm.goto(INDEX); await pm.waitForTimeout(3500);
  await pm.evaluate(() => document.querySelector('.kmgpsc a[data-k=gps]').click()); await pm.waitForTimeout(1200);
  const m = await pm.evaluate(() => { const c = document.querySelector('.kmgps').getBoundingClientRect(); return { ok: /± 4 m/.test(document.querySelector('.kmgps').textContent), in: c.left >= 0 && c.right <= innerWidth, ov: document.documentElement.scrollWidth > innerWidth + 1 }; });
  ok(m.ok && m.in && !m.ov, 'Handy: Standortanzeige sichtbar, ohne Überlauf');
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
