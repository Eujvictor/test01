// =====================================================================
// MÓDULO 17 — RELATÓRIOS E MÉTRICAS (modo demonstrativo)
// Rotas: #/relatorios           → painel de indicadores + catálogo
//        #/relatorios/<id>      → relatório detalhado (filtros, comparação,
//                                 gráfico, tabela, origem e exportação)
// Todos os números vêm de services/demo/indicadores.js, calculados a partir
// dos registros dos módulos 02–16. Exportações usam os dados exibidos.
// =====================================================================
import * as K from "../../services/demo/indicadores.js";
import * as S from "../../services/demo/saas.js";
import { STATUS_BARBEARIA, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar, bruto } from "../../js/utilities/dom.js";
import { numero, moeda, mesReferencia } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { exportarRelatorio, formatarValor, FORMATOS_EXPORTACAO } from "../../js/utilities/exportar.js";
import { criarTabela } from "../../js/components/tabela.js";
import { graficoBarras, graficoLinha, graficoComparativo, barrasHorizontais } from "../../js/components/grafico.js";
import { cabecalho, avisoDemo, tratarRestauracaoDemo, kpi, estadoVazio, campoSelect, novaRaiz } from "../../js/components/ui.js";
import { RELATORIOS, CATEGORIAS, relatorio } from "./definicoes.js";

// Filtros compartilhados entre o painel e os relatórios (mantidos durante a sessão).
const filtros = { periodo: "12m", barbeariaId: "", planoId: "", status: "", categoria: "", tipo: "", serie: "", comparar: true };
const PADRAO = { periodo: "12m", barbeariaId: "", planoId: "", status: "", categoria: "", tipo: "", serie: "", comparar: true };

export const TIPOS_INDICADOR = { volume: "Volume", financeiro: "Financeiro", taxa: "Taxas e percentuais" };

const moedaCompacta = (v) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : moeda(v));
const eixoDe = (formato) => (formato === "moeda" ? moedaCompacta : formato === "percentual" ? (v) => `${Math.round(v * 100)}%` : (v) => numero(Math.round(v)));
const escopo = () => ({ barbeariaId: filtros.barbeariaId, planoId: filtros.planoId, status: filtros.status });

// ---------------------------------------------------------------------
// Peças compartilhadas
// ---------------------------------------------------------------------
function variacaoHtml(atual, anterior, melhor = "alta") {
    if (anterior === undefined) return "";
    const v = K.variacao(atual, anterior);
    if (v === null) return html`<span class="variacao">sem base de comparação</span>`;
    const pct = Math.round(v * 1000) / 10;
    const bom = melhor === "baixa" ? pct < 0 : pct > 0;
    const classe = pct === 0 ? "" : bom ? "variacao--alta" : "variacao--baixa";
    return html`<span class="variacao ${classe}" title="Período anterior: ${anterior === null ? "sem dados" : ""}">${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR")}% vs período anterior</span>`;
}

function cartaoKpi(k, destaque = false) {
    const nota = html`${k.anterior !== undefined ? html`${variacaoHtml(k.atual, k.anterior, k.melhor)}<span class="kpi__anterior">Anterior: ${formatarValor(k.anterior, k.formato)}</span>` : ""}${k.nota ? html`<span>${k.nota}</span>` : ""}`;
    return kpi({ rotulo: k.rotulo, valor: formatarValor(k.atual, k.formato), iconeNome: k.icone ?? "chart-no-axes-column", nota, destaque });
}

