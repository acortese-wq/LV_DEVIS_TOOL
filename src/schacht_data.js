/* Daten aus "Auswahl Schachtbau und Abdeckungen" (A. Cortese), unverändert übernommen; P -> SP, T -> TS */
var DOC_BASE = "";
/* Normendatenbank Wireline, gefiltert auf Domain "Canalisation".
   Solange DOC_BASE leer ist, führen alle Dokumentlinks hierhin.       */
var DMS_URL = "https://swisscom.sharepoint.com/sites/access-dms-wireline/WirelineNorms/Forms/AllItems.aspx?useFiltersInViewXml=1&FilterField1=Domain&FilterValue1=Canalisation&FilterType1=MultiChoice&FilterOp1=Eq";
var HGC_CATEGORY = "https://www.hgc.ch/de/Tiefbau-%7C-Gartenbau/Rohre%2C-Sch%C3%A4chte%2C-Abdeckungen/Spezialtiefbauprodukte/Swisscom-Produkte/c/m_5356";
var HGC_PRODUCT = {
  /* Geprüfte Direktlinks. Weitere über "HGC-Produktlinks" im Formular ergänzen
     und die Tabelle anschliessend hier einsetzen.                            */
  "1370899":"https://www.hgc.ch/de/Tiefbau-%7C-Gartenbau/Rohre,-Sch%C3%A4chte,-Abdeckungen/Spezialtiefbauprodukte/Swisscom-Produkte/Schachtabdeckung-mit-Betonsockel---Appenzeller/p/100056789",
  "1374388":"https://www.hgc.ch/de/Tiefbau-%7C-Gartenbau/Rohre%2C-Sch%C3%A4chte%2C-Abdeckungen/Spezialtiefbauprodukte/Swisscom-Produkte/Rahmen-o-Betonuntersatz-Deckel-Vollguss/p/100058834"
};
function hgcSearch(art){
  return "https://www.hgc.ch/de/search?text=" + encodeURIComponent(art.split(".").join(""));
}
function hgcLink(art){
  return HGC_PRODUCT[art] || (/^\d/.test(art) ? hgcSearch(art) : HGC_CATEGORY);
}

