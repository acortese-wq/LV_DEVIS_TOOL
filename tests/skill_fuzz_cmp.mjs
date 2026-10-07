// Rechnet die Zufallsprojekte mit dem Original-Rechenkern (src/kve.js) und vergleicht mit dem Python-Ergebnis.
import fs from 'fs'; import path from 'path'; import vm from 'vm'; import { fileURLToPath } from 'url';
const H = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dir = process.argv[2];
const C = { console, Math, JSON }; C.window = C; vm.createContext(C);
for (const f of ['data/lv.js', 'schacht_data.js', 'i18n_kv.js', 'schacht_i18n.js', 'i18n_app.js', 'kve.js', 'model.js']) vm.runInContext(fs.readFileSync(path.join(H, 'src', f), 'utf8'), C);
vm.runInContext('var LANG="de"; function lvT(k){var m=LANG==="fr"?LV_FR:LANG==="it"?LV_IT:null;return m&&m[k]&&m[k].t?m[k].t:(LV[k]?LV[k].t:k);} function lvC(k){var m=LANG==="fr"?LV_FR:LANG==="it"?LV_IT:null;return m&&m[k]&&m[k].c?m[k].c:(LV[k]?LV[k].c:"");}', C);
let bad = 0, n = 0;
for (const f of fs.readdirSync(dir).filter(f => /^LV-Devis_F\d+\.json$/.test(f)).sort()) {
  const id = f.match(/F(\d+)/)[1], st = JSON.parse(fs.readFileSync(path.join(dir, f))).data, py = JSON.parse(fs.readFileSync(path.join(dir, 'py_' + id + '.json')));
  C.ST = st; vm.runInContext('LANG = ST.lang', C);
  const o = vm.runInContext('KVE.calc(ST, LV)', C), hon = st.recs.hon.map(r => { const h = C.LVM.honCalc(r, o.sum.netto); return [h.Tm == null ? null : h.Tm, h.net == null ? null : h.net]; });
  const js = { sum: o.sum, summary: o.summary.map(l => [l.key, l.qty, l.ep, l.total, l.unit]), warn: o.warn.map(w => w.id).sort(), complete: o.complete.map(c => c.st), hon, nOffen: o.nOffen };
  n++; const diffs = [];
  for (const k of Object.keys(js)) { const a = JSON.stringify(js[k]), b = JSON.stringify(py[k]); if (a !== b) diffs.push(k + '\n   JS ' + a.slice(0, 400) + '\n   PY ' + b.slice(0, 400)); }
  if (diffs.length) { bad++; if (bad <= 5) console.log('FEHLER F' + id + ': ' + diffs.join('\n  ')); }
}
console.log(n + ' Projekte verglichen, ' + bad + ' Abweichungen'); process.exit(bad ? 1 : 0);
