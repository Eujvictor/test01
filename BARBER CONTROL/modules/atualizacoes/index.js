// =====================================================================
// MÓDULO 13 — ATUALIZAÇÕES E VERSÕES (modo demonstrativo)
// Rotas: #/atualizacoes[/versoes|distribuicao|rollback]  ·  #/atualizacoes/versao/<id>
// Nenhuma versão é publicada, distribuída ou revertida de verdade.
// Preparado para integração futura com GitHub e pipeline de implantação.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import * as E from "../../services/demo/evolucao.js";
import {
    STATUS_VERSAO, CATEGORIAS_VERSAO, MODOS_DISTRIBUICAO, STATUS_DISTRIBUICAO, STATUS_ROLLBACK, STATUS_BARBEARIA, opcoes
} from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, data, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { abrirPainel } from "../../js/components/painel.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, kpi, badgeStatus, estadoVazio, listaDefinicao, linhaDoTempo, botaoIcone, campoBusca, campoSelect, molduraComAbas, novaRaiz
} from "../../js/components/ui.js";

const SECOES = [["", "Visão geral"], ["versoes", "Versões"], ["distribuicao", "Distribuição"], ["rollback", "Rollback"]];
const filtros = { busca: "", status: "", categoria: "", arquivadas: false };
const dataCurta = (t) => (t ? t.split("-").reverse().join("/") : "—");

function avisoDeploy() {
    return html`<div class="alerta alerta--info">${icone("info")}<span><strong>Simulação.</strong> Nenhuma versão é publicada, distribuída ou revertida no sistema Barber. A estrutura está preparada para integração futura com o GitHub e com o pipeline de implantação.</span></div>`;
}

function kpis() {
    const lista = E.versoes().filter((v) => !v.arquivada);
    const atual = E.versaoAtual();
    const ultima = [...lista].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
    const preparacao = lista.filter((v) => ["planejada", "desenvolvimento", "testes", "aprovada"].includes(v.status));
    const correcoes = lista.reduce((s, v) => s + v.alteracoes.filter((a) => a.tipo === "correcao").length, 0);
    const afetadas = new Set();
    lista.filter((v) => v.distribuicao.status === "em_andamento" || v.status === "aprovada").forEach((v) => E.alcancePublicoVersao(v.distribuicao.publico).forEach((b) => afetadas.add(b.id)));
    return html`
        ${kpi({ rotulo: "Versão atual", valor: atual?.numero ?? "—", iconeNome: "git-branch", nota: atual ? `${atual.nome} (demo)` : "", destaque: true })}
        ${kpi({ rotulo: "Última cadastrada", valor: ultima?.numero ?? "—", iconeNome: "file-plus", nota: ultima ? tempoRelativo(ultima.criadoEm) : "" })}
        ${kpi({ rotulo: "Total de versões", valor: numero(lista.length), iconeNome: "layers", nota: "Não arquivadas" })}
        ${kpi({ rotulo: "Publicadas", valor: numero(lista.filter((v) => v.status === "publicada").length), iconeNome: "rocket", nota: "Publicação demonstrativa" })}
        ${kpi({ rotulo: "Em preparação", valor: numero(preparacao.length), iconeNome: "hammer", nota: "Planejadas até aprovadas" })}
        ${kpi({ rotulo: "Correções registradas", valor: numero(correcoes), iconeNome: "wrench", nota: "Alterações do tipo correção" })}
        ${kpi({ rotulo: "Empresas potencialmente afetadas", valor: numero(afetadas.size), iconeNome: "store", nota: "Versões aprovadas ou em distribuição" })}`;
}

// ---------------------------------------------------------------------
// Formulários e ações
// ---------------------------------------------------------------------
export function camposVersao() {
    return [
        { nome: "numero", rotulo: "Número da versão", tipo: "texto", obrigatorio: true, maxlength: 12, largura: "meia", placeholder: "2.5.0" },
        { nome: "categoria", rotulo: "Categoria", tipo: "select", obrigatorio: true, opcoes: opcoes(CATEGORIAS_VERSAO), largura: "meia" },
        { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, maxlength: 80 },
        { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, maxlength: 600 },
        { nome: "responsavel", rotulo: "Responsável", tipo: "texto", obrigatorio: true, maxlength: 80, largura: "meia" },
        { nome: "previsaoLancamento", rotulo: "Previsão de lançamento", tipo: "data", largura: "meia" },
        { nome: "alteracoes", rotulo: "Lista de alterações (uma por linha)", tipo: "textarea", obrigatorio: true, maxlength: 2000 },
        { nome: "funcionalidades", rotulo: "Funcionalidades envolvidas (catálogo do módulo 14)", tipo: "checkboxes",
            opcoes: E.funcionalidades().map((f) => [f.chave, f.nome]) }
    ];
}

