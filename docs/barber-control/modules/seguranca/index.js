// =====================================================================
// MÓDULO 10 — SEGURANÇA (modo demonstrativo)
// Rotas: #/seguranca[/autenticacao|acessos|incidentes|permissoes|verificacao|alertas]
//        #/seguranca/incidente/<id>  ·  #/seguranca/alerta/<id>
// Nenhum controle aqui protege algo de verdade: eventos, sessões e
// permissões são fictícios. A verificação de segurança mostra a
// situação REAL do projeto (nada verificado em produção ainda).
// =====================================================================
import * as S from "../../services/demo/saas.js";
import * as I from "../../services/demo/infra.js";
import {
    TIPOS_EVENTO_AUTH, RESULTADOS_EVENTO, STATUS_EVENTO, STATUS_SESSAO, PERFIS_ADMIN, RECURSOS_ADMIN, ACOES_PERMISSAO,
    STATUS_VERIFICACAO, TIPOS_USUARIO, opcoes
} from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, dataHora, tempoRelativo, data } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { montarAbas } from "../../js/components/abas.js";
import { graficoBarras } from "../../js/components/grafico.js";
import { kpi, badgeStatus, estadoVazio, linhaDoTempo, botaoIcone, campoBusca, campoSelect, molduraComAbas } from "../../js/components/ui.js";
import * as Inc from "../compartilhado/incidentes.js";
import * as Al from "../compartilhado/alertas.js";

const SECOES = [
    ["", "Visão geral"], ["autenticacao", "Autenticação"], ["acessos", "Acessos"], ["incidentes", "Incidentes"],
    ["permissoes", "Permissões"], ["verificacao", "Verificação"], ["alertas", "Alertas"]
];
const filtrosEventos = { busca: "", tipo: "", resultado: "", dias: "14" };
const estadoPermissoes = { perfil: "", visao: "lista" };
let abaAcessos = "sessoes";
let usuarioHistorico = "";

function kpis() {
    const r = I.resumoSeguranca();
    return html`
        ${kpi({ rotulo: "Indicador de segurança", valor: `${r.indice}/100`, iconeNome: "shield", nota: "Demonstrativo: não mede proteção real", destaque: true })}
        ${kpi({ rotulo: "Tentativas de login (24 h)", valor: numero(r.tentativas24h), iconeNome: "log-in", nota: `${numero(r.recusadas24h)} recusadas` })}
        ${kpi({ rotulo: "Tentativas suspeitas", valor: numero(r.suspeitas), iconeNome: "shield-alert", nota: "Últimos 14 dias" })}
        ${kpi({ rotulo: "Incidentes registrados", valor: numero(r.incidentes), iconeNome: "siren", nota: `${numero(r.incidentesAbertos)} em aberto` })}
        ${kpi({ rotulo: "Incidentes críticos", valor: numero(r.criticos), iconeNome: "octagon-alert", nota: "Em aberto" })}
        ${kpi({ rotulo: "Sessões administrativas", valor: numero(r.sessoesAtivas), iconeNome: "monitor-smartphone", nota: "Ativas (demonstrativas)" })}
        ${kpi({ rotulo: "Alertas pendentes", valor: numero(r.alertasPendentes), iconeNome: "bell-ring", nota: "Segurança" })}
        ${kpi({ rotulo: "Sem verificação real", valor: `${r.verificacoesPendentes}/7`, iconeNome: "clipboard-list", nota: "Itens da verificação de segurança" })}`;
}

const origem = (e) => html`${e.origem.ip}<span class="celula-sub">${e.origem.cidade} · ${e.origem.dispositivo}</span>`;

const COLUNAS_EVENTOS = [
    { chave: "id", rotulo: "Evento", render: (e) => html`<span class="num">${e.id}</span><span class="celula-sub">${e.sistema}</span>` },
    {
        chave: "usuarioNome", rotulo: "Usuário",
        render: (e) => (e.usuarioId ? html`<a class="link-forte" href="#/usuarios/${e.usuarioId}">${e.usuarioNome}</a>` : html`${e.usuarioNome}<span class="celula-sub">administrador</span>`)
    },
    { chave: "data", rotulo: "Data e horário", render: (e) => dataHora(e.data) },
    { chave: "tipo", rotulo: "Tipo", valor: (e) => TIPOS_EVENTO_AUTH[e.tipo].rotulo, render: (e) => html`<span class="com-icone">${icone(TIPOS_EVENTO_AUTH[e.tipo].icone)}${TIPOS_EVENTO_AUTH[e.tipo].rotulo}</span>` },
    { chave: "origem", rotulo: "Origem (fictícia)", valor: (e) => e.origem.ip, render: origem },
    { chave: "resultado", rotulo: "Resultado", valor: (e) => e.resultado, render: (e) => badgeStatus(RESULTADOS_EVENTO, e.resultado) },
    { chave: "status", rotulo: "Status", valor: (e) => e.status, render: (e) => badgeStatus(STATUS_EVENTO, e.status) },
    {
        chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes",
        render: (e) => (e.status === "revisado" ? "" : botaoIcone({ acao: "revisar-evento", id: e.id, nomeIcone: "check-check", rotulo: `Marcar ${e.id} como revisado` }))
    }
];