/* ---------- Produktstamm (SCS Art.-Nr., Gewichte ab BGS-Zeichnungen) ---------- */
var SP = {
  "137.353.9":{kg:null,doc:null,hgcq:"Nivroll Schachtabdeckung Rahmen D400",
    n:{de:"Rahmen mit Betonuntersatz Nivroll, NIVO D400, NW Ø 600 mm",
       fr:"Cadre avec collerette béton Nivroll, NIVO D400, NW Ø 600 mm",
       it:"Telaio con base in calcestruzzo Nivroll, NIVO D400, DN Ø 600 mm"}},
  "137.363.8":{kg:100,doc:null,hgcq:"Nivroll Vollgussdeckel D400 600",
    n:{de:"Vollguss-Deckel Nivroll D400, NW Ø 600 mm",
       fr:"Couvercle en fonte massive Nivroll D400, NW Ø 600 mm",
       it:"Coperchio in ghisa piena Nivroll D400, DN Ø 600 mm"}},
  "137.351.3":{kg:null,doc:null,hgcq:"Schachtabdeckung System DS 600 D400 Rahmen Betonuntersatz",
    n:{de:"Rahmen mit Betonuntersatz System DS, DS 600 – D400, NW Ø 600 mm",
       fr:"Cadre avec socle béton système DS, DS 600 – D400, NW Ø 600 mm",
       it:"Telaio con base in calcestruzzo sistema DS, DS 600 – D400, DN Ø 600 mm"}},
  "137.354.7":{kg:null,doc:null,hgcq:"Vollgussdeckel System DS 400",
    n:{de:"Vollguss-Deckel, nicht schliessbar, System DS400",
       fr:"Couvercle en fonte massive, non verrouillable, système DS400",
       it:"Coperchio in ghisa piena, non bloccabile, sistema DS400"}},
  "137.352.1":{kg:520,doc:null,hgcq:"Rahmen Betonuntersatz NIVO 130x130",
    n:{de:"Rahmen mit Betonuntersatz NIVO 130 × 130 cm, NW Ø 600 mm, höhenverstellbar",
       fr:"Cadre avec socle béton NIVO 130 × 130 cm, NW Ø 600 mm, réglable en hauteur",
       it:"Telaio con base in calcestruzzo NIVO 130 × 130 cm, DN Ø 600 mm, regolabile in altezza"}},
  "137.793.6":{kg:1012,doc:"Rahmen_und_Abdeckung_Lock_Grip_90x90cm_D400_mit_Betonsockel_137.793.6.pdf",hgcq:"BGS Lock Grip 90x90 D400 Betonsockel",
    n:{de:"Rahmen und Abdeckung Lock Grip 0.90 × 0.90 m D400, mit Betonsockel 1.90 × 1.40 m, 1-teilig",
       fr:"Cadre et couvercle Lock Grip 0.90 × 0.90 m D400, avec socle béton 1.90 × 1.40 m, 1 pièce",
       it:"Telaio e copertura Lock Grip 0.90 × 0.90 m D400, con base in calcestruzzo 1.90 × 1.40 m, monopezzo"}},
  "137.791.0":{kg:244,doc:"Rahmen_und_Abdeckung_Lock_Grip_90x90cm_D400_ohne_Betonsockel_137.791.0.pdf",hgcq:"BGS Lock Grip 90x90 D400",
    n:{de:"Rahmen und Abdeckung Lock Grip 0.90 × 0.90 m D400, ohne Betonsockel, 1-teilig",
       fr:"Cadre et couvercle Lock Grip 0.90 × 0.90 m D400, sans socle béton, 1 pièce",
       it:"Telaio e copertura Lock Grip 0.90 × 0.90 m D400, senza base in calcestruzzo, monopezzo"}},
  "137.794.4":{kg:1157,doc:"Rahmen_und_Abdeckung_Lock_Grip_180x90cm_D400_mit_Betonsockel_137.794.4.pdf",hgcq:"BGS Lock Grip 180x90 D400 Betonsockel",
    n:{de:"Rahmen und Abdeckung Lock Grip 1.80 × 0.90 m D400, mit Betonsockel 2.40 × 1.40 m, 2-teilig",
       fr:"Cadre et couvercle Lock Grip 1.80 × 0.90 m D400, avec socle béton 2.40 × 1.40 m, 2 pièces",
       it:"Telaio e copertura Lock Grip 1.80 × 0.90 m D400, con base in calcestruzzo 2.40 × 1.40 m, due pezzi"}},
  "137.792.8":{kg:455,doc:"Rahmen_und_Abdeckung_Lock_Grip_180x90cm_D400_ohne_Betonsockel_137.792.8.pdf",hgcq:"BGS Lock Grip 180x90 D400",
    n:{de:"Rahmen und Abdeckung Lock Grip 1.80 × 0.90 m D400, ohne Betonsockel, 2-teilig",
       fr:"Cadre et couvercle Lock Grip 1.80 × 0.90 m D400, sans socle béton, 2 pièces",
       it:"Telaio e copertura Lock Grip 1.80 × 0.90 m D400, senza base in calcestruzzo, due pezzi"}},
  "137.789.4":{kg:847,doc:"Rahmen_Inlay_Grip_NW_90x90cm_D400_mit_Betonsockel_137.789.4.pdf",hgcq:"BGS Inlay Grip Rahmen 90x90 D400 Betonsockel",
    n:{de:"Gussrahmen Inlay Grip 0.90 × 0.90 m D400, mit Betonsockel 1.40 × 1.90 m, ohne Deckel",
       fr:"Cadre en fonte Inlay Grip 0.90 × 0.90 m D400, avec socle béton 1.40 × 1.90 m, sans couvercle",
       it:"Telaio in ghisa Inlay Grip 0.90 × 0.90 m D400, con base in calcestruzzo 1.40 × 1.90 m, senza coperchio"}},
  "137.788.6":{kg:95,doc:"Rahmen_Inlay_Grip_NW_90x90cm_D400_ohne_Betonsockel_137.788.6.pdf",hgcq:"BGS Inlay Grip Rahmen 90x90 D400",
    n:{de:"Gussrahmen Inlay Grip 0.90 × 0.90 m D400, ohne Betonsockel, ohne Deckel",
       fr:"Cadre en fonte Inlay Grip 0.90 × 0.90 m D400, sans socle béton, sans couvercle",
       it:"Telaio in ghisa Inlay Grip 0.90 × 0.90 m D400, senza base in calcestruzzo, senza coperchio"}},
  "137.427.1":{kg:790,doc:"Rahmen_Inlay_Grip_NW_180x90cm_D400_mit_Betonsockel_137.427.1.pdf",hgcq:"BGS Gussrahmen 900x1855 D400 Betonsockel KES",
    n:{de:"Gussrahmen 1.80 × 0.90 m D400 (KES 1.0 × 2.0), mit Betonsockel 1.40 × 2.40 m, ohne Deckel",
       fr:"Cadre en fonte 1.80 × 0.90 m D400 (PChA 1.0 × 2.0), avec socle béton 1.40 × 2.40 m, sans couvercle",
       it:"Telaio in ghisa 1.80 × 0.90 m D400 (KES 1.0 × 2.0), con base in calcestruzzo 1.40 × 2.40 m, senza coperchio"}},
  "137.426.3":{kg:148,doc:"Rahmen_Inlay_Grip_NW_180x90cm_D400_ohne_Betonsockel_137.426.3.pdf",hgcq:"BGS Gussrahmen 900x1855 D400 KES",
    n:{de:"Gussrahmen 1.80 × 0.90 m D400 (KES 1.0 × 2.0), ohne Betonsockel, ohne Deckel",
       fr:"Cadre en fonte 1.80 × 0.90 m D400 (PChA 1.0 × 2.0), sans socle béton, sans couvercle",
       it:"Telaio in ghisa 1.80 × 0.90 m D400 (KES 1.0 × 2.0), senza base in calcestruzzo, senza coperchio"}},
  "137.790.2":{kg:183,doc:"Abdeckung_Inlay_Grip_90x90cm_D400_137.790.2.pdf",hgcq:"BGS Inlay Grip Abdeckung 90x90 D400",
    n:{de:"Vollguss-Deckel Inlay Grip 0.90 × 0.90 m D400, Spezialoberfläche GRIP",
       fr:"Couvercle en fonte massive Inlay Grip 0.90 × 0.90 m D400, surface spéciale GRIP",
       it:"Coperchio in ghisa piena Inlay Grip 0.90 × 0.90 m D400, superficie speciale GRIP"}},
  "137.787.8":{kg:170,doc:"Abdeckung_Inlay_Grip_60x90cm_D400_137.787.8.pdf",hgcq:"BGS Inlay Grip Abdeckung 60x90 D400",
    n:{de:"Vollguss-Deckel Inlay Grip 0.60 × 0.90 m D400, Deckelersatz für BGS-Rahmen 120 × 90 cm",
       fr:"Couvercle en fonte massive Inlay Grip 0.60 × 0.90 m D400, remplacement pour cadre BGS 120 × 90 cm",
       it:"Coperchio in ghisa piena Inlay Grip 0.60 × 0.90 m D400, ricambio per telaio BGS 120 × 90 cm"}},
  "BETONPLATTE":{kg:null,doc:null,hgcq:"Betonplatte Schachtabdeckung 120 27 BGS",
    n:{de:"Betonplatten 120/27, Guss/Beton BGS (Wiesland, Parzelle)",
       fr:"Dalles béton 120/27, fonte/béton BGS (prairie, parcelle)",
       it:"Lastre in calcestruzzo 120/27, ghisa/calcestruzzo BGS (prato, particella)"}},
  "DS600BETON":{kg:null,doc:null,hgcq:"Schachtabdeckung DS 600 Betondeckel",
    n:{de:"DS 600 – D400 mit Betondeckel (Art.-Nr. projektbezogen bei VNI bestätigen)",
       fr:"DS 600 – D400 avec couvercle béton (n° d'article à confirmer auprès de VNI)",
       it:"DS 600 – D400 con coperchio in calcestruzzo (cod. art. da confermare con VNI)"}}
};


