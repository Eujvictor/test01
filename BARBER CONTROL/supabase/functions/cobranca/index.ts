// =====================================================================
// BARBER CONTROL — Edge Function: cobranca (Mercado Pago)
//
// 1) Pagar uma fatura (chamada pelo painel da barbearia, com o token do dono)
//    POST { acao: "pagar", fatura_id }
//    → confere no banco, COM o token do dono, que a fatura é dele e está
//      em aberto (api.fatura_para_pagamento);
//    → cria o pagamento no Checkout do Mercado Pago (Pix, cartão, boleto);
//    → devolve { ok, link } para o painel abrir.
//
// 2) Aviso de pagamento do Mercado Pago (webhook)
//    POST /functions/v1/cobranca?origem=mp   (enviado pelo Mercado Pago)
//    → confere a assinatura do aviso (MP_WEBHOOK_SECRET, se configurado);
//    → NUNCA confia no conteúdo do aviso: busca o pagamento na API do
//      Mercado Pago com o token secreto e só registra se estiver aprovado
//      e com o valor da fatura (external_reference = id da fatura).
//
// Secrets (Edge Functions → Secrets), nunca no navegador:
//    MP_ACCESS_TOKEN      token do Mercado Pago (TEST-... ou APP_USR-...)
//    MP_WEBHOOK_SECRET    assinatura secreta dos webhooks (recomendado)
//    PAINEL_BARBEARIA_URL endereço do painel da barbearia (opcional)
//
// verify_jwt = false: o Mercado Pago não envia token do Supabase; a
// validação é feita aqui dentro.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { cabecalhosCors, responderJson } from "../_shared/http.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const MP_SEGREDO = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";
const PAINEL = Deno.env.get("PAINEL_BARBEARIA_URL") ?? "https://eujvictor.github.io/test01/painel-admin-.html";
const API_MP = "https://api.mercadopago.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const servico = createClient(URL_SUPABASE, CHAVE_SERVICO, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "control_api" },
});

const dataBr = (iso: string) => String(iso ?? "").slice(0, 10).split("-").reverse().join("/");

// ---------------------------------------------------------------------
// Assinatura do webhook: x-signature "ts=...,v1=..." sobre
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com HMAC-SHA256.
// ---------------------------------------------------------------------
async function assinaturaValida(req: Request, idRecurso: string): Promise<boolean> {
  if (!MP_SEGREDO) return true; // sem segredo: a consulta à API do MP continua obrigatória
  const cabecalho = req.headers.get("x-signature") ?? "";
  const pedido = req.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(cabecalho.split(",").map((p) => p.trim().split("=", 2)));
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(idRecurso) ? idRecurso.toLowerCase() : idRecurso;
  const manifesto = `id:${id};request-id:${pedido};ts:${partes.ts};`;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(MP_SEGREDO), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(manifesto));
  const hex = [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== partes.v1.length) return false;
  let diferenca = 0;
  for (let i = 0; i < hex.length; i++) diferenca |= hex.charCodeAt(i) ^ partes.v1.charCodeAt(i);
  return diferenca === 0;
}

function metodoDe(pagamento: Record<string, unknown>): string {
  const metodo = String(pagamento.payment_method_id ?? "");
  const tipo = String(pagamento.payment_type_id ?? "");
  if (metodo === "pix") return "pix";
  if (tipo === "ticket") return "boleto";
  if (tipo === "credit_card" || tipo === "debit_card") return "cartao";
  return tipo || "outro";
}

