// =====================================================================
// MÓDULO 01 — VISÃO GERAL (versão inicial da Fase 1)
// Somente dados reais. Indicadores sem fonte aparecem como
// "indisponível" com o motivo — nunca com números de exemplo.
// =====================================================================
import { carregarVisaoGeral } from "../../js/dashboard.js";
import { html, renderizar, icone, $, definirCarregando } from "../../js/utilities/dom.js";
import { numero, moeda, dataHora, tempoRelativo, mesAtual } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { badgeStatus } from "../../js/components/ui.js";
import { STATUS_BARBEARIA } from "../../services/demo/catalogo.js";
import { rotuloAcao, resumoDetalhes } from "../compartilhado/rotulos-auditoria.js";

function kpi({ rotulo, valor, iconeNome, nota }) {
    const indisponivel = valor === null || valor === undefined;
    return html`
        <article class="card kpi ${indisponivel ? "kpi--indisponivel" : ""}">
            <div class="kpi__topo">
                <span>${rotulo}</span>
                <span class="kpi__icone">${icone(iconeNome)}</span>
            </div>
            <div class="kpi__valor num">${indisponivel ? "Indisponível" : numero(valor)}</div>
            <div class="kpi__nota">${nota}</div>
        </article>`;
}

function kpiPendente({ rotulo, iconeNome, motivo }) {
    return html`
        <article class="card kpi kpi--indisponivel">
            <div class="kpi__topo">
                <span>${rotulo}</span>
                <span class="kpi__icone">${icone(iconeNome)}</span>
            </div>
            <div class="kpi__valor">Aguardando integração</div>
            <div class="kpi__nota">${motivo}</div>
        </article>`;
}

function blocoErro(mensagem) {
    return html`
        <div class="alerta alerta--erro">${icone("octagon-alert")}<span>${mensagem}</span></div>`;
}

function secaoPlataforma(resultado) {
    if (resultado.status === "rejected") return blocoErro(resultado.reason?.message ?? "Falha ao carregar indicadores.");
    const p = resultado.value?.plataforma ?? {};
    return html`
        <div class="grade grade--kpi">
            ${kpi({ rotulo: "Barbearias", valor: p.total, iconeNome: "store", nota: "Cadastradas no Barber Control" })}
            ${kpi({ rotulo: "Ativas", valor: p.ativas, iconeNome: "circle-check", nota: "Status ativa" })}
            ${kpi({ rotulo: "Em teste", valor: p.teste, iconeNome: "flask-conical", nota: "Período de avaliação" })}
            ${kpi({ rotulo: "Suspensas", valor: p.suspensas, iconeNome: "circle-pause", nota: "Acesso interrompido" })}
            ${kpi({ rotulo: "Proprietários", valor: p.proprietarios, iconeNome: "user-round", nota: "E-mails distintos informados" })}
        </div>`;
}

function secaoOperacao(resultado, demo = false) {
    if (resultado.status === "rejected") return blocoErro(resultado.reason?.message ?? "Falha ao carregar indicadores.");
    const b = resultado.value?.barber ?? {};
    const notaTabela = (valor, origem) => {
        if (demo) return "Valor fictício";
        return valor === null || valor === undefined ? `Tabela ${origem} não pôde ser lida` : `Fonte: ${origem}`;
    };
    return html`
        <div class="grade grade--kpi">
            ${kpi({ rotulo: "Barbeiros", valor: b.barbeiros, iconeNome: "scissors", nota: notaTabela(b.barbeiros, "BARBEIROS") })}
            ${kpi({ rotulo: "Clientes", valor: b.clientes, iconeNome: "users", nota: notaTabela(b.clientes, "clientes") })}
            ${kpi({ rotulo: "Agendamentos no mês", valor: b.agendamentos_mes, iconeNome: "calendar-check", nota: notaTabela(b.agendamentos_mes, "agendamentos") })}
            ${kpi({ rotulo: "Cancelamentos no mês", valor: b.cancelamentos_mes, iconeNome: "calendar-x", nota: notaTabela(b.cancelamentos_mes, "agendamentos.status") })}
            ${b.agendamentos_hoje !== undefined ? kpi({ rotulo: "Agendamentos hoje", valor: b.agendamentos_hoje, iconeNome: "calendar-clock", nota: demo ? "Valor fictício" : "Sem os cancelados" }) : ""}
        </div>`;
}

