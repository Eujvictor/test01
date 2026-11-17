-- =====================================================================
-- NAVALHA DE OURO — CONFIGURAÇÕES DO SITE (painel → index.html)
-- Rode no Supabase: SQL Editor → New query → colar → Run.
-- O script é idempotente: pode ser executado mais de uma vez.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. CONFERÊNCIA (opcional, rode antes e veja o resultado)
--    Lista as políticas que já existem nas tabelas usadas pelo site.
--    Se aparecer alguma política de INSERT/UPDATE/DELETE liberada para
--    "anon" ou "public" em configuracoes_site, ela precisa ser removida
--    (DROP POLICY "nome" ON public.configuracoes_site;).
-- ---------------------------------------------------------------------
-- select tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('configuracoes_site', 'configuracoes_horarios');


-- ---------------------------------------------------------------------
-- 1. NOVAS COLUNAS (as existentes não são alteradas)
--    Campo vazio/nulo = o site usa o texto padrão.
-- ---------------------------------------------------------------------
alter table public.configuracoes_site
    add column if not exists titulo_pagina          text,
    add column if not exists texto_identificacao    text,
    add column if not exists link_botao_principal   text,
    add column if not exists link_botao_secundario  text,
    add column if not exists texto_botao_cabecalho  text,

    add column if not exists servicos_titulo        text,
    add column if not exists servicos_descricao     text,

    add column if not exists portfolio_titulo       text,
    add column if not exists portfolio_descricao    text,
    -- [{ "url": "https://...", "legenda": "Fade" }, ...] (até 4)
    add column if not exists portfolio_itens        jsonb,

    add column if not exists equipe_titulo          text,
    add column if not exists equipe_descricao       text,

    add column if not exists avaliacoes_titulo      text,
    add column if not exists avaliacoes_descricao   text,
    -- [{ "estrelas": 5, "nome": "Rafael M.", "texto": "..." }, ...] (até 5)
    add column if not exists avaliacoes             jsonb,
    add column if not exists texto_botao_google     text,

    add column if not exists instagram_descricao    text,
    add column if not exists texto_botao_instagram  text;


-- ---------------------------------------------------------------------
-- 2. SEGURANÇA (RLS)
--    Site público: só leitura.
--    Escrita: somente o administrador logado
--    (mesmo e-mail verificado em proteger-admin.js).
-- ---------------------------------------------------------------------
alter table public.configuracoes_site enable row level security;

drop policy if exists "site_config_leitura_publica" on public.configuracoes_site;
create policy "site_config_leitura_publica"
    on public.configuracoes_site
    for select
    to anon, authenticated
    using (true);

drop policy if exists "site_config_admin_insert" on public.configuracoes_site;
create policy "site_config_admin_insert"
    on public.configuracoes_site
    for insert
    to authenticated
    with check (lower(auth.jwt() ->> 'email') = 'navalhadeouro@gmail.com');

drop policy if exists "site_config_admin_update" on public.configuracoes_site;
create policy "site_config_admin_update"
    on public.configuracoes_site
    for update
    to authenticated
    using      (lower(auth.jwt() ->> 'email') = 'navalhadeouro@gmail.com')
    with check (lower(auth.jwt() ->> 'email') = 'navalhadeouro@gmail.com');

-- Sem política de DELETE: ninguém apaga a linha de configuração pelo site.


-- ---------------------------------------------------------------------
-- 3. STORAGE — imagens do site (logo, banner, portfólio)
--    Bucket público para leitura; upload só do administrador.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'site-imagens',
    'site-imagens',
    true,
    5242880, -- 5 MB
    array['image/jpeg', 'image/png', 'image/svg+xml']
)
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site_imagens_leitura_publica" on storage.objects;
create policy "site_imagens_leitura_publica"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'site-imagens');

drop policy if exists "site_imagens_admin_insert" on storage.objects;
create policy "site_imagens_admin_insert"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'site-imagens'
        and lower(auth.jwt() ->> 'email') = 'navalhadeouro@gmail.com'
    );

drop policy if exists "site_imagens_admin_update" on storage.objects;
create policy "site_imagens_admin_update"
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'site-imagens'
        and lower(auth.jwt() ->> 'email') = 'navalhadeouro@gmail.com'
    );

drop policy if exists "site_imagens_admin_delete" on storage.objects;
create policy "site_imagens_admin_delete"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'site-imagens'
        and lower(auth.jwt() ->> 'email') = 'navalhadeouro@gmail.com'
    );


-- ---------------------------------------------------------------------
-- 4. updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.configuracoes_site_touch()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists configuracoes_site_touch on public.configuracoes_site;
create trigger configuracoes_site_touch
    before update on public.configuracoes_site
    for each row
    execute function public.configuracoes_site_touch();
