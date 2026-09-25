# -*- coding: utf-8 -*-
"""Positionstexte LV IT TB Kopa 2026 (V1.0, 27.06.2026), übertragen aus dem vom Nutzer bereitgestellten Text.
Struktur: Hauptposition -> (Titel, Unterüberschriften {nr: text}, Positionen {nr: (text, preis)})"""
IT = {
# ---------------- 111 Lavori a regia ----------------
"111/112": ("Prezzi a regia orari dell'imprenditore per categorie di personale.", {}, {
 "001": ("Personale addetto alla sorveglianza.", 103.0), "002": ("Personale specializzato.", 89.0), "003": ("Personale qualificato.", 87.0),
 "004": ("Personale ausiliario.", 75.0), "005": ("Personale in formazione.", 43.0)}),
"111/211": ("Qualsiasi tipo di materiale.", {}, {
 "001": ("Sabbia lavata mm 0/4; up = m3; quantità di consegna fino a 1 m3, computo: volume materiale sciolto", 143.0),
 "002": ("Ghiaia di ricopertura grezza mm 0/16; up = m3; quantità di consegna fino a 1 m3, volume materiale sciolto", 132.0),
 "003": ("Ghiaia per calcestruzzo mm 0/16; up = m3; quantità di consegna fino a 1 m3, volume materiale sciolto", 141.5),
 "004": ("Splitter mm 3/6; up = m3; quantità di consegna fino a 1 m3, volume materiale sciolto", 147.0),
 "005": ("Sabbia ghiaiosa non vagliata; up = m3; quantità di consegna fino a 1 m3, volume materiale sciolto", 101.0),
 "006": ("Sabbia ghiaiosa di 1ª classe mm 0/45, resistente al gelo; up = m3; fino a 1 m3, volume materiale sciolto", 108.5),
 "007": ("Ghiaia di livellamento mm 0/16; up = m3; fino a 1 m3, volume materiale sciolto", 126.5),
 "008": ("Marna; up = m3; quantità di consegna fino a 1 m3, volume materiale sciolto", 160.5),
 "011": ("Calcestruzzo CEM kg/m3 150 0-16 mm; up = m3; quantità di consegna fino a 1 m3", 239.0),
 "012": ("Calcestruzzo CEM kg/m3 150 0-32 mm; up = m3; quantità di consegna fino a 1 m3", 234.0),
 "013": ("Calcestruzzo CEM kg/m3 200 0-32 mm; up = m3; quantità di consegna fino a 1 m3", 245.0),
 "014": ("Calcestruzzo A230-0 (Calcestruzzo CPN A); up = m3; fino a 1 m3", 272.0),
 "015": ("Calcestruzzo B230-0 (Calcestruzzo CPN B); up = m3; fino a 1 m3", 278.0),
 "016": ("Calcestruzzo C330-0 (Calcestruzzo CPN C); up = m3; fino a 1 m3", 290.0),
 "017": ("Malta di cemento CEM kg/m3 400 mm 0/4; up = m3; fino a 1 m3", 302.0),
 "021": ("AC 8 N; up = t; miscela fino a 1 tonnellata, franco cantiere", 302.0),
 "022": ("AC 11 N; up = t; miscela fino a 1 tonnellata, franco cantiere", 288.0),
 "023": ("AC 8 S; up = t; miscela fino a 1 tonnellata, franco cantiere", 300.0),
 "024": ("AC 11 S; up = t; miscela fino a 1 tonnellata, franco cantiere", 290.0),
 "025": ("AC T 16 N; up = t; miscela fino a 1 tonnellata, franco cantiere", 284.0),
 "026": ("AC T 22 N; up = t; miscela fino a 1 tonnellata, franco cantiere", 271.0),
 "027": ("AC T 16 S; up = t; miscela fino a 1 tonnellata, franco cantiere", 275.0),
 "028": ("AC T 22 S; up = t; miscela fino a 1 tonnellata, franco cantiere", 270.0),
 "029": ("Miscela a freddo mm 0-5; up = kg", 3.2), "031": ("Nastro bituminoso TOK BAND 25/8 mm; up = m", 6.4),
 "032": ("Malta di riparazione e posa PCI Polyfix o prodotto equivalente; up = kg", 2.05),
 "033": ("Acciaio per armature 8-14 mm incl. posa e supplemento di listino; up = kg", 2.8)}),
"111/221": ("Calcolo dei costi del materiale con il fattore: prezzo unitario = fattore.", {}, {
 "001": ("Quantità = somma dell'importo netto fatturato dai fornitori, ribasso dedotto, sconto non dedotto, esclusa l'IVA. up = Fr.", 1.1)}),
"111/231": ("Calcolo dei costi del materiale con il fattore: prezzo unitario = fattore.", {}, {
 "001": ("Quantità = somma dell'importo del materiale secondo le basi di calcolo nelle osservazioni preliminari facoltative del sottopar. 230. up = Fr.", 1.1)}),
"111/311": ("Macchine e attrezzature. Escluso l'operatore.", {}, {
 "001": ("Escavatore idraulico, Rp fino a 1.5 t, 10 kW; up = h; funzionamento incl. noleggio senza servizio", 45.0),
 "002": ("Escavatore idraulico, Rp fino a 2.5 t, 15 kW; up = h; funzionamento incl. noleggio senza servizio", 54.0),
 "003": ("Escavatore idraulico, Rp fino a 3.5 t, 25 kW; up = h; funzionamento incl. noleggio senza servizio", 59.0),
 "004": ("Escavatore idraulico, Rp fino a 9 t, 45 kW; up = h; funzionamento incl. noleggio senza servizio", 83.0),
 "005": ("Dumper piccolo a ruote, trazione integrale, fino a 1,0 m3; up = h; funzionamento incl. noleggio senza servizio", 42.0),
 "006": ("Dumper piccolo a ruote, trazione integrale, fino a 2,0 m3; up = h; funzionamento incl. noleggio senza servizio", 52.0),
 "007": ("Dumper piccolo con cingoli fino a 500 kg; up = h; funzionamento incl. noleggio senza servizio", 38.0),
 "011": ("Vibrocostipatore fino a 100 kg; up = h; funzionamento incl. noleggio senza servizio", 22.0),
 "012": ("Piastra vibrante fino a 100 kg; up = h; funzionamento incl. noleggio senza servizio", 25.0),
 "013": ("Piastra vibrante fino a 220 kg; up = h; funzionamento incl. noleggio senza servizio", 34.0),
 "014": ("Rullo liscio vibrante 1 Ro, fino a 0,6 t; up = h; funzionamento incl. noleggio senza servizio", 43.0),
 "015": ("Pompa centrifuga a motore elettrico -200 l/min, 25 mm; up = h; incl. linea di aspirazione e linea di pressione da 30 m", 13.0),
 "016": ("Pompa centrifuga a motore elettrico -400 l/min, 50 mm; up = h; incl. linea di aspirazione e linea di pressione da 30 m", 21.0),
 "017": ("Fresa per giunti -9 kW 110 kg, profondità di taglio fino a 15 cm; up = h; inclusa quota lama, funzionamento senza operatore", 48.0),
 "018": ("Fresa per giunti -15 kW 210 kg, profondità di taglio fino a 25 cm; up = h; inclusa quota lama, funzionamento senza operatore", 64.0),
 "021": ("Compressore a vite mobile con motore a combustione fino a 2,8 m3; up = h; funzionamento incl. noleggio", 41.0),
 "022": ("Compressore a vite mobile con motore a combustione fino a 4,5 m3; up = h; funzionamento incl. noleggio", 56.0),
 "023": ("Martello a punta, DL. -11 kg incluso ferro; up = h; funzionamento incl. noleggio", 15.5)}),
"111/312": ("Materiale di esercizio.", {}, {
 "001": ("Cassero di tutti i tipi, compresi tutti i materiali di legatura e di supporto; up = m2; affitto e usura per utilizzo e m2 di superficie casserata, senza costi di manodopera", 9.5),
 "002": ("Passerella per pedoni, larghezza fino a 1,20 m, lunghezza del ponte fino a 2,00 m; up = pezzo; noleggio per utilizzo", 38.0),
 "003": ("Passerella per pedoni, larghezza fino a 1,20 m, lunghezza del ponte da 2,01 a 4,00 m; up = pezzo; noleggio per utilizzo", 49.0),
 "006": ("Passerella provvisoria per veicoli fino a 3,5 t, larghezza utile fino a 3,00 m, lunghezza del ponte fino a 2,00 m; up = pezzo; noleggio per utilizzo", 55.0),
 "007": ("Passerella provvisoria per veicoli fino a 28 t, larghezza utile fino a 3,50 m, lunghezza del ponte fino a 2,00 m; up = pezzo; noleggio per utilizzo", 67.0)}),
"111/312B": None,
# ---------------- 113 Impianto di cantiere ----------------
"113/111": ("Insieme delle installazioni di cantiere. Prestazioni secondo la norma SIA 118.", {}, {
 "002": ("Durata: durata dei servizi del contraente; up = importo forfettario; quota delle attrezzature di cantiere durante l'esecuzione di tutti i lavori di Swisscom SA", 1.0)}),
"113/214": ("Passerelle provvisorie, lunghezza max. m 3, con superficie di transito antisdrucciolevole, compresi gli elementi di delimitazione.",
 {"100": "Per pedoni.", "110": "Installazione, messa a disposizione per la durata delle prestazioni dell'imprenditore e rimozione.",
  "120": "Spostamenti all'interno del cantiere. Computo: numero di spostamenti.", "130": "Rimozione e reinstallazione nello stesso luogo.",
  "200": "Per veicoli fino a t 3,5.", "210": "Installazione, messa a disposizione per la durata delle prestazioni dell'imprenditore e rimozione.",
  "220": "Spostamenti all'interno del cantiere. Computo: numero di spostamenti.", "230": "Rimozione e reinstallazione nello stesso luogo.",
  "300": "Per veicoli fino a t 28,0.", "310": "Installazione, messa a disposizione per la durata delle prestazioni dell'imprenditore e rimozione.",
  "320": "Spostamenti all'interno del cantiere. Computo: numero di spostamenti.", "330": "Rimozione e reinstallazione nello stesso luogo."}, {
 "111": ("Larghezza utile fino a m 1,20. Lunghezza di attraversamento fino a m 2,00.", 125.0), "121": ("Concerne sottopos. .111.", 78.0), "131": ("Concerne sottopos. .111. up = pz.", 66.0),
 "211": ("Larghezza utile fino a m 3,00. Lunghezza di attraversamento fino a m 2,00.", 168.0), "221": ("Concerne sottopos. .211.", 91.0), "231": ("Concerne sottopos. .211. up = pz.", 72.0),
 "311": ("Larghezza utile fino a m 3,50. Lunghezza di attraversamento fino a m 2,00.", 195.0), "321": ("Concerne sottopos. .311.", 114.0), "331": ("Concerne sottopos. .311. up = pz.", 98.0)}),
"113/232": ("Impianti semaforici.", {"100": "Allestimento e rimozione. Computo: numero di impianti.", "200": "Messa a disposizione. Computo: numero di impianti x numero di mesi.",
  "300": "Spostamento, compresa l'eventuale modifica di impostazione dei tempi. Computo: numero di spostamenti."}, {
 "101": ("Compresi 2 semafori, ciascuno con 3 luci.", 181.2), "201": ("Concerne pos. 232.101", 371.9), "301": ("Concerne pos. 232.101", 132.1)}),
"113/234": ("Regolazione manuale del traffico.", {"100": "Da parte di personale specializzato. Computo: numero di ore lavorative."}, {
 "101": ("Durante il normale orario di lavoro.", 65.0), "102": ("Al di fuori del normale orario di lavoro.", 97.0)}),
"113/236": ("Delimitazioni.", {"100": "Colonnette direttrici, con basamento.", "200": "Delimitazione longitudinale con tavole di sbarramento orizzontali.", "220": "Con 2 tavole orizzontali, con basamento."}, {
 "101": ("Installazione e rimozione.", 22.0), "102": ("Messa a disposizione. Computo: numero di colonnette direttrici x numero di mesi.", 2.4),
 "103": ("Spostamento. Computo: numero di colonnette direttrici x numero di spostamenti.", 16.0),
 "221": ("Installazione e rimozione.", 9.5), "222": ("Messa a disposizione. Computo: lunghezza x numero di mesi.", 2.8), "223": ("Spostamento. Computo: lunghezza x numero di spostamenti.", 6.8)}),
"113/237": ("Lampade di cantiere.", {"100": "Alimentazione a batteria."}, {
 "101": ("Installazione e rimozione.", 8.5), "102": ("Messa a disposizione. Computo: numero di lampade di cantiere x numero di mesi.", 2.0),
 "103": ("Spostamento. Computo: numero di lampade di cantiere x numero di spostamenti.", 6.9)}),
# ---------------- 117 Demolizioni ----------------
"117/223": ("Demolizione di strati bituminosi e di pavimentazioni di calcestruzzo.", {"100": "Tagli.", "120": "Strati bituminosi, a macchina, con fresatrice.", "200": "Scarifica o fresatura.", "210": "Strati bituminosi."}, {
 "122": ("Spessore strato da mm 51 a 100.", 9.8), "123": ("Spessore strato da mm 101 a 150.", 11.9), "124": ("Spessore strato da mm 151 a 200.", 14.9),
 "212": ("Spessore strato da mm 51 a 100.", 5.3), "213": ("Spessore strato da mm 101 a 150.", 8.9), "214": ("Spessore strato da mm 151 a 200.", 12.4)}),
"117/224": ("Demolizione di delimitazioni, lastricati e selciati.", {"100": "Delimitazioni.", "110": "Masselli di demarcazione, masselli e mattonelle scorriacqua.", "120": "Cordonetti.", "140": "Bordure.",
  "200": "Lastricati e selciati.", "210": "Lastricati.", "230": "Selciati in blocchetti di calcestruzzo."}, {
 "111": ("A una fila.", 5.7), "112": ("A due file.", 7.9), "121": ("Sezione fino a m 0,10x0,30.", 7.1), "141": ("Sezione fino a m 0,20x0,25.", 9.7),
 "211": ("Posati su sabbia o pietrischetto.", 6.3), "231": ("Posati su sabbia o pietrischetto.", 6.3)}),
"117/225": ("Smontaggio di delimitazioni, lastricati e selciati.", {"200": "Lastricati e selciati.", "210": "Lastricati.", "220": "Selciati di pietra naturale.", "230": "Selciati in blocchetti di calcestruzzo."}, {
 "211": ("Posati su sabbia o pietrischetto.", 8.9), "221": ("Posati su sabbia o pietrischetto.", 9.4), "231": ("Posati su sabbia o pietrischetto.", 11.5)}),
"117/226": ("Demolizione di condotte, canalette per lo smaltimento delle acque e canali in fase di lavoro separata.", {"300": "Canali, esclusi i movimenti di terra."}, {
 "321": ("Canalina per cavi Zores (metallo), tutte le dimensioni, incluse le spese di carico, trasporto e di discarica", 8.5)}),
"117/228": ("Demolizione di pozzetti, caditoie, coperture, sopralzi, accessori e simili.", {"100": "Pozzetti e caditoie, esclusi i movimenti di terra.", "200": "Coperture e sopralzi.", "300": "Telai con chiusini o griglie."}, {
 "101": ("Demolizione completa di pozzetti d'ispezione fino a DN 1000 mm, altezza fino a 1.50 m, incluse le spese di trasporto e di discarica", 322.0),
 "102": ("Demolizione di chiusini a lastra in calcestruzzo completi, dimensioni fino a 2,00 x 1,00 x 0,90 m, incluse le spese di trasporto e di discarica", 498.0),
 "201": ("Demolizione di lastre di copertura per camere a lastre, dimensione 120 x 53 cm, incluse le spese di trasporto e di discarica", 21.0),
 "202": ("Demolizione di lastre di copertura per camere a lastre, dimensioni 120 x 27 cm, incluse le spese di trasporto e di discarica", 16.9),
 "301": ("Rimozione di chiusini in ghisa, rotondi fino a NW 800 mm, incluse le spese di trasporto e di discarica", 56.0),
 "302": ("Rimozione di chiusini in calcestruzzo, rotondi fino a NW 800 mm, incluse le spese di trasporto e di discarica", 39.0),
 "303": ("Rimozione di coperture rettangolari in calcestruzzo/ghisa complete, fino a una superficie di 3,00 m2, incluse le spese di trasporto e di discarica", 198.0)}),
"117/713": ("Carico del materiale sul mezzo di trasporto.", {"200": "Materiale a partire dal deposito intermedio ordinato dal committente."}, {
 "201": ("Pavimentazione, lastre di cemento e simili; up = t", 34.0),
 "202": ("Carico e trasporto intermedio di pavimentazioni, finiture dei bordi e simili in calcestruzzo e/o pietra naturale in cassoni scarrabili; up = t", 49.0),
 "301": ("Carico e trasporto intermedio di coperture bituminose; up = t", 53.0)}),
"117/721": ("Trasporti, computo: massa. Compreso lo scarico, esclusi la sistemazione e le tasse.", {"200": "Alla discarica.", "220": "Alla discarica tipo B secondo OPSR.", "250": "Alla discarica tipo E secondo OPSR.",
  "400": "Rifiuti edili minerali all'impianto di trattamento."}, {
 "222": ("Materiale bituminoso di demolizione stradale. Contenuto di PAH fino a mg/kg 250.", 14.2),
 "251": ("Materiale bituminoso di demolizione stradale. Contenuto di PAH superiore a mg/kg 250.", 16.5), "404": ("Calcestruzzo di demolizione.", 13.15)}),
"117/731": ("Tasse per la consegna di materiale, compresa la sistemazione. Computo: massa.", {"200": "Alla discarica.", "220": "Alla discarica tipo B secondo OPSR.", "400": "All'impianto di trattamento."}, {
 "222": ("Materiale bituminoso di demolizione stradale. Contenuto di PAH fino a mg/kg 250.", 79.0), "404": ("Calcestruzzo di demolizione.", 13.5)}),
}
MAN = "Senza impedimenti causati da sbadacchiature."
IT.update({
"151/121": ("Scavo a mano per sondaggi. In fase di lavoro separata. Computo: volume materiale compatto.", {}, {"001": ("Classi di abbattimento da 2 a 4.", 92.4)}),
"151/122": ("Riempimento con materiale proveniente da sondaggi dal deposito intermedio laterale. Computo: volume materiale compatto.", {}, {"001": ("A macchina.", 21.5), "002": ("A mano.", 69.4)}),
"151/131": ("Pompe mobili per impieghi di breve durata.", {"100": "Pompa elettrica.", "110": "Per acque chiare e meteoriche."}, {"111": ("Portata fino a l/min 200.", 8.8)}),
"151/132": ("Lavori accessori allo smaltimento delle acque.", {"100": "Esecuzione di pozzi di pompaggio. Compreso l'abbassamento, posa e rimozione di tubi o contenitori."}, {"101": ("Computo: numero di pozzi di pompaggio.", 239.0)}),
"151/211": ("Taglio e rimozione di tappeto erboso in zolle. A macchina o a mano.", {}, {"001": ("Compresa la messa in deposito intermedia laterale.", 10.5), "002": ("Compreso il trasporto fino a m 30 e la messa in deposito intermedia.", 19.4)}),
"151/212": ("Rimozione dello strato superiore del suolo.", {"100": "A macchina.", "200": "A mano."}, {
 "101": ("Larghezza di rimozione fino a m 2,00.", 10.7), "102": ("Larghezza di rimozione da m 2,01 a 5,00.", 8.4), "201": ("Larghezza di rimozione fino a m 2,00.", 69.25)}),
"151/221": ("Scavo di trincee a U e a V. Classi di abbattimento da 2 a 4.", {"100": "A macchina.", "110": MAN, "120": "In trincee sbadacchiate.", "200": "A mano.", "210": MAN, "220": "In trincee sbadacchiate."}, {
 "111": ("Profondità fino a m 1,50.", 26.5), "112": ("Profondità da m 1,51 a 2,00.", 22.2), "121": ("Profondità fino a m 1,50.", 36.7), "122": ("Profondità da m 1,51 a 2,00.", 40.85),
 "211": ("Profondità fino a m 1,50.", 100.1), "221": ("Profondità fino a m 1,50.", 120.1)}),
})
def supp(title, p):
    h = {"100": "Per difficoltà di scavo.", "110": "Classe di abbattimento 5.", "120": "Classe di abbattimento 6.", "130": "Classe di abbattimento 7.",
         "200": "Per strati consolidati.", "300": "Per presenza di ostacoli isolati, comprese la scalpellatura e la rimozione.", "400": "Per difficoltà varie."}
    t = {"111": "Profondità fino a m 1,50.", "121": "Profondità fino a m 1,50.", "131": "Profondità fino a m 1,50.", "201": "Strati gelati.", "202": "Massicciate.",
         "301": "Trovanti superiori a m3 0,25.", "302": "Fondazioni di pietrame o calcestruzzo non armato.", "303": "Fondazioni di calcestruzzo armato.",
         "401": "Scavo in terreni con radici, compresa la rimozione delle radici."}
    return (title, h, {k: (t[k] if not (k == "301" and "mano" in title) else "Trovanti superiori a m3 0,01.", v) for k, v in p.items()})
