// =====================================================================
// Componentes visuais reutilizáveis (retornam HTML seguro via html``).
// =====================================================================
import { html, icone, bruto, renderizar } from "../utilities/dom.js";
import { dataHora, tempoRelativo } from "../utilities/format.js";
import { confirmar, mostrarToast } from "../utilities/feedback.js";
import { restaurarDadosIniciais, persistenciaAtiva } from "../../services/demo/store.js";

export function cabecalho({ titulo, subtitulo = "", acoes = "", voltar = null, extra = "" }) {
    return html`
        <header class="pagina-cabecalho">
            <div class="pagina-cabecalho__texto">
                ${voltar ? html`<a class="voltar" href="${voltar.href}">${icone("arrow-left")}<span>${voltar.rotulo}</span></a>` : ""}
                <div class="pagina-cabecalho__titulo"><h1>${titulo}</h1>${extra}</div>
                ${subtitulo ? html`<p>${subtitulo}</p>` : ""}
            </div>
            ${acoes ? html`<div class="pagina-cabecalho__acoes">${acoes}</div>` : ""}
        </header>`;
}

// Faixa que identifica os módulos demonstrativos + restauração dos dados iniciais.
export function avisoDemo() {
    const persistente = persistenciaAtiva();
    return html`
        <div class="aviso-demo" role="note">
            ${icone("flask-conical")}
            <span><strong>Dados demonstrativos.</strong>
                Registros fictícios ${persistente ? "salvos apenas neste navegador" : "mantidos só nesta aba (armazenamento local bloqueado)"}.
                Nenhuma cobrança, conta de acesso ou integração real é criada.</span>
            <button class="btn btn--fantasma btn--pequeno" type="button" data-acao="restaurar-demo">
                ${icone("rotate-ccw")}<span>Restaurar dados iniciais</span>
            </button>
        </div>`;
}

export async function tratarRestauracaoDemo(aoConcluir) {
    const ok = await confirmar({
        titulo: "Restaurar dados iniciais?",
        mensagem: "Todas as alterações feitas nos módulos demonstrativos (barbearias, planos, assinaturas, usuários) serão descartadas.",
        textoConfirmar: "Restaurar",
        perigo: true
    });
    if (!ok) return;
    restaurarDadosIniciais();
    mostrarToast("Dados demonstrativos restaurados.", "sucesso");
    aoConcluir?.();
}

export function badgeStatus(mapa, valor) {
    const info = mapa[valor] ?? { rotulo: valor ?? "—", tom: "neutro" };
    const classe = info.tom && info.tom !== "neutro" ? `badge--${info.tom}` : "";
    return html`<span class="badge ${classe}"><span class="ponto"></span>${info.rotulo}</span>`;
}

export function kpi({ rotulo, valor, iconeNome, nota = "", destaque = false }) {
    return html`
        <article class="card kpi ${destaque ? "kpi--destaque" : ""}">
            <div class="kpi__topo">
                <span>${rotulo}</span>
                <span class="kpi__icone">${icone(iconeNome)}</span>
            </div>
            <div class="kpi__valor num">${valor}</div>
            ${nota ? html`<div class="kpi__nota">${nota}</div>` : ""}
        </article>`;
}

export function estadoVazio({ iconeNome = "inbox", titulo, texto = "" }) {
    return html`
        <div class="estado">
            <div class="estado__icone">${icone(iconeNome)}</div>
            <h3>${titulo}</h3>
            ${texto ? html`<p>${texto}</p>` : ""}
        </div>`;
}

export function listaDefinicao(itens) {
    return html`
        <dl class="dl">
            ${itens.filter(Boolean).map(([rotulo, valor]) => html`
                <div class="dl__item"><dt>${rotulo}</dt><dd>${valor === "" || valor === null || valor === undefined ? "—" : valor}</dd></div>`)}
        </dl>`;
}

export function linhaDoTempo(eventos, vazio = "Nenhum evento registrado.") {
    if (!eventos.length) return estadoVazio({ iconeNome: "history", titulo: vazio });
    return html`
        <ol class="timeline">
            ${eventos.map((e) => html`
                <li class="timeline__item">
                    <span class="timeline__marcador"></span>
                    <div class="timeline__conteudo">
                        <p>${e.descricao}</p>
                        <time datetime="${e.data}" title="${dataHora(e.data)}">${dataHora(e.data)} · ${tempoRelativo(e.data)}</time>
                    </div>
                </li>`)}
        </ol>`;
}

export function botaoIcone({ acao, id = "", nomeIcone, rotulo, perigo = false }) {
    return html`
        <button class="btn btn--fantasma btn--icone btn--pequeno ${perigo ? "btn--icone-perigo" : ""}" type="button"
                data-acao="${acao}" data-id="${id}" title="${rotulo}" aria-label="${rotulo}">${icone(nomeIcone)}</button>`;
}

export function opcoesSelect(opcoes, selecionado = "") {
    return opcoes.map(([valor, rotulo]) =>
        html`<option value="${valor}" ${String(valor) === String(selecionado) ? bruto("selected") : ""}>${rotulo}</option>`);
}

export function campoBusca({ id, valor = "", placeholder }) {
    return html`
        <label class="filtro filtro--busca">
            <span class="sr-only">${placeholder}</span>
            ${icone("search")}
            <input class="entrada" type="search" id="${id}" value="${valor}" placeholder="${placeholder}" autocomplete="off">
        </label>`;
}

export function campoSelect({ id, rotulo, opcoes, valor = "" }) {
    return html`
        <label class="filtro">
            <span class="sr-only">${rotulo}</span>
            <select class="entrada" id="${id}" aria-label="${rotulo}">${opcoesSelect(opcoes, valor)}</select>
        </label>`;
}

// Moldura de módulo com abas de navegação (rotas #/base/secao).
// secoes: [[rota, rotulo]] · kpis(): html dos indicadores (opcional)
export function molduraComAbas(view, { titulo, subtitulo, base, secoes, ativa, kpis = null, extra = "", acoes = "", recarregar, classeKpis = "" }) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({ titulo, subtitulo, acoes })}
        ${avisoDemo()}
        ${extra}
        ${kpis ? html`<section class="grade grade--kpi ${classeKpis} secao" data-kpis>${kpis()}</section>` : ""}
        <nav class="abas abas--navegacao" aria-label="Seções de ${titulo}">
            ${secoes.map(([rota, rotulo]) => html`
                <a class="abas__aba" href="${base}${rota ? `/${rota}` : ""}" ${rota === ativa ? bruto('aria-current="page"') : ""}>${rotulo}</a>`)}
        </nav>
        <div data-secao></div>`);
    raiz.addEventListener("click", (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) tratarRestauracaoDemo(recarregar);
    });
    return {
        raiz,
        secao: raiz.querySelector("[data-secao]"),
        atualizarIndicadores: () => { if (kpis) renderizar(raiz.querySelector("[data-kpis]"), kpis()); }
    };
}

// Cada desenho de tela usa uma raiz nova: evita acumular ouvintes de eventos.
export function novaRaiz(view) {
    const raiz = document.createElement("div");
    view.replaceChildren(raiz);
    return raiz;
}

export function iniciais(nome) {
    return String(nome ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