async function editarVersao(id = null) {
    const atual = id ? E.versao(id) : null;
    const salvo = await abrirFormulario({
        titulo: atual ? `Editar versão ${atual.numero}` : "Nova versão",
        descricao: "Registro demonstrativo. Nenhum código é alterado.",
        campos: camposVersao(),
        valores: atual
            ? { ...atual, alteracoes: atual.alteracoes.map((a) => a.descricao).join("\n") }
            : { numero: E.proximoNumero("minor"), categoria: "funcionalidade", responsavel: "Proprietário do SaaS" },
        textoSalvar: atual ? "Salvar versão" : "Criar versão",
        aoSalvar: (v) => E.salvarVersao(v, id)
    });
    if (salvo) {
        mostrarToast(atual ? "Versão atualizada." : `Versão ${salvo.numero} criada como planejada.`, "sucesso");
        if (!atual) window.location.hash = `#/atualizacoes/versao/${salvo.id}`;
    }
    return Boolean(salvo);
}

async function alterarStatus(id) {
    const v = E.versao(id);
    const opcoesStatus = E.transicoesPermitidas(v).map((s) => [s, STATUS_VERSAO[s].rotulo]);
    if (!opcoesStatus.length) { mostrarToast("Esta versão não permite mudança de status.", "atencao"); return false; }
    const ok = await abrirFormulario({
        titulo: `Alterar status · ${v.numero}`,
        descricao: `Atual: ${STATUS_VERSAO[v.status].rotulo}. A publicação acontece pela liberação geral na distribuição.`,
        campos: [
            { nome: "status", rotulo: "Novo status", tipo: "select", obrigatorio: true, opcoes: opcoesStatus },
            { nome: "comentario", rotulo: "Comentário", tipo: "textarea", maxlength: 300 }
        ],
        textoSalvar: "Alterar status",
        aoSalvar: (x) => E.alterarStatusVersao(id, x.status, x.comentario)
    });
    if (ok) mostrarToast("Status atualizado.", "sucesso");
    return Boolean(ok);
}

async function solicitarRollback(versaoAtualId = "") {
    const publicadas = E.versoes().filter((v) => v.status === "publicada").sort((a, b) => E.compararVersoes(b.numero, a.numero));
    const novo = await abrirFormulario({
        titulo: "Solicitar rollback (simulação)",
        descricao: "Registra uma solicitação de reversão. Nenhum código é alterado e nenhum deploy é feito.",
        campos: [
            { nome: "versaoAtualId", rotulo: "Versão atual", tipo: "select", obrigatorio: true, opcoes: publicadas.map((v) => [v.id, `${v.numero} · ${v.nome}`]), largura: "meia" },
            { nome: "versaoDestinoId", rotulo: "Versão de destino", tipo: "select", obrigatorio: true, opcoes: publicadas.map((v) => [v.id, `${v.numero} · ${v.nome}`]), largura: "meia" },
            { nome: "responsavel", rotulo: "Responsável", tipo: "texto", obrigatorio: true, maxlength: 80 },
            { nome: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true, maxlength: 500 }
        ],
        valores: { versaoAtualId: versaoAtualId || publicadas[0]?.id, versaoDestinoId: publicadas[1]?.id, responsavel: "Proprietário do SaaS" },
        textoSalvar: "Registrar solicitação",
        aoSalvar: (v) => E.solicitarRollback(v)
    });
    if (novo) {
        mostrarToast(`Solicitação ${novo.codigo} registrada (simulação).`, "sucesso");
        // Mesma rota: força o redesenho; rota diferente: navega.
        if (window.location.hash === "#/atualizacoes/rollback") window.dispatchEvent(new HashChangeEvent("hashchange"));
        else window.location.hash = "#/atualizacoes/rollback";
    }
    return Boolean(novo);
}

