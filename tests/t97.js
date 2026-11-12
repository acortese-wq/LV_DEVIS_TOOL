/* t97: Tiefenklassen nach NPK 151 (Ausmass 022.600: ganzes Volumen gehört der Klasse der Grabentiefe).
   Über 1.50 m Handaushub = OFFEN mit NPK-Code/Klasse (z. B. 151/221.212 bei 1.80 m); Maschine und Spriessung über 2.00 m ebenso; bis 1.50 m unverändert LV-Position. */
const { kernel } = require('./lib/regress.js'), vm = require('vm');
let fail = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };
const C = kernel();
const g = (T, gesp, hand) => { C.__a = [T, !!gesp, hand]; return JSON.parse(JSON.stringify(vm.runInContext('(function(){var st=LVM.defaults(["graben","schacht","werkloch","fund"],"01.01.2027");var r=st.recs.graben[0];r.L="20";r.T=String(__a[0]);r.gesp=__a[1];r.hand=__a[2];var o=KVE.calc(st,LV);return {lines:o.elems.reduce(function(a,e){return a.concat(e.lines)},[]),warn:o.warn}})()', C))); };
const off = (o, id) => o.lines.filter(l => l.open && l.tk === id);
let o = g(1.8, false, 'eng');
const h18 = off(o, 'handTiefe')[0]; ok(!!h18 && h18.args.npk === '151/221.212' && h18.args.kl === '1.51–2.00', 'Graben 1.80 m Hand: ganze Handmenge OFFEN, NPK 151/221.212, Klasse 1.51–2.00 (' + (h18 && h18.args.npk) + ')');
ok(!o.lines.some(l => l.key === '151/221.211'), 'bei 1.80 m keine LV-Position 221.211 für die Handmenge (NPK 022.600)');
o = g(1.4, false, 'eng'); ok(off(o, 'handTiefe').length === 0 && o.lines.some(l => l.key === '151/221.211'), 'Graben 1.40 m: Handaushub mit LV-Position 151/221.211');
o = g(2.5, false, 'normal'); const m25 = off(o, 'masch2')[0]; ok(!!m25 && m25.args.npk === '151/221.113' && m25.args.kl === '2.01–3.00', 'Maschinenaushub 2.50 m: NPK 151/221.113 (' + (m25 && m25.args.npk) + ')');
o = g(2.5, true, 'normal'); const m25g = off(o, 'masch2')[0], s25 = off(o, 'spries2')[0]; ok(m25g && m25g.args.npk === '151/221.123', 'gespriesst 2.50 m Maschine: 151/221.123 (' + (m25g && m25g.args.npk) + ')'); ok(s25 && s25.args.npk === '151/321.103', 'Spriessung 2.50 m: 151/321.103 (' + (s25 && s25.args.npk) + ')');
o = g(3.4, true, 'eng'); const h34 = off(o, 'handTiefe')[0]; ok(h34 && h34.args.npk === '151/221.224' && h34.args.kl === '>3.00', 'gespriesst 3.40 m Hand: Klasse >3.00 (' + (h34 && h34.args.npk) + ')');
// Texte in 4 Sprachen enthalten NPK-Code und Klasse
const tx = vm.runInContext('["de","fr","it","en"].map(function(l){return T[l].w_handTiefe+"|"+T[l].w_masch2+"|"+T[l].w_spries2+"|"+T[l].w_spriesAnn})', C);
ok(tx.every(t => t.split('|').slice(0, 3).every(x => /\{npk\}/.test(x) && /\{kl\}/.test(x))), 'OFFEN-Texte DE/FR/IT/EN nennen NPK-Code und Klasse');
ok(tx.every(t => /151\/222.224/.test(t) || /222–224/.test(t)) && tx.every(t => /131–132/.test(t)), 'Spriessungs-Hinweis nennt mögliche Mehrleistungen (Erschwernis, Leitungen, Wasserhaltung, Verbau) in 4 Sprachen');
console.log(fail ? 'FEHLER' : 'alles ok'); process.exit(fail ? 1 : 0);
