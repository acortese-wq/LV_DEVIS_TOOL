/* 3D-Ansicht (swisstopo): Gelände und Luftbild als 3D-Szene (CesiumJS), Leitungen, Schächte, Werklöcher, Sondagen, Flächen und Aushubgruben des Projekts als Überlagerung auf dem Gelände.
   Nur am Computer (kein Handy). Die Bibliothek wird erst beim Öffnen nachgeladen. Bild für den Projektbericht: «Ansicht übernehmen».
   Daten (WGS84, [Breite, Länge]): { lines:[[ll]], pts:[{p:ll, l:text}], wl:[{p,l}], sond:[{p,l}], areas:[[ll]], pits:[[ll]] } */
(function () {
  "use strict";
  var VER = "1.120.0", BASE = "https://cdn.jsdelivr.net/npm/cesium@" + VER + "/Build/Cesium/";
  var TERRAIN = ["https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/", "https://3d.geo.admin.ch/1.0.0/ch.swisstopo.terrain.3d/default/20200520/4326/"];   /* aktueller Dienst (layer.json), danach älterer Pfad */
  var BUILDINGS = "https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json";
  var IMAGERY = "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function desktop() { try { return window.matchMedia("(min-width: 861px)").matches && !window.matchMedia("(pointer: coarse)").matches; } catch (e) { return true; } }
  function webgl() { try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } }
  function load(ok, bad) {
    if (window.Cesium) { ok(); return; }
    var base = window.__LVD_CESIUM_BASE || BASE; window.CESIUM_BASE_URL = base;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = base + "Widgets/widgets.css"; document.head.appendChild(l);
    var s = document.createElement("script"); s.src = base + "Cesium.js"; s.onload = function () { window.Cesium ? ok() : bad(); }; s.onerror = bad; document.head.appendChild(s);
  }
  function bearing(a, b) { var dy = b[0] - a[0], dx = (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180); return Math.atan2(dx, dy); }
  function open(o) {
    var tt = o.tt, d0 = o.data || {}, all = [];
    ["lines", "areas", "pits"].forEach(function (k) { (d0[k] || []).forEach(function (a) { a.forEach(function (p) { all.push(p); }); }); });
    ["pts", "wl", "sond"].forEach(function (k) { (d0[k] || []).forEach(function (q) { all.push(q.p); }); });
    var old = document.getElementById("v3dDlg"); if (old) old.remove();
    var d = document.createElement("dialog"); d.id = "v3dDlg"; d.className = "v3dlg"; d.setAttribute("aria-labelledby", "v3T");
    d.innerHTML = '<div class="v3h"><h2 id="v3T">' + esc(tt("v3_title")) + '</h2><div class="v3ctl">' +
      '<label>' + esc(tt("v3_ex")) + ' <select id="v3Ex"><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option></select></label>' +
      '<label><input type="checkbox" id="v3Obj" checked> ' + esc(tt("v3_obj")) + '</label><label><input type="checkbox" id="v3Pit" checked> ' + esc(tt("v3_pit")) + '</label><label><input type="checkbox" id="v3Bld"> ' + esc(tt("v3_bld")) + '</label><label>' + esc(tt("v3_bOff")) + ' <input type="number" id="v3Off" value="0" step="5" min="-150" max="150" style="width:5em"> m</label>' +
      '<button type="button" class="btn small" id="v3Img">' + esc(tt("v3_img")) + '</button><button type="button" class="btn ghost small" id="v3X">' + esc(tt("v3_close")) + '</button></div></div>' +
      '<div class="v3m" id="v3Map"></div><p class="v3s" id="v3S" role="status"></p><p class="v3c" id="v3I"></p><p class="v3c">' + esc(tt("v3_cred")) + '</p>';
    document.body.appendChild(d);
    var st = function (m) { var e = d.querySelector("#v3S"); if (e) e.textContent = m || ""; }, viewer = null, gone = false;
    function close() { if (gone) return; gone = true; try { if (viewer) viewer.destroy(); } catch (e) { } viewer = null; d.remove(); if (o.onClose) o.onClose(); }
    d.addEventListener("close", close); d.querySelector("#v3X").addEventListener("click", function () { d.close(); });
    d.showModal();
    if (!all.length) { st(tt("v3_empty")); return { close: close }; }
    if (!webgl()) { st(tt("v3_nogl")); return { close: close }; }
    if (!window.Cesium && location.protocol === "file:") { st(tt("v3_file")); return { close: close }; }   /* als lokale Datei geöffnet laufen die Arbeitsprozesse der 3D-Bibliothek nicht */
    st(tt("v3_loading"));
    load(function () { if (gone) return; try { build(); } catch (e) { st(tt("v3_err") + " " + (e && e.message || "")); } }, function () { st(tt("v3_err")); });
    function build() {
      var C = window.Cesium; try { C.Ion.defaultAccessToken = ""; } catch (e) { }
      viewer = new C.Viewer(d.querySelector("#v3Map"), { baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, contextOptions: { webgl: { preserveDrawingBuffer: true } } });
      var v = viewer; v.scene.globe.depthTestAgainstTerrain = true; v.scene.globe.baseColor = C.Color.fromCssColorString("#5b6b5e");
      v.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({ url: IMAGERY, tilingScheme: new C.WebMercatorTilingScheme(), maximumLevel: 19, credit: "© swisstopo" }));
      var tp = null;
      var cand = window.__LVD_TERRAIN ? [window.__LVD_TERRAIN] : TERRAIN, tOk = false, noT = function () { if (gone) return; look(); st(tt("v3_noTerrain")); info(tt("v3_iNoT")); }, info = function (m) { var e = d.querySelector("#v3I"); if (e) e.textContent = m; };
      /* Vorprüfung je Adresse: Nur ein Dienst mit gültiger Beschreibung (layer.json) wird eingebunden; sonst bliebe der Globus leer bzw. flach */
      function tryT(k) {
        if (k >= cand.length) { noT(); return; }
        var ac = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ac) ac.abort(); }, 8000);
        fetch(cand[k] + "layer.json", ac ? { signal: ac.signal } : {}).then(function (r) { clearTimeout(tm); if (!r.ok) throw new Error("terrain"); return r.json(); }).then(function (j) { if (!j || !j.tiles) throw new Error("terrain"); return C.CesiumTerrainProvider.fromUrl(cand[k]); })
          .then(function (t) { if (gone) return; tp = t; tOk = true; v.terrainProvider = t; look(); info(tt("v3_iT") + " " + cand[k]); }).catch(function () { clearTimeout(tm); tryT(k + 1); });
      }
      tryT(0);
      var c3 = function (a) { var f = []; a.forEach(function (p) { f.push(p[1], p[0]); }); return C.Cartesian3.fromDegreesArray(f); };
      var dsO = new C.CustomDataSource("obj"), dsP = new C.CustomDataSource("pit"); v.dataSources.add(dsO); v.dataSources.add(dsP);
      (d0.areas || []).forEach(function (a) { if (a.length > 2) dsO.entities.add({ polygon: { hierarchy: c3(a), material: C.Color.fromCssColorString("#f28c00").withAlpha(0.35), outline: false } }); });
      (d0.lines || []).forEach(function (a) { if (a.length < 2) return; var pos = c3(a);
        dsO.entities.add({ polyline: { positions: pos, width: 9, material: C.Color.WHITE.withAlpha(0.9), clampToGround: true } });
        dsO.entities.add({ polyline: { positions: pos, width: 5, material: C.Color.fromCssColorString("#0b6b72"), clampToGround: true } }); });
      (d0.pits || []).forEach(function (a) { var q = a.slice(); q.push(a[0]); dsP.entities.add({ polyline: { positions: c3(q), width: 2.5, material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString("#d9e2e4"), dashLength: 10 }), clampToGround: true } }); });
      [["pts", "#f28c00"], ["wl", "#7b3fa0"], ["sond", "#8a5b00"]].forEach(function (k) { (d0[k[0]] || []).forEach(function (q) {
        dsO.entities.add({ position: C.Cartesian3.fromDegrees(q.p[1], q.p[0]), point: { pixelSize: 12, color: C.Color.fromCssColorString(k[1]), outlineColor: C.Color.WHITE, outlineWidth: 2, heightReference: C.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: q.l || "", font: "600 13px sans-serif", fillColor: C.Color.WHITE, outlineColor: C.Color.fromCssColorString("#0a4f55"), outlineWidth: 4, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -18), heightReference: C.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY } }); }); });
      function look() {
        var la = 0, lo = 0; all.forEach(function (p) { la += p[0]; lo += p[1]; }); la /= all.length; lo /= all.length;
        var mx = 0; all.forEach(function (p) { mx = Math.max(mx, Math.hypot((p[0] - la) * 111320, (p[1] - lo) * 111320 * Math.cos(la * Math.PI / 180))); });
        var hd = (d0.lines || []).filter(function (a) { return a.length > 1; })[0], head = hd ? bearing(hd[0], hd[hd.length - 1]) : 0;
        var cg = [C.Cartographic.fromDegrees(lo, la)];
        var go = function (h) { if (gone) return; v.camera.lookAt(C.Cartesian3.fromDegrees(lo, la, h || 0), new C.HeadingPitchRange(head, C.Math.toRadians(-32), Math.max(120, mx * 3.2))); v.camera.lookAtTransform(C.Matrix4.IDENTITY); st(""); };
        if (tp && C.sampleTerrainMostDetailed) C.sampleTerrainMostDetailed(tp, cg).then(function (r) { go(r[0].height); }, function () { go(0); }); else go(0);
      }
      d.querySelector("#v3Ex").addEventListener("change", function (e) { try { v.scene.verticalExaggeration = parseFloat(e.target.value) || 1; } catch (x) { } });
      d.querySelector("#v3Obj").addEventListener("change", function (e) { dsO.show = e.target.checked; });
      d.querySelector("#v3Pit").addEventListener("change", function (e) { dsP.show = e.target.checked; });
      var bld = null, offB = function () { if (!bld) return; var off = parseFloat(d.querySelector("#v3Off").value) || 0, c = bld.boundingSphere && bld.boundingSphere.center; if (!c) return; var n = C.Cartesian3.normalize(c, new C.Cartesian3()); bld.modelMatrix = C.Matrix4.fromTranslation(C.Cartesian3.multiplyByScalar(n, off, new C.Cartesian3())); };
      d.querySelector("#v3Off").addEventListener("change", offB);
      d.querySelector("#v3Bld").addEventListener("change", function (e) {
        if (!e.target.checked) { if (bld) bld.show = false; return; }
        if (!tOk) { st(tt("v3_bldNoT")); e.target.checked = false; return; }   /* ohne Gelände würden die Gebäude in der Luft schweben */
        if (bld) { bld.show = true; return; }
        st(tt("v3_loading")); C.Cesium3DTileset.fromUrl(window.__LVD_BUILDINGS || BUILDINGS).then(function (t) { if (gone) return; bld = t; v.scene.primitives.add(t); offB(); st(""); }).catch(function () { st(tt("v3_noBld")); e.target.checked = false; });
      });
      d.querySelector("#v3Img").addEventListener("click", function () {
        try { v.render(); var cv = v.scene.canvas, W = Math.min(1400, cv.width), H = Math.round(W * cv.height / cv.width), c2 = document.createElement("canvas"); c2.width = W; c2.height = H; c2.getContext("2d").drawImage(cv, 0, 0, W, H);
          var url = c2.toDataURL("image/jpeg", 0.85); if (o.onImage) o.onImage(url, { ex: parseFloat(d.querySelector("#v3Ex").value) || 1, w: W, h: H }); st(tt("v3_imgDone")); } catch (e) { st(tt("v3_err") + " " + (e && e.message || "")); }
      });
      o.viewer = v; window.__V3D_VIEWER = v;   /* Testzugriff */
    }
    return { close: close };
  }
  window.V3D = { open: open, desktop: desktop, webgl: webgl, VER: VER };
})();
