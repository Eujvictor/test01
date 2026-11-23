# Roteiro de teste geral

Faça o teste com calma e marque cada item. Se algo der errado, anote o número do item e a mensagem que apareceu.

Use **Ctrl+F5** ao abrir cada página, para carregar a versão nova.

- **Barber Control (você, Master):** https://eujvictor.github.io/test01/barber-control/login.html
- **Painel da barbearia (dono da big bigode, em janela anônima):** https://eujvictor.github.io/test01/area-equipe.html
- **Site da barbearia:** https://eujvictor.github.io/test01/?b=bigbigode

## A. Barber Control

1. [ ] **Login:** pede o código do autenticador e abre a Visão geral.
2. [ ] **Menu:** nenhum item mostra a etiqueta "Demo" e Marketing, Monitoramento e Backups não aparecem.
3. [ ] **Visão geral:** mostra os totais, a tabela "Por barbearia", o bloco de Suporte e o bloco Financeiro com valores (podem ser R$ 0,00).
4. [ ] **Barbearias:** lista a Navalha (Referência) e a big bigode. Abra a big bigode.
5. [ ] **Assinaturas:**
   - a big bigode aparece "Em teste" e a Navalha "Isenta";
   - na aba **Planos e regras**, a suspensão está em **60 dias**.
6. [ ] **Financeiro:** abre sem erro. Pode estar vazio se ainda não houver fatura.
7. [ ] **Usuários:** você aparece como "Administrador do SaaS" com duas etapas ativa, e os donos aparecem com a barbearia deles.
8. [ ] **Agendamentos e atividade:**
   - os números batem com o que você conhece;
   - ao clicar na big bigode no ranking, a tela mostra só os dados dela.
9. [ ] **Suporte:** abre sem erro. O chamado de teste é criado no item B2.
10. [ ] **Notificações:** crie um comunicado **só para a big bigode** e publique.
11. [ ] **Segurança:** mostra "Duas etapas nos administradores: 1 de 1" e a lista de proteções ativas.
12. [ ] **Relatórios:** abra "Barbearias" e baixe em **CSV**, **Excel** e **PDF**. Os arquivos não devem ter "DEMO" no nome.
13. [ ] **Inteligência:** mostra o risco de cada barbearia e explica as regras do cálculo.
14. [ ] **Configurações:** mostra o Supabase e o control-admin como "Operacional" e o Mercado Pago como "Pendente".
15. [ ] **Atualizações, Funcionalidades, Histórico e Roadmap:** em cada um, crie um registro, edite e exclua.
16. [ ] **Auditoria:** as ações dos itens 10 e 15 aparecem na lista.

## B. Painel da barbearia (dono da big bigode)

1. [ ] **Comunicado:** o do item A10 aparece no topo. Clique em **Entendi** e ele some. No Barber Control, em Notificações, a coluna "Lido por" passa para 1.
2. [ ] **Suporte:** clique em **Novo chamado** e envie. No Barber Control, em **Suporte**, responda. De volta ao painel, aparece o contador vermelho e a resposta, assinada como "Suporte Barber".
3. [ ] **Minha assinatura:** mostra o plano Basic em teste, com a data de fim do teste.
4. [ ] **Alterar minha senha:** funciona.
5. [ ] **Isolamento:** o painel mostra só os serviços e barbeiros da big bigode.

## C. Site da barbearia

1. [ ] `?b=bigbigode` mostra só os dados da big bigode, sem nada da Navalha.
2. [ ] O site sem `?b=` mostra a Navalha normalmente.
3. [ ] **Agendamento de teste:** faça um agendamento no site da big bigode. Ele aparece no painel dela e em **Agendamentos e atividade** no Barber Control.

## D. Suspensão (opcional, demora 1 minuto)

1. [ ] No Barber Control, **suspenda** a big bigode. O site mostra "indisponível" e o painel do dono fica só para consulta, mas o Suporte e "Minha assinatura" continuam funcionando.
2. [ ] **Ative** de novo e tudo volta ao normal.

## Por último: Mercado Pago

Siga `ATIVAR-MERCADO-PAGO.md`. Para testar a cobrança sem esperar o fim do teste, use os passos 1 e 2 da seção "Teste ponta a ponta" desse guia: deixe a big bigode "Em teste" com a data de hoje e clique em "Executar rotina agora". Isso gera uma fatura na hora.