/* ---------- LV-Preise (LV/Preisliste V1.1 vom 10.07.2026, cablex AG) ----------
   [Position liefern, EP liefern, Position versetzen, EP versetzen]          */
var LV_ART = {
  "137.353.9":["632.134",361,"632.234",182],
  "137.363.8":["632.135",197,"632.235",85],
  "137.351.3":["632.131",358,"632.231",174],
  "137.354.7":["632.136",181,"632.236",85],
  "137.352.1":["632.133",809,"632.233",247],
  "137.788.6":["632.155",464,"632.255",995],
  "137.789.4":["632.156",1260,"632.256",294],
  "137.790.2":["632.157",1156,"632.257",124],
  "137.426.3":["632.152",641,"632.252",1205],
  "137.427.1":["632.154",1533,"632.254",318],
  "137.791.0":["632.158",2435,"632.258",995],
  "137.793.6":["632.159",3312,"632.259",442],
  "137.792.8":["632.161",3779,"632.261",1205],
  "137.794.4":["632.162",4894,"632.262",515]
};
Object.keys(LV_ART).forEach(k=>{
  if(SP[k]){SP[k].posL=LV_ART[k][0];SP[k].epL=LV_ART[k][1];SP[k].posV=LV_ART[k][2];SP[k].epV=LV_ART[k][3];}
});

