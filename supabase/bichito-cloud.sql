-- Ejecutar una sola vez en Supabase: SQL Editor → New query → Run.
create extension if not exists pgcrypto;

create table if not exists public.bichito_families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_emails text[] not null check (cardinality(member_emails) between 1 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bichito_family_data (
  family_id uuid primary key references public.bichito_families(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.bichito_families enable row level security;
alter table public.bichito_family_data enable row level security;

create or replace function public.bichito_is_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bichito_families family
    where family.id = target_family_id
      and (
        family.owner_id = auth.uid()
        or lower(coalesce(auth.jwt() ->> 'email', '')) = any(family.member_emails)
      )
  );
$$;

revoke all on public.bichito_families, public.bichito_family_data from anon;
grant select, insert, update, delete on public.bichito_families to authenticated;
grant select, insert, update, delete on public.bichito_family_data to authenticated;
grant execute on function public.bichito_is_member(uuid) to authenticated;

create policy "Family members can view their family"
on public.bichito_families for select to authenticated
using (public.bichito_is_member(id));

create policy "A signed-in parent can create a family"
on public.bichito_families for insert to authenticated
with check (
  owner_id = auth.uid()
  and lower(coalesce(auth.jwt() ->> 'email', '')) = any(member_emails)
);

create policy "Only the family owner can change members"
on public.bichito_families for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Only the family owner can delete a family"
on public.bichito_families for delete to authenticated
using (owner_id = auth.uid());

create policy "Family members can read shared data"
on public.bichito_family_data for select to authenticated
using (public.bichito_is_member(family_id));

create policy "Family members can create shared data"
on public.bichito_family_data for insert to authenticated
with check (public.bichito_is_member(family_id));

create policy "Family members can update shared data"
on public.bichito_family_data for update to authenticated
using (public.bichito_is_member(family_id))
with check (public.bichito_is_member(family_id));

create policy "Only the family owner can delete shared data"
on public.bichito_family_data for delete to authenticated
using (
  exists (
    select 1 from public.bichito_families family
    where family.id = bichito_family_data.family_id
      and family.owner_id = auth.uid()
  )
);
