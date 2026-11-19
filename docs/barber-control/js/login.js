// =====================================================================
// BARBER CONTROL — TELA DE LOGIN
// Etapas: credenciais → mfa-cadastro (primeiro acesso) | mfa-codigo
// =====================================================================
import { supabase } from "./supabase.js";
import { APP_CONFIG } from "../config/app.config.js";
import {
    obterSessao, verificarProtecaoLogin, registrarTentativa, entrarComSenha,
    verificarAcesso, estadoMfa, iniciarCadastroMfa, verificarCodigoMfa, registrarAcessoServidor
} from "./auth.js";
import { $, $$, atualizarIcones, definirCarregando } from "./utilities/dom.js";
import { DEMO_DISPONIVEL } from "./demo.js";

const alerta = $("#alerta");
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let fatorAtual = null;
let primeiroCadastro = false;

function mostrarEtapa(nome) {
    $$("[data-etapa]").forEach((el) => { el.hidden = el.dataset.etapa !== nome; });
    const foco = $(`[data-etapa="${nome}"] input`);
    if (foco) setTimeout(() => foco.focus(), 50);
}

function mostrarAlerta(mensagem, tipo = "erro") {
    alerta.className = `alerta alerta--${tipo}`;
    alerta.textContent = mensagem;
    alerta.hidden = false;
}

function limparAlerta() {
    alerta.hidden = true;
    alerta.textContent = "";
}

async function voltarAoInicio(mensagem) {
    await supabase.auth.signOut();
    fatorAtual = null;
    primeiroCadastro = false;
    mostrarEtapa("credenciais");
    if (mensagem) mostrarAlerta(mensagem);
}

async function concluir() {
    try {
        if (primeiroCadastro) await registrarAcessoServidor("mfa_ativado");
        await registrarAcessoServidor("login");
    } catch (erro) {
        // A auditoria de login não impede o acesso; o painel exibirá a função como indisponível.
        console.warn("Auditoria de login não registrada:", erro);
    }
    window.location.replace("dashboard.html");
}

async function continuarAposSenha() {
    const acesso = await verificarAcesso();
    if (!acesso?.admin) {
        await voltarAoInicio("Esta conta não possui acesso ao Barber Control.");
        return;
    }

    const mfa = await estadoMfa();
    if (mfa.nivelAtual === "aal2") {
        await concluir();
        return;
    }

    if (mfa.fatorVerificado) {
        fatorAtual = mfa.fatorVerificado.id;
        primeiroCadastro = false;
        mostrarEtapa("mfa-codigo");
        return;
    }

    const cadastro = await iniciarCadastroMfa();
    fatorAtual = cadastro.fatorId;
    primeiroCadastro = true;
    $("#mfaQr").src = cadastro.qrCode;
    $("#mfaSegredo").textContent = cadastro.segredo;
    mostrarEtapa("mfa-cadastro");
}

// ---------- Etapa 1: e-mail e senha ----------
$("#formCredenciais").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limparAlerta();

    const campoEmail = $("#email");
    const campoSenha = $("#senha");
    const email = campoEmail.value.trim().toLowerCase();
    const senha = campoSenha.value;

    campoEmail.setAttribute("aria-invalid", String(!EMAIL_VALIDO.test(email)));
    campoSenha.setAttribute("aria-invalid", String(!senha));
    if (!EMAIL_VALIDO.test(email) || !senha) {
        mostrarAlerta("Informe um e-mail válido e a senha.");
        return;
    }

    const botao = evento.submitter ?? $("#formCredenciais button[type=submit]");
    definirCarregando(botao, true, "Verificando…");

    try {
        try {
            const protecao = await verificarProtecaoLogin(email);
            if (protecao?.bloqueado) {
                const minutos = Math.max(1, Math.ceil((protecao.segundos_restantes ?? 900) / 60));
                mostrarAlerta(`Muitas tentativas sem sucesso. Tente novamente em ${minutos} min.`);
                return;
            }
        } catch (erro) {
            if (APP_CONFIG.seguranca.exigirProtecaoLogin) {
                mostrarAlerta(erro.message || "Serviço de proteção de login indisponível.");
                return;
            }
        }

        try {
            await entrarComSenha(email, senha);
        } catch {
            const estado = await registrarTentativa(email, false);
            mostrarAlerta(estado?.bloqueado
                ? "Muitas tentativas sem sucesso. Acesso bloqueado por 15 minutos."
                : "E-mail ou senha inválidos.");
            return;
        }

        await registrarTentativa(email, true);
        campoSenha.value = "";
        await continuarAposSenha();
    } catch (erro) {
        console.error(erro);
        await voltarAoInicio(erro.message || "Não foi possível entrar. Tente novamente.");
    } finally {
        definirCarregando(botao, false);
    }
});

// ---------- Etapas 2 e 3: código TOTP ----------
async function enviarCodigo(evento) {
    evento.preventDefault();
    limparAlerta();

    const campo = evento.currentTarget.querySelector("input[name=codigo]");
    const codigo = campo.value.replace(/\D/g, "");
    campo.setAttribute("aria-invalid", String(codigo.length !== 6));
    if (codigo.length !== 6) {
        mostrarAlerta("Digite os 6 números exibidos no aplicativo autenticador.");
        return;
    }

    const botao = evento.submitter ?? evento.currentTarget.querySelector("button[type=submit]");
    definirCarregando(botao, true, "Validando…");
    try {
        await verificarCodigoMfa(fatorAtual, codigo);
        await concluir();
    } catch (erro) {
        console.warn(erro);
        campo.value = "";
        mostrarAlerta("Código inválido ou expirado. Confira o horário do celular e tente novamente.");
    } finally {
        definirCarregando(botao, false);
    }
}

$("#formMfaCadastro").addEventListener("submit", enviarCodigo);
$("#formMfaCodigo").addEventListener("submit", enviarCodigo);
$$("[data-acao=voltar]").forEach((botao) => botao.addEventListener("click", () => voltarAoInicio()));

// ---------- Inicialização ----------
(async function iniciar() {
    atualizarIcones();
    if (DEMO_DISPONIVEL) $("#blocoDemo").hidden = false;

    const motivo = new URLSearchParams(window.location.search).get("motivo");
    if (motivo === "negado") mostrarAlerta("Esta conta não possui acesso ao Barber Control.");
    if (motivo === "expirada") mostrarAlerta("Sua sessão foi encerrada por inatividade.", "info");

    try {
        const sessao = await obterSessao();
        if (sessao) {
            await continuarAposSenha();
            return;
        }
    } catch (erro) {
        console.error(erro);
        await voltarAoInicio(erro.message);
        return;
    }
    mostrarEtapa("credenciais");
})();
