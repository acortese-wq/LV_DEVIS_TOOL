"""Zufallsprojekte über alle Reiter erzeugen und mit dem Python-Rechenkern rechnen.
Aufruf: python3 tests/skill_fuzz.py <ordner> [anzahl]  → ordner/st_*.json (Zustand) + ordner/py_*.json (Ergebnis)"""
import json, os, random, subprocess, sys
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(H, "skill/lv-devis-tiefbau/scripts"))
import kve
out, N = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 300
os.makedirs(out, exist_ok=True)
R = random.Random(42)
ch = R.choice
def f(a, b, nd=2): return str(round(R.uniform(a, b), nd))
def belag():
    m = ch(["none", "bit", "bit", "humus", "pflaster"])
    return {"mode": m, "d": ch(["40", "80", "100", "130", "160", "220"]), "pak": ch(["le250", "gt250"]), "einbau": ch(["typN", "dritte"]), "typ": ch(["N", "L"]),
            "trag": ch(["T16", "T22"]), "dTrag": ch(["40", "70", "90", "110"]), "deck": ch(["AC8", "AC11", "AC4L", "AC8L"]), "deckArt": ch(["hand", "masch"]),
            "dDeck": ch(["20", "25", "30", "35", "40", "50"]), "haft": ch([True, False]), "naehte": ch([True, False]), "fund": ch(["0", "150", "200", "300"]),
            "humus": {"art": ch(["abtrag", "rasenziegel"]), "dOber": ch(["20", "30"]), "hand": ch([True, False]), "ansaeen": ch([True, False])},
            "pflaster": {"material": ch(["betonverbund", "beton", "natur"]), "dicke": ch(["40", "50", "60", "80"]), "fund": ch(["0", "150", "200", "300"]), "randNeu": ch([True, False]),
                         "randMat": ch(["gneis", "granit"]), "randTyp": ch(["8/11", "11/13"]), "randLaenge": f(0, 20), "randAbbruch": ch([True, False]), "abbruchAlt": ch([True, False]),
                         "abbruchArt": ch(["betonstein", "platten", "natur"])}}
def ersch(): return {"klasse": ch(["keine", "5", "6", "7"]), "verf": ch(["keine", "gefroren", "stein"]), "hind": ch(["keine", "findling", "fundUnbew", "fundBew"]), "hindVol": f(0, 1)}
def xs():
    return {k: f(1, 30) for k in R.sample(sorted(kve.LV.keys()), R.randint(0, 3))}
def free():
    l = []
    for _ in range(R.randint(0, 2)):
        if R.random() < 0.5: l.append({"key": ch(sorted(kve.LV.keys())), "qty": f(0, 10), "ep": ch(["", "", f(1, 500)]), "note": "x"})
        else: l.append({"custom": True, "text": "Sonder", "unit": "St", "qty": f(0, 5), "ep": ch(["", f(10, 900)]), "reason": ch(["", "Offerte"])})
    return l
