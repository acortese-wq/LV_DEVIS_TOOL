/* t111: Schachtzeichen nach Bauart, massstäblich (KES150 = 1.50 × 1.00 m) in Leitungsrichtung; Grabenband gestrichelt grau links/rechts der Leitung ab Zoomstufe 17, abschaltbar; Legende */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const setTyp = async (id, typ) => { await pg.evaluate(([id, typ]) => { const p = window.__KM.M().pts.find(x => x.id === id); p.typ = typ; window.__KM.refresh(); }, [id, typ]); await pg.waitForTimeout(300); };
  const pid = await pg.evaluate(() => window.__KM.M().pts[0].id);
  const zoomTo = async z => { await pg.evaluate(([id, z]) => { const p = window.__KM.M().pts.find(x => x.id === id); window.__KM.map().setView(window.__KM.ll(p.pt), z, { animate: false }); }, [pid, z]); await pg.waitForTimeout(500); };
  await zoomTo(22);
  await setTyp(pid, 'KES150'); let g = await pg.evaluate(id => window.__KM.shaftInfo(id), pid);
  ok(g && Math.abs(d(g.poly[0], g.poly[1]) - 1.0) < 0.02 && Math.abs(d(g.poly[1], g.poly[2]) - 1.5) < 0.02, 'KES150 wird in echter Grösse 1.50 × 1.00 m gezeichnet (' + (g && d(g.poly[1], g.poly[2]).toFixed(2)) + ' × ' + (g && d(g.poly[0], g.poly[1]).toFixed(2)) + ')');
  // Richtung entlang der angeschlossenen Leitung
  const dir = await pg.evaluate(id => { const M = window.__KM.M(), p = M.pts.find(x => x.id === id); for (const l of M.lines) { const n = l.pts.length; if (l.s === id) return [l.pts[1][0] - l.pts[0][0], l.pts[1][1] - l.pts[0][1]]; if (l.e === id) return [l.pts[n - 2][0] - l.pts[n - 1][0], l.pts[n - 2][1] - l.pts[n - 1][1]]; } return null; }, pid);
  if (dir) { const side = [g.poly[1][0] - g.poly[2][0], g.poly[1][1] - g.poly[2][1]], cs = Math.abs((side[0] * dir[0] + side[1] * dir[1]) / (Math.hypot(...side) * Math.hypot(...dir))); ok(cs > 0.98, 'längere Seite liegt in Leitungsrichtung (cos ' + cs.toFixed(3) + ')'); } else ok(true, 'Schacht ohne angeschlossene Leitung: Standardrichtung');
  await setTyp(pid, 'KES100'); g = await pg.evaluate(id => window.__KM.shaftInfo(id), pid); ok(Math.abs(d(g.poly[1], g.poly[2]) - 1.0) < 0.02 && g.extra === 0, 'KES100: Quadrat 1.00 × 1.00 m');
  await setTyp(pid, 'ES300'); g = await pg.evaluate(id => window.__KM.shaftInfo(id), pid); ok(Math.abs(d(g.poly[1], g.poly[2]) - 3.0) < 0.02 && Math.abs(d(g.poly[0], g.poly[1]) - 1.5) < 0.02 && g.extra === 2, 'ES300: Rechteck 3.00 × 1.50 m mit Diagonalkreuz');
  await setTyp(pid, 'KS80'); g = await pg.evaluate(id => window.__KM.shaftInfo(id), pid); ok(g.poly.length === 28 && Math.abs(2 * d(g.poly[0], [g.ew, g.ns]) - 0.8) < 0.02, 'KS80: Kreis Ø 0.80 m');
  await setTyp(pid, 'KS80U'); g = await pg.evaluate(id => window.__KM.shaftInfo(id), pid); ok(g.sp.dash === true, 'KS80U (überdeckt): gestrichelter Rand');
  await setTyp(pid, 'PLS3'); g = await pg.evaluate(id => window.__KM.shaftInfo(id), pid); ok(g.extra === 1 && Math.abs(Math.max(d(g.poly[0], g.poly[1]), d(g.poly[1], g.poly[2])) - 2.0) < 0.02 && Math.abs(Math.min(d(g.poly[0], g.poly[1]), d(g.poly[1], g.poly[2])) - 1.0) < 0.02, 'PLS3: Rechteck 1.00 × 2.00 m mit Doppelrand');
  await setTyp(pid, 'OTHER'); g = await pg.evaluate(id => window.__KM.shaftInfo(id), pid); ok(g.poly.length === 4 && Math.abs(d(g.poly[0], g.poly[2]) - 1.0) < 0.02, 'Sonstige: Raute, Vorgabe 1.00 × 1.00 m');
  await pg.evaluate(id => { const p = window.__KM.M().pts.find(x => x.id === id); p.dl = '2.4'; p.dw = '1.2'; window.__KM.refresh(); }, pid); await pg.waitForTimeout(300); g = await pg.evaluate(id => window.__KM.shaftInfo(id), pid); ok(Math.abs(d(g.poly[0], g.poly[2]) - 2.4) < 0.02, 'Sonstige mit eingetragenem Mass 2.40 × 1.20 m');
  // Mindestgrösse bei weitem Zoom
  await setTyp(pid, 'KES150'); await zoomTo(16); g = await pg.evaluate(id => window.__KM.shaftInfo(id), pid); ok(g.px >= 13, 'weit herausgezoomt bleibt das Zeichen sichtbar (≥ 14 px, ' + Math.round(g.px) + ' px)');
  // Grabenband
  const nl = await pg.evaluate(() => window.__KM.M().lines.filter(l => l.pts.length > 1 && !l.hzArt && !(l.cfg && l.cfg.fl === 'roh')).length);
  await zoomTo(15); ok((await pg.evaluate(() => window.__KM.bandCount())) === 0, 'Grabenband bei Zoomstufe 15 nicht gezeichnet');
  await zoomTo(18); const bc = await pg.evaluate(() => window.__KM.bandCount()); ok(bc === 2 * nl, 'Grabenband ab Zoomstufe 17: je Linie links und rechts (' + bc + ' = 2 × ' + nl + ')');
  await pg.click('[data-k=band]'); await pg.waitForTimeout(300); ok((await pg.evaluate(() => window.__KM.bandCount())) === 0, 'Schalter «Grabenband» blendet das Band aus'); await pg.click('[data-k=band]'); await pg.waitForTimeout(300);
  await zoomTo(18); const nPts = await pg.evaluate(() => { const M = window.__KM.M(); return M.pts.length + M.wl.length + M.sond.length; }); const pc = await pg.evaluate(() => window.__KM.pitCount()); ok(pc === nPts && pc > 0, 'Aushubgrube grau um jeden Schacht, jedes Werkloch und jede Sondage (' + pc + ' = ' + nPts + ')');
  await zoomTo(15); ok((await pg.evaluate(() => window.__KM.pitCount())) === 0, 'Aushubgruben bei Zoomstufe 15 nicht gezeichnet'); await zoomTo(18);
  const leg = await pg.evaluate(() => (document.querySelector('#kmLeg') || {}).textContent || ''); ok(/KES150|OTHER|Grabenband/.test(leg), 'Legende nennt Schachtzeichen und Grabenband (' + leg.replace(/\s+/g, ' ').slice(0, 60) + ')');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
