# BARBER CONTROL — Arquitetura

## Visão geral

```
Navegador (HTML/CSS/JS, chave publishable)
   │
   ├── RPC ──────────► schema control_api   (funções security definer)
   │                      │  exigem: administrador ativo + e-mail confirmado + MFA (aal2)
   │                      ▼
   │                  schema control        (tabelas privadas, RLS sem políticas)
   │                      │  leitura protegida
   │                      ▼
   │                  schema public         (tabelas do Barber — não alteradas)
   │
   └── HTTPS ────────► Edge Functions       (service_role somente aqui)
                          control-login     anti força bruta, IP no servidor
                          control-admin     operações privilegiadas + auditoria com IP
                          (Fase 2) control-mercadopago-webhook
```

## Princípios de segurança

| Controle | Implementação |
|---|---|
| Acesso exclusivo | `control.administradores` + `control.is_admin()` (e-mail confirmado, conta ativa) |
| MFA | TOTP do Supabase Auth; o servidor exige `aal2` no JWT (`control.mfa_verificado()`) |
| Sem acesso direto às tabelas | schema `control` não exposto, RLS ligada sem políticas, `revoke all` |
| Validação no servidor | toda RPC chama `control.exigir_admin()`; Edge Functions validam token, MFA e admin |
| Segredos | `service_role` e (Fase 2) token do Mercado Pago só em secrets de Edge Functions |
| Tentativas de login | 5 falhas por e-mail+IP ou 20 por IP em 15 min → bloqueio de 15 min |
| Auditoria | `control.auditoria` só aceita inserção (trigger bloqueia UPDATE/DELETE) |
| Sessão | storage próprio (não compartilha com o Barber), expiração por inatividade de 30 min |
| Navegador | CSP rígida, `frame-ancestors 'none'`, templates com escape automático |

**Observação honesta:** o bloqueio de tentativas protege o fluxo de login do
Barber Control. Quem chamar a API de Auth do Supabase diretamente passa só pelos
limites nativos do Supabase. A proteção decisiva é o MFA: sem o código, nenhuma
RPC ou Edge Function responde.

## Multi-tenant (planejado e autorizado)

Hoje o Barber atende uma única barbearia: as tabelas não têm `barbearia_id`. Plano:

1. **Fase 1 (feito):** `control.barbearias` com a Navalha de Ouro como tenant #1.
2. **Migração compatível (fase própria, com SQL apresentado antes):**
   - adicionar `barbearia_id uuid` em `BARBEIROS`, `"SERVIÇOS"`, `clientes`,
     `agendamentos`, `configuracoes_horarios` e `configuracoes_site`, com
     **default = id da Navalha de Ouro**, para o site atual continuar funcionando;
   - índices por `barbearia_id`;
   - nova RLS por empresa (`barbearia_id` vinculado ao usuário logado), com
     vínculo usuário↔barbearia em `control.membros`.
3. **Adaptação do Barber:** as RPCs `api.criar_agendamento_publico` e
   `api.consultar_horarios_ocupados` passam a receber a barbearia (slug no URL).
   O painel admin do Barber deixa de usar e-mail fixo.
4. Só depois disso os indicadores ficam "por barbearia" no Barber Control.

## Mercado Pago (Fase 2)

- **Planos:** `control.planos` ↔ planos de assinatura do Mercado Pago (`preapproval_plan`).
- **Assinaturas:** `control.assinaturas` ↔ `preapproval` (status, próxima cobrança).
- **Pagamentos:** `control.pagamentos` alimentada por webhook.
- **Webhook:** Edge Function `control-mercadopago-webhook` valida a assinatura
  `x-signature` com o segredo do webhook e confirma cada evento consultando a API
  do Mercado Pago antes de gravar (nunca confia só no corpo recebido). É idempotente
  pelo id do evento.
- **Segredos:** `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` em `supabase secrets`.
- **Indicadores:** MRR, ARR, inadimplência e taxas calculados a partir de
  `control.pagamentos` e `control.assinaturas`.
- **Automação:** suspensão por inadimplência gera um alerta e só é aplicada por
  regra configurável, com auditoria.

## Módulos demonstrativos (Fase 2: 02 a 05)

Barbearias, Assinaturas e Planos, Financeiro e Usuários funcionam com **dados
fictícios persistidos no navegador** (`localStorage`, chave `barber-control:demo:v1`).
Nenhuma chamada ao Supabase, cobrança, conta de acesso ou gateway é feita.

