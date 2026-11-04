const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
const M=()=>pg.evaluate(()=>JSON.parse(JSON.stringify(window.__KM.M())));
const drag=async(sel,dx,dy)=>{const b=await pg.locator(sel).first().boundingBox(); const x=b.x+b.width/2,y=b.y+b.height/2; await pg.mouse.move(x,y); await pg.mouse.down(); await pg.mouse.move(x+dx/2,y+dy/2,{steps:4}); await pg.mouse.move(x+dx,y+dy,{steps:6}); await pg.waitForTimeout(150); const sn=await pg.locator('.kmsnap').count(); await pg.mouse.up(); await pg.waitForTimeout(300); return sn;};
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); await pg.keyboard.press('1');
await clk(100,200); await none(); await clk(500,200); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
await pg.click('[data-k=mgeb]'); await clk(300,200); await pg.waitForTimeout(200);
await pg.click('[data-k=mline]'); await clk(300,350); await none(); await mv(304,204); await clk(300,200); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
let m=await M(); ok(m.lines.length===2&&m.geb.length===1&&m.geb[0].lid===m.lines[1].id,'Anschlussleitung mit Hauseinführung verknüpft');
// Abzweig vom Hauptstrang
await mv(200,200); await clk(200,200); await none(); await clk(200,330); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
m=await M(); ok(m.lines.length===3&&m.lines[2].from===m.lines[0].id,'Abzweig von Linie 1 (from)');
await pg.click('[data-k=medit]'); await pg.waitForTimeout(300);
// Hauseinführung schieben: Leitungsende folgt
await pg.locator('.kmgeb').first().click(); await pg.waitForTimeout(200);
const sn=await drag('.kmgeb',60,-20); m=await M(); const g=m.geb[0], l2=m.lines[1], e=l2.pts[l2.pts.length-1];
ok(Math.hypot(e[0]-g.pt[0],e[1]-g.pt[1])<0.06,'Leitungsende folgt der Hauseinführung ('+JSON.stringify(e)+' vs '+JSON.stringify(g.pt)+')');
const sn2=await drag('.kmgeb',-60,20); m=await M(); ok(sn2>=1&&m.geb[0].on===m.lines[0].id,'Fang beim Schieben: rastet auf Leitung 1 ein (Fangmarken '+sn2+')');
const gg=m.geb[0], ee=m.lines[1].pts[m.lines[1].pts.length-1]; ok(Math.hypot(ee[0]-gg.pt[0],ee[1]-gg.pt[1])<0.06,'Leitungsende folgt auch nach Fang'); 
// Abzweig-Anfang gleitet entlang Hauptleitung
m=await M(); const gOld=JSON.stringify([m.geb[0].pt]); const br0=m.lines[2].pts[0].slice(), nA=m.lines[0].pts.length;
await pg.mouse.click(bx.x+200,bx.y+265); await pg.waitForTimeout(300);
ok(await pg.locator('.kmv').count()>=2,'Eckpunkte des Abzweigs sichtbar');
await drag('.kmv',80,30); m=await M(); const A=m.lines[0].pts, B=m.lines[2].pts;
const onA=B[0][0]>br0[0]+5&&!A.some(q=>Math.hypot(q[0]-br0[0],q[1]-br0[1])<0.03);
ok(onA&&m.lines[0].pts.length===nA,'Abzweig-Ende gleitet entlang der Hauptleitung (Knoten mit, '+JSON.stringify(br0)+' -> '+JSON.stringify(B[0])+', A='+JSON.stringify(A)+')');
ok(A.some(q=>Math.hypot(q[0]-B[0][0],q[1]-B[0][1])<0.03),'Knoten in der Hauptleitung liegt am neuen Abzweigpunkt');
// Hauptleitung-Knoten ziehen: Abzweig folgt
await pg.mouse.click(bx.x+400,bx.y+200); await pg.waitForTimeout(300);
const kn=A.findIndex(q=>Math.hypot(q[0]-B[0][0],q[1]-B[0][1])<0.03); const nv=await pg.locator('.kmv').count();
m=await M(); const Ai=m.lines[0].pts, ki=Ai.findIndex(q=>Math.hypot(q[0]-B[0][0],q[1]-B[0][1])<0.03);
await pg.locator('.kmv').nth(ki).scrollIntoViewIfNeeded(); const bk=await pg.locator('.kmv').nth(ki).boundingBox(); await pg.mouse.move(bk.x+bk.width/2,bk.y+bk.height/2); await pg.mouse.down(); await pg.mouse.move(bk.x+bk.width/2-20,bk.y+bk.height/2-30,{steps:6}); await pg.mouse.up(); await pg.waitForTimeout(300);
m=await M(); ok(Math.hypot(m.lines[0].pts[ki][0]-m.lines[2].pts[0][0],m.lines[0].pts[ki][1]-m.lines[2].pts[0][1])<0.03&&Math.abs(m.lines[0].pts[ki][1]-Ai[ki][1])>0.5,'Knoten der Hauptleitung gezogen: Abzweig folgt');
// Verbindung lösen
await pg.mouse.click(bx.x+300,bx.y+345); await pg.waitForTimeout(300);
const bt=pg.locator('#kmObj p.hint',{hasText:'Angeschlossen an Linie 2'}).locator('button'); ok(await bt.count()>=1,'Knopf «Verbindung lösen» vorhanden');
await bt.first().click(); await pg.waitForTimeout(300); m=await M(); ok(!m.geb[0].lid&&!m.lines[1].gid,'Verbindung Hauseinführung–Leitung gelöst');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