function filtrosHtml({ mostrarCategoria = false, mostrarTipo = false, semPeriodo = false, series = [] } = {}) {
    const barbearias = S.barbearias().slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return html`
        <div class="barra-filtros barra-filtros--solta" role="search" aria-label="Filtros dos relatórios">
            ${campoSelect({ id: "fPeriodo", rotulo: "Período", valor: filtros.periodo, opcoes: opcoes(K.PERIODOS_RELATORIO) })}
            ${campoSelect({ id: "fBarbearia", rotulo: "Barbearia", valor: filtros.barbeariaId, opcoes: [["", "Todas as barbearias"], ...barbearias.map((b) => [b.id, b.nome])] })}
            ${campoSelect({ id: "fPlano", rotulo: "Plano", valor: filtros.planoId, opcoes: [["", "Todos os planos"], ...S.planos().map((p) => [p.id, p.nome])] })}
            ${campoSelect({ id: "fStatus", rotulo: "Status atual", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_BARBEARIA)] })}
            ${mostrarCategoria ? campoSelect({ id: "fCategoria", rotulo: "Categoria de relatório", valor: filtros.categoria, opcoes: [["", "Todas as categorias"], ...Object.entries(CATEGORIAS).map(([k, v]) => [k, v.rotulo])] }) : ""}
            ${mostrarTipo ? campoSelect({ id: "fTipo", rotulo: "Tipo de indicador", valor: filtros.tipo, opcoes: [["", "Todos os indicadores"], ...Object.entries(TIPOS_INDICADOR)] }) : ""}
            ${series.length > 1 ? campoSelect({ id: "fSerie", rotulo: "Indicador do gráfico", valor: filtros.serie, opcoes: series.map((s) => [s.id, s.rotulo]) }) : ""}
            ${series.length ? html`<label class="filtro filtro--marcar"><input type="checkbox" id="fComparar" ${filtros.comparar ? bruto("checked") : ""}><span>Comparar com o período anterior</span></label>` : ""}
            <button class="btn btn--fantasma" type="button" data-acao="limpar">${icone("filter-x")}<span>Limpar</span></button>
        </div>
        ${semPeriodo ? html`<p class="nota-periodo">${icone("info")}Relatório de situação atual: o período não altera os números.</p>` : ""}`;
}

function ligarFiltros(raiz, redesenhar, { semPeriodo = false } = {}) {
    const periodo = raiz.querySelector("#fPeriodo");
    if (semPeriodo && periodo) {
        periodo.disabled = true;
        periodo.title = "Relatório de situação atual: o período não se aplica.";
    }
    const mapa = { fPeriodo: "periodo", fBarbearia: "barbeariaId", fPlano: "planoId", fStatus: "status", fCategoria: "categoria", fTipo: "tipo", fSerie: "serie" };
    Object.entries(mapa).forEach(([id, campo]) => {
        raiz.querySelector(`#${id}`)?.addEventListener("change", (e) => { filtros[campo] = e.target.value; redesenhar(); });
    });
    raiz.querySelector("#fComparar")?.addEventListener("change", (e) => { filtros.comparar = e.target.checked; redesenhar(); });
}

function contexto(meses, semPeriodo) {
    const anteriores = K.mesesAnteriores(meses);
    return html`
        <p class="contexto-relatorio">
            ${icone("calendar-range")}
            ${semPeriodo ? html`<span>Situação atual</span>` : html`<span><strong>Período:</strong> ${K.descreverMeses(meses)}</span>
            <span><strong>Comparado a:</strong> ${K.descreverMeses(anteriores)}</span>`}
            <span><strong>Escopo:</strong> ${K.descreverEscopo(escopo())}</span>
        </p>`;
}

const paraGrafico = (dados) => dados.map((d) => ({ rotulo: mesReferencia(d.mes), rotuloLongo: mesReferencia(d.mes, true), valor: d.valor }));

function grafico(serie, { comparar = false, largo = false } = {}) {
    const validos = serie.dados.filter((d) => d.valor !== null && d.valor !== undefined);
    if (!validos.length) return estadoVazio({ iconeNome: "chart-column", titulo: "Sem dados no período", texto: "Não há registros para este indicador com os filtros selecionados." });
    const formatar = (v) => formatarValor(v, serie.formato);
    if (comparar && serie.anterior) {
        const dados = serie.dados.map((d, i) => ({
            rotulo: mesReferencia(d.mes), rotuloLongo: mesReferencia(d.mes, true), atual: d.valor,
            anterior: serie.anterior[i]?.valor ?? null, rotuloAnterior: serie.anterior[i] ? mesReferencia(serie.anterior[i].mes, true) : "Período anterior"
        }));
        return graficoComparativo({ dados, formatar, formatarEixo: eixoDe(serie.formato), titulo: serie.rotulo });
    }
    if (serie.tipo === "linha") {
        if (validos.length < 2) return estadoVazio({ iconeNome: "chart-line", titulo: "Pontos insuficientes", texto: "É preciso pelo menos 2 meses com dados para traçar a linha." });
        return graficoLinha({ dados: paraGrafico(validos), formatar, formatarEixo: eixoDe(serie.formato), titulo: serie.rotulo, tom: serie.tom ?? "ouro", largo });
    }
    return graficoBarras({ dados: paraGrafico(serie.dados.map((d) => ({ mes: d.mes, valor: d.valor ?? 0 }))), formatar, formatarEixo: eixoDe(serie.formato), titulo: serie.rotulo, tom: serie.tom ?? "ouro", largo });
}

