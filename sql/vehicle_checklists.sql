-- Vehicle checklists table and RLS policies

create table if not exists public.vehicle_checklists (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id),
  vehicle_id uuid not null references public.vehicles(id),
  shift_id uuid null references public.shifts(id),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  checks jsonb not null default '{}'::jsonb,
  submitted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_checklists_driver_created_idx
  on public.vehicle_checklists (driver_id, created_at desc);

create index if not exists vehicle_checklists_vehicle_created_idx
  on public.vehicle_checklists (vehicle_id, created_at desc);

create index if not exists vehicle_checklists_shift_idx
  on public.vehicle_checklists (shift_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists vehicle_checklists_set_updated_at on public.vehicle_checklists;
create trigger vehicle_checklists_set_updated_at
before update on public.vehicle_checklists
for each row execute function public.set_updated_at();

alter table public.vehicle_checklists enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_checklists'
      and policyname = 'vehicle_checklists_select_own'
  ) then
    create policy vehicle_checklists_select_own
      on public.vehicle_checklists
      for select
      using (driver_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_checklists'
      and policyname = 'vehicle_checklists_insert_own'
  ) then
    create policy vehicle_checklists_insert_own
      on public.vehicle_checklists
      for insert
      with check (driver_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_checklists'
      and policyname = 'vehicle_checklists_update_draft'
  ) then
    create policy vehicle_checklists_update_draft
      on public.vehicle_checklists
      for update
      using (driver_id = auth.uid() and status = 'draft')
      with check (driver_id = auth.uid() and status in ('draft', 'submitted'));
  end if;
end;
$$;
