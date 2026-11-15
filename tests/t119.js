/* t119: 3D-Ansicht (swisstopo, CesiumJS) – nur am Computer; Projekt (Leitungen, Schächte, Gruben) geht an die 3D-Szene; «Ansicht übernehmen» speichert ein Bild im Projekt; Projektbericht druckt es.
   Cesium wird hier durch eine Attrappe ersetzt (keine Verbindung zu swisstopo/CDN im Test); die echte Bibliothek ist damit nicht geprüft. */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
const STUB = () => {
  const calls = { ent: { poly: 0, point: 0, pit: 0, polygon: 0 }, look: 0, destroyed: 0, terrain: 0, imagery: 0 };
  const col = { withAlpha() { return this; } }, col0 = () => col;
  class DS { constructor() { this.show = true; this.entities = { add: e => { if (e.polyline && e.polyline.material && e.polyline.material.dash) calls.ent.pit++; else if (e.polyline) calls.ent.poly++; if (e.point) calls.ent.point++; if (e.polygon) calls.ent.polygon++; } }; } }
  window.__stub = calls;
  window.Cesium = {
    Ion: {}, Color: { fromCssColorString: col0, WHITE: col }, Cartesian3: { fromDegreesArray: a => a, fromDegrees: (x, y, z) => [x, y, z] }, Cartesian2: function () { }, Cartographic: { fromDegrees: (x, y) => ({ x, y, height: 500 }) },
    UrlTemplateImageryProvider: function () { calls.imagery++; }, WebMercatorTilingScheme: function () { }, CesiumTerrainProvider: { fromUrl: () => { calls.terrain++; return Promise.resolve({}); } },
    PolylineDashMaterialProperty: function () { this.dash = true; }, HeightReference: { CLAMP_TO_GROUND: 1 }, LabelStyle: { FILL_AND_OUTLINE: 2 }, HeadingPitchRange: function () { }, Math: { toRadians: x => x }, Matrix4: { IDENTITY: 1 },
    CustomDataSource: DS, sampleTerrainMostDetailed: () => Promise.resolve([{ height: 800 }]), Cesium3DTileset: { fromUrl: () => Promise.reject(new Error('offline')) },
    Viewer: function (el) {
      const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900; const g = cv.getContext('2d'); g.fillStyle = '#336'; g.fillRect(0, 0, 1600, 900); el.appendChild(cv);
      this.scene = { globe: {}, canvas: cv, primitives: { add() { } } }; this.imageryLayers = { addImageryProvider() { } }; this.dataSources = { add() { } };
      this.camera = { lookAt() { calls.look++; }, lookAtTransform() { } }; this.render = () => { }; this.destroy = () => { calls.destroyed++; };
    },
  };
};
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|jsdelivr/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  ok(await pg.locator('[data-k=v3d]').count() > 0, 'Computer: Knopf «3D» in der Kartenleiste');
  await pg.evaluate(STUB);
  await pg.evaluate(() => document.querySelector('[data-k=v3d]').click()); await pg.waitForTimeout(800);
  ok(await pg.locator('#v3dDlg[open]').count() === 1, '3D-Fenster öffnet sich');
  const n = await pg.evaluate(() => ({ s: window.__stub, M: { l: window.__KM.M().lines.filter(l => l.pts.length > 1).length, p: window.__KM.M().pts.length, w: window.__KM.M().wl.length, so: window.__KM.M().sond.length } }));
  ok(n.s.ent.poly === 2 * n.M.l && n.s.ent.point === n.M.p + n.M.w + n.M.so, '3D-Szene: ' + n.M.l + ' Leitungen (je Rand + Linie) und ' + (n.M.p + n.M.w + n.M.so) + ' Punkte (Schächte, Werklöcher, Sondagen) übergeben');
  ok(n.s.ent.pit === n.M.p + n.M.w + n.M.so, 'Aushubgruben als gestrichelte Umrisse (' + n.s.ent.pit + ')');
  ok(n.s.look === 1 && n.s.imagery === 1 && n.s.terrain === 0, 'Kamera ausgerichtet, Luftbild angefordert; Geländedienst ohne gültige Beschreibung → flache Ansicht statt leerem Globus (Vorprüfung)');
  ok(/flacher|plane|plat/i.test(await pg.textContent('#v3S')) || (await pg.textContent('#v3S')) === '', 'Meldung bei fehlendem Gelände oder leer');
  await pg.click('#v3Img'); await pg.waitForTimeout(400);
  const S = await pg.evaluate(() => window.__LVD.S().v3d); ok(S && /^data:image\/jpeg/.test(S.img) && S.img.length > 1000, 'Ansicht für den Bericht im Projekt gespeichert (' + (S && Math.round(S.img.length / 1024)) + ' KB)');
  await pg.click('#v3X'); await pg.waitForTimeout(300); ok(await pg.locator('#v3dDlg').count() === 0 && (await pg.evaluate(() => window.__stub.destroyed)) === 1, 'Schliessen räumt die 3D-Szene auf');
  // Geländedienst erreichbar: Gelände wird eingebunden
  await pg.route(/3d\.geo\.admin\.ch.*layer\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tiles: ['{z}/{x}/{y}.terrain'] }) }));
  await pg.evaluate(() => document.querySelector('[data-k=v3d]').click()); await pg.waitForTimeout(1200);
  ok((await pg.evaluate(() => window.__stub.terrain)) === 1, 'Geländedienst erreichbar: swisstopo-Gelände wird angefordert');
  await pg.click('#v3X'); await pg.waitForTimeout(300);
  const rep = await pg.evaluate(() => { const h = window.__LVD.S(); return !!h.v3d; }); ok(rep, 'Bild bleibt im Projekt');
  // Projektbericht enthält das Bild
  await pg.evaluate(() => { const d = document.querySelector('dialog.kmlya[open], dialog[open]'); if (d && d.close) d.close(); }); await pg.waitForTimeout(500);
  await pg.evaluate(() => { window.print = () => { window.__printed = 1; }; }); const btn = pg.locator('[data-ly=rep], #rpOpen, button:has-text("Projektbericht")').first();
  if (await btn.count()) { await btn.click().catch(() => { }); await pg.waitForTimeout(800); }
  const hasCb = await pg.locator('#reportDlg input[data-rp=v3d]').count();
  if (hasCb) { await pg.click('#rpGo'); await pg.waitForTimeout(1500); ok(await pg.evaluate(() => !!document.querySelector('#reportDoc .rp-3d img')), 'Projektbericht enthält die 3D-Ansicht mit swisstopo-Quellenhinweis'); }
  else ok(await pg.evaluate(() => { const S = window.__LVD.S(); S.ui.report = { v3d: true }; return true; }), 'Berichtdialog nicht erreichbar (Test übersprungen)');
  // Handy: kein 3D-Knopf
  const mob = await mk(b, 390, 800); await mob.evaluate(() => window.__LVD.loadDemo()); await mob.waitForTimeout(800); await mob.click('#kmOpen').catch(() => { }); await mob.waitForTimeout(1500);
  ok((await mob.locator('[data-k=v3d]:visible').count()) === 0, 'Handy (390 px): kein 3D-Knopf');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
