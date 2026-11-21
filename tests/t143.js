/* t143: UX-Runde 11/2026 P9 – Genauigkeit nach SIA-Phase (nur Anzeige)
   - Projektangaben: Auswahl «Phase / Genauigkeit» (Grobschätzung ±25 %, Kostenschätzung ±15 %, Kostenvoranschlag ±10 % = Vorgabe)
   - Wahl wird im Projekt gespeichert (S.genau, Sicherung JSON) und erscheint im Kostenhinweis, als Etikett im Kopf,
     in Layout A als Kennzahl «Genauigkeit» und im Projekt-/Machbarkeitsbericht
   - Kosten (netto/brutto) bleiben unverändert; eigener Wert aus den Parametern → «Eigene Genauigkeit ±x %»
   - Übersetzt (FR), axe ohne Verstösse */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX, fs } = K;
const STUB = r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback();
const chf = x => Number(x.replace(/[^0-9.]/g, ''));
(async () => {
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.addInitScript(() => { if (!sessionStorage.getItem('t143')) { localStorage.setItem('lvd-layout', 'classic'); sessionStorage.setItem('t143', '1'); } window.__LVD_START_OFF = 1; window.print = () => {}; });
  await pg.route('**/*', STUB); await pg.goto(process.env.LVD_URL || INDEX); await pg.waitForTimeout(1200);
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { document.querySelector('#kopfbox').open = true; });
  const opts = await pg.evaluate(() => [...document.querySelectorAll('#p_phase option')].map(o => (o.selected ? '*' : '') + o.textContent));
  ok(opts.join('|') === 'Grobschätzung ±25 %|Kostenschätzung ±15 %|*Kostenvoranschlag ±10 %', 'Auswahl mit 3 Phasen, Vorgabe Kostenvoranschlag ±10 %: ' + opts.join(' | '));
  ok(await pg.textContent('#l_phase') === 'Phase / Genauigkeit', 'Feld beschriftet');
  const sum0 = await pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum);
  await pg.selectOption('#p_phase', '25'); await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => ({ g: window.__LVD.S().genau, note: document.querySelector('#kGenau').textContent, tag: (document.querySelector('#kpi .tag-ph') || {}).textContent, tip: (document.querySelector('#kpi .tag-ph') || { title: '' }).title, sum: KVE.calc(window.__LVD.S(), LV).sum }));
  ok(r.g === '25', 'Wahl im Projekt gespeichert (genau = 25)');
  ok(r.sum.netto === sum0.netto && r.sum.brutto === sum0.brutto, 'Kosten unverändert (netto ' + r.sum.netto + ', brutto ' + r.sum.brutto + ')');
  const m = r.note.match(/^Grobschätzung ±25 %: CHF ([\d'’.]+) bis ([\d'’.]+) \(netto, ohne Reserve\)/);
  ok(!!m && Math.abs(chf(m[1]) - sum0.netto * 0.75) < 0.01 && Math.abs(chf(m[2]) - sum0.netto * 1.25) < 0.01, 'Kostenhinweis mit Bandbreite ±25 %: ' + r.note.slice(0, 80));
  ok(r.tag === 'Grobschätzung ±25 %' && /bis/.test(r.tip), 'Etikett im Kopf mit Bandbreite als Tooltip');
  // Parameter: eigener Wert
  await pg.click('[data-tab=par]'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { const i = document.querySelector('input[data-p=genau]'); i.value = '20'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForTimeout(800);
  const own = await pg.evaluate(() => ({ sel: document.querySelector('#p_phase').selectedOptions[0].textContent, note: document.querySelector('#kGenau').textContent }));
  ok(own.sel === 'Eigene Genauigkeit ±20 %' && /^Genauigkeit ±20 %/.test(own.note), 'eigener Wert aus den Parametern: ' + own.sel);
  await pg.selectOption('#p_phase', '15'); await pg.waitForTimeout(600);
  ok(await pg.evaluate(() => document.querySelectorAll('#p_phase option').length) === 3, 'nach Wahl einer Phase wieder 3 Einträge');
  // Sicherung JSON
  await pg.click('#sFile'); const [d1] = await Promise.all([pg.waitForEvent('download'), pg.click('#bSave')]); const J = JSON.parse(fs.readFileSync(await d1.path(), 'utf8'));
  ok(J.data.genau === '15', 'Sicherung (JSON) enthält die Phase (genau = 15)');
  // Berichte
  for (const art of ['pb', 'mb']) {
    await pg.click('#sExp'); await pg.click('#bReport'); await pg.waitForTimeout(300);
    await pg.check('#reportDlg input[name=rpa][value=' + art + ']'); await pg.click('#rpGo'); await pg.waitForTimeout(1500);
    const t = await pg.evaluate(() => { const h = [...document.querySelectorAll('#reportDoc th')].find(x => x.textContent === 'Phase / Genauigkeit'); return h ? h.nextElementSibling.textContent : ''; });
    ok(/^Kostenschätzung ±15 % · CHF [\d'’.]+ bis [\d'’.]+ netto$/.test(t), (art === 'pb' ? 'Projektbericht' : 'Machbarkeitsbericht') + ': Kopfzeile «' + t + '»');
    await pg.evaluate(() => { document.body.classList.remove('report-print'); const d = document.getElementById('reportDoc'); if (d) d.remove(); const g = document.getElementById('reportDlg'); if (g) g.close(); }); await pg.waitForTimeout(200);
  }
  await pg.addScriptTag({ path: K.AXE }); const ax = await pg.evaluate(() => axe.run('#kopfbox').then(x => x.violations.map(v => v.id + ' ' + v.nodes[0].target)));
  ok(ax.length === 0, 'Projektangaben ohne axe-Verstösse ' + ax.join('|'));
  // Layout A: Kennzahl
  await pg.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await pg.click('#bLyMap'); for (let i = 0; i < 30 && !(await pg.locator('dialog.kmlya[open]').count()); i++) await pg.waitForTimeout(200); await pg.waitForTimeout(1000);
  const k = await pg.evaluate(() => { const c = document.querySelector('#lyKpi .lyk-gen'); return c ? { t: c.innerText.replace(/\s+/g, ' ').trim(), tip: c.title } : null; });
  ok(k && /Genauigkeit ± 15 %/i.test(k.t) && /bis/.test(k.tip), 'Layout A: Kennzahl «Genauigkeit ± 15 %» mit Bandbreite als Tooltip' + (k ? ' (' + k.t + ')' : ''));
  // Französisch
  const pf = await b.newPage({ viewport: { width: 1440, height: 900 } }); pf.on('pageerror', e => errs.push(e.message));
  await pf.addInitScript(() => { localStorage.setItem('lvd-layout', 'classic'); window.__LVD_START_OFF = 1; }); await pf.route('**/*', STUB);
  await pf.goto((process.env.LVD_URL || INDEX) + '?lang=fr'); await pf.waitForTimeout(1500);
  const fr = await pf.evaluate(() => [document.querySelector('#l_phase').textContent, ...[...document.querySelectorAll('#p_phase option')].map(o => o.textContent)]);
  ok(fr.join('|') === 'Phase / précision|Estimation sommaire ±25 %|Estimation des coûts ±15 %|Devis ±10 %', 'FR: ' + fr.join(' | '));
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