async function acaoDistribuicao(nome, id) {
    const v = E.versao(id);
    if (nome === "grupo_testes" || nome === "geral") {
        const r = E.resultadosDistribuicao({ distribuicao: { publico: nome === "grupo_testes" ? { tipo: "grupo_testes" } : v.distribuicao.publico.tipo === "grupo_testes" ? { tipo: "todas" } : v.distribuicao.publico, percentual: 100, status: "em_andamento" } });
        const ok = await confirmar({
            titulo: nome === "geral" ? `Liberação geral da ${v.numero}?` : `Publicar ${v.numero} para o grupo de testes?`,
            mensagem: `${r.alcance} barbearias no público. Simulação: nenhum deploy real será feito.${nome === "geral" ? " A versão passa a constar como publicada." : ""}`,
            textoConfirmar: nome === "geral" ? "Liberar (simulação)" : "Publicar para testes"
        });
        if (!ok) return false;
        E.distribuir(id, nome);
        mostrarToast(nome === "geral" ? "Liberação geral simulada concluída." : "Publicação demonstrativa para o grupo de testes iniciada.", "sucesso");
        return true;
    }
    if (nome === "gradual") {
        const ok = await abrirFormulario({
            titulo: `Distribuição gradual · ${v.numero}`,
            descricao: `Público: ${E.descreverPublicoVersao(v.distribuicao.publico.tipo === "grupo_testes" ? { tipo: "todas" } : v.distribuicao.publico)}. Simulação, sem deploy.`,
            campos: [{ nome: "percentual", rotulo: "Percentual do público", tipo: "select", obrigatorio: true, opcoes: [["10", "10%"], ["25", "25%"], ["50", "50%"], ["75", "75%"]] }],
            valores: { percentual: String([10, 25, 50, 75].find((p) => p > (v.distribuicao.modo === "gradual" ? v.distribuicao.percentual : 0)) ?? 75) },
            textoSalvar: "Aplicar percentual",
            aoSalvar: (x) => E.distribuir(id, "gradual", Number(x.percentual))
        });
        if (ok) mostrarToast("Distribuição gradual atualizada (simulação).", "sucesso");
        return Boolean(ok);
    }
    if (nome === "interromper") {
        const ok = await abrirFormulario({
            titulo: `Interromper distribuição · ${v.numero}`, campos: [{ nome: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true, maxlength: 300 }],
            textoSalvar: "Interromper", perigo: true, aoSalvar: (x) => E.interromperDistribuicao(id, x.motivo)
        });
        if (ok) mostrarToast("Distribuição interrompida.", "sucesso");
        return Boolean(ok);
    }
    if (nome === "retomar") { E.retomarDistribuicao(id); mostrarToast("Distribuição retomada.", "sucesso"); return true; }
    if (nome === "publico") {
        const empresas = [...S.barbearias()].filter((b) => b.status !== "cancelada").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        const ok = await abrirFormulario({
            titulo: `Público da distribuição · ${v.numero}`,
            campos: [
                { nome: "tipo", rotulo: "Público", tipo: "select", obrigatorio: true, opcoes: [["todas", "Todas as barbearias"], ["especificas", "Barbearias específicas"],
                    ...S.planosDisponiveis().map((p) => [`plano:${p.id}`, `Plano ${p.nome}`]), ["grupo_testes", "Grupo de testes"]] },
                { nome: "barbeariaIds", rotulo: "Barbearias específicas", tipo: "checkboxes", opcoes: empresas.map((b) => [b.id, b.nome]),
                    validarVazio: true, validar: (val, x) => (x.tipo === "especificas" && !val.length ? "Selecione ao menos uma barbearia." : null) }
            ],
            valores: { tipo: v.distribuicao.publico.tipo === "plano" ? `plano:${v.distribuicao.publico.planoId}` : v.distribuicao.publico.tipo, barbeariaIds: v.distribuicao.publico.barbeariaIds ?? [] },
            textoSalvar: "Definir público",
            aoSalvar: (x) => E.definirPublicoVersao(id, x.tipo.startsWith("plano:") ? { tipo: "plano", planoId: x.tipo.slice(6) } : x.tipo === "especificas" ? { tipo: "especificas", barbeariaIds: x.barbeariaIds } : { tipo: x.tipo })
        });
        if (ok) mostrarToast("Público definido.", "sucesso");
        return Boolean(ok);
    }
    if (nome === "resultados") {
        const r = E.resultadosDistribuicao(v);
        await abrirPainel({
            titulo: `Resultados da distribuição · ${v.numero}`, descricao: "Números demonstrativos calculados a partir do público e do percentual.",
            conteudo: html`
                ${listaDefinicao([
                    ["Modo", MODOS_DISTRIBUICAO[v.distribuicao.modo]], ["Status", badgeStatus(STATUS_DISTRIBUICAO, v.distribuicao.status)],
                    ["Público", `${E.descreverPublicoVersao(v.distribuicao.publico)} · ${r.alcance} barbearias`], ["Percentual", `${v.distribuicao.percentual}%`],
                    ["Atualizadas (simulação)", numero(r.atualizadas)], ["Pendentes", numero(r.pendentes)], ["Falhas simuladas", numero(r.falhas)]
                ])}
                <div class="barra-progresso secao-topo" role="img" aria-label="${r.atualizadas} de ${r.alcance} barbearias"><span class="barra-progresso__valor" data-largura="${r.alcance ? Math.round((r.atualizadas / r.alcance) * 100) : 0}"></span></div>`
        });
        return false;
    }
    return false;
}

