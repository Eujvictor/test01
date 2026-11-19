-- =====================================================================
-- BARBER CONTROL — Migração 09: leitura real para o painel Master
-- Módulos: 01 Visão geral · 06 Agendamentos e atividade ·
--          05 Usuários · 20 Auditoria e acessos
--
-- O que esta migração faz:
--   * Cria funções SOMENTE DE LEITURA no schema control_api.
--   * Atualiza control_api.painel_resumo() (mesma assinatura) para somar
--     todas as barbearias e trazer o resumo de cada uma.
--   * Cria um índice em agendamentos (barbearia_id, data) para as
--     consultas por período.
--
-- O que esta migração NÃO faz:
--   * Não cria, altera nem apaga tabelas ou colunas.
--   * Não altera nem apaga nenhum registro.
--   * Não expõe telefone de clientes nem de barbeiros.
--
-- Segurança: toda função chama control.exigir_admin() (administrador
-- ativo + verificação em duas etapas) e só é executável pelo papel
-- authenticated. Visitantes (anon) não têm acesso.
--
-- Idempotente: pode ser executada mais de uma vez.
-- Execução: Supabase → SQL Editor → colar → Run.
-- =====================================================================

begin;

create index if not exists agendamentos_barbearia_data_idx
    on public.agendamentos (barbearia_id, data);