IT["151/222"] = supp("Supplementi allo scavo a macchina di trincee a U e a V, senza impedimenti causati da sbadacchiature.", {"111": 11.0, "121": 35.1, "131": 69.8, "201": 17.7, "202": 7.9, "301": 49.0, "302": 63.2, "303": 183.7, "401": 20.4})
IT["151/223"] = supp("Supplementi allo scavo a macchina di trincee a U e a V, in trincee sbadacchiate.", {"111": 16.45, "121": 62.0, "131": 104.4, "201": 25.7, "202": 11.1, "301": 55.1, "302": 67.7, "303": 194.0})
IT["151/224"] = supp("Supplementi allo scavo a mano di trincee a U e a V, senza impedimenti causati da sbadacchiature.", {"111": 103.85, "121": 187.0, "131": 198.1, "201": 74.8, "202": 54.9, "301": 108.95, "302": 132.95, "303": 267.0})
IT["151/232"] = supp("Supplementi allo scavo a macchina di fosse e allo scavo per fondazioni, senza impedimenti causati da sbadacchiature.", {"111": 11.35, "121": 44.0, "131": 92.2, "201": 25.65, "202": 10.55, "301": 57.45, "302": 65.35, "303": 189.9, "401": 23.8})
IT["151/234"] = supp("Supplementi allo scavo a mano di fosse e allo scavo per fondazioni, senza impedimenti causati da sbadacchiature.", {"111": 98.6, "121": 122.3, "131": 139.0, "202": 56.4, "301": 134.45, "302": 158.9, "303": 282.15, "401": 65.9})
IT.update({
"151/227": ("Lavori di scavo con aspiratore.", {"100": "Installazione, messa a disposizione, spostamento e allontanamento dell'aspiratore.", "200": "Lavori con aspiratore."}, {
 "101": ("Per la durata delle prestazioni dell'imprenditore, a tappe.", 455.0), "201": ("Ore di lavoro aspiratore, compreso l'operatore e 1 operaio ausiliario.", 498.0),
 "202": ("Tempo di attesa aspiratore, compreso l'operatore e 1 operaio ausiliario.", 405.0), "203": ("Operaio ausiliario supplementare.", 95.0)}),
"151/231": ("Scavo di fosse e scavo per fondazioni, classi di abbattimento da 2 a 4.", {"100": "A macchina.", "110": MAN, "120": "In fosse sbadacchiate.", "200": "A mano.", "210": MAN, "220": "In fosse sbadacchiate."}, {
 "111": ("Profondità fino a m 1,50.", 21.1), "112": ("Profondità da m 1,51 a 2,00.", 24.3), "121": ("Profondità fino a m 1,50.", 32.65), "122": ("Profondità da m 1,51 a 2,00.", 35.95),
 "211": ("Profondità fino a m 1,50.", 92.4), "221": ("Profondità fino a m 1,50.", 109.4)}),
"151/241": ("Supplementi per impedimenti causati dalla presenza di condotte.", {}, {"001": ("Longitudinalmente a trincee o fosse.", 10.5), "002": ("Trasversalmente a trincee o fosse.", 11.3)}),
"151/242": ("Supplementi per la messa in sicurezza e la protezione di condotte.", {}, {"001": ("Longitudinalmente a trincee o fosse.", 11.9), "002": ("Trasversalmente a trincee o fosse.", 10.8)}),
"151/243": ("Supplementi per passaggio sotto condotte, ostacoli e simili.", {"200": "Scalpellatura e rimozione dell'avvolgimento di condotte."}, {"201": ("Calcestruzzo non armato.", 149.45), "202": ("Calcestruzzo armato.", 313.4)}),
"151/244": ("Supplementi per la rimozione di condotte durante i lavori di scavo.", {}, {
 "001": ("Demolizione di canali tipo Zores, tutte le dimensioni, incluse le spese di carico, trasporto e di discarica", 8.5),
 "002": ("Scopertura e taglio di canale tipo Zores con cavi in funzione. Rimozione dei cavi e accurato stoccaggio laterale. Separazione e smantellamento del canale, incluse le spese di carico, trasporto e di discarica", 25.5),
 "003": ("Scopertura e taglio di canale tipo Zores con cavi fuori servizio. Separazione e demolizione del canale e dei cavi, incluse le spese di carico, trasporto e di discarica", 12.8)}),
})
TR = {"100": "Al deposito intermedio del committente o dell'imprenditore.", "110": "Qualsiasi tipo di materiale, escluse le tasse.", "200": "Alla discarica, escluse le tasse.",
      "210": "Classificazione secondo OPSR. Discarica tipo A.", "220": "Classificazione secondo OPSR. Discarica tipo B."}