// ---------------------------------------------------------------------
// Painel de indicadores
// ---------------------------------------------------------------------
function indicadoresDoPainel() {
    const p = K.painelIndicadores(filtros.periodo, escopo());
    const { atual, anterior } = p;
    const serieAtual = K.serieEmpresas(atual.meses, escopo());
    const serieAnterior = K.serieEmpresas(anterior.meses, escopo());
    const crescMedio = (serie) => {
        const v = serie.filter((x) => x.baseInicio).map((x) => (x.base - x.baseInicio) / x.baseInicio);
        return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    };
    const lider = p.distribuicao[0];
    return [
        { id: "total", tipo: "volume", rotulo: "Total de barbearias", atual: p.totalBarbearias, formato: "numero", icone: "store", nota: `${numero(p.emTeste)} em teste · situação atual`, destaque: true },
        { id: "ativas", tipo: "volume", rotulo: "Barbearias ativas", atual: p.ativas, formato: "numero", icone: "circle-check", nota: "Status atual" },
        { id: "novas", tipo: "volume", rotulo: "Novas barbearias", atual: atual.novas, anterior: anterior.novas, formato: "numero", melhor: "alta", icone: "store" },
        { id: "crescimento", tipo: "taxa", rotulo: "Crescimento mensal médio", atual: crescMedio(serieAtual), anterior: crescMedio(serieAnterior), formato: "percentual", melhor: "alta", icone: "trending-up" },
        { id: "usuarios", tipo: "volume", rotulo: "Total de usuários", atual: p.totalUsuarios, formato: "numero", icone: "users", nota: `+${numero(atual.usuariosNovos)} no período` },
        { id: "agendamentos", tipo: "volume", rotulo: "Total de agendamentos", atual: atual.agendamentos, anterior: anterior.agendamentos, formato: "numero", melhor: "alta", icone: "calendar-check", nota: atual.agendamentosCompletos ? "" : "Registros só desde " + mesReferencia(K.inicioDosAgendamentos()?.slice(0, 7) ?? K.chaveMes(new Date()), true) },
        { id: "receita", tipo: "financeiro", rotulo: "Receita demonstrativa", atual: atual.receita, anterior: anterior.receita, formato: "moeda", melhor: "alta", icone: "banknote" },
        { id: "mrr", tipo: "financeiro", rotulo: "MRR", atual: p.mrr, formato: "moeda", icone: "repeat", nota: "Assinaturas ativas hoje" },
        { id: "arr", tipo: "financeiro", rotulo: "ARR", atual: p.arr, formato: "moeda", icone: "calendar-range", nota: "MRR × 12" },
        { id: "cancelamentos", tipo: "volume", rotulo: "Cancelamentos", atual: atual.cancelamentos, anterior: anterior.cancelamentos, formato: "numero", melhor: "baixa", icone: "user-x" },
        { id: "retencao", tipo: "taxa", rotulo: "Retenção", atual: atual.retencao, anterior: anterior.retencao, formato: "percentual", melhor: "alta", icone: "shield-check" },
        { id: "churn", tipo: "taxa", rotulo: "Churn", atual: atual.churn, anterior: anterior.churn, formato: "percentual", melhor: "baixa", icone: "trending-down" },
        { id: "plano", tipo: "volume", rotulo: "Plano com mais empresas", atual: lider ? `${lider.rotulo}` : null, formato: "texto", icone: "badge-check", nota: lider ? `${numero(lider.valor)} empresas (${formatarValor(lider.participacao, "percentual")})` : "" }
    ];
}

