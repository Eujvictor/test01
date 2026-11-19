// Utilidades de DOM e templates seguros (escape automático contra XSS).

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));

const MAPA_ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => MAPA_ESCAPE[c]);
}

// Marca um trecho de HTML como confiável (use apenas com conteúdo gerado pelo próprio código).
export function bruto(htmlConfiavel) {
    return { __bruto: String(htmlConfiavel) };
}

function formatarValor(valor) {
    if (valor === null || valor === undefined || valor === false) return "";
    if (Array.isArray(valor)) return valor.map(formatarValor).join("");
    if (typeof valor === "object" && "__bruto" in valor) return valor.__bruto;
    return escapar(valor);
}

// Template tag: html`<p>${textoDoUsuario}</p>` — valores são escapados.
export function html(partes, ...valores) {
    let saida = "";
    partes.forEach((parte, i) => {
        saida += parte;
        if (i < valores.length) saida += formatarValor(valores[i]);
    });
    return bruto(saida);
}

export function renderizar(elemento, conteudo) {
    elemento.innerHTML = formatarValor(conteudo);
    // Larguras proporcionais (barras de ranking) via CSSOM: compatível com CSP sem estilos inline.
    elemento.querySelectorAll("[data-largura]").forEach((el) => { el.style.width = `${el.dataset.largura}%`; });
    atualizarIcones();
}

export function icone(nome) {
    return bruto(`<i data-lucide="${escapar(nome)}" aria-hidden="true"></i>`);
}

// Várias renderizações no mesmo ciclo geram uma única varredura de ícones
// (executada antes da pintura da tela, via microtarefa).
let iconesAgendados = false;
export function atualizarIcones() {
    if (iconesAgendados || !window.lucide?.createIcons) return;
    iconesAgendados = true;
    queueMicrotask(() => {
        iconesAgendados = false;
        window.lucide.createIcons({ attrs: { "stroke-width": 1.6 } });
    });
}

export function definirCarregando(botao, carregando, textoCarregando = "Aguarde…") {
    if (!botao) return;
    if (carregando) {
        botao.dataset.textoOriginal = botao.innerHTML;
        botao.disabled = true;
        botao.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${escapar(textoCarregando)}</span>`;
    } else {
        botao.disabled = false;
        if (botao.dataset.textoOriginal) botao.innerHTML = botao.dataset.textoOriginal;
        atualizarIcones();
    }
}