def graben(i):
    return {"name": "G%d" % i, "L": f(0, 120, 1), "T": ch(["0.6", "0.8", "1.2", "1.6", "2.2"]), "bmode": ch(["min60", "begangen", "nicht_begangen", "manuell"]), "aussen": ch(["", f(0.1, 0.6)]),
            "bman": f(0.3, 1.2), "aushubArt": ch(["normal", "normal", "saug"]), "saugH": f(0, 8, 1), "hand": ch(list(kve.HAND)), "gesp": ch([True, False]), "direkt": ch([True, False]),
            "rohrSystem": ch(["k55", "k55", "laengs", "block"]), "dn": ch(["55", "100", "120", "150"]), "len": ch(["5", "10"]), "n": ch(["1", "2", "4"]), "muffenMode": ch(["auto", "manuell"]),
            "muffenN": ch(["0", "6"]), "b90": ch(["0", "2"]), "b45": ch(["0", "1"]), "schneiden": ch(["0", "3"]), "warnband": ch([True, False]), "kalib": ch([True, False]),
            "einzug": ch(["keine", "schnur", "draht"]), "dn2": ch(["100", "120", "150"]), "n2": ch(["1", "2"]),
            "abzweiger": [{"art": ch(list(kve.ABZW)), "n": ch(["1", "2"])}] if R.random() < 0.5 else [],
            "bloecke": [{"dn": ch(["55", "100", "120"]), "n": ch(["1", "3", "5"]), "lagen": ch(["1", "2", "m"]), "len": ch(["5", "10"])} for _ in range(R.randint(1, 2))],
            "block": {"breite": ch(["0", "0.5"]), "hoehe": "0.3"}, "umhType": ch(["kies", "beton"]), "umhMat": ch(["betonkies", "sand", "kies48"]), "umhArea": ch(["0.035", "0.05"]),
            "verf": ch(["aushub", "kies045", "kies016", "betonkies"]), "einfHand": ch([True, False]), "Lb": ch(["", f(0, 60, 1)]), "belag": belag(),
            "mods": {"ersch": True, "fremd": True, "boesch": True}, "ersch": ersch() if R.random() < 0.5 else {"klasse": "keine", "verf": "keine", "hind": "keine", "hindVol": "0.3"},
            "kreuz": {"on": ch([True, False]), "n": ch(["0", "2"]), "len": "1.00", "richtung": ch(["laengs", "quer"])}, "zores": {"on": ch([True, False]), "len": f(0, 10), "zustand": ch(["abrechen", "betrieb", "nicht"])},
            "boeschung": {"on": ch([True, False]), "flaeche": ch(["", f(0, 30)]), "geneigt": ch([True, False])},
            "uF": ch(["", "1"]), "uP": ch(["", "2"]), "uL": "", "aB": ch(["", f(0, 10)]), "aW": "", "aS": ch(["", "3"]), "aR": "", "x": xs(), "free": free()}
COV = sorted(k for k in kve.LV if k.startswith("151/632.1"))
def schacht(i):
    return {"name": "S%d" % i, "modus": ch(["neu", "neu", "ersatz", "deckel"]), "einbauort": ch([l["id"] for l in kve.LOCS]), "typ": ch(list(kve.SCHACHT)), "n": ch(["0", "1", "2"]),
            "arbeit": ch(["0.30", "0.50", "0.75"]), "hand": ch(list(kve.HAND)), "direkt": ch([True, False]), "beton": ch(["0", "0.4"]), "platten": ch(["0", "2"]), "anschl": ch(["0", "2"]),
            "anDN": ch(["80", "150"]), "rahmen": ch(["", ch(COV)]), "deckel": ch(["", ch(COV)]), "verf": ch(["aushub", "kies045"]), "einfHand": ch([True, False]), "belag": belag(),
            "ersch": ersch(), "deckelRichtung": ch(["hoeher", "tiefer"]), "deckelFormat": ch(["rund", "rechteckig"]), "deckelN": ch(["0", "1", "3"]), "shape": ch(["eckig", "rund"]),
            "sys": ch(["nivo", "ds", "gross130", "beton", ""]), "deckelFormat2": ch(["90", "180"]), "deckelSockel": ch(["ohne", "mit"]), "spare": ch(["0", "1"]), "alt": ch(["guss", "beton", "flaeche"]),
            "opts": {o["id"]: ch(["", "1", "2.5"]) for o in R.sample(kve.OPTS, 3)}, "deviate": ch([True, False]), "reason": ch(["", "Grund"]), "approver": ch(["", "X"]), "x": xs(), "free": free()}
