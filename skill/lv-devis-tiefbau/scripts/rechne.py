#!/usr/bin/env python3
"""LV-Devis Tiefbau – Berechnung (gleicher Rechenkern wie das HTML-Tool, nur Python-Standardbibliothek)

Aufruf:  python3 rechne.py eingabe.json [--out ordner] [--lang de|fr|it|en] [--md-only] [--json-only]
Ergebnis: Zusammenfassung (Markdown) auf stdout, dazu im Ausgabeordner
          LV-Devis_<Projekt>.json  (im HTML-Tool über «Laden» öffnen)
          LV-Devis_<Projekt>.xlsx  (Kostenvoranschlag)
App-Konzept und Urheber: Alessandro Cortese
"""
import datetime, json, os, re, sys, zipfile
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kve  # noqa: E402

# ---------- Argumente ----------
opt, files, a = {}, [], sys.argv[1:]
i = 0
while i < len(a):
    if a[i].startswith("--"):
        k = a[i][2:]
        if i + 1 < len(a) and not a[i + 1].startswith("--"):
            opt[k] = a[i + 1]; i += 1
        else:
            opt[k] = True
    else:
        files.append(a[i])
    i += 1
if not files:
    sys.exit("Aufruf: python3 rechne.py eingabe.json [--out ordner] [--lang de|fr|it|en]")

# ---------- Eingabe: schlankes Format, Sicherung des HTML-Tools oder {data: …} ----------
with open(files[0], encoding="utf8") as f:
    raw = json.load(f)
inp = raw.get("data", raw) if isinstance(raw, dict) else raw
TABS = kve.TABS + ["hon"]
S = kve.defaults(datetime.date.today().strftime("%d.%m.%Y"))


def norm(o):
    """Zahlen als Text wie in der Erfassungsmaske."""
    if isinstance(o, bool) or o is None:
        return o
    if isinstance(o, (int, float)):
        return kve.jstr(o)
    if isinstance(o, list):
        return [norm(x) for x in o]
    if isinstance(o, dict):
        return {k: norm(v) for k, v in o.items()}
    return o


def deep_fill(dst, src):
    for k, v in src.items():
        if dst.get(k) is None:
            dst[k] = json.loads(json.dumps(v))
        elif isinstance(v, dict) and isinstance(dst[k], dict):
            deep_fill(dst[k], v)


for k in ("lang", "dichte", "mwst"):
    if inp.get(k) is not None:
        S[k] = norm(inp[k])
for k in ("kopf", "sond", "wasser", "be", "par", "D"):
    if isinstance(inp.get(k), dict):
        S[k].update(norm(inp[k]))
lief = kve.jt(S["kopf"].get("belagLief"))
for t in TABS:
    L = (inp.get("recs") or {}).get(t)
    if not isinstance(L, list) or not L:
        continue
    recs = []
    for n, r in enumerate(L, 1):
        e = norm(r); deep_fill(e, kve.newRec(t, n, lief)); e.setdefault("x", {}); e.setdefault("free", [])
        recs.append(e)
    S["recs"][t] = recs; S["idx"][t] = 0
if opt.get("lang") and opt["lang"] is not True:
    S["lang"] = opt["lang"]
lang = S.get("lang") or "de"
kve.LANG["v"] = lang

# ---------- Texte ----------
TL = kve.T.get(lang) or kve.T["de"]


def tt(k):
    return TL.get(k, kve.T["de"].get(k, k))


def fill(s, args):
    return re.sub(r"\{(\w+)\}", lambda m: kve.jstr(kve.r2(args[m.group(1)]) if isinstance(args[m.group(1)], float) else args[m.group(1)]) if args and args.get(m.group(1)) is not None else m.group(0), str(s))


def is_pos(k):
    return re.match(r"^\d{3}/", k or "") is not None


def line_text(l):
    if l["flag"] == "offen":
        return ((l.get("text") + " – ") if l.get("text") else "") + fill(tt("w_" + l["tk"]), l.get("args"))
    if is_pos(l["key"]):
        c = kve.lvC(l["key"])
        return ((c + " › ") if c else "") + kve.lvT(l["key"])
    return l.get("text") or ""


def short_text(l):
    if l["flag"] == "offen" or not is_pos(l["key"]):
        return line_text(l)
    c = kve.lvC(l["key"])
    return ((c.split(" › ")[-1] + " › ") if c else "") + kve.lvT(l["key"])


