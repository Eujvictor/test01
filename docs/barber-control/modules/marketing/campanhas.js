// =====================================================================
// CAMPANHAS — criar, editar, duplicar, ativar (com prévia do público),
// arquivar e acompanhar resultados demonstrativos.
// =====================================================================
import * as O from "../../services/demo/operacao.js";
import { TIPOS_CAMPANHA, STATUS_CAMPANHA, STATUS_BARBEARIA, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda, percentual } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { abrirPainel } from "../../js/components/painel.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, kpi, estadoVazio, listaDefinicao, linhaDoTempo, botaoIcone, campoBusca, campoSelect, novaRaiz
} from "../../js/components/ui.js";
import { camposSegmento, filtrosDosValores, valoresDosFiltros } from "./segmentacao.js";

const filtros = { busca: "", status: "", tipo: "" };
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dataCurta = (t) => (t ? t.split("-").reverse().join("/") : "—");
const hoje = () => O.hojeTexto();

function camposCampanha() {
    return [
        { nome: "nome", rotulo: "Nome da campanha", tipo: "texto", obrigatorio: true, maxlength: 80 },
        { nome: "tipo", rotulo: "Tipo", tipo: "select", obrigatorio: true, opcoes: opcoes(TIPOS_CAMPANHA), largura: "meia" },
        { nome: "cupomId", rotulo: "Cupom vinculado", tipo: "select", opcoes: [["", "Nenhum"], ...O.cupons().map((c) => [c.id, `${c.codigo} · ${c.descricao}`])], largura: "meia" },
        { nome: "objetivo", rotulo: "Objetivo", tipo: "textarea", obrigatorio: true, maxlength: 300 },
        { nome: "inicio", rotulo: "Início", tipo: "data", obrigatorio: true, largura: "meia" },
        { nome: "fim", rotulo: "Fim", tipo: "data", obrigatorio: true, largura: "meia", validar: (v, x) => (x.inicio && v < x.inicio ? "O fim deve ser igual ou posterior ao início." : null) },
        { nome: "orcamento", rotulo: "Orçamento demonstrativo (R$)", tipo: "numero", obrigatorio: true, min: 0, max: 1000000, passo: 0.01, largura: "meia" },
        {
            nome: "prospectsEstimados", rotulo: "Prospects estimados", tipo: "numero", min: 0, max: 100000, passo: 1, largura: "meia",
            ajuda: "Só para aquisição: barbearias ainda não cadastradas.",
            validarVazio: true, validar: (v, x) => (x.tipo === "aquisicao" && !(v > 0) ? "Informe o público estimado da aquisição." : null)
        },
        { tipo: "secao", rotulo: "Público (barbearias cadastradas)" },
        ...camposSegmento()
    ];
}

const paraDados = (v) => ({ ...v, filtros: filtrosDosValores(v) });

export async function novaCampanha({ filtros: preset = {} } = {}) {
    const fim = new Date(); fim.setDate(fim.getDate() + 30);
    const criada = await abrirFormulario({
        titulo: "Nova campanha",
        descricao: "A campanha é criada como rascunho. Nenhuma mensagem é enviada, mesmo depois de ativada.",
        campos: camposCampanha(),
        valores: { tipo: "retencao", inicio: hoje(), fim: fim.toISOString().slice(0, 10), orcamento: 0, ...valoresDosFiltros(preset) },
        textoSalvar: "Criar campanha",
        aoSalvar: (v) => O.salvarCampanha(paraDados(v))
    });
    if (criada) {
        mostrarToast(`Campanha "${criada.nome}" criada como rascunho.`, "sucesso");
        window.location.hash = `#/marketing/campanha/${criada.id}`;
    }
    return Boolean(criada);
}

