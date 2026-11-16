/* Velours — données. Deux modes : "en ligne" (Supabase, si config.js est rempli) et "démo" (tout reste sur ce téléphone). */
'use strict';
const CFG = window.VELOURS_CONFIG || {};
const ONLINE = !!(CFG.url && CFG.key && window.supabase);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ls = {get(k,d){try{return JSON.parse(localStorage.getItem(k)) ?? d}catch{return d}}, set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};

const IDENTITIES = ['Lesbienne','Bi','Pan','Queer','En questionnement','Autre'];
const LOOKING = ['Une histoire d\'amour','Des rencontres, on verra','De nouvelles amies'];
const INTERESTS = ['☕ Cafés','🎤 Karaoké','🧗 Escalade','📚 Lecture','🎮 Jeux vidéo','🐱 Chats','🐶 Chiens','🍷 Apéros','🎨 Art','🌱 Jardinage','🏳️‍🌈 Militantisme','🎬 Séries','🎶 Concerts','🏖️ Voyages','🍳 Cuisine','💃 Danse','🏋️ Sport','📸 Photo','🧘 Yoga','🎲 Jeux de société'];
const PROMPTS = ['Mon dimanche parfait…','Je craque pour…','Le premier date idéal…','Ma playlist du moment…','On s\'entendra bien si…'];
const COLORS = [['#6B2346','#2A1630'],['#8E3A4F','#2A1630'],['#5A2F5E','#1E1024'],['#9C5A3C','#2A1630'],['#7A2E5E','#1A0D1C'],['#4E2A55','#1A0D1C']];

const SEED = [
  {id:'s1',name:'Inès',birthdate:'1998-03-02',identity:'Lesbienne',looking:LOOKING[0],city:'Lyon 1er',bio:'Céramiste le jour, karaoké le jeudi. Je te laisse choisir la chanson 🎤',prompt_q:PROMPTS[2],prompt_a:'Un atelier poterie, puis une glace même s\'il fait froid.',interests:['🎤 Karaoké','🎨 Art','🍷 Apéros'],likesYou:true,km:2},
  {id:'s2',name:'Maëlle',birthdate:'2001-07-19',identity:'Bi',looking:LOOKING[1],city:'Villeurbanne',bio:'Escalade, polars et brunchs qui durent trop longtemps.',prompt_q:PROMPTS[0],prompt_a:'Grimpe le matin, sieste l\'aprem, crêpes le soir.',interests:['🧗 Escalade','📚 Lecture','☕ Cafés'],likesYou:false,km:5},
  {id:'s3',name:'Sarah',birthdate:'1995-11-08',identity:'Lesbienne',looking:LOOKING[0],city:'Croix-Rousse',bio:'Photographe argentique. Viens marcher avec moi au coucher du soleil.',prompt_q:PROMPTS[1],prompt_a:'Les fous rires nerveux et les gens qui chantent faux.',interests:['📸 Photo','🎶 Concerts','🐱 Chats'],likesYou:true,km:1},
  {id:'s4',name:'Lou',birthdate:'2000-01-25',identity:'Queer',looking:LOOKING[2],city:'Caluire',bio:'Infirmière de nuit donc reine du café à 7h. Mes chats valident ou pas.',prompt_q:PROMPTS[4],prompt_a:'…tu aimes les séries coréennes autant que moi.',interests:['🐱 Chats','🎬 Séries','🍳 Cuisine'],likesYou:false,km:7},
  {id:'s5',name:'Jade',birthdate:'1997-05-14',identity:'Pan',looking:LOOKING[0],city:'Lyon 7e',bio:'Danseuse. Mon talent caché : des crêpes parfaites.',prompt_q:PROMPTS[3],prompt_a:'Pomme, Angèle et beaucoup trop de Beyoncé.',interests:['💃 Danse','🏖️ Voyages','🍳 Cuisine'],likesYou:true,km:3},
  {id:'s6',name:'Camille',birthdate:'1992-09-30',identity:'Lesbienne',looking:LOOKING[1],city:'Écully',bio:'Architecte et jardinière du dimanche. J\'aime les gens qui rient fort.',prompt_q:PROMPTS[0],prompt_a:'Marché, potager, et un apéro qui finit tard.',interests:['🌱 Jardinage','🍷 Apéros','🎲 Jeux de société'],likesYou:false,km:12}
];
const REPLIES = ['Coucou toi 😊','Haha j\'adore ! Et toi, tu fais quoi ce week-end ?','Ça me tente bien 🙈','Trop mignon ce message 💕'];

