# Barber Control — Auditoria e plano multi-tenant

Data: 18/11/2026. Situação: **proposta para aprovação**. Nenhuma alteração foi feita no Supabase.

## 1. Auditoria: o que já existe

### Sistema da barbearia (`SITE DE AGENDAMENTO/` e cópia publicada em `docs/`)

| Parte | Tabelas / recursos usados |
|---|---|
| Site público (`index.html`, `site-config.js`, `servicos-home.js`, `js/script.js`) | lê `configuracoes_site`, `configuracoes_horarios`, `SERVIÇOS`, `BARBEIROS` |
| Agendamento (`agendar.html`) | lê `SERVIÇOS`, `BARBEIROS` (inclui telefone), `configuracoes_horarios`; cria agendamento por `api.criar_agendamento_publico` e consulta `api.consultar_horarios_ocupados`; usa Realtime |
| Login da equipe (`area-equipe.html`) | `auth.signInWithPassword` e manda sempre para o painel admin |
| Painel admin (`painel-admin-.html`) | lê e grava as 6 tabelas; envia imagens ao bucket `site-imagens` (pastas `logo/`, `banner/`, `portfolio/`) |
| Proteção do painel (`proteger-admin.js`) | libera só um e-mail fixo no código (`navalhadeouro@…`) |
| Painel do barbeiro (`painel-barbeiro.html`) | **não usa o banco**: dados fixos de demonstração |

### Banco (verificado com a chave pública, somente leitura)

| Tabela | Acesso público | Colunas principais |
|---|---|---|
| `BARBEIROS` | leitura liberada (5 registros, **inclui telefone**) | id, created_em, nome, especialidade, telefone, ativo |
| `SERVIÇOS` | leitura liberada (5 registros) | id, created_at, nome, preço, duraçao, ativo |
| `configuracoes_site` | leitura liberada (1 linha) | ~60 colunas de conteúdo; **sem** `cor_botoes`/`cor_detalhes` (SQL das cores ainda não aplicado) |
| `configuracoes_horarios` | leitura liberada (1 linha) | horários, dias, bloqueios (WhatsApp guardado dentro de `horarios_bloqueados`) |
| `agendamentos` | bloqueado ao público ✔ | — |
| `clientes` | bloqueado ao público ✔ | — |

Nenhuma tabela tem identificação de barbearia: o sistema é de **uma barbearia só**.
As políticas de escrita (pelo arquivo `sql/configuracoes_site.sql`) liberam um **e-mail fixo**.

### Barber Control (`BARBER CONTROL/`)

- Fase 1 (SQL e Edge Functions) **pronta e não aplicada**: schema privado `control` com
  `administradores`, `barbearias` (já com `codigo` único = slug e status teste/ativa/suspensa/cancelada),
  `auditoria` (somente inserção) e `tentativas_login`; schema `control_api` com funções protegidas por
  administrador + MFA; Edge Functions `control-login` e `control-admin`.
- Módulos 02–20 funcionam só com dados demonstrativos no navegador.

### Pontos de atenção encontrados

1. **Telefone dos barbeiros é público**: qualquer pessoa lê `BARBEIROS.telefone` (o agendamento usa
   para o WhatsApp do barbeiro).
2. **Permissão por e-mail fixo** no código e nas políticas: não escala para várias barbearias.
3. Nomes de tabela/coluna com maiúsculas e acentos (`"SERVIÇOS"`, `"preço"`, `"duraçao"`,
   `created_em`). **Serão mantidos** para não quebrar o que funciona.
4. WhatsApp da barbearia guardado dentro de `horarios_bloqueados` (`__whatsapp_config`): funciona, mas
   mistura assuntos. Mantido nesta etapa.

Falta conferir no banco (pela consulta `supabase/auditoria/00_auditoria_somente_leitura.sql`):
políticas RLS atuais de todas as tabelas, código das funções `api.*`, chaves estrangeiras,
gatilhos, políticas do Storage e se a Fase 1 já foi aplicada.

## 2. Arquitetura proposta

```
                 ┌──────────────── Supabase (um banco) ────────────────┐
 Painel Master   │ control.administradores  (você, com MFA)            │
 (Barber Control)│ control.barbearias       (cadastro: slug, status)   │
                 │ control.membros   (usuário → barbearia → papel)     │
                 │                                                     │
 Painel da       │ public."BARBEIROS" · "SERVIÇOS" · agendamentos ·    │
 barbearia       │ clientes · configuracoes_site · configuracoes_horarios
                 │        + barbearia_id (obrigatório) em todas         │
 Site público    │ RLS: dono vê/edita só a própria; público lê só       │
 (?b=slug)       │ o necessário de barbearias ativas/em teste           │
                 │ Storage site-imagens/barbearias/<id>/...             │
                 └─────────────────────────────────────────────────────┘
```

- **Cadastro único**: `control.barbearias` (já previsto na Fase 1) passa a ser a tabela-mãe.
  A Navalha de Ouro é a barbearia nº 1 e recebe todos os registros atuais.
- **Acesso**: nova tabela `control.membros (user_id, barbearia_id, papel)`. Só o Master
  cria/altera vínculos (função no servidor). Ninguém altera o próprio papel: a tabela não tem
  permissão de escrita para usuários comuns.
- **Funções de checagem no banco** (SECURITY DEFINER, `search_path` fixo):
  `control.barbearias_do_usuario()`, `control.pode_gerenciar(barbearia_id)`, `control.is_admin()`.
