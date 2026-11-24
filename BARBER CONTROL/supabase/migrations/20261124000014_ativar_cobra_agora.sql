-- =====================================================================
-- BARBER CONTROL — Migração 14: "Ativa (cobrar)" começa a cobrar na hora
-- Correção (24/11/2026): ao mudar uma assinatura de "Em teste" para
-- "Ativa (cobrar)", o primeiro vencimento continuava no fim do teste, e a
-- fatura só aparecia dias depois. Agora, ao ativar a cobrança (vindo de
-- teste, isenta ou cancelada), o vencimento passa a ser HOJE e a fatura
-- desta barbearia é gerada no mesmo momento.
--
-- O que muda: só a função control_api.alterar_assinatura (mesma
-- assinatura; o resto é igual à migração 10).
-- O que NÃO faz: não altera nem apaga dados existentes.
--
-- Idempotente. Execução: Supabase → SQL Editor → colar → Run.
-- =====================================================================

begin;

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
    v_preco  numeric;
    v_nome   text;
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
            -- Ativar a cobrança: começa hoje (vindo de teste, isenta ou cancelada).
            when v_status = 'ativa' and a.status in ('teste', 'cancelada', 'isenta') then control.hoje()
            else proximo_vencimento end
    where id = a.id;

    if v_status in ('cancelada', 'isenta') then
        update control.faturas set status = 'cancelada', observacao = 'Assinatura ' || v_status
        where assinatura_id = a.id and status = 'aberta';
        update control.assinaturas set suspensa_por_inadimplencia = false where id = a.id;
    else
        perform control.atualizar_situacao(a.id);
    end if;

    -- Cobrança ativada agora: gera a fatura de hoje desta barbearia.
    if v_status = 'ativa' and a.status in ('teste', 'cancelada', 'isenta') then
        select p.preco_mensal, p.nome into v_preco, v_nome
        from control.assinaturas x join control.planos p on p.id = x.plano_id where x.id = a.id;
        if v_preco > 0 then
            insert into control.faturas (assinatura_id, barbearia_id, plano_nome, competencia, valor, vencimento)
            values (a.id, a.barbearia_id, v_nome, control.hoje(), v_preco, control.hoje())
            -- Se a fatura de hoje tinha sido cancelada (ex.: isentou e reativou), ela é reaberta.
            on conflict (assinatura_id, competencia) do update
                set status = 'aberta', observacao = null, valor = excluded.valor, plano_nome = excluded.plano_nome
                where control.faturas.status = 'cancelada';
            update control.assinaturas set proximo_vencimento = (control.hoje() + interval '1 month')::date where id = a.id;
        end if;
    end if;

    perform control.registrar_auditoria(auth.uid(), 'assinatura_alterada', 'barbearia', p_barbearia::text,
        jsonb_build_object('anterior', a.status, 'novo', coalesce(v_status, a.status),
                           'plano', v_plano, 'teste_ate', v_teste, 'motivo', p_dados ->> 'motivo'));
end;
$$;

commit;