```
services/demo/
├── catalogo.js   status, tipos, métodos, funcionalidades, UFs
├── seed.js       gerador determinístico dos dados iniciais (datas relativas a hoje)
├── store.js      persistência versionada + histórico
└── saas.js       regras de negócio: unicidade, relações, cálculos (MRR, ARR, inadimplência)
```

Relações: `barbearia 1─1 assinatura ─* transações`, `assinatura *─1 plano`,
`barbearia 1─* usuários` (o proprietário é um usuário do tipo `proprietario`).
O plano de uma barbearia vem só da assinatura, sem duplicar o dado.

Regras:
- nome e CNPJ de barbearia, nome de plano e e-mail de usuário são únicos;
- cancelar uma assinatura cancela a barbearia; reativar uma barbearia cancelada ou
  com assinatura vencida também reativa a assinatura, com um novo ciclo a partir de hoje;
- não é possível migrar para um plano cujo limite de barbeiros seja menor que a equipe atual;
- o MRR soma só as assinaturas `ativa` (as anuais entram divididas por 12);
- as taxas são estimativas fixas por método (Pix 0,99%, cartão 3,99%, boleto R$ 3,49).

**Na integração real (próxima etapa)**, `services/demo/saas.js` é a única camada que
muda: as mesmas funções passam a chamar RPCs do `control_api` e o webhook do Mercado
Pago. As telas não precisam mudar.

Componentes reutilizáveis em `js/components/`: `tabela` (ordenação e paginação),
`formulario` (modal com validação por campo), `abas`, `grafico` (barras SVG) e
`ui` (cabeçalho, indicadores, badges, linha do tempo, filtros).

## Módulos demonstrativos (Fase 3: 06 a 09)

Agendamentos e Atividade, Suporte, Notificações e Marketing usam as **mesmas
barbearias, usuários e planos** das Fases 1 e 2. Nenhuma empresa é criada pela operação.

```
services/demo/
├── seed-operacao.js  agendamentos, chamados, comunicados, campanhas, cupons, indicações, pesquisas
└── operacao.js       regras: séries de atividade, alertas, segmentação, suporte assistido, publicação
```

- **Agendamentos** (cerca de 14 mil, 180 dias + 14 dias de agenda futura) ficam em formato
  compacto (tupla) no localStorage, com cerca de 775 KB no total. O módulo 02 passa a mostrar
  os mesmos totais mensais.
- **Migração automática:** dados da Fase 2 já salvos no navegador são preservados; só as
  coleções novas são acrescentadas (`completarOperacao` em `store.js`).
- **Alertas de atividade** comparam os últimos 30 dias com os 30 anteriores: sem atividade há
  14 dias ou mais, queda de 30% ou mais, aumento de cancelamentos e crescimento de 30% ou mais.
- **Suporte assistido** só registra a solicitação e a autorização explícita do cliente, com
  confirmação obrigatória, validade e histórico. Não existe acesso remoto.
- **Publicações e campanhas** só mudam o status do registro. Nada é enviado por e-mail,
  WhatsApp, SMS ou para o sistema Barber, e as telas dizem isso.
- **Desempenho:** ordenação com `Intl.Collator`, contagem de 30 dias memorizada, ícones
  renderizados uma vez por ciclo e `modulepreload` dos módulos compartilhados.

## Módulos demonstrativos (Fase 4: 10 a 12 + central de alertas)

```
services/demo/
├── seed-infra.js   eventos de autenticação, sessões, incidentes, permissões, verificações,
│                   serviços, métricas de 30 dias, backups, política, recuperações, alertas
└── infra.js        regras: incidentes (segurança e técnicos), alertas com deduplicação,
                    permissões, verificação, monitoramento, backups e recuperação
modules/compartilhado/
├── incidentes.js   lista, registro e detalhe (usados pelos módulos 10 e 11)
└── alertas.js      central de alertas (módulo 10), também usada por 11 e 12
```

- **Honestidade:** a seção "Verificação de segurança" mostra a situação real do projeto.
  Nenhum item aparece como "Verificado em ambiente real", e o sistema bloqueia essa marcação
  até haver integração e um teste real. Os IPs fictícios usam as faixas de documentação (RFC 5737).
- **Alertas:** um alerta aberto idêntico (mesmo tipo e mesma referência) é agrupado, sem
  duplicar. Um incidente alto ou crítico gera alerta automaticamente. Pedidos de restauração
  geram alerta, que é resolvido quando a simulação termina ou é cancelada.
- **Integrações internas:** incidentes técnicos se vinculam a chamados (módulo 07), alertas
  geram comunicados em rascunho (módulo 08), e eventos e incidentes apontam para usuários e
  barbearias já existentes (módulos 02 e 05).
