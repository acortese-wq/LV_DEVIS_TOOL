/* t81: Bedienmodi (Redesign Phase G) und Befehlsleiste Strg+K – Einfach/Standard/Experte gemerkt (nicht im Projekt), Einfach blendet aus,
   aber jede Funktion bleibt über die Befehlsleiste erreichbar; Befehlsleiste: Tastatur (Strg+K, ↑↓, Enter, Esc), Werkzeuge, Ansichten, Objekte,
   LV-Positionen; axe; keine Kostenwirkung */
const K = require('./lib/k.js'), { chromium, ok, mk, AXE } = K;
const toA = async pg => { await pg.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await pg.waitForTimeout(1200); await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500); };
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(800); await toA(pg);
  const S0 = await pg.evaluate(() => JSON.stringify(window.__LVD.S())), sum0 = await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum));
  ok(await pg.inputValue('#lyMode') === 's' && await pg.locator('#kmToolsBody [data-k=msond]').isVisible(), 'Vorgabe «Standard»: alle Werkzeuge sichtbar');
  ok(!(await pg.locator('.lykeys').isVisible()), 'Kürzel-Übersicht nur im Modus Experte');
  // Einfach
  await pg.selectOption('#lyMode', 'e'); await pg.waitForTimeout(200);
  const vis = async s => pg.locator(s).first().isVisible();
  ok(await vis('[data-k=mline]') && await vis('[data-k=mpt]') && await vis('[data-k=mgeb]') && await vis('[data-k=route]') && await vis('[data-k=medit]'), 'Einfach: Auswahl, Linie, Schacht, Gebäude, Route sichtbar');
  ok(!(await vis('[data-k=msond]')) && !(await vis('[data-k=dxfin]')) && !(await vis('[data-k=mtext]')) && !(await vis('[data-eop=del]')), 'Einfach: Sondage, DXF, Beschriftung, Knotenbearbeitung ausgeblendet');
  ok(!(await vis('#lyT_pos')) && !(await vis('#lyT_prof')) && await vis('#lyT_kost') && await vis('#lyT_warn'), 'Einfach: unten nur Kosten und Hinweise');
  ok(await pg.evaluate(() => localStorage.getItem('lvd-uimode')) === 'e' && await pg.evaluate(() => JSON.stringify(window.__LVD.S())) === S0, 'Modus gemerkt (lvd-uimode), Projektdaten unverändert');
  await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  ok(await pg.inputValue('#lyMode') === 'e' && await pg.evaluate(() => document.querySelector('dialog.kmlya').classList.contains('nc-m-e')), 'Modus bleibt nach Neuladen');
  // Befehlsleiste
  await pg.keyboard.press('Control+k'); await pg.waitForTimeout(200);
  ok(await pg.locator('.lycmdk').isVisible() && await pg.evaluate(() => document.activeElement.getAttribute('role')) === 'combobox', 'Strg+K öffnet die Befehlsleiste, Fokus im Suchfeld');
  await pg.addScriptTag({ path: AXE });
  let ax = await pg.evaluate(() => axe.run(document.querySelector('.lycmdk'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
  ok(ax.length === 0, 'axe Befehlsleiste: ' + JSON.stringify(ax));
  await pg.keyboard.type('sondage'); await pg.waitForTimeout(150);
  const t0 = await pg.textContent('#lykL [aria-selected=true]');
  ok(/Sondage/.test(t0) && /ausgeblendet/.test(t0), 'ausgeblendetes Werkzeug ist auffindbar und markiert: «' + t0.trim() + '»');
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
  ok(!(await pg.locator('.lycmdk').isVisible()) && await pg.getAttribute('[data-k=msond]', 'aria-pressed') === 'true', 'Enter führt aus: Werkzeug «Sondage» aktiv (Funktion bleibt erreichbar)');
  await pg.click('[data-k=msond]'); await pg.waitForTimeout(150);
  // Esc schliesst nur die Leiste
  await pg.keyboard.press('Control+k'); await pg.waitForTimeout(150); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok(!(await pg.locator('.lycmdk').isVisible()) && await pg.locator('dialog.kmlya[open]').count() === 1, 'Esc schliesst nur die Befehlsleiste');
  // Modus über die Befehlsleiste
  await pg.keyboard.press('Control+k'); await pg.keyboard.type('modus experte'); await pg.waitForTimeout(150); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
  ok(await pg.inputValue('#lyMode') === 'x' && await pg.locator('.lykeys').isVisible() && await vis('#lyT_pos'), 'Befehl «Bedienmodus: Experte» → alles sichtbar + Kürzel-Übersicht');
  // Objekt
  await pg.keyboard.press('Control+k'); await pg.keyboard.type('dorfstrasse ost'); await pg.waitForTimeout(150);
  const grp = await pg.evaluate(() => { const a = document.querySelector('#lykL [aria-selected=true]'); let g = a; while (g && !g.classList.contains('lyk-g')) g = g.previousElementSibling; return g && g.textContent; });
  ok(/Objekte/.test(grp || ''), 'Treffer in der Gruppe «' + grp + '»');
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => { const r = document.querySelector('.kmrow.on'); return r && r.getAttribute('data-rid'); }) === 'l3', 'Objekt gewählt (Linie 3) – Karte und Eigenschaften');
  // LV-Position
  await pg.keyboard.press('Control+k'); await pg.keyboard.type('151/621'); await pg.waitForTimeout(150);
  ok(await pg.locator('#lykL [role=option]').count() >= 1, 'LV-Positionen durchsuchbar');
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  ok(await pg.getAttribute('#lyT_pos', 'aria-selected') === 'true' && /^151\/621/.test(await pg.inputValue('[data-dq=q]')) && await pg.locator('#lyPosB tr').count() >= 1, 'Position → Dock «Positionen» gefiltert');
  // Ansicht
  await pg.keyboard.press('Control+k'); await pg.keyboard.type('hinweise'); await pg.waitForTimeout(150);
  const n = await pg.locator('#lykL [role=option]').count(); ok(n >= 1, 'Ansicht/Befehl «Hinweise» gefunden (' + n + ')');
  await pg.keyboard.press('Escape');
  await pg.click('.lycmdk-b'); await pg.waitForTimeout(150); ok(await pg.locator('.lycmdk').isVisible(), 'Knopf «Befehl» öffnet die Leiste'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => document.activeElement && document.activeElement.classList.contains('lycmdk-b')), 'Fokus kehrt zum Auslöser zurück');
  ok(await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum)) === sum0, 'Modi/Befehlsleiste ohne Kostenwirkung');
  for (const [w, h] of [[1920, 1080], [1280, 800], [1024, 768]]) { await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(400);
    ok(!(await pg.evaluate(() => document.querySelector('dialog.kmlya').scrollWidth > innerWidth + 1)), w + ' px ohne Überlauf'); }
  await pg.setViewportSize({ width: 1440, height: 900 }); await pg.keyboard.press('Control+k'); await pg.waitForTimeout(150);
  await pg.screenshot({ path: K.tmp('t81.png') });
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