function cartaoGrafico({ titulo, nota = "", corpo, link = "" }) {
    return html`
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">${titulo}</h2>
                ${link ? html`<a class="link-forte texto-pequeno" href="${link}">Ver relatório</a>` : html`<span class="texto-terc">${nota}</span>`}
            </div>
            <div class="card__corpo">${corpo}${link && nota ? html`<p class="texto-terc texto-pequeno">${nota}</p>` : ""}</div>
        </section>`;
}

function graficosDoPainel() {
    const meses = K.mesesDoPeriodo(filtros.periodo);
    const esc = escopo();
    const empresas = K.serieEmpresas(meses, esc);
    const receita = K.serieReceita(meses, esc);
    const mrr = K.serieMrr(meses, esc);
    const ag = K.serieAgendamentos(meses, esc).filter((x) => x.empresasAtivas !== null);
    const dist = K.distribuicaoPlanos(esc);
    const acesso = K.acessoFuncionalidades(esc).slice(0, 8);
    const linha = (dados, rotulo, formato, tom) => {
        const v = dados.filter((d) => d.valor !== null);
        return v.length >= 2
            ? graficoLinha({ dados: paraGrafico(v), formatar: (x) => formatarValor(x, formato), formatarEixo: eixoDe(formato), titulo: rotulo, tom })
            : estadoVazio({ iconeNome: "chart-line", titulo: "Pontos insuficientes no período" });
    };
    return html`
        ${cartaoGrafico({ titulo: "Crescimento de barbearias", link: "#/relatorios/base-barbearias", nota: "Base no fim de cada mês",
            corpo: graficoBarras({ dados: paraGrafico(empresas.map((e) => ({ mes: e.mes, valor: e.base }))), formatar: numero, titulo: "Base de barbearias por mês" }) })}
        ${cartaoGrafico({ titulo: "Receita por mês", link: "#/relatorios/receita", nota: "Pagamentos confirmados (demonstrativos)",
            corpo: graficoBarras({ dados: paraGrafico(receita.map((r) => ({ mes: r.mes, valor: r.bruta }))), formatar: moeda, formatarEixo: moedaCompacta, titulo: "Receita por mês" }) })}
        ${cartaoGrafico({ titulo: "Distribuição de planos", link: "#/relatorios/assinaturas", nota: "Barbearias não canceladas",
            corpo: dist.length ? barrasHorizontais({ itens: dist.map((d) => ({ rotulo: d.rotulo, valor: d.valor })), formatar: (v) => `${numero(v)} empresas`, titulo: "Distribuição por plano" }) : estadoVazio({ titulo: "Nenhuma barbearia no escopo" }) })}
        ${cartaoGrafico({ titulo: "Evolução de assinaturas", link: "#/relatorios/assinaturas", nota: "Assinaturas pagantes no fim de cada mês",
            corpo: linha(mrr.map((m) => ({ mes: m.mes, valor: m.pagantes })), "Assinaturas pagantes", "numero", "ouro") })}
        ${cartaoGrafico({ titulo: "Taxa de cancelamento", link: "#/relatorios/retencao", nota: "Churn mensal sobre a base do início do mês",
            corpo: linha(empresas.map((e) => ({ mes: e.mes, valor: e.churn })), "Churn mensal", "percentual", "erro") })}
        ${cartaoGrafico({ titulo: "Retenção", link: "#/relatorios/retencao", nota: "Retenção mensal (1 − churn)",
            corpo: linha(empresas.map((e) => ({ mes: e.mes, valor: e.churn === null ? null : 1 - e.churn })), "Retenção mensal", "percentual", "ouro") })}
        ${cartaoGrafico({ titulo: "Atividade das empresas", link: "#/relatorios/atividade", nota: ag.length ? "Empresas com ao menos 1 agendamento no mês" : "",
            corpo: ag.length ? graficoBarras({ dados: paraGrafico(ag.map((a) => ({ mes: a.mes, valor: a.empresasAtivas }))), formatar: (v) => `${numero(v)} empresas`, formatarEixo: numero, titulo: "Empresas com atividade" }) : estadoVazio({ iconeNome: "calendar-x", titulo: "Sem registros de agendamento no período" }) })}
        ${cartaoGrafico({ titulo: "Utilização dos módulos", link: "#/relatorios/utilizacao", nota: "Empresas com acesso liberado (direito de uso, não uso medido)",
            corpo: acesso.length ? barrasHorizontais({ itens: acesso.map((a) => ({ rotulo: a.rotulo, valor: a.valor })), formatar: (v) => `${numero(v)} empresas`, titulo: "Acesso por funcionalidade" }) : estadoVazio({ titulo: "Nenhuma empresa ativa no escopo" }) })}`;
}

