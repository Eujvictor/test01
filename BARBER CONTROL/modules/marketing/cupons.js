// =====================================================================
// CUPONS — registros próprios; nenhum desconto é aplicado a cobranças.
// =====================================================================
import * as O from "../../services/demo/operacao.js";
import { STATUS_CUPOM, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { abrirPainel } from "../../js/components/painel.js";
import { badgeStatus, listaDefinicao, linhaDoTempo, botaoIcone, campoBusca, campoSelect } from "../../js/components/ui.js";

const filtros = { busca: "", status: "" };
const dataCurta = (t) => (t ? t.split("-").reverse().join("/") : "—");
const desconto = (c) => (c.tipoDesconto === "percentual" ? `${numero(c.valor)}%` : moeda(c.valor));

function campos() {
    return [
        { nome: "codigo", rotulo: "Código", tipo: "texto", obrigatorio: true, maxlength: 20, largura: "meia", ajuda: "Letras e números, sem espaços." },
        { nome: "tipoDesconto", rotulo: "Tipo de desconto", tipo: "select", obrigatorio: true, largura: "meia", opcoes: [["percentual", "Percentual (%)"], ["valor", "Valor fixo (R$)"]] },
        { nome: "descricao", rotulo: "Descrição", tipo: "texto", obrigatorio: true, maxlength: 120 },
        { nome: "valor", rotulo: "Valor ou percentual", tipo: "numero", obrigatorio: true, min: 0.01, max: 100000, passo: 0.01, largura: "meia" },
        { nome: "limiteUsos", rotulo: "Limite de utilizações", tipo: "numero", obrigatorio: true, min: 0, max: 100000, passo: 1, largura: "meia", ajuda: "0 = sem limite",
            validar: (v) => (Number.isInteger(v) ? null : "Use um número inteiro.") },
        { nome: "inicio", rotulo: "Início", tipo: "data", obrigatorio: true, largura: "meia" },
        { nome: "validade", rotulo: "Validade", tipo: "data", obrigatorio: true, largura: "meia", validar: (v, x) => (x.inicio && v < x.inicio ? "A validade deve ser igual ou posterior ao início." : null) }
    ];
}

async function editar(id = null) {
    const atual = id ? O.cupom(id) : null;
    const fim = new Date(); fim.setDate(fim.getDate() + 30);
    const salvo = await abrirFormulario({
        titulo: atual ? `Editar cupom ${atual.codigo}` : "Novo cupom",
        descricao: "Cupom demonstrativo: não é aplicado a nenhuma cobrança real.",
        campos: campos(),
        valores: atual ?? { tipoDesconto: "percentual", limiteUsos: 0, inicio: O.hojeTexto(), validade: fim.toISOString().slice(0, 10) },
        textoSalvar: atual ? "Salvar cupom" : "Criar cupom",
        aoSalvar: (v) => O.salvarCupom(v, id)
    });
    if (salvo) mostrarToast(atual ? "Cupom atualizado." : `Cupom ${salvo.codigo} criado.`, "sucesso");
    return Boolean(salvo);
}

async function alternar(id) {
    const c = O.cupom(id);
    if (c.ativo && !(await confirmar({ titulo: `Desativar ${c.codigo}?`, mensagem: "O cupom deixa de ser aceito até ser reativado.", textoConfirmar: "Desativar", perigo: true }))) return false;
    O.alternarCupom(id);
    mostrarToast(`Cupom ${c.codigo} ${c.ativo ? "reativado" : "desativado"}.`, "sucesso");
    return true;
}

async function consultar(id) {
    const c = O.cupom(id);
    const campanhas = O.campanhas().filter((x) => x.cupomId === id);
    await abrirPainel({
        titulo: `Cupom ${c.codigo}`,
        descricao: c.descricao,
        conteudo: html`
            ${listaDefinicao([
                ["Status", badgeStatus(STATUS_CUPOM, O.statusCupom(c))], ["Desconto", desconto(c)],
                ["Vigência", `${dataCurta(c.inicio)} a ${dataCurta(c.validade)}`],
                ["Utilizações", `${numero(c.usos)} de ${c.limiteUsos ? numero(c.limiteUsos) : "ilimitado"} (demonstrativo)`],
                ["Campanhas vinculadas", campanhas.length ? campanhas.map((x) => x.nome).join(", ") : "Nenhuma"]
            ])}
            <h4 class="secao__titulo secao__titulo--espaco previa-alcance">Histórico</h4>
            ${linhaDoTempo(O.historicoDe("cupom", id))}`
    });
    return false;
}

const COLUNAS = [
    { chave: "codigo", rotulo: "Código", render: (c) => html`<button class="link-botao link-forte num" type="button" data-acao="consultar-cupom" data-id="${c.id}">${c.codigo}</button><span class="celula-sub">${c.descricao}</span>` },
    { chave: "valor", rotulo: "Desconto", classe: "col-num", valor: (c) => (c.tipoDesconto === "percentual" ? c.valor : c.valor / 1000), render: (c) => desconto(c) },
    { chave: "inicio", rotulo: "Início", render: (c) => dataCurta(c.inicio) },
    { chave: "validade", rotulo: "Validade", render: (c) => dataCurta(c.validade) },
    { chave: "usos", rotulo: "Utilizações", classe: "col-num", render: (c) => `${numero(c.usos)} / ${c.limiteUsos ? numero(c.limiteUsos) : "∞"}` },
    { chave: "status", rotulo: "Status", valor: (c) => O.statusCupom(c), render: (c) => badgeStatus(STATUS_CUPOM, O.statusCupom(c)) },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (c) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "consultar-cupom", id: c.id, nomeIcone: "eye", rotulo: `Consultar ${c.codigo}` })}
            ${botaoIcone({ acao: "editar-cupom", id: c.id, nomeIcone: "pencil", rotulo: `Editar ${c.codigo}` })}
            ${c.ativo
                ? botaoIcone({ acao: "alternar-cupom", id: c.id, nomeIcone: "toggle-right", rotulo: `Desativar ${c.codigo}`, perigo: true })
                : botaoIcone({ acao: "alternar-cupom", id: c.id, nomeIcone: "toggle-left", rotulo: `Ativar ${c.codigo}` })}
        </div>`
    }
];

export function renderSecao({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Cupons</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-acao="novo-cupom">${icone("plus")}<span>Novo cupom</span></button>
            </div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fBusca", valor: filtros.busca, placeholder: "Pesquisar código ou descrição" })}
                ${campoSelect({ id: "fStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_CUPOM)] })}
            </div>
            <div data-tabela></div>
        </section>`);
    const linhas = () => O.cupons().filter((c) =>
        (!filtros.busca || `${c.codigo} ${c.descricao}`.toLowerCase().includes(filtros.busca.toLowerCase())) &&
        (!filtros.status || O.statusCupom(c) === filtros.status));
    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "validade", direcao: "desc" }, vazio: "Nenhum cupom corresponde aos filtros.", rotulo: "Cupons" });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());

    secao.querySelector("#fBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(linhas()); });
    secao.querySelector("#fStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(linhas()); });
    secao.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        try {
            const mudou = acao === "novo-cupom" ? await editar()
                : acao === "editar-cupom" ? await editar(id)
                    : acao === "alternar-cupom" ? await alternar(id)
                        : acao === "consultar-cupom" ? await consultar(id) : false;
            if (mudou) { tabela.atualizarLinhas(linhas()); atualizarIndicadores(); }
        } catch (falha) {
            mostrarToast(falha.message, "erro");
        }
    });
}
