# BARBER CONTROL — Documentação final (Fases 0 a 6)

Situação em 18/11/2026: os 20 módulos estão implementados em **modo demonstrativo**
(dados fictícios no navegador). Nenhum módulo usa dados reais ainda; a integração
com o Supabase e com serviços externos é a próxima etapa. A lista de verificação
módulo a módulo está em [CHECKLIST-MODULOS.md](CHECKLIST-MODULOS.md).

---

## 1. Visão geral

O BARBER CONTROL é a central administrativa privada do proprietário do SaaS Barber.
Ele gerencia as barbearias clientes, os planos e assinaturas, o financeiro, a operação,
a segurança, a evolução do produto e, a partir da Fase 6, relatórios, inteligência de
negócio, configurações globais e auditoria.

É um projeto **separado** do sistema Barber (`SITE DE AGENDAMENTO/`), que não foi
alterado. Os dois só vão se comunicar pelo banco (Supabase), com isolamento por
`barbearia_id` na migração multi-tenant planejada.

| Grupo | Módulos |
|---|---|
| Gestão empresarial | 01 Visão geral · 02 Barbearias · 03 Assinaturas e planos · 04 Financeiro · 05 Usuários |
| Operação | 06 Agendamentos e atividade · 07 Suporte · 08 Notificações · 09 Marketing e relacionamento |
| Segurança e infraestrutura | 10 Segurança · 11 Monitoramento técnico · 12 Backups e recuperação |
| Desenvolvimento | 13 Atualizações e versões · 14 Funcionalidades · 15 Histórico de alterações · 16 Roadmap e solicitações |
| Inteligência | 17 Relatórios e métricas · 18 Inteligência de negócio · 19 Configurações gerais · 20 Auditoria e acessos |

## 2. Estrutura de pastas

```
BARBER CONTROL/
├── index.html · login.html · dashboard.html   páginas (dashboard = painel com roteador por hash)
├── _headers · robots.txt                      CSP e cabeçalhos de segurança · noindex
├── assets/                                    logo
├── config/app.config.js                       configuração pública (sem segredos) e versão
├── css/                                       tokens (variables) + estilos por fase
│   └── variables · global · layout · components · gestao · operacao · infra · evolucao · inteligencia · responsive
├── js/
│   ├── app.js · auth.js · login.js · navigation.js · supabase.js · dashboard.js · demo.js
│   ├── components/   ui · tabela · formulario · painel · abas · grafico
│   └── utilities/    dom · format · feedback · csv · xlsx · pdf · exportar
├── modules/          registry.js + uma pasta por módulo (01–20) + compartilhado/ + planejado.js
├── services/
│   ├── control-api.js                         chamadas reais (RPC control_api + Edge Functions)
│   └── demo/                                  camada demonstrativa (localStorage)
│       ├── store.js                           persistência e migração dos dados
│       ├── seed*.js · catalogo.js             geração dos dados fictícios e catálogos
│       ├── saas · operacao · infra · evolucao regras dos módulos 02–16
│       └── indicadores · inteligencia · assistente · configuracoes · auditoria   (Fase 6)
├── supabase/         migrations · functions (control-login, control-admin) · tests
└── documentation/    README · ARQUITETURA · DOCUMENTACAO-FINAL · CHECKLIST-MODULOS
```

## 3. Descrição dos 20 módulos

| Nº | Módulo | O que faz |
|---|---|---|
| 01 | Visão geral | Painel inicial com os principais números e atalhos. |
| 02 | Barbearias | Cadastro, perfil, plano, suspensão/reativação, liberação de funcionalidades, histórico. |
| 03 | Assinaturas e planos | Planos (preços, limites, teste), assinaturas, troca de plano, cancelamento e reativação. |
| 04 | Financeiro | Receita bruta/líquida, MRR/ARR, transações, inadimplência, despesas, exportação CSV. |
| 05 | Usuários | Proprietários, barbeiros, funcionários e clientes; suspensão e reativação. |
| 06 | Agendamentos e atividade | Agendamentos por período, cancelamentos, serviços, horários de pico, empresas ativas/inativas. |
| 07 | Suporte | Chamados com protocolo, prioridade, respostas, notas internas e suporte assistido com autorização. |
| 08 | Notificações | Comunicados segmentados, agendamento, publicação e arquivamento. |
| 09 | Marketing e relacionamento | Campanhas, cupons, indicações, pesquisas de satisfação e segmentação. |
| 10 | Segurança | Eventos de login, tentativas suspeitas, incidentes, permissões, verificação e alertas. |
| 11 | Monitoramento técnico | Disponibilidade, latência, erros, serviços e incidentes técnicos (simulados). |
| 12 | Backups e recuperação | Histórico, política de retenção, integridade, restauração e continuidade (simulados). |
| 13 | Atualizações e versões | Versões, distribuição gradual, interrupção e rollback. |
| 14 | Funcionalidades | Catálogo, associação com planos, feature flags, liberações individuais e dependências. |
| 15 | Histórico de alterações | Mudanças de desenvolvimento e administração, com referências técnicas (GitHub previsto). |
| 16 | Roadmap e solicitações | Ideias, Kanban, votação, priorização e conversão em versão. |
| 17 | Relatórios e métricas | 13 indicadores, 8 gráficos e 10 relatórios em 9 categorias, com filtros, comparação de períodos, tendência, origem dos dados e exportação CSV, Excel e PDF. |
| 18 | Inteligência de negócio | Painel estratégico, 8 análises, projeções com critérios, recomendações por regras, empresas em risco e assistente de consultas locais. |
| 19 | Configurações gerais | 8 categorias (identidade, comercial, acesso, segurança, comunicação, integrações, aparência, técnicas) com salvar, cancelar, restaurar padrão e histórico. |
| 20 | Auditoria e acessos | Eventos de acesso e operações de todos os módulos, detalhes, filtros, sessões, retenção e exportação CSV. |

