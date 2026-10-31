const {chromium,ok,mk}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch();
for(const [w,h] of [[390,800],[768,1000],[1024,768],[1366,768],[1600,1000]]){
 const pg=await mk(b,w,h); await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(400); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
 const m=await pg.evaluate(()=>{const d=document.querySelector('dialog.kmdlg'), r=d.getBoundingClientRect(), mp=document.querySelector('#kmMap').getBoundingClientRect(); return {dw:Math.round(r.width),dh:Math.round(r.height),mw:Math.round(mp.width),mh:Math.round(mp.height),sw:d.scrollWidth,cw:d.clientWidth,tools:!!d.querySelector('.kmtools [data-k=mline]'),side:!!d.querySelector('#kmPanP')}});
 ok(m.dw===w,w+' px: Dialog füllt die Breite ('+m.dw+')'); ok(m.mw>=300&&m.mh>=200,w+' px: Karte nutzbar '+m.mw+'×'+m.mh); ok(m.sw<=m.cw+1,w+' px: kein horizontaler Überlauf im Dialog ('+m.sw+'/'+m.cw+')'); ok(m.tools&&m.side,w+' px: Werkzeuge und Eigenschaften vorhanden');
 await pg.click('#kmTabE'); ok(await pg.isVisible('#kmEval'),w+' px: Reiter Auswertung'); await pg.click('#kmTabP');
 if(w<1500&&w>860){ await pg.click('.kmmidtog'); ok(await pg.isVisible('#kmMk'),w+' px: Ebenen/Marker über Schalter'); }
 ok(pg.errs.length===0,w+' px: keine JS-Fehler '+pg.errs.join('|')); await pg.close();}
await b.close();})();
