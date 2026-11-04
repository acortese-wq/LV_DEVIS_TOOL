/* Anleitung im Tool: Hilfe-Fenster mit Kapiteln, Suche, Druck, Beispielprojekt; kontextbezogen (?), F1. App-Konzept: Alessandro Cortese */
(function () {
  "use strict";
  var D = null, dlg = null, cur = "start", LI = { de: 0, fr: 1, it: 2, en: 3 };
  var $ = function (q, r) { return (r || document).querySelector(q); };
  var tt = function (k) { return D.tt(k); };
  function E(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var esc = function (v) { return String(v).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var li = function () { return LI[D.S().lang] != null ? LI[D.S().lang] : 0; };
  var title = function (c) { return c.t[li()]; }, body = function (c) { return c.b[li()]; };
  var plain = function (h) { return h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); };
  function mark(html, q) {
    if (!q) return html; var re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return html.split(/(<[^>]+>)/).map(function (p) { return p.charAt(0) === "<" ? p : p.replace(re, "<mark>$1</mark>"); }).join("");
  }
  function nav() {
    var ul = $("#hpNav ul"); ul.innerHTML = "";
    window.LVHELP.forEach(function (c, i) { var l = E("li"), b = E("button", "hpnb" + (c.id === cur ? " cur" : ""), (i + 1) + ". " + title(c)); b.type = "button"; b.setAttribute("data-ch", c.id); if (c.id === cur) b.setAttribute("aria-current", "true"); l.appendChild(b); ul.appendChild(l); });
  }
  function show(id, anchor, q) {
    var c = window.LVHELP.filter(function (x) { return x.id === id; })[0] || window.LVHELP[0]; cur = c.id; var bd = $("#hpBody"), i = window.LVHELP.indexOf(c);
    bd.innerHTML = "<h2 id=\"hpH\">" + esc((i + 1) + ". " + title(c)) + "</h2>" + mark(body(c), q); nav();
    $("#hpPrev").disabled = i === 0; $("#hpNext").disabled = i === window.LVHELP.length - 1;
    var t = anchor && bd.querySelector("#" + anchor); if (t) { t.setAttribute("tabindex", "-1"); t.scrollIntoView({ block: "start" }); t.focus({ preventScroll: true }); } else { bd.scrollTop = 0; }
  }
  function search(q) {
    q = String(q || "").trim(); var bd = $("#hpBody"); if (q.length < 2) { show(cur); return; }
    var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), hits = [];
    window.LVHELP.forEach(function (c) { var tx = plain(body(c)), m = re.exec(tx); if (m || re.test(title(c))) { var s = m ? Math.max(0, m.index - 50) : 0; hits.push([c, (s ? "… " : "") + tx.slice(s, s + 150) + " …"]); } });
    bd.innerHTML = "<h2>" + esc(tt("hp_results").replace("{n}", hits.length)) + "</h2>" + (hits.length ? "<ul class=\"hpres\">" + hits.map(function (h) { return "<li><button type=\"button\" data-ch=\"" + h[0].id + "\" data-q=\"" + esc(q) + "\"><b>" + esc(title(h[0])) + "</b><br>" + mark(esc(h[1]), q) + "</button></li>"; }).join("") + "</ul>" : "<p class=\"hint\">" + esc(tt("hp_none")) + "</p>");
  }
  function build() {
    dlg = E("dialog", "hpdlg"); dlg.id = "helpDlg"; dlg.setAttribute("aria-labelledby", "hpTitle");
    dlg.innerHTML = '<div class="hphead"><h2 id="hpTitle"></h2><div class="hpsearch"><label for="hpQ" class="hpql"></label><input type="search" id="hpQ" autocomplete="off"></div><button type="button" class="btn ghost small" id="hpClose"></button></div>' +
      '<div class="hpmain"><nav id="hpNav" aria-label=""><ul></ul></nav><article id="hpBody" tabindex="0" aria-labelledby="hpH"></article></div>' +
      '<div class="hpfoot"><button type="button" class="btn ghost small" id="hpPrev"></button> <button type="button" class="btn ghost small" id="hpNext"></button><span class="hpsp"></span><button type="button" class="btn ghost small" id="hpDemo"></button> <button type="button" class="btn ghost small" id="hpPrintCh"></button> <button type="button" class="btn ghost small" id="hpPrintAll"></button></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.id === "hpClose") dlg.close(); else if (b.id === "hpPrev" || b.id === "hpNext") { var i = window.LVHELP.map(function (c) { return c.id; }).indexOf(cur) + (b.id === "hpNext" ? 1 : -1); if (window.LVHELP[i]) { $("#hpQ").value = ""; show(window.LVHELP[i].id); } }
      else if (b.id === "hpPrintCh") print([cur]); else if (b.id === "hpPrintAll") print(window.LVHELP.map(function (c) { return c.id; }));
      else if (b.id === "hpDemo") { if (D.loadDemo()) dlg.close(); }
      else if (b.getAttribute("data-ch")) { var q = b.getAttribute("data-q") || ""; if (!q) $("#hpQ").value = ""; show(b.getAttribute("data-ch"), null, q); $("#hpBody").focus(); }
    });
    $("#hpQ").addEventListener("input", function () { search(this.value); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }
  function labels() {
    $("#hpTitle").textContent = tt("hp_title"); $(".hpql").textContent = tt("hp_search"); $("#hpQ").setAttribute("placeholder", tt("hp_search")); $("#hpNav").setAttribute("aria-label", tt("hp_toc")); $("#hpClose").textContent = tt("hp_close");
    $("#hpPrev").textContent = "← " + tt("hp_prev"); $("#hpNext").textContent = tt("hp_next") + " →"; $("#hpDemo").textContent = tt("hp_demo"); $("#hpPrintCh").textContent = tt("hp_print_ch"); $("#hpPrintAll").textContent = tt("hp_print_all");
  }
  function open(id, anchor) {
    if (!dlg) build(); labels(); $("#hpQ").value = ""; if (!dlg.open) dlg.showModal(); show(id || cur, anchor); if (!anchor) $("#hpBody").focus();
  }
  function print(ids) {
    var all = $(".hpall") || (function () { var d = E("div", "hpall"); d.setAttribute("aria-hidden", "true"); document.body.appendChild(d); return d; })(); all.innerHTML = "<h1>" + esc(tt("hp_title")) + " – LV-Devis Tiefbau</h1><p>" + esc(tt("hp_by")) + "</p>" + window.LVHELP.filter(function (c) { return ids.indexOf(c.id) >= 0; }).map(function (c) { return "<h2>" + esc((window.LVHELP.indexOf(c) + 1) + ". " + title(c)) + "</h2>" + body(c); }).join("");
    var was = dlg && dlg.open; if (was) dlg.close(); document.body.classList.add("print-help");
    var done = function () { document.body.classList.remove("print-help"); window.removeEventListener("afterprint", done); if (was) dlg.showModal(); };
    window.addEventListener("afterprint", done); window.print(); setTimeout(function () { if (document.body.classList.contains("print-help")) done(); }, 1500);
  }
  function ctxId() { if (document.querySelector("dialog.kmdlg[open], dialog[open] #kmMap")) return ["map"]; var t = D.S().tab, m = { graben: 1, rohr: 1, schacht: 1, werkloch: 1, fund: 1, geb: 1, belag: 1, allg: 1 }; return m[t] ? ["rec", "h-tab-" + t] : t === "plan" ? ["map"] : ["start"]; }
  function start() {
    D = window.__LVD; if (!D || !D.loadDemo || !window.LVHELP) return;
    window.__LVHELP = { open: open, title: function (id) { var c = window.LVHELP.filter(function (x) { return x.id === id; })[0]; return c ? title(c) : ""; } };
    var row = $(".toolrow"), nb = $("#bNew"), hb = E("button", "btn ghost", ""); hb.type = "button"; hb.id = "bHelp"; if (row && nb) row.insertBefore(hb, nb); hb.addEventListener("click", function () { open("start"); });
    var nv = $("nav[aria-label=Reiter], nav.no-print"), qb = E("button", "btn ghost small hpq", "?"); qb.type = "button"; qb.id = "hpTabBtn"; if (nv) nv.appendChild(qb); qb.addEventListener("click", function () { var c = ctxId(); open(c[0], c[1]); });
    var relabel = function () { hb.textContent = tt("hp_btn"); qb.setAttribute("aria-label", tt("hp_ctx")); qb.setAttribute("title", tt("hp_ctx")); }; relabel();
    var lg = $(".langs"); if (lg) lg.addEventListener("click", function () { setTimeout(function () { relabel(); if (dlg && dlg.open) { labels(); show(cur); } }, 0); });
    document.addEventListener("keydown", function (e) { if (e.key === "F1") { e.preventDefault(); var c = ctxId(); open(c[0], c[1]); } });
  }
  document.addEventListener("DOMContentLoaded", start);
})();
