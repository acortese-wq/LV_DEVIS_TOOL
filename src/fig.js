/* Illustrationen je Reiter (SVG, live aus den Eingaben) – aus LV-Erfassung übernommen und an den KV-Rechenkern angepasst */
var FIG = (function () {
  "use strict";
  var S, tt, num = function (v, d) { v = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(v) ? v : (d || 0); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var fq = function (x) { return (x || 0).toLocaleString("de-CH", { maximumFractionDigits: 2 }); };
  var DEFS = '<defs>' +
    '<pattern id="pGr" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="var(--gravel)"/><circle cx="2" cy="2" r="1.1" fill="var(--gravelD)"/><circle cx="6" cy="5.5" r=".9" fill="var(--gravelD)"/></pattern>' +
    '<pattern id="pSo" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="var(--soil)"/><path d="M0 10L10 0" stroke="var(--soilD)" stroke-width=".7"/></pattern>' +
    '<pattern id="pCo" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="var(--conc)"/><circle cx="3" cy="4" r=".9" fill="var(--concD)"/><path d="M6 7l1.6-1.2" stroke="var(--concD)"/></pattern>' +
    '<pattern id="pBk" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="var(--conc)"/><circle cx="2" cy="2" r="1.3" fill="var(--gravelD)"/><circle cx="5.5" cy="5" r="1" fill="var(--gravelD)"/></pattern>' +
    '<pattern id="pKm" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--asphT)"/><circle cx="3" cy="3" r="1" fill="var(--asph)"/></pattern>' +
    '<pattern id="pWa" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="var(--conc)"/><path d="M0 8L8 0M-2 2L2 -2M6 10L10 6" stroke="var(--concD)" stroke-width="1"/></pattern></defs>';
  var svg = function (w, h, b, lab) { return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(lab || "") + '" xmlns="http://www.w3.org/2000/svg">' + DEFS + b + "</svg>"; };
  var tx = function (x, y, s, c, a) { return '<text x="' + x + '" y="' + y + '" class="' + (c || "sl") + '" text-anchor="' + (a || "start") + '">' + esc(s) + "</text>"; };
  var dimH = function (x1, x2, y, l) { return '<g class="dim"><path d="M' + x1 + " " + y + "H" + x2 + "M" + x1 + " " + (y - 5) + "v10M" + x2 + " " + (y - 5) + 'v10"/></g>' + tx((x1 + x2) / 2, y - 6, l, "sl sb", "middle"); };
  var dimV = function (x, y1, y2, l, a) { a = a || "end"; return '<g class="dim"><path d="M' + x + " " + y1 + "V" + y2 + "M" + (x - 5) + " " + y1 + "h10M" + (x - 5) + " " + y2 + 'h10"/></g>' + tx(a === "end" ? x - 8 : x + 8, (y1 + y2) / 2 + 4, l, "sl sb", a); };
  var leg = function (x, y, items) { return items.map(function (it, i) { return '<rect x="' + x + '" y="' + (y + i * 24) + '" width="18" height="14" fill="' + it[0] + '" stroke="var(--ink)" stroke-width=".6"/>' + tx(x + 26, y + i * 24 + 11, it[1]); }).join(""); };
  var lab = function (k) { return String(tt(k)).replace(/ \[.*\]/, ""); };
  /* Oberfläche aus dem KV-Belagmodell */
  function surf(belag) {
    var m = belag && belag.mode;
    if (m === "bit") return { k: "bit", d: num(belag.d, 130) / 1000 };
    if (m === "humus") return { k: "wiese", d: num((belag.humus || {}).dOber, 30) / 100 };
    if (m === "pflaster") return { k: "pflaster", d: (num((belag.pflaster || {}).dicke, 60) + num((belag.pflaster || {}).fund, 200)) / 1000 };
    return { k: "chauss", d: 0.10 };
  }
  function band(x, y, w, sf, s) {
    if (sf.k === "bit") { var hd = Math.max(4, 0.04 * s), ht = Math.max(5, (sf.d - 0.04) * s);
      return { h: hd + ht, o: '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hd + '" fill="var(--asph)"/><rect x="' + x + '" y="' + (y + hd) + '" width="' + w + '" height="' + ht + '" fill="var(--asphT)"/>' }; }
    if (sf.k === "wiese") { var h = Math.max(8, sf.d * s), bl = ""; for (var i = x + 4; i < x + w; i += 9) bl += '<path d="M' + i + " " + y + "l-2 -6M" + i + " " + y + 'l2 -5" stroke="var(--grass)" stroke-width="1.2"/>';
      return { h: h, o: '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="var(--grassL)"/>' + bl }; }
    if (sf.k === "pflaster") { var hp = Math.max(8, 0.08 * s), o = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hp + '" fill="var(--conc)"/>';
      for (var j = x; j < x + w; j += 14) o += '<path d="M' + j + " " + y + "v" + hp + '" stroke="var(--concD)"/>'; return { h: hp, o: o }; }
    var hc = Math.max(6, 0.10 * s); return { h: hc, o: '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hc + '" fill="url(#pGr)"/>' };
  }
  function surfLabel(b) { var m = b && b.mode || "none"; return tt("o_mode_" + m) + (m === "bit" ? " " + num(b.d, 130) + " mm" : ""); }
  function stagesSVG(typ) {
    if (!typ || typ === "nein") return "";
    var col = function (x, title, layers, note) { var y = 96, o = '<rect x="' + x + '" y="96" width="130" height="26" fill="url(#pGr)" stroke="var(--rule)"/>';
      layers.forEach(function (L) { y -= L.h; o += '<rect x="' + x + '" y="' + y + '" width="130" height="' + L.h + '" fill="' + L.f + '" ' + (L.g ? 'fill-opacity=".25" stroke="var(--amber)" stroke-dasharray="3 2"' : 'stroke="#fff" stroke-width=".5"') + "/>" + (L.l ? tx(x + 138, y + L.h / 2 + 4, L.l, "sm") : ""); });
      return o + tx(x, 16, title, "sl sb") + (note ? tx(x, 32, note, "sm") : "") + tx(x + 138, 112, "Oberbau", "sm"); };
    var Tt = { h: 26, f: "var(--asphT)", l: "AC T" }, D = { h: 12, f: "var(--asph)", l: "AC" }, F = { h: 38, f: "var(--asphT)", l: "AC T" },
      K = { h: 38, f: "url(#pKm)", l: "Kaltmischbelag" }, Dg = { h: 12, f: "var(--asph)", l: "abgefräst", g: 1 }, o = "";
    switch (typ) {
      case "A": o = col(10, "Etappe 1", [K]) + col(320, "Etappe 2", [Tt, D]); break;
      case "A1": o = col(10, "Etappe 1", [Tt, D]); break;
      case "B": o = col(10, "Etappe 1", [Tt, D]); break;
      case "C": o = col(10, "Etappe 1", [F]) + col(320, "Etappe 2", [Tt, D]); break;
      case "C1": o = col(10, "Etappe 1", [F]) + col(320, "Etappe 2 – separat (C2)", [Tt, Object.assign({}, Dg, { l: "AC (C2)" })]); break;
      case "C2": o = col(10, "Bestand", [Tt, Dg]) + col(320, "Etappe 2", [Tt, D]); break;
    }
    return svg(640, 126, o, "Typ " + typ);
  }
  var F = {
    graben: function (r) {
      var T0 = num(r.T, 0.6), mode = r.bmode || "min60", a = num(r.aussen, 0);
      var B = mode === "begangen" ? a + 0.40 : mode === "nicht_begangen" ? a + 0.10 : mode === "manuell" ? num(r.bman, 0.6) : 0.60; if (!(B > 0)) B = 0.6;
      var gy = 46, s = Math.min(180 / T0, 200 / B, 420), tw = B * s, th = T0 * s, x0 = 250 - tw / 2, sf = surf(r.belag);
      var o = '<rect x="20" y="' + gy + '" width="460" height="' + (th + 26) + '" fill="url(#pSo)" opacity=".5"/>', bd = band(20, gy, 460, sf, s); o += bd.o;
      var kies = r.verf && r.verf !== "aushub";
      o += '<rect x="' + x0 + '" y="' + gy + '" width="' + tw + '" height="' + th + '" fill="' + (kies ? "url(#pGr)" : "url(#pSo)") + '" stroke="var(--ink)" stroke-width="1.2"/>';
      var block = r.rohrSystem === "block", uh = block ? Math.min(th * 0.85, num((r.block || {}).hoehe, 0.3) * s) : Math.min(th * 0.85, Math.max(0.12, num(r.umhArea, 0.035) / B) * s), uy = gy + th - uh;
      var ufill = block || r.umhType === "beton" ? "url(#pCo)" : "url(#pBk)", uw = block ? Math.min(tw, num((r.block || {}).breite, 0.5) * s) : tw;
      o += '<rect x="' + (x0 + (tw - uw) / 2) + '" y="' + uy + '" width="' + uw + '" height="' + uh + '" fill="' + ufill + '" stroke="var(--ink)" stroke-width=".8" stroke-dasharray="3 2"/>';
      var pipes = [];
      if (block) (r.bloecke || []).forEach(function (bl) { for (var i = 0; i < Math.min(num(bl.n, 1), 8); i++) pipes.push(num(bl.dn, 55)); });
      else if (r.rohrSystem === "laengs") for (var i2 = 0; i2 < Math.min(num(r.n2, 1), 8); i2++) pipes.push(num(r.dn2, 100));
      else for (var i3 = 0; i3 < Math.min(num(r.n, 1), 12); i3++) pipes.push(num(r.dn, 55));
      if (pipes.length) { var od = function (dn) { return (dn * 1.15 + 5) / 1000; }, rm = Math.max(3, od(Math.max.apply(null, pipes)) / 2 * s), per = Math.max(1, Math.floor((uw - 4) / (2 * rm + 3)));
        pipes.forEach(function (dn, i) { var row = Math.floor(i / per), n = Math.min(per, pipes.length - row * per), k = i % per, rr = Math.max(3, od(dn) / 2 * s);
          var cx = x0 + tw / 2 + (k - (n - 1) / 2) * (2 * rm + 3), cy = gy + th - rm - 4 - row * (2 * rm + 3);
          o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="' + (dn >= 100 ? "var(--pipe2)" : "var(--pipe)") + '" stroke="var(--ink)" stroke-width=".8"/><circle cx="' + cx + '" cy="' + cy + '" r="' + rr * 0.62 + '" fill="var(--figbg)"/>'; }); }
      if (sf.k === "bit") o += '<path d="M' + x0 + " " + (gy - 8) + "v" + (bd.h + 10) + "M" + (x0 + tw) + " " + (gy - 8) + "v" + (bd.h + 10) + '" stroke="var(--cut)" stroke-width="2"/>';
      if (r.gesp) o += '<path d="M' + (x0 + 2) + " " + gy + "V" + (gy + th) + "M" + (x0 + tw - 2) + " " + gy + "V" + (gy + th) + '" stroke="var(--copper)" stroke-width="4"/>';
      var hk = { normal: 0.10, eng: 0.30, sehr_eng: 0.50 }[r.hand] || 0.10;
      o += '<rect x="' + x0 + '" y="' + (gy + bd.h) + '" width="' + tw * hk + '" height="' + (th - bd.h) + '" fill="var(--navy)" opacity=".12"/>';
      o += dimH(x0, x0 + tw, gy - 16, "b = " + fq(B) + " m") + dimV(x0 - 16, gy, gy + th, "T = " + fq(T0) + " m");
      var L = [[sf.k === "bit" ? "var(--asph)" : sf.k === "wiese" ? "var(--grassL)" : sf.k === "pflaster" ? "var(--conc)" : "url(#pGr)", surfLabel(r.belag)],
        [ufill, block ? tt("o_rohrSystem_block") : tt("s_zone")], [kies ? "url(#pGr)" : "url(#pSo)", tt("f_verf") + ": " + tt("o_verf_" + (r.verf || "aushub"))],
        ["var(--pipe)", block ? tt("o_rohrSystem_block") : pipes.length + " × DN " + (pipes[0] || "")], ["var(--navy)", tt("f_hand") + ": " + tt("o_hand_" + (r.hand || "normal"))]];
      if (r.gesp) L.push(["var(--copper)", tt("f_gesp")]);
      return svg(760, Math.max(gy + th + 36, 190), o + leg(500, 40, L) + tx(500, Math.max(gy + th + 30, 180), "L = " + fq(num(r.L)) + " m", "sl sb"), tt("ht_graben"));
    },
    rohr: function () {
      var o = "", lb = function (x, s) { return tx(x, 150, s, "sl", "middle"); };
      o += '<rect x="10" y="60" width="60" height="18" fill="var(--pipe)" stroke="var(--ink)"/><rect x="80" y="60" width="60" height="18" fill="var(--pipe)" stroke="var(--ink)"/><rect x="58" y="55" width="34" height="28" rx="3" fill="var(--pipe2)" stroke="var(--ink)"/>' + lb(75, lab("l_muf"));
      o += '<path d="M170 110h40a60 60 0 0 0 60 -60v-30" fill="none" stroke="var(--pipe)" stroke-width="16"/><path d="M210 110a60 60 0 0 0 60 -60" fill="none" stroke="var(--ink)" stroke-dasharray="3 3"/>' + tx(236, 86, "R", "sl sb") + lb(225, "90° / R");
      o += '<path d="M300 90h130" stroke="var(--pipe2)" stroke-width="20"/><path d="M350 90l50 -55" stroke="var(--pipe)" stroke-width="12"/><rect x="340" y="78" width="46" height="24" rx="4" fill="none" stroke="var(--ink)" stroke-width="1.4"/>' + lb(365, "Halbschalenabzweiger");
      o += '<rect x="460" y="76" width="110" height="30" rx="3" fill="var(--conc)" stroke="var(--ink)"/><path d="M500 76v-40M530 76v-40" stroke="var(--pipe)" stroke-width="10"/>' + tx(515, 96, "KK4 / KK8", "sm", "middle") + lb(515, "T-KK");
      o += '<rect x="600" y="20" width="150" height="110" fill="url(#pSo)" opacity=".6"/><path d="M606 50h138" stroke="var(--cut)" stroke-width="4" stroke-dasharray="8 6"/><path d="M606 50h138" stroke="#fff" stroke-width="4" stroke-dasharray="8 6" stroke-dashoffset="8" opacity=".85"/>' +
        '<circle cx="675" cy="104" r="14" fill="var(--pipe)" stroke="var(--ink)"/><circle cx="675" cy="104" r="9" fill="var(--figbg)"/><circle cx="675" cy="104" r="1.8" fill="var(--ink)"/><path d="M606 122h138" stroke="var(--copper)" stroke-width="3"/>' +
        tx(606, 44, lab("f_warn"), "sm") + tx(606, 138, lab("f_erd"), "sm") + tx(606, 84, lab("f_schnur"), "sm");
      return svg(760, 160, o, tt("ht_rohr"));
    },
    schacht: function (r) {
      if (r.modus === "deckel" || r.modus === "ersatz") return "";
      var Sd = KVE.SCHACHT[r.typ] || KVE.SCHACHT.KES150, ar = num(r.arbeit, 0.5), l = Sd.lo, H = Sd.ho, lp = l + 2 * ar, Hp = H + 0.10;
      var gy = 46, s = Math.min(170 / Hp, 300 / lp), pw = lp * s, ph = Hp * s, x0 = 250 - pw / 2, sx = x0 + ar * s, sw = l * s, sh = H * s, sf = surf(r.belag);
      var o = '<rect x="20" y="' + gy + '" width="460" height="' + (ph + 24) + '" fill="url(#pSo)" opacity=".5"/>', bd = band(20, gy, 460, sf, s); o += bd.o;
      o += '<rect x="' + x0 + '" y="' + gy + '" width="' + pw + '" height="' + ph + '" fill="' + (r.verf && r.verf !== "aushub" ? "url(#pGr)" : "url(#pSo)") + '" stroke="var(--ink)" stroke-width="1.2"/>';
      var wt = Math.max(6, 0.2 * s), round = Sd.kind === "KS";
      o += '<rect x="' + sx + '" y="' + gy + '" width="' + sw + '" height="' + sh + '" fill="url(#pCo)" stroke="var(--ink)"/><rect x="' + (sx + wt) + '" y="' + (gy + (round ? 0 : wt)) + '" width="' + (sw - 2 * wt) + '" height="' + (sh - (round ? wt : 2 * wt)) + '" fill="var(--figbg)"/>' +
        '<rect x="' + (sx + wt) + '" y="' + (gy - 4) + '" width="' + (sw - 2 * wt) + '" height="6" fill="var(--ink)"/>' +
        '<path d="M' + x0 + " " + (gy + sh * 0.7) + "H" + (sx + wt) + '" stroke="var(--pipe)" stroke-width="8"/>';
      o += dimH(x0, x0 + pw, gy - 16, fq(lp) + " m") + dimV(x0 - 16, gy, gy + ph, fq(Hp) + " m") +
        '<g class="dim"><path d="M' + x0 + " " + (gy + ph + 10) + "H" + sx + '"/></g>' + tx((x0 + sx) / 2, gy + ph + 22, lab("f_arbeit") + " " + fq(ar), "sm", "middle");
      return svg(760, gy + ph + 36, o + leg(500, 40, [["url(#pCo)", tt("o_typ_" + r.typ)], [sf.k === "bit" ? "var(--asph)" : "url(#pGr)", surfLabel(r.belag)], ["var(--pipe)", tt("f_anschl")]]), tt("ht_schacht"));
    },
    werkloch: function (r) {
      var D = S.D.wl, items = ["ts", "bo", "sg", "zs"].map(function (k) { return [k, lab("f_" + k), D[k].map(num), num(r[k], 0)]; });
      if (num(r.iB) && num(r.iL)) items.push(["ind", tt("s_indWL"), [num(r.iL), num(r.iB), num(r.iT)], 1]);
      var tot = items.reduce(function (a, x) { return a + x[2][0]; }, 0), s = Math.min(90, (700 - 24 * items.length) / tot), x = 20, o = "";
      items.forEach(function (it) { var k = it[0], L = it[2][0], B = it[2][1], H = it[2][2], n = it[3], w = L * s, h = B * s, y = 90 - h / 2, on = n > 0, cy = 90;
        o += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#pSo)" stroke="var(--ink)" stroke-width="' + (on ? 2.2 : 0.8) + '" opacity="' + (on ? 1 : 0.55) + '"/>';
        if (k === "ts") o += '<path d="M' + (x - 8) + " " + cy + "H" + (x + w + 8) + "M" + (x + w / 2) + " " + cy + "V" + (y - 10) + '" stroke="var(--pipe)" stroke-width="6"/>';
        else if (k === "bo") o += '<path d="M' + (x - 8) + " " + cy + "H" + (x + w / 2) + "a" + h * 0.4 + " " + h * 0.4 + " 0 0 0 " + h * 0.4 + " " + (-h * 0.4) + "V" + (y - 10) + '" fill="none" stroke="var(--pipe)" stroke-width="6"/>';
        else if (k === "sg") o += '<path d="M' + (x - 8) + " " + cy + "H" + (x + w + 8) + '" stroke="var(--pipe)" stroke-width="6"/><rect x="' + (x + w / 2 - 14) + '" y="' + (cy - 8) + '" width="28" height="16" rx="4" fill="var(--pipe2)" stroke="var(--ink)"/>';
        else o += '<path d="M' + (x - 8) + " " + cy + "H" + (x + w + 8) + '" stroke="var(--pipe)" stroke-width="6"/>';
        o += tx(x + w / 2, y + h + 18, it[1], "sl sb", "middle") + tx(x + w / 2, y + h + 32, fq(L) + " × " + fq(B) + " × " + fq(H) + " m", "sm", "middle") + (on ? tx(x + w / 2, y - 16, n + " ×", "sl sb", "middle") : "");
        x += w + 24; });
      var mh = Math.max.apply(null, items.map(function (i) { return i[2][1] * s; }));
      return svg(760, 90 + mh / 2 + 44, o, tt("ht_werkloch"));
    },
    fund: function (r) {
      var D = S.D.fund, sel = [[r.vk, "VK"], [r.kvs, "KVS"]].filter(function (x) { return x[0] && D[x[0]]; }), list = sel.length ? sel : [["CAB 1-3 L", "VK"]];
      var gy = 120, s = 110, x = 60, o = '<rect x="20" y="' + gy + '" width="' + (list.length * 230 + 40) + '" height="120" fill="url(#pSo)" opacity=".5"/>', hmax = 0;
      o += band(20, gy, list.length * 230 + 40, surf(r.belag), s).o;
      list.forEach(function (it) { var d = D[it[0]].map(num), w = d[0] * s, h = d[2] * s; hmax = Math.max(hmax, h);
        o += '<rect x="' + x + '" y="' + gy + '" width="' + w + '" height="' + h + '" fill="url(#pCo)" stroke="var(--ink)"/><path d="M' + (x + w * 0.3) + " " + (gy + h + 18) + "V" + (gy + 10) + "M" + (x + w * 0.7) + " " + (gy + h + 18) + "V" + (gy + 10) + '" stroke="var(--pipe)" stroke-width="7"/>' +
          '<rect x="' + (x + 8) + '" y="' + (gy - 96) + '" width="' + (w - 16) + '" height="96" rx="3" fill="var(--cab)" stroke="var(--ink)"/><path d="M' + (x + w / 2) + " " + (gy - 90) + 'v84" stroke="var(--ink)" stroke-width=".8"/>' +
          tx(x + w / 2, gy - 102, it[1] + " " + it[0], "sl sb", "middle") + dimH(x, x + w, gy + h + 34, fq(d[0]) + " m") + dimV(x + w + 14, gy, gy + h, fq(d[2]) + " m", "start");
        x += 230; });
      return svg(760, gy + hmax + 50, o + leg(560, 40, [["var(--cab)", "VK / KVS"], ["url(#pCo)", tt("s_fund")], ["var(--pipe)", tt("l_rohre")]]), tt("ht_fund"));
    },
    geb: function (r) {
      var n = num(r.n) || 1, cm = num(r.cm), avg = cm > 0 ? cm / n : 30, w = Math.min(220, Math.max(40, avg * 3.2)), x = 330;
      var o = '<rect x="20" y="40" width="' + (x - 20) + '" height="130" fill="url(#pSo)" opacity=".6"/><path d="M20 40H' + x + '" stroke="var(--grass)" stroke-width="3"/>' +
        '<rect x="' + x + '" y="10" width="' + w + '" height="170" fill="url(#pWa)" stroke="var(--ink)"/><rect x="' + (x + w) + '" y="10" width="' + (740 - x - w) + '" height="170" fill="var(--figbg)"/>' +
        '<path d="M' + (x + w) + ' 150H740" stroke="var(--ink)" stroke-width="2"/><path d="M30 110H' + (x + w + 60) + '" stroke="var(--pipe)" stroke-width="12"/><rect x="' + x + '" y="99" width="' + w + '" height="22" fill="none" stroke="var(--ink)" stroke-dasharray="3 2"/>';
      if (r.abd === "hauff") o += '<rect x="' + (x - 10) + '" y="88" width="10" height="44" fill="var(--seal)" stroke="var(--ink)"/><rect x="' + x + '" y="100" width="' + w * 0.5 + '" height="20" fill="var(--seal)" opacity=".7"/>';
      if (r.abd === "kissen") o += '<rect x="' + (x + w * 0.2) + '" y="100" width="' + w * 0.5 + '" height="20" rx="9" fill="var(--seal)" stroke="var(--ink)"/>';
      o += dimH(x, x + w, 70, "Ø 70 mm – " + fq(avg) + " cm") + tx(x + w + 20, 100, n + " × " + tt("tab_geb"), "sm") + tx(x - 12, 150, tt("o_abd_" + (r.abd || "keine")), "sl", "end");
      return svg(760, 190, o, tt("ht_geb"));
    },
    belag: function (r) {
      if (r.indiv) return svg(760, 60, tx(10, 34, tt("ksHint"), "sl"), tt("ht_belag"));
      var B = num(r.B), L = num(r.L);
      return stagesSVG(r.wi) + '<p class="figcap">' + (B && L ? fq(B) + " m × " + fq(L) + " m = " + fq(B * L) + " m²  –  " : "") + esc(tt("o_bk_" + r.bk)) + ", " + fq(num(r.d)) + " m</p>";
    },
    allg: function (r) {
      var o = '<rect x="40" y="50" width="120" height="80" rx="4" fill="var(--cab)" stroke="var(--ink)"/><path d="M40 70h120" stroke="var(--ink)"/><rect x="85" y="40" width="30" height="14" rx="3" fill="none" stroke="var(--ink)" stroke-width="2"/>' +
        '<circle cx="70" cy="100" r="7" fill="var(--concD)"/><circle cx="100" cy="104" r="5" fill="var(--concD)"/><circle cx="128" cy="98" r="6" fill="var(--concD)"/>' + tx(100, 160, lab("f_km"), "sl sb", "middle") + tx(100, 178, "CHF " + fq(num(r.km)), "sm", "middle");
      o += '<circle cx="360" cy="90" r="44" fill="none" stroke="var(--ink)" stroke-width="3"/><path d="M360 90V60M360 90l22 12" stroke="var(--navy)" stroke-width="4" stroke-linecap="round"/>' + tx(360, 160, lab("f_ak"), "sl sb", "middle") + tx(360, 178, "CHF " + fq(num(r.ak)), "sm", "middle");
      o += '<rect x="540" y="62" width="150" height="68" fill="var(--cab)" stroke="var(--ink)"/><rect x="556" y="76" width="30" height="22" fill="var(--figbg)" stroke="var(--ink)"/><rect x="600" y="76" width="30" height="22" fill="var(--figbg)" stroke="var(--ink)"/><rect x="646" y="90" width="26" height="40" fill="var(--figbg)" stroke="var(--ink)"/><path d="M530 130h170" stroke="var(--ink)" stroke-width="2"/>' +
        tx(615, 160, tt("h_be"), "sl sb", "middle") + tx(615, 178, fq(num(S.be.pct)) + " %", "sm", "middle");
      return svg(760, 190, o, tt("ht_allg"));
    }
  };
  function html(tab, r, state, ttf) { S = state; tt = ttf; var f = F[tab]; return f && r ? f(r) : ""; }
  return { html: html, stagesSVG: function (typ, state, ttf) { S = state; tt = ttf; return stagesSVG(typ); }, svg: svg, tx: tx };
})();
