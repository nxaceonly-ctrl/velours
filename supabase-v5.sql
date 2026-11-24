-- Velours v5 : les 10 profils de démo likent en retour et répondent aux messages
-- À coller une seule fois dans Supabase → SQL Editor → Run.

-- 1) Quand tu likes une fille de démo, elle te like aussi (donc c'est un match)
create or replace function public.demo_like_back() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.likee::text like '5eed0000-%' and new.kind <> 'pass' then
    insert into likes (liker, likee, kind) values (new.likee, new.liker, 'like')
    on conflict (liker, likee) do update set kind = 'like';
  end if;
  return new;
end $$;
drop trigger if exists demo_like_back on public.likes;
create trigger demo_like_back after insert or update on public.likes for each row execute function public.demo_like_back();

-- Ceux que tu as déjà likés avant : match tout de suite
insert into public.likes (liker, likee, kind)
select likee, liker, 'like' from public.likes
where likee::text like '5eed0000-%' and kind <> 'pass' and liker::text not like '5eed0000-%'
on conflict (liker, likee) do update set kind = 'like';

-- 2) Quand tu écris à une fille de démo, elle te répond
create or replace function public.demo_reply() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n int; who text; txt text;
  pool text[] := array[
    'Haha tu me fais rire 😄 Raconte-moi un truc que personne ne sait sur toi',
    'Ok, tu marques des points là 😏',
    'J''avoue que j''attendais ton message 🙈',
    'Et toi, c''est quoi ton plan parfait pour un premier date ?',
    'Tu as un sourire qui donne envie de te rencontrer, tu sais ?',
    'Je suis curieuse… tu es plutôt soirée canapé ou soirée qui finit à 4h ? 🌙',
    'Arrête, je rougis 😳',
    'On devrait continuer cette conversation autour d''un verre, non ? 🍷',
    'Tu es toujours aussi charmante ou c''est juste avec moi ? 😏',
    'J''aime bien ta façon d''écrire, c''est doux ✨',
    'Dis-moi un jour et une heure, je te dirai si je suis libre 😌',
    'Mmh, intéressant… continue, j''écoute 👀',
    'Tu m''as fait sourire toute seule devant mon téléphone 😊',
    'J''adore ! On a plus de points communs que je pensais 💕'
  ];
begin
  if new.recipient::text like '5eed0000-%' and new.sender::text not like '5eed0000-%' then
    select count(*) into n from messages where sender = new.recipient and recipient = new.sender;
    select name into who from profiles where id = new.recipient;
    if n = 0 then
      txt := case who
        when 'Léa' then 'Coucou toi 😊 Tu viens d''illuminer ma soirée. Rooftop ou bar caché, tu choisis quoi ?'
        when 'Yasmine' then 'Hello 😄 Ton message tombe pile pendant mon café. Tu es team brunch aussi ?'
        when 'Chloé' then 'Heyyy 🎤 Question importante : c''est quoi ta chanson de karaoké ?'
        when 'Amara' then 'Bonsoir ✨ J''aime les gens qui osent écrire en premier. Tu aimes l''art ?'
        when 'Manon' then 'Coucou 📚 Tu tombes bien, je cherchais quelqu''un avec qui parler. Tu lis quoi en ce moment ?'
        when 'Sofia' then 'Ciao bella 🍝 Tu aimes les pâtes ? C''est très important pour la suite…'
        when 'Lina' then 'Hey 🌙 Enfin quelqu''un d''intéressant ici. Tu fais quoi de tes soirées ?'
        when 'Zoé' then 'Salut toi 🎶 Dis-moi ton groupe préféré et je te dis si on va s''entendre'
        when 'Anaïs' then 'Bonsoir 🍷 Quelle jolie surprise. Rouge, blanc ou rosé ?'
        when 'Maya' then 'Coucouuu 💃 Tu sais danser ? Sinon je t''apprends !'
        else 'Coucou toi 😊' end;
    elsif new.kind = 'photo' then txt := 'Oh j''adore cette photo 😍';
    elsif new.kind = 'audio' then txt := 'Ta voix est trop mignonne 🙈';
    else txt := pool[1 + (n - 1) % array_length(pool, 1)];
    end if;
    insert into messages (sender, recipient, body) values (new.recipient, new.sender, txt);
  end if;
  return new;
end $$;
drop trigger if exists demo_reply on public.messages;
create trigger demo_reply after insert on public.messages for each row execute function public.demo_reply();

notify pgrst, 'reload schema';
