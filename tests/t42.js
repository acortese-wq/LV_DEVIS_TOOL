const {chromium,ok,getS,fs}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch();
async function pageWith(w,h,withClaude){ const pg=await b.newPage({viewport:{width:w,height:h}}); pg.errs=[]; pg.on('pageerror',e=>pg.errs.push(e.message));
 if(withClaude) await pg.addInitScript(()=>{ window.__calls=[]; const f=async(input,opt)=>{ window.__calls.push({n:input.length,last:input[input.length-1].content.slice(0,60),tools:(opt.tools||[]).map(t=>t.name)});
   const hits=await opt.tools[0].execute({query:'schacht'}); const r=await opt.tools[2].execute({tab:'graben',index:1,feld:'T',wert:'1.20',begruendung:'Frosttiefe'}); window.__toolRes=[hits.length,r];
   opt.onText({text:'Ich schlage 1.20 m vor.',delta:'Ich schlage 1.20 m vor.'}); return {text:'Ich schlage 1.20 m vor.',truncated:false,modelTierApplied:'default'}; }; f.limits=async()=>({maxPromptBytes:65536,tools:{maxCount:8}}); window.claude={use:async n=>n==='sample'?f:null}; });
 await pg.route('**/*', r => { const u=r.request().url(); if(u.includes('leaflet')) return r.fulfill({body:u.endsWith('.js')?fs.readFileSync('/tmp/claude-0/lf/package/dist/leaflet.js'):fs.readFileSync('/tmp/claude-0/lf/package/dist/leaflet.css'),contentType:u.endsWith('.js')?'application/javascript':'text/css'}); if(u.includes('geo.admin')) return r.fulfill({status:204,body:''}); r.continue(); });
 await pg.goto('file:///home/user/lv_devis_tool/index.html'); return pg; }
let pg=await pageWith(1280,900,true);
await pg.fill('#f_graben_L','100'); await pg.waitForTimeout(600);
ok(await pg.locator('#chFab').count()===1,'Assistent-Knopf vorhanden');
await pg.click('#chFab'); ok((await pg.getAttribute('#chFab','aria-expanded'))==='true','Panel öffnet'); ok(await pg.locator('#chPan').isVisible(),'Panel sichtbar');
await pg.fill('#chPan textarea','Wie tief sollte der Graben sein?'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.chcard',{timeout:5000});
const calls=await pg.evaluate(()=>window.__calls); console.log(JSON.stringify(calls));
ok(calls[0].tools.join()==='lv_suche,lv_position,vorschlag','Werkzeuge übergeben'); ok(calls[0].last.startsWith('PROJEKTSTAND'),'Projektstand im Prompt');
const tr=await pg.evaluate(()=>window.__toolRes); ok(tr[0]>0,'lv_suche liefert Treffer ('+tr[0]+')'); console.log(tr[1]);
const card=await pg.textContent('.chcard'); console.log(card); ok(/Kostenwirkung netto/.test(card)&&/T: 0\.60 → 1\.20|T: .* → 1\.20/.test(card),'Vorschlagskarte mit Kostenwirkung');
let S=await getS(pg); ok(S.recs.graben[0].T!=='1.20','Vorschlag noch nicht übernommen');
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document.body).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe: '+JSON.stringify(ax).slice(0,200));
await pg.click('.chcard button:has-text("Übernehmen")'); await pg.waitForTimeout(600); S=await getS(pg); ok(S.recs.graben[0].T==='1.20','Nach Bestätigung übernommen'); ok(await pg.locator('.chcard').textContent().then(t=>/Übernommen/.test(t)),'Karte zeigt «Übernommen»');
await pg.keyboard.press('Escape'); ok(!(await pg.locator('#chPan').isVisible()),'Escape schliesst'); ok(await pg.evaluate(()=>document.activeElement.id)==='chFab','Fokus zurück auf Knopf');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|'));
// ohne Claude-Funktion
let p2=await pageWith(390,800,false); await p2.click('#chFab'); await p2.fill('#chPan textarea','Test'); await p2.keyboard.press('Enter'); await p2.waitForTimeout(300);
ok(/nur im veröffentlichten Artefakt/.test(await p2.textContent('#chPan')),'Hinweis ohne Claude-Funktion');
ok(await p2.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Handy 390 px ohne Seitenüberlauf'); ok(p2.errs.length===0,'keine JS-Fehler (ohne Claude)');
await b.close();})();