/* ---------- Zusatzpositionen aus dem LV ---------- */
var OPTS = [
 {id:"abbrGuss",npk:"117",pos:"228.301",unit:"St",ep:56.00,
  n:{de:"Abbruch Schachtabdeckung Guss, rund bis NW 800",fr:"Démolition couvercle fonte, rond jusqu'à NW 800",it:"Demolizione copertura in ghisa, tonda fino a NW 800"}},
 {id:"abbrBeton",npk:"117",pos:"228.302",unit:"St",ep:39.00,
  n:{de:"Abbruch Schachtabdeckung Beton, rund bis NW 800",fr:"Démolition couvercle béton, rond jusqu'à NW 800",it:"Demolizione copertura in calcestruzzo, tonda fino a NW 800"}},
 {id:"abbrFlaeche",npk:"117",pos:"228.303",unit:"St",ep:198.00,
  n:{de:"Abbruch Flächenabdeckung rechteckig bis 3.00 m²",fr:"Démolition couverture rectangulaire jusqu'à 3.00 m²",it:"Demolizione copertura rettangolare fino a 3.00 m²"}},
 {id:"abbrPlatten",npk:"117",pos:"228.202",unit:"St",ep:16.90,
  n:{de:"Abbruch Abdeckplatten Plattenschacht 120 × 27 cm",fr:"Démolition dalles de couverture 120 × 27 cm",it:"Demolizione lastre di copertura 120 × 27 cm"}},
 {id:"abbrKS",npk:"117",pos:"228.101",unit:"St",ep:322.00,
  n:{de:"Abbruch Kontrollschacht bis NW 1000, Höhe bis 1.50 m",fr:"Démolition chambre de contrôle jusqu'à NW 1000",it:"Demolizione pozzetto di controllo fino a NW 1000"}},
 {id:"abbrPLS",npk:"117",pos:"228.102",unit:"St",ep:498.00,
  n:{de:"Abbruch Plattenschacht bis 2.00 × 1.00 × 0.90 m",fr:"Démolition chambre à dalles jusqu'à 2.00 × 1.00 × 0.90 m",it:"Demolizione pozzetto a lastre fino a 2.00 × 1.00 × 0.90 m"}},
 {id:"ring600",npk:"151",pos:"631.111",unit:"St",ep:162.00,
  n:{de:"Schachtring DN 600, h bis 0.50 m, liefern und versetzen",fr:"Anneau DN 600, h jusqu'à 0.50 m, fourni et posé",it:"Anello DN 600, h fino a 0.50 m, fornito e posato"}},
 {id:"ring800",npk:"151",pos:"631.112",unit:"St",ep:215.00,
  n:{de:"Brunnenring DN 800, h bis 0.50 m, liefern und versetzen",fr:"Anneau de puits DN 800, h jusqu'à 0.50 m, fourni et posé",it:"Anello di pozzo DN 800, h fino a 0.50 m, fornito e posato"}},
 {id:"hoeherRund",npk:"151",pos:"633.001",unit:"St",ep:235.00,
  n:{de:"Abdeckung höhersetzen, rund, bis 0.50 m",fr:"Rehausser couvercle rond, jusqu'à 0.50 m",it:"Rialzo copertura tonda, fino a 0.50 m"}},
 {id:"hoeherEckig",npk:"151",pos:"633.002",unit:"St",ep:1850.00,
  n:{de:"Abdeckung höhersetzen, rechteckig bis 2.40 × 1.40 m",fr:"Rehausser couverture rectangulaire jusqu'à 2.40 × 1.40 m",it:"Rialzo copertura rettangolare fino a 2.40 × 1.40 m"}},
 {id:"tieferRund",npk:"151",pos:"634.001",unit:"St",ep:284.00,
  n:{de:"Abdeckung tiefersetzen, rund, bis 0.50 m",fr:"Abaisser couvercle rond, jusqu'à 0.50 m",it:"Abbassamento copertura tonda, fino a 0.50 m"}},
 {id:"tieferEckig",npk:"151",pos:"634.002",unit:"St",ep:1500.00,
  n:{de:"Abdeckung tiefersetzen, rechteckig bis 2.40 × 1.40 m",fr:"Abaisser couverture rectangulaire jusqu'à 2.40 × 1.40 m",it:"Abbassamento copertura rettangolare fino a 2.40 × 1.40 m"}},
 {id:"randRund",npk:"223",pos:"571.102",unit:"St",ep:38.00,
  n:{de:"Deckschichtrand abschneiden, Schachtabdeckung DN 600",fr:"Découpe bord de couche de roulement, couvercle DN 600",it:"Taglio bordo strato d'usura, copertura DN 600"}},
 {id:"randFlaeche",npk:"223",pos:"571.105",unit:"m",ep:9.50,
  n:{de:"Deckschichtrand abschneiden, Flächenabdeckung",fr:"Découpe bord de couche de roulement, couverture de surface",it:"Taglio bordo strato d'usura, copertura di superficie"}},
 {id:"provAbd",npk:"223",pos:"921.001",unit:"St",ep:38.00,
  n:{de:"Provisorisch befahrbare Abdeckung, rund bis NW 800",fr:"Couvercle provisoire carrossable, rond jusqu'à NW 800",it:"Copertura provvisoria carrabile, tonda fino a NW 800"}},
 {id:"nivrollHoch",npk:"223",pos:"926.111",unit:"St",ep:249.00,
  n:{de:"Nivroll NW 600 D400 auf Deckschicht hochziehen",fr:"Remonter Nivroll NW 600 D400 au niveau de la couche",it:"Sollevamento Nivroll NW 600 D400 a livello del manto"}},
 {id:"ansch80",npk:"151",pos:"672.201",unit:"St",ep:124.00,
  n:{de:"Leitungsanschluss an vorgefertigten Schacht, bis DN 80",fr:"Raccordement sur chambre préfabriquée, jusqu'à DN 80",it:"Allacciamento a pozzetto prefabbricato, fino a DN 80"}},
 {id:"ansch150",npk:"151",pos:"672.202",unit:"St",ep:155.00,
  n:{de:"Leitungsanschluss an vorgefertigten Schacht, bis DN 150",fr:"Raccordement sur chambre préfabriquée, jusqu'à DN 150",it:"Allacciamento a pozzetto prefabbricato, fino a DN 150"}}
];

