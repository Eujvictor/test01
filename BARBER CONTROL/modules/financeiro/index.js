// =====================================================================
// MÓDULO 04 — FINANCEIRO (modo demonstrativo)
// Rotas: #/financeiro            → painel
//        #/financeiro/<id>       → detalhe da transação
// Valores fictícios. Nenhum gateway de pagamento está conectado;
// as taxas por método são estimativas fixas usadas só na demonstração.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import { STATUS_TRANSACAO, METODOS_PAGAMENTO, PERIODOS, PERIODICIDADES, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda, data, percentual, mesReferencia } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { baixarCsv } from "../../js/utilities/csv.js";
import { criarTabela } from "../../js/components/tabela.js";
import { graficoBarras } from "../../js/components/grafico.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, kpi, estadoVazio, listaDefinicao,
    botaoIcone, campoBusca, campoSelect, novaRaiz
} from "../../js/components/ui.js";

const filtros = { periodo: "12m", status: "", busca: "" };

const moedaCompacta = (v) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : moeda(v));

function avisoGateway() {
    return html`
        <div class="alerta alerta--info">${icone("info")}
            <span>Nenhum gateway de pagamento está conectado. Transações, taxas e despesas são fictícias; as taxas usam percentuais estimados por método (Pix 0,99% · cartão 3,99% · boleto R$ 3,49).</span>
        </div>`;
}

function kpis(r) {
    return html`
        ${kpi({ rotulo: "Receita bruta", valor: moeda(r.receitaBruta), iconeNome: "banknote", nota: "Pagamentos confirmados no período", destaque: true })}
        ${kpi({ rotulo: "Receita líquida estimada", valor: moeda(r.receitaLiquida), iconeNome: "wallet", nota: `Bruta − taxas estimadas (${moeda(r.taxas)})` })}
        ${kpi({ rotulo: "MRR", valor: moeda(r.mrr), iconeNome: "trending-up", nota: "Assinaturas ativas hoje" })}
        ${kpi({ rotulo: "ARR", valor: moeda(r.arr), iconeNome: "calendar-range", nota: "MRR × 12" })}
        ${kpi({ rotulo: "Pagamentos recebidos", valor: numero(r.recebidos.quantidade), iconeNome: "circle-check", nota: moeda(r.recebidos.valor) })}
        ${kpi({ rotulo: "Pagamentos pendentes", valor: moeda(r.pendentes.valor), iconeNome: "hourglass", nota: `${numero(r.pendentes.quantidade)} cobranças pendentes ou atrasadas` })}
        ${kpi({ rotulo: "Inadimplência", valor: percentual(r.inadimplencia), iconeNome: "triangle-alert", nota: "Atrasado ÷ total cobrado no período" })}
        ${kpi({ rotulo: "Ticket médio", valor: moeda(r.ticketMedio), iconeNome: "receipt", nota: "Por pagamento recebido" })}
        ${kpi({ rotulo: "Despesas", valor: moeda(r.despesas), iconeNome: "trending-down", nota: "Operacionais no período" })}`;
}

const COLUNAS = [
    { chave: "vencimento", rotulo: "Vencimento", render: (t) => html`<a class="link-forte" href="#/financeiro/${t.id}">${data(t.vencimento)}</a>` },
    {
        chave: "barbearia", rotulo: "Barbearia", valor: (t) => S.barbearia(t.barbeariaId)?.nome ?? "",
        render: (t) => html`${S.barbearia(t.barbeariaId)?.nome ?? "—"}<span class="celula-sub">${t.descricao}</span>`
    },
    { chave: "metodo", rotulo: "Método", valor: (t) => METODOS_PAGAMENTO[t.metodo].rotulo, render: (t) => METODOS_PAGAMENTO[t.metodo].rotulo },
    { chave: "valorBruto", rotulo: "Valor", classe: "col-num", render: (t) => moeda(t.valorBruto) },
    { chave: "taxa", rotulo: "Taxa est.", classe: "col-num", render: (t) => moeda(t.taxa) },
    { chave: "status", rotulo: "Status", valor: (t) => STATUS_TRANSACAO[t.status].rotulo, render: (t) => badgeStatus(STATUS_TRANSACAO, t.status) },
    {
        chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes",
        render: (t) => botaoIcone({ acao: "ver", id: t.id, nomeIcone: "eye", rotulo: `Ver transação ${t.id}` })
    }
];

