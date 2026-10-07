#!/usr/bin/env node
/* LV-Positionen suchen (Nummer oder Stichwort, DE/FR/IT)
   Aufruf:  node lv_suche.js <Suchbegriff …> [--lang de|fr|it] [--max 30]
   Beispiele: node lv_suche.js 151/632.15     node lv_suche.js Kernbohrung     node lv_suche.js chambre --lang fr */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const a = process.argv.slice(2), opt = { lang: "de", max: "30" }, q = [];
for (let i = 0; i < a.length; i++) { if (a[i].startsWith("--")) opt[a[i].slice(2)] = a[++i]; else q.push(a[i].toLowerCase()); }
const C = { console, Math, JSON, TextEncoder, Uint8Array }; C.window = C; vm.createContext(C);
vm.runInContext(fs.readFileSync(path.join(__dirname, "engine.js"), "utf8"), C);
const { LV, LV_FR, LV_IT } = vm.runInContext("({ LV, LV_FR, LV_IT })", C);
const M = opt.lang === "fr" ? LV_FR : opt.lang === "it" ? LV_IT : LV;
const txt = k => { const m = M[k] && M[k].t ? M[k] : LV[k]; return ((m.c ? m.c + " › " : "") + m.t); };
const hits = Object.keys(LV).sort().filter(k => { const s = (k + " " + txt(k) + " " + (LV[k].c || "") + " " + LV[k].t).toLowerCase(); return q.every(w => s.indexOf(w) >= 0); });
hits.slice(0, +opt.max).forEach(k => console.log(k + " | " + LV[k].u + " | CHF " + LV[k].ep.toFixed(2) + " | " + txt(k)));
console.log("— " + hits.length + " Treffer" + (hits.length > +opt.max ? " (erste " + opt.max + " gezeigt, --max erhöhen)" : ""));
