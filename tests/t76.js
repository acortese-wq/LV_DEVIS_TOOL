/* t76: Assistent vollständig mehrsprachig – alle geführten Beratungen und Wissensantworten in FR/IT/EN ohne deutsche Textreste; Fragen in der jeweiligen Sprache */
const { chromium, ok, mk } = require('./lib/k.js');
const DE = /(^|[^A-Za-zÀ-ÿ])(der|die|das|und|nicht|mit|für|wird|werden|bei|oder|auf|einem|eine|sind|Schacht|Schächte|Leitung|Gebäude|Graben|Rohre?|Kabel|Trasse|Bauzone|Abstand|Empfehlung|Prüfung|Werke|Strasse)(?=$|[^A-Za-zÀ-ÿ])/;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1400, 1000);
  await pg.evaluate(() => { window.__LVD.loadDemo(); }); await pg.waitForTimeout(1200);
  await pg.click('#chFab'); await pg.waitForTimeout(300);
  const ids = await pg.evaluate(() => window.__LVCHAT.flows());
  ok(ids.length >= 20, 'geführte Beratungen vorhanden: ' + ids.length);
  for (const lg of ['fr', 'it', 'en']) {
    await pg.click('[data-lang=' + lg + ']'); await pg.waitForTimeout(400);
    if (!(await pg.locator('#chPan').isVisible())) { await pg.click('#chFab'); await pg.waitForTimeout(200); }
    let bad = [], n = 0;
    for (const id of ids) for (const pickLast of [false, true]) {
      await pg.evaluate(() => { const m = document.querySelector('#chPan .chmsgs'); [...m.children].forEach(c => { if (!c.classList.contains('chq')) c.remove(); }); });
      await pg.evaluate(k => window.__LVCHAT.start(k), id); await pg.waitForTimeout(60);
      for (let s = 0; s < 8; s++) {
        const opts = pg.locator('#chPan .chmsgs .chopts').last().locator('button');
        const cnt = await opts.count(); const txt = cnt ? await opts.first().textContent() : '';
        if (!cnt || /^(↺|Nouvelle|Nuova|New|Recommencer|Ricominciare|Start again)/.test(txt) || await pg.evaluate(() => !!document.querySelector('#chPan .chmsgs .chopts:last-child button.ghost'))) break;
        await (pickLast ? opts.nth(Math.max(0, cnt - 1)) : opts.first()).click(); await pg.waitForTimeout(40);
      }
      const t = await pg.evaluate(() => [...document.querySelectorAll('#chPan .chmsgs .chm, #chPan .chmsgs .chopts button')].map(e => e.childNodes[0] && e.childNodes[0].nodeType === 3 ? e.childNodes[0].textContent : e.textContent).join('\n'));
      n += t.length; t.split('\n').forEach(l => { const m = DE.exec(l); if (m) bad.push(id + ': «' + m[2] + '» in ' + l.slice(0, 90)); });
    }
    bad = [...new Set(bad)];
    ok(bad.length === 0, lg.toUpperCase() + ': alle Beratungen ohne deutsche Reste (' + Math.round(n / 1000) + 'k Zeichen geprüft)' + (bad.length ? ' – ' + bad.length + ': ' + bad.slice(0, 6).join(' | ') : ''));
  }
  // Fragen in der Sprache
  const ask = async q => { await pg.fill('#chPan textarea', q); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300); return pg.locator('#chPan .chm.bot').last().textContent(); };
  await pg.click('[data-lang=fr]'); await pg.waitForTimeout(300); if (!(await pg.locator('#chPan').isVisible())) await pg.click('#chFab');
  let a = await ask('Quels types de chambres ?'); ok(/KES/.test(a) && /manchon/.test(a) && !DE.test(a), 'FR-Frage «types de chambres»: ' + a.slice(0, 80));
  a = await ask('rayon de courbure'); ok(/K100 ≥ 3 m/.test(a) && /rayon/i.test(a), 'FR-Frage «rayon de courbure» beantwortet');
  await pg.click('[data-lang=it]'); await pg.waitForTimeout(300); if (!(await pg.locator('#chPan').isVisible())) await pg.click('#chFab');
  a = await ask('ripartizione dei costi strada'); ok(/aziende|costruzione stradale/.test(a) && !DE.test(a), 'IT-Frage «ripartizione dei costi»: ' + a.slice(0, 80));
  await pg.click('[data-lang=en]'); await pg.waitForTimeout(300); if (!(await pg.locator('#chPan').isVisible())) await pg.click('#chFab');
  a = await ask('summary'); ok(/Project status|CHF/.test(a) && !/Projektstand/.test(a), 'EN «summary» → Projektstand auf Englisch: ' + a.slice(0, 80));
  ok(!/allemand|tedesco|German only/i.test(await pg.textContent('#chPan')), 'kein Hinweis «nur Deutsch» mehr');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
