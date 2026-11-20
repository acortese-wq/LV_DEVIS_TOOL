/* t138: UX-Runde 11/2026 P5 – ein Erscheinungsbild
   - Layout A: «Projekt» öffnet die Projektangaben als Seitenpanel (keine klassische Seite); Karte → Projekt → Karte ohne Layoutwechsel
   - Eingaben im Panel = dieselben Felder (Speicherung, Projektleiste folgt live), nach dem Schliessen wieder auf der Seite
   - Hell/Dunkel global (lvd-theme): gilt für Layout A, klassische Seite und Kartenfenster gleich; Druck bleibt hell
   - axe ohne Verstösse: Panel (dunkel/hell), klassische Seite dunkel */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX } = K;
const STUB = r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback();
(async () => {
  const b = await chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.addInitScript(() => { if (!sessionStorage.getItem('t138')) { localStorage.setItem('lvd-layout', 'a'); sessionStorage.setItem('t138', '1'); } window.__LVD_START_OFF = 1; });
  await pg.route('**/*', STUB); await pg.goto(process.env.LVD_URL || INDEX); await pg.waitForTimeout(2500);
  const state = () => pg.evaluate(() => ({ ly: !!document.querySelector('dialog.kmlya[open]'), dr: !!document.querySelector('#lyProjD'), inDr: !!document.querySelector('#lyProjD #p_projekt'), inKb: !!document.querySelector('#kopfbox #p_projekt'), y: scrollY, pref: localStorage.getItem('lvd-layout') }));
  // Karte → Projekt
  await pg.click('.lynav [data-ly=proj]'); await pg.waitForTimeout(400);
  let s = await state(); ok(s.ly && s.dr && s.inDr && !s.inKb && s.pref === 'a', 'Projekt öffnet das Seitenpanel in Layout A (kein Layoutwechsel)');
  ok(await pg.evaluate(() => document.querySelector('.lynav [data-ly=proj]').getAttribute('aria-expanded')) === 'true', 'Knopf «Projekt» zeigt den offenen Zustand');
  await pg.addScriptTag({ path: K.AXE });
  let ax = await pg.evaluate(() => axe.run('#lyProjD').then(r => r.violations.map(v => v.id + ' ' + v.nodes[0].target)));
  ok(ax.length === 0, 'Panel (dunkel) ohne axe-Verstösse ' + ax.join('|'));
  await pg.fill('#lyProjD #p_projekt', 'FTTH Chur Nord'); await pg.fill('#lyProjD #p_ort', 'Chur'); await pg.waitForTimeout(500);
  ok((await pg.textContent('#lyProj')) === 'FTTH Chur Nord' && (await pg.textContent('#lyOrt')) === 'Chur', 'Projektleiste folgt live');
  ok(await pg.evaluate(() => window.__LVD.S().kopf.projekt === 'FTTH Chur Nord' && window.__LVD.S().kopf.ort === 'Chur'), 'Eingaben im Projekt gespeichert (gleiche Felder)');
  // → Karte
  await pg.click('.lynav [data-ly=map]'); await pg.waitForTimeout(300);
  s = await state(); ok(s.ly && !s.dr && s.inKb && s.pref === 'a', 'Karte → Projekt → Karte: Panel zu, Felder zurück auf der Seite, Layout A bleibt');
  // Esc schliesst
  await pg.click('.lynav [data-ly=proj]'); await pg.waitForTimeout(300); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  s = await state(); ok(s.ly && !s.dr && s.inKb, 'Esc schliesst nur das Panel');
  // Thema global
  const th = () => pg.evaluate(() => ({ html: document.documentElement.classList.contains('nc-dark'), dlg: (document.querySelector('dialog.kmdlg[open]') || { classList: { contains: () => null } }).classList.contains('nc-dark'), bg: getComputedStyle(document.body).backgroundColor, ls: localStorage.getItem('lvd-theme') }));
  let t = await th(); ok(t.html && t.dlg, 'Vorgabe dunkel: Seite und Arbeitsplatz');
  await pg.click('dialog.kmlya .nc-theme'); await pg.waitForTimeout(400);
  t = await th(); ok(!t.html && !t.dlg && t.ls === 'light', 'Umschalten im Arbeitsplatz → hell für die ganze Seite');
  await pg.click('.lynav [data-ly=proj]'); await pg.waitForTimeout(300);
  ax = await pg.evaluate(() => axe.run('#lyProjD').then(r => r.violations.map(v => v.id + ' ' + v.nodes[0].target)));
  ok(ax.length === 0, 'Panel (hell) ohne axe-Verstösse ' + ax.join('|'));
  await pg.keyboard.press('Escape');
  // klassische Ansicht: gleiches Thema; dort umschalten → gilt wieder überall
  if (!(await pg.locator('#lySel').isVisible())) await pg.click('.lyviewm > summary');
  await pg.selectOption('#lySel', 'classic'); await pg.waitForTimeout(1500);
  t = await th(); ok(!t.html && /255, 255, 255|240, 241, 243|238, 241, 243/.test(t.bg), 'klassische Seite folgt dem Thema (hell, ' + t.bg + ')');
  await pg.click('#bTheme'); await pg.waitForTimeout(300);
  t = await th(); ok(t.html && t.ls === 'dark' && (await pg.getAttribute('#bTheme', 'aria-pressed')) === 'true', 'Knopf ☀︎/☾ auf der klassischen Seite schaltet global (dunkel)');
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1500);
  await pg.addScriptTag({ path: K.AXE });
  ax = await pg.evaluate(() => axe.run(document, { runOnly: ['color-contrast'] }).then(r => r.violations.map(v => v.id + ' ' + v.nodes[0].target)));
  ok(ax.length === 0, 'klassische Seite dunkel (Beispielprojekt): Kontrast ohne Verstösse ' + ax.join('|'));
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog.kmdlg[open]'); await pg.waitForTimeout(800);
  t = await th(); ok(t.dlg === true, 'Kartenfenster der klassischen Seite ebenfalls dunkel');
  await pg.click('dialog[open] [data-k=close]'); await pg.waitForTimeout(300);
  // Druck bleibt hell
  await pg.emulateMedia({ media: 'print' });
  const pb = await pg.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color]); await pg.emulateMedia({ media: 'screen' });
  ok(/255, 255, 255|240, 241, 243|238, 241, 243|rgba\(0, 0, 0, 0\)/.test(pb[0]) && !/247, 249, 250/.test(pb[1]), 'Druck bleibt hell (' + pb.join(' / ') + ')');
  // zurück in Layout A: dunkel
  await pg.click('#bLyMap'); for (let i = 0; i < 30 && !(await pg.locator('dialog.kmlya[open]').count()); i++) await pg.waitForTimeout(200); await pg.waitForTimeout(800);
  t = await th(); ok(t.html && t.dlg, 'Layout A übernimmt das dunkle Thema der klassischen Seite');
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
