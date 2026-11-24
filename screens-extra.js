/* Velours — filtres, vérification, modération, notifications */
'use strict';
const VERIF_ICON = '<svg class="vbadge" viewBox="0 0 24 24" aria-label="Profil vérifié"><path d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z" fill="#E2B877"/><path d="M8 12.2l2.6 2.6L16.2 9" fill="none" stroke="#1A0D1C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------- Filtres ---------- */
const FILTER_DEFAULT = {minAge:18,maxAge:60,maxKm:0,looking:'Toutes',verified:false};
const getFilters = () => ({...FILTER_DEFAULT, ...ls.get('velours-filters',{})});
function applyFilters(list){
  const f=getFilters();
  return list.filter(p=>{ const a=age(p.birthdate);
    if(a<f.minAge||a>f.maxAge) return false;
    if(f.looking!=='Toutes'&&p.looking!==f.looking) return false;
    if(f.verified&&!p.verified) return false;
    if(f.maxKm&&!(p.km&&p.km<=f.maxKm)) return false;
    return true; });
}
function filterSummary(){
  const f=getFilters(), parts=[`${f.minAge}–${f.maxAge} ans`];
  parts.push(f.maxKm?`${f.maxKm} km max`:'partout');
  if(f.looking!=='Toutes') parts.push(f.looking.toLowerCase());
  if(f.verified) parts.push('vérifiées');
  return parts.join(' · ');
}
function filtersSheet(onDone){
  const f=getFilters();
  const v=document.createElement('div'); v.className='veil';
  v.innerHTML=`<form class="sheet" role="dialog" aria-label="Filtres">
    <h3>Filtres</h3>
    <div class="field"><label>Âge</label><div class="duo">
      <input class="input" id="fa1" type="number" min="18" max="99" value="${f.minAge}" aria-label="Âge minimum"><span>à</span>
      <input class="input" id="fa2" type="number" min="18" max="99" value="${f.maxAge}" aria-label="Âge maximum"><span>ans</span></div></div>
    <div class="field"><label for="fk">Distance</label><select class="input" id="fk">
      ${[[0,'Peu importe'],[5,'5 km'],[10,'10 km'],[25,'25 km'],[50,'50 km'],[100,'100 km']].map(([k,l])=>`<option value="${k}" ${f.maxKm==k?'selected':''}>${l}</option>`).join('')}</select>
      <button type="button" class="link" id="geo" style="align-self:flex-start;padding:4px 0">📍 Mettre à jour ma position</button><span class="sub" id="geomsg" style="font-size:13px"></span></div>
    <div class="field"><label for="fl">Elle cherche</label><select class="input" id="fl">
      ${['Toutes',...LOOKING].map(l=>`<option ${f.looking===l?'selected':''}>${esc(l)}</option>`).join('')}</select></div>
    <label class="check"><input type="checkbox" id="fv" ${f.verified?'checked':''}> <span>Seulement les profils vérifiés</span></label>
    <button class="btn pink full" type="submit">Voir les profils</button>
    <button class="link" type="button" id="reset">Tout réinitialiser</button></form>`;
  document.body.appendChild(v);
  v.querySelector('#geo').onclick=()=>locate(v.querySelector('#geomsg'));
  v.querySelector('#reset').onclick=()=>{ ls.set('velours-filters',FILTER_DEFAULT); v.remove(); onDone(); };
  v.onclick=e=>{ if(e.target===v) v.remove(); };
  v.querySelector('form').onsubmit=e=>{ e.preventDefault();
    let a1=Math.max(18,+v.querySelector('#fa1').value||18), a2=Math.max(a1,+v.querySelector('#fa2').value||60);
    ls.set('velours-filters',{minAge:a1,maxAge:a2,maxKm:+v.querySelector('#fk').value,looking:v.querySelector('#fl').value,verified:v.querySelector('#fv').checked});
    v.remove(); onDone(); };
}
function locate(out){
  if(!navigator.geolocation){ if(out) out.textContent='Ton téléphone ne donne pas sa position.'; return; }
  if(out) out.textContent='Recherche de ta position…';
  navigator.geolocation.getCurrentPosition(async pos=>{
    try{ await API.saveLocation(pos.coords.latitude,pos.coords.longitude); ls.set('velours-geo',Date.now()); if(out) out.textContent='Position mise à jour ✓ (arrondie à 1 km près)'; }
    catch(e){ if(out) out.textContent=frErr(e.message); } },
    ()=>{ if(out) out.textContent='Position refusée. Autorise-la dans Réglages → Safari → Position.'; },
    {enableHighAccuracy:false,timeout:10000,maximumAge:600000});
}

