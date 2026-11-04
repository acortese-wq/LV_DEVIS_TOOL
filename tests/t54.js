const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
const KM=()=>pg.evaluate(()=>JSON.parse(JSON.stringify(window.__KM.M())));
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); await pg.keyboard.press('1');
await clk(100,200); await none(); await clk(300,200); await pg.keyboard.press('2'); await clk(500,200); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
const pt=pg.locator('[data-sn=pt]'); if(await pt.getAttribute('aria-pressed')==='true') await pt.click();
const d0=await KM(); const E=d0.lines[1].pts[1], K=d0.lines[1].pts[0];
await clk(520,214); await none(); await clk(250,400); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
let m=await KM(); const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
ok(m.lines.length===3&&d(m.lines[2].pts[0],E)<0.01,'Start 25 px neben dem Leitungsende rastet am Ende ein');
await clk(250,320); await none(); await clk(322,214); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
m=await KM(); ok(m.lines.length===4&&d(m.lines[3].pts[1],K)<0.01,'Ende 25 px neben dem Teilungsknoten (Oberflächenwechsel) rastet ein');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