async function editarCampanha(id) {
    const c = O.campanha(id);
    const salvo = await abrirFormulario({
        titulo: `Editar ${c.nome}`,
        campos: camposCampanha(),
        valores: { ...c, cupomId: c.cupomId ?? "", prospectsEstimados: c.publico.prospectsEstimados ?? null, ...valoresDosFiltros(c.publico.filtros) },
        textoSalvar: "Salvar campanha",
        aoSalvar: (v) => O.salvarCampanha(paraDados(v), id)
    });
    if (salvo) mostrarToast("Campanha atualizada.", "sucesso");
    return Boolean(salvo);
}

function previaPublico(c) {
    if (c.publico.tipo === "prospects") {
        return html`<p>Público de aquisição: <strong>${numero(c.publico.prospectsEstimados)}</strong> prospects estimados (barbearias ainda não cadastradas).</p>`;
    }
    const lista = O.publicoCampanha(c);
    return html`
        <p class="texto-sec">${O.descreverFiltros(c.publico.filtros)}</p>
        <h4 class="secao__titulo secao__titulo--espaco previa-alcance">${numero(lista.length)} barbearias no público</h4>
        ${lista.length ? html`<ul class="chips">${lista.slice(0, 40).map((b) => html`<li class="chip">${b.nome}</li>`)}${lista.length > 40 ? html`<li class="chip">+${lista.length - 40}</li>` : ""}</ul>`
            : html`<p class="texto-terc">Nenhuma barbearia atende aos critérios.</p>`}`;
}

async function ativar(id) {
    const c = O.campanha(id);
    const escolha = await abrirPainel({
        titulo: "Pré-visualizar público e ativar",
        descricao: "Confira o público antes de ativar. Nenhuma mensagem será enviada (demonstração).",
        conteudo: previaPublico(c),
        acoes: [{ valor: "ativar", rotulo: "Ativar campanha (demonstração)" }]
    });
    if (escolha !== "ativar") return false;
    O.ativarCampanha(id);
    mostrarToast("Campanha ativada (demonstração; nada foi enviado).", "sucesso");
    return true;
}

export async function executarAcaoCampanha(acao, id) {
    try {
        switch (acao) {
            case "nova-campanha": return await novaCampanha();
            case "ver-campanha": window.location.hash = `#/marketing/campanha/${id}`; return false;
            case "editar-campanha": return await editarCampanha(id);
            case "duplicar-campanha": {
                const nova = O.duplicarCampanha(id);
                mostrarToast(`Campanha duplicada como "${nova.nome}".`, "sucesso");
                return true;
            }
            case "ativar-campanha": return await ativar(id);
            case "previa-campanha": await abrirPainel({ titulo: "Público da campanha", conteudo: previaPublico(O.campanha(id)) }); return false;
            case "arquivar-campanha":
                if (!(await confirmar({ titulo: "Arquivar campanha?", mensagem: "Ela sai da lista ativa; resultados e histórico são mantidos.", textoConfirmar: "Arquivar", perigo: true }))) return false;
                O.arquivarCampanha(id); mostrarToast("Campanha arquivada.", "sucesso"); return true;
            case "restaurar-campanha": O.restaurarCampanha(id); mostrarToast("Campanha restaurada.", "sucesso"); return true;
            case "simular-campanha": O.simularResultados(id); mostrarToast("Resultados simulados atualizados (fictício).", "sucesso"); return true;
            default: return false;
        }
    } catch (falha) {
        mostrarToast(falha.message, "erro");
        return false;
    }
}