W = {"de": ["Elemente", "Reiter", "Element", "Summen", "Zwischensumme", "Rabatt Stufe", "Installationspauschale", "Netto exkl. MWST", "MWST", "Total inkl. MWST", "davon Belag", "Positionen (zusammengefasst)", "Hinweise / Warnungen", "OFFEN-Position(en) sind nicht im Total enthalten (kein LV-Preis) – Preis beim Unternehmer anfragen.", "Vollständigkeit – noch offen (bitte klären)", "Sprache", "Dateien", "Pos.", "Text", "Menge", "Einh.", "EP", "Total"],
     "fr": ["Éléments", "Onglet", "Élément", "Totaux", "Sous-total", "Rabais niveau", "Forfait d'installation", "Net hors TVA", "TVA", "Total TVA incl.", "dont revêtement", "Positions (résumé)", "Remarques / avertissements", "position(s) OUVERTE(S) non comprise(s) dans le total (pas de prix LV) – demander le prix à l'entreprise.", "Complétude – encore ouvert (à clarifier)", "Langue", "Fichiers", "Pos.", "Texte", "Quantité", "Unité", "PU", "Total"],
     "it": ["Elementi", "Scheda", "Elemento", "Totali", "Subtotale", "Ribasso livello", "Forfait d'installazione", "Netto IVA escl.", "IVA", "Totale IVA incl.", "di cui pavimentazione", "Posizioni (riepilogo)", "Avvisi", "posizione/i APERTA/E non inclusa/e nel totale (nessun prezzo LV) – chiedere il prezzo all'impresa.", "Completezza – ancora aperto (da chiarire)", "Lingua", "File", "Pos.", "Testo", "Quantità", "Unità", "PU", "Totale"],
     "en": ["Elements", "Tab", "Element", "Totals", "Subtotal", "Discount level", "Installation lump sum", "Net excl. VAT", "VAT", "Total incl. VAT", "of which surfacing", "Items (summary)", "Notes / warnings", "OPEN item(s) not included in the total (no LV price) – request a price from the contractor.", "Completeness – still open (to clarify)", "Language", "Files", "Item", "Text", "Qty", "Unit", "Unit price", "Total"]}
WL = W.get(lang, W["de"])


def chf(v):
    if v is None:
        return "—"
    s = "{:,.2f}".format(v + (1e-9 if v >= 0 else -1e-9))
    return s.replace(",", "'")


def qs(v):
    return kve.jstr(v)


# ---------- Rechnen ----------
out = kve.calc(S)
sm = out["sum"]
hon = [(r, kve.honCalc(r, sm["netto"])) for r in S["recs"]["hon"]]
hon_ok = [(r, h) for r, h in hon if h["ok"]]
offen = [l for l in out["summary"] if l.get("open") or l["flag"] == "offen"]
k = S["kopf"]

# ---------- Markdown ----------
md = ["# LV-Devis Tiefbau – " + (k.get("projekt") or "Projekt") + ((" (SAP " + k["sap"] + ")") if k.get("sap") else ""),
      "LV Swisscom Infrastrukturarbeiten bei Baukooperationen V1.1 (10.07.2026) · " + WL[15] + " " + lang.upper() + " · " + (k.get("datum") or ""),
      "\n## " + WL[0], "| " + WL[1] + " | " + WL[2] + " | CHF |", "|---|---|---:|"]
for e in out["elems"]:
    if e["lines"]:
        md.append("| " + tt("tab_" + e["tab"]) + " | " + str(e["name"]) + " | " + chf(e["sum"]) + " |")
if out["vor"]["lines"]:
    md.append("| — | " + tt("h_vorarbeiten") + " | " + chf(out["vor"]["sum"]) + " |")
if out["be"]["lines"]:
    md.append("| — | " + tt("h_be") + " | " + chf(out["be"]["sum"]) + " |")
md += ["\n## " + WL[3] + " (CHF)", "| | CHF |", "|---|---:|",
       "| " + WL[4] + " | " + chf(sm["zwischen"]) + " |",
       "| " + WL[5] + " " + str(sm["stufe"]) + " (" + qs(sm["pct"]) + " %) | −" + chf(sm["rabatt"]) + " |",
       "| " + WL[6] + " | " + chf(sm["inst"]) + " |",
       "| **" + WL[7] + "** | **" + chf(sm["netto"]) + "** |",
       "| " + WL[8] + " " + "%.1f" % (sm["mwSatz"] * 100) + " % | " + chf(sm["mwst"]) + " |",
       "| **" + WL[9] + "** | **" + chf(sm["brutto"]) + "** |"]
if sm["belag"]:
    md.append("| " + WL[10] + " | " + chf(sm["belag"]) + " |")
for r, h in hon_ok:
    md.append("\n**" + str(r["name"]) + "** (SIA 103-K): B = " + chf(h["B"]) + ", p = " + "%.4f" % h["p"] + " %, q = " + qs(h["q"]) + " %, Tm = " + qs(h["Tm"]) +
              " h → " + chf(h["H"]) + ((" + NK " + chf(h["NK"])) if h["NK"] else "") + " = **CHF " + chf(h["net"]) + "** exkl. MWST")
