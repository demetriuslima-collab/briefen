-- Grants faltando para o role authenticated.
-- Tabelas criadas via SQL puro não recebem permissões automaticamente
-- no Supabase — PostgREST retorna array vazio silenciosamente sem elas.
grant select on transcripts to authenticated;
grant select on summaries to authenticated;
grant select on video_metrics_history to authenticated;
