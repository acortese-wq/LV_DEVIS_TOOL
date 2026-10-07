#!/usr/bin/env node
/* LV-Devis Tiefbau – Berechnung ausserhalb des Browsers (gleicher Rechenkern wie das HTML-Tool)
   Aufruf:  node rechne.js eingabe.json [--out ordner] [--lang de|fr|it|en] [--json-only]
   Ergebnis: Zusammenfassung (Markdown) auf stdout, dazu im Ausgabeordner
             LV-Devis_<Projekt>.json  (im HTML-Tool über «Laden» öffnen)
             LV-Devis_<Projekt>.xlsx  (Kostenvoranschlag)
   App-Konzept und Urheber: Alessandro Cortese */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const args = process.argv.slice(2), opt = {}, files = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith("--")) { const k = args[i].slice(2); opt[k] = (args[i + 1] && !args[i + 1].startsWith("--")) ? args[++i] : true; } else files.push(args[i]); }
if (!files.length) { console.error("Aufruf: node rechne.js eingabe.json [--out ordner] [--lang de|fr|it|en]"); process.exit(2); }

/* Rechenkern laden */
const C = { console, Math, JSON, Date, TextEncoder, Uint8Array }; C.window = C; vm.createContext(C);
vm.runInContext(fs.readFileSync(path.join(__dirname, "engine.js"), "utf8"), C, { filename: "engine.js" });
const { KVE, LVM, LV, LV_FR, LV_IT, T, XLSXW } = vm.runInContext("({ KVE, LVM, LV, LV_FR, LV_IT, T, XLSXW })", C);

/* Eingabe: schlankes Format, vollständige Sicherung des HTML-Tools oder {data: …} */
const raw = JSON.parse(fs.readFileSync(files[0], "utf8")), inp = raw.data || raw;
const TABS = KVE.TABS.concat(["hon"]);
const today = () => { const d = new Date(); return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(); };
const S = LVM.defaults(TABS, today());
const deepFill = (dst, src) => { Object.keys(src).forEach(k => { if (dst[k] == null) dst[k] = JSON.parse(JSON.stringify(src[k])); else if (typeof src[k] === "object" && !Array.isArray(src[k]) && typeof dst[k] === "object" && dst[k]) deepFill(dst[k], src[k]); }); };
const norm = v => typeof v === "number" ? String(v) : v;   /* Zahlen als Text wie in der Maske */
const normAll = o => { if (Array.isArray(o)) return o.map(normAll); if (o && typeof o === "object") { const r = {}; Object.keys(o).forEach(k => { r[k] = normAll(o[k]); }); return r; } return norm(o); };
["lang", "dichte", "mwst"].forEach(k => { if (inp[k] != null) S[k] = norm(inp[k]); });
["kopf", "sond", "wasser", "be", "par", "D"].forEach(k => { if (inp[k]) Object.assign(S[k], normAll(inp[k])); });
const belagLief = !!S.kopf.belagLief;
TABS.forEach(t => {
  const L = (inp.recs || {})[t];
  if (!Array.isArray(L) || !L.length) return;
  S.recs[t] = L.map((r, i) => { const e = normAll(r); deepFill(e, LVM.newRec(t, i + 1, belagLief)); if (!e.x) e.x = {}; if (!e.free) e.free = []; return e; });
  S.idx[t] = 0;
});
if (opt.lang) S.lang = opt.lang;
const lang = S.lang || "de";

