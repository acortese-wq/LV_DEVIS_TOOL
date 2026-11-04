const {chromium,ok,mk,getS}=require('./lib/k.js');
(async()=>{const b=await chromium.launch(); let pg=await mk(b,1600,1000);
await pg.fill('#f_graben_L','100'); await pg.waitForTimeout(500);
ok(await pg.locator('#bHelp').isVisible(),'Knopf «Anleitung» im Kopf'); await pg.click('#bHelp'); await pg.waitForSelector('#helpDlg[open]');
ok(await pg.locator('#hpNav button').count()===13,'13 Kapitel im Inhaltsverzeichnis'); ok(/1\. Schnellstart/.test(await pg.textContent('#hpBody h2')),'Kapitel 1 Schnellstart');
await pg.fill('#hpQ','Überdeckung'); await pg.waitForTimeout(200); ok(await pg.locator('.hpres button').count()>=1,'Suche liefert Treffer'); await pg.locator('.hpres button').first().click(); await pg.waitForTimeout(200); ok(await pg.locator('#hpBody mark').count()>=1,'Treffer im Kapitel markiert');
await pg.addScriptTag({path:require('./lib/k.js').AXE}); let ax=await pg.evaluate(()=>axe.run(document.querySelector('#helpDlg')).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe Anleitung: '+JSON.stringify(ax).slice(0,200));
// alle Kapitel in 4 Sprachen
const ok4=await pg.evaluate(()=>window.LVHELP.every(c=>c.t.every(x=>x&&x.length>2)&&c.b.every(x=>x&&x.length>150))); ok(ok4,'alle Kapitel in DE/FR/IT/EN vorhanden');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); ok(!(await pg.locator('#helpDlg').evaluate(d=>d.open)),'Esc schliesst die Anleitung');
// Sprache
await pg.click('[data-lang=fr]'); await pg.waitForTimeout(300); await pg.click('#bHelp'); await pg.waitForSelector('#helpDlg[open]'); ok(/Démarrage rapide/.test(await pg.textContent('#hpBody h2')),'Anleitung folgt der Sprache (FR)'); ok((await pg.textContent('#bHelp'))==='Aide','Knopf beschriftet (FR)'); await pg.keyboard.press('Escape'); await pg.click('[data-lang=de]'); await pg.waitForTimeout(300);
// F1 + kontextbezogen
await pg.click('[data-tab=schacht]'); await pg.waitForTimeout(300); await pg.keyboard.press('F1'); await pg.waitForSelector('#helpDlg[open]'); ok(/Datensätze erfassen/.test(await pg.textContent('#hpBody h2')),'F1 öffnet Kapitel zum Reiter'); ok(await pg.evaluate(()=>document.activeElement.id)==='h-tab-schacht','Sprung zum Abschnitt «Schacht»'); await pg.keyboard.press('Escape');
await pg.click('#hpTabBtn'); await pg.waitForSelector('#helpDlg[open]'); ok(await pg.evaluate(()=>document.activeElement.id)==='h-tab-schacht','«?» beim Reiter springt ebenfalls'); await pg.keyboard.press('Escape');
// im Zeichnen-Dialog
await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open] #kmMap'); await pg.waitForTimeout(700); await pg.click('[data-hpk]'); await pg.waitForSelector('#helpDlg[open]'); ok(/Karte: Zeichnen/.test(await pg.textContent('#hpBody h2')),'«?» im Zeichnen-Dialog öffnet Kapitel Karte');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); ok(await pg.locator('dialog[open] #kmMap').count()===1,'Esc schliesst nur die Anleitung, Karte bleibt'); await pg.click('[data-k=apply]').catch(()=>{}); await pg.waitForTimeout(400); if(await pg.locator('dialog[open] #kmMap').count()) await pg.click('[data-k=close]').catch(()=>{});
await pg.waitForTimeout(300);
// Assistent verweist auf Anleitung
if(!(await pg.locator('#chPan').isVisible())) await pg.click('#chFab'); await pg.fill('#chPan textarea','Anleitung'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(250); ok(await pg.locator('#chPan button',{hasText:'Anleitung öffnen: Schnellstart'}).count()===1,'Assistent bietet «Anleitung öffnen»'); await pg.locator('#chPan button',{hasText:'Anleitung öffnen'}).click(); await pg.waitForSelector('#helpDlg[open]'); ok(true,'öffnet'); await pg.keyboard.press('Escape');
// Druck
await pg.evaluate(()=>{window.print=()=>{window.__pr=document.querySelector('.hpall').textContent.length; window.__prc=document.body.classList.contains('print-help');};}); await pg.click('#bHelp'); await pg.waitForSelector('#helpDlg[open]'); await pg.click('#hpPrintAll'); await pg.waitForTimeout(300); ok(await pg.evaluate(()=>window.__pr>8000&&window.__prc),'Alles drucken: ganze Anleitung im Druckbereich ('+await pg.evaluate(()=>window.__pr)+' Zeichen)'); await pg.waitForTimeout(1700); ok(await pg.evaluate(()=>!document.body.classList.contains('print-help')),'Druckmodus wird danach beendet');
// Beispielprojekt
await pg.waitForSelector('#helpDlg[open]').catch(()=>{}); if(!(await pg.locator('#helpDlg').evaluate(d=>d.open))) await pg.click('#bHelp'); await pg.click('#hpDemo'); await pg.waitForTimeout(700); let S=await getS(pg); ok(/Beispielprojekt/.test(S.kopf.projekt)&&S.recs.graben.length>=3,'Beispielprojekt geladen'); ok(S.karte.lines.length===4,'Beispiel enthält Zeichnung (4 Linien)'); ok(await pg.locator('#helpDlg').evaluate(d=>!d.open),'Anleitung schliesst nach dem Laden');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|'));
let p2=await mk(b,390,800); await p2.click('#bHelp'); await p2.waitForSelector('#helpDlg[open]'); await p2.waitForTimeout(300); ok(await p2.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#helpDlg').scrollWidth<=document.querySelector('#helpDlg').clientWidth+1),'Handy 390 px ohne Seitenüberlauf'); ok(p2.errs.length===0,'keine JS-Fehler (Handy)');
await b.close();})();
