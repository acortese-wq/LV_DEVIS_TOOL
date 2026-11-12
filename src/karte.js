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
  function lineSlopeS(l) {   /* Länge nach Abschnittsart: Gelände = Profil; Luft = Sehne (+ Durchhang); Bohrung = Sehne */
    var h = l && l.hz; if (!h) return null; if (l.hzArt === "luft" || l.hzArt === "bohr") {
      var a0 = parseFloat(String(l.hzH0).replace(",", ".")), a1 = parseFloat(String(l.hzH1).replace(",", ".")), ch = Math.hypot(h.L, (isFinite(a1) ? a1 : h.h1) - (isFinite(a0) ? a0 : h.h0));
      if (l.hzArt === "luft" && ch > 0) { var f = (parseFloat(String(l.hzF).replace(",", ".")) || 3.5) / 100 * ch; ch += 8 * f * f / (3 * ch); } return ch; }
    return h.S;
  }
  function slopeLen(pts, lines) { var sg = JSON.stringify(pts), l = null; if (slopeOn()) (lines || []).forEach(function (x) { if (!l && x.hz && x.hz.sig === sg) l = x; }); return l ? lineSlopeS(l) : lineLen(pts); }
  function total(lines) { return (lines || []).reduce(function (a, l) { return a + lineLen(l); }, 0); }
  function fmt(v) { return (Math.round(v * 10) / 10).toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

  /* Ein einziges WMS-Bild pro Kartenausschnitt statt Kacheln: keine Nähte/Versätze an Kachelgrenzen, Beschriftung nur einmal (Parzellenplan, OpenData AV) */
  /* WMS als ein Bild über dem Kartenausschnitt (+50 % Rand). Der Dienst «cadastralwebmap» ist ein weitergereichter Dienst: als kleine Kacheln liefert er
     gegeneinander verschobene Ausschnitte (Rückmeldung 07.11.2026) – darum ein zusammenhängendes Bild. Es wird nur neu geladen, wenn sich die Zoomstufe ändert
     oder der Ausschnitt den geladenen Bereich verlässt; Verschieben innerhalb des Randes lässt die Parzellen unverändert (kein Springen, kein leerer Rand). */
  /* Feder nach Apple-Modell («Designing Fluid Interfaces»): Dämpfungsverhältnis + Ansprechzeit, übernimmt die Loslass-Geschwindigkeit, jederzeit unterbrechbar (stop() liefert den aktuellen Wert);
     Projektion des Ruhepunkts aus der Geschwindigkeit und Gummiband am Rand. Bei «Bewegung reduzieren» springt der Wert direkt ans Ziel. */
  var SPRING = (function () {
    var reduce = function () { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
    function run(o) {
      var x = o.from, v = o.v || 0, to = o.to, rs = o.response || 0.35, k = Math.pow(2 * Math.PI / rs, 2), c = 4 * Math.PI * (o.damping == null ? 1 : o.damping) / rs, last = null, raf = 0, dead = false;
      if (reduce() || !isFinite(x) || !isFinite(to)) { o.step(to); if (o.done) o.done(to); return { stop: function () { return to; } }; }
      function tick(t) {
        if (dead) return; if (last == null) last = t; var dt = Math.min(0.032, Math.max(0.001, (t - last) / 1000)); last = t;
        var n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
        for (var i = 0; i < n; i++) { v += (-k * (x - to) - c * v) * h; x += v * h; }
        if (Math.abs(x - to) < 0.4 && Math.abs(v) < 8) { dead = true; o.step(to); if (o.done) o.done(to); return; }
        o.step(x); raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      return { stop: function () { dead = true; cancelAnimationFrame(raf); return x; } };
    }
    function project(v, d) { d = d || 0.998; return (v / 1000) * d / (1 - d); }   /* Ruhepunkt aus Geschwindigkeit (px/s), exponentielles Abklingen wie beim Scrollen */
    function rubber(over, dim, k) { k = k || 0.55; var a = Math.abs(over); return (over < 0 ? -1 : 1) * (a * dim * k) / (dim + k * a); }
    function vel(hist, key) { if (hist.length < 2) return 0; var a = hist[0], b = hist[hist.length - 1], dt = Math.max(16, b.t - a.t); if (performance.now() - b.t > 80) return 0; return (b[key] - a[key]) / dt * 1000; }   /* wer vor dem Loslassen anhält, wirft nicht */
    return { run: run, project: project, rubber: rubber, vel: vel };
  })();
  function viewWms(url, layers, o) {
    var V = L.Layer.extend({
      onAdd: function (m) { this._m = m; this._t = 0; this._bad = 0; this._cap = 2600; this._ever = false; m.on("moveend", this._soon, this); this._upd(); },
      onRemove: function (m) { m.off("moveend", this._soon, this); clearTimeout(this._d); this._t++; if (this._im) { m.removeLayer(this._im); this._im = null; } },
      _soon: function () { var me = this; clearTimeout(this._d); this._d = setTimeout(function () { if (me._m) me._upd(); }, 140); },   /* Zoomschritte bündeln: ein Bild pro Ruhepause statt je Schritt */
      _upd: function () {
        var m = this._m, me = this, z = m.getZoom(), vb = m.getBounds();
        if (o && o.minZoom && z < o.minZoom) { this._t++; if (this._im) { m.removeLayer(this._im); this._im = null; this._z = null; } if (o.gate) o.gate(false); return; }   /* zu weit weg: der Dienst liefert keine Parzellen, darunter bleibt die Landeskarte */
        if (o && o.gate) o.gate(true);
        if (this._im && this._z === z && this._ib && this._ib.contains(vb)) return;   /* Bild deckt den Ausschnitt noch ab */
        var sw = L.CRS.EPSG3857.project(vb.getSouthWest()), ne = L.CRS.EPSG3857.project(vb.getNorthEast()), dx = (ne.x - sw.x) / 2, dy = (ne.y - sw.y) / 2;
        sw = L.point(sw.x - dx, sw.y - dy); ne = L.point(ne.x + dx, ne.y + dy);
        var sz = m.getSize(), k = Math.min(2, window.devicePixelRatio || 1), W = Math.round(sz.x * 2 * k), H = Math.round(sz.y * 2 * k), cap = this._cap, f = Math.min(1, cap / Math.max(W, H)); W = Math.round(W * f); H = Math.round(H * f);
        var ib = L.latLngBounds(L.CRS.EPSG3857.unproject(sw), L.CRS.EPSG3857.unproject(ne)), t = ++this._t;
        var u = url + (url.indexOf("?") < 0 ? "?" : "&") + "SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=" + encodeURIComponent(layers) + "&STYLES=&SRS=EPSG:3857&BBOX=" + [sw.x, sw.y, ne.x, ne.y].map(function (v) { return v.toFixed(2); }).join(",") + "&WIDTH=" + W + "&HEIGHT=" + H + "&FORMAT=image/png&TRANSPARENT=TRUE";
        var img = new Image();
        img.onload = function () {
          if (t !== me._t || !me._m) return; me._bad = 0; me._ever = true;
          var ov = L.imageOverlay(u, ib, { pane: "tilePane", zIndex: 2, interactive: false, attribution: o && o.attr || "" }).addTo(me._m), old = me._im; me._im = ov; me._ib = ib; me._z = z; if (old) me._m.removeLayer(old);
        };
        /* Fehler beim Nachladen (Dienst überlastet, Bild zu gross): das bisherige Bild bleibt stehen, nach kurzer Pause mit kleinerem Bild nochmals versuchen; nur wenn nie ein Bild kam, auf die Ersatzebene wechseln */
        img.onerror = function () {
          if (t !== me._t || !me._m) return; me._bad++; me._cap = Math.max(900, Math.round(me._cap * 0.7));
          if (!me._ever && me._bad >= 2 && o && o.fail) { var f = o.fail; o.fail = null; f(); return; }   /* Dienst hat nie geliefert: wie bisher auf die Ersatzebene */
          if (me._bad >= 6) return;
          setTimeout(function () { if (t === me._t && me._m) { me._z = null; me._upd(); } }, 500 * me._bad);
        };
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
  /* Passpunkte → Ähnlichkeitstransformation (Helmert, 4 Parameter) nach kleinsten Quadraten; Restabweichungen je Punkt in m */
  function ovFit(o, P) {
    var n = P.length; if (n < 2) return null; if (n === 2) { var s0 = ovSolve(o, P[0].s, P[0].t, P[1].s, P[1].t); if (!s0) return null; s0.res = [0, 0]; s0.rms = 0; return s0; }
    var U = P.map(function (p) { return [p.s[0] - o.w / 2, o.h / 2 - p.s[1]]; }), mu = [0, 0], mt = [0, 0];
    U.forEach(function (u, i) { mu[0] += u[0] / n; mu[1] += u[1] / n; mt[0] += P[i].t[0] / n; mt[1] += P[i].t[1] / n; });
    var sa = 0, sb = 0, sq = 0; U.forEach(function (u, i) { var du = u[0] - mu[0], dv = u[1] - mu[1], de = P[i].t[0] - mt[0], dn = P[i].t[1] - mt[1]; sa += du * de + dv * dn; sb += du * dn - dv * de; sq += du * du + dv * dv; });
    if (!(sq > 0)) return null; var a = sa / sq, b = sb / sq, E = mt[0] - a * mu[0] + b * mu[1], N = mt[1] - b * mu[0] - a * mu[1];
    var res = U.map(function (u, i) { return Math.hypot(a * u[0] - b * u[1] + E - P[i].t[0], b * u[0] + a * u[1] + N - P[i].t[1]); });
    return { mpp: Math.hypot(a, b), rot: Math.atan2(b, a) * 180 / Math.PI, E: E, N: N, res: res, rms: Math.sqrt(res.reduce(function (s, r) { return s + r * r; }, 0) / Math.max(1, n - 2)) };
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
  var BGL = { farbe: "ch.swisstopo.pixelkarte-farbe", grau: "ch.swisstopo.pixelkarte-grau", luft: "ch.swisstopo.swissimage", luftstr: "ch.swisstopo.swissimage,ch.swisstopo.amtliches-strassenverzeichnis", kataster: "ch.kantone.cadastralwebmap-farbe" };
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
      var c = n.color || "#0b6b72", q = n.pts.map(px);
      if (n.type === "text") o2 += '<text x="' + f1(q[0][0]) + '" y="' + f1(q[0][1]) + '" font-size="' + ({ s: 10, m: 13, l: 19 }[n.size || "m"] * k) + '" font-weight="700" fill="' + c + '" stroke="#fff" stroke-width="' + 0.8 * k + '" paint-order="stroke">' + esc(n.text || "") + "</text>";
      else if (n.type === "rect") o2 += '<rect x="' + f1(Math.min(q[0][0], q[1][0])) + '" y="' + f1(Math.min(q[0][1], q[1][1])) + '" width="' + f1(Math.abs(q[0][0] - q[1][0])) + '" height="' + f1(Math.abs(q[0][1] - q[1][1])) + '" fill="' + c + '" fill-opacity=".08" stroke="' + c + '" stroke-width="' + 2 * k + '"/>';
      else { o2 += '<polyline points="' + q.map(function (p) { return f1(p[0]) + "," + f1(p[1]); }).join(" ") + '" fill="none" stroke="' + c + '" stroke-width="' + 2.5 * k * (n.type === "arrow" ? ({ s: 0.65, m: 1, l: 1.7 }[n.size || "m"] || 1) : 1) + '"/>';
        if (n.type === "arrow" && q.length > 1) { var a = q[0], b = q[q.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), s2 = 13 * k * ({ s: 0.65, m: 1, l: 1.7 }[n.size || "m"] || 1); o2 += '<polygon points="' + f1(b[0]) + "," + f1(b[1]) + " " + f1(b[0] - s2 * Math.cos(ang - 0.4)) + "," + f1(b[1] - s2 * Math.sin(ang - 0.4)) + " " + f1(b[0] - s2 * Math.cos(ang + 0.4)) + "," + f1(b[1] - s2 * Math.sin(ang + 0.4)) + '" fill="' + c + '"/>'; } }
    });
    var sym = function (arr, fn, key, nm, r0) {
      (arr || []).forEach(function (p, i) { var q = px(p), r = r0 * k; o2 += fn(q, r, i) + txt(q[0] + r + 2.5 * k, q[1] + 3 * k, lab[key] && lab[key][i]); });
    };
    sym(g.pts, function (q, r, i) { var ex = (g.pm || [])[i]; ex = ex && ex !== "neu";   /* bestehender Schacht (Anschluss/Deckel): weiss mit blauem Rand */
      return '<rect x="' + f1(q[0] - r) + '" y="' + f1(q[1] - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" fill="' + (ex ? "#fff" : "#0b6b72") + '" stroke="' + (ex ? "#0b6b72" : "#fff") + '" stroke-width="' + (ex ? 2 : 1.5) * k + '"/><text x="' + f1(q[0]) + '" y="' + f1(q[1] + 4 * k) + '" text-anchor="middle" font-size="' + 11 * k + '" font-weight="700" fill="' + (ex ? "#0b6b72" : "#fff") + '">' + (i + 1) + "</text>"; }, "pts", "", 9);
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
    var bb = box.bb, sc = box.sc, k = o.k || W / 360, px = function (p) { return [((p[0] - bb[0]) / sc), ((bb[3] - p[1]) / sc)]; };
    var fig = document.createElement("figure"); fig.className = o.cls || "kmprev";
    fig.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(tt("km_prevAlt")) + '"><rect width="' + W + '" height="' + H + '" fill="#eef1f3"/><rect width="' + W + '" height="' + H + '" fill="#fff"/>' + ((o.base === "leer" || (o.base === "av" && !avCfg().u)) ? "" : '<image href="' + esc(o.bg || bgUrl(box, o.base)) + '" width="' + W + '" height="' + H + '"/>' + (o.pale ? '<rect width="' + W + '" height="' + H + '" fill="#fff" fill-opacity="' + o.pale + '"/>' : "")) + overlaySvg(o.overlay, px) + dxfSvg(o.dxf, px, sc, W, H) + geoSvg(g, px, k, { labels: o.labels }) + '</svg><figcaption>' + esc(o.cap || "") + (o.dxf && o.dxf.it ? " · DXF: " + esc(o.dxf.name || "") : "") + (o.base === "kataster" ? " · © geo.admin.ch / Kantone (Amtliche Vermessung)" : " · © swisstopo") + "</figcaption>";
    var im = fig.querySelector("image"); im.addEventListener("error", function () { im.remove(); });
    return fig;
  }
  /* DXF-Hintergrund im Bericht: sichtbare Layer, nur was im Ausschnitt liegt; Texte massstäblich */
  function dxfSvg(D, px, sc, W, H) {
    if (!D || !D.it || !D.lay) return ""; var colOf = function (s) { var L0 = D.lay[s.l] || {}; return (L0.fc ? L0.c : s.c || L0.c) || "#7b2cbf"; }, o = "", n = 0, inb = function (q) { return q[0] > -50 && q[0] < W + 50 && q[1] > -50 && q[1] < H + 50; };
    D.it.forEach(function (s) { if (n > 6000 || !D.lay[s.l] || !D.lay[s.l].on) return;
      if (s.t) { var q = px(s.p), fs = (s.h || 0.25) / sc; if (fs < 2.2 || !inb(q)) return; n++;
        o += '<text x="' + q[0].toFixed(1) + '" y="' + q[1].toFixed(1) + '" font-size="' + fs.toFixed(1) + '" fill="' + esc(colOf(s)) + '" font-family="Arial,sans-serif" text-anchor="' + ["start", "middle", "end"][s.ah || 0] + '" dominant-baseline="' + ["alphabetic", "central", "hanging"][s.av || 0] + '"' + (s.r ? ' transform="rotate(' + (-s.r) + " " + q[0].toFixed(1) + " " + q[1].toFixed(1) + ')"' : "") + ">" + esc(s.t) + "</text>"; return; }
      var P = s.p.map(px); if (!P.some(inb)) return; n++;
      var LY = D.lay[s.l]; o += '<polyline points="' + P.map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ") + '" fill="none" stroke="' + esc(colOf(s)) + '" stroke-width="' + ((LY.w || 1.3) * 0.55).toFixed(2) + '"' + (LY.d ? ' stroke-dasharray="4 3"' : "") + ' stroke-opacity=".85"/>'; });
    return o ? '<g class="dxfbg">' + o + "</g>" : "";
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
    var t = document.createElement("div"); t.className = "kmtoast" + (slot ? " in" : "") + (/^[⚠⛔]/.test(msg) ? " warn" : ""); t.setAttribute("role", "status");
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
  /* Plankopf mit Zentrumskoordinate (z. B. Swisscom Geo-Portal / Netzauskunft, Werkleitungsauskünfte): «Zentrumskoordinate 2759580 / 1191179» (LV95, LV03 wird umgerechnet) */
  function planCenter(txt) {
    if (!/Zentrumskoordinate|Zentrum(?:s)?koord|Kartenmitte|Coordonn[ée]es? (?:du )?centre|Coordinat[ae] (?:del )?centr|Cent(?:re|er) coordinate/i.test(txt)) return null;
    var num = function (x) { return parseFloat(String(x).replace(/['\u2019\s]/g, "").replace(",", ".")); };
    var m = /(2['\u2019 ]?[4-8]\d{2}['\u2019 ]?\d{3}(?:[.,]\d+)?)\s*[\/,;]\s*(1['\u2019 ]?[0-3]\d{2}['\u2019 ]?\d{3}(?:[.,]\d{1,3}(?!\d))?)/.exec(txt);   /* LV95 (genau 7 Stellen; folgender Text kann direkt anschliessen): E / N; Werte stehen im Plankopf oft getrennt von der Bezeichnung, teils direkt an andere Zahlen angehängt */
    if (m) return [num(m[1]), num(m[2])];
    m = /(?:^|[^\d.])([4-8]\d{2}['\u2019 ]?\d{3}(?:[.,]\d+)?)\s*[\/,;]\s*([0-3]\d{2}['\u2019 ]?\d{3}(?:[.,]\d+)?)(?!\d)/.exec(txt);   /* LV03 */
    if (m) { var e = num(m[1]), n = num(m[2]); if (e > 4.4e5 && e < 9e5 && n > 4e4 && n < 4e5) return [e + 2e6, n + 1e6]; }
    return null;
  }
  /* Kartenrahmen: äusserste dunkle Linien, die mehr als 55 % der Breite/Höhe durchlaufen → [x0,y0,x1,y1] in Pixeln */
  function frameBox(c) {
    var w = c.width, h = c.height, st = Math.max(1, Math.round(Math.max(w, h) / 1600)), d = c.getContext("2d").getImageData(0, 0, w, h).data, dk = function (x, y) { var i = (y * w + x) * 4; return d[i] + d[i + 1] + d[i + 2] < 330; };
    var rows = [], cols = [], y, x, n;
    for (y = 0; y < h; y += 1) { n = 0; for (x = 0; x < w; x += st) if (dk(x, y)) n++; if (n * st > 0.55 * w) rows.push(y); }
    for (x = 0; x < w; x += 1) { n = 0; for (y = 0; y < h; y += st) if (dk(x, y)) n++; if (n * st > 0.55 * h) cols.push(x); }
    if (rows.length < 2 || cols.length < 2) return null; var y0 = rows[0], y1 = rows[rows.length - 1], x0 = cols[0], x1 = cols[cols.length - 1];
    return (x1 - x0) > 0.5 * w && (y1 - y0) > 0.5 * h ? [x0, y0, x1, y1] : null;
  }
  /* file -> Promise<{pages, render(n)->Promise<{img,w,h,ratio,mpp}>}> */
  function planSource(file) {
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      return loadPdfJs().then(function () { return file.arrayBuffer(); }).then(function (buf) { return window.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise; }).then(function (doc) {
        return { pages: doc.numPages, render: function (n) {
          return doc.getPage(n).then(function (pg) {
            var v1 = pg.getViewport({ scale: 1 }), sc = Math.min(MAXPX / Math.max(v1.width, v1.height), Math.sqrt(MAXAREA / (v1.width * v1.height))), vp = pg.getViewport({ scale: sc }), c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
            return pg.render({ canvasContext: c.getContext("2d"), viewport: vp, background: "#fff" }).promise.then(function () {
              var r = { img: jpeg(c), w: c.width, h: c.height };
              return pg.getTextContent().then(function (tc) {
                var txt = tc.items.map(function (i) { return i.str; }).join(""), N = detectRatio(txt, file.name);
                if (N) { r.ratio = N; r.mpp = 0.0003528 * N / sc; }   /* 1 pt = 0.3528 mm */
                try { r.grid = gridFromItems(tc.items, vp, sc, r.mpp || 0); r.words = planWords(txt.replace(/ {2,}/g, " ")); } catch (e) { r.grid = null; r.words = []; }
                try { var zc = planCenter(txt); if (zc && r.mpp) { var fr = frameBox(c); r.center = { E: zc[0], N: zc[1], fx: fr ? (fr[0] + fr[2]) / 2 : c.width / 2, fy: fr ? (fr[1] + fr[3]) / 2 : c.height / 2, fr: !!fr, gp: /Geo-?Portal|Netzauskunft|Auskunftnummer/i.test(txt) }; } } catch (e) { }
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
        else if (it[0] === "l") sy = '<line x1="' + (x - 2.5) + '" y1="' + y + '" x2="' + (x + 2.5) + '" y2="' + y + '" stroke="#b8332a" stroke-width=".8"/>'; else if (it[0] === "s") sy = '<rect x="' + (x - 1.8) + '" y="' + (y - 1.8) + '" width="3.6" height="3.6" fill="#0b6b72"/>'; else if (it[0] === "o") sy = '<circle cx="' + x + '" cy="' + y + '" r="1.9" fill="#8a5b00"/>';
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
      '<span id="exBaseW">' + sel("exBase", tt("ex_base"), [["farbe", tt("km_bFarbe")], ["grau", tt("km_bGrau")], ["luft", tt("km_aerial")], ["luftstr", tt("km_aerialStr")], ["kataster", tt("km_bKat")], ["av", tt("km_bAV")], ["none", tt("ex_noBase")]]) + "</span></div>" +
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
    var PROV = { swisstopo: [["farbe", "km_bFarbe"], ["grau", "km_bGrau"], ["luft", "km_aerial"], ["luftstr", "km_aerialStr"]], geoadmin: [["kataster", "km_bKat"], ["av", "km_bAV"], ["leer", "km_bLeer"], ["viewer", "km_bViewer"]] };
    try { var sb = localStorage.getItem("lvd-km-base"); if (sb && ["farbe", "grau", "luft", "luftstr", "kataster", "leer", "av"].indexOf(sb) >= 0) base = sb; } catch (e) { }
    var provOf = function (b) { return PROV.geoadmin.some(function (o) { return o[0] === b; }) ? "geoadmin" : "swisstopo"; };
    M.sond = M.sond || []; M.notes = M.notes || []; M.areas = M.areas || []; M.wl = M.wl || []; M.geb = M.geb || [];
    var LY = plan ? null : (opt.layoutA || null), lyEdited = false, lyTarget = null, lyD = { t: "kost", c: false };   /* Layout A «Planungsfokus» (Startbildschirm) */
    if (LY) { var sbSet = false; try { sbSet = !!localStorage.getItem("lvd-km-base"); } catch (e) { } if (!sbSet) base = "kataster"; }   /* Planungsfokus startet mit dem Parzellenplan (V119); eigene Wahl geht vor */
    if (LY) try { var ld0 = JSON.parse(localStorage.getItem("lvd-ly-dock") || "null"); if (ld0 && typeof ld0 === "object") { if (["prof", "aus", "kost", "pos", "offen", "warn"].indexOf(ld0.t) >= 0) lyD.t = ld0.t; lyD.c = !!ld0.c; } } catch (e) { }
    /* Schmale Bildschirme (861–1100 px): unterer Bereich startet eingeklappt, damit die Karte Platz hat; eigene Wahl dort gemerkt (lvd-ly-dockn), breite Bildschirme unverändert */
    var lyNq = window.matchMedia ? window.matchMedia("(min-width:861px) and (max-width:1100px)") : { matches: false }, lyWideC = lyD.c;
    var lyNarC = function () { try { var n = JSON.parse(localStorage.getItem("lvd-ly-dockn") || "null"); if (n && typeof n === "object") return !!n.c; } catch (e) { } return true; };
    if (LY && lyNq.matches) lyD.c = lyNarC();
    var cal = plan ? JSON.parse(JSON.stringify(opt.plan.cal || {})) : null;
    var AD = plan ? { ll: function (p) { return [-p[1], p[0]]; }, pt: function (ll) { return [Math.round(ll.lng * 10) / 10, Math.round(-ll.lat * 10) / 10]; },
      dist: function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) * (cal.scale || 0); } }
      : { ll: function (p) { return toWGS(p[0], p[1]); }, pt: function (ll) { return toLV95(ll.lat, ll.lng).map(function (v) { return Math.round(v * 100) / 100; }); },
        dist: function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    var lastCmd = null, stl = "std", LBL_Z = 17, lblWas = null; try { var stl0 = localStorage.getItem("lvd-km-style"); if (["std", "zoom", "min"].indexOf(stl0) >= 0) stl = stl0; } catch (e) { }   /* Anzeige-Stil: Beschriftung immer / nach Zoomstufe / aus */
    function labelsOn() { return showLbl && stl !== "min" && (stl !== "zoom" || !map || map.getZoom() >= LBL_Z); }
    var PARZ_MINZ = 15, parzGate = false;   /* Parzellenplan erst ab dieser Zoomstufe (weiter weg zeigt der Dienst nichts); darunter graue Landeskarte */
    var lastCfg = { rt: {}, art: "kies", fl: "", T: "", B: "", ab: "" }, wlT = "sg", lastTyp = null, folded = {}, lastSel = null;
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
      (plan ? "" : '<button type="button" class="btn small" data-k="route" aria-pressed="false" aria-haspopup="dialog">' + esc(tt("km_rt_btn")) + "</button>" +
        '<button type="button" class="btn small" data-k="dxfin" aria-haspopup="dialog">' + esc(tt("km_dxfIn")) + '</button><input type="file" id="kmDxfF" accept=".dxf,application/dxf,image/vnd.dxf,.pdf,application/pdf" hidden>') +
      "</div>" +
      '<div class="kmgrp" role="group" aria-label="' + esc(tt("km_g_note")) + '"><span class="kmgl" aria-hidden="true">' + esc(tt("km_g_note")) + "</span>" +
      '<button type="button" class="btn small" data-k="mtext" aria-pressed="false">' + esc(tt("km_nText")) + "</button>" +
      '<button type="button" class="btn small" data-k="marrow" aria-pressed="false">' + esc(tt("km_nArrow")) + "</button>" +
      '<button type="button" class="btn small" data-k="msline" aria-pressed="false">' + esc(tt("km_nLine")) + "</button>" +
      '<button type="button" class="btn small" data-k="mrect" aria-pressed="false">' + esc(tt("km_nRect")) + "</button>" +
      '<label class="kmbl" for="kmCol">' + esc(tt("km_col")) + '</label><select id="kmCol">' + COL.map(function (c) { return '<option value="' + c[0] + '">' + esc(tt(c[1])) + "</option>"; }).join("") + "</select>" + "</div>" +
      '<div class="kmgrp" role="group" aria-label="' + esc(tt("km_g_edit")) + '"><span class="kmgl" aria-hidden="true">' + esc(tt("km_g_edit")) + "</span>" +
      '<button type="button" class="btn small" data-k="medit" aria-pressed="false">' + esc(tt("km_edit")) + "</button>" +
      '<div class="kmeop" id="kmEop" role="group" aria-label="' + esc(tt("eo_t")) + '" hidden>' + ["pt", "line", "ins", "del", "seg", "split", "join"].map(function (k) { return '<button type="button" class="btn ghost small kmtgl" data-eop="' + k + '" aria-pressed="false" title="' + esc(tt("eo_" + k + "_t")) + '">' + esc(tt("eo_" + k)) + "</button>"; }).join("") + "</div>" +
      '<button type="button" class="btn small" data-k="mruler" aria-pressed="false">' + esc(tt("km_ruler")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="undo">' + esc(tt("km_undo")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="redo" title="Strg+Y">' + esc(tt("km_redo")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="end">' + esc(tt("km_end")) + "</button>" +
      '<button type="button" class="btn ghost small del" data-k="clear">' + esc(tt("km_clear")) + "</button>" +
      '<label class="kmbl" for="kmStep">' + esc(tt("km_step")) + '</label><input type="text" inputmode="decimal" id="kmStep" class="kmn" value="1"></div>' +
      '<div class="kmgrp" role="group" aria-label="' + esc(tt("km_g_view")) + '"><span class="kmgl" aria-hidden="true">' + esc(tt("km_g_view")) + "</span>" +
      '<button type="button" class="btn ghost small" data-k="fit">' + esc(tt("km_fit")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="center">' + esc(tt("km_center")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="lbl" aria-pressed="true">' + esc(tt("km_lbl")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="band" aria-pressed="true" title="' + esc(tt("km_bandT")) + '">' + esc(tt("km_band")) + "</button>" +
      '<label class="kmbl" for="kmStl">' + esc(tt("km_stl")) + '</label><select id="kmStl">' + [["std", "km_stl_std"], ["zoom", "km_stl_zoom"], ["min", "km_stl_min"]].map(function (o) { return '<option value="' + o[0] + '">' + esc(tt(o[1])) + "</option>"; }).join("") + "</select>" +
      (plan ? "" : '<button type="button" class="btn ghost small" data-k="sv">' + esc(tt("km_sv")) + '</button><button type="button" class="btn ghost small" data-k="svkey" title="' + esc(tt("km_sv_keyHint")) + '">' + esc(tt("km_sv_key")) + "</button>") +
      (plan ? "" : '<span class="kmseg" role="group" aria-label="' + esc(tt("km_prov")) + '"><button type="button" class="btn small" data-prov="swisstopo" aria-pressed="false">swisstopo</button><button type="button" class="btn small" data-prov="geoadmin" aria-pressed="false">geo.admin.ch</button></span><label class="kmbl" for="kmBase">' + esc(tt("km_src")) + '</label><select id="kmBase"></select><button type="button" class="btn ghost small" data-k="geo">' + esc(tt("km_geo")) + '</button><span id="kmAv" hidden><input type="url" id="kmAvUrl" class="kmavin" aria-label="' + esc(tt("km_avUrl")) + '" placeholder="https://…/wms"><input type="text" id="kmAvLy" class="kmavin" aria-label="' + esc(tt("km_avLy")) + '" placeholder="' + esc(tt("km_avLy")) + '"><button type="button" class="btn small" id="kmAvGo">' + esc(tt("km_avGo")) + '</button></span><a class="btn ghost small" id="kmNetz" href="https://www.swisscom.ch/rida/online/geoportal/ng/index.html?login" target="_blank" rel="noopener noreferrer">' + esc(tt("km_netz")) + "</a>") + "</div></div>" +
      (plan ? '<form class="kmcalf" id="kmCalF" hidden><label for="kmCalM">' + esc(tt("pl_calAsk")) + '</label><input type="text" inputmode="decimal" id="kmCalM" class="numin"><button type="submit" class="btn small">' + esc(tt("pl_calSet")) + "</button></form>" : "") +
      '<div class="kmmain"><div class="kmleft">' +
      '<div id="kmMap" class="kmmap" tabindex="0" role="application" aria-label="' + esc(tt("km_mapLbl")) + '"></div><div class="kmask" id="kmAsk" hidden role="group"></div><div class="kmask kmctx" id="kmCtx" hidden role="group"></div><div class="kmprops" id="kmProps" hidden role="dialog"></div><div class="kmprops kmsv" id="kmSv" hidden role="dialog"></div>' +
      (plan ? "" : '<iframe id="kmView" class="kmframe" hidden title="map.geo.admin.ch" referrerpolicy="no-referrer"></iframe>') +
      '<div class="kmmsb" id="kmMsb" role="group" aria-label="' + esc(tt("ms_t")) + '" hidden><span id="kmMsN" role="status"></span>' +
        '<label>' + esc(tt("ms_x")) + ' <input id="kmMsX" type="text" inputmode="decimal" value="2" size="4"></label><label>' + esc(tt("ms_y")) + ' <input id="kmMsY" type="text" inputmode="decimal" value="0" size="4"></label>' +
        '<button type="button" class="btn small" data-ms="join" title="' + esc(tt("ms_join_t")) + '">' + esc(tt("ms_join")) + '</button><button type="button" class="btn small" data-ms="copy" title="' + esc(tt("ms_copy_t")) + '">' + esc(tt("ms_copy")) + '</button><button type="button" class="btn small" data-ms="par" title="' + esc(tt("ms_par_t")) + '">' + esc(tt("ms_par")) + '</button>' +
        '<button type="button" class="btn ghost small del" data-ms="del">' + esc(tt("ms_del")) + '</button><button type="button" class="btn ghost small" data-ms="clr">' + esc(tt("ms_clr")) + "</button></div>" +
      (plan ? "" : '<div class="kmroute" id="kmRoute" role="group" aria-label="' + esc(tt("km_rt_t")) + '" hidden><p class="kmrt-t"><b>' + esc(tt("km_rt_t")) + '</b></p>' +
        ["A", "B"].map(function (k) { return '<div class="kmrt-f"><label for="kmRt' + k + '">' + esc(tt(k === "A" ? "km_rt_from" : "km_rt_to")) + '</label><span class="kmrt-in"><input id="kmRt' + k + '" type="text" autocomplete="off" placeholder="' + esc(tt("km_rt_ph")) + '"><button type="button" class="btn ghost small" id="kmRtP' + k + '" aria-pressed="false" title="' + esc(tt(k === "A" ? "km_rt_pickA" : "km_rt_pickB")) + '" aria-label="' + esc(tt(k === "A" ? "km_rt_pickA" : "km_rt_pickB")) + '">📍 ' + esc(tt("km_rt_pick")) + '</button></span><ul class="kmrt-h" id="kmRt' + k + 'h"></ul></div>'; }).join("") +
        '<div class="kmbar"><button type="button" class="btn small" id="kmRtGo" disabled>' + esc(tt("km_rt_go")) + '</button> <button type="button" class="btn small" id="kmRtStr" hidden>' + esc(tt("km_rt_straight")) + '</button> <button type="button" class="btn ghost small" id="kmRtX">' + esc(tt("km_rt_close")) + '</button></div><p class="hint" id="kmRtMsg" role="status" aria-live="polite">' + esc(tt("km_rt_hint")) + "</p></div>") +
      '<div class="kmpal" id="kmPal" role="group" aria-label="' + esc(tt("pal_t")) + '" hidden></div>' +
      '<div class="kmleg" id="kmLeg" hidden></div>' +
      (plan ? "" : '<section class="kmprof" id="kmProf" hidden aria-label="' + esc(tt("pf_title")) + '"></section>') +
      '<p class="hint kmhelp" id="kmHelp"></p>' +
      '<p class="hint kmunits" id="kmUnits"></p></div>' +
      '<div class="kmright"><div class="kmquick" id="kmQuick" hidden role="group" aria-label="' + esc(tt("km_lt_title")) + '"></div><h3 class="kmoh">' + esc(tt("km_obj")) + '</h3><div class="kmbar"><button type="button" class="btn ghost small" id="kmFoldAll" hidden></button></div><div class="kmobj" id="kmObj" role="group" aria-label="' + esc(tt("km_obj")) + '"></div>' + '<details class="kmmiss" id="kmMiss" hidden><summary></summary><ul class="kmmissl"></ul></details>' +
      (plan ? "" : '<details class="kmcat" id="kmCat"><summary>' + esc(tt("km_cat")) + '</summary><div class="kmcatb"><p class="hint kmtel">' + esc(tt("km_catTel")) + '</p><div class="kmchips" id="kmChips" role="group" aria-label="' + esc(tt("km_catChips")) + '" hidden></div><label for="kmCatQ">' + esc(tt("km_catSearch")) + '</label><input type="search" id="kmCatQ" autocomplete="off" placeholder="' + esc(tt("km_catPh")) + '"><p class="hint" id="kmCatMsg" role="status"></p><ul class="kmcatl" id="kmCatL" aria-label="' + esc(tt("km_catRes")) + '"></ul><h3 class="kmcath">' + esc(tt("km_catSel")) + '</h3><ul class="kmcatl kmcats" id="kmCatS"></ul></div></details>') +
      (plan ? "" : '<details class="kmcat kmdxfd" id="kmDxfD" open hidden><summary>' + esc(tt("km_dxfBg")) + '</summary><div class="kmcatb" id="kmDxfB"></div></details>') +
      (plan ? "" : '<details class="kmcat kmovd" id="kmOvD"><summary>' + esc(tt("ov_title")) + '</summary><div class="kmcatb"><p class="hint">' + esc(tt("ov_hint")) + '</p>' +
        '<label for="kmOvF">' + esc(tt("pl_file")) + '</label><input type="file" id="kmOvF" accept=".pdf,application/pdf,image/*"><p class="hint" id="kmOvMsg" role="status"></p><div class="kmovauto" id="kmOvAuto" hidden><p class="hint" id="kmOvAutoT"></p><div class="kmbar"><button type="button" class="btn small" data-oa="ok">' + esc(tt("ov_confirm")) + '</button><button type="button" class="btn ghost small" data-oa="ref">' + esc(tt("ov_refine")) + '</button><button type="button" class="btn ghost small del" data-oa="no">' + esc(tt("ov_discard")) + '</button></div></div>' +
        '<div class="kmbar"><button type="button" class="btn small" id="kmOvPlan">' + esc(tt("ov_fromPlan")) + '</button><button type="button" class="btn small" data-k="mgeo" aria-pressed="false">' + esc(tt("ov_geo")) + '</button><button type="button" class="btn small" data-ov="tr" id="kmOvTr">' + esc(tt("ov_tr")) + '</button><button type="button" class="btn ghost small" data-ov="c">' + esc(tt("ov_center")) + '</button><button type="button" class="btn ghost small del" data-ov="x">' + esc(tt("km_catRemove")) + '</button></div><div class="kmgcp-l" id="kmGcp" role="group" aria-label="' + esc(tt("ov_geo")) + '" hidden></div>' +
        '<div class="kmbar kmovc"><label class="kmbl" for="kmOvO">' + esc(tt("km_opacity")) + '</label><input type="range" id="kmOvO" min="10" max="100" step="10" value="60"><label class="kmbl" for="kmOvR">' + esc(tt("ov_rot")) + '</label><input type="text" inputmode="decimal" id="kmOvR" class="kmn"><label class="kmbl" for="kmOvS">' + esc(tt("ov_mpp")) + '</label><input type="text" inputmode="decimal" id="kmOvS" class="kmn">' +
        '<span class="kmnudge" role="group" aria-label="' + esc(tt("ov_adj")) + '">' + [["l", "←", "km_nl"], ["u", "↑", "km_nu"], ["d", "↓", "km_nd"], ["r", "→", "km_nr"], ["rl", "⟲", "ov_rl"], ["rr", "⟳", "ov_rr"], ["sm", "−", "ov_sm"], ["sp", "+", "ov_sp"]].map(function (a) { return '<button type="button" class="btn ghost small" data-ov="' + a[0] + '" aria-label="' + esc(tt(a[2])) + '">' + a[1] + "</button>"; }).join("") + '</span></div></div></details>') +
      '</div></div>' +
      '<div class="kmslot" id="kmSlot"></div>' +
      '<div class="kmfoot"><p class="kmcostf" id="kmCostF" role="status" aria-live="polite"></p><p class="kmlen" id="kmLen" role="status" aria-live="polite"></p><p class="kmcost" id="kmCost" role="status"></p><button type="button" class="btn ghost" data-k="save" title="' + esc(tt("km_save_t")) + '">' + esc(tt("km_save")) + "</button>" + '<button type="button" class="btn" data-k="apply">' + esc(tt("km_apply")) + "</button></div>";
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
      tools.appendChild(grp(tt("ws_sel"), ["medit", "#kmEop"]));
      tools.appendChild(grp(tt("ws_draw"), ["mcal", "mline", "mpt", "mwl", "#kmWlT", "mgeb", "route", "dxfin", "#kmDxfF", "msond", "marea"]));
      tools.appendChild(grp(tt("ws_note"), ["mtext", "marrow", "msline", "mrect", "label[for=kmCol]", "#kmCol"]));
      tools.appendChild(grp(tt("ws_measure"), ["mruler", "undo", "redo", "end", "clear", "label[for=kmStep]", "#kmStep"]));
      /* Kopf: Titel, Suche, Knöpfe */
      if (srch) { var sw = E("div", "kmsw"); sw.appendChild(srch); if (hits) sw.appendChild(hits); head.insertBefore(sw, head.children[1]); }
      var calF = $("#kmCalF"); if (calF) canvas.insertBefore(calF, canvas.firstChild);
      if (slot) canvas.appendChild(slot);
      /* Mitte: Ebenen, Marker, Hilfe */
      var h1 = E("h3", "kmph", esc(tt("ws_layers"))); mid.appendChild(h1);
      ["#kmCat", "#kmDxfD", "#kmOvD"].forEach(function (q) { var n = pick(q); if (n) mid.appendChild(n); });
      mid.appendChild(E("h3", "kmph", esc(tt("ws_marker")))); mid.appendChild(E("p", "hint", esc(tt("ws_markerHint")))); mid.appendChild(E("div", "kmmk", "")).id = "kmMk";
      if (intro) mid.appendChild(intro);
      /* Rechts: Eigenschaften | Auswertung */
      var tabs = E("div", "kmtabs"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", tt("ws_props") + " / " + tt("ws_eval"));
      tabs.innerHTML = '<button type="button" role="tab" id="kmTabP" aria-selected="true" aria-controls="kmPanP">' + esc(tt("ws_props")) + '</button><button type="button" role="tab" id="kmTabE" aria-selected="false" aria-controls="kmPanE" tabindex="-1">' + esc(tt("ws_eval")) + "</button>";
      var panP = E("div", "kmpan"), panE = E("div", "kmpan"); panP.id = "kmPanP"; panE.id = "kmPanE"; panP.setAttribute("role", "tabpanel"); panE.setAttribute("role", "tabpanel"); panP.setAttribute("aria-labelledby", "kmTabP"); panE.setAttribute("aria-labelledby", "kmTabE"); panE.hidden = true;
      ["#kmQuick", ".kmoh", "#kmFoldAll", "#kmObj", "#kmMiss"].forEach(function (q) { var n = pick(q); if (n) { if (q === "#kmFoldAll") n = n.parentNode; panP.appendChild(n); } });
      panP.insertBefore(E("section", "kmsum", ""), panP.firstChild); panP.firstChild.id = "kmSum"; panP.firstChild.setAttribute("aria-label", tt("km_sum_h"));
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
      { var hb0 = head.querySelector(".kmheadb"); if (hb0) { var hq = E("button", "btn ghost small", "?"); hq.type = "button"; hq.setAttribute("data-hpk", ""); hq.setAttribute("aria-label", tt("hp_ctx")); hq.setAttribute("title", tt("hp_ctx")); hb0.insertBefore(hq, hb0.firstChild); hq.addEventListener("click", function () { if (window.__LVHELP) window.__LVHELP.open(!plan && PF.on ? "prof" : "map"); }); } }
      if (!plan) { var hb = head.querySelector(".kmheadb"); if (hb) { var pb = E("button", "btn ghost small", esc(tt("pf_btn"))); pb.type = "button"; pb.setAttribute("data-pfb", ""); pb.setAttribute("aria-pressed", "false"); hb.insertBefore(pb, hb.firstChild); } }
      var tog = E("button", "btn ghost small kmmidtog", esc(tt("ws_layers"))); tog.type = "button"; tog.setAttribute("aria-expanded", "false"); tog.addEventListener("click", function () { var o = grid.classList.toggle("kmmid-open"); tog.setAttribute("aria-expanded", o ? "true" : "false"); }); head.insertBefore(tog, head.children[1]);
      grid.appendChild(tools); grid.appendChild(mid); grid.appendChild(canvas); grid.appendChild(side); canvas.classList.add("kmcanvas");
      [tool, main, right].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
      dlg.appendChild(grid); dlg.appendChild(bottom);
      if (LY) (function () {   /* Layout A: App-Leiste (Ansichten), Projektleiste mit Kennzahlen, unteres Dock */
        dlg.classList.add("kmlya", "kmmax"); var t0 = $("#kmTitle"); if (t0) { t0.textContent = tt("ly_app"); t0.insertAdjacentHTML("afterbegin", '<svg class="nc-logo" viewBox="0 0 160 160" aria-hidden="true" focusable="false"><rect width="160" height="160" rx="16" fill="#0b5561"/><path d="M0 16a16 16 0 0 1 16-16h128a16 16 0 0 1 16 16v18H0z" fill="#00a3ad"/><path d="M34 46h92l-10 96H44z" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><circle cx="80" cy="96" r="29" fill="#fff"/><path d="M69 110V82h5l12 18V82h5v28h-5L74 92v18z" fill="#0b5561"/></svg>'); }
        var thm = "dark"; try { thm = localStorage.getItem("lvd-theme") || "dark"; } catch (e) { } dlg.classList.toggle("nc-dark", thm === "dark");   /* Engineering-Thema (UI-Einstellung, nicht im Projekt) */
        var hb2 = head.querySelector(".kmheadb"), nav = E("nav", "lynav"); nav.setAttribute("aria-label", tt("ly_views"));
        nav.innerHTML = [["map", "ly_vMap"], ["proj", "ly_vProj"], ["rec", "ly_vRec"], ["res", "ly_vRes"], ["rep", "ly_vRep"]].map(function (a) { return '<button type="button" class="btn ghost small" data-ly="' + a[0] + '"' + (a[0] === "map" ? ' aria-current="page"' : "") + ">" + esc(tt(a[1])) + "</button>"; }).join("");
        head.insertBefore(nav, hb2);
        var lg = E("div", "lylang"); lg.setAttribute("role", "group"); lg.setAttribute("aria-label", tt("ly_lang"));   /* Sprache auch im Planungsfokus */
        lg.innerHTML = ["de", "fr", "it", "en"].map(function (c) { return '<button type="button" class="btn ghost small" data-lylang="' + c + '" aria-pressed="' + (c === (LY.lang || opt.lang) ? "true" : "false") + '" lang="' + c + '">' + c.toUpperCase() + "</button>"; }).join("");
        hb2.insertBefore(lg, hb2.firstChild);
        var tb = E("button", "btn ghost small nc-theme", dlg.classList.contains("nc-dark") ? "☀" : "☾"); tb.type = "button"; tb.setAttribute("data-nctheme", ""); tb.setAttribute("aria-pressed", dlg.classList.contains("nc-dark") ? "true" : "false"); tb.setAttribute("aria-label", tt("ly_themeD")); tb.title = tt("ly_themeD");
        tb.addEventListener("click", function () { var d = !dlg.classList.contains("nc-dark"); dlg.classList.add("nc-fade"); setTimeout(function () { dlg.classList.remove("nc-fade"); }, 320); dlg.classList.toggle("nc-dark", d); tb.textContent = d ? "☀" : "☾"; tb.setAttribute("aria-pressed", d ? "true" : "false"); try { localStorage.setItem("lvd-theme", d ? "dark" : "light"); } catch (e) { } });
        hb2.insertBefore(tb, lg.nextSibling);
        (function () {   /* Phase G: Bedienmodi Einfach/Standard/Experte (UI-Einstellung lvd-uimode, nicht im Projekt) + Befehlsleiste Strg+K */
          var md = "s"; try { md = localStorage.getItem("lvd-uimode") || "s"; } catch (e) { } if (["e", "s", "x"].indexOf(md) < 0) md = "s";
          var setMode = function (m) { md = m; dlg.classList.toggle("nc-m-e", m === "e"); dlg.classList.toggle("nc-m-x", m === "x"); try { localStorage.setItem("lvd-uimode", m); } catch (e) { }
            var ms = dlg.querySelector("#lyMode"); if (ms) ms.value = m;
            if (m === "e" && ["prof", "aus", "pos"].indexOf(lyD.t) >= 0) { lyD.t = "kost"; setTimeout(lyDock, 0); } };
          var sm = E("select", "lymode"); sm.id = "lyMode"; sm.setAttribute("aria-label", tt("ly_mode")); sm.title = tt("ly_mode");
          sm.innerHTML = [["e", "ly_mE"], ["s", "ly_mS"], ["x", "ly_mX"]].map(function (o) { return '<option value="' + o[0] + '">' + esc(tt(o[1])) + "</option>"; }).join("");
          sm.addEventListener("change", function () { setMode(sm.value); toast(dlg, tt("ly_mode") + ": " + sm.options[sm.selectedIndex].text); });
          var kb = E("button", "btn ghost small lycmdk-b", '<span aria-hidden="true">›_</span><kbd aria-hidden="true">Strg K</kbd>'); kb.type = "button"; kb.setAttribute("aria-label", tt("ly_cmdk") + " (Strg+K)"); kb.title = tt("ly_cmdkPh") + " (Strg+K)"; kb.setAttribute("aria-haspopup", "dialog"); kb.setAttribute("aria-keyshortcuts", "Control+K");
          hb2.insertBefore(sm, hb2.firstChild); hb2.insertBefore(kb, hb2.firstChild); setMode(md);
          var ks = E("button", "btn ghost small lykeys", esc(tt("ly_keys"))); ks.type = "button"; ks.title = tt("ly_keysL"); ks.addEventListener("click", function () { toast(dlg, tt("ly_keysL")); }); bottom.appendChild(ks);   /* nur im Modus Experte sichtbar */
          /* Befehlsleiste */
          var pal = null, items = [], hit = [], act = 0, from = null;
          var lab = function (b) { return (b.getAttribute("aria-label") || b.textContent || "").replace(/\s+/g, " ").trim(); };
          var collect = function () {
            var L0 = [], add = function (g, t, run, s) { if (t) L0.push({ g: g, t: t, s: s || "", run: run }); };
            var ed0 = dlg.querySelector("#kmToolsBody [data-k=medit]"), edl = ed0 ? lab(ed0) + " › " : "";
            dlg.querySelectorAll("#kmToolsBody button[data-k], #kmToolsBody button[data-eop]").forEach(function (b) { if (b.disabled) return; var hid = !b.offsetParent; add("ly_cgTool", (b.hasAttribute("data-eop") ? edl : "") + lab(b), function () { b.click(); }, hid && md === "e" ? tt("ly_mHid") : ""); });
            dlg.querySelectorAll(".lynav [data-ly]").forEach(function (b) { add("ly_cgView", lab(b), function () { b.click(); }); });
            dlg.querySelectorAll(".lydtabs [role=tab]").forEach(function (b) { add("ly_cgView", tt("ly_dock") + ": " + lab(b).replace(/\s*\(\d+\)$/, ""), function () { var t = b.getAttribute("data-dt"); if (md === "e" && ["prof", "aus", "pos"].indexOf(t) >= 0) setMode("s"); lyD.t = t; lyD.c = false; lyDock(); b.focus(); }); });
            [["e", "ly_mE"], ["s", "ly_mS"], ["x", "ly_mX"]].forEach(function (o) { if (o[0] !== md) add("ly_cgCmd", tt("ly_mode") + ": " + tt(o[1]), function () { setMode(o[0]); }); });
            var q = function (s) { return dlg.querySelector(s); };
            [[".nc-theme", tt("ly_themeD")], [".lymidtog,.kmmidtog", null], [".lysbtn", tt("km_search")], [".lybtn", tt("km_src")], ["[data-k=save]", null], ["[data-k=apply]", null], ["[data-pfb]", null], ["[data-hpk]", tt("hp_ctx")], ["[data-lywarn]", null]].forEach(function (a) { var b = q(a[0]); if (b && !b.disabled) add("ly_cgCmd", a[1] || lab(b), function () { b.click(); }); });
            dlg.querySelectorAll(".lyviewb button, .lyviewb select").forEach(function (b) { if (b.tagName === "BUTTON" && !b.disabled) add("ly_cgCmd", lab(b), function () { b.click(); }); });
            dlg.querySelectorAll("[data-lylang]").forEach(function (b) { if (b.getAttribute("aria-pressed") !== "true") add("ly_cgCmd", tt("ly_lang") + ": " + b.textContent, function () { b.click(); }); });
            add("ly_cgCmd", tt("ly_dock") + " ⇅ (Strg+J)", function () { lyD.c = !lyD.c; lyDock(); });
            add("ly_cgCmd", tt("ly_keys"), function () { toast(dlg, tt("ly_keysL")); });
            if (lastCmd) add("ly_cgCmd", tt("km_cx_rep").replace("{c}", lastCmd.t), repeatCmd);
            selCmds().forEach(function (x) { add("ly_cgCmd", x.t, x.run); });
            exObjs().forEach(function (g) { g.it.forEach(function (x) { add("ly_cgObj", x.n, function () { if (window.__LYEXP) window.__LYEXP.set("e"); exSelect(x.id); }, x.s); }); });
            document.querySelectorAll("#lyPosB tr[data-dk]").forEach(function (tr) { var k = tr.getAttribute("data-dk"), c = tr.children; if (!c[2]) return; add("ly_cgPos", k + " " + c[2].textContent.slice(0, 70), function () { if (md === "e") setMode("s"); lyD.t = "pos"; lyD.c = false; lyDock(); var inp = document.querySelector('.lydock [data-dq="q"]'); if (inp) { inp.value = k; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.focus(); } }, c[6] ? c[6].textContent : ""); });
            return L0;
          };
          var paint = function () {
            var inp = pal.querySelector("input"), ws = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            hit = items.filter(function (it) { var h = (it.t + " " + it.s + " " + tt(it.g)).toLowerCase(); return ws.every(function (w) { return h.indexOf(w) >= 0; }); });
            if (!ws.length) hit = hit.filter(function (it) { return it.g !== "ly_cgPos" && it.g !== "ly_cgObj"; }).concat(hit.filter(function (it) { return it.g === "ly_cgObj"; }).slice(0, 8));
            hit = hit.slice(0, 60); act = Math.min(act, Math.max(0, hit.length - 1));
            var ul = pal.querySelector("[role=listbox]"), g0 = "";
            ul.innerHTML = hit.length ? hit.map(function (it, i) { var hd = it.g !== g0 ? '<li role="presentation" class="lyk-g">' + esc(tt(it.g)) + "</li>" : ""; g0 = it.g; return hd + '<li role="option" id="lyk_' + i + '" data-ki="' + i + '" aria-selected="' + (i === act ? "true" : "false") + '"><span>' + esc(it.t) + "</span>" + (it.s ? "<small>" + esc(it.s) + "</small>" : "") + "</li>"; }).join("") : '<li role="presentation" class="lyk-none">' + esc(tt("ly_cmdkNone")) + "</li>";
            inp.setAttribute("aria-activedescendant", hit.length ? "lyk_" + act : ""); var a0 = ul.querySelector('[aria-selected="true"]'); if (a0 && a0.scrollIntoView) a0.scrollIntoView({ block: "nearest" });
            pal.querySelector(".lyk-n").textContent = tt("ly_cmdkN").replace("{n}", hit.length);
          };
          var closeP = function (back) { if (!pal || pal.hidden) return; pal.hidden = true; if (back && from && from.focus) try { from.focus(); } catch (e) { } };
          var run = function (i) { var it = hit[i]; if (!it) return; closeP(false); setTimeout(function () { try { it.run(); } catch (e) { } }, 0); if (it.g === "ly_cgTool") lastCmd = { fn: it.run, t: it.t.replace(/\s+/g, " ").slice(0, 40) }; };
          var openP = function () {
            if (!pal) { pal = E("div", "lycmdk"); pal.hidden = true; pal.setAttribute("role", "dialog"); pal.setAttribute("aria-modal", "true"); pal.setAttribute("aria-label", tt("ly_cmdk"));
              pal.innerHTML = '<div class="lyk-box"><input type="text" role="combobox" aria-expanded="true" aria-controls="lykL" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="' + esc(tt("ly_cmdkPh")) + '" aria-label="' + esc(tt("ly_cmdkPh")) + '"><ul id="lykL" role="listbox" aria-label="' + esc(tt("ly_cmdk")) + '"></ul><p class="lyk-f"><span class="lyk-n" role="status" aria-live="polite"></span> <span>↑↓ · Enter · Esc</span></p></div>';
              dlg.appendChild(pal); var inp = pal.querySelector("input");
              inp.addEventListener("input", function () { act = 0; paint(); });
              inp.addEventListener("keydown", function (e) { if (e.key === "ArrowDown") { e.preventDefault(); act = Math.min(hit.length - 1, act + 1); paint(); } else if (e.key === "ArrowUp") { e.preventDefault(); act = Math.max(0, act - 1); paint(); } else if (e.key === "Enter") { e.preventDefault(); run(act); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeP(true); } else if (e.key === "Tab") { e.preventDefault(); } });
              pal.addEventListener("mousedown", function (e) { if (e.target === pal) { e.preventDefault(); closeP(true); } });
              pal.addEventListener("click", function (e) { var li = e.target.closest("[data-ki]"); if (li) run(+li.getAttribute("data-ki")); });
            }
            from = document.activeElement; items = collect(); act = 0; pal.hidden = false; var i0 = pal.querySelector("input"); i0.value = ""; paint(); i0.focus();
          };
          kb.addEventListener("click", openP);
          var onK = function (e) { if (!document.body.contains(dlg)) { document.removeEventListener("keydown", onK, true); return; } if (!dlg.open) return; if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopPropagation(); if (pal && !pal.hidden) closeP(true); else openP(); } };
          document.addEventListener("keydown", onK, true);
          dlg.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("#kmToolsBody button"); if (b && md === "e") setTimeout(function () { if (!b.offsetParent) { var m0 = dlg.querySelector("#kmMap"); if (m0) m0.focus(); } }, 0); });   /* Einfach: ausgeschaltetes Zusatzwerkzeug verschwindet → Fokus auf die Karte */
          window.__LYCMD = { open: openP, mode: setMode };
        })();
        (function () {   /* Phase H: Handy/Tablet (≤ 860 px) – Karte vollflächig, Menü oben, Leiste unten mit Bottom Sheets (½ / voll); Desktop unverändert */
          var mq = window.matchMedia ? window.matchMedia("(max-width:860px)") : { matches: false }, cur0 = "";
          var hm = E("button", "btn ghost small lyhm", "☰"); hm.type = "button"; hm.setAttribute("aria-expanded", "false"); hm.setAttribute("aria-label", tt("ly_mMenu")); hm.title = tt("ly_mMenu"); head.insertBefore(hm, hb2.nextSibling);
          var mk0 = E("button", "btn ghost small lymk", '<span aria-hidden="true">›_</span>'); mk0.type = "button"; mk0.setAttribute("aria-label", tt("ly_cmdkPh")); mk0.title = tt("ly_cmdkPh"); head.insertBefore(mk0, hm); mk0.addEventListener("click", function () { if (window.__LYCMD) window.__LYCMD.open(); });
          var inv = function () { setTimeout(function () { try { map.invalidateSize({ animate: false }); } catch (e) { } }, 60); };
          hm.addEventListener("click", function () { var o = !dlg.classList.contains("ly-hm"); dlg.classList.toggle("ly-hm", o); hm.setAttribute("aria-expanded", o ? "true" : "false"); hm.textContent = o ? "✕" : "☰"; if (o) { var f = head.querySelector(".lynav button"); if (f) f.focus(); } inv(); });
          var SH = [["tools", "ly_mT", "⚒", ".kmtools"], ["mid", "ws_layers", "◧", ".kmmid"], ["side", "ly_mP", "☰", ".kmside"], ["dock", "ly_mA", "▦", ".lydock"], ["more", "ly_mM", "⋯", ".kmbottom"]];
          var tb0 = E("nav", "lymtab"); tb0.setAttribute("aria-label", tt("ly_mNav"));
          tb0.innerHTML = SH.map(function (s) { return '<button type="button" data-msh="' + s[0] + '" aria-expanded="false"><span aria-hidden="true">' + s[2] + "</span>" + esc(tt(s[1])) + "</button>"; }).join("");
          var grip = E("button", "lymgrip", '<span aria-hidden="true"></span>'); grip.type = "button"; grip.hidden = true; grip.setAttribute("aria-label", tt("ly_mGrip")); grip.setAttribute("aria-pressed", "false");
          dlg.appendChild(grip); dlg.appendChild(tb0);
          var ctl = function () { SH.forEach(function (s) { var el = s[3] === ".kmbottom" ? bottom : dlg.querySelector(s[3]); if (el) { if (!el.id) el.id = "lyMS_" + s[0]; tb0.querySelector('[data-msh="' + s[0] + '"]').setAttribute("aria-controls", el.id); } }); };   /* Dock entsteht erst später → verzögert verknüpfen */
          ctl(); setTimeout(ctl, 0);
          var show = function (k, from) {
            ctl(); if (k === cur0) k = ""; cur0 = k;
            SH.forEach(function (s) { dlg.classList.toggle("ly-ms-" + s[0], s[0] === k); var b = tb0.querySelector('[data-msh="' + s[0] + '"]'); b.setAttribute("aria-expanded", s[0] === k ? "true" : "false"); });
            dlg.classList.toggle("ly-ms", !!k); if (!k) { dlg.classList.remove("ly-msf"); grip.setAttribute("aria-pressed", "false"); } grip.hidden = !k;
            grid.classList.toggle("kmmid-open", k === "mid"); var mt0 = dlg.querySelector(".kmmidtog"); if (mt0) mt0.setAttribute("aria-expanded", k === "mid" ? "true" : "false");
            if (k === "dock" && lyD.c) { lyD.c = false; lyDock(); }
            if (k) { var el = document.getElementById(tb0.querySelector('[data-msh="' + k + '"]').getAttribute("aria-controls") || ""); if (el) { el.scrollTop = 0; var f = el.querySelector('[role=tab][aria-selected=true],button:not([hidden]),input,select'); if (f && from !== "pointer") try { f.focus({ preventScroll: true }); } catch (e) { } } }
            else if (from === "esc") { var b0 = dlg.querySelector('.lymtab [data-msh]'); if (b0) b0.focus(); }
          };
          tb0.addEventListener("click", function (e) { var b = e.target.closest("[data-msh]"); if (b) show(b.getAttribute("data-msh"), e.detail ? "pointer" : "key"); });
          grip.addEventListener("click", function () { var f = !dlg.classList.contains("ly-msf"); dlg.classList.toggle("ly-msf", f); grip.setAttribute("aria-pressed", f ? "true" : "false"); });
          dlg.addEventListener("keydown", function (e) { if (e.key === "Escape" && cur0 && mq.matches) { var pal0 = dlg.querySelector(".lycmdk"); if (pal0 && !pal0.hidden) return; var dm0 = dlg.querySelector(".lyviewm[open]"); if (dm0) return; e.preventDefault(); e.stopPropagation(); show("", "esc"); } }, true);
          /* Werkzeug gewählt → Blatt schliessen, damit auf der Karte gezeichnet werden kann */
          dlg.addEventListener("click", function (e) { if (!mq.matches || cur0 !== "tools") return; var b = e.target.closest && e.target.closest("#kmToolsBody button[data-k^=m], #kmToolsBody button[data-k=route], #kmToolsBody button[data-eop]"); if (b) setTimeout(function () { if (b.getAttribute("aria-pressed") === "true" || b.hasAttribute("data-eop")) show(""); }, 0); });
          /* Ebenen-Knopf der Kopfleiste steuert auf dem Handy das Blatt «Ebenen» */
          var mt = dlg.querySelector(".kmmidtog"); if (mt) mt.addEventListener("click", function (e) { if (!mq.matches) return; e.stopImmediatePropagation(); dlg.classList.remove("ly-hm"); hm.setAttribute("aria-expanded", "false"); hm.textContent = "☰"; show(cur0 === "mid" ? "" : "mid"); }, true);
          var onMq = function () { if (!mq.matches) { show(""); dlg.classList.remove("ly-hm"); hm.setAttribute("aria-expanded", "false"); hm.textContent = "☰"; } inv(); };
          if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
          window.__LYMOB = { show: show };
          var onNq = function () { lyD.c = lyNq.matches ? lyNarC() : lyWideC; lyDock.q = true; try { lyDock(); } finally { lyDock.q = false; } };   /* Wechsel schmal ↔ breit: jeweilige Wahl herstellen, ohne sie zu überschreiben */
          if (lyNq.addEventListener) lyNq.addEventListener("change", onNq); else if (lyNq.addListener) lyNq.addListener(onNq);
        })();
        var fo = bottom.querySelector(".kmfoot"); if (fo) ["save", "apply"].forEach(function (k) { var x = fo.querySelector('[data-k="' + k + '"]'); if (x) hb2.appendChild(x); });   /* Sichern/Übernehmen oben rechts */
        var sw0 = head.querySelector(".kmsw"); if (sw0) (function () {   /* Ortssuche: minimiert als Symbol in der Kopfleiste (Mitte); Klick klappt das Feld unter der Kopfleiste auf, ohne die Kartenauswahl zu überlagern */
          sw0.classList.add("lysearch"); var pop = E("div", "lyspop"); pop.id = "lySP"; while (sw0.firstChild) pop.appendChild(sw0.firstChild);
          var sb = E("button", "btn ghost small lysbtn", '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="lysbt">' + esc(tt("km_searchS")) + "</span>");
          sb.type = "button"; sb.setAttribute("aria-expanded", "false"); sb.setAttribute("aria-controls", "lySP"); sb.setAttribute("aria-label", tt("km_search")); sb.title = tt("km_search");
          sw0.appendChild(sb); sw0.appendChild(pop); head.insertBefore(sw0, hb2);
          var qi = pop.querySelector("#kmQ"), hl = pop.querySelector("#kmHits");
          var sOpen = function (o, f) { sw0.classList.toggle("open", o); sb.setAttribute("aria-expanded", o ? "true" : "false"); if (o) { dlg.classList.remove("ly-hm"); var hm0 = dlg.querySelector(".lyhm"); if (hm0) { hm0.setAttribute("aria-expanded", "false"); hm0.textContent = "☰"; } if (f !== false && qi) qi.focus(); } else { if (hl) hl.innerHTML = ""; if (qi) qi.value = ""; } };
          sb.addEventListener("click", function () { sOpen(!sw0.classList.contains("open")); });
          sw0.addEventListener("keydown", function (e) { if (e.key === "Escape" && sw0.classList.contains("open")) { e.preventDefault(); e.stopPropagation(); sOpen(false); sb.focus(); } });
          hl && hl.addEventListener("click", function (e) { if (e.target.closest(".kmhit")) setTimeout(function () { sOpen(false, false); }, 0); });   /* Treffer gewählt → wieder minimieren */
          dlg.addEventListener("pointerdown", function (e) { if (sw0.classList.contains("open") && !sw0.contains(e.target)) sOpen(false, false); }, true);
          sw0.addEventListener("focusout", function () { setTimeout(function () { if (sw0.classList.contains("open") && !sw0.contains(document.activeElement) && qi && !qi.value.trim() && hl && !hl.children.length) sOpen(false, false); }, 200); });
          window.__LYSEARCH = { open: function () { sOpen(true); }, close: function () { sOpen(false); } };
        })();
        var vw = bottom.querySelector(".kmview"), tg0 = head.querySelector(".kmmidtog"); if (vw && tg0) vw.insertBefore(tg0, vw.firstChild);   /* Ebenen und Fenster-Reset in die Fussleiste */
        var bar = E("section", "lybar"); bar.setAttribute("aria-label", tt("ly_bar"));
        var cell = function (k, id, cls) { return '<div class="lyp' + (cls ? " " + cls : "") + '"><span class="lyk">' + esc(tt(k)) + '</span><b id="' + id + '"></b></div>'; };
        bar.innerHTML = cell("ly_proj", "lyProj", "lypn") + cell("ly_ort", "lyOrt") + cell("ly_status", "lySt") + '<div class="lykpi" id="lyKpi" role="status" aria-live="polite"></div>' +
          '';
        var lay = E("div", "lylay"); lay.innerHTML = '<label class="lyk" for="lySel">' + esc(tt("ly_layout")) + '</label><select id="lySel">' + [["a", "ly_A"], ["b", "ly_B"], ["c", "ly_C"], ["d", "ly_D"], ["classic", "ly_cl"]].map(function (a) { var d = /^[bcd]$/.test(a[0]); return '<option value="' + a[0] + '"' + (a[0] === "a" ? " selected" : "") + (d ? " disabled" : "") + ">" + esc(tt(a[1])) + (d ? " – " + esc(tt("ly_soon")) : "") + "</option>"; }).join("") + "</select>"; head.insertBefore(lay, hb2);
        dlg.insertBefore(bar, head.nextSibling);
        bar.querySelector("#lyProj").textContent = LY.proj || tt("ly_noProj"); bar.querySelector("#lyOrt").textContent = LY.ort || "–";
        var DT = [["prof", "ly_tProf"], ["aus", "ly_tAus"], ["kost", "ly_tKost"], ["pos", "ly_tPos"], ["offen", "ly_tOffen"], ["warn", "ly_tWarn"]], dock = E("section", "lydock"); dock.setAttribute("aria-label", tt("ly_dock"));
        dock.innerHTML = '<div class="lydbar"><div class="lydtabs" role="tablist" aria-label="' + esc(tt("ly_dock")) + '">' + DT.map(function (d) { return '<button type="button" role="tab" id="lyT_' + d[0] + '" aria-controls="lyP_' + d[0] + '" data-dt="' + d[0] + '">' + esc(tt(d[1])) + ' <span class="lycnt" data-cnt="' + d[0] + '"></span></button>'; }).join("") + "</div>" +
          '<button type="button" class="btn ghost small lydcol" data-dcol aria-expanded="true">' + esc(tt("ly_dCol")) + "</button></div>" +
          DT.map(function (d) { return '<div class="lydpan" role="tabpanel" id="lyP_' + d[0] + '" aria-labelledby="lyT_' + d[0] + '"' + (d[0] === "prof" ? "" : ' tabindex="0"') + " hidden>" + (d[0] === "prof" ? "" : '<p class="hint">' + esc(tt("km_loading")) + "</p>") + "</div>"; }).join("");
        dlg.insertBefore(dock, bottom);
        var lb = E("div", "lybase"); lb.setAttribute("aria-label", tt("km_src"));   /* Kartenauswahl auf der Karte: minimiert als ein Knopf mit der aktiven Karte, Klick klappt die Liste auf */
        lb.innerHTML = '<button type="button" class="btn ghost small lybtn" aria-expanded="false" aria-controls="lyBL" aria-label="' + esc(tt("km_src")) + '"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M10 2l8 4-8 4-8-4zM2 10l8 4 8-4M2 14l8 4 8-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="lybt"></span><span aria-hidden="true">▾</span></button><div class="lybl" id="lyBL" role="group" aria-label="' + esc(tt("km_src")) + '" hidden>' +
          [["farbe", "ly_bFarbe"], ["grau", "ly_bGrau"], ["luft", "ly_bLuft"], ["luftstr", "ly_bLuftStr"], ["kataster", "ly_bKat"]].map(function (a) { return '<button type="button" class="btn ghost small" data-lyb="' + a[0] + '" aria-pressed="false">' + esc(tt(a[1])) + "</button>"; }).join("") + "</div>"; canvas.appendChild(lb);
        (function () {
          var bt = lb.querySelector(".lybtn"), bl = lb.querySelector(".lybl");
          var bOpen = function (o, f) { bl.hidden = !o; lb.classList.toggle("open", o); bt.setAttribute("aria-expanded", o ? "true" : "false"); if (o && f !== false) { var x = bl.querySelector('[aria-pressed="true"]') || bl.querySelector("button"); if (x) x.focus(); } };
          bt.addEventListener("click", function () { bOpen(bl.hidden); });
          lb.addEventListener("keydown", function (e) { if (e.key === "Escape" && !bl.hidden) { e.preventDefault(); e.stopPropagation(); bOpen(false); bt.focus(); } });
          bl.addEventListener("click", function (e) { if (e.target.closest("[data-lyb]")) setTimeout(function () { bOpen(false); bt.focus(); }, 0); });
          dlg.addEventListener("pointerdown", function (e) { if (!bl.hidden && !lb.contains(e.target)) bOpen(false, false); }, true);
          lb.addEventListener("focusout", function () { setTimeout(function () { if (!bl.hidden && !lb.contains(document.activeElement)) bOpen(false, false); }, 200); });
          window.__LYBASE = { open: function () { bOpen(true); } };
        })();
        (function () {   /* Multifunktionsleiste (Ribbon) wie in CAD/Civil-Programmen: Register mit Gruppen über der Zeichenfläche. Ergänzung – jeder Knopf löst den bestehenden
                            Befehl aus (kein neuer Zustand, keine Funktion verschoben). Minimierbar (lvd-ribbon), nur ab 861 px. */
          var T0 = "#kmToolsBody ", K = function (k) { return T0 + "[data-k=" + k + "]"; }, O = function (k) { return T0 + "[data-eop=" + k + "]"; }, D = function (t) { return "#lyT_" + t; };
          var G = { medit: "✥", mline: "╱", mpt: "▣", mwl: "◫", mgeb: "⌂", route: "↝", msond: "◎", marea: "▱", mtext: "T", marrow: "➚", msline: "〰", mrect: "▭", mruler: "📏", undo: "↶", redo: "↷", end: "■", clear: "✕", dxfin: "⇪", save: "💾", apply: "✔" };
          var TABS = [
            ["start", [["rb_pSel", [K("medit")]], ["rb_pDraw", [K("mline"), K("mpt"), K("mgeb"), K("route")]], ["rb_pEdit", [K("undo"), K("redo")]], ["rb_pProj", [".kmheadb [data-k=save]", ".kmheadb [data-k=apply]"]]]],
            ["draw", [["rb_pLine", [K("mline"), K("end"), K("route")]], ["rb_pObj", [K("mpt"), K("mwl"), K("mgeb"), K("msond"), K("marea")]]]],
            ["mod", [["rb_pSel", [K("medit")]], ["rb_pVert", [O("pt"), O("line"), O("ins"), O("del"), O("seg"), O("split"), O("join")]], ["rb_pEdit", [K("undo"), K("redo"), K("clear")]]]],
            ["ann", [["rb_pAnn", [K("mtext"), K("marrow"), K("msline"), K("mrect")]], ["rb_pMeas", [K("mruler")]]]],
            ["ins", [["rb_pImp", [K("dxfin")]], ["rb_pLay", [".lynav .kmmidtog"]]]],
            ["an", [["rb_pEval", [D("prof"), D("aus"), D("kost"), D("pos"), D("offen"), D("warn")]], ["rb_pProf", ["[data-pfb]"]]]],
            ["out", [["rb_pRes", [".lynav [data-ly=res]", ".lynav [data-ly=rep]", ".lynav [data-ly=rec]", ".lynav [data-ly=proj]"]], ["rb_pProj", [".kmheadb [data-k=save]", ".kmheadb [data-k=apply]"]]]],
            ["view", [["rb_pMap", [".lybtn", ".lysbtn"]], ["rb_pWin", [".nc-theme", ".lycmdk-b", "[data-hpk]"]]]]
          ];
          var rb = E("section", "lyrb"); rb.setAttribute("aria-label", tt("rb_label"));
          var cur = "start", min = window.__LVD_RIBBON_DEFAULT === "min"; try { var sv = JSON.parse(localStorage.getItem("lvd-ribbon") || "null"); if (sv && typeof sv === "object") { if (TABS.some(function (t) { return t[0] === sv.t; })) cur = sv.t; min = !!sv.m; } } catch (e) { }
          var tgt = function (s) { return dlg.querySelector(s); };
          var labOf = function (b) { var a = b.getAttribute("aria-label"); if (a && !/[›_]/.test(a)) return a.replace(/\s*\(Strg\+K\)$/, ""); var t = ""; b.childNodes.forEach(function (n) { if (n.nodeType === 3) t += n.textContent; else if (n.nodeType === 1 && !n.hasAttribute("aria-hidden") && n.tagName !== "KBD" && n.tagName !== "svg") t += n.textContent; }); return t.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim() || b.title || ""; };
          var build = function () {
            var h = '<div class="lyrb-t"><div class="lyrb-tl" role="tablist" aria-label="' + esc(tt("rb_label")) + '">' + TABS.map(function (t) { return '<button type="button" role="tab" id="lyRT_' + t[0] + '" aria-controls="lyRP_' + t[0] + '" aria-selected="' + (t[0] === cur ? "true" : "false") + '" tabindex="' + (t[0] === cur ? 0 : -1) + '" data-rbt="' + t[0] + '">' + esc(tt("rb_" + t[0])) + "</button>"; }).join("") + "</div>" +
              '<button type="button" class="lyrb-min" data-rbmin aria-expanded="' + (min ? "false" : "true") + '" aria-label="' + esc(tt("rb_min")) + '" title="' + esc(tt("rb_min")) + ' (Strg+F1)">' + (min ? "▾" : "▴") + "</button></div>";
            TABS.forEach(function (t) {
              h += '<div class="lyrb-p" role="tabpanel" id="lyRP_' + t[0] + '" aria-labelledby="lyRT_' + t[0] + '"' + (t[0] === cur && !min ? "" : " hidden") + ">" + t[1].map(function (g) {
                var bs = g[1].map(function (s) { var b = tgt(s); if (!b) return ""; var k = b.getAttribute("data-k") || "", ic = G[k] || ""; return '<button type="button" class="lyrb-b" data-rb="' + esc(s) + '"><span class="lyrb-i" aria-hidden="true">' + (ic || "•") + '</span><span class="lyrb-l">' + esc(labOf(b)) + "</span></button>"; }).join("");
                return bs ? '<div class="lyrb-g" role="group" aria-label="' + esc(tt(g[0])) + '"><div class="lyrb-gb">' + bs + '</div><div class="lyrb-gt" aria-hidden="true">' + esc(tt(g[0])) + "</div></div>" : ""; }).join("") + "</div>";
            });
            rb.innerHTML = h; sync();
          };
          var sync = function () { rb.querySelectorAll("[data-rb]").forEach(function (x) { var b = tgt(x.getAttribute("data-rb")); if (!b) { x.disabled = true; return; } x.disabled = !!b.disabled; var p = b.getAttribute("aria-pressed"), s = b.getAttribute("aria-selected"); if (p != null) x.setAttribute("aria-pressed", p); else if (s != null) x.setAttribute("aria-pressed", s === "true" && !lyD.c ? "true" : "false"); }); };
          var store = function () { try { localStorage.setItem("lvd-ribbon", JSON.stringify({ t: cur, m: min })); } catch (e) { } };
          var show = function (t, focus) { cur = t; rb.querySelectorAll("[role=tab]").forEach(function (b) { var on = b.getAttribute("data-rbt") === t; b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); }); rb.querySelectorAll("[role=tabpanel]").forEach(function (p) { p.hidden = min || p.id !== "lyRP_" + t; }); store(); fit(); };
          var setMin = function (m) { min = m; var mb = rb.querySelector("[data-rbmin]"); mb.setAttribute("aria-expanded", m ? "false" : "true"); mb.textContent = m ? "▾" : "▴"; rb.classList.toggle("min", m); show(cur); };
          var fit = function () { if (window.__LYFIT) window.__LYFIT(); setTimeout(function () { try { map.invalidateSize({ animate: false }); } catch (e) { } }, 30); };
          rb.addEventListener("click", function (e) {
            var tb = e.target.closest("[data-rbt]"); if (tb) { var t = tb.getAttribute("data-rbt"); if (min) { min = false; setMin(false); } show(t); return; }
            if (e.target.closest("[data-rbmin]")) { setMin(!min); return; }
            var x = e.target.closest("[data-rb]"); if (!x || x.disabled) return; var s = x.getAttribute("data-rb"), b = tgt(s); if (!b) return;
            if (/^#lyT_/.test(s)) { lyD.t = b.getAttribute("data-dt"); lyD.c = false; lyDock(); }   /* Auswertung: Reiter öffnen (nie einklappen) */
            else b.click();
            setTimeout(sync, 0); setTimeout(sync, 250);
          });
          rb.addEventListener("dblclick", function (e) { if (e.target.closest("[data-rbt]")) setMin(!min); });
          rb.addEventListener("keydown", function (e) { var tb = e.target.closest && e.target.closest("[data-rbt]"); if (!tb) return; var i = TABS.map(function (t) { return t[0]; }).indexOf(tb.getAttribute("data-rbt")), n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1; if (n < 0 && e.key !== "ArrowLeft") return; e.preventDefault(); n = (n + TABS.length) % TABS.length; show(TABS[n][0], true); });
          dlg.addEventListener("click", function () { setTimeout(sync, 0); }); dlg.addEventListener("keyup", function () { setTimeout(sync, 0); });
          dlg.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "F1") { e.preventDefault(); e.stopPropagation(); setMin(!min); } }, true);
          grid.parentNode.insertBefore(rb, grid);
          dlg.classList.add("ly-rb");
          setTimeout(function () { build(); rb.classList.toggle("min", min); fit(); }, 0);
          window.__LYRB = { show: show, min: setMin, sync: sync };
        })();
        /* Phase E: eine Statuszeile wie in CAD (Fang · Koordinate/Massstab · Befehlszeile · Ansicht ▾ · Urheber), Ebenen in die Kopfleiste, Dock in der Höhe ziehbar */
        (function () {
          var vw2 = bottom.querySelector(".kmview"), mt = vw2 && vw2.querySelector(".kmmidtog"); if (mt) { mt.classList.add("lymidtog"); nav.appendChild(mt); }
          var help = canvas.querySelector("#kmHelp"), units = canvas.querySelector("#kmUnits"), st = bottom.querySelector(".kmstat");
          var cmd = E("div", "lycmd"); cmd.setAttribute("role", "status"); cmd.setAttribute("aria-live", "polite"); cmd.setAttribute("aria-label", tt("ly_cmd")); if (help) cmd.appendChild(help);
          if (st) st.after(cmd); else bottom.insertBefore(cmd, bottom.firstChild);
          if (vw2) { var dm = E("details", "lyviewm"); dm.innerHTML = "<summary>" + esc(tt("ly_view")) + "</summary>"; var box = E("div", "lyviewb"); while (vw2.firstChild) box.appendChild(vw2.firstChild); if (units) box.appendChild(units); var lyl = head.querySelector(".lylay"); if (lyl) box.insertBefore(lyl, box.firstChild); dm.appendChild(box); vw2.appendChild(dm); vw2.classList.add("lyview"); }
          var cr = dlg.querySelector(":scope > p.kmcred"); if (cr) { cr.classList.add("lycred"); bottom.appendChild(cr); }
          dm && dm.addEventListener("toggle", function () { if (dm.open) { var x = dm.querySelector("button,select,a"); if (x) x.focus(); } });
          dlg.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && dm && dm.open && !dlg.querySelector(".lycmdk:not([hidden])")) { ev.preventDefault(); ev.stopPropagation(); dm.open = false; dm.querySelector("summary").focus(); } }, true);
          /* Dock-Höhe: Griff ziehen oder mit Pfeiltasten (UI-Einstellung lvd-dockh) */
          var DH = "lvd-dockh", h0 = 220; try { h0 = Math.max(120, Math.min(560, +localStorage.getItem(DH) || 220)); } catch (e) { }
          dlg.style.setProperty("--lydh", h0 + "px");
          /* Platz für den unteren Bereich = Fensterhöhe − Kopf − Kennzahlen − Fusszeile − Reiterleiste − mindestens 260 px Karte (Kopfleiste kann umbrechen) */
          var fitDock = function () { try { var hh = dlg.clientHeight || window.innerHeight, used = 0; ["kmhead", "lybar", "lyrb", "kmbottom"].forEach(function (c) { var e = dlg.querySelector("." + c); if (e) used += e.offsetHeight; }); var tb = dlg.querySelector(".lydbar"); used += tb ? tb.offsetHeight : 48; dlg.style.setProperty("--lydm", Math.max(120, hh - used - 260) + "px");
            var tp = 0; if (window.matchMedia("(min-width:861px)").matches) ["kmhead", "lybar", "lyrb"].forEach(function (c) { var e = dlg.querySelector("." + c); if (e && e.offsetParent !== null) tp += e.offsetHeight; });   /* Höhe der Glas-Leisten: die Karte reicht darunter */
            if (String(Math.round(tp)) + "px" !== dlg.style.getPropertyValue("--lytop")) { dlg.style.setProperty("--lytop", Math.round(tp) + "px"); setTimeout(function () { try { map.invalidateSize({ animate: false }); } catch (e) { } try { propsKeep(); } catch (e) { } }, 30); } } catch (e) { } };
          fitDock(); window.addEventListener("resize", function () { fitDock(); setTimeout(function () { try { map.invalidateSize({ animate: false }); } catch (e) { } }, 30); });
          if (window.ResizeObserver) { var roF = new ResizeObserver(function () { fitDock(); }); ["kmhead", "lybar", "lyrb", "kmbottom"].forEach(function (c) { var e = dlg.querySelector("." + c); if (e) roF.observe(e); }); }
          window.__LYFIT = fitDock;
          var gr2 = E("div", "lydrag"); gr2.setAttribute("role", "separator"); gr2.setAttribute("aria-orientation", "horizontal"); gr2.setAttribute("tabindex", "0"); gr2.setAttribute("aria-label", tt("ly_dockH")); gr2.setAttribute("aria-valuemin", "120"); gr2.setAttribute("aria-valuemax", "560"); gr2.setAttribute("aria-valuenow", String(h0)); dock.insertBefore(gr2, dock.firstChild);
          var setH = function (h) { h = Math.round(Math.max(120, Math.min(Math.min(560, window.innerHeight * 0.45), h))); dlg.style.setProperty("--lydh", h + "px"); gr2.setAttribute("aria-valuenow", String(h)); try { localStorage.setItem(DH, String(h)); } catch (e) { } try { map.invalidateSize({ animate: false }); } catch (e) { } };
          var dockSp = null, MINH = 120, maxH = function () { return Math.min(560, window.innerHeight * 0.45); }, fr = 0;
          var putH = function (h, last) { dlg.style.setProperty("--lydh", Math.round(h) + "px"); if (last || ++fr % 3 === 0) { try { map.invalidateSize({ animate: false }); } catch (e) { } } };
          gr2.addEventListener("pointerdown", function (ev) {   /* Ziehen 1:1 am Zeiger, Gummiband am Rand, Loslassen mit Schwung rastet ein oder klappt ein; jederzeit unterbrechbar */
            ev.preventDefault(); var cur = dockSp ? dockSp.stop() : (lyD.c ? MINH * 0.4 : parseFloat(getComputedStyle(dlg).getPropertyValue("--lydh")) || 220); dockSp = null;
            var y0 = ev.clientY, h0 = cur, raw = cur, hist = [{ t: performance.now(), y: ev.clientY }]; gr2.setPointerCapture(ev.pointerId);
            var mv = function (e2) {
              raw = h0 + (y0 - e2.clientY); hist.push({ t: performance.now(), y: e2.clientY }); while (hist.length > 6) hist.shift();
              var M = maxH(), v = raw > M ? M + SPRING.rubber(raw - M, 160) : raw < MINH ? MINH + SPRING.rubber(raw - MINH, 160) : raw;
              if (lyD.c && raw > MINH * 0.5) { lyD.c = false; lyDock(); }   /* aus dem eingeklappten Zustand heraus ziehen */
              putH(Math.max(40, v));
            };
            var up = function () {
              gr2.removeEventListener("pointermove", mv); gr2.removeEventListener("pointerup", up); gr2.removeEventListener("pointercancel", up);
              var vy = -SPRING.vel(hist, "y"), M = maxH(), shown = parseFloat(getComputedStyle(dlg).getPropertyValue("--lydh")) || raw, end = raw + SPRING.project(vy), snaps = [MINH, Math.round((MINH + M) / 2), Math.round(M)];
              if (end < MINH * 0.55 && !lyD.c) { lyD.c = true; lyDock(); }   /* weit nach unten geworfen: einklappen */
              var tgt = Math.abs(vy) < 150 ? Math.max(MINH, Math.min(M, raw)) : snaps.reduce(function (b, x) { return Math.abs(x - end) < Math.abs(b - end) ? x : b; }, snaps[0]);   /* langsam losgelassen: Höhe bleibt; Wurf: rastet am Ruhepunkt der Projektion ein */
              if (lyD.c) tgt = MINH;
              dockSp = SPRING.run({ from: shown, to: tgt, v: vy, response: 0.34, damping: Math.abs(vy) > 300 ? 0.8 : 1, step: function (x) { putH(x); }, done: function (x) { dockSp = null; var h = Math.round(tgt); dlg.style.setProperty("--lydh", h + "px"); gr2.setAttribute("aria-valuenow", String(h)); try { localStorage.setItem(DH, String(h)); } catch (e) { } putH(h, true); } });
            };
            gr2.addEventListener("pointermove", mv); gr2.addEventListener("pointerup", up); gr2.addEventListener("pointercancel", up);
          });
          gr2.addEventListener("keydown", function (ev) { var hh = parseFloat(getComputedStyle(dlg).getPropertyValue("--lydh")) || 220, d = ev.key === "ArrowUp" ? 20 : ev.key === "ArrowDown" ? -20 : 0; if (d) { ev.preventDefault(); setH(hh + (ev.shiftKey ? d * 3 : d)); } });
        })();
        /* Projektexplorer (links, Reiter neben «Werkzeuge»): Projekt · Zeichnung · Layer · Datensätze – Klick wählt das Objekt (Karte + Eigenschaften) */
        (function () {
          var wh = tools.querySelector(".kmwh"), tb = E("div", "lyltabs"); tb.setAttribute("role", "tablist"); tb.setAttribute("aria-label", tt("ly_left"));
          tb.innerHTML = '<button type="button" role="tab" id="lyLT_t" aria-controls="kmToolsBody" data-lt="t">' + esc(tt("ws_tools")) + '</button><button type="button" role="tab" id="lyLT_e" aria-controls="lyExp" data-lt="e">' + esc(tt("ly_exp")) + "</button>";
          if (wh) wh.after(tb); else tools.insertBefore(tb, tools.firstChild);
          var body = E("div", "lytbody"); body.id = "kmToolsBody"; body.setAttribute("role", "tabpanel"); body.setAttribute("aria-labelledby", "lyLT_t"); [].slice.call(tools.querySelectorAll(":scope > .kmtg")).forEach(function (g) { body.appendChild(g); }); tb.after(body);
          var ex = E("div", "lyexp"); ex.id = "lyExp"; ex.setAttribute("role", "tabpanel"); ex.setAttribute("aria-labelledby", "lyLT_e"); ex.innerHTML = '<input type="search" class="lyexq" id="lyExQ" placeholder="' + esc(tt("ly_expQ")) + '" aria-label="' + esc(tt("ly_expQ")) + '" autocomplete="off"><div class="lyext" id="lyExT"></div>'; body.after(ex);
          var lt = "t"; try { lt = localStorage.getItem("lvd-ly-left") || "t"; } catch (e) { }
          var setLt = function (k, foc) { lt = k; tb.querySelectorAll("[data-lt]").forEach(function (b) { var on = b.getAttribute("data-lt") === k; b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1; if (on && foc) b.focus(); }); body.hidden = k !== "t"; ex.hidden = k !== "e"; try { localStorage.setItem("lvd-ly-left", k); } catch (e) { } if (k === "e") exRender(); };
          tb.addEventListener("click", function (e) { var b = e.target.closest("[data-lt]"); if (b) setLt(b.getAttribute("data-lt")); });
          tb.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); setLt(lt === "t" ? "e" : "t", true); } });
          ex.querySelector("#lyExQ").addEventListener("input", function () { exRender(); });
          ex.addEventListener("click", function (e) {
            var b = e.target.closest("[data-exsel],[data-exgo],[data-exdxf]"); if (!b) return;
            if (b.hasAttribute("data-exgo")) { lyGo(b.getAttribute("data-exgo")); return; }
            if (b.hasAttribute("data-exdxf")) { if (!M.dxf) return; var L0 = M.dxf.lay[b.getAttribute("data-exdxf")]; if (L0) { L0.on = b.checked; lyEdited = true; dxfPanel(); } return; }
            var id = b.getAttribute("data-exsel"); exSelect(id);
          });
          ex.addEventListener("dblclick", function (e) { var b = e.target.closest("[data-exsel]"); if (b) exZoom(b.getAttribute("data-exsel"), true); });
          /* Rechtsklick-Menü im Projektbaum (wie Civil 3D «Prospector»): Zeigen · Eigenschaften · Umbenennen · Duplizieren · Löschen; Gruppen: alle zeigen/auswählen */
          var cm = E("div", "lyctx"); cm.id = "lyCtx"; cm.setAttribute("role", "menu"); cm.hidden = true; dlg.appendChild(cm); var cmFrom = null;
          var cmHide = function (back) { if (cm.hidden) return; var fr = cmFrom; cm.hidden = true; cm.innerHTML = ""; cmFrom = null; if (back && fr) { var id = fr.getAttribute && (fr.getAttribute("data-exsel") || ""), t = id ? ex.querySelector('[data-exsel="' + id + '"]') : document.body.contains(fr) ? fr : null; if (t) try { t.focus(); } catch (e) { } } };
          var backFocus = function () { setTimeout(function () { if (ex.contains(document.activeElement) || cm.contains(document.activeElement) || ex.hidden) return; var t = ex.querySelector("[data-exsel].on") || ex.querySelector("[data-exsel]"); if (t) t.focus(); }, 80); };
          var cmShow = function (x, y, title, items, from) {
            cmFrom = from || null; cm.innerHTML = ""; cm.setAttribute("aria-label", title); var h = document.createElement("div"); h.className = "lyctx-h"; h.setAttribute("role", "presentation"); h.textContent = title; cm.appendChild(h);
            items.forEach(function (it) { if (it === "-") { var sp = document.createElement("div"); sp.className = "lyctx-s"; sp.setAttribute("role", "separator"); cm.appendChild(sp); return; }
              var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.className = "lyctx-i" + (it.danger ? " danger" : ""); b.tabIndex = -1; b.innerHTML = '<span aria-hidden="true">' + (it.i || "") + "</span><span>" + esc(it.t) + "</span>" + (it.k ? "<kbd aria-hidden=\"true\">" + esc(it.k) + "</kbd>" : "");
              b.addEventListener("click", function (e) { e.stopPropagation(); var f = it.fn; cmHide(false); setTimeout(function () { try { f(); } catch (er) { } backFocus(); }, 0); }); cm.appendChild(b); });
            cm.hidden = false; var r = dlg.getBoundingClientRect(), w = cm.offsetWidth, hh = cm.offsetHeight; cm.style.left = Math.max(4, Math.min(r.width - w - 4, x - r.left)) + "px"; cm.style.top = Math.max(4, Math.min(r.height - hh - 4, y - r.top)) + "px";
            var f0 = cm.querySelector("button"); if (f0) f0.focus();
          };
          var objItems = function (id) {
            var o = byId0(id); if (!o) return [];
            return [{ i: "⌖", t: tt("ly_xZoom"), fn: function () { exSelect(id); exZoom(id, true); } }, { i: "☰", t: tt("ly_xProps"), fn: function () { exSelect(id); var p = dlg.querySelector("#kmPanP"); if (p && window.__LYMOB && window.matchMedia("(max-width:860px)").matches) window.__LYMOB.show("side"); } }, "-",
              { i: "✎", t: tt("ly_xRen"), k: "F2", fn: function () { exRen = id; exRender(); } }, { i: "⧉", t: tt("ly_xDup"), fn: function () { exSelect(id); copySel("off", 3, 3); } }, "-",
              { i: "✕", t: tt("ly_xDel"), k: tt("ly_xDelK"), danger: true, fn: function () { sel = { id: id }; msel = {}; delSel(); } }];
          };
          var grpItems = function (gk) {
            var arr = M[gk] || []; return [{ i: "⌖", t: tt("ly_xZoomAll"), fn: function () { var pts = []; arr.forEach(function (o) { (o.pts || (o.pt ? [o.pt] : [])).forEach(function (p) { pts.push(AD.ll(p)); }); }); if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 19, animate: false }); } },
              { i: "▣", t: tt("ly_xSelAll"), fn: function () { sel = null; msel = {}; arr.forEach(function (o) { msel[o.id] = 1; }); refresh(); } }];
          };
          var openCm = function (b, x, y) {
            if (b.hasAttribute("data-exsel")) { var id = b.getAttribute("data-exsel"), o = byId0(id); if (!o) return; if (!sel || sel.id !== id) exSelect(id); var lab = (b.querySelector("span") || b).textContent; cmShow(x, y, lab, objItems(id), b); return; }
            var d = b.closest("details[data-exg]"); if (d) { var g = d.getAttribute("data-exg").replace(/^o_/, ""); if (M[g]) cmShow(x, y, (b.querySelector("span") || b).textContent, grpItems(g), b); }
          };
          ex.addEventListener("contextmenu", function (e) { var b = e.target.closest("[data-exsel],summary"); if (!b) return; e.preventDefault(); openCm(b, e.clientX, e.clientY); });
          ex.addEventListener("keydown", function (e) {
            var inp = e.target.closest && e.target.closest("[data-exren]");
            if (inp) { if (e.key === "Enter") { e.preventDefault(); commitRen(inp, true); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); exRen = null; exRender(); var r0 = ex.querySelector('[data-exsel="' + inp.getAttribute("data-exren") + '"]'); if (r0) r0.focus(); } return; }
            var b = e.target.closest && e.target.closest("[data-exsel],summary,.lyexi"); if (!b) return;
            if ((e.key === "ContextMenu") || (e.key === "F10" && e.shiftKey)) { e.preventDefault(); var r = b.getBoundingClientRect(); openCm(b, r.left + 24, r.bottom - 4); return; }
            if (e.key === "F2" && b.hasAttribute("data-exsel")) { e.preventDefault(); exRen = b.getAttribute("data-exsel"); exRender(); return; }
            if (e.key === "Delete" && b.hasAttribute("data-exsel")) { e.preventDefault(); var id = b.getAttribute("data-exsel"); sel = { id: id }; msel = {}; delSel(); return; }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") { var all = [].slice.call(ex.querySelectorAll("[data-exsel],summary,[data-exgo]")).filter(function (n) { return n.offsetParent; }), i = all.indexOf(b); if (i < 0) return; e.preventDefault(); var nx = all[i + (e.key === "ArrowDown" ? 1 : -1)]; if (nx) nx.focus(); }
          });
          var commitRen = function (inp, back) { var id = inp.getAttribute("data-exren"), o = byId0(id); exRen = null; if (o) { var v = inp.value.trim().slice(0, 60); if ((o.nm || "") !== v) { snap(); if (v) o.nm = v; else delete o.nm; refresh(); } else exRender(); } else exRender(); if (back) { var r1 = ex.querySelector('[data-exsel="' + id + '"]'); if (r1) r1.focus(); } };
          ex.addEventListener("focusout", function (e) { var inp = e.target.closest && e.target.closest("[data-exren]"); if (inp && exRen) setTimeout(function () { if (exRen && document.body.contains(inp) && document.activeElement !== inp) commitRen(inp, false); }, 0); });
          cm.addEventListener("keydown", function (e) { var it = [].slice.call(cm.querySelectorAll("[role=menuitem]")), i = it.indexOf(document.activeElement); if (e.key === "ArrowDown") { e.preventDefault(); it[(i + 1) % it.length].focus(); } else if (e.key === "ArrowUp") { e.preventDefault(); it[(i - 1 + it.length) % it.length].focus(); } else if (e.key === "Home") { e.preventDefault(); it[0].focus(); } else if (e.key === "End") { e.preventDefault(); it[it.length - 1].focus(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cmHide(true); } else if (e.key === "Tab") { e.preventDefault(); cmHide(true); } });
          dlg.addEventListener("pointerdown", function (e) { if (!cm.hidden && !cm.contains(e.target)) cmHide(false); }, true);
          window.__LYEXP = { set: setLt, menu: function (id) { var b = ex.querySelector('[data-exsel="' + id + '"]'); if (b) { var r = b.getBoundingClientRect(); openCm(b, r.left + 24, r.bottom - 4); } } };
          setTimeout(function () { setLt(lt); }, 0);
        })();
        var pf = dlg.querySelector("#kmProf"); if (pf) { dock.querySelector("#lyP_prof").appendChild(pf); var pn = E("p", "hint lypfh", esc(tt("ly_profHint"))); pn.id = "lyPfH"; dock.querySelector("#lyP_prof").insertBefore(pn, pf); }
      })();
      dlg.appendChild(E("p", "kmcred", "<b>" + esc(tt("km_cred")) + "</b> · " + esc(tt("km_cred2")))); head.appendChild(E("p", "kmcred kmcred-h", "<b>" + esc(tt("km_cred")) + "</b> · " + esc(tt("km_cred2"))));   /* Urheberhinweis: in der Kartenerfassung immer sichtbar */
      if (LY) { var crl = dlg.querySelector(":scope > p.kmcred"); if (crl) { crl.classList.add("lycred"); crl.title = crl.textContent; bottom.appendChild(crl); } }   /* Arbeitsplatz: Urheber in der Statuszeile */
      /* Fenster: Werkzeuge, Ebenen/Katalog und Eigenschaften lassen sich am Titel verschieben (lösen sich dabei aus der Spalte), minimieren und wieder andocken; Ebenen/Katalog erscheint nur bei Bedarf */
      if (window.matchMedia && window.matchMedia("(min-width:861px)").matches) (function () {
        var KEY = "lvd-km-win", st = {}; try { st = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { }
        var DEF = { tools: { fl: false }, mid: { fl: true, x: 206, y: 8, w: 300 }, side: { fl: false } }, zTop = 1210, saveT = 0;
        var P = [{ k: "tools", el: tools, t: tt("ws_tools"), w: 196 }, { k: "mid", el: mid, t: tt("ws_layers") + " / " + tt("ws_marker").replace(/ \(.*\)/, ""), w: 290 }, { k: "side", el: side, t: tt("ws_props") + " / " + tt("ws_eval"), w: 350 }];
        function S(k) { return st[k] || (st[k] = JSON.parse(JSON.stringify(DEF[k]))); }
        function persist() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } }, 200); }
        function isOpen() { return grid.classList.contains("kmmid-open"); }
        function gr() { var g = grid.getBoundingClientRect(); return { left: g.left, top: g.top, width: g.width, height: Math.max(120, Math.min(g.height, bottom.getBoundingClientRect().top - g.top)) }; }
        function layout() {
          grid.classList.add("kmfloat"); var G = gr(), list = [], w = window.innerWidth; G = { left: G.left, top: G.top, width: G.width, height: Math.max(120, Math.min(G.height, bottom.getBoundingClientRect().top - G.top)) };
          P.forEach(function (p) {
            var s = S(p.k), el = p.el; el.classList.toggle("kmwf", !!s.fl); el.classList.toggle("kmwmin", !!s.min);
            if (s.fl) { var ww = Math.max(200, Math.min(s.w || p.w, G.width - 16)), x = Math.max(0, Math.min(s.x == null ? 8 : s.x, G.width - ww)), y = Math.max(0, Math.min(s.y == null ? 8 : s.y, G.height - 56));   /* Fenster bleibt ganz im Zeichnungsbereich */ el.style.gridColumn = ""; el.style.left = x + "px"; el.style.top = y + "px"; el.style.width = ww + "px"; el.style.height = s.min || !s.h ? "" : Math.min(s.h, G.height - y - 4) + "px"; el.style.maxHeight = (G.height - y - 4) + "px"; if (!el.style.zIndex) el.style.zIndex = zTop; }
            else { el.style.left = el.style.top = el.style.width = el.style.height = ""; el.style.zIndex = ""; }
          });
          if (!S("tools").fl) list.push([tools, (LY ? (w >= 1500 ? 248 : w >= 1280 ? 224 : 188) : (w >= 1500 ? 196 : 172)) + "px"]);
          if (!S("mid").fl && isOpen()) list.push([mid, "290px"]);
          list.push([canvas, "minmax(0,1fr)"]); if (!S("side").fl) list.push([side, (w >= 1500 ? 350 : 330) + "px"]);
          grid.style.gridTemplateColumns = list.map(function (x) { return x[1]; }).join(" "); list.forEach(function (x, i) { x[0].style.gridColumn = String(i + 1); });
          P.forEach(function (p) { var b = p.el.querySelector('[data-w="dock"]'); if (b) { var f = !!S(p.k).fl; b.textContent = f ? "⇲" : "⇱"; b.setAttribute("aria-label", tt(f ? "win_dock" : "win_float") + ": " + p.t); b.title = tt(f ? "win_dock" : "win_float"); } var m = p.el.querySelector('[data-w="min"]'); if (m) { m.setAttribute("aria-pressed", S(p.k).min ? "true" : "false"); m.setAttribute("aria-label", tt("win_min") + ": " + p.t); m.title = tt("win_min"); m.textContent = S(p.k).min ? "▢" : "–"; } });
          setTimeout(function () { try { map.invalidateSize({ animate: false }); } catch (e) { } }, 60);
        }
        function undock(p) { var s = S(p.k); if (s.fl) return; var r = p.el.getBoundingClientRect(), G = gr(); s.fl = true; s.x = r.left - G.left; s.y = r.top - G.top; s.w = r.width; s.h = Math.min(r.height, G.height - 16); }
        function front(p) { p.el.style.zIndex = Math.min(1290, ++zTop); }
        P.forEach(function (p) {
          var h = document.createElement("div"); h.className = "kmwh";
          var g = document.createElement("button"); g.type = "button"; g.className = "kmgrab"; g.innerHTML = "<span aria-hidden=\"true\">⠿</span> " + esc(p.t); g.setAttribute("aria-label", p.t + " – " + tt("win_move")); g.title = tt("win_move");
          var bx = document.createElement("span"); bx.className = "kmwb"; h.appendChild(g); h.appendChild(bx);
          function mkb(w, label) { var b = document.createElement("button"); b.type = "button"; b.className = "kmwbtn"; b.setAttribute("data-w", w); b.setAttribute("aria-label", label); bx.appendChild(b); return b; }
          var bm = mkb("min", p.t), bd = mkb("dock", p.t);
          if (p.k === "mid") { var bp = mkb("pin", tt("win_pin")); bp.textContent = "📌"; bp.setAttribute("aria-pressed", "false"); bp.title = tt("win_pin"); bp.addEventListener("click", function () { var o = bp.getAttribute("aria-pressed") !== "true"; bp.setAttribute("aria-pressed", o ? "true" : "false"); p.pinned = o; }); var bc = mkb("x", tt("win_close")); bc.textContent = "✕"; bc.title = tt("win_close"); bc.addEventListener("click", function () { grid.classList.remove("kmmid-open"); tog.setAttribute("aria-expanded", "false"); layout(); tog.focus(); }); }
          p.el.insertBefore(h, p.el.firstChild);
          bm.addEventListener("click", function () { var s = S(p.k); if (!s.fl) undock(p); s.min = !s.min; layout(); persist(); });
          bd.addEventListener("click", function () { var s = S(p.k); if (s.fl) { s.fl = false; s.min = false; } else undock(p); layout(); persist(); });
          p.el.addEventListener("pointerdown", function () { if (S(p.k).fl) front(p); });
          var pSp = null;
          h.addEventListener("pointerdown", function (e) {
            if (e.button !== 0 || e.target.closest(".kmwbtn")) return; var sx = e.clientX, sy = e.clientY, moved = false, o = null, hist = [{ t: performance.now(), x: sx, y: sy }]; h.setPointerCapture && h.setPointerCapture(e.pointerId);
            if (pSp) { pSp.forEach(function (q) { q.stop(); }); pSp = null; var s0 = S(p.k); if (s0.fl) { s0.x = parseFloat(p.el.style.left) || s0.x; s0.y = parseFloat(p.el.style.top) || s0.y; } }   /* laufende Feder greifen: Panel bleibt in der Hand */
            var lim = function () { var G = gr(); return { x: Math.max(0, G.width - (p.el.offsetWidth || 200)), y: G.height - 56 }; };
            function mv(ev) {
              var dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 5) return;
              if (!moved) { moved = true; undock(p); layout(); front(p); o = { x: S(p.k).x, y: S(p.k).y }; }
              hist.push({ t: performance.now(), x: ev.clientX, y: ev.clientY }); while (hist.length > 6) hist.shift();
              var L = lim(), s = S(p.k), nx = o.x + dx, ny = o.y + dy;
              s.x = nx < 0 ? SPRING.rubber(nx, 140) : nx > L.x ? L.x + SPRING.rubber(nx - L.x, 140) : nx; s.y = ny < 0 ? SPRING.rubber(ny, 140) : ny > L.y ? L.y + SPRING.rubber(ny - L.y, 140) : ny;   /* Gummiband am Rand */
              p.el.style.left = s.x + "px"; p.el.style.top = s.y + "px";
            }
            function up() {
              h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
              if (!moved) return; var s = S(p.k), L = lim(), vx = SPRING.vel(hist, "x"), vy = SPRING.vel(hist, "y"), clampTo = function (v, hi) { return Math.max(0, Math.min(hi, v)); };
              var ex = clampTo(s.x + SPRING.project(vx, 0.99), L.x), ey = clampTo(s.y + SPRING.project(vy, 0.99), L.y), n = 2, fin = function () { if (--n > 0) return; pSp = null; layout(); persist(); };
              pSp = [SPRING.run({ from: s.x, to: ex, v: vx, response: 0.4, damping: Math.abs(vx) > 300 ? 0.8 : 1, step: function (x) { s.x = x; p.el.style.left = x + "px"; }, done: function (x) { s.x = x; p.el.style.left = x + "px"; fin(); } }),
                SPRING.run({ from: s.y, to: ey, v: vy, response: 0.4, damping: Math.abs(vy) > 300 ? 0.8 : 1, step: function (y) { s.y = y; p.el.style.top = y + "px"; }, done: function (y) { s.y = y; p.el.style.top = y + "px"; fin(); } })];   /* getrennte Federn für X und Y */
            }
            h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
          });
          g.addEventListener("keydown", function (e) {   /* Tastatur: Pfeiltasten verschieben, Umschalt = grosse Schritte, Enter = andocken/lösen */
            var d = e.shiftKey ? 64 : 16, mvx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, mvy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
            if (mvx || mvy) { e.preventDefault(); undock(p); var s = S(p.k); s.x = (s.x || 0) + mvx; s.y = (s.y || 0) + mvy; layout(); persist(); var g2 = p.el.querySelector(".kmgrab"); if (g2) g2.focus(); }
            else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bd.click(); var g3 = p.el.querySelector(".kmgrab"); if (g3) g3.focus(); }
          });
          g.addEventListener("click", function (e) { if (e.detail > 0) e.preventDefault(); });
          if (window.ResizeObserver && p.el) { var ro0 = new ResizeObserver(function () { var s = S(p.k); if (s.fl && !s.min && p.el.offsetWidth > 0 && p.el.style.height) { var nw = p.el.offsetWidth, nh = p.el.offsetHeight; if (Math.abs(nw - (s.w || 0)) > 1 || Math.abs(nh - (s.h || 0)) > 1) { s.w = nw; s.h = nh; persist(); } } }); ro0.observe(p.el); }
        });
        tog.addEventListener("click", function () { layout(); if (isOpen()) { front(P[1]); var g = mid.querySelector(".kmgrab"); if (g) g.focus(); } });
        mid.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen()) { e.stopPropagation(); e.preventDefault(); grid.classList.remove("kmmid-open"); tog.setAttribute("aria-expanded", "false"); layout(); tog.focus(); } });
        canvas.addEventListener("pointerdown", function (e) { if (isOpen() && !P[1].pinned && e.target.closest("#kmMap")) { grid.classList.remove("kmmid-open"); tog.setAttribute("aria-expanded", "false"); layout(); } });
        var rb = E("button", "btn ghost small", esc(tt("win_reset"))); rb.type = "button"; rb.title = tt("win_reset_t"); rb.addEventListener("click", function () { st = {}; try { localStorage.removeItem(KEY); } catch (e) { } P.forEach(function (p) { p.el.style.zIndex = ""; }); grid.classList.remove("kmmid-open"); tog.setAttribute("aria-expanded", "false"); layout(); }); var vbx = LY ? dlg.querySelector(".lyviewb") : null; if (vbx) vbx.insertBefore(rb, vbx.firstChild); else if (LY && tog.parentNode !== head) tog.parentNode.insertBefore(rb, tog.nextSibling); else head.insertBefore(rb, tog.nextSibling);
        window.addEventListener("resize", function () { if (dlg.open) layout(); });
        window.__KMWIN = { layout: layout, state: function () { return st; } };
        layout(); setTimeout(layout, 300);
      })();
    })();
    dlg.querySelector(".kmintro").addEventListener("toggle", function (e) { if (!e.target.open) try { localStorage.setItem(INTRO, "1"); } catch (x) { } });
    var byId = function (arr, id) { return arr.filter(function (l) { return l.id === id; })[0]; };

    function tiles() {
      if (layer) map.removeLayer(layer);
      /* Ebene ohne bekannten Typ: zuerst WMS, bei Fehlern (z. B. nur als WMTS verfügbar) automatisch WMTS – und umgekehrt */
      var flex = function (id, op, first) {
        var grp2 = L.layerGroup(), tries = first === "wmts" ? ["wmts", "wms"] : ["wms", "wmts"], ti = 0, ok = 0, bad = 0, cur;
        function mk(t) { return t === "wms" ? L.tileLayer.wms("https://wms.geo.admin.ch/", { layers: id, format: "image/png", transparent: true, maxZoom: 22, opacity: op, zIndex: 5, attribution: "© geo.admin.ch" }) : T(id, "png", { opacity: op, zIndex: 5 }); }
        function go() {
          if (cur) grp2.removeLayer(cur); ok = 0; bad = 0; cur = mk(tries[ti]);
          cur.on("tileload", function () { ok++; }); cur.on("tileerror", function () { bad++; if (!ok && bad >= 4 && ti < tries.length - 1) { ti++; go(); } });
          grp2.addLayer(cur);
        }
        go(); return grp2;
      };
      var T = function (id, ext, o) { return L.tileLayer(WMTS + id + "/default/current/3857/{z}/{x}/{y}." + ext, Object.assign({ maxZoom: 22, maxNativeZoom: 18, zIndex: 1, attribution: "© swisstopo / geo.admin.ch" }, o || {})); };
      layer = base === "luft" ? L.layerGroup([T("ch.swisstopo.swissimage", "jpeg", { maxNativeZoom: 19 })])
        : base === "luftstr" ? L.layerGroup([T("ch.swisstopo.swissimage", "jpeg", { maxNativeZoom: 19 }), flex("ch.swisstopo.amtliches-strassenverzeichnis", 1, "wms")])   /* Luftbild mit Strassen und Strassennamen (amtliches Strassenverzeichnis) */
        : base === "grau" ? L.layerGroup([T("ch.swisstopo.pixelkarte-grau", "jpeg")])
        : base === "leer" ? L.layerGroup([])   /* leere Basis: nur gewählte Katalog-Ebenen auf weissem Grund */
        : base === "av" ? L.layerGroup(avCfg().u ? [viewWms(avCfg().u, avCfg().l, { attr: "© OpenData AV" })] : [])
        : base === "kataster" ? (function () { var g = L.layerGroup([T("ch.swisstopo.pixelkarte-grau", "jpeg")]), v = viewWms(WMS, "ch.kantone.cadastralwebmap-farbe", { attr: "© geo.admin.ch", minZoom: PARZ_MINZ, gate: function (inR) { var c = $("#kmMap") && $("#kmMap").querySelector(".kmparzhint"); if (!inR) { if (!c && $("#kmMap")) { c = document.createElement("div"); c.className = "kmparzhint"; c.setAttribute("role", "status"); c.textContent = tt("km_parzMin").replace("{z}", PARZ_MINZ); $("#kmMap").appendChild(c); } } else if (c) c.remove(); },   /* Hinweis als Feld in der Karte (nicht klickbar), kein Toast über der Zeichenfläche */ fail: function () { g.removeLayer(v); g.addLayer(flex("ch.kantone.cadastralwebmap-farbe", 1, "wmts")); } }); g.addLayer(v); return g; })()   /* nur der Parzellenplan, ohne Landeskarte dahinter */
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
      var op = { maxZoom: 22, maxNativeZoom: 18, opacity: o.op, zIndex: 10, attribution: "© geo.admin.ch" };
      return o.type === "wms" ? L.tileLayer.wms("https://wms.geo.admin.ch/", { layers: o.srv, format: "image/png", transparent: true, maxZoom: 22, opacity: o.op, zIndex: 10, attribution: "© geo.admin.ch" })
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
      var gwr = catList.filter(function (c) { return c.id === "ch.bfs.gebaeude_wohnungs_register"; })[0] || catList.filter(function (c) { return /gebäudestatus|statut des bâtiments|stato dell.edificio|building status/i.test(c.label); })[0];
      if (gwr) {   /* Direktwahl: GWR – Gebäudestatus (ein Klick blendet die Ebene ein bzw. aus) */
        var on = ov.some(function (o) { return o.id === gwr.id; }), g = document.createElement("button"); g.type = "button"; g.className = "chip"; g.dataset.ovq = gwr.id; g.setAttribute("aria-pressed", on ? "true" : "false");
        g.textContent = (on ? "✓ " : "+ ") + gwr.label; g.title = tt("km_chipGwr"); box.insertBefore(g, box.firstChild);
      }
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
      var bg = base === "luft" || base === "luftstr" ? "ch.swisstopo.swissimage" : base === "grau" ? "ch.swisstopo.pixelkarte-grau" : base === "kataster" || base === "leer" || base === "av" ? "void" : "ch.swisstopo.pixelkarte-farbe";
      return "https://map.geo.admin.ch/#/" + (embed ? "embed" : "map") + "?lang=" + (opt.lang || "de") + "&center=" + Math.round(e[0]) + "," + Math.round(e[1]) + "&z=" + z + "&bgLayer=" + bg + (base === "kataster" || base === "luftstr" || ov.length ? "&layers=" + (base === "kataster" ? ["ch.kantone.cadastralwebmap-farbe"] : base === "luftstr" ? ["ch.swisstopo.amtliches-strassenverzeichnis"] : []).concat(ov.map(function (o) { return o.id; })).join(";") : "");
    }
    function openGeo() { window.open(geoUrl(false), "_blank", "noopener"); }
    /* immer auf den Bestand (alle Linien, Schächte, Sondagen) zoomen */
    function topPad() { var v = parseFloat(dlg.style.getPropertyValue("--lytop")); return isFinite(v) ? v : 0; }   /* Glas-Leisten verdecken den oberen Kartenrand */
    function fitAll() {
      var pts = []; M.lines.forEach(function (l) { l.pts.forEach(function (p) { pts.push(AD.ll(p)); }); }); M.pts.concat(M.sond, M.wl, M.geb).forEach(function (p) { pts.push(AD.ll(p.pt)); }); M.notes.concat(M.areas).forEach(function (n) { n.pts.forEach(function (p) { pts.push(AD.ll(p)); }); }); if (ovl) ovCorners(ovl).forEach(function (q) { pts.push(toWGS(q[0], q[1])); });
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: plan ? 3 : 19, animate: false, paddingTopLeft: [0, topPad()] });
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
    var undoSt = [], curN = null, curA = null, tmp = [], layers = {}, lastMove = 0, noteCol = "#0b6b72";
    var NT = { text: "km_nText", arrow: "km_nArrow", sline: "km_nLine", rect: "km_nRect" };
    var redoSt = [], msel = {};
    var snap = function () { lyEdited = true; undoSt.push(JSON.stringify(M, noDxf)); if (undoSt.length > 100) undoSt.shift(); redoSt.length = 0; };
    function isOn(id) { return !!((sel && sel.id === id) || msel[id]); }
    function selIds() { var a = []; if (sel && findObj(sel.id)) a.push(sel.id); Object.keys(msel).forEach(function (k) { if (a.indexOf(k) < 0 && findObj(k)) a.push(k); }); return a; }
    var findObj = function (id) { var a = [M.lines, M.pts, M.sond, M.notes, M.areas, M.wl, M.geb]; for (var i = 0; i < a.length; i++) { var o = byId(a[i], id); if (o) return { arr: a[i], o: o }; } return null; };
    function select(id) { sel = { id: id }; msel = {}; refresh(); showProps(id); }
    /* Eigenschaften zum gewählten Objekt öffnen: Reiter «Eigenschaften», Zeile aufklappen und ins Sichtfeld holen */
    function showProps(id) {
      var tp = $("#kmTabP"); if (tp && tp.getAttribute("aria-selected") !== "true") tp.click();
      var r = $("#kmObj") && $("#kmObj").querySelector('.kmrow[data-rid="' + id + '"]'); if (r) { if (folded[id]) { folded[id] = false; rows(); r = $("#kmObj").querySelector('.kmrow[data-rid="' + id + '"]'); } if (r) r.scrollIntoView({ block: "nearest" }); }
    }
    /* Bearbeitungsart im Modus «Bearbeiten/verschieben»: Punkt (Standard), ganze Linie, Punkt einfügen, Punkt löschen, Segment, Linie teilen */
    var EOPS = ["pt", "line", "ins", "del", "seg", "split", "join"], editOp = "pt"; try { var eo0 = localStorage.getItem("lvd-km-eop"); if (EOPS.indexOf(eo0) >= 0) editOp = eo0; } catch (e) { }
    function hAll() { return mode === "edit" && (editOp === "pt" || editOp === "ins" || editOp === "del" || editOp === "split" || editOp === "join"); }
    function eopRender() { var b = $("#kmEop"); if (!b) return; b.hidden = mode !== "edit"; [].slice.call(b.querySelectorAll("[data-eop]")).forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-eop") === editOp ? "true" : "false"); }); }
    function isPolyObj(f) { return !!f && (f.arr === M.lines || f.arr === M.areas) && f.o.pts && f.o.pts.length > 1; }
    function insertAtClick(o, ll, closed, noSnap) {
      var c = AD.pt(ll), pts = closed ? o.pts.concat([o.pts[0]]) : o.pts, pj = projPoly(pts, c); if (!pj) return -1;
      var q = [Math.round(pj.q[0] * 100) / 100, Math.round(pj.q[1] * 100) / 100]; for (var k = 0; k < o.pts.length; k++) if (AD.dist(o.pts[k], q) <= 0.05) return k;
      if (!noSnap) snap(); o.pts.splice(pj.seg + 1, 0, q); return pj.seg + 1;
    }
    function bindObj(lay, id, noMove) {
      lay.on("click", function (e) { L.DomEvent.stop(e); if (Date.now() - lastMove < 250) return; if (e.originalEvent && (e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey) && (mode === "edit" || !mode)) {   /* Mehrfachauswahl: im Bearbeiten-Modus und ohne Werkzeug */ var ids = selIds(); if (sel) { msel[sel.id] = 1; sel = null; } if (msel[id]) delete msel[id]; else msel[id] = 1; ids = Object.keys(msel); refresh(); return; } var fo = mode === "edit" && e.latlng ? findObj(id) : null;
        if (fo && isPolyObj(fo) && editOp === "ins") { var closed = fo.arr === M.areas, k = insertAtClick(fo.o, e.latlng, closed); sel = { id: id }; msel = {}; refresh(); showProps(id); return; }
        if (fo && fo.arr === M.lines && editOp === "split" && fo.o.pts.length > 1) { snap(); var k2 = insertAtClick(fo.o, e.latlng, false, true), sp = k2 > 0 ? splitAtIdx(fo.o, k2) : false; if (!sp) { undoSt.pop(); toast(dlg, tt("eo_splitNo")); refresh(); return; } sel = { id: id }; msel = {}; refresh(); showProps(id); toast(dlg, tt("eo_split_done")); return; }
        select(id); });
      if (!noMove) lay.on("mousedown", function (e) { startMove(e, id); });
    }
    /* ganzes Objekt am Strich verschieben */
    function startMove(e, id) {
      var f = findObj(id); if (!f || !f.o.pts || !f.o.pts.length || mode !== "edit") return;
      if (e.originalEvent && (e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey)) return;   /* Umschalt/Strg = Auswahl, nicht verschieben */
      var ids = selIds(), grpMv = ids.length > 1 && ids.indexOf(id) >= 0;
      if (!grpMv && isPolyObj(f)) { if (editOp === "seg") return startSegMove(e, f, id); if (editOp !== "line" && !(e.originalEvent && e.originalEvent.altKey)) return; }   /* Punkt-/Einfüge-/Lösch-/Teilen-Art: Strich verschiebt nicht die ganze Linie (Alt = trotzdem ganz) */
      L.DomEvent.stop(e); if (!grpMv) { sel = { id: id }; msel = {}; } snap();
      var objs = (grpMv ? ids : [id]).map(findObj).filter(Boolean).map(function (x) { return { o: x.o, pts: x.o.pts ? x.o.pts.map(function (p) { return p.slice(); }) : null, pt: x.o.pt ? x.o.pt.slice() : null }; }), hasPt = objs.some(function (b) { return !!b.pt; }), raf = 0;
      var start = AD.pt(e.latlng), moved = false;
      map.dragging.disable();
      function mm(ev) {
        var c = AD.pt(ev.latlng), dx = c[0] - start[0], dy = c[1] - start[1]; if (dx || dy) moved = true;
        objs.forEach(function (b) { if (b.pts) b.o.pts = b.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; }); if (b.pt) b.o.pt = [b.pt[0] + dx, b.pt[1] + dy]; if (layers[b.o.id] && layers[b.o.id].upd) layers[b.o.id].upd(); });
        if (hasPt && !raf) raf = requestAnimationFrame(function () { raf = 0; draw(); }); updTotal();
      }
      function up() { map.off("mousemove", mm); document.removeEventListener("mouseup", up); map.dragging.enable(); if (moved) { lastMove = Date.now(); refresh(); if (!grpMv) showProps(id); } else undoSt.pop(); }
      map.on("mousemove", mm); document.addEventListener("mouseup", up);
    }
    function startSegMove(e, f, id) {   /* nur den angefassten Abschnitt verschieben: seine beiden Eckpunkte wandern mit */
      var o = f.o, closed = f.arr === M.areas, n = o.pts.length, c0 = AD.pt(e.latlng), pj = projPoly(closed ? o.pts.concat([o.pts[0]]) : o.pts, c0); if (!pj) return;
      var j = pj.seg, k = (j + 1) % n, isL = f.arr === M.lines; L.DomEvent.stop(e); sel = { id: id }; msel = {}; snap(); map.dragging.disable();
      var b1 = o.pts[j].slice(), b2 = o.pts[k].slice(), s1 = isL ? linkStart(o, j, true) : null, s2 = isL ? linkStart(o, k, true) : null, moved = false;
      function mm(ev) { var c = AD.pt(ev.latlng), dx = c[0] - c0[0], dy = c[1] - c0[1]; if (dx || dy) moved = true; var p1 = [b1[0] + dx, b1[1] + dy], p2 = [b2[0] + dx, b2[1] + dy];
        if (s1 && s1.any) linkMove(s1, o, j, p1); else o.pts[j] = p1; if (s2 && s2.any) linkMove(s2, o, k, p2); else o.pts[k] = p2; updL(o); updTotal(); }
      function up() { map.off("mousemove", mm); document.removeEventListener("mouseup", up); map.dragging.enable(); if (moved) { lastMove = Date.now(); refresh(); showProps(id); } else undoSt.pop(); }
      map.on("mousemove", mm); document.addEventListener("mouseup", up);
    }
    function vmark(q, cls, size) { var hit = 24; return L.marker(q, { draggable: cls === "kmv", keyboard: false, zIndexOffset: 1000, icon: L.divIcon({ className: cls, html: "<span style=\"width:" + size + "px;height:" + size + "px;margin:" + (hit - size) / 2 + "px\"></span>", iconSize: [hit, hit], iconAnchor: [hit / 2, hit / 2] }) }).addTo(grp); }
    /* Eckpunkte ziehen, Mittelpunkt einfügen, Doppelklick löscht Eckpunkt */
    /* Verknüpfungen: gemeinsame Punkte (Abzweig/T-Anschluss, Teilstrecken, Hauseinführung) wandern beim Verschieben mit; ein Abzweig-Ende gleitet entlang der Hauptleitung */
    var LKTOL = 0.06;
    function updL(l) { if (layers[l.id] && layers[l.id].upd) layers[l.id].upd(); }
    function projPoly(pts, c) { var best = null; for (var i = 0; i < pts.length - 1; i++) { var a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], d2 = dx * dx + dy * dy, t = d2 ? Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / d2)) : 0, q = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(q[0] - c[0], q[1] - c[1]); if (!best || d < best.d) best = { d: d, q: q, seg: i }; } return best; }
    function linkedLines(o) {
      var r = M.lines.filter(function (l2) { return l2 !== o && (o.from === l2.id || l2.from === o.id || o.to === l2.id || l2.to === o.id || o.pv === l2.id || o.nx === l2.id || l2.pv === o.id || l2.nx === o.id); });
      r.slice().forEach(function (l2) { [l2.pv, l2.nx].forEach(function (k) { var x = k && byId(M.lines, k); if (x && x !== o && r.indexOf(x) < 0) r.push(x); }); }); return r;
    }
    function linkStart(o, j, noSlide) {
      var P0 = o.pts[j].slice(), pr = [], gs = [], slide = null;
      linkedLines(o).forEach(function (l2) { l2.pts.forEach(function (q, k) { if (AD.dist(q, P0) <= LKTOL) pr.push({ l: l2, k: k }); }); });
      M.geb.forEach(function (g) { if ((g.lid === o.id || o.gid === g.id) && AD.dist(g.pt, P0) <= LKTOL) gs.push(g); });
      var br = !noSlide && ((j === 0 && o.from && byId(M.lines, o.from)) || (j === o.pts.length - 1 && o.to && byId(M.lines, o.to)));
      if (br) { var it = pr.filter(function (x) { return x.l === br; })[0];
        if (it && it.k > 0 && it.k < br.pts.length - 1) { var op = br.pts.map(function (q) { return q.slice(); }), pj = projPoly([op[it.k - 1], op[it.k + 1]], op[it.k]); pr = pr.filter(function (x) { return x !== it; }); slide = { b: br, pts: pj.d <= Math.max(0.05, 0.03 * AD.dist(op[it.k - 1], op[it.k + 1])) ? op.filter(function (q, i) { return i !== it.k; }) : op }; } }
      return { pr: pr, gs: gs, slide: slide, any: !!(pr.length || gs.length || slide) };
    }
    function linkMove(st, o, j, c) {
      if (st.slide) { var pj = projPoly(st.slide.pts, c), bp = st.slide.pts.map(function (q) { return q.slice(); }); c = [Math.round(pj.q[0] * 100) / 100, Math.round(pj.q[1] * 100) / 100];
        if (AD.dist(c, bp[pj.seg]) <= 0.05) c = bp[pj.seg].slice(); else if (AD.dist(c, bp[pj.seg + 1]) <= 0.05) c = bp[pj.seg + 1].slice(); else bp.splice(pj.seg + 1, 0, c.slice());
        st.slide.b.pts = bp; updL(st.slide.b); }
      o.pts[j] = c.slice(); st.pr.forEach(function (x) { x.l.pts[x.k] = c.slice(); updL(x.l); }); st.gs.forEach(function (g) { g.pt = c.slice(); }); return c;
    }
    function handles(o, poly, minPts, closed) {
      var oSel = isOn(o.id), pobj = oSel ? [] : M.pts.concat(M.wl, M.geb, M.sond);   /* nicht gewählte Objekte: kein Griff über einem Schacht/Werkloch/Hauseinführung, damit diese anklick- und ziehbar bleiben */
      o.pts.forEach(function (q, j) {
        if (pobj.some(function (p) { return AD.dist(p.pt, q) <= 0.3; })) return;
        var m = vmark(AD.ll(q), "kmv", 14), st = null, isL = M.lines.indexOf(o) >= 0, jt = null;
        m.on("dragstart", function () { snap(); if (isL) st = linkStart(o, j); });
        m.on("drag", function (e) { var c = AD.pt(e.target.getLatLng());
          jt = null; if (isL && (j === 0 || j === o.pts.length - 1)) {   /* Linienende rastet am Ende einer anderen Linie ein: nach dem Loslassen Verbinden anbieten */
            var cp = map.latLngToContainerPoint(AD.ll(c)), bb = null; M.lines.forEach(function (x) { if (x === o || x.pts.length < 2) return; [x.pts[0], x.pts[x.pts.length - 1]].forEach(function (q2) { var qq = map.latLngToContainerPoint(AD.ll(q2)), dd = Math.hypot(qq.x - cp.x, qq.y - cp.y); if (dd <= 18 && (!bb || dd < bb.d)) bb = { d: dd, q: q2, o: x }; }); });
            if (bb) { jt = bb; c = bb.q.slice(); e.target.setLatLng(AD.ll(c)); }
          }
          if (st && st.any) { c = linkMove(st, o, j, c); e.target.setLatLng(AD.ll(c)); } else o.pts[j] = c; updL(o); updTotal(); });
        m.on("dragend", function () { lastMove = Date.now(); sel = { id: o.id }; var jj = jt; jt = null; refresh(); showProps(o.id); if (jj) toast(dlg, tt("jn_ask"), tt("jn_do"), function () { finishJoin(joinLines(o, jj.o, 0.5)); }); });
        m.on("dblclick", function (e) { L.DomEvent.stop(e); if (poly && o.pts.length > minPts) { snap(); o.pts.splice(j, 1); refresh(); } });
        m.on("contextmenu", function (e) { L.DomEvent.stop(e); ctxT = Date.now(); vertexMenu(o, j, e); });
        m.on("click", function (e) {
          if (mode !== "edit" || Date.now() - lastMove < 250) return; L.DomEvent.stop(e);
          if (editOp === "del") { if (poly && o.pts.length > minPts) { snap(); o.pts.splice(j, 1); sel = { id: o.id }; msel = {}; refresh(); showProps(o.id); } else toast(dlg, tt("eo_delMin").replace("{n}", minPts)); }
          else if (editOp === "join" && isL) { joinNear(o, j); }
          else if (editOp === "split" && isL) { snap(); if (splitAtIdx(o, j)) { sel = { id: o.id }; msel = {}; refresh(); showProps(o.id); toast(dlg, tt("eo_split_done")); } else { undoSt.pop(); toast(dlg, tt("eo_splitNo")); } }
          else { sel = { id: o.id }; msel = {}; refresh(); showProps(o.id); }
        });
      });
      if (!poly || !(isOn(o.id) || editOp === "ins")) return;
      for (var j = 0; j < o.pts.length - (closed ? 0 : 1); j++) (function (j) {
        var a = o.pts[j], b = o.pts[(j + 1) % o.pts.length], m = L.marker(AD.ll([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), { keyboard: false, icon: L.divIcon({ className: "kmm", html: "<span></span>", iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(grp);
        m.on("click", function (e) { L.DomEvent.stop(e); snap(); o.pts.splice(j + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); refresh(); });
      })(j);
    }
    function gebMark(gs) {
      if (!snapLayer) snapLayer = L.layerGroup().addTo(map); snapLayer.clearLayers(); if (!gs) return;
      L.marker(AD.ll(gs.c), { interactive: false, keyboard: false, icon: L.divIcon({ className: "kmsnap " + gs.kind, html: "<span>" + (gs.kind === "ln" ? "◆" : "▭") + "</span><i>" + esc(gs.label) + "</i>", iconSize: [0, 0] }) }).addTo(snapLayer);
    }
    function dragPt(m, o, key) {
      var isG = key === "pt" && M.geb.indexOf(o) >= 0, gl = null, gk = -1, gst = null;
      if (isG) {
        m.on("dragstart", function () { gl = byId(M.lines, o.lid) || null; gk = -1; gst = null; if (gl) { var best = 1e9; gl.pts.forEach(function (q, k) { var d = AD.dist(q, o.pt); if (d < best) { best = d; gk = k; } }); if (best > 0.3) gl = null; else { gst = linkStart(gl, gk, true); var bb = [gl.from && byId(M.lines, gl.from), gl.to && byId(M.lines, gl.to)]; gst.pr = gst.pr.filter(function (x) { return bb.indexOf(x.l) < 0; }); gst.any = !!(gst.pr.length || gst.gs.length); } } });
        m.on("drag", function (e) {
          var ll = e.target.getLatLng(), gs = gebSnap(map.latLngToContainerPoint(ll), o.lid), c = gs ? gs.c.slice() : AD.pt(ll);
          if (gs) e.target.setLatLng(AD.ll(c)); o.pt = c; if (gs && gs.line) o.on = gs.line.id; else delete o.on; gebMark(gs);
          if (gl) { if (gst && gst.any) linkMove(gst, gl, gk, c); else gl.pts[gk] = c.slice(); updL(gl); }
        });
        m.on("dragend", function () { if (snapLayer) snapLayer.clearLayers();
          if (gl) { [["to", gl.pts.length - 1], ["from", 0]].forEach(function (a) { var bl = gl[a[0]] && byId(M.lines, gl[a[0]]), pj = bl && projPoly(bl.pts, gl.pts[a[1]]); if (bl && (!pj || pj.d > 0.05)) { delete gl[a[0]]; if (a[0] === "from") delete gl.baseDir; } }); } });
      }
      var gb = null;
      m.on("dragstart", function () { snap(); var ids = selIds(); gb = null; if (!isG && key === "pt" && ids.length > 1 && ids.indexOf(o.id) >= 0) gb = { s: o.pt.slice(), a: ids.filter(function (i) { return i !== o.id; }).map(findObj).filter(Boolean).map(function (x) { return { o: x.o, pts: x.o.pts ? x.o.pts.map(function (p) { return p.slice(); }) : null, pt: x.o.pt ? x.o.pt.slice() : null }; }) }; });
      if (!isG) m.on("drag", function (e) { o[key] = AD.pt(e.target.getLatLng());
        if (gb) { var gx = o.pt[0] - gb.s[0], gy = o.pt[1] - gb.s[1]; gb.a.forEach(function (b) { if (b.pts) b.o.pts = b.pts.map(function (p) { return [p[0] + gx, p[1] + gy]; }); if (b.pt) b.o.pt = [b.pt[0] + gx, b.pt[1] + gy]; if (layers[b.o.id] && layers[b.o.id].upd) layers[b.o.id].upd(); }); M.pts.forEach(function (sp) { if (sp !== o && !gb.a.some(function (b) { return b.o === sp; })) return; M.lines.forEach(function (l) { if (l.s === sp.id) l.pts[0] = sp.pt.slice(); if (l.e === sp.id) l.pts[l.pts.length - 1] = sp.pt.slice(); }); }); } if (key === "pt" && M.pts.indexOf(o) >= 0) M.lines.forEach(function (l) { if (l.s === o.id) l.pts[0] = o.pt.slice(); if (l.e === o.id) l.pts[l.pts.length - 1] = o.pt.slice(); }); });
      m.on("dragend", function () { lastMove = Date.now(); sel = { id: o.id }; refresh(); showProps(o.id); });
    }
    function noteLayers(n, edit, on) {
      var col = n.color || "#0b6b72", L0 = [], upd;
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
      var asz = { s: 0.65, m: 1, l: 1.7 }[n.size || "m"] || 1, ln = L.polyline(n.pts.map(AD.ll), { color: col, weight: (on ? 5 : 3) * (n.type === "arrow" ? asz : 1), interactive: edit, bubblingMouseEvents: false }).addTo(grp), hd = null;
      function head() {
        var a = map.latLngToLayerPoint(AD.ll(n.pts[0])), b = map.latLngToLayerPoint(AD.ll(n.pts[n.pts.length - 1])), ang = Math.atan2(b.y - a.y, b.x - a.x), s = 16 * asz;
        return [b, L.point(b.x - s * Math.cos(ang - 0.4), b.y - s * Math.sin(ang - 0.4)), L.point(b.x - s * Math.cos(ang + 0.4), b.y - s * Math.sin(ang + 0.4))].map(function (p) { return map.layerPointToLatLng(p); });
      }
      if (n.type === "arrow" && n.pts.length > 1) hd = L.polygon(head(), { color: col, fillColor: col, fillOpacity: 1, weight: 1, interactive: false }).addTo(grp);
      if (edit) bindObj(ln, n.id);
      return { upd: function () { ln.setLatLngs(n.pts.map(AD.ll)); if (hd) hd.setLatLngs(head()); } };
    }
    function ovDraw(viewOnly) {
      if (plan || !map) return;
      if (!ovl || !ovl.img) { if (ovImg) { ovImg.remove(); ovImg = null; } if (gcpLay) gcpLay.clearLayers(); return; }
      var pane = map.getPane("kmov"); if (!ovImg) { ovImg = document.createElement("img"); ovImg.alt = ""; ovImg.className = "kmovimg"; pane.appendChild(ovImg); }
      if (ovImg.getAttribute("data-k") !== ovl.img.slice(-40) + ovl.w) { ovImg.src = ovl.img; ovImg.setAttribute("data-k", ovl.img.slice(-40) + ovl.w); }
      var c = ovCorners(ovl).map(function (q) { return map.latLngToLayerPoint(toWGS(q[0], q[1])); }), w = ovl.w, h = ovl.h;
      ovImg.style.width = w + "px"; ovImg.style.height = h + "px"; ovImg.style.opacity = ovOpNow();
      ovImg.style.transform = "matrix(" + [(c[1].x - c[0].x) / w, (c[1].y - c[0].y) / w, (c[3].x - c[0].x) / h, (c[3].y - c[0].y) / h, c[0].x, c[0].y].join(",") + ")";
      if (!viewOnly) gcpDraw(); var R = $("#kmOvR"), S2 = $("#kmOvS"), O = $("#kmOvO"); if (document.activeElement !== R) R.value = Math.round(ovl.rot * 100) / 100; if (document.activeElement !== S2) S2.value = Math.round(ovl.mpp * 10000) / 10000; O.value = Math.round((ovl.op || 0.6) * 100);
    }
    /* Passpunkte: Ausgleich, Marker (ziehen, Pfeiltasten 1 cm / Umschalt 10 cm), Liste mit E/N und Restabweichung */
    var gcpLay = null, gcpKeep = false, gcpStay = false;   /* gcpStay: über «Passpunkt hinzufügen» gestartet → Modus bleibt bis «Fertig» */
    /* Geführtes Einpassen: Hausecke im PDF, dieselbe Hausecke auf dem Parzellenplan (Schritt 1–4), danach optional weitere Punkte */
    function gStepNo() { if (mode !== "geo" || !ovl) return 0; var g = ovl.gcp || gcp || []; if (!g.length) return 1; var last = g[g.length - 1]; if (!last.t) return g.length === 1 ? 2 : 4; return g.length === 1 ? 3 : 5; }
    function ovOpNow() { var o = ovl.op || 0.6; if (mode !== "geo") return o; var n = gStepNo(); return n === 2 || n === 4 ? Math.min(o, 0.3) : Math.max(o, 0.75); }   /* PDF-Schritt: Plan gut sichtbar; Parzellenplan-Schritt: Plan abgeschwächt */
    function useParcel() {   /* Einpassen immer auf dem Parzellenplan */
      if (plan || !map) return; if (base !== "kataster" && base !== "av") { base = "kataster"; fillBase(); try { localStorage.setItem("lvd-km-base", "kataster"); } catch (e) { } setBase("kataster"); if (LY) lyBase(); }
      if (map.getZoom() < PARZ_MINZ) map.setZoom(PARZ_MINZ + 1, { animate: false });
    }
    function gstepRender() {
      var host = $("#kmMap"); if (!host) return; var n = gStepNo(), el = host.querySelector(".kmgstep");
      if (!n) { if (el) { el.remove(); if (ovl && ovl.img) ovDraw(); } return; }
      if (!el) { el = document.createElement("div"); el.className = "kmgstep"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); host.appendChild(el); }
      var chips = [1, 2, 3, 4].map(function (i) { var st = n > 4 || i < n ? "done" : i === n ? "now" : "todo"; return '<li class="' + st + '"><b>' + (st === "done" ? "✓" : i) + "</b> " + esc(tt("ov_st" + i)) + "</li>"; }).join("");
      el.innerHTML = '<ol class="kmgchips">' + chips + '</ol><p class="kmgmsg"><span class="kmgwho">' + esc(tt(n === 2 || n === 4 ? "ov_stWhoK" : "ov_stWhoP")) + "</span> " + esc(tt("ov_g" + n)) + "</p>";
      if (ovl && ovl.img) ovDraw();
    }
    function gcpFit() {
      var P = (ovl && ovl.gcp || []).filter(function (g) { return g.t; }); if (P.length < 2) return; var f = ovFit(ovl, P); if (!f) return;
      ovl.mpp = f.mpp; ovl.rot = f.rot; ovl.E = f.E; ovl.N = f.N; ovl.conf = true; ovl.autoSrc = "gcp"; ovl.rms = P.length > 2 ? f.rms : null; P.forEach(function (g, i) { g.r = P.length > 2 ? f.res[i] : null; g.bad = false; }); lyEdited = true;
      if (P.length >= 4) {   /* Ausreisser: jeden Punkt gegen den Ausgleich der übrigen Punkte prüfen */
        var lo = P.map(function (g, i) { var Q = P.filter(function (_, j) { return j !== i; }), f2 = ovFit(ovl, Q); if (!f2) return { e: 0, r: 0 }; var p = ovPx(f2 && Object.assign({}, ovl, f2), g.s[0], g.s[1]); return { e: Math.hypot(p[0] - g.t[0], p[1] - g.t[1]), r: f2.rms }; }), k = 0;
        lo.forEach(function (x, i) { if (x.e > lo[k].e) k = i; }); if (lo[k].e > Math.max(0.15, 4 * lo[k].r)) P[k].bad = true;
      }
    }
    function gcpDraw() {
      if (plan || !map) return; if (!gcpLay) gcpLay = L.layerGroup().addTo(map); gcpLay.clearLayers();
      var P = ovl && ovl.gcp, od = $("#kmOvD"); if (!P || !P.length || !(mode === "geo" || (od && od.open))) return;
      P.forEach(function (g, i) {
        var sp = ovPx(ovl, g.s[0], g.s[1]), mk = function (q, cls, lbl, onMove) {
          var m = L.marker(AD.ll(q), { draggable: true, keyboard: true, title: lbl, alt: lbl, icon: L.divIcon({ className: "kmgcp " + cls, html: "<span>" + (i + 1) + "</span>", iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(gcpLay);
          m.on("dragend", function () { onMove(AD.pt(m.getLatLng())); });
          m.on("click", function (ev) { if (mode === "geo") addPt(ev.latlng); });   /* Klick auf einen Marker setzt im Passpunkt-Modus trotzdem den Punkt (Plan- und Kartenpunkt liegen oft nahe) */
          (function () { var el = m.getElement(); if (!el) return; el.setAttribute("aria-label", lbl); el.addEventListener("keydown", function (ev) { var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key]; if (!d) return; ev.preventDefault(); ev.stopPropagation(); var st = ev.shiftKey ? 0.1 : 0.01; onMove([q[0] + d[0] * st, q[1] + d[1] * st], true);   /* exakt in LV95 (ohne Umweg über WGS84) */ }); })();
          return m;
        };
        if (g.t) L.polyline([AD.ll(sp), AD.ll(g.t)], { color: "#c0392b", weight: 1.5, dashArray: "3 3", interactive: false }).addTo(gcpLay);
        mk(sp, "kmgcps", tt("ov_gS").replace("{n}", i + 1), function (q, kb) { g.s = ovInv(ovl, q[0], q[1]); gcpFit(); ovDraw(); gcpPanel(); if (kb) gcpFocus(i, "s"); });
        if (g.t) mk(g.t, "kmgcpt", tt("ov_gT").replace("{n}", i + 1), function (q, kb) { g.t = [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]; gcpFit(); ovDraw(); gcpPanel(); if (kb) gcpFocus(i, "t"); });
      });
    }
    function gcpFocus(i, k) { setTimeout(function () { var el = gcpLay && gcpLay.getLayers().filter(function (l) { return l.getElement && l.getElement() && l.getElement().classList.contains(k === "s" ? "kmgcps" : "kmgcpt") && l.getElement().textContent === String(i + 1); })[0]; if (el) el.getElement().focus(); }, 0); }
    function gcpPanel() {
      var b = $("#kmGcp"); if (!b) return; var P = ovl && ovl.gcp || []; b.hidden = !ovl || (!P.length && mode !== "geo"); if (b.hidden) { b.innerHTML = ""; return; }
      var f2 = function (v) { return v == null ? "" : (Math.round(v * 1000) / 1000).toFixed(3); }, cm = function (r) { return r == null ? "–" : (r * 100 < 0.5 ? "<1" : String(Math.round(r * 100))) + " cm"; };
      var ok = P.filter(function (g) { return g.t; }), mx = Math.max.apply(null, ok.map(function (g) { return g.r || 0; }).concat([0]));
      b.innerHTML = '<p class="hint">' + esc(tt(ok.length >= 3 ? "ov_gAcc" : "ov_gHint").replace("{r}", cm(ovl.rms))) + "</p>" +
        (P.length ? '<table class="kmgcpt-t"><thead><tr><th scope="col">#</th><th scope="col">E</th><th scope="col">N</th><th scope="col">' + esc(tt("ov_gRes")) + '</th><th scope="col"><span class="vh">' + esc(tt("km_del")) + "</span></th></tr></thead><tbody>" +
          P.map(function (g, i) { var bad = !!g.bad; return "<tr" + (bad ? ' class="warn"' : "") + "><td>" + (i + 1) + '</td><td><input type="text" inputmode="decimal" class="kmn" data-gc="' + i + '" data-ax="0" value="' + f2(g.t && g.t[0]) + '" aria-label="E ' + (i + 1) + '"></td><td><input type="text" inputmode="decimal" class="kmn" data-gc="' + i + '" data-ax="1" value="' + f2(g.t && g.t[1]) + '" aria-label="N ' + (i + 1) + '"></td><td>' + (bad ? "⚠ " : "") + cm(g.r) + '</td><td><button type="button" class="btn ghost small del" data-gx="' + i + '" aria-label="' + esc(tt("ov_gDel").replace("{n}", i + 1)) + '">✕</button></td></tr>'; }).join("") + "</tbody></table>" : "") +
        '<div class="kmbar">' + (mode === "geo" ? '<button type="button" class="btn small" data-gk="end">' + esc(tt("ov_gEnd")) + "</button>" : '<button type="button" class="btn small" data-gk="add">' + esc(tt("ov_gAdd")) + "</button>") + (P.length ? '<button type="button" class="btn ghost small del" data-gk="clr">' + esc(tt("ov_gClr")) + "</button>" : "") + "</div>";
      gcpDraw();
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
    if (opt.focusId) setTimeout(function () { try { if (findObj(opt.focusId)) exSelect(opt.focusId); } catch (e) { } }, 700);   /* aus dem Datensatz geöffnet: Objekt direkt gewählt */
    window.__LYREF = function () { if (dlg.open) refresh(); };   /* Planungsfokus nach Änderungen ausserhalb der Karte (z. B. Preise erfasst) neu zeichnen */
    window.__KM = { shaftInfo: function (id) { var p = byId(M.pts, id), g = p && shaftGeom(p); return g ? { poly: g.poly, extra: g.extra.length, sp: g.sp, px: g.px, ew: p.pt[0], ns: p.pt[1] } : null; }, bandCount: function () { return grp.getLayers().filter(function (x) { return x.options && x.options.dashArray === "6 5"; }).length; }, unfold: function () { folded = {}; rows(); [].slice.call(document.querySelectorAll("#kmObj .kmmore2")).forEach(function (d) { d.open = true; }); }, ov: function () { return ovl; }, M: function () { return M; }, refresh: function () { refresh(); }, select: function (id) { select(id); }, map: function () { return map; }, ll: function (p) { return AD.ll(p); }, fit: function () { fitAll(); } };   /* nur für Tests */
    var MODES = { ruler: "mruler", geo: "mgeo", line: "mline", pt: "mpt", sond: "msond", cal: "mcal", edit: "medit", area: "marea", wl: "mwl", geb: "mgeb", text: "mtext", arrow: "marrow", sline: "msline", rect: "mrect" };
    /* Schachtzeichen: Form nach Bauart (KES/ES Rechteck, ES mit Kreuz, KS Kreis, KS80U gestrichelt, PLS Doppelrand, Sonstige Raute), massstäblich in Leitungsrichtung (Mindestgrösse 14 px);
       Grabenband: gestrichelt grau links/rechts der Leitung, Breite wie im Kostenvoranschlag (KVE.grabenBreite), ab Zoomstufe 17 */
    var BAND_ON = true; try { BAND_ON = localStorage.getItem("lvd-km-band") !== "0"; } catch (e) { }
    function kU() { return plan ? (cal && cal.scale ? 1 / cal.scale : 0) : 1; }   /* Karteneinheiten je Meter */
    function mppNow() { var z = map.getZoom(); if (plan) return (cal && cal.scale ? cal.scale : 0) / Math.pow(2, z); return 156543.03 * Math.cos(map.getCenter().lat * Math.PI / 180) / Math.pow(2, z); }
    function shaftSpec(p) {
      var id = String(p.typ || ""), sz = typeof SIZES !== "undefined" ? SIZES.filter(function (x) { return x.id === id; })[0] : null, l = 1, w = 1, sh = "diamond", cross = false, dash = false;
      if (sz) { var m = /(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)/.exec(sz.dim || ""), r = /Ø\s*(\d+(?:\.\d+)?)/.exec(sz.dim || ""); if (m) { l = +m[1]; w = +m[2]; } else if (r) { l = w = +r[1]; }
        if (sz.id !== "OTHER") { sh = sz.shaft === "KS" ? "circle" : sz.shaft === "PLS" ? "rect2" : "rect"; cross = sz.shaft === "ES"; dash = id === "KS80U"; } }
      var dl = parseFloat(String(p.dl == null ? "" : p.dl).replace(",", ".")), dw = parseFloat(String(p.dw == null ? "" : p.dw).replace(",", ".")); if (!sz || sz.id === "OTHER") { if (dl > 0) l = dl; if (dw > 0) w = dw; }
      return { id: id, l: l, w: w, sh: sh, cross: cross, dash: dash };
    }
    function shaftDir(p) {   /* Richtung der angeschlossenen Leitung am Schacht */
      for (var i = 0; i < M.lines.length; i++) { var l = M.lines[i], n = l.pts.length; if (n < 2) continue; var a = null, b = null; if (l.s === p.id) { a = l.pts[0]; b = l.pts[1]; } else if (l.e === p.id) { a = l.pts[n - 1]; b = l.pts[n - 2]; } if (a) { var u = unitV(a, b); if (u) return u; } }
      for (var j = 0; j < M.lines.length; j++) { var l2 = M.lines[j], n2 = l2.pts.length; if (n2 < 2) continue; if (AD.dist(l2.pts[0], p.pt) < 0.3) { var u2 = unitV(l2.pts[0], l2.pts[1]); if (u2) return u2; } if (AD.dist(l2.pts[n2 - 1], p.pt) < 0.3) { var u3 = unitV(l2.pts[n2 - 1], l2.pts[n2 - 2]); if (u3) return u3; } }
      return [1, 0];
    }
    function shaftGeom(p) {
      var k = kU(), mpp = mppNow(); if (!k || !mpp) return null; var sp = shaftSpec(p), f = Math.max(1, 14 / (Math.min(sp.l, sp.w) / mpp)), hl = sp.l / 2 * f * k, hw = sp.w / 2 * f * k, u = shaftDir(p), v = [-u[1], u[0]], c = p.pt;
      var P = function (a, b) { return [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b]; }, poly, extra = [];
      if (sp.sh === "circle") { poly = []; for (var i = 0; i < 28; i++) { var t = i / 28 * 2 * Math.PI; poly.push(P(hl * Math.cos(t), hw * Math.sin(t))); } }
      else if (sp.sh === "diamond") poly = [P(hl, 0), P(0, hw), P(-hl, 0), P(0, -hw)];
      else { poly = [P(hl, hw), P(hl, -hw), P(-hl, -hw), P(-hl, hw)]; if (sp.cross) extra.push([P(hl, hw), P(-hl, -hw)], [P(hl, -hw), P(-hl, hw)]); if (sp.sh === "rect2") { var q = 0.78; extra.push([P(hl * q, hw * q), P(hl * q, -hw * q), P(-hl * q, -hw * q), P(-hl * q, hw * q), P(hl * q, hw * q)]); } }
      return { poly: poly, extra: extra, sp: sp, px: Math.max(sp.l, sp.w) * f / mpp };
    }
    function shaftSymbols() {
      M.pts.forEach(function (p) {
        var g = shaftGeom(p); if (!g) return; var on = isOn(p.id), col = on ? "#f28c00" : "#0a4f55";
        L.polygon(g.poly.map(AD.ll), { color: col, weight: on ? 3 : 2, fillColor: "#ffffff", fillOpacity: 0.9, dashArray: g.sp.dash ? "5 4" : null, interactive: false }).addTo(grp);
        g.extra.forEach(function (e) { L.polyline(e.map(AD.ll), { color: col, weight: 1.5, interactive: false }).addTo(grp); });
        if (g.sp.id && map.getZoom() >= (plan ? 1 : 18)) L.marker(AD.ll(p.pt), { interactive: false, keyboard: false, zIndexOffset: -400, icon: L.divIcon({ className: "kmshl", html: "<span style=\"top:" + Math.round(g.px / 2 + 3) + "px\">" + esc(g.sp.id + (g.sp.id === "OTHER" ? "" : "")) + " " + g.sp.l.toFixed(2) + "×" + g.sp.w.toFixed(2) + "</span>", iconSize: [0, 0] }) }).addTo(grp);
      });
    }
    function shaftPx(p) { var g = shaftGeom(p); return g ? Math.max(26, Math.min(240, Math.ceil(g.px * 1.05))) : 0; }
    function bandDraw() {
      if (!BAND_ON || map.getZoom() < (plan ? -99 : 17)) return; var k = kU(); if (!k) return;
      M.lines.forEach(function (l) {
        if (l.pts.length < 2 || l.hzArt) return; var c = cfgOf(l); if (c.fl === "roh") return;
        var B = parseFloat(String(c.B == null ? "" : c.B).replace(",", ".")), w = typeof KVE !== "undefined" && KVE.grabenBreite ? KVE.grabenBreite({ bmode: B > 0 ? "manuell" : "min60", bman: B > 0 ? String(B) : "0.6" }).b : (B > 0 ? B : 0.6), d = w / 2 * k;
        [d, -d].forEach(function (off) { L.polyline(offsetPoly(l.pts, off).map(AD.ll), { color: "#6f7f87", weight: 1.3, dashArray: "6 5", opacity: 0.95, interactive: false }).addTo(grp); });
      });
    }
    function draw() {
      grp.clearLayers(); layers = {}; var edit = mode === "edit"; bandDraw();
      M.lines.forEach(function (l) {
        var ll = l.pts.map(AD.ll), on = isOn(l.id), sty = LSTY[cfgOf(l).fl || ""], col = on ? "#0b6b72" : sty[0];
        if (ll.length > 1) {
          var halo = L.polyline(ll, { color: "#fff", weight: 8, interactive: false }).addTo(grp), main = L.polyline(ll, { color: col, weight: on ? 5 : 3.5, dashArray: l.hzArt === "luft" ? "2 8" : l.hzArt === "bohr" ? "10 5 2 5" : (sty[1] || null), lineCap: sty[1] === "1 7" ? "round" : "butt", interactive: edit || !mode, bubblingMouseEvents: false }).addTo(grp);   /* ohne Werkzeug: Linie anklicken = auswählen (Höhenprofil folgt), Verschieben nur im Bearbeiten-Modus */
          layers[l.id] = { upd: function () { var q = l.pts.map(AD.ll); halo.setLatLngs(q); main.setLatLngs(q); } };
          if (edit || !mode) bindObj(main, l.id);
        }
        if (!(edit && (on || hAll()))) ll.forEach(function (q, j) { L.circleMarker(q, { radius: l.id === cur && j === ll.length - 1 ? 6 : 4, color: col, weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
        else handles(l, true, 2);
      });
      M.areas.forEach(function (f) {
        var on = isOn(f.id), col = on ? "#0b6b72" : "#8a5b00", ll = f.pts.map(AD.ll);
        if (ll.length > 2) { var pg = L.polygon(ll, { color: col, weight: on ? 4 : 2.5, fillColor: "#f28c00", fillOpacity: 0.3, interactive: edit, bubblingMouseEvents: false }).addTo(grp); layers[f.id] = { upd: function () { pg.setLatLngs(f.pts.map(AD.ll)); } }; if (edit) bindObj(pg, f.id); }
        else if (ll.length > 1) L.polyline(ll, { color: col, weight: 3, dashArray: "5 4", interactive: false }).addTo(grp);
        if (!(edit && (on || hAll()))) ll.forEach(function (q) { L.circleMarker(q, { radius: 4, color: col, weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
        else handles(f, true, 3, true);
      });
      M.notes.forEach(function (n) {
        var on = isOn(n.id); layers[n.id] = noteLayers(n, edit, on);
        if (edit && on && n.type !== "text") handles(n, n.type === "sline", 2);
      });
      var pm = function (arr, cls, lbl) {
        arr.forEach(function (p, i) {
          var on = isOn(p.id), sp0 = arr === M.pts ? shaftPx(p) : 0, m = L.marker(AD.ll(p.pt), { interactive: edit, draggable: edit, keyboard: false, icon: L.divIcon({ className: cls + (on ? " on" : "") + (arr === M.pts && p.mode && p.mode !== "neu" ? " ex" : "") + (sp0 ? " big" : ""), html: "<span>" + lbl + (i + 1) + "</span>", iconSize: sp0 ? [sp0, sp0] : [26, 26], iconAnchor: sp0 ? [sp0 / 2, sp0 / 2] : [13, 13] }) }).addTo(grp);   /* Klickfläche = Zeichengrösse, Nummer als kleine Marke am Rand */
          if (edit) { dragPt(m, p, "pt"); bindObj(m, p.id, true); }
        });
      };
      shaftSymbols(); pm(M.pts, "kmsch", ""); pm(M.sond, "kmsond", "S"); pm(M.wl, "kmwl", "W"); pm(M.geb, "kmgeb", "G");
      if (labelsOn() && opt.labels) {   /* Beschriftung: Linie mit Name, Länge und Rohranlage; Schächte, Sondagen, Werklöcher, Einführungen, Flächen mit Name */
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
      tmp.forEach(function (q) { L.circleMarker(AD.ll(q), { radius: 5, color: "#0b6b72", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
      if (plan) { calPts.forEach(function (q) { L.circleMarker(AD.ll(q), { radius: 6, color: "#0b6b72", weight: 3, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
        if (cal.a && cal.b && !cal.auto && !calPts.length) L.polyline([AD.ll(cal.a), AD.ll(cal.b)], { color: "#0b6b72", weight: 2, dashArray: "6 5", interactive: false }).addTo(grp); }
      updTotal(); $("#kmUnits").textContent = tt(plan ? "km_unitsPlan" : "km_units");
      Object.keys(MODES).forEach(function (m) { var b = $("[data-k=" + MODES[m] + "]"); if (b) b.setAttribute("aria-pressed", mode === m ? "true" : "false"); });
      $("[data-k=marea]").textContent = mode === "area" ? tt("km_areaOn") : tt("km_area"); $("[data-k=mline]").textContent = mode === "line" ? tt("km_drawOn") : tt("km_draw"); $("[data-k=mpt]").textContent = mode === "pt" ? tt("km_ptOn") : tt("km_pt"); $("[data-k=msond]").textContent = mode === "sond" ? tt("km_sondOn") : tt("km_sond");
      if (plan) $("[data-k=mcal]").textContent = mode === "cal" ? tt("pl_calOn") : tt("pl_cal");
      $("[data-k=end]").disabled = !(cur || curN || curA || (mode === "ruler" && rul.length)); $("[data-k=redo]").disabled = !redoSt.length; $("[data-k=undo]").disabled = !(undoSt.length || tmp.length); $("[data-k=clear]").disabled = !(rul.length || M.lines.length || M.pts.length || M.sond.length || M.notes.length || M.areas.length || M.wl.length || M.geb.length); $("[data-k=center]").disabled = !mode || mode === "edit";
      gstepRender();
      $("#kmHelp").textContent = mode === "ruler" ? tt("km_helpRuler") : mode === "geo" ? tt(!gcp.length ? "ov_g1" : !gcp[gcp.length - 1].t ? (gcp.length === 1 ? "ov_g2" : "ov_g4") : gcp.length === 1 ? "ov_g3" : "ov_g5") : mode === "cal" ? tt("pl_helpCal") : mode === "edit" ? tt("km_helpEdit") : mode === "text" ? tt("km_helpText") : mode === "arrow" || mode === "rect" ? tt("km_helpTwo") : mode ? tt("km_helpOn") : plan && !cal.scale ? tt("pl_calNeed") : base === "av" && !avCfg().u ? tt("km_avHelp") : tt("km_helpOff");
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
      if (mp.clientWidth >= 640) { a.style.left = (cp.x < mp.clientWidth / 2 ? mp.clientWidth - aw - 8 : 8) + mp.offsetLeft + "px"; a.style.top = topPad() + 8 + mp.offsetTop + "px"; }   /* in der von der Klickstelle abgewandten oberen Ecke (unterhalb der Glas-Leisten): verdeckt weder Punkt noch Zeichenrichtung */
      else { var top = cp.y - ah - 10 >= 4 ? cp.y - ah - 10 : cp.y + 14; a.style.left = Math.max(4, Math.min(mp.clientWidth - aw - 4, cp.x - aw / 2)) + mp.offsetLeft + "px"; a.style.top = Math.max(topPad() + 4, Math.min(mp.clientHeight - ah - 4, top)) + mp.offsetTop + "px"; }   /* schmale Karte: am Punkt */
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
        var hz0 = hzOf(l), hzP0 = hz0 && hz0.P, hzL0 = lineLen(l.pts), hzD0 = hzP0 ? (vi >= 0 ? lineLen(l.pts.slice(0, vi + 1)) : lineLen(l.pts.slice(0, idx)) + AD.dist(l.pts[idx - 1], pos)) : 0;
        var l2 = { id: nid("l"), pts: [pos.slice()].concat(l.pts.slice(idx + (vi >= 0 ? 1 : 0))), rid: null, rohr: clone(l.rohr), cfg: clone(cfgOf(l)), e: l.e || null, to: l.to || null, hzArt: l.hzArt, hzF: l.hzF };
        l.pts = l.pts.slice(0, idx).concat([pos.slice()]);
        l.e = p.id; l.to = null; l2.s = p.id; M.lines.splice(M.lines.indexOf(l) + 1, 0, l2); did = l2;
        if (hzP0) { l.hz = hzStats(l, sliceP(hzP0, 0, hzD0)); l2.hz = hzStats(l2, sliceP(hzP0, hzD0, hzL0)); }
      });
      if (did && did !== "x" && !silent) askShow(AD.ll(c), tt("km_sp_title"), [{ t: tt("km_sp_ok"), fn: function () { } }], 0, false, did);
      return p;
    }
    /* Abzweig ohne Schacht auf bestehender Leitung: Rohr(e) entnehmen (Hauptleitung geht mit weniger Rohren weiter) oder T-Stück montieren */
    function tapOptions(base) { var o = []; pipeList(cfgOf(base)).forEach(function (e) { for (var x = 1; x <= Math.min(e[1] - 1, 3); x++) o.push({ dn: e[0], x: x, rest: e[1] - x }); }); return o; }
    function splitTap(base, c, dn, x) {
      var idx = -1; base.pts.forEach(function (q, k) { if (idx < 0 && AD.dist(q, c) <= 0.06) idx = k; }); splitAtIdx(base, idx, dn, x);
    }
    function splitAtIdx(base, idx, dn, x) {   /* Linie am Punkt idx teilen (Knoten ohne Schacht, Kette pv/nx); mit dn/x geht die Hauptleitung danach mit weniger Rohren weiter */
      if (idx <= 0 || idx >= base.pts.length - 1) return false;
      var oldNx = base.nx, l2 = { id: nid("l"), pts: base.pts.slice(idx).map(function (q) { return q.slice(); }), rid: null, rohr: JSON.parse(JSON.stringify(base.rohr)), cfg: JSON.parse(JSON.stringify(cfgOf(base))), pv: base.id, sK: 1, e: base.e || null, to: base.to || null, hzArt: base.hzArt, hzF: base.hzF };
      if (dn) { l2.cfg.rt = l2.cfg.rt || {}; var r = (parseInt(l2.cfg.rt[dn], 10) || 0) - x; if (r > 0) l2.cfg.rt[dn] = r; else delete l2.cfg.rt[dn]; } lineSync(l2);
      base.pts = base.pts.slice(0, idx + 1); base.e = null; base.to = null; base.nx = l2.id; base.eK = 1;
      if (oldNx) { l2.nx = oldNx; l2.eK = 1; var nl = byId(M.lines, oldNx); if (nl) nl.pv = l2.id; }
      if (base.hzH1 != null) { l2.hzH1 = base.hzH1; delete base.hzH1; } delete base.hz;
      if (base.gid) { l2.gid = base.gid; var g = byId(M.geb, base.gid); if (g) g.lid = l2.id; delete base.gid; }
      M.lines.splice(M.lines.indexOf(base) + 1, 0, l2);
      M.lines.forEach(function (o) { if (o === l2 || o === base) return; ["from", "to"].forEach(function (w) { if (o[w] !== base.id) return; var kp = w === "from" ? o.pts[0] : o.pts[o.pts.length - 1], pb = projPoly(base.pts, kp), pl2 = projPoly(l2.pts, kp); if (pl2 && pl2.d <= 0.05 && (!pb || pb.d > 0.05)) o[w] = l2.id; }); });
      return l2;
    }
    /* Zwei Linien zu einer verbinden (Gegenstück zu «Teilen»); Lücke bis 5 m wird geschlossen, die erste Linie behält Belegung/Oberfläche */
    function reverseLine(l) {
      l.pts.reverse(); var t = l.s; l.s = l.e; l.e = t; t = l.from; l.from = l.to; l.to = t; t = l.pv; l.pv = l.nx; l.nx = t; t = l.sK; l.sK = l.eK; l.eK = t; t = l.hzH0; l.hzH0 = l.hzH1; l.hzH1 = t; delete l.hz;
      if (l.gid) { var g = byId(M.geb, l.gid); if (g) delete g.lid; delete l.gid; } ["s", "e", "from", "to", "pv", "nx", "sK", "eK", "hzH0", "hzH1"].forEach(function (k) { if (l[k] === undefined) delete l[k]; });
    }
    function joinLines(a, b, gapMax) {
      if (!a || !b || a === b || a.pts.length < 2 || b.pts.length < 2) return null; var A = a.pts, B = b.pts, g = gapMax == null ? 5 : gapMax;
      var cs = [[AD.dist(A[A.length - 1], B[0]), 0], [AD.dist(A[0], B[B.length - 1]), 1], [AD.dist(A[A.length - 1], B[B.length - 1]), 2], [AD.dist(A[0], B[0]), 3]].sort(function (x, y) { return x[0] - y[0]; })[0];
      if (cs[0] > g) return null;
      var c = cs[1], first = a, second = b; if (c === 1) { first = b; second = a; }
      var jn = c === 0 ? A[A.length - 1] : c === 1 ? B[B.length - 1] : c === 2 ? A[A.length - 1] : A[0];
      if ((c === 0 && a.e && a.e === b.s) || (c === 1 && b.e && b.e === a.s) || (c === 2 && a.e && a.e === b.e) || (c === 3 && a.s && a.s === b.s)) return "shaft";
      if (pipeTxt(cfgOf(a)) !== pipeTxt(cfgOf(b)) || cfgOf(a).fl !== cfgOf(b).fl) { if (!window.confirm(tt("jn_conf").replace("{a}", pipeTxt(cfgOf(first)) || "–").replace("{b}", pipeTxt(cfgOf(second)) || "–"))) return null; }
      snap(); if (c === 2) reverseLine(b); if (c === 3) reverseLine(a);
      if (c === 3) { first = a; second = b; }
      var fp = first.pts.slice(), sp = second.pts.slice(); if (AD.dist(fp[fp.length - 1], sp[0]) <= 0.05) sp.shift();
      first.pts = fp.concat(sp); first.e = second.e || null; first.to = second.to || null; first.nx = second.nx; first.eK = second.eK; if (first.nx === undefined) delete first.nx; if (first.eK === undefined) delete first.eK;
      if (second.hzH1 != null) first.hzH1 = second.hzH1; else delete first.hzH1; delete first.hz;
      if (second.gid) { first.gid = second.gid; var gg = byId(M.geb, second.gid); if (gg) gg.lid = first.id; } else delete first.gid;
      M.lines.forEach(function (o) { if (o === second || o === first) return; ["from", "to", "pv", "nx"].forEach(function (k) { if (o[k] === second.id) o[k] = first.id; }); });
      if (first.pv === second.id) delete first.pv; if (first.nx === first.id) delete first.nx;
      M.lines.splice(M.lines.indexOf(second), 1); if (cur === second.id) cur = null; sel = { id: first.id }; msel = {}; return first;
    }
    function joinNear(l, j) {   /* Anfang/Ende j von Linie l mit der nächsten fremden Linie verbinden */
      if (j !== 0 && j !== l.pts.length - 1) { toast(dlg, tt("jn_endOnly")); return; } var pt = l.pts[j], best = null;
      M.lines.forEach(function (o) { if (o === l || o.pts.length < 2) return; [o.pts[0], o.pts[o.pts.length - 1]].forEach(function (q) { var d = AD.dist(q, pt); if (d <= 5 && (!best || d < best.d)) best = { d: d, o: o }; }); });
      if (!best) { toast(dlg, tt("jn_none")); return; } finishJoin(joinLines(l, best.o));
    }
    function finishJoin(r) { if (r === "shaft") { toast(dlg, tt("jn_shaft")); return; } if (!r) { toast(dlg, tt("jn_none")); return; } refresh(); showProps(r.id); toast(dlg, tt("jn_done"), tt("km_undoBtn"), function () { var b = $("[data-k=undo]"); if (b) b.click(); }); }
    function doTap(l, which, base, c, ch) {
      snap(); var dn = ch.dn || (pipeList(cfgOf(base))[0] || [55])[0], n = ch.mode === "entn" ? ch.x : 1;
      l.cfg = JSON.parse(JSON.stringify(cfgOf(base))); l.cfg.rt = {}; l.cfg.rt[dn] = n; lineSync(l); l.abz = { mode: ch.mode, dn: dn, x: n };
      if (ch.mode === "entn") splitTap(base, c, dn, n); refresh();
    }
    function askTap(l, which) {
      var base = byId(M.lines, l[which]); if (!base || (plan && !cal.scale)) return false; var c = which === "from" ? l.pts[0].slice() : l.pts[l.pts.length - 1].slice(), bn = M.lines.indexOf(base) + 1, items = [];
      var ki = -1; base.pts.forEach(function (q, k) { if (ki < 0 && AD.dist(q, c) <= 0.06) ki = k; }); if (ki <= 0 || ki >= base.pts.length - 1) return false;
      tapOptions(base).forEach(function (o) { items.push({ t: tt("tp_take").replace("{x}", o.x).replace("{dn}", o.dn).replace("{r}", o.rest), fn: function () { doTap(l, which, base, c, { mode: "entn", dn: o.dn, x: o.x }); } }); });
      items.push({ t: tt("tp_tst"), fn: function () { doTap(l, which, base, c, { mode: "tst", dn: (pipeList(cfgOf(base))[0] || [55])[0] }); } });
      if (which === "to") items.push({ t: tt("tp_shaft"), fn: function () { askEnd(l); } });
      items.push({ t: tt("tp_later"), ghost: 1, fn: function () { } });
      askShow(AD.ll(c), tt("tp_title").replace("{n}", bn).replace("{p}", pipeTxt(cfgOf(base)) || "–"), items, 0, false); return true;
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
          l2.cfg.fl = f; if (f === "pflaster") l2.cfg.ab = ""; lastCfg = JSON.parse(JSON.stringify(l2.cfg)); lineSync(l2); M.lines.push(l2); cur = l2.id; sel = { id: l2.id }; mode = "line"; refresh();
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
      var lx = Math.max(4, Math.min(mp.clientWidth - aw - 4, cp.x + 6)), ty = Math.max(topPad() + 4, Math.min(mp.clientHeight - ah - 4, cp.y + 6));
      m.style.left = lx + mp.offsetLeft + "px"; m.style.top = ty + mp.offsetTop + "px";
      m.style.transformOrigin = Math.round(cp.x - lx) + "px " + Math.round(cp.y - ty) + "px";   /* wächst aus dem Klickpunkt (räumliche Herkunft) */
      m.style.animation = "none"; void m.offsetWidth; m.style.animation = "";
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
      var q = h.q, a = l.pts[h.seg], b = l.pts[h.seg + 1];
      if (!q) return;
      if (AD.dist(q, a) < 0.05 && h.seg === 0) { snap(); cfgOf(l).fl = fl; if (fl === "pflaster") cfgOf(l).ab = ""; lastCfg = clone(cfgOf(l)); lineSync(l); sel = { id: l.id }; refresh(); return; }   /* am Linienanfang: ganze Linie */
      if (AD.dist(q, b) < 0.05 && h.seg === l.pts.length - 2) { toast(dlg, tt("km_cx_endNo")); return; }   /* am Ende gibt es nichts zu ändern */
      snap(); var l2 = { id: nid("l"), pts: [q.slice()].concat(l.pts.slice(h.seg + 1)), rid: null, rohr: clone(l.rohr), cfg: clone(cfgOf(l)), e: l.e || null };
      l.pts = l.pts.slice(0, h.seg + 1).concat([q.slice()]); l.e = null; l2.cfg.fl = fl; if (fl === "pflaster") l2.cfg.ab = ""; lastCfg = clone(l2.cfg); lineSync(l2); M.lines.splice(M.lines.indexOf(l) + 1, 0, l2); sel = { id: l2.id }; refresh();
    }
    /* Auswahl wie in CAD: Fenster (ganz innerhalb) und Kreuzen (berührt); Ähnliche auswählen; Auswahlbefehle für die Befehlsleiste */
    function segInRect(a, b, R) {   /* Liang-Barsky */
      var dx = b[0] - a[0], dy = b[1] - a[1], t0 = 0, t1 = 1, P = [-dx, dx, -dy, dy], Q = [a[0] - R.x0, R.x1 - a[0], a[1] - R.y0, R.y1 - a[1]];
      for (var i = 0; i < 4; i++) { if (P[i] === 0) { if (Q[i] < 0) return false; } else { var t = Q[i] / P[i]; if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } } }
      return true;
    }
    function boxSelect(p1, p2, cross) {
      var a = AD.pt(map.containerPointToLatLng(p1)), b = AD.pt(map.containerPointToLatLng(p2)), R = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };
      var inR = function (q) { return q[0] >= R.x0 && q[0] <= R.x1 && q[1] >= R.y0 && q[1] <= R.y1; }, made = {};
      [M.lines, M.areas, M.notes].forEach(function (arr) { (arr || []).forEach(function (o) { var ps = o.pts || []; if (!ps.length) return; var hit = cross ? ps.some(inR) || ps.some(function (q, i) { return i > 0 && segInRect(ps[i - 1], q, R); }) : ps.every(inR); if (hit) made[o.id] = 1; }); });
      [M.pts, M.sond, M.wl, M.geb].forEach(function (arr) { (arr || []).forEach(function (o) { if (o.pt && inR(o.pt)) made[o.id] = 1; }); });
      sel = null; msel = made; refresh(); var n = Object.keys(made).length; toast(dlg, tt("km_sel_n").replace("{n}", n) + (n ? "" : " – " + tt("km_sel_none")));
    }
    function selectSimilar(o) {
      var f = findObj(o.id); if (!f) return; var made = {}, isL = f.arr === M.lines, isS = f.arr === M.pts;
      f.arr.forEach(function (x) { if (isL ? cfgOf(x).fl === cfgOf(o).fl : isS ? x.typ === o.typ : true) made[x.id] = 1; });
      sel = null; msel = made; refresh(); toast(dlg, tt("km_sel_n").replace("{n}", Object.keys(made).length));
    }
    function selCmds() {
      var out = [], pick = function (t, arr, pred) { var made = {}, n = 0; arr.forEach(function (x) { if (!pred || pred(x)) { made[x.id] = 1; n++; } }); return { n: n, run: function () { sel = null; msel = made; refresh(); toast(dlg, tt("km_sel_n").replace("{n}", n)); } }; };
      [["lines", M.lines], ["pts", M.pts], ["wl", M.wl], ["geb", M.geb], ["sond", M.sond], ["areas", M.areas]].forEach(function (a) { var r = pick(a[0], a[1] || []); if (r.n) out.push({ t: tt("km_sel_all").replace("{k}", tt("km_k_" + a[0])).replace("{n}", r.n), run: r.run }); });
      FLS.forEach(function (fl) { var r = pick("l", M.lines, function (x) { return cfgOf(x).fl === fl; }); if (r.n) out.push({ t: tt("km_sel_fl").replace("{f}", tt("km_pal_" + fl)).replace("{n}", r.n), run: r.run }); });
      return out;
    }
    function repeatCmd() {
      if (!lastCmd) { toast(dlg, tt("km_rep_none")); return; }
      if (lastCmd.fn) { lastCmd.fn(); return; } var b = $("[data-k=" + lastCmd.k + "]"); if (b && !b.disabled) b.click();
    }
    /* Rechtsklick auf einen Stützpunkt (Griff): Menü statt sofortigem Löschen; Doppelklick löscht weiterhin */
    function vertexMenu(o, j, e) {
      var n = o.pts.length, isL = M.lines.indexOf(o) >= 0, poly = !isL, minP = isL ? 2 : 3, items = [], q = o.pts[j], cp = map.mouseEventToContainerPoint(e.originalEvent || e);
      if (n > minP) items.push({ t: tt("km_cx_vdel"), fn: function () { snap(); o.pts.splice(j, 1); sel = { id: o.id }; refresh(); } });
      if (j < n - 1 || poly) items.push({ t: tt("km_cx_vins"), fn: function () { var nx = o.pts[(j + 1) % n]; snap(); o.pts.splice(j + 1, 0, [Math.round((q[0] + nx[0]) / 2 * 100) / 100, Math.round((q[1] + nx[1]) / 2 * 100) / 100]); sel = { id: o.id }; refresh(); } });
      if (isL && j > 0 && j < n - 1) items.push({ t: tt("km_cx_vsplit"), fn: function () { snap(); var l2 = { id: nid("l"), pts: o.pts.slice(j).map(function (x) { return x.slice(); }), rid: null, rohr: clone(o.rohr), cfg: clone(cfgOf(o)), e: o.e || null }; o.pts = o.pts.slice(0, j + 1); o.e = null; lineSync(l2); M.lines.splice(M.lines.indexOf(o) + 1, 0, l2); sel = { id: l2.id }; refresh(); } });
      if (isL) items.push({ t: tt("km_cx_branch"), fn: function () { startLineAt(q, { cfg: clone(cfgOf(o)), rohr: clone(o.rohr) }); } });
      ctxShow(cp, tt("km_cx_vtitle").replace("{n}", j + 1), "", items);
    }
    function ctxOpenAt(cp) {
      if (base === "viewer" || mode === "geo" || mode === "cal") return; askHide(); var ll = map.containerPointToLatLng(cp), c = AD.pt(ll), h = hitAt(cp), items = [], title, sub = plan ? "" : tt("km_cx_coord").replace("{e}", fmt0(c[0])).replace("{n}", fmt0(c[1]));
      if (h) {
        var o = h.o; title = h.k === "lines" ? tt("km_lineN").replace("{n}", M.lines.indexOf(o) + 1) : h.k === "pts" ? tt("km_schN").replace("{n}", M.pts.indexOf(o) + 1) : h.k === "wl" ? tt("km_wlN").replace("{n}", M.wl.indexOf(o) + 1) : h.k === "geb" ? tt("km_gebN").replace("{n}", M.geb.indexOf(o) + 1) : tt("km_sondN").replace("{n}", M.sond.indexOf(o) + 1);
        if (!(msel[o.id] && Object.keys(msel).length > 1)) { sel = { id: o.id }; msel = {}; } refresh();   /* Rechtsklick in eine Mehrfachauswahl wirkt auf alle gewählten Objekte, sonst nur auf das getroffene */
        var nSel = selIds().length;
        items.push({ t: tt("km_cx_props"), fn: function () { propsOpen(o, cp); } });
        items.push({ t: tt("km_cx_copy").replace("{n}", nSel), fn: function () { clipCopy(); } });
        if (clip) items.push({ t: tt("km_cx_paste"), fn: function () { clipPaste(c); } });
        items.push({ t: tt("km_cx_sim"), fn: function () { selectSimilar(o); } });
        items.push({ t: tt("km_cx_del").replace("{n}", nSel), fn: function () { delSel(); } });
        if (h.k === "lines") {
          var cur0 = cfgOf(o).fl; FLS.filter(function (f) { return f !== cur0; }).forEach(function (f) { items.push({ t: tt("cx_surf").replace("{f}", tt("km_pal_" + f)), fn: function () { splitLine(o, h, f); } }); });   /* Belagswechsel direkt: «Oberfläche ab hier: Wiese» usw. */
          items.push({ t: tt("km_cx_branch"), fn: function () { startLineAt(h.q, { cfg: clone(cfgOf(o)), rohr: clone(o.rohr) }); } });
        } else if (h.k === "pts") items.push({ t: tt("km_cx_conn"), fn: function () { var l = startLineAt(o.pt, { s: o.id }); } });
        if (!plan) { var sp = h.k === "lines" ? h.q : o.pt, sh = h.k === "lines" ? svBearing(o.pts[h.seg], o.pts[h.seg + 1]) : null; items.push({ t: tt("km_sv_here"), ghost: 1, fn: function () { svOpen(sp, sh, false); } }); if (svKey()) items.push({ t: tt("km_sv_emb"), ghost: 1, fn: function () { svOpen(sp, sh, true); } }); }
      } else {
        title = tt("km_cx_title"); if (lastCmd) items.push({ t: tt("km_cx_rep").replace("{c}", lastCmd.t), fn: repeatCmd }); var lc = cur && byId(M.lines, cur); if (lc && mode === "line") FLS.filter(function (f) { return f !== cfgOf(lc).fl; }).forEach(function (f) { items.push({ t: tt("cx_surf").replace("{f}", tt("km_pal_" + f)), fn: function () { switchSurface(f); } }); });
        items.push({ typ: 1 }, { t: tt("km_cx_sch"), fn: function () { snap(); placeShaft(c); refresh(); } }, { wlt: 1 },
          { t: tt("km_cx_wl"), fn: function () { snap(); var q = { id: nid("w"), pt: c.slice(), sid: null, wt: wlT, name: "", fl: lastCfg.fl || "" }; M.wl.push(q); sel = { id: q.id }; refresh(); } },
          { t: tt("km_cx_geb"), fn: function () { snap(); var gs = gebSnap(cp), q = { id: nid("g"), pt: (gs ? gs.c : c).slice(), sid: null, cm: opt.defGeb.cm, abd: opt.defGeb.abd, name: "", on: gs && gs.line ? gs.line.id : undefined }; M.geb.push(q); sel = { id: q.id }; refresh(); } },
          { t: tt("km_cx_sond"), fn: function () { snap(); var q = { id: nid("s"), pt: c.slice(), name: "", l: "1.0", b: "1.0", t: "1.5" }; M.sond.push(q); sel = { id: q.id }; refresh(); } },
          { t: tt("km_cx_line"), fn: function () { var l = startLineAt(c); askStart(l, c); } },
          { t: tt("km_cx_area"), fn: function () { if (mode !== "area") $("[data-k=marea]").click(); ctxT = 0; addPt(ll); } });
        var nSel2 = selIds().length;
        if (nSel2) items.push({ t: tt("km_cx_copy").replace("{n}", nSel2), fn: function () { clipCopy(); } });
        if (clip) items.push({ t: tt("km_cx_paste"), fn: function () { clipPaste(c); } });
        if (nSel2) items.push({ t: tt("km_cx_del").replace("{n}", nSel2), fn: function () { delSel(); } });
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
      w.setAttribute("aria-label", tt("km_sv")); w.style.right = "8px"; w.style.top = (topPad() + 8) + "px"; w.style.left = "auto";
    }
    function propsOpen(o, cp) {
      var w = $("#kmProps"); if (!w) return; propsId = o.id; w.hidden = false; propsRender();
      var mp = $("#kmMap"), tp0 = topPad() + 4, pw0 = w.offsetWidth || 320, avail = mp.clientHeight - tp0 - 4; w.style.maxHeight = Math.max(160, Math.min(avail, mp.clientHeight * 0.6)) + "px"; var ph0 = Math.min(w.offsetHeight || 240, avail), px0 = Math.max(4, Math.min(mp.clientWidth - pw0 - 4, cp.x + 10)), py0 = Math.max(tp0, Math.min(mp.clientHeight - ph0 - 4, cp.y + 10));   /* immer im sichtbaren Zeichnungsbereich, nahe der Maus */ w.style.left = px0 + mp.offsetLeft + "px"; w.style.top = py0 + mp.offsetTop + "px"; w.style.transformOrigin = Math.round(cp.x - px0) + "px " + Math.round(cp.y - py0) + "px"; w.style.animation = "none"; void w.offsetWidth; w.style.animation = "";
    }
    function propsRender() {
      var w = $("#kmProps"); if (!w || !propsId) return; var f = findObj(propsId), r = f && rowFn ? rowFn(f.o) : null;
      if (!r) { propsClose(); return; }
      w.innerHTML = ""; var hd = document.createElement("div"); hd.className = "kmprops-h"; hd.innerHTML = "<b>" + esc(tt("km_cx_props")) + "</b>"; var x = document.createElement("button"); x.type = "button"; x.className = "btn ghost small"; x.textContent = "×"; x.setAttribute("aria-label", tt("km_cx_close")); x.addEventListener("click", propsClose); hd.appendChild(x);
      w.setAttribute("aria-label", tt("km_cx_props")); w.appendChild(hd); w.appendChild(r);
    }
    function propsKeep() {   /* Eigenschaften-Fenster bleibt vollständig im sichtbaren Zeichnungsbereich (unter den Glas-Leisten, innerhalb der Karte) */
      var w = $("#kmProps"), mp = $("#kmMap"); if (!w || w.hidden || !mp) return; var tp = topPad() + 4, top = parseFloat(w.style.top) - mp.offsetTop, left = parseFloat(w.style.left) - mp.offsetLeft; if (!isFinite(top) || !isFinite(left)) return;
      w.style.maxHeight = Math.max(160, Math.min(mp.clientHeight - tp - 4, mp.clientHeight * 0.6)) + "px"; var h = w.offsetHeight, ww = w.offsetWidth;
      w.style.top = Math.max(tp, Math.min(mp.clientHeight - h - 4, top)) + mp.offsetTop + "px"; w.style.left = Math.max(4, Math.min(mp.clientWidth - ww - 4, left)) + mp.offsetLeft + "px";
    }
    function propsRefresh() { var w = $("#kmProps"); if (w && !w.hidden && propsId) { var a = document.activeElement; if (!(a && w.contains(a) && /INPUT|TEXTAREA/.test(a.tagName))) { propsRender(); propsKeep(); } } }
    function propsClose() { var w = $("#kmProps"); propsId = null; if (w) { w.hidden = true; w.innerHTML = ""; } }
    var fmt0 = function (v) { return Math.round(v).toLocaleString("de-CH"); };
    (function () {
      var mp = $("#kmMap"), tm = null, p0 = null;
      mp.addEventListener("contextmenu", function (e) { e.preventDefault(); if (e.target.closest && e.target.closest(".kmv")) return; if (Date.now() - ctxT < 300) return;   /* Griff: eigenes Menü (vertexMenu) */ ctxT = Date.now(); ctxOpenAt(map.mouseEventToContainerPoint(e)); });
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
      function changed() { snap(); lineSync(l); lastCfg = JSON.parse(JSON.stringify(c)); draw(); costSoon(); paint(); depthSoon(l); if (quick) rows(); var q = $("#kmQuick"); if (q && !q.hidden && q.dataset.lid === l.id) { var ok = $("#kmQuickOk"); if (ok) ok.disabled = cfgMissing(c).length > 0; } }
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
      var linkHint = function (r, txt, cut, which) {
        var gh = document.createElement("p"); gh.className = "hint"; gh.textContent = txt + " "; r.appendChild(gh);
        if (which && cut) { var lb = r.getAttribute("data-rid"), lo = byId(M.lines, lb); if (lo) { var bt = document.createElement("button"); bt.type = "button"; bt.className = "btn ghost small"; bt.textContent = tt("tp_choose"); bt.addEventListener("click", function () { askTap(lo, which); }); gh.appendChild(bt); gh.appendChild(document.createTextNode(" ")); } }
        if (cut) { var b = document.createElement("button"); b.type = "button"; b.className = "btn ghost small"; b.textContent = tt("km_lk_cut"); b.addEventListener("click", function () { snap(); cut(); refresh(); }); gh.appendChild(b); }
      };
      var row_lines = function (l, i) {
        var r = rowOf(l);
        var t = head(r, tt("km_lineN").replace("{n}", i + 1), l.rid); t.insertAdjacentHTML("beforeend", " · " + fmt(effLen(l.pts)) + " m" + (SLOPE && hzOf(l) ? " " + esc(tt("hz_sfx")) : ""));
        var ed = document.createElement("div"); ed.className = "kmled"; r.appendChild(ed); lineEd(l, ed, false);
        if (l.route) linkHint(r, tt("km_rt_lk"), null); if (l.dxf != null) linkHint(r, tt("km_dxfLk").replace("{l}", dxfLbl(l.dxf) || l.dxf || "0") + (l.dxfBel ? " · " + tt("km_dxfBel").replace("{b}", l.dxfBel) : ""), null);   /* Routenlinie entsteht immer ohne Verbindung (kein from/to, kein Schacht); Hinweis ohne Löschen-Knopf */
        [["from", "km_lk_from"], ["to", "km_lk_to"]].forEach(function (a) { var bl = byId(M.lines, l[a[0]]); if (bl) linkHint(r, tt(a[1]).replace("{n}", M.lines.indexOf(bl) + 1), function () { delete l[a[0]]; delete l.abz; if (a[0] === "from") delete l.baseDir; }, a[0]); });
        if (l.abz) { var ab = l.abz, bb = byId(M.lines, l.from || l.to); linkHint(r, ab.mode === "entn" ? tt("tp_hint_entn").replace("{x}", ab.x).replace("{dn}", ab.dn).replace("{n}", bb ? M.lines.indexOf(bb) + 1 : "?") : tt("tp_hint_tst").replace("{n}", bb ? M.lines.indexOf(bb) + 1 : "?"), null); }
        btns(r, l.id); return r;
      };
      M.lines.forEach(function (l, i) { h.appendChild(row_lines(l, i)); });
      var row_pts = function (p, i) {
        var r = rowOf(p); head(r, tt("km_schN").replace("{n}", i + 1), p.sid);
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; }, 1)));
        r.appendChild(cell(tt("km_typ"), sel1(tt("km_typ"), cat.schacht, p.typ, function (v) { p.typ = v; lastTyp = v; rcRender(); draw(); legend(); })));
        if (p.typ === "OTHER" || !p.typ) { r.appendChild(cell(tt("km_shL"), inp(tt("km_shL"), p.dl || "", "kmn", function (v) { p.dl = v.replace(",", ".").trim(); draw(); legend(); }))); r.appendChild(cell(tt("km_shW"), inp(tt("km_shW"), p.dw || "", "kmn", function (v) { p.dw = v.replace(",", ".").trim(); draw(); legend(); }))); }   /* Sonstige: Länge/Breite für das massstäbliche Zeichen (Vorgabe 1.00 × 1.00 m) */
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
        var gl = byId(M.lines, p.lid) || byId(M.lines, p.on); if (gl) { var lk = !!(p.lid && byId(M.lines, p.lid)); linkHint(r, tt(lk ? "km_gl" : "km_gon").replace("{n}", M.lines.indexOf(gl) + 1), lk ? function () { delete gl.gid; delete p.lid; } : null); }
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
        if (n.type === "text") r.appendChild(cell(tt("km_text"), inp(tt("km_text"), n.text || "", "kmw", function (v) { n.text = v; if (layers[n.id]) draw(); }, 1)));
        if (n.type === "text" || n.type === "arrow") {
          r.appendChild(cell(tt("km_size"), sel1(tt("km_size"), [["s", tt("km_sS")], ["m", tt("km_sM")], ["l", tt("km_sLg")]], n.size || "m", function (v) { n.size = v; draw(); })));
        }
        r.appendChild(cell(tt("km_col"), sel1(tt("km_col"), COL.map(function (c) { return [c[0], tt(c[1])]; }), n.color || "#0b6b72", function (v) { n.color = v; draw(); })));
        btns(r, n.id); return r;
      };
      M.notes.forEach(function (n, i) { h.appendChild(row_notes(n, i)); });
      rowFn = function (o) { var i; if ((i = M.lines.indexOf(o)) >= 0) return row_lines(o, i); if ((i = M.pts.indexOf(o)) >= 0) return row_pts(o, i); if ((i = M.sond.indexOf(o)) >= 0) return row_sond(o, i); if ((i = M.wl.indexOf(o)) >= 0) return row_wl(o, i); if ((i = M.geb.indexOf(o)) >= 0) return row_geb(o, i); if ((i = M.areas.indexOf(o)) >= 0) return row_areas(o, i); if ((i = M.notes.indexOf(o)) >= 0) return row_notes(o, i); return null; };
      if (!h.children.length) { var em = document.createElement("p"); em.className = "hint"; em.textContent = tt("ws_emptyObj"); h.appendChild(em); }
      foldRows(h); missList(); propsRefresh();
    }
    /* Einklappen je Objekt: Kopf mit Schalter, Kurzinfo im eingeklappten Zustand; neu gewähltes Objekt klappt auf */
    function foldRows(h) {
      [].slice.call(h.querySelectorAll(".kmrow")).forEach(function (r) {   /* Schnellzugriff: die ersten 4 Felder offen, übrige unter «Weitere Eigenschaften» (Linien haben ihren eigenen Aufbau mit «Weitere Angaben») */
        if (r.querySelector(".kmled") || r.querySelector(".kmmore2")) return;
        var cs = [].slice.call(r.children).filter(function (c) { return c.classList && c.classList.contains("kmc"); }); if (cs.length <= 5) return;
        var dt = document.createElement("details"), sm = document.createElement("summary"); dt.className = "kmmore2"; sm.textContent = tt("km_more2").replace("{n}", cs.length - 4); dt.appendChild(sm);
        r.insertBefore(dt, cs[4]); cs.slice(4).forEach(function (c) { dt.appendChild(c); }); if (dt.querySelector('[aria-invalid="true"]')) dt.open = true;
      });
      if (sel && sel.id !== lastSel) { [].slice.call(h.querySelectorAll(".kmrow")).forEach(function (r) { var k = r.getAttribute("data-rid"); if (k !== sel.id && !msel[k]) folded[k] = true; }); delete folded[sel.id]; }   /* nur das gewählte Element ist offen, die übrigen sind eingeklappt */
      lastSel = sel ? sel.id : null;
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
    var SLOPE = false, GR = 20, PFD = 8, hzBusy = false, hzErr = ""; try { SLOPE = localStorage.getItem("lvd-km-slope") === "1"; } catch (e) { }
    var sigOf = function (pts) { return JSON.stringify(pts); };
    function hzOf(l) { return l.hz && l.hz.sig === sigOf(l.pts) ? l.hz : null; }
    function effLen(pts) { var b0 = lineLen(pts); if (!SLOPE) return b0; var sg = sigOf(pts), l = null; M.lines.forEach(function (x) { if (!l && x.hz && x.hz.sig === sg) l = x; }); return l ? lineSlopeS(l) : b0; }
    function hzCalc(l, arr) {
      var P = arr.filter(function (q) { var a = q.alts || {}; return q.dist != null && (a.COMB != null || a.DTM2 != null || a.DTM25 != null); }).map(function (q) { var a = q.alts; return { d: q.dist, h: a.COMB != null ? a.COMB : a.DTM2 != null ? a.DTM2 : a.DTM25 }; });
      return hzStats(l, P);
    }
    function hzStats(l, P) {   /* P: [{d, h}] ab Linienanfang */
      if (!P || P.length < 2) return null; var L0 = lineLen(l.pts), S = 0, up = 0, mx = 0, i0 = 0;
      for (var i = 1; i < P.length; i++) { var dd = P[i].d - P[i - 1].d, dh = P[i].h - P[i - 1].h; S += Math.hypot(dd, dh); up += Math.abs(dh); }
      var dl = P[P.length - 1].d - P[0].d; if (dl > 0) { S = S * L0 / dl; up = up * L0 / dl; }
      for (var j = 1; j < P.length; j++) { if (P[j].d - P[i0].d >= 20) { mx = Math.max(mx, Math.abs(P[j].h - P[i0].h) / (P[j].d - P[i0].d)); i0 = j; } }
      if (!mx && dl > 0) mx = Math.abs(P[P.length - 1].h - P[0].h) / dl;
      var st = Math.max(1, Math.ceil(P.length / 220)), Q = P.filter(function (q, k) { return k % st === 0 || k === P.length - 1; }).map(function (q) { return [Math.round(q.d * 10) / 10, Math.round(q.h * 100) / 100]; });
      return { sig: sigOf(l.pts), L: L0, S: S, avg: L0 > 0 ? up / L0 * 100 : 0, max: mx * 100, h0: P[0].h, h1: P[P.length - 1].h, P: Q };
    }
    /* Automatisch laden: Linien, deren Verlauf sich seit dem Öffnen geändert hat oder die neu sind (nicht während des Zeichnens/Ziehens); scheitert es, kein Dauer-Wiederholen */
    var HZAUTO = true; try { HZAUTO = localStorage.getItem("lvd-km-hzauto") !== "0"; } catch (e) { }
    var hzSeen = {}, hzSkip = {}, hzAutoT = 0;
    function hzSeed() { M.lines.forEach(function (l) { hzSeen[l.id] = sigOf(l.pts); }); }
    function hzAuto() {
      if (plan || !HZAUTO || hzBusy || !dlg.open) return; clearTimeout(hzAutoT);
      hzAutoT = setTimeout(function () {
        if (hzBusy) return; var todo = M.lines.filter(function (l) {
          if (l.pts.length < 2 || l.id === cur || hzOf(l) || l.hzArt === "luft" || l.hzArt === "bohr") return false; var sg = sigOf(l.pts); if (hzSeen[l.id] === sg || hzSkip[l.id + sg]) return false; return true; });
        if (todo.length) hzLoad(todo, true);
      }, 120);
    }
    function hzLoad(only, auto) {
      if (plan || hzBusy) return; var todo = only || M.lines.filter(function (l) { return l.pts.length > 1 && !hzOf(l); }); if (!only) hzSkip = {}; hzErr = ""; if (!todo.length) { hzRender(); return; } hzBusy = true; hzRender();
      var next = function (i) {
        if (i >= todo.length) { hzBusy = false; hzRender(); rcRender(); refresh(); return; } var l = todo[i], nb = Math.max(2, Math.min(500, Math.ceil(lineLen(l.pts) / 10) + 1));
        fetch("https://api3.geo.admin.ch/rest/services/profile.json?sr=2056&distinct_points=true&nb_points=" + nb + "&geom=" + encodeURIComponent(JSON.stringify({ type: "LineString", coordinates: l.pts })), { mode: "cors" })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { var h = hzCalc(l, j); if (!h) throw 0; l.hz = h; next(i + 1); }).catch(function () {
            hzErr = tt("hz_err"); hzBusy = false; if (auto) { todo.slice(i).forEach(function (x) { hzSkip[x.id + sigOf(x.pts)] = 1; }); if (!dlg.querySelector(".kmtoast button")) toast(dlg, "⚠ " + tt("hz_autoErr"), tt("hz_again"), function () { hzLoad(); }); } hzRender(); });
      }; next(0);
    }
    function hzRender() {
      var h = $("#kmHz"); if (!h) return; var fo = document.activeElement && h.contains(document.activeElement) ? document.activeElement.getAttribute("data-hz") : null, ls = M.lines.filter(function (l) { return l.pts.length > 1; }), ok = ls.filter(function (l) { return hzOf(l); }), stale = ls.some(function (l) { return l.hz && !hzOf(l); });
      var tl = 0, ts = 0, f = function (v) { return (Math.round(v * 10) / 10).toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
      ok.forEach(function (l) { tl += l.hz.L; ts += l.hz.S; });
      h.innerHTML = "<h3>" + esc(tt("hz_h")) + "</h3>" + '<p class="hint">' + esc(tt("hz_hint")) + '</p><div class="kmbar"><button type="button" class="btn small" data-hz="load"' + (hzBusy || !ls.length ? " disabled" : "") + ">" + esc(tt(hzBusy ? "hz_loading" : "hz_load")) + "</button></div>" +
        (hzErr ? '<p class="hint reqmsg" role="alert">' + esc(hzErr) + "</p>" : "") + (stale ? '<p class="hint">' + esc(tt("hz_stale")) + "</p>" : "") +
        (ok.length ? '<table><tbody>' + ok.map(function (l) { var x = l.hz; return "<tr><td>" + esc(tt("km_lineN").replace("{n}", M.lines.indexOf(l) + 1)) + '</td><td class="num">' + esc(tt("hz_row").replace("{l}", f(x.L)).replace("{s}", f(x.S)).replace("{a}", Math.round(x.avg)).replace("{m}", Math.round(x.max))) + "</td></tr>"; }).join("") + "</tbody></table>" +
          '<p class="hint" role="status">' + esc(tt("hz_tot").replace("{l}", f(tl)).replace("{s}", f(ts)).replace("{p}", f(tl ? (ts / tl - 1) * 100 : 0))) + "</p>" +
          '<label class="kmhzm"><input type="checkbox" data-hz="mode"' + (SLOPE ? " checked" : "") + "> " + esc(tt("hz_mode")) + "</label>" : "") +
        '<label class="kmhzm"><input type="checkbox" data-hz="auto"' + (HZAUTO ? " checked" : "") + "> " + esc(tt("hz_auto")) + "</label>";
      if (fo) { var again = h.querySelector('[data-hz="' + fo + '"]'); if (again) again.focus(); }
    }
    /* ---------- Längenprofil unter der Karte: Gelände, Leitung, Abschnittsarten; Schächte setzen/verschieben/löschen ---------- */
    var PF = { on: false, line: null, pick: false }, pfInit = 0, pfDrag = null; try { PF.on = localStorage.getItem("lvd-km-pf") === "1"; } catch (e) { }
    var PFC = { min: "", max: "", ex: true }; try { var pfc0 = JSON.parse(localStorage.getItem("lvd-km-pfc") || "null"); if (pfc0 && typeof pfc0 === "object") PFC = Object.assign(PFC, pfc0); } catch (e) { }
    function pfNum(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; }
    function lineDN(l) { var pl = pipeList(cfgOf(l)), dn = pl.length ? Math.max.apply(null, pl.map(function (e) { return e[0]; })) : parseInt(l.rohr && l.rohr.dn, 10); return dn > 0 ? dn : 55; }
    function coverDefault(l) { var T = pfNum(cfgOf(l).T); if (T == null) T = 0.6; return Math.max(0, T - 0.05 - lineDN(l) / 1000); }   /* Überdeckung bis Rohrscheitel = T − Bettung 5 cm − DN */
    /* Mindest-Überdeckung automatisch einhalten: Grabentiefe T wird (nie gesenkt) auf T = Mindestüberdeckung + 5 cm Bettung + DN angehoben, aufgerundet auf 5 cm.
       Mindestüberdeckung = Feld «Min. Überdeckung» im Höhenprofil, sonst 0.6 m. Ausnahmen: Überdeckung der Linie von Hand gesetzt, Bohrung/Luftleitung, Rohplanie. */
    var touchedL = {}, depthTm = null;
    function minCover() { var m = pfNum(PFC.min); return m != null && m > 0 ? m : 0.6; }
    function needT(l) { var x = minCover() + 0.05 + lineDN(l) / 1000; return Math.round(Math.ceil(x / 0.05 - 1e-9) * 0.05 * 100) / 100; }
    function ensureDepth(l, quiet) {
      if (!l || l.pts.length < 2 || l.hzArt || (l.pfC != null && String(l.pfC).trim() !== "")) return false; var c = cfgOf(l); if (c.fl === "roh") return false;
      var T = pfNum(c.T), need = needT(l); if (T != null && T >= need - 1e-9) return false;
      snap(); c.T = need.toFixed(2); lineSync(l); lastCfg = JSON.parse(JSON.stringify(c));
      if (!quiet) toast(dlg, tt("km_depthUp").replace("{t}", need.toFixed(2)).replace("{c}", String(minCover())).replace("{dn}", lineDN(l)), tt("km_undoBtn"), function () { var b = $("[data-k=undo]"); if (b) b.click(); });
      return true;
    }
    function depthSoon(l) { touchedL[l.id] = 1; clearTimeout(depthTm); depthTm = setTimeout(function () { if (byId(M.lines, l.id) && ensureDepth(l)) { draw(); costSoon(); rows(); } }, 1100); }   /* erst nach einer Pause, damit das Tippen nicht gestört wird */
    function coverOf(l) { var o = pfNum(l.pfC); return o != null ? o : coverDefault(l); }
    function hAtP(P, d) { if (!P || !P.length) return null; if (d <= P[0][0]) return P[0][1]; for (var i = 1; i < P.length; i++) if (P[i][0] >= d) { var t = (d - P[i - 1][0]) / ((P[i][0] - P[i - 1][0]) || 1); return P[i - 1][1] + t * (P[i][1] - P[i - 1][1]); } return P[P.length - 1][1]; }
    function sliceP(P, d0, d1) {   /* Teilprofil [d0,d1], Stationen ab d0, Randpunkte interpoliert */
      var o = [{ d: 0, h: hAtP(P, d0) }]; P.forEach(function (q) { if (q[0] > d0 + 1e-6 && q[0] < d1 - 1e-6) o.push({ d: q[0] - d0, h: q[1] }); }); o.push({ d: d1 - d0, h: hAtP(P, d1) }); return o;
    }
    function posAt(pts, d) {   /* Punkt und Abschnittsindex in Abstand d vom Anfang */
      var acc = 0; for (var i = 1; i < pts.length; i++) { var sl = AD.dist(pts[i - 1], pts[i]); if (sl > 0 && acc + sl >= d - 1e-9) { var t = Math.max(0, Math.min(1, (d - acc) / sl)); return { c: [pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])], seg: i - 1 }; } acc += sl; }
      return { c: pts[pts.length - 1].slice(), seg: pts.length - 2 };
    }
    function dedupe(pts) { return pts.filter(function (p, i) { return !i || AD.dist(p, pts[i - 1]) > 0.005; }); }
    function chainOf(l0) {   /* durchgehender Strang über Schächte mit genau einer ankommenden und einer abgehenden Linie */
      var ch = [l0], seen = {}; seen[l0.id] = 1;
      var link = function (p) { var ins = M.lines.filter(function (x) { return x.e === p; }), outs = M.lines.filter(function (x) { return x.s === p; }); return ins.length === 1 && outs.length === 1 && ins[0] !== outs[0] ? [ins[0], outs[0]] : null; };
      for (var a = l0; ;) { if (!a.s && a.pv) { var pl = byId(M.lines, a.pv); if (!pl || pl.nx !== a.id || seen[pl.id]) break; ch.unshift(pl); seen[pl.id] = 1; a = pl; continue; } if (!a.s) break; var k = link(a.s); if (!k || k[1] !== a || seen[k[0].id]) break; ch.unshift(k[0]); seen[k[0].id] = 1; a = k[0]; }
      for (var z = l0; ;) { if (!z.e && z.nx) { var nl = byId(M.lines, z.nx); if (!nl || nl.pv !== z.id || seen[nl.id]) break; ch.push(nl); seen[nl.id] = 1; z = nl; continue; } if (!z.e) break; var k2 = link(z.e); if (!k2 || k2[0] !== z || seen[k2[1].id]) break; ch.push(k2[1]); seen[k2[1].id] = 1; z = k2[1]; }
      return ch;
    }
    function splitAtDist(l, d) {
      var L0 = lineLen(l.pts); if (!(d > 0.5 && d < L0 - 0.5)) return null; var h = hzOf(l), P = h && h.P, pa = posAt(l.pts, d), c = [Math.round(pa.c[0] * 100) / 100, Math.round(pa.c[1] * 100) / 100];
      var p = newShaft(c, "neu"), l2 = { id: nid("l"), pts: dedupe([c.slice()].concat(l.pts.slice(pa.seg + 1))), rid: null, rohr: clone(l.rohr), cfg: clone(cfgOf(l)), e: l.e || null, to: l.to || null, hzArt: l.hzArt, hzF: l.hzF };
      l.pts = dedupe(l.pts.slice(0, pa.seg + 1).concat([c.slice()])); l.e = p.id; l.to = null; l2.s = p.id; delete l.hzH0; delete l.hzH1; M.lines.splice(M.lines.indexOf(l) + 1, 0, l2);
      if (P) { l.hz = hzStats(l, sliceP(P, 0, d)); l2.hz = hzStats(l2, sliceP(P, d, L0)); } return p;
    }
    function nodeLines(p) { var ins = M.lines.filter(function (x) { return x.e === p.id; }), outs = M.lines.filter(function (x) { return x.s === p.id; }); return ins.length === 1 && outs.length === 1 && ins[0] !== outs[0] ? { a: ins[0], b: outs[0] } : null; }
    function moveShaft(p, dGlobalFromA) {   /* Abstand ab Anfang der ankommenden Linie */
      var n = nodeLines(p); if (!n) return false; var a = n.a, b = n.b, La = lineLen(a.pts), Lb = lineLen(b.pts), tot = La + Lb; if (!(dGlobalFromA > 0.5 && dGlobalFromA < tot - 0.5)) return false;
      var ha = hzOf(a), hb = hzOf(b), Pc = ha && hb && ha.P && hb.P ? ha.P.concat(hb.P.map(function (q) { return [q[0] + La, q[1]]; })) : null, comb = dedupe(a.pts.concat(b.pts.slice(1))), pa = posAt(comb, dGlobalFromA), c = [Math.round(pa.c[0] * 100) / 100, Math.round(pa.c[1] * 100) / 100];
      a.pts = dedupe(comb.slice(0, pa.seg + 1).concat([c.slice()])); b.pts = dedupe([c.slice()].concat(comb.slice(pa.seg + 1))); p.pt = c; delete a.hzH1; delete b.hzH0;
      if (Pc) { a.hz = hzStats(a, sliceP(Pc, 0, dGlobalFromA)); b.hz = hzStats(b, sliceP(Pc, dGlobalFromA, tot)); } return true;
    }
    function deleteShaft(p) {
      var n = nodeLines(p); if (!n) return false; var a = n.a, b = n.b; if (pipeTxt(cfgOf(a)) !== pipeTxt(cfgOf(b)) && !window.confirm(tt("pf_delconf"))) return null;
      var La = lineLen(a.pts), ha = hzOf(a), hb = hzOf(b), Pc = ha && hb && ha.P && hb.P ? ha.P.concat(hb.P.map(function (q) { return [q[0] + La, q[1]]; })) : null;
      a.pts = dedupe(a.pts.concat(b.pts.slice(1))); a.e = b.e || null; a.to = b.to || null; M.lines.splice(M.lines.indexOf(b), 1); M.pts.splice(M.pts.indexOf(p), 1); if (sel && (sel.id === p.id || sel.id === b.id)) sel = { id: a.id };
      if (Pc) a.hz = hzStats(a, Pc.map(function (q) { return { d: q[0], h: q[1] }; })); else delete a.hz; return true;
    }
    function pfData() {
      var ls = M.lines.filter(function (l) { return l.pts.length > 1; }); if (!ls.length) return null;
      var sl = selIds().map(function (id) { return byId(ls, id); }).filter(Boolean), key = sl.map(function (l) { return l.id; }).join(",");
      if (key !== PF.selKey) { PF.selKey = key; if (key) { PF.line = null; PF.follow = sl[0].id; } }   /* neue Auswahl: Profil folgt ihr (manuelle Wahl im Auswahlfeld gilt bis zur nächsten Auswahl) */
      var multi = !PF.line && sl.length > 1, l0 = multi ? sl[0] : (PF.line && byId(ls, PF.line)) || (PF.follow && byId(ls, PF.follow)) || ls[0], off = 0, pcs = [];
      (multi ? sl : chainOf(l0)).forEach(function (l) { var L0 = lineLen(l.pts), h = hzOf(l); pcs.push({ l: l, off: off, L: L0, h: h && h.P ? h : null }); off += L0; });
      return { pcs: pcs, total: off, l0: l0, multi: multi };
    }
    function pfLoadActive() {   /* Höhen der aktiven Linie(n) immer laden – unabhängig von «automatisch laden»; Fehlschläge nicht wiederholen */
      if (plan || hzBusy || !dlg.open) return; var D0 = pfData(); if (!D0) return;
      var need = D0.pcs.filter(function (pc) { var l = pc.l; return !pc.h && l.id !== cur && l.hzArt !== "luft" && l.hzArt !== "bohr" && !hzSkip[l.id + sigOf(l.pts)]; }).map(function (pc) { return pc.l; });
      if (need.length) hzLoad(need, true);
    }
    function niceStep(span, n) { var raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / mag; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag; }
    var pfGeo = null;
    function pfRender() {
      var host = $("#kmProf"); if (!host) return; if (LY) PF.on = lyD.t === "prof" && !lyD.c; host.hidden = !PF.on; var tb = $("[data-pfb]"); if (tb) tb.setAttribute("aria-pressed", PF.on ? "true" : "false"); if (!PF.on) return;
      var fo = document.activeElement && host.contains(document.activeElement) ? (document.activeElement.getAttribute("data-p") ? "m:" + document.activeElement.getAttribute("data-p") : document.activeElement.getAttribute("data-pf") ? "c:" + document.activeElement.getAttribute("data-pf") + ":" + (document.activeElement.getAttribute("data-lid") || "") : null) : null;
      var D0 = pfData(), f1 = function (v) { return (Math.round(v * 10) / 10).toLocaleString("de-CH"); };
      var ctl = '<div class="kmpfctl"><label>' + esc(tt("pf_line")) + ' <select data-pf="line">' + (D0 && D0.multi ? '<option value="__sel" selected>' + esc(tt("pf_selN").replace("{n}", D0.pcs.length).replace("{m}", fmt(D0.total))) + "</option>" : "") + M.lines.filter(function (l) { return l.pts.length > 1; }).map(function (l) { return '<option value="' + l.id + '"' + (D0 && !D0.multi && D0.l0 === l ? " selected" : "") + ">" + esc(tt("km_lineN").replace("{n}", M.lines.indexOf(l) + 1) + " · " + fmt(lineLen(l.pts)) + " m") + "</option>"; }).join("") + "</select></label>" +
        '<div class="kmbar"><button type="button" class="btn small" data-pf="load"' + (hzBusy ? " disabled" : "") + ">" + esc(tt(hzBusy ? "hz_loading" : "hz_load")) + '</button> <button type="button" class="btn ghost small" data-pf="pick" aria-pressed="' + (PF.pick ? "true" : "false") + '">' + esc(tt("pf_pick")) + "</button></div>" + '<p class="hint">' + esc(tt("pf_pickh")) + "</p>" + '<div class="kmpfh"><label>' + esc(tt("pf_covmin")) + ' <input type="text" inputmode="decimal" size="4" data-pf="covmin" value="' + esc(PFC.min) + '" placeholder="–"></label> <label>' + esc(tt("pf_covmax")) + ' <input type="text" inputmode="decimal" size="4" data-pf="covmax" value="' + esc(PFC.max) + '" placeholder="–"></label> <label class="kmpfck"><input type="checkbox" data-pf="ex"' + (PFC.ex ? " checked" : "") + "> " + esc(tt("pf_ex")) + '</label></div><p class="hint">' + esc(tt("pf_covh")) + "</p>";
      if (!D0) { host.innerHTML = '<div class="kmpfin">' + ctl + "</div></div>"; return; }
      var rows = D0.pcs.map(function (pc) {
        var l = pc.l, n = M.lines.indexOf(l) + 1, h = pc.h, art = l.hzArt || "g", id = ' data-lid="' + l.id + '"';
        var r = "<tr><td>" + esc(tt("km_lineN").replace("{n}", n)) + "</td><td>" + (h ? esc(tt("pf_row").replace("{l}", f1(pc.L)).replace("{s}", f1(lineSlopeS(l) || pc.L))) : esc(tt("pf_stale"))) + "</td><td><select data-pf=\"art\"" + id + " aria-label=\"" + esc(tt("pf_art") + " " + n) + "\">" + [["g", "pf_art_g"], ["luft", "pf_art_l"], ["bohr", "pf_art_b"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === art ? " selected" : "") + ">" + esc(tt(o[1])) + "</option>"; }).join("") + "</select>";
        if (art === "g") r += '<div class="kmpfh"><label>' + esc(tt("pf_cov")) + ' <input type="text" inputmode="decimal" size="5" data-pf="cov"' + id + ' value="' + esc(l.pfC != null ? l.pfC : "") + '" placeholder="' + f1(coverDefault(l)) + '"></label></div>';
        if (art !== "g" && h) r += '<div class="kmpfh"><label>' + esc(tt("pf_h0")) + ' <input type="text" inputmode="decimal" size="6" data-pf="h0"' + id + ' value="' + esc(l.hzH0 != null ? l.hzH0 : "") + '" placeholder="' + f1(h.h0) + '"></label> <label>' + esc(tt("pf_h1")) + ' <input type="text" inputmode="decimal" size="6" data-pf="h1"' + id + ' value="' + esc(l.hzH1 != null ? l.hzH1 : "") + '" placeholder="' + f1(h.h1) + '"></label>' + (art === "luft" ? ' <label>' + esc(tt("pf_f")) + ' <input type="text" inputmode="decimal" size="4" data-pf="f"' + id + ' value="' + esc(l.hzF != null ? l.hzF : "") + '" placeholder="3.5"></label>' : "") + "</div>";
        return r + "</td></tr>";
      }).join("");
      var ok = D0.pcs.filter(function (pc) { return pc.h; }); var svg;
      if (!ok.length) svg = '<p class="none kmpfnone">' + esc(tt("pf_none")) + "</p>";
      else {
        var W = Math.max(320, Math.round(($("#kmPfSvg") ? $("#kmPfSvg").getBoundingClientRect().width : 0) || (host.clientWidth ? host.clientWidth - 330 : 640))), H = 190, ml = 46, mr = 12, mt = 10, mb = 24, hs = [];
        D0.pcs.forEach(function (pc) { if (pc.h) { pc.h.P.forEach(function (q) { hs.push(q[1]); if (!pc.l.hzArt) hs.push(q[1] - (coverOf(pc.l) + lineDN(pc.l) / 2000) * (PFC.ex ? 10 : 1)); }); var l = pc.l; if (l.hzArt && l.hzArt !== "g") { var a0 = parseFloat(l.hzH0), a1 = parseFloat(l.hzH1); if (isFinite(a0)) hs.push(a0); if (isFinite(a1)) hs.push(a1); } } });
        var hmin = Math.min.apply(null, hs), hmax = Math.max.apply(null, hs), pad = Math.max(1, (hmax - hmin) * .12); hmin -= pad; hmax += pad;
        var sx = (W - ml - mr) / (D0.total || 1), sy = (H - mt - mb) / (hmax - hmin), X = function (s) { return ml + s * sx; }, Y = function (h) { return mt + (hmax - h) * sy; };
        pfGeo = { ml: ml, sx: sx, W: W, D0: D0, Y: Y, hmax: hmax, hmin: hmin, sy: sy };
        var o = '<svg id="kmPfSvg" class="kmpfsvg" viewBox="0 0 ' + W + " " + H + '" width="100%" height="' + H + '" role="group" aria-label="' + esc(tt("pf_title")) + '" preserveAspectRatio="none">';
        var xs = niceStep(D0.total, 7), ys = niceStep(hmax - hmin, 4);
        for (var xv = 0; xv <= D0.total + 1e-6; xv += xs) o += '<line class="pfg" x1="' + X(xv) + '" y1="' + mt + '" x2="' + X(xv) + '" y2="' + (H - mb) + '"/><text class="pfx" x="' + X(xv) + '" y="' + (H - 8) + '" text-anchor="middle">' + Math.round(xv) + "</text>";
        for (var yv = Math.ceil(hmin / ys) * ys; yv <= hmax; yv += ys) o += '<line class="pfg" x1="' + ml + '" y1="' + Y(yv) + '" x2="' + (W - mr) + '" y2="' + Y(yv) + '"/><text class="pfx" x="' + (ml - 4) + '" y="' + (Y(yv) + 4) + '" text-anchor="end">' + Math.round(yv) + "</text>";
        o += '<text class="pfx" x="' + (W - mr) + '" y="' + (H - 1) + '" text-anchor="end">m</text><text class="pfx" x="2" y="' + (mt + 4) + '">m ü. M.</text>';
        D0.pcs.forEach(function (pc) {
          if (!pc.h) { var ym = (H - mb + mt) / 2; o += '<line class="pfn" x1="' + X(pc.off) + '" y1="' + ym + '" x2="' + X(pc.off + pc.L) + '" y2="' + ym + '"/>'; return; }
          var P = pc.h.P, pts = P.map(function (q) { return X(pc.off + q[0]).toFixed(1) + "," + Y(q[1]).toFixed(1); }).join(" "), l = pc.l, art = l.hzArt || "g";
          o += '<polygon class="pft" points="' + X(pc.off).toFixed(1) + "," + (H - mb) + " " + pts + " " + X(pc.off + pc.L).toFixed(1) + "," + (H - mb) + '"/>';
          if (art === "g") { var cvr = coverOf(l), dep = (cvr + lineDN(l) / 2000) * (PFC.ex ? 10 : 1); o += '<polyline class="pfgl" points="' + pts + '"/><polyline class="pfl" points="' + P.map(function (q) { return X(pc.off + q[0]).toFixed(1) + "," + Y(q[1] - dep).toFixed(1); }).join(" ") + '"/>'; }
          else {
            o += '<polyline class="pfr" points="' + pts + '"/>';
            var a0 = parseFloat(l.hzH0), a1 = parseFloat(l.hzH1), y0 = Y(isFinite(a0) ? a0 : pc.h.h0), y1 = Y(isFinite(a1) ? a1 : pc.h.h1), xa = X(pc.off), xb = X(pc.off + pc.L), f = (parseFloat(String(l.hzF).replace(",", ".")) || 3.5) / 100 * pc.L * sy;
            o += art === "luft" ? '<path class="pfa" d="M' + xa + " " + y0 + " Q" + (xa + xb) / 2 + " " + ((y0 + y1) / 2 + 2 * f) + " " + xb + " " + y1 + '"/>' : '<line class="pfa pfb" x1="' + xa + '" y1="' + y0 + '" x2="' + xb + '" y2="' + y1 + '"/>';
          }
        });
        D0.pcs.forEach(function (pc, i) {
          var nodes = []; if (i < D0.pcs.length - 1) { var p = M.pts.filter(function (q) { return q.id === pc.l.e; })[0]; if (p) nodes.push([p, pc.off + pc.L, true]); } if (i === 0 && pc.l.s) { var p0 = M.pts.filter(function (q) { return q.id === pc.l.s; })[0]; if (p0) nodes.push([p0, pc.off, false]); } if (i === D0.pcs.length - 1 && pc.l.e) { var p1 = M.pts.filter(function (q) { return q.id === pc.l.e; })[0]; if (p1) nodes.push([p1, pc.off + pc.L, false]); }
          nodes.forEach(function (nd) { var p = nd[0], s = nd[1], hh = hAtP((pc.h || {}).P, s - pc.off) , nx = D0.pcs[i + 1]; if (hh == null && nx && nx.h) hh = hAtP(nx.h.P, 0); var y = hh != null ? Y(hh) : (H - mb + mt) / 2, nr = M.pts.indexOf(p) + 1;
            o += '<g class="pfm' + (nd[2] ? "" : " pffix") + '" data-p="' + p.id + '" transform="translate(' + X(s).toFixed(1) + ' 0)"' + (nd[2] ? ' tabindex="0" role="button" aria-label="' + esc(tt("pf_sch").replace("{n}", nr).replace("{s}", f1(s)) + (nd[2] ? " – " + tt("pf_key") : "")) + '"' : "") + '><line class="pfv" x1="0" y1="' + mt + '" x2="0" y2="' + (H - mb) + '"/><rect x="-8" y="' + (y - 8).toFixed(1) + '" width="16" height="16" rx="3"/><text x="0" y="' + (y + 4).toFixed(1) + '" text-anchor="middle">' + nr + "</text></g>"; });
        });
        o += '<line class="pfcur" id="kmPfCur" x1="0" y1="' + mt + '" x2="0" y2="' + (H - mb) + '" hidden/></svg><div class="pftip" id="kmPfTip" aria-hidden="true">&nbsp;</div><div class="pflg"><span class="pflg1 g">' + esc(tt("pf_lg_t")) + '</span> <span class="pflg1 r">' + esc(tt("pf_lg_r")) + (PFC.ex ? " (" + esc(tt("pf_ex")) + ")" : "") + '</span> <span class="pflg1 a">' + esc(tt("pf_lg_a")) + '</span></div>';
        svg = o;
      }
      host.innerHTML = '<div class="kmpfmain">' + svg + '</div><div class="kmpfin">' + ctl + '<table class="kmpft"><tbody>' + rows + "</tbody></table></div></div>";
      if (fo) { var again = fo.indexOf("m:") === 0 ? host.querySelector('[data-p="' + fo.slice(2) + '"]') : host.querySelector('[data-pf="' + fo.split(":")[1] + '"]' + (fo.split(":")[2] ? '[data-lid="' + fo.split(":")[2] + '"]' : "")); if (again) again.focus(); }
    }
    function pfStation(e) { var sv = $("#kmPfSvg"); if (!sv || !pfGeo) return null; var r = sv.getBoundingClientRect(), x = (e.clientX - r.left) * (pfGeo.W / (r.width || 1)); return Math.max(0, Math.min(pfGeo.D0.total, (x - pfGeo.ml) / pfGeo.sx)); }
    function pfTip(s) {
      var D0 = pfGeo && pfGeo.D0; if (!D0) return ""; var pc = D0.pcs.filter(function (q) { return s >= q.off - 1e-6 && s <= q.off + q.L + 1e-6; })[0]; if (!pc || !pc.h) return ""; var d = s - pc.off, h = hAtP(pc.h.P, d), h2 = hAtP(pc.h.P, Math.min(pc.L, d + 10)), h1 = hAtP(pc.h.P, Math.max(0, d - 10)), g = (h2 - h1) / ((Math.min(pc.L, d + 10) - Math.max(0, d - 10)) || 1) * 100;
      var cvt = !pc.l.hzArt ? " · " + tt("pf_covtip").replace("{c}", (Math.round(coverOf(pc.l) * 100) / 100).toLocaleString("de-CH")) : ""; return tt("pf_tip").replace("{s}", (Math.round(s * 10) / 10).toLocaleString("de-CH")).replace("{h}", (Math.round(h * 10) / 10).toLocaleString("de-CH")).replace("{g}", (Math.round(g * 10) / 10).toLocaleString("de-CH")) + cvt;
    }
    function pfCommit(fn) { snap(); var ok = fn(); if (ok === false || ok === null) { undoSt.pop(); } else { refresh(); } pfRender(); return ok; }
    function pfStationOf(p) { var D0 = pfGeo && pfGeo.D0; if (!D0) return null; for (var i = 0; i < D0.pcs.length - 1; i++) if (D0.pcs[i].l.e === p.id) return { s: D0.pcs[i + 1].off, i: i }; return null; }
    function pfWire() {
      var host = $("#kmProf"), tb = $("[data-pfb]"); if (!host) return;
      if (tb) tb.addEventListener("click", function () { PF.on = !PF.on; try { localStorage.setItem("lvd-km-pf", PF.on ? "1" : "0"); } catch (e) { } pfRender(); setTimeout(function () { try { map.invalidateSize(); } catch (e) { } }, 0); });
      host.addEventListener("click", function (e) {
        var b = e.target.closest("[data-pf]"); if (!b) return; var k = b.getAttribute("data-pf");
        if (k === "load") hzLoad(); else if (k === "pick") { PF.pick = !PF.pick; pfRender(); }
      });
      host.addEventListener("change", function (e) {
        var b = e.target.closest("[data-pf]"); if (!b) return; var k = b.getAttribute("data-pf"), l = byId(M.lines, b.getAttribute("data-lid"));
        if (k === "line") { PF.line = b.value === "__sel" ? null : b.value; if (!PF.line) PF.selKey = null; pfRender(); pfLoadActive(); return; }
        if (k === "covmin" || k === "covmax" || k === "ex") { if (k === "ex") PFC.ex = b.checked; else PFC[k === "covmin" ? "min" : "max"] = String(b.value).trim(); try { localStorage.setItem("lvd-km-pfc", JSON.stringify(PFC)); } catch (x) { } rcRender(); pfRender(); return; }
        if (!l) return; snap();
        if (k === "art") { if (b.value === "g") { delete l.hzArt; delete l.hzH0; delete l.hzH1; delete l.hzF; } else l.hzArt = b.value; }
        else { var v = String(b.value).replace(",", ".").trim(); if (v === "" || !isFinite(parseFloat(v))) delete l[{ h0: "hzH0", h1: "hzH1", f: "hzF", cov: "pfC" }[k]]; else l[{ h0: "hzH0", h1: "hzH1", f: "hzF", cov: "pfC" }[k]] = v; }
        refresh(); pfRender();
      });
      host.addEventListener("pointermove", function (e) {
        var sv = $("#kmPfSvg"); if (!sv || !e.target.closest("#kmPfSvg")) return; var s = pfStation(e); if (s == null) return;
        if (pfDrag) { var D0 = pfGeo.D0, a = D0.pcs[pfDrag.i], b = D0.pcs[pfDrag.i + 1]; s = Math.max(a.off + 1, Math.min(b.off + b.L - 1, s)); pfDrag.s = s; var g = sv.querySelector('[data-p="' + pfDrag.id + '"]'); if (g) g.setAttribute("transform", "translate(" + (pfGeo.ml + s * pfGeo.sx).toFixed(1) + " 0)"); var R = richt(), da = s - a.off, db = b.off + b.L - s; $("#kmPfTip").innerHTML = esc(tt("pf_dist").replace("{a}", (Math.round(da * 10) / 10).toLocaleString("de-CH")).replace("{b}", (Math.round(db * 10) / 10).toLocaleString("de-CH"))) + (da > R || db > R ? " ⚠ " + esc(tt("pf_over").replace("{r}", R)) : ""); return; }
        var cu = $("#kmPfCur"); if (cu) { cu.setAttribute("x1", pfGeo.ml + s * pfGeo.sx); cu.setAttribute("x2", pfGeo.ml + s * pfGeo.sx); cu.removeAttribute("hidden"); } var tp = $("#kmPfTip"); if (tp) tp.textContent = pfTip(s) || " ";
      });
      host.addEventListener("pointerdown", function (e) {
        var sv = e.target.closest("#kmPfSvg"); if (!sv || !pfGeo) return; var m = e.target.closest(".pfm"); if (m && !m.classList.contains("pffix")) { var id = m.getAttribute("data-p"), p = byId(M.pts, id), st = p && pfStationOf(p); if (st) { pfDrag = { id: id, i: st.i, s: st.s }; try { sv.setPointerCapture(e.pointerId); } catch (x) { } e.preventDefault(); } return; }
        if (PF.pick) { var s = pfStation(e); var pc = pfGeo.D0.pcs.filter(function (q) { return s >= q.off && s <= q.off + q.L; })[0]; if (pc) pfCommit(function () { return splitAtDist(pc.l, s - pc.off) ? true : false; }); }
      });
      host.addEventListener("pointerup", function (e) { if (!pfDrag) return; var dr = pfDrag; pfDrag = null; var p = byId(M.pts, dr.id), a = pfGeo && pfGeo.D0.pcs[dr.i]; if (p && a) { var s0 = pfStationOf(p); if (!s0 || Math.abs(s0.s - dr.s) > 0.05) pfCommit(function () { return moveShaft(p, dr.s - a.off); }); else pfRender(); } });
      host.addEventListener("keydown", function (e) {
        var m = e.target.closest && e.target.closest(".pfm"); if (!m || m.classList.contains("pffix")) return; var p = byId(M.pts, m.getAttribute("data-p")), st = p && pfStationOf(p); if (!st) return;
        var stp = e.shiftKey ? 10 : 1, a = pfGeo.D0.pcs[st.i];
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); var ns = st.s + (e.key === "ArrowRight" ? stp : -stp); pfCommit(function () { return moveShaft(p, ns - a.off); }); }
        else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); pfCommit(function () { return deleteShaft(p); }); }
      });
      if (window.ResizeObserver) new ResizeObserver(function () { if (PF.on && !pfDrag) { clearTimeout(pfWire.t); pfWire.t = setTimeout(pfRender, 120); } }).observe(host);
    }
    /* ---------- Prüfung und Vorschläge nach «Handbuch unter- und oberirdischer Netzbau» V1.2 (2.2.2 Schachtabstände, 2.2.4 Gebäudeanschlüsse, 2.3.3 Schachttypen, 3 Einmass) ---------- */
    var RICHT = { basisCu: [250, 500], basisGfk: [1000, 6000], fkrk: [1000, 6000], detail: [200, 200] };   /* obere Richtwerte in Bauzone / ausserhalb (m) */
    var CAPA = { KS80U: 1, KS80H: 1, KES100: 1, KES150: 3, KES175: 4, ES300: 99 };                          /* max. Muffen je Schachttyp */
    var RC = { ersch: "basisCu", zone: "in", x: "" }; try { var rc0 = JSON.parse(localStorage.getItem("lvd-km-rc") || "null"); if (rc0 && typeof rc0 === "object") RC = Object.assign(RC, rc0); } catch (e) { }
    var sugs = [], sugLayer = null, sugInit = 0;
    window.KARTE.live = { check: function () { return rcCheck().map(function (z) { return z[2]; }); }, setRc: function (e, z) { RC.ersch = e; RC.zone = z; RC.x = ""; try { localStorage.setItem("lvd-km-rc", JSON.stringify(RC)); } catch (x) { } sugs = []; sugDraw(); sugRender(); rcRender(); } };
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
        if (!l.s && !l.from && !l.sK) it.push([l.id, "y", tt("rc_t_s").replace("{n}", n)]);
        if (!l.e && !l.to && !l.eK) it.push([l.id, "y", tt("rc_t_e").replace("{n}", n)]);
        var hz = hzOf(l); if (l.hzArt === "luft" || l.hzArt === "bohr") it.push([l.id, "y", tt("pf_airwarn").replace("{n}", n)]);
        if (hz && hz.P && !l.hzArt) { var dv = 0, dw = 0; hz.P.forEach(function (q) { var ch = hz.h0 + (hz.h1 - hz.h0) * (hz.L ? q[0] / hz.L : 0), df = q[1] - ch; if (df < dv) dv = df; if (df > dw) dw = df; }); if (-dv > PFD) it.push([l.id, "y", tt("pf_valley").replace("{n}", n).replace("{m}", Math.round(-dv))]); else if (dw > PFD) it.push([l.id, "y", tt("pf_hill").replace("{n}", n).replace("{m}", Math.round(dw))]); }
        var cmin = pfNum(PFC.min), cmax = pfNum(PFC.max), cv = null;
        if (!l.hzArt) cv = coverOf(l); else if (l.hzArt === "bohr" && hz && hz.P) { var a0 = pfNum(l.hzH0), a1 = pfNum(l.hzH1), g0 = a0 != null ? a0 : hz.h0, g1 = a1 != null ? a1 : hz.h1; cv = Math.min.apply(null, hz.P.map(function (q) { return q[1] - (g0 + (g1 - g0) * (hz.L ? q[0] / hz.L : 0)); })) - lineDN(l) / 2000; }
        if (cv != null && cmin != null && cv < cmin - 1e-9) it.push([l.id, "r", tt("rc_cov_min").replace("{n}", n).replace("{c}", f1(cv)).replace("{m}", cmin)]);
        if (cv != null && cmax != null && cv > cmax + 1e-9 && !l.hzArt) it.push([l.id, "y", tt("rc_cov_max").replace("{n}", n).replace("{c}", f1(cv)).replace("{m}", cmax)]);
        if (hz && hz.max > GR) it.push([l.id, "y", tt("rc_steil").replace("{n}", n).replace("{m}", Math.round(hz.max)).replace("{g}", GR)]);
        if (L0 > R) it.push([l.id, "y", tt("rc_dist").replace("{n}", n).replace("{l}", f1(L0)).replace("{r}", R)]);
        if (pl.length) { var rmin = pl.some(function (e) { return e[0] >= 100; }) ? 3 : 1, dn = rmin === 3 ? "100" : "55"; for (var k = 1; k < l.pts.length - 1; k++) { var b = bendOf(l, k); if (b && b.r < rmin) it.push([l.id, "r", tt("rc_bend").replace("{n}", n).replace("{k}", k).replace("{r}", f1(b.r)).replace("{m}", rmin).replace("{dn}", dn)]); } }
      });
      /* Abzweige ohne Schacht: Rohrentnahme/T-Stück geklärt? Rohrbilanz am Knoten, Rohrzahl-Wechsel ohne Grund */
      var pcount = function (l) { var o = {}; pipeList(cfgOf(l)).forEach(function (e) { o[e[0]] = (o[e[0]] || 0) + e[1]; }); return o; }, ptxt = function (l) { return pipeTxt(cfgOf(l)) || "–"; }, knotWith = function (pt, ex) { return M.lines.some(function (o) { return o !== ex && o.abz && o.abz.mode === "entn" && [o.pts[0], o.pts[o.pts.length - 1]].some(function (q) { return AD.dist(q, pt) <= 0.06; }); }); };
      M.lines.forEach(function (l, i) {
        if (l.pts.length < 2) return;
        ["from", "to"].forEach(function (w) {
          var b = l[w] && byId(M.lines, l[w]); if (!b) return; var n = i + 1, m = M.lines.indexOf(b) + 1, kp = w === "from" ? l.pts[0] : l.pts[l.pts.length - 1];
          if (!l.abz) { it.push([l.id, "y", tt("rc_tp_none").replace("{n}", n).replace("{m}", m).replace("{p}", ptxt(b)), 1]); return; }
          if (l.abz.mode !== "entn") return;
          var up = null, dn2 = null; chainOf(b).forEach(function (x) { if (AD.dist(x.pts[x.pts.length - 1], kp) <= 0.06) up = x; if (AD.dist(x.pts[0], kp) <= 0.06) dn2 = x; });
          if (up && dn2 && up !== dn2) {
            var a = pcount(up), d = pcount(dn2), t = pcount(l), bad = false; Object.keys(a).concat(Object.keys(d), Object.keys(t)).forEach(function (k) { if ((a[k] || 0) !== (d[k] || 0) + (t[k] || 0)) bad = true; });
            if (bad) it.push([l.id, "y", tt("rc_tp_bil").replace("{n}", n).replace("{a}", ptxt(up)).replace("{b}", ptxt(dn2)).replace("{c}", ptxt(l)), 1]);
            else it.push([dn2.id, "i", tt("rc_tp_info").replace("{a}", M.lines.indexOf(up) + 1).replace("{c}", n).replace("{b}", M.lines.indexOf(dn2) + 1).replace("{p}", ptxt(dn2))]);
          }
        });
        if (l.nx) { var nx = byId(M.lines, l.nx); if (nx && l.eK && ptxt(l) !== ptxt(nx) && !knotWith(l.pts[l.pts.length - 1])) it.push([nx.id, "y", tt("rc_tp_chg").replace("{a}", i + 1).replace("{b}", M.lines.indexOf(nx) + 1).replace("{p}", ptxt(l)).replace("{q}", ptxt(nx)), 1]); }
      });
      var ends = []; M.lines.forEach(function (l) { if (l.pts.length > 1) { ends.push([l, l.pts[0], l.s]); ends.push([l, l.pts[l.pts.length - 1], l.e]); } });
      for (var a = 0; a < ends.length; a++) for (var b2 = a + 1; b2 < ends.length; b2++) { var A = ends[a], B = ends[b2]; if (A[0] === B[0]) continue; var d = AD.dist(A[1], B[1]); if (d > 0.001 && d <= 0.5 && !(A[2] && A[2] === B[2])) it.push([A[0].id, "y", tt("rc_t_gap").replace("{a}", M.lines.indexOf(A[0]) + 1).replace("{b}", M.lines.indexOf(B[0]) + 1).replace("{d}", f1(d * 100) + " cm")]); }
      M.pts.forEach(function (p, i) {
        for (var j = i + 1; j < M.pts.length; j++) { var d2 = AD.dist(p.pt, M.pts[j].pt); if (d2 <= 0.5) it.push([p.id, "y", tt("rc_t_dbl").replace("{a}", i + 1).replace("{b}", j + 1).replace("{d}", f1(d2 * 100) + " cm")]); }
        if (p.mode === "deckel") return; var cn = connOf(M, p), mu = parseInt(p.mu, 10), t = p.typ || "", n = i + 1;
        if (mu > 0 && CAPA[t] != null && CAPA[t] < mu) it.push([p.id, "r", tt("rc_typ").replace("{n}", n).replace("{t}", t).replace("{m}", mu).replace("{v}", typFor(mu))]);
        var tin = 0, tout = 0; Object.keys(cn.inn).forEach(function (k) { tin += cn.inn[k]; }); Object.keys(cn.out).forEach(function (k) { tout += cn.out[k]; });
        if (tin > 0 && tout > 0 && tin !== tout) it.push([p.id, "y", tt(tout < tin ? "rc_bil_less" : "rc_bil_more").replace("{n}", n).replace("{i}", connTxt(cn.inn)).replace("{o}", connTxt(cn.out)).replace("{d}", Math.abs(tin - tout)), 1]);
        if (!(mu > 0) && cn.n > 2 && /^KS/.test(t)) it.push([p.id, "y", tt("rc_nomu").replace("{n}", n)]);
        if (/^KS/.test(t)) {
          if (Object.keys(cn.inn).concat(Object.keys(cn.out)).some(function (k) { return +k >= 100; })) it.push([p.id, "r", tt("rc_ks100").replace("{n}", n)]);
          var k55 = Math.max(cn.inn[55] || 0, cn.out[55] || 0); if (k55 >= 4) it.push([p.id, "r", tt("rc_ks4").replace("{n}", n).replace("{k}", k55)]);
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
    var rcSeen = null;
    function rcLive(it) {   /* neue Prüfmeldungen beim Zeichnen sofort einblenden (rot und Rohrbilanz) */
      var cur0 = {}; it.forEach(function (x) { cur0[x[2]] = x; }); var old = rcSeen; rcSeen = cur0; if (!old || !dlg.open) return;
      var nw = it.filter(function (x) { return !old[x[2]] && (x[1] === "r" || x[3]); });
      nw.sort(function (a, b) { return (a[1] === "r" ? 0 : 1) - (b[1] === "r" ? 0 : 1); }); if (nw.length) toast(dlg, (nw[0][1] === "r" ? "⛔ " : "⚠ ") + nw[0][2]);
    }
    function rcRender() {
      var h = $("#kmChk"); if (!h) return; var it = rcCheck(), ic = { r: "⛔ ", y: "⚠ ", i: "ℹ " }; rcLive(it);
      h.innerHTML = "<h3>" + esc(tt("rc_h").replace("{n}", it.length)) + "</h3>" + (it.length ? "<ul class=\"kmmissl\">" + it.map(function (x) { return "<li><button type=\"button\" class=\"btn ghost small kmrc " + x[1] + "\" data-z=\"" + x[0] + "\">" + ic[x[1]] + esc(x[2]) + "</button></li>"; }).join("") + "</ul>" : '<p class="none">' + esc(tt("rc_ok")) + "</p>") + '<p class="hint">' + esc(tt("rc_src")) + "</p>";
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
      h.innerHTML = "<h3>" + esc(tt("sg_h")) + "</h3>" +
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
    /* ---------- DXF: ganze Datei als Hintergrund (Linien, Bögen, Kreise, Ellipsen, Texte, Blöcke; je Layer ein/aus; ohne Kosten)
       + Übernahme gewählter Layer bzw. angeklickter Linien als Leitung (kostenwirksam). LV95 oder LV03; ASCII-DXF. ---------- */
    var ACI = ["#000000", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#000000", "#808080", "#c0c0c0"];
    function aciCol(i) { i = Math.abs(i | 0); if (i >= 1 && i <= 9) return ACI[i]; if (i >= 250) { var g = Math.round(51 + (i - 250) * 40); return "rgb(" + g + "," + g + "," + g + ")"; } if (i >= 10 && i < 250) { var h = Math.floor((i - 10) / 10) * 15, v = (i % 2) ? 0.65 : 1, l = [50, 42, 35, 28, 22][Math.floor((i % 10) / 2)] * v; return "hsl(" + h + ",80%," + Math.round(l) + "%)"; } return "#333333"; }
    function dxfParse(txt) {
      var R = txt.split(/\r\n|\r|\n/), P = [];
      for (var i = 0; i + 1 < R.length; i += 2) { var c = parseInt(R[i], 10); if (isFinite(c)) P.push([c, R[i + 1]]); }
      /* 1) Rohobjekte je Abschnitt: Layer-Tabelle (Farben), Blöcke, Objekte */
      var sec = null, layCol = {}, blocks = {}, ents = [], cur = null, blk = null, tbl = null, lay = null;
      var push = function () { if (!cur) return; if (blk) blk.e.push(cur); else if (sec === "ENTITIES") ents.push(cur); cur = null; };
      for (var j = 0; j < P.length; j++) {
        var c0 = P[j][0], v = P[j][1], vt = v.trim();
        if (c0 === 0) {
          push(); if (lay) { if (lay.n != null) layCol[lay.n] = lay.c; lay = null; }
          if (vt === "SECTION") { sec = "?"; continue; } if (vt === "ENDSEC") { sec = null; blk = null; continue; }
          if (sec === "TABLES") { if (vt === "TABLE") tbl = "?"; else if (vt === "ENDTAB") tbl = null; else if (vt === "LAYER") lay = { n: null, c: 7 }; continue; }
          if (sec === "BLOCKS") { if (vt === "BLOCK") { blk = { n: null, bx: 0, by: 0, e: [], hdr: true }; continue; } if (vt === "ENDBLK") { if (blk && blk.n != null) blocks[blk.n] = blk; blk = null; continue; } if (blk) blk.hdr = false; }
          if (sec === "ENTITIES" || (sec === "BLOCKS" && blk)) cur = { t: vt, c: [] };
          continue;
        }
        if (c0 === 2 && sec === "?") { sec = vt; continue; }
        if (lay) { if (c0 === 2) lay.n = vt; else if (c0 === 62) lay.c = parseInt(vt, 10); continue; }
        if (blk && blk.hdr) { if (c0 === 2) blk.n = vt; else if (c0 === 10) blk.bx = parseFloat(vt); else if (c0 === 20) blk.by = parseFloat(vt); continue; }
        if (cur) cur.c.push([c0, v]);
      }
      push();
      /* 2) Objekte auslegen (mit Blocktransformation), Koordinaten LV95/LV03 */
      var sys = { lv95: 0, lv03: 0 }, bad = 0, skip = {}, cnt = {}, out = [], S = [];
      var conv = function (x, y) { if (x > 2.4e6 && x < 2.9e6 && y > 1.0e6 && y < 1.4e6) { sys.lv95++; return [x, y]; } if (x > 4.4e5 && x < 9e5 && y > 4e4 && y < 4e5) { sys.lv03++; return [x + 2e6, y + 1e6]; } return null; };
      var rd = function (q) { return [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]; };
      var I = function (x, y) { return [x, y]; };
      var arcPts = function (cx, cy, r, a0, a1, xf) { var sw = a1 - a0; while (sw <= 0) sw += 360; var n = Math.max(4, Math.min(96, Math.ceil(sw / 7.5))), p = []; for (var k = 0; k <= n; k++) { var a = (a0 + sw * k / n) * Math.PI / 180; p.push(xf(cx + r * Math.cos(a), cy + r * Math.sin(a))); } return p; };
      var bulge = function (a, b, bu, xf) { /* Bogensegment einer Polylinie */
        var th = 4 * Math.atan(bu), ch = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!ch || Math.abs(bu) < 1e-6) return [];
        var r = ch / (2 * Math.sin(th / 2)), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, d = r * Math.cos(th / 2), ux = -(b[1] - a[1]) / ch, uy = (b[0] - a[0]) / ch, cx = mx + ux * d, cy = my + uy * d;
        var s0 = Math.atan2(a[1] - cy, a[0] - cx), n = Math.max(2, Math.min(48, Math.ceil(Math.abs(th) * 180 / Math.PI / 7.5))), p = [];
        for (var k = 1; k < n; k++) { var an = s0 + th * k / n; p.push(xf(cx + Math.abs(r) * Math.cos(an), cy + Math.abs(r) * Math.sin(an))); } return p; };
      var add = function (it, ptsRaw) { var p = ptsRaw.map(function (q) { return isFinite(q[0]) && isFinite(q[1]) ? conv(q[0], q[1]) : null; }); if (!p.length || p.some(function (q) { return !q; })) { bad++; return; } if (it.t) it.p = rd(p[0]); else it.p = p.map(rd); out.push(it); };
      var col = function (e, ly, inh) { var c = e.g(62); c = c == null ? 256 : parseInt(c, 10); if (c === 0 && inh) return inh; if (c === 256 || c === 0) return null; return aciCol(c); };   /* null = Layerfarbe */
      var poly = null;
      function walk(list, xf, sc, rot, lyIn, colIn, depth) {
        list.forEach(function (e0) {
          var e = { t: e0.t, c: e0.c, g: function (k) { for (var q = 0; q < e0.c.length; q++) if (e0.c[q][0] === k) return e0.c[q][1].trim(); return null; }, all: function (k) { return e0.c.filter(function (x) { return x[0] === k; }).map(function (x) { return x[1]; }); }, f: function (k, d) { var x = parseFloat(this.g(k)); return isFinite(x) ? x : d; } };
          var ly = e.g(8) || "0"; if (ly === "0" && lyIn) ly = lyIn; var cl = col(e, ly, colIn), t = e.t;
          cnt[t] = (cnt[t] || 0) + 1;
          if (t === "LINE") add({ l: ly, c: cl, k: 1, ln: 1 }, [xf(e.f(10), e.f(20)), xf(e.f(11), e.f(21))]);
          else if (t === "LWPOLYLINE") {
            var V = [], cur2 = null; e.c.forEach(function (x) { if (x[0] === 10) { cur2 = [parseFloat(x[1]), NaN, 0]; V.push(cur2); } else if (x[0] === 20 && cur2) cur2[1] = parseFloat(x[1]); else if (x[0] === 42 && cur2) cur2[2] = parseFloat(x[1]) || 0; });
            var cl1 = (parseInt(e.g(70), 10) || 0) & 1, pp = []; if (cl1 && V.length > 2) V.push(V[0]);
            V.forEach(function (q, k) { pp.push(xf(q[0], q[1])); if (k < V.length - 1 && q[2]) pp = pp.concat(bulge([q[0], q[1]], [V[k + 1][0], V[k + 1][1]], q[2], xf)); });
            if (pp.length > 1) add({ l: ly, c: cl, k: 1 }, pp);
          }
          else if (t === "POLYLINE") poly = { l: ly, c: cl, v: [], cl: ((parseInt(e.g(70), 10) || 0) & 1), m: ((parseInt(e.g(70), 10) || 0) & (16 | 64)) };
          else if (t === "VERTEX") { if (poly) poly.v.push([e.f(10), e.f(20), e.f(42, 0), parseInt(e.g(70), 10) || 0]); }
          else if (t === "SEQEND") { if (poly && !poly.m) { var W = poly.v.filter(function (q) { return !(q[3] & 16); }); if (poly.cl && W.length > 2) W.push(W[0]); var p2 = []; W.forEach(function (q, k) { p2.push(xf(q[0], q[1])); if (k < W.length - 1 && q[2]) p2 = p2.concat(bulge([q[0], q[1]], [W[k + 1][0], W[k + 1][1]], q[2], xf)); }); if (p2.length > 1) add({ l: poly.l, c: poly.c, k: 1 }, p2); } else if (poly) skip["POLYFACE"] = (skip["POLYFACE"] || 0) + 1; poly = null; }
          else if (t === "CIRCLE") { var cx = e.f(10), cy = e.f(20), r = e.f(40, 0), oc = xf(cx, cy), oo = conv(oc[0], oc[1]); if (r > 0) add({ l: ly, c: cl, o: oo ? rd(oo) : undefined }, arcPts(cx, cy, r, 0, 360, xf)); }
          else if (t === "ARC") { var r2 = e.f(40, 0); if (r2 > 0) add({ l: ly, c: cl }, arcPts(e.f(10), e.f(20), r2, e.f(50, 0), e.f(51, 360), xf)); }
          else if (t === "ELLIPSE") { var ex = e.f(10), ey = e.f(20), ax = e.f(11), ay = e.f(21), ra = e.f(40, 1), p0 = e.f(41, 0), p1 = e.f(42, 2 * Math.PI), bx = -ay * ra, by = ax * ra, sw = p1 - p0; while (sw <= 0) sw += 2 * Math.PI; var n3 = Math.max(8, Math.ceil(sw / (Math.PI / 24))), ep = []; for (var k3 = 0; k3 <= n3; k3++) { var u = p0 + sw * k3 / n3; ep.push(xf(ex + ax * Math.cos(u) + bx * Math.sin(u), ey + ay * Math.cos(u) + by * Math.sin(u))); } add({ l: ly, c: cl }, ep); }
          else if (t === "SPLINE") { var X = e.all(11).length ? [e.all(11), e.all(21)] : [e.all(10), e.all(20)], sp = X[0].map(function (x, k) { return xf(parseFloat(x), parseFloat(X[1][k])); }); if (sp.length > 1) add({ l: ly, c: cl }, sp); }
          else if (t === "POINT") { var ox = e.f(10), oy = e.f(20), d0 = 0.15; add({ l: ly, c: cl }, [xf(ox - d0, oy), xf(ox + d0, oy)]); add({ l: ly, c: cl }, [xf(ox, oy - d0), xf(ox, oy + d0)]); }
          else if (t === "TEXT" || t === "MTEXT" || t === "ATTRIB") {
            var s = t === "MTEXT" ? e.all(3).join("") + (e.g(1) != null ? e.all(1).join("") : "") : (e.g(1) || "");
            s = s.replace(/\\P/g, " ").replace(/\\[A-Za-z][^;\\{}]*;/g, "").replace(/\\[LlOoKk]/g, "").replace(/[{}]/g, "").replace(/%%[cC]/g, "Ø").replace(/%%[dD]/g, "°").replace(/%%[pP]/g, "±").replace(/%%[uUoO]/g, "").trim();
            if (!s) return; var h = e.f(40, 0.25) * sc, ha = parseInt(e.g(72), 10) || 0, va = parseInt(e.g(73), 10) || 0, am = parseInt(e.g(71), 10) || 0;
            var useAl = t !== "MTEXT" && (ha || va) && e.g(11) != null, q0 = useAl ? xf(e.f(11), e.f(21)) : xf(e.f(10), e.f(20));
            var an = t === "MTEXT" ? (e.g(50) != null ? e.f(50, 0) : Math.atan2(e.f(21, 0), e.f(11, 1)) * 180 / Math.PI) : e.f(50, 0);
            var ah = t === "MTEXT" ? [0, 0, 1, 2, 0, 1, 2, 0, 1, 2][am] || 0 : (ha === 1 || ha === 4 ? 1 : ha === 2 ? 2 : 0), av = t === "MTEXT" ? (am >= 7 ? 0 : am >= 4 ? 1 : am >= 1 ? 2 : 0) : (ha === 4 ? 1 : va === 3 ? 2 : va === 2 ? 1 : 0);
            add({ l: ly, c: cl, t: s.slice(0, 200), h: Math.round(h * 1000) / 1000, r: Math.round((an + rot) * 10) / 10, ah: ah, av: av }, [q0]);
          }
          else if (t === "INSERT" && depth < 5) {
            var B = blocks[e.g(2)]; if (!B) return; var px0 = e.f(10, 0), py0 = e.f(20, 0), sx = e.f(41, 1), sy = e.f(42, 1), ro = e.f(50, 0) * Math.PI / 180, cs = Math.cos(ro), sn = Math.sin(ro);
            var nc = Math.max(1, parseInt(e.g(70), 10) || 1), nr = Math.max(1, parseInt(e.g(71), 10) || 1), dc = e.f(44, 0), dr = e.f(45, 0);
            for (var a1 = 0; a1 < Math.min(nc, 50); a1++) for (var b1 = 0; b1 < Math.min(nr, 50); b1++) (function (ox2, oy2) {
              var xf2 = function (x, y) { var u = (x - B.bx) * sx + ox2, w = (y - B.by) * sy + oy2; return xf(px0 + u * cs - w * sn, py0 + u * sn + w * cs); };
              walk(B.e, xf2, sc * Math.abs(sx), rot + e.f(50, 0), ly, cl, depth + 1);
            })(a1 * dc, b1 * dr);
          }
          else if (t !== "ATTDEF" && t !== "SEQEND" && t !== "VERTEX") skip[t] = (skip[t] || 0) + 1;
        });
      }
      walk(ents, I, 1, 0, null, null, 0);
      /* 3) LINE-Stücke derselben Ebene und Farbe zu Linienzügen verbinden (1 cm) */
      var key = function (q) { return Math.round(q[0] * 100) + "," + Math.round(q[1] * 100); }, rest = out.filter(function (s) { return !s.ln; }), byL = {};
      out.filter(function (s) { return s.ln; }).forEach(function (s) { var k0 = s.l + "\u0000" + (s.c || ""); (byL[k0] = byL[k0] || []).push(s.p); });
      Object.keys(byL).forEach(function (k0) {
        var L0 = k0.split("\u0000"), S0 = byL[k0], used = new Array(S0.length).fill(false), ends = {};
        S0.forEach(function (p, i2) { [key(p[0]), key(p[1])].forEach(function (k) { (ends[k] = ends[k] || []).push(i2); }); });
        var take = function (k) { var a = ends[k] || []; for (var q = 0; q < a.length; q++) if (!used[a[q]]) return a[q]; return -1; };
        S0.forEach(function (p, i2) {
          if (used[i2]) return; used[i2] = true; var ch = [p[0].slice(), p[1].slice()];
          for (var q; (q = take(key(ch[ch.length - 1]))) >= 0;) { used[q] = true; var s1 = S0[q]; ch.push((key(s1[0]) === key(ch[ch.length - 1]) ? s1[1] : s1[0]).slice()); }
          for (var q2; (q2 = take(key(ch[0]))) >= 0;) { used[q2] = true; var s2 = S0[q2]; ch.unshift((key(s2[1]) === key(ch[0]) ? s2[0] : s2[1]).slice()); }
          rest.push({ l: L0[0], c: L0[1] || null, k: 1, p: ch });
        });
      });
      rest = rest.map(function (s) { if (!s.t) s.p = s.p.filter(function (q, k) { return !k || Math.hypot(q[0] - s.p[k - 1][0], q[1] - s.p[k - 1][1]) > 0.005; }); return s; }).filter(function (s) { return s.t || s.p.length > 1; });
      /* 4) Umfang begrenzen: sehr grosse Dateien vereinfachen (Douglas-Peucker), damit Speichern im Browser möglich bleibt */
      var npts = 0; rest.forEach(function (s) { if (!s.t) npts += s.p.length; });
      var simp = 0; [0.05, 0.2, 0.5].forEach(function (tol) { if (npts <= 150000) return; simp = tol; npts = 0; rest.forEach(function (s) { if (!s.t && s.p.length > 2) s.p = dpSimp(s.p, tol); if (!s.t) npts += s.p.length; }); });
      var lays = {}; rest.forEach(function (s) { var L1 = lays[s.l] = lays[s.l] || { n: 0, k: 0, c: layCol[s.l] != null && layCol[s.l] > 0 && layCol[s.l] !== 7 ? aciCol(layCol[s.l]) : null }; L1.n++; if (s.k) L1.k++; });
      var sc0 = 0; Object.keys(lays).forEach(function (l) { var st = dxfKnown(l); if (st) { sc0++; lays[l].g = st.g; if (!lays[l].c) lays[l].c = st.c; lays[l].w = st.w; if (st.d) lays[l].d = st.d; } if (!lays[l].c) lays[l].c = DXF_VIOLET; });
      rest.forEach(function (s) { if (!s.c) delete s.c; });
      return { it: rest, lay: lays, scheme: sc0 ? "sc" : "", cnt: cnt, skip: skip, bad: bad, sys: sys.lv03 > sys.lv95 ? "LV03" : "LV95", simp: simp, nTxt: rest.filter(function (s) { return s.t; }).length };
    }
    /* Bekannte Ebenenschlüssel: Swisscom-Netzauskunft (SIA 405), z. B. SCZ161U-MLU1 = Trasse unterirdisch, < 0.5 m, Lage genau.
       Darstellung angelehnt an das Swisscom Geo-Portal: Bestand dunkel, Lage ungenau gestrichelt, Schächte blau. */
    var DXF_VIOLET = "#7b2cbf";   /* keine Farbe bestimmbar (weder Layer- noch Objektfarbe, kein bekanntes Schema) */
    function dxfCol(D, s) { var L0 = D.lay[s.l] || {}; return (L0.fc ? L0.c : s.c || L0.c) || DXF_VIOLET; }
    function hexCol(c) { c = String(c || ""); if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase(); var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(c.replace(/\s/g, "")); if (m) return "#" + [m[1], m[2], m[3]].map(function (x) { return ("0" + (+x).toString(16)).slice(-2); }).join(""); var h = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(c.replace(/\s/g, "")); if (h) { var H = +h[1] / 360, S = +h[2] / 100, Lq = +h[3] / 100, q = Lq < 0.5 ? Lq * (1 + S) : Lq + S - Lq * S, p = 2 * Lq - q, f = function (t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return "#" + [f(H + 1 / 3), f(H), f(H - 1 / 3)].map(function (x) { return ("0" + Math.round(x * 255).toString(16)).slice(-2); }).join(""); } return DXF_VIOLET; }
    function dxfParseKey(l) { var m = /^SCZ(16[123])([A-Z-])-?-?(MLU|MFU|MSU|T--)(-|0|1)$/i.exec(String(l || "").replace(/\s+/g, "")); return m ? { o: m[1], u: m[2].toUpperCase(), k: m[3].toUpperCase(), q: m[4] } : null; }
    function dxfKnown(l) {
      var m = dxfParseKey(l); if (!m) return null; var sch = m.o === "163", ung = m.q === "0";
      if (m.k === "T--") return { g: m.o === "163" ? 3 : 1, c: sch ? "#1f4e9a" : "#3a3a3a", w: 1 };
      return { g: m.o === "161" ? 0 : m.o === "162" ? 2 : 3, c: sch ? "#1f4e9a" : "#111111", w: m.k === "MFU" && !sch ? 1.3 : m.o === "161" ? 2.2 : 1.4, d: ung ? "6 4" : "" };
    }
    function dxfLbl(l) {
      var m = dxfParseKey(l); if (!m) return ""; var a = [tt(m.o === "161" ? (m.u === "A" ? "dx_161A" : "dx_161U") : m.o === "162" ? "dx_162" : "dx_163")];
      if (m.k === "T--") a.push(tt("dx_txt")); else { a.push(tt(m.k === "MLU" ? "dx_lt" : m.k === "MFU" ? (m.o === "161" ? "dx_ge" : "dx_fl") : "dx_pt")); if (m.q === "0" || m.q === "1") a.push(tt(m.q === "1" ? "dx_ok" : "dx_nok")); }
      return a.join(" · ");
    }
    /* Belegung aus Plantext (z. B. «2 x K100», «K55») → Rohre der Leitung */
    function dxfBel(s) {
      var D = M.dxf; if (!D || !s.p || s.p.length < 2) return null; var best = null;
      D.it.forEach(function (t) { if (!t.t || !/(^|\s)(\d+\s*x\s*)?K\d+/i.test(t.t)) return; var h = 1e9; for (var k = 1; k < s.p.length; k++) h = Math.min(h, segDist(t.p, s.p[k - 1], s.p[k])); if (h <= 3 && (!best || h < best.d)) best = { d: h, t: t.t }; });
      if (!best) return null; var mm = /(?:(\d+)\s*x\s*)?K(\d+)/i.exec(best.t), rt = {}; if (mm && [55, 100, 120, 150].indexOf(+mm[2]) >= 0) rt[+mm[2]] = +(mm[1] || 1);
      return { t: best.t, rt: Object.keys(rt).length ? rt : null };
    }
    function segDist(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
    function dpSimp(p, tol) {
      if (p.length < 3) return p; var keep = new Array(p.length).fill(false); keep[0] = keep[p.length - 1] = true; var st = [[0, p.length - 1]];
      while (st.length) { var ab = st.pop(), a = p[ab[0]], b = p[ab[1]], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, mx = -1, mi = -1;
        for (var i = ab[0] + 1; i < ab[1]; i++) { var t = L2 ? ((p[i][0] - a[0]) * dx + (p[i][1] - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); var d = Math.hypot(p[i][0] - a[0] - t * dx, p[i][1] - a[1] - t * dy); if (d > mx) { mx = d; mi = i; } }
        if (mx > tol) { keep[mi] = true; st.push([ab[0], mi], [mi, ab[1]]); } }
      return p.filter(function (_, i) { return keep[i]; });
    }
    /* Leitung aus einem DXF-Linienzug */
    function dxfToLine(s) { var b = dxfBel(s), cf = clone(lastCfg); if (b && b.rt) cf.rt = b.rt; var l = { id: nid("l"), pts: s.p.map(function (q) { return q.slice(); }), rid: null, rohr: clone(opt.defRohr), cfg: cf, dxf: s.l }; if (b) l.dxfBel = b.t; lineSync(l); M.lines.push(l); return l; }
    function dxfFit(pts) { try { map.fitBounds(L.latLngBounds(pts.map(AD.ll)).pad(0.1), { maxZoom: 19 }); } catch (x) { } }
    /* Importfenster: je Layer «anzeigen» und «als Leitung übernehmen» */
    function dxfAsk(res, fname) {
      var a = $("#kmDxfAsk"); if (a) a.remove(); a = document.createElement("div"); a.id = "kmDxfAsk"; a.className = "kmroute kmdxf"; a.setAttribute("role", "dialog"); a.setAttribute("aria-labelledby", "kmDxfT");
      var ln = Object.keys(res.lay).sort(function (x, y) { var gx = res.lay[x].g == null ? 9 : res.lay[x].g, gy = res.lay[y].g == null ? 9 : res.lay[y].g; return gx - gy || x.localeCompare(y); }), nL = res.it.length - res.nTxt, nK = res.it.filter(function (s) { return s.k; }).length;
      var sk = Object.keys(res.skip).map(function (k) { return k + " " + res.skip[k]; }).join(", ");
      a.innerHTML = '<p class="kmrt-t" id="kmDxfT"><b>' + esc(tt("km_dxfT")) + "</b> · " + esc(fname) + '</p><p class="hint">' + esc(tt("km_dxfInfo2").replace("{g}", nL).replace("{t}", res.nTxt).replace("{k}", ln.length).replace("{c}", res.sys)) +
        (sk ? " " + esc(tt("km_dxfSkip").replace("{s}", sk)) : "") + (res.bad ? " " + esc(tt("km_dxfBad").replace("{n}", res.bad)) : "") + (res.simp ? " " + esc(tt("km_dxfSimp").replace("{m}", String(res.simp))) : "") + (M.dxf ? " " + esc(tt("km_dxfRepl")) : "") + "</p>" + (res.scheme === "sc" ? '<p class="hint kmdxsc">ℹ ' + esc(tt("dx_sc")) + "</p>" : "") +
        '<table class="kmdxtab"><thead><tr><th scope="col">' + esc(tt("km_dxfLays")) + '</th><th scope="col">' + esc(tt("km_dxfShow")) + '</th><th scope="col">' + esc(tt("km_dxfAsLine")) + "</th></tr></thead><tbody>" +
        ln.map(function (l, i) { var L1 = res.lay[l], lb = dxfLbl(l); return '<tr><th scope="row"><input type="color" class="kmdxcol" data-dxc="' + esc(l) + '" value="' + esc(hexCol(L1.c)) + '" aria-label="' + esc(tt("km_dxfCol") + ": " + (lb || l)) + '" title="' + esc(tt("km_dxfCol_t")) + '">' + (lb ? esc(lb) + ' <span class="hint kmdxc">' + esc(l) + "</span>" : esc(l)) + ' <span class="hint">(' + L1.n + ")</span></th>" +
          '<td><input type="checkbox" data-dxs="' + esc(l) + '" checked aria-label="' + esc(tt("km_dxfShow") + ": " + l) + '"></td><td>' + (L1.k ? '<input type="checkbox" data-dxl="' + esc(l) + '" aria-label="' + esc(tt("km_dxfAsLine") + ": " + l + " (" + L1.k + ")") + '"> <span class="hint">' + L1.k + "</span>" : "–") + "</td></tr>"; }).join("") +
        '</tbody></table><div class="kmbar kmdxall"><label for="kmDxfAllC">' + esc(tt("km_dxfColAll")) + '</label><input type="color" id="kmDxfAllC" value="' + DXF_VIOLET + '"><button type="button" class="btn ghost small" data-dxg="col">' + esc(tt("km_dxfColAllGo")) + '</button></div><p class="hint">' + esc(tt("km_dxfHint")) + '</p><div class="kmbar"><button type="button" class="btn small" data-dxg="go">' + esc(tt("km_dxfGo")) + '</button> <button type="button" class="btn ghost small" data-dxg="x">' + esc(tt("km_dxfX")) + "</button></div>";
      canvas0().appendChild(a); var f = a.querySelector("button[data-dxg=go]"); if (f) f.focus();
      a.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); a.remove(); } });
      a.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-dxg]"); if (!b) return; if (b.dataset.dxg === "x") { a.remove(); return; }
        if (b.dataset.dxg === "col") { var v0 = $("#kmDxfAllC").value; a.querySelectorAll("[data-dxc]").forEach(function (c) { c.value = v0; }); return; }
        var colU = {}; a.querySelectorAll("[data-dxc]").forEach(function (c) { var l = c.getAttribute("data-dxc"); if (c.value !== hexCol(res.lay[l].c)) colU[l] = c.value; });
        var show = {}, want = {}; a.querySelectorAll("[data-dxs]").forEach(function (c) { show[c.getAttribute("data-dxs")] = c.checked; }); a.querySelectorAll("[data-dxl]").forEach(function (c) { if (c.checked) want[c.getAttribute("data-dxl")] = 1; });
        endLine(); var old = M.dxf || null, sn = JSON.stringify(M, noDxf); undoSt.push(sn); redoSt.length = 0; lyEdited = true;
        var lay = {}; ln.forEach(function (l) { var R0 = res.lay[l]; lay[l] = { c: colU[l] || R0.c, n: R0.n, k: R0.k, on: show[l] !== false }; if (colU[l]) lay[l].fc = 1; if (R0.w) lay[l].w = R0.w; if (R0.d) lay[l].d = R0.d; if (R0.g != null) lay[l].g = R0.g; });
        M.dxf = { name: fname, sys: res.sys, lay: lay, it: res.it, sc: res.scheme || "" };
        var made = res.it.filter(function (s) { return s.k && want[s.l]; }).map(dxfToLine);
        a.remove(); dxfCache = null; if (made.length) sel = { id: made[0].id }; refresh(); dxfPanel();   /* dxfPanel zeichnet auch neu */
        var tg = $(".kmmidtog"); if (tg && tg.getAttribute("aria-expanded") !== "true") tg.click();   /* Fenster «Ebenen» mit der Layerliste zeigen */
        var dd = $("#kmDxfD"); if (dd) { dd.open = true; try { dd.scrollIntoView({ block: "nearest" }); } catch (x) { } }
        var all = []; res.it.forEach(function (s) { if (lay[s.l].on) all = all.concat(s.t ? [s.p] : [s.p[0], s.p[s.p.length - 1]]); }); if (all.length) dxfFit(all);
        toast(dlg, tt(made.length ? "km_dxfDone2" : "km_dxfDone0").replace("{n}", made.length).replace("{k}", ln.length), tt("km_undoBtn"), function () { undoSt.pop(); restoreM(sn); M.dxf = old; dxfCache = null; refresh(); dxfPanel(); });
      });
    }
    function noDxf(k, v) { return k === "dxf" && v && v.it ? undefined : v; }
    function canvas0() { var m0 = $("#kmMap"); return (m0 && m0.parentNode) || dlg; }
    /* Darstellung auf der Karte: Linien (Canvas, ohne Kosten), Texte massstäblich; je Layer ein/aus */
    var dxfLay = null, dxfTxt = null, dxfCache = null, dxfRen = null;
    function dxfDraw() {
      if (plan || !map) return; var D = M.dxf;
      if (!dxfLay) { var pn = map.createPane("kmdxf"); pn.style.zIndex = 390; var pt = map.createPane("kmdxft"); pt.style.zIndex = 395; pt.style.pointerEvents = "none"; dxfRen = L.canvas({ pane: "kmdxf", tolerance: 5 }); dxfLay = L.layerGroup().addTo(map); dxfTxt = L.layerGroup().addTo(map); map.on("zoomend moveend", dxfTexts); }
      dxfLay.clearLayers(); dxfTxt.clearLayers(); if (!D || !D.it) return;
      if (!dxfCache) dxfCache = D.it.map(function (s) { return s.t ? AD.ll(s.p) : s.p.map(AD.ll); });
      D.it.forEach(function (s, i) { if (s.t || !D.lay[s.l] || !D.lay[s.l].on) return;
        var LY0 = D.lay[s.l], pl = L.polyline(dxfCache[i], { renderer: dxfRen, color: dxfCol(D, s), weight: LY0.w || 1.3, dashArray: LY0.d || null, opacity: 0.9, interactive: !!s.k, bubblingMouseEvents: true }); if (s.k) pl.on("click", function (ev) { if (mode) return; L.DomEvent.stop(ev); dxfPick(i); }); dxfLay.addLayer(pl); });
      dxfTexts();
    }
    function dxfTexts() {
      if (!dxfTxt) return; dxfTxt.clearLayers(); var D = M.dxf; if (!D || !D.it || !dxfCache) return;
      var z = map.getZoom(), c = map.getCenter(), mpp = 156543.03 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, z), bb = map.getBounds().pad(0.2), n = 0;
      D.it.forEach(function (s, i) { if (!s.t || n > 2500 || !D.lay[s.l] || !D.lay[s.l].on) return; var px = (s.h || 0.25) / mpp; if (px < 2.5) return; px = Math.max(9, px);   /* ab ~1:400 lesbar (min. 9 px), wie Planbeschriftung */ var ll = dxfCache[i]; if (!bb.contains(ll)) return; n++;
        var tx = ["0", "-50%", "-100%"][s.ah || 0], ty = ["0", "50%", "100%"][s.av || 0];
        var ic = L.divIcon({ className: "kmdxft", iconSize: [0, 0], html: '<span style="font-size:' + Math.min(px, 400).toFixed(1) + "px;color:" + esc(dxfCol(D, s)) + ";transform:rotate(" + (-(s.r || 0)) + "deg) translate(" + tx + ",-100%) translate(0," + ty + ')">' + esc(s.t) + "</span>" });
        dxfTxt.addLayer(L.marker(ll, { icon: ic, pane: "kmdxft", interactive: false, keyboard: false })); });
    }
    function dxfPick(i) {
      var s = M.dxf && M.dxf.it[i]; if (!s) return; var a = $("#kmDxfAsk"); if (a) a.remove(); a = document.createElement("div"); a.id = "kmDxfAsk"; a.className = "kmroute kmdxf"; a.setAttribute("role", "dialog"); a.setAttribute("aria-labelledby", "kmDxfT");
      var Lm = 0; for (var k = 1; k < s.p.length; k++) Lm += Math.hypot(s.p[k][0] - s.p[k - 1][0], s.p[k][1] - s.p[k - 1][1]);
      var lb = dxfLbl(s.l), bel = dxfBel(s);
      a.innerHTML = '<p class="kmrt-t" id="kmDxfT"><b>' + esc(tt("km_dxfPick").replace("{l}", lb || s.l).replace("{m}", fmt(Lm))) + '</b></p>' + (lb ? '<p class="hint kmdxc">' + esc(s.l) + "</p>" : "") +
        (bel ? '<p class="hint">' + esc(tt("km_dxfBel").replace("{b}", bel.t)) + (bel.rt ? " → " + esc(tt("km_dxfBelGo")) : "") + "</p>" : "") + (M.dxf.sc ? '<p class="hint">' + esc(tt("km_dxfBest")) + "</p>" : "") + '<div class="kmbar"><button type="button" class="btn small" data-dxp="go">' + esc(tt("km_dxfPickGo")) + '</button> <button type="button" class="btn ghost small" data-dxp="x">' + esc(tt("km_dxfX")) + "</button></div>";
      canvas0().appendChild(a); a.querySelector("button").focus();
      a.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); a.remove(); } });
      a.addEventListener("click", function (ev) { var b = ev.target.closest("[data-dxp]"); if (!b) return; a.remove(); if (b.dataset.dxp !== "go") return; snap(); var l = dxfToLine(s); sel = { id: l.id }; refresh(); toast(dlg, tt("km_dxfDone").replace("{n}", 1), tt("km_undoBtn"), function () { undo(); }); });
    }
    /* Seitenleiste «DXF-Hintergrund»: Layer ein/aus, Layer als Leitung, entfernen */
    function dxfPanel() {
      dxfDraw(); var d = $("#kmDxfD"), b = $("#kmDxfB"); if (!d || !b) return; var D = M.dxf; d.hidden = !D; if (!D) { b.innerHTML = ""; return; }
      var ln = Object.keys(D.lay).sort(function (x, y) { var gx = D.lay[x].g == null ? 9 : D.lay[x].g, gy = D.lay[y].g == null ? 9 : D.lay[y].g; return gx - gy || x.localeCompare(y); });
      b.innerHTML = '<p class="hint">' + esc(D.name || "DXF") + " · " + D.it.length + " " + esc(tt("km_dxfObj")) + " · " + esc(D.sys || "LV95") + '</p><div class="kmbar"><button type="button" class="btn ghost small" data-dxa="on">' + esc(tt("km_dxfAllOn")) + '</button><button type="button" class="btn ghost small" data-dxa="off">' + esc(tt("km_dxfAllOff")) + "</button></div>" +
        (D.sc ? '<p class="hint kmdxsc">' + esc(tt("dx_scShort")) + "</p>" : "") +
        '<ul class="kmdxl">' + ln.map(function (l) { var L1 = D.lay[l], lb = dxfLbl(l); return '<li><input type="color" class="kmdxcol" data-dxc="' + esc(l) + '" value="' + esc(hexCol(L1.c)) + '" aria-label="' + esc(tt("km_dxfCol") + ": " + (lb || l)) + '" title="' + esc(tt("km_dxfCol_t")) + '"><label class="check"><input type="checkbox" data-dxo="' + esc(l) + '"' + (L1.on ? " checked" : "") + '><span>' + (lb ? esc(lb) + ' <span class="hint kmdxc">' + esc(l) + "</span>" : esc(l)) + ' <span class="hint">(' + L1.n + ")</span></span></label>" +
          (L1.k ? '<button type="button" class="btn ghost small" data-dxk="' + esc(l) + '" title="' + esc(tt("km_dxfLayLine_t")) + '" aria-label="' + esc(tt("km_dxfLayLine") + ": " + l) + '">' + esc(tt("km_dxfLayLine")) + "</button>" : "") + "</li>"; }).join("") + "</ul>" +
        '<div class="kmbar kmdxall"><label for="kmDxfAllC2">' + esc(tt("km_dxfColAll")) + '</label><input type="color" id="kmDxfAllC2" value="' + DXF_VIOLET + '"><button type="button" class="btn ghost small" data-dxa="col">' + esc(tt("km_dxfColAllGo")) + '</button><button type="button" class="btn ghost small" data-dxa="orig">' + esc(tt("km_dxfColOrig")) + "</button></div>" +
        '<div class="kmbar"><button type="button" class="btn ghost small" data-dxa="new">' + esc(tt("km_dxfNew")) + '</button><button type="button" class="btn ghost small del" data-dxa="del">' + esc(tt("km_dxfDel")) + "</button></div>";
    }
    function dxfPanelEv() {
      var b = $("#kmDxfB"); if (!b) return;
      b.addEventListener("change", function (e) { if (!M.dxf) return; var k0 = e.target.closest("[data-dxc]"); if (k0) { var L0 = M.dxf.lay[k0.getAttribute("data-dxc")]; L0.c0 = L0.c0 || L0.c; L0.c = k0.value; L0.fc = 1; lyEdited = true; dxfDraw(); return; }
        var c = e.target.closest("[data-dxo]"); if (!c) return; M.dxf.lay[c.getAttribute("data-dxo")].on = c.checked; lyEdited = true; dxfDraw(); });
      b.addEventListener("click", function (e) {
        var a = e.target.closest("[data-dxa]"), k = e.target.closest("[data-dxk]"), D = M.dxf; if (!D) return;
        if (k) { var ly = k.getAttribute("data-dxk"), its = D.it.filter(function (s) { return s.k && s.l === ly; }); if (!its.length) return; snap(); var made = its.map(dxfToLine); sel = { id: made[0].id }; refresh(); toast(dlg, tt("km_dxfDone").replace("{n}", made.length), tt("km_undoBtn"), function () { undo(); }); return; }
        if (!a) return; var w = a.dataset.dxa;
        if (w === "col" || w === "orig") { var v1 = ($("#kmDxfAllC2") || {}).value || DXF_VIOLET; Object.keys(D.lay).forEach(function (l) { var L0 = D.lay[l]; if (w === "col") { L0.c0 = L0.c0 || L0.c; L0.c = v1; L0.fc = 1; } else { if (L0.c0) L0.c = L0.c0; delete L0.fc; } }); lyEdited = true; dxfPanel(); return; }
        if (w === "on" || w === "off") { Object.keys(D.lay).forEach(function (l) { D.lay[l].on = w === "on"; }); lyEdited = true; dxfPanel(); }
        else if (w === "new") { var fi = $("#kmDxfF"); if (fi) { fi.value = ""; fi.click(); } }
        else if (w === "del") { var old = D; M.dxf = null; lyEdited = true; dxfCache = null; dxfPanel(); var fo = $("[data-k=dxfin]"); if (fo) fo.focus(); toast(dlg, tt("km_dxfDelDone"), tt("km_undoBtn"), function () { M.dxf = old; dxfCache = null; dxfPanel(); }); }
      });
    }
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
      var ks = Object.keys(sf).filter(function (k) { return k; }), ty = {}; M.pts.forEach(function (p) { if (p.typ) ty[p.typ] = shaftSpec(p); }); var tk = Object.keys(ty); e.hidden = !(ks.length || tk.length);
      var shl = tk.map(function (id) { var sp = ty[id], sh = sp.sh === "circle" ? '<circle cx="11" cy="8" r="6"' : sp.sh === "diamond" ? '<polygon points="11,2 19,8 11,14 3,8"' : '<rect x="3" y="3" width="16" height="10"'; return '<span class="kmlg1"><svg width="22" height="16" aria-hidden="true">' + sh + ' fill="#fff" stroke="#0a4f55" stroke-width="1.6"' + (sp.dash ? ' stroke-dasharray="3 2"' : "") + "/>" + (sp.cross ? '<line x1="3" y1="3" x2="19" y2="13" stroke="#0a4f55"/><line x1="19" y1="3" x2="3" y2="13" stroke="#0a4f55"/>' : "") + "</svg> " + esc(id + (id === "OTHER" ? "" : " " + sp.l.toFixed(2) + "×" + sp.w.toFixed(2))) + "</span>"; }).join("");
      var bnd = BAND_ON && M.lines.length ? '<span class="kmlg1"><svg width="34" height="10" aria-hidden="true"><line x1="2" y1="2" x2="32" y2="2" stroke="#6f7f87" stroke-width="1.3" stroke-dasharray="6 5"/><line x1="2" y1="8" x2="32" y2="8" stroke="#6f7f87" stroke-width="1.3" stroke-dasharray="6 5"/></svg> ' + esc(tt("km_band")) + "</span>" : "";
      e.innerHTML = shl + bnd + ks.map(function (k) { var st = LSTY[k]; return '<span class="kmlg1"><svg width="34" height="8" aria-hidden="true"><line x1="2" y1="4" x2="32" y2="4" stroke="' + st[0] + '" stroke-width="3"' + (st[1] ? ' stroke-dasharray="' + st[1] + '"' : "") + (st[1] === "1 7" ? ' stroke-linecap="round"' : "") + "/></svg> " + esc(tt("km_s_" + k)) + "</span>"; }).join("");
    }
    function sumRender() {
      var h = $("#kmSum"); if (!h) return; var ls = M.lines.filter(function (l) { return l.pts.length > 1; }), tot = ls.reduce(function (a, l) { return a + effLen(l.pts); }, 0), f0 = function (x) { return Math.round(x).toLocaleString("de-CH"); }, nm = (($("#kmMiss ul") || {}).children || []).length, nw = 0;
      try { nw = rcCheck().length; } catch (e) { }
      var c = costLast, row = function (k, v) { return "<div><dt>" + esc(k) + "</dt><dd>" + v + "</dd></div>"; };
      h.innerHTML = "<h3>" + esc(tt("km_sum_h")) + "</h3><dl>" +
        (opt.cost ? row(tt("km_sum_cost"), c ? "<b>CHF " + f0(c.n) + "</b>" + (c.b != null ? " · " + esc(tt("km_sum_brutto")) + " CHF " + f0(c.b) : "") : "–") : "") +
        row(tt("km_sum_len"), "<b>" + esc(fmt(tot)) + " m</b> · " + ls.length + " " + esc(tt("km_sum_lines"))) +
        row(tt("km_sum_obj"), esc(tt("km_sum_objv").replace("{s}", M.pts.length).replace("{w}", M.wl.length).replace("{g}", M.geb.length))) +
        row(tt("km_sum_warn"), (nm + nw ? "<b>" + (nm + nw) + "</b> " : "0 ") + '<button type="button" class="btn ghost small" data-sumgo>' + esc(tt("km_sum_go")) + "</button>") + "</dl>";
    }
    function refresh() { draw(); rows(); costSoon(); if (LY) exRender(); }
    var costT = 0, costLast = null;
    function costSoon() {
      legend(); markerSync(); msbRender(); eopRender(); hzAuto(); if (!plan) setTimeout(pfLoadActive, 150); evalRender(); rcRender(); sumRender(); hzRender(); palRender(); if (!pfInit) { pfInit = 1; pfWire(); } pfRender(); if (!sugInit) { sugInit = 1; sugRender(); } if (!opt.cost) return; clearTimeout(costT);
      costT = setTimeout(function () { var el = $("#kmCost"), ef = $("#kmCostF"); if (!el) return; var v = null; try { v = opt.cost(JSON.parse(JSON.stringify(M)), function (m) { return effLen(m); }, { area: area, perim: perim, base: base }); } catch (e) { v = null; }
        var nn = v == null ? null : (typeof v === "object" ? v.n : v), bb = v != null && typeof v === "object" ? v.b : null, f0 = function (x) { return Math.round(x).toLocaleString("de-CH"); };
        costLast = nn == null ? null : { n: nn, b: bb };
        el.textContent = nn == null ? "" : tt("km_cost").replace("{v}", f0(nn)); if (ef) { ef.textContent = nn == null ? "" : tt("km_costf").replace("{n}", f0(nn)).replace("{b}", bb == null ? "–" : f0(bb)) + (v && typeof v === "object" && v.o ? " · ⚠ " + tt("km_costOff").replace("{n}", v.o) : ""); ef.title = nn == null ? "" : tt("km_cost").replace("{v}", f0(nn)); }
        if (LY) lyRender(v); sumRender(); }, 500);
    }
    function newNote(type, pts) { snap(); var n = { id: nid("n"), type: type, pts: pts, color: noteCol, text: type === "text" ? "Text" : "", size: "m" }; M.notes.push(n); sel = { id: n.id }; return n; }
    /* ---------- Marker-Katalog (Vorbelegung), Auswertung, Fang- und Zeichenhilfen, Koordinate/Massstab ---------- */
    var snapSt = { pt: true, ln: true, rect: true, ortho: false }; try { var sv0 = JSON.parse(localStorage.getItem("lvd-km-snap") || "null"); if (sv0 && typeof sv0 === "object") snapSt = Object.assign(snapSt, sv0); } catch (e) { }
    var PRESETS = ["1×K55", "2×K55", "3×K55", "4×K55", "1×K100", "2×K100", "3×K100", "1×K100 + 1×K55", "2×K100 + 3×K55"];
    function markerSync() {
      var h = $("#kmMk"); if (!h) return; var cur = pipeTxt(cfgOf({ cfg: lastCfg })), grp = function (title, items, isOn, fn) {
        var s2 = document.createElement("h3"); s2.textContent = title; h.appendChild(s2); var row = document.createElement("div"); row.className = "mkrow"; row.setAttribute("role", "group"); row.setAttribute("aria-label", title);
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
      var airM = ls.filter(function (l) { return l.hzArt === "luft" || l.hzArt === "bohr"; }).reduce(function (a, l) { return a + effLen(l.pts); }, 0);
      out += "<h3>" + esc(tt("ws_ev_lines")) + "</h3>" + (ls.length ? rows([[ls.length + " ×", fmt(tot) + " m"]].concat(airM ? [[tt("pf_air"), fmt(airM) + " m"]] : [])) : '<p class="none">' + esc(tt("ws_ev_none")) + "</p>");
      var pk = Object.keys(pipeM).sort(function (a, b) { return b - a; }); if (pk.length) out += "<h3>" + esc(tt("ws_ev_pipes")) + "</h3>" + rows(pk.map(function (k) { return ["K" + k, fmt(pipeM[k]) + " m"]; }));
      var sk = Object.keys(surf); if (sk.length) out += "<h3>" + esc(tt("ws_ev_surf")) + "</h3>" + rows(sk.map(function (k) { return [k ? tt("km_s_" + k) : tt("ws_ev_open"), fmt(surf[k]) + " m"]; }));
      var nNeu = M.pts.filter(function (p) { return !p.mode || p.mode === "neu"; }).length, nAn = M.lines.reduce(function (a, l) { return a + (M.pts.some(function (p) { return p.id === l.s && p.mode === "anschluss"; }) ? 1 : 0) + (M.pts.some(function (p) { return p.id === l.e && p.mode === "anschluss"; }) ? 1 : 0); }, 0), nDk = M.pts.filter(function (p) { return p.mode === "deckel"; }).length;
      var ob = []; if (M.pts.length) ob.push([tt("ws_ev_sch"), nNeu + " / " + nAn + " / " + nDk]); if (M.wl.length) ob.push([tt("ws_ev_wl"), M.wl.length + ""]); if (M.geb.length) ob.push([tt("ws_ev_geb"), M.geb.length + ""]); if (M.sond.length) ob.push([tt("ws_ev_sond"), M.sond.length + ""]);
      var ar = M.areas.filter(function (f) { return f.pts.length > 2; }).reduce(function (a, f) { return a + area(f.pts); }, 0); if (ar > 0) ob.push([tt("ws_ev_area"), fmt(ar) + " m²"]);
      if (ob.length) out += "<h3>" + esc(tt("ws_ev_obj")) + "</h3>" + rows(ob);
      h.innerHTML = out;
    }
    /* Fang- und Zeichenhilfen: Punktfang (Objekte, Linienpunkte), Linienfang (Fusspunkt), Winkelraster 45° zum letzten Punkt */
    function lastActive() { var l = cur && byId(M.lines, cur), a = curA && byId(M.areas, curA), n = curN && byId(M.notes, curN), q = l ? l.pts : a ? a.pts : n ? n.pts : mode === "ruler" ? rul : null; return q && q.length ? q[q.length - 1] : null; }
    /* Fangen: Punkt, Linie (Fusspunkt, mit Knoten/Abzweig), rechtwinklig/parallel zur Bezugslinie, Winkelraster 45°. Umschalt kehrt «Rechtwinklig» vorübergehend um. */
    var shiftDown = false;
    function unitV(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy); return d > 0 ? [dx / d, dy / d] : null; }
    /* Fang Hauseinführung: Gebäudeecken/-kanten (Flächen, Rechtecke), Leitungen (Fusspunkt/Ende); beim Linienzeichnen rastet das Ende an der Hauseinführung ein */
    function gebShapes() {
      var sh = []; M.areas.forEach(function (f) { if (f.pts.length > 2) sh.push(f.pts.concat([f.pts[0]])); });
      M.notes.forEach(function (n) { if (n.type === "rect" && n.pts.length === 2) { var a = n.pts[0], b = n.pts[1]; sh.push([a, [b[0], a[1]], b, [a[0], b[1]], a]); } }); return sh;
    }
    function gebSnap(cp, ex) {
      var sh = gebShapes(), bc = null;
      sh.forEach(function (sp) { sp.slice(0, -1).forEach(function (p) { var q = map.latLngToContainerPoint(AD.ll(p)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d <= 14 && (!bc || d < bc.d)) bc = { d: d, p: p }; }); });
      if (bc) return { c: bc.p.slice(), kind: "kante", label: tt("sn_ecke") };
      var bl = null; M.lines.forEach(function (l) { if (l.pts.length < 2 || l.id === ex) return; var h = segHit(cp, l.pts); if (h && h.d <= 16 && (!bl || h.d < bl.d)) { bl = h; bl.line = l; } });
      if (bl) {
        var L0 = bl.line, ends = [L0.pts[0], L0.pts[L0.pts.length - 1]], ce = null; ends.forEach(function (p) { var q = map.latLngToContainerPoint(AD.ll(p)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d <= 12 && (!ce || d < ce.d)) ce = { d: d, p: p }; });
        return { c: ce ? ce.p.slice() : bl.q, kind: "ln", label: tt("sn_gln"), line: L0, seg: bl.seg, dir: unitV(L0.pts[bl.seg], L0.pts[bl.seg + 1]) };
      }
      var be = null; sh.forEach(function (sp) { var h = segHit(cp, sp); if (h && h.d <= 12 && (!be || h.d < be.d)) be = h; });
      return be ? { c: be.q, kind: "kante", label: tt("sn_kante") } : null;
    }
    function gebNear(cp, tol) {
      var b = null; M.geb.forEach(function (g) { var q = map.latLngToContainerPoint(AD.ll(g.pt)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d <= tol && (!b || d < b.d)) b = { d: d, g: g }; }); return b && b.g;
    }
    /* Oberfläche beim Zeichnen wechseln: ab dem zuletzt gesetzten Punkt neue Teillinie (Knoten ohne Schacht) */
    function switchSurface(f) {
      var l = cur && byId(M.lines, cur); lastCfg.fl = f;
      if (!l || !l.pts.length) { markerSync(); palRender(); return; }
      if (cfgOf(l).fl === f) { palRender(); return; }
      snap();
      if (l.pts.length === 1) { cfgOf(l).fl = f; if (f === "pflaster") cfgOf(l).ab = ""; lastCfg = JSON.parse(JSON.stringify(cfgOf(l))); lineSync(l); refresh(); return; }
      var c = l.pts[l.pts.length - 1].slice(), l2 = { id: nid("l"), pts: [c], rid: null, rohr: JSON.parse(JSON.stringify(l.rohr)), cfg: JSON.parse(JSON.stringify(cfgOf(l))), pv: l.id, sK: 1 };
      l2.cfg.fl = f; if (f === "pflaster") l2.cfg.ab = ""; lastCfg = JSON.parse(JSON.stringify(l2.cfg)); lineSync(l2); l.nx = l2.id; l.eK = 1; M.lines.push(l2); cur = l2.id; sel = { id: l2.id }; refresh();
    }
    function palRender() {
      var h = $("#kmPal"); if (!h) return; var on = mode === "line"; h.hidden = !on; if (!on) return;
      var l = cur && byId(M.lines, cur), fl = l ? cfgOf(l).fl : lastCfg.fl, fo = document.activeElement && h.contains(document.activeElement) ? document.activeElement.getAttribute("data-f") : null;
      h.innerHTML = '<span class="kmpalt">' + esc(tt("pal_t")) + "</span>" + FLS.map(function (f) { var st = LSTY[f]; return '<button type="button" class="btn ghost small kmtgl kmpalb" data-f="' + f + '" aria-pressed="' + (fl === f ? "true" : "false") + '"><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="' + st[0] + '" stroke-width="3"' + (st[1] ? ' stroke-dasharray="' + st[1].split(" ").map(function (v) { return v * 0.5; }).join(" ") + '"' : "") + "/></svg> " + esc(tt("km_pal_" + f)) + ' <kbd>' + (FLS.indexOf(f) + 1) + "</kbd></button>"; }).join("");
      if (fo) { var b = h.querySelector('[data-f="' + fo + '"]'); if (b) b.focus(); }
    }
    function snapInfo(c, forPreview) {
      var cp = map.latLngToContainerPoint(AD.ll(c)), prev = lastActive(), res = { c: c, kind: "", label: "", guide: null };
      var curL = cur && byId(M.lines, cur), best = null, tol = 14, cands = [];
      if (mode === "geb") { var gs = gebSnap(cp); if (gs) return Object.assign(res, gs); }
      if (mode === "line") { var gb = gebNear(cp, 20); if (gb) { res.c = gb.pt.slice(); res.kind = "geb"; res.label = tt("sn_geb"); res.geb = gb; return res; } }
      if (mode === "line") {   /* Schacht und Leitungsende fängt eine weitere Linie immer (unabhängig vom Punktfang) */
        var kb = null; M.pts.forEach(function (p) { var q = map.latLngToContainerPoint(AD.ll(p.pt)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d <= 28 && (!kb || d < kb.d)) kb = { d: d, p: p.pt, k: "sn_sch" }; });
        M.lines.forEach(function (l) { if (l === curL || l.pts.length < 2) return; [l.pts[0], l.pts[l.pts.length - 1]].forEach(function (p) { var q = map.latLngToContainerPoint(AD.ll(p)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d <= 28 && (!kb || d < kb.d + 6)) kb = { d: d, p: p, k: "sn_end" }; }); });
        if (kb) { res.c = kb.p.slice(); res.kind = "pt"; res.label = tt(kb.k); return res; }
      }
      if (mode && mode !== "edit" && M.dxf && M.dxf.it) {   /* DXF-Bestand: Schacht-/Knotenmitte, Linienenden und -punkte, Linie */
        var dz = dxfSnap(c, cp, snapSt.ln); if (dz) { res.c = dz.c; res.kind = "pt"; res.label = tt(dz.k); return res; }
      }
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
    function dxfSnap(c, cp, withLine) {
      var D = M.dxf, z = map.getZoom(), mpp = 156543.03 * Math.cos(map.getCenter().lat * Math.PI / 180) / Math.pow(2, z), tP = 14 * mpp, tL = 9 * mpp, best = null;
      var near = function (q, tol) { return Math.abs(q[0] - c[0]) <= tol && Math.abs(q[1] - c[1]) <= tol; }, take = function (q, k, d) { if (!best || d < best.d) best = { c: [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100], k: k, d: d }; };
      D.it.forEach(function (s) { if (s.t || !D.lay[s.l] || !D.lay[s.l].on) return; var p = s.p, n = p.length, cl = n > 3 && p[0][0] === p[n - 1][0] && p[0][1] === p[n - 1][1];
        if (s.o) { if (near(s.o, tP)) take(s.o, "sn_dxfo", Math.hypot(s.o[0] - c[0], s.o[1] - c[1])); return; }
        if (cl) { var ex = 0, ey = 0; for (var i = 0; i < n - 1; i++) { ex += p[i][0]; ey += p[i][1]; } var m = [ex / (n - 1), ey / (n - 1)]; if (near(m, tP * 1.6)) take(m, "sn_dxfo", Math.hypot(m[0] - c[0], m[1] - c[1]) * 0.6); }
        for (var k = 0; k < n; k++) if (near(p[k], tP)) take(p[k], "sn_dxfp", Math.hypot(p[k][0] - c[0], p[k][1] - c[1]));
        if (withLine) for (var k2 = 1; k2 < n; k2++) { var a = p[k2 - 1], b = p[k2]; if (Math.min(a[0], b[0]) - tL > c[0] || Math.max(a[0], b[0]) + tL < c[0] || Math.min(a[1], b[1]) - tL > c[1] || Math.max(a[1], b[1]) + tL < c[1]) continue;
          var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / L2)) : 0, q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(q[0] - c[0], q[1] - c[1]); if (d <= tL) take(q, "sn_dxfl", d + tP); } });
      return best;   /* Punkte gehen vor Linie (Linie mit Zuschlag tP) */
    }
    /* Fangmarke und Hilfslinie am Cursor */
    var snapLayer = null;
    function snapPreview(ll, shift) {
      shiftDown = !!shift; if (!snapLayer) snapLayer = L.layerGroup().addTo(map); snapLayer.clearLayers();
      if (!mode || mode === "edit" || mode === "geo" || mode === "cal" || mode === "text0") return null;
      var si = snapInfo(AD.pt(ll)); if (!si.kind) return si;
      var q = AD.ll(si.c), ic = { pt: "◯", ln: "◆", rect: si.rel === "perp" ? "⊥" : "∥", ortho: "45°", geb: "⌂", kante: "▭" }[si.kind];
      L.marker(q, { interactive: false, keyboard: false, icon: L.divIcon({ className: "kmsnap " + si.kind, html: "<span>" + esc(ic) + '</span><i>' + esc(si.label) + "</i>", iconSize: [0, 0] }) }).addTo(snapLayer);
      if (si.guide) {
        var g = si.guide, sp0 = map.latLngToContainerPoint(AD.ll(g.from)), u = 1, sp1 = map.latLngToContainerPoint(AD.ll([g.from[0] + g.D[0] * u, g.from[1] + g.D[1] * u])), sx = sp1.x - sp0.x, sy = sp1.y - sp0.y, sl = Math.hypot(sx, sy) || 1; sx /= sl; sy /= sl;
        var e1 = map.containerPointToLatLng(L.point(sp0.x + sx * 260, sp0.y + sy * 260)), e2 = map.containerPointToLatLng(L.point(sp0.x - sx * 260, sp0.y - sy * 260));
        L.polyline([e2, e1], { color: "#0e7490", weight: 1, dashArray: "4 4", interactive: false, opacity: 0.85 }).addTo(snapLayer);
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
      var startL = null, tapL = null; askHide(); ctxHide(); if (Date.now() - ctxT < 500) return;
      if (!mode) return;
      if (mode === "edit") { if (Date.now() - lastMove < 250) return; sel = null; msel = {}; refresh(); return; }
      var c = AD.pt(ll), si = mode && mode !== "geo" && mode !== "cal" ? snapInfo(c) : null; if (si) c = si.c;
      if (mode === "ruler") { rul.push(c); refresh(); return; }
      if (mode === "geo") {
        if (!ovl) return; gcp = ovl.gcp = ovl.gcp || []; var last = gcp[gcp.length - 1];
        if (!last || last.t) gcp.push({ s: ovInv(ovl, c[0], c[1]), t: null });
        else { var zc = M.dxf ? dxfSnap(c, null, true) : null; if (zc) c = zc.c; else { var sg = snapInfo(c); if (sg && (sg.kind === "pt" || sg.kind === "ln")) c = sg.c; } last.t = [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000];   /* Kartenpunkt fängt DXF, Schächte, Linien */
          var nOk = gcp.filter(function (g) { return g.t; }).length; if (nOk >= 2) { gcpFit(); if (nOk === 2 && !gcpStay) { mode = ""; dlg.querySelectorAll("[data-k=mgeo]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); } if (nOk === 2) toast(dlg, tt("ov_done2"), tt("km_undoBtn"), function () { ovl = JSON.parse(ov0); gcp = ovl ? (ovl.gcp || []) : []; ovDraw(); gcpPanel(); refresh(); }); } }
        tmp = []; ovDraw(); gcpPanel(); refresh(); return;
      }
      if (mode === "cal") {
        calPts.push(c); if (calPts.length === 2) { $("#kmCalF").hidden = false; $("#kmCalM").value = ""; $("#kmCalM").focus(); } draw(); return;
      }
      if (mode === "text") { var tn = newNote("text", [c]); refresh(); var ti = $('[data-rid="' + tn.id + '"] input[type=text]'); if (ti) { ti.focus(); ti.select(); } return; }
      if (mode === "arrow" || mode === "rect") { tmp.push(c); if (tmp.length === 2) { newNote(mode, tmp); tmp = []; } refresh(); return; }
      if (mode === "wl" || mode === "geb") {
        snap(); var q = mode === "wl" ? { id: nid("w"), pt: c, sid: null, wt: wlT, name: "", fl: lastCfg.fl || "" } : { id: nid("g"), pt: c, sid: null, cm: opt.defGeb.cm, abd: opt.defGeb.abd, name: "", on: si && si.line ? si.line.id : undefined };
        (mode === "wl" ? M.wl : M.geb).push(q); sel = { id: q.id }; refresh(); return;
      }
      if (mode === "area") {
        snap(); var fa = curA && byId(M.areas, curA);
        if (!fa) { fa = { id: nid("f"), pts: [], rid: null, belag: JSON.parse(JSON.stringify(opt.defBelag)), fl: ["pflaster", "wiese"].indexOf(lastCfg.fl) >= 0 ? lastCfg.fl : "", ab: "" }; M.areas.push(fa); curA = fa.id; sel = { id: fa.id }; }
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
            if (AD.dist(c, ia) > 0.05 && AD.dist(c, ib) > 0.05) bs.pts.splice(si.seg + 1, 0, c.slice()); startL = null; tapL = l; }
        }
      }
      refresh(); if (startL) askStart(startL, c); else if (tapL) askTap(tapL, "from");
    }
    function endLine() {
      var l = cur && byId(M.lines, cur), askL = l && l.pts.length > 1 ? l : null; if (l && l.pts.length < 2) M.lines.splice(M.lines.indexOf(l), 1);
      var n = curN && byId(M.notes, curN); if (n && n.pts.length < 2) M.notes.splice(M.notes.indexOf(n), 1);
      var fa = curA && byId(M.areas, curA); if (fa && fa.pts.length < 3) M.areas.splice(M.areas.indexOf(fa), 1);
      if (askL) { var le = askL.pts[askL.pts.length - 1], tl = plan ? 0.6 : 0.08; M.lines.forEach(function (o) { if (o === askL || o.pts.length < 2) return; var cpE = map.latLngToContainerPoint(AD.ll(le)), h = segHit(cpE, o.pts); if (h && h.d <= 1.5 && AD.dist(le, o.pts[h.seg]) > tl && AD.dist(le, o.pts[h.seg + 1]) > tl) { o.pts.splice(h.seg + 1, 0, le.slice()); askL.to = o.id; } }); }   /* Endpunkt auf fremder Linie: Knoten (T-Anschluss) */
      if (askL) { var le2 = askL.pts[askL.pts.length - 1], gt = plan ? 0.6 : 0.3; M.geb.forEach(function (g) { if (AD.dist(le2, g.pt) <= gt) { askL.gid = g.id; g.lid = askL.id; } }); }
      cur = null; curN = null; curA = null; tmp = []; hideTip(); if (askL && M.lines.indexOf(askL) >= 0) { touchedL[askL.id] = 1; ensureDepth(askL); } refresh();
      if (askL && M.lines.indexOf(askL) >= 0) { if (!(askL.to && !askL.abz && askTap(askL, "to"))) askEnd(askL); quickOpen(askL); }
    }
    function undo() {
      if (mode === "cal" && calPts.length) { calPts.pop(); $("#kmCalF").hidden = true; return draw(); }
      if (tmp.length) { tmp.pop(); return draw(); }
      var s = undoSt.pop(); if (!s) return; redoSt.push(JSON.stringify(M, noDxf)); restoreM(s);
    }
    function redo() {
      if (!redoSt.length) return; var s = redoSt.pop(); undoSt.push(JSON.stringify(M, noDxf)); restoreM(s);
    }
    function restoreM(s) {
      var dk = M.dxf; M = JSON.parse(s); if (!M.dxf && dk) M.dxf = dk; M.sond = M.sond || []; M.notes = M.notes || []; M.areas = M.areas || []; M.wl = M.wl || []; M.geb = M.geb || [];
      if (cur && !byId(M.lines, cur)) cur = null; if (curN && !byId(M.notes, curN)) curN = null; if (curA && !byId(M.areas, curA)) curA = null; if (sel && !findObj(sel.id)) sel = null; Object.keys(msel).forEach(function (k) { if (!findObj(k)) delete msel[k]; });
      refresh();
    }
    function delSel() {
      var ids = selIds(); if (!ids.length) return; snap(); ids.forEach(function (id) { var f = findObj(id); if (!f) return; f.arr.splice(f.arr.indexOf(f.o), 1); if (cur === id) cur = null; if (curN === id) curN = null; if (curA === id) curA = null; });
      sel = null; msel = {}; refresh(); toast(dlg, tt("ms_deleted").replace("{n}", ids.length), tt("km_undoBtn"), function () { var b = $("[data-k=undo]"); if (b) b.click(); });
    }
    /* Zwischenablage der Karte (Rechtsklick/Strg+C/Strg+V): Kopieren merkt die gewählten Objekte, Einfügen setzt sie am Klickpunkt ein (Verknüpfungen zu Datensätzen werden nicht mitkopiert, wie bei «Kopieren» der Mehrfachauswahl) */
    var clip = null, CLIPN = ["lines", "pts", "sond", "notes", "areas", "wl", "geb"];
    function clipCopy(ids) {
      ids = ids || selIds(); if (!ids.length) return; var items = [], rx = Infinity, ry = Infinity;
      ids.forEach(function (id) { var f = findObj(id); if (!f) return; var n = CLIPN.filter(function (k) { return M[k] === f.arr; })[0]; if (!n) return; var o = JSON.parse(JSON.stringify(f.o)); items.push({ n: n, o: o }); (o.pts || [o.pt]).forEach(function (q) { if (q) { rx = Math.min(rx, q[0]); ry = Math.min(ry, q[1]); } }); });
      if (!items.length) return; clip = { items: items, ref: [rx, ry] };
      toast(dlg, tt("ms_clipN").replace("{n}", items.length));
    }
    function clipPaste(c) {
      if (!clip || !clip.items.length) return; var dx = c[0] - clip.ref[0], dy = c[1] - clip.ref[1], made = {}; snap();
      clip.items.forEach(function (it) {
        var o = JSON.parse(JSON.stringify(it.o)); o.id = nid(String(it.o.id).charAt(0));
        ["s", "e", "from", "to", "pv", "nx", "sK", "eK", "gid", "lid", "abz", "route", "on", "hz"].forEach(function (k) { delete o[k]; }); if ("rid" in o) o.rid = null; if ("sid" in o) o.sid = null;
        if (o.pts) o.pts = o.pts.map(function (q) { return [Math.round((q[0] + dx) * 100) / 100, Math.round((q[1] + dy) * 100) / 100]; });
        else if (o.pt) o.pt = [Math.round((o.pt[0] + dx) * 100) / 100, Math.round((o.pt[1] + dy) * 100) / 100];
        M[it.n].push(o); made[o.id] = 1;
      });
      sel = null; msel = made; refresh(); toast(dlg, tt("ms_pasted").replace("{n}", Object.keys(made).length), tt("km_undoBtn"), function () { var b = $("[data-k=undo]"); if (b) b.click(); });
    }
    function offsetPoly(pts, d) {   /* Parallelversatz einer Linie: d > 0 = rechts in Zeichenrichtung, Gehrung an Knicken */
      var n = pts.length, seg = []; for (var i = 0; i < n - 1; i++) { var u = unitV(pts[i], pts[i + 1]); seg.push(u ? [u[1], -u[0]] : null); }
      return pts.map(function (q, i) {
        var n1 = i > 0 ? seg[i - 1] : seg[i], n2 = i < n - 1 ? seg[i] : seg[i - 1]; if (!n1 || !n2) return q.slice();
        var mx = n1[0] + n2[0], my = n1[1] + n2[1], ml = Math.hypot(mx, my); if (ml < 1e-6) { mx = n1[0]; my = n1[1]; ml = 1; } mx /= ml; my /= ml; var dot = Math.max(0.34, mx * n1[0] + my * n1[1]);
        return [Math.round((q[0] + mx * d / dot) * 100) / 100, Math.round((q[1] + my * d / dot) * 100) / 100];
      });
    }
    function copySel(how, ox, oy) {
      var ids = selIds(); if (!ids.length) return; var dx = ox != null ? ox : parseFloat(String($("#kmMsX").value).replace(",", ".")), dy = oy != null ? oy : parseFloat(String($("#kmMsY").value).replace(",", "."));
      if (!isFinite(dx)) dx = 0; if (!isFinite(dy)) dy = 0; if (how === "par") { var fl = findObj(ids[0]); if (ids.length !== 1 || !fl || M.lines.indexOf(fl.o) < 0 || !dx) { toast(dlg, tt("ms_parNeed")); return; } }
      snap(); var made = {};
      ids.forEach(function (id) {
        var f = findObj(id); if (!f) return; var o = JSON.parse(JSON.stringify(f.o)); o.id = nid(String(id).charAt(0));
        ["s", "e", "from", "to", "pv", "nx", "sK", "eK", "gid", "lid", "abz", "route", "on", "hz"].forEach(function (k) { delete o[k]; }); if ("rid" in o) o.rid = null; if ("sid" in o) o.sid = null;
        if (o.pts) o.pts = how === "par" ? offsetPoly(o.pts, dx) : o.pts.map(function (q) { return [Math.round((q[0] + dx) * 100) / 100, Math.round((q[1] + dy) * 100) / 100]; });
        else if (o.pt) o.pt = [Math.round((o.pt[0] + dx) * 100) / 100, Math.round((o.pt[1] + dy) * 100) / 100];
        f.arr.push(o); made[o.id] = 1;
      });
      sel = null; msel = made; refresh(); toast(dlg, tt("ms_copied").replace("{n}", Object.keys(made).length), tt("km_undoBtn"), function () { var b = $("[data-k=undo]"); if (b) b.click(); });
    }
    function msbRender() {
      var b = $("#kmMsb"); if (!b) return; var ids = selIds(), on = mode === "edit" && ids.length > 0; b.hidden = !on; if (!on) return;
      $("#kmMsN").textContent = tt("ms_n").replace("{n}", ids.length); var f = ids.length === 1 && findObj(ids[0]); b.querySelector('[data-ms=par]').disabled = !(f && M.lines.indexOf(f.o) >= 0); b.querySelector('[data-ms=join]').disabled = !(ids.length === 2 && ids.every(function (i) { var x = findObj(i); return x && M.lines.indexOf(x.o) >= 0; }));
    }
    function del(id) {
      var f = findObj(id); if (!f) return; snap(); f.arr.splice(f.arr.indexOf(f.o), 1);
      if (cur === id) cur = null; if (curN === id) curN = null; if (curA === id) curA = null; sel = null; refresh();
    }
    function show(id) {
      var f = findObj(id); if (!f) return; sel = { id: id }; var ps = f.o.pts || [f.o.pt];
      if (ps.length > 1) map.fitBounds(L.latLngBounds(ps.map(AD.ll)).pad(0.3), { maxZoom: plan ? 3 : 19, animate: false, paddingTopLeft: [0, topPad()] });
      else map.setView(AD.ll(ps[0]), Math.max(map.getZoom(), plan ? 1 : 18), { animate: false });
      refresh();
    }
    /* ---------- Layout A: Kennzahlen, Dock, Ansichtswechsel (nie automatisch übernehmen) ---------- */
    function lyRender(v) {
      var k = $("#lyKpi"); if (!k) return; var ly = v && typeof v === "object" ? v.ly : null, f0 = function (x) { return Math.round(x).toLocaleString("de-CH"); };
      var len = M.lines.filter(function (l) { return l.pts.length > 1; }).reduce(function (a, l) { return a + effLen(l.pts); }, 0);
      var kc = function (lab, val, cls) { return '<div class="lyc' + (cls ? " " + cls : "") + '"><span class="lyk">' + esc(lab) + "</span><b>" + val + "</b></div>"; };
      k.innerHTML = kc(tt("ly_kLen"), esc(fmt(len)) + " m") + kc(tt("ly_kAus"), ly ? esc(fmt(ly.V)) + " m³" : "–") + kc(tt("ly_kSch"), String(M.pts.length)) +
        kc(tt("ly_kNet"), v && v.n != null ? "CHF " + f0(v.n) : "–", "lymain") + kc(tt("ly_kBru"), v && v.b != null ? "CHF " + f0(v.b) : "–") +
        (v && v.st != null ? kc(tt("ly_kRab"), esc(tt("ly_kRabV").replace("{s}", v.st).replace("{p}", v.pct)), "lyx") : "") + (v && v.hon > 0 ? kc(tt("ly_kHon"), "CHF " + f0(v.hon), "lyx") : "") + (ly && ly.nWarn ? '<button type="button" class="lywarnb" data-lywarn>⚑ ' + esc(tt("ly_kWarn").replace("{n}", ly.nWarn)) + "</button>" : "") + (v && v.o ? '<span class="lyoffb">⚠ ' + esc(tt("km_costOff").replace("{n}", v.o)) + "</span>" : "");
      lyBase(); var st = $("#lySt"); if (st) { var sk = ly ? ly.st : "empty"; st.className = "lyst lyst-" + sk; st.textContent = tt("ly_st_" + sk); }
      if (ly) { ["aus", "kost", "pos", "warn"].forEach(function (t) { var p = $("#lyP_" + t); if (p) p.innerHTML = ly[t]; }); (function () { var po = $("#lyP_offen"), ao = document.activeElement; if (po && !(ao && po.contains(ao) && ao.tagName === "INPUT")) po.innerHTML = ly.of; var co = dlg.querySelector('[data-cnt="offen"]'); if (co) co.textContent = ly.nOf ? "(" + ly.nOf + ")" : ""; })(); var cp = dlg.querySelector('[data-cnt="pos"]'), cw = dlg.querySelector('[data-cnt="warn"]'); if (cp) cp.textContent = ly.nPos ? "(" + ly.nPos + ")" : ""; if (cw) cw.textContent = ly.nWarn ? "(" + ly.nWarn + ")" : ""; }
    }
    /* ---------- Projektexplorer ---------- */
    function exObjs() {
      var o = [];
      [["lines", "km_lineN", "ly_eLines"], ["pts", "km_schN", "ly_ePts"], ["wl", "km_wlN", "ly_eWl"], ["geb", "km_gebN", "ly_eGeb"], ["sond", "km_sondN", "ly_eSond"], ["areas", "km_areaN", "ly_eAreas"]].forEach(function (g) {
        o.push({ k: g[0], t: tt(g[2]), it: (M[g[0]] || []).map(function (x, i) { var nm = x.nm ? x.nm : tt(g[1]).replace("{n}", i + 1), sub = g[0] === "lines" ? fmt(effLen(x.pts)) + " m" + (pipeList(cfgOf(x)).length ? " · " + pipeTxt(cfgOf(x)) : "") : g[0] === "pts" ? (x.typ || "") : ""; var rn = x.rid && opt.recName ? opt.recName(x.rid) : ""; return { id: x.id, n: nm + (rn ? " · " + rn : ""), s: sub }; }) });
      });
      return o;
    }
    function exRender() {
      var T = dlg.querySelector("#lyExT"), ex = dlg.querySelector("#lyExp"); if (!T || !ex || ex.hidden) return; var q = (dlg.querySelector("#lyExQ").value || "").trim().toLowerCase(), m = function (s) { return !q || String(s).toLowerCase().indexOf(q) >= 0; };
      var open0 = {}; T.querySelectorAll("details[data-exg]").forEach(function (d) { open0[d.getAttribute("data-exg")] = d.open; });
      var dt = function (key, title, cnt, inner, defOpen) { var op = open0[key] != null ? open0[key] : defOpen; return '<details data-exg="' + key + '"' + (op || q ? " open" : "") + "><summary><span>" + esc(title) + '</span><span class="lyexc">' + cnt + "</span></summary>" + inner + "</details>"; };
      var h = "";
      h += dt("proj", tt("ly_eProj"), "", '<button type="button" class="lyexi" data-exgo="proj"><b>' + esc(LY.proj || tt("ly_noProj")) + "</b><small>" + esc(LY.ort || "") + "</small></button>", true);
      var ob = exObjs(), tot = 0, inner = "";
      ob.forEach(function (g) { var it = g.it.filter(function (x) { return m(x.n + " " + x.s); }); tot += g.it.length; if (!g.it.length) return; inner += dt("o_" + g.k, g.t, g.it.length, it.map(function (x) { if (exRen === x.id) return '<div class="lyexi lyexr"><input type="text" data-exren="' + esc(x.id) + '" value="' + esc((byId0(x.id) || {}).nm || "") + '" placeholder="' + esc(x.n) + '" aria-label="' + esc(tt("ly_xRenL")) + '" maxlength="60" autocomplete="off"></div>'; return '<button type="button" class="lyexi' + (sel && sel.id === x.id ? " on" : "") + '" data-exsel="' + esc(x.id) + '" aria-haspopup="menu" aria-current="' + (sel && sel.id === x.id ? "true" : "false") + '"><span>' + esc(x.n) + "</span>" + (x.s ? "<small>" + esc(x.s) + "</small>" : "") + "</button>"; }).join("") || '<p class="hint">–</p>', g.k === "lines" || g.k === "pts"); });
      h += dt("draw", tt("ly_eDraw"), tot, inner || '<p class="hint">' + esc(tt("ly_eEmpty")) + "</p>", true);
      var ly = '<p class="lyexl">' + esc(tt("ly_eBase")) + ": <b>" + esc(tt({ farbe: "ly_bFarbe", grau: "ly_bGrau", luft: "ly_bLuft", luftstr: "ly_bLuftStr", kataster: "ly_bKat" }[base] || "km_src")) + "</b></p>";
      if (ov.length) ly += '<p class="lyexl">' + esc(tt("ly_eCat")) + "</p>" + ov.filter(function (o) { return m(o.label || o.id); }).map(function (o) { return '<p class="lyexs">◧ ' + esc(o.label || o.id) + "</p>"; }).join("");
      if (M.dxf && M.dxf.lay) { ly += '<p class="lyexl">DXF · ' + esc(M.dxf.name || "") + "</p>" + Object.keys(M.dxf.lay).filter(function (l) { return m(l + " " + dxfLbl(l)); }).map(function (l) { var L0 = M.dxf.lay[l], lb = dxfLbl(l); return '<label class="lyexs"><input type="checkbox" data-exdxf="' + esc(l) + '"' + (L0.on ? " checked" : "") + '> <span class="kmdxsw" style="background:' + esc(L0.c) + '" aria-hidden="true"></span>' + esc(lb || l) + "</label>"; }).join(""); }
      if (ovl && ovl.img) ly += '<p class="lyexl">' + esc(tt("ly_ePlan")) + "</p><p class=\"lyexs\">▤ " + esc(tt(ovl.conf ? "ly_ePlanOk" : "ly_ePlanNo")) + (ovl.gcp && ovl.gcp.length ? " · " + ovl.gcp.length + " " + esc(tt("ly_eGcp")) : "") + "</p>";
      h += dt("lay", tt("ly_eLay"), "", ly, false);
      var rc = LY.recs ? LY.recs() : []; if (rc.length) h += dt("rec", tt("ly_eRec"), rc.reduce(function (a, r) { return a + r[1]; }, 0), rc.filter(function (r) { return m(r[2]); }).map(function (r) { return '<button type="button" class="lyexi" data-exgo="rec"><span>' + esc(r[2]) + '</span><small>' + r[1] + "</small></button>"; }).join(""), false);
      T.innerHTML = h; var ri = exRen && T.querySelector("[data-exren]"); if (ri) { ri.focus(); ri.select(); }
    }
    var exRen = null, byId0 = function (id) { var f = findObj(id); return f ? f.o : null; };
    function exZoom(id, force) {
      var fo = findObj(id), o = fo && fo.o; if (!o) return; var pts = o.pts ? o.pts : o.pt ? [o.pt] : null; if (!pts || !pts.length) return;   /* findObj liefert {o, arr} */
      var b = L.latLngBounds(pts.map(AD.ll)); if (force || !map.getBounds().contains(b)) { if (pts.length > 1) map.fitBounds(b.pad(0.4), { maxZoom: 19, animate: false }); else map.setView(b.getCenter(), Math.max(map.getZoom(), 18), { animate: false }); }
    }
    function exSelect(id) { if (!findObj(id)) return; sel = { id: id }; msel = {}; exZoom(id, false); refresh(); if (typeof showProps === "function") try { showProps(id); } catch (e) { } }
    function lyBase() { var cl = ""; dlg.querySelectorAll("[data-lyb]").forEach(function (x) { var on = x.getAttribute("data-lyb") === base; x.setAttribute("aria-pressed", on ? "true" : "false"); if (on) cl = x.textContent; }); var bt0 = dlg.querySelector(".lybtn .lybt"); if (bt0) bt0.textContent = cl || tt("km_src"); }
    function lyDock() {
      var c = lyD.c; dlg.querySelectorAll(".lydtabs [role=tab]").forEach(function (b) { var on = b.getAttribute("data-dt") === lyD.t; b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1; });
      dlg.querySelectorAll(".lydpan").forEach(function (p) { p.hidden = c || p.id !== "lyP_" + lyD.t; });
      var cb = dlg.querySelector("[data-dcol]"); if (cb) { cb.setAttribute("aria-expanded", c ? "false" : "true"); cb.textContent = tt(c ? "ly_dOpen" : "ly_dCol"); }
      dlg.classList.toggle("lydock-c", c);
      if (!lyDock.q) try { if (lyNq.matches) localStorage.setItem("lvd-ly-dockn", JSON.stringify({ c: lyD.c })); else { lyWideC = lyD.c; localStorage.setItem("lvd-ly-dock", JSON.stringify(lyD)); } } catch (e) { }
      if (PF) pfRender(); setTimeout(function () { try { map.invalidateSize({ animate: false }); } catch (e) { } }, 30);
    }
    function lyGo(t) {
      if (t === "map") return; if (cur || curN || curA || tmp.length) endLine();
      if (!lyEdited) { close(); LY.go(t); return; }
      var a = $("#lyAsk"), bar = $(".lybar"); if (!a) { a = document.createElement("div"); a.id = "lyAsk"; a.className = "lyask"; a.setAttribute("role", "group"); a.setAttribute("aria-labelledby", "lyAskT"); bar.appendChild(a); }
      a.innerHTML = '<p id="lyAskT"><b>' + esc(tt("ly_askT")) + "</b> " + esc(tt("ly_askQ")) + '</p><div class="kmbar"><button type="button" class="btn small" data-lya="apply">' + esc(tt("ly_askApply")) + '</button><button type="button" class="btn ghost small" data-lya="save">' + esc(tt("ly_askSave")) + '</button><button type="button" class="btn ghost small del" data-lya="drop">' + esc(tt("ly_askDrop")) + '</button><button type="button" class="btn ghost small" data-lya="no">' + esc(tt("ly_askNo")) + "</button></div>";
      a.hidden = false; a.setAttribute("data-t", t); a.querySelector("button").focus();
    }
    function lyClick(b) {
      if (b.hasAttribute("data-lywarn")) { lyD.t = "warn"; lyD.c = false; lyDock(); var tw = dlg.querySelector("#lyT_warn"); if (tw) tw.focus(); return; }
      if (b.hasAttribute("data-ly")) return lyGo(b.getAttribute("data-ly"));
      if (b.hasAttribute("data-lylang")) {   /* Sprache wechseln: Karte in der neuen Sprache neu aufbauen, Zeichnung (auch nicht übernommene Änderungen) und Ausschnitt bleiben */
        var lc = b.getAttribute("data-lylang"); if (lc === (LY.lang || opt.lang) || !LY.setLang) return; if (cur || curN || curA || tmp.length) endLine();
        var keep = { model: JSON.parse(JSON.stringify(M)), view: { c: map.getCenter(), z: map.getZoom() }, edited: lyEdited }; close(); LY.setLang(lc, keep); return;
      }
      if (b.hasAttribute("data-lyb")) { var nb0 = b.getAttribute("data-lyb"); if (nb0 !== base) { base = nb0; fillBase(); try { localStorage.setItem("lvd-km-base", nb0); } catch (x) { } setBase(nb0); } return lyBase(); }
      if (b.hasAttribute("data-dt")) { var t = b.getAttribute("data-dt"); if (lyD.t === t && !lyD.c) lyD.c = true; else { lyD.t = t; lyD.c = false; } return lyDock(); }
      if (b.hasAttribute("data-dcol")) { lyD.c = !lyD.c; return lyDock(); }
      var a = $("#lyAsk"), t2 = a ? a.getAttribute("data-t") : "proj", w = b.getAttribute("data-lya");
      if (w === "no") { a.hidden = true; if (LY.setPref) LY.setPref("a"); var sel0 = $("#lySel"); if (sel0) sel0.value = "a"; var nb = dlg.querySelector('[data-ly="' + t2 + '"]'); if (nb) nb.focus(); return; }
      if (w === "apply") { lyTarget = t2; var ap = dlg.querySelector("[data-k=apply]"); if (ap) ap.click(); return; }
      if (w === "save") doSave();
      close(); LY.go(t2);
    }
    var ro = null;
    function close() { window.KARTE.live = null; try { if (ro) ro.disconnect(); map.remove(); } catch (e) { } dlg.close(); dlg.remove(); if (opt.onClose) opt.onClose(); }

    if (plan) {
      var P = opt.plan; map = L.map($("#kmMap"), { crs: L.CRS.Simple, minZoom: -4, maxZoom: 6, zoomSnap: 0.25, doubleClickZoom: false, attributionControl: false });
      var bd = [[-P.h, 0], [0, P.w]]; L.imageOverlay(P.img, bd).addTo(map); map.fitBounds(bd);
      grp = L.layerGroup().addTo(map);
      $("#kmCalF").addEventListener("submit", function (e) {
        e.preventDefault(); var m = parseFloat(String($("#kmCalM").value).replace(",", ".")), d = Math.hypot(calPts[0][0] - calPts[1][0], calPts[0][1] - calPts[1][1]);
        if (!(m > 0) || !(d > 0)) { $("#kmCalM").focus(); return; }
        var old = JSON.stringify(cal); cal = { a: calPts[0], b: calPts[1], m: m, scale: m / d }; calPts = []; $("#kmCalF").hidden = true; mode = ""; refresh();
        toast(dlg, tt("pl_calDone"), tt("km_undoBtn"), function () { cal = JSON.parse(old); refresh(); });
      });
    } else {
      map = L.map($("#kmMap"), { center: [46.8, 8.23], zoom: 8, minZoom: 7, maxZoom: 22, doubleClickZoom: false, zoomAnimation: false, attributionControl: false }); L.control.attribution({ prefix: "Leaflet" }).addTo(map);
      var op0 = map.createPane("kmov"); op0.style.zIndex = 250; op0.style.pointerEvents = "none"; map.on("zoom move viewreset resize", function () { ovDraw(true); });   /* Kartenbewegung: Passpunkt-Marker bleiben (Fokus/Tastatur) */
      (function () {   /* Anzeige-Stil und Fenster-/Kreuzauswahl */
        lblWas = labelsOn(); var ss = $("#kmStl"); if (ss) { ss.value = stl; ss.addEventListener("change", function () { stl = ss.value; try { localStorage.setItem("lvd-km-style", stl); } catch (e) { } lblWas = labelsOn(); draw(); }); }
        var zT = null; map.on("zoomend", function () { clearTimeout(zT); zT = setTimeout(function () { if (M.pts.length || (BAND_ON && M.lines.length)) draw(); }, 80); });   /* Schachtzeichen (Mindestgrösse) und Grabenband zoomabhängig */
        map.on("zoomend", function () { if (stl === "zoom") { var on = labelsOn(); if (on !== lblWas) { lblWas = on; draw(); } } });
        if (map.boxZoom) map.boxZoom.disable();   /* Umschalt+Ziehen = Auswahlrechteck (statt Zoomfenster): links→rechts Fenster, rechts→links Kreuzen */
        var mc = map.getContainer(), bxEl = null, b0 = null;
        mc.addEventListener("mousedown", function (e) {
          if (e.button !== 0 || !e.shiftKey || (mode && mode !== "edit") || e.target.closest(".leaflet-control,.leaflet-marker-icon")) return;
          var r = mc.getBoundingClientRect(); b0 = { x: e.clientX - r.left, y: e.clientY - r.top, moved: false }; map.dragging.disable();
        }, true);
        document.addEventListener("mousemove", function (e) {
          if (!b0) return; var r = mc.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; if (!b0.moved && Math.hypot(x - b0.x, y - b0.y) < 6) return; b0.moved = true;
          if (!bxEl) { bxEl = document.createElement("div"); bxEl.className = "kmbox"; mc.appendChild(bxEl); }
          bxEl.className = "kmbox " + (x < b0.x ? "cross" : "win"); bxEl.style.left = Math.min(x, b0.x) + "px"; bxEl.style.top = Math.min(y, b0.y) + "px"; bxEl.style.width = Math.abs(x - b0.x) + "px"; bxEl.style.height = Math.abs(y - b0.y) + "px";
        });
        document.addEventListener("mouseup", function (e) {
          if (!b0) return; var st = b0, r = mc.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; b0 = null; map.dragging.enable(); if (bxEl) { bxEl.remove(); bxEl = null; }
          if (st.moved) boxSelect(L.point(st.x, st.y), L.point(x, y), x < st.x);
        });
      })();
      /* «Auf Bestand zoomen»: Symbolknopf neben dem Zoomfeld (+/−) der Karte und des Plans */
      (function () {
        var C = L.Control.extend({ options: { position: "topleft" }, onAdd: function () {
          var d = L.DomUtil.create("div", "leaflet-bar kmfitc"), a = L.DomUtil.create("a", "", d); a.href = "#"; a.setAttribute("role", "button"); a.title = tt("km_fit"); a.setAttribute("aria-label", tt("km_fit"));
          a.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M2 7V2h5M13 2h5v5M18 13v5h-5M7 18H2v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="6.5" y="6.5" width="7" height="7" rx="1" fill="currentColor"/></svg>';
          L.DomEvent.disableClickPropagation(d); L.DomEvent.on(a, "click", function (e) { L.DomEvent.stop(e); fitAll(); }); return d; } });
        new C().addTo(map);
      })();
      ovGrp = L.layerGroup().addTo(map); grp = L.layerGroup().addTo(map); tiles(); drawOv(); selList(); dxfPanelEv(); dxfPanel();
      if (M.dxf) setTimeout(function () { var tg = $(".kmmidtog"); if (tg && tg.getAttribute("aria-expanded") !== "true") tg.click(); }, 0);   /* Projekt mit DXF: Layerliste sichtbar */
      $("#kmCat").addEventListener("toggle", function (e) { if (e.target.open) openCat(); });
      $("#kmCatQ").addEventListener("input", resList);
      $("#kmCat .kmchips").addEventListener("click", function (e) {
        var d = e.target.closest("[data-ovq]"); if (d) { var c0 = (catList || []).filter(function (x) { return x.id === d.dataset.ovq; })[0]; if (!c0) return; var i = ov.findIndex(function (o) { return o.id === c0.id; }); if (i >= 0) ov.splice(i, 1); else ov.push({ id: c0.id, label: c0.label, type: c0.type, srv: c0.srv, fmt: c0.fmt, op: 0.8 }); saveOv(); drawOv(); selList(); resList(); chips(); return; }
        var c = e.target.closest("[data-q]"); if (!c) return; $("#kmCat").open = true; $("#kmCatQ").value = c.dataset.q; openCat(); resList(); $("#kmCatQ").focus(); });
      $("#kmCatS").addEventListener("click", function (e) { var b = e.target.closest("[data-ovdel]"); if (!b) return; ov.splice(+b.dataset.ovdel, 1); saveOv(); drawOv(); selList(); resList(); });
    }
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { try { map.invalidateSize({ animate: false }); ovDraw(); } catch (e) { } }); ro.observe($("#kmMap")); }
    if (LY) {   /* Layout A: Dock, Layout-Umschalter, Änderungen merken */
      lyDock(); lyRender(null);
      var lys = $("#lySel"); if (lys) lys.addEventListener("change", function () { if (lys.value === "classic") { if (LY.setPref) LY.setPref("classic"); lyGo("proj"); } else lys.value = "a"; });
      ["input", "change"].forEach(function (n) { dlg.addEventListener(n, function (e) { if (e.target.closest && e.target.closest("#kmObj,#kmProps,#kmQuick")) lyEdited = true; }); });
      var dtl = dlg.querySelector(".lydtabs"); if (dtl) dtl.addEventListener("keydown", function (e) { if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; var bs = [].slice.call(dtl.querySelectorAll("[role=tab]")), i0 = bs.indexOf(document.activeElement); if (i0 < 0) return; var nb = bs[(i0 + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length]; nb.focus(); e.preventDefault(); });
    }
    map.on("click", function (e) { if (rtPickFn && rtPickFn(e.latlng)) return; var t = e.originalEvent && e.originalEvent.target; if (mode === "edit" && t && t.closest && t.closest(".leaflet-marker-icon,.leaflet-interactive")) return; addPt(e.latlng); });
    map.on("mousemove", function (e) { var t = Date.now(); if (t - (snapPreview.t || 0) < 25) return; snapPreview.t = t; var oe = e.originalEvent; liveTip(e.latlng, oe && oe.shiftKey); }); map.on("mouseout", function () { hideTip(); if (snapLayer) snapLayer.clearLayers(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Shift") shiftDown = true; }); document.addEventListener("keyup", function (e) { if (e.key === "Shift") shiftDown = false; });
    map.on("dblclick", function () { if (mode === "line" || mode === "sline" || mode === "area") endLine(); });
    map.boxZoom.disable();
    map.on("mousedown", function (e) {   /* Rahmenauswahl (Bearbeiten-Modus): Umschalt + Aufziehen wählt alle Objekte, die ganz im Rahmen liegen */
      var oe = e.originalEvent; if (mode !== "edit" || !oe || !oe.shiftKey || oe.button) return; L.DomEvent.stop(oe); map.dragging.disable();
      var host = map.getContainer(), a = e.containerPoint, box = document.createElement("div"); box.className = "kmrubber"; host.appendChild(box);
      function pos(p) { box.style.left = Math.min(a.x, p.x) + "px"; box.style.top = Math.min(a.y, p.y) + "px"; box.style.width = Math.abs(p.x - a.x) + "px"; box.style.height = Math.abs(p.y - a.y) + "px"; }
      var last = a; function mm(ev) { last = ev.containerPoint; pos(last); }
      function up() {
        map.off("mousemove", mm); document.removeEventListener("mouseup", up); map.dragging.enable(); box.remove();
        if (Math.abs(last.x - a.x) < 5 && Math.abs(last.y - a.y) < 5) return; lastMove = Date.now();
        var x0 = Math.min(a.x, last.x), x1 = Math.max(a.x, last.x), y0 = Math.min(a.y, last.y), y1 = Math.max(a.y, last.y), inB = function (p) { var q = map.latLngToContainerPoint(AD.ll(p)); return q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1; }, made = {};
        [M.lines, M.pts, M.sond, M.notes, M.areas, M.wl, M.geb].forEach(function (arr) { arr.forEach(function (o) { var ps = o.pts || (o.pt ? [o.pt] : []); if (ps.length && ps.every(inB)) made[o.id] = 1; }); });
        if (!oe.ctrlKey) sel = null; Object.keys(made).forEach(function (k) { msel[k] = 1; }); refresh(); var n = selIds().length; if (n) toast(dlg, tt("ms_picked").replace("{n}", n));
      }
      map.on("mousemove", mm); document.addEventListener("mouseup", up);
    });
    map.on("zoomend", function () { if (mode === "edit" || M.notes.some(function (n) { return n.type === "arrow"; })) draw(); });
    var cs = $("#kmCol"); cs.addEventListener("change", function () { noteCol = cs.value; });
    var dxfF = $("#kmDxfF"); if (dxfF) dxfF.addEventListener("change", function () {
      var f = dxfF.files && dxfF.files[0]; if (!f) return;
      if (!/\.dxf$/i.test(f.name) && (/\.pdf$/i.test(f.name) || f.type === "application/pdf" || /^image\/(png|jpe?g|gif|webp)$/.test(f.type))) {   /* PDF/Bild: als Planunterlage auf die Karte (Geo-Portal: automatisch platziert) */
        var of = $("#kmOvF"); if (of) { try { var dt = new DataTransfer(); dt.items.add(f); of.files = dt.files; } catch (x) { return; } var od = $("#kmOvD"); if (od) od.open = true; var tg = $(".kmmidtog"); if (tg && tg.getAttribute("aria-expanded") !== "true") tg.click(); of.dispatchEvent(new Event("change")); }
        return;
      }
      if (f.size > 20e6) { toast(dlg, "⚠ " + tt("km_dxfBig")); return; }
      var rd = new FileReader(); rd.onload = function () { var by = new Uint8Array(rd.result), t;
        if (/^AutoCAD Binary DXF/.test(String.fromCharCode.apply(null, by.subarray(0, 22)))) { toast(dlg, "⚠ " + tt("km_dxfBin")); return; }
        try { t = new TextDecoder("utf-8", { fatal: true }).decode(by); } catch (e) { t = new TextDecoder("windows-1252").decode(by); }   /* UTF-8, sonst ANSI (Windows-1252) */
        var res; try { res = dxfParse(t); } catch (e) { if (window.console) console.error(e); res = { it: [] }; }
        if (!res.it.length) { toast(dlg, "⚠ " + tt("km_dxfNone")); return; } dxfAsk(res, f.name); };
      rd.readAsArrayBuffer(f);
    });

    dlg.addEventListener("change", function (e) { var ha = e.target.closest("[data-hz=auto]"); if (ha) { HZAUTO = ha.checked; try { localStorage.setItem("lvd-km-hzauto", HZAUTO ? "1" : "0"); } catch (x) { } if (HZAUTO) { hzSkip = {}; hzSeed(); } return; } var hm = e.target.closest("[data-hz=mode]"); if (hm) { SLOPE = hm.checked; try { localStorage.setItem("lvd-km-slope", SLOPE ? "1" : "0"); } catch (x) { } refresh(); return; } var t = e.target.closest("[data-rc]"); if (!t) return; RC[t.dataset.rc] = t.value; try { localStorage.setItem("lvd-km-rc", JSON.stringify(RC)); } catch (x) { } sugs = []; sugDraw(); sugRender(); rcRender(); });
    dlg.addEventListener("click", function (e) {
      var pb = e.target.closest("[data-prov]");
      if (LY) { var lyb = e.target.closest("[data-ly],[data-lya],[data-dt],[data-dcol],[data-lyb],[data-lylang],[data-lywarn]"); if (lyb) { lyClick(lyb); return; } }
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
      var ebt = e.target.closest("[data-eop]"); if (ebt) { editOp = ebt.getAttribute("data-eop"); try { localStorage.setItem("lvd-km-eop", editOp); } catch (x) { } eopRender(); draw(); return; }
      var mbt = e.target.closest("[data-ms]"); if (mbt) { var mk2 = mbt.getAttribute("data-ms"); if (mk2 === "copy" || mk2 === "par") copySel(mk2); else if (mk2 === "join") { var js = selIds().map(findObj).filter(function (f) { return f && M.lines.indexOf(f.o) >= 0; }); if (js.length !== 2) toast(dlg, tt("ms_joinNeed")); else finishJoin(joinLines(js[0].o, js[1].o)); } else if (mk2 === "del") delSel(); else if (mk2 === "clr") { sel = null; msel = {}; refresh(); } return; }
      var pb = e.target.closest(".kmpalb"); if (pb) { switchSurface(pb.getAttribute("data-f")); return; }
      if (e.target.closest("[data-sumgo]")) { var te = $("#kmTabE"); if (te) te.click(); return; }
      var hzb = e.target.closest("[data-hz]"); if (hzb) { if (hzb.dataset.hz === "load") hzLoad(); return; }
      var sgb = e.target.closest("[data-sg],#kmDxf"); if (sgb) { if (sgb.id === "kmDxf") dxfExport(); else if (sgb.dataset.sg === "calc") { sugs = sugCompute(); sugDraw(); sugRender(); if (!sugs.length) { var sh = $("#kmSug"); if (sh) { var pn = document.createElement("p"); pn.className = "hint"; pn.setAttribute("role", "status"); pn.textContent = tt("sg_none"); sh.appendChild(pn); } } } else if (sgb.dataset.sg === "apply") sugApply(); else { sugs = []; sugDraw(); sugRender(); } return; }
      var b = e.target.closest("[data-k],[data-z],[data-d],[data-n]"); if (!b) return; askHide();
      if (b.dataset.n) { var nn = b.dataset.n.split("|"); return nudge(nn[0], nn[1]); }
      if (b.dataset.z) return show(b.dataset.z); if (b.dataset.d) return del(b.dataset.d);
      var k = b.getAttribute("data-k");
      if (/^m(ruler|line|pt|sond|text|arrow|sline|rect|area|wl|geb)$/.test(k) || k === "route") lastCmd = { k: k, t: String(b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent).replace(/\s+/g, " ").trim().slice(0, 40) };
      if (k === "close") { if (LY) lyGo("proj"); else close(); }
      else if (/^m(geo|ruler|line|pt|sond|cal|edit|text|arrow|sline|rect|area|wl|geb)$/.test(k)) { var m = k.slice(1); if (m === "geo") { useParcel(); ov0 = JSON.stringify(ovl); if (ovl && !gcpKeep && ovl.gcp && ovl.gcp.length) { var oG = JSON.stringify(ovl.gcp); ovl.gcp = []; ovl.rms = null; toast(dlg, tt("ov_gNew"), tt("km_undoBtn"), function () { if (ovl) { ovl.gcp = JSON.parse(oG); gcp = ovl.gcp; gcpPanel(); refresh(); } }); } gcp = ovl ? (ovl.gcp = ovl.gcp || []) : []; gcpStay = gcpKeep; gcpKeep = false; setTimeout(gcpPanel, 0); }   /* «Passpunkte setzen» = neue Ausrichtung; «Passpunkt hinzufügen» verfeinert */ if (m === "ruler") rul = []; hideTip(); if (mode === "line" || mode === "sline" || mode === "area") endLine(); tmp = []; calPts = []; if (plan) $("#kmCalF").hidden = true; mode = mode === m ? "" : m; refresh(); }
      else if (k === "center") addPt(map.getCenter());
      else if (k === "end") endLine();
      else if (k === "sv") { var cc = map.getCenter(); svOpen(toLV95(cc.lat, cc.lng), null, true); }
      else if (k === "svkey") { var kv = window.prompt(tt("km_sv_keyAsk"), svKey()); if (kv !== null) { try { if (kv.trim()) localStorage.setItem("lvd-gsv-key", kv.trim()); else localStorage.removeItem("lvd-gsv-key"); } catch (e) { } } }
      else if (k === "undo") undo(); else if (k === "redo") redo();
      else if (k === "clear") { var sn0 = JSON.stringify(M); snap(); M.lines = []; M.pts = []; M.sond = []; M.notes = []; M.areas = []; M.wl = []; M.geb = []; rul = []; cur = null; curN = null; curA = null; sel = null; refresh(); toast(dlg, tt("km_cleared"), tt("km_undoBtn"), function () { M = JSON.parse(sn0); M.notes = M.notes || []; M.areas = M.areas || []; M.wl = M.wl || []; M.geb = M.geb || []; refresh(); }); }
      else if (k === "geo") openGeo();
      else if (k === "dxfin") { var dfi = $("#kmDxfF"); if (dfi) { dfi.value = ""; dfi.click(); } }
      else if (k === "fit") fitAll();
      else if (k === "max") { var on = !dlg.classList.contains("kmmax"); dlg.classList.toggle("kmmax", on); b.setAttribute("aria-pressed", on ? "true" : "false"); try { localStorage.setItem("lvd-km-max", on ? "1" : "0"); } catch (x) { } setTimeout(function () { map.invalidateSize({ animate: false }); ovDraw(); }, 50); }
      else if (k === "band") { BAND_ON = !BAND_ON; try { localStorage.setItem("lvd-km-band", BAND_ON ? "1" : "0"); } catch (x) { } b.setAttribute("aria-pressed", BAND_ON ? "true" : "false"); draw(); legend(); }
      else if (k === "lbl") { showLbl = !showLbl; b.setAttribute("aria-pressed", showLbl ? "true" : "false"); draw(); }
      else if (k === "save") { doSave(); }
      else if (k === "apply") {
        endLine(); Object.keys(touchedL).forEach(function (id) { var tl = byId(M.lines, id); if (tl) ensureDepth(tl, true); });   /* neue/geänderte Linien: Mindestüberdeckung einhalten */
        if (plan && !cal.scale && (M.lines.length || M.areas.length)) { toast(dlg, tt("pl_calNeed")); return; }
        opt.onApply(M, cal, function (m) { return effLen(m); }, { area: area, perim: perim, base: base, overlay: ovl, planCleared: planCleared }); var lt = lyTarget; lyTarget = null; close(); if (LY && LY.after) LY.after(lt || "stay");
      }
    });
    function doSave() {   /* Zeichnung sichern (bleibt im Fenster); Datensätze erst mit «In Datensätze übernehmen» */
      if (!opt.onSave) return; if (cur || curN || curA || tmp.length) endLine();
      try { opt.onSave(JSON.parse(JSON.stringify(M)), cal, { base: base, overlay: ovl, planCleared: planCleared }); lyEdited = false; toast(dlg, tt("km_saved")); } catch (e) { toast(dlg, tt("km_save_err")); }
    }
    dlg.addEventListener("cancel", function (e) { e.preventDefault();
      if (mode === "geo") { var lg0 = gcp[gcp.length - 1]; if (lg0 && !lg0.t) gcp.pop(); else { mode = ""; dlg.querySelectorAll("[data-k=mgeo]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); } ovDraw(); gcpPanel(); refresh(); return; }
      if (cur || curN || curA || tmp.length || (mode === "ruler" && rul.length)) { if (mode === "ruler") rul = []; endLine(); toast(dlg, tt("km_escDone")); return; } var la = $("#lyAsk"); if (la && !la.hidden) { la.hidden = true; return; } if (LY) lyGo("proj"); else close(); });
    /* Tastatur: Enter/Leertaste = Punkt in Kartenmitte, Umschalt+Enter = beenden, Entf = Objekt löschen, Strg+Z = Rückgängig */
    dlg.addEventListener("keydown", function (e) {
      var t = e.target, ed = t.matches && t.matches("input,select,textarea");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !ed) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); doSave(); return; }
      if (LY && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {   /* Arbeitsplatz-Kürzel (kollisionsfrei mit dem Bestand) */
        var kk = e.key.toLowerCase();
        if (kk === "j") { e.preventDefault(); lyD.c = !lyD.c; lyDock(); return; }
        if (kk === "b" && window.__LYEXP) { e.preventDefault(); var cur0 = dlg.querySelector("#lyExp"); window.__LYEXP.set(cur0 && !cur0.hidden ? "t" : "e", true); return; }
        if (kk === "f" && window.__LYEXP) { e.preventDefault(); window.__LYEXP.set("e"); var q0 = dlg.querySelector("#lyExQ"); if (q0) { q0.focus(); q0.select(); } return; }
      }
      if ((e.ctrlKey || e.metaKey) && !ed && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && !ed && e.key.toLowerCase() === "a" && mode === "edit") { e.preventDefault(); msel = {}; sel = null; [M.lines, M.pts, M.sond, M.notes, M.areas, M.wl, M.geb].forEach(function (a) { a.forEach(function (o) { msel[o.id] = 1; }); }); refresh(); return; }
      if (t.id === "kmMap" && mode && mode !== "edit") {
        if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); endLine(); return; }
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addPt(map.getCenter()); return; }
      }
      if (t.id === "kmMap" && (!mode || mode === "edit") && !ed && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); repeatCmd(); return; }   /* wie AutoCAD: Enter/Leertaste wiederholt den letzten Befehl */
      if (mode === "line" && !ed && !e.ctrlKey && !e.metaKey && !e.altKey && /^[1-4]$/.test(e.key)) { e.preventDefault(); switchSurface(FLS[+e.key - 1]); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && !ed && mode === "edit" && e.key.toLowerCase() === "c" && selIds().length) { e.preventDefault(); clipCopy(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && !ed && mode === "edit" && e.key.toLowerCase() === "v" && clip) { e.preventDefault(); clipPaste(AD.pt(map.getCenter())); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && !ed && mode === "edit" && selIds().length) { e.preventDefault(); delSel(); }
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
    /* Route von Adresse zu Adresse (Fussweg, OpenStreetMap-Routing): erzeugt eine editierbare Linie als Vorschlag.
       Start/Ziel auch als Kartenpunkt (📍): Fang auf Schacht (Linie wird angeschlossen) oder Leitungsende; ohne Route wird eine gerade Linie angeboten. */
    var rtPickFn = null;
    if (!plan && $("#kmRoute")) (function () {
      var RT = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/", rt = $("#kmRoute"), msg = $("#kmRtMsg"), go = $("#kmRtGo"), pick = { A: null, B: null }, tmr = {}, busy = false;
      function say(k, o, err) { var t = tt(k); Object.keys(o || {}).forEach(function (x) { t = t.replace("{" + x + "}", o[x]); }); msg.textContent = t; msg.className = "hint" + (err ? " reqmsg" : ""); }
      function ready() { go.disabled = busy || !pick.A || !pick.B; if (!pick.A || !pick.B) str.hidden = true; }
      var str = $("#kmRtStr"), pickK = null, rtLay = L.layerGroup().addTo(map);
      function marks() { rtLay.clearLayers(); ["A", "B"].forEach(function (k) { var p = pick[k]; if (!p) return; L.circleMarker([p.lat, p.lon], { radius: 7, color: "#fff", weight: 2, fillColor: k === "A" ? "#1c6b3f" : "#b8332a", fillOpacity: 1, interactive: false }).bindTooltip(k === "A" ? tt("km_rt_from") : tt("km_rt_to"), { permanent: true, direction: "top", offset: [0, -8] }).addTo(rtLay); }); }
      function pickMode(k) {   /* k = "A"/"B" Punktwahl an, null aus */
        pickK = k; ["A", "B"].forEach(function (x) { var b = $("#kmRtP" + x); if (b) b.setAttribute("aria-pressed", x === k ? "true" : "false"); });
        $("#kmMap").classList.toggle("kmrtpick", !!k); rtPickFn = k ? pickAt : null;
        if (k) { say("km_rt_pickMsg", { w: tt(k === "A" ? "km_rt_from" : "km_rt_to") }); $("#kmMap").focus(); }
      }
      function pickAt(ll) {   /* Fang: Schacht (28 px) vor Leitungsende (28 px), sonst Klickpunkt */
        if (!pickK) return false; var k = pickK, cp = map.latLngToContainerPoint(ll), best = null;
        M.pts.forEach(function (p, i) { var q = map.latLngToContainerPoint(AD.ll(p.pt)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d <= 28 && (!best || d < best.d)) best = { d: d, pt: p.pt, sid: p.id, lab: tt("km_rt_ptSch").replace("{n}", i + 1) + (p.name ? " – " + p.name : "") }; });
        if (!best) M.lines.forEach(function (l, i) { if (l.pts.length < 2) return; [l.pts[0], l.pts[l.pts.length - 1]].forEach(function (p) { var q = map.latLngToContainerPoint(AD.ll(p)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d <= 28 && (!best || d < best.d)) best = { d: d, pt: p, lab: tt("km_rt_ptEnd").replace("{n}", i + 1) }; }); });
        var pt = best ? best.pt.slice() : AD.pt(ll), w = L.latLng(AD.ll(pt)), lab = best ? best.lab : tt("km_rt_ptLbl").replace("{e}", Math.round(pt[0]).toLocaleString("de-CH")).replace("{n}", Math.round(pt[1]).toLocaleString("de-CH"));
        pick[k] = { lat: w.lat, lon: w.lng, label: lab, pt: pt, sid: best && best.sid ? best.sid : null }; $("#kmRt" + k).value = lab; $("#kmRt" + k + "h").innerHTML = "";
        pickMode(null); marks(); ready(); say("km_rt_hint"); var nx = k === "A" && !pick.B ? $("#kmRtPB") : go; if (nx && !nx.disabled) nx.focus(); return true;
      }
      ["A", "B"].forEach(function (k) { $("#kmRtP" + k).addEventListener("click", function () { pickMode(pickK === k ? null : k); }); });
      $("#kmMap").addEventListener("keydown", function (e) { if (pickK && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); pickAt(map.getCenter()); } else if (pickK && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); pickMode(null); say("km_rt_hint"); } }, true);
      function ptOf(p) { return p.pt ? p.pt.slice() : AD.pt(L.latLng(p.lat, p.lon)); }
      function finish(pts, isRoute) {   /* Linie anlegen; gewählte Kartenpunkte exakt treffen und an Schacht anschliessen */
        endLine(); snap(); var l = { id: nid("l"), pts: pts, rid: null, rohr: JSON.parse(JSON.stringify(opt.defRohr)), cfg: JSON.parse(JSON.stringify(lastCfg)) }; if (isRoute) l.route = 1;
        if (pick.A.sid) l.s = pick.A.sid; if (pick.B.sid) l.e = pick.B.sid;
        lineSync(l); M.lines.push(l); cur = null; sel = { id: l.id }; rtLay.clearLayers(); refresh();
        try { map.fitBounds(L.latLngBounds(pts.map(AD.ll)).pad(0.25), { maxZoom: 19 }); } catch (e) { }
        sugs = sugCompute(); sugDraw(); sugRender(); showProps(l.id); return l;
      }
      str.addEventListener("click", function () { if (!pick.A || !pick.B) return; var a = ptOf(pick.A), b = ptOf(pick.B); if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05) return; finish([a, b], false); str.hidden = true; say("km_rt_strOk", { m: fmt(lineLen([a, b])) }); });
      function search(k) {
        var inp = $("#kmRt" + k), ul = $("#kmRt" + k + "h"), q = inp.value.trim(); pick[k] = null; ready(); marks(); if (q.length < 3) { ul.innerHTML = ""; return; }
        ul.innerHTML = '<li class="kmnote">' + esc(tt("km_searching")) + "</li>";
        fetch(SEARCH + "?type=locations&origins=address,zipcode,gazetteer&limit=6&sr=2056&lang=" + (opt.lang || "de") + "&searchText=" + encodeURIComponent(q))
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(function (j) {
            if (inp.value.trim() !== q) return; var hits = (j.results || []).filter(function (r) { return r.attrs && isFinite(r.attrs.lat) && isFinite(r.attrs.lon); });
            ul.innerHTML = hits.length ? "" : '<li class="kmnote">' + esc(tt("km_none")) + "</li>";
            hits.forEach(function (r) { var li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.className = "kmhit"; var lb = String(r.attrs.label || "").replace(/<[^>]*>/g, ""); b.textContent = lb;
              b.addEventListener("click", function () { pick[k] = { lat: r.attrs.lat, lon: r.attrs.lon, label: lb }; inp.value = lb; ul.innerHTML = ""; ready(); marks(); if (k === "A") $("#kmRtB").focus(); else go.focus(); });
              li.appendChild(b); ul.appendChild(li); });
            if (hits.length === 1 && /\d/.test(q) && String(hits[0].attrs.label || "").replace(/<[^>]*>/g, "").toLowerCase().indexOf(q.toLowerCase()) === 0) { /* eindeutiger Treffer: nicht automatisch wählen, Benutzer bestätigt */ }
          }).catch(function () { ul.innerHTML = '<li class="kmnote err">' + esc(tt("km_searchErr")) + "</li>"; });
      }
      ["A", "B"].forEach(function (k) {
        var inp = $("#kmRt" + k); inp.addEventListener("input", function () { if (pick[k]) { pick[k] = null; ready(); marks(); } clearTimeout(tmr[k]); tmr[k] = setTimeout(function () { search(k); }, 350); });   /* Tippen verwirft den gewählten Punkt sofort */
        inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); clearTimeout(tmr[k]); var f = $("#kmRt" + k + "h .kmhit"); if (f && !pick[k]) f.click(); else if (!pick[k]) search(k); else if (k === "A") $("#kmRtB").focus(); else if (!go.disabled) go.click(); } });
      });
      function dp(pts, tol) {   /* Douglas-Peucker */
        if (pts.length < 3) return pts.slice(); var keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
        (function rec(a, b) { var mx = 0, mi = -1; for (var i = a + 1; i < b; i++) { var d = projPoly([pts[a], pts[b]], pts[i]).d; if (d > mx) { mx = d; mi = i; } } if (mi > 0 && mx > tol) { keep[mi] = true; rec(a, mi); rec(mi, b); } })(0, pts.length - 1);
        return pts.filter(function (q, i) { return keep[i]; });
      }
      function make() {
        if (!pick.A || !pick.B || busy) return; busy = true; ready(); say("km_rt_busy");
        fetch(RT + pick.A.lon + "," + pick.A.lat + ";" + pick.B.lon + "," + pick.B.lat + "?overview=full&geometries=geojson&steps=false")
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(function (j) {
            var rr = j && j.routes && j.routes[0]; if (!rr || !rr.geometry || rr.geometry.coordinates.length < 2) throw 1;
            var raw = rr.geometry.coordinates.map(function (c) { return AD.pt(L.latLng(c[1], c[0])); }), pts = dp(raw, 1.5).map(function (q) { return [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]; });
            if (pts.length < 2) throw 1;
            var far = function (p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05; };   /* Kartenpunkt: Linie beginnt/endet genau dort (Zubringer zum Weg) */
            if (pick.A.pt) { if (far(pick.A.pt, pts[0])) pts.unshift(pick.A.pt.slice()); else pts[0] = pick.A.pt.slice(); }
            if (pick.B.pt) { if (far(pick.B.pt, pts[pts.length - 1])) pts.push(pick.B.pt.slice()); else pts[pts.length - 1] = pick.B.pt.slice(); }
            finish(pts, true);
            var wp = j.waypoints || [], da = wp[0] && isFinite(wp[0].distance) ? Math.round(wp[0].distance) : 0, db = wp[1] && isFinite(wp[1].distance) ? Math.round(wp[1].distance) : 0;
            say(pick.A.pt || pick.B.pt ? "km_rt_okPt" : "km_rt_ok", { m: fmt(lineLen(pts)), n: pts.length, a: da, b: db });
          }).catch(function (e) { say(e === 1 ? "km_rt_none" : "km_rt_err", null, true); str.hidden = false; })
          .then(function () { busy = false; ready(); });
      }
      go.addEventListener("click", make);
      $("#kmRtX").addEventListener("click", function () { closeRt(); });
      function closeRt() { pickMode(null); rtLay.clearLayers(); rt.hidden = true; var b = dlg.querySelector('[data-k=route]'); if (b) { b.setAttribute("aria-pressed", "false"); b.focus(); } }
      window.__KMRT = { open: function () { rt.hidden = false; }, pick: pick };
      dlg.addEventListener("click", function (e) { var b = e.target.closest('[data-k=route]'); if (!b) return; var o = rt.hidden; rt.hidden = !o; b.setAttribute("aria-pressed", o ? "true" : "false"); if (o) $("#kmRtA").focus(); });
      rt.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); if (pickK) { pickMode(null); say("km_rt_hint"); } else closeRt(); } });
    })();
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
          if (!res) { m0.textContent = tt("ov_autoNone"); m0.className = "hint"; var gb0 = $("[data-k=mgeo]"); if (gb0 && !gb0.disabled && mode !== "geo" && ovl && !ovl.conf) gb0.click(); return; }   /* keine automatische Ausrichtung: geführtes Einpassen startet von selbst */
          ov0 = JSON.stringify(ovl); ovl.E = res.E; ovl.N = res.N; ovl.rot = 0; if (res.mpp) { ovl.mpp = res.mpp; ovl.auto = 0; } ovl.autoSrc = res.src; ovl.conf = false;
          fitAll(); refresh(); m0.textContent = ""; at.textContent = res.txt; card.hidden = false; $("[data-oa=ok]").focus();
        };
        if (r.center && mpp) { var zc = r.center; fin({ src: "center", E: zc.E + (r.w / 2 - zc.fx) * mpp, N: zc.N - (r.h / 2 - zc.fy) * mpp, mpp: mpp, txt: autoTxt(zc.gp ? "ov_autoGp" : "ov_autoCenter", { e: Math.round(zc.E), n: Math.round(zc.N), r: r.ratio || "" }) });
          if (ovl && run === autoRun) { ovl.conf = true; ovl.op = zc.gp ? 0.5 : ovl.op; ovDraw(); }   /* exakt aus dem Plankopf: ohne weitere Bestätigung gültig, «Verwerfen» bleibt möglich */
          return; }
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
        else if (k === "ref") { $("#kmOvAuto").hidden = true; ovl.conf = false; if (mode !== "geo") $("[data-k=mgeo]").click(); else { refresh(); gstepRender(); } }
      });
      $("#kmOvF").addEventListener("change", function (e) {
        var file = e.target.files[0]; if (!file) return; ovMsg("pl_reading");
        planSource(file).then(function (src) {
          var go = function (n) { return src.render(n).then(function (r) { setOvl(r, r.mpp); }); };
          if (src.pages > 1) { var pg = +(prompt(tt("pl_page") + " (1–" + src.pages + ")", "1") || 1); go(Math.min(Math.max(1, pg), src.pages)); } else go(1);
        }).catch(function () { ovMsg("pl_err", 1); });
      });
      var gb = $("#kmGcp");
      gb.addEventListener("change", function (e) { var t = e.target.closest("[data-gc]"); if (!t || !ovl || !ovl.gcp) return; var g = ovl.gcp[+t.dataset.gc], v = parseFloat(String(t.value).replace(/['\s]/g, "").replace(",", ".")); if (!g || !isFinite(v)) return; if (!g.t) g.t = ovPx(ovl, g.s[0], g.s[1]); if (+t.dataset.ax === 0 && v > 4e5 && v < 9e5) v += 2e6; if (+t.dataset.ax === 1 && v > 4e4 && v < 4e5) v += 1e6; g.t[+t.dataset.ax] = v; gcpFit(); ovDraw(); gcpPanel(); refresh(); });
      gb.addEventListener("click", function (e) { var x = e.target.closest("[data-gx]"), k = e.target.closest("[data-gk]"); if (!ovl) return;
        if (x) { ov0 = JSON.stringify(ovl); ovl.gcp.splice(+x.dataset.gx, 1); gcp = ovl.gcp; gcpFit(); ovDraw(); gcpPanel(); refresh(); return; }
        if (!k) return; if (k.dataset.gk === "add") { var mb = dlg.querySelector("[data-k=mgeo]"); if (mb && mode !== "geo") { gcpKeep = true; mb.click(); } }
        else if (k.dataset.gk === "end") { mode = ""; dlg.querySelectorAll("[data-k=mgeo]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); gcpPanel(); refresh(); }
        else if (k.dataset.gk === "clr") { var o0 = JSON.stringify(ovl); ovl.gcp = []; gcp = ovl.gcp; ovl.rms = null; gcpPanel(); refresh(); toast(dlg, tt("ov_gClrDone"), tt("km_undoBtn"), function () { ovl = JSON.parse(o0); gcp = ovl.gcp || []; ovDraw(); gcpPanel(); refresh(); }); } });
      $("#kmOvD").addEventListener("toggle", function () { gcpDraw(); });
      var pb = $("#kmOvPlan"); pb.disabled = !(opt.planImg && opt.planImg.img);
      pb.addEventListener("click", function () { var P = opt.planImg; setOvl({ img: P.img, w: P.w, h: P.h, grid: P.grid || null, words: P.words || [] }, P.cal && P.cal.scale ? P.cal.scale : 0); ovl.ref = "plan"; });
      $("#kmOvO").addEventListener("input", function (e) { if (ovl) { ovl.op = e.target.value / 100; ovDraw(); } });
      var num2 = function (v) { return parseFloat(String(v).replace(",", ".")); };
      $("#kmOvR").addEventListener("change", function (e) { var v = num2(e.target.value); if (ovl && isFinite(v)) { ov0 = JSON.stringify(ovl); ovl.rot = v; ovDraw(); } });
      $("#kmOvS").addEventListener("change", function (e) { var v = num2(e.target.value); if (ovl && v > 0) { ov0 = JSON.stringify(ovl); ovl.mpp = v; ovl.auto = 0; ovDraw(); } });
    }
    hzSeed(); wsLate(); dlg.showModal(); map.invalidateSize(); if (opt.view && opt.view.c) map.setView(opt.view.c, opt.view.z, { animate: false }); else fitAll(); ovDraw(); refresh(); if (opt.edited) lyEdited = true;
    if (!plan && opt.autoPlan && !ovl && opt.planImg && opt.planImg.img) { $("#kmOvPlan").click(); } (plan ? $("[data-k=mcal]") : $("#kmQ")).focus();
  }

  window.KARTE = { lineSlopeS: lineSlopeS, slopeLen: slopeLen, slopeOn: slopeOn, slopeHz: slopeHz, connOf: connOf, connTxt: connTxt, ovBase: ovBase, cfgOf: cfgOf, pipeList: pipeList, pipeTxt: pipeTxt, lineTxt: lineTxt, lineSync: lineSync, cfgMissing: cfgMissing, planGeo: planGeo, exportDlg: exportDlg, polyArea: polyArea, ovCorners: ovCorners, open: open, toast: toast, mapFigure: mapFigure, bgKey: bgKey, cacheBg: cacheBg, planSource: planSource, planPreview: planPreview, preview: preview, load: loadLeaflet, total: total, toLV95: toLV95, toWGS: toWGS, fmt: fmt };
})();
