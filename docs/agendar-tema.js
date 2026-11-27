// =====================================================================
// PÁGINA DE AGENDAMENTO — MODO CLARO / ESCURO DO CLIENTE
// ---------------------------------------------------------------------
// Carregado no <head> (sem defer) para aplicar o tema antes da pintura.
// A escolha é do cliente e fica só no aparelho dele (localStorage, chave
// própria): não mexe no tema do painel administrativo nem no de outros
// clientes. As cores da barbearia (site-tema.js) continuam valendo nos
// dois temas.
// Sem escolha salva, segue o fundo configurado pela barbearia
// (fundo claro → claro; escuro ou sem fundo → escuro).
// =====================================================================

(function () {
    "use strict";

    const CHAVE = "agendar_tema";
    const raiz = document.documentElement;
    let escolhaDoCliente = null;

    try {
        const salvo = localStorage.getItem(CHAVE);
        if (salvo === "claro" || salvo === "escuro") escolhaDoCliente = salvo;
    } catch {
        /* navegador sem armazenamento: só não lembra a escolha */
    }

    function atualizarBotoes(tema) {
        document.querySelectorAll("[data-agendar-tema]").forEach((botao) => {
            const claro = tema === "claro";
            botao.setAttribute("aria-pressed", claro ? "true" : "false");
            const rotulo = claro ? "Usar modo escuro" : "Usar modo claro";
            botao.setAttribute("aria-label", rotulo);
            botao.title = rotulo;
        });
    }

    function aplicar(tema, animar) {
        if (animar) {
            raiz.classList.add("agendar-tema-trocando");
            setTimeout(() => raiz.classList.remove("agendar-tema-trocando"), 320);
        }
        raiz.dataset.temaAgendar = tema;
        atualizarBotoes(tema);
    }

    aplicar(escolhaDoCliente || "escuro", false);

    // Cores da barbearia carregadas: sem escolha do cliente, segue o fundo dela.
    document.addEventListener("site-tema:aplicado", (evento) => {
        if (escolhaDoCliente) return;
        const detalhe = evento.detail || {};
        aplicar(detalhe.temFundo && detalhe.fundoClaro ? "claro" : "escuro", false);
    });

    document.addEventListener("click", (evento) => {
        const botao = evento.target.closest("[data-agendar-tema]");
        if (!botao) return;
        const novo = raiz.dataset.temaAgendar === "claro" ? "escuro" : "claro";
        escolhaDoCliente = novo;
        try { localStorage.setItem(CHAVE, novo); } catch { /* sem armazenamento */ }
        aplicar(novo, true);
    });

    document.addEventListener("DOMContentLoaded", () => atualizarBotoes(raiz.dataset.temaAgendar));
})();
