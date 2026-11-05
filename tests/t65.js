/* t65: Layout A «Planungsfokus» – Karte als Startbildschirm, Projektleiste mit Kennzahlen, unteres Dock, Ansichtswechsel ohne Datenverlust, Kosten identisch */
const { chromium, ok, mk, getS, AXE, tmp } = require('./lib/k.js');
const waitLy = async (pg, ms) => { for (let t = 0; t < (ms || 15000); t += 250) { if (await pg.locator('dialog.kmlya[open]').count()) return true; await pg.waitForTimeout(250); } return false; };   /* <dialog> zählt für waitForSelector nicht immer als sichtbar */
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.evaluate(() => { window.__LVD.loadDemo(); }); await pg.waitForTimeout(1200);
  const ref = await pg.evaluate(() => ({ n: window.__OUT.sum.netto, b: window.__OUT.sum.brutto, nOff: window.__OUT.nOffen }));
  const S0 = JSON.stringify((await getS(pg)).recs);
  ok(await pg.locator('dialog.kmlya[open]').count() === 0, 'Testhilfe: klassische Seite bleibt Standard für die übrigen Tests');
  // Start in Layout A
  await pg.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await pg.reload();
  ok(await waitLy(pg), 'App startet in der Karte (Layout A)'); await pg.waitForTimeout(1500);
  const fl = await pg.evaluate(() => (1000).toLocaleString('de-CH').charAt(1)), f0 = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, fl);   /* Tausendertrennung wie im Browser */
  const kpi = await pg.textContent('#lyKpi');
  ok(kpi.includes('CHF ' + f0(ref.n)) && kpi.includes('CHF ' + f0(ref.b)), 'Projektleiste: Kosten exkl./inkl. MWST identisch mit Ergebnis (' + f0(ref.n) + ' / ' + f0(ref.b) + ')');
  ok(/Länge\s*[\d'.]+ m/.test(kpi) && /Aushub\s*[\d'.]+ m³/.test(kpi) && /Schächte\s*5/.test(kpi), 'Kennzahlen Länge, Aushub, Schächte: ' + kpi.replace(/\s+/g, ' ').slice(0, 90));
  ok((await pg.textContent('#lyProj')).includes('Dorfstrasse') && (await pg.textContent('#lyOrt')) === 'Musterdorf', 'Projekt und Gemeinde aus den Projektangaben');
  ok((await pg.textContent('#lySt')).length > 2, 'Status sichtbar: ' + await pg.textContent('#lySt'));
  ok(await pg.locator('.kmtools .kmtg').count() >= 3 && await pg.locator('.kmside').isVisible(), 'Werkzeuge links in Gruppen, Eigenschaften rechts');
  ok(await pg.locator('[role=tab][data-dt]').count() === 5, 'Unten 5 Reiter: Höhenprofil, Ausmass, Kosten, Positionen, Hinweise');
  ok(await pg.locator('#lySel option[disabled]').count() === 3, 'Layout-Umschalter: B–D vorbereitet (deaktiviert)');
  // Dock-Inhalte
  await pg.click('#lyT_kost'); await pg.waitForTimeout(200); if (await pg.locator('#lyP_kost').isHidden()) { await pg.click('#lyT_kost'); await pg.waitForTimeout(200); }
  ok(/Total inkl\. MWST/.test(await pg.textContent('#lyP_kost')) && /Nicht im Total/.test(await pg.textContent('#lyP_kost')), 'Reiter Kosten: Kostentabelle mit Hinweis auf offene Positionen');
  await pg.click('#lyT_pos'); await pg.waitForTimeout(200);
  ok(await pg.locator('#lyP_pos tbody tr').count() > 10, 'Reiter Positionen: Tabelle (' + await pg.locator('#lyP_pos tbody tr').count() + ' Zeilen)');
  await pg.click('#lyT_aus'); await pg.waitForTimeout(200); ok(/m³/.test(await pg.textContent('#lyP_aus')), 'Reiter Ausmass: Mengen');
  await pg.click('#lyT_warn'); await pg.waitForTimeout(200); ok(await pg.locator('#lyP_warn li').count() > 0, 'Reiter Hinweise: Liste');
  await pg.click('#lyT_prof'); await pg.waitForTimeout(400); ok(await pg.locator('#lyP_prof #kmProf').isVisible(), 'Reiter Höhenprofil zeigt das Profil im Dock');
  await pg.click('#lyT_prof'); await pg.waitForTimeout(200); ok(await pg.locator('.lydpan:visible').count() === 0, 'Reiter erneut klicken klappt das Dock ein');
  await pg.click('#lyT_kost'); await pg.waitForTimeout(200);
  // Barrierefreiheit
  await pg.addScriptTag({ path: AXE });
  const ax = await pg.evaluate(() => axe.run(document.querySelector('dialog.kmlya'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ' ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(';'))));
  ok(ax.length === 0, 'axe Layout A: ' + JSON.stringify(ax));
  const ov = await pg.evaluate(() => document.querySelector('dialog.kmlya').scrollWidth <= innerWidth + 1); ok(ov, 'kein seitlicher Überlauf');
  await pg.screenshot({ path: tmp('t65_layoutA.png') });
  // Wechsel ohne Änderungen: direkt zur klassischen Seite
  await pg.click('[data-ly=res]'); await pg.waitForTimeout(500);
  ok(await pg.locator('dialog.kmlya[open]').count() === 0 && JSON.stringify((await getS(pg)).recs) === S0, 'Wechsel zu «Ergebnis» ohne Änderung: nichts übernommen, Datensätze unverändert');
  // Zurück zur Karte
  await pg.click('#bLyMap'); ok(await waitLy(pg), 'Knopf «Karte (Planungsfokus)» führt zurück'); await pg.waitForTimeout(1500);
  // Änderung → Wechsel fragt nach
  await pg.click('[data-k=mpt]'); const mb = await pg.locator('#kmMap').boundingBox(); await pg.mouse.click(mb.x + mb.width * 0.3, mb.y + mb.height * 0.8); await pg.waitForTimeout(400);
  await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(200);
  await pg.click('[data-ly=proj]'); await pg.waitForTimeout(300);
  ok(await pg.locator('#lyAsk:visible').count() === 1 && await pg.locator('dialog.kmlya[open]').count() === 1, 'nicht übernommene Änderung: Rückfrage statt stillem Verwerfen');
  await pg.click('[data-lya=no]'); await pg.waitForTimeout(200); ok(await pg.locator('#lyAsk:visible').count() === 0 && await pg.locator('dialog.kmlya[open]').count() === 1, '«Abbrechen» bleibt in der Karte');
  await pg.waitForTimeout(800); const kp2 = await pg.evaluate(() => document.querySelector('#lySch, #lyKpi').textContent);
  ok(/Schächte\s*6/.test(kp2), 'Kennzahl Schächte folgt der Zeichnung live (6)');
  await pg.click('[data-ly=proj]'); await pg.waitForTimeout(300); await pg.click('[data-lya=save]'); await pg.waitForTimeout(500);
  const S2 = await getS(pg);
  ok(await pg.locator('dialog.kmlya[open]').count() === 0 && S2.karte.pts.length === 6 && JSON.stringify(S2.recs) === S0, '«Nur Zeichnung sichern»: Zeichnung gespeichert, Datensätze unverändert');
  // Übernehmen bleibt im Layout A, Ergebnis = Projektleiste
  await pg.click('#bLyMap'); await waitLy(pg); await pg.waitForTimeout(1800);
  const kpi3 = await pg.textContent('#lyKpi');
  await pg.click('.kmheadb [data-k=apply]'); await pg.waitForTimeout(1200);
  await waitLy(pg); await pg.waitForTimeout(1500);
  const out3 = await pg.evaluate(() => ({ n: window.__OUT.sum.netto, b: window.__OUT.sum.brutto }));
  ok(kpi3.includes('CHF ' + f0(out3.n)) && kpi3.includes('CHF ' + f0(out3.b)), 'nach «Übernehmen»: Ergebnis = Vorschau in der Projektleiste (' + f0(out3.n) + ')');
  ok(await pg.locator('dialog.kmlya[open]').count() === 1, 'nach «Übernehmen» bleibt die Karte Startbildschirm');
  // Klassische Ansicht wählen
  await pg.selectOption('#lySel', 'classic'); await pg.waitForTimeout(500);
  ok(await pg.locator('dialog.kmlya[open]').count() === 0 && await pg.evaluate(() => localStorage.getItem('lvd-layout')) === 'classic', 'Layout-Umschalter «Klassische Ansicht» merkt die Wahl');
  await pg.reload(); await pg.waitForTimeout(2500); ok(await pg.locator('dialog.kmlya[open]').count() === 0, 'klassische Ansicht bleibt nach Neuladen');
  // Handy: klassische Seite, kein Überlauf
  const ph = await mk(b, 390, 844); await ph.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await ph.reload(); await ph.waitForTimeout(2500);
  ok(await ph.locator('dialog.kmlya[open]').count() === 0 && await ph.evaluate(() => document.documentElement.scrollWidth <= 391), 'Handy (390 px): klassische Seite, kein Überlauf');
  ok(pg.errs.length === 0 && ph.errs.length === 0, 'keine JS-Fehler ' + pg.errs.concat(ph.errs).join('|')); await b.close();
})();
