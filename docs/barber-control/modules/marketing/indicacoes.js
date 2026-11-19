// =====================================================================
// PROGRAMA DE INDICAÇÃO — indicadoras são barbearias cadastradas.
// A indicada vira vínculo com uma barbearia existente ao converter
// (sem criar empresas duplicadas). Recompensas são só registros.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import * as O from "../../services/demo/operacao.js";
import { STATUS_INDICACAO, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, data } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { abrirPainel } from "../../js/components/painel.js";
import { badgeStatus, kpi, listaDefinicao, linhaDoTempo, botaoIcone, campoSelect } from "../../js/components/ui.js";
import { barrasHorizontais } from "../../js/components/grafico.js";

const filtros = { status: "" };

async function registrar() {
    const indicadoras = S.barbearias().filter((b) => b.status === "ativa").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const nova = await abrirFormulario({
        titulo: "Registrar indicação",
        descricao: "Registro demonstrativo; a barbearia indicada não é contatada.",
        campos: [
            { nome: "indicadoraId", rotulo: "Barbearia indicadora", tipo: "select", obrigatorio: true, placeholderOpcao: "Selecione", opcoes: indicadoras.map((b) => [b.id, `${b.nome} · ${O.codigoIndicacao(b)}`]) },
            { nome: "indicadaNome", rotulo: "Nome da barbearia indicada", tipo: "texto", obrigatorio: true, maxlength: 80, largura: "meia" },
            { nome: "contato", rotulo: "E-mail de contato", tipo: "email", obrigatorio: true, maxlength: 120, largura: "meia" },
            { nome: "recompensa", rotulo: "Recompensa prevista", tipo: "texto", obrigatorio: true, maxlength: 80 }
        ],
        valores: { recompensa: "1 mensalidade grátis" },
        textoSalvar: "Registrar",
        aoSalvar: (v) => O.registrarIndicacao(v)
    });
    if (nova) mostrarToast(`Indicação de ${nova.indicadaNome} registrada.`, "sucesso");
    return Boolean(nova);
}

async function converter(id) {
    const i = O.indicacao(id);
    const disponiveis = O.barbeariasDisponiveisParaConversao(id).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const ok = await abrirFormulario({
        titulo: "Registrar conversão",
        descricao: `Vincule "${i.indicadaNome}" à barbearia já cadastrada em Barbearias. Se ainda não existir, cadastre-a primeiro no módulo Barbearias.`,
        campos: [{ nome: "barbeariaId", rotulo: "Barbearia cadastrada", tipo: "select", obrigatorio: true, placeholderOpcao: "Selecione", opcoes: disponiveis.map((b) => [b.id, b.nome]) }],
        textoSalvar: "Vincular",
        aoSalvar: (v) => O.converterIndicacao(id, v.barbeariaId)
    });
    if (ok) mostrarToast("Conversão registrada.", "sucesso");
    return Boolean(ok);
}

async function recompensa(id) {
    const i = O.indicacao(id);
    if (!(await confirmar({ titulo: "Registrar recompensa concedida?", mensagem: `"${i.recompensa}" para ${S.barbearia(i.indicadoraId)?.nome}. Nenhum crédito real é aplicado (demonstração).`, textoConfirmar: "Registrar" }))) return false;
    O.concederRecompensa(id);
    mostrarToast("Recompensa registrada.", "sucesso");
    return true;
}

async function expirar(id) {
    if (!(await confirmar({ titulo: "Marcar indicação como expirada?", mensagem: "Ela deixa de contar como pendente.", textoConfirmar: "Expirar", perigo: true }))) return false;
    O.expirarIndicacao(id);
    mostrarToast("Indicação expirada.", "sucesso");
    return true;
}

async function historico(id) {
    const i = O.indicacao(id);
    await abrirPainel({
        titulo: `Indicação · ${i.indicadaNome}`,
        conteudo: html`
            ${listaDefinicao([
                ["Indicadora", S.barbearia(i.indicadoraId)?.nome], ["Código", i.codigo], ["Contato", i.contato],
                ["Status", badgeStatus(STATUS_INDICACAO, i.status)], ["Recompensa", `${i.recompensa} · ${i.recompensaStatus === "concedida" ? "concedida" : "pendente"}`]
            ])}
            <h4 class="secao__titulo secao__titulo--espaco previa-alcance">Histórico</h4>
            ${linhaDoTempo(O.historicoDe("indicacao", id))}`
    });
    return false;
}

