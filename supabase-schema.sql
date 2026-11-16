-- Velours : base de données (à coller une seule fois dans Supabase → SQL Editor → Run)

-- Profils
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  birthdate date not null check (birthdate <= (current_date - interval '18 years')),
  identity text,
  looking text,
  bio text check (char_length(bio) <= 300),
  city text check (char_length(city) <= 60),
  prompt_q text,
  prompt_a text check (char_length(prompt_a) <= 150),
  interests text[] not null default '{}',
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- J'aime / passer / coup de cœur
create table if not exists public.likes (
  liker uuid not null default auth.uid() references public.profiles on delete cascade,
  likee uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('like','pass','star')),
  created_at timestamptz not null default now(),
  primary key (liker, likee)
);

-- Blocages et signalements
create table if not exists public.blocks (
  blocker uuid not null default auth.uid() references public.profiles on delete cascade,
  blocked uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references public.profiles on delete cascade,
  reported uuid not null references public.profiles on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Messages
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null default auth.uid() references public.profiles on delete cascade,
  recipient uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_pair on public.messages (sender, recipient, created_at);

-- Match = les deux se sont aimées, et personne n'a bloqué l'autre
create or replace function public.is_match(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from likes where liker = a and likee = b and kind <> 'pass')
     and exists (select 1 from likes where liker = b and likee = a and kind <> 'pass')
     and not exists (select 1 from blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- Sécurité (chaque personne ne touche qu'à ses propres données)
alter table public.profiles enable row level security;
alter table public.likes    enable row level security;
alter table public.blocks   enable row level security;
alter table public.reports  enable row level security;
alter table public.messages enable row level security;

create policy "profils visibles par les membres" on public.profiles for select to authenticated using (true);
create policy "créer son profil"   on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "modifier son profil" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "supprimer son profil" on public.profiles for delete to authenticated using (id = auth.uid());

create policy "voir ses likes" on public.likes for select to authenticated using (liker = auth.uid() or likee = auth.uid());
create policy "liker"          on public.likes for insert to authenticated with check (liker = auth.uid() and likee <> auth.uid());
create policy "changer d'avis" on public.likes for update to authenticated using (liker = auth.uid());

create policy "voir ses blocages" on public.blocks for select to authenticated using (blocker = auth.uid() or blocked = auth.uid());
create policy "bloquer"           on public.blocks for insert to authenticated with check (blocker = auth.uid());

create policy "signaler" on public.reports for insert to authenticated with check (reporter = auth.uid());

create policy "lire ses messages" on public.messages for select to authenticated
  using (sender = auth.uid() or recipient = auth.uid());
create policy "écrire à un match" on public.messages for insert to authenticated
  with check (sender = auth.uid() and public.is_match(auth.uid(), recipient));

-- Photos
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
create policy "ajouter ses photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "supprimer ses photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Rafraîchir l'API
notify pgrst, 'reload schema';
