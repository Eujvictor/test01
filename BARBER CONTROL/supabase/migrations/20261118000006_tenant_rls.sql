-- =====================================================================
-- MULTI-TENANT 06 — REGRAS DE SEGURANÇA (RLS) POR BARBEARIA
-- ---------------------------------------------------------------------
-- ATENÇÃO: só aplique DEPOIS de publicar o site e o painel novos.
-- (O site novo lê os barbeiros pela view api.barbeiros_publicos; o
--  site antigo lia a tabela direto e deixaria de mostrar a equipe.)
--
-- O que faz (nenhum DADO é apagado):
--   * REMOVE as 18 políticas atuais baseadas no e-mail fixo e cria
--     políticas por barbearia em BARBEIROS, SERVIÇOS, clientes,
--     agendamentos, configuracoes_site e configuracoes_horarios:
--       - público lê só o necessário de barbearias ativas/em teste
--       - membro lê a própria barbearia (também quando suspensa)
--       - membro altera só a própria barbearia ativa/em teste
--       - Master (Barber Control com MFA) acessa todas
--   * telefone dos barbeiros sai da leitura pública: o site passa a
--     usar a view api.barbeiros_publicos (sem telefone)
--   * remove permissões em excesso (o público tinha INSERT, UPDATE,
--     DELETE e TRUNCATE em configuracoes_site)
--
-- Idempotente.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Remove as políticas antigas (por e-mail fixo)
-- ---------------------------------------------------------------------
drop policy if exists "Administrador pode gerenciar barbeiros"                on public."BARBEIROS";
drop policy if exists "Publico pode ver barbeiros ativos"                     on public."BARBEIROS";
drop policy if exists "Administrador pode atualizar servicos"                 on public."SERVIÇOS";
drop policy if exists "Administrador pode excluir servicos"                   on public."SERVIÇOS";
drop policy if exists "Administrador pode inserir servicos"                   on public."SERVIÇOS";
drop policy if exists "Administrador pode visualizar servicos"                on public."SERVIÇOS";
drop policy if exists "permitir consultar servicos"                           on public."SERVIÇOS";
drop policy if exists "Admin pode atualizar agendamentos"                     on public.agendamentos;
drop policy if exists "Admin pode consultar agendamentos"                     on public.agendamentos;
drop policy if exists "Admin pode excluir agendamentos"                       on public.agendamentos;
drop policy if exists "Administrador pode excluir clientes"                   on public.clientes;
drop policy if exists "Administrador pode visualizar clientes"                on public.clientes;
drop policy if exists "Administrador pode atualizar configuracoes de horarios" on public.configuracoes_horarios;
drop policy if exists "Administrador pode inserir configuracoes de horarios"  on public.configuracoes_horarios;
drop policy if exists "Permitir leitura de configuracoes de horarios"         on public.configuracoes_horarios;
drop policy if exists "Permitir leitura pública dos horários"                 on public.configuracoes_horarios;
drop policy if exists configuracoes_site_atualizacao_admin                    on public.configuracoes_site;
drop policy if exists configuracoes_site_leitura_publica                      on public.configuracoes_site;
-- Do arquivo sql/configuracoes_site.sql (podem existir ou não):
drop policy if exists site_config_leitura_publica on public.configuracoes_site;
drop policy if exists site_config_admin_insert    on public.configuracoes_site;
drop policy if exists site_config_admin_update    on public.configuracoes_site;

-- ---------------------------------------------------------------------
-- 2. Novas políticas por barbearia
-- ---------------------------------------------------------------------
do $$
declare
    t text;
    p text;
begin
    foreach t in array array['BARBEIROS', 'SERVIÇOS', 'clientes', 'agendamentos', 'configuracoes_site', 'configuracoes_horarios'] loop
        p := lower(replace(t, 'Ç', 'c'));
        execute format('alter table public.%I enable row level security', t);

        execute format('drop policy if exists %I on public.%I', p || '_membro_ler', t);
        execute format('create policy %I on public.%I for select to authenticated using (tenant.pode_consultar(barbearia_id))', p || '_membro_ler', t);

        execute format('drop policy if exists %I on public.%I', p || '_membro_alterar', t);
        execute format('create policy %I on public.%I for update to authenticated using (tenant.pode_gerenciar(barbearia_id)) with check (tenant.pode_gerenciar(barbearia_id))', p || '_membro_alterar', t);

        execute format('drop policy if exists %I on public.%I', p || '_membro_excluir', t);
        execute format('create policy %I on public.%I for delete to authenticated using (tenant.pode_gerenciar(barbearia_id))', p || '_membro_excluir', t);

        execute format('drop policy if exists %I on public.%I', p || '_membro_inserir', t);
        execute format('create policy %I on public.%I for insert to authenticated with check (tenant.pode_gerenciar(barbearia_id))', p || '_membro_inserir', t);
    end loop;
end $$;

-- Leitura pública (site): serviços ativos, configurações do site e horários
-- de barbearias ativas ou em teste.
drop policy if exists servicos_publico_ler on public."SERVIÇOS";
create policy servicos_publico_ler on public."SERVIÇOS"
    for select to anon, authenticated
    using (ativo = true and tenant.barbearia_publica(barbearia_id));

drop policy if exists configuracoes_site_publico_ler on public.configuracoes_site;
create policy configuracoes_site_publico_ler on public.configuracoes_site
    for select to anon, authenticated
    using (tenant.barbearia_publica(barbearia_id));

drop policy if exists configuracoes_horarios_publico_ler on public.configuracoes_horarios;
create policy configuracoes_horarios_publico_ler on public.configuracoes_horarios
    for select to anon, authenticated
    using (tenant.barbearia_publica(barbearia_id));

-- ---------------------------------------------------------------------
-- 3. Barbeiros para o site: view sem telefone
-- (a tabela BARBEIROS deixa de ser lida pelo público)
-- ---------------------------------------------------------------------
create or replace view api.barbeiros_publicos
with (security_barrier = true)
as
    select b.id, b.nome, b.especialidade, b.ativo, b.barbearia_id
    from public."BARBEIROS" b
    where b.ativo = true
      and tenant.barbearia_publica(b.barbearia_id);

revoke all on api.barbeiros_publicos from public;
grant select on api.barbeiros_publicos to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Permissões de tabela (o mínimo necessário)
-- ---------------------------------------------------------------------
revoke all on public."BARBEIROS", public."SERVIÇOS", public.clientes, public.agendamentos,
              public.configuracoes_site, public.configuracoes_horarios from anon;
grant select on public."SERVIÇOS", public.configuracoes_site, public.configuracoes_horarios to anon;

revoke truncate, references, trigger on public."BARBEIROS", public."SERVIÇOS", public.clientes, public.agendamentos,
              public.configuracoes_site, public.configuracoes_horarios from authenticated;
grant select, insert, update, delete on public."BARBEIROS", public."SERVIÇOS",
              public.configuracoes_site, public.configuracoes_horarios to authenticated;
grant select, update, delete on public.agendamentos to authenticated;
grant select, update, delete on public.clientes to authenticated;

commit;
