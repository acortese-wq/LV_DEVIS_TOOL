/* =====================================================================
   LV-Devis Tiefbau – Oberfläche
   Reiter-Maske (LV-Erfassung) + Rechenkern KV-Assistent + Schachtauswahl
   App-Konzept und Urheber: Alessandro Cortese
   ===================================================================== */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var chf = function (v) { return v == null ? "—" : v.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var qf = function (v) { return (v || 0).toLocaleString("de-CH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); };
  var num = KVE.num, r2 = KVE.r2;
  var S;
  var tt = function (k) { var d = T[S.lang] || T.de; return d[k] != null ? d[k] : (T.de[k] != null ? T.de[k] : k); };
  var fill = function (s, a) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return a && a[k] != null ? a[k] : m; }); };
  var today = function () { var d = new Date(); return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(); };
  var KEY = "lv-devis-tiefbau-v2";
  var LVTABS = KVE.TABS, TABS = LVTABS.concat(["hon"]), ALLTABS = TABS.concat(["par"]);

  /* Positionstexte je Sprache (FR aus LV FR, IT sobald hinterlegt) */
  window.lvT = function (k) { var m = S && S.lang === "fr" ? LV_FR : S && S.lang === "it" ? LV_IT : null; return m && m[k] && m[k].t ? m[k].t : (LV[k] ? LV[k].t : k); };
  window.lvC = function (k) { var m = S && S.lang === "fr" ? LV_FR : S && S.lang === "it" ? LV_IT : null; return m && m[k] && m[k].c ? m[k].c : (LV[k] ? LV[k].c : ""); };

  /* ---------- Datensätze ---------- */
  var ERSCH0 = function () { return { klasse: "keine", verf: "keine", hind: "keine", hindVol: "0.30" }; };
  function mkBelag(mode) {
    var b = { mode: mode || "bit", d: "130", pak: "le250", einbau: "typN", typ: "N", trag: "T22", dTrag: "90", deck: "AC8", deckArt: "hand", dDeck: "40", haft: true, naehte: true, fund: "0",
      humus: { art: "abtrag", dOber: "30", hand: false, ansaeen: false },
      pflaster: { material: "betonverbund", dicke: "60", fund: "200", randNeu: false, randMat: "gneis", randTyp: "8/11", randLaenge: "", randAbbruch: false, abbruchAlt: false, abbruchArt: "betonstein" } };
    if (S && S.kopf && S.kopf.belagLief) b.einbau = "dritte";
    return b;
  }
  /* SIA 103-K 2018, Art. 7.7: Leistungsanteile q (fest, nicht übersteuerbar). Nur die Auswahl der beauftragten Teilphasen ist frei. */
  var PHDEF = [
    ["31", ["Vorprojekt", "Avant-projet", "Progetto di massima", "Preliminary design"], 8, true],
    ["32", ["Bauprojekt", "Projet de l'ouvrage", "Progetto definitivo", "Construction design"], 22, true],
    ["33", ["Bewilligungsverfahren / Auflageprojekt", "Procédure d'autorisation / mise à l'enquête", "Procedura d'autorizzazione / pubblicazione", "Permit procedure / public display"], 2, true],
    ["41", ["Ausschreibung, Offertvergleich, Vergabeantrag", "Appel d'offres, comparaison, proposition d'adjudication", "Appalto, confronto offerte, proposta d'aggiudicazione", "Tender, bid comparison, award proposal"], 10, true],
    ["51", ["Ausführungsprojekt", "Projet d'exécution", "Progetto esecutivo", "Detailed design"], 18, true],
    ["52a", ["Ausführung – allgemeine Bauleitung", "Exécution – direction générale des travaux", "Esecuzione – direzione lavori generale", "Execution – general site management"], 22, true],
    ["52b", ["Ausführung – technische Bauleitung", "Exécution – direction technique des travaux", "Esecuzione – direzione lavori tecnica", "Execution – technical site management"], 15, true],
    ["52c", ["Ausführung – Baukontrolle (nur ohne Bauleitung, Art. 7.7.5)", "Exécution – contrôle (seulement sans direction des travaux)", "Esecuzione – controllo (solo senza direzione lavori)", "Execution – construction control (only without site management)"], 7, false],
    ["53", ["Inbetriebnahme, Abschluss", "Mise en service, achèvement", "Messa in servizio, chiusura", "Commissioning, close-out"], 3, true]];
  /* Faktoren SIA 103-K 2018 Art. 7.6–7.10: «Ohne besondere Vereinbarung gilt … 1.0». Z1/Z2: Koeffizienten SIA 103 (Stand 2018). */
  var HONF = { Z1: 0.075, Z2: 7.23, n: 1.0, r: 1.0, i: 1.0, s: 1.0 };

  function newRec(tab, n) {
    var nm = function (s) { return s + " " + n; }, r;
    switch (tab) {
      case "graben": r = { name: nm("Leitungsgraben"), L: "", T: "0.60", bmode: "min60", aussen: "", bman: "0.60", hand: "normal", gesp: false, direkt: false, aushubArt: "normal", saugH: "0",
        rohrSystem: "k55", dn: "55", len: "10", n: "1", muffenMode: "auto", muffenN: "0", b90: "0", b45: "0", schneiden: "0", warnband: true, kalib: true, einzug: "schnur",
        dn2: "100", n2: "1", abzweiger: [], bloecke: [{ dn: "55", n: "1", lagen: "1", len: "10" }], block: { breite: "0.50", hoehe: "0.30" },
        umhType: "kies", umhMat: "betonkies", umhArea: "0.035", verf: "aushub", einfHand: false, Lb: "", belag: mkBelag(),
        mods: { ersch: false, fremd: false, boesch: false }, ersch: ERSCH0(), kreuz: { on: true, n: "1", len: "1.00", richtung: "quer" }, zores: { on: false, len: "0", zustand: "abrechen" },
        boeschung: { on: true, flaeche: "", geneigt: false }, uF: "", uP: "", uL: "", aB: "", aW: "", aS: "", aR: "" }; break;
      case "schacht": r = { name: nm("Schacht"), modus: "neu", einbauort: "SS", typ: "KES150", n: "0", arbeit: "0.50", hand: "normal", direkt: true, beton: "0", platten: "0", anschl: "0", anDN: "80",
        rahmen: "", deckel: "", verf: "kies045", einfHand: true, belag: mkBelag(), mods: { ersch: false }, ersch: ERSCH0(), deckelRichtung: "hoeher", deckelFormat: "rund", deckelN: "0",
        shape: "eckig", sys: "nivo", deckelFormat2: "90", deckelSockel: "ohne", spare: "0", alt: "guss", opts: {}, deviate: false, reason: "", approver: "", journal: false }; break;
      case "rohr": r = { name: nm("Rohranlage"), verl: true, rohre: [{ typ: "K55", q: "" }], schn: [{ typ: "K55", q: "" }], boe: [{ typ: "", q: "" }], muf: [{ typ: "", q: "" }], erd: "", warn: "", schnur: "", kal: "", kalDN: "55" }; break;
      case "werkloch": r = { name: nm("Werklöcher"), ts: "", bo: "", sg: "", zs: "", iB: "", iT: "", iL: "", p0: "", p1: "", p2: "", p3: "", arbeit: "0.30", hand: "normal", direkt: false, verf: "aushub", einfHand: false, belag: mkBelag(), mods: { ersch: false }, ersch: ERSCH0() }; break;
      case "fund": r = { name: nm("Fundament"), vk: "", kvs: "", arbeit: "0.30", hand: "normal", direkt: false, verf: "kies045", einfHand: false, belag: mkBelag("none"), mods: { ersch: false }, ersch: ERSCH0() }; break;
      case "geb": r = { name: nm("Gebäudeeinführung"), n: "", cm: "", abd: "hauff" }; break;
      case "belag": r = { name: nm("Belagsarbeiten"), indiv: false, bk: "gehweg", d: "0.08", B: "", L: "", wi: "B" }; break;
      case "allg": r = { name: nm("Allgemein"), km: "", ak: "" }; break;
      case "hon": r = { name: nm("Ingenieurhonorar"), src: "lv", B: "", h: "", nk: "", gl: false, ph: PHDEF.map(function (p) { return { k: p[0], on: p[3] }; }) }; break;
    }
    r.x = {}; r.free = [];
    return r;
  }
  function defaults() {
    var recs = {}, idx = {};
    TABS.forEach(function (t) { recs[t] = [newRec(t, 1)]; idx[t] = 0; });
    return { v: 2, lang: "de", tab: "graben", kopf: { projekt: "", ort: "", bearb: "", datum: today(), rolle: "anv", devisNr: "", lieferant: "", vertrag: "", termin: "", belagLief: false, sap: "", bem: "" },
      recs: recs, idx: idx, sond: { m3: "", einfHand: false }, wasser: { h: "", sumpf: "" }, be: { pct: "" }, dichte: "2.4", mwst: "8.1",
      par: { deckG: "0.03", deckS: "0.035", deckK: "0.04", gehMin: "0.06", gehMax: "0.12", strMin: "0.09", strMax: "0.20", kanMin: "0.12", kanMax: "0.30" },
      D: { wl: { ts: [1.50, 1.00, 1.00], bo: [1.50, 1.00, 1.00], sg: [2.00, 1.20, 1.20], zs: [1.00, 0.80, 1.00] }, fund: { "CAB 1-3 L": [1.00, 0.60, 0.80], "C 50": [1.20, 0.70, 0.80] } },
      ui: { closed: {}, xo: {}, printDraw: true } };
  }
  function deepFill(dst, src) { Object.keys(src).forEach(function (k) { if (dst[k] == null) dst[k] = JSON.parse(JSON.stringify(src[k])); else if (typeof src[k] === "object" && !Array.isArray(src[k]) && typeof dst[k] === "object") deepFill(dst[k], src[k]); }); }
  function heal() {
    var d = defaults();
    deepFill(S, d);
    TABS.forEach(function (t) {
      if (!Array.isArray(S.recs[t]) || !S.recs[t].length) { S.recs[t] = [newRec(t, 1)]; S.idx[t] = 0; }
      var nr = newRec(t, 1); S.recs[t].forEach(function (r) { deepFill(r, nr); });
      if (!(S.idx[t] >= 0 && S.idx[t] < S.recs[t].length)) S.idx[t] = 0;
    });
    if (ALLTABS.indexOf(S.tab) < 0) S.tab = "graben";
  }
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || S.v !== 2) S = defaults();
  heal();
  var saveT;
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }, 300); }
  var rec = function () { return S.recs[S.tab][S.idx[S.tab]]; };

  /* ---------- Felddefinitionen (KV-Assistent, erweitert) ---------- */
  var isBit = function (c) { return c.belag.mode === "bit"; }, isTyp = function (c) { return c.belag.mode === "bit" && c.belag.einbau === "typN"; };
  var isTypN = function (c) { return isTyp(c) && c.belag.typ !== "L"; }, isHumus = function (c) { return c.belag.mode === "humus"; };
  var isHumusAbtrag = function (c) { return isHumus(c) && c.belag.humus.art !== "rasenziegel"; }, isPfl = function (c) { return c.belag.mode === "pflaster"; };
  var BELAG_FIELDS = [
    { id: "belag.mode", t: "sel", opts: ["none", "bit", "humus", "pflaster"], struct: 1 },
    { id: "belag.d", t: "num", show: isBit }, { id: "belag.pak", t: "sel", opts: ["le250", "gt250"], show: isBit },
    { id: "belag.einbau", t: "sel", opts: ["dritte", "typN"], show: isBit, struct: 1 }, { id: "belag.typ", t: "sel", opts: ["N", "L"], show: isTyp, struct: 1 },
    { id: "belag.trag", t: "sel", opts: ["T16", "T22"], show: isTypN }, { id: "belag.dTrag", t: "num", show: isTyp },
    { id: "belag.deck", t: "sel", opts: function (c) { return c.belag.typ === "L" ? ["AC4L", "AC8L"] : ["AC8", "AC11"]; }, show: isTyp, struct: 1 },
    { id: "belag.deckArt", t: "sel", opts: ["hand", "masch"], show: isTypN }, { id: "belag.dDeck", t: "num", show: isTyp },
    { id: "belag.haft", t: "chk", show: isTyp }, { id: "belag.naehte", t: "chk", show: isTyp }, { id: "belag.fund", t: "sel", opts: ["0", "150", "200", "300"], show: isTyp },
    { id: "belag.humus.art", t: "sel", opts: ["abtrag", "rasenziegel"], show: isHumus, struct: 1 }, { id: "belag.humus.dOber", t: "num", show: isHumusAbtrag },
    { id: "belag.humus.hand", t: "chk", show: isHumusAbtrag }, { id: "belag.humus.ansaeen", t: "chk", show: isHumusAbtrag },
    { id: "belag.pflaster.abbruchAlt", t: "chk", show: isPfl, struct: 1 },
    { id: "belag.pflaster.abbruchArt", t: "sel", opts: ["betonstein", "platten", "natur"], show: function (c) { return isPfl(c) && c.belag.pflaster.abbruchAlt; } },
    { id: "belag.pflaster.material", t: "sel", opts: ["betonverbund", "beton", "natur"], show: isPfl, struct: 1 },
    { id: "belag.pflaster.dicke", t: "sel", opts: function (c) { return c.belag.pflaster.material === "betonverbund" ? ["60", "80"] : ["40", "50"]; }, show: isPfl },
    { id: "belag.pflaster.fund", t: "sel", opts: ["0", "150", "200", "300"], show: isPfl }, { id: "belag.pflaster.randNeu", t: "chk", show: isPfl, struct: 1 },
    { id: "belag.pflaster.randMat", t: "sel", opts: ["gneis", "granit"], show: function (c) { return isPfl(c) && c.belag.pflaster.randNeu; } },
    { id: "belag.pflaster.randTyp", t: "sel", opts: ["8/11", "11/13"], show: function (c) { return isPfl(c) && c.belag.pflaster.randNeu; } },
    { id: "belag.pflaster.randLaenge", t: "num", show: function (c) { return isPfl(c) && c.belag.pflaster.randNeu; } },
    { id: "belag.pflaster.randAbbruch", t: "chk", show: function (c) { return isPfl(c) && c.belag.pflaster.randNeu; } }];
  var VERF_FIELDS = [{ id: "verf", t: "sel", opts: ["aushub", "kies045", "kies016", "betonkies"], hint: "hint_verf" }, { id: "einfHand", t: "chk" }];
  var ERSCH_FIELDS = [{ id: "mods.ersch", t: "chip" },
    { id: "ersch.klasse", t: "sel", opts: ["keine", "5", "6", "7"], show: function (c) { return c.mods.ersch; } },
    { id: "ersch.verf", t: "sel", opts: ["keine", "gefroren", "stein"], show: function (c) { return c.mods.ersch; } },
    { id: "ersch.hind", t: "sel", opts: ["keine", "findling", "fundUnbew", "fundBew"], show: function (c) { return c.mods.ersch; }, struct: 1 },
    { id: "ersch.hindVol", t: "num", show: function (c) { return c.mods.ersch && c.ersch.hind !== "keine"; } }];
  var PIT_FIELDS = [{ id: "arbeit", t: "sel", opts: ["0.30", "0.50", "0.75"] }, { id: "hand", t: "sel", opts: ["normal", "eng", "sehr_eng"] }, { id: "direkt", t: "chk", hint: "hint_direkt" }];
  var isLaengs = function (c) { return c.rohrSystem === "laengs"; }, isBlock = function (c) { return c.rohrSystem === "block"; }, isStd = function (c) { return c.rohrSystem === "k55"; };
  var withShow = function (list, fn) { return list.map(function (f) { return Object.assign({}, f, { show: function (c) { return fn(c) && (f.show ? f.show(c) : true); } }); }); };
  function locOf(c) { return LOCS.filter(function (l) { return l.id === c.einbauort; })[0]; }
  function kindOf(c) { var s = KVE.SCHACHT[c.typ]; return s ? s.kind : null; }
  var notDeckel = function (c) { return c.modus !== "deckel"; }, isNeu = function (c) { return c.modus === "neu"; };
  var shapeFree = function (c) { var k = kindOf(c); return notDeckel(c) && k !== "KS" && !(k === "PLS" && isNeu(c)); };
  var curShape = function (c) { return kindOf(c) === "KS" ? "rund" : c.shape; };
  var COVERS = Object.keys(LV).filter(function (k) { return k.indexOf("151/632.1") === 0; }).sort();
  var F = {
    graben: [{ sec: "s_graben" }, { id: "name", t: "text" }, { id: "L", t: "num" }, { id: "T", t: "num" },
      { id: "bmode", t: "sel", opts: ["min60", "begangen", "nicht_begangen", "manuell"], struct: 1, hint: "hint_breite" },
      { id: "aussen", t: "num", show: function (c) { return c.bmode === "begangen" || c.bmode === "nicht_begangen"; } },
      { id: "bman", t: "num", show: function (c) { return c.bmode === "manuell"; } },
      { id: "aushubArt", t: "sel", opts: ["normal", "saug"], struct: 1 }, { id: "saugH", t: "num", show: function (c) { return c.aushubArt === "saug"; } },
      { id: "hand", t: "sel", opts: ["normal", "eng", "sehr_eng"], show: function (c) { return c.aushubArt !== "saug"; } },
      { id: "gesp", t: "chk" }, { id: "direkt", t: "chk", hint: "hint_direkt" }
    ].concat(ERSCH_FIELDS, [
      { sec: "s_rohr" }, { id: "rohrSystem", t: "sel", opts: ["k55", "laengs", "block"], struct: 1, hint: "hint_rohrSystem" },
      { id: "dn", t: "sel", opts: ["55", "100", "120", "150"], show: isStd }, { id: "len", t: "sel", opts: ["5", "10"], show: isStd }, { id: "n", t: "num", show: isStd },
      { id: "muffenMode", t: "sel", opts: ["auto", "manuell"], struct: 1, show: isStd, hint: "hint_muffen" },
      { id: "muffenN", t: "num", show: function (c) { return isStd(c) && c.muffenMode === "manuell"; } },
      { id: "b90", t: "num", show: isStd }, { id: "b45", t: "num", show: isStd }, { id: "schneiden", t: "num", show: isStd },
      { id: "dn2", t: "sel", opts: ["100", "120", "150"], show: isLaengs }, { id: "n2", t: "num", show: isLaengs },
      { id: "blist", t: "blockList", show: isBlock, struct: 1 }, { id: "block.breite", t: "num", show: isBlock, hint: "hint_block" }, { id: "block.hoehe", t: "num", show: isBlock },
      { id: "warnband", t: "chk" }, { id: "kalib", t: "chk" }, { id: "einzug", t: "sel", opts: ["keine", "schnur", "draht"], show: function (c) { return !isBlock(c); } },
      { id: "azlist", t: "abzwList", show: isLaengs },
      { sec: "s_zone" }, { id: "umhType", t: "sel", opts: ["kies", "beton"], struct: 1, show: isStd },
      { id: "umhMat", t: "sel", opts: ["betonkies", "sand", "kies48"], show: function (c) { return isStd(c) && c.umhType === "kies"; } },
      { id: "umhArea", t: "num", hint: "hint_umh", show: isStd }
    ], VERF_FIELDS, [{ sec: "s_belag" }, { id: "belag.mode", t: "sel", opts: ["none", "bit", "humus", "pflaster"], struct: 1 },
      { id: "Lb", t: "num", show: function (c) { return c.belag.mode !== "none"; } }], BELAG_FIELDS.slice(1), [
      { sec: "s_zus" }, { id: "uF", t: "num", half: 1 }, { id: "uP", t: "num", half: 1 }, { id: "uL", t: "num", half: 1 },
      { id: "aB", t: "num", half: 1 }, { id: "aW", t: "num", half: 1 }, { id: "aS", t: "num", half: 1 }, { id: "aR", t: "num", half: 1 },
      { sec: "s_fremd" }, { id: "mods.fremd", t: "chip" },
      { id: "kreuz.on", t: "chk", show: function (c) { return c.mods.fremd; }, struct: 1 },
      { id: "kreuz.richtung", t: "sel", opts: ["laengs", "quer"], show: function (c) { return c.mods.fremd && c.kreuz.on; } },
      { id: "kreuz.n", t: "num", show: function (c) { return c.mods.fremd && c.kreuz.on; } }, { id: "kreuz.len", t: "num", show: function (c) { return c.mods.fremd && c.kreuz.on; } },
      { id: "zores.on", t: "chk", show: function (c) { return c.mods.fremd; }, struct: 1 },
      { id: "zores.zustand", t: "sel", opts: ["abrechen", "betrieb", "nicht"], show: function (c) { return c.mods.fremd && c.zores.on; } },
      { id: "zores.len", t: "num", show: function (c) { return c.mods.fremd && c.zores.on; } },
      { id: "mods.boesch", t: "chip" }, { id: "boeschung.flaeche", t: "num", show: function (c) { return c.mods.boesch; } }, { id: "boeschung.geneigt", t: "chk", show: function (c) { return c.mods.boesch; } }]),
    schacht: [{ sec: "s_schacht" }, { id: "name", t: "text" }, { id: "modus", t: "sel", opts: ["neu", "ersatz", "deckel"], struct: 1 },
      { id: "deckelRichtung", t: "sel", opts: ["hoeher", "tiefer"], show: function (c) { return c.modus === "deckel"; } },
      { id: "deckelFormat", t: "sel", opts: ["rund", "rechteckig"], show: function (c) { return c.modus === "deckel"; } },
      { id: "deckelN", t: "num", show: function (c) { return c.modus === "deckel"; } },
      { id: "einbauort", t: "sel", opts: ["HLS", "HVS", "VS50", "VS49", "SS", "ESS", "GEH", "WIES"], hint: "hint_einbauort", struct: 1, show: notDeckel, locHint: 1 },
      { id: "typ", t: "sel", opts: ["KS80U", "KS80H", "KES100", "KES150", "KES175", "ES300", "PLS1", "PLS2", "PLS3"], hint: "hint_typ", struct: 1, show: notDeckel },
      { id: "n", t: "num", show: notDeckel, labKey: "f_sn" }, { id: "alt", t: "sel", opts: ["guss", "beton", "flaeche"], show: function (c) { return c.modus === "ersatz"; } }
    ].concat(withShow(PIT_FIELDS.slice(0, 2).concat([{ id: "direkt", t: "chk", hint: "hint_direkt" }]), isNeu), withShow(ERSCH_FIELDS, isNeu), [
      { sec: "s_abd", show: notDeckel },
      { id: "shape", t: "sel", opts: ["eckig", "rund"], struct: 1, show: shapeFree },
      { id: "sys", t: "sel", opts: function (c) { var l = locOf(c); return l && l.round === "dsbeton" ? ["beton", "ds", "nivo", "gross130"] : ["nivo", "ds", "gross130"]; }, struct: 1,
        show: function (c) { return notDeckel(c) && curShape(c) === "rund" && !(kindOf(c) === "PLS" && isNeu(c)); } },
      { id: "deckelFormat2", t: "sel", opts: ["90", "180"], hint: "hint_deckelFormat2", struct: 1,
        show: function (c) { var l = locOf(c); return notDeckel(c) && curShape(c) === "eckig" && l && l.cover !== "platte" && !(kindOf(c) === "PLS" && isNeu(c)); } },
      { id: "deckelSockel", t: "sel", opts: ["ohne", "mit"], struct: 1,
        show: function (c) { var l = locOf(c); return notDeckel(c) && curShape(c) === "eckig" && l && l.cover !== "platte" && !(kindOf(c) === "PLS" && isNeu(c)); } },
      { id: "rahmen", t: "cover", hint: "hint_rahmen", show: function (c) { var l = locOf(c); return notDeckel(c) && curShape(c) === "eckig" && (!l || l.cover === "platte") && !(kindOf(c) === "PLS" && isNeu(c)); } },
      { id: "deckel", t: "cover", show: function (c) { var l = locOf(c); return notDeckel(c) && curShape(c) === "eckig" && (!l || l.cover === "platte") && !(kindOf(c) === "PLS" && isNeu(c)); } },
      { id: "spare", t: "num", hint: "hint_spare", show: notDeckel },
      { id: "anschl", t: "num", show: isNeu }, { id: "anDN", t: "sel", opts: ["80", "150"], show: isNeu },
      { id: "beton", t: "num", show: isNeu }, { id: "platten", t: "num", show: isNeu },
      { sec: "s_zone", show: isNeu }].concat(withShow(VERF_FIELDS, isNeu), [{ sec: "s_belag", show: isNeu }], withShow(BELAG_FIELDS, isNeu), [
      { sec: "s_opts" }, { t: "opts" }, { sec: "s_freigabe", show: notDeckel },
      { id: "deviate", t: "chk", show: notDeckel }, { id: "reason", t: "text", show: notDeckel }, { id: "approver", t: "text", show: notDeckel }, { id: "journal", t: "chk", show: notDeckel },
      { t: "printDraw", show: notDeckel }])),
    werkloch: [{ sec: "s_wl" }, { id: "name", t: "text" }, { id: "ts", t: "num", half: 1 }, { id: "bo", t: "num", half: 1 }, { id: "sg", t: "num", half: 1 }, { id: "zs", t: "num", half: 1 },
      { sec: "s_indWL" }, { id: "iL", t: "num", half: 1 }, { id: "iB", t: "num", half: 1 }, { id: "iT", t: "num", half: 1 },
      { sec: "s_psauf" }, { id: "p0", t: "num", half: 1 }, { id: "p1", t: "num", half: 1 }, { id: "p2", t: "num", half: 1 }, { id: "p3", t: "num", half: 1 },
      { sec: "s_graben" }].concat(PIT_FIELDS, ERSCH_FIELDS, [{ sec: "s_zone" }], VERF_FIELDS, [{ sec: "s_belag" }], BELAG_FIELDS),
    fund: [{ sec: "s_fund" }, { id: "name", t: "text" }, { id: "vk", t: "sel", opts: [""].concat(KVE.VK) }, { id: "kvs", t: "sel", opts: [""].concat(KVE.KVS) }]
      .concat(PIT_FIELDS, ERSCH_FIELDS, [{ sec: "s_zone" }], VERF_FIELDS, [{ sec: "s_belag" }], BELAG_FIELDS),
    geb: [{ sec: "s_geb" }, { id: "name", t: "text" }, { id: "n", t: "num", labKey: "f_gn" }, { id: "cm", t: "num" }, { id: "abd", t: "sel", opts: ["keine", "kissen", "hauff"] }],
    belag: [{ sec: "s_wi" }, { id: "name", t: "text" }, { id: "indiv", t: "sel", opts: ["false", "true"], struct: 1, hint: "ksHint" },
      { id: "bk", t: "sel", opts: ["gehweg", "strasse", "kanton"], struct: 1, show: function (c) { return String(c.indiv) !== "true"; } },
      { id: "d", t: "num", show: function (c) { return String(c.indiv) !== "true"; }, rangeHint: 1 },
      { id: "B", t: "num", half: 1, show: function (c) { return String(c.indiv) !== "true"; } }, { id: "L", t: "num", half: 1, labKey: "f_Lbel", show: function (c) { return String(c.indiv) !== "true"; } },
      { id: "wi", t: "sel", opts: function (c) { return ["strasse", "kanton"].indexOf(c.bk) >= 0 ? ["A", "A1", "B", "C", "C1", "C2"] : ["A", "A1", "B"]; }, struct: 1, show: function (c) { return String(c.indiv) !== "true"; } }],
    allg: [{ sec: "s_vor" }, { id: "sond.m3", t: "num", glob: 1 }, { id: "sond.einfHand", t: "chk", glob: 1 }, { id: "wasser.h", t: "num", glob: 1, half: 1 }, { id: "wasser.sumpf", t: "num", glob: 1, half: 1 },
      { sec: "s_be" }, { id: "be.pct", t: "num", glob: 1, hint: "hint_bepct", beHint: 1 },
      { sec: "s_pausch" }, { id: "name", t: "text" }, { id: "km", t: "num", half: 1 }, { id: "ak", t: "num", half: 1 }],
    rohr: [{ sec: "s_rohrTab" }, { id: "name", t: "text" }, { id: "verl", t: "chk" }, { t: "rohrLists" },
      { id: "erd", t: "num", half: 1 }, { id: "warn", t: "num", half: 1 }, { id: "schnur", t: "num", half: 1 }, { id: "kal", t: "num", half: 1 }, { id: "kalDN", t: "sel", opts: ["55", "100", "120", "150"] }],
    hon: [{ sec: "hB" }, { id: "name", t: "text" }, { id: "src", t: "sel", opts: ["lv", "man"], struct: 1, hint: "hint_hB" }, { t: "honB" },
      { sec: "s_hfak" }, { t: "honFak" }, { sec: "s_hph" }, { t: "phases" }, { id: "gl", t: "chk", labKey: "f_hgl", hint: "hint_hgl" },
      { sec: "s_hvar" }, { id: "h", t: "num", half: 1, labKey: "f_hh" }, { id: "nk", t: "num", half: 1, labKey: "f_hnk" }, { t: "honVarHint" }, { t: "honRes" }]
  };

  /* ---------- Zugriff ---------- */
  function getv(o, p) { return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setv(o, p, v) { var a = p.split("."), l = a.pop(); var t = a.reduce(function (x, k) { if (x[k] == null) x[k] = {}; return x[k]; }, o); t[l] = v; }
  function optLabel(id, v) {
    var last = id.split(".").pop();
    if (id === "einbauort") { var l = LOCS.filter(function (x) { return x.id === v; })[0]; if (l) return (l.n[S.lang] || l.n.de) + (l.speed !== "—" ? "  ·  " + l.speed : ""); }
    if ((id === "vk" || id === "kvs") && v === "") return tt("o_none");
    var key = "o_" + last + "_" + v, d = T[S.lang] || T.de;
    return d[key] != null ? d[key] : (T.de[key] != null ? T.de[key] : v);
  }

  /* ---------- Formular ---------- */
  function fieldEl(cfg, f) {
    var wrap = document.createElement("div"); wrap.className = "field" + (f.half ? " half" : "");
    var idn = "f_" + S.tab + "_" + f.id.replace(/\./g, "_");
    var labKey = f.labKey || ("f_" + f.id.replace(/\./g, "_"));
    var lab = document.createElement("label"); lab.setAttribute("for", idn); lab.textContent = tt(labKey);
    var val = getv(cfg, f.id), ctl;
    if (f.t === "chip") {
      wrap.className = "chipfield";
      ctl = document.createElement("button"); ctl.type = "button"; ctl.id = idn; ctl.className = "chip" + (val ? " on" : "");
      ctl.setAttribute("aria-pressed", val ? "true" : "false"); ctl.textContent = (val ? "✓ " : "+ ") + tt(labKey);
      ctl.addEventListener("click", function () { setv(cfg, f.id, !val); onChange(Object.assign({}, f, { struct: 1 }), cfg); });
      wrap.appendChild(ctl); return wrap;
    }
    if (f.t === "chk") {
      wrap.className = "check";
      ctl = document.createElement("input"); ctl.type = "checkbox"; ctl.id = idn; ctl.checked = !!val;
      ctl.addEventListener("change", function () { setv(cfg, f.id, ctl.checked); onChange(f, cfg); });
      wrap.appendChild(ctl); wrap.appendChild(lab);
    } else if (f.t === "sel" || f.t === "cover") {
      ctl = document.createElement("select"); ctl.id = idn;
      var opts = [];
      if (f.t === "cover") { opts.push(["", tt("o_none")]); COVERS.forEach(function (k) { opts.push([k, k.replace("151/", "") + "  " + lvT(k).slice(0, 90) + "  (" + chf(LV[k].ep) + ")"]); }); }
      else { var ol = typeof f.opts === "function" ? f.opts(cfg) : f.opts; ol.forEach(function (v) { opts.push([v, optLabel(f.id, v)]); }); }
      opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (String(val) === o[0]) op.selected = true; ctl.appendChild(op); });
      if (!opts.some(function (o) { return String(val) === o[0]; }) && opts.length) setv(cfg, f.id, opts[0][0]);
      ctl.addEventListener("change", function () { setv(cfg, f.id, ctl.value); onChange(f, cfg); });
      wrap.appendChild(lab); wrap.appendChild(ctl);
    } else {
      ctl = document.createElement("input"); ctl.type = "text"; ctl.id = idn; ctl.value = val == null ? "" : val;
      if (f.t === "num") { ctl.setAttribute("inputmode", "decimal"); ctl.className = "numin"; }
      ctl.addEventListener("input", function () { setv(cfg, f.id, ctl.value); onChange(f, cfg); });
      wrap.appendChild(lab); wrap.appendChild(ctl);
    }
    if (f.hint) { var h = document.createElement("p"); h.className = "hint"; h.textContent = tt(f.hint); wrap.appendChild(h); }
    if (f.locHint) { var l = locOf(cfg); if (l) { var h2 = document.createElement("p"); h2.className = "hint"; h2.textContent = (l.h[S.lang] || l.h.de) + (l.norm !== "—" ? "  (" + l.norm + ")" : ""); wrap.appendChild(h2); } }
    if (f.beHint) { var hb = document.createElement("p"); hb.className = "hint"; hb.id = "beHint"; wrap.appendChild(hb); }
    if (f.rangeHint) { var hr = document.createElement("p"); hr.className = "hint"; var P = S.par, g = cfg.bk === "gehweg" ? [P.gehMin, P.gehMax] : cfg.bk === "strasse" ? [P.strMin, P.strMax] : [P.kanMin, P.kanMax];
      hr.textContent = g[0] + " – " + g[1] + " m"; wrap.appendChild(hr); }
    return wrap;
  }
  function onChange(f, cfg) {
    if (f.id === "einbauort" && cfg) { var l = locOf(cfg); cfg.sys = l ? (l.round === "dsbeton" ? "beton" : l.round) : "nivo"; }
    if (f.id === "typ" && cfg && kindOf(cfg) === "KS") cfg.shape = "rund";
    if (f.id === "name") updateRecLabel();
    save();
    if (f.struct) renderForm(); else refreshFig();
    scheduleResult();
  }
  var resT;
  function scheduleResult() { clearTimeout(resT); resT = setTimeout(renderResult, 120); }

  function listEl(cfg, key, cat, labKey, unit) {
    var wrap = document.createElement("div"); wrap.className = "sublist";
    var lab = document.createElement("p"); lab.className = "sublab"; lab.textContent = tt(labKey); wrap.appendChild(lab);
    cfg[key].forEach(function (row, i) {
      var r = document.createElement("div"); r.className = "subrow";
      var s = document.createElement("select"); s.style.flex = "1"; s.setAttribute("aria-label", tt(labKey));
      [["", tt("sel")]].concat(Object.keys(cat).map(function (k) { return [k, k + (cat[k].l ? "" : " ⚠")]; })).forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (row.typ === o[0]) op.selected = true; s.appendChild(op); });
      s.addEventListener("change", function () { row.typ = s.value; save(); scheduleResult(); });
      var q = document.createElement("input"); q.type = "text"; q.inputMode = "decimal"; q.value = row.q; q.style.width = "70px"; q.setAttribute("aria-label", unit);
      q.addEventListener("input", function () { row.q = q.value; save(); scheduleResult(); });
      var del = document.createElement("button"); del.type = "button"; del.className = "x"; del.textContent = "×"; del.setAttribute("aria-label", tt("del"));
      del.onclick = function () { cfg[key].splice(i, 1); save(); renderForm(); scheduleResult(); };
      r.appendChild(s); r.appendChild(q); r.appendChild(del); wrap.appendChild(r);
    });
    var add = document.createElement("button"); add.type = "button"; add.className = "btn ghost small"; add.textContent = tt("addRow");
    add.onclick = function () { cfg[key].push({ typ: "", q: "" }); save(); renderForm(); };
    wrap.appendChild(add);
    return wrap;
  }
  function blockListEl(cfg) {
    var wrap = document.createElement("div"); wrap.className = "sublist";
    var lab = document.createElement("p"); lab.className = "sublab"; lab.textContent = tt("f_blist"); wrap.appendChild(lab);
    cfg.bloecke.forEach(function (bl, i) {
      var row = document.createElement("div"); row.className = "subrow";
      var sel = function (prop, opts, w) { var s = document.createElement("select"); s.style.width = w || "auto";
        opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (String(bl[prop]) === o[0]) op.selected = true; s.appendChild(op); });
        s.addEventListener("change", function () { bl[prop] = s.value; save(); refreshFig(); scheduleResult(); }); return s; };
      var n = document.createElement("input"); n.type = "text"; n.inputMode = "decimal"; n.value = bl.n; n.style.width = "48px";
      n.addEventListener("input", function () { bl.n = n.value; save(); refreshFig(); scheduleResult(); });
      row.appendChild(sel("dn", [["55", "DN 55"], ["100", "DN 100"], ["120", "DN 120 ⚠"], ["150", "DN 150 ⚠"]], "90px")); row.appendChild(n);
      row.appendChild(sel("lagen", [["1", tt("o_lagen_1")], ["2", tt("o_lagen_2")], ["m", tt("o_lagen_m")]], "110px"));
      var del = document.createElement("button"); del.type = "button"; del.className = "x"; del.textContent = "×"; del.setAttribute("aria-label", tt("del"));
      del.onclick = function () { cfg.bloecke.splice(i, 1); save(); renderForm(); scheduleResult(); };
      row.appendChild(del); wrap.appendChild(row);
    });
    var add = document.createElement("button"); add.type = "button"; add.className = "btn ghost small"; add.textContent = tt("fr_addBlock");
    add.onclick = function () { cfg.bloecke.push({ dn: "55", n: "1", lagen: "1", len: "10" }); save(); renderForm(); scheduleResult(); };
    wrap.appendChild(add);
    var hint = document.createElement("p"); hint.className = "hint"; hint.textContent = tt("hint_block2"); wrap.appendChild(hint);
    return wrap;
  }
  var ABZW_OPTS = ["tstueck8", "tstueck4", "abzwK55", "abzwK100", "abzwKk4", "abzwKk8", "verbind4"];
  function abzwListEl(cfg) {
    var wrap = document.createElement("div"); wrap.className = "sublist";
    var lab = document.createElement("p"); lab.className = "sublab"; lab.textContent = tt("f_azlist"); wrap.appendChild(lab);
    cfg.abzweiger.forEach(function (a, i) {
      var row = document.createElement("div"); row.className = "subrow";
      var s = document.createElement("select"); s.style.flex = "1";
      ABZW_OPTS.forEach(function (o) { var op = document.createElement("option"); op.value = o; op.textContent = tt("o_abzw_" + o); if (a.art === o) op.selected = true; s.appendChild(op); });
      s.addEventListener("change", function () { a.art = s.value; save(); scheduleResult(); });
      var n = document.createElement("input"); n.type = "text"; n.inputMode = "decimal"; n.value = a.n; n.style.width = "48px";
      n.addEventListener("input", function () { a.n = n.value; save(); scheduleResult(); });
      var del = document.createElement("button"); del.type = "button"; del.className = "x"; del.textContent = "×";
      del.onclick = function () { cfg.abzweiger.splice(i, 1); save(); renderForm(); scheduleResult(); };
      row.appendChild(s); row.appendChild(n); row.appendChild(del); wrap.appendChild(row);
    });
    var add = document.createElement("button"); add.type = "button"; add.className = "btn ghost small"; add.textContent = tt("fr_addAbzw");
    add.onclick = function () { cfg.abzweiger.push({ art: "abzwK55", n: "1" }); save(); renderForm(); scheduleResult(); };
    wrap.appendChild(add); return wrap;
  }
  function optsEl(cfg) {
    var wrap = document.createElement("div"); wrap.className = "optgrid";
    OPTS.forEach(function (o) {
      if (["abbrGuss", "abbrBeton", "abbrFlaeche", "nivrollHoch", "ansch80", "ansch150"].indexOf(o.id) >= 0) return;
      var d = document.createElement("div"); d.className = "field half";
      var l = document.createElement("label"); l.textContent = (o.n[S.lang] || o.n.de); l.title = o.npk + "/" + o.pos;
      var sm = document.createElement("span"); sm.className = "ctx"; sm.textContent = o.npk + "/" + o.pos + " · " + chf(o.ep) + " / " + o.unit;
      var i = document.createElement("input"); i.type = "text"; i.inputMode = "decimal"; i.value = (cfg.opts || {})[o.id] || ""; i.className = "numin";
      i.addEventListener("input", function () { cfg.opts = cfg.opts || {}; cfg.opts[o.id] = i.value; save(); scheduleResult(); });
      d.appendChild(l); d.appendChild(sm); d.appendChild(i); wrap.appendChild(d);
    });
    return wrap;
  }
  function phaseList(cfg) { /* feste q-Werte aus PHDEF; Auswahl aus dem Datensatz */
    return PHDEF.map(function (d) { var x = (cfg.ph || []).filter(function (p) { return p.k === d[0]; })[0]; return { k: d[0], q: d[2], on: x ? !!x.on : d[3], lab: d[1] }; });
  }
  function phasesEl(cfg) {
    var wrap = document.createElement("div"); wrap.className = "phs"; var L = ["de", "fr", "it", "en"].indexOf(S.lang);
    phaseList(cfg).forEach(function (p) {
      var c = document.createElement("input"); c.type = "checkbox"; c.checked = p.on; c.setAttribute("aria-label", p.k);
      c.addEventListener("change", function () { cfg.ph = phaseList(cfg).map(function (x) { return { k: x.k, on: x.k === p.k ? c.checked : x.on }; }); save(); refreshHon(); scheduleResult(); });
      var b = document.createElement("b"); b.textContent = p.k;
      var s = document.createElement("span"); s.textContent = p.lab[L] || p.lab[0];
      var q = document.createElement("span"); q.className = "num"; q.textContent = qf(p.q) + " %";
      wrap.appendChild(c); wrap.appendChild(b); wrap.appendChild(s); wrap.appendChild(q);
    });
    var sum = document.createElement("p"); sum.className = "phsum"; sum.id = "qsum"; wrap.appendChild(sum);
    return wrap;
  }
  function honFakEl() {
    var d = document.createElement("div");
    var rows = [["Z1", HONF.Z1, "hx_z"], ["Z2", HONF.Z2, "hx_z"], ["n", HONF.n, "hx_n"], ["r", HONF.r, "hx_r"], ["i", HONF.i, "hx_i"], ["s", HONF.s, "hx_s"]];
    d.innerHTML = '<table class="cost hfak"><tbody>' + rows.map(function (r) { return '<tr><td><b>' + r[0] + '</b><div class="rw">' + esc(tt(r[2])) + '</div></td><td class="num">' + String(r[1]).replace(/^1$/, "1.0") + "</td></tr>"; }).join("") +
      '</tbody></table><p class="hint">' + esc(tt("hx_formula")) + "</p>";
    return d;
  }
  function honCalc(r, netto) {
    var B = r.src === "man" ? num(r.B, 0) : netto, ph = phaseList(r), q0 = ph.reduce(function (s, x) { return s + (x.on ? x.q : 0); }, 0), q = r2(q0 * (r.gl ? 1.1 : 1));
    var h = num(r.h, 0);
    if (!(B > 0) || !(q > 0) || !(h > 0)) return { B: B, q: q, ok: false, noH: !(h > 0) };
    var p = HONF.Z1 + HONF.Z2 / Math.cbrt(B), Tm = r2(B * p / 100 * HONF.n * q / 100 * HONF.r), Tp = r2(Tm * HONF.i), H = r2(Tp * HONF.s * h), NK = r2(H * num(r.nk, 0) / 100);
    return { B: B, p: p, q: q, Tm: Tm, Tp: Tp, H: H, NK: NK, net: r2(H + NK), ok: true };
  }
  var lastOut = null;
  function lvNetto() { return (lastOut || KVE.calc(S, LV)).sum.netto; }
  function honResHtml(r) {
    var h = honCalc(r, lvNetto()), mw = h.ok ? r2(h.net * num(S.mwst, 8.1) / 100) : 0;
    if (!h.ok) return '<p class="hint">⚠ ' + esc(tt(h.noH ? "w_honH" : "w_hon")) + "</p>";
    return '<table class="cost hres"><tbody><tr><td>B</td><td class="num">CHF ' + chf(h.B) + "</td></tr><tr><td>p = Z1 + Z2 / ∛B</td><td class=\"num\">" + h.p.toFixed(4) + " %</td></tr>" +
      "<tr><td>q</td><td class=\"num\">" + qf(h.q) + " %</td></tr><tr><td>" + esc(tt("hTm")) + '</td><td class="num">' + qf(h.Tm) + " h</td></tr>" +
      "<tr><td>Tp = Tm × i</td><td class=\"num\">" + qf(h.Tp) + " h</td></tr><tr><td>" + esc(tt("hHon")) + " H = Tp × s × h (" + qf(h.Tp) + " h × " + chf(num(r.h)) + ')</td><td class="num">CHF ' + chf(h.H) + "</td></tr>" +
      (h.NK ? "<tr><td>" + esc(tt("hNk")) + '</td><td class="num">CHF ' + chf(h.NK) + "</td></tr>" : "") +
      '<tr class="sub"><td>' + esc(tt("hTot")) + '</td><td class="num">CHF ' + chf(h.net) + "</td></tr><tr><td>" + esc(tt("k_mwst")) + '</td><td class="num">CHF ' + chf(mw) + "</td></tr>" +
      '<tr class="sum"><td>' + esc(tt("hTotI")) + '</td><td class="num">CHF ' + chf(r2(h.net + mw)) + "</td></tr></tbody></table>";
  }
  function refreshHon() { var e = $("#honres"); if (e) e.innerHTML = honResHtml(rec()); var r = rec(), q0 = phaseList(r).reduce(function (s, x) { return s + (x.on ? x.q : 0); }, 0), qe = $("#qsum");
    if (qe) qe.textContent = "q = " + qf(q0) + " %" + (r.gl ? " × 1.10 (" + tt("f_hgl").split(" (")[0] + ") = " + qf(r2(q0 * 1.1)) + " %" : ""); refreshFig(); }

  /* Weitere LV-Positionen: alle LV-Positionen, die nicht automatisch entstehen */
  var AUTO = null;
  function autoSet() {
    if (AUTO) return AUTO;
    var src = ($("#kve") || {}).textContent || "";
    AUTO = {};
    (src.match(/\d{3}\/\d{3}\.\d{3}/g) || []).forEach(function (k) { AUTO[k] = 1; });
    ["151/222", "151/223", "151/224", "151/232", "151/234"].forEach(function (b) { ["111", "121", "131", "201", "202", "301", "302", "303"].forEach(function (s) { AUTO[b + "." + s] = 1; }); });
    Object.keys(SP).forEach(function (a) { if (SP[a].posL) { AUTO["151/" + SP[a].posL] = 1; AUTO["151/" + SP[a].posV] = 1; } });
    OPTS.forEach(function (o) { if (["abbrGuss", "abbrBeton", "abbrFlaeche", "nivrollHoch", "ansch80", "ansch150"].indexOf(o.id) < 0) AUTO[o.npk + "/" + o.pos] = 1; });
    COVERS.forEach(function (k) { AUTO[k] = 1; });
    Object.keys(AUTO).forEach(function (k) { if (!LV[k]) delete AUTO[k]; });
    return AUTO;
  }
  function XT(p) {
    var c = p.slice(0, 3), u = p.slice(4, 7);
    if (c === "111") return "allg";
    if (c === "113") return u === "214" ? "graben" : "allg";
    if (c === "117") return u === "223" ? "belag" : u === "228" ? "schacht" : "graben";
    if (c === "151") { if (u === "672") return "geb"; if (u[0] === "6") return "schacht"; if (u === "471") return "graben"; if (u[0] === "4") return "rohr";
      if (["121", "122", "231", "232", "234"].indexOf(u) >= 0) return "werkloch"; return "graben"; }
    if (c === "222") return "graben";
    if (c === "223") return ["921", "926"].indexOf(u) >= 0 ? "schacht" : "belag";
    return "allg";
  }
  function xList(tab) { var A = autoSet(); return Object.keys(LV).sort().filter(function (p) { return !A[p] && XT(p) === tab; }); }
  function xBlockEl(cfg) {
    var list = xList(S.tab); if (!list.length) return null;
    var n = Object.keys(cfg.x || {}).filter(function (p) { return num(cfg.x[p], 0) > 0; }).length;
    var d = document.createElement("details"); d.className = "opts xp"; d.open = !!S.ui.xo[S.tab];
    d.addEventListener("toggle", function () { S.ui.xo[S.tab] = d.open; save(); });
    var sm = document.createElement("summary"); sm.innerHTML = esc(tt("xT")) + ' <span class="tag">' + list.length + " " + esc(tt("xPos")) + (n ? " · " + n + " " + esc(tt("xCnt")) : "") + "</span>"; d.appendChild(sm);
    var b = document.createElement("div"); b.className = "elbody";
    var h = document.createElement("p"); h.className = "hint"; h.textContent = tt("xH"); b.appendChild(h);
    var f = document.createElement("input"); f.type = "search"; f.placeholder = tt("xSearch"); f.setAttribute("aria-label", tt("xSearch")); f.className = "xf"; b.appendChild(f);
    var g = {}; list.forEach(function (p) { var k = p.slice(0, 7); (g[k] = g[k] || []).push(p); });
    Object.keys(g).forEach(function (k) {
      var grp = document.createElement("div"); grp.className = "xg";
      var h4 = document.createElement("p"); h4.className = "sublab"; h4.textContent = k + " · " + lvC(g[k][0]).split(" › ")[0]; grp.appendChild(h4);
      g[k].forEach(function (p) {
        var row = document.createElement("div"); row.className = "xr"; row.dataset.s = (p + " " + lvT(p) + " " + lvC(p) + " " + LV[p].t).toLowerCase();
        row.innerHTML = '<span class="art">' + esc(p) + "</span><span>" + esc(lvT(p)) + '</span><span class="num ctx">' + esc(LV[p].u) + " · " + chf(LV[p].ep) + "</span>";
        var i = document.createElement("input"); i.type = "text"; i.inputMode = "decimal"; i.value = (cfg.x || {})[p] || ""; i.className = "mini" + (i.value ? " filled" : ""); i.setAttribute("aria-label", p);
        i.addEventListener("input", function () { cfg.x = cfg.x || {}; if (num(i.value, 0) > 0) cfg.x[p] = i.value; else delete cfg.x[p]; i.classList.toggle("filled", !!i.value); save(); scheduleResult(); });
        row.appendChild(i); grp.appendChild(row);
      });
      b.appendChild(grp);
    });
    f.addEventListener("input", function () { var q = f.value.trim().toLowerCase();
      b.querySelectorAll(".xr").forEach(function (r) { r.hidden = !!q && r.dataset.s.indexOf(q) < 0; });
      b.querySelectorAll(".xg").forEach(function (gg) { gg.hidden = !gg.querySelector(".xr:not([hidden])"); }); });
    d.appendChild(b); return d;
  }
  /* Individuelle LV-Positionen (KV-Assistent: freie Positionen, EP-Änderung, Position ausserhalb LV) */
  var LVARR = null;
  function lvArr() { return LVARR || (LVARR = Object.keys(LV).sort().map(function (k) { var p = LV[k]; return { k: k, u: p.u, ep: p.ep, h: (k + " " + p.t + " " + p.c + " " + (LV_FR[k] ? LV_FR[k].t + " " + LV_FR[k].c : "") + " " + (CHAPTERS[k.split("/")[0]] || "")).toLowerCase() }; })); }
  function freeEl(cfg) {
    var d = document.createElement("details"); d.className = "opts"; d.open = !!(cfg.free && cfg.free.length) || !!S.ui.freeOpen;
    d.addEventListener("toggle", function () { S.ui.freeOpen = d.open; });
    var sm = document.createElement("summary"); sm.textContent = tt("freeT") + (cfg.free.length ? " (" + cfg.free.length + ")" : ""); d.appendChild(sm);
    var b = document.createElement("div"); b.className = "elbody";
    b.innerHTML = '<div class="field"><label>' + esc(tt("fr_search")) + '</label><input class="frQ" type="text" autocomplete="off"></div><div class="field"><select class="frSel" size="6" aria-label="LV"></select></div>' +
      '<div class="row2"><div class="field"><label>' + esc(tt("fr_qty")) + '</label><input class="frQty" type="text" inputmode="decimal" value="1"></div><div class="field"><label>' + esc(tt("fr_ep")) + '</label><input class="frEp" type="text" inputmode="decimal"></div></div>' +
      '<div class="field"><label>' + esc(tt("fr_note")) + '</label><input class="frNote" type="text"></div><div class="btns" style="margin-top:4px"><button type="button" class="btn frAdd">' + esc(tt("fr_add")) + "</button></div>" +
      '<details class="opts" style="margin-top:12px"><summary>' + esc(tt("fr_custom")) + '</summary><div class="elbody"><div class="field"><label>' + esc(tt("fr_text")) + '</label><input class="fcT" type="text"></div>' +
      '<div class="row2"><div class="field"><label>' + esc(tt("fr_unit")) + '</label><input class="fcU" type="text" value="St"></div><div class="field"><label>' + esc(tt("fr_qty")) + '</label><input class="fcQ" type="text" inputmode="decimal" value="1"></div></div>' +
      '<div class="field"><label>' + esc(tt("fr_ep")) + '</label><input class="fcE" type="text" inputmode="decimal"></div><div class="field"><label>' + esc(tt("fr_reason")) + '</label><input class="fcR" type="text"></div>' +
      '<div class="btns" style="margin-top:4px"><button type="button" class="btn ghost fcAdd">' + esc(tt("fr_addc")) + "</button></div></div></details><div class=\"frList\"></div>";
    var q = $(".frQ", b), sel = $(".frSel", b);
    function search() {
      var toks = q.value.toLowerCase().split(/\s+/).filter(Boolean); sel.innerHTML = "";
      if (!toks.length) { var o = document.createElement("option"); o.disabled = true; o.textContent = tt("fr_pick"); sel.appendChild(o); return; }
      var res = lvArr().filter(function (r) { return toks.every(function (t) { return r.h.indexOf(t) >= 0; }); }).slice(0, 80);
      if (!res.length) { var o2 = document.createElement("option"); o2.disabled = true; o2.textContent = tt("fr_none"); sel.appendChild(o2); }
      res.forEach(function (r) { var o = document.createElement("option"); o.value = r.k; o.textContent = r.k + "  " + lvT(r.k).slice(0, 80) + "  [" + r.u + "  " + chf(r.ep) + "]"; o.title = lvC(r.k); sel.appendChild(o); });
    }
    q.addEventListener("input", search); search();
    sel.addEventListener("change", function () { if (LV[sel.value]) $(".frEp", b).value = LV[sel.value].ep; });
    $(".frAdd", b).onclick = function () { if (!sel.value || !LV[sel.value]) return; cfg.free.push({ key: sel.value, qty: $(".frQty", b).value, ep: $(".frEp", b).value, note: $(".frNote", b).value }); save(); renderForm(); scheduleResult(); };
    $(".fcAdd", b).onclick = function () { if (!$(".fcT", b).value.trim()) return; cfg.free.push({ custom: true, text: $(".fcT", b).value.trim(), unit: $(".fcU", b).value || "St", qty: $(".fcQ", b).value, ep: $(".fcE", b).value, reason: $(".fcR", b).value.trim() }); save(); renderForm(); scheduleResult(); };
    var host = $(".frList", b);
    if (cfg.free.length) {
      var h = '<table><thead><tr><th>' + esc(tt("c_key")) + '</th><th class="num">' + esc(tt("c_qty")) + '</th><th class="num">' + esc(tt("c_ep")) + "</th><th></th></tr></thead><tbody>";
      cfg.free.forEach(function (f, i) {
        var nm = f.custom ? esc(f.text) : esc(f.key) + '<br><span class="ctx">' + esc(LV[f.key] ? lvT(f.key).slice(0, 60) : "") + "</span>";
        h += "<tr><td>" + nm + '</td><td class="num"><input class="mini" data-i="' + i + '" data-f="qty" value="' + esc(f.qty) + '"></td><td class="num"><input class="mini" data-i="' + i + '" data-f="ep" value="' + esc(f.ep) + '"></td><td><button type="button" class="x" data-del="' + i + '" aria-label="' + esc(tt("del")) + '">×</button></td></tr>';
      });
      host.innerHTML = h + "</tbody></table>";
      host.querySelectorAll("input.mini").forEach(function (inp) { inp.addEventListener("input", function () { cfg.free[+inp.dataset.i][inp.dataset.f] = inp.value; save(); scheduleResult(); }); });
      host.querySelectorAll("button.x").forEach(function (bt) { bt.onclick = function () { cfg.free.splice(+bt.dataset.del, 1); save(); renderForm(); scheduleResult(); }; });
    }
    d.appendChild(b); return d;
  }

  function figHtml() {
    if (S.tab === "hon") return honFig(rec());
    if (S.tab === "par") return "";
    return FIG.html(S.tab, rec(), S, tt);
  }
  function honFig(r) {
    var h = honCalc(r, lvNetto()), ph = phaseList(r), x = 20, o = "";
    ph.forEach(function (p) { var w = p.q / 107 * 720;
      o += '<rect x="' + x + '" y="40" width="' + w + '" height="40" fill="' + (p.on ? "var(--navy)" : "var(--rule-strong)") + '" stroke="#fff" stroke-width="2"/>' + (w > 24 ? '<text x="' + (x + w / 2) + '" y="65" class="sl sb" text-anchor="middle" style="fill:#fff">' + p.k + "</text>" : "") + (w > 30 ? FIG.tx(x + w / 2, 98, qf(p.q) + " %", "sm", "middle") : ""); x += w; });
    o += FIG.tx(20, 24, tt("s_hph"), "sl sb");
    o += h.ok ? FIG.tx(20, 134, "Tm = " + qf(Math.round(h.B)) + " × " + h.p.toFixed(4) + "/100 × 1.0 × " + qf(h.q) + "/100 × 1.0 = " + qf(h.Tm) + " h", "sl") +
      FIG.tx(20, 160, "H = Tp × s × h = " + qf(h.Tp) + " h × 1.0 × CHF " + chf(num(r.h)) + " = CHF " + chf(h.H), "sl sb") : FIG.tx(20, 140, "⚠ " + tt(h.noH ? "w_honH" : "w_hon"), "sl");
    return FIG.svg(760, 180, o, tt("ht_hon"));
  }
  function refreshFig() { var e = $("#figsvg"); if (e) { var h = figHtml(); e.innerHTML = h; e.parentNode.hidden = !h; } var be = $("#beHint"); if (be) be.textContent = beHintText(); }
  function beHintText() { var pct = num(S.be.pct, 0), o = lastOut; if (!(pct > 0) || !o) return tt("hint_bepct"); return "113/111.002 – " + tt("beBasis") + " CHF " + chf(o.beBase) + " × " + pct + " % = CHF " + chf(r2(o.beBase * pct / 100)); }

  function renderTabs() {
    var out = lastOut, cnt = {};
    if (out) out.elems.forEach(function (e) { if (e.lines.length) cnt[e.tab] = (cnt[e.tab] || 0) + 1; });
    TABS.forEach(function (t) { if (t === "hon") cnt.hon = S.recs.hon.filter(function (r) { return honCalc(r, out ? out.sum.netto : 0).ok; }).length; });
    $("#tabs").innerHTML = ALLTABS.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t + '" class="tab' + (S.tab === t ? " on" : "") + (t === "hon" || t === "par" ? " sep" : "") + '" aria-selected="' + (S.tab === t) + '">' + esc(tt("tab_" + t)) + (cnt[t] ? '<span class="cnt">' + cnt[t] + "</span>" : "") + "</button>";
    }).join("");
  }
  function updateRecLabel() { var e = $("#recName"); if (e && S.tab !== "par") e.textContent = rec().name || ""; }

  function renderForm() {
    var host = $("#form"); host.innerHTML = "";
    var h = document.createElement("h2"); h.innerHTML = '<span class="num">1</span>' + esc(tt("ht_" + S.tab)); host.appendChild(h);
    if (S.tab === "par") { host.appendChild(parEl()); renderTabs(); return; }
    var list = S.recs[S.tab], i = S.idx[S.tab], cfg = rec();
    var nav = document.createElement("div"); nav.className = "recnav";
    nav.innerHTML = '<button type="button" class="btn ghost small" data-rec="prev" aria-label="◀"' + (i <= 0 ? " disabled" : "") + '>◀</button><span class="recpos">' + esc(tt("rec")) + " <b>" + (i + 1) + "</b> " + esc(tt("of")) + " " + list.length +
      '<br><span class="ctx" id="recName">' + esc(cfg.name) + '</span></span><button type="button" class="btn ghost small" data-rec="next" aria-label="▶"' + (i >= list.length - 1 ? " disabled" : "") + ">▶</button>" +
      '<span class="sp"></span><button type="button" class="btn small" data-rec="new">' + esc(tt("recNew")) + '</button><button type="button" class="btn ghost small" data-rec="dup">' + esc(tt("recDup")) + '</button><button type="button" class="btn ghost small del" data-rec="del">' + esc(tt("recDel")) + "</button>";
    host.appendChild(nav);
    var fig = document.createElement("figure"); fig.className = "fig"; fig.innerHTML = '<div id="figsvg"></div>'; host.appendChild(fig);
    var body = document.createElement("div"); body.className = "elbody formbody";
    var halfBox = null;
    F[S.tab].forEach(function (f) {
      if (f.show && !f.show(cfg)) return;
      var tgt = body;
      if (f.half) { if (!halfBox) { halfBox = document.createElement("div"); halfBox.className = "row2"; body.appendChild(halfBox); } tgt = halfBox; } else halfBox = null;
      if (f.sec) { var h4 = document.createElement("h4"); h4.textContent = tt(f.sec); body.appendChild(h4); return; }
      if (f.t === "blockList") { tgt.appendChild(blockListEl(cfg)); return; }
      if (f.t === "abzwList") { tgt.appendChild(abzwListEl(cfg)); return; }
      if (f.t === "opts") { tgt.appendChild(optsEl(cfg)); return; }
      if (f.t === "phases") { tgt.appendChild(phasesEl(cfg)); return; }
      if (f.t === "honFak") { tgt.appendChild(honFakEl()); return; }
      if (f.t === "honVarHint") { var vh = document.createElement("p"); vh.className = "hint"; vh.textContent = tt("hx_var"); tgt.appendChild(vh); return; }
      if (f.t === "honRes") { var hr = document.createElement("div"); hr.id = "honres"; tgt.appendChild(hr); return; }
      if (f.t === "honB") { if (cfg.src === "man") tgt.appendChild(fieldEl(cfg, { id: "B", t: "num", labKey: "f_hB" })); else { var d = document.createElement("div"); d.className = "field"; d.innerHTML = '<label>B [CHF]</label><input type="text" id="honBv" disabled>'; tgt.appendChild(d); } return; }
      if (f.t === "printDraw") { var pd = document.createElement("div"); pd.className = "check"; pd.innerHTML = '<input type="checkbox" id="fPrintDraw"' + (S.ui.printDraw ? " checked" : "") + '><label for="fPrintDraw">' + esc(tt("f_printDraw")) + "</label>"; tgt.appendChild(pd);
        pd.querySelector("input").addEventListener("change", function () { S.ui.printDraw = this.checked; save(); renderResult(); }); return; }
      if (f.t === "rohrLists") { var ls = document.createElement("div"); ls.className = "lists";
        ls.appendChild(listEl(cfg, "rohre", KVE.ROH, "l_rohre", "m")); ls.appendChild(listEl(cfg, "schn", KVE.ROH, "l_schn", "St"));
        ls.appendChild(listEl(cfg, "boe", KVE.BOE, "l_boe", "St")); ls.appendChild(listEl(cfg, "muf", KVE.MUF, "l_muf", "St")); tgt.appendChild(ls); return; }
      tgt.appendChild(fieldEl(f.glob ? S : cfg, f));
    });
    host.appendChild(body);
    if (S.tab !== "hon") { var xb = xBlockEl(cfg); if (xb) host.appendChild(xb); host.appendChild(freeEl(cfg)); }
    refreshFig(); if (S.tab === "hon") refreshHon();
    renderTabs();
  }
  function parEl() {
    var w = document.createElement("div"); w.className = "elbody formbody";
    var P = S.par, rows = [["dichte", S], ["mwst", S], ["deckG", P], ["deckS", P], ["deckK", P], ["gehMin", P], ["gehMax", P], ["strMin", P], ["strMax", P], ["kanMin", P], ["kanMax", P]];
    var h = '<p class="hint">' + esc(tt("parH")) + '</p><table class="cost ptab"><tbody>' + rows.map(function (r) { return "<tr><td>" + esc(tt("p_" + r[0])) + '</td><td class="num"><input class="mini" data-p="' + r[0] + '" data-o="' + (r[1] === S ? "S" : "P") + '" value="' + esc(r[1][r[0]]) + '"></td></tr>'; }).join("") + "</tbody></table>";
    h += "<h4>" + esc(tt("dimT")) + '</h4><table class="cost ptab"><tbody>';
    [["wl", function (k) { return tt("tab_werkloch") + " " + String(tt("f_" + k)).replace(/ \[.*\]/, ""); }], ["fund", function (k) { return tt("s_fund") + " " + k; }]].forEach(function (g) {
      Object.keys(S.D[g[0]]).forEach(function (k) { h += "<tr><td>" + esc(g[1](k)) + "</td>" + [0, 1, 2].map(function (i) { return '<td class="num"><input class="mini" data-d="' + g[0] + "|" + esc(k) + "|" + i + '" value="' + S.D[g[0]][k][i] + '" aria-label="' + "LBH"[i] + '"></td>'; }).join("") + "</tr>"; });
    });
    h += "</tbody></table>";
    var A = autoSet(), keys = Object.keys(LV), per = {}, auto = 0, no = 0;
    keys.forEach(function (p) { if (A[p]) { auto++; return; } var t = XT(p); if (LVTABS.indexOf(t) >= 0) per[t] = (per[t] || 0) + 1; else no++; });
    h += "<h4>" + esc(tt("covT")) + '</h4><table class="cost ptab"><tbody><tr><td>' + esc(tt("covAll")) + '</td><td class="num">' + keys.length + "</td></tr><tr><td>" + esc(tt("covAuto")) + '</td><td class="num">' + auto + "</td></tr>" +
      LVTABS.filter(function (t) { return per[t]; }).map(function (t) { return "<tr><td>" + esc(tt("covX")) + " " + esc(tt("tab_" + t)) + '</td><td class="num">' + per[t] + "</td></tr>"; }).join("") +
      '<tr class="sum"><td>' + esc(tt("covNo")) + '</td><td class="num">' + no + "</td></tr></tbody></table>";
    var nfr = Object.keys(LV_FR).length;
    h += "<h4>" + esc(tt("langT")) + '</h4><ul class="doclist"><li>' + esc(fill(tt("langFR"), { n: nfr, m: keys.length })) + "</li><li>" + esc(fill(tt("langIT"), { n: Object.keys(LV_IT).length, m: keys.length })) + "</li>" +
      Object.keys(LV_PDIFF).map(function (k) { return "<li>" + esc(tt("pdiffT")) + ": " + esc(k) + " – CHF " + chf(LV_PDIFF[k][0]) + " ↔ " + chf(LV_PDIFF[k][1]) + "</li>"; }).join("") + "</ul>";
    w.innerHTML = h;
    w.querySelectorAll("input[data-p]").forEach(function (i) { i.addEventListener("input", function () { (i.dataset.o === "S" ? S : S.par)[i.dataset.p] = i.value; save(); scheduleResult(); }); });
    w.querySelectorAll("input[data-d]").forEach(function (i) { i.addEventListener("input", function () { var a = i.dataset.d.split("|"); S.D[a[0]][a[1]][+a[2]] = num(i.value, 0); save(); scheduleResult(); }); });
    return w;
  }

  /* ---------- Ergebnis ---------- */
  var ORDER = ["g_bauwerk", "g_belag", "g_deponieBelag", "g_abbruch", "g_aushub", "g_ersch", "g_spries", "g_zone", "g_rohr", "g_verf", "g_deponie", "g_belagNeu", "g_abdeckung", "g_fremd", "g_boesch", "g_zus", "g_weitere", "g_pausch", "g_vorarbeiten", "g_be", "g_frei"];
  function openText(l) { return fill(tt("w_" + l.tk), l.args); }
  function rowHtml(l) {
    if (l.flag === "offen") {
      return '<tr class="open"><td class="art"><span class="badge">' + esc(tt("c_offenTag")) + "</span></td><td>" + esc(l.text || openText(l)) + (l.text ? '<div class="rw">' + esc(openText(l)) + "</div>" : "") +
        (l.rule ? '<div class="rw">' + esc(l.rule) + "</div>" : "") + '</td><td class="num">' + qf(l.qty) + "</td><td>" + esc(l.unit) + '</td><td class="num">—</td><td class="num">—</td></tr>';
    }
    var cls = l.flag === "ausserLV" ? "bad" : l.flag === "epGeaendert" ? "chg" : "", mark = l.flag === "ausserLV" ? " ⚠" : l.flag === "epGeaendert" ? " ✎" : "";
    var txt = /^\d{3}\//.test(l.key) ? lvT(l.key) : l.text, ctx = /^\d{3}\//.test(l.key) ? lvC(l.key) : l.ctx;
    return '<tr class="' + cls + '"><td class="art">' + esc(l.key) + (l.ks === "Belag" ? '<sup class="ks">B</sup>' : "") + "</td><td>" + (ctx ? '<span class="ctx">' + esc(ctx) + "</span>" : "") + "<div>" + esc(txt) + mark + "</div>" +
      (l.rule ? '<div class="rw">' + esc(l.rule) + "</div>" : "") + '</td><td class="num">' + qf(l.qty) + "</td><td>" + esc(l.unit) + '</td><td class="num">' + chf(l.ep) + '</td><td class="num">' + chf(l.total) + "</td></tr>";
  }
  function head() { return "<thead><tr><th>" + esc(tt("c_pos")) + "</th><th>" + esc(tt("c_text")) + '</th><th class="num">' + esc(tt("c_qty")) + "</th><th>" + esc(tt("c_unit")) + '</th><th class="num">' + esc(tt("c_ep")) + '</th><th class="num">' + esc(tt("c_tot")) + "</th></tr></thead>"; }
  function groupedRows(lines) { var h = ""; ORDER.forEach(function (g) { var ls = lines.filter(function (l) { return l.grp === g; }); if (!ls.length) return; h += '<tr class="grp"><td colspan="6">' + esc(tt(g)) + "</td></tr>" + ls.map(rowHtml).join(""); }); return h; }
  function blk(id, title, sum, inner, cur, go) {
    var closed = cur ? false : S.ui.closed[id];
    return '<div class="elres' + (closed ? " closed" : "") + (cur ? " cur" : "") + '" data-id="' + id + '"><button type="button" class="elhead" data-toggle="' + id + '" aria-expanded="' + (closed ? "false" : "true") + '"><span class="elt">' + esc(title) + "</span>" +
      (sum != null ? '<b class="els">' + chf(sum) + "</b>" : "") + "</button>" + '<div class="elres-body">' + (go && !cur ? '<p class="gorow no-print"><a href="#" data-go="' + go + '">✎ ' + esc(tt("recEdit")) + "</a></p>" : "") + inner + "</div></div>";
  }
  function foot(sum) { return '<tfoot><tr><td colspan="5">' + esc(tt("k_sumEl")) + '</td><td class="num">' + chf(sum) + "</td></tr></tfoot>"; }
  function schachtExtra(e) {
    var g = e.geo || {}, c = S.recs.schacht[e.idx], h = "";
    if (!g.ev) return "";
    var lv = g.ev.level, stt = { ok: "sa_ok", info: "sa_ok", amber: "sa_amber", stop: "sa_stop" }[lv];
    h += '<div class="status ' + (lv === "stop" ? "stop" : lv === "amber" ? "amber" : "ok") + ' sa"><p class="stitle">' + esc(tt("h_sa")) + ": " + esc(tt(stt)) + "</p>";
    var rs = g.ev.ids.map(function (id) { return tt("w_" + id); }); if (rs.length) h += "<ul>" + rs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    var ts = TS[S.lang] || TS.de; h += '<p class="action">' + esc(lv === "stop" ? ts.actionStop : lv === "amber" ? ts.actionAmber : ts.actionOk) + "</p></div>";
    var rows = (g.rows || []).filter(function (rw) { return SP[rw[0]]; });
    if (rows.length) {
      var kg = 0, spare = num(c.spare, 0);
      h += "<h5>" + esc(ts.hStueck) + '</h5><table class="stk"><thead><tr><th>' + esc(ts.thArt) + "</th><th>" + esc(ts.thBez) + '</th><th class="num">' + esc(ts.thStk) + '</th><th class="num">' + esc(ts.thTot) + '</th><th class="num">' + esc(ts.thKg) + '</th><th class="no-print">HGC</th></tr></thead><tbody>';
      rows.forEach(function (rw) { var p = SP[rw[0]], tot = rw[0] === "137.787.8" ? spare : rw[1] * g.n, w = p.kg != null ? p.kg * tot : null; if (w) kg += w;
        h += '<tr><td class="art">' + esc(rw[0]) + "</td><td>" + esc(p.n[S.lang] || p.n.de) + (g.incl && !g.ersatz ? '<div class="rw">' + esc(ts.kIncl) + "</div>" : "") + '</td><td class="num">' + (rw[0] === "137.787.8" ? "—" : rw[1]) + '</td><td class="num">' + tot + '</td><td class="num">' + (w != null ? qf(w) + " kg" : "—") + '</td><td class="no-print"><a class="hgc" href="' + esc(hgcLink(rw[0])) + '" target="_blank" rel="noopener">' + esc(ts.hgcOpen) + "</a></td></tr>"; });
      h += '</tbody><tfoot><tr><td colspan="4">' + esc(ts.sumWeight) + '</td><td class="num">' + qf(kg) + ' kg</td><td class="no-print"></td></tr></tfoot></table>';
      if (rows.some(function (rw) { return rw[1] === 2; })) h += '<p class="note">' + esc(ts.note2x) + "</p>";
      h += '<p class="note">' + esc(ts.noteWeights) + "</p>";
    }
    if (g.mass && g.mass.length) {
      h += "<h5>" + esc(ts.hMassen) + '</h5><table class="stk"><thead><tr><th>' + esc(ts.thPos) + '</th><th>' + esc(ts.thUnit) + '</th><th class="num">' + esc(ts.thPer) + '</th><th class="num">' + esc(ts.thTot2) + "</th></tr></thead><tbody>" +
        g.mass.map(function (m) { return "<tr><td>" + esc(ts[m[0]] || m[0]) + "</td><td>" + esc(m[1]) + '</td><td class="num">' + qf(m[3]) + '</td><td class="num">' + qf(r2(m[2])) + "</td></tr>"; }).join("") + '</tbody></table><p class="note">' + esc(ts.noteMass) + "</p>";
    }
    if (lv === "stop" || lv === "amber" || c.deviate) {
      h += '<div class="freigabe"><h3>' + esc(ts.fgTitle) + '</h3><table><tbody><tr><th>' + esc(ts.fgReason) + "</th><td>" + esc(c.reason || ts.fgOpen) + "</td></tr><tr><th>" + esc(ts.fgApprover) + "</th><td>" + esc(c.approver || ts.fgOpen) + "</td></tr><tr><th>" + esc(ts.fgJournal) + "</th><td>" + esc(c.journal ? ts.fgYes : ts.fgNo) + '</td></tr></tbody></table><div class="sigline"><div>' + esc(ts.fgSig1) + "</div><div>" + esc(ts.fgSig2) + "</div></div></div>";
    }
    if (S.ui.printDraw) {
      var figs = [];
      if (!g.ersatz && SIMG["PLAN_" + g.shaft]) figs.push(["PLAN_" + g.shaft, ts.planLabel + " " + SHAFTS[g.shaft].plan, SHAFTS[g.shaft].n[S.lang] || SHAFTS[g.shaft].n.de]);
      rows.forEach(function (rw) { if (SIMG[rw[0]]) figs.push([rw[0], rw[0], (SP[rw[0]].n[S.lang] || SP[rw[0]].n.de).split(",")[0]]); });
      if (figs.length) h += "<h5>" + esc(ts.hFigs) + '</h5><div class="figs">' + figs.map(function (f) { return '<figure><img src="' + SIMG[f[0]] + '" alt="' + esc(f[1]) + '" loading="lazy" data-lb="' + esc(f[0]) + '"><figcaption><b>' + esc(f[1]) + "</b> · " + esc(f[2]) + "</figcaption></figure>"; }).join("") + "</div>";
    }
    return h;
  }
  function schachtDocs() {
    var ts = TS[S.lang] || TS.de, sch = S.recs.schacht.filter(function (c) { return c.modus !== "deckel" && (num(c.n, 0) > 0); });
    if (!sch.length) return "";
    var docHref = function (f) { return f ? (DOC_BASE ? DOC_BASE + f : DMS_URL) : null; }, li = function (l, f) { var hr = docHref(f); return "<li>" + (hr ? '<a href="' + esc(hr) + '" target="_blank" rel="noopener">' + esc(l) + "</a>" : esc(l)) + "</li>"; };
    var seen = {}, h = "";
    sch.forEach(function (c) { var k = KVE.SCHACHT[c.typ]; if (!k) return; var sh = k.kind === "KS" ? "KS" : k.kind === "PLS" ? "PLS" : k.kind === "ES" ? "ES" : "KES"; if (!seen[sh]) { seen[sh] = 1; h += li(ts.docPlan + " " + SHAFTS[sh].plan + " – " + (SHAFTS[sh].n[S.lang] || SHAFTS[sh].n.de), SHAFTS[sh].docFile); } });
    Object.keys(SP).forEach(function (a) { if (SP[a].doc && lastOut && lastOut.elems.some(function (e) { return e.tab === "schacht" && e.geo && (e.geo.rows || []).some(function (r) { return r[0] === a; }); })) h += li(ts.docDraw + " " + a + " – " + (SP[a].n[S.lang] || SP[a].n.de), SP[a].doc); });
    h += li(ts.docSchema, "Auswahlschema_Schachtbau_und_Abdeckungen_de_fr.pdf") + li(ts.docPcm, "PcM_Info_Schaechte_als_Arbeitsplatz.pdf") + li(ts.docHandbuch, "Handbuch_unter-_und_oberirdischer_Netzbau.docx");
    h += '<li><a href="' + esc(DMS_URL) + '" target="_blank" rel="noopener">' + esc(ts.docDms) + '</a></li><li class="no-print"><a href="' + esc(HGC_CATEGORY) + '" target="_blank" rel="noopener">' + esc(ts.hgcCat) + "</a></li>";
    var refs = (S.lang === "fr" ? ["SCHEMA_FR", "TAB_FR"] : ["SCHEMA_DE", "TAB_DE"]).filter(function (k) { return SIMG[k]; });
    return '<details class="ref no-summary"><summary>' + esc(ts.hDocs) + '</summary><ul class="doclist" style="padding:6px 14px">' + h + '</ul><p class="note" style="margin:6px 14px 12px">' + esc(ts.docNote) + "</p></details>" +
      '<details class="ref no-summary no-print"><summary>' + esc(ts.hRef) + '</summary><div class="figs">' + refs.map(function (k) { return '<figure><img src="' + SIMG[k] + '" alt="' + esc(ts.hRef) + '" loading="lazy" data-lb="' + k + '"></figure>'; }).join("") + "</div></details>" +
      '<details class="ref no-summary"><summary>' + esc(ts.hArg) + '</summary><ul style="font-size:13.5px;padding:8px 14px 12px 32px;margin:0">' + ts.args.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></details>" +
      '<details class="ref no-summary no-print"><summary>' + esc(ts.hGloss) + '</summary><dl class="gloss">' + ts.gloss.map(function (g) { return "<dt>" + esc(g[0]) + "</dt><dd>" + esc(g[1]) + "</dd>"; }).join("") + "</dl></details>";
  }

  function renderResult() {
    var out = KVE.calc(S, LV); lastOut = out;
    var html = "", stop = out.warn.some(function (w) { return w.sev === "stop"; }), amber = out.warn.some(function (w) { return w.sev === "amber"; });
    var n = 0; out.elems.forEach(function (e) { n += e.lines.length; }); n += out.vor.lines.length + out.be.lines.length;
    var st = n === 0 ? "empty" : stop ? "stop" : amber ? "amber" : "ok";
    html += '<div class="status no-summary ' + (st === "stop" ? "stop" : st === "amber" ? "amber" : "ok") + '"><p class="stitle">' + esc(tt("st_" + st)) + "</p>";
    if (out.nOffen) html += '<p class="offennote">' + esc(fill(tt("x_nOffen"), { n: out.nOffen })) + "</p>";
    var top = out.warn.filter(function (w) { return w.sev !== "info"; }).slice(0, 4);
    if (top.length) html += "<ul>" + top.map(function (w) { return "<li>" + esc(fill(tt("w_" + w.id), w.args)) + "</li>"; }).join("") + "</ul>";
    html += "</div>";
    if (n) {
      html += '<div class="no-summary"><h3>' + esc(tt("h_aufst")) + '</h3><div class="collrow no-print"><button type="button" class="btn ghost" data-act="collapse">' + esc(tt("btnCollapse")) + '</button><button type="button" class="btn ghost" data-act="expand">' + esc(tt("btnExpand")) + "</button></div>";
      out.elems.forEach(function (e) {
        var cur = S.tab === e.tab && S.idx[e.tab] === e.idx, extra = e.tab === "schacht" ? schachtExtra(e) : "";
        if (!e.lines.length && !extra) return;
        var bal = e.bal && e.bal.length ? '<details class="opts bal" open><summary>' + esc(tt("h_bal")) + "</summary><table><tbody>" + e.bal.map(function (b) { return "<tr><td>" + esc(tt(b.id)) + '</td><td class="num">' + qf(r2(b.v)) + " " + esc(b.unit) + "</td></tr>"; }).join("") + "</tbody></table></details>" : "";
        html += blk(e.id, tt("tab_" + e.tab) + " · " + e.name, e.sum, extra + bal + (e.lines.length ? "<table>" + head() + "<tbody>" + groupedRows(e.lines) + "</tbody>" + foot(e.sum) + "</table>" : ""), cur, e.tab + ":" + e.idx);
      });
      if (out.vor.lines.length) html += blk("vor", tt("h_vorarbeiten"), out.vor.sum, "<table>" + head() + "<tbody>" + out.vor.lines.map(rowHtml).join("") + "</tbody>" + foot(out.vor.sum) + "</table>", false, "allg:" + S.idx.allg);
      if (out.be.lines.length) html += blk("be", tt("h_be"), out.be.sum, "<table>" + head() + "<tbody>" + out.be.lines.map(rowHtml).join("") + "</tbody>" + foot(out.be.sum) + "</table>", false, "allg:" + S.idx.allg);
      html += schachtDocs();
      html += "</div>";
      var z = "<table>" + head() + "<tbody>", curCh = "";
      out.summary.forEach(function (l) {
        var ch = l.key === "—" ? "—" : l.key === "OFFEN" ? "OFFEN" : l.key === "Pauschal" ? "P" : l.key.split("/")[0];
        if (ch !== curCh) { curCh = ch; z += '<tr class="grp"><td colspan="6">' + (ch === "—" ? esc(tt("g_frei")) : ch === "OFFEN" ? esc(tt("c_offenTag")) : ch === "P" ? esc(tt("g_pausch")) : "NPK " + ch + " · " + esc(CHAPTERS[ch] || "")) + "</td></tr>"; }
        z += rowHtml(l);
      });
      html += '<div class="no-summary">' + blk("zus", tt("h_zus"), out.sum.zwischen, z + "</tbody></table>") + "</div>";
      var chapTot = {}, chapOrder = [];
      out.summary.forEach(function (l) { var ch = l.key === "—" ? tt("g_frei") : l.key === "OFFEN" ? null : l.key === "Pauschal" ? tt("g_pausch") : "NPK " + l.key.split("/")[0] + " · " + (CHAPTERS[l.key.split("/")[0]] || ""); if (!ch) return;
        if (!(ch in chapTot)) { chapTot[ch] = 0; chapOrder.push(ch); } chapTot[ch] = r2(chapTot[ch] + l.total); });
      html += '<div class="summary-only"><h3>' + esc(tt("h_zusKurz")) + '</h3><table class="cost"><tbody>' + chapOrder.map(function (ch) { return "<tr><td>" + esc(ch) + '</td><td class="num">' + chf(chapTot[ch]) + "</td></tr>"; }).join("") +
        '<tr class="sub"><td>' + esc(tt("k_zw")) + '</td><td class="num">' + chf(out.sum.zwischen) + "</td></tr></tbody></table></div>";
      html += '<div class="no-summary"><h3>' + esc(tt("h_vollst")) + "</h3><ul class='vollst'>" + out.complete.map(function (it) { var lab = { ok: "v_ok", open: "v_open", na: "v_na", third: "v_third", nopos: "v_nopos" }[it.st];
        return '<li class="v-' + it.st + '"><span class="vname">' + esc(tt("c_" + it.id)) + '</span><span class="vst">' + esc(tt(lab)) + "</span></li>"; }).join("") + "</ul>";
      var sr = KVE.sens(S, LV); lastOut = KVE.calc(S, LV); out = lastOut;
      if (sr.length) html += "<h3>" + esc(tt("h_annahmen")) + "</h3><table class='sens'><thead><tr><th>" + esc(tt("x_elem")) + "</th><th>" + esc(tt("x_ann")) + "</th><th>" + esc(tt("x_statt")) + '</th><th class="num">' + esc(tt("x_wirkung")) + "</th></tr></thead><tbody>" +
        sr.map(function (r) { var d = T[S.lang] || T.de, val = d[r.val] != null ? tt(r.val) : r.val, alt = d[r.alt] != null ? tt(r.alt) : r.alt;
          return "<tr><td>" + esc(r.el) + "</td><td>" + esc(tt(r.id)) + ": " + esc(val) + "</td><td>" + esc(alt) + '</td><td class="num">' + (r.d >= 0 ? "+ " : "− ") + chf(Math.abs(r.d)) + "</td></tr>"; }).join("") + "</tbody></table>";
      html += "</div>";
      var s = out.sum;
      html += "<h3>" + esc(tt("h_kosten")) + '</h3><table class="cost"><tbody><tr><td>' + esc(tt("k_zw")) + '</td><td class="num">' + chf(s.zwischen) + "</td></tr>" +
        (s.belag ? '<tr class="sub"><td>' + esc(tt("k_belagKS")) + '</td><td class="num">' + chf(s.belag) + "</td></tr>" : "") +
        "<tr><td>" + esc(fill(tt("k_rabatt"), { s: s.stufe, p: s.pct })) + '</td><td class="num">− ' + chf(s.rabatt) + "</td></tr><tr><td>" + esc(tt("k_nach")) + '</td><td class="num">' + chf(s.nachRabatt) + "</td></tr>" +
        "<tr><td>" + esc(tt("k_inst")) + '</td><td class="num">+ ' + chf(s.inst) + '</td></tr><tr class="sub"><td>' + esc(tt("k_netto")) + '</td><td class="num">' + chf(s.netto) + "</td></tr>" +
        "<tr><td>" + esc(tt("k_mwst")) + " " + qf(s.mwSatz * 100) + ' %</td><td class="num">' + chf(s.mwst) + '</td></tr><tr class="sum"><td>' + esc(tt("k_brutto")) + '</td><td class="num">' + chf(s.brutto) + "</td></tr></tbody></table>";
    }
    var hon = S.recs.hon.map(function (r) { return [r, honCalc(r, out.sum.netto)]; }).filter(function (x) { return x[1].ok; });
    if (hon.length) {
      var hn = r2(hon.reduce(function (a, x) { return a + x[1].net; }, 0)), hm = r2(hn * num(S.mwst, 8.1) / 100);
      html += "<h3>" + esc(tt("hSum")) + '</h3><table class="cost"><tbody>' + hon.map(function (x) { return "<tr><td>" + esc(x[0].name) + '<div class="rw">' + qf(x[1].Tp) + " h (Tp) × CHF " + chf(num(x[0].h)) + (x[1].NK ? " + " + esc(tt("hNk")) + " " + chf(x[1].NK) : "") + " · B = " + chf(x[1].B) + '</div></td><td class="num">' + chf(x[1].net) + "</td></tr>"; }).join("") +
        '<tr class="sub"><td>' + esc(tt("hTot")) + '</td><td class="num">' + chf(hn) + "</td></tr><tr><td>" + esc(tt("k_mwst")) + '</td><td class="num">' + chf(hm) + '</td></tr><tr><td>' + esc(tt("hTotI")) + '</td><td class="num">' + chf(r2(hn + hm)) + "</td></tr>" +
        '<tr class="sum"><td>' + esc(tt("gTot")) + '</td><td class="num">' + chf(r2(out.sum.brutto + hn + hm)) + "</td></tr></tbody></table>";
    }
    var ws = out.warn.slice().sort(function (a, b) { var r = { stop: 0, amber: 1, info: 2 }; return r[a.sev] - r[b.sev]; });
    if (ws.length) html += '<div class="no-summary"><h3>' + esc(tt("h_warn")) + '</h3><ul class="warns">' + ws.map(function (w) { return '<li class="' + w.sev + '"><b>' + esc(w.tab ? tt("tab_" + w.tab) + " · " + w.el : (w.el || "")) + "</b> · " + esc(fill(tt("w_" + w.id), w.args)) + "</li>"; }).join("") + "</ul></div>";
    html += '<details class="ref no-summary"><summary>' + esc(tt("h_grund")) + "</summary><ul class='doclist' style='padding:6px 14px'>" + (T[S.lang] || T.de).g_list.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "<li>" + esc(tt("g_lvOnlyDE")) + "</li></ul></details>";
    html += '<div class="sigline print-only"><div>' + esc(tt("sigA")) + "</div><div>" + esc(tt("sigB")) + "</div></div>";
    $("#result").innerHTML = html;
    renderTabs(); refreshFig(); if (S.tab === "hon") refreshHon();
    var hb = $("#honBv"); if (hb) hb.value = chf(out.sum.netto);
    window.__OUT = out;
  }

  /* ---------- Excel ---------- */
  var XL = XLSXW.ST;
  function sheetName(s, used) { var n = String(s).replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31).trim(), b = n, i = 2; while (used.indexOf(n) >= 0) n = b.slice(0, 28) + " " + (i++); used.push(n); return n; }
  function qn(n) { return "'" + String(n).replace(/'/g, "''") + "'"; }
  function xlsxSheets(out) {
    var used = [], nm = { k: sheetName(tt("h_kosten"), used), a: sheetName(tt("h_aufst"), used), z: sheetName(tt("h_zus"), used), b: sheetName(tt("h_bal"), used), w: sheetName(tt("h_warn"), used), g: sheetName(tt("h_grund"), used) };
    var fillRow = function (n, st, first) { var r = [{ v: first, s: st }]; for (var i = 1; i < n; i++) r.push({ v: " ", s: st }); return r; };
    var hdr = function (arr) { return arr.map(function (t) { return { v: t, s: XL.hdr }; }); };
    var txt = function (l) { var t = /^\d{3}\//.test(l.key) ? lvT(l.key) : l.text, c = /^\d{3}\//.test(l.key) ? lvC(l.key) : l.ctx; return (c ? c + " › " : "") + t; };
    var A = [hdr([tt("c_pos"), tt("c_text"), tt("c_qty"), tt("c_unit"), tt("c_ep"), tt("c_tot")])], sumRefs = [];
    function lineText(l) { return l.flag === "offen" ? (l.text ? l.text + " – " : "") + openText(l) + (l.rule ? "  ·  " + l.rule : "") : txt(l) + (l.rule ? "  ·  " + l.rule : ""); }
    function lineRow(l) {
      if (l.flag === "offen") return [{ v: tt("c_offenTag"), s: XL.stop }, { v: lineText(l), s: XL.warnA }, { v: l.qty, s: XL.num }, { v: l.unit }, { v: "—", s: XL.grey }, { v: "—", s: XL.grey }];
      var r = A.length + 1, bad = l.flag === "ausserLV", chg = l.flag === "epGeaendert";
      return [{ v: l.key + (l.ks === "Belag" ? " B" : ""), s: XL.code }, { v: lineText(l) + (bad ? " ⚠" : chg ? " ✎" : ""), s: bad ? XL.red : chg ? XL.amber : XL.wrap },
        { v: l.qty, s: bad ? XL.numRed : chg ? XL.numAmber : XL.num }, { v: l.unit }, { v: l.ep, s: bad ? XL.numRed : chg ? XL.numAmber : XL.num },
        { v: l.total, s: bad ? XL.numRed : chg ? XL.numAmber : XL.num, f: "ROUND(C" + r + "*E" + r + ",2)" }];
    }
    function block(title, lines, sum) {
      A.push(fillRow(6, XL.elTitle, title)); var first = A.length + 1;
      ORDER.forEach(function (g) { var ls = lines.filter(function (l) { return l.grp === g; }); if (!ls.length) return; A.push(fillRow(6, XL.grp, tt(g))); ls.forEach(function (l) { A.push(lineRow(l)); }); });
      var last = A.length;
      A.push([{ v: tt("k_sumEl"), s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: sum, s: XL.sum, f: "SUM(F" + first + ":F" + last + ")" }]);
      sumRefs.push(qn(nm.a) + "!F" + A.length); A.push([]);
    }
    out.elems.forEach(function (e) { if (e.lines.length) block(tt("tab_" + e.tab) + " · " + e.name, e.lines, e.sum); });
    if (out.vor.lines.length) block(tt("h_vorarbeiten"), out.vor.lines, out.vor.sum);
    if (out.be.lines.length) block(tt("h_be"), out.be.lines, out.be.sum);
    var aLast = A.length, aRng = function (c) { return qn(nm.a) + "!$" + c + "$2:$" + c + "$" + aLast; };
    var K = [[{ v: tt("title"), s: XL.title }], [{ v: tt("sub"), s: XL.grey }], []], k = S.kopf, kv = function (lab, v) { K.push([{ v: lab, s: XL.grey }, { v: v == null ? "" : v, s: XL.bold }]); };
    kv(tt("projekt"), k.projekt); kv(tt("sap"), k.sap); kv(tt("bem"), k.bem); kv(tt("ort"), k.ort); kv(tt("bearb"), k.bearb); kv(tt("datum"), k.datum); kv(tt("rolle"), tt("r_" + k.rolle));
    kv(tt("dv_nr"), k.devisNr); kv(tt("dv_lieferant"), k.lieferant); kv(tt("dv_vertrag"), k.vertrag); kv(tt("dv_termin"), k.termin); kv(tt("dv_belagLief"), k.belagLief ? tt("dv_ja") : tt("dv_nein")); kv(tt("x_lvver"), "V1.1 · 10.07.2026");
    K.push([]); K.push(hdr([tt("h_kosten"), "CHF"]));
    var c0 = K.length + 1, s1 = c0 + 13, s5 = s1 + 4, sm = out.sum;
    var row = function (lab, v, f, st, ls) { K.push([{ v: lab, s: ls || XL.def }, { v: v, s: st || XL.num, f: f }]); };
    row(tt("k_zw"), sm.zwischen, sumRefs.length ? sumRefs.join("+") : "0");
    row(tt("x_stufe"), sm.stufe, "1+(B" + c0 + ">A" + s1 + ")+(B" + c0 + ">A" + (s1 + 1) + ")+(B" + c0 + ">A" + (s1 + 2) + ")+(B" + c0 + ">A" + (s1 + 3) + ")", XL.int);
    row(tt("x_pct"), sm.pct, "INDEX(B" + s1 + ":B" + s5 + ",B" + (c0 + 1) + ")", XL.pct);
    row(tt("x_rabatt"), sm.rabatt, "ROUND(B" + c0 + "*B" + (c0 + 2) + "/100,2)");
    row(tt("k_nach"), sm.nachRabatt, "B" + c0 + "-B" + (c0 + 3));
    row(tt("k_inst"), sm.inst, "IF(B" + c0 + ">0,INDEX(C" + s1 + ":C" + s5 + ",B" + (c0 + 1) + "),0)");
    row(tt("k_netto"), sm.netto, "B" + (c0 + 4) + "+B" + (c0 + 5), XL.sum, XL.sumLbl);
    K.push([{ v: tt("x_mwstsatz") }, { v: r2(sm.mwSatz * 100), s: XL.pct }]);
    row(tt("k_mwst"), sm.mwst, "ROUND(B" + (c0 + 6) + "*B" + (c0 + 7) + "/100,2)");
    row(tt("k_brutto"), sm.brutto, "B" + (c0 + 6) + "+B" + (c0 + 8), XL.sumFill, XL.sumLbl);
    K.push([]); K.push([{ v: tt("x_staffel"), s: XL.bold }]); K.push(hdr([tt("x_bis"), tt("x_pct"), tt("x_inst")]));
    KVE.STAFFEL.forEach(function (t, i) { K.push([i < 4 ? { v: t.bis, s: XL.num } : { v: "> " + KVE.STAFFEL[3].bis, s: XL.def }, { v: t.pct, s: XL.pct }, { v: t.inst, s: XL.num }]); });
    var Z = [hdr([tt("c_pos"), tt("c_text"), tt("c_qty"), tt("c_unit"), tt("c_ep"), tt("c_tot")])], subs = [], curCh = null, first = 0, subTot = 0;
    function closeCh() { if (curCh === null) return; var last = Z.length; Z.push([{ v: tt("k_sumEl"), s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: subTot, s: XL.sum, f: "SUM(F" + first + ":F" + last + ")" }]); subs.push({ ref: "F" + Z.length, v: subTot }); }
    out.summary.forEach(function (l) {
      var ch = l.key === "—" ? "—" : l.key === "OFFEN" ? "OFFEN" : l.key === "Pauschal" ? "P" : l.key.split("/")[0];
      if (ch !== curCh) { closeCh(); curCh = ch; subTot = 0; Z.push(fillRow(6, XL.grp, ch === "—" ? tt("g_frei") : ch === "OFFEN" ? tt("c_offenTag") : ch === "P" ? tt("g_pausch") : "NPK " + ch + " · " + (CHAPTERS[ch] || ""))); first = Z.length + 1; }
      if (l.flag === "offen") { Z.push([{ v: tt("c_offenTag"), s: XL.stop }, { v: lineText(l), s: XL.warnA }, { v: l.qty, s: XL.num }, { v: l.unit }, { v: "—", s: XL.grey }, { v: "—", s: XL.grey }]); return; }
      var bad = l.flag === "ausserLV", chg = l.flag === "epGeaendert", st = bad ? XL.numRed : chg ? XL.numAmber : XL.num;
      Z.push([{ v: l.key, s: XL.code }, { v: lineText(l), s: bad ? XL.red : chg ? XL.amber : XL.wrap }, { v: l.qty, s: st }, { v: l.unit }, { v: l.ep, s: st }, { v: l.total, s: st }]);
      subTot = r2(subTot + l.total);
    });
    closeCh();
    if (subs.length) { var tot = subs.reduce(function (a, b) { return r2(a + b.v); }, 0), tr = Z.length + 2;
      Z.push([]); Z.push([{ v: tt("x_summeZus"), s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: " ", s: XL.sumLbl }, { v: tot, s: XL.sumFill, f: subs.map(function (x) { return x.ref; }).join("+") }]);
      Z.push([{ v: tt("x_kontrolle"), s: XL.grey }, "", "", "", "", { v: r2(tot - sm.zwischen), s: XL.num, f: "F" + tr + "-" + qn(nm.k) + "!B" + c0 }]); }
    var B = []; out.elems.forEach(function (e) { if (!e.lines.length || !e.bal.length) return; B.push(fillRow(3, XL.elTitle, tt("tab_" + e.tab) + " · " + e.name)); e.bal.forEach(function (b) { B.push([{ v: tt(b.id) }, { v: r2(b.v), s: XL.num }, { v: b.unit }]); }); B.push([]); });
    var W = [hdr([tt("x_elem"), tt("x_sev"), tt("x_msg")])];
    if (!out.warn.length) W.push([{ v: tt("st_ok"), s: XL.info }]);
    out.warn.slice().sort(function (a, b) { var r = { stop: 0, amber: 1, info: 2 }; return r[a.sev] - r[b.sev]; }).forEach(function (w) { var st = w.sev === "stop" ? XL.stop : w.sev === "amber" ? XL.warnA : XL.info;
      W.push([{ v: (w.tab ? tt("tab_" + w.tab) + " · " : "") + (w.el || ""), s: st }, { v: tt("sev_" + w.sev), s: st }, { v: fill(tt("w_" + w.id), w.args), s: st }]); });
    var V = [hdr([tt("x_elem"), tt("x_sev")])], vlab = { ok: "v_ok", open: "v_open", na: "v_na", third: "v_third", nopos: "v_nopos" }, vst = { ok: XL.info, open: XL.warnA, na: XL.grey, third: XL.grey, nopos: XL.warnA };
    out.complete.forEach(function (it) { V.push([{ v: tt("c_" + it.id), s: vst[it.st] }, { v: tt(vlab[it.st]), s: vst[it.st] }]); });
    var N = [hdr([tt("x_elem"), tt("x_ann"), tt("x_statt"), tt("x_wirkung")])];
    KVE.sens(S, LV).forEach(function (r) { var d = T[S.lang] || T.de, val = d[r.val] != null ? tt(r.val) : r.val, alt = d[r.alt] != null ? tt(r.alt) : r.alt; N.push([{ v: r.el }, { v: tt(r.id) + ": " + val, s: XL.wrap }, { v: alt }, { v: r.d, s: r.d > 0 ? XL.numRed : XL.num }]); });
    var H = [hdr([tt("tab_hon"), "B", "q %", "Tm h", "Tp h", "h CHF", tt("hHon"), tt("hNk"), tt("hTot")])];
    S.recs.hon.forEach(function (r) { var h = honCalc(r, sm.netto); if (h.ok) H.push([{ v: r.name }, { v: h.B, s: XL.num }, { v: h.q, s: XL.num }, { v: h.Tm, s: XL.num }, { v: h.Tp, s: XL.num }, { v: num(r.h), s: XL.num }, { v: h.H, s: XL.num }, { v: h.NK, s: XL.num }, { v: h.net, s: XL.sum }]); });
    var G = [[{ v: tt("h_grund"), s: XL.title }], []];
    (T[S.lang] || T.de).g_list.concat([tt("g_lvOnlyDE"), tt("x_stand")]).forEach(function (x) { G.push([{ v: x, s: XL.wrap }]); });
    var sheets = [{ name: nm.k, rows: K, cols: [46, 20, 18] }, { name: nm.a, rows: A, cols: [14, 88, 11, 7, 11, 13], freeze: 1 }, { name: nm.z, rows: Z, cols: [14, 88, 11, 7, 11, 13], freeze: 1 },
      { name: nm.b, rows: B.length ? B : [[{ v: "—" }]], cols: [62, 14, 8] }, { name: sheetName(tt("h_vollst"), used), rows: V, cols: [64, 30] }, { name: sheetName(tt("h_annahmen"), used), rows: N, cols: [22, 40, 20, 14] }];
    if (H.length > 1) sheets.push({ name: sheetName(tt("tab_hon"), used), rows: H, cols: [30, 14, 8, 10, 10, 14, 12, 14] });
    sheets.push({ name: nm.w, rows: W, cols: [36, 12, 110] }, { name: nm.g, rows: G, cols: [150] });
    return sheets;
  }
  function xlsxBytes() { return XLSXW.build(xlsxSheets(KVE.calc(S, LV)), { noCache: false }); }

  /* ---------- Export / Import ---------- */
  function download(name, data, type) {
    var go = function () { var b = new Blob([data], { type: type }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    try { if (window.claude && window.claude.use) { window.claude.use("downloads").then(function (dl) { if (dl) return dl.save({ filename: name, data: new Blob([data], { type: type }) }); go(); }).catch(go); return; } } catch (e) {}
    go();
  }
  function fname(ext) { return "LV-Devis_" + ((S.kopf.sap || S.kopf.projekt || "Projekt").replace(/[^\w\-]+/g, "_")) + "." + ext; }
  function saveJson() { var c = JSON.parse(JSON.stringify(S)); delete c.ui; download(fname("json"), JSON.stringify({ v: 2, tool: "LV-Devis Tiefbau", lv: "V1.1 10.07.2026", data: c }, null, 1), "application/json"); }
  function load(file) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var j = JSON.parse(rd.result), d = j.data || j, lang = S.lang;
        if (d.v === 2 && d.recs) { S = d; }
        else if (Array.isArray(d.elems)) {           /* Import aus KV-Assistent */
          var n = defaults(); n.kopf = Object.assign(n.kopf, d.kopf || {}); n.sond = Object.assign(n.sond, d.sond || {}); n.wasser = Object.assign(n.wasser, d.wasser || {}); n.be = Object.assign(n.be, d.be || {}); if (d.dichte) n.dichte = d.dichte;
          n.recs.graben = d.elems.filter(function (e) { return e.type !== "schacht"; }).map(function (e) { e.x = {}; e.free = []; return e; });
          n.recs.schacht = d.elems.filter(function (e) { return e.type === "schacht"; }).map(function (e) { e.x = {}; e.free = []; return e; });
          n.recs.allg[0].free = d.free || []; S = n;
        } else if (d.recs && d.v === 1) {             /* Import aus LV-Erfassung (kompatible Reiter) */
          var m = defaults(); ["rohr", "geb", "belag"].forEach(function (t) { if (d.recs[t]) m.recs[t] = d.recs[t].map(function (r) { r.name = r.bez || r.name; return r; }); });
          if (d.recs.hon) m.recs.hon = d.recs.hon.map(function (r) { r.name = r.bez || r.name; return r; });
          if (d.recs.allg) { m.recs.allg = d.recs.allg.map(function (r) { r.name = r.bez || r.name; return r; }); var be = d.recs.allg.map(function (r) { return num(r.be, 0); }).filter(Boolean)[0]; if (be) m.be.pct = String(be); }
          if (d.head) { m.kopf.sap = d.head.sap || ""; m.kopf.bem = d.head.bem || ""; }
          S = m;
        } else throw new Error("format");
        S.lang = lang; heal(); save(); applyKopf(); applyLang();
      } catch (e) { alert("JSON: " + e.message); }
    };
    rd.readAsText(file);
  }

  /* ---------- Kopf, Sprache, Ereignisse ---------- */
  var KOPF = [["projekt", "projekt"], ["sap", "sap"], ["ort", "ort"], ["bearb", "bearb"], ["datum", "datum"], ["devisNr", "dv_nr"], ["lieferant", "dv_lieferant"], ["vertrag", "dv_vertrag"], ["termin", "dv_termin"], ["bem", "bem"]];
  function applyKopf() { KOPF.forEach(function (k) { $("#p_" + k[0]).value = S.kopf[k[0]] || ""; }); $("#p_rolle").value = S.kopf.rolle; $("#p_belagLief").checked = !!S.kopf.belagLief; }
  function applyLang() {
    document.documentElement.lang = S.lang;
    $("#t-title").textContent = tt("title"); $("#t-sub").textContent = tt("sub"); $("#t-role").textContent = tt("creatorRole");
    KOPF.forEach(function (k) { $("#l_" + k[0]).textContent = tt(k[1]); }); $("#l_rolle").textContent = tt("rolle"); $("#l_belagLief").textContent = tt("dv_belagLief");
    var r = $("#p_rolle"); r.innerHTML = ""; ["anv", "bl", "bhv"].forEach(function (v) { var o = document.createElement("option"); o.value = v; o.textContent = tt("r_" + v); r.appendChild(o); }); r.value = S.kopf.rolle;
    $("#helpTitle").textContent = tt("helpTitle"); $("#helpSteps").innerHTML = (T[S.lang] || T.de).help.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); $("#helpNote").textContent = tt("helpNote");
    $("#h-result").textContent = tt("h_result");
    $("#bPrint").textContent = tt("btnPrint"); $("#bPrintSum").textContent = tt("btnPrintSum"); $("#bXlsx").textContent = tt("btnXlsx"); $("#bSave").textContent = tt("btnSave"); $("#bLoad").textContent = tt("btnLoad"); $("#bNew").textContent = tt("btnNew");
    document.querySelectorAll(".langs button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.lang === S.lang ? "true" : "false"); });
    $("#versionline").innerHTML = "<b>" + esc(tt("version")) + " 2.0</b><span>Build " + BUILD + "</span><span>LV DE V1.1 (10.07.2026)</span><span>LV FR V1.0 (27.06.2026)</span><span>LV IT V1.0 (27.06.2026)</span>";
    LVARR = null; renderForm(); renderResult();
  }
  function init() {
    KOPF.forEach(function (k) { $("#p_" + k[0]).addEventListener("input", function () { S.kopf[k[0]] = this.value; save(); }); });
    $("#p_rolle").addEventListener("change", function () { S.kopf.rolle = this.value; save(); });
    $("#p_belagLief").addEventListener("change", function () { S.kopf.belagLief = this.checked; var v = this.checked ? "dritte" : "typN";
      LVTABS.forEach(function (t) { S.recs[t].forEach(function (e) { if (e.belag) e.belag.einbau = v; }); }); save(); renderForm(); renderResult(); });
    $("#tabs").addEventListener("click", function (ev) { var b = ev.target.closest("[data-tab]"); if (!b) return; S.tab = b.dataset.tab; save(); renderForm(); renderResult(); });
    $("#form").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-rec]"); if (!b) return; var a = b.dataset.rec, L = S.recs[S.tab];
      if (a === "prev") S.idx[S.tab] = Math.max(0, S.idx[S.tab] - 1);
      else if (a === "next") S.idx[S.tab] = Math.min(L.length - 1, S.idx[S.tab] + 1);
      else if (a === "new") { L.push(newRec(S.tab, L.length + 1)); S.idx[S.tab] = L.length - 1; }
      else if (a === "dup") { var c = JSON.parse(JSON.stringify(rec())); c.name = (c.name || "") + " (2)"; L.splice(S.idx[S.tab] + 1, 0, c); S.idx[S.tab]++; }
      else if (a === "del") { if (!confirm(tt("confirmDel"))) return; L.splice(S.idx[S.tab], 1); if (!L.length) L.push(newRec(S.tab, 1)); S.idx[S.tab] = Math.min(S.idx[S.tab], L.length - 1); }
      save(); renderForm(); renderResult();
    });
    $("#result").addEventListener("click", function (ev) {
      var g = ev.target.closest("[data-go]"); if (g) { ev.preventDefault(); var p = g.dataset.go.split(":"); S.tab = p[0]; S.idx[p[0]] = +p[1]; save(); renderForm(); renderResult(); window.scrollTo({ top: $("#tabs").offsetTop - 8, behavior: "smooth" }); return; }
      var im = ev.target.closest("img[data-lb]"); if (im) { $("#lb img").src = im.src; $("#lb").classList.add("on"); return; }
      var t = ev.target.closest("[data-toggle]"); if (t) { var box = t.closest(".elres"), cl = !box.classList.contains("closed"); box.classList.toggle("closed", cl); t.setAttribute("aria-expanded", cl ? "false" : "true"); S.ui.closed[t.dataset.toggle] = cl; save(); return; }
      var a = ev.target.closest("[data-act]"); if (!a) return; var c = a.dataset.act === "collapse";
      document.querySelectorAll("#result .elres").forEach(function (bx) { bx.classList.toggle("closed", c); S.ui.closed[bx.dataset.id] = c; });
    });
    $("#lb").addEventListener("click", function () { this.classList.remove("on"); });
    var st = [];
    window.addEventListener("beforeprint", function () { st = []; document.querySelectorAll("#result details").forEach(function (d) { st.push([d, d.open]); d.open = true; }); });
    window.addEventListener("afterprint", function () { st.forEach(function (x) { x[0].open = x[1]; }); document.body.classList.remove("summary-print"); });
    document.querySelectorAll(".langs button").forEach(function (b) { b.onclick = function () { S.lang = b.dataset.lang; save(); applyLang(); }; });
    $("#bPrint").onclick = function () { window.print(); };
    $("#bPrintSum").onclick = function () { document.body.classList.add("summary-print"); window.print(); };
    $("#bXlsx").onclick = function () { download(fname("xlsx"), xlsxBytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); };
    $("#bSave").onclick = saveJson;
    $("#bLoad").onclick = function () { $("#fileIn").click(); };
    $("#bNew").onclick = function () { if (confirm(tt("confirmNew"))) { var l = S.lang; S = defaults(); S.lang = l; heal(); save(); applyKopf(); applyLang(); } };
    $("#fileIn").addEventListener("change", function () { if (this.files[0]) load(this.files[0]); this.value = ""; });
    applyKopf(); applyLang();
    window.__LVD = { S: function () { return S; }, xlsxBytes: xlsxBytes, renderResult: renderResult };
  }
  document.addEventListener("DOMContentLoaded", init);
})();