- **Site público**: identifica a barbearia pelo slug (`?b=navalha-de-ouro`). Sem slug, abre a
  Navalha de Ouro (o endereço atual continua funcionando). Coluna `dominio` preparada para
  domínio próprio no futuro.
- **Painel da barbearia**: após o login, `api.minha_barbearia()` diz qual barbearia o usuário
  administra; o e-mail fixo sai do código.
- **Painel Master**: o módulo 02 do Barber Control passa a usar o banco real (cadastrar, editar,
  ativar/desativar, ver todas, gerenciar proprietários). Criar a conta do proprietário exige o
  servidor (Edge Function `control-admin`, com a chave secreta só lá).

## 3. Migrações planejadas (em ordem; nenhuma apaga dados)

| Nº | Arquivo | O que faz |
|---|---|---|
| 1 | `…01_control_fundacao.sql` (existe) | schemas `control`/`control_api`, Navalha como barbearia nº 1 |
| 2 | `…02_control_administrador.sql` (existe) | você como Master |
| 3 | `…03_tenant_nucleo.sql` | `control.membros`, colunas `dominio`/`ativa`, funções de checagem, `api.minha_barbearia()`, `api.barbearia_por_slug()`; vínculo do usuário atual da Navalha como proprietário |
| 4 | `…04_tenant_colunas.sql` | `barbearia_id` nas 6 tabelas, preenchido com a Navalha; chaves estrangeiras; índices; 1 configuração por barbearia; impede trocar `barbearia_id` depois de criado |
| 5 | `…05_tenant_rls.sql` | **substitui** as políticas atuais (por e-mail) por políticas por barbearia; público só lê barbearias ativas/em teste; telefone do barbeiro sai da leitura pública |
| 6 | `…06_tenant_api.sql` | `api.criar_agendamento_publico` e `api.consultar_horarios_ocupados` recebem a barbearia (versões antigas mantidas, apontando para a Navalha, até o site novo entrar) |
| 7 | `…07_tenant_storage.sql` | políticas do bucket por pasta `barbearias/<id>/`; arquivos antigos mantidos |
| 8 | `…08_cores_tema.sql` | `cor_botoes`/`cor_detalhes` (o SQL já entregue), incluído na sequência |

A migração 5 **remove políticas antigas** (não dados). Ela só roda com a sua autorização
explícita, depois de você ver o SQL.

## 4. Imagens (Storage)

```
site-imagens/
  barbearias/<barbearia_id>/identidade/logo.webp
  barbearias/<barbearia_id>/banner/banner.webp
  barbearias/<barbearia_id>/portfolio/imagem-1.webp … imagem-4.webp
```

- Conversão para WebP e redimensionamento **no navegador** antes do envio (logo 512 px,
  banner 1920 px, portfólio 1200 px); só JPG, PNG e WebP; limite de 5 MB por arquivo.
- A pré-visualização usa o próprio arquivo convertido (antes de enviar) e depois a URL pública
  do mesmo arquivo; nenhum arquivo extra é criado.
- Substituir = sobrescrever o mesmo caminho; a URL salva leva `?v=<data>` para o navegador não
  mostrar a imagem antiga. Excluir = remove o arquivo e limpa o campo no banco.
- Política: leitura pública; gravar/substituir/excluir só se a pasta for de uma barbearia que o
  usuário administra (ou Master).
- Arquivos atuais (`logo/`, `banner/`, `portfolio/`) **não são apagados**; continuam valendo até
  serem substituídos.

## 5. Testes

As migrações e políticas serão testadas antes, em um PostgreSQL real rodando localmente
(PGlite), simulando os papéis do Supabase (`anon`, `authenticated`, Master) e o Storage.
Os 12 cenários pedidos viram testes automáticos, incluindo tentativas de ler e alterar dados
de outra barbearia. O teste final no seu banco precisa de você (rodar o SQL e fazer login).

## 6. Situação da Etapa 1 (SQL) — 18/11/2026

Auditoria completa recebida (2 consultas somente leitura). Achados adicionais:
o bucket `site-imagens` não existe (envio de imagens falha hoje); `configuracoes_site`
não tem política de inserção; o público tinha INSERT/UPDATE/DELETE/TRUNCATE concedidos
em `configuracoes_site` (barrados por RLS, exceto TRUNCATE, que a API não expõe);
`clientes.telefone` era único no sistema todo.

Migrações escritas em `supabase/migrations/20261118000003` a `…08`, testadas em
PostgreSQL 16 (PGlite) sobre uma reprodução do banco atual: **76 de 76 testes**,
incluindo os 12 cenários pedidos, tentativas de acesso entre barbearias, compatibilidade
com o site e o painel atuais, preservação de todos os registros e reaplicação
(idempotência).

Ordem de aplicação:
1. `20261117000001_control_fundacao.sql`
2. criar a conta Master em Authentication → Users e aplicar `20261117000002` com o e-mail
3. `03`, `04`, `05`, `07`, `08` (compatíveis com o site e o painel atuais)
4. **depois** de publicado o site/painel novos (Etapa 2): `06` (troca das políticas RLS)

## 7. Conclusão — 18/11/2026

Teste ponta a ponta no Supabase real concluído pelo proprietário do SaaS:
login Master com MFA, criação da barbearia de teste (`?b=bigbigode`), criação do
acesso do proprietário, login do dono em outro navegador, cadastro de serviço e
barbeiro, site isolado da Navalha, suspensão (site indisponível + painel só consulta)
e reativação. Correção publicada no mesmo dia (commit `173225d`): barbearias novas
não herdam nome, Instagram, endereço, telefone e direitos da Navalha.
Etapas 1 a 8 do projeto multi-tenant: concluídas.
