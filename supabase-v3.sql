-- Velours v3 : supprimer son compte, « Vu », mode discret
-- À coller une seule fois dans Supabase → SQL Editor → Run (après supabase-v2.sql).

-- ===== « Vu » =====
alter table public.messages add column if not exists read_at timestamptz;
create or replace function public.mark_read(other uuid) returns void
language sql security definer set search_path = public as $$
  update messages set read_at = now() where sender = other and recipient = auth.uid() and read_at is null;
$$;

-- ===== Mode discret : visible seulement par celles que tu as likées =====
alter table public.profiles add column if not exists discreet boolean not null default false;
create or replace function public.liked_me(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from likes where liker = pid and likee = auth.uid() and kind <> 'pass');
$$;
drop policy if exists "p_select" on public.profiles;
create policy "p_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or (not banned and (not discreet or public.liked_me(id))));

-- ===== Supprimer son compte (tout part avec : profil, likes, messages…) =====
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Non connectée'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Pouvoir retrouver et effacer ses propres photos
drop policy if exists "own_files_select" on storage.objects;
create policy "own_files_select" on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'verifications') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own_files_delete" on storage.objects;
create policy "own_files_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'verifications', 'chat') and (storage.foldername(name))[1] = auth.uid()::text);

-- « en train d'écrire… » passe par le direct de Supabase, rien à créer ici.
notify pgrst, 'reload schema';