async function executar(acao, id) {
    try {
        switch (acao) {
            case "nova": return await editarVersao();
            case "ver": window.location.hash = `#/atualizacoes/versao/${id}`; return false;
            case "editar": return await editarVersao(id);
            case "duplicar": {
                const nova = E.duplicarVersao(id);
                mostrarToast(`Versão duplicada como ${nova.numero}.`, "sucesso");
                window.location.hash = `#/atualizacoes/versao/${nova.id}`;
                return false;
            }
            case "arquivar": {
                const v = E.versao(id);
                if (!v.arquivada && !(await confirmar({ titulo: `Arquivar a versão ${v.numero}?`, mensagem: "Ela sai das listas ativas e continua no histórico.", textoConfirmar: "Arquivar", perigo: true }))) return false;
                E.arquivarVersao(id);
                mostrarToast(v.arquivada ? "Versão restaurada." : "Versão arquivada.", "sucesso");
                return true;
            }
            case "status": return await alterarStatus(id);
            case "rollback": return await solicitarRollback(id);
            case "novo-rollback": return await solicitarRollback();
            default: return await acaoDistribuicao(acao, id);
        }
    } catch (falha) {
        mostrarToast(falha.message, "erro");
        return false;
    }
}

// ---------------------------------------------------------------------
// Seções
// ---------------------------------------------------------------------
function secaoVisao({ secao }) {
    const ordenadas = E.versoes().filter((v) => !v.arquivada).sort((a, b) => E.compararVersoes(b.numero, a.numero));
    const andamento = ordenadas.filter((v) => v.distribuicao.status === "em_andamento" || v.distribuicao.status === "interrompida");
    const abertos = E.rollbacks().filter((r) => ["solicitado", "em_analise", "aprovado"].includes(r.status));
    renderizar(secao, html`
        ${avisoDeploy()}
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Linha do tempo das versões</h2><a class="btn btn--pequeno" href="#/atualizacoes/versoes">Todas</a></div>
                <div class="card__corpo">
                    <ol class="timeline">${ordenadas.map((v) => html`
                        <li class="timeline__item">
                            <span class="timeline__marcador timeline__marcador--${v.status}"></span>
                            <div class="timeline__conteudo">
                                <p><a class="link-forte" href="#/atualizacoes/versao/${v.id}">${v.numero} · ${v.nome}</a> ${badgeStatus(STATUS_VERSAO, v.status)}</p>
                                <time>${v.publicadaEm ? `Publicada ${data(v.publicadaEm)}` : v.previsaoLancamento ? `Previsão ${dataCurta(v.previsaoLancamento)}` : "Sem previsão"} · ${CATEGORIAS_VERSAO[v.categoria]}</time>
                            </div>
                        </li>`)}</ol>
                </div>
            </section>
            <div>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Distribuições em andamento</h2><a class="btn btn--pequeno" href="#/atualizacoes/distribuicao">Gerenciar</a></div>
                    ${andamento.length ? html`<ul class="lista">${andamento.map((v) => {
                        const r = E.resultadosDistribuicao(v);
                        return html`<li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/atualizacoes/versao/${v.id}">${v.numero} · ${MODOS_DISTRIBUICAO[v.distribuicao.modo]}</a>
                            <div class="lista__meta">${r.atualizadas} de ${r.alcance} barbearias · ${v.distribuicao.percentual}% (simulação)</div></div>${badgeStatus(STATUS_DISTRIBUICAO, v.distribuicao.status)}</li>`;
                    })}</ul>` : estadoVazio({ iconeNome: "rocket", titulo: "Nenhuma distribuição em andamento" })}
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Rollbacks em aberto</h2><a class="btn btn--pequeno" href="#/atualizacoes/rollback">Ver</a></div>
                    ${abertos.length ? html`<ul class="lista">${abertos.map((r) => html`<li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">${r.codigo} · ${E.versao(r.versaoAtualId)?.numero} → ${E.versao(r.versaoDestinoId)?.numero}</div>
                        <div class="lista__meta">${r.motivo}</div></div>${badgeStatus(STATUS_ROLLBACK, r.status)}</li>`)}</ul>` : estadoVazio({ iconeNome: "undo-2", titulo: "Nenhuma solicitação em aberto" })}
                </section>
            </div>
        </div>`);
}

