-- Mirrors auth.users with the app-specific role. One row per Supabase
-- Auth user, created automatically by the trigger below on first sign-in.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'standard',
  created_at timestamptz not null default now()
);

-- Looks up the signed-in user's role. SECURITY DEFINER so it can read
-- public.users even from within a policy defined on public.users itself,
-- which would otherwise recurse under RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

-- Populates public.users when a new Supabase Auth user signs in for the
-- first time. The first user to ever sign in becomes admin so there is
-- always at least one; every subsequent user starts standard and is
-- promoted by an existing admin via the app.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  select not exists (select 1 from public.users) into is_first_user;

  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when is_first_user then 'admin' else 'standard' end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
