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
import { cabecalhosCors, obterIp, obterUserAgent, responderJson } from "../_shared/http.ts";

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
