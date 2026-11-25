-- =====================================================================
-- BARBER CONTROL — Migração 15: liberação de funcionalidades
-- Módulo 14 Funcionalidades passa a LIGAR e DESLIGAR novidades nos sites.
--
-- Como funciona (usa a "Situação" que o cadastro já tem):
--   Planejada / Desativada → não aparece em nenhuma barbearia
--   Beta (Em teste)        → aparece só na barbearia de referência
--                            (Navalha de Ouro) e nas barbearias piloto
--   Ativa (Liberada)       → aparece em todas as barbearias
--
-- O que esta migração faz:
--   * control.produto_registros: novas colunas "codigo" (o nome técnico
--     que o código do site consulta, ex.: fidelidade) e "liberada_em".
--   * control.funcionalidade_piloto: barbearias escolhidas para testar
--     junto com a Navalha de Ouro.
--   * control.funcionalidade_ligada(codigo, barbearia): a regra única,
--     para as funções do banco também conferirem (não só a tela).
--   * api.funcionalidades_ligadas(barbearia): lista os códigos ligados
--     para o site e o painel da barbearia.
--   * control_api.listar_funcionalidades, mudar_liberacao (Em teste /
--     Liberar para todas / Desligar — ao liberar, publica um comunicado
--     e registra no Histórico), definir_piloto.
--   * control_api.salvar_produto passa a aceitar o "codigo".
--
-- O que esta migração NÃO faz:
--   * Não apaga tabelas nem registros. As funcionalidades já cadastradas
--     continuam iguais (sem código, não ligam nada até você definir um).
--
-- Idempotente: pode ser executada mais de uma vez.
-- Execução: Supabase → SQL Editor → colar → Run.
-- =====================================================================

begin;

alter table control.produto_registros
    add column if not exists codigo text
        check (codigo is null or codigo ~ '^[a-z][a-z0-9_]{2,39}$'),
    add column if not exists liberada_em timestamptz;

create unique index if not exists produto_registros_codigo_unico
    on control.produto_registros (codigo) where tipo = 'funcionalidade' and codigo is not null;

create table if not exists control.funcionalidade_piloto (
    funcionalidade_id uuid not null references control.produto_registros (id) on delete cascade,
    barbearia_id      uuid not null references control.barbearias (id) on delete cascade,
    criado_em         timestamptz not null default now(),
    primary key (funcionalidade_id, barbearia_id)
);
alter table control.funcionalidade_piloto enable row level security;
revoke all on control.funcionalidade_piloto from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Regra única: a funcionalidade está ligada nesta barbearia?
-- ---------------------------------------------------------------------
create or replace function control.funcionalidade_ligada(p_codigo text, p_barbearia uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from control.produto_registros r
        join control.barbearias b on b.id = p_barbearia
        where r.tipo = 'funcionalidade'
          and r.codigo = lower(trim(p_codigo))
          and (r.status = 'ativa'
               or (r.status = 'beta'
                   and (b.protegida
                        or exists (select 1 from control.funcionalidade_piloto fp
                                   where fp.funcionalidade_id = r.id and fp.barbearia_id = b.id))))
    );
$$;

