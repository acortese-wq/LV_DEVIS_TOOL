/* t102: Preisvorschlag für alle offenen Positionen (auch ohne Tiefenklasse und freie Positionen ohne Preis) mit Sicherheit hoch/mittel/niedrig; freie Position: Preis und Grund (Schätzung) ins Feld, danach nicht mehr offen und kein Hinweis */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); const S = window.__LVD.S(), sn = window.__LVD.snap(); const r = S.recs.graben[0]; r.free = (r.free || []).concat([{ custom: true, text: 'Aushub von Hand im Fels, Zuschlag', unit: 'm³', qty: '12', ep: '', reason: '' }]); window.__LVD.commit(sn, 'x'); localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(900);
  await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(2000);
  await pg.click('#lyT_offen'); await pg.waitForTimeout(500);
  const rows = await pg.evaluate(() => [...document.querySelectorAll('#lyP_offen tr[data-ofd]')].map(r => ({ t: r.textContent.slice(0, 90), vor: !!r.querySelector('[data-ofvor]'), btn: (r.querySelector('[data-ofvor]') || {}).textContent || '' })));
  const nV = rows.filter(r => r.vor).length; ok(rows.length >= 2 && nV >= rows.length - 2, 'jede offene Position hat einen Vorschlag, ausser Kernbohrungen in cm (im LV keine Position dieser Einheit) (' + nV + ' von ' + rows.length + ')');
  ok(rows.every(r => !r.vor || /Sicherheit (hoch|mittel|niedrig)/.test(r.btn)), 'jeder Vorschlag nennt die Sicherheit (' + [...new Set(rows.filter(r => r.vor).map(r => (r.btn.match(/Sicherheit \w+/) || [''])[0]))].join(', ') + ')');
  const fi = rows.findIndex(r => /Fels/.test(r.t)); ok(fi >= 0, 'freie Position ohne Preis steht in der Tabelle');
  ok(fi >= 0 && rows[fi].vor, 'freie Position bekommt einen Vorschlag (' + (rows[fi] && rows[fi].btn.trim()) + ')');
  const n0 = rows.length; await pg.click('#lyP_offen tr[data-ofd="' + fi + '"] [data-ofvor]'); await pg.waitForTimeout(300); await pg.click('#lyP_offen [data-ofdsave]'); await pg.waitForTimeout(1500);
  const fr = await pg.evaluate(() => { const f = window.__LVD.S().recs.graben[0].free.find(x => /Fels/.test(x.text)); return f ? { ep: f.ep, reason: f.reason } : null; });
  ok(fr && +fr.ep > 0 && /^Schätzung/.test(fr.reason), 'Preis und Grund «Schätzung …» stehen in der freien Position (' + (fr && fr.ep) + ' CHF)');
  const after = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('#lyP_offen tr[data-ofd]')].map(r => r.textContent), hint: (document.querySelector('#lyP_warn') || {}).textContent || '' }));
  ok(after.rows.length === n0 - 1 && !after.rows.some(t => /Fels/.test(t)), 'danach nicht mehr offen (' + n0 + ' → ' + after.rows.length + ')');
  ok(!/Fels/.test(after.hint) || !/ausserhalb LV|ausserhalb/i.test(after.hint), 'kein Hinweis «freie Position ausserhalb LV» zur übernommenen Schätzung');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