/* ---------- Einbauorte ---------- */
var LOCS = [
  {id:"HLS",norm:"VSS 40041",speed:"≥ 80 km/h",cover:"lock",round:"nivo",group:"fast",shafts:"none",
   n:{de:"Hochleistungsstrasse HLS",fr:"Route à grand débit RGD",it:"Strada ad alte prestazioni"},
   h:{de:"Ausbaugeschwindigkeit 80–120 km/h. Gemäss Tabelle sind hier keine SCS-Schächte vorgesehen.",
      fr:"Vitesse de base 80–120 km/h. Selon le tableau, aucune chambre SCS n'est prévue ici.",
      it:"Velocità di progetto 80–120 km/h. Secondo la tabella non sono previsti pozzetti SCS."}},
  {id:"HVS",norm:"VSS 40042",speed:"≥ 60 km/h",cover:"lock",round:"nivo",group:"fast",shafts:"avoid",
   n:{de:"Hauptverkehrsstrasse HVS",fr:"Route principale RP",it:"Strada principale"},
   h:{de:"Ausbaugeschwindigkeit 60–80 km/h. ES/KES sind zu vermeiden.",
      fr:"Vitesse de base 60–80 km/h. ChA/PChA sont à éviter.",
      it:"Velocità di progetto 60–80 km/h. ES/KES da evitare."}},
  {id:"VS50",norm:"VSS 40043",speed:"≥ 50 km/h",cover:"lock",round:"nivo",group:"fast",shafts:"ok",
   n:{de:"Verbindungsstrasse VS, ≥ 50 km/h",fr:"Route de liaison RL, ≥ 50 km/h",it:"Strada di collegamento, ≥ 50 km/h"},
   h:{de:"Ausbaugeschwindigkeit 50–80 km/h. Zulässig: ES/KES/KS.",
      fr:"Vitesse de base 50–80 km/h. Admis : ChA/PChA/CHC.",
      it:"Velocità di progetto 50–80 km/h. Ammessi: ES/KES/KS."}},
  {id:"VS49",norm:"VSS 40043",speed:"< 50 km/h",cover:"inlay",round:"nivo",group:"slow",shafts:"ok",
   n:{de:"Verbindungsstrasse VS, < 50 km/h",fr:"Route de liaison RL, < 50 km/h",it:"Strada di collegamento, < 50 km/h"},
   h:{de:"Zulässig: ES/KES/KS.",fr:"Admis : ChA/PChA/CHC.",it:"Ammessi: ES/KES/KS."}},
  {id:"SS",norm:"VSS 40044",speed:"≤ 50 km/h",cover:"inlay",round:"nivo",group:"slow",shafts:"ok",
   n:{de:"Sammelstrasse SS",fr:"Route collectrice RC",it:"Strada di raccolta"},
   h:{de:"Bis 800 Fz/h. Zulässig: ES/KES/KS.",fr:"Jusqu'à 800 vhc./h. Admis : ChA/PChA/CHC.",it:"Fino a 800 veic./h. Ammessi: ES/KES/KS."}},
  {id:"ESS",norm:"VSS 40045",speed:"≤ 50 km/h",cover:"inlay",round:"nivo",group:"slow",shafts:"ok",
   n:{de:"Erschliessungsstrasse ES",fr:"Route de desserte RD",it:"Strada di accesso"},
   h:{de:"Bis 150 Fz/h. Zulässig: ES/KES/KS.",fr:"Jusqu'à 150 vhc./h. Admis : ChA/PChA/CHC.",it:"Fino a 150 veic./h. Ammessi: ES/KES/KS."}},
  {id:"GEH",norm:"—",speed:"—",cover:"inlay",round:"ds",group:"slow",shafts:"ok",
   n:{de:"Gehweg / Trottoir / Vorplatz",fr:"Trottoir / autres espaces libres",it:"Marciapiede / piazzale"},
   h:{de:"Rund: DS 600 – D400. Zulässig: ES/KES/KS.",fr:"Rond : DS 600 – D400. Admis : ChA/PChA/CHC.",it:"Tondo: DS 600 – D400. Ammessi: ES/KES/KS."}},
  {id:"WIES",norm:"—",speed:"—",cover:"platte",round:"dsbeton",group:"green",shafts:"ok",
   n:{de:"Wiesland / Parzelle",fr:"Prairie / parcelle",it:"Prato / particella"},
   h:{de:"Zulässig: PLS/KES/KS. Eckig: Betonplatten 120/27.",fr:"Admis : (PLS)/PChA/CHC. Anguleux : dalles béton 120/27.",it:"Ammessi: PLS/KES/KS. Angolare: lastre 120/27."}}
];

