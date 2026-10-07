#!/usr/bin/env python3
"""LV-Positionen suchen (Nummer oder Stichwort, DE/FR/IT)
Aufruf:  python3 lv_suche.py <Suchbegriff …> [--lang de|fr|it] [--max 30]
Beispiele: python3 lv_suche.py 151/632.15    python3 lv_suche.py Kontrollschacht    python3 lv_suche.py chambre --lang fr"""
import json, os, sys
a, opt, q = sys.argv[1:], {"lang": "de", "max": "30"}, []
i = 0
while i < len(a):
    if a[i].startswith("--") and i + 1 < len(a):
        opt[a[i][2:]] = a[i + 1]; i += 2
    else:
        q.append(a[i].lower()); i += 1
D = {}
for n in ("lv_de", "lv_fr", "lv_it"):
    D.update(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "daten", n + ".json"), encoding="utf8")))
LV = D["LV"]; M = D["LV_FR"] if opt["lang"] == "fr" else D["LV_IT"] if opt["lang"] == "it" else LV


def txt(k):
    m = M[k] if k in M and M[k].get("t") else LV[k]
    return (m.get("c", "") + " › " if m.get("c") else "") + m["t"]


hits = [k for k in sorted(LV) if all(w in (k + " " + txt(k) + " " + LV[k].get("c", "") + " " + LV[k]["t"]).lower() for w in q)]
mx = int(opt["max"])
for k in hits[:mx]:
    print("%s | %s | CHF %.2f | %s" % (k, LV[k]["u"], LV[k]["ep"], txt(k)))
print("— %d Treffer%s" % (len(hits), " (erste %d gezeigt, --max erhöhen)" % mx if len(hits) > mx else ""))
