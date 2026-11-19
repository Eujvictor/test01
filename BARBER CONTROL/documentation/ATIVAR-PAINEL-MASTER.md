# Ativar o painel Master (Barber Control com dados reais)

Pré-requisito: migrações 01 a 08 aplicadas (já feito em 18/11/2026).

## 1. Expor o schema das funções do Master

Supabase → **Project Settings → Data API → Exposed schemas** → adicione `control_api`
(mantenha `public` e `api`). Salve.

Não exponha `control` nem `tenant`: ficam privados de propósito.

## 2. Publicar as duas Edge Functions (sem instalar nada)

Para cada função, no Supabase → **Edge Functions → Deploy a new function → Via Editor**:

| Nome da função (exatamente) | Arquivo para copiar e colar |
|---|---|
| `control-login` | `supabase/funcoes-para-o-painel/control-login.ts` |
| `control-admin` | `supabase/funcoes-para-o-painel/control-admin.ts` |

1. Apague o código de exemplo do editor e cole o arquivo inteiro.
2. Clique em **Deploy function**.
3. Abra a função → **Details/Settings** → **desligue "Verify JWT"** e salve
   (a validação é feita dentro da função, com MFA e checagem de administrador).

As chaves `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são
fornecidas pelo Supabase automaticamente; nada de chave vai para o navegador.

Opcional (recomendado depois de publicar o Barber Control num endereço fixo):
**Edge Functions → Secrets** → `CONTROL_ALLOWED_ORIGINS` = endereço do Barber Control.

Alternativa com Supabase CLI: veja `README.md`, passo 4.

## 3. Abrir o Barber Control (no seu computador)

O Barber Control ainda não está publicado (decisão sua). Para usar localmente:

```bash
npx serve "BARBER CONTROL"
```

Abra o endereço mostrado e entre em `login.html` (sem `?demo`).

## 4. Primeiro login do Master

1. E-mail e senha da sua conta Master.
2. Escaneie o QR code com um aplicativo autenticador (Google Authenticator, Authy…).
3. Digite o código de 6 dígitos. A partir daí, todo login pede o código.
4. Menu **Barbearias**: lista real, com a Navalha de Ouro marcada como Referência.

## 5. Teste completo sugerido (barbearia de teste)

1. **Nova barbearia** → nome "Barbearia Teste" (endereço gerado: `barbearia-teste`).
2. Abra a barbearia → **Criar acesso do proprietário** com um e-mail seu de teste →
   anote a senha temporária (aparece uma vez).
3. Em uma janela anônima: `https://eujvictor.github.io/test01/area-equipe.html` → entre com
   esse e-mail e senha → o painel deve mostrar **Barbearia Teste**, vazio.
4. Cadastre um serviço e um barbeiro, envie logo e banner, salve.
5. Abra `https://eujvictor.github.io/test01/?b=barbearia-teste` → só os dados dela.
6. Abra o site sem `?b=` → a Navalha continua igual.
7. No Master, **Suspender** a Barbearia Teste → o site dela mostra "indisponível" e o painel
   dela fica só para consulta. **Ativar** de novo → volta ao normal.

## 6. Migração 09 — Visão geral, Agendamentos, Usuários e Auditoria com dados reais

`supabase/migrations/20261119000009_master_leitura.sql` (SQL Editor → colar → Run).
Só cria funções de leitura em `control_api` (exigem Master + duas etapas) e um índice
em `agendamentos (barbearia_id, data)`. Não altera tabelas nem dados.

- **Visão geral**: totais de todas as barbearias + tabela por barbearia.
- **Agendamentos e atividade**: período, status, receita estimada, gráficos e lista
  (sem telefone de clientes), por barbearia ou geral, com exportação CSV.
- **Usuários**: administradores, donos/gerentes e contas sem vínculo; ativar/desativar
  o acesso de um dono ao painel (com auditoria).
- **Auditoria**: eventos da trilha imutável com filtros e detalhes; tentativas de login
  no Barber Control, com alerta de IP com muitas falhas.

Testes (19/11/2026): banco 106/106 (PostgreSQL 16), telas 37/37 com a API simulada,
celular sem rolagem lateral, modo demonstração 22/22.

## Situação dos testes (18/11/2026)

- Funções do Master no banco: testadas em PostgreSQL 16 (76/76).
- Edge Function `control-admin` (criar acesso do proprietário): 15/15, com Deno e Supabase simulados.
- Módulo Barbearias (modo real): 18/18, com a API simulada.
- O teste ponta a ponta com o seu Supabase depende dos passos 1 a 4 acima.
