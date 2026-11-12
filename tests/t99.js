/* t99: Planungsfokus startet mit dem Parzellenplan; eine gespeicherte eigene Kartenwahl geht vor; Klassik-Karte unverändert (Landeskarte) */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch();
  const open = async (pre) => {
    const pg = await mk(b, 1440, 900); const req = [];
    await pg.route('**/*', r => { const u = r.request().url(); if (/cadastralwebmap/.test(u)) { req.push(u); return r.fulfill({ status: 204 }); } return /wmts|wms\.geo|api3|SearchServer|swisstopo/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
    await pg.evaluate(p => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); if (p) localStorage.setItem('lvd-km-base', p); else localStorage.removeItem('lvd-km-base'); }, pre); await pg.waitForTimeout(900);
    await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(2200);
    return { pg, req };
  };
  let o = await open(null); const l0 = await o.pg.textContent('.lybtn .lybt');
  ok(/Parzellen/.test(l0), 'Planungsfokus ohne gespeicherte Wahl: Kartenquelle «' + l0 + '»'); ok(o.req.some(u => /LAYERS=ch\.kantone\.cadastralwebmap/.test(u)), 'Parzellenplan wird geladen (' + o.req.length + ' Anfragen)');
  o = await open('luft'); const l1 = await o.pg.textContent('.lybtn .lybt'); ok(/Luftbild/.test(l1), 'gespeicherte Wahl «Luftbild» geht vor (' + l1 + ')');
  ok(!(o.req.some(u => /LAYERS=ch\.kantone\.cadastralwebmap-farbe&STYLES=&SRS=EPSG:3857/.test(u))), 'dann kein Parzellenplan im Kartenbild');
  await b.close();
})();
