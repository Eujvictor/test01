-- =====================================================================
-- BARBER CONTROL — Migração 12: registros do produto
-- Módulos: 13 Atualizações e versões · 14 Funcionalidades ·
--          15 Histórico de alterações · 16 Roadmap e solicitações
--
-- O que esta migração faz:
--   * Cria control.produto_registros: um cadastro simples, só do Master,
--     para versões, funcionalidades, histórico de mudanças e ideias do
--     roadmap (cada módulo usa um "tipo").
--   * Cria as funções control_api.listar_produto, salvar_produto e
--     excluir_produto (administrador + MFA, com auditoria).
--
-- O que esta migração NÃO faz:
--   * Não altera nem apaga tabelas ou registros existentes.
--   * Não publica versões nem liga funcionalidades nos painéis: é um
--     registro de gestão do produto.
--
-- Idempotente: pode ser executada mais de uma vez.
-- Execução: Supabase → SQL Editor → colar → Run.
-- =====================================================================

begin;

create table if not exists control.produto_registros (
    id            uuid primary key default gen_random_uuid(),
    tipo          text not null check (tipo in ('versao', 'funcionalidade', 'mudanca', 'ideia')),
    titulo        text not null check (length(trim(titulo)) between 2 and 160),
    descricao     text check (descricao is null or length(descricao) <= 4000),
    status        text not null,
    categoria     text,
    prioridade    text check (prioridade is null or prioridade in ('baixa', 'media', 'alta', 'critica')),
    versao        text check (versao is null or length(versao) <= 40),
    data          date,
    barbearia_id  uuid references control.barbearias (id) on delete set null,
    criado_por    uuid references auth.users (id) on delete set null,
    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);
create index if not exists produto_registros_tipo_idx on control.produto_registros (tipo, data desc nulls last);

alter table control.produto_registros enable row level security;
revoke all on control.produto_registros from public, anon, authenticated;

drop trigger if exists produto_registros_atualizado_em on control.produto_registros;
create trigger produto_registros_atualizado_em before update on control.produto_registros
    for each row execute function control.tocar_atualizado_em();

-- Situações e categorias aceitas em cada tipo.
create or replace function control.produto_valores(p_tipo text, p_campo text)
returns text[]
language sql
immutable
set search_path = ''
as $$
    select case p_tipo || ':' || p_campo
        when 'versao:status'         then array['planejada', 'em_desenvolvimento', 'publicada', 'cancelada']
        when 'funcionalidade:status' then array['planejada', 'beta', 'ativa', 'desativada']
        when 'mudanca:status'        then array['pendente', 'publicada']
        when 'ideia:status'          then array['ideia', 'planejada', 'em_andamento', 'concluida', 'descartada']
        when 'mudanca:categoria'     then array['nova', 'melhoria', 'correcao', 'seguranca', 'outra']
        when 'funcionalidade:categoria' then array['agenda', 'site', 'painel', 'financeiro', 'clientes', 'outra']
        when 'ideia:categoria'       then array['interna', 'barbearia']
        else null end;
$$;

