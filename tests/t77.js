/* t77: Passpunkte fein setzen – mehr als 2 Punkte mit Ausgleich und Restabweichung, E/N eintippen, Ausreisser markiert, Marker per Pfeiltaste (1 cm/10 cm), Punkte bleiben gespeichert */
const K = require('./lib/k.js'), { chromium, ok, mk, getS, AXE } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1600, 1000);
  await pg.route('**/*', r => /wmts|wms\.geo|SearchServer|api3/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.fill('#f_graben_L', '1'); await pg.waitForTimeout(300);
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(1000);
  await K.openMid(pg).catch(() => {}); await pg.evaluate(() => { document.querySelector('#kmOvD').open = true; });
  await pg.setInputFiles('#kmOvF', K.FX('plan.png')); await pg.waitForTimeout(1500);
  const O = () => pg.evaluate(() => JSON.parse(JSON.stringify(window.__KM.ov(), (k, v) => k === 'img' ? undefined : v)));
  const o0 = await O(); ok(o0 && o0.w > 0, 'Plan geladen (' + o0.w + '×' + o0.h + ' px)');
  /* Soll: 5 cm/px, 12° gedreht, Mitte = aktuelle Planmitte + 3 m */
  const T = { mpp: 0.05, rot: 12, E: o0.E + 3, N: o0.N - 2, w: o0.w, h: o0.h };
  const px = (o, x, y) => { const ux = (x - o.w / 2) * o.mpp, uy = (o.h / 2 - y) * o.mpp, a = o.rot * Math.PI / 180; return [o.E + ux * Math.cos(a) - uy * Math.sin(a), o.N + ux * Math.sin(a) + uy * Math.cos(a)]; };
  const S = [[0.15, 0.2], [0.85, 0.25], [0.8, 0.85], [0.2, 0.8]].map(q => [q[0] * o0.w, q[1] * o0.h]);
  const scr = q => pg.evaluate(q => { const m = window.__KM.map(), p = m.latLngToContainerPoint(window.__KM.ll(q)), r = document.querySelector('#kmMap').getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }, q);
  const fitTo = async pts => { await pg.evaluate(pts => { const m = window.__KM.map(); m.fitBounds(L.latLngBounds(pts.map(p => window.__KM.ll(p))).pad(0.3), { animate: false, paddingBottomRight: [60, 160], paddingTopLeft: [360, 80] }); }, pts); await pg.waitForTimeout(250); };
  await pg.click('[data-k=mgeo]'); await pg.waitForTimeout(200);
  for (let i = 0; i < 4; i++) {
    let o = await O(); const sp = px(o, S[i][0], S[i][1]), tp = px(T, S[i][0], S[i][1]);
    await fitTo([sp, tp]); let c = await scr(sp); await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(150);
    c = await scr(tp); await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(200);
    if (i === 1) { o = await O(); ok(Math.abs(o.mpp - 0.05) < 0.005 && Math.abs(o.rot - 12) < 1.5, 'nach 2 Punkten ausgerichtet (Massstab ' + o.mpp.toFixed(4) + ', Drehung ' + o.rot.toFixed(2) + '°)'); ok(await pg.locator('[data-gk=end]').isVisible(), 'Modus bleibt aktiv für weitere Punkte («Fertig» sichtbar)'); }
  }
  let o = await O();
  ok(o.gcp.length === 4 && o.gcp.every(g => g.r != null) && o.rms != null, 'Ausgleich über 4 Punkte mit Restabweichung je Punkt (±' + (o.rms * 100).toFixed(1) + ' cm)');
  ok(await pg.locator('#kmGcp tbody tr').count() === 4 && await pg.locator('.kmgcps').count() === 4 && await pg.locator('.kmgcpt').count() === 4, 'Liste und Marker (Plan rot, Karte grün) für 4 Punkte');
  /* exakte Koordinaten eintippen → Restabweichung nur noch aus der Planpunkt-Klickgenauigkeit */
  for (let i = 0; i < 4; i++) { const tp = px(T, o.gcp[i].s[0], o.gcp[i].s[1]); await pg.fill('#kmGcp [data-gc="' + i + '"][data-ax="0"]', tp[0].toFixed(3)); await pg.dispatchEvent('#kmGcp [data-gc="' + i + '"][data-ax="0"]', 'change'); await pg.fill('#kmGcp [data-gc="' + i + '"][data-ax="1"]', tp[1].toFixed(3)); await pg.dispatchEvent('#kmGcp [data-gc="' + i + '"][data-ax="1"]', 'change'); }
  o = await O();
  ok(o.rms < 0.01 && Math.abs(o.mpp - 0.05) < 0.0002 && Math.abs(o.rot - 12) < 0.05 && Math.hypot(o.E - T.E, o.N - T.N) < 0.02, 'mit eingetippten E/N exakt: ±' + (o.rms * 1000).toFixed(1) + ' mm, Lage ' + (Math.hypot(o.E - T.E, o.N - T.N) * 100).toFixed(1) + ' cm');
  /* Ausreisser */
  const e3 = +(await pg.inputValue('#kmGcp [data-gc="2"][data-ax="0"]'));
  await pg.fill('#kmGcp [data-gc="2"][data-ax="0"]', (e3 + 0.8).toFixed(3)); await pg.dispatchEvent('#kmGcp [data-gc="2"][data-ax="0"]', 'change');
  ok(await pg.locator('#kmGcp tr.warn').count() === 1 && /⚠/.test(await pg.textContent('#kmGcp tr.warn')) && (await pg.textContent('#kmGcp tr.warn td')) === '3', 'Ausreisser (Punkt 3, +80 cm) wird markiert');
  await pg.click('#kmGcp [data-gx="2"]'); await pg.waitForTimeout(150); o = await O();
  ok(o.gcp.length === 3 && o.rms < 0.01, 'Punkt löschen → Ausgleich wieder sauber (±' + (o.rms * 1000).toFixed(1) + ' mm)');
  /* Pfeiltasten am Kartenmarker */
  const t0 = o.gcp[0].t.slice(); await pg.locator('.kmgcpt', { hasText: '1' }).first().focus(); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(100); await pg.keyboard.press('Shift+ArrowUp'); await pg.waitForTimeout(150);
  o = await O(); ok(Math.abs(o.gcp[0].t[0] - t0[0] - 0.01) < 0.002 && Math.abs(o.gcp[0].t[1] - t0[1] - 0.1) < 0.002, 'Pfeiltaste → 1 cm, Umschalt+Pfeil → 10 cm (' + ((o.gcp[0].t[0] - t0[0]) * 100).toFixed(1) + ' / ' + ((o.gcp[0].t[1] - t0[1]) * 100).toFixed(1) + ' cm)');
  ok(await pg.evaluate(() => document.activeElement && document.activeElement.classList.contains('kmgcpt')), 'Fokus bleibt auf dem Marker (Tastatur weiter bedienbar)');
  await pg.addScriptTag({ path: AXE }); const ax = await pg.evaluate(() => axe.run(document.querySelector('#kmGcp')).then(r => r.violations.map(v => v.id)));
  ok(ax.length === 0, 'axe Passpunkt-Liste: ' + JSON.stringify(ax));
  await pg.click('[data-gk=end]'); await pg.waitForTimeout(150);
  ok(await pg.locator('[data-gk=add]').isVisible(), '«Fertig» beendet, «Passpunkt hinzufügen» setzt fort');
  await pg.click('[data-k=apply]'); await pg.waitForTimeout(1000);
  const ov = (await getS(pg)).karte.overlay;
  ok(ov && ov.gcp && ov.gcp.length === 3 && ov.autoSrc === 'gcp', 'Passpunkte mit dem Projekt gespeichert (später weiter verfeinerbar)');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
