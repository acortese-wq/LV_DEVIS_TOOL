const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
const bx=await pg.locator('#kmMap').boundingBox();
async function line(dx,dy){ if((await pg.getAttribute('[data-k=mline]','aria-pressed'))!=='true') await pg.click('[data-k=mline]'); const X=bx.x+80+dx, Y=bx.y+120+dy; await pg.mouse.click(X,Y); await pg.waitForTimeout(100); await pg.mouse.click(X+150,Y+10); await pg.waitForTimeout(100); await pg.click('[data-k=end]'); await pg.waitForTimeout(250); }
await line(0,0);
await pg.click('#kmQuick [data-t="55"] button:last-of-type'); await pg.selectOption('#kmQuick select >> nth=1','pflaster');
ok(await pg.isVisible('#kmQuick select >> nth=2'),'Abbruch-Auswahl nur bei Pflästerung sichtbar');
await pg.click('#kmQuickOk');
await line(0,60); // erbt Pflästerung
await pg.click('[data-k=mpt]'); await pg.mouse.click(bx.x+300,bx.y+200); await pg.waitForTimeout(150);
await pg.click('[data-k=mwl]'); await pg.selectOption('#kmWlT','ts'); await pg.mouse.click(bx.x+330,bx.y+220); await pg.waitForTimeout(150);
// Linienstil/Legende
ok(await pg.isVisible('#kmLeg'),'Legende sichtbar'); console.log('Legende:',(await pg.textContent('#kmLeg')).trim());
const dash=await pg.evaluate(()=>[...document.querySelectorAll('.leaflet-overlay-pane path')].map(p=>p.getAttribute('stroke-dasharray')+'|'+p.getAttribute('stroke')).slice(0,6));
console.log('Striche',JSON.stringify(dash)); ok(dash.some(d=>d.startsWith('9, 5')||d.startsWith('9 5')),'Pflästerung gestrichelt');
// Einklappen
const n=await pg.locator('.kmrow').count(); ok(n>=3,'Zeilen '+n);
await pg.click('#kmFoldAll'); ok((await pg.locator('.kmrow.kmclosed').count())===n,'Alle einklappen');
ok(await pg.locator('.kmrow >> nth=0 >> .kmsm').isVisible(),'Kurzinfo im Kopf: '+(await pg.locator('.kmrow >> nth=0 >> .kmsm').textContent()));
await pg.locator('.kmrow >> nth=0 >> .kmfold').click(); ok(!(await pg.locator('.kmrow >> nth=0').getAttribute('class')).includes('kmclosed'),'Einzelnes Objekt aufklappen');
// Kostenvorschau
await pg.waitForTimeout(900); const ct=await pg.textContent('#kmCost'); console.log('Kosten:',ct); ok(/CHF/.test(ct),'Kostenvorschau');
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe Karte mit Einklappen/Legende/Kosten: '+JSON.stringify(ax));
// Übernahme
await pg.click('[data-k=apply]'); await pg.waitForTimeout(700);
const S=await getS(pg); const g=S.recs.graben; console.log(JSON.stringify(g.map(x=>[x.belag.mode,x.belag.pflaster&&x.belag.pflaster.abbruchAlt,x.belag.pflaster&&x.belag.pflaster.abbruchArt])));
ok(g.every(x=>x.belag.mode==='pflaster'&&x.belag.pflaster.abbruchAlt===true),'Pflästerung inkl. Abbruch im Datensatz');
ok(S.recs.schacht.some(r=>r.belag.mode==='pflaster'&&r.belag.pflaster.abbruchAlt),'Schacht erbt Oberfläche Pflästerung');
ok(S.recs.werkloch.some(r=>r.belag.mode==='pflaster'),'Werkloch erbt Oberfläche');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|'));
await pg.waitForTimeout(500); if(await pg.locator('#situExp').count()){ await pg.click('#situExp'); await pg.waitForSelector('dialog.kmexp[open]'); await pg.waitForTimeout(800); const sv=await pg.evaluate(()=>{const e=document.querySelector('dialog.kmexp'); return e?e.innerHTML:''}); ok(/stroke-dasharray/.test(sv)&&/Pflästerung/.test(sv),'Export: Linienart gestrichelt + Legende «Pflästerung»'); }
ok(pg.errs.length===0,'keine JS-Fehler Export '+pg.errs.join('|'));
await b.close();})();
