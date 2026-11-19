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
