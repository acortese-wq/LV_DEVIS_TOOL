/* t75: Plan-PDF mit Zentrumskoordinate (Swisscom Geo-Portal / Netzauskunft) wird automatisch platziert – auch über «DXF/PDF importieren»;
   DXF-Farbe je Layer, «Eine Farbe für alle», «Originalfarben», Violett wenn keine Farbe bestimmbar */
const K = require('./lib/k.js'), { chromium, ok, mk, getS, tmp, fs } = K;
/* Minimal-PDF A4 quer: Rahmen absichtlich nicht mittig (x 20…742 pt), Plankopf wie Geo-Portal (Bezeichnungen und Werte getrennt, Zahlen aneinander) */
function pdf() {
  const st = 'q 1.5 w 0 0 0 RG 20 20 722 555 re S Q BT /F1 9 Tf 560 60 Td (Netzauskunft) Tj ET BT /F1 8 Tf 560 48 Td (Auskunftnummer) Tj ET BT /F1 8 Tf 560 40 Td (Zentrumskoordinate) Tj ET BT /F1 8 Tf 640 48 Td (2026-11-06-00280) Tj ET BT /F1 8 Tf 640 40 Td (2600000 / 1200000) Tj ET BT /F1 8 Tf 700 40 Td (3 Monate) Tj ET BT /F1 8 Tf 560 30 Td (Massstab) Tj ET BT /F1 8 Tf 600 30 Td (1:500) Tj ET';
  const o = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length ' + st.length + ' >>\nstream\n' + st + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let s = '%PDF-1.4\n', off = []; o.forEach((x, i) => { off.push(s.length); s += (i + 1) + ' 0 obj\n' + x + '\nendobj\n'; });
  const xr = s.length; s += 'xref\n0 ' + (o.length + 1) + '\n0000000000 65535 f \n' + off.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (o.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF\n';
  return s;
}
const dxf = (ents) => ['0', 'SECTION', '2', 'ENTITIES'].concat(ents.flat(), ['0', 'ENDSEC', '0', 'EOF']).join('\r\n') + '\r\n';
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1600, 1000);
  await pg.route('**/*', async r => { const u = r.request().url();
    if (u.endsWith('pdf.min.js')) return r.fulfill({ body: fs.readFileSync(K.V.pdf), contentType: 'application/javascript' });
    if (u.endsWith('pdf.worker.min.js')) return r.fulfill({ body: fs.readFileSync(K.V.pdfWorker), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } });
    if (/wmts|wms\.geo|SearchServer|api3/.test(u)) return r.fulfill({ status: 204 });
    r.fallback(); });
  await pg.evaluate(() => { window.__LVD.loadDemo(); }); await pg.waitForTimeout(1500);
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(1200);
  ok(/DXF\/PDF importieren/.test(await pg.textContent('[data-k=dxfin]')), 'Werkzeug heisst «DXF/PDF importieren»');
  // A) PDF über dasselbe Werkzeug → Planunterlage, automatisch platziert
  const P = tmp('t75_geoportal.pdf'); fs.writeFileSync(P, pdf());
  await pg.setInputFiles('#kmDxfF', P);
  for (let t = 0; t < 60 && await pg.evaluate(() => document.querySelector('#kmOvAuto').hidden); t++) await pg.waitForTimeout(250);
  const at = await pg.textContent('#kmOvAutoT');
  ok(/Geo-Portal \/ Netzauskunft erkannt/.test(at) && /2600000 \/ 1200000/.test(at) && /1:500/.test(at), 'Plankopf erkannt: ' + at);
  ok(await pg.locator('#kmOvAuto').isVisible(), 'Hinweis im Fenster «Ebenen» sichtbar (Fenster geöffnet)');
  await pg.click('[data-k=apply]'); await pg.waitForTimeout(1200);
  const ov = (await getS(pg)).karte.overlay;
  /* Rahmenmitte x = 381 pt, Seitenmitte 421 pt → Planmitte liegt 40 pt × 0.1764 m = 7.06 m östlich der Zentrumskoordinate */
  ok(ov && Math.abs(ov.E - 2600007.06) < 0.35 && Math.abs(ov.N - 1200000) < 0.35, 'Planmitte aus Zentrumskoordinate und Kartenrahmen: ' + (ov && ov.E.toFixed(2) + ' / ' + ov.N.toFixed(2)));
  ok(ov && Math.abs(ov.mpp * ov.w - 842 * 0.1764) < 0.5 && ov.conf && ov.rot === 0, 'Massstab 1:500 (Planbreite ' + (ov && (ov.mpp * ov.w).toFixed(1)) + ' m), ohne Rückfrage gültig, Nord oben');
  // B) DXF ohne Farben, unbekannte Layer → Violett; Farbe wählen
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(1200);
  const P0 = await pg.evaluate(() => window.__KM.M().lines[0].pts[0]), D = tmp('t75.dxf'), E = Math.round(P0[0]), N = Math.round(P0[1]);
  fs.writeFileSync(D, dxf([['0', 'LINE', '8', 'A', '10', E, '20', N, '11', E + 20, '21', N], ['0', 'LINE', '8', 'B', '10', E, '20', N + 5, '11', E + 20, '21', N + 5], ['0', 'LINE', '8', 'C', '62', '1', '10', E, '20', N + 9, '11', E + 20, '21', N + 9]]));
  await pg.setInputFiles('#kmDxfF', D); await pg.waitForSelector('#kmDxfAsk');
  ok(await pg.inputValue('#kmDxfAsk [data-dxc="A"]') === '#7b2cbf' && await pg.inputValue('#kmDxfAsk [data-dxc="B"]') === '#7b2cbf', 'keine Farbe bestimmbar → Violett');
  await pg.fill('#kmDxfAsk [data-dxc="B"]', '#ff8800');
  await pg.click('#kmDxfAsk [data-dxg=go]'); await pg.waitForTimeout(600);
  let L = (await pg.evaluate(() => JSON.parse(JSON.stringify(window.__KM.M().dxf.lay))));
  ok(L.A.c === '#7b2cbf' && L.B.c === '#ff8800' && L.B.fc === 1, 'gewählte Farbe im Importfenster übernommen');
  ok(L.C.c === '#7b2cbf' && (await pg.evaluate(() => window.__KM.M().dxf.it.find(s => s.l === 'C').c)) === '#ff0000', 'Objektfarbe aus der DXF (rot) bleibt erhalten');
  await pg.fill('#kmDxfB [data-dxc="A"]', '#008800'); await pg.dispatchEvent('#kmDxfB [data-dxc="A"]', 'change'); await pg.waitForTimeout(200);
  L = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__KM.M().dxf.lay)));
  ok(L.A.c === '#008800' && L.A.fc === 1, 'Farbe je Layer in der Seitenleiste änderbar');
  await pg.fill('#kmDxfAllC2', '#0055ff'); await pg.click('#kmDxfB [data-dxa=col]'); await pg.waitForTimeout(200);
  L = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__KM.M().dxf.lay)));
  ok(['A', 'B', 'C'].every(k => L[k].c === '#0055ff' && L[k].fc), '«Eine Farbe für alle» färbt alle Layer (auch Objekte mit eigener Farbe)');
  await pg.click('#kmDxfB [data-dxa=orig]'); await pg.waitForTimeout(200);
  L = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__KM.M().dxf.lay)));
  ok(L.A.c === '#7b2cbf' && L.B.c === '#ff8800' && !L.A.fc, '«Originalfarben» stellt den Ausgangszustand wieder her');
  await pg.fill('#kmDxfB [data-dxc="A"]', '#cc0000'); await pg.dispatchEvent('#kmDxfB [data-dxc="A"]', 'change'); await pg.waitForTimeout(200);
  await pg.click('[data-k=apply]'); await pg.waitForTimeout(1200);
  await pg.evaluate(() => { window.print = () => { window.__p = 1; }; }); await pg.click('#bReport'); await pg.waitForTimeout(800); await pg.click('#rpGo');
  for (let t = 0; t < 30 && !(await pg.evaluate(() => window.__p)); t++) await pg.waitForTimeout(250);
  const st = await pg.evaluate(() => [...document.querySelectorAll('#reportDoc .dxfbg polyline')].map(p => p.getAttribute('stroke')));
  ok(st.includes('#cc0000') && st.includes('#ff0000'), 'Bericht zeigt die gewählten Farben (' + [...new Set(st)].join(', ') + ')');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
