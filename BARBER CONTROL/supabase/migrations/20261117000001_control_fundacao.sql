-- =====================================================================
-- BARBER CONTROL — FASE 1 — FUNDAÇÃO
-- ---------------------------------------------------------------------
-- O que esta migração faz:
--   * Cria o schema PRIVADO  "control"     (tabelas — nunca exposto na API)
--   * Cria o schema PÚBLICO  "control_api" (somente funções RPC protegidas)
--   * Tabelas: administradores, barbearias, auditoria, tentativas_login
--   * Funções de autorização: is_admin(), mfa_verificado(), exigir_admin()
--   * RPCs do painel e RPCs exclusivas das Edge Functions (service_role)
--   * Cadastra a barbearia #1 (Navalha de Ouro)
--
-- O que esta migração NÃO faz:
--   * Não altera, renomeia ou apaga nenhuma tabela do Barber existente
--     (BARBEIROS, "SERVIÇOS", agendamentos, clientes, configuracoes_*).
--     Apenas LÊ contagens dessas tabelas, dentro de funções protegidas.
--   * Não cadastra o administrador: isso é feito no arquivo
--     20261117000002_control_administrador.sql, com o seu e-mail.
--
-- Idempotente: pode ser executada mais de uma vez.
-- Execução: Supabase → SQL Editor → colar → Run.
-- Depois: Settings → Data API → Exposed schemas → adicionar "control_api".
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. SCHEMAS E PRIVILÉGIOS BÁSICOS
-- ---------------------------------------------------------------------
create schema if not exists control;
create schema if not exists control_api;

revoke all on schema control     from public, anon, authenticated;
revoke all on schema control_api from public, anon;
grant usage on schema control_api to authenticated, service_role;

alter default privileges in schema control     revoke all     on tables    from public, anon, authenticated;
alter default privileges in schema control     revoke execute on functions from public, anon, authenticated;
alter default privileges in schema control_api revoke execute on functions from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------

-- Quem pode acessar o Barber Control (somente o proprietário do SaaS).
create table if not exists control.administradores (
    id          uuid primary key default gen_random_uuid(),
    email       text not null unique check (email = lower(email)),
    nome        text,
    ativo       boolean not null default true,
    criado_em   timestamptz not null default now()
);

-- Cada barbearia cliente do SaaS (tenant).
create table if not exists control.barbearias (
    id                     uuid primary key default gen_random_uuid(),
    codigo                 text not null unique check (codigo ~ '^[a-z0-9-]{3,40}$'),
    nome_comercial         text not null check (length(trim(nome_comercial)) > 0),
    razao_social           text,
    documento              text,
    proprietario_nome      text,
    proprietario_email     text check (proprietario_email is null or proprietario_email = lower(proprietario_email)),
    proprietario_telefone  text,
    cidade                 text,
    estado                 char(2),
    status                 text not null default 'teste'
                           check (status in ('teste', 'ativa', 'suspensa', 'cancelada')),
    observacoes            text,
    criado_em              timestamptz not null default now(),
    atualizado_em          timestamptz not null default now()
);
create index if not exists barbearias_status_idx on control.barbearias (status);

-- Trilha de auditoria (somente inserção — imutável por trigger).
create table if not exists control.auditoria (
    id            bigint generated always as identity primary key,
    ocorrido_em   timestamptz not null default now(),
    ator_id       uuid,
    ator_email    text,
    acao          text not null,
    entidade      text,
    entidade_id   text,
    detalhes      jsonb not null default '{}'::jsonb,
    ip            inet,
    user_agent    text
);
create index if not exists auditoria_ocorrido_idx on control.auditoria (ocorrido_em desc);
create index if not exists auditoria_acao_idx     on control.auditoria (acao, ocorrido_em desc);

-- Tentativas de login no Barber Control (alimentado pela Edge Function control-login).
create table if not exists control.tentativas_login (
    id            bigint generated always as identity primary key,
    ocorrido_em   timestamptz not null default now(),
    email         text not null,
    ip            inet,
    sucesso       boolean not null,
    user_agent    text
);
create index if not exists tentativas_email_idx on control.tentativas_login (email, ocorrido_em desc);
create index if not exists tentativas_ip_idx    on control.tentativas_login (ip, ocorrido_em desc);

-- RLS ligada SEM políticas = nenhum acesso direto pela API.
-- Todo acesso passa por funções security definer que validam o administrador.
alter table control.administradores  enable row level security;
alter table control.barbearias       enable row level security;
alter table control.auditoria        enable row level security;
alter table control.tentativas_login enable row level security;

revoke all on all tables    in schema control from public, anon, authenticated;
revoke all on all sequences in schema control from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------
create or replace function control.bloquear_alteracao_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'Registros de auditoria são imutáveis.' using errcode = '42501';
end;
$$;

