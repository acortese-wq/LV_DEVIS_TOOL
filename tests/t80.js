/* t80: Dock-Tabellen (Redesign Phase F) – Positionen: Suche, Status-/Kapitelfilter, Sortierung, Prüfstatus-Zyklus inkl. «In Prüfung»
   (gleicher Zustand wie Ergebnisseite), Kosten je Kapitel/Abschnitt/Top 10 (Summen = Referenz), Sprung Top 10 → Position, axe, keine Kostenwirkung */
const fs = require('fs'), path = require('path'), K = require('./lib/k.js'), { chromium, ok, mk, AXE } = K;
const G = JSON.parse(fs.readFileSync(path.join(K.ROOT, 'tests/fixtures/golden.json')));
const toA = async pg => { await pg.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await pg.waitForTimeout(1200); await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500); };
const num = s => +String(s).replace(/[^\d.\-]/g, '');
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(800); await toA(pg);
  const sum0 = await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum));
  await pg.click('#lyT_pos'); await pg.waitForTimeout(300);
  const rowsN = () => pg.locator('#lyPosB tr').count();
  const n0 = await rowsN(), tot = G.cases[0].out.summary.length;
  ok(n0 === tot && /62/.test(await pg.textContent('#lyT_pos')), 'Positionen im Dock: alle ' + n0 + ' Zeilen (Referenz ' + tot + ')');
  ok(new RegExp(n0 + '\\D+' + tot).test(await pg.textContent('#lyPCnt')), 'Zähler «' + (await pg.textContent('#lyPCnt')) + '»');
  // Suche
  await pg.fill('[data-dq=q]', '151/4'); await pg.waitForTimeout(200);
  const n1 = await rowsN(), k1 = await pg.$$eval('#lyPosB tr', t => t.map(r => r.getAttribute('data-dk')));
  ok(n1 > 0 && n1 < n0 && k1.every(k => k.startsWith('151/4')), 'Suche «151/4» filtert (' + n1 + ' Zeilen), Fokus bleibt im Feld: ' + await pg.evaluate(() => document.activeElement.getAttribute('data-dq')));
  await pg.fill('[data-dq=q]', ''); await pg.waitForTimeout(150);
  // Kapitelfilter
  const chs = await pg.$$eval('[data-dq=ch] option', o => o.map(x => x.value).filter(Boolean));
  ok(chs.length >= 5 && chs.includes('151/6'), 'Kapitelfilter mit ' + chs.length + ' Kapiteln');
  await pg.selectOption('[data-dq=ch]', '151/6'); await pg.waitForTimeout(150);
  const k2 = await pg.$$eval('#lyPosB tr', t => t.map(r => r.getAttribute('data-dk')));
  ok(k2.length > 0 && k2.every(k => k.startsWith('151/6')), 'Kapitel 151.600: nur ' + k2.length + ' Schacht-Positionen');
  await pg.selectOption('[data-dq=ch]', ''); await pg.waitForTimeout(150);
  // Sortierung
  await pg.click('[data-dsort=tot]'); await pg.waitForTimeout(150);
  let tots = await pg.$$eval('#lyPosB tr td:last-child', t => t.map(x => x.textContent));
  ok(tots.map(num).every((v, i, a) => !i || a[i - 1] >= v) && await pg.getAttribute('th:has([data-dsort=tot])', 'aria-sort') === 'descending', 'Sortierung nach Total absteigend (aria-sort)');
  ok(await pg.evaluate(() => document.activeElement.getAttribute('data-dsort')) === 'tot', 'Fokus bleibt auf dem Sortierknopf');
  await pg.click('[data-dsort=tot]'); await pg.waitForTimeout(150);
  tots = await pg.$$eval('#lyPosB tr td:last-child', t => t.map(x => x.textContent)); ok(tots.map(num).every((v, i, a) => !i || a[i - 1] <= v), 'zweiter Klick: aufsteigend');
  await pg.click('[data-dsort=key]'); await pg.waitForTimeout(150);
  // Prüfstatus
  const k = await pg.getAttribute('#lyPosB [data-dpst]', 'data-dpst'), sel = '#lyPosB [data-dpst="' + k + '"]';
  const st = () => pg.evaluate(k => ((window.__LVD.S().pruef || {})[k] || {}).st || '', k);
  const seq = [];
  for (let i = 0; i < 4; i++) { await pg.locator(sel).dispatchEvent('click'); await pg.waitForTimeout(150); seq.push(await st()); }
  ok(seq.join(',') === 'ip,ok,klaeren,', 'Prüfstatus-Zyklus offen → in Prüfung → geprüft → klären → offen (' + seq.join(',') + ')');
  await pg.locator(sel).dispatchEvent('click'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(k => document.querySelector('#lyPosB tr[data-dk="' + k + '"]').classList.contains('pst-ip'), k) && /1/.test(await pg.textContent('#lyPSt')), 'Zeile markiert «In Prüfung», Zusammenfassung zählt mit');
  await pg.selectOption('[data-dq=st]', 'ip'); await pg.waitForTimeout(150);
  ok(await rowsN() === 1, 'Statusfilter «In Prüfung» → 1 Zeile');
  await pg.selectOption('[data-dq=st]', 'offenpos'); await pg.waitForTimeout(150);
  const nOff = await rowsN(), gOff = G.cases[0].out.summary.filter(l => l[5] === 'offen').length;
  ok(nOff === gOff, 'Filter «Ohne Preis (OFFEN)»: ' + nOff + ' (Referenz ' + gOff + ')');
  await pg.selectOption('[data-dq=st]', ''); await pg.waitForTimeout(150);
  // Kosten-Reiter
  await pg.click('#lyT_kost'); await pg.waitForTimeout(250);
  const kx = await pg.evaluate(() => [...document.querySelectorAll('#lyP_kost .lykx')].map(s => ({ h: s.querySelector('h4').textContent, v: [...s.querySelectorAll('td.num')].map(t => t.textContent) })));
  const gs = G.cases[0].out, gz = gs.summary.filter(l => l[5] !== 'offen').reduce((a, l) => a + (l[3] || 0), 0);
  const chSum = kx[0].v.map(num).reduce((a, x) => a + x, 0);
  ok(kx.length === 3 && Math.abs(chSum - gz) < 0.05, 'Kosten je Kapitel: Summe ' + chSum.toFixed(2) + ' = Positionen ' + gz.toFixed(2));
  ok(kx[1].v.length >= 5, 'Kosten je Abschnitt: ' + kx[1].v.length + ' Zeilen');
  const top = gs.summary.filter(l => l[5] !== 'offen').map(l => l[3]).sort((a, b) => b - a).slice(0, 10);
  ok(kx[2].v.length === 10 && kx[2].v.map(num).every((v, i) => Math.abs(v - top[i]) < 0.01), 'Top 10 = Referenz');
  const gk = await pg.getAttribute('#lyP_kost [data-dgo]', 'data-dgo');
  await pg.click('#lyP_kost [data-dgo]'); await pg.waitForTimeout(300);
  ok(await pg.getAttribute('#lyT_pos', 'aria-selected') === 'true' && await pg.inputValue('[data-dq=q]') === gk && (await pg.$$eval('#lyPosB tr', t => t.map(r => r.getAttribute('data-dk')))).includes(gk), 'Top 10 → Sprung zur Position ' + gk);
  await pg.fill('[data-dq=q]', ''); await pg.waitForTimeout(150);
  // axe
  await pg.addScriptTag({ path: AXE });
  for (const t of ['pos', 'kost']) { await pg.click('#lyT_' + t); await pg.waitForTimeout(200);
    const ax = await pg.evaluate(() => axe.run(document.querySelector('.lydock'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
    ok(ax.length === 0, 'axe Dock «' + t + '»: ' + JSON.stringify(ax)); }
  ok(await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum)) === sum0, 'Filter/Sortierung/Prüfstatus ohne Kostenwirkung');
  // Ergebnisseite zeigt denselben Prüfstatus
  await pg.evaluate(() => localStorage.setItem('lvd-layout', 'classic')); await pg.reload(); await pg.waitForTimeout(1500);
  const cls = await pg.evaluate(k => { const b = document.querySelector('#result [data-pst="' + k + '"]'); return b && b.closest('tr').className; }, k);
  ok(/pst-ip/.test(cls || ''), 'Ergebnisseite: Position ' + k + ' «In Prüfung» (' + cls + ')');
  await pg.screenshot({ path: K.tmp('t80.png') });
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
