-- =====================================================================
-- MULTI-TENANT 05 — FUNÇÕES DO PAINEL MASTER (Barber Control)
-- ---------------------------------------------------------------------
-- Pré-requisito: 20261118000004_tenant_colunas.sql.
--
-- Todas exigem administrador do Barber Control com MFA (control.exigir_admin)
-- e registram a ação em control.auditoria (somente inserção).
--   * listar_barbearias / obter_barbearia
--   * salvar_barbearia: cadastra (já criando configuração de site e de
--     horários próprias = ambiente pronto) ou edita
--   * alterar_status_barbearia: teste / ativa / suspensa / cancelada
--     (a barbearia protegida recusa suspensão e cancelamento)
--   * vincular_proprietario / alterar_membro / listar_membros
--     A CONTA de login do proprietário é criada pela Edge Function
--     control-admin (precisa da chave secreta, que fica só no servidor).
--
-- Nada é apagado. Idempotente.
-- =====================================================================

begin;

create or replace function control_api.listar_barbearias()
returns table (
    id uuid, slug text, nome text, status text, protegida boolean, dominio text,
    cidade text, estado text, proprietario_nome text, proprietario_email text,
    membros bigint, barbeiros bigint, servicos bigint, agendamentos_30d bigint,
    criado_em timestamptz, atualizado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return query
    select b.id, b.codigo, b.nome_comercial, b.status, b.protegida, b.dominio,
           b.cidade, b.estado::text, b.proprietario_nome, b.proprietario_email,
           (select count(*) from control.membros m where m.barbearia_id = b.id and m.ativo),
           (select count(*) from public."BARBEIROS" x where x.barbearia_id = b.id and x.ativo),
           (select count(*) from public."SERVIÇOS" x where x.barbearia_id = b.id and x.ativo),
           (select count(*) from public.agendamentos x where x.barbearia_id = b.id and x.data >= current_date - 30),
           b.criado_em, b.atualizado_em
    from control.barbearias b
    order by b.criado_em;
end;
$$;

create or replace function control_api.salvar_barbearia(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id     uuid := p_id;
    v_slug   text := lower(trim(p_dados ->> 'slug'));
    v_nome   text := trim(p_dados ->> 'nome');
    v_email  text := lower(nullif(trim(p_dados ->> 'proprietario_email'), ''));
    v_estado text := upper(nullif(trim(p_dados ->> 'estado'), ''));
begin
    perform control.exigir_admin();

    if v_slug is null or v_slug !~ '^[a-z0-9-]{3,40}$' then
        raise exception 'slug_invalido: use 3 a 40 letras minúsculas, números ou hífen' using errcode = '22023';
    end if;
    if v_nome is null or length(v_nome) < 2 then
        raise exception 'nome_invalido' using errcode = '22023';
    end if;
    if v_estado is not null and v_estado !~ '^[A-Z]{2}$' then
        raise exception 'estado_invalido: use a sigla com 2 letras' using errcode = '22023';
    end if;
    if exists (select 1 from control.barbearias where codigo = v_slug and id is distinct from v_id) then
        raise exception 'slug_em_uso: já existe uma barbearia com este endereço' using errcode = '23505';
    end if;

    if v_id is null then
        insert into control.barbearias (codigo, nome_comercial, razao_social, documento, proprietario_nome,
                                        proprietario_email, proprietario_telefone, cidade, estado, dominio, observacoes, status)
        values (v_slug, v_nome, p_dados ->> 'razao_social', p_dados ->> 'documento', p_dados ->> 'proprietario_nome',
                v_email, p_dados ->> 'proprietario_telefone', p_dados ->> 'cidade', v_estado,
                nullif(lower(trim(p_dados ->> 'dominio')), ''), p_dados ->> 'observacoes', 'teste')
        returning id into v_id;

        -- Ambiente inicial da nova barbearia: site e horários próprios.
        insert into public.configuracoes_site (barbearia_id, nome_barbearia)
        values (v_id, v_nome);
        insert into public.configuracoes_horarios (barbearia_id) values (v_id);

        perform control.registrar_auditoria(auth.uid(), 'barbearia_cadastrada', 'barbearia', v_id::text,
                                            jsonb_build_object('slug', v_slug, 'nome', v_nome));
    else
        update control.barbearias set
            codigo = v_slug, nome_comercial = v_nome,
            razao_social = p_dados ->> 'razao_social', documento = p_dados ->> 'documento',
            proprietario_nome = p_dados ->> 'proprietario_nome', proprietario_email = v_email,
            proprietario_telefone = p_dados ->> 'proprietario_telefone',
            cidade = p_dados ->> 'cidade', estado = v_estado,
            dominio = nullif(lower(trim(p_dados ->> 'dominio')), ''), observacoes = p_dados ->> 'observacoes'
        where id = v_id;
        if not found then
            raise exception 'barbearia_inexistente' using errcode = 'P0002';
        end if;
        perform control.registrar_auditoria(auth.uid(), 'barbearia_editada', 'barbearia', v_id::text,
                                            jsonb_build_object('slug', v_slug, 'nome', v_nome));
    end if;

    return v_id;
end;
$$;

create or replace function control_api.alterar_status_barbearia(p_id uuid, p_status text, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_anterior text;
begin
    perform control.exigir_admin();
    if p_status not in ('teste', 'ativa', 'suspensa', 'cancelada') then
        raise exception 'status_invalido' using errcode = '22023';
    end if;
    select status into v_anterior from control.barbearias where id = p_id;
    if v_anterior is null then
        raise exception 'barbearia_inexistente' using errcode = 'P0002';
    end if;
    update control.barbearias set status = p_status where id = p_id;
    perform control.registrar_auditoria(auth.uid(), 'barbearia_status', 'barbearia', p_id::text,
        jsonb_build_object('anterior', v_anterior, 'novo', p_status, 'motivo', p_motivo));
end;
$$;

-- Vincula uma conta EXISTENTE (criada pela Edge Function ou pelo painel
-- Authentication do Supabase) como proprietária/gerente da barbearia.
create or replace function control_api.vincular_proprietario(p_barbearia uuid, p_email text, p_papel text default 'proprietario')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user uuid;
    v_id   uuid;
begin
    perform control.exigir_admin();
    if p_papel not in ('proprietario', 'gerente') then
        raise exception 'papel_invalido' using errcode = '22023';
    end if;
    if not exists (select 1 from control.barbearias where id = p_barbearia) then
        raise exception 'barbearia_inexistente' using errcode = 'P0002';
    end if;
    select id into v_user from auth.users where lower(email) = lower(trim(p_email));
    if v_user is null then
        raise exception 'conta_inexistente: crie a conta de acesso antes de vincular' using errcode = 'P0002';
    end if;
    if exists (select 1 from control.administradores a where a.email = lower(trim(p_email))) then
        raise exception 'conta_master: a conta do administrador do SaaS não pode ser vinculada a uma barbearia' using errcode = '42501';
    end if;

    insert into control.membros (barbearia_id, user_id, papel, ativo)
    values (p_barbearia, v_user, p_papel, true)
    on conflict (barbearia_id, user_id) do update set papel = excluded.papel, ativo = true
    returning id into v_id;

    perform control.registrar_auditoria(auth.uid(), 'membro_vinculado', 'barbearia', p_barbearia::text,
        jsonb_build_object('usuario', v_user, 'papel', p_papel));
    return v_id;
end;
$$;

create or replace function control_api.alterar_membro(p_membro uuid, p_ativo boolean, p_papel text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_barbearia uuid;
begin
    perform control.exigir_admin();
    if p_papel is not null and p_papel not in ('proprietario', 'gerente') then
        raise exception 'papel_invalido' using errcode = '22023';
    end if;
    update control.membros set ativo = p_ativo, papel = coalesce(p_papel, papel)
    where id = p_membro
    returning barbearia_id into v_barbearia;
    if v_barbearia is null then
        raise exception 'membro_inexistente' using errcode = 'P0002';
    end if;
    perform control.registrar_auditoria(auth.uid(), case when p_ativo then 'membro_reativado' else 'membro_desativado' end,
        'barbearia', v_barbearia::text, jsonb_build_object('membro', p_membro, 'papel', p_papel));
end;
$$;

create or replace function control_api.listar_membros(p_barbearia uuid)
returns table (id uuid, email text, papel text, ativo boolean, ultimo_acesso timestamptz, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return query
    select m.id, u.email::text, m.papel, m.ativo, u.last_sign_in_at, m.criado_em
    from control.membros m
    join auth.users u on u.id = m.user_id
    where m.barbearia_id = p_barbearia
    order by m.criado_em;
end;
$$;

revoke all on function control_api.listar_barbearias() from public, anon;
revoke all on function control_api.salvar_barbearia(uuid, jsonb) from public, anon;
revoke all on function control_api.alterar_status_barbearia(uuid, text, text) from public, anon;
revoke all on function control_api.vincular_proprietario(uuid, text, text) from public, anon;
revoke all on function control_api.alterar_membro(uuid, boolean, text) from public, anon;
revoke all on function control_api.listar_membros(uuid) from public, anon;

grant execute on function control_api.listar_barbearias() to authenticated;
grant execute on function control_api.salvar_barbearia(uuid, jsonb) to authenticated;
grant execute on function control_api.alterar_status_barbearia(uuid, text, text) to authenticated;
grant execute on function control_api.vincular_proprietario(uuid, text, text) to authenticated;
grant execute on function control_api.alterar_membro(uuid, boolean, text) to authenticated;
grant execute on function control_api.listar_membros(uuid) to authenticated;

commit;
