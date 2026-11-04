const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); await pg.keyboard.press('1');
await clk(100,200); await none(); await clk(250,200);
await pg.keyboard.press('2'); await pg.waitForTimeout(300); ok(/Linie 2/.test(await pg.textContent('#kmObj')),'Taste 2 teilt die Linie');
ok(await pg.locator('#kmPal button[data-f=wiese]').getAttribute('aria-pressed')==='true','Palette zeigt Wiese aktiv');
ok(await pg.locator('#kmPal kbd').count()===4,'Tastenhinweise auf Palette');
await clk(400,200); await pg.keyboard.press('3'); await clk(500,200); await pg.keyboard.press('Control+4');
ok(await pg.locator('#kmPal button[data-f=pflaster]').getAttribute('aria-pressed')==='true','Strg+4 ignoriert, Pflästerung bleibt');
await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(400);
await pg.click('[data-k=apply]'); await pg.waitForTimeout(800); const S=await getS(pg); const fl=S.karte.lines.slice(0,3).map(l=>l.cfg&&l.cfg.fl).join(','); ok(fl==='belag,wiese,pflaster','Oberflächen per Taste: '+fl);
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
