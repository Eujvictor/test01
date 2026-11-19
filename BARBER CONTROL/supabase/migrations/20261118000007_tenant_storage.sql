-- =====================================================================
-- MULTI-TENANT 07 — IMAGENS (SUPABASE STORAGE)
-- ---------------------------------------------------------------------
-- O bucket "site-imagens" ainda NÃO existe no projeto (auditoria de
-- 18/11/2026): o envio de imagens pelo painel hoje falha. Esta migração
-- cria o bucket e as regras por barbearia:
--
--   site-imagens/barbearias/<barbearia_id>/identidade/logo.webp
--   site-imagens/barbearias/<barbearia_id>/banner/banner.webp
--   site-imagens/barbearias/<barbearia_id>/portfolio/imagem-1..4.webp
--
--   * leitura pública pela URL do arquivo (bucket público)
--   * enviar, substituir e excluir: só membro da barbearia da pasta
--     (ou Master). Uma barbearia não mexe nas imagens de outra.
--   * só WebP, JPEG e PNG; até 5 MB (SVG fica de fora: pode conter script)
--
-- Nada é apagado. Idempotente.
-- =====================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-imagens', 'site-imagens', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
    set public             = true,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- Caminho barbearias/<uuid>/... de uma barbearia que o usuário administra?
create or replace function tenant.pode_gerenciar_pasta(p_nome text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_partes text[] := storage.foldername(p_nome);
begin
    if coalesce(array_length(v_partes, 1), 0) < 3 or v_partes[1] <> 'barbearias'
       or v_partes[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or v_partes[3] not in ('identidade', 'banner', 'portfolio') then
        return false;
    end if;
    return tenant.pode_gerenciar(v_partes[2]::uuid);
end;
$$;
revoke all on function tenant.pode_gerenciar_pasta(text) from public;
grant execute on function tenant.pode_gerenciar_pasta(text) to authenticated, service_role;

-- Políticas antigas (do arquivo sql/configuracoes_site.sql), se existirem.
drop policy if exists site_imagens_leitura_publica on storage.objects;
drop policy if exists site_imagens_admin_insert    on storage.objects;
drop policy if exists site_imagens_admin_update    on storage.objects;
drop policy if exists site_imagens_admin_delete    on storage.objects;

drop policy if exists site_imagens_tenant_ler on storage.objects;
create policy site_imagens_tenant_ler on storage.objects
    for select to authenticated
    using (bucket_id = 'site-imagens' and tenant.pode_gerenciar_pasta(name));

drop policy if exists site_imagens_tenant_enviar on storage.objects;
create policy site_imagens_tenant_enviar on storage.objects
    for insert to authenticated
    with check (bucket_id = 'site-imagens' and tenant.pode_gerenciar_pasta(name));

drop policy if exists site_imagens_tenant_substituir on storage.objects;
create policy site_imagens_tenant_substituir on storage.objects
    for update to authenticated
    using (bucket_id = 'site-imagens' and tenant.pode_gerenciar_pasta(name))
    with check (bucket_id = 'site-imagens' and tenant.pode_gerenciar_pasta(name));

drop policy if exists site_imagens_tenant_excluir on storage.objects;
create policy site_imagens_tenant_excluir on storage.objects
    for delete to authenticated
    using (bucket_id = 'site-imagens' and tenant.pode_gerenciar_pasta(name));

commit;
