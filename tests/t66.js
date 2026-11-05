/* t66: Projektbericht – Situationskarte auf eigener Querseite, nur Nummern auf der Karte, Tabelle mit Beschreibung, Hintergrund abgeschwächt */
const { chromium, ok, mk, tmp } = require('./lib/k.js');
const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1400, 1000);
  await pg.evaluate(() => { window.print = () => { window.__p = (window.__p || 0) + 1; }; window.__LVD.loadDemo(); }); await pg.waitForTimeout(1500);
  await pg.click('#bReport'); await pg.waitForTimeout(800); await pg.click('#rpGo'); await pg.waitForTimeout(1500);
  for (let t = 0; t < 30 && !(await pg.evaluate(() => window.__p)); t++) await pg.waitForTimeout(250);
  ok(await pg.evaluate(() => window.__p) === 1, 'Druck startet (nach dem Laden des Kartenhintergrunds)');
  const r = await pg.evaluate(() => { const d = document.querySelector('#reportDoc'), f = d.querySelector('.rp-map .rpmapfig svg'), K = window.__LVD.S().karte;
    return { fig: !!f, txt: f ? [...f.querySelectorAll('text')].map(t => t.textContent) : [], rows: d.querySelectorAll('.rp-maptab tbody tr').length, n: K.lines.length + K.pts.length, pale: !!(f && f.querySelector('rect[fill-opacity]')), wl: K.wl.length, desc: (d.querySelector('.rp-maptab') || {}).textContent || '' }; });
  ok(r.fig, 'Situationskarte im Bericht');
  ok(r.txt.every(t => /^(L\d+|\d+)$/.test(t)), 'auf der Karte nur Nummern: ' + r.txt.join(' '));
  ok(r.rows === r.n && /Dorfstrasse West · 150\.1 m/.test(r.desc), 'Tabelle: eine Zeile je Leitung/Schacht mit Beschreibung (' + r.rows + ')');
  ok(r.wl > 0 && !r.txt.some(t => /^W\d/.test(t)), 'Werkleitungen/Gebäude nicht auf der Berichtskarte');
  ok(r.pale, 'Hintergrund abgeschwächt');
  await pg.emulateMedia({ media: 'print' }); const f = tmp('t66.pdf'); await pg.pdf({ path: f, preferCSSPageSize: true });
  const info = execSync('pdfinfo -f 1 -l 3 ' + f).toString(), sz = [...info.matchAll(/Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+)/g)].map(m => +m[2] > +m[3] ? 'quer' : 'hoch');
  ok(sz[0] === 'hoch' && sz[1] === 'quer', 'Seite 1 hoch, Situationskarte auf A4 quer (' + sz.join(', ') + ')');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
