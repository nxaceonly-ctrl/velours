/* Velours — découvrir, matchs, messages, profil */
'use strict';
const ICON={
  discover:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="3" transform="rotate(-8 12 12)"/></svg>',
  matches:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z"/></svg>',
  messages:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 5h16v11H10l-5 4v-4H4z"/></svg>',
  profile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'
};
const TABS=[['discover','Découvrir'],['matches','Matchs'],['messages','Messages'],['profile','Moi']];
function main(tab){
  state.tab=tab;
  page(`<header class="head"><div class="brand">${logo('')}<span>velours</span></div>${ONLINE?'':'<span class="demo">Démo</span>'}</header>
    <section class="view" id="view"></section>
    <nav class="tabs">${TABS.map(([k,l])=>`<button data-t="${k}" class="${k===tab?'on':''}">${ICON[k]}${l}${k==='matches'?'<span class="badge" id="mb" hidden></span>':''}</button>`).join('')}</nav>`);
  root.querySelectorAll('nav.tabs button').forEach(b=>b.onclick=()=>main(b.dataset.t));
  ({discover,matches:matchesView,messages:messagesView,profile:profileView})[tab]();
  API.matches().then(m=>{ const b=root.querySelector('#mb'); if(b&&m.length){ b.hidden=false; b.textContent=m.length; } }).catch(()=>{});
}

function cardHTML(p, opts={}){
  const n=Math.max(1,(p.photos||[]).length);
  const doodles=hasPh(p)?'':DOODLES.map((d,i)=>`<span class="doodle" style="left:${[12,78,20][i]}%;top:${[18,30,70][i]}%;color:#fff;opacity:.85">${d}</span>`).join('');
  return `<div class="ph" style="${phStyle(p)}">${hasPh(p)?'':`<div class="ini">${esc(p.name[0])}</div>`}
      ${n>1?`<div class="dots">${Array.from({length:n},(_,i)=>`<i class="${i?'':'on'}"></i>`).join('')}</div>`:''}
      ${opts.menu?'<button class="more" aria-label="Signaler ou bloquer">⋯</button>':''}
      <span class="look">${esc(p.looking||'')}</span></div>
    <div class="info"><h2>${esc(p.name)} <small>${age(p.birthdate)}</small></h2>
      <div class="meta">${esc(p.identity||'')} · ${esc(p.city||'')}${p.km?` · à ${p.km} km`:''}</div>
      <p class="bio">${esc(p.bio)}</p>
      <div class="tags">${(p.interests||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div></div>`;
}

