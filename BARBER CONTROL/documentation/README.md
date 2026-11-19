# BARBER CONTROL — Guia de instalação

> Documentação completa (20 módulos, dados, limitações, integrações e testes):
> [DOCUMENTACAO-FINAL.md](DOCUMENTACAO-FINAL.md) · situação de cada módulo:
> [CHECKLIST-MODULOS.md](CHECKLIST-MODULOS.md).
>
> Os passos abaixo são da integração real (Fase 1). Para só navegar, veja
> "Modo demonstração" no fim deste arquivo.

Central administrativa privada do SaaS Barber. Projeto independente do sistema
Barber (`SITE DE AGENDAMENTO/`), que não é alterado.

## Passo a passo

### 1. Banco de dados (Supabase → SQL Editor)

1. Rode `supabase/migrations/20261117000001_control_fundacao.sql`.
2. Crie a conta do administrador em **Authentication → Users → Add user**
   (marque **Auto Confirm User**). Use uma senha forte e exclusiva.
3. Abra `supabase/migrations/20261117000002_control_administrador.sql`,
   troque `SEU_EMAIL_AQUI` pelo e-mail do administrador e rode. A consulta final
   deve mostrar `conta_existe = true` e `email_confirmado = true`.

### 2. Expor somente o schema de funções

**Project Settings → Data API → Exposed schemas** → adicionar `control_api`.

Não exponha o schema `control`, que guarda as tabelas privadas.

### 3. MFA

**Authentication → Sign In / Providers → Multi-Factor** → TOTP habilitado
(vem habilitado por padrão).

### 4. Edge Functions

Com o Supabase CLI (`npm i -g supabase`):

```bash
cd "BARBER CONTROL"
supabase login
supabase functions deploy control-login --project-ref cjwmzbknarafinftpqsv --no-verify-jwt
supabase functions deploy control-admin --project-ref cjwmzbknarafinftpqsv --no-verify-jwt
supabase secrets set CONTROL_ALLOWED_ORIGINS="https://SEU-DOMINIO-DO-CONTROL" --project-ref cjwmzbknarafinftpqsv
```

`--no-verify-jwt` é intencional: as funções validam o token manualmente
(`auth.getUser` + MFA + administrador). `SUPABASE_SERVICE_ROLE_KEY` é injetada
automaticamente pelo Supabase e nunca vai para o navegador.

### 5. Testes de segurança

Rode `supabase/tests/fase1_seguranca.sql` no SQL Editor. Todas as linhas devem
começar com `OK`. O script termina em `ROLLBACK` e não grava nada.

### 6. Rodar localmente

Módulos ES não funcionam abrindo o arquivo direto (`file://`). Use um servidor:

```bash
cd "BARBER CONTROL"
npx serve .        # ou a extensão Live Server do VS Code
```

### 7. Publicar (implantação independente)

Recomendado: **Cloudflare Pages** ou **Netlify**, apontando para a pasta
`BARBER CONTROL` do repositório, sem comando de build. O arquivo `_headers`
aplica CSP, anti-iframe e `noindex`. Depois, adicione a URL publicada em:

- `CONTROL_ALLOWED_ORIGINS` (passo 4);
- **Authentication → URL Configuration → Redirect URLs**.

## Primeiro acesso

1. E-mail e senha.
2. O sistema exibe um QR code: escaneie com Google Authenticator ou similar.
3. Digite o código de 6 dígitos. A partir daí, todo login exige o código.

## Estrutura

Resumo (detalhes em DOCUMENTACAO-FINAL.md, seção 2):

```
BARBER CONTROL/
├── index.html · login.html · dashboard.html · _headers · robots.txt
├── assets/ · config/
├── css/               tokens + estilos por fase (inclui inteligencia.css, Fase 6)
├── js/                app · auth · navegação · components/ · utilities/ (csv, xlsx, pdf, exportar…)
├── modules/           registry + uma pasta por módulo (01–20) + compartilhado/
├── services/          control-api (real) · demo/ (camada demonstrativa)
├── supabase/          migrations · functions · tests
└── documentation/
```

## Modo demonstração (módulos 01 a 20)

Em ambiente local (`localhost` ou `127.0.0.1`), abra `dashboard.html?demo` para
navegar sem login. Os 20 módulos funcionam com dados fictícios salvos no
navegador. Para voltar ao estado inicial, use o botão **Restaurar dados iniciais**
na faixa amarela de cada módulo. Detalhes em `DOCUMENTACAO-FINAL.md`.
