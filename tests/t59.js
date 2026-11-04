const {chromium,ok,mk,getS}=require('./lib/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
const KM=()=>pg.evaluate(()=>JSON.parse(JSON.stringify(window.__KM.M())));
const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); await pg.keyboard.press('1');
await clk(100,200); await none(); await clk(400,200); await pg.click('[data-k=end]'); await none();
await clk(100,300); await none(); await clk(400,300); await pg.click('[data-k=end]'); await none();
await pg.click('[data-k=mpt]'); await clk(250,250); await pg.waitForTimeout(300);
await pg.click('[data-k=medit]'); await pg.waitForTimeout(300);
let m=await KM(); ok(m.lines.length===2&&m.pts.length===1,'3 Objekte vorhanden');
// Umschalt+Klick: Mehrfachauswahl
await pg.keyboard.down('Shift'); await pg.mouse.click(bx.x+250,bx.y+200); await pg.waitForTimeout(250); await pg.mouse.click(bx.x+250,bx.y+300); await pg.waitForTimeout(250); await pg.keyboard.up('Shift');
ok(/3 gewählt/.test(await pg.textContent('#kmMsb')),'Umschalt+Klick ergänzt die Auswahl (gesetzter Schacht + 2 Linien = 3)');
// Rahmenauswahl
await pg.mouse.click(bx.x+600,bx.y+500); await pg.waitForTimeout(300); ok(await pg.locator('#kmMsb').isHidden(),'Klick ins Leere hebt Auswahl auf');
await pg.keyboard.down('Shift'); await pg.mouse.move(bx.x+60,bx.y+150); await pg.mouse.down(); await pg.mouse.move(bx.x+300,bx.y+250,{steps:5}); await pg.mouse.move(bx.x+440,bx.y+340,{steps:5}); await pg.mouse.up(); await pg.keyboard.up('Shift'); await pg.waitForTimeout(400);
ok(/3 gewählt/.test(await pg.textContent('#kmMsb')),'Rahmenauswahl wählt 3 Objekte ('+(await pg.textContent('#kmMsb')).slice(0,20)+')');
// Gruppe verschieben
const b0=await KM(); await pg.mouse.move(bx.x+150,bx.y+200); await pg.mouse.down(); await pg.mouse.move(bx.x+180,bx.y+220,{steps:4}); await pg.mouse.move(bx.x+210,bx.y+240,{steps:4}); await pg.mouse.up(); await pg.waitForTimeout(400);
m=await KM(); const dx=m.lines[0].pts[0][0]-b0.lines[0].pts[0][0], dy=m.lines[0].pts[0][1]-b0.lines[0].pts[0][1];
ok(Math.hypot(dx,dy)>5&&d(m.lines[1].pts[0],[b0.lines[1].pts[0][0]+dx,b0.lines[1].pts[0][1]+dy])<0.02&&d(m.pts[0].pt,[b0.pts[0].pt[0]+dx,b0.pts[0].pt[1]+dy])<0.02,'Gruppe verschoben (alle 3 um gleichen Betrag '+dx.toFixed(1)+'/'+dy.toFixed(1)+')');
// Kopieren
await pg.fill('#kmMsX','10'); await pg.fill('#kmMsY','-4'); await pg.click('[data-ms=copy]'); await pg.waitForTimeout(400);
let m2=await KM(); ok(m2.lines.length===4&&m2.pts.length===2&&/3 gewählt/.test(await pg.textContent('#kmMsb')),'Kopieren: 6 Objekte, Kopien gewählt');
const c=m2.lines[2]; ok(d(c.pts[0],[m.lines[0].pts[0][0]+10,m.lines[0].pts[0][1]-4])<0.02&&c.rid==null,'Kopie um X=10/Y=-4 versetzt, ohne Datensatz-Verknüpfung');
// Löschen, Rückgängig, Wiederholen
await pg.keyboard.press('Delete'); await pg.waitForTimeout(300); m2=await KM(); ok(m2.lines.length===2&&m2.pts.length===1,'Entf löscht alle gewählten');
await pg.click('[data-k=undo]'); await pg.waitForTimeout(300); m2=await KM(); ok(m2.lines.length===4,'Rückgängig stellt wieder her');
await pg.keyboard.press('Control+y'); await pg.waitForTimeout(300); m2=await KM(); ok(m2.lines.length===2,'Strg+Y wiederholt (Löschen)');
ok(await pg.locator('[data-k=redo]').isDisabled(),'Wiederholen danach gesperrt');
// Parallel
await pg.mouse.click(bx.x+600,bx.y+500); await pg.waitForTimeout(200); await pg.keyboard.press('Control+a'); await pg.waitForTimeout(300); ok(/3 gewählt/.test(await pg.textContent('#kmMsb')),'Strg+A wählt alle');
ok(await pg.locator('[data-ms=par]').isDisabled(),'Parallel bei Mehrfachauswahl gesperrt');
await pg.mouse.click(bx.x+600,bx.y+500); await pg.waitForTimeout(200); await pg.mouse.click(bx.x+330,bx.y+240); await pg.waitForTimeout(300);
await pg.fill('#kmMsX','3'); await pg.click('[data-ms=par]'); await pg.waitForTimeout(400); m2=await KM(); const L0=m2.lines[0].pts, P=m2.lines[2].pts;
const ux=(L0[1][0]-L0[0][0])/d(L0[0],L0[1]), uy=(L0[1][1]-L0[0][1])/d(L0[0],L0[1]), off=(P[0][0]-L0[0][0])*uy-(P[0][1]-L0[0][1])*ux;
ok(m2.lines.length===3&&Math.abs(Math.abs(off)-3)<0.05&&Math.abs(d(P[0],P[1])-d(L0[0],L0[1]))<0.05,'Parallel im Abstand 3 m ('+off.toFixed(2)+' m, Länge gleich)');
await pg.addScriptTag({path:require('./lib/k.js').AXE}); const ax=await pg.evaluate(()=>axe.run(document.querySelector('dialog[open]')).then(r=>r.violations.map(v=>v.id+' '+v.nodes.map(n=>n.target.join(' ')).join(';')))); ok(ax.length===0,'axe: '+JSON.stringify(ax));
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
