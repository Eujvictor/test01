// ARQUIVO GERADO por supabase/ferramentas/gerar-funcoes-painel.cjs — não edite aqui.
// Cole no painel do Supabase: Edge Functions → Deploy a new function → Via Editor,
// nome da função: control-login. Depois, em Settings da função, DESLIGUE "Verify JWT".

// =====================================================================
// BARBER CONTROL — Edge Function: control-login
// Controle de tentativas de login (anti força bruta), com IP capturado
// no servidor. Chamada ANTES e DEPOIS do signInWithPassword.
//
// POST { acao: "verificar", email }
// POST { acao: "registrar", email, sucesso: boolean }
// Resposta: { bloqueado, falhas, segundos_restantes }
//
// Não exige JWT (o usuário ainda não está logado): verify_jwt = false.
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


const servico = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "control_api" } },
);

const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

Deno.serve(async (req) => {
  const cors = cabecalhosCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responderJson({ erro: "Método não permitido." }, 405, cors);

  let corpo: { acao?: string; email?: string; sucesso?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return responderJson({ erro: "Requisição inválida." }, 400, cors);
  }

  const email = String(corpo.email ?? "").trim().toLowerCase();
  if (!EMAIL_VALIDO.test(email)) return responderJson({ erro: "E-mail inválido." }, 400, cors);

  const ip = obterIp(req);

  const { data: estado, error } = await servico.rpc("login_verificar", { p_email: email, p_ip: ip });
  if (error) {
    console.error("login_verificar", error);
    return responderJson({ erro: "Falha ao verificar tentativas." }, 500, cors);
  }

  if (corpo.acao === "verificar") return responderJson(estado, 200, cors);

  if (corpo.acao === "registrar") {
    if (typeof corpo.sucesso !== "boolean") {
      return responderJson({ erro: "Campo 'sucesso' obrigatório." }, 400, cors);
    }
    // Já bloqueado: não acumula mais registros de falha.
    if (estado?.bloqueado && !corpo.sucesso) return responderJson(estado, 200, cors);

    const { error: erroRegistro } = await servico.rpc("login_registrar", {
      p_email: email,
      p_ip: ip,
      p_sucesso: corpo.sucesso,
      p_user_agent: obterUserAgent(req),
    });
    if (erroRegistro) {
      console.error("login_registrar", erroRegistro);
      return responderJson({ erro: "Falha ao registrar tentativa." }, 500, cors);
    }

    const { data: novoEstado } = await servico.rpc("login_verificar", { p_email: email, p_ip: ip });
    return responderJson(novoEstado ?? estado, 200, cors);
  }

  return responderJson({ erro: "Ação desconhecida." }, 400, cors);
});