## 4. Tecnologias utilizadas

- HTML, CSS e JavaScript (módulos ES nativos), **sem etapa de build** e sem framework.
- Ícones: Lucide 0.460.0 (CDN unpkg). Fonte: Inter (Google Fonts).
- Supabase JS 2.45.4 (CDN jsdelivr), usado só no modo real.
- Gráficos em SVG próprios (`js/components/grafico.js`).
- Exportação própria, sem bibliotecas: CSV (`csv.js`), Excel .xlsx (`xlsx.js`: ZIP + Office Open XML) e PDF 1.4 (`pdf.js`, fontes Helvetica padrão). Motivo: a CSP só permite scripts das CDNs listadas.
- Backend preparado (Fase 1): PostgreSQL com schema privado `control`, schema de API `control_api`, RLS e Edge Functions em Deno/TypeScript.

## 5. Como executar localmente

Os módulos ES não funcionam com `file://`. Use qualquer servidor estático:

```bash
cd "BARBER CONTROL"
npx serve .            # ou a extensão Live Server do VS Code
```

- **Modo demonstração** (sem login): `http://localhost:PORTA/dashboard.html?demo`. Só funciona em `localhost`/`127.0.0.1`.
- **Modo real**: `login.html`. Exige o Supabase configurado (ver README.md, Fase 1), conta de administrador e MFA.

## 6. Como funcionam os dados demonstrativos

- Na primeira abertura, `services/demo/seed*.js` gera um conjunto fictício e coerente: barbearias, planos, assinaturas, transações de vários meses, despesas, usuários, cerca de 14 mil agendamentos dos últimos 180 dias, chamados, comunicados, campanhas, eventos de login, incidentes, backups, versões, funcionalidades, mudanças e ideias.
- Todos os módulos leem os **mesmos** registros. Exemplo: a receita do módulo 17 é a soma das transações pagas do módulo 04, e o MRR é o mesmo cálculo.
- Toda operação passa pela camada de regras (`services/demo/*.js`), que valida, grava e registra no histórico. É desse histórico que vem a auditoria do módulo 20.
- A Fase 6 **não criou** dados novos para relatórios: `indicadores.js` calcula tudo a partir dos registros existentes. Quando falta dado, a tela informa (por exemplo, "registros de agendamento começam em …") em vez de mostrar zero.
- Cada tela identifica os dados como demonstrativos e oferece "Restaurar dados iniciais".

## 7. Onde os dados são armazenados

| Chave do localStorage | Conteúdo |
|---|---|
| `barber-control:demo:v1` | Todas as coleções demonstrativas e as configurações (módulos 02–20), com migração automática entre fases |
| `barber-control:aparencia` | Preferências de aparência do módulo 19, lidas na abertura do painel |
| `barber-control-auth` | Sessão do modo real (Supabase), separada do login do Barber |

Os dados ficam só no navegador onde foram criados: não são compartilhados entre
computadores e somem se o armazenamento do site for limpo.

## 8. Limitações da versão atual

- Nada é real: cobranças, e-mails, sessões, backups, monitoramento e integrações são simulados.
- Não há separação de usuários administrativos na versão demo: o "responsável" das operações é o "Proprietário do SaaS (demonstrativo)".
- A auditoria do módulo 20 é **alterável** por quem usa o navegador; não é trilha inviolável.
- O assistente do módulo 18 entende um conjunto fixo de perguntas (palavras-chave); não usa IA.
- As projeções são regressão linear simples sobre dados fictícios; não consideram sazonalidade. Quando o ajuste é fraco (R² < 0,3), a tela avisa.
- "Utilização dos módulos" mostra **acesso liberado**, não uso medido: não há telemetria de uso por funcionalidade.
- Filtros de plano e status nos relatórios usam a situação **atual** de cada barbearia (o histórico de troca de plano não é versionado).
- Agendamentos existem só para os últimos 180 dias; períodos anteriores aparecem como "sem dados".
- O sistema Barber ainda é de uma única barbearia; o multi-tenant está planejado.

