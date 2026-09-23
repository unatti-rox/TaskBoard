-- TaskBoard schema for Supabase.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Then add yourself as the first manager (see the bottom of this file).

-- ---------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------

create table if not exists public.members (
  id           text primary key,
  name         text not null,
  role         text not null default '',          -- job title, e.g. "Video Editor"
  short_role   text not null default '',
  capacity     numeric not null default 40 check (capacity > 0),
  other_hours  numeric not null default 0 check (other_hours >= 0),
  email        text unique,                       -- the address they sign in with
  access       text not null default 'member' check (access in ('manager', 'member')),
  created_at   timestamptz not null default now()
);

create table if not exists public.brands (
  name text primary key
);

create table if not exists public.projects (
  id        text primary key,
  name      text not null,
  brand     text not null references public.brands (name) on update cascade,
  due       date not null,
  archived  boolean not null default false
);

create table if not exists public.tasks (
  id            text primary key,
  name          text not null,
  project_id    text references public.projects (id) on delete set null,
  brand         text not null references public.brands (name) on update cascade,
  assignee      text references public.members (id) on delete set null,
  estimate      numeric not null check (estimate > 0),
  due           date not null,
  priority      text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status        text not null default 'todo' check (status in ('todo', 'progress', 'completed', 'blocked')),
  completed_on  date,
  note          text not null default '',
  brief         jsonb,                            -- structured brief: deliverables, copy status, references, what to avoid
  created_on    date not null default current_date
);

create table if not exists public.time_logs (
  id         text primary key,
  task_id    text not null references public.tasks (id) on delete cascade,
  member_id  text references public.members (id) on delete set null,
  hours      numeric not null check (hours > 0 and hours <= 24),
  date       date not null,
  note       text not null default ''
);

create table if not exists public.activity (
  id        text primary key,
  at        timestamptz not null default now(),
  text      text not null,
  actor_id  text
);

create table if not exists public.workspace (
  id         int primary key default 1 check (id = 1),
  team_name  text not null default 'Creative Operations'
);
insert into public.workspace (id) values (1) on conflict do nothing;

-- Running this file again on a database created before "brief" existed: add the column.
alter table public.tasks add column if not exists brief jsonb;

create index if not exists tasks_assignee_idx on public.tasks (assignee);
create index if not exists time_logs_date_idx on public.time_logs (date);
create index if not exists time_logs_task_idx on public.time_logs (task_id);
create index if not exists activity_at_idx on public.activity (at desc);

-- ---------------------------------------------------------------
-- WHO IS SIGNED IN
-- A signed-in person counts as a team member when their email is on the members table.
-- ---------------------------------------------------------------

create or replace function public.my_member_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.members where lower(email) = lower(auth.jwt() ->> 'email') limit 1
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_member_id() is not null
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where lower(email) = lower(auth.jwt() ->> 'email') and access = 'manager'
  )
$$;

-- Team members may only change the status and note of their own tasks.
create or replace function public.guard_task_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_manager() then
    return new;
  end if;
  if new.name is distinct from old.name
     or new.project_id is distinct from old.project_id
     or new.brand is distinct from old.brand
     or new.assignee is distinct from old.assignee
     or new.estimate is distinct from old.estimate
     or new.due is distinct from old.due
     or new.priority is distinct from old.priority
     or new.created_on is distinct from old.created_on then
    raise exception 'Only managers can change task details';
  end if;
  return new;
end
$$;

drop trigger if exists guard_task_update on public.tasks;
create trigger guard_task_update before update on public.tasks
  for each row execute function public.guard_task_update();

-- ---------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Everyone on the team can read everything. Managers can change everything.
-- Team members can update their own tasks and log time on them.
-- ---------------------------------------------------------------

alter table public.members   enable row level security;
alter table public.brands    enable row level security;
alter table public.projects  enable row level security;
alter table public.tasks     enable row level security;
alter table public.time_logs enable row level security;
alter table public.activity  enable row level security;
alter table public.workspace enable row level security;

do $$
declare t text;
begin
  foreach t in array array['members', 'brands', 'projects', 'tasks', 'time_logs', 'activity', 'workspace'] loop
    execute format('drop policy if exists "team can read" on public.%I', t);
    execute format('create policy "team can read" on public.%I for select to authenticated using (public.is_member())', t);
  end loop;

  foreach t in array array['members', 'brands', 'projects', 'workspace'] loop
    execute format('drop policy if exists "managers can write" on public.%I', t);
    execute format('create policy "managers can write" on public.%I for all to authenticated using (public.is_manager()) with check (public.is_manager())', t);
  end loop;
end
$$;

drop policy if exists "managers can add tasks" on public.tasks;
create policy "managers can add tasks" on public.tasks for insert to authenticated
  with check (public.is_manager());

drop policy if exists "managers can delete tasks" on public.tasks;
create policy "managers can delete tasks" on public.tasks for delete to authenticated
  using (public.is_manager());

drop policy if exists "managers and assignees can update tasks" on public.tasks;
create policy "managers and assignees can update tasks" on public.tasks for update to authenticated
  using (public.is_manager() or assignee = public.my_member_id())
  with check (public.is_manager() or assignee = public.my_member_id());

drop policy if exists "log time on own tasks" on public.time_logs;
create policy "log time on own tasks" on public.time_logs for insert to authenticated
  with check (
    public.is_manager()
    or (
      member_id = public.my_member_id()
      and exists (select 1 from public.tasks t where t.id = task_id and t.assignee = public.my_member_id())
    )
  );

drop policy if exists "delete own time logs" on public.time_logs;
create policy "delete own time logs" on public.time_logs for delete to authenticated
  using (public.is_manager() or member_id = public.my_member_id());

drop policy if exists "team can add activity" on public.activity;
create policy "team can add activity" on public.activity for insert to authenticated
  with check (public.is_member() and actor_id = public.my_member_id());

-- ---------------------------------------------------------------
-- LIVE UPDATES
-- ---------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['members', 'brands', 'projects', 'tasks', 'time_logs', 'activity', 'workspace'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------
-- FIRST MANAGER
-- Replace the name and email with yours, then run just these lines.
-- Everyone else can be added from Settings → Team members once you're signed in.
-- ---------------------------------------------------------------

-- insert into public.members (id, name, role, short_role, email, access)
-- values ('m_owner', 'Your Name', 'Creative Lead', 'Lead', 'you@example.com', 'manager');
