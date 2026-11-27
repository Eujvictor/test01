-- =====================================================================
-- BARBER CONTROL — Migração 16: "Chamar de volta" (reativação de clientes)
-- Primeira funcionalidade lançada pelo caminho site mãe → todas.
--
-- O que esta migração faz:
--   * public.clientes: coluna "ultimo_contato" (quando o dono chamou o
--     cliente pelo WhatsApp pelo botão "Chamar de volta").
--   * public.configuracoes_site: coluna "retorno_config" (dias para
--     considerar inativo, texto da mensagem e link de agendamento).
--   * Gatilhos: essas duas colunas só podem ser gravadas quando a
--     funcionalidade "chamar_de_volta" está ligada para a barbearia
--     (o banco confere, não só a tela).
--   * Cadastra a funcionalidade no Barber Control como "Planejada", com
--     o código chamar_de_volta (ninguém vê até você colocar em teste).
--
-- O que esta migração NÃO faz:
--   * Não apaga nem altera dados existentes; as colunas novas começam vazias.
--   * Não muda excluir cliente, excluir todos nem a busca.
--
-- Idempotente: pode ser executada mais de uma vez.
-- Execução: Supabase → SQL Editor → colar → Run.
-- =====================================================================

begin;

alter table public.clientes add column if not exists ultimo_contato timestamptz;
alter table public.configuracoes_site add column if not exists retorno_config jsonb;

create or replace function control.exigir_chamar_de_volta_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.ultimo_contato is distinct from old.ultimo_contato
       and (new.barbearia_id is null or not control.funcionalidade_ligada('chamar_de_volta', new.barbearia_id)) then
        raise exception 'funcionalidade_desligada: chamar_de_volta' using errcode = '42501';
    end if;
    return new;
end;
$$;

create or replace function control.exigir_chamar_de_volta_config()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.retorno_config is distinct from old.retorno_config
       and (new.barbearia_id is null or not control.funcionalidade_ligada('chamar_de_volta', new.barbearia_id)) then
        raise exception 'funcionalidade_desligada: chamar_de_volta' using errcode = '42501';
    end if;
    return new;
end;
$$;

revoke all on function control.exigir_chamar_de_volta_cliente() from public, anon, authenticated;
revoke all on function control.exigir_chamar_de_volta_config() from public, anon, authenticated;

drop trigger if exists clientes_chamar_de_volta on public.clientes;
create trigger clientes_chamar_de_volta before update on public.clientes
    for each row execute function control.exigir_chamar_de_volta_cliente();

drop trigger if exists configuracoes_site_chamar_de_volta on public.configuracoes_site;
create trigger configuracoes_site_chamar_de_volta before update on public.configuracoes_site
    for each row execute function control.exigir_chamar_de_volta_config();

-- Cadastro no módulo Funcionalidades (só se ainda não existir).
insert into control.produto_registros (tipo, titulo, descricao, status, categoria, codigo)
select 'funcionalidade', 'Chamar de volta',
       'Veja quais clientes não aparecem há algum tempo e chame cada um pelo WhatsApp com uma mensagem pronta, direto do módulo Clientes. A mensagem e o prazo ficam em Configurações → Mensagem de retorno.',
       'planejada', 'clientes', 'chamar_de_volta'
where not exists (select 1 from control.produto_registros where tipo = 'funcionalidade' and codigo = 'chamar_de_volta');

commit;