/* ---------- Vérification par selfie ---------- */
async function verifyScreen(){
  let v=null; try{ v=await API.verification(); }catch(e){}
  const st=state.me.verified?'approved':v?.status;
  page(`<div class="page"><div class="top"><button class="back" id="bk" aria-label="Retour">←</button></div>
    <div class="scroll">
      <h1 class="q">Fais vérifier ton profil</h1>
      <p class="note">un petit badge doré qui rassure tout le monde</p>
      ${st==='approved'?`<div class="ok">${VERIF_ICON} Ton profil est vérifié. Le badge apparaît à côté de ton prénom.</div>`:''}
      ${st==='pending'?`<div class="ok">Ton selfie est en cours de vérification. Tu auras le badge dès qu'il sera validé.</div>`:''}
      ${st==='refused'?`<div class="err">Ton selfie n'a pas été validé. Réessaie avec ton visage bien visible et le geste demandé.</div>`:''}
      ${st!=='approved'?`<div class="pose"><div class="pose-v">V</div><p>Prends un selfie en faisant un <b>V avec tes doigts</b> à côté de ton visage. On le compare à tes photos, puis il est supprimé de ton profil public : personne d'autre ne le voit.</p></div>
      <label class="btn pink full" for="selfie">📸 Prendre mon selfie<input id="selfie" type="file" accept="image/*" capture="user" hidden></label>
      <div id="vmsg"></div>`:''}
    </div></div>`);
  root.querySelector('#bk').onclick=async()=>{ try{ state.me=await API.myProfile()||state.me; }catch(e){} main('profile'); };
  const inp=root.querySelector('#selfie'); if(!inp) return;
  inp.onchange=async()=>{ const f=inp.files[0]; if(!f) return; const m=root.querySelector('#vmsg'); m.innerHTML='<div class="ok">Envoi du selfie…</div>';
    try{ await API.requestVerification(f); toast('Selfie envoyé ✓'); verifyScreen(); }catch(e){ m.innerHTML=`<div class="err">${esc(frErr(e.message))}</div>`; } };
}

/* ---------- Modération (toi uniquement) ---------- */
async function adminScreen(tab='reports'){
  const T=[['reports','Signalements'],['verifs','Vérifications'],['blocks','Blocages'],['members','Membres']];
  page(`<div class="page"><div class="top"><button class="back" id="bk" aria-label="Retour">←</button><h1 class="q" style="margin:0;font-size:30px">Modération</h1></div>
    <div class="filters">${T.map(([k,l])=>`<button class="chip ${k===tab?'on':''}" data-t="${k}">${l}</button>`).join('')}</div>
    <div class="list" id="al"><p class="sub">Chargement…</p></div></div>`);
  root.querySelector('#bk').onclick=()=>main('profile');
  root.querySelectorAll('.filters .chip').forEach(c=>c.onclick=()=>adminScreen(c.dataset.t));
  const l=root.querySelector('#al'); const when=t=>new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const act=async(fn,msg)=>{ try{ await fn(); toast(msg); adminScreen(tab); }catch(e){ toast(frErr(e.message)); } };
  try{
    if(tab==='reports'){ const r=await API.adminReports();
      l.innerHTML=r.length?r.map((x,i)=>`<div class="mod"><b>${esc(x.reported_name)}</b> signalée par ${esc(x.reporter_name)}<div class="sub">${esc(x.reason)} · ${when(x.created_at)}${x.reported_banned?' · <span class="tag-ban">bannie</span>':''}</div>
        <div class="modbtns"><button class="chip" data-a="dismiss" data-i="${i}">Ignorer</button><button class="chip" data-a="unblock" data-i="${i}">Débloquer</button><button class="chip danger" data-a="ban" data-i="${i}">${x.reported_banned?'Débannir':'Bannir'} ${esc(x.reported_name)}</button></div></div>`).join(''):'<p class="sub">Aucun signalement. Tout va bien ✨</p>';
      l.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const x=r[+b.dataset.i];
        if(b.dataset.a==='dismiss') act(()=>API.adminDismiss(x.id),'Signalement ignoré');
        if(b.dataset.a==='unblock') act(()=>API.adminUnblock(x.reporter,x.reported),'Blocage retiré');
        if(b.dataset.a==='ban') act(()=>API.adminBan(x.reported,!x.reported_banned),x.reported_banned?'Profil débanni':'Profil banni'); }); }
    if(tab==='verifs'){ const r=await API.adminVerifs();
      l.innerHTML=r.length?r.map((x,i)=>`<div class="mod"><b>${esc(x.name)}</b><div class="vpair"><div style="background-image:url('${esc(x.selfie||'')}')"><span>Selfie</span></div><div style="background-image:url('${esc(x.photo||'')}')"><span>Profil</span></div></div>
        <div class="modbtns"><button class="chip on" data-a="ok" data-i="${i}">Valider</button><button class="chip danger" data-a="no" data-i="${i}">Refuser</button></div></div>`).join(''):'<p class="sub">Aucune demande de vérification en attente.</p>';
      l.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const x=r[+b.dataset.i]; act(()=>API.adminVerify(x.user_id,b.dataset.a==='ok'),b.dataset.a==='ok'?'Profil vérifié ✓':'Vérification refusée'); }); }
    if(tab==='blocks'){ const r=await API.adminBlocks();
      l.innerHTML=r.length?r.map((x,i)=>`<div class="mod"><b>${esc(x.blocker_name)}</b> a bloqué <b>${esc(x.blocked_name)}</b><div class="sub">${when(x.created_at)}</div>
        <div class="modbtns"><button class="chip" data-i="${i}">Débloquer</button></div></div>`).join(''):'<p class="sub">Aucun blocage.</p>';
      l.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ const x=r[+b.dataset.i]; act(()=>API.adminUnblock(x.blocker,x.blocked),'Blocage retiré'); }); }
    if(tab==='members'){ const r=await API.adminMembers();
      l.innerHTML=`<p class="sub" style="margin-bottom:10px">${r.length} membre${r.length>1?'s':''}</p>`+r.map((p,i)=>`<div class="row">${avatar(p)}<div><b>${esc(p.name)}, ${age(p.birthdate)}</b> ${p.verified?VERIF_ICON:''}${p.banned?' <span class="tag-ban">bannie</span>':''}<p>${esc(p.city||'')}</p></div>
        ${isDemo(p)?`<button class="chip on" data-ph="${i}">📷 Photos</button>`:''}<button class="chip ${p.banned?'':'danger'}" data-i="${i}">${p.banned?'Débannir':'Bannir'}</button></div>`).join('');
      l.querySelectorAll('[data-ph]').forEach(b=>b.onclick=()=>demoPhotosSheet(r[+b.dataset.ph],()=>adminScreen('members')));
      l.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ const p=r[+b.dataset.i]; act(()=>API.adminBan(p.id,!p.banned),p.banned?'Profil débanni':'Profil banni'); }); }
  }catch(e){ l.innerHTML=`<div class="err">${esc(frErr(e.message))}</div>`; }
}

/* ---------- Notifications ---------- */
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function registerSW(){ if(ONLINE && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{}); }
function b64ToBytes(s){ const p='='.repeat((4-s.length%4)%4); const b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from([...b].map(c=>c.charCodeAt(0))); }
async function enablePush(){
  if(!ONLINE) return toast('Les notifications marchent dans la vraie app en ligne.');
  if(!pushSupported()) return toast(isStandalone()?'Ton téléphone ne gère pas encore les notifications (il faut iOS 16.4 ou plus).':'Ajoute d\'abord Velours à ton écran d\'accueil, puis ouvre-la depuis l\'icône.');
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted') return toast('Notifications refusées. Tu peux les autoriser dans Réglages → Notifications → Velours.');
    const reg=await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;
    const sub=(await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(CFG.push)});
    await API.pushSave(sub); ls.set('velours-push',true); toast('Notifications activées 🔔'); if(state.tab==='profile') main('profile');
  }catch(e){ toast(frErr(e.message)); }
}

/* Messages non lus + notifications dans l'app */
const seen = { get(id){ return ls.get('velours-seen',{})[id]||''; }, set(id){ const s=ls.get('velours-seen',{}); s[id]=new Date().toISOString(); ls.set('velours-seen',s); } };
const unreadOf = list => list.filter(({p,last})=>last && last.sender===p.id && last.created_at>seen.get(p.id));
async function refreshBadges(){
  try{ const m=await API.matches(); const u=unreadOf(m).length;
    const mb=root.querySelector('#mb'), msb=root.querySelector('#msb');
    if(mb){ mb.hidden=!m.length; mb.textContent=m.length; }
    if(msb){ msb.hidden=!u; msb.textContent=u; }
    if(navigator.setAppBadge){ u?navigator.setAppBadge(u).catch(()=>{}):navigator.clearAppBadge?.().catch(()=>{}); }
  }catch(e){}
}
let liveOn=false;
function startLive(){
  if(liveOn) return; liveOn=true;
  API.subscribeLive(async msg=>{
    if(state.chatWith===msg.sender) return;
    let who='Quelqu\'un'; try{ const m=await API.matches(); who=(m.find(x=>x.p.id===msg.sender)||{p:{name:who}}).p.name; }catch(e){}
    toast(`💬 ${who} : ${msg.kind==='photo'?'📷 Photo':msg.kind==='audio'?'🎤 Message vocal':msg.body}`); refreshBadges();
  }, async like=>{
    if(!like||like.kind==='pass') return;
    try{ const m=await API.matches(); const x=m.find(y=>y.p.id===like.liker); if(x){ toast(`✨ Nouveau match avec ${x.p.name} !`); refreshBadges(); } }catch(e){}
  });
}

/* ---------- v6 : changer les photos des profils de démo (admin) ---------- */
const isDemo = p => String(p.id).startsWith('5eed0000-');
function demoPhotosSheet(p, onDone){
  let photos=[...(p.photos||[])]; let busyUp=false;
  const v=document.createElement('div'); v.className='veil';
  const draw=()=>{ v.innerHTML=`<div class="sheet" role="dialog" aria-label="Photos de ${esc(p.name)}">
    <h3>Photos de ${esc(p.name)}</h3><p class="sub" style="margin:0">Touche une photo pour la remplacer. Photos non explicites uniquement.</p>
    <div class="dslots">${[0,1,2].map(i=>`<button class="dslot" data-s="${i}" style="${photos[i]?`background-image:url('${esc(photos[i])}')`:''}">${photos[i]?'<span>Changer</span>':'<span>+ Ajouter</span>'}</button>`).join('')}</div>
    <input type="file" accept="image/*" id="dfile" hidden>
    <button class="btn pink full" id="dok">Fermer</button></div>`;
    let slot=0; const f=v.querySelector('#dfile');
    v.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ if(busyUp) return; slot=Math.min(+b.dataset.s,photos.length); f.click(); });
    f.onchange=async()=>{ const file=f.files[0]; if(!file) return; busyUp=true; toast('Envoi de la photo…');
      try{ const url=await API.uploadPhoto(file); const next=[...photos]; next[slot]=url;
        await API.adminSetPhotos(p.id,next); photos=next; p.photos=next; toast('Photo changée ✓'); draw(); }
      catch(e){ toast(frErr(e.message)); } busyUp=false; };
    v.querySelector('#dok').onclick=()=>{ v.remove(); onDone&&onDone(); };
  };
  draw(); document.body.appendChild(v);
  v.addEventListener('click',e=>{ if(e.target===v){ v.remove(); onDone&&onDone(); } });
}
