-- Velours v6 : l'admin peut changer les photos des 10 profils de démo depuis l'appli
-- À coller une seule fois dans Supabase → SQL Editor → Run.
create or replace function public.admin_set_demo_photos(uid uuid, urls text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux admins'; end if;
  if uid::text not like '5eed0000-%' then raise exception 'Seulement pour les profils de démo'; end if;
  if coalesce(array_length(urls, 1), 0) not between 1 and 3 then raise exception 'Entre 1 et 3 photos'; end if;
  update profiles set photos = urls where id = uid;
end $$;
revoke execute on function public.admin_set_demo_photos(uuid, text[]) from public, anon;
grant execute on function public.admin_set_demo_photos(uuid, text[]) to authenticated;
notify pgrst, 'reload schema';
