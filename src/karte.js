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
  function total(lines) { return (lines || []).reduce(function (a, l) { return a + lineLen(l); }, 0); }
  function fmt(v) { return (Math.round(v * 10) / 10).toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

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
  function bgUrl(box, base) {
    return WMS + "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=" + (BGL[base] || BGL.farbe) + "&STYLES=&SRS=EPSG:2056&BGCOLOR=0xFFFFFF&BBOX=" + box.bb.map(function (v) { return v.toFixed(1); }).join(",") + "&WIDTH=" + box.W + "&HEIGHT=" + box.H + "&FORMAT=image/jpeg";
  }
  function bgKey(g, W, H, base) { var b = geoBox(g, W, H); return b ? b.bb.map(function (v) { return v.toFixed(1); }).join(",") + "|" + (base || "farbe") + "|" + W + "x" + H : ""; }
  /* Hintergrundbild einmal laden und im Projekt ablegen, damit der Ausdruck auch ohne Internet vollständig ist */
  function cacheBg(g, base, W, H, cb) {
    var box = geoBox(g, W, H); if (!box || base === "leer") return;
    fetch(bgUrl(box, base), { mode: "cors" }).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (bl) {
      var fr = new FileReader(); fr.onload = function () { cb({ key: bgKey(g, W, H, base), src: fr.result }); }; fr.readAsDataURL(bl);
    }).catch(function () { });
  }
  /* Gemeinsame Zeichnung (SVG-Text): px = Abbildung Punkt -> Zeichnungseinheit, k = Grösse einer Bildschirm-Einheit (1 px bei 360 px Breite)
     g.lab = { lines:[txt], pts:[txt], areas:[txt], sond:[txt], wl:[txt], geb:[txt] } (optional); o.labels schaltet die Beschriftung ein */
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
      o2 += '<polyline points="' + pl(l) + '" fill="none" stroke="#fff" stroke-width="' + 6 * k + '" stroke-linejoin="round"/><polyline points="' + pl(l) + '" fill="none" stroke="#b8332a" stroke-width="' + 3 * k + '" stroke-linejoin="round"/>';
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
    sym(g.pts, function (q, r, i) { return '<rect x="' + f1(q[0] - r) + '" y="' + f1(q[1] - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" fill="#0d47c8" stroke="#fff" stroke-width="' + 1.5 * k + '"/><text x="' + f1(q[0]) + '" y="' + f1(q[1] + 4 * k) + '" text-anchor="middle" font-size="' + 11 * k + '" font-weight="700" fill="#fff">' + (i + 1) + "</text>"; }, "pts", "", 9);
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
    fig.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(tt("km_prevAlt")) + '"><rect width="' + W + '" height="' + H + '" fill="#eef1f3"/><rect width="' + W + '" height="' + H + '" fill="#fff"/>' + (o.base === "leer" ? "" : '<image href="' + esc(o.bg || bgUrl(box, o.base)) + '" width="' + W + '" height="' + H + '"/>') + overlaySvg(o.overlay, px) + geoSvg(g, px, k, { labels: o.labels }) + '</svg><figcaption>' + esc(o.cap || "") + " · © swisstopo</figcaption>";
    var im = fig.querySelector("image"); im.addEventListener("error", function () { im.remove(); });
    return fig;
  }
  /* kleine Vorschau je Datensatz */
  function preview(lines, tt, pts, areas, wl, geb) { return mapFigure({ lines: lines || [], pts: pts || [], areas: areas || [], wl: wl || [], geb: geb || [] }, tt, { W: 360, H: 220, base: "farbe", cap: tt("km_prevCap").replace("{m}", fmt(total(lines))) }); }

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
                var N = detectRatio(tc.items.map(function (i) { return i.str; }).join(""), file.name);
                if (N) { r.ratio = N; r.mpp = 0.0003528 * N / sc; }   /* 1 pt = 0.3528 mm */
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
    return { lines: (P.lines || []).map(function (l) { return l.pts; }), pts: (P.pts || []).map(function (p) { return p.pt; }), areas: (P.areas || []).map(function (a) { return a.pts; }), sond: (P.sond || []).map(function (p) { return p.pt; }), wl: (P.wl || []).map(function (p) { return p.pt; }), geb: (P.geb || []).map(function (p) { return p.pt; }), notes: P.notes || [] };
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
    var items = []; if ((c.geo.lines || []).length) items.push(["l", tt("ex_lLine")]); if ((c.geo.pts || []).length) items.push(["s", tt("ex_lSch")]); if ((c.geo.sond || []).length) items.push(["o", tt("ex_lSond")]); if ((c.geo.wl || []).length) items.push(["w", tt("ex_lWl")]); if ((c.geo.geb || []).length) items.push(["g", tt("ex_lGeb")]); if ((c.geo.areas || []).length) items.push(["a", tt("ex_lArea")]);
    var leg = ""; if (c.legend && items.length) { var lw = 46, lh = 7 + items.length * 5.4, lx = F.x + F.w - lw - 4, ly = F.y + 4;
      leg = '<rect x="' + lx + '" y="' + ly + '" width="' + lw + '" height="' + lh + '" fill="#fff" fill-opacity=".92" stroke="#1a1c1e" stroke-width=".25"/><text x="' + (lx + 2.5) + '" y="' + (ly + 4.2) + '" font-size="2.6" font-weight="700">' + esc(tt("ex_legend")) + "</text>";
      items.forEach(function (it, i) { var y = ly + 9 + i * 5.4, x = lx + 3.5, sy = "";
        if (it[0] === "l") sy = '<line x1="' + (x - 2.5) + '" y1="' + y + '" x2="' + (x + 2.5) + '" y2="' + y + '" stroke="#b8332a" stroke-width=".8"/>'; else if (it[0] === "s") sy = '<rect x="' + (x - 1.8) + '" y="' + (y - 1.8) + '" width="3.6" height="3.6" fill="#0d47c8"/>'; else if (it[0] === "o") sy = '<circle cx="' + x + '" cy="' + y + '" r="1.9" fill="#8a5b00"/>';
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
      '<span id="exBaseW">' + sel("exBase", tt("ex_base"), [["farbe", tt("km_bFarbe")], ["grau", tt("km_bGrau")], ["luft", tt("km_aerial")], ["kataster", tt("km_bKat")], ["none", tt("ex_noBase")]]) + "</span></div>" +
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
        c.bgUrl = WMS + "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=" + (BGL[S.base] || BGL.farbe) + "&STYLES=&SRS=EPSG:2056&BGCOLOR=0xFFFFFF&BBOX=" + bb.map(function (v) { return v.toFixed(1); }).join(",") + "&WIDTH=" + Wp + "&HEIGHT=" + Hp + "&FORMAT=image/jpeg"; c.bg = bgCache[c.bgUrl] || null;
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
  function open(opt) {
    var tt = opt.tt, cat = opt.cat, plan = opt.kind === "plan", M = JSON.parse(JSON.stringify(opt.model || { lines: [], pts: [], sond: [] })), cur = null, mode = "", sel = null, base = "farbe", map, layer, grp, calPts = [];
    var PROV = { swisstopo: [["farbe", "km_bFarbe"], ["grau", "km_bGrau"], ["luft", "km_aerial"]], geoadmin: [["kataster", "km_bKat"], ["leer", "km_bLeer"], ["viewer", "km_bViewer"]] };
    try { var sb = localStorage.getItem("lvd-km-base"); if (sb && ["farbe", "grau", "luft", "kataster", "leer"].indexOf(sb) >= 0) base = sb; } catch (e) { }
    var provOf = function (b) { return PROV.geoadmin.some(function (o) { return o[0] === b; }) ? "geoadmin" : "swisstopo"; };
    M.sond = M.sond || []; M.notes = M.notes || []; M.areas = M.areas || []; M.wl = M.wl || []; M.geb = M.geb || [];
    var cal = plan ? JSON.parse(JSON.stringify(opt.plan.cal || {})) : null;
    var AD = plan ? { ll: function (p) { return [-p[1], p[0]]; }, pt: function (ll) { return [Math.round(ll.lng * 10) / 10, Math.round(-ll.lat * 10) / 10]; },
      dist: function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) * (cal.scale || 0); } }
      : { ll: function (p) { return toWGS(p[0], p[1]); }, pt: function (ll) { return toLV95(ll.lat, ll.lng).map(function (v) { return Math.round(v * 100) / 100; }); },
        dist: function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); } };
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
      '<button type="button" class="btn small" data-k="mwl" aria-pressed="false">' + esc(tt("km_wl")) + "</button>" +
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
      (plan ? "" : '<span class="kmseg" role="group" aria-label="' + esc(tt("km_prov")) + '"><button type="button" class="btn small" data-prov="swisstopo" aria-pressed="false">swisstopo</button><button type="button" class="btn small" data-prov="geoadmin" aria-pressed="false">geo.admin.ch</button></span><label class="kmbl" for="kmBase">' + esc(tt("km_src")) + '</label><select id="kmBase"></select><button type="button" class="btn ghost small" data-k="geo">' + esc(tt("km_geo")) + '</button><a class="btn ghost small" id="kmNetz" href="https://www.swisscom.ch/rida/online/geoportal/ng/index.html?login" target="_blank" rel="noopener noreferrer">' + esc(tt("km_netz")) + "</a>") + "</div></div>" +
      (plan ? '<form class="kmcalf" id="kmCalF" hidden><label for="kmCalM">' + esc(tt("pl_calAsk")) + '</label><input type="text" inputmode="decimal" id="kmCalM" class="numin"><button type="submit" class="btn small">' + esc(tt("pl_calSet")) + "</button></form>" : "") +
      '<div class="kmmain"><div class="kmleft">' +
      '<div id="kmMap" class="kmmap" tabindex="0" role="application" aria-label="' + esc(tt("km_mapLbl")) + '"></div>' +
      (plan ? "" : '<iframe id="kmView" class="kmframe" hidden title="map.geo.admin.ch" referrerpolicy="no-referrer"></iframe>') +
      '<p class="hint kmhelp" id="kmHelp"></p>' +
      '<p class="hint kmunits" id="kmUnits"></p></div>' +
      '<div class="kmright"><h3 class="kmoh">' + esc(tt("km_obj")) + '</h3><div class="kmobj" id="kmObj" role="group" aria-label="' + esc(tt("km_obj")) + '"></div>' +
      (plan ? "" : '<details class="kmcat" id="kmCat"><summary>' + esc(tt("km_cat")) + '</summary><div class="kmcatb"><p class="hint kmtel">' + esc(tt("km_catTel")) + '</p><div class="kmchips" id="kmChips" role="group" aria-label="' + esc(tt("km_catChips")) + '" hidden></div><label for="kmCatQ">' + esc(tt("km_catSearch")) + '</label><input type="search" id="kmCatQ" autocomplete="off" placeholder="' + esc(tt("km_catPh")) + '"><p class="hint" id="kmCatMsg" role="status"></p><ul class="kmcatl" id="kmCatL" aria-label="' + esc(tt("km_catRes")) + '"></ul><h3 class="kmcath">' + esc(tt("km_catSel")) + '</h3><ul class="kmcatl kmcats" id="kmCatS"></ul></div></details>') +
      (plan ? "" : '<details class="kmcat kmovd" id="kmOvD"><summary>' + esc(tt("ov_title")) + '</summary><div class="kmcatb"><p class="hint">' + esc(tt("ov_hint")) + '</p>' +
        '<label for="kmOvF">' + esc(tt("pl_file")) + '</label><input type="file" id="kmOvF" accept=".pdf,application/pdf,image/*"><p class="hint" id="kmOvMsg" role="status"></p>' +
        '<div class="kmbar"><button type="button" class="btn small" id="kmOvPlan">' + esc(tt("ov_fromPlan")) + '</button><button type="button" class="btn small" data-k="mgeo" aria-pressed="false">' + esc(tt("ov_geo")) + '</button><button type="button" class="btn small" data-ov="tr" id="kmOvTr">' + esc(tt("ov_tr")) + '</button><button type="button" class="btn ghost small" data-ov="c">' + esc(tt("ov_center")) + '</button><button type="button" class="btn ghost small del" data-ov="x">' + esc(tt("km_catRemove")) + '</button></div>' +
        '<div class="kmbar kmovc"><label class="kmbl" for="kmOvO">' + esc(tt("km_opacity")) + '</label><input type="range" id="kmOvO" min="10" max="100" step="10" value="60"><label class="kmbl" for="kmOvR">' + esc(tt("ov_rot")) + '</label><input type="text" inputmode="decimal" id="kmOvR" class="kmn"><label class="kmbl" for="kmOvS">' + esc(tt("ov_mpp")) + '</label><input type="text" inputmode="decimal" id="kmOvS" class="kmn">' +
        '<span class="kmnudge" role="group" aria-label="' + esc(tt("ov_adj")) + '">' + [["l", "←", "km_nl"], ["u", "↑", "km_nu"], ["d", "↓", "km_nd"], ["r", "→", "km_nr"], ["rl", "⟲", "ov_rl"], ["rr", "⟳", "ov_rr"], ["sm", "−", "ov_sm"], ["sp", "+", "ov_sp"]].map(function (a) { return '<button type="button" class="btn ghost small" data-ov="' + a[0] + '" aria-label="' + esc(tt(a[2])) + '">' + a[1] + "</button>"; }).join("") + '</span></div></div></details>') +
      '</div></div>' +
      '<div class="kmslot" id="kmSlot"></div>' +
      '<div class="kmfoot"><p class="kmlen" id="kmLen" role="status" aria-live="polite"></p><button type="button" class="btn" data-k="apply">' + esc(tt("km_apply")) + "</button></div>";
    document.body.appendChild(dlg);
    var $ = function (s) { return dlg.querySelector(s); };
    dlg.querySelector(".kmintro").addEventListener("toggle", function (e) { if (!e.target.open) try { localStorage.setItem(INTRO, "1"); } catch (x) { } });
    var byId = function (arr, id) { return arr.filter(function (l) { return l.id === id; })[0]; };

    function tiles() {
      if (layer) map.removeLayer(layer);
      /* Ebene ohne bekannten Typ: zuerst WMS, bei Fehlern (z. B. nur als WMTS verfügbar) automatisch WMTS – und umgekehrt */
      var flex = function (id, op) {
        var grp2 = L.layerGroup(), tries = ["wms", "wmts"], ti = 0, ok = 0, bad = 0, cur;
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
        : base === "kataster" ? L.layerGroup([flex("ch.kantone.cadastralwebmap-farbe", 1)])   /* nur der Parzellenplan, ohne Landeskarte dahinter */
        : L.layerGroup([T("ch.swisstopo.pixelkarte-farbe", "jpeg")]);
      map.getContainer().style.background = base === "kataster" || base === "leer" ? "#fff" : "";
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
      var bg = base === "luft" ? "ch.swisstopo.swissimage" : base === "grau" ? "ch.swisstopo.pixelkarte-grau" : base === "kataster" || base === "leer" ? "void" : "ch.swisstopo.pixelkarte-farbe";
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
      refresh();
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
      m.on("dragstart", function () { snap(); }); m.on("drag", function (e) { o[key] = AD.pt(e.target.getLatLng()); });
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
      if (!cnt) { msg.textContent = tt("ov_trNone"); msg.className = "hint"; return; }
      var m0 = JSON.stringify(M), p0 = JSON.stringify(P), cl0 = planCleared, sc = opt.planScale || 0, dev = [];
      var cv = function (q) { return ovPx(ovl, q[0], q[1]).map(function (v) { return Math.round(v * 100) / 100; }); }, cp = function (o) { return JSON.parse(JSON.stringify(o)); };
      (P.lines || []).forEach(function (l, i) { var nl = { id: nid("l"), pts: l.pts.map(cv), rid: l.rid || null, rohr: cp(l.rohr) }; M.lines.push(nl);
        var a = sc ? total([l.pts]) * sc : 0, b = total([nl.pts]); dev.push((opt.recName(l.rid) || tt("km_lineN").replace("{n}", i + 1)) + ": " + (sc ? tt("ov_trPlan") + " " + fmt(a) + " m → " : "") + tt("ov_trMap") + " " + fmt(b) + " m" + (a ? " (" + (b >= a ? "+" : "") + fmt((b / a - 1) * 100) + " %)" : "")); });
      (P.areas || []).forEach(function (f) { M.areas.push({ id: nid("f"), pts: f.pts.map(cv), rid: f.rid || null, belag: cp(f.belag) }); });
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
      var tot = M.lines.reduce(function (a, l) { return a + lineLen(l.pts); }, 0);
      $("#kmLen").textContent = tt("km_total").replace("{m}", fmt(tot)).replace("{n}", M.lines.filter(function (l) { return l.pts.length > 1; }).length).replace("{s}", M.pts.length).replace("{o}", M.sond.length) + (M.wl.length || M.geb.length ? " · " + tt("km_wgTot").replace("{w}", M.wl.length).replace("{g}", M.geb.length) : "") + (M.areas.length ? " · " + tt("km_areaTot").replace("{a}", fmt(M.areas.reduce(function (a, f) { return a + area(f.pts); }, 0))) : "") + (plan ? " · " + calTxt() : "");
    }
    function hideTip() { if (tip && map.hasLayer(tip)) map.removeLayer(tip); }
    /* Live-Messung beim Zeichnen: Teilstrecke und Total (bzw. Fläche) am Mauszeiger */
    function liveTip(ll) {
      var t = "", pts = null, closed = false;
      if (mode === "line" && cur) pts = (byId(M.lines, cur) || {}).pts; else if (mode === "sline" && curN) pts = (byId(M.notes, curN) || {}).pts; else if (mode === "area" && curA) { pts = (byId(M.areas, curA) || {}).pts; closed = true; } else if (mode === "ruler" && rul.length) pts = rul;
      if (!pts || !pts.length) { hideTip(); return; }
      var c = AD.pt(ll), all = pts.concat([c]), seg = AD.dist(pts[pts.length - 1], c), noScale = plan && !cal.scale;
      if (closed) t = noScale ? tt("km_noScale") : tt("km_tipArea").replace("{a}", fmt(area(all))).replace("{p}", fmt(perim(all)));
      else t = noScale ? tt("km_noScale") : tt("km_tipLine").replace("{s}", fmt(seg)).replace("{t}", fmt(lineLen(all)));
      if (!tip) tip = L.tooltip({ permanent: true, direction: "right", offset: [14, 0], className: "kmtip", opacity: 0.95 });
      tip.setLatLng(ll).setContent(esc(t)); if (!map.hasLayer(tip)) tip.addTo(map);
    }
    var MODES = { ruler: "mruler", geo: "mgeo", line: "mline", pt: "mpt", sond: "msond", cal: "mcal", edit: "medit", area: "marea", wl: "mwl", geb: "mgeb", text: "mtext", arrow: "marrow", sline: "msline", rect: "mrect" };
    function draw() {
      grp.clearLayers(); layers = {}; var edit = mode === "edit";
      M.lines.forEach(function (l) {
        var ll = l.pts.map(AD.ll), on = sel && sel.id === l.id, col = on ? "#0d47c8" : "#b8332a";
        if (ll.length > 1) {
          var halo = L.polyline(ll, { color: "#fff", weight: 8, interactive: false }).addTo(grp), main = L.polyline(ll, { color: col, weight: on ? 5 : 3.5, interactive: edit, bubblingMouseEvents: false }).addTo(grp);
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
          var on = sel && sel.id === p.id, m = L.marker(AD.ll(p.pt), { interactive: edit, draggable: edit, keyboard: false, icon: L.divIcon({ className: cls + (on ? " on" : ""), html: "<span>" + lbl + (i + 1) + "</span>", iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(grp);
          if (edit) { dragPt(m, p, "pt"); bindObj(m, p.id, true); }
        });
      };
      pm(M.pts, "kmsch", ""); pm(M.sond, "kmsond", "S"); pm(M.wl, "kmwl", "W"); pm(M.geb, "kmgeb", "G");
      if (showLbl && opt.labels) {   /* Beschriftung: Linie mit Name, Länge und Rohranlage; Schächte, Sondagen, Werklöcher, Einführungen, Flächen mit Name */
        var lb = opt.labels(M, { len: lineLen, area: area }), put = function (ll, t, cls) { if (t) L.marker(ll, { interactive: false, keyboard: false, zIndexOffset: -500, icon: L.divIcon({ className: "kmlbl " + cls, html: "<span>" + esc(t) + "</span>", iconSize: [0, 0] }) }).addTo(grp); };
        M.lines.forEach(function (l, i) { if (l.pts.length < 2) return; var bj = 1, bd = -1; for (var j = 1; j < l.pts.length; j++) { var dd = AD.dist(l.pts[j - 1], l.pts[j]) || Math.hypot(l.pts[j][0] - l.pts[j - 1][0], l.pts[j][1] - l.pts[j - 1][1]); if (dd > bd) { bd = dd; bj = j; } }
          put(AD.ll([(l.pts[bj - 1][0] + l.pts[bj][0]) / 2, (l.pts[bj - 1][1] + l.pts[bj][1]) / 2]), lb.lines && lb.lines[i], "c"); });
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
      $("#kmHelp").textContent = mode === "ruler" ? tt("km_helpRuler") : mode === "geo" ? tt(!gcp.length ? "ov_g1" : !gcp[gcp.length - 1].t ? (gcp.length === 1 ? "ov_g2" : "ov_g4") : "ov_g3") : mode === "cal" ? tt("pl_helpCal") : mode === "edit" ? tt("km_helpEdit") : mode === "text" ? tt("km_helpText") : mode === "arrow" || mode === "rect" ? tt("km_helpTwo") : mode ? tt("km_helpOn") : plan && !cal.scale ? tt("pl_calNeed") : tt("km_helpOff");
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
    function rows() {
      var h = $("#kmObj"); h.innerHTML = "";
      var rowOf = function (o) { var r = document.createElement("div"); r.className = "kmrow" + (sel && sel.id === o.id ? " on" : ""); r.setAttribute("data-rid", o.id); return r; };
      M.lines.forEach(function (l, i) {
        var r = rowOf(l);
        var t = head(r, tt("km_lineN").replace("{n}", i + 1), l.rid); t.insertAdjacentHTML("beforeend", " · " + fmt(lineLen(l.pts)) + " m");
        r.appendChild(cell(tt("km_sys"), sel1(tt("km_sys"), cat.sys, l.rohr.sys, function (v) { l.rohr.sys = v; rows(); })));
        if (l.rohr.sys !== "block") {
          r.appendChild(cell(tt("km_dn"), sel1(tt("km_dn"), cat.dn, l.rohr.dn, function (v) { l.rohr.dn = v; })));
          r.appendChild(cell(tt("km_len"), sel1(tt("km_len"), cat.len, l.rohr.len, function (v) { l.rohr.len = v; })));
          r.appendChild(cell(tt("km_n"), inp(tt("km_n"), l.rohr.n, "kmn", function (v) { l.rohr.n = v; })));
        } else { var bn = document.createElement("p"); bn.className = "hint"; bn.textContent = tt("km_blockNote"); r.appendChild(bn); }
        btns(r, l.id); h.appendChild(r);
      });
      M.pts.forEach(function (p, i) {
        var r = rowOf(p); head(r, tt("km_schN").replace("{n}", i + 1), p.sid);
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; }, 1)));
        r.appendChild(cell(tt("km_typ"), sel1(tt("km_typ"), cat.schacht, p.typ, function (v) { p.typ = v; })));
        btns(r, p.id); h.appendChild(r);
      });
      M.sond.forEach(function (p, i) {
        var r = rowOf(p); head(r, tt("km_sondN").replace("{n}", i + 1));
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; }, 1)));
        [["l", "km_sL"], ["b", "km_sB"], ["t", "km_sT"]].forEach(function (f) { r.appendChild(cell(tt(f[1]), inp(tt(f[1]), p[f[0]], "kmn", function (v) { p[f[0]] = v; }))); });
        btns(r, p.id); h.appendChild(r);
      });
      M.wl.forEach(function (p, i) {
        var r = rowOf(p); head(r, tt("km_wlN").replace("{n}", i + 1), p.sid);
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; }, 1)));
        r.appendChild(cell(tt("km_wlT"), sel1(tt("km_wlT"), [["ts", tt("km_wlts")], ["bo", tt("km_wlbo")], ["sg", tt("km_wlsg")], ["zs", tt("km_wlzs")]], p.wt, function (v) { p.wt = v; })));
        btns(r, p.id); h.appendChild(r);
      });
      M.geb.forEach(function (p, i) {
        var r = rowOf(p); head(r, tt("km_gebN").replace("{n}", i + 1), p.sid);
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; }, 1)));
        r.appendChild(cell(tt("km_cm"), inp(tt("km_cm"), p.cm || "", "kmn", function (v) { p.cm = v; })));
        r.appendChild(cell(tt("km_abd"), sel1(tt("km_abd"), [["keine", tt("km_abdK")], ["kissen", tt("km_abdKi")], ["hauff", tt("km_abdH")]], p.abd, function (v) { p.abd = v; })));
        if (!String(p.cm || "").trim()) { var hn = document.createElement("p"); hn.className = "hint"; hn.textContent = tt("km_gebHint"); r.appendChild(hn); }
        btns(r, p.id); h.appendChild(r);
      });
      M.areas.forEach(function (f, i) {
        var r = rowOf(f), t = head(r, tt("km_areaN").replace("{n}", i + 1), f.rid); t.insertAdjacentHTML("beforeend", " · " + fmt(area(f.pts)) + " m² · " + tt("km_perim") + " " + fmt(perim(f.pts)) + " m");
        r.appendChild(cell(tt("km_bk"), sel1(tt("km_bk"), [["gehweg", tt("km_bkG")], ["strasse", tt("km_bkS")], ["kanton", tt("km_bkK")]], f.belag.bk, function (v) { f.belag.bk = v; if (["strasse", "kanton"].indexOf(v) < 0 && ["A", "A1", "B"].indexOf(f.belag.wi) < 0) f.belag.wi = "B"; rows(); })));
        r.appendChild(cell(tt("km_wi"), sel1(tt("km_wi"), (f.belag.bk === "gehweg" ? ["A", "A1", "B"] : ["A", "A1", "B", "C", "C1", "C2"]).map(function (v) { return [v, v]; }), f.belag.wi, function (v) { f.belag.wi = v; })));
        r.appendChild(cell(tt("km_dB"), inp(tt("km_dB"), f.belag.d, "kmn", function (v) { f.belag.d = v; })));
        btns(r, f.id); h.appendChild(r);
      });
      M.notes.forEach(function (n, i) {
        var r = rowOf(n); head(r, tt(NT[n.type]) + " " + (i + 1));
        if (n.type === "text") {
          r.appendChild(cell(tt("km_text"), inp(tt("km_text"), n.text || "", "kmw", function (v) { n.text = v; if (layers[n.id]) draw(); }, 1)));
          r.appendChild(cell(tt("km_size"), sel1(tt("km_size"), [["s", tt("km_sS")], ["m", tt("km_sM")], ["l", tt("km_sLg")]], n.size || "m", function (v) { n.size = v; draw(); })));
        }
        r.appendChild(cell(tt("km_col"), sel1(tt("km_col"), COL.map(function (c) { return [c[0], tt(c[1])]; }), n.color || "#0d47c8", function (v) { n.color = v; draw(); })));
        btns(r, n.id); h.appendChild(r);
      });
    }
    function refresh() { draw(); rows(); }
    function newNote(type, pts) { snap(); var n = { id: nid("n"), type: type, pts: pts, color: noteCol, text: type === "text" ? "Text" : "", size: "m" }; M.notes.push(n); sel = { id: n.id }; return n; }
    function addPt(ll) {
      if (!mode) return;
      if (mode === "edit") { if (Date.now() - lastMove < 250) return; sel = null; refresh(); return; }
      var c = AD.pt(ll);
      if (mode === "ruler") { rul.push(c); refresh(); return; }
      if (mode === "geo") {
        if (!ovl) return; var last = gcp[gcp.length - 1];
        if (!last || last.t) gcp.push({ s: ovInv(ovl, c[0], c[1]), t: null }); else last.t = c;
        if (gcp.length === 2 && gcp[1].t) { var sol = ovSolve(ovl, gcp[0].s, gcp[0].t, gcp[1].s, gcp[1].t); if (sol) { ovl.mpp = sol.mpp; ovl.rot = sol.rot; ovl.E = sol.E; ovl.N = sol.N; toast(dlg, tt("ov_done"), tt("km_undoBtn"), function () { ovl = JSON.parse(ov0); ovDraw(); }); } gcp = []; mode = ""; }
        else tmp = gcp.reduce(function (a, g2) { a.push(ovPx(ovl, g2.s[0], g2.s[1])); if (g2.t) a.push(g2.t); return a; }, []);
        ovDraw(); refresh(); return;
      }
      if (mode === "cal") {
        calPts.push(c); if (calPts.length === 2) { $("#kmCalF").hidden = false; $("#kmCalM").value = ""; $("#kmCalM").focus(); } draw(); return;
      }
      if (mode === "text") { var tn = newNote("text", [c]); refresh(); var ti = $('[data-rid="' + tn.id + '"] input[type=text]'); if (ti) { ti.focus(); ti.select(); } return; }
      if (mode === "arrow" || mode === "rect") { tmp.push(c); if (tmp.length === 2) { newNote(mode, tmp); tmp = []; } refresh(); return; }
      if (mode === "wl" || mode === "geb") {
        snap(); var q = mode === "wl" ? { id: nid("w"), pt: c, sid: null, wt: "sg", name: "" } : { id: nid("g"), pt: c, sid: null, cm: opt.defGeb.cm, abd: opt.defGeb.abd, name: "" };
        (mode === "wl" ? M.wl : M.geb).push(q); sel = { id: q.id }; refresh(); return;
      }
      if (mode === "area") {
        snap(); var fa = curA && byId(M.areas, curA);
        if (!fa) { fa = { id: nid("f"), pts: [], rid: null, belag: JSON.parse(JSON.stringify(opt.defBelag)) }; M.areas.push(fa); curA = fa.id; sel = { id: fa.id }; }
        fa.pts.push(c); refresh(); return;
      }
      if (mode === "sline") {
        var sn = curN && byId(M.notes, curN);
        if (!sn) { sn = newNote("sline", [c]); curN = sn.id; } else { snap(); sn.pts.push(c); }
        refresh(); return;
      }
      snap();
      if (mode === "pt") { var p = { id: nid("p"), pt: c, sid: null, typ: opt.defTyp, name: "" }; M.pts.push(p); sel = { id: p.id }; }
      else if (mode === "sond") { var o = { id: nid("s"), pt: c, name: "", l: "1.0", b: "1.0", t: "1.5" }; M.sond.push(o); sel = { id: o.id }; }
      else {
        var l = cur && byId(M.lines, cur);
        if (!l) { l = { id: nid("l"), pts: [], rid: null, rohr: JSON.parse(JSON.stringify(opt.defRohr)) }; M.lines.push(l); cur = l.id; sel = { id: l.id }; }
        l.pts.push(c);
      }
      refresh();
    }
    function endLine() {
      var l = cur && byId(M.lines, cur); if (l && l.pts.length < 2) M.lines.splice(M.lines.indexOf(l), 1);
      var n = curN && byId(M.notes, curN); if (n && n.pts.length < 2) M.notes.splice(M.notes.indexOf(n), 1);
      var fa = curA && byId(M.areas, curA); if (fa && fa.pts.length < 3) M.areas.splice(M.areas.indexOf(fa), 1);
      cur = null; curN = null; curA = null; tmp = []; hideTip(); refresh();
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
    map.on("mousemove", function (e) { liveTip(e.latlng); }); map.on("mouseout", hideTip);
    map.on("dblclick", function () { if (mode === "line" || mode === "sline" || mode === "area") endLine(); });
    map.on("zoomend", function () { if (mode === "edit" || M.notes.some(function (n) { return n.type === "arrow"; })) draw(); });
    var cs = $("#kmCol"); cs.addEventListener("change", function () { noteCol = cs.value; });

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
      var b = e.target.closest("[data-k],[data-z],[data-d],[data-n]"); if (!b) return;
      if (b.dataset.n) { var nn = b.dataset.n.split("|"); return nudge(nn[0], nn[1]); }
      if (b.dataset.z) return show(b.dataset.z); if (b.dataset.d) return del(b.dataset.d);
      var k = b.getAttribute("data-k");
      if (k === "close") close();
      else if (/^m(geo|ruler|line|pt|sond|cal|edit|text|arrow|sline|rect|area|wl|geb)$/.test(k)) { var m = k.slice(1); if (m === "geo") { ov0 = JSON.stringify(ovl); gcp = []; } if (m === "ruler") rul = []; hideTip(); if (mode === "line" || mode === "sline" || mode === "area") endLine(); tmp = []; calPts = []; if (plan) $("#kmCalF").hidden = true; mode = mode === m ? "" : m; refresh(); }
      else if (k === "center") addPt(map.getCenter());
      else if (k === "end") endLine();
      else if (k === "undo") undo();
      else if (k === "clear") { var sn0 = JSON.stringify(M); snap(); M.lines = []; M.pts = []; M.sond = []; M.notes = []; M.areas = []; M.wl = []; M.geb = []; rul = []; cur = null; curN = null; curA = null; sel = null; refresh(); toast(dlg, tt("km_cleared"), tt("km_undoBtn"), function () { M = JSON.parse(sn0); M.notes = M.notes || []; M.areas = M.areas || []; M.wl = M.wl || []; M.geb = M.geb || []; refresh(); }); }
      else if (k === "geo") openGeo();
      else if (k === "fit") fitAll();
      else if (k === "max") { var on = !dlg.classList.contains("kmmax"); dlg.classList.toggle("kmmax", on); b.setAttribute("aria-pressed", on ? "true" : "false"); try { localStorage.setItem("lvd-km-max", on ? "1" : "0"); } catch (x) { } setTimeout(function () { map.invalidateSize({ animate: false }); ovDraw(); }, 50); }
      else if (k === "lbl") { showLbl = !showLbl; b.setAttribute("aria-pressed", showLbl ? "true" : "false"); draw(); }
      else if (k === "apply") {
        endLine();
        if (plan && !cal.scale && (M.lines.length || M.areas.length)) { toast(dlg, tt("pl_calNeed")); return; }
        opt.onApply(M, cal, function (m) { return lineLen(m); }, { area: area, perim: perim, base: base, overlay: ovl, planCleared: planCleared }); close();
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
    var bs = $("#kmBase");
    function fillBase() {   /* Umschalter swisstopo / geo.admin.ch: zeigt nur die Optionen des gewählten Anbieters */
      if (!bs) return; var pv = provOf(base); bs.innerHTML = PROV[pv].map(function (o) { return '<option value="' + o[0] + '">' + esc(tt(o[1])) + "</option>"; }).join(""); bs.value = base;
      dlg.querySelectorAll("[data-prov]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.prov === pv ? "true" : "false"); });
    }
    if (bs) { fillBase(); bs.addEventListener("change", function () { try { if (bs.value !== "viewer") localStorage.setItem("lvd-km-base", bs.value); } catch (e) { } setBase(bs.value); }); }
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
      };
      $("#kmOvF").addEventListener("change", function (e) {
        var file = e.target.files[0]; if (!file) return; ovMsg("pl_reading");
        planSource(file).then(function (src) {
          var go = function (n) { return src.render(n).then(function (r) { setOvl(r, r.mpp); }); };
          if (src.pages > 1) { var pg = +(prompt(tt("pl_page") + " (1–" + src.pages + ")", "1") || 1); go(Math.min(Math.max(1, pg), src.pages)); } else go(1);
        }).catch(function () { ovMsg("pl_err", 1); });
      });
      var pb = $("#kmOvPlan"); pb.disabled = !(opt.planImg && opt.planImg.img);
      pb.addEventListener("click", function () { var P = opt.planImg; setOvl({ img: P.img, w: P.w, h: P.h }, P.cal && P.cal.scale ? P.cal.scale : 0); ovl.ref = "plan"; });
      $("#kmOvO").addEventListener("input", function (e) { if (ovl) { ovl.op = e.target.value / 100; ovDraw(); } });
      var num2 = function (v) { return parseFloat(String(v).replace(",", ".")); };
      $("#kmOvR").addEventListener("change", function (e) { var v = num2(e.target.value); if (ovl && isFinite(v)) { ov0 = JSON.stringify(ovl); ovl.rot = v; ovDraw(); } });
      $("#kmOvS").addEventListener("change", function (e) { var v = num2(e.target.value); if (ovl && v > 0) { ov0 = JSON.stringify(ovl); ovl.mpp = v; ovl.auto = 0; ovDraw(); } });
    }
    dlg.showModal(); map.invalidateSize(); fitAll(); ovDraw(); refresh();
    if (!plan && opt.autoPlan && !ovl && opt.planImg && opt.planImg.img) { $("#kmOvPlan").click(); } (plan ? $("[data-k=mcal]") : $("#kmQ")).focus();
  }

  window.KARTE = { planGeo: planGeo, exportDlg: exportDlg, polyArea: polyArea, ovCorners: ovCorners, open: open, toast: toast, mapFigure: mapFigure, bgKey: bgKey, cacheBg: cacheBg, planSource: planSource, planPreview: planPreview, preview: preview, load: loadLeaflet, total: total, toLV95: toLV95, toWGS: toWGS, fmt: fmt };
})();
