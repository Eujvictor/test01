-- =====================================================================
-- BARBER CONTROL — TESTES DE SEGURANÇA DA FASE 1
-- ---------------------------------------------------------------------
-- Rode no SQL Editor depois das migrações. Nada é gravado: o script
-- termina com ROLLBACK. O resultado é uma tabela "teste | resultado".
-- Todas as linhas devem começar com "OK".
-- =====================================================================

begin;

create temp table _resultado (ordem serial, teste text, resultado text);

do $$
declare
    v_admin   uuid;
    v_outro   uuid := gen_random_uuid();
    v_json    jsonb;
begin
    select u.id into v_admin
    from control.administradores a
    join auth.users u on lower(u.email) = a.email
    where a.ativo
    limit 1;

    -- T1: anon não executa RPC do painel
    begin
        execute 'set local role anon';
        perform control_api.painel_resumo();
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T1 anon -> painel_resumo', 'FALHOU: executou');
    exception when others then
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T1 anon -> painel_resumo', 'OK bloqueado: ' || sqlerrm);
    end;

    -- T2: anon não lê tabela privada
    begin
        execute 'set local role anon';
        perform count(*) from control.barbearias;
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T2 anon -> control.barbearias', 'FALHOU: leu');
    exception when others then
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T2 anon -> control.barbearias', 'OK bloqueado: ' || sqlerrm);
    end;

    -- T3: usuário autenticado comum (com MFA) não lê tabela privada
    begin
        perform set_config('request.jwt.claims', json_build_object('sub', v_outro, 'role', 'authenticated', 'aal', 'aal2')::text, true);
        execute 'set local role authenticated';
        perform count(*) from control.auditoria;
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T3 autenticado -> control.auditoria', 'FALHOU: leu');
    exception when others then
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T3 autenticado -> control.auditoria', 'OK bloqueado: ' || sqlerrm);
    end;

    -- T4: usuário autenticado comum (com MFA) recebe acesso_negado
    begin
        perform set_config('request.jwt.claims', json_build_object('sub', v_outro, 'role', 'authenticated', 'aal', 'aal2')::text, true);
        execute 'set local role authenticated';
        perform control_api.painel_resumo();
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T4 não-admin -> painel_resumo', 'FALHOU: executou');
    exception when others then
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T4 não-admin -> painel_resumo',
            case when sqlerrm = 'acesso_negado' then 'OK bloqueado: acesso_negado' else 'VERIFICAR: ' || sqlerrm end);
    end;

    -- T5: autenticado não chama RPC exclusiva do servidor
    begin
        perform set_config('request.jwt.claims', json_build_object('sub', v_outro, 'role', 'authenticated', 'aal', 'aal2')::text, true);
        execute 'set local role authenticated';
        perform control_api.login_registrar('x@x.com', null, true, null);
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T5 autenticado -> login_registrar', 'FALHOU: executou');
    exception when others then
        execute 'reset role';
        insert into _resultado (teste, resultado) values ('T5 autenticado -> login_registrar', 'OK bloqueado: ' || sqlerrm);
    end;

    if v_admin is null then
        insert into _resultado (teste, resultado)
        values ('T6-T8 administrador', 'PENDENTE: cadastre o administrador (migração 000002) e confirme a conta');
    else
        -- T6: administrador SEM MFA recebe mfa_obrigatorio
        begin
            perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal1')::text, true);
            execute 'set local role authenticated';
            perform control_api.painel_resumo();
            execute 'reset role';
            insert into _resultado (teste, resultado) values ('T6 admin aal1 -> painel_resumo', 'FALHOU: executou sem MFA');
        exception when others then
            execute 'reset role';
            insert into _resultado (teste, resultado) values ('T6 admin aal1 -> painel_resumo',
                case when sqlerrm = 'mfa_obrigatorio' then 'OK bloqueado: mfa_obrigatorio' else 'VERIFICAR: ' || sqlerrm end);
        end;

        -- T7: administrador COM MFA acessa
        begin
            perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
            execute 'set local role authenticated';
            v_json := control_api.painel_resumo();
            execute 'reset role';
            insert into _resultado (teste, resultado) values ('T7 admin aal2 -> painel_resumo', 'OK: ' || left(v_json::text, 180));
        exception when others then
            execute 'reset role';
            insert into _resultado (teste, resultado) values ('T7 admin aal2 -> painel_resumo', 'FALHOU: ' || sqlerrm);
        end;

        -- T8: verificar_acesso reflete admin + mfa
        begin
            perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
            execute 'set local role authenticated';
            v_json := control_api.verificar_acesso();
            execute 'reset role';
            insert into _resultado (teste, resultado) values ('T8 verificar_acesso',
                case when (v_json->>'admin')::boolean and (v_json->>'mfa')::boolean then 'OK: ' || v_json::text else 'FALHOU: ' || v_json::text end);
        exception when others then
            execute 'reset role';
            insert into _resultado (teste, resultado) values ('T8 verificar_acesso', 'FALHOU: ' || sqlerrm);
        end;
    end if;

    -- T9: auditoria é imutável (nem o dono do banco altera)
    begin
        insert into control.auditoria (acao) values ('teste_imutabilidade');
        update control.auditoria set acao = 'alterado' where acao = 'teste_imutabilidade';
        insert into _resultado (teste, resultado) values ('T9 auditoria imutável', 'FALHOU: permitiu UPDATE');
    exception when others then
        insert into _resultado (teste, resultado) values ('T9 auditoria imutável', 'OK bloqueado: ' || sqlerrm);
    end;

    -- T10: bloqueio de força bruta (5 falhas e-mail+IP)
    begin
        for i in 1..5 loop
            perform control_api.login_registrar('teste-bloqueio@exemplo.com', '203.0.113.9'::inet, false, 'teste');
        end loop;
        v_json := control_api.login_verificar('teste-bloqueio@exemplo.com', '203.0.113.9'::inet);
        insert into _resultado (teste, resultado) values ('T10 bloqueio após 5 falhas',
            case when (v_json->>'bloqueado')::boolean then 'OK: ' || v_json::text else 'FALHOU: ' || v_json::text end);

        v_json := control_api.login_verificar('teste-bloqueio@exemplo.com', '198.51.100.7'::inet);
        insert into _resultado (teste, resultado) values ('T11 outro IP não é bloqueado',
            case when not (v_json->>'bloqueado')::boolean then 'OK: ' || v_json::text else 'FALHOU: ' || v_json::text end);
    exception when others then
        insert into _resultado (teste, resultado) values ('T10/T11 bloqueio', 'FALHOU: ' || sqlerrm);
    end;
end;
$$;

select teste, resultado from _resultado order by ordem;

rollback;