function catalogo() {
    const lista = RELATORIOS.filter((r) => !filtros.categoria || r.categoria === filtros.categoria);
    if (!lista.length) return estadoVazio({ titulo: "Nenhum relatório nesta categoria" });
    return html`
        <div class="relatorios-catalogo">
            ${lista.map((r) => html`
                <article class="relatorio-card">
                    <div class="relatorio-card__topo">
                        <span class="relatorio-card__icone">${icone(CATEGORIAS[r.categoria].icone)}</span>
                        <span class="badge">${CATEGORIAS[r.categoria].rotulo}</span>
                    </div>
                    <h3>${r.titulo}</h3>
                    <p>${r.descricao}</p>
                    <p class="relatorio-card__origem">${icone("database")}${r.origem.length} ${r.origem.length === 1 ? "fonte de dados" : "fontes de dados"}</p>
                    <a class="btn btn--primario btn--pequeno" href="#/relatorios/${r.id}" data-relatorio="${r.id}">${icone("file-chart-column")}<span>Gerar relatório</span></a>
                </article>`)}
        </div>`;
}

function botoesExportacao(prefixo = "exportar") {
    return html`${Object.entries(FORMATOS_EXPORTACAO).map(([f, r]) => html`
        <button class="btn" type="button" data-acao="${prefixo}" data-formato="${f}">${icone(f === "pdf" ? "file-text" : f === "xlsx" ? "file-spreadsheet" : "file-down")}<span>${r}</span></button>`)}`;
}

