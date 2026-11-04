const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
await pg.route('**/profile.json**',async r=>{const g=JSON.parse(new URL(r.request().url()).searchParams.get('geom')).coordinates; const L=Math.hypot(g[g.length-1][0]-g[0][0],g[g.length-1][1]-g[0][1]); await r.fulfill({json:[{dist:0,alts:{COMB:500}},{dist:L,alts:{COMB:505}}]});});
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); await pg.keyboard.press('1');
await clk(100,200); await none(); await clk(400,200); await pg.waitForTimeout(200);
ok(await pg.locator('[data-k=save]').isVisible()&&await pg.locator('[data-k=apply]').isVisible(),'Speichern neben «In Datensätze übernehmen»');
await pg.click('[data-k=save]'); await pg.waitForTimeout(500);
ok(/Zeichnung gespeichert/.test(await pg.textContent('.kmtoast')),'Hinweis nach Speichern');
let S=await getS(pg); ok(S.karte.lines.length===1&&S.karte.lines[0].pts.length===2,'Linie im Zustand gesichert, ohne Datensatz (Dialog noch offen)');
ok(await pg.locator('dialog[open]').count()===1,'Fenster bleibt offen');
await pg.click('[data-k=close]'); await pg.waitForTimeout(400); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
ok(/1 Linie/.test(await pg.textContent('#kmSum')),'nach Schliessen/Öffnen ist die Zeichnung noch da');
await pg.keyboard.press('Control+s'); await pg.waitForTimeout(300); ok(/gespeichert/.test(await pg.textContent('.kmtoast')),'Strg+S speichert');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
