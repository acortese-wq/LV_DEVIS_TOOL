const {chromium,ok,mk,getS}=require('./lib/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
const KM=()=>pg.evaluate(()=>JSON.parse(JSON.stringify(window.__KM.M())));
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); await pg.keyboard.press('1');
await clk(100,200); await none(); await clk(500,200); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
// Belegung 3xK55 setzen
await pg.evaluate(()=>{const M=window.__KM.M(); M.lines[0].cfg.rt={55:3}; window.__KM.refresh();}); await pg.waitForTimeout(300);
// Punktfang aus: Leitungsende wird trotzdem gefangen
const pt=pg.locator('[data-sn=pt]'); if(await pt.getAttribute('aria-pressed')==='true') await pt.click();
await mv(104,203); const lab=await pg.locator('.kmsnap.pt i').first().textContent().catch(()=>''); ok(/Leitungsende|Schacht/.test(lab),'Leitungsende/Schacht wird immer gefangen: '+lab);
// Abzweig in der Mitte -> Rückfrage
await clk(300,200); await none(); await pg.waitForTimeout(200);
await mv(300,260); 
const ask=await pg.locator('#kmAsk').textContent().catch(()=>''); ok(/entnehmen/.test(ask)&&/T-Stück/.test(ask),'Rückfrage: Rohr entnehmen oder T-Stück ('+ask.slice(0,80)+')');
await pg.locator('#kmAsk button',{hasText:'1×K55 entnehmen'}).click(); await pg.waitForTimeout(300);
await clk(300,330); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(300);
let m=await KM(); const l0=m.lines[0], l1=m.lines[1], br=m.lines.find(l=>l.abz);
ok(m.lines.length===3&&l0.nx===l1.id&&JSON.stringify(l0.cfg.rt)==='{"55":3}'&&JSON.stringify(l1.cfg.rt)==='{"55":2}','Hauptleitung geteilt: 3×K55 → danach 2×K55 '+JSON.stringify([l0.cfg.rt,l1.cfg.rt]));
ok(br&&JSON.stringify(br.cfg.rt)==='{"55":1}'&&br.abz.mode==='entn','Abzweig 1×K55');
let chk=await pg.evaluate(()=>window.KARTE.live.check()); ok(!chk.some(x=>/Rohrbilanz|zweigt ohne Schacht/.test(x)),'Bilanz stimmt, keine offene Frage');
await pg.click('#kmTabE'); await pg.waitForTimeout(300); ok(/nur noch/.test(await pg.textContent('#kmChk')),'Auswertung nennt, wo nur noch 2 weitergehen');
// Bilanz stören
await pg.evaluate(()=>{const M=window.__KM.M(); M.lines[1].cfg.rt={55:3}; window.__KM.refresh();}); await pg.waitForTimeout(300);
chk=await pg.evaluate(()=>window.KARTE.live.check()); ok(chk.some(x=>/Rohrbilanz/.test(x)),'Rohrbilanz-Warnung bei Abweichung');
await pg.evaluate(()=>{const M=window.__KM.M(); M.lines[1].cfg.rt={55:2}; window.__KM.refresh();});
// KS: 4 K55
await pg.evaluate(()=>{const M=window.__KM.M(); const l=M.lines[0]; M.pts.push({id:'pX',pt:l.pts[0].slice(),typ:'KS80U',mode:'neu',name:'',fl:'belag'}); l.s='pX'; l.cfg.rt={55:4}; window.__KM.refresh();}); await pg.waitForTimeout(300);
chk=await pg.evaluate(()=>window.KARTE.live.check()); ok(chk.some(x=>/4×K55 passen nicht in einen Kontrollschacht/.test(x)),'KS mit 4×K55 gewarnt');
// Schacht Bilanz: 3 hinein, 1 hinaus
await pg.evaluate(()=>{const M=window.__KM.M(); const l=M.lines[0]; l.s=null; M.pts.length=0; M.pts.push({id:'pY',pt:l.pts[l.pts.length-1].slice(),typ:'KES150',mode:'neu',name:'',fl:'belag'}); M.lines[0].cfg.rt={55:3}; l.e=null; M.lines[1].s=null; M.lines[1].e='pY'; M.lines[1].cfg.rt={55:3}; M.lines[2].s='pY'; M.lines[2].cfg.rt={55:1}; window.__KM.refresh();}); await pg.waitForTimeout(300);
chk=await pg.evaluate(()=>window.KARTE.live.check()); ok(chk.some(x=>/hinein 3×K55, hinaus nur 1×K55/.test(x)||/hinein.*3×K55.*nur 1×K55/.test(x)),'Schacht: 3×K55 hinein, nur 1×K55 hinaus ('+chk.filter(x=>/hinaus/.test(x)).join('|')+')');
// Eigenschaften öffnen beim Anklicken
await pg.click('[data-k=medit]'); await pg.waitForTimeout(300); await pg.click('#kmTabE'); await pg.waitForTimeout(200);
await pg.mouse.click(bx.x+150,bx.y+200); await pg.waitForTimeout(400); ok(await pg.locator('#kmTabP').getAttribute('aria-selected')==='true','Anklicken öffnet Eigenschaften');
// Pfeil: 3 Grössen
await pg.click('[data-k=marrow]'); await clk(100,500); await clk(220,520); await pg.click('[data-k=medit]'); await pg.waitForTimeout(300);
await pg.locator('#kmObj .kmrow.on select').first().waitFor({timeout:3000}).catch(()=>{}); const szs=await pg.locator('#kmObj .kmrow.on select option').allTextContents(); ok(szs.length>=3&&await pg.locator('#kmObj .kmrow.on').count()===1,'Pfeil: Grösse wählbar '+szs.join('/'));
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
