/* t94: Karte im Datensatz oben – die Vorschau des gewählten Datensatzes (mit «Karte öffnen») steht direkt unter der Datensatz-Navigation, vor Liste, Pflichtangaben und Feldern;
   «Karte öffnen» wählt das Objekt in der Karte; Datensatz ohne Objekt zeigt nur den Knopf; alle Reiter mit Karte (Graben, Schacht, Werkloch, Gebäude, Belag) */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  const pos = () => pg.evaluate(() => { const f = document.querySelector('#form'), top = document.querySelector('#form .kmtop'); if (!top) return null; const q = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : 1e9; }; return { top: top.getBoundingClientRect().top, nav: q('#form .recnav'), list: q('#form .reclist, #form .rlist, #form [data-recgo]'), name: q('#form #f_graben_name, #form input[id$=_name]'), prev: !!top.querySelector('.kmprev'), btn: !!top.querySelector('#kmOpen'), n: document.querySelectorAll('#form .kmfield, #form .kmtop').length }; });
  for (const t of ['graben', 'schacht']) { await pg.evaluate(t => { const b = [...document.querySelectorAll('#tabs [role=tab]')].find(x => (x.dataset.tab || x.id || '').includes(t)); b && b.click(); }, t); await pg.waitForTimeout(500);
    const p = await pos(); ok(p && p.btn && p.prev && p.n === 1, t + ': Karten-Block mit Vorschau und Knopf, genau einmal');
    ok(p.top > p.nav && p.top < p.name && p.top < p.list, t + ': steht direkt unter der Navigation, vor Liste und Feldern (y ' + Math.round(p.top) + ' < ' + Math.round(Math.min(p.name, p.list)) + ')'); }
  // Karte öffnen wählt das Objekt
  await pg.evaluate(() => { const b = [...document.querySelectorAll('#tabs [role=tab]')].find(x => (x.dataset.tab || x.id || '').includes('graben')); b && b.click(); }); await pg.waitForTimeout(500);
  await pg.click('#form .kmtop #kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1800);
  const sel = await pg.evaluate(() => { const r = document.querySelector('.kmrow.on'); return r && r.getAttribute('data-rid'); }); const lid = await pg.evaluate(() => window.__KM.M().lines.find(l => l.rid === window.__LVD.S().recs.graben[window.__LVD.S().idx.graben || 0].uid).id);
  ok(sel === lid, 'Karte öffnen wählt die Linie des Datensatzes (' + sel + ' = ' + lid + ')');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
