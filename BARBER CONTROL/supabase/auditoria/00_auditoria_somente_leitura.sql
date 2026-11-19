-- =====================================================================
-- AUDITORIA DO BANCO — SOMENTE LEITURA
-- Não cria, não altera e não apaga nada: só consulta o catálogo.
-- Não mostra dados de clientes nem e-mails.
--
-- Como usar: Supabase → SQL Editor → New query → colar → Run.
-- Depois clique no botão de copiar/baixar o resultado (CSV) e me envie.
-- =====================================================================
with
tabelas as (
    select 'TABELA' as secao, n.nspname || '.' || c.relname as item,
           'rls=' || c.relrowsecurity || ' · forçado=' || c.relforcerowsecurity ||
           ' · linhas≈' || greatest(c.reltuples, 0)::bigint as detalhe
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n.nspname in ('public', 'api', 'control')
),
colunas as (
    select 'COLUNA', table_schema || '.' || table_name || '.' || column_name,
           data_type || case when is_nullable = 'NO' then ' not null' else '' end ||
           coalesce(' default ' || column_default, '')
    from information_schema.columns
    where table_schema in ('public', 'api', 'control')
),
restricoes as (
    select 'RESTRICAO', n.nspname || '.' || cl.relname || ' · ' || con.conname,
           pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname in ('public', 'api', 'control')
),
politicas as (
    select 'POLITICA', schemaname || '.' || tablename || ' · ' || policyname,
           cmd || ' · papeis=' || array_to_string(roles, ',') ||
           ' · using=' || coalesce(qual, '-') || ' · check=' || coalesce(with_check, '-')
    from pg_policies
    where schemaname in ('public', 'api', 'control', 'storage')
),
funcoes as (
    select 'FUNCAO', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
           case when p.prosecdef then 'SECURITY DEFINER' else 'invoker' end ||
           ' · retorna ' || pg_get_function_result(p.oid) || E'\n' || p.prosrc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'api', 'control')
),
gatilhos as (
    select 'GATILHO', event_object_schema || '.' || event_object_table || ' · ' || trigger_name,
           action_timing || ' ' || event_manipulation || ' · ' || action_statement
    from information_schema.triggers
    where event_object_schema in ('public', 'api', 'control')
),
privilegios as (
    select 'PRIVILEGIO', table_schema || '.' || table_name,
           grantee || ': ' || string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
    where table_schema in ('public', 'api') and grantee in ('anon', 'authenticated')
    group by table_schema, table_name, grantee
),
buckets as (
    select 'BUCKET', id, 'publico=' || public || ' · limite=' || coalesce(file_size_limit::text, '-') ||
           ' · tipos=' || coalesce(array_to_string(allowed_mime_types, ','), '-')
    from storage.buckets
),
arquivos as (
    select 'ARQUIVOS', bucket_id || ' · pasta ' || coalesce(split_part(name, '/', 1), '-'),
           count(*)::text || ' arquivos'
    from storage.objects
    group by bucket_id, split_part(name, '/', 1)
),
esquemas as (
    select 'SCHEMA', nspname, 'existe'
    from pg_namespace
    where nspname in ('public', 'api', 'control', 'control_api')
),
usuarios as (
    select 'AUTH', 'usuarios', count(*)::text || ' contas · ' ||
           count(*) filter (where email_confirmed_at is not null)::text || ' confirmadas'
    from auth.users
)
select * from esquemas
union all select * from tabelas
union all select * from colunas
union all select * from restricoes
union all select * from politicas
union all select * from privilegios
union all select * from gatilhos
union all select * from funcoes
union all select * from buckets
union all select * from arquivos
union all select * from usuarios
order by 1, 2;
