// =====================================================================
// MÓDULO 18 — INTELIGÊNCIA DE NEGÓCIO (modo demonstrativo)
// Rotas: #/inteligencia[/analises|previsoes|recomendacoes|risco|assistente]
// Análises, projeções e recomendações usam regras e cálculos explícitos
// sobre os dados demonstrativos (indicadores.js). Não há IA externa:
// projeções são estimativas, não resultados garantidos.
// =====================================================================
import { MODO_DEMO } from "../../js/demo.js";
import * as K from "../../services/demo/indicadores.js";
import * as IN from "../../services/demo/inteligencia.js";
import * as A from "../../services/demo/assistente.js";
import { obterConfig, salvarConfig } from "../../services/demo/store.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda, mesReferencia, dataHora } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { formatarValor, exportarRelatorio } from "../../js/utilities/exportar.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { graficoBarras, graficoLinha, barrasHorizontais } from "../../js/components/grafico.js";
import { kpi, estadoVazio, badgeStatus, campoSelect, molduraComAbas, listaDefinicao } from "../../js/components/ui.js";

const SECOES = [["", "Painel estratégico"], ["analises", "Análises"], ["previsoes", "Previsões"], ["recomendacoes", "Recomendações"], ["risco", "Empresas em risco"], ["assistente", "Assistente"]];
const estado = { periodo: "12m", horizonte: 6, statusRec: "ativa" };
const moedaCompacta = (v) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : moeda(v));
const eixo = (formato) => (formato === "moeda" ? moedaCompacta : (v) => numero(Math.round(v)));
const serieGrafico = (dados) => dados.map((d) => ({ rotulo: mesReferencia(d.mes), rotuloLongo: mesReferencia(d.mes, true), valor: d.valor }));
const NIVEIS_RISCO = { alto: { rotulo: "Risco alto", tom: "erro" }, medio: { rotulo: "Risco médio", tom: "atencao" }, baixo: { rotulo: "Risco baixo", tom: "neutro" } };

function avisoInteligencia() {
    return html`<div class="alerta alerta--info">${icone("brain")}<span><strong>Inteligência por regras, sem IA externa.</strong> Análises, recomendações e projeções são calculadas no navegador a partir dos dados demonstrativos, com os critérios exibidos em cada item.</span></div>`;
}

function kpis() {
    const p = K.painelIndicadores("12m");
    const rent = K.rentabilidade("12m");
    const risco = K.barbeariasEmRisco();
    return html`
        ${kpi({ rotulo: "Clientes empresariais", valor: numero(p.atual.baseFim), iconeNome: "building-2", nota: `${p.atual.crescimento === null ? "—" : formatarValor(p.atual.crescimento, "percentual")} em 12 meses`, destaque: true })}
        ${kpi({ rotulo: "MRR", valor: moeda(p.mrr), iconeNome: "repeat", nota: `ARR ${moeda(p.arr)}` })}
        ${kpi({ rotulo: "Retenção (12 meses)", valor: formatarValor(p.atual.retencao, "percentual"), iconeNome: "shield-check", nota: `Churn ${formatarValor(p.atual.churn, "percentual")}` })}
        ${kpi({ rotulo: "Rentabilidade estimada", valor: formatarValor(rent.margem, "percentual"), iconeNome: "piggy-bank", nota: `Resultado ${moeda(rent.resultado)} em 12 meses` })}
        ${kpi({ rotulo: "Empresas em risco", valor: numero(risco.length), iconeNome: "triangle-alert", nota: `${numero(risco.filter((r) => r.nivel === "alto").length)} com risco alto` })}
        ${kpi({ rotulo: "Recomendações ativas", valor: numero(IN.recomendacoes().filter((r) => r.status === "ativa").length), iconeNome: "lightbulb", nota: "Geradas pelos indicadores" })}`;
}

function cartao(titulo, corpo, { nota = "", link = "", rotuloLink = "Detalhar" } = {}) {
    return html`
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">${titulo}</h2>${link ? html`<a class="link-forte texto-pequeno" href="${link}">${rotuloLink}</a>` : html`<span class="texto-terc">${nota}</span>`}</div>
            <div class="card__corpo">${corpo}${link && nota ? html`<p class="texto-terc texto-pequeno">${nota}</p>` : ""}</div>
        </section>`;
}

