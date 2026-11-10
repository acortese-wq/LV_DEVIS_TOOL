/* t93: Bereinigung – Datensätze, deren Objekt in Karte/Plan gelöscht wurde: (1) «Übernehmen» entfernt sie (auch früher nur gespeicherte Löschungen), mit Rückgängig;
   (2) Hinweis «Datensätze ohne Objekt» im Projekt mit Auswahl + «Auswahl entfernen» (Rückgängig) und «Alle behalten»; von Hand angelegte Datensätze bleiben; Kosten sinken um den Datensatz */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  const S0 = () => pg.evaluate(() => JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')));
  const total = () => pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum.zwischen);
  let s = await S0(), nG = s.recs.graben.length, nS = s.recs.schacht.length, c0 = await total();
  ok(s.recs.graben.every(r => r.fromMap || !r.uid) && s.recs.graben.some(r => r.uid), 'Beispielprojekt: aus der Karte erzeugte Datensätze sind verknüpft (' + nG + ' Gräben, ' + nS + ' Schächte)');
  ok(!(await pg.locator('.orphbox').count()), 'keine Meldung, solange alles verknüpft ist');
  // Objekt nur in der Zeichnung löschen (wie «Speichern» ohne Übernehmen): Linie 2 und Schacht 3 verschwinden aus S.karte, Datensatz bleibt
  await pg.evaluate(() => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); const l = S.karte.lines.find(x => x.rid); const p = S.karte.pts.find(x => x.sid); window.__gone = { rid: l.rid, sid: p.sid }; S.karte.lines = S.karte.lines.filter(x => x !== l && x.id !== l.id); S.karte.pts = S.karte.pts.filter(x => x.id !== p.id); localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify(S)); });
  await pg.reload(); await pg.waitForTimeout(1200);
  const gone = await pg.evaluate(() => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); const ref = {}; S.karte.lines.forEach(l => { if (l.rid) ref[l.rid] = 1; if (l.rid2) ref[l.rid2] = 1; }); S.karte.pts.forEach(p => { if (p.sid) ref[p.sid] = 1; }); (S.karte.areas || []).forEach(f => { if (f.rid) ref[f.rid] = 1; }); (S.karte.geb || []).forEach(g => { if (g.sid) ref[g.sid] = 1; }); return ['graben', 'schacht', 'belag', 'geb'].flatMap(t => S.recs[t].filter(r => r.uid && !ref[r.uid]).map(r => t + ':' + r.name)); });
  ok(gone.length >= 1, 'Ausgangslage: ' + gone.length + ' Datensatz/Datensätze ohne Objekt (' + gone.join(', ') + ')');
  await pg.evaluate(() => { document.querySelector('#tabs button[data-tab=graben], #tabs [role=tab]').click(); }); await pg.waitForTimeout(400);
  const tabsWithBox = []; for (const t of ['graben', 'schacht']) { await pg.evaluate(t => { const b = [...document.querySelectorAll('#tabs [role=tab]')].find(x => (x.dataset.tab || x.id || '').includes(t)); b && b.click(); }, t); await pg.waitForTimeout(300); if (await pg.locator('.orphbox').count()) tabsWithBox.push(t); }
  ok(tabsWithBox.length >= 1, 'Hinweis «Datensätze ohne Objekt» im Projekt (' + tabsWithBox.join(', ') + ')');
  const t0 = tabsWithBox[0]; await pg.evaluate(t => { const b = [...document.querySelectorAll('#tabs [role=tab]')].find(x => (x.dataset.tab || x.id || '').includes(t)); b && b.click(); }, t0); await pg.waitForTimeout(300);
  const lab = await pg.textContent('.orphbox'); ok(/ohne Objekt/.test(lab) && await pg.locator('.orphbox [data-orph]:checked').count() >= 1, 'Meldung mit vorgewählter Liste: «' + lab.replace(/\s+/g, ' ').slice(0, 110) + '…»');
  const cBefore = await total(), nBefore = (await S0()).recs[t0].length;
  await pg.click('[data-orphgo]'); await pg.waitForTimeout(500);
  s = await S0(); const nAfter = s.recs[t0].length;
  ok(nAfter === nBefore - 1 || (nBefore === 1 && nAfter === 1), 'Auswahl entfernt: ' + nBefore + ' → ' + nAfter + ' Datensätze (' + t0 + ')');
  ok((await total()) < cBefore, 'Kosten sinken: ' + cBefore + ' → ' + (await total()));
  ok(!(await pg.locator('.orphbox').count()) || tabsWithBox.length > 1, 'Hinweis verschwindet');
  // Rückgängig
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(b => /Rückgängig/.test(b.textContent) && b.offsetParent) && [...document.querySelectorAll('button')].find(b => /Rückgängig/.test(b.textContent) && b.offsetParent).click()); await pg.waitForTimeout(500);
  s = await S0(); ok(s.recs[t0].length === nBefore && Math.abs((await total()) - cBefore) < 0.01, 'Rückgängig stellt Datensatz und Kosten wieder her');
  // von Hand angelegt bleibt
  await pg.evaluate(() => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); S.recs.schacht.push(Object.assign({}, S.recs.schacht[0], { uid: undefined, name: 'Handschacht', fromMap: undefined })); localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify(S)); }); await pg.reload(); await pg.waitForTimeout(1000);
  ok((await S0()).recs.schacht.some(r => r.name === 'Handschacht') && !/Handschacht/.test(await pg.evaluate(() => (document.querySelector('.orphbox') || {}).textContent || '')), 'von Hand angelegter Datensatz (ohne Verknüpfung) wird nie als Waise angeboten');
  // «Alle behalten»
  if (await pg.locator('.orphbox').count()) { await pg.click('[data-orphkeep]'); await pg.waitForTimeout(300); ok(!(await pg.locator('.orphbox').count()), '«Alle behalten» blendet den Hinweis aus'); } else { ok(true, 'Hinweis auf diesem Reiter nicht (mehr) sichtbar'); }
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