drop trigger if exists auditoria_imutavel on control.auditoria;
create trigger auditoria_imutavel
    before update or delete on control.auditoria
    for each row execute function control.bloquear_alteracao_auditoria();

create or replace function control.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.atualizado_em := now();
    return new;
end;
$$;

drop trigger if exists barbearias_atualizado_em on control.barbearias;
create trigger barbearias_atualizado_em
    before update on control.barbearias
    for each row execute function control.tocar_atualizado_em();


-- ---------------------------------------------------------------------
-- 4. AUTORIZAÇÃO (base de toda a segurança do Barber Control)
-- ---------------------------------------------------------------------

-- Usuário logado é um administrador ativo, com e-mail confirmado?
create or replace function control.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from control.administradores a
        join auth.users u on lower(u.email) = a.email
        where u.id = auth.uid()
          and a.ativo
          and u.email_confirmed_at is not null
    );
$$;

-- Sessão atual passou pelo segundo fator (MFA)?
create or replace function control.mfa_verificado()
returns boolean
language sql
stable
set search_path = ''
as $$
    select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Interrompe a execução se não for administrador com MFA.
create or replace function control.exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not control.is_admin() then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;
    if not control.mfa_verificado() then
        raise exception 'mfa_obrigatorio' using errcode = '42501';
    end if;
end;
$$;

-- Registro interno de auditoria.
create or replace function control.registrar_auditoria(
    p_ator_id     uuid,
    p_acao        text,
    p_entidade    text  default null,
    p_entidade_id text  default null,
    p_detalhes    jsonb default '{}'::jsonb,
    p_ip          inet  default null,
    p_user_agent  text  default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_email text;
    v_id    bigint;
begin
    select email into v_email from auth.users where id = p_ator_id;

    insert into control.auditoria (ator_id, ator_email, acao, entidade, entidade_id, detalhes, ip, user_agent)
    values (p_ator_id, v_email, p_acao, p_entidade, p_entidade_id,
            coalesce(p_detalhes, '{}'::jsonb), p_ip, left(p_user_agent, 300))
    returning id into v_id;

    return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. RPCs DO PAINEL (role authenticated — validação no servidor)
-- ---------------------------------------------------------------------

-- Usado no login: diz ao próprio usuário se ele é admin e se já tem MFA.
-- Não exige aal2 porque é chamado antes do segundo fator.
create or replace function control_api.verificar_acesso()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'admin', control.is_admin(),
        'mfa',   control.mfa_verificado()
    );
$$;