TT = {"111": "Distanza fino a m 100.", "112": "Distanza da m 101 a 200.", "113": "Distanza da m 201 a 500.", "211": "Strato superiore del suolo.", "213": "Materiale di scavo.", "221": "Calcestruzzo di demolizione."}
def trp(title, p): return (title, TR, {k: (TT[k], v) for k, v in p.items()})
IT["151/251"] = trp("Trasporti all'interno e all'esterno del cantiere, compreso lo scarico. Computo: volume materiale sciolto.", {"111": 8.5, "112": 10.95, "113": 13.0, "211": 25.25, "213": 25.25, "221": 23.15})
IT["151/252"] = trp("Trasporti all'interno e all'esterno del cantiere, compreso lo scarico. Computo: volume materiale compatto.", {"111": 11.05, "112": 14.2, "113": 16.9, "211": 32.6, "213": 32.6, "221": 35.1})
IT["151/254"] = trp("Trasporti con benne all'interno e all'esterno del cantiere, compreso lo scarico. Computo: volume materiale sciolto.", {"211": 24.4, "213": 24.4, "221": 24.4})
IT["151/255"] = trp("Trasporti con benne all'interno e all'esterno del cantiere, compreso lo scarico. Computo: volume materiale compatto.", {"211": 30.5, "213": 30.5, "221": 36.6})
DH = {"100": "Alla discarica dell'imprenditore.", "110": "Classificazione secondo OPSR. Discarica tipo A.", "120": "Classificazione secondo OPSR. Discarica tipo B."}
DT = {"111": "Strato superiore del suolo.", "113": "Materiale di scavo.", "121": "Calcestruzzo di demolizione."}
IT["151/261"] = ("Tasse per la consegna di materiale alla discarica. Computo: volume materiale sciolto.", DH, {k: (DT[k], v) for k, v in {"111": 8.2, "113": 25.9, "121": 13.5}.items()})
IT["151/262"] = ("Tasse per la consegna di materiale alla discarica. Computo: volume materiale compatto.", DH, {k: (DT[k], v) for k, v in {"111": 9.85, "113": 33.7, "121": 24.3}.items()})
IT.update({
"151/272": ("Copertura del materiale, su ordine del committente. Compresi la fornitura, la manutenzione e lo smaltimento del materiale di copertura.", {}, {"001": ("Foglio di materiale sintetico, spessore da mm 0,15 a 0,25.", 2.4)}),
"151/273": ("Carico di materiale dal deposito intermedio ordinato dal committente.", {"100": "A macchina. Computo: volume materiale sciolto.", "200": "A macchina. Computo: volume materiale compatto.",
  "300": "A mano. Computo: volume materiale sciolto.", "400": "A mano. Computo: volume materiale compatto."}, {
 "101": ("Strato superiore del suolo.", 5.05), "103": ("Materiale di scavo.", 5.05), "201": ("Strato superiore del suolo.", 6.1), "203": ("Materiale di scavo.", 6.45),
 "301": ("Strato superiore del suolo.", 63.2), "303": ("Materiale di scavo.", 65.5), "401": ("Strato superiore del suolo.", 75.85), "403": ("Materiale di scavo.", 81.95)}),
"151/274": ("Pulizia e ripristino di aree per depositi intermedi ordinati dal committente.", {}, {"001": ("Deposito intermedio per strato superiore del suolo (orizzonte A).", 1.2), "003": ("Deposito intermedio per materiale di scavo.", 1.2)}),
"151/275": ("Altri lavori accessori.", {}, {"001": ("Spostamento accurato, orizzontale o verticale, di canale tipo Zores in funzione fino a 0.50 m, in relazione ai lavori di scavo; up = m. Esecuzione esclusivamente sotto la direzione e il controllo della direzione lavori e/o di un rappresentante di cablex SA", 19.5)}),
"151/311": ("Protezione di superfici, scarpate e simili con foglio di materiale sintetico. Compresi la rimozione e lo smaltimento. Computo: superficie ricoperta.",
 {"100": "Foglio di materiale sintetico non armato.", "110": "Su superfici orizzontali e con pendenza fino a 1:4.", "120": "Su superfici con pendenza superiore a 1:4."}, {
 "111": ("Foglio di materiale sintetico, spessore da mm 0,15 a 0,25.", 4.5), "121": ("Foglio di materiale sintetico, spessore da mm 0,15 a 0,25.", 4.8)}),
"151/321": ("Sbadacchiatura di trincee.", {"100": "Puntellamento contrapposto."}, {"101": ("Profondità trincea fino a m 1,50.", 25.5), "102": ("Profondità trincea da m 1,51 a 2,00.", 23.0)}),
"151/361": ("Lavori accessori alle sbadacchiature.", {"300": "Fornitura e messa in opera di materiale idoneo per il riempimento di cavità dietro la sbadacchiatura."}, {"301": ("Sabbia.", 81.9)}),
"151/412": ("Fornitura di tubi di protezione per cavi, di PE-HD, C+S.", {"100": "Lunghezza tubo m 5.", "110": "Con GM, comprese le guarnizioni.", "200": "Lunghezza tubo m 10.", "210": "Con GM, comprese le guarnizioni."}, {
 "111": ("DN/ID 55.", 2.8), "113": ("Altri DN/ID: DN/ID 100", 7.3), "211": ("DN/ID 55.", 2.7), "214": ("DN/ID 100.", 6.9), "215": ("DN/ID 120.", 8.2), "216": ("DN/ID 150.", 12.8)}),
"151/415": ("Fornitura di tubi di protezione per cavi di PE, con chiusura longitudinale.", {"100": "Lunghezza tubo m 5."}, {"102": ("DN/ID 100.", 39.3), "103": ("DN/ID 120.", 45.1), "104": ("DN/ID 150.", 59.9)}),
"151/421": ("Fornitura di pezzi speciali (1).", {"100": "Curve per tubi di protezione per cavi, senza bicchiere, gradi 45.", "120": "Di PE-HD, C+S.", "200": "Curve per tubi di protezione per cavi, senza bicchiere, gradi 90.", "220": "Di PE-HD, C+S.",
  "300": "Curve flessibili.", "310": "Di PE-LD, C+S.", "400": "Curve flessibili con chiusura longitudinale.", "420": "Di PE-HD.", "500": "Manicotti (1).",
  "510": "Manicotto a doppio bicchiere. Comprese le guarnizioni.", "520": "Manicotto terminale. Comprese le guarnizioni.", "560": "Manicotto per tubi di protezione per cavi con chiusure longitudinali."}, {
 "121": ("DN/ID 55, r mm 600.", 17.8), "124": ("DN/ID 100, r mm 1'000.", 43.0), "125": ("DN/ID 120, r mm 1'200.", 50.6), "126": ("DN/ID 150, r mm 1'500.", 77.5),
 "221": ("DN/ID 55, r mm 600.", 21.2), "224": ("DN/ID 100, r mm 1'000.", 48.55), "225": ("DN/ID 120, r mm 1'200.", 56.9), "226": ("DN/ID 150, r mm 1'500.", 83.6),
 "313": ("DN/ID 100.", 81.6), "314": ("DN/ID 120.", 104.2), "315": ("DN/ID 150.", 161.0), "422": ("DN/ID 100.", 181.8), "423": ("DN/ID 120.", 212.5), "424": ("DN/ID 150.", 306.0),
 "511": ("DN/ID 55.", 5.2), "514": ("DN/ID 100.", 5.85), "515": ("DN/ID 120.", 12.5), "516": ("DN/ID 150.", 19.3), "521": ("DN/ID 55.", 18.2), "524": ("DN/ID 100.", 5.9),
 "525": ("DN/ID 120.", 7.3), "526": ("DN/ID 150.", 15.3), "562": ("DN/ID 100.", 39.3), "563": ("DN/ID 120.", 45.1), "564": ("DN/ID 150.", 59.9)}),
})
ACC = {"301": "Set di pezzi a T in plastica per condotta cavi n. 8 con 2 uscite K55; up = pezzo; Catalogo HGC (Swisscom) No. art. 1300771",
       "302": "Set di pezzi a T in plastica per condotta portacavi n. 4 con 2 uscite K55; up = pezzo; Catalogo HGC (Swisscom) No. art. 1300763",
       "303": "Diramazione a mezzo guscio 30° per sistema di tubi in plastica da K55 a K55; up = pezzo; Catalogo HGC (Swisscom) No. art. 1337690",
       "304": "Diramazione a mezzo guscio 30° per sistema di tubi in plastica da K100 a K55; up = pezzo; Catalogo HGC (Swisscom) No. art. 1337708",
       "305": "Diramazione a mezzo guscio 30° per canalina portacavi n. 4 su K55; up = pezzo; Catalogo HGC (Swisscom) No. art. 1337716",
       "306": "Diramazione a mezzo guscio 30° per canalina portacavi n. 8 su K55; up = pezzo; Catalogo HGC (Swisscom) No. art. 1337724",
       "307": "Raccordo per canalina portacavi n. 4, incluso set di montaggio; up = pezzo; Catalogo HGC (Swisscom) No. art. 1337732"}
