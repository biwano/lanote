-- Step 1: learners + PRONOTE proxy sessions

create extension if not exists "pgcrypto";

create table if not exists learners (
  id uuid primary key default gen_random_uuid(),
  pronote_account_hash text not null unique,
  display_name text not null,
  client_id text,
  created_at timestamptz not null default now()
);

create table if not exists pronote_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  session_data jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pronote_sessions_learner_id_idx on pronote_sessions (learner_id);
create index if not exists pronote_sessions_expires_at_idx on pronote_sessions (expires_at);

create or replace function set_pronote_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists pronote_sessions_updated_at on pronote_sessions;
create trigger pronote_sessions_updated_at
  before update on pronote_sessions
  for each row execute function set_pronote_sessions_updated_at();
