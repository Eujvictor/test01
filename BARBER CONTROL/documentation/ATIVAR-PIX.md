# Receber as mensalidades por Pix direto

Decisão de 23/11/2026: o Pix direto substitui o Mercado Pago. Não há taxa nem empresa intermediária, e a configuração é curta.

## Como funciona

1. A rotina diária gera a fatura de cada barbearia (5 dias antes do vencimento).
2. O dono abre **Minha assinatura**, toca em **Pagar com Pix** e paga pelo app do banco, lendo o **QR Code** ou usando o **Pix copia e cola**. O código já vem com o valor exato da fatura.
3. Depois de pagar, o dono toca em **Já paguei**.
4. No Barber Control, abra **Financeiro**. O pagamento aparece em **"Pix informados para conferir"**. Confira no extrato do seu banco e:
   - clique em **Confirmar**: a fatura fica paga e, se a barbearia estava suspensa por atraso, ela volta ao ar sozinha; ou
   - clique em **Não encontrei** e escreva o motivo: o dono vê o motivo e pode avisar de novo.
5. Enquanto você não confere, o aviso "Já paguei" segura a suspensão automática por até **3 dias**.

## Ativar (2 passos)

1. **Migração 13:** cole e execute `supabase/migrations/20261123000013_pix_direto.sql` no SQL Editor do Supabase.
2. **Cadastrar a chave:** no Barber Control, abra **Assinaturas → Planos e regras → Recebimento por Pix → Configurar** e preencha:
   - **Chave Pix:** CPF, CNPJ, e-mail, telefone no formato `+5562999990000` ou chave aleatória;
   - **Nome do recebedor:** como aparece no seu banco, com até 25 letras;
   - **Cidade;**
   - **Mostrar o Pix para as barbearias:** Sim.

Pronto. A partir daí, o "Minha assinatura" de todas as barbearias mostra o Pix.

## Conferir antes de valer

Antes de usar com clientes, faça um teste: pague uma fatura de teste com o seu próprio celular e confira se o app do banco mostra o **seu nome** e o **valor certo** antes de confirmar.

Se um dia quiser confirmação automática, o código do Mercado Pago continua pronto (`ATIVAR-MERCADO-PAGO.md`, opcional).
