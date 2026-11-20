/* t122: Audit 11/2026 – Meta-Tags (Open Graph, canonical, hreflang, JSON-LD, CSP), Einleitung mit Kontakt, Impressum mit Datenschutz-Link,
   Sprache aus der Adresse (?lang=fr), Druckmenü, eingebettete Kartenbibliothek (ohne cdnjs), keine interne SharePoint-Adresse in der öffentlichen Version,
   Assistent-Knopf am Handy nicht über den Reitern */
const K = require('./lib/k.js'), { chromium, ok, mk, INDEX } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route(/cdnjs\.cloudflare\.com/, r => r.abort());   /* Kartenbibliothek muss ohne cdnjs vorhanden sein */
  const m = await pg.evaluate(() => { const q = s => document.querySelector(s), a = (s, at) => (q(s) || {}).getAttribute ? q(s).getAttribute(at) : null; let ld = null; try { ld = JSON.parse(q('script[type="application/ld+json"]').textContent); } catch (e) { }
    return { og: ['og:title', 'og:description', 'og:url', 'og:image', 'og:type'].every(p => a('meta[property="' + p + '"]', 'content')), canon: a('link[rel=canonical]', 'href'), hl: document.querySelectorAll('link[rel=alternate][hreflang]').length, ld: ld && ld['@type'], theme: a('meta[name=theme-color]', 'content'), csp: a('meta[http-equiv="Content-Security-Policy"]', 'content'), L: !!(window.L && window.L.map) }; });
  ok(m.og && /LV_DEVIS_TOOL\/$/.test(m.canon) && m.hl === 5 && m.ld === 'SoftwareApplication' && m.theme === '#0b6b72', 'Open Graph, canonical, 5 hreflang, JSON-LD und Farbe vorhanden');
  ok(/object-src 'none'/.test(m.csp || ''), 'Content-Security-Policy: keine Plug-ins, keine fremde Basisadresse');
  ok(m.L, 'Kartenbibliothek ist eingebettet (cdnjs gesperrt, Leaflet trotzdem da)');
  const intro = await pg.textContent('#t-intro'), con = await pg.getAttribute('#t-contact', 'href');
  ok(/Leitung auf der Karte/.test(intro) && /tiefbauleitung\.com\/kontakt/.test(con), 'Einleitung nennt Nutzen und Zielgruppe, Kontakt-Link vorhanden');
  const ft = await pg.textContent('footer'); ok(/Impressum:/.test(ft) && /Chur/.test(ft) && /LinkedIn/.test(ft), 'Fusszeile mit Impressum (Name, Ort, Kontakt)');
  await pg.click('#bPriv'); await pg.waitForTimeout(500);
  const hp = await pg.evaluate(() => (document.querySelector('dialog[open]') || {}).textContent || ''); ok(/GitHub Pages/.test(hp) && /jsDelivr/.test(hp) && /routing\.openstreetmap\.de/.test(hp), 'Datenschutz nennt Hosting und alle nachgeladenen Dienste');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  ok(await pg.isHidden('#bPrintFull'), 'Druckvarianten im Menü «Exportieren» (zugeklappt)');
  await pg.click('#sExp'); await pg.waitForTimeout(150); ok(await pg.isVisible('#bPrintFull') && await pg.isVisible('#bPrintSum'), 'Menü öffnet «Ausführlich» und «Kurzausdruck»');
  // Schacht rechnen: kein Link auf interne Ablage
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1200); await pg.click('[data-tab=schacht]'); await pg.waitForTimeout(600);
  ok((await pg.evaluate(() => document.documentElement.innerHTML.indexOf('swisscom.sharepoint.com') < 0 || ![...document.querySelectorAll('a')].some(a => /sharepoint/.test(a.href)))), 'Öffentliche Version verlinkt keine interne SharePoint-Ablage');
  // Sprache aus der Adresse
  const p2 = await mk(b, 1200, 800); await p2.goto(INDEX + '?lang=fr'); await p2.waitForTimeout(1200);
  const fr = await p2.evaluate(() => ({ lang: document.documentElement.lang, canon: document.querySelector('link[rel=canonical]').href, desc: document.querySelector('#mDesc').content }));
  ok(fr.lang === 'fr' && /\?lang=fr$/.test(fr.canon) && /calculateur/.test(fr.desc), 'Adresse ?lang=fr: Seite französisch, canonical und Beschreibung folgen (' + fr.canon.slice(-24) + ')');
  // Handy: Assistent-Knopf überdeckt keine Reiter
  const mo = await mk(b, 390, 844); await mo.waitForTimeout(800);
  const ov = await mo.evaluate(() => { const f = document.querySelector('#chFab'); if (!f) return 'kein Knopf'; const r = f.getBoundingClientRect(); const hits = [...document.querySelectorAll('#tabs [role=tab], #tabs button, nav.no-print > button')].filter(e => { const q = e.getBoundingClientRect(); return q.width && !(q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom); }); return hits.map(e => e.textContent.trim()).join(','); });
  ok(ov === '', 'Handy: Assistent-Knopf liegt nicht über Reitern oder Hilfe (' + ov + ')');
  ok(pg.errs.length === 0 && p2.errs.length === 0 && mo.errs.length === 0, 'keine JS-Fehler ' + pg.errs.concat(p2.errs, mo.errs).join('|'));
  await b.close();
})();
