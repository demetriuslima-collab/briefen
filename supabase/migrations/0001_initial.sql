-- Workspaces (multi-tenant desde o início)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Canais cadastrados
create table channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  youtube_id text not null,
  handle text,
  name text not null,
  description text,
  subscribers bigint,
  total_videos integer,
  thumbnail_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, youtube_id)
);

create index idx_channels_workspace on channels(workspace_id);

-- Vídeos
create table videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  youtube_id text not null unique,
  title text not null,
  description text,
  duration_seconds integer,
  published_at timestamptz not null,
  views bigint default 0,
  likes bigint default 0,
  comments bigint default 0,
  thumbnail_url text,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_videos_channel on videos(channel_id);
create index idx_videos_published on videos(published_at desc);
create index idx_videos_views on videos(views desc);

-- Histórico de métricas (snapshot a cada sync)
create table video_metrics_history (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  views bigint not null,
  likes bigint not null,
  comments bigint not null,
  captured_at timestamptz not null default now()
);

create index idx_metrics_video_time on video_metrics_history(video_id, captured_at desc);

-- Transcrições
create table transcripts (
  video_id uuid primary key references videos(id) on delete cascade,
  content text not null,
  language text not null,
  source text not null check (source in ('youtube_auto', 'whisper_groq')),
  word_count integer,
  created_at timestamptz not null default now()
);

-- Resumos gerados por IA
create table summaries (
  video_id uuid primary key references videos(id) on delete cascade,
  summary text not null,
  topics jsonb default '[]'::jsonb,
  hooks jsonb default '[]'::jsonb,
  model_used text not null,
  created_at timestamptz not null default now()
);

-- ICPs (perfis de cliente ideal)
create table icps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text not null,
  pain_points jsonb default '[]'::jsonb,
  goals jsonb default '[]'::jsonb,
  language_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_icps_workspace on icps(workspace_id);

-- Briefens (análises estratégicas, snapshots imutáveis)
create table briefens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  icp_id uuid not null references icps(id) on delete restrict,
  title text,
  selected_channel_ids uuid[] not null,
  result text,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  model_used text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_briefens_workspace on briefens(workspace_id, created_at desc);

-- Snapshot dos vídeos considerados em cada briefen
create table briefen_videos (
  briefen_id uuid not null references briefens(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  rank integer not null,
  views_at_briefen bigint,
  primary key (briefen_id, video_id)
);

-- Fila de jobs
create table jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  type text not null check (type in ('sync_channel', 'transcribe_video', 'summarize_video', 'run_briefen')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  payload jsonb not null,
  result jsonb,
  error_message text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_jobs_status_scheduled on jobs(status, scheduled_at) where status in ('pending', 'running');
create index idx_jobs_workspace on jobs(workspace_id, created_at desc);

-- Row Level Security
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table channels enable row level security;
alter table videos enable row level security;
alter table icps enable row level security;
alter table briefens enable row level security;
alter table briefen_videos enable row level security;
alter table jobs enable row level security;

-- Helper function: workspace IDs do usuário atual
create or replace function user_workspace_ids() returns setof uuid
language sql stable security definer as $$
  select workspace_id from workspace_members where user_id = auth.uid()
$$;

-- Policies
create policy "members can read their workspaces" on workspaces
  for select using (id in (select user_workspace_ids()));

create policy "members can manage channels in their workspaces" on channels
  for all using (workspace_id in (select user_workspace_ids()));

create policy "members can manage icps in their workspaces" on icps
  for all using (workspace_id in (select user_workspace_ids()));

create policy "members can manage briefens in their workspaces" on briefens
  for all using (workspace_id in (select user_workspace_ids()));

create policy "members can read videos in their workspaces" on videos
  for select using (channel_id in (
    select id from channels where workspace_id in (select user_workspace_ids())
  ));

create policy "members can read transcripts in their workspaces" on transcripts
  for select using (video_id in (
    select v.id from videos v
    join channels c on c.id = v.channel_id
    where c.workspace_id in (select user_workspace_ids())
  ));

create policy "members can read summaries in their workspaces" on summaries
  for select using (video_id in (
    select v.id from videos v
    join channels c on c.id = v.channel_id
    where c.workspace_id in (select user_workspace_ids())
  ));

create policy "members can read jobs in their workspaces" on jobs
  for select using (workspace_id in (select user_workspace_ids()));

create policy "members can read briefen_videos in their workspaces" on briefen_videos
  for select using (briefen_id in (
    select id from briefens where workspace_id in (select user_workspace_ids())
  ));

-- Trigger para updated_at
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger videos_updated_at before update on videos
  for each row execute function set_updated_at();

create trigger icps_updated_at before update on icps
  for each row execute function set_updated_at();

-- Trigger: ao criar usuário, criar workspace e adicionar como owner
create or replace function on_auth_user_created() returns trigger
language plpgsql security definer as $$
declare
  new_workspace_id uuid;
begin
  insert into workspaces (name)
  values (coalesce(new.raw_user_meta_data->>'workspace_name', 'Meu workspace'))
  returning id into new_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function on_auth_user_created();
