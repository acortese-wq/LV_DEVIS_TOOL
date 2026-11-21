/* t144: UX-Runde 11/2026 P10 – Rabattgrenze-Hinweis (nur Anzeige, beidseitig, neutral)
   - LV-Summe (Rabattbasis) höchstens 5 % unter einer Staffelgrenze R151/R152 → Info «knapp unter … ab dieser Grenze gilt Stufe n»
   - höchstens 5 % über einer Grenze → Info «knapp über … fällt sie unter die Grenze, gilt Stufe n−1»
   - ausserhalb: kein Hinweis
   - nur Info: zählt nicht als Warnung, ändert den Status nicht; Kosten identisch mit der Golden-Referenz
   - Kostenhinweis (Kurzform), Hinweisliste klassisch und Layout A, Französisch, axe */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX } = K;
const G = require('./fixtures/golden.json').cases;
const STUB = r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback();
async function open(b, st, layout, q) {
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.addInitScript(([s, l]) => { if (!sessionStorage.getItem('t144')) { localStorage.setItem('lv-devis-tiefbau-v2', s); localStorage.setItem('lvd-layout', l); sessionStorage.setItem('t144', '1'); } window.__LVD_START_OFF = 1; }, [JSON.stringify(st), layout]);
  await pg.route('**/*', STUB); await pg.goto((process.env.LVD_URL || INDEX) + (q || '')); await pg.waitForTimeout(2500); return pg;
}
const info = pg => pg.evaluate(() => ({
  note: (document.querySelector('#kGenau') || {}).textContent || '',
  li: [...document.querySelectorAll('#result .warns li')].filter(x => /Rabattgrenze|Seuil de rabais/.test(x.textContent)).map(x => ({ c: x.className, t: x.textContent.replace(/\s+/g, ' ').trim() })),
  amber: document.querySelectorAll('#result .warns li.amber').length, stop: document.querySelectorAll('#result .warns li.stop').length,
  kpiTag: ((document.querySelector('#kpi .tag.amber[href]') || {}).textContent || ''),
  sum: KVE.calc(window.__LVD.S(), LV).sum
}));
(async () => {
  const b = await chromium.launch(), errs = [];
  // knapp unter 30'000
  let c = G[11], pg = await open(b, c.st, 'classic'), r = await info(pg);
  ok(r.sum.rabattBasis === c.out.sum.rabattBasis && r.sum.netto === c.out.sum.netto && r.sum.brutto === c.out.sum.brutto, 'Kosten identisch mit Golden-Referenz (netto ' + r.sum.netto + ')');
  ok(/knapp unter der Rabattgrenze CHF 30.000/.test(r.note), 'Kostenhinweis: «knapp unter der Rabattgrenze CHF 30\'000»');
  ok(r.li.length === 1 && r.li[0].c === 'info' && /Die LV-Summe von CHF 29.803\.60 liegt knapp unter CHF 30.000\. Ab dieser Grenze gilt Stufe 3 \(5 % Rabatt, Installationspauschale CHF 900\) für die ganze LV-Summe\./.test(r.li[0].t), 'Hinweisliste (Info): ' + (r.li[0] || {}).t);
  const nW = parseInt(r.kpiTag, 10) || 0; ok(nW === r.amber, 'zählt nicht als Warnung (Kostenleiste ' + nW + ' = ' + r.amber + ' gelbe Hinweise)');
  ok(!/zuschlag|aufrund|erhöh/i.test(r.li[0].t), 'neutral formuliert, keine Empfehlung zum Erhöhen');
  await pg.addScriptTag({ path: K.AXE }); const ax = await pg.evaluate(() => axe.run('#result').then(x => x.violations.map(v => v.id + ' ' + v.nodes[0].target)));
  ok(ax.length === 0, 'axe ohne Verstösse ' + ax.join('|'));
  errs.push(...pg.errs); await pg.close();
  // knapp über 30'000
  c = G[48]; pg = await open(b, c.st, 'classic'); r = await info(pg);
  ok(r.sum.netto === c.out.sum.netto, 'Kosten identisch (netto ' + r.sum.netto + ')');
  ok(/knapp über der Rabattgrenze CHF 30.000/.test(r.note) && r.li.length === 1 && r.li[0].c === 'info' && /CHF 30.623\.54 liegt knapp über CHF 30.000 \(Stufe 3 · 5 %\)\. Fällt sie unter die Grenze, z\. B\. durch Mengenänderungen, gilt Stufe 2 \(3 % Rabatt\)/.test(r.li[0].t), 'knapp über: ' + (r.li[0] || {}).t);
  errs.push(...pg.errs); await pg.close();
  // ausserhalb der Bänder
  c = G[30]; pg = await open(b, c.st, 'classic'); r = await info(pg);
  ok(r.li.length === 0 && !/Rabattgrenze/.test(r.note), 'LV-Summe ' + c.out.sum.rabattBasis + ': kein Hinweis');
  errs.push(...pg.errs); await pg.close();
  // Layout A: Reiter «Hinweise»
  c = G[11]; pg = await open(b, c.st, 'a');
  await pg.evaluate(() => { const t = document.querySelector('#lyT_warn'); if (t) t.click(); }); await pg.waitForTimeout(400);
  const la = await pg.evaluate(() => { const p = document.querySelector('#lyP_warn'); const li = p ? [...p.querySelectorAll('li')].find(x => /Rabattgrenze/.test(x.textContent)) : null; return { li: li ? li.className : null, cnt: (document.querySelector('[data-cnt="warn"]') || {}).textContent }; });
  ok(la.li === 'info', 'Layout A: Hinweis im Reiter «Hinweise» als Info');
  errs.push(...pg.errs); await pg.close();
  // Französisch
  const stf = Object.assign({}, G[48].st, { lang: 'fr' }); pg = await open(b, stf, 'classic', '?lang=fr'); r = await info(pg);
  ok(r.li.length === 1 && /^.*Seuil de rabais : la somme LV de CHF 30.623.54 est juste au-dessus de CHF 30.000/.test(r.li[0].t) && /juste au-dessus du seuil de rabais/.test(r.note), 'FR: ' + (r.li[0] || {}).t.slice(0, 90));
  errs.push(...pg.errs); await pg.close();
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
