// ARQUIVO GERADO por supabase/ferramentas/gerar-funcoes-painel.cjs — não edite aqui.
// Cole no painel do Supabase: Edge Functions → Deploy a new function → Via Editor,
// nome da função: control-admin. Depois, em Settings da função, DESLIGUE "Verify JWT".

// =====================================================================
// BARBER CONTROL — Edge Function: control-admin
// Porta de entrada para operações privilegiadas. Toda chamada:
//   1. valida o token no servidor de Auth (auth.getUser);
//   2. exige MFA concluído (aal2);
//   3. confirma no banco que o usuário é administrador ativo;
//   4. só então executa a ação, com a service_role guardada aqui.
//
// POST { acao: "status" }
// POST { acao: "registrar_acesso", evento: "login" | "mfa_ativado" }
// POST { acao: "criar_proprietario", barbearia_id, email, nome? }
//      Cria a conta de login do proprietário (com senha temporária,
//      mostrada UMA vez ao administrador) e vincula à barbearia.
//      Se a conta já existir, apenas vincula.
//
// verify_jwt = false: a validação é feita manualmente abaixo, o que
// funciona tanto com chaves JWT legadas quanto com as novas chaves.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// ----- código de _shared/http.ts (embutido para o editor do painel) -----
// Utilidades HTTP compartilhadas pelas Edge Functions do Barber Control.

// Origens permitidas: variável de ambiente CONTROL_ALLOWED_ORIGINS
// (lista separada por vírgula). Sem a variável, libera qualquer origem —
// use apenas em desenvolvimento. CORS não substitui autenticação.
const ORIGENS = (Deno.env.get("CONTROL_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function cabecalhosCors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") ?? "";
  const permitida = ORIGENS.length === 0 ? "*" : (ORIGENS.includes(origem) ? origem : ORIGENS[0]);
  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function responderJson(corpo: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// IP do cliente a partir dos cabeçalhos do proxy do Supabase.
export function obterIp(req: Request): string | null {
  const candidato =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    req.headers.get("x-real-ip") ??
    "";
  const ip = candidato.trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

export function obterUserAgent(req: Request): string {
  return (req.headers.get("user-agent") ?? "").slice(0, 300);
}

// Lê o payload de um JWT JÁ VALIDADO (a validação é feita por auth.getUser).
export function lerPayloadJwt(token: string): Record<string, unknown> {
  const parte = token.split(".")[1] ?? "";
  const base64 = parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "=");
  try {
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

// ----- fim do código compartilhado -----


const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERSAO = "multitenant-0.2.0";

// Senha temporária forte: 16 caracteres com maiúscula, minúscula, número e símbolo.
function senhaTemporaria(): string {
  const grupos = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*?-_"];
  const todos = grupos.join("");
  const sorteio = (alfabeto: string) => {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    return alfabeto[n[0] % alfabeto.length];
  };
  const chars = [...grupos.map(sorteio), ...Array.from({ length: 12 }, () => sorteio(todos))];
  for (let i = chars.length - 1; i > 0; i--) {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    const j = n[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const servico = createClient(URL_SUPABASE, CHAVE_SERVICO, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "control_api" },
});

const EVENTOS_PERMITIDOS = new Set(["login", "mfa_ativado"]);

Deno.serve(async (req) => {
  const cors = cabecalhosCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responderJson({ erro: "Método não permitido." }, 405, cors);

  // 1. Token
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return responderJson({ erro: "Não autenticado." }, 401, cors);

  const { data: dadosUsuario, error: erroUsuario } = await servico.auth.getUser(token);
  const usuario = dadosUsuario?.user;
  if (erroUsuario || !usuario) return responderJson({ erro: "Sessão inválida ou expirada." }, 401, cors);

  // 2. MFA
  if (lerPayloadJwt(token).aal !== "aal2") {
    return responderJson({ erro: "Verificação em duas etapas obrigatória." }, 403, cors);
  }

  // 3. Administrador (consulta feita COM o token do usuário)
  const comoUsuario = createClient(URL_SUPABASE, CHAVE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
    db: { schema: "control_api" },
  });
  const { data: acesso, error: erroAcesso } = await comoUsuario.rpc("verificar_acesso");
  if (erroAcesso || !acesso?.admin || !acesso?.mfa) {
    return responderJson({ erro: "Acesso negado." }, 403, cors);
  }

  // 4. Ação
  let corpo: { acao?: string; evento?: string; barbearia_id?: string; email?: string; nome?: string };
  try {
    corpo = await req.json();
  } catch {
    return responderJson({ erro: "Requisição inválida." }, 400, cors);
  }

  switch (corpo.acao) {
    case "status":
      return responderJson({ ok: true, versao: VERSAO, servidor_em: new Date().toISOString() }, 200, cors);

    case "registrar_acesso": {
      const evento = String(corpo.evento ?? "");
      if (!EVENTOS_PERMITIDOS.has(evento)) return responderJson({ erro: "Evento inválido." }, 400, cors);

      const { error } = await servico.rpc("auditar_servidor", {
        p_ator_id: usuario.id,
        p_acao: evento,
        p_detalhes: { origem: "barber-control" },
        p_ip: obterIp(req),
        p_user_agent: obterUserAgent(req),
      });
      if (error) {
        console.error("auditar_servidor", error);
        return responderJson({ erro: "Falha ao registrar auditoria." }, 500, cors);
      }
      return responderJson({ ok: true }, 200, cors);
    }

    case "criar_proprietario": {
      const barbeariaId = String(corpo.barbearia_id ?? "");
      const email = String(corpo.email ?? "").trim().toLowerCase();
      const nome = String(corpo.nome ?? "").trim().slice(0, 120);
      if (!UUID.test(barbeariaId)) return responderJson({ erro: "Barbearia inválida." }, 400, cors);
      if (!EMAIL_VALIDO.test(email)) return responderJson({ erro: "E-mail inválido." }, 400, cors);

      // Cria a conta (e-mail já confirmado). Se já existir, segue só com o vínculo.
      let senha: string | null = senhaTemporaria();
      const { error: erroCriacao } = await servico.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome, criado_por: "barber-control" },
      });
      let contaExistente = false;
      if (erroCriacao) {
        const mensagem = String(erroCriacao.message ?? "").toLowerCase();
        if (mensagem.includes("already") || mensagem.includes("registered") || mensagem.includes("exists")) {
          contaExistente = true;
          senha = null;
        } else {
          console.error("createUser", erroCriacao);
          return responderJson({ erro: "Não foi possível criar a conta de acesso." }, 500, cors);
        }
      }

      // Vínculo feito COM o token do administrador: a função do banco exige
      // administrador + MFA e registra a auditoria em nome dele.
      const { data: membro, error: erroVinculo } = await comoUsuario.rpc("vincular_proprietario", {
        p_barbearia: barbeariaId,
        p_email: email,
        p_papel: "proprietario",
      });
      if (erroVinculo) {
        console.error("vincular_proprietario", erroVinculo);
        const texto = String(erroVinculo.message ?? "");
        const erro = texto.includes("conta_master")
          ? "A conta do administrador do SaaS não pode ser proprietária de barbearia."
          : texto.includes("barbearia_inexistente") ? "Barbearia não encontrada." : "Conta criada, mas o vínculo com a barbearia falhou.";
        return responderJson({ erro }, 400, cors);
      }

      return responderJson({ ok: true, membro, email, conta_existente: contaExistente, senha_temporaria: senha }, 200, cors);
    }

    default:
      return responderJson({ erro: "Ação desconhecida." }, 400, cors);
  }
});
