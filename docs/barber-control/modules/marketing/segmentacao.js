// =====================================================================
// SEGMENTAÇÃO — filtra barbearias cadastradas por plano, tempo de
// cadastro, status, nível de atividade, utilização e assinatura.
// Mostra o público antes de qualquer campanha.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import * as O from "../../services/demo/operacao.js";
import {
    STATUS_BARBEARIA, STATUS_ASSINATURA, FAIXAS_CADASTRO, NIVEIS_ATIVIDADE, NIVEIS_UTILIZACAO, opcoes
} from "../../services/demo/catalogo.js";
import { html, icone, renderizar, bruto } from "../../js/utilities/dom.js";
import { numero, percentual } from "../../js/utilities/format.js";
import { criarTabela } from "../../js/components/tabela.js";
import { badgeStatus } from "../../js/components/ui.js";

export const filtrosSegmento = { planos: [], status: [], faixas: [], atividade: [], utilizacao: [], assinatura: [] };

export function dimensoes() {
    return [
        ["planos", "Plano", S.planos().map((p) => [p.id, p.nome])],
        ["status", "Status da barbearia", opcoes(STATUS_BARBEARIA)],
        ["faixas", "Tempo de cadastro", opcoes(FAIXAS_CADASTRO)],
        ["atividade", "Nível de atividade (30 dias)", opcoes(NIVEIS_ATIVIDADE)],
        ["utilizacao", "Utilização do limite do plano", opcoes(NIVEIS_UTILIZACAO)],
        ["assinatura", "Situação da assinatura", opcoes(STATUS_ASSINATURA)]
    ];
}

// Campos de formulário (checkboxes) usados no cadastro de campanhas.
export function camposSegmento() {
    return dimensoes().map(([chave, rotulo, lista]) => ({ nome: `seg_${chave}`, rotulo, tipo: "checkboxes", opcoes: lista }));
}

export function filtrosDosValores(valores) {
    return Object.fromEntries(dimensoes().map(([chave]) => [chave, valores[`seg_${chave}`] ?? []]).filter(([, v]) => v.length));
}

export function valoresDosFiltros(filtros = {}) {
    return Object.fromEntries(dimensoes().map(([chave]) => [`seg_${chave}`, filtros[chave] ?? []]));
}

export const COLUNAS_PUBLICO = [
    { chave: "nome", rotulo: "Barbearia", valor: (m) => m.barbearia.nome, render: (m) => html`<a class="link-forte" href="#/barbearias/${m.barbearia.id}">${m.barbearia.nome}</a>` },
    { chave: "plano", rotulo: "Plano", valor: (m) => m.plano?.nome ?? "", render: (m) => m.plano?.nome ?? "—" },
    { chave: "status", rotulo: "Status", valor: (m) => m.barbearia.status, render: (m) => badgeStatus(STATUS_BARBEARIA, m.barbearia.status) },
    { chave: "dias", rotulo: "Cadastro", valor: (m) => m.diasCadastro, render: (m) => `${numero(m.diasCadastro)} dias` },
    { chave: "ag30", rotulo: "Agend. 30 dias", classe: "col-num", valor: (m) => m.ag30, render: (m) => numero(m.ag30) },
    { chave: "uso", rotulo: "Utilização", classe: "col-num", valor: (m) => m.utilizacao ?? -1, render: (m) => (m.utilizacao === null ? "Ilimitado" : percentual(m.utilizacao, 0)) },
    { chave: "assinatura", rotulo: "Assinatura", valor: (m) => m.assinatura?.status ?? "", render: (m) => (m.assinatura ? badgeStatus(STATUS_ASSINATURA, m.assinatura.status) : "—") }
];

export function renderSecao({ secao }) {
    renderizar(secao, html`
        <div class="layout-detalhe layout-detalhe--filtros">
            <aside class="layout-detalhe__lateral">
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Critérios</h2>
                        <button class="btn btn--pequeno btn--fantasma" type="button" data-seg="limpar">${icone("filter-x")}<span>Limpar</span></button></div>
                    <div class="card__corpo segmento-filtros">
                        ${dimensoes().map(([chave, rotulo, lista]) => html`
                            <fieldset class="campo--grupo segmento-grupo">
                                <legend class="campo__rotulo">${rotulo}</legend>
                                ${lista.map(([valor, texto]) => html`
                                    <label class="marcar"><input type="checkbox" data-dimensao="${chave}" value="${valor}"
                                        ${filtrosSegmento[chave].includes(valor) ? bruto("checked") : ""}><span>${texto}</span></label>`)}
                            </fieldset>`)}
                        <p class="campo__ajuda">Sem critérios marcados em um grupo = qualquer valor.</p>
                    </div>
                </section>
            </aside>
            <div class="layout-detalhe__principal">
                <section class="card">
                    <div class="card__cabecalho">
                        <div><h2 class="card__titulo">Público selecionado</h2><p class="texto-terc texto-pequeno" data-descricao></p></div>
                        <div class="pagina-cabecalho__acoes">
                            <span class="badge badge--ouro" data-total></span>
                            <button class="btn btn--primario btn--pequeno" type="button" data-seg="campanha">${icone("megaphone")}<span>Criar campanha com este público</span></button>
                        </div>
                    </div>
                    <div data-tabela></div>
                </section>
            </div>
        </div>`);

    const tabela = criarTabela({ colunas: COLUNAS_PUBLICO, ordenacao: { chave: "ag30", direcao: "desc" }, vazio: "Nenhuma barbearia atende a todos os critérios.", rotulo: "Público segmentado" });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);

    function atualizar() {
        const resultado = O.segmentar(filtrosSegmento);
        secao.querySelector("[data-total]").textContent = `${numero(resultado.length)} de ${numero(S.barbearias().length)} barbearias`;
        secao.querySelector("[data-descricao]").textContent = O.descreverFiltros(filtrosSegmento);
        secao.querySelector("[data-seg=campanha]").disabled = !resultado.length;
        tabela.definirLinhas(resultado);
    }
    atualizar();

    secao.addEventListener("change", (e) => {
        const caixa = e.target.closest("[data-dimensao]");
        if (!caixa) return;
        const lista = filtrosSegmento[caixa.dataset.dimensao];
        if (caixa.checked) lista.push(caixa.value);
        else lista.splice(lista.indexOf(caixa.value), 1);
        atualizar();
    });

    secao.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-seg]");
        if (!botao) return;
        if (botao.dataset.seg === "limpar") {
            Object.keys(filtrosSegmento).forEach((k) => { filtrosSegmento[k] = []; });
            secao.querySelectorAll("[data-dimensao]").forEach((c) => { c.checked = false; });
            atualizar();
        }
        if (botao.dataset.seg === "campanha") {
            const { novaCampanha } = await import("./campanhas.js");
            await novaCampanha({ filtros: structuredClone(filtrosSegmento) });
        }
    });
}