-- Site público e painel: códigos ligados na barbearia (não revela nada
-- além dos códigos técnicos, que não são sigilosos).
create or replace function api.funcionalidades_ligadas(p_barbearia uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(array_agg(r.codigo order by r.codigo), '{}')
    from control.produto_registros r
    where r.tipo = 'funcionalidade'
      and r.codigo is not null
      and r.status in ('ativa', 'beta')
      and control.funcionalidade_ligada(r.codigo, p_barbearia);
$$;

-- ---------------------------------------------------------------------
-- Master: lista com código, pilotos e quantas barbearias veem
-- ---------------------------------------------------------------------
create or replace function control_api.listar_funcionalidades()
returns table (id uuid, titulo text, descricao text, status text, categoria text, codigo text, data date,
               liberada_em timestamptz, pilotos uuid[], pilotos_nomes text[], barbearias_com_acesso bigint,
               criado_em timestamptz, atualizado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return query
    select r.id, r.titulo, r.descricao, r.status, r.categoria, r.codigo, r.data, r.liberada_em,
           coalesce((select array_agg(fp.barbearia_id order by b.nome_comercial)
                     from control.funcionalidade_piloto fp join control.barbearias b on b.id = fp.barbearia_id
                     where fp.funcionalidade_id = r.id), '{}'),
           coalesce((select array_agg(b.nome_comercial order by b.nome_comercial)
                     from control.funcionalidade_piloto fp join control.barbearias b on b.id = fp.barbearia_id
                     where fp.funcionalidade_id = r.id), '{}'),
           case when r.codigo is null then 0::bigint
                else (select count(*) from control.barbearias b
                      where b.status <> 'cancelada' and control.funcionalidade_ligada(r.codigo, b.id)) end,
           r.criado_em, r.atualizado_em
    from control.produto_registros r
    where r.tipo = 'funcionalidade'
    order by case r.status when 'beta' then 0 when 'ativa' then 1 when 'planejada' then 2 else 3 end,
             r.atualizado_em desc
    limit 2000;
end;
$$;

-- ---------------------------------------------------------------------
-- Master: Em teste / Liberar para todas / Desligar
-- ---------------------------------------------------------------------
create or replace function control_api.mudar_liberacao(p_id uuid, p_acao text, p_avisar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    r          control.produto_registros%rowtype;
    v_novo     text;
    v_comunicado uuid;
begin
    perform control.exigir_admin();
    select * into r from control.produto_registros where id = p_id and tipo = 'funcionalidade' for update;
    if not found then raise exception 'registro_inexistente' using errcode = 'P0002'; end if;

    v_novo := case p_acao when 'teste' then 'beta' when 'todas' then 'ativa' when 'desligar' then 'desativada' end;
    if v_novo is null then raise exception 'acao_invalida' using errcode = '22023'; end if;
    if v_novo <> 'desativada' and r.codigo is null then raise exception 'codigo_obrigatorio' using errcode = '22023'; end if;

    update control.produto_registros set
        status = v_novo,
        liberada_em = case when v_novo = 'ativa' then now() else liberada_em end,
        data = case when v_novo = 'ativa' then coalesce(data, control.hoje()) else data end
    where id = r.id;

    if v_novo = 'ativa' and r.status <> 'ativa' then
        insert into control.produto_registros (tipo, titulo, descricao, status, categoria, data, criado_por)
        values ('mudanca', left('Liberada para todas: ' || r.titulo, 160), r.descricao, 'publicada', 'nova',
                control.hoje(), auth.uid());
        if p_avisar then
            insert into control.comunicados (titulo, mensagem, categoria, prioridade, status, destino, publicado_em, criado_por)
            values (left('Novidade: ' || r.titulo, 120),
                    left(coalesce(nullif(trim(r.descricao), ''), 'Uma nova funcionalidade já está disponível no seu painel.'), 2000),
                    'novidade', 'normal', 'publicado', 'todas', now(), auth.uid())
            returning id into v_comunicado;
        end if;
    end if;

    perform control.registrar_auditoria(auth.uid(), 'funcionalidade_liberacao', 'produto', r.id::text,
        jsonb_build_object('nome', r.titulo, 'codigo', r.codigo, 'anterior', r.status, 'novo', v_novo,
                           'comunicado', v_comunicado is not null));
    return jsonb_build_object('status', v_novo, 'comunicado', v_comunicado);
end;
$$;

-- Master: barbearias piloto (substitui a lista inteira).
create or replace function control_api.definir_piloto(p_id uuid, p_barbearias uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_titulo text;
    v_total  integer;
begin
    perform control.exigir_admin();
    select titulo into v_titulo from control.produto_registros where id = p_id and tipo = 'funcionalidade';
    if v_titulo is null then raise exception 'registro_inexistente' using errcode = 'P0002'; end if;
    if exists (select 1 from unnest(coalesce(p_barbearias, '{}')) x
               where not exists (select 1 from control.barbearias b where b.id = x)) then
        raise exception 'barbearia_inexistente' using errcode = 'P0002';
    end if;

    delete from control.funcionalidade_piloto
    where funcionalidade_id = p_id and not (barbearia_id = any (coalesce(p_barbearias, '{}')));
    insert into control.funcionalidade_piloto (funcionalidade_id, barbearia_id)
    select p_id, x from unnest(coalesce(p_barbearias, '{}')) x
    on conflict do nothing;

    select count(*) into v_total from control.funcionalidade_piloto where funcionalidade_id = p_id;
    perform control.registrar_auditoria(auth.uid(), 'funcionalidade_piloto', 'produto', p_id::text,
        jsonb_build_object('nome', v_titulo, 'barbearias', v_total));
    return v_total;
end;
$$;

-- ---------------------------------------------------------------------
-- salvar_produto: igual à migração 12, agora com o "codigo"
-- ---------------------------------------------------------------------
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
    v_codigo     text := nullif(lower(trim(coalesce(p_dados ->> 'codigo', ''))), '');
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
    if v_tipo <> 'funcionalidade' then
        v_codigo := null;
    elsif v_codigo is not null then
        if v_codigo !~ '^[a-z][a-z0-9_]{2,39}$' then raise exception 'codigo_invalido' using errcode = '22023'; end if;
        if exists (select 1 from control.produto_registros
                   where tipo = 'funcionalidade' and codigo = v_codigo and id is distinct from v_id) then
            raise exception 'codigo_em_uso' using errcode = '23505';
        end if;
    end if;
    -- Sem código a funcionalidade é só informativa (não liga nada no site).
    -- Os botões de liberação (mudar_liberacao) é que exigem o código.

    if v_id is null then
        insert into control.produto_registros (tipo, titulo, descricao, status, categoria, prioridade, versao, data,
                                               barbearia_id, codigo, liberada_em, criado_por)
        values (v_tipo, left(v_titulo, 160), nullif(left(trim(coalesce(p_dados ->> 'descricao', '')), 4000), ''), v_status,
                v_categoria, v_prioridade, nullif(left(trim(coalesce(p_dados ->> 'versao', '')), 40), ''),
                nullif(p_dados ->> 'data', '')::date, v_barbearia, v_codigo,
                case when v_tipo = 'funcionalidade' and v_status = 'ativa' then now() end, auth.uid())
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
            barbearia_id = case when p_dados ? 'barbearia_id' then v_barbearia else barbearia_id end,
            codigo = case when p_dados ? 'codigo' then v_codigo else codigo end,
            liberada_em = case when v_tipo = 'funcionalidade' and v_status = 'ativa' and v_anterior.status <> 'ativa'
                               then now() else liberada_em end
        where id = v_id;
    end if;

    perform control.registrar_auditoria(auth.uid(), 'produto_salvo', 'produto', v_id::text,
        jsonb_build_object('tipo', v_tipo, 'nome', left(v_titulo, 160), 'anterior', v_anterior.status, 'novo', v_status));
    return v_id;
end;
$$;

revoke all on function control.funcionalidade_ligada(text, uuid) from public, anon, authenticated;
revoke all on function api.funcionalidades_ligadas(uuid) from public;
revoke all on function control_api.listar_funcionalidades() from public, anon;
revoke all on function control_api.mudar_liberacao(uuid, text, boolean) from public, anon;
revoke all on function control_api.definir_piloto(uuid, uuid[]) from public, anon;
revoke all on function control_api.salvar_produto(uuid, jsonb) from public, anon;

grant execute on function api.funcionalidades_ligadas(uuid) to anon, authenticated;
grant execute on function control_api.listar_funcionalidades() to authenticated;
grant execute on function control_api.mudar_liberacao(uuid, text, boolean) to authenticated;
grant execute on function control_api.definir_piloto(uuid, uuid[]) to authenticated;
grant execute on function control_api.salvar_produto(uuid, jsonb) to authenticated;

commit;
