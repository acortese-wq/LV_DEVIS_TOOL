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

  /* Dialog: Linien (Rohranlage je Linie) und Schächte (Punkte) auf der swisstopo-Karte
     opt: { tt, lang, model:{lines:[{id,pts,rid,rohr:{sys,dn,len,n}}],pts:[{id,pt,sid,typ,name}]}, cat, defRohr, defTyp, recName(rid), onApply(model), onClose } */
  var seq = 0, nid = function (p) { return p + Date.now().toString(36) + (seq++).toString(36); };
  function open(opt) {
    var tt = opt.tt, cat = opt.cat, M = JSON.parse(JSON.stringify(opt.model || { lines: [], pts: [] })), cur = null, mode = "", hist = [], sel = null, base = "farbe", map, layer, grp;
    var dlg = document.createElement("dialog"); dlg.className = "kmdlg"; dlg.setAttribute("aria-labelledby", "kmTitle");
    dlg.innerHTML =
      '<div class="kmhead"><h2 id="kmTitle">' + esc(tt("km_title")) + '</h2><button type="button" class="btn ghost small" data-k="close">' + esc(tt("km_close")) + "</button></div>" +
      '<form class="kmsearch" role="search"><label for="kmQ">' + esc(tt("km_search")) + '</label><input type="search" id="kmQ" autocomplete="off" placeholder="' + esc(tt("km_searchPh")) + '"><button type="submit" class="btn small">' + esc(tt("km_go")) + "</button></form>" +
      '<ul class="kmhits" id="kmHits" aria-label="' + esc(tt("km_hits")) + '"></ul>' +
      '<div class="kmbar" role="group" aria-label="' + esc(tt("km_tools")) + '">' +
      '<button type="button" class="btn small" data-k="mline" aria-pressed="false">' + esc(tt("km_draw")) + "</button>" +
      '<button type="button" class="btn small" data-k="mpt" aria-pressed="false">' + esc(tt("km_pt")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="center">' + esc(tt("km_center")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="end">' + esc(tt("km_end")) + "</button>" +
      '<button type="button" class="btn ghost small" data-k="undo">' + esc(tt("km_undo")) + "</button>" +
      '<button type="button" class="btn ghost small del" data-k="clear">' + esc(tt("km_clear")) + "</button>" +
      '<span class="sp"></span><button type="button" class="btn ghost small" data-k="base" aria-pressed="false">' + esc(tt("km_aerial")) + "</button></div>" +
      '<div id="kmMap" class="kmmap" tabindex="0" role="application" aria-label="' + esc(tt("km_mapLbl")) + '"></div>' +
      '<p class="hint kmhelp" id="kmHelp"></p>' +
      '<div class="kmobj" id="kmObj" aria-label="' + esc(tt("km_obj")) + '"></div>' +
      '<div class="kmfoot"><p class="kmlen" id="kmLen" role="status" aria-live="polite"></p><button type="button" class="btn" data-k="apply">' + esc(tt("km_apply")) + "</button></div>";
    document.body.appendChild(dlg);
    var $ = function (s) { return dlg.querySelector(s); };
    var lineBy = function (id) { return M.lines.filter(function (l) { return l.id === id; })[0]; };
    var ptBy = function (id) { return M.pts.filter(function (p) { return p.id === id; })[0]; };
    var lab = function (a, v) { var o = a.filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : v; };

    function tiles() {
      if (layer) map.removeLayer(layer);
      var id = base === "luft" ? "ch.swisstopo.swissimage" : "ch.swisstopo.pixelkarte-farbe";
      layer = L.tileLayer(WMTS + id + "/default/current/3857/{z}/{x}/{y}.jpeg", { maxZoom: 20, maxNativeZoom: base === "luft" ? 19 : 18, attribution: "© swisstopo" }).addTo(map);
      layer.bringToBack();
    }
    function draw() {
      grp.clearLayers();
      M.lines.forEach(function (l) {
        var ll = l.pts.map(function (p) { return toWGS(p[0], p[1]); }), on = sel && sel.id === l.id;
        if (ll.length > 1) { L.polyline(ll, { color: "#fff", weight: 8, interactive: false }).addTo(grp); L.polyline(ll, { color: on ? "#0d47c8" : "#b8332a", weight: on ? 5 : 3.5, interactive: false }).addTo(grp); }
        ll.forEach(function (q, j) { L.circleMarker(q, { radius: l.id === cur && j === ll.length - 1 ? 6 : 4, color: on ? "#0d47c8" : "#b8332a", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(grp); });
      });
      M.pts.forEach(function (p, i) {
        var on = sel && sel.id === p.id;
        L.marker(toWGS(p.pt[0], p.pt[1]), { interactive: false, keyboard: false, icon: L.divIcon({ className: "kmsch" + (on ? " on" : ""), html: "<span>" + (i + 1) + "</span>", iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(grp);
      });
      var tot = M.lines.reduce(function (a, l) { return a + lineLen(l.pts); }, 0);
      $("#kmLen").textContent = tt("km_total").replace("{m}", fmt(tot)).replace("{n}", M.lines.filter(function (l) { return l.pts.length > 1; }).length).replace("{s}", M.pts.length);
      ["line", "pt"].forEach(function (m) { var b = $("[data-k=m" + m + "]"); b.setAttribute("aria-pressed", mode === m ? "true" : "false"); });
      $("[data-k=mline]").textContent = mode === "line" ? tt("km_drawOn") : tt("km_draw"); $("[data-k=mpt]").textContent = mode === "pt" ? tt("km_ptOn") : tt("km_pt");
      $("[data-k=end]").disabled = !cur; $("[data-k=undo]").disabled = !hist.length; $("[data-k=clear]").disabled = !(M.lines.length || M.pts.length); $("[data-k=center]").disabled = !mode;
      $("#kmHelp").textContent = mode ? tt("km_helpOn") : tt("km_helpOff");
      map.getContainer().style.cursor = mode ? "crosshair" : "";
    }
    function sel1(label, arr, val, on) {
      var s = document.createElement("select"); s.setAttribute("aria-label", label);
      arr.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (o[0] === val) op.selected = true; s.appendChild(op); });
      s.addEventListener("change", function () { on(s.value); }); return s;
    }
    function cell(label, el) { var d = document.createElement("div"); d.className = "kmc"; var l = document.createElement("span"); l.textContent = label; d.appendChild(l); d.appendChild(el); return d; }
    function rows() {
      var h = $("#kmObj"); h.innerHTML = "";
      M.lines.forEach(function (l, i) {
        var r = document.createElement("div"); r.className = "kmrow" + (sel && sel.id === l.id ? " on" : "");
        var t = document.createElement("div"); t.className = "kmt"; var nm = tt("km_lineN").replace("{n}", i + 1);
        t.innerHTML = "<b>" + esc(nm) + "</b> · " + fmt(lineLen(l.pts)) + " m" + (l.rid ? ' · <span class="kmlnk">→ ' + esc(opt.recName(l.rid) || tt("km_new")) + "</span>" : ' · <span class="kmlnk">' + esc(tt("km_new")) + "</span>");
        r.appendChild(t);
        r.appendChild(cell(tt("km_sys"), sel1(tt("km_sys"), cat.sys, l.rohr.sys, function (v) { l.rohr.sys = v; rows(); })));
        if (l.rohr.sys !== "block") {
          r.appendChild(cell(tt("km_dn"), sel1(tt("km_dn"), cat.dn, l.rohr.dn, function (v) { l.rohr.dn = v; })));
          r.appendChild(cell(tt("km_len"), sel1(tt("km_len"), cat.len, l.rohr.len, function (v) { l.rohr.len = v; })));
          var n = document.createElement("input"); n.type = "text"; n.inputMode = "numeric"; n.className = "kmn"; n.value = l.rohr.n; n.setAttribute("aria-label", tt("km_n")); n.addEventListener("input", function () { l.rohr.n = n.value; });
          r.appendChild(cell(tt("km_n"), n));
        } else { var bn = document.createElement("p"); bn.className = "hint"; bn.textContent = tt("km_blockNote"); r.appendChild(bn); }
        var bs = document.createElement("div"); bs.className = "kmbtn";
        bs.innerHTML = '<button type="button" class="btn ghost small" data-z="l' + l.id + '">' + esc(tt("km_show")) + '</button><button type="button" class="btn ghost small del" data-d="' + l.id + '">' + esc(tt("km_del")) + "</button>";
        r.appendChild(bs); h.appendChild(r);
      });
      M.pts.forEach(function (p, i) {
        var r = document.createElement("div"); r.className = "kmrow" + (sel && sel.id === p.id ? " on" : "");
        var t = document.createElement("div"); t.className = "kmt"; t.innerHTML = "<b>" + esc(tt("km_schN").replace("{n}", i + 1)) + "</b> · " + (p.sid ? '<span class="kmlnk">→ ' + esc(opt.recName(p.sid) || tt("km_new")) + "</span>" : '<span class="kmlnk">' + esc(tt("km_new")) + "</span>");
        r.appendChild(t);
        var nm = document.createElement("input"); nm.type = "text"; nm.value = p.name || ""; nm.setAttribute("aria-label", tt("km_name")); nm.addEventListener("input", function () { p.name = nm.value; });
        r.appendChild(cell(tt("km_name"), nm));
        r.appendChild(cell(tt("km_typ"), sel1(tt("km_typ"), cat.schacht, p.typ, function (v) { p.typ = v; })));
        var bs = document.createElement("div"); bs.className = "kmbtn";
        bs.innerHTML = '<button type="button" class="btn ghost small" data-z="p' + p.id + '">' + esc(tt("km_show")) + '</button><button type="button" class="btn ghost small del" data-d="' + p.id + '">' + esc(tt("km_del")) + "</button>";
        r.appendChild(bs); h.appendChild(r);
      });
    }
    function refresh() { draw(); rows(); }
    function addPt(ll) {
      if (!mode) return;
      var c = toLV95(ll.lat, ll.lng).map(function (v) { return Math.round(v * 100) / 100; });
      if (mode === "pt") { var p = { id: nid("p"), pt: c, sid: null, typ: opt.defTyp, name: "" }; M.pts.push(p); hist.push(p.id); sel = { id: p.id }; }
      else {
        var l = cur && lineBy(cur);
        if (!l) { l = { id: nid("l"), pts: [], rid: null, rohr: JSON.parse(JSON.stringify(opt.defRohr)) }; M.lines.push(l); cur = l.id; sel = { id: l.id }; }
        l.pts.push(c); hist.push(l.id);
      }
      refresh();
    }
    function endLine() { var l = cur && lineBy(cur); if (l && l.pts.length < 2) M.lines.splice(M.lines.indexOf(l), 1); cur = null; refresh(); }
    function undo() {
      var id = hist.pop(); if (!id) return;
      var p = ptBy(id); if (p) M.pts.splice(M.pts.indexOf(p), 1);
      else { var l = lineBy(id); if (l) { l.pts.pop(); if (!l.pts.length) { M.lines.splice(M.lines.indexOf(l), 1); if (cur === id) cur = null; } } }
      refresh();
    }
    function del(id) { var l = lineBy(id); if (l) M.lines.splice(M.lines.indexOf(l), 1); var p = ptBy(id); if (p) M.pts.splice(M.pts.indexOf(p), 1); if (cur === id) cur = null; hist = hist.filter(function (x) { return x !== id; }); sel = null; refresh(); }
    function show(id) {
      var l = lineBy(id), p = ptBy(id); sel = { id: id };
      if (l && l.pts.length) map.fitBounds(L.latLngBounds(l.pts.map(function (q) { return toWGS(q[0], q[1]); })).pad(0.3), { maxZoom: 19 });
      if (p) map.setView(toWGS(p.pt[0], p.pt[1]), Math.max(map.getZoom(), 18));
      refresh();
    }
    function close() { try { map.remove(); } catch (e) { } dlg.close(); dlg.remove(); if (opt.onClose) opt.onClose(); }

    map = L.map($("#kmMap"), { center: [46.8, 8.23], zoom: 8, minZoom: 7, maxZoom: 20, doubleClickZoom: false });
    grp = L.layerGroup().addTo(map); tiles();
    var all = []; M.lines.forEach(function (l) { l.pts.forEach(function (p) { all.push(toWGS(p[0], p[1])); }); }); M.pts.forEach(function (p) { all.push(toWGS(p.pt[0], p.pt[1])); });
    if (all.length) map.fitBounds(L.latLngBounds(all).pad(0.3), { maxZoom: 19 });
    map.on("click", function (e) { addPt(e.latlng); });
    map.on("dblclick", function () { if (mode === "line") endLine(); });

    dlg.addEventListener("click", function (e) {
      var b = e.target.closest("[data-k],[data-z],[data-d]"); if (!b) return;
      if (b.dataset.z) return show(b.dataset.z.slice(1)); if (b.dataset.d) return del(b.dataset.d);
      var k = b.getAttribute("data-k");
      if (k === "close") close();
      else if (k === "mline" || k === "mpt") { var m = k === "mline" ? "line" : "pt"; if (mode === "line") endLine(); mode = mode === m ? "" : m; refresh(); }
      else if (k === "center") addPt(map.getCenter());
      else if (k === "end") endLine();
      else if (k === "undo") undo();
      else if (k === "clear") { if (confirm(tt("km_clearQ"))) { M.lines = []; M.pts = []; cur = null; hist = []; sel = null; refresh(); } }
      else if (k === "base") { base = base === "luft" ? "farbe" : "luft"; b.setAttribute("aria-pressed", base === "luft" ? "true" : "false"); b.textContent = base === "luft" ? tt("km_map") : tt("km_aerial"); tiles(); }
      else if (k === "apply") { endLine(); opt.onApply(M); close(); }
    });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); close(); });
    $(".kmsearch").addEventListener("submit", function (e) {
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
    dlg.showModal(); map.invalidateSize(); refresh(); $("#kmQ").focus();
  }

  window.KARTE = { open: open, preview: preview, load: loadLeaflet, total: total, toLV95: toLV95, toWGS: toWGS, fmt: fmt };
})();
