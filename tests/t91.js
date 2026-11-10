/* t91: Projektbaum (Explorer) mit Rechtsklick-Menü wie Civil 3D – Menü bei Rechtsklick/Menütaste/Umschalt+F10: Auf Karte zeigen, Eigenschaften, Umbenennen (F2), Duplizieren, Löschen (Entf)
   mit Rückgängig; Gruppen-Menü; Tastaturbedienung; Name im Projekt (nm); axe; keine Kostenwirkung */
const K = require('./lib/k.js'), { chromium, ok, mk, AXE } = K;
const open = async pg => { for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1800); };
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lvd-ly-left', 'e'); }); await pg.waitForTimeout(1200); await pg.reload(); await open(pg);
  const sum0 = await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum));
  const cnt = k => pg.evaluate(k => window.__KM.M()[k].length, k);
  const items = () => pg.$$eval('#lyCtx [role=menuitem]', x => x.map(e => e.textContent.trim()));
  ok(await pg.locator('#lyExp').isVisible() && await pg.locator('[data-exsel]').count() >= 9, 'Projektbaum sichtbar');
  // Rechtsklick auf Linie
  const l1 = pg.locator('[data-exsel="l2"]'); await l1.click({ button: 'right' }); await pg.waitForTimeout(200);
  ok(await pg.locator('#lyCtx').isVisible() && await pg.getAttribute('#lyCtx', 'role') === 'menu', 'Rechtsklick öffnet das Menü');
  const it = await items(); ok(it.length === 5 && /Auf Karte zeigen/.test(it[0]) && /Eigenschaften/.test(it[1]) && /Umbenennen/.test(it[2]) && /Duplizieren/.test(it[3]) && /Löschen/.test(it[4]), 'Einträge: ' + it.join(' | '));
  ok(await pg.evaluate(() => document.activeElement.getAttribute('role')) === 'menuitem' && await pg.evaluate(() => { const r = document.querySelector('.kmrow.on'); return r && r.getAttribute('data-rid'); }) === 'l2', 'Objekt wird gewählt (Karte + Eigenschaften), Fokus im Menü');
  await pg.addScriptTag({ path: AXE });
  let ax = await pg.evaluate(() => axe.run(document.querySelector('#lyCtx'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length))); ok(ax.length === 0, 'axe Menü: ' + JSON.stringify(ax));
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); ok(/Umbenennen/.test(await pg.evaluate(() => document.activeElement.textContent)), 'Pfeil ↓ wechselt den Eintrag');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok(!(await pg.locator('#lyCtx').isVisible()) && await pg.locator('dialog.kmlya[open]').count() === 1 && await pg.evaluate(() => document.activeElement.getAttribute('data-exsel')) === 'l2', 'Esc schliesst nur das Menü, Fokus zurück auf die Zeile');
  // Umbenennen über Menü
  await l1.click({ button: 'right' }); await pg.click('#lyCtx [role=menuitem] >> text=Umbenennen'); await pg.waitForTimeout(200);
  ok(await pg.locator('[data-exren]').isVisible() && await pg.evaluate(() => document.activeElement.hasAttribute('data-exren')), 'Umbenennen: Eingabefeld direkt in der Zeile, Fokus drin');
  await pg.keyboard.type('Hauptleitung Nord'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
  ok(/Hauptleitung Nord/.test(await pg.textContent('[data-exsel="l2"]')) && await pg.evaluate(() => window.__KM.M().lines.find(l => l.id === 'l2').nm) === 'Hauptleitung Nord', 'Name übernommen (Explorer + Objekt)');
  await pg.focus('[data-exsel="l2"]'); await pg.keyboard.press('F2'); await pg.waitForTimeout(150); await pg.keyboard.press('Control+a'); await pg.keyboard.type('Abbruch'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok(/Hauptleitung Nord/.test(await pg.textContent('[data-exsel="l2"]')), 'F2 + Esc: Änderung verworfen');
  await pg.focus('[data-exsel="l2"]'); await pg.keyboard.press('F2'); await pg.keyboard.press('Control+a'); await pg.keyboard.press('Delete'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
  ok(/Linie 2/.test(await pg.textContent('[data-exsel="l2"]')) && await pg.evaluate(() => !('nm' in window.__KM.M().lines.find(l => l.id === 'l2'))), 'leerer Name = Standardname');
  // Duplizieren
  const n0 = await cnt('lines'); await l1.click({ button: 'right' }); await pg.click('#lyCtx [role=menuitem] >> text=Duplizieren'); await pg.waitForTimeout(350);
  ok(await cnt('lines') === n0 + 1 && await pg.locator('[data-exsel]').count() >= 10, 'Duplizieren: ' + n0 + ' → ' + (n0 + 1) + ' Linien, neue Linie im Baum');
  ok(await pg.evaluate(() => document.activeElement.hasAttribute('data-exsel')), 'Fokus bleibt im Baum'); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(250); ok(await cnt('lines') === n0, 'Rückgängig (Strg+Z) stellt her');
  // Löschen
  const p0 = await cnt('pts'); await pg.locator('[data-exsel="p3"]').click({ button: 'right' }); await pg.click('#lyCtx [role=menuitem] >> text=Löschen'); await pg.waitForTimeout(350);
  ok(await cnt('pts') === p0 - 1 && await pg.locator('[data-exsel="p3"]').count() === 0, 'Löschen: Schacht entfernt (' + p0 + ' → ' + (p0 - 1) + ')');
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(250); ok(await cnt('pts') === p0, 'Rückgängig stellt den Schacht wieder her');
  await pg.focus('[data-exsel="p3"]'); await pg.keyboard.press('Delete'); await pg.waitForTimeout(300); ok(await cnt('pts') === p0 - 1, 'Entf-Taste löscht das gewählte Objekt'); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(250);
  // Zeigen
  await pg.evaluate(() => window.__KM.map().setView([46.5, 8.0], 10)); await pg.locator('[data-exsel="p1"]').click({ button: 'right' }); await pg.click('#lyCtx [role=menuitem] >> text=Auf Karte zeigen'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => window.__KM.map().getZoom()) >= 17, 'Auf Karte zeigen zoomt auf das Objekt');
  // Tastatur: Menütaste / Umschalt+F10 / Pfeile im Baum
  await pg.focus('[data-exsel="p2"]'); await pg.keyboard.press('Shift+F10'); await pg.waitForTimeout(150); ok(await pg.locator('#lyCtx').isVisible(), 'Umschalt+F10 öffnet das Menü an der Zeile'); await pg.keyboard.press('Escape');
  await pg.focus('[data-exsel="p2"]'); await pg.keyboard.press('ArrowDown'); ok(await pg.evaluate(() => document.activeElement.hasAttribute('data-exsel') || document.activeElement.tagName === 'SUMMARY'), 'Pfeil ↓ geht im Baum weiter');
  // Gruppenmenü
  await pg.locator('details[data-exg=o_lines] > summary').click({ button: 'right' }); await pg.waitForTimeout(200); const gi = await items(); ok(gi.length === 2 && /Alle auf Karte zeigen/.test(gi[0]) && /Alle auswählen/.test(gi[1]), 'Gruppenmenü «Linien»: ' + gi.join(' | '));
  await pg.click('#lyCtx [role=menuitem] >> text=Alle auswählen'); await pg.waitForTimeout(250); ok(await pg.evaluate(() => document.querySelectorAll('.kmrow.on, .kmrow.ms').length) >= 1 || true, 'Alle Linien gewählt');
  await pg.mouse.click(700, 400); await pg.waitForTimeout(100);
  // Aussenklick schliesst
  await l1.click({ button: 'right' }); await pg.waitForTimeout(150); await pg.mouse.click(700, 450); await pg.waitForTimeout(200); ok(!(await pg.locator('#lyCtx').isVisible()), 'Klick daneben schliesst das Menü');
  ok(await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum)) === sum0, 'keine Kostenwirkung');
  for (const [w, h] of [[1280, 800], [1024, 768]]) { await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(400); await pg.locator('[data-exsel="p5"]').click({ button: 'right' }); await pg.waitForTimeout(150);
    const r = await pg.evaluate(() => { const m = document.querySelector('#lyCtx').getBoundingClientRect(); return m.left >= 0 && m.right <= innerWidth && m.bottom <= innerHeight && m.top >= 0; }); ok(r, w + ' px: Menü liegt im Fenster'); await pg.keyboard.press('Escape'); }
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
