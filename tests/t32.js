const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<8;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(100);} await pg.waitForTimeout(400);
const bx=await pg.locator('#kmMap').boundingBox(); const rc=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy,{button:'right'}); await pg.waitForTimeout(250);};
const item=async(t)=>{await pg.locator('#kmCtx button',{hasText:t}).first().click(); await pg.waitForTimeout(250);};
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); await rc(120,100); const ax=await pg.evaluate(()=>axe.run(document).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe mit Kontextmenü: '+JSON.stringify(ax)); ok(await pg.isVisible('#kmCtx'),'Rechtsklick öffnet Kontextmenü'); const m=await pg.textContent('#kmCtx'); ok(['Schacht setzen','Werkloch setzen','Gebäudeeinführung','Sondage','Linie hier starten','Fläche hier beginnen','LV95'].every(x=>m.includes(x)),'Menü am leeren Punkt: alle Aktionen');
await pg.locator('#kmCtx select').first().selectOption('KES175'); await item('Schacht setzen');
// Linie starten und zeichnen
await rc(300,100); await item('Linie hier starten'); await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); await pg.waitForTimeout(150);
const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(150);}; await clk(420,100); await clk(560,100); await pg.click('[data-k=end]'); await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); await pg.waitForTimeout(200);
// Rechtsklick auf Linie: teilen + Wiese
await rc(490,100); ok((await pg.textContent('#kmCtx')).includes('Linie teilen')&&(await pg.textContent('#kmCtx')).includes('Abzweig ab hier')&&(await pg.textContent('#kmCtx')).includes('Eigenschaften'),'Menü am Objekt Linie');
await item('Linie teilen'); await pg.locator('#kmCtx button',{hasText:'Wiese'}).click(); await pg.waitForTimeout(300);
let S1=await pg.evaluate(()=>0);
// Rechtsklick auf Schacht: Eigenschaften
await rc(120,100); await item('Eigenschaften'); ok(await pg.isVisible('#kmProps'),'Eigenschaften-Fenster am Objekt'); ok(await pg.locator('#kmProps select').count()>=2,'Felder im Fenster (Typ, Oberfläche …)');
await pg.locator('#kmProps button',{hasText:'×'}).click();
// Leitung ab Schacht (Anschluss)
await rc(120,100); await item('Leitung ab hier'); await clk(150,200); await pg.click('[data-k=end]'); await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click();
await pg.click('[data-k=apply]'); await pg.waitForTimeout(600);
const S=await getS(pg); const K=S.karte; console.log('Linien',JSON.stringify(K.lines.map(l=>[l.cfg&&l.cfg.fl,l.pts.length,l.s||null])),'Pts',JSON.stringify(K.pts.map(p=>[p.typ,p.mode])));
ok(K.pts.some(p=>p.typ==='KES175'),'Schacht mit gewähltem Typ aus dem Menü');
ok(K.lines.length===3&&K.lines.filter(l=>l.cfg&&l.cfg.fl==='wiese').length>=1&&K.lines[0].cfg.fl!=='wiese','Linie geteilt, Folgeabschnitt Wiese');
ok(K.lines.some(l=>l.s&&K.pts.some(p=>p.id===l.s)),'Leitung ab Schacht verknüpft (Anschluss)');
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'});
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
