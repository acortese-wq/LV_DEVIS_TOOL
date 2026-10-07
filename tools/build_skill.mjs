// Baut das Claude-Skill-Paket skill/lv-devis-tiefbau aus src/ und index.html.
// Aufruf (nach python3 build.py):  node tools/build_skill.mjs
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process'; import { fileURLToPath } from 'url';
const H = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), SK = path.join(H, 'skill/lv-devis-tiefbau');
const rd = f => fs.readFileSync(path.join(H, 'src', f), 'utf8');

// 1) Daten für den Python-Rechenkern (LV, Schachtauswahl, Texte, Vorgaben) – identisch mit dem HTML-Tool
const vm = await import('vm');
const C = { console, Math, JSON, TextEncoder, Uint8Array }; C.window = C; vm.createContext(C);
['data/lv.js', 'schacht_data.js', 'i18n_kv.js', 'schacht_i18n.js', 'i18n_app.js', 'kve.js', 'model.js'].forEach(f => vm.runInContext(rd(f), C, { filename: f }));
const daten = vm.runInContext(`(function () {
  var TABS = KVE.TABS.concat(["hon"]), rec = function (lief) { var o = {}; TABS.forEach(function (t) { var r = LVM.newRec(t, 1, lief); r.name = r.name.replace(/ 1$/, ""); o[t] = r; }); return o; };
  var T2 = {}; Object.keys(T).forEach(function (l) { T2[l] = {}; Object.keys(T[l]).forEach(function (k) { if (typeof T[l][k] === "string") T2[l][k] = T[l][k]; }); });
  return JSON.stringify({ LV: LV, LV_FR: LV_FR, LV_IT: LV_IT, SP: SP, LOCS: LOCS, SIZES: SIZES, OPTS: OPTS, T: T2, PHDEF: LVM.PHDEF, HONF: LVM.HONF,
    REC: { std: rec(false), lief: rec(true) }, DEFAULTS: LVM.defaults(TABS, "") });
})()`, C);
fs.writeFileSync(path.join(SK, 'scripts/daten.json'), daten);
for (const f of ['scripts/engine.js', 'scripts/rechne.js', 'scripts/lv_suche.js']) { try { fs.unlinkSync(path.join(SK, f)); } catch (e) {} }

// 2) Feldreferenz aus den Maskendefinitionen des HTML-Tools
const { chromium } = await import(execSync('npm root -g').toString().trim() + '/playwright/index.mjs');
const br = await chromium.launch(), pg = await br.newPage();
await pg.goto('file://' + path.join(H, 'index.html')); await pg.waitForFunction(() => window.__LVD && window.__LVD.F);
const md = await pg.evaluate(() => {
  const U = window.__LVD, F = U.F, tt = U.tt, S = U.S(), defs = S.recs, out = [];
  const get = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
  const cond = fn => { if (!fn) return ''; const s = fn.toString().replace(/\s+/g, ' ');
    const m = s.match(/return (.*?);? ?\}$/); return (m ? m[1] : s).replace(/c\./g, '').slice(0, 160); };
  const TABN = { graben: 'Graben', rohr: 'Rohr', schacht: 'Schacht', werkloch: 'Werkloch', fund: 'Fundamente', geb: 'Gebäudeeinführung', belag: 'Belag', allg: 'Allgemein', hon: 'Ingenieurhonorar' };
  Object.keys(TABN).forEach(tab => {
    out.push('\n## ' + TABN[tab] + ' (`recs.' + tab + '`)\n');
    out.push('| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |', '|---|---|---|---|---|');
    (F[tab] || []).forEach(f => {
      if (f.sec) { out.push('| **' + tt(f.sec) + '** | | | | |'); return; }
      if (!f.id) { if (f.t === 'rohrLists') out.push('| rohre / schn / boe / muf | Listen `[{typ, q}]` | siehe Abschnitt Rohr-Kataloge | | |'); return; }
      const lab = tt(f.labKey || ('f_' + f.id.replace(/\./g, '_'))), d = f.glob ? get(S, f.id) : get(defs[tab][0], f.id);
      let ty = f.t;
      if (f.t === 'sel') { const o = typeof f.opts === 'function' ? f.opts(defs[tab][0]) : f.opts; ty = o.map(v => '`' + JSON.stringify(v).replace(/"/g, '') + '` ' + U.optLabel(f.id, v)).join('<br>') + (typeof f.opts === 'function' ? '<br>(abhängig)' : ''); }
      else if (f.t === 'num') ty = 'Zahl (Text)'; else if (f.t === 'chk' || f.t === 'chip') ty = 'true/false'; else if (f.t === 'cover') ty = 'LV-Pos. 151/632.1xx oder ""';
      else if (f.t === 'blockList') ty = 'bloecke `[{dn, n, lagen, len}]`'; else if (f.t === 'abzwList') ty = 'abzweiger `[{…}]`';
      out.push('| `' + (f.glob ? '(global) ' : '') + f.id + '` | ' + lab.replace(/\|/g, '/') + (f.hint ? '<br><i>' + tt(f.hint).replace(/\|/g, '/').replace(/\n/g, ' ') + '</i>' : '') + ' | ' + ty.replace(/\|/g, '/') + ' | `' + JSON.stringify(d === undefined ? '' : d) + '` | ' + (f._w ? [cond(f._w[0]), cond(f._w[1])].filter(Boolean).join(' && ') : cond(f.show)).replace(/\|/g, '/') + ' |');
    });
  });
  return out.join('\n');
});
await br.close();
fs.writeFileSync(path.join(SK, 'references/felder.md'), '# Feldreferenz Erfassungsmaske (automatisch erzeugt)\n\n' +
  'Alle Werte werden als **Text** gespeichert (Zahlen z. B. `"12.5"`), Ja/Nein als `true`/`false`. Felder, die nicht angegeben werden, erhalten die Vorgabe.\n' +
  'Zusätzlich hat jeder Datensatz `x` (weitere LV-Positionen `{"151/xxx.xxx": "Menge"}`) und `free` (freie Positionen, siehe SKILL.md).\n' + md + '\n');
console.log('skill gebaut:', SK);
