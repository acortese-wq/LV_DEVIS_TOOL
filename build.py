"""Baut index.html (Einzeldatei) aus src/.  Aufruf: python3 build.py"""
import datetime, os
H = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(H, 'src', p), encoding='utf8').read()
shell = rd('shell.html')
css = rd('kv.css') + '\n' + rd('app.css')
scripts = [('data/lv.js', 'lv'), ('schacht_data.js', 'schachtdaten'), ('data/schacht_img.js', 'schachtbilder'), ('i18n_kv.js', 'i18n'),
           ('schacht_i18n.js', 'i18n-schacht'), ('i18n_app.js', 'i18n-app'), ('kve.js', 'kve'), ('xlsxw.js', 'xlsx'), ('fig.js', 'fig'), ('app.js', 'app')]
js = '\n'.join('<script id="%s">\n%s\n</script>' % (i, rd(f).replace('</script', '<\\/script')) for f, i in scripts)
out = (shell.replace('/*@@CSS@@*/', css).replace('/*@@LOGO@@*/', rd('data/logo.txt').strip())
            .replace('/*@@BUILD@@*/', datetime.date.today().isoformat()).replace('/*@@SCRIPTS@@*/', js))
open(os.path.join(H, 'index.html'), 'w', encoding='utf8').write(out)
print('index.html', round(len(out.encode('utf8')) / 1024), 'KB')
