/* t88: Gespeicherte, grosse Dock-Höhe (lvd-dockh 560) auf kleinem Fenster – Klick auf «Hinweise» darf die Karte nicht zusammenquetschen:
   Karte/Werkzeuge/Eigenschaften ≥ 240 px hoch, unterer Bereich überlappt sie nicht, Reiter und Inhalt bleiben sichtbar, kein Überlauf */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1504, 808], [1366, 650], [1280, 600], [1024, 768], [1880, 1020], [1440, 900]]) {
    const pg = await mk(b, w, h);
    await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
    await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lvd-dockh', '560'); localStorage.setItem('lvd-ly-dock', JSON.stringify({ t: 'kost', c: true })); localStorage.setItem('lvd-ly-dockn', JSON.stringify({ c: true })); });
    await pg.waitForTimeout(1200); await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1800);
    await pg.click('[data-lywarn]'); await pg.waitForTimeout(500);
    const g = await pg.evaluate(() => { const q = s => document.querySelector(s).getBoundingClientRect(), gr = q('.kmgrid'), dk = q('.lydock'), mp = q('#kmMap'), p = q('.lydpan:not([hidden])'), d = document.querySelector('dialog.kmlya'); return { gh: gr.height, mapB: mp.bottom, dkT: dk.top, grB: gr.bottom, ph: p.height, ov: d.scrollWidth > innerWidth + 1 || d.scrollHeight > innerHeight + 1, bot: q('.kmbottom').bottom, ih: innerHeight, tabs: !!document.querySelector('.lydtabs [role=tab]').offsetParent }; });
    ok(g.gh >= 240 && g.mapB <= g.dkT + 1 && g.grB <= g.dkT + 1 && g.ph >= 120 && g.tabs && !g.ov && g.bot <= g.ih + 1, w + '×' + h + ' (Dock gespeichert 560): Karte ' + Math.round(g.gh) + ' px, Dock ' + Math.round(g.ph) + ' px, überlappt nicht, kein Überlauf');
    // Fenster verkleinern, solange der Bereich offen ist
    await pg.setViewportSize({ width: w, height: Math.max(560, h - 200) }); await pg.waitForTimeout(500);
    const g2 = await pg.evaluate(() => { const q = s => document.querySelector(s).getBoundingClientRect(); return { gh: q('.kmgrid').height, ov: q('#kmMap').bottom > q('.lydock').top + 1 }; });
    ok(g2.gh >= 160 && !g2.ov, w + ': Fenster verkleinert → Karte ' + Math.round(g2.gh) + ' px, keine Überlappung');
    ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await pg.close();
  }
  await b.close();
})();