IT["151/423"] = ("Fornitura di accessori.", {}, {k: (ACC[k], v) for k, v in {"301": 195.4, "302": 137.7, "303": 106.9, "304": 155.0, "305": 115.9, "306": 141.0, "307": 176.3}.items()})
d451 = {k: (ACC[k], 18.0) for k in ACC}; d451["308"] = ("Reimballaggio di cavi di telecomunicazione in funzione di tutti i diametri in una canalina con chiusura longitudinale; up = m; incluse tutte le misure di protezione necessarie", 19.5)
IT["151/451"] = ("Accessori; solo posa.", {}, d451)
IT.update({
"151/431": ("Posa e sigillatura di tubi di protezione per cavi in stanghe o in rotoli.", {}, {"001": ("Fino a DN/ID 60.", 3.4), "002": ("Da DN/ID 61 a 100.", 4.0), "003": ("Da DN/ID 101 a 150.", 4.5)}),
"151/433": ("Posa di tubi di materiale sintetico con chiusura longitudinale.", {}, {"002": ("Da DN/ID 61 a 100.", 5.9), "003": ("Da DN/ID 101 a 150.", 7.1)}),
"151/441": ("Supplementi per la posa di pezzi speciali per tubi di protezione per cavi.", {"100": "Curve.", "110": "Gradi 45.", "120": "Gradi 90.", "200": "Curve flessibili.", "300": "Curve flessibili con chiusura longitudinale."}, {
 "111": ("DN/ID 55.", 7.0), "114": ("DN/ID 100.", 8.5), "115": ("DN/ID 120.", 9.0), "116": ("DN/ID 150.", 10.0), "121": ("DN/ID 55.", 7.0), "123": ("DN/ID 80.", 7.8),
 "124": ("DN/ID 100.", 8.5), "125": ("DN/ID 120.", 9.0), "126": ("DN/ID 150.", 10.0), "204": ("DN/ID 100.", 8.5), "205": ("DN/ID 120.", 9.0), "206": ("DN/ID 150.", 10.0),
 "302": ("DN/ID 100.", 11.3), "303": ("DN/ID 120.", 12.1), "304": ("DN/ID 150.", 13.0)}),
"151/442": ("Supplementi per la posa di manicotti per tubi di protezione per cavi.", {"100": "Manicotti (1).", "110": "Manicotto a doppio bicchiere.", "120": "Manicotto terminale.", "160": "Manicotto per tubi con chiusura longitudinale."}, {
 "111": ("DN/ID 55.", 5.5), "114": ("DN/ID 100.", 6.8), "115": ("DN/ID 120.", 7.0), "116": ("DN/ID 150.", 8.2), "121": ("DN/ID 55.", 5.5), "124": ("DN/ID 100.", 6.8),
 "125": ("DN/ID 120.", 7.0), "126": ("DN/ID 150.", 8.2), "162": ("DN/ID 100.", 8.0), "163": ("DN/ID 120.", 9.0), "164": ("DN/ID 150.", 10.0)}),
"151/471": ("Esecuzione di blocchi di tubi.", {"100": "Esecuzione della casseratura. Posa di tubi di protezione per cavi, rispettando la distanza fra di essi. Fornitura, messa in opera a strati e compattazione del materiale nella zona di avvolgimento.",
  "110": "Blocco di tubi a uno strato.", "120": "Blocco di tubi a due strati.", "130": "Blocco di tubi a più strati."}, {
 "111": ("DN/ID 100. Numero di tubi fino a 4", 55.0), "115": ("DN/ID 55, numero di tubi da 1 a 3", 38.0), "121": ("DN/ID 100. Numero di tubi fino a 4", 59.0),
 "124": ("DN/ID 55, numero di tubi da 1 a 3", 44.0), "131": ("DN/ID 100. Numero di strati fino a 3, numero di tubi fino a 4", 69.0), "134": ("DN/ID 55, numero di strati da 3 a 4, numero di tubi da 1 a 3", 51.0)}),
"151/482": ("Taglio di tubi, compresa la smussatura delle superfici di taglio.", {"100": "Tubi di materiale sintetico."}, {"101": ("Fino a DN/ID 100.", 9.0), "102": ("Da DN/ID 101 a 150.", 12.0)}),
"151/484": ("Nastri e reti.", {"100": "Fornitura di nastri e reti.", "110": "Nastri di segnalazione.", "200": "Posa di nastri e reti.", "210": "Nastri di segnalazione."}, {
 "111": ("Tipo nastro di avvertimento per sistema di cavi", 0.1), "211": ("Tipo nastro di avvertimento per sistema di cavi", 0.5),
 "301": ("Fornitura e trasporto di nastro di terra Cu 20x3 mm; up = m; inclusi i terminali di derivazione necessari", 19.3), "302": ("Posa del nastro di terra Cu 20x3 mm fornito dal cliente; up = m", 5.4)}),
"151/485": ("Calibratura di tubi in opera.", {}, {"001": ("DN/ID 100.", 1.5), "002": ("DN/ID 120.", 1.9), "003": ("DN/ID 150.", 2.2), "004": ("DN/ID 55", 1.5)}),
"151/486": ("Introduzione nei tubi di corde mediante tiro o insufflazione e fissaggio alle due estremità.", {}, {"001": ("Compresa la fornitura.", 1.5)}),
"151/487": ("Introduzione nei tubi di fili o cordine metalliche mediante tiro e fissaggio alle due estremità.", {}, {"001": ("Compresa la fornitura.", 2.0)}),
"151/611": ("Esecuzione di pozzetti e camere in elementi prefabbricati.", {"100": "Di calcestruzzo. Fondo di calcestruzzo, getto in opera o in elementi prefabbricati."}, {
 "171": ("Pozzetto per cavi, pozzetto di controllo DN 800, senza cono, pozzetto coperto senza chiusino (descritto separatamente). Profondità del pozzo fino a m 0.50. Secondo il piano Swisscom 151.611.114", 920.0),
 "172": ("Pozzetto per cavi, pozzetto di controllo DN 800, senza cono, pozzetto rialzato senza chiusino (descritto separatamente). Profondità del pozzo fino a m 1.00. Secondo il piano 151.611.114", 1290.0)}),
"151/621": ("Esecuzione di pozzetti e camere di calcestruzzo gettato in opera. Compresi la fornitura di materiale, i lavori relativi a casseratura, armatura, calcestruzzo e intonaci.", {}, {
 "011": ("Nuova costruzione di un pozzetto con soletta in calcestruzzo secondo il piano Swisscom n. 151.621.011. Dimensioni interne lxbxt m 1.00 x 1.00 x 1.30, spessore parete mm 200, spessore fondo mm 150, superficie ben livellata, calcestruzzo tipo CPN A. Escluso chiusino.", 2090.0),
 "012": ("Nuova costruzione di un pozzetto con soletta in calcestruzzo secondo il piano Swisscom n. 151.621.011. Dimensioni interne lxbxt m 1.50 x 1.00 x 1.35, spessore parete mm 200, spessore fondo mm 150, superficie ben livellata, calcestruzzo tipo CPN A. Escluso chiusino.", 2660.0),
 "013": ("Nuova costruzione di un pozzetto con soletta in calcestruzzo secondo il piano Swisscom n. 151.621.011. Dimensioni interne lxbxt m 1.50 x 1.00 x 1.75, spessore parete mm 200, spessore fondo mm 150, superficie ben livellata, calcestruzzo tipo CPN A. Escluso chiusino.", 3230.0),
 "021": ("Nuova costruzione di un pozzetto con soletta in calcestruzzo secondo il piano 151.621.022; rispettare il piano casseri e il piano d'armatura. Dimensioni interne lxbxt m 3.00 x 1.50 x 2.00, spessore parete mm 200, spessore fondo mm 200, superficie in pendenza incl. scarico a pavimento DN 250 mm completo di griglia in ghisa, calcestruzzo tipo CPN A. Escluso chiusino.", 11900.0)}),
"151/623": ("Esecuzione di pozzetti e camere in altro materiale. Compresa la fornitura di materiale.", {}, {
 "001": ("Conversione della camera a lastra esistente (PS) in piccola camera (KES) secondo il piano Swisscom 151.621_dt. Dimensioni interne lxbxt m 1.00 x 1.00 x 1.00; up = pezzo; copertura con zoccolo e calcestruzzo (Appenzeller) Swisscom NW 975x800 mm, Catalogo HGC No. art. 1370899", 2940.0),
 "002": ("Conversione della camera a lastra esistente (PS) in piccola camera (KES) secondo il piano Swisscom 151.621_dt. Dimensioni interne lxbxt m 1.00 x 1.50 x 1.30; up = pezzo; telaio senza base per Inlay Grip D400 Swisscom NW 90x90 cm, Catalogo HGC No. art. 1377886", 4850.0),
 "003": ("Conversione della camera a lastra esistente (PS) in piccola camera (KES) secondo il piano Swisscom 151.621_dt. Dimensioni interne lxbxt m 1.00 x 2.00 x 1.30; up = pezzo; telaio senza base per Inlay Grip D400 Swisscom NW 180x90 cm, Catalogo HGC No. art. 1374263", 5670.0),
 "011": ("Modifica di pozzetto d'ispezione esistente (ubicazione secondo il piano). Compresi: messa in sicurezza e protezione, demolizione parziale di pareti e solette fino a 6.00 m² ciascuna, fresatura del calcestruzzo fino a 2.00 m², 6 passaggi per tubi incl. sigillatura, chiusura di 6 passaggi esistenti, integrazioni di fondo, parete e soletta fino a 6 m²; escluso fornitura e posa del chiusino; up = pezzo; esecuzione in accordo con la direzione lavori e/o collaboratori di cablex SA", 13000.0),
 "012": ("Conversione di un piccolo pozzo di accesso esistente (ubicazione come da progetto). Compresi: messa in sicurezza e protezione, demolizione parziale di pareti e solette fino a 2.00 m² ciascuna, fresatura del calcestruzzo fino a 1.00 m², 4 passaggi per tubi incl. sigillatura, chiusura di 4 passaggi esistenti, integrazioni di fondo, parete e soletta fino a 2.00 m²; escluso fornitura e posa del chiusino; up = pezzo; esecuzione in accordo con la direzione lavori e/o collaboratori di cablex SA", 7500.0)}),
"151/631": ("Elementi prefabbricati per pozzetti.", {"100": "Fornitura e posa di anelli ed elementi per pozzetti, di calcestruzzo.", "110": "Altezza fino a m 0,50."}, {"111": ("DN 600.", 162.0), "112": ("DN 800.", 215.0)}),
})
COV = {
 "131": ("Telaio con base in calcestruzzo sistema DS senza coperchio Swisscom", "1373513"),
 "132": ("Telaio sistema DS per piastra di sbarramento senza coperchio Swisscom", "1373505"),
 "133": ("Telaio con base in calcestruzzo Nivroll Swisscom, dimensione 130 x 130 cm", "1373521"),
 "134": ("Telaio con base in calcestruzzo regolabile in altezza Nivroll Swisscom", "1373539"),
 "135": ("Chiusino di ghisa Nivroll D400 Swisscom", "1373638"),
 "136": ("Chiusino di ghisa non chiudibile DN 600 D400 Swisscom", "1373547"),
 "137": ("Cappuccio di chiusura per NIVO (von Roll Nivroll)", "1373661"),
 "138": ("Telaio senza base in calcestruzzo con riempimento BGS Swisscom, dimensione 122x90 cm, peso 410 kg", "1374321"),
 "139": ("Telaio senza base in calcestruzzo con riempimento BGS Swisscom, dimensione 190x140 cm, peso 1200 kg", "1374339"),
 "141": ("Telaio senza base in calcestruzzo con riempimento, tipo Ermatic, dimensione 182x90 cm, per 2 coperchi, peso 594 kg", "1374362"),
 "142": ("Telaio senza base in calcestruzzo con riempimento BGS Swisscom, dimensione 182x90 cm, peso 1450 kg", "1374370"),
 "143": ("Telaio senza base in calcestruzzo, completamente in ghisa, BGS Swisscom, dimensione 122x90 cm", "1374388"),
 "144": ("Telaio con base in calcestruzzo, completamente in ghisa, BGS Swisscom, dimensione 190x140 cm, peso 618 kg", "1374396"),
 "145": ("Telaio senza base in calcestruzzo, completamente in ghisa, BGS Swisscom, dimensione 182x90 cm, peso 435 kg", "1374404"),
 "146": ("Telaio senza base in calcestruzzo, completamente in ghisa, BGS Swisscom, dimensione 182x90 cm, peso 900 kg", "1374412"),
 "147": ("Copertura con riempimento in calcestruzzo (Appenzeller) Swisscom senza zoccolo, dimensione 975x800 mm, per 2 coperchi, peso 400 kg", "1370873"),
 "148": ("Copertura con zoccolo e riempimento in calcestruzzo (Appenzeller) Swisscom, dimensione 975x800 mm, per 2 coperchi, peso 630 kg", "1370899"),
 "151": ("Telaio senza base in calcestruzzo, completamente in ghisa, BGS Swisscom, dimensione 123x90 cm, per 2 coperchi, peso 116 kg", "1374248"),
 "152": ("Telaio senza zoccolo in calcestruzzo per Inlay Grip, D400 Swisscom, dimensione 180x90 cm, peso 148 kg", "1374263"),
 "153": ("Telaio in ghisa con base in calcestruzzo, BGS Swisscom, dimensione 190x140 cm, per 2 coperchi", "1374255"),
 "154": ("Telaio con zoccolo in calcestruzzo per Inlay Grip, D400 Swisscom, dimensione 240x140 cm", "1374271"),
 "155": ("Telaio senza zoccolo in calcestruzzo per Inlay Grip, D400 Swisscom, dimensione 90x90 cm, peso 95 kg", "1377886"),
 "156": ("Telaio con zoccolo in calcestruzzo per Inlay Grip, D400 Swisscom, dimensione 90x90 cm", "1377894"),
 "157": ("Chiusino Inlay Grip D400 Swisscom, dimensione 90x90 cm, peso 183 kg", "1377902"),
 "158": ("Telaio e chiusino Lock Grip D400 senza zoccolo in calcestruzzo, dimensione 90x90 cm, peso 240 kg", "1377910"),
 "159": ("Telaio e chiusino Lock Grip D400 con zoccolo in calcestruzzo, dimensione 190x140 cm, peso 1008 kg", "1377936"),
 "161": ("Telaio e chiusino Lock Grip D400 senza zoccolo in calcestruzzo, dimensione 180x90 cm, peso 473 kg", "1377928"),
 "162": ("Telaio e chiusino Lock Grip D400 con zoccolo in calcestruzzo, dimensione 240x140 cm, peso 1174 kg", "1377944")}
