/* t68: Qualitätscheck Paket 1 – PDF ohne eval (CVE-2024-4367), Laden mit Rückfrage/Rückgängig/Prüfung, Speicherfehler über der Karte, negative Eingaben markiert */
const { chromium, ok, mk, getS, tmp, INDEX } = require('./lib/k.js');
const fs = require('fs'), path = require('path');
(async () => {
  const html = fs.readFileSync(INDEX.replace('file://', ''), 'utf8');
  ok(/getDocument\(\{ data: buf, isEvalSupported: false \}\)/.test(html) && (html.match(/getDocument\(/g) || []).length === 1, 'pdf.js: einzige getDocument-Stelle mit isEvalSupported:false');
  const b = await chromium.launch(); const pg = await mk(b, 1400, 1000); const dl = [];
  pg.removeAllListeners('dialog'); let answer = true; pg.on('dialog', d => { dl.push(d.type() + ': ' + d.message().slice(0, 60)); answer ? d.accept() : d.dismiss(); });
  await pg.evaluate(() => { window.__LVD.loadDemo(); }); await pg.waitForTimeout(1500); dl.length = 0;
  const demo = await getS(pg), other = tmp('t68_other.json'), bad = tmp('t68_bad.json');
  fs.writeFileSync(other, JSON.stringify({ data: Object.assign(JSON.parse(JSON.stringify(demo)), { kopf: Object.assign({}, demo.kopf, { projekt: 'ANDERES PROJEKT' }), mwst: '7.7' }) }));
  // Abbrechen: nichts ändert sich
  answer = false; await pg.setInputFiles('#fileIn', other); await pg.waitForTimeout(800);
  ok(dl.some(m => /^confirm: Aktuelles Projekt durch die Datei ersetzen/.test(m)) && (await getS(pg)).kopf.projekt === demo.kopf.projekt, 'Laden fragt nach; «Abbrechen» lässt das Projekt unverändert');
  // Bestätigen: ersetzt, Rückgängig stellt alles wieder her (inkl. Kopf und MWST)
  answer = true; dl.length = 0; await pg.setInputFiles('#fileIn', other); await pg.waitForTimeout(900);
  ok((await getS(pg)).kopf.projekt === 'ANDERES PROJEKT', 'Laden nach Bestätigung ersetzt das Projekt');
  await pg.locator('.kmtoast', { hasText: 'Projekt aus Datei geladen' }).locator('button').click(); await pg.waitForTimeout(800);
  const back = await getS(pg); ok(back.kopf.projekt === demo.kopf.projekt && back.mwst === demo.mwst && JSON.stringify(back.recs) === JSON.stringify(demo.recs), 'Rückgängig stellt Projekt, Kopf, MWST und Datensätze wieder her');
  // Beschädigte Dateien: abgelehnt, Projekt unverändert
  for (const [n, o] of [['recs leer', { v: 2, recs: {} }], ['graben kein Array', { v: 2, recs: { graben: 5 } }], ['kein JSON', '{oh']]) {
    fs.writeFileSync(bad, typeof o === 'string' ? o : JSON.stringify(o)); dl.length = 0; await pg.setInputFiles('#fileIn', bad); await pg.waitForTimeout(700);
    const s = await getS(pg); ok(dl.some(m => /^alert: JSON/.test(m)) && s.kopf.projekt === demo.kopf.projekt && JSON.stringify(s.recs) === JSON.stringify(demo.recs), 'beschädigte Datei (' + n + '): Meldung, Projekt unverändert');
  }
  // Leeres Projekt: kein unnötiges Nachfragen
  const p2 = await mk(b, 1400, 1000); const d2 = []; p2.removeAllListeners('dialog'); p2.on('dialog', d => { d2.push(d.type()); d.accept(); });
  await p2.setInputFiles('#fileIn', other); await p2.waitForTimeout(900);
  ok(!d2.includes('confirm') && (await getS(p2)).kopf.projekt === 'ANDERES PROJEKT', 'leeres Projekt: Laden ohne Rückfrage');
  // Negative Eingabe markiert
  await pg.fill('#f_graben_L', '-10'); await pg.waitForTimeout(200);
  ok(await pg.getAttribute('#f_graben_L', 'aria-invalid') === 'true', 'negative Länge wird markiert');
  await pg.fill('#f_graben_L', '150.1'); await pg.waitForTimeout(200); ok(await pg.getAttribute('#f_graben_L', 'aria-invalid') === null, 'gültige Länge ohne Markierung');
  // Speicherfehler über der Karte (Layout A)
  await pg.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await pg.reload();
  for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250);
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { const o = Storage.prototype.setItem; window.__full = true; Storage.prototype.setItem = function (k, v) { if (k === 'lv-devis-tiefbau-v2' && window.__full) { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; });
  await pg.click('.kmheadb [data-k=save]'); await pg.waitForTimeout(700);
  const ban = pg.locator('dialog.kmlya .kmsaveerr[role=alert]');
  ok(await ban.count() === 1 && await ban.isVisible() && /Automatisches Speichern nicht möglich/.test(await ban.textContent()), 'Speicherfehler erscheint sichtbar über der Karte');
  await pg.evaluate(() => { window.__full = false; }); await pg.click('.kmheadb [data-k=save]'); await pg.waitForTimeout(700);
  ok(await ban.count() === 0, 'nach erfolgreichem Speichern verschwindet die Meldung');
  ok(pg.errs.length === 0 && p2.errs.length === 0, 'keine JS-Fehler ' + pg.errs.concat(p2.errs).join('|')); await b.close();
})();
