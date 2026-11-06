/* t66: Projektbericht – Situationskarte auf eigener Seite A4 hoch (unverzerrt), nur Nummern auf der Karte, Tabelle mit Beschreibung, Hintergrund abgeschwächt */
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
  await pg.emulateMedia({ media: 'print' });
  const ar = await pg.evaluate(() => { const v = document.querySelector('#reportDoc .rpmapfig svg'), r = v.getBoundingClientRect(), vb = v.viewBox.baseVal; return [r.width / r.height, vb.width / vb.height]; });
  const f = tmp('t66.pdf'); await pg.pdf({ path: f, preferCSSPageSize: true });
  const info = execSync('pdfinfo -f 1 -l 3 ' + f).toString(), sz = [...info.matchAll(/Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+)/g)].map(m => +m[2] > +m[3] ? 'quer' : 'hoch');
  ok(sz.length >= 2 && sz.every(x => x === 'hoch'), 'alle Seiten A4 hoch, auch die Situationskarte (' + sz.join(', ') + ')');
  ok(Math.abs(ar[0] - ar[1]) < 0.01 && ar[1] < 1, 'Karte im Druck unverzerrt, Hochformat (' + ar.map(x => x.toFixed(3)).join(' = ') + ')');
  execSync('pdftoppm -f 2 -l 2 -r 40 -png ' + f + ' ' + tmp('t66_p2'));
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
