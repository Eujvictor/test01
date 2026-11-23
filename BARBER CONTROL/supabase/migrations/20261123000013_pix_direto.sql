-- =====================================================================
-- BARBER CONTROL — Migração 13: recebimento por Pix direto
-- Alternativa ao Mercado Pago (decisão de 23/11/2026): o dono paga a
-- mensalidade por Pix na chave do proprietário do SaaS, avisa "Já paguei"
-- no painel e o Master confirma o recebimento no Barber Control.
--
-- O que esta migração faz:
--   * Acrescenta à control.cobranca_config os dados do Pix (chave, nome do
--     recebedor, cidade e se está ativo).
--   * Acrescenta à control.faturas o aviso de pagamento do dono
--     (informado_em/por/observação) e o motivo, se o Master não encontrar.
--   * Atualiza api.minha_assinatura (mesma assinatura) para entregar os
--     dados do Pix e a situação do aviso de cada fatura.
--   * Atualiza control.processar_cobranca (mesma assinatura): um aviso de
--     "Já paguei" adia a suspensão automática por até 3 dias.
--   * Cria funções novas para o dono (informar pagamento) e para o Master
--     (configurar o Pix, listar avisos, recusar aviso).
--
-- O que esta migração NÃO faz:
--   * Não apaga nem altera registros existentes (só acrescenta colunas
--     vazias). Não mexe no código do Mercado Pago, que continua pronto.
--   * Não confirma pagamento sozinha: quem confirma é o Master.
--
-- Idempotente: pode ser executada mais de uma vez.
-- Execução: Supabase → SQL Editor → colar → Run.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Colunas novas
-- ---------------------------------------------------------------------
alter table control.cobranca_config add column if not exists pix_chave  text;
alter table control.cobranca_config add column if not exists pix_nome   text;
alter table control.cobranca_config add column if not exists pix_cidade text;
alter table control.cobranca_config add column if not exists pix_ativo  boolean not null default false;

alter table control.faturas add column if not exists informado_em      timestamptz;
alter table control.faturas add column if not exists informado_por     uuid references auth.users (id) on delete set null;
alter table control.faturas add column if not exists informado_obs     text;
alter table control.faturas add column if not exists informado_recusa  text;