const COLUNAS = [
    { chave: "numero", rotulo: "Versão", valor: (v) => v.numero.split(".").map((n) => n.padStart(4, "0")).join("."), render: (v) => html`<a class="link-forte num" href="#/atualizacoes/versao/${v.id}">${v.numero}</a>${v.arquivada ? html`<span class="celula-sub">arquivada</span>` : ""}` },
    { chave: "nome", rotulo: "Nome", render: (v) => html`${v.nome}<span class="celula-sub">${CATEGORIAS_VERSAO[v.categoria]}</span>` },
    { chave: "criadoEm", rotulo: "Criação", render: (v) => data(v.criadoEm) },
    { chave: "previsaoLancamento", rotulo: "Previsão", render: (v) => dataCurta(v.previsaoLancamento) },
    { chave: "responsavel", rotulo: "Responsável", render: (v) => html`<span class="celula-limite">${v.responsavel}</span>` },
    { chave: "status", rotulo: "Status", valor: (v) => STATUS_VERSAO[v.status].rotulo, render: (v) => badgeStatus(STATUS_VERSAO, v.status) },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (v) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "ver", id: v.id, nomeIcone: "eye", rotulo: `Ver ${v.numero}` })}
            ${v.status !== "publicada" ? botaoIcone({ acao: "editar", id: v.id, nomeIcone: "pencil", rotulo: "Editar" }) : ""}
            ${botaoIcone({ acao: "duplicar", id: v.id, nomeIcone: "copy", rotulo: "Duplicar" })}
            ${["planejada", "cancelada"].includes(v.status) ? botaoIcone({ acao: "arquivar", id: v.id, nomeIcone: v.arquivada ? "archive-restore" : "archive", rotulo: v.arquivada ? "Restaurar" : "Arquivar" }) : ""}
        </div>`
    }
];

function secaoVersoes({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Gerenciamento de versões</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-acao="nova">${icone("plus")}<span>Nova versão</span></button></div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fVsBusca", valor: filtros.busca, placeholder: "Pesquisar número ou nome" })}
                ${campoSelect({ id: "fVsStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_VERSAO)] })}
                ${campoSelect({ id: "fVsCategoria", rotulo: "Categoria", valor: filtros.categoria, opcoes: [["", "Todas as categorias"], ...opcoes(CATEGORIAS_VERSAO)] })}
                <label class="marcar"><input type="checkbox" id="fVsArquivadas" ${filtros.arquivadas ? "checked" : ""}><span>Mostrar arquivadas</span></label>
            </div>
            <div data-tabela></div>
        </section>`);
    const linhas = () => E.versoes().filter((v) => (filtros.arquivadas || !v.arquivada) && (!filtros.status || v.status === filtros.status) &&
        (!filtros.categoria || v.categoria === filtros.categoria) && (!filtros.busca || `${v.numero} ${v.nome}`.toLowerCase().includes(filtros.busca.toLowerCase())));
    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "numero", direcao: "desc" }, vazio: "Nenhuma versão encontrada.", rotulo: "Versões" });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());
    secao.querySelector("#fVsBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(linhas()); });
    secao.querySelector("#fVsStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(linhas()); });
    secao.querySelector("#fVsCategoria").addEventListener("change", (e) => { filtros.categoria = e.target.value; tabela.definirLinhas(linhas()); });
    secao.querySelector("#fVsArquivadas").addEventListener("change", (e) => { filtros.arquivadas = e.target.checked; tabela.definirLinhas(linhas()); });
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b || b.dataset.acao === "restaurar-demo") return;
        if (await executar(b.dataset.acao, b.dataset.id)) { tabela.atualizarLinhas(linhas()); atualizarIndicadores(); }
    });
}

function painelDistribuicao(v) {
    const r = E.resultadosDistribuicao(v);
    const d = v.distribuicao;
    const pode = {
        grupo: ["testes", "aprovada"].includes(v.status) && d.status !== "em_andamento",
        gradual: v.status === "aprovada", geral: v.status === "aprovada",
        interromper: d.status === "em_andamento", retomar: d.status === "interrompida",
        publico: v.status !== "publicada" && d.status !== "em_andamento"
    };
    return html`
        <div class="distribuicao">
            ${listaDefinicao([
                ["Modo", MODOS_DISTRIBUICAO[d.modo]], ["Status", badgeStatus(STATUS_DISTRIBUICAO, d.status)],
                ["Público", `${E.descreverPublicoVersao(d.publico)} · ${r.alcance} barbearias`], ["Percentual", `${d.percentual}%`]
            ])}
            <div class="barra-progresso secao-topo" role="img" aria-label="${r.atualizadas} de ${r.alcance} barbearias atualizadas (simulação)">
                <span class="barra-progresso__valor" data-largura="${r.alcance ? Math.round((r.atualizadas / r.alcance) * 100) : 0}"></span></div>
            <p class="texto-terc texto-pequeno">${r.atualizadas} de ${r.alcance} barbearias atualizadas (simulação)</p>
            <div class="acoes-cartao">
                ${pode.publico ? html`<button class="btn btn--pequeno" type="button" data-acao="publico" data-id="${v.id}">${icone("users")}<span>Público</span></button>` : ""}
                ${pode.grupo ? html`<button class="btn btn--pequeno" type="button" data-acao="grupo_testes" data-id="${v.id}">${icone("flask-conical")}<span>Grupo de testes</span></button>` : ""}
                ${pode.gradual ? html`<button class="btn btn--pequeno" type="button" data-acao="gradual" data-id="${v.id}">${icone("trending-up")}<span>Gradual</span></button>` : ""}
                ${pode.geral ? html`<button class="btn btn--pequeno btn--primario" type="button" data-acao="geral" data-id="${v.id}">${icone("rocket")}<span>Liberação geral</span></button>` : ""}
                ${pode.interromper ? html`<button class="btn btn--pequeno btn--perigo" type="button" data-acao="interromper" data-id="${v.id}">${icone("circle-pause")}<span>Interromper</span></button>` : ""}
                ${pode.retomar ? html`<button class="btn btn--pequeno" type="button" data-acao="retomar" data-id="${v.id}">${icone("circle-play")}<span>Retomar</span></button>` : ""}
                <button class="btn btn--pequeno btn--fantasma" type="button" data-acao="resultados" data-id="${v.id}">${icone("chart-column")}<span>Resultados</span></button>
            </div>
        </div>`;
}