/* Texte */
const tt = k => { const d = T[lang] || T.de; return d[k] != null ? d[k] : (T.de[k] != null ? T.de[k] : k); };
const fill = (s, a) => String(s).replace(/\{(\w+)\}/g, (m, k) => a && a[k] != null ? a[k] : m);
const lvMap = lang === "fr" ? LV_FR : lang === "it" ? LV_IT : null;
C.lvT = k => (lvMap && lvMap[k] && lvMap[k].t) ? lvMap[k].t : (LV[k] ? LV[k].t : k);
C.lvC = k => (lvMap && lvMap[k] && lvMap[k].c) ? lvMap[k].c : (LV[k] ? LV[k].c : "");
const isPos = k => /^\d{3}\//.test(k);
const lineText = l => l.flag === "offen" ? (l.text ? l.text + " – " : "") + fill(tt("w_" + l.tk), l.args) : (isPos(l.key) ? (C.lvC(l.key) ? C.lvC(l.key) + " › " : "") + C.lvT(l.key) : (l.text || ""));
const shortText = l => { if (l.flag === "offen" || !isPos(l.key)) return lineText(l); const c = C.lvC(l.key); return (c ? c.split(" › ").pop() + " › " : "") + C.lvT(l.key); };
const W = { de: ["Elemente", "Reiter", "Element", "Summen", "Zwischensumme", "Rabatt Stufe", "Installationspauschale", "Netto exkl. MWST", "MWST", "Total inkl. MWST", "davon Belag", "Positionen (zusammengefasst)", "Hinweise / Warnungen", "OFFEN-Position(en) sind nicht im Total enthalten (kein LV-Preis) – Preis beim Unternehmer anfragen.", "Vollständigkeit – noch offen (bitte klären)", "Sprache", "Dateien", "Pos.", "Text", "Menge", "Einh.", "EP", "Total"],
  fr: ["Éléments", "Onglet", "Élément", "Totaux", "Sous-total", "Rabais niveau", "Forfait d'installation", "Net hors TVA", "TVA", "Total TVA incl.", "dont revêtement", "Positions (résumé)", "Remarques / avertissements", "position(s) OUVERTE(S) non comprise(s) dans le total (pas de prix LV) – demander le prix à l'entreprise.", "Complétude – encore ouvert (à clarifier)", "Langue", "Fichiers", "Pos.", "Texte", "Quantité", "Unité", "PU", "Total"],
  it: ["Elementi", "Scheda", "Elemento", "Totali", "Subtotale", "Ribasso livello", "Forfait d'installazione", "Netto IVA escl.", "IVA", "Totale IVA incl.", "di cui pavimentazione", "Posizioni (riepilogo)", "Avvisi", "posizione/i APERTA/E non inclusa/e nel totale (nessun prezzo LV) – chiedere il prezzo all'impresa.", "Completezza – ancora aperto (da chiarire)", "Lingua", "File", "Pos.", "Testo", "Quantità", "Unità", "PU", "Totale"],
  en: ["Elements", "Tab", "Element", "Totals", "Subtotal", "Discount level", "Installation lump sum", "Net excl. VAT", "VAT", "Total incl. VAT", "of which surfacing", "Items (summary)", "Notes / warnings", "OPEN item(s) not included in the total (no LV price) – request a price from the contractor.", "Completeness – still open (to clarify)", "Language", "Files", "Item", "Text", "Qty", "Unit", "Unit price", "Total"] };
