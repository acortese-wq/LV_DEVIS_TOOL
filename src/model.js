/* =====================================================================
   LV-Devis Tiefbau – Datenmodell (Datensätze, Vorgaben, Ingenieurhonorar)
   Gemeinsam genutzt von der Oberfläche (app.js) und dem Claude-Skill.
   App-Konzept und Urheber: Alessandro Cortese
   ===================================================================== */
var LVM = (function () {
  "use strict";
  var num = KVE.num, r2 = KVE.r2;
  var ERSCH0 = function () { return { klasse: "keine", verf: "keine", hind: "keine", hindVol: "0.30" }; };
  function mkBelag(mode, belagLief) {
    var b = { mode: mode || "bit", d: "130", pak: "le250", einbau: "typN", typ: "N", trag: "T22", dTrag: "90", deck: "AC8", deckArt: "hand", dDeck: "40", haft: true, naehte: true, fund: "0",
      humus: { art: "abtrag", dOber: "30", hand: false, ansaeen: false },
      pflaster: { material: "betonverbund", dicke: "60", fund: "200", randNeu: false, randMat: "gneis", randTyp: "8/11", randLaenge: "", randAbbruch: false, abbruchAlt: false, abbruchArt: "betonstein" } };
    if (belagLief) b.einbau = "dritte";
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

  function newRec(tab, n, belagLief) {
    var nm = function (s) { return s + " " + n; }, r;
    switch (tab) {
      case "graben": r = { name: nm("Leitungsgraben"), L: "", T: "0.60", bmode: "min60", aussen: "", bman: "0.60", hand: "normal", gesp: false, direkt: false, aushubArt: "normal", saugH: "0",
        rohrSystem: "k55", dn: "55", len: "10", n: "1", muffenMode: "auto", muffenN: "0", b90: "0", b45: "0", schneiden: "0", warnband: true, kalib: true, einzug: "schnur",
        dn2: "100", n2: "1", abzweiger: [], bloecke: [{ dn: "55", n: "1", lagen: "1", len: "10" }], block: { breite: "0.50", hoehe: "0.30" },
        umhType: "kies", umhMat: "betonkies", umhArea: "0.035", verf: "aushub", einfHand: false, Lb: "", belag: mkBelag(null, belagLief),
        mods: { ersch: false, fremd: false, boesch: false }, ersch: ERSCH0(), kreuz: { on: true, n: "1", len: "1.00", richtung: "quer" }, zores: { on: false, len: "0", zustand: "abrechen" },
        boeschung: { on: true, flaeche: "", geneigt: false }, uF: "", uP: "", uL: "", aB: "", aW: "", aS: "", aR: "" }; break;
      case "schacht": r = { name: nm("Schacht"), modus: "neu", einbauort: "SS", typ: "KES150", n: "0", arbeit: "0.50", hand: "normal", direkt: true, beton: "0", platten: "0", anschl: "0", anDN: "80",
        rahmen: "", deckel: "", verf: "kies045", einfHand: true, belag: mkBelag(null, belagLief), mods: { ersch: false }, ersch: ERSCH0(), deckelRichtung: "hoeher", deckelFormat: "rund", deckelN: "0",
        shape: "eckig", sys: "nivo", deckelFormat2: "90", deckelSockel: "ohne", spare: "0", alt: "guss", opts: {}, deviate: false, reason: "", approver: "", journal: false }; break;
      case "rohr": r = { name: nm("Rohranlage"), verl: true, rohre: [{ typ: "K55", q: "" }], schn: [{ typ: "K55", q: "" }], boe: [{ typ: "", q: "" }], muf: [{ typ: "", q: "" }], erd: "", warn: "", schnur: "", kal: "", kalDN: "55" }; break;
      case "werkloch": r = { name: nm("Werklöcher"), ts: "", bo: "", sg: "", zs: "", iB: "", iT: "", iL: "", p0: "", p1: "", p2: "", p3: "", arbeit: "0.30", hand: "normal", direkt: false, verf: "aushub", einfHand: false, belag: mkBelag(null, belagLief), mods: { ersch: false }, ersch: ERSCH0() }; break;
      case "fund": r = { name: nm("Fundament"), vk: "", kvs: "", arbeit: "0.30", hand: "normal", direkt: false, verf: "kies045", einfHand: false, belag: mkBelag("none", belagLief), mods: { ersch: false }, ersch: ERSCH0() }; break;
      case "geb": r = { name: nm("Gebäudeeinführung"), n: "", cm: "", abd: "hauff" }; break;
      case "belag": r = { name: nm("Belagsarbeiten"), indiv: false, bk: "gehweg", d: "0.08", B: "", L: "", wi: "B" }; break;
      case "allg": r = { name: nm("Allgemein"), km: "", ak: "" }; break;
      case "hon": r = { name: nm("Ingenieurhonorar"), src: "lv", B: "", n: "1.0", r: "1.0", h: "", nk: "", gl: false, ph: PHDEF.map(function (p) { return { k: p[0], on: p[3] }; }) }; break;
    }
    r.x = {}; r.free = [];
    return r;
  }
  function defaults(TABS, datum) {
    var recs = {}, idx = {};
    TABS.forEach(function (t) { recs[t] = [newRec(t, 1)]; idx[t] = 0; });
    return { v: 2, lang: "de", tab: "graben", kopf: { projekt: "", ort: "", bearb: "", datum: datum || "", rolle: "anv", devisNr: "", lieferant: "", vertrag: "", termin: "", belagLief: false, sap: "", bem: "" },
      recs: recs, idx: idx, sond: { m3: "", einfHand: false }, wasser: { h: "", sumpf: "" }, be: { pct: "" }, dichte: "2.4", mwst: "8.1",
      par: { deckG: "0.03", deckS: "0.035", deckK: "0.04", gehMin: "0.06", gehMax: "0.12", strMin: "0.09", strMax: "0.20", kanMin: "0.12", kanMax: "0.30" },
      D: { wl: { ts: [1.50, 1.00, 1.00], bo: [1.50, 1.00, 1.00], sg: [2.00, 1.20, 1.20], zs: [1.00, 0.80, 1.00] }, fund: { "CAB 1-3 L": [1.00, 0.60, 0.80], "C 50": [1.20, 0.70, 0.80] } },
      ui: { closed: {}, xo: {}, printDraw: true } };
  }
  function phaseList(cfg) { /* feste q-Werte aus PHDEF; Auswahl aus dem Datensatz */
    return PHDEF.map(function (d) { var x = (cfg.ph || []).filter(function (p) { return p.k === d[0]; })[0]; return { k: d[0], q: d[2], on: x ? !!x.on : d[3], lab: d[1] }; });
  }
  function honCalc(r, netto) {
    var B = r.src === "man" ? num(r.B, 0) : netto, ph = phaseList(r), q0 = ph.reduce(function (s, x) { return s + (x.on ? x.q : 0); }, 0), q = r2(q0 * (r.gl ? 1.1 : 1));
    var h = num(r.h, 0);
    if (!(B > 0) || !(q > 0) || !(h > 0)) return { B: B, q: q, ok: false, noH: !(h > 0) };
    var p = HONF.Z1 + HONF.Z2 / Math.cbrt(B), Tm = r2(B * p / 100 * num(r.n, 1) * q / 100 * num(r.r, 1)), Tp = r2(Tm * HONF.i), H = r2(Tp * HONF.s * h), NK = r2(H * num(r.nk, 0) / 100);
    return { B: B, p: p, q: q, Tm: Tm, Tp: Tp, H: H, NK: NK, net: r2(H + NK), ok: true };
  }
  return { ERSCH0: ERSCH0, mkBelag: mkBelag, PHDEF: PHDEF, HONF: HONF, newRec: newRec, defaults: defaults, phaseList: phaseList, honCalc: honCalc };
})();
