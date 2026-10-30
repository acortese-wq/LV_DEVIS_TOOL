const {chromium,mk}=require('/tmp/claude-0/lf/k.js');
(async()=>{const b=await chromium.launch(); const pg=await mk(b);
const res=await pg.evaluate(()=>{
 const T=KVE.TABS, nr=(t,n)=>LVM.newRec(t,n,false);
 const grab=(o)=>Object.assign(nr('graben',1),o);
 const pf=(r,ab)=>{r.belag.mode='pflaster'; r.belag.pflaster.abbruchAlt=ab; return r;};
 function proj(spec,full){
  const S=LVM.defaults(T,'2026-10-30'); S.recs.graben=[];S.recs.schacht=[];S.recs.werkloch=[];S.recs.geb=[];S.recs.belag=[];S.recs.rohr=[];S.recs.fund=[];S.recs.allg=[nr('allg',1)];S.recs.hon=[];
  spec.graben.forEach(g=>{const r=grab(g.r); if(g.fl==='pflaster')pf(r,true); if(g.fl==='wiese')r.belag.mode='humus'; if(g.fl==='roh'){r.roh=true;r.belag.mode='none';} if(g.fl==='belag')r.belag.mode='bit';
    if(full){ r.hand='eng'; r.umhType='beton'; r.direkt=true; r.einfHand=true; r.kreuz={on:true,n:'2',len:'1.00',richtung:'quer'}; r.b90='2'; r.b45='1'; r.schneiden='2'; if(r.belag.mode==='bit'){r.belag.d='150';} } S.recs.graben.push(r);});
  (spec.sch||[]).forEach((t,i)=>{const r=nr('schacht',i+1); r.typ=t; r.n='1'; if(spec.flS==='pflaster')pf(r,true); if(spec.flS==='belag')r.belag.mode='bit'; if(full){r.arbeit='0.75'; r.anschl='2'; r.direkt=false;} S.recs.schacht.push(r);});
  if(spec.wl){const r=nr('werkloch',1); Object.assign(r,spec.wl); if(spec.flS==='belag')r.belag.mode='bit'; if(full){r.arbeit='0.50';r.hand='eng';} S.recs.werkloch.push(r);}
  if(spec.geb){const r=nr('geb',1); r.n=String(spec.geb); r.cm='25'; r.abd='hauff'; S.recs.geb.push(r);}
  return S;}
 const A={graben:[{fl:'pflaster',r:{L:'40',T:'0.6',rohrSystem:'k55',dn:'55',n:'3'}}],sch:['KES150','KES150'],wl:{sg:'2'},geb:2,flS:'pflaster'};
 const B={graben:[{fl:'belag',r:{L:'120',T:'0.9',rohrSystem:'block',bloecke:[{dn:'100',n:'2',lagen:'1',len:'10'},{dn:'55',n:'3',lagen:'1',len:'10'}],block:{breite:'0.81',hoehe:'0.32'}}}],sch:['KES150','KES150','KES150'],wl:{sg:'3',ts:'1'},geb:3,flS:'belag'};
 const C={graben:[{fl:'wiese',r:{L:'200',T:'0.6',rohrSystem:'k55',dn:'55',n:'2'}}],sch:['KES150'],wl:{sg:'1'},geb:1};
 const D={graben:[{fl:'roh',r:{L:'80',T:'0.8',rohrSystem:'k55',dn:'55',n:'4'}}],sch:['KES150'],wl:{sg:'2'}};
 const E={graben:[{fl:'belag',r:{L:'60',T:'0.8',rohrSystem:'k55',dn:'100',n:'2'}},{fl:'pflaster',r:{L:'30',T:'0.6',rohrSystem:'k55',dn:'55',n:'3'}},{fl:'wiese',r:{L:'100',T:'0.6',rohrSystem:'k55',dn:'55',n:'2'}}],sch:['KES150','KES150'],wl:{sg:'2'},geb:2,flS:'belag'};
 const out=[]; 
 for(const [nm,sp] of [['A Gehweg Pflästerung 40 m',A],['B Strasse Belag, Rohrblock 120 m',B],['C Wiese 200 m',C],['D Rohplanie 80 m',D],['E Mix 190 m',E]]){
  const m=KVE.calc(proj(sp,false),LV), f=KVE.calc(proj(sp,true),LV);
  const mp={},fp={}; const add=(o,r)=>r.elems.forEach(e=>(e.lines||[]).forEach(l=>{o[l.key]=(o[l.key]||0)+l.total;}));
  add(mp,m);add(fp,f); let inter=0,tot=0; Object.keys(fp).forEach(k=>{tot+=fp[k]; inter+=Math.min(fp[k],mp[k]||0);});
  out.push([nm, Math.round(m.sum.netto), Math.round(f.sum.netto), Math.round(100*m.sum.netto/f.sum.netto), Object.keys(mp).length, Object.keys(fp).length, Math.round(100*inter/tot)]);}
 return out;});
console.log('Projekt | netto Karte | netto voll | Kosten % | Pos. Karte | Pos. voll | deckungsgleich %'); res.forEach(r=>console.log(r.join(' | '))); await b.close();})();
