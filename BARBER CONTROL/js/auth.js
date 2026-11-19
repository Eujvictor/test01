// =====================================================================
// BARBER CONTROL — AUTENTICAÇÃO
// Fluxo: senha → (bloqueio anti força bruta) → é administrador? → MFA TOTP
// A decisão final é SEMPRE do servidor (control_api + Edge Functions);
// as verificações aqui apenas conduzem a interface.
// =====================================================================
import { supabase } from "./supabase.js";
import { APP_CONFIG } from "../config/app.config.js";
import { rpc, invocarFuncao } from "../services/control-api.js";

let saindo = false;

export async function obterSessao() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
}

export function verificarProtecaoLogin(email) {
    return invocarFuncao(APP_CONFIG.funcoes.login, { acao: "verificar", email });
}

export async function registrarTentativa(email, sucesso) {
    try {
        return await invocarFuncao(APP_CONFIG.funcoes.login, { acao: "registrar", email, sucesso });
    } catch (erro) {
        console.warn("Não foi possível registrar a tentativa de login:", erro);
        return null;
    }
}

export async function entrarComSenha(email, senha) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    return data;
}

export function verificarAcesso() {
    return rpc("verificar_acesso");
}

export async function estadoMfa() {
    const { data: nivel, error: erroNivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (erroNivel) throw erroNivel;

    const { data: fatores, error: erroFatores } = await supabase.auth.mfa.listFactors();
    if (erroFatores) throw erroFatores;

    const verificados = (fatores?.totp ?? []).filter((f) => f.status === "verified");
    return {
        nivelAtual: nivel.currentLevel,
        fatorVerificado: verificados[0] ?? null
    };
}

export async function iniciarCadastroMfa() {
    // Remove cadastros TOTP iniciados e não concluídos.
    const { data: fatores } = await supabase.auth.mfa.listFactors();
    const pendentes = (fatores?.all ?? []).filter((f) => f.factor_type === "totp" && f.status !== "verified");
    for (const fator of pendentes) {
        await supabase.auth.mfa.unenroll({ factorId: fator.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Barber Control ${new Date().toISOString().slice(0, 16)}`
    });
    if (error) throw error;

    return { fatorId: data.id, qrCode: data.totp.qr_code, segredo: data.totp.secret };
}

export async function verificarCodigoMfa(fatorId, codigo) {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo });
    if (error) throw error;
    return data;
}

export function registrarAcessoServidor(evento) {
    return invocarFuncao(APP_CONFIG.funcoes.admin, { acao: "registrar_acesso", evento });
}

export function statusServidor() {
    return invocarFuncao(APP_CONFIG.funcoes.admin, { acao: "status" });
}

export async function sair(motivo = "logout") {
    if (saindo) return;
    saindo = true;
    try {
        await rpc("registrar_evento", { p_acao: motivo, p_detalhes: {} });
    } catch {
        /* sessão pode já estar expirada; o logout continua */
    }
    await supabase.auth.signOut();
    const destino = motivo === "sessao_expirada" ? "login.html?motivo=expirada" : "login.html";
    window.location.replace(destino);
}

// Guarda das páginas internas. Retorna o contexto ou redireciona.
export async function exigirAdministrador() {
    const sessao = await obterSessao();
    if (!sessao) {
        window.location.replace("login.html");
        return null;
    }

    const mfa = await estadoMfa();
    if (mfa.nivelAtual !== "aal2") {
        window.location.replace("login.html");
        return null;
    }

    const acesso = await verificarAcesso();
    if (!acesso?.admin || !acesso?.mfa) {
        await supabase.auth.signOut();
        window.location.replace("login.html?motivo=negado");
        return null;
    }

    return { sessao, usuario: sessao.user, acesso };
}

export function iniciarControleSessao() {
    const limiteMs = APP_CONFIG.seguranca.inatividadeMinutos * 60 * 1000;
    let temporizador = null;
    let ultimoReinicio = 0;

    const reiniciar = () => {
        const agora = Date.now();
        if (agora - ultimoReinicio < 1000) return;
        ultimoReinicio = agora;
        clearTimeout(temporizador);
        temporizador = setTimeout(() => sair("sessao_expirada"), limiteMs);
    };

    ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach((evento) =>
        window.addEventListener(evento, reiniciar, { passive: true })
    );
    reiniciar();

    // Logout em outra aba ou sessão revogada.
    supabase.auth.onAuthStateChange((evento) => {
        if (evento === "SIGNED_OUT" && !saindo) window.location.replace("login.html");
    });
}
