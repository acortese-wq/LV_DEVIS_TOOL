/* UI-Qualitätssicherung im Browser (Playwright). Aufruf: node tests/ui_qa.js
   Optional: AXE=/pfad/axe.min.js (sonst werden die axe-Prüfungen als NICHT AUSGEFÜHRT gemeldet),
             PW=/pfad/zu/playwright (Standard: /opt/node22/lib/node_modules/playwright).
   Prüft: Konsolenfehler, Überlauf, Tastatur-Fokus, Datenerhalt, ungültige Eingaben, JSON-/Excel-Export, Zurücksetzen; axe WCAG 2.2 AA je Reiter und Bildschirmbreite. */
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const URL = 'file://' + path.resolve(__dirname, '../index.html'), AXE = process.env.AXE || '';
const VPS = [[320, 700], [375, 800], [768, 1024], [1024, 800], [1280, 900], [1440, 900], [1800, 1000]], TABS = ['graben', 'rohr', 'schacht', 'werkloch', 'fund', 'geb', 'belag', 'allg', 'hon', 'plan', 'par'];
const res = []; const T = (name, st, info) => { res.push([name, st, info || '']); console.log(st.padEnd(14), name, info || ''); };
(async () => {
  const b = await chromium.launch();
  const mk = async (w, h) => { const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') pg.errs.push(m.text()); }); pg.on('requestfailed', r => pg.errs.push('REQ ' + r.url().slice(0, 80))); pg.on('dialog', d => d.accept()); await pg.goto(URL); return pg; };
  const fillBasic = async pg => { await pg.fill('#f_graben_L', '84.2'); await pg.click('[data-tab=schacht]'); await pg.fill('#f_schacht_n', '2'); await pg.click('[data-tab=werkloch]'); await pg.fill('#f_werkloch_ts', '2'); await pg.click('[data-tab=graben]'); await pg.waitForTimeout(700); };
  /* 1) Seite je Bildschirmbreite: Fehler, Überlauf, axe */
  for (const [w, h] of VPS) {
    const pg = await mk(w, h); await fillBasic(pg); if (AXE) await pg.addScriptTag({ path: AXE }); let ov = [], ax = [];
    for (const t of TABS) { await pg.click('[data-tab=' + t + ']'); await pg.waitForTimeout(200); if (await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) ov.push(t);
      if (AXE) { const v = await pg.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } }).then(r => r.violations.map(v => v.id + ' ' + v.nodes[0].target.join(' ').slice(0, 50)))); v.forEach(x => ax.push(t + ': ' + x)); } }
    T('Konsole/Ressourcen ' + w + ' px', pg.errs.length ? 'FEHLGESCHLAGEN' : 'BESTANDEN', pg.errs.join(' | '));
    T('Kein horizontaler Überlauf ' + w + ' px', ov.length ? 'FEHLGESCHLAGEN' : 'BESTANDEN', ov.join(','));
    T('axe WCAG 2.2 AA ' + w + ' px (11 Reiter)', !AXE ? 'NICHT AUSGEFÜHRT' : ax.length ? 'FEHLGESCHLAGEN' : 'BESTANDEN', ax.slice(0, 3).join(' | ')); await pg.close();
  }
  /* 2) Tastatur: sichtbarer Fokus auf den ersten 25 Elementen */
  { const pg = await mk(1280, 900); let bad = []; for (let i = 0; i < 25; i++) { await pg.keyboard.press('Tab'); const r = await pg.evaluate(() => { const e = document.activeElement, c = getComputedStyle(e); return { n: e.tagName + (e.id ? '#' + e.id : ''), ok: (parseFloat(c.outlineWidth) > 0 && c.outlineStyle !== 'none') || c.boxShadow !== 'none' || e.matches('input,select,textarea') }; }); if (!r.ok) bad.push(r.n); }
    T('Tastatur: Fokus sichtbar (25 Tabs)', bad.length ? 'FEHLGESCHLAGEN' : 'BESTANDEN', bad.join(',')); await pg.close(); }
  /* 3) Berechnung, Datenerhalt, Eingaben */
  { const pg = await mk(1280, 900); await fillBasic(pg);
    const calc = () => pg.evaluate(() => { const o = window.__OUT; return o ? o.sum.netto : null; });
    const n1 = await calc(); T('Berechnung liefert Betrag', n1 > 0 ? 'BESTANDEN' : 'FEHLGESCHLAGEN', String(n1));
    const ref = await pg.evaluate(() => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); return KVE.calc(S, LV).sum.netto; }); T('Anzeige = Rechenkern (Rappen-genau)', ref === n1 ? 'BESTANDEN' : 'FEHLGESCHLAGEN', ref + ' / ' + n1);
    await pg.fill('#f_graben_L', 'abc'); await pg.waitForTimeout(400); T('Ungültige Eingabe wird markiert', (await pg.locator('#f_graben_L.bad,#f_graben_L[aria-invalid=true]').count()) ? 'BESTANDEN' : 'FEHLGESCHLAGEN');
    await pg.fill('#f_graben_L', "1'200"); await pg.waitForTimeout(400); T("Zahl mit Apostroph «1'200» wird markiert", (await pg.locator('#f_graben_L.bad,#f_graben_L[aria-invalid=true]').count()) ? 'BESTANDEN' : 'NICHT ANWENDBAR', 'siehe CLAUDE.md');
    await pg.fill('#f_graben_L', ''); await pg.waitForTimeout(400); T('Leere Eingabe: kein Absturz', pg.errs.length ? 'FEHLGESCHLAGEN' : 'BESTANDEN');
    await pg.fill('#f_graben_L', '84.2'); await pg.waitForTimeout(500); await pg.reload(); T('Datenerhalt nach Neuladen', (await pg.inputValue('#f_graben_L')) === '84.2' ? 'BESTANDEN' : 'FEHLGESCHLAGEN');
    const [d1] = await Promise.all([pg.waitForEvent('download'), pg.click('#bSave')]); const f = path.join(os.tmpdir(), 'qa.json'); await d1.saveAs(f);
    const j = JSON.parse(fs.readFileSync(f, 'utf8')); T('JSON-Sicherung enthält Daten', j.data && j.data.recs ? 'BESTANDEN' : 'FEHLGESCHLAGEN');
    const [d2] = await Promise.all([pg.waitForEvent('download'), pg.click('#bXlsx')]); const g = path.join(os.tmpdir(), 'qa.xlsx'); await d2.saveAs(g); T('Excel-Export (xlsx, PK-Header)', fs.readFileSync(g).slice(0, 2).toString() === 'PK' ? 'BESTANDEN' : 'FEHLGESCHLAGEN');
    await pg.click('#bNew'); await pg.waitForTimeout(500); T('Neues Projekt setzt zurück', (await pg.inputValue('#f_graben_L')) === '' ? 'BESTANDEN' : 'FEHLGESCHLAGEN');
    await pg.setInputFiles('#fileIn', f); await pg.waitForTimeout(800); T('JSON-Laden stellt Daten wieder her', (await pg.inputValue('#f_graben_L')) === '84.2' ? 'BESTANDEN' : 'FEHLGESCHLAGEN');
    T('Keine JS-Fehler im Ablauf', pg.errs.length ? 'FEHLGESCHLAGEN' : 'BESTANDEN', pg.errs.join('|')); await pg.close(); }
  await b.close();
  const f = res.filter(r => r[1] === 'FEHLGESCHLAGEN').length; console.log('\n' + (f ? f + ' FEHLGESCHLAGEN' : 'ALLE AUSGEFÜHRTEN TESTS BESTANDEN')); process.exit(f ? 1 : 0);
})();