const COLUNAS = [
    { chave: "nome", rotulo: "Campanha", render: (c) => html`<a class="link-forte" href="#/marketing/campanha/${c.id}">${c.nome}</a><span class="celula-sub">${TIPOS_CAMPANHA[c.tipo]}</span>` },
    { chave: "inicio", rotulo: "Período", render: (c) => `${dataCurta(c.inicio)} – ${dataCurta(c.fim)}` },
    { chave: "alcance", rotulo: "Público", classe: "col-num", valor: (c) => O.alcanceCampanha(c), render: (c) => html`${numero(O.alcanceCampanha(c))}<span class="celula-sub">${c.publico.tipo === "prospects" ? "prospects" : "barbearias"}</span>` },
    { chave: "orcamento", rotulo: "Orçamento", classe: "col-num", render: (c) => moeda(c.orcamento) },
    { chave: "conversoes", rotulo: "Conversões", classe: "col-num", valor: (c) => c.resultados.conversoes, render: (c) => numero(c.resultados.conversoes) },
    { chave: "status", rotulo: "Status", valor: (c) => O.statusCampanha(c), render: (c) => badgeStatus(STATUS_CAMPANHA, O.statusCampanha(c)) },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (c) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "ver-campanha", id: c.id, nomeIcone: "eye", rotulo: `Ver ${c.nome}` })}
            ${c.status !== "arquivada" ? botaoIcone({ acao: "editar-campanha", id: c.id, nomeIcone: "pencil", rotulo: "Editar" }) : ""}
            ${botaoIcone({ acao: "duplicar-campanha", id: c.id, nomeIcone: "copy", rotulo: "Duplicar" })}
            ${c.status === "arquivada"
                ? botaoIcone({ acao: "restaurar-campanha", id: c.id, nomeIcone: "archive-restore", rotulo: "Restaurar" })
                : botaoIcone({ acao: "arquivar-campanha", id: c.id, nomeIcone: "archive", rotulo: "Arquivar", perigo: true })}
        </div>`
    }
];

export function renderSecao({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Campanhas</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-acao="nova-campanha">${icone("plus")}<span>Nova campanha</span></button>
            </div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fBusca", valor: filtros.busca, placeholder: "Pesquisar campanha" })}
                ${campoSelect({ id: "fStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_CAMPANHA)] })}
                ${campoSelect({ id: "fTipo", rotulo: "Tipo", valor: filtros.tipo, opcoes: [["", "Todos os tipos"], ...opcoes(TIPOS_CAMPANHA)] })}
            </div>
            <div data-tabela></div>
        </section>`);
    const linhas = () => O.campanhas().filter((c) =>
        (!filtros.busca || normalizar(c.nome).includes(normalizar(filtros.busca))) &&
        (!filtros.status || O.statusCampanha(c) === filtros.status) && (!filtros.tipo || c.tipo === filtros.tipo));
    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "inicio", direcao: "desc" }, vazio: "Nenhuma campanha corresponde aos filtros.", rotulo: "Campanhas" });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());

    let espera;
    secao.querySelector("#fBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { filtros.busca = e.target.value; tabela.definirLinhas(linhas()); }, 150);
    });
    secao.querySelector("#fStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(linhas()); });
    secao.querySelector("#fTipo").addEventListener("change", (e) => { filtros.tipo = e.target.value; tabela.definirLinhas(linhas()); });
    secao.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao || botao.dataset.acao === "restaurar-demo") return;
        if (await executarAcaoCampanha(botao.dataset.acao, botao.dataset.id)) {
            tabela.atualizarLinhas(linhas());
            atualizarIndicadores();
        }
    });
}

