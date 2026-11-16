/* Velours — intro, connexion, création du profil */
'use strict';
const root = document.getElementById('root');
const DOODLES = ['♡','✿','☆'];
const colorOf = id => COLORS[Math.abs(hash(id))%COLORS.length];
const hasPh = p => !!(p.photos && p.photos.length);
const phStyle = (p,i=0) => p.photos && p.photos[i] ? `background-image:url('${esc(p.photos[i])}')` : `background:linear-gradient(150deg,${colorOf(p.id)[0]},${colorOf(p.id)[1]})`;
const avatar = p => `<div class="av" style="${phStyle(p)}">${hasPh(p)?'':esc((p.name||'?')[0])}</div>`;
const hhmm = t => { const d=new Date(t), n=new Date(); return d.toDateString()===n.toDateString() ? d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); };
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2600); }

/* Logo : deux cœurs qui se chevauchent */
const HEART='M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C40 8 46 14 50 21 C54 14 60 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z';
const logo = (cls='logo') => `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true">
  <defs><linearGradient id="vg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A93"/><stop offset="1" stop-color="#E2B877"/></linearGradient></defs>
  <circle class="h1" cx="60" cy="62" r="50" fill="none" stroke="#E2B877" stroke-opacity=".7" stroke-width="1.2"/>
  <text class="h2" x="60" y="88" text-anchor="middle" font-family="Instrument Serif, Didot, Georgia, serif" font-style="italic" font-size="80" fill="url(#vg)">V</text>
  <path class="spark" d="M60 4 L62.2 9.8 L68 12 L62.2 14.2 L60 20 L57.8 14.2 L52 12 L57.8 9.8 Z" fill="#FF6F7D"/>
</svg>`;

const state = { draft:null, step:0, deck:[], filter:'Toutes', tab:'discover', poll:null, me:null, editing:false };
function stopPoll(){ if(state.poll){ clearInterval(state.poll); state.poll=null; } state.chatWith=null; if(state.typ){ try{state.typ.stop()}catch(e){} state.typ=null; } if(state.rec){ try{state.rec.stop()}catch(e){} state.rec=null; } }
function page(html){ stopPoll(); root.innerHTML=html; }

function intro(){
  const el=document.createElement('section'); el.className='intro'; el.setAttribute('aria-label','Ouverture');
  const conf=Array.from({length:14},(_,i)=>{const a=i/14*Math.PI*2, r=110+Math.random()*60; return `<b style="--x:${Math.round(Math.cos(a)*r)}px;--y:${Math.round(Math.sin(a)*r)}px;--r:${(Math.random()*80-40)|0}deg;color:${['#E2B877','#FF6F7D','#F6E6E1'][i%3]}">✦</b>`}).join('');
  el.innerHTML=`<button class="skip">Passer</button><div class="confetti">${conf}</div>${logo()}
    <h1 class="word" aria-label="velours">${[...'velours'].map((c,i)=>`<span style="animation-delay:${(1.9+i*.1).toFixed(2)}s">${c}</span>`).join('')}</h1>
    <p class="tagline">entre filles qui s'aiment</p>
    <button class="btn pink">C'est parti !</button>`;
  document.body.appendChild(el);
  let done=false;
  const go=()=>{ if(done) return; done=true; el.classList.add('out'); setTimeout(()=>el.remove(),600); start(); };
  el.querySelector('.btn').onclick=go; el.querySelector('.skip').onclick=go;
}

async function start(){
  try{
    const s=await API.session();
    if(!s) return welcome();
    const p=await API.myProfile();
    if(!p){ state.draft=blankDraft(); state.step=1; state.editing=false; return onboarding(); }
    if(p.banned) return suspended();
    state.me=p; registerSW(); if(ONLINE) startLive(); main('discover');
  }catch(e){ welcome(frErr(e.message)); }
}
function suspended(){
  page(`<div class="welcome">${logo()}<h1 class="q">Compte suspendu</h1><p class="sub" style="max-width:32ch">Ton compte a été suspendu après des signalements. Ton profil n'est plus visible.</p><button class="btn" id="out">Me déconnecter</button></div>`);
  root.querySelector('#out').onclick=async()=>{ await API.signOut(); welcome(); };
}

function welcome(err){
  page(`<div class="welcome">${logo()}
    <div class="word">velours</div>
    <p class="note">ici, on se trouve entre nous</p>
    <p class="sub" style="max-width:30ch">Rencontre des filles qui aiment les filles, près de chez toi. Gratuit, bienveillant et réservé aux 18 ans et plus.</p>
    ${err?`<div class="err">${esc(err)}</div>`:''}
    <button class="btn pink" id="toSignup">Créer mon compte</button>
    <button class="btn" id="toLogin">J'ai déjà un compte</button>
    ${ONLINE?'':'<span class="demo">Mode démo : tout reste sur ce téléphone</span>'}
  </div>`);
  root.querySelector('#toSignup').onclick=()=>auth('signup');
  root.querySelector('#toLogin').onclick=()=>auth('login');
}

