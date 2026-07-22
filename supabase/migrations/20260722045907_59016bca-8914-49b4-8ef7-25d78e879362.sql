-- Roles enum
create type public.app_role as enum ('admin', 'juri', 'viewer');

-- user_roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- Security definer to check roles (avoids recursive RLS)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Users can read their own roles; admins can read all
create policy "read own roles" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

create policy "admins read all roles" on public.user_roles
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "admins manage roles" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Profiles: link auth user to a juri row (optional) and hold display info
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  juri_id uuid references public.juri(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "admins read all profiles" on public.profiles
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admins manage profiles" on public.profiles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on new user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nama)
  values (new.id, coalesce(new.raw_user_meta_data->>'nama', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();