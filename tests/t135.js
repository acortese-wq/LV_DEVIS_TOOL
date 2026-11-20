/* t135: UX-Runde 11/2026 P2 – fehlende Pflichtangaben als eigene Kategorie, leeres Projekt nie grün/«Bereit»
   - klassisch: leeres Projekt → Status neutral «Noch keine Positionen» (nicht grün) + «1 Pflichtangabe fehlt», Klick springt zum Feld
   - mit Positionen, aber fehlender Pflichtangabe → «Hinweise beachten» statt «Keine Warnungen»; vollständig → grün
   - Layout A: Kopfstatus «Leer» / «Unvollständig (n)» / «Bereit»; Hinweise-Reiter nennt die Pflichtangabe, Klick führt zum Feld */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(), pg = await mk(b, 1440, 900); await pg.waitForTimeout(800);
  const box = () => pg.evaluate(() => { const s = document.querySelector('#result .status'); return { cls: s.className, t: s.querySelector('.stitle').textContent, rq: (s.querySelector('.reqsum-t') || {}).textContent || '', li: [...s.querySelectorAll('.reqsum-l li')].map(l => l.textContent) }; });
  let r = await box();
  ok(/\bempty\b/.test(r.cls) && !/\bok\b/.test(r.cls) && r.t === 'Noch keine Positionen', 'leeres Projekt: neutraler Status «' + r.t + '» (nicht grün)');
  ok(r.rq === '1 Pflichtangabe fehlt' && /Graben · Leitungsgraben 1: Länge Graben/.test(r.li[0]), 'eigene Kategorie: ' + r.rq + ' – ' + r.li[0]);
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector('#result .status')).backgroundColor) !== 'rgb(230, 244, 237)', 'kein grüner Hintergrund');
  await pg.click('#result .reqsum-l a[data-gof]'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => document.activeElement && document.activeElement.id) === 'f_graben_L', 'Klick springt zum Feld «Länge Graben»');
  // Positionen, alles vollständig
  await pg.fill('#f_graben_L', '20'); await pg.waitForTimeout(900);
  r = await box();
  ok(!/\bempty\b/.test(r.cls) && r.rq === '', 'mit Länge: keine fehlenden Pflichtangaben (' + r.t + ')');
  const okSt = r;
  // zweiter Datensatz ohne Bezeichnung, mit Länge → fehlt «Bezeichnung», auch wenn sonst keine Warnung
  await pg.evaluate(() => { const S = window.__LVD.S(); const g = JSON.parse(JSON.stringify(S.recs.graben[0])); g.uid = 'gX'; g.name = ''; g.L = '5'; S.recs.graben.push(g); localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify(S)); window.__LVD.renderResult(); }); await pg.waitForTimeout(400);
  r = await box();
  ok(/amber|stop/.test(r.cls) && r.t !== 'Keine Warnungen' && r.rq === '1 Pflichtangabe fehlt' && /Bezeichnung/.test(r.li[0]), 'fehlende Bezeichnung: «' + r.t + '» + ' + r.rq + ' (' + r.li[0] + ')');
  ok(okSt.t !== r.t || /amber|stop/.test(okSt.cls), 'Status wechselt bei fehlender Pflichtangabe');
  // Layout A
  const pa = await b.newPage({ viewport: { width: 1440, height: 900 } }); pa.errs = []; pa.on('pageerror', e => pa.errs.push(e.message));
  await pa.addInitScript(() => { localStorage.setItem('lvd-layout', 'a'); });
  await pa.route('**/*', q => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(q.request().url()) ? q.fulfill({ status: 204 }) : q.fallback());
  await pa.goto(process.env.LVD_URL || K.INDEX); await pa.waitForTimeout(2500);
  const st = () => pa.evaluate(() => { const e = document.querySelector('#lySt'); return { t: e.textContent, c: e.className }; });
  let s = await st(); ok(s.t === 'Leer' && /lyst-empty/.test(s.c), 'Layout A leer: Status «' + s.t + '» (nicht «Bereit»)');
  // Projekt mit Positionen + fehlender Bezeichnung (Zustand aus der klassischen Seite)
  const S0 = await pg.evaluate(() => JSON.stringify(window.__LVD.S())); await pa.close();
  const pb = await b.newPage({ viewport: { width: 1440, height: 900 } }); pb.errs = []; pb.on('pageerror', e => pb.errs.push(e.message));
  await pb.addInitScript(s0 => { localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lv-devis-tiefbau-v2', s0); }, S0);
  await pb.route('**/*', q => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(q.request().url()) ? q.fulfill({ status: 204 }) : q.fallback());
  await pb.goto(process.env.LVD_URL || K.INDEX); await pb.waitForTimeout(2500);
  s = await pb.evaluate(() => { const e = document.querySelector('#lySt'); return { t: e.textContent, c: e.className, w: (document.querySelector('[data-lywarn]') || {}).textContent || '' }; });
  ok(/^Unvollständig \(\d+\)$/.test(s.t) && /lyst-stop/.test(s.c), 'Layout A: Status «' + s.t + '», Kennzahl «' + s.w.trim() + '»');
  await pb.evaluate(() => { document.querySelector('#lyT_warn').click(); }); await pb.waitForTimeout(400);
  const wtxt = await pb.evaluate(() => (document.querySelector('#lyP_warn .lyreq') || {}).textContent || '');
  ok(/1 Pflichtangabe fehlt/.test(wtxt) && /Bezeichnung/.test(wtxt), 'Hinweise-Reiter: ' + wtxt.slice(0, 80));
  await pb.click('#lyP_warn [data-lygof]'); await pb.waitForTimeout(1500);
  const fo = await pb.evaluate(() => ({ id: document.activeElement && document.activeElement.id, open: !!document.querySelector('dialog.kmdlg[open]') }));
  ok(fo.id === 'f_graben_name' && !fo.open, 'Klick führt zum Feld «Bezeichnung» (' + fo.id + ')');
  ok(pg.errs.length + pb.errs.length === 0, 'keine JS-Fehler ' + pg.errs.concat(pb.errs).join('|'));
  await b.close();
})();
