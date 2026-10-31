const {chromium,ok,mk,getS}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); let pg=await mk(b,1600,1000);
const btn=async t=>{await pg.locator('#chPan button',{hasText:t}).last().click(); await pg.waitForTimeout(200);}; const last=()=>pg.locator('.chm.bot').last().textContent();
await pg.fill('#f_graben_L','100'); await pg.waitForTimeout(500); await pg.click('#chFab');
ok(await pg.locator('#chPan .chq button',{hasText:'Schachtabstand und Rohrbelegung'}).count()===1,'Startchips der Beratung');
await pg.locator('#chPan .chgrp summary').first().click(); await pg.locator('#chPan .chq button',{hasText:'Schachtabstand und Rohrbelegung'}).click(); await pg.waitForTimeout(200);
ok(/Welche Erschliessung/.test(await last()),'Frage 1'); await btn('Basis: Teilnehmerkabel Cu'); ok(/Wo liegt die Trasse/.test(await last()),'Frage 2 folgt'); ok(await pg.locator('.chopts button',{hasText:'Zurück'}).count()>=1,'Zurück-Knopf ab Frage 2');
await btn('In der Bauzone'); let t=await last(); console.log(t.slice(0,200)); ok(/ca\. 200–250 m/.test(t)&&/K100 ≥ 3 m/.test(t),'Empfehlung Richtabstand');
await btn('Richtabstand in der Karte einstellen'); const rc=await pg.evaluate(()=>JSON.parse(localStorage.getItem('lvd-km-rc'))); ok(rc.ersch==='basisCu'&&rc.zone==='in','Richtabstand gespeichert '+JSON.stringify(rc));
// Typ-Dialog mit Freitext und Karte
await pg.fill('#chPan textarea','welcher Schacht'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); ok(/Muffen/.test(await last()),'Freitext startet Beratung');
await pg.fill('#chPan textarea','4 Muffen'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); ok(/Wo liegt der Schacht/.test(await last()),'Freitext wählt Option');
await pg.fill('#chPan textarea','zurück'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); ok(/Muffen/.test(await last()),'«zurück» geht zur vorigen Frage');
await btn('4 Muffen'); await btn('Wiese'); t=await last(); ok(/KES 1\.50 × 1\.00 × 1\.75/.test(t)&&/DS400/.test(t),'Empfehlung KES175 + Abdeckung Wiese');
await pg.locator('#chPan button',{hasText:'Typ KES175 bei'}).first().click(); await pg.waitForSelector('.chcard'); ok(/Kostenwirkung/.test(await pg.textContent('.chcard')),'Vorschlagskarte für Schachttyp');
await pg.click('.chcard button:has-text("Übernehmen")'); await pg.waitForTimeout(500); let S=await getS(pg); ok(S.recs.schacht[0].typ==='KES175','Schachttyp nach Bestätigung gesetzt');
// Kostenteiler
await pg.fill('#chPan textarea','wer zahlt'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); await btn('Strassenneubau'); await btn('Ja'); t=await last(); ok(/Planum/.test(t)&&/anteilsmässig/.test(t),'Kostenteiler Neubau');
// Abbrechen
await pg.fill('#chPan textarea','Erschliessung wie'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); await btn('Abbrechen'); ok(/abgebrochen/.test(await last()),'Abbrechen');
// KB → geführte Beratung
await pg.fill('#chPan textarea','Gebäudeanschlüsse'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); ok(await pg.locator('.chopts button',{hasText:'Geführte Beratung: Gebäudeanschluss'}).count()===1,'KB-Antwort bietet Beratung an');
await btn('Geführte Beratung: Gebäudeanschluss'); await btn('Büro/Verwaltung/Industrie'); await btn('über 250 m'); await btn('Ja'); t=await last(); ok(/Zweitweganschluss/.test(t)&&/250 m/.test(t),'Gebäudeanschluss Büro, lang, Zweitweg');
await pg.addScriptTag({path:'/tmp/claude-0/lf/axe/package/axe.min.js'}); let ax=await pg.evaluate(()=>axe.run(document.body).then(r=>r.violations.map(v=>v.id+' '+v.nodes[0].target))); ok(ax.length===0,'axe: '+JSON.stringify(ax).slice(0,200));
// im Zeichnen-Dialog: Richtabstand direkt setzen
await pg.keyboard.press('Escape'); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800); await pg.click('dialog[open] #chFab');
await pg.fill('#chPan textarea','Schachtabstand Beratung'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); await btn('FK/RK-Trasse'); await btn('Ausserhalb der Bauzone'); await btn('Richtabstand in der Karte einstellen'); await pg.keyboard.press('Escape'); await pg.click('#kmTabE');
ok(await pg.inputValue('[data-rc=ersch]')==='fkrk'&&await pg.inputValue('[data-rc=zone]')==='aus','Beratung stellt Richtabstand in der offenen Karte ein');
ok(pg.errs.length===0,'keine JS-Fehler '+pg.errs.join('|')); await b.close();})();
