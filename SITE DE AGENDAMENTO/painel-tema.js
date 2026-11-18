// =====================================================================
// PAINEL — TEMA CLARO/ESCURO, AVISOS E BOTÕES DE SALVAR
// Carregado no <head> (sem defer) para aplicar o tema antes da pintura
// e evitar o "piscar" do tema errado.
// A preferência de tema é do aparelho de quem usa o painel, por isso
// fica no localStorage (não vai para o banco).
// =====================================================================

(function () {
    "use strict";

    const CHAVE_TEMA = "painel_tema";
    const raiz = document.documentElement;

    function temaSalvo() {
        try {
            const valor = localStorage.getItem(CHAVE_TEMA);
            return valor === "claro" || valor === "escuro" ? valor : null;
        } catch {
            return null;
        }
    }

    function aplicarTema(tema) {
        raiz.dataset.tema = tema;

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = tema === "claro" ? "#f4f2ee" : "#101010";

        document.querySelectorAll("[data-alternar-tema]").forEach((botao) => {
            const claro = tema === "claro";
            botao.setAttribute("aria-pressed", claro ? "true" : "false");
            botao.setAttribute("aria-label", claro ? "Usar modo escuro" : "Usar modo claro");
            botao.title = claro ? "Usar modo escuro" : "Usar modo claro";

            const rotulo = botao.querySelector("[data-tema-rotulo]");
            if (rotulo) rotulo.textContent = claro ? "Modo claro" : "Modo escuro";
        });
    }

    function alternarTema() {
        const novo = raiz.dataset.tema === "claro" ? "escuro" : "claro";

        // Transição suave só durante a troca (não pesa no resto do uso).
        raiz.classList.add("tema-trocando");
        aplicarTema(novo);
        window.setTimeout(() => raiz.classList.remove("tema-trocando"), 350);

        try {
            localStorage.setItem(CHAVE_TEMA, novo);
        } catch {
            /* navegação privada: vale só nesta visita */
        }
    }

    // Padrão: escuro (identidade original do painel).
    aplicarTema(temaSalvo() || "escuro");

    // ------------------------------------------
    // AVISOS (toast)
    // ------------------------------------------

    function area() {
        let el = document.getElementById("painelAvisos");

        if (!el) {
            el = document.createElement("div");
            el.id = "painelAvisos";
            el.className = "painel-avisos";
            el.setAttribute("role", "status");
            el.setAttribute("aria-live", "polite");
            document.body.appendChild(el);
        }

        return el;
    }

    function aviso(mensagem, tipo = "sucesso") {
        const item = document.createElement("div");
        item.className = `painel-aviso painel-aviso--${tipo}`;

        const icone = document.createElement("span");
        icone.className = "painel-aviso__icone";
        icone.setAttribute("aria-hidden", "true");
        icone.textContent = tipo === "erro" ? "!" : tipo === "info" ? "i" : "✓";

        const texto = document.createElement("span");
        texto.textContent = mensagem;

        item.append(icone, texto);
        area().appendChild(item);

        window.setTimeout(() => {
            item.classList.add("is-saindo");
            window.setTimeout(() => item.remove(), 300);
        }, tipo === "erro" ? 6000 : 3800);
    }

    // ------------------------------------------
    // BOTÃO DE SALVAR: carregamento e clique duplo
    // ------------------------------------------

    function botaoSalvando(botao, salvando) {
        if (!botao) return;

        const rotulo = botao.querySelector("[data-salvar-rotulo]");

        if (salvando) {
            if (rotulo && !botao.dataset.rotuloOriginal) botao.dataset.rotuloOriginal = rotulo.textContent;
            if (rotulo) rotulo.textContent = "Salvando…";
            botao.disabled = true;
            botao.classList.add("is-salvando");
            botao.setAttribute("aria-busy", "true");
        } else {
            if (rotulo && botao.dataset.rotuloOriginal) rotulo.textContent = botao.dataset.rotuloOriginal;
            botao.disabled = false;
            botao.classList.remove("is-salvando");
            botao.removeAttribute("aria-busy");
        }
    }

    // Executa a função de salvar uma única vez por clique,
    // mesmo com cliques repetidos enquanto ela roda.
    function salvarComBloqueio(botao, salvar) {
        if (!botao || botao.dataset.salvando === "1") return Promise.resolve(false);

        botao.dataset.salvando = "1";
        botaoSalvando(botao, true);

        return Promise.resolve()
            .then(salvar)
            .catch((erro) => {
                console.error("Erro ao salvar:", erro);
                aviso("Não foi possível salvar. Tente novamente.", "erro");
                return false;
            })
            .finally(() => {
                delete botao.dataset.salvando;
                botaoSalvando(botao, false);
            });
    }

    window.PainelUI = {
        aviso,
        alternarTema,
        aplicarTema,
        botaoSalvando,
        salvarComBloqueio
    };

    document.addEventListener("DOMContentLoaded", () => {
        aplicarTema(raiz.dataset.tema || "escuro");

        document.querySelectorAll("[data-alternar-tema]").forEach((botao) => {
            botao.addEventListener("click", alternarTema);
        });
    });
})();
