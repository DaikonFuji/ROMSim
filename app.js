(async function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let DATA,ICONS;
try{
  [DATA,ICONS]=await Promise.all([fetch('data.json').then(r=>r.json()),fetch('icons.json').then(r=>r.json())]);
}catch(e){$('loading').textContent='Could not load the skill data. Please reload the page.';return;}
$('loading').remove();

// level arrays: [descId, params, range, cd, delay, sp, extra]
const L=a=>({d:a[0],p:a[1],r:a[2],cd:a[3],dl:a[4],sp:a[5],...(a[6]||{})});
Object.values(DATA.moulds).forEach(m=>{m.lv=m.lv.map(L);});

const states={};           // target id -> {mouldId: level}
let T,CL,M,byId,S,selected=null;

// class picker
const sel=$('cls');
const fams=[...new Set(DATA.targets.map(t=>t.fam))];
fams.forEach(f=>{const g=document.createElement('optgroup');g.label=f;
  DATA.targets.filter(t=>t.fam===f).forEach(t=>{const o=document.createElement('option');o.value=t.slug;o.textContent=t.n;g.appendChild(o);});
  sel.appendChild(g);});
sel.onchange=()=>{location.hash=sel.value;};

function setTarget(t,code){
  T=t; sel.value=t.slug; document.title=t.n+' Skill Simulator (English)';
  let prev=t.chain.length>1?10:0;
  CL=t.chain.map(id=>{const c=DATA.classes[id];const o={...c,base:prev,cap:c.max>=999?Infinity:c.max-prev};prev=c.max;return o;});
  M=CL.flatMap(c=>c.sk.map(id=>DATA.moulds[id]));
  byId={};M.forEach(m=>byId[m.id]=m);
  S=states[t.id]||(states[t.id]={});M.forEach(m=>{if(S[m.id]==null)S[m.id]=0;});
  selected=null;
  build();
  if(code!=null) load(code); else render();
  showDetail(M[M.length-1]);
}

const pts=c=>M.filter(m=>m.c===c).reduce((a,m)=>a+S[m.id],0);
const ci=c=>CL.findIndex(x=>x.id===c);
function canAdd(m){
  if(S[m.id]>=m.lv.length) return false;
  const i=ci(m.c);
  for(let k=0;k<i;k++) if(pts(CL[k].id)<CL[k].cap) return false;
  if(pts(m.c)>=CL[i].cap) return false;
  const rq=m.lv[S[m.id]].rq; if(rq && (S[rq[0]]||0)<rq[1]) return false;
  return true;
}
function canSub(m){
  const l=S[m.id]; if(!l) return false;
  const i=ci(m.c);
  for(let k=i+1;k<CL.length;k++) if(pts(CL[k].id)>0) return false;
  for(const o of M) for(let j=0;j<S[o.id];j++){const rq=o.lv[j].rq; if(rq&&rq[0]===m.id&&rq[1]>l-1) return false;}
  return true;
}
const add=m=>{if(canAdd(m))S[m.id]++;}, sub=m=>{if(canSub(m))S[m.id]--;};

function fmt(Lv){
  const parts=DATA.descs[Lv.d].split("{}"); let h=esc(parts[0]);
  for(let i=1;i<parts.length;i++) h+='<span class="hl">'+esc(Lv.p[i-1]??"?")+'</span>'+esc(parts[i]);
  return h.replace(/\n/g,'<br>');
}
function cast(lt){
  if(!lt) return null;
  switch(lt.type){case 1:return lt.ReadyTime+" s";case 2:return "Fixed "+lt.CCT+" s + variable "+lt.FCT+" s";case 3:return "Channel "+lt.duration+" s";case 4:return "Duration "+lt.DCT+" s";}
  return null;
}
function block(title,Lv,lvl){
  if(!Lv) return '<div><h3>'+title+'</h3><p class="hint">Maxed out.</p></div>';
  let s='<div class="stats"><span>Range</span><span>'+Lv.r+' m</span>';
  const c=cast(Lv.lt); if(c) s+='<span>Cast time</span><span>'+c+'</span>';
  s+='<span>Cooldown</span><span>'+Lv.cd+' s</span><span>Delay</span><span>'+Lv.dl+' s</span><span>SP cost</span><span>'+Lv.sp+'</span>';
  if(Lv.it) s+='<span>Also uses</span><span>'+esc(Lv.it[0])+' × '+Lv.it[1]+'</span>';
  s+='</div>';
  let r=''; if(Lv.rq){const q=byId[Lv.rq[0]]; if(q) r='<div class="req">Requires '+esc(q.n)+' Lv '+Lv.rq[1]+(S[q.id]>=Lv.rq[1]?' ✓':'')+'</div>';}
  return '<div><h3>'+title+' — Lv '+lvl+(Lv.pk?' <span style="color:var(--peak)">(Breakthrough)</span>':'')+'</h3><p>'+fmt(Lv)+'</p>'+s+r+'</div>';
}
function showDetail(m){
  selected=m; document.querySelectorAll('.card').forEach(e=>e.classList.toggle('sel',+e.dataset.id===m.id));
  const l=S[m.id], cls=CL[ci(m.c)];
  $('detail').innerHTML='<h2>'+esc(m.n)+'<span class="zh">'+esc(m.zh)+'</span><span class="meta">'+esc(cls.n)+' · '+esc(m.t)+' · Lv '+l+' / '+m.lv.length+'</span></h2><div class="cols">'+
   (l?block('Current',m.lv[l-1],l):'<div><h3>Current</h3><p class="hint">Not learned yet.</p></div>')+block('Next level',m.lv[l],l+1)+'</div>';
}

function build(){
  const tree=$('tree'); tree.innerHTML='<svg id="lines"></svg>';
  const rng=CL.map(c=>{const xs=c.sk.map(id=>DATA.moulds[id].x);return [Math.min(...xs),Math.max(...xs)];});
  const ymax=Math.max(...M.map(m=>m.y));
  // header spans and separators
  const starts=[1],ends=[];
  for(let i=1;i<CL.length;i++){const sep=Math.floor((rng[i-1][1]+1+rng[i][0])/2);ends.push(sep);starts.push(sep+1);}
  ends.push(rng[CL.length-1][1]+1);
  tree.style.gridTemplateColumns='repeat('+(ends[ends.length-1])+',46px)';
  CL.forEach((c,i)=>{const h=document.createElement('div');h.className='chead';h.style.gridColumn=starts[i]+' / '+(ends[i]+1);h.id='h'+c.id;tree.appendChild(h);
    if(i<CL.length-1){const s=document.createElement('div');s.className='sep';s.style.gridColumn=ends[i]+' / span 1';s.style.gridRow='1 / '+(ymax+2);tree.appendChild(s);}});
  M.forEach(m=>{
    const d=document.createElement('div');d.className='card';d.dataset.id=m.id;d.style.gridColumnStart=m.x;d.style.gridRow=m.y+1;
    d.innerHTML='<img alt="" src="'+(ICONS[m.i]||'')+'"><div class="nm">'+esc(m.n)+'</div><div class="lv"></div><div class="btns"><button class="sub" title="−1 (Shift: clear)">−</button><button class="add" title="+1">+</button><button class="mx" title="Max">▲</button></div>';
    d.addEventListener('mouseenter',()=>showDetail(m));
    d.addEventListener('click',e=>{
      const b=e.target.closest('button');
      if(b){ if(b.classList.contains('add'))add(m);
        else if(b.classList.contains('mx')){while(canAdd(m))add(m);}
        else { if(e.shiftKey){while(canSub(m))sub(m);} else sub(m); }
        render(); }
      showDetail(m);
    });
    tree.appendChild(d);
  });
}
function code(){const a=[];M.forEach(m=>{if(S[m.id])a.push({s:m.id,lv:S[m.id]});});return LZString.compressToEncodedURIComponent(JSON.stringify(a));}
function render(){
  let total=0; const homun=CL[0].cap===Infinity;
  const job=CL.map(c=>{const p=pts(c.id);total+=p;
    const capTxt=c.cap===Infinity?'':'/'+c.cap;
    $('h'+c.id).textContent=c.n+'  '+p+capTxt;
    return '<span class="pill'+(p===c.cap?' full':'')+'">'+esc(c.n)+' <b>'+p+capTxt+'</b></span>';});
  $('job').innerHTML=(homun?'<span class="pill">Points spent <b>'+total+'</b></span>':'<span class="pill">Job Lv <b>'+(10+total)+'</b></span>'+job.join(''));
  document.querySelectorAll('.card').forEach(e=>{const m=byId[e.dataset.id],l=S[m.id];
    e.classList.toggle('off',!l);
    const lv=e.querySelector('.lv'); lv.textContent='Lv '+l+' / '+m.lv.length; lv.className='lv'+(l?' on':'')+(l&&m.lv[l-1].pk?' peak':'');
    e.querySelector('.add').disabled=!canAdd(m); e.querySelector('.mx').disabled=!canAdd(m); e.querySelector('.sub').disabled=!canSub(m);});
  $('code').value=code();
  if(selected) showDetail(selected);
  drawLines();
}
function drawLines(){
  const svg=$('lines'), tree=$('tree'), tb=tree.getBoundingClientRect(); let h='';
  M.forEach(m=>{const rq=m.lv.find(Lv=>Lv.rq); if(!rq) return; const q=byId[rq.rq[0]]; if(!q) return;
    const a=tree.querySelector('[data-id="'+q.id+'"]').getBoundingClientRect(), b=tree.querySelector('[data-id="'+m.id+'"]').getBoundingClientRect();
    let x1=a.right-tb.left,y1=a.top+a.height/2-tb.top,x2=b.left-tb.left,y2=b.top+b.height/2-tb.top;
    if(x2<x1){x1=a.left+a.width/2-tb.left;y1=(y2>y1?a.bottom:a.top)-tb.top;x2=b.left+b.width/2-tb.left;y2=(y2>y1?b.top:b.bottom)-tb.top;}
    const mx=(x1+x2)/2, on=S[q.id]>=rq.rq[1];
    h+='<path d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'" fill="none" stroke="'+(on?'#e0b44c':'#3a4452')+'" stroke-width="3" stroke-linecap="round"/>';});
  svg.setAttribute('width',tree.scrollWidth); svg.setAttribute('height',tree.scrollHeight); svg.innerHTML=h;
}
function load(str){
  str=(str||'').trim();
  const cm=str.match(/class\/(\d+)/);
  if(cm){const t=DATA.targets.find(x=>x.id===+cm[1]); if(t&&t!==T){const sm=str.match(/share\/([^\/?#\s]+)/); setTarget(t,sm?sm[1]:''); location.hash=t.slug; return true;}}
  const mm=str.match(/share\/([^\/?#\s]+)/); if(mm) str=mm[1];
  let arr; try{arr=str?JSON.parse(LZString.decompressFromEncodedURIComponent(str)):[];}catch(e){arr=null}
  if(!Array.isArray(arr)){render();return false;}
  M.forEach(m=>S[m.id]=0);
  let progress=true; while(progress){progress=false; for(const o of arr){const m=byId[o.s]; if(!m) continue; while(S[m.id]<o.lv&&canAdd(m)){add(m);progress=true;}}}
  render(); return true;
}
const msg=t=>{const e=$('msg');e.textContent=t;setTimeout(()=>e.textContent='',2500);};
async function copy(t){try{await navigator.clipboard.writeText(t);msg('Copied.');}catch(e){const i=$('code');i.focus();i.select();msg('Selected — press Ctrl/Cmd+C.');}}
$('bShare').onclick=()=>$('share').classList.toggle('open');
$('bReset').onclick=()=>{M.forEach(m=>S[m.id]=0);render();};
$('bCopy').onclick=()=>copy(code());
$('bCopyLink').onclick=()=>copy('https://romelde.github.io/SkillSimulator/#class/'+T.id+'/share/'+code());
$('bLoad').onclick=()=>msg(load($('code').value)?'Build loaded.':'That code could not be read.');
window.addEventListener('resize',()=>drawLines());

function route(){
  const h=location.hash.replace('#','');
  const t=DATA.targets.find(x=>x.slug===h)||DATA.targets[0];
  if(t!==T) setTarget(t);
}
window.addEventListener('hashchange',route);
route();
})();