const age = b => { if(!b) return ''; const d=new Date(b), n=new Date(); let a=n.getFullYear()-d.getFullYear(); if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate())) a--; return a; };
const hash = s => [...String(s)].reduce((h,c)=>(h*31+c.charCodeAt(0))|0,7);
function resize(file, max){
  return new Promise((ok,ko)=>{ const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{ const s=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url); c.toBlob(b=>b?ok(b):ko(new Error('photo')),'image/jpeg',.82); };
    img.onerror=()=>ko(new Error('Cette image ne peut pas être lue. Essaie une photo JPG ou PNG.')); img.src=url; });
}
const blobToData = b => new Promise(ok=>{ const r=new FileReader(); r.onload=()=>ok(r.result); r.readAsDataURL(b); });

function frErr(m){
  m=String(m||'');
  if(/Invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if(/already registered/i.test(m)) return 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.';
  if(/Email not confirmed/i.test(m)) return 'Confirme d\'abord ton e-mail (regarde ta boîte de réception, et les spams).';
  if(/Password should be/i.test(m)) return 'Le mot de passe doit faire au moins 8 caractères.';
  if(/birthdate/i.test(m)) return 'Velours est réservé aux personnes de 18 ans et plus.';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Pas de connexion internet. Réessaie dans un instant.';
  return m;
}

/* Mode démo */
const Demo = {
  db(){ return ls.get('velours-demo',{users:{},session:null,profiles:{},likes:[],blocks:[],messages:[]}); },
  save(d){ ls.set('velours-demo',d); },
  async session(){ return this.db().session; },
  async signUp(email,pw){ const d=this.db(); if(d.users[email]) throw new Error('Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.');
    const id='u'+Date.now(); d.users[email]={pw:hash(pw),id}; d.session=id; this.save(d); return {id}; },
  async signIn(email,pw){ const d=this.db(), u=d.users[email]; if(!u||u.pw!==hash(pw)) throw new Error('E-mail ou mot de passe incorrect.'); d.session=u.id; this.save(d); return {id:u.id}; },
  async signOut(){ const d=this.db(); d.session=null; this.save(d); },
  async myProfile(){ const d=this.db(); return d.profiles[d.session]||null; },
  async saveProfile(p){ const d=this.db(); d.profiles[d.session]={...p,id:d.session}; this.save(d); },
  async uploadPhoto(file){ return blobToData(await resize(file,700)); },
  all(){ const d=this.db(); return SEED.map(s=>({...s})).concat(Object.values(d.profiles).filter(p=>p.id!==d.session)); },
  async discover(){ const d=this.db(); const seen=new Set(d.likes.filter(l=>l.liker===d.session).map(l=>l.likee)); const bl=new Set(d.blocks.map(b=>b.blocked));
    return this.all().filter(p=>!seen.has(p.id)&&!bl.has(p.id)); },
  async like(id,kind){ const d=this.db(); d.likes.push({liker:d.session,likee:id,kind}); this.save(d); const p=SEED.find(s=>s.id===id); return kind!=='pass' && !!(p&&p.likesYou); },
  async matches(){ const d=this.db(); const bl=new Set(d.blocks.map(b=>b.blocked));
    const mine=d.likes.filter(l=>l.liker===d.session&&l.kind!=='pass').map(l=>l.likee);
    const list=this.all().filter(p=>mine.includes(p.id)&&p.likesYou&&!bl.has(p.id));
    return list.map(p=>({p,last:d.messages.filter(m=>m.pair===p.id).slice(-1)[0]||null})); },
  async messages(id){ const d=this.db(); return d.messages.filter(m=>m.pair===id).map(m=>({...m,mine:m.sender===d.session})); },
  async send(id,body){ const d=this.db(); d.messages.push({pair:id,sender:d.session,body,created_at:new Date().toISOString()}); this.save(d);
    setTimeout(()=>{ const e=this.db(); e.messages.push({pair:id,sender:id,body:REPLIES[e.messages.filter(m=>m.pair===id).length%REPLIES.length],created_at:new Date().toISOString()}); this.save(e); },1800); },
  async report(){},
  async block(id){ const d=this.db(); d.blocks.push({blocked:id}); this.save(d); }
};

/* Mode en ligne (Supabase) */
let sb=null, me=null;
const Online = {
  init(){ sb=window.supabase.createClient(CFG.url,CFG.key); },
  check(r){ if(r.error) throw new Error(frErr(r.error.message)); return r.data; },
  async session(){ const {data}=await sb.auth.getSession(); me=data.session?.user?.id||null; return me; },
  async signUp(email,pw){ const r=this.check(await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname}}));
    if(!r.session) throw Object.assign(new Error('Compte créé ! Ouvre l\'e-mail de confirmation que tu viens de recevoir, puis reviens te connecter.'),{ok:true});
    me=r.user.id; return r.user; },
  async signIn(email,pw){ const r=this.check(await sb.auth.signInWithPassword({email,password:pw})); me=r.user.id; return r.user; },
  async signOut(){ await sb.auth.signOut(); me=null; },
  async myProfile(){ return this.check(await sb.from('profiles').select('*').eq('id',me).maybeSingle()); },
  async saveProfile(p){ const row={id:me,name:p.name,birthdate:p.birthdate,identity:p.identity,looking:p.looking,bio:p.bio,city:p.city,prompt_q:p.prompt_q,prompt_a:p.prompt_a,interests:p.interests,photos:p.photos};
    this.check(await sb.from('profiles').upsert(row)); },
  async uploadPhoto(file){ const b=await resize(file,1080); const path=`${me}/${Date.now()}.jpg`;
    this.check(await sb.storage.from('photos').upload(path,b,{contentType:'image/jpeg'}));
    return sb.storage.from('photos').getPublicUrl(path).data.publicUrl; },
  async blocked(){ const b=this.check(await sb.from('blocks').select('blocker,blocked')); return new Set([...b.map(x=>x.blocked),...b.map(x=>x.blocker)]); },
  async discover(){
    const likes=this.check(await sb.from('likes').select('likee').eq('liker',me));
    const hide=await this.blocked(); hide.add(me); likes.forEach(l=>hide.add(l.likee));
    const all=this.check(await sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(200));
    return all.filter(p=>!hide.has(p.id)); },
  async like(id,kind){ this.check(await sb.from('likes').upsert({liker:me,likee:id,kind}));
    if(kind==='pass') return false;
    const back=this.check(await sb.from('likes').select('kind').eq('liker',id).eq('likee',me).neq('kind','pass'));
    return back.length>0; },
  async matches(){
    const mine=this.check(await sb.from('likes').select('likee').eq('liker',me).neq('kind','pass')).map(l=>l.likee);
    const theirs=new Set(this.check(await sb.from('likes').select('liker').eq('likee',me).neq('kind','pass')).map(l=>l.liker));
    const bl=await this.blocked();
    const ids=mine.filter(i=>theirs.has(i)&&!bl.has(i)); if(!ids.length) return [];
    const ps=this.check(await sb.from('profiles').select('*').in('id',ids));
    const msgs=this.check(await sb.from('messages').select('*').or(`sender.eq.${me},recipient.eq.${me}`).order('created_at',{ascending:false}).limit(300));
    return ps.map(p=>({p,last:msgs.find(m=>m.sender===p.id||m.recipient===p.id)||null})); },
  async messages(id){
    const r=this.check(await sb.from('messages').select('*').or(`and(sender.eq.${me},recipient.eq.${id}),and(sender.eq.${id},recipient.eq.${me})`).order('created_at'));
    return r.map(m=>({...m,mine:m.sender===me})); },
  async send(id,body){ this.check(await sb.from('messages').insert({sender:me,recipient:id,body})); },
  async report(id,reason){ this.check(await sb.from('reports').insert({reporter:me,reported:id,reason})); },
  async block(id){ this.check(await sb.from('blocks').insert({blocker:me,blocked:id})); }
};
const API = ONLINE ? Online : Demo;
if(ONLINE) Online.init();
