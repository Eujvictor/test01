-- =====================================================================
-- BARBER CONTROL — Migração 11: suporte e comunicados
-- Módulos: 07 Suporte · 08 Notificações (comunicados) ·
--          painel da barbearia ("Suporte" e avisos no topo)
--
-- O que esta migração faz:
--   * Cria control.chamados, control.chamado_mensagens, control.comunicados
--     e control.comunicado_leituras (schema privado control).
--   * Dono/gerente: abre chamados, conversa e lê comunicados da própria
--     barbearia (funções api.*, conferidas no servidor por barbearia).
--   * Master (administrador + MFA): responde chamados, muda status e
--     prioridade, publica comunicados para todas ou algumas barbearias.
--
-- O que esta migração NÃO faz:
--   * Não altera nem apaga tabelas ou registros existentes.
--   * Não envia e-mail, WhatsApp ou SMS: tudo aparece dentro dos painéis.
--
-- Idempotente: pode ser executada mais de uma vez.
-- Execução: Supabase → SQL Editor → colar → Run.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table if not exists control.chamados (
    id                 uuid primary key default gen_random_uuid(),
    protocolo          bigint generated always as identity unique,
    barbearia_id       uuid not null references control.barbearias (id) on delete restrict,
    autor_id           uuid references auth.users (id) on delete set null,
    autor_email        text,
    assunto            text not null check (length(trim(assunto)) between 3 and 120),
    categoria          text not null default 'duvidas'
                       check (categoria in ('tecnico', 'agendamentos', 'financeiro', 'assinaturas', 'acesso', 'duvidas', 'solicitacoes', 'outros')),
    prioridade         text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'critica')),
    status             text not null default 'aberto'
                       check (status in ('aberto', 'em_atendimento', 'aguardando', 'resolvido', 'encerrado')),
    lido_master        boolean not null default false,
    lido_barbearia     boolean not null default true,
    ultima_mensagem_em timestamptz not null default now(),
    resolvido_em       timestamptz,
    criado_em          timestamptz not null default now(),
    atualizado_em      timestamptz not null default now()
);
create index if not exists chamados_barbearia_idx on control.chamados (barbearia_id, ultima_mensagem_em desc);
create index if not exists chamados_status_idx on control.chamados (status, ultima_mensagem_em desc);

create table if not exists control.chamado_mensagens (
    id          bigint generated always as identity primary key,
    chamado_id  uuid not null references control.chamados (id) on delete cascade,
    autor_id    uuid references auth.users (id) on delete set null,
    autor_tipo  text not null check (autor_tipo in ('barbearia', 'master')),
    autor_email text,
    texto       text not null check (length(trim(texto)) between 1 and 4000),
    criado_em   timestamptz not null default now()
);
create index if not exists chamado_mensagens_idx on control.chamado_mensagens (chamado_id, id);

create table if not exists control.comunicados (
    id            uuid primary key default gen_random_uuid(),
    titulo        text not null check (length(trim(titulo)) between 3 and 120),
    mensagem      text not null check (length(trim(mensagem)) between 3 and 2000),
    categoria     text not null default 'geral'
                  check (categoria in ('atualizacao', 'manutencao', 'seguranca', 'financeiro', 'geral', 'novidade', 'importante')),
    prioridade    text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta')),
    status        text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
    destino       text not null default 'todas' check (destino in ('todas', 'selecionadas')),
    barbearias    uuid[] not null default '{}',
    publicar_em   timestamptz,
    expira_em     timestamptz,
    publicado_em  timestamptz,
    criado_por    uuid references auth.users (id) on delete set null,
    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    check (expira_em is null or publicar_em is null or expira_em > publicar_em)
);

create table if not exists control.comunicado_leituras (
    comunicado_id uuid not null references control.comunicados (id) on delete cascade,
    user_id       uuid not null references auth.users (id) on delete cascade,
    barbearia_id  uuid references control.barbearias (id) on delete cascade,
    lido_em       timestamptz not null default now(),
    primary key (comunicado_id, user_id)
);