function kpiMoeda({ rotulo, valor, iconeNome, nota }) {
    return html`
        <article class="card kpi">
            <div class="kpi__topo"><span>${rotulo}</span><span class="kpi__icone">${icone(iconeNome)}</span></div>
            <div class="kpi__valor num">${moeda(valor)}</div>
            <div class="kpi__nota">${nota}</div>
        </article>`;
}

function secaoFinanceiro(resultado) {
    if (resultado?.status === "fulfilled" && resultado.value) {
        const f = resultado.value;
        return html`
        <div class="grade grade--kpi">
            ${kpiMoeda({ rotulo: "Receita recorrente mensal", valor: f.mrr, iconeNome: "trending-up", nota: `Anual: ${moeda(Number(f.mrr) * 12)}` })}
            ${kpiMoeda({ rotulo: "Recebido no mês", valor: f.recebido_mes, iconeNome: "wallet", nota: `Taxas: ${moeda(f.taxas_mes)}` })}
            ${kpiMoeda({ rotulo: "A vencer", valor: f.em_aberto, iconeNome: "hourglass", nota: "Faturas em aberto no prazo" })}
            ${kpiMoeda({ rotulo: "Vencido", valor: f.vencido, iconeNome: "alarm-clock", nota: `${numero(f.faturas_vencidas)} fatura(s) · ver Financeiro` })}
        </div>`;
    }
    const motivo = resultado?.status === "rejected" ? "Aplique a migração 10 (cobrança)" : "Mercado Pago";
    return html`
        <div class="grade grade--kpi">
            ${kpiPendente({ rotulo: "Receita recorrente mensal", iconeNome: "trending-up", motivo })}
            ${kpiPendente({ rotulo: "Receita recorrente anual", iconeNome: "calendar-range", motivo })}
            ${kpiPendente({ rotulo: "Pagamentos pendentes", iconeNome: "hourglass", motivo })}
        </div>`;
}

function cardAtividades(resultado) {
    let corpo;
    if (resultado.status === "rejected") {
        corpo = html`<div class="card__corpo">${blocoErro(resultado.reason?.message ?? "Falha ao carregar a auditoria.")}</div>`;
    } else if (!resultado.value?.length) {
        corpo = html`<div class="estado"><div class="estado__icone">${icone("scroll-text")}</div>
            <h3>Nenhuma atividade registrada</h3><p>Os eventos de acesso aparecem aqui assim que forem auditados.</p></div>`;
    } else {
        corpo = html`<ul class="lista">
            ${resultado.value.map((item) => {
                const rotulo = rotuloAcao(item.acao);
                const resumo = resumoDetalhes(item);
                return html`
                    <li class="lista__item">
                        <span class="lista__icone">${icone(rotulo.icone)}</span>
                        <div class="lista__conteudo">
                            <div class="lista__titulo">${rotulo.texto}</div>
                            <div class="lista__meta">${item.ator_email ?? "sistema"}${resumo ? ` · ${resumo}` : ""}${item.ip ? ` · IP ${item.ip}` : ""}</div>
                        </div>
                        <time class="lista__meta" datetime="${item.ocorrido_em}" title="${dataHora(item.ocorrido_em)}">${tempoRelativo(item.ocorrido_em)}</time>
                    </li>`;
            })}
        </ul>`;
    }
    return html`
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Atividade recente</h2>
                <a class="badge" href="#/auditoria">Ver auditoria</a>
            </div>
            ${corpo}
        </section>`;
}