function secaoDistribuicao({ secao, atualizarIndicadores }) {
    const desenhar = () => {
        const candidatas = E.versoes().filter((v) => !v.arquivada && ["testes", "aprovada"].includes(v.status) || v.distribuicao.status === "em_andamento" || v.distribuicao.status === "interrompida")
            .filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => E.compararVersoes(b.numero, a.numero));
        const grupo = E.grupoTestes().map((id) => S.barbearia(id)).filter(Boolean);
        renderizar(secao, html`
            ${avisoDeploy()}
            <section class="card secao">
                <div class="card__cabecalho"><h2 class="card__titulo">Grupo de testes</h2>
                    <button class="btn btn--pequeno" type="button" data-grupo>${icone("users")}<span>Editar grupo</span></button></div>
                <div class="card__corpo">
                    <ul class="chips">${grupo.map((b) => html`<li class="chip">${b.nome}</li>`)}</ul>
                    <p class="texto-terc texto-pequeno">Barbearias que recebem primeiro as versões em teste (simulação).</p>
                </div>
            </section>
            ${candidatas.length ? html`<div class="grade grade--planos">${candidatas.map((v) => html`
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo"><a class="link-forte" href="#/atualizacoes/versao/${v.id}">${v.numero} · ${v.nome}</a></h2>${badgeStatus(STATUS_VERSAO, v.status)}</div>
                    <div class="card__corpo">${painelDistribuicao(v)}</div>
                </section>`)}</div>`
                : html`<section class="card">${estadoVazio({ iconeNome: "rocket", titulo: "Nenhuma versão pronta para distribuir", texto: "Versões em testes ou aprovadas aparecem aqui." })}</section>`}`);
    };
    desenhar();
    secao.addEventListener("click", async (e) => {
        if (e.target.closest("[data-grupo]")) {
            const ativas = S.barbearias().filter((b) => b.status === "ativa").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
            const ok = await abrirFormulario({
                titulo: "Grupo de testes", descricao: "Barbearias que recebem as versões em teste (simulação).",
                campos: [{ nome: "barbeariaIds", rotulo: "Barbearias", tipo: "checkboxes", obrigatorio: true, opcoes: ativas.map((b) => [b.id, b.nome]) }],
                valores: { barbeariaIds: E.grupoTestes() }, textoSalvar: "Salvar grupo", aoSalvar: (v) => E.salvarGrupoTestes(v.barbeariaIds)
            });
            if (ok) { mostrarToast("Grupo de testes atualizado.", "sucesso"); desenhar(); }
            return;
        }
        const b = e.target.closest("[data-acao]");
        if (!b || b.dataset.acao === "restaurar-demo") return;
        if (await executar(b.dataset.acao, b.dataset.id)) { desenhar(); atualizarIndicadores(); }
    });
}