/* ---------- Schachttypen und Grössen ---------- */
var SHAFTS = {
  ES:{plan:"151.621.022_dt",docFile:"151.621.022_dt_ES_Einstiegschacht_ohne_Muendungstrichter.pdf",
      n:{de:"ES – Einstiegschacht",fr:"ChA – chambre à accès",it:"ES – pozzetto d'accesso"}},
  KES:{plan:"151.621.011_dt",docFile:"151.621.011_dt_KES_Kleineinstiegschacht.pdf",
      n:{de:"KES – Kleineinstiegschacht",fr:"PChA – petite chambre à accès",it:"KES – pozzetto piccolo d'accesso"}},
  KS:{plan:"151.611.114_dt",docFile:"151.611.114_dt_KS_Kontrollschacht_Brunnenring.pdf",
      n:{de:"KS – Kontrollschacht Brunnenring Ø 80",fr:"CHC – chambre de contrôle Ø 80",it:"KS – pozzetto di controllo Ø 80"}},
  PLS:{plan:"151.621_dt",docFile:"151.621_dt_Umbau_Plattenschacht_in_Kleineinstiegschacht.pdf",
      n:{de:"PLS – Plattenschacht (Umbau in KES)",fr:"PLS – chambre à dalles (transformation en PChA)",it:"PLS – pozzetto a lastre (trasformazione in KES)"}}
};

