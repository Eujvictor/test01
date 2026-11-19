-- =====================================================================
-- MULTI-TENANT 03 — NÚCLEO
-- ---------------------------------------------------------------------
-- Pré-requisito: 20261117000001 e 20261117000002 aplicadas.
--
-- O que faz (nada é apagado):
--   * schema "tenant": funções de checagem usadas pelas políticas RLS
--     (não é exposto na API, não pode ser chamado pelo site)
--   * control.barbearias: colunas "dominio" e "protegida"
--   * control.membros: qual usuário administra qual barbearia
--   * Navalha de Ouro: ativa, protegida (não pode ser suspensa/cancelada)
--     e vinculada à conta atual do painel como proprietária
--   * api.barbearia_por_slug() e api.minha_barbearia()
--
-- Idempotente: pode ser executada mais de uma vez.
-- =====================================================================

begin;

do $$
begin
    if to_regclass('control.barbearias') is null then
        raise exception 'Aplique antes a migração 20261117000001_control_fundacao.sql';
    end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Schema de checagem (privado; só as políticas usam)
-- ---------------------------------------------------------------------
create schema if not exists tenant;
revoke all on schema tenant from public;
grant usage on schema tenant to anon, authenticated, service_role;
alter default privileges in schema tenant revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- 2. Barbearias: domínio próprio (futuro) e proteção da barbearia de referência
-- ---------------------------------------------------------------------
alter table control.barbearias
    add column if not exists dominio   text,
    add column if not exists protegida boolean not null default false;

create unique index if not exists barbearias_dominio_uk
    on control.barbearias (lower(dominio)) where dominio is not null;

create or replace function control.proteger_barbearia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' then
        if old.protegida then
            raise exception 'barbearia_protegida: a barbearia de referência não pode ser excluída' using errcode = '42501';
        end if;
        return old;
    end if;
    if old.protegida and new.status in ('suspensa', 'cancelada') then
        raise exception 'barbearia_protegida: a barbearia de referência não pode ser suspensa nem cancelada' using errcode = '42501';
    end if;
    -- Só o SQL Editor (sem usuário de API) pode tirar a proteção.
    if old.protegida and not new.protegida and auth.uid() is not null then
        raise exception 'barbearia_protegida: a proteção só pode ser removida pelo SQL Editor' using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists barbearias_protecao on control.barbearias;
create trigger barbearias_protecao
    before update or delete on control.barbearias
    for each row execute function control.proteger_barbearia();

-- ---------------------------------------------------------------------
-- 3. Membros: usuário → barbearia
-- Sem políticas: ninguém lê nem altera pela API. Só funções do Master
-- (control_api, com MFA) criam e alteram vínculos. Assim nenhum usuário
-- consegue mudar o próprio nível de acesso.
-- ---------------------------------------------------------------------
create table if not exists control.membros (
    id            uuid primary key default gen_random_uuid(),
    barbearia_id  uuid not null references control.barbearias (id) on delete restrict,
    user_id       uuid not null references auth.users (id) on delete cascade,
    papel         text not null default 'proprietario' check (papel in ('proprietario', 'gerente')),
    ativo         boolean not null default true,
    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    unique (barbearia_id, user_id)
);
create index if not exists membros_usuario_idx on control.membros (user_id) where ativo;

alter table control.membros enable row level security;
revoke all on control.membros from public, anon, authenticated;

drop trigger if exists membros_atualizado_em on control.membros;
create trigger membros_atualizado_em
    before update on control.membros
    for each row execute function control.tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- 4. Funções de checagem (security definer, search_path vazio)
-- ---------------------------------------------------------------------

-- Master = administrador do Barber Control com segundo fator (MFA).
create or replace function tenant.e_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select control.is_admin() and control.mfa_verificado();
$$;

-- Site público pode mostrar esta barbearia?
create or replace function tenant.barbearia_publica(p_barbearia uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from control.barbearias b
        where b.id = p_barbearia and b.status in ('ativa', 'teste')
    );
$$;