function tabelaEventos(container, linhas, rotulo, porPagina = 12) {
    const tabela = criarTabela({ colunas: COLUNAS_EVENTOS, ordenacao: { chave: "data", direcao: "desc" }, porPagina, vazio: "Nenhum evento encontrado.", rotulo });
    container.appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());
    container.addEventListener("click", (e) => {
        const b = e.target.closest("[data-acao=revisar-evento]");
        if (!b) return;
        try { I.revisarEvento(b.dataset.id); mostrarToast("Evento marcado como revisado.", "sucesso"); tabela.atualizarLinhas(linhas()); }
        catch (falha) { mostrarToast(falha.message, "erro"); }
    });
    return tabela;
}

// ---------------------------------------------------------------------
// Seções
// ---------------------------------------------------------------------
function secaoVisao({ secao }) {
    const dias = [];
    const hoje = new Date();
    for (let d = 13; d >= 0; d--) {
        const ref = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - d);
        dias.push({ chave: ref.toDateString(), rotulo: `${String(ref.getDate()).padStart(2, "0")}/${String(ref.getMonth() + 1).padStart(2, "0")}`, valor: 0 });
    }
    const porDia = new Map(dias.map((d) => [d.chave, d]));
    I.eventos().forEach((e) => {
        if (e.tipo !== "login_recusado" && e.tipo !== "suspeita") return;
        const alvo = porDia.get(new Date(e.data).toDateString());
        if (alvo) alvo.valor++;
    });
    const recentes = I.eventos().slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
    const verif = I.verificacoes();
    renderizar(secao, html`
        <div class="grade grade--2 grade--2-igual secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Logins recusados e suspeitos por dia</h2><span class="texto-terc">Últimos 14 dias</span></div>
                <div class="card__corpo">${graficoBarras({ dados: dias, formatar: (v) => `${numero(v)} tentativas`, formatarEixo: numero, tom: "erro", titulo: "Logins recusados por dia" })}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Alertas de segurança abertos</h2><a class="btn btn--pequeno" href="#/seguranca/alertas">Central</a></div>
                ${Al.resumoAlertas(I.alertasAbertos((a) => a.categoria === "seguranca"))}
            </section>
        </div>
        <div class="grade grade--2 grade--2-igual">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Histórico de eventos</h2><a class="btn btn--pequeno" href="#/seguranca/autenticacao">Ver todos</a></div>
                <ul class="lista">${recentes.map((e) => html`
                    <li class="lista__item">
                        <span class="lista__icone">${icone(TIPOS_EVENTO_AUTH[e.tipo].icone)}</span>
                        <div class="lista__conteudo"><div class="lista__titulo">${TIPOS_EVENTO_AUTH[e.tipo].rotulo} · ${e.usuarioNome}</div>
                            <div class="lista__meta">${e.sistema} · ${e.origem.ip} · ${e.origem.cidade}</div></div>
                        <time class="lista__meta" datetime="${e.data}">${tempoRelativo(e.data)}</time>
                    </li>`)}</ul>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Verificação de segurança</h2><a class="btn btn--pequeno" href="#/seguranca/verificacao">Detalhes</a></div>
                <ul class="lista">${verif.map((v) => html`
                    <li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">${v.nome}</div></div>${badgeStatus(STATUS_VERIFICACAO, v.status)}</li>`)}</ul>
            </section>
        </div>`);
}

function secaoAutenticacao({ secao }) {
    renderizar(secao, html`
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Histórico de autenticação</h2><span class="badge" data-contagem></span></div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fEvBusca", valor: filtrosEventos.busca, placeholder: "Pesquisar evento, usuário, IP ou cidade" })}
                ${campoSelect({ id: "fEvTipo", rotulo: "Tipo", valor: filtrosEventos.tipo, opcoes: [["", "Todos os tipos"], ...opcoes(TIPOS_EVENTO_AUTH)] })}
                ${campoSelect({ id: "fEvResultado", rotulo: "Resultado", valor: filtrosEventos.resultado, opcoes: [["", "Todos os resultados"], ...opcoes(RESULTADOS_EVENTO)] })}
                ${campoSelect({ id: "fEvDias", rotulo: "Período", valor: filtrosEventos.dias, opcoes: [["1", "Últimas 24 horas"], ["7", "Últimos 7 dias"], ["14", "Últimos 14 dias"]] })}
            </div>
            <div data-tabela></div>
        </section>`);
    const linhas = () => I.filtrarEventos(filtrosEventos);
    const tabela = tabelaEventos(secao.querySelector("[data-tabela]"), linhas, "Eventos de autenticação");
    const contar = () => { secao.querySelector("[data-contagem]").textContent = `${numero(linhas().length)} eventos`; };
    contar();
    let espera;
    secao.querySelector("#fEvBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { filtrosEventos.busca = e.target.value; tabela.definirLinhas(linhas()); contar(); }, 150);
    });
    [["#fEvTipo", "tipo"], ["#fEvResultado", "resultado"], ["#fEvDias", "dias"]].forEach(([sel, chave]) =>
        secao.querySelector(sel).addEventListener("change", (e) => { filtrosEventos[chave] = e.target.value; tabela.definirLinhas(linhas()); contar(); }));
}

function secaoAcessos({ secao, atualizarIndicadores }) {
    renderizar(secao, html`<section class="card"><div class="card__corpo" data-abas-acessos></div></section>`);
    const equipe = S.usuarios().filter((u) => u.tipo !== "cliente").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    montarAbas(secao.querySelector("[data-abas-acessos]"), {
        rotulo: "Monitoramento de acessos", ativa: abaAcessos, aoTrocar: (id) => { abaAcessos = id; },
        abas: [
            {
                id: "sessoes", rotulo: "Sessões", render: (p) => {
                    renderizar(p, html`<p class="texto-terc texto-pequeno secao-nota">Sessões administrativas fictícias. Encerrar aqui não afeta nenhuma sessão real.</p><div data-t></div>`);
                    const tabela = criarTabela({
                        colunas: [
                            { chave: "dispositivo", rotulo: "Dispositivo", render: (s) => html`${s.dispositivo}<span class="celula-sub">${s.usuario} · MFA ${s.mfa ? "sim" : "não"}</span>` },
                            { chave: "origem", rotulo: "Origem (fictícia)", valor: (s) => s.origem.ip, render: (s) => html`${s.origem.ip}<span class="celula-sub">${s.origem.cidade}</span>` },
                            { chave: "inicio", rotulo: "Início", render: (s) => dataHora(s.inicio) },
                            { chave: "ultimoAcesso", rotulo: "Último acesso", render: (s) => tempoRelativo(s.ultimoAcesso) },
                            { chave: "status", rotulo: "Status", valor: (s) => s.status, render: (s) => badgeStatus(STATUS_SESSAO, s.status) },
                            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (s) => (s.status === "ativa" ? botaoIcone({ acao: "encerrar-sessao", id: s.id, nomeIcone: "log-out", rotulo: "Encerrar sessão", perigo: true }) : "") }
                        ],
                        ordenacao: { chave: "ultimoAcesso", direcao: "desc" }, rotulo: "Sessões"
                    });
                    p.querySelector("[data-t]").appendChild(tabela.elemento);
                    tabela.definirLinhas(I.sessoes());
                    p.addEventListener("click", async (e) => {
                        const b = e.target.closest("[data-acao=encerrar-sessao]");
                        if (!b) return;
                        if (!(await confirmar({ titulo: "Encerrar sessão?", mensagem: "Sessão demonstrativa: o encerramento é apenas registrado.", textoConfirmar: "Encerrar", perigo: true }))) return;
                        I.encerrarSessao(b.dataset.id);
                        mostrarToast("Sessão encerrada (demonstração).", "sucesso");
                        tabela.atualizarLinhas(I.sessoes());
                        atualizarIndicadores();
                    });
                }
            },
            {
                id: "falhas", rotulo: "Tentativas malsucedidas", render: (p) => {
                    renderizar(p, html`<div data-t></div>`);
                    tabelaEventos(p.querySelector("[data-t]"), () => I.eventos().filter((e) => e.resultado !== "sucesso"), "Tentativas malsucedidas", 10);
                }
            },
            {
                id: "admin", rotulo: "Atividades administrativas", render: (p) => {
                    renderizar(p, html`<p class="texto-terc texto-pequeno secao-nota">Ações registradas no histórico dos módulos do painel (demonstrativo).</p><div data-t></div>`);
                    const tabela = criarTabela({
                        colunas: [
                            { chave: "data", rotulo: "Data", render: (h) => dataHora(h.data) },
                            { chave: "entidade", rotulo: "Área", render: (h) => h.entidade.replace(/_/g, " ") },
                            { chave: "descricao", rotulo: "Atividade", render: (h) => html`<span class="celula-limite">${h.descricao}</span>` }
                        ],
                        ordenacao: { chave: "data", direcao: "desc" }, porPagina: 12, rotulo: "Atividades administrativas"
                    });
                    p.querySelector("[data-t]").appendChild(tabela.elemento);
                    tabela.definirLinhas(I.atividadesAdministrativas());
                }
            },
            {
                id: "usuario", rotulo: "Histórico por usuário", render: (p) => {
                    renderizar(p, html`
                        <div class="barra-filtros barra-filtros--solta">
                            ${campoSelect({ id: "fHistUsuario", rotulo: "Usuário", valor: usuarioHistorico, opcoes: [["", "Selecione um usuário"], ["admin", "Proprietário do SaaS (administrador)"],
                                ...equipe.map((u) => [u.id, `${u.nome} · ${TIPOS_USUARIO[u.tipo].rotulo} · ${S.barbearia(u.barbeariaId)?.nome ?? ""}`])] })}
                        </div>
                        <div data-t></div>`);
                    const desenhar = () => {
                        const alvo = p.querySelector("[data-t]");
                        alvo.replaceChildren();
                        if (!usuarioHistorico) { renderizar(alvo, estadoVazio({ iconeNome: "user-search", titulo: "Selecione um usuário", texto: "Veja todos os eventos de autenticação do usuário escolhido." })); return; }
                        tabelaEventos(alvo, () => I.eventos().filter((e) => (usuarioHistorico === "admin" ? e.usuarioId === null : e.usuarioId === usuarioHistorico)), "Eventos do usuário", 10);
                    };
                    desenhar();
                    p.querySelector("#fHistUsuario").addEventListener("change", (e) => { usuarioHistorico = e.target.value; desenhar(); });
                }
            }
        ]
    });
}

function secaoPermissoes({ secao }) {
    const linhas = () => I.permissoes().filter((p) => !estadoPermissoes.perfil || p.perfil === estadoPermissoes.perfil);
    const resumoAcoes = (p) => Object.entries(p.acoes).filter(([, v]) => v).map(([k]) => ACOES_PERMISSAO[k]);
    renderizar(secao, html`
        <div class="alerta alerta--info">${icone("info")}<span>Controle demonstrativo: alterar estas permissões não muda nenhum acesso real. Na integração, as permissões serão validadas no servidor (RLS e Edge Functions).</span></div>
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Permissões administrativas</h2>
                <div class="segmentos segmentos--compacto" role="group" aria-label="Visualização">
                    <button class="segmentos__item" type="button" data-visao="lista" aria-pressed="${String(estadoPermissoes.visao === "lista")}">Lista</button>
                    <button class="segmentos__item" type="button" data-visao="matriz" aria-pressed="${String(estadoPermissoes.visao === "matriz")}">Matriz</button>
                </div>
            </div>
            <div class="barra-filtros">${campoSelect({ id: "fPerfil", rotulo: "Usuário associado", valor: estadoPermissoes.perfil, opcoes: [["", "Todos os perfis"], ...opcoes(PERFIS_ADMIN)] })}</div>
            <div data-conteudo></div>
        </section>`);
    const conteudo = secao.querySelector("[data-conteudo]");
    let tabela = null;
    function desenhar() {
        conteudo.replaceChildren();
        if (estadoPermissoes.visao === "matriz") {
            const perfis = Object.keys(PERFIS_ADMIN).filter((p) => !estadoPermissoes.perfil || p === estadoPermissoes.perfil);
            renderizar(conteudo, html`${perfis.map((perfil) => html`
                <div class="matriz-bloco">
                    <h3 class="secao__titulo secao__titulo--espaco">${PERFIS_ADMIN[perfil].rotulo}</h3>
                    <div class="tabela-rolagem"><table class="tabela matriz">
                        <thead><tr><th scope="col">Recurso</th>${Object.values(ACOES_PERMISSAO).map((a) => html`<th scope="col" class="col-centro">${a}</th>`)}</tr></thead>
                        <tbody>${I.permissoes().filter((p) => p.perfil === perfil).map((p) => html`
                            <tr class="${p.status === "revogado" ? "is-revogado" : ""}"><th scope="row">${RECURSOS_ADMIN[p.recurso]}${p.status === "revogado" ? html`<span class="celula-sub">revogado</span>` : ""}</th>
                            ${Object.keys(ACOES_PERMISSAO).map((k) => html`<td class="col-centro">${p.acoes[k] && p.status === "ativo"
                                ? html`<span class="marca-sim" aria-label="Permitido">${icone("check")}</span>` : html`<span class="marca-nao" aria-label="Não permitido">${icone("minus")}</span>`}</td>`)}</tr>`)}
                        </tbody></table></div>
                </div>`)}`);
            return;
        }
        tabela = criarTabela({
            colunas: [
                { chave: "recurso", rotulo: "Recurso", valor: (p) => RECURSOS_ADMIN[p.recurso], render: (p) => RECURSOS_ADMIN[p.recurso] },
                { chave: "permissao", rotulo: "Permissão", ordenavel: false, render: (p) => (resumoAcoes(p).length ? html`<span class="chips chips--linha">${resumoAcoes(p).map((a) => html`<span class="chip">${a}</span>`)}</span>` : html`<span class="texto-terc">Sem acesso</span>`) },
                { chave: "perfil", rotulo: "Usuário associado", valor: (p) => PERFIS_ADMIN[p.perfil].rotulo, render: (p) => PERFIS_ADMIN[p.perfil].rotulo },
                { chave: "status", rotulo: "Status", valor: (p) => p.status, render: (p) => badgeStatus({ ativo: { rotulo: "Ativo", tom: "sucesso" }, revogado: { rotulo: "Revogado", tom: "erro" } }, p.status) },
                { chave: "atualizadoEm", rotulo: "Última alteração", render: (p) => data(p.atualizadoEm) },
                {
                    chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
                    render: (p) => (PERFIS_ADMIN[p.perfil].bloqueado ? html`<span class="texto-terc texto-pequeno com-icone">${icone("lock")}Fixo</span>` : html`<div class="acoes-linha">
                        ${botaoIcone({ acao: "editar-permissao", id: p.id, nomeIcone: "pencil", rotulo: "Editar permissões" })}
                        ${botaoIcone({ acao: "alternar-permissao", id: p.id, nomeIcone: p.status === "ativo" ? "user-x" : "user-check", rotulo: p.status === "ativo" ? "Revogar acesso" : "Reativar acesso", perigo: p.status === "ativo" })}</div>`)
                }
            ],
            ordenacao: { chave: "recurso", direcao: "asc" }, porPagina: 10, rotulo: "Permissões"
        });
        conteudo.appendChild(tabela.elemento);
        tabela.definirLinhas(linhas());
    }
    desenhar();
    secao.querySelector("#fPerfil").addEventListener("change", (e) => { estadoPermissoes.perfil = e.target.value; desenhar(); });
    secao.addEventListener("click", async (e) => {
        const visao = e.target.closest("[data-visao]");
        if (visao) {
            estadoPermissoes.visao = visao.dataset.visao;
            secao.querySelectorAll("[data-visao]").forEach((b) => b.setAttribute("aria-pressed", String(b === visao)));
            desenhar();
            return;
        }
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        const p = I.permissoes().find((x) => x.id === b.dataset.id);
        try {
            if (b.dataset.acao === "editar-permissao") {
                const ok = await abrirFormulario({
                    titulo: `${PERFIS_ADMIN[p.perfil].rotulo} · ${RECURSOS_ADMIN[p.recurso]}`,
                    descricao: "Alteração demonstrativa: nenhum acesso real é modificado.",
                    campos: [{ nome: "acoes", rotulo: "Permissões", tipo: "checkboxes", opcoes: opcoes(ACOES_PERMISSAO) }],
                    valores: { acoes: Object.entries(p.acoes).filter(([, v]) => v).map(([k]) => k) },
                    textoSalvar: "Salvar permissões",
                    aoSalvar: (v) => I.salvarPermissao(p.id, v.acoes)
                });
                if (ok) { mostrarToast("Permissões atualizadas (demonstração).", "sucesso"); tabela.atualizarLinhas(linhas()); }
            }
            if (b.dataset.acao === "alternar-permissao") {
                if (p.status === "ativo" && !(await confirmar({ titulo: "Revogar acesso?", mensagem: `${PERFIS_ADMIN[p.perfil].rotulo} perde o acesso a ${RECURSOS_ADMIN[p.recurso]} (demonstração).`, textoConfirmar: "Revogar", perigo: true }))) return;
                I.alternarStatusPermissao(p.id);
                mostrarToast(p.status === "ativo" ? "Acesso reativado (demonstração)." : "Acesso revogado (demonstração).", "sucesso");
                tabela.atualizarLinhas(linhas());
            }
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

function secaoVerificacao({ secao, atualizarIndicadores }) {
    const desenhar = () => renderizar(secao, html`
        <div class="alerta alerta--info">${icone("info")}<span>Esta lista mostra a <strong>situação real do projeto</strong>. Nenhuma proteção foi verificada em produção ainda. "Verificado em ambiente real" só será possível depois da implantação e de um teste real.</span></div>
        <div class="grade grade--verificacao">
            ${I.verificacoes().map((v) => html`
                <article class="card verificacao-card">
                    <div class="card__cabecalho"><h3 class="card__titulo">${v.nome}</h3>${badgeStatus(STATUS_VERIFICACAO, v.status)}</div>
                    <div class="card__corpo">
                        <p class="texto-sec texto-pequeno">${v.descricao}</p>
                        ${v.notas.length ? html`<ul class="notas secao-topo">${v.notas.slice(-2).map((n) => html`<li class="nota"><p>${n.texto}</p><span class="texto-terc">${dataHora(n.data)}</span></li>`)}</ul>` : ""}
                        <div class="acoes-cartao"><button class="btn btn--pequeno" type="button" data-verificar="${v.id}">${icone("clipboard-pen")}<span>Registrar verificação</span></button></div>
                    </div>
                </article>`)}
        </div>`);
    desenhar();
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-verificar]");
        if (!b) return;
        const v = I.verificacoes().find((x) => x.id === b.dataset.verificar);
        const ok = await abrirFormulario({
            titulo: `Registrar verificação · ${v.nome}`,
            descricao: "Registre o que foi conferido. O status \"Verificado em ambiente real\" fica bloqueado até a integração.",
            campos: [
                { nome: "status", rotulo: "Situação", tipo: "select", obrigatorio: true, opcoes: opcoes(STATUS_VERIFICACAO) },
                { nome: "nota", rotulo: "O que foi verificado", tipo: "textarea", obrigatorio: true, maxlength: 500 }
            ],
            valores: { status: v.status }, textoSalvar: "Registrar",
            aoSalvar: (x) => I.registrarNotaVerificacao(v.id, x)
        });
        if (ok) { mostrarToast("Verificação registrada.", "sucesso"); desenhar(); atualizarIndicadores(); }
    });
}

const RENDER = { "": secaoVisao, autenticacao: secaoAutenticacao, acessos: secaoAcessos, incidentes: (ctx) => Inc.renderLista(ctx.secao, "seguranca", ctx.atualizarIndicadores), permissoes: secaoPermissoes, verificacao: secaoVerificacao, alertas: (ctx) => Al.renderCentral(ctx.secao, ctx.atualizarIndicadores) };

export function render(view, { parametros = [] }) {
    const [primeiro, segundo] = parametros;
    if (primeiro === "incidente" && segundo) return Inc.renderDetalhe(view, "seguranca", segundo);
    if (primeiro === "alerta" && segundo) return Al.renderDetalhe(view, segundo);
    const ativa = SECOES.some(([r]) => r === primeiro) ? primeiro : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Segurança", subtitulo: "Autenticação, acessos, incidentes, permissões e alertas", base: "#/seguranca",
        secoes: SECOES, ativa, kpis, recarregar,
        acoes: html`<button class="btn" type="button" data-topo="alerta">${icone("bell-plus")}<span>Registrar alerta</span></button>
            <button class="btn btn--primario" type="button" data-topo="incidente">${icone("siren")}<span>Registrar incidente</span></button>`
    });
    ctx.raiz.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-topo]");
        if (!b) return;
        if (b.dataset.topo === "incidente") await Inc.registrar("seguranca");
        if (b.dataset.topo === "alerta") await Al.novoAlerta();
    });
    RENDER[ativa](ctx);
}
