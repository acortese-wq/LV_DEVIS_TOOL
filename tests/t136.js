/* t136: UX-Runde 11/2026 P3 – Befehle ohne Dubletten, «In Datensätze übernehmen» nur bei Neuem
   - leeres Projekt: Übernehmen inaktiv, Tooltip «Zuerst Leitung oder Objekt zeichnen»; nach Zeichnen Zähler «(1)», «(2)»
   - nach dem Übernehmen wieder inaktiv; gespeicherte, nicht übernommene Zeichnung bleibt übernehmbar
   - Modus «Einfach» bei 1440 px: Multifunktionsleiste minimiert, jeder Zeichenbefehl genau einmal sichtbar, «Speichern» genau einmal
   - Modus «Experte»: Multifunktionsleiste offen wie bisher; Speichern/Übernehmen nicht mehr in der Leiste */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX } = K;
async function pageA(b, mode) {
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.addInitScript(m => { localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lvd-uimode', m); window.__LVD_START_OFF = 1; }, mode);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.goto(process.env.LVD_URL || INDEX); await pg.waitForTimeout(2500); return pg;
}
const vis = (pg, re) => pg.evaluate(src => { const R = new RegExp(src); return [...document.querySelectorAll('dialog.kmdlg[open] button, dialog.kmdlg[open] a[role=button]')].filter(b => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && b.offsetParent && r.bottom > 0 && r.top < innerHeight && R.test((b.getAttribute('aria-label') || b.textContent).replace(/\s+/g, ' ').trim()); }).length; }, re.source);
(async () => {
  const b = await chromium.launch(), errs = [];
  // Einfach
  let pg = await pageA(b, 'e');
  ok(await pg.evaluate(() => document.querySelector('.lyrb').classList.contains('min')), 'Einfach: Multifunktionsleiste minimiert');
  const cmds = ['Linie zeichnen', 'Schacht setzen', 'Abzweiger setzen', 'Werkloch setzen', 'Gebäudeeinführung setzen'], cnt = {};
  for (const c of cmds) cnt[c] = await vis(pg, new RegExp('^' + c + '$'));
  ok(Object.values(cnt).every(n => n <= 1) && cnt['Linie zeichnen'] === 1 && cnt['Schacht setzen'] === 1 && cnt['Gebäudeeinführung setzen'] === 1, 'Einfach: kein Zeichenbefehl doppelt, Kernbefehle genau einmal sichtbar ' + JSON.stringify(cnt) + ' (Werkloch ist im Modus Einfach ausgeblendet)');
  const nSave = await vis(pg, /^Speichern$/), nAp = await vis(pg, /^In Datensätze übernehmen/);
  ok(nSave === 1 && nAp === 1, 'Speichern und Übernehmen je genau einmal sichtbar (' + nSave + '/' + nAp + ')');
  const ap = () => pg.evaluate(() => { const x = document.querySelector('.kmheadb [data-k=apply]'); return { d: x.disabled, t: x.textContent, ti: x.title }; });
  let a = await ap(); ok(a.d && a.ti === 'Zuerst Leitung oder Objekt zeichnen' && a.t === 'In Datensätze übernehmen', 'leeres Projekt: Übernehmen inaktiv, Tooltip «' + a.ti + '»');
  // zeichnen → Zähler
  await pg.evaluate(() => document.querySelector('#kmToolsBody [data-k=mpt]').click()); const bb = await pg.locator('#kmMap').boundingBox();
  await pg.mouse.click(bb.x + bb.width * 0.4, bb.y + bb.height * 0.6); await pg.waitForTimeout(500);
  a = await ap(); ok(!a.d && a.t === 'In Datensätze übernehmen (1)' && /1 Änderungen/.test(a.ti), 'nach 1 Schacht: «' + a.t + '»');
  await pg.mouse.click(bb.x + bb.width * 0.6, bb.y + bb.height * 0.6); await pg.waitForTimeout(500);
  a = await ap(); ok(a.t === 'In Datensätze übernehmen (2)', 'nach 2 Schächten: «' + a.t + '»');
  // Rückgängig → wieder 1
  await pg.evaluate(() => document.querySelector('#kmToolsBody [data-k=undo]').click()); await pg.waitForTimeout(400);
  a = await ap(); ok(a.t === 'In Datensätze übernehmen (1)', 'Rückgängig: «' + a.t + '»');
  // Übernehmen → Karte bleibt (Layout A), Knopf wieder inaktiv
  await pg.click('.kmheadb [data-k=apply]'); for (let t = 0; t < 30 && !(await pg.locator('dialog.kmlya[open] .kmheadb [data-k=apply]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1200);
  a = await ap(); ok(a.d && a.t === 'In Datensätze übernehmen', 'nach dem Übernehmen wieder inaktiv');
  // Experte: Leiste wie bisher, ohne Speichern/Übernehmen
  await pg.evaluate(() => window.__LYCMD.mode('x')); await pg.waitForTimeout(300);
  await pg.evaluate(() => window.__LYRB.min(false)); await pg.waitForTimeout(300);
  const rb = await pg.evaluate(() => [...document.querySelectorAll('.lyrb [data-rb]')].map(x => x.getAttribute('data-rb')));
  ok(rb.length > 10 && !rb.some(s => /data-k=(save|apply)/.test(s)), 'Experte: Multifunktionsleiste offen, ohne Speichern/Übernehmen (' + rb.length + ' Befehle)');
  await pg.evaluate(() => window.__LYCMD.mode('e')); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.querySelector('.lyrb').classList.contains('min')), 'zurück zu Einfach: Leiste wieder minimiert');
  errs.push(...pg.errs); await pg.close();
  // gespeicherte, nicht übernommene Zeichnung
  pg = await pageA(b, 's');
  await pg.evaluate(() => document.querySelector('#kmToolsBody [data-k=mpt]').click()); const bb2 = await pg.locator('#kmMap').boundingBox();
  await pg.mouse.click(bb2.x + bb2.width * 0.5, bb2.y + bb2.height * 0.6); await pg.waitForTimeout(400);
  await pg.click('.kmheadb [data-k=save]'); await pg.waitForTimeout(400);
  const S1 = await pg.evaluate(() => JSON.stringify(window.__LVD.S()));
  errs.push(...pg.errs); await pg.close();
  pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
  await pg.addInitScript(s0 => { localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lv-devis-tiefbau-v2', s0); window.__LVD_START_OFF = 1; }, S1);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.goto(process.env.LVD_URL || INDEX); await pg.waitForTimeout(2500);
  a = await ap(); ok(!a.d && a.t === 'In Datensätze übernehmen (1)', 'gesicherte, noch nicht übernommene Zeichnung: «' + a.t + '»');
  errs.push(...pg.errs);
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
