const {chromium,ok,mk}=require('./lib/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b,1400,900); const rel=!!process.env.LVD_RELEASE;   /* Weitergabe-Version prüfen: LVD_RELEASE=1 LVD_URL=file:///…/dist/…html */
await pg.waitForTimeout(500); const vl=await pg.textContent('#versionline'); const wm=await pg.locator('#wmark').count();
if(rel){ ok(/Lizenziert für .* · © Alessandro Cortese/.test(vl),'Weitergabe-Version: Empfänger in der Versionszeile'); ok(wm===1,'Wasserzeichen-Element für den Druck vorhanden'); ok((await pg.evaluate(()=>getComputedStyle(document.querySelector('#wmark')).display))==='none','auf dem Bildschirm unsichtbar (nur Druck)'); await pg.emulateMedia({media:'print'}); ok((await pg.evaluate(()=>getComputedStyle(document.querySelector('#wmark')).display))==='block','im Druck sichtbar'); }
else { ok(!/Lizenziert für/.test(vl)&&wm===0,'Entwicklungsversion ohne Empfängername'); }
ok(await pg.evaluate(()=>/Alessandro Cortese/.test(document.documentElement.outerHTML)&&!!document.querySelector('meta[name=author][content="Alessandro Cortese"]')),'Urheber-Vermerk (meta author) vorhanden');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