const COLUNAS_CSV = [
    { rotulo: "ID", valor: (t) => t.id },
    { rotulo: "Vencimento", valor: (t) => data(t.vencimento) },
    { rotulo: "Pago em", valor: (t) => (t.pagoEm ? data(t.pagoEm) : "") },
    { rotulo: "Barbearia", valor: (t) => S.barbearia(t.barbeariaId)?.nome ?? "" },
    { rotulo: "Descrição", valor: (t) => t.descricao },
    { rotulo: "Método", valor: (t) => METODOS_PAGAMENTO[t.metodo].rotulo },
    { rotulo: "Valor bruto", valor: (t) => t.valorBruto },
    { rotulo: "Taxa estimada", valor: (t) => t.taxa },
    { rotulo: "Valor líquido", valor: (t) => t.valorLiquido },
    { rotulo: "Status", valor: (t) => STATUS_TRANSACAO[t.status].rotulo },
    { rotulo: "Observação", valor: () => "DADOS DEMONSTRATIVOS" }
];

function graficos() {
    const meses = S.mesesDoPeriodo(filtros.periodo);
    const pagas = S.filtrarTransacoes({ periodo: filtros.periodo, busca: filtros.busca }).filter((t) => t.status === "pago");
    const receitas = S.serieMensal(meses, pagas, "vencimento", "valorBruto");
    const despesas = S.serieMensal(meses, S.despesasDoPeriodo(filtros.periodo), "data", "valor");
    const paraGrafico = (serie) => serie.map((s) => ({ rotulo: mesReferencia(s.mes), rotuloLongo: mesReferencia(s.mes, true), valor: s.valor }));
    const bloco = (titulo, nota, serie, tom) => html`
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">${titulo}</h2><span class="texto-terc">${nota}</span></div>
            <div class="card__corpo">
                ${serie.some((s) => s.valor > 0)
                    ? graficoBarras({ dados: paraGrafico(serie), formatar: moeda, formatarEixo: moedaCompacta, tom, titulo })
                    : estadoVazio({ iconeNome: "chart-column", titulo: "Sem valores no período" })}
            </div>
        </section>`;
    return html`
        ${bloco("Receita por mês", filtros.busca ? "Pagamentos confirmados · barbearia filtrada" : "Pagamentos confirmados", receitas, "ouro")}
        ${bloco("Despesas por mês", "Custos operacionais da plataforma", despesas, "neutro")}`;
}

function renderPainel(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Financeiro",
            subtitulo: "Receitas, cobranças e despesas da plataforma",
            acoes: html`<button class="btn" type="button" data-acao="exportar">${icone("download")}<span>Exportar CSV</span></button>`
        })}
        ${avisoDemo()}
        ${avisoGateway()}
        <div class="barra-filtros barra-filtros--solta">
            ${campoSelect({ id: "filtroPeriodo", rotulo: "Período", valor: filtros.periodo, opcoes: opcoes(PERIODOS) })}
            ${campoSelect({ id: "filtroStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_TRANSACAO)] })}
            ${campoBusca({ id: "filtroBusca", valor: filtros.busca, placeholder: "Pesquisar barbearia" })}
            <button class="btn btn--fantasma" type="button" data-acao="limpar-filtros">${icone("filter-x")}<span>Limpar</span></button>
        </div>
        <section class="grade grade--kpi grade--kpi-3 secao" data-kpis></section>
        <div class="grade grade--2 grade--2-igual secao" data-graficos></div>
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Histórico de pagamentos e transações</h2>
                <span class="badge" data-contagem></span>
            </div>
            <div data-tabela></div>
        </section>`);

    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "vencimento", direcao: "desc" }, vazio: "Nenhuma transação no período e filtros selecionados.", rotulo: "Transações" });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);

    const transacoesFiltradas = () => S.filtrarTransacoes(filtros);

    function atualizar() {
        const lista = transacoesFiltradas();
        // Indicadores de status (recebido/pendente/inadimplência) consideram todos os status do período.
        const base = S.filtrarTransacoes({ periodo: filtros.periodo, busca: filtros.busca });
        renderizar(raiz.querySelector("[data-kpis]"), kpis(S.resumoFinanceiro(base, S.despesasDoPeriodo(filtros.periodo))));
        renderizar(raiz.querySelector("[data-graficos]"), graficos());
        raiz.querySelector("[data-contagem]").textContent = `${numero(lista.length)} registros`;
        tabela.definirLinhas(lista);
    }
    atualizar();

    let espera;
    raiz.querySelector("#filtroBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { filtros.busca = e.target.value; atualizar(); }, 150);
    });
    raiz.querySelector("#filtroPeriodo").addEventListener("change", (e) => { filtros.periodo = e.target.value; atualizar(); });
    raiz.querySelector("#filtroStatus").addEventListener("change", (e) => { filtros.status = e.target.value; atualizar(); });

    raiz.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderPainel(view));
        if (acao === "limpar-filtros") {
            Object.assign(filtros, { periodo: "12m", status: "", busca: "" });
            return renderPainel(view);
        }
        if (acao === "ver") window.location.hash = `#/financeiro/${id}`;
        if (acao === "exportar") {
            const lista = transacoesFiltradas().sort((a, b) => b.vencimento.localeCompare(a.vencimento));
            if (!lista.length) return mostrarToast("Nada para exportar com os filtros atuais.", "atencao");
            const hoje = new Date().toISOString().slice(0, 10);
            baixarCsv(`barber-control-transacoes-DEMO-${hoje}.csv`, COLUNAS_CSV, lista);
            mostrarToast(`${numero(lista.length)} transações exportadas (dados demonstrativos).`, "sucesso");
        }
    });
}

