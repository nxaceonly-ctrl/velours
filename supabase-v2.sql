-- Velours v2 : distance, vérification, modération, photos/vocaux, notifications
-- À coller une seule fois dans Supabase → SQL Editor → Run (après supabase-schema.sql).

-- ===== Statuts de profil =====
alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists banned boolean not null default false;

-- ===== Admins (modération) =====
create table if not exists public.admins (user_id uuid primary key references auth.users on delete cascade);
alter table public.admins enable row level security;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- Personne ne peut se mettre « vérifiée » ou se débannir toute seule
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then new.verified := false; new.banned := false;
    else new.verified := old.verified; new.banned := old.banned; end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before insert or update on public.profiles for each row execute function public.protect_profile();

-- Les profils bannis disparaissent pour les autres
drop policy if exists "p_select" on public.profiles;
create policy "p_select" on public.profiles for select to authenticated
  using (not banned or id = auth.uid() or public.is_admin());

-- Pas de match ni de message avec un profil banni
create or replace function public.is_match(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from likes where liker = a and likee = b and kind <> 'pass')
     and exists (select 1 from likes where liker = b and likee = a and kind <> 'pass')
     and not exists (select 1 from blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
     and not exists (select 1 from profiles where id in (a, b) and banned);
$$;

-- ===== Distance (la position exacte n'est jamais montrée aux autres) =====
create table if not exists public.locations (
  user_id uuid primary key default auth.uid() references public.profiles on delete cascade,
  lat double precision not null, lng double precision not null,
  updated_at timestamptz not null default now()
);
alter table public.locations enable row level security;
drop policy if exists "loc_own" on public.locations;
create policy "loc_own" on public.locations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function public.distances() returns table (id uuid, km int)
language sql stable security definer set search_path = public as $$
  select o.user_id, greatest(1, round(6371 * 2 * asin(sqrt(
           power(sin(radians(o.lat - m.lat) / 2), 2) +
           cos(radians(m.lat)) * cos(radians(o.lat)) * power(sin(radians(o.lng - m.lng) / 2), 2)))))::int
  from locations o, locations m
  where m.user_id = auth.uid() and o.user_id <> auth.uid();
$$;

-- ===== Vérification par selfie =====
create table if not exists public.verifications (
  user_id uuid primary key default auth.uid() references public.profiles on delete cascade,
  selfie_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','refused')),
  created_at timestamptz not null default now()
);
alter table public.verifications enable row level security;
drop policy if exists "v_own" on public.verifications;
create policy "v_own" on public.verifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function public.protect_verif() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then new.status := 'pending'; new.created_at := now(); end if;
  return new;
end $$;
drop trigger if exists protect_verif on public.verifications;
create trigger protect_verif before insert or update on public.verifications for each row execute function public.protect_verif();

insert into storage.buckets (id, name, public) values ('verifications', 'verifications', false) on conflict (id) do nothing;
drop policy if exists "vf_insert" on storage.objects;
create policy "vf_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "vf_select" on storage.objects;
create policy "vf_select" on storage.objects for select to authenticated
  using (bucket_id = 'verifications' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ===== Photos et vocaux dans le chat (privés : seulement les 2 personnes) =====
alter table public.messages add column if not exists kind text not null default 'text';
alter table public.messages add column if not exists media_path text;
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages drop constraint if exists messages_body_len;
alter table public.messages add constraint messages_body_len check (
  char_length(body) <= 1000 and kind in ('text','photo','audio') and (kind <> 'text' or char_length(body) >= 1));

insert into storage.buckets (id, name, public) values ('chat', 'chat', false) on conflict (id) do nothing;
drop policy if exists "chat_insert" on storage.objects;
create policy "chat_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_match(auth.uid(), ((storage.foldername(name))[2])::uuid));
drop policy if exists "chat_select" on storage.objects;
create policy "chat_select" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2]));

-- ===== Modération (réservée aux admins) =====
create or replace function public.admin_reports()
returns table (id bigint, reason text, created_at timestamptz, reporter uuid, reporter_name text, reported uuid, reported_name text, reported_banned boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à la modération'; end if;
  return query select r.id, r.reason, r.created_at, r.reporter, a.name, r.reported, b.name, b.banned
    from reports r join profiles a on a.id = r.reporter join profiles b on b.id = r.reported order by r.created_at desc;
end $$;
create or replace function public.admin_blocks()
returns table (blocker uuid, blocker_name text, blocked uuid, blocked_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à la modération'; end if;
  return query select k.blocker, a.name, k.blocked, b.name, k.created_at
    from blocks k join profiles a on a.id = k.blocker join profiles b on b.id = k.blocked order by k.created_at desc;
end $$;
create or replace function public.admin_verifications()
returns table (user_id uuid, name text, photo text, selfie_path text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à la modération'; end if;
  return query select v.user_id, p.name, p.photos[1], v.selfie_path, v.created_at
    from verifications v join profiles p on p.id = v.user_id where v.status = 'pending' order by v.created_at;
end $$;
create or replace function public.admin_dismiss_report(rid bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à la modération'; end if;
  delete from reports where id = rid;
end $$;
create or replace function public.admin_unblock(a uuid, b uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à la modération'; end if;
  delete from blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a);
end $$;
create or replace function public.admin_set_banned(uid uuid, val boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à la modération'; end if;
  update profiles set banned = val where id = uid;
end $$;
create or replace function public.admin_verify(uid uuid, ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à la modération'; end if;
  update verifications set status = case when ok then 'approved' else 'refused' end where user_id = uid;
  update profiles set verified = ok where id = uid;
end $$;

-- ===== Notifications =====
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  p256dh text not null, auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "push_own" on public.push_subs;
create policy "push_own" on public.push_subs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create extension if not exists pg_net with schema extensions;
create or replace function public.send_push(target uuid, title text, msg text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://hmscauwtqvzjfdzzmsdf.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-velours-secret', '__PUSH_SECRET__'),
    body := jsonb_build_object('to', target, 'title', title, 'body', msg));
exception when others then null;  -- une notif ratée ne bloque jamais l'app
end $$;
revoke execute on function public.send_push(uuid, text, text) from public, anon, authenticated;

create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select name into who from profiles where id = new.sender;
  perform send_push(new.recipient, coalesce(who, 'Velours'),
    case new.kind when 'photo' then '📷 t''a envoyé une photo' when 'audio' then '🎤 t''a envoyé un message vocal' else left(new.body, 120) end);
  return new;
end $$;
drop trigger if exists on_message on public.messages;
create trigger on_message after insert on public.messages for each row execute function public.on_message();

create or replace function public.on_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.kind <> 'pass' and exists (select 1 from likes where liker = new.likee and likee = new.liker and kind <> 'pass') then
    select name into who from profiles where id = new.liker;
    perform send_push(new.likee, 'C''est un match ✨', coalesce(who, 'Quelqu''un') || ' t''a aimée aussi. Écris-lui !');
  end if;
  return new;
end $$;
drop trigger if exists on_like on public.likes;
create trigger on_like after insert or update on public.likes for each row execute function public.on_like();

-- Messages et matchs en direct dans l'app
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.likes; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';

-- ===== Toi = admin (remplace TON-EMAIL par l'e-mail de ton compte Velours) =====
insert into public.admins (user_id) select id from auth.users where email = 'TON-EMAIL' on conflict do nothing;
