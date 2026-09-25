"""Erzeugt src/data/lv.js aus LV V1.1 (DE, aus KV-Assistent) und LV FR (aus PDF geparst).
Korrekturen am DE-Datensatz sind unten dokumentiert."""
import json,os
H=os.path.dirname(os.path.abspath(__file__))+'/../src/data/'
DE=json.load(open(H+'lv_de_raw.json',encoding='utf8'))
FR=json.load(open(H+'lv_fr_raw.json',encoding='utf8'))
# 1) 151/632.130 ist ein Extraktionsfehler: gemäss LV FR und Schachtauswahl Pos. 151/632.133 (liefern) und 151/632.233 (versetzen)
t133="Rahmen mit Betonuntersatz NIVO 130x130cm, D400, höhenverstellbar Gewicht: 520 kg Lieferant HGC Artikel Nr. 1373521"
DE.pop('151/632.130',None)
DE['151/632.133']={'u':'St','ep':809.0,'t':t133,'c':'','s':'p'}
DE['151/632.233']={'u':'St','ep':FR['151/632.233']['ep'],'t':t133,'c':'','s':'p'}
# 2) Kontext 151/632: 1xx = liefern, 2xx = versetzen (LV FR: 100 Fourniture / 200 Pose)
for k,v in DE.items():
    if k.startswith('151/632.1'): v['c']='Abdeckungen. › Abdeckplatten und Schachtabdeckungen liefern (franko Baustelle).'
    if k.startswith('151/632.2'): v['c']='Abdeckungen. › Abdeckplatten und Schachtabdeckungen auf definitive Höhe versetzen, inkl. Material für Auflager und Befestigung.'
# FR-Zuordnung bei abweichender Nummer
ALIAS={'151/621.011':'151/621.001','222/572.200':'222/572.311'}
LVFR={}
for k in DE:
    f=FR.get(ALIAS.get(k,k))
    if f: LVFR[k]={'t':f['t'],'c':f['c']}
diff={k:[DE[k]['ep'],FR[ALIAS.get(k,k)]['ep']] for k in DE if ALIAS.get(k,k) in FR and abs(DE[k]['ep']-FR[ALIAS.get(k,k)]['ep'])>0.001}
out='/* LV Swisscom Infrastrukturarbeiten bei Baukooperationen\n   DE: V1.1 vom 10.07.2026 (Datensatz KV-Assistent), korrigiert gem. tools/build_lv.py\n   FR: LV FR TB Kopa 2026, V1.0 vom 27.06.2026 (PDF), Positionstexte */\n'
out+='var LV = '+json.dumps(dict(sorted(DE.items())),ensure_ascii=False)+';\n'
out+='var LV_FR = '+json.dumps(LVFR,ensure_ascii=False)+';\n'
out+='var LV_IT = {};\n'
out+='var LV_PDIFF = '+json.dumps(diff)+';\n'
open(H+'lv.js','w',encoding='utf8').write(out)
print(len(DE),'DE,',len(LVFR),'mit FR-Text; Preisdifferenzen:',diff)
