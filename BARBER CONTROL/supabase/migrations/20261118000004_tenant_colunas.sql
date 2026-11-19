-- =====================================================================
-- MULTI-TENANT 04 — barbearia_id NAS TABELAS DO BARBER
-- ---------------------------------------------------------------------
-- Pré-requisito: 20261118000003_tenant_nucleo.sql.
--
-- O que faz (NENHUM dado é apagado ou alterado, exceto preencher a
-- nova coluna barbearia_id com a Navalha de Ouro):
--   * barbearia_id (obrigatório) em BARBEIROS, SERVIÇOS, clientes,
--     agendamentos, configuracoes_site e configuracoes_horarios
--   * chave estrangeira para control.barbearias e índices
--   * integridade: agendamento só aceita barbeiro, serviço e cliente da
--     MESMA barbearia (chaves estrangeiras compostas)
--   * barbearia_id é preenchido sozinho (dono de uma barbearia) e não
--     pode ser trocado depois de criado
--   * uma configuração de site e uma de horários por barbearia
--   * clientes: telefone passa a ser único POR BARBEARIA (antes era
--     único no sistema todo). A restrição antiga é substituída; nenhum
--     cliente é removido.
--   * funções de agendamento passam a respeitar a barbearia do barbeiro
--     (mesmo nome e parâmetros: o site atual continua funcionando)
--
-- Compatível com o site e o painel atuais (código antigo continua ok).
-- Idempotente.
-- =====================================================================

begin;

do $$
declare
    v_navalha uuid;
begin
    select id into v_navalha from control.barbearias where codigo = 'navalha-de-ouro';
    if v_navalha is null then
        raise exception 'Barbearia navalha-de-ouro não encontrada: aplique 20261117000001 e 20261118000003 antes.';
    end if;
    if (select count(*) from public.configuracoes_site) > 1 then
        raise exception 'configuracoes_site tem mais de uma linha. Nada foi alterado: me envie a contagem para decidirmos juntos.';
    end if;
    if (select count(*) from public.configuracoes_horarios) > 1 then
        raise exception 'configuracoes_horarios tem mais de uma linha. Nada foi alterado: me envie a contagem para decidirmos juntos.';
    end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Coluna barbearia_id (preenchida com a Navalha de Ouro)
-- ---------------------------------------------------------------------
do $$
declare
    v_navalha uuid := (select id from control.barbearias where codigo = 'navalha-de-ouro');
    t text;
begin
    foreach t in array array['BARBEIROS', 'SERVIÇOS', 'clientes', 'agendamentos', 'configuracoes_site', 'configuracoes_horarios'] loop
        execute format('alter table public.%I add column if not exists barbearia_id uuid', t);
        execute format('update public.%I set barbearia_id = $1 where barbearia_id is null', t) using v_navalha;
        execute format('alter table public.%I alter column barbearia_id set not null', t);
        execute format('create index if not exists %I on public.%I (barbearia_id)', lower(replace(t, 'Ç', 'c')) || '_barbearia_idx', t);
        if not exists (select 1 from pg_constraint where conname = lower(replace(t, 'Ç', 'c')) || '_barbearia_fk') then
            execute format('alter table public.%I add constraint %I foreign key (barbearia_id) references control.barbearias (id) on delete restrict',
                           t, lower(replace(t, 'Ç', 'c')) || '_barbearia_fk');
        end if;
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Integridade entre tabelas da mesma barbearia
-- ---------------------------------------------------------------------
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'barbeiros_id_barbearia_uk') then
        alter table public."BARBEIROS" add constraint barbeiros_id_barbearia_uk unique (id, barbearia_id);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'servicos_id_barbearia_uk') then
        alter table public."SERVIÇOS" add constraint servicos_id_barbearia_uk unique (id, barbearia_id);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'clientes_id_barbearia_uk') then
        alter table public.clientes add constraint clientes_id_barbearia_uk unique (id, barbearia_id);
    end if;

    if not exists (select 1 from pg_constraint where conname = 'agendamentos_barbeiro_mesma_barbearia_fk') then
        alter table public.agendamentos add constraint agendamentos_barbeiro_mesma_barbearia_fk
            foreign key (barbeiro_id, barbearia_id) references public."BARBEIROS" (id, barbearia_id);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'agendamentos_servico_mesma_barbearia_fk') then
        alter table public.agendamentos add constraint agendamentos_servico_mesma_barbearia_fk
            foreign key (servico_id, barbearia_id) references public."SERVIÇOS" (id, barbearia_id);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'agendamentos_cliente_mesma_barbearia_fk') then
        alter table public.agendamentos add constraint agendamentos_cliente_mesma_barbearia_fk
            foreign key (cliente_id, barbearia_id) references public.clientes (id, barbearia_id);
    end if;

    -- Uma configuração de site e uma de horários por barbearia.
    if not exists (select 1 from pg_constraint where conname = 'configuracoes_site_barbearia_uk') then
        alter table public.configuracoes_site add constraint configuracoes_site_barbearia_uk unique (barbearia_id);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'configuracoes_horarios_barbearia_uk') then
        alter table public.configuracoes_horarios add constraint configuracoes_horarios_barbearia_uk unique (barbearia_id);
    end if;

    -- Telefone do cliente único por barbearia (substitui a regra global).
    if not exists (select 1 from pg_constraint where conname = 'clientes_barbearia_telefone_uk') then
        alter table public.clientes add constraint clientes_barbearia_telefone_uk unique (barbearia_id, telefone);
    end if;
    alter table public.clientes drop constraint if exists clientes_telefone_unique;
