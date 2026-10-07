"""LV-Devis Tiefbau – Rechenkern in Python (1:1-Portierung von src/kve.js und src/model.js).

Nur Python-Standardbibliothek. Daten (LV, Schachtauswahl, Texte, Vorgaben) aus daten.json,
das automatisch aus dem HTML-Tool erzeugt wird. Ergebnisse sind rappengenau identisch mit
dem HTML-Tool (geprüft mit tests/skill_parity.mjs).
App-Konzept und Urheber: Alessandro Cortese
"""
import json, math, os, re

_H = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_H, "daten.json"), encoding="utf8") as _f:
    D = json.load(_f)
LV, LV_FR, LV_IT, SP, LOCS, SIZES, OPTS, T = D["LV"], D["LV_FR"], D["LV_IT"], D["SP"], D["LOCS"], D["SIZES"], D["OPTS"], D["T"]

INF = float("inf")
ASPHALT_T = 2.4
MWST = 0.081
STAFFEL = [{"bis": 10000, "pct": 0, "inst": 0}, {"bis": 30000, "pct": 3, "inst": 700}, {"bis": 50000, "pct": 5, "inst": 900},
           {"bis": 100000, "pct": 7, "inst": 1200}, {"bis": INF, "pct": 9, "inst": 1500}]
HAND = {"normal": 0.10, "eng": 0.30, "sehr_eng": 0.50}
SCHACHT = {
    "KS80U": {"key": "151/611.171", "lo": 1.00, "bo": 1.00, "ho": 0.60, "kind": "KS"},
    "KS80H": {"key": "151/611.172", "lo": 1.00, "bo": 1.00, "ho": 1.10, "kind": "KS"},
    "KES100": {"key": "151/621.011", "lo": 1.40, "bo": 1.40, "ho": 1.70, "kind": "KES"},
    "KES150": {"key": "151/621.012", "lo": 1.90, "bo": 1.40, "ho": 1.70, "kind": "KES"},
    "KES175": {"key": "151/621.013", "lo": 1.90, "bo": 1.40, "ho": 2.10, "kind": "KES"},
    "ES300": {"key": "151/621.021", "lo": 3.40, "bo": 1.90, "ho": 2.40, "kind": "ES"},
    "PLS1": {"key": "151/623.001", "lo": 1.40, "bo": 1.40, "ho": 1.30, "kind": "PLS"},
    "PLS2": {"key": "151/623.002", "lo": 1.40, "bo": 1.90, "ho": 1.60, "kind": "PLS"},
    "PLS3": {"key": "151/623.003", "lo": 1.40, "bo": 2.40, "ho": 1.60, "kind": "PLS"}}

# ---------- JavaScript-Semantik ----------
_NUMRE = re.compile(r"^[\s ﻿]*([+-]?(?:Infinity|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?))")


def jstr(v):
    """String(v) wie in JavaScript."""
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, list):
        return ",".join("" if x is None else jstr(x) for x in v)
    if isinstance(v, dict):
        return "[object Object]"
    if isinstance(v, (int, float)):
        if v != v:
            return "NaN"
        if v in (INF, -INF):
            return "Infinity" if v > 0 else "-Infinity"
        if float(v).is_integer() and abs(v) < 1e21:
            return str(int(v))
        s = repr(float(v))
        if "e" in s:
            m, e = s.split("e")
            e = int(e)
            s = m + "e" + ("+" if e > 0 else "-") + str(abs(e))
        return s
    return str(v)


def parse_float(v):
    m = _NUMRE.match(jstr(v))
    if not m:
        return float("nan")
    s = m.group(1)
    return float(s.replace("Infinity", "inf"))