function linhaIntegracao({ nome, descricao, estado }) {
    const estilos = {
        ok: { classe: "badge--sucesso", texto: "Operacional" },
        erro: { classe: "badge--erro", texto: "Falha" },
        pendente: { classe: "badge--atencao", texto: "Não configurado" }
    }[estado];
    return html`
        <li class="lista__item">
            <div class="lista__conteudo">
                <div class="lista__titulo">${nome}</div>
                <div class="lista__meta">${descricao}</div>
            </div>
            <span class="badge ${estilos.classe}"><span class="ponto"></span>${estilos.texto}</span>
        </li>`;
}

function cardIntegracoes(dados) {
    if (dados.demo) {
        return html`
            <section class="card">
                <div class="card__cabecalho">
                    <h2 class="card__titulo">Integrações</h2>
                    <span class="badge badge--atencao">Demonstração</span>
                </div>
                <div class="estado">
                    <div class="estado__icone">${icone("plug-zap")}</div>
                    <h3>Integrações não verificadas</h3>
                    <p>No modo demonstração o painel não se conecta ao Supabase nem às Edge Functions.</p>
                </div>
            </section>`;
    }
    const banco = dados.resumo.status === "fulfilled";
    const funcao = dados.servidor.status === "fulfilled" && dados.servidor.value?.ok;
    return html`
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Integrações</h2>
                <span class="badge num">${dados.latenciaMs} ms</span>
            </div>
            <ul class="lista">
                ${linhaIntegracao({
                    nome: "Banco de dados (control_api)",
                    descricao: banco ? "RPCs protegidas por administrador + MFA" : (dados.resumo.reason?.message ?? "Sem resposta"),
                    estado: banco ? "ok" : "erro"
                })}
                ${linhaIntegracao({
                    nome: "Edge Function control-admin",
                    descricao: funcao ? `Versão ${dados.servidor.value.versao}` : (dados.servidor.reason?.message ?? "Sem resposta"),
                    estado: funcao ? "ok" : "erro"
                })}
                ${(() => {
                    const metodos = dados.financeiro?.status === "fulfilled" ? (dados.financeiro.value?.por_metodo ?? {}) : {};
                    const viaMp = ["pix", "cartao", "boleto"].some((m) => Number(metodos[m]) > 0);
                    return linhaIntegracao({
                        nome: "Mercado Pago",
                        descricao: viaMp ? "Pagamentos confirmados pelo webhook" : "Aguardando o primeiro pagamento online (função cobranca + Secrets)",
                        estado: viaMp ? "ok" : "pendente"
                    });
                })()}
            </ul>
        </section>`;
}

