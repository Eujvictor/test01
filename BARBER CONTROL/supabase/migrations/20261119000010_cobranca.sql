-- =====================================================================
-- BARBER CONTROL — Migração 10: cobrança das barbearias (Mercado Pago)
-- Módulos: 03 Assinaturas e planos · 04 Financeiro ·
--          painel da barbearia ("Minha assinatura")
--
-- Regras aprovadas (19/11/2026):
--   * Fatura mensal paga por Pix, cartão ou boleto (Checkout do Mercado Pago).
--   * Planos iniciais: Basic R$ 79,90 · Professional R$ 149,90 ·
--     Premium R$ 249,90 (editáveis no Barber Control).
--   * Fatura vencida há 7 dias: a barbearia é suspensa automaticamente e
--     volta sozinha quando o pagamento é confirmado.
--   * A Navalha de Ouro (barbearia de referência) é isenta e nunca é suspensa.
--
-- O que esta migração faz:
--   * Cria as tabelas control.planos, control.assinaturas, control.faturas
--     e control.cobranca_config (schema privado control, sem acesso pela API).
--   * Cria a assinatura de cada barbearia já cadastrada (Navalha: isenta;
--     demais: em teste no plano Basic) e, por gatilho, das próximas.
--   * Cria a rotina diária control.processar_cobranca() e tenta agendá-la
--     no pg_cron (se a extensão não estiver disponível, nada quebra: a
--     rotina pode ser executada pelo botão no Barber Control).
--   * Cria funções do Master (control_api), do painel da barbearia (api) e
--     das Edge Functions (somente service_role).
--
-- O que esta migração NÃO faz:
--   * Não altera nem apaga tabelas ou registros existentes.
--   * Não guarda nenhuma chave do Mercado Pago (elas ficam nos Secrets das
--     Edge Functions).
--
-- Idempotente: pode ser executada mais de uma vez.
-- Execução: Supabase → SQL Editor → colar → Run.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table if not exists control.cobranca_config (
    id                 integer primary key default 1 check (id = 1),
    dias_tolerancia    integer not null default 7 check (dias_tolerancia between 1 and 60),
    dias_antecedencia  integer not null default 5 check (dias_antecedencia between 0 and 28),
    atualizado_em      timestamptz not null default now()
);
insert into control.cobranca_config (id) values (1) on conflict (id) do nothing;