const COLUNAS = [
    { chave: "indicadora", rotulo: "Indicadora", valor: (i) => S.barbearia(i.indicadoraId)?.nome ?? "", render: (i) => html`<a class="link-forte" href="#/barbearias/${i.indicadoraId}">${S.barbearia(i.indicadoraId)?.nome ?? "—"}</a><span class="celula-sub num">${i.codigo}</span>` },
    { chave: "indicadaNome", rotulo: "Indicada", render: (i) => (i.indicadaId ? html`<a class="link-forte" href="#/barbearias/${i.indicadaId}">${i.indicadaNome}</a><span class="celula-sub">cadastrada</span>` : html`${i.indicadaNome}<span class="celula-sub">${i.contato}</span>`) },
    { chave: "data", rotulo: "Data", render: (i) => data(i.data) },
    { chave: "status", rotulo: "Status", valor: (i) => i.status, render: (i) => badgeStatus(STATUS_INDICACAO, i.status) },
    { chave: "recompensa", rotulo: "Recompensa", valor: (i) => i.recompensaStatus, render: (i) => html`${i.recompensa}<span class="celula-sub">${i.recompensaStatus === "concedida" ? "Concedida (demonstrativo)" : "Pendente"}</span>` },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (i) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "historico-indicacao", id: i.id, nomeIcone: "history", rotulo: "Histórico" })}
            ${!i.indicadaId && i.status === "pendente" ? botaoIcone({ acao: "converter-indicacao", id: i.id, nomeIcone: "link", rotulo: "Registrar conversão" }) : ""}
            ${i.status === "convertida" && i.recompensaStatus !== "concedida" ? botaoIcone({ acao: "recompensa-indicacao", id: i.id, nomeIcone: "gift", rotulo: "Conceder recompensa" }) : ""}
            ${i.status === "pendente" ? botaoIcone({ acao: "expirar-indicacao", id: i.id, nomeIcone: "timer-off", rotulo: "Expirar", perigo: true }) : ""}
        </div>`
    }
];

function resumo() {
    const lista = O.indicacoes();
    const contar = (st) => lista.filter((i) => i.status === st).length;
    return html`
        ${kpi({ rotulo: "Empresas indicadoras", valor: numero(new Set(lista.map((i) => i.indicadoraId)).size), iconeNome: "store", nota: "Barbearias que indicaram" })}
        ${kpi({ rotulo: "Indicações", valor: numero(lista.length), iconeNome: "share-2", nota: `${contar("pendente")} pendentes` })}
        ${kpi({ rotulo: "Convertidas", valor: numero(contar("convertida")), iconeNome: "circle-check", nota: `${contar("em_teste")} em período de teste` })}
        ${kpi({ rotulo: "Recompensas concedidas", valor: numero(lista.filter((i) => i.recompensaStatus === "concedida").length), iconeNome: "gift", nota: "Demonstrativas" })}`;
}

export function renderSecao({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        <section class="grade grade--kpi secao" data-resumo>${resumo()}</section>
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho">
                    <h2 class="card__titulo">Indicações</h2>
                    <button class="btn btn--primario btn--pequeno" type="button" data-acao="nova-indicacao">${icone("plus")}<span>Registrar indicação</span></button>
                </div>
                <div class="barra-filtros">${campoSelect({ id: "fStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_INDICACAO)] })}</div>
                <div data-tabela></div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Principais indicadoras</h2></div>
                <div class="card__corpo" data-ranking></div>
            </section>
        </div>`);
    const linhas = () => O.indicacoes().filter((i) => !filtros.status || i.status === filtros.status);
    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "data", direcao: "desc" }, vazio: "Nenhuma indicação.", rotulo: "Indicações" });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);

    function atualizar(mudou = false) {
        const contagem = new Map();
        O.indicacoes().forEach((i) => contagem.set(i.indicadoraId, (contagem.get(i.indicadoraId) ?? 0) + 1));
        const itens = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
            .map(([id, total]) => ({ rotulo: S.barbearia(id)?.nome ?? id, valor: total, link: `#/barbearias/${id}` }));
        renderizar(secao.querySelector("[data-ranking]"), barrasHorizontais({ itens, formatar: (v) => `${v} indicaç${v === 1 ? "ão" : "ões"}`, titulo: "Principais indicadoras" }));
        renderizar(secao.querySelector("[data-resumo]"), resumo());
        if (mudou) tabela.atualizarLinhas(linhas()); else tabela.definirLinhas(linhas());
    }
    atualizar();

    secao.querySelector("#fStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(linhas()); });
    secao.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        const mapa = {
            "nova-indicacao": () => registrar(), "converter-indicacao": () => converter(id), "recompensa-indicacao": () => recompensa(id),
            "expirar-indicacao": () => expirar(id), "historico-indicacao": () => historico(id)
        };
        if (!mapa[acao]) return;
        try {
            if (await mapa[acao]()) { atualizar(true); atualizarIndicadores(); }
        } catch (falha) {
            mostrarToast(falha.message, "erro");
        }
    });
}
