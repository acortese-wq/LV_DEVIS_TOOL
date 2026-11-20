/* t131: Bericht – Kostenübersicht mit Kreisdiagrammen (V143): nach Arbeitsgattung und nach Bauteil, Top 6 + «Übrige», Tabelle mit CHF und Anteil,
   Basis = Zwischensumme Bauarbeiten (vor Rabatt/MWST, ohne Honorar); Abschnitt direkt nach den Projektangaben, im Berichtsdialog abwählbar. */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1280, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); window.print = () => { window.__printed = 1; }; }); await pg.waitForTimeout(1200);
  const open = async () => { await pg.evaluate(() => { const b0 = document.querySelector('[data-ly=rep], #rpOpen'); if (b0) b0.click(); else window.__LVD.report && window.__LVD.report(); }); await pg.waitForTimeout(500); };
  await pg.click('#sExp').catch(() => { }); await pg.click('#bReport').catch(() => { }); await pg.waitForTimeout(600);
  if (!(await pg.locator('#reportDlg[open]').count())) await open();
  ok(await pg.locator('#reportDlg input[data-rp=dia]').isChecked(), 'Berichtsdialog: «Kostenübersicht (Kreisdiagramme)» vorgewählt');
  await pg.click('#rpGo'); await pg.waitForTimeout(1500);
  const R = await pg.evaluate(() => { const d = document.querySelector('#reportDoc'); if (!d) return null; const sec = d.querySelector('.rp-kdia'), secs = [...d.querySelectorAll('section')].map(s => s.className);
    const tabs = [...sec.querySelectorAll('.rp-diat')].map(t => [...t.querySelectorAll('tbody tr')].map(tr => ({ k: tr.cells[0].textContent.trim(), v: +tr.cells[1].textContent.replace(/[^\d.]/g, ''), p: parseFloat(tr.cells[2].textContent) })));
    const S = window.__LVD.S(), z = KVE.calc(S, LV).sum.zwischen;
    return { n: sec.querySelectorAll('svg.rp-pie').length, paths: [...sec.querySelectorAll('svg.rp-pie')].map(s => s.querySelectorAll('path,circle').length), tabs, lead: sec.querySelector('.rp-dia-lead').textContent, basis: sec.querySelector('.rp-dia-b').textContent, z, idx: secs.indexOf(sec.className), secs }; });
  ok(R && R.n === 2, 'zwei Kreisdiagramme (Arbeitsgattung, Bauteil)');
  ok(R.tabs.every(t => t.length >= 2 && t.length <= 7) && R.paths.every((n, i) => n === R.tabs[i].length), 'höchstens 7 Segmente (Top 6 + Übrige), je Segment eine Tabellenzeile (' + R.tabs.map(t => t.length).join('/') + ')');
  const sum = t => t.reduce((a, x) => a + x.v, 0), pct = t => t.reduce((a, x) => a + x.p, 0);
  ok(R.tabs.every(t => Math.abs(sum(t) - R.z) < 0.05) && R.tabs.every(t => Math.abs(pct(t) - 100) < 0.6), 'beide Diagramme ergeben die Zwischensumme Bauarbeiten ' + R.z + ' und 100 %');
  ok(R.tabs.every(t => t.every((x, i) => i === 0 || x.k === 'Übrige' || x.v <= t[i - 1].v)), 'nach Grösse sortiert (Kostentreiber zuerst)');
  ok(new RegExp('Grösster Kostentreiber: ' + R.tabs[0][0].k.replace(/[()]/g, '.')).test(R.lead), 'Kernaussage: ' + R.lead);
  ok(/vor Rabatt und MWST, ohne Ingenieurhonorar/.test(R.basis), 'Basis genannt');
  ok(R.idx >= 0 && R.idx <= 1, 'Abschnitt direkt nach den Projektangaben (vor Situation): ' + R.secs.slice(0, 3).join(' | '));
  // abwählbar
  await pg.click('#sExp').catch(() => { }); await pg.click('#bReport').catch(() => { }); await pg.waitForTimeout(500); if (!(await pg.locator('#reportDlg[open]').count())) await open();
  await pg.uncheck('#reportDlg input[data-rp=dia]'); await pg.click('#rpGo'); await pg.waitForTimeout(1200);
  ok((await pg.locator('#reportDoc .rp-kdia').count()) === 0, 'ohne Häkchen kein Diagramm-Abschnitt');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  await b.close();
})();
