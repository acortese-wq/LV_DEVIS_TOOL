/* t72: Höhenprofil folgt der aktiven Linie (Höhen sofort laden), Mehrfachauswahl aneinandergereiht; Sprache im Planungsfokus; Übersetzungen vollständig */
const { chromium, ok, mk } = require('./lib/k.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
(async () => {
  // 1) Übersetzungen: alle Schlüssel in DE/FR/IT/EN vorhanden (App, Schacht-Assistent, Schacht-Bezeichnungen)
  const H = path.join(__dirname, '..', 'src'), C = { console }; C.window = C; vm.createContext(C);
  ['i18n_kv.js', 'schacht_data.js', 'schacht_i18n.js', 'i18n_app.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(H, f), 'utf8') + (f === 'schacht_i18n.js' ? ';this.TS=TS;' : f === 'schacht_data.js' ? ';this.SP=SP;this.SHAFTS=SHAFTS;' : ''), C));
  const miss = []; Object.keys(C.T.de).forEach(k => { const v = C.T.de[k]; if (typeof v !== 'string' || !v) return; ['fr', 'it', 'en'].forEach(l => { const w = C.T[l][k]; if (w == null || (w === '' && !/^ch_deOnly$/.test(k))) miss.push(l + ':' + k); }); });
  ok(miss.length === 0, 'App-Texte in allen 4 Sprachen (' + Object.keys(C.T.de).length + ' Schlüssel) ' + miss.slice(0, 8).join(','));
  const tsMiss = Object.keys(C.TS.de).filter(k => ['fr', 'it', 'en'].some(l => !C.TS[l] || C.TS[l][k] == null));
  ok(tsMiss.length === 0, 'Schacht-Assistent in allen 4 Sprachen ' + tsMiss.slice(0, 8).join(','));
  const src = fs.readFileSync(path.join(H, 'schacht_data.js'), 'utf8'), nDe = (src.match(/\{de:"/g) || []).length, nEn = (src.match(/,en:"/g) || []).length;
  ok(nDe > 40 && nDe === nEn, 'Schacht-Bezeichnungen mit Englisch (' + nEn + '/' + nDe + ')');
  // 2) Profil folgt der Auswahl, lädt Höhen sofort
  const b = await chromium.launch(); const pg = await mk(b, 1500, 1000); let prof = 0;
  await pg.route('**/profile.json**', async r => { prof++; const u = new URL(r.request().url()), g = JSON.parse(u.searchParams.get('geom')), n = +u.searchParams.get('nb_points') || 5; let L = 0; const c = g.coordinates; for (let i = 1; i < c.length; i++) L += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
    await r.fulfill({ json: Array.from({ length: n }, (_, i) => ({ dist: L * i / (n - 1), alts: { COMB: 600 + i * 0.5 } })), headers: { 'access-control-allow-origin': '*' } }); });
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-km-hzauto', '0'); }); await pg.waitForTimeout(1500);
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(1500);
  // zwei neue Linien ohne Höhen
  await pg.evaluate(() => { const K = window.__KM, M = K.M(); M.lines.push({ id: 'tx1', pts: [[2759000, 1191100], [2759080, 1191100]], rid: null, rohr: { sys: 'k55', dn: '55', len: '10', n: '1' }, cfg: { rt: {}, art: 'kies', fl: '', T: '', B: '' } }, { id: 'tx2', pts: [[2759080, 1191100], [2759080, 1191160]], rid: null, rohr: { sys: 'k55', dn: '55', len: '10', n: '1' }, cfg: { rt: {}, art: 'kies', fl: '', T: '', B: '' } }); K.refresh(); });
  await pg.waitForTimeout(800); ok(prof === 0, 'ohne Auswahl und mit «automatisch laden» aus: keine Höhenabfrage');
  await pg.click('[data-pfb]'); await pg.waitForTimeout(300);
  const clickLine = async (id, mod) => { const p = await pg.evaluate(id => { const K = window.__KM, l = K.M().lines.find(x => x.id === id), m = K.map(), a = K.ll(l.pts[0]), z = K.ll(l.pts[l.pts.length - 1]); const q = m.latLngToContainerPoint([(a[0] + z[0]) / 2, (a[1] + z[1]) / 2]), r = document.querySelector('#kmMap').getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; }, id); if (mod) await pg.keyboard.down(mod); await pg.mouse.click(p[0], p[1]); if (mod) await pg.keyboard.up(mod); await pg.waitForTimeout(900); };
  await pg.evaluate(() => { const K = window.__KM, m = K.map(); m.setView(K.ll([2759040, 1191120]), 19, { animate: false }); }); await pg.waitForTimeout(400);
  const p0 = prof; await clickLine('tx1');
  const st1 = await pg.evaluate(() => ({ sel: document.querySelector('[data-pf=line]').value, hz: !!window.__KM.M().lines.find(x => x.id === 'tx1').hz }));
  ok(st1.sel === 'tx1', 'Profil zeigt die angeklickte Linie');
  ok(prof > p0 && st1.hz, 'Höhen der aktiven Linie sofort geladen (auch mit «automatisch laden» aus)');
  await clickLine('tx2', 'Shift');
  const st2 = await pg.evaluate(() => ({ v: document.querySelector('[data-pf=line]').value, t: document.querySelector('[data-pf=line] option:checked').textContent, rows: document.querySelectorAll('#kmProf tbody tr').length }));
  ok(st2.v === '__sel' && /Auswahl: 2 Linien · 140/.test(st2.t) && st2.rows === 2, 'Umschalt-Klick: beide Linien aneinandergereiht (' + st2.t + ')');
  await pg.selectOption('[data-pf=line]', { index: 2 }); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => document.querySelector('[data-pf=line]').value) !== '__sel', 'manuelle Wahl im Auswahlfeld bleibt möglich');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  // 3) Sprache im Planungsfokus: wechseln ohne Verlust
  await pg.evaluate(() => { localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(1500); await pg.reload();
  for (let i = 0; i < 60 && !(await pg.locator('dialog.kmlya[open]').count()); i++) await pg.waitForTimeout(250); await pg.waitForTimeout(1200);
  ok(await pg.locator('dialog.kmlya [data-lylang]').count() === 4, 'Planungsfokus: Sprachknöpfe DE FR IT EN');
  await pg.click('[data-k=mpt]'); const bx = await pg.locator('#kmMap').boundingBox(); await pg.mouse.click(bx.x + bx.width * 0.25, bx.y + bx.height * 0.85); await pg.waitForTimeout(500);
  const n0 = await pg.evaluate(() => window.__KM.M().pts.length);
  await pg.click('[data-lylang=it]'); for (let i = 0; i < 40 && !(await pg.locator('dialog.kmlya[open] [data-lylang=it][aria-pressed=true]').count()); i++) await pg.waitForTimeout(250); await pg.waitForTimeout(1000);
  const r = await pg.evaluate(() => ({ lang: document.documentElement.lang, nav: document.querySelector('.lynav').textContent, pts: window.__KM.M().pts.length, dock: document.querySelector('.lydtabs').textContent, chat: (document.querySelector('.chnote') || {}).textContent || '' }));
  ok(r.lang === 'it' && /Progetto/.test(r.nav) && /Costi/.test(r.dock), 'Planungsfokus auf Italienisch neu aufgebaut');
  ok(r.pts === n0, 'gezeichneter Schacht bleibt beim Sprachwechsel erhalten (' + r.pts + ')');
  ok(!/solo in tedesco/.test(r.chat) && !/Regelbasiert/.test(r.chat), 'Assistent beschriftet sich mit (Beratungsinhalte übersetzt, kein Hinweis «nur Deutsch»)');
  await pg.click('[data-ly=proj]'); await pg.waitForTimeout(300); ok(await pg.locator('#lyAsk:visible').count() === 1, 'nicht übernommene Änderung bleibt gemerkt (Rückfrage beim Wechsel)');
  await pg.click('[data-lya=drop]'); await pg.waitForTimeout(500);
  ok(await pg.textContent('#t-creator') === 'Concetto dell’app e autore: Alessandro Cortese' && /Pavimentazione marciapiede/.test(await pg.evaluate(() => JSON.stringify(window.__LVD.tt('p_gehMin')))), 'Urheberzeile und Belagsparameter übersetzt');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
