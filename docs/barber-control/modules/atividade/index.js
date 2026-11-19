// =====================================================================
// MÓDULO 06 — AGENDAMENTOS E ATIVIDADE (modo demonstrativo)
// Rotas: #/atividade               → painel geral
//        #/atividade/<barbeariaId> → perfil de atividade da barbearia
// Todos os números vêm dos agendamentos fictícios gerados a partir das
// barbearias e barbeiros já cadastrados.
// =====================================================================
import { MODO_DEMO } from "../../js/demo.js";
import * as S from "../../services/demo/saas.js";
import * as O from "../../services/demo/operacao.js";
import { SERVICOS, STATUS_AGENDAMENTO, STATUS_BARBEARIA, PERIODOS_ATIVIDADE, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda, percentual, mesReferencia, data } from "../../js/utilities/format.js";
import { criarTabela } from "../../js/components/tabela.js";
import { montarAbas } from "../../js/components/abas.js";
import { graficoBarras, barrasHorizontais } from "../../js/components/grafico.js";
import { abrirPainel } from "../../js/components/painel.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, kpi, estadoVazio, listaDefinicao,
    linhaDoTempo, botaoIcone, campoBusca, campoSelect, novaRaiz
} from "../../js/components/ui.js";

const filtros = { periodo: "30", barbeariaId: "", status: "", servicoId: "", busca: "" };
let abaGrafico = "dia";

const formatarAg = (v) => `${numero(v)} agendamentos`;
const paraGrafico = (serie) => serie.map((s) => ({ rotulo: s.rotulo ?? mesReferencia(s.mes), rotuloLongo: s.rotuloLongo ?? mesReferencia(s.mes, true), valor: s.valor }));

function variacao(v) {
    if (v === null || v === undefined) return html`<span class="variacao">sem base anterior</span>`;
    const pct = Math.round(v * 100);
    const classe = pct > 0 ? "variacao--alta" : pct < 0 ? "variacao--baixa" : "";
    return html`<span class="variacao ${classe}">${pct > 0 ? "+" : ""}${pct}% vs período anterior</span>`;
}

function cartaoGrafico(titulo, nota, conteudo) {
    return html`
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">${titulo}</h2>${nota ? html`<span class="texto-terc">${nota}</span>` : ""}</div>
            <div class="card__corpo">${conteudo}</div>
        </section>`;
}

function blocoComparacao(comp) {
    const linha = (rotulo, atual, anterior, v, fmt = numero) => html`
        <div class="comparacao__item">
            <span class="comparacao__rotulo">${rotulo}</span>
            <strong class="num">${fmt(atual)}</strong>
            <span class="texto-terc num">antes: ${fmt(anterior)}</span>
            ${v === undefined ? "" : variacao(v)}
        </div>`;
    return html`
        <div class="comparacao">
            ${linha("Agendamentos", comp.atual.total, comp.anterior.total, comp.variacao.total)}
            ${linha("Realizados", comp.atual.realizados, comp.anterior.realizados, comp.variacao.realizados)}
            ${linha("Cancelados", comp.atual.cancelados, comp.anterior.cancelados, comp.variacao.cancelados)}
            ${linha("Taxa de cancelamento", comp.atual.taxaCancelamento, comp.anterior.taxaCancelamento, undefined, (x) => percentual(x))}
        </div>`;
}

const ICONES_ALERTA = { inatividade: "moon", queda: "trending-down", cancelamentos: "calendar-x", crescimento: "trending-up" };
const TOM_ALERTA = { alta: "erro", media: "atencao", positiva: "sucesso" };

function listaAlertas(alertas) {
    if (!alertas.length) return estadoVazio({ iconeNome: "bell-off", titulo: "Nenhum alerta de atividade", texto: "Nenhuma barbearia atende aos critérios de alerta no momento." });
    return html`
        <ul class="lista">
            ${alertas.map((a) => {
                const b = S.barbearia(a.barbeariaId);
                return html`
                    <li class="lista__item alerta-atividade alerta-atividade--${TOM_ALERTA[a.gravidade]}">
                        <span class="lista__icone">${icone(ICONES_ALERTA[a.tipo])}</span>
                        <div class="lista__conteudo">
                            <div class="lista__titulo">${a.titulo} · <a class="link-forte" href="#/atividade/${b.id}">${b.nome}</a></div>
                            <div class="lista__meta">${a.descricao}</div>
                        </div>
                        <a class="btn btn--pequeno" href="#/atividade/${b.id}">Ver perfil</a>
                    </li>`;
            })}
        </ul>`;
}

