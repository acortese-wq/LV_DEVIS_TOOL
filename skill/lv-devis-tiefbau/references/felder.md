# Feldreferenz Erfassungsmaske (automatisch erzeugt)

Alle Werte werden als **Text** gespeichert (Zahlen z. B. `"12.5"`), Ja/Nein als `true`/`false`. Felder, die nicht angegeben werden, erhalten die Vorgabe.
Zusätzlich hat jeder Datensatz `x` (weitere LV-Positionen `{"151/xxx.xxx": "Menge"}`) und `free` (freie Positionen, siehe SKILL.md).

## Graben (`recs.graben`)

| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |
|---|---|---|---|---|
| **Graben und Aushub** | | | | |
| `name` | Bezeichnung | text | `"Leitungsgraben 1"` |  |
| `L` | Länge Graben (m) | Zahl (Text) | `""` |  |
| `T` | Tiefe (m) | Zahl (Text) | `"0.60"` |  |
| `bmode` | Grabenbreite<br><i>Grundlage: VSE-Branchenempfehlung 1103d, Ziff. 3.3.1, und BauAV Art. 55.</i> | `min60` Mindestbreite 0.60 m (Tiefe über 1.00 m)<br>`begangen` Tiefe bis 1.00 m, begangen: Aussenmass + 0.40 m<br>`nicht_begangen` Tiefe bis 1.00 m, nicht begangen: Aussenmass + Verdämmung<br>`manuell` Manuell | `"min60"` |  |
| `aussen` | Aussenmass Rohr/Rohrblock (m) | Zahl (Text) | `""` | bmode === "begangen" // bmode === "nicht_begangen" |
| `bman` | Grabenbreite manuell (m) | Zahl (Text) | `"0.60"` | bmode === "manuell" |
| `aushubArt` | Aushubart | `normal` Maschine / Hand<br>`saug` Saugbagger | `"normal"` |  |
| `saugH` | Saugbagger Arbeitszeit (Stunden) | Zahl (Text) | `"0"` | aushubArt === "saug" |
| `hand` | Aushub von Hand (Anteil) | `normal` Normal (10 %)<br>`eng` Eng / Fremdleitungen (30 %)<br>`sehr_eng` Sehr eng (50 %) | `"normal"` | aushubArt !== "saug" |
| `gesp` | Wände gespriesst (Brettspriessung) | true/false | `false` |  |
| `direkt` | Direktverlad und Abtransport möglich<br><i>Ohne Direktverlad wird das Aufladen ab Zwischenlager verrechnet.</i> | true/false | `false` |  |
| `mods.ersch` | Erschwernis | true/false | `false` |  |
| `ersch.klasse` | Abbauklasse | `keine` keine<br>`5` 5<br>`6` 6<br>`7` 7 | `"keine"` | mods.ersch |
| `ersch.verf` | Verfestigte Schicht | `keine` keine<br>`gefroren` gefroren<br>`stein` stein | `"keine"` | mods.ersch |
| `ersch.hind` | Einzelhindernis | `keine` keine<br>`findling` findling<br>`fundUnbew` fundUnbew<br>`fundBew` fundBew | `"keine"` | mods.ersch |
| `ersch.hindVol` | Volumen Hindernis (m³) | Zahl (Text) | `"0.30"` | mods.ersch && ersch.hind !== "keine" |
| **Rohranlage** | | | | |
| `rohrSystem` | Rohrsystem<br><i>Längsverschluss: zum nachträglichen Einlegen bestehender Kabel. Rohrblock: Rohre gemeinsam einbetoniert, nur DN 55 und DN 100 im LV bepreist.</i> | `k55` Standard K55 (STM)<br>`laengs` Längsverschluss (Retrofit)<br>`block` Rohrblock (einbetoniert) | `"k55"` |  |
| `dn` | Rohr DN/ID | `55` 55<br>`100` 100<br>`120` 120<br>`150` 150 | `"55"` | rohrSystem === "k55" |
| `len` | Rohrlänge (m) | `5` 5<br>`10` 10 | `"10"` | rohrSystem === "k55" |
| `n` | Anzahl Rohre | Zahl (Text) | `"1"` | rohrSystem === "k55" |
| `muffenMode` | Muffen<br><i>Regel: 1 Muffe je 5 m Rohr, mal Anzahl Rohre (nach Devis-Beispiel). Manuell überschreibbar.</i> | `auto` Automatisch (vorläufig)<br>`manuell` Manuell | `"auto"` | rohrSystem === "k55" |
| `muffenN` | Anzahl Muffen | Zahl (Text) | `"0"` | isStd(c) && muffenMode === "manuell" |
| `b90` | Bogen 90° (St) | Zahl (Text) | `"0"` | rohrSystem === "k55" |
| `b45` | Bogen 45° (St) | Zahl (Text) | `"0"` | rohrSystem === "k55" |
| `schneiden` | Rohre schneiden (St) | Zahl (Text) | `"0"` | rohrSystem === "k55" |
| `dn2` | Rohr DN/ID | `100` 100<br>`120` 120<br>`150` 150 | `"100"` | rohrSystem === "laengs" |
| `n2` | Anzahl Rohre | Zahl (Text) | `"1"` | rohrSystem === "laengs" |
| `blist` | Zusammensetzung Rohrblock | bloecke `[{dn, n, lagen, len}]` | `""` | rohrSystem === "block" |
| `block.breite` | Rohrblock Aussenmass Breite (m)<br><i>Für die Massenbilanz: Aussenmass des Rohrblocks.</i> | Zahl (Text) | `"0.50"` | rohrSystem === "block" |
| `block.hoehe` | Rohrblock Aussenmass Höhe (m) | Zahl (Text) | `"0.30"` | rohrSystem === "block" |
| `warnband` | Warnband | true/false | `true` |  |
| `kalib` | Kalibrieren | true/false | `true` |  |
| `einzug` | Einzug | `keine` Keiner<br>`schnur` Schnur<br>`draht` Draht | `"schnur"` | !isBlock(c) |
| `azlist` | Abzweiger / T-Stücke | abzweiger `[{…}]` | `""` | rohrSystem === "laengs" |
| **Leitungszone und Verfüllung** | | | | |
| `umhType` | Leitungszone | `kies` Kies/Sand (Bettung, Verdämmung)<br>`beton` Beton (Zementgehalt 200 kg/m³) | `"kies"` | rohrSystem === "k55" |
| `umhMat` | Material Umhüllung | `betonkies` Betonkies 0/16<br>`sand` Sand 0/4<br>`kies48` Kies 4/8 | `"betonkies"` | isStd(c) && umhType === "kies" |
| `umhArea` | Querschnitt Leitungszone (m²/m)<br><i>Vorschlagswert; bei Bedarf überschreiben.</i> | Zahl (Text) | `"0.035"` | rohrSystem === "k55" |
| `verf` | Verfüllung<br><i>Menge = Aushub abzüglich Einbauten (LV 151, Ausmassbestimmung 026.200); durchgehend Volumen fest.</i> | `aushub` Aushubmaterial wiederverwenden<br>`kies045` Kiesgemisch 0/45 frostsicher (geliefert)<br>`kies016` Kiesgemisch 0/16 frostsicher (geliefert)<br>`betonkies` Betonkies 0/16 (geliefert) | `"aushub"` |  |
| `einfHand` | Einfüllen von Hand | true/false | `false` |  |
| **Belag** | | | | |
| `belag.mode` | Belag Bestand | `none` Kein Belag (Grünfläche)<br>`bit` Bituminöser Belag<br>`humus` Humus/Wiesland<br>`pflaster` Pflästerung/Platten | `"bit"` |  |
| `Lb` | Länge mit Belag (m, leer = ganze Länge) | Zahl (Text) | `""` | belag.mode !== "none" |
| `belag.d` | Belagsdicke Bestand (mm) | Zahl (Text) | `"130"` | belag.mode === "bit" |
| `belag.pak` | PAK-Gehalt Ausbauasphalt | `le250` bis 250 mg/kg (Deponie Typ B)<br>`gt250` über 250 mg/kg (Deponie Typ E) | `"le250"` | belag.mode === "bit" |
| `belag.einbau` | Belagseinbau | `dritte` Durch Dritte (nicht im KV)<br>`typN` Typ N, von Hand einbauen | `"typN"` | belag.mode === "bit" |
| `belag.typ` | Belagstyp | `N` Typ N (Strassenbelag)<br>`L` Typ L (Vorplätze, Zufahrten) | `"N"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.trag` | Tragschicht | `T16` AC T 16 N (bis 70 mm)<br>`T22` AC T 22 N (bis 90 mm) | `"T22"` | isTyp(c) && belag.typ !== "L" |
| `belag.dTrag` | Dicke Tragschicht (mm) | Zahl (Text) | `"90"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.deck` | Deckschicht | `AC8` AC 8 N (bis 40 mm)<br>`AC11` AC 11 N (bis 40 mm)<br>(abhängig) | `"AC8"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.deckArt` | Deckschicht einbauen | `hand` Von Hand<br>`masch` Maschinell | `"hand"` | isTyp(c) && belag.typ !== "L" |
| `belag.dDeck` | Dicke Deckschicht (mm) | Zahl (Text) | `"40"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.haft` | Haftvermittler | true/false | `true` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.naehte` | Nähte anstreichen | true/false | `true` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.fund` | Fundationsschicht (mm) | `0` Keine<br>`150` 150 mm<br>`200` 200 mm<br>`300` 300 mm | `"0"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.humus.art` | Art | `abtrag` Oberboden abtragen und anlegen<br>`rasenziegel` Rasenziegel stechen und verlegen | `"abtrag"` | belag.mode === "humus" |
| `belag.humus.dOber` | Dicke Oberboden (cm) | Zahl (Text) | `"30"` | isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.humus.hand` | Von Hand | true/false | `false` | isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.humus.ansaeen` | Ansäen (Trockensaat) | true/false | `false` | isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.pflaster.abbruchAlt` | Bestehende Pflästerung/Platten abbrechen | true/false | `false` | belag.mode === "pflaster" |
| `belag.pflaster.abbruchArt` | Art Bestand | `betonstein` Betonsteinpflästerung<br>`platten` Plattenbelag<br>`natur` Natursteinpflästerung | `"betonstein"` | isPfl(c) && belag.pflaster.abbruchAlt |
| `belag.pflaster.material` | Material neu | `betonverbund` Betonverbundstein<br>`beton` Betonplatten<br>`natur` Natursteinplatten | `"betonverbund"` | belag.mode === "pflaster" |
| `belag.pflaster.dicke` | Stein-/Plattendicke (mm) | `60` 60<br>`80` 80<br>(abhängig) | `"60"` | belag.mode === "pflaster" |
| `belag.pflaster.fund` | Fundationsschicht (mm) | `0` Keine<br>`150` 150 mm<br>`200` 200 mm<br>`300` 300 mm | `"200"` | belag.mode === "pflaster" |
| `belag.pflaster.randNeu` | Randabschluss (Bund-/Wassersteine) neu | true/false | `false` | belag.mode === "pflaster" |
| `belag.pflaster.randMat` | Material Randstein | `gneis` Gneis<br>`granit` Granit | `"gneis"` | isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randTyp` | Typ Randstein | `8/11` 8/11<br>`11/13` 11/13 | `"8/11"` | isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randLaenge` | Länge Randabschluss (m) | Zahl (Text) | `""` | isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randAbbruch` | Bestehenden Randstein abbrechen | true/false | `false` | isPfl(c) && belag.pflaster.randNeu |
| **Zusätze (Grabenübergänge, Abschlüsse)** | | | | |
| `uF` | Grabenübergang Fussgänger [St] | Zahl (Text) | `""` |  |
| `uP` | Grabenübergang PKW bis 3.5 t [St] | Zahl (Text) | `""` |  |
| `uL` | Grabenübergang LKW bis 28 t [St] | Zahl (Text) | `""` |  |
| `aB` | Bundstein ersetzen [m] | Zahl (Text) | `""` |  |
| `aW` | Bund-/Wasserstein ersetzen [m] | Zahl (Text) | `""` |  |
| `aS` | Stellplatten ersetzen [m] | Zahl (Text) | `""` |  |
| `aR` | Randstein ersetzen [m] | Zahl (Text) | `""` |  |
| **Fremdleitungen und Böschung** | | | | |
| `mods.fremd` | Fremdleitung / Zores | true/false | `false` |  |
| `kreuz.on` | Kreuzung Fremdleitung sichern/schützen | true/false | `true` | mods.fremd |
| `kreuz.richtung` | Lage | `laengs` laengs<br>`quer` quer | `"quer"` | mods.fremd && kreuz.on |
| `kreuz.n` | Anzahl Kreuzungen | Zahl (Text) | `"1"` | mods.fremd && kreuz.on |
| `kreuz.len` | Länge je Kreuzung (m) | Zahl (Text) | `"1.00"` | mods.fremd && kreuz.on |
| `zores.on` | Alten Kabelkanal (Zores) rückbauen | true/false | `false` | mods.fremd |
| `zores.zustand` | Zustand | `abrechen` abrechen<br>`betrieb` betrieb<br>`nicht` nicht | `"abrechen"` | mods.fremd && zores.on |
| `zores.len` | Länge Zores (m) | Zahl (Text) | `"0"` | mods.fremd && zores.on |
| `mods.boesch` | Böschungsschutz | true/false | `false` |  |
| `boeschung.flaeche` | Fläche Böschungsschutz (m²) | Zahl (Text) | `""` | mods.boesch |
| `boeschung.geneigt` | Neigung über 1:4 | true/false | `false` | mods.boesch |

