const {chromium,ok,mk,FULL,dataUrl}=require('/tmp/claude-0/lf/k.js'); const {execSync}=require('child_process'); const fs=require('fs');
(async()=>{const b=await chromium.launch(); const res={};
for(const mode of ['compact','full']){ const pg=await mk(b,1400,1000); await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(400);
 await pg.evaluate(([f,a])=>{const S=JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); (new Function('S','a',f))(S,a); S.recs.graben[0].L='60'; S.recs.graben[0].n='3'; S.recs.werkloch[0].ts='2'; S.recs.geb[0].n='3'; localStorage.setItem('lv-devis-tiefbau-v2',JSON.stringify(S));},[FULL,dataUrl]); await pg.reload(); await pg.waitForTimeout(1200);
 await pg.evaluate(m=>{ if(m==='full') document.body.classList.add('print-detail'); document.querySelectorAll('#result details').forEach(d=>d.open=true)},mode); await pg.emulateMedia({media:'print'});
 const f='/tmp/claude-0/lf/t37_'+mode+'.pdf'; await pg.pdf({path:f,format:'A4',margin:{top:'12mm',bottom:'12mm',left:'10mm',right:'10mm'}});
 res[mode]={pages:+/Pages:\s+(\d+)/.exec(execSync('pdfinfo '+f).toString())[1], txt:execSync('pdftotext -layout '+f+' -').toString()}; ok(pg.errs.length===0,mode+': keine JS-Fehler'); await pg.close();}
console.log('Seiten kompakt',res.compact.pages,'ausführlich',res.full.pages);
ok(res.compact.pages<=6,'Kompakt: höchstens 6 Seiten ('+res.compact.pages+')'); ok(res.compact.pages<=res.full.pages*0.5,'Kompakt höchstens halb so lang wie ausführlich');
ok(/Kostenübersicht/.test(res.compact.txt)&&/Zusammenfassung nach Kapitel/.test(res.compact.txt),'Kompakt enthält Kostenübersicht und Zusammenfassung nach Kapiteln'); ok(/Aufstellung nach Elementen/.test(res.compact.txt)&&/Graben/.test(res.compact.txt),'Kompakt enthält Elementsummen');
ok(!/Aushubvolumen \(Grabenbreite/.test(res.compact.txt)&&/Aushubvolumen \(Grabenbreite/.test(res.full.txt||res.full.txt),'Massenbilanz nur im ausführlichen Druck');
await b.close();})();
