/* Regressions-Referenz: rechnet einen App-Zustand mit dem Rechenkern aus src/ (ohne Browser) und liefert die fachlich relevanten Ergebnisse.
   Genutzt von tools/make_golden.js (Referenz erzeugen) und tests/t78.js (Vergleich). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = path.resolve(__dirname, '..', '..');
function kernel() {
  const C = { console, Math, JSON }; C.window = C; vm.createContext(C);
  for (const f of ['data/lv.js', 'schacht_data.js', 'i18n_kv.js', 'schacht_i18n.js', 'i18n_app.js', 'kve.js', 'model.js']) vm.runInContext(fs.readFileSync(path.join(H, 'src', f), 'utf8'), C);
  vm.runInContext('var LANG="de"; function lvT(k){var m=LANG==="fr"?LV_FR:LANG==="it"?LV_IT:null;return m&&m[k]&&m[k].t?m[k].t:(LV[k]?LV[k].t:k);} function lvC(k){var m=LANG==="fr"?LV_FR:LANG==="it"?LV_IT:null;return m&&m[k]&&m[k].c?m[k].c:(LV[k]?LV[k].c:"");}', C);
  return C;
}
function result(C, st) {
  C.ST = JSON.parse(JSON.stringify(st)); vm.runInContext('LANG = ST.lang || "de"', C);
  const o = vm.runInContext('KVE.calc(ST, LV)', C);
  const hon = (C.ST.recs.hon || []).map(r => { const h = C.LVM.honCalc(r, o.sum.netto); return [h.Tm == null ? null : h.Tm, h.net == null ? null : h.net]; });
  return JSON.parse(JSON.stringify({ sum: o.sum, nOffen: o.nOffen, summary: o.summary.map(l => [l.key, l.qty, l.ep, l.total, l.unit, l.flag || '']),
    elems: o.elems.map(e => [e.tab, e.name, e.sum, e.lines.length]), warn: o.warn.map(w => w.id).sort(), complete: (o.complete || []).map(c => c.st), hon }));
}
module.exports = { kernel, result, H };
