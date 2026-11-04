const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
const KM=()=>pg.evaluate(()=>JSON.parse(JSON.stringify(window.__KM.M())));
const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
pg.on('dialog',dl=>dl.accept());
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); await pg.keyboard.press('1');
await clk(100,200); await none(); await clk(250,200); await pg.click('[data-k=end]'); await none();
await clk(262,200); await none(); await clk(400,200); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
await pg.evaluate(()=>{const M=window.__KM.M(); M.lines[1].pts[0][0]+=3; window.__KM.refresh();}); await pg.waitForTimeout(300);
let m=await KM(); ok(m.lines.length===2&&Math.hypot(m.lines[0].pts[1][0]-m.lines[1].pts[0][0],m.lines[0].pts[1][1]-m.lines[1].pts[0][1])>2,'zwei getrennte Linien mit 3 m Lücke');
await pg.click('[data-k=medit]'); await pg.click('[data-eop=join]'); await pg.waitForTimeout(300);
ok(await pg.locator('[data-eop=join]').getAttribute('aria-pressed')==='true','Art «Verbinden» wählbar');
const hs=pg.locator('.kmv'); const n=await hs.count(); const pos=[]; for(let i=0;i<n;i++){const bb=await hs.nth(i).boundingBox(); pos.push([bb.x+bb.width/2,bb.y+bb.height/2]);}
await pg.mouse.click(pos[1][0],pos[1][1]); await pg.waitForTimeout(400); m=await KM();
ok(m.lines.length===1&&m.lines[0].pts.length===4,'Klick auf das Ende: Linien zu einer verbunden ('+m.lines.length+' Linie, '+(m.lines[0]&&m.lines[0].pts.length)+' Punkte)');
await pg.click('[data-k=undo]'); await pg.waitForTimeout(300); m=await KM(); ok(m.lines.length===2,'Rückgängig trennt wieder');
// Auswahlleiste: Verbinden
await pg.keyboard.press('Control+a'); await pg.waitForTimeout(300); ok(await pg.locator('[data-ms=join]').isEnabled(),'Leiste: «Verbinden» bei zwei Linien aktiv');
await pg.click('[data-ms=join]'); await pg.waitForTimeout(400); m=await KM(); ok(m.lines.length===1,'Verbinden über die Auswahlleiste');
// Gegenläufig: zweite Linie umkehren
await pg.click('[data-k=undo]'); await pg.waitForTimeout(300);
await pg.evaluate(()=>{const M=window.__KM.M(); M.lines[1].pts.reverse(); window.__KM.refresh();}); await pg.waitForTimeout(300);
await pg.keyboard.press('Control+a'); await pg.waitForTimeout(200); await pg.click('[data-ms=join]'); await pg.waitForTimeout(400); m=await KM();
ok(m.lines.length===1&&m.lines[0].pts.length===4&&m.lines[0].pts[0][0]<m.lines[0].pts[3][0],'gegenläufige Linien: richtig zusammengesetzt');

// Ziehen: Linienende auf das Ende der anderen Linie ziehen -> Angebot «Verbinden»
await pg.click('[data-k=undo]'); await pg.waitForTimeout(300); await pg.click('[data-eop=pt]'); await pg.waitForTimeout(200);
await pg.evaluate(()=>{const M=window.__KM.M(); const o=M.lines[0].pts[0]; M.lines[0].pts=[[o[0],o[1]],[o[0]+60,o[1]]]; M.lines[1].pts=[[o[0]+260,o[1]],[o[0]+330,o[1]]]; delete M.lines[0].e; delete M.lines[1].s; window.__KM.refresh();}); await pg.waitForTimeout(300);
m=await KM(); const nl=m.lines.length;
const hs2=pg.locator('.kmv'); const cnt=await hs2.count(); const P2=[]; for(let i=0;i<cnt;i++){const bb=await hs2.nth(i).boundingBox(); P2.push([bb.x+bb.width/2,bb.y+bb.height/2]);}
// Ende von Linie 1 (Index 1) nahe an Anfang von Linie 2 (Index 2) ziehen
const mvx=P2[2][0]-P2[1][0]+6, mvy=P2[2][1]-P2[1][1]+4; await pg.mouse.move(P2[1][0],P2[1][1]); await pg.mouse.down(); await pg.mouse.move(P2[1][0]+mvx/2,P2[1][1]+mvy/2,{steps:4}); await pg.mouse.move(P2[1][0]+mvx,P2[1][1]+mvy,{steps:6}); await pg.mouse.up(); await pg.waitForTimeout(500);
ok(/verbinden\?/.test(await pg.textContent('.kmtoast')),'Ende auf Ende ziehen bietet «Verbinden» an');
await pg.locator('.kmtoast button').click(); await pg.waitForTimeout(400); m=await KM(); ok(m.lines.length===nl-1,'Angebot angenommen: eine Linie ('+nl+' → '+m.lines.length+')');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
