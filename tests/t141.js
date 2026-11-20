/* t141: UX-Runde 11/2026 P8 – Export-Knöpfe geordnet
   - klassisch: ein Hauptknopf «Drucken / PDF», daneben «Exportieren ▾» (Excel, Projektbericht, weitere Ausdrucke) und «Datei ▾» (Sichern/Laden JSON)
   - Menüs: Wahl schliesst, nur eines offen, Esc und Klick daneben schliessen; Sichern lädt die JSON-Datei herunter
   - Layout A: Register «Ausgabe» mit denselben Gruppen; Excel und Laden (JSON) funktionieren aus dem Arbeitsplatz */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX, fs } = K;
const STUB = r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback();
(async () => {
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.addInitScript(() => { if (!sessionStorage.getItem('t141')) { localStorage.setItem('lvd-layout', 'classic'); sessionStorage.setItem('t141', '1'); } window.__LVD_START_OFF = 1; window.print = () => { window.__printed = 1; }; });
  await pg.route('**/*', STUB); await pg.goto(process.env.LVD_URL || INDEX); await pg.waitForTimeout(1200);
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1200);
  const vis = () => pg.evaluate(() => [...document.querySelectorAll('.resbar button, .resbar summary')].filter(x => x.checkVisibility ? x.checkVisibility() : x.offsetParent).map(x => x.textContent.trim()));
  let v = await vis();
  ok(v.join(' | ') === 'Drucken / PDF | Exportieren | Datei', 'sichtbar: ' + v.join(' | '));
  ok(await pg.evaluate(() => [...document.querySelectorAll('.resbar > .btn:not(.ghost)')].length) === 1, 'genau ein Hauptknopf «Drucken / PDF»');
  await pg.click('#sExp'); await pg.waitForTimeout(150); v = await vis();
  ok(['Excel exportieren', 'Projektbericht (Druck/PDF) …', 'Ausführlich drucken (alle Rechenwege)', 'Kurzausdruck (1 Seite)'].every(t => v.includes(t)), '«Exportieren»: Excel, Projektbericht, weitere Ausdrucke');
  await pg.addScriptTag({ path: K.AXE }); let ax = await pg.evaluate(() => axe.run('.resbar').then(r => r.violations.map(x => x.id + ' ' + x.nodes[0].target)));
  ok(ax.length === 0, 'Menü offen: axe ohne Verstösse ' + ax.join('|'));
  await pg.click('#sFile'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => !document.querySelector('#mExp').open && document.querySelector('#mFile').open), 'nur ein Menü offen («Datei» schliesst «Exportieren»)');
  v = await vis(); ok(v.includes('Sichern (JSON)') && v.includes('Laden (JSON)'), '«Datei»: Sichern und Laden (JSON)');
  const [d1] = await Promise.all([pg.waitForEvent('download'), pg.click('#bSave')]); const J = JSON.parse(fs.readFileSync(await d1.path(), 'utf8'));
  ok(J.v === 2 && /Beispielprojekt/.test(J.data.kopf.projekt), 'Sichern (JSON) lädt das Projekt herunter');
  ok(await pg.evaluate(() => !document.querySelector('#mFile').open), 'Wahl schliesst das Menü');
  await pg.click('#sExp'); await pg.keyboard.press('Escape'); ok(await pg.evaluate(() => !document.querySelector('#mExp').open && document.activeElement.id === 'sExp'), 'Esc schliesst, Fokus zurück auf «Exportieren»');
  await pg.click('#sExp'); await pg.mouse.click(30, 600); ok(await pg.evaluate(() => !document.querySelector('#mExp').open), 'Klick daneben schliesst');
  await pg.click('#sExp'); await pg.click('#bReport'); await pg.waitForTimeout(300); ok(await pg.locator('#reportDlg[open]').count() === 1, 'Projektbericht aus dem Menü öffnet den Berichtsdialog');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // Layout A: Register «Ausgabe»
  await pg.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await pg.click('#bLyMap'); for (let t = 0; t < 30 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(200); await pg.waitForTimeout(800);
  await pg.evaluate(() => { window.__LYRB.min(false); document.querySelector('#lyRT_out').click(); }); await pg.waitForTimeout(300);
  const g = await pg.evaluate(() => [...document.querySelectorAll('#lyRP_out .lyrb-g')].map(x => x.getAttribute('aria-label') + ':' + x.querySelectorAll('[data-rb]').length));
  ok(g.join(',') === 'Drucken:1,Exportieren:4,Datei:2', 'Layout A «Ausgabe»: ' + g.join(', '));
  const [d2] = await Promise.all([pg.waitForEvent('download'), pg.click('#lyRP_out [data-rb="#bXlsx"]')]); ok(/\.xlsx$/.test(d2.suggestedFilename()), 'Excel aus dem Arbeitsplatz');
  const jf = K.tmp('t141.json'); fs.writeFileSync(jf, JSON.stringify(J));
  await pg.evaluate(() => { window.__LVD.S().kopf.projekt = 'anders'; });
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#lyRP_out [data-rb="[data-k=ldjson]"]')]); await fc.setFiles(jf); await pg.waitForTimeout(2500);
  ok(await pg.evaluate(() => /Beispielprojekt/.test(window.__LVD.S().kopf.projekt) && !!document.querySelector('dialog.kmlya[open]')), 'Laden (JSON) aus dem Arbeitsplatz: Projekt geladen, Karte wieder offen');
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
