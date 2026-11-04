const {chromium,ok,mk,getS}=require('./lib/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
ok(!(await pg.locator('#kmPal').isVisible()),'Palette ohne Zeichenmodus ausgeblendet');
await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); ok(await pg.locator('#kmPal').isVisible()&&await pg.locator('#kmPal .kmpalb').count()===4,'Palette Belag/Wiese/Pflästerung/Rohplanie beim Zeichnen sichtbar');
await pal('Belag'); await clk(100,200); await none(); await clk(250,200); await pal('Wiese'); await pg.waitForTimeout(300); ok(/Linie 2/.test(await pg.textContent('#kmObj')),'Wechsel teilt die Linie (Linie 2 entsteht)'); ok((await pg.getAttribute('#kmPal button:has-text("Wiese")','aria-pressed'))==='true','Palette zeigt aktive Oberfläche');
await clk(400,200); await pal('Pflästerung'); await clk(500,200); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(400);
ok(/3 Linie/.test(await pg.textContent('#kmSum')),'drei Teilstrecken');
await pg.click('#kmTabE'); await pg.waitForTimeout(300); const chk=await pg.textContent('#kmChk'); ok(!/Linie 2: Anfang ohne Schacht/.test(chk)&&!/Linie 1: Ende ohne Schacht/.test(chk)&&!/Linie 3: Anfang ohne Schacht/.test(chk)&&!/Linie 2: Ende ohne Schacht/.test(chk),'Knoten ohne Schacht lösen keine Topologie-Warnung aus'); ok(/Linie 3: Ende ohne Schacht/.test(chk),'Linienende ohne Schacht wird weiterhin gemeldet');
await pg.click('#kmTabP'); 
// Hauseinführung: Fang auf Leitung
await pg.click('[data-k=mgeb]'); await mv(150,209); ok(await pg.locator('.kmsnap.ln').count()===1&&/auf Leitung/.test(await pg.textContent('.kmsnap.ln i')),'Hauseinführung rastet auf der Leitung ein'); await clk(150,209); await pg.waitForTimeout(300); ok(/Liegt auf Linie 1/.test(await pg.textContent('#kmObj')),'Hauseinführung merkt sich die Linie');
// Linienende rastet an der Hauseinführung ein
await pg.click('[data-k=mline]'); await clk(150,320); await none(); await mv(158,206); ok(await pg.locator('.kmsnap.geb').count()===1&&/Hauseinführung/.test(await pg.textContent('.kmsnap.geb i')),'Linienende rastet an der Hauseinführung ein'); await clk(158,206); await pg.click('[data-k=end]'); await none(); await pg.waitForTimeout(400);
ok(/Angeschlossen an Linie 4/.test(await pg.textContent('#kmObj')),'Hauseinführung ist mit der Anschlusslinie verknüpft');
// Gebäudekante
await pg.click('[data-k=mrect]'); await clk(600,300); await clk(720,390); await pg.waitForTimeout(200); await pg.click('[data-k=mgeb]'); await mv(660,305); ok(await pg.locator('.kmsnap.kante').count()===1&&/Gebäudekante/.test(await pg.textContent('.kmsnap.kante i')),'Hauseinführung rastet an der Gebäudekante (Rechteck) ein'); await mv(603,303); ok(/Gebäudeecke/.test(await pg.textContent('.kmsnap.kante i')),'… und an der Gebäudeecke');
await pg.addScriptTag({path:require('./lib/k.js').AXE}); await pg.click('[data-k=mline]'); await pg.waitForTimeout(300); const ax=await pg.evaluate(()=>axe.run(document.querySelector('dialog[open]')).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe: '+JSON.stringify(ax).slice(0,200));
await pg.click('[data-k=apply]'); await pg.waitForTimeout(800); const S=await getS(pg); const fl=S.karte.lines.slice(0,3).map(l=>l.cfg&&l.cfg.fl).join(','); ok(fl==='belag,wiese,pflaster','Oberflächen gespeichert ('+fl+')'); ok(S.recs.graben.length>=4,'je Teilstrecke ein Graben-Datensatz ('+S.recs.graben.length+')'); ok(S.karte.geb.length===1&&!!S.karte.geb[0].lid,'Verknüpfung Linie–Hauseinführung gespeichert');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