-- ---------------------------------------------------------------------
-- 2. Rotina diária: o aviso "Já paguei" adia a suspensão por 3 dias
--    (mesma lógica da migração 10, com essa exceção).
-- ---------------------------------------------------------------------
create or replace function control.processar_cobranca(p_hoje date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_hoje     date := coalesce(p_hoje, control.hoje());
    cfg        control.cobranca_config%rowtype;
    r          record;
    v_venc     date;
    v_voltas   integer;
    v_geradas  integer := 0;
    v_testes   integer := 0;
    v_suspensas integer := 0;
    v_atraso   integer;
    v_avisou   boolean;
begin
    select * into cfg from control.cobranca_config where id = 1;

    for r in
        select a.*, p.preco_mensal, p.nome as plano_nome, b.status as barbearia_status, b.protegida
        from control.assinaturas a
        join control.planos p on p.id = a.plano_id
        join control.barbearias b on b.id = a.barbearia_id
        where a.status in ('teste', 'ativa', 'atrasada')
          and b.status <> 'cancelada'
          and not b.protegida
        order by a.criado_em
        for update of a
    loop
        if r.status = 'teste' and r.teste_ate is not null and r.teste_ate <= v_hoje then
            update control.assinaturas set status = 'ativa' where id = r.id;
            v_testes := v_testes + 1;
        end if;

        v_venc := coalesce(r.proximo_vencimento, v_hoje);
        v_voltas := 0;
        while v_venc - cfg.dias_antecedencia <= v_hoje and v_voltas < 12 loop
            if r.preco_mensal > 0 then
                insert into control.faturas (assinatura_id, barbearia_id, plano_nome, competencia, valor, vencimento)
                values (r.id, r.barbearia_id, r.plano_nome, v_venc, r.preco_mensal, v_venc)
                on conflict (assinatura_id, competencia) do nothing;
                if found then v_geradas := v_geradas + 1; end if;
            end if;
            v_venc := (v_venc + interval '1 month')::date;
            v_voltas := v_voltas + 1;
        end loop;
        if v_venc is distinct from r.proximo_vencimento then
            update control.assinaturas set proximo_vencimento = v_venc where id = r.id;
        end if;

        perform control.atualizar_situacao(r.id, v_hoje);

        select max(v_hoje - f.vencimento) into v_atraso
        from control.faturas f
        where f.assinatura_id = r.id and f.status = 'aberta' and f.vencimento < v_hoje;

        -- Dono avisou que pagou há no máximo 3 dias: aguarda a conferência do Master.
        select exists (select 1 from control.faturas f
                       where f.assinatura_id = r.id and f.status = 'aberta' and f.vencimento < v_hoje
                         and f.informado_em is not null and f.informado_em::date >= v_hoje - 3)
        into v_avisou;

        if v_atraso >= cfg.dias_tolerancia and r.barbearia_status in ('ativa', 'teste') and not v_avisou then
            update control.barbearias set status = 'suspensa' where id = r.barbearia_id;
            update control.assinaturas set suspensa_por_inadimplencia = true where id = r.id;
            perform control.registrar_auditoria(null, 'barbearia_status', 'barbearia', r.barbearia_id::text,
                jsonb_build_object('anterior', r.barbearia_status, 'novo', 'suspensa',
                                   'motivo', format('Inadimplência: fatura vencida há %s dias', v_atraso),
                                   'automatico', true));
            v_suspensas := v_suspensas + 1;
        end if;
    end loop;

    return jsonb_build_object('data', v_hoje, 'faturas_geradas', v_geradas,
                              'testes_encerrados', v_testes, 'barbearias_suspensas', v_suspensas);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Painel da barbearia
-- ---------------------------------------------------------------------
-- Mesma assinatura da migração 10, agora com o Pix e o aviso de cada fatura.
create or replace function api.minha_assinatura(p_barbearia uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_barbearia uuid := coalesce(p_barbearia, tenant.barbearia_do_usuario());
    v_ret jsonb;
begin
    if v_barbearia is null or not tenant.pode_consultar(v_barbearia) then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;

    select jsonb_build_object(
        'barbearia', b.nome_comercial,
        'barbearia_status', b.status,
        'status', a.status,
        'plano', p.nome,
        'preco_mensal', p.preco_mensal,
        'teste_ate', a.teste_ate,
        'proximo_vencimento', a.proximo_vencimento,
        'suspensa_por_inadimplencia', a.suspensa_por_inadimplencia,
        'dias_tolerancia', (select dias_tolerancia from control.cobranca_config where id = 1),
        'pix', (select case when c.pix_ativo and c.pix_chave is not null
                            then jsonb_build_object('chave', c.pix_chave, 'nome', c.pix_nome, 'cidade', c.pix_cidade) end
                from control.cobranca_config c where c.id = 1),
        'faturas', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', f.id, 'competencia', f.competencia, 'plano', f.plano_nome, 'valor', f.valor,
                'vencimento', f.vencimento, 'status', f.status,
                'situacao', control.situacao_fatura(f.status, f.vencimento),
                'dias_atraso', case when f.status = 'aberta' and f.vencimento < control.hoje() then control.hoje() - f.vencimento else 0 end,
                'pago_em', f.pago_em, 'metodo', f.metodo,
                'informado_em', f.informado_em, 'recusa', f.informado_recusa
            ) order by f.vencimento desc)
            from (select * from control.faturas x where x.assinatura_id = a.id and x.status <> 'cancelada'
                  order by x.vencimento desc limit 24) f
        ), '[]'::jsonb)
    )
    into v_ret
    from control.assinaturas a
    join control.barbearias b on b.id = a.barbearia_id
    join control.planos p on p.id = a.plano_id
    where a.barbearia_id = v_barbearia;

    return v_ret;
end;
$$;