function renderPainel(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Relatórios e métricas", subtitulo: "Indicadores da plataforma calculados a partir dos módulos 02–16", acoes: botoesExportacao("exportar-painel") })}
        ${avisoDemo()}
        ${filtrosHtml({ mostrarCategoria: true, mostrarTipo: true })}
        <div data-contexto></div>
        <section class="grade grade--kpi secao" data-kpis aria-live="polite"></section>
        <div class="grade grade--2 grade--2-igual secao" data-graficos></div>
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Relatórios disponíveis</h2><span class="texto-terc" data-total-relatorios></span></div>
            <div class="card__corpo" data-catalogo></div>
        </section>`);

    let indicadores = [];
    function desenhar() {
        indicadores = indicadoresDoPainel();
        const visiveis = indicadores.filter((k) => !filtros.tipo || k.tipo === filtros.tipo);
        renderizar(raiz.querySelector("[data-contexto]"), contexto(K.mesesDoPeriodo(filtros.periodo), false));
        renderizar(raiz.querySelector("[data-kpis]"), visiveis.length ? visiveis.map((k) => cartaoKpi(k, k.destaque)) : estadoVazio({ titulo: "Nenhum indicador deste tipo" }));
        renderizar(raiz.querySelector("[data-graficos]"), graficosDoPainel());
        renderizar(raiz.querySelector("[data-catalogo]"), catalogo());
        const n = RELATORIOS.filter((r) => !filtros.categoria || r.categoria === filtros.categoria).length;
        raiz.querySelector("[data-total-relatorios]").textContent = `${n} ${n === 1 ? "relatório" : "relatórios"}`;
    }
    desenhar();
    ligarFiltros(raiz, desenhar);

    raiz.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        if (botao.dataset.acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderPainel(view));
        if (botao.dataset.acao === "limpar") { Object.assign(filtros, PADRAO); return renderPainel(view); }
        if (botao.dataset.acao === "exportar-painel") {
            const lista = indicadores.filter((k) => !filtros.tipo || k.tipo === filtros.tipo);
            const resultado = exportarRelatorio(botao.dataset.formato, {
                arquivo: "barber-control-indicadores",
                titulo: "Indicadores da plataforma",
                subtitulo: "Painel do módulo 17 · Relatórios e métricas",
                metadados: metadados(K.mesesDoPeriodo(filtros.periodo), false, [["Tipo de indicador", filtros.tipo ? TIPOS_INDICADOR[filtros.tipo] : "Todos"]]),
                colunas: [
                    { rotulo: "Indicador", valor: (k) => k.rotulo },
                    { rotulo: "Tipo", valor: (k) => TIPOS_INDICADOR[k.tipo] },
                    { rotulo: "Valor atual", valor: (k) => formatarValor(k.atual, k.formato) },
                    { rotulo: "Período anterior", valor: (k) => (k.anterior === undefined ? "Não comparável" : formatarValor(k.anterior, k.formato)) },
                    { rotulo: "Variação", valor: (k) => (k.anterior === undefined ? null : K.variacao(k.atual, k.anterior)), formato: "percentual" },
                    { rotulo: "Observação", valor: (k) => k.nota ?? "" }
                ],
                linhas: lista
            });
            mostrarToast(`${FORMATOS_EXPORTACAO[botao.dataset.formato]} gerado: ${resultado.nome}`, "sucesso");
        }
    });
}

function metadados(meses, semPeriodo, extras = []) {
    return [
        ["Período", semPeriodo ? "Situação atual" : K.descreverMeses(meses)],
        ...(semPeriodo ? [] : [["Comparado a", K.descreverMeses(K.mesesAnteriores(meses))]]),
        ["Escopo", K.descreverEscopo(escopo())],
        ...extras
    ];
}

// ---------------------------------------------------------------------
// Relatório detalhado
// ---------------------------------------------------------------------
function renderRelatorio(view, id) {
    const raiz = novaRaiz(view);
    const def = relatorio(id);
    if (!def) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Relatório não encontrado", voltar: { href: "#/relatorios", rotulo: "Relatórios" } })}
            <section class="card">${estadoVazio({ iconeNome: "file-question", titulo: "Relatório inexistente", texto: "Volte ao catálogo e escolha um relatório disponível." })}</section>`);
        return;
    }

    let atual = def.calcular(filtros);
    if (!atual.series.some((s) => s.id === filtros.serie)) filtros.serie = atual.series[0]?.id ?? "";

    renderizar(raiz, html`
        ${cabecalho({
            titulo: def.titulo, voltar: { href: "#/relatorios", rotulo: "Relatórios" },
            extra: html`<span class="badge badge--ouro">${CATEGORIAS[def.categoria].rotulo}</span>`,
            subtitulo: def.descricao, acoes: botoesExportacao()
        })}
        ${avisoDemo()}
        ${filtrosHtml({ semPeriodo: def.semPeriodo, series: atual.series })}
        <div data-conteudo></div>`);

    function desenhar(recalcular = true) {
        if (recalcular) atual = def.calcular(filtros);
        const meses = K.mesesDoPeriodo(filtros.periodo);
        const serie = atual.series.find((s) => s.id === filtros.serie) ?? atual.series[0];
        const tend = serie ? K.tendencia(serie.dados.map((d) => d.valor)) : null;
        const conteudo = raiz.querySelector("[data-conteudo]");
        renderizar(conteudo, html`
            ${contexto(meses, def.semPeriodo)}
            <section class="grade grade--kpi grade--kpi-3 secao" data-kpis>${atual.kpis.map((k, i) => cartaoKpi(k, i === 0))}</section>
            <div class="grade ${serie && atual.ranking ? "grade--2 grade--2-igual" : ""} secao">
                ${serie ? html`
                    <section class="card">
                        <div class="card__cabecalho"><h2 class="card__titulo">${serie.rotulo}</h2><span class="texto-terc">${filtros.comparar ? "Atual × anterior" : "Por mês"}</span></div>
                        <div class="card__corpo">
                            ${grafico(serie, { comparar: filtros.comparar && !def.semPeriodo, largo: !atual.ranking })}
                            ${tend ? html`<p class="tendencia tendencia--${tend.direcao}">${icone(tend.direcao === "alta" ? "trending-up" : tend.direcao === "queda" ? "trending-down" : tend.direcao === "estavel" ? "move-right" : "circle-help")}<span>${tend.texto}</span></p>` : ""}
                        </div>
                    </section>` : ""}
                ${atual.ranking ? html`
                    <section class="card">
                        <div class="card__cabecalho"><h2 class="card__titulo">${atual.ranking.titulo}</h2></div>
                        <div class="card__corpo">${atual.ranking.itens.length
                            ? barrasHorizontais({ itens: atual.ranking.itens, formatar: (v) => formatarValor(v, atual.ranking.formato), titulo: atual.ranking.titulo })
                            : estadoVazio({ titulo: "Sem dados com os filtros atuais" })}</div>
                    </section>` : ""}
            </div>
            <section class="card secao">
                <div class="card__cabecalho"><h2 class="card__titulo">Dados do relatório</h2><span class="badge">${numero(atual.linhas.length)} registros</span></div>
                <div data-tabela></div>
            </section>
            <section class="card secao origem-dados">
                <div class="card__cabecalho"><h2 class="card__titulo">${icone("database")}Origem dos dados</h2></div>
                <div class="card__corpo">
                    <ul class="lista-origem">${def.origem.map((o) => html`<li>${o}</li>`)}</ul>
                    ${(atual.observacoes ?? []).length ? html`<ul class="lista-observacoes">${atual.observacoes.map((o) => html`<li>${icone("info")}<span>${o}</span></li>`)}</ul>` : ""}
                    <p class="texto-terc texto-pequeno">Todos os registros são demonstrativos e ficam salvos apenas neste navegador.</p>
                </div>
            </section>`);
        // A tabela usa as mesmas colunas e linhas da exportação.
        const colunasTabela = atual.colunas.map((c, i) => ({
            chave: `c${i}`, rotulo: c.rotulo, valor: c.valor,
            classe: ["moeda", "numero", "percentual", "decimal"].includes(c.formato) ? "col-num" : "",
            render: (l) => formatarValor(c.valor(l), c.formato)
        }));
        const nova = criarTabela({ colunas: colunasTabela, vazio: "Nenhum registro com os filtros selecionados.", rotulo: def.titulo, porPagina: 12 });
        conteudo.querySelector("[data-tabela]").appendChild(nova.elemento);
        nova.definirLinhas(atual.linhas);
    }
    desenhar(false);

    ligarFiltros(raiz, () => desenhar(true), { semPeriodo: def.semPeriodo });

    raiz.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, formato } = botao.dataset;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderRelatorio(view, id));
        if (acao === "limpar") { Object.assign(filtros, PADRAO); return renderRelatorio(view, id); }
        if (acao === "exportar") {
            const meses = K.mesesDoPeriodo(filtros.periodo);
            const resultado = exportarRelatorio(formato, {
                arquivo: `barber-control-relatorio-${def.id}`,
                titulo: def.titulo,
                subtitulo: `${CATEGORIAS[def.categoria].rotulo} · ${def.descricao}`,
                metadados: [...metadados(meses, def.semPeriodo), ["Origem dos dados", def.origem.join(" | ")]],
                kpis: atual.kpis.map((k) => [k.rotulo, `${formatarValor(k.atual, k.formato)}${k.anterior !== undefined ? ` (anterior: ${formatarValor(k.anterior, k.formato)})` : ""}`]),
                colunas: atual.colunas,
                linhas: atual.linhas,
                observacoes: atual.observacoes ?? []
            });
            mostrarToast(`${FORMATOS_EXPORTACAO[formato]} gerado com ${numero(atual.linhas.length)} registros: ${resultado.nome}`, "sucesso");
        }
    });
}

export function render(view, { parametros = [] }) {
    if (parametros[0]) renderRelatorio(view, parametros[0]);
    else renderPainel(view);
}
