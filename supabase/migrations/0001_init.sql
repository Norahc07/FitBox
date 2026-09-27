-- FitBox — Brain Teaser: initial schema
-- Tables: profiles, levels, player_progress, game_sessions
-- Row Level Security is enabled on every table.

-------------------------------------------------------------------------------
-- Profiles
-------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 40),
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SECURITY DEFINER so policies can call it without recursive RLS evaluation.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Create a profile automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 40))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Players cannot promote themselves. Requests without a JWT (SQL editor /
-- service role) are allowed so the first admin can be created manually.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own or admin" on public.profiles;
create policy "profiles: update own or admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-------------------------------------------------------------------------------
-- Levels
-------------------------------------------------------------------------------
create table if not exists public.levels (
  id text primary key,
  number integer not null check (number > 0),
  version integer not null default 1 check (version > 0),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'hard')),
  width integer not null check (width between 3 and 10),
  height integer not null check (height between 3 and 10),
  total_pieces integer not null check (total_pieces between 2 and 60),
  required_pieces integer not null check (required_pieces > 0),
  time_limit integer check (time_limit is null or time_limit > 0),
  hints integer not null default 3 check (hints between 0 and 10),
  seed bigint,
  pieces jsonb not null,
  solution jsonb not null,
  published boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (number, version),
  check (total_pieces > required_pieces)
);

create index if not exists levels_published_idx on public.levels (published, number);

/*
  Server-side guard: a level can only be saved as published when its stored
  solution exactly tiles the board. The client validator performs the full
  geometric check (rotation, connectivity); this trigger re-checks the parts
  that matter for integrity so a malformed publish is impossible even if the
  client is bypassed.
*/
create or replace function public.enforce_level_validity()
returns trigger
language plpgsql
as $$
declare
  area integer := new.width * new.height;
  piece_count integer;
  solution_count integer;
  missing_refs integer;
  duplicate_refs integer;
  size_mismatch integer;
  cell_count integer;
  distinct_cells integer;
  out_of_bounds integer;
begin
  if not new.published then
    return new;
  end if;

  if jsonb_typeof(new.pieces) <> 'array' or jsonb_typeof(new.solution) <> 'array' then
    raise exception 'pieces and solution must be JSON arrays';
  end if;

  piece_count := jsonb_array_length(new.pieces);
  solution_count := jsonb_array_length(new.solution);

  if piece_count <> new.total_pieces then
    raise exception 'Level %: % pieces stored but total_pieces is %', new.number, piece_count, new.total_pieces;
  end if;
  if solution_count <> new.required_pieces then
    raise exception 'Level %: solution uses % pieces but required_pieces is %', new.number, solution_count, new.required_pieces;
  end if;
  if piece_count <= solution_count then
    raise exception 'Level %: puzzle must contain decoy pieces', new.number;
  end if;

  select count(*) into missing_refs
  from jsonb_array_elements(new.solution) s
  where not exists (select 1 from jsonb_array_elements(new.pieces) p where p ->> 'id' = s ->> 'pieceId');
  if missing_refs > 0 then
    raise exception 'Level %: solution references unknown pieces', new.number;
  end if;

  select count(*) - count(distinct s ->> 'pieceId') into duplicate_refs from jsonb_array_elements(new.solution) s;
  if duplicate_refs > 0 then
    raise exception 'Level %: a piece is used twice in the solution', new.number;
  end if;

  select count(*) into size_mismatch
  from jsonb_array_elements(new.solution) s
  join jsonb_array_elements(new.pieces) p on p ->> 'id' = s ->> 'pieceId'
  where jsonb_array_length(s -> 'cells') <> jsonb_array_length(p -> 'cells');
  if size_mismatch > 0 then
    raise exception 'Level %: solution cells do not match piece sizes', new.number;
  end if;

  with cells as (
    select (c ->> 0)::int as x, (c ->> 1)::int as y
    from jsonb_array_elements(new.solution) s, jsonb_array_elements(s -> 'cells') c
  )
  select count(*), count(distinct (x, y)),
         count(*) filter (where x < 0 or y < 0 or x >= new.width or y >= new.height)
    into cell_count, distinct_cells, out_of_bounds
  from cells;

  if cell_count <> area or distinct_cells <> area or out_of_bounds > 0 then
    raise exception 'Level %: solution does not exactly cover the %x% board', new.number, new.width, new.height;
  end if;

  return new;
end;
$$;

drop trigger if exists levels_validate on public.levels;
create trigger levels_validate
  before insert or update on public.levels
  for each row execute function public.enforce_level_validity();

drop trigger if exists levels_touch on public.levels;
create trigger levels_touch
  before update on public.levels
  for each row execute function public.touch_updated_at();

alter table public.levels enable row level security;

drop policy if exists "levels: read published or admin" on public.levels;
create policy "levels: read published or admin" on public.levels
  for select using (published or public.is_admin());

drop policy if exists "levels: admin insert" on public.levels;
create policy "levels: admin insert" on public.levels
  for insert with check (public.is_admin());

drop policy if exists "levels: admin update" on public.levels;
create policy "levels: admin update" on public.levels
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "levels: admin delete" on public.levels;
create policy "levels: admin delete" on public.levels
  for delete using (public.is_admin());

