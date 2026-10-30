const {chromium,fs,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
const rects=JSON.parse(fs.readFileSync('/tmp/claude-0/lf/au/rects.json'));
const MM=0.1764, ET=2660040, NT=1260055, XC=421, YC=297.5;   // Wahrheit: Plan-Mitte in LV95
(async()=>{const b=await chromium.launch(); const pg=await mk(b); const hp=await b.newPage();
await pg.route('**/*',async r=>{const u=r.request().url();
 if(u.endsWith('pdf.min.js')) return r.fulfill({body:fs.readFileSync('/tmp/claude-0/lf/pdfjs/package/build/pdf.min.js'),contentType:'application/javascript'});
 if(u.endsWith('pdf.worker.min.js')) return r.fulfill({body:fs.readFileSync('/tmp/claude-0/lf/pdfjs/package/build/pdf.worker.min.js'),contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});
 if(u.includes('SearchServer')&&u.includes('gg25')){ const m=/searchText=([^&]+)/.exec(u); const hit=decodeURIComponent(m[1])==='Boezberg'; return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({results:hit?[{attrs:{lat:47.4898,lon:8.2388,label:'Boezberg'}}]:[]})}); }
 if(u.includes('wms.geo.admin')&&u.includes('cadastralwebmap')&&u.includes('BBOX')){ const q=new URL(u).searchParams, bb=q.get('BBOX').split(',').map(Number), W=+q.get('WIDTH'), H=+q.get('HEIGHT');
   const data=await hp.evaluate(([bb,W,H,rects,MM,ET,NT,XC,YC])=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.strokeStyle='#000';x.lineWidth=1.2;
     const px=(e,n)=>[(e-bb[0])/(bb[2]-bb[0])*W,(bb[3]-n)/(bb[3]-bb[1])*H]; const E=(xp)=>ET+(xp-XC)*MM, N=(yp)=>NT+(yp-YC)*MM;
     rects.forEach(([xx,yy,w,h])=>{x.beginPath(); if(w===0||h===0){const a=px(E(xx),N(yy)),d=px(E(xx+w),N(yy+h)); x.moveTo(a[0],a[1]); x.lineTo(d[0],d[1]);} else {const p=[[xx,yy],[xx+w,yy],[xx+w,yy+h],[xx,yy+h]].map(t=>px(E(t[0]),N(t[1]))); x.moveTo(p[0][0],p[0][1]); p.slice(1).forEach(t=>x.lineTo(t[0],t[1])); x.closePath();} x.stroke();});
     return c.toDataURL('image/png').split(',')[1];},[bb,W,H,rects,MM,ET,NT,XC,YC]);
   return r.fulfill({body:Buffer.from(data,'base64'),contentType:'image/png',headers:{'access-control-allow-origin':'*'}}); }
 r.fallback();});
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
await pg.click('#kmOvD summary');
// A) Koordinatenraster
await pg.setInputFiles('#kmOvF','/tmp/claude-0/lf/au/grid.pdf'); await pg.waitForSelector('#kmOvAuto:not([hidden])',{timeout:20000});
console.log('Karte A:',(await pg.textContent('#kmOvAutoT')).trim());
ok(/Koordinatenraster/.test(await pg.textContent('#kmOvAutoT')),'A: Ausrichtung nach Koordinatenraster erkannt');
const oA=await pg.evaluate(()=>{const e=document.querySelector('#kmOvR'); return null}); 
await pg.click('[data-oa=ok]'); await pg.click('[data-k=apply]'); await pg.waitForTimeout(600);
let S=await getS(pg); const ov=S.karte.overlay; console.log('E,N',ov&&ov.E,ov&&ov.N,'mpp',ov&&ov.mpp,'conf',ov&&ov.conf,ov&&ov.autoSrc);
const eE=2760000+(421-100)*MM, eN=1190000+(297.5-100)*MM;
ok(ov&&Math.hypot(ov.E-eE,ov.N-eN)<1.5,'A: Plan-Mitte auf <1.5 m genau ('+(ov?Math.hypot(ov.E-eE,ov.N-eN).toFixed(2):'-')+' m)');
ok(ov&&ov.conf===true,'A: Bestätigung gespeichert');
// B) Ort + Abgleich
await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.click('#kmOvD summary').catch(()=>{});
await pg.click('[data-ov=x]').catch(()=>{});
await pg.setInputFiles('#kmOvF','/tmp/claude-0/lf/au/match.pdf'); await pg.waitForSelector('#kmOvAuto:not([hidden])',{timeout:60000});
console.log('Karte B:',(await pg.textContent('#kmOvAutoT')).trim());
ok(/Abgleich/.test(await pg.textContent('#kmOvAutoT')),'B: Ausrichtung durch Abgleich vorgeschlagen'); await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); const ax=await pg.evaluate(()=>axe.run(document).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe mit Vorschlagskarte: '+JSON.stringify(ax));
await pg.click('[data-oa=ok]'); await pg.click('[data-k=apply]'); await pg.waitForTimeout(600);
S=await getS(pg); const o2=S.karte.overlay; const d=o2?Math.hypot(o2.E-ET,o2.N-NT):999; console.log('B E,N',o2&&o2.E,o2&&o2.N,'Abweichung',d.toFixed(2),'m');
ok(d<5,'B: Plan-Mitte auf <5 m genau ('+d.toFixed(2)+' m)');
// C) echter Plan ohne Raster/Ort-Treffer, Verwerfen, Passpunkte-Weg
await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.click('#kmOvD summary').catch(()=>{}); await pg.click('[data-ov=x]').catch(()=>{});
await pg.setInputFiles('#kmOvF','/root/.claude/uploads/7f2175f6-f257-5f6f-bbf9-bd4217339f91/f2745209-105B_Situation_Strassenbau_500.pdf'); await pg.waitForFunction(()=>/Keine automatische|Abgleich|Koordinatenraster/.test(document.querySelector('#kmOvMsg').textContent+document.querySelector('#kmOvAutoT').textContent),{timeout:60000});
console.log('C:',(await pg.textContent('#kmOvMsg')).slice(0,60)); ok(/Keine automatische/.test(await pg.textContent('#kmOvMsg')),'C: ohne Raster/Treffer klare Meldung, Passpunkte bleiben möglich');
ok(await pg.isEnabled('[data-k=mgeo]'),'C: Passpunkte setzen verfügbar');
await pg.setInputFiles('#kmOvF','/tmp/claude-0/lf/au/match.pdf'); await pg.waitForSelector('#kmOvAuto:not([hidden])',{timeout:60000}); await pg.click('[data-oa=no]'); ok(await pg.isHidden('#kmOvAuto'),'Verwerfen blendet Vorschlag aus');
await pg.setInputFiles('#kmOvF','/tmp/claude-0/lf/au/match2.pdf'); await pg.waitForSelector('#kmOvAuto:not([hidden])',{timeout:60000}); await pg.click('[data-oa=ref]'); ok((await pg.getAttribute('[data-k=mgeo]','aria-pressed'))==='true','Verfeinern startet Passpunkt-Modus');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|'));
await b.close();})();