create table if not exists control.planos (
    id            uuid primary key default gen_random_uuid(),
    codigo        text not null unique check (codigo ~ '^[a-z0-9-]{2,40}$'),
    nome          text not null check (length(trim(nome)) > 0),
    descricao     text,
    preco_mensal  numeric(10, 2) not null check (preco_mensal >= 0),
    dias_teste    integer not null default 14 check (dias_teste between 0 and 90),
    ordem         integer not null default 0,
    ativo         boolean not null default true,
    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create table if not exists control.assinaturas (
    id                          uuid primary key default gen_random_uuid(),
    barbearia_id                uuid not null unique references control.barbearias (id) on delete restrict,
    plano_id                    uuid not null references control.planos (id) on delete restrict,
    status                      text not null default 'teste'
                                check (status in ('teste', 'ativa', 'atrasada', 'cancelada', 'isenta')),
    teste_ate                   date,
    proximo_vencimento          date,
    suspensa_por_inadimplencia  boolean not null default false,
    criado_em                   timestamptz not null default now(),
    atualizado_em               timestamptz not null default now()
);

create table if not exists control.faturas (
    id                  uuid primary key default gen_random_uuid(),
    assinatura_id       uuid not null references control.assinaturas (id) on delete restrict,
    barbearia_id        uuid not null references control.barbearias (id) on delete restrict,
    plano_nome          text not null,
    competencia         date not null,
    valor               numeric(10, 2) not null check (valor >= 0),
    vencimento          date not null,
    status              text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
    mp_preferencia_id   text,
    mp_link             text,
    mp_pagamento_id     text unique,
    metodo              text,
    valor_pago          numeric(10, 2),
    taxa                numeric(10, 2),
    pago_em             timestamptz,
    observacao          text,
    criado_em           timestamptz not null default now(),
    atualizado_em       timestamptz not null default now(),
    unique (assinatura_id, competencia)
);
create index if not exists faturas_barbearia_idx on control.faturas (barbearia_id, vencimento desc);
create index if not exists faturas_abertas_idx on control.faturas (vencimento) where status = 'aberta';

alter table control.cobranca_config enable row level security;
alter table control.planos          enable row level security;
alter table control.assinaturas     enable row level security;
alter table control.faturas         enable row level security;
revoke all on control.cobranca_config, control.planos, control.assinaturas, control.faturas
    from public, anon, authenticated;

drop trigger if exists planos_atualizado_em on control.planos;
create trigger planos_atualizado_em before update on control.planos
    for each row execute function control.tocar_atualizado_em();
drop trigger if exists assinaturas_atualizado_em on control.assinaturas;
create trigger assinaturas_atualizado_em before update on control.assinaturas
    for each row execute function control.tocar_atualizado_em();
drop trigger if exists faturas_atualizado_em on control.faturas;
create trigger faturas_atualizado_em before update on control.faturas
    for each row execute function control.tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- 2. Planos iniciais e assinaturas das barbearias existentes
-- ---------------------------------------------------------------------
insert into control.planos (codigo, nome, descricao, preco_mensal, dias_teste, ordem) values
    ('basic',        'Basic',        'Para barbearias com até 3 profissionais.',                   79.90, 14, 1),
    ('professional', 'Professional', 'Equipes em crescimento com relatórios e site próprio.',     149.90, 14, 2),
    ('premium',      'Premium',      'Recursos completos e suporte prioritário.',                 249.90, 30, 3)
on conflict (codigo) do nothing;

-- "Hoje" no fuso de Brasília (o banco do Supabase roda em UTC).
create or replace function control.hoje()
returns date
language sql
stable
set search_path = ''
as $$
    select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function control.plano_padrao()
returns uuid
language sql
stable
set search_path = ''
as $$
    select id from control.planos where ativo order by ordem, preco_mensal limit 1;
$$;

-- Toda barbearia nova ganha a assinatura: em teste no plano padrão
-- (a barbearia de referência fica isenta).
create or replace function control.criar_assinatura()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_plano uuid := control.plano_padrao();
    v_dias  integer;
begin
    if v_plano is null then
        return new;
    end if;
    select dias_teste into v_dias from control.planos where id = v_plano;
    insert into control.assinaturas (barbearia_id, plano_id, status, teste_ate, proximo_vencimento)
    values (new.id, v_plano,
            case when new.protegida then 'isenta' else 'teste' end,
            case when new.protegida then null else control.hoje() + v_dias end,
            case when new.protegida then null else control.hoje() + v_dias end)
    on conflict (barbearia_id) do nothing;
    return new;
end;
$$;

drop trigger if exists barbearias_assinatura on control.barbearias;
create trigger barbearias_assinatura after insert on control.barbearias
    for each row execute function control.criar_assinatura();

insert into control.assinaturas (barbearia_id, plano_id, status, teste_ate, proximo_vencimento)
select b.id, control.plano_padrao(),
       case when b.protegida then 'isenta' else 'teste' end,
       case when b.protegida then null else greatest(b.criado_em::date + p.dias_teste, control.hoje()) end,
       case when b.protegida then null else greatest(b.criado_em::date + p.dias_teste, control.hoje()) end
from control.barbearias b
cross join (select dias_teste from control.planos where id = control.plano_padrao()) p
on conflict (barbearia_id) do nothing;

-- ---------------------------------------------------------------------
-- 3. Regras de cobrança (funções internas)
-- ---------------------------------------------------------------------
-- Recalcula a situação da assinatura e, se não houver mais fatura vencida,
-- reativa a barbearia que tinha sido suspensa por inadimplência.
create or replace function control.atualizar_situacao(p_assinatura uuid, p_hoje date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_hoje    date := coalesce(p_hoje, control.hoje());
    a         control.assinaturas%rowtype;
    v_vencida boolean;
    v_status  text;
begin
    select * into a from control.assinaturas where id = p_assinatura for update;
    if not found or a.status in ('cancelada', 'isenta') then
        return;
    end if;

    select exists (select 1 from control.faturas f
                   where f.assinatura_id = a.id and f.status = 'aberta' and f.vencimento < v_hoje)
    into v_vencida;

    if v_vencida then
        update control.assinaturas set status = 'atrasada' where id = a.id and status <> 'atrasada';
        return;
    end if;

    if a.status = 'atrasada' then
        update control.assinaturas set status = 'ativa' where id = a.id;
    end if;

    if a.suspensa_por_inadimplencia then
        select status into v_status from control.barbearias where id = a.barbearia_id;
        update control.assinaturas set suspensa_por_inadimplencia = false where id = a.id;
        if v_status = 'suspensa' then
            update control.barbearias set status = 'ativa' where id = a.barbearia_id;
            perform control.registrar_auditoria(null, 'barbearia_status', 'barbearia', a.barbearia_id::text,
                jsonb_build_object('anterior', 'suspensa', 'novo', 'ativa',
                                   'motivo', 'Pagamento confirmado: reativação automática', 'automatico', true));
        end if;
    end if;
end;
$$;

-- Rotina diária: gera faturas, encerra testes, marca atrasos e suspende.
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
        -- Fim do período de teste: passa a ser assinatura ativa.
        if r.status = 'teste' and r.teste_ate is not null and r.teste_ate <= v_hoje then
            update control.assinaturas set status = 'ativa' where id = r.id;
            v_testes := v_testes + 1;
        end if;

        -- Faturas: geradas "dias_antecedencia" antes do vencimento.
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

        -- Suspensão automática: fatura em aberto vencida há "dias_tolerancia" dias.
        select max(v_hoje - f.vencimento) into v_atraso
        from control.faturas f
        where f.assinatura_id = r.id and f.status = 'aberta' and f.vencimento < v_hoje;

        if v_atraso >= cfg.dias_tolerancia and r.barbearia_status in ('ativa', 'teste') then
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

-- Registra o pagamento de uma fatura (Mercado Pago ou manual).
-- Idempotente: o mesmo pagamento informado duas vezes não duplica nada.
create or replace function control.registrar_pagamento(
    p_fatura       uuid,
    p_valor        numeric,
    p_metodo       text,
    p_pagamento_id text default null,
    p_taxa         numeric default null,
    p_origem       text default 'mercado_pago',
    p_ator         uuid default null,
    p_observacao   text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    f control.faturas%rowtype;
begin
    select * into f from control.faturas where id = p_fatura for update;
    if not found then
        raise exception 'fatura_inexistente' using errcode = 'P0002';
    end if;
    if f.status = 'paga' then
        return 'ja_paga';
    end if;
    if f.status = 'cancelada' then
        return 'fatura_cancelada';
    end if;
    if p_valor is null or p_valor + 0.01 < f.valor then
        return 'valor_insuficiente';
    end if;

    update control.faturas set
        status = 'paga', valor_pago = p_valor, metodo = left(p_metodo, 40), taxa = p_taxa,
        mp_pagamento_id = coalesce(p_pagamento_id, mp_pagamento_id), pago_em = now(),
        observacao = coalesce(left(p_observacao, 300), observacao)
    where id = f.id;

    perform control.registrar_auditoria(p_ator, 'fatura_paga', 'fatura', f.id::text,
        jsonb_build_object('barbearia', f.barbearia_id, 'valor', p_valor, 'metodo', p_metodo,
                           'origem', p_origem, 'pagamento', p_pagamento_id, 'motivo', p_observacao));
    perform control.atualizar_situacao(f.assinatura_id);
    return 'paga';
end;
$$;

-- Situação de exibição de uma fatura.
create or replace function control.situacao_fatura(p_status text, p_vencimento date)
returns text
language sql
stable
set search_path = ''
as $$
    select case when p_status = 'aberta' and p_vencimento < control.hoje() then 'vencida' else p_status end;
$$;

-- ---------------------------------------------------------------------
-- 4. Agendamento diário (pg_cron), se disponível
-- ---------------------------------------------------------------------
do $$
begin
    begin
        create extension if not exists pg_cron;
    exception when others then
        raise notice 'pg_cron indisponível: use o botão "Executar rotina" no Barber Control.';
        return;
    end;
    begin
        perform cron.unschedule('barber-cobranca-diaria');
    exception when others then null;
    end;
    -- 09:00 UTC = 06:00 em Brasília.
    perform cron.schedule('barber-cobranca-diaria', '0 9 * * *', 'select control.processar_cobranca()');
exception when others then
    raise notice 'Não foi possível agendar a rotina diária: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Funções do Master (control_api) — administrador + MFA
-- ---------------------------------------------------------------------
create or replace function control_api.listar_planos()
returns table (id uuid, codigo text, nome text, descricao text, preco_mensal numeric, dias_teste integer,
               ordem integer, ativo boolean, assinaturas bigint, atualizado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return query
    select p.id, p.codigo, p.nome, p.descricao, p.preco_mensal, p.dias_teste, p.ordem, p.ativo,
           (select count(*) from control.assinaturas a where a.plano_id = p.id and a.status <> 'cancelada'),
           p.atualizado_em
    from control.planos p
    order by p.ordem, p.preco_mensal;
end;
$$;

create or replace function control_api.salvar_plano(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id     uuid := p_id;
    v_nome   text := trim(coalesce(p_dados ->> 'nome', ''));
    v_codigo text := lower(trim(coalesce(p_dados ->> 'codigo', '')));
    v_preco  numeric := (p_dados ->> 'preco_mensal')::numeric;
    v_dias   integer := coalesce((p_dados ->> 'dias_teste')::integer, 14);
begin
    perform control.exigir_admin();
    if v_nome = '' then raise exception 'nome_obrigatorio' using errcode = '22023'; end if;
    if v_preco is null or v_preco < 0 or v_preco > 100000 then raise exception 'preco_invalido' using errcode = '22023'; end if;
    if v_dias < 0 or v_dias > 90 then raise exception 'dias_teste_invalido' using errcode = '22023'; end if;

    if v_id is null then
        if v_codigo !~ '^[a-z0-9-]{2,40}$' then raise exception 'codigo_invalido' using errcode = '22023'; end if;
        if exists (select 1 from control.planos where codigo = v_codigo) then raise exception 'codigo_em_uso' using errcode = '23505'; end if;
        insert into control.planos (codigo, nome, descricao, preco_mensal, dias_teste, ordem, ativo)
        values (v_codigo, v_nome, nullif(trim(p_dados ->> 'descricao'), ''), v_preco, v_dias,
                coalesce((p_dados ->> 'ordem')::integer, (select coalesce(max(ordem), 0) + 1 from control.planos)),
                coalesce((p_dados ->> 'ativo')::boolean, true))
        returning id into v_id;
    else
        update control.planos set
            nome = v_nome, descricao = nullif(trim(p_dados ->> 'descricao'), ''),
            preco_mensal = v_preco, dias_teste = v_dias,
            ordem = coalesce((p_dados ->> 'ordem')::integer, ordem),
            ativo = coalesce((p_dados ->> 'ativo')::boolean, ativo)
        where id = v_id;
        if not found then raise exception 'plano_inexistente' using errcode = 'P0002'; end if;
    end if;

    perform control.registrar_auditoria(auth.uid(), 'plano_salvo', 'plano', v_id::text,
        jsonb_build_object('nome', v_nome, 'preco_mensal', v_preco, 'dias_teste', v_dias, 'novo', p_id is null));
    return v_id;
end;
$$;

create or replace function control_api.listar_assinaturas()
returns table (
    barbearia_id uuid, barbearia text, slug text, barbearia_status text, protegida boolean,
    assinatura_id uuid, status text, plano_id uuid, plano text, preco_mensal numeric,
    teste_ate date, proximo_vencimento date, suspensa_por_inadimplencia boolean,
    faturas_abertas bigint, valor_em_aberto numeric, dias_atraso integer, ultimo_pagamento timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return query
    select b.id, b.nome_comercial, b.codigo, b.status, b.protegida,
           a.id, a.status, p.id, p.nome, p.preco_mensal,
           a.teste_ate, a.proximo_vencimento, a.suspensa_por_inadimplencia,
           (select count(*) from control.faturas f where f.assinatura_id = a.id and f.status = 'aberta'),
           (select coalesce(sum(f.valor), 0) from control.faturas f where f.assinatura_id = a.id and f.status = 'aberta'),
           (select max(control.hoje() - f.vencimento) from control.faturas f
             where f.assinatura_id = a.id and f.status = 'aberta' and f.vencimento < control.hoje()),
           (select max(f.pago_em) from control.faturas f where f.assinatura_id = a.id and f.status = 'paga')
    from control.assinaturas a
    join control.barbearias b on b.id = a.barbearia_id
    join control.planos p on p.id = a.plano_id
    order by b.nome_comercial;
end;
$$;

-- Altera plano, período de teste ou situação (isenta/cancelada/reativar).
create or replace function control_api.alterar_assinatura(p_barbearia uuid, p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    a        control.assinaturas%rowtype;
    v_plano  uuid := nullif(p_dados ->> 'plano_id', '')::uuid;
    v_status text := nullif(p_dados ->> 'status', '');
    v_teste  date := nullif(p_dados ->> 'teste_ate', '')::date;
begin
    perform control.exigir_admin();
    select * into a from control.assinaturas where barbearia_id = p_barbearia for update;
    if not found then raise exception 'assinatura_inexistente' using errcode = 'P0002'; end if;
    if v_plano is not null and not exists (select 1 from control.planos where id = v_plano) then
        raise exception 'plano_inexistente' using errcode = 'P0002';
    end if;
    if v_status is not null and v_status not in ('teste', 'ativa', 'cancelada', 'isenta') then
        raise exception 'status_invalido' using errcode = '22023';
    end if;
    if v_status = 'teste' and v_teste is null then
        raise exception 'teste_sem_data' using errcode = '22023';
    end if;

    update control.assinaturas set
        plano_id = coalesce(v_plano, plano_id),
        status = coalesce(v_status, status),
        teste_ate = case when v_status = 'teste' or (v_teste is not null and status = 'teste') then v_teste else teste_ate end,
        proximo_vencimento = case
            when v_status = 'teste' or (v_teste is not null and status = 'teste') then v_teste
            when v_status = 'ativa' and a.status in ('cancelada', 'isenta') then control.hoje()
            else proximo_vencimento end
    where id = a.id;

    -- Cancelada ou isenta: as faturas em aberto deixam de valer.
    if v_status in ('cancelada', 'isenta') then
        update control.faturas set status = 'cancelada', observacao = 'Assinatura ' || v_status
        where assinatura_id = a.id and status = 'aberta';
        update control.assinaturas set suspensa_por_inadimplencia = false where id = a.id;
    else
        perform control.atualizar_situacao(a.id);
    end if;

    perform control.registrar_auditoria(auth.uid(), 'assinatura_alterada', 'barbearia', p_barbearia::text,
        jsonb_build_object('anterior', a.status, 'novo', coalesce(v_status, a.status),
                           'plano', v_plano, 'teste_ate', v_teste, 'motivo', p_dados ->> 'motivo'));
end;
$$;

create or replace function control_api.listar_faturas(
    p_barbearia uuid    default null,
    p_situacao  text    default null,
    p_desde     date    default null,
    p_ate       date    default null,
    p_limite    integer default 500
)
returns table (
    id uuid, barbearia_id uuid, barbearia text, plano text, competencia date, valor numeric,
    vencimento date, status text, situacao text, dias_atraso integer, metodo text, valor_pago numeric,
    taxa numeric, pago_em timestamptz, mp_pagamento_id text, tem_link boolean, observacao text, criado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return query
    select f.id, f.barbearia_id, b.nome_comercial, f.plano_nome, f.competencia, f.valor, f.vencimento, f.status,
           control.situacao_fatura(f.status, f.vencimento),
           case when f.status = 'aberta' and f.vencimento < control.hoje() then control.hoje() - f.vencimento else 0 end,
           f.metodo, f.valor_pago, f.taxa, f.pago_em, f.mp_pagamento_id, f.mp_link is not null, f.observacao, f.criado_em
    from control.faturas f
    join control.barbearias b on b.id = f.barbearia_id
    where (p_barbearia is null or f.barbearia_id = p_barbearia)
      and (p_desde is null or f.vencimento >= p_desde)
      and (p_ate is null or f.vencimento <= p_ate)
      and (p_situacao is null or p_situacao = '' or control.situacao_fatura(f.status, f.vencimento) = p_situacao)
    order by f.vencimento desc, b.nome_comercial
    limit least(greatest(coalesce(p_limite, 500), 1), 2000);
end;
$$;

create or replace function control_api.financeiro_resumo(p_meses integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_meses  integer := least(greatest(coalesce(p_meses, 12), 1), 36);
    v_hoje   date := control.hoje();
    v_inicio date := (date_trunc('month', v_hoje) - make_interval(months => v_meses - 1))::date;
    v_ret    jsonb;
begin
    perform control.exigir_admin();
    select jsonb_build_object(
        'mrr', (select coalesce(sum(p.preco_mensal), 0) from control.assinaturas a join control.planos p on p.id = a.plano_id
                where a.status in ('ativa', 'atrasada')),
        'assinaturas', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                        from (select status, count(*) n from control.assinaturas group by status) t),
        'em_aberto', (select coalesce(sum(valor), 0) from control.faturas where status = 'aberta' and vencimento >= v_hoje),
        'vencido',   (select coalesce(sum(valor), 0) from control.faturas where status = 'aberta' and vencimento < v_hoje),
        'faturas_vencidas', (select count(*) from control.faturas where status = 'aberta' and vencimento < v_hoje),
        'recebido_mes', (select coalesce(sum(valor_pago), 0) from control.faturas
                         where status = 'paga' and pago_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo')),
        'taxas_mes', (select coalesce(sum(taxa), 0) from control.faturas
                      where status = 'paga' and pago_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo')),
        'por_mes', (select coalesce(jsonb_agg(jsonb_build_object(
                        'mes', to_char(m.mes, 'YYYY-MM'),
                        'recebido', coalesce((select sum(valor_pago) from control.faturas f
                                              where f.status = 'paga' and date_trunc('month', f.pago_em at time zone 'America/Sao_Paulo')::date = m.mes::date), 0),
                        'taxas', coalesce((select sum(taxa) from control.faturas f
                                           where f.status = 'paga' and date_trunc('month', f.pago_em at time zone 'America/Sao_Paulo')::date = m.mes::date), 0),
                        'faturado', coalesce((select sum(valor) from control.faturas f
                                              where f.status <> 'cancelada' and date_trunc('month', f.vencimento)::date = m.mes::date), 0)
                    ) order by m.mes), '[]'::jsonb)
                    from generate_series(v_inicio, date_trunc('month', v_hoje), interval '1 month') m(mes)),
        'por_plano', (select coalesce(jsonb_agg(jsonb_build_object('plano', p.nome, 'assinaturas', t.n, 'mrr', t.mrr) order by t.mrr desc), '[]'::jsonb)
                      from (select a.plano_id, count(*) n,
                                   sum(case when a.status in ('ativa', 'atrasada') then pl.preco_mensal else 0 end) mrr
                            from control.assinaturas a join control.planos pl on pl.id = a.plano_id
                            where a.status not in ('cancelada', 'isenta') group by a.plano_id) t
                      join control.planos p on p.id = t.plano_id),
        'por_metodo', (select coalesce(jsonb_object_agg(coalesce(metodo, 'outro'), n), '{}'::jsonb)
                       from (select metodo, count(*) n from control.faturas where status = 'paga' group by metodo) t),
        'config', (select jsonb_build_object('dias_tolerancia', dias_tolerancia, 'dias_antecedencia', dias_antecedencia)
                   from control.cobranca_config where id = 1),
        'rotina_agendada', (select exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron')),
        'gerado_em', now()
    )
    into v_ret;
    return v_ret;
end;
$$;

create or replace function control_api.marcar_fatura_paga(p_fatura uuid, p_metodo text, p_observacao text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_valor numeric;
begin
    perform control.exigir_admin();
    if coalesce(p_metodo, '') not in ('pix', 'dinheiro', 'transferencia', 'cartao', 'boleto', 'outro') then
        raise exception 'metodo_invalido' using errcode = '22023';
    end if;
    select valor into v_valor from control.faturas where id = p_fatura;
    if v_valor is null then raise exception 'fatura_inexistente' using errcode = 'P0002'; end if;
    return control.registrar_pagamento(p_fatura, v_valor, p_metodo, null, 0, 'manual', auth.uid(),
                                       coalesce(nullif(trim(p_observacao), ''), 'Baixa manual no Barber Control'));
end;
$$;

create or replace function control_api.cancelar_fatura(p_fatura uuid, p_motivo text)
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
    if f.status <> 'aberta' then raise exception 'fatura_nao_aberta' using errcode = '22023'; end if;
    update control.faturas set status = 'cancelada', observacao = left(p_motivo, 300) where id = f.id;
    perform control.registrar_auditoria(auth.uid(), 'fatura_cancelada', 'fatura', f.id::text,
        jsonb_build_object('barbearia', f.barbearia_id, 'valor', f.valor, 'motivo', p_motivo));
    perform control.atualizar_situacao(f.assinatura_id);
end;
$$;

create or replace function control_api.executar_rotina_cobranca()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_ret jsonb;
begin
    perform control.exigir_admin();
    v_ret := control.processar_cobranca();
    perform control.registrar_auditoria(auth.uid(), 'rotina_cobranca', 'cobranca', null, v_ret);
    return v_ret;
end;
$$;

create or replace function control_api.salvar_config_cobranca(p_dias_tolerancia integer, p_dias_antecedencia integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    update control.cobranca_config set
        dias_tolerancia = p_dias_tolerancia, dias_antecedencia = p_dias_antecedencia, atualizado_em = now()
    where id = 1;
    perform control.registrar_auditoria(auth.uid(), 'config_cobranca', 'cobranca', null,
        jsonb_build_object('dias_tolerancia', p_dias_tolerancia, 'dias_antecedencia', p_dias_antecedencia));
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Painel da barbearia (api) — dono ou gerente, inclusive suspensa
-- ---------------------------------------------------------------------
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
        'faturas', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', f.id, 'competencia', f.competencia, 'plano', f.plano_nome, 'valor', f.valor,
                'vencimento', f.vencimento, 'status', f.status,
                'situacao', control.situacao_fatura(f.status, f.vencimento),
                'dias_atraso', case when f.status = 'aberta' and f.vencimento < control.hoje() then control.hoje() - f.vencimento else 0 end,
                'pago_em', f.pago_em, 'metodo', f.metodo
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

-- Dados da fatura para a Edge Function criar o pagamento. Chamada COM o
-- token do dono: só funciona para faturas em aberto da barbearia dele.
create or replace function api.fatura_para_pagamento(p_fatura uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_ret jsonb;
    v_barbearia uuid;
begin
    select barbearia_id into v_barbearia from control.faturas where id = p_fatura;
    if v_barbearia is null or not tenant.pode_consultar(v_barbearia) then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;
    select jsonb_build_object('id', f.id, 'valor', f.valor, 'status', f.status, 'vencimento', f.vencimento,
                              'competencia', f.competencia, 'plano', f.plano_nome, 'barbearia', b.nome_comercial,
                              'barbearia_id', b.id, 'email', (select email from auth.users where id = auth.uid()))
    into v_ret
    from control.faturas f join control.barbearias b on b.id = f.barbearia_id
    where f.id = p_fatura;
    if v_ret ->> 'status' <> 'aberta' then
        raise exception 'fatura_nao_aberta' using errcode = '22023';
    end if;
    return v_ret;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Funções exclusivas das Edge Functions (service_role)
-- ---------------------------------------------------------------------
create or replace function control_api.salvar_preferencia_mp(p_fatura uuid, p_preferencia text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
    update control.faturas set mp_preferencia_id = left(p_preferencia, 120), mp_link = left(p_link, 500)
    where id = p_fatura and status = 'aberta';
$$;

create or replace function control_api.registrar_pagamento_mp(
    p_fatura uuid, p_valor numeric, p_metodo text, p_pagamento_id text, p_taxa numeric
)
returns text
language sql
security definer
set search_path = ''
as $$
    select control.registrar_pagamento(p_fatura, p_valor, p_metodo, p_pagamento_id, p_taxa, 'mercado_pago', null, null);
$$;

-- ---------------------------------------------------------------------
-- 8. Permissões
-- ---------------------------------------------------------------------
revoke all on function control.hoje() from public, anon, authenticated;
revoke all on function control.plano_padrao() from public, anon, authenticated;
revoke all on function control.criar_assinatura() from public, anon, authenticated;
revoke all on function control.atualizar_situacao(uuid, date) from public, anon, authenticated;
revoke all on function control.processar_cobranca(date) from public, anon, authenticated;
revoke all on function control.registrar_pagamento(uuid, numeric, text, text, numeric, text, uuid, text) from public, anon, authenticated;
revoke all on function control.situacao_fatura(text, date) from public, anon, authenticated;

revoke all on function control_api.listar_planos() from public, anon;
revoke all on function control_api.salvar_plano(uuid, jsonb) from public, anon;
revoke all on function control_api.listar_assinaturas() from public, anon;
revoke all on function control_api.alterar_assinatura(uuid, jsonb) from public, anon;
revoke all on function control_api.listar_faturas(uuid, text, date, date, integer) from public, anon;
revoke all on function control_api.financeiro_resumo(integer) from public, anon;
revoke all on function control_api.marcar_fatura_paga(uuid, text, text) from public, anon;
revoke all on function control_api.cancelar_fatura(uuid, text) from public, anon;
revoke all on function control_api.executar_rotina_cobranca() from public, anon;
revoke all on function control_api.salvar_config_cobranca(integer, integer) from public, anon;
revoke all on function control_api.salvar_preferencia_mp(uuid, text, text) from public, anon, authenticated;
revoke all on function control_api.registrar_pagamento_mp(uuid, numeric, text, text, numeric) from public, anon, authenticated;
revoke all on function api.minha_assinatura(uuid) from public, anon;
revoke all on function api.fatura_para_pagamento(uuid) from public, anon;

grant execute on function control_api.listar_planos() to authenticated;
grant execute on function control_api.salvar_plano(uuid, jsonb) to authenticated;
grant execute on function control_api.listar_assinaturas() to authenticated;
grant execute on function control_api.alterar_assinatura(uuid, jsonb) to authenticated;
grant execute on function control_api.listar_faturas(uuid, text, date, date, integer) to authenticated;
grant execute on function control_api.financeiro_resumo(integer) to authenticated;
grant execute on function control_api.marcar_fatura_paga(uuid, text, text) to authenticated;
grant execute on function control_api.cancelar_fatura(uuid, text) to authenticated;
grant execute on function control_api.executar_rotina_cobranca() to authenticated;
grant execute on function control_api.salvar_config_cobranca(integer, integer) to authenticated;
grant execute on function control_api.salvar_preferencia_mp(uuid, text, text) to service_role;
grant execute on function control_api.registrar_pagamento_mp(uuid, numeric, text, text, numeric) to service_role;
grant execute on function api.minha_assinatura(uuid) to authenticated;
grant execute on function api.fatura_para_pagamento(uuid) to authenticated;

commit;