for r, h in hon:
    if not h["ok"] and (r.get("h") or r.get("src") == "man"):
        md.append("\n⚠ " + str(r["name"]) + ": " + tt("w_honH" if h["noH"] else "w_hon"))
md += ["\n## " + WL[11], "| " + " | ".join(WL[17:]) + " |", "|---|---|---:|---|---:|---:|"]
for l in out["summary"]:
    o = l["flag"] == "offen"
    md.append("| " + ("OFFEN" if o else l["key"]) + " | " + short_text(l).replace("|", "/")[:140] + " | " + qs(l["qty"]) + " | " + (l["unit"] or "") +
              " | " + ("—" if o else chf(l["ep"])) + " | " + ("—" if o else chf(l["total"])) + " |")
if out["warn"]:
    md.append("\n## " + WL[12])
    for w in out["warn"]:
        md.append("- [" + w["sev"] + "] " + ((tt("tab_" + w["tab"]) + " · " + str(w["el"]) + ": ") if w.get("tab") else "") + fill(tt("w_" + w["id"]), w.get("args")))
if offen:
    md.append("\n**" + str(len(offen)) + "** " + WL[13])
miss = [c for c in out["complete"] if c["st"] == "open"]
if miss:
    md.append("\n## " + WL[14])
    md += ["- " + tt("c_" + c["id"]) for c in miss]


