const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); let pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','100'); await pg.waitForTimeout(500);
// alle Pfade aller Beratungen durchlaufen
const res=await pg.evaluate(()=>{ const F=window.__LVC.FLOWS, out={n:0,bad:[],flows:Object.keys(F).length,paths:{}};
 function walk(k,f,ans,i){ let j=-1; for(let x=i;x<f.steps.length;x++){ const s=f.steps[x]; if(!s.when||s.when(ans)){j=x;break;} }
  if(j<0){ try{ const r=f.result(ans); out.n++; out.paths[k]=(out.paths[k]||0)+1; const t=r.t||''; if(!t||/undefined|NaN|\[object/.test(t)) out.bad.push(k+':'+JSON.stringify(ans)+' '+t.slice(0,80)); if(!r.s) out.bad.push(k+': Quelle fehlt'); }catch(e){ out.bad.push(k+':'+JSON.stringify(ans)+' '+e.message); } return; }
  const s=f.steps[j]; const opts=typeof s.opts==='function'?s.opts(ans):s.opts; opts.forEach(o=>walk(k,f,Object.assign({},ans,{[s.id]:o[0]}),j+1)); }
 Object.keys(F).forEach(k=>walk(k,F[k],{},0)); return out; });
console.log(res.flows,'Beratungen,',res.n,'Pfade',JSON.stringify(res.paths)); console.log(res.bad.slice(0,6));
ok(res.flows>=20,'mind. 20 Beratungen ('+res.flows+')'); ok(res.bad.length===0,'alle Pfade liefern gültige Ergebnisse');
await pg.click('#chFab'); const g=await pg.locator('#chPan .chgrp').count(); ok(g===3,'3 Gruppen (unterirdisch, Freileitung, Projekt)');
await pg.locator('#chPan .chgrp summary').nth(1).click(); ok(await pg.locator('#chPan .chgrp').nth(1).locator('button').count()>=10,'Gruppe Freileitungen mit Beratungen');
const ask=async q=>{await pg.fill('#chPan textarea',q); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);}; const btn=async t=>{await pg.locator('#chPan button',{hasText:t}).last().click(); await pg.waitForTimeout(200);}; const last=()=>pg.locator('.chm.bot').last().textContent();
await ask('Durchhang'); ok(/Welches Luftkabel/.test(await last()),'«Durchhang» startet Beratung direkt'); await btn('SK 6×2/0,6'); await btn('30 m'); await pg.locator('#chPan button',{hasText:/^0 °C$/}).last().click(); await pg.waitForTimeout(200); let t=await last(); ok(/Durchhang f = 0,6 m/.test(t)&&/Zugkraft F = 33 daN/.test(t)&&/0 °C/.test(t),'Montagewert SK 6×2/0,6, 30 m, 0 °C: f 0,6 m, F 33 daN'); console.log(t.slice(0,150));
await ask('Was gilt für den UST?'); ok(/Welches Thema/.test(await last()),'Freitext UST startet Beratung'); await btn('Abbrechen'); await ask('Zweitweg'); ok(await pg.locator('.chopts button',{hasText:'Geführte Beratung: Zweitweg'}).count()===1,'KB-Antwort Zweitweg bietet Beratung an'); await btn('Geführte Beratung: Zweitweg'); await btn('Abbrechen');
await ask('Eingrabtiefe Holzmast'); await btn('Eingrabtiefe'); await btn('10 m'); await btn('Normal'); t=await last(); ok(/150 cm/.test(t),'Holzmast 10 m: 150 cm');
await ask('Meldepflicht Luftfahrt'); await btn('Ja'); await btn('Nein'); t=await last(); ok(/30 Tage/.test(t)&&/Meldepflichtig/.test(t),'BAZL Meldepflicht');
await ask('Zweitweg Beratung'); await btn('Zwei parallele'); await btn('Ja'); await btn('3 bis 5 m'); t=await last(); ok(/gelten als getrennte Wege/.test(t)&&/3 m/.test(t),'Zweitweg im Strassenrand: 3 m reichen');
await ask('Projekt-Check'); await btn('Basis: Teilnehmerkabel Cu'); await btn('In der Bauzone'); t=await last(); ok(/Projekt|Zeichnung/.test(t),'Projekt-Check läuft: '+t.slice(0,60));
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document.body).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe: '+JSON.stringify(ax).slice(0,200));
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
