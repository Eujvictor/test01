-- =====================================================================
-- BARBER CONTROL — CADASTRO DO ADMINISTRADOR
-- ---------------------------------------------------------------------
-- 1. Troque  SEU_EMAIL_AQUI  pelo e-mail do proprietário do SaaS.
-- 2. Rode no SQL Editor DEPOIS da migração 20261117000001.
-- 3. A conta precisa existir em Authentication → Users, com e-mail
--    confirmado (Add user → "Auto Confirm User").
--
-- O e-mail fica somente no banco, nunca no código do navegador.
-- =====================================================================

insert into control.administradores (email, nome)
values (lower('SEU_EMAIL_AQUI'), 'Proprietário Barber')
on conflict (email) do update set ativo = true;

-- Conferência: deve retornar 1 linha com conta_existe = true e email_confirmado = true
select a.email,
       a.ativo,
       (u.id is not null)                as conta_existe,
       (u.email_confirmed_at is not null) as email_confirmado
from control.administradores a
left join auth.users u on lower(u.email) = a.email;
