const {chromium,ok,mk,getS}=require('./lib/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1600,1000); let calls=0;
await pg.route('**/rest/services/profile.json**',async r=>{calls++; const u=new URL(r.request().url()); const g=JSON.parse(u.searchParams.get('geom')); const n=+u.searchParams.get('nb_points'); let L=0; for(let i=1;i<g.coordinates.length;i++) L+=Math.hypot(g.coordinates[i][0]-g.coordinates[i-1][0],g.coordinates[i][1]-g.coordinates[i-1][1]); const arr=[]; for(let i=0;i<n;i++){const d=L*i/(n-1); arr.push({dist:d,alts:{COMB:500-30*Math.sin(Math.PI*d/L)},easting:0,northing:0});} await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(arr)});});
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
for(let i=0;i<9;i++){await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(100);} await pg.waitForTimeout(400);
const bx=await pg.locator('#kmMap').boundingBox(); const clk=async(dx,dy)=>{await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.waitForTimeout(350);};
const none=async()=>{ if(await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).count()) await pg.locator('#kmAsk button',{hasText:'Ohne Schacht'}).click(); };
await pg.click('[data-k=mline]'); await clk(100,200); await none(); await clk(500,200); await pg.click('[data-k=end]'); await none();
await pg.click('#kmTabE'); await pg.waitForTimeout(300); await pg.click('[data-hz=load]'); await pg.waitForTimeout(1200);
ok(calls===1,'Höhenprofil einmal geladen');
await pg.click('[data-pfb]'); await pg.waitForTimeout(500); ok(await pg.locator('#kmProf').isVisible(),'Längenprofil unter der Karte sichtbar'); ok(await pg.locator('#kmPfSvg').count()===1,'Diagramm vorhanden');
const chk=await pg.textContent('#kmChk'); ok(/Gelände fällt bis 30 m/.test(chk),'Warnung: Gelände fällt unter die Verbindungslinie (Brücke/Tal?)');
// Schacht setzen im Profil
const geo=async()=>pg.evaluate(()=>{const r=document.querySelector('#kmPfSvg').getBoundingClientRect(),W=+document.querySelector('#kmPfSvg').viewBox.baseVal.width;return {l:r.left,t:r.top,w:r.width,h:r.height,W}});
let G=await geo(); const px=f=>G.l+(46+f*(G.W-58))*(G.w/G.W);
await pg.click('[data-pf=pick]'); await pg.mouse.click(px(0.5),G.t+80); await pg.waitForTimeout(400);
ok(await pg.locator('#kmProf .pfm:not(.pffix)').count()===1,'Schacht im Profil gesetzt'); ok(await pg.locator('select[data-pf=line] option').count()===2,'Linie geteilt (2 Linien)'); ok(calls===1,'Profil nicht neu geladen (Teilprofile aus Stichproben)');
ok(!/Profil fehlt/.test(await pg.textContent('.kmpft')),'beide Hälften behalten ein gültiges Profil');
// ziehen
const lab0=await pg.getAttribute('#kmProf .pfm','aria-label'); const num=s=>parseFloat(s.match(/bei ([\d'.,]+) m/)[1].replace(/'/g,'').replace(',','.'));
const mr=await pg.locator('#kmProf .pfm rect').boundingBox(); await pg.mouse.move(mr.x+mr.width/2,mr.y+mr.height/2); await pg.mouse.down(); await pg.mouse.move(mr.x+mr.width/2+90,mr.y+mr.height/2,{steps:6}); ok(/zum vorigen Knoten/.test(await pg.textContent('#kmPfTip')),'Live-Abstände beim Ziehen'); await pg.mouse.up(); await pg.waitForTimeout(400);
const lab1=await pg.getAttribute('#kmProf .pfm','aria-label'); ok(num(lab1)>num(lab0)+5,'Schacht per Ziehen verschoben ('+num(lab0)+' → '+num(lab1)+' m)'); ok(calls===1,'weiterhin kein Neuladen');
await pg.locator('#kmProf .pfm').focus(); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(300); const lab2=await pg.getAttribute('#kmProf .pfm','aria-label'); ok(Math.abs(num(lab2)-num(lab1)-1)<0.2,'Pfeiltaste verschiebt um 1 m ('+num(lab1)+' → '+num(lab2)+')');
ok(await pg.evaluate(()=>document.activeElement.classList.contains('pfm')),'Fokus bleibt am Schacht');
await pg.keyboard.press('Shift+ArrowLeft'); await pg.waitForTimeout(300); const lab3=await pg.getAttribute('#kmProf .pfm','aria-label'); ok(Math.abs(num(lab2)-num(lab3)-10)<0.2,'Umschalt+Pfeil = 10 m');
// Abschnittsart Luft
await pg.locator('select[data-pf=art]').nth(1).selectOption('luft'); await pg.waitForTimeout(400);
ok(/nicht im Graben/.test(await pg.textContent('#kmEval')),'Auswertung: davon nicht im Graben'); ok(/Luft\/Bohrung – nicht als Graben kalkuliert/.test(await pg.textContent('#kmChk')),'Prüfhinweis Luft/Bohrung');
ok(await pg.locator('#kmProf .pfgl').count()>=1&&await pg.locator('#kmProf polyline.pfl').count()>=1,'Gelände und Rohrachse als getrennte Linien');
await pg.fill('[data-pf=covmin]','0.8'); await pg.dispatchEvent('[data-pf=covmin]','change'); await pg.waitForTimeout(300); ok(/Überdeckung 0[.,]5 m unter dem Mindestwert 0.8 m/.test(await pg.textContent('#kmChk')),'Warnung: Überdeckung unter Mindestwert');
await pg.locator('input[data-pf=cov]').first().fill('1.2'); await pg.locator('input[data-pf=cov]').first().dispatchEvent('change'); await pg.waitForTimeout(300); ok(!/Überdeckung .* unter dem Mindestwert/.test(await pg.textContent('#kmChk')),'Überdeckung je Linie übersteuert → Warnung weg');
await pg.fill('[data-pf=covmax]','1.0'); await pg.dispatchEvent('[data-pf=covmax]','change'); await pg.waitForTimeout(300); ok(/über dem Höchstwert 1 m/.test(await pg.textContent('#kmChk')),'Warnung: über Höchstwert');
const r2=await pg.locator('#kmPfSvg').boundingBox(); await pg.mouse.move(r2.x+r2.width*0.2,r2.y+60); await pg.waitForTimeout(150); ok(/Überdeckung 1[.,]2 m/.test(await pg.textContent('#kmPfTip')),'Tooltip zeigt Überdeckung');
await pg.fill('[data-pf=covmin]',''); await pg.dispatchEvent('[data-pf=covmin]','change'); await pg.fill('[data-pf=covmax]',''); await pg.dispatchEvent('[data-pf=covmax]','change'); await pg.waitForTimeout(200);
await pg.addScriptTag({path:require('./lib/k.js').AXE}); const ax=await pg.evaluate(()=>axe.run(document.querySelector('dialog[open]')).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe: '+JSON.stringify(ax).slice(0,250));
await pg.click('[data-k=apply]'); await pg.waitForTimeout(700); let S=await getS(pg);
ok(S.karte.lines.length===2&&S.karte.lines[1].hzArt==='luft','Abschnittsart gespeichert'); ok(S.recs.graben.length===1,'Luftabschnitt nicht als Graben übernommen (Graben-Datensätze: '+S.recs.graben.length+')');
const L0=parseFloat(S.recs.graben[0].L); console.log('Graben-L',L0); ok(L0>50&&L0<250,'Grabenlänge = nur Geländeabschnitt');
// Löschen
await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(700); await pg.click('[data-pfb]').catch(()=>{}); if(!(await pg.locator('#kmProf').isVisible())) await pg.click('[data-pfb]'); await pg.waitForTimeout(400);
await pg.locator('#kmProf .pfm').first().focus(); await pg.keyboard.press('Delete'); await pg.waitForTimeout(400); ok(await pg.locator('select[data-pf=line] option').count()===1&&await pg.locator('#kmProf .pfm').count()===0,'Schacht gelöscht, Linien wieder zusammengeführt');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|'));
await b.close();})();