alter table control.chamados            enable row level security;
alter table control.chamado_mensagens   enable row level security;
alter table control.comunicados         enable row level security;
alter table control.comunicado_leituras enable row level security;
revoke all on control.chamados, control.chamado_mensagens, control.comunicados, control.comunicado_leituras
    from public, anon, authenticated;

drop trigger if exists chamados_atualizado_em on control.chamados;
create trigger chamados_atualizado_em before update on control.chamados
    for each row execute function control.tocar_atualizado_em();
drop trigger if exists comunicados_atualizado_em on control.comunicados;
create trigger comunicados_atualizado_em before update on control.comunicados
    for each row execute function control.tocar_atualizado_em();

-- Comunicado visível para a barbearia agora?
create or replace function control.comunicado_visivel(c control.comunicados, p_barbearia uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
    select c.status = 'publicado'
       and coalesce(c.publicar_em, c.publicado_em, c.criado_em) <= now()
       and (c.expira_em is null or c.expira_em > now())
       and (c.destino = 'todas' or p_barbearia = any (c.barbearias));
$$;

-- ---------------------------------------------------------------------
-- 2. Painel da barbearia (api) — dono ou gerente da barbearia
-- ---------------------------------------------------------------------
create or replace function api.meus_chamados(p_barbearia uuid default null)
returns table (id uuid, protocolo bigint, assunto text, categoria text, status text, prioridade text,
               nao_lido boolean, ultima_mensagem_em timestamptz, ultima_mensagem text, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_barbearia uuid := coalesce(p_barbearia, tenant.barbearia_do_usuario());
begin
    if v_barbearia is null or not tenant.pode_consultar(v_barbearia) then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;
    return query
    select c.id, c.protocolo, c.assunto, c.categoria, c.status, c.prioridade, not c.lido_barbearia,
           c.ultima_mensagem_em,
           (select left(m.texto, 160) from control.chamado_mensagens m where m.chamado_id = c.id order by m.id desc limit 1),
           c.criado_em
    from control.chamados c
    where c.barbearia_id = v_barbearia
    order by c.ultima_mensagem_em desc
    limit 100;
end;
$$;

create or replace function api.ver_chamado(p_chamado uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    c control.chamados%rowtype;
begin
    select * into c from control.chamados where id = p_chamado;
    -- Só membro ativo da barbearia (o Master usa control_api.ver_chamado).
    if not found or not tenant.pode_consultar(c.barbearia_id) or not exists (
        select 1 from control.membros m where m.user_id = auth.uid() and m.barbearia_id = c.barbearia_id and m.ativo) then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;
    update control.chamados set lido_barbearia = true where id = c.id and not lido_barbearia;
    return jsonb_build_object(
        'id', c.id, 'protocolo', c.protocolo, 'assunto', c.assunto, 'categoria', c.categoria,
        'status', c.status, 'prioridade', c.prioridade, 'criado_em', c.criado_em,
        'mensagens', coalesce((select jsonb_agg(jsonb_build_object(
                                   'autor', case when m.autor_tipo = 'master' then 'Suporte Barber' else coalesce(m.autor_email, 'Barbearia') end,
                                   'de_suporte', m.autor_tipo = 'master', 'texto', m.texto, 'criado_em', m.criado_em) order by m.id)
                               from control.chamado_mensagens m where m.chamado_id = c.id), '[]'::jsonb)
    );
end;
$$;

create or replace function api.abrir_chamado(p_assunto text, p_categoria text, p_mensagem text, p_barbearia uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_barbearia uuid := coalesce(p_barbearia, tenant.barbearia_do_usuario());
    v_id        uuid;
    v_email     text := (select email from auth.users where id = auth.uid());
begin
    if v_barbearia is null or not tenant.pode_consultar(v_barbearia) or not exists (
        select 1 from control.membros m where m.user_id = auth.uid() and m.barbearia_id = v_barbearia and m.ativo) then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;
    if length(trim(coalesce(p_assunto, ''))) < 3 then raise exception 'assunto_obrigatorio' using errcode = '22023'; end if;
    if length(trim(coalesce(p_mensagem, ''))) < 3 then raise exception 'mensagem_obrigatoria' using errcode = '22023'; end if;
    -- Limite contra excesso de chamados.
    if (select count(*) from control.chamados where barbearia_id = v_barbearia and status in ('aberto', 'em_atendimento', 'aguardando')) >= 10 then
        raise exception 'limite_chamados' using errcode = '54000';
    end if;
    if (select count(*) from control.chamados where barbearia_id = v_barbearia and criado_em > now() - interval '1 day') >= 20 then
        raise exception 'limite_chamados' using errcode = '54000';
    end if;

    insert into control.chamados (barbearia_id, autor_id, autor_email, assunto, categoria)
    values (v_barbearia, auth.uid(), v_email, left(trim(p_assunto), 120),
            case when p_categoria in ('tecnico', 'agendamentos', 'financeiro', 'assinaturas', 'acesso', 'duvidas', 'solicitacoes', 'outros')
                 then p_categoria else 'duvidas' end)
    returning id into v_id;
    insert into control.chamado_mensagens (chamado_id, autor_id, autor_tipo, autor_email, texto)
    values (v_id, auth.uid(), 'barbearia', v_email, left(trim(p_mensagem), 4000));
    return v_id;
end;
$$;

create or replace function api.responder_chamado(p_chamado uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    c control.chamados%rowtype;
begin
    select * into c from control.chamados where id = p_chamado for update;
    if not found or not exists (
        select 1 from control.membros m join control.barbearias b on b.id = m.barbearia_id
        where m.user_id = auth.uid() and m.barbearia_id = c.barbearia_id and m.ativo and b.status <> 'cancelada') then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;
    if c.status = 'encerrado' then raise exception 'chamado_encerrado' using errcode = '22023'; end if;
    if length(trim(coalesce(p_texto, ''))) < 1 then raise exception 'mensagem_obrigatoria' using errcode = '22023'; end if;
    if (select count(*) from control.chamado_mensagens where chamado_id = c.id and autor_tipo = 'barbearia'
        and criado_em > now() - interval '1 hour') >= 30 then
        raise exception 'limite_mensagens' using errcode = '54000';
    end if;
    insert into control.chamado_mensagens (chamado_id, autor_id, autor_tipo, autor_email, texto)
    values (c.id, auth.uid(), 'barbearia', (select email from auth.users where id = auth.uid()), left(trim(p_texto), 4000));
    update control.chamados set
        status = case when status in ('aguardando', 'resolvido') then 'aberto' else status end,
        resolvido_em = case when status = 'resolvido' then null else resolvido_em end,
        lido_master = false, lido_barbearia = true, ultima_mensagem_em = now()
    where id = c.id;
end;
$$;

create or replace function api.meus_comunicados(p_barbearia uuid default null)
returns table (id uuid, titulo text, mensagem text, categoria text, prioridade text, publicado_em timestamptz, lido boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_barbearia uuid := coalesce(p_barbearia, tenant.barbearia_do_usuario());
begin
    if v_barbearia is null or not tenant.pode_consultar(v_barbearia) then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;
    return query
    select c.id, c.titulo, c.mensagem, c.categoria, c.prioridade, coalesce(c.publicar_em, c.publicado_em, c.criado_em),
           exists (select 1 from control.comunicado_leituras l where l.comunicado_id = c.id and l.user_id = auth.uid())
    from control.comunicados c
    where control.comunicado_visivel(c, v_barbearia)
    order by coalesce(c.publicar_em, c.publicado_em, c.criado_em) desc
    limit 50;
end;
$$;

create or replace function api.marcar_comunicado_lido(p_comunicado uuid, p_barbearia uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_barbearia uuid := coalesce(p_barbearia, tenant.barbearia_do_usuario());
    c control.comunicados%rowtype;
begin
    select * into c from control.comunicados where id = p_comunicado;
    if not found or v_barbearia is null or not tenant.pode_consultar(v_barbearia) or not control.comunicado_visivel(c, v_barbearia) then
        raise exception 'acesso_negado' using errcode = '42501';
    end if;
    insert into control.comunicado_leituras (comunicado_id, user_id, barbearia_id)
    values (c.id, auth.uid(), v_barbearia)
    on conflict (comunicado_id, user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Master (control_api) — administrador + MFA
-- ---------------------------------------------------------------------
create or replace function control_api.listar_chamados()
returns table (id uuid, protocolo bigint, barbearia_id uuid, barbearia text, autor_email text, assunto text,
               categoria text, prioridade text, status text, nao_lido boolean, mensagens bigint,
               ultima_mensagem_em timestamptz, ultima_mensagem text, ultima_de_suporte boolean,
               resolvido_em timestamptz, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return query
    select c.id, c.protocolo, c.barbearia_id, b.nome_comercial, c.autor_email, c.assunto, c.categoria, c.prioridade,
           c.status, not c.lido_master,
           (select count(*) from control.chamado_mensagens m where m.chamado_id = c.id),
           c.ultima_mensagem_em,
           (select left(m.texto, 160) from control.chamado_mensagens m where m.chamado_id = c.id order by m.id desc limit 1),
           (select m.autor_tipo = 'master' from control.chamado_mensagens m where m.chamado_id = c.id order by m.id desc limit 1),
           c.resolvido_em, c.criado_em
    from control.chamados c
    join control.barbearias b on b.id = c.barbearia_id
    order by c.ultima_mensagem_em desc
    limit 1000;
end;
$$;

create or replace function control_api.ver_chamado(p_chamado uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    c control.chamados%rowtype;
begin
    perform control.exigir_admin();
    select * into c from control.chamados where id = p_chamado;
    if not found then raise exception 'chamado_inexistente' using errcode = 'P0002'; end if;
    update control.chamados set lido_master = true where id = c.id and not lido_master;
    return jsonb_build_object(
        'id', c.id, 'protocolo', c.protocolo, 'barbearia_id', c.barbearia_id,
        'barbearia', (select nome_comercial from control.barbearias where id = c.barbearia_id),
        'autor_email', c.autor_email, 'assunto', c.assunto, 'categoria', c.categoria, 'prioridade', c.prioridade,
        'status', c.status, 'criado_em', c.criado_em, 'resolvido_em', c.resolvido_em,
        'mensagens', coalesce((select jsonb_agg(jsonb_build_object(
                                   'autor', coalesce(m.autor_email, case when m.autor_tipo = 'master' then 'Suporte Barber' else 'Barbearia' end),
                                   'de_suporte', m.autor_tipo = 'master', 'texto', m.texto, 'criado_em', m.criado_em) order by m.id)
                               from control.chamado_mensagens m where m.chamado_id = c.id), '[]'::jsonb)
    );
end;
$$;

-- Responde (opcional) e/ou muda status e prioridade.
create or replace function control_api.responder_chamado(
    p_chamado uuid, p_texto text default null, p_status text default null, p_prioridade text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    c control.chamados%rowtype;
    v_texto  text := nullif(trim(coalesce(p_texto, '')), '');
    v_status text := nullif(p_status, '');
begin
    perform control.exigir_admin();
    select * into c from control.chamados where id = p_chamado for update;
    if not found then raise exception 'chamado_inexistente' using errcode = 'P0002'; end if;
    if v_status is not null and v_status not in ('aberto', 'em_atendimento', 'aguardando', 'resolvido', 'encerrado') then
        raise exception 'status_invalido' using errcode = '22023';
    end if;
    if p_prioridade is not null and p_prioridade not in ('baixa', 'normal', 'alta', 'critica') then
        raise exception 'prioridade_invalida' using errcode = '22023';
    end if;
    if v_texto is null and v_status is null and p_prioridade is null then
        raise exception 'nada_a_alterar' using errcode = '22023';
    end if;

    if v_texto is not null then
        insert into control.chamado_mensagens (chamado_id, autor_id, autor_tipo, autor_email, texto)
        values (c.id, auth.uid(), 'master', 'Suporte Barber', left(v_texto, 4000));
    end if;
    -- Resposta sem status escolhido: aguarda a barbearia.
    if v_texto is not null and v_status is null and c.status in ('aberto', 'em_atendimento') then
        v_status := 'aguardando';
    end if;

    update control.chamados set
        status = coalesce(v_status, status),
        prioridade = coalesce(p_prioridade, prioridade),
        resolvido_em = case when coalesce(v_status, status) in ('resolvido', 'encerrado') then coalesce(resolvido_em, now()) else null end,
        lido_master = true,
        lido_barbearia = case when v_texto is not null or v_status is not null then false else lido_barbearia end,
        ultima_mensagem_em = case when v_texto is not null then now() else ultima_mensagem_em end
    where id = c.id;

    perform control.registrar_auditoria(auth.uid(), 'chamado_atualizado', 'chamado', c.id::text,
        jsonb_build_object('protocolo', c.protocolo, 'barbearia', c.barbearia_id, 'respondeu', v_texto is not null,
                           'anterior', c.status, 'novo', coalesce(v_status, c.status), 'prioridade', p_prioridade));
end;
$$;

create or replace function control_api.listar_comunicados()
returns table (id uuid, titulo text, mensagem text, categoria text, prioridade text, status text, situacao text,
               destino text, barbearias uuid[], publicar_em timestamptz, expira_em timestamptz, publicado_em timestamptz,
               alcance bigint, leituras bigint, criado_em timestamptz, atualizado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return query
    select c.id, c.titulo, c.mensagem, c.categoria, c.prioridade, c.status,
           case
               when c.status <> 'publicado' then c.status
               when c.expira_em is not null and c.expira_em <= now() then 'expirado'
               when c.publicar_em is not null and c.publicar_em > now() then 'agendado'
               else 'no_ar' end,
           c.destino, c.barbearias, c.publicar_em, c.expira_em, c.publicado_em,
           (select count(*) from control.barbearias b
             where b.status <> 'cancelada' and (c.destino = 'todas' or b.id = any (c.barbearias))),
           (select count(distinct l.barbearia_id) from control.comunicado_leituras l where l.comunicado_id = c.id),
           c.criado_em, c.atualizado_em
    from control.comunicados c
    order by coalesce(c.publicar_em, c.publicado_em, c.criado_em) desc;
end;
$$;

create or replace function control_api.salvar_comunicado(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id       uuid := p_id;
    v_status   text := coalesce(nullif(p_dados ->> 'status', ''), 'rascunho');
    v_destino  text := coalesce(nullif(p_dados ->> 'destino', ''), 'todas');
    v_lista    uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_dados -> 'barbearias', '[]'::jsonb)) x), '{}');
    v_publicar timestamptz := nullif(p_dados ->> 'publicar_em', '')::timestamptz;
    v_expira   timestamptz := nullif(p_dados ->> 'expira_em', '')::timestamptz;
    v_anterior text;
begin
    perform control.exigir_admin();
    if v_status not in ('rascunho', 'publicado', 'arquivado') then raise exception 'status_invalido' using errcode = '22023'; end if;
    if v_destino not in ('todas', 'selecionadas') then raise exception 'destino_invalido' using errcode = '22023'; end if;
    if v_destino = 'selecionadas' and cardinality(v_lista) = 0 then raise exception 'sem_destinatarios' using errcode = '22023'; end if;
    if v_expira is not null and v_expira <= coalesce(v_publicar, now()) then raise exception 'expiracao_invalida' using errcode = '22023'; end if;
    if length(trim(coalesce(p_dados ->> 'titulo', ''))) < 3 then raise exception 'titulo_obrigatorio' using errcode = '22023'; end if;
    if length(trim(coalesce(p_dados ->> 'mensagem', ''))) < 3 then raise exception 'mensagem_obrigatoria' using errcode = '22023'; end if;

    if v_id is null then
        insert into control.comunicados (titulo, mensagem, categoria, prioridade, status, destino, barbearias,
                                         publicar_em, expira_em, publicado_em, criado_por)
        values (trim(p_dados ->> 'titulo'), trim(p_dados ->> 'mensagem'),
                coalesce(nullif(p_dados ->> 'categoria', ''), 'geral'), coalesce(nullif(p_dados ->> 'prioridade', ''), 'normal'),
                v_status, v_destino, case when v_destino = 'todas' then '{}' else v_lista end,
                v_publicar, v_expira, case when v_status = 'publicado' then now() end, auth.uid())
        returning id into v_id;
    else
        select status into v_anterior from control.comunicados where id = v_id;
        if v_anterior is null then raise exception 'comunicado_inexistente' using errcode = 'P0002'; end if;
        update control.comunicados set
            titulo = trim(p_dados ->> 'titulo'), mensagem = trim(p_dados ->> 'mensagem'),
            categoria = coalesce(nullif(p_dados ->> 'categoria', ''), categoria),
            prioridade = coalesce(nullif(p_dados ->> 'prioridade', ''), prioridade),
            status = v_status, destino = v_destino,
            barbearias = case when v_destino = 'todas' then '{}' else v_lista end,
            publicar_em = v_publicar, expira_em = v_expira,
            publicado_em = case when v_status = 'publicado' then coalesce(publicado_em, now()) else publicado_em end
        where id = v_id;
    end if;

    perform control.registrar_auditoria(auth.uid(), 'comunicado_salvo', 'comunicado', v_id::text,
        jsonb_build_object('nome', trim(p_dados ->> 'titulo'), 'anterior', v_anterior, 'novo', v_status,
                           'destino', v_destino, 'barbearias', cardinality(v_lista)));
    return v_id;
end;
$$;

-- Resumo para a Visão geral do Master.
create or replace function control_api.suporte_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform control.exigir_admin();
    return jsonb_build_object(
        'abertos', (select count(*) from control.chamados where status in ('aberto', 'em_atendimento')),
        'aguardando', (select count(*) from control.chamados where status = 'aguardando'),
        'nao_lidos', (select count(*) from control.chamados where not lido_master),
        'criticos', (select count(*) from control.chamados where prioridade in ('alta', 'critica') and status in ('aberto', 'em_atendimento')),
        'comunicados_no_ar', (select count(*) from control.comunicados c where c.status = 'publicado'
                              and coalesce(c.publicar_em, c.publicado_em) <= now() and (c.expira_em is null or c.expira_em > now()))
    );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Permissões
-- ---------------------------------------------------------------------
revoke all on function control.comunicado_visivel(control.comunicados, uuid) from public, anon, authenticated;

revoke all on function api.meus_chamados(uuid) from public, anon;
revoke all on function api.ver_chamado(uuid) from public, anon;
revoke all on function api.abrir_chamado(text, text, text, uuid) from public, anon;
revoke all on function api.responder_chamado(uuid, text) from public, anon;
revoke all on function api.meus_comunicados(uuid) from public, anon;
revoke all on function api.marcar_comunicado_lido(uuid, uuid) from public, anon;
revoke all on function control_api.listar_chamados() from public, anon;
revoke all on function control_api.ver_chamado(uuid) from public, anon;
revoke all on function control_api.responder_chamado(uuid, text, text, text) from public, anon;
revoke all on function control_api.listar_comunicados() from public, anon;
revoke all on function control_api.salvar_comunicado(uuid, jsonb) from public, anon;
revoke all on function control_api.suporte_resumo() from public, anon;

grant execute on function api.meus_chamados(uuid) to authenticated;
grant execute on function api.ver_chamado(uuid) to authenticated;
grant execute on function api.abrir_chamado(text, text, text, uuid) to authenticated;
grant execute on function api.responder_chamado(uuid, text) to authenticated;
grant execute on function api.meus_comunicados(uuid) to authenticated;
grant execute on function api.marcar_comunicado_lido(uuid, uuid) to authenticated;
grant execute on function control_api.listar_chamados() to authenticated;
grant execute on function control_api.ver_chamado(uuid) to authenticated;
grant execute on function control_api.responder_chamado(uuid, text, text, text) to authenticated;
grant execute on function control_api.listar_comunicados() to authenticated;
grant execute on function control_api.salvar_comunicado(uuid, jsonb) to authenticated;
grant execute on function control_api.suporte_resumo() to authenticated;

commit;