-- Preço guardado como número ou texto ("30", "30,00", "R$ 30"): converte
-- sem gerar erro; valor ilegível vira NULL.
create or replace function control.numero_seguro(p_valor text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
    v text := regexp_replace(coalesce(p_valor, ''), '[^0-9,.-]', '', 'g');
begin
    if v = '' then return null; end if;
    if v like '%,%' then v := replace(replace(v, '.', ''), ',', '.'); end if;
    return v::numeric;
exception when others then
    return null;
end;
$$;

-- Agendamentos que contam como cancelados (cancelado, cancelada...).
create or replace function control.status_cancelado(p_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select lower(coalesce(p_status, '')) like 'cancel%';
$$;

-- ---------------------------------------------------------------------
-- 01 · VISÃO GERAL — totais da plataforma e resumo por barbearia
-- ---------------------------------------------------------------------
create or replace function control_api.painel_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_inicio_mes date := date_trunc('month', current_date)::date;
    v_fim_mes    date := (date_trunc('month', current_date) + interval '1 month')::date;
    v_plataforma jsonb;
    v_barber     jsonb;
    v_lista      jsonb;
begin
    perform control.exigir_admin();

    select jsonb_build_object(
        'total',         count(*),
        'ativas',        count(*) filter (where b.status = 'ativa'),
        'teste',         count(*) filter (where b.status = 'teste'),
        'suspensas',     count(*) filter (where b.status = 'suspensa'),
        'canceladas',    count(*) filter (where b.status = 'cancelada'),
        'proprietarios', (select count(distinct m.user_id) from control.membros m
                          where m.ativo and m.papel = 'proprietario')
    )
    into v_plataforma
    from control.barbearias b;

    select jsonb_build_object(
        'barbeiros',         (select count(*) from public."BARBEIROS" where coalesce(ativo, true)),
        'clientes',          (select count(*) from public.clientes),
        'agendamentos_mes',  (select count(*) from public.agendamentos
                              where data >= v_inicio_mes and data < v_fim_mes),
        'cancelamentos_mes', (select count(*) from public.agendamentos
                              where data >= v_inicio_mes and data < v_fim_mes
                                and control.status_cancelado(status)),
        'agendamentos_hoje', (select count(*) from public.agendamentos
                              where data = current_date and not control.status_cancelado(status))
    )
    into v_barber;

    select coalesce(jsonb_agg(x order by x.agendamentos_mes desc, x.nome), '[]'::jsonb)
    into v_lista
    from (
        select b.id, b.nome_comercial as nome, b.codigo as slug, b.status,
               (select count(*) from public."BARBEIROS" br
                 where br.barbearia_id = b.id and coalesce(br.ativo, true)) as barbeiros,
               (select count(*) from public.clientes c where c.barbearia_id = b.id) as clientes,
               (select count(*) from public.agendamentos a
                 where a.barbearia_id = b.id and a.data >= v_inicio_mes and a.data < v_fim_mes) as agendamentos_mes,
               (select count(*) from public.agendamentos a
                 where a.barbearia_id = b.id and a.data >= v_inicio_mes and a.data < v_fim_mes
                   and control.status_cancelado(a.status)) as cancelamentos_mes,
               (select max(a.created_at) from public.agendamentos a where a.barbearia_id = b.id) as ultimo_agendamento
        from control.barbearias b
    ) x;

    return jsonb_build_object(
        'plataforma',    v_plataforma,
        'barber',        v_barber,
        'por_barbearia', v_lista,
        'gerado_em',     now()
    );
end;
$$;

-- ---------------------------------------------------------------------
-- 06 · AGENDAMENTOS E ATIVIDADE
-- ---------------------------------------------------------------------
-- Indicadores do período: últimos p_dias até hoje (pela data do horário).
create or replace function control_api.atividade_resumo(
    p_dias      integer default 30,
    p_barbearia uuid    default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_dias  integer := least(greatest(coalesce(p_dias, 30), 1), 366);
    v_desde date;
    v_ret   jsonb;
begin
    perform control.exigir_admin();
    v_desde := current_date - (v_dias - 1);

    with base as (
        select a.id, a.barbearia_id, a.data, a.horario, lower(coalesce(a.status, 'sem_status')) as status,
               s.nome as servico, control.numero_seguro(s."preço"::text) as preco
        from public.agendamentos a
        left join public."SERVIÇOS" s on s.id = a.servico_id
        where a.data between v_desde and current_date
          and (p_barbearia is null or a.barbearia_id = p_barbearia)
    )
    select jsonb_build_object(
        'desde', v_desde,
        'ate',   current_date,
        'dias',  v_dias,
        'total', (select count(*) from base),
        'finalizados', (select count(*) from base where status in ('finalizado', 'concluido', 'realizado')),
        'cancelados',  (select count(*) from base where control.status_cancelado(status)),
        'nao_compareceu', (select count(*) from base where status = 'nao_compareceu'),
        'receita_estimada', (select coalesce(sum(preco), 0) from base
                             where status in ('finalizado', 'concluido', 'realizado')),
        'proximos_7_dias', (select count(*) from public.agendamentos a
                            where a.data > current_date and a.data <= current_date + 7
                              and not control.status_cancelado(a.status)
                              and (p_barbearia is null or a.barbearia_id = p_barbearia)),
        'por_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                       from (select status, count(*) n from base group by status) t),
        'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'total', coalesce(t.n, 0), 'cancelados', coalesce(t.c, 0)) order by d.dia), '[]'::jsonb)
                    from generate_series(v_desde, current_date, interval '1 day') as d(dia)
                    left join (select data, count(*) n, count(*) filter (where control.status_cancelado(status)) c
                               from base group by data) t on t.data = d.dia::date),
        'por_barbearia', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome_comercial, 'total', t.n, 'cancelados', t.c) order by t.n desc), '[]'::jsonb)
                          from (select barbearia_id, count(*) n, count(*) filter (where control.status_cancelado(status)) c
                                from base group by barbearia_id) t
                          join control.barbearias b on b.id = t.barbearia_id),
        'por_servico', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'total', n) order by n desc), '[]'::jsonb)
                        from (select coalesce(servico, 'Sem serviço') nome, count(*) n from base
                              group by 1 order by 2 desc limit 8) t),
        'por_hora', (select coalesce(jsonb_agg(jsonb_build_object('hora', h, 'total', n) order by h), '[]'::jsonb)
                     from (select extract(hour from horario)::int h, count(*) n from base
                           where horario is not null group by 1) t)
    )
    into v_ret;

    return v_ret;
end;
$$;

