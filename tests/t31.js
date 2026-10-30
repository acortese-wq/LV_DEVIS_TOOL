const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<10;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(120);} await pg.waitForTimeout(500); const bx=await pg.locator('#kmMap').boundingBox(); await pg.click('[data-k=mline]');
const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(150);};
const ask=async(txt)=>{ await pg.locator('#kmAsk button',{hasText:txt}).first().click(); await pg.waitForTimeout(200); };
// Linie 1: Start neuer Schacht, Ende Anschluss an bestehenden (neu angelegt)
await clk(80,200); ok(await pg.isVisible('#kmAsk'),'Start: Auswahl am Klickpunkt erscheint'); ok((await pg.textContent('#kmAsk')).includes('Neuer Schacht hier')&&(await pg.textContent('#kmAsk')).includes('bestehenden Schacht')&&(await pg.textContent('#kmAsk')).includes('Ohne Schacht'),'Start: 3 Optionen');
ok(await pg.isVisible('#kmAsk select'),'Typ-Auswahl im Popup'); await pg.selectOption('#kmAsk select','KES175'); await ask('Neuer Schacht hier');
await clk(280,200); await pg.click('[data-k=end]'); await pg.waitForTimeout(300); ok(await pg.isVisible('#kmAsk'),'Ende: Auswahl erscheint');
const t=await pg.textContent('#kmAsk'); ok(['Neuer Schacht hier','bestehenden Schacht','Oberfläche wechselt','Nur Deckel','Ohne Schacht'].every(x=>t.includes(x)),'Ende: alle Optionen');
await ask('Anschluss an bestehenden Schacht');
// Linie 2 startet am bestehenden Schacht (Vorschlag)
await clk(280,203); const t2=await pg.textContent('#kmAsk'); ok(/entfernt, vorgeschlagen/.test(t2),'Start: nahen Schacht vorgeschlagen: '+t2.replace(/\s+/g,' ').slice(0,120));
await ask('Anschluss an bestehenden Schacht'); await clk(280,330); await pg.click('[data-k=end]'); await pg.waitForTimeout(300);
await ask('Oberfläche wechselt'); await pg.locator('#kmAsk button',{hasText:'Wiese'}).click(); await pg.waitForTimeout(200);
await clk(400,380); await pg.click('[data-k=end]'); await pg.waitForTimeout(300);
await ask('Nur Deckel');
let S1=await pg.evaluate(()=>0);
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe: '+JSON.stringify(ax));
// Typen setzen, übernehmen
await pg.evaluate(()=>{}); 
for(const sel of await pg.locator('#kmQuick select').all()){}
const nl=await pg.locator('.kmrow').count(); console.log('Zeilen',nl);
await pg.click('[data-k=apply]'); await pg.waitForTimeout(700);
const S=await getS(pg); const sc=S.recs.schacht; console.log(JSON.stringify(sc.map(r=>[r.modus,r.typ,r.anschl,r.deckelN])));
const K=S.karte; console.log('Linien',K.lines.length,'Punkte',JSON.stringify(K.pts.map(p=>[p.mode,p.id])),'s/e',JSON.stringify(K.lines.map(l=>[l.s,l.e])));
ok(sc.some(r=>r.modus==='neu'&&r.typ==='KES175'),'Schacht neu mit gewähltem Typ KES175 übernommen'); ok(sc.some(r=>r.modus==='anschluss'&&r.anschl==='2'),'Bestehender Schacht: 2 Anschlüsse (Linie 1 Ende + Linie 2 Start)'); ok(sc.some(r=>r.modus==='deckel'&&r.deckelN==='1'),'Nur Deckel: 1 Stück');
ok(K.lines.length===3&&K.lines.some(l=>l.cfg&&l.cfg.fl==='wiese'),'Folgeabschnitt mit anderer Oberfläche (Wiese)');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
