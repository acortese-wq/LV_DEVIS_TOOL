/* t133: Fotodokumentation, Rolle AQM und Machbarkeitsbericht (V145)
   - Foto an einem Schacht («Foto»-Knopf im Objekt): Bild wird auf 1600 px verkleinert, im Gerät (IndexedDB) und im Projekt (Zeit, Lage, Bemerkung) gespeichert
   - freies Foto am GPS-Standort («Foto hier» in der Standortanzeige) → Kamerazeichen auf der Karte
   - Fotos bleiben nach Neuladen erhalten; JSON-Sicherung enthält die Bilder, Laden stellt sie wieder her
   - Bericht: Fotodokumentation; Berichtsart «Machbarkeit» mit Beurteilung von Hand, Prüfpunkten, Rolle AQM, Grobkosten und Kreisdiagrammen
   - Handy (390 px): Fotobetrachter ohne Überlauf */
const K = require('./lib/k.js'), { chromium, ok, INDEX, fs } = K;
const URL0 = process.env.LVD_URL || INDEX;
(async () => {
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, geolocation: { latitude: 46.8530, longitude: 9.5293, accuracy: 6 }, permissions: ['geolocation'] });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { window.__LVD_LAYOUT_DEFAULT = 'classic'; window.__LVD_RIBBON_DEFAULT = 'min'; window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.goto(URL0); await pg.waitForTimeout(800);
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  // Testbild 3000 × 2000 (JPEG) im Browser erzeugen
  const big = Buffer.from(await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 3000, 2000); gr.addColorStop(0, '#0b6b72'); gr.addColorStop(1, '#eda100'); g.fillStyle = gr; g.fillRect(0, 0, 3000, 2000); for (let i = 0; i < 4000; i++) { g.fillStyle = 'hsl(' + (i * 37 % 360) + ',60%,50%)'; g.fillRect((i * 733) % 3000, (i * 419) % 2000, 18, 18); } return c.toDataURL('image/jpeg', 0.95).split(',')[1]; }), 'base64');
  const openMap = async (p) => { await p.click('#kmOpen'); for (let t = 0; t < 40 && !(await p.locator('dialog[open]').count()); t++) await p.waitForTimeout(250); await p.waitForTimeout(1200); };
  await openMap(pg);
  const putShaft = async (p) => { await p.evaluate(() => document.querySelector('[data-k=mpt]').click()); await p.waitForTimeout(200); const bb = await p.locator('#kmMap').boundingBox(); await p.mouse.click(bb.x + bb.width * 0.4, bb.y + bb.height * 0.5); await p.waitForTimeout(500); await p.evaluate(() => { const e = document.querySelector('[data-k=medit]'); if (e) e.click(); }); await p.waitForTimeout(300); };
  await putShaft(pg);
  const sid = await pg.evaluate(() => window.__KM.M().pts.filter(p => p.mode !== 'abz')[0].id);
  ok(await pg.locator('[data-foto="' + sid + '"]').count() === 1, 'Objekt (Schacht 1) hat einen Knopf «Foto»');
  // 1) Foto an Schacht 1
  let fc = pg.waitForEvent('filechooser'); await pg.evaluate(id => document.querySelector('[data-foto="' + id + '"]').click(), sid);
  await (await fc).setFiles({ name: 'schacht.jpg', mimeType: 'image/jpeg', buffer: big });
  await pg.waitForSelector('#kmFv[open] .kmfv-img img[src^="data:image/jpeg"]', { timeout: 10000 });
  const v1 = await pg.evaluate(() => { const im = document.querySelector('#kmFv img'), S = window.__LVD.S(), f = S.fotos[0]; return { w: im.naturalWidth, h: im.naturalHeight, kb: Math.round(im.src.length * 0.75 / 1024), n: S.fotos.length, f, t: document.querySelector('#kmFvT').textContent, m: document.querySelector('.kmfv-m').textContent }; });
  ok(v1.n === 1 && v1.f.obj === sid && v1.f.src === 'obj' && Array.isArray(v1.f.pt) && /^\d{4}-/.test(v1.f.t), 'Foto im Projekt: Objekt, Lage, Zeitpunkt (' + v1.f.t + ')');
  ok(v1.w === 1600 && v1.h === 1067 && v1.kb <= 330, 'verkleinert auf 1600 × 1067 px, ' + v1.kb + ' KB');
  ok(/Foto 1 · Schacht 1/.test(v1.t) && /Aufnahme: \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/.test(v1.m) && /Standort: E [\d’']+ \/ N/.test(v1.m), 'Betrachter: Titel, Datum/Uhrzeit, Koordinate · ' + v1.m.replace(/\s+/g, ' '));
  await pg.fill('#kmFv textarea', 'Deckel gerissen, Rahmen lose'); await pg.click('#kmFv button[value=ok]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => window.__LVD.S().fotos[0].note) === 'Deckel gerissen, Rahmen lose', 'Bemerkung gespeichert');
  await pg.waitForTimeout(400);
  ok(await pg.evaluate(id => { const im = document.querySelector('[data-fv="' + id + '"] img'); return !!im && /^data:image\/jpeg/.test(im.src); }, v1.f.id), 'Vorschaubild im Objekt');
  // 2) freies Foto am GPS-Standort
  await pg.click('.kmgpsc a[data-k=gps]'); await pg.waitForTimeout(1200);
  fc = pg.waitForEvent('filechooser'); await pg.click('.kmgps [data-gps=foto]'); await (await fc).setFiles({ name: 'frei.jpg', mimeType: 'image/jpeg', buffer: big });
  await pg.waitForSelector('#kmFv[open]', { timeout: 10000 }); await pg.click('#kmFv button[value=ok]'); await pg.waitForTimeout(400);
  const f2 = await pg.evaluate(() => { const S = window.__LVD.S(), f = S.fotos[1], ll = window.__KM.ll(f.pt); return { f, d: L.latLng(ll).distanceTo([46.8530, 9.5293]), mk: document.querySelectorAll('#kmMap .kmftm').length, lbl: (document.querySelector('#kmMap .kmftm') || {}).getAttribute && document.querySelector('#kmMap .kmftm').getAttribute('aria-label') }; });
  ok(f2.f.obj === null && f2.f.src === 'gps' && f2.f.acc === 6 && f2.d < 1, 'freies Foto am GPS-Standort (± 6 m, Abweichung ' + f2.d.toFixed(2) + ' m)');
  ok(f2.mk === 1 && /Foto 2 ansehen/.test(f2.lbl), 'Kamerazeichen auf der Karte, bedienbar («' + f2.lbl + '»)');
  await pg.click('#kmMap .kmftm'); await pg.waitForSelector('#kmFv[open]');
  await pg.addScriptTag({ path: K.AXE }); const ax0 = await pg.evaluate(() => axe.run('#kmFv').then(r => r.violations.map(v => v.id + ' ' + v.nodes[0].target)));
  ok(ax0.length === 0, 'Fotobetrachter ohne axe-Verstösse ' + ax0.join('|')); ok(/Foto 2 · Fotopunkt/.test(await pg.textContent('#kmFvT')), 'Klick auf Kamerazeichen öffnet Foto 2');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  ok((await pg.locator('#kmFv').count()) === 0 && (await pg.locator('dialog.kmdlg[open]').count()) === 1, 'Escape schliesst nur den Fotobetrachter');
  await pg.click('.kmgps [data-gps=off]');
  await pg.evaluate(() => document.querySelector('[data-k=apply]').click()); await pg.waitForTimeout(1200);
  // 3) Neu laden: Bilder aus dem Gerätespeicher
  const ids = await pg.evaluate(() => window.__LVD.S().fotos.map(f => f.id));
  await pg.reload(); await pg.waitForTimeout(1500);
  const re = await pg.evaluate(ids => Promise.all(ids.map(id => FOTO.get(id))).then(a => ({ n: window.__LVD.S().fotos.length, ok: a.every(u => /^data:image\/jpeg/.test(u || '')) })), ids);
  ok(re.n === 2 && re.ok, 'nach Neuladen: 2 Fotos mit Bildern aus dem Gerätespeicher');
  // 4) JSON-Sicherung mit Bildern, Laden stellt sie wieder her
  const dl = pg.waitForEvent('download'); await pg.evaluate(() => document.querySelector('#bSave').click());
  const d = await dl, pth = await d.path(), J = JSON.parse(fs.readFileSync(pth, 'utf8'));
  ok(J.data.fotos.length === 2 && Object.keys(J.data.fotosImg || {}).length === 2 && Object.values(J.data.fotosImg).every(u => /^data:image\/jpeg;base64,/.test(u)), 'JSON-Sicherung enthält 2 Fotos mit Bild (' + Math.round(fs.statSync(pth).size / 1024) + ' KB)');
  await pg.evaluate(ids => Promise.all(ids.map(id => FOTO.del(id))), ids);
  pg.once('dialog', x => x.accept()); await pg.setInputFiles('#fileIn', pth); await pg.waitForTimeout(1500);
  const back = await pg.evaluate(ids => Promise.all(ids.map(id => FOTO.get(id))).then(a => ({ ok: a.every(u => /^data:image\/jpeg/.test(u || '')), img: 'fotosImg' in window.__LVD.S() })), ids);
  ok(back.ok && !back.img, 'Laden der Sicherung legt die Bilder wieder im Gerät ab (nicht im Projektzustand)');
  // 5) Rolle AQM + Machbarkeitsbericht
  await pg.evaluate(() => { const S = window.__LVD.S(); S.kopf.bearb = 'M. Muster'; S.kopf.rolle = 'aqm'; });
  const openRp = async () => { await pg.evaluate(() => { const b0 = document.querySelector('[data-ly=rep], #rpOpen'); if (b0) b0.click(); }); await pg.waitForTimeout(300); if (!(await pg.locator('#reportDlg[open]').count())) { await pg.click('#sExp').catch(() => { }); await pg.click('#bReport').catch(() => { }); await pg.waitForTimeout(500); } };
  await openRp(); ok(await pg.locator('#reportDlg[open]').count() === 1, 'Berichtsdialog offen');
  ok(await pg.locator('#reportDlg input[data-rp=foto]').isChecked(), 'Inhalt «Fotodokumentation» vorgewählt');
  await pg.check('#reportDlg input[name=rpa][value=mb]');
  const dv = await pg.evaluate(() => ({ gl: document.querySelector('#reportDlg [data-rpx=pb]').hidden, mb: [...document.querySelectorAll('#reportDlg fieldset[data-rpx=mb]')].every(f => !f.hidden), pk: document.querySelectorAll('#reportDlg [data-mbp]').length, hint: document.querySelector('#reportDlg fieldset[data-rpx=mb] .hint').textContent }));
  ok(dv.gl && dv.mb && dv.pk >= 1 && /Vorschlag NIUcost: bedingt machbar/.test(dv.hint), 'Machbarkeit: Beurteilung + ' + dv.pk + ' vorgeschlagene Prüfpunkte, ' + dv.hint);
  await pg.addScriptTag({ path: K.AXE }); const ax1 = await pg.evaluate(() => axe.run('#reportDlg').then(r => r.violations.map(v => v.id + ' ' + v.nodes[0].target)));
  ok(ax1.length === 0, 'Berichtsdialog (Machbarkeit) ohne axe-Verstösse ' + ax1.join('|'));
  await pg.check('#reportDlg input[name=mbu][value=bedingt]'); await pg.fill('#rpMbT', 'Machbar, sofern die Werkleitungen im Trottoir vorgängig sondiert werden.'); await pg.fill('#rpMbE', 'Verkehrsdienst Gemeinde anfragen');
  await pg.uncheck('#reportDlg [data-mbp="0"]'); const pk0 = await pg.evaluate(() => document.querySelector('#reportDlg [data-mbp="0"]').parentElement.textContent.trim());
  await pg.click('#rpGo'); await pg.waitForTimeout(1500);
  const R = await pg.evaluate(() => { const d = document.querySelector('#reportDoc'); return { h1: d.querySelector('h1').textContent, meta: d.querySelector('.rp-meta').textContent, u: d.querySelector('.rp-mb-u').className + '|' + d.querySelector('.rp-mb-u').textContent, t: (d.querySelector('.rp-mb-t') || {}).textContent, pk: [...d.querySelectorAll('.rp-mbp li')].map(l => l.textContent), ft: [...d.querySelectorAll('.rp-ft')].map(f => ({ img: !!f.querySelector('img[src^="data:image/jpeg"]'), cap: f.querySelector('figcaption').textContent })), k: [...d.querySelectorAll('.rp-mbk tr')].map(r => r.textContent), pies: d.querySelectorAll('svg.rp-pie').length, foot: d.querySelector('.rp-foot').textContent, printed: window.__printed, mb: window.__LVD.S().mb, secs: [...d.querySelectorAll('section')].map(s => s.className) }; });
  ok(R.h1 === 'Machbarkeitsbericht' && /M\. Muster \(AQM\)/.test(R.meta), 'Machbarkeitsbericht mit Bearbeiter «M. Muster (AQM)»');
  ok(/rp-mb-bedingt/.test(R.u) && /Bedingt machbar/.test(R.u) && /sondiert/.test(R.t), 'Beurteilung «Bedingt machbar» mit Begründung');
  ok(R.pk.indexOf(pk0) < 0 && R.pk.indexOf('Verkehrsdienst Gemeinde anfragen') >= 0, 'Prüfpunkte: abgewählter Vorschlag fehlt, eigener Punkt dabei (' + R.pk.length + ')');
  ok(R.ft.length === 2 && R.ft.every(f => f.img) && /Foto 1 · Schacht 1/.test(R.ft[0].cap) && /Deckel gerissen/.test(R.ft[0].cap) && /± 6 m/.test(R.ft[1].cap), 'Fotodokumentation: 2 Bilder mit Objekt, Datum, Koordinate, Bemerkung ' + JSON.stringify(R.ft.map(f => f.cap)));
  ok(R.k.length === 4 && /Total inkl\. MWST.*CHF/.test(R.k[3]) && /MWST 8\.1 %/.test(R.k[2]) && R.pies === 2, 'Grobkosten (4 Zeilen) und 2 Kreisdiagramme ' + JSON.stringify(R.k) + ' ' + R.pies);
  ok(/Alessandro Cortese/.test(R.foot) && R.printed >= 1, 'Fusszeile mit Urheber, Druck ausgelöst');
  ok(R.mb.u === 'bedingt' && R.mb.aus.length === 1 && /Verkehrsdienst/.test(R.mb.eigene), 'Beurteilung im Projekt gespeichert');
  // Projektbericht enthält die Fotos ebenfalls
  await openRp(); ok(await pg.locator('#reportDlg input[name=rpa][value=mb]').isChecked(), 'Berichtsart bleibt gewählt');
  await pg.check('#reportDlg input[name=rpa][value=pb]'); await pg.click('#rpGo'); await pg.waitForTimeout(1500);
  ok(await pg.evaluate(() => document.querySelector('#reportDoc h1').textContent === 'Projektbericht' && document.querySelectorAll('#reportDoc .rp-ft img').length === 2), 'Projektbericht mit Fotodokumentation');
  // Rolle-Auswahl im Kopf enthält AQM
  ok(await pg.evaluate(() => [...document.querySelectorAll('#p_rolle option')].map(o => o.textContent).join('|')).then(t => /AQM/.test(t) && /Projektleiter/.test(t) && /BHV/.test(t)), 'Rolle: BHV, AQM, Projektleiter … wählbar');
  // 6) Handy: Fotobetrachter
  const ph = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const pm = await ph.newPage(); pm.on('pageerror', e => errs.push(e.message));
  await pm.addInitScript(() => { window.__LVD_LAYOUT_DEFAULT = 'classic'; window.__LVD_RIBBON_DEFAULT = 'min'; });
  await pm.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pm.goto(URL0); await pm.waitForTimeout(800); await pm.evaluate(() => window.__LVD.loadDemo()); await pm.waitForTimeout(800);
  await pm.evaluate(() => document.querySelector('#kmOpen').click()); for (let t = 0; t < 40 && !(await pm.locator('dialog[open]').count()); t++) await pm.waitForTimeout(250); await pm.waitForTimeout(1200);
  await pm.evaluate(() => { const M = window.__KM.M(), c = window.__KM.map().getCenter(); M.pts.push({ id: 'pX', pt: [2759500, 1190900], typ: '', mode: 'neu' }); window.__KM.refresh(); });
  const sid2 = 'pX';
  fc = pm.waitForEvent('filechooser'); await pm.evaluate(id => document.querySelector('[data-foto="' + id + '"]').click(), sid2); await (await fc).setFiles({ name: 'a.jpg', mimeType: 'image/jpeg', buffer: big });
  await pm.waitForSelector('#kmFv[open] img[src^="data:image/jpeg"]', { timeout: 10000 });
  const mv = await pm.evaluate(() => { const r = document.querySelector('#kmFv').getBoundingClientRect(), i = document.querySelector('#kmFv img').getBoundingClientRect(); return { l: r.left, r: r.right, ir: i.right, w: innerWidth, ov: document.documentElement.scrollWidth > innerWidth + 1 }; });
  ok(mv.l >= 0 && mv.r <= mv.w && mv.ir <= mv.r && !mv.ov, 'Handy: Fotobetrachter passt (' + Math.round(mv.l) + '–' + Math.round(mv.r) + ' px), kein Überlauf');
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