-- Pode ver os dados (inclusive com a barbearia suspensa: modo consulta).
create or replace function tenant.pode_consultar(p_barbearia uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select tenant.e_master() or exists (
        select 1
        from control.membros m
        join control.barbearias b on b.id = m.barbearia_id
        where m.user_id = auth.uid()
          and m.barbearia_id = p_barbearia
          and m.ativo
          and b.status <> 'cancelada'
    );
$$;

-- Pode alterar os dados (barbearia ativa ou em teste).
create or replace function tenant.pode_gerenciar(p_barbearia uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select tenant.e_master() or exists (
        select 1
        from control.membros m
        join control.barbearias b on b.id = m.barbearia_id
        where m.user_id = auth.uid()
          and m.barbearia_id = p_barbearia
          and m.ativo
          and b.status in ('ativa', 'teste')
    );
$$;

-- Barbearia do usuário logado, quando ele administra exatamente uma
-- (usada para preencher barbearia_id automaticamente em inserções).
create or replace function tenant.barbearia_do_usuario()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select case when count(*) = 1 then (array_agg(m.barbearia_id))[1] end
    from control.membros m
    where m.user_id = auth.uid() and m.ativo;
$$;

revoke all on all functions in schema tenant from public;
grant execute on function tenant.e_master()                 to anon, authenticated, service_role;
grant execute on function tenant.barbearia_publica(uuid)    to anon, authenticated, service_role;
grant execute on function tenant.pode_consultar(uuid)       to anon, authenticated, service_role;
grant execute on function tenant.pode_gerenciar(uuid)       to anon, authenticated, service_role;
grant execute on function tenant.barbearia_do_usuario()     to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. API para o site e o painel da barbearia
-- ---------------------------------------------------------------------
create schema if not exists api;
grant usage on schema api to anon, authenticated;

-- Site público: slug (ou domínio) → barbearia. Retorna a barbearia mesmo
-- suspensa, com disponivel = false, para o site exibir "indisponível".
create or replace function api.barbearia_por_slug(p_slug text)
returns table (id uuid, slug text, nome text, status text, disponivel boolean)
language sql
stable
security definer
set search_path = ''
as $$
    select b.id, b.codigo, b.nome_comercial,
           case when b.status in ('ativa', 'teste') then b.status else 'indisponivel' end,
           b.status in ('ativa', 'teste')
    from control.barbearias b
    where b.codigo = lower(trim(p_slug))
       or (b.dominio is not null and lower(b.dominio) = lower(trim(p_slug)))
    limit 1;
$$;

-- Painel da barbearia: quais barbearias o usuário logado administra.
create or replace function api.minha_barbearia()
returns table (barbearia_id uuid, slug text, nome text, status text, papel text, pode_editar boolean)
language sql
stable
security definer
set search_path = ''
as $$
    select b.id, b.codigo, b.nome_comercial, b.status, m.papel, b.status in ('ativa', 'teste')
    from control.membros m
    join control.barbearias b on b.id = m.barbearia_id
    where m.user_id = auth.uid()
      and m.ativo
      and b.status <> 'cancelada'
    order by b.nome_comercial;
$$;

revoke all on function api.barbearia_por_slug(text) from public;
revoke all on function api.minha_barbearia() from public;
grant execute on function api.barbearia_por_slug(text) to anon, authenticated;
grant execute on function api.minha_barbearia() to authenticated;

-- ---------------------------------------------------------------------
-- 6. Navalha de Ouro: referência protegida + proprietário atual
-- ---------------------------------------------------------------------
update control.barbearias
   set status = 'ativa', protegida = true
 where codigo = 'navalha-de-ouro';

-- A conta que hoje entra no painel da Navalha vira a proprietária dela.
insert into control.membros (barbearia_id, user_id, papel)
select b.id, u.id, 'proprietario'
from control.barbearias b
join auth.users u on lower(u.email) = 'navalhadeouro@gmail.com'
where b.codigo = 'navalha-de-ouro'
on conflict (barbearia_id, user_id) do update set ativo = true;

commit;
