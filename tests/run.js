/* Alle Tests mit einem Befehl (aus dem Repo-Ordner):
     node tests/run.js                 alle Browser-Tests, UI-Qualität (axe) und Skill-Vergleich
     node tests/run.js t50 t52         nur diese Tests
     node tests/run.js --from=50       ab t50
     node tests/run.js --no-ui --no-skill --timeout=300
   Vorher einmalig: npm ci --omit=optional --prefix tests  ·  nach Änderungen in src/: python3 build.py
   Protokolle: <Temp>/lvd-tests/logs/<test>.log */
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(__dirname, '..'), args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const has = k => args.includes('--' + k), names = args.filter(a => !a.startsWith('--'));
const TO = (+opt('timeout', 240)) * 1000, FROM = +opt('from', 0);
const LOG = path.join(os.tmpdir(), 'lvd-tests', 'logs'); fs.mkdirSync(LOG, { recursive: true });
if (!fs.existsSync(path.join(__dirname, 'node_modules', 'axe-core'))) { console.error('Zuerst einmalig: npm ci --omit=optional --prefix tests'); process.exit(2); }
const num = f => +(f.match(/^t(\d+)\.js$/) || [0, 0])[1];
let list = fs.readdirSync(__dirname).filter(f => /^t\d+\.js$/.test(f)).sort((a, b) => num(a) - num(b)).filter(f => num(f) >= FROM).map(f => ({ name: f.replace('.js', ''), cmd: 'node', argv: [path.join(__dirname, f)] }));
list.push({ name: 'abdeckung', cmd: 'node', argv: [path.join(__dirname, 'abdeckung.js')] });
if (!has('no-ui')) list.push({ name: 'ui_qa', cmd: 'node', argv: [path.join(__dirname, 'ui_qa.js')], timeout: 900000 });
if (!has('no-skill')) list.push({ name: 'skill_test', cmd: 'sh', argv: [path.join(__dirname, 'skill_test.sh')], timeout: 900000 });
if (names.length) list = list.filter(t => names.includes(t.name));
const res = [], t0 = Date.now();
for (const t of list) {
  const s = Date.now(), r = spawnSync(t.cmd, t.argv, { cwd: ROOT, encoding: 'utf8', timeout: t.timeout || TO, maxBuffer: 64 * 1024 * 1024 });
  const outp = (r.stdout || '') + (r.stderr || ''), sec = Math.round((Date.now() - s) / 1000); fs.writeFileSync(path.join(LOG, t.name + '.log'), outp);
  const nFail = (outp.match(/^\s*FAIL\b/gm) || []).length, timedOut = r.error && r.error.code === 'ETIMEDOUT';
  let bad = r.status !== 0 || nFail > 0 || timedOut || /NICHT BESTANDEN|FEHLGESCHLAGEN/.test(outp);
  if (t.name === 'skill_test' && !/\b0 Abweichungen\b/.test(outp)) bad = true;
  const why = timedOut ? 'Zeitüberschreitung' : nFail ? nFail + ' Fehler' : r.status ? 'Abbruch (Code ' + r.status + ')' : '';
  res.push({ name: t.name, bad, why, sec });
  console.log((bad ? 'FEHLER ' : 'ok     ') + t.name.padEnd(11) + String(sec).padStart(4) + ' s' + (bad ? '  ' + why + ' → ' + path.join(LOG, t.name + '.log') : ''));
}
const nb = res.filter(r => r.bad);
console.log('\n' + res.length + ' Tests in ' + Math.round((Date.now() - t0) / 60000) + ' min · ' + (nb.length ? nb.length + ' mit Fehlern: ' + nb.map(r => r.name).join(', ') : 'alle ohne Fehler'));
process.exit(nb.length ? 1 : 0);
