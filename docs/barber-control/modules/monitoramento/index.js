// =====================================================================
// MÓDULO 11 — MONITORAMENTO TÉCNICO (modo demonstrativo)
// Rotas: #/monitoramento[/servicos|barbearias|incidentes]
//        #/monitoramento/servico/<id>  ·  #/monitoramento/incidente/<id>
// Nenhuma ferramenta de monitoramento está conectada: disponibilidade,
// latência, consumo e status são fictícios e identificados como tal.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import * as I from "../../services/demo/infra.js";
import { STATUS_SERVICO, GRAVIDADES, STATUS_INCIDENTE, STATUS_BARBEARIA, NIVEIS_ATIVIDADE } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, percentual, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { graficoBarras, graficoLinha } from "../../js/components/grafico.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, kpi, badgeStatus, estadoVazio, listaDefinicao, linhaDoTempo, campoSelect, molduraComAbas, novaRaiz
} from "../../js/components/ui.js";
import * as Inc from "../compartilhado/incidentes.js";
import * as Al from "../compartilhado/alertas.js";

const SECOES = [["", "Visão geral"], ["servicos", "Status dos serviços"], ["barbearias", "Por barbearia"], ["incidentes", "Incidentes técnicos"]];
const estado = { dias: "30", barbeariaId: "" };

const fmtPct = (v) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const fmtMs = (v) => (v === null || v === undefined ? "—" : `${numero(Math.round(v))} ms`);
const fmtMb = (v) => (v === null || v === undefined ? "—" : v >= 1024 ? `${(v / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB` : `${numero(Math.round(v))} MB`);
const rotuloDia = (d) => d.data.split("-").reverse().slice(0, 2).join("/");
const rotuloLongo = (d) => d.data.split("-").reverse().join("/");

function avisoMonitoramento() {
    return html`<div class="alerta alerta--info">${icone("info")}<span><strong>Indicadores demonstrativos.</strong> Nenhuma ferramenta de monitoramento está conectada: disponibilidade, latência, consumo e status abaixo são fictícios. A estrutura está pronta para receber métricas reais do Supabase e de ferramentas de monitoramento.</span></div>`;
}

function kpis() {
    const r = I.resumoMonitoramento(estado.dias);
    const tempos = I.servicos().filter((s) => s.tempoRespostaMs);
    const tempoMedio = tempos.reduce((s, x) => s + x.tempoRespostaMs, 0) / Math.max(1, tempos.length);
    return html`
        ${kpi({ rotulo: "Disponibilidade", valor: fmtPct(r.disponibilidade), iconeNome: "activity", nota: `Média de ${estado.dias} dias (demo)`, destaque: true })}
        ${kpi({ rotulo: "Tempo médio de resposta", valor: fmtMs(tempoMedio), iconeNome: "timer", nota: "Última verificação dos serviços (demo)" })}
        ${kpi({ rotulo: "Latência média", valor: fmtMs(r.latenciaMedia), iconeNome: "gauge", nota: `Pico de ${fmtMs(r.latenciaPico)} (demo)` })}
        ${kpi({ rotulo: "Requisições", valor: numero(r.requisicoes), iconeNome: "arrow-left-right", nota: `${estado.dias} dias (demo)` })}
        ${kpi({ rotulo: "Erros", valor: numero(r.erros), iconeNome: "bug", nota: `Taxa de ${percentual(r.taxaErro, 2)} (demo)` })}
        ${kpi({ rotulo: "Armazenamento", valor: fmtMb(r.armazenamentoMb), iconeNome: "hard-drive", nota: `Banco: ${fmtMb(r.bancoMb)} (demo)` })}
        ${kpi({ rotulo: "Integrações externas conectadas", valor: "Nenhuma", iconeNome: "plug-zap", nota: "Mercado Pago e monitoramento pendentes" })}
        ${kpi({ rotulo: "Incidentes técnicos", valor: numero(r.incidentesAbertos), iconeNome: "siren", nota: "Em aberto" })}`;
}

