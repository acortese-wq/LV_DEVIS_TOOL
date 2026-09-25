var KVE = (function () {
  "use strict";

  var ASPHALT_T = 2.4;                    // t/m³ (Umrechnungstabelle der LV-Excel-Datei)
  var MWST = 0.081;
  var STAFFEL = [                         // R151 / R152 gemäss LV
    { bis: 10000,    pct: 0,  inst: 0    },
    { bis: 30000,    pct: 3,  inst: 700  },
    { bis: 50000,    pct: 5,  inst: 900  },
    { bis: 100000,   pct: 7,  inst: 1200 },
    { bis: Infinity, pct: 9,  inst: 1500 }
  ];
  var HAND = { normal: 0.10, eng: 0.30, sehr_eng: 0.50 };

  var SCHACHT = {                         // Standardmasse (Aussenmass Bauwerk, m) – Vorschlag
    KS80U:  { key: "151/611.171", lo: 1.00, bo: 1.00, ho: 0.60, kind: "KS"  },
    KS80H:  { key: "151/611.172", lo: 1.00, bo: 1.00, ho: 1.10, kind: "KS"  },
    KES100: { key: "151/621.011", lo: 1.40, bo: 1.40, ho: 1.70, kind: "KES" },
    KES150: { key: "151/621.012", lo: 1.90, bo: 1.40, ho: 1.70, kind: "KES" },
    KES175: { key: "151/621.013", lo: 1.90, bo: 1.40, ho: 2.10, kind: "KES" },
    ES300:  { key: "151/621.021", lo: 3.40, bo: 1.90, ho: 2.40, kind: "ES"  },
    PLS1:   { key: "151/623.001", lo: 1.40, bo: 1.40, ho: 1.30, kind: "PLS" },
    PLS2:   { key: "151/623.002", lo: 1.40, bo: 1.90, ho: 1.60, kind: "PLS" },
    PLS3:   { key: "151/623.003", lo: 1.40, bo: 2.40, ho: 1.60, kind: "PLS" }
  };

  var r2 = function (x) { return Math.round((x + 1e-9) * 100) / 100; };
  var num = function (v, d) { v = parseFloat(String(v).replace(",", ".")); return isFinite(v) ? v : (d || 0); };
  var s2 = function (x) { return String(r2(x)); };     // Zahl für den Rechenweg
  var dens = ASPHALT_T;

  function Ctx(LV) { this.LV = LV; this.lines = []; this.warn = []; this.bal = []; this.grp = ""; }
  Ctx.prototype.g = function (id) { this.grp = id; };
  Ctx.prototype.add = function (key, qty, o) {
    o = o || {};
    var p = this.LV[key];
    if (!p) throw new Error("LV-Position fehlt: " + key);
    qty = r2(qty);
    if (!(qty > 0)) return null;
    var ep = (o.ep != null) ? o.ep : p.ep;
    var l = { key: key, unit: p.u, ep: ep, qty: qty, total: r2(qty * ep), grp: this.grp,
              text: o.text || lvT(key), ctx: lvC(key), rule: o.rule || "", flag: o.flag || "" };
    this.lines.push(l); return l;
  };
  /* Position ohne eindeutigen LV-Preis: wird gezeigt, aber nicht summiert */
  Ctx.prototype.off = function (id, qty, unit, args, o) {
    o = o || {}; qty = r2(qty);
    if (!(qty > 0) && !o.always) return null;
    var l = { key: "OFFEN", unit: unit || "", ep: null, qty: qty, total: 0, grp: this.grp, text: o.text || "", ctx: "",
              rule: o.rule || "", flag: "offen", open: true, tk: id, args: args || {} };
    this.lines.push(l);
    this.warn.push({ id: id, sev: o.sev || "amber", args: args || {} });
    return l;
  };
  Ctx.prototype.w = function (id, sev, args) { this.warn.push({ id: id, sev: sev, args: args || {} }); };
  Ctx.prototype.b = function (id, unit, v) { this.bal.push({ id: id, unit: unit, v: v }); };

  /* ---------- Belag (Abbruch + Neuaufbau) ---------- */
  function belag(cx, B, A, Schnitt, rs, b) {
    var info = { Valt: 0, Vneu: 0 };
    if (!B || !(A > 0)) return info;
    if (B.mode === "bit") return belagBit(cx, B, A, Schnitt, rs);
    if (B.mode === "humus") return belagHumus(cx, B, A, b);
    if (B.mode === "pflaster") return belagPflaster(cx, B, A, Schnitt, rs, b);
    return info;
  }

  function belagBit(cx, B, A, Schnitt, rs) {
    var info = { Valt: 0, Vneu: 0 };
    var d = num(B.d, 150), i = -1;
    if (d >= 51 && d <= 100) i = 0; else if (d > 100 && d <= 150) i = 1; else if (d > 150 && d <= 200) i = 2;
    cx.g("g_belag");
    if (i < 0) {
      cx.off("belagDicke", Schnitt, "m", { d: d }, { rule: rs.cut });
      cx.off("belagDicke", A, "m²", { d: d }, { rule: rs.area });
    } else {
      cx.add(["117/223.122", "117/223.123", "117/223.124"][i], Schnitt, { rule: rs.cut });
      cx.add(["117/223.212", "117/223.213", "117/223.214"][i], A, { rule: rs.area });
    }
    info.Valt = A * d / 1000;
    var Mt = info.Valt * dens, mr = s2(A) + " m² × " + d + " mm × " + dens + " t/m³ = " + s2(Mt) + " t";
    cx.g("g_deponieBelag");
    if (B.pak === "gt250") {
      cx.add("117/721.251", Mt, { rule: mr });
      cx.off("pakE", Mt, "t", {}, { sev: "stop", rule: mr });
    } else {
      cx.add("117/721.222", Mt, { rule: mr });
      cx.add("117/731.222", Mt, { rule: mr });
    }
    if (B.einbau === "typN") {
      cx.g("g_belagNeu");
      var typL = B.typ === "L";
      var dT = num(B.dTrag, 90), dD = num(B.dDeck, 40), dF = num(B.fund, 0);
      var mTr = A * dT / 1000 * dens, mDk = A * dD / 1000 * dens;
      var rTr = s2(A) + " m² × " + dT + " mm × " + dens + " t/m³ = " + s2(mTr) + " t";
      var rDk = s2(A) + " m² × " + dD + " mm × " + dens + " t/m³ = " + s2(mDk) + " t";
      var trKey, trMax, dkKey, dkOk = true, dkMass = false;
      if (typL) {
        trMax = 90;
        var trTab = { 40: "223/434.111", 70: "223/434.121", 90: "223/434.131" };
        trKey = trTab[dT];
        var dkTab = B.deck === "AC4L" ? { 20: "223/432.112" } : { 20: "223/432.211", 30: "223/432.213" };
        dkKey = dkTab[dD]; dkOk = !!dkKey; dkMass = true;
      } else {
        trKey = B.trag === "T16" ? "223/444.121" : "223/444.131";
        trMax = B.trag === "T16" ? 70 : 90;
        dkKey = B.deck === "AC11" ? "223/444.221" : "223/444.211";
        if (B.deckArt === "masch") {
          var tab = B.deck === "AC11" ? { 35: "223/442.211", 40: "223/442.212" }
                                      : { 20: "223/442.111", 25: "223/442.112", 30: "223/442.113", 35: "223/442.114" };
          dkKey = tab[dD]; dkOk = !!dkKey; dkMass = true;
        } else if (dD > 40) dkOk = false;
      }
      if (B.haft) cx.add("223/422.101", A, { rule: rs.area });
      if (!trKey || dT > trMax) cx.off("tragMax", mTr, "t", { d: dT, max: trMax }, { rule: rTr }); else cx.add(trKey, mTr, { rule: rTr });
      if (!dkOk) cx.off(dkMass ? "deckMasch" : "deckMax", mDk, "t", { d: dD }, { rule: rDk }); else cx.add(dkKey, mDk, { rule: rDk });
      if (B.naehte) {
        var dg = dT + dD;
        if (dg > 130) cx.off("naehteMax", Schnitt, "m", { d: dg }, { rule: rs.cut });
        else cx.add(dg <= 40 ? "223/423.211" : dg <= 80 ? "223/423.212" : "223/423.213", Schnitt, { rule: rs.cut });
      }
      if (dF > 0) {
        var Vf = A * dF / 1000, rF = s2(A) + " m² × " + dF + " mm = " + s2(Vf) + " m³";
        cx.add("223/271.113", Vf, { rule: rF });
        if (dF < 101) cx.off("fundMin", Vf, "m³", { d: dF }, { rule: rF });
        else cx.add(dF <= 200 ? "223/272.112" : "223/272.113", Vf, { rule: rF });
      }
      /* M: Anschlussflächen und Deckschichtränder – aus vorhandener Geometrie ableitbar, ohne Zusatzeingabe */
      var dg = dT + dD, ak;
      if (dg <= 40) ak = "223/424.111"; else if (dg <= 80) ak = "223/424.112"; else if (dg <= 130) ak = "223/424.113"; else ak = null;
      if (ak) cx.add(ak, Schnitt, { rule: rs.cut }); else cx.off("anschlussMax", Schnitt, "m", { d: dg }, { rule: rs.cut });
      cx.add("223/571.101", Schnitt, { rule: rs.cut });
      info.Vneu = A * (dT + dD + dF) / 1000;
      if (Math.abs(dT + dD + dF - d) > 0.5) cx.w("dickeAbw", "info", { neu: dT + dD + dF, alt: d });
    } else {
      info.Vneu = info.Valt;               // Belagseinbau durch Dritte: Raum bleibt in der Bilanz
    }
    return info;
  }

  /* A: Humus/Wiesland statt Belag */
  function belagHumus(cx, Bwrap, A, b) {
    var B = Bwrap.humus || {};
    var info = { Valt: 0, Vneu: 0 };
    cx.g("g_belag");
    var d = num(B.dOber, 30) / 100, hand = !!B.hand;
    if (B.art === "rasenziegel") {
      cx.add("151/211.001", A, { rule: rs2(A) });
      info.Valt = A * 0.06;   // Rasenziegel-Sole ≈ 6 cm, für Massenbilanz
    } else {
      var Vab = A * d, rAb = rs2(A) + " × " + d.toFixed(2) + " m = " + s2(Vab) + " m³";
      if (hand) {
        if (b > 2.0) cx.off("humusBreite", Vab, "m³", { b: r2(b) }, { rule: rAb });
        else cx.add("151/212.201", Vab, { rule: rAb });
      } else {
        cx.add(b <= 2.0 ? "151/212.101" : "151/212.102", Vab, { rule: rAb });
      }
      info.Valt = Vab;
    }
    cx.g("g_belagNeu");
    if (B.art === "rasenziegel") {
      cx.add("151/775.001", A, { rule: rs2(A) });
      info.Vneu = info.Valt;
    } else {
      cx.add(hand ? "151/771.122" : "151/771.112", A, { rule: rs2(A) });
      if (B.ansaeen) cx.add("151/774.101", A, { rule: rs2(A) });
      info.Vneu = A * Math.min(d, 0.30);
    }
    return info;
  }
  function rs2(A) { return "Eingabe Fläche = " + s2(A) + " m²"; }

  /* K: Pflästerung/Plattenbelag statt Belag */
  var PFLAST_ERSTELLEN = { betonverbund: { 60: "222/551.102", 80: "222/551.103" } };
  var PFLAST_PLATTEN = { natur: { 40: "222/711.111", 50: "222/711.112" }, beton: { 40: "222/751.111", 50: "222/751.112" } };
  var PFLAST_ABBRUCH = { platten: "117/224.211", betonstein: "117/224.231", natur: "117/225.221", plattenDemon: "117/225.211" };
  var RAND_LIEF = { gneis: { "8/11": "222/211.211", "11/13": "222/211.212" }, granit: { "8/11": "222/212.211", "11/13": "222/212.212" } };
  var RAND_VERS = { "8/11": "222/311.111", "11/13": "222/311.112" };
  function belagPflaster(cx, Bwrap, A, Schnitt, rs, b) {
    var B = Bwrap.pflaster || {};
    var info = { Valt: 0, Vneu: 0 };
    cx.g("g_belag");
    if (B.abbruchAlt) {
      var ak = PFLAST_ABBRUCH[B.abbruchArt] || PFLAST_ABBRUCH.betonstein;
      cx.add(ak, A, { rule: rs.area });
      info.Valt = A * 0.15;
    }
    cx.g("g_belagNeu");
    var d = num(B.dicke, 60);
    if (B.material === "betonverbund") {
      var k1 = (PFLAST_ERSTELLEN.betonverbund || {})[d];
      var mr = rs.area;
      if (k1) cx.add(k1, A, { rule: mr }); else cx.off("pflastDicke", A, "m²", { d: d }, { rule: mr });
    } else {
      var grp = PFLAST_PLATTEN[B.material] || PFLAST_PLATTEN.beton;
      var k2 = grp[d];
      if (k2) cx.add(k2, A, { rule: rs.area }); else cx.off("pflastDicke", A, "m²", { d: d }, { rule: rs.area });
    }
    var dF = num(B.fund, 200);
    if (dF > 0) {
      var Vf = A * dF / 1000, rF = s2(A) + " m² × " + dF + " mm = " + s2(Vf) + " m³";
      cx.add("223/271.113", Vf, { rule: rF });
      if (dF < 101) cx.off("fundMin", Vf, "m³", { d: dF }, { rule: rF }); else cx.add(dF <= 200 ? "223/272.112" : "223/272.113", Vf, { rule: rF });
    }
    if (B.randNeu) {
      var randKey = (RAND_LIEF[B.randMat] || RAND_LIEF.gneis)[B.randTyp] || RAND_LIEF.gneis["8/11"];
      var randVers = RAND_VERS[B.randTyp] || RAND_VERS["8/11"];
      var Lr = num(B.randLaenge, 0);
      if (Lr > 0) { cx.add(randKey, Lr, { rule: "Eingabe = " + s2(Lr) + " m" }); cx.add(randVers, Lr, { rule: "Eingabe = " + s2(Lr) + " m" }); }
      if (B.randAbbruch && Lr > 0) cx.add("117/224.111", Lr, { rule: "Eingabe = " + s2(Lr) + " m" });
    }
    info.Vneu = A * (d + dF) / 1000;
    return info;
  }

  /* ---------- Leitungszone (Umhüllung) ---------- */
  function zone(cx, Vu, c, rule) {
    if (!(Vu > 0)) return;
    cx.g("g_zone");
    if (c.umhType === "beton") { cx.add("151/731.101", Vu, { rule: rule }); return; }
    var k = { betonkies: "151/711.123", sand: "151/711.111", kies48: "151/711.112" }[c.umhMat] || "151/711.123";
    cx.add(k, Vu, { rule: rule });
    cx.add("151/721.101", Vu, { rule: rule });
  }

  /* ---------- Verfüllung + Überschuss ---------- */
  function verfuellung(cx, Ve, Vv, c, direkt, vrule) {
    var hand = !!c.einfHand, R = 0, fremd = 0;
    var fk = { kies045: "151/711.116", kies016: "151/711.114", betonkies: "151/711.123" };
    cx.g("g_verf");
    if (c.verf === "aushub") {
      R = Math.min(Ve, Vv);
      cx.add(hand ? "151/741.121" : "151/741.111", R, { rule: "min(Erdaushub " + s2(Ve) + "; Bedarf " + s2(Vv) + ") = " + s2(R) + " m³" });
      fremd = Vv - R;
      if (fremd > 0.005) {
        cx.w("fremdErgaenzt", "amber", { v: r2(fremd) });
        var fr = "Bedarf " + s2(Vv) + " − Aushub " + s2(R) + " = " + s2(fremd) + " m³";
        cx.add(fk.kies045, fremd, { rule: fr });
        cx.add(hand ? "151/741.122" : "151/741.112", fremd, { rule: fr });
      }
    } else {
      fremd = Vv;
      cx.add(fk[c.verf] || fk.kies045, fremd, { rule: vrule });
      cx.add(hand ? "151/741.122" : "151/741.112", fremd, { rule: vrule });
    }
    var Vs = Math.max(0, Ve - R), sr = "Erdaushub " + s2(Ve) + " − wiederverwendet " + s2(R) + " = " + s2(Vs) + " m³";
    cx.g("g_deponie");
    if (Vs > 0) {
      if (!direkt) cx.add("151/273.203", Vs, { rule: sr });
      cx.add("151/252.213", Vs, { rule: sr });
      cx.add("151/262.113", Vs, { rule: sr });
    }
    return { R: R, fremd: fremd, Vs: Vs };
  }

  /* ---------- Rohranlage ---------- */
  var ROHR = {
    55:  { lief5: "151/412.111", lief10: "151/412.211", ver: "151/431.001", muf: "151/421.511", mufV: "151/442.111",
           b90: "151/421.221", b90V: "151/441.121", b45: "151/421.121", b45V: "151/441.111", cut: "151/482.101", kal: "151/485.004" },
    100: { lief10: "151/412.214", ver: "151/431.002", muf: "151/421.514", mufV: "151/442.114",
           b90: "151/421.224", b90V: "151/441.124", b45: "151/421.124", b45V: "151/441.114", cut: "151/482.101", kal: "151/485.001" },
    120: { lief10: "151/412.215", ver: "151/431.003", muf: "151/421.515", mufV: "151/442.115",
           b90: "151/421.225", b90V: "151/441.125", b45: "151/421.125", b45V: "151/441.115", cut: "151/482.102", kal: "151/485.002" },
    150: { lief10: "151/412.216", ver: "151/431.003", muf: "151/421.516", mufV: "151/442.116",
           b90: "151/421.226", b90V: "151/441.126", b45: "151/421.126", b45V: "151/441.116", cut: "151/482.102", kal: "151/485.003" }
  };
  function rohr(cx, c, L) {
    var R = ROHR[String(c.dn)] || ROHR[55], n = Math.max(1, num(c.n, 1)), len = num(c.len, 10);
    var m = L * n, mr = s2(L) + " m × " + n + " Rohr(e) = " + s2(m) + " m";
    cx.g("g_rohr");
    if (len === 5 && !R.lief5) cx.off("rohr5", m, "m", { dn: c.dn }, { rule: mr });
    else cx.add(len === 5 ? R.lief5 : R.lief10, m, { rule: mr });
    cx.add(R.ver, m, { rule: mr });
    var auto = c.muffenMode !== "manuell";
    var mu = auto ? n * Math.ceil(L / 5 - 1e-9) : num(c.muffenN, 0);   // Regel B: 1 Muffe je 5 m Rohr
    if (auto) cx.w("muffenVorl", "info", { n: mu });
    var mur = auto ? "⌈" + s2(L) + " / 5⌉ × " + n + " = " + mu + " St" : "manuell = " + mu + " St";
    if (mu > 0) { cx.add(R.muf, mu, { rule: mur }); cx.add(R.mufV, mu, { rule: mur }); }
    var b90 = num(c.b90, 0), b45 = num(c.b45, 0);
    if (b90 > 0) { cx.add(R.b90, b90, { rule: "Anzahl = " + b90 + " St" }); cx.add(R.b90V, b90, { rule: "Anzahl = " + b90 + " St" }); }
    if (b45 > 0) { cx.add(R.b45, b45, { rule: "Anzahl = " + b45 + " St" }); cx.add(R.b45V, b45, { rule: "Anzahl = " + b45 + " St" }); }
    var sc = num(c.schneiden, 0);
    if (sc > 0) cx.add(R.cut, sc, { rule: "Anzahl = " + sc + " St" });
    if (c.warnband) { cx.add("151/484.111", L, { rule: "Grabenlänge = " + s2(L) + " m" }); cx.add("151/484.211", L, { rule: "Grabenlänge = " + s2(L) + " m" }); }
    if (c.kalib) cx.add(R.kal, m, { rule: mr });
    if (c.einzug === "schnur") cx.add("151/486.001", m, { rule: mr });
    if (c.einzug === "draht") cx.add("151/487.001", m, { rule: mr });
  }

  /* G: alternatives Rohrsystem mit Längsverschluss (Retrofit um bestehende Kabel) */
  var LAENGS = { 100: { lief: "151/415.102", ver: "151/433.002" }, 120: { lief: "151/415.103", ver: "151/433.003" }, 150: { lief: "151/415.104", ver: "151/433.003" } };
  var ABZW = { tstueck8: { lief: "151/423.301", ver: "151/451.301" }, tstueck4: { lief: "151/423.302", ver: "151/451.302" },
    abzwK55: { lief: "151/423.303", ver: "151/451.303" }, abzwK100: { lief: "151/423.304", ver: "151/451.304" },
    abzwKk4: { lief: "151/423.305", ver: "151/451.305" }, abzwKk8: { lief: "151/423.306", ver: "151/451.306" },
    verbind4: { lief: "151/423.307", ver: "151/451.307" } };
  function laengsRohr(cx, c, L) {
    var R = LAENGS[String(c.dn2)] || LAENGS[100], n = Math.max(1, num(c.n2, 1)), m = L * n, mr = s2(L) + " m × " + n + " Rohr(e) = " + s2(m) + " m";
    cx.g("g_rohr");
    cx.add(R.lief, m, { rule: mr }); cx.add(R.ver, m, { rule: mr });
    var kal = ROHR[String(c.dn2)] || ROHR[100];
    if (c.warnband) { cx.add("151/484.111", L, { rule: "Grabenlänge = " + s2(L) + " m" }); cx.add("151/484.211", L, { rule: "Grabenlänge = " + s2(L) + " m" }); }
    if (c.kalib) cx.add(kal.kal, m, { rule: mr });
    if (c.einzug === "schnur") cx.add("151/486.001", m, { rule: mr });
    if (c.einzug === "draht") cx.add("151/487.001", m, { rule: mr });
    (c.abzweiger || []).forEach(function (a) {
      var k = ABZW[a.art], q = num(a.n, 0);
      if (k && q > 0) { cx.add(k.lief, q, { rule: "Anzahl = " + q + " St" }); cx.add(k.ver, q, { rule: "Anzahl = " + q + " St" }); }
    });
  }

  /* H: Rohrblock – Liste homogener Teilblöcke je DN/Lagenzahl (LV kennt nur DN 55 und 100) */
  var BLOCK_KEY = {
    "55_1": "151/471.115", "55_2": "151/471.124", "55_m": "151/471.134",
    "100_1": "151/471.111", "100_2": "151/471.121", "100_m": "151/471.131"
  };
  function rohrblock(cx, c, L) {
    cx.g("g_rohr");
    (c.bloecke || []).forEach(function (bl) {
      var dn = num(bl.dn, 55), n = Math.max(1, num(bl.n, 1)), lagen = bl.lagen || "1";
      var maxN = dn === 55 ? 3 : 4;
      var bk = BLOCK_KEY[String(dn) + "_" + (lagen === "1" ? "1" : lagen === "2" ? "2" : "m")];
      var rd = s2(L) + " m Graben, DN " + dn + ", " + n + " Rohr(e), " + { "1": "einlagig", "2": "zweilagig", "m": "mehrlagig" }[lagen];
      if ((dn !== 55 && dn !== 100) || n > maxN || !bk) cx.off("blockAusserLV", L, "m", { dn: dn, n: n }, { rule: rd });
      else cx.add(bk, L, { rule: rd });
      var lk = ROHR[String(dn)] || ROHR[55];
      var lief = num(bl.len, 10) === 5 && lk.lief5 ? lk.lief5 : lk.lief10;
      var m = L * n, mr = s2(L) + " m × " + n + " Rohr(e) = " + s2(m) + " m";
      cx.add(lief, m, { rule: mr + "  ·  Lieferung, Verlegen im Rohrblock enthalten" });
      var mu = n * Math.ceil(L / (num(bl.len, 10) || 10) - 1e-9);
      if (mu > 0) { cx.add(lk.muf, mu, { rule: "⌈" + s2(L) + " / " + num(bl.len, 10) + "⌉ × " + n + " = " + mu + " St" }); cx.add(lk.mufV, mu, {}); }
    });
    if (c.warnband) { cx.add("151/484.111", L, { rule: "Grabenlänge = " + s2(L) + " m" }); cx.add("151/484.211", L, { rule: "Grabenlänge = " + s2(L) + " m" }); }
    if (c.kalib) (c.bloecke || []).forEach(function (bl) { var lk = ROHR[String(num(bl.dn, 55))] || ROHR[55]; var m = L * Math.max(1, num(bl.n, 1)); cx.add(lk.kal, m, { rule: s2(m) + " m" }); });
    cx.w("blockAnn", "info", {});
  }

  function breite(cx, c) {
    var T = num(c.T, 0.6), mode = c.bmode || "min60", a = num(c.aussen, 0), b;
    if (mode === "begangen") b = a + 0.40;
    else if (mode === "nicht_begangen") b = a + 0.10;
    else if (mode === "manuell") b = num(c.bman, 0.6);
    else b = 0.60;
    if ((mode === "begangen" || mode === "nicht_begangen") && !(a > 0)) { cx.w("aussenFehlt", "amber", {}); b = 0.60; }
    if (T > 1.0 && b < 0.60 - 1e-9) cx.w("breite60", "stop", { b: r2(b), T: T });
    if (mode !== "min60" && T > 1.0 && (mode === "begangen" || mode === "nicht_begangen")) cx.w("modusTiefe", "amber", { T: T });
    return b;
  }

  /* Aushub (Maschine/Hand) mit Tiefenklassen; ausserhalb der LV-Klassen: OFFEN */
  function aushubLines(cx, keys, T, Vm, Vh, rm, rh) {
    cx.g("g_aushub");
    if (T > 2.0) cx.off("masch2", Vm, "m³", { T: T }, { rule: rm }); else cx.add(T <= 1.5 ? keys.m1 : keys.m2, Vm, { rule: rm });
    if (T > 1.5) cx.off("handTiefe", Vh, "m³", { T: T }, { rule: rh }); else cx.add(keys.h, Vh, { rule: rh });
  }

  /* Saugbagger: ersetzt Maschinen-/Handaushub vollständig (151/227) */
  function saugbagger(cx, c, Vm, Vh) {
    cx.g("g_aushub");
    var stunden = num(c.saugH, 0);
    cx.add("151/227.101", 1, { rule: "1 Etappe" });
    if (stunden > 0) cx.add("151/227.201", stunden, { rule: "Eingabe = " + stunden + " h" });
    cx.w("saugbaggerAnn", "info", {});
  }

  /* Erschwerter Aushub (B): Zuschlag auf Vm/Vh, nur bis 1.50 m Tiefe im LV definiert */
  var ERSCH_KEYS = {
    graben_m: "151/222", graben_gm: "151/223", graben_h: "151/224",
    grube_m: "151/232", grube_h: "151/234"
  };
  function erschwernis(cx, e, T, Vm, Vh, kindM, kindH) {
    if (!e) return;
    cx.g("g_ersch");
    var over = T > 1.5;
    var apply = function (base, sub, qty, rd, unit) {
      if (!(qty > 0)) return;
      var key = base + "." + sub;
      if (over) cx.off("erschTiefe", qty, unit || "m³", { T: T }, { rule: rd });
      else cx.add(key, qty, { rule: rd });
    };
    var klSub = { "5": "111", "6": "121", "7": "131" }[e.klasse];
    if (klSub) { apply(kindM, klSub, Vm, "Maschinenanteil " + s2(Vm) + " m³"); if (kindH) apply(kindH, klSub, Vh, "Handanteil " + s2(Vh) + " m³"); }
    if (e.verf === "gefroren") { apply(kindM, "201", Vm, "Maschinenanteil " + s2(Vm) + " m³"); if (kindH) apply(kindH, "201", Vh, "Handanteil " + s2(Vh) + " m³"); }
    if (e.verf === "stein") { apply(kindM, "202", Vm, "Maschinenanteil " + s2(Vm) + " m³"); if (kindH) apply(kindH, "202", Vh, "Handanteil " + s2(Vh) + " m³"); }
    if (e.hind && e.hind !== "keine") {
      var hs = { findling: "301", fundUnbew: "302", fundBew: "303" }[e.hind];
      var hv = num(e.hindVol, 0.3);
      apply(kindM, hs, hv, "Eingabe = " + s2(hv) + " m³");
    }
    if ((klSub || e.verf !== "keine" || (e.hind && e.hind !== "keine")) && !over) cx.w("erschAnn", "info", {});
  }

  /* Fremdleitungen (D): Kreuzung sichern/schützen + Zores-Rückbau */
  function fremdleitungen(cx, c, L) {
    if (c.kreuz && c.kreuz.on) {
      var n = Math.max(0, num(c.kreuz.n, 0)), len = num(c.kreuz.len, 1);
      if (n > 0 && len > 0) {
        var m = n * len, r = n + " × " + s2(len) + " m = " + s2(m) + " m";
        cx.g("g_fremd");
        cx.add(c.kreuz.richtung === "quer" ? "151/241.002" : "151/241.001", m, { rule: r });
        cx.add(c.kreuz.richtung === "quer" ? "151/242.002" : "151/242.001", m, { rule: r });
      }
    }
    if (c.zores && c.zores.on) {
      var zl = num(c.zores.len, 0);
      if (zl > 0) {
        cx.g("g_fremd");
        var zk = c.zores.zustand === "betrieb" ? "151/244.002" : c.zores.zustand === "nicht" ? "151/244.003" : "151/244.001";
        cx.add(zk, zl, { rule: "Eingabe = " + s2(zl) + " m" });
      }
    }
  }

  /* Böschungsschutz (P): Fläche als Eingabe, da Böschungsgeometrie nicht herleitbar */
  function boeschung(cx, c) {
    if (!c.boeschung || !c.boeschung.on) return;
    var A = num(c.boeschung.flaeche, 0);
    if (A > 0) { cx.g("g_boesch"); cx.add(c.boeschung.geneigt ? "151/311.121" : "151/311.111", A, { rule: "Eingabe = " + s2(A) + " m²" }); }
  }

  /* ---------- Element: Leitungsgraben ---------- */
  function graben(c, LV) {
    var cx = new Ctx(LV);
    var L = num(c.L, 0), T = num(c.T, 0.6), b = breite(cx, c);
    var hk = HAND[c.hand] != null ? HAND[c.hand] : 0.10;
    var V = L * b * T, Vh = V * hk, Vm = V - Vh;
    var isBelagFlaeche = !!(c.belag && c.belag.mode && c.belag.mode !== "none");
    var Lb = isBelagFlaeche ? Math.min(num(c.Lb, L), L) : 0;
    var A = Lb * b, Schnitt = Lb > 0 ? 2 * (Lb + b) : 0;
    if (!(L > 0) || !(b > 0) || !(T > 0)) return { lines: [], warn: cx.warn, bal: [] };

    var bi = belag(cx, c.belag, A, Schnitt, { cut: "2 × (" + s2(Lb) + " + " + s2(b) + ") = " + s2(Schnitt) + " m", area: s2(Lb) + " × " + s2(b) + " = " + s2(A) + " m²" }, b);
    var g = !!c.gesp, vr = s2(L) + " × " + s2(b) + " × " + s2(T) + " = " + s2(V) + " m³";
    if (c.aushubArt === "saug") saugbagger(cx, c, Vm, Vh);
    else aushubLines(cx, { m1: g ? "151/221.121" : "151/221.111", m2: g ? "151/221.122" : "151/221.112", h: g ? "151/221.221" : "151/221.211" }, T, Vm, Vh,
      vr + " × " + s2((1 - hk) * 100) + " % = " + s2(Vm) + " m³", vr + " × " + s2(hk * 100) + " % = " + s2(Vh) + " m³");
    erschwernis(cx, c.ersch, T, Vm, Vh, g ? ERSCH_KEYS.graben_gm : ERSCH_KEYS.graben_m, ERSCH_KEYS.graben_h);
    if (g) {
      var Fs = 2 * L * T, fr = "2 Wände × " + s2(L) + " m × " + s2(T) + " m = " + s2(Fs) + " m²";
      cx.g("g_spries");
      if (T > 2.0) cx.off("spries2", Fs, "m²", { T: T }, { rule: fr }); else cx.add(T <= 1.5 ? "151/321.101" : "151/321.102", Fs, { rule: fr });
      cx.w("spriesAnn", "info", {});
    }

    var Ve = Math.max(0, V - bi.Valt);
    var au = num(c.umhArea, 0.035), blockA = 0;
    if (c.rohrSystem === "block" && c.block) blockA = num(c.block.breite, 0) * num(c.block.hoehe, 0);
    var Vu = c.rohrSystem === "block" ? L * blockA : L * au;
    var Vv = Math.max(0, V - Vu - bi.Vneu);
    var vvr = "V " + s2(V) + " − " + (c.rohrSystem === "block" ? "Rohrblock (Eingabe Aussenmass)" : "Leitungszone") + " " + s2(Vu) + " − Belag/Fundation " + s2(bi.Vneu) + " = " + s2(Vv) + " m³";
    if (c.rohrSystem === "block") { if (blockA <= 0) cx.w("blockMassFehlt", "amber", {}); }
    else zone(cx, Vu, c, s2(L) + " m × " + au + " m²/m = " + s2(Vu) + " m³");
    var vrs = verfuellung(cx, Ve, Vv, c, !!c.direkt, vvr);
    if (Vv <= 0 && V > 0) cx.w("verfNull", "amber", {});
    if (c.rohrSystem === "block") rohrblock(cx, c, L);
    else if (c.rohrSystem === "laengs") laengsRohr(cx, c, L);
    else rohr(cx, c, L);
    fremdleitungen(cx, c, L);
    boeschung(cx, c);

    cx.b("b_V", "m³", V); cx.b("b_Vbelag", "m³", bi.Valt); cx.b("b_Ve", "m³", Ve);
    cx.b("b_Vu", "m³", Vu); cx.b("b_Vneu", "m³", bi.Vneu); cx.b("b_Vv", "m³", Vv);
    cx.b("b_R", "m³", vrs.R); cx.b("b_fremd", "m³", vrs.fremd); cx.b("b_Vs", "m³", vrs.Vs);
    return { lines: cx.lines, warn: cx.warn, bal: cx.bal, geo: { b: b, V: V, A: A, Schnitt: Schnitt } };
  }

  /* ---------- Schachtauswahl (aus "Auswahl Schachtbau und Abdeckungen" übernommen) ----------
     Auswahlschema SCS-INI-NET-VNI-WIC vom 27.03.2026. Abdeckung = liefern (151/632.1xx)
     UND versetzen (151/632.2xx) gemäss LV; Artikelnummern und Gewichte aus der Schachtauswahl. */
  var LOC_INFO = {};
  LOCS.forEach(function (l) { LOC_INFO[l.id] = { group: l.group, shafts: l.shafts, round: l.round, cover: l.cover }; });
  var TYP_SIZE = { KS80U: "KS80U", KS80H: "KS80", KES100: "KES100", KES150: "KES150", KES175: "KES175", ES300: "ES300", PLS1: "PLS1", PLS2: "PLS2", PLS3: "PLS3" };
  function sizeOf(typ) { var id = TYP_SIZE[typ]; return SIZES.filter(function (s) { return s.id === id; })[0] || null; }
  function shaftOf(S) { return S.kind === "KS" ? "KS" : S.kind === "PLS" ? "PLS" : S.kind === "ES" ? "ES" : "KES"; }
  function shapeOf(c, S) { return S.kind === "KS" ? "rund" : (c.shape === "rund" ? "rund" : "eckig"); }
  function sysDefault(loc) { return !loc ? "nivo" : loc.round === "dsbeton" ? "beton" : loc.round; }
  /* identisch zu coverList() der Schachtauswahl */
  function coverRows(loc, shape, format, socle, sys) {
    var out = [];
    if (shape === "rund") {
      if (sys === "gross130") { out.push(["137.352.1", 1]); out.push(["137.363.8", 1]); return out; }
      if (sys === "beton" || loc.round === "dsbeton") { out.push(["DS600BETON", 1]); return out; }
      if (sys === "ds") { out.push(["137.351.3", 1]); out.push(["137.354.7", 1]); }
      else { out.push(["137.353.9", 1]); out.push(["137.363.8", 1]); }
      return out;
    }
    if (loc.cover === "lock") { out.push([format === "180" ? (socle === "mit" ? "137.794.4" : "137.792.8") : (socle === "mit" ? "137.793.6" : "137.791.0"), 1]); return out; }
    if (loc.cover === "inlay") {
      if (format === "180") { out.push([socle === "mit" ? "137.427.1" : "137.426.3", 1]); out.push(["137.790.2", 2]); }
      else { out.push([socle === "mit" ? "137.789.4" : "137.788.6", 1]); out.push(["137.790.2", 1]); }
      return out;
    }
    out.push(["BETONPLATTE", 1]);
    return out;
  }
  /* identisch zu evaluate() der Schachtauswahl; Gründe werden als Hinweise geführt */
  function bewertung(cx, c, S, ersatz) {
    var loc = LOCS.filter(function (l) { return l.id === c.einbauort; })[0], size = sizeOf(c.typ), level = "ok", ids = [];
    if (!loc) return { level: "amber", ids: [] };
    var shaft = shaftOf(S), shape = shapeOf(c, S), sys = c.sys || sysDefault(loc), format = c.deckelFormat2;
    var up = function (l, id) { var o = { ok: 0, info: 0, amber: 1, stop: 2 }; if (o[l] > o[level]) level = l; ids.push(id); cx.w(id, l, {}); };
    if (!ersatz) {
      if (loc.shafts === "none") up("stop", "sa_rNoShaft");
      if (loc.shafts === "avoid" && (shaft === "ES" || shaft === "KES")) up("amber", "sa_rAvoid");
      var st = size ? size.std[loc.group] : "stop";
      if (st === "stop") up("stop", "sa_rSizeStop"); else if (st === "amber") up("amber", "sa_rSizeAmber");
      if (shaft === "KS" && loc.group === "fast") up("stop", "sa_rKsFast");
      if (size && size.id === "KES100") up("info", "sa_rSmall");
    } else {
      if (shape === "eckig" && loc.cover !== "platte" && format === "180") up("amber", "sa_rErs180");
      if (shaft === "PLS") up("amber", "sa_rErsPLS");
    }
    if (shape === "rund" && sys === "gross130") up("info", "sa_rSys130");
    else if (shape === "rund" && loc.round !== "dsbeton") {
      if (sys === "ds" && loc.round === "nivo") up("amber", "sa_rSysDs");
      if (sys === "nivo" && loc.round === "ds") up("amber", "sa_rSysNivo");
    }
    if (level !== "ok" && c.deviate && (!String(c.reason || "").trim() || !String(c.approver || "").trim())) cx.w("sa_rMissingReason", "stop", {});
    return { level: level, ids: ids };
  }
  function abdeckung(cx, c, S, n) {
    var loc = LOCS.filter(function (l) { return l.id === c.einbauort; })[0], shape = shapeOf(c, S), rows = [];
    if (S.kind === "PLS" && c.modus !== "ersatz") { cx.w("schachtDeckelIncl", "info", {}); return rows; }
    cx.g("g_abdeckung");
    if (!loc || (loc.cover === "platte" && shape === "eckig")) {
      if (c.rahmen) { cx.add(c.rahmen, n, { rule: "Eingabe = " + n + " St" }); var rv = c.rahmen.replace("632.1", "632.2"); if (rv !== c.rahmen && cx.LV[rv]) cx.add(rv, n, { rule: "Eingabe = " + n + " St" }); }
      if (c.deckel) { cx.add(c.deckel, n, { rule: "Eingabe = " + n + " St" }); var dv = c.deckel.replace("632.1", "632.2"); if (dv !== c.deckel && cx.LV[dv]) cx.add(dv, n, { rule: "Eingabe = " + n + " St" }); }
      if (!c.rahmen && !c.deckel) cx.w("keineAbdeckung", "amber", {});
      if (!loc) cx.w("schachtOrtFehlt", "amber", {});
      return rows;
    }
    var sys = c.sys || sysDefault(loc);
    rows = coverRows(loc, shape, c.deckelFormat2 === "180" ? "180" : "90", c.deckelSockel === "mit" ? "mit" : "ohne", sys);
    rows.forEach(function (rw) {
      var art = rw[0], q = rw[1] * n, p = SP[art], r = rw[1] + " × " + n + " = " + q + " St  ·  Art. " + art;
      if (p && p.posL) { cx.add("151/" + p.posL, q, { rule: r }); cx.add("151/" + p.posV, q, { rule: r }); }
      else cx.off(art === "DS600BETON" ? "deckelBeton" : "abdOhneLV", q, "St", { t: art }, { rule: r });
    });
    if (shape === "rund" && (sys === "nivo" || sys === "gross130")) cx.add("223/926.111", n, { rule: "Nivroll auf Deckschicht hochziehen = " + n + " St" });
    var sp = num(c.spare, 0);
    if (sp > 0) { rows.push(["137.787.8", 0]); cx.off("deckelErsatz", sp, "St", {}, { rule: "Eingabe = " + sp + " St  ·  Art. 137.787.8" }); }
    return rows;
  }
  function schachtOpts(cx, c) {
    OPTS.forEach(function (o) {
      if (["abbrGuss", "abbrBeton", "abbrFlaeche", "nivrollHoch", "ansch80", "ansch150"].indexOf(o.id) >= 0) return;
      var q = num((c.opts || {})[o.id], 0);
      if (q > 0) { cx.g(o.npk === "117" ? "g_abbruch" : "g_zus"); cx.add(o.npk + "/" + o.pos, q, { rule: "Eingabe = " + q + " " + o.unit }); }
    });
  }

  /* ---------- Element: Schacht ---------- */
  var DECKEL_KEY = { hoeher: { rund: "151/633.001", rechteckig: "151/633.002" }, tiefer: { rund: "151/634.001", rechteckig: "151/634.002" } };
  var ALT_KEY = { guss: "117/228.301", beton: "117/228.302", flaeche: "117/228.303" };
  function schacht(c, LV) {
    var cx = new Ctx(LV);
    if (c.modus === "deckel") {
      var n0 = Math.max(0, num(c.deckelN, 1));
      if (!(n0 > 0)) return { lines: [], warn: cx.warn, bal: [] };
      cx.g("g_bauwerk");
      var dk = DECKEL_KEY[c.deckelRichtung === "tiefer" ? "tiefer" : "hoeher"][c.deckelFormat === "rechteckig" ? "rechteckig" : "rund"];
      cx.add(dk, n0, { rule: "Anzahl = " + n0 + " St" });
      schachtOpts(cx, c);
      return { lines: cx.lines, warn: cx.warn, bal: cx.bal, geo: {} };
    }
    var S = SCHACHT[c.typ], n = Math.max(0, num(c.n, 1));
    if (!S || !(n > 0)) return { lines: [], warn: cx.warn, bal: [] };
    if (c.modus === "ersatz") {
      var ev0 = bewertung(cx, c, S, true);
      cx.g("g_abbruch");
      cx.add(ALT_KEY[c.alt] || ALT_KEY.guss, n, { rule: "Anzahl = " + n + " St" });
      var rows0 = abdeckung(cx, c, S, n);
      schachtOpts(cx, c);
      return { lines: cx.lines, warn: cx.warn, bal: cx.bal, geo: { ev: ev0, rows: rows0, n: n, mass: [], ersatz: true, shaft: shaftOf(S) } };
    }
    var ev = bewertung(cx, c, S, false);
    var a = num(c.arbeit, 0.5), hk = HAND[c.hand] != null ? HAND[c.hand] : 0.10;
    var Gl = S.lo + 2 * a, Gb = S.bo + 2 * a, Gt = S.ho + 0.10;
    var Vg = Gl * Gb * Gt * n, Vb = S.lo * S.bo * S.ho * n;
    var A = c.belag && c.belag.mode && c.belag.mode !== "none" ? Gl * Gb * n : 0, Schnitt = A > 0 ? 2 * (Gl + Gb) * n : 0;
    var gr = s2(Gl) + " × " + s2(Gb) + " × " + s2(Gt) + (n > 1 ? " × " + n : "") + " = " + s2(Vg) + " m³";

    cx.g("g_bauwerk");
    cx.add(S.key, n, { rule: "Anzahl = " + n + " St" });
    var an = num(c.anschl, 0);
    if (an > 0) {
      var kk = S.kind === "KS" ? (c.anDN === "150" ? "151/672.202" : "151/672.201") : (c.anDN === "150" ? "151/672.302" : "151/672.301");
      cx.add(kk, an * n, { rule: an + " × " + n + " = " + (an * n) + " St" });
    }
    var bi = belag(cx, c.belag, A, Schnitt, { cut: "2 × (" + s2(Gl) + " + " + s2(Gb) + ")" + (n > 1 ? " × " + n : "") + " = " + s2(Schnitt) + " m", area: s2(Gl) + " × " + s2(Gb) + (n > 1 ? " × " + n : "") + " = " + s2(A) + " m²" }, Gl);
    var pl = num(c.platten, 0);
    if (pl > 0) { cx.g("g_abbruch"); cx.add("117/228.201", pl, { rule: "Anzahl = " + pl + " St" }); }
    aushubLines(cx, { m1: "151/231.111", m2: "151/231.112", h: "151/231.211" }, Gt, Vg * (1 - hk), Vg * hk,
      gr + " × " + s2((1 - hk) * 100) + " % = " + s2(Vg * (1 - hk)) + " m³", gr + " × " + s2(hk * 100) + " % = " + s2(Vg * hk) + " m³");
    erschwernis(cx, c.ersch, Gt, Vg * (1 - hk), Vg * hk, ERSCH_KEYS.grube_m, ERSCH_KEYS.grube_h);
    var bt = num(c.beton, 0) * n;
    if (bt > 0) {
      cx.g("g_deponie");
      cx.add("151/252.221", bt, { rule: num(c.beton, 0) + " × " + n + " = " + s2(bt) + " m³" });
      cx.add("151/262.121", bt, { rule: num(c.beton, 0) + " × " + n + " = " + s2(bt) + " m³" });
    }
    var Ve = Math.max(0, Vg - bi.Valt), Vv = Math.max(0, Vg - Vb - bi.Vneu);
    var vvr = "Grube " + s2(Vg) + " − Bauwerk " + s2(Vb) + " − Belag/Fundation " + s2(bi.Vneu) + " = " + s2(Vv) + " m³";
    var vrs = verfuellung(cx, Ve, Vv, c, c.direkt !== false, vvr);
    var rows = abdeckung(cx, c, S, n);
    schachtOpts(cx, c);
    cx.b("b_Vg", "m³", Vg); cx.b("b_Vbelag", "m³", bi.Valt); cx.b("b_Ve", "m³", Ve);
    cx.b("b_Vb", "m³", Vb); cx.b("b_Vneu", "m³", bi.Vneu); cx.b("b_Vv", "m³", Vv);
    cx.b("b_R", "m³", vrs.R); cx.b("b_fremd", "m³", vrs.fremd); cx.b("b_Vs", "m³", vrs.Vs);
    var sz = sizeOf(c.typ);
    return { lines: cx.lines, warn: cx.warn, bal: cx.bal,
      geo: { Gl: Gl, Gb: Gb, Gt: Gt, ev: ev, rows: rows, n: n, shaft: shaftOf(S), incl: !!(sz && sz.coverIncl),
             mass: sz ? sz.mass.map(function (m) { return [m[0], m[1], m[2] * n, m[2]]; }) : [] } };
  }

  /* =====================================================================
     Weitere Reiter (aus LV-Erfassung, auf den KV-Rechenkern umgestellt):
     Rohr, Werkloch, Fundamente, Gebäudeeinführung, Belag (Typ A–C2), Allgemein
     ===================================================================== */
  function res(cx, geo) { return { lines: cx.lines, warn: cx.warn, bal: cx.bal, geo: geo || {} }; }
  function eing(q, u) { return "Eingabe = " + s2(q) + (u ? " " + u : ""); }

  /* Graben: Zusätze aus der Access-Maske (Grabenübergänge, Abschlüsse) */
  var ABSCHL = { aB: ["117/224.111", "222/211.211", "222/311.111"], aW: ["117/224.112", "222/211.212", "222/311.311"],
                 aS: ["117/224.121", "222/211.412", "222/321.122"], aR: ["117/224.141", "222/211.413", "222/321.123"] };
  var UEBERG = { uF: "113/214.111", uP: "113/214.211", uL: "113/214.311" };
  function zusaetze(cx, c) {
    for (var u in UEBERG) { var q = num(c[u], 0); if (q > 0) { cx.g("g_zus"); cx.add(UEBERG[u], q, { rule: eing(q, "St") }); } }
    for (var k in ABSCHL) { var m = num(c[k], 0); if (m > 0) { cx.g("g_zus"); ABSCHL[k].forEach(function (p) { cx.add(p, m, { rule: eing(m, "m") }); }); } }
  }

  /* Rohr: Auswahlliste → LV-Position × Menge */
  var ROH = {
    "K55": { l: "151/412.111", v: "151/431.001", s: "151/482.101" }, "KW50": { l: null, v: "151/431.001", s: "151/482.101" },
    "K100 PEHD": { l: "151/412.214", v: "151/431.002", s: "151/482.101" }, "K120 PEHD": { l: "151/412.215", v: "151/431.003", s: "151/482.102" },
    "K150 PEHD": { l: "151/412.216", v: "151/431.003", s: "151/482.102" }, "K100 mit LV": { l: "151/415.102", v: "151/433.002", s: "151/482.101" },
    "K120 mit LV": { l: "151/415.103", v: "151/433.003", s: "151/482.102" }, "K150 mit LV": { l: "151/415.104", v: "151/433.003", s: "151/482.102" } };
  var BOE = {
    "K55, 90°, R = 0.60 m": { l: "151/421.121", v: "151/441.111" }, "K55, 90°, R = 1.00 m": { l: null, v: "151/441.111" },
    "K100, 90°, R = 1.00 m": { l: "151/421.124", v: "151/441.114" }, "K120, 90°, R = 1.20 m": { l: "151/421.125", v: "151/441.115" },
    "K150, 90°, R = 1.50 m": { l: "151/421.126", v: "151/441.116" },
    "Halbschalenabzweiger, K55": { l: "151/423.303", v: "151/451.303" }, "Halbschalenabzweiger, K100 auf K55": { l: "151/423.304", v: "151/451.304" },
    "Halbschalenabzweiger, KK4 auf K55": { l: "151/423.305", v: "151/451.305" }, "Halbschalenabzweiger, KK8 auf K55": { l: "151/423.306", v: "151/451.306" },
    "T-KK4 mit 2 K55 Ausgängen": { l: "151/423.302", v: "151/451.302" }, "T-KK8 mit 2 K55 Ausgängen": { l: "151/423.301", v: "151/451.301" },
    "Verbindungsstück KK4": { l: "151/423.307", v: "151/451.307" } };
  var MUF = {
    "Doppelsteckmuffen K55": { l: "151/421.511", v: "151/442.111" }, "Doppelsteckmuffen K100": { l: "151/421.514", v: "151/442.114" },
    "Doppelsteckmuffen K120": { l: "151/421.515", v: "151/442.115" }, "Doppelsteckmuffen K100 mit LV": { l: "151/421.562", v: "151/442.162" },
    "Doppelsteckmuffen K120 mit LV": { l: "151/421.563", v: "151/442.163" }, "Reparaturmuffen K100 106/100 mm": { l: "151/421.313", v: "151/442.114" } };
  var KAL = { 55: "151/485.004", 100: "151/485.001", 120: "151/485.002", 150: "151/485.003" };
  function rohrTab(c, LV) {
    var cx = new Ctx(LV); cx.g("g_rohr");
    if (!c.verl) cx.w("rohrNein", "info", {});
    function two(cat, row, unit) {
      var m = cat[row.typ], q = num(row.q, 0); if (!m || !(q > 0)) return;
      if (m.l) cx.add(m.l, q, { rule: eing(q, unit) }); else cx.off("ohneLV", q, unit, { t: row.typ }, { rule: eing(q, unit) });
      if (c.verl && m.v) cx.add(m.v, q, { rule: eing(q, unit) });
    }
    (c.rohre || []).forEach(function (x) { two(ROH, x, "m"); });
    (c.schn || []).forEach(function (x) { var m = ROH[x.typ], q = num(x.q, 0); if (m && q > 0) cx.add(m.s, q, { rule: eing(q, "St") }); });
    (c.boe || []).forEach(function (x) { two(BOE, x, "St"); });
    (c.muf || []).forEach(function (x) { two(MUF, x, "St"); });
    var e = num(c.erd, 0), w = num(c.warn, 0), s = num(c.schnur, 0), k = num(c.kal, 0);
    if (e > 0) cx.add("151/484.301", e, { rule: eing(e, "m") });
    if (w > 0) { cx.add("151/484.111", w, { rule: eing(w, "m") }); cx.add("151/484.211", w, { rule: eing(w, "m") }); }
    if (s > 0) cx.add("151/486.001", s, { rule: eing(s, "m") });
    if (k > 0) cx.add(KAL[c.kalDN] || KAL[55], k, { rule: eing(k, "m") + ", DN " + c.kalDN });
    return res(cx);
  }

  /* Grube mit Arbeitsraum (Werkloch, Fundament): Aushub, Erschwernis, Verfüllung, Belag */
  function grube(cx, c, parts, Vb, P) {
    var Vg = 0, A = 0, per = 0, Gt = 0, txt = [], bmin = 99;
    parts.forEach(function (g) { Vg += g.l * g.b * g.t * g.n; A += g.l * g.b * g.n; per += 2 * (g.l + g.b) * g.n; Gt = Math.max(Gt, g.t); bmin = Math.min(bmin, g.b);
      txt.push((g.n > 1 ? g.n + " × " : "") + s2(g.l) + " × " + s2(g.b) + " × " + s2(g.t)); });
    if (!(Vg > 0)) return null;
    var hk = HAND[c.hand] != null ? HAND[c.hand] : 0.10, gr = txt.join(" + ") + " = " + s2(Vg) + " m³";
    var bel = c.belag && c.belag.mode && c.belag.mode !== "none";
    var bi = belag(cx, c.belag, bel ? A : 0, bel ? per : 0, { cut: "Umfang Grube = " + s2(per) + " m", area: "Fläche Grube = " + s2(A) + " m²" }, bmin);
    aushubLines(cx, { m1: "151/231.111", m2: "151/231.112", h: "151/231.211" }, Gt, Vg * (1 - hk), Vg * hk,
      gr + " × " + s2((1 - hk) * 100) + " % = " + s2(Vg * (1 - hk)) + " m³", gr + " × " + s2(hk * 100) + " % = " + s2(Vg * hk) + " m³");
    erschwernis(cx, c.ersch, Gt, Vg * (1 - hk), Vg * hk, ERSCH_KEYS.grube_m, ERSCH_KEYS.grube_h);
    var Ve = Math.max(0, Vg - bi.Valt), Vv = Math.max(0, Vg - Vb - bi.Vneu);
    var vrs = verfuellung(cx, Ve, Vv, c, !!c.direkt, "Grube " + s2(Vg) + (Vb ? " − Bauteil " + s2(Vb) : "") + " − Belag/Fundation " + s2(bi.Vneu) + " = " + s2(Vv) + " m³");
    cx.b("b_Vg", "m³", Vg); cx.b("b_Vbelag", "m³", bi.Valt); cx.b("b_Ve", "m³", Ve); if (Vb) cx.b("b_Vb", "m³", Vb);
    cx.b("b_Vneu", "m³", bi.Vneu); cx.b("b_Vv", "m³", Vv); cx.b("b_R", "m³", vrs.R); cx.b("b_fremd", "m³", vrs.fremd); cx.b("b_Vs", "m³", vrs.Vs);
    return { Vg: Vg, A: A, Gt: Gt };
  }
  var WL_KEYS = ["ts", "bo", "sg", "zs"], PS_AUF = ["1.00 x 1.00 m", "1.50 x 1.00 m", "2.00 x 1.00 m", "2.60 x 1.00 m"];
  function werkloch(c, LV, P) {
    var cx = new Ctx(LV), D = (P.D && P.D.wl) || {}, ar = num(c.arbeit, 0.30), parts = [];
    WL_KEYS.forEach(function (k) { var q = num(c[k], 0), d = D[k] || [1.5, 1, 1];
      if (q > 0) parts.push({ n: q, l: num(d[0]) + 2 * ar, b: num(d[1]) + 2 * ar, t: num(d[2]) }); });
    var iB = num(c.iB, 0), iT = num(c.iT, 0), iL = num(c.iL, 0);
    if (iB > 0 && iT > 0 && iL > 0) parts.push({ n: 1, l: iL, b: iB, t: iT });
    var g = grube(cx, c, parts, 0, P);
    PS_AUF.forEach(function (s, i) { var q = num(c["p" + i], 0); if (q > 0) { cx.g("g_bauwerk"); cx.off("psAuf", q, "St", { t: s }, { rule: eing(q, "St") }); } });
    return res(cx, g || {});
  }
  var VK = ["CAB 1-3 L"], KVS = ["C 50"];
  function fund(c, LV, P) {
    var cx = new Ctx(LV), D = (P.D && P.D.fund) || {}, ar = num(c.arbeit, 0.30), parts = [], Vb = 0;
    [[c.vk, "VK"], [c.kvs, "KVS"]].forEach(function (x) {
      var typ = x[0]; if (!typ || !D[typ]) return; var d = D[typ].map(num);
      parts.push({ n: 1, l: d[0] + 2 * ar, b: d[1] + 2 * ar, t: d[2] }); Vb += d[0] * d[1] * d[2];
      cx.g("g_bauwerk"); cx.off("fundament", 1, "St", { t: x[1] + " " + typ }, { rule: s2(d[0]) + " × " + s2(d[1]) + " × " + s2(d[2]) + " m" });
    });
    var g = grube(cx, c, parts, Vb, P);
    return res(cx, g || {});
  }
  function geb(c, LV) {
    var cx = new Ctx(LV), n = num(c.n, 0), cm = num(c.cm, 0);
    cx.g("g_bauwerk");
    if (n > 0) cx.add("151/672.401", n, { rule: eing(n, "St") });
    if (cm > 0) cx.off("kernbohrung", cm, "cm", {}, { rule: eing(cm, "cm") });
    if (n > 0 && c.abd !== "keine") cx.off("abdichtung", n, "St", { t: c.abd === "kissen" ? "Kissen" : "Hauff" }, { rule: eing(n, "St") });
    return res(cx);
  }

  /* Belag: Wiederinstandsetzung nach Swisscom-Typ A, A1, B, C, C1, C2 (Etappen) */
  function nearest(map, mm) { var b = map[0]; map.forEach(function (m) { if (Math.abs(m[0] - mm) < Math.abs(b[0] - mm)) b = m; }); return b[1]; }
  function reinst(cx, typ, bk, d, A, per, P) {
    if (!typ || typ === "nein" || !(A > 0)) return;
    if (typ[0] === "C" && ["strasse", "kanton"].indexOf(bk) < 0) { cx.w("belagCnurStrasse", "amber", {}); return; }
    var deck = bk === "strasse" ? num(P.par.deckS, 0.035) : bk === "kanton" ? num(P.par.deckK, 0.04) : num(P.par.deckG, 0.03), rho = dens;
    var rA = "Fläche = " + s2(A) + " m²", rP = "Umfang = " + s2(per) + " m";
    cx.g("g_belagNeu");
    var acT = function (dt) { if (dt <= 0.0005) return; var n = Math.max(1, Math.ceil(dt / 0.1 - 1e-9)), m = A * dt * rho;
      cx.add(nearest([[50, "223/441.212"], [60, "223/441.311"], [70, "223/441.312"], [80, "223/441.313"], [90, "223/441.314"], [100, "223/441.315"]], dt / n * 1000), m,
        { rule: s2(A) + " m² × " + Math.round(dt * 1000) + " mm × " + rho + " t/m³ = " + s2(m) + " t" + (n > 1 ? " (" + n + " Lagen)" : "") }); };
    var acD = function (dd) { var m = A * dd * rho; cx.add(nearest([[20, "223/442.111"], [25, "223/442.112"], [30, "223/442.113"], [35, "223/442.114"], [40, "223/442.212"]], dd * 1000), m,
        { rule: s2(A) + " m² × " + Math.round(dd * 1000) + " mm × " + rho + " t/m³ = " + s2(m) + " t" }); };
    var fr = function (dd) { var mm = dd * 1000, m = A * dd * rho; cx.g("g_belag"); cx.add(mm > 150 ? "117/223.214" : mm > 100 ? "117/223.213" : "117/223.212", A, { rule: rA });
      cx.g("g_deponieBelag"); cx.add("223/263.228", m, { rule: s2(m) + " t" }); cx.add("117/731.222", m, { rule: s2(m) + " t" }); cx.g("g_belagNeu"); };
    var naht = function (dd) { var mm = dd * 1000; cx.add(mm <= 40 ? "223/423.111" : mm <= 80 ? "223/423.112" : "223/423.113", per, { rule: rP }); };
    var hv = function () { cx.add("223/422.101", A, { rule: rA }); };
    var ob = function () { var V = A * d, r = rA + " × " + s2(d) + " m = " + s2(V) + " m³"; cx.g("g_aushub"); cx.add("151/231.111", V, { rule: r });
      cx.g("g_deponie"); cx.add("151/252.213", V, { rule: r }); cx.add("151/262.113", V, { rule: r }); cx.g("g_belagNeu"); };
    var B = function () { acT(d - deck); acD(deck); hv(); naht(d); };
    switch (typ) {
      case "A": cx.off("kaltmisch", A, "m²", {}, { rule: rA }); ob(); B(); break;
      case "A1": ob(); B(); break;
      case "B": B(); break;
      case "C": acT(d); fr(deck); acD(deck); hv(); naht(d); break;
      case "C1": acT(d); naht(d); cx.w("c1sep", "amber", {}); break;
      case "C2": fr(deck); acD(deck); hv(); naht(deck); break;
    }
  }
  function belagTab(c, LV, P) {
    var cx = new Ctx(LV);
    if (String(c.indiv) === "true") return res(cx);
    var B = num(c.B, 0), L = num(c.L, 0), d = num(c.d, 0.08);
    if ((B > 0 && B < 0.4) || (L > 0 && L < 0.4)) cx.w("belagMin", "amber", {});
    if (B > 0 && L > 0) {
      var g = P.par, rg = c.bk === "gehweg" ? [g.gehMin, g.gehMax] : c.bk === "strasse" ? [g.strMin, g.strMax] : c.bk === "kanton" ? [g.kanMin, g.kanMax] : null;
      if (rg && (d < num(rg[0]) - 1e-9 || d > num(rg[1]) + 1e-9)) cx.w("belagRange", "amber", { d: d, a: rg[0], b: rg[1] });
      reinst(cx, c.wi, c.bk, d, B * L, 2 * (B + L), P);
    }
    return res(cx, { A: B * L });
  }
  function allg(c, LV) {
    var cx = new Ctx(LV), km = num(c.km, 0), ak = num(c.ak, 0);
    cx.g("g_pausch");
    if (km > 0) cx.lines.push({ key: "Pauschal", unit: "gl", ep: km, qty: 1, total: r2(km), grp: "g_pausch", text: "Kleinmaterial", ctx: "", rule: "Eingabe CHF", flag: "" });
    if (ak > 0) cx.lines.push({ key: "Pauschal", unit: "gl", ep: ak, qty: 1, total: r2(ak), grp: "g_pausch", text: "Akkordarbeiten", ctx: "", rule: "Eingabe CHF", flag: "" });
    return res(cx);
  }
  /* Weitere LV-Positionen je Datensatz: direkte Menge je LV-Position */
  function weitere(cx, x) {
    Object.keys(x || {}).sort().forEach(function (k) { var q = num(x[k], 0); if (q > 0 && cx.LV[k]) { cx.g("g_weitere"); cx.add(k, q, { rule: eing(q, cx.LV[k].u) }); } });
  }

  /* ---------- Freie Positionen ---------- */
  function freie(list, LV) {
    var cx = new Ctx(LV);
    (list || []).forEach(function (f) {
      var q = num(f.qty, 0);
      if (f.custom) {
        var ep = num(f.ep, 0);
        cx.grp = "g_frei";
        if (!(ep > 0)) {
          cx.off("freiKeinEP", q, f.unit || "St", { t: f.text || "?" }, { text: f.text || "", rule: f.reason || "", always: true });
        } else {
          cx.lines.push({ key: "—", unit: f.unit || "St", ep: ep, qty: r2(q), total: r2(q * ep), grp: "g_frei",
                          text: f.text || "", ctx: "", rule: f.reason || "", flag: "ausserLV" });
          cx.w(f.reason ? "freiAusserLV" : "freiOhneGrund", f.reason ? "amber" : "stop", { t: f.text || "?" });
        }
      } else if (LV[f.key]) {
        var ov = (f.ep !== "" && f.ep != null && isFinite(parseFloat(f.ep)) && Math.abs(num(f.ep) - LV[f.key].ep) > 1e-9) ? num(f.ep) : null;
        cx.grp = f.key.indexOf("113/") === 0 ? "g_be" : "g_frei";
        var l = cx.add(f.key, q, { ep: ov, flag: ov != null ? "epGeaendert" : "", rule: f.note || "" });
        if (ov != null) cx.w("epGeaendert", "amber", { k: f.key, lv: LV[f.key].ep, ep: ov });
        if (l && f.key.indexOf("151/471") === 0) cx.w("rohrblock", "info", {});
      }
    });
    return { lines: cx.lines, warn: cx.warn, bal: [] };
  }

  /* ---------- Vollständigkeit (Umfang gemäss Prüfliste) ---------- */
  var COMPLETE = [
    { id: "c_bse", auto: true },
    { id: "c_sond", pre: ["151/121", "151/122"], q: "sondier" },
    { id: "c_belag", pre: ["117/223"], rel: "belag", q: "schneiden", tk: ["belagDicke"] },
    { id: "c_aushub", pre: ["151/221", "151/231"], q: "aushub", tk: ["handTiefe", "masch2"] },
    { id: "c_erschw", pre: ["151/222", "151/223", "151/224", "151/232", "151/234", "151/321", "151/131", "151/132"], q: "spriess", tk: ["spries2", "erschTiefe"] },
    { id: "c_transp", pre: ["151/251", "151/252", "151/261", "151/262", "151/273", "117/721", "117/731"], q: "transport", tk: ["pakE"] },
    { id: "c_zone", pre: ["151/711", "151/721", "151/731", "151/741"], rel: "any", q: "leitungszone" },
    { id: "c_rohr", pre: ["151/412", "151/415", "151/431"], rel: "graben", q: "kabelschutzrohre", tk: ["rohr5"] },
    { id: "c_form", pre: ["151/421", "151/441", "151/442", "151/484"], rel: "graben", q: "warnb" },
    { id: "c_kalib", pre: ["151/485"], rel: "graben", q: "kalibrieren" },
    { id: "c_schacht", pre: ["151/611", "151/621", "151/623", "151/632"], rel: "schacht", q: "schacht" },
    { id: "c_wieder", pre: ["223/"], rel: "belag", q: "tragschicht", tk: ["tragMax", "deckMax", "naehteMax", "fundMin", "deckMasch"] },
    { id: "c_signal", pre: ["113/2"], q: "verkehrsregelung" },
    { id: "c_schutz", pre: ["151/242", "151/243", "151/244"], q: "schützen" },
    { id: "c_doku", none: true }
  ];
  function completeness(P, lines) {
    var hasOk = function (pre) { return lines.some(function (l) { return l.key !== "OFFEN" && pre.some(function (p) { return l.key.indexOf(p) === 0; }); }); };
    var hasOpen = function (tk) { return tk && lines.some(function (l) { return l.flag === "offen" && tk.indexOf(l.tk) >= 0; }); };
    var R = P.recs || {}, el = [].concat(R.graben || [], R.schacht || [], R.werkloch || [], R.fund || []);
    var anyG = (R.graben || []).length > 0 || (R.rohr || []).length > 0, anyS = (R.schacht || []).length > 0;
    var belags = el.filter(function (e) { return e.belag && e.belag.mode === "bit"; });
    return COMPLETE.map(function (it) {
      var st;
      if (it.auto) st = "ok";
      else if (it.none) st = "nopos";
      else if (hasOk(it.pre)) st = "ok";
      else if (hasOpen(it.tk)) st = "nopos";
      else if (it.rel === "belag" && !belags.length) st = "na";
      else if (it.rel === "graben" && !anyG) st = "na";
      else if (it.rel === "schacht" && !anyS) st = "na";
      else if (it.id === "c_wieder" && belags.length && belags.every(function (e) { return e.belag.einbau === "dritte"; })) st = "third";
      else st = "open";
      return { id: it.id, st: st, q: it.q || "" };
    });
  }

  /* ---------- Gesamt ---------- */
  function vorarbeiten(P, LV) {
    var cx = new Ctx(LV);
    cx.g("g_vorarbeiten");
    var s = P.sond || {}, m3 = num(s.m3, 0);
    if (m3 > 0) {
      cx.add("151/121.001", m3, { rule: "Eingabe = " + s2(m3) + " m³" });
      cx.add(s.einfHand ? "151/122.002" : "151/122.001", m3, { rule: "= Sondieraushub " + s2(m3) + " m³" });
    }
    var w = P.wasser || {}, h = num(w.h, 0), sump = num(w.sumpf, 0);
    if (h > 0) cx.add("151/131.111", h, { rule: "Eingabe = " + h + " h" });
    if (sump > 0) cx.add("151/132.101", sump, { rule: "Eingabe = " + sump + " St" });
    return { lines: cx.lines, warn: cx.warn, bal: [] };
  }
  function baustelle(P, LV, baseSum) {
    var cx = new Ctx(LV), B = P.be || {};
    cx.g("g_be");
    var pct = num(B.pct, 0);
    if (pct > 0) {
      var betrag = r2(baseSum * pct / 100), p = LV["113/111.002"];
      cx.lines.push({ key: "113/111.002", unit: p.u, ep: betrag, qty: 1, total: betrag, grp: "g_be", text: lvT("113/111.002"), ctx: lvC("113/111.002"),
        rule: pct + " % × " + s2(baseSum) + " = " + s2(betrag), flag: "" });
    }
    return { lines: cx.lines, warn: cx.warn, bal: [] };
  }

  var TABS = ["graben", "rohr", "schacht", "werkloch", "fund", "geb", "belag", "allg"];
  var FN = { graben: graben, rohr: rohrTab, schacht: schacht, werkloch: werkloch, fund: fund, geb: geb, belag: belagTab, allg: allg };
  function calcRec(tab, e, LV, P) {
    var r;
    try { r = FN[tab](e, LV, P); } catch (err) { r = { lines: [], warn: [{ id: "rechenfehler", sev: "stop", args: { m: err.message } }], bal: [] }; }
    if (!r.bal) r.bal = [];
    var cx = new Ctx(LV); cx.lines = r.lines; cx.warn = r.warn;
    if (tab === "graben") zusaetze(cx, e);
    weitere(cx, e.x);
    if (e.free && e.free.length) { var f = freie(e.free, LV); r.lines = r.lines.concat(f.lines); r.warn = r.warn.concat(f.warn); }
    if (tab === "belag") r.lines.forEach(function (l) { l.ks = "Belag"; });
    r.sum = r2(r.lines.reduce(function (s, l) { return s + l.total; }, 0));
    return r;
  }
  function calc(P, LV) {
    dens = num(P.dichte, ASPHALT_T) || ASPHALT_T;
    var out = { elems: [], sum: {}, warn: [] };
    TABS.forEach(function (tab) {
      ((P.recs || {})[tab] || []).forEach(function (e, i) {
        var r = calcRec(tab, e, LV, P);
        r.name = e.name; r.type = tab; r.tab = tab; r.idx = i; r.id = tab + "_" + i;
        out.elems.push(r);
      });
    });
    out.free = { lines: [], warn: [], sum: 0 };
    out.vor = vorarbeiten(P, LV);
    out.vor.sum = r2(out.vor.lines.reduce(function (s, l) { return s + l.total; }, 0));
    var baseSum = out.elems.reduce(function (s, e) { return s + e.sum; }, 0) + out.vor.sum;
    out.be = baustelle(P, LV, r2(baseSum));
    out.be.sum = r2(out.be.lines.reduce(function (s, l) { return s + l.total; }, 0));
    out.beBase = r2(baseSum);
    var all = [];
    out.elems.forEach(function (e) { all = all.concat(e.lines); });
    all = all.concat(out.vor.lines, out.be.lines);
    var byKey = {};
    all.forEach(function (l) {
      var k = l.key + "|" + l.ep + "|" + l.flag + ((l.key === "—" || l.key === "OFFEN" || l.key === "Pauschal") ? "|" + (l.text || l.tk) + "|" + JSON.stringify(l.args || {}) : "");
      if (!byKey[k]) byKey[k] = { key: l.key, unit: l.unit, ep: l.ep, qty: 0, total: 0, text: l.text, ctx: l.ctx, flag: l.flag, tk: l.tk, args: l.args, open: l.open };
      byKey[k].qty = r2(byKey[k].qty + l.qty); byKey[k].total = r2(byKey[k].total + l.total);
    });
    out.summary = Object.keys(byKey).map(function (k) { return byKey[k]; })
      .sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
    out.nOffen = all.filter(function (l) { return l.open; }).length;
    var zw = r2(all.reduce(function (s, l) { return s + l.total; }, 0));
    var st = STAFFEL.filter(function (s) { return zw <= s.bis; })[0];
    var idx = STAFFEL.indexOf(st);
    var mwSatz = num(P.mwst, MWST * 100) / 100;
    var rabatt = r2(zw * st.pct / 100), nach = r2(zw - rabatt), inst = zw > 0 ? st.inst : 0, netto = r2(nach + inst), mw = r2(netto * mwSatz);
    out.sum = { zwischen: zw, stufe: idx + 1, pct: st.pct, rabatt: rabatt, nachRabatt: nach,
                inst: inst, netto: netto, mwst: mw, mwSatz: mwSatz, brutto: r2(netto + mw),
                belag: r2(all.filter(function (l) { return l.ks === "Belag"; }).reduce(function (s, l) { return s + l.total; }, 0)) };
    out.elems.forEach(function (e) { out.warn = out.warn.concat(e.warn.map(function (w) { w.el = e.name; w.tab = e.tab; w.idx = e.idx; return w; })); });
    out.vor.warn.forEach(function (w) { w.el = "—"; out.warn.push(w); });
    out.be.warn.forEach(function (w) { w.el = "—"; out.warn.push(w); });
    out.complete = completeness(P, all);
    return out;
  }

  /* ---------- Annahmen mit Kostenwirkung (Zwischensumme) ---------- */
  function sens(P, LV) {
    var base = calc(P, LV), b0 = base.sum.zwischen, rows = [];
    var clone = function () { return JSON.parse(JSON.stringify(P)); };
    var delta = function (mut) { var Q = clone(); mut(Q); return r2(calc(Q, LV).sum.zwischen - b0); };
    ["graben", "schacht", "werkloch", "fund"].forEach(function (tab) {
      ((P.recs || {})[tab] || []).forEach(function (e, i) {
        var be = base.elems.filter(function (x) { return x.tab === tab && x.idx === i; })[0];
        if (!be || !be.lines.length || (tab === "schacht" && e.modus !== "neu")) return;
        var h = e.hand || "normal", ha = h === "normal" ? "eng" : h === "eng" ? "sehr_eng" : "eng";
        rows.push({ el: e.name, id: "a_hand", val: "o_hand_" + h, alt: "o_hand_" + ha, d: delta(function (Q) { Q.recs[tab][i].hand = ha; }) });
        if (tab === "graben") {
          var u = num(e.umhArea, 0.035);
          rows.push({ el: e.name, id: "a_umh", val: String(u) + " m²/m", alt: String(r2(u + 0.01)) + " m²/m", d: delta(function (Q) { Q.recs[tab][i].umhArea = String(u + 0.01); }) });
        } else {
          var ar = num(e.arbeit, 0.5), ara = ar >= 0.5 ? 0.75 : 0.5;
          rows.push({ el: e.name, id: "a_arbeit", val: ar.toFixed(2) + " m", alt: ara.toFixed(2) + " m", d: delta(function (Q) { Q.recs[tab][i].arbeit = String(ara); }) });
        }
        var dk = tab === "schacht" ? e.direkt !== false : !!e.direkt;
        rows.push({ el: e.name, id: "a_direkt", val: dk ? "dv_ja" : "dv_nein", alt: dk ? "dv_nein" : "dv_ja", d: delta(function (Q) { Q.recs[tab][i].direkt = !dk; }) });
      });
    });
    var anyBelag = ["graben", "schacht", "werkloch", "fund"].some(function (tab) { return ((P.recs || {})[tab] || []).some(function (e) { return e.belag && e.belag.mode === "bit"; }); }) || ((P.recs || {}).belag || []).length > 0;
    if (anyBelag) rows.push({ el: "—", id: "a_dichte", val: dens0(P) + " t/m³", alt: "2.2 t/m³", d: delta(function (Q) { Q.dichte = 2.2; }) });
    calc(P, LV);
    return rows;
  }
  function dens0(P) { return String(num(P.dichte, ASPHALT_T) || ASPHALT_T); }

  return { calc: calc, calcRec: calcRec, sens: sens, r2: r2, num: num, STAFFEL: STAFFEL, SCHACHT: SCHACHT, MWST: MWST, HAND: HAND, ASPHALT_T: ASPHALT_T,
           COMPLETE: COMPLETE, LOC_INFO: LOC_INFO, TABS: TABS, ROH: ROH, BOE: BOE, MUF: MUF, VK: VK, KVS: KVS, PS_AUF: PS_AUF, ABSCHL: ABSCHL,
           sizeOf: sizeOf, sysDefault: sysDefault, shapeOf: shapeOf };
})();