-- Lista de agendamentos (sem telefone do cliente).
create or replace function control_api.listar_agendamentos(
    p_desde     date,
    p_ate       date,
    p_barbearia uuid    default null,
    p_status    text    default null,
    p_limite    integer default 300
)
returns table (
    id           bigint,
    barbearia_id uuid,
    barbearia    text,
    data         date,
    horario      time,
    status       text,
    servico      text,
    preco        numeric,
    barbeiro     text,
    cliente      text,
    criado_em    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_desde date := coalesce(p_desde, current_date - 29);
    v_ate   date := coalesce(p_ate, current_date);
begin
    perform control.exigir_admin();
    if v_ate < v_desde or v_ate - v_desde > 366 then
        raise exception 'periodo_invalido' using errcode = '22023';
    end if;

    return query
    select a.id, a.barbearia_id, b.nome_comercial, a.data, a.horario, a.status,
           s.nome, control.numero_seguro(s."preço"::text), br.nome, c.nome, a.created_at
    from public.agendamentos a
    join control.barbearias b on b.id = a.barbearia_id
    left join public."SERVIÇOS" s on s.id = a.servico_id
    left join public."BARBEIROS" br on br.id = a.barbeiro_id
    left join public.clientes c on c.id = a.cliente_id
    where a.data between v_desde and v_ate
      and (p_barbearia is null or a.barbearia_id = p_barbearia)
      and (p_status is null or p_status = '' or
           (p_status = 'cancelado' and control.status_cancelado(a.status)) or
           lower(coalesce(a.status, '')) = lower(p_status))
    order by a.data desc, a.horario desc nulls last, a.id desc
    limit least(greatest(coalesce(p_limite, 300), 1), 1000);
end;
$$;

-- ---------------------------------------------------------------------
-- 05 · USUÁRIOS — administradores, donos/gerentes e contas sem vínculo
-- ---------------------------------------------------------------------
create or replace function control_api.listar_usuarios()
returns table (
    user_id          uuid,
    email            text,
    nome             text,
    tipo             text,
    membro_id        uuid,
    barbearia_id     uuid,
    barbearia        text,
    barbearia_status text,
    ativo            boolean,
    email_confirmado boolean,
    mfa              boolean,
    ultimo_acesso    timestamptz,
    criado_em        timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();

    return query
    with mfa as (
        select f.user_id, true as ok
        from auth.mfa_factors f
        where f.status = 'verified'
        group by f.user_id
    )
    -- Administradores do SaaS
    select u.id, u.email::text, coalesce(ad.nome, u.raw_user_meta_data ->> 'nome'), 'master'::text,
           null::uuid, null::uuid, null::text, null::text,
           ad.ativo, u.email_confirmed_at is not null, coalesce(mfa.ok, false),
           u.last_sign_in_at, u.created_at
    from control.administradores ad
    join auth.users u on lower(u.email) = ad.email
    left join mfa on mfa.user_id = u.id

    union all
    -- Donos e gerentes de barbearias
    select u.id, u.email::text, u.raw_user_meta_data ->> 'nome', m.papel,
           m.id, b.id, b.nome_comercial, b.status,
           m.ativo, u.email_confirmed_at is not null, coalesce(mfa.ok, false),
           u.last_sign_in_at, m.criado_em
    from control.membros m
    join auth.users u on u.id = m.user_id
    join control.barbearias b on b.id = m.barbearia_id
    left join mfa on mfa.user_id = u.id

    union all
    -- Contas de login sem nenhum vínculo (nem Master, nem barbearia)
    select u.id, u.email::text, u.raw_user_meta_data ->> 'nome', 'sem_vinculo'::text,
           null::uuid, null::uuid, null::text, null::text,
           false, u.email_confirmed_at is not null, coalesce(mfa.ok, false),
           u.last_sign_in_at, u.created_at
    from auth.users u
    left join mfa on mfa.user_id = u.id
    where not exists (select 1 from control.membros m where m.user_id = u.id)
      and not exists (select 1 from control.administradores ad where ad.email = lower(u.email));
end;
$$;

-- ---------------------------------------------------------------------
-- 20 · AUDITORIA E ACESSOS
-- ---------------------------------------------------------------------
-- Busca paginada (do mais recente para o mais antigo; p_antes = último id visto).
create or replace function control_api.buscar_auditoria(
    p_desde  timestamptz default null,
    p_ate    timestamptz default null,
    p_acao   text        default null,
    p_busca  text        default null,
    p_limite integer     default 100,
    p_antes  bigint      default null
)
returns table (
    id          bigint,
    ocorrido_em timestamptz,
    ator_email  text,
    acao        text,
    entidade    text,
    entidade_id text,
    detalhes    jsonb,
    ip          inet,
    user_agent  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_busca text := nullif(trim(coalesce(p_busca, '')), '');
begin
    perform control.exigir_admin();

    return query
    select a.id, a.ocorrido_em, a.ator_email, a.acao, a.entidade, a.entidade_id, a.detalhes, a.ip, a.user_agent
    from control.auditoria a
    where (p_desde is null or a.ocorrido_em >= p_desde)
      and (p_ate   is null or a.ocorrido_em <= p_ate)
      and (p_acao  is null or p_acao = '' or a.acao = p_acao)
      and (p_antes is null or a.id < p_antes)
      and (v_busca is null or
           strpos(lower(concat_ws(' ', a.ator_email, a.acao, a.entidade, a.entidade_id, a.detalhes::text, host(a.ip))),
                  lower(v_busca)) > 0)
    order by a.id desc
    limit least(greatest(coalesce(p_limite, 100), 1), 500);
end;
$$;

-- Resumo do período: eventos por ação e por dia, tentativas de login.
create or replace function control_api.auditoria_resumo(p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_dias  integer := least(greatest(coalesce(p_dias, 30), 1), 366);
    v_desde timestamptz;
    v_ret   jsonb;
begin
    perform control.exigir_admin();
    v_desde := date_trunc('day', now()) - make_interval(days => v_dias - 1);

    select jsonb_build_object(
        'dias',     v_dias,
        'desde',    v_desde,
        'eventos',  (select count(*) from control.auditoria where ocorrido_em >= v_desde),
        'atores',   (select count(distinct ator_id) from control.auditoria where ocorrido_em >= v_desde),
        'acoes',    (select coalesce(array_agg(distinct acao order by acao), '{}') from control.auditoria),
        'por_acao', (select coalesce(jsonb_agg(jsonb_build_object('acao', acao, 'total', n) order by n desc), '[]'::jsonb)
                     from (select acao, count(*) n from control.auditoria
                           where ocorrido_em >= v_desde group by acao) t),
        'por_dia',  (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia::date, 'total', coalesce(t.n, 0)) order by d.dia), '[]'::jsonb)
                     from generate_series(date_trunc('day', v_desde), date_trunc('day', now()), interval '1 day') d(dia)
                     left join (select date_trunc('day', ocorrido_em) dia, count(*) n from control.auditoria
                                where ocorrido_em >= v_desde group by 1) t on t.dia = d.dia),
        'logins_sucesso', (select count(*) from control.tentativas_login where ocorrido_em >= v_desde and sucesso),
        'logins_falha',   (select count(*) from control.tentativas_login where ocorrido_em >= v_desde and not sucesso),
        'ips_falha',      (select count(distinct ip) from control.tentativas_login where ocorrido_em >= v_desde and not sucesso)
    )
    into v_ret;

    return v_ret;
end;
$$;

-- Tentativas de login no Barber Control (sucesso e falha).
create or replace function control_api.listar_tentativas_login(
    p_dias   integer default 30,
    p_limite integer default 200
)
returns table (
    id          bigint,
    ocorrido_em timestamptz,
    email       text,
    ip          inet,
    sucesso     boolean,
    user_agent  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();

    return query
    select t.id, t.ocorrido_em, t.email, t.ip, t.sucesso, t.user_agent
    from control.tentativas_login t
    -- Mesmo critério de auditoria_resumo: desde o início do dia, há (p_dias - 1) dias.
    where t.ocorrido_em >= date_trunc('day', now()) - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 366) - 1)
    order by t.id desc
    limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões: somente usuários logados (a função exige Master + MFA)