-- Eventos de sessão disparados pelo navegador (lista fechada).
create or replace function control_api.registrar_evento(
    p_acao     text,
    p_detalhes jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();

    if p_acao not in ('logout', 'sessao_expirada') then
        raise exception 'evento_invalido' using errcode = '22023';
    end if;

    perform control.registrar_auditoria(auth.uid(), p_acao, 'sessao', null, coalesce(p_detalhes, '{}'::jsonb));
end;
$$;

-- Indicadores da Visão Geral (somente dados reais).
-- As tabelas do Barber são lidas por SQL dinâmico: se alguma não existir
-- ou mudar de formato, o indicador volta NULL ("indisponível"), sem quebrar.
create or replace function control_api.painel_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_plataforma   jsonb;
    v_barbeiros    bigint;
    v_clientes     bigint;
    v_ag_mes       bigint;
    v_ag_cancel    bigint;
begin
    perform control.exigir_admin();

    select jsonb_build_object(
        'total',         count(*),
        'ativas',        count(*) filter (where status = 'ativa'),
        'teste',         count(*) filter (where status = 'teste'),
        'suspensas',     count(*) filter (where status = 'suspensa'),
        'canceladas',    count(*) filter (where status = 'cancelada'),
        'proprietarios', count(distinct proprietario_email)
    )
    into v_plataforma
    from control.barbearias;

    begin
        execute 'select count(*) from public."BARBEIROS"' into v_barbeiros;
    exception when others then v_barbeiros := null;
    end;

    begin
        execute 'select count(*) from public.clientes' into v_clientes;
    exception when others then v_clientes := null;
    end;

    begin
        execute $q$
            select count(*) from public.agendamentos
            where data::date >= date_trunc('month', current_date)::date
              and data::date <  (date_trunc('month', current_date) + interval '1 month')::date
        $q$ into v_ag_mes;
    exception when others then v_ag_mes := null;
    end;

    begin
        execute $q$
            select count(*) from public.agendamentos
            where data::date >= date_trunc('month', current_date)::date
              and data::date <  (date_trunc('month', current_date) + interval '1 month')::date
              and lower(coalesce(status::text, '')) like 'cancel%'
        $q$ into v_ag_cancel;
    exception when others then v_ag_cancel := null;
    end;

    return jsonb_build_object(
        'plataforma', v_plataforma,
        'barber', jsonb_build_object(
            'barbeiros',         v_barbeiros,
            'clientes',          v_clientes,
            'agendamentos_mes',  v_ag_mes,
            'cancelamentos_mes', v_ag_cancel
        ),
        'gerado_em', now()
    );
end;
$$;

-- Atividade recente (auditoria).
create or replace function control_api.listar_auditoria(p_limite integer default 20)
returns table (
    id          bigint,
    ocorrido_em timestamptz,
    ator_email  text,
    acao        text,
    entidade    text,
    detalhes    jsonb,
    ip          inet
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();

    return query
        select a.id, a.ocorrido_em, a.ator_email, a.acao, a.entidade, a.detalhes, a.ip
        from control.auditoria a
        order by a.ocorrido_em desc
        limit least(greatest(coalesce(p_limite, 20), 1), 100);
end;
$$;


-- ---------------------------------------------------------------------
-- 6. RPCs EXCLUSIVAS DAS EDGE FUNCTIONS (role service_role)
-- ---------------------------------------------------------------------

-- Regras: 5 falhas (mesmo e-mail + mesmo IP) ou 20 falhas (mesmo IP)
-- em 15 minutos bloqueiam novas tentativas por 15 minutos a partir
-- da última falha. Contar por e-mail+IP impede que um terceiro
-- bloqueie o administrador apenas digitando o e-mail dele.
create or replace function control_api.login_verificar(p_email text, p_ip inet)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_janela     interval := interval '15 minutes';
    v_falhas_ei  integer;
    v_falhas_ip  integer := 0;
    v_ultima     timestamptz;
    v_ultima_ip  timestamptz;
    v_bloqueado  boolean;
begin
    select count(*), max(ocorrido_em)
      into v_falhas_ei, v_ultima
      from control.tentativas_login
     where email = lower(p_email)
       and ip is not distinct from p_ip
       and not sucesso
       and ocorrido_em > now() - v_janela;

    if p_ip is not null then
        select count(*), max(ocorrido_em)
          into v_falhas_ip, v_ultima_ip
          from control.tentativas_login
         where ip = p_ip
           and not sucesso
           and ocorrido_em > now() - v_janela;
        v_ultima := greatest(v_ultima, v_ultima_ip);
    end if;

    v_bloqueado := v_falhas_ei >= 5 or v_falhas_ip >= 20;

    return jsonb_build_object(
        'bloqueado', v_bloqueado,
        'falhas',    v_falhas_ei,
        'segundos_restantes',
            case when v_bloqueado
                 then greatest(0, ceil(extract(epoch from (v_ultima + v_janela - now()))))::int
                 else 0 end
    );
end;
$$;

create or replace function control_api.login_registrar(
    p_email      text,
    p_ip         inet,
    p_sucesso    boolean,
    p_user_agent text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
    insert into control.tentativas_login (email, ip, sucesso, user_agent)
    values (lower(p_email), p_ip, p_sucesso, left(p_user_agent, 300));
$$;

-- Auditoria com IP real (capturado no servidor pela Edge Function).
create or replace function control_api.auditar_servidor(
    p_ator_id    uuid,
    p_acao       text,
    p_detalhes   jsonb default '{}'::jsonb,
    p_ip         inet  default null,
    p_user_agent text  default null
)
returns bigint
language sql
security definer
set search_path = ''
as $$
    select control.registrar_auditoria(p_ator_id, p_acao, 'sessao', null, p_detalhes, p_ip, p_user_agent);
$$;


-- ---------------------------------------------------------------------
-- 7. PERMISSÕES DE EXECUÇÃO
-- ---------------------------------------------------------------------
revoke all on all functions in schema control     from public, anon, authenticated;
revoke all on all functions in schema control_api from public, anon, authenticated;

grant execute on function control_api.verificar_acesso()               to authenticated;
grant execute on function control_api.registrar_evento(text, jsonb)    to authenticated;
grant execute on function control_api.painel_resumo()                  to authenticated;
grant execute on function control_api.listar_auditoria(integer)        to authenticated;

grant execute on function control_api.login_verificar(text, inet)                     to service_role;
grant execute on function control_api.login_registrar(text, inet, boolean, text)      to service_role;
grant execute on function control_api.auditar_servidor(uuid, text, jsonb, inet, text) to service_role;


-- ---------------------------------------------------------------------
-- 8. DADOS INICIAIS
-- ---------------------------------------------------------------------
-- Barbearia #1: a operação atual do Barber (tenant único até a migração multi-tenant).
insert into control.barbearias (codigo, nome_comercial, status, observacoes)
values ('navalha-de-ouro', 'Navalha de Ouro', 'ativa',
        'Barbearia original do sistema Barber (tenant #1).')
on conflict (codigo) do nothing;

commit;
