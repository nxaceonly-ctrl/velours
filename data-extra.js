/* Velours — données des nouveautés : distance, vérification, modération, médias, notifications */
'use strict';
const round2 = x => Math.round(x*100)/100; // ~1 km : on ne garde jamais la position exacte

/* ---------- Mode démo ---------- */
Object.assign(Demo, {
  async saveLocation(){},
  async isAdmin(){ return true; },
  async verification(){ const d=this.db(); return (d.verifs||{})[d.session]||null; },
  async requestVerification(file){ const d=this.db(); const url=await blobToData(await resize(file,600)); d.verifs=d.verifs||{}; d.verifs[d.session]={status:'pending',selfie:url}; this.save(d);
    setTimeout(()=>{ const e=this.db(); e.verifs[e.session].status='approved'; if(e.profiles[e.session]) e.profiles[e.session].verified=true; this.save(e); },2500); },
  async sendMedia(id,kind,blob){ const d=this.db(); const url=await blobToData(kind==='photo'?await resize(blob,900):blob);
    d.messages.push({pair:id,sender:d.session,body:'',kind,media_path:url,created_at:new Date().toISOString()}); this.save(d); },
  async mediaUrls(paths){ const o={}; paths.forEach(p=>o[p]=p); return o; },
  async adminReports(){ return [{id:1,reason:'Faux profil',created_at:new Date().toISOString(),reporter:'s2',reporter_name:'Maëlle',reported:'s6',reported_name:'Camille',reported_banned:false}]; },
  async adminBlocks(){ return [{blocker:'s2',blocker_name:'Maëlle',blocked:'s6',blocked_name:'Camille',created_at:new Date().toISOString()}]; },
  async adminVerifs(){ return []; },
  async adminMembers(){ return this.all(); },
  async adminDismiss(){}, async adminUnblock(){}, async adminBan(){}, async adminVerify(){},
  async pushSave(){}, subscribeLive(){}
});
SEED.forEach((s,i)=>{ s.verified = i%2===0; });

/* ---------- Mode en ligne ---------- */
Object.assign(Online, {
  async saveLocation(lat,lng){ this.check(await sb.from('locations').upsert({user_id:me,lat:round2(lat),lng:round2(lng),updated_at:new Date().toISOString()})); },
  async discover(){
    const likes=this.check(await sb.from('likes').select('likee').eq('liker',me));
    const hide=await this.blocked(); hide.add(me); likes.forEach(l=>hide.add(l.likee));
    const all=this.check(await sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(300));
    let km={}; try{ (this.check(await sb.rpc('distances'))||[]).forEach(r=>km[r.id]=r.km); }catch(e){}
    return all.filter(p=>!hide.has(p.id)&&!p.banned).map(p=>({...p,km:km[p.id]})); },
  async isAdmin(){ try{ return !!this.check(await sb.rpc('is_admin')); }catch(e){ return false; } },
  async verification(){ return this.check(await sb.from('verifications').select('*').eq('user_id',me).maybeSingle()); },
  async requestVerification(file){ const b=await resize(file,1080); const path=`${me}/${Date.now()}.jpg`;
    this.check(await sb.storage.from('verifications').upload(path,b,{contentType:'image/jpeg'}));
    this.check(await sb.from('verifications').upsert({user_id:me,selfie_path:path})); },
  async sendMedia(id,kind,blob){
    const b = kind==='photo' ? await resize(blob,1280) : blob;
    const ext = kind==='photo' ? 'jpg' : (blob.type.includes('mp4')?'m4a':'webm');
    const path=`${me}/${id}/${Date.now()}.${ext}`;
    this.check(await sb.storage.from('chat').upload(path,b,{contentType:kind==='photo'?'image/jpeg':blob.type}));
    this.check(await sb.from('messages').insert({sender:me,recipient:id,body:'',kind,media_path:path})); },
  async mediaUrls(paths,bucket='chat'){ if(!paths.length) return {}; const r=this.check(await sb.storage.from(bucket).createSignedUrls(paths,3600));
    const o={}; r.forEach(x=>{ if(x.signedUrl) o[x.path]=x.signedUrl; }); return o; },
  async adminReports(){ return this.check(await sb.rpc('admin_reports')); },
  async adminBlocks(){ return this.check(await sb.rpc('admin_blocks')); },
  async adminVerifs(){ const v=this.check(await sb.rpc('admin_verifications')); const u=await this.mediaUrls(v.map(x=>x.selfie_path),'verifications');
    return v.map(x=>({...x,selfie:u[x.selfie_path]})); },
  async adminMembers(){ return this.check(await sb.from('profiles').select('*').order('created_at',{ascending:false})); },
  async adminDismiss(id){ this.check(await sb.rpc('admin_dismiss_report',{rid:id})); },
  async adminUnblock(a,b){ this.check(await sb.rpc('admin_unblock',{a,b})); },
  async adminBan(uid,val){ this.check(await sb.rpc('admin_set_banned',{uid,val})); },
  async adminVerify(uid,ok){ this.check(await sb.rpc('admin_verify',{uid,ok})); },
  async pushSave(sub){ const j=sub.toJSON(); this.check(await sb.from('push_subs').upsert({endpoint:j.endpoint,user_id:me,p256dh:j.keys.p256dh,auth:j.keys.auth})); },
  subscribeLive(onMsg,onLike){
    try{ sb.channel('live-'+me)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`recipient=eq.${me}`},p=>onMsg(p.new))
      .on('postgres_changes',{event:'*',schema:'public',table:'likes',filter:`likee=eq.${me}`},p=>onLike(p.new))
      .subscribe(); }catch(e){}
  }
});
