// =====================================================================
// SITE PÚBLICO — CORES E FONTE DA BARBEARIA
// Aplica as cores e a fonte escolhidas no painel (configuracoes_site).
// Usado pelo index.html (chamado por site-config.js) e pelo agendar.html
// (com data-buscar, busca sozinho). Somente leitura.
// =====================================================================

(function () {
    "use strict";

    const CACHE_KEY = window.BarbeariaAtual
        ? window.BarbeariaAtual.chaveCache("navalha_site_config_v1")
        : "navalha_site_config_v1";

    // Fontes oferecidas no painel. Pesos disponíveis no Google Fonts
    // (pedir um peso inexistente faz o Google recusar a fonte inteira).
    const FONTES = {
        "Playfair Display": { categoria: "serif", pesos: "400;600;700;800" },
        "Cormorant Garamond": { categoria: "serif", pesos: "400;600;700" },
        "Lora": { categoria: "serif", pesos: "400;600;700" },
        "Merriweather": { categoria: "serif", pesos: "400;700;900" },
        "Inter": { categoria: "sans-serif", pesos: "400;600;700;800" },
        "Poppins": { categoria: "sans-serif", pesos: "400;600;700;800" },
        "Montserrat": { categoria: "sans-serif", pesos: "400;600;700;800" },
        "Oswald": { categoria: "sans-serif", pesos: "400;600;700" },
        "Great Vibes": { categoria: "cursive", pesos: "400" },
        "Dancing Script": { categoria: "cursive", pesos: "400;600;700" },
        "Pacifico": { categoria: "cursive", pesos: "400" },
        "JetBrains Mono": { categoria: "monospace", pesos: "400;600;700;800" },
        "Space Mono": { categoria: "monospace", pesos: "400;700" },
        "IBM Plex Mono": { categoria: "monospace", pesos: "400;600;700" }
    };

    const SISTEMA = /^(arial|helvetica|verdana|georgia|tahoma|times new roman)$/i;

    const GENERICAS = {
        serif: 'Georgia, "Times New Roman", serif',
        "sans-serif": "Arial, Helvetica, sans-serif",
        sans: "Arial, Helvetica, sans-serif",
        monospace: '"Courier New", Consolas, monospace',
        mono: '"Courier New", Consolas, monospace',
        cursive: '"Brush Script MT", cursive',
        script: '"Brush Script MT", cursive'
    };

    function texto(v) {
        return typeof v === "string" ? v.trim() : "";
    }

    function corSegura(v) {
        const c = texto(v);
        if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + [...c.slice(1)].map((x) => x + x).join("");
        return /^#[0-9a-f]{6}$/i.test(c) ? c : "";
    }

    function rgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function luminancia(hex) {
        return rgb(hex)
            .map((v) => v / 255)
            .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
            .reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0);
    }

    // Texto legível sobre a cor do botão.
    function textoSobre(hex) {
        return luminancia(hex) > 0.36 ? "#111111" : "#ffffff";
    }

    // Tom um pouco mais claro (ou mais escuro, se a cor já for clara) para o hover.
    function variacao(hex) {
        const clara = luminancia(hex) > 0.6;
        return "#" + rgb(hex)
            .map((v) => Math.round(clara ? v * 0.88 : v + (255 - v) * 0.18))
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("");
    }

    function definir(nome, valor) {
        const raiz = document.documentElement;
        if (valor) raiz.style.setProperty(nome, valor);
        else raiz.style.removeProperty(nome);
    }

    function urlDaFonte(nome) {
        const familia = encodeURIComponent(nome).replace(/%20/g, "+");
        const info = FONTES[nome];
        return info
            ? `https://fonts.googleapis.com/css2?family=${familia}:wght@${info.pesos}&display=swap`
            : `https://fonts.googleapis.com/css2?family=${familia}&display=swap`;
    }

    function aplicarFonte(valor) {
        const nome = texto(valor);
        let link = document.getElementById("siteFonteLink");

        if (!/^[A-Za-z0-9 -]{2,40}$/.test(nome)) {
            definir("--fonte-site", "");
            if (link) link.remove();
            return;
        }

        // Estilos genéricos digitados no campo antigo ("Serif", "Monospace"...):
        // usam a fonte do sistema daquele estilo, sem buscar no Google Fonts.
        const generica = GENERICAS[nome.toLowerCase().replace(/\s+/g, "-")];
        if (generica) {
            if (link) link.remove();
            definir("--fonte-site", generica);
            return;
        }

        if (!SISTEMA.test(nome)) {
            const href = urlDaFonte(nome);

            if (!link) {
                link = document.createElement("link");
                link.id = "siteFonteLink";
                link.rel = "stylesheet";
                document.head.appendChild(link);
            }

            if (link.getAttribute("href") !== href) link.href = href;
        } else if (link) {
            link.remove();
        }

        const reserva = (FONTES[nome] && FONTES[nome].categoria) || "sans-serif";
        definir("--fonte-site", `"${nome}", Arial, Helvetica, ${reserva}`);
    }

    function aplicar(config) {
        config = config || {};

        const principal = corSegura(config.cor_principal);
        const secundaria = corSegura(config.cor_destaque);
        const fundo = corSegura(config.cor_fundo);
        const botoes = corSegura(config.cor_botoes);
        const detalhes = corSegura(config.cor_detalhes);

        // Campo vazio = volta para a cor original do site (remove a troca).
        definir("--gold", principal);
        definir("--gold-light", secundaria);
        definir("--bg", fundo);

        definir("--cor-botoes", botoes);
        definir("--cor-botoes-hover", botoes ? variacao(botoes) : "");
        definir("--cor-botoes-texto", botoes ? textoSobre(botoes) : "");

        definir("--cor-detalhes", detalhes);

        aplicarFonte(config.fonte);
    }

    // Pilha de fontes CSS usada para um nome salvo (também usada na prévia do painel).
    function familiaDe(valor) {
        const nome = texto(valor);
        if (!nome) return "Arial, Helvetica, sans-serif";
        const generica = GENERICAS[nome.toLowerCase().replace(/\s+/g, "-")];
        if (generica) return generica;
        return `"${nome}", Arial, Helvetica, ${(FONTES[nome] && FONTES[nome].categoria) || "sans-serif"}`;
    }

    window.SiteTema = { aplicar, FONTES, urlDaFonte, familiaDe };

    // ------------------------------------------
    // Páginas sem site-config.js (agendar.html): busca sozinho.
    // ------------------------------------------
    const script = document.currentScript;

    if (!script || !script.hasAttribute("data-buscar")) return;

    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (cache && cache.site) aplicar(cache.site);
    } catch {
        /* sem cache */
    }

    async function buscar() {
        if (!window.supabaseClient) return;

        const { data, error } = await window.supabaseClient
            .from("configuracoes_site")
            .select("*")
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Não foi possível carregar as cores do site:", error);
            return;
        }

        aplicar(data || {});
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buscar);
    } else {
        buscar();
    }
})();
