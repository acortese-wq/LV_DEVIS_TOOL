const {chromium,ok,mk,getS}=require('./lib/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(80);}
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);}; const mv=async(dx,dy)=>{await pg.mouse.move(bx.x+dx-6,bx.y+dy,{steps:3}); await pg.waitForTimeout(60); await pg.mouse.move(bx.x+dx,bx.y+dy); await pg.waitForTimeout(200);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
const pal=t=>pg.locator('#kmPal button',{hasText:t}).click();
const fail=process.argv[2]==='fail';
await pg.route('**/SearchServer**',async r=>{const q=decodeURIComponent(new URL(r.request().url()).searchParams.get('searchText')); const A=/Bahnhof/i.test(q); await r.fulfill({json:{results:[{attrs:{label:'<b>'+(A?'Bahnhofstrasse 1':'Poststrasse 5')+'</b> 7000 Chur',lat:A?46.8499:46.8530,lon:A?9.5320:9.5395}}]}});});
await pg.route('**/routed-foot/**',async r=>{ if(fail) return r.abort(); const c=[[9.5320,46.8499],[9.53205,46.85],[9.5330,46.8501],[9.5340,46.8505],[9.5350,46.8509],[9.5365,46.8514],[9.5380,46.8522],[9.5395,46.8530]]; await r.fulfill({json:{code:'Ok',routes:[{geometry:{type:'LineString',coordinates:c},distance:900}],waypoints:[{distance:7},{distance:12}]}});});
await pg.click('[data-k=route]'); await pg.waitForTimeout(300); ok(await pg.locator('#kmRoute').isVisible(),'Routen-Fenster öffnet');
ok(await pg.locator('#kmRtGo').isDisabled(),'«Route erstellen» zunächst gesperrt');
await pg.fill('#kmRtA','Bahnhofstrasse 1'); await pg.waitForSelector('#kmRtAh .kmhit'); await pg.click('#kmRtAh .kmhit');
await pg.fill('#kmRtB','Poststrasse 5'); await pg.waitForSelector('#kmRtBh .kmhit'); await pg.click('#kmRtBh .kmhit');
ok(await pg.locator('#kmRtGo').isEnabled(),'nach Auswahl beider Adressen freigegeben');
await pg.addScriptTag({path:require('./lib/k.js').AXE}); const ax=await pg.evaluate(()=>axe.run(document.querySelector('dialog[open]')).then(r=>r.violations.map(v=>v.id+' '+v.nodes.map(n=>n.target.join(' ')).join(';')))); ok(ax.length===0,'axe: '+JSON.stringify(ax));
await pg.click('#kmRtGo'); await pg.waitForTimeout(800);
const m=await pg.evaluate(()=>JSON.parse(JSON.stringify(window.__KM.M())));
if(fail){ ok(m.lines.length===0&&/nicht erreichbar/.test(await pg.textContent('#kmRtMsg')),'Fehlerfall: verständliche Meldung, keine Linie'); }
else {
ok(m.lines.length===1&&m.lines[0].route===1&&m.lines[0].pts.length>=2&&m.lines[0].pts.length<=8,'Linie aus Route erstellt ('+(m.lines[0]&&m.lines[0].pts.length)+' Punkte)');
const L=m.lines[0].pts; let len=0; for(let i=1;i<L.length;i++) len+=Math.hypot(L[i][0]-L[i-1][0],L[i][1]-L[i-1][1]); ok(len>600&&len<1000,'Länge plausibel: '+Math.round(len)+' m');
ok(/Route erstellt/.test(await pg.textContent('#kmRtMsg'))&&/Start 7 m, Ziel 12 m/.test(await pg.textContent('#kmRtMsg')),'Meldung mit Abstand zum Weg');
ok(await pg.locator('#kmTabP').getAttribute('aria-selected')==='true'&&/Fussweg-Route/.test(await pg.textContent('#kmObj')),'Eigenschaften: Hinweis «nur Vorschlag»');
ok(!m.lines[0].from&&!m.lines[0].to&&!m.lines[0].s&&!m.lines[0].e&&!m.lines[0].pv&&!m.lines[0].nx,'Routenlinie entsteht ohne Verbindungen'); ok(await pg.locator('#kmObj .kmrow.on button',{hasText:'Verbindung lösen'}).count()===0,'kein «Verbindung lösen» nötig');
await pg.click('#kmTabE'); await pg.waitForTimeout(300); ok(/Vorschläge/.test(await pg.textContent('#kmSug')),'Vorschlagsbereich vorhanden');
}
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