async function verAgendamento(id) {
    const a = O.agendamentos().find((x) => x.id === id);
    if (!a) return;
    const b = S.barbearia(a.barbeariaId);
    const s = O.servico(a.servicoId);
    await abrirPainel({
        titulo: `Agendamento ${a.id}`,
        descricao: "Registro fictício gerado para demonstração.",
        conteudo: listaDefinicao([
            ["Barbearia", html`<a class="link-forte" href="#/atividade/${b.id}">${b.nome}</a>`],
            ["Serviço", `${s.nome} · ${moeda(s.preco)}`],
            ["Barbeiro", S.usuario(a.barbeiroId)?.nome ?? "—"],
            ["Data", data(`${a.data}T12:00:00`)],
            ["Horário", a.hora],
            ["Status", badgeStatus(STATUS_AGENDAMENTO, a.status)]
        ])
    });
}

const COLUNAS = [
    { chave: "id", rotulo: "ID", render: (a) => html`<button class="link-botao link-forte" type="button" data-acao="ver" data-id="${a.id}">${a.id}</button>` },
    { chave: "barbearia", rotulo: "Barbearia", valor: (a) => S.barbearia(a.barbeariaId)?.nome ?? "", render: (a) => S.barbearia(a.barbeariaId)?.nome ?? "—" },
    { chave: "servico", rotulo: "Serviço", valor: (a) => SERVICOS[a.servicoId].nome, render: (a) => SERVICOS[a.servicoId].nome },
    { chave: "barbeiro", rotulo: "Barbeiro", valor: (a) => S.usuario(a.barbeiroId)?.nome ?? "", render: (a) => S.usuario(a.barbeiroId)?.nome ?? "—" },
    { chave: "data", rotulo: "Data", render: (a) => a.data.split("-").reverse().join("/") },
    { chave: "minuto", rotulo: "Horário", render: (a) => a.hora },
    { chave: "status", rotulo: "Status", valor: (a) => a.status, render: (a) => badgeStatus(STATUS_AGENDAMENTO, a.status) },
    { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (a) => botaoIcone({ acao: "ver", id: a.id, nomeIcone: "eye", rotulo: `Ver ${a.id}` }) }
];

