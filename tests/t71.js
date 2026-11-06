/* t71: Route mit Kartenpunkten – 📍 je Feld, Fang auf Schacht (Anschluss) und Leitungsende, Route endet genau am Punkt, gerade Linie als Ersatz, Tastatur */
const { chromium, ok, mk, AXE } = require('./lib/k.js');
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1600, 1000); let fail = false;
  await pg.route('**/routed-foot/**', async r => { if (fail) return r.abort();
    const u = new URL(r.request().url()), c = u.pathname.split('/foot/')[1].split(';').map(s => s.split(',').map(Number)), A = c[0], B = c[1];
    const pts = []; for (let i = 0; i <= 6; i++) pts.push([A[0] + (B[0] - A[0]) * i / 6 + (i % 2 ? 0.00004 : 0), A[1] + (B[1] - A[1]) * i / 6 + 0.00003]);   /* Weg leicht neben den Punkten */
    await r.fulfill({ json: { code: 'Ok', routes: [{ geometry: { coordinates: pts } }], waypoints: [{ distance: 3 }, { distance: 4 }] } }); });
  await pg.evaluate(() => { window.__LVD.loadDemo(); }); await pg.waitForTimeout(1500);
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(1500);
  const M = () => pg.evaluate(() => JSON.parse(JSON.stringify(window.__KM.M())));
  const m0 = await M(), p1 = m0.pts[0], p4 = m0.pts[3];
  await pg.evaluate(() => { const K = window.__KM; if (K && K.fit) K.fit(); });
  await pg.click('[data-k=route]'); await pg.waitForTimeout(300);
  ok(await pg.locator('#kmRtPA').isVisible() && await pg.locator('#kmRtPB').isVisible(), 'je Feld ein Knopf «📍 Karte»');
  // Bildschirmposition eines Schachts
  const scr = (pt) => pg.evaluate(pt => { const m = window.__KM.map(), ll = window.__KM.ll(pt), q = m.latLngToContainerPoint(ll), r = document.querySelector('#kmMap').getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; }, pt);
  await pg.click('#kmRtPA'); ok(await pg.getAttribute('#kmRtPA', 'aria-pressed') === 'true' && /in die Karte klicken/.test(await pg.textContent('#kmRtMsg')), 'Punktwahl aktiv, Anleitung sichtbar');
  let s = await scr(p1.pt); await pg.mouse.click(s[0] + 9, s[1] + 6); await pg.waitForTimeout(300);
  ok(/^Schacht 1/.test(await pg.inputValue('#kmRtA')) && await pg.getAttribute('#kmRtPA', 'aria-pressed') === 'false', 'Klick neben Schacht 1 wird gefangen: «' + await pg.inputValue('#kmRtA') + '»');
  ok((await M()).lines.length === m0.lines.length && (await M()).pts.length === m0.pts.length, 'Punktwahl legt kein Objekt an');
  await pg.click('#kmRtPB'); s = await scr(p4.pt); await pg.mouse.click(s[0] - 7, s[1] - 8); await pg.waitForTimeout(300);
  ok(/^Schacht 4/.test(await pg.inputValue('#kmRtB')) && await pg.locator('#kmRtGo').isEnabled(), 'Ziel Schacht 4 gefangen, «Route erstellen» frei');
  await pg.addScriptTag({ path: AXE }); const ax = await pg.evaluate(() => axe.run(document.querySelector('#kmRoute')).then(r => r.violations.map(v => v.id)));
  ok(ax.length === 0, 'axe Routen-Fenster: ' + JSON.stringify(ax));
  await pg.click('#kmRtGo'); await pg.waitForTimeout(900);
  let m1 = await M(), L = m1.lines[m1.lines.length - 1];
  const same = (a, b) => Math.abs(a[0] - b[0]) < 0.011 && Math.abs(a[1] - b[1]) < 0.011;
  ok(m1.lines.length === m0.lines.length + 1 && L.route === 1, 'Routenlinie angelegt');
  ok(same(L.pts[0], p1.pt) && same(L.pts[L.pts.length - 1], p4.pt), 'Linie beginnt und endet genau auf den Schächten');
  ok(L.s === p1.id && L.e === p4.id, 'Linie an Schacht 1 und Schacht 4 angeschlossen');
  ok(/genau an den gewählten Kartenpunkten/.test(await pg.textContent('#kmRtMsg')), 'Meldung nennt die Kartenpunkte');
  // Adresse + Kartenpunkt mischen ist möglich: Feld A tippen verwirft den Kartenpunkt
  await pg.fill('#kmRtA', 'Bahn'); await pg.waitForTimeout(100); ok(await pg.locator('#kmRtGo').isDisabled(), 'Tippen ersetzt den Kartenpunkt (erst wieder frei nach Auswahl)');
  // Tastatur: Kartenmitte mit Enter, freier Punkt (kein Fang)
  await pg.click('#kmRtPA'); await pg.waitForTimeout(100); await pg.evaluate(() => { const m = window.__KM.map(); m.panBy([300, 260], { animate: false }); }); await pg.waitForTimeout(200);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  ok(/^Kartenpunkt E/.test(await pg.inputValue('#kmRtA')), 'Tastatur: Enter setzt die Kartenmitte als Startpunkt');
  await pg.click('#kmRtPB'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  ok(await pg.getAttribute('#kmRtPB', 'aria-pressed') === 'false' && await pg.locator('#kmRoute').isVisible(), 'Esc beendet nur die Punktwahl');
  // Ersatz: Dienst nicht erreichbar → gerade Linie anbieten
  await pg.click('#kmRtPB'); s = await scr(p4.pt); await pg.mouse.click(s[0], s[1]); await pg.waitForTimeout(300);
  fail = true; const n0 = (await M()).lines.length; await pg.click('#kmRtGo'); await pg.waitForTimeout(900);
  ok((await M()).lines.length === n0 && /nicht erreichbar/.test(await pg.textContent('#kmRtMsg')) && await pg.locator('#kmRtStr').isVisible(), 'Dienst aus: Meldung, keine Linie, Knopf «Gerade Linie zeichnen»');
  await pg.click('#kmRtStr'); await pg.waitForTimeout(500);
  const m2 = await M(), G = m2.lines[m2.lines.length - 1];
  ok(m2.lines.length === n0 + 1 && G.pts.length === 2 && !G.route && G.e === p4.id && same(G.pts[1], p4.pt), 'gerade Linie angelegt, an Schacht 4 angeschlossen');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
