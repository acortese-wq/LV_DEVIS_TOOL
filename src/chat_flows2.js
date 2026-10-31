/* Weitere geführte Beratungen aus dem «Handbuch unter- und oberirdischer Netzbau» V1.2 (Swisscom, 01.04.2026): unterirdisch, Freileitung, Projekt-Check.
   Texte sind Zusammenfassungen; verbindlich bleibt das Handbuch. Konzept: Alessandro Cortese */
window.LVW_FLOWS = function (U) {
  "use strict";
  var HB = U.HB, chf = U.chf, ENM = "ENM-Elementmanager (ENM.Elementmanager@swisscom.com)";
  var Y = [["ja", "Ja"], ["nein", "Nein"]];
  var F = {};

  /* ===================== UNTERIRDISCH ===================== */
  F.zweitweg = { grp: "u", title: "Zweitweg (getrennte Wege)", kw: /zweitweg|getrennte? wege/, intro: "Ich prüfe, ob zwei Trassen als getrennte Wege gelten (Handbuch 2.2.3).",
    steps: [
      { id: "sit", q: "Um welche Situation geht es?", opts: [["par", "Zwei parallele Trassen/Kabelkanalisationen"], ["kr", "Zwei Trassen kreuzen sich"], ["kb", "Kunstbauten (Brücke, Tunnel)"], ["ze", "Zentraleneinführung"]] },
      { id: "rand", when: function (a) { return a.sit === "par"; }, q: "Verlaufen die Trassen beidseits eines befahrbaren Weges, im Strassenrand?", opts: Y },
      { id: "abst", when: function (a) { return a.sit === "par"; }, q: "Wie gross ist der Abstand?", opts: [["k3", "unter 3 m"], ["m", "3 bis 5 m"], ["g5", "über 5 m"]] }
    ],
    result: function (a) {
      var t;
      if (a.sit === "par") { var need = a.rand === "ja" ? 3 : 5, ok = a.abst === "g5" || (a.abst === "m" && need === 3);
        t = (ok ? "Ja, die Trassen gelten als getrennte Wege" : "Nein, die Trassen gelten nicht als getrennte Wege") + ": erforderlich ist ein Abstand von mindestens " + need + " m" + (need === 3 ? " (Ausnahme bei parallelen Trassen beidseits eines befahrbaren Weges im Strassenrand)." : " (Normalfall).") + "\nGetrennte Wege dürfen ausser den Endpunkten keine gemeinsamen Übertragungsstellen und -trassen (nicht im gleichen Trasse oder Rohrblock) nutzen; eine äussere Beschädigung darf nur einen Weg des gleichen Bündels unterbrechen."; }
      else if (a.sit === "kr") t = "Bei Kreuzungen von Kabelkanalisationen/Leitungen und Trassen muss der Abstand mindestens 5 m betragen (Skizze 2.2.3: in 25 m Entfernung vom Kreuzungspunkt gemessen > 5 m). Sonst gelten die Wege nicht als getrennt.";
      else if (a.sit === "kb") t = "Bei Kunstbauten (Brücken, Tunnel usw.) dürfen die Trassen nicht über die gleichen Kunstbauten verlaufen.";
      else t = "Zentraleneinführung: Es gibt zwei Trassen (erstes und zweites Trasse) mit dem ersten Kabelschacht; für die Einführung in die Zentrale gelten zwei Definitionen (gelbe Zone der Skizze). Im Handbuch nachlesen und mit dem Verantwortlichen der Zentrale abstimmen.";
      return { t: t, s: HB + ", 2.2.3" }; } };

  F.haupt = { grp: "u", title: "Hauptkanalisation ab Zentrale (CO)", kw: /hauptkanal|erster abzweig|abzweigschacht/, intro: "Gemeinsame Trassen ab der Zentrale sind nur bis zum ersten Abzweig-Schacht zugelassen (Handbuch 2.2.3).",
    steps: [
      { id: "mat", q: "Welche Bauart hat die Hauptkanalisation?", opts: [["beton", "Betonrohre"], ["kst", "Kunststoffrohrblöcke"]] },
      { id: "d", q: "Wie weit ist der erste Abzweig-Schacht vom CO entfernt?", opts: [["a", "bis 50 m"], ["b", "51 bis 100 m"], ["c", "101 bis 250 m"], ["d", "über 250 m"]] }
    ],
    result: function (a) {
      var max = a.mat === "beton" ? 100 : 250, d = { a: 50, b: 100, c: 250, d: 251 }[a.d], ok = d <= max;
      return { t: (a.mat === "beton" ? "Hauptkanalisation mit Betonrohren: Abzweig-Schacht normalerweise ca. 50 m vom CO, je nach lokalen Gegebenheiten (Geografie) max. 100 m." : "Hauptkanalisation mit Kunststoffrohrblöcken: je nach lokalen Gegebenheiten darf sich der erste Abzweig-Schacht in max. 250 m Entfernung zum CO befinden.") + "\n" + (ok ? "Deine Angabe liegt innerhalb des Richtwerts." : "Deine Angabe liegt über dem Richtwert von " + max + " m – zusätzlichen Abzweig-Schacht oder Alternative prüfen.") + "\nDie gemeinsame Trasse darf nur bis zu diesem ersten Abzweig-Schacht geführt werden; danach getrennte Wege.", s: HB + ", 2.2.3" }; } };

  F.bauweise = { grp: "u", title: "Bauweise und Rohrmaterial", kw: /bauweise|rohrmaterial|grabenlos|alternative bau|zores|einbeton/, intro: "Ich helfe bei der Wahl von Bauweise und Rohrmaterial der Kabelkanalisation (Handbuch 2.2.1, 2.2.4–2.2.6).",
    steps: [
      { id: "as", q: "Was ist die Ausgangslage?", opts: [["neu", "Neue Kabelkanalisation"], ["bel", "Bestehende Anlage, nicht voll belegt"], ["zor", "Bestehende funktionstüchtige Kabelkanäle (Zores) bei Strassenarbeiten"]] },
      { id: "ge", q: "Welche Randbedingung trifft zu?", opts: [["norm", "Normaler Graben möglich"], ["fels", "Fels oder Strassenbelag erschwert den Graben"], ["eng", "Enge Platzverhältnisse über besetzten Kanalisationen"], ["hind", "Hindernis (Fluss, Bahn, Brücke) oder Sonderprojekt"], ["sich", "Sicherheits- oder bautechnische Anforderungen"]] }
    ],
    result: function (a) {
      var t = {
        neu: "Neue Kabelkanalisationen werden mit Kunststoffrohren ausgeführt, in der Regel nicht einbetoniert.",
        bel: "Bestehende, nicht vollständig belegte Anlagen dürfen im Normalfall nicht durch Kunststoffrohre ersetzt werden.",
        zor: "Bestehende, funktionstüchtige Kabelkanäle (Zores) sind nicht durch Kunststoffrohre zu ersetzen. Damit nachträgliche Belagsaufbrüche vermieden werden, Abzweigstücke (Kabelkanal Nr. 4/Nr. 8) auf Kunststoffrohre K55 vorsehen."
      }[a.as] + "\n" + {
        norm: "Normalfall: offener Graben, so dimensionieren, dass später möglichst keine Belagsarbeiten nötig sind; Koordination mit Strassenneu-/Umbau.",
        fels: "Alternative Baumethoden prüfen: grabenlos (Pressen, Spülen, Erdraketen, Leitungen aufweiten, Kabelseele ausziehen, Montage in Abwasserrohren) oder mit kleinem Grabenteil (Pflügen, Fräsen); Maschinen wie Grabenfräse, Spezialfräsen in Fels und Strassenbelägen, Schlag- und Pressvortriebe, Horizontalbohrsysteme, Kabelpflug.",
        eng: "Verlegen von kleinen Kunststoffrohren über besetzten Kabelkanalisationen ist bei engen Platzverhältnissen möglich.",
        hind: "Bei Hindernissen (Brücken, Bahn, Gewässerquerungen) und in Ausnahmefällen (z. B. Brückenquerungen) können andere Rohrmaterialien mit dem Auftraggeber vereinbart werden (Inventardaten).",
        sich: "Kabelkanalisationen werden einbetoniert, wenn Sicherheitsanforderungen oder bautechnische Gründe es erfordern."
      }[a.ge] + "\nZusätzlich prüfen: ob die Kanalisation privater Werke wirtschaftlich und unternehmenspolitisch sinnvoll mitbenutzt werden kann; Wirtschaftlichkeitsrechnung als Grundlage.";
      return { t: t, s: HB + ", 2.1.1, 2.2.1, 2.2.4–2.2.6" }; } };

  F.trasse = { direct: true, grp: "u", title: "Trassenwahl: Kriterien", kw: /trassenwahl|trassierung|linienwahl|beurteilungskriterien/, intro: "Ich nenne dir die Beurteilungskriterien für die Trassenwahl (Handbuch 2.1.1).",
    steps: [
      { id: "gr", q: "Wo verläuft die Trasse?", opts: [["pub", "Auf öffentlichem Grund"], ["priv", "Auf privatem Grund"], ["gem", "Gemeinschaftsbau mit Bund, Kanton, Gemeinde oder Dritten"]] },
      { id: "hi", q: "Gibt es Besonderheiten?", opts: [["kein", "Keine"], ["hind", "Brücken-, Bahn- oder Gewässerquerung"], ["schutz", "Schutzgebiet, Grundwasserzone, unsicheres Terrain/Rutschgebiet"], ["fremd", "Fremde Werkleitungen oder künftige Bauten"], ["land", "Landwirtschaftlich genutzter Boden"]] }
    ],
    result: function (a) {
      var t = {
        pub: "Kabelkanalisation auf öffentlichem Grund und Boden: Bewilligung nötig, Nutzung unentgeltlich; Konzessionen/Gebühren prüfen.",
        priv: "Auf privatem Grund: Bewilligung und Durchleitungsentschädigung (Durchleitungsvertrag); dauernde oder zeitlich beschränkte Unannehmlichkeiten (Umtriebe, Inanspruchnahme, Verzögerungen) werden entschädigt.",
        gem: "Gemeinschaftsbauten sind anzustreben; eine transparente Kostenteilung ist zwingend und vor Baubeginn zu regeln (siehe Beratung «Kostenteiler»)."
      }[a.gr] + "\n" + {
        kein: "Grundsatz: optimales Ausnützen der örtlichen und netztechnischen Gegebenheiten; Trasse so wählen, dass bei späterem Kabelnachzug keine oder nur wenige Grab- und Belagsarbeiten entstehen; Ausbauqualität (einbetoniert ja/nein), Ausbau in Kulturland, Trottoir oder Strasse (Belagsanteil) berücksichtigen.",
        hind: "Hindernisse wie Brücken, Bahn und Gewässer frühzeitig klären; Trassen dürfen für getrennte Wege nicht über die gleichen Kunstbauten verlaufen. Alternative Baumethoden (grabenlos) prüfen.",
        schutz: "Schutzgebiete/Grundwasserzonen/Rutschgebiete: Geografie, Geologie und Bodenmechanik beeinflussen die Erstellungskosten – sichere Trasse wählen.",
        fremd: "Fremde Werkleitungen und Hindernisse beachten; SIA 205 (räumliche Koordination); Koordination mit anderen Werken ist von zentraler Bedeutung für Baukosten und Akzeptanz der Anwohner.",
        land: "Bodennutzung/Bodenbewirtschaftung durch die Landwirtschaft (Ertragsausfall) in die Kosten einrechnen; in unbewohnten Gebieten möglichst entlang von Strassen und Wegen bauen."
      }[a.hi] + "\nEine Wirtschaftlichkeitsrechnung bildet die Grundlage für die optimale Linienführung. Verkehrstechnische Massnahmen und Behinderungen einplanen.";
      return { t: t, s: HB + ", 2.1.1.1–2.1.2" }; } };

  F.kva = { direct: true, grp: "u", title: "Anschluss KVA und Überführungsmast", kw: /\bkva\b|kabelverteilanlage|detailerschliessung.*mast/, intro: "Detailerschliessung von KVA und Kabelüberführungsmasten (Handbuch 2.2.4).",
    steps: [
      { id: "an", q: "Wie sind KVA bzw. Kabelüberführungsmast heute angeschlossen?", opts: [["kan", "Mit Kabelkanälen"], ["erd", "Mit erdverlegten Kabeln"]] },
      { id: "tb", q: "Finden in der Nähe Tiefbauarbeiten statt, die du mitnutzen kannst?", opts: Y }
    ],
    result: function (a) { return { t: "Bestehende Kabelanlagen zu KVA und Kabelüberführungsmasten (heute mit Kabelkanälen oder erdverlegten Kabeln) werden in Koordination mit Tiefbauarbeiten mit 1 K55 so vorbereitet, dass für spätere Kabelnachzüge keine Grabarbeiten nötig sind.\n" + (a.tb === "ja" ? "Empfehlung: jetzt mit den vorhandenen Tiefbauarbeiten 1 K55 mitverlegen." : "Ohne Tiefbauarbeiten in der Nähe: Vorbereitung bei der nächsten sich bietenden Gelegenheit vorsehen; nicht isoliert aufbrechen (Wirtschaftlichkeit prüfen)."), s: HB + ", 2.2.4" }; } };

  F.gebein = { grp: "u", title: "Kabeleinführung ins Gebäude (gas-/wasserdicht)", kw: /einführung.*(gas|wasser)|gasdicht|wasserdicht|kabelkeller|brandabschnitt|\bks ?60\b/, intro: "Gas- und wasserdichte Kabeleinführung in Gebäude (Handbuch 2.6).",
    steps: [
      { id: "geb", q: "Um was für ein Gebäude geht es?", opts: [["alt", "Bestehendes Gebäude"], ["neu", "Neues Gebäude"]] },
      { id: "alt", when: function (a) { return a.geb === "alt"; }, q: "Welche Situation liegt vor?", opts: [["voll", "Noch Vollrohr-Kabeleinführung, nicht saniert"], ["keller", "Kabelkeller (Betondurchführungen)"], ["brand", "Brandabschnitte werden neu festgelegt"], ["gef", "Erhöhte Gas-/Wassergefahr, Nachrüstung wirtschaftlich vertretbar"]] },
      { id: "dr", when: function (a) { return a.geb === "neu"; }, q: "Kann unter Druck stehendes Wasser an die Einführungsstelle gelangen?", opts: Y }
    ],
    result: function (a) {
      var t = "Alle Gebäude mit Kabeleinführungen sind gas- und wassergefährdet. Dichtungselemente müssen konstant 0.5 bar Innen-/Aussenüberdruck (Gas, Wasser) standhalten. Passive Massnahmen: Abdichten, natürliche Entlüftung; aktive: Ventilator, Gas-/Wassersonden.\n";
      if (a.geb === "alt") t += { voll: "Bestehende Gebäude mit Vollrohr-Kabeleinführung, nicht saniert: aktive Massnahmen (Ventilator, Gas- und Wassersonden) weiterhin belassen.", keller: "Kabelkeller: alle Kabeldurchführungen mit passiven Massnahmen gas- und wasserdicht schützen. Beton-Vollrohre sind nicht gas-/wasserdicht – Vollrohr-Brandabschottung mit Abdichtungskissen (KBS Sealbag Firentis).", brand: "Neue Brandabschnitte: Räume mit entsprechenden passiven Massnahmen schützen; Brandschutzvorschriften VKF für Swisscom-Installationen beachten.", gef: "In speziellen Fällen mit erhöhter Gefahr und wirtschaftlicher Vertretbarkeit die Abdichtung mit verschiedenen Elementen nachrüsten." }[a.alt];
      else t += "Neues Gebäude: Einführung mit passiven Massnahmen gas- und wasserdicht abdichten. " + (a.dr === "ja" ? "Wenn unter Druck stehendes Wasser an die Einführungsstelle gelangen kann, enden die Kunststoffrohre in einem Kontrollschacht KS 60 (Ø 60 cm) mit Entwässerung vor der Hauseinführung; K55 und Stahlrohr werden nicht verbunden; Stahlrohre vom Gebäudeinnern gas-/wasserdicht absichern." : "Kanalisation mit Kunststoffrohrblock: Kunststoffrohre in die Stahlrohrbatterie einführen und mit Schrumpfschläuchen auf die Stahlrohre abdichten; Stahlrohre vom Gebäudeinnern gas- und wasserdicht absichern. Stahlrohre werden ins Mauerwerk einbetoniert (Kunststoff bindet nicht genügend mit Beton, Haarrissgefahr).");
      t += "\nDecken-/Wanddurchführungen: Stahlrohre 65/60 mit druckstoss- und brandwiderstandsfähigem Abdichtsystem; Kernbohrungen mit VFK-zugelassenen Abschottungselementen, Lösung mit Stahlrohren vorziehen.";
      return { t: t, s: HB + ", 2.6" }; } };

  F.sockel = { grp: "u", title: "Schachtabdeckung mit Betonsockel (ME-Messung)", kw: /betonsockel|\bme[- ]?(wert|messung)|plattendruck|verdichtung/, intro: "Verdichtung der Schachtumgebung und ME-Messung (Handbuch 2.7.1.1).",
    steps: [
      { id: "vd", q: "Wurde die erforderliche Verdichtung im Bereich der Schachtwände erreicht?", opts: [["ja", "Ja"], ["nein", "Nein / unsicher"]] },
      { id: "me", when: function (a) { return a.vd === "nein"; }, q: "Wie ist das Ergebnis der ME-Messung (Plattendruckversuch)?", opts: [["erreicht", "ME-Werte erreicht"], ["nicht", "ME-Werte nicht erreicht"], ["offen", "Noch nicht gemessen"]] }
    ],
    result: function (a) {
      var t = "Beim Einbau von Schachtabdeckungen mit Betonsockel ist auf die Verdichtung der Schachtumgebung zu achten. Wird die Auffüllung im Bereich der Schachtwände nicht genügend verdichtet, führt dies zu späteren sichtbaren Belagsschäden (der Betonkranz «durchstanzt»).\n";
      if (a.vd === "ja") t += "Verdichtung erreicht – keine ME-Messung nötig.";
      else if (a.me === "offen") t += "Wird die Verdichtung nicht erreicht, müssen ME-Messungen auf Kosten von Swisscom durchgeführt werden (geforderte ME-Werte). Sind die ME-Werte nicht erreicht, trägt die ausführende Unternehmung die Kosten.";
      else if (a.me === "erreicht") t += "ME-Werte erreicht: Die ME-Messung geht auf Kosten von Swisscom.";
      else t += "ME-Werte nicht erreicht: Die ausführende Unternehmung trägt die Kosten (Nachverdichtung/Nachmessung).";
      return { t: t + "\nGrundlage: Plattendruckversuch nach SN 670317b bzw. VSS-70317 (starre Platte Ø 30 cm, stufenweises Be- und Entlasten, Messen der Setzungen).", s: HB + ", 2.7.1.1" }; } };

  F.absperr = { direct: true, grp: "u", title: "Schachtdeckel sichern (Absperrplatte)", kw: /absperr|vorhängeschloss|vorhaengeschloss|schliessvorrichtung/, intro: "Sicherung runder Schachteinstiege Ø 600 mm (Handbuch 2.6.4.4).",
    steps: [{ id: "rm", q: "Welcher Rahmen/Deckel liegt vor?", opts: [["neu", "Vollgussdeckel, neuer Rahmen"], ["alt", "Vollgussdeckel, älterer Rahmen"], ["beton", "Guss-Betondeckel"]] }],
    result: function (a) { return { t: "Absperrplatte für runde Schachteinstiege Ø 600 mm (Art. 137.009.5) mit Vorhängeschloss SEA Code F (Art. 137.007.1; separat bestellbar).\n" + { neu: "Neuere Rahmen: Löcher sind vorhanden – Bolzen der Absperrplatte mit Verriegelungslasche ins vorhandene Loch im Rahmen einführen und mit dem Vorhängeschloss sichern.", alt: "Ältere Rahmen: zwei Löcher in den vorhandenen Rahmen bohren (min. Ø 20 mm, Tiefe ca. 45 mm), dann Platte einsetzen und mit Vorhängeschloss sichern.", beton: "Bei Guss-Betondeckel: Löcher müssen in den Schachthals (Beton) gebohrt werden." }[a.rm] + "\nZugang zu Betriebsräumen und Schächten nach den Sicherheitsrichtlinien der Security Swisscom.", s: HB + ", 2.6.4.4" }; } };

  F.einmass = { grp: "u", title: "Einmass und Datentransfer", kw: /einmass|einmessen|bogenschnitt|rechtwinkelmass|geo405/, intro: "Ich führe dich durch die Anforderungen an das Einmass (Handbuch Kap. 3).",
    steps: [
      { id: "me", q: "Wie wird eingemessen?", opts: [["dig", "Digital im Feld (GNSS/Tachymeter)"], ["hand", "Von Hand (Messband)"]] },
      { id: "gr", q: "Ist der Graben beim Einmass noch offen?", opts: [["ja", "Ja"], ["nein", "Nein"]] }
    ],
    result: function (a) {
      var t = "Einzumessen sind Netzkanten (Linie), Netzknoten (Schächte, Abzweigungen; Punkt) und Sonderbauwerke (Polygon); die Trassenlänge zwischen den Netzknoten wird aufgenommen. Netzkanten, die zum gleichen Netzknoten führen, treffen sich in einem gemeinsamen Punkt (Topologie).\n" +
        (a.gr === "ja" ? "Lagegenauigkeit ±20 cm (Leitungsverordnung Art. 62): am offenen Graben einmessen – so wird die Genauigkeit erreicht." : "Achtung: Die geforderte Lagegenauigkeit ±20 cm ist unabhängig von der Technologie am offenen Graben einzumessen. Bei geschlossenem Graben Einmass nicht nachholen, sondern vorher aufnehmen oder die Technologie nachvollziehbar dokumentieren.") + "\n";
      t += a.me === "dig" ? "Digitales Einmass: Transfer als 1 × DXF nach SIA Geo405 (Codes: Netzkante 100, Netzknoten 200, Knickpunkt 201). Im Tool: Karte → Auswertung → DXF exportieren (Layeraufbau vor Produktivnutzung prüfen)." : "Einmass von Hand: Bogenschnitt (Neupunkt aus zwei Distanzen von zwei koordinativ bekannten Punkten; die beiden Masse sollen möglichst rechtwinklig zueinander stehen) oder orthogonale Einmasse (Rechtwinkelmass mit Winkelprisma, Punkt auf bestehender Linie/Ordinate); beide auf einem Einmassplan eintragen. Bauliche Änderungen dokumentieren.";
      return { t: t, s: HB + ", 3.1" }; } };

  /* ===================== OBERIRDISCH ===================== */
  F.freitypo = { direct: true, grp: "o", title: "Regel- oder Weitspannleitung", kw: /weitspann|regelleitung|stützpunkt|stuetzpunkt/, intro: "Ich unterscheide Regel- und Weitspannleitung und nenne die Pflichten (Handbuch 4.3, 4.13).",
    steps: [
      { id: "sp", q: "Wie gross ist der Abstand der Stützpunkte?", opts: [["a", "höchstens 60 m"], ["b", "über 60 m"]] },
      { id: "hoehe", q: "Beträgt der Bodenabstand der Leitung mehr als 25 m?", opts: [["ja", "Ja"], ["nein", "Nein"]] }
    ],
    result: function (a) {
      var t = a.sp === "a" ? "Regelleitung: Freileitung, deren Stützpunkte höchstens 60 m auseinander stehen. Luftkabel SK bzw. LWL-Luftkabel mit max. 60 m Spannweite (aus Festigkeitsgründen nie für grössere Spannweiten)." : "Weitspannleitung: Freileitung, deren Stützpunkte über 60 m auseinander stehen (Draht-, Seil- und Kabelleitungen). Luftkabel Typ J (integriertes Stahlseil, Tragseil nach «Erläuterungen für den Schwachstrom-Netzbau» vor der Gebäudeeinführung isolieren und erden). Detailbauvorlage an den " + ENM + " einreichen (Anlagebeschrieb, Kartenausschnitt, Längenprofil); Freigabe in projektspezifischen Projekten; Material bestellt/freigegeben über ENM; Montage durch spezialisierte Unternehmen; bei Glasfaserkabel immer ENM kontaktieren.";
      if (a.hoehe === "ja") t += "\nBodenabstand > 25 m: Weitspannungen ab 25 m Höhe sind bewilligungspflichtig – BAZL-Meldepflicht (siehe Beratung «Meldepflicht BAZL»).";
      return { t: t, s: HB + ", 4.3, 4.13" }; } };

  F.bazl = { direct: true, grp: "o", title: "Meldepflicht Luftfahrthindernis (BAZL)", kw: /bazl|luftfahrt|hindernisbegrenzung|meldepflicht/, intro: "Ich kläre die Meldepflicht für Luftfahrthindernisse (Handbuch 4.10–4.12).",
    steps: [
      { id: "h", q: "Übersteigt die Anlage (neu oder Änderung, z. B. Luftkabel auswechseln) einen Bodenabstand von 25 m?", opts: Y },
      { id: "f", q: "Tangiert oder durchdringt sie öffentlich aufliegende Hindernisbegrenzungsflächen von Flugplätzen?", opts: [["ja", "Ja"], ["nein", "Nein"], ["unk", "Unbekannt"]] }
    ],
    result: function (a) {
      var pf = a.h === "ja" || a.f === "ja" || a.f === "unk";
      var t = pf ? "Meldepflichtig" + (a.f === "unk" ? " (bei unbekannter Lage zur Hindernisbegrenzungsfläche vorsorglich klären)" : "") + ": Das Bauvorhaben ist rechtzeitig dem " + ENM + " zu melden.\n• Unterlagen: Anlagebeschrieb (Objekt, Ortsnetz, Baubeginn, besondere Erschwernisse, Schutzmassnahmen, Leitungsart und -typ), Kartenausschnitt 1:25'000 mit Maststandorten (Koordinaten auf 5 m gerundet), Längenprofil (Massstab 1:1'000/1:5'000, Gelände je 300 m über Tal- und Bergstation hinaus, Wald ersichtlich; ggf. Längs-/Querschnitte bei Betonfundamenten).\n• Das BAZL entscheidet spätestens 30 Tage nach Erhalt der vollständigen Unterlagen (Bewilligung, Änderung, Markierung/Befeuerung/Publikation). Vor dem Entscheid darf nicht mit dem Bau begonnen werden.\n• Meldung Baubeginn: schriftlich 30 Tage vor Arbeitsaufnahme an den ENM-Elementmanager.\n• Abbruch einer meldepflichtigen Leitung: sofort schriftlich melden (Kontrollnummer, BAZL-Registrierungsnummer, Gebiet, Abbruchdatum).\nWer vorsätzlich oder fahrlässig gegen LFG/LVG verstösst, wird mit Haft oder Busse bestraft." : "Keine Meldepflicht nach 4.11 (Bodenabstand ≤ 25 m und keine Hindernisbegrenzungsfläche tangiert). Bei Schutzgebieten gilt zusätzlich die Genehmigungspflicht nach Schwachstromverordnung Art. 8a (Natur- und Heimatschutz, kantonale Vorgaben).";
      return { t: t, s: HB + ", 4.9–4.12" }; } };

  F.hausluft = { direct: true, grp: "o", title: "Hausanschluss ab Freileitung (Neubau)", kw: /hausanschluss.*(freileitung|luft)|luftkabel.*haus|hak2oto|netztrennstelle|\bhak\b/, intro: "Neubau von Hausanschlüssen an Freileitungen (Handbuch 4.3.3).",
    steps: [{ id: "sit", q: "Welche Ausgangslage?", opts: [["neu", "Einzelner Anschluss ab Überführungspunkt"], ["stern", "Mehrere Gebäude sternförmig, LWL"], ["mast", "Verteilung auf mehrere Masten"], ["ust", "Bestehender UST"], ["eigen", "Bauherr will Vorbereitung selbst machen"]] }],
    result: function (a) { return { t: { neu: "Neu zu erstellende Freileitungsanschlüsse werden ab Überführungspunkt (UST), SKT, KVS-UST bis zur Netztrennstelle nur noch mit Luftkabel Typ SK oder LWL-Luftkabel erschlossen (Qualität an unterirdische Kabelleitungen angepasst). Metallischer Kabelmantel bzw. Beilaufdrähte an allen Überführungspunkten und auf der ganzen Kabellänge elektrisch durchverbinden. Netztrennstelle: Hausanschlusskasten HAK 6 H V4 AP; HAK2OTO nur bei Einfamilienhäusern mit einer Nutzungseinheit. Im HAK Anschlussmodul 1×2 Q-MX2000 mit UA-Ableiter; Potentialausgleich erstellt der Elektroinstallateur – der Netzbauer kontrolliert die Erdung und meldet fehlende Erdung dem Gebäudeeigentümer.",
      stern: "Sternförmige Gebäudeanschlüsse: LWL-Hausanschluss ohne Spleissung in der Freileitung, LWL direkt vom Spleissschacht bis BEP; Kabel am Mast (UST/KVS-UST) im U-Kanal führen. LWL-Freileitungskabel in unterirdischem Rohr max. 300 m (Voraussetzung: Kabelkanalkapazität genügend).",
      mast: "Verteilung auf mehrere Masten: Der bestehende UST-Mast bleibt; beim Verteil-Holzmast wird eine KVS-UST oder UST 10 EFM montiert (erlaubt der Eigentümer keine KVS-UST: Kontrollschacht mit Haubenmuffe). Luftkabel beim UST-Mast im bestehenden U-Kanal oder neuem U-Kanal/Metallrohr schützen, ebenso am Verteilmast, wenn mehr als 11 Kabel (Kupfer und LWL-Luftkabel) auf einer Regelleitung verbaut werden.",
      ust: "Bestehender UST: LWL-Luftkabel neben dem bestehenden ST-Kasten bis in den Spleissschacht verlegen; im bestehenden U-Kanal oder mit neuem U-Kanal/Metallrohr schützen.",
      eigen: "Eigenleistung des Bauherrn: Er kann Projektierung und Vorbereitung des Anschlusses von der Gebäudeeinführung bis zur Netztrennstelle (in der Regel Kabelkasten) weitgehend selbst bestimmen (Flyer «Anleitung zum Erstellen oberirdischer Swisscom Anschlüsse»). Ist das aus baulichen Gründen nicht möglich, ist eine unterirdische Hauseinführung in einem neuen Projekt zu erstellen. Mängel werden dem Bauherrn mit eingeschriebenem Brief abgemahnt." }[a.sit], s: HB + ", 4.3.3, 4.4.1.6" }; } };

  F.umbauluft = { direct: true, grp: "o", title: "Umbau/Unterhalt Freileitung (PrUh/KoUh)", kw: /prUh|kouh|koUh|präventiver unterhalt|korrektiver unterhalt|blanke dr(ä|ae)hte|bronze|pv-dr|skl2|umbau.*freileitung|st(ö|oe)rung.*(freileitung|luft)/i, intro: "Umbau und Unterhalt an Freileitungen (Handbuch 4.3.2, 4.3.3.6–4.3.3.8).",
    steps: [
      { id: "an", q: "Worum geht es?", opts: [["umbau", "Umbauarbeiten an Freileitung mit blanken/PV-Drähten"], ["stoer", "Störung (KoUh) an Bronze-/PV-Draht"], ["gebst", "Störung eines Gebäudeanschlusses"], ["cu", "Überführungselemente Kupfer bei PrUh/KoUh/EPG"], ["dach", "Dachständer"]] },
      { id: "sw", when: function (a) { return a.an === "stoer"; }, q: "Über wie viele Spannweiten reicht die Störstelle bis zum nächsten Verteilpunkt?", opts: [["bis3", "Bis 3 Spannweiten"], ["ueber3", "Mehr als 3 Spannweiten"]] },
      { id: "dr", when: function (a) { return a.an === "gebst"; }, q: "Besteht die Strecke ab UST/SKT zum Gebäude aus mehreren P/PV-Drähten 1×2 (≥ 5)?", opts: [["ja", "Ja"], ["nein", "Nein"], ["einz", "Einzug von SKL2 nicht möglich"]] },
      { id: "alt", when: function (a) { return a.an === "cu"; }, q: "Welche Überführungsvariante liegt vor?", opts: [["norm", "Normale Elemente mit Holzwechsel"], ["gus", "Alte Gusskasten oder Isolatoren («Glöggli»)"]] }
    ],
    result: function (a) {
      var t = {
        umbau: "Umbauarbeiten an Freileitungen mit blanken oder PV-Drähten: neu ein Luftkabel Typ SK oder LWL-Luftkabel bis zum nächsten bestehenden Überführungspunkt, UST/KVS-UST oder SKT 10/30. Bei Gebäudeanschlüssen mit PV-Draht oder Bronzedraht mit bis zu 2 Anschlüssen wird das Luftkabel SKL2 eingesetzt. Grundsätzlich wird neu ein SK-Luftkabel für diese Arbeiten verwendet.",
        stoer: a.sw === "bis3" ? "Störung auf Bronze-/PV-Draht: 1:1-Ersatz mit dem SK-Luftkabel SKL2, bis zum nächsten bestehenden Verteilpunkt (KVS-UST oder SKT 10/30), maximal 3 Spannweiten. Bei einer Störung (No Signal) auf einer Linie mit mehreren Spannweiten wird die gestörte Leitung grundsätzlich 1:1 ersetzt; ist PV-Draht nicht mehr erhältlich, SKL-Kabel verwenden (Zugkräfte von Bronzedraht sind höher)." : "Mehr als 3 Spannweiten: Die Störung wird provisorisch repariert und über EPG ein Umbauprojekt initialisiert. Bei reduzierter Übertragungsqualität entscheidet Swisscom über Single Project oder KoUh.",
        gebst: a.dr === "einz" ? "Einzug von SKL2 in die bestehende Hauseinführung nicht möglich: nach der provisorischen Reparatur Meldung an Lines; Lines entscheidet über das weitere Vorgehen." : a.dr === "ja" ? "Besteht die Strecke ab Überführungsmast oder SKT 10/30 aus mehreren P/PV 1×2 Drähten (≥ 5), ist die Teilstrecke auf SK-Luftkabel umzubauen: Störung provisorisch reparieren und via EPG ein Umbauprojekt initialisieren." : "Störung Gebäudeanschluss: bestehenden Anschluss mit SK-Luftkabel durchführen und die Grobsicherung (GS) durch Anschlusselement MX2000 mit UA-Ableiter ersetzen; Ersatz der Zuleitung mit SKL2 bis zum HAK. Wenn SKL2 technisch nicht möglich: SKT 2/10 bei der Hauseinführung (kein Grobsicherungsersatz!). Bei Bronzedraht auch die Gebäudeverkabelung mit F-Kabeln (Blei) und GS ersetzen; Isolatoren nach Bedarf stehen lassen (Bleimantel brüchig).",
        cu: a.alt === "gus" ? "Bei alten Gusskästen/Isolatoren: Variante 3 – Spleissung im Aufstieg (einfache Schrumpfschlauchmuffe aus Spleissung, Stoffband, Papierband, Alufolie, Schrumpfschlauch); neuer U-Kanal 56×38 mm, Anschluss an bestehenden Erdleiter, SKT mit ÜSPA." : "Bei PrUh/koUh und EPG (Umbau) werden alle Überführungselemente mit aktiver Kupferbelegung nach der Variante «nur Holzwechsel» umgebaut; zusätzlich werden die oxidierten Anschlusselemente im Kasten/SKT ersetzt (nur so viele wie aktive Kunden belegt sind).",
        dach: "Dachständer: Es werden keine neuen mehr verbaut; keine FTTH-Anschlüsse über Dachständer (zulässige Zuglast überschritten). Bestehende Dachständer (dimensioniert für blanke Leitungen, P1×2 und max. 1 SK2×2 Fawil) dürfen keine zusätzlichen Luftkabel tragen (Ausnahme SKL2). Müssen sie abgebrochen werden: Offerte eines Dachdeckers, fachgerechte Arbeit (Versicherungsfälle vermeiden); nicht abbrechen, sondern auf ca. 25 cm kürzen und mit Schutzkappe versehen (nur mit Einverständnis des Hausbesitzers). Nach provisorischer Reparatur Meldung an Lines für einen unterirdischen Anschluss."
      }[a.an];
      return { t: t + "\nGrobsicherungen sind Eigentum von Swisscom und beim Abbruch mit abzubrechen.", s: HB + ", 4.3.2–4.3.3.8, 4.4.1.6.4" }; } };

  F.ust = { direct: true, grp: "o", title: "Kabelüberführungsmast (UST)", kw: /\bust\b|kabelüberführung|kvs-ust|überführungsmast|stangensockel|u-kanal|kabelkanal.*mast/, intro: "Ich beantworte Fragen zum Kabelüberführungsmast UST (Handbuch 4.4.1.1).",
    steps: [{ id: "th", q: "Welches Thema?", opts: [["alt", "Alte U-/ST-Kästen, Kupfer spleissen"], ["gf", "Erweiterung mit Glasfaser"], ["kanal", "Kabelkanal für weitere LWL-Kabel montieren"], ["stand", "Standort und Dimensionierung"], ["sockel", "Stangensockel und Erdung"]] }],
    result: function (a) { return { t: {
      alt: "Muss am Überführungsmast «U» mit Gusskasten oder UST-Kasten ein Kupferkabel gespleisst werden, muss der ganze Überführungsmast umgebaut werden. Es dürfen keine alten Überführungsmasten Typ U, UST auf Platz umgebaut werden (Holzmasten mind. 35–60 Jahre alt).",
      gf: "Bei Erweiterung der Anlage mit Glasfaserkabel wird die bestehende Infrastruktur bis zum Kupfer-Phase-Out genutzt. KVS-UST-Hybrid mit SKT und Sockel: LWL-Luftkabel oben durch den Kabelkanal führen, mittels metallischer Verschraubung (Ø 7–17 mm) in die KVS-UST einführen und ggf. in die bestehende Kanalisation bis zum Spleisspunkt einziehen.",
      kanal: "Der Übergang auf den UST-Mast erfolgt mit Flexrohr, passendem Kunststoffrohr oder Abdeckung: Flexrohr knapp über dem Boden abschneiden, Kabelkanal mind. 100 mm ins Flexrohr einführen und mit Kitt abdichten. Zusätzlich darf nur 28/28-Kanal verbaut werden (Abrutschen mit Steigeisen); in einem 28/28-Kanal max. 8 Luft-/Erdkabel. Neuen Kabelkanal neben dem UST-Kasten montieren (Besteigen nicht beeinträchtigen). Bei KVS-UST mit Sockel beim Übergang Holzmast/Erdreich zwei Kabelkanäle gegeneinander (bis 200 mm unter Terrain), damit das Kabel rundum geschützt ist.",
      stand: "Standort: dort, wo möglichst viele Gebäude direkt, ohne zusätzlichen Holzmast, angeschlossen werden können; muss die Zuleitung über mehrere Masten führen, Aufteilung in Spleissstellen (SKT30), UST dann verankern. Dimensionierung: Sortiment KVS-UST (Säule) und UST 10 Hybrid EFM (10/50 = max. Erdkabelgrösse im ST-Kasten); Grösse nach Anzahl Erschliessungen festlegen, mittel- und langfristigen Ausbau berücksichtigen (bei mittelfristigem Ausbau nicht auswechseln). Überführung Erd-/Luftkabel im SKT inkl. Überspannungsableiter; Bleikabel ab Spleissmuffe im Schacht durch Erdkabel PE-Alt TK 10×2/0,6 E oder TK 20×2/0,6 E ersetzen.",
      sockel: "Stangensockel: Bei Überführungselementen mit Sockel wird weiterhin der Holzmast auf dem Sockel ersetzt; ohne Sockel weiterhin ohne; bei EPG-Neubau keine Stangensockel; in Belag und Beton auf Stangensockel. Eingrabtiefe einheitlich 1.5 m. Erdung: alle UST-Masten erden; Erddraht 5 mm vom ST-Kasten bis min. 50 cm in den Boden, im Boden mit dem Zores, der Armierung oder Erdband 25×3 mm (mind. 10 m) verbinden; Kontrollmessung gegen Erde max. 30 Ohm (SNG 481000)."
    }[a.th], s: HB + ", 4.4.1.1" }; } };

  var HOLZ = [["7", 120], ["8", 130], ["9", 140], ["10", 150], ["12", 180], ["14", 210]];
  F.mast = { direct: true, grp: "o", title: "Holzmast und Verankerung", kw: /holzmast|eingrabtiefe|mastlänge|verankerung|\banker\b|strebe|doppelmast|mastnummer|kennzeichnung.*mast/, intro: "Holzmasten und Verankerungen (Handbuch 4.4.1.2–4.4.1.3).",
    steps: [
      { id: "th", q: "Welches Thema?", opts: [["tiefe", "Eingrabtiefe"], ["anker", "Verankerung"], ["kenn", "Kennzeichnung und Nummerierung"]] },
      { id: "len", when: function (a) { return a.th === "tiefe"; }, q: "Wie lang ist der Mast?", opts: HOLZ.map(function (h) { return [h[0], h[0] + " m"]; }) },
      { id: "bod", when: function (a) { return a.th === "tiefe"; }, q: "Wie ist der Boden?", opts: [["norm", "Normal"], ["lock", "Locker"], ["fels", "Felsig"]] },
      { id: "sit", when: function (a) { return a.th === "anker"; }, q: "Welche Situation?", opts: [["ust", "Einseitiger Kabelabgang am UST"], ["rich", "Richtungsänderung oder mehrere Abgänge"], ["art", "Verankerungsart wählen"]] }
    ],
    result: function (a) {
      var t;
      if (a.th === "tiefe") { var c = HOLZ.filter(function (h) { return h[0] === a.len; })[0][1]; t = "Eingrabtiefe für Holzmast bzw. Strebe von " + a.len + " m: C = " + c + " cm.";
        if (a.bod === "lock") t += " Im lockeren Boden Steinplatte als Unterlage verwenden."; if (a.bod === "fels") t += " In felsigem Boden Holzmast grundsätzlich vermeiden; ist dies nicht möglich: C = 5.2 × D (D = Masten-Ø an der Einspannstelle (obere Verkeilung) in cm).";
        t += "\nMasten für Regelleitungen höchstens 60 m auseinander; Leiter müssen bei +40° und 0 °C mit 2 kg/m Zusatzlast den Mindestabstand zum Erdboden haben. Holzmasten beziehen die Werke bei den Imprägnierwerken (Artikel 100.001.7 7 m … 100.008.2 14 m)."; }
      else if (a.th === "kenn") t = "Tragwerke tragen die Initialen des Leitungsinhabers, eine Ordnungsnummer und die Jahreszahl der Aufstellung (bei wiederverwendeten Masten zusätzlich deren Jahr); Holzmasten sind mit Jahreszahl der Imprägnierung und Lieferantenkennzeichen dauerhaft markiert. Nummerierung ab UST; bei jeder Abzweigung neu beginnen; nachträglich gestellter Zwischenmast: Nummer mit Punkt weiterführen (z. B. 12.1, 12.2). Angefaulte Masten markieren: «/» angefault, «X» faul (oben/unten); faule Masten sind Lines zu melden.";
      else if (a.sit === "ust") t = "Bei einseitigem Kabelabgang muss ab Luftkabel 6×2 und grösser immer eine Verankerung erstellt werden, in Richtung der Kabelabspannung. Kräfte siehe Montagewerte (mit Zusatzlast rechnen).";
      else if (a.sit === "rich") t = "Bei Richtungsänderungen oder mehreren Kabelabgängen die resultierende Zugkraft R ermitteln; ein Anker wirkt immer entgegengesetzt zur resultierenden Kraft. Kräfte in gleicher Längsachse addieren/subtrahieren sich je nach Richtung (kann eine Verankerung entbehrlich machen).";
      else t = "• Zugverankerung (Anker mit Kreuz, Eingrabtiefe 1.5 m): jederzeit nachspannbar (Spannschloss im Ankerseil); Winkel mind. 25°; für alle Kabeltypen und -grössen Anker mit Kreuz; Schutzrohr zwingend auf Wiesen/Weiden, auf Privatgrund ohne Anfahr-/Tierreibungsrisiko darf es bei Ablehnung des Eigentümers entfallen.\n• Druckverankerung (Strebe): nur in Ausnahmefällen (sehr hohe Kosten, nicht nachspannbar) – meist durch Verschieben der Maststandorte vermeidbar.\n• Schienenanker dort, wo ein minimaler Bodenabstand eingehalten werden muss (Strassen, Plätze, Rad-/Fusswege, landwirtschaftliche Fahrzeuge).\n• Bohranker nur bei SK 2×2 Kupferkabel; Spezialverankerungen auf Mauer, Fels, Gebäude individuell anpassen.\n• «Doppelmast» als Ankerersatz ist in keinem Fall zulässig.";
      return { t: t, s: HB + ", 4.4.1.2–4.4.1.3" }; } };

  /* Montagewerte: je Kabel 5 Zeilen (−15°, 0°, +15°, +30°, max. mit Zusatzlast 1.3 kg/m) × 5 Spannweiten (20, 30, 40, 50, 60 m): [Durchhang f in m, Zugkraft F in daN] */
  var MW = {
    sk6a: ["SK 6×2/0,6", [[[.48,19],[.56,36],[.55,64],[.53,104],[.53,151]], [[.51,18],[.60,33],[.60,59],[.57,97],[.56,142]], [[.53,17],[.64,31],[.65,55],[.62,90],[.59,134]], [[.56,16],[.68,29],[.70,51],[.66,83],[.63,126]], [[.70,105],[1.05,157],[1.40,210],[1.75,262],[2.10,315]]]],
    sk10a: ["SK 10×2/0,6", [[[.54,20],[.69,35],[.77,57],[.79,86],[.78,124]], [[.56,19],[.73,34],[.82,53],[.84,80],[.84,115]], [[.58,19],[.76,32],[.87,50],[.90,75],[.90,108]], [[.61,18],[.80,31],[.92,47],[.96,70],[.96,101]], [[.70,108],[1.05,162],[1.40,215],[1.75,269],[2.10,323]]]],
    sk20a: ["SK 20×2/0,6", [[[.57,27],[.77,45],[.91,68],[1.00,96],[1.06,131]], [[.59,26],[.80,43],[.96,65],[1.06,91],[1.13,123]], [[.61,25],[.84,42],[1.00,62],[1.12,86],[1.19,117]], [[.63,24],[.87,40],[1.05,59],[1.17,82],[1.25,111]], [[.70,114],[1.05,171],[1.40,229],[1.75,286],[2.10,343]]]],
    sk2b: ["SK 2×2/0,8", [[[.43,12],[.41,27],[.32,61],[.29,106],[.29,154]], [[.46,11],[.46,24],[.36,55],[.31,98],[.30,146]], [[.48,10],[.50,22],[.40,49],[.34,91],[.32,138]], [[.51,10],[.55,20],[.45,43],[.37,84],[.34,130]], [[.70,99],[1.05,149],[1.40,198],[1.75,248],[2.10,298]]]],
    sk6b: ["SK 6×2/0,8", [[[.52,20],[.64,37],[.68,61],[.67,96],[.67,139]], [[.54,19],[.68,34],[.73,57],[.73,89],[.71,130]], [[.56,18],[.71,33],[.78,53],[.78,83],[.76,122]], [[.58,18],[.75,31],[.83,50],[.84,77],[.82,114]], [[.70,107],[1.05,160],[1.40,214],[1.75,268],[2.10,321]]]],
    sk10b: ["SK 10×2/0,8", [[[.54,29],[.70,50],[.81,78],[.86,114],[.90,157]], [[.56,28],[.74,48],[.85,74],[.91,108],[.95,148]], [[.59,27],[.77,46],[.90,70],[.97,102],[1.01,141]], [[.61,26],[.81,44],[.94,67],[1.02,97],[1.06,133]], [[.70,115],[1.05,172],[1.40,230],[1.75,287],[2.10,344]]]],
    sk20b: ["SK 20×2/0,8", [[[.57,43],[.78,71],[.95,104],[1.07,144],[1.18,188]], [[.59,42],[.81,68],[.99,100],[1.12,137],[1.23,180]], [[.62,40],[.85,66],[1.03,96],[1.17,132],[1.28,173]], [[.64,39],[.88,64],[1.07,92],[1.22,126],[1.34,166]], [[.70,127],[1.05,191],[1.40,255],[1.75,319],[2.10,383]]]],
    lwl72: ["LWL-Luftkabel 12–72 Fasern", [[[.43,10],[.40,24],[.30,58],[.26,103],[.25,151]], [[.46,9.4],[.45,22],[.33,51],[.26,95],[.27,143]], [[.48,8.9],[.50,19],[.38,45],[.30,88],[.29,135]], [[.51,8.4],[.54,18],[.43,40],[.33,80],[.30,127]], [[.70,98],[1.05,147],[1.40,197],[1.75,246],[2.10,295]]]],
    lwl144: ["LWL-Luftkabel 96–144 Fasern", [[[.48,19],[.56,36],[.55,64],[.53,104],[.53,151]], [[.51,18],[.60,33],[.60,59],[.57,97],[.56,142]], [[.53,17],[.64,31],[.65,55],[.62,90],[.59,134]], [[.56,16],[.68,29],[.70,51],[.66,83],[.63,126]], [[.70,105],[1.05,157],[1.40,210],[1.75,262],[2.10,315]]]]
  };
  var SPANS = [20, 30, 40, 50, 60], TEMPS = [-15, 0, 15, 30];
  F.durchhang = { grp: "o", title: "Luftkabel: Durchhang und Zugkraft", kw: /durchhang|zugkraft|montagewert|spannweite/, direct: true, intro: "Richtwerte für Durchhang und Zugkraft bei der Montage (Handbuch 4.4.1.5.4/4.4.1.5.5).",
    steps: [
      { id: "k", q: "Welches Luftkabel?", opts: Object.keys(MW).map(function (k) { return [k, MW[k][0]]; }) },
      { id: "sp", q: "Welche Spannweite?", opts: SPANS.map(function (s) { return [String(s), s + " m"]; }) },
      { id: "t", q: "Welche Temperatur bei der Montage?", opts: TEMPS.map(function (t) { return [String(t), (t > 0 ? "+" : "") + t + " °C"]; }) }
    ],
    result: function (a) {
      var m = MW[a.k], si = SPANS.indexOf(+a.sp), ti = TEMPS.indexOf(+a.t), r = m[1][ti][si], mx = m[1][4][si], f = function (v) { return String(v).replace(".", ","); };
      return { t: m[0] + ", Spannweite " + a.sp + " m, " + (+a.t > 0 ? "+" : "") + a.t + " °C:\n• Durchhang f = " + f(r[0]) + " m\n• Zugkraft F = " + f(r[1]) + " daN (1 daN = 1 kp)\nMaximalwerte mit Zusatzlast 1.3 kg/m: f = " + f(mx[0]) + " m, F = " + f(mx[1]) + " daN – für die Berechnung der Zugkräfte auf Anker/Strebe immer diese Werte einsetzen.\nHinweise: Werte sind Richtwerte (Durchhang ca. 3.5 % der Spannweite, LWL 3.5–5 %); ist ein kleinerer Durchhang nötig, darf die Zugkraft maximal auf den Wert der grössten Spannweite erhöht werden. Bei mehreren Spannweiten auf die längste regulieren; bei Höhendifferenz gelten die Zugkräfte für den oberen Abspannpunkt. Mindestbodenabstände (LeV Anhang 3) mit Zusatzlast einhalten.", s: HB + ", 4.4.1.5.4–4.4.1.5.5" }; } };

  F.luftkabel = { direct: true, grp: "o", title: "Luftkabel wählen und befestigen", kw: /luftkabel|lwl-luftkabel|gabelst(ü|ue)ck|aufhängung|aufhaengung|kette.*abspann/, intro: "Luftkabeltypen, Belegung der Regelleitung und Aufhängung (Handbuch 4.4.1.5).",
    steps: [
      { id: "sp", q: "Welche Spannweite?", opts: [["a", "höchstens 60 m"], ["b", "über 60 m"]] },
      { id: "kt", q: "Welcher Kabeltyp?", opts: [["cu", "Kupfer (Typ SK)"], ["lwl", "LWL-Luftkabel (12–144 Fasern)"]] }
    ],
    result: function (a) {
      var t = a.sp === "b" ? "Über 60 m: Luftkabel Typ J (mit integriertem Stahlseil, Tragseil je nach Zugkraft mit entsprechendem Durchmesser); Tragseil vor der Gebäudeeinführung isolieren und erden. SK/LWL-Luftkabel dürfen aus Festigkeitsgründen nicht für grössere Spannweiten als 60 m verwendet werden (Weitspannleitung, siehe Beratung)." : "Bis 60 m: Luftkabel SK bzw. LWL-Luftkabel (Regelleitung).";
      if (a.kt === "lwl") t += "\nLWL-Luftkabel 12–144 FS: dürfen bis 300 m Trassenlänge unterirdisch gezogen werden; keine Stahlseile mehr. Bei 12–72 FS Ringholzschrauben erlaubt; ab vier abgehenden und vier ankommenden Kabeln Kette für die Befestigung. Max. 11 Kabel (Kupfer und LWL zusammen) auf einer Regelleitung, auf max. 2 Kettenmontagen verteilt, alle mit gleichmässigem Zug; im Endzustand (Kupfer Phase Out) max. 10 LWL-Kabel. Zwischenaufhängung (Glasfaserkabel 48FS FKT 600/1200) nur bei geraden Trassen ohne Winkelabgänge und ohne Zugkräfte.";
      else t += "\nKupfer SK: Gabelstücke mit Aufhängebriden zwingend ab 2×2; Ringholzschraube generell nur für SK 2×2 Fawil; ab SK 6×2 Ketten bzw. Gabelstücke mit Ketten. Höhenabstände nach LeV Anhang 3 mit Zusatzlast. Verteil-/Verbindungsspleissungen: Traggeflechte und Aluminium-Abschirmungen metallisch miteinander verbinden (SKT30: Festklemmen unter den Klemmbriden); am Holzmast mit SKT immer Kette für Abspannung/Verankerung. SKT nur in speziellen Fällen mit Überspannungsableiter (siehe 4.7).";
      return { t: t + "\nSKT 2 ist kein Verteilpunkt (nur am Haus, wenn Schutzrohr zu klein bzw. bei der Netztrennstelle) und kein Grobsicherungsersatz; SKT30 Spezial für Kabel ab 30×2.", s: HB + ", 4.3, 4.4.1.4–4.4.1.5" }; } };

  F.siphon = { direct: true, grp: "o", title: "Siphon, Powering, Starkstrombeeinflussung", kw: /siphon|syphon|powering|190 ?v|starkstrom|überspannungs|ueberspannungs|exponiert|erdung.*luftkabel/, intro: "Spezielle Schutzmassnahmen (Handbuch 4.7–4.8).",
    steps: [
      { id: "th", q: "Welche Situation?", opts: [["siph", "Siphon: Freileitung wird in den Boden verlegt"], ["cu", "Unterirdische Hauseinführung CU"], ["pow", "Powering auf Freileitung (±190 V)"], ["unt", "Freileitung mit P1×2/Blankdraht wird unterbrochen"], ["exp", "Exponierte Lage (Voralpen/Berggebiet)"], ["lwl", "Gebäudemontage unterirdische Einführung LWL"]] },
      { id: "l", when: function (a) { return a.th === "siph" || a.th === "cu"; }, q: "Wie lang ist die Strecke im Boden/unterirdisch?", opts: [["k", "Kleiner als 60 m"], ["g", "Grösser als 60 m"]] }
    ],
    result: function (a) {
      var t = {
        siph: "Wird die Freileitung wegen Hindernissen (Strassen, Bäche, Flüsse, Bahnen) oder auf der letzten Strecke zum Gebäudeanschluss in den Boden verlegt, muss im Erdreich zwingend ein Erdkabel verlegt werden (Ausnahme: Luftkabel 2×2/0.6 Fawil LIGHT und LWL-Luftkabel). In der ganzen Strecke UST bis Netztrennstelle darf kein P1×2 oder Blankdraht verbaut sein – nur Luftkabel Typ SK oder J.\n" + (a.l === "k" ? "Siphon < 60 m: Erdkabel am Mast im Spleisskasten SKT aufschalten; bei der Netztrennstelle Anschlusselemente MX2000 mit UA montieren." : "Siphon > 60 m: Erdkabel beidseits im Überspannungsableiterkasten (ST oder SKT) aufschalten; im SKT MX2000 mit UA, SKT erden (Cu-Erdband 20×3, min. 10 m); bei der Netztrennstelle MX2000 mit UA. SKT gemäss «Erläuterungen für den Schwachstrom-Netzbau» erden."),
        cu: a.l === "k" ? "Unterirdische Hauseinführung < 60 m (Situation 2): Kabel am Mast im Spleisskasten SKT aufschalten." : "Unterirdische Hauseinführung > 60 m (Situation 3): Kabel am Mast im SKT aufschalten; im SKT Anschlusselemente MX2000 mit UA einsetzen; SKT erden (SKT 10). Bei bestehenden Freileitungen mit teils P1×2/Blankdraht: MX2000 mit UA im SKT, Grobsicherungen an der Netztrennstelle.",
        pow: "Powering (±190 V) auf Freileitungen (FTTx-Ausbau): Power führende Adern speziell kennzeichnen (Anforderung an die Beschriftung der Netzelemente). An allen Überführungspunkten (U, KVS-UST, SKT) werden die Power führenden Adern nicht auf der Anschlussleiste miteinander verbunden, sondern mittels Spitzspleissung (Löten). Alternativ BMX SKT 10/20 mit MX2000-Modulen ohne UA.",
        unt: "Muss eine Freileitungsstrecke mit P1×2 oder Blankdraht unterbrochen werden, ist beidseitig ein SKT zu installieren. SKT erden gemäss «Erläuterungen für den Schwachstrom-Netzbau».",
        exp: "Exponierte Lagen: Luftkabel Typ J und SK gibt es in Längen zu 1'000 m und 1'500 m. Nach ca. 1'000 m (900–1'200 m) muss ein solches Kabel durch einen Überspannungsableiterkasten (ST) geschützt werden; für den Kasten zusätzlich Erdung mit min. 10 m Kupferband (20×3 mm), Mindestwiderstand 30 Ohm. SKT nur nach Bedarf bei Leitungsabgängen.",
        lwl: "Gebäudemontage unterirdische Einführung LWL – Varianten: (1) Kabel in die bestehende Hauseinführung bis zur Netztrennstelle einziehen, Grobsicherung durch MX2000 ersetzen, wenn die ganze Strecke UST–SKT mit SK/LWL-Luftkabel gebaut ist; (2) Luftkabel abbrechen, ET-Kasten aussen oder innen montieren, P1×2/F-Kabel im Gebäude durch LWL-Luftkabel/FAWIL ersetzen; (3) ST10-Kunststoffkasten am Gebäude, Erdung ohne Blitzschutzanlage mit 20 m Kupferband (ab Gebäude 1 m im Kunststoffrohr; seitlicher Abstand zu metallischer Wasserleitung 1 m, bei Kreuzung 1 m bzw. Kunststoffrohr); (4) bestehende/neue Siphons: LWL-Luftkabel am Mast im U-Kanal, ohne Spleiss im Siphon bis zum Hausanschluss – keine speziellen Schutzmassnahmen, da LWL-Luftkabel kein Metall enthält."
      }[a.th];
      return { t: t, s: HB + ", 4.7–4.8" }; } };

  F.abbruch = { direct: true, grp: "o", title: "Mastabbruch und Entsorgung", kw: /mastabbruch|entsorgung.*(holz|mast)|abfallcode|imprägnier/, intro: "Abbruch und Entsorgung von Holzmasten (Handbuch 4.5).",
    steps: [{ id: "th", q: "Worum geht es?", opts: [["ab", "Vor dem Abbruch"], ["ent", "Entsorgung der Holzmasten"], ["tw", "Teilabbruch"]] }],
    result: function (a) { return { t: { ab: "Vor einem Abbruch klären, ob der Grundeigentümer die Masten behalten möchte; bei Abgabe von Holzmasten an Private das Merkblatt für die Wiederverwendung gebrauchter Leitungsmasten abgeben. Grobsicherungen sind Eigentum von Swisscom und in jedem Fall mit abzubrechen. Dachständer-Abbruch: siehe Beratung «Umbau/Unterhalt Freileitung».", ent: "Aus ökologischen und wirtschaftlichen Überlegungen gesunde Mastenteile an Landeigentümer oder andere abgeben (Vorgaben BUWAL und VSE). Mit Holzschutzmitteln behandeltes Holz gehört gemäss TVA seit 1.1.2017 zu den problematischen Holzabfällen, Klasse S, Abfall-Code 17 02 98; «kontrollpflichtige Abfälle» nur an Entsorgungsunternehmen übergeben (im Normalfall Rückschub an die Imprägnierwerke mit Bewilligung zur Entgegennahme, VEVA). Bandagen sind Sonderabfall, Abfallcode 15 02 02.", tw: "Bei einem Teilabbruch darauf achten, dass der bestehende Teil richtig gesichert ist, beispielsweise mit einer Verankerung." }[a.th], s: HB + ", 4.5" }; } };

  /* ===================== PROJEKT ===================== */
  F.check = { grp: "p", title: "Projekt-Check (mein Projekt)", kw: /projekt.?check|prüfe mein projekt|pruefe mein projekt|projekt prüfen/, direct: true, intro: "Ich prüfe dein aktuelles Projekt gegen die Handbuch-Richtwerte.",
    steps: [
      { id: "ers", q: "Welche Erschliessung betrifft die Zeichnung?", opts: [["basisCu", "Basis: Teilnehmerkabel Cu"], ["basisGfk", "Basis: Teilnehmerkabel GFK"], ["fkrk", "FK/RK-Trasse"], ["detail", "Detail (Schacht–UP)"]] },
      { id: "zone", q: "Wo liegt die Trasse?", opts: [["in", "In der Bauzone"], ["aus", "Ausserhalb der Bauzone"]] }
    ],
    result: function (a) {
      var S = U.D().S(), K = S.karte || {}, r = U.RICHTW[a.ers], R = a.zone === "aus" ? r[1] : r[0], out = [], f1 = function (v) { return chf(v); }, L = (K.lines || []).filter(function (l) { return l.pts && l.pts.length > 1; });
      if (!L.length && !(K.pts || []).length && !(K.geb || []).length) return { t: "In deinem Projekt gibt es noch keine gezeichneten Objekte. Öffne «Karte» und zeichne Linien, Schächte und Gebäude – dann kann ich prüfen.", s: "Projektstand" };
      var lens = L.map(function (l) { return KARTE.total([l.pts]); }), tot = lens.reduce(function (s, x) { return s + x; }, 0), over = lens.map(function (x, i) { return [x, i]; }).filter(function (x) { return x[0] > R; });
      out.push("Zeichnung: " + L.length + " Linie(n), " + f1(tot) + " m; " + (K.pts || []).length + " Schacht/Schächte; " + (K.wl || []).length + " Werkloch/-löcher; " + (K.geb || []).length + " Gebäude.");
      out.push(over.length ? "⚠ Schachtabstand: " + over.length + " Linie(n) über dem Richtwert von " + R + " m (" + r[2] + ", " + (a.zone === "aus" ? "ausserhalb" : "in der") + " Bauzone): " + over.slice(0, 5).map(function (x) { return "Linie " + (x[1] + 1) + " (" + f1(x[0]) + " m)"; }).join(", ") + (over.length > 5 ? " …" : "") + "." : "✓ Alle Linien liegen innerhalb des Richtwerts von " + R + " m.");
      var nr = L.filter(function (l) { return !(l.cfg && l.cfg.rt && Object.keys(l.cfg.rt).length) && !(l.rohr && l.rohr.dn); }).length; out.push(nr ? "⚠ " + nr + " Linie(n) ohne Rohrbelegung." : "✓ Alle Linien haben eine Rohrbelegung.");
      var ns = (K.pts || []).filter(function (p) { return !p.typ; }).length; if ((K.pts || []).length) out.push(ns ? "⚠ " + ns + " Schacht/Schächte ohne Typ." : "✓ Alle Schächte haben einen Typ.");
      var gw = (K.geb || []).filter(function (g) { return !(K.pts || []).length; }).length; if ((K.geb || []).length && !(K.pts || []).length) out.push("⚠ Gebäude vorhanden, aber kein Schacht gesetzt (max. Rohrlänge ab letztem Schacht ca. 250 m).");
      var gt = (K.geb || []).filter(function (g) { return !g.gt; }).length; if (gt) out.push("ℹ " + gt + " Gebäude ohne Gebäudetyp (zeigt die Rohrvorgabe aus 2.2.4).");
      var ks = (K.pts || []).filter(function (p) { return /^KS/.test(p.typ || ""); }).length; if (ks) out.push("ℹ " + ks + " Kontrollschacht/-schächte Ø 80: nur 1 Muffe, K55, Rohre geradlinig, kein Kabelnachzug im Schacht.");
      return { t: out.join("\n") + "\nDetails und Biegeradien: Karte → Auswertung → «Prüfung nach Handbuch».", s: HB + ", 2.2.2, 2.2.4, 2.3.3", actions: [{ l: "Richtabstand in der Karte einstellen", fn: function () { return U.setRc(a.ers, a.zone); } }] }; } };

  return F;
};
