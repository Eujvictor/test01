// =====================================================================
// GERADOR DO TEMA CLARO DO PAINEL
// Lê admin-novo.css e gera painel-tema-claro.css com as mesmas regras,
// prefixadas por html[data-tema="claro"], trocando só as cores.
// O CSS original não é alterado.
//
// Uso (na pasta SITE DE AGENDAMENTO):
//   node ferramentas/gerar-tema-claro.cjs
// Rode de novo sempre que admin-novo.css mudar.
// =====================================================================
"use strict";

const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const ORIGEM = path.join(raiz, "admin-novo.css");
const DESTINO = path.join(raiz, "painel-tema-claro.css");
const PREFIXO = 'html[data-tema="claro"]';

// ---------- cores ----------
function hexParaRgba(hex) {
    let h = hex.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}

function lerCor(txt) {
    if (txt.startsWith("#")) return hexParaRgba(txt);
    const m = txt.match(/rgba?\(([^)]*)\)/i);
    if (m) {
        const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    if (/^white$/i.test(txt)) return { r: 255, g: 255, b: 255, a: 1 };
    if (/^black$/i.test(txt)) return { r: 0, g: 0, b: 0, a: 1 };
    return null;
}

function paraHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s, l };
}

function deHsl(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

const fmt = ({ r, g, b }, a) => (a >= 1 ? "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("") : `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`);
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

// tipo: "fundo" | "texto" | "borda" | "sombra"
function converter(cor, tipo) {
    const { h, s, l } = paraHsl(cor);
    const a = cor.a;
    const neutra = s < 0.18 || l < 0.08;

    // Sobreposições translúcidas brancas viram sobreposições escuras.
    if (a < 1 && neutra && l > 0.85) {
        if (tipo === "sombra") return fmt({ r: 30, g: 25, b: 18 }, Math.min(0.12, a * 1.2));
        return fmt({ r: 28, g: 24, b: 18 }, limitar(a * (tipo === "borda" ? 1.25 : 1.1), 0.015, 0.6));
    }
    // Sombras pretas ficam mais suaves.
    if (neutra && l < 0.15 && (tipo === "sombra" || (a < 1 && tipo !== "fundo"))) {
        return fmt({ r: 40, g: 32, b: 20 }, a * 0.35);
    }
    if (neutra && l < 0.15 && a < 1 && tipo === "fundo") {
        // Véus escuros (modais) continuam escuros, mais leves.
        return a >= 0.5 ? fmt({ r: 20, g: 18, b: 15 }, a * 0.7) : fmt({ r: 40, g: 32, b: 20 }, a * 0.5);
    }

    if (neutra) {
        if (tipo === "texto") {
            if (l < 0.25) return fmt(cor, a); // texto escuro (ex.: sobre botão dourado) continua escuro
            const nl = limitar(0.11 + (1 - l) * 0.62, 0.11, 0.55);
            return fmt(deHsl(35, 0.06, nl), a);
        }
        if (tipo === "borda") {
            if (l < 0.5) return fmt(deHsl(36, 0.12, limitar(0.9 - l * 0.3, 0.78, 0.9)), a);
            return fmt(deHsl(36, 0.08, 0.3), a);
        }
        // fundos
        if (l > 0.85) return fmt(deHsl(36, 0.1, 0.14), a); // fundo branco → escuro (chips invertidos)
        let nl;
        if (l < 0.075) nl = 0.955;       // fundo da página
        else if (l < 0.13) nl = 1;       // cartões e superfícies
        else if (l < 0.2) nl = 0.968;    // campos e elementos elevados
        else if (l < 0.5) nl = 0.92;
        else nl = 0.6;
        return fmt(deHsl(40, nl >= 1 ? 0 : 0.18, nl), a);
    }

    // Cores com matiz (dourado, verde, vermelho...).
    if (tipo === "texto" && l > 0.5) {
        const dourado = h >= 25 && h <= 55;
        return fmt(deHsl(h, Math.min(s, dourado ? 0.62 : 0.7), dourado ? 0.36 : 0.38), a);
    }
    if (tipo === "fundo" && a >= 1 && l < 0.2) {
        // fundos escuros tingidos → versão clara tingida
        return fmt(deHsl(h, Math.min(s, 0.4), 0.95), a);
    }
    if (a < 1 && tipo !== "texto") return fmt(cor, Math.min(1, a * 1.5)); // tintas suaves ficam um pouco mais visíveis
    return fmt(cor, a);
}

const RE_COR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;

function tipoDaPropriedade(prop) {
    if (/^(color|caret-color|-webkit-text-fill-color|fill|stroke|text-decoration-color)$/.test(prop)) return "texto";
    if (/shadow/.test(prop)) return "sombra";
    if (/^(border|outline)/.test(prop)) return "borda";
    if (/^background/.test(prop)) return "fundo";
    return null;
}

function converterValor(prop, valor) {
    const tipo = tipoDaPropriedade(prop);
    if (!tipo) return null;
    if (!RE_COR.test(valor)) return null;
    RE_COR.lastIndex = 0;
    return valor.replace(RE_COR, (t) => {
        const c = lerCor(t);
        return c ? converter(c, tipo) : t;
    });
}

// ---------- leitura do CSS ----------
function semComentarios(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Divide o conteúdo de um bloco em itens: { tipo: "regra"|"at", cabecalho, corpo }
function blocos(css) {
    const itens = [];
    let i = 0;
    while (i < css.length) {
        const abre = css.indexOf("{", i);
        if (abre === -1) break;
        const cabecalho = css.slice(i, abre).trim();
        let prof = 1, j = abre + 1;
        while (j < css.length && prof > 0) {
            if (css[j] === "{") prof++;
            else if (css[j] === "}") prof--;
            j++;
        }
        const corpo = css.slice(abre + 1, j - 1);
        // pula eventuais declarações soltas antes do seletor (ex.: @import;)
        const limpo = cabecalho.replace(/^[^{}]*;/, "").trim();
        itens.push({ cabecalho: limpo, corpo });
        i = j;
    }
    return itens;
}

function declaracoes(corpo) {
    const lista = [];
    let atual = "", parenteses = 0;
    for (const ch of corpo) {
        if (ch === "(") parenteses++;
        if (ch === ")") parenteses--;
        if (ch === ";" && parenteses === 0) { lista.push(atual); atual = ""; continue; }
        atual += ch;
    }
    if (atual.trim()) lista.push(atual);
    return lista.map((d) => {
        const k = d.indexOf(":");
        if (k === -1) return null;
        return { prop: d.slice(0, k).trim().toLowerCase(), valor: d.slice(k + 1).trim().replace(/\s+/g, " ") };
    }).filter(Boolean);
}

function dividirSeletores(sel) {
    const partes = [];
    let atual = "", prof = 0;
    for (const ch of sel) {
        if (ch === "(" || ch === "[") prof++;
        if (ch === ")" || ch === "]") prof--;
        if (ch === "," && prof === 0) { partes.push(atual.trim()); atual = ""; continue; }
        atual += ch;
    }
    if (atual.trim()) partes.push(atual.trim());
    return partes;
}

function prefixar(sel) {
    return dividirSeletores(sel.replace(/\s+/g, " ")).map((s) => {
        if (s === ":root" || s === "html") return PREFIXO;
        if (s.startsWith(":root")) return PREFIXO + s.slice(5);
        if (s.startsWith("html")) return PREFIXO + s.slice(4);
        return `${PREFIXO} ${s}`;
    }).join(",\n");
}

let regras = 0, decls = 0;

function processar(css, recuo = "") {
    let saida = "";
    for (const { cabecalho, corpo } of blocos(css)) {
        if (cabecalho.startsWith("@media") || cabecalho.startsWith("@supports")) {
            const interno = processar(corpo, recuo + "    ");
            if (interno.trim()) saida += `${recuo}${cabecalho} {\n${interno}${recuo}}\n`;
            continue;
        }
        if (cabecalho.startsWith("@")) continue; // @keyframes, @font-face...
        const convertidas = [];
        for (const { prop, valor } of declaracoes(corpo)) {
            if (prop.startsWith("--")) continue; // variáveis ficam em painel-tema.css
            const importante = /!important$/i.test(valor);
            const base = valor.replace(/\s*!important$/i, "");
            const novo = converterValor(prop, base);
            if (base.includes(":")) continue; // declaração malformada no original
            if (novo !== null && novo !== base) convertidas.push(`${recuo}    ${prop}: ${novo}${importante ? " !important" : ""};`);
        }
        if (convertidas.length) {
            regras++; decls += convertidas.length;
            saida += `${recuo}${prefixar(cabecalho).split("\n").join("\n" + recuo)} {\n${convertidas.join("\n")}\n${recuo}}\n`;
        }
    }
    return saida;
}

const css = semComentarios(fs.readFileSync(ORIGEM, "utf8"));
const corpo = processar(css);
const cabecalho = `/* =====================================================================
   PAINEL — TEMA CLARO (ARQUIVO GERADO, NÃO EDITE À MÃO)
   Gerado por ferramentas/gerar-tema-claro.cjs a partir de admin-novo.css.
   Ajustes manuais do tema claro ficam em painel-tema.css.
   ===================================================================== */\n\n`;
fs.writeFileSync(DESTINO, cabecalho + corpo);
console.log(`painel-tema-claro.css: ${regras} regras, ${decls} declarações convertidas.`);