end $$;

-- ---------------------------------------------------------------------
-- 3. barbearia_id automático e imutável
-- ---------------------------------------------------------------------
create or replace function tenant.definir_barbearia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        if new.barbearia_id is null then
            new.barbearia_id := tenant.barbearia_do_usuario();
        end if;
        if new.barbearia_id is null then
            raise exception 'barbearia_nao_identificada: informe barbearia_id' using errcode = '23502';
        end if;
    elsif new.barbearia_id is distinct from old.barbearia_id then
        raise exception 'barbearia_imutavel: um registro não pode mudar de barbearia' using errcode = '42501';
    end if;
    return new;
end;
$$;
revoke all on function tenant.definir_barbearia() from public;

do $$
declare t text;
begin
    foreach t in array array['BARBEIROS', 'SERVIÇOS', 'clientes', 'agendamentos', 'configuracoes_site', 'configuracoes_horarios'] loop
        execute format('drop trigger if exists definir_barbearia on public.%I', t);
        execute format('create trigger definir_barbearia before insert or update on public.%I for each row execute function tenant.definir_barbearia()', t);
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Funções de agendamento por barbearia
-- ---------------------------------------------------------------------

-- Cliente por barbearia (o mesmo telefone em duas barbearias = dois cadastros).
create or replace function api.obter_ou_criar_cliente(p_barbearia uuid, p_nome text, p_telefone text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_cliente_id bigint;
    v_nome       text := trim(p_nome);
    v_telefone   text := regexp_replace(p_telefone, '[^0-9]', '', 'g');
begin
    if p_barbearia is null then
        raise exception 'Barbearia não informada';
    end if;
    if v_nome is null or length(v_nome) < 2 or length(v_nome) > 100 then
        raise exception 'Nome inválido';
    end if;
    if v_telefone is null or length(v_telefone) < 10 or length(v_telefone) > 15 then
        raise exception 'Telefone inválido';
    end if;

    select c.id into v_cliente_id
    from public.clientes c
    where c.barbearia_id = p_barbearia and c.telefone = v_telefone
    limit 1;
    if v_cliente_id is not null then
        return v_cliente_id;
    end if;

    insert into public.clientes (barbearia_id, nome, telefone, ativo)
    values (p_barbearia, v_nome, v_telefone, true)
    on conflict (barbearia_id, telefone) do nothing
    returning id into v_cliente_id;

    if v_cliente_id is null then
        select c.id into v_cliente_id
        from public.clientes c
        where c.barbearia_id = p_barbearia and c.telefone = v_telefone
        limit 1;
    end if;
    return v_cliente_id;
end;
$$;

-- Versão antiga (2 parâmetros): mantida por compatibilidade, usa a Navalha.
create or replace function api.obter_ou_criar_cliente(p_nome text, p_telefone text)
returns bigint
language sql
security definer
set search_path = ''
as $$
    select api.obter_ou_criar_cliente(
        (select id from control.barbearias where codigo = 'navalha-de-ouro'), p_nome, p_telefone);
$$;

-- Horários ocupados de um barbeiro (só de barbearias visíveis ao público).
create or replace function api.consultar_horarios_ocupados(p_barbeiro_id bigint, p_data date)
returns table (horario time without time zone, servico_id bigint)
language sql
stable
security definer
set search_path = ''
as $$
    select a.horario, a.servico_id
    from public.agendamentos a
    join public."BARBEIROS" b on b.id = a.barbeiro_id
    where a.barbeiro_id = p_barbeiro_id
      and a.data = p_data
      and a.status is distinct from 'cancelado'
      and tenant.barbearia_publica(b.barbearia_id)
    order by a.horario;
$$;

-- Núcleo do agendamento público. A barbearia vem do barbeiro escolhido;
-- serviço, configuração e cliente precisam ser da mesma barbearia.
-- Regras iguais às da função original (mesmas mensagens de erro).
create or replace function api.registrar_agendamento_publico(
    p_nome text, p_telefone text, p_barbeiro_id bigint, p_servico_id bigint, p_data date, p_horario time without time zone
)
returns table (agendamento_id bigint, barbearia_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_barbearia  uuid;
    v_cliente_id bigint;
    v_config     record;
    v_dia_semana text;
    v_duracao    integer;
    v_novo       bigint;
    v_data_hoje  date;
begin
    if p_barbeiro_id is null or p_servico_id is null or p_data is null or p_horario is null then
        raise exception 'Dados do agendamento inválidos';
    end if;

    v_data_hoje := (current_timestamp at time zone 'America/Sao_Paulo')::date;
    if p_data < v_data_hoje then
        raise exception 'Não é possível agendar em uma data passada';
    end if;

    select b.barbearia_id into v_barbearia
    from public."BARBEIROS" b
    where b.id = p_barbeiro_id and b.ativo = true;
    if v_barbearia is null then
        raise exception 'Barbeiro inválido ou inativo';
    end if;
    if not tenant.barbearia_publica(v_barbearia) then
        raise exception 'Barbearia indisponível para agendamentos';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_barbeiro_id::text || ':' || p_data::text, 0));

    v_cliente_id := api.obter_ou_criar_cliente(v_barbearia, p_nome, p_telefone);

    select s."duraçao" into v_duracao
    from public."SERVIÇOS" s
    where s.id = p_servico_id and s.ativo = true and s.barbearia_id = v_barbearia
    limit 1;
    if v_duracao is null or v_duracao <= 0 then
        raise exception 'Serviço inválido ou inativo';
    end if;

    select * into v_config
    from public.configuracoes_horarios c
    where c.barbearia_id = v_barbearia
    order by c.id desc
    limit 1;
    if v_config.id is null then
        raise exception 'Configuração de horários não encontrada';
    end if;

    if p_data > (v_data_hoje + v_config.dias_maximos_agendamento) then
        raise exception 'Agendamento permitido somente até % dias à frente', v_config.dias_maximos_agendamento;
    end if;

    v_dia_semana := case extract(dow from p_data)
        when 0 then 'domingo' when 1 then 'segunda' when 2 then 'terca' when 3 then 'quarta'
        when 4 then 'quinta' when 5 then 'sexta' when 6 then 'sabado' end;

    if jsonb_typeof(coalesce(v_config.dias_funcionamento, '[]'::jsonb)) = 'array'
       and jsonb_array_length(coalesce(v_config.dias_funcionamento, '[]'::jsonb)) > 0
       and not (coalesce(v_config.dias_funcionamento, '[]'::jsonb) ? v_dia_semana) then
        raise exception 'A barbearia não funciona neste dia';
    end if;

    if coalesce(v_config.datas_bloqueadas, '[]'::jsonb) ? p_data::text then
        raise exception 'Esta data está bloqueada';
    end if;

    if coalesce(v_config.horarios_bloqueados, '{}'::jsonb) -> p_data::text ? p_horario::text then
        raise exception 'Este horário está bloqueado';
    end if;

    if p_horario < v_config.horario_abertura::time or p_horario >= v_config.horario_fechamento::time then
        raise exception 'Horário fora do expediente';
    end if;

    if coalesce(v_config.considerar_duracao_servicos, false)
       and (p_horario + (v_duracao || ' minutes')::interval > v_config.horario_fechamento::time) then
        raise exception 'O serviço ultrapassa o horário de funcionamento';
    end if;

    if exists (
        select 1 from public.agendamentos a
        where a.cliente_id = v_cliente_id and a.data = p_data and a.status is distinct from 'cancelado'
    ) then
        raise exception 'Este cliente já possui um agendamento neste dia';
    end if;

    if exists (
        select 1 from public.agendamentos a
        where a.barbeiro_id = p_barbeiro_id and a.data = p_data and a.horario = p_horario
          and a.status is distinct from 'cancelado'
    ) then
        raise exception 'Este horário já está ocupado';
    end if;

    if coalesce(v_config.considerar_duracao_servicos, false) and exists (
        select 1
        from public.agendamentos a
        join public."SERVIÇOS" s on s.id = a.servico_id
        where a.barbeiro_id = p_barbeiro_id and a.data = p_data and a.status is distinct from 'cancelado'
          and p_horario < (a.horario + (s."duraçao" || ' minutes')::interval)
          and a.horario < (p_horario + (v_duracao || ' minutes')::interval)
    ) then
        raise exception 'Este horário entra em conflito com outro atendimento';
    end if;

    insert into public.agendamentos (barbearia_id, cliente_id, barbeiro_id, servico_id, data, horario, status)
    values (v_barbearia, v_cliente_id, p_barbeiro_id, p_servico_id, p_data, p_horario, 'agendado')
    returning id into v_novo;

    return query select v_novo, v_barbearia;
