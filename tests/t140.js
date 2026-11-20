/* t140: UX-Runde 11/2026 P7 – Handy (≤ 860 px) und Statuszeile
   - Kennzahlenleiste: höchstens 3 Kennzahlen (Kosten exkl., inkl., Länge), ohne abgeschnittenen Text; Tipp/▾ zeigt alle
   - Kopf: Menü und Suche mit sichtbarer Mini-Beschriftung; Befehlsleiste (›_) im Blatt «Mehr»
   - Blatt «Mehr»: «Zeichenhilfen» mit Erklärzeile je Schalter, Urheberzeile zuunterst
   - 360/390 px: keine Seitenbreite überschritten, keine sich überdeckenden Bedienelemente/Hinweise (Rechteck-Prüfung, nur sichtbare Elemente)
   - Desktop: Statuszeile mit vollem Text als Tooltip */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX } = K;
const STUB = r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback();
const OVL = () => {
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && e.offsetParent !== null; };
  const top = e => { const r = e.getBoundingClientRect(), x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)), t = document.elementFromPoint(x, y); return !!t && (e === t || e.contains(t) || t.contains(e)); };
  const els = [...document.querySelectorAll('dialog.kmlya[open] button, dialog.kmlya[open] a[href], dialog.kmlya[open] select, dialog.kmlya[open] input:not([type=hidden]):not([type=file]), dialog.kmlya[open] .kmparzhint, dialog.kmlya[open] .kmtoast, dialog.kmlya[open] .kmstart, #chFab')].filter(vis).filter(e => !e.closest('.leaflet-marker-pane, .leaflet-tile-pane')).filter(top);
  const out = []; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue; const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(), ox = Math.min(A.right, B.right) - Math.max(A.left, B.left), oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top); if (ox > 3 && oy > 3) out.push((a.className || a.tagName) + '/' + (b.className || b.tagName)); }
  const clip = [...document.querySelectorAll('dialog.kmlya[open] .lybar .lyc, dialog.kmlya[open] .lybar .lyc *')].filter(vis).filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className || e.tagName);
  return { n: els.length, out, clip, ov: document.documentElement.scrollWidth > innerWidth + 1 };
};
(async () => {
  const b = await chromium.launch(), errs = [];
  for (const w of [360, 390]) {
    for (const start of [false, true]) {
      const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
      await pg.addInitScript(s => { localStorage.setItem('lvd-layout', 'a'); if (!s) window.__LVD_START_OFF = 1; }, start);
      await pg.route('**/*', STUB); await pg.goto(process.env.LVD_URL || INDEX); await pg.waitForTimeout(2500);
      const res = {}; for (const sh of ['', 'more', 'tools', 'dock']) { if (sh) { await pg.evaluate(s => window.__LYMOB.show(s), sh); await pg.waitForTimeout(500); } res[sh || 'karte'] = await pg.evaluate(OVL); }
      ok(Object.values(res).every(r => r.out.length === 0 && !r.ov), w + ' px' + (start ? ' mit Startkarte' : '') + ': keine Überdeckung, kein Überlauf ' + JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.n + (r.out.length ? ' ' + r.out.join(',') : '')]))));
      if (!start) {
        await pg.evaluate(() => window.__LYMOB.show('')); await pg.waitForTimeout(300);
        const k = await pg.evaluate(() => { const p = document.querySelector('#lyKpi'); const vis = [...p.children].filter(c => c.offsetParent && getComputedStyle(c).display !== 'none').sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left); return { n: vis.length, keys: vis.map(c => c.className.replace(/lyc|lymain|\s/g, '')), clip: [...p.querySelectorAll('.lyc, .lyc *')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).length, txt: vis.map(c => c.querySelector('.lyk').innerText.trim()).join(' | ') }; });
        ok(k.n === 3 && k.keys.join() === 'lyk-net,lyk-bru,lyk-len' && k.clip === 0, w + ' px: 3 Kennzahlen ohne Abschneiden (' + k.txt + ')');
        await pg.click('.lykall'); await pg.waitForTimeout(200);
        const k2 = await pg.evaluate(() => ({ n: [...document.querySelectorAll('#lyKpi > *')].filter(c => c.offsetParent && getComputedStyle(c).display !== 'none').length, ex: document.querySelector('.lykall').getAttribute('aria-expanded'), ov: document.documentElement.scrollWidth > innerWidth + 1 }));
        ok(k2.n >= 5 && k2.ex === 'true' && !k2.ov, w + ' px: ▾ zeigt alle Kennzahlen (' + k2.n + ')');
        await pg.tap('#lyKpi .lyk-net'); await pg.waitForTimeout(200);
        ok(await pg.evaluate(() => !document.querySelector('#lyKpi').classList.contains('all')), w + ' px: Tipp auf die Leiste klappt wieder zu');
        const hd = await pg.evaluate(() => ({ menu: getComputedStyle(document.querySelector('.lyhm'), '::after').content, srch: (document.querySelector('.lysbtn .lysbt') || {}).offsetParent ? document.querySelector('.lysbtn .lysbt').textContent : '', cmdHead: !!(document.querySelector('.kmhead .lymk') && document.querySelector('.kmhead .lymk').offsetParent) }));
        ok(/Menü/.test(hd.menu) && hd.srch === 'Suche' && !hd.cmdHead, w + ' px: Kopf «Menü»/«Suche» beschriftet, ›_ nicht mehr im Kopf');
        await pg.evaluate(() => window.__LYMOB.show('more')); await pg.waitForTimeout(400);
        const mo = await pg.evaluate(() => { const bt = document.querySelector('.kmbottom'); const kids = [...bt.children].filter(c => c.offsetParent); const last = kids[kids.length - 1]; return { cmd: !!(bt.querySelector('.lymk') && bt.querySelector('.lymk').offsetParent), h: (bt.querySelector('.kmfang-h') || {}).textContent, fx: [...bt.querySelectorAll('.kmfx')].filter(e => e.offsetParent).length, desc: [...bt.querySelectorAll('[data-sn]')].every(x => x.getAttribute('aria-describedby')), last: last && last.className }; });
        ok(mo.cmd && /Zeichenhilfen/.test(mo.h) && mo.fx === 4 && mo.desc && /lycred/.test(mo.last), w + ' px: «Mehr» mit Befehlsleiste, Zeichenhilfen + 4 Erklärzeilen, Urheberzeile zuunterst');
        if (w === 390) { await pg.addScriptTag({ path: K.AXE }); const ax = await pg.evaluate(() => axe.run('dialog.kmlya').then(r => r.violations.map(v => v.id + ' ' + v.nodes[0].target))); ok(ax.length === 0, '390 px «Mehr»: axe ohne Verstösse ' + ax.join('|')); }
      }
      await ctx.close();
    }
  }
  // Desktop: Statuszeile mit Tooltip
  const pd = await b.newPage({ viewport: { width: 1440, height: 900 } }); pd.on('pageerror', e => errs.push(e.message));
  await pd.addInitScript(() => { localStorage.setItem('lvd-layout', 'a'); window.__LVD_START_OFF = 1; }); await pd.route('**/*', STUB); await pd.goto(process.env.LVD_URL || INDEX); await pd.waitForTimeout(2500);
  const t1 = await pd.evaluate(() => { const h = document.querySelector('.lycmd .kmhelp'); return { t: h.title, x: h.textContent.replace(/\s+/g, ' ').trim(), cut: h.scrollWidth > h.clientWidth }; });
  await pd.evaluate(() => document.querySelector('#kmToolsBody [data-k=mline]').click()); await pd.waitForTimeout(300);
  const t2 = await pd.evaluate(() => { const h = document.querySelector('.lycmd .kmhelp'); return { t: h.title, x: h.textContent.replace(/\s+/g, ' ').trim() }; });
  ok(t1.t === t1.x && t1.x.length > 20 && t2.t === t2.x && t2.x !== t1.x, 'Statuszeile: voller Text als Tooltip, folgt dem Werkzeug' + (t1.cut ? ' (Text abgeschnitten → Tooltip nötig)' : ''));
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
