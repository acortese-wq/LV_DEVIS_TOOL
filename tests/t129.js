/* t129: Parzellen ohne Kachelversatz (V143) – der Parzellenplan (cadastralwebmap) kommt als ein zusammenhängendes Bild;
   liefert der Dienst anfangs nicht, erscheinen vorübergehend Ersatzkacheln, und sobald das Bild kommt, werden sie wieder entfernt
   (früher blieb es dauerhaft bei den Kacheln mit Versatz). Der Dienst wird hier nachgebildet; Wartezeit im Test verkürzt. */
const K = require('./lib/k.js'), { chromium, ok, mk } = K, zlib = require('zlib');
const PNG1 = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' + '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1280, 860); let img = 0, tiles = 0, fail = 2;
  await pg.addInitScript(() => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms >= 15000 ? 300 : ms, ...a); localStorage.setItem('lvd-km-base', 'kataster'); });   /* 15-s-Wiederholung im Test kurz */
  await pg.route('**/*', r => { const u = r.request().url();
    if (/wms\.geo\.admin\.ch/.test(u) && /cadastralwebmap/.test(u) && /SRS=EPSG:3857/.test(u)) { img++; if (fail-- > 0) return r.fulfill({ status: 500, body: 'x' }); return r.fulfill({ status: 200, contentType: 'image/png', body: PNG1 }); }
    if (/cadastralwebmap-farbe\/default/.test(u)) { tiles++; return r.fulfill({ status: 200, contentType: 'image/png', body: PNG1 }); }
    return /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
  await pg.goto(K.INDEX); await pg.waitForTimeout(300);
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250);
  await pg.evaluate(() => { const K = window.__KM; K.map().setView(K.ll([2759020, 1191150]), 18, { animate: false }); }); await pg.waitForTimeout(2500);
  const tl = () => pg.evaluate(() => document.querySelectorAll('#kmMap img.leaflet-tile[src*="cadastralwebmap"]').length), io = () => pg.evaluate(() => document.querySelectorAll('#kmMap img.leaflet-image-layer[src*="cadastralwebmap"]').length);
  ok(img >= 3 && (await io()) === 1, 'Parzellen als ein Bild, nachdem der Dienst wieder liefert (' + img + ' Anfragen, ' + (await io()) + ' Bild)');
  ok((await tl()) === 0, 'Ersatzkacheln wieder entfernt (kein Versatz zwischen Kacheln) – zwischenzeitlich ' + tiles + ' Kacheln geladen');
  // Katalog-Ebene «Parzellen» wird ebenfalls als ein Bild geladen
  const ov = await pg.evaluate(() => { const L0 = window.L; let n = 0; const orig = L0.tileLayer.wms; L0.tileLayer.wms = function (u, o) { if (/cadastralwebmap/.test(o.layers)) n++; return orig.apply(this, arguments); }; return n; });
  ok(ov === 0, 'keine gekachelte WMS-Parzellenebene');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  await b.close();
})();