-- Dono avisa "Já paguei" (o Master confere e confirma).
create or replace function api.informar_pagamento(p_fatura uuid, p_observacao text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    f control.faturas%rowtype;
begin
    select * into f from control.faturas where id = p_fatura for update;
    if not found or not exists (
        select 1 from control.membros m join control.barbearias b on b.id = m.barbearia_id
        where m.user_id = auth.uid() and m.barbearia_id = f.barbearia_id and m.ativo and b.status <> 'cancelada') then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;
    if f.status <> 'aberta' then raise exception 'fatura_nao_aberta' using errcode = '22023'; end if;
    if f.informado_em is not null and f.informado_em > now() - interval '1 hour' then
        return; -- clique repetido: nada muda
    end if;
    update control.faturas set
        informado_em = now(), informado_por = auth.uid(),
        informado_obs = nullif(left(trim(coalesce(p_observacao, '')), 300), ''), informado_recusa = null
    where id = f.id;
    perform control.registrar_auditoria(auth.uid(), 'pagamento_informado', 'fatura', f.id::text,
        jsonb_build_object('barbearia', f.barbearia_id, 'valor', f.valor, 'motivo', nullif(trim(coalesce(p_observacao, '')), '')));
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Master
-- ---------------------------------------------------------------------
create or replace function control_api.config_pix()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return (select jsonb_build_object('chave', pix_chave, 'nome', pix_nome, 'cidade', pix_cidade, 'ativo', pix_ativo)
            from control.cobranca_config where id = 1);
end;
$$;

create or replace function control_api.salvar_config_pix(p_chave text, p_nome text, p_cidade text, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_chave text := nullif(trim(coalesce(p_chave, '')), '');
begin
    perform control.exigir_admin();
    if p_ativo and v_chave is null then raise exception 'chave_obrigatoria' using errcode = '22023'; end if;
    if v_chave is not null and length(v_chave) > 77 then raise exception 'chave_invalida' using errcode = '22023'; end if;
    if p_ativo and length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'nome_obrigatorio' using errcode = '22023'; end if;
    if p_ativo and length(trim(coalesce(p_cidade, ''))) < 2 then raise exception 'cidade_obrigatoria' using errcode = '22023'; end if;
    update control.cobranca_config set
        pix_chave = v_chave, pix_nome = left(nullif(trim(coalesce(p_nome, '')), ''), 25),
        pix_cidade = left(nullif(trim(coalesce(p_cidade, '')), ''), 15), pix_ativo = coalesce(p_ativo, false),
        atualizado_em = now()
    where id = 1;
    perform control.registrar_auditoria(auth.uid(), 'config_pix', 'cobranca', null,
        jsonb_build_object('ativo', coalesce(p_ativo, false)));
end;
$$;

-- Avisos de "Já paguei" ainda não conferidos.
create or replace function control_api.pagamentos_informados()
returns table (fatura_id uuid, barbearia_id uuid, barbearia text, plano text, valor numeric, vencimento date,
               informado_em timestamptz, informado_por text, observacao text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return query
    select f.id, f.barbearia_id, b.nome_comercial, f.plano_nome, f.valor, f.vencimento, f.informado_em,
           (select email::text from auth.users where id = f.informado_por), f.informado_obs
    from control.faturas f
    join control.barbearias b on b.id = f.barbearia_id
    where f.status = 'aberta' and f.informado_em is not null
    order by f.informado_em;
end;
$$;

-- Master não encontrou o Pix: o aviso volta para o dono com o motivo.
create or replace function control_api.recusar_pagamento_informado(p_fatura uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    f control.faturas%rowtype;
begin
    perform control.exigir_admin();
    if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'motivo_obrigatorio' using errcode = '22023'; end if;
    select * into f from control.faturas where id = p_fatura for update;
    if not found then raise exception 'fatura_inexistente' using errcode = 'P0002'; end if;
    if f.status <> 'aberta' or f.informado_em is null then raise exception 'sem_aviso' using errcode = '22023'; end if;
    update control.faturas set informado_em = null, informado_por = null, informado_recusa = left(trim(p_motivo), 300)
    where id = f.id;
    perform control.registrar_auditoria(auth.uid(), 'pagamento_recusado', 'fatura', f.id::text,
        jsonb_build_object('barbearia', f.barbearia_id, 'valor', f.valor, 'motivo', p_motivo));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Permissões
-- ---------------------------------------------------------------------
revoke all on function api.informar_pagamento(uuid, text) from public, anon;
revoke all on function control_api.config_pix() from public, anon;
revoke all on function control_api.salvar_config_pix(text, text, text, boolean) from public, anon;
revoke all on function control_api.pagamentos_informados() from public, anon;
revoke all on function control_api.recusar_pagamento_informado(uuid, text) from public, anon;
grant execute on function api.informar_pagamento(uuid, text) to authenticated;
grant execute on function control_api.config_pix() to authenticated;
grant execute on function control_api.salvar_config_pix(text, text, text, boolean) to authenticated;
grant execute on function control_api.pagamentos_informados() to authenticated;
grant execute on function control_api.recusar_pagamento_informado(uuid, text) to authenticated;

commit;
