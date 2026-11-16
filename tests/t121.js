/* t121: Schwebende Fenster auf der Karte (Route Von/Nach, Palette, Auswahlleiste …) liegen im Planungsfokus nie unter den Glas-Leisten und lassen sich bedienen; alle Werkzeuge werden geprüft */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1440, 900], [1280, 720], [1024, 700]]) {
    const pg = await mk(b, w, h);
    await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|routing/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
    await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(800); await pg.reload();
    for (let t = 0; t < 40 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
    // Route Von/Nach: ganz sichtbar, unter den Leisten, Eingabefelder anklickbar
    await pg.evaluate(() => document.querySelector('[data-k=route]').click()); await pg.waitForTimeout(600);
    const r = await pg.evaluate(() => { const e = document.querySelector('#kmRoute'), d = document.querySelector('dialog.kmlya'), lt = parseFloat(d.style.getPropertyValue('--lytop')) || 0, q = e.getBoundingClientRect(), i = document.querySelector('#kmRtA'), ir = i.getBoundingClientRect(), hit = document.elementFromPoint(ir.left + ir.width / 2, ir.top + ir.height / 2); return { vis: !e.hidden, top: q.top, lt, bottom: q.bottom, vh: innerHeight, hit: hit === i }; });
    ok(r.vis && r.top >= r.lt - 1 && r.bottom <= r.vh + 1 && r.hit, w + '×' + h + ': Route «Von/Nach» unter den Leisten (Oberkante ' + Math.round(r.top) + ' ≥ ' + Math.round(r.lt) + '), Feld «Von» anklickbar');
    await pg.fill('#kmRtA', 'Bahnhofstrasse 1, Chur'); ok((await pg.inputValue('#kmRtA')).startsWith('Bahnhof'), '   Eingabe im Feld «Von» möglich');
    await pg.evaluate(() => document.querySelector('[data-k=medit]').click());
    // alle Werkzeuge: kein sichtbares schwebendes Element unter den Leisten
    const tools = await pg.evaluate(() => [...new Set([...document.querySelectorAll('dialog.kmlya [data-k]')].map(x => x.dataset.k).filter(k => /^(m[a-z]+|route|msond|medit)$/.test(k) && k !== 'max'))]);
    const bad = [];
    for (const k of tools) {
      await pg.evaluate(k => { const e = document.querySelector('dialog.kmlya [data-k=' + k + ']'); if (e && !e.disabled) e.click(); }, k); await pg.waitForTimeout(350);
      const x = await pg.evaluate(() => { const d = document.querySelector('dialog.kmlya'), lt = parseFloat(d.style.getPropertyValue('--lytop')) || 0, out = []; d.querySelectorAll('.kmcanvas *, .kmleft *').forEach(e => { if (e.closest('.leaflet-pane,.leaflet-control-container,.kmv,.kmsch,.kmwl,.kmgeb,.kmsond')) return; const cs = getComputedStyle(e); if (!/absolute|fixed/.test(cs.position) || cs.display === 'none' || cs.visibility === 'hidden' || e.hidden) return; const q = e.getBoundingClientRect(); if (q.width < 24 || q.height < 14) return; if (q.top < lt - 2 && q.bottom > 4) out.push((e.id ? '#' + e.id : '.' + String(e.className.baseVal || e.className || e.tagName).split(' ')[0])); }); return out; }, k);
      if (x.length) bad.push(k + ': ' + [...new Set(x)].join(','));
      await pg.evaluate(() => document.querySelector('dialog.kmlya [data-k=medit]').click()); await pg.waitForTimeout(150);
    }
    ok(bad.length === 0, w + '×' + h + ': ' + tools.length + ' Werkzeuge öffnen kein Fenster unter den Leisten ' + bad.join(' | '));
    ok(pg.errs.length === 0, '   keine JS-Fehler ' + pg.errs.join('|'));
  }
  await b.close();
})();
