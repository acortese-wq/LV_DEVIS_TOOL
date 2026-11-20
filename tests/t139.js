/* t139: UX-Runde 11/2026 P6 – leere Zustände statt Nulltabellen
   - Layout A, leeres Projekt: Reiter «Kosten» zeigt Hinweis + «Linie zeichnen»/«Schacht setzen» (keine 0.00-Tabelle); Knopf aktiviert das Werkzeug
   - klassisch, leeres Projekt: keine Kostentabelle und keine leere «Aufstellung»
   - mit Positionen in Stufe 1: Zeilen «Rabatt Stufe 1 (0 %)», «Summe nach Rabatt» und «Installationspauschale 0» ausgeblendet; Netto unverändert
   - mit Rabatt (Beispielprojekt, Stufe > 1): Rabattzeilen sichtbar; leere Unterbereiche im Dock ausgeblendet */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX } = K;
const STUB = r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback();
async function pageA(b, layout) { const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.addInitScript(l => { localStorage.setItem('lvd-layout', l); window.__LVD_START_OFF = 1; }, layout); await pg.route('**/*', STUB); await pg.goto(process.env.LVD_URL || INDEX); await pg.waitForTimeout(2500); return pg; }
(async () => {
  const b = await chromium.launch(), errs = [];
  let pg = await pageA(b, 'a');
  await pg.evaluate(() => { const t = document.querySelector('#lyT_kost'); if (t.getAttribute('aria-selected') !== 'true') t.click(); }); await pg.waitForTimeout(300);
  let r = await pg.evaluate(() => { const p = document.querySelector('#lyP_kost'); return { empty: !!p.querySelector('.lyempty'), txt: p.textContent, tab: p.querySelectorAll('table').length, b: [...p.querySelectorAll('[data-lyk]')].map(x => x.textContent) }; });
  ok(r.empty && r.tab === 0 && /Noch keine Kosten – zeichne eine Leitung oder setze einen Schacht/.test(r.txt) && r.b.join('|') === 'Linie zeichnen|Schacht setzen', 'Layout A leer: Hinweis + Handlungsaufforderung, keine Nulltabelle');
  await pg.click('#lyP_kost [data-lyk=mline]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.querySelector('#kmToolsBody [data-k=mline]').getAttribute('aria-pressed')) === 'true', '«Linie zeichnen» aktiviert das Werkzeug');
  await pg.addScriptTag({ path: K.AXE }); const ax = await pg.evaluate(() => axe.run('#lyP_kost').then(x => x.violations.map(v => v.id)));
  ok(ax.length === 0, 'leerer Zustand ohne axe-Verstösse ' + ax.join(','));
  // ein Schacht (Stufe 1, kein Rabatt) → Nullzeilen weg
  await pg.evaluate(() => document.querySelector('#kmToolsBody [data-k=mpt]').click()); const bb = await pg.locator('#kmMap').boundingBox();
  await pg.mouse.click(bb.x + bb.width * 0.45, bb.y + bb.height * 0.6); await pg.waitForTimeout(400);
  await pg.click('.kmheadb [data-k=apply]'); for (let t = 0; t < 30 && !(await pg.locator('dialog.kmlya[open] #lyP_kost table.cost').count()); t++) await pg.waitForTimeout(200); await pg.waitForTimeout(800);
  r = await pg.evaluate(() => { const t = document.querySelector('#lyP_kost table.cost'); const rows = [...t.querySelectorAll('tr')].map(x => x.cells[0].textContent); const s = KVE.calc(window.__LVD.S(), LV).sum; return { rows, s, secs: [...document.querySelectorAll('#lyP_kost .lykx')].map(x => ({ h: x.querySelector('h4').textContent, n: x.querySelectorAll('tr').length })), net: [...t.querySelectorAll('tr')].find(x => /^Netto/.test(x.cells[0].textContent)).cells[1].textContent }; });
  ok(r.s.stufe === 1 && !r.rows.some(x => /Rabatt|nach Rabatt/.test(x)) && (r.s.inst ? true : !r.rows.some(x => /Installation/.test(x))), 'Stufe 1: Rabatt-/Installationszeilen mit 0 ausgeblendet (' + r.rows.join(' | ') + ')');
  ok(parseFloat(r.net.replace(/['’]/g, '')) === r.s.netto, 'Netto unverändert (' + r.net + ')');
  ok(r.secs.length >= 1 && r.secs.every(x => x.n > 0), 'nur Unterbereiche mit Inhalt: ' + r.secs.map(x => x.h + ' ' + x.n).join(', '));
  errs.push(...pg.errs); await pg.close();
  // klassisch leer
  pg = await pageA(b, 'classic');
  r = await pg.evaluate(() => ({ cost: document.querySelectorAll('#result table.cost').length, auf: /Aufstellung nach Elementen/.test(document.querySelector('#result').textContent), st: document.querySelector('#result .status').className }));
  ok(r.cost === 0 && !r.auf && /empty/.test(r.st), 'klassisch leer: nur Status, keine Nulltabellen');
  // Beispielprojekt (Rabattstufe > 1)
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1500);
  r = await pg.evaluate(() => { const s = KVE.calc(window.__LVD.S(), LV).sum, rows = [...document.querySelectorAll('#result .kostblk table.cost tr')].map(x => x.cells[0].textContent); return { s, rows }; });
  ok(r.s.stufe > 1 && r.rows.some(x => /Rabatt Stufe/.test(x)) && r.rows.some(x => /nach Rabatt/.test(x)), 'Rabattstufe ' + r.s.stufe + ': Rabattzeilen sichtbar');
  errs.push(...pg.errs);
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