-------------------------------------------------------------------------------
-- Player progress (one row per user per level number)
-------------------------------------------------------------------------------
create table if not exists public.player_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_number integer not null check (level_number > 0),
  completed boolean not null default false,
  best_score integer check (best_score is null or best_score >= 0),
  best_time_ms integer check (best_time_ms is null or best_time_ms >= 0),
  stars smallint not null default 0 check (stars between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, level_number)
);

alter table public.player_progress enable row level security;

drop policy if exists "progress: read own or admin" on public.player_progress;
create policy "progress: read own or admin" on public.player_progress
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "progress: insert own" on public.player_progress;
create policy "progress: insert own" on public.player_progress
  for insert with check (user_id = auth.uid());

drop policy if exists "progress: update own" on public.player_progress;
create policy "progress: update own" on public.player_progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Conflict resolution happens in the database: progress can only improve.
create or replace function public.merge_progress(
  p_level_number integer,
  p_completed boolean,
  p_best_score integer,
  p_best_time_ms integer,
  p_stars integer
)
returns public.player_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.player_progress;
begin
  insert into public.player_progress (user_id, level_number, completed, best_score, best_time_ms, stars, updated_at)
  values (auth.uid(), p_level_number, coalesce(p_completed, false), p_best_score, p_best_time_ms,
          least(greatest(coalesce(p_stars, 0), 0), 3), now())
  on conflict (user_id, level_number) do update set
    completed = player_progress.completed or excluded.completed,
    best_score = greatest(player_progress.best_score, excluded.best_score),
    best_time_ms = case
      when player_progress.best_time_ms is null then excluded.best_time_ms
      when excluded.best_time_ms is null then player_progress.best_time_ms
      else least(player_progress.best_time_ms, excluded.best_time_ms)
    end,
    stars = greatest(player_progress.stars, excluded.stars),
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

-------------------------------------------------------------------------------
-- Game sessions (append-only for players)
-------------------------------------------------------------------------------
create table if not exists public.game_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  level_id text,
  level_number integer not null check (level_number > 0),
  level_version integer not null default 1,
  difficulty text check (difficulty in ('beginner', 'intermediate', 'hard')),
  score integer not null check (score between 0 and 100000),
  time_ms integer not null check (time_ms >= 0),
  hints_used integer not null default 0 check (hints_used >= 0),
  mistakes integer not null default 0 check (mistakes >= 0),
  pieces_used integer not null check (pieces_used > 0),
  stars smallint not null check (stars between 1 and 3),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists game_sessions_user_idx on public.game_sessions (user_id);
create index if not exists game_sessions_level_idx on public.game_sessions (level_number);
create index if not exists game_sessions_completed_idx on public.game_sessions (completed_at desc);

alter table public.game_sessions enable row level security;

drop policy if exists "sessions: read own or admin" on public.game_sessions;
create policy "sessions: read own or admin" on public.game_sessions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "sessions: insert own" on public.game_sessions;
create policy "sessions: insert own" on public.game_sessions
  for insert with check (user_id = auth.uid());

-------------------------------------------------------------------------------
-- Leaderboard (exposes only display name + best result, never emails)
-------------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_level_number integer, p_limit integer default 20)
returns table (rank bigint, display_name text, best_score integer, best_time_ms integer, stars smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select rank() over (order by pp.best_score desc, pp.best_time_ms asc nulls last) as rank,
         coalesce(pr.display_name, 'Player') as display_name,
         pp.best_score,
         pp.best_time_ms,
         pp.stars,
         pp.user_id = auth.uid() as is_me
  from public.player_progress pp
  left join public.profiles pr on pr.id = pp.user_id
  where pp.level_number = p_level_number and pp.completed and pp.best_score is not null
  order by 1
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-------------------------------------------------------------------------------
-- Admin statistics
-------------------------------------------------------------------------------
create or replace function public.admin_overview()
returns table (
  total_users bigint,
  admins bigint,
  total_sessions bigint,
  sessions_7d bigint,
  active_players_7d bigint,
  published_levels bigint,
  draft_levels bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where role = 'admin'),
    (select count(*) from public.game_sessions),
    (select count(*) from public.game_sessions where completed_at > now() - interval '7 days'),
    (select count(distinct user_id) from public.game_sessions where completed_at > now() - interval '7 days'),
    (select count(*) from public.levels where published),
    (select count(*) from public.levels where not published);
end;
$$;

create or replace function public.admin_level_stats()
returns table (
  level_number integer,
  sessions bigint,
  players bigint,
  avg_score numeric,
  avg_time_ms numeric,
  best_time_ms integer,
  avg_hints numeric,
  avg_mistakes numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return query
  select gs.level_number,
         count(*),
         count(distinct gs.user_id),
         round(avg(gs.score), 0),
         round(avg(gs.time_ms), 0),
         min(gs.time_ms),
         round(avg(gs.hints_used), 2),
         round(avg(gs.mistakes), 2)
  from public.game_sessions gs
  group by gs.level_number
  order by gs.level_number;
end;
$$;

revoke execute on function public.admin_overview() from anon;
revoke execute on function public.admin_level_stats() from anon;
revoke execute on function public.merge_progress(integer, boolean, integer, integer, integer) from anon;
grant execute on function public.get_leaderboard(integer, integer) to anon, authenticated;

-- To create the first admin, run in the SQL editor after signing up:
--   update public.profiles set role = 'admin' where id = '<your-user-uuid>';