create or replace function control_api.listar_produto(p_tipo text)
returns table (id uuid, tipo text, titulo text, descricao text, status text, categoria text, prioridade text,
               versao text, data date, barbearia_id uuid, barbearia text, criado_em timestamptz, atualizado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    if p_tipo not in ('versao', 'funcionalidade', 'mudanca', 'ideia') then
        raise exception 'tipo_invalido' using errcode = '22023';
    end if;
    return query
    select r.id, r.tipo, r.titulo, r.descricao, r.status, r.categoria, r.prioridade, r.versao, r.data,
           r.barbearia_id, b.nome_comercial, r.criado_em, r.atualizado_em
    from control.produto_registros r
    left join control.barbearias b on b.id = r.barbearia_id
    where r.tipo = p_tipo
    order by r.data desc nulls last, r.criado_em desc
    limit 2000;
end;
$$;

create or replace function control_api.salvar_produto(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id         uuid := p_id;
    v_tipo       text := coalesce(p_dados ->> 'tipo', '');
    v_titulo     text := trim(coalesce(p_dados ->> 'titulo', ''));
    v_status     text := nullif(p_dados ->> 'status', '');
    v_categoria  text := nullif(p_dados ->> 'categoria', '');
    v_prioridade text := nullif(p_dados ->> 'prioridade', '');
    v_barbearia  uuid := nullif(p_dados ->> 'barbearia_id', '')::uuid;
    v_anterior   control.produto_registros%rowtype;
begin
    perform control.exigir_admin();
    if v_id is not null then
        select * into v_anterior from control.produto_registros where id = v_id;
        if not found then raise exception 'registro_inexistente' using errcode = 'P0002'; end if;
        v_tipo := v_anterior.tipo; -- o tipo não muda
    end if;
    if v_tipo not in ('versao', 'funcionalidade', 'mudanca', 'ideia') then raise exception 'tipo_invalido' using errcode = '22023'; end if;
    if length(v_titulo) < 2 then raise exception 'titulo_obrigatorio' using errcode = '22023'; end if;
    if v_status is null or not (v_status = any (control.produto_valores(v_tipo, 'status'))) then
        raise exception 'status_invalido' using errcode = '22023';
    end if;
    if v_categoria is not null and control.produto_valores(v_tipo, 'categoria') is not null
       and not (v_categoria = any (control.produto_valores(v_tipo, 'categoria'))) then
        raise exception 'categoria_invalida' using errcode = '22023';
    end if;
    if v_prioridade is not null and v_prioridade not in ('baixa', 'media', 'alta', 'critica') then
        raise exception 'prioridade_invalida' using errcode = '22023';
    end if;
    if v_barbearia is not null and not exists (select 1 from control.barbearias where id = v_barbearia) then
        raise exception 'barbearia_inexistente' using errcode = 'P0002';
    end if;

    if v_id is null then
        insert into control.produto_registros (tipo, titulo, descricao, status, categoria, prioridade, versao, data, barbearia_id, criado_por)
        values (v_tipo, left(v_titulo, 160), nullif(left(trim(coalesce(p_dados ->> 'descricao', '')), 4000), ''), v_status,
                v_categoria, v_prioridade, nullif(left(trim(coalesce(p_dados ->> 'versao', '')), 40), ''),
                nullif(p_dados ->> 'data', '')::date, v_barbearia, auth.uid())
        returning id into v_id;
    else
        -- Campo que não veio em p_dados mantém o valor atual.
        update control.produto_registros set
            titulo = left(v_titulo, 160),
            descricao = case when p_dados ? 'descricao' then nullif(left(trim(coalesce(p_dados ->> 'descricao', '')), 4000), '') else descricao end,
            status = v_status,
            categoria = case when p_dados ? 'categoria' then v_categoria else categoria end,
            prioridade = case when p_dados ? 'prioridade' then v_prioridade else prioridade end,
            versao = case when p_dados ? 'versao' then nullif(left(trim(coalesce(p_dados ->> 'versao', '')), 40), '') else versao end,
            data = case when p_dados ? 'data' then nullif(p_dados ->> 'data', '')::date else data end,
            barbearia_id = case when p_dados ? 'barbearia_id' then v_barbearia else barbearia_id end
        where id = v_id;
    end if;

    perform control.registrar_auditoria(auth.uid(), 'produto_salvo', 'produto', v_id::text,
        jsonb_build_object('tipo', v_tipo, 'nome', left(v_titulo, 160), 'anterior', v_anterior.status, 'novo', v_status));
    return v_id;
end;
$$;

create or replace function control_api.excluir_produto(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    r control.produto_registros%rowtype;
begin
    perform control.exigir_admin();
    delete from control.produto_registros where id = p_id returning * into r;
    if r.id is null then raise exception 'registro_inexistente' using errcode = 'P0002'; end if;
    perform control.registrar_auditoria(auth.uid(), 'produto_excluido', 'produto', r.id::text,
        jsonb_build_object('tipo', r.tipo, 'nome', r.titulo, 'status', r.status));
end;
$$;

revoke all on function control.produto_valores(text, text) from public, anon, authenticated;
revoke all on function control_api.listar_produto(text) from public, anon;
revoke all on function control_api.salvar_produto(uuid, jsonb) from public, anon;
revoke all on function control_api.excluir_produto(uuid) from public, anon;
grant execute on function control_api.listar_produto(text) to authenticated;
grant execute on function control_api.salvar_produto(uuid, jsonb) to authenticated;
grant execute on function control_api.excluir_produto(uuid) to authenticated;

commit;
