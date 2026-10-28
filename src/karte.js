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
  function preview(lines, tt) {
    var all = []; (lines || []).forEach(function (l) { l.forEach(function (p) { all.push(p); }); });
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
    var fig = document.createElement("figure"); fig.className = "kmprev";
    fig.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(tt("km_prevAlt")) + '"><rect width="' + W + '" height="' + H + '" fill="#eef1f3"/><image href="' + esc(url) + '" width="' + W + '" height="' + H + '"/>' + g +
      '</svg><figcaption>' + esc(tt("km_prevCap").replace("{m}", fmt(total(lines)))) + " · © swisstopo</figcaption>";
    var im = fig.querySelector("image"); im.addEventListener("error", function () { im.remove(); });
    return fig;
  }

  /* Dialog */
  function open(opt) {   /* opt: { tt, lines, onApply(lines,total), onClose } */
    var tt = opt.tt, lines = JSON.parse(JSON.stringify(opt.lines || [])), cur = -1, drawing = false, base = "farbe", map, layer, grp, hits = [];
    var dlg = document.createElement("dialog"); dlg.className = "kmdlg"; dlg.setAttribute("aria-labelledby", "kmTitle");
    dlg.innerHTML =
      '<div class="kmhead"><h2 id="kmTitle">' + esc(tt("km_title")) + '</h2><button type="button" class="btn ghost small" data-k="close">' + esc(tt("km_close")) + "</button></div>" +
      '<form class="kmsearch" role="search"><label for="kmQ">' + esc(tt("km_search")) + '</label><input type="search" id="kmQ" autocomplete="off" placeholder="' + esc(tt("km_searchPh")) + '"><button type="submit" class="btn small">' + esc(tt("km_go")) + "</button></form>" +
      '<ul class="kmhits" id="kmHits" aria-label="' + esc(tt("km_hits")) + '"></ul>' +
      '<div class="kmbar" role="group" aria-label="' + esc(tt("km_tools")) + '">' +
      '<button type="button" class="btn small" data-k="draw" aria-pressed="false">' + esc(tt("km_draw")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="center">' + esc(tt("km_center")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="end">' + esc(tt("km_end")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="undo">' + esc(tt("km_undo")) + "</button>" +
      '<button type="button" class="btn ghost small del" data-k="clear">' + esc(tt("km_clear")) + "</button>" +
      '<span class="sp"></span><button type="button" class="btn ghost small" data-k="base" aria-pressed="false">' + esc(tt("km_aerial")) + "</button></div>" +
      '<div id="kmMap" class="kmmap" tabindex="0" role="application" aria-label="' + esc(tt("km_mapLbl")) + '"></div>' +
      '<p class="hint kmhelp" id="kmHelp"></p>' +
      '<div class="kmfoot"><p class="kmlen" id="kmLen" role="status" aria-live="polite"></p><button type="button" class="btn" data-k="apply">' + esc(tt("km_apply")) + "</button></div>";
    document.body.appendChild(dlg);
    var $ = function (s) { return dlg.querySelector(s); };

    function tiles() {
      if (layer) map.removeLayer(layer);
      var id = base === "luft" ? "ch.swisstopo.swissimage" : "ch.swisstopo.pixelkarte-farbe";
      layer = L.tileLayer(WMTS + id + "/default/current/3857/{z}/{x}/{y}." + (base === "luft" ? "jpeg" : "jpeg"), { maxZoom: 20, maxNativeZoom: base === "luft" ? 19 : 18, attribution: "© swisstopo" }).addTo(map);
      layer.bringToBack();
    }
    function draw() {
      grp.clearLayers();
      lines.forEach(function (l, i) {
        var ll = l.map(function (p) { return toWGS(p[0], p[1]); });
        if (ll.length > 1) { L.polyline(ll, { color: "#fff", weight: 7, interactive: false }).addTo(grp); L.polyline(ll, { color: "#b8332a", weight: 3.5, interactive: false }).addTo(grp); }
        ll.forEach(function (q, j) { L.circleMarker(q, { radius: i === cur && j === ll.length - 1 ? 6 : 4, color: "#b8332a", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
      });
      var n = lines.filter(function (l) { return l.length > 1; }).length;
      $("#kmLen").textContent = tt("km_total").replace("{m}", fmt(total(lines))).replace("{n}", n);
      $('[data-k=draw]').setAttribute("aria-pressed", drawing ? "true" : "false");
      $('[data-k=draw]').textContent = drawing ? tt("km_drawOn") : tt("km_draw");
      $('[data-k=end]').disabled = cur < 0; $('[data-k=undo]').disabled = !lines.length; $('[data-k=clear]').disabled = !lines.length;
      $('[data-k=center]').disabled = !drawing;
      $("#kmHelp").textContent = drawing ? tt("km_helpOn") : tt("km_helpOff");
      map.getContainer().style.cursor = drawing ? "crosshair" : "";
    }
    function addPt(ll) {
      if (!drawing) return;
      if (cur < 0) { lines.push([]); cur = lines.length - 1; }
      lines[cur].push(toLV95(ll.lat, ll.lng).map(function (v) { return Math.round(v * 100) / 100; })); draw();
    }
    function endLine() { if (cur >= 0 && lines[cur].length < 2) lines.splice(cur, 1); cur = -1; draw(); }
    function undo() {
      if (cur < 0 && lines.length) cur = lines.length - 1;
      if (cur >= 0) { lines[cur].pop(); if (!lines[cur].length) { lines.splice(cur, 1); cur = -1; } }
      draw();
    }
    function close() { try { map.remove(); } catch (e) { } dlg.close(); dlg.remove(); if (opt.onClose) opt.onClose(); }

    L.Icon.Default.imagePath = "";
    map = L.map($("#kmMap"), { center: [46.8, 8.23], zoom: 8, minZoom: 7, maxZoom: 20, doubleClickZoom: false });
    grp = L.layerGroup().addTo(map); tiles();
    var all = []; lines.forEach(function (l) { l.forEach(function (p) { all.push(toWGS(p[0], p[1])); }); });
    if (all.length) map.fitBounds(L.latLngBounds(all).pad(0.3), { maxZoom: 19 });
    map.on("click", function (e) { addPt(e.latlng); });
    map.on("dblclick", function () { if (drawing) endLine(); });

    dlg.addEventListener("click", function (e) {
      var b = e.target.closest("[data-k]"); if (!b) return; var k = b.getAttribute("data-k");
      if (k === "close") close();
      else if (k === "draw") { drawing = !drawing; if (!drawing) endLine(); else draw(); }
      else if (k === "center") addPt(map.getCenter());
      else if (k === "end") endLine();
      else if (k === "undo") undo();
      else if (k === "clear") { if (confirm(tt("km_clearQ"))) { lines = []; cur = -1; draw(); } }
      else if (k === "base") { base = base === "luft" ? "farbe" : "luft"; b.setAttribute("aria-pressed", base === "luft" ? "true" : "false"); b.textContent = base === "luft" ? tt("km_map") : tt("km_aerial"); tiles(); }
      else if (k === "apply") { endLine(); opt.onApply(lines, total(lines)); close(); }
    });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); close(); });
    $(".kmsearch").addEventListener("submit", function (e) {
      e.preventDefault(); var q = $("#kmQ").value.trim(), ul = $("#kmHits"); if (!q) return;
      ul.innerHTML = '<li class="kmnote">' + esc(tt("km_searching")) + "</li>";
      fetch(SEARCH + "?type=locations&limit=8&sr=2056&lang=" + (opt.lang || "de") + "&searchText=" + encodeURIComponent(q))
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) {
          hits = (j.results || []).filter(function (r) { return r.attrs && isFinite(r.attrs.lat) && isFinite(r.attrs.lon); });
          ul.innerHTML = hits.length ? "" : '<li class="kmnote">' + esc(tt("km_none")) + "</li>";
          hits.forEach(function (r) {
            var li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.className = "kmhit";
            b.textContent = String(r.attrs.label || "").replace(/<[^>]*>/g, "");
            b.addEventListener("click", function () { map.setView([r.attrs.lat, r.attrs.lon], 18); ul.innerHTML = ""; $("#kmMap").focus(); });
            li.appendChild(b); ul.appendChild(li);
          });
        }).catch(function () { ul.innerHTML = '<li class="kmnote err">' + esc(tt("km_searchErr")) + "</li>"; });
    });
    dlg.showModal(); map.invalidateSize(); draw(); $("#kmQ").focus();
  }

  window.KARTE = { open: open, preview: preview, load: loadLeaflet, total: total, toLV95: toLV95, toWGS: toWGS, fmt: fmt };
})();
