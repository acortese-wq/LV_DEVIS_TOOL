/* t120: Start mit gespeicherter 3D-Ansicht im Projekt (S.v3d als Objekt) und mit weiteren null-Vorgaben – die Anwendung startet; der Fehler «Cannot convert undefined or null to object» in deepFill trat in V136–V139 auf (Edge/Pages) */
const K = require('./lib/k.js'), { chromium, ok, mk, getS } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.fill('#f_graben_L', '1'); await pg.waitForTimeout(600);
  await pg.evaluate(() => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); S.v3d = { img: 'data:image/jpeg;base64,/9j/4AAQ', at: 1, ex: 1 }; S.kopf.projekt = 'MIT3D'; localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify(S)); });
  await pg.reload(); await pg.waitForTimeout(1500);
  ok(pg.errs.length === 0, 'Start mit gespeicherter 3D-Ansicht ohne JS-Fehler ' + pg.errs.join('|'));
  const S = await getS(pg); ok(S && S.kopf.projekt === 'MIT3D' && S.v3d && S.v3d.img, 'Projekt und 3D-Ansicht bleiben erhalten');
  ok(await pg.locator('#startErr').count() === 0, 'keine Startfehler-Meldung'); await b.close();
})();
