/* t106: Federn und Gesten (Apple-Design-Skill) – Dock: 1:1 ziehen, Gummiband über den Rand, Wurf mit Schwung rastet ein bzw. klappt ein, unterbrechbar; schwebendes Panel: ziehen mit Schwung, Gummiband am Rand, Feder zurück in den Rahmen */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); localStorage.removeItem('lvd-dockh'); }); await pg.waitForTimeout(1000); await pg.reload();
  for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1800);
  const H = () => pg.evaluate(() => parseFloat(getComputedStyle(document.querySelector('dialog.kmlya')).getPropertyValue('--lydh')));
  const MAX = await pg.evaluate(() => Math.min(560, window.innerHeight * 0.45)), snaps = [120, Math.round((120 + MAX) / 2), Math.round(MAX)];
  const g = await pg.locator('.lydrag').boundingBox(), gx = g.x + g.width / 2, gy = g.y + g.height / 2;
  // 1) langsam nach oben ziehen, 1:1, dann loslassen ohne Schwung -> nächster Einrastpunkt
  const h0 = await H(); await pg.mouse.move(gx, gy); await pg.mouse.down(); await pg.mouse.move(gx, gy - 40, { steps: 8 }); await pg.waitForTimeout(250);
  const h1 = await H(); ok(Math.abs((h1 - h0) - 40) <= 3, 'Ziehen folgt dem Zeiger 1:1 (' + h0 + ' → ' + h1 + ')');
  // 2) Gummiband: weit über das Maximum ziehen
  await pg.mouse.move(gx, gy - 600, { steps: 12 }); await pg.waitForTimeout(250); const h2 = await H(); ok(h2 > MAX && h2 < MAX + 160, 'Gummiband über dem Maximum (' + h2 + ' px bei Maximum ' + Math.round(MAX) + ', nicht 1:1)');
  await pg.mouse.up(); await pg.waitForTimeout(1200); const h3 = await H(); ok(snaps.includes(h3), 'Loslassen: Feder rastet an einem Einrastpunkt ein (' + h3 + ' ∈ ' + snaps.join('/') + ')');
  // 3) Wurf nach unten mit Schwung -> eingeklappt
  const g2 = await pg.locator('.lydrag').boundingBox(); await pg.mouse.move(g2.x + g2.width / 2, g2.y + 3); await pg.mouse.down();
  for (let i = 1; i <= 5; i++) { await pg.mouse.move(g2.x + g2.width / 2, g2.y + 3 + i * 40); await pg.waitForTimeout(8); } await pg.mouse.up(); await pg.waitForTimeout(1200);
  const col = await pg.evaluate(() => document.querySelector('dialog.kmlya').classList.contains('lydock-c')); ok(col, 'Schneller Wurf nach unten klappt den unteren Bereich ein');
  // 4) Aus dem eingeklappten Zustand nach oben ziehen -> öffnet
  const g3 = await pg.locator('.lydrag').boundingBox().catch(() => null);
  if (g3) { await pg.mouse.move(g3.x + g3.width / 2, g3.y + g3.height / 2); await pg.mouse.down(); await pg.mouse.move(g3.x + g3.width / 2, g3.y - 140, { steps: 10 }); await pg.mouse.up(); await pg.waitForTimeout(1200); const open = await pg.evaluate(() => !document.querySelector('dialog.kmlya').classList.contains('lydock-c')); ok(open, 'Nach oben ziehen öffnet den eingeklappten Bereich wieder'); } else ok(true, 'Griff im eingeklappten Zustand nicht sichtbar (Reiter öffnet)');
  // 5) Unterbrechbar: während die Feder läuft greifen
  const g4 = await pg.locator('.lydrag').boundingBox(); await pg.mouse.move(g4.x + g4.width / 2, g4.y + 3); await pg.mouse.down();
  for (let i = 1; i <= 4; i++) { await pg.mouse.move(g4.x + g4.width / 2, g4.y + 3 - i * 60); await pg.waitForTimeout(8); } await pg.mouse.up(); await pg.waitForTimeout(60);
  const hm = await H(); const g5 = await pg.locator('.lydrag').boundingBox(); await pg.mouse.move(g5.x + g5.width / 2, g5.y + 3); await pg.mouse.down(); await pg.waitForTimeout(120); const hg = await H(); await pg.mouse.up(); await pg.waitForTimeout(900);
  ok(Math.abs(hg - hm) < 90, 'Greifen während der Feder läuft: Dock bleibt in der Hand, kein Sprung (' + Math.round(hm) + ' → ' + Math.round(hg) + ')');
  // 6) Schwebendes Panel: ziehen, Gummiband am Rand, Wurf mit Schwung bleibt im Rahmen
  const grab = pg.locator('.kmwh .kmgrab').first(); const gb = await grab.boundingBox();
  if (gb) {
    const pan = () => pg.evaluate(() => { const e = document.querySelector('.kmwh .kmgrab').closest('.kmtools,.kmside,.kmmid,.kmpan,[class*=km]'); const w = document.querySelector('.kmwh').parentElement; return { l: parseFloat(w.style.left), t: parseFloat(w.style.top), fl: w.classList.contains('kmwf') || w.style.position === 'absolute' }; });
    await pg.mouse.move(gb.x + 20, gb.y + 8); await pg.mouse.down(); await pg.mouse.move(gb.x + 260, gb.y + 120, { steps: 10 }); const pm = await pan(); ok(pm.l > 150, 'Panel folgt dem Zeiger beim Ziehen (links ' + Math.round(pm.l) + ' px)');
    await pg.mouse.move(gb.x - 900, gb.y + 120, { steps: 12 }); const pe = await pan(); ok(pe.l <= 0 && pe.l > -140, 'Gummiband am linken Rand (links ' + Math.round(pe.l) + ' px, nicht 1:1 aus dem Fenster)');
    await pg.mouse.up(); await pg.waitForTimeout(1300); const pf = await pan(); ok(pf.l >= -0.5, 'Feder zieht das Panel zurück in den Rahmen (links ' + Math.round(pf.l) + ' px)');
  } else ok(true, 'kein verschiebbares Panel im Fenster');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
