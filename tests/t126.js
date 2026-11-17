/* t126: Belag-Nachschnitt (V143) – Asphalt: Grabenrand je Seite 0.10 m zurückschneiden (Projektparameter «ns», je Datensatz übersteuerbar):
   zweiter Schnitt am erweiterten Umfang, Abbruch/Abfuhr/Neueinbau auf der erweiterten Fläche, Nähte nur am äusseren Rand,
   Massenbilanz (Verfüllung) unverändert auf Grabenfläche; Wiese/Pflästerung ohne Nachschnitt; Gruben (Werkloch) ebenfalls */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1280, 900);
  const R = await pg.evaluate(() => {
    const S0 = JSON.parse(JSON.stringify(window.__LVD.S()));
    const run = (ns, parNs, mode) => { const P = JSON.parse(JSON.stringify(S0)); P.par.ns = parNs == null ? '0.10' : parNs; const r = Object.assign(LVM.newRec('graben', 1), { L: '50', T: '0.80', verf: 'kies045' }); r.belag.mode = mode || 'bit'; r.belag.einbau = 'typN'; r.belag.naehte = true; if (ns != null) r.ns = ns; P.recs = { graben: [r] };
      const e = KVE.calc(P, LV).elems[0], q = k => e.lines.filter(l => l.key === k).reduce((s, l) => s + l.qty, 0), bal = id => (e.bal.find(x => x.id === id) || {}).v;
      return { cut: q('117/223.123'), area: q('117/223.213'), naht: q('223/571.101'), Vv: bal('b_Vv'), Vbelag: bal('b_Vbelag'), rule: (e.lines.find(l => l.key === '117/223.123') || {}).rule || '' }; };
    const wl = ns => { const P = JSON.parse(JSON.stringify(S0)); P.par.ns = ns; const r = LVM.newRec('werkloch', 1); r.ts = '1'; r.belag.mode = 'bit'; P.recs = { werkloch: [r] }; const e = KVE.calc(P, LV).elems[0]; return e.lines.filter(l => l.key === '117/223.123').reduce((s, l) => s + l.qty, 0); };
    return { def: run(), off: run(null, '0'), rec0: run('0'), rec20: run('0.20'), humus: run(null, null, 'humus'), wl10: wl('0.10'), wl0: wl('0'), parDef: (LVM.defaults(KVE.TABS, '').par || {}).ns };
  });
  // Graben 50 m, Breite 0.60 m: Umfang 2 × (50 + 0.60) = 101.2 m; Nachschnitt 0.10: zweiter Schnitt 2 × (50.2 + 0.80) = 102.0 m
  ok(R.off.cut === 101.2 && R.off.area === 30, 'ohne Nachschnitt: Schnitt 101.2 m, Fläche 30.00 m² (' + R.off.cut + ' / ' + R.off.area + ')');
  ok(R.def.cut === 203.2, 'Vorgabe 0.10 m: zweiter Schnitt 102.0 m dazu = 203.2 m (' + R.def.cut + ')');
  ok(Math.abs(R.def.area - 40.16) < 0.006, 'Fläche erweitert: (50.20 × 0.80) = 40.16 m² (' + R.def.area + ')');
  ok(R.def.naht === 102 && R.off.naht === 101.2, 'Nähte nur am äusseren Rand (102.0 m statt beide Schnitte)');
  ok(Math.abs(R.def.Vv - R.off.Vv) < 1e-9 && Math.abs(R.def.Vbelag - R.off.Vbelag) < 1e-9, 'Massenbilanz im Graben unverändert (Verfüllung, Belagsvolumen)');
  ok(/Nachschnitt 0\.1 m je Seite/.test(R.def.rule), 'Rechenweg nennt den Nachschnitt (' + R.def.rule + ')');
  ok(R.rec0.cut === 101.2 && R.rec20.cut > R.def.cut, 'Datensatz übersteuert: 0 = kein Nachschnitt, 0.20 m = mehr');
  ok(R.humus.cut === 0 && R.humus.area === 0, 'Wiese: kein Nachschnitt');
  ok(R.wl10 > R.wl0 && R.wl0 > 0, 'Werkloch (Grube): Nachschnitt ebenfalls (' + R.wl0 + ' → ' + R.wl10 + ' m)');
  ok(R.parDef === '0.10', 'Projektparameter Vorgabe 0.10 m');
  // Oberfläche: Parameter und Feld
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('[data-tab=graben]').catch(() => { }); await pg.waitForTimeout(600);
  const ui = await pg.evaluate(() => ({ f: /Nachschnitt je Seite/.test(document.body.innerText) }));
  ok(ui.f, 'Feld «Nachschnitt je Seite» im Graben-Datensatz (Asphalt) sichtbar');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  await b.close();
})();
