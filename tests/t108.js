/* t108: Handlungsfreiheit – «Neues Projekt» ohne Bestätigungsdialog, dafür «Rückgängig» stellt das ganze Projekt (inkl. Projektkopf) wieder her */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1280, 900); let dialogs = 0;
  pg.removeAllListeners('dialog'); pg.on('dialog', d => { dialogs++; d.dismiss(); });
  await pg.fill('#f_graben_L', '42'); await pg.evaluate(() => { const e = document.querySelector('#p_projekt'); e.value = 'Testprojekt Undo'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForTimeout(400);
  await pg.click('#bNew'); await pg.waitForTimeout(600);
  ok(dialogs === 0, 'kein Bestätigungsdialog (' + dialogs + ')');
  ok((await pg.inputValue('#f_graben_L')) === '' && (await pg.inputValue('#p_projekt')) === '', 'Projekt ist zurückgesetzt');
  const t = await pg.evaluate(() => { const e = [...document.querySelectorAll('.kmtoast')].pop(); return e ? e.textContent : ''; }); ok(/Rückgängig/.test(t), 'Hinweis mit «Rückgängig» (' + t.slice(0, 60) + ')');
  await pg.evaluate(() => { const bt = [...document.querySelectorAll('.kmtoast button')].pop(); if (bt) bt.click(); }); await pg.waitForTimeout(600);
  ok((await pg.inputValue('#f_graben_L')) === '42' && (await pg.inputValue('#p_projekt')) === 'Testprojekt Undo', 'Rückgängig stellt Eingaben und Projektkopf wieder her');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
