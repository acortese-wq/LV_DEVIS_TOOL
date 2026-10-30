const {chromium,ok,mk}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b);
await pg.fill('#f_graben_L','1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
const bx=await pg.locator('#kmMap').boundingBox(); await pg.click('[data-k=mline]');
for(const [dx,dy] of [[100,200],[300,100]]) await pg.mouse.click(bx.x+dx,bx.y+dy); await pg.click('[data-k=end]'); await pg.waitForTimeout(400);
const r=await pg.evaluate(()=>{const s=document.querySelector('.kmlbl.rot span'); if(!s) return null; const m=getComputedStyle(s).transform; return [s.getAttribute('style'), m];});
console.log(JSON.stringify(r)); ok(r&&/--a:-?[\d.]+deg/.test(r[0]),'Linienbeschriftung gedreht');
const a=parseFloat(/--a:(-?[\d.]+)deg/.exec(r[0])[1]); ok(Math.abs(a-(-26.6))<2,'Winkel ≈ Leitungsrichtung ('+a+'°)'); ok(a>=-90&&a<=90,'nie auf dem Kopf');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