-- ---------------------------------------------------------------------
revoke all on function control.numero_seguro(text) from public, anon, authenticated;
revoke all on function control.status_cancelado(text) from public, anon, authenticated;

revoke all on function control_api.painel_resumo() from public, anon;
revoke all on function control_api.atividade_resumo(integer, uuid) from public, anon;
revoke all on function control_api.listar_agendamentos(date, date, uuid, text, integer) from public, anon;
revoke all on function control_api.listar_usuarios() from public, anon;
revoke all on function control_api.buscar_auditoria(timestamptz, timestamptz, text, text, integer, bigint) from public, anon;
revoke all on function control_api.auditoria_resumo(integer) from public, anon;
revoke all on function control_api.listar_tentativas_login(integer, integer) from public, anon;

grant execute on function control_api.painel_resumo() to authenticated;
grant execute on function control_api.atividade_resumo(integer, uuid) to authenticated;
grant execute on function control_api.listar_agendamentos(date, date, uuid, text, integer) to authenticated;
grant execute on function control_api.listar_usuarios() to authenticated;
grant execute on function control_api.buscar_auditoria(timestamptz, timestamptz, text, text, integer, bigint) to authenticated;
grant execute on function control_api.auditoria_resumo(integer) to authenticated;
grant execute on function control_api.listar_tentativas_login(integer, integer) to authenticated;

commit;
