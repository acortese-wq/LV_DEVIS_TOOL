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

  /* Kleine Vorschau (SVG, Hintergrund = swisstopo-Landeskarte per WMS; ohne Internet nur die Trasse) */
  function preview(lines, tt, pts) {
    pts = pts || []; var all = pts.slice(); (lines || []).forEach(function (l) { l.forEach(function (p) { all.push(p); }); });
    if (!all.length) return null;
    var W = 360, H = 220, e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity;
    all.forEach(function (p) { e0 = Math.min(e0, p[0]); e1 = Math.max(e1, p[0]); n0 = Math.min(n0, p[1]); n1 = Math.max(n1, p[1]); });
    var cx = (e0 + e1) / 2, cy = (n0 + n1) / 2, w = Math.max((e1 - e0) * 1.3, 60), h = Math.max((n1 - n0) * 1.3, 60 * H / W);
    var sc = Math.max(w / W, h / H); w = sc * W; h = sc * H;
    var bb = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
    var px = function (p) { return [((p[0] - bb[0]) / sc).toFixed(1), ((bb[3] - p[1]) / sc).toFixed(1)]; };
    var url = WMS + "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=ch.swisstopo.pixelkarte-farbe&STYLES=&SRS=EPSG:2056&BBOX=" + bb.map(function (v) { return v.toFixed(1); }).join(",") +
      "&WIDTH=" + W + "&HEIGHT=" + H + "&FORMAT=image/jpeg";
    var g = lines.map(function (l) { return l.length > 1 ? '<polyline points="' + l.map(function (p) { return px(p).join(","); }).join(" ") + '" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/><polyline points="' + l.map(function (p) { return px(p).join(","); }).join(" ") + '" fill="none" stroke="#b8332a" stroke-width="3" stroke-linejoin="round"/>' : ""; }).join("");
    g += pts.map(function (p, i) { var q = px(p); return '<rect x="' + (q[0] - 9) + '" y="' + (q[1] - 9) + '" width="18" height="18" fill="#0d47c8" stroke="#fff" stroke-width="2"/><text x="' + q[0] + '" y="' + (+q[1] + 4) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">' + (i + 1) + "</text>"; }).join("");
    var fig = document.createElement("figure"); fig.className = "kmprev";
    fig.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(tt("km_prevAlt")) + '"><rect width="' + W + '" height="' + H + '" fill="#eef1f3"/><image href="' + esc(url) + '" width="' + W + '" height="' + H + '"/>' + g +
      '</svg><figcaption>' + esc(tt("km_prevCap").replace("{m}", fmt(total(lines)))) + " · © swisstopo</figcaption>";
    var im = fig.querySelector("image"); im.addEventListener("error", function () { im.remove(); });
    return fig;
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

  /* Vorschau Plan (SVG über dem Plan-JPEG) */
  function planPreview(P, tt) {
    if (!P || !P.img) return null;
    var k = Math.max(P.w, P.h) / 360, sw = 3 * k, fig = document.createElement("figure"); fig.className = "kmprev";
    var g = (P.lines || []).map(function (l) { var pts = l.pts.map(function (p) { return p.join(","); }).join(" "); return l.pts.length > 1 ? '<polyline points="' + pts + '" fill="none" stroke="#fff" stroke-width="' + sw * 2 + '"/><polyline points="' + pts + '" fill="none" stroke="#b8332a" stroke-width="' + sw + '"/>' : ""; }).join("");
    g += (P.pts || []).map(function (p, i) { return '<rect x="' + (p.pt[0] - 6 * k) + '" y="' + (p.pt[1] - 6 * k) + '" width="' + 12 * k + '" height="' + 12 * k + '" fill="#0d47c8" stroke="#fff" stroke-width="' + k + '"/><text x="' + p.pt[0] + '" y="' + (p.pt[1] + 4 * k) + '" text-anchor="middle" font-size="' + 10 * k + '" font-weight="700" fill="#fff">' + (i + 1) + "</text>"; }).join("");
    g += (P.sond || []).map(function (p) { return '<circle cx="' + p.pt[0] + '" cy="' + p.pt[1] + '" r="' + 6 * k + '" fill="#f28c00" stroke="#fff" stroke-width="' + k + '"/>'; }).join("");
    fig.innerHTML = '<svg viewBox="0 0 ' + P.w + " " + P.h + '" role="img" aria-label="' + esc(tt("pl_prevAlt")) + '"><image href="' + P.img + '" width="' + P.w + '" height="' + P.h + '"/>' + g + "</svg>";
    return fig;
  }

  /* Dialog: Linien (Rohranlage je Linie), Schächte, Sondagen – auf swisstopo-Karte (LV95) oder kalibriertem Plan (Pixel)
     opt: { kind:"map"|"plan", tt, lang, model:{lines,pts,sond}, cat, defRohr, defTyp, recName(rid), plan:{img,w,h,cal}, onApply(model,cal), onClose } */
  var seq = 0, nid = function (p) { return p + Date.now().toString(36) + (seq++).toString(36); };
  var INTRO = "lvd-km-intro";
  function open(opt) {
    var tt = opt.tt, cat = opt.cat, plan = opt.kind === "plan", M = JSON.parse(JSON.stringify(opt.model || { lines: [], pts: [], sond: [] })), cur = null, mode = "", hist = [], sel = null, base = "farbe", map, layer, grp, calPts = [];
    M.sond = M.sond || [];
    var cal = plan ? JSON.parse(JSON.stringify(opt.plan.cal || {})) : null;
    var AD = plan ? { ll: function (p) { return [-p[1], p[0]]; }, pt: function (ll) { return [Math.round(ll.lng * 10) / 10, Math.round(-ll.lat * 10) / 10]; },
      dist: function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) * (cal.scale || 0); } }
      : { ll: function (p) { return toWGS(p[0], p[1]); }, pt: function (ll) { return toLV95(ll.lat, ll.lng).map(function (v) { return Math.round(v * 100) / 100; }); },
        dist: function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    var lineLen = function (pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += AD.dist(pts[i - 1], pts[i]); return s; };
    var intro = false; try { intro = !localStorage.getItem(INTRO); } catch (e) { }
    var dlg = document.createElement("dialog"); dlg.className = "kmdlg"; dlg.setAttribute("aria-labelledby", "kmTitle");
    var ip = plan ? ["km_i1p", "km_i2p", "km_i3p"] : ["km_i1", "km_i2", "km_i3"];
    dlg.innerHTML =
      '<div class="kmhead"><h2 id="kmTitle">' + esc(tt(plan ? "pl_title" : "km_title")) + '</h2><button type="button" class="btn ghost small" data-k="close">' + esc(tt("km_close")) + "</button></div>" +
      '<details class="kmintro"' + (intro ? " open" : "") + "><summary>" + esc(tt("km_intro")) + "</summary><ol>" + ip.map(function (k) { return "<li>" + esc(tt(k)) + "</li>"; }).join("") + "</ol></details>" +
      (plan ? "" : '<form class="kmsearch" role="search"><label for="kmQ">' + esc(tt("km_search")) + '</label><input type="search" id="kmQ" autocomplete="off" placeholder="' + esc(tt("km_searchPh")) + '"><button type="submit" class="btn small">' + esc(tt("km_go")) + "</button></form>" +
        '<ul class="kmhits" id="kmHits" aria-label="' + esc(tt("km_hits")) + '"></ul>') +
      '<div class="kmbar" role="group" aria-label="' + esc(tt("km_tools")) + '">' +
      (plan ? '<button type="button" class="btn small" data-k="mcal" aria-pressed="false">' + esc(tt("pl_cal")) + "</button>" : "") +
      '<button type="button" class="btn small" data-k="mline" aria-pressed="false">' + esc(tt("km_draw")) + "</button>" +
      '<button type="button" class="btn small" data-k="mpt" aria-pressed="false">' + esc(tt("km_pt")) + "</button>" +
      '<button type="button" class="btn small" data-k="msond" aria-pressed="false">' + esc(tt("km_sond")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="fit">' + esc(tt("km_fit")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="center">' + esc(tt("km_center")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="end">' + esc(tt("km_end")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="undo">' + esc(tt("km_undo")) + "</button>" +
      '<button type="button" class="btn ghost small del" data-k="clear">' + esc(tt("km_clear")) + "</button>" +
      (plan ? "" : '<span class="sp"></span><label class="kmbl" for="kmBase">' + esc(tt("km_src")) + '</label><select id="kmBase">' + [["farbe", "km_bFarbe"], ["grau", "km_bGrau"], ["luft", "km_aerial"], ["kataster", "km_bKat"], ["viewer", "km_bViewer"]].map(function (o) { return '<option value="' + o[0] + '">' + esc(tt(o[1])) + "</option>"; }).join("") + '</select><button type="button" class="btn ghost small" data-k="geo">' + esc(tt("km_geo")) + "</button>") + "</div>" +
      (plan ? '<form class="kmcalf" id="kmCalF" hidden><label for="kmCalM">' + esc(tt("pl_calAsk")) + '</label><input type="text" inputmode="decimal" id="kmCalM" class="numin"><button type="submit" class="btn small">' + esc(tt("pl_calSet")) + "</button></form>" : "") +
      '<div id="kmMap" class="kmmap" tabindex="0" role="application" aria-label="' + esc(tt("km_mapLbl")) + '"></div>' +
      (plan ? "" : '<iframe id="kmView" class="kmframe" hidden title="map.geo.admin.ch" referrerpolicy="no-referrer"></iframe>') +
      '<p class="hint kmhelp" id="kmHelp"></p>' +
      '<div class="kmobj" id="kmObj" aria-label="' + esc(tt("km_obj")) + '"></div>' +
      '<div class="kmslot" id="kmSlot"></div>' +
      '<div class="kmfoot"><p class="kmlen" id="kmLen" role="status" aria-live="polite"></p><button type="button" class="btn" data-k="apply">' + esc(tt("km_apply")) + "</button></div>";
    document.body.appendChild(dlg);
    var $ = function (s) { return dlg.querySelector(s); };
    dlg.querySelector(".kmintro").addEventListener("toggle", function (e) { if (!e.target.open) try { localStorage.setItem(INTRO, "1"); } catch (x) { } });
    var byId = function (arr, id) { return arr.filter(function (l) { return l.id === id; })[0]; };

    function tiles() {
      if (layer) map.removeLayer(layer);
      var T = function (id, ext, o) { return L.tileLayer(WMTS + id + "/default/current/3857/{z}/{x}/{y}." + ext, Object.assign({ maxZoom: 20, maxNativeZoom: 18, attribution: "© swisstopo / geo.admin.ch" }, o || {})); };
      layer = base === "luft" ? L.layerGroup([T("ch.swisstopo.swissimage", "jpeg", { maxNativeZoom: 19 })])
        : base === "grau" ? L.layerGroup([T("ch.swisstopo.pixelkarte-grau", "jpeg")])
        : base === "kataster" ? L.layerGroup([T("ch.swisstopo.pixelkarte-grau", "jpeg"), T("ch.kantone.cadastralwebmap-farbe", "png", { opacity: 0.75 })])
        : L.layerGroup([T("ch.swisstopo.pixelkarte-farbe", "jpeg")]);
      layer.addTo(map); layer.eachLayer(function (l) { l.bringToBack(); });
    }
    /* Ausschnitt im Kartenviewer map.geo.admin.ch öffnen (gleicher Hintergrund, aktuelles Zentrum) */
    function geoUrl(embed) {
      var c = map.getCenter(), e = toLV95(c.lat, c.lng), res = 156543.03 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, map.getZoom()),
        R = [4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250, 1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5], z = 0, d = 1e9;
      R.forEach(function (r, i) { var x = Math.abs(Math.log(r / res)); if (x < d) { d = x; z = i; } });
      var bg = base === "luft" ? "ch.swisstopo.swissimage" : base === "grau" || base === "kataster" ? "ch.swisstopo.pixelkarte-grau" : "ch.swisstopo.pixelkarte-farbe";
      return "https://map.geo.admin.ch/#/" + (embed ? "embed" : "map") + "?lang=" + (opt.lang || "de") + "&center=" + Math.round(e[0]) + "," + Math.round(e[1]) + "&z=" + z + "&bgLayer=" + bg + (base === "kataster" ? "&layers=ch.kantone.cadastralwebmap-farbe" : "");
    }
    function openGeo() { window.open(geoUrl(false), "_blank", "noopener"); }
    /* immer auf den Bestand (alle Linien, Schächte, Sondagen) zoomen */
    function fitAll() {
      var pts = []; M.lines.forEach(function (l) { l.pts.forEach(function (p) { pts.push(AD.ll(p)); }); }); M.pts.concat(M.sond).forEach(function (p) { pts.push(AD.ll(p.pt)); });
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: plan ? 3 : 19, animate: false });
      else if (plan) map.fitBounds([[-opt.plan.h, 0], [0, opt.plan.w]], { animate: false });
    }
    function setBase(v) {
      var was = base === "viewer"; base = v; var vw = $("#kmView"), mp = $("#kmMap");
      if (v === "viewer") { if (layer) { map.removeLayer(layer); layer = null; } mode = ""; vw.src = geoUrl(true).replace("&bgLayer=", "&bgLayer="); vw.hidden = false; mp.hidden = true; }
      else { if (vw) { vw.hidden = true; vw.removeAttribute("src"); } mp.hidden = false; map.invalidateSize(); tiles(); if (was) fitAll(); }
      refresh();
    }
    function calTxt() { return cal.scale && cal.auto ? tt("pl_calAuto").replace("{r}", cal.auto).replace("{s}", (Math.round(cal.scale * 1000) / 1000)) : cal.scale ? tt("pl_calOk").replace("{m}", fmt(cal.m)).replace("{s}", (Math.round(cal.scale * 1000) / 1000)) : tt("pl_calNo"); }
    function draw() {
      grp.clearLayers();
      M.lines.forEach(function (l) {
        var ll = l.pts.map(AD.ll), on = sel && sel.id === l.id;
        if (ll.length > 1) { L.polyline(ll, { color: "#fff", weight: 8, interactive: false }).addTo(grp); L.polyline(ll, { color: on ? "#0d47c8" : "#b8332a", weight: on ? 5 : 3.5, interactive: false }).addTo(grp); }
        ll.forEach(function (q, j) { L.circleMarker(q, { radius: l.id === cur && j === ll.length - 1 ? 6 : 4, color: on ? "#0d47c8" : "#b8332a", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
      });
      M.pts.forEach(function (p, i) {
        var on = sel && sel.id === p.id;
        L.marker(AD.ll(p.pt), { interactive: false, keyboard: false, icon: L.divIcon({ className: "kmsch" + (on ? " on" : ""), html: "<span>" + (i + 1) + "</span>", iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(grp);
      });
      M.sond.forEach(function (p, i) {
        var on = sel && sel.id === p.id;
        L.marker(AD.ll(p.pt), { interactive: false, keyboard: false, icon: L.divIcon({ className: "kmsond" + (on ? " on" : ""), html: "<span>S" + (i + 1) + "</span>", iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(grp);
      });
      if (plan) { calPts.forEach(function (q) { L.circleMarker(AD.ll(q), { radius: 6, color: "#0d47c8", weight: 3, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
        if (cal.a && cal.b && !cal.auto && !calPts.length) L.polyline([AD.ll(cal.a), AD.ll(cal.b)], { color: "#0d47c8", weight: 2, dashArray: "6 5", interactive: false }).addTo(grp); }
      var tot = M.lines.reduce(function (a, l) { return a + lineLen(l.pts); }, 0);
      $("#kmLen").textContent = tt("km_total").replace("{m}", fmt(tot)).replace("{n}", M.lines.filter(function (l) { return l.pts.length > 1; }).length).replace("{s}", M.pts.length).replace("{o}", M.sond.length) + (plan ? " · " + calTxt() : "");
      ["cal", "line", "pt", "sond"].forEach(function (m) { var b = $("[data-k=m" + m + "]"); if (b) b.setAttribute("aria-pressed", mode === m ? "true" : "false"); });
      $("[data-k=mline]").textContent = mode === "line" ? tt("km_drawOn") : tt("km_draw"); $("[data-k=mpt]").textContent = mode === "pt" ? tt("km_ptOn") : tt("km_pt"); $("[data-k=msond]").textContent = mode === "sond" ? tt("km_sondOn") : tt("km_sond");
      if (plan) $("[data-k=mcal]").textContent = mode === "cal" ? tt("pl_calOn") : tt("pl_cal");
      $("[data-k=end]").disabled = !cur; $("[data-k=undo]").disabled = !hist.length; $("[data-k=clear]").disabled = !(M.lines.length || M.pts.length || M.sond.length); $("[data-k=center]").disabled = !mode;
      $("#kmHelp").textContent = mode === "cal" ? tt("pl_helpCal") : mode ? tt("km_helpOn") : plan && !cal.scale ? tt("pl_calNeed") : tt("km_helpOff");
      map.getContainer().style.cursor = mode ? "crosshair" : "";
      var vw = base === "viewer"; dlg.querySelectorAll(".kmbar [data-k^=m],[data-k=center],[data-k=end],[data-k=fit]").forEach(function (b) { if (vw) b.disabled = true; else if (b.dataset.k !== "end" && b.dataset.k !== "center") b.disabled = false; });
      if (vw) $("#kmHelp").textContent = tt("km_viewerHelp");
    }
    function sel1(label, arr, val, on) {
      var s = document.createElement("select"); s.setAttribute("aria-label", label);
      arr.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (o[0] === val) op.selected = true; s.appendChild(op); });
      s.addEventListener("change", function () { on(s.value); }); return s;
    }
    function cell(label, el) { var d = document.createElement("div"); d.className = "kmc"; var l = document.createElement("span"); l.textContent = label; d.appendChild(l); d.appendChild(el); return d; }
    function inp(label, val, cls, on) { var n = document.createElement("input"); n.type = "text"; n.inputMode = "decimal"; n.className = cls; n.value = val; n.setAttribute("aria-label", label); n.addEventListener("input", function () { on(n.value); }); return n; }
    function head(r, title, rid) { var t = document.createElement("div"); t.className = "kmt"; t.innerHTML = "<b>" + esc(title) + "</b>" + (rid === undefined ? "" : " · " + (rid ? '<span class="kmlnk">→ ' + esc(opt.recName(rid) || tt("km_new")) + "</span>" : '<span class="kmlnk">' + esc(tt("km_new")) + "</span>")); r.appendChild(t); return t; }
    function btns(r, id) { var bs = document.createElement("div"); bs.className = "kmbtn"; bs.innerHTML = '<button type="button" class="btn ghost small" data-z="' + id + '">' + esc(tt("km_show")) + '</button><button type="button" class="btn ghost small del" data-d="' + id + '">' + esc(tt("km_del")) + "</button>"; r.appendChild(bs); }
    function rows() {
      var h = $("#kmObj"); h.innerHTML = "";
      M.lines.forEach(function (l, i) {
        var r = document.createElement("div"); r.className = "kmrow" + (sel && sel.id === l.id ? " on" : "");
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
        var r = document.createElement("div"); r.className = "kmrow" + (sel && sel.id === p.id ? " on" : ""); head(r, tt("km_schN").replace("{n}", i + 1), p.sid);
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; })));
        r.appendChild(cell(tt("km_typ"), sel1(tt("km_typ"), cat.schacht, p.typ, function (v) { p.typ = v; })));
        btns(r, p.id); h.appendChild(r);
      });
      M.sond.forEach(function (p, i) {
        var r = document.createElement("div"); r.className = "kmrow" + (sel && sel.id === p.id ? " on" : ""); head(r, tt("km_sondN").replace("{n}", i + 1));
        r.appendChild(cell(tt("km_name"), inp(tt("km_name"), p.name || "", "kmw", function (v) { p.name = v; })));
        [["l", "km_sL"], ["b", "km_sB"], ["t", "km_sT"]].forEach(function (f) { r.appendChild(cell(tt(f[1]), inp(tt(f[1]), p[f[0]], "kmn", function (v) { p[f[0]] = v; }))); });
        btns(r, p.id); h.appendChild(r);
      });
    }
    function refresh() { draw(); rows(); }
    function addPt(ll) {
      if (!mode) return;
      var c = AD.pt(ll);
      if (mode === "cal") {
        calPts.push(c); if (calPts.length === 2) { $("#kmCalF").hidden = false; $("#kmCalM").value = ""; $("#kmCalM").focus(); } draw(); return;
      }
      if (mode === "pt") { var p = { id: nid("p"), pt: c, sid: null, typ: opt.defTyp, name: "" }; M.pts.push(p); hist.push(p.id); sel = { id: p.id }; }
      else if (mode === "sond") { var o = { id: nid("s"), pt: c, name: "", l: "1.0", b: "1.0", t: "1.5" }; M.sond.push(o); hist.push(o.id); sel = { id: o.id }; }
      else {
        var l = cur && byId(M.lines, cur);
        if (!l) { l = { id: nid("l"), pts: [], rid: null, rohr: JSON.parse(JSON.stringify(opt.defRohr)) }; M.lines.push(l); cur = l.id; sel = { id: l.id }; }
        l.pts.push(c); hist.push(l.id);
      }
      refresh();
    }
    function endLine() { var l = cur && byId(M.lines, cur); if (l && l.pts.length < 2) M.lines.splice(M.lines.indexOf(l), 1); cur = null; refresh(); }
    function undo() {
      if (mode === "cal" && calPts.length) { calPts.pop(); $("#kmCalF").hidden = true; return draw(); }
      var id = hist.pop(); if (!id) return;
      var p = byId(M.pts, id) || byId(M.sond, id); if (p) (M.pts.indexOf(p) >= 0 ? M.pts : M.sond).splice((M.pts.indexOf(p) >= 0 ? M.pts : M.sond).indexOf(p), 1);
      else { var l = byId(M.lines, id); if (l) { l.pts.pop(); if (!l.pts.length) { M.lines.splice(M.lines.indexOf(l), 1); if (cur === id) cur = null; } } }
      refresh();
    }
    function del(id) {
      [M.lines, M.pts, M.sond].forEach(function (a) { var x = byId(a, id); if (x) a.splice(a.indexOf(x), 1); });
      if (cur === id) cur = null; hist = hist.filter(function (x) { return x !== id; }); sel = null; refresh();
    }
    function show(id) {
      var l = byId(M.lines, id), p = byId(M.pts, id) || byId(M.sond, id); sel = { id: id };
      if (l && l.pts.length) map.fitBounds(L.latLngBounds(l.pts.map(AD.ll)).pad(0.3), { maxZoom: plan ? 3 : 19 });
      if (p) map.setView(AD.ll(p.pt), Math.max(map.getZoom(), plan ? 1 : 18));
      refresh();
    }
    function close() { try { map.remove(); } catch (e) { } dlg.close(); dlg.remove(); if (opt.onClose) opt.onClose(); }

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
      map = L.map($("#kmMap"), { center: [46.8, 8.23], zoom: 8, minZoom: 7, maxZoom: 20, doubleClickZoom: false });
      grp = L.layerGroup().addTo(map); tiles();
    }
    map.on("click", function (e) { addPt(e.latlng); });
    map.on("dblclick", function () { if (mode === "line") endLine(); });

    dlg.addEventListener("click", function (e) {
      var b = e.target.closest("[data-k],[data-z],[data-d]"); if (!b) return;
      if (b.dataset.z) return show(b.dataset.z); if (b.dataset.d) return del(b.dataset.d);
      var k = b.getAttribute("data-k");
      if (k === "close") close();
      else if (k === "mline" || k === "mpt" || k === "msond" || k === "mcal") { var m = k.slice(1); if (mode === "line") endLine(); calPts = []; if (plan) $("#kmCalF").hidden = true; mode = mode === m ? "" : m; refresh(); }
      else if (k === "center") addPt(map.getCenter());
      else if (k === "end") endLine();
      else if (k === "undo") undo();
      else if (k === "clear") { var snap = JSON.stringify(M); M.lines = []; M.pts = []; M.sond = []; cur = null; hist = []; sel = null; refresh(); toast(dlg, tt("km_cleared"), tt("km_undoBtn"), function () { M = JSON.parse(snap); refresh(); }); }
      else if (k === "geo") openGeo();
      else if (k === "fit") fitAll();
      else if (k === "apply") {
        endLine();
        if (plan && !cal.scale && M.lines.length) { toast(dlg, tt("pl_calNeed")); return; }
        opt.onApply(M, cal, function (m) { return lineLen(m); }); close();
      }
    });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); close(); });
    var bs = $("#kmBase"); if (bs) bs.addEventListener("change", function () { setBase(bs.value); });
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
    dlg.showModal(); map.invalidateSize(); fitAll(); refresh(); (plan ? $("[data-k=mcal]") : $("#kmQ")).focus();
  }

  window.KARTE = { open: open, toast: toast, planSource: planSource, planPreview: planPreview, preview: preview, load: loadLeaflet, total: total, toLV95: toLV95, toWGS: toWGS, fmt: fmt };
})();