async function discover(){
  const v=root.querySelector('#view');
  const F=['Toutes',...LOOKING];
  v.innerHTML=`<div class="filters">${F.map(f=>`<button class="chip ${state.filter===f?'on':''}">${esc(f)}</button>`).join('')}</div>
    <div class="deck" id="deck"></div>
    <div class="actions"><button class="act lg" id="no" aria-label="Passer">✕</button>
      <button class="act sm" id="star" aria-label="Coup de cœur">★</button>
      <button class="act lg like" id="yes" aria-label="J'aime">♥</button></div>`;
  v.querySelectorAll('.filters .chip').forEach(c=>c.onclick=()=>{ state.filter=c.textContent; discover(); });
  v.querySelector('#no').onclick=()=>decide('pass');
  v.querySelector('#yes').onclick=()=>decide('like');
  v.querySelector('#star').onclick=()=>decide('star');
  try{ state.deck=(await API.discover()).filter(p=>state.filter==='Toutes'||p.looking===state.filter); }
  catch(e){ state.deck=[]; toast(frErr(e.message)); }
  renderDeck();
}
function renderDeck(){
  const deck=root.querySelector('#deck'); if(!deck) return; deck.innerHTML='';
  if(!state.deck.length){ deck.innerHTML=`<div class="empty">${logo('')}<h3>Tu as vu tout le monde</h3><p class="sub">De nouvelles filles s'inscrivent tous les jours. Reviens un peu plus tard ♡</p></div>`;
    deck.querySelector('svg').style.cssText='width:90px;height:90px'; return; }
  state.deck.slice(0,3).reverse().forEach((p,i,arr)=>{
    const depth=arr.length-1-i; const c=document.createElement('article'); c.className='card';
    c.innerHTML=cardHTML(p,{menu:depth===0})+'<div class="stamp yes">J\'aime</div><div class="stamp no">Bof</div><div class="stamp star">Coup de cœur</div>';
    c.style.transform=`rotate(${depth?(depth%2?2.5:-2.5):0}deg) translateY(${depth*6}px)`; c.style.zIndex=10-depth;
    if(depth===0) drag(c,p); deck.appendChild(c);
  });
}
function drag(c,p){
  let sx=0,dx=0,down=false,moved=false,ph=0;
  const yes=c.querySelector('.stamp.yes'), no=c.querySelector('.stamp.no');
  c.addEventListener('pointerdown',e=>{ if(e.target.closest('.more')) return; down=true; moved=false; sx=e.clientX; dx=0; c.setPointerCapture(e.pointerId); c.style.transition='none'; });
  c.addEventListener('pointermove',e=>{ if(!down) return; dx=e.clientX-sx; if(Math.abs(dx)>6) moved=true;
    c.style.transform=`translateX(${dx}px) rotate(${dx/16}deg)`; yes.style.opacity=Math.min(1,Math.max(0,dx/90)); no.style.opacity=Math.min(1,Math.max(0,-dx/90)); });
  const up=e=>{ if(!down) return; down=false; c.style.transition='';
    if(dx>100) return decide('like'); if(dx<-100) return decide('pass');
    c.style.transform=''; yes.style.opacity=0; no.style.opacity=0;
    if(!moved && p.photos && p.photos.length>1){ const r=c.getBoundingClientRect(); ph=(ph+(e.clientX>r.left+r.width/2?1:p.photos.length-1))%p.photos.length;
      c.querySelector('.ph').style.backgroundImage=`url('${p.photos[ph]}')`; c.querySelectorAll('.dots i').forEach((d,i)=>d.classList.toggle('on',i===ph)); } };
  c.addEventListener('pointerup',up); c.addEventListener('pointercancel',up);
  const m=c.querySelector('.more'); if(m) m.onclick=e=>{ e.stopPropagation(); safety(p,()=>{ state.deck.shift(); renderDeck(); }); };
}
let busy=false;
async function decide(kind){
  const deck=root.querySelector('#deck'); const c=deck&&deck.lastElementChild; const p=state.deck[0];
  if(!p||!c||busy||!c.classList.contains('card')) return; busy=true;
  c.querySelector('.stamp.'+(kind==='pass'?'no':kind==='like'?'yes':'star')).style.opacity=1;
  const x=kind==='pass'?-1:1;
  c.style.transform=kind==='star'?'translateY(-110%) rotate(-6deg)':`translateX(${x*130}%) rotate(${x*24}deg)`; c.style.opacity='0';
  let match=false; try{ match=await API.like(p.id,kind); }catch(e){ toast(frErr(e.message)); }
  setTimeout(()=>{ busy=false; state.deck.shift(); renderDeck(); if(match) showMatch(p); },350);
}
function showMatch(p){
  const el=document.createElement('div'); el.className='match';
  el.innerHTML=`<div class="pair">${avatar(state.me)}${avatar(p)}</div><h3>C'est un match !</h3>
    <p>${esc(p.name)} t'a aimée aussi. Lance-toi, écris-lui la première ♡</p>
    <button class="btn">Lui écrire</button><button class="link">Continuer à découvrir</button>`;
  document.body.appendChild(el);
  el.querySelector('.btn').onclick=()=>{ el.remove(); chat(p); };
  el.querySelector('.link').onclick=()=>{ el.remove(); main('discover'); };
}

