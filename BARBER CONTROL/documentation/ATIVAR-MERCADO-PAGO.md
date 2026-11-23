# Ativar a cobrança pelo Mercado Pago

Regras aprovadas em 19/11/2026:
- **Cobrança:** fatura mensal, paga por Pix, cartão ou boleto.
- **Planos:** Basic R$ 79,90, Professional R$ 149,90 e Premium R$ 249,90, editáveis no Barber Control.
- **Atraso:** com 7 dias de atraso, a barbearia é suspensa automaticamente e volta sozinha quando o pagamento é confirmado.
- **Navalha de Ouro:** isenta.

Começamos com as credenciais de **teste**: nenhum dinheiro real é movimentado.

## 1. Migração 10 (SQL Editor)

Cole e execute `supabase/migrations/20261119000010_cobranca.sql`.

O que acontece:
- **Tabelas novas:** planos, assinaturas e faturas, no schema privado `control`.
- **Assinaturas:** cada barbearia ganha a sua. A Navalha fica isenta; as demais ficam em teste no plano Basic.
- **Rotina diária:** fica agendada para as 6h (pg_cron). Se o pg_cron não estiver disponível, use o botão "Executar rotina agora" em Assinaturas → Planos e regras.

## 2. Aplicação no Mercado Pago

O painel do Mercado Pago muda com frequência. Os passos abaixo seguem a documentação oficial de novembro de 2026. Se alguma tela estiver diferente, escolha a opção mais parecida.

1. Acesse https://www.mercadopago.com.br/developers/panel/app e entre com a sua conta.
2. Clique em **Criar aplicação** e depois em **Criar manualmente**. Use o nome "Barber".
   Se o painel perguntar o tipo de integração, responda **pagamento online** com **Checkout Pro**, **sem** plataforma de e-commerce. Se não perguntar nada, siga em frente.
3. Abra a aplicação. No **topo da página**, no seletor de ambiente, escolha **Teste**.
4. No menu lateral, abra **Credenciais** e copie o **Access Token**.
   O token de teste **começa com `APP_USR-`**, igual ao de produção. O que garante que ele é de teste é o seletor estar em **Teste**.
   **Não envie esse token por mensagem para ninguém.** Ele vai direto para o Supabase (passo 3).
5. No menu lateral, abra **Contas de teste**. Uma conta já é criada automaticamente com a aplicação. Para pagar no teste, crie mais uma, do tipo **comprador**:
   - clique em **Criar conta de teste**;
   - país **Brasil**, identificação "Comprador Barber", tipo de conta **comprador** e um saldo fictício (por exemplo, 1000);
   - aceite os termos e clique em **Criar conta de teste**.
   O usuário e a senha dessa conta aparecem em **Credenciais**, com o ambiente em **Teste**, na seção **Conta de teste**.

## 3. Secrets no Supabase

Abra Supabase → **Edge Functions → Secrets** e adicione:

| Nome | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | o Access Token copiado com o seletor em **Teste** (`APP_USR-...`) |

## 4. Edge Function `cobranca`

1. Abra **Edge Functions → Deploy a new function → Via Editor**. Use o nome `cobranca`.
2. Apague o exemplo e cole `supabase/funcoes-para-o-painel/cobranca.ts`.
3. Clique em **Deploy**.
4. **Obrigatório:** desligue a verificação de JWT da função ("Verify JWT" ou "Enforce JWT verification").
   O Mercado Pago avisa os pagamentos sem login do Supabase. A segurança fica por conta de duas coisas: a assinatura do aviso e uma nova consulta do pagamento direto no Mercado Pago.

## 5. Webhook (aviso de pagamento)

1. Mercado Pago → sua aplicação → **Webhooks → Configurar notificações**.
2. Em URL (modo de teste), informe: `https://cjwmzbknarafinftpqsv.supabase.co/functions/v1/cobranca?origem=mp`
3. Em evento, marque **Pagamentos** e salve.
4. Copie a **assinatura secreta** e crie no Supabase o Secret `MP_WEBHOOK_SECRET` com esse valor.

## 6. Teste ponta a ponta

1. No Barber Control, vá em **Assinaturas** → big bigode → ⚙ → "Em teste" com a data de **hoje**.
2. Em **Planos e regras**, clique em **Executar rotina agora**. A fatura é gerada.
3. Como dono da big bigode, no painel da barbearia, abra **Minha assinatura → Pagar**.
4. No checkout de teste, entre com a **conta de comprador de teste** e pague com cartão de teste: Mastercard `5031 4332 1540 6351`, CVV `123`, validade `11/30`, nome do titular **APRO** (aprova o pagamento) e CPF `12345678909`.
5. De volta ao painel, a fatura muda para **Paga** em instantes. No Barber Control, ela aparece em **Financeiro** e a ação aparece na **Auditoria**.

## 7. Produção (quando quiser cobrar de verdade)

1. Troque `MP_ACCESS_TOKEN` pelo **Access Token de produção**: na aplicação, ponha o seletor em **Produção** e abra **Credenciais**.
2. Configure o webhook também no modo de produção, com a mesma URL, e atualize `MP_WEBHOOK_SECRET`.

## Situação dos testes (19/11/2026)

| Teste | Resultado |
|---|---|
| Banco (PostgreSQL 16), migrações 01 a 10 | 158/158 |
| Edge Function `cobranca` (Supabase e Mercado Pago simulados) | 23/23 |
| Telas do Barber Control | 21/21 |
| Painel da barbearia, "Minha assinatura" (8 cenários) | 25/25 |
| Regressões | painel 42/42 e 18/18, senha 13/13, demo 22/22 |
