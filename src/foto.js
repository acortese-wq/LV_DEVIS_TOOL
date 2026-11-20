/* NIUcost – Fotodokumentation (V145, Konzept Alessandro Cortese)
   Bilder werden beim Hinzufügen verkleinert (längste Seite 1600 px, JPEG, Ziel ca. 200–300 KB) und im Gerätespeicher
   (IndexedDB «niucost-fotos») abgelegt; die Angaben (Zeit, Standort, Bemerkung, Objekt) stehen im Projekt (S.fotos).
   Ohne IndexedDB (z. B. privates Fenster) bleiben die Bilder bis zum Schliessen im Arbeitsspeicher; die JSON-Sicherung enthält sie immer. */
var FOTO = (function () {
  var DBN = "niucost-fotos", ST = "img", mem = {}, dbP = null, MAX = 1600, ZIEL = 300 * 1024;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (res) {
      try {
        var r = indexedDB.open(DBN, 1);
        r.onupgradeneeded = function () { try { r.result.createObjectStore(ST); } catch (e) { } };
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; r.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbP;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (res) {
        try { var t = d.transaction(ST, mode), rq = fn(t.objectStore(ST)); t.oncomplete = function () { res(rq ? rq.result : null); }; t.onerror = t.onabort = function () { res(null); }; } catch (e) { res(null); }
      });
    });
  }
  function put(id, url) { mem[id] = url; return tx("readwrite", function (s) { return s.put(url, id); }); }
  function get(id) { if (mem[id]) return Promise.resolve(mem[id]); return tx("readonly", function (s) { return s.get(id); }).then(function (v) { if (v) mem[id] = v; return v || null; }); }
  function getAll(ids) { return Promise.all(ids.map(get)).then(function (a) { var o = {}; ids.forEach(function (id, i) { if (a[i]) o[id] = a[i]; }); return o; }); }
  function del(id) { delete mem[id]; return tx("readwrite", function (s) { return s.delete(id); }); }
  /* Bild aus Datei laden (Ausrichtung nach EXIF übernimmt der Browser), verkleinern und als JPEG-Daten-URL zurückgeben */
  function resize(file) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\//.test(file.type || "image/")) { rej(new Error("type")); return; }
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        try {
          var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, MAX / Math.max(w, h)), W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
          var c = document.createElement("canvas"); c.width = W; c.height = H; var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(im, 0, 0, W, H);
          var q = 0.8, url = c.toDataURL("image/jpeg", q); while (url.length * 0.75 > ZIEL && q > 0.5) { q -= 0.1; url = c.toDataURL("image/jpeg", q); }
          URL.revokeObjectURL(u); res({ url: url, w: W, h: H, kb: Math.round(url.length * 0.75 / 1024) });
        } catch (e) { URL.revokeObjectURL(u); rej(e); }
      };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("load")); };
      im.src = u;
    });
  }
  function nid() { return "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  return { put: put, get: get, getAll: getAll, del: del, resize: resize, nid: nid };
})();