## 9. Integrações ainda pendentes

| Integração | Situação | Módulos |
|---|---|---|
| Supabase (schema `control`, Edge Functions) | Código pronto na Fase 1; migrações e funções ainda não aplicadas | Todos |
| Migração multi-tenant do Barber (`barbearia_id`) | Aprovada, não iniciada | 02, 06, 20 |
| Mercado Pago (assinaturas e webhooks) | Pendente | 03, 04 |
| Serviço de e-mail | Pendente | 08, 09, 19 |
| GitHub (commits, versões) | Pendente | 13, 15 |
| Monitoramento real | Pendente | 11 |
| Armazenamento externo de backups | Pendente | 12 |

O módulo 19 › Integrações mostra cada uma como "Pendente de integração", com a
configuração necessária, e não solicita nem armazena credenciais.

## 10. Recomendações para a integração com o Supabase

1. Aplicar as migrações da Fase 1 e expor **somente** `control_api`.
2. Trocar cada `services/demo/*.js` por um serviço real com a mesma interface de funções. As telas já chamam funções de serviço, não o localStorage diretamente.
3. Criar os indicadores do módulo 17 como **views ou funções SQL** (agregação no banco), e não baixar as tabelas inteiras para o navegador.
4. Fazer a migração multi-tenant do Barber: `barbearia_id` em todas as tabelas, RLS por barbearia, Navalha de Ouro como barbearia padrão.
5. Gravar a auditoria em tabela **somente de inserção** (sem UPDATE/DELETE para nenhum papel), preenchida por triggers e pelas Edge Functions, com `auth.uid()` real como responsável.
6. Guardar as configurações do módulo 19 em tabela própria, com histórico por trigger.
7. Manter todos os segredos (service role, Mercado Pago, e-mail, GitHub) apenas nas Edge Functions.

## 11. Recomendações de segurança

- Nunca colocar `service_role`, tokens ou senhas no JavaScript do navegador (já respeitado: `config/app.config.js` só tem a chave publicável).
- Exigir MFA (aal2) em toda função administrativa (já implementado em `control.is_admin()` e nas Edge Functions).
- Manter a CSP de `_headers` sem `unsafe-inline` e sem novos domínios de script.
- Limitar tentativas de login no servidor (módulo 19 › Acesso descreve os parâmetros).
- Auditoria persistente e protegida no backend, com retenção definida (módulo 19 › Segurança).
- Revisar as políticas RLS com os testes de `supabase/tests/` a cada migração.
- Não publicar o modo demonstração em produção: ele só abre em `localhost`.

## 12. Plano de testes

Os testes foram executados em Chrome sem interface (headless), via DevTools Protocol,
com os scripts da pasta temporária do projeto. Resultados da Fase 6 (18/11/2026):

| Bateria | O que cobre | Resultado |
|---|---|---|
| Funcional da Fase 6 | navegação 17–20, indicadores conferidos com cálculos independentes, filtros, comparação, exportações, assistente, recomendações, configurações, restauração, auditoria (registro, pesquisa, filtros, detalhes, sessões, retenção, exportação) | 96/96 |
| Validação dos arquivos | ZIP/CRC/XML do .xlsx, xref/objetos/fluxos do PDF, conteúdo filtrado | incluída nas 96 |
| Persistência após recarregar | configurações, aparência aplicada ao abrir, conversa do assistente, auditoria | 12/12 |
| Responsividade | 32 telas dos módulos 17–20 em 390, 768 e 1440 px | 96/96 |
| Varredura de botões | 133 botões das 32 telas dos módulos 17–20 | 131 com efeito; 2 casos analisados sem defeito (ver nota) |
| Regressão | abertura dos 20 módulos (com console) e suítes das Fases 2–5 | 22/22 · 18/18 · 27/27 · 28/28 · 45/45 · 83/83 · 69/69 · 66/66 |

Nota da varredura: "Limpar" em Acessos não muda nada quando o filtro aplicado pelo teste é o período (os eventos de acesso cobrem só 14 dias); com o filtro de tipo, funciona (364 → 46 → 364). Nos relatórios de situação atual, o seletor de período passou a ficar desabilitado.

Para repetir: subir um servidor na pasta, abrir `dashboard.html?demo` e executar os
roteiros de teste no console (ou pelo DevTools Protocol).
