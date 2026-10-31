/* Assistent (regelbasiert, ohne KI): beantwortet aus dem hinterlegten Wissen (LV, Handbuch-Auszug, Bedienung) und dem Projektstand.
   Keine Anfrage verlässt das Gerät, es werden keine KI-Tokens verbraucht. Änderungen nur als Vorschlag mit Bestätigung. Konzept: Alessandro Cortese */
(function () {
  "use strict";
  var D = null, turns = 0, pan, msgs, ta, note;
  var $ = function (q, r) { return (r || document).querySelector(q); };
  var tt = function (k) { return D.tt(k); };
  function E(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var chf = function (v) { return (Math.round(v * 100) / 100).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  /* ---------- Wissensbasis ---------- */
  var HB = "Handbuch unter- und oberirdischer Netzbau V1.2 (Swisscom, 01.04.2026)";
  var KB = [
    { k: [/schachtabst|abstand.*schacht|schacht.*abstand|wirtschaftlich/, /richtwert/], t: "Wirtschaftliche Schachtabstände", s: HB + ", 2.2.2",
      a: "Richtwerte (Distanz in m):\n• Basiserschliessung Teilnehmerkabel Cu: in Bauzone ca. 200–250, ausserhalb ca. 500\n• Teilnehmerkabel GFK: in Bauzone ca. 1'000, ausserhalb 1'000–6'000\n• FK/RK: in Bauzone ca. 1'000, ausserhalb 1'000–6'000\n• Detailerschliessung (Teilnehmer Cu + GFK, Schacht–UP): bis ca. 200 in und ausserhalb Bauzone.\nFür eine problemlose Kabelverlegung gilt ein minimaler Rohrradius von K100 ≥ 3 m und K55 und kleiner ≥ 1 m. Im Tool: Karte → Auswertung → «Vorschläge» und «Prüfung nach Handbuch»." },
    { k: [/schachttyp|schachtart|\bkes\b|\bes\b|einstieg|muffe/, /kontrollschacht|\bks\b/], t: "Schachttypen (Stand 2026)", s: HB + ", 2.3.3",
      a: "• ES Einstiegsschacht 3.00 × 1.50 × 2.00 m: > 3 Muffen (Neubau als Spleissschacht in Strassen, Gehwegen, Vorplätzen; heute die Ausnahme, kleinere Bauten vorziehen)\n• KES Kleineinstiegsschacht: 1.00 × 1.00 × 1.35 m (max. 1 Muffe flach FD8); 1.50 × 1.00 × 1.35 m (Standard, max. 3 Muffen); 1.50 × 1.00 × 1.75 m (max. 4 Muffen)\n• KS Kontrollschacht Ø 800 mm (Brunnenring): max. 1 FD8 flach Muffe; Spleissschacht und Übergangspunkt in Kunststoffrohranlagen; zu klein für Kabelnachzug, Rohre müssen geradlinig durch den Schacht verlaufen.\nDie Anzahl Rohre K55/K100 und die Muffen bestimmen die Schachtgrösse. Abweichungen von den Normplänen: Sonderfreigabe nach Vertrag." },
    { k: [/geb(ä|ae)ude.*(anschl|einf)|hausanschl|hauseinf|efh|mehrfamilien|einfamilien/], t: "Gebäudeanschlüsse", s: HB + ", 2.2.4",
      a: "• Ein- und Zweifamilienhaus: 1 × K55\n• Mehrfamilienhäuser: 1 × K55/100 (durch Kunde getrieben)\n• Büro-/Verwaltungs- und Industriebauten: 1 × K55/100 (durch Kunde getrieben); Zweitweganschluss möglich\n• Maximale Rohrlänge ab letztem Schacht zum Gebäude ca. 250 m (Einschränkung durch Kabeltyp beachten)\n• Zusammenhängende Bauten möglichst zentral oder mit einer Kabelkanalisation anschliessen (Erschliessungs- und Durchleitungsvertrag)." },
    { k: [/biegeradi|radius|krümm|knick/], t: "Biegeradien", s: HB + ", 2.2.2",
      a: "Minimaler Rohrradius für eine problemlose Kabelverlegung: K100 ≥ 3 m, K55 und kleinere Rohre ≥ 1 m. Im Kontrollschacht Ø 80 sind die Biegeradien einzuhalten und die Rohre geradlinig zu führen. Das Tool prüft den erreichbaren Radius an Knicken (Karte → Auswertung → Prüfung nach Handbuch)." },
    { k: [/zweitweg|getrennte? wege|5 m/], t: "Zweitweg", s: HB + ", 2.2.3",
      a: "Getrennte Wege gelten nur, wenn ausser den Endpunkten keine gemeinsamen Übertragungsstellen/-trassen genutzt werden. Normalfall: Abstand der Kabelkanalisationen/Leitungen/Trassen mindestens 5 m; Ausnahme: parallele Trassen beidseits eines befahrbaren Weges (im Strassenrand) mindestens 3 m. Bei Kreuzungen > 5 m. Trassen dürfen nicht über die gleichen Kunstbauten (Brücken, Tunnel) verlaufen." },
    { k: [/hauptkanal|erster abzweig|\bco\b|zentral/], t: "Hauptkanalisation ab Zentrale", s: HB + ", 2.2.3",
      a: "Gemeinsame Trassen sind nur vom CO bis zum ersten Abzweig-Schacht zugelassen. Hauptkanalisation mit Betonrohren: Abzweig-Schacht normalerweise ca. 50 m vom CO, je nach Gegebenheiten max. 100 m. Mit Kunststoffrohrblöcken: max. 250 m." },
    { k: [/querung|strassenquer|parzell|erschliessung.*gebiet|kern|reihen/], t: "Erschliessung nicht überbauter Gebiete / Strassenquerungen", s: HB + ", 2.4",
      a: "• Ohne Parzellierung: durchgehende Anlage (n K55 + n K100) mitführen, Abzweigen erst bei Bedarf.\n• Mit Parzellierung: Kernerschliessung (ein konzentrierter Abgang) oder Reihenerschliessung (Abgänge parallel zur Basiserschliessung).\n• Strassenquerung: bei Strassenbau ohne Parzellierung nur eine Querung (KS oder KES bei ca. 1/3 des Baugebiets); bei Strassenbau mit Fundationsschicht-Erneuerung und Parzellierung gezielte Querungen für die Detailerschliessung; Querung ohne Strassenbau vorbereiten." },
    { k: [/kostenteil|kostenbeteilig|strassenbau|strassensanier|belagssanier|werkleitungssanier|kieskoffer|planum/], t: "Kostenteiler Strassen/Werke", s: HB + ", 2.5",
      a: "• Strassenneubau: Belagsarbeiten und Kieskoffer sowie Neuversetzen der Randabschlüsse zu Lasten des Strassenbaus; Leitungsbau inkl. Tiefbau bis unter den Kieskoffer (Planum) zu Lasten der Werke (anteilsmässig nach Alter bei Behinderung).\n• Strassen-/Belagssanierung: Belagsarbeiten und Kieskoffer, Neuversetzen Randabschlüsse zu Lasten Strassenbau; Aufwendungen für Sichern/Schützen bestehender Werkleitungen und Leitungsarbeiten bis unter den Koffer zu Lasten der Werke.\n• Werkleitungssanierung ohne Arbeiten des Strasseneigentümers: Werke tragen sämtliche Tiefbaukosten inkl. Beläge und Kieskoffer.\n• Fundationsschicht-Erneuerung: keine Kostenbeteiligung von Swisscom an Koffer und Belag; nur durch Arbeiten von Swisscom verursachte Mehrkosten." },
    { k: [/kabelkanal|kunststoffrohr|einbeton|grundsätz|grundsaetz/], t: "Grundsätze Kabelkanalisation", s: HB + ", 2.2.1",
      a: "• So bauen, dass bei späterer Kabelverlegung möglichst keine Belagsarbeiten nötig sind.\n• Bei sich bietender Gelegenheit mit Strassenneu-/Umbau und Werkleitungsbauten koordinieren.\n• In bewohnten Gebieten im öffentlichen Grund (Gemeinde-/Staatsstrassen), in unbewohnten möglichst entlang von Strassen und Wegen.\n• Bestehende, nicht voll belegte Anlagen werden im Normalfall nicht durch Kunststoffrohre ersetzt; neue Kanalisationen mit Kunststoffrohren, in der Regel nicht einbetoniert (ausser aus Sicherheits- oder bautechnischen Gründen).\n• Alternative Methoden: grabenlos (Pressen, Spülen, Erdraketen) oder mit kleinem Grabenteil (Pflügen, Fräsen)." },
    { k: [/einmass|dxf|geo405|netzkante|netzknoten|topologie|genauigkeit|gnss|bogenschnitt|rechtwinkelmass/], t: "Einmass und Datentransfer", s: HB + ", Kap. 3",
      a: "• Einzumessen: Netzkanten (Linie), Netzknoten (Schächte, Abzweigungen; Punkt), Sonderbauwerke (Polygon); Trassenlänge zwischen den Netzknoten.\n• Topologie: Netzkanten, die zum gleichen Netzknoten führen, treffen sich in einem gemeinsamen Punkt.\n• Lagegenauigkeit ±20 cm, am offenen Graben einmessen (Leitungsverordnung Art. 62).\n• Datentransfer: 1 × DXF nach SIA Geo405 (Codes: Netzkante 100, Netzknoten 200, Knickpunkt 201).\n• Einmass von Hand: Bogenschnitt oder orthogonale Einmasse, auf einem Einmassplan eintragen.\nIm Tool: Karte → Auswertung → «DXF exportieren» (Layeraufbau vor Produktivnutzung prüfen)." },
    { k: [/deckel|abdeckung|nivo|bgs|wahlverfahren|betonsockel|\bme\b|plattendruck/], t: "Schachtabdeckung", s: HB + ", 2.3.4–2.3.5, 2.7",
      a: "Wahlschema (Entscheidungsbaum): Kantons-/Hauptstrasse ≥ 50 km/h → ES bzw. KES (Look-Grip) mit Deckel NIVO D400; Nebenstrasse < 50 km/h/Trottoir → KES (Inlay-Grip) bzw. KS; Wiese/Parzelle/Vorplatz → KES/KS mit Deckel DS400. Bei Nicht-Standardgrösse Sonderfreigabe. Bei Einbau mit Betonsockel auf Verdichtung der Schachtumgebung achten; werden die ME-Werte nicht erreicht, trägt die ausführende Unternehmung die Kosten der ME-Messungen (Plattendruckversuch SN 670317b/VSS-70317). Vorgaben des Deckelherstellers beim Öffnen/Schliessen einhalten." },
    { k: [/gas|wasserdicht|kabelkeller|einführung.*gebäude|stahlrohr/], t: "Kabeleinführung in Gebäuden", s: HB + ", 2.6",
      a: "Alle Gebäude mit Kabeleinführungen sind gas- und wassergefährdet. Dichtungselemente halten konstant 0.5 bar Innen-/Aussenüberdruck (gas- und wasserdicht). Stahlrohre werden ins Mauerwerk einbetoniert, Kunststoffrohre eingeführt und mit Schrumpfschlauch abgedichtet; vom Gebäudeinnern gas- und wasserdicht absichern. Bei möglichem Druckwasser enden die Kunststoffrohre in einem Kontrollschacht KS 60 mit Entwässerung vor der Hauseinführung." },
    { k: [/norm|sia ?(205|118|405)|vss|vse/], t: "Normen und Gesetze", s: HB + ", 2.1.4",
      a: "• SIA 205: Verlegung unterirdischer Leitungen – räumliche Koordination und technische Grundsätze\n• SIA 118: Werkvertrag, Vergütung, Bestellungsänderung, Bauausführung, Ausmass, Abnahme und Mängelhaftung\n• SIA 405: Geodaten zu Ver- und Entsorgungsleitungen (Leitungskataster)\n• VSS-Normen: Strassenverkehrsanlagen, Böden, Baustoffe, Bitumen\n• VSE: Leitfaden Verlegung von Kabelschutzrohren aus Kunststoff" },
    /* Bedienung */
    { k: [/fang|rechtwinkl|parallel|abzweig|schacht.*linie|linie.*teilen/], t: "Fang, Abzweig, Schacht auf Linie", s: "Bedienung",
      a: "Beim Zeichnen fängt das Tool Punkte, Linien (Fusspunkt) sowie rechtwinklig/parallel zur Bezugslinie (Umschalt kehrt vorübergehend um; Schalter in der Fussleiste). Start auf einer Linie erzeugt einen Abzweig mit Knoten am Fusspunkt. Wird ein Schacht auf eine Linie gesetzt, wird die Linie geteilt (Gesamtlänge bleibt); Linienende = Rohre hinein, Linienstart = hinaus; daraus werden die Anschlüsse DN 80 (K55) und DN 150 (K100 und grösser) automatisch gezählt." },
    { k: [/vorschl|prüfung|pruefung|plausib|warnung.*karte/], t: "Prüfung und Vorschläge in der Karte", s: "Bedienung",
      a: "Karte → Reiter «Auswertung»: «Prüfung nach Handbuch» meldet Linienenden ohne Schacht, Schachtabstand über Richtwert, Biegeradius, Schachttyp/Muffen, Kontrollschacht-Eignung und Gebäudeabstand. «Vorschläge»: Erschliessungsart und Lage wählen, «Vorschläge berechnen» zeigt Schächte im Richtabstand/an Knicken und Werklöcher an Abzweigen gestrichelt; «Alle übernehmen» setzt sie (rückgängig möglich)." },
    { k: [/höhe|hoehe|schräg|schraeg|gefälle|gefaelle|profil|swissalti/], t: "Höhenprofil und Schräglänge", s: "Bedienung",
      a: "Karte → Auswertung → «Höhenprofil laden» holt das Profil von swisstopo (swissALTI3D, braucht Internet) und zeigt Lage-/Schräglänge und Gefälle. Standard bleibt die Lagelänge; nur mit «Kosten mit Schräglänge rechnen» übernimmt «Übernehmen» die Schräglänge (und Beschriftungen zeigen «schräg»). Ob Ausmass nach Lage oder Schräglänge gilt, ist vertraglich zu klären." },
    { k: [/druck|pdf|excel|xlsx|sicher|speicher|json|laden|backup/], t: "Druck, Excel, Sicherung", s: "Bedienung",
      a: "Unter dem Ergebnis: Druck kompakt/detailliert/Zusammenfassung (Browser-Druck als PDF), Excel-Export, Sicherung als JSON und Laden. Der Zustand wird zusätzlich automatisch im Browser (localStorage) gespeichert." },
    { k: [/karte|plan|zeichnen|erfass|linie|werkloch|messen|massstab|kalibr/], t: "Erfassung auf Karte und Plan", s: "Bedienung",
      a: "Karte öffnet die Erfassung auf der swisstopo-/Parzellenkarte (Kartenquelle in der Fussleiste), Plan arbeitet auf einem hochgeladenen PDF/Bild mit Massstab-Kalibrierung. Werkzeuge: Auswählen/Verschieben, Zeichnen (Linie, Fläche, Schacht, Werkloch, Gebäude), Beschriften, Messen, Rückgängig. Mittelpanel: Ebenen und Katalog, rechts Eigenschaften und Auswertung. «Übernehmen» schreibt die Zeichnung in die Datensätze (Graben, Schacht, Werkloch, Gebäude, Belag)." },
  ];
  var STOP = /^(der|die|das|und|oder|ein|eine|einen|ist|sind|was|wie|wo|wann|mit|für|fuer|von|im|in|am|zu|zum|zur|den|dem|des|bitte|mir|ich|mein|meine|gibt|es|noch|auch|nach|auf|bei|ob|kann|kannst|soll|sollte|wieviel|wie viel|kostet|kosten)$/;

  /* ---------- LV ---------- */
  function lvSearch(q, n) {
    var w = String(q || "").toLowerCase().split(/[^a-zäöüß0-9\/.]+/).filter(function (x) { return x.length > 2 && !STOP.test(x); }), hits = [];
    if (!w.length) return hits;
    Object.keys(LV).forEach(function (k) { var e = LV[k], hay = (k + " " + (e.t || "") + " " + (e.c || "")).toLowerCase(); if (w.every(function (x) { return hay.indexOf(x) >= 0; })) hits.push(k); });
    return hits.slice(0, n || 8);
  }
  function lvLine(k) { var e = LV[k], t = (window.lvT ? window.lvT(k) : e.t); return k + " · " + String(t).replace(/\s+/g, " ").slice(0, 150) + " · " + chf(e.ep) + " CHF/" + e.u; }

  /* ---------- Projekt ---------- */
  function calc() { try { return KVE.calc(D.S(), LV); } catch (e) { return null; } }
  function netto(S) { return KVE.calc(S, LV).sum.netto; }
  function summary(out) {
    var s = out.sum, S = D.S(), n = 0; Object.keys(S.recs || {}).forEach(function (t) { n += (S.recs[t] || []).length; });
    return "Projektstand: " + n + " Datensätze, " + (out.summary || []).length + " Positionen.\nZwischensumme " + chf(s.zwischen) + " CHF · Rabatt Stufe " + s.stufe + " (" + s.pct + " %) " + chf(-s.rabatt) + " · Installationsanteil " + chf(s.inst) + " · Netto " + chf(s.netto) + " CHF · MWST " + chf(s.mwst) + " · Brutto " + chf(s.brutto) + " CHF." + (out.nOffen ? "\nOffene Positionen (ohne Preis): " + out.nOffen + "." : "");
  }
  function topPos(out) {
    var t = (out.summary || []).filter(function (p) { return p.total > 0; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 8), tot = out.sum.zwischen || 1;
    if (!t.length) return "Noch keine bewerteten Positionen.";
    return "Grösste Positionen (Anteil an der Zwischensumme):\n" + t.map(function (p) { return "• " + p.key + " · " + String(p.text || p.tk || "").replace(/\s+/g, " ").slice(0, 60) + " · " + chf(p.total) + " CHF (" + Math.round(p.total / tot * 100) + " %)"; }).join("\n");
  }
  function warns(out) {
    var a = (out.warn || []).slice(0, 12).map(function (w) { return "• " + (w.tab ? tt("tab_" + w.tab) + " · " + (w.el || "") + ": " : "") + D.fill(tt("w_" + w.id), w.args); });
    var c = (out.complete || []).filter(function (it) { return it.st === "open" || it.st === "nopos"; }).map(function (it) { return "• " + tt("c_" + it.id) + " – " + tt({ open: "v_open", nopos: "v_nopos" }[it.st]); });
    var live = window.KARTE && KARTE.live ? KARTE.live.check() : null;
    return (a.length ? "Warnungen im Ergebnis:\n" + a.join("\n") : "Keine Warnungen im Ergebnis.") + (c.length ? "\n\nVollständigkeit (offen):\n" + c.join("\n") : "") + (live ? "\n\nPrüfung nach Handbuch (aktuelle Zeichnung):\n" + (live.length ? live.slice(0, 15).map(function (x) { return "• " + x; }).join("\n") : "• keine Auffälligkeiten") : "\n\nPrüfung der Zeichnung nach Handbuch: Karte öffnen → Auswertung.");
  }
  function walk(rec, path) { var p = String(path).split("."), o = rec; for (var i = 0; i < p.length - 1; i++) { o = o && o[p[i]]; if (!o || typeof o !== "object") return null; } return o ? { o: o, k: p[p.length - 1] } : null; }
  function setVal(S, tab, idx, feld, wert) {
    var r = (S.recs[tab] || [])[idx - 1]; if (!r) throw new Error(tab + " " + idx + " existiert nicht");
    if (/(^|\.)(uid|wlMap|anMap)$/.test(feld)) throw new Error("Feld nicht änderbar");
    var w = walk(r, feld); if (!w || !(feld.split(".").pop() in w.o)) throw new Error("Feld «" + feld + "» unbekannt");
    var cur = w.o[w.k]; if (cur && typeof cur === "object") throw new Error("Nur einzelne Felder, keine Gruppen");
    w.o[w.k] = typeof cur === "boolean" ? /^(true|ja|1|yes)$/i.test(String(wert)) : String(wert); return r;
  }
  function command(q) {
    var m = /(?:setze|ändere|aendere|stelle)\s+(graben|rohr|schacht|werkloch|fund|geb|belag|allg)\w*\s*(\d+)?\s+([\w.]+)\s+(?:auf|=|zu)\s+(\S+)/i.exec(q); if (!m) return null;
    var S = D.S(), tab = m[1].toLowerCase(), idx = parseInt(m[2] || "1", 10), feld = m[3], wert = m[4].replace(/[.,;]+$/, ""), r = (S.recs[tab] || [])[idx - 1];
    if (!r) return "Datensatz «" + tab + " " + idx + "» gibt es nicht.";
    var keys = Object.keys(r).filter(function (k) { return k !== "uid" && typeof r[k] !== "object"; }), hit = keys.filter(function (k) { return k.toLowerCase() === feld.toLowerCase(); })[0] || (feld.indexOf(".") > 0 ? feld : null);
    if (!hit) return "Feld «" + feld + "» kennt dieser Datensatz nicht. Mögliche Felder: " + keys.slice(0, 30).join(", ") + ".";
    try {
      var Q = JSON.parse(JSON.stringify(S)), w0 = walk(r, hit), before = w0 && w0.o[w0.k.split(".").pop()]; before = w0 ? w0.o[hit.split(".").pop()] : "";
      setVal(Q, tab, idx, hit, wert); var wq = walk(Q.recs[tab][idx - 1], hit), after = wq.o[hit.split(".").pop()], d = Math.round((netto(Q) - netto(S)) * 100) / 100;
      addCard({ tab: tab, idx: idx, feld: hit, wert: wert, name: r.name || tab + " " + idx, before: before, after: after, d: d });
      return "Vorschlag unten: bitte bestätigen oder verwerfen. Geändert wird erst nach «Übernehmen».";
    } catch (e) { return String(e.message || e); }
  }
  var HELP = "Ich antworte aus dem hinterlegten Wissen, ohne KI und ohne Tokens. Beispiele:\n• «Was ist der grösste Kostentreiber?» / «Zusammenfassung»\n• «Was fehlt noch?» / «Warnungen»\n• «Schachtabstand Basis Cu», «Schachttypen», «Biegeradius», «Gebäudeanschluss», «Kostenteiler»\n• «Position 151/672.201» oder Stichworte aus dem LV (z. B. «Kontrollschacht Brunnenring»)\n• Bedienung: «Fang», «Höhenprofil», «Druck», «Vorschläge»\n• Änderung vorschlagen: «setze graben 1 T auf 1.2»";

  function answer(q) {
    var ql = q.toLowerCase(), cmd = command(q); if (cmd) return { t: cmd };
    var out = calc(), mk = /\b\d{3}\/\d{3}\.\d{3}\b/.exec(q);
    if (mk && LV[mk[0]]) { var e = LV[mk[0]]; return { t: lvLine(mk[0]) + (e.c ? "\nHinweis: " + String(e.c).replace(/\s+/g, " ").slice(0, 300) : ""), s: "LV Swisscom V1.1" }; }
    if (out && /kostentreiber|teuerst|grösst|groesst|größt|anteil|top ?\d*/.test(ql) && /(kosten|position|preis|treiber|teuer)/.test(ql)) return { t: topPos(out), s: "Projektstand" };
    if (out && /(fehlt|fehlen|offen|unvollständig|vollständig|vollstaendig|warn|hinweis|prüf|pruef)/.test(ql) && !/handbuch|richtwert/.test(ql)) return { t: warns(out), s: "Projektstand" };
    if (out && /(zusammenfass|summe|total|netto|brutto|mwst|rabatt|gesamtkosten|kosten.*projekt|projekt.*kosten)/.test(ql)) return { t: summary(out), s: "Projektstand" };
    var best = null, sc = 0; KB.forEach(function (it) { var n = it.k.reduce(function (a, r) { return a + (r.test(ql) ? 1 : 0); }, 0); if (n > sc) { sc = n; best = it; } });
    var lvh = lvSearch(q, 8), lvWanted = /\b(position|lv|einheitspreis|ep|npk)\b|was kostet|preis/.test(ql);
    if (best && !(lvWanted && lvh.length)) return { t: best.t + "\n" + best.a, s: best.s };
    if (lvh.length) return { t: "LV-Positionen (" + lvh.length + (lvh.length === 8 ? "+" : "") + " Treffer):\n" + lvh.map(function (k) { return "• " + lvLine(k); }).join("\n"), s: "LV Swisscom V1.1" };
    if (out && /(projekt|stand)/.test(ql)) return { t: summary(out), s: "Projektstand" };
    return { t: "Dazu habe ich nichts Hinterlegtes gefunden.\n\n" + HELP };
  }

  /* ---------- Oberfläche ---------- */
  function addMsg(role, txt, src) { var m = E("div", "chm " + role, txt); if (src) m.appendChild(E("div", "chsrc", tt("ch_src") + ": " + src)); msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight; return m; }
  function addCard(p) {
    var c = E("div", "chcard"), h = E("strong", "", tt("ch_prop") + ": " + p.name), l = E("div", "", tt("ch_fromto").replace("{f}", p.feld).replace("{a}", p.before === "" || p.before == null ? "–" : String(p.before)).replace("{b}", String(p.after))), k = E("div", "chd", tt("ch_dd").replace("{d}", (p.d >= 0 ? "+" : "") + p.d.toLocaleString("de-CH")));
    c.appendChild(h); c.appendChild(l); c.appendChild(k);
    var ok = E("button", "btn small", tt("ch_apply")), no = E("button", "btn ghost small", tt("ch_dis")); ok.type = no.type = "button";
    ok.onclick = function () { try { var sn = D.snap(); setVal(D.S(), p.tab, p.idx, p.feld, p.wert); D.commit(sn, tt("ch_done")); ok.remove(); no.remove(); c.appendChild(E("div", "chd", "✓ " + tt("ch_applied"))); ta.focus(); } catch (e) { c.appendChild(E("div", "chd", String(e.message || e))); } };
    no.onclick = function () { c.remove(); ta.focus(); };
    var b = E("div", "chb"); b.appendChild(ok); b.appendChild(no); c.appendChild(b); msgs.appendChild(c); msgs.scrollTop = msgs.scrollHeight;
  }
  function send(q) {
    q = String(q || "").trim(); if (!q) return; var intro = $(".chq", pan); if (intro) intro.hidden = true;
    addMsg("user", q); ta.value = ""; var a; try { a = answer(q); } catch (e) { a = { t: "Das konnte ich nicht auswerten (" + (e.message || e) + ")." }; }
    addMsg("bot", a.t, a.s); turns++;
  }
  function toggle(open) { pan.hidden = !open; $("#chFab").setAttribute("aria-expanded", open ? "true" : "false"); if (open) ta.focus(); else $("#chFab").focus(); }
  function build() {
    var fab = E("button", "btn chfab", tt("ch_fab")); fab.type = "button"; fab.id = "chFab"; fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-controls", "chPan");
    pan = E("section", "chpan"); pan.id = "chPan"; pan.hidden = true; pan.setAttribute("role", "dialog"); pan.setAttribute("aria-modal", "false"); pan.setAttribute("aria-label", tt("ch_title"));
    var hd = E("div", "chhd"), ti = E("strong", "", tt("ch_title")), nw = E("button", "btn ghost small", tt("ch_new")), cl = E("button", "btn ghost small", "✕"); nw.type = cl.type = "button"; cl.setAttribute("aria-label", tt("ch_close"));
    hd.appendChild(ti); hd.appendChild(nw); hd.appendChild(cl);
    note = E("p", "hint chnote", tt("ch_info")); msgs = E("div", "chmsgs"); msgs.setAttribute("role", "log"); msgs.setAttribute("aria-live", "polite"); msgs.tabIndex = 0; msgs.setAttribute("aria-label", tt("ch_title"));
    var qs = E("div", "chq"); ["ch_q1", "ch_q2", "ch_q3", "ch_q4"].forEach(function (k) { var b = E("button", "btn ghost small", tt(k)); b.type = "button"; b.onclick = function () { send(tt(k)); }; qs.appendChild(b); }); msgs.appendChild(qs);
    var f = E("form", "chf"); ta = E("textarea"); ta.rows = 2; ta.setAttribute("aria-label", tt("ch_ph")); ta.placeholder = tt("ch_ph");
    var sb = E("button", "btn small", tt("ch_send")); sb.type = "submit"; f.appendChild(ta); f.appendChild(sb);
    f.addEventListener("submit", function (e) { e.preventDefault(); send(ta.value); }); ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
    cl.onclick = function () { toggle(false); }; nw.onclick = function () { msgs.innerHTML = ""; msgs.appendChild(qs); qs.hidden = false; };
    pan.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); toggle(false); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pan.hidden && !document.querySelector("dialog[open]")) toggle(false); });
    pan.appendChild(hd); pan.appendChild(note); pan.appendChild(msgs); pan.appendChild(f); document.body.appendChild(pan); document.body.appendChild(fab);
    fab.onclick = function () { toggle(pan.hidden); };
    /* beim Zeichnen (modaler Dialog) wandert der Assistent in den offenen Dialog, danach zurück */
    var place = function () { var d = document.querySelector("dialog[open]") || document.body; if (fab.parentNode !== d) { var had = pan.contains(document.activeElement) || document.activeElement === fab; d.appendChild(pan); d.appendChild(fab); if (had) (pan.hidden ? fab : ta).focus(); } };
    new MutationObserver(place).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
  }
  function start() { D = window.__LVD; if (!D || !D.commit) return; build(); }
  document.addEventListener("DOMContentLoaded", start);
})();