export function renderDetalhe(view, id) {
    const raiz = novaRaiz(view);
    const c = O.campanha(id);
    if (!c) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Campanha não encontrada", voltar: { href: "#/marketing", rotulo: "Marketing" } })}
            <section class="card">${estadoVazio({ iconeNome: "megaphone", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const status = O.statusCampanha(c);
    const r = c.resultados;
    const alcance = O.alcanceCampanha(c);
    const cupom = c.cupomId ? O.cupom(c.cupomId) : null;
    const publico = O.publicoCampanha(c);

    renderizar(raiz, html`
        ${cabecalho({
            titulo: c.nome,
            voltar: { href: "#/marketing", rotulo: "Marketing" },
            extra: badgeStatus(STATUS_CAMPANHA, status),
            subtitulo: `${TIPOS_CAMPANHA[c.tipo]} · ${dataCurta(c.inicio)} a ${dataCurta(c.fim)}`,
            acoes: html`
                ${c.status === "rascunho" ? html`<button class="btn btn--primario" type="button" data-acao="ativar-campanha" data-id="${c.id}">${icone("circle-play")}<span>Pré-visualizar e ativar</span></button>` : ""}
                ${status === "ativa" ? html`<button class="btn" type="button" data-acao="simular-campanha" data-id="${c.id}">${icone("flask-conical")}<span>Simular resultados</span></button>` : ""}
                ${c.status !== "arquivada" ? html`<button class="btn" type="button" data-acao="editar-campanha" data-id="${c.id}">${icone("pencil")}<span>Editar</span></button>` : ""}
                <button class="btn" type="button" data-acao="duplicar-campanha" data-id="${c.id}">${icone("copy")}<span>Duplicar</span></button>
                ${c.status === "arquivada"
                    ? html`<button class="btn" type="button" data-acao="restaurar-campanha" data-id="${c.id}">${icone("archive-restore")}<span>Restaurar</span></button>`
                    : html`<button class="btn btn--perigo" type="button" data-acao="arquivar-campanha" data-id="${c.id}">${icone("archive")}<span>Arquivar</span></button>`}`
        })}
        ${avisoDemo()}
        <section class="grade grade--kpi grade--kpi-5 secao">
            ${kpi({ rotulo: "Público impactado", valor: numero(r.impactadas || (status === "rascunho" ? 0 : alcance)), iconeNome: "users", nota: c.publico.tipo === "prospects" ? "Prospects estimados" : "Barbearias" })}
            ${kpi({ rotulo: "Interações", valor: numero(r.interacoes), iconeNome: "mouse-pointer-click", nota: "Fictícias" })}
            ${kpi({ rotulo: "Conversões", valor: numero(r.conversoes), iconeNome: "target", nota: "Fictícias", destaque: true })}
            ${kpi({ rotulo: "Taxa de conversão", valor: percentual(r.impactadas ? r.conversoes / r.impactadas : 0), iconeNome: "percent", nota: "Conversões ÷ impactados" })}
            ${kpi({ rotulo: "Investido", valor: moeda(r.investido), iconeNome: "wallet", nota: `de ${moeda(c.orcamento)} · ${r.conversoes ? `${moeda(r.investido / r.conversoes)} por conversão` : "sem conversões"}` })}
        </section>
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Dados da campanha</h2></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Tipo", TIPOS_CAMPANHA[c.tipo]], ["Objetivo", c.objetivo], ["Período", `${dataCurta(c.inicio)} a ${dataCurta(c.fim)}`],
                    ["Orçamento demonstrativo", moeda(c.orcamento)], ["Cupom", cupom ? `${cupom.codigo} · ${cupom.descricao}` : "Nenhum"],
                    ["Público", c.publico.tipo === "prospects" ? `${numero(c.publico.prospectsEstimados)} prospects estimados` : O.descreverFiltros(c.publico.filtros)]
                ])}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                <div class="card__corpo">${linhaDoTempo(O.historicoDe("campanha", c.id))}</div>
            </section>
        </div>
        ${c.publico.tipo !== "prospects" ? html`
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Barbearias no público</h2><span class="badge">${numero(publico.length)}</span></div>
                ${publico.length ? html`<ul class="lista">${publico.slice(0, 15).map((b) => html`
                    <li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/barbearias/${b.id}">${b.nome}</a>
                    <div class="lista__meta">${b.cidade}/${b.estado}</div></div>${badgeStatus(STATUS_BARBEARIA, b.status)}</li>`)}</ul>
                    ${publico.length > 15 ? html`<p class="card__corpo texto-terc">+${publico.length - 15} barbearias</p>` : ""}`
                    : estadoVazio({ iconeNome: "users", titulo: "Nenhuma barbearia no público" })}
            </section>` : ""}`);

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        if (botao.dataset.acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderDetalhe(view, id));
        const acao = botao.dataset.acao;
        if (await executarAcaoCampanha(acao, botao.dataset.id)) {
            if (acao === "duplicar-campanha") {
                const copia = O.campanhas().at(-1);
                window.location.hash = `#/marketing/campanha/${copia.id}`;
            } else renderDetalhe(view, id);
        }
    });
}