## Rohr (`recs.rohr`)

| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |
|---|---|---|---|---|
| **Rohre und Formstücke (Auswahlliste → LV-Position)** | | | | |
| `name` | Bezeichnung | text | `"Rohranlage 1"` |  |
| `verl` | Rohre inkl. Verlegen bestellen | true/false | `true` |  |
| rohre / schn / boe / muf | Listen `[{typ, q}]` | siehe Abschnitt Rohr-Kataloge | | |
| `erd` | Erdband [m] | Zahl (Text) | `""` |  |
| `warn` | Warnband [m] | Zahl (Text) | `""` |  |
| `schnur` | Schnur einziehen [m] | Zahl (Text) | `""` |  |
| `kal` | Kalibrieren [m] | Zahl (Text) | `""` |  |
| `kalDN` | Kalibrieren DN | `55` 55<br>`100` 100<br>`120` 120<br>`150` 150 | `"55"` |  |

## Schacht (`recs.schacht`)

| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |
|---|---|---|---|---|
| **Schacht und Grube** | | | | |
| `name` | Bezeichnung | text | `"Schacht 1"` |  |
| `modus` | Modus | `neu` Neuer Schacht<br>`ersatz` Abdeckung ersetzen<br>`deckel` Bestehenden Schacht anpassen (Deckel) | `"neu"` |  |
| `deckelRichtung` | Richtung | `hoeher` Höhersetzen<br>`tiefer` Tiefersetzen | `"hoeher"` | modus === "deckel" |
| `deckelFormat` | Format | `rund` Rund (⌀ 400–800 mm)<br>`rechteckig` Rechteckig (bis 2.40 × 1.40 m) | `"rund"` | modus === "deckel" |
| `deckelN` | Anzahl | Zahl (Text) | `"0"` | modus === "deckel" |
| `einbauort` | Einbauort / Strassentyp<br><i>Steuert, welcher Schachttyp und welche Rahmen/Deckel hier üblich sind (Auswahlschema Schachtbau und Abdeckungen, 27.03.2026).</i> | `HLS` Hochleistungsstrasse HLS  ·  ≥ 80 km/h<br>`HVS` Hauptverkehrsstrasse HVS  ·  ≥ 60 km/h<br>`VS50` Verbindungsstrasse VS, ≥ 50 km/h  ·  ≥ 50 km/h<br>`VS49` Verbindungsstrasse VS, < 50 km/h  ·  < 50 km/h<br>`SS` Sammelstrasse SS  ·  ≤ 50 km/h<br>`ESS` Erschliessungsstrasse ES  ·  ≤ 50 km/h<br>`GEH` Gehweg / Trottoir / Vorplatz<br>`WIES` Wiesland / Parzelle | `"SS"` | modus !== "deckel" |
| `typ` | Schachttyp<br><i>Aussenmasse und Arbeitsraum sind Standardvorschläge (überschreibbar über den Arbeitsraum).</i> | `KS80U` KS Kontrollschacht DN 800, überdeckt (Tiefe bis 0.50 m)<br>`KS80H` KS Kontrollschacht DN 800, hochgezogen (Tiefe bis 1.00 m)<br>`KES100` KES 1.00 × 1.00 × 1.35 m<br>`KES150` KES 1.50 × 1.00 × 1.35 m<br>`KES175` KES 1.50 × 1.00 × 1.75 m<br>`ES300` ES 3.00 × 1.50 × 2.00 m<br>`PLS1` Umbau Plattenschacht 1.00 × 1.00 × 1.00 m<br>`PLS2` Umbau Plattenschacht 1.00 × 1.50 × 1.30 m<br>`PLS3` Umbau Plattenschacht 1.00 × 2.00 × 1.30 m | `"KES150"` | modus !== "deckel" |
| `n` | Anzahl Schächte | Zahl (Text) | `"0"` | modus !== "deckel" |
| `alt` | Bestehende Abdeckung (Abbruch) | `guss` Guss rund bis NW 800<br>`beton` Beton rund bis NW 800<br>`flaeche` Rechteckig Beton/Guss bis 3 m² | `"guss"` | modus === "ersatz" |
| `arbeit` | Arbeitsraum je Seite (m) | `0.30` 0.30<br>`0.50` 0.50<br>`0.75` 0.75 | `"0.50"` | modus === "neu" |
| `hand` | Aushub von Hand (Anteil) | `normal` Normal (10 %)<br>`eng` Eng / Fremdleitungen (30 %)<br>`sehr_eng` Sehr eng (50 %) | `"normal"` | modus === "neu" |
| `direkt` | Direktverlad und Abtransport möglich<br><i>Ohne Direktverlad wird das Aufladen ab Zwischenlager verrechnet.</i> | true/false | `true` | modus === "neu" |
| `mods.ersch` | Erschwernis | true/false | `false` | modus === "neu" |
| `ersch.klasse` | Abbauklasse | `keine` keine<br>`5` 5<br>`6` 6<br>`7` 7 | `"keine"` | modus === "neu" && mods.ersch |
| `ersch.verf` | Verfestigte Schicht | `keine` keine<br>`gefroren` gefroren<br>`stein` stein | `"keine"` | modus === "neu" && mods.ersch |
| `ersch.hind` | Einzelhindernis | `keine` keine<br>`findling` findling<br>`fundUnbew` fundUnbew<br>`fundBew` fundBew | `"keine"` | modus === "neu" && mods.ersch |
| `ersch.hindVol` | Volumen Hindernis (m³) | Zahl (Text) | `"0.30"` | modus === "neu" && mods.ersch && ersch.hind !== "keine" |
| **Abdeckung und Abbruch** | | | | |
| `shape` | Deckelform | `eckig` Eckig<br>`rund` Rund | `"eckig"` | notDeckel(c) && k !== "KS" && !(k === "PLS" && isNeu(c)) |
| `sys` | Rahmensystem rund | `nivo` Mit Nivo (höhenverstellbar)<br>`ds` Ohne Nivo (DS 600)<br>`gross130` 130 × 130 (Sonderlösung)<br>(abhängig) | `"nivo"` | notDeckel(c) && curShape(c) === "rund" && !(kindOf(c) === "PLS" && isNeu(c)) |
| `deckelFormat2` | Format Rahmen/Deckel<br><i>Rahmen und Deckel werden aus Einbauort, Format und Sockel automatisch bestimmt.</i> | `90` 0.90 × 0.90 m (einteilig)<br>`180` 1.80 × 0.90 m (zweiteilig) | `"90"` | notDeckel(c) && curShape(c) === "eckig" && l && l.cover !== "platte" && !(kindOf(c) === "PLS" && isNeu(c)) |
| `deckelSockel` | Betonsockel | `ohne` Ohne Sockel<br>`mit` Mit Sockel | `"ohne"` | notDeckel(c) && curShape(c) === "eckig" && l && l.cover !== "platte" && !(kindOf(c) === "PLS" && isNeu(c)) |
| `rahmen` | Rahmen / Abdeckung<br><i>Nur bei Wiesland ohne eindeutige Standardzuordnung: Liste zeigt ausschliesslich zur Schachtform und zum Einbauort passende Flächenabdeckungen.</i> | LV-Pos. 151/632.1xx oder "" | `""` | notDeckel(c) && curShape(c) === "eckig" && (!l // l.cover === "platte") && !(kindOf(c) === "PLS" && isNeu(c)) |
| `deckel` | Zusätzlicher Deckel | LV-Pos. 151/632.1xx oder "" | `""` | notDeckel(c) && curShape(c) === "eckig" && (!l // l.cover === "platte") && !(kindOf(c) === "PLS" && isNeu(c)) |
| `spare` | Deckelersatz 0.60 × 0.90 [St]<br><i>Nur für bestehende BGS-Rahmen 120 × 90 cm.</i> | Zahl (Text) | `"0"` | modus !== "deckel" |
| `anschl` | Leitungsanschlüsse (je Schacht) | Zahl (Text) | `"0"` | modus === "neu" |
| `anDN` | Anschluss bis DN | `80` 80<br>`150` 150 | `"80"` | modus === "neu" |
| `beton` | Betonabbruch (m³ je Schacht) | Zahl (Text) | `"0"` | modus === "neu" |
| `platten` | Abdeckplatten entfernen (St) | Zahl (Text) | `"0"` | modus === "neu" |
| **Leitungszone und Verfüllung** | | | | |
| `verf` | Verfüllung<br><i>Menge = Aushub abzüglich Einbauten (LV 151, Ausmassbestimmung 026.200); durchgehend Volumen fest.</i> | `aushub` Aushubmaterial wiederverwenden<br>`kies045` Kiesgemisch 0/45 frostsicher (geliefert)<br>`kies016` Kiesgemisch 0/16 frostsicher (geliefert)<br>`betonkies` Betonkies 0/16 (geliefert) | `"kies045"` | modus === "neu" |
| `einfHand` | Einfüllen von Hand | true/false | `true` | modus === "neu" |
| **Belag** | | | | |
| `belag.mode` | Belag Bestand | `none` Kein Belag (Grünfläche)<br>`bit` Bituminöser Belag<br>`humus` Humus/Wiesland<br>`pflaster` Pflästerung/Platten | `"bit"` | modus === "neu" |
| `belag.d` | Belagsdicke Bestand (mm) | Zahl (Text) | `"130"` | modus === "neu" && belag.mode === "bit" |
| `belag.pak` | PAK-Gehalt Ausbauasphalt | `le250` bis 250 mg/kg (Deponie Typ B)<br>`gt250` über 250 mg/kg (Deponie Typ E) | `"le250"` | modus === "neu" && belag.mode === "bit" |
| `belag.einbau` | Belagseinbau | `dritte` Durch Dritte (nicht im KV)<br>`typN` Typ N, von Hand einbauen | `"typN"` | modus === "neu" && belag.mode === "bit" |
| `belag.typ` | Belagstyp | `N` Typ N (Strassenbelag)<br>`L` Typ L (Vorplätze, Zufahrten) | `"N"` | modus === "neu" && belag.mode === "bit" && belag.einbau === "typN" |
| `belag.trag` | Tragschicht | `T16` AC T 16 N (bis 70 mm)<br>`T22` AC T 22 N (bis 90 mm) | `"T22"` | modus === "neu" && isTyp(c) && belag.typ !== "L" |
| `belag.dTrag` | Dicke Tragschicht (mm) | Zahl (Text) | `"90"` | modus === "neu" && belag.mode === "bit" && belag.einbau === "typN" |
| `belag.deck` | Deckschicht | `AC8` AC 8 N (bis 40 mm)<br>`AC11` AC 11 N (bis 40 mm)<br>(abhängig) | `"AC8"` | modus === "neu" && belag.mode === "bit" && belag.einbau === "typN" |
| `belag.deckArt` | Deckschicht einbauen | `hand` Von Hand<br>`masch` Maschinell | `"hand"` | modus === "neu" && isTyp(c) && belag.typ !== "L" |
| `belag.dDeck` | Dicke Deckschicht (mm) | Zahl (Text) | `"40"` | modus === "neu" && belag.mode === "bit" && belag.einbau === "typN" |
| `belag.haft` | Haftvermittler | true/false | `true` | modus === "neu" && belag.mode === "bit" && belag.einbau === "typN" |
| `belag.naehte` | Nähte anstreichen | true/false | `true` | modus === "neu" && belag.mode === "bit" && belag.einbau === "typN" |
| `belag.fund` | Fundationsschicht (mm) | `0` Keine<br>`150` 150 mm<br>`200` 200 mm<br>`300` 300 mm | `"0"` | modus === "neu" && belag.mode === "bit" && belag.einbau === "typN" |
| `belag.humus.art` | Art | `abtrag` Oberboden abtragen und anlegen<br>`rasenziegel` Rasenziegel stechen und verlegen | `"abtrag"` | modus === "neu" && belag.mode === "humus" |
| `belag.humus.dOber` | Dicke Oberboden (cm) | Zahl (Text) | `"30"` | modus === "neu" && isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.humus.hand` | Von Hand | true/false | `false` | modus === "neu" && isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.humus.ansaeen` | Ansäen (Trockensaat) | true/false | `false` | modus === "neu" && isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.pflaster.abbruchAlt` | Bestehende Pflästerung/Platten abbrechen | true/false | `false` | modus === "neu" && belag.mode === "pflaster" |
| `belag.pflaster.abbruchArt` | Art Bestand | `betonstein` Betonsteinpflästerung<br>`platten` Plattenbelag<br>`natur` Natursteinpflästerung | `"betonstein"` | modus === "neu" && isPfl(c) && belag.pflaster.abbruchAlt |
| `belag.pflaster.material` | Material neu | `betonverbund` Betonverbundstein<br>`beton` Betonplatten<br>`natur` Natursteinplatten | `"betonverbund"` | modus === "neu" && belag.mode === "pflaster" |
| `belag.pflaster.dicke` | Stein-/Plattendicke (mm) | `60` 60<br>`80` 80<br>(abhängig) | `"60"` | modus === "neu" && belag.mode === "pflaster" |
| `belag.pflaster.fund` | Fundationsschicht (mm) | `0` Keine<br>`150` 150 mm<br>`200` 200 mm<br>`300` 300 mm | `"200"` | modus === "neu" && belag.mode === "pflaster" |
| `belag.pflaster.randNeu` | Randabschluss (Bund-/Wassersteine) neu | true/false | `false` | modus === "neu" && belag.mode === "pflaster" |
| `belag.pflaster.randMat` | Material Randstein | `gneis` Gneis<br>`granit` Granit | `"gneis"` | modus === "neu" && isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randTyp` | Typ Randstein | `8/11` 8/11<br>`11/13` 11/13 | `"8/11"` | modus === "neu" && isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randLaenge` | Länge Randabschluss (m) | Zahl (Text) | `""` | modus === "neu" && isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randAbbruch` | Bestehenden Randstein abbrechen | true/false | `false` | modus === "neu" && isPfl(c) && belag.pflaster.randNeu |
| **Zusatzpositionen Schacht** | | | | |
| **Abweichung / Sonderfreigabe** | | | | |
| `deviate` | Abweichung vom Standard ist bewusst gewählt | true/false | `false` | modus !== "deckel" |
| `reason` | Begründung (Betrieb, Platzverhältnisse, Auflagen) | text | `""` | modus !== "deckel" |
| `approver` | Freigabe durch (Name, Funktion) | text | `""` | modus !== "deckel" |
| `journal` | Im Baujournal dokumentiert und im Inventar erfasst | true/false | `false` | modus !== "deckel" |

## Werkloch (`recs.werkloch`)

| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |
|---|---|---|---|---|
| **Werklöcher (Masse unter Annahmen)** | | | | |
| `name` | Bezeichnung | text | `"Werklöcher 1"` |  |
| `ts` | T-Stück [St] | Zahl (Text) | `""` |  |
| `bo` | Bogen [St] | Zahl (Text) | `""` |  |
| `sg` | Spleissgrube [St] | Zahl (Text) | `""` |  |
| `zs` | Zugschlitz [St] | Zahl (Text) | `""` |  |
| **Individuelles Werkloch** | | | | |
| `iL` | Länge [m] | Zahl (Text) | `""` |  |
| `iB` | Breite [m] | Zahl (Text) | `""` |  |
| `iT` | Tiefe [m] | Zahl (Text) | `""` |  |
| **Plattenschacht öffnen und schliessen [St]** | | | | |
| `p0` | PS 1.00 × 1.00 m | Zahl (Text) | `""` |  |
| `p1` | PS 1.50 × 1.00 m | Zahl (Text) | `""` |  |
| `p2` | PS 2.00 × 1.00 m | Zahl (Text) | `""` |  |
| `p3` | PS 2.60 × 1.00 m | Zahl (Text) | `""` |  |
| **Graben und Aushub** | | | | |
| `arbeit` | Arbeitsraum je Seite (m) | `0.30` 0.30<br>`0.50` 0.50<br>`0.75` 0.75 | `"0.30"` |  |
| `hand` | Aushub von Hand (Anteil) | `normal` Normal (10 %)<br>`eng` Eng / Fremdleitungen (30 %)<br>`sehr_eng` Sehr eng (50 %) | `"normal"` |  |
| `direkt` | Direktverlad und Abtransport möglich<br><i>Ohne Direktverlad wird das Aufladen ab Zwischenlager verrechnet.</i> | true/false | `false` |  |
| `mods.ersch` | Erschwernis | true/false | `false` |  |
| `ersch.klasse` | Abbauklasse | `keine` keine<br>`5` 5<br>`6` 6<br>`7` 7 | `"keine"` | mods.ersch |
| `ersch.verf` | Verfestigte Schicht | `keine` keine<br>`gefroren` gefroren<br>`stein` stein | `"keine"` | mods.ersch |
| `ersch.hind` | Einzelhindernis | `keine` keine<br>`findling` findling<br>`fundUnbew` fundUnbew<br>`fundBew` fundBew | `"keine"` | mods.ersch |
| `ersch.hindVol` | Volumen Hindernis (m³) | Zahl (Text) | `"0.30"` | mods.ersch && ersch.hind !== "keine" |
| **Leitungszone und Verfüllung** | | | | |
| `verf` | Verfüllung<br><i>Menge = Aushub abzüglich Einbauten (LV 151, Ausmassbestimmung 026.200); durchgehend Volumen fest.</i> | `aushub` Aushubmaterial wiederverwenden<br>`kies045` Kiesgemisch 0/45 frostsicher (geliefert)<br>`kies016` Kiesgemisch 0/16 frostsicher (geliefert)<br>`betonkies` Betonkies 0/16 (geliefert) | `"aushub"` |  |
| `einfHand` | Einfüllen von Hand | true/false | `false` |  |
| **Belag** | | | | |
| `belag.mode` | Belag Bestand | `none` Kein Belag (Grünfläche)<br>`bit` Bituminöser Belag<br>`humus` Humus/Wiesland<br>`pflaster` Pflästerung/Platten | `"bit"` |  |
| `belag.d` | Belagsdicke Bestand (mm) | Zahl (Text) | `"130"` | belag.mode === "bit" |
| `belag.pak` | PAK-Gehalt Ausbauasphalt | `le250` bis 250 mg/kg (Deponie Typ B)<br>`gt250` über 250 mg/kg (Deponie Typ E) | `"le250"` | belag.mode === "bit" |
| `belag.einbau` | Belagseinbau | `dritte` Durch Dritte (nicht im KV)<br>`typN` Typ N, von Hand einbauen | `"typN"` | belag.mode === "bit" |
| `belag.typ` | Belagstyp | `N` Typ N (Strassenbelag)<br>`L` Typ L (Vorplätze, Zufahrten) | `"N"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.trag` | Tragschicht | `T16` AC T 16 N (bis 70 mm)<br>`T22` AC T 22 N (bis 90 mm) | `"T22"` | isTyp(c) && belag.typ !== "L" |
| `belag.dTrag` | Dicke Tragschicht (mm) | Zahl (Text) | `"90"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.deck` | Deckschicht | `AC8` AC 8 N (bis 40 mm)<br>`AC11` AC 11 N (bis 40 mm)<br>(abhängig) | `"AC8"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.deckArt` | Deckschicht einbauen | `hand` Von Hand<br>`masch` Maschinell | `"hand"` | isTyp(c) && belag.typ !== "L" |
| `belag.dDeck` | Dicke Deckschicht (mm) | Zahl (Text) | `"40"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.haft` | Haftvermittler | true/false | `true` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.naehte` | Nähte anstreichen | true/false | `true` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.fund` | Fundationsschicht (mm) | `0` Keine<br>`150` 150 mm<br>`200` 200 mm<br>`300` 300 mm | `"0"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.humus.art` | Art | `abtrag` Oberboden abtragen und anlegen<br>`rasenziegel` Rasenziegel stechen und verlegen | `"abtrag"` | belag.mode === "humus" |
| `belag.humus.dOber` | Dicke Oberboden (cm) | Zahl (Text) | `"30"` | isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.humus.hand` | Von Hand | true/false | `false` | isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.humus.ansaeen` | Ansäen (Trockensaat) | true/false | `false` | isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.pflaster.abbruchAlt` | Bestehende Pflästerung/Platten abbrechen | true/false | `false` | belag.mode === "pflaster" |
| `belag.pflaster.abbruchArt` | Art Bestand | `betonstein` Betonsteinpflästerung<br>`platten` Plattenbelag<br>`natur` Natursteinpflästerung | `"betonstein"` | isPfl(c) && belag.pflaster.abbruchAlt |
| `belag.pflaster.material` | Material neu | `betonverbund` Betonverbundstein<br>`beton` Betonplatten<br>`natur` Natursteinplatten | `"betonverbund"` | belag.mode === "pflaster" |
| `belag.pflaster.dicke` | Stein-/Plattendicke (mm) | `60` 60<br>`80` 80<br>(abhängig) | `"60"` | belag.mode === "pflaster" |
| `belag.pflaster.fund` | Fundationsschicht (mm) | `0` Keine<br>`150` 150 mm<br>`200` 200 mm<br>`300` 300 mm | `"200"` | belag.mode === "pflaster" |
| `belag.pflaster.randNeu` | Randabschluss (Bund-/Wassersteine) neu | true/false | `false` | belag.mode === "pflaster" |
| `belag.pflaster.randMat` | Material Randstein | `gneis` Gneis<br>`granit` Granit | `"gneis"` | isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randTyp` | Typ Randstein | `8/11` 8/11<br>`11/13` 11/13 | `"8/11"` | isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randLaenge` | Länge Randabschluss (m) | Zahl (Text) | `""` | isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randAbbruch` | Bestehenden Randstein abbrechen | true/false | `false` | isPfl(c) && belag.pflaster.randNeu |

## Fundamente (`recs.fund`)

| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |
|---|---|---|---|---|
| **Fundament und Gehäuse** | | | | |
| `name` | Bezeichnung | text | `"Fundament 1"` |  |
| `vk` | VK Neubau | `` — keine —<br>`CAB 1-3 L` CAB 1-3 L | `""` |  |
| `kvs` | KVS Neubau | `` — keine —<br>`C 50` C 50 | `""` |  |
| `arbeit` | Arbeitsraum je Seite (m) | `0.30` 0.30<br>`0.50` 0.50<br>`0.75` 0.75 | `"0.30"` |  |
| `hand` | Aushub von Hand (Anteil) | `normal` Normal (10 %)<br>`eng` Eng / Fremdleitungen (30 %)<br>`sehr_eng` Sehr eng (50 %) | `"normal"` |  |
| `direkt` | Direktverlad und Abtransport möglich<br><i>Ohne Direktverlad wird das Aufladen ab Zwischenlager verrechnet.</i> | true/false | `false` |  |
| `mods.ersch` | Erschwernis | true/false | `false` |  |
| `ersch.klasse` | Abbauklasse | `keine` keine<br>`5` 5<br>`6` 6<br>`7` 7 | `"keine"` | mods.ersch |
| `ersch.verf` | Verfestigte Schicht | `keine` keine<br>`gefroren` gefroren<br>`stein` stein | `"keine"` | mods.ersch |
| `ersch.hind` | Einzelhindernis | `keine` keine<br>`findling` findling<br>`fundUnbew` fundUnbew<br>`fundBew` fundBew | `"keine"` | mods.ersch |
| `ersch.hindVol` | Volumen Hindernis (m³) | Zahl (Text) | `"0.30"` | mods.ersch && ersch.hind !== "keine" |
| **Leitungszone und Verfüllung** | | | | |
| `verf` | Verfüllung<br><i>Menge = Aushub abzüglich Einbauten (LV 151, Ausmassbestimmung 026.200); durchgehend Volumen fest.</i> | `aushub` Aushubmaterial wiederverwenden<br>`kies045` Kiesgemisch 0/45 frostsicher (geliefert)<br>`kies016` Kiesgemisch 0/16 frostsicher (geliefert)<br>`betonkies` Betonkies 0/16 (geliefert) | `"kies045"` |  |
| `einfHand` | Einfüllen von Hand | true/false | `false` |  |
| **Belag** | | | | |
| `belag.mode` | Belag Bestand | `none` Kein Belag (Grünfläche)<br>`bit` Bituminöser Belag<br>`humus` Humus/Wiesland<br>`pflaster` Pflästerung/Platten | `"none"` |  |
| `belag.d` | Belagsdicke Bestand (mm) | Zahl (Text) | `"130"` | belag.mode === "bit" |
| `belag.pak` | PAK-Gehalt Ausbauasphalt | `le250` bis 250 mg/kg (Deponie Typ B)<br>`gt250` über 250 mg/kg (Deponie Typ E) | `"le250"` | belag.mode === "bit" |
| `belag.einbau` | Belagseinbau | `dritte` Durch Dritte (nicht im KV)<br>`typN` Typ N, von Hand einbauen | `"typN"` | belag.mode === "bit" |
| `belag.typ` | Belagstyp | `N` Typ N (Strassenbelag)<br>`L` Typ L (Vorplätze, Zufahrten) | `"N"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.trag` | Tragschicht | `T16` AC T 16 N (bis 70 mm)<br>`T22` AC T 22 N (bis 90 mm) | `"T22"` | isTyp(c) && belag.typ !== "L" |
| `belag.dTrag` | Dicke Tragschicht (mm) | Zahl (Text) | `"90"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.deck` | Deckschicht | `AC8` AC 8 N (bis 40 mm)<br>`AC11` AC 11 N (bis 40 mm)<br>(abhängig) | `"AC8"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.deckArt` | Deckschicht einbauen | `hand` Von Hand<br>`masch` Maschinell | `"hand"` | isTyp(c) && belag.typ !== "L" |
| `belag.dDeck` | Dicke Deckschicht (mm) | Zahl (Text) | `"40"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.haft` | Haftvermittler | true/false | `true` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.naehte` | Nähte anstreichen | true/false | `true` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.fund` | Fundationsschicht (mm) | `0` Keine<br>`150` 150 mm<br>`200` 200 mm<br>`300` 300 mm | `"0"` | belag.mode === "bit" && belag.einbau === "typN" |
| `belag.humus.art` | Art | `abtrag` Oberboden abtragen und anlegen<br>`rasenziegel` Rasenziegel stechen und verlegen | `"abtrag"` | belag.mode === "humus" |
| `belag.humus.dOber` | Dicke Oberboden (cm) | Zahl (Text) | `"30"` | isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.humus.hand` | Von Hand | true/false | `false` | isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.humus.ansaeen` | Ansäen (Trockensaat) | true/false | `false` | isHumus(c) && belag.humus.art !== "rasenziegel" |
| `belag.pflaster.abbruchAlt` | Bestehende Pflästerung/Platten abbrechen | true/false | `false` | belag.mode === "pflaster" |
| `belag.pflaster.abbruchArt` | Art Bestand | `betonstein` Betonsteinpflästerung<br>`platten` Plattenbelag<br>`natur` Natursteinpflästerung | `"betonstein"` | isPfl(c) && belag.pflaster.abbruchAlt |
| `belag.pflaster.material` | Material neu | `betonverbund` Betonverbundstein<br>`beton` Betonplatten<br>`natur` Natursteinplatten | `"betonverbund"` | belag.mode === "pflaster" |
| `belag.pflaster.dicke` | Stein-/Plattendicke (mm) | `60` 60<br>`80` 80<br>(abhängig) | `"60"` | belag.mode === "pflaster" |
| `belag.pflaster.fund` | Fundationsschicht (mm) | `0` Keine<br>`150` 150 mm<br>`200` 200 mm<br>`300` 300 mm | `"200"` | belag.mode === "pflaster" |
| `belag.pflaster.randNeu` | Randabschluss (Bund-/Wassersteine) neu | true/false | `false` | belag.mode === "pflaster" |
| `belag.pflaster.randMat` | Material Randstein | `gneis` Gneis<br>`granit` Granit | `"gneis"` | isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randTyp` | Typ Randstein | `8/11` 8/11<br>`11/13` 11/13 | `"8/11"` | isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randLaenge` | Länge Randabschluss (m) | Zahl (Text) | `""` | isPfl(c) && belag.pflaster.randNeu |
| `belag.pflaster.randAbbruch` | Bestehenden Randstein abbrechen | true/false | `false` | isPfl(c) && belag.pflaster.randNeu |

## Gebäudeeinführung (`recs.geb`)

| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |
|---|---|---|---|---|
| **Gebäudeeinführung** | | | | |
| `name` | Bezeichnung | text | `"Gebäudeeinführung 1"` |  |
| `n` | Anzahl Einführungen [St] | Zahl (Text) | `""` |  |
| `cm` | Kernbohrung Ø 70 mm – Wandstärke total [cm] | Zahl (Text) | `""` |  |
| `abd` | Art der Abdichtung | `keine` Keine<br>`kissen` Kissen aufblasbar<br>`hauff` Hauff-Dichtung | `"hauff"` |  |

## Belag (`recs.belag`)

| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |
|---|---|---|---|---|
| **Wiederinstandsetzung nach Swisscom-Typ** | | | | |
| `name` | Bezeichnung | text | `"Belagsarbeiten 1"` |  |
| `indiv` | Belag mit individuellen LV-Positionen bestellen<br><i>Alle Positionen dieses Reiters werden auf den Kostensammler Belag gebucht (in der Aufstellung mit B markiert).</i> | `false` Nein<br>`true` Ja | `false` |  |
| `bk` | Baukörper | `gehweg` Gehweg / Vorplatz<br>`strasse` Strasse<br>`kanton` Kantonsstrasse | `"gehweg"` | String(indiv) !== "true" |
| `d` | Belagsdicke [m] | Zahl (Text) | `"0.08"` | String(indiv) !== "true" |
| `B` | Breite Belagseinbau [m] | Zahl (Text) | `""` | String(indiv) !== "true" |
| `L` | Länge Belagseinbau [m] | Zahl (Text) | `""` | String(indiv) !== "true" |
| `wi` | Typ | `A` A – Kaltmischbelag, Oberbau, Belag in einer Etappe<br>`A1` A1 – Oberbau, anschliessend Belag in einer Etappe<br>`B` B – AC T und AC in einer Etappe<br>(abhängig) | `"B"` | String(indiv) !== "true" |

## Allgemein (`recs.allg`)

| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |
|---|---|---|---|---|
| **Vorarbeiten (projektweit)** | | | | |
| `(global) sond.m3` | Sondieraushub (m³) | Zahl (Text) | `""` |  |
| `(global) sond.einfHand` | Wiedereinfüllen von Hand | true/false | `false` |  |
| `(global) wasser.h` | Wasserhaltung (Pumpenstunden) | Zahl (Text) | `""` |  |
| `(global) wasser.sumpf` | Pumpensümpfe (Anzahl) | Zahl (Text) | `""` |  |
| **Baustelleneinrichtung (projektweit)** | | | | |
| `(global) be.pct` | Baustelleneinrichtung (% der Zwischensumme)<br><i>Wird auf die Zwischensumme ohne Baustelleneinrichtung berechnet. Weitere Positionen (Übergänge, Lichtsignal, Verkehrsdienst, Leitbaken, Baustellenleuchten) über die freie Positionssuche hinzufügen – sie erscheinen automatisch hier.</i> | Zahl (Text) | `""` |  |
| **Pauschalen (dieser Datensatz)** | | | | |
| `name` | Bezeichnung | text | `"Allgemein 1"` |  |
| `km` | Kleinmaterial [CHF] | Zahl (Text) | `""` |  |
| `ak` | Akkordarbeiten [CHF] | Zahl (Text) | `""` |  |

## Ingenieurhonorar (`recs.hon`)

| Feld | Bezeichnung | Typ / Werte | Vorgabe | sichtbar wenn |
|---|---|---|---|---|
| **Aufwandbestimmende Baukosten B** | | | | |
| `name` | Bezeichnung | text | `"Ingenieurhonorar 1"` |  |
| `src` | Quelle<br><i>Ba = aufwandbestimmende Baukosten nach Abzug der vertraglichen Rabatte, exkl. MWST (SIA 103-K Art. 7.5.1). «aus LV» übernimmt das LV-Netto exkl. MWST.</i> | `lv` aus LV (Netto exkl. MWST)<br>`man` manuell | `"lv"` |  |
| **Faktoren (SIA 103-K 2018)** | | | | |
| `n` | n Schwierigkeitsgrad | Zahl (Text) | `"1.0"` |  |
| `r` | r Anpassungsfaktor | Zahl (Text) | `"1.0"` |  |
| **Teilphasen SIA 103 / Leistungsanteil q (SIA 103-K Art. 7.7, fest)** | | | | |
| `gl` | Gesamtleitung inkl. Oberbauleitung (+10 % von q)<br><i>SIA 103-K Art. 7.7.6: in der Regel nach Aufwand, zirka 10 % der Leistungsanteile q.</i> | true/false | `false` |  |
| **Auftragsbezogen zu vereinbaren** | | | | |
| `h` | h Stundenansatz [CHF/h] | Zahl (Text) | `""` |  |
| `nk` | Nebenkosten [% Honorar] | Zahl (Text) | `""` |  |
