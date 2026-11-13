/* t113: Kostenfolgen beim Schacht – nur Deckel ersetzen / nur Anschluss an bestehenden Schacht / neuer Schacht: Oberfläche (Belag, Wiese, Pflästerung, Aushub durch Bauherr) ändert den Preis;
   Rechenkern ohne Browser (src/kve.js). Bestand ohne Feld «grube» bleibt unverändert. */
const fs = require('fs'), path = require('path'), { kernel, result, H } = require('./lib/regress.js'), K = require('./lib/k.js'), { ok } = K;
const C = kernel(), G = JSON.parse(fs.readFileSync(path.join(H, 'tests/fixtures/golden.json')));
const net = (mut) => {
  const st = JSON.parse(JSON.stringify(G.cases[0].st)); st.recs.schacht = [];
  const r = C.LVM.newRec('schacht', 1); r.uid = 'tst'; mut(r); st.recs.schacht.push(r); st.recs.graben = []; st.recs.werkloch = []; st.recs.fund = []; st.recs.geb = []; st.recs.belag = []; st.recs.rohr = [];
  const o = result(C, st); return { n: o.sum.netto, pos: o.summary.length };
};
const surf = (r, m) => { r.belag.mode = m; if (m === 'pflaster') { r.belag.pflaster = r.belag.pflaster || {}; r.belag.pflaster.abbruchAlt = true; r.belag.pflaster.abbruchArt = 'betonstein'; } };
(async () => {
  for (const [modus, set] of [['deckel', r => { r.deckelN = '2'; }], ['anschluss', r => { r.anschl = '2'; r.n = '1'; r.typ = 'KES150'; }]]) {
    const base = net(r => { r.modus = modus; set(r); delete r.grube; surf(r, 'bit'); });
    const off = net(r => { r.modus = modus; set(r); r.grube = false; surf(r, 'bit'); });
    const bit = net(r => { r.modus = modus; set(r); r.grube = true; surf(r, 'bit'); });
    const wie = net(r => { r.modus = modus; set(r); r.grube = true; surf(r, 'humus'); });
    const pfl = net(r => { r.modus = modus; set(r); r.grube = true; surf(r, 'pflaster'); });
    const roh = net(r => { r.modus = modus; set(r); r.grube = true; r.roh = true; surf(r, 'none'); });
    ok(base.n === off.n && base.n > 0, modus + ': Bestand ohne Feld «grube» unverändert (' + base.n + ')');
    ok(bit.n > off.n, modus + ': Grube mit Belag erhöht den Preis (' + off.n + ' → ' + bit.n + ')');
    ok(wie.n !== bit.n && pfl.n !== bit.n && pfl.n !== wie.n, modus + ': Oberfläche Belag / Wiese / Pflästerung ändert den Preis (' + bit.n + ' / ' + wie.n + ' / ' + pfl.n + ')');
    ok(roh.n === off.n, modus + ': Aushub durch Bauherr: Grube, Belag und Aushub entfallen (' + roh.n + ' = ' + off.n + ')');
  }
  const neu = net(r => { r.modus = 'neu'; r.n = '1'; r.typ = 'KES150'; surf(r, 'bit'); }), neuR = net(r => { r.modus = 'neu'; r.n = '1'; r.typ = 'KES150'; surf(r, 'none'); r.roh = true; }), neuB = net(r => { r.modus = 'neu'; r.n = '1'; r.typ = 'KES150'; surf(r, 'none'); });
  ok(neuR.n < neuB.n && neuB.n < neu.n, 'Neuer Schacht: Belag erhöht (' + neuB.n + ' → ' + neu.n + '), Aushub durch Bauherr senkt (' + neuR.n + ')');
  ok(neuR.n > 0, 'Neuer Schacht bei Aushub durch Bauherr: Bauwerk bleibt gerechnet (' + neuR.n + ')');
})();
