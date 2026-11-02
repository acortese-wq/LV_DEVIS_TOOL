"""Baut index.html (Einzeldatei) aus src/.  Aufruf: python3 build.py"""
import datetime, os, sys
H = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(H, 'src', p), encoding='utf8').read()
shell = rd('shell.html')
css = rd('kv.css') + '\n' + rd('app.css')
scripts = [('data/lv.js', 'lv'), ('schacht_data.js', 'schachtdaten'), ('data/schacht_img.js', 'schachtbilder'), ('i18n_kv.js', 'i18n'),
           ('schacht_i18n.js', 'i18n-schacht'), ('i18n_app.js', 'i18n-app'), ('kve.js', 'kve'), ('model.js', 'model'), ('xlsxw.js', 'xlsx'), ('fig.js', 'fig'), ('karte.js', 'karte'), ('app.js', 'app'), ('chat_flows2.js', 'chatflows'), ('chat.js', 'chat'), ('help_data.js', 'helpdata'), ('help.js', 'help')]
js = '\n'.join('<script id="%s">\n%s\n</script>' % (i, rd(f).replace('</script', '<\\/script')) for f, i in scripts)
out = (shell.replace('/*@@CSS@@*/', css).replace('/*@@LOGO@@*/', rd('data/logo.txt').strip())
            .replace('/*@@BUILD@@*/', datetime.date.today().isoformat()).replace('/*@@SCRIPTS@@*/', js))
out = out.replace('/*@@EXPIRES@@*/', '').replace('/*@@RECIPIENT@@*/', '')
open(os.path.join(H, 'index.html'), 'w', encoding='utf8').write(out)
print('index.html', round(len(out.encode('utf8')) / 1024), 'KB')
# Weitergabe-Version mit Ablaufdatum:  python3 build.py --expire 20   ->  dist/LV-Devis_Tiefbau_gueltig_bis_JJJJ-MM-TT.html
if '--expire' in sys.argv:
    days = int(sys.argv[sys.argv.index('--expire') + 1]); exp = (datetime.date.today() + datetime.timedelta(days=days)).isoformat()
    os.makedirs(os.path.join(H, 'dist'), exist_ok=True)
    fn = os.path.join(H, 'dist', 'LV-Devis_Tiefbau_gueltig_bis_%s.html' % exp)
    open(fn, 'w', encoding='utf8').write(out.replace('EXPIRES = ""', 'EXPIRES = "%s"' % exp))
    print(fn, 'gültig bis', exp)

# Weitergabe-Version (personalisiert, minimiert, mit Ablauf):
#   python3 build.py --release "Name Empfänger" [--days 30]
# Voraussetzung für Minimierung: cd tools && npm install   (terser). Ohne terser wird nur personalisiert.
# Schreibt dist/LV-Devis_Tiefbau_<Name>[_gueltig_bis_<Datum>].html und ergänzt dist/releases.csv (Datum, Empfänger, Ablauf, SHA-256).
if '--release' in sys.argv:
    import re, subprocess, hashlib, shutil, csv
    who = sys.argv[sys.argv.index('--release') + 1]
    days = int(sys.argv[sys.argv.index('--days') + 1]) if '--days' in sys.argv else 0
    exp = (datetime.date.today() + datetime.timedelta(days=days)).isoformat() if days else ''
    rel = out.replace('RECIPIENT = ""', 'RECIPIENT = "%s"' % who.replace('"', ''))
    if exp: rel = rel.replace('EXPIRES = ""', 'EXPIRES = "%s"' % exp)
    terser = None
    for c in [os.path.join(H, 'tools', 'node_modules', '.bin', 'terser'), shutil.which('terser')]:
        if c and os.path.exists(c): terser = c; break
    if terser:
        banner = '/*! (c) Alessandro Cortese. Alle Rechte vorbehalten. Lizenziert fuer: %s. Kopieren, Veraendern, Weitergeben und Dekompilieren nur mit schriftlicher Zustimmung. */' % who.replace('"', '').replace('*/', '')
        def mini(m):
            code = m.group(2)
            if m.group(1) in ('lv', 'schachtdaten', 'schachtbilder'): return m.group(0)   # reine Daten
            r = subprocess.run([terser, '--compress', '--mangle', '--comments', '/^!/'], input=code, capture_output=True, text=True)
            if r.returncode != 0: print('terser-Fehler in', m.group(1), r.stderr[:200]); return m.group(0)
            return '<script id="%s">\n%s\n</script>' % (m.group(1), r.stdout)
        rel = re.sub(r'<script id="([^"]+)">\n(.*?)\n</script>', mini, rel, flags=re.S)
        rel = rel.replace('<script id="i18n">', '<script id="i18n">\n' + banner, 1) if '<script id="i18n">' in rel else rel
    else:
        print('Hinweis: terser nicht gefunden (cd tools && npm install) - Version ist personalisiert, aber nicht minimiert.')
    os.makedirs(os.path.join(H, 'dist'), exist_ok=True)
    slug = re.sub(r'[^A-Za-z0-9]+', '_', who).strip('_') or 'Empfaenger'
    fn = os.path.join(H, 'dist', 'LV-Devis_Tiefbau_%s%s.html' % (slug, ('_gueltig_bis_' + exp) if exp else ''))
    open(fn, 'w', encoding='utf8').write(rel)
    sha = hashlib.sha256(rel.encode('utf8')).hexdigest()
    reg = os.path.join(H, 'dist', 'releases.csv'); new = not os.path.exists(reg)
    with open(reg, 'a', newline='', encoding='utf8') as f:
        w = csv.writer(f)
        if new: w.writerow(['datum', 'empfaenger', 'ablauf', 'sha256', 'datei'])
        w.writerow([datetime.date.today().isoformat(), who, exp, sha, os.path.basename(fn)])
    print(fn, round(len(rel.encode('utf8')) / 1024), 'KB', 'minimiert' if terser else 'nicht minimiert', 'SHA-256', sha[:16] + '...')
