/* t69: Zahlen mit Tausendertrennung («1'200», «1 200») und eigene Preise ohne LV-Rabatt – Tool, Kostentabelle, Excel-Kostenblatt und Offertregister */
const { chromium, ok, mk, getS, tmp } = require('./lib/k.js');
const { execFileSync } = require('child_process'), fs = require('fs');
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1400, 1000);
  // Kern: Zahlen
  const n = await pg.evaluate(() => ["1'200", "1 200", "1’200.5", "12,5", "1'200,5"].map(v => KVE.num(v)));
  ok(JSON.stringify(n) === JSON.stringify([1200, 1200, 1200.5, 12.5, 1200.5]), 'KVE.num: 1\'200 → 1200, 1 200 → 1200, 1’200.5, 12,5, 1\'200,5: ' + JSON.stringify(n));
  // Formular: 1'200 gültig, gleiches Ergebnis wie 1200
  await pg.fill('#f_graben_L', "1'200"); await pg.waitForTimeout(700);
  const a = await pg.evaluate(() => window.__OUT.sum.netto); ok(await pg.getAttribute('#f_graben_L', 'aria-invalid') === null, "Feld «1'200» nicht als Fehler markiert");
  await pg.fill('#f_graben_L', '1200'); await pg.waitForTimeout(700); const c = await pg.evaluate(() => window.__OUT.sum.netto);
  ok(a === c && a > 50000, "«1'200» rechnet gleich wie «1200» (Netto " + a + ')');
  await pg.fill('#f_graben_L', "1'2"); await pg.waitForTimeout(200); ok(await pg.getAttribute('#f_graben_L', 'aria-invalid') === 'true', "«1'2» bleibt als ungültig markiert");
  await pg.fill('#f_graben_L', '200'); await pg.waitForTimeout(700);
  // Eigener Preis: kein Rabatt, keine Stufe
  const r = await pg.evaluate(() => { const S = window.__LVD.S(); const base = KVE.calc(S, LV).sum;
    S.recs.allg[0].free = [{ custom: true, text: 'Spezialbauteil', unit: 'gl', qty: '1', ep: '60000', reason: 'Offerte Muster AG' }];
    const s = KVE.calc(S, LV).sum; return { base, s }; });
  ok(r.base.rabatt > 0 && r.s.zwischen === Math.round((r.base.zwischen + 60000) * 100) / 100 && r.s.eigen === 60000 && r.s.stufe === r.base.stufe && r.s.rabatt === r.base.rabatt && r.s.inst === r.base.inst,
    'eigener Preis CHF 60\'000: Total +60\'000, Stufe ' + r.base.stufe + ' → ' + r.s.stufe + ', Rabatt unverändert ' + r.s.rabatt);
  ok(Math.abs(r.s.netto - (r.base.netto + 60000)) < 0.006, 'Netto steigt genau um den eigenen Preis');
  await pg.evaluate(() => { window.__LVD.commit(window.__LVD.snap(), 'x'); }); await pg.waitForTimeout(800);
  const kt = await pg.textContent('#result .kostblk');
  ok(/darin eigene Preise ausserhalb LV \(1 Pos\.\) – ohne Rabatt/.test(kt) && /auf LV-Positionen CHF/.test(kt), 'Kostentabelle: «ohne Rabatt» und Rabattbasis «auf LV-Positionen»');
  // Excel: Formeln mit LibreOffice neu rechnen und mit dem Tool vergleichen
  const sum = await pg.evaluate(() => window.__OUT.sum);
  const xb = await pg.evaluate(() => Array.from(window.__LVD.xlsxBytes())); const xf = tmp('t69.xlsx'); fs.writeFileSync(xf, Buffer.from(xb));
  let lo = null; try { const od = tmp('t69lo'); fs.rmSync(od, { recursive: true, force: true }); fs.mkdirSync(od); execFileSync('soffice', ['--headless', '--calc', '--convert-to', 'xlsx', '--outdir', od, xf], { timeout: 120000, stdio: 'ignore' }); lo = od + '/t69.xlsx'; } catch (e) { lo = null; }
  if (lo && fs.existsSync(lo)) {
    const py = `
import zipfile,sys,re,json
z=zipfile.ZipFile(sys.argv[1]); wb=z.read('xl/workbook.xml').decode(); names=re.findall(r'<sheet name="([^"]+)"',wb)
ss=re.findall(r'<si>(.*?)</si>',z.read('xl/sharedStrings.xml').decode(),re.S) if 'xl/sharedStrings.xml' in z.namelist() else []
ss=[re.sub(r'<[^>]+>','',x) for x in ss]
def sheet(i):
  x=z.read('xl/worksheets/sheet%d.xml'%(i+1)).decode(); d={}
  for ref,attrs,body in re.findall(r'<c r="([A-Z]+\\d+)"([^>]*?)(?:/>|>(.*?)</c>)',x,re.S):
    v=re.search(r'<v>(.*?)</v>',body or ''); t=re.search(r't="(\\w+)"',attrs)
    if v: d[ref]=ss[int(v.group(1))] if t and t.group(1)=='s' else v.group(1)
  return d
out={}
for nm,i in (('k',0),('o',2)):
  d=sheet(i); rows={}
  for ref,v in d.items():
    m=re.match(r'([A-Z]+)(\\d+)',ref); rows.setdefault(int(m.group(2)),{})[m.group(1)]=v
  lab={}
  for r in rows.values():
    for k,v in r.items():
      if isinstance(v,str) and (v.startswith('Total inkl') or v.startswith('Rabatt') or v=='Netto'): lab.setdefault(v.split(' (')[0],r.get('B' if nm=='k' else 'F'))
  out[nm]=lab
print(json.dumps(out))`;
    const x = JSON.parse(execFileSync('python3', ['-c', py, lo]).toString());
    ok(Math.abs(+x.k['Total inkl. MWST'] - sum.brutto) < 0.006 && Math.abs(+x.k['Rabatt'] - sum.rabatt) < 0.006, 'Excel-Kostenblatt (neu gerechnet): Rabatt ' + x.k['Rabatt'] + ' und Total ' + x.k['Total inkl. MWST'] + ' = Tool');
    ok(Math.abs(+x.o['Rabatt'] - sum.rabatt) < 0.6 && Math.abs(+x.o['Total inkl. MWST'] - sum.brutto) < 1, 'Offertregister mit Preisen: Rabatt ohne eigene Preise (' + x.o['Rabatt'] + ')');
  } else ok(true, 'LibreOffice nicht verfügbar – Excel-Neuberechnung übersprungen');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