P1 = {"131": 358, "132": 168, "133": 809, "134": 361, "135": 197, "136": 181, "137": 11.7, "138": 2314, "141": 2460, "143": 2124, "144": 3007, "145": 2371, "146": 3129,
      "147": 1254, "148": 1986, "151": 507, "152": 641, "153": 1179, "154": 1533, "155": 464, "156": 1260, "157": 1156, "158": 2435, "159": 3312, "161": 3779, "162": 4894}
P2 = {"231": 174, "232": 156, "233": 247, "234": 182, "235": 85, "236": 85, "237": 9.5, "238": 595, "239": 323, "241": 648, "242": 369, "243": 444, "244": 305, "245": 595,
      "246": 345, "247": 595, "248": 648, "251": 995, "252": 1205, "253": 265, "254": 318, "255": 995, "256": 294, "257": 124, "258": 995, "259": 442, "261": 1205, "262": 515}
items = {}
for k, v in P1.items(): items[k] = (COV[k][0] + "; Catalogo HGC (Swisscom) No. art. " + COV[k][1], float(v))
for k in ("139", "142"): items[k] = (COV[k][0] + "; Catalogo HGC (Swisscom) No. art. " + COV[k][1], None)
for k, v in P2.items(): c = COV["1" + k[1:]]; items[k] = (c[0] + "; Catalogo HGC (Swisscom) No. art. " + c[1], float(v))
IT["151/632"] = ("Coperture.", {"100": "Fornitura sul luogo di impiego di lastre di copertura, coperture per pozzetti e manufatti speciali.",
  "200": "Posa a quota definitiva di lastre di copertura, coperture per pozzetti e manufatti speciali. Compresa la fornitura del materiale per il letto di posa e il fissaggio."}, items)
