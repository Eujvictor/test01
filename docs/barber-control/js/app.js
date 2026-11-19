// =====================================================================
// BARBER CONTROL — INICIALIZAÇÃO DO PAINEL (dashboard.html)
// =====================================================================
import { exigirAdministrador, iniciarControleSessao, sair } from "./auth.js";
import { montarSidebar, iniciarRoteador } from "./navigation.js";
import { $, escapar, atualizarIcones } from "./utilities/dom.js";
import { confirmar } from "./utilities/feedback.js";
import { APP_CONFIG } from "../config/app.config.js";
import { MODO_DEMO, CONTEXTO_DEMO } from "./demo.js";

// Preferências de aparência do módulo 19 (chave própria; não carrega dados demo).
function aplicarPreferenciasVisuais() {
    try {
        const p = JSON.parse(window.localStorage.getItem("barber-control:aparencia") || "null");
        if (!p) return null;
        const raiz = document.documentElement;
        raiz.dataset.tema = p.tema === "contraste" ? "contraste" : "escuro";
        raiz.dataset.densidade = p.densidade === "compacta" ? "compacta" : "confortavel";
        raiz.dataset.animacoes = p.reduzirAnimacoes ? "reduzidas" : "normais";
        return p;
    } catch {
        return null;
    }
}

const PAGINAS_INICIAIS = ["dashboard", "relatorios", "inteligencia", "auditoria"];

function mostrarErroInicial(mensagem) {
    $("#bootConteudo").innerHTML = `
        <img src="assets/images/logo.svg" alt="" width="48" height="48">
        <h2>Não foi possível abrir o Barber Control</h2>
        <p class="texto-sec">${escapar(mensagem)}</p>
        <a class="btn" href="login.html">Voltar ao login</a>`;
}

function configurarMenuMovel() {
    const fechar = () => document.body.classList.remove("menu-aberto");
    $("#btnMenu").addEventListener("click", () => document.body.classList.toggle("menu-aberto"));
    $("#sobreposicao").addEventListener("click", fechar);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
    return fechar;
}

function ativarFaixaDemo() {
    const faixa = document.createElement("div");
    faixa.className = "faixa-demo";
    faixa.setAttribute("role", "status");
    faixa.innerHTML = `<i data-lucide="eye"></i><span><strong>MODO DEMONSTRAÇÃO</strong> · dados fictícios · sem login e sem conexão com o banco · disponível apenas neste computador</span>`;
    document.body.prepend(faixa);
    document.body.classList.add("is-demo");
    $(".usuario__papel").textContent = "Demonstração · sem login";
}

async function iniciar() {
    const contexto = MODO_DEMO ? CONTEXTO_DEMO : await exigirAdministrador();
    if (!contexto) return;
    if (MODO_DEMO) ativarFaixaDemo();

    const email = contexto.usuario.email ?? "";
    $("#usuarioEmail").textContent = email;
    $("#usuarioAvatar").textContent = email.slice(0, 2).toUpperCase();
    $("#versao").textContent = APP_CONFIG.versao;

    const fecharMenu = configurarMenuMovel();

    $("#btnSair").addEventListener("click", async () => {
        const ok = await confirmar({
            titulo: "Encerrar sessão?",
            mensagem: "Você precisará da senha e do código do autenticador para entrar novamente.",
            textoConfirmar: "Sair"
        });
        if (!ok) return;
        if (MODO_DEMO) window.location.replace("login.html");
        else await sair("logout");
    });

    montarSidebar($("#nav"));
    const preferencias = aplicarPreferenciasVisuais();
    if (!window.location.hash && PAGINAS_INICIAIS.includes(preferencias?.paginaInicial) && preferencias.paginaInicial !== "dashboard") {
        history.replaceState(null, "", `#/${preferencias.paginaInicial}`);
    }
    iniciarRoteador({
        view: $("#view"),
        titulo: $("#tituloPagina"),
        contexto,
        aoNavegar: fecharMenu
    });
    if (!MODO_DEMO) iniciarControleSessao();

    document.body.classList.remove("is-booting");
    atualizarIcones();
}

iniciar().catch((erro) => {
    console.error(erro);
    mostrarErroInicial(erro?.message || "Erro inesperado na inicialização.");
});