async function processarWebhook(req: Request, cors: Record<string, string>): Promise<Response> {
  const url = new URL(req.url);
  let corpo: Record<string, any> = {};
  try {
    corpo = await req.json();
  } catch {
    /* alguns avisos chegam só com parâmetros na URL */
  }
  const tipo = String(corpo.type ?? corpo.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
  const idPagamento = String(corpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

  // Só interessam avisos de pagamento; os demais são confirmados e ignorados.
  if (tipo !== "payment" || !/^\d{1,30}$/.test(idPagamento)) return responderJson({ ok: true, ignorado: true }, 200, cors);
  if (!(await assinaturaValida(req, idPagamento))) return responderJson({ erro: "Assinatura inválida." }, 401, cors);
  if (!MP_TOKEN) return responderJson({ erro: "Mercado Pago não configurado." }, 500, cors);

  const resposta = await fetch(`${API_MP}/v1/payments/${idPagamento}`, { headers: { Authorization: `Bearer ${MP_TOKEN}` } });
  if (!resposta.ok) {
    console.error("MP payments", resposta.status);
    return responderJson({ erro: "Pagamento não encontrado no Mercado Pago." }, resposta.status === 404 ? 200 : 502, cors);
  }
  const pagamento = await resposta.json();
  const fatura = String(pagamento.external_reference ?? "");
  if (pagamento.status !== "approved" || !UUID.test(fatura)) {
    return responderJson({ ok: true, status: pagamento.status ?? "desconhecido" }, 200, cors);
  }

  const taxa = Array.isArray(pagamento.fee_details)
    ? pagamento.fee_details.reduce((s: number, t: { amount?: number }) => s + Number(t.amount ?? 0), 0)
    : 0;
  const { data: resultado, error } = await servico.rpc("registrar_pagamento_mp", {
    p_fatura: fatura,
    p_valor: Number(pagamento.transaction_amount),
    p_metodo: metodoDe(pagamento),
    p_pagamento_id: String(pagamento.id),
    p_taxa: Math.round(taxa * 100) / 100,
  });
  if (error) {
    console.error("registrar_pagamento_mp", error);
    return responderJson({ erro: "Falha ao registrar o pagamento." }, 500, cors); // o MP tenta de novo
  }
  return responderJson({ ok: true, resultado }, 200, cors);
}

async function criarPagamento(req: Request, cors: Record<string, string>): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return responderJson({ erro: "Não autenticado." }, 401, cors);
  const { data: dadosUsuario, error: erroUsuario } = await servico.auth.getUser(token);
  if (erroUsuario || !dadosUsuario?.user) return responderJson({ erro: "Sessão inválida ou expirada." }, 401, cors);

  let corpo: { acao?: string; fatura_id?: string };
  try {
    corpo = await req.json();
  } catch {
    return responderJson({ erro: "Requisição inválida." }, 400, cors);
  }
  if (corpo.acao !== "pagar") return responderJson({ erro: "Ação desconhecida." }, 400, cors);
  if (!UUID.test(String(corpo.fatura_id ?? ""))) return responderJson({ erro: "Fatura inválida." }, 400, cors);
  if (!MP_TOKEN) return responderJson({ erro: "Pagamento online ainda não configurado. Fale com o suporte." }, 503, cors);

  // Permissão conferida pelo banco, com o token do próprio dono.
  const comoUsuario = createClient(URL_SUPABASE, CHAVE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
    db: { schema: "api" },
  });
  const { data: fatura, error: erroFatura } = await comoUsuario.rpc("fatura_para_pagamento", { p_fatura: corpo.fatura_id });
  if (erroFatura || !fatura) {
    const texto = String(erroFatura?.message ?? "");
    if (texto.includes("fatura_nao_aberta")) return responderJson({ erro: "Esta fatura já foi paga ou cancelada." }, 409, cors);
    return responderJson({ erro: "Fatura não encontrada." }, 404, cors);
  }

  const notificacao = `${URL_SUPABASE}/functions/v1/cobranca?origem=mp`;
  const preferencia = {
    items: [{
      id: fatura.id,
      title: `Barber · Plano ${fatura.plano} · ${fatura.barbearia}`.slice(0, 250),
      description: `Mensalidade com vencimento em ${dataBr(fatura.vencimento)}`,
      quantity: 1,
      currency_id: "BRL",
      unit_price: Number(fatura.valor),
    }],
    payer: fatura.email ? { email: fatura.email } : undefined,
    external_reference: fatura.id,
    notification_url: notificacao,
    back_urls: {
      success: `${PAINEL}?pagamento=aprovado`,
      pending: `${PAINEL}?pagamento=pendente`,
      failure: `${PAINEL}?pagamento=recusado`,
    },
    auto_return: "approved",
    statement_descriptor: "BARBER",
    metadata: { fatura_id: fatura.id, barbearia_id: fatura.barbearia_id },
  };
  const resposta = await fetch(`${API_MP}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(preferencia),
  });
  if (!resposta.ok) {
    console.error("MP preferences", resposta.status, await resposta.text());
    return responderJson({ erro: "O Mercado Pago não respondeu. Tente de novo em instantes." }, 502, cors);
  }
  const criada = await resposta.json();
  const link = MP_TOKEN.startsWith("TEST-") ? (criada.sandbox_init_point ?? criada.init_point) : (criada.init_point ?? criada.sandbox_init_point);
  if (!link) return responderJson({ erro: "O Mercado Pago não devolveu o link de pagamento." }, 502, cors);

  const { error: erroSalvar } = await servico.rpc("salvar_preferencia_mp", { p_fatura: fatura.id, p_preferencia: String(criada.id ?? ""), p_link: link });
  if (erroSalvar) console.error("salvar_preferencia_mp", erroSalvar); // não impede o pagamento
  return responderJson({ ok: true, link }, 200, cors);
}

Deno.serve(async (req) => {
  const cors = cabecalhosCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responderJson({ erro: "Método não permitido." }, 405, cors);
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("origem") === "mp") return await processarWebhook(req, cors);
    return await criarPagamento(req, cors);
  } catch (erro) {
    console.error("cobranca", erro);
    return responderJson({ erro: "Erro interno." }, 500, cors);
  }
});