IT.update({
"151/633": ("Innalzamento di coperture di pozzetti e camere esistenti, compreso il materiale per il letto di posa e il fissaggio.", {}, {
 "001": ("Chiusini per pozzetti a sezione circolare, diametro da 400 a 800 mm, compresi tutti i materiali necessari e lavori accessori. Innalzamento fino a m 0.50", 235.0),
 "002": ("Chiusini per pozzetti a sezione rettangolare, dimensione fino a 2.40 x 1.40 m, compresi tutti i materiali necessari e lavori accessori. Innalzamento fino a m 0.50", 1850.0)}),
"151/634": ("Abbassamento di coperture di pozzetti e camere esistenti, compreso il materiale per il letto di posa e il fissaggio.", {}, {
 "001": ("Chiusini formato tondo diametro da 400 a 800 mm, inclusi tutti i materiali necessari e i lavori accessori. Abbassamento fino a m 0.50", 284.0),
 "002": ("Chiusini formato rettangolare, dimensioni fino a 2,40 x 1,40 m, inclusi tutti i materiali necessari e i lavori accessori. Abbassamento fino a m 0.50", 1500.0)}),
"151/672": ("Allacciamento di condotte a pozzetti, camere e manufatti, compresi i lavori di scalpellatura e di intonacatura.", {"100": "Esecuzione successiva in pozzetti e camere esistenti.",
  "200": "In pozzetti e camere prefabbricati.", "300": "In manufatti di calcestruzzo, d fino a mm 300."}, {
 "101": ("Condotte fino a DN 80.", 154.0), "102": ("Condotte fino a DN 150.", 187.0), "201": ("Condotte fino a DN 80.", 124.0), "202": ("Condotte fino a DN 150.", 155.0),
 "301": ("Condotte fino a DN 80.", 195.0), "302": ("Condotte fino a DN 150.", 255.0),
 "401": ("Realizzazione dell'introduzione nell'edificio secondo le specifiche di Swisscom, compresa la consegna di tutti i materiali necessari; up = pezzi. Prestazioni: foro/rottura del muro, fornitura e posa di un tubo in acciaio da 2 pollici, chiusura del foro, intonacatura, sigillatura all'esterno, fornitura e installazione del manicotto di transizione su K55", 324.0),
 "402": ("Messa in sicurezza e protezione di sistemi di cavi, giunti e simili nei pozzetti durante il funzionamento, compresa la rimozione e lo smaltimento delle misure di protezione; up = numero di pozzetti", 355.0)}),
"151/711": ("Fornitura di aggregati naturali sul luogo d'impiego o al deposito intermedio, compreso lo scarico.", {"100": "Computo: volume materiale sciolto.",
  "110": "Miscele senza legante secondo la norma SN EN 13 242.", "120": "Aggregati secondo la norma SN EN 12 620."}, {
 "111": ("Sabbia 0/4.", 69.0), "112": ("Ghiaia 4/8.", 79.0), "113": ("Ghiaia 16/22.", 78.4), "114": ("Misto granulare 0/16, non gelivo.", 64.45),
 "115": ("Misto granulare 0/22, non gelivo.", 64.45), "116": ("Misto granulare 0/45, non gelivo.", 51.5), "123": ("Aggregato per calcestruzzo 0/16.", 78.6)}),
"151/721": ("Materiale per letto di posa, rinfianco e copertura nella zona di avvolgimento di condotte, messa in opera e compattazione.", {"100": "Computo: volume materiale sciolto."}, {
 "101": ("Aggregati naturali o riciclati, esclusa la fornitura.", 23.0)}),
"151/731": ("Calcestruzzo per avvolgimento di condotte, fornitura, messa in opera e compattazione. Computo: volume materiale compatto.", {"100": "Calcestruzzo confezionato con aggregati naturali o riciclati."}, {
 "101": ("Calcestruzzo, dosaggio di cemento kg/m3 200, D_max 16.", 236.0)}),
"151/741": ("Riempimento con materiale dal deposito intermedio laterale o materiale di riporto.", {"100": "Computo: volume materiale sciolto.", "110": "A macchina.", "120": "A mano."}, {
 "111": ("Materiale di scavo.", 15.0), "112": ("Aggregati naturali.", 13.5), "121": ("Materiale di scavo.", 47.0), "122": ("Aggregati naturali.", 39.6)}),
"151/751": ("Plania intermedia a qualsiasi profondità della trincea, senza apporto di materiale supplementare.", {"100": "Larghezza della plania fino a m 1,0.", "200": "Larghezza della plania superiore a m 1,0."}, {
 "101": ("Tolleranza dalla quota teorica +/- mm 30.", 2.9), "102": ("Tolleranza dalla quota teorica +/- mm 60.", 2.2), "201": ("Tolleranza dalla quota teorica +/- mm 30.", 2.2), "202": ("Tolleranza dalla quota teorica +/- mm 60.", 1.5)}),
"151/752": ("Fornitura e posa di geotessili. Computo: superficie ricoperta.", {}, {"001": ("Funzione separare", 4.1)}),
"151/754": ("Messa in opera di calcestruzzo di sottofondo e sottomurazione di tubi, condotte e simili.", {"100": "Calcestruzzo, compresa la fornitura."}, {"101": ("Calcestruzzo, dosaggio di cemento kg/m3 200.", 283.0)}),
"151/757": ("Carico di materiale dal deposito intermedio ordinato dal committente.", {"100": "A macchina.", "110": "Computo: volume materiale sciolto.", "120": "Computo: volume materiale compatto.",
  "200": "A mano.", "210": "Computo: volume materiale sciolto.", "220": "Computo: volume materiale compatto."}, {
 "111": ("Materiale di scavo.", 4.0), "121": ("Materiale di scavo.", 5.0), "211": ("Materiale di scavo.", 32.0), "221": ("Materiale di scavo.", 40.0)}),
"151/761": ("Trasporti all'interno e all'esterno del cantiere, compreso lo scarico.", {"100": "Trasporto dal deposito intermedio del committente o dell'imprenditore. Computo: volume materiale sciolto.",
  "110": "Qualsiasi tipo di materiale, escluse le tasse."}, {"111": ("Distanza fino a m 100.", 6.5), "112": ("Distanza da m 101 a 200.", 8.0), "113": ("Distanza da m 201 a 500.", 10.5)}),
"151/771": ("Messa in opera di strati inferiore e superiore del suolo.", {"100": "Superfici orizzontali o con pendenza fino a 1:4.", "110": "A macchina.", "120": "A mano.",
  "200": "Scarpate e superfici con pendenza superiore a 1:4.", "210": "A macchina.", "220": "A mano."}, {
 "112": ("Strato superiore del suolo, spessore fino a m 0,30.", 2.2), "122": ("Strato superiore del suolo, spessore fino a m 0,30.", 7.9),
 "212": ("Strato superiore del suolo, spessore fino a m 0,30.", 2.9), "222": ("Strato superiore del suolo, spessore fino a m 0,30.", 11.1)}),
"151/772": ("Spianamento del materiale eccedente di strati inferiore e superiore del suolo, su ordine del committente.", {"100": "Computo: volume materiale compatto.", "110": "A macchina."}, {"112": ("Strato superiore del suolo.", 12.5)}),
"151/773": ("Profilatura e semina.", {"100": "Allentamento di terreni naturali e/o consolidati dal transito di mezzi, su ordine del committente.", "110": "Erpicatura."}, {
 "111": ("Strato inferiore del suolo.", 0.6), "112": ("Strato superiore del suolo.", 0.5)}),
"151/774": ("Semina di superfici e scarpate, compresa la fornitura della semente.", {"100": "Semina a secco."}, {"101": ("Superfici e scarpate, qualsiasi pendenza.", 0.8)}),
"151/775": ("Posa di tappeto erboso in zolle.", {}, {"001": ("A partire dal deposito intermedio laterale.", 4.7), "002": ("Compreso il trasporto fino a m 30 dal deposito intermedio.", 8.9)}),
# ---------------- 222 ----------------
"222/211": ("Fornitura di gneiss.", {"200": "Cubetti e mocche resistenti al gelo e ai sali. Faccia superiore a spacco. Due facce fresate.", "210": "Cubetti.", "220": "Mocche.",
  "400": "Cordonetti tipo SN, resistenti al gelo e ai sali. Faccia superiore fresata. Faccia anteriore in vista a spacco.", "410": "Elementi diritti, lunghezze da mm 800 a 1'500."}, {
 "211": ("Tipo 8/11.", 10.8), "212": ("Tipo 11/13.", 16.7), "221": ("Tipo 10.", 23.0), "222": ("Tipo 12.", 34.0),
 "412": ("Tipo SN 8, mm 80x min mm 250.", 43.2), "413": ("Tipo SN 10, mm 100x min mm 250.", 55.4)}),
"222/212": ("Fornitura di granito.", {"200": "Cubetti e mocche resistenti al gelo e ai sali. Faccia superiore fresata e irruvidita.", "210": "Cubetti.", "220": "Mocche.",
  "300": "Cordonetti tipo SN, resistenti al gelo e ai sali. Faccia superiore irruvidita.", "310": "Elementi diritti, lunghezze da mm 800 a 1'500, faccia anteriore in vista fresata."}, {
 "211": ("Tipo 8/11.", 11.4), "212": ("Tipo 11/13.", 17.8), "221": ("Tipo 10.", 24.4), "222": ("Tipo 12.", 35.7),
 "312": ("Tipo SN 8, mm 80x min mm 250.", 45.1), "313": ("Tipo SN 10, mm 100x min mm 250.", 57.9)}),
"222/311": ("Posa di cubetti, mocche, masselli di demarcazione, masselli e mattonelle scorriacqua. In rettilineo e in curva.",
 {"100": "A una fila. In bauletto di calcestruzzo, su strato di fondazione sciolto. Compresa la fugatura con malta resistente al gelo e ai sali.",
  "110": "Classe di traffico ZP, TL e T1. Bauletto di calcestruzzo CEM 42,5 kg/m3 200 fino a 250.",
  "300": "A due file, 1 fila scalata o inclinata, con pietre dello stesso spessore. In bauletto di calcestruzzo, su strato di fondazione sciolto.",
  "310": "Classe di traffico ZP, TL e T1. Bauletto di calcestruzzo CEM 42,5 kg/m3 200 fino a 250."}, {
 "111": ("Tipo 8/11, fabbisogno di calcestruzzo m3/m 0,050.", 38.5), "112": ("Tipo 11/13, fabbisogno di calcestruzzo m3/m 0,060.", 44.5),
 "311": ("Tipo 8/11, fabbisogno di calcestruzzo m3/m 0,070.", 71.0), "312": ("Tipo 11/13, fabbisogno di calcestruzzo m3/m 0,080.", 74.0)}),
"222/321": ("Posa di cordonetti. In rettilineo e in curva. Esclusa la sigillatura delle fughe.", {"100": "In bauletto di calcestruzzo, su strato di fondazione sciolto.",
  "120": "Classi di traffico TL e da T1 a T4. Bauletto di calcestruzzo CEM 42,5 kg/m3 200 fino a 250."}, {
 "122": ("Tipo SN o SB 8, da mm 80x min mm 250, fabbisogno di calcestruzzo m3/m 0,105.", 35.0), "123": ("Tipo SN o SB 10, da mm 100x min mm 250, fabbisogno di calcestruzzo m3/m 0,110.", 47.0)}),
"222/551": ("Selciato in blocchetti autobloccanti di calcestruzzo e cubetti di calcestruzzo, compresi il letto di posa e il riempimento delle fughe.", {"100": "Classe di traffico ZP e TL."}, {
 "102": ("Spessore pietre mm 60.", 45.5), "103": ("Spessore pietre mm 80.", 52.4)}),
"222/571": ("Lavori accessori per tutti i generi di selciature in calcestruzzo.", {"200": "Taglio di blocchetti autobloccanti, cubetti di calcestruzzo ed elementi grigliati, compreso l'adattamento.", "210": "Ad angolo retto."}, {
 "211": ("Spessore blocchetti fino a mm 60.", 19.0)}),
"222/572": ("Supplementi a tutti i generi di selciature in calcestruzzo.", {"300": "Per posa con calcestruzzo e rinforzo dei bordi.", "310": "Posa con calcestruzzo, comprese tutte le forniture. Classe di traffico ZP e TL."}, {
 "311": ("Calcestruzzo CEM 42.5 kg/m3 200-250", 18.6)}),
"222/711": ("Posa di lastre in pietra naturale, compresi il letto di posa e il riempimento delle fughe.", {"100": "Classe di traffico ZP e TL.", "110": "Lastre rettangolari, larghezza da mm 300 a 600."}, {
 "111": ("Spessore lastre mm 40.", 62.0), "112": ("Spessore lastre mm 50.", 67.0)}),
"222/751": ("Lastricatura con lastre di calcestruzzo, compresi il letto di posa di sabbia o pietrischetto, lastre accostate.", {"100": "Classe di traffico ZP e TL.", "110": "Dimensioni fino a mm 500x500."}, {
 "111": ("Spessore lastre mm 40.", 48.0), "112": ("Spessore lastre mm 50.", 54.0)}),
})
IT.update({
"223/111": ("Attrezzature generali per lavori di pavimentazioni e lavori accessori.", {}, {"001": ("Per la durata delle prestazioni dell'imprenditore. Esecuzione in una tappa.", 450.0)}),
"223/131": ("Attrezzature per la messa in opera a macchina di miscela bituminosa cilindrata: installazione, messa a disposizione, spostamenti e allontanamento.",
 {"100": "Larghezza di messa in opera fino a m 2,5.", "200": "Larghezza di messa in opera superiore a m 2,5.",
  "300": "Attrezzature per la messa in opera successiva dello strato di copertura dopo lo sgombero degli impianti generali di cantiere, larghezza fino a m 2,5.",
  "400": "Attrezzature per la messa in opera successiva dello strato di copertura dopo lo sgombero degli impianti generali di cantiere, larghezza superiore a m 2,5.",
  "700": "Tappe supplementari richieste dal committente."}, {
 "101": ("Per la durata delle prestazioni dell'imprenditore.", 1820.0), "201": ("Per la durata delle prestazioni dell'imprenditore.", 2250.0),
 "301": ("Per la durata delle prestazioni dell'imprenditore.", 1850.0), "401": ("Per la durata delle prestazioni dell'imprenditore.", 2300.0),
 "701": ("Concerne sottopos. .101.", 1750.0), "702": ("Concerne sottopos. .201.", 1750.0), "703": ("Concerne sottopos. .301.", 1750.0), "704": ("Concerne sottopos. .401.", 1750.0)}),
"223/132": ("Attrezzature per la messa in opera a mano di miscela bituminosa cilindrata: installazione, messa a disposizione, spostamenti e allontanamento.",
 {"100": "Attrezzature per la messa in opera di miscela bituminosa cilindrata.", "200": "Attrezzature per la messa in opera successiva dello strato di copertura dopo lo sgombero degli impianti generali di cantiere.",
  "300": "Tappe supplementari richieste dal committente."}, {
 "101": ("Per la durata delle prestazioni dell'imprenditore.", 750.0), "201": ("Per la durata delle prestazioni dell'imprenditore.", 750.0),
 "301": ("Concerne sottopos. .101.", 750.0), "302": ("Concerne sottopos. .201.", 750.0)}),
"223/221": ("Taglio di strati bituminosi.", {"100": "A mano, con scalpello su martello demolitore, fresa manuale a disco e simili.", "200": "A macchina, con fresa a disco, fresatrice con rotore e simili."}, {
 "101": ("Spessore strato fino a mm 50.", 9.1), "102": ("Spessore strato da mm 51 a 100.", 10.6), "103": ("Spessore strato da mm 101 a 150.", 12.6), "104": ("Spessore strato da mm 151 a 200.", 16.2),
 "201": ("Spessore strato fino a mm 50.", 8.05), "202": ("Spessore strato da mm 51 a 100.", 9.8), "203": ("Spessore strato da mm 101 a 150.", 11.9), "204": ("Spessore strato da mm 151 a 200.", 14.1)}),
"223/222": ("Rimozione di strati bituminosi.", {"100": "A mano.", "120": "Strati di miscela bituminosa cilindrata.", "200": "A macchina.", "220": "Strati di miscela bituminosa cilindrata."}, {
 "121": ("Spessore strato fino a mm 50.", 7.2), "122": ("Spessore strato da mm 51 a 100.", 8.9), "123": ("Spessore strato da mm 101 a 150.", 10.4), "124": ("Spessore strato da mm 151 a 200.", 15.9),
 "221": ("Spessore strato fino a mm 50.", 5.2), "222": ("Spessore strato da mm 51 a 100.", 6.5), "223": ("Spessore strato da mm 101 a 150.", 8.9), "224": ("Spessore strato da mm 151 a 200.", 11.8)}),
"223/241": ("Pulizia del sottofondo. Compresi lo sgombero e lo smaltimento dei residui.", {"100": "Pulizia a secco.", "110": "A mano.", "120": "A macchina.",
  "200": "Pulizia con acqua, con ugelli rotanti e dispositivo d'aspirazione, compresi carico, trasporto e smaltimento.", "210": "Con acqua, pressione idrica bar 200 (+/- bar 20).", "220": "Con acqua, pressione idrica da bar 201 a 500 (+/- bar 20)."}, {
 "111": ("Sottofondo bituminoso.", 1.0), "121": ("Sottofondo bituminoso.", 0.6), "211": ("Sottofondo bituminoso.", 0.6), "221": ("Sottofondo bituminoso.", 0.8)}),
"223/261": ("Trasporti intermedi con dumper o piccola caricatrice.", {"100": "Computo: volume materiale sciolto."}, {
 "101": ("Distanza fino a m 50.", 6.2), "102": ("Distanza da m 51 a 100.", 7.6), "103": ("Distanza da m 101 a 200.", 9.2), "104": ("Distanza da m 201 a 300.", 11.9)}),
"223/262": ("Trasporti all'interno e all'esterno del cantiere al deposito, compreso il carico, escluse le tasse di deposito. Computo: volume materiale sciolto.",
 {"200": "Per la discarica.", "220": "Materiale per discarica tipo B secondo OPSR (1)."}, {"227": ("Miscela bituminosa e asfalto fuso, non fresati. Contenuto di IPA fino a mg/kg 250.", 24.5)}),
"223/263": ("Trasporti all'interno e all'esterno del cantiere al deposito, compreso il carico, escluse le tasse di deposito. Computo: massa.",
 {"200": "Per la discarica.", "220": "Materiale per discarica tipo B secondo OPSR (1)."}, {"228": ("Miscela bituminosa e asfalto fuso, fresati. Contenuto di IPA fino a mg/kg 250.", 16.5)}),
"223/266": ("Tasse di smaltimento o di consegna di materiale, compresa la sistemazione al deposito. Computo: volume materiale sciolto.",
 {"100": "Discarica.", "120": "Materiale per discarica tipo B secondo OPSR (1)."}, {"127": ("Miscela bituminosa e asfalto fuso, non fresati. Contenuto di IPA fino a mg/kg 250.", 115.0)}),
"223/267": ("Tasse di smaltimento o di consegna di materiale, compresa la sistemazione al deposito. Computo: massa.",
 {"100": "Discarica.", "120": "Materiale per discarica tipo B secondo OPSR (1)."}, {"127": ("Miscela bituminosa e asfalto fuso, non fresati. Contenuto di IPA fino a mg/kg 250.", 79.0)}),
"223/271": ("Fornitura del materiale sul luogo di impiego o al deposito intermedio. Compreso lo scarico.",
 {"100": "Miscela senza legante secondo la norma SN 670 119-AN. Computo: volume materiale sciolto.", "110": "Aggregati naturali.", "120": "Misto granulare RC A.",
  "300": "Materiale per la plania, senza requisiti normativi. Computo: volume materiale sciolto.", "310": "Misto granulare per strati di usura stabilizzati con argilla e acqua.", "320": "Misto granulare per plania, con frazione frantumata."}, {
 "111": ("Misto granulare 0/16.", 67.8), "113": ("Misto granulare 0/45.", 53.2), "121": ("Misto granulare RC A 0/16.", 52.4), "123": ("Misto granulare RC A 0/45.", 46.8),
 "311": ("Misto granulare 0/16.", 118.0), "321": ("Misto granulare D_max mm 16.", 69.0), "322": ("Misto granulare D_max mm 22.", 65.5)}),
"223/272": ("Strati di fondazione, messa in opera, spianamento e cilindratura fino al raggiungimento della compattazione richiesta. Fornitura di materiale v. pos. 271.",
 {"100": "Miscela senza legante. Computo: volume materiale sciolto.", "110": "Larghezza di messa in opera fino a m 3,0.", "120": "Larghezza di messa in opera superiore a m 3,0."}, {
 "112": ("Spessore di messa in opera da mm 101 a 200.", 13.0), "113": ("Spessore di messa in opera da mm 201 a 300.", 11.0),
 "122": ("Spessore di messa in opera da mm 101 a 200.", 11.0), "123": ("Spessore di messa in opera da mm 201 a 300.", 9.0)}),
"223/282": ("Esecuzione della plania grezza. Messa in opera, spianamento e cilindratura del materiale fino al raggiungimento della compattazione richiesta.",
 {"100": "Su strati di fondazione.", "110": "Larghezza della plania grezza fino a m 3,0.", "120": "Larghezza della plania grezza superiore a m 3,0."}, {
 "111": ("Tolleranza dalla quota teorica +/- mm 30.", 4.5), "121": ("Tolleranza dalla quota teorica +/- mm 30.", 3.5)}),
"223/283": ("Esecuzione della plania. Messa in opera, spianamento e cilindratura del materiale fino al raggiungimento della compattazione richiesta.",
 {"100": "Su strati di fondazione per strade con pavimentazione.", "110": "Larghezza della plania fino a m 3,0.", "120": "Larghezza della plania superiore a m 3,0.",
  "200": "Su strati di fondazione per strade senza pavimentazione.", "210": "Larghezza della plania fino a m 3,0.", "220": "Larghezza della plania superiore a m 3,0."}, {
 "111": ("Tolleranza dalla quota teorica +/- mm 10.", 6.0), "121": ("Tolleranza dalla quota teorica +/- mm 10.", 5.0), "211": ("Tolleranza dalla quota teorica +/- mm 10.", 6.0), "221": ("Tolleranza dalla quota teorica +/- mm 10.", 5.0)}),
"223/422": ("Applicazione di un prodotto per il miglioramento dell'adesione.", {"100": "Applicazione sul sottofondo di un prodotto idoneo per garantire l'adesione fra gli strati. Compresa la fornitura del materiale."}, {
 "101": ("Prodotto per il miglioramento dell'adesione tipo HCB4.", 2.0), "102": ("Prodotto per il miglioramento dell'adesione tipo HCBP4.", 2.2)}),
"223/423": ("Esecuzione di giunti longitudinali e trasversali.", {"100": "Taglio preliminare di una striscia della corsia con fresatrice a disco, larghezza da mm 50 a 100, compresi carico, trasporto, smaltimento e pulitura.",
  "110": "Taglio mediante fresatrice con disco diamantato.", "200": "Spalmatura delle superfici di taglio, compresa la pulitura preliminare e la fornitura del materiale.", "210": "Bitume a caldo.", "220": "Prodotto da spalmare.",
  "300": "Posa di nastri bituminosi per giunti, comprese la pulitura e la spalmatura."}, {
 "111": ("Spessore strato fino a mm 40.", 8.2), "112": ("Spessore strato da mm 41 a 80.", 9.1), "113": ("Spessore strato da mm 81 a 130.", 10.4),
 "211": ("Spessore strato fino a mm 40.", 2.5), "212": ("Spessore strato da mm 41 a 80.", 3.1), "213": ("Spessore strato da mm 81 a 130.", 3.9),
 "221": ("Spessore strato fino a mm 40.", 2.2), "222": ("Spessore strato da mm 41 a 80.", 3.1), "223": ("Spessore strato da mm 81 a 130.", 3.9), "301": ("Secondo l'imprenditore", 9.8)}),
"223/424": ("Trattamento di superfici di raccordo, p.es. a pavimentazione esistente, a giunti di transizione, a delimitazioni e a elementi in opera. Compresa la fornitura del materiale.",
 {"100": "Spalmatura delle superfici di raccordo, compresa la pulitura preliminare.", "110": "Bitume a caldo.", "120": "Prodotto da spalmare.", "200": "Posa di nastri bituminosi per giunti, comprese la pulitura e la spalmatura."}, {
 "111": ("Spessore strato fino a mm 40.", 2.7), "112": ("Spessore strato da mm 41 a 80.", 3.8), "113": ("Spessore strato da mm 81 a 130.", 4.5),
 "121": ("Spessore strato fino a mm 40.", 2.4), "122": ("Spessore strato da mm 41 a 80.", 3.5), "123": ("Spessore strato da mm 81 a 130.", 4.4), "201": ("Secondo l'imprenditore", 9.8)}),
"223/431": ("Strato portante AC T tipo L: fornitura, messa in opera a macchina e compattazione.", {"200": "AC T 16 L.", "210": "Computo: massa."}, {
 "212": ("Spessore mm 50.", 165.0), "214": ("Spessore mm 60.", 159.0), "216": ("Spessore mm 70.", 153.0)}),
"223/432": ("Strati di usura AC tipo L: fornitura, messa in opera a macchina e compattazione.", {"100": "AC 4 L.", "110": "Computo: massa.", "200": "AC 8 L.", "210": "Computo: massa."}, {
 "112": ("Spessore mm 20.", 235.0), "211": ("Spessore mm 20.", 227.0), "213": ("Spessore mm 30.", 212.0)}),
"223/434": ("Miscela tipo L per adattamenti, piazzali, accessi e simili: fornitura, messa in opera a mano e compattazione.", {"100": "Strati di base AC T tipo L. Computo: massa.", "110": "AC T 11 L.", "120": "AC T 16 L.", "130": "AC T 22 L."}, {
 "111": ("Spessore fino a mm 40", 198.0), "121": ("Spessore fino a mm 70", 178.0), "131": ("Spessore fino a mm 90", 168.0)}),
"223/435": ("Supplementi alla miscela bituminosa AC tipo L.", {"200": "Per la fornitura della miscela in benne o sili termici."}, {"201": ("Concerne pos. 430.", 4.0)}),
"223/441": ("Strato portante AC T tipo N: fornitura, messa in opera a macchina e compattazione.", {"200": "AC T 16 N.", "210": "Computo: massa.", "300": "AC T 22 N.", "310": "Computo: massa."}, {
 "212": ("Spessore mm 50.", 157.0), "214": ("Spessore mm 60.", 153.0), "216": ("Spessore mm 70.", 149.0), "311": ("Spessore mm 60.", 145.0), "312": ("Spessore mm 70.", 143.0),
 "313": ("Spessore mm 80.", 155.6), "314": ("Spessore mm 90.", 141.0), "315": ("Spessore mm 100.", 139.0)}),
"223/442": ("Strati di usura AC tipo N: fornitura, messa in opera a macchina e compattazione.", {"100": "AC 8 N.", "110": "Computo: massa.", "200": "AC 11 N.", "210": "Computo: massa."}, {
 "111": ("Spessore mm 20.", 225.0), "112": ("Spessore mm 25.", 219.0), "113": ("Spessore mm 30.", 207.0), "114": ("Spessore mm 35.", 202.0), "211": ("Spessore mm 35.", 185.0), "212": ("Spessore mm 40.", 181.0)}),
"223/444": ("Miscela tipo N per adattamenti, piazzali, accessi e simili: fornitura, messa in opera a mano e compattazione.",
 {"100": "Strati di base AC T tipo N. Computo: massa.", "120": "AC T 16 N.", "130": "AC T 22 N.", "200": "Strati di usura AC tipo N. Computo: massa.", "210": "AC 8 N.", "220": "AC 11 N."}, {
 "121": ("Spessore fino a mm 70", 198.0), "131": ("Spessore fino a mm 90", 189.0), "211": ("Spessore fino a mm 35", 278.0), "221": ("Spessore fino a mm 40", 268.0)}),
"223/446": ("Supplementi alla miscela bituminosa AC tipo N.", {"200": "Per la fornitura della miscela in benne o sili termici."}, {"201": ("Concerne pos. 440.", 4.0)}),
"223/571": ("Taglio dei bordi dello strato di usura lungo delimitazioni ed elementi in opera.", {"100": "Taglio dei bordi a mano o a macchina, compresi carico, trasporto, smaltimento del materiale eccedente e pulitura."}, {
 "101": ("Elementi di delimitazione.", 4.0), "102": ("Coperture di pozzetti, DN 600.", 38.0), "105": ("Coperture di superficie; up = m", 9.5)}),
"223/921": ("Posa di dispositivi provvisori di chiusura per pozzetti carrozzabili in lamiera di acciaio, compresi trasporti, posa, fissaggio e messa a disposizione.", {}, {
 "001": ("Rotondi fino a NW 800 mm", 38.0)}),
"223/926": ("Innalzamento al livello dello strato di usura delle coperture per pozzetti regolabili in altezza dopo la messa in opera dello strato di copertura.",
 {"100": "Coperture per pozzetti.", "110": "Coperture chiuse."}, {"111": ("Copertura completamente in ghisa NW 600, classe D400", 249.0)}),
})
