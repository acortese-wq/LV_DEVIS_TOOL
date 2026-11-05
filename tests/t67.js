/* t67: Excel-Offertregister – Blätter «Offerte (leer)» und «Offerte (mit Preisen)», NPK 111/113 vollständig, Formeln bis Total inkl. MWST, A4 hoch mit Wiederholungszeile */
const { chromium, ok, mk, tmp } = require('./lib/k.js');
const { execFileSync } = require('child_process'), fs = require('fs');
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1400, 1000);
  await pg.evaluate(() => { window.__LVD.loadDemo(); }); await pg.waitForTimeout(1500);
  const sum = await pg.evaluate(() => window.__OUT.sum);
  const xb = await pg.evaluate(() => Array.from(window.__LVD.xlsxBytes())); const xf = tmp('t67.xlsx'); fs.writeFileSync(xf, Buffer.from(xb));
  /* Auswertung mit Python-Standardbibliothek (zipfile + XML) */
  const py = `
import zipfile,sys,re,json
z=zipfile.ZipFile(sys.argv[1]); wb=z.read('xl/workbook.xml').decode()
names=re.findall(r'<sheet name="([^"]+)"',wb); res={'names':names,'titles':re.findall(r'_xlnm.Print_Titles" localSheetId="(\\d+)">([^<]+)<',wb)}
def cells(i):
  x=z.read('xl/worksheets/sheet%d.xml'%(i+1)).decode(); rows={}
  for r,body in re.findall(r'<row r="(\\d+)"[^>]*>(.*?)</row>',x):
    for ref,s,rest in re.findall(r'<c r="([A-Z]+)\\d+" s="(\\d+)"([^>]*/>|.*?</c>)',body):
      f=re.search(r'<f>(.*?)</f>',rest); v=re.search(r'<v>(.*?)</v>',rest); t=re.search(r'<t[^>]*>(.*?)</t>',rest)
      rows.setdefault(int(r),{})[ref]={'s':int(s),'f':f.group(1) if f else None,'v':(v.group(1) if v else (t.group(1) if t else None))}
  return rows,('orientation="portrait"' in x)
for key,i in (('blank',1),('priced',2)):
  rows,portrait=cells(i); d={'portrait':portrait}
  pos=[r for r in rows.values() if r.get('A',{}).get('v') and re.match(r'^\\d{3}/',r['A']['v'] or '')]
  d['n111']=len([r for r in pos if r['A']['v'].startswith('111/')]); d['n113']=len([r for r in pos if r['A']['v'].startswith('113/')])
  d['epFilled']=len([r for r in pos if r.get('E',{}).get('v') not in (None,'')]); d['epStyle']=len(set(r.get('E',{}).get('s') for r in pos))
  d['amtF']=all(r.get('F',{}).get('f','').find('ROUND(C')>=0 for r in pos)
  lab={ (r.get('B',{}).get('v') or ''):r.get('F',{}) for r in rows.values()}
  tot=[v for k,v in lab.items() if k.startswith('Total inkl')]; d['total']=float(tot[0]['v']) if tot else None; d['totalF']=tot[0]['f'] if tot else None
  d['inst']=[v['f'] for k,v in lab.items() if k.startswith('Installationspauschale')]
  res[key]=d
print(json.dumps(res))`;
  const r = JSON.parse(execFileSync('python3', ['-c', py, xf]).toString());
  const lv = await pg.evaluate(() => { let a = 0, c = 0; for (const k in LV) { if (k.startsWith('111/')) a++; if (k.startsWith('113/')) c++; } return { a, c }; });
  ok(r.names[1] === 'Offerte (leer)' && r.names[2] === 'Offerte (mit Preisen)', 'Excel: Blätter «Offerte (leer)» und «Offerte (mit Preisen)» nach der Kostenübersicht');
  ok(r.blank.n111 === lv.a && r.blank.n113 === lv.c && r.priced.n111 === lv.a, 'NPK 111 (' + lv.a + ') und NPK 113 (' + lv.c + ') vollständig');
  ok(r.blank.epFilled === 0 && r.blank.epStyle === 1, 'leer: keine Preise, alle EP-Felder als Eingabefeld formatiert');
  ok(r.priced.epFilled > r.priced.n111, 'mit Preisen: Einheitspreise eingesetzt (' + r.priced.epFilled + ')');
  ok(r.blank.amtF && r.priced.amtF, 'Betrag je Zeile als Formel Menge × EP');
  ok(r.priced.totalF && Math.abs(r.priced.total - sum.brutto) < 1, 'mit Preisen: Total inkl. MWST = Kostenübersicht (' + r.priced.total + ' ≈ ' + sum.brutto + ', Rundung je Zeile)');
  ok(r.blank.total === 0 && /INDEX/.test(r.blank.inst[0] || ''), 'leer: Total 0, Installationspauschale/Rabatt über Staffel-Formel');
  ok(r.blank.portrait && r.priced.portrait && r.titles.length === 2, 'A4 hoch, Tabellenkopf wiederholt sich auf jeder Seite');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