const WL = W[lang] || W.de;
const chf = v => (v == null ? "—" : Number(v).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/* Rechnen */
const out = KVE.calc(S, LV), sm = out.sum;
const hon = S.recs.hon.map(r => ({ r, h: LVM.honCalc(r, sm.netto) })).filter(x => x.h.ok);
const offen = out.summary.filter(l => l.open || l.flag === "offen");

/* Markdown-Zusammenfassung */
const md = [];
const k = S.kopf;
md.push("# LV-Devis Tiefbau – " + (k.projekt || "Projekt") + (k.sap ? " (SAP " + k.sap + ")" : ""));
md.push("LV Swisscom Infrastrukturarbeiten bei Baukooperationen V1.1 (10.07.2026) · " + WL[15] + " " + lang.toUpperCase() + " · " + (k.datum || ""));
md.push("\n## " + WL[0]);
md.push("| " + WL[1] + " | " + WL[2] + " | CHF |", "|---|---|---:|");
out.elems.filter(e => e.lines.length).forEach(e => md.push("| " + tt("tab_" + e.tab) + " | " + e.name + " | " + chf(e.sum) + " |"));
if (out.vor.lines.length) md.push("| — | " + tt("h_vorarbeiten") + " | " + chf(out.vor.sum) + " |");
if (out.be.lines.length) md.push("| — | " + tt("h_be") + " | " + chf(out.be.sum) + " |");
md.push("\n## " + WL[3] + " (CHF)");
md.push("| | CHF |", "|---|---:|");
md.push("| " + WL[4] + " | " + chf(sm.zwischen) + " |");
md.push("| " + WL[5] + " " + sm.stufe + " (" + sm.pct + " %) | −" + chf(sm.rabatt) + " |");
md.push("| " + WL[6] + " | " + chf(sm.inst) + " |");
md.push("| **" + WL[7] + "** | **" + chf(sm.netto) + "** |");
md.push("| " + WL[8] + " " + (sm.mwSatz * 100).toFixed(1) + " % | " + chf(sm.mwst) + " |");
md.push("| **" + WL[9] + "** | **" + chf(sm.brutto) + "** |");
if (sm.belag) md.push("| " + WL[10] + " | " + chf(sm.belag) + " |");
hon.forEach(x => md.push("\n**" + x.r.name + "** (SIA 103-K): B = " + chf(x.h.B) + ", p = " + x.h.p.toFixed(4) + " %, q = " + x.h.q + " %, Tm = " + x.h.Tm + " h → Honorar " + chf(x.h.H) + (x.h.NK ? " + NK " + chf(x.h.NK) : "") + " = **CHF " + chf(x.h.net) + "** exkl. MWST"));
S.recs.hon.forEach(r => { const h = LVM.honCalc(r, sm.netto); if (!h.ok && (r.h || r.src === "man")) md.push("\n⚠ " + r.name + ": " + tt(h.noH ? "w_honH" : "w_hon")); });
md.push("\n## " + WL[11]);
md.push("| " + WL.slice(17).join(" | ") + " |", "|---|---|---:|---|---:|---:|");
out.summary.forEach(l => md.push("| " + (l.flag === "offen" ? "OFFEN" : l.key) + " | " + shortText(l).replace(/\|/g, "/").slice(0, 140) + " | " + l.qty + " | " + (l.unit || "") + " | " + (l.flag === "offen" ? "—" : chf(l.ep)) + " | " + (l.flag === "offen" ? "—" : chf(l.total)) + " |"));
if (out.warn.length) { md.push("\n## " + WL[12]); out.warn.forEach(w => md.push("- [" + w.sev + "] " + (w.tab ? tt("tab_" + w.tab) + " · " + w.el + ": " : "") + fill(tt("w_" + w.id), w.args))); }
if (offen.length) md.push("\n**" + offen.length + "** " + WL[13]);
const miss = (out.complete || []).filter(c => c.st === "open");
if (miss.length) { md.push("\n## " + WL[14]); miss.forEach(c => md.push("- " + tt("c_" + c.id))); }

/* Dateien */
if (!opt["md-only"]) {
  const dir = opt.out || ".", base = "LV-Devis_" + ((k.sap || k.projekt || "Projekt").replace(/[^\w\-]+/g, "_"));
  fs.mkdirSync(dir, { recursive: true });
  const save = JSON.parse(JSON.stringify(S)); delete save.ui;
  fs.writeFileSync(path.join(dir, base + ".json"), JSON.stringify({ v: 2, tool: "LV-Devis Tiefbau", lv: "V1.1 10.07.2026", data: save }, null, 1));
  if (!opt["json-only"]) {
    const X = XLSXW.ST, H = a => a.map(t => ({ v: t, s: X.hdr }));
    const K = [[{ v: "LV-Devis Tiefbau", s: X.title }], [{ v: "LV Swisscom Infrastrukturarbeiten bei Baukooperationen V1.1 (10.07.2026)", s: X.grey }], []];
    [["projekt", k.projekt], ["sap", k.sap], ["ort", k.ort], ["bearb", k.bearb], ["datum", k.datum], ["dv_nr", k.devisNr], ["dv_lieferant", k.lieferant]].forEach(r => K.push([{ v: tt(r[0]), s: X.grey }, { v: r[1] || "", s: X.bold }]));
    K.push([], H([tt("h_kosten"), "CHF"]));
    [["Zwischensumme", sm.zwischen], ["Rabatt Stufe " + sm.stufe + " (" + sm.pct + " %)", -sm.rabatt], ["Installationspauschale", sm.inst], ["Netto exkl. MWST", sm.netto], ["MWST " + (sm.mwSatz * 100).toFixed(1) + " %", sm.mwst], ["Total inkl. MWST", sm.brutto]]
      .forEach((r, i) => K.push([{ v: r[0], s: i === 3 || i === 5 ? X.sumLbl : X.def }, { v: r[1], s: i === 3 || i === 5 ? X.sum : X.num }]));
    hon.forEach(x => K.push([], [{ v: x.r.name + " (SIA 103-K)", s: X.bold }, { v: x.h.net, s: X.num }]));
    if (offen.length) K.push([], [{ v: offen.length + " OFFEN-Position(en) nicht im Total enthalten", s: X.warnA }]);
    K.push([], [{ v: "App-Konzept und Urheber: Alessandro Cortese · berechnet mit dem LV-Devis-Rechenkern", s: X.grey }]);
    const A = [H([tt("c_pos"), tt("c_text"), tt("c_qty"), tt("c_unit"), tt("c_ep"), tt("c_tot")])];
    const lr = l => l.flag === "offen" ? [{ v: "OFFEN", s: X.stop }, { v: lineText(l) + (l.rule ? "  ·  " + l.rule : ""), s: X.warnA }, { v: l.qty, s: X.num }, { v: l.unit }, { v: "—", s: X.grey }, { v: "—", s: X.grey }]
      : (r => [{ v: l.key, s: X.code }, { v: lineText(l) + (l.rule ? "  ·  " + l.rule : ""), s: X.wrap }, { v: l.qty, s: X.num }, { v: l.unit }, { v: l.ep, s: X.num }, { v: l.total, s: X.num, f: "ROUND(C" + r + "*E" + r + ",2)" }])(A.length + 1);
    const blk = (title, lines, sum) => { A.push([{ v: title, s: X.elTitle }]); lines.forEach(l => A.push(lr(l))); A.push([{ v: tt("k_sumEl"), s: X.sumLbl }, {}, {}, {}, {}, { v: sum, s: X.sum }], []); };
    out.elems.forEach(e => { if (e.lines.length) blk(tt("tab_" + e.tab) + " · " + e.name, e.lines, e.sum); });
    if (out.vor.lines.length) blk(tt("h_vorarbeiten"), out.vor.lines, out.vor.sum);
    if (out.be.lines.length) blk(tt("h_be"), out.be.lines, out.be.sum);
    const Z = [H([tt("c_pos"), tt("c_text"), tt("c_qty"), tt("c_unit"), tt("c_ep"), tt("c_tot")])];
    out.summary.forEach(l => Z.push(l.flag === "offen" ? [{ v: "OFFEN", s: X.stop }, { v: lineText(l), s: X.warnA }, { v: l.qty, s: X.num }, { v: l.unit }, {}, {}] : [{ v: l.key, s: X.code }, { v: lineText(l), s: X.wrap }, { v: l.qty, s: X.num }, { v: l.unit }, { v: l.ep, s: X.num }, { v: l.total, s: X.num }]));
    const W = [H(["Element", "Stufe", "Hinweis"])].concat(out.warn.map(w => [{ v: (w.tab ? tt("tab_" + w.tab) + " · " : "") + (w.el || "") }, { v: w.sev }, { v: fill(tt("w_" + w.id), w.args), s: X.wrap }]));
    const sheets = [{ name: "Kosten", rows: K, cols: [46, 20] }, { name: "Aufstellung", rows: A, cols: [14, 88, 11, 7, 11, 13], freeze: 1 }, { name: "Zusammenfassung", rows: Z, cols: [14, 88, 11, 7, 11, 13], freeze: 1 }, { name: "Warnungen", rows: W, cols: [36, 10, 110] }];
    fs.writeFileSync(path.join(dir, base + ".xlsx"), Buffer.from(XLSXW.build(sheets, { noCache: false })));
  }
  md.push("\n_" + WL[16] + ": " + path.join(dir, base + ".json") + (opt["json-only"] ? "" : " · " + path.join(dir, base + ".xlsx")) + "_");
}
console.log(md.join("\n"));
