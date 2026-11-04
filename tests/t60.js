const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
const KM=()=>pg.evaluate(()=>JSON.parse(JSON.stringify(window.__KM.M())));
const fail=process.argv[2]==='fail'; let req=0;
await pg.route('**/profile.json**',async r=>{ req++; if(fail) return r.abort(); const g=JSON.parse(new URL(r.request().url()).searchParams.get('geom')).coordinates; const L=Math.hypot(g[g.length-1][0]-g[0][0],g[g.length-1][1]-g[0][1]); const n=Math.max(2,Math.ceil(L/10)+1); const arr=[]; for(let i=0;i<n;i++){const d=L*i/(n-1); arr.push({dist:d,alts:{COMB:500+d*0.05}});} await r.fulfill({json:arr}); });
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); await pg.keyboard.press('1');
await clk(100,200); await none(); await clk(400,200); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(1200);
let m=await KM();
if(fail){ ok(req===1&&!m.lines[0].hz,'Fehlerfall: genau 1 Versuch, kein Profil ('+req+')'); ok(await pg.locator('.kmtoast').count()>0&&/nicht automatisch geladen/.test(await pg.textContent('.kmtoast')),'Fehlerfall: dezenter Hinweis mit «Nochmals»'); await pg.waitForTimeout(1500); ok(req===1,'kein Dauer-Wiederholen ('+req+' Anfragen)'); }
else {
ok(!!m.lines[0].hz&&m.lines[0].hz.sig===JSON.stringify(m.lines[0].pts)&&req===1,'neue Linie: Profil automatisch geladen, ohne Knopf (Anfragen: '+req+')');
await pg.click('[data-k=medit]'); await pg.waitForTimeout(300); await pg.mouse.click(bx.x+160,bx.y+200); await pg.waitForTimeout(300);
const v=pg.locator('.kmv'); const b1=await v.nth(1).boundingBox(); const sg0=m.lines[0].hz.sig;
await pg.mouse.move(b1.x+b1.width/2,b1.y+b1.height/2); await pg.mouse.down(); await pg.mouse.move(b1.x+b1.width/2+40,b1.y+b1.height/2+60,{steps:6}); await pg.mouse.up(); await pg.waitForTimeout(1200);
m=await KM(); ok(m.lines[0].hz&&m.lines[0].hz.sig===JSON.stringify(m.lines[0].pts)&&m.lines[0].hz.sig!==sg0&&req===2,'nach Verschieben: Profil automatisch neu geladen (Anfragen: '+req+')');
// aus
await pg.click('#kmTabE'); await pg.waitForTimeout(200); await pg.uncheck('[data-hz=auto]');
const b2=await v.nth(1).boundingBox().catch(()=>null); await pg.click('#kmTabP');
await pg.mouse.click(bx.x+112,bx.y+202); await pg.waitForTimeout(300); const b3=await pg.locator('.kmv').nth(0).boundingBox(); await pg.mouse.move(b3.x+b3.width/2,b3.y+b3.height/2); await pg.mouse.down(); await pg.mouse.move(b3.x+b3.width/2+20,b3.y+b3.height/2-30,{steps:5}); await pg.mouse.up(); await pg.waitForTimeout(1200);
ok(req===2,'Schalter aus: kein automatisches Laden ('+req+')');
}
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