end;
$$;

-- Assinatura original (o site atual continua chamando esta).
create or replace function api.criar_agendamento_publico(
    p_nome text, p_telefone text, p_barbeiro_id bigint, p_servico_id bigint, p_data date, p_horario time without time zone
)
returns bigint
language sql
security definer
set search_path = ''
as $$
    select r.agendamento_id
    from api.registrar_agendamento_publico(p_nome, p_telefone, p_barbeiro_id, p_servico_id, p_data, p_horario) r;
$$;

-- Versão nova: devolve também o WhatsApp de destino (barbearia ou barbeiro),
-- para o telefone do barbeiro não precisar ficar público.
create or replace function api.criar_agendamento_publico_v2(
    p_nome text, p_telefone text, p_barbeiro_id bigint, p_servico_id bigint, p_data date, p_horario time without time zone
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id        bigint;
    v_barbearia uuid;
    v_whats     jsonb;
    v_destino   text;
begin
    select r.agendamento_id, r.barbearia_id into v_id, v_barbearia
    from api.registrar_agendamento_publico(p_nome, p_telefone, p_barbeiro_id, p_servico_id, p_data, p_horario) r;

    select c.horarios_bloqueados -> '__whatsapp_config' into v_whats
    from public.configuracoes_horarios c
    where c.barbearia_id = v_barbearia
    limit 1;

    if coalesce((v_whats ->> 'enabled')::boolean, false) then
        if v_whats ->> 'mode' = 'barbeiro' then
            select regexp_replace(coalesce(b.telefone, ''), '[^0-9]', '', 'g') into v_destino
            from public."BARBEIROS" b where b.id = p_barbeiro_id;
        else
            v_destino := regexp_replace(coalesce(v_whats ->> 'phone', ''), '[^0-9]', '', 'g');
        end if;
    end if;

    return jsonb_build_object('id', v_id, 'whatsapp', nullif(v_destino, ''));
end;
$$;

revoke all on function api.registrar_agendamento_publico(text, text, bigint, bigint, date, time) from public, anon, authenticated;
revoke all on function api.obter_ou_criar_cliente(uuid, text, text) from public, anon, authenticated;
revoke all on function api.obter_ou_criar_cliente(text, text) from public, anon, authenticated;
grant execute on function api.consultar_horarios_ocupados(bigint, date) to anon, authenticated;
grant execute on function api.criar_agendamento_publico(text, text, bigint, bigint, date, time) to anon, authenticated;
grant execute on function api.criar_agendamento_publico_v2(text, text, bigint, bigint, date, time) to anon, authenticated;

commit;