# ---------- Excel (ohne Zusatzpakete) ----------
def xlsx(path, sheets):
    """sheets: [(name, rows, widths)], Zelle = (wert, stil) – Stile: 0 normal, 1 Titel, 2 Kopf, 3 Zahl, 4 fett, 5 Summe, 6 grau, 7 Umbruch, 8 OFFEN"""
    def col(n):
        s = ""
        while n:
            n, r = divmod(n - 1, 26); s = chr(65 + r) + s
        return s
    styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
              '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>'
              '<fonts count="5"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>'
              '<font><b/><sz val="10"/><name val="Arial"/></font><font><sz val="9"/><color rgb="FF6B7280"/><name val="Arial"/></font></fonts>'
              '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
              '<fill><patternFill patternType="solid"><fgColor rgb="FF001155"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF8"/></patternFill></fill>'
              '<fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E1"/></patternFill></fill></fills>'
              '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">'
              '<xf xfId="0" borderId="0" fillId="0" numFmtId="0" fontId="0"/><xf xfId="0" borderId="0" fillId="0" numFmtId="0" fontId="1" applyFont="1"/><xf xfId="0" borderId="0" numFmtId="0" fontId="2" fillId="2" applyFont="1" applyFill="1"/><xf xfId="0" borderId="0" fillId="0" fontId="0" numFmtId="164" applyNumberFormat="1"/>'
              '<xf xfId="0" borderId="0" fillId="0" numFmtId="0" fontId="3" applyFont="1"/><xf xfId="0" borderId="0" fontId="3" fillId="3" numFmtId="164" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf xfId="0" borderId="0" fillId="0" numFmtId="0" fontId="4" applyFont="1"/>'
              '<xf xfId="0" borderId="0" fillId="0" numFmtId="0" fontId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf xfId="0" borderId="0" numFmtId="0" fontId="3" fillId="4" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>'
              '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
    wb = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>']
    rel = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">']
    ct = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>']
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for n, (name, rows, widths) in enumerate(sheets, 1):
            x = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>']
            x += ['<col min="%d" max="%d" width="%s" customWidth="1"/>' % (j, j, w) for j, w in enumerate(widths, 1)]
            x.append("</cols><sheetData>")
            for r, row in enumerate(rows, 1):
                x.append('<row r="%d">' % r)
                for c, cell in enumerate(row, 1):
                    v, s = cell if isinstance(cell, tuple) else (cell, 0)
                    ref = col(c) + str(r)
                    if v is None or v == "":
                        if s:
                            x.append('<c r="%s" s="%d"/>' % (ref, s))
                    elif isinstance(v, (int, float)) and not isinstance(v, bool):
                        x.append('<c r="%s" s="%d"><v>%s</v></c>' % (ref, s or 3, repr(float(v))))
                    else:
                        x.append('<c r="%s" s="%d" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (ref, s, escape(str(v))))
                x.append("</row>")
            x.append("</sheetData></worksheet>")
            z.writestr("xl/worksheets/sheet%d.xml" % n, "".join(x))
            wb.append('<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (escape(name[:31]), n, n))
            rel.append('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>' % (n, n))
            ct.append('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' % n)
        n = len(sheets) + 1
        rel.append('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' % n)
        z.writestr("[Content_Types].xml", "".join(ct) + "</Types>")
        z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr("xl/workbook.xml", "".join(wb) + "</sheets></workbook>")
        z.writestr("xl/_rels/workbook.xml.rels", "".join(rel))
        z.writestr("xl/styles.xml", styles)


if not opt.get("md-only"):
    d = opt.get("out") if isinstance(opt.get("out"), str) else "."
    base = "LV-Devis_" + re.sub(r"[^\w\-]+", "_", k.get("sap") or k.get("projekt") or "Projekt")
    os.makedirs(d, exist_ok=True)
    save = json.loads(json.dumps(S)); save.pop("ui", None)
    with open(os.path.join(d, base + ".json"), "w", encoding="utf8") as f:
        json.dump({"v": 2, "tool": "LV-Devis Tiefbau", "lv": "V1.1 10.07.2026", "data": save}, f, ensure_ascii=False, indent=1)
    if not opt.get("json-only"):
        hdr = [(x, 2) for x in WL[17:]]
        K = [("LV-Devis Tiefbau", 1)], [("LV Swisscom Infrastrukturarbeiten bei Baukooperationen V1.1 (10.07.2026)", 6)], []
        K = list(K)
        for key, val in [("projekt", k.get("projekt")), ("sap", k.get("sap")), ("ort", k.get("ort")), ("bearb", k.get("bearb")), ("datum", k.get("datum")),
                         ("dv_nr", k.get("devisNr")), ("dv_lieferant", k.get("lieferant"))]:
            K.append([(tt(key), 6), (val or "", 4)])
        K += [[], [(WL[3], 2), ("CHF", 2)]]
        for j, (lab, v) in enumerate([(WL[4], sm["zwischen"]), (WL[5] + " " + str(sm["stufe"]) + " (" + qs(sm["pct"]) + " %)", -sm["rabatt"]), (WL[6], sm["inst"]),
                                      (WL[7], sm["netto"]), (WL[8] + " " + "%.1f" % (sm["mwSatz"] * 100) + " %", sm["mwst"]), (WL[9], sm["brutto"])]):
            K.append([(lab, 4 if j in (3, 5) else 0), (v, 5 if j in (3, 5) else 3)])
        for r, h in hon_ok:
            K += [[], [(str(r["name"]) + " (SIA 103-K)", 4), (h["net"], 3)]]
        if offen:
            K += [[], [(str(len(offen)) + " " + WL[13], 8)]]
        K += [[], [("App-Konzept und Urheber: Alessandro Cortese · berechnet mit dem LV-Devis-Rechenkern", 6)]]

        def lrow(l, full=True):
            t = (line_text(l) + (("  ·  " + l["rule"]) if full and l.get("rule") else "")) if full else line_text(l)
            if l["flag"] == "offen":
                return [("OFFEN", 8), (t, 8), l["qty"], l["unit"], ("—", 6), ("—", 6)]
            return [(l["key"], 4), (t, 7), l["qty"], l["unit"], l["ep"], l["total"]]
        A = [hdr]
        blocks = [(tt("tab_" + e["tab"]) + " · " + str(e["name"]), e["lines"], e["sum"]) for e in out["elems"] if e["lines"]]
        if out["vor"]["lines"]:
            blocks.append((tt("h_vorarbeiten"), out["vor"]["lines"], out["vor"]["sum"]))
        if out["be"]["lines"]:
            blocks.append((tt("h_be"), out["be"]["lines"], out["be"]["sum"]))
        for title, lines, s in blocks:
            A.append([(title, 4)])
            A += [lrow(l) for l in lines]
            A += [[(tt("k_sumEl"), 4), "", "", "", "", (s, 5)], []]
        Z = [hdr] + [lrow(l, False) for l in out["summary"]]
        Wn = [[("Element", 2), ("", 2), ("", 2)]] + [[((tt("tab_" + w["tab"]) + " · ") if w.get("tab") else "") + str(w.get("el") or ""), w["sev"], (fill(tt("w_" + w["id"]), w.get("args")), 7)] for w in out["warn"]]
        xlsx(os.path.join(d, base + ".xlsx"), [("Kosten", K, [46, 20]), ("Aufstellung", A, [14, 88, 11, 7, 11, 13]), ("Zusammenfassung", Z, [14, 88, 11, 7, 11, 13]), ("Warnungen", Wn, [36, 10, 110])])
    md.append("\n_" + WL[16] + ": " + os.path.join(d, base + ".json") + ("" if opt.get("json-only") else " · " + os.path.join(d, base + ".xlsx")) + "_")

print("\n".join(md))