// ---------------------------------------------------------------------
// Painel geral
// ---------------------------------------------------------------------
function renderPainel(view) {
    const raiz = novaRaiz(view);
    const empresas = [...S.barbearias()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Agendamentos e atividade", subtitulo: "Uso da agenda em todas as barbearias da plataforma" })}
        ${avisoDemo()}
        <div class="barra-filtros barra-filtros--solta">
            ${campoSelect({ id: "fPeriodo", rotulo: "Período", valor: filtros.periodo, opcoes: opcoes(PERIODOS_ATIVIDADE) })}
            ${campoSelect({ id: "fBarbearia", rotulo: "Barbearia", valor: filtros.barbeariaId, opcoes: [["", "Todas as barbearias"], ...empresas.map((b) => [b.id, b.nome])] })}
            ${campoSelect({ id: "fStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_AGENDAMENTO)] })}
            ${campoSelect({ id: "fServico", rotulo: "Serviço", valor: filtros.servicoId, opcoes: [["", "Todos os serviços"], ...SERVICOS.map((s) => [String(s.id), s.nome])] })}
            <button class="btn btn--fantasma" type="button" data-acao="limpar">${icone("filter-x")}<span>Limpar</span></button>
        </div>
        <p class="nota-periodo texto-terc">${icone("info")}<span>O período inclui também a agenda futura dos próximos 14 dias (agendamentos pendentes).</span></p>
        <section class="grade grade--kpi grade--kpi-3 secao" data-kpis></section>
        <div class="grade grade--2 grade--2-igual secao" data-rankings></div>
        <section class="card secao" data-graficos-tempo></section>
        <div class="grade grade--2 grade--2-igual secao" data-graficos></div>
        <div class="grade grade--2 grade--2-igual secao" data-evolucao></div>
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Alertas de atividade</h2><span class="badge badge--atencao">Demonstrativos · últimos 30 dias</span></div>
            <div data-alertas></div>
        </section>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Agendamentos</h2><span class="badge" data-contagem></span></div>
            <div class="barra-filtros">${campoBusca({ id: "fBusca", valor: filtros.busca, placeholder: "Pesquisar por ID, barbearia ou barbeiro" })}</div>
            <div data-tabela></div>
        </section>`);

    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "data", direcao: "desc" }, vazio: "Nenhum agendamento para os filtros selecionados.", rotulo: "Agendamentos" });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);

    function atualizar() {
        const lista = O.filtrarAgendamentos(filtros);
        const semBusca = O.filtrarAgendamentos({ ...filtros, busca: "" });
        const nBarbearias = filtros.barbeariaId ? 1 : S.barbearias().filter((b) => b.status !== "cancelada").length;
        const r = O.resumoAgendamentos(semBusca, nBarbearias);
        const ranking = O.rankingBarbearias(O.filtrarAgendamentos({ ...filtros, barbeariaId: "", busca: "" }));
        const periodo = Number(filtros.periodo);

        renderizar(raiz.querySelector("[data-kpis]"), html`
            ${kpi({ rotulo: "Total de agendamentos", valor: numero(r.total), iconeNome: "calendar-days", nota: PERIODOS_ATIVIDADE[filtros.periodo] + " + agenda futura", destaque: true })}
            ${kpi({ rotulo: "Realizados", valor: numero(r.realizados), iconeNome: "calendar-check", nota: "Atendimentos concluídos" })}
            ${kpi({ rotulo: "Cancelados", valor: numero(r.cancelados), iconeNome: "calendar-x", nota: "Desmarcados" })}
            ${kpi({ rotulo: "Pendentes", valor: numero(r.pendentes), iconeNome: "calendar-clock", nota: "Agendados a partir de agora" })}
            ${kpi({ rotulo: "Taxa de cancelamento", valor: percentual(r.taxaCancelamento), iconeNome: "percent", nota: "Cancelados ÷ (realizados + cancelados)" })}
            ${kpi({ rotulo: "Média por barbearia", valor: numero(Math.round(r.mediaPorBarbearia)), iconeNome: "store", nota: filtros.barbeariaId ? "Barbearia filtrada" : `${nBarbearias} barbearias não canceladas` })}`);

        const topo = ranking.slice(0, 5).map((x) => ({ rotulo: x.barbearia.nome, valor: x.total, link: `#/atividade/${x.barbearia.id}` }));
        const fundo = [...ranking].reverse().slice(0, 5).map((x) => ({ rotulo: x.barbearia.nome, valor: x.total, link: `#/atividade/${x.barbearia.id}` }));
        renderizar(raiz.querySelector("[data-rankings]"), html`
            ${cartaoGrafico("Barbearias mais ativas", "Agendamentos no período", barrasHorizontais({ itens: topo, formatar: numero, titulo: "Barbearias mais ativas" }))}
            ${cartaoGrafico("Barbearias com menor atividade", "Sem barbearias canceladas", barrasHorizontais({ itens: fundo, formatar: numero, titulo: "Barbearias com menor atividade" }))}`);

        // Gráficos temporais em abas: dia | semana | mês
        const cartaoTempo = raiz.querySelector("[data-graficos-tempo]");
        renderizar(cartaoTempo, html`
            <div class="card__cabecalho"><h2 class="card__titulo">Agendamentos ao longo do tempo</h2><span class="texto-terc">Até hoje</span></div>
            <div class="card__corpo" data-abas-tempo></div>`);
        montarAbas(cartaoTempo.querySelector("[data-abas-tempo]"), {
            rotulo: "Agrupamento",
            ativa: abaGrafico,
            aoTrocar: (id) => { abaGrafico = id; },
            abas: [
                { id: "dia", rotulo: "Por dia", render: (p) => renderizar(p, graficoBarras({ dados: O.seriePorDia(semBusca, periodo), formatar: formatarAg, formatarEixo: numero, titulo: "Agendamentos por dia", largo: true })) },
                { id: "semana", rotulo: "Por semana", render: (p) => renderizar(p, graficoBarras({ dados: O.seriePorSemana(semBusca, Math.max(periodo, 28)), formatar: formatarAg, formatarEixo: numero, titulo: "Agendamentos por semana", largo: true })) },
                {
                    id: "mes", rotulo: "Por mês",
                    render: (p) => renderizar(p, graficoBarras({ dados: paraGrafico(O.seriePorMes(O.filtrarAgendamentos({ ...filtros, periodo: 180, busca: "" }))), formatar: formatarAg, formatarEixo: numero, titulo: "Agendamentos por mês", largo: true }))
                }
            ]
        });

        renderizar(raiz.querySelector("[data-graficos]"), html`
            ${cartaoGrafico("Horários de maior movimento", "Agendamentos por faixa de horário",
                graficoBarras({ dados: O.seriePorHora(semBusca), formatar: formatarAg, formatarEixo: numero, titulo: "Horários de maior movimento" }))}
            ${cartaoGrafico("Serviços mais utilizados", "No período",
                barrasHorizontais({ itens: O.rankingServicos(semBusca).map((x) => ({ rotulo: x.servico.nome, valor: x.valor })), formatar: numero, titulo: "Serviços mais utilizados" }))}`);

        renderizar(raiz.querySelector("[data-evolucao]"), html`
            ${cartaoGrafico("Comparação entre períodos", `${PERIODOS_ATIVIDADE[filtros.periodo]} × ${periodo} dias anteriores`, blocoComparacao(O.compararPeriodos(filtros)))}
            ${cartaoGrafico("Evolução da atividade", "Barbearias com agendamentos por semana",
                graficoBarras({ dados: O.serieBarbeariasAtivas(O.filtrarAgendamentos({ ...filtros, periodo: Math.max(periodo, 56), busca: "" }), Math.max(periodo, 56)), formatar: (v) => `${numero(v)} barbearias ativas`, formatarEixo: numero, tom: "neutro", titulo: "Evolução da atividade" }))}`);

        renderizar(raiz.querySelector("[data-alertas]"), listaAlertas(O.alertasAtividade().filter((a) => !filtros.barbeariaId || a.barbeariaId === filtros.barbeariaId)));
        raiz.querySelector("[data-contagem]").textContent = `${numero(lista.length)} registros`;
        tabela.definirLinhas(lista);
    }
    atualizar();

    [["#fPeriodo", "periodo"], ["#fBarbearia", "barbeariaId"], ["#fStatus", "status"], ["#fServico", "servicoId"]].forEach(([sel, chave]) =>
        raiz.querySelector(sel).addEventListener("change", (e) => { filtros[chave] = e.target.value; atualizar(); }));
    let espera;
    raiz.querySelector("#fBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => {
            filtros.busca = e.target.value;
            const lista = O.filtrarAgendamentos(filtros);
            raiz.querySelector("[data-contagem]").textContent = `${numero(lista.length)} registros`;
            tabela.definirLinhas(lista);
        }, 200);
    });

    raiz.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderPainel(view));
        if (acao === "limpar") {
            Object.assign(filtros, { periodo: "30", barbeariaId: "", status: "", servicoId: "", busca: "" });
            return renderPainel(view);
        }
        if (acao === "ver") verAgendamento(id);
    });
}

