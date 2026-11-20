"""UX-Runde 11/2026 P5: dunkles Thema für die klassische Seite aus den bestehenden hellen Regeln ableiten.
Erzeugt src/theme_dark.css (nur Bildschirm, Druck bleibt hell). Aufruf: python3 tools/make_dark.py  (danach python3 build.py)
Regel: helle Hintergründe -> Flächen-Tokens, dunkle Schrift -> Text-Tokens, helle Linien -> Linien-Tokens (aus src/tokens.css).
Status-/Signalfarben (Rot, Bernstein, Grün), !important und Druck-/Berichtsregeln bleiben unberührt; sie stehen von Hand am Ende."""
import re, os
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = [os.path.join(H, 'src', f) for f in ('kv.css', 'app.css')]
SKIP = re.compile(r'\.rp\b|\.rp-|print|#reportDoc|\.status|\.warns|\.amber|\.stop|\.signal|\.err\b|\.ok\b|\.kmdlg|\.kmlya|\.lyrb|\.ly[a-z]|\.km[a-z]|leaflet|\.pst|\.kerf|\.koffen|\.kres|\.offen|\.del\b|\.chfab|\.wmark|\.btn:not\(\.ghost\)|\.btn\.primary|svg|figure|\.fig|\.situfig')

def hex2rgb(h):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
def lum(h):
    def ch(c): return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in hex2rgb(h)); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def sat(h):
    r, g, b = hex2rgb(h); return max(r, g, b) - min(r, g, b)

def rules(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S); out, i, n = [], 0, len(css)
    def block(s, media):
        j = 0
        while j < len(s):
            k = s.find('{', j)
            if k < 0: return
            sel = s[j:k].strip(); depth, m = 1, k + 1
            while m < len(s) and depth:
                depth += {'{': 1, '}': -1}.get(s[m], 0); m += 1
            body = s[k + 1:m - 1]
            if sel.startswith('@media'):
                if 'print' not in sel: block(body, sel)
            elif sel.startswith('@'): pass
            else: out.append((media, sel, body))
            j = m
    block(css, '')
    return out

def conv(decl):
    m = re.match(r'\s*(background(?:-color)?|color|border(?:-(?:top|bottom|left|right))?(?:-color)?)\s*:\s*(.+?)\s*$', decl)
    if not m or '!important' in decl: return None
    prop, val = m.group(1), m.group(2)
    if prop.startswith('background') and 'var(--navy)' in val: return prop + ':' + val.replace('var(--navy)', 'var(--nc-accent)')   # Akzentflächen mit weisser Schrift bleiben dunkel-petrol
    cols = re.findall(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\bwhite\b', val)
    if not cols: return None
    c = '#ffffff' if cols[0] == 'white' else cols[0]
    L, S = lum(c), sat(c)
    if prop.startswith('background'):
        if L > 0.93 and S < 0.08: tok = 'var(--paper)'
        elif L > 0.78 and S < 0.12: tok = 'var(--panel)'
        elif L > 0.78: tok = 'var(--panel-2)'   # zarte Tönungen (z. B. Hinweisflächen)
        else: return None
        return prop + ':' + val.replace(cols[0], tok)
    if prop == 'color':
        if L < 0.06 and S < 0.25: tok = 'var(--ink)'
        elif L < 0.25 and S < 0.25: tok = 'var(--ink-soft)'
        elif S >= 0.25 and L < 0.2 and abs(hex2rgb(c)[1] - 0.42) < 0.2 and hex2rgb(c)[0] < 0.2: tok = 'var(--link)'   # Petrol-Schrift
        else: return None
        return 'color:' + val.replace(cols[0], tok)
    if prop.startswith('border'):
        if L > 0.55 and S < 0.15: return prop + ':' + val.replace(cols[0], 'var(--rule)')
    return None

def main():
    out = []
    for f in SRC:
        for media, sel, body in rules(open(f, encoding='utf8').read()):
            if SKIP.search(sel): continue
            ds = [conv(d) for d in body.split(';')]; ds = [d for d in ds if d]
            if not ds: continue
            sels = ','.join('html.nc-dark ' + s.strip() for s in sel.split(',') if s.strip() and not s.strip().startswith(('html', ':root')))
            if not sels: continue
            r = sels + '{' + ';'.join(ds) + '}'
            out.append(media + '{' + r + '}' if media else r)
    head = ('/* Automatisch erzeugt mit tools/make_dark.py – nicht von Hand ändern (UX-Runde 11/2026 P5, Konzept Alessandro Cortese).\n'
            '   Dunkles Thema der klassischen Seite: helle Flächen/dunkle Schrift/helle Linien auf die Tokens abgebildet. Nur Bildschirm. */\n')
    body = '@media screen{\n' + '\n'.join(out) + '\n}\n'
    open(os.path.join(H, 'src', 'theme_dark.css'), 'w', encoding='utf8').write(head + body)
    print('theme_dark.css', len(out), 'Regeln')

if __name__ == '__main__': main()
