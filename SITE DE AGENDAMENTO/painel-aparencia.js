// =====================================================================
// PAINEL — CORES E FONTES DO SITE PÚBLICO
// Seletor de cores (matiz, saturação, luminosidade e HEX), prévia ao vivo
// e escolha de fonte. Os valores vão para os campos ocultos
// siteCor* / siteFonte, que o painel já grava em configuracoes_site.
// Nada aqui muda a aparência do próprio painel.
// =====================================================================

(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    // Cores originais do site (style.css). Botões e detalhes seguem a principal.
    const ORIGINAIS = {
        siteCorPrincipal: "#C9A45C",
        siteCorDestaque: "#E0C078",
        siteCorFundo: "#0A0A0A"
    };

    const NOMES = {
        siteCorPrincipal: "Principal",
        siteCorDestaque: "Secundária",
        siteCorBotoes: "Botões",
        siteCorDetalhes: "Detalhes",
        siteCorFundo: "Fundo"
    };

    const SUGESTOES = [
        ["#C9A45C", "Dourado"], ["#E0C078", "Dourado claro"], ["#B08D57", "Bronze"], ["#8C2F39", "Vinho"],
        ["#1F3A5F", "Azul marinho"], ["#2E6B4F", "Verde"], ["#D9534F", "Vermelho"], ["#F2F2F2", "Branco gelo"],
        ["#0A0A0A", "Preto"], ["#1C1C1E", "Grafite"], ["#3B2F2A", "Café"], ["#5B4B8A", "Roxo"]
    ];

    const GRUPOS_FONTE = [
        { id: "serif", titulo: "Serif", descricao: "Clássica e elegante", fontes: ["Playfair Display", "Cormorant Garamond", "Lora", "Merriweather"] },
        { id: "sans", titulo: "Sans", descricao: "Moderna e limpa", fontes: ["Inter", "Poppins", "Montserrat", "Oswald"] },
        { id: "script", titulo: "Script", descricao: "Manuscrita", fontes: ["Great Vibes", "Dancing Script", "Pacifico"] },
        { id: "mono", titulo: "Monospace", descricao: "Técnica e marcante", fontes: ["JetBrains Mono", "Space Mono", "IBM Plex Mono"] }
    ];

    const CAMPOS = Object.keys(NOMES);
    const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

    let alvo = "siteCorPrincipal";
    let hsl = { h: 40, s: 50, l: 57 };
    let iniciado = false;
    // HEX exato escolhido (HEX, sugestão, paleta ou valor salvo). As faixas
    // trabalham com HSL inteiro, que não reproduz todo HEX exatamente.
    let hexExato = null;

    // ------------------------------------------
    // Conversões
    // ------------------------------------------

    function normalizarHex(v) {
        let c = String(v || "").trim();
        if (c && c[0] !== "#") c = "#" + c;
        if (!HEX.test(c)) return "";
        if (c.length === 4) c = "#" + [...c.slice(1)].map((x) => x + x).join("");
        return c.toUpperCase();
    }

    function hexParaHsl(hex) {
        const n = parseInt(hex.slice(1), 16);
        let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
            h *= 60;
        }
        return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    function hslParaHex({ h, s, l }) {
        s /= 100; l /= 100;
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
    }

    function luminancia(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
            .map((v) => v / 255)
            .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
            .reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0);
    }

    const textoSobre = (hex) => (luminancia(hex) > 0.36 ? "#111111" : "#FFFFFF");

    // ------------------------------------------
    // Valores
    // ------------------------------------------

    function valorSalvo(id) {
        const el = $(id);
        return el ? normalizarHex(el.value) : "";
    }

    function original(id) {
        if (id === "siteCorBotoes" || id === "siteCorDetalhes") return efetiva("siteCorPrincipal");
        return ORIGINAIS[id];
    }

    function efetiva(id) {
        return valorSalvo(id) || original(id);
    }

    function gravar(id, hex) {
        const el = $(id);
        if (!el) return;
        const novo = hex ? normalizarHex(hex) : "";
        if (normalizarHex(el.value) === novo) return;
        el.value = novo;
        // O painel escuta "input" para marcar "Alterações não salvas".
        el.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // ------------------------------------------
    // Interface do seletor
    // ------------------------------------------

    function pintarControles(forcarHex) {
        const raiz = $("seletorCor");
        if (!raiz) return;

        raiz.style.setProperty("--h", hsl.h);
        raiz.style.setProperty("--s", hsl.s + "%");
        raiz.style.setProperty("--l", hsl.l + "%");

        $("seletorCorMatiz").value = hsl.h;
        $("seletorCorSaturacao").value = hsl.s;
        $("seletorCorLuz").value = hsl.l;
        $("seletorCorMatizValor").textContent = hsl.h + "°";
        $("seletorCorSaturacaoValor").textContent = hsl.s + "%";
        $("seletorCorLuzValor").textContent = hsl.l + "%";

        const hex = hexExato || hslParaHex(hsl);
        const campoHex = $("seletorCorHex");
        if (forcarHex || document.activeElement !== campoHex) campoHex.value = hex;
        $("seletorCorNativo").value = hex.toLowerCase();

        const cursor = $("seletorCorCursor");
        cursor.style.left = hsl.s + "%";
        cursor.style.top = 100 - hsl.l + "%";

        $("seletorCorArea").setAttribute("aria-valuetext", `Saturação ${hsl.s}%, luminosidade ${hsl.l}%`);
    }

    function pintarAlvos() {
        document.querySelectorAll("[data-cor-alvo]").forEach((botao) => {
            const id = botao.dataset.corAlvo;
            const cor = efetiva(id);
            const ativo = id === alvo;
            botao.setAttribute("aria-checked", ativo ? "true" : "false");
            botao.tabIndex = ativo ? 0 : -1;
            botao.querySelector(".cor-alvo__amostra").style.background = cor;
            const hex = botao.querySelector(".cor-alvo__hex");
            hex.textContent = valorSalvo(id) ? cor : "Original";
            hex.title = cor;
        });

        const atual = $("restaurarCorAtual");
        if (atual) {
            atual.disabled = !valorSalvo(alvo);
            atual.textContent = `Usar a cor original em "${NOMES[alvo]}"`;
        }

        const todas = $("restaurarCoresOriginais");
        if (todas) todas.disabled = !CAMPOS.some((id) => valorSalvo(id));
    }

    function pintarPrevia() {
        const previa = $("previaSite");
        if (!previa) return;

        const fundo = efetiva("siteCorFundo");
        const claro = luminancia(fundo) > 0.4;
        const botoes = efetiva("siteCorBotoes");

        previa.style.setProperty("--p-principal", efetiva("siteCorPrincipal"));
        previa.style.setProperty("--p-secundaria", efetiva("siteCorDestaque"));
        previa.style.setProperty("--p-botoes", botoes);
        previa.style.setProperty("--p-botoes-texto", textoSobre(botoes));
        previa.style.setProperty("--p-detalhes", efetiva("siteCorDetalhes"));
        previa.style.setProperty("--p-fundo", fundo);
        previa.style.setProperty("--p-texto", claro ? "#151515" : "#F5F5F5");
        previa.style.setProperty("--p-texto-suave", claro ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.62)");
        previa.style.setProperty("--p-cartao", claro ? "rgba(0,0,0,.05)" : "rgba(255,255,255,.06)");
        previa.style.setProperty("--p-borda", claro ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.12)");

        const fonte = ($("siteFonte") || {}).value || "";
        previa.style.setProperty("--p-fonte", fonte ? `"${fonte}", Arial, sans-serif` : "Arial, Helvetica, sans-serif");

        const nome = (($("barbershopName") || {}).value || "").trim();
        $("previaNome").textContent = nome || "Navalha de Ouro";
    }

    function pintarTudo() {
        pintarControles();
        pintarAlvos();
        pintarPrevia();
    }

    function selecionarAlvo(id, focar) {
        alvo = id;
        hexExato = efetiva(id);
        hsl = hexParaHsl(hexExato);
        pintarControles(true);
        pintarAlvos();
        pintarPrevia();
        mostrarErro("");
        if (focar) document.querySelector(`[data-cor-alvo="${id}"]`).focus();
    }

    // Toda mudança vinda do seletor passa por aqui.
    function aplicarHsl(novo) {
        hsl = {
            h: Math.round(Math.min(360, Math.max(0, novo.h))) % 361,
            s: Math.round(Math.min(100, Math.max(0, novo.s))),
            l: Math.round(Math.min(100, Math.max(0, novo.l)))
        };
        hexExato = null;
        gravar(alvo, hslParaHex(hsl));
        pintarTudo();
    }

    function mostrarErro(msg) {
        const el = $("seletorCorErro");
        if (el) el.textContent = msg;
        const campo = $("seletorCorHex");
        if (campo) campo.setAttribute("aria-invalid", msg ? "true" : "false");
    }

    // ------------------------------------------
    // Eventos do seletor
    // ------------------------------------------

    function ligarArea() {
        const area = $("seletorCorArea");

        function mover(evento) {
            const r = area.getBoundingClientRect();
            const x = Math.min(1, Math.max(0, (evento.clientX - r.left) / r.width));
            const y = Math.min(1, Math.max(0, (evento.clientY - r.top) / r.height));
            aplicarHsl({ h: hsl.h, s: x * 100, l: (1 - y) * 100 });
        }

        area.addEventListener("pointerdown", (e) => {
            try {
                area.setPointerCapture(e.pointerId);
            } catch {
                /* ponteiro já liberado */
            }
            area.focus({ preventScroll: true });
            mover(e);
        });
        area.addEventListener("pointermove", (e) => {
            if (area.hasPointerCapture && area.hasPointerCapture(e.pointerId)) mover(e);
        });
        area.addEventListener("keydown", (e) => {
            const passo = e.shiftKey ? 10 : 1;
            const mapa = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] };
            if (!mapa[e.key]) return;
            e.preventDefault();
            aplicarHsl({ h: hsl.h, s: hsl.s + mapa[e.key][0], l: hsl.l + mapa[e.key][1] });
        });
    }

    function ligarControles() {
        $("seletorCorMatiz").addEventListener("input", (e) => aplicarHsl({ ...hsl, h: Number(e.target.value) }));
        $("seletorCorSaturacao").addEventListener("input", (e) => aplicarHsl({ ...hsl, s: Number(e.target.value) }));
        $("seletorCorLuz").addEventListener("input", (e) => aplicarHsl({ ...hsl, l: Number(e.target.value) }));

        const campoHex = $("seletorCorHex");
        campoHex.addEventListener("input", () => {
            const hex = normalizarHex(campoHex.value);
            if (!hex) {
                mostrarErro(campoHex.value.trim().length >= 4 ? "Use o formato #RRGGBB, por exemplo #C9A45C." : "");
                return;
            }
            mostrarErro("");
            hexExato = hex;
            hsl = hexParaHsl(hex);
            gravar(alvo, hex);
            pintarControles();
            pintarAlvos();
            pintarPrevia();
        });
        campoHex.addEventListener("blur", () => {
            mostrarErro("");
            campoHex.value = hexExato || hslParaHex(hsl);
        });

        $("seletorCorNativo").addEventListener("input", (e) => {
            const hex = normalizarHex(e.target.value);
            if (!hex) return;
            hexExato = hex;
            hsl = hexParaHsl(hex);
            gravar(alvo, hex);
            pintarTudo();
        });

        const sugestoes = $("seletorCorSugestoes");
        SUGESTOES.forEach(([hex, nome]) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "seletor-cor__sugestao";
            b.style.background = hex;
            b.title = `${nome} (${hex})`;
            b.setAttribute("aria-label", `${nome}, ${hex}`);
            b.addEventListener("click", () => {
                hexExato = hex;
                hsl = hexParaHsl(hex);
                gravar(alvo, hex);
                pintarTudo();
            });
            sugestoes.appendChild(b);
        });

        const grupo = $("corAlvos");
        grupo.addEventListener("click", (e) => {
            const b = e.target.closest("[data-cor-alvo]");
            if (b) selecionarAlvo(b.dataset.corAlvo);
        });
        grupo.addEventListener("keydown", (e) => {
            const i = CAMPOS.indexOf(alvo);
            const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
            if (!delta) return;
            e.preventDefault();
            selecionarAlvo(CAMPOS[(i + delta + CAMPOS.length) % CAMPOS.length], true);
        });

        $("restaurarCorAtual").addEventListener("click", () => {
            gravar(alvo, "");
            selecionarAlvo(alvo);
            aviso(`"${NOMES[alvo]}" voltou para a cor original. Salve para aplicar no site.`, "info");
        });

        $("restaurarCoresOriginais").addEventListener("click", () => {
            CAMPOS.forEach((id) => gravar(id, ""));
            selecionarAlvo(alvo);
            aviso("Todas as cores voltaram para as originais. Salve para aplicar no site.", "info");
        });

        const nome = $("barbershopName");
        if (nome) nome.addEventListener("input", pintarPrevia);
    }

    function aviso(msg, tipo) {
        if (window.PainelUI) window.PainelUI.aviso(msg, tipo);
    }

    // ------------------------------------------
    // Fontes
    // ------------------------------------------

    function carregarFontesDaPrevia() {
        if (document.getElementById("painelFontesPrevia") || !window.SiteTema) return;
        const todas = GRUPOS_FONTE.flatMap((g) => g.fontes);
        const familias = todas.map((nome) => {
            const info = window.SiteTema.FONTES[nome];
            const pesos = info ? info.pesos.split(";").filter((p) => p === "400" || p === "700") : ["400"];
            return `family=${encodeURIComponent(nome).replace(/%20/g, "+")}:wght@${(pesos.length ? pesos : ["400"]).join(";")}`;
        });
        const link = document.createElement("link");
        link.id = "painelFontesPrevia";
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?${familias.join("&")}&display=swap`;
        document.head.appendChild(link);
    }

    function cartaoFonte(nome, rotulo, familia) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "fonte-opcao";
        b.setAttribute("role", "radio");
        b.dataset.fonte = nome;

        const amostra = document.createElement("span");
        amostra.className = "fonte-opcao__amostra";
        amostra.style.fontFamily = familia;
        amostra.textContent = "Aa";

        const corpo = document.createElement("span");
        corpo.className = "fonte-opcao__corpo";
        const titulo = document.createElement("strong");
        titulo.textContent = rotulo;
        const frase = document.createElement("span");
        frase.className = "fonte-opcao__frase";
        frase.style.fontFamily = familia;
        frase.textContent = "Seu estilo começa aqui.";
        corpo.append(titulo, frase);

        const marca = document.createElement("span");
        marca.className = "fonte-opcao__marca";
        marca.setAttribute("aria-hidden", "true");
        marca.textContent = "✓";

        b.append(amostra, corpo, marca);
        b.addEventListener("click", () => escolherFonte(nome));
        return b;
    }

    function montarFontes() {
        const destino = $("fontesGrupos");
        if (!destino) return;
        destino.replaceChildren();

        const padrao = document.createElement("div");
        padrao.className = "fonte-grupo fonte-grupo--padrao";
        padrao.append(cartaoFonte("", "Padrão do site (Arial)", "Arial, Helvetica, sans-serif"));
        destino.appendChild(padrao);

        GRUPOS_FONTE.forEach((g) => {
            const grupo = document.createElement("div");
            grupo.className = "fonte-grupo";
            const cab = document.createElement("div");
            cab.className = "fonte-grupo__cabecalho";
            const t = document.createElement("strong");
            t.textContent = g.titulo;
            const d = document.createElement("span");
            d.textContent = g.descricao;
            cab.append(t, d);
            const lista = document.createElement("div");
            lista.className = "fonte-grupo__lista";
            g.fontes.forEach((nome) => {
                const reserva = (window.SiteTema && window.SiteTema.FONTES[nome] || {}).categoria || "sans-serif";
                lista.appendChild(cartaoFonte(nome, nome, `"${nome}", ${reserva}`));
            });
            grupo.append(cab, lista);
            destino.appendChild(grupo);
        });

        // Fonte digitada antes (campo livre antigo) continua disponível.
        const atual = (($("siteFonte") || {}).value || "").trim();
        const conhecidas = GRUPOS_FONTE.flatMap((g) => g.fontes);
        if (atual && !conhecidas.includes(atual)) {
            const extra = document.createElement("div");
            extra.className = "fonte-grupo fonte-grupo--padrao";
            extra.append(cartaoFonte(atual, `Atual: ${atual}`, `"${atual}", sans-serif`));
            destino.appendChild(extra);
        }

        pintarFontes();
    }

    function pintarFontes() {
        const atual = (($("siteFonte") || {}).value || "").trim();
        document.querySelectorAll(".fonte-opcao").forEach((b) => {
            const ativa = b.dataset.fonte === atual;
            b.setAttribute("aria-checked", ativa ? "true" : "false");
            b.tabIndex = ativa ? 0 : -1;
        });
        if (!document.querySelector('.fonte-opcao[aria-checked="true"]')) {
            const primeira = document.querySelector(".fonte-opcao");
            if (primeira) primeira.tabIndex = 0;
        }
    }

    function escolherFonte(nome) {
        const campo = $("siteFonte");
        if (!campo || campo.value === nome) return;
        campo.value = nome;
        campo.dispatchEvent(new Event("input", { bubbles: true }));
        pintarFontes();
        pintarPrevia();
    }

    function ligarTecladoFontes() {
        const destino = $("fontesGrupos");
        destino.addEventListener("keydown", (e) => {
            const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
            if (!delta) return;
            const opcoes = [...destino.querySelectorAll(".fonte-opcao")];
            const i = opcoes.indexOf(document.activeElement);
            if (i < 0) return;
            e.preventDefault();
            const prox = opcoes[(i + delta + opcoes.length) % opcoes.length];
            prox.focus();
            escolherFonte(prox.dataset.fonte);
        });
    }

    // ------------------------------------------
    // Início e sincronização com os dados carregados
    // ------------------------------------------

    // Chamado pelo painel depois de preencher o formulário com o banco.
    function sincronizar() {
        if (!iniciado) return;
        CAMPOS.forEach((id) => {
            const el = $(id);
            if (el) el.value = normalizarHex(el.value);
        });
        montarFontes();
        selecionarAlvo(alvo);
    }

    function iniciar() {
        if (iniciado || !$("seletorCor")) return;
        iniciado = true;
        ligarArea();
        ligarControles();
        ligarTecladoFontes();
        carregarFontesDaPrevia();
        sincronizar();
    }

    window.PainelAparencia = { sincronizar };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
})();
