const {chromium,ok,mk,getS}=require('./lib/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
await pg.waitForTimeout(500);
const vis=sel=>pg.locator(sel).first().isVisible();
ok(!(await vis('.kmmid')),'Ebenen/Katalog ist standardmässig ausgeblendet');
ok(await pg.locator('.kmtools .kmgrab').isVisible()&&await pg.locator('.kmside .kmgrab').isVisible(),'Fenster haben Titelleiste');
await pg.click('.kmmidtog'); await pg.waitForTimeout(300); ok(await vis('.kmmid')&&await pg.locator('.kmmid .kmgrab').evaluate(e=>e===document.activeElement),'Ebenen/Katalog erscheint beim Öffnen (Fokus auf Titel)');
await pg.mouse.click(bx.x+600,bx.y+300); await pg.waitForTimeout(300); ok(!(await vis('.kmmid')),'Klick in die Karte blendet es wieder aus');
await pg.click('.kmmidtog'); await pg.click('.kmmid [data-w=pin]'); await pg.mouse.click(bx.x+600,bx.y+300); await pg.waitForTimeout(300); ok(await vis('.kmmid'),'Angeheftet bleibt es offen');
await pg.click('.kmmid [data-w=x]'); await pg.waitForTimeout(200);
// verschieben mit der Maus
const r0=await pg.locator('.kmside').boundingBox(); const h=await pg.locator('.kmside .kmgrab').boundingBox();
await pg.mouse.move(h.x+30,h.y+10); await pg.mouse.down(); await pg.mouse.move(h.x-150,h.y+120,{steps:8}); await pg.waitForTimeout(160); await pg.mouse.up(); await pg.waitForTimeout(400);
const r1=await pg.locator('.kmside').boundingBox(); ok(Math.abs(r1.x-(r0.x-180))<8&&r1.y>r0.y+100,'Eigenschaften-Fenster per Maus verschoben ('+Math.round(r0.x)+'→'+Math.round(r1.x)+')');
const m1=await pg.locator('#kmMap').boundingBox(); ok(m1.width>r0.x-200+r0.width-50,'Karte nutzt den frei gewordenen Platz ('+Math.round(m1.width)+' px)');
// Tastatur
await pg.locator('.kmside .kmgrab').focus(); await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(200); const r2=await pg.locator('.kmside').boundingBox(); ok(Math.abs(r2.x-(r1.x-32))<3,'Pfeiltasten verschieben um 16 px');
// minimieren
await pg.click('.kmside [data-w=min]'); await pg.waitForTimeout(200); ok((await pg.locator('.kmside').boundingBox()).height<60,'Minimieren zeigt nur die Titelleiste');
await pg.click('.kmside [data-w=min]'); await pg.waitForTimeout(200);
// bleibt nach Schliessen/Öffnen
await pg.click('[data-k=close]'); await pg.waitForTimeout(300); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(900);
const r3=await pg.locator('.kmside').boundingBox(); ok(Math.abs(r3.x-r2.x)<3&&Math.abs(r3.y-r2.y)<3,'Position wird gemerkt');
// axe mit offenem Katalog
await pg.click('.kmmidtog'); await pg.waitForTimeout(300);
await pg.addScriptTag({path:require('./lib/k.js').AXE}); const ax=await pg.evaluate(()=>axe.run(document.querySelector('dialog[open]')).then(r=>r.violations.map(v=>v.id+' '+v.nodes.map(n=>n.target.join(' ')).join(';'))));
ok(ax.length===0,'axe: '+JSON.stringify(ax));
// zurücksetzen
await pg.click('.kmmidtog'); await pg.waitForTimeout(100); await pg.locator('button',{hasText:'Fenster zurücksetzen'}).click(); await pg.waitForTimeout(400);
const r4=await pg.locator('.kmside').boundingBox(); ok(Math.abs(r4.x-r0.x)<3,'Zurücksetzen dockt wieder an');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