function auth(mode, msg){
  const up=mode==='signup';
  page(`<div class="page"><div class="top"><button class="back" aria-label="Retour">←</button></div>
    <form class="scroll" id="f" novalidate>
      <h1 class="q">${up?'Crée ton compte':'Contente de te revoir'}</h1>
      <p class="note">${up?'ça prend 2 minutes, promis':'on t\'attendait ♡'}</p>
      <div class="field"><label for="em">E-mail</label><input class="input" id="em" type="email" autocomplete="email" required></div>
      <div class="field"><label for="pw">Mot de passe</label><input class="input" id="pw" type="password" autocomplete="${up?'new-password':'current-password'}" minlength="8" required placeholder="${up?'8 caractères minimum':''}"></div>
      ${up?`<label class="check"><input type="checkbox" id="adult"> <span>J'ai 18 ans ou plus, et je m'engage à être respectueuse avec les autres membres.</span></label>`:''}
      <div id="msg">${msg?`<div class="${msg.ok?'ok':'err'}">${esc(msg.text)}</div>`:''}</div>
      <div class="foot"><button class="btn pink full" type="submit">${up?'Continuer':'Me connecter'}</button>
      <button class="link" type="button" id="sw">${up?'J\'ai déjà un compte':'Je n\'ai pas encore de compte'}</button></div>
    </form></div>`);
  root.querySelector('.back').onclick=()=>welcome();
  root.querySelector('#sw').onclick=()=>auth(up?'login':'signup');
  root.querySelector('#f').onsubmit=async e=>{
    e.preventDefault();
    const em=root.querySelector('#em').value.trim().toLowerCase(), pw=root.querySelector('#pw').value, out=root.querySelector('#msg');
    const fail=t=>{ out.innerHTML=`<div class="err">${esc(t)}</div>`; };
    if(!/^\S+@\S+\.\S+$/.test(em)) return fail('Vérifie ton adresse e-mail.');
    if(pw.length<8) return fail('Le mot de passe doit faire au moins 8 caractères.');
    if(up && !root.querySelector('#adult').checked) return fail('Coche la case pour confirmer que tu as 18 ans ou plus.');
    const b=root.querySelector('[type=submit]'); b.disabled=true; b.textContent='Un instant…';
    try{ up ? await API.signUp(em,pw) : await API.signIn(em,pw); await start(); }
    catch(err){ if(err.ok) return auth('login',{ok:true,text:err.message}); b.disabled=false; b.textContent=up?'Continuer':'Me connecter'; fail(frErr(err.message)); }
  };
}