// ---------------------------------------------------------------------
// Perfil de atividade da barbearia
// ---------------------------------------------------------------------
function renderPerfil(view, id) {
    const raiz = novaRaiz(view);
    const b = S.barbearia(id);
    if (!b) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Barbearia não encontrada", voltar: { href: "#/atividade", rotulo: "Atividade" } })}
            <section class="card">${estadoVazio({ iconeNome: "store", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const periodo = Number(filtros.periodo);
    const lista = O.filtrarAgendamentos({ periodo, barbeariaId: id });
    const r = O.resumoAgendamentos(lista, 1);
    const comp = O.compararPeriodos({ periodo, barbeariaId: id });
    const alertas = O.alertasAtividade().filter((a) => a.barbeariaId === id);
    const seisMeses = O.filtrarAgendamentos({ periodo: 180, barbeariaId: id });
    const eventos = [
        ...S.historicoDaBarbearia(id),
        ...alertas.map((a) => ({ descricao: `Alerta: ${a.titulo}. ${a.descricao}`, data: new Date().toISOString() }))
    ].sort((x, y) => y.data.localeCompare(x.data));

    renderizar(raiz, html`
        ${cabecalho({
            titulo: b.nome,
            voltar: { href: "#/atividade", rotulo: "Agendamentos e atividade" },
            extra: badgeStatus(STATUS_BARBEARIA, b.status),
            subtitulo: `Perfil de atividade · ${PERIODOS_ATIVIDADE[filtros.periodo]}`,
            acoes: html`
                ${campoSelect({ id: "pPeriodo", rotulo: "Período", valor: filtros.periodo, opcoes: opcoes(PERIODOS_ATIVIDADE) })}
                <a class="btn" href="#/barbearias/${b.id}">${icone("store")}<span>Perfil da barbearia</span></a>`
        })}
        ${avisoDemo()}
        ${alertas.length ? html`<section class="card secao"><div class="card__cabecalho"><h2 class="card__titulo">Alertas desta barbearia</h2></div>${listaAlertas(alertas)}</section>` : ""}
        <section class="grade grade--kpi grade--kpi-5 secao">
            ${kpi({ rotulo: "Agendamentos", valor: numero(r.total), iconeNome: "calendar-days", nota: "Período + agenda futura", destaque: true })}
            ${kpi({ rotulo: "Realizados", valor: numero(r.realizados), iconeNome: "calendar-check", nota: "" })}
            ${kpi({ rotulo: "Cancelamentos", valor: numero(r.cancelados), iconeNome: "calendar-x", nota: `Taxa ${percentual(r.taxaCancelamento)}` })}
            ${kpi({ rotulo: "Pendentes", valor: numero(r.pendentes), iconeNome: "calendar-clock", nota: "Próximos 14 dias" })}
            ${kpi({ rotulo: "Últimos 30 dias", valor: numero(O.agendamentos30Dias(id)), iconeNome: "activity", nota: "Base dos alertas" })}
        </section>
        <div class="grade grade--2 grade--2-igual secao">
            ${cartaoGrafico("Evolução mensal", "Últimos 6 meses", graficoBarras({ dados: paraGrafico(O.seriePorMes(seisMeses)), formatar: formatarAg, formatarEixo: numero, titulo: "Evolução mensal" }))}
            ${cartaoGrafico("Comparação com o período anterior", `${periodo} dias × ${periodo} dias anteriores`, blocoComparacao(comp))}
        </div>
        <div class="grade grade--2 grade--2-igual secao">
            ${cartaoGrafico("Serviços mais utilizados", "No período",
                lista.length ? barrasHorizontais({ itens: O.rankingServicos(lista).map((x) => ({ rotulo: x.servico.nome, valor: x.valor })), formatar: numero, titulo: "Serviços" }) : estadoVazio({ iconeNome: "scissors", titulo: "Sem agendamentos no período" }))}
            ${cartaoGrafico("Horários mais movimentados", "No período",
                lista.length ? graficoBarras({ dados: O.seriePorHora(lista), formatar: formatarAg, formatarEixo: numero, titulo: "Horários" }) : estadoVazio({ iconeNome: "clock", titulo: "Sem agendamentos no período" }))}
        </div>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Histórico de atividade</h2></div>
            <div class="card__corpo">${linhaDoTempo(eventos)}</div>
        </section>`);

    raiz.querySelector("#pPeriodo").addEventListener("change", (e) => { filtros.periodo = e.target.value; renderPerfil(view, id); });
    raiz.addEventListener("click", (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) tratarRestauracaoDemo(() => renderPerfil(view, id));
    });
}

export async function render(view, contexto) {
    // Fora do modo demonstração: dados reais do Supabase (Master + MFA).
    if (!MODO_DEMO) {
        const real = await import("./real.js");
        return real.render(view, contexto);
    }
    const { parametros = [] } = contexto;
    if (parametros[0]) renderPerfil(view, parametros[0]);
    else renderPainel(view);
}