function cartao(titulo, nota, conteudo) {
    return html`
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">${titulo}</h2>${nota ? html`<span class="texto-terc">${nota}</span>` : ""}</div>
            <div class="card__corpo">${conteudo}</div>
        </section>`;
}

// ---------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------
function secaoVisao({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        ${avisoMonitoramento()}
        <div class="barra-filtros barra-filtros--solta">
            ${campoSelect({ id: "fMonDias", rotulo: "Período", valor: estado.dias, opcoes: [["7", "Últimos 7 dias"], ["14", "Últimos 14 dias"], ["30", "Últimos 30 dias"]] })}
        </div>
        <div data-graficos></div>`);
    const desenhar = () => {
        const m = I.metricasPeriodo(estado.dias);
        const serie = (campo, fn = (x) => x) => m.map((d) => ({ rotulo: rotuloDia(d), rotuloLongo: rotuloLongo(d), valor: fn(d[campo]) }));
        const incidentes = I.incidentes("tecnico").slice().sort((a, b) => b.abertoEm.localeCompare(a.abertoEm)).slice(0, 6);
        renderizar(secao.querySelector("[data-graficos]"), html`
            <div class="grade grade--2 grade--2-igual secao">
                ${cartao("Disponibilidade ao longo do tempo", "% por dia · demo", graficoLinha({ dados: serie("disponibilidade"), formatar: fmtPct, formatarEixo: (v) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, dominio: [98.5, 100], titulo: "Disponibilidade" }))}
                ${cartao("Evolução da latência", "ms por dia · demo", graficoLinha({ dados: serie("latenciaMs"), formatar: fmtMs, formatarEixo: (v) => `${Math.round(v)}`, titulo: "Latência" }))}
            </div>
            <div class="grade grade--2 grade--2-igual secao">
                ${cartao("Volume de requisições", "por dia · demo", graficoBarras({ dados: serie("requisicoes"), formatar: (v) => `${numero(v)} requisições`, formatarEixo: (v) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : numero(v)), titulo: "Requisições" }))}
                ${cartao("Erros por período", "por dia · demo", graficoBarras({ dados: serie("erros"), formatar: (v) => `${numero(v)} erros`, formatarEixo: numero, tom: "erro", titulo: "Erros" }))}
            </div>
            <div class="grade grade--2 grade--2-igual">
                ${cartao("Consumo de armazenamento", "MB · demo", graficoLinha({ dados: serie("armazenamentoMb"), formatar: fmtMb, formatarEixo: (v) => numero(Math.round(v)), titulo: "Armazenamento", tom: "neutro" }))}
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Histórico de incidentes</h2><a class="btn btn--pequeno" href="#/monitoramento/incidentes">Central</a></div>
                    ${incidentes.length ? html`<ul class="lista">${incidentes.map((i) => html`
                        <li class="lista__item">
                            <div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/monitoramento/incidente/${i.id}">${i.codigo} · ${i.titulo}</a>
                                <div class="lista__meta">${I.servico(`sv_${i.servico}`)?.nome ?? "—"} · ${tempoRelativo(i.abertoEm)}</div></div>
                            ${badgeStatus(STATUS_INCIDENTE, i.status)}
                        </li>`)}</ul>` : estadoVazio({ iconeNome: "check", titulo: "Nenhum incidente" })}
                </section>
            </div>
            <section class="card secao-topo">
                <div class="card__cabecalho"><h2 class="card__titulo">Alertas de monitoramento abertos</h2><a class="btn btn--pequeno" href="#/seguranca/alertas">Central de alertas</a></div>
                ${Al.resumoAlertas(I.alertasAbertos((a) => a.categoria === "monitoramento"))}
            </section>`);
    };
    desenhar();
    secao.querySelector("#fMonDias").addEventListener("change", (e) => { estado.dias = e.target.value; desenhar(); atualizarIndicadores(); });
}

// ---------------------------------------------------------------------
// Status dos serviços
// ---------------------------------------------------------------------
function miniHistorico(s) {
    if (!s.historico.length) return html`<span class="texto-terc texto-pequeno">Sem histórico: serviço não monitorado.</span>`;
    return html`<div class="mini-historico" role="img" aria-label="Disponibilidade dos últimos 14 dias (demonstrativo)">
        ${s.historico.map((h) => html`<span class="mini-historico__dia ${h.disponibilidade < 99.5 ? "is-falha" : h.disponibilidade < 99.9 ? "is-atencao" : ""}"
            title="${new Date(h.data).toLocaleDateString("pt-BR")}: ${fmtPct(h.disponibilidade)}"></span>`)}
    </div>`;
}

function secaoServicos({ secao, atualizarIndicadores }) {
    const desenhar = () => renderizar(secao, html`
        ${avisoMonitoramento()}
        <div class="grade grade--servicos">
            ${I.servicos().map((s) => html`
                <article class="card servico-card servico-card--${s.status}">
                    <div class="card__cabecalho">
                        <h3 class="card__titulo"><a class="link-forte" href="#/monitoramento/servico/${s.id}">${s.nome}</a></h3>
                        ${badgeStatus(STATUS_SERVICO, s.status)}
                    </div>
                    <div class="card__corpo">
                        <p class="texto-terc texto-pequeno">${s.descricao}</p>
                        ${listaDefinicao([
                            ["Última verificação", s.ultimaVerificacao ? `${tempoRelativo(s.ultimaVerificacao)} (demo)` : "Nunca"],
                            ["Tempo de resposta", s.tempoRespostaMs ? `${fmtMs(s.tempoRespostaMs)} (demo)` : "—"]
                        ])}
                        ${miniHistorico(s)}
                        <div class="acoes-cartao">
                            <a class="btn btn--pequeno" href="#/monitoramento/servico/${s.id}">${icone("eye")}<span>Detalhes</span></a>
                            ${s.status !== "nao_monitorado" ? html`<button class="btn btn--pequeno btn--fantasma" type="button" data-verificar="${s.id}">${icone("refresh-cw")}<span>Verificar (simulação)</span></button>` : ""}
                        </div>
                    </div>
                </article>`)}
        </div>`);
    desenhar();
    secao.addEventListener("click", (e) => {
        const b = e.target.closest("[data-verificar]");
        if (!b) return;
        try { I.verificarServico(b.dataset.verificar); mostrarToast("Verificação simulada registrada (nenhuma chamada real).", "sucesso"); desenhar(); atualizarIndicadores(); }
        catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

function renderServico(view, id) {
    const raiz = novaRaiz(view);
    const s = I.servico(id);
    const voltar = { href: "#/monitoramento/servicos", rotulo: "Status dos serviços" };
    if (!s) {
        renderizar(raiz, html`${cabecalho({ titulo: "Serviço não encontrado", voltar })}<section class="card">${estadoVazio({ iconeNome: "server", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const incidentes = I.incidentes("tecnico").filter((i) => i.servico === s.chave);
    const alertas = I.alertas().filter((a) => a.referencia?.tipo === "servico" && a.referencia.id === s.id);
    const media = s.historico.length ? s.historico.reduce((t, h) => t + h.disponibilidade, 0) / s.historico.length : null;
    renderizar(raiz, html`
        ${cabecalho({
            titulo: s.nome, voltar, extra: badgeStatus(STATUS_SERVICO, s.status), subtitulo: s.descricao,
            acoes: s.status !== "nao_monitorado" ? html`<button class="btn" type="button" data-verificar>${icone("refresh-cw")}<span>Verificar (simulação)</span></button>` : ""
        })}
        ${avisoDemo()}
        ${avisoMonitoramento()}
        ${s.status === "nao_monitorado" ? html`<div class="alerta alerta--erro">${icone("plug-zap")}<span>Serviço sem monitoramento: nenhuma integração está configurada. Status e tempo de resposta só existirão depois da integração.</span></div>` : ""}
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Status", valor: STATUS_SERVICO[s.status].rotulo, iconeNome: "server", nota: "Demonstrativo" })}
            ${kpi({ rotulo: "Disponibilidade (14 dias)", valor: media === null ? "—" : fmtPct(media), iconeNome: "activity", nota: "Demonstrativo" })}
            ${kpi({ rotulo: "Tempo de resposta", valor: fmtMs(s.tempoRespostaMs), iconeNome: "timer", nota: "Última verificação (demo)" })}
            ${kpi({ rotulo: "Última verificação", valor: s.ultimaVerificacao ? tempoRelativo(s.ultimaVerificacao) : "Nunca", iconeNome: "clock", nota: s.ultimaVerificacao ? dataHora(s.ultimaVerificacao) : "" })}
        </section>
        <div class="grade grade--2 secao">
            ${cartao("Histórico de disponibilidade", "14 dias · demo", s.historico.length
                ? graficoLinha({ dados: s.historico.map((h) => ({ rotulo: new Date(h.data).toLocaleDateString("pt-BR").slice(0, 5), rotuloLongo: new Date(h.data).toLocaleDateString("pt-BR"), valor: h.disponibilidade })), formatar: fmtPct, formatarEixo: (v) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, dominio: [98.5, 100], titulo: "Disponibilidade do serviço" })
                : estadoVazio({ iconeNome: "plug-zap", titulo: "Sem dados", texto: "Serviço não monitorado." }))}
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Incidentes do serviço</h2><span class="badge">${numero(incidentes.length)}</span></div>
                ${incidentes.length ? html`<ul class="lista">${incidentes.map((i) => html`
                    <li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/monitoramento/incidente/${i.id}">${i.codigo} · ${i.titulo}</a>
                    <div class="lista__meta">${tempoRelativo(i.abertoEm)}</div></div>${badgeStatus(GRAVIDADES, i.gravidade)}</li>`)}</ul>` : estadoVazio({ iconeNome: "check", titulo: "Nenhum incidente" })}
            </section>
        </div>
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Alertas</h2></div>
                ${Al.resumoAlertas(alertas, "Nenhum alerta para este serviço.")}
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                <div class="card__corpo">${linhaDoTempo(I.historicoDe("servico", s.id), "Nenhuma verificação registrada.")}</div>
            </section>
        </div>`);
    raiz.addEventListener("click", (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) return tratarRestauracaoDemo(() => renderServico(view, id));
        if (!e.target.closest("[data-verificar]")) return;
        try { I.verificarServico(id); mostrarToast("Verificação simulada registrada (nenhuma chamada real).", "sucesso"); renderServico(view, id); }
        catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

// ---------------------------------------------------------------------
// Por barbearia
// ---------------------------------------------------------------------
function secaoBarbearias({ secao }) {
    const empresas = [...S.barbearias()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    renderizar(secao, html`
        ${avisoMonitoramento()}
        <div class="barra-filtros barra-filtros--solta">
            ${campoSelect({ id: "fMonBarbearia", rotulo: "Barbearia", valor: estado.barbeariaId, opcoes: [["", "Selecione uma barbearia"], ...empresas.map((b) => [b.id, b.nome])] })}
        </div>
        <div data-painel></div>`);
    const desenhar = () => {
        const alvo = secao.querySelector("[data-painel]");
        if (!estado.barbeariaId) {
            renderizar(alvo, html`<section class="card">${estadoVazio({ iconeNome: "store", titulo: "Selecione uma barbearia", texto: "Veja atividade, requisições, erros, utilização, histórico técnico e alertas da empresa." })}</section>`);
            return;
        }
        const m = I.monitoramentoBarbearia(estado.barbeariaId);
        const eventos = [
            ...m.incidentes.map((i) => ({ descricao: `Incidente ${i.codigo}: ${i.titulo}`, data: i.abertoEm })),
            ...m.chamadosTecnicos.map((c) => ({ descricao: `Chamado técnico ${c.protocolo}: ${c.titulo}`, data: c.abertoEm }))
        ].sort((a, b) => b.data.localeCompare(a.data));
        renderizar(alvo, html`
            <div class="pagina-cabecalho pagina-cabecalho--secao">
                <div class="pagina-cabecalho__titulo"><h2>${m.barbearia.nome}</h2>${badgeStatus(STATUS_BARBEARIA, m.barbearia.status)}</div>
                <div class="pagina-cabecalho__acoes">
                    <a class="btn btn--pequeno" href="#/barbearias/${m.barbearia.id}">${icone("store")}<span>Barbearia</span></a>
                    <a class="btn btn--pequeno" href="#/atividade/${m.barbearia.id}">${icone("calendar-clock")}<span>Atividade</span></a>
                </div>
            </div>
            <section class="grade grade--kpi secao">
                ${kpi({ rotulo: "Atividade (30 dias)", valor: numero(m.metricas.ag30), iconeNome: "calendar-check", nota: NIVEIS_ATIVIDADE[m.metricas.nivelAtividade] })}
                ${kpi({ rotulo: "Requisições (30 dias)", valor: numero(m.requisicoesTotal), iconeNome: "arrow-left-right", nota: "Estimativa demonstrativa" })}
                ${kpi({ rotulo: "Erros registrados", valor: numero(m.errosRegistrados), iconeNome: "bug", nota: "Demonstrativo" })}
                ${kpi({ rotulo: "Utilização do plano", valor: m.metricas.utilizacao === null ? "Ilimitado" : percentual(m.metricas.utilizacao, 0), iconeNome: "gauge", nota: m.metricas.plano?.nome ?? "—" })}
            </section>
            <div class="grade grade--2 secao">
                ${cartao("Requisições por dia", "Estimadas a partir dos agendamentos · demo", graficoBarras({ dados: m.requisicoes, formatar: (v) => `${numero(v)} requisições`, formatarEixo: numero, titulo: "Requisições por dia" }))}
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Alertas associados</h2></div>
                    ${Al.resumoAlertas(m.alertas, "Nenhum alerta técnico ou de segurança.")}
                    ${m.alertasAtividade.length ? html`<div class="card__corpo"><p class="texto-terc texto-pequeno">Alertas de atividade (módulo 06): ${m.alertasAtividade.map((a) => a.titulo).join(", ")}.</p></div>` : ""}
                </section>
            </div>
            ${cartao("Histórico técnico", "Incidentes e chamados técnicos", linhaDoTempo(eventos, "Nenhum registro técnico para esta barbearia."))}`);
    };
    desenhar();
    secao.querySelector("#fMonBarbearia").addEventListener("change", (e) => { estado.barbeariaId = e.target.value; desenhar(); });
}

const RENDER = { "": secaoVisao, servicos: secaoServicos, barbearias: secaoBarbearias, incidentes: (ctx) => Inc.renderLista(ctx.secao, "tecnico", ctx.atualizarIndicadores) };

export function render(view, { parametros = [] }) {
    const [primeiro, segundo] = parametros;
    if (primeiro === "servico" && segundo) return renderServico(view, segundo);
    if (primeiro === "incidente" && segundo) return Inc.renderDetalhe(view, "tecnico", segundo);
    const ativa = SECOES.some(([r]) => r === primeiro) ? primeiro : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Monitoramento técnico", subtitulo: "Disponibilidade, desempenho, serviços e incidentes da plataforma", base: "#/monitoramento",
        secoes: SECOES, ativa, kpis, recarregar,
        acoes: html`<button class="btn btn--primario" type="button" data-topo="incidente">${icone("siren")}<span>Registrar incidente técnico</span></button>`
    });
    ctx.raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-topo=incidente]")) await Inc.registrar("tecnico");
    });
    RENDER[ativa](ctx);
}