function renderTransacao(view, id) {
    const raiz = novaRaiz(view);
    const t = S.transacao(id);
    if (!t) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Transação não encontrada", voltar: { href: "#/financeiro", rotulo: "Financeiro" } })}
            <section class="card">${estadoVazio({ iconeNome: "receipt", titulo: "Registro inexistente", texto: "Pode ter sido removido ao restaurar os dados demonstrativos." })}</section>`);
        return;
    }
    const b = S.barbearia(t.barbeariaId);
    const a = S.assinatura(t.assinaturaId);
    const p = S.plano(t.planoId);
    const metodo = METODOS_PAGAMENTO[t.metodo];
    const regraTaxa = metodo.taxaFixa ? `${moeda(metodo.taxaFixa)} por boleto` : `${percentual(metodo.taxaPercentual, 2)} do valor`;

    renderizar(raiz, html`
        ${cabecalho({
            titulo: `Transação ${t.id}`,
            voltar: { href: "#/financeiro", rotulo: "Financeiro" },
            extra: badgeStatus(STATUS_TRANSACAO, t.status),
            subtitulo: `${b?.nome ?? "—"} · ${t.descricao}`,
            acoes: html`
                ${b ? html`<a class="btn" href="#/barbearias/${b.id}">${icone("store")}<span>Ver barbearia</span></a>` : ""}
                ${a ? html`<a class="btn" href="#/assinaturas/${a.id}">${icone("badge-check")}<span>Ver assinatura</span></a>` : ""}`
        })}
        ${avisoGateway()}
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Valores</h2></div>
                <div class="card__corpo">
                    ${listaDefinicao([
                        ["Valor bruto", moeda(t.valorBruto)],
                        ["Taxa estimada", `${moeda(t.taxa)} (${regraTaxa})`],
                        ["Valor líquido estimado", moeda(t.valorLiquido)],
                        ["Método", metodo.rotulo],
                        ["Status", badgeStatus(STATUS_TRANSACAO, t.status)]
                    ])}
                </div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Referência</h2></div>
                <div class="card__corpo">
                    ${listaDefinicao([
                        ["Barbearia", b ? html`<a class="link-forte" href="#/barbearias/${b.id}">${b.nome}</a>` : "—"],
                        ["Plano", p?.nome],
                        ["Periodicidade", a ? PERIODICIDADES[a.periodicidade].rotulo : "—"],
                        ["Competência", mesReferencia(t.vencimento.slice(0, 7), true)],
                        ["Vencimento", data(t.vencimento)],
                        ["Pago em", t.pagoEm ? data(t.pagoEm) : "—"],
                        ["Identificador", t.id]
                    ])}
                </div>
            </section>
        </div>`);
}

export function render(view, { parametros = [] }) {
    if (parametros[0]) renderTransacao(view, parametros[0]);
    else renderPainel(view);
}
