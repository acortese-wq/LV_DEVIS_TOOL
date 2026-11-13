/* t64: Offene Positionen (OFFEN) – Hinweis überall (Kostentabelle, Kurzausdruck, Excel, Bericht, Karte) und eigene Preise erfassen */
const { chromium, ok, mk, getS, AXE, tmp } = require('./lib/k.js');
const { execFileSync } = require('child_process'), fs = require('fs');
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1400, 1000);
  await pg.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; window.__LVD.loadDemo(); }); await pg.waitForTimeout(1500); await require('./lib/k.js').noBE(pg);
  const out0 = await pg.evaluate(() => ({ n: window.__OUT.nOffen, zw: window.__OUT.sum.zwischen, netto: window.__OUT.sum.netto }));
  ok(out0.n > 0, 'Beispielprojekt hat offene Positionen (' + out0.n + ')');
  ok(new RegExp('Nicht im Total: ' + out0.n + ' offene').test(await pg.textContent('#result .kostblk')), 'Kostentabelle nennt die offenen Positionen direkt unter dem Total');
  ok(!/8\.1 % 8\.1 %/.test(await pg.textContent('#result .kostblk')) && /MWST 8\.1 %/.test(await pg.textContent('#result .kostblk')), 'MWST-Bezeichnung mit Satz, ohne Doppelung');
  ok(await pg.locator('#kpi button[data-act=offen]').count() === 1, 'Kennzeichen «OFFEN» oben ist anklickbar');
  // Kurzausdruck (1 Seite): Hinweis muss sichtbar bleiben
  await pg.evaluate(() => document.body.classList.add('summary-print')); await pg.emulateMedia({ media: 'print' });
  ok(await pg.locator('#result .kostblk tr.koffen').isVisible(), 'Kurzausdruck zeigt «Nicht im Total …»');
  await pg.emulateMedia({ media: 'screen' }); await pg.evaluate(() => document.body.classList.remove('summary-print'));
  // Dialog
  await pg.locator('#result .offennote button[data-act=offen]').click(); await pg.waitForSelector('#ofDlg[open]');
  const nRows = await pg.locator('#ofDlg tr[data-ofrow]').count(); ok(nRows > 0, 'Dialog listet die offenen Positionen (' + nRows + ' Zeilen)');
  await pg.addScriptTag({ path: AXE }); const ax = await pg.evaluate(() => axe.run(document.querySelector('#ofDlg')).then(r => r.violations.map(v => v.id + ' ' + v.nodes.map(n => n.target.join(' ')).join(';'))));
  ok(ax.length === 0, 'axe Dialog: ' + JSON.stringify(ax));
  const q0 = await pg.evaluate(() => { const td = document.querySelector('#ofDlg tr[data-ofrow="0"] td.num'); return parseFloat(td.textContent.replace(/'/g, '')); });
  await pg.fill('#ofDlg [data-of="0"][data-f="ep"]', 'abc'); await pg.click('#ofDlg button[value=save]'); await pg.waitForTimeout(200);
  ok(await pg.locator('#ofDlg[open]').count() === 1 && await pg.locator('#ofErr').isVisible(), 'ungültiger Preis: Dialog bleibt offen, Meldung');
  await pg.fill('#ofDlg [data-of="0"][data-f="ep"]', "1'250,50"); await pg.fill('#ofDlg [data-of="0"][data-f="why"]', 'Offerte Muster AG');
  ok(/CHF|[0-9]/.test(await pg.textContent('#ofDlg [data-ofs="0"]')), 'Betrag wird beim Tippen berechnet');
  await pg.click('#ofDlg button[value=save]'); await pg.waitForTimeout(800);
  const S1 = await getS(pg), recs = Object.values(S1.recs).flat().filter(r => r && r.oep);
  ok(recs.length === 1 && Object.values(recs[0].oep)[0].ep === '1250.50' && Object.values(recs[0].oep)[0].why === 'Offerte Muster AG', 'eigener Preis im Datensatz gespeichert (1250.50, Quelle)');
  const out1 = await pg.evaluate(() => ({ n: window.__OUT.nOffen, zw: window.__OUT.sum.zwischen, w: window.__OUT.warn.map(w => w.id) }));
  ok(out1.n < out0.n, 'weniger offene Positionen (' + out0.n + ' → ' + out1.n + ')');
  ok(Math.abs(out1.zw - out0.zw - q0 * 1250.5) < 0.6, 'Zwischentotal steigt um Menge × Preis (' + (out1.zw - out0.zw).toFixed(2) + ' ≈ ' + (q0 * 1250.5).toFixed(2) + ')');
  ok(out1.w.includes('offenErfasst'), 'Warnung «eigener Preis ausserhalb LV»');
  ok(await pg.locator('#result tr.erf').count() > 0 && /darin eigene Preise ausserhalb LV/.test(await pg.textContent('#result .kostblk')), 'Aufstellung markiert die Zeile, Kostentabelle weist eigene Preise aus');
  // Excel
  const xb = await pg.evaluate(() => Array.from(window.__LVD.xlsxBytes())); const xf = tmp('t64.xlsx'); fs.writeFileSync(xf, Buffer.from(xb));
  const xt = execFileSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print("".join(z.read(n).decode("utf8","ignore") for n in z.namelist() if n.endswith(".xml")))', xf]).toString();
  ok(/Nicht im Total: \d+ offene/.test(xt) && /darin eigene Preise ausserhalb LV/.test(xt) && /Eigener Preis \(ausserhalb LV\)/.test(xt), 'Excel: Kostenblatt mit beiden Hinweisen, Zeile als eigener Preis');
  // Projektbericht (Totale)
  await pg.click('#bReport'); await pg.waitForSelector('#reportDlg[open]'); await pg.check('#reportDlg input[value=total]'); await pg.click('#rpGo'); await pg.waitForTimeout(500);
  const rt = await pg.textContent('#reportDoc'); ok(/Offene Positionen \(nicht im Total\)/.test(rt) && /Eigene Preise \(ausserhalb LV\)/.test(rt) && /Nicht im Total:/.test(rt), 'Projektbericht: Totale und Kosten nennen offene und eigene Preise');
  await pg.evaluate(() => { document.body.classList.remove('report-print'); const d = document.getElementById('reportDoc'); if (d) d.remove(); });
  // Rückgängig über den Hinweis
  await pg.locator('.kmtoast button').last().click().catch(() => {}); await pg.waitForTimeout(600);
  // Entfernen (Feld leeren) – zuerst wieder setzen, dann leeren
  await pg.locator('#result .offennote button[data-act=offen]').click(); await pg.waitForSelector('#ofDlg[open]');
  await pg.fill('#ofDlg [data-of="0"][data-f="ep"]', '10'); await pg.click('#ofDlg button[value=save]'); await pg.waitForTimeout(600);
  await pg.locator('#result .offennote button[data-act=offen]').click(); await pg.waitForSelector('#ofDlg[open]');
  await pg.fill('#ofDlg [data-of="0"][data-f="ep"]', ''); await pg.click('#ofDlg button[value=save]'); await pg.waitForTimeout(600);
  const out2 = await pg.evaluate(() => window.__OUT.nOffen); ok(out2 === out0.n && !Object.values((await getS(pg)).recs).flat().some(r => r && r.oep), 'Feld leeren: Position wieder offen, nichts gespeichert');
  // Karte: Fussleiste nennt offene Positionen
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(1800);
  ok(/offen \(nicht im Total\)/.test(await pg.textContent('#kmCostF')), 'Karte: Fussleiste nennt die offenen Positionen');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