function secaoRollback({ secao }) {
    renderizar(secao, html`
        ${avisoDeploy()}
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Solicitações de rollback</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-acao="novo-rollback">${icone("undo-2")}<span>Solicitar rollback</span></button></div>
            <div data-tabela></div>
        </section>`);
    const tabela = criarTabela({
        colunas: [
            { chave: "codigo", rotulo: "Solicitação", render: (r) => html`<span class="num">${r.codigo}</span>` },
            { chave: "atual", rotulo: "Versão atual", valor: (r) => E.versao(r.versaoAtualId)?.numero, render: (r) => html`<a class="link-forte" href="#/atualizacoes/versao/${r.versaoAtualId}">${E.versao(r.versaoAtualId)?.numero}</a>` },
            { chave: "destino", rotulo: "Destino", valor: (r) => E.versao(r.versaoDestinoId)?.numero, render: (r) => E.versao(r.versaoDestinoId)?.numero ?? "—" },
            { chave: "motivo", rotulo: "Motivo", render: (r) => html`<span class="celula-limite">${r.motivo}</span>` },
            { chave: "data", rotulo: "Data", render: (r) => dataHora(r.data) },
            { chave: "responsavel", rotulo: "Responsável" },
            { chave: "status", rotulo: "Status", valor: (r) => r.status, render: (r) => badgeStatus(STATUS_ROLLBACK, r.status) },
            {
                chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
                render: (r) => html`<div class="acoes-linha">
                    ${botaoIcone({ acao: "historico-rb", id: r.id, nomeIcone: "history", rotulo: "Histórico" })}
                    ${r.status === "solicitado" ? botaoIcone({ acao: "rb-analisar", id: r.id, nomeIcone: "search", rotulo: "Analisar" }) : ""}
                    ${r.status === "em_analise" ? botaoIcone({ acao: "rb-aprovar", id: r.id, nomeIcone: "check", rotulo: "Aprovar (simulação)" }) : ""}
                    ${r.status === "em_analise" ? botaoIcone({ acao: "rb-recusar", id: r.id, nomeIcone: "x", rotulo: "Recusar", perigo: true }) : ""}
                    ${r.status === "aprovado" ? botaoIcone({ acao: "rb-concluir", id: r.id, nomeIcone: "check-check", rotulo: "Concluir simulação" }) : ""}
                </div>`
            }
        ],
        ordenacao: { chave: "data", direcao: "desc" }, vazio: "Nenhuma solicitação.", rotulo: "Rollbacks"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(E.rollbacks());
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        const { acao, id } = b.dataset;
        try {
            if (acao === "novo-rollback") { await solicitarRollback(); tabela.definirLinhas(E.rollbacks()); return; }
            if (acao === "historico-rb") {
                const r = E.rollbacks().find((x) => x.id === id);
                await abrirPainel({ titulo: `Histórico · ${r.codigo}`, conteudo: linhaDoTempo(E.historicoDe("rollback", id)) });
                return;
            }
            if (acao.startsWith("rb-")) {
                const passo = acao.slice(3);
                if (passo === "recusar" || passo === "concluir") {
                    const ok = await confirmar({ titulo: passo === "recusar" ? "Recusar rollback?" : "Concluir simulação do rollback?", mensagem: passo === "concluir" ? "Nenhum código será alterado. Só a conclusão da simulação fica registrada." : "A solicitação será encerrada como recusada.", textoConfirmar: passo === "recusar" ? "Recusar" : "Concluir simulação", perigo: passo === "recusar" });
                    if (!ok) return;
                }
                E.avancarRollback(id, passo);
                mostrarToast("Solicitação atualizada.", "sucesso");
                tabela.atualizarLinhas(E.rollbacks());
            }
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

// ---------------------------------------------------------------------
// Detalhe da versão
// ---------------------------------------------------------------------
function renderVersao(view, id) {
    const raiz = novaRaiz(view);
    const v = E.versao(id);
    const voltar = { href: "#/atualizacoes/versoes", rotulo: "Versões" };
    if (!v) {
        renderizar(raiz, html`${cabecalho({ titulo: "Versão não encontrada", voltar })}<section class="card">${estadoVazio({ iconeNome: "git-branch", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const ideia = v.ideiaId ? E.ideia(v.ideiaId) : null;
    const mudancas = E.mudancas().filter((m) => m.versaoId === id);
    const empresas = E.resultadosDistribuicao(v).empresas;
    renderizar(raiz, html`
        ${cabecalho({
            titulo: `${v.numero} · ${v.nome}`, voltar, extra: html`${badgeStatus(STATUS_VERSAO, v.status)}${v.arquivada ? html`<span class="badge">Arquivada</span>` : ""}`,
            subtitulo: `${CATEGORIAS_VERSAO[v.categoria]} · criada em ${data(v.criadoEm)} · ${v.responsavel}`,
            acoes: html`
                ${v.status !== "publicada" ? html`<button class="btn" type="button" data-acao="status" data-id="${v.id}">${icone("refresh-cw")}<span>Alterar status</span></button>
                    <button class="btn" type="button" data-acao="editar" data-id="${v.id}">${icone("pencil")}<span>Editar</span></button>` : ""}
                <button class="btn" type="button" data-acao="duplicar" data-id="${v.id}">${icone("copy")}<span>Duplicar</span></button>
                ${v.status === "publicada" ? html`<button class="btn" type="button" data-acao="rollback" data-id="${v.id}">${icone("undo-2")}<span>Solicitar rollback</span></button>` : ""}
                ${["planejada", "cancelada"].includes(v.status) ? html`<button class="btn btn--fantasma" type="button" data-acao="arquivar" data-id="${v.id}">${icone(v.arquivada ? "archive-restore" : "archive")}<span>${v.arquivada ? "Restaurar" : "Arquivar"}</span></button>` : ""}`
        })}
        ${avisoDemo()}
        <div class="layout-detalhe">
            <div class="layout-detalhe__principal">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Descrição e alterações</h2><span class="badge">${numero(v.alteracoes.length)}</span></div>
                    <div class="card__corpo">
                        <p class="texto-corrido">${v.descricao}</p>
                        <ul class="lista-recursos secao-topo">${v.alteracoes.map((a) => html`<li>${icone("git-commit-horizontal")}<span>${a.descricao} <span class="texto-terc">· ${CATEGORIAS_VERSAO[a.tipo] ?? a.tipo}</span></span></li>`)}</ul>
                    </div>
                </section>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Distribuição</h2></div>
                    <div class="card__corpo">${painelDistribuicao(v)}</div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                    <div class="card__corpo">${linhaDoTempo(E.historicoDe("versao", id))}</div>
                </section>
            </div>
            <aside class="layout-detalhe__lateral">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Informações</h2></div>
                    <div class="card__corpo">${listaDefinicao([
                        ["Número", v.numero], ["Status", badgeStatus(STATUS_VERSAO, v.status)], ["Criação", data(v.criadoEm)],
                        ["Previsão de lançamento", dataCurta(v.previsaoLancamento)], ["Publicada em", v.publicadaEm ? dataHora(v.publicadaEm) : "—"],
                        ["Responsável", v.responsavel], ["Ideia de origem", ideia ? html`<a class="link-forte" href="#/roadmap/ideia/${ideia.id}">${ideia.codigo} · ${ideia.titulo}</a>` : "—"],
                        ["Repositório", html`<span class="texto-terc">GitHub não conectado</span>`]
                    ])}</div>
                </section>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Funcionalidades</h2></div>
                    <div class="card__corpo">${v.funcionalidades.length ? html`<ul class="chips">${v.funcionalidades.map((c) => html`<li class="chip"><a href="#/funcionalidades/funcionalidade/${c}">${E.nomeFuncionalidade(c)}</a></li>`)}</ul>` : html`<p class="texto-terc">Nenhuma vinculada.</p>`}</div>
                </section>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Mudanças registradas</h2><span class="badge">${numero(mudancas.length)}</span></div>
                    ${mudancas.length ? html`<ul class="lista">${mudancas.map((m) => html`<li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/historico/mudanca/${m.id}">${m.codigo}</a><div class="lista__meta">${m.titulo}</div></div></li>`)}</ul>`
                        : html`<div class="card__corpo"><p class="texto-terc">Nenhuma mudança vinculada.</p></div>`}
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Público atual</h2><span class="badge">${numero(empresas.length)}</span></div>
                    ${empresas.length ? html`<ul class="lista">${empresas.slice(0, 8).map((b) => html`<li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/barbearias/${b.id}">${b.nome}</a></div>${badgeStatus(STATUS_BARBEARIA, b.status)}</li>`)}</ul>
                        ${empresas.length > 8 ? html`<p class="card__corpo texto-terc">+${empresas.length - 8} barbearias</p>` : ""}` : html`<div class="card__corpo"><p class="texto-terc">Nenhuma barbearia.</p></div>`}
                </section>
            </aside>
        </div>`);
    raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) return tratarRestauracaoDemo(() => renderVersao(view, id));
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        if (await executar(b.dataset.acao, b.dataset.id)) renderVersao(view, id);
    });
}

const RENDER = { "": secaoVisao, versoes: secaoVersoes, distribuicao: secaoDistribuicao, rollback: secaoRollback };

export function render(view, { parametros = [] }) {
    const [primeiro, segundo] = parametros;
    if (primeiro === "versao" && segundo) return renderVersao(view, segundo);
    const ativa = SECOES.some(([r]) => r === primeiro) ? primeiro : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Atualizações e versões", subtitulo: "Versões, distribuição e rollback do SaaS Barber", base: "#/atualizacoes",
        secoes: SECOES, ativa, kpis, recarregar,
        acoes: html`<button class="btn" type="button" data-topo="rollback">${icone("undo-2")}<span>Solicitar rollback</span></button>
            <button class="btn btn--primario" type="button" data-topo="versao">${icone("plus")}<span>Nova versão</span></button>`
    });
    ctx.raiz.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-topo]");
        if (!b) return;
        if (b.dataset.topo === "versao") await editarVersao();
        if (b.dataset.topo === "rollback") await solicitarRollback();
    });
    RENDER[ativa](ctx);
}