function blankDraft(){ return {name:'',birthdate:'',identity:'',looking:'',photos:[],bio:'',city:'',prompt_q:PROMPTS[0],prompt_a:'',interests:[]}; }
const STEPS=5;
function onboarding(err){
  const d=state.draft, s=state.step;
  const head=`<div class="top"><button class="back" aria-label="Retour">←</button><div class="bar"><i style="width:${s/STEPS*100}%"></i></div></div>`;
  let body='', ok=()=>true;
  if(s===1){
    body=`<h1 class="q">Comment tu t'appelles ?</h1><p class="note">ton prénom suffit</p>
      <div class="field"><label for="nm">Prénom</label><input class="input" id="nm" maxlength="30" autocomplete="given-name" value="${esc(d.name)}"></div>
      <div class="field"><label for="bd">Date de naissance</label><input class="input" id="bd" type="date" value="${esc(d.birthdate)}"></div>
      <p class="sub">Seul ton âge sera affiché sur ton profil.</p>`;
    ok=()=>{ d.name=root.querySelector('#nm').value.trim(); d.birthdate=root.querySelector('#bd').value;
      if(!d.name) return 'Écris ton prénom.'; if(!d.birthdate) return 'Indique ta date de naissance.';
      if(age(d.birthdate)<18) return 'Désolée, Velours est réservé aux personnes de 18 ans et plus.'; return true; };
  }
  if(s===2){
    body=`<h1 class="q">Tu te définis comme…</h1>
      <div class="chips" data-k="identity">${IDENTITIES.map(i=>`<button type="button" class="chip big ${d.identity===i?'on':''}">${i}</button>`).join('')}</div>
      <h1 class="q" style="font-size:24px">Et tu cherches…</h1>
      <div class="chips" data-k="looking">${LOOKING.map(i=>`<button type="button" class="chip big ${d.looking===i?'on':''}">${esc(i)}</button>`).join('')}</div>`;
    ok=()=> !d.identity ? 'Choisis comment tu te définis.' : !d.looking ? 'Dis-nous ce que tu cherches.' : true;
  }
  if(s===3){
    body=`<h1 class="q">Ajoute tes plus belles photos</h1><p class="note">au moins une, jusqu'à trois</p>
      <div class="photos">${[0,1,2].map(i=>d.photos[i]
        ? `<div class="slot has" style="background-image:url('${esc(d.photos[i])}')"><button type="button" class="x" data-i="${i}" aria-label="Retirer">✕</button>${i===0?'<span class="main">Principale</span>':''}</div>`
        : `<label class="slot" for="ph${i}">+<input id="ph${i}" type="file" accept="image/*"></label>`).join('')}</div>
      <div id="upl"></div>
      <p class="sub">Montre bien ton visage sur la première. Pas de nudité : les photos signalées sont retirées.</p>`;
    ok=()=> d.photos.length ? true : 'Ajoute au moins une photo.';
  }
  if(s===4){
    body=`<h1 class="q">Parle un peu de toi</h1>
      <div class="field"><label for="bio">Ta bio</label><textarea class="input" id="bio" maxlength="300" placeholder="Ce qui te fait rire, ce que tu aimes faire le week-end…">${esc(d.bio)}</textarea></div>
      <div class="field"><label for="pq">Une petite question</label><select class="input" id="pq">${PROMPTS.map(p=>`<option ${d.prompt_q===p?'selected':''}>${p}</option>`).join('')}</select>
        <input class="input" id="pa" maxlength="150" placeholder="Ta réponse" value="${esc(d.prompt_a)}"></div>
      <div class="field"><label for="ct">Ta ville ou ton quartier</label><input class="input" id="ct" maxlength="60" value="${esc(d.city)}" placeholder="Ex. Lyon 7e"></div>`;
    ok=()=>{ d.bio=root.querySelector('#bio').value.trim(); d.prompt_q=root.querySelector('#pq').value; d.prompt_a=root.querySelector('#pa').value.trim(); d.city=root.querySelector('#ct').value.trim();
      return !d.bio ? 'Écris quelques mots dans ta bio.' : !d.city ? 'Indique ta ville.' : true; };
  }
  if(s===5){
    body=`<h1 class="q">Ce que tu aimes</h1><p class="note">choisis-en 3 à 6</p>
      <div class="chips" data-k="interests">${INTERESTS.map(i=>`<button type="button" class="chip ${d.interests.includes(i)?'on':''}">${i}</button>`).join('')}</div>`;
    ok=()=> d.interests.length<3 ? 'Choisis au moins 3 centres d\'intérêt.' : true;
  }
  page(`<div class="page">${head}<form class="scroll" id="f" novalidate>${body}
    ${err?`<div class="err">${esc(err)}</div>`:''}
    <div class="foot"><button class="btn pink full" type="submit">${s===STEPS?(state.editing?'Enregistrer':'Terminer mon profil'):'Continuer'}</button></div></form></div>`);
  root.querySelector('.back').onclick=()=>{ if(s>1){ state.step--; return onboarding(); } if(state.editing) return main('profile'); API.signOut(); welcome(); };
  root.querySelectorAll('.chips').forEach(g=>g.onclick=e=>{ const b=e.target.closest('.chip'); if(!b) return; const k=g.dataset.k, v=b.textContent;
    if(k==='interests'){ const has=d.interests.includes(v); if(!has&&d.interests.length>=6) return toast('6 maximum'); d.interests=has?d.interests.filter(x=>x!==v):[...d.interests,v]; b.classList.toggle('on',!has); }
    else { d[k]=v; g.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===b)); } });
  root.querySelectorAll('.slot input').forEach(inp=>inp.onchange=async()=>{ const f=inp.files[0]; if(!f) return;
    root.querySelector('#upl').innerHTML='<div class="ok">Envoi de la photo…</div>';
    try{ const url=await API.uploadPhoto(f); d.photos=[...d.photos,url].slice(0,3); onboarding(); }
    catch(e){ root.querySelector('#upl').innerHTML=`<div class="err">${esc(frErr(e.message))}</div>`; } });
  root.querySelectorAll('.slot .x').forEach(x=>x.onclick=()=>{ d.photos.splice(+x.dataset.i,1); onboarding(); });
  root.querySelector('#f').onsubmit=async e=>{ e.preventDefault(); const r=ok(); if(r!==true) return onboarding(r);
    if(s<STEPS){ state.step++; return onboarding(); }
    const b=root.querySelector('[type=submit]'); b.disabled=true; b.textContent='Enregistrement…';
    try{ await API.saveProfile(d); state.me=await API.myProfile(); const was=state.editing; state.editing=false; main(was?'profile':'discover'); toast(was?'Profil mis à jour':'Bienvenue sur Velours ♡'); }
    catch(err){ onboarding(frErr(err.message)); } };
}
