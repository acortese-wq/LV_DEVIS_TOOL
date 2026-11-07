/* t86: Parzellen (Kataster) als Kachelebene – lagestabil beim Zoomen/Verschieben: jede Kachel liegt exakt an ihrer Weltposition (BBOX → Bildschirm ≤ 1.5 px),
   kein Gesamtbild-Neuladen nach jeder Bewegung (kein .leaflet-image-layer), Anzahl Anfragen begrenzt, Fallback auf WMTS bei Fehlern */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
const open = async pg => { for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(2000); };
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900); let n = 0, fail = false, wmtsC = 0;
  await pg.route('**/*', async r => { const u = r.request().url();
    if (/wms\.geo\.admin\.ch/.test(u) && /cadastral/.test(u)) { n++; if (fail) return r.fulfill({ status: 500 });
      const q = new URL(u).searchParams, W = +(q.get('width') || q.get('WIDTH')), H = +(q.get('height') || q.get('HEIGHT'));
      return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="none" stroke="red"/></svg>` }); }
    if (/wmts\.geo\.admin\.ch.*cadastralwebmap/.test(u)) wmtsC++;
    return /wmts|wms\.geo|api3|SearchServer/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lvd-km-base', 'kataster'); }); await pg.waitForTimeout(1200); await pg.reload(); await open(pg);
  const check = () => pg.evaluate(() => {
    const m = window.__KM.map(), c = m.getContainer().getBoundingClientRect(), R = 6378137, un = (x, y) => [(2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI, x / R * 180 / Math.PI];
    const ts = [...document.querySelectorAll('#kmMap .leaflet-tile-pane img')].filter(i => /cadastral/.test(i.src) && i.complete); let worst = 0, cnt = 0;
    ts.forEach(i => { const bb = (new URL(i.src).searchParams.get('bbox') || new URL(i.src).searchParams.get('BBOX')).split(',').map(Number), a = m.latLngToContainerPoint(un(bb[0], bb[3])), r = i.getBoundingClientRect();
      const d = Math.max(Math.abs(a.x - (r.left - c.left)), Math.abs(a.y - (r.top - c.top))); worst = Math.max(worst, d); cnt++; });
    return { cnt, worst: +worst.toFixed(2), z: m.getZoom(), img: document.querySelectorAll('#kmMap .leaflet-image-layer').length };
  });
  let s = await check(); ok(s.cnt > 0 && s.img === 0, 'Parzellen als Kacheln (' + s.cnt + ' Kacheln, kein Gesamtbild)');
  ok(s.worst <= 1.5, 'Start z' + s.z + ': Kacheln liegen lagetreu (max. Abweichung ' + s.worst + ' px)');
  for (const dz of [1, 1, 1, -2, 2, -1]) { await pg.evaluate(dz => { const m = window.__KM.map(); m.setZoom(m.getZoom() + dz); }, dz); await pg.waitForTimeout(1800); s = await check(); ok(s.cnt > 0 && s.worst <= 1.5, 'Zoom → z' + s.z + ': ' + s.cnt + ' Kacheln, max. Abweichung ' + s.worst + ' px'); }
  await pg.evaluate(() => { const m = window.__KM.map(); m.panBy([333, -141], { animate: false }); }); await pg.waitForTimeout(1500); s = await check(); ok(s.worst <= 1.5, 'Verschieben: max. Abweichung ' + s.worst + ' px');
  // Zoom mit Mausrad
  const bx = await pg.locator('#kmMap').boundingBox(); await pg.mouse.move(bx.x + 300, bx.y + 200); n = 0;
  for (let i = 0; i < 4; i++) { await pg.mouse.wheel(0, -120); await pg.waitForTimeout(150); } await pg.waitForTimeout(1800); s = await check();
  ok(s.worst <= 1.5 && s.img === 0, 'Mausrad-Zoom: max. Abweichung ' + s.worst + ' px (' + n + ' Anfragen)');
  // Fallback bei Fehlern
  fail = true; await pg.evaluate(() => { const m = window.__KM.map(); m.panBy([900, 900], { animate: false }); }); await pg.waitForTimeout(2500);
  ok(wmtsC > 0, 'bei WMS-Fehlern wechselt die Ebene automatisch auf WMTS (' + wmtsC + ' Kachelanfragen)');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
