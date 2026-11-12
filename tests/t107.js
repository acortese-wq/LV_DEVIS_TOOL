/* t107: Glas-Leisten – die Karte reicht ab 861 px unter Kopfleiste, Kennzahlen und Ribbon; Leisten durchscheinend mit Weichzeichner; Kartensteuerung und «Auf Bestand zoomen» liegen darunter; der Bestand wird unterhalb der Leisten angezeigt; Handy unverändert (Karte beginnt unter der Kopfleiste), Handy-Sheets mit Material */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(1000); await pg.reload();
  for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(2000);
  const g = await pg.evaluate(() => {
    const d = document.querySelector('dialog.kmlya'), r = e => document.querySelector(e).getBoundingClientRect(), lt = parseFloat(d.style.getPropertyValue('--lytop')), m = r('#kmMap'), bar = r('.lyrb'), z = r('.leaflet-control-zoom'), cs = getComputedStyle(document.querySelector('.lybar')), kh = getComputedStyle(document.querySelector('.kmhead'));
    return { lt, mTop: m.top, barBottom: bar.bottom, zTop: z.top, bf: cs.backdropFilter || cs.webkitBackdropFilter, kz: +kh.zIndex, lz: +getComputedStyle(document.querySelector('.lyrb')).zIndex };
  });
  ok(g.lt > 100 && g.mTop < 5, 'Karte beginnt am oberen Fensterrand (' + Math.round(g.mTop) + ' px) und reicht unter die Leisten (' + Math.round(g.lt) + ' px)');
  ok(Math.abs(g.barBottom - g.lt) < 3, 'Leistenhöhe stimmt mit dem Kartenversatz überein (' + Math.round(g.barBottom) + ' ≈ ' + Math.round(g.lt) + ')');
  ok(g.zTop >= g.barBottom - 1, 'Zoomfeld liegt unterhalb der Leisten (y ' + Math.round(g.zTop) + ' ≥ ' + Math.round(g.barBottom) + ')');
  ok(/blur/.test(g.bf), 'Leisten durchscheinend mit Weichzeichner (' + g.bf + ')'); ok(g.kz > g.lz, 'Kopfleiste liegt über dem Ribbon (Popovers sichtbar): ' + g.kz + ' > ' + g.lz);
  await pg.evaluate(() => window.__KM.fit()); await pg.waitForTimeout(600);
  const o = await pg.evaluate(() => { const m = window.__KM.map(), M = window.__KM.M(), lt = parseFloat(document.querySelector('dialog.kmlya').style.getPropertyValue('--lytop')), r = document.querySelector('#kmMap').getBoundingClientRect(); const ys = []; M.lines.forEach(l => l.pts.forEach(p => ys.push(r.top + m.latLngToContainerPoint(window.__KM.ll(p)).y))); return { minY: Math.min(...ys), lt }; });
  ok(o.minY >= o.lt - 2, 'Bestand wird unterhalb der Leisten gezeigt (oberster Punkt y ' + Math.round(o.minY) + ' ≥ ' + Math.round(o.lt) + ')');
  const click = await pg.evaluate(() => { const bb = document.querySelector('.lyrb').getBoundingClientRect(); const e = document.elementFromPoint(bb.left + 400, bb.top + 8); return e ? e.closest('.lyrb') ? 'ribbon' : e.className.toString() : 'none'; });
  ok(click === 'ribbon', 'Klicks im Leistenbereich treffen die Leiste, nicht die Karte (' + click + ')');
  // Handy
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(900);
  const mo = await pg.evaluate(() => { const d = document.querySelector('dialog.kmlya'); return { lt: parseFloat(d.style.getPropertyValue('--lytop')), ov: d.scrollWidth > innerWidth + 1 }; });
  ok(mo.lt === 0 && !mo.ov, 'Handy: keine Überlappung, kein Seitenüberlauf (--lytop ' + mo.lt + ')');
  const sh = await pg.evaluate(() => { const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } }); return css.some(r => r.media && /max-width:\s*860px/.test(r.media.mediaText) && [...r.cssRules].some(x => /ly-ms-dock/.test(x.selectorText || '') && /backdrop-filter/.test(x.cssText))); });
  ok(sh, 'Handy-Sheets und Navigation: Material (Weichzeichner) im Stylesheet');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
