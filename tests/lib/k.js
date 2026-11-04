/* Gemeinsame Testhilfe für die Browser-Tests (tests/t*.js).
   Einmalig vorbereiten:  npm ci --omit=optional --prefix tests   (Leaflet, axe-core, pdf.js in festen Versionen)
   Playwright mit Chromium muss vorhanden sein (global «playwright» oder PW=/pfad/zu/playwright).
   Alle Pfade sind relativ zum Repo – es wird nichts ausserhalb benötigt. */
const path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..', '..'), NM = path.join(__dirname, '..', 'node_modules');
function loadPw() {
  const tries = [process.env.PW, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* nächster Versuch */ } }
  console.error('Playwright nicht gefunden. Installieren: npm i -g playwright && npx playwright install chromium (oder PW=/pfad/zu/playwright setzen).');
  process.exit(2);
}
const { chromium } = loadPw();
function need(p) {
  if (!fs.existsSync(p)) { console.error('Testdatei fehlt: ' + path.relative(ROOT, p) + '\n→ einmalig im Repo ausführen: npm ci --omit=optional --prefix tests'); process.exit(2); }
  return p;
}
const V = {
  leafletJs: need(path.join(NM, 'leaflet', 'dist', 'leaflet.js')),
  leafletCss: need(path.join(NM, 'leaflet', 'dist', 'leaflet.css')),
  axe: need(path.join(NM, 'axe-core', 'axe.min.js')),
  pdf: need(path.join(NM, 'pdfjs-dist', 'build', 'pdf.min.js')),
  pdfWorker: need(path.join(NM, 'pdfjs-dist', 'build', 'pdf.worker.min.js'))
};
const AXE = V.axe;
const FX = n => need(path.join(__dirname, '..', 'fixtures', n));            /* Testdaten im Repo (tests/fixtures) */
const TMP = path.join(os.tmpdir(), 'lvd-tests'); fs.mkdirSync(TMP, { recursive: true });
const tmp = n => path.join(TMP, n);                                         /* Ausgaben (Screenshots, PDF) */
const INDEX = 'file://' + path.join(ROOT, 'index.html');

const png = fs.readFileSync(FX('plan.png')); const dataUrl = 'data:image/png;base64,' + png.toString('base64');
let fails = []; const ok = (c, m) => { if (!c) { fails.push(m); console.log('  FAIL', m); } else console.log('  ok  ', m); };
process.on('beforeExit', () => { if (fails.length && !process.exitCode) process.exitCode = 1; });   /* Fehlschläge auch im Rückgabewert */
async function mk(b, w, h) {
  const pg = await b.newPage({ viewport: { width: w || 1600, height: h || 1000 } }); pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ').replace(/file:\/\/\/[^ ]*index.html/g, '')));
  pg.on('dialog', d => d.accept());
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('leaflet')) return r.fulfill({ body: fs.readFileSync(u.endsWith('.js') ? V.leafletJs : V.leafletCss), contentType: u.endsWith('.js') ? 'application/javascript' : 'text/css' });
    if (u.includes('wms.geo.admin') && u.includes('GetMap')) return r.fulfill({ body: png, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } });
    if (u.includes('geo.admin')) return r.fulfill({ status: 204, body: '' });
    r.continue();
  });
  await pg.goto(process.env.LVD_URL || INDEX); return pg;
}
const getS = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')));
const setS = async (pg, fn, arg) => { await pg.fill('#f_graben_L', '1'); await pg.waitForTimeout(500); await pg.evaluate(([f, a]) => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); (new Function('S', 'a', f))(S, a); localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify(S)); }, [fn.toString().replace(/^[^{]*\{|\}$/g, ''), arg]); await pg.reload(); };
const FULL = `S.recs.graben[0].uid='g1';S.recs.graben[0].name='Graben A';S.recs.schacht[0].uid='s1';S.recs.schacht[0].name='Schacht A';S.recs.schacht[0].n='1';S.recs.werkloch[0].uid='w1';S.recs.werkloch[0].sg='1';S.recs.geb[0].uid='e1';S.recs.geb[0].n='1';S.recs.geb[0].cm='36';S.recs.belag[0].uid='b1';S.recs.belag[0].B='5';S.recs.belag[0].L='4';
S.karte={lines:[{id:'l1',pts:[[2600000,1200000],[2600100,1200000]],rid:'g1',rohr:{sys:'k55',dn:'55',len:'10',n:'1'}}],pts:[{id:'p1',pt:[2600000,1200000],sid:'s1',typ:'KES150',name:''}],sond:[{id:'o1',pt:[2600050,1200020],name:'',l:'1.0',b:'1.0',t:'1.5'}],notes:[{id:'n1',type:'text',pts:[[2600010,1200030]],text:'Hinweis',color:'#0d47c8',size:'m'}],areas:[{id:'f1',pts:[[2600000,1200010],[2600005,1200010],[2600005,1200014],[2600000,1200014]],rid:'b1',belag:{bk:'gehweg',d:'0.08',wi:'B'}}],wl:[{id:'w1',pt:[2600100,1200000],sid:'w1',wt:'sg',name:''}],geb:[{id:'g1',pt:[2600050,1200000],sid:'e1',cm:'36',abd:'hauff',name:''}],base:'farbe',bg:null,overlay:null};
S.plan={img:a,w:900,h:600,cal:{scale:0.2,m:40},lines:[],pts:[],sond:[],notes:[],areas:[],wl:[],geb:[]}; S.sond.m3='1.5';`;
/* Ebenen/Katalog in der Kartenerfassung öffnen und anheften (seit V76 standardmässig ausgeblendet) */
async function openMid(pg) {
  await pg.evaluate(() => { const t = document.querySelector('.kmmidtog'); if (t && t.getAttribute('aria-expanded') !== 'true') t.click(); const p = document.querySelector('.kmmid [data-w=pin]'); if (p && p.getAttribute('aria-pressed') !== 'true') p.click(); });
  await pg.waitForTimeout(200);
}
/* Ebenen/Katalog-Fenster an den rechten Rand schieben, damit Klicks in die Karte frei bleiben */
async function midRight(pg) {
  await pg.evaluate(() => { if (!window.__KMWIN) return; const s = window.__KMWIN.state(), g = document.querySelector('.kmgrid').getBoundingClientRect(); s.mid = Object.assign(s.mid || {}, { fl: true, x: Math.max(0, g.width - 320), y: 8, w: 300 }); window.__KMWIN.layout(); });
  await pg.waitForTimeout(200);
}
module.exports = { chromium, fs, ok, mk, getS, setS, FULL, dataUrl, fails, png, AXE, V, FX, tmp, ROOT, INDEX, openMid, midRight };