def isfin(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and x not in (INF, -INF)


def num(v, d=None):
    x = parse_float(jstr(v).replace(",", ".", 1))
    return x if isfin(x) else (d or 0)


def jround(x):
    return math.floor(x + 0.5)


def r2(x):
    return jround((x + 1e-9) * 100) / 100


def s2(x):
    return jstr(r2(x))


def jt(v):
    """JavaScript-Wahrheitswert."""
    if v is None or v is False:
        return False
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v == v and v != 0
    if isinstance(v, str):
        return v != ""
    return True


def g(o, k, d=None):
    return o.get(k, d) if isinstance(o, dict) else d


def ceil(x):
    return math.ceil(x)


# Positionstexte je Sprache (wird von rechne.py gesetzt)
LANG = {"v": "de"}


def lvT(k):
    m = LV_FR if LANG["v"] == "fr" else LV_IT if LANG["v"] == "it" else None
    if m and k in m and m[k].get("t"):
        return m[k]["t"]
    return LV[k]["t"] if k in LV else k


def lvC(k):
    m = LV_FR if LANG["v"] == "fr" else LV_IT if LANG["v"] == "it" else None
    if m and k in m and m[k].get("c"):
        return m[k]["c"]
    return LV[k].get("c", "") if k in LV else ""


_dens = {"v": ASPHALT_T}


class Ctx:
    def __init__(self, lv):
        self.LV = lv; self.lines = []; self.warn = []; self.bal = []; self.grp = ""

    def g(self, i):
        self.grp = i

    def add(self, key, qty, o=None):
        o = o or {}
        p = self.LV.get(key)
        if not p:
            raise ValueError("LV-Position fehlt: " + key)
        qty = r2(qty)
        if not (qty > 0):
            return None
        ep = o["ep"] if o.get("ep") is not None else p["ep"]
        l = {"key": key, "unit": p["u"], "ep": ep, "qty": qty, "total": r2(qty * ep), "grp": self.grp,
             "text": o.get("text") or lvT(key), "ctx": lvC(key), "rule": o.get("rule") or "", "flag": o.get("flag") or ""}
        self.lines.append(l)
        return l

    def off(self, id, qty, unit, args=None, o=None):
        o = o or {}
        qty = r2(qty)
        if not (qty > 0) and not o.get("always"):
            return None
        l = {"key": "OFFEN", "unit": unit or "", "ep": None, "qty": qty, "total": 0, "grp": self.grp, "text": o.get("text") or "", "ctx": "",
             "rule": o.get("rule") or "", "flag": "offen", "open": True, "tk": id, "args": args or {}}
        self.lines.append(l)
        self.warn.append({"id": id, "sev": o.get("sev") or "amber", "args": args or {}})
        return l

    def w(self, id, sev, args=None):
        self.warn.append({"id": id, "sev": sev, "args": args or {}})

    def b(self, id, unit, v):
        self.bal.append({"id": id, "unit": unit, "v": v})


# ---------- Belag ----------
def belag(cx, B, A, Schnitt, rs, b):
    info = {"Valt": 0, "Vneu": 0}
    if not jt(B) or not (A > 0):
        return info
    if B.get("mode") == "bit":
        return belagBit(cx, B, A, Schnitt, rs)
    if B.get("mode") == "humus":
        return belagHumus(cx, B, A, b)
    if B.get("mode") == "pflaster":
        return belagPflaster(cx, B, A, Schnitt, rs, b)
    return info


def belagBit(cx, B, A, Schnitt, rs):
    info = {"Valt": 0, "Vneu": 0}
    dens = _dens["v"]
    d = num(B.get("d"), 150); i = -1
    if 51 <= d <= 100: i = 0
    elif 100 < d <= 150: i = 1
    elif 150 < d <= 200: i = 2
    cx.g("g_belag")
    if i < 0:
        cx.off("belagDicke", Schnitt, "m", {"d": d}, {"rule": rs["cut"]})
        cx.off("belagDicke", A, "m²", {"d": d}, {"rule": rs["area"]})
    else:
        cx.add(["117/223.122", "117/223.123", "117/223.124"][i], Schnitt, {"rule": rs["cut"]})
        cx.add(["117/223.212", "117/223.213", "117/223.214"][i], A, {"rule": rs["area"]})
    info["Valt"] = A * d / 1000
    Mt = info["Valt"] * dens
    mr = s2(A) + " m² × " + jstr(d) + " mm × " + jstr(dens) + " t/m³ = " + s2(Mt) + " t"
    cx.g("g_deponieBelag")
    if B.get("pak") == "gt250":
        cx.add("117/721.251", Mt, {"rule": mr})
        cx.off("pakE", Mt, "t", {}, {"sev": "stop", "rule": mr})
    else:
        cx.add("117/721.222", Mt, {"rule": mr})
        cx.add("117/731.222", Mt, {"rule": mr})
    if B.get("einbau") == "typN":
        cx.g("g_belagNeu")
        typL = B.get("typ") == "L"
        dT = num(B.get("dTrag"), 90); dD = num(B.get("dDeck"), 40); dF = num(B.get("fund"), 0)
        mTr = A * dT / 1000 * dens; mDk = A * dD / 1000 * dens
        rTr = s2(A) + " m² × " + jstr(dT) + " mm × " + jstr(dens) + " t/m³ = " + s2(mTr) + " t"
        rDk = s2(A) + " m² × " + jstr(dD) + " mm × " + jstr(dens) + " t/m³ = " + s2(mDk) + " t"
        dkOk = True; dkMass = False
        if typL:
            trMax = 90
            trKey = {40: "223/434.111", 70: "223/434.121", 90: "223/434.131"}.get(dT)
            dkTab = {20: "223/432.112"} if B.get("deck") == "AC4L" else {20: "223/432.211", 30: "223/432.213"}
            dkKey = dkTab.get(dD); dkOk = bool(dkKey); dkMass = True
        else:
            trKey = "223/444.121" if B.get("trag") == "T16" else "223/444.131"
            trMax = 70 if B.get("trag") == "T16" else 90
            dkKey = "223/444.221" if B.get("deck") == "AC11" else "223/444.211"
            if B.get("deckArt") == "masch":
                tab = {35: "223/442.211", 40: "223/442.212"} if B.get("deck") == "AC11" else {20: "223/442.111", 25: "223/442.112", 30: "223/442.113", 35: "223/442.114"}
                dkKey = tab.get(dD); dkOk = bool(dkKey); dkMass = True
            elif dD > 40:
                dkOk = False
        if jt(B.get("haft")):
            cx.add("223/422.101", A, {"rule": rs["area"]})
        if not trKey or dT > trMax:
            cx.off("tragMax", mTr, "t", {"d": dT, "max": trMax}, {"rule": rTr})
        else:
            cx.add(trKey, mTr, {"rule": rTr})
        if not dkOk:
            cx.off("deckMasch" if dkMass else "deckMax", mDk, "t", {"d": dD}, {"rule": rDk})
        else:
            cx.add(dkKey, mDk, {"rule": rDk})
        if jt(B.get("naehte")):
            dg = dT + dD
            if dg > 130:
                cx.off("naehteMax", Schnitt, "m", {"d": dg}, {"rule": rs["cut"]})
            else:
                cx.add("223/423.211" if dg <= 40 else "223/423.212" if dg <= 80 else "223/423.213", Schnitt, {"rule": rs["cut"]})
        if dF > 0:
            Vf = A * dF / 1000; rF = s2(A) + " m² × " + jstr(dF) + " mm = " + s2(Vf) + " m³"
            cx.add("223/271.113", Vf, {"rule": rF})
            if dF < 101:
                cx.off("fundMin", Vf, "m³", {"d": dF}, {"rule": rF})
            else:
                cx.add("223/272.112" if dF <= 200 else "223/272.113", Vf, {"rule": rF})
        dg = dT + dD
        if dg <= 40: ak = "223/424.111"
        elif dg <= 80: ak = "223/424.112"
        elif dg <= 130: ak = "223/424.113"
        else: ak = None
        if ak:
            cx.add(ak, Schnitt, {"rule": rs["cut"]})
        else:
            cx.off("anschlussMax", Schnitt, "m", {"d": dg}, {"rule": rs["cut"]})
        cx.add("223/571.101", Schnitt, {"rule": rs["cut"]})
        info["Vneu"] = A * (dT + dD + dF) / 1000
        if abs(dT + dD + dF - d) > 0.5:
            cx.w("dickeAbw", "info", {"neu": dT + dD + dF, "alt": d})
    else:
        info["Vneu"] = info["Valt"]
    return info


def rs2(A):
    return "Eingabe Fläche = " + s2(A) + " m²"


def belagHumus(cx, Bwrap, A, b):
    B = Bwrap.get("humus") or {}
    info = {"Valt": 0, "Vneu": 0}
    cx.g("g_belag")
    d = num(B.get("dOber"), 30) / 100; hand = jt(B.get("hand"))
    if B.get("art") == "rasenziegel":
        cx.add("151/211.001", A, {"rule": rs2(A)})
        info["Valt"] = A * 0.06
    else:
        Vab = A * d; rAb = rs2(A) + " × " + ("%.2f" % d) + " m = " + s2(Vab) + " m³"
        if hand:
            if b > 2.0:
                cx.off("humusBreite", Vab, "m³", {"b": r2(b)}, {"rule": rAb})
            else:
                cx.add("151/212.201", Vab, {"rule": rAb})
        else:
            cx.add("151/212.101" if b <= 2.0 else "151/212.102", Vab, {"rule": rAb})
        info["Valt"] = Vab
    cx.g("g_belagNeu")
    if B.get("art") == "rasenziegel":
        cx.add("151/775.001", A, {"rule": rs2(A)})
        info["Vneu"] = info["Valt"]
    else:
        cx.add("151/771.122" if hand else "151/771.112", A, {"rule": rs2(A)})
        if jt(B.get("ansaeen")):
            cx.add("151/774.101", A, {"rule": rs2(A)})
        info["Vneu"] = A * min(d, 0.30)
    return info


PFLAST_ERSTELLEN = {"betonverbund": {60: "222/551.102", 80: "222/551.103"}}
PFLAST_PLATTEN = {"natur": {40: "222/711.111", 50: "222/711.112"}, "beton": {40: "222/751.111", 50: "222/751.112"}}
PFLAST_ABBRUCH = {"platten": "117/224.211", "betonstein": "117/224.231", "natur": "117/225.221", "plattenDemon": "117/225.211"}
RAND_LIEF = {"gneis": {"8/11": "222/211.211", "11/13": "222/211.212"}, "granit": {"8/11": "222/212.211", "11/13": "222/212.212"}}
RAND_VERS = {"8/11": "222/311.111", "11/13": "222/311.112"}


def belagPflaster(cx, Bwrap, A, Schnitt, rs, b):
    B = Bwrap.get("pflaster") or {}
    info = {"Valt": 0, "Vneu": 0}
    cx.g("g_belag")
    if jt(B.get("abbruchAlt")):
        ak = PFLAST_ABBRUCH.get(B.get("abbruchArt")) or PFLAST_ABBRUCH["betonstein"]
        cx.add(ak, A, {"rule": rs["area"]})
        info["Valt"] = A * 0.15
    cx.g("g_belagNeu")
    d = num(B.get("dicke"), 60)
    if B.get("material") == "betonverbund":
        k1 = PFLAST_ERSTELLEN["betonverbund"].get(d)
        if k1: cx.add(k1, A, {"rule": rs["area"]})
        else: cx.off("pflastDicke", A, "m²", {"d": d}, {"rule": rs["area"]})
    else:
        grp = PFLAST_PLATTEN.get(B.get("material")) or PFLAST_PLATTEN["beton"]
        k2 = grp.get(d)
        if k2: cx.add(k2, A, {"rule": rs["area"]})
        else: cx.off("pflastDicke", A, "m²", {"d": d}, {"rule": rs["area"]})
    dF = num(B.get("fund"), 200)
    if dF > 0:
        Vf = A * dF / 1000; rF = s2(A) + " m² × " + jstr(dF) + " mm = " + s2(Vf) + " m³"
        cx.add("223/271.113", Vf, {"rule": rF})
        if dF < 101: cx.off("fundMin", Vf, "m³", {"d": dF}, {"rule": rF})
        else: cx.add("223/272.112" if dF <= 200 else "223/272.113", Vf, {"rule": rF})
    if jt(B.get("randNeu")):
        randKey = (RAND_LIEF.get(B.get("randMat")) or RAND_LIEF["gneis"]).get(B.get("randTyp")) or RAND_LIEF["gneis"]["8/11"]
        randVers = RAND_VERS.get(B.get("randTyp")) or RAND_VERS["8/11"]
        Lr = num(B.get("randLaenge"), 0)
        if Lr > 0:
            cx.add(randKey, Lr, {"rule": "Eingabe = " + s2(Lr) + " m"}); cx.add(randVers, Lr, {"rule": "Eingabe = " + s2(Lr) + " m"})
        if jt(B.get("randAbbruch")) and Lr > 0:
            cx.add("117/224.111", Lr, {"rule": "Eingabe = " + s2(Lr) + " m"})
    info["Vneu"] = A * (d + dF) / 1000
    return info


# ---------- Leitungszone, Verfüllung ----------
def zone(cx, Vu, c, rule):
    if not (Vu > 0):
        return
    cx.g("g_zone")
    if c.get("umhType") == "beton":
        cx.add("151/731.101", Vu, {"rule": rule}); return
    k = {"betonkies": "151/711.123", "sand": "151/711.111", "kies48": "151/711.112"}.get(c.get("umhMat")) or "151/711.123"
    cx.add(k, Vu, {"rule": rule})
    cx.add("151/721.101", Vu, {"rule": rule})


def verfuellung(cx, Ve, Vv, c, direkt, vrule):
    hand = jt(c.get("einfHand")); R = 0; fremd = 0
    fk = {"kies045": "151/711.116", "kies016": "151/711.114", "betonkies": "151/711.123"}
    cx.g("g_verf")
    if c.get("verf") == "aushub":
        R = min(Ve, Vv)
        cx.add("151/741.121" if hand else "151/741.111", R, {"rule": "min(Erdaushub " + s2(Ve) + "; Bedarf " + s2(Vv) + ") = " + s2(R) + " m³"})
        fremd = Vv - R
        if fremd > 0.005:
            cx.w("fremdErgaenzt", "amber", {"v": r2(fremd)})
            fr = "Bedarf " + s2(Vv) + " − Aushub " + s2(R) + " = " + s2(fremd) + " m³"
            cx.add(fk["kies045"], fremd, {"rule": fr})
            cx.add("151/741.122" if hand else "151/741.112", fremd, {"rule": fr})
    else:
        fremd = Vv
        cx.add(fk.get(c.get("verf")) or fk["kies045"], fremd, {"rule": vrule})
        cx.add("151/741.122" if hand else "151/741.112", fremd, {"rule": vrule})
    Vs = max(0, Ve - R); sr = "Erdaushub " + s2(Ve) + " − wiederverwendet " + s2(R) + " = " + s2(Vs) + " m³"
    cx.g("g_deponie")
    if Vs > 0:
        if not direkt:
            cx.add("151/273.203", Vs, {"rule": sr})
        cx.add("151/252.213", Vs, {"rule": sr})
        cx.add("151/262.113", Vs, {"rule": sr})
    return {"R": R, "fremd": fremd, "Vs": Vs}


# ---------- Rohranlage ----------
ROHR = {
    "55": {"lief5": "151/412.111", "lief10": "151/412.211", "ver": "151/431.001", "muf": "151/421.511", "mufV": "151/442.111",
           "b90": "151/421.221", "b90V": "151/441.121", "b45": "151/421.121", "b45V": "151/441.111", "cut": "151/482.101", "kal": "151/485.004"},
    "100": {"lief10": "151/412.214", "ver": "151/431.002", "muf": "151/421.514", "mufV": "151/442.114",
            "b90": "151/421.224", "b90V": "151/441.124", "b45": "151/421.124", "b45V": "151/441.114", "cut": "151/482.101", "kal": "151/485.001"},
    "120": {"lief10": "151/412.215", "ver": "151/431.003", "muf": "151/421.515", "mufV": "151/442.115",
            "b90": "151/421.225", "b90V": "151/441.125", "b45": "151/421.125", "b45V": "151/441.115", "cut": "151/482.102", "kal": "151/485.002"},
    "150": {"lief10": "151/412.216", "ver": "151/431.003", "muf": "151/421.516", "mufV": "151/442.116",
            "b90": "151/421.226", "b90V": "151/441.126", "b45": "151/421.126", "b45V": "151/441.116", "cut": "151/482.102", "kal": "151/485.003"}}


def rohr(cx, c, L):
    R = ROHR.get(jstr(c.get("dn"))) or ROHR["55"]; n = max(1, num(c.get("n"), 1)); ln = num(c.get("len"), 10)
    m = L * n; mr = s2(L) + " m × " + jstr(n) + " Rohr(e) = " + s2(m) + " m"
    cx.g("g_rohr")
    if ln == 5 and not R.get("lief5"):
        cx.off("rohr5", m, "m", {"dn": c.get("dn")}, {"rule": mr})
    else:
        cx.add(R["lief5"] if ln == 5 else R["lief10"], m, {"rule": mr})
    cx.add(R["ver"], m, {"rule": mr})
    auto = c.get("muffenMode") != "manuell"
    mu = n * ceil(L / 5 - 1e-9) if auto else num(c.get("muffenN"), 0)
    if auto:
        cx.w("muffenVorl", "info", {"n": mu})
    mur = ("⌈" + s2(L) + " / 5⌉ × " + jstr(n) + " = " + jstr(mu) + " St") if auto else ("manuell = " + jstr(mu) + " St")
    if mu > 0:
        cx.add(R["muf"], mu, {"rule": mur}); cx.add(R["mufV"], mu, {"rule": mur})
    b90 = num(c.get("b90"), 0); b45 = num(c.get("b45"), 0)
    if b90 > 0:
        cx.add(R["b90"], b90, {"rule": "Anzahl = " + jstr(b90) + " St"}); cx.add(R["b90V"], b90, {"rule": "Anzahl = " + jstr(b90) + " St"})
    if b45 > 0:
        cx.add(R["b45"], b45, {"rule": "Anzahl = " + jstr(b45) + " St"}); cx.add(R["b45V"], b45, {"rule": "Anzahl = " + jstr(b45) + " St"})
    sc = num(c.get("schneiden"), 0)
    if sc > 0:
        cx.add(R["cut"], sc, {"rule": "Anzahl = " + jstr(sc) + " St"})
    if jt(c.get("warnband")):
        cx.add("151/484.111", L, {"rule": "Grabenlänge = " + s2(L) + " m"}); cx.add("151/484.211", L, {"rule": "Grabenlänge = " + s2(L) + " m"})
    if jt(c.get("kalib")):
        cx.add(R["kal"], m, {"rule": mr})
    if c.get("einzug") == "schnur":
        cx.add("151/486.001", m, {"rule": mr})
    if c.get("einzug") == "draht":
        cx.add("151/487.001", m, {"rule": mr})


LAENGS = {"100": {"lief": "151/415.102", "ver": "151/433.002"}, "120": {"lief": "151/415.103", "ver": "151/433.003"}, "150": {"lief": "151/415.104", "ver": "151/433.003"}}
ABZW = {"tstueck8": {"lief": "151/423.301", "ver": "151/451.301"}, "tstueck4": {"lief": "151/423.302", "ver": "151/451.302"},
        "abzwK55": {"lief": "151/423.303", "ver": "151/451.303"}, "abzwK100": {"lief": "151/423.304", "ver": "151/451.304"},
        "abzwKk4": {"lief": "151/423.305", "ver": "151/451.305"}, "abzwKk8": {"lief": "151/423.306", "ver": "151/451.306"},
        "verbind4": {"lief": "151/423.307", "ver": "151/451.307"}}


def laengsRohr(cx, c, L):
    R = LAENGS.get(jstr(c.get("dn2"))) or LAENGS["100"]; n = max(1, num(c.get("n2"), 1)); m = L * n
    mr = s2(L) + " m × " + jstr(n) + " Rohr(e) = " + s2(m) + " m"
    cx.g("g_rohr")
    cx.add(R["lief"], m, {"rule": mr}); cx.add(R["ver"], m, {"rule": mr})
    kal = ROHR.get(jstr(c.get("dn2"))) or ROHR["100"]
    if jt(c.get("warnband")):
        cx.add("151/484.111", L, {"rule": "Grabenlänge = " + s2(L) + " m"}); cx.add("151/484.211", L, {"rule": "Grabenlänge = " + s2(L) + " m"})
    if jt(c.get("kalib")):
        cx.add(kal["kal"], m, {"rule": mr})
    if c.get("einzug") == "schnur":
        cx.add("151/486.001", m, {"rule": mr})
    if c.get("einzug") == "draht":
        cx.add("151/487.001", m, {"rule": mr})
    for a in (c.get("abzweiger") or []):
        k = ABZW.get(g(a, "art")); q = num(g(a, "n"), 0)
        if k and q > 0:
            cx.add(k["lief"], q, {"rule": "Anzahl = " + jstr(q) + " St"}); cx.add(k["ver"], q, {"rule": "Anzahl = " + jstr(q) + " St"})


BLOCK_KEY = {"55_1": "151/471.115", "55_2": "151/471.124", "55_m": "151/471.134", "100_1": "151/471.111", "100_2": "151/471.121", "100_m": "151/471.131"}


def rohrblock(cx, c, L):
    cx.g("g_rohr")
    for bl in (c.get("bloecke") or []):
        dn = num(g(bl, "dn"), 55); n = max(1, num(g(bl, "n"), 1)); lagen = g(bl, "lagen") if jt(g(bl, "lagen")) else "1"
        maxN = 3 if dn == 55 else 4
        bk = BLOCK_KEY.get(jstr(dn) + "_" + ("1" if lagen == "1" else "2" if lagen == "2" else "m"))
        rd = s2(L) + " m Graben, DN " + jstr(dn) + ", " + jstr(n) + " Rohr(e), " + jstr({"1": "einlagig", "2": "zweilagig", "m": "mehrlagig"}.get(lagen))
        if (dn != 55 and dn != 100) or n > maxN or not bk:
            cx.off("blockAusserLV", L, "m", {"dn": dn, "n": n}, {"rule": rd})
        else:
            cx.add(bk, L, {"rule": rd})
        lk = ROHR.get(jstr(dn)) or ROHR["55"]
        lief = lk["lief5"] if num(g(bl, "len"), 10) == 5 and lk.get("lief5") else lk["lief10"]
        m = L * n; mr = s2(L) + " m × " + jstr(n) + " Rohr(e) = " + s2(m) + " m"
        cx.add(lief, m, {"rule": mr + "  ·  Lieferung, Verlegen im Rohrblock enthalten"})
        mu = n * ceil(L / (num(g(bl, "len"), 10) or 10) - 1e-9)
        if mu > 0:
            cx.add(lk["muf"], mu, {"rule": "⌈" + s2(L) + " / " + jstr(num(g(bl, "len"), 10)) + "⌉ × " + jstr(n) + " = " + jstr(mu) + " St"}); cx.add(lk["mufV"], mu, {})
    if jt(c.get("warnband")):
        cx.add("151/484.111", L, {"rule": "Grabenlänge = " + s2(L) + " m"}); cx.add("151/484.211", L, {"rule": "Grabenlänge = " + s2(L) + " m"})
    if jt(c.get("kalib")):
        for bl in (c.get("bloecke") or []):
            lk = ROHR.get(jstr(num(g(bl, "dn"), 55))) or ROHR["55"]; m = L * max(1, num(g(bl, "n"), 1))
            cx.add(lk["kal"], m, {"rule": s2(m) + " m"})
    cx.w("blockAnn", "info", {})


def breite(cx, c):
    T_ = num(c.get("T"), 0.6); mode = c.get("bmode") if jt(c.get("bmode")) else "min60"; a = num(c.get("aussen"), 0)
    if mode == "begangen": b = a + 0.40
    elif mode == "nicht_begangen": b = a + 0.10
    elif mode == "manuell": b = num(c.get("bman"), 0.6)
    else: b = 0.60
    if mode in ("begangen", "nicht_begangen") and not (a > 0):
        cx.w("aussenFehlt", "amber", {}); b = 0.60
    if T_ > 1.0 and b < 0.60 - 1e-9:
        cx.w("breite60", "stop", {"b": r2(b), "T": T_})
    if mode != "min60" and T_ > 1.0 and mode in ("begangen", "nicht_begangen"):
        cx.w("modusTiefe", "amber", {"T": T_})
    return b


def aushubLines(cx, keys, T_, Vm, Vh, rm, rh):
    cx.g("g_aushub")
    if T_ > 2.0: cx.off("masch2", Vm, "m³", {"T": T_}, {"rule": rm})
    else: cx.add(keys["m1"] if T_ <= 1.5 else keys["m2"], Vm, {"rule": rm})
    if T_ > 1.5: cx.off("handTiefe", Vh, "m³", {"T": T_}, {"rule": rh})
    else: cx.add(keys["h"], Vh, {"rule": rh})


def saugbagger(cx, c, Vm, Vh):
    cx.g("g_aushub")
    st = num(c.get("saugH"), 0)
    cx.add("151/227.101", 1, {"rule": "1 Etappe"})
    if st > 0:
        cx.add("151/227.201", st, {"rule": "Eingabe = " + jstr(st) + " h"})
    cx.w("saugbaggerAnn", "info", {})


ERSCH_KEYS = {"graben_m": "151/222", "graben_gm": "151/223", "graben_h": "151/224", "grube_m": "151/232", "grube_h": "151/234"}


def erschwernis(cx, e, T_, Vm, Vh, kindM, kindH):
    if not jt(e):
        return
    cx.g("g_ersch")
    over = T_ > 1.5

    def apply(base, sub, qty, rd, unit=None):
        if not (qty > 0):
            return
        key = base + "." + jstr(sub)
        if over: cx.off("erschTiefe", qty, unit or "m³", {"T": T_}, {"rule": rd})
        elif key not in cx.LV: cx.off("erschOhneLV", qty, unit or "m³", {"k": key}, {"rule": rd})  # z. B. 151/234.201 fehlt im LV
        else: cx.add(key, qty, {"rule": rd})
    klSub = {"5": "111", "6": "121", "7": "131"}.get(jstr(e.get("klasse")))
    if klSub:
        apply(kindM, klSub, Vm, "Maschinenanteil " + s2(Vm) + " m³")
        if kindH: apply(kindH, klSub, Vh, "Handanteil " + s2(Vh) + " m³")
    if e.get("verf") == "gefroren":
        apply(kindM, "201", Vm, "Maschinenanteil " + s2(Vm) + " m³")
        if kindH: apply(kindH, "201", Vh, "Handanteil " + s2(Vh) + " m³")
    if e.get("verf") == "stein":
        apply(kindM, "202", Vm, "Maschinenanteil " + s2(Vm) + " m³")
        if kindH: apply(kindH, "202", Vh, "Handanteil " + s2(Vh) + " m³")
    if jt(e.get("hind")) and e.get("hind") != "keine":
        hs = {"findling": "301", "fundUnbew": "302", "fundBew": "303"}.get(e.get("hind"))
        hv = num(e.get("hindVol"), 0.3)
        apply(kindM, hs, hv, "Eingabe = " + s2(hv) + " m³")
    if (klSub or e.get("verf") != "keine" or (jt(e.get("hind")) and e.get("hind") != "keine")) and not over:
        cx.w("erschAnn", "info", {})


def fremdleitungen(cx, c, L):
    k = c.get("kreuz")
    if jt(k) and jt(g(k, "on")):
        n = max(0, num(g(k, "n"), 0)); ln = num(g(k, "len"), 1)
        if n > 0 and ln > 0:
            m = n * ln; r = jstr(n) + " × " + s2(ln) + " m = " + s2(m) + " m"
            cx.g("g_fremd")
            cx.add("151/241.002" if g(k, "richtung") == "quer" else "151/241.001", m, {"rule": r})
            cx.add("151/242.002" if g(k, "richtung") == "quer" else "151/242.001", m, {"rule": r})
    z = c.get("zores")
    if jt(z) and jt(g(z, "on")):
        zl = num(g(z, "len"), 0)
        if zl > 0:
            cx.g("g_fremd")
            zk = "151/244.002" if g(z, "zustand") == "betrieb" else "151/244.003" if g(z, "zustand") == "nicht" else "151/244.001"
            cx.add(zk, zl, {"rule": "Eingabe = " + s2(zl) + " m"})


def boeschung(cx, c):
    bo = c.get("boeschung")
    if not jt(bo) or not jt(g(bo, "on")):
        return
    A = num(g(bo, "flaeche"), 0)
    if A > 0:
        cx.g("g_boesch"); cx.add("151/311.121" if jt(g(bo, "geneigt")) else "151/311.111", A, {"rule": "Eingabe = " + s2(A) + " m²"})


def _belagOn(c):
    b = c.get("belag")
    return jt(b) and jt(g(b, "mode")) and g(b, "mode") != "none"


def graben(c, LV, P=None):
    cx = Ctx(LV)
    L = num(c.get("L"), 0); T_ = num(c.get("T"), 0.6); b = breite(cx, c)
    hk = HAND[c.get("hand")] if HAND.get(c.get("hand")) is not None else 0.10
    V = L * b * T_; Vh = V * hk; Vm = V - Vh
    Lb = min(num(c.get("Lb"), L), L) if _belagOn(c) else 0
    A = Lb * b; Schnitt = 2 * (Lb + b) if Lb > 0 else 0
    if not (L > 0) or not (b > 0) or not (T_ > 0):
        return {"lines": [], "warn": cx.warn, "bal": []}
    bi = belag(cx, c.get("belag"), A, Schnitt, {"cut": "2 × (" + s2(Lb) + " + " + s2(b) + ") = " + s2(Schnitt) + " m", "area": s2(Lb) + " × " + s2(b) + " = " + s2(A) + " m²"}, b)
    gs = jt(c.get("gesp")); vr = s2(L) + " × " + s2(b) + " × " + s2(T_) + " = " + s2(V) + " m³"
    if c.get("aushubArt") == "saug":
        saugbagger(cx, c, Vm, Vh)
    else:
        aushubLines(cx, {"m1": "151/221.121" if gs else "151/221.111", "m2": "151/221.122" if gs else "151/221.112", "h": "151/221.221" if gs else "151/221.211"}, T_, Vm, Vh,
                    vr + " × " + s2((1 - hk) * 100) + " % = " + s2(Vm) + " m³", vr + " × " + s2(hk * 100) + " % = " + s2(Vh) + " m³")
    erschwernis(cx, c.get("ersch"), T_, Vm, Vh, ERSCH_KEYS["graben_gm"] if gs else ERSCH_KEYS["graben_m"], ERSCH_KEYS["graben_h"])
    if gs:
        Fs = 2 * L * T_; fr = "2 Wände × " + s2(L) + " m × " + s2(T_) + " m = " + s2(Fs) + " m²"
        cx.g("g_spries")
        if T_ > 2.0: cx.off("spries2", Fs, "m²", {"T": T_}, {"rule": fr})
        else: cx.add("151/321.101" if T_ <= 1.5 else "151/321.102", Fs, {"rule": fr})
        cx.w("spriesAnn", "info", {})
    Ve = max(0, V - bi["Valt"])
    au = num(c.get("umhArea"), 0.035); blockA = 0
    blk = c.get("rohrSystem") == "block"
    if blk and jt(c.get("block")):
        blockA = num(g(c["block"], "breite"), 0) * num(g(c["block"], "hoehe"), 0)
    Vu = L * blockA if blk else L * au
    Vv = max(0, V - Vu - bi["Vneu"])
    vvr = "V " + s2(V) + " − " + ("Rohrblock (Eingabe Aussenmass)" if blk else "Leitungszone") + " " + s2(Vu) + " − Belag/Fundation " + s2(bi["Vneu"]) + " = " + s2(Vv) + " m³"
    if blk:
        if blockA <= 0: cx.w("blockMassFehlt", "amber", {})
    else:
        zone(cx, Vu, c, s2(L) + " m × " + jstr(au) + " m²/m = " + s2(Vu) + " m³")
    vrs = verfuellung(cx, Ve, Vv, c, jt(c.get("direkt")), vvr)
    if Vv <= 0 and V > 0:
        cx.w("verfNull", "amber", {})
    if blk: rohrblock(cx, c, L)
    elif c.get("rohrSystem") == "laengs": laengsRohr(cx, c, L)
    else: rohr(cx, c, L)
    fremdleitungen(cx, c, L)
    boeschung(cx, c)
    for i, u, v in [("b_V", "m³", V), ("b_Vbelag", "m³", bi["Valt"]), ("b_Ve", "m³", Ve), ("b_Vu", "m³", Vu), ("b_Vneu", "m³", bi["Vneu"]), ("b_Vv", "m³", Vv),
                    ("b_R", "m³", vrs["R"]), ("b_fremd", "m³", vrs["fremd"]), ("b_Vs", "m³", vrs["Vs"])]:
        cx.b(i, u, v)
    return {"lines": cx.lines, "warn": cx.warn, "bal": cx.bal, "geo": {"b": b, "V": V, "A": A, "Schnitt": Schnitt}}


# ---------- Schachtauswahl ----------
TYP_SIZE = {"KS80U": "KS80U", "KS80H": "KS80", "KES100": "KES100", "KES150": "KES150", "KES175": "KES175", "ES300": "ES300", "PLS1": "PLS1", "PLS2": "PLS2", "PLS3": "PLS3"}


def sizeOf(typ):
    i = TYP_SIZE.get(typ)
    return next((s for s in SIZES if s["id"] == i), None)


def shaftOf(S):
    return "KS" if S["kind"] == "KS" else "PLS" if S["kind"] == "PLS" else "ES" if S["kind"] == "ES" else "KES"


def shapeOf(c, S):
    return "rund" if S["kind"] == "KS" else ("rund" if c.get("shape") == "rund" else "eckig")


def sysDefault(loc):
    return "nivo" if not loc else "beton" if loc["round"] == "dsbeton" else loc["round"]


def locOf(c):
    return next((l for l in LOCS if l["id"] == c.get("einbauort")), None)


def coverRows(loc, shape, fmt, socle, sys):
    out = []
    if shape == "rund":
        if sys == "gross130":
            return [["137.352.1", 1], ["137.363.8", 1]]
        if sys == "beton" or loc["round"] == "dsbeton":
            return [["DS600BETON", 1]]
        if sys == "ds": out += [["137.351.3", 1], ["137.354.7", 1]]
        else: out += [["137.353.9", 1], ["137.363.8", 1]]
        return out
    if loc["cover"] == "lock":
        return [[("137.794.4" if socle == "mit" else "137.792.8") if fmt == "180" else ("137.793.6" if socle == "mit" else "137.791.0"), 1]]
    if loc["cover"] == "inlay":
        if fmt == "180": return [["137.427.1" if socle == "mit" else "137.426.3", 1], ["137.790.2", 2]]
        return [["137.789.4" if socle == "mit" else "137.788.6", 1], ["137.790.2", 1]]
    return [["BETONPLATTE", 1]]


def bewertung(cx, c, S, ersatz):
    loc = locOf(c); size = sizeOf(c.get("typ")); st = {"level": "ok", "ids": []}
    if not loc:
        return {"level": "amber", "ids": []}
    shaft = shaftOf(S); shape = shapeOf(c, S); sys = c.get("sys") if jt(c.get("sys")) else sysDefault(loc); fmt = c.get("deckelFormat2")
    O = {"ok": 0, "info": 0, "amber": 1, "stop": 2}

    def up(l, i):
        if O[l] > O[st["level"]]: st["level"] = l
        st["ids"].append(i); cx.w(i, l, {})
    if not ersatz:
        if loc["shafts"] == "none": up("stop", "sa_rNoShaft")
        if loc["shafts"] == "avoid" and shaft in ("ES", "KES"): up("amber", "sa_rAvoid")
        s = size["std"][loc["group"]] if size else "stop"
        if s == "stop": up("stop", "sa_rSizeStop")
        elif s == "amber": up("amber", "sa_rSizeAmber")
        if shaft == "KS" and loc["group"] == "fast": up("stop", "sa_rKsFast")
        if size and size["id"] == "KES100": up("info", "sa_rSmall")
    else:
        if shape == "eckig" and loc["cover"] != "platte" and fmt == "180": up("amber", "sa_rErs180")
        if shaft == "PLS": up("amber", "sa_rErsPLS")
    if shape == "rund" and sys == "gross130":
        up("info", "sa_rSys130")
    elif shape == "rund" and loc["round"] != "dsbeton":
        if sys == "ds" and loc["round"] == "nivo": up("amber", "sa_rSysDs")
        if sys == "nivo" and loc["round"] == "ds": up("amber", "sa_rSysNivo")
    if st["level"] != "ok" and jt(c.get("deviate")) and (not jstr(c.get("reason") or "").strip() or not jstr(c.get("approver") or "").strip()):
        cx.w("sa_rMissingReason", "stop", {})
    return st


def abdeckung(cx, c, S, n):
    loc = locOf(c); shape = shapeOf(c, S); rows = []
    if S["kind"] == "PLS" and c.get("modus") != "ersatz":
        cx.w("schachtDeckelIncl", "info", {}); return rows
    cx.g("g_abdeckung")
    if not loc or (loc["cover"] == "platte" and shape == "eckig"):
        for f in ("rahmen", "deckel"):
            v = c.get(f)
            if jt(v):
                cx.add(v, n, {"rule": "Eingabe = " + jstr(n) + " St"})
                vv = v.replace("632.1", "632.2", 1)
                if vv != v and vv in cx.LV:
                    cx.add(vv, n, {"rule": "Eingabe = " + jstr(n) + " St"})
        if not jt(c.get("rahmen")) and not jt(c.get("deckel")): cx.w("keineAbdeckung", "amber", {})
        if not loc: cx.w("schachtOrtFehlt", "amber", {})
        return rows
    sys = c.get("sys") if jt(c.get("sys")) else sysDefault(loc)
    rows = coverRows(loc, shape, "180" if c.get("deckelFormat2") == "180" else "90", "mit" if c.get("deckelSockel") == "mit" else "ohne", sys)
    for art, k in rows:
        q = k * n; p = SP.get(art); r = jstr(k) + " × " + jstr(n) + " = " + jstr(q) + " St  ·  Art. " + art
        if p and p.get("posL"):
            cx.add("151/" + p["posL"], q, {"rule": r}); cx.add("151/" + p["posV"], q, {"rule": r})
        else:
            cx.off("deckelBeton" if art == "DS600BETON" else "abdOhneLV", q, "St", {"t": art}, {"rule": r})
    if shape == "rund" and sys in ("nivo", "gross130"):
        cx.add("223/926.111", n, {"rule": "Nivroll auf Deckschicht hochziehen = " + jstr(n) + " St"})
    sp = num(c.get("spare"), 0)
    if sp > 0:
        rows.append(["137.787.8", 0]); cx.off("deckelErsatz", sp, "St", {}, {"rule": "Eingabe = " + jstr(sp) + " St  ·  Art. 137.787.8"})
    return rows


def schachtOpts(cx, c):
    for o in OPTS:
        if o["id"] in ("abbrGuss", "abbrBeton", "abbrFlaeche", "nivrollHoch", "ansch80", "ansch150"):
            continue
        q = num(g(c.get("opts") or {}, o["id"]), 0)
        if q > 0:
            cx.g("g_abbruch" if o["npk"] == "117" else "g_zus"); cx.add(o["npk"] + "/" + o["pos"], q, {"rule": "Eingabe = " + jstr(q) + " " + o["unit"]})


DECKEL_KEY = {"hoeher": {"rund": "151/633.001", "rechteckig": "151/633.002"}, "tiefer": {"rund": "151/634.001", "rechteckig": "151/634.002"}}
ALT_KEY = {"guss": "117/228.301", "beton": "117/228.302", "flaeche": "117/228.303"}


def schacht(c, LV, P=None):
    cx = Ctx(LV)
    if c.get("modus") == "deckel":
        n0 = max(0, num(c.get("deckelN"), 1))
        if not (n0 > 0):
            return {"lines": [], "warn": cx.warn, "bal": []}
        cx.g("g_bauwerk")
        dk = DECKEL_KEY["tiefer" if c.get("deckelRichtung") == "tiefer" else "hoeher"]["rechteckig" if c.get("deckelFormat") == "rechteckig" else "rund"]
        cx.add(dk, n0, {"rule": "Anzahl = " + jstr(n0) + " St"})
        schachtOpts(cx, c)
        return {"lines": cx.lines, "warn": cx.warn, "bal": cx.bal, "geo": {}}
    S = SCHACHT.get(c.get("typ")); n = max(0, num(c.get("n"), 1))
    if not S or not (n > 0):
        return {"lines": [], "warn": cx.warn, "bal": []}
    if c.get("modus") == "ersatz":
        ev0 = bewertung(cx, c, S, True)
        cx.g("g_abbruch")
        cx.add(ALT_KEY.get(c.get("alt")) or ALT_KEY["guss"], n, {"rule": "Anzahl = " + jstr(n) + " St"})
        rows0 = abdeckung(cx, c, S, n)
        schachtOpts(cx, c)
        return {"lines": cx.lines, "warn": cx.warn, "bal": cx.bal, "geo": {"ev": ev0, "rows": rows0, "n": n, "mass": [], "ersatz": True, "shaft": shaftOf(S)}}
    ev = bewertung(cx, c, S, False)
    a = num(c.get("arbeit"), 0.5); hk = HAND[c.get("hand")] if HAND.get(c.get("hand")) is not None else 0.10
    Gl = S["lo"] + 2 * a; Gb = S["bo"] + 2 * a; Gt = S["ho"] + 0.10
    Vg = Gl * Gb * Gt * n; Vb = S["lo"] * S["bo"] * S["ho"] * n
    A = Gl * Gb * n if _belagOn(c) else 0; Schnitt = 2 * (Gl + Gb) * n if A > 0 else 0
    nx = (" × " + jstr(n)) if n > 1 else ""
    gr = s2(Gl) + " × " + s2(Gb) + " × " + s2(Gt) + nx + " = " + s2(Vg) + " m³"
    cx.g("g_bauwerk")
    cx.add(S["key"], n, {"rule": "Anzahl = " + jstr(n) + " St"})
    an = num(c.get("anschl"), 0)
    if an > 0:
        if S["kind"] == "KS": kk = "151/672.202" if c.get("anDN") == "150" else "151/672.201"
        else: kk = "151/672.302" if c.get("anDN") == "150" else "151/672.301"
        cx.add(kk, an * n, {"rule": jstr(an) + " × " + jstr(n) + " = " + jstr(an * n) + " St"})
    bi = belag(cx, c.get("belag"), A, Schnitt, {"cut": "2 × (" + s2(Gl) + " + " + s2(Gb) + ")" + nx + " = " + s2(Schnitt) + " m", "area": s2(Gl) + " × " + s2(Gb) + nx + " = " + s2(A) + " m²"}, Gl)
    pl = num(c.get("platten"), 0)
    if pl > 0:
        cx.g("g_abbruch"); cx.add("117/228.201", pl, {"rule": "Anzahl = " + jstr(pl) + " St"})
    aushubLines(cx, {"m1": "151/231.111", "m2": "151/231.112", "h": "151/231.211"}, Gt, Vg * (1 - hk), Vg * hk,
                gr + " × " + s2((1 - hk) * 100) + " % = " + s2(Vg * (1 - hk)) + " m³", gr + " × " + s2(hk * 100) + " % = " + s2(Vg * hk) + " m³")
    erschwernis(cx, c.get("ersch"), Gt, Vg * (1 - hk), Vg * hk, ERSCH_KEYS["grube_m"], ERSCH_KEYS["grube_h"])
    bt = num(c.get("beton"), 0) * n
    if bt > 0:
        cx.g("g_deponie")
        r = jstr(num(c.get("beton"), 0)) + " × " + jstr(n) + " = " + s2(bt) + " m³"
        cx.add("151/252.221", bt, {"rule": r}); cx.add("151/262.121", bt, {"rule": r})
    Ve = max(0, Vg - bi["Valt"]); Vv = max(0, Vg - Vb - bi["Vneu"])
    vvr = "Grube " + s2(Vg) + " − Bauwerk " + s2(Vb) + " − Belag/Fundation " + s2(bi["Vneu"]) + " = " + s2(Vv) + " m³"
    vrs = verfuellung(cx, Ve, Vv, c, c.get("direkt") is not False, vvr)
    rows = abdeckung(cx, c, S, n)
    schachtOpts(cx, c)
    for i, u, v in [("b_Vg", "m³", Vg), ("b_Vbelag", "m³", bi["Valt"]), ("b_Ve", "m³", Ve), ("b_Vb", "m³", Vb), ("b_Vneu", "m³", bi["Vneu"]), ("b_Vv", "m³", Vv),
                    ("b_R", "m³", vrs["R"]), ("b_fremd", "m³", vrs["fremd"]), ("b_Vs", "m³", vrs["Vs"])]:
        cx.b(i, u, v)
    sz = sizeOf(c.get("typ"))
    return {"lines": cx.lines, "warn": cx.warn, "bal": cx.bal,
            "geo": {"Gl": Gl, "Gb": Gb, "Gt": Gt, "ev": ev, "rows": rows, "n": n, "shaft": shaftOf(S), "incl": bool(sz and sz.get("coverIncl")),
                    "mass": [[m[0], m[1], m[2] * n, m[2]] for m in sz["mass"]] if sz else []}}


# ---------- Weitere Reiter ----------
def res(cx, geo=None):
    return {"lines": cx.lines, "warn": cx.warn, "bal": cx.bal, "geo": geo or {}}


def eing(q, u=None):
    return "Eingabe = " + s2(q) + ((" " + u) if u else "")


ABSCHL = {"aB": ["117/224.111", "222/211.211", "222/311.111"], "aW": ["117/224.112", "222/211.212", "222/311.311"],
          "aS": ["117/224.121", "222/211.412", "222/321.122"], "aR": ["117/224.141", "222/211.413", "222/321.123"]}
UEBERG = {"uF": "113/214.111", "uP": "113/214.211", "uL": "113/214.311"}


def zusaetze(cx, c):
    for u, k in UEBERG.items():
        q = num(c.get(u), 0)
        if q > 0:
            cx.g("g_zus"); cx.add(k, q, {"rule": eing(q, "St")})
    for k, ps in ABSCHL.items():
        m = num(c.get(k), 0)
        if m > 0:
            cx.g("g_zus")
            for p in ps:
                cx.add(p, m, {"rule": eing(m, "m")})


ROH = {"K55": {"l": "151/412.111", "v": "151/431.001", "s": "151/482.101"}, "KW50": {"l": None, "v": "151/431.001", "s": "151/482.101"},
       "K100 PEHD": {"l": "151/412.214", "v": "151/431.002", "s": "151/482.101"}, "K120 PEHD": {"l": "151/412.215", "v": "151/431.003", "s": "151/482.102"},
       "K150 PEHD": {"l": "151/412.216", "v": "151/431.003", "s": "151/482.102"}, "K100 mit LV": {"l": "151/415.102", "v": "151/433.002", "s": "151/482.101"},
       "K120 mit LV": {"l": "151/415.103", "v": "151/433.003", "s": "151/482.102"}, "K150 mit LV": {"l": "151/415.104", "v": "151/433.003", "s": "151/482.102"}}
BOE = {"K55, 90°, R = 0.60 m": {"l": "151/421.121", "v": "151/441.111"}, "K55, 90°, R = 1.00 m": {"l": None, "v": "151/441.111"},
       "K100, 90°, R = 1.00 m": {"l": "151/421.124", "v": "151/441.114"}, "K120, 90°, R = 1.20 m": {"l": "151/421.125", "v": "151/441.115"},
       "K150, 90°, R = 1.50 m": {"l": "151/421.126", "v": "151/441.116"},
       "Halbschalenabzweiger, K55": {"l": "151/423.303", "v": "151/451.303"}, "Halbschalenabzweiger, K100 auf K55": {"l": "151/423.304", "v": "151/451.304"},
       "Halbschalenabzweiger, KK4 auf K55": {"l": "151/423.305", "v": "151/451.305"}, "Halbschalenabzweiger, KK8 auf K55": {"l": "151/423.306", "v": "151/451.306"},
       "T-KK4 mit 2 K55 Ausgängen": {"l": "151/423.302", "v": "151/451.302"}, "T-KK8 mit 2 K55 Ausgängen": {"l": "151/423.301", "v": "151/451.301"},
       "Verbindungsstück KK4": {"l": "151/423.307", "v": "151/451.307"}}
MUF = {"Doppelsteckmuffen K55": {"l": "151/421.511", "v": "151/442.111"}, "Doppelsteckmuffen K100": {"l": "151/421.514", "v": "151/442.114"},
       "Doppelsteckmuffen K120": {"l": "151/421.515", "v": "151/442.115"}, "Doppelsteckmuffen K100 mit LV": {"l": "151/421.562", "v": "151/442.162"},
       "Doppelsteckmuffen K120 mit LV": {"l": "151/421.563", "v": "151/442.163"}, "Reparaturmuffen K100 106/100 mm": {"l": "151/421.313", "v": "151/442.114"}}
KAL = {"55": "151/485.004", "100": "151/485.001", "120": "151/485.002", "150": "151/485.003"}


def rohrTab(c, LV, P=None):
    cx = Ctx(LV); cx.g("g_rohr")
    if not jt(c.get("verl")):
        cx.w("rohrNein", "info", {})

    def two(cat, row, unit):
        m = cat.get(g(row, "typ")); q = num(g(row, "q"), 0)
        if not m or not (q > 0):
            return
        if m["l"]: cx.add(m["l"], q, {"rule": eing(q, unit)})
        else: cx.off("ohneLV", q, unit, {"t": g(row, "typ")}, {"rule": eing(q, unit)})
        if jt(c.get("verl")) and m["v"]: cx.add(m["v"], q, {"rule": eing(q, unit)})
    for x in (c.get("rohre") or []): two(ROH, x, "m")
    for x in (c.get("schn") or []):
        m = ROH.get(g(x, "typ")); q = num(g(x, "q"), 0)
        if m and q > 0: cx.add(m["s"], q, {"rule": eing(q, "St")})
    for x in (c.get("boe") or []): two(BOE, x, "St")
    for x in (c.get("muf") or []): two(MUF, x, "St")
    e = num(c.get("erd"), 0); w = num(c.get("warn"), 0); s = num(c.get("schnur"), 0); k = num(c.get("kal"), 0)
    if e > 0: cx.add("151/484.301", e, {"rule": eing(e, "m")})
    if w > 0:
        cx.add("151/484.111", w, {"rule": eing(w, "m")}); cx.add("151/484.211", w, {"rule": eing(w, "m")})
    if s > 0: cx.add("151/486.001", s, {"rule": eing(s, "m")})
    if k > 0: cx.add(KAL.get(jstr(c.get("kalDN"))) or KAL["55"], k, {"rule": eing(k, "m") + ", DN " + jstr(c.get("kalDN"))})
    return res(cx)


def grube(cx, c, parts, Vb, P):
    Vg = 0; A = 0; per = 0; Gt = 0; txt = []; bmin = 99
    for p in parts:
        Vg += p["l"] * p["b"] * p["t"] * p["n"]; A += p["l"] * p["b"] * p["n"]; per += 2 * (p["l"] + p["b"]) * p["n"]; Gt = max(Gt, p["t"]); bmin = min(bmin, p["b"])
        txt.append(((jstr(p["n"]) + " × ") if p["n"] > 1 else "") + s2(p["l"]) + " × " + s2(p["b"]) + " × " + s2(p["t"]))
    if not (Vg > 0):
        return None
    hk = HAND[c.get("hand")] if HAND.get(c.get("hand")) is not None else 0.10; gr = " + ".join(txt) + " = " + s2(Vg) + " m³"
    bel = _belagOn(c)
    bi = belag(cx, c.get("belag"), A if bel else 0, per if bel else 0, {"cut": "Umfang Grube = " + s2(per) + " m", "area": "Fläche Grube = " + s2(A) + " m²"}, bmin)
    aushubLines(cx, {"m1": "151/231.111", "m2": "151/231.112", "h": "151/231.211"}, Gt, Vg * (1 - hk), Vg * hk,
                gr + " × " + s2((1 - hk) * 100) + " % = " + s2(Vg * (1 - hk)) + " m³", gr + " × " + s2(hk * 100) + " % = " + s2(Vg * hk) + " m³")
    erschwernis(cx, c.get("ersch"), Gt, Vg * (1 - hk), Vg * hk, ERSCH_KEYS["grube_m"], ERSCH_KEYS["grube_h"])
    Ve = max(0, Vg - bi["Valt"]); Vv = max(0, Vg - Vb - bi["Vneu"])
    vrs = verfuellung(cx, Ve, Vv, c, jt(c.get("direkt")), "Grube " + s2(Vg) + ((" − Bauteil " + s2(Vb)) if Vb else "") + " − Belag/Fundation " + s2(bi["Vneu"]) + " = " + s2(Vv) + " m³")
    cx.b("b_Vg", "m³", Vg); cx.b("b_Vbelag", "m³", bi["Valt"]); cx.b("b_Ve", "m³", Ve)
    if Vb: cx.b("b_Vb", "m³", Vb)
    cx.b("b_Vneu", "m³", bi["Vneu"]); cx.b("b_Vv", "m³", Vv); cx.b("b_R", "m³", vrs["R"]); cx.b("b_fremd", "m³", vrs["fremd"]); cx.b("b_Vs", "m³", vrs["Vs"])
    return {"Vg": Vg, "A": A, "Gt": Gt}


WL_KEYS = ["ts", "bo", "sg", "zs"]
PS_AUF = ["1.00 x 1.00 m", "1.50 x 1.00 m", "2.00 x 1.00 m", "2.60 x 1.00 m"]


def werkloch(c, LV, P):
    cx = Ctx(LV); Dw = g(g(P, "D") or {}, "wl") or {}; ar = num(c.get("arbeit"), 0.30); parts = []
    for k in WL_KEYS:
        q = num(c.get(k), 0); d = Dw.get(k) or [1.5, 1, 1]
        if q > 0:
            parts.append({"n": q, "l": num(d[0]) + 2 * ar, "b": num(d[1]) + 2 * ar, "t": num(d[2])})
    iB = num(c.get("iB"), 0); iT = num(c.get("iT"), 0); iL = num(c.get("iL"), 0)
    if iB > 0 and iT > 0 and iL > 0:
        parts.append({"n": 1, "l": iL, "b": iB, "t": iT})
    gg = grube(cx, c, parts, 0, P)
    for i, s in enumerate(PS_AUF):
        q = num(c.get("p" + str(i)), 0)
        if q > 0:
            cx.g("g_bauwerk"); cx.off("psAuf", q, "St", {"t": s}, {"rule": eing(q, "St")})
    return res(cx, gg or {})


VK = ["CAB 1-3 L"]
KVS = ["C 50"]


def fund(c, LV, P):
    cx = Ctx(LV); Df = g(g(P, "D") or {}, "fund") or {}; ar = num(c.get("arbeit"), 0.30); parts = []; Vb = 0
    for typ, lab in [(c.get("vk"), "VK"), (c.get("kvs"), "KVS")]:
        if not jt(typ) or not jt(Df.get(typ)):
            continue
        d = [num(x) for x in Df[typ]]
        parts.append({"n": 1, "l": d[0] + 2 * ar, "b": d[1] + 2 * ar, "t": d[2]}); Vb += d[0] * d[1] * d[2]
        cx.g("g_bauwerk"); cx.off("fundament", 1, "St", {"t": lab + " " + typ}, {"rule": s2(d[0]) + " × " + s2(d[1]) + " × " + s2(d[2]) + " m"})
    gg = grube(cx, c, parts, Vb, P)
    return res(cx, gg or {})


def geb(c, LV, P=None):
    cx = Ctx(LV); n = num(c.get("n"), 0); cm = num(c.get("cm"), 0)
    cx.g("g_bauwerk")
    if n > 0: cx.add("151/672.401", n, {"rule": eing(n, "St")})
    if cm > 0: cx.off("kernbohrung", cm, "cm", {}, {"rule": eing(cm, "cm")})
    if n > 0 and c.get("abd") != "keine":
        cx.off("abdichtung", n, "St", {"t": "Kissen" if c.get("abd") == "kissen" else "Hauff"}, {"rule": eing(n, "St")})
    return res(cx)


def nearest(mp, mm):
    b = mp[0]
    for m in mp:
        if abs(m[0] - mm) < abs(b[0] - mm):
            b = m
    return b[1]


def reinst(cx, typ, bk, d, A, per, P):
    if not jt(typ) or typ == "nein" or not (A > 0):
        return
    if typ[0] == "C" and bk not in ("strasse", "kanton"):
        cx.w("belagCnurStrasse", "amber", {}); return
    par = P["par"]
    deck = num(par.get("deckS"), 0.035) if bk == "strasse" else num(par.get("deckK"), 0.04) if bk == "kanton" else num(par.get("deckG"), 0.03)
    rho = _dens["v"]
    rA = "Fläche = " + s2(A) + " m²"; rP = "Umfang = " + s2(per) + " m"
    cx.g("g_belagNeu")

    def acT(dt):
        if dt <= 0.0005:
            return
        n = max(1, ceil(dt / 0.1 - 1e-9)); m = A * dt * rho
        cx.add(nearest([[50, "223/441.212"], [60, "223/441.311"], [70, "223/441.312"], [80, "223/441.313"], [90, "223/441.314"], [100, "223/441.315"]], dt / n * 1000), m,
               {"rule": s2(A) + " m² × " + jstr(jround(dt * 1000)) + " mm × " + jstr(rho) + " t/m³ = " + s2(m) + " t" + ((" (" + jstr(n) + " Lagen)") if n > 1 else "")})

    def acD(dd):
        m = A * dd * rho
        cx.add(nearest([[20, "223/442.111"], [25, "223/442.112"], [30, "223/442.113"], [35, "223/442.114"], [40, "223/442.212"]], dd * 1000), m,
               {"rule": s2(A) + " m² × " + jstr(jround(dd * 1000)) + " mm × " + jstr(rho) + " t/m³ = " + s2(m) + " t"})

    def fr(dd):
        mm = dd * 1000; m = A * dd * rho
        cx.g("g_belag"); cx.add("117/223.214" if mm > 150 else "117/223.213" if mm > 100 else "117/223.212", A, {"rule": rA})
        cx.g("g_deponieBelag"); cx.add("223/263.228", m, {"rule": s2(m) + " t"}); cx.add("117/731.222", m, {"rule": s2(m) + " t"}); cx.g("g_belagNeu")

    def naht(dd):
        mm = dd * 1000
        cx.add("223/423.111" if mm <= 40 else "223/423.112" if mm <= 80 else "223/423.113", per, {"rule": rP})

    def hv():
        cx.add("223/422.101", A, {"rule": rA})

    def ob():
        V = A * d; r = rA + " × " + s2(d) + " m = " + s2(V) + " m³"
        cx.g("g_aushub"); cx.add("151/231.111", V, {"rule": r})
        cx.g("g_deponie"); cx.add("151/252.213", V, {"rule": r}); cx.add("151/262.113", V, {"rule": r}); cx.g("g_belagNeu")

    def Bf():
        acT(d - deck); acD(deck); hv(); naht(d)
    if typ == "A":
        cx.off("kaltmisch", A, "m²", {}, {"rule": rA}); ob(); Bf()
    elif typ == "A1":
        ob(); Bf()
    elif typ == "B":
        Bf()
    elif typ == "C":
        acT(d); fr(deck); acD(deck); hv(); naht(d)
    elif typ == "C1":
        acT(d); naht(d); cx.w("c1sep", "amber", {})
    elif typ == "C2":
        fr(deck); acD(deck); hv(); naht(deck)


def belagTab(c, LV, P):
    cx = Ctx(LV)
    if jstr(c.get("indiv")) == "true":
        return res(cx)
    B = num(c.get("B"), 0); L = num(c.get("L"), 0); d = num(c.get("d"), 0.08)
    if (0 < B < 0.4) or (0 < L < 0.4):
        cx.w("belagMin", "amber", {})
    if B > 0 and L > 0:
        gp = P["par"]
        rg = [gp.get("gehMin"), gp.get("gehMax")] if c.get("bk") == "gehweg" else [gp.get("strMin"), gp.get("strMax")] if c.get("bk") == "strasse" else [gp.get("kanMin"), gp.get("kanMax")] if c.get("bk") == "kanton" else None
        if rg and (d < num(rg[0]) - 1e-9 or d > num(rg[1]) + 1e-9):
            cx.w("belagRange", "amber", {"d": d, "a": rg[0], "b": rg[1]})
        reinst(cx, c.get("wi"), c.get("bk"), d, B * L, 2 * (B + L), P)
    return res(cx, {"A": B * L})


def allg(c, LV, P=None):
    cx = Ctx(LV); km = num(c.get("km"), 0); ak = num(c.get("ak"), 0)
    cx.g("g_pausch")
    if km > 0: cx.lines.append({"key": "Pauschal", "unit": "gl", "ep": km, "qty": 1, "total": r2(km), "grp": "g_pausch", "text": "Kleinmaterial", "ctx": "", "rule": "Eingabe CHF", "flag": ""})
    if ak > 0: cx.lines.append({"key": "Pauschal", "unit": "gl", "ep": ak, "qty": 1, "total": r2(ak), "grp": "g_pausch", "text": "Akkordarbeiten", "ctx": "", "rule": "Eingabe CHF", "flag": ""})
    return res(cx)


def weitere(cx, x):
    for k in sorted((x or {}).keys()):
        q = num(x[k], 0)
        if q > 0 and k in cx.LV:
            cx.g("g_weitere"); cx.add(k, q, {"rule": eing(q, cx.LV[k]["u"])})


def freie(lst, LV):
    cx = Ctx(LV)
    for f in (lst or []):
        q = num(g(f, "qty"), 0)
        if jt(g(f, "custom")):
            ep = num(g(f, "ep"), 0)
            cx.grp = "g_frei"
            if not (ep > 0):
                cx.off("freiKeinEP", q, g(f, "unit") or "St", {"t": g(f, "text") or "?"}, {"text": g(f, "text") or "", "rule": g(f, "reason") or "", "always": True})
            else:
                cx.lines.append({"key": "—", "unit": g(f, "unit") or "St", "ep": ep, "qty": r2(q), "total": r2(q * ep), "grp": "g_frei",
                                 "text": g(f, "text") or "", "ctx": "", "rule": g(f, "reason") or "", "flag": "ausserLV"})
                cx.w("freiAusserLV" if jt(g(f, "reason")) else "freiOhneGrund", "amber" if jt(g(f, "reason")) else "stop", {"t": g(f, "text") or "?"})
        elif g(f, "key") in LV:
            k = f["key"]; fe = g(f, "ep")
            ov = num(fe) if (fe != "" and fe is not None and isfin(parse_float(fe)) and abs(num(fe) - LV[k]["ep"]) > 1e-9) else None
            cx.grp = "g_be" if k.startswith("113/") else "g_frei"
            l = cx.add(k, q, {"ep": ov, "flag": "epGeaendert" if ov is not None else "", "rule": g(f, "note") or ""})
            if ov is not None: cx.w("epGeaendert", "amber", {"k": k, "lv": LV[k]["ep"], "ep": ov})
            if l and k.startswith("151/471"): cx.w("rohrblock", "info", {})
    return {"lines": cx.lines, "warn": cx.warn, "bal": []}


COMPLETE = [
    {"id": "c_bse", "auto": True},
    {"id": "c_sond", "pre": ["151/121", "151/122"]},
    {"id": "c_belag", "pre": ["117/223"], "rel": "belag", "tk": ["belagDicke"]},
    {"id": "c_aushub", "pre": ["151/221", "151/231"], "tk": ["handTiefe", "masch2"]},
    {"id": "c_erschw", "pre": ["151/222", "151/223", "151/224", "151/232", "151/234", "151/321", "151/131", "151/132"], "tk": ["spries2", "erschTiefe"]},
    {"id": "c_transp", "pre": ["151/251", "151/252", "151/261", "151/262", "151/273", "117/721", "117/731"], "tk": ["pakE"]},
    {"id": "c_zone", "pre": ["151/711", "151/721", "151/731", "151/741"], "rel": "any"},
    {"id": "c_rohr", "pre": ["151/412", "151/415", "151/431"], "rel": "graben", "tk": ["rohr5"]},
    {"id": "c_form", "pre": ["151/421", "151/441", "151/442", "151/484"], "rel": "graben"},
    {"id": "c_kalib", "pre": ["151/485"], "rel": "graben"},
    {"id": "c_schacht", "pre": ["151/611", "151/621", "151/623", "151/632"], "rel": "schacht"},
    {"id": "c_wieder", "pre": ["223/"], "rel": "belag", "tk": ["tragMax", "deckMax", "naehteMax", "fundMin", "deckMasch"]},
    {"id": "c_signal", "pre": ["113/2"]},
    {"id": "c_schutz", "pre": ["151/242", "151/243", "151/244"]},
    {"id": "c_doku", "none": True}]


def completeness(P, lines):
    def hasOk(pre):
        return any(l["key"] != "OFFEN" and any(l["key"].startswith(p) for p in pre) for l in lines)

    def hasOpen(tk):
        return bool(tk) and any(l["flag"] == "offen" and l.get("tk") in tk for l in lines)
    R = P.get("recs") or {}
    el = (R.get("graben") or []) + (R.get("schacht") or []) + (R.get("werkloch") or []) + (R.get("fund") or [])
    anyG = len(R.get("graben") or []) > 0 or len(R.get("rohr") or []) > 0; anyS = len(R.get("schacht") or []) > 0
    belags = [e for e in el if jt(e.get("belag")) and g(e["belag"], "mode") == "bit"]
    out = []
    for it in COMPLETE:
        if it.get("auto"): st = "ok"
        elif it.get("none"): st = "nopos"
        elif hasOk(it["pre"]): st = "ok"
        elif hasOpen(it.get("tk")): st = "nopos"
        elif it.get("rel") == "belag" and not belags: st = "na"
        elif it.get("rel") == "graben" and not anyG: st = "na"
        elif it.get("rel") == "schacht" and not anyS: st = "na"
        elif it["id"] == "c_wieder" and belags and all(g(e["belag"], "einbau") == "dritte" for e in belags): st = "third"
        else: st = "open"
        out.append({"id": it["id"], "st": st})
    return out


def vorarbeiten(P, LV):
    cx = Ctx(LV)
    cx.g("g_vorarbeiten")
    s = P.get("sond") or {}; m3 = num(s.get("m3"), 0)
    if m3 > 0:
        cx.add("151/121.001", m3, {"rule": "Eingabe = " + s2(m3) + " m³"})
        cx.add("151/122.002" if jt(s.get("einfHand")) else "151/122.001", m3, {"rule": "= Sondieraushub " + s2(m3) + " m³"})
    w = P.get("wasser") or {}; h = num(w.get("h"), 0); sump = num(w.get("sumpf"), 0)
    if h > 0: cx.add("151/131.111", h, {"rule": "Eingabe = " + jstr(h) + " h"})
    if sump > 0: cx.add("151/132.101", sump, {"rule": "Eingabe = " + jstr(sump) + " St"})
    return {"lines": cx.lines, "warn": cx.warn, "bal": []}


def baustelle(P, LV, baseSum):
    cx = Ctx(LV); B = P.get("be") or {}
    cx.g("g_be")
    pct = num(B.get("pct"), 0)
    if pct > 0:
        betrag = r2(baseSum * pct / 100); p = LV["113/111.002"]
        cx.lines.append({"key": "113/111.002", "unit": p["u"], "ep": betrag, "qty": 1, "total": betrag, "grp": "g_be", "text": lvT("113/111.002"), "ctx": lvC("113/111.002"),
                         "rule": jstr(pct) + " % × " + s2(baseSum) + " = " + s2(betrag), "flag": ""})
    return {"lines": cx.lines, "warn": cx.warn, "bal": []}


TABS = ["graben", "rohr", "schacht", "werkloch", "fund", "geb", "belag", "allg"]
FN = {"graben": graben, "rohr": rohrTab, "schacht": schacht, "werkloch": werkloch, "fund": fund, "geb": geb, "belag": belagTab, "allg": allg}


def calcRec(tab, e, LV_, P):
    try:
        r = FN[tab](e, LV_, P)
    except Exception as err:  # wie im HTML-Tool: Rechenfehler als Warnung, nicht Abbruch
        r = {"lines": [], "warn": [{"id": "rechenfehler", "sev": "stop", "args": {"m": str(err)}}], "bal": []}
    r.setdefault("bal", [])
    cx = Ctx(LV_); cx.lines = r["lines"]; cx.warn = r["warn"]
    if tab == "graben":
        zusaetze(cx, e)
    weitere(cx, e.get("x"))
    if jt(e.get("free")) and len(e["free"]):
        f = freie(e["free"], LV_); r["lines"] = r["lines"] + f["lines"]; r["warn"] = r["warn"] + f["warn"]
    if tab == "belag":
        for l in r["lines"]:
            l["ks"] = "Belag"
    r["sum"] = r2(sum(l["total"] for l in r["lines"]))
    return r


def calc(P, LV_=None):
    LV_ = LV_ or LV
    d = num(P.get("dichte"), ASPHALT_T)
    _dens["v"] = d if jt(d) else ASPHALT_T
    out = {"elems": [], "sum": {}, "warn": []}
    for tab in TABS:
        for i, e in enumerate((P.get("recs") or {}).get(tab) or []):
            r = calcRec(tab, e, LV_, P)
            r.update({"name": e.get("name"), "type": tab, "tab": tab, "idx": i, "id": tab + "_" + str(i)})
            out["elems"].append(r)
    out["vor"] = vorarbeiten(P, LV_)
    out["vor"]["sum"] = r2(sum(l["total"] for l in out["vor"]["lines"]))
    baseSum = sum(e["sum"] for e in out["elems"]) + out["vor"]["sum"]
    out["be"] = baustelle(P, LV_, r2(baseSum))
    out["be"]["sum"] = r2(sum(l["total"] for l in out["be"]["lines"]))
    out["beBase"] = r2(baseSum)
    allL = []
    for e in out["elems"]:
        allL += e["lines"]
    allL += out["vor"]["lines"] + out["be"]["lines"]
    byKey = {}
    for l in allL:
        k = l["key"] + "|" + jstr(l["ep"]) + "|" + l["flag"] + (("|" + jstr(l.get("text") or l.get("tk")) + "|" + json.dumps(l.get("args") or {}, ensure_ascii=False)) if l["key"] in ("—", "OFFEN", "Pauschal") else "")
        if k not in byKey:
            byKey[k] = {"key": l["key"], "unit": l["unit"], "ep": l["ep"], "qty": 0, "total": 0, "text": l.get("text"), "ctx": l.get("ctx"), "flag": l["flag"],
                        "tk": l.get("tk"), "args": l.get("args"), "open": l.get("open")}
        byKey[k]["qty"] = r2(byKey[k]["qty"] + l["qty"]); byKey[k]["total"] = r2(byKey[k]["total"] + l["total"])
    out["summary"] = sorted(byKey.values(), key=lambda x: x["key"])
    out["nOffen"] = len([l for l in allL if l.get("open")])
    zw = r2(sum(l["total"] for l in allL))
    st = next(s for s in STAFFEL if zw <= s["bis"]); idx = STAFFEL.index(st)
    mwSatz = num(P.get("mwst"), MWST * 100) / 100
    rabatt = r2(zw * st["pct"] / 100); nach = r2(zw - rabatt); inst = st["inst"] if zw > 0 else 0; netto = r2(nach + inst); mw = r2(netto * mwSatz)
    out["sum"] = {"zwischen": zw, "stufe": idx + 1, "pct": st["pct"], "rabatt": rabatt, "nachRabatt": nach, "inst": inst, "netto": netto, "mwst": mw, "mwSatz": mwSatz,
                  "brutto": r2(netto + mw), "belag": r2(sum(l["total"] for l in allL if l.get("ks") == "Belag"))}
    for e in out["elems"]:
        for w in e["warn"]:
            w.update({"el": e["name"], "tab": e["tab"], "idx": e["idx"]}); out["warn"].append(w)
    for w in out["vor"]["warn"] + out["be"]["warn"]:
        w["el"] = "—"; out["warn"].append(w)
    out["complete"] = completeness(P, allL)
    return out


# ---------- Datenmodell (src/model.js) ----------
PHDEF = D["PHDEF"]
HONF = D["HONF"]


def newRec(tab, n, belagLief=False):
    r = json.loads(json.dumps(D["REC"]["lief" if belagLief else "std"][tab]))
    r["name"] = r["name"] + " " + str(n)
    return r


def defaults(datum=""):
    d = json.loads(json.dumps(D["DEFAULTS"]))
    d["kopf"]["datum"] = datum
    return d


def phaseList(cfg):
    out = []
    for k, lab, q, on in PHDEF:
        x = next((p for p in (cfg.get("ph") or []) if g(p, "k") == k), None)
        out.append({"k": k, "q": q, "on": jt(g(x, "on")) if x else on, "lab": lab})
    return out


def honCalc(r, netto):
    B = num(r.get("B"), 0) if r.get("src") == "man" else netto
    ph = phaseList(r); q0 = sum(x["q"] for x in ph if x["on"]); q = r2(q0 * (1.1 if jt(r.get("gl")) else 1))
    h = num(r.get("h"), 0)
    if not (B > 0) or not (q > 0) or not (h > 0):
        return {"B": B, "q": q, "ok": False, "noH": not (h > 0)}
    p = HONF["Z1"] + HONF["Z2"] / (math.cbrt(B) if hasattr(math, "cbrt") else B ** (1.0 / 3.0))
    Tm = r2(B * p / 100 * num(r.get("n"), 1) * q / 100 * num(r.get("r"), 1)); Tp = r2(Tm * HONF["i"]); H = r2(Tp * HONF["s"] * h); NK = r2(H * num(r.get("nk"), 0) / 100)
    return {"B": B, "p": p, "q": q, "Tm": Tm, "Tp": Tp, "H": H, "NK": NK, "net": r2(H + NK), "ok": True}
