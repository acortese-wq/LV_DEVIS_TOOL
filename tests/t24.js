const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
async function draw(dx){ if((await pg.getAttribute('[data-k=mline]','aria-pressed'))!=='true') await pg.click('[data-k=mline]'); const bx=await pg.locator('#kmMap').boundingBox(); const X=bx.x+100+dx, Y=bx.y+150; await pg.mouse.click(X,Y); await pg.waitForTimeout(120); await pg.mouse.click(X+200,Y+40); await pg.waitForTimeout(120); await pg.click('[data-k=end]'); await pg.waitForTimeout(300); }
await draw(0);
ok(await pg.isVisible('#kmQuick'),'Schnellkarte erscheint nach dem Zeichnen');
ok(await pg.isDisabled('#kmQuickOk'),'OK gesperrt solange Angaben fehlen');
for(let i=0;i<2;i++) await pg.click('#kmQuick [data-t="100"] button:last-of-type');
for(let i=0;i<3;i++) await pg.click('#kmQuick [data-t="55"] button:last-of-type');
await pg.selectOption('#kmQuick select >> nth=0','beton'); await pg.selectOption('#kmQuick select >> nth=1','belag');
ok(!(await pg.isDisabled('#kmQuickOk')),'OK frei nach Rohren + Oberfläche');
ok((await pg.textContent('#kmQuick .kmsum')).includes('2×K100 + 3×K55'),'Zusammenfassung: '+(await pg.textContent('#kmQuick .kmsum')));
console.log('xs svgs',await pg.locator('#kmObj .kmrow.on .kmxs svg').count(), (await pg.innerHTML('#kmObj .kmrow.on .kmxs')).slice(0,80)); ok(await pg.locator('#kmObj .kmrow.on .kmxs svg').count()>=1,'Querschnitt sichtbar');
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe Schnellkarte+Editor: '+JSON.stringify(ax)); await pg.click('#kmQuickOk');
// zweite Linie erbt, Kies, Rohplanie
await draw(0); ok(!(await pg.isVisible('#kmQuick')),'zweite Linie erbt Angaben (keine Abfrage)');
const row=pg.locator('.kmrow >> nth=1');
await row.locator('select >> nth=0').selectOption('kies'); await row.locator('select >> nth=1').selectOption('roh');
await pg.screenshot({path:'/tmp/claude-0/lf/q2.png'}); await pg.click('[data-k=apply]'); await pg.waitForTimeout(600);
const S=await getS(pg); const G=S.recs.graben;
console.log(JSON.stringify(G.map(g=>({sys:g.rohrSystem,bl:(g.bloecke||[]).map(x=>x.dn+'x'+x.n),blk:g.block,roh:g.roh,bel:g.belag.mode,dn:g.dn,n:g.n}))));
ok(G.length===2&&G[0].rohrSystem==='block'&&G[0].bloecke.length===2&&G[0].belag.mode==='bit'&&!G[0].roh,'Linie 1: Rohrblock 2×K100+3×K55, Belag');
ok(G[1].rohrSystem==='k55'&&G[1].roh===true&&G[1].belag.mode==='none','Linie 2: Kies, Rohplanie');
console.log('rohr recs',JSON.stringify(S.recs.rohr.map(r=>[r.name,r.lineMap,r.rohre])));
ok(S.recs.rohr.some(r=>r.lineMap&&r.rohre.some(x=>x.typ==='K100 PEHD')),'Zusatz-Rohranlage für zweiten Typ (2×K100 Haupt, 3×K55? )');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|'));
await b.close();})();
