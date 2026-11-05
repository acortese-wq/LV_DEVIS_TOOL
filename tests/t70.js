/* t70: Performance grosser Projekte (Annahmen-Tabelle, Ergebnis, Excel) und zwei Fenster/Tabs ohne stilles Überschreiben */
const { chromium, ok, INDEX } = require('./lib/k.js');
const fs = require('fs'), path = require('path'), vm = require('vm');
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const open = async () => { const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept()); await p.goto(INDEX); await p.waitForTimeout(1200); return p; };
  const set = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  const A = await open();
  // 1) Performance: 100 Gräben, 60 Schächte, 40 Beläge
  const r = await A.evaluate(() => { const S = window.__LVD.S(), g0 = JSON.stringify(S.recs.graben[0]), s0 = JSON.stringify(S.recs.schacht[0]), b0 = JSON.stringify(S.recs.belag[0]);
    S.recs.graben = Array.from({ length: 100 }, (_, i) => Object.assign(JSON.parse(g0), { name: 'G' + i, L: String(20 + i), T: '1.0' }));
    S.recs.schacht = Array.from({ length: 60 }, (_, i) => Object.assign(JSON.parse(s0), { name: 'S' + i, n: '1' }));
    S.recs.belag = Array.from({ length: 40 }, (_, i) => Object.assign(JSON.parse(b0), { name: 'B' + i, B: '3', L: '5' }));
    window.__LVD.renderResult(); let t0 = performance.now(); window.__LVD.renderResult(); const rr = performance.now() - t0;
    t0 = performance.now(); const rows = KVE.sens(S, LV); const se = performance.now() - t0; return { rr, se, n: rows.length }; });
  ok(r.n > 300 && r.se < 600, 'Annahmen-Tabelle 200 Datensätze: ' + Math.round(r.se) + ' ms (' + r.n + ' Annahmen; vorher ~2500 ms)');
  ok(r.rr < 1500, 'Ergebnis neu aufbauen: ' + Math.round(r.rr) + ' ms (vorher ~4000 ms)');
  // Annahmen exakt wie vollständige Neuberechnung (Stichprobe im Browser)
  const ex = await A.evaluate(() => { const S = window.__LVD.S(), rows = KVE.sens(S, LV), b0 = KVE.calc(S, LV).sum.zwischen; let bad = 0, n = 0;
    S.recs.graben.slice(0, 15).forEach((e, i) => { const Q = JSON.parse(JSON.stringify(S)); const h = e.hand || 'normal'; Q.recs.graben[i].hand = h === 'normal' ? 'eng' : h === 'eng' ? 'sehr_eng' : 'eng';
      const d = KVE.r2(KVE.calc(Q, LV).sum.zwischen - b0), row = rows.filter(x => x.el === e.name && x.id === 'a_hand')[0]; n++; if (!row || row.d !== d) bad++; });
    KVE.calc(S, LV); return { bad, n }; });
  ok(ex.bad === 0, 'Annahmen = vollständige Neuberechnung (' + ex.n + ' Stichproben)');
  await A.evaluate(() => { localStorage.clear(); }); await A.reload(); await A.waitForTimeout(1200);
  // 2) Zwei Tabs: ruhige Übernahme
  const B = await open();
  await set(A, '#p_projekt', 'Projekt A'); await A.waitForTimeout(700);
  ok(await B.inputValue('#p_projekt') === 'Projekt A', 'Tab B übernimmt die Änderung aus Tab A ohne Neuladen');
  await set(B, '#p_ort', 'Chur'); await B.waitForTimeout(700);
  await set(A, '#p_bearb', 'A. Cortese'); await A.waitForTimeout(700);
  const k = await A.evaluate(() => JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')).kopf);
  ok(k.projekt === 'Projekt A' && k.ort === 'Chur' && k.bearb === 'A. Cortese', 'abwechselnd in zwei Tabs gearbeitet: nichts geht verloren ' + JSON.stringify({ p: k.projekt, o: k.ort, b: k.bearb }));
  // 3) Konflikt: Tab B hat einen offenen Dialog → Hinweis, kein stilles Überschreiben
  await B.click('#bReport'); await B.waitForTimeout(500);
  await set(A, '#p_sap', '4711'); await A.waitForTimeout(700);
  const ban = B.locator('.tabsync[role=alert]'); ok(await ban.count() === 1 && await ban.isVisible(), 'Tab mit offenem Dialog: Hinweis «in anderem Fenster geändert»');
  await B.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) d.close(); });
  await set(B, '#p_bem', 'aus B'); await B.waitForTimeout(700);
  let st = await A.evaluate(() => JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')).kopf);
  ok(st.sap === '4711' && !st.bem && /Nicht gespeichert/.test(await B.textContent('#saveState')), 'solange der Hinweis offen ist, überschreibt Tab B nichts');
  await ban.locator('[data-sy=load]').click(); await B.waitForTimeout(1500);
  ok(await B.inputValue('#p_sap') === '4711' && await B.locator('.tabsync').count() === 0, '«Stand des anderen Fensters laden» zeigt den aktuellen Stand');
  ok(A.errs.length === 0 && B.errs.length === 0, 'keine JS-Fehler ' + A.errs.concat(B.errs).join('|')); await b.close();
})();
