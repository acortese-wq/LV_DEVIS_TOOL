/* t83: QS-Matrix (Redesign Phase I) – Arbeitsplatz auf 1920/1440/1280/1024/768/430/390/375/320 px, hell und dunkel:
   kein Überlauf, axe ohne Verstösse (inkl. Kontrast), Karte gross genug, Kosten = Regressions-Referenz, alle Bereiche erreichbar;
   Kennzahlen je Grösse nach <TMP>/qa_matrix.json (Grundlage für den Abschlussbericht) */
const fs = require('fs'), path = require('path'), K = require('./lib/k.js'), { chromium, ok, mk, AXE } = K;
const G = JSON.parse(fs.readFileSync(path.join(K.ROOT, 'tests/fixtures/golden.json')));
const f0 = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const SIZES = [[1920, 1080], [1440, 900], [1280, 800], [1024, 768], [768, 1024], [430, 932], [390, 844], [375, 667], [320, 568]];
(async () => {
  const b = await chromium.launch(); const rep = [];
  for (const theme of ['dark', 'light']) {
    const pg = await mk(b, 1440, 900);
    await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
    await pg.evaluate(t => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lvd-theme', t); }, theme); await pg.waitForTimeout(1200); await K.noBE(pg);
    await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
    await pg.addScriptTag({ path: AXE });
    for (const [w, h] of SIZES) {
      await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(500);
      const mob = w <= 860;
      const m = await pg.evaluate(() => { const d = document.querySelector('dialog.kmlya'), r = document.querySelector('#kmMap').getBoundingClientRect(); return { ovx: d.scrollWidth > innerWidth + 1, ovy: d.scrollHeight > innerHeight + 1, mw: Math.round(r.width), mh: Math.round(r.height), kpi: (document.querySelector('#lyKpi') || {}).textContent || '' }; });
      const ax = await pg.evaluate(() => axe.run(document.querySelector('dialog.kmlya'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
      // alle Bereiche erreichbar
      let reach = true;
      if (mob) { for (const k of ['tools', 'mid', 'side', 'dock', 'more']) { await pg.click('.lymtab [data-msh=' + k + ']'); await pg.waitForTimeout(150); const v = await pg.evaluate(k => { const id = document.querySelector('.lymtab [data-msh=' + k + ']').getAttribute('aria-controls'), e = document.getElementById(id), r = e && e.getBoundingClientRect(); return !!r && r.height > 100 && r.width >= innerWidth - 2 && document.querySelector('dialog.kmlya').scrollWidth <= innerWidth + 1; }, k); reach = reach && v; await pg.click('.lymtab [data-msh=' + k + ']'); await pg.waitForTimeout(100); } }
      else { for (const t of ['prof', 'aus', 'kost', 'pos', 'warn']) { await pg.evaluate(t => { const b = document.querySelector('#lyT_' + t), p = document.querySelector('#lyP_' + t); if (b.getAttribute('aria-selected') !== 'true' || p.hidden) b.click(); }, t); await pg.waitForTimeout(120); reach = reach && await pg.locator('#lyP_' + t).isVisible(); }
        reach = reach && await pg.locator('.kmtools').isVisible() && await pg.locator('.kmside').isVisible(); }
      const g0 = G.cases[0].out.sum, cost = m.kpi.includes('CHF ' + f0(g0.netto)) && m.kpi.includes('CHF ' + f0(g0.brutto));
      const mapMin = mob ? 0.6 : 0.35, mapOk = m.mw >= (mob ? w - 1 : 0.4 * w) && m.mh >= mapMin * h - (h < 600 ? 60 : 0);
      ok(!m.ovx && !m.ovy && ax.length === 0 && cost && reach && mapOk, theme + ' ' + w + '×' + h + ': Überlauf ' + (m.ovx || m.ovy ? 'JA' : 'nein') + ', axe ' + (ax.length ? JSON.stringify(ax) : '0') + ', Karte ' + m.mw + '×' + m.mh + ', Kosten ' + (cost ? '= Referenz' : 'ABWEICHUNG') + ', Bereiche ' + (reach ? 'erreichbar' : 'FEHLEN'));
      rep.push({ theme, w, h, mobile: mob, overflow: m.ovx || m.ovy, axe: ax, map: [m.mw, m.mh], mapShare: +(m.mw * m.mh / (w * h)).toFixed(2), costOk: cost, reach });
      if ([1440, 1024, 768, 390, 320].includes(w)) await pg.screenshot({ path: K.tmp('qa_' + theme + '_' + w + '.png') });
    }
    ok(pg.errs.length === 0, theme + ': keine JS-Fehler ' + pg.errs.join('|')); await pg.close();
  }
  fs.writeFileSync(K.tmp('qa_matrix.json'), JSON.stringify(rep, null, 1));
  await b.close();
})();
