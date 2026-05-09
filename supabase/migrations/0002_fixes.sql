-- Política ausente: usuários lendo seus próprios vínculos de workspace.
-- Necessária para o JobStatusIndicator e qualquer query direta a workspace_members.
create policy "users can read their own workspace memberships" on workspace_members
  for select using (user_id = auth.uid());

-- workspace_members também precisa de insert/delete para o trigger on_auth_user_created
-- funcionar corretamente via service role (security definer já cobre isso,
-- mas explicitamos para o dashboard ficar correto):
create policy "owners can manage their workspace memberships" on workspace_members
  for all using (user_id = auth.uid());

-- RLS estava habilitado em transcripts e summaries mas sem políticas ativas.
-- Habilitamos agora para que as policies do 0001 tenham efeito.
alter table transcripts enable row level security;
alter table summaries enable row level security;
alter table video_metrics_history enable row level security;

-- Política para video_metrics_history (ausente no 0001)
create policy "members can read metrics in their workspaces" on video_metrics_history
  for select using (video_id in (
    select v.id from videos v
    join channels c on c.id = v.channel_id
    where c.workspace_id in (select user_workspace_ids())
  ));

-- Ativar Realtime para as tabelas que o frontend assina.
-- Se o projeto Supabase já tiver a publicação padrão, este comando basta.
-- Caso contrário, ative manualmente em: Supabase → Database → Replication.
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table briefens;
