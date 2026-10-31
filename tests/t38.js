const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(100);} await pg.waitForTimeout(400);
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(300);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx,bx.y+dy,{steps:2}); await pg.waitForTimeout(150);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
ok(await pg.locator('[data-sn=rect]').count()===1,'Schalter «Rechtwinklig/parallel» vorhanden'); ok((await pg.getAttribute('[data-sn=ln]','aria-pressed'))==='true','Linienfang standardmässig an');
await pg.click('[data-k=mline]'); await clk(100,250); await none(); await clk(500,250); await pg.click('[data-k=end]'); await none();
// Start ab Linie
if((await pg.getAttribute('[data-k=mline]','aria-pressed'))!=='true') await pg.click('[data-k=mline]'); await mv(300,254); ok(await pg.locator('.kmsnap.ln').count()===1,'Fangmarke «auf Linie» beim Annähern'); ok((await pg.textContent('.kmsnap.ln i')).includes('Linie'),'Fangtext: '+await pg.textContent('.kmsnap.ln i'));
await clk(300,254); const afterStart=await getS(pg).catch(()=>null);
await mv(305,150); ok(await pg.locator('.kmsnap.rect').count()===1,'Fangmarke rechtwinklig zur Basislinie'); ok(await pg.locator('.leaflet-overlay-pane path[stroke-dasharray="4 4"]').count()>=1,'Hilfslinie sichtbar'); const tip=await pg.locator('.kmtip').textContent(); ok(tip.includes('⊥ 90°'),'Vorschau mit Winkel: '+tip);
await clk(305,150); await pg.click('[data-k=end]'); await none();
await pg.click('[data-k=apply]'); await pg.waitForTimeout(600); let S=await getS(pg); const L=S.karte.lines; console.log(JSON.stringify(L.map(l=>l.pts.length)),JSON.stringify(L[1].pts),!!L[1].from);
ok(L.length===2&&L[0].pts.length===3,'Basislinie hat Knoten am Fusspunkt (3 Punkte)'); ok(L[1].from===L[0].id,'Abzweig verknüpft (from)');
const bd=[L[0].pts[2][0]-L[0].pts[0][0],L[0].pts[2][1]-L[0].pts[0][1]], nd=[L[1].pts[1][0]-L[1].pts[0][0],L[1].pts[1][1]-L[1].pts[0][1]]; const cosA=Math.abs((bd[0]*nd[0]+bd[1]*nd[1])/Math.hypot(...bd)/Math.hypot(...nd)); ok(cosA<0.002,'Abzweig exakt rechtwinklig zur Basislinie (|cos|='+cosA.toFixed(5)+')'); ok(Math.abs(L[1].pts[0][1]-L[0].pts[1][1])<0.02,'Startpunkt liegt auf der Basislinie');
// Umschalter aus: kein Rechtwinkelfang
await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(500); await pg.click('[data-sn=rect]'); await pg.click('[data-sn=ln]');
const bx2=await pg.locator('#kmMap').boundingBox(); if((await pg.getAttribute('[data-k=mline]','aria-pressed'))!=='true') await pg.click('[data-k=mline]'); await pg.mouse.click(bx2.x+200,bx2.y+450); await pg.waitForTimeout(300); await none(); await pg.mouse.click(bx2.x+300,bx2.y+450); await pg.waitForTimeout(300); await pg.mouse.move(bx2.x+400,bx2.y+456,{steps:2}); await pg.waitForTimeout(200); ok(await pg.locator('.kmsnap.rect').count()===0,'ohne Schalter keine Rechtwinkel-Fangmarke');
// Umschalt kehrt um
await pg.keyboard.down('Shift'); await pg.mouse.move(bx2.x+405,bx2.y+457,{steps:2}); await pg.waitForTimeout(200); ok(await pg.locator('.kmsnap.rect').count()===1,'Umschalt aktiviert Rechtwinklig/parallel vorübergehend'); await pg.keyboard.up('Shift');
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe: '+JSON.stringify(ax).slice(0,160));
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
