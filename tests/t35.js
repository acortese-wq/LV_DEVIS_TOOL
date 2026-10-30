const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1440,900);
await pg.fill('#f_graben_L','40'); await pg.waitForTimeout(900);
ok(await pg.isVisible('#fQ'),'Filterleiste vorhanden'); const n0=await pg.locator('.zusblk tbody tr:not(.grp)').count();
await pg.fill('#fQ','151/221'); await pg.waitForTimeout(200); const n1=await pg.locator('.zusblk tbody tr:not(.grp):not(.fhide)').count(); ok(n1>0&&n1<n0,'Filter nach Nummer: '+n1+' von '+n0); console.log(await pg.textContent('#fCount'));
await pg.fill('#fQ','Bitumen'); await pg.waitForTimeout(200); ok((await pg.locator('.zusblk tbody tr:not(.grp):not(.fhide)').count())>0,'Filter nach Text');
await pg.fill('#fQ','zzzxx'); await pg.waitForTimeout(200); ok((await pg.textContent('#fCount')).includes('Keine Position'),'Leere Treffermenge gemeldet');
await pg.click('#fClr'); ok((await pg.inputValue('#fQ'))==='','Zurücksetzen');
// Prüfstatus
await pg.click('[data-toggle=zus]'); const first=pg.locator('.zusblk td.art[data-k]').first(); const key=await first.getAttribute('data-k'); const btn=first.locator('.pst');
await btn.click(); ok((await btn.textContent()).includes('Geprüft'),'Status 1× Klick: Geprüft (Text + Symbol)'); await btn.click(); ok((await btn.textContent()).includes('Klären'),'2× Klick: Klären');
await pg.locator('.zusblk tr.pst-kl .pnote').fill('Menge mit Ausmass abgleichen'); await pg.waitForTimeout(700);
let S=await getS(pg); const e=S.pruef&&S.pruef[key]; console.log(JSON.stringify(e)); ok(e&&e.st==='klaeren'&&e.note.includes('Ausmass')&&/^\d{4}-/.test(e.ts),'Status, Notiz, Zeitstempel gespeichert');
ok((await pg.textContent('#pSum')).includes('1 zu klären'),'Prüfstand-Summe: '+(await pg.textContent('#pSum')).slice(0,60));
await pg.selectOption('#fSt','klaeren'); await pg.waitForTimeout(200); ok((await pg.locator('.zusblk tbody tr:not(.grp):not(.fhide)').count())===1,'Statusfilter «Klären»'); await pg.selectOption('#fSt','');
await pg.reload(); await pg.waitForTimeout(900); ok((await pg.locator('.zusblk tr.pst-kl .pnote').inputValue())==='Menge mit Ausmass abgleichen','nach Neuladen erhalten');
// Top 10
await pg.locator('.top10 summary').click(); const top=await pg.locator('.top10 li').count(); ok(top>0&&top<=10,'Top-10: '+top); await pg.locator('.top10 [data-topgo]').first().click(); await pg.waitForTimeout(500); ok(await pg.locator('.zusblk tr.flash').count()===1,'Sprung zur Position');
// Sticky
await pg.evaluate(()=>window.scrollTo(0,1400)); await pg.waitForTimeout(300); const pos=await pg.evaluate(()=>{const th=document.querySelector('.zusblk thead th, .elres:not(.closed) thead th'); const r=th.getBoundingClientRect(); return [getComputedStyle(th).position, Math.round(r.top)]}); console.log('thead',pos); ok(pos[0]==='sticky'&&pos[1]<400&&pos[1]>=0,'Tabellenkopf bleibt sichtbar (sticky)');
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe: '+JSON.stringify(ax).slice(0,200));
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