def rec(t, i):
    if t == "graben": return graben(i)
    if t == "schacht": return schacht(i)
    if t == "rohr": return {"name": "R", "verl": ch([True, False]), "rohre": [{"typ": ch(list(kve.ROH)), "q": f(0, 80)}], "schn": [{"typ": ch(list(kve.ROH)), "q": ch(["", "4"])}],
                            "boe": [{"typ": ch(list(kve.BOE)), "q": ch(["", "2"])}], "muf": [{"typ": ch(list(kve.MUF)), "q": ch(["", "5"])}], "erd": ch(["", "30"]), "warn": ch(["", "20"]),
                            "schnur": ch(["", "40"]), "kal": ch(["", "40"]), "kalDN": ch(["55", "100", "120", "150"]), "x": xs(), "free": free()}
    if t == "werkloch": return {"name": "W", "ts": ch(["", "1", "2"]), "bo": ch(["", "1"]), "sg": ch(["", "1"]), "zs": ch(["", "2"]), "iB": ch(["", "1.2"]), "iT": ch(["", "1.0", "1.8"]), "iL": ch(["", "2"]),
                                "p0": ch(["", "1"]), "p1": "", "p2": ch(["", "1"]), "p3": "", "arbeit": ch(["0.30", "0.50"]), "hand": ch(list(kve.HAND)), "direkt": ch([True, False]),
                                "verf": ch(["aushub", "kies045", "kies016", "betonkies"]), "einfHand": ch([True, False]), "belag": belag(), "ersch": ersch(), "x": xs(), "free": free()}
    if t == "fund": return {"name": "F", "vk": ch(["", "CAB 1-3 L"]), "kvs": ch(["", "C 50"]), "arbeit": ch(["0.30", "0.75"]), "hand": ch(list(kve.HAND)), "direkt": ch([True, False]),
                            "verf": ch(["aushub", "kies045"]), "einfHand": ch([True, False]), "belag": belag(), "ersch": ersch(), "x": xs(), "free": free()}
    if t == "geb": return {"name": "H", "n": ch(["", "1", "3"]), "cm": ch(["", "40"]), "abd": ch(["keine", "kissen", "hauff"]), "x": xs(), "free": free()}
    if t == "belag": return {"name": "B", "indiv": ch([False, "false", "true"]), "bk": ch(["gehweg", "strasse", "kanton"]), "d": ch(["0.06", "0.08", "0.12", "0.25"]), "B": f(0.2, 3), "L": f(0.2, 20),
                             "wi": ch(["A", "A1", "B", "C", "C1", "C2"]), "x": xs(), "free": free()}
    if t == "allg": return {"name": "A", "km": ch(["", "120"]), "ak": ch(["", "800.5"]), "x": xs(), "free": free()}
    if t == "hon": return {"name": "Hon", "src": ch(["lv", "man"]), "B": ch(["", "250000"]), "n": ch(["1.0", "0.9", "1.2"]), "r": ch(["1.0", "1.1"]), "h": ch(["", "140"]), "nk": ch(["", "3"]),
                           "gl": ch([True, False]), "ph": [{"k": p[0], "on": ch([True, False])} for p in kve.PHDEF]}
for i in range(N):
    inp = {"lang": ch(["de", "fr", "it"]), "kopf": {"projekt": "Fuzz %d" % i, "sap": "F%03d" % i, "belagLief": ch([True, False])}, "be": {"pct": ch(["", "2", "3.5"])},
           "dichte": ch(["2.4", "2.3", ""]), "mwst": ch(["8.1", "7.7"]), "sond": {"m3": ch(["", "2"]), "einfHand": ch([True, False])}, "wasser": {"h": ch(["", "5"]), "sumpf": ch(["", "1"])},
           "recs": {t: [rec(t, j) for j in range(R.randint(1, 2))] for t in R.sample(kve.TABS + ["hon"], R.randint(1, 6))}}
    p = os.path.join(out, "in_%03d.json" % i)
    json.dump(inp, open(p, "w"), ensure_ascii=False)
    subprocess.run([sys.executable, os.path.join(H, "skill/lv-devis-tiefbau/scripts/rechne.py"), p, "--json-only", "--out", out], check=True, stdout=subprocess.DEVNULL)
    st = json.load(open(os.path.join(out, "LV-Devis_F%03d.json" % i)))["data"]
    kve.LANG["v"] = st["lang"]
    o = kve.calc(st)
    hon = [kve.honCalc(r, o["sum"]["netto"]) for r in st["recs"]["hon"]]
    json.dump({"sum": o["sum"], "summary": [[l["key"], l["qty"], l["ep"], l["total"], l["unit"]] for l in o["summary"]], "warn": sorted(w["id"] for w in o["warn"]),
               "complete": [c["st"] for c in o["complete"]], "hon": [[h.get("Tm"), h.get("net")] for h in hon], "nOffen": o["nOffen"]},
              open(os.path.join(out, "py_%03d.json" % i), "w"))
print(N, "Projekte erzeugt")
