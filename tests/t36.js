const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(100);} await pg.waitForTimeout(400);
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(300);};
ok(await pg.isVisible('#kmMk'),'Marker-Katalog sichtbar');
// Vorbelegung: 2×K100 + Pflästerung + KES175
await pg.locator('#kmMk button',{hasText:'2×K100'}).first().click(); await pg.locator('#kmMk button',{hasText:'Pflästerung'}).click(); await pg.locator('#kmMk button',{hasText:'KES175'}).click();
ok((await pg.locator('#kmMk button',{hasText:'2×K100'}).first().getAttribute('aria-pressed'))==='true','Preset markiert (aria-pressed)');
await pg.click('[data-k=mline]'); await clk(150,250); await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); await clk(450,250); await pg.click('[data-k=end]'); await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click();
ok(!(await pg.isVisible('#kmQuick')),'Linie übernimmt Vorbelegung: keine Rückfrage nötig'); 
// Auswertung
await pg.click('#kmTabE'); const ev=await pg.textContent('#kmEval'); console.log(ev.replace(/\s+/g,' ').slice(0,220)); ok(/K100/.test(ev)&&/Pflästerung/.test(ev)&&/m/.test(ev),'Auswertung: Rohrlänge je Typ und Oberfläche'); ok((await pg.textContent('#kmCost')).includes('CHF'),'Kostenvorschau in der Auswertung'); await pg.click('#kmTabP');
// Koordinate / Massstab
await pg.mouse.move(bx.x+300,bx.y+200); await pg.waitForTimeout(200); ok(/E [\d’'.]+ \/ N [\d’'.]+/.test(await pg.textContent('#kmCoord')),'Cursor-Koordinate LV95: '+await pg.textContent('#kmCoord')); ok(/^1 : [\d’'.]+/.test(await pg.textContent('#kmScale')),'Massstab: '+await pg.textContent('#kmScale'));
// Punktfang: Klick 6 px neben dem Linienende rastet ein
await pg.click('[data-k=mline]'); await pg.click('[data-k=mline]'); await clk(456,252); await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); await clk(456,360); await pg.click('[data-k=end]'); await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click();
await pg.click('[data-k=apply]'); await pg.waitForTimeout(600); let S=await getS(pg); const L=S.karte.lines; console.log(JSON.stringify(L.map(l=>l.pts[0])),JSON.stringify(L[0].pts[1]));
ok(L.length===2&&Math.hypot(L[1].pts[0][0]-L[0].pts[1][0],L[1].pts[0][1]-L[0].pts[1][1])<0.01,'Punktfang: Startpunkt = Endpunkt der ersten Linie');
ok(L[0].cfg.rt['100']===2&&L[0].cfg.fl==='pflaster','Linie: 2×K100, Pflästerung');
ok(S.recs.graben.every(g=>g.belag.mode==='pflaster'&&g.belag.pflaster.abbruchAlt),'Datensatz: Pflästerung inkl. Abbruch');
// Winkelraster
await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(600); await pg.click('[data-sn=ortho]'); await pg.click('[data-sn=pt]');
const bx2=await pg.locator('#kmMap').boundingBox(); await pg.click('[data-k=mline]'); await pg.mouse.click(bx2.x+200,bx2.y+100); await pg.waitForTimeout(300); await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click().catch(()=>{}); await pg.mouse.click(bx2.x+400,bx2.y+160); await pg.waitForTimeout(300); await pg.click('[data-k=end]'); await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click().catch(()=>{});
await pg.click('[data-k=apply]'); await pg.waitForTimeout(500); S=await getS(pg); const l3=S.karte.lines[S.karte.lines.length-1]; const ang=Math.abs(Math.atan2(l3.pts[1][1]-l3.pts[0][1],l3.pts[1][0]-l3.pts[0][0])*180/Math.PI)%45; ok(ang<0.5||ang>44.5,'Winkelraster: Segment auf 45°-Vielfaches ('+ang.toFixed(2)+')');
await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe Arbeitsfläche: '+JSON.stringify(ax).slice(0,200));
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
