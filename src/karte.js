/* =====================================================================
   Kartenmessung Grabenlänge – swisstopo (WMTS) + Leaflet (cdnjs, bei Bedarf geladen)
   Trasse = Linien in LV95 [E,N]; Länge = Summe der Strecken in LV95.
   App-Konzept und Urheber: Alessandro Cortese
   ===================================================================== */
(function () {
  "use strict";
  var LEAF = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.", WMTS = "https://wmts.geo.admin.ch/1.0.0/";
  var SEARCH = "https://api3.geo.admin.ch/rest/services/ech/SearchServer", WMS = "https://wms.geo.admin.ch/";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* WGS84 <-> LV95 (swisstopo-Näherungsformeln, < 1 m) */
  function toLV95(lat, lon) {
    var p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
    return [2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l * l * l,
      1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p * p * p];
  }
  function toWGS(e, n) {
    var y = (e - 2600000) / 1e6, x = (n - 1200000) / 1e6;
    var l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
    var p = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
    return [p * 100 / 36, l * 100 / 36];
  }
  function lineLen(pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }
  /* Schräglänge einer Linie (aus dem Höhenprofil), wenn «mit Schräglänge rechnen» gilt und das Profil zur Geometrie passt */
  function slopeOn() { try { return localStorage.getItem("lvd-km-slope") === "1"; } catch (e) { return false; } }
  function slopeHz(pts, lines) { var sg = JSON.stringify(pts), h = null; (lines || []).forEach(function (l) { if (!h && l.hz && l.hz.sig === sg) h = l.hz; }); return h; }
  function slopeLen(pts, lines) { var h = slopeOn() ? slopeHz(pts, lines) : null; return h ? h.S : lineLen(pts); }
  function total(lines) { return (lines || []).reduce(function (a, l) { return a + lineLen(l); }, 0); }
  function fmt(v) { return (Math.round(v * 10) / 10).toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

  /* Ein einziges WMS-Bild pro Kartenausschnitt statt Kacheln: keine Nähte/Versätze an Kachelgrenzen, Beschriftung nur einmal (Parzellenplan, OpenData AV) */
  function viewWms(url, layers, o) {
    var V = L.Layer.extend({
      onAdd: function (m) { this._m = m; this._t = 0; this._bad = 0; m.on("moveend", this._upd, this); this._upd(); },
      onRemove: function (m) { m.off("moveend", this._upd, this); this._t++; if (this._im) { m.removeLayer(this._im); this._im = null; } },
      _upd: function () {
        var m = this._m, sz = m.getSize(), b = m.getBounds(), me = this, t = ++this._t, k = Math.min(2, window.devicePixelRatio || 1);
        var sw = L.CRS.EPSG3857.project(b.getSouthWest()), ne = L.CRS.EPSG3857.project(b.getNorthEast());
        var u = url + (url.indexOf("?") < 0 ? "?" : "&") + "SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=" + encodeURIComponent(layers) + "&STYLES=&SRS=EPSG:3857&BBOX=" + [sw.x, sw.y, ne.x, ne.y].map(function (v) { return v.toFixed(2); }).join(",") + "&WIDTH=" + Math.round(sz.x * k) + "&HEIGHT=" + Math.round(sz.y * k) + "&FORMAT=image/png&TRANSPARENT=TRUE";
        var img = new Image();
        img.onload = function () {
          if (t !== me._t || !me._m) return; me._bad = 0;
          var ov = L.imageOverlay(u, b, { pane: "tilePane", zIndex: 2, interactive: false, attribution: o && o.attr || "" }).addTo(me._m), old = me._im; me._im = ov; if (old) me._m.removeLayer(old);
        };
        img.onerror = function () { if (t === me._t && ++me._bad >= 2 && o && o.fail) { var f = o.fail; o.fail = null; f(); } };
        img.src = u;
      }
    });
    return new V();
  }

  /* ---------- Automatische Ausrichtung des Plans ohne Passpunkte ----------
     1) Koordinatenraster: LV95-/LV03-Werte im PDF-Text (Lage aus Textposition, Massstab aus Wertabstand)
     2) Ort aus dem Plantext (Gemeinde, SearchServer) + Abgleich der Planlinien mit dem Katasterbild (Massstab bekannt, Nordausrichtung)
     Ergebnis ist immer ein Vorschlag: gilt erst nach Bestätigung (oder Passpunkten). */
  function gridFromItems(items, vp, sc, ratioMpp) {
    var E = {}, N = {}, U = window.pdfjsLib && window.pdfjsLib.Util;
    if (!U) return null;
    items.forEach(function (it) {
      var str = String(it.str || ""), re = /\d{1,3}(?:['\u2019`\u2009\u202f\u00a0 ]\d{3}){1,2}|\d{6,7}/g, m;
      var t = U.transform(vp.transform, it.transform), a = t[0], b = t[1], c = t[2], d = t[3], la = Math.hypot(a, b) || 1, lc = Math.hypot(c, d) || 1, w = (it.width || 0) * sc;
      var cx = t[4] + a / la * w / 2 + c / lc * lc * 0.35, cy = t[5] + b / la * w / 2 + d / lc * lc * 0.35;
      while ((m = re.exec(str))) {
        var v = +m[0].replace(/[^0-9]/g, ""), ax = "", val = 0;
        if (v >= 2480000 && v <= 2840000) { ax = "E"; val = v; } else if (v >= 1070000 && v <= 1300000) { ax = "N"; val = v; }
        else if (v >= 480000 && v <= 840000) { ax = "E"; val = v + 2000000; } else if (v >= 70000 && v <= 300000) { ax = "N"; val = v + 1000000; }
        if (!ax) continue;
        var o = ax === "E" ? E : N; (o[val] = o[val] || []).push(ax === "E" ? cx : cy);
      }
    });
    function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; }
    var Ev = Object.keys(E).map(function (k) { return [+k, med(E[k])]; }), Nv = Object.keys(N).map(function (k) { return [+k, med(N[k])]; });
    function slope(pairs, sgn) {   /* mpp je Achse (Wert gegen Pixel), mindestens 2 verschiedene Werte */
      if (pairs.length < 2) return null; var n = pairs.length, mx = 0, my = 0; pairs.forEach(function (p) { mx += p[1] * sgn; my += p[0]; }); mx /= n; my /= n;
      var sxy = 0, sxx = 0; pairs.forEach(function (p) { sxy += (p[1] * sgn - mx) * (p[0] - my); sxx += (p[1] * sgn - mx) * (p[1] * sgn - mx); }); return sxx > 0 ? sxy / sxx : null;
    }
    var se = slope(Ev, 1), sn = slope(Nv, -1), ms = [se, sn].filter(function (v) { return v && v > 0.02 && v < 5; });
    if (!Ev.length || !Nv.length || !ms.length || Ev.length + Nv.length < 3) return null;
    if (ms.length === 2 && Math.abs(ms[0] - ms[1]) / ((ms[0] + ms[1]) / 2) > 0.03) return null;
    var mpp = ms.reduce(function (x, y) { return x + y; }, 0) / ms.length;
    if (ratioMpp && Math.abs(mpp / ratioMpp - 1) > 0.08) return null;   /* widerspricht dem Massstab im Plan */
    var E0 = Ev.reduce(function (a, p) { return a + p[0] - mpp * p[1]; }, 0) / Ev.length, N0 = Nv.reduce(function (a, p) { return a + p[0] + mpp * p[1]; }, 0) / Nv.length, ss = 0;
    Ev.forEach(function (p) { ss += Math.pow(p[0] - (E0 + mpp * p[1]), 2); }); Nv.forEach(function (p) { ss += Math.pow(p[0] - (N0 - mpp * p[1]), 2); });
    var rms = Math.sqrt(ss / (Ev.length + Nv.length)); if (rms > 2.5) return null;
    return { E0: E0, N0: N0, mpp: mpp, rms: rms, n: Ev.length + Nv.length };
  }
  var STOPW = /^(Kanton|Tiefbau|Abteilung|Plan|Situation|Plotdatum|Name|Datum|Index|Projekt|Bauherr|Ausf|Änderungen|Massstab|Gemeinde|Legende|Fläche|Format|Blatt|Version|Tiefbauamt|Ingenieure|Ingenieur|Gezeichnet|Geprüft|Genehmigt|Swisscom|Netz|Leitung|Kabel|Rohr|Schacht|Strasse|Bahnhof|Haus|Wald|Feld|Baum|Mauer|Zaun|Bach|Weg|Ort)$/;
  function planWords(text) {
    var c = {}, order = [], re = /[A-ZÄÖÜ][a-zäöüéèàç]{3,}(?:-[A-ZÄÖÜ][a-zäöüéèàç]{2,})?/g, m;
    while ((m = re.exec(text))) { var w = m[0]; if (STOPW.test(w) || /(strasse|weg|gasse|platz|allee|bach|hof)$/i.test(w)) continue; if (!c[w]) { c[w] = 0; order.push(w); } c[w]++; }
    return order.sort(function (a, b) { return c[b] - c[a]; }).slice(0, 8);
  }
  function gray(ctx, w, h) { var d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h), i; for (i = 0; i < w * h; i++) g[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]; return g; }
  function edges(g, w, h) {   /* Sobel-Betrag, leicht geglättet: robust gegen Strichstärke und Farbe */
    var o = new Float32Array(w * h), o2 = new Float32Array(w * h), x, y;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { var i = y * w + x, gx = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1], gy = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1]; o[i] = Math.sqrt(gx * gx + gy * gy); }
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { var j = y * w + x; o2[j] = (o[j] * 4 + o[j - 1] * 2 + o[j + 1] * 2 + o[j - w] * 2 + o[j + w] * 2 + o[j - w - 1] + o[j - w + 1] + o[j + w - 1] + o[j + w + 1]) / 16; }
    return o2;
  }
  function nccSearch(A, aw, ah, T, tw, th) {   /* normierte Kreuzkorrelation, Rückgabe bester und zweitbester (abseits) Treffer */
    var n = tw * th, mT = 0, vT = 0, i, x, y; for (i = 0; i < n; i++) mT += T[i]; mT /= n; for (i = 0; i < n; i++) vT += (T[i] - mT) * (T[i] - mT); var sT = Math.sqrt(vT / n) || 1e-6;
    var Tz = new Float32Array(n); for (i = 0; i < n; i++) Tz[i] = (T[i] - mT) / sT;
    var I1 = new Float64Array((aw + 1) * (ah + 1)), I2 = new Float64Array((aw + 1) * (ah + 1));
    for (y = 0; y < ah; y++) { var r1 = 0, r2 = 0; for (x = 0; x < aw; x++) { var v = A[y * aw + x]; r1 += v; r2 += v * v; I1[(y + 1) * (aw + 1) + x + 1] = I1[y * (aw + 1) + x + 1] + r1; I2[(y + 1) * (aw + 1) + x + 1] = I2[y * (aw + 1) + x + 1] + r2; } }
    var ox = aw - tw + 1, oy = ah - th + 1; if (ox < 1 || oy < 1) return null; var sc = new Float32Array(ox * oy), best = -2, bx = 0, by = 0;
    for (var dy = 0; dy < oy; dy++) for (var dx = 0; dx < ox; dx++) {
      var s = 0; for (y = 0; y < th; y++) { var ro = (dy + y) * aw + dx, rt = y * tw; for (x = 0; x < tw; x++) s += Tz[rt + x] * A[ro + x]; }
      var W = aw + 1, a1 = I1[(dy + th) * W + dx + tw] - I1[dy * W + dx + tw] - I1[(dy + th) * W + dx] + I1[dy * W + dx], a2 = I2[(dy + th) * W + dx + tw] - I2[dy * W + dx + tw] - I2[(dy + th) * W + dx] + I2[dy * W + dx];
      var sA = Math.sqrt(Math.max(1e-9, a2 / n - (a1 / n) * (a1 / n))), c = sA < 1e-3 ? 0 : s / (n * sA); sc[dy * ox + dx] = c; if (c > best) { best = c; bx = dx; by = dy; }
    }
    var ex = Math.max(3, Math.round(tw / 6)), ey = Math.max(3, Math.round(th / 6)), sec = 0;
    for (var yy = 0; yy < oy; yy++) for (var xx = 0; xx < ox; xx++) if ((Math.abs(xx - bx) > ex || Math.abs(yy - by) > ey) && sc[yy * ox + xx] > sec) sec = sc[yy * ox + xx];
    return { dx: bx, dy: by, s: best, s2: sec };
  }
  function refImage(cE, cN, half, res, layer) {   /* Katasterbild (weisser Grund) um (cE,cN), Seitenlänge 2·half, res m/px */
    var px = Math.max(8, Math.ceil(2 * half / res)), url = WMS + "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=" + layer + "&STYLES=&SRS=EPSG:2056&BGCOLOR=0xFFFFFF&BBOX=" + [cE - half, cN - half, cE + half, cN + half].map(function (v) { return v.toFixed(1); }).join(",") + "&WIDTH=" + px + "&HEIGHT=" + px + "&FORMAT=image/png";
    return fetch(url, { mode: "cors" }).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (bl) { return new Promise(function (ok, no) { var im = new Image(), u = URL.createObjectURL(bl); im.onload = function () { URL.revokeObjectURL(u); var c = document.createElement("canvas"); c.width = c.height = px; var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, px, px); x.drawImage(im, 0, 0, px, px); ok({ g: gray(x, px, px), px: px }); }; im.onerror = no; im.src = u; }); });
  }
  function planGray(img, w, h, tw, th) { return new Promise(function (ok, no) { var im = new Image(); im.onload = function () { var c = document.createElement("canvas"); c.width = tw; c.height = th; var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, tw, th); x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, tw, th); ok(gray(x, tw, th)); }; im.onerror = no; im.src = img; }); }
  var MLAYER = "ch.kantone.cadastralwebmap-farbe";
  function matchPlan(img, w, h, mpp, cE, cN, R) {
    var extW = w * mpp, extH = h * mpp; if (!(extW > 20 && extH > 20 && extW < 2500 && extH < 2500)) return Promise.resolve(null);
    var res = 3, half = R + Math.max(extW, extH) / 2, ox, oy, tw, th;
    for (var k = 0; k < 12; k++) { tw = Math.max(12, Math.round(extW / res)); th = Math.max(12, Math.round(extH / res)); var ap = Math.ceil(2 * half / res); ox = ap - tw + 1; oy = ap - th + 1; if (ox * oy * tw * th <= 3e8 && tw <= 220 && th <= 220) break; res *= 1.4; }
    if (!(ox > 1 && oy > 1)) return Promise.resolve(null);
    return Promise.all([refImage(cE, cN, half, res, MLAYER), planGray(img, w, h, tw, th)]).then(function (a) {
      var ref = a[0], A = edges(ref.g, ref.px, ref.px), T = edges(a[1], tw, th), m1 = nccSearch(A, ref.px, ref.px, T, tw, th); if (!m1) return null;
      var aE = cE - half + (m1.dx + tw / 2) * (2 * half / ref.px), aN = cN + half - (m1.dy + th / 2) * (2 * half / ref.px), res2 = 1, h2 = res * 2.5 + Math.max(extW, extH) / 2, tw2 = Math.round(extW / res2), th2 = Math.round(extH / res2);
      if (res <= res2 * 1.5 || tw2 > 700 || th2 > 700) return { E: aE, N: aN, s: m1.s, ratio: m1.s / Math.max(m1.s2, 0.01) };
      return Promise.all([refImage(aE, aN, h2, res2, MLAYER), planGray(img, w, h, tw2, th2)]).then(function (b) {
        var A2 = edges(b[0].g, b[0].px, b[0].px), T2 = edges(b[1], tw2, th2), m2 = nccSearch(A2, b[0].px, b[0].px, T2, tw2, th2), f = 2 * h2 / b[0].px;
        if (!m2) return { E: aE, N: aN, s: m1.s, ratio: m1.s / Math.max(m1.s2, 0.01) };
        return { E: aE - h2 + (m2.dx + tw2 / 2) * f - aE + aE, N: aN + h2 - (m2.dy + th2 / 2) * f, s: m2.s, ratio: m1.s / Math.max(m1.s2, 0.01) };
      }, function () { return { E: aE, N: aN, s: m1.s, ratio: m1.s / Math.max(m1.s2, 0.01) }; });
    });
  }

  /* Leaflet bei Bedarf nachladen */
  var loading = null;
  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (ok, no) {
      var done = false, t = setTimeout(function () { fail(); }, 10000);
      function fail() { if (done) return; done = true; clearTimeout(t); loading = null; no(new Error("leaflet")); }
      var css = document.createElement("link"); css.rel = "stylesheet"; css.href = LEAF + "css"; document.head.appendChild(css);
      var s = document.createElement("script"); s.src = LEAF + "js"; s.crossOrigin = "anonymous";
      s.onload = function () { if (done) return; done = true; clearTimeout(t); window.L && window.L.map ? ok() : (loading = null, no(new Error("leaflet"))); };
      s.onerror = fail; document.head.appendChild(s);
    });
    return loading;
  }

  /* Plan-Overlay (PDF/Bild) auf der Karte: Mittelpunkt E/N (LV95), Drehung rot (° gegen den Uhrzeigersinn), mpp = Meter pro Bildpixel */
  function ovPx(o, x, y) {
    var ux = (x - o.w / 2) * o.mpp, uy = (o.h / 2 - y) * o.mpp, a = (o.rot || 0) * Math.PI / 180;
    return [o.E + ux * Math.cos(a) - uy * Math.sin(a), o.N + ux * Math.sin(a) + uy * Math.cos(a)];
  }
  function ovInv(o, e, n) {
    var a = (o.rot || 0) * Math.PI / 180, dx = e - o.E, dy = n - o.N, ux = dx * Math.cos(a) + dy * Math.sin(a), uy = -dx * Math.sin(a) + dy * Math.cos(a);
    return [ux / o.mpp + o.w / 2, o.h / 2 - uy / o.mpp];
  }
  function ovCorners(o) { return o && o.w ? [ovPx(o, 0, 0), ovPx(o, o.w, 0), ovPx(o, o.w, o.h), ovPx(o, 0, o.h)] : []; }
  /* Zwei Passpunkte -> Mittelpunkt, Drehung, Massstab */
  function ovSolve(o, s1, t1, s2, t2) {
    var u1 = [s1[0] - o.w / 2, o.h / 2 - s1[1]], u2 = [s2[0] - o.w / 2, o.h / 2 - s2[1]], du = [u2[0] - u1[0], u2[1] - u1[1]], dt = [t2[0] - t1[0], t2[1] - t1[1]];
    var lu = Math.hypot(du[0], du[1]), lt = Math.hypot(dt[0], dt[1]); if (!(lu > 0) || !(lt > 0)) return null;
    var mpp = lt / lu, th = Math.atan2(dt[1], dt[0]) - Math.atan2(du[1], du[0]), c = Math.cos(th), sn = Math.sin(th);
    return { mpp: mpp, rot: th * 180 / Math.PI, E: t1[0] - mpp * (u1[0] * c - u1[1] * sn), N: t1[1] - mpp * (u1[0] * sn + u1[1] * c) };
  }
  /* Kartenbild (SVG): swisstopo-Hintergrund per WMS + Trasse, Schächte, Sondagen, Flächen und Notizen. Für Vorschau und Ausdruck.
     geo: { lines:[pts], pts:[pt], areas:[pts], sond:[pt], notes:[...] } in LV95 */
  function geoPoints(g) {
    var a = []; (g.lines || []).concat(g.areas || []).forEach(function (l) { l.forEach(function (p) { a.push(p); }); });
    (g.pts || []).concat(g.sond || [], g.wl || [], g.geb || [], g.extra || []).forEach(function (p) { a.push(p); }); (g.notes || []).forEach(function (n) { n.pts.forEach(function (p) { a.push(p); }); });
    return a;
  }
  function geoBox(g, W, H) {
    var all = geoPoints(g); if (!all.length) return null;
    var e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity;
    all.forEach(function (p) { e0 = Math.min(e0, p[0]); e1 = Math.max(e1, p[0]); n0 = Math.min(n0, p[1]); n1 = Math.max(n1, p[1]); });
    var cx = (e0 + e1) / 2, cy = (n0 + n1) / 2, w = Math.max((e1 - e0) * 1.3, 60), h = Math.max((n1 - n0) * 1.3, 60 * H / W), sc = Math.max(w / W, h / H);
    w = sc * W; h = sc * H; return { bb: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], sc: sc, W: W, H: H };
  }
  var BGL = { farbe: "ch.swisstopo.pixelkarte-farbe", grau: "ch.swisstopo.pixelkarte-grau", luft: "ch.swisstopo.swissimage", kataster: "ch.kantone.cadastralwebmap-farbe" };
  function avCfg() { try { var c = JSON.parse(localStorage.getItem("lvd-km-av") || "{}"); return { u: String(c.u || ""), l: String(c.l || "") }; } catch (e) { return { u: "", l: "" }; } }
  function bgUrl(box, base) {
    if (base === "av") { var c = avCfg(); return c.u + (c.u.indexOf("?") < 0 ? "?" : "&") + "SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=" + encodeURIComponent(c.l) + "&STYLES=&SRS=EPSG:2056&BBOX=" + box.bb.map(function (v) { return v.toFixed(1); }).join(",") + "&WIDTH=" + box.W + "&HEIGHT=" + box.H + "&FORMAT=image/png&TRANSPARENT=FALSE&BGCOLOR=0xFFFFFF"; }
    return WMS + "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=" + (BGL[base] || BGL.farbe) + "&STYLES=&SRS=EPSG:2056&BGCOLOR=0xFFFFFF&BBOX=" + box.bb.map(function (v) { return v.toFixed(1); }).join(",") + "&WIDTH=" + box.W + "&HEIGHT=" + box.H + "&FORMAT=image/jpeg";
  }
  function bgKey(g, W, H, base) { var b = geoBox(g, W, H); return b ? b.bb.map(function (v) { return v.toFixed(1); }).join(",") + "|" + (base || "farbe") + "|" + W + "x" + H : ""; }
  /* Hintergrundbild einmal laden und im Projekt ablegen, damit der Ausdruck auch ohne Internet vollständig ist */
  function cacheBg(g, base, W, H, cb) {
    var box = geoBox(g, W, H); if (!box || base === "leer" || (base === "av" && !avCfg().u)) return;
    fetch(bgUrl(box, base), { mode: "cors" }).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (bl) {
      var fr = new FileReader(); fr.onload = function () { cb({ key: bgKey(g, W, H, base), src: fr.result }); }; fr.readAsDataURL(bl);
    }).catch(function () { });
  }
  /* Gemeinsame Zeichnung (SVG-Text): px = Abbildung Punkt -> Zeichnungseinheit, k = Grösse einer Bildschirm-Einheit (1 px bei 360 px Breite)
     g.lab = { lines:[txt], pts:[txt], areas:[txt], sond:[txt], wl:[txt], geb:[txt] } (optional); o.labels schaltet die Beschriftung ein */
  function dashOf(fl, k) { var d = (LSTY[fl || ""] || LSTY[""])[1]; return d ? ' stroke-dasharray="' + d.split(" ").map(function (v) { return v * k * (d === "1 7" ? 0.55 : 0.5); }).join(" ") + '"' + (d === "1 7" ? ' stroke-linecap="round"' : "") : ""; }
  function geoSvg(g, px, k, o) {
    o = o || {}; var f1 = function (v) { return Math.round(v * 100) / 100; }, o2 = "", lab = o.labels ? (g.lab || {}) : {};
    var pl = function (pts) { return pts.map(function (p) { var q = px(p); return f1(q[0]) + "," + f1(q[1]); }).join(" "); };
    var txt = function (x, y, s, extra) { return s ? '<text x="' + f1(x) + '" y="' + f1(y) + '" font-size="' + 9 * k + '" font-weight="600" fill="#1a1c1e" stroke="#fff" stroke-width="' + 2.6 * k + '" stroke-linejoin="round" paint-order="stroke" ' + (extra || "") + ">" + esc(s) + "</text>" : ""; };
    (g.areas || []).forEach(function (a, i) {
      if (a.length > 2) { o2 += '<polygon points="' + pl(a) + '" fill="#f28c00" fill-opacity=".3" stroke="#8a5b00" stroke-width="' + 2 * k + '"/>';
        var cx = 0, cy = 0; a.forEach(function (p) { var q = px(p); cx += q[0]; cy += q[1]; }); o2 += txt(cx / a.length, cy / a.length + 3 * k, lab.areas && lab.areas[i], 'text-anchor="middle"'); }
    });
    (g.lines || []).forEach(function (l, i) {
      if (l.length < 2) return;
      o2 += '<polyline points="' + pl(l) + '" fill="none" stroke="#fff" stroke-width="' + 6 * k + '" stroke-linejoin="round"/><polyline points="' + pl(l) + '" fill="none" stroke="' + (LSTY[(g.lfl || [])[i] || ""] || LSTY[""])[0] + '" stroke-width="' + 3 * k + '"' + dashOf((g.lfl || [])[i], k) + ' stroke-linejoin="round"/>';
      if (lab.lines && lab.lines[i]) {   /* Beschriftung entlang des längsten Abschnitts */
        var best = -1, bj = 1; for (var j = 1; j < l.length; j++) { var a = px(l[j - 1]), b = px(l[j]), d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > best) { best = d; bj = j; } }
        var A = px(l[bj - 1]), B = px(l[bj]), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, ang = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        o2 += txt(mx, my, lab.lines[i], 'dy="' + -4.5 * k + '" text-anchor="middle" transform="rotate(' + f1(ang) + " " + f1(mx) + " " + f1(my) + ')"');
      }
    });
    (g.notes || []).forEach(function (n) {
      var c = n.color || "#0d47c8", q = n.pts.map(px);
      if (n.type === "text") o2 += '<text x="' + f1(q[0][0]) + '" y="' + f1(q[0][1]) + '" font-size="' + ({ s: 10, m: 13, l: 19 }[n.size || "m"] * k) + '" font-weight="700" fill="' + c + '" stroke="#fff" stroke-width="' + 0.8 * k + '" paint-order="stroke">' + esc(n.text || "") + "</text>";
      else if (n.type === "rect") o2 += '<rect x="' + f1(Math.min(q[0][0], q[1][0])) + '" y="' + f1(Math.min(q[0][1], q[1][1])) + '" width="' + f1(Math.abs(q[0][0] - q[1][0])) + '" height="' + f1(Math.abs(q[0][1] - q[1][1])) + '" fill="' + c + '" fill-opacity=".08" stroke="' + c + '" stroke-width="' + 2 * k + '"/>';
      else { o2 += '<polyline points="' + q.map(function (p) { return f1(p[0]) + "," + f1(p[1]); }).join(" ") + '" fill="none" stroke="' + c + '" stroke-width="' + 2.5 * k + '"/>';
        if (n.type === "arrow" && q.length > 1) { var a = q[0], b = q[q.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), s2 = 13 * k; o2 += '<polygon points="' + f1(b[0]) + "," + f1(b[1]) + " " + f1(b[0] - s2 * Math.cos(ang - 0.4)) + "," + f1(b[1] - s2 * Math.sin(ang - 0.4)) + " " + f1(b[0] - s2 * Math.cos(ang + 0.4)) + "," + f1(b[1] - s2 * Math.sin(ang + 0.4)) + '" fill="' + c + '"/>'; } }
    });
    var sym = function (arr, fn, key, nm, r0) {
      (arr || []).forEach(function (p, i) { var q = px(p), r = r0 * k; o2 += fn(q, r, i) + txt(q[0] + r + 2.5 * k, q[1] + 3 * k, lab[key] && lab[key][i]); });
    };
    sym(g.pts, function (q, r, i) { var ex = (g.pm || [])[i]; ex = ex && ex !== "neu";   /* bestehender Schacht (Anschluss/Deckel): weiss mit blauem Rand */
      return '<rect x="' + f1(q[0] - r) + '" y="' + f1(q[1] - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" fill="' + (ex ? "#fff" : "#0d47c8") + '" stroke="' + (ex ? "#0d47c8" : "#fff") + '" stroke-width="' + (ex ? 2 : 1.5) * k + '"/><text x="' + f1(q[0]) + '" y="' + f1(q[1] + 4 * k) + '" text-anchor="middle" font-size="' + 11 * k + '" font-weight="700" fill="' + (ex ? "#0d47c8" : "#fff") + '">' + (i + 1) + "</text>"; }, "pts", "", 9);
    sym(g.sond, function (q, r, i) { return '<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="' + r + '" fill="#8a5b00" stroke="#fff" stroke-width="' + 1.5 * k + '"/><text x="' + f1(q[0]) + '" y="' + f1(q[1] + 4 * k) + '" text-anchor="middle" font-size="' + 10 * k + '" font-weight="700" fill="#fff">S' + (i + 1) + "</text>"; }, "sond", "", 9);
    sym(g.wl, function (q, r, i) { return '<rect x="' + f1(q[0] - r) + '" y="' + f1(q[1] - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" fill="#b25e00" stroke="#fff" stroke-width="' + 1.5 * k + '" transform="rotate(45 ' + f1(q[0]) + " " + f1(q[1]) + ')"/><text x="' + f1(q[0]) + '" y="' + f1(q[1] + 4 * k) + '" text-anchor="middle" font-size="' + 10 * k + '" font-weight="700" fill="#fff">W' + (i + 1) + "</text>"; }, "wl", "", 8);
    sym(g.geb, function (q, r, i) { return '<polygon points="' + f1(q[0] - r) + "," + f1(q[1] + r) + " " + f1(q[0] - r) + "," + f1(q[1] - r / 3) + " " + f1(q[0]) + "," + f1(q[1] - r) + " " + f1(q[0] + r) + "," + f1(q[1] - r / 3) + " " + f1(q[0] + r) + "," + f1(q[1] + r) + '" fill="#1c6b3f" stroke="#fff" stroke-width="' + 1.5 * k + '"/><text x="' + f1(q[0]) + '" y="' + f1(q[1] + 5 * k) + '" text-anchor="middle" font-size="' + 9 * k + '" font-weight="700" fill="#fff">G' + (i + 1) + "</text>"; }, "geb", "", 8);
    return o2;
  }
  function overlaySvg(ov, px) {
    if (!ov || !ov.img) return ""; var oc = ovCorners(ov).map(px), ow = ov.w, oh = ov.h;
    return '<image href="' + ov.img + '" width="' + ow + '" height="' + oh + '" opacity="' + (ov.op || 0.6) + '" transform="matrix(' + [(oc[1][0] - oc[0][0]) / ow, (oc[1][1] - oc[0][1]) / ow, (oc[3][0] - oc[0][0]) / oh, (oc[3][1] - oc[0][1]) / oh, oc[0][0], oc[0][1]].map(function (v) { return Math.round(v * 1e6) / 1e6; }).join(" ") + ')"/>';
  }
  function mapFigure(g, tt, o) {
    var W = o.W, H = o.H, box = geoBox(g, W, H); if (!box) return null;
    var bb = box.bb, sc = box.sc, k = W / 360, px = function (p) { return [((p[0] - bb[0]) / sc), ((bb[3] - p[1]) / sc)]; };
    var fig = document.createElement("figure"); fig.className = o.cls || "kmprev";
    fig.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(tt("km_prevAlt")) + '"><rect width="' + W + '" height="' + H + '" fill="#eef1f3"/><rect width="' + W + '" height="' + H + '" fill="#fff"/>' + ((o.base === "leer" || (o.base === "av" && !avCfg().u)) ? "" : '<image href="' + esc(o.bg || bgUrl(box, o.base)) + '" width="' + W + '" height="' + H + '"/>') + overlaySvg(o.overlay, px) + geoSvg(g, px, k, { labels: o.labels }) + '</svg><figcaption>' + esc(o.cap || "") + (o.base === "kataster" ? " · © geo.admin.ch / Kantone (Amtliche Vermessung)" : " · © swisstopo") + "</figcaption>";
    var im = fig.querySelector("image"); im.addEventListener("error", function () { im.remove(); });
    return fig;
  }
  /* kleine Vorschau je Datensatz */
  /* Übersicht (Situation, Vorschau): statt Landeskarte (farbig/grau) der Parzellenplan; Luftbild, leere Basis und eigener WMS bleiben */
  function ovBase(b) { return !b || b === "farbe" || b === "grau" ? "kataster" : b; }
  function preview(lines, tt, pts, areas, wl, geb) { return mapFigure({ lines: lines || [], pts: pts || [], areas: areas || [], wl: wl || [], geb: geb || [] }, tt, { W: 360, H: 220, base: "kataster", cap: tt("km_prevCap").replace("{m}", fmt(total(lines))) }); }

  /* Geokatalog: alle WMTS/WMS-Ebenen von geo.admin.ch (Konfiguration wird einmal geladen) */
  var catPromise = null, CATKEY = "lvd-km-ov";
  function loadCatalog(lang) {
    if (catPromise) return catPromise;
    catPromise = fetch("https://api3.geo.admin.ch/rest/services/api/MapServer/layersConfig?lang=" + (lang || "de")).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      return Object.keys(j).filter(function (k) { var c = j[k]; return c && (c.type === "wmts" || c.type === "wms") && c.label; })
        .map(function (k) { var c = j[k]; return { id: k, label: c.label, type: c.type, srv: c.serverLayerName || k, fmt: c.format || "png" }; })
        .sort(function (a, b) { return a.label.localeCompare(b.label); });
    }).catch(function (e) { catPromise = null; throw e; });
    return catPromise;
  }

  /* Toast mit «Rückgängig» (host: Dialog oder body, damit er über dem Dialog sichtbar bleibt) */
  var toastT;
  function toast(host, msg, undoLabel, undo) {
    var old = host.querySelector(".kmtoast"); if (old) old.remove(); clearTimeout(toastT);
    var slot = host.classList && host.classList.contains("kmdlg") ? host.querySelector(".kmslot") : null; if (slot) host = slot;   /* im Dialog: eigener Platz, verdeckt die Karte nicht */
    var t = document.createElement("div"); t.className = "kmtoast" + (slot ? " in" : ""); t.setAttribute("role", "status");
    var sp = document.createElement("span"); sp.textContent = msg; t.appendChild(sp);
    if (undo) { var b = document.createElement("button"); b.type = "button"; b.className = "btn small"; b.textContent = undoLabel; b.addEventListener("click", function () { t.remove(); undo(); }); t.appendChild(b); }
    host.appendChild(t); toastT = setTimeout(function () { t.remove(); }, 9000);
  }

  /* Plan (PDF/Bild) -> JPEG; pdf.js wird bei Bedarf von cdnjs geladen */
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", PDFW = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js", pdfLoading = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    if (pdfLoading) return pdfLoading;
    pdfLoading = new Promise(function (ok, no) {
      var s = document.createElement("script"); s.src = PDFJS; s.crossOrigin = "anonymous";
      s.onload = function () {
        fetch(PDFW).then(function (r) { return r.blob(); }).then(function (bl) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(bl); ok(); }).catch(function (e) { pdfLoading = null; no(e); });
      };
      s.onerror = function () { pdfLoading = null; no(new Error("pdfjs")); }; document.head.appendChild(s);
    });
    return pdfLoading;
  }
  var MAXPX = 6000, MAXAREA = 7e6, MAXCHARS = 2.4e6;   /* lange Streifenpläne (z. B. 1:500) brauchen mehr Auflösung als 2200 px */
  var fit = function (w, h) { return Math.min(1, MAXPX / Math.max(w, h), Math.sqrt(MAXAREA / (w * h))); };
  function jpeg(c) { var q = 0.82, d = c.toDataURL("image/jpeg", q); while (d.length > MAXCHARS && q > 0.45) { q -= 0.1; d = c.toDataURL("image/jpeg", q); } return d; }
  function canvasOut(src, w, h) {
    var k = fit(w, h), c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
    return { img: jpeg(c), w: c.width, h: c.height };
  }
  /* Massstab 1:N aus Plantext/Dateiname erkennen (nur bei eindeutigem Treffer) */
  var NORM = [20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
  function detectRatio(text, name) {
    var c = {}, re = /(?:^|[^\d:.,])1\s{0,3}:\s{0,3}(\d{2,5})(?!\d)/g, m, kw = null;
    while ((m = re.exec(text))) { var n = +m[1]; if (NORM.indexOf(n) < 0) continue; c[n] = (c[n] || 0) + 1; if (!kw && /(Mass|Situation|Echelle|Scala|Scale|Plan)[^\d]{0,25}$/i.test(text.slice(Math.max(0, m.index - 30), m.index + 1))) kw = n; }
    var ks = Object.keys(c).map(Number), fm = /(?:^|[^0-9])(\d{2,5})\.[a-z0-9]{2,4}$/i.exec(name || ""), fn = fm && NORM.indexOf(+fm[1]) >= 0 ? +fm[1] : 0;
    if (fn) return !ks.length || ks.indexOf(fn) >= 0 ? fn : 0;   /* Dateiname «…_500.pdf»; bei widersprüchlichem Plantext lieber nicht automatisch */
    if (!ks.length) return 0;
    ks.sort(function (a, b) { return c[b] - c[a]; });
    return ks.length === 1 || c[ks[0]] > c[ks[1]] ? ks[0] : 0;
  }
  /* file -> Promise<{pages, render(n)->Promise<{img,w,h,ratio,mpp}>}> */
  function planSource(file) {
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      return loadPdfJs().then(function () { return file.arrayBuffer(); }).then(function (buf) { return window.pdfjsLib.getDocument({ data: buf }).promise; }).then(function (doc) {
        return { pages: doc.numPages, render: function (n) {
          return doc.getPage(n).then(function (pg) {
            var v1 = pg.getViewport({ scale: 1 }), sc = Math.min(MAXPX / Math.max(v1.width, v1.height), Math.sqrt(MAXAREA / (v1.width * v1.height))), vp = pg.getViewport({ scale: sc }), c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
            return pg.render({ canvasContext: c.getContext("2d"), viewport: vp, background: "#fff" }).promise.then(function () {
              var r = { img: jpeg(c), w: c.width, h: c.height };
              return pg.getTextContent().then(function (tc) {
                var txt = tc.items.map(function (i) { return i.str; }).join(""), N = detectRatio(txt, file.name);
                if (N) { r.ratio = N; r.mpp = 0.0003528 * N / sc; }   /* 1 pt = 0.3528 mm */
                try { r.grid = gridFromItems(tc.items, vp, sc, r.mpp || 0); r.words = planWords(txt.replace(/ {2,}/g, " ")); } catch (e) { r.grid = null; r.words = []; }
                return r;
              }, function () { return r; });
            });
          });
        } };
      });
    }
    return new Promise(function (ok, no) {
      var fr = new FileReader(); fr.onerror = no;
      fr.onload = function () { var im = new Image(); im.onerror = no; im.onload = function () { var r = canvasOut(im, im.naturalWidth, im.naturalHeight); ok({ pages: 1, render: function () { return Promise.resolve(r); } }); }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }

  /* Vorschau Plan (SVG über dem Plan-JPEG); lab = Beschriftungen (optional) */
  function planGeo(P) {
    return { pm: (P.pts || []).map(function (p) { return p.mode || ""; }), lfl: (P.lines || []).map(function (l) { return (l.cfg || {}).fl || ""; }), lines: (P.lines || []).map(function (l) { return l.pts; }), pts: (P.pts || []).map(function (p) { return p.pt; }), areas: (P.areas || []).map(function (a) { return a.pts; }), sond: (P.sond || []).map(function (p) { return p.pt; }), wl: (P.wl || []).map(function (p) { return p.pt; }), geb: (P.geb || []).map(function (p) { return p.pt; }), notes: P.notes || [] };
  }
  function planPreview(P, tt, lab) {
    if (!P || !P.img) return null;
    var k = Math.max(P.w, P.h) / 360, fig = document.createElement("figure"), g = planGeo(P); fig.className = "kmprev"; g.lab = lab || null;
    fig.innerHTML = '<svg viewBox="0 0 ' + P.w + " " + P.h + '" role="img" aria-label="' + esc(tt("pl_prevAlt")) + '"><image href="' + P.img + '" width="' + P.w + '" height="' + P.h + '"/>' + geoSvg(g, function (p) { return p; }, k, { labels: !!lab }) + "</svg>";
    return fig;
  }

  /* ---------- Plan-Export A4/A3, massstäblich (PDF über den Druckdialog, PNG als Datei) ---------- */
  var PAPER = { A4: [297, 210], A3: [420, 297] }, NSTD = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000], MMPX = 0.2646;
  function polyArea(pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
  function sheetSvg(c) {
    var tt = c.tt, d = PAPER[c.fmt], W = c.orient === "hoch" ? d[1] : d[0], H = c.orient === "hoch" ? d[0] : d[1], M = 10, tb = c.fmt === "A3" ? 26 : 22, F = { x: M, y: M, w: W - 2 * M, h: H - 2 * M - tb };
    var N = c.N, f2 = function (v) { return Math.round(v * 100) / 100; }, px, bg = "", scaled = true;
    if (c.kind === "map") {
      var fw = F.w * N / 1000, fh = F.h * N / 1000, x0 = c.center[0] - fw / 2 + c.off[0], y1 = c.center[1] + fh / 2 + c.off[1];
      px = function (p) { return [F.x + (p[0] - x0) * 1000 / N, F.y + (y1 - p[1]) * 1000 / N]; };
      if (c.base !== "none") bg = '<image href="' + esc(c.bg || c.bgUrl) + '" x="' + F.x + '" y="' + F.y + '" width="' + F.w + '" height="' + F.h + '" preserveAspectRatio="none"/>';
      bg += overlaySvg(c.overlay, px);
    } else {
      var P = c.P, mpp = P.mpp, f = mpp ? mpp * 1000 / N : Math.min(F.w / P.w, F.h / P.h), cx = c.center[0] + (mpp ? c.off[0] / mpp : 0), cy = c.center[1] - (mpp ? c.off[1] / mpp : 0); scaled = !!mpp;
      px = function (p) { return [F.x + F.w / 2 + (p[0] - cx) * f, F.y + F.h / 2 + (p[1] - cy) * f]; };
      var o0 = px([0, 0]); bg = '<image href="' + P.img + '" x="' + f2(o0[0]) + '" y="' + f2(o0[1]) + '" width="' + f2(P.w * f) + '" height="' + f2(P.h * f) + '"/>';
    }
    var g = Object.assign({}, c.geo, { lab: c.labels ? c.geo.lab : null }), geo = geoSvg(g, px, MMPX, { labels: c.labels });
    /* Massstabsbalken */
    var bar = "", L0 = 0, ok = c.kind === "map" || scaled;
    if (ok) { [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].some(function (L) { var mm = L * 1000 / N; if (mm >= 22 && mm <= 60) { L0 = L; return true; } return false; }); if (!L0) L0 = 10;
      var mmB = L0 * 1000 / N, bx = F.x + 6, by = F.y + F.h - 9; bar = '<rect x="' + bx + '" y="' + (by - 4) + '" width="' + (mmB + 14) + '" height="12" fill="#fff" fill-opacity=".85"/>';
      bar += '<rect x="' + (bx + 4) + '" y="' + by + '" width="' + f2(mmB / 2) + '" height="1.6" fill="#1a1c1e"/><rect x="' + f2(bx + 4 + mmB / 2) + '" y="' + by + '" width="' + f2(mmB / 2) + '" height="1.6" fill="#fff" stroke="#1a1c1e" stroke-width=".25"/><rect x="' + (bx + 4) + '" y="' + by + '" width="' + f2(mmB) + '" height="1.6" fill="none" stroke="#1a1c1e" stroke-width=".25"/>';
      bar += '<g font-size="2.4" fill="#1a1c1e"><text x="' + (bx + 4) + '" y="' + (by - 1) + '" text-anchor="middle">0</text><text x="' + f2(bx + 4 + mmB / 2) + '" y="' + (by - 1) + '" text-anchor="middle">' + L0 / 2 + '</text><text x="' + f2(bx + 4 + mmB) + '" y="' + (by - 1) + '" text-anchor="middle">' + L0 + ' m</text></g>'; }
    /* Nordpfeil (Karte ist nach Norden ausgerichtet) */
    var north = c.kind === "map" ? '<g transform="translate(' + (F.x + 10) + " " + (F.y + 16) + ')"><rect x="-6" y="-12" width="12" height="22" fill="#fff" fill-opacity=".85"/><polygon points="0,-10 4,6 0,3 -4,6" fill="#1a1c1e"/><text y="9.5" font-size="3.2" font-weight="700" text-anchor="middle" fill="#1a1c1e">N</text></g>' : "";
    /* Legende */
    var items = []; if ((c.geo.lines || []).length) { var sf = {}; (c.geo.lfl || []).forEach(function (f, i) { if ((c.geo.lines[i] || []).length > 1) sf[f] = 1; }); var sk = Object.keys(sf).sort(); if (sk.length > 1 || (sk.length === 1 && sk[0])) sk.forEach(function (f) { items.push(["ls:" + f, tt("ex_lLine") + (f ? " – " + tt("km_s_" + f) : "")]); }); else items.push(["l", tt("ex_lLine")]); } if ((c.geo.pts || []).length) items.push(["s", tt("ex_lSch")]); if ((c.geo.sond || []).length) items.push(["o", tt("ex_lSond")]); if ((c.geo.wl || []).length) items.push(["w", tt("ex_lWl")]); if ((c.geo.geb || []).length) items.push(["g", tt("ex_lGeb")]); if ((c.geo.areas || []).length) items.push(["a", tt("ex_lArea")]);
    var leg = ""; if (c.legend && items.length) { var lw = 46, lh = 7 + items.length * 5.4, lx = F.x + F.w - lw - 4, ly = F.y + 4;
      leg = '<rect x="' + lx + '" y="' + ly + '" width="' + lw + '" height="' + lh + '" fill="#fff" fill-opacity=".92" stroke="#1a1c1e" stroke-width=".25"/><text x="' + (lx + 2.5) + '" y="' + (ly + 4.2) + '" font-size="2.6" font-weight="700">' + esc(tt("ex_legend")) + "</text>";
      items.forEach(function (it, i) { var y = ly + 9 + i * 5.4, x = lx + 3.5, sy = "";
        if (it[0].indexOf("ls:") === 0) { var fk = it[0].slice(3), sd = (LSTY[fk] || LSTY[""])[1]; sy = '<line x1="' + (x - 2.5) + '" y1="' + y + '" x2="' + (x + 2.5) + '" y2="' + y + '" stroke="' + (LSTY[fk] || LSTY[""])[0] + '" stroke-width=".8"' + (sd ? ' stroke-dasharray="' + sd.split(" ").map(function (v) { return v * 0.25; }).join(" ") + '"' : "") + (sd === "1 7" ? ' stroke-linecap="round"' : "") + "/>"; }
        else if (it[0] === "l") sy = '<line x1="' + (x - 2.5) + '" y1="' + y + '" x2="' + (x + 2.5) + '" y2="' + y + '" stroke="#b8332a" stroke-width=".8"/>'; else if (it[0] === "s") sy = '<rect x="' + (x - 1.8) + '" y="' + (y - 1.8) + '" width="3.6" height="3.6" fill="#0d47c8"/>'; else if (it[0] === "o") sy = '<circle cx="' + x + '" cy="' + y + '" r="1.9" fill="#8a5b00"/>';
        else if (it[0] === "w") sy = '<rect x="' + (x - 1.6) + '" y="' + (y - 1.6) + '" width="3.2" height="3.2" fill="#b25e00" transform="rotate(45 ' + x + " " + y + ')"/>'; else if (it[0] === "g") sy = '<polygon points="' + (x - 1.9) + "," + (y + 1.8) + " " + (x - 1.9) + "," + y + " " + x + "," + (y - 1.9) + " " + (x + 1.9) + "," + y + " " + (x + 1.9) + "," + (y + 1.8) + '" fill="#1c6b3f"/>'; else sy = '<rect x="' + (x - 2.2) + '" y="' + (y - 1.6) + '" width="4.4" height="3.2" fill="#f28c00" fill-opacity=".4" stroke="#8a5b00" stroke-width=".3"/>';
        leg += sy + '<text x="' + (lx + 8.5) + '" y="' + (y + 0.9) + '" font-size="2.4">' + esc(it[1]) + "</text>"; }); }
    /* Schriftfeld */
    var ty = H - M - tb, m = c.meta || {}, cols = [F.w * 0.46, F.w * 0.14, F.w * 0.12, F.w * 0.14, F.w * 0.14], cx0 = F.x, tbs = '<rect x="' + F.x + '" y="' + ty + '" width="' + F.w + '" height="' + tb + '" fill="#fff" stroke="#1a1c1e" stroke-width=".5"/><line x1="' + F.x + '" y1="' + (ty + tb * 0.58) + '" x2="' + (F.x + F.w) + '" y2="' + (ty + tb * 0.58) + '" stroke="#1a1c1e" stroke-width=".25"/>';
    var heads = [tt("ex_h_title"), tt("ex_h_scale"), tt("ex_h_fmt"), tt("ex_h_date"), tt("ex_h_by")], vals = [c.title || m.projekt || "", scaled ? "1 : " + N : tt("ex_noscaleShort"), c.fmt + " " + tt(c.orient === "hoch" ? "ex_hoch" : "ex_quer"), m.datum || "", m.bearb || ""];
    cols.forEach(function (w, i) { if (i) tbs += '<line x1="' + f2(cx0) + '" y1="' + ty + '" x2="' + f2(cx0) + '" y2="' + (ty + tb * 0.58) + '" stroke="#1a1c1e" stroke-width=".25"/>';
      tbs += '<text x="' + f2(cx0 + 1.5) + '" y="' + (ty + 3.2) + '" font-size="2" fill="#516470">' + esc(heads[i]) + '</text><text x="' + f2(cx0 + 1.5) + '" y="' + (ty + tb * 0.58 - 2.2) + '" font-size="' + (i ? 3.4 : 4) + '" font-weight="700" fill="#1a1c1e">' + esc(vals[i]) + "</text>"; cx0 += w; });
    tbs += '<text x="' + (F.x + 1.5) + '" y="' + (ty + tb - 2.4) + '" font-size="2.2" fill="#516470">' + esc((m.projekt && c.title ? m.projekt + " · " : "") + (c.kind === "map" ? "© swisstopo · " : "") + "LV-Devis Tiefbau – App-Konzept: Alessandro Cortese") + "</text>";
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + " " + H + '" font-family="Segoe UI, Arial, sans-serif"><rect width="' + W + '" height="' + H + '" fill="#fff"/><defs><clipPath id="plotclip"><rect x="' + F.x + '" y="' + F.y + '" width="' + F.w + '" height="' + F.h + '"/></clipPath></defs><g clip-path="url(#plotclip)">' + bg + geo + bar + north + leg + '</g><rect x="' + F.x + '" y="' + F.y + '" width="' + F.w + '" height="' + F.h + '" fill="none" stroke="#1a1c1e" stroke-width=".5"/>' + tbs + "</svg>";
  }
  function printSheet(svg, fmt, orient) {
    var st = document.createElement("style"); st.id = "plotStyle";
    st.textContent = "@page{size:" + fmt + " " + (orient === "hoch" ? "portrait" : "landscape") + ";margin:0}@media print{body>*:not(#plotSheet){display:none!important}#plotSheet{display:block!important}html,body{margin:0!important;padding:0!important;background:#fff!important}#plotSheet svg{display:block}}#plotSheet{display:none}";
    var box = document.createElement("div"); box.id = "plotSheet"; box.innerHTML = svg; document.head.appendChild(st); document.body.appendChild(box);
    var done = function () { st.remove(); box.remove(); window.removeEventListener("afterprint", done); }; window.addEventListener("afterprint", done); window.print(); setTimeout(function () { if (document.getElementById("plotSheet")) done(); }, 60000);
  }
  function svgPng(svg, Wmm, Hmm, dpi, name, fail) {
    var w = Math.round(Wmm / 25.4 * dpi), h = Math.round(Hmm / 25.4 * dpi), url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), im = new Image();
    im.onload = function () { var cv = document.createElement("canvas"); cv.width = w; cv.height = h; var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url);
      try { cv.toBlob(function (b) { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }, "image/png"); } catch (e) { fail(); } };
    im.onerror = function () { URL.revokeObjectURL(url); fail(); }; im.src = url;
  }
  /* opt: { tt, src:{ map:{geo,overlay,base}|null, plan:{geo,P}|null }, meta:{projekt,datum,bearb,title}, lang } */
  function exportDlg(opt) {
    var tt = opt.tt, kinds = ["map", "plan"].filter(function (k) { return opt.src[k]; }); if (!kinds.length) return;
    var S = { kind: kinds[0], fmt: "A3", orient: "quer", N: 0, base: ((opt.src.map && opt.src.map.base) || "farbe") === "leer" ? "none" : ((opt.src.map && opt.src.map.base) || "farbe"), labels: true, legend: true, off: [0, 0], title: (opt.meta && opt.meta.title) || "" }, bgCache = {}, dpi = 150;
    var dlg = document.createElement("dialog"); dlg.className = "kmdlg kmexp"; dlg.setAttribute("aria-labelledby", "exTitle");
    var sel = function (id, lab, arr) { return '<label class="kmbl" for="' + id + '">' + esc(lab) + '</label><select id="' + id + '">' + arr.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + "</option>"; }).join("") + "</select>"; };
    dlg.innerHTML = '<div class="kmhead"><h2 id="exTitle">' + esc(tt("ex_title")) + '</h2><button type="button" class="btn ghost small" data-x="close">' + esc(tt("km_close")) + "</button></div>" +
      '<div class="kmbar" role="group" aria-label="' + esc(tt("ex_opts")) + '">' + (kinds.length > 1 ? sel("exKind", tt("ex_src"), [["map", tt("ex_srcMap")], ["plan", tt("ex_srcPlan")]]) : "") +
      sel("exFmt", tt("ex_fmt"), [["A3", "A3"], ["A4", "A4"]]) + sel("exOr", tt("ex_orient"), [["quer", tt("ex_quer")], ["hoch", tt("ex_hoch")]]) +
      sel("exN", tt("ex_scale"), [["0", tt("ex_auto")]].concat(NSTD.map(function (n) { return [String(n), "1 : " + n]; }))) +
      '<span id="exBaseW">' + sel("exBase", tt("ex_base"), [["farbe", tt("km_bFarbe")], ["grau", tt("km_bGrau")], ["luft", tt("km_aerial")], ["kataster", tt("km_bKat")], ["av", tt("km_bAV")], ["none", tt("ex_noBase")]]) + "</span></div>" +
      '<div class="kmbar"><label class="kmbl" for="exT">' + esc(tt("ex_ttl")) + '</label><input type="text" id="exT" class="kmw" value="' + esc(S.title) + '" style="width:260px"><label class="check"><input type="checkbox" id="exLbl" checked> <span>' + esc(tt("ex_lbl")) + '</span></label><label class="check"><input type="checkbox" id="exLeg" checked> <span>' + esc(tt("ex_leg")) + "</span></label>" +
      '<span class="kmnudge" role="group" aria-label="' + esc(tt("ex_pos")) + '">' + [["l", "←", "km_nl"], ["u", "↑", "km_nu"], ["d", "↓", "km_nd"], ["r", "→", "km_nr"], ["0", "◎", "ex_posReset"]].map(function (a) { return '<button type="button" class="btn ghost small" data-x="' + a[0] + '" aria-label="' + esc(tt(a[2])) + '">' + a[1] + "</button>"; }).join("") + "</span></div>" +
      '<p class="hint" id="exInfo" role="status"></p><div class="exprev" id="exPrev" tabindex="0" role="region" aria-label="' + esc(tt("ex_prevLbl")) + '"></div><p class="hint">' + esc(tt("ex_note")) + '</p><div class="kmfoot"><span></span><span class="kmbar"><button type="button" class="btn ghost" data-x="png">' + esc(tt("ex_png")) + '</button><button type="button" class="btn" data-x="print">' + esc(tt("ex_print")) + "</button></span></div>";
    document.body.appendChild(dlg);
    var $ = function (s) { return dlg.querySelector(s); }, cur = null;
    var eb0 = $("#exBase"); if (eb0) eb0.value = S.base;   /* vorgewählter Hintergrund = der in der Karte gewählte */
    function build() {
      var src = opt.src[S.kind], g = src.geo, pts = S.kind === "map" ? geoPoints(Object.assign({}, g, { extra: src.overlay ? ovCorners(src.overlay) : [] })) : (function () { var a = []; geoPoints(g).forEach(function (p) { a.push(p); }); return a; })();
      var d = PAPER[S.fmt], W = S.orient === "hoch" ? d[1] : d[0], H = S.orient === "hoch" ? d[0] : d[1], tb = S.fmt === "A3" ? 26 : 22, Fw = W - 20, Fh = H - 20 - tb;
      var e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity; pts.forEach(function (p) { e0 = Math.min(e0, p[0]); e1 = Math.max(e1, p[0]); n0 = Math.min(n0, p[1]); n1 = Math.max(n1, p[1]); });
      if (!pts.length) { e0 = e1 = n0 = n1 = 0; }
      var mpp = S.kind === "plan" ? src.P.mpp : 1, ctr = [(e0 + e1) / 2, (n0 + n1) / 2], ew = (e1 - e0) * mpp * 1.2 + 20 * mpp, eh = (n1 - n0) * mpp * 1.2 + 20 * mpp;
      var Nauto = NSTD.filter(function (n) { return ew <= Fw * n / 1000 && eh <= Fh * n / 1000; })[0] || 20000, N = S.N || Nauto;
      var c = { tt: tt, kind: S.kind, geo: g, P: src.P, overlay: src.overlay, base: S.base, fmt: S.fmt, orient: S.orient, N: N, center: ctr, off: S.off, labels: S.labels, legend: S.legend, title: S.title, meta: opt.meta };
      if (S.kind === "map" && S.base !== "none") {
        var fw = Fw * N / 1000, fh = Fh * N / 1000, bb = [ctr[0] - fw / 2 + S.off[0], ctr[1] - fh / 2 + S.off[1], ctr[0] + fw / 2 + S.off[0], ctr[1] + fh / 2 + S.off[1]], sc = Math.min(1, 3600 / Math.max(Fw, Fh) / (dpi / 25.4)), Wp = Math.round(Fw / 25.4 * dpi * sc), Hp = Math.round(Fh / 25.4 * dpi * sc);
        c.bgUrl = bgUrl({ bb: bb, W: Wp, H: Hp }, S.base); c.bg = bgCache[c.bgUrl] || null;
      }
      c.Nauto = Nauto; c.W = W; c.H = H; return c;
    }
    function render() {
      cur = build(); var scaled = S.kind === "map" || (opt.src.plan && opt.src.plan.P.mpp);
      $("#exPrev").innerHTML = sheetSvg(cur); $("#exBaseW").hidden = S.kind !== "map";
      $("#exInfo").textContent = (scaled ? tt("ex_infoScale").replace("{n}", cur.N).replace("{a}", cur.Nauto) : tt("ex_noscale")); $("#exInfo").className = "hint" + (scaled ? "" : " reqmsg");
      if (cur.bgUrl && !cur.bg && !bgCache["x" + cur.bgUrl]) { bgCache["x" + cur.bgUrl] = 1; var u = cur.bgUrl;
        fetch(u, { mode: "cors" }).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (bl) { var fr = new FileReader(); fr.onload = function () { bgCache[u] = fr.result; if (cur && cur.bgUrl === u) render(); }; fr.readAsDataURL(bl); }).catch(function () { bgCache["x" + u] = 2; }); }
    }
    function ready(cb) { var u = cur.bgUrl; if (!u || cur.bg) return cb(true); var t = setInterval(function () { if (bgCache[u]) { clearInterval(t); render(); cb(true); } else if (bgCache["x" + u] === 2) { clearInterval(t); cb(false); } }, 150); setTimeout(function () { clearInterval(t); cb(!!bgCache[u]); }, 15000); }
    var wire = function (id, fn, ev) { var e = $(id); if (e) e.addEventListener(ev || "change", function () { fn(e); render(); }); };
    wire("#exKind", function (e) { S.kind = e.value; S.N = 0; S.off = [0, 0]; }); wire("#exFmt", function (e) { S.fmt = e.value; S.off = [0, 0]; }); wire("#exOr", function (e) { S.orient = e.value; S.off = [0, 0]; });
    wire("#exN", function (e) { S.N = +e.value; }); wire("#exBase", function (e) { S.base = e.value; }); wire("#exT", function (e) { S.title = e.value; }, "input"); wire("#exLbl", function (e) { S.labels = e.checked; }); wire("#exLeg", function (e) { S.legend = e.checked; });
    var fname = function (ext) { return "Plan_" + (S.title || (opt.meta && opt.meta.projekt) || "LV-Devis").replace(/[^\w\-äöüÄÖÜéèàç]+/g, "_") + "_1-" + cur.N + "_" + S.fmt + "." + ext; };
    dlg.addEventListener("click", function (e) {
      var b = e.target.closest("[data-x]"); if (!b) return; var x = b.dataset.x;
      if (x === "close") { dlg.close(); dlg.remove(); return; }
      if (["l", "r", "u", "d", "0"].indexOf(x) >= 0) { var st = cur.N * 0.05; if (x === "0") S.off = [0, 0]; else S.off = [S.off[0] + (x === "l" ? -st : x === "r" ? st : 0), S.off[1] + (x === "u" ? st : x === "d" ? -st : 0)]; render(); return; }
      var inf = $("#exInfo"); inf.textContent = tt("ex_prep");
      ready(function (okBg) {
        if (!okBg) { inf.textContent = tt("ex_bgFail"); inf.className = "hint reqmsg"; }
        var svg = sheetSvg(cur);
        if (x === "print") { dlg.close(); printSheet(svg, S.fmt, S.orient); dlg.remove(); }
        else svgPng(svg, cur.W, cur.H, 150, fname("png"), function () { inf.textContent = tt("ex_pngFail"); inf.className = "hint reqmsg"; });
      });
    });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); dlg.close(); dlg.remove(); });
    dlg.showModal(); render(); $("#exFmt").focus();
  }

  /* Dialog: Linien (Rohranlage je Linie), Schächte, Sondagen – auf swisstopo-Karte (LV95) oder kalibriertem Plan (Pixel)
     opt: { kind:"map"|"plan", tt, lang, model:{lines,pts,sond}, cat, defRohr, defTyp, recName(rid), plan:{img,w,h,cal}, onApply(model,cal), onClose } */
  var seq = 0, nid = function (p) { return p + Date.now().toString(36) + (seq++).toString(36); };
  var INTRO = "lvd-km-intro";
  /* ---------- Leitungskonfiguration je Linie: Rohre (Typ × Anzahl), Verlegeart, Oberfläche, Tiefe/Breite ---------- */
  var PIPES = [["55", "K55"], ["100", "K100"], ["120", "K120"], ["150", "K150"]];
  var ARTS = ["kies", "beton", "laengs"], FLS = ["belag", "wiese", "pflaster", "roh"];
  var LSTY = { belag: ["#2b2f33", ""], pflaster: ["#b8332a", "9 5"], wiese: ["#2e7d32", "1 7"], roh: ["#8a5a2b", "11 4 2 4"], "": ["#b8332a", ""] };   /* Farbe + Strichart: auch ohne Farbsehen unterscheidbar */
  function cfgOf(l) {
    var c = l.cfg;
    if (!c || typeof c !== "object") {
      c = l.cfg = { rt: {}, art: "kies", fl: "", T: "", B: "" }; var r = l.rohr || {};
      if (r.sys === "block") c.art = "beton"; else if (r.sys === "laengs") c.art = "laengs";
      if (r.dn && r.sys !== "block") c.rt[String(r.dn)] = Math.max(1, parseInt(r.n, 10) || 1);
    }
    if (!c.rt || typeof c.rt !== "object") c.rt = {};
    if (ARTS.indexOf(c.art) < 0) c.art = "kies"; if (c.fl && FLS.indexOf(c.fl) < 0) c.fl = "";
    c.T = c.T == null ? "" : String(c.T); c.B = c.B == null ? "" : String(c.B);
    c.ab = c.ab == null ? "betonstein" : String(c.ab); c.gesp = !!c.gesp;   /* ab: Abbruch bestehende Pflästerung ("" = keiner) */
    ["kr", "b90", "b45"].forEach(function (k) { c[k] = c[k] == null ? "" : String(c[k]); }); return c;
  }
  function pipeList(c) {   /* [[dn, n], …] absteigend nach Anzahl, dann Durchmesser: erster Eintrag = Haupttyp */
    return Object.keys(c.rt || {}).map(function (k) { return [parseInt(k, 10), Math.max(0, parseInt(c.rt[k], 10) || 0)]; }).filter(function (e) { return e[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1] || b[0] - a[0]; });
  }
  function pipeTxt(c) {
    return pipeList(c).sort(function (a, b) { return b[0] - a[0]; }).map(function (e) { return e[1] + "×K" + e[0]; }).join(" + ");
  }
  function lineSync(l) {   /* l.rohr bleibt als Kurzform für ältere Funktionen (Haupttyp) gültig */
    var c = cfgOf(l), pl = pipeList(c), r = l.rohr = l.rohr || { sys: "k55", dn: "55", len: "10", n: "1" };
    r.sys = c.art === "beton" ? "block" : c.art === "laengs" ? "laengs" : "k55";
    if (pl.length) { r.dn = String(pl[0][0]); r.n = String(pl[0][1]); } if (!r.len) r.len = "10";
  }
  function cfgMissing(c) { var m = []; if (!pipeList(c).length) m.push("rt"); if (!c.fl) m.push("fl"); return m; }
  function lineTxt(l, tt) {   /* z. B. «2×K100 + 3×K55 · einbetoniert · Belag» (nur gesetzte Angaben) */
    var c = cfgOf(l), a = [];
    if (pipeList(c).length) a.push(pipeTxt(c));
    if (pipeList(c).length || c.fl) a.push(tt("km_s_" + c.art));
    if (c.fl) a.push(tt("km_s_" + c.fl));
    return a.join(" · ");
  }

  /* Leitungsanschlüsse am Schacht aus den Linien: Ende = hinein, Start = hinaus; je Rohr 1 Anschluss; K55 → DN 80, K100 und grösser → DN 150 */
  function connOf(M, p) {
    var inn = {}, out = {}, a80 = 0, a150 = 0, n = 0;
    (M.lines || []).forEach(function (l) {
      var pl = pipeList(cfgOf(l)); if (!pl.length && l.rohr && parseInt(l.rohr.dn, 10)) pl = [[parseInt(l.rohr.dn, 10), Math.max(1, parseInt(l.rohr.n, 10) || 1)]]; [[l.e === p.id, inn], [l.s === p.id, out]].forEach(function (x) {
        if (!x[0]) return; n++; pl.forEach(function (e) { x[1][e[0]] = (x[1][e[0]] || 0) + e[1]; if (e[0] >= 100) a150 += e[1]; else a80 += e[1]; });
      });
    });
    return { inn: inn, out: out, a80: a80, a150: a150, n: n };
  }
  function connTxt(o) { return Object.keys(o).sort(function (a, b) { return b - a; }).map(function (k) { return o[k] + "×K" + k; }).join(" + ") || "–"; }

  function open(opt) {
    var tt = opt.tt, cat = opt.cat, plan = opt.kind === "plan", M = JSON.parse(JSON.stringify(opt.model || { lines: [], pts: [], sond: [] })), cur = null, mode = "", sel = null, base = "farbe", map, layer, grp, calPts = [];
    var PROV = { swisstopo: [["farbe", "km_bFarbe"], ["grau", "km_bGrau"], ["luft", "km_aerial"]], geoadmin: [["kataster", "km_bKat"], ["av", "km_bAV"], ["leer", "km_bLeer"], ["viewer", "km_bViewer"]] };
    try { var sb = localStorage.getItem("lvd-km-base"); if (sb && ["farbe", "grau", "luft", "kataster", "leer", "av"].indexOf(sb) >= 0) base = sb; } catch (e) { }
    var provOf = function (b) { return PROV.geoadmin.some(function (o) { return o[0] === b; }) ? "geoadmin" : "swisstopo"; };
    M.sond = M.sond || []; M.notes = M.notes || []; M.areas = M.areas || []; M.wl = M.wl || []; M.geb = M.geb || [];
    var cal = plan ? JSON.parse(JSON.stringify(opt.plan.cal || {})) : null;
    var AD = plan ? { ll: function (p) { return [-p[1], p[0]]; }, pt: function (ll) { return [Math.round(ll.lng * 10) / 10, Math.round(-ll.lat * 10) / 10]; },
      dist: function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) * (cal.scale || 0); } }
      : { ll: function (p) { return toWGS(p[0], p[1]); }, pt: function (ll) { return toLV95(ll.lat, ll.lng).map(function (v) { return Math.round(v * 100) / 100; }); },
        dist: function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    var lastCfg = { rt: {}, art: "kies", fl: "", T: "", B: "" }, wlT = "sg", lastTyp = null, folded = {}, lastSel = null;
    if (opt.defCfg) lastCfg = JSON.parse(JSON.stringify(opt.defCfg));
    var lineLen = function (pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += AD.dist(pts[i - 1], pts[i]); return s; };
    var COL = [["#0d47c8", "km_cBlau"], ["#b8332a", "km_cRot"], ["#1a1c1e", "km_cSchwarz"], ["#b25e00", "km_cOrange"], ["#1c6b3f", "km_cGruen"]];
    var rul = [], tip = null, planCleared = false, showLbl = true, ov0 = null, ovl = plan ? null : (opt.overlay ? JSON.parse(JSON.stringify(opt.overlay)) : null), ovImg = null, gcp = [];
    var perim = function (pts) { var s = lineLen(pts); return pts.length > 2 ? s + AD.dist(pts[pts.length - 1], pts[0]) : s; };
    var area = function (pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } a = Math.abs(a) / 2; return plan ? a * Math.pow(cal.scale || 0, 2) : a; };
    var intro = false; try { intro = !localStorage.getItem(INTRO); } catch (e) { }
    var maxOn = true; try { maxOn = localStorage.getItem("lvd-km-max") !== "0"; } catch (e) { }
    var dlg = document.createElement("dialog"); dlg.className = "kmdlg" + (maxOn ? " kmmax" : ""); dlg.setAttribute("aria-labelledby", "kmTitle");
    var ip = plan ? ["km_i1p", "km_i2p", "km_i3p", "km_i5"] : ["km_i1", "km_i2", "km_i3", "km_i4", "km_i5"];
    dlg.innerHTML =
      '<div class="kmhead"><h2 id="kmTitle">' + esc(tt(plan ? "pl_title" : "km_title")) + '</h2><span class="kmheadb"><button type="button" class="btn ghost small" data-k="max" aria-pressed="' + (maxOn ? "true" : "false") + '" title="' + esc(tt("km_maxT")) + '">' + esc(tt("km_max")) + '</button><button type="button" class="btn ghost small" data-k="close">' + esc(tt("km_close")) + "</button></span></div>" +
      '<details class="kmintro"' + (intro ? " open" : "") + "><summary>" + esc(tt("km_intro")) + "</summary><ol>" + ip.map(function (k) { return "<li>" + esc(tt(k)) + "</li>"; }).join("") + "</ol></details>" +
      (plan ? "" : '<form class="kmsearch" role="search"><label for="kmQ">' + esc(tt("km_search")) + '</label><input type="search" id="kmQ" autocomplete="off" placeholder="' + esc(tt("km_searchPh")) + '"><button type="submit" class="btn small">' + esc(tt("km_go")) + "</button></form>" +
        '<ul class="kmhits" id="kmHits" aria-label="' + esc(tt("km_hits")) + '"></ul>') +
      '<div class="kmtool">' +
      '<div class="kmgrp" role="group" aria-label="' + esc(tt("km_g_obj")) + '"><span class="kmgl" aria-hidden="true">' + esc(tt("km_g_obj")) + "</span>" +
      (plan ? '<button type="button" class="btn small" data-k="mcal" aria-pressed="false">' + esc(tt("pl_cal")) + "</button>" : "") +
      '<button type="button" class="btn small" data-k="mline" aria-pressed="false">' + esc(tt("km_draw")) + "</button>" +
      '<button type="button" class="btn small" data-k="mpt" aria-pressed="false">' + esc(tt("km_pt")) + "</button>" +
      '<button type="button" class="btn small" data-k="msond" aria-pressed="false">' + esc(tt("km_sond")) + "</button>" +
      '<button type="button" class="btn small" data-k="marea" aria-pressed="false">' + esc(tt("km_area")) + "</button>" +
      '<button type="button" class="btn small" data-k="mwl" aria-pressed="false">' + esc(tt("km_wl")) + '</button><select id="kmWlT" class="kmwlt" aria-label="' + esc(tt("km_wlType")) + '">' + ["ts", "bo", "sg", "zs"].map(function (k) { return '<option value="' + k + '"' + (k === "sg" ? " selected" : "") + ">" + esc(tt("km_wl" + k)) + "</option>"; }).join("") + "</select>" +
      '<button type="button" class="btn small" data-k="mgeb" aria-pressed="false">' + esc(tt("km_geb")) + "</button>" +
      "</div>" +
      '<div class="kmgrp" role="group" aria-label="' + esc(tt("km_g_note")) + '"><span class="kmgl" aria-hidden="true">' + esc(tt("km_g_note")) + "</span>" +
      '<button type="button" class="btn small" data-k="mtext" aria-pressed="false">' + esc(tt("km_nText")) + "</button>" +
      '<button type="button" class="btn small" data-k="marrow" aria-pressed="false">' + esc(tt("km_nArrow")) + "</button>" +
      '<button type="button" class="btn small" data-k="msline" aria-pressed="false">' + esc(tt("km_nLine")) + "</button>" +
      '<button type="button" class="btn small" data-k="mrect" aria-pressed="false">' + esc(tt("km_nRect")) + "</button>" +
      '<label class="kmbl" for="kmCol">' + esc(tt("km_col")) + '</label><select id="kmCol">' + COL.map(function (c) { return '<option value="' + c[0] + '">' + esc(tt(c[1])) + "</option>"; }).join("") + "</select>" + "</div>" +
      '<div class="kmgrp" role="group" aria-label="' + esc(tt("km_g_edit")) + '"><span class="kmgl" aria-hidden="true">' + esc(tt("km_g_edit")) + "</span>" +
      '<button type="button" class="btn small" data-k="medit" aria-pressed="false">' + esc(tt("km_edit")) + "</button>" +
      '<button type="button" class="btn small" data-k="mruler" aria-pressed="false">' + esc(tt("km_ruler")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="undo">' + esc(tt("km_undo")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="end">' + esc(tt("km_end")) + "</button>" +
      '<button type="button" class="btn ghost small del" data-k="clear">' + esc(tt("km_clear")) + "</button>" +
      '<label class="kmbl" for="kmStep">' + esc(tt("km_step")) + '</label><input type="text" inputmode="decimal" id="kmStep" class="kmn" value="1"></div>' +
      '<div class="kmgrp" role="group" aria-label="' + esc(tt("km_g_view")) + '"><span class="kmgl" aria-hidden="true">' + esc(tt("km_g_view")) + "</span>" +
      '<button type="button" class="btn ghost small" data-k="fit">' + esc(tt("km_fit")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="center">' + esc(tt("km_center")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="lbl" aria-pressed="true">' + esc(tt("km_lbl")) + "</button>" +
      (plan ? "" : '<button type="button" class="btn ghost small" data-k="sv">' + esc(tt("km_sv")) + '</button><button type="button" class="btn ghost small" data-k="svkey" title="' + esc(tt("km_sv_keyHint")) + '">' + esc(tt("km_sv_key")) + "</button>") +
      (plan ? "" : '<span class="kmseg" role="group" aria-label="' + esc(tt("km_prov")) + '"><button type="button" class="btn small" data-prov="swisstopo" aria-pressed="false">swisstopo</button><button type="button" class="btn small" data-prov="geoadmin" aria-pressed="false">geo.admin.ch</button></span><label class="kmbl" for="kmBase">' + esc(tt("km_src")) + '</label><select id="kmBase"></select><button type="button" class="btn ghost small" data-k="geo">' + esc(tt("km_geo")) + '</button><span id="kmAv" hidden><input type="url" id="kmAvUrl" class="kmavin" aria-label="' + esc(tt("km_avUrl")) + '" placeholder="https://…/wms"><input type="text" id="kmAvLy" class="kmavin" aria-label="' + esc(tt("km_avLy")) + '" placeholder="' + esc(tt("km_avLy")) + '"><button type="button" class="btn small" id="kmAvGo">' + esc(tt("km_avGo")) + '</button></span><a class="btn ghost small" id="kmNetz" href="https://www.swisscom.ch/rida/online/geoportal/ng/index.html?login" target="_blank" rel="noopener noreferrer">' + esc(tt("km_netz")) + "</a>") + "</div></div>" +
      (plan ? '<form class="kmcalf" id="kmCalF" hidden><label for="kmCalM">' + esc(tt("pl_calAsk")) + '</label><input type="text" inputmode="decimal" id="kmCalM" class="numin"><button type="submit" class="btn small">' + esc(tt("pl_calSet")) + "</button></form>" : "") +
      '<div class="kmmain"><div class="kmleft">' +
      '<div id="kmMap" class="kmmap" tabindex="0" role="application" aria-label="' + esc(tt("km_mapLbl")) + '"></div><div class="kmask" id="kmAsk" hidden role="group"></div><div class="kmask kmctx" id="kmCtx" hidden role="group"></div><div class="kmprops" id="kmProps" hidden role="dialog"></div><div class="kmprops kmsv" id="kmSv" hidden role="dialog"></div>' +
      (plan ? "" : '<iframe id="kmView" class="kmframe" hidden title="map.geo.admin.ch" referrerpolicy="no-referrer"></iframe>') +
      '<div class="kmleg" id="kmLeg" hidden></div>' +
      '<p class="hint kmhelp" id="kmHelp"></p>' +
      '<p class="hint kmunits" id="kmUnits"></p></div>' +
      '<div class="kmright"><div class="kmquick" id="kmQuick" hidden role="group" aria-label="' + esc(tt("km_lt_title")) + '"></div><h3 class="kmoh">' + esc(tt("km_obj")) + '</h3><div class="kmbar"><button type="button" class="btn ghost small" id="kmFoldAll" hidden></button></div><div class="kmobj" id="kmObj" role="group" aria-label="' + esc(tt("km_obj")) + '"></div>' + '<details class="kmmiss" id="kmMiss" hidden><summary></summary><ul class="kmmissl"></ul></details>' +
      (plan ? "" : '<details class="kmcat" id="kmCat"><summary>' + esc(tt("km_cat")) + '</summary><div class="kmcatb"><p class="hint kmtel">' + esc(tt("km_catTel")) + '</p><div class="kmchips" id="kmChips" role="group" aria-label="' + esc(tt("km_catChips")) + '" hidden></div><label for="kmCatQ">' + esc(tt("km_catSearch")) + '</label><input type="search" id="kmCatQ" autocomplete="off" placeholder="' + esc(tt("km_catPh")) + '"><p class="hint" id="kmCatMsg" role="status"></p><ul class="kmcatl" id="kmCatL" aria-label="' + esc(tt("km_catRes")) + '"></ul><h3 class="kmcath">' + esc(tt("km_catSel")) + '</h3><ul class="kmcatl kmcats" id="kmCatS"></ul></div></details>') +
      (plan ? "" : '<details class="kmcat kmovd" id="kmOvD"><summary>' + esc(tt("ov_title")) + '</summary><div class="kmcatb"><p class="hint">' + esc(tt("ov_hint")) + '</p>' +
        '<label for="kmOvF">' + esc(tt("pl_file")) + '</label><input type="file" id="kmOvF" accept=".pdf,application/pdf,image/*"><p class="hint" id="kmOvMsg" role="status"></p><div class="kmovauto" id="kmOvAuto" hidden><p class="hint" id="kmOvAutoT"></p><div class="kmbar"><button type="button" class="btn small" data-oa="ok">' + esc(tt("ov_confirm")) + '</button><button type="button" class="btn ghost small" data-oa="ref">' + esc(tt("ov_refine")) + '</button><button type="button" class="btn ghost small del" data-oa="no">' + esc(tt("ov_discard")) + '</button></div></div>' +
        '<div class="kmbar"><button type="button" class="btn small" id="kmOvPlan">' + esc(tt("ov_fromPlan")) + '</button><button type="button" class="btn small" data-k="mgeo" aria-pressed="false">' + esc(tt("ov_geo")) + '</button><button type="button" class="btn small" data-ov="tr" id="kmOvTr">' + esc(tt("ov_tr")) + '</button><button type="button" class="btn ghost small" data-ov="c">' + esc(tt("ov_center")) + '</button><button type="button" class="btn ghost small del" data-ov="x">' + esc(tt("km_catRemove")) + '</button></div>' +
        '<div class="kmbar kmovc"><label class="kmbl" for="kmOvO">' + esc(tt("km_opacity")) + '</label><input type="range" id="kmOvO" min="10" max="100" step="10" value="60"><label class="kmbl" for="kmOvR">' + esc(tt("ov_rot")) + '</label><input type="text" inputmode="decimal" id="kmOvR" class="kmn"><label class="kmbl" for="kmOvS">' + esc(tt("ov_mpp")) + '</label><input type="text" inputmode="decimal" id="kmOvS" class="kmn">' +
        '<span class="kmnudge" role="group" aria-label="' + esc(tt("ov_adj")) + '">' + [["l", "←", "km_nl"], ["u", "↑", "km_nu"], ["d", "↓", "km_nd"], ["r", "→", "km_nr"], ["rl", "⟲", "ov_rl"], ["rr", "⟳", "ov_rr"], ["sm", "−", "ov_sm"], ["sp", "+", "ov_sp"]].map(function (a) { return '<button type="button" class="btn ghost small" data-ov="' + a[0] + '" aria-label="' + esc(tt(a[2])) + '">' + a[1] + "</button>"; }).join("") + '</span></div></div></details>') +
      '</div></div>' +
      '<div class="kmslot" id="kmSlot"></div>' +
      '<div class="kmfoot"><p class="kmlen" id="kmLen" role="status" aria-live="polite"></p><p class="kmcost" id="kmCost" role="status"></p><button type="button" class="btn" data-k="apply">' + esc(tt("km_apply")) + "</button></div>";
    document.body.appendChild(dlg);
    var $ = function (s) { return dlg.querySelector(s); };
    /* ---------- Arbeitsfläche: Werkzeuge | Ebenen + Marker | Karte | Eigenschaften / Auswertung, Fussleiste ---------- */
    (function () {
      var E = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
      var head = $(".kmhead"), tool = $(".kmtool"), main = $(".kmmain"), foot = $(".kmfoot"), canvas = $(".kmleft"), right = $(".kmright"), intro = $(".kmintro"), srch = $(".kmsearch"), hits = $("#kmHits"), slot = $("#kmSlot");
      dlg.classList.add("kmws");
      var grid = E("div", "kmgrid"), tools = E("nav", "kmtools"), mid = E("aside", "kmmid"), side = E("aside", "kmside");
      tools.setAttribute("aria-label", tt("ws_tools")); mid.setAttribute("aria-label", tt("ws_layers")); side.setAttribute("aria-label", tt("ws_props"));
      var pick = function (sel) { return dlg.querySelector(sel); };
      var grp = function (title, sels) { var g = E("div", "kmtg"); g.setAttribute("role", "group"); g.setAttribute("aria-label", title); g.appendChild(E("span", "kmgl", esc(title))); sels.forEach(function (q) { var n = pick(/^[#.\[]|^label/.test(q) ? q : '[data-k="' + q + '"]'); if (n) g.appendChild(n); }); return g; };
      tools.appendChild(grp(tt("ws_sel"), ["medit"]));
      tools.appendChild(grp(tt("ws_draw"), ["mcal", "mline", "mpt", "mwl", "#kmWlT", "mgeb", "msond", "marea"]));
      tools.appendChild(grp(tt("ws_note"), ["mtext", "marrow", "msline", "mrect", "label[for=kmCol]", "#kmCol"]));
      tools.appendChild(grp(tt("ws_measure"), ["mruler", "undo", "end", "clear", "label[for=kmStep]", "#kmStep"]));
      /* Kopf: Titel, Suche, Knöpfe */
      if (srch) { var sw = E("div", "kmsw"); sw.appendChild(srch); if (hits) sw.appendChild(hits); head.insertBefore(sw, head.children[1]); }
      var calF = $("#kmCalF"); if (calF) canvas.insertBefore(calF, canvas.firstChild);
      if (slot) canvas.appendChild(slot);
      /* Mitte: Ebenen, Marker, Hilfe */
      var h1 = E("h3", "kmph", esc(tt("ws_layers"))); mid.appendChild(h1);
      ["#kmCat", "#kmOvD"].forEach(function (q) { var n = pick(q); if (n) mid.appendChild(n); });
      mid.appendChild(E("h3", "kmph", esc(tt("ws_marker")))); mid.appendChild(E("p", "hint", esc(tt("ws_markerHint")))); mid.appendChild(E("div", "kmmk", "")).id = "kmMk";
      if (intro) mid.appendChild(intro);
      /* Rechts: Eigenschaften | Auswertung */
      var tabs = E("div", "kmtabs"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", tt("ws_props") + " / " + tt("ws_eval"));
      tabs.innerHTML = '<button type="button" role="tab" id="kmTabP" aria-selected="true" aria-controls="kmPanP">' + esc(tt("ws_props")) + '</button><button type="button" role="tab" id="kmTabE" aria-selected="false" aria-controls="kmPanE" tabindex="-1">' + esc(tt("ws_eval")) + "</button>";
      var panP = E("div", "kmpan"), panE = E("div", "kmpan"); panP.id = "kmPanP"; panE.id = "kmPanE"; panP.setAttribute("role", "tabpanel"); panE.setAttribute("role", "tabpanel"); panP.setAttribute("aria-labelledby", "kmTabP"); panE.setAttribute("aria-labelledby", "kmTabE"); panE.hidden = true;
      ["#kmQuick", ".kmoh", "#kmFoldAll", "#kmObj", "#kmMiss"].forEach(function (q) { var n = pick(q); if (n) { if (q === "#kmFoldAll") n = n.parentNode; panP.appendChild(n); } });
      panE.appendChild(E("div", "kmeval", "")).id = "kmEval"; panE.appendChild(E("div", "kmeval kmchk", "")).id = "kmChk"; if (!plan) panE.appendChild(E("div", "kmeval kmhz", "")).id = "kmHz"; panE.appendChild(E("div", "kmeval kmsug", "")).id = "kmSug"; if (!plan) { var dx = E("div", "kmeval", '<button type="button" class="btn ghost small" id="kmDxf">' + esc(tt("ws_dxf")) + "</button>"); panE.appendChild(dx); } var cost = pick("#kmCost"); if (cost) panE.appendChild(cost);
      side.appendChild(tabs); side.appendChild(panP); side.appendChild(panE);
      tabs.addEventListener("click", function (e) { var b = e.target.closest("[role=tab]"); if (!b) return; var p = b.id === "kmTabP"; tabs.querySelectorAll("[role=tab]").forEach(function (t) { var on = t === b; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; }); panP.hidden = !p; panE.hidden = p; });
      tabs.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { var o = tabs.querySelector("[aria-selected=false]"); o.click(); o.focus(); e.preventDefault(); } });
      /* Fussleiste: Fang/Zeichenhilfen, Massstab/Koordinate, Kartenquelle/Ansicht, Übernehmen */
      var bottom = E("div", "kmbottom"), fang = E("div", "kmfang"); fang.setAttribute("role", "group"); fang.setAttribute("aria-label", tt("ws_fang"));
      fang.innerHTML = [["pt", "ws_snapPt"], ["ln", "ws_snapLn"], ["rect", "ws_rect"], ["ortho", "ws_ortho"]].map(function (a) { return '<button type="button" class="btn ghost small kmtgl" data-sn="' + a[0] + '" aria-pressed="false">' + esc(tt(a[1])) + "</button>"; }).join("");
      var stat = E("div", "kmstat", '<span id="kmCoord" aria-hidden="true"></span><span id="kmScale"></span>'); stat.setAttribute("role", "status");
      var view = dlg.querySelectorAll(".kmtool .kmgrp"); view = view[view.length - 1]; if (view) { var vl = view.querySelector(".kmgl"); if (vl) vl.remove(); view.classList.add("kmview"); }
      bottom.appendChild(fang); bottom.appendChild(stat); if (view) bottom.appendChild(view); if (foot) bottom.appendChild(foot);
      var tog = E("button", "btn ghost small kmmidtog", esc(tt("ws_layers"))); tog.type = "button"; tog.setAttribute("aria-expanded", "false"); tog.addEventListener("click", function () { var o = grid.classList.toggle("kmmid-open"); tog.setAttribute("aria-expanded", o ? "true" : "false"); }); head.insertBefore(tog, head.children[1]);
      grid.appendChild(tools); grid.appendChild(mid); grid.appendChild(canvas); grid.appendChild(side); canvas.classList.add("kmcanvas");
      [tool, main, right].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
      dlg.appendChild(grid); dlg.appendChild(bottom);
    })();
    dlg.querySelector(".kmintro").addEventListener("toggle", function (e) { if (!e.target.open) try { localStorage.setItem(INTRO, "1"); } catch (x) { } });
    var byId = function (arr, id) { return arr.filter(function (l) { return l.id === id; })[0]; };

    function tiles() {
      if (layer) map.removeLayer(layer);
      /* Ebene ohne bekannten Typ: zuerst WMS, bei Fehlern (z. B. nur als WMTS verfügbar) automatisch WMTS – und umgekehrt */
      var flex = function (id, op, first) {
        var grp2 = L.layerGroup(), tries = first === "wmts" ? ["wmts", "wms"] : ["wms", "wmts"], ti = 0, ok = 0, bad = 0, cur;
        function mk(t) { return t === "wms" ? L.tileLayer.wms("https://wms.geo.admin.ch/", { layers: id, format: "image/png", transparent: true, maxZoom: 20, opacity: op, zIndex: 5, attribution: "© geo.admin.ch" }) : T(id, "png", { opacity: op, zIndex: 5 }); }
        function go() {
          if (cur) grp2.removeLayer(cur); ok = 0; bad = 0; cur = mk(tries[ti]);
          cur.on("tileload", function () { ok++; }); cur.on("tileerror", function () { bad++; if (!ok && bad >= 4 && ti < tries.length - 1) { ti++; go(); } });
          grp2.addLayer(cur);
        }
        go(); return grp2;
      };
      var T = function (id, ext, o) { return L.tileLayer(WMTS + id + "/default/current/3857/{z}/{x}/{y}." + ext, Object.assign({ maxZoom: 20, maxNativeZoom: 18, zIndex: 1, attribution: "© swisstopo / geo.admin.ch" }, o || {})); };
      layer = base === "luft" ? L.layerGroup([T("ch.swisstopo.swissimage", "jpeg", { maxNativeZoom: 19 })])
        : base === "grau" ? L.layerGroup([T("ch.swisstopo.pixelkarte-grau", "jpeg")])
        : base === "leer" ? L.layerGroup([])   /* leere Basis: nur gewählte Katalog-Ebenen auf weissem Grund */
        : base === "av" ? L.layerGroup(avCfg().u ? [viewWms(avCfg().u, avCfg().l, { attr: "© OpenData AV" })] : [])
        : base === "kataster" ? (function () { var g = L.layerGroup(), v = viewWms(WMS, "ch.kantone.cadastralwebmap-farbe", { attr: "© geo.admin.ch", fail: function () { g.removeLayer(v); g.addLayer(flex("ch.kantone.cadastralwebmap-farbe", 1, "wmts")); } }); g.addLayer(v); return g; })()   /* nur der Parzellenplan, ohne Landeskarte dahinter */
        : L.layerGroup([T("ch.swisstopo.pixelkarte-farbe", "jpeg")]);
      map.getContainer().style.background = base === "kataster" || base === "leer" || base === "av" ? "#fff" : "";
      layer.addTo(map);   /* Reihenfolge über zIndex: Basiskarte 1, Deckschichten 5/10 */
    }
    /* Ausschnitt im Kartenviewer map.geo.admin.ch öffnen (gleicher Hintergrund, aktuelles Zentrum) */
    /* gewählte Katalog-Ebenen (Deckkraft einstellbar), werden im Browser gemerkt */
    var ov = []; try { ov = JSON.parse(localStorage.getItem(CATKEY) || "[]"); } catch (e) { ov = []; } if (!Array.isArray(ov)) ov = [];
    var ovGrp = null, catList = null;
    function saveOv() { try { localStorage.setItem(CATKEY, JSON.stringify(ov)); } catch (e) { } }
    function ovLayer(o) {
      var op = { maxZoom: 20, maxNativeZoom: 18, opacity: o.op, zIndex: 10, attribution: "© geo.admin.ch" };
      return o.type === "wms" ? L.tileLayer.wms("https://wms.geo.admin.ch/", { layers: o.srv, format: "image/png", transparent: true, maxZoom: 20, opacity: o.op, zIndex: 10, attribution: "© geo.admin.ch" })
        : L.tileLayer(WMTS + o.srv + "/default/current/3857/{z}/{x}/{y}." + o.fmt, op);
    }
    function drawOv() {
      if (!ovGrp) return; ovGrp.clearLayers(); if (base === "viewer") return;
      ov.forEach(function (o) { ovLayer(o).addTo(ovGrp); });
    }
    function selList() {
      var ul = $("#kmCatS"); ul.innerHTML = "";
      if (!ov.length) { ul.innerHTML = '<li class="kmnote">' + esc(tt("km_catNone")) + "</li>"; return; }
      ov.forEach(function (o, i) {
        var li = document.createElement("li"); li.className = "kmov";
        li.innerHTML = '<span class="kmovn">' + esc(o.label) + '</span><label>' + esc(tt("km_opacity")) + ' <input type="range" min="10" max="100" step="10" value="' + Math.round(o.op * 100) + '" aria-label="' + esc(tt("km_opacity") + ": " + o.label) + '"></label><button type="button" class="btn ghost small del" data-ovdel="' + i + '" aria-label="' + esc(tt("km_catRemove") + ": " + o.label) + '">' + esc(tt("km_catRemove")) + "</button>";
        li.querySelector("input").addEventListener("input", function (e) { o.op = e.target.value / 100; saveOv(); drawOv(); });
        ul.appendChild(li);
      });
    }
    function resList() {
      var q = $("#kmCatQ").value.trim().toLowerCase(), ul = $("#kmCatL"), msg = $("#kmCatMsg"); ul.innerHTML = "";
      if (!catList) return;
      var hits = catList.filter(function (c) { return !q || c.label.toLowerCase().indexOf(q) >= 0 || c.id.toLowerCase().indexOf(q) >= 0; });
      msg.textContent = tt("km_catCount").replace("{n}", hits.length).replace("{m}", catList.length);
      hits.slice(0, 40).forEach(function (c) {
        var li = document.createElement("li"), on = ov.some(function (o) { return o.id === c.id; }), b = document.createElement("button"); b.type = "button"; b.className = "kmhit";
        b.setAttribute("aria-pressed", on ? "true" : "false"); b.textContent = (on ? "✓ " : "+ ") + c.label; b.title = c.id;
        b.addEventListener("click", function () {
          var i = ov.findIndex(function (o) { return o.id === c.id; });
          if (i >= 0) ov.splice(i, 1); else ov.push({ id: c.id, label: c.label, type: c.type, srv: c.srv, fmt: c.fmt, op: 0.8 });
          saveOv(); drawOv(); selList(); resList();
        });
        li.appendChild(b); ul.appendChild(li);
      });
    }
    /* Schnellsuche: nur Stichwörter mit Treffern im Katalog anzeigen (mit Anzahl) */
    function chips() {
      var box = $("#kmChips"); if (!catList) return; box.innerHTML = "";
      ["4G", "5G", "Mobilfunk", "Antenne", "Breitband", "Glasfaser", "Telekommunikation"].forEach(function (w) {
        var n = catList.filter(function (c) { var q = w.toLowerCase(); return c.label.toLowerCase().indexOf(q) >= 0 || c.id.toLowerCase().indexOf(q) >= 0; }).length;
        if (!n) return; var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.q = w; b.textContent = w + " (" + n + ")"; box.appendChild(b);
      });
      box.hidden = !box.children.length;
    }
    function openCat() {
      if (catList) { chips(); return resList(); } $("#kmCatMsg").textContent = tt("km_searching");
      loadCatalog(opt.lang).then(function (l) { catList = l; chips(); resList(); }).catch(function () { $("#kmCatMsg").textContent = tt("km_catErr"); });
    }
    function geoUrl(embed) {
      var c = map.getCenter(), e = toLV95(c.lat, c.lng), res = 156543.03 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, map.getZoom()),
        R = [4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250, 1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5], z = 0, d = 1e9;
      R.forEach(function (r, i) { var x = Math.abs(Math.log(r / res)); if (x < d) { d = x; z = i; } });
      var bg = base === "luft" ? "ch.swisstopo.swissimage" : base === "grau" ? "ch.swisstopo.pixelkarte-grau" : base === "kataster" || base === "leer" || base === "av" ? "void" : "ch.swisstopo.pixelkarte-farbe";
      return "https://map.geo.admin.ch/#/" + (embed ? "embed" : "map") + "?lang=" + (opt.lang || "de") + "&center=" + Math.round(e[0]) + "," + Math.round(e[1]) + "&z=" + z + "&bgLayer=" + bg + (base === "kataster" || ov.length ? "&layers=" + (base === "kataster" ? ["ch.kantone.cadastralwebmap-farbe"] : []).concat(ov.map(function (o) { return o.id; })).join(";") : "");
    }
    function openGeo() { window.open(geoUrl(false), "_blank", "noopener"); }
    /* immer auf den Bestand (alle Linien, Schächte, Sondagen) zoomen */
    function fitAll() {
      var pts = []; M.lines.forEach(function (l) { l.pts.forEach(function (p) { pts.push(AD.ll(p)); }); }); M.pts.concat(M.sond, M.wl, M.geb).forEach(function (p) { pts.push(AD.ll(p.pt)); }); M.notes.concat(M.areas).forEach(function (n) { n.pts.forEach(function (p) { pts.push(AD.ll(p)); }); }); if (ovl) ovCorners(ovl).forEach(function (q) { pts.push(toWGS(q[0], q[1])); });
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: plan ? 3 : 19, animate: false });
      else if (plan) map.fitBounds([[-opt.plan.h, 0], [0, opt.plan.w]], { animate: false });
    }
    function setBase(v) {
      var was = base === "viewer"; base = v; var vw = $("#kmView"), mp = $("#kmMap");
      if (v === "viewer") { if (layer) { map.removeLayer(layer); layer = null; } mode = ""; vw.src = geoUrl(true).replace("&bgLayer=", "&bgLayer="); vw.hidden = false; mp.hidden = true; }
      else { if (vw) { vw.hidden = true; vw.removeAttribute("src"); } mp.hidden = false; map.invalidateSize(); tiles(); drawOv(); if (was) fitAll(); }
      avRow(); refresh();
    }
    function avRow() {
      var r = $("#kmAv"); if (!r) return; r.hidden = base !== "av"; var c = avCfg(), u = $("#kmAvUrl"), l = $("#kmAvLy"); if (u && !u.value) u.value = c.u || "https://wms.cadastralwebmap.ch/WMS"; if (l && !l.value) l.value = c.l;
    }
    function calTxt() { return cal.scale && cal.auto ? tt("pl_calAuto").replace("{r}", cal.auto).replace("{s}", (Math.round(cal.scale * 1000) / 1000)) : cal.scale ? tt("pl_calOk").replace("{m}", fmt(cal.m)).replace("{s}", (Math.round(cal.scale * 1000) / 1000)) : tt("pl_calNo"); }
    var undoSt = [], curN = null, curA = null, tmp = [], layers = {}, lastMove = 0, noteCol = "#0d47c8";
    var NT = { text: "km_nText", arrow: "km_nArrow", sline: "km_nLine", rect: "km_nRect" };
    var snap = function () { undoSt.push(JSON.stringify(M)); if (undoSt.length > 100) undoSt.shift(); };
    var findObj = function (id) { var a = [M.lines, M.pts, M.sond, M.notes, M.areas, M.wl, M.geb]; for (var i = 0; i < a.length; i++) { var o = byId(a[i], id); if (o) return { arr: a[i], o: o }; } return null; };
    function select(id) { sel = { id: id }; refresh(); }
    function bindObj(lay, id, noMove) {
      lay.on("click", function (e) { L.DomEvent.stop(e); if (Date.now() - lastMove < 250) return; select(id); });
      if (!noMove) lay.on("mousedown", function (e) { startMove(e, id); });
    }
    /* ganzes Objekt am Strich verschieben */
    function startMove(e, id) {
      var f = findObj(id); if (!f || !f.o.pts || !f.o.pts.length || mode !== "edit") return;
      L.DomEvent.stop(e); sel = { id: id }; snap();
      var start = AD.pt(e.latlng), base = f.o.pts.map(function (p) { return p.slice(); }), moved = false;
      map.dragging.disable();
      function mm(ev) { var c = AD.pt(ev.latlng), dx = c[0] - start[0], dy = c[1] - start[1]; if (dx || dy) moved = true; f.o.pts = base.map(function (p) { return [p[0] + dx, p[1] + dy]; }); if (layers[id] && layers[id].upd) layers[id].upd(); updTotal(); }
      function up() { map.off("mousemove", mm); document.removeEventListener("mouseup", up); map.dragging.enable(); if (moved) { lastMove = Date.now(); refresh(); } else undoSt.pop(); }
      map.on("mousemove", mm); document.addEventListener("mouseup", up);
    }
    function vmark(q, cls, size) { var hit = 24; return L.marker(q, { draggable: cls === "kmv", keyboard: false, zIndexOffset: 1000, icon: L.divIcon({ className: cls, html: "<span style=\"width:" + size + "px;height:" + size + "px;margin:" + (hit - size) / 2 + "px\"></span>", iconSize: [hit, hit], iconAnchor: [hit / 2, hit / 2] }) }).addTo(grp); }
    /* Eckpunkte ziehen, Mittelpunkt einfügen, Doppelklick löscht Eckpunkt */
    function handles(o, poly, minPts, closed) {
      o.pts.forEach(function (q, j) {
        var m = vmark(AD.ll(q), "kmv", 14);
        m.on("dragstart", function () { snap(); });
        m.on("drag", function (e) { o.pts[j] = AD.pt(e.target.getLatLng()); if (layers[o.id] && layers[o.id].upd) layers[o.id].upd(); updTotal(); });
        m.on("dragend", function () { lastMove = Date.now(); refresh(); });
        m.on("dblclick contextmenu", function (e) { L.DomEvent.stop(e); if (poly && o.pts.length > minPts) { snap(); o.pts.splice(j, 1); refresh(); } });
      });
      if (!poly) return;
      for (var j = 0; j < o.pts.length - (closed ? 0 : 1); j++) (function (j) {
        var a = o.pts[j], b = o.pts[(j + 1) % o.pts.length], m = L.marker(AD.ll([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), { keyboard: false, icon: L.divIcon({ className: "kmm", html: "<span></span>", iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(grp);
        m.on("click", function (e) { L.DomEvent.stop(e); snap(); o.pts.splice(j + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); refresh(); });
      })(j);
    }
    function dragPt(m, o, key) {
      m.on("dragstart", function () { snap(); }); m.on("drag", function (e) { o[key] = AD.pt(e.target.getLatLng()); if (key === "pt" && M.pts.indexOf(o) >= 0) M.lines.forEach(function (l) { if (l.s === o.id) l.pts[0] = o.pt.slice(); if (l.e === o.id) l.pts[l.pts.length - 1] = o.pt.slice(); }); });
      m.on("dragend", function () { lastMove = Date.now(); refresh(); });
    }
    function noteLayers(n, edit, on) {
      var col = n.color || "#0d47c8", L0 = [], upd;
      if (n.type === "text") {
        var m = L.marker(AD.ll(n.pts[0]), { interactive: edit, draggable: edit, keyboard: false, icon: L.divIcon({ className: "kmtext s" + (n.size || "m") + (on ? " on" : ""), html: '<span style="color:' + col + '">' + esc(n.text || "") + "</span>", iconSize: null, iconAnchor: [0, 10] }) }).addTo(grp);
        if (edit) { dragPt(m, n, "pts"); m.off("drag"); m.on("drag", function (e) { n.pts[0] = AD.pt(e.target.getLatLng()); }); bindObj(m, n.id, true); }
        return { upd: function () { m.setLatLng(AD.ll(n.pts[0])); } };
      }
      if (n.type === "rect") {
        var r = L.rectangle([AD.ll(n.pts[0]), AD.ll(n.pts[1])], { color: col, weight: on ? 4 : 2.5, fillColor: col, fillOpacity: 0.08, interactive: edit, bubblingMouseEvents: false }).addTo(grp);
        if (edit) bindObj(r, n.id);
        return { upd: function () { r.setBounds([AD.ll(n.pts[0]), AD.ll(n.pts[1])]); } };
      }
      var ln = L.polyline(n.pts.map(AD.ll), { color: col, weight: on ? 5 : 3, interactive: edit, bubblingMouseEvents: false }).addTo(grp), hd = null;
      function head() {
        var a = map.latLngToLayerPoint(AD.ll(n.pts[0])), b = map.latLngToLayerPoint(AD.ll(n.pts[n.pts.length - 1])), ang = Math.atan2(b.y - a.y, b.x - a.x), s = 16;
        return [b, L.point(b.x - s * Math.cos(ang - 0.4), b.y - s * Math.sin(ang - 0.4)), L.point(b.x - s * Math.cos(ang + 0.4), b.y - s * Math.sin(ang + 0.4))].map(function (p) { return map.layerPointToLatLng(p); });
      }
      if (n.type === "arrow" && n.pts.length > 1) hd = L.polygon(head(), { color: col, fillColor: col, fillOpacity: 1, weight: 1, interactive: false }).addTo(grp);
      if (edit) bindObj(ln, n.id);
      return { upd: function () { ln.setLatLngs(n.pts.map(AD.ll)); if (hd) hd.setLatLngs(head()); } };
    }
    function ovDraw() {
      if (plan || !map) return;
      if (!ovl || !ovl.img) { if (ovImg) { ovImg.remove(); ovImg = null; } return; }
      var pane = map.getPane("kmov"); if (!ovImg) { ovImg = document.createElement("img"); ovImg.alt = ""; ovImg.className = "kmovimg"; pane.appendChild(ovImg); }
      if (ovImg.getAttribute("data-k") !== ovl.img.slice(-40) + ovl.w) { ovImg.src = ovl.img; ovImg.setAttribute("data-k", ovl.img.slice(-40) + ovl.w); }
      var c = ovCorners(ovl).map(function (q) { return map.latLngToLayerPoint(toWGS(q[0], q[1])); }), w = ovl.w, h = ovl.h;
      ovImg.style.width = w + "px"; ovImg.style.height = h + "px"; ovImg.style.opacity = ovl.op || 0.6;
      ovImg.style.transform = "matrix(" + [(c[1].x - c[0].x) / w, (c[1].y - c[0].y) / w, (c[3].x - c[0].x) / h, (c[3].y - c[0].y) / h, c[0].x, c[0].y].join(",") + ")";
      var R = $("#kmOvR"), S2 = $("#kmOvS"), O = $("#kmOvO"); if (document.activeElement !== R) R.value = Math.round(ovl.rot * 100) / 100; if (document.activeElement !== S2) S2.value = Math.round(ovl.mpp * 10000) / 10000; O.value = Math.round((ovl.op || 0.6) * 100);
    }
    /* Objekte aus dem Plan (Pixel) in die Karte (LV95) übertragen – über die Ausrichtung des Plan-Hintergrunds */
    function transfer() {
      var P = opt.planObjs, msg = $("#kmOvMsg"); if (plan || !P) return;
      var cnt = ["lines", "pts", "sond", "wl", "geb", "areas", "notes"].reduce(function (a, k) { return a + (P[k] || []).length; }, 0);
      if (!ovl || ovl.ref !== "plan") { msg.textContent = tt("ov_trNeed"); msg.className = "hint reqmsg"; return; }
      if (ovl.autoSrc && ovl.autoSrc !== "gcp" && !ovl.conf) { msg.textContent = tt("ov_needConf"); msg.className = "hint reqmsg"; return; }
      if (!cnt) { msg.textContent = tt("ov_trNone"); msg.className = "hint"; return; }
      var m0 = JSON.stringify(M), p0 = JSON.stringify(P), cl0 = planCleared, sc = opt.planScale || 0, dev = [];
      var cv = function (q) { return ovPx(ovl, q[0], q[1]).map(function (v) { return Math.round(v * 100) / 100; }); }, cp = function (o) { return JSON.parse(JSON.stringify(o)); };
      (P.lines || []).forEach(function (l, i) { var nl = { id: nid("l"), pts: l.pts.map(cv), rid: l.rid || null, rid2: l.rid2 || null, rohr: cp(l.rohr), cfg: l.cfg ? cp(l.cfg) : undefined }; M.lines.push(nl);
        var a = sc ? total([l.pts]) * sc : 0, b = total([nl.pts]); dev.push((opt.recName(l.rid) || tt("km_lineN").replace("{n}", i + 1)) + ": " + (sc ? tt("ov_trPlan") + " " + fmt(a) + " m → " : "") + tt("ov_trMap") + " " + fmt(b) + " m" + (a ? " (" + (b >= a ? "+" : "") + fmt((b / a - 1) * 100) + " %)" : "")); });
      (P.areas || []).forEach(function (f) { M.areas.push({ id: nid("f"), pts: f.pts.map(cv), rid: f.rid || null, belag: cp(f.belag), fl: f.fl || "", ab: f.ab }); });
      (P.pts || []).forEach(function (p) { var o = cp(p); o.id = nid("p"); o.pt = cv(p.pt); M.pts.push(o); });
      (P.sond || []).forEach(function (p) { var o = cp(p); o.id = nid("s"); o.pt = cv(p.pt); M.sond.push(o); });
      (P.wl || []).forEach(function (p) { var o = cp(p); o.id = nid("w"); o.pt = cv(p.pt); M.wl.push(o); });
      (P.geb || []).forEach(function (p) { var o = cp(p); o.id = nid("g"); o.pt = cv(p.pt); M.geb.push(o); });
      (P.notes || []).forEach(function (n) { var o = cp(n); o.id = nid("n"); if (n.type === "rect") { var a = n.pts[0], b = n.pts[1]; o.type = "sline"; o.pts = [a, [b[0], a[1]], b, [a[0], b[1]], a].map(cv); } else o.pts = n.pts.map(cv); M.notes.push(o); });
      ["lines", "pts", "sond", "wl", "geb", "areas", "notes"].forEach(function (k) { P[k] = []; }); planCleared = true; sel = null; refresh(); fitAll();
      msg.className = "hint"; msg.innerHTML = "<b>" + esc(tt("ov_trDone").replace("{n}", cnt)) + "</b>" + (dev.length ? "<br>" + dev.map(esc).join("<br>") : "");
      toast(dlg, tt("ov_trDone").replace("{n}", cnt), tt("km_undoBtn"), function () { M = JSON.parse(m0); M.notes = M.notes || []; M.areas = M.areas || []; M.wl = M.wl || []; M.geb = M.geb || []; opt.planObjs = JSON.parse(p0); planCleared = cl0; msg.textContent = ""; refresh(); });
    }
    function updTotal() {
      var tot = M.lines.reduce(function (a, l) { return a + effLen(l.pts); }, 0);
      $("#kmLen").textContent = tt("km_total").replace("{m}", fmt(tot)).replace("{n}", M.lines.filter(function (l) { return l.pts.length > 1; }).length).replace("{s}", M.pts.length).replace("{o}", M.sond.length) + (M.wl.length || M.geb.length ? " · " + tt("km_wgTot").replace("{w}", M.wl.length).replace("{g}", M.geb.length) : "") + (M.areas.length ? " · " + tt("km_areaTot").replace("{a}", fmt(M.areas.reduce(function (a, f) { return a + area(f.pts); }, 0))) : "") + (plan ? " · " + calTxt() : "");
    }
    function hideTip() { if (tip && map.hasLayer(tip)) map.removeLayer(tip); }
    /* Live-Messung beim Zeichnen: Teilstrecke und Total (bzw. Fläche) am Mauszeiger */
    function liveTip(ll, shift) {
      var si = snapPreview(ll, shift); if (si && si.kind) ll = L.latLng(AD.ll(si.c));
      var t = "", pts = null, closed = false;
      if (mode === "line" && cur) pts = (byId(M.lines, cur) || {}).pts; else if (mode === "sline" && curN) pts = (byId(M.notes, curN) || {}).pts; else if (mode === "area" && curA) { pts = (byId(M.areas, curA) || {}).pts; closed = true; } else if (mode === "ruler" && rul.length) pts = rul;
      if (!pts || !pts.length) { hideTip(); return; }
      var c = AD.pt(ll), all = pts.concat([c]), seg = AD.dist(pts[pts.length - 1], c), noScale = plan && !cal.scale;
      if (closed) t = noScale ? tt("km_noScale") : tt("km_tipArea").replace("{a}", fmt(area(all))).replace("{p}", fmt(perim(all)));
      else t = noScale ? tt("km_noScale") : tt("km_tipLine").replace("{s}", fmt(seg)).replace("{t}", fmt(lineLen(all)));
      if (si && (si.kind === "rect" || si.kind === "ortho") && pts.length) { var pa = pts[pts.length - 1], an2 = Math.round((Math.atan2(si.c[1] - pa[1], si.c[0] - pa[0]) * 180 / Math.PI + 360) % 360); t += " · " + (si.kind === "rect" ? (si.rel === "perp" ? "⊥ 90°" : "∥ 0°") : "45°-Raster " + an2 + "°"); }
      if (!tip) tip = L.tooltip({ permanent: true, direction: "right", offset: [14, 0], className: "kmtip", opacity: 0.95 });
      tip.setLatLng(ll).setContent(esc(t)); if (!map.hasLayer(tip)) tip.addTo(map);
    }
    var MODES = { ruler: "mruler", geo: "mgeo", line: "mline", pt: "mpt", sond: "msond", cal: "mcal", edit: "medit", area: "marea", wl: "mwl", geb: "mgeb", text: "mtext", arrow: "marrow", sline: "msline", rect: "mrect" };
    function draw() {
      grp.clearLayers(); layers = {}; var edit = mode === "edit";
      M.lines.forEach(function (l) {
        var ll = l.pts.map(AD.ll), on = sel && sel.id === l.id, sty = LSTY[cfgOf(l).fl || ""], col = on ? "#0d47c8" : sty[0];
        if (ll.length > 1) {
          var halo = L.polyline(ll, { color: "#fff", weight: 8, interactive: false }).addTo(grp), main = L.polyline(ll, { color: col, weight: on ? 5 : 3.5, dashArray: sty[1] || null, lineCap: sty[1] === "1 7" ? "round" : "butt", interactive: edit, bubblingMouseEvents: false }).addTo(grp);
          layers[l.id] = { upd: function () { var q = l.pts.map(AD.ll); halo.setLatLngs(q); main.setLatLngs(q); } };
          if (edit) bindObj(main, l.id);
        }
        if (!(edit && on)) ll.forEach(function (q, j) { L.circleMarker(q, { radius: l.id === cur && j === ll.length - 1 ? 6 : 4, color: col, weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
        else handles(l, true, 2);
      });
      M.areas.forEach(function (f) {
        var on = sel && sel.id === f.id, col = on ? "#0d47c8" : "#8a5b00", ll = f.pts.map(AD.ll);
        if (ll.length > 2) { var pg = L.polygon(ll, { color: col, weight: on ? 4 : 2.5, fillColor: "#f28c00", fillOpacity: 0.3, interactive: edit, bubblingMouseEvents: false }).addTo(grp); layers[f.id] = { upd: function () { pg.setLatLngs(f.pts.map(AD.ll)); } }; if (edit) bindObj(pg, f.id); }
        else if (ll.length > 1) L.polyline(ll, { color: col, weight: 3, dashArray: "5 4", interactive: false }).addTo(grp);
        if (!(edit && on)) ll.forEach(function (q) { L.circleMarker(q, { radius: 4, color: col, weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
        else handles(f, true, 3, true);
      });
      M.notes.forEach(function (n) {
        var on = sel && sel.id === n.id; layers[n.id] = noteLayers(n, edit, on);
        if (edit && on && n.type !== "text") handles(n, n.type === "sline", 2);
      });
      var pm = function (arr, cls, lbl) {
        arr.forEach(function (p, i) {
          var on = sel && sel.id === p.id, m = L.marker(AD.ll(p.pt), { interactive: edit, draggable: edit, keyboard: false, icon: L.divIcon({ className: cls + (on ? " on" : "") + (arr === M.pts && p.mode && p.mode !== "neu" ? " ex" : ""), html: "<span>" + lbl + (i + 1) + "</span>", iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(grp);
          if (edit) { dragPt(m, p, "pt"); bindObj(m, p.id, true); }
        });
      };
      pm(M.pts, "kmsch", ""); pm(M.sond, "kmsond", "S"); pm(M.wl, "kmwl", "W"); pm(M.geb, "kmgeb", "G");
      if (showLbl && opt.labels) {   /* Beschriftung: Linie mit Name, Länge und Rohranlage; Schächte, Sondagen, Werklöcher, Einführungen, Flächen mit Name */
        var lb = opt.labels(M, { len: effLen, slope: function (pts) { return SLOPE && !!slopeHz(pts, M.lines); }, area: area }), put = function (ll, t, cls, ang) { if (t) L.marker(ll, { interactive: false, keyboard: false, zIndexOffset: -500, icon: L.divIcon({ className: "kmlbl " + cls, html: "<span" + (ang != null ? ' style="--a:' + ang + 'deg"' : "") + ">" + esc(t) + "</span>", iconSize: [0, 0] }) }).addTo(grp); };
        M.lines.forEach(function (l, i) { if (l.pts.length < 2) return; var bj = 1, bd = -1; for (var j = 1; j < l.pts.length; j++) { var dd = AD.dist(l.pts[j - 1], l.pts[j]) || Math.hypot(l.pts[j][0] - l.pts[j - 1][0], l.pts[j][1] - l.pts[j - 1][1]); if (dd > bd) { bd = dd; bj = j; } }
          var pa = map.latLngToLayerPoint(AD.ll(l.pts[bj - 1])), pb = map.latLngToLayerPoint(AD.ll(l.pts[bj])), an = Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180 / Math.PI; if (an > 90) an -= 180; if (an < -90) an += 180;   /* Beschriftung in Leitungsrichtung, nie auf dem Kopf */
          put(AD.ll([(l.pts[bj - 1][0] + l.pts[bj][0]) / 2, (l.pts[bj - 1][1] + l.pts[bj][1]) / 2]), lb.lines && lb.lines[i], "c rot", Math.round(an * 10) / 10); });
        [["pts", M.pts], ["sond", M.sond], ["wl", M.wl], ["geb", M.geb]].forEach(function (a) { a[1].forEach(function (p, i) { put(AD.ll(p.pt), lb[a[0]] && lb[a[0]][i], "r"); }); });
        M.areas.forEach(function (f, i) { if (f.pts.length < 3) return; var cx = 0, cy = 0; f.pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); put(AD.ll([cx / f.pts.length, cy / f.pts.length]), lb.areas && lb.areas[i], "c"); });
      }
      if (rul.length) { var rl = rul.map(AD.ll); if (rl.length > 1) { L.polyline(rl, { color: "#fff", weight: 6, interactive: false }).addTo(grp); L.polyline(rl, { color: "#1a1c1e", weight: 2.5, dashArray: "7 5", interactive: false }).addTo(grp); }
        rl.forEach(function (q) { L.circleMarker(q, { radius: 4, color: "#1a1c1e", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
        if (rl.length > 1) L.marker(rl[rl.length - 1], { interactive: false, keyboard: false, icon: L.divIcon({ className: "kmlbl r", html: "<span><b>" + esc(cal && !cal.scale ? tt("km_noScale") : fmt(lineLen(rul)) + " m") + "</b></span>", iconSize: [0, 0] }) }).addTo(grp); }
      tmp.forEach(function (q) { L.circleMarker(AD.ll(q), { radius: 5, color: "#0d47c8", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
      if (plan) { calPts.forEach(function (q) { L.circleMarker(AD.ll(q), { radius: 6, color: "#0d47c8", weight: 3, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
        if (cal.a && cal.b && !cal.auto && !calPts.length) L.polyline([AD.ll(cal.a), AD.ll(cal.b)], { color: "#0d47c8", weight: 2, dashArray: "6 5", interactive: false }).addTo(grp); }
      updTotal(); $("#kmUnits").textContent = tt(plan ? "km_unitsPlan" : "km_units");
      Object.keys(MODES).forEach(function (m) { var b = $("[data-k=" + MODES[m] + "]"); if (b) b.setAttribute("aria-pressed", mode === m ? "true" : "false"); });
      $("[data-k=marea]").textContent = mode === "area" ? tt("km_areaOn") : tt("km_area"); $("[data-k=mline]").textContent = mode === "line" ? tt("km_drawOn") : tt("km_draw"); $("[data-k=mpt]").textContent = mode === "pt" ? tt("km_ptOn") : tt("km_pt"); $("[data-k=msond]").textContent = mode === "sond" ? tt("km_sondOn") : tt("km_sond");
      if (plan) $("[data-k=mcal]").textContent = mode === "cal" ? tt("pl_calOn") : tt("pl_cal");
      $("[data-k=end]").disabled = !(cur || curN || curA || (mode === "ruler" && rul.length)); $("[data-k=undo]").disabled = !(undoSt.length || tmp.length); $("[data-k=clear]").disabled = !(rul.length || M.lines.length || M.pts.length || M.sond.length || M.notes.length || M.areas.length || M.wl.length || M.geb.length); $("[data-k=center]").disabled = !mode || mode === "edit";
      $("#kmHelp").textContent = mode === "ruler" ? tt("km_helpRuler") : mode === "geo" ? tt(!gcp.length ? "ov_g1" : !gcp[gcp.length - 1].t ? (gcp.length === 1 ? "ov_g2" : "ov_g4") : "ov_g3") : mode === "cal" ? tt("pl_helpCal") : mode === "edit" ? tt("km_helpEdit") : mode === "text" ? tt("km_helpText") : mode === "arrow" || mode === "rect" ? tt("km_helpTwo") : mode ? tt("km_helpOn") : plan && !cal.scale ? tt("pl_calNeed") : base === "av" && !avCfg().u ? tt("km_avHelp") : tt("km_helpOff");
      map.getContainer().style.cursor = mode && mode !== "edit" ? "crosshair" : "";
      var vw = base === "viewer"; dlg.querySelectorAll(".kmbar [data-k^=m],[data-k=center],[data-k=end],[data-k=fit]").forEach(function (b) { if (vw) b.disabled = true; else if (b.dataset.k !== "end" && b.dataset.k !== "center") b.disabled = false; });
      if (vw) $("#kmHelp").textContent = tt("km_viewerHelp");
    }
    function sel1(label, arr, val, on) {
      var s = document.createElement("select"); s.setAttribute("aria-label", label);
      arr.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (o[0] === val) op.selected = true; s.appendChild(op); });
      s.addEventListener("change", function () { on(s.value); }); return s;
    }
    function cell(label, el) { var d = document.createElement("div"); d.className = "kmc"; var l = document.createElement("span"); l.textContent = label; d.appendChild(l); d.appendChild(el); return d; }
    function inp(label, val, cls, on, txt) { var n = document.createElement("input"); n.type = "text"; if (!txt) n.inputMode = "decimal"; n.className = cls; n.value = val; n.setAttribute("aria-label", label); n.addEventListener("input", function () { on(n.value); }); return n; }
    function head(r, title, rid) { var t = document.createElement("div"); t.className = "kmt"; t.innerHTML = "<b>" + esc(title) + "</b>" + (rid === undefined ? "" : " · " + (rid ? '<span class="kmlnk">→ ' + esc(opt.recName(rid) || tt("km_new")) + "</span>" : '<span class="kmlnk">' + esc(tt("km_new")) + "</span>")); r.appendChild(t); return t; }
    function btns(r, id) {
      var bs = document.createElement("div"); bs.className = "kmbtn";
      bs.innerHTML = '<span class="kmnudge" role="group" aria-label="' + esc(tt("km_nudge")) + '">' + [["l", "←", "km_nl"], ["u", "↑", "km_nu"], ["d", "↓", "km_nd"], ["r", "→", "km_nr"]].map(function (a) { return '<button type="button" class="btn ghost small" data-n="' + id + "|" + a[0] + '" aria-label="' + esc(tt(a[2])) + '">' + a[1] + "</button>"; }).join("") + "</span>" +
        '<button type="button" class="btn ghost small" data-z="' + id + '">' + esc(tt("km_show")) + '</button><button type="button" class="btn ghost small del" data-d="' + id + '">' + esc(tt("km_del")) + "</button>";
      r.appendChild(bs);
    }
    function nudge(id, dir) {
      var f = findObj(id); if (!f) return; var st = parseFloat(String($("#kmStep").value).replace(",", ".")) || 1, k = plan ? (cal.scale ? st / cal.scale : st * 5) : st;
      var dx = dir === "l" ? -k : dir === "r" ? k : 0, dy = dir === "u" ? k : dir === "d" ? -k : 0; if (plan) dy = -dy;
      snap(); var sh = function (p) { return [Math.round((p[0] + dx) * 100) / 100, Math.round((p[1] + dy) * 100) / 100]; };
      if (f.o.pts) f.o.pts = f.o.pts.map(sh); else f.o.pt = sh(f.o.pt); refresh();
    }
    /* ---------- Rückfragen am Klickpunkt: Schacht neu / Anschluss an bestehenden / nur Deckel / Oberfläche wechselt ---------- */
    function askHide() { var a = $("#kmAsk"); if (a) { a.hidden = true; a.innerHTML = ""; } }
    function askShow(ll, title, items, focusIdx, withTyp, bl) {
      var a = $("#kmAsk"); if (!a) return; a.innerHTML = ""; a.hidden = false; a.setAttribute("aria-label", title);
      var t = document.createElement("p"); t.className = "kmask-t"; t.textContent = title; a.appendChild(t);
      if (withTyp && cat && cat.schacht) { var tl = document.createElement("label"); tl.className = "kmask-ty"; tl.textContent = tt("km_typ") + " "; tl.appendChild(sel1(tt("km_typ"), cat.schacht, lastTyp || opt.defTyp, function (v) { lastTyp = v; })); a.appendChild(tl); }
      if (bl) {   /* Belegung der Leitung direkt wählen: 1×K55, 2×K100 … (Feinabstimmung mit den Zählern in der Leitungskarte) */
        var c0 = cfgOf(bl), cur = pipeTxt(c0), PR = ["1×K55", "2×K55", "3×K55", "4×K55", "1×K100", "2×K100", "3×K100", "1×K100 + 1×K55", "2×K100 + 3×K55"], opts = [];
        if (!cur) opts.push(["", "– " + tt("km_lt_choose") + " –"]); else if (PR.indexOf(cur) < 0) opts.push([cur, cur]);
        PR.forEach(function (v) { opts.push([v, v]); });
        var bw = document.createElement("label"); bw.className = "kmask-ty"; bw.textContent = tt("km_lt_pipes") + " ";
        bw.appendChild(sel1(tt("km_lt_pipes"), opts, cur, function (v) {
          if (!v) return; snap(); var rt = {}; v.split(" + ").forEach(function (q) { var m = /^(\d+)×K(\d+)$/.exec(q); if (m) rt[m[2]] = +m[1]; }); c0.rt = rt; lineSync(bl); lastCfg = JSON.parse(JSON.stringify(c0)); draw(); costSoon(); rows();
        })); a.appendChild(bw);
      }
      items.forEach(function (it, i) {
        var b = document.createElement("button"); b.type = "button"; b.className = "btn small" + (it.ghost ? " ghost" : "") + (i === focusIdx ? " sug" : ""); b.textContent = it.t;
        if (it.sub) { var sm = document.createElement("small"); sm.textContent = " (" + it.sub + ")"; b.appendChild(sm); }
        b.addEventListener("click", function (e) { e.stopPropagation(); askHide(); it.fn(); }); a.appendChild(b);
      });
      var cp = map.latLngToContainerPoint(ll), mp = $("#kmMap"), ah = a.offsetHeight || 40 + items.length * 34, aw = a.offsetWidth || 250;   /* oberhalb des Punkts (verdeckt die weitere Zeichenrichtung nicht), sonst darunter */
      if (mp.clientWidth >= 640) { a.style.left = (cp.x < mp.clientWidth / 2 ? mp.clientWidth - aw - 8 : 8) + mp.offsetLeft + "px"; a.style.top = 8 + mp.offsetTop + "px"; }   /* in der von der Klickstelle abgewandten oberen Ecke: verdeckt weder Punkt noch Zeichenrichtung */
      else { var top = cp.y - ah - 10 >= 4 ? cp.y - ah - 10 : cp.y + 14; a.style.left = Math.max(4, Math.min(mp.clientWidth - aw - 4, cp.x - aw / 2)) + mp.offsetLeft + "px"; a.style.top = Math.max(4, Math.min(mp.clientHeight - ah - 4, top)) + mp.offsetTop + "px"; }   /* schmale Karte: am Punkt */
    }
    function nearShaft(c, maxM, onlyExisting) {
      var best = null; M.pts.forEach(function (p) { if (onlyExisting && (!p.mode || p.mode === "neu")) return; var d = AD.dist(c, p.pt); if (isFinite(d) && d <= maxM && (!best || d < best.d)) best = { p: p, d: d }; }); return best;
    }
    function newShaft(c, mode) { var p = { id: nid("p"), pt: c.slice(), sid: null, typ: lastTyp || opt.defTyp, name: "", fl: lastCfg.fl || "", mode: mode }; M.pts.push(p); sel = { id: p.id }; return p; }
    /* Schacht setzen: liegt er auf einer Linie, wird diese geteilt (beide Hälften am Schacht), am Linienende wird verknüpft; Belegung hinaus wählbar */
    function placeShaft(c, silent) {
      var p = newShaft(c, "neu"), cp = map.latLngToContainerPoint(AD.ll(c)), did = null;
      M.lines.slice().forEach(function (l) {
        if (l.pts.length < 2 || did === "x") return; var h = segHit(cp, l.pts); if (!h || h.d > 10) return;
        var n = l.pts.length, a = map.latLngToContainerPoint(AD.ll(l.pts[0])), z = map.latLngToContainerPoint(AD.ll(l.pts[n - 1]));
        if (Math.hypot(a.x - cp.x, a.y - cp.y) <= 12) { if (!l.s) { l.s = p.id; p.pt = l.pts[0].slice(); } return; }
        if (Math.hypot(z.x - cp.x, z.y - cp.y) <= 12) { if (!l.e) { l.e = p.id; p.pt = l.pts[n - 1].slice(); } return; }
        var q = h.q, vi = -1; l.pts.forEach(function (v, i) { if (i && i < n - 1) { var vp = map.latLngToContainerPoint(AD.ll(v)); if (Math.hypot(vp.x - cp.x, vp.y - cp.y) <= 12) vi = i; } });
        var idx = vi >= 0 ? vi : h.seg + 1, pos = vi >= 0 ? l.pts[vi].slice() : q.slice(); p.pt = pos;
        var l2 = { id: nid("l"), pts: [pos.slice()].concat(l.pts.slice(idx + (vi >= 0 ? 1 : 0))), rid: null, rohr: clone(l.rohr), cfg: clone(cfgOf(l)), e: l.e || null, to: l.to || null };
        l.pts = l.pts.slice(0, idx).concat([pos.slice()]);
        l.e = p.id; l.to = null; l2.s = p.id; M.lines.splice(M.lines.indexOf(l) + 1, 0, l2); did = l2;
      });
      if (did && did !== "x" && !silent) askShow(AD.ll(c), tt("km_sp_title"), [{ t: tt("km_sp_ok"), fn: function () { } }], 0, false, did);
      return p;
    }
    function askStart(l, c) {
      if (plan && !cal.scale) return; var nr = nearShaft(c, 15);
      askShow(AD.ll(c), tt("km_as_start"), [
        { t: tt("km_as_newS"), fn: function () { snap(); l.s = newShaft(c, "neu").id; refresh(); } },
        { t: tt("km_as_conn"), sub: nr ? tt("km_as_near").replace("{d}", fmt(nr.d)) : "", fn: function () { snap(); var p = nr ? nr.p : newShaft(c, "anschluss"); l.pts[0] = p.pt.slice(); l.s = p.id; refresh(); } },
        { t: tt("km_as_none"), ghost: 1, fn: function () { } }], nr ? 1 : 0, true, l);
    }
    function askEnd(l) {
      var c = l.pts[l.pts.length - 1].slice(); if (plan && !cal.scale) return; var nr = nearShaft(c, 15), ne = nearShaft(c, 15, true);
      askShow(AD.ll(c), tt("km_as_end"), [
        { t: tt("km_as_newS"), fn: function () { snap(); l.e = newShaft(c, "neu").id; refresh(); } },
        { t: tt("km_as_conn"), sub: nr ? tt("km_as_near").replace("{d}", fmt(nr.d)) : "", fn: function () { snap(); var p = nr ? nr.p : newShaft(c, "anschluss"); l.pts[l.pts.length - 1] = p.pt.slice(); l.e = p.id; refresh(); } },
        { t: tt("km_as_surf"), fn: function () { askSurface(l, c); } },
        { t: tt("km_as_cover"), fn: function () { snap(); var p = ne ? ne.p : newShaft(c, "deckel"); p.mode = "deckel"; sel = { id: p.id }; refresh(); } },
        { t: tt("km_as_none"), ghost: 1, fn: function () { } }], nr ? 1 : 0, true, l);
    }
    function askSurface(l, c) {
      var cur0 = cfgOf(l).fl;
      askShow(AD.ll(c), tt("km_as_surfAsk"), FLS.filter(function (f) { return f !== cur0; }).map(function (f) {
        return { t: tt("km_lt_fl_" + f), fn: function () {
          snap(); var l2 = { id: nid("l"), pts: [c.slice()], rid: null, rohr: JSON.parse(JSON.stringify(l.rohr)), cfg: JSON.parse(JSON.stringify(cfgOf(l))) };
          l2.cfg.fl = f; lastCfg = JSON.parse(JSON.stringify(l2.cfg)); lineSync(l2); M.lines.push(l2); cur = l2.id; sel = { id: l2.id }; mode = "line"; refresh();
          [].slice.call(dlg.querySelectorAll("[data-k^=m]")).forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.k === "mline" ? "true" : "false"); });
        } };
      }), 0);
    }
    /* ---------- Kontextmenü (Rechtsklick / langes Drücken / Menütaste): am Kartenpunkt oder Objekt ---------- */
    var ctxT = 0, propsId = null, clone = function (o) { return JSON.parse(JSON.stringify(o)); };
    function ctxHide() { var m = $("#kmCtx"); if (m && !m.hidden) { m.hidden = true; m.innerHTML = ""; } }
    function ctxShow(cp, title, sub, items) {
      var m = $("#kmCtx"); if (!m) return; m.innerHTML = ""; m.hidden = false; m.setAttribute("aria-label", title);
      var t = document.createElement("p"); t.className = "kmask-t"; t.textContent = title; m.appendChild(t); if (sub) { var sm = document.createElement("small"); sm.className = "kmctx-s"; sm.textContent = sub; m.appendChild(sm); }
      items.forEach(function (it) {
        if (it.typ) { var l = document.createElement("label"); l.className = "kmask-ty"; l.textContent = tt("km_typ") + " "; l.appendChild(sel1(tt("km_typ"), cat.schacht, lastTyp || opt.defTyp, function (v) { lastTyp = v; })); m.appendChild(l); return; }
        if (it.wlt) { var l2 = document.createElement("label"); l2.className = "kmask-ty"; l2.textContent = tt("km_wlT") + " "; l2.appendChild(sel1(tt("km_wlT"), [["ts", tt("km_wlts")], ["bo", tt("km_wlbo")], ["sg", tt("km_wlsg")], ["zs", tt("km_wlzs")]], wlT, function (v) { wlT = v; var w = $("#kmWlT"); if (w) w.value = v; })); m.appendChild(l2); return; }
        var b = document.createElement("button"); b.type = "button"; b.className = "btn small" + (it.ghost ? " ghost" : ""); b.textContent = it.t;
        b.addEventListener("click", function (e) { e.stopPropagation(); ctxHide(); it.fn(); }); m.appendChild(b);
      });
      var mp = $("#kmMap"), aw = m.offsetWidth || 260, ah = m.offsetHeight || 40 + items.length * 34;
      m.style.left = Math.max(4, Math.min(mp.clientWidth - aw - 4, cp.x + 6)) + mp.offsetLeft + "px"; m.style.top = Math.max(4, Math.min(mp.clientHeight - ah - 4, cp.y + 6)) + mp.offsetTop + "px";
      var f = m.querySelector("button"); if (f) f.focus();
    }
    function segHit(cp, pts) {   /* Linie unter dem Zeiger: nächster Abschnitt in Bildschirmpixeln, Fusspunkt als Kartenkoordinate */
      var best = null;
      for (var i = 1; i < pts.length; i++) {
        var a = map.latLngToContainerPoint(AD.ll(pts[i - 1])), b = map.latLngToContainerPoint(AD.ll(pts[i])), dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((cp.x - a.x) * dx + (cp.y - a.y) * dy) / L2)) : 0;
        var fx = a.x + t * dx, fy = a.y + t * dy, d = Math.hypot(cp.x - fx, cp.y - fy);
        if (!best || d < best.d) best = { d: d, seg: i - 1, q: AD.pt(map.containerPointToLatLng(L.point(fx, fy))) };
      }
      return best;
    }
    function hitAt(cp) {
      var best = null;
      [["pts", M.pts], ["wl", M.wl], ["geb", M.geb], ["sond", M.sond]].forEach(function (a) { a[1].forEach(function (p) { var q = map.latLngToContainerPoint(AD.ll(p.pt)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d <= 18 && (!best || d < best.d)) best = { o: p, k: a[0], d: d }; }); });
      if (best) return best;
      M.lines.forEach(function (l) { if (l.pts.length < 2) return; var h = segHit(cp, l.pts); if (h && h.d <= 10 && (!best || h.d < best.d)) best = { o: l, k: "lines", d: h.d, seg: h.seg, q: h.q }; });
      return best;
    }
    function startLineAt(c, o) {
      o = o || {}; if (mode !== "line") $("[data-k=mline]").click();
      snap(); var l = { id: nid("l"), pts: [c.slice()], rid: null, rohr: clone(o.rohr || opt.defRohr), cfg: clone(o.cfg || lastCfg) }; if (o.s) l.s = o.s; lineSync(l); M.lines.push(l); cur = l.id; sel = { id: l.id }; refresh(); return l;
    }
    function splitLine(l, h, fl) {
      var q = h.q, a = l.pts[h.seg], b = l.pts[h.seg + 1]; if (!q || (AD.dist(q, a) < 0.05 && h.seg === 0) || (AD.dist(q, b) < 0.05 && h.seg === l.pts.length - 2)) return;   /* an den Enden nichts zu teilen */
      snap(); var l2 = { id: nid("l"), pts: [q.slice()].concat(l.pts.slice(h.seg + 1)), rid: null, rohr: clone(l.rohr), cfg: clone(cfgOf(l)), e: l.e || null };
      l.pts = l.pts.slice(0, h.seg + 1).concat([q.slice()]); l.e = null; l2.cfg.fl = fl; lastCfg = clone(l2.cfg); lineSync(l2); M.lines.splice(M.lines.indexOf(l) + 1, 0, l2); sel = { id: l2.id }; refresh();
    }
    function ctxOpenAt(cp) {
      if (base === "viewer" || mode === "geo" || mode === "cal") return; askHide(); var ll = map.containerPointToLatLng(cp), c = AD.pt(ll), h = hitAt(cp), items = [], title, sub = plan ? "" : tt("km_cx_coord").replace("{e}", fmt0(c[0])).replace("{n}", fmt0(c[1]));
      if (h) {
        var o = h.o; title = h.k === "lines" ? tt("km_lineN").replace("{n}", M.lines.indexOf(o) + 1) : h.k === "pts" ? tt("km_schN").replace("{n}", M.pts.indexOf(o) + 1) : h.k === "wl" ? tt("km_wlN").replace("{n}", M.wl.indexOf(o) + 1) : h.k === "geb" ? tt("km_gebN").replace("{n}", M.geb.indexOf(o) + 1) : tt("km_sondN").replace("{n}", M.sond.indexOf(o) + 1);
        sel = { id: o.id }; refresh();
        items.push({ t: tt("km_cx_props"), fn: function () { propsOpen(o, cp); } });
        if (h.k === "lines") {
          items.push({ t: tt("km_cx_split"), fn: function () { var cur0 = cfgOf(o).fl; ctxShow(cp, tt("km_cx_splitAsk"), "", FLS.filter(function (f) { return f !== cur0; }).map(function (f) { return { t: tt("km_lt_fl_" + f), fn: function () { splitLine(o, h, f); } }; })); } });
          items.push({ t: tt("km_cx_branch"), fn: function () { startLineAt(h.q, { cfg: clone(cfgOf(o)), rohr: clone(o.rohr) }); } });
        } else if (h.k === "pts") items.push({ t: tt("km_cx_conn"), fn: function () { var l = startLineAt(o.pt, { s: o.id }); } });
        if (!plan) { var sp = h.k === "lines" ? h.q : o.pt, sh = h.k === "lines" ? svBearing(o.pts[h.seg], o.pts[h.seg + 1]) : null; items.push({ t: tt("km_sv_here"), ghost: 1, fn: function () { svOpen(sp, sh, false); } }); if (svKey()) items.push({ t: tt("km_sv_emb"), ghost: 1, fn: function () { svOpen(sp, sh, true); } }); }
      } else {
        title = tt("km_cx_title");
        items.push({ typ: 1 }, { t: tt("km_cx_sch"), fn: function () { snap(); placeShaft(c); refresh(); } }, { wlt: 1 },
          { t: tt("km_cx_wl"), fn: function () { snap(); var q = { id: nid("w"), pt: c.slice(), sid: null, wt: wlT, name: "", fl: lastCfg.fl || "" }; M.wl.push(q); sel = { id: q.id }; refresh(); } },
          { t: tt("km_cx_geb"), fn: function () { snap(); var q = { id: nid("g"), pt: c.slice(), sid: null, cm: opt.defGeb.cm, abd: opt.defGeb.abd, name: "" }; M.geb.push(q); sel = { id: q.id }; refresh(); } },
          { t: tt("km_cx_sond"), fn: function () { snap(); var q = { id: nid("s"), pt: c.slice(), name: "", l: "1.0", b: "1.0", t: "1.5" }; M.sond.push(q); sel = { id: q.id }; refresh(); } },
          { t: tt("km_cx_line"), fn: function () { var l = startLineAt(c); askStart(l, c); } },
          { t: tt("km_cx_area"), fn: function () { if (mode !== "area") $("[data-k=marea]").click(); ctxT = 0; addPt(ll); } });
        if (!plan) { items.push({ t: tt("km_sv_here"), ghost: 1, fn: function () { svOpen(c, null, false); } }); if (svKey()) items.push({ t: tt("km_sv_emb"), ghost: 1, fn: function () { svOpen(c, null, true); } }); }
      }
      ctxShow(cp, title, sub, items);
    }
    /* Google Street View: Link (ohne Schlüssel, neuer Tab) oder eingebettet (Maps-Embed-Schlüssel nur im Browser, nicht im Projekt) */
    function svBearing(a, b) { var ea = toWGS(a[0], a[1]), eb = toWGS(b[0], b[1]), dl = (eb[1] - ea[1]) * Math.PI / 180, f1 = ea[0] * Math.PI / 180, f2 = eb[0] * Math.PI / 180; return Math.round((Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)) * 180 / Math.PI + 360) % 360); }
    function svKey() { try { return localStorage.getItem("lvd-gsv-key") || ""; } catch (e) { return ""; } }
    function svUrl(c, hd, embed) {
      var w = toWGS(c[0], c[1]), ll = w[0].toFixed(6) + "," + w[1].toFixed(6);
      return embed ? "https://www.google.com/maps/embed/v1/streetview?key=" + encodeURIComponent(svKey()) + "&location=" + ll + (hd != null ? "&heading=" + hd : "")
        : "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=" + ll + (hd != null ? "&heading=" + hd : "");
    }
    function svOpen(c, hd, embed) {
      if (plan) return; if (!embed || !svKey()) { window.open(svUrl(c, hd, false), "_blank", "noopener"); return; }
      var w = $("#kmSv"); w.hidden = false; w.innerHTML = ""; var h = document.createElement("div"); h.className = "kmprops-h"; h.innerHTML = "<b>" + esc(tt("km_sv")) + "</b>"; var x = document.createElement("button"); x.type = "button"; x.className = "btn ghost small"; x.textContent = "×"; x.setAttribute("aria-label", tt("km_cx_close")); x.addEventListener("click", function () { w.hidden = true; w.innerHTML = ""; }); h.appendChild(x); w.appendChild(h);
      var f = document.createElement("iframe"); f.title = tt("km_sv"); f.width = "100%"; f.height = "240"; f.style.border = "0"; f.setAttribute("allowfullscreen", ""); f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin"); f.src = svUrl(c, hd, true); w.appendChild(f);
      w.setAttribute("aria-label", tt("km_sv")); w.style.right = "8px"; w.style.top = "8px"; w.style.left = "auto";
    }
    function propsOpen(o, cp) {
      var w = $("#kmProps"); if (!w) return; propsId = o.id; w.hidden = false; propsRender();
      var mp = $("#kmMap"); w.style.left = Math.max(4, Math.min(mp.clientWidth - 330, cp.x + 10)) + mp.offsetLeft + "px"; w.style.top = Math.max(4, Math.min(mp.clientHeight - 240, cp.y + 10)) + mp.offsetTop + "px";
    }
    function propsRender() {
      var w = $("#kmProps"); if (!w || !propsId) return; var f = findObj(propsId), r = f && rowFn ? rowFn(f.o) : null;
      if (!r) { propsClose(); return; }
      w.innerHTML = ""; var hd = document.createElement("div"); hd.className = "kmprops-h"; hd.innerHTML = "<b>" + esc(tt("km_cx_props")) + "</b>"; var x = document.createElement("button"); x.type = "button"; x.className = "btn ghost small"; x.textContent = "×"; x.setAttribute("aria-label", tt("km_cx_close")); x.addEventListener("click", propsClose); hd.appendChild(x);
      w.setAttribute("aria-label", tt("km_cx_props")); w.appendChild(hd); w.appendChild(r);
    }
    function propsRefresh() { var w = $("#kmProps"); if (w && !w.hidden && propsId) { var a = document.activeElement; if (!(a && w.contains(a) && /INPUT|TEXTAREA/.test(a.tagName))) propsRender(); } }
    function propsClose() { var w = $("#kmProps"); propsId = null; if (w) { w.hidden = true; w.innerHTML = ""; } }
    var fmt0 = function (v) { return Math.round(v).toLocaleString("de-CH"); };
    (function () {
      var mp = $("#kmMap"), tm = null, p0 = null;
      mp.addEventListener("contextmenu", function (e) { e.preventDefault(); if (Date.now() - ctxT < 300) return; ctxT = Date.now(); ctxOpenAt(map.mouseEventToContainerPoint(e)); });
      mp.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") return; p0 = { x: e.clientX, y: e.clientY }; clearTimeout(tm); tm = setTimeout(function () { ctxT = Date.now(); ctxOpenAt(map.mouseEventToContainerPoint(e)); }, 650); });
      ["pointermove", "pointerup", "pointercancel"].forEach(function (n) { mp.addEventListener(n, function (e) { if (n === "pointermove" && p0 && Math.hypot(e.clientX - p0.x, e.clientY - p0.y) < 10) return; clearTimeout(tm); }); });
      dlg.addEventListener("pointerdown", function (e) { var m = $("#kmCtx"); if (m && !m.hidden && !m.contains(e.target)) ctxHide(); });
      dlg.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !$("#kmCtx").hidden) { e.preventDefault(); e.stopPropagation(); ctxHide(); mp.focus(); return; }
        if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && e.target === mp) { e.preventDefault(); ctxT = Date.now(); var sz = map.getSize(); ctxOpenAt(L.point(sz.x / 2, sz.y / 2)); }
      });
    })();
    function flOpts() { return [["", "– " + tt("km_lt_choose") + " –"]].concat(FLS.map(function (a) { return [a, tt("km_lt_fl_" + a)]; })); }
    function lineEd(l, host, quick) {
      var c = cfgOf(l), art = ARTS.map(function (a) { return [a, tt("km_lt_art_" + a)]; }), fl = [["", "– " + tt("km_lt_choose") + " –"]].concat(FLS.map(function (a) { return [a, tt("km_lt_fl_" + a)]; }));
      host.innerHTML = "";
      var chips = document.createElement("div"); chips.className = "kmpipes"; chips.setAttribute("role", "group"); chips.setAttribute("aria-label", tt("km_lt_pipes"));
      var sum = document.createElement("p"); sum.className = "kmsum"; sum.setAttribute("role", "status");
      var xs = document.createElement("div"); xs.className = "kmxs";
      function paint() {
        abc.hidden = c.fl !== "pflaster";
        PIPES.forEach(function (p) { var n = c.rt[p[0]] || 0, w = chips.querySelector('[data-t="' + p[0] + '"]'); w.querySelector("b").textContent = n; w.classList.toggle("on", n > 0); });
        var miss = cfgMissing(c).map(function (k) { return tt(k === "rt" ? "km_lt_pipes" : "km_lt_fl"); }), len = lineLen(l.pts);
        sum.className = "kmsum" + (miss.length ? " warn" : ""); sum.textContent = (lineTxt(l, tt) || "–") + " · " + fmt(len) + " m" + (miss.length ? " · " + tt("km_lt_miss").replace("{x}", miss.join(", ")) : "") + (parseFloat(c.T || "0.6") > 1.0 && !c.gesp ? " · " + tt("km_lt_gespHint") : "");
        xs.innerHTML = !quick && pipeList(c).length && opt.xsec ? '<p class="kmxst">' + esc(tt("km_lt_xsec")) + "</p>" + opt.xsec(l, len) : "";
      }
      function changed() { snap(); lineSync(l); lastCfg = JSON.parse(JSON.stringify(c)); draw(); costSoon(); paint(); if (quick) rows(); var q = $("#kmQuick"); if (q && !q.hidden && q.dataset.lid === l.id) { var ok = $("#kmQuickOk"); if (ok) ok.disabled = cfgMissing(c).length > 0; } }
      PIPES.forEach(function (p) {
        var w = document.createElement("span"); w.className = "kmpipe"; w.setAttribute("data-t", p[0]);
        var m = document.createElement("button"), pl = document.createElement("button"), t = document.createElement("span"), b = document.createElement("b");
        m.type = pl.type = "button"; m.className = pl.className = "btn ghost small"; m.textContent = "−"; pl.textContent = "+"; t.textContent = p[1];
        m.setAttribute("aria-label", tt("km_lt_less").replace("{t}", p[1])); pl.setAttribute("aria-label", tt("km_lt_more").replace("{t}", p[1]));
        m.addEventListener("click", function () { c.rt[p[0]] = Math.max(0, (c.rt[p[0]] || 0) - 1); if (!c.rt[p[0]]) delete c.rt[p[0]]; changed(); });
        pl.addEventListener("click", function () { c.rt[p[0]] = Math.min(24, (c.rt[p[0]] || 0) + 1); changed(); });
        w.appendChild(t); w.appendChild(m); w.appendChild(b); w.appendChild(pl); chips.appendChild(w);
      });
      host.appendChild(chips);
      var g = document.createElement("div"); g.className = "kmlg";
      g.appendChild(cell(tt("km_lt_art"), sel1(tt("km_lt_art"), art, c.art, function (v) { c.art = v; changed(); })));
      g.appendChild(cell(tt("km_lt_fl"), sel1(tt("km_lt_fl"), fl, c.fl, function (v) { c.fl = v; changed(); })));
      g.appendChild(cell(tt("km_lt_T"), inp(tt("km_lt_T"), c.T, "kmn", function (v) { c.T = v.replace(",", ".").trim(); changed(); })));
      g.appendChild(cell(tt("km_lt_B"), inp(tt("km_lt_B"), c.B, "kmn", function (v) { c.B = v.replace(",", ".").trim(); changed(); })));
      var abc = cell(tt("km_lt_ab"), sel1(tt("km_lt_ab"), [["betonstein", tt("km_ab_betonstein")], ["platten", tt("km_ab_platten")], ["natur", tt("km_ab_natur")], ["", tt("km_ab_none")]], c.ab, function (v) { c.ab = v; changed(); }));
      g.appendChild(abc); host.appendChild(g);
      var dt = document.createElement("details"); dt.className = "kmmore"; dt.open = !!(c.gesp || c.kr || c.b90 || c.b45);
      var dsum = document.createElement("summary"); dsum.textContent = tt("km_lt_more2"); dt.appendChild(dsum);
      var dg = document.createElement("div"); dg.className = "kmlg";
      dg.appendChild(cell(tt("km_lt_gesp"), sel1(tt("km_lt_gesp"), [["0", tt("km_no")], ["1", tt("km_yes")]], c.gesp ? "1" : "0", function (v) { c.gesp = v === "1"; changed(); })));
      [["kr", "km_lt_kr"], ["b90", "km_lt_b90"], ["b45", "km_lt_b45"]].forEach(function (f) { dg.appendChild(cell(tt(f[1]), inp(tt(f[1]), c[f[0]], "kmn", function (v) { c[f[0]] = v.replace(/[^0-9]/g, ""); changed(); }))); });
      dt.appendChild(dg); host.appendChild(dt); host.appendChild(sum); host.appendChild(xs); paint();
    }
    function quickOpen(l) {
      var q = $("#kmQuick"); if (!q || cfgMissing(cfgOf(l)).length === 0) return;
      q.hidden = false; q.dataset.lid = l.id; q.innerHTML = '<p class="kmqt"><b>' + esc(tt("km_lt_title")) + "</b> · " + esc(tt("km_lt_askHint")) + "</p>";
      var ed = document.createElement("div"); ed.className = "kmled"; q.appendChild(ed); lineEd(l, ed, true); q.scrollIntoView({ block: "nearest" });
      var bar = document.createElement("div"); bar.className = "kmbar";
      bar.innerHTML = '<button type="button" class="btn small" id="kmQuickOk">' + esc(tt("km_lt_ok")) + '</button><button type="button" class="btn ghost small" id="kmQuickLater">' + esc(tt("km_lt_later")) + "</button>";
      q.appendChild(bar); var ok = $("#kmQuickOk"); ok.disabled = cfgMissing(cfgOf(l)).length > 0;
      ok.addEventListener("click", function () { q.hidden = true; q.innerHTML = ""; rows(); });
      $("#kmQuickLater").addEventListener("click", function () { q.hidden = true; q.innerHTML = ""; });
    }
    var rowFn = null;
    function rows() {
      var h = $("#kmObj"); h.innerHTML = "";
      var rowOf = function (o) { var r = document.createElement("div"); r.className = "kmrow" + (sel && sel.id === o.id ? " on" : ""); r.setAttribute("data-rid", o.id); return r; };
      var row_lines = function (l, i) {
        var r = rowOf(l);
        var t = head(r, tt("km_lineN").replace("{n}", i + 1), l.rid); t.insertAdjacentHTML("beforeend", " · " + fmt(effLen(l.pts)) + " m" + (SLOPE && hzOf(l) ? " " + esc(tt("hz_sfx")) : ""));
        var ed = document.createElement("div"); ed.className = "kmled"; r.appendChild(ed); lineEd(l, ed, false);
        btns(r, l.id); return r;
      };
      M.lines.forEach(function (l, i) { h.appendChild(row_lines(l, i)); });
      var row_pts = function (p, i) {
        var r = rowOf(p); head(r, tt("km_schN").replace("{n}", i + 1), p.sid);
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; }, 1)));
        r.appendChild(cell(tt("km_typ"), sel1(tt("km_typ"), cat.schacht, p.typ, function (v) { p.typ = v; lastTyp = v; rcRender(); })));
        if (p.mode !== "deckel") { r.appendChild(cell(tt("km_mu"), inp(tt("km_mu"), p.mu || "", "kmn", function (v) { p.mu = v; rcRender(); }))); var mn = parseInt(p.mu, 10); if (mn > 0) { var mh = document.createElement("p"); mh.className = "hint"; mh.textContent = tt("km_mu_hint").replace("{t}", typFor(mn)); r.appendChild(mh); } }
        r.appendChild(cell(tt("km_lt_fl"), sel1(tt("km_lt_fl"), flOpts(), p.fl || "", function (v) { p.fl = v; })));
        r.appendChild(cell(tt("km_pm_lbl"), sel1(tt("km_pm_lbl"), [["neu", tt("km_pm_neu")], ["anschluss", tt("km_pm_ans")], ["deckel", tt("km_pm_dk")]], p.mode || "neu", function (v) { p.mode = v; draw(); rows(); })));
        if (p.mode === "deckel") {
          r.appendChild(cell(tt("km_pm_dr"), sel1(tt("km_pm_dr"), [["hoeher", tt("km_pm_hoeher")], ["tiefer", tt("km_pm_tiefer")]], p.dr || "hoeher", function (v) { p.dr = v; })));
          r.appendChild(cell(tt("km_pm_rund") + "/" + tt("km_pm_rect"), sel1(tt("km_pm_rund") + "/" + tt("km_pm_rect"), [["rund", tt("km_pm_rund")], ["rechteckig", tt("km_pm_rect")]], p.df || "rund", function (v) { p.df = v; })));
        }
        if (p.mode !== "deckel") { var cn = connOf(M, p), hn = document.createElement("p"); hn.className = "hint kmconn"; hn.textContent = cn.n ? tt("km_cn_txt").replace("{i}", connTxt(cn.inn)).replace("{o}", connTxt(cn.out)) + " " + tt("km_cn_dn").replace("{a}", cn.a80).replace("{b}", cn.a150) : tt("km_cn_none"); r.appendChild(hn); }
        btns(r, p.id); return r;
      };
      M.pts.forEach(function (p, i) { h.appendChild(row_pts(p, i)); });
      var row_sond = function (p, i) {
        var r = rowOf(p); head(r, tt("km_sondN").replace("{n}", i + 1));
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; }, 1)));
        [["l", "km_sL"], ["b", "km_sB"], ["t", "km_sT"]].forEach(function (f) { r.appendChild(cell(tt(f[1]), inp(tt(f[1]), p[f[0]], "kmn", function (v) { p[f[0]] = v; }))); });
        btns(r, p.id); return r;
      };
      M.sond.forEach(function (p, i) { h.appendChild(row_sond(p, i)); });
      var row_wl = function (p, i) {
        var r = rowOf(p); head(r, tt("km_wlN").replace("{n}", i + 1), p.sid);
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; }, 1)));
        r.appendChild(cell(tt("km_wlT"), sel1(tt("km_wlT"), [["ts", tt("km_wlts")], ["bo", tt("km_wlbo")], ["sg", tt("km_wlsg")], ["zs", tt("km_wlzs")]], p.wt, function (v) { p.wt = v; })));
        r.appendChild(cell(tt("km_lt_fl"), sel1(tt("km_lt_fl"), flOpts(), p.fl || "", function (v) { p.fl = v; })));
        btns(r, p.id); return r;
      };
      M.wl.forEach(function (p, i) { h.appendChild(row_wl(p, i)); });
      var row_geb = function (p, i) {
        var r = rowOf(p); head(r, tt("km_gebN").replace("{n}", i + 1), p.sid);
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; }, 1)));
        r.appendChild(cell(tt("km_cm"), inp(tt("km_cm"), p.cm || "", "kmn", function (v) { p.cm = v; })));
        r.appendChild(cell(tt("km_abd"), sel1(tt("km_abd"), [["keine", tt("km_abdK")], ["kissen", tt("km_abdKi")], ["hauff", tt("km_abdH")]], p.abd, function (v) { p.abd = v; })));
        r.appendChild(cell(tt("km_gt"), sel1(tt("km_gt"), [["", "–"], ["efh", tt("gt_efh")], ["mfh", tt("gt_mfh")], ["bue", tt("gt_bue")]], p.gt || "", function (v) { p.gt = v; rows(); })));
        if (p.gt) { var gh = document.createElement("p"); gh.className = "hint"; gh.textContent = tt("gt_hint_" + p.gt); r.appendChild(gh); }
        if (!String(p.cm || "").trim()) { var hn = document.createElement("p"); hn.className = "hint"; hn.textContent = tt("km_gebHint"); r.appendChild(hn); }
        btns(r, p.id); return r;
      };
      M.geb.forEach(function (p, i) { h.appendChild(row_geb(p, i)); });
      var row_areas = function (f, i) {
        var r = rowOf(f), t = head(r, tt("km_areaN").replace("{n}", i + 1), f.rid); t.insertAdjacentHTML("beforeend", " · " + fmt(area(f.pts)) + " m² · " + tt("km_perim") + " " + fmt(perim(f.pts)) + " m");
        r.appendChild(cell(tt("km_lt_fl"), sel1(tt("km_lt_fl"), [["", tt("km_lt_fl_belag")], ["pflaster", tt("km_lt_fl_pflaster")], ["wiese", tt("km_lt_fl_wiese")]], f.fl || "", function (v) { f.fl = v; rows(); })));
        if (f.fl === "pflaster") r.appendChild(cell(tt("km_lt_ab"), sel1(tt("km_lt_ab"), [["betonstein", tt("km_ab_betonstein")], ["platten", tt("km_ab_platten")], ["natur", tt("km_ab_natur")], ["", tt("km_ab_none")]], f.ab == null ? "betonstein" : f.ab, function (v) { f.ab = v; })));
        if (!f.fl) r.appendChild(cell(tt("km_bk"), sel1(tt("km_bk"), [["gehweg", tt("km_bkG")], ["strasse", tt("km_bkS")], ["kanton", tt("km_bkK")]], f.belag.bk, function (v) { f.belag.bk = v; if (["strasse", "kanton"].indexOf(v) < 0 && ["A", "A1", "B"].indexOf(f.belag.wi) < 0) f.belag.wi = "B"; rows(); })));
        if (!f.fl) r.appendChild(cell(tt("km_wi"), sel1(tt("km_wi"), (f.belag.bk === "gehweg" ? ["A", "A1", "B"] : ["A", "A1", "B", "C", "C1", "C2"]).map(function (v) { return [v, v]; }), f.belag.wi, function (v) { f.belag.wi = v; })));
        if (!f.fl) r.appendChild(cell(tt("km_dB"), inp(tt("km_dB"), f.belag.d, "kmn", function (v) { f.belag.d = v; })));
        btns(r, f.id); return r;
      };
      M.areas.forEach(function (f, i) { h.appendChild(row_areas(f, i)); });
      var row_notes = function (n, i) {
        var r = rowOf(n); head(r, tt(NT[n.type]) + " " + (i + 1));
        if (n.type === "text") {
          r.appendChild(cell(tt("km_text"), inp(tt("km_text"), n.text || "", "kmw", function (v) { n.text = v; if (layers[n.id]) draw(); }, 1)));
          r.appendChild(cell(tt("km_size"), sel1(tt("km_size"), [["s", tt("km_sS")], ["m", tt("km_sM")], ["l", tt("km_sLg")]], n.size || "m", function (v) { n.size = v; draw(); })));
        }
        r.appendChild(cell(tt("km_col"), sel1(tt("km_col"), COL.map(function (c) { return [c[0], tt(c[1])]; }), n.color || "#0d47c8", function (v) { n.color = v; draw(); })));
        btns(r, n.id); return r;
      };
      M.notes.forEach(function (n, i) { h.appendChild(row_notes(n, i)); });
      rowFn = function (o) { var i; if ((i = M.lines.indexOf(o)) >= 0) return row_lines(o, i); if ((i = M.pts.indexOf(o)) >= 0) return row_pts(o, i); if ((i = M.sond.indexOf(o)) >= 0) return row_sond(o, i); if ((i = M.wl.indexOf(o)) >= 0) return row_wl(o, i); if ((i = M.geb.indexOf(o)) >= 0) return row_geb(o, i); if ((i = M.areas.indexOf(o)) >= 0) return row_areas(o, i); if ((i = M.notes.indexOf(o)) >= 0) return row_notes(o, i); return null; };
      if (!h.children.length) { var em = document.createElement("p"); em.className = "hint"; em.textContent = tt("ws_emptyObj"); h.appendChild(em); }
      foldRows(h); missList(); propsRefresh();
    }
    /* Einklappen je Objekt: Kopf mit Schalter, Kurzinfo im eingeklappten Zustand; neu gewähltes Objekt klappt auf */
    function foldRows(h) {
      if (sel && sel.id !== lastSel) delete folded[sel.id]; lastSel = sel ? sel.id : null;
      [].slice.call(h.querySelectorAll(".kmrow")).forEach(function (r) {
        var id = r.getAttribute("data-rid"), t = r.querySelector(".kmt"); if (!t) return;
        var body = document.createElement("div"); body.className = "kmbody"; body.id = "kmb" + id;
        while (t.nextSibling) body.appendChild(t.nextSibling); r.appendChild(body);
        var f = findObj(id), sm = "";
        if (f && f.o.pts && f.arr === M.lines) sm = lineTxt(f.o, tt) || "";
        else if (f && f.o.typ) sm = f.o.typ; else if (f && f.o.wt) sm = tt("km_wl" + f.o.wt);
        var b = document.createElement("button"); b.type = "button"; b.className = "kmfold"; b.setAttribute("aria-controls", body.id);
        var sp = document.createElement("span"); sp.className = "kmsm"; sp.textContent = sm ? " · " + sm : "";
        function paint() { var c = !!folded[id]; r.classList.toggle("kmclosed", c); body.hidden = c; b.setAttribute("aria-expanded", c ? "false" : "true"); b.textContent = c ? "▸" : "▾"; b.setAttribute("aria-label", tt(c ? "km_unfold" : "km_fold") + ": " + (t.textContent || "")); sp.hidden = !c; }
        b.addEventListener("click", function (e) { e.stopPropagation(); folded[id] = !folded[id]; paint(); });
        t.insertBefore(b, t.firstChild); t.appendChild(sp); paint();
      });
      var fb = $("#kmFoldAll"); if (fb) { var n = h.querySelectorAll(".kmrow").length; fb.hidden = n < 2; var all = n > 0 && h.querySelectorAll(".kmrow.kmclosed").length === n; fb.textContent = tt(all ? "km_unfoldAll" : "km_foldAll"); fb.dataset.all = all ? "1" : "0"; }
    }
    /* Sammelblatt «Fehlt noch» */
    function missList() {
      var d = $("#kmMiss"); if (!d) return; var items = [];
      M.lines.forEach(function (l, i) { var m = cfgMissing(cfgOf(l)); if (l.pts.length > 1 && m.length) items.push([l.id, tt("km_lineN").replace("{n}", i + 1) + ": " + tt("km_lt_miss").replace("{x}", m.map(function (k) { return tt(k === "rt" ? "km_lt_pipes" : "km_lt_fl"); }).join(", "))]); });
      M.pts.forEach(function (p, i) { if (!p.typ) items.push([p.id, tt("km_schN").replace("{n}", i + 1) + ": " + tt("km_lt_miss").replace("{x}", tt("km_typ"))]); });
      M.geb.forEach(function (p, i) { if (!String(p.cm || "").trim()) items.push([p.id, tt("km_gebN").replace("{n}", i + 1) + ": " + tt("km_lt_miss").replace("{x}", tt("km_cm"))]); });
      d.hidden = !items.length; d.querySelector("summary").textContent = tt("km_miss").replace("{n}", items.length);
      var ul = d.querySelector("ul"); ul.innerHTML = ""; items.forEach(function (it) { var li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.className = "btn ghost small"; b.setAttribute("data-z", it[0]); b.textContent = it[1]; li.appendChild(b); ul.appendChild(li); });
    }


    /* ---------- Gelände: Höhenprofil (swisstopo swissALTI3D) ⇒ Schräglänge und Gefälle; Kosten nur auf Wunsch mit Schräglänge ---------- */
    var SLOPE = false, GR = 20, hzBusy = false, hzErr = ""; try { SLOPE = localStorage.getItem("lvd-km-slope") === "1"; } catch (e) { }
    var sigOf = function (pts) { return JSON.stringify(pts); };
    function hzOf(l) { return l.hz && l.hz.sig === sigOf(l.pts) ? l.hz : null; }
    function effLen(pts) { var b0 = lineLen(pts); if (!SLOPE) return b0; var sg = sigOf(pts), h = null; M.lines.forEach(function (l) { if (!h && l.hz && l.hz.sig === sg) h = l.hz; }); return h ? h.S : b0; }
    function hzCalc(l, arr) {
      var P = arr.filter(function (q) { var a = q.alts || {}; return q.dist != null && (a.COMB != null || a.DTM2 != null || a.DTM25 != null); }).map(function (q) { var a = q.alts; return { d: q.dist, h: a.COMB != null ? a.COMB : a.DTM2 != null ? a.DTM2 : a.DTM25 }; });
      if (P.length < 2) return null; var L0 = lineLen(l.pts), S = 0, up = 0, mx = 0, i0 = 0;
      for (var i = 1; i < P.length; i++) { var dd = P[i].d - P[i - 1].d, dh = P[i].h - P[i - 1].h; S += Math.hypot(dd, dh); up += Math.abs(dh); }
      var dl = P[P.length - 1].d - P[0].d; if (dl > 0) { S = S * L0 / dl; up = up * L0 / dl; }
      for (var j = 1; j < P.length; j++) { if (P[j].d - P[i0].d >= 20) { mx = Math.max(mx, Math.abs(P[j].h - P[i0].h) / (P[j].d - P[i0].d)); i0 = j; } }
      if (!mx && dl > 0) mx = Math.abs(P[P.length - 1].h - P[0].h) / dl;
      return { sig: sigOf(l.pts), L: L0, S: S, avg: L0 > 0 ? up / L0 * 100 : 0, max: mx * 100, h0: P[0].h, h1: P[P.length - 1].h };
    }
    function hzLoad() {
      if (plan || hzBusy) return; var todo = M.lines.filter(function (l) { return l.pts.length > 1 && !hzOf(l); }); hzErr = ""; if (!todo.length) { hzRender(); return; } hzBusy = true; hzRender();
      var next = function (i) {
        if (i >= todo.length) { hzBusy = false; hzRender(); rcRender(); refresh(); return; } var l = todo[i], nb = Math.max(2, Math.min(500, Math.ceil(lineLen(l.pts) / 10) + 1));
        fetch("https://api3.geo.admin.ch/rest/services/profile.json?sr=2056&distinct_points=true&nb_points=" + nb + "&geom=" + encodeURIComponent(JSON.stringify({ type: "LineString", coordinates: l.pts })), { mode: "cors" })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { var h = hzCalc(l, j); if (!h) throw 0; l.hz = h; next(i + 1); }).catch(function () { hzErr = tt("hz_err"); hzBusy = false; hzRender(); });
      }; next(0);
    }
    function hzRender() {
      var h = $("#kmHz"); if (!h) return; var fo = document.activeElement && h.contains(document.activeElement) ? document.activeElement.getAttribute("data-hz") : null, ls = M.lines.filter(function (l) { return l.pts.length > 1; }), ok = ls.filter(function (l) { return hzOf(l); }), stale = ls.some(function (l) { return l.hz && !hzOf(l); });
      var tl = 0, ts = 0, f = function (v) { return (Math.round(v * 10) / 10).toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
      ok.forEach(function (l) { tl += l.hz.L; ts += l.hz.S; });
      h.innerHTML = "<h4>" + esc(tt("hz_h")) + "</h4>" + '<p class="hint">' + esc(tt("hz_hint")) + '</p><div class="kmbar"><button type="button" class="btn small" data-hz="load"' + (hzBusy || !ls.length ? " disabled" : "") + ">" + esc(tt(hzBusy ? "hz_loading" : "hz_load")) + "</button></div>" +
        (hzErr ? '<p class="hint reqmsg" role="alert">' + esc(hzErr) + "</p>" : "") + (stale ? '<p class="hint">' + esc(tt("hz_stale")) + "</p>" : "") +
        (ok.length ? '<table><tbody>' + ok.map(function (l) { var x = l.hz; return "<tr><td>" + esc(tt("km_lineN").replace("{n}", M.lines.indexOf(l) + 1)) + '</td><td class="num">' + esc(tt("hz_row").replace("{l}", f(x.L)).replace("{s}", f(x.S)).replace("{a}", Math.round(x.avg)).replace("{m}", Math.round(x.max))) + "</td></tr>"; }).join("") + "</tbody></table>" +
          '<p class="hint" role="status">' + esc(tt("hz_tot").replace("{l}", f(tl)).replace("{s}", f(ts)).replace("{p}", f(tl ? (ts / tl - 1) * 100 : 0))) + "</p>" +
          '<label class="kmhzm"><input type="checkbox" data-hz="mode"' + (SLOPE ? " checked" : "") + "> " + esc(tt("hz_mode")) + "</label>" : "");
      if (fo) { var again = h.querySelector('[data-hz="' + fo + '"]'); if (again) again.focus(); }
    }
    /* ---------- Prüfung und Vorschläge nach «Handbuch unter- und oberirdischer Netzbau» V1.2 (2.2.2 Schachtabstände, 2.2.4 Gebäudeanschlüsse, 2.3.3 Schachttypen, 3 Einmass) ---------- */
    var RICHT = { basisCu: [250, 500], basisGfk: [1000, 6000], fkrk: [1000, 6000], detail: [200, 200] };   /* obere Richtwerte in Bauzone / ausserhalb (m) */
    var CAPA = { KS80U: 1, KS80H: 1, KES100: 1, KES150: 3, KES175: 4, ES300: 99 };                          /* max. Muffen je Schachttyp */
    var RC = { ersch: "basisCu", zone: "in", x: "" }; try { var rc0 = JSON.parse(localStorage.getItem("lvd-km-rc") || "null"); if (rc0 && typeof rc0 === "object") RC = Object.assign(RC, rc0); } catch (e) { }
    var sugs = [], sugLayer = null, sugInit = 0;
    function typFor(mu) { return mu <= 1 ? "KES100" : mu <= 3 ? "KES150" : mu === 4 ? "KES175" : "ES300"; }
    function richt() { var r = RICHT[RC.ersch] || RICHT.basisCu; return RC.zone === "aus" ? r[1] : r[0]; }
    function xAbst() { var v = parseFloat(String(RC.x).replace(",", ".")); return v > 0 ? v : richt(); }
    function bendOf(l, i) {   /* Ablenkwinkel (°) und erreichbarer Radius (m) am Knoten i: Tangentenlänge höchstens halbe Nachbarstrecke */
      var P = l.pts, a = AD.dist(P[i - 1], P[i]), b = AD.dist(P[i], P[i + 1]), u = unitV(P[i - 1], P[i]), v = unitV(P[i], P[i + 1]); if (!u || !v || !a || !b) return null;
      var th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))); if (th < 0.0175) return null;
      return { deg: th * 180 / Math.PI, r: (Math.min(a, b) / 2) / Math.tan(th / 2) };
    }
    function atDist(P, d) {   /* Punkt in Abstand d (m) vom Linienanfang */
      var acc = 0; for (var i = 1; i < P.length; i++) { var sl = AD.dist(P[i - 1], P[i]); if (acc + sl >= d - 1e-9 && sl > 0) { var t = (d - acc) / sl; return [P[i - 1][0] + t * (P[i][0] - P[i - 1][0]), P[i - 1][1] + t * (P[i][1] - P[i - 1][1])]; } acc += sl; }
      return P[P.length - 1].slice();
    }
    function rcCheck() {
      var it = [], f1 = function (v) { return (Math.round(v * 10) / 10).toLocaleString("de-CH"); }, R = richt();
      M.lines.forEach(function (l, i) {
        if (l.pts.length < 2) return; var n = i + 1, c = cfgOf(l), pl = pipeList(c), L0 = lineLen(l.pts); if (!pl.length && l.rohr && parseInt(l.rohr.dn, 10)) pl = [[parseInt(l.rohr.dn, 10), 1]];
        if (!l.s && !l.from) it.push([l.id, "y", tt("rc_t_s").replace("{n}", n)]);
        if (!l.e && !l.to) it.push([l.id, "y", tt("rc_t_e").replace("{n}", n)]);
        var hz = hzOf(l); if (hz && hz.max > GR) it.push([l.id, "y", tt("rc_steil").replace("{n}", n).replace("{m}", Math.round(hz.max)).replace("{g}", GR)]);
        if (L0 > R) it.push([l.id, "y", tt("rc_dist").replace("{n}", n).replace("{l}", f1(L0)).replace("{r}", R)]);
        if (pl.length) { var rmin = pl.some(function (e) { return e[0] >= 100; }) ? 3 : 1, dn = rmin === 3 ? "100" : "55"; for (var k = 1; k < l.pts.length - 1; k++) { var b = bendOf(l, k); if (b && b.r < rmin) it.push([l.id, "r", tt("rc_bend").replace("{n}", n).replace("{k}", k).replace("{r}", f1(b.r)).replace("{m}", rmin).replace("{dn}", dn)]); } }
      });
      var ends = []; M.lines.forEach(function (l) { if (l.pts.length > 1) { ends.push([l, l.pts[0], l.s]); ends.push([l, l.pts[l.pts.length - 1], l.e]); } });
      for (var a = 0; a < ends.length; a++) for (var b2 = a + 1; b2 < ends.length; b2++) { var A = ends[a], B = ends[b2]; if (A[0] === B[0]) continue; var d = AD.dist(A[1], B[1]); if (d > 0.001 && d <= 0.5 && !(A[2] && A[2] === B[2])) it.push([A[0].id, "y", tt("rc_t_gap").replace("{a}", M.lines.indexOf(A[0]) + 1).replace("{b}", M.lines.indexOf(B[0]) + 1).replace("{d}", f1(d * 100) + " cm")]); }
      M.pts.forEach(function (p, i) {
        for (var j = i + 1; j < M.pts.length; j++) { var d2 = AD.dist(p.pt, M.pts[j].pt); if (d2 <= 0.5) it.push([p.id, "y", tt("rc_t_dbl").replace("{a}", i + 1).replace("{b}", j + 1).replace("{d}", f1(d2 * 100) + " cm")]); }
        if (p.mode === "deckel") return; var cn = connOf(M, p), mu = parseInt(p.mu, 10), t = p.typ || "", n = i + 1;
        if (mu > 0 && CAPA[t] != null && CAPA[t] < mu) it.push([p.id, "r", tt("rc_typ").replace("{n}", n).replace("{t}", t).replace("{m}", mu).replace("{v}", typFor(mu))]);
        if (!(mu > 0) && cn.n > 2 && /^KS/.test(t)) it.push([p.id, "y", tt("rc_nomu").replace("{n}", n)]);
        if (/^KS/.test(t)) {
          if (Object.keys(cn.inn).concat(Object.keys(cn.out)).some(function (k) { return +k >= 100; })) it.push([p.id, "r", tt("rc_ks100").replace("{n}", n)]);
          var ins = [], outs = []; M.lines.forEach(function (l) { var m = l.pts.length; if (m < 2) return; if (l.e === p.id) ins.push(unitV(l.pts[m - 2], l.pts[m - 1])); if (l.s === p.id) outs.push(unitV(l.pts[0], l.pts[1])); });
          var worst = 0; ins.forEach(function (u) { outs.forEach(function (v) { if (u && v) worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) * 180 / Math.PI); }); });
          if (worst > 15) it.push([p.id, "y", tt("rc_ksgerade").replace("{n}", n).replace("{a}", Math.round(worst))]);
        }
      });
      M.geb.forEach(function (g, i) {
        var dm = Infinity; M.pts.forEach(function (p) { dm = Math.min(dm, AD.dist(p.pt, g.pt)); });
        if (!M.pts.length) it.push([g.id, "y", tt("rc_geb_none").replace("{n}", i + 1)]); else if (dm > 250) it.push([g.id, "y", tt("rc_geb_far").replace("{n}", i + 1).replace("{d}", f1(dm))]);
      });
      return it;
    }
    function rcRender() {
      var h = $("#kmChk"); if (!h) return; var it = rcCheck(), ic = { r: "⛔ ", y: "⚠ " };
      h.innerHTML = "<h4>" + esc(tt("rc_h").replace("{n}", it.length)) + "</h4>" + (it.length ? "<ul class=\"kmmissl\">" + it.map(function (x) { return "<li><button type=\"button\" class=\"btn ghost small kmrc " + x[1] + "\" data-z=\"" + x[0] + "\">" + ic[x[1]] + esc(x[2]) + "</button></li>"; }).join("") + "</ul>" : '<p class="none">' + esc(tt("rc_ok")) + "</p>") + '<p class="hint">' + esc(tt("rc_src")) + "</p>";
    }
    /* Vorschläge: Schächte an Knicken und im Richtabstand, Werklöcher an Abzweigen */
    function sugCompute() {
      var X = xAbst(), out = [], near = function (arr, pt, rad) { return arr.some(function (p) { return AD.dist(p.pt || p.c, pt) <= rad; }); };
      M.lines.forEach(function (l) {
        if (l.pts.length < 2) return; var L0 = lineLen(l.pts), cuts = [0], acc = 0, kn = [];
        for (var i = 1; i < l.pts.length - 1; i++) { acc += AD.dist(l.pts[i - 1], l.pts[i]); var b = bendOf(l, i); if (b && b.deg >= 30 && !near(M.pts, l.pts[i], 3)) { kn.push({ k: "sch", c: l.pts[i].slice(), why: "sg_w_knick" }); cuts.push(acc); } }
        cuts.push(L0); out = out.concat(kn);
        for (var q = 1; q < cuts.length; q++) { var g = cuts[q] - cuts[q - 1], m = Math.ceil(g / X - 1e-9) - 1; for (var j = 1; j <= m; j++) { var c = atDist(l.pts, cuts[q - 1] + g * j / (m + 1)); if (!near(M.pts, c, 5)) out.push({ k: "sch", c: c, why: "sg_w_dist" }); } }
        if (l.from && !near(M.wl, l.pts[0], 3)) out.push({ k: "wl", c: l.pts[0].slice(), why: "sg_w_abz" });
      });
      return out;
    }
    function sugDraw() {
      if (!sugLayer) sugLayer = L.layerGroup().addTo(map); sugLayer.clearLayers();
      sugs.forEach(function (g) { L.circleMarker(AD.ll(g.c), { radius: g.k === "wl" ? 6 : 8, color: g.k === "wl" ? "#b25b00" : "#001155", weight: 2, dashArray: "3 3", fillColor: "#ffffff", fillOpacity: .6, interactive: false }).addTo(sugLayer); });
    }
    function sugRender() {
      var h = $("#kmSug"); if (!h) return; var ns = sugs.filter(function (g) { return g.k === "sch"; }).length, nw = sugs.length - ns;
      var opts = function (arr, v) { return arr.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join(""); };
      h.innerHTML = "<h4>" + esc(tt("sg_h")) + "</h4>" +
        '<div class="kmsugf"><label>' + esc(tt("sg_ersch")) + ' <select data-rc="ersch">' + opts([["basisCu", tt("sg_basisCu")], ["basisGfk", tt("sg_basisGfk")], ["fkrk", tt("sg_fkrk")], ["detail", tt("sg_detail")]], RC.ersch) + "</select></label>" +
        '<label>' + esc(tt("sg_zone")) + ' <select data-rc="zone">' + opts([["in", tt("sg_zin")], ["aus", tt("sg_zaus")]], RC.zone) + "</select></label>" +
        '<label>' + esc(tt("sg_x")) + ' <input type="text" inputmode="decimal" data-rc="x" value="' + esc(RC.x) + '" placeholder="' + richt() + '" size="6"></label></div>' +
        '<p class="hint">' + esc(tt("sg_hint").replace("{r}", richt())) + '</p><div class="kmbar"><button type="button" class="btn small" data-sg="calc">' + esc(tt("sg_calc")) + "</button>" +
        (sugs.length ? ' <button type="button" class="btn small" data-sg="apply">' + esc(tt("sg_apply")) + '</button> <button type="button" class="btn ghost small" data-sg="clear">' + esc(tt("sg_clear")) + "</button>" : "") + "</div>" +
        (sugs.length ? '<p class="hint" role="status">' + esc(tt("sg_n").replace("{s}", ns).replace("{w}", nw)) + "</p>" : "");
    }
    function sugApply() {
      if (!sugs.length) return; snap(); var ns = 0, nw = 0;
      sugs.forEach(function (g) { if (g.k === "sch") { placeShaft(g.c, true); ns++; } else { M.wl.push({ id: nid("w"), pt: g.c.slice(), sid: null, wt: "ts", name: "", fl: lastCfg.fl || "" }); nw++; } });
      sugs = []; sugDraw(); sugRender(); refresh(); toast(dlg, tt("sg_done").replace("{s}", ns).replace("{w}", nw), tt("km_undoBtn"), function () { if (undoSt.length) { var b = $("[data-k=undo]"); if (b) b.click(); } });
    }
    /* DXF-Export (Netzkanten 100, Netzknoten 200, Knickpunkte 201) – Koordinaten wie gezeichnet (LV95) */
    function dxfExport() {
      var o = ["0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "70", "3"], lay = function (n, c) { o.push("0", "LAYER", "2", n, "70", "0", "62", String(c), "6", "CONTINUOUS"); };
      lay("100", 3); lay("200", 1); lay("201", 5); o.push("0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
      var v = function (a) { return [a[0].toFixed(3), a[1].toFixed(3)]; };
      M.lines.forEach(function (l) { if (l.pts.length < 2) return; o.push("0", "POLYLINE", "8", "100", "66", "1", "70", "0"); l.pts.forEach(function (q) { var c = v(q); o.push("0", "VERTEX", "8", "100", "10", c[0], "20", c[1], "30", "0"); }); o.push("0", "SEQEND", "8", "100");
        for (var i = 1; i < l.pts.length - 1; i++) { var c = v(l.pts[i]); o.push("0", "POINT", "8", "201", "10", c[0], "20", c[1], "30", "0"); } });
      M.pts.forEach(function (p) { var c = v(p.pt); o.push("0", "POINT", "8", "200", "10", c[0], "20", c[1], "30", "0", "0", "CIRCLE", "8", "200", "10", c[0], "20", c[1], "30", "0", "40", "0.4"); });
      o.push("0", "ENDSEC", "0", "EOF"); var rows2 = []; for (var i = 0; i < o.length; i += 2) rows2.push(o[i] + "\n" + o[i + 1]);
      var a = document.createElement("a"), u = URL.createObjectURL(new Blob([rows2.join("\n") + "\n"], { type: "application/dxf" })); a.href = u; a.download = "Netz_LV-Devis.dxf"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 500);
    }
    /* Legende der Linienarten (Bildschirm) */
    function legend() {
      var e = $("#kmLeg"); if (!e) return; var sf = {}; M.lines.forEach(function (l) { if (l.pts.length > 1) sf[cfgOf(l).fl || ""] = 1; });
      var ks = Object.keys(sf).filter(function (k) { return k; }); e.hidden = !ks.length;
      e.innerHTML = ks.map(function (k) { var st = LSTY[k]; return '<span class="kmlg1"><svg width="34" height="8" aria-hidden="true"><line x1="2" y1="4" x2="32" y2="4" stroke="' + st[0] + '" stroke-width="3"' + (st[1] ? ' stroke-dasharray="' + st[1] + '"' : "") + (st[1] === "1 7" ? ' stroke-linecap="round"' : "") + "/></svg> " + esc(tt("km_s_" + k)) + "</span>"; }).join("");
    }
    function refresh() { draw(); rows(); costSoon(); }
    var costT = 0;
    function costSoon() {
      legend(); markerSync(); evalRender(); rcRender(); hzRender(); if (!sugInit) { sugInit = 1; sugRender(); } if (!opt.cost) return; clearTimeout(costT);
      costT = setTimeout(function () { var el = $("#kmCost"); if (!el) return; var v = null; try { v = opt.cost(JSON.parse(JSON.stringify(M)), function (m) { return effLen(m); }, { area: area, perim: perim, base: base }); } catch (e) { v = null; }
        el.textContent = v == null ? "" : tt("km_cost").replace("{v}", Math.round(v).toLocaleString("de-CH")); }, 500);
    }
    function newNote(type, pts) { snap(); var n = { id: nid("n"), type: type, pts: pts, color: noteCol, text: type === "text" ? "Text" : "", size: "m" }; M.notes.push(n); sel = { id: n.id }; return n; }
    /* ---------- Marker-Katalog (Vorbelegung), Auswertung, Fang- und Zeichenhilfen, Koordinate/Massstab ---------- */
    var snapSt = { pt: true, ln: true, rect: true, ortho: false }; try { var sv0 = JSON.parse(localStorage.getItem("lvd-km-snap") || "null"); if (sv0 && typeof sv0 === "object") snapSt = Object.assign(snapSt, sv0); } catch (e) { }
    var PRESETS = ["1×K55", "2×K55", "3×K55", "4×K55", "1×K100", "2×K100", "3×K100", "1×K100 + 1×K55", "2×K100 + 3×K55"];
    function markerSync() {
      var h = $("#kmMk"); if (!h) return; var cur = pipeTxt(cfgOf({ cfg: lastCfg })), grp = function (title, items, isOn, fn) {
        var s2 = document.createElement("h4"); s2.textContent = title; h.appendChild(s2); var row = document.createElement("div"); row.className = "mkrow"; row.setAttribute("role", "group"); row.setAttribute("aria-label", title);
        items.forEach(function (it) { var b = document.createElement("button"); b.type = "button"; b.className = "btn ghost small"; b.textContent = it[1]; b.setAttribute("aria-pressed", isOn(it[0]) ? "true" : "false"); b.addEventListener("click", function () { fn(it[0]); }); row.appendChild(b); }); h.appendChild(row);
      };
      var fo = document.activeElement && h.contains(document.activeElement) ? document.activeElement.textContent : null; h.innerHTML = "";
      grp(tt("ws_preRt"), PRESETS.map(function (v) { return [v, v]; }), function (v) { return v === cur; }, function (v) { var rt = {}; v.split(" + ").forEach(function (q) { var m = /^(\d+)×K(\d+)$/.exec(q); if (m) rt[m[2]] = +m[1]; }); lastCfg.rt = rt; markerSync(); });
      grp(tt("ws_preArt"), ARTS.map(function (a) { return [a, tt("km_lt_art_" + a)]; }), function (v) { return lastCfg.art === v; }, function (v) { lastCfg.art = v; markerSync(); });
      grp(tt("ws_preFl"), FLS.map(function (a) { return [a, tt("km_s_" + a)]; }), function (v) { return lastCfg.fl === v; }, function (v) { lastCfg.fl = lastCfg.fl === v ? "" : v; markerSync(); });
      if (cat && cat.schacht) grp(tt("ws_preSch"), cat.schacht.map(function (o) { return [o[0], o[0]]; }), function (v) { return (lastTyp || opt.defTyp) === v; }, function (v) { lastTyp = v; markerSync(); });
      grp(tt("ws_preWl"), [["ts", tt("km_wlts")], ["bo", tt("km_wlbo")], ["sg", tt("km_wlsg")], ["zs", tt("km_wlzs")]], function (v) { return wlT === v; }, function (v) { wlT = v; var w = $("#kmWlT"); if (w) w.value = v; markerSync(); });
      if (fo) { var again = [].slice.call(h.querySelectorAll("button")).filter(function (b) { return b.textContent === fo; })[0]; if (again) again.focus(); }
    }
    function evalRender() {
      var h = $("#kmEval"); if (!h) return; var rows = function (arr) { return '<table><tbody>' + arr.map(function (r) { return "<tr><td>" + esc(r[0]) + '</td><td class="num">' + esc(r[1]) + "</td></tr>"; }).join("") + "</tbody></table>"; };
      var out = "", ls = M.lines.filter(function (l) { return l.pts.length > 1; }), pipeM = {}, surf = {}, tot = 0;
      ls.forEach(function (l) { var L0 = effLen(l.pts), c = cfgOf(l); tot += L0; pipeList(c).forEach(function (e) { pipeM[e[0]] = (pipeM[e[0]] || 0) + L0 * e[1]; }); var k = c.fl || ""; surf[k] = (surf[k] || 0) + L0; });
      out += "<h4>" + esc(tt("ws_ev_lines")) + "</h4>" + (ls.length ? rows([[ls.length + " ×", fmt(tot) + " m"]]) : '<p class="none">' + esc(tt("ws_ev_none")) + "</p>");
      var pk = Object.keys(pipeM).sort(function (a, b) { return b - a; }); if (pk.length) out += "<h4>" + esc(tt("ws_ev_pipes")) + "</h4>" + rows(pk.map(function (k) { return ["K" + k, fmt(pipeM[k]) + " m"]; }));
      var sk = Object.keys(surf); if (sk.length) out += "<h4>" + esc(tt("ws_ev_surf")) + "</h4>" + rows(sk.map(function (k) { return [k ? tt("km_s_" + k) : tt("ws_ev_open"), fmt(surf[k]) + " m"]; }));
      var nNeu = M.pts.filter(function (p) { return !p.mode || p.mode === "neu"; }).length, nAn = M.lines.reduce(function (a, l) { return a + (M.pts.some(function (p) { return p.id === l.s && p.mode === "anschluss"; }) ? 1 : 0) + (M.pts.some(function (p) { return p.id === l.e && p.mode === "anschluss"; }) ? 1 : 0); }, 0), nDk = M.pts.filter(function (p) { return p.mode === "deckel"; }).length;
      var ob = []; if (M.pts.length) ob.push([tt("ws_ev_sch"), nNeu + " / " + nAn + " / " + nDk]); if (M.wl.length) ob.push([tt("ws_ev_wl"), M.wl.length + ""]); if (M.geb.length) ob.push([tt("ws_ev_geb"), M.geb.length + ""]); if (M.sond.length) ob.push([tt("ws_ev_sond"), M.sond.length + ""]);
      var ar = M.areas.filter(function (f) { return f.pts.length > 2; }).reduce(function (a, f) { return a + area(f.pts); }, 0); if (ar > 0) ob.push([tt("ws_ev_area"), fmt(ar) + " m²"]);
      if (ob.length) out += "<h4>" + esc(tt("ws_ev_obj")) + "</h4>" + rows(ob);
      h.innerHTML = out;
    }
    /* Fang- und Zeichenhilfen: Punktfang (Objekte, Linienpunkte), Linienfang (Fusspunkt), Winkelraster 45° zum letzten Punkt */
    function lastActive() { var l = cur && byId(M.lines, cur), a = curA && byId(M.areas, curA), n = curN && byId(M.notes, curN), q = l ? l.pts : a ? a.pts : n ? n.pts : mode === "ruler" ? rul : null; return q && q.length ? q[q.length - 1] : null; }
    /* Fangen: Punkt, Linie (Fusspunkt, mit Knoten/Abzweig), rechtwinklig/parallel zur Bezugslinie, Winkelraster 45°. Umschalt kehrt «Rechtwinklig» vorübergehend um. */
    var shiftDown = false;
    function unitV(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy); return d > 0 ? [dx / d, dy / d] : null; }
    function snapInfo(c, forPreview) {
      var cp = map.latLngToContainerPoint(AD.ll(c)), prev = lastActive(), res = { c: c, kind: "", label: "", guide: null };
      var curL = cur && byId(M.lines, cur), best = null, tol = 14, cands = [];
      if (snapSt.pt) { M.pts.concat(M.wl, M.geb, M.sond).forEach(function (p) { cands.push(p.pt); }); M.lines.forEach(function (l) { l.pts.forEach(function (p) { cands.push(p); }); }); M.areas.forEach(function (f) { f.pts.forEach(function (p) { cands.push(p); }); }); }
      cands.forEach(function (p) { if (curL && curL.pts.indexOf(p) >= 0) return; var q = map.latLngToContainerPoint(AD.ll(p)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d <= tol && (!best || d < best.d)) best = { d: d, p: p }; });
      if (best) { res.c = best.p.slice(); res.kind = "pt"; res.label = tt("sn_pt"); return res; }
      if (snapSt.ln) {
        var bl = null; M.lines.forEach(function (l) { if (l === curL || l.pts.length < 2) return; var h = segHit(cp, l.pts); if (h && h.d <= 10 && (!bl || h.d < bl.d)) { bl = h; bl.line = l; } });
        if (bl) { var sa = bl.line.pts[bl.seg], sb = bl.line.pts[bl.seg + 1]; res.c = bl.q; res.kind = "ln"; res.label = tt("sn_ln"); res.line = bl.line; res.seg = bl.seg; res.dir = unitV(sa, sb); return res; }
      }
      if (prev && mode && mode !== "edit") {
        var v = [c[0] - prev[0], c[1] - prev[1]], vl = Math.hypot(v[0], v[1]), useRect = snapSt.rect !== shiftDown;
        if (vl > 0) {
          if (useRect) {   /* Bezugsrichtungen: Abzweig-Basis, vorheriges Segment, Linien in der Nähe */
            var refs = [];
            if (curL && curL.baseDir && curL.pts.length === 1) refs.push([curL.baseDir, "ln"]);
            var pts0 = curL ? curL.pts : (curA && byId(M.areas, curA) ? byId(M.areas, curA).pts : null);
            if (pts0 && pts0.length > 1) { var pd = unitV(pts0[pts0.length - 2], pts0[pts0.length - 1]); if (pd) refs.push([pd, "seg"]); }
            M.lines.forEach(function (l) { if (l === curL || l.pts.length < 2) return; var h = segHit(cp, l.pts); if (h && h.d <= 40) { var d0 = unitV(l.pts[h.seg], l.pts[h.seg + 1]); if (d0) refs.push([d0, "ln"]); } });
            var bestA = null;
            refs.forEach(function (r) { [[r[0], "par"], [[-r[0][1], r[0][0]], "perp"]].forEach(function (cd) { var D = cd[0], dot = v[0] * D[0] + v[1] * D[1], ang = Math.acos(Math.min(1, Math.abs(dot) / vl)) * 180 / Math.PI; if (ang <= 6 && (!bestA || ang < bestA.ang)) bestA = { ang: ang, D: D, dot: dot, rel: cd[1], src: r[1] }; }); });
            if (bestA) { res.c = [Math.round((prev[0] + bestA.D[0] * bestA.dot) * 100) / 100, Math.round((prev[1] + bestA.D[1] * bestA.dot) * 100) / 100]; res.kind = "rect"; res.rel = bestA.rel; res.label = tt(bestA.rel === "perp" ? "sn_perp" : "sn_par"); res.guide = { from: prev, D: bestA.D }; return res; }
          }
          if (snapSt.ortho) { var an = Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 4)) * (Math.PI / 4); res.c = [Math.round((prev[0] + vl * Math.cos(an)) * 100) / 100, Math.round((prev[1] + vl * Math.sin(an)) * 100) / 100]; res.kind = "ortho"; res.label = tt("sn_45"); }
        }
      }
      return res;
    }
    function snapPoint(c) { return snapInfo(c).c; }
    /* Fangmarke und Hilfslinie am Cursor */
    var snapLayer = null;
    function snapPreview(ll, shift) {
      shiftDown = !!shift; if (!snapLayer) snapLayer = L.layerGroup().addTo(map); snapLayer.clearLayers();
      if (!mode || mode === "edit" || mode === "geo" || mode === "cal" || mode === "text0") return null;
      var si = snapInfo(AD.pt(ll)); if (!si.kind) return si;
      var q = AD.ll(si.c), ic = { pt: "◯", ln: "◆", rect: si.rel === "perp" ? "⊥" : "∥", ortho: "45°" }[si.kind];
      L.marker(q, { interactive: false, keyboard: false, icon: L.divIcon({ className: "kmsnap " + si.kind, html: "<span>" + esc(ic) + '</span><i>' + esc(si.label) + "</i>", iconSize: [0, 0] }) }).addTo(snapLayer);
      if (si.guide) {
        var g = si.guide, sp0 = map.latLngToContainerPoint(AD.ll(g.from)), u = 1, sp1 = map.latLngToContainerPoint(AD.ll([g.from[0] + g.D[0] * u, g.from[1] + g.D[1] * u])), sx = sp1.x - sp0.x, sy = sp1.y - sp0.y, sl = Math.hypot(sx, sy) || 1; sx /= sl; sy /= sl;
        var e1 = map.containerPointToLatLng(L.point(sp0.x + sx * 260, sp0.y + sy * 260)), e2 = map.containerPointToLatLng(L.point(sp0.x - sx * 260, sp0.y - sy * 260));
        L.polyline([e2, e1], { color: "#0072d6", weight: 1, dashArray: "4 4", interactive: false, opacity: 0.85 }).addTo(snapLayer);
      }
      return si;
    }
    function wsLate() {
      markerSync(); evalRender();
      var tg = dlg.querySelectorAll("[data-sn]"); tg.forEach(function (b) { b.setAttribute("aria-pressed", snapSt[b.dataset.sn] ? "true" : "false"); b.addEventListener("click", function () { snapSt[b.dataset.sn] = !snapSt[b.dataset.sn]; b.setAttribute("aria-pressed", snapSt[b.dataset.sn] ? "true" : "false"); try { localStorage.setItem("lvd-km-snap", JSON.stringify(snapSt)); } catch (e) { } }); });
      var co = $("#kmCoord"), sc = $("#kmScale");
      var scaleTxt = function () { if (plan) { sc.textContent = cal.scale ? tt("ws_scalePl").replace("{s}", (Math.round(cal.scale * 1000) / 1000)) : tt("pl_calNo"); return; } var z = map.getZoom(), lat = map.getCenter().lat, mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z); sc.textContent = "1 : " + (Math.round(mpp / 0.00028 / 50) * 50).toLocaleString("de-CH") + " · z" + z; };
      var tmv = 0; map.on("mousemove", function (e) { var t = Date.now(); if (t - tmv < 60) return; tmv = t; var c = AD.pt(e.latlng); co.textContent = plan ? (cal.scale ? "x " + fmt(c[0] * cal.scale) + " m / y " + fmt(c[1] * cal.scale) + " m" : "px " + Math.round(c[0]) + " / " + Math.round(c[1])) : "E " + Math.round(c[0]).toLocaleString("de-CH") + " / N " + Math.round(c[1]).toLocaleString("de-CH"); });
      map.on("zoomend moveend", scaleTxt); scaleTxt();
    }
    function addPt(ll) {
      var startL = null; askHide(); ctxHide(); if (Date.now() - ctxT < 500) return;
      if (!mode) return;
      if (mode === "edit") { if (Date.now() - lastMove < 250) return; sel = null; refresh(); return; }
      var c = AD.pt(ll), si = mode && mode !== "geo" && mode !== "cal" ? snapInfo(c) : null; if (si) c = si.c;
      if (mode === "ruler") { rul.push(c); refresh(); return; }
      if (mode === "geo") {
        if (!ovl) return; var last = gcp[gcp.length - 1];
        if (!last || last.t) gcp.push({ s: ovInv(ovl, c[0], c[1]), t: null }); else last.t = c;
        if (gcp.length === 2 && gcp[1].t) { var sol = ovSolve(ovl, gcp[0].s, gcp[0].t, gcp[1].s, gcp[1].t); if (sol) { ovl.mpp = sol.mpp; ovl.rot = sol.rot; ovl.E = sol.E; ovl.N = sol.N; ovl.conf = true; ovl.autoSrc = "gcp"; toast(dlg, tt("ov_done"), tt("km_undoBtn"), function () { ovl = JSON.parse(ov0); ovDraw(); }); } gcp = []; mode = ""; }
        else tmp = gcp.reduce(function (a, g2) { a.push(ovPx(ovl, g2.s[0], g2.s[1])); if (g2.t) a.push(g2.t); return a; }, []);
        ovDraw(); refresh(); return;
      }
      if (mode === "cal") {
        calPts.push(c); if (calPts.length === 2) { $("#kmCalF").hidden = false; $("#kmCalM").value = ""; $("#kmCalM").focus(); } draw(); return;
      }
      if (mode === "text") { var tn = newNote("text", [c]); refresh(); var ti = $('[data-rid="' + tn.id + '"] input[type=text]'); if (ti) { ti.focus(); ti.select(); } return; }
      if (mode === "arrow" || mode === "rect") { tmp.push(c); if (tmp.length === 2) { newNote(mode, tmp); tmp = []; } refresh(); return; }
      if (mode === "wl" || mode === "geb") {
        snap(); var q = mode === "wl" ? { id: nid("w"), pt: c, sid: null, wt: wlT, name: "", fl: lastCfg.fl || "" } : { id: nid("g"), pt: c, sid: null, cm: opt.defGeb.cm, abd: opt.defGeb.abd, name: "" };
        (mode === "wl" ? M.wl : M.geb).push(q); sel = { id: q.id }; refresh(); return;
      }
      if (mode === "area") {
        snap(); var fa = curA && byId(M.areas, curA);
        if (!fa) { fa = { id: nid("f"), pts: [], rid: null, belag: JSON.parse(JSON.stringify(opt.defBelag)), fl: ["pflaster", "wiese"].indexOf(lastCfg.fl) >= 0 ? lastCfg.fl : "", ab: "betonstein" }; M.areas.push(fa); curA = fa.id; sel = { id: fa.id }; }
        fa.pts.push(c); refresh(); return;
      }
      if (mode === "sline") {
        var sn = curN && byId(M.notes, curN);
        if (!sn) { sn = newNote("sline", [c]); curN = sn.id; } else { snap(); sn.pts.push(c); }
        refresh(); return;
      }
      snap();
      if (mode === "pt") { placeShaft(c); }
      else if (mode === "sond") { var o = { id: nid("s"), pt: c, name: "", l: "1.0", b: "1.0", t: "1.5" }; M.sond.push(o); sel = { id: o.id }; }
      else {
        var l = cur && byId(M.lines, cur); var fresh = !l;
        if (!l) { l = { id: nid("l"), pts: [], rid: null, rohr: JSON.parse(JSON.stringify(opt.defRohr)), cfg: JSON.parse(JSON.stringify(lastCfg)) }; lineSync(l); M.lines.push(l); cur = l.id; sel = { id: l.id }; }
        l.pts.push(c); if (fresh && l.pts.length === 1) { startL = l;
          if (si && si.kind === "ln" && si.line) { var bs = si.line, ia = bs.pts[si.seg], ib = bs.pts[si.seg + 1]; l.from = bs.id; l.baseDir = si.dir; l.cfg = JSON.parse(JSON.stringify(cfgOf(bs))); l.rohr = JSON.parse(JSON.stringify(bs.rohr || l.rohr)); lineSync(l);   /* Abzweig: Knoten in der Basislinie, Basis-Richtung für «rechtwinklig» */
            if (AD.dist(c, ia) > 0.05 && AD.dist(c, ib) > 0.05) bs.pts.splice(si.seg + 1, 0, c.slice()); startL = null; }
        }
      }
      refresh(); if (startL) askStart(startL, c);
    }
    function endLine() {
      var l = cur && byId(M.lines, cur), askL = l && l.pts.length > 1 ? l : null; if (l && l.pts.length < 2) M.lines.splice(M.lines.indexOf(l), 1);
      var n = curN && byId(M.notes, curN); if (n && n.pts.length < 2) M.notes.splice(M.notes.indexOf(n), 1);
      var fa = curA && byId(M.areas, curA); if (fa && fa.pts.length < 3) M.areas.splice(M.areas.indexOf(fa), 1);
      if (askL) { var le = askL.pts[askL.pts.length - 1], tl = plan ? 0.6 : 0.08; M.lines.forEach(function (o) { if (o === askL || o.pts.length < 2) return; var cpE = map.latLngToContainerPoint(AD.ll(le)), h = segHit(cpE, o.pts); if (h && h.d <= 1.5 && AD.dist(le, o.pts[h.seg]) > tl && AD.dist(le, o.pts[h.seg + 1]) > tl) { o.pts.splice(h.seg + 1, 0, le.slice()); askL.to = o.id; } }); }   /* Endpunkt auf fremder Linie: Knoten (T-Anschluss) */
      cur = null; curN = null; curA = null; tmp = []; hideTip(); refresh();
      if (askL && M.lines.indexOf(askL) >= 0) { askEnd(askL); quickOpen(askL); }
    }
    function undo() {
      if (mode === "cal" && calPts.length) { calPts.pop(); $("#kmCalF").hidden = true; return draw(); }
      if (tmp.length) { tmp.pop(); return draw(); }
      var s = undoSt.pop(); if (!s) return;
      M = JSON.parse(s); M.sond = M.sond || []; M.notes = M.notes || []; M.areas = M.areas || []; M.wl = M.wl || []; M.geb = M.geb || [];
      if (cur && !byId(M.lines, cur)) cur = null; if (curN && !byId(M.notes, curN)) curN = null; if (curA && !byId(M.areas, curA)) curA = null; if (sel && !findObj(sel.id)) sel = null;
      refresh();
    }
    function del(id) {
      var f = findObj(id); if (!f) return; snap(); f.arr.splice(f.arr.indexOf(f.o), 1);
      if (cur === id) cur = null; if (curN === id) curN = null; if (curA === id) curA = null; sel = null; refresh();
    }
    function show(id) {
      var f = findObj(id); if (!f) return; sel = { id: id }; var ps = f.o.pts || [f.o.pt];
      if (ps.length > 1) map.fitBounds(L.latLngBounds(ps.map(AD.ll)).pad(0.3), { maxZoom: plan ? 3 : 19, animate: false });
      else map.setView(AD.ll(ps[0]), Math.max(map.getZoom(), plan ? 1 : 18), { animate: false });
      refresh();
    }
    var ro = null;
    function close() { try { if (ro) ro.disconnect(); map.remove(); } catch (e) { } dlg.close(); dlg.remove(); if (opt.onClose) opt.onClose(); }

    if (plan) {
      var P = opt.plan; map = L.map($("#kmMap"), { crs: L.CRS.Simple, minZoom: -4, maxZoom: 4, zoomSnap: 0.25, doubleClickZoom: false, attributionControl: false });
      var bd = [[-P.h, 0], [0, P.w]]; L.imageOverlay(P.img, bd).addTo(map); map.fitBounds(bd);
      grp = L.layerGroup().addTo(map);
      $("#kmCalF").addEventListener("submit", function (e) {
        e.preventDefault(); var m = parseFloat(String($("#kmCalM").value).replace(",", ".")), d = Math.hypot(calPts[0][0] - calPts[1][0], calPts[0][1] - calPts[1][1]);
        if (!(m > 0) || !(d > 0)) { $("#kmCalM").focus(); return; }
        var old = JSON.stringify(cal); cal = { a: calPts[0], b: calPts[1], m: m, scale: m / d }; calPts = []; $("#kmCalF").hidden = true; mode = ""; refresh();
        toast(dlg, tt("pl_calDone"), tt("km_undoBtn"), function () { cal = JSON.parse(old); refresh(); });
      });
    } else {
      map = L.map($("#kmMap"), { center: [46.8, 8.23], zoom: 8, minZoom: 7, maxZoom: 20, doubleClickZoom: false, zoomAnimation: false, attributionControl: false }); L.control.attribution({ prefix: "Leaflet" }).addTo(map);
      var op0 = map.createPane("kmov"); op0.style.zIndex = 250; op0.style.pointerEvents = "none"; map.on("zoom move viewreset resize", ovDraw);
      ovGrp = L.layerGroup().addTo(map); grp = L.layerGroup().addTo(map); tiles(); drawOv(); selList();
      $("#kmCat").addEventListener("toggle", function (e) { if (e.target.open) openCat(); });
      $("#kmCatQ").addEventListener("input", resList);
      $("#kmCat .kmchips").addEventListener("click", function (e) { var c = e.target.closest("[data-q]"); if (!c) return; $("#kmCat").open = true; $("#kmCatQ").value = c.dataset.q; openCat(); resList(); $("#kmCatQ").focus(); });
      $("#kmCatS").addEventListener("click", function (e) { var b = e.target.closest("[data-ovdel]"); if (!b) return; ov.splice(+b.dataset.ovdel, 1); saveOv(); drawOv(); selList(); resList(); });
    }
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { try { map.invalidateSize({ animate: false }); ovDraw(); } catch (e) { } }); ro.observe($("#kmMap")); }
    map.on("click", function (e) { var t = e.originalEvent && e.originalEvent.target; if (mode === "edit" && t && t.closest && t.closest(".leaflet-marker-icon,.leaflet-interactive")) return; addPt(e.latlng); });
    map.on("mousemove", function (e) { var t = Date.now(); if (t - (snapPreview.t || 0) < 25) return; snapPreview.t = t; var oe = e.originalEvent; liveTip(e.latlng, oe && oe.shiftKey); }); map.on("mouseout", function () { hideTip(); if (snapLayer) snapLayer.clearLayers(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Shift") shiftDown = true; }); document.addEventListener("keyup", function (e) { if (e.key === "Shift") shiftDown = false; });
    map.on("dblclick", function () { if (mode === "line" || mode === "sline" || mode === "area") endLine(); });
    map.on("zoomend", function () { if (mode === "edit" || M.notes.some(function (n) { return n.type === "arrow"; })) draw(); });
    var cs = $("#kmCol"); cs.addEventListener("change", function () { noteCol = cs.value; });

    dlg.addEventListener("change", function (e) { var hm = e.target.closest("[data-hz=mode]"); if (hm) { SLOPE = hm.checked; try { localStorage.setItem("lvd-km-slope", SLOPE ? "1" : "0"); } catch (x) { } refresh(); return; } var t = e.target.closest("[data-rc]"); if (!t) return; RC[t.dataset.rc] = t.value; try { localStorage.setItem("lvd-km-rc", JSON.stringify(RC)); } catch (x) { } sugs = []; sugDraw(); sugRender(); rcRender(); });
    dlg.addEventListener("click", function (e) {
      var pb = e.target.closest("[data-prov]");
      if (pb) { var nb = PROV[pb.dataset.prov][0][0]; if (provOf(base) !== pb.dataset.prov) { base = nb; fillBase(); try { localStorage.setItem("lvd-km-base", nb); } catch (x) { } setBase(nb); } return; }
      var ob = e.target.closest("[data-ov]");
      if (ob && ovl !== undefined) {
        var k2 = ob.dataset.ov, st = parseFloat(String($("#kmStep").value).replace(",", ".")) || 1;
        if (k2 === "tr") { transfer(); return; }
        if (k2 === "x") { ov0 = JSON.stringify(ovl); ovl = null; ovDraw(); refresh(); return; }
        if (!ovl) return; ov0 = JSON.stringify(ovl);
        if (k2 === "c") { var cc = map.getCenter(), ee = toLV95(cc.lat, cc.lng); ovl.E = ee[0]; ovl.N = ee[1]; }
        else if (k2 === "l") ovl.E -= st; else if (k2 === "r") ovl.E += st; else if (k2 === "u") ovl.N += st; else if (k2 === "d") ovl.N -= st;
        else if (k2 === "rl") ovl.rot += 0.5; else if (k2 === "rr") ovl.rot -= 0.5; else if (k2 === "sm") { ovl.mpp *= 0.99; ovl.auto = 0; } else if (k2 === "sp") { ovl.mpp *= 1.01; ovl.auto = 0; }
        ovDraw(); return;
      }
      var hzb = e.target.closest("[data-hz]"); if (hzb) { if (hzb.dataset.hz === "load") hzLoad(); return; }
      var sgb = e.target.closest("[data-sg],#kmDxf"); if (sgb) { if (sgb.id === "kmDxf") dxfExport(); else if (sgb.dataset.sg === "calc") { sugs = sugCompute(); sugDraw(); sugRender(); if (!sugs.length) { var sh = $("#kmSug"); if (sh) { var pn = document.createElement("p"); pn.className = "hint"; pn.setAttribute("role", "status"); pn.textContent = tt("sg_none"); sh.appendChild(pn); } } } else if (sgb.dataset.sg === "apply") sugApply(); else { sugs = []; sugDraw(); sugRender(); } return; }
      var b = e.target.closest("[data-k],[data-z],[data-d],[data-n]"); if (!b) return; askHide();
      if (b.dataset.n) { var nn = b.dataset.n.split("|"); return nudge(nn[0], nn[1]); }
      if (b.dataset.z) return show(b.dataset.z); if (b.dataset.d) return del(b.dataset.d);
      var k = b.getAttribute("data-k");
      if (k === "close") close();
      else if (/^m(geo|ruler|line|pt|sond|cal|edit|text|arrow|sline|rect|area|wl|geb)$/.test(k)) { var m = k.slice(1); if (m === "geo") { ov0 = JSON.stringify(ovl); gcp = []; } if (m === "ruler") rul = []; hideTip(); if (mode === "line" || mode === "sline" || mode === "area") endLine(); tmp = []; calPts = []; if (plan) $("#kmCalF").hidden = true; mode = mode === m ? "" : m; refresh(); }
      else if (k === "center") addPt(map.getCenter());
      else if (k === "end") endLine();
      else if (k === "sv") { var cc = map.getCenter(); svOpen(toLV95(cc.lat, cc.lng), null, true); }
      else if (k === "svkey") { var kv = window.prompt(tt("km_sv_keyAsk"), svKey()); if (kv !== null) { try { if (kv.trim()) localStorage.setItem("lvd-gsv-key", kv.trim()); else localStorage.removeItem("lvd-gsv-key"); } catch (e) { } } }
      else if (k === "undo") undo();
      else if (k === "clear") { var sn0 = JSON.stringify(M); snap(); M.lines = []; M.pts = []; M.sond = []; M.notes = []; M.areas = []; M.wl = []; M.geb = []; rul = []; cur = null; curN = null; curA = null; sel = null; refresh(); toast(dlg, tt("km_cleared"), tt("km_undoBtn"), function () { M = JSON.parse(sn0); M.notes = M.notes || []; M.areas = M.areas || []; M.wl = M.wl || []; M.geb = M.geb || []; refresh(); }); }
      else if (k === "geo") openGeo();
      else if (k === "fit") fitAll();
      else if (k === "max") { var on = !dlg.classList.contains("kmmax"); dlg.classList.toggle("kmmax", on); b.setAttribute("aria-pressed", on ? "true" : "false"); try { localStorage.setItem("lvd-km-max", on ? "1" : "0"); } catch (x) { } setTimeout(function () { map.invalidateSize({ animate: false }); ovDraw(); }, 50); }
      else if (k === "lbl") { showLbl = !showLbl; b.setAttribute("aria-pressed", showLbl ? "true" : "false"); draw(); }
      else if (k === "apply") {
        endLine();
        if (plan && !cal.scale && (M.lines.length || M.areas.length)) { toast(dlg, tt("pl_calNeed")); return; }
        opt.onApply(M, cal, function (m) { return effLen(m); }, { area: area, perim: perim, base: base, overlay: ovl, planCleared: planCleared }); close();
      }
    });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); if (cur || curN || curA || tmp.length || (mode === "ruler" && rul.length) || gcp.length) { gcp = []; if (mode === "ruler") rul = []; endLine(); toast(dlg, tt("km_escDone")); return; } close(); });
    /* Tastatur: Enter/Leertaste = Punkt in Kartenmitte, Umschalt+Enter = beenden, Entf = Objekt löschen, Strg+Z = Rückgängig */
    dlg.addEventListener("keydown", function (e) {
      var t = e.target, ed = t.matches && t.matches("input,select,textarea");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !ed) { e.preventDefault(); undo(); return; }
      if (t.id === "kmMap" && mode && mode !== "edit") {
        if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); endLine(); return; }
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addPt(map.getCenter()); return; }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !ed && mode === "edit" && sel) { e.preventDefault(); del(sel.id); }
    });
    var fa0 = $("#kmFoldAll"); if (fa0) fa0.addEventListener("click", function () { var all = fa0.dataset.all === "1"; [].slice.call($("#kmObj").querySelectorAll(".kmrow")).forEach(function (r) { folded[r.getAttribute("data-rid")] = !all; }); rows(); });
    var wsel = $("#kmWlT"); if (wsel) wsel.addEventListener("change", function () { wlT = wsel.value; if (sel) { var f = findObj(sel.id); if (f && M.wl.indexOf(f.o) >= 0 && mode === "edit") { snap(); f.o.wt = wlT; refresh(); } } });
    var bs = $("#kmBase");
    function fillBase() {   /* Umschalter swisstopo / geo.admin.ch: zeigt nur die Optionen des gewählten Anbieters */
      if (!bs) return; var pv = provOf(base); bs.innerHTML = PROV[pv].map(function (o) { return '<option value="' + o[0] + '">' + esc(tt(o[1])) + "</option>"; }).join(""); bs.value = base;
      dlg.querySelectorAll("[data-prov]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.prov === pv ? "true" : "false"); });
    }
    var avGo = $("#kmAvGo");
    if (avGo) avGo.addEventListener("click", function () {
      var u = ($("#kmAvUrl").value || "").trim(), l = ($("#kmAvLy").value || "").trim();
      if (!/^https:\/\//i.test(u)) { toast(dlg, tt("km_avBad")); return; }
      var save = function (ly) { try { localStorage.setItem("lvd-km-av", JSON.stringify({ u: u, l: ly })); } catch (e) { } $("#kmAvLy").value = ly; setBase("av"); };
      if (l) { save(l); return; }
      /* Ebenenname leer: GetCapabilities lesen und passende Ebene(n) wählen (Name aus dem Dienst, nicht geraten) */
      $("#kmHelp").textContent = tt("km_avFind");
      fetch(u + (u.indexOf("?") < 0 ? "?" : "&") + "SERVICE=WMS&REQUEST=GetCapabilities").then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (x) {
        var d = new DOMParser().parseFromString(x, "text/xml"), nm = [].slice.call(d.getElementsByTagName("Layer")).map(function (e) { var n = [].slice.call(e.children).filter(function (c) { return c.localName === "Name"; })[0]; return n ? n.textContent.trim() : ""; }).filter(Boolean);
        if (!nm.length) throw 0; var pick = nm.filter(function (n) { return /parzell|liegenschaft|grundst|cadastr|kataster|^av/i.test(n); }); save((pick.length ? pick : nm.slice(0, 1)).slice(0, 4).join(","));
      }).catch(function () { toast(dlg, tt("km_avNone")); refresh(); });
    });
    if (bs) { fillBase(); avRow(); bs.addEventListener("change", function () { try { if (bs.value !== "viewer") localStorage.setItem("lvd-km-base", bs.value); } catch (e) { } setBase(bs.value); }); }
    var sf = $(".kmsearch");
    if (sf) sf.addEventListener("submit", function (e) {
      e.preventDefault(); var q = $("#kmQ").value.trim(), ul = $("#kmHits"); if (!q) return;
      ul.innerHTML = '<li class="kmnote">' + esc(tt("km_searching")) + "</li>";
      fetch(SEARCH + "?type=locations&limit=8&sr=2056&lang=" + (opt.lang || "de") + "&searchText=" + encodeURIComponent(q))
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) {
          var hits = (j.results || []).filter(function (r) { return r.attrs && isFinite(r.attrs.lat) && isFinite(r.attrs.lon); });
          ul.innerHTML = hits.length ? "" : '<li class="kmnote">' + esc(tt("km_none")) + "</li>";
          hits.forEach(function (r) {
            var li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.className = "kmhit";
            b.textContent = String(r.attrs.label || "").replace(/<[^>]*>/g, "");
            b.addEventListener("click", function () { map.setView([r.attrs.lat, r.attrs.lon], 18); ul.innerHTML = ""; $("#kmMap").focus(); });
            li.appendChild(b); ul.appendChild(li);
          });
        }).catch(function () { ul.innerHTML = '<li class="kmnote err">' + esc(tt("km_searchErr")) + "</li>"; });
    });
    if (!plan) {
      var ovMsg = function (k, err) { var m = $("#kmOvMsg"); m.textContent = k ? tt(k) : ""; m.className = "hint" + (err ? " reqmsg" : ""); };
      var setOvl = function (r, ratioMpp) {
        var c = map.getCenter(), e = toLV95(c.lat, c.lng); ov0 = JSON.stringify(ovl);
        ovl = { img: r.img, w: r.w, h: r.h, E: e[0], N: e[1], rot: 0, mpp: ratioMpp || Math.max(0.05, 200 / r.w), op: 0.6, auto: ratioMpp ? r.ratio : 0 }; $("#kmOvD").open = true; refresh(); requestAnimationFrame(function () { requestAnimationFrame(function () { try { map.invalidateSize({ animate: false }); fitAll(); ovDraw(); } catch (x) { } }); });
        ovMsg(ratioMpp ? "ov_loadedAuto" : "ov_loaded"); if (ratioMpp) $("#kmOvMsg").textContent = tt("ov_loadedAuto").replace("{r}", r.ratio); $("#kmOvD").open = true;
        ovAuto(r, ratioMpp);
      };
      /* Automatische Ausrichtung: Koordinatenraster, sonst Ortsname + Kartenabgleich; Ergebnis nur als Vorschlag (Bestätigung nötig) */
      var autoRun = 0, autoTxt = function (k, o) { var t = tt(k); Object.keys(o || {}).forEach(function (x) { t = t.replace("{" + x + "}", o[x]); }); return t; };
      function ovAuto(r, mpp) {
        var run = ++autoRun, m0 = $("#kmOvMsg"), card = $("#kmOvAuto"), at = $("#kmOvAutoT"); card.hidden = true;
        var fin = function (res) {
          if (run !== autoRun || !ovl) return;
          if (!res) { m0.textContent = tt("ov_autoNone"); m0.className = "hint"; return; }
          ov0 = JSON.stringify(ovl); ovl.E = res.E; ovl.N = res.N; ovl.rot = 0; if (res.mpp) { ovl.mpp = res.mpp; ovl.auto = 0; } ovl.autoSrc = res.src; ovl.conf = false;
          fitAll(); refresh(); m0.textContent = ""; at.textContent = res.txt; card.hidden = false; $("[data-oa=ok]").focus();
        };
        if (r.grid) { var g = r.grid; return fin({ src: "grid", E: g.E0 + g.mpp * r.w / 2, N: g.N0 - g.mpp * r.h / 2, mpp: g.mpp, txt: autoTxt("ov_autoGrid", { n: g.n, s: g.rms < 0.1 ? "0.1" : (Math.round(g.rms * 10) / 10) }) }); }
        if (!mpp) return fin(null);
        m0.textContent = tt("ov_autoRun"); m0.className = "hint";
        var findPlace = function () {
          var ws = (r.words || []).slice(0, 5), i = 0;
          return new Promise(function (ok) {
            (function next() {
              if (i >= ws.length) return ok(null); var wd = ws[i++];
              fetch(SEARCH + "?type=locations&origins=gg25&limit=1&sr=2056&lang=" + (opt.lang || "de") + "&searchText=" + encodeURIComponent(wd)).then(function (x) { return x.json(); }).then(function (j) {
                var h = (j.results || []).filter(function (q) { return q.attrs && isFinite(q.attrs.lat) && isFinite(q.attrs.lon); })[0];
                if (h) { var e = toLV95(h.attrs.lat, h.attrs.lon); ok({ E: e[0], N: e[1], name: wd }); } else next();
              }).catch(next);
            })();
          });
        };
        var cz = map.getZoom(), c0 = map.getCenter(), e0 = toLV95(c0.lat, c0.lng), good = function (m) { return m && m.s >= 0.3 && m.ratio >= 1.2; };
        var tryView = function () { return cz >= 14 ? matchPlan(r.img, r.w, r.h, mpp, e0[0], e0[1], 300).then(function (m) { return good(m) ? { m: m, name: "" } : null; }) : Promise.resolve(null); };
        var tryPlace = function () { return findPlace().then(function (pl) { return pl ? matchPlan(r.img, r.w, r.h, mpp, pl.E, pl.N, 900).then(function (m) { return good(m) ? { m: m, name: pl.name } : null; }) : null; }); };
        tryView().then(function (x) { return x || tryPlace(); }).then(function (x) {
          if (!x) return fin(null);
          fin({ src: "match", E: x.m.E, N: x.m.N, txt: autoTxt("ov_autoMatch", { c: Math.round(Math.min(1, x.m.s) * 100) }) + (x.name ? " " + autoTxt("ov_autoPlace", { p: x.name }) : "") });
        }).catch(function () { fin(null); });
      }
      $("#kmOvAuto").addEventListener("click", function (e) {
        var b = e.target.closest("[data-oa]"); if (!b || !ovl) return; var k = b.dataset.oa;
        if (k === "ok") { ovl.conf = true; $("#kmOvAuto").hidden = true; $("#kmOvMsg").textContent = tt("ov_confirmed"); $("#kmOvMsg").className = "hint"; }
        else if (k === "no") { try { var o0 = JSON.parse(ov0); if (o0) ovl = o0; else ovl = null; } catch (x) { } $("#kmOvAuto").hidden = true; ovDraw(); refresh(); }
        else if (k === "ref") { $("#kmOvAuto").hidden = true; ovl.conf = false; $("[data-k=mgeo]").click(); }
      });
      $("#kmOvF").addEventListener("change", function (e) {
        var file = e.target.files[0]; if (!file) return; ovMsg("pl_reading");
        planSource(file).then(function (src) {
          var go = function (n) { return src.render(n).then(function (r) { setOvl(r, r.mpp); }); };
          if (src.pages > 1) { var pg = +(prompt(tt("pl_page") + " (1–" + src.pages + ")", "1") || 1); go(Math.min(Math.max(1, pg), src.pages)); } else go(1);
        }).catch(function () { ovMsg("pl_err", 1); });
      });
      var pb = $("#kmOvPlan"); pb.disabled = !(opt.planImg && opt.planImg.img);
      pb.addEventListener("click", function () { var P = opt.planImg; setOvl({ img: P.img, w: P.w, h: P.h, grid: P.grid || null, words: P.words || [] }, P.cal && P.cal.scale ? P.cal.scale : 0); ovl.ref = "plan"; });
      $("#kmOvO").addEventListener("input", function (e) { if (ovl) { ovl.op = e.target.value / 100; ovDraw(); } });
      var num2 = function (v) { return parseFloat(String(v).replace(",", ".")); };
      $("#kmOvR").addEventListener("change", function (e) { var v = num2(e.target.value); if (ovl && isFinite(v)) { ov0 = JSON.stringify(ovl); ovl.rot = v; ovDraw(); } });
      $("#kmOvS").addEventListener("change", function (e) { var v = num2(e.target.value); if (ovl && v > 0) { ov0 = JSON.stringify(ovl); ovl.mpp = v; ovl.auto = 0; ovDraw(); } });
    }
    wsLate(); dlg.showModal(); map.invalidateSize(); fitAll(); ovDraw(); refresh();
    if (!plan && opt.autoPlan && !ovl && opt.planImg && opt.planImg.img) { $("#kmOvPlan").click(); } (plan ? $("[data-k=mcal]") : $("#kmQ")).focus();
  }

  window.KARTE = { slopeLen: slopeLen, slopeOn: slopeOn, slopeHz: slopeHz, connOf: connOf, connTxt: connTxt, ovBase: ovBase, cfgOf: cfgOf, pipeList: pipeList, pipeTxt: pipeTxt, lineTxt: lineTxt, lineSync: lineSync, cfgMissing: cfgMissing, planGeo: planGeo, exportDlg: exportDlg, polyArea: polyArea, ovCorners: ovCorners, open: open, toast: toast, mapFigure: mapFigure, bgKey: bgKey, cacheBg: cacheBg, planSource: planSource, planPreview: planPreview, preview: preview, load: loadLeaflet, total: total, toLV95: toLV95, toWGS: toWGS, fmt: fmt };
})();
