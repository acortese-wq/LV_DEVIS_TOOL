/* t128: Oberfläche aus Vermessung (V143) – Bodenbedeckung der amtlichen Vermessung (cadastralwebmap, geo.admin.ch) an der Linienlage:
   grau = befestigt → Belag, grün = humusiert → Wiese; Wechsel → Linie geteilt; Vorschlag vor Übernahme; von Hand gesetzte Oberfläche bleibt; Rückgängig.
   Der Dienst wird hier durch ein erzeugtes Bild ersetzt (links grau = Strasse, rechts unbemalt = humusiert) – die echte Darstellung des Dienstes ist damit nicht geprüft. */
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
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900); let calls = 0;
  await pg.route('**/*', r => { const u = r.request().url();
    if (/wms\.geo\.admin\.ch/.test(u) && /REQUEST=GetMap/.test(u) && /cadastralwebmap/.test(u) && /TRANSPARENT=TRUE/.test(u)) { calls++; const q = new URL(u).searchParams, W = +q.get('WIDTH'), H = +q.get('HEIGHT');
      return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: png(W, H, (x, y) => (y % 37 === 0 ? [40, 40, 40, 255] : x < W / 2 ? [224, 224, 224, 255] : [0, 0, 0, 0])) }); }
    return /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
  const C = await pg.evaluate(() => [KARTE.avCls(224, 224, 224, 255), KARTE.avCls(0, 0, 0, 0), KARTE.avCls(255, 192, 192, 255), KARTE.avCls(163, 239, 163, 255), KARTE.avCls(153, 204, 255, 255), KARTE.avCls(239, 230, 200, 255), KARTE.avCls(40, 40, 40, 255)]);
  ok(C.join() === 'belag,wiese,geb,wald,wasser,bahn,', 'Offizielle CWM-Legende: grau → Belag, unbemalt → Wiese, rosa → Gebäude, hellgrün → Wald, blau → Gewässer, beige → Bahn, dunkel → übersprungen (' + C.join() + ')');
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1200);
  await pg.evaluate(() => { const K = window.__KM, M = K.M(); M.lines.length = 0; M.pts.length = 0; M.geb.length = 0; M.wl.length = 0; M.sond.length = 0; const R = { sys: 'k55', dn: '55', len: '10', n: '1' };
    M.lines.push({ id: 'a', pts: [[2759000, 1191100], [2759040, 1191100]], rid: null, rohr: R, cfg: { rt: { 55: 1 }, art: 'kies', fl: 'belag', T: '', B: '' } });   /* übernommene Vorgabe (nicht von Hand) */
    M.lines.push({ id: 'h', pts: [[2759000, 1191200], [2759040, 1191200]], rid: null, rohr: R, cfg: { rt: { 55: 1 }, art: 'kies', fl: 'pflaster', flSrc: 'hand', T: '', B: '' } });
    K.refresh(); K.map().setView(K.ll([2759020, 1191150]), 17, { animate: false }); K.select(null); });
  await pg.waitForTimeout(400);
  ok(await pg.locator('[data-k=avfl]').count() === 1, 'Knopf «Oberfläche aus Vermessung» vorhanden');
  await pg.evaluate(() => document.querySelector('[data-k=avfl]').click()); await pg.waitForTimeout(1500);
  const ask = await pg.evaluate(() => { const a = document.querySelector('#kmAsk'); return a && !a.hidden ? a.textContent : ''; });
  ok(calls === 1 && (m => m && Math.abs(+m[1] - 20) <= 0.5 && Math.abs(+m[2] - 20) <= 0.5)(/Vorschlag aus der Vermessung: ([\d.]+) m Belag, ([\d.]+) m Wiese/.exec(ask)) && /von Hand gesetzter Oberfläche bleiben/.test(ask), 'Vorschlag: je ~20 m Belag und Wiese (±0.5 m); Linie mit Hand-Oberfläche bleibt (' + ask.slice(0, 160) + ')');
  await pg.locator('#kmAsk button', { hasText: 'Übernehmen' }).click(); await pg.waitForTimeout(600);
  const L = await pg.evaluate(() => window.__KM.M().lines.map(l => ({ id: l.id, fl: (l.cfg || {}).fl, len: Math.round(Math.hypot(l.pts[l.pts.length - 1][0] - l.pts[0][0], l.pts[l.pts.length - 1][1] - l.pts[0][1]) * 10) / 10, pv: l.pv || '' })));
  const a = L.find(x => x.id === 'a'), a2 = L.find(x => x.pv === 'a'), h = L.find(x => x.id === 'h');
  ok(a && a2 && a.fl === 'belag' && a2.fl === 'wiese' && Math.abs(a.len - 20) <= 0.5 && Math.abs(a2.len - 20) <= 0.5, 'Linie am Wechsel geteilt: ' + (a && a.len) + ' m Belag + ' + (a2 && a2.len) + ' m Wiese (Kette ohne Schacht)');
  ok(h && h.fl === 'pflaster' && L.length === 3, 'Von Hand gesetzte Pflästerung unverändert');
  await pg.evaluate(() => document.querySelector('[data-k=undo]').click()); await pg.waitForTimeout(400);
  ok((await pg.evaluate(() => window.__KM.M().lines.length)) === 2, 'Rückgängig stellt die ungeteilte Linie wieder her');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  await b.close();
})();
