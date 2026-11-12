/* t105: Bewegung und Material (Apple-Design-Prinzipien) – Rückmeldung beim Drücken (Skalierung), Federkurve, durchscheinende Flächen mit Rückfall, «Bewegung reduzieren» schaltet Animationen ab */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(1000); await pg.reload();
  for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1800);
  const tf = () => pg.evaluate(() => { const e = document.querySelector('dialog.kmlya .lydtabs button'); return getComputedStyle(e).transform; });
  const bx = await pg.locator('dialog.kmlya .lydtabs button').first().boundingBox();
  await pg.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); const t0 = await tf(); await pg.mouse.down(); await pg.waitForTimeout(160); const t1 = await tf(); await pg.mouse.up();
  ok((t0 === 'none' || t0 === 'matrix(1, 0, 0, 1, 0, 0)') && /matrix\(0\.9/.test(t1), 'Drücken: Taste skaliert sofort auf ~97 % (' + t1 + ')');
  const tr = await pg.evaluate(() => getComputedStyle(document.querySelector('dialog.kmlya .btn:not(:disabled)')).transitionTimingFunction); ok(/cubic-bezier\(0\.22, 1, 0\.36, 1\)/.test(tr), 'Federkurve als Übergang (' + tr + ')');
  await pg.evaluate(() => { window.__KM.fit(); }); await pg.waitForTimeout(300);
  const mkHint = () => pg.evaluate(() => { let d = document.querySelector('#kmMap .kmparzhint'); if (!d) { d = document.createElement('div'); d.className = 'kmparzhint'; document.querySelector('#kmMap').appendChild(d); } const cs = getComputedStyle(d); return { bf: cs.backdropFilter || cs.webkitBackdropFilter, bg: cs.backgroundColor }; });
  const bl = await mkHint();
  ok(/blur/.test(bl.bf) && /rgba\(255, 255, 255, 0\.9\)/.test(bl.bg), 'Material: Hinweisfeld durchscheinend mit Weichzeichner (' + bl.bf + ')');
  const rt = await pg.evaluate(() => { for (const sh of document.styleSheets) { for (const r of sh.cssRules) { if (r.media && /prefers-reduced-transparency/.test(r.conditionText || r.media.mediaText)) return [...r.cssRules].map(x => x.cssText).join(' '); } } return ''; });
  ok(/backdrop-filter:\s*none/.test(rt) && /rgb\(255, 255, 255\)|#fff/.test(rt), 'Transparenz reduzieren: Regel macht die Fläche deckend, ohne Weichzeichner (im Stylesheet)');
  await pg.emulateMedia({ reducedMotion: 'reduce' }); await pg.waitForTimeout(200);
  await pg.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await pg.mouse.down(); await pg.waitForTimeout(160); const t2 = await tf(); await pg.mouse.up();
  ok(t2 === 'none' || t2 === 'matrix(1, 0, 0, 1, 0, 0)', 'Bewegung reduzieren: keine Skalierung beim Drücken (' + t2 + ')');
  const an = await pg.evaluate(() => { const d = document.createElement('div'); d.className = 'kmparzhint'; document.querySelector('#kmMap').appendChild(d); const a = getComputedStyle(d).animationName; d.remove(); return a; }); ok(an === 'none', 'Bewegung reduzieren: Einblend-Animation aus (' + an + ')');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
