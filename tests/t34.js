const {chromium,ok,mk}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<8;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(100);} 
await pg.evaluate(()=>{window.__o=[]; window.open=(u)=>{window.__o.push(u)}});
const bx=await pg.locator('#kmMap').boundingBox(); await pg.mouse.click(bx.x+300,bx.y+150,{button:'right'}); await pg.waitForTimeout(250);
ok((await pg.textContent('#kmCtx')).includes('Street View hier öffnen'),'Menü: Street View'); ok(!(await pg.textContent('#kmCtx')).includes('einbetten'),'ohne Schlüssel kein Einbetten');
await pg.locator('#kmCtx button',{hasText:'Street View'}).click(); const u=await pg.evaluate(()=>window.__o[0]); console.log(u); ok(/map_action=pano&viewpoint=4[67]\.\d+,\d+\.\d+/.test(u||''),'Street-View-Link mit Koordinate (WGS84)');
await pg.click('[data-k=sv]'); ok((await pg.evaluate(()=>window.__o.length))===2,'Toolbar-Knopf öffnet Street View');
// Linie + Richtung
await pg.click('[data-k=mline]'); await pg.waitForTimeout(400); await pg.mouse.click(bx.x+100,bx.y+250); await pg.waitForTimeout(400); await pg.mouse.click(bx.x+400,bx.y+250); await pg.waitForTimeout(300); await pg.click('[data-k=end]');
await pg.mouse.click(bx.x+250,bx.y+250,{button:'right'}); await pg.waitForTimeout(250); await pg.locator('#kmCtx button',{hasText:'Street View'}).click(); const u2=await pg.evaluate(()=>window.__o[2]); console.log(u2); ok(/heading=(8\d|9\d)\b/.test(u2||''),'Blickrichtung entlang der Linie (Ost ≈ 90°)');
// Schlüssel -> Einbetten
await pg.evaluate(()=>{window.prompt=()=>'TESTKEY123'}); await pg.click('[data-k=svkey]'); await pg.waitForTimeout(200);
await pg.mouse.click(bx.x+250,bx.y+100,{button:'right'}); await pg.waitForTimeout(250); ok((await pg.textContent('#kmCtx')).includes('einbetten'),'mit Schlüssel: Einbetten angeboten'); await pg.locator('#kmCtx button',{hasText:'einbetten'}).click(); await pg.waitForTimeout(200);
const src=await pg.getAttribute('#kmSv iframe','src'); console.log(src); ok(/embed\/v1\/streetview\?key=TESTKEY123&location=/.test(src||''),'Eingebettetes Street View (Embed-URL)');
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document,{rules:{'frame-tested':{enabled:false}}}).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe: '+JSON.stringify(ax));
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
