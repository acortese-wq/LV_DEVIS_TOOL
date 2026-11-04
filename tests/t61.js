const {chromium,ok,mk,getS}=require('./lib/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
const KM=()=>pg.evaluate(()=>JSON.parse(JSON.stringify(window.__KM.M())));
const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const V=async i=>{const bb=await pg.locator('.kmv').nth(i).boundingBox(); return [bb.x+bb.width/2,bb.y+bb.height/2];};
const dragAbs=async(x,y,dx,dy)=>{await pg.mouse.move(x,y); await pg.mouse.down(); await pg.mouse.move(x+dx/2,y+dy/2,{steps:4}); await pg.mouse.move(x+dx,y+dy,{steps:6}); await pg.mouse.up(); await pg.waitForTimeout(350);};
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); await pg.keyboard.press('1');
await clk(100,300); await none(); await clk(250,300); await clk(400,200); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
ok(await pg.locator('#kmEop').isHidden(),'Umschalter nur im Bearbeiten-Modus');
await pg.click('[data-k=medit]'); await pg.waitForTimeout(300);
ok(await pg.locator('#kmEop').isVisible()&&await pg.locator('[data-eop=pt]').getAttribute('aria-pressed')==='true','Umschalter sichtbar, Standard «Punkt»');
let m=await KM(); let P=m.lines[0].pts.map(q=>q.slice());
// Eckpunkt ziehen ohne Vorauswahl
let v1=await V(1); await dragAbs(v1[0],v1[1],0,-50); m=await KM(); ok(d(m.lines[0].pts[1],P[1])>3&&d(m.lines[0].pts[0],P[0])<0.01&&d(m.lines[0].pts[2],P[2])<0.01,'Punkt-Art: nur der Eckpunkt wandert, auch ohne Vorauswahl ('+d(m.lines[0].pts[1],P[1]).toFixed(1)+' m)');
// Strich ziehen: Linie bleibt (Karte wird nur verschoben)
P=m.lines[0].pts.map(q=>q.slice()); let a=await V(0), c=await V(1); await dragAbs((a[0]*0.7+c[0]*0.3)+ (c[1]-a[1])*0.0,(a[1]*0.7+c[1]*0.3),0,70); m=await KM(); ok(d(m.lines[0].pts[0],P[0])<0.01&&d(m.lines[0].pts[1],P[1])<0.01,'Punkt-Art: Ziehen am Strich verschiebt die Linie nicht');
// Alt = ganze Linie
P=m.lines[0].pts.map(q=>q.slice()); a=await V(0); c=await V(1); await pg.keyboard.down('Alt'); await dragAbs((a[0]*0.7+c[0]*0.3),(a[1]*0.7+c[1]*0.3),0,40); await pg.keyboard.up('Alt'); m=await KM(); let dd=d(m.lines[0].pts[0],P[0]); ok(dd>3&&Math.abs(d(m.lines[0].pts[2],P[2])-dd)<0.05,'Alt+Ziehen: ganze Linie ('+dd.toFixed(1)+' m)');
// Linie-Art
await pg.click('[data-eop=line]'); P=m.lines[0].pts.map(q=>q.slice()); a=await V(0).catch(()=>null);
const cc=await pg.evaluate(()=>0);
await pg.waitForTimeout(100); let bbm=await pg.locator('#kmMap').boundingBox();
// Linie-Art zeigt Griffe nur bei Auswahl: Linie zuerst anklicken
a=await V(0).catch(()=>null);
if(!a){ /* keine Griffe: Strich suchen */ }
await pg.click('[data-eop=pt]'); await pg.waitForTimeout(100); a=await V(0); c=await V(1); await pg.click('[data-eop=line]'); await dragAbs((a[0]*0.7+c[0]*0.3),(a[1]*0.7+c[1]*0.3),30,0); m=await KM(); ok(d(m.lines[0].pts[0],P[0])>3&&Math.abs(d(m.lines[0].pts[0],P[0])-d(m.lines[0].pts[1],P[1]))<0.05,'Linie-Art: ganze Linie verschoben');
// Einfügen
await pg.click('[data-eop=ins]'); await pg.waitForTimeout(150); const n0=m.lines[0].pts.length; a=await V(0); c=await V(2); await pg.mouse.click(a[0]+(c[0]-a[0])*0.3,a[1]+(c[1]-a[1])*0.3); await pg.waitForTimeout(300); m=await KM(); ok(m.lines[0].pts.length===n0+1,'Einfügen-Art: Klick auf den Strich fügt einen Punkt ein ('+n0+' → '+m.lines[0].pts.length+')');
// Löschen
await pg.click('[data-eop=del]'); const nb=(await KM()).lines[0].pts.length; const vb=await V(1); await pg.mouse.click(vb[0],vb[1]); await pg.waitForTimeout(300); m=await KM(); ok(m.lines[0].pts.length===nb-1,'Löschen-Art: Klick auf Eckpunkt entfernt ihn ('+nb+' → '+m.lines[0].pts.length+')');
await pg.click('[data-k=undo]'); await pg.waitForTimeout(300); m=await KM(); ok(m.lines[0].pts.length===nb,'Rückgängig stellt den Punkt wieder her');
// Teilen
await pg.click('[data-eop=split]'); const vb2=await V(1); await pg.mouse.click(vb2[0],vb2[1]); await pg.waitForTimeout(400); m=await KM(); ok(m.lines.length===2&&m.lines[0].nx===m.lines[1].id&&d(m.lines[0].pts[m.lines[0].pts.length-1],m.lines[1].pts[0])<0.01,'Teilen-Art: Linie am Eckpunkt in zwei Linien geteilt');
await pg.click('[data-k=undo]'); await pg.waitForTimeout(300);
// Segment: nur der Abschnitt wandert
await pg.click('[data-eop=seg]'); await pg.click('[data-eop=pt]'); a=await V(0); c=await V(1); await pg.click('[data-eop=seg]'); m=await KM(); P=m.lines[0].pts.map(q=>q.slice());
await dragAbs((a[0]*0.7+c[0]*0.3),(a[1]*0.7+c[1]*0.3),0,-30); m=await KM(); const d0=d(m.lines[0].pts[0],P[0]), d1=d(m.lines[0].pts[1],P[1]), d2=d(m.lines[0].pts[2],P[2]);
ok(d0>2&&Math.abs(d0-d1)<0.05&&d2<0.01,'Segment-Art: beide Eckpunkte des Abschnitts wandern, der Rest bleibt ('+d0.toFixed(1)+'/'+d1.toFixed(1)+'/'+d2.toFixed(1)+')');
await pg.addScriptTag({path:require('./lib/k.js').AXE}); const ax=await pg.evaluate(()=>axe.run(document.querySelector('dialog[open]')).then(r=>r.violations.map(v=>v.id+' '+v.nodes.map(n=>n.target.join(' ')).join(';')))); ok(ax.length===0,'axe: '+JSON.stringify(ax));
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