async function matchesView(){
  const v=root.querySelector('#view');
  v.innerHTML=`<h2 class="ttl">Tes matchs</h2><p class="note">elles t'aiment aussi ♡</p><div class="list"><div class="grid" id="g"></div></div>`;
  let m=[]; try{ m=await API.matches(); }catch(e){ toast(frErr(e.message)); }
  const g=v.querySelector('#g'); if(!g) return;
  if(!m.length){ g.outerHTML='<p class="sub" style="padding:20px 4px">Pas encore de match. Va faire un tour dans Découvrir et like les profils qui te plaisent !</p>'; return; }
  g.innerHTML=m.map(({p},i)=>`<button class="pol" data-i="${i}"><div class="ph" style="${phStyle(p)}">${hasPh(p)?'':`<div class="ini">${esc(p.name[0])}</div>`}</div><b>${esc(p.name)}, ${age(p.birthdate)}</b></button>`).join('');
  g.querySelectorAll('.pol').forEach(b=>b.onclick=()=>chat(m[+b.dataset.i].p));
}
async function messagesView(){
  const v=root.querySelector('#view');
  v.innerHTML=`<h2 class="ttl">Messages</h2><div class="list" id="l"></div>`;
  let m=[]; try{ m=await API.matches(); }catch(e){ toast(frErr(e.message)); }
  const l=v.querySelector('#l'); if(!l) return;
  if(!m.length){ l.innerHTML='<p class="sub" style="padding:12px 4px">Tes conversations apparaîtront ici dès que tu auras un match.</p>'; return; }
  m.sort((a,b)=>(b.last?.created_at||'').localeCompare(a.last?.created_at||''));
  l.innerHTML=m.map(({p,last},i)=>`<button class="row" data-i="${i}">${avatar(p)}<div><b>${esc(p.name)}</b><p>${last?esc(last.body):'Nouveau match ! Dis-lui bonjour 👋'}</p></div>${last?`<time>${hhmm(last.created_at)}</time>`:''}</button>`).join('');
  l.querySelectorAll('.row').forEach(b=>b.onclick=()=>chat(m[+b.dataset.i].p));
}
async function chat(p){
  page(`<div class="page" style="padding-bottom:0"><div class="top"><button class="back" id="bk" aria-label="Retour">←</button>${avatar(p)}<div style="flex:1;min-width:0"><b style="font-family:var(--display);font-size:20px">${esc(p.name)}</b><div class="meta">${esc(p.city||'')}</div></div><button class="back" id="more" aria-label="Signaler ou bloquer">⋯</button></div>
    <div class="chat" id="c"></div>
    <form class="send" id="f"><input class="input" id="t" maxlength="1000" placeholder="Écris-lui un petit mot…" autocomplete="off"><button class="act like" aria-label="Envoyer">➤</button></form></div>`);
  root.querySelector('#bk').onclick=()=>main('messages');
  root.querySelector('#more').onclick=()=>safety(p,()=>main('messages'));
  const box=root.querySelector('#c'); let count=-1;
  const load=async()=>{ try{ const ms=await API.messages(p.id); if(ms.length===count) return; count=ms.length;
      box.innerHTML=`<div class="bub sys">vous vous êtes plu ♡</div>`+ms.map(m=>`<div class="bub ${m.mine?'me':'her'}">${esc(m.body)}</div>`).join('');
      box.scrollTop=box.scrollHeight; }catch(e){} };
  await load(); state.poll=setInterval(load,3000);
  root.querySelector('#f').onsubmit=async e=>{ e.preventDefault(); const t=root.querySelector('#t'); const body=t.value.trim(); if(!body) return; t.value='';
    try{ await API.send(p.id,body); await load(); }catch(err){ toast(frErr(err.message)); t.value=body; } };
}
function safety(p,after){
  const v=document.createElement('div'); v.className='veil';
  const reasons=['Faux profil','Message déplacé ou insultant','Photos inappropriées','Elle semble mineure','Autre chose'];
  v.innerHTML=`<div class="sheet" role="dialog" aria-label="Signaler ou bloquer"><h3>${esc(p.name)}</h3>
    <p class="sub">Elle ne saura pas que tu l'as signalée ou bloquée.</p>
    <button class="row" data-a="block">🚫 Bloquer ${esc(p.name)}</button>
    <p class="sub" style="font-weight:700;margin-top:6px">Signaler pour…</p>
    ${reasons.map(r=>`<button class="row" data-r="${esc(r)}">${esc(r)}</button>`).join('')}
    <button class="link" data-a="x">Annuler</button></div>`;
  document.body.appendChild(v);
  v.onclick=async e=>{ if(e.target===v) return v.remove(); const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.a==='x') return v.remove();
    try{ if(b.dataset.r){ await API.report(p.id,b.dataset.r); await API.block(p.id); toast('Merci. Profil signalé et bloqué.'); }
         else { await API.block(p.id); toast(`${p.name} est bloquée.`); }
         v.remove(); after(); }catch(err){ toast(frErr(err.message)); } };
}
function photoTap(c,p){
  if(!p.photos||p.photos.length<2) return; let ph=0;
  c.querySelector('.ph').addEventListener('click',e=>{ if(e.target.closest('.more')) return; const r=c.getBoundingClientRect();
    ph=(ph+(e.clientX>r.left+r.width/2?1:p.photos.length-1))%p.photos.length;
    c.querySelector('.ph').style.backgroundImage=`url('${p.photos[ph]}')`; c.querySelectorAll('.dots i').forEach((d,i)=>d.classList.toggle('on',i===ph)); });
}
function profileView(){
  const v=root.querySelector('#view'); const p=state.me;
  const many=(p.photos||[]).length>1;
  v.innerHTML=`<div class="list"><div class="mehead"><h2 class="ttl">Mon profil</h2><button class="chip" id="edit">Modifier</button></div>
    <p class="note" style="margin-bottom:14px">${many?'touche la photo pour voir les suivantes':'voilà ce que les autres voient'}</p>
    <div class="mecard"><article class="card">${cardHTML({...p,km:0})}</article></div>
    ${p.prompt_a?`<div class="row" style="margin-top:22px;display:block"><b>${esc(p.prompt_q)}</b><p style="white-space:normal;font-family:var(--display);font-style:italic;font-size:22px;color:var(--text)">${esc(p.prompt_a)}</p></div>`:''}
    <div class="menu"><button class="btn full" id="edit2">Modifier mon profil</button><button class="btn full" id="out">Me déconnecter</button></div></div>`;
  photoTap(v.querySelector('.mecard .card'),p);
  const edit=()=>{ state.draft={...blankDraft(),...p,photos:[...(p.photos||[])],interests:[...(p.interests||[])]}; state.step=1; state.editing=true; onboarding(); };
  v.querySelector('#edit').onclick=edit; v.querySelector('#edit2').onclick=edit;
  v.querySelector('#out').onclick=async()=>{ await API.signOut(); state.me=null; welcome(); };
}

intro();
