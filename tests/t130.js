/* t130: Gebäude und Bodenbedeckung (V143) – Leitung durch ein Gebäude (amtliche Vermessung) → roter Prüfhinweis mit Länge; Linienende mit Gebäudeeinführung
   (Hausanschluss) ausgenommen; Höhenprofil zeigt die Bodenbedeckung als Farbband (Belag/Gebäude/Wiese). Dienst durch erzeugtes Bild ersetzt (Drittel grau/rosa/unbemalt, Farben der CWM-Legende). */
const K = require('./lib/k.js'), { chromium, ok, mk } = K, zlib = require('zlib');
function png(W, H, px) {   /* kleiner PNG-Encoder (RGBA) */
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; for (let x = 0; x < W; x++) { const p = px(x, y), o = y * (W * 4 + 1) + 1 + x * 4; raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3]; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900); let pat = 'drittel';
  await pg.route('**/profile.json**', async r => { const u = new URL(r.request().url()), g = JSON.parse(u.searchParams.get('geom')), n = +u.searchParams.get('nb_points') || 5; let L = 0; const c = g.coordinates; for (let i = 1; i < c.length; i++) L += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
    await r.fulfill({ json: Array.from({ length: n }, (_, i) => ({ dist: L * i / (n - 1), alts: { COMB: 600 + i * 0.5 } })), headers: { 'access-control-allow-origin': '*' } }); });
  await pg.route('**/*', r => { const u = r.request().url();
    if (/wms\.geo\.admin\.ch/.test(u) && /REQUEST=GetMap/.test(u) && /cadastralwebmap/.test(u) && /EPSG:2056/.test(u)) { const q = new URL(u).searchParams, W = +q.get('WIDTH'), H = +q.get('HEIGHT');
      return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: png(W, H, (x, y) => pat === 'haus' ? (x < W / 2 ? [224, 224, 224, 255] : [255, 192, 192, 255]) : x < W / 3 ? [224, 224, 224, 255] : x < 2 * W / 3 ? [255, 192, 192, 255] : [0, 0, 0, 0]) }); }
    return /profile\.json/.test(u) ? r.fallback() : /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
  ok((await pg.evaluate(() => KARTE.avCls(255, 192, 192, 255))) === 'geb', 'rosa/rot = Gebäude');
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1200);
  // Linie quer durch: Strasse → Gebäude → Garten (bbox ±3 m: Drittel ≈ 0–19 m / 19–41 m / 41–60 m)
  await pg.evaluate(() => { const K = window.__KM, M = K.M(); M.lines.length = 0; M.pts.length = 0; M.geb.length = 0; M.wl.length = 0; M.sond.length = 0; const R = { sys: 'k55', dn: '55', len: '10', n: '1' };
    M.lines.push({ id: 'q', pts: [[2759000, 1191100], [2759060, 1191100]], rid: null, rohr: R, cfg: { rt: { 55: 1 }, art: 'kies', fl: '', T: '', B: '' } }); K.refresh(); K.select('q'); });
  await pg.evaluate(() => document.querySelector('[data-k=avfl]').click()); await pg.waitForTimeout(1500);
  const rc = await pg.evaluate(() => document.querySelector('#kmChk') ? document.querySelector('#kmChk').textContent : '');
  const m = /Linie 1 führt durch ein Gebäude \(([\d.]+) m/.exec(rc);
  ok(m && Math.abs(+m[1] - 22) <= 1.5, 'Prüfhinweis rot: «Linie 1 führt durch ein Gebäude (' + (m && m[1]) + ' m …)»');
  ok(/⛔ Gebäude/.test(await pg.evaluate(() => (document.querySelector('#kmAsk') || {}).textContent || '')), 'Vorschlag zeigt den Gebäudeabschnitt');
  await pg.evaluate(() => { const a = document.querySelector('#kmAsk'); if (a) a.hidden = true; });
  // Höhenprofil: Farbband
  await pg.click('[data-pfb]'); await pg.waitForTimeout(400); await pg.evaluate(() => { const b = document.querySelector('[data-pf=load]'); if (b) b.click(); }); await pg.waitForTimeout(1500);
  const bd = await pg.evaluate(() => [...document.querySelectorAll('#kmPfSvg rect.pfbd')].map(r => r.getAttribute('class').replace('pfbd ', '')));
  ok(bd.join() === 'belag,geb,wiese', 'Höhenprofil: Bodenbedeckung als Band Belag → Gebäude → Wiese (' + bd.join() + ')');
  ok(/Bodenbedeckung: amtliche Vermessung/.test(await pg.evaluate(() => document.querySelector('#kmProf').textContent)), 'Legende nennt die Quelle');
  // Hausanschluss: Linie endet im Gebäude an einer Gebäudeeinführung → kein Hinweis (Bild: links Strasse, rechts Gebäude)
  pat = 'haus';
  await pg.evaluate(() => { const K = window.__KM, M = K.M(); M.lines.length = 0; M.geb.length = 0; const R = { sys: 'k55', dn: '55', len: '10', n: '1' };
    M.lines.push({ id: 'h', pts: [[2759000, 1191100], [2759030, 1191100]], rid: null, rohr: R, cfg: { rt: { 55: 1 }, art: 'kies', fl: '', T: '', B: '' } });
    M.geb.push({ id: 'g1', pt: [2759030, 1191100], sid: null, cm: '', abd: 'hauff', name: '' }); K.refresh(); K.select('h'); });
  await pg.evaluate(() => document.querySelector('[data-k=avfl]').click()); await pg.waitForTimeout(1500);
  const rc2 = await pg.evaluate(() => document.querySelector('#kmChk').textContent), ask2 = await pg.evaluate(() => (document.querySelector('#kmAsk') || {}).textContent || '');
  ok(/Gebäude/.test(ask2) && !/führt durch ein Gebäude/.test(rc2), 'Hausanschluss (Ende im Gebäude an der Gebäudeeinführung): Gebäude erkannt, aber kein Hinweis');
  await pg.evaluate(() => { const a = document.querySelector('#kmAsk'); if (a) a.hidden = true; const M = window.__KM.M(); M.geb.length = 0; window.__KM.refresh(); });
  await pg.waitForTimeout(400);
  ok(/Linie 1 führt durch ein Gebäude/.test(await pg.evaluate(() => document.querySelector('#kmChk').textContent)), 'ohne Gebäudeeinführung am Ende: Hinweis erscheint');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  await b.close();
})();
