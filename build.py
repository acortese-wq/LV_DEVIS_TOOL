"""Baut index.html (Einzeldatei) aus src/.  Aufruf: python3 build.py"""
import datetime, os, sys
H = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(H, 'src', p), encoding='utf8').read()
shell = rd('shell.html')
css = rd('kv.css') + '\n' + rd('app.css')
scripts = [('data/lv.js', 'lv'), ('schacht_data.js', 'schachtdaten'), ('data/schacht_img.js', 'schachtbilder'), ('i18n_kv.js', 'i18n'),
           ('schacht_i18n.js', 'i18n-schacht'), ('i18n_app.js', 'i18n-app'), ('kve.js', 'kve'), ('model.js', 'model'), ('xlsxw.js', 'xlsx'), ('fig.js', 'fig'), ('karte.js', 'karte'), ('app.js', 'app'), ('chat.js', 'chat')]
js = '\n'.join('<script id="%s">\n%s\n</script>' % (i, rd(f).replace('</script', '<\\/script')) for f, i in scripts)
out = (shell.replace('/*@@CSS@@*/', css).replace('/*@@LOGO@@*/', rd('data/logo.txt').strip())
            .replace('/*@@BUILD@@*/', datetime.date.today().isoformat()).replace('/*@@SCRIPTS@@*/', js))
out = out.replace('/*@@EXPIRES@@*/', '')
open(os.path.join(H, 'index.html'), 'w', encoding='utf8').write(out)
print('index.html', round(len(out.encode('utf8')) / 1024), 'KB')
# Weitergabe-Version mit Ablaufdatum:  python3 build.py --expire 20   ->  dist/LV-Devis_Tiefbau_gueltig_bis_JJJJ-MM-TT.html
if '--expire' in sys.argv:
    days = int(sys.argv[sys.argv.index('--expire') + 1]); exp = (datetime.date.today() + datetime.timedelta(days=days)).isoformat()
    os.makedirs(os.path.join(H, 'dist'), exist_ok=True)
    fn = os.path.join(H, 'dist', 'LV-Devis_Tiefbau_gueltig_bis_%s.html' % exp)
    open(fn, 'w', encoding='utf8').write(out.replace('EXPIRES = ""', 'EXPIRES = "%s"' % exp))
    print(fn, 'gültig bis', exp)
