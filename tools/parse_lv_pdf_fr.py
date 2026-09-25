import re,json,sys
L=open('fr.txt',encoding='utf8').read().split('\n')
skip=re.compile(r"^(Seite \d+ von \d+|\d\d\.\d\d\.\d{4}|NPK-Bau |LV FR TB Kopa|cablex AG|<<PAGE>>)")
price=re.compile(r"^(.*?)\s+(p|m|m2|m3|h|t|up|kg|l|fft|gl|LE|%|pce|j|sem|mois|St)\s+(-?[\d'`’]+\.\d{2})\s*$")
out={};pend=None;ch=None;hp=None;hpt='';item=None;heads={}
def fin():
    global item
    if item is None: return
    if item.get('ep') is not None:
        t=' '.join(item['txt']).strip()
        sp=' '.join(item['spec']).strip()
        if sp: t=(t.replace('Spécification','').strip()+' '+sp).strip() if t.strip()!='Spécification' else sp
        t=re.sub(r'(\w)- (\w)',r'\1\2',t); t=re.sub(r'\s+',' ',t).strip()
        k=f"{ch}/{hp}.{item['sub']}"
        ctx=[re.sub(r'\s+',' ',re.sub(r'(\w)- (\w)',r'\1\2',hpt)).strip()]
        hs=[heads[x] for x in sorted(heads) if x<item['sub']]
        ctx+= [re.sub(r'\s+',' ',re.sub(r'(\w)- (\w)',r'\1\2',h)).strip() for h in hs if h]
        out[k]={'t':t,'c':' › '.join(c for c in ctx if c),'u':item['u'],'ep':item['ep']}
    else:
        s=item['sub']
        # heading: remember by level (x00 -> level1, xx0 -> level2)
        if s.endswith('00'):
            for x in list(heads):
                if x[0]==s[0] or True: pass
            heads.clear(); heads[s]=' '.join(item['txt'])
        elif s.endswith('0'):
            for x in [x for x in heads if not x.endswith('00')]: del heads[x]
            heads[s]=' '.join(item['txt'])
    item=None
for raw in L:
    line=raw.rstrip()
    if not line.strip(): continue
    m=re.match(r"^NPK-Bau (\d{3})F",line)
    if m:
        if ch is None: ch=m.group(1)
        pend=m.group(1); continue
    m=re.match(r"^(\d{3})  ([A-ZÀ-Ý ,'\-]+)$",line)
    if m and m.group(1)==pend and m.group(1)!=ch:
        fin(); ch=pend; hp=None; hpt=''; heads={}; continue
    if skip.match(line): continue
    m=re.match(r"^(?:R\s*)?(\d{3})  (?! )(.*)$",line)
    if m and ch:
        fin(); hp=m.group(1); hpt=m.group(2); heads={}; continue
    m=re.match(r"^(?:R\s*|R\d{3}\s+)?(\d{3})   +(.*)$",line)
    if m and ch and hp:
        fin(); item={'sub':m.group(1),'txt':[],'spec':[],'u':None,'ep':None}; rest=m.group(2)
    else:
        m2=re.match(r"^(\d{5}[A-Z]?) (.*)$",line)
        if m2 and item is not None:
            rest=m2.group(2); item['_spec']=True
        else:
            rest=line
            if item is None:
                if hp: hpt+=' '+line.strip()
                continue
    pm=price.match(rest)
    if pm:
        rest=pm.group(1); item['u']=pm.group(2); item['ep']=float(re.sub(r"['`’]","",pm.group(3)))
    tgt='spec' if item.get('_spec') else 'txt'
    item[tgt].append(rest.strip())
fin()
json.dump(out,open('lv_fr.json','w'),ensure_ascii=False,indent=0)
print(len(out))