- **Pronto para produção:** as telas já separam o que virá de integrações reais (backups do
  PostgreSQL/Supabase, armazenamento externo, verificação de integridade, métricas). A troca
  acontece em `services/demo/infra.js`.

## Módulos demonstrativos (Fase 5: 13 a 16)

```
services/demo/
├── seed-evolucao.js  catálogo de funcionalidades, feature flags, liberações, grupo de testes,
│                     versões, rollbacks, histórico de alterações e ideias do roadmap
└── evolucao.js       regras: versões (formato e unicidade), distribuição gradual, rollback,
                      dependências entre funcionalidades, flags, histórico automático,
                      Kanban, votos e pontuação de priorização
modules/atualizacoes · funcionalidades · historico · roadmap
```

- **Três conceitos separados (módulo 14):** a funcionalidade do plano é o direito comercial;
  a feature flag é o interruptor técnico; a liberação individual é a exceção para uma
  barbearia. O plano não aceita uma funcionalidade cuja dependência ele não tem.
- **Catálogo único:** os módulos 02 e 03 passaram a ler o catálogo do módulo 14
  (`funcionalidadesCatalogo()` em `saas.js`), sem lista duplicada.
- **Histórico automático (módulo 15):** criar funcionalidade, publicar versão ou fazer rollback
  registra a alteração sozinho, sem duplicar (chave `chaveAuto`). Os campos de repositório,
  branch e commit ficam prontos para a integração com o GitHub; o commit é validado (7 a 40
  caracteres hexadecimais).
- **Roadmap (módulo 16):** ideias andam pelo Kanban com setas ou arrastando; cada barbearia
  vota uma vez; a pontuação de priorização é determinística e mostra os critérios. Uma ideia
  aprovada vira versão planejada no módulo 13, sem duplicar.
- **Migração dos dados:** quem já tinha dados das Fases 2 a 4 no navegador mantém tudo; as
  coleções novas são acrescentadas e os planos só ganham funcionalidades (preço e demais
  campos editados são preservados).

## Módulos demonstrativos (Fase 6: 17 a 20)

```
services/demo/
├── indicadores.js   fonte única dos números: séries mensais (base, receita, MRR,
│                    agendamentos, usuários, suporte), comparação, tendência,
│                    projeção, risco de cancelamento, rentabilidade
├── inteligencia.js  recomendações por regras explícitas, análises e projeções
├── assistente.js    consultas locais por palavras-chave (sem IA externa)
├── configuracoes.js configurações globais, validação e histórico campo a campo
└── auditoria.js     consolida eventosAuth + histórico (sem copiar registros)
js/utilities/        xlsx.js (ZIP + Office Open XML) · pdf.js (PDF 1.4) · exportar.js
modules/             relatorios (definicoes.js + index.js) · inteligencia · configuracoes · auditoria
```

- **Sem dados novos:** relatórios e inteligência calculam tudo dos módulos 02–16. Falta de dado aparece como "sem dados", nunca como zero.
- **Exportação fiel:** CSV, Excel e PDF usam as mesmas colunas e linhas da tabela exibida, com filtros.
- **Fonte única:** a retenção da auditoria (módulo 20) edita a mesma configuração de Configurações › Segurança (módulo 19).
- **Honestidade:** projeções marcadas como estimativas, com critério, R² e histórico usado; utilização = acesso liberado, não uso medido; auditoria local e alterável, não inviolável.
- **Aparência:** preferências em `barber-control:aparencia`, aplicadas por `js/app.js` sem carregar a camada demo.

## Fases

| Fase | Conteúdo | Situação |
|---|---|---|
| 0 | Diagnóstico | Concluída |
| 1 | Fundação: estrutura, identidade, login + MFA, navegação, schema control, Edge Functions | Código pronto; aguarda implantação no Supabase |
| 2 | Módulos 02–05 em modo demonstrativo | Concluída (dados locais) |
| 2b | Integração real dos módulos 02–05 (Supabase + Mercado Pago) | Próxima |
| 3 | Módulos 06–09 em modo demonstrativo | Concluída (dados locais) |
| 4 | Módulos 10–12 + central de alertas, em modo demonstrativo | Concluída (dados locais) |
| 5 | Módulos 13–16 em modo demonstrativo | Concluída (dados locais) |
| 6 | Módulos 17–20 em modo demonstrativo + revisão geral | Concluída (dados locais) |
| 7 | Testes finais | — |
