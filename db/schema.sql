-- Timeline Track schema (Postgres 15+, tested on Neon Postgres 17). Run once on an empty database.
-- Every row is owned by a user, so sign-ups can be opened later without migrating data.

create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  timezone text not null default 'UTC',
  day_cutoff_hour smallint not null default 4 check (day_cutoff_hour between 0 and 12),
  -- Demo sandboxes: created from the login page, deleted once expires_at passes.
  is_demo boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index users_demo_expiry_idx on users (expires_at) where is_demo;

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  position smallint not null default 0,
  unique (user_id, name)
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','paused','shipped')),
  created_at timestamptz not null default now()
);
create unique index projects_user_name_uq on projects (user_id, lower(name));

create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  done_on date,
  created_at timestamptz not null default now()
);

create table roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  summary text,
  start_date date,
  source_doc text,
  created_at timestamptz not null default now()
);

create table roadmap_phases (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  title text not null,
  position smallint not null default 0
);

create table roadmap_steps (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references roadmap_phases(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'not_started' check (status in ('not_started','in_progress','done')),
  target_date date,
  planned_minutes integer,
  source_ref text,
  position smallint not null default 0
);

create table roadmap_checklist_items (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references roadmap_steps(id) on delete cascade,
  title text not null,
  done_on date,
  position smallint not null default 0
);
create index roadmap_phases_roadmap_idx on roadmap_phases (roadmap_id, position);
create index roadmap_steps_phase_idx on roadmap_steps (phase_id, position);
create index roadmap_checklist_step_idx on roadmap_checklist_items (step_id, position);

-- One row per submitted log (raw text kept for reference).
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  entry_date date not null,
  weekday smallint generated always as (extract(isodow from entry_date)::smallint) stored, -- 1 = Mon … 7 = Sun
  raw_text text not null,
  created_at timestamptz not null default now()
);
create index entries_user_date_idx on entries (user_id, entry_date);

-- The split items. todo/event rows stay open until closed_on is set.
create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  entry_date date not null,
  weekday smallint generated always as (extract(isodow from entry_date)::smallint) stored,
  kind text not null check (kind in ('done','todo','event')),
  title text not null,
  category_id uuid references categories(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  roadmap_step_id uuid references roadmap_steps(id) on delete set null,
  checklist_item_id uuid references roadmap_checklist_items(id) on delete set null,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  due_date date,
  closed_on date,
  closed_by_item_id uuid references items(id) on delete set null,
  created_at timestamptz not null default now()
);
create index items_user_date_idx on items (user_id, entry_date);
create index items_open_idx on items (user_id) where kind in ('todo','event') and closed_on is null;
create index items_project_idx on items (project_id);
create index items_step_idx on items (roadmap_step_id) where roadmap_step_id is not null;

create table item_tags (
  item_id uuid not null references items(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (item_id, tag_id)
);

-- One row per "Try the demo" click, to rate-limit demos per visitor. The IP is
-- stored only as a salted hash, and rows older than a day are pruned.
create table demo_starts (
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index demo_starts_ip_idx on demo_starts (ip_hash, created_at);
