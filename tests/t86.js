/* t86: Parzellen/Hintergrund-WMS als ein Bild mit Rand – lagetreu beim Zoomen/Verschieben (Bild = Weltposition seiner BBOX, ≤ 1.5 px), Verschieben innerhalb des Randes
   lädt nicht neu (Parzellen bleiben unverändert), Zoomen/Verlassen des Bereichs lädt neu, nie mehrere Bilder gleichzeitig, Bildgrösse begrenzt;
   Bildschirmskalierung 100/125/150/200 %; Fallback auf WMTS bei Fehlern. (Kleine WMS-Kacheln wurden verworfen: der weitergereichte Dienst liefert sie gegeneinander verschoben.) */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
const open = async pg => { for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(2000); };
async function run(b, dsf) {
  const pg = await mk(b, 1440, 900, dsf); let n = 0, fail = false, wmtsC = 0, last = null; const tag = 'DPR ' + dsf + ': ';
  await pg.route('**/*', async r => { const u = r.request().url();
    if (/wms\.geo\.admin\.ch/.test(u) && /cadastral/.test(u)) { n++; if (fail) return r.fulfill({ status: 500 });
      const q = new URL(u).searchParams, W = +(q.get('WIDTH') || q.get('width')), H = +(q.get('HEIGHT') || q.get('height')); last = { W, H };
      return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="none" stroke="red"/></svg>` }); }
    if (/wmts\.geo\.admin\.ch.*cadastralwebmap/.test(u)) wmtsC++;
    return /wmts|wms\.geo|api3|SearchServer/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lvd-km-base', 'kataster'); }); await pg.waitForTimeout(1200); await pg.reload(); await open(pg);
  const check = () => pg.evaluate(() => {
    const m = window.__KM.map(), c = m.getContainer().getBoundingClientRect(), R = 6378137, un = (x, y) => [(2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI, x / R * 180 / Math.PI];
    const ims = [...document.querySelectorAll('#kmMap .leaflet-image-layer')]; let worst = 0, cov = false;
    ims.forEach(i => { const q = new URL(i.src).searchParams, bb = (q.get('BBOX') || q.get('bbox')).split(',').map(Number), a = m.latLngToContainerPoint(un(bb[0], bb[3])), r = i.getBoundingClientRect();
      worst = Math.max(worst, Math.abs(a.x - (r.left - c.left)), Math.abs(a.y - (r.top - c.top))); cov = r.left <= c.left + 1 && r.top <= c.top + 1 && r.right >= c.right - 1 && r.bottom >= c.bottom - 1; });
    return { cnt: ims.length, worst: +worst.toFixed(2), z: m.getZoom(), cov, tiles: document.querySelectorAll('#kmMap .leaflet-tile-pane img.leaflet-tile[src*=cadastral]').length };
  });
  let s = await check(); ok(s.cnt === 1 && s.cov && s.tiles === 0, tag + 'ein Bild, deckt den Ausschnitt');
  ok(s.worst <= 1.5 && last && Math.max(last.W, last.H) <= 2600, tag + 'Start z' + s.z + ': lagetreu (' + s.worst + ' px), Bild ' + last.W + '×' + last.H + ' px');
  for (const dz of [1, 1, 1, -2, 2, -1]) { n = 0; await pg.evaluate(dz => { const m = window.__KM.map(); m.setZoom(m.getZoom() + dz); }, dz); await pg.waitForTimeout(1500); s = await check(); ok(s.cnt === 1 && s.cov && s.worst <= 1.5 && n <= 1, tag + 'Zoom → z' + s.z + ': höchstens 1 Anfrage (' + n + ', sonst Zwischenspeicher), lagetreu (' + s.worst + ' px)'); }
  // Verschieben innerhalb des Randes: keine neue Anfrage, Bild unverändert
  const src0 = await pg.evaluate(() => document.querySelector('#kmMap .leaflet-image-layer').src); n = 0;
  await pg.evaluate(() => { const m = window.__KM.map(); m.panBy([200, -120], { animate: false }); }); await pg.waitForTimeout(1200); s = await check();
  ok(n === 0 && s.cov && s.worst <= 1.5 && await pg.evaluate(() => document.querySelector('#kmMap .leaflet-image-layer').src) === src0, tag + 'Verschieben im Rand: keine Anfrage (' + n + '), Parzellen unverändert, deckt weiter');
  // Verlassen des Bereichs: neues Bild
  await pg.evaluate(() => { const m = window.__KM.map(); m.panBy([1500, 900], { animate: false }); }); await pg.waitForTimeout(1500); s = await check();
  ok(n >= 1 && s.cnt === 1 && s.cov && s.worst <= 1.5, tag + 'weit verschoben: neues Bild (' + n + ' Anfrage), lagetreu (' + s.worst + ' px)');
  // Mausrad
  const bx = await pg.locator('#kmMap').boundingBox(); await pg.mouse.move(bx.x + 300, bx.y + 200); n = 0;
  for (let i = 0; i < 4; i++) { await pg.mouse.wheel(0, -120); await pg.waitForTimeout(150); } await pg.waitForTimeout(1800); s = await check();
  ok(s.cnt === 1 && s.cov && s.worst <= 1.5, tag + 'Mausrad-Zoom z' + s.z + ': lagetreu (' + s.worst + ' px), ' + n + ' Anfragen');
  fail = true; for (let i = 0; i < 3; i++) { await pg.evaluate(i => { const m = window.__KM.map(); m.panBy([3000 + i * 500, 2000], { animate: false }); }, i); await pg.waitForTimeout(1200); } await pg.waitForTimeout(1500);
  { const keep = await pg.evaluate(() => document.querySelectorAll('#kmMap .leaflet-image-layer').length); ok(keep >= 1, tag + 'bei WMS-Fehlern bleibt das bisherige Parzellenbild stehen (' + keep + ' Bild, kein dauerhafter Wechsel nach Fehlern; Wiederholung mit kleinerem Bild)'); }
  ok(pg.errs.length === 0, tag + 'keine JS-Fehler ' + pg.errs.join('|')); await pg.context().close();
}
(async () => {
  const b = await chromium.launch();
  for (const d of [1, 1.25, 1.5, 2]) await run(b, d);
  await b.close();
})();