// ---------------------------------------------------------------------
// Painel estratégico
// ---------------------------------------------------------------------
function secaoPainel({ secao }) {
    renderizar(secao, html`
        ${avisoInteligencia()}
        <div class="barra-filtros barra-filtros--solta">${campoSelect({ id: "iPeriodo", rotulo: "Período", valor: estado.periodo, opcoes: Object.entries(K.PERIODOS_RELATORIO) })}</div>
        <div class="grade grade--2 grade--2-igual secao" data-painel></div>`);
    const desenhar = () => {
        const meses = K.mesesDoPeriodo(estado.periodo);
        const receita = K.serieReceita(meses);
        const empresas = K.serieEmpresas(meses);
        const rent = K.rentabilidade(estado.periodo);
        const uso = K.utilizacaoDosPlanos();
        const ativas = K.rankingAtividade({}, 6);
        const risco = K.barbeariasEmRisco().slice(0, 6);
        const dist = K.distribuicaoPlanos();
        renderizar(secao.querySelector("[data-painel]"), html`
            ${cartao("Evolução da receita", graficoBarras({ dados: serieGrafico(receita.map((r) => ({ mes: r.mes, valor: r.bruta }))), formatar: moeda, formatarEixo: moedaCompacta, titulo: "Receita por mês" }),
                { nota: K.tendencia(receita.map((r) => r.bruta)).texto, link: "#/relatorios/receita" })}
            ${cartao("Crescimento de clientes empresariais", empresas.length >= 2 ? graficoLinha({ dados: serieGrafico(empresas.map((e) => ({ mes: e.mes, valor: e.base }))), formatar: (v) => `${numero(v)} barbearias`, formatarEixo: numero, titulo: "Base de barbearias" }) : estadoVazio({ titulo: "Pontos insuficientes" }),
                { nota: K.tendencia(empresas.map((e) => e.base)).texto, link: "#/relatorios/base-barbearias" })}
            ${cartao("Rentabilidade estimada", html`
                ${listaDefinicao([["Receita bruta", moeda(rent.bruta)], ["Taxas estimadas", moeda(rent.taxas)], ["Despesas", moeda(rent.despesas)], ["Resultado", moeda(rent.resultado)], ["Margem", formatarValor(rent.margem, "percentual")]])}
                <p class="texto-terc texto-pequeno">Receita confirmada − taxas estimadas do gateway − despesas operacionais (módulo 04). Valores fictícios.</p>`, { link: "#/relatorios/receita" })}
            ${cartao("Distribuição por planos", dist.length ? barrasHorizontais({ itens: dist.map((d) => ({ rotulo: d.rotulo, valor: d.valor })), formatar: (v) => `${numero(v)} empresas`, titulo: "Planos" }) : estadoVazio({ titulo: "Sem empresas" }), { link: "#/relatorios/assinaturas" })}
            ${cartao("Utilização dos limites dos planos", barrasHorizontais({ itens: [
                { rotulo: "Uso alto (≥ 70% do limite)", valor: uso.alta }, { rotulo: "Uso médio (30–69%)", valor: uso.media },
                { rotulo: "Uso baixo (< 30%)", valor: uso.baixa }, { rotulo: "Plano sem limite", valor: uso.ilimitado }], formatar: (v) => `${numero(v)} empresas`, titulo: "Uso do limite" }),
                { nota: "Agendamentos dos últimos 30 dias ÷ limite mensal do plano", link: "#/relatorios/utilizacao" })}
            ${cartao("Empresas mais ativas", ativas.length ? barrasHorizontais({ itens: ativas.map((r) => ({ rotulo: r.barbearia.nome, valor: r.ag30, link: `#/barbearias/${r.barbearia.id}` })), formatar: (v) => `${numero(v)} agend.`, titulo: "Mais ativas" }) : estadoVazio({ titulo: "Sem atividade registrada" }),
                { nota: "Agendamentos nos últimos 30 dias", link: "#/relatorios/atividade" })}
            ${cartao("Empresas em risco de cancelamento", risco.length ? html`
                <ul class="lista">${risco.map((r) => html`
                    <li class="lista__item">
                        <span class="lista__icone">${icone("triangle-alert")}</span>
                        <div class="lista__conteudo">
                            <a class="lista__titulo link-forte" href="#/barbearias/${r.barbearia.id}">${r.barbearia.nome}</a>
                            <span class="lista__meta">${r.pontos} pontos · ${r.motivos.length} ${r.motivos.length === 1 ? "critério" : "critérios"} · ${moeda(r.mrrEmRisco)}/mês</span>
                        </div>
                        ${badgeStatus(NIVEIS_RISCO, r.nivel)}
                    </li>`)}</ul>` : estadoVazio({ iconeNome: "shield-check", titulo: "Nenhuma empresa em risco médio ou alto" }),
                { link: "#/inteligencia/risco", rotuloLink: "Ver todas" })}`);
    };
    desenhar();
    secao.querySelector("#iPeriodo").addEventListener("change", (e) => { estado.periodo = e.target.value; desenhar(); });
}

// ---------------------------------------------------------------------
// Análises
// ---------------------------------------------------------------------
function secaoAnalises({ secao }) {
    renderizar(secao, html`
        ${avisoInteligencia()}
        <div class="barra-filtros barra-filtros--solta">${campoSelect({ id: "iPeriodoA", rotulo: "Período das análises", valor: estado.periodo, opcoes: Object.entries(K.PERIODOS_RELATORIO) })}</div>
        <div class="analises secao" data-analises></div>`);
    const desenhar = () => renderizar(secao.querySelector("[data-analises]"), IN.analises(estado.periodo).map((a) => html`
        <article class="analise">
            <div class="analise__topo"><span class="analise__icone">${icone(a.icone)}</span><h3>${a.titulo}</h3></div>
            <dl class="analise__numeros">${a.numeros.map(([r, v]) => html`<div><dt>${r}</dt><dd class="num">${typeof v === "number" ? numero(v) : v}</dd></div>`)}</dl>
            <p class="analise__leitura">${a.leitura}</p>
            <a class="link-forte texto-pequeno" href="${a.link}">Ver dados de origem ${icone("arrow-right")}</a>
        </article>`));
    desenhar();
    secao.querySelector("#iPeriodoA").addEventListener("change", (e) => { estado.periodo = e.target.value; desenhar(); });
}

// ---------------------------------------------------------------------
// Previsões
// ---------------------------------------------------------------------
function graficoProjecao(item) {
    const p = item.projecao;
    const dados = [
        ...p.historico.map((h) => ({ rotulo: mesReferencia(h.mes), rotuloLongo: mesReferencia(h.mes, true), valor: h.valor })),
        ...p.futuros.map((f) => ({ rotulo: mesReferencia(f.mes), rotuloLongo: mesReferencia(f.mes, true), valor: f.valor, tom: "projecao", nota: `estimativa; faixa ${formatarValor(f.minimo, item.formato)} a ${formatarValor(f.maximo, item.formato)}` }))
    ];
    return html`
        <div class="grafico__legenda">
            <span><i class="grafico__chave grafico__chave--ouro" aria-hidden="true"></i>Histórico (${p.mesesUsados} meses)</span>
            <span><i class="grafico__chave grafico__chave--projecao" aria-hidden="true"></i>Projeção demonstrativa</span>
        </div>
        ${graficoBarras({ dados, formatar: (v) => formatarValor(v, item.formato), formatarEixo: eixo(item.formato), titulo: `${item.titulo}: histórico e projeção` })}`;
}

function secaoPrevisoes({ secao }) {
    renderizar(secao, html`
        <div class="alerta alerta--atencao" role="note">${icone("triangle-alert")}<span><strong>Estimativas demonstrativas, não resultados garantidos.</strong> As projeções prolongam a tendência dos últimos meses por regressão linear simples sobre dados fictícios. Não consideram sazonalidade, campanhas, preços ou eventos externos.</span></div>
        <div class="barra-filtros barra-filtros--solta">${campoSelect({ id: "iHorizonte", rotulo: "Horizonte da projeção", valor: String(estado.horizonte), opcoes: [["3", "Próximos 3 meses"], ["6", "Próximos 6 meses"]] })}</div>
        <div class="grade grade--2 grade--2-igual secao" data-projecoes></div>`);
    const desenhar = () => {
        const prev = IN.projecoes(estado.horizonte);
        renderizar(secao.querySelector("[data-projecoes]"), html`
            ${prev.itens.map((item) => html`
                <section class="card projecao" data-projecao="${item.id}">
                    <div class="card__cabecalho"><h2 class="card__titulo">${item.titulo}</h2><span class="badge badge--atencao">Estimativa</span></div>
                    <div class="card__corpo">
                        ${item.projecao.suficiente ? html`
                            ${graficoProjecao(item)}
                            <div class="tabela-rolagem"><table class="tabela tabela--compacta">
                                <thead><tr><th scope="col">Mês</th><th scope="col" class="col-num">Projeção</th><th scope="col" class="col-num">Faixa provável (≈80%)</th></tr></thead>
                                <tbody>${item.projecao.futuros.map((f) => html`<tr><td>${mesReferencia(f.mes, true)}</td><td class="col-num">${formatarValor(f.valor, item.formato)}</td><td class="col-num">${formatarValor(f.minimo, item.formato)} – ${formatarValor(f.maximo, item.formato)}</td></tr>`)}</tbody>
                            </table></div>
                            <p class="criterio">${icone("sigma")}<span><strong>Critério:</strong> ${item.projecao.criterio}</span></p>
                            <details class="historico-usado"><summary>Dados históricos usados</summary>
                                <p class="texto-pequeno texto-sec">${item.projecao.historico.map((h) => `${mesReferencia(h.mes)}: ${formatarValor(h.valor, item.formato)}`).join(" · ")}</p>
                            </details>`
                        : estadoVazio({ iconeNome: "chart-line", titulo: "Dados históricos insuficientes", texto: item.projecao.motivo })}
                    </div>
                </section>`)}
            <section class="card projecao" data-projecao="cancelamentos">
                <div class="card__cabecalho"><h2 class="card__titulo">Estimativa de cancelamentos</h2><span class="badge badge--atencao">Estimativa</span></div>
                <div class="card__corpo">
                    ${prev.cancelamentos.suficiente ? html`
                        <p class="numero-destaque num">≈ ${numero(prev.cancelamentos.estimativa)}</p>
                        <p class="texto-sec">cancelamentos nos próximos ${prev.horizonte} meses, se o ritmo recente se mantiver.</p>
                        <p class="criterio">${icone("sigma")}<span><strong>Critério:</strong> ${prev.cancelamentos.criterio}</span></p>`
                    : estadoVazio({ titulo: "Dados insuficientes", texto: prev.cancelamentos.motivo })}
                </div>
            </section>`);
    };
    desenhar();
    secao.querySelector("#iHorizonte").addEventListener("change", (e) => { estado.horizonte = Number(e.target.value); desenhar(); });
}

// ---------------------------------------------------------------------
// Recomendações
// ---------------------------------------------------------------------
function secaoRecomendacoes(ctx) {
    const { secao } = ctx;
    renderizar(secao, html`
        ${avisoInteligencia()}
        <div class="barra-filtros barra-filtros--solta">
            ${campoSelect({ id: "iStatusRec", rotulo: "Situação", valor: estado.statusRec, opcoes: [["", "Todas"], ...Object.entries(IN.STATUS_RECOMENDACAO).map(([k, v]) => [k, v.rotulo])] })}
            <button class="btn btn--fantasma" type="button" data-acao="reavaliar">${icone("refresh-cw")}<span>Reavaliar indicadores</span></button>
        </div>
        <div class="recomendacoes secao" data-lista></div>`);

    const desenhar = () => {
        const lista = IN.recomendacoes().filter((r) => !estado.statusRec || r.status === estado.statusRec);
        renderizar(secao.querySelector("[data-lista]"), lista.length ? lista.map((r) => html`
            <article class="recomendacao recomendacao--${r.status}" data-recomendacao="${r.id}">
                <div class="recomendacao__topo">
                    ${badgeStatus(IN.IMPACTOS, r.impacto)} ${badgeStatus(IN.STATUS_RECOMENDACAO, r.status)}
                    <time class="texto-terc texto-pequeno" datetime="${r.data}">${r.status === "ativa" ? "Avaliada em" : "Atualizada em"} ${dataHora(r.data)}</time>
                </div>
                <h3>${r.titulo}</h3>
                <p>${r.descricao}</p>
                ${listaDefinicao([
                    ["Indicador relacionado", r.indicador], ["Valor observado", r.valor], ["Justificativa", r.justificativa],
                    ["Impacto potencial", r.impactoTexto], ["Ação sugerida", r.acao], r.observacao ? ["Observação", r.observacao] : null
                ])}
                <div class="recomendacao__acoes">
                    <a class="btn btn--pequeno" href="${r.link}">${icone("arrow-up-right")}<span>${r.rotuloLink}</span></a>
                    ${r.status === "ativa" ? html`
                        <button class="btn btn--primario btn--pequeno" type="button" data-acao="concluir" data-id="${r.id}">${icone("check")}<span>Marcar como concluída</span></button>
                        <button class="btn btn--fantasma btn--pequeno" type="button" data-acao="descartar" data-id="${r.id}">${icone("x")}<span>Descartar</span></button>`
                    : html`<button class="btn btn--fantasma btn--pequeno" type="button" data-acao="reabrir" data-id="${r.id}">${icone("rotate-ccw")}<span>Reabrir</span></button>`}
                </div>
            </article>`) : estadoVazio({ iconeNome: "lightbulb", titulo: "Nenhuma recomendação nesta situação", texto: "Os indicadores atuais não dispararam nenhuma regra com este filtro." }));
    };
    desenhar();
    secao.querySelector("#iStatusRec").addEventListener("change", (e) => { estado.statusRec = e.target.value; desenhar(); });
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        const { acao, id } = b.dataset;
        try {
            if (acao === "reavaliar") { desenhar(); ctx.atualizarIndicadores(); mostrarToast(`Indicadores reavaliados: ${IN.recomendacoes().length} recomendações aplicáveis.`, "sucesso"); }
            if (acao === "concluir" || acao === "descartar") {
                const salvo = await abrirFormulario({
                    titulo: acao === "concluir" ? "Concluir recomendação" : "Descartar recomendação",
                    descricao: "A alteração fica registrada no histórico e na auditoria (módulo 20).",
                    campos: [{ nome: "observacao", rotulo: acao === "concluir" ? "O que foi feito (opcional)" : "Motivo do descarte", tipo: "textarea", maxlength: 300, obrigatorio: acao === "descartar" }],
                    textoSalvar: acao === "concluir" ? "Concluir" : "Descartar",
                    aoSalvar: (v) => IN.alterarRecomendacao(id, acao === "concluir" ? "concluida" : "descartada", v.observacao)
                });
                if (salvo) { desenhar(); ctx.atualizarIndicadores(); mostrarToast(acao === "concluir" ? "Recomendação concluída." : "Recomendação descartada.", "sucesso"); }
            }
            if (acao === "reabrir") { IN.alterarRecomendacao(id, "ativa"); desenhar(); ctx.atualizarIndicadores(); mostrarToast("Recomendação reaberta.", "sucesso"); }
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

// ---------------------------------------------------------------------
// Empresas em risco
// ---------------------------------------------------------------------
function secaoRisco({ secao }) {
    const lista = K.barbeariasEmRisco();
    const rotulo = (id) => K.CRITERIOS_RISCO.find((c) => c.id === id)?.rotulo ?? id;
    renderizar(secao, html`
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Critérios de risco</h2><span class="texto-terc">Pontos somados</span></div>
                <div class="card__corpo">
                    <ul class="criterios">${K.CRITERIOS_RISCO.map((c) => html`<li><span class="badge">${c.pontos} pts</span><span>${c.rotulo}</span></li>`)}</ul>
                    <p class="texto-terc texto-pequeno">Risco alto: 50 pontos ou mais · médio: 30 a 49. Considera barbearias ativas e suspensas.</p>
                </div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Resumo</h2></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Empresas em risco", numero(lista.length)], ["Risco alto", numero(lista.filter((r) => r.nivel === "alto").length)],
                    ["Risco médio", numero(lista.filter((r) => r.nivel === "medio").length)], ["MRR em risco", moeda(lista.reduce((s, r) => s + r.mrrEmRisco, 0))]
                ])}</div>
            </section>
        </div>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Empresas em risco de cancelamento</h2>
                <button class="btn btn--pequeno" type="button" data-acao="exportar-risco">${icone("file-down")}<span>Exportar CSV</span></button></div>
            <div data-tabela></div>
        </section>`);
    const tabela = criarTabela({
        colunas: [
            { chave: "nome", rotulo: "Barbearia", valor: (r) => r.barbearia.nome, render: (r) => html`<a class="link-forte" href="#/barbearias/${r.barbearia.id}">${r.barbearia.nome}</a>` },
            { chave: "pontos", rotulo: "Pontos", classe: "col-num", valor: (r) => r.pontos },
            { chave: "nivel", rotulo: "Nível", valor: (r) => r.pontos, render: (r) => badgeStatus(NIVEIS_RISCO, r.nivel) },
            { chave: "motivos", rotulo: "Critérios atendidos", ordenavel: false, render: (r) => html`<span class="celula-limite">${r.motivos.map(rotulo).join(" · ")}</span>` },
            { chave: "ag30", rotulo: "Agend. 30 dias", classe: "col-num", valor: (r) => r.ag30, render: (r) => html`${numero(r.ag30)}<span class="celula-sub">antes: ${numero(r.anterior)}</span>` },
            { chave: "mrr", rotulo: "MRR em risco", classe: "col-num", valor: (r) => r.mrrEmRisco, render: (r) => moeda(r.mrrEmRisco) }
        ],
        ordenacao: { chave: "pontos", direcao: "desc" }, vazio: "Nenhuma empresa em risco médio ou alto.", rotulo: "Empresas em risco"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(lista);
    secao.addEventListener("click", (e) => {
        if (!e.target.closest("[data-acao=exportar-risco]")) return;
        if (!lista.length) return mostrarToast("Nenhuma empresa em risco para exportar.", "atencao");
        exportarRelatorio("csv", {
            arquivo: "barber-control-empresas-em-risco", titulo: "Empresas em risco de cancelamento",
            colunas: [
                { rotulo: "Barbearia", valor: (r) => r.barbearia.nome }, { rotulo: "Pontos", valor: (r) => r.pontos, formato: "numero" },
                { rotulo: "Nível", valor: (r) => NIVEIS_RISCO[r.nivel].rotulo }, { rotulo: "Critérios", valor: (r) => r.motivos.map(rotulo).join(" | ") },
                { rotulo: "Agendamentos 30 dias", valor: (r) => r.ag30, formato: "numero" }, { rotulo: "MRR em risco", valor: (r) => r.mrrEmRisco, formato: "moeda" }
            ],
            linhas: lista
        });
        mostrarToast(`${numero(lista.length)} empresas exportadas (dados demonstrativos).`, "sucesso");
    });
}

// ---------------------------------------------------------------------
// Assistente
// ---------------------------------------------------------------------
const historicoAssistente = () => obterConfig("assistente")?.mensagens ?? [];

function mensagemHtml(m) {
    if (m.autor === "usuario") return html`<div class="chat__msg chat__msg--usuario"><p>${m.texto}</p></div>`;
    const r = m.resposta;
    return html`
        <div class="chat__msg chat__msg--assistente ${r.semDados ? "chat__msg--sem-dados" : ""}">
            <span class="chat__autor">${icone("bot")}Assistente local</span>
            <p>${r.texto}</p>
            ${r.indicadores?.length ? html`
                <details class="chat__indicadores" open>
                    <summary>Indicadores consultados (${r.indicadores.length})</summary>
                    <ul>${r.indicadores.map((i) => html`<li><strong>${i.rotulo}:</strong> ${i.valor} <span class="texto-terc">· ${i.origem}</span></li>`)}</ul>
                </details>` : ""}
            ${r.link ? html`<a class="link-forte texto-pequeno" href="${r.link}">Abrir dados relacionados ${icone("arrow-right")}</a>` : ""}
        </div>`;
}

function secaoAssistente({ secao }) {
    renderizar(secao, html`
        <div class="alerta alerta--info">${icone("bot")}<span><strong>Assistente de consultas locais.</strong> Não há conexão com inteligência artificial externa: as perguntas reconhecidas são respondidas com os dados demonstrativos deste navegador, mostrando os indicadores usados. Perguntas fora desse conjunto recebem a informação de que não há dados.</span></div>
        <section class="card chat">
            <div class="chat__mensagens" data-mensagens aria-live="polite"></div>
            <div class="chat__sugestoes" aria-label="Perguntas sugeridas">${A.EXEMPLOS.map((e) => html`<button class="chip" type="button" data-pergunta="${e}">${e}</button>`)}</div>
            <form class="chat__formulario" data-form>
                <label class="sr-only" for="perguntaAssistente">Pergunta</label>
                <input class="entrada" id="perguntaAssistente" maxlength="200" autocomplete="off" placeholder="Pergunte sobre barbearias, planos, receita, churn, risco…">
                <button class="btn btn--primario" type="submit">${icone("send")}<span>Perguntar</span></button>
                <button class="btn btn--fantasma" type="button" data-acao="limpar-chat">${icone("eraser")}<span>Limpar conversa</span></button>
            </form>
        </section>`);
    const caixa = secao.querySelector("[data-mensagens]");
    const desenhar = () => {
        const msgs = historicoAssistente();
        renderizar(caixa, msgs.length ? msgs.map(mensagemHtml) : estadoVazio({ iconeNome: "message-circle-question", titulo: "Faça uma pergunta", texto: "Use uma das sugestões ou escreva a sua." }));
        caixa.scrollTop = caixa.scrollHeight;
    };
    const perguntar = (texto) => {
        const pergunta = texto.trim();
        if (!pergunta) return mostrarToast("Digite uma pergunta.", "atencao");
        const r = A.perguntar(pergunta);
        const msgs = [...historicoAssistente(), { autor: "usuario", texto: pergunta, data: new Date().toISOString() }, { autor: "assistente", resposta: r, data: new Date().toISOString() }].slice(-40);
        salvarConfig("assistente", { mensagens: msgs });
        desenhar();
    };
    desenhar();
    secao.querySelector("[data-form]").addEventListener("submit", (e) => {
        e.preventDefault();
        const campo = secao.querySelector("#perguntaAssistente");
        perguntar(campo.value);
        campo.value = "";
        campo.focus();
    });
    secao.addEventListener("click", async (e) => {
        const sug = e.target.closest("[data-pergunta]");
        if (sug) return perguntar(sug.dataset.pergunta);
        if (e.target.closest("[data-acao=limpar-chat]")) {
            if (!historicoAssistente().length) return;
            if (await confirmar({ titulo: "Limpar a conversa?", mensagem: "As perguntas e respostas salvas neste navegador serão apagadas.", textoConfirmar: "Limpar" })) {
                salvarConfig("assistente", { mensagens: [] });
                desenhar();
                mostrarToast("Conversa apagada.", "sucesso");
            }
        }
    });
}

const RENDER = { "": secaoPainel, analises: secaoAnalises, previsoes: secaoPrevisoes, recomendacoes: secaoRecomendacoes, risco: secaoRisco, assistente: secaoAssistente };

export async function render(view, contexto) {
    // Fora do modo demonstração: dados reais do Supabase (Master + MFA).
    if (!MODO_DEMO) {
        const real = await import("./real.js");
        return real.render(view, contexto);
    }
    const { parametros = [] } = contexto;
    const ativa = SECOES.some(([r]) => r === parametros[0]) ? parametros[0] : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Inteligência de negócio", subtitulo: "Análises, previsões e recomendações a partir dos indicadores da plataforma", base: "#/inteligencia",
        secoes: SECOES, ativa, kpis, recarregar, classeKpis: "grade--kpi-3"
    });
    RENDER[ativa](ctx);
}

