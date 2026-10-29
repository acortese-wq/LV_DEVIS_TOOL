/* =====================================================================
   LV-Devis Tiefbau – Oberfläche
   Reiter-Maske (LV-Erfassung) + Rechenkern KV-Assistent + Schachtauswahl
   App-Konzept und Urheber: Alessandro Cortese
   ===================================================================== */
(function () {
  "use strict";
  if (window.__EXPIRED) return;   /* abgelaufene Weitergabe-Version: Tool nicht starten */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var chf = function (v) { return v == null ? "—" : v.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var qf = function (v) { return (v || 0).toLocaleString("de-CH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); };
  var num = KVE.num, r2 = KVE.r2;
  var S;
  var tt = function (k) { var d = T[S.lang] || T.de; return d[k] != null ? d[k] : (T.de[k] != null ? T.de[k] : k); };
  var fill = function (s, a) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return a && a[k] != null ? (typeof a[k] === "number" ? String(r2(a[k])) : a[k]) : m; }); };
  var today = function () { var d = new Date(); return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(); };
  var KEY = "lv-devis-tiefbau-v2";
  var LVTABS = KVE.TABS, TABS = LVTABS.concat(["hon"]), ALLTABS = TABS.concat(["plan", "par"]);

  /* Positionstexte je Sprache (FR aus LV FR, IT sobald hinterlegt) */
  window.lvT = function (k) { var m = S && S.lang === "fr" ? LV_FR : S && S.lang === "it" ? LV_IT : null; return m && m[k] && m[k].t ? m[k].t : (LV[k] ? LV[k].t : k); };
  window.lvC = function (k) { var m = S && S.lang === "fr" ? LV_FR : S && S.lang === "it" ? LV_IT : null; return m && m[k] && m[k].c ? m[k].c : (LV[k] ? LV[k].c : ""); };

  /* ---------- Datensätze ---------- */
  /* Datenmodell (Datensätze, Honorar) in model.js – gemeinsam mit dem Claude-Skill */
  var PHDEF = LVM.PHDEF, HONF = LVM.HONF, phaseList = LVM.phaseList, honCalc = LVM.honCalc;
  var mkBelag = function (mode) { return LVM.mkBelag(mode, S && S.kopf && S.kopf.belagLief); };
  var newRec = function (tab, n) { return LVM.newRec(tab, n, S && S.kopf && S.kopf.belagLief); };
  var defaults = function () { return LVM.defaults(TABS, today()); };
  function deepFill(dst, src) { Object.keys(src).forEach(function (k) { if (dst[k] == null) dst[k] = JSON.parse(JSON.stringify(src[k])); else if (typeof src[k] === "object" && !Array.isArray(src[k]) && typeof dst[k] === "object") deepFill(dst[k], src[k]); }); }
  function heal() {
    var d = defaults();
    deepFill(S, d);
    TABS.forEach(function (t) {
      if (!Array.isArray(S.recs[t]) || !S.recs[t].length) { S.recs[t] = [newRec(t, 1)]; S.idx[t] = 0; }
      var nr = newRec(t, 1); S.recs[t].forEach(function (r) { deepFill(r, nr); });
      if (!(S.idx[t] >= 0 && S.idx[t] < S.recs[t].length)) S.idx[t] = 0;
    });
    if (!S.karte || !Array.isArray(S.karte.lines)) S.karte = { lines: [], pts: [], sond: [], notes: [], areas: [], wl: [], geb: [] }; if (!Array.isArray(S.karte.pts)) S.karte.pts = []; if (!Array.isArray(S.karte.sond)) S.karte.sond = []; if (!Array.isArray(S.karte.notes)) S.karte.notes = []; if (!Array.isArray(S.karte.areas)) S.karte.areas = []; if (!Array.isArray(S.karte.wl)) S.karte.wl = []; if (!Array.isArray(S.karte.geb)) S.karte.geb = [];
    if (!S.plan || !Array.isArray(S.plan.lines)) S.plan = { img: "", w: 0, h: 0, cal: {}, lines: [], pts: [], sond: [], notes: [], areas: [], wl: [], geb: [] }; if (!Array.isArray(S.plan.pts)) S.plan.pts = []; if (!Array.isArray(S.plan.sond)) S.plan.sond = []; if (!Array.isArray(S.plan.notes)) S.plan.notes = []; if (!Array.isArray(S.plan.areas)) S.plan.areas = []; if (!Array.isArray(S.plan.wl)) S.plan.wl = []; if (!Array.isArray(S.plan.geb)) S.plan.geb = []; if (!S.plan.cal) S.plan.cal = {};
    if (ALLTABS.indexOf(S.tab) < 0) S.tab = "graben";
  }
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || S.v !== 2) S = defaults();
  heal();
  var saveT;
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { var el = document.getElementById("saveState"), ok = true; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { ok = false; }
    if (el) { var d = new Date(); el.className = "savestate no-print" + (ok ? "" : " err"); el.textContent = ok ? fill(tt("ux_saved"), { t: ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) }) : tt("ux_saveErr"); } }, 300); }
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
  var notBlock = function (c) { return c.rohrSystem !== "block"; };
  var withShow = function (list, fn) { return list.map(function (f) { return Object.assign({}, f, { show: function (c) { return fn(c) && (f.show ? f.show(c) : true); }, _w: [fn, f.show] }); }); };
  function locOf(c) { return LOCS.filter(function (l) { return l.id === c.einbauort; })[0]; }
  function kindOf(c) { var s = KVE.SCHACHT[c.typ]; return s ? s.kind : null; }
  var notDeckel = function (c) { return c.modus !== "deckel"; }, isNeu = function (c) { return c.modus === "neu"; };
  var shapeFree = function (c) { var k = kindOf(c); return notDeckel(c) && k !== "KS" && !(k === "PLS" && isNeu(c)); };
  var curShape = function (c) { return kindOf(c) === "KS" ? "rund" : c.shape; };
  var COVERS = Object.keys(LV).filter(function (k) { return k.indexOf("151/632.1") === 0; }).sort();
  var F = {
    graben: [{ sec: "s_graben" }, { id: "name", t: "text" }, { id: "L", t: "num" }, { t: "trasse" }, { id: "T", t: "num" },
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
      { id: "warnband", t: "chk" }, { id: "kalib", t: "chk" }, { id: "einzug", t: "sel", opts: ["keine", "schnur", "draht"], show: function (c) { return !isBlock(c); } }, { t: "zub" },
      { id: "azlist", t: "abzwList", show: isLaengs },
      { sec: "s_zone" }, { id: "umhType", t: "sel", opts: ["kies", "beton"], struct: 1, show: notBlock },
      { id: "umhMat", t: "sel", opts: ["betonkies", "sand", "kies48"], show: function (c) { return notBlock(c) && c.umhType === "kies"; } },
      { id: "umhMode", t: "sel", opts: ["auto", "manuell"], struct: 1, show: notBlock },
      { id: "bett", t: "num", half: 1, show: function (c) { return notBlock(c) && c.umhMode !== "manuell"; } },
      { id: "umh", t: "num", half: 1, hint: "hint_umhAuto", show: function (c) { return notBlock(c) && c.umhMode !== "manuell"; } },
      { id: "umhArea", t: "num", hint: "hint_umh", show: function (c) { return notBlock(c) && c.umhMode === "manuell"; } }
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
    schacht: [{ sec: "s_schacht" }, { id: "name", t: "text" }, { t: "trasse" }, { id: "modus", t: "sel", opts: ["neu", "ersatz", "deckel"], struct: 1 },
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
    werkloch: [{ sec: "s_wl" }, { id: "name", t: "text" }, { t: "trasse" }, { id: "ts", t: "num", half: 1 }, { id: "bo", t: "num", half: 1 }, { id: "sg", t: "num", half: 1 }, { id: "zs", t: "num", half: 1 },
      { sec: "s_indWL" }, { id: "iL", t: "num", half: 1 }, { id: "iB", t: "num", half: 1 }, { id: "iT", t: "num", half: 1 },
      { sec: "s_psauf" }, { id: "p0", t: "num", half: 1 }, { id: "p1", t: "num", half: 1 }, { id: "p2", t: "num", half: 1 }, { id: "p3", t: "num", half: 1 },
      { sec: "s_graben" }].concat(PIT_FIELDS, ERSCH_FIELDS, [{ sec: "s_zone" }], VERF_FIELDS, [{ sec: "s_belag" }], BELAG_FIELDS),
    fund: [{ sec: "s_fund" }, { id: "name", t: "text" }, { id: "vk", t: "sel", opts: [""].concat(KVE.VK) }, { id: "kvs", t: "sel", opts: [""].concat(KVE.KVS) }]
      .concat(PIT_FIELDS, ERSCH_FIELDS, [{ sec: "s_zone" }], VERF_FIELDS, [{ sec: "s_belag" }], BELAG_FIELDS),
    geb: [{ sec: "s_geb" }, { id: "name", t: "text" }, { t: "trasse" }, { id: "n", t: "num", labKey: "f_gn" }, { id: "cm", t: "num" }, { id: "abd", t: "sel", opts: ["keine", "kissen", "hauff"] }],
    belag: [{ sec: "s_wi" }, { id: "name", t: "text" }, { t: "trasse" }, { id: "indiv", t: "sel", opts: ["false", "true"], struct: 1, hint: "ksHint" },
      { id: "bk", t: "sel", opts: ["gehweg", "strasse", "kanton"], struct: 1, show: function (c) { return String(c.indiv) !== "true"; } },
      { id: "d", t: "num", show: function (c) { return String(c.indiv) !== "true"; }, rangeHint: 1 },
      { id: "B", t: "num", half: 1, show: function (c) { return String(c.indiv) !== "true"; } }, { id: "L", t: "num", half: 1, labKey: "f_Lbel", show: function (c) { return String(c.indiv) !== "true"; } },
      { id: "wi", t: "sel", opts: function (c) { return ["strasse", "kanton"].indexOf(c.bk) >= 0 ? ["A", "A1", "B", "C", "C1", "C2"] : ["A", "A1", "B"]; }, struct: 1, show: function (c) { return String(c.indiv) !== "true"; } }],
    allg: [{ sec: "s_vor" }, { id: "sond.m3", t: "num", glob: 1 }, { id: "sond.einfHand", t: "chk", glob: 1 }, { id: "wasser.h", t: "num", glob: 1, half: 1 }, { id: "wasser.sumpf", t: "num", glob: 1, half: 1 },
      { sec: "s_be" }, { id: "be.pct", t: "num", glob: 1, hint: "hint_bepct", beHint: 1 },
      { sec: "s_pausch" }, { id: "name", t: "text" }, { id: "km", t: "num", half: 1 }, { id: "ak", t: "num", half: 1 }],
    rohr: [{ sec: "s_rohrTab" }, { id: "name", t: "text" }, { id: "verl", t: "chk" }, { t: "rohrLists" },
      { id: "erd", t: "num", half: 1 }, { id: "warn", t: "num", half: 1 }, { id: "schnur", t: "num", half: 1 }, { id: "kal", t: "num", half: 1 }, { id: "kalDN", t: "sel", opts: ["55", "100", "120", "150"] }, { t: "zub" }],
    hon: [{ sec: "hB" }, { id: "name", t: "text" }, { id: "src", t: "sel", opts: ["lv", "man"], struct: 1, hint: "hint_hB" }, { t: "honB" },
      { sec: "s_hfak" }, { id: "n", t: "num", half: 1, labKey: "f_hn" }, { id: "r", t: "num", half: 1, labKey: "f_hr" }, { t: "honFak" }, { sec: "s_hph" }, { t: "phases" }, { id: "gl", t: "chk", labKey: "f_hgl", hint: "hint_hgl" },
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

  /* ---------- Auswahlkacheln statt Dropdown ----------
     "tile": wichtige Entscheidungen als Kacheln mit Kurztext; "seg": kurze Werte als Knopfreihe.
     Technisch Optionsfelder (radio) – Tastatur (Pfeiltasten) und Screenreader wie gewohnt. */
  var TILES = { modus: 1, einbauort: 1, typ: 1, shape: 1, sys: 1, deckelFormat2: 1, deckelSockel: 1, alt: 1, deckelRichtung: 1, deckelFormat: 1,
    bmode: 1, aushubArt: 1, hand: 1, rohrSystem: 1, umhType: 1, umhMat: 1, umhMode: 1, verf: 1, einzug: 1, muffenMode: 1, "belag.mode": 1, "belag.einbau": 1, "belag.typ": 1, "belag.pak": 1,
    "belag.trag": 1, "belag.deck": 1, "belag.deckArt": 1, "belag.humus.art": 1, "belag.pflaster.material": 1, "belag.pflaster.abbruchArt": 1, bk: 1, wi: 1, abd: 1, src: 1, indiv: 1,
    "zores.zustand": 1, "kreuz.richtung": 1 };
  function tileMode(id, opts) {
    if (TILES[id]) return "tile";
    if (opts.length <= 5 && opts.every(function (o) { return String(o[1]).length <= 14; })) return "seg";
    return "";
  }
  function splitLab(s) {   /* «Titel (Zusatz)», «Titel · Zusatz», «A – Text», «X: Y» → [Titel, Zusatz] */
    s = String(s); var m;
    if ((m = s.match(/^(.*?)\s+·\s+(.*)$/))) return [m[1], m[2]];
    if ((m = s.match(/^([^–]{1,4})\s+–\s+(.*)$/))) return [m[1], m[2]];
    if ((m = s.match(/^(.*?)\s*\((.*)\)$/))) return [m[1], m[2]];
    if ((m = s.match(/^(.{3,40}?):\s+(.*)$/))) return [m[1], m[2]];
    return [s, ""];
  }
  function typStatus(cfg, typ) {   /* wie Bewertung der Schachtauswahl: ok / amber / stop für den gewählten Einbauort */
    var loc = locOf(cfg), S0 = KVE.SCHACHT[typ]; if (!loc || !S0 || cfg.modus === "deckel") return "";
    var shaft = S0.kind === "KS" ? "KS" : S0.kind, sz = KVE.sizeOf ? KVE.sizeOf(typ) : null, lv = "ok";
    var up = function (l) { var o = { ok: 0, amber: 1, stop: 2 }; if (o[l] > o[lv]) lv = l; };
    if (cfg.modus === "ersatz") { if (shaft === "PLS") up("amber"); return lv; }
    if (loc.shafts === "none") return "none";
    if (loc.shafts === "avoid" && (shaft === "ES" || shaft === "KES")) up("amber");
    var st = sz ? sz.std[loc.group] : "stop"; if (st === "stop") up("stop"); else if (st === "amber") up("amber");
    if (shaft === "KS" && loc.group === "fast") return "none";
    return lv;
  }
  function tilesEl(wrap, lab, idn, f, cfg, opts, val, mode) {
    wrap.classList.add(mode === "tile" ? "tilefield" : "segfield");
    var leg = document.createElement("span"); leg.className = "lab"; leg.id = idn + "_l"; leg.textContent = lab.textContent; wrap.appendChild(leg);
    var g = document.createElement("div"); g.className = mode === "tile" ? "tiles" : "sgs"; g.setAttribute("role", "radiogroup"); g.setAttribute("aria-labelledby", leg.id);
    opts.forEach(function (o, i) {
      var l = document.createElement("label"), r = document.createElement("input"), on = String(o[0]) === val;
      r.type = "radio"; r.name = idn; r.value = o[0]; r.checked = on; if (i === 0) r.id = idn;
      l.className = (mode === "tile" ? "tile" : "sg") + (on ? " on" : "");
      l.appendChild(r);
      var p = mode === "tile" ? splitLab(o[1]) : [o[1], ""], tt1 = document.createElement("span"); tt1.className = "tt"; tt1.textContent = p[0]; l.appendChild(tt1);
      if (p[1]) { var ts = document.createElement("span"); ts.className = "ts"; ts.textContent = p[1]; l.appendChild(ts); }
      if (f.id === "typ") { var s = typStatus(cfg, o[0]); if (s) { var b = document.createElement("span"); b.className = "tst " + s; b.textContent = tt("ux_t_" + s); l.appendChild(b); } }
      r.addEventListener("change", function () { if (!r.checked) return; g.querySelectorAll("label").forEach(function (x) { x.classList.toggle("on", x.contains(r)); }); setv(cfg, f.id, o[0]); onChange(f, cfg); });
      g.appendChild(l);
    });
    wrap.appendChild(g);
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
      if (!opts.some(function (o) { return String(val) === o[0]; }) && opts.length) { setv(cfg, f.id, opts[0][0]); val = opts[0][0]; }
      var tm = f.t === "sel" ? tileMode(f.id, opts) : "";
      if (tm) { tilesEl(wrap, lab, idn, f, cfg, opts, String(val), tm); }
      else {
        ctl.addEventListener("change", function () { setv(cfg, f.id, ctl.value); onChange(f, cfg); });
        wrap.appendChild(lab); wrap.appendChild(ctl);
      }
    } else {
      ctl = document.createElement("input"); ctl.type = "text"; ctl.id = idn; ctl.value = val == null ? "" : val;
      if (f.t === "num") { ctl.setAttribute("inputmode", "decimal"); ctl.className = "numin"; }
      ctl.addEventListener("input", function () { setv(cfg, f.id, ctl.value); if (f.id === "sond.m3") S.sond.fromMap = false; onChange(f, cfg); });
      wrap.appendChild(lab); wrap.appendChild(ctl);
    }
    if (f.hint) { var h = document.createElement("p"); h.className = "hint"; h.textContent = tt(f.hint); wrap.appendChild(h); }
    if (f.locHint) { var l = locOf(cfg); if (l) { var h2 = document.createElement("p"); h2.className = "hint"; h2.textContent = (l.h[S.lang] || l.h.de) + (l.norm !== "—" ? "  (" + l.norm + ")" : ""); wrap.appendChild(h2); } }
    if (f.beHint) { var hb = document.createElement("p"); hb.className = "hint"; hb.id = "beHint"; wrap.appendChild(hb); }
    if (f.rangeHint) { var hr = document.createElement("p"); hr.className = "hint"; var P = S.par, g = cfg.bk === "gehweg" ? [P.gehMin, P.gehMax] : cfg.bk === "strasse" ? [P.strMin, P.strMax] : [P.kanMin, P.kanMax];
      hr.textContent = g[0] + " – " + g[1] + " m"; wrap.appendChild(hr); }
    return wrap;
  }
  /* Zubehör neuer Rohre: Fehlendes melden, Verzicht nur mit ausdrücklicher Bestätigung */
  function zubRender() {
    var box = document.getElementById("zubbox"); if (!box) return; var cfg = rec(), list = KVE.zubFehlt(S.tab, cfg);
    box.innerHTML = ""; box.className = list.length ? "zubbox" + (list.some(function (z) { return !z.ok; }) ? " offen" : " ok") : "";
    if (!list.length) return;
    var h = document.createElement("p"); h.className = "zubtitle"; h.textContent = tt("ux_zubTitle"); box.appendChild(h);
    list.forEach(function (z) {
      var row = document.createElement("label"); row.className = "check zubrow" + (z.ok ? " ok" : "");
      var c = document.createElement("input"); c.type = "checkbox"; c.checked = z.ok;
      c.addEventListener("change", function () { cfg.zubV = cfg.zubV || {}; cfg.zubV[z.k] = c.checked; save(); zubRender(); scheduleResult(); });
      var s = document.createElement("span"); s.innerHTML = "<b>" + esc(tt("ux_zub_" + z.k)) + "</b> – " + esc(tt("ux_zubConfirm"));
      row.appendChild(c); row.appendChild(s); box.appendChild(row);
    });
  }
  function aussenReq() {   /* leer = Aussenmass wird aus den Rohren abgeleitet; Wert als Platzhalter zeigen */
    var el = document.getElementById("f_graben_aussen"); if (!el) return;
    var m = document.getElementById("f_graben_aussen_req"), gb = KVE.grabenBreite(rec()), leer = !(num(el.value, 0) > 0);
    el.placeholder = leer && gb.abgel ? tt(gb.src === "block" ? "ux_aussenBlock" : "ux_aussenAuto") + " ≈ " + qf(r2(gb.a)) : "";
    if (!m) { m = document.createElement("p"); m.className = "hint"; m.id = "f_graben_aussen_req"; el.insertAdjacentElement("afterend", m); }
    m.textContent = tt("ux_aussenReq");
  }
  function onChange(f, cfg) {
    if (S.tab === "graben") aussenReq();
    zubRender();
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
      s.addEventListener("change", function () { row.typ = s.value; save(); refreshFig(); zubRender(); scheduleResult(); });
      var q = document.createElement("input"); q.type = "text"; q.inputMode = "decimal"; q.value = row.q; q.style.width = "70px"; q.setAttribute("aria-label", unit);
      q.addEventListener("input", function () { row.q = q.value; save(); refreshFig(); zubRender(); scheduleResult(); });
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
      var i = document.createElement("input"); i.type = "text"; i.inputMode = "decimal"; i.value = (cfg.opts || {})[o.id] || ""; i.className = "numin"; i.id = "opt_" + o.id; l.htmlFor = i.id;
      i.addEventListener("input", function () { cfg.opts = cfg.opts || {}; cfg.opts[o.id] = i.value; save(); scheduleResult(); });
      d.appendChild(l); d.appendChild(sm); d.appendChild(i); wrap.appendChild(d);
    });
    return wrap;
  }
  function phasesEl(cfg) {
    var wrap = document.createElement("div"); wrap.className = "phs"; var L = ["de", "fr", "it", "en"].indexOf(S.lang);
    phaseList(cfg).forEach(function (p) {
      var c = document.createElement("input"); c.type = "checkbox"; c.checked = p.on; c.id = "ph_" + p.k;
      c.addEventListener("change", function () { cfg.ph = phaseList(cfg).map(function (x) { return { k: x.k, on: x.k === p.k ? c.checked : x.on }; }); save(); refreshHon(); scheduleResult(); });
      var b = document.createElement("label"); b.htmlFor = c.id; b.className = "phk"; b.textContent = p.k;   /* ganze Zeile anklickbar */
      var s = document.createElement("label"); s.htmlFor = c.id; s.textContent = p.lab[L] || p.lab[0];
      var q = document.createElement("span"); q.className = "num"; q.textContent = qf(p.q) + " %";
      wrap.appendChild(c); wrap.appendChild(b); wrap.appendChild(s); wrap.appendChild(q);
    });
    var sum = document.createElement("p"); sum.className = "phsum"; sum.id = "qsum"; wrap.appendChild(sum);
    return wrap;
  }
  function honFakEl() { var d = document.createElement("div"); d.id = "honfak"; d.innerHTML = honFakHtml(); return d; }
  function honFakHtml() { /* Erklärung zu n und r; Z1, Z2, i, s sind fest hinterlegt und nicht sichtbar */
    var r = rec(), n = num(r.n, 1), rr = num(r.r, 1), w = [];
    if (n < 0.8 || n > 1.2) w.push(tt("w_hnRange")); if (rr < 0.75 || rr > 1.25) w.push(tt("w_hrRange"));
    return '<p class="hint"><b>n</b> – ' + esc(tt("hx_n")) + '</p><p class="hint"><b>r</b> – ' + esc(tt("hx_r")) + "</p>" +
      (w.length ? '<p class="hint" style="color:var(--amber);font-weight:600">⚠ ' + w.map(esc).join(" ") + "</p>" : "") + '<p class="hint">' + esc(tt("hx_formula")) + "</p>";
  }
  var lastOut = null;
  function lvNetto() { return (lastOut || KVE.calc(S, LV)).sum.netto; }
  function honResHtml(r) {
    var h = honCalc(r, lvNetto()), mw = h.ok ? r2(h.net * num(S.mwst, 8.1) / 100) : 0;
    if (!h.ok) return '<p class="hint">⚠ ' + esc(tt(h.noH ? "w_honH" : "w_hon")) + "</p>";
    return '<table class="cost hres"><tbody><tr><td>B</td><td class="num">CHF ' + chf(h.B) + "</td></tr><tr><td>p (Grundfaktor)</td><td class=\"num\">" + h.p.toFixed(4) + " %</td></tr>" +
      "<tr><td>q</td><td class=\"num\">" + qf(h.q) + " %</td></tr><tr><td>" + esc(tt("hTm")) + '</td><td class="num">' + qf(h.Tm) + " h</td></tr>" +
      "<tr><td>" + esc(tt("hHon")) + " (" + qf(h.Tp) + " h × " + chf(num(r.h)) + ')</td><td class="num">CHF ' + chf(h.H) + "</td></tr>" +
      (h.NK ? "<tr><td>" + esc(tt("hNk")) + '</td><td class="num">CHF ' + chf(h.NK) + "</td></tr>" : "") +
      '<tr class="sub"><td>' + esc(tt("hTot")) + '</td><td class="num">CHF ' + chf(h.net) + "</td></tr><tr><td>" + esc(tt("k_mwst")) + '</td><td class="num">CHF ' + chf(mw) + "</td></tr>" +
      '<tr class="sum"><td>' + esc(tt("hTotI")) + '</td><td class="num">CHF ' + chf(r2(h.net + mw)) + "</td></tr></tbody></table>";
  }
  function refreshHon() { var hf = $("#honfak"); if (hf) hf.innerHTML = honFakHtml(); var e = $("#honres"); if (e) e.innerHTML = honResHtml(rec()); var r = rec(), q0 = phaseList(r).reduce(function (s, x) { return s + (x.on ? x.q : 0); }, 0), qe = $("#qsum");
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
  function xList(tab) { return Object.keys(LV).sort().filter(function (p) { return XT(p) === tab; }); }
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
        var isAuto = !!autoSet()[p];
        row.innerHTML = '<span class="art">' + esc(p) + (isAuto ? ' <span class="badge auto" title="' + esc(tt("xAutoT")) + '">auto</span>' : "") + "</span><span>" + esc(lvT(p)) + '</span><span class="num ctx">' + esc(LV[p].u) + " · " + chf(LV[p].ep) + "</span>";
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
    if (S.tab === "par" || S.tab === "plan") return "";
    return FIG.html(S.tab, rec(), S, tt);
  }
  function honFig(r) {
    var h = honCalc(r, lvNetto()), ph = phaseList(r), x = 20, o = "";
    ph.forEach(function (p) { var w = p.q / 107 * 720;
      o += '<rect x="' + x + '" y="40" width="' + w + '" height="40" fill="' + (p.on ? "var(--navy)" : "var(--rule-strong)") + '" stroke="#fff" stroke-width="2"/>' + (w > 24 ? '<text x="' + (x + w / 2) + '" y="65" class="sl sb" text-anchor="middle" style="fill:#fff">' + p.k + "</text>" : "") + (w > 30 ? FIG.tx(x + w / 2, 98, qf(p.q) + " %", "sm", "middle") : ""); x += w; });
    o += FIG.tx(20, 24, tt("s_hph"), "sl sb");
    o += h.ok ? FIG.tx(20, 134, "Tm = " + qf(Math.round(h.B)) + " × " + h.p.toFixed(4) + "/100 × " + qf(num(r.n, 1)) + " × " + qf(h.q) + "/100 × " + qf(num(r.r, 1)) + " = " + qf(h.Tm) + " h", "sl") +
      FIG.tx(20, 160, tt("hHon") + " = " + qf(h.Tp) + " h × CHF " + chf(num(r.h)) + " = CHF " + chf(h.H), "sl sb") : FIG.tx(20, 140, "⚠ " + tt(h.noH ? "w_honH" : "w_hon"), "sl");
    return FIG.svg(760, 180, o, tt("ht_hon"));
  }
  function refreshFig() { var e = $("#figsvg"); if (e) { var h = figHtml(); e.innerHTML = h; e.parentNode.hidden = !h; } var be = $("#beHint"); if (be) be.textContent = beHintText(); }
  function beHintText() { var pct = num(S.be.pct, 0), o = lastOut; if (!(pct > 0) || !o) return tt("hint_bepct"); return "113/111.002 – " + tt("beBasis") + " CHF " + chf(o.beBase) + " × " + pct + " % = CHF " + chf(r2(o.beBase * pct / 100)); }

  function renderTabs() {
    var out = lastOut, cnt = {};
    if (out) out.elems.forEach(function (e) { if (e.lines.length) cnt[e.tab] = (cnt[e.tab] || 0) + 1; });
    TABS.forEach(function (t) { if (t === "hon") cnt.hon = S.recs.hon.filter(function (r) { return honCalc(r, out ? out.sum.netto : 0).ok; }).length; });
    document.body.classList.toggle("lv-on", S.ui.lvCol !== false);
    var lb = $("#lvBtn"); if (lb) { lb.textContent = tt(S.ui.lvCol !== false ? "lv_hide" : "lv_show"); lb.setAttribute("aria-pressed", S.ui.lvCol !== false); }
    $("#tabs").innerHTML = ALLTABS.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t + '"' + (S.tab === t ? ' id="tabCur"' : "") + ' aria-controls="formwrap" tabindex="' + (S.tab === t ? "0" : "-1") + '" class="tab' + (S.tab === t ? " on" : "") + (t === "hon" || t === "plan" || t === "par" ? " sep" : "") + '" aria-selected="' + (S.tab === t) + '">' + esc(tt("tab_" + t)) + (cnt[t] ? '<span class="cnt">' + cnt[t] + "</span>" : "") + "</button>";
    }).join("");
  }
  function updateRecLabel() { var e = $("#recName"); if (e && S.tab !== "par" && S.tab !== "plan") e.textContent = rec().name || ""; }

  /* Karte (swisstopo): Linien = Rohranlage je Graben-Datensatz, Punkte = Schacht-Datensätze; Verknüpfung über rec.uid */
  var newUid = function () { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var ensureUid = function (r) { if (!r.uid) r.uid = newUid(); return r.uid; };
  var recByUid = function (tab, u) { return u ? S.recs[tab].filter(function (r) { return r.uid === u; })[0] : null; };
  var recName = function (tab) { return function (u) { var r = recByUid(tab, u); return r ? r.name : ""; }; };
  var pristine = function (tab, r) { var a = JSON.parse(JSON.stringify(r)), b = newRec(tab, 1); delete a.uid; return JSON.stringify(a) === JSON.stringify(b); };
  var round1 = function (v) { return String(Math.round(v * 10) / 10); };
  function karteCat() {
    return { schacht: Object.keys(KVE.SCHACHT).map(function (k) { return [k, optLabel("typ", k)]; }),
      sys: ["k55", "laengs", "block"].map(function (v) { return [v, optLabel("rohrSystem", v)]; }),
      dn: ["55", "100", "120", "150"].map(function (v) { return [v, "DN " + v]; }), len: ["5", "10"].map(function (v) { return [v, v + " m"]; }) };
  }
  function snapState() { return JSON.stringify({ recs: S.recs, idx: S.idx, karte: S.karte, plan: S.plan, sond: S.sond }); }
  function restoreState(j) { var o = JSON.parse(j); S.recs = o.recs; S.idx = o.idx; S.karte = o.karte; S.plan = o.plan; S.sond = o.sond; save(); renderForm(); renderResult(); }
  function undoToast(msg, sn) { KARTE.toast(document.body, msg, tt("km_undoBtn"), function () { restoreState(sn); }); }
  /* Belagsfläche -> Breite B und Länge L, so dass B × L = Fläche und 2 × (B + L) = Umfang (sonst Quadrat); Rechenkern unverändert */
  function solveBL(A, P) { var h = P / 2, d = h * h - 4 * A; if (d >= 0) { var r = Math.sqrt(d); return [(h + r) / 2, (h - r) / 2]; } var q = Math.sqrt(A); return [q, q]; }
  function karteApply(M, cfg, lenFn, fns) {
    var st = { g: 0, gn: 0, s: 0, sn: 0, o: 0, f: 0, fn: 0, w: 0, wn: 0, e: 0, en: 0, x: 0, z: 0 }, used = {}, G = S.recs.graben;
    M.lines = M.lines.filter(function (l) { return l.pts.length > 1; });
    M.areas = (M.areas || []).filter(function (f) { return f.pts.length > 2; });
    M.lines.forEach(function (l) {
      var r = recByUid("graben", l.rid);
      if (!r) {
        if (S.tab === "graben" && !used[ensureUid(cfg)] && !M.lines.some(function (x) { return x !== l && x.rid === cfg.uid; })) r = cfg;
        else if (G.length === 1 && pristine("graben", G[0]) && !used[ensureUid(G[0])]) r = G[0];
        else { r = JSON.parse(JSON.stringify(S.tab === "graben" ? cfg : newRec("graben", 1))); delete r.uid; r.x = {}; r.free = []; r.name = tt("tab_graben") + " " + (G.length + 1); G.push(r); st.gn++; }
      }
      used[ensureUid(r)] = 1; l.rid = r.uid; st.g++;
      r.L = round1(lenFn(l.pts)); r.rohrSystem = l.rohr.sys;
      if (l.rohr.sys !== "block") { r.dn = l.rohr.dn; r.len = l.rohr.len; r.n = String(l.rohr.n || "1"); }
    });
    M.pts.forEach(function (p) {
      var r = recByUid("schacht", p.sid), L = S.recs.schacht;
      if (!r) {
        if (S.tab === "schacht" && !used[ensureUid(cfg)] && !M.pts.some(function (x) { return x !== p && x.sid === cfg.uid; })) r = cfg;
        else if (L.length === 1 && pristine("schacht", L[0]) && !used[ensureUid(L[0])]) r = L[0];
        else { r = newRec("schacht", L.length + 1); L.push(r); st.sn++; }
      }
      used[ensureUid(r)] = 1; p.sid = r.uid; st.s++; r.typ = p.typ; if (p.name) r.name = p.name;
    });
    (M.areas || []).forEach(function (f) {
      var Bl = S.recs.belag, r = recByUid("belag", f.rid), A = fns.area(f.pts), P = fns.perim(f.pts);
      if (!(A > 0.01)) { st.z++; return; }   /* Fläche ohne Ausdehnung (Punkte auf einer Linie): kein Datensatz */
      if (!r) {
        if (S.tab === "belag" && !used[ensureUid(cfg)] && !M.areas.some(function (x) { return x !== f && x.rid === cfg.uid; })) r = cfg;
        else if (Bl.length === 1 && pristine("belag", Bl[0]) && !used[ensureUid(Bl[0])]) r = Bl[0];
        else { r = newRec("belag", Bl.length + 1); Bl.push(r); st.fn++; }
      }
      used[ensureUid(r)] = 1; f.rid = r.uid; st.f++;
      var bl = solveBL(A, P); r.indiv = "false"; r.bk = f.belag.bk; r.wi = f.belag.wi; r.d = String(f.belag.d || "0.08"); r.B = String(Math.round(bl[0] * 1000) / 1000); r.L = String(Math.round(bl[1] * 1000) / 1000);
    });
    /* Gebäudeeinführungen: je Punkt ein Datensatz (Anzahl 1) */
    (M.geb || []).forEach(function (p) {
      var r = recByUid("geb", p.sid), E = S.recs.geb;
      if (!r) {
        if (S.tab === "geb" && !used[ensureUid(cfg)] && !M.geb.some(function (x) { return x !== p && x.sid === cfg.uid; })) r = cfg;
        else if (E.length === 1 && pristine("geb", E[0]) && !used[ensureUid(E[0])]) r = E[0];
        else { r = newRec("geb", E.length + 1); E.push(r); st.en++; }
      }
      used[ensureUid(r)] = 1; p.sid = r.uid; st.e++; r.n = "1"; r.cm = String(p.cm || ""); r.abd = p.abd || "hauff"; if (p.name) r.name = p.name;
    });
    /* Konflikt: derselbe Datensatz wird auch von der anderen Quelle (Karte/Plan) gesteuert -> letzte Übernahme gilt */
    var OT = fns.src === "plan" ? S.karte : S.plan, ids = {}; [["lines", "rid"], ["areas", "rid"], ["pts", "sid"], ["geb", "sid"]].forEach(function (a) { (OT[a[0]] || []).forEach(function (o) { if (o[a[1]]) ids[o[a[1]]] = 1; }); });
    M.lines.concat(M.areas || [], M.pts, M.geb || []).forEach(function (o) { if (ids[o.rid || o.sid]) st.x++; });
    st.o = (M.sond || []).length; return st;
  }
  /* Abgeleitete Werte aus Karte UND Plan (Summe beider Quellen): Sondieraushub, Schacht-Anzahl, Werkloch-Zähler.
     Fehlt die letzte Sondage/das letzte Werkloch, wird der abgeleitete Wert wieder zurückgesetzt (manuelle Eingaben bleiben unberührt). */
  function sondSync() {
    var all = (S.karte.sond || []).concat(S.plan.sond || []);
    if (!all.length) { if (S.sond.fromMap) { S.sond.m3 = ""; S.sond.fromMap = false; } return; }
    S.sond.m3 = String(Math.round(all.reduce(function (a, o) { return a + num(o.l, 0) * num(o.b, 0) * num(o.t, 0); }, 0) * 100) / 100); S.sond.fromMap = true;
  }
  function syncDerived(cfg, st) {
    var KP = (S.karte.pts || []).concat(S.plan.pts || []);   /* Anzahl Schächte = Anzahl gesetzter Punkte je Datensatz (sonst bliebe n = 0 ohne Kosten) */
    S.recs.schacht.forEach(function (r) { var k = r.uid ? KP.filter(function (p) { return p.sid === r.uid; }).length : 0; if (k && r.modus !== "deckel") r.n = String(k); });
    var WL = (S.karte.wl || []).concat(S.plan.wl || []), W = S.recs.werkloch, rw = null;
    WL.forEach(function (p) { rw = rw || recByUid("werkloch", p.sid); });
    if (WL.length) {
      if (!rw) { if (S.tab === "werkloch" && cfg) rw = cfg; else if (W.length === 1 && pristine("werkloch", W[0])) rw = W[0]; else { rw = newRec("werkloch", W.length + 1); W.push(rw); if (st) st.wn++; } }
      ensureUid(rw); var cnt = { ts: 0, bo: 0, sg: 0, zs: 0 }; WL.forEach(function (p) { p.sid = rw.uid; cnt[p.wt] = (cnt[p.wt] || 0) + 1; });
      ["ts", "bo", "sg", "zs"].forEach(function (k) { rw[k] = cnt[k] ? String(cnt[k]) : ""; }); rw.wlMap = true; if (st) st.w = WL.length;
    } else W.forEach(function (r) { if (r.wlMap) { ["ts", "bo", "sg", "zs"].forEach(function (k) { r[k] = ""; }); r.wlMap = false; } });
    sondSync();
  }
  function lineLen(pts) { return KARTE.total([pts]); }
  function openKarte(cfg, tab, b, m, ex) {
    ex = ex || {};
      m.className = "hint kmmsg";
      if (navigator.onLine === false) { m.className = "hint kmmsg reqmsg"; m.textContent = tt("km_offline"); return; }
      m.textContent = tt("km_loading"); b.disabled = true;
      KARTE.load().then(function () {
        b.disabled = false; m.textContent = "";
        if (cfg && cfg.trasse) {   /* Übernahme der Version 1 (nur Linien) */
          var u0 = ensureUid(cfg); cfg.trasse.forEach(function (pts, i) { S.karte.lines.push({ id: "m" + i + u0, pts: pts, rid: i === 0 ? u0 : null, rohr: { sys: cfg.rohrSystem, dn: cfg.dn, len: cfg.len, n: cfg.n } }); }); delete cfg.trasse;
        }
        var g = tab === "graben" && cfg;
        KARTE.open({ kind: "map", tt: tt, lang: S.lang, cat: karteCat(), labels: mkLabels, model: JSON.parse(JSON.stringify(Object.assign({}, S.karte, { overlay: undefined, bg: undefined }))), overlay: ovResolve(S.karte.overlay), planImg: S.plan,
          defRohr: { sys: g ? cfg.rohrSystem : "k55", dn: g ? cfg.dn : "55", len: g ? cfg.len : "10", n: g ? cfg.n : "1" }, defTyp: g ? "KES150" : tab === "schacht" && cfg ? cfg.typ : "KES150", defGeb: { cm: tab === "geb" && cfg ? cfg.cm : "", abd: tab === "geb" && cfg ? cfg.abd : "hauff" }, defBelag: tab === "belag" && cfg ? { bk: cfg.bk, d: cfg.d, wi: cfg.wi } : { bk: "gehweg", d: "0.08", wi: "B" },
          recName: function (id) { return recName("graben")(id) || recName("schacht")(id) || recName("belag")(id) || recName("werkloch")(id) || recName("geb")(id); },
          onClose: function () { var o = $(ex.focus || "#kmOpen"); if (o) o.focus(); }, autoPlan: !!ex.autoPlan, planObjs: JSON.parse(JSON.stringify({ lines: S.plan.lines, pts: S.plan.pts, sond: S.plan.sond, wl: S.plan.wl, geb: S.plan.geb, areas: S.plan.areas, notes: S.plan.notes })), planScale: (S.plan.cal && S.plan.cal.scale) || 0,
          onApply: function (M, cal, lenFn, fns) { var sn = snapState(), st = karteApply(M, cfg, Object.assign({ src: "karte" }, fns) && lenFn, Object.assign({ src: "karte" }, fns)), bs = ["luft", "grau", "kataster", "leer"].indexOf(fns.base) >= 0 ? fns.base : "farbe", keep = S.karte.bg;
            if (fns.planCleared) { ["lines", "pts", "sond", "wl", "geb", "areas", "notes"].forEach(function (k) { S.plan[k] = []; }); }
            S.karte = { lines: M.lines, pts: M.pts, sond: M.sond, notes: M.notes || [], areas: M.areas || [], wl: M.wl || [], geb: M.geb || [], base: bs, bg: keep, overlay: fns.overlay ? (fns.overlay.ref === "plan" ? Object.assign({}, fns.overlay, { img: undefined, w: undefined, h: undefined }) : fns.overlay) : null }; syncDerived(cfg, st); save(); renderForm(); scheduleResult(); undoToast(fill(tt("km_done"), st) + (st.z ? " ⚠ " + fill(tt("km_zero"), st) : "") + (st.x ? " ⚠ " + fill(tt("km_conflict"), st) : ""), sn); cacheSitu(); }
        });
      }).catch(function (err) { if (window.console && err && err.message !== "leaflet") console.error(err); b.disabled = false; m.className = "hint kmmsg reqmsg"; m.textContent = tt("km_offline"); });
  }
  function trasseEl(cfg) {
    var w = document.createElement("div"); w.className = "field kmfield"; var tab = S.tab;
    var b = document.createElement("button"); b.type = "button"; b.className = "btn small"; b.id = "kmOpen"; b.textContent = tt("km_btn"); w.appendChild(b);
    var m = document.createElement("p"); m.className = "hint kmmsg"; m.setAttribute("role", "status"); w.appendChild(m);
    var u = cfg.uid, ls = (S.karte.lines || []).filter(function (l) { return u && l.rid === u; }), ps = (S.karte.pts || []).filter(function (p) { return u && p.sid === u; });
    var as = (S.karte.areas || []).filter(function (f) { return u && f.rid === u; });
    var wls = (S.karte.wl || []).filter(function (p) { return u && p.sid === u; }), gbs = (S.karte.geb || []).filter(function (p) { return u && p.sid === u; });
    var anyK = S.karte.lines.length || S.karte.pts.length || (S.karte.areas || []).length || (S.karte.wl || []).length || (S.karte.geb || []).length || S.karte.sond.length || S.karte.notes.length || S.karte.overlay;
    if (anyK) { var xb = document.createElement("button"); xb.type = "button"; xb.className = "btn ghost small"; xb.textContent = tt("ex_btn"); xb.addEventListener("click", exportOpen); w.appendChild(xb); }
    if (tab === "schacht" ? ps.length : tab === "belag" ? as.length : tab === "werkloch" ? wls.length : tab === "geb" ? gbs.length : ls.length) {
      var pv = KARTE.preview(ls.map(function (l) { return l.pts; }), tt, tab === "schacht" ? ps.map(function (p) { return p.pt; }) : [], tab === "belag" ? as.map(function (f) { return f.pts; }) : [], tab === "werkloch" ? wls.map(function (p) { return p.pt; }) : [], tab === "geb" ? gbs.map(function (p) { return p.pt; }) : []); if (pv) w.appendChild(pv);
    }
    b.addEventListener("click", function () { openKarte(cfg, tab, b, m); });
    return w;
  }
  /* Pflichtangaben je Datensatz */
  function reqInfo(tab, c) {
    var ch = [["f_name", String(c.name || "").trim() !== ""]];
    if (tab === "graben") ch.push(["f_L", num(c.L, 0) > 0], ["f_T", num(c.T, 0) > 0], ["f_n", c.rohrSystem === "block" || num(c.n, 0) > 0]);
    else if (tab === "schacht") ch.push(["f_typ", !!c.typ]);
    else if (tab === "werkloch") ch.push(["f_ts", ["ts", "bo", "sg", "zs"].some(function (k) { return num(c[k], 0) > 0; })]);
    else if (tab === "fund") ch.push(["f_vk", !!(c.vk || c.kvs)]);
    else if (tab === "geb") ch.push(["f_n", num(c.n, 0) > 0]);
    else if (tab === "belag" && c.indiv) ch.push(["f_B", num(c.B, 0) > 0], ["f_Lbel", num(c.L, 0) > 0]);
    var miss = ch.filter(function (x) { return !x[1]; }).map(function (x) { return tt(x[0]).replace(/ \[.*\]/, ""); });
    return { tot: ch.length, ok: ch.length - miss.length, miss: miss };
  }
  function reqEl(tab, c) {
    var p = document.createElement("p"); if (tab === "hon" || tab === "allg") return p;
    var r = reqInfo(tab, c); p.className = "reqline " + (r.miss.length ? "open" : "ok");
    p.textContent = r.miss.length ? fill(tt("ux_reqOpen"), { a: r.ok, b: r.tot }) + " – " + tt("ux_reqMiss") + " " + r.miss.join(", ") : "✓ " + tt("ux_reqOk");
    return p;
  }
  var recListOpen = false;
  function recListEl(list, cur) {
    var d = document.createElement("details"); d.className = "reclist"; if (list.length < 2) { d.hidden = true; return d; } d.open = recListOpen;
    d.addEventListener("toggle", function () { recListOpen = d.open; });
    d.innerHTML = "<summary>" + esc(tt("ux_recAll")) + " (" + list.length + ')</summary><input type="search" class="recq" aria-label="' + esc(tt("ux_recSearch")) + '" placeholder="' + esc(tt("ux_recSearch")) + '"><ul class="recul"></ul>';
    var ul = d.querySelector("ul"), q = d.querySelector("input");
    function fillList() {
      var f = q.value.trim().toLowerCase(); ul.innerHTML = "";
      list.forEach(function (r, i) {
        if (f && String(r.name || "").toLowerCase().indexOf(f) < 0) return;
        var ok = !reqInfo(S.tab, r).miss.length, li = document.createElement("li");
        li.innerHTML = '<button type="button" data-recgo="' + i + '"' + (i === cur ? ' aria-current="true"' : "") + ">" + (i + 1) + ". " + esc(r.name || "–") + ' <span class="' + (ok ? "ok" : "open") + '">' + (ok ? "✓" : "⚠ " + esc(tt("ux_reqShort"))) + "</span></button>";
        ul.appendChild(li);
      });
      if (!ul.children.length) ul.innerHTML = '<li class="kmnote">' + esc(tt("km_none")) + "</li>";
    }
    q.addEventListener("input", fillList); fillList(); return d;
  }

  /* Reiter Plan: PDF/Bild einsetzen, kalibrieren, Linien/Schächte/Sondagen setzen */
  var planSrc = null;
  function planEl() {
    var w = document.createElement("div"); w.className = "elbody formbody planbox"; var P = S.plan;
    var h = document.createElement("p"); h.className = "hint"; h.textContent = tt("pl_intro"); w.appendChild(h);
    var f = document.createElement("div"); f.className = "field";
    f.innerHTML = '<label for="plFile">' + esc(tt("pl_file")) + '</label><input type="file" id="plFile" accept=".pdf,application/pdf,image/*">';
    var msg = document.createElement("p"); msg.className = "hint kmmsg"; msg.setAttribute("role", "status"); f.appendChild(msg); w.appendChild(f);
    var pg = document.createElement("div"); pg.className = "field"; pg.hidden = true; w.appendChild(pg);
    function setPlan(r) {
      var sn = snapState(); S.plan = { img: r.img, w: r.w, h: r.h, cal: r.mpp ? { scale: r.mpp, m: r.w * r.mpp, a: [0, r.h / 2], b: [r.w, r.h / 2], auto: r.ratio } : {}, lines: [], pts: [], sond: [], notes: [], areas: [], wl: [], geb: [] }; sondSync(); save(); renderForm(); undoToast(r.mpp ? fill(tt("pl_loadedAuto"), { r: r.ratio }) : tt("pl_loaded"), sn);
    }
    f.querySelector("input").addEventListener("change", function (e) {
      var file = e.target.files[0]; if (!file) return; msg.className = "hint kmmsg"; msg.textContent = tt("pl_reading"); planSrc = null;
      KARTE.planSource(file).then(function (src) {
        planSrc = src; msg.textContent = "";
        if (src.pages > 1) {
          pg.hidden = false; pg.innerHTML = '<label for="plPage">' + esc(tt("pl_page")) + '</label><select id="plPage">' + Array.apply(null, Array(src.pages)).map(function (_, i) { return '<option value="' + (i + 1) + '">' + (i + 1) + " / " + src.pages + "</option>"; }).join("") + '</select> <button type="button" class="btn small" id="plPageGo">' + esc(tt("pl_pageGo")) + "</button>";
          pg.querySelector("button").addEventListener("click", function () { msg.textContent = tt("pl_reading"); src.render(+pg.querySelector("select").value).then(setPlan).catch(function () { msg.className = "hint kmmsg reqmsg"; msg.textContent = tt("pl_err"); }); });
        } else src.render(1).then(setPlan);
      }).catch(function () { msg.className = "hint kmmsg reqmsg"; msg.textContent = tt("pl_err"); });
    });
    if (P.img) {
      var c = P.cal && P.cal.scale, st = document.createElement("p"); st.className = "reqline " + (c ? "ok" : "open");
      st.textContent = (c ? "✓ " + (P.cal.auto ? fill(tt("pl_calAuto"), { r: P.cal.auto, s: Math.round(P.cal.scale * 1000) / 1000 }) : fill(tt("pl_calOk"), { m: KARTE.fmt(P.cal.m), s: Math.round(P.cal.scale * 1000) / 1000 })) : "⚠ " + tt("pl_calNo")) + " · " + fill(tt("km_total"), { m: KARTE.fmt(P.lines.reduce(function (a, l) { return a + (c ? KARTE.total([l.pts]) * P.cal.scale : 0); }, 0)), n: P.lines.length, s: P.pts.length, o: P.sond.length });
      w.appendChild(st);
      var pv = KARTE.planPreview(P, tt); if (pv) w.appendChild(pv);
      var hn = document.createElement("p"); hn.className = "hint"; hn.textContent = tt("pl_mapHint"); w.appendChild(hn);
      var bt = document.createElement("div"); bt.className = "toolrow";
      bt.innerHTML = '<button type="button" class="btn" id="plOpen">' + esc(tt("pl_open")) + '</button><button type="button" class="btn" id="plMap">' + esc(tt("pl_toMap")) + '</button><button type="button" class="btn ghost" id="plExp">' + esc(tt("ex_btn")) + '</button><button type="button" class="btn ghost small del" id="plDel">' + esc(tt("pl_remove")) + "</button>";
      w.appendChild(bt);
      bt.querySelector("#plExp").addEventListener("click", exportOpen);
      bt.querySelector("#plMap").addEventListener("click", function () {
        var pb = bt.querySelector("#plMap"), mm = document.createElement("p"); mm.className = "hint kmmsg"; mm.setAttribute("role", "status"); bt.insertAdjacentElement("afterend", mm);
        openKarte(null, "plan", pb, mm, { autoPlan: true, focus: "#plMap" });
      });
      bt.querySelector("#plDel").addEventListener("click", function () { var sn = snapState(); S.plan = { img: "", w: 0, h: 0, cal: {}, lines: [], pts: [], sond: [], notes: [], areas: [], wl: [], geb: [] }; sondSync(); save(); renderForm(); undoToast(tt("pl_removed"), sn); });
      bt.querySelector("#plOpen").addEventListener("click", function () {
        msg.className = "hint kmmsg"; msg.textContent = tt("km_loading");
        KARTE.load().then(function () {
          msg.textContent = "";
          KARTE.open({ kind: "plan", tt: tt, lang: S.lang, cat: karteCat(), labels: mkLabels, plan: { img: P.img, w: P.w, h: P.h, cal: P.cal }, model: { lines: JSON.parse(JSON.stringify(P.lines)), pts: JSON.parse(JSON.stringify(P.pts)), sond: JSON.parse(JSON.stringify(P.sond)), notes: JSON.parse(JSON.stringify(P.notes || [])), areas: JSON.parse(JSON.stringify(P.areas || [])), wl: JSON.parse(JSON.stringify(P.wl || [])), geb: JSON.parse(JSON.stringify(P.geb || [])) },
            defRohr: { sys: "k55", dn: "55", len: "10", n: "1" }, defTyp: "KES150", defGeb: { cm: "", abd: "hauff" }, defBelag: { bk: "gehweg", d: "0.08", wi: "B" }, recName: function (id) { return recName("graben")(id) || recName("schacht")(id) || recName("belag")(id) || recName("werkloch")(id) || recName("geb")(id); },
            onClose: function () { var o = $("#plOpen"); if (o) o.focus(); },
            onApply: function (M, cal, lenFn, fns) { var sn = snapState(), st2 = karteApply(M, null, lenFn, Object.assign({ src: "plan" }, fns)); S.plan.areas = M.areas || []; S.plan.wl = M.wl || []; S.plan.geb = M.geb || []; S.plan.cal = cal; S.plan.lines = M.lines; S.plan.pts = M.pts; S.plan.sond = M.sond; S.plan.notes = M.notes || []; syncDerived(null, st2); save(); renderForm(); renderResult(); undoToast(fill(tt("km_done"), st2) + (st2.x ? " ⚠ " + fill(tt("km_conflict"), st2) : ""), sn); }
          });
        }).catch(function () { msg.className = "hint kmmsg reqmsg"; msg.textContent = tt("km_offline"); });
      });
    }
    return w;
  }
  function renderForm() {
    var host = $("#form"); host.innerHTML = "";
    var h = document.createElement("h2"); h.innerHTML = '<span class="num">1</span>' + esc(tt("ht_" + S.tab)); host.appendChild(h);
    $("#main").classList.toggle("planmode", S.tab === "plan");
    if (S.tab === "par") { host.appendChild(parEl()); renderTabs(); return; }
    if (S.tab === "plan") { host.appendChild(planEl()); renderTabs(); return; }
    var list = S.recs[S.tab], i = S.idx[S.tab], cfg = rec();
    var nav = document.createElement("div"); nav.className = "recnav";
    nav.innerHTML = '<button type="button" class="btn ghost small" data-rec="prev" aria-label="' + esc(tt("ux_prev")) + '" title="' + esc(tt("ux_prev")) + '"' + (i <= 0 ? " disabled" : "") + '>◀</button><span class="recpos">' + esc(tt("rec")) + " <b>" + (i + 1) + "</b> " + esc(tt("of")) + " " + list.length +
      '<br><span class="ctx" id="recName">' + esc(cfg.name) + '</span></span><button type="button" class="btn ghost small" data-rec="next" aria-label="' + esc(tt("ux_next")) + '" title="' + esc(tt("ux_next")) + '"' + (i >= list.length - 1 ? " disabled" : "") + ">▶</button>" +
      '<span class="sp"></span><button type="button" class="btn small" data-rec="new">' + esc(tt("recNew")) + '</button><button type="button" class="btn ghost small" data-rec="dup">' + esc(tt("recDup")) + '</button><button type="button" class="btn ghost small del" data-rec="del">' + esc(tt("recDel")) + "</button>";
    host.appendChild(nav);
    host.appendChild(recListEl(list, i)); host.appendChild(reqEl(S.tab, cfg));
    var fig = document.createElement("figure"); fig.className = "fig"; fig.innerHTML = '<div id="figsvg"></div>'; host.appendChild(fig);
    var body = document.createElement("div"); body.className = "elbody formbody";
    var halfBox = null;
    F[S.tab].forEach(function (f) {
      if (f.show && !f.show(cfg)) return;
      var tgt = body;
      if (f.half) { if (!halfBox) { halfBox = document.createElement("div"); halfBox.className = "row2"; body.appendChild(halfBox); } tgt = halfBox; } else halfBox = null;
      if (f.sec) { var h4 = document.createElement("h3"); h4.className = "sec"; h4.textContent = tt(f.sec); body.appendChild(h4); return; }
      if (f.t === "trasse") { tgt.appendChild(trasseEl(cfg)); return; }
      if (f.t === "blockList") { tgt.appendChild(blockListEl(cfg)); return; }
      if (f.t === "abzwList") { tgt.appendChild(abzwListEl(cfg)); return; }
      if (f.t === "opts") { tgt.appendChild(optsEl(cfg)); return; }
      if (f.t === "phases") { tgt.appendChild(phasesEl(cfg)); return; }
      if (f.t === "honFak") { tgt.appendChild(honFakEl()); return; }
      if (f.t === "honVarHint") { var vh = document.createElement("p"); vh.className = "hint"; vh.textContent = tt("hx_var"); tgt.appendChild(vh); return; }
      if (f.t === "honRes") { var hr = document.createElement("div"); hr.id = "honres"; tgt.appendChild(hr); return; }
      if (f.t === "honB") { if (cfg.src === "man") tgt.appendChild(fieldEl(cfg, { id: "B", t: "num", labKey: "f_hB" })); else { var d = document.createElement("div"); d.className = "field"; d.innerHTML = '<label for="honBv">B [CHF]</label><input type="text" id="honBv" readonly>'; tgt.appendChild(d); } return; }
      if (f.t === "printDraw") { var pd = document.createElement("div"); pd.className = "check"; pd.innerHTML = '<input type="checkbox" id="fPrintDraw"' + (S.ui.printDraw ? " checked" : "") + '><label for="fPrintDraw">' + esc(tt("f_printDraw")) + "</label>"; tgt.appendChild(pd);
        pd.querySelector("input").addEventListener("change", function () { S.ui.printDraw = this.checked; save(); renderResult(); }); return; }
      if (f.t === "zub") { var zb = document.createElement("div"); zb.id = "zubbox"; tgt.appendChild(zb); zubRender(); return; }
      if (f.t === "rohrLists") { var ls = document.createElement("div"); ls.className = "lists";
        ls.appendChild(listEl(cfg, "rohre", KVE.ROH, "l_rohre", "m")); ls.appendChild(listEl(cfg, "schn", KVE.ROH, "l_schn", "St"));
        ls.appendChild(listEl(cfg, "boe", KVE.BOE, "l_boe", "St")); ls.appendChild(listEl(cfg, "muf", KVE.MUF, "l_muf", "St")); tgt.appendChild(ls); return; }
      tgt.appendChild(fieldEl(f.glob ? S : cfg, f));
    });
    host.appendChild(body);
    var ni = ALLTABS.indexOf(S.tab) + 1;
    if (ni < ALLTABS.length) { var nx = document.createElement("div"); nx.className = "nextrow"; nx.innerHTML = '<button type="button" class="btn" data-nexttab="' + ALLTABS[ni] + '">' + esc(fill(tt("ux_nextTab"), { t: tt("tab_" + ALLTABS[ni]) })) + "</button>"; host.appendChild(nx); }
    if (S.tab !== "hon") { var xb = xBlockEl(cfg); if (xb) host.appendChild(xb); host.appendChild(freeEl(cfg)); }
    refreshFig(); if (S.tab === "hon") refreshHon();
    renderTabs();
    host.querySelectorAll("input[inputmode=decimal], input.numin").forEach(function (e) { if (window.numCheck) numCheck(e); });
    aussenReq();
    var tc = $("#tabCur"); if (tc && tc.scrollIntoView && $("#tabs").scrollWidth > $("#tabs").clientWidth) tc.scrollIntoView({ block: "nearest", inline: "center" });
  }
  function parEl() {
    var w = document.createElement("div"); w.className = "elbody formbody";
    var P = S.par, rows = [["dichte", S], ["mwst", S], ["deckG", P], ["deckS", P], ["deckK", P], ["gehMin", P], ["gehMax", P], ["strMin", P], ["strMax", P], ["kanMin", P], ["kanMax", P]];
    var h = '<p class="hint">' + esc(tt("parH")) + '</p><table class="cost ptab"><tbody>' + rows.map(function (r) { return "<tr><td>" + esc(tt("p_" + r[0])) + '</td><td class="num"><input class="mini" data-p="' + r[0] + '" data-o="' + (r[1] === S ? "S" : "P") + '" aria-label="' + esc(tt("p_" + r[0])) + '" value="' + esc(r[1][r[0]]) + '"></td></tr>'; }).join("") + "</tbody></table>";
    h += "<h3>" + esc(tt("dimT")) + '</h3><table class="cost ptab"><tbody>';
    [["wl", function (k) { return tt("tab_werkloch") + " " + String(tt("f_" + k)).replace(/ \[.*\]/, ""); }], ["fund", function (k) { return tt("s_fund") + " " + k; }]].forEach(function (g) {
      Object.keys(S.D[g[0]]).forEach(function (k) { h += "<tr><td>" + esc(g[1](k)) + "</td>" + [0, 1, 2].map(function (i) { return '<td class="num"><input class="mini" data-d="' + g[0] + "|" + esc(k) + "|" + i + '" value="' + S.D[g[0]][k][i] + '" aria-label="' + esc(g[1](k)) + " " + "LBH"[i] + '"></td>'; }).join("") + "</tr>"; });
    });
    h += "</tbody></table>";
    var A = autoSet(), keys = Object.keys(LV), per = {}, auto = 0, no = 0;
    keys.forEach(function (p) { if (A[p]) auto++; var t = XT(p); if (LVTABS.indexOf(t) >= 0) per[t] = (per[t] || 0) + 1; else no++; });
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
        (l.rule ? '<div class="rw rule">' + esc(l.rule) + "</div>" : "") + '</td><td class="num">' + qf(l.qty) + "</td><td>" + esc(l.unit) + '</td><td class="num">—</td><td class="num">—</td></tr>';
    }
    var cls = l.flag === "ausserLV" ? "bad" : l.flag === "epGeaendert" ? "chg" : "", mark = l.flag === "ausserLV" ? " ⚠" : l.flag === "epGeaendert" ? " ✎" : "";
    var txt = /^\d{3}\//.test(l.key) ? lvT(l.key) : l.text, ctx = /^\d{3}\//.test(l.key) ? lvC(l.key) : l.ctx;
    return '<tr class="' + cls + '"><td class="art">' + esc(l.key) + (l.ks === "Belag" ? '<sup class="ks">B</sup>' : "") + "</td><td>" + (ctx ? '<span class="ctx">' + esc(ctx) + "</span>" : "") + "<div>" + esc(txt) + mark + "</div>" +
      (l.rule ? '<div class="rw rule">' + esc(l.rule) + "</div>" : "") + '</td><td class="num">' + qf(l.qty) + "</td><td>" + esc(l.unit) + '</td><td class="num">' + chf(l.ep) + '</td><td class="num">' + chf(l.total) + "</td></tr>";
  }
  function head() { return "<thead><tr><th>" + esc(tt("c_pos")) + "</th><th>" + esc(tt("c_text")) + '</th><th class="num">' + esc(tt("c_qty")) + "</th><th>" + esc(tt("c_unit")) + '</th><th class="num">' + esc(tt("c_ep")) + '</th><th class="num">' + esc(tt("c_tot")) + "</th></tr></thead>"; }
  function groupedRows(lines) { var h = ""; ORDER.forEach(function (g) { var ls = lines.filter(function (l) { return l.grp === g; }); if (!ls.length) return; h += '<tr class="grp"><td colspan="6">' + esc(tt(g)) + "</td></tr>" + ls.map(rowHtml).join(""); }); return h; }
  function blk(id, title, sum, inner, cur, go) {
    var closed = cur ? false : S.ui.closed[id] !== false;   /* Standard: eingeklappt – nur der bearbeitete Datensatz ist offen */
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
      h += '<h4 class="h5">' + esc(ts.hStueck) + '</h4><table class="stk"><thead><tr><th>' + esc(ts.thArt) + "</th><th>" + esc(ts.thBez) + '</th><th class="num">' + esc(ts.thStk) + '</th><th class="num">' + esc(ts.thTot) + '</th><th class="num">' + esc(ts.thKg) + '</th><th class="no-print">HGC</th></tr></thead><tbody>';
      rows.forEach(function (rw) { var p = SP[rw[0]], tot = rw[0] === "137.787.8" ? spare : rw[1] * g.n, w = p.kg != null ? p.kg * tot : null; if (w) kg += w;
        h += '<tr><td class="art">' + esc(rw[0]) + "</td><td>" + esc(p.n[S.lang] || p.n.de) + (g.incl && !g.ersatz ? '<div class="rw">' + esc(ts.kIncl) + "</div>" : "") + '</td><td class="num">' + (rw[0] === "137.787.8" ? "—" : rw[1]) + '</td><td class="num">' + tot + '</td><td class="num">' + (w != null ? qf(w) + " kg" : "—") + '</td><td class="no-print"><a class="hgc" href="' + esc(hgcLink(rw[0])) + '" target="_blank" rel="noopener">' + esc(ts.hgcOpen) + "</a></td></tr>"; });
      h += '</tbody><tfoot><tr><td colspan="4">' + esc(ts.sumWeight) + '</td><td class="num">' + qf(kg) + ' kg</td><td class="no-print"></td></tr></tfoot></table>';
      if (rows.some(function (rw) { return rw[1] === 2; })) h += '<p class="note">' + esc(ts.note2x) + "</p>";
      h += '<p class="note">' + esc(ts.noteWeights) + "</p>";
    }
    if (g.mass && g.mass.length) {
      h += '<h4 class="h5">' + esc(ts.hMassen) + '</h4><table class="stk"><thead><tr><th>' + esc(ts.thPos) + '</th><th>' + esc(ts.thUnit) + '</th><th class="num">' + esc(ts.thPer) + '</th><th class="num">' + esc(ts.thTot2) + "</th></tr></thead><tbody>" +
        g.mass.map(function (m) { return "<tr><td>" + esc(ts[m[0]] || m[0]) + "</td><td>" + esc(m[1]) + '</td><td class="num">' + qf(m[3]) + '</td><td class="num">' + qf(r2(m[2])) + "</td></tr>"; }).join("") + '</tbody></table><p class="note">' + esc(ts.noteMass) + "</p>";
    }
    if (lv === "stop" || lv === "amber" || c.deviate) {
      h += '<div class="freigabe"><h3>' + esc(ts.fgTitle) + '</h3><table><tbody><tr><th>' + esc(ts.fgReason) + "</th><td>" + esc(c.reason || ts.fgOpen) + "</td></tr><tr><th>" + esc(ts.fgApprover) + "</th><td>" + esc(c.approver || ts.fgOpen) + "</td></tr><tr><th>" + esc(ts.fgJournal) + "</th><td>" + esc(c.journal ? ts.fgYes : ts.fgNo) + '</td></tr></tbody></table><div class="sigline"><div>' + esc(ts.fgSig1) + "</div><div>" + esc(ts.fgSig2) + "</div></div></div>";
    }
    if (S.ui.printDraw) {
      var figs = [];
      if (!g.ersatz && SIMG["PLAN_" + g.shaft]) figs.push(["PLAN_" + g.shaft, ts.planLabel + " " + SHAFTS[g.shaft].plan, SHAFTS[g.shaft].n[S.lang] || SHAFTS[g.shaft].n.de]);
      rows.forEach(function (rw) { if (SIMG[rw[0]]) figs.push([rw[0], rw[0], (SP[rw[0]].n[S.lang] || SP[rw[0]].n.de).split(",")[0]]); });
      if (figs.length) h += '<h4 class="h5">' + esc(ts.hFigs) + '</h4><div class="figs">' + figs.map(function (f) { return '<figure><img src="' + SIMG[f[0]] + '" alt="' + esc(f[1]) + '" loading="lazy" data-lb="' + esc(f[0]) + '"><figcaption><b>' + esc(f[1]) + "</b> · " + esc(f[2]) + "</figcaption></figure>"; }).join("") + "</div>";
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

  /* Kostenleiste (immer sichtbar) und mobile Leiste: Netto, Total, Rabattstufe, OFFEN, Warnungen */
  function warnGo(w) { return w.tab ? '<a href="#" class="wgo" data-go="' + w.tab + ":" + w.idx + '">' + esc(tt("tab_" + w.tab) + " · " + w.el) + "</a>: " : ""; }
  function kpiRender(out, hon, n) {
    var s = out.sum, nStop = out.warn.filter(function (w) { return w.sev === "stop"; }).length, nAmb = out.warn.filter(function (w) { return w.sev === "amber"; }).length;
    var hn = r2(hon.reduce(function (a, x) { return a + x[1].net; }, 0)), cell = function (lab, v, cls) { return '<div class="kc' + (cls ? " " + cls : "") + '"><span class="kl">' + esc(lab) + '</span><b class="kv">CHF ' + chf(v) + "</b></div>"; };
    var tags = '<span class="tag">' + esc(fill(tt("ux_stufe"), { s: s.stufe, p: s.pct })) + "</span>" +
      (out.nOffen ? '<span class="tag amber">' + esc(fill(tt("ux_offen"), { n: out.nOffen })) + "</span>" : "") +
      (nStop ? '<a href="#warns" class="tag stop">' + esc(fill(tt("ux_stop"), { n: nStop })) + "</a>" : "") +
      (nAmb ? '<a href="#warns" class="tag amber">' + esc(fill(tt("ux_warn"), { n: nAmb })) + "</a>" : "");
    $("#kpi").innerHTML = '<div class="kpi-main">' + cell(tt("ux_netto"), s.netto, "main") + cell(tt("ux_brutto"), s.brutto) + (hon.length ? cell(tt("ux_hon"), hn) : "") + "</div>" + (n ? '<div class="kpi-tags">' + tags + "</div>" : "");
    $("#mbar").setAttribute("role", "region"); $("#mbar").setAttribute("aria-label", tt("h_kosten"));
    $("#mbar").innerHTML = '<div><span class="kl">' + esc(tt("ux_netto")) + '</span><b>CHF ' + chf(s.netto) + "</b>" + (nStop ? ' <span class="tag stop">' + nStop + " !</span>" : "") + '</div><a class="btn" href="#kpi">' + esc(tt("ux_toRes")) + " ↓</a>";
  }
  /* LV rechts (ab 1500 px): Zusammenstellung und Kosten wie im Ausdruck, live */
  /* Situation (Karte/Plan) im Ausdruck */
  function situRender() {
    var old = $("#result .situ"); if (old) old.remove();
    var K = S.karte, P = S.plan, hasMap = (K.overlay && ovResolve(K.overlay)) || K.lines.length || K.pts.length || K.sond.length || K.notes.length || (K.areas || []).length || (K.wl || []).length || (K.geb || []).length, hasPlan = !!P.img;
    if (!hasMap && !hasPlan) return;
    var sec = document.createElement("section"); sec.className = "situ no-summary"; var body = document.createElement("div"); body.className = "situbody"; body.id = "situBody";
    if (hasMap) {
      var g = situGeo(), base = K.base || "farbe", bg = K.bg && K.bg.key === KARTE.bgKey(g, 760, 420, base) ? K.bg.src : null;
      g.lab = mkLabels(K, mapFns()); var fig = KARTE.mapFigure(g, tt, { W: 760, H: 420, base: base, bg: bg, labels: true, overlay: ovResolve(K.overlay), cls: "situfig", cap: fill(tt("sit_capMap"), { m: KARTE.fmt(KARTE.total(g.lines)), n: K.pts.length, s: K.sond.length, f: (K.areas || []).length }) }); if (fig) body.appendChild(fig);
    }
    if (hasPlan) { var pv = KARTE.planPreview(P, tt, mkLabels(P, planFns())); if (pv) { pv.className = "situfig"; var cap = document.createElement("figcaption"); cap.textContent = tt("sit_capPlan") + (P.cal && P.cal.scale ? " · " + (P.cal.auto ? "1:" + P.cal.auto : "1 px = " + Math.round(P.cal.scale * 1000) / 1000 + " m") : ""); pv.appendChild(cap); body.appendChild(pv); } }
    /* Auf dem Bildschirm eingeklappt (Zeile mit Zusammenfassung), im Ausdruck immer sichtbar */
    var open = !!S.ui.situOpen, nOb = K.lines.length + K.pts.length + K.sond.length + (K.areas || []).length + (K.wl || []).length + (K.geb || []).length + K.notes.length + (P.lines || []).length + (P.pts || []).length + (P.areas || []).length;
    var head = document.createElement("div"); head.className = "situhead no-print";
    head.innerHTML = '<h3>' + esc(tt("sit_h")) + '</h3><button type="button" class="btn ghost small" id="situTog" aria-expanded="' + open + '" aria-controls="situBody">' + esc(tt(open ? "sit_hide" : "sit_show")) + '</button><button type="button" class="btn ghost small" id="situExp">' + esc(tt("ex_btn")) + "</button>";
    var sum = document.createElement("p"); sum.className = "hint situsum no-print"; sum.textContent = fill(tt("sit_sum"), { o: nOb, m: KARTE.fmt(KARTE.total(K.lines.map(function (l) { return l.pts; }))), p: hasPlan ? tt("sit_withPlan") : "" });
    var h3p = document.createElement("h3"); h3p.className = "print-only"; h3p.textContent = tt("sit_h");
    body.hidden = !open; sec.appendChild(head); sec.appendChild(h3p); sec.appendChild(sum); sec.appendChild(body);
    head.querySelector("#situExp").addEventListener("click", exportOpen);
    head.querySelector("#situTog").addEventListener("click", function () { S.ui.situOpen = !S.ui.situOpen; save(); situRender(); });
    var st = $("#result .status"); if (st) st.insertAdjacentElement("afterend", sec); else $("#result").insertBefore(sec, $("#result").firstChild);
  }
  function situGeo() { var K = S.karte; return { lines: K.lines.map(function (l) { return l.pts; }), pts: K.pts.map(function (p) { return p.pt; }), areas: (K.areas || []).map(function (a) { return a.pts; }), sond: K.sond.map(function (p) { return p.pt; }), wl: (K.wl || []).map(function (p) { return p.pt; }), geb: (K.geb || []).map(function (p) { return p.pt; }), notes: K.notes, extra: KARTE.ovCorners(ovResolve(K.overlay)) }; }
  /* Beschriftungen: Linie = Name · Länge · Rohranlage; Schacht = Name · Typ; Sondage, Werkloch, Gebäudeeinführung, Fläche */
  function mkLabels(M, fns) {
    var rn = function (id) { return recName("graben")(id) || recName("schacht")(id) || recName("belag")(id) || recName("werkloch")(id) || recName("geb")(id); };
    var SYS = { k55: "K55", laengs: tt("o_rohrSystem_laengs").split(" (")[0], block: tt("o_rohrSystem_block").split(" (")[0] };
    return {
      lines: (M.lines || []).map(function (l, i) { var s2 = (rn(l.rid) || tt("km_lineN").replace("{n}", i + 1)) + " · " + KARTE.fmt(fns.len(l.pts)) + " m"; if (l.rohr) s2 += " · " + (l.rohr.sys === "block" ? SYS.block : SYS[l.rohr.sys] + " DN" + l.rohr.dn + " ×" + (l.rohr.n || "1")); return s2; }),
      pts: (M.pts || []).map(function (p, i) { return (p.name || rn(p.sid) || tt("km_schN").replace("{n}", i + 1)) + " · " + p.typ; }),
      sond: (M.sond || []).map(function (p, i) { return (p.name || "S" + (i + 1)) + " · " + p.l + "×" + p.b + "×" + p.t + " m"; }),
      wl: (M.wl || []).map(function (p, i) { return (p.name || "W" + (i + 1)) + " · " + tt("km_wl" + p.wt); }),
      geb: (M.geb || []).map(function (p, i) { return (p.name || rn(p.sid) || "G" + (i + 1)) + (p.cm ? " · " + p.cm + " cm" : ""); }),
      areas: (M.areas || []).map(function (f, i) { return (rn(f.rid) || tt("km_areaN").replace("{n}", i + 1)) + " · " + KARTE.fmt(fns.area(f.pts)) + " m²"; })
    };
  }
  var mapFns = function () { return { len: function (pts) { return KARTE.total([pts]); }, area: function (pts) { return KARTE.polyArea(pts); } }; };
  var planFns = function () { var sc = (S.plan.cal && S.plan.cal.scale) || 0; return { len: function (pts) { return KARTE.total([pts]) * sc; }, area: function (pts) { return KARTE.polyArea(pts) * sc * sc; } }; };
  function exportOpen() {
    var K = S.karte, P = S.plan, src = {}, hasMap = (K.overlay && ovResolve(K.overlay)) || K.lines.length || K.pts.length || K.sond.length || K.notes.length || (K.areas || []).length || (K.wl || []).length || (K.geb || []).length;
    if (hasMap) { var g = situGeo(); g.lab = mkLabels(K, mapFns()); src.map = { geo: g, overlay: ovResolve(K.overlay), base: K.base || "farbe" }; }
    if (P.img) { var pg = KARTE.planGeo(P); pg.lab = mkLabels(P, planFns()); src.plan = { geo: pg, P: { img: P.img, w: P.w, h: P.h, mpp: (P.cal && P.cal.scale) || 0 } }; }
    if (!src.map && !src.plan) return;
    KARTE.load().catch(function () { }).then(function () {
      KARTE.exportDlg({ tt: tt, lang: S.lang, src: src, meta: { projekt: S.kopf.projekt || "", datum: S.kopf.datum || today(), bearb: S.kopf.bearb || "", title: "" } });
    });
  }
  /* Overlay-Bild: Verweis auf den Plan-Reiter (keine Doppelspeicherung) oder eingebettet */
  function ovResolve(o) { if (!o) return null; var r = Object.assign({}, o); if (o.ref === "plan") { if (!S.plan.img) return null; r.img = S.plan.img; r.w = S.plan.w; r.h = S.plan.h; } return r.img ? r : null; }
  function cacheSitu() { var g = situGeo(), base = S.karte.base || "farbe"; KARTE.cacheBg(g, base, 760, 420, function (bg) { S.karte.bg = bg; save(); situRender(); }); }
  /* Breite Tabellen: horizontal scrollbar UND per Tastatur erreichbar (WCAG 2.1.1) */
  function wrapTables(root) {
    var k = 0;
    root.querySelectorAll("table").forEach(function (t) {
      if (t.classList.contains("cost") || (t.parentNode && t.parentNode.classList.contains("tscroll"))) return;
      var w = document.createElement("div"); w.className = "tscroll"; w.tabIndex = 0; w.setAttribute("role", "region"); var box = t.closest(".elres"), ttl = box && box.querySelector(".elhead") ? box.querySelector(".elhead").firstChild.textContent.trim() : "";
      w.setAttribute("aria-label", (ttl ? ttl + " – " : "") + tt("ux_tableScroll") + " " + (++k));
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
  }
  function lvRender(lvHtml, hon, out) {
    var el = $("#lvcol"); if (!el) return;
    document.body.classList.toggle("lv-on", S.ui.lvCol !== false);
    var h = '<div class="lvhead"><h2>' + esc(tt("lv_title")) + '</h2><button type="button" class="btn ghost small" data-lvtoggle>' + esc(tt("lv_hide")) + "</button></div>";
    el.innerHTML = lvHtml ? h + lvHtml : h + '<p class="hint">' + esc(tt("ux_emptyHint")) + "</p>"; wrapTables(el);
  }
  function renderResult() {
    var out = KVE.calc(S, LV); lastOut = out;
    var lvHtml = "", html = "", stop = out.warn.some(function (w) { return w.sev === "stop"; }), amber = out.warn.some(function (w) { return w.sev === "amber"; });
    var n = 0; out.elems.forEach(function (e) { n += e.lines.length; }); n += out.vor.lines.length + out.be.lines.length;
    var st = n === 0 ? "empty" : stop ? "stop" : amber ? "amber" : "ok";
    html += '<div class="status no-summary ' + (st === "stop" ? "stop" : st === "amber" ? "amber" : "ok") + '"><p class="stitle">' + esc(tt("st_" + st)) + "</p>";
    if (st === "empty") html += '<p class="action">' + esc(tt("ux_emptyHint")) + "</p>";
    if (out.nOffen) html += '<p class="offennote">' + esc(fill(tt("x_nOffen"), { n: out.nOffen })) + "</p>";
    var top = out.warn.filter(function (w) { return w.sev !== "info"; }).slice(0, 4);
    if (top.length) html += "<ul>" + top.map(function (w) { return "<li>" + warnGo(w) + esc(fill(tt("w_" + w.id), w.args)) + "</li>"; }).join("") + "</ul>" + (out.warn.length > top.length ? '<p><a href="#warns">' + esc(tt("ux_allWarn")) + " (" + out.warn.length + ")</a></p>" : "");
    html += "</div>";
    if (n) {
      html += '<div class="no-summary"><h3>' + esc(tt("h_aufst")) + '</h3><div class="collrow no-print"><button type="button" class="btn ghost" data-act="collapse">' + esc(tt("btnCollapse")) + '</button><button type="button" class="btn ghost" data-act="expand">' + esc(tt("btnExpand")) + '</button><button type="button" class="btn ghost" data-act="rules" aria-pressed="' + !!S.ui.rules + '">' + (S.ui.rules ? "✓ " : "") + esc(tt("ux_rules")) + "</button></div>";
      out.elems.forEach(function (e) {
        var cur = S.tab === e.tab && S.idx[e.tab] === e.idx, extra = e.tab === "schacht" ? schachtExtra(e) : "";
        if (!e.lines.length && !extra) return;
        var bal = e.bal && e.bal.length ? '<details class="opts bal"' + (S.ui.rules ? " open" : "") + "><summary>" + esc(tt("h_bal")) + "</summary><table><tbody>" + e.bal.map(function (b) { return "<tr><td>" + esc(tt(b.id)) + '</td><td class="num">' + qf(r2(b.v)) + " " + esc(b.unit) + "</td></tr>"; }).join("") + "</tbody></table></details>" : "";
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
      lvHtml = "<h3>" + esc(tt("h_zus")) + "</h3>" + z + "</tbody></table>";
      html += '<div class="no-summary zusblk">' + blk("zus", tt("h_zus"), out.sum.zwischen, z + "</tbody></table>") + "</div>";
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
      var kost = "<h3>" + esc(tt("h_kosten")) + '</h3><table class="cost"><tbody><tr><td>' + esc(tt("k_zw")) + '</td><td class="num">' + chf(s.zwischen) + "</td></tr>" +
        (s.belag ? '<tr class="sub"><td>' + esc(tt("k_belagKS")) + '</td><td class="num">' + chf(s.belag) + "</td></tr>" : "") +
        "<tr><td>" + esc(fill(tt("k_rabatt"), { s: s.stufe, p: s.pct })) + '</td><td class="num">− ' + chf(s.rabatt) + "</td></tr><tr><td>" + esc(tt("k_nach")) + '</td><td class="num">' + chf(s.nachRabatt) + "</td></tr>" +
        "<tr><td>" + esc(tt("k_inst")) + '</td><td class="num">+ ' + chf(s.inst) + '</td></tr><tr class="sub"><td>' + esc(tt("k_netto")) + '</td><td class="num">' + chf(s.netto) + "</td></tr>" +
        "<tr><td>" + esc(tt("k_mwst")) + " " + qf(s.mwSatz * 100) + ' %</td><td class="num">' + chf(s.mwst) + '</td></tr><tr class="sum"><td>' + esc(tt("k_brutto")) + '</td><td class="num">' + chf(s.brutto) + "</td></tr></tbody></table>";
      html += '<div class="kostblk">' + kost + "</div>"; lvHtml += kost;
    }
    var hon = S.recs.hon.map(function (r) { return [r, honCalc(r, out.sum.netto)]; }).filter(function (x) { return x[1].ok; });
    if (hon.length) {
      var hn = r2(hon.reduce(function (a, x) { return a + x[1].net; }, 0)), hm = r2(hn * num(S.mwst, 8.1) / 100);
      html += "<h3>" + esc(tt("hSum")) + '</h3><table class="cost"><tbody>' + hon.map(function (x) { return "<tr><td>" + esc(x[0].name) + '<div class="rw">' + qf(x[1].Tp) + " h (Tp) × CHF " + chf(num(x[0].h)) + (x[1].NK ? " + " + esc(tt("hNk")) + " " + chf(x[1].NK) : "") + " · B = " + chf(x[1].B) + '</div></td><td class="num">' + chf(x[1].net) + "</td></tr>"; }).join("") +
        '<tr class="sub"><td>' + esc(tt("hTot")) + '</td><td class="num">' + chf(hn) + "</td></tr><tr><td>" + esc(tt("k_mwst")) + '</td><td class="num">' + chf(hm) + '</td></tr><tr><td>' + esc(tt("hTotI")) + '</td><td class="num">' + chf(r2(hn + hm)) + "</td></tr>" +
        '<tr class="sum"><td>' + esc(tt("gTot")) + '</td><td class="num">' + chf(r2(out.sum.brutto + hn + hm)) + "</td></tr></tbody></table>";
    }
    var ws = out.warn.slice().sort(function (a, b) { var r = { stop: 0, amber: 1, info: 2 }; return r[a.sev] - r[b.sev]; });
    if (ws.length) html += '<div class="no-summary"><h3 id="warns" tabindex="-1">' + esc(tt("h_warn")) + '</h3><ul class="warns">' + ws.map(function (w) { return '<li class="' + w.sev + '"><b>' + (w.tab ? '<a href="#" data-go="' + w.tab + ":" + w.idx + '" title="' + esc(tt("ux_go")) + '">' + esc(tt("tab_" + w.tab) + " · " + w.el) + "</a>" : esc(w.el || "")) + "</b> · " + esc(fill(tt("w_" + w.id), w.args)) + "</li>"; }).join("") + "</ul></div>";
    html += '<details class="ref no-summary"><summary>' + esc(tt("h_grund")) + "</summary><ul class='doclist' style='padding:6px 14px'>" + (T[S.lang] || T.de).g_list.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "<li>" + esc(tt("g_lvOnlyDE")) + "</li></ul></details>";
    html += '<div class="sigline print-only"><div>' + esc(tt("sigA")) + "</div><div>" + esc(tt("sigB")) + "</div></div>";
    $("#result").innerHTML = html; wrapTables($("#result")); situRender();
    lvRender(lvHtml, hon, out);
    kpiRender(out, hon, n);
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
  function applyKopf() { KOPF.forEach(function (k) { $("#p_" + k[0]).value = S.kopf[k[0]] || ""; }); $("#p_rolle").value = S.kopf.rolle; $("#p_belagLief").checked = !!S.kopf.belagLief; kopfSum(); }
  function kopfSum() { var k = S.kopf, p = [k.projekt, k.sap ? "SAP " + k.sap : "", k.ort].filter(Boolean).join(" · ");
    $("#kopfSum").innerHTML = "<b>" + esc(tt("ux_kopf")) + '</b><span class="ks">' + esc(p || tt("ux_kopfLeer")) + "</span>"; }
  function applyLang() {
    document.documentElement.lang = S.lang;
    $("#t-title").textContent = tt("title"); $("#t-sub").textContent = tt("sub"); $("#t-role").textContent = tt("creatorRole");
    KOPF.forEach(function (k) { $("#l_" + k[0]).textContent = tt(k[1]); }); $("#l_rolle").textContent = tt("rolle"); $("#l_belagLief").textContent = tt("dv_belagLief");
    var r = $("#p_rolle"); r.innerHTML = ""; ["anv", "bl", "bhv"].forEach(function (v) { var o = document.createElement("option"); o.value = v; o.textContent = tt("r_" + v); r.appendChild(o); }); r.value = S.kopf.rolle;
    $("#helpTitle").textContent = tt("helpTitle"); $("#helpSteps").innerHTML = (T[S.lang] || T.de).help.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); $("#helpNote").textContent = tt("helpNote");
    $("#h-result").textContent = tt("h_result");
    $("#bPrint").textContent = tt("btnPrint"); $("#bPrintSum").textContent = tt("btnPrintSum"); $("#bXlsx").textContent = tt("btnXlsx"); $("#bSave").textContent = tt("btnSave"); $("#bLoad").textContent = tt("btnLoad"); $("#bNew").textContent = tt("btnNew");
    document.querySelectorAll(".langs button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.lang === S.lang ? "true" : "false"); });
    if (window.__EXPDATE && !document.getElementById("expwarn")) { var ew = document.createElement("p"); ew.id = "expwarn"; ew.className = "expwarn no-print"; ew.setAttribute("role", "status"); ew.hidden = window.__EXPDAYS > 7; ew.textContent = fill(tt("ux_validUntil"), { d: window.__EXPDATE, n: window.__EXPDAYS }); var shEl = document.querySelector(".sheet"); if (shEl) shEl.insertBefore(ew, shEl.firstChild); }
    $("#versionline").innerHTML = "<b>" + esc(tt("version")) + " 2.0</b><span>Build " + BUILD + "</span>" + (window.__EXPDATE ? "<span class=\"bad\">" + esc(fill(tt("ux_validUntil"), { d: window.__EXPDATE, n: window.__EXPDAYS })) + "</span>" : "") + "<span>LV DE V1.1 (10.07.2026)</span><span>LV FR V1.0 (27.06.2026)</span><span>LV IT V1.0 (27.06.2026)</span>";
    $("#skipRes").textContent = tt("ux_skip"); $("#lbClose").setAttribute("aria-label", tt("ux_close")); kopfSum();
    LVARR = null; renderForm(); renderResult();
  }
  function init() {
    KOPF.forEach(function (k) { $("#p_" + k[0]).addEventListener("input", function () { S.kopf[k[0]] = this.value; save(); kopfSum(); }); });
    if (S.ui.kopfZu !== false) $("#kopfbox").open = false;   /* Projektangaben standardmässig eingeklappt: Arbeitsbereich sofort sichtbar */
    document.body.classList.toggle("rules-on", !!S.ui.rules);   /* Rechenweg nur auf Wunsch */
    $("#kopfbox").addEventListener("toggle", function () { S.ui.kopfZu = !this.open; save(); });
    $("#p_rolle").addEventListener("change", function () { S.kopf.rolle = this.value; save(); });
    $("#p_belagLief").addEventListener("change", function () { S.kopf.belagLief = this.checked; var v = this.checked ? "dritte" : "typN";
      LVTABS.forEach(function (t) { S.recs[t].forEach(function (e) { if (e.belag) e.belag.einbau = v; }); }); save(); renderForm(); renderResult(); });
    var NUMOK = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/;
    window.numCheck = function (el) {
      var v = el.value.trim(), bad = v !== "" && !NUMOK.test(v), id = el.id ? el.id + "_err" : "", m = id && document.getElementById(id);
      el.classList.toggle("bad", bad); if (bad) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
      if (bad && !m && id) { m = document.createElement("p"); m.className = "hint err"; m.id = id; m.textContent = tt("ux_numBad"); el.insertAdjacentElement("afterend", m); el.setAttribute("aria-describedby", id); }
      if (!bad && m) { m.remove(); el.removeAttribute("aria-describedby"); }
    };
    $("#formwrap").addEventListener("input", function (ev) { var e = ev.target; if (e.matches && e.matches("input[inputmode=decimal], input.numin")) numCheck(e); });
    /* Reiter: Pfeiltasten, Pos1/Ende (WAI-ARIA Tabs) */
    $("#tabs").addEventListener("keydown", function (ev) {
      var keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" }, k = keys[ev.key]; if (!k) return; ev.preventDefault();
      var i = ALLTABS.indexOf(S.tab), j = k === "first" ? 0 : k === "last" ? ALLTABS.length - 1 : (i + k + ALLTABS.length) % ALLTABS.length;
      S.tab = ALLTABS[j]; save(); renderForm(); renderResult(); var b = $("#tabCur"); if (b) b.focus();
    });
    document.addEventListener("click", function (ev) { var t = ev.target.closest("[data-lvtoggle]"); if (!t) return; S.ui.lvCol = S.ui.lvCol === false; save(); renderTabs(); renderResult(); });
    $("#tabs").addEventListener("click", function (ev) { var b = ev.target.closest("[data-tab]"); if (!b) return; S.tab = b.dataset.tab; save(); renderForm(); renderResult(); });
    $("#form").addEventListener("click", function (ev) {
      var nt = ev.target.closest("[data-nexttab]"); if (nt) { S.tab = nt.dataset.nexttab; save(); renderForm(); renderResult(); window.scrollTo({ top: $("#tabs").offsetTop - 8 }); return; }
      var rg = ev.target.closest("[data-recgo]"); if (rg) { S.idx[S.tab] = +rg.dataset.recgo; save(); renderForm(); renderResult(); return; }
      var b = ev.target.closest("[data-rec]"); if (!b) return; var a = b.dataset.rec, L = S.recs[S.tab], undoSn = null;
      if (a === "prev") S.idx[S.tab] = Math.max(0, S.idx[S.tab] - 1);
      else if (a === "next") S.idx[S.tab] = Math.min(L.length - 1, S.idx[S.tab] + 1);
      else if (a === "new") { L.push(newRec(S.tab, L.length + 1)); S.idx[S.tab] = L.length - 1; }
      else if (a === "dup") { var c = JSON.parse(JSON.stringify(rec())); c.name = (c.name || "") + " (2)"; delete c.uid; L.splice(S.idx[S.tab] + 1, 0, c); S.idx[S.tab]++; }
      else if (a === "del") { undoSn = snapState(); L.splice(S.idx[S.tab], 1); if (!L.length) L.push(newRec(S.tab, 1)); S.idx[S.tab] = Math.min(S.idx[S.tab], L.length - 1); }
      save(); renderForm(); renderResult(); if (undoSn) undoToast(tt("ux_recDeleted"), undoSn);
    });
    $("#result").addEventListener("click", function (ev) {
      var g = ev.target.closest("[data-go]"); if (g) { ev.preventDefault(); var p = g.dataset.go.split(":"); S.tab = p[0]; S.idx[p[0]] = +p[1]; save(); renderForm(); renderResult(); window.scrollTo({ top: $("#tabs").offsetTop - 8, behavior: "smooth" }); return; }
      var im = ev.target.closest("img[data-lb]"); if (im) { $("#lb img").src = im.src; $("#lb img").alt = im.alt || ""; $("#lb").classList.add("on"); lbFrom = im; $("#lbClose").focus(); return; }
      var t = ev.target.closest("[data-toggle]"); if (t) { var box = t.closest(".elres"), cl = !box.classList.contains("closed"); box.classList.toggle("closed", cl); t.setAttribute("aria-expanded", cl ? "false" : "true"); S.ui.closed[t.dataset.toggle] = cl; save(); return; }
      var a = ev.target.closest("[data-act]"); if (!a) return;
      if (a.dataset.act === "rules") { S.ui.rules = !S.ui.rules; save(); document.body.classList.toggle("rules-on", S.ui.rules); a.setAttribute("aria-pressed", S.ui.rules); a.textContent = (S.ui.rules ? "✓ " : "") + tt("ux_rules");
        document.querySelectorAll("#result details.bal").forEach(function (d) { d.open = S.ui.rules; }); return; }
      var c = a.dataset.act === "collapse";
      document.querySelectorAll("#result .elres").forEach(function (bx) { bx.classList.toggle("closed", c); S.ui.closed[bx.dataset.id] = c; });
    });
    var lbFrom = null, lbShut = function () { if (!$("#lb").classList.contains("on")) return; $("#lb").classList.remove("on"); if (lbFrom && lbFrom.focus) lbFrom.focus(); };
    $("#lb").addEventListener("click", lbShut);
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") lbShut(); });
    var st = [];
    window.addEventListener("beforeprint", function () { st = []; document.querySelectorAll("#result details, #kopfbox").forEach(function (d) { st.push([d, d.open]); d.open = true; }); });
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
    window.__LVD = { S: function () { return S; }, xlsxBytes: xlsxBytes, renderResult: renderResult, F: F, optLabel: optLabel, tt: tt };
  }
  document.addEventListener("DOMContentLoaded", init);
})();
