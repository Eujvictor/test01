-- =====================================================================
-- NAVALHA DE OURO — CORES DOS BOTÕES E DOS DETALHES DO SITE
-- Rode no Supabase: SQL Editor → New query → colar → Run.
-- Idempotente: pode rodar mais de uma vez. Não apaga nem altera dados.
--
-- O painel já funciona sem este SQL: as demais configurações (inclusive
-- cor principal, secundária, fundo e fonte) continuam sendo salvas.
-- Só as cores de "Botões" e "Detalhes" dependem destas duas colunas.
--
-- Segurança: as políticas de RLS de configuracoes_site (sql/configuracoes_site.sql)
-- valem para a linha inteira, então as colunas novas já ficam protegidas:
-- leitura pública, escrita só do administrador.
-- =====================================================================

alter table public.configuracoes_site
    add column if not exists cor_botoes   text,
    add column if not exists cor_detalhes text;

-- Aceita só cor hexadecimal (#RGB ou #RRGGBB) ou vazio, igual ao painel.
alter table public.configuracoes_site
    drop constraint if exists configuracoes_site_cor_botoes_hex,
    drop constraint if exists configuracoes_site_cor_detalhes_hex;

alter table public.configuracoes_site
    add constraint configuracoes_site_cor_botoes_hex
        check (cor_botoes is null or cor_botoes ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'),
    add constraint configuracoes_site_cor_detalhes_hex
        check (cor_detalhes is null or cor_detalhes ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$');

-- Avisa a API (PostgREST) sobre as colunas novas imediatamente.
notify pgrst, 'reload schema';