async function montar(container, contexto) {
    const dados = await carregarVisaoGeral();
    const geradoEm = dados.resumo.status === "fulfilled" ? dados.resumo.value?.gerado_em : null;

    renderizar(container, html`
        <header class="pagina-cabecalho">
            <div>
                <h1>Visão geral</h1>
                <p>${geradoEm ? `Atualizado ${tempoRelativo(geradoEm)} · ${dataHora(geradoEm)}` : "Indicadores da plataforma Barber"}</p>
            </div>
            <button class="btn" type="button" id="btnAtualizar">${icone("refresh-cw")}<span class="btn__texto-opcional">Atualizar</span></button>
        </header>

        <section class="secao">
            <div class="secao__cabecalho"><h2 class="secao__titulo">Plataforma</h2></div>
            ${secaoPlataforma(dados.resumo)}
        </section>

        <section class="secao">
            <div class="secao__cabecalho">
                <h2 class="secao__titulo">Operação · ${mesAtual()}</h2>
                ${dados.demo
                    ? html`<span class="badge badge--atencao">Dados fictícios</span>`
                    : html`<span class="badge badge--ouro">Dados reais · todas as barbearias</span>`}
            </div>
            ${secaoOperacao(dados.resumo, dados.demo)}
        </section>

        ${dados.resumo.status === "fulfilled" && Array.isArray(dados.resumo.value?.por_barbearia) ? html`
        <section class="secao">
            <div class="secao__cabecalho"><h2 class="secao__titulo">Por barbearia · ${mesAtual()}</h2><a class="badge" href="#/atividade">Ver atividade</a></div>
            <section class="card"><div data-por-barbearia></div></section>
        </section>` : ""}

        ${dados.suporte?.status === "fulfilled" && dados.suporte.value ? html`
        <section class="secao">
            <div class="secao__cabecalho"><h2 class="secao__titulo">Suporte e comunicados</h2><a class="badge" href="#/suporte">Abrir suporte</a></div>
            <div class="grade grade--kpi">
                ${kpi({ rotulo: "Chamados sem resposta", valor: dados.suporte.value.nao_lidos, iconeNome: "mail-warning", nota: "Mensagens novas das barbearias" })}
                ${kpi({ rotulo: "Chamados em andamento", valor: dados.suporte.value.abertos, iconeNome: "life-buoy", nota: `${numero(dados.suporte.value.criticos)} com prioridade alta` })}
                ${kpi({ rotulo: "Comunicados no ar", valor: dados.suporte.value.comunicados_no_ar, iconeNome: "megaphone", nota: "Aparecendo nos painéis" })}
            </div>
        </section>` : ""}

        <section class="secao">
            <div class="secao__cabecalho"><h2 class="secao__titulo">Financeiro</h2></div>
            ${secaoFinanceiro(dados.financeiro)}
        </section>

        <div class="grade grade--2">
            ${cardAtividades(dados.atividades)}
            ${cardIntegracoes(dados)}
        </div>
    `);

    const alvo = container.querySelector("[data-por-barbearia]");
    if (alvo) {
        const tabela = criarTabela({
            colunas: [
                { chave: "nome", rotulo: "Barbearia", render: (b) => html`<a class="link-forte" href="#/barbearias/${b.id}">${b.nome}</a><span class="celula-sub">?b=${b.slug}</span>` },
                { chave: "status", rotulo: "Status", valor: (b) => STATUS_BARBEARIA[b.status]?.rotulo, render: (b) => badgeStatus(STATUS_BARBEARIA, b.status) },
                { chave: "barbeiros", rotulo: "Barbeiros", classe: "col-num", valor: (b) => Number(b.barbeiros), render: (b) => numero(b.barbeiros) },
                { chave: "clientes", rotulo: "Clientes", classe: "col-num", valor: (b) => Number(b.clientes), render: (b) => numero(b.clientes) },
                { chave: "agendamentos_mes", rotulo: "Agend. no mês", classe: "col-num", valor: (b) => Number(b.agendamentos_mes), render: (b) => numero(b.agendamentos_mes) },
                { chave: "cancelamentos_mes", rotulo: "Cancel. no mês", classe: "col-num", valor: (b) => Number(b.cancelamentos_mes), render: (b) => numero(b.cancelamentos_mes) },
                { chave: "ultimo_agendamento", rotulo: "Último agendamento", valor: (b) => b.ultimo_agendamento ?? "", render: (b) => (b.ultimo_agendamento ? tempoRelativo(b.ultimo_agendamento) : "Nenhum") }
            ],
            ordenacao: { chave: "agendamentos_mes", direcao: "desc" }, vazio: "Nenhuma barbearia cadastrada.", rotulo: "Barbearias"
        });
        alvo.appendChild(tabela.elemento);
        tabela.definirLinhas(dados.resumo.value.por_barbearia);
    }

    $("#btnAtualizar", container).addEventListener("click", async (evento) => {
        const botao = evento.currentTarget;
        definirCarregando(botao, true, "Atualizando…");
        try {
            await montar(container, contexto);
            mostrarToast("Indicadores atualizados.", "sucesso", 2500);
        } catch (erro) {
            definirCarregando(botao, false);
            mostrarToast(erro.message || "Falha ao atualizar.", "erro");
        }
    });
}

export async function render(container, contexto) {
    await montar(container, contexto);
}
