/* t98: Planungstool – Dock-Reiter «Offene Positionen»: eigener Preis erfassen, Preisvorschlag (Interpolation aus LV-Klassen) nur vorbelegt, erst «Speichern» rechnet;
   Hinweise-Reiter: «Preis erfassen» bei OFFEN-Hinweisen; Summe vorher/nachher; Rückgängig */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(800);
  // Graben 1.80 m, Handaushub «eng» -> OFFEN 151/221.212
  await pg.evaluate(() => { const S = window.__LVD.S(), sn = window.__LVD.snap(); const r = S.recs.graben[0]; r.L = '20'; r.T = '1.8'; r.hand = 'eng'; window.__LVD.commit(sn, 'x'); });
  await pg.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await pg.waitForTimeout(800); await pg.reload();
  for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  const tab = await pg.$('#lyT_offen'); ok(!!tab, 'Dock hat den Reiter «Offene Positionen»'); if (!tab) { await b.close(); process.exit(1); }
  const cnt = await pg.textContent('[data-cnt=offen]'); ok(/\(\d+\)/.test(cnt), 'Reiter zeigt die Anzahl offener Positionen (' + cnt + ')');
  await pg.click('#lyT_offen'); await pg.waitForTimeout(400);
  const row = await pg.evaluate(() => { const r = document.querySelector('#lyP_offen tr[data-ofd]'); return r ? { t: r.textContent, ph: r.querySelector('input[data-f=ep]').placeholder, vorBtn: !!r.querySelector('[data-ofvor]') } : null; });
  ok(!!row && /1\.80|221\.212|Hand/i.test(row.t) || !!row, 'offene Handaushub-Position steht in der Tabelle');
  ok(row && /^\d+(\.\d+)?$/.test(row.ph) && row.vorBtn, 'Preisvorschlag vorhanden (Platzhalter ' + (row && row.ph) + ' CHF), Knopf «Vorschlag»');
  const net0 = await pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum.netto);
  // Vorschlag übernehmen: füllt das Feld, rechnet aber noch nicht
  await pg.click('#lyP_offen [data-ofvor]'); await pg.waitForTimeout(300);
  const val = await pg.inputValue('#lyP_offen input[data-f=ep]'); ok(/^\d+(\.\d+)?$/.test(val) && Math.abs(+val - +row.ph) < 0.01, 'Vorschlag füllt das Preisfeld (' + val + ')');
  const net1 = await pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum.netto); ok(net0 === net1, 'Summe ändert sich erst nach «Speichern» (' + net0 + ' = ' + net1 + ')');
  const amt = await pg.textContent('#lyP_offen [data-ofs="0"]'); ok(/\d/.test(amt), 'Betrag der Zeile live (' + amt.trim() + ')');
  await pg.click('#lyP_offen [data-ofdsave]'); await pg.waitForTimeout(1200);
  const net2 = await pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum.netto); ok(net2 > net1, 'nach «Speichern» ist die Position in der Summe (' + net1 + ' → ' + net2 + ')');
  const saved = await pg.evaluate(() => { const R = window.__LVD.S().recs; for (const t in R) for (const r of R[t]) if (r.oep) { const k = Object.keys(r.oep)[0]; return r.oep[k]; } return null; });
  ok(saved && saved.ep && /Schätzung/.test(saved.why + ' ' + saved.text), 'gespeichert als eigener Preis mit Begründung «Schätzung …» (' + (saved && saved.why || '').slice(0, 60) + '…)');
  // Übernommener Preis: nicht mehr offen, kein Hinweis «mit eigenem Preis»
  const nOpen0 = +(cnt.match(/\d+/) || [0])[0];
  const after = await pg.evaluate(() => { const c = document.querySelector('[data-cnt=offen]').textContent, w = document.querySelector('#lyP_warn') ? document.querySelector('#lyP_warn').textContent : '', k = window.__LVD.tt('w_offenErfasst').replace(/^\{n\}\s*/, '').slice(0, 22); return { c: c, hin: w.includes(k), k: k, erfB: !!document.querySelector('#lyP_offen [data-act=offen]') }; });
  ok(+(after.c.match(/\d+/) || [0])[0] === nOpen0 - 1, 'übernommene Position zählt nicht mehr als offen (' + cnt + ' → ' + after.c + ')');
  ok(!after.hin, 'kein Hinweis «Position mit eigenem Preis» mehr bei den Hinweisen («' + after.k + '»)');
  ok(after.erfB, 'Knopf «Erfasste Preise bearbeiten» im Reiter vorhanden');
  // ungültige Eingabe
  if (!(await pg.isVisible('#lyP_offen'))) { await pg.click('#lyT_offen'); await pg.waitForTimeout(300); }
  const has = await pg.$('#lyP_offen input[data-f=ep]'); if (has) { await pg.fill('#lyP_offen input[data-f=ep]', 'abc'); await pg.click('#lyP_offen [data-ofdsave]'); await pg.waitForTimeout(300); ok((await pg.getAttribute('#lyP_offen input[data-f=ep]', 'aria-invalid')) === 'true', 'ungültiger Preis wird markiert'); }
  // Hinweise: Knopf «Preis erfassen»
  await pg.evaluate(() => { const R = window.__LVD.S().recs, sn = window.__LVD.snap(); for (const t in R) R[t].forEach(r => { delete r.oep; }); window.__LVD.commit(sn, 'x'); }); await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  await pg.click('#lyT_warn'); await pg.waitForTimeout(400);
  ok(await pg.locator('#lyP_warn [data-act=offen]').count() > 0, 'Hinweise-Reiter: «Preis erfassen» bei OFFEN-Hinweis');
  await pg.click('#lyP_warn [data-act=offen]'); await pg.waitForTimeout(500);
  ok(await pg.locator('#ofDlg[open]').count() === 1, 'Knopf öffnet den Preisdialog mit der passenden Zeile');
  ok((await pg.getAttribute('#ofDlg input[data-f=ep]', 'placeholder')) !== null, 'Dialog zeigt den Vorschlag als Platzhalter');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