/* Massenauszüge pro Stück gemäss Normplan */
var SIZES = [
  {id:"ES300",lv:["621.021",11900],shaft:"ES",pos:"621.022",dim:"3.00 × 1.50 × 2.00 m",wall:"20 cm",
   std:{fast:"ok",slow:"ok",green:"amber"},
   mass:[["unterlage","m²",6.46],["bodenplatte","m³",1.28],["waende","m³",3.92],["decke","m³",1.31],["schalWand","m²",18.00],["schalDecke","m²",4.50]]},
  {id:"KES150",lv:["621.012",2660],shaft:"KES",pos:"621.012",dim:"1.50 × 1.00 × 1.35 m",wall:"20 cm",
   std:{fast:"ok",slow:"ok",green:"ok"},
   mass:[["bodenplatte","m³",0.399],["waende","m³",1.566],["schalWand","m²",6.75]]},
  {id:"KES175",lv:["621.013",3230],shaft:"KES",pos:"621.013",dim:"1.50 × 1.00 × 1.75 m",wall:"20 cm",
   std:{fast:"amber",slow:"amber",green:"amber"},
   mass:[["bodenplatte","m³",0.515],["waende","m³",2.030],["schalWand","m²",8.75]]},
  {id:"KES100",lv:["621.011",2090],shaft:"KES",pos:"621.011",dim:"1.00 × 1.00 × 1.35 m",wall:"20 cm",
   std:{fast:"stop",slow:"stop",green:"amber"},
   mass:[["bodenplatte","m³",0.294],["waende","m³",1.296],["schalWand","m²",5.40]]},
  {id:"KS80",lv:["611.172",1290],shaft:"KS",pos:"611.171",dim:"Ø 0.80 m, Tiefe 0.50 m",wall:"—",
   std:{fast:"stop",slow:"ok",green:"ok"},
   mass:[["brunnenring","Stk",1]]},
  {id:"KS80U",lv:["611.171",920],shaft:"KS",pos:"611.175",dim:"Ø 0.80 m, Tiefe 0.50 m, überdeckt",wall:"—",
   std:{fast:"stop",slow:"ok",green:"ok"},
   mass:[["brunnenring","Stk",1]]},
  {id:"PLS1",shaft:"PLS",pos:"623.001",dim:"1.00 × 1.00 × 1.00 m",wall:"—",
   std:{fast:"stop",slow:"stop",green:"amber"},lv:["623.001",2940],coverIncl:"1370899",
   mass:[]},
  {id:"PLS2",shaft:"PLS",pos:"623.002",dim:"1.00 × 1.50 × 1.30 m",wall:"—",
   std:{fast:"stop",slow:"amber",green:"ok"},lv:["623.002",4850],coverIncl:"137.788.6",
   mass:[]},
  {id:"PLS3",shaft:"PLS",pos:"623.003",dim:"1.00 × 2.00 × 1.30 m",wall:"—",
   std:{fast:"stop",slow:"amber",green:"ok"},lv:["623.003",5670],coverIncl:"137.426.3",
   mass:[]},
  {id:"OTHER",shaft:"*",pos:"—",dim:"",wall:"—",
   std:{fast:"stop",slow:"stop",green:"stop"},mass:[]}
];

