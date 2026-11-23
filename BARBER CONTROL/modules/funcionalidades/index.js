// =====================================================================
// MÓDULO 14 — GERENCIAMENTO DE FUNCIONALIDADES (modo demonstrativo)
// Rotas: #/funcionalidades[/planos|flags|liberacoes|alertas]
//        #/funcionalidades/funcionalidade/<chave>
// Três conceitos diferentes, sempre identificados:
//   1. Direito comercial  → o plano contratado inclui a funcionalidade
//   2. Feature flag       → controle técnico de disponibilização
//   3. Liberação individual → exceção administrativa para uma empresa
// Nenhum deles substitui a autorização no backend.
// =====================================================================
import { MODO_DEMO } from "../../js/demo.js";
import * as S from "../../services/demo/saas.js";
import * as E from "../../services/demo/evolucao.js";
import { CATEGORIAS_FUNCIONALIDADE, STATUS_FUNCIONALIDADE, TIPOS_LIBERACAO, STATUS_BARBEARIA, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, data } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { abrirPainel } from "../../js/components/painel.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, kpi, badgeStatus, estadoVazio, listaDefinicao, linhaDoTempo, botaoIcone, campoBusca, campoSelect, molduraComAbas, novaRaiz
} from "../../js/components/ui.js";

const SECOES = [["", "Catálogo"], ["planos", "Planos"], ["flags", "Feature flags"], ["liberacoes", "Liberação individual"], ["alertas", "Alertas"]];
const filtros = { busca: "", categoria: "", status: "" };
let barbeariaSelecionada = "";
const dataCurta = (t) => (t ? t.split("-").reverse().join("/") : "—");
const ESTADO_FLAG = { on: { rotulo: "Ativa", tom: "sucesso" }, off: { rotulo: "Desativada", tom: "neutro" } };

function avisoConceitos() {
    return html`
        <div class="conceitos">
            <div class="conceito">${icone("badge-check")}<div><strong>Direito comercial</strong><span>O plano contratado inclui a funcionalidade.</span></div></div>
            <div class="conceito">${icone("toggle-right")}<div><strong>Feature flag</strong><span>Controle técnico de quem recebe primeiro.</span></div></div>
            <div class="conceito">${icone("user-cog")}<div><strong>Liberação individual</strong><span>Exceção administrativa para uma empresa.</span></div></div>
        </div>
        <div class="alerta alerta--info">${icone("shield")}<span>Demonstração: nada aqui altera o acesso real das barbearias. Na integração, a decisão final será do backend (RLS e Edge Functions). Uma feature flag nunca substitui essa autorização.</span></div>`;
}

function kpis() {
    const lista = E.funcionalidades();
    const alertas = E.alertasFuncionalidades();
    return html`
        ${kpi({ rotulo: "Funcionalidades", valor: numero(lista.length), iconeNome: "blocks", nota: `${lista.filter((f) => f.status === "ativa").length} disponíveis`, destaque: true })}
        ${kpi({ rotulo: "Em beta ou planejadas", valor: numero(lista.filter((f) => f.status === "beta" || f.status === "planejada").length), iconeNome: "flask-conical", nota: "Ainda não gerais" })}
        ${kpi({ rotulo: "Feature flags", valor: numero(E.flags().length), iconeNome: "toggle-right", nota: `${E.flags().filter((f) => f.ativa).length} ativas` })}
        ${kpi({ rotulo: "Liberações individuais", valor: numero(E.liberacoes().filter((l) => l.ativa).length), iconeNome: "user-cog", nota: "Regras ativas" })}
        ${kpi({ rotulo: "Alertas de configuração", valor: numero(alertas.length), iconeNome: "triangle-alert", nota: `${alertas.filter((a) => a.gravidade === "alta").length} de gravidade alta` })}`;
}

// ---------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------
async function editarFuncionalidade(id = null) {
    const atual = id ? E.funcionalidade(id) : null;
    const salvo = await abrirFormulario({
        titulo: atual ? `Editar ${atual.nome}` : "Nova funcionalidade",
        descricao: "O identificador técnico é usado pelo código e não muda depois de criado.",
        campos: [
            { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, maxlength: 60, largura: "meia" },
            { nome: "chave", rotulo: "Identificador técnico", tipo: "texto", obrigatorio: true, maxlength: 40, largura: "meia", placeholder: "ex.: lista_espera", somenteLeitura: Boolean(atual) },
            { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, maxlength: 300 },
            { nome: "categoria", rotulo: "Categoria", tipo: "select", obrigatorio: true, opcoes: opcoes(CATEGORIAS_FUNCIONALIDADE), largura: "meia" },
            { nome: "status", rotulo: "Status", tipo: "select", obrigatorio: true, opcoes: opcoes(STATUS_FUNCIONALIDADE), largura: "meia" },
            { nome: "dependencias", rotulo: "Dependências", tipo: "checkboxes", opcoes: E.funcionalidades().filter((f) => f.id !== id).map((f) => [f.chave, f.nome]) }
        ],
        valores: atual ?? { categoria: "gestao", status: "planejada", dependencias: ["painel_admin"] },
        textoSalvar: atual ? "Salvar" : "Criar funcionalidade",
        aoSalvar: (v) => E.salvarFuncionalidade(v, id)
    });
    if (salvo) {
        mostrarToast(atual ? "Funcionalidade atualizada." : `Funcionalidade ${salvo.nome} criada.`, "sucesso");
        if (!atual) window.location.hash = `#/funcionalidades/funcionalidade/${salvo.chave}`;
    }
    return Boolean(salvo);
}

function secaoCatalogo({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        ${avisoConceitos()}
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Catálogo de funcionalidades</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-acao="nova">${icone("plus")}<span>Nova funcionalidade</span></button></div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fFnBusca", valor: filtros.busca, placeholder: "Pesquisar nome ou identificador" })}
                ${campoSelect({ id: "fFnCategoria", rotulo: "Categoria", valor: filtros.categoria, opcoes: [["", "Todas as categorias"], ...opcoes(CATEGORIAS_FUNCIONALIDADE)] })}
                ${campoSelect({ id: "fFnStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_FUNCIONALIDADE)] })}
            </div>
            <div data-tabela></div>
        </section>`);
    const linhas = () => E.funcionalidades().filter((f) => (!filtros.categoria || f.categoria === filtros.categoria) && (!filtros.status || f.status === filtros.status) &&
        (!filtros.busca || `${f.nome} ${f.chave}`.toLowerCase().includes(filtros.busca.toLowerCase())));
    const tabela = criarTabela({
        colunas: [
            { chave: "nome", rotulo: "Funcionalidade", render: (f) => html`<a class="link-forte" href="#/funcionalidades/funcionalidade/${f.chave}">${f.nome}</a><span class="celula-sub num">${f.chave}</span>` },
            { chave: "categoria", rotulo: "Categoria", valor: (f) => CATEGORIAS_FUNCIONALIDADE[f.categoria], render: (f) => CATEGORIAS_FUNCIONALIDADE[f.categoria] },
            { chave: "planos", rotulo: "Planos", ordenavel: false, render: (f) => { const p = E.planosComFuncionalidade(f.chave); return p.length ? html`<span class="chips chips--linha">${p.map((x) => html`<span class="chip">${x.nome}</span>`)}</span>` : html`<span class="texto-terc">Nenhum</span>`; } },
            { chave: "dependencias", rotulo: "Dependências", valor: (f) => f.dependencias.length, render: (f) => (f.dependencias.length ? html`<span class="celula-limite texto-pequeno">${f.dependencias.map(E.nomeFuncionalidade).join(", ")}</span>` : "—") },
            { chave: "criadoEm", rotulo: "Criação", render: (f) => data(f.criadoEm) },
            { chave: "status", rotulo: "Status", valor: (f) => f.status, render: (f) => badgeStatus(STATUS_FUNCIONALIDADE, f.status) },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (f) => html`<div class="acoes-linha">
                ${botaoIcone({ acao: "ver", id: f.chave, nomeIcone: "eye", rotulo: `Ver ${f.nome}` })}${botaoIcone({ acao: "editar", id: f.id, nomeIcone: "pencil", rotulo: `Editar ${f.nome}` })}</div>` }
        ],
        ordenacao: { chave: "nome", direcao: "asc" }, porPagina: 12, vazio: "Nenhuma funcionalidade encontrada.", rotulo: "Catálogo de funcionalidades"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());
    secao.querySelector("#fFnBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(linhas()); });
    secao.querySelector("#fFnCategoria").addEventListener("change", (e) => { filtros.categoria = e.target.value; tabela.definirLinhas(linhas()); });
    secao.querySelector("#fFnStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(linhas()); });
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b || b.dataset.acao === "restaurar-demo") return;
        if (b.dataset.acao === "ver") { window.location.hash = `#/funcionalidades/funcionalidade/${b.dataset.id}`; return; }
        try {
            if (b.dataset.acao === "nova" && (await editarFuncionalidade())) atualizarIndicadores();
            if (b.dataset.acao === "editar" && (await editarFuncionalidade(b.dataset.id))) { tabela.atualizarLinhas(linhas()); atualizarIndicadores(); }
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

// ---------------------------------------------------------------------
// Planos (comparativo + associação = direito comercial)
// ---------------------------------------------------------------------
function secaoPlanos({ secao, atualizarIndicadores }) {
    const desenhar = () => {
        const planos = S.planos().filter((p) => !p.arquivado);
        const categorias = Object.entries(CATEGORIAS_FUNCIONALIDADE);
        renderizar(secao, html`
            <div class="alerta alerta--info">${icone("badge-check")}<span><strong>Direito comercial.</strong> Clique numa célula para associar ou remover a funcionalidade do plano. As dependências são verificadas. Assinaturas existentes passam a ter o novo conjunto (demonstração).</span></div>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Comparativo de planos</h2><span class="texto-terc">${numero(planos.length)} planos · ${numero(E.funcionalidades().length)} funcionalidades</span></div>
                <div class="tabela-rolagem"><table class="tabela matriz matriz--planos">
                    <thead><tr><th scope="col">Funcionalidade</th>${planos.map((p) => html`<th scope="col" class="col-centro">${p.nome}<span class="celula-sub">${p.funcionalidades.length} recursos</span></th>`)}</tr></thead>
                    <tbody>${categorias.map(([cat, rotulo]) => {
                        const lista = E.funcionalidades().filter((f) => f.categoria === cat);
                        if (!lista.length) return "";
                        return html`<tr class="matriz__grupo"><th scope="rowgroup" colspan="${planos.length + 1}">${rotulo}</th></tr>
                            ${lista.map((f) => html`<tr><th scope="row"><a class="link-forte" href="#/funcionalidades/funcionalidade/${f.chave}">${f.nome}</a>${f.status !== "ativa" ? html` ${badgeStatus(STATUS_FUNCIONALIDADE, f.status)}` : ""}</th>
                                ${planos.map((p) => {
                                    const tem = p.funcionalidades.includes(f.chave);
                                    return html`<td class="col-centro"><button class="celula-plano ${tem ? "is-incluida" : ""}" type="button" data-plano="${p.id}" data-chave="${f.chave}"
                                        aria-pressed="${String(tem)}" aria-label="${tem ? "Remover" : "Incluir"} ${f.nome} ${tem ? "do" : "no"} plano ${p.nome}">${icone(tem ? "check" : "plus")}</button></td>`;
                                })}</tr>`)}`;
                    })}</tbody>
                </table></div>
            </section>`);
    };
    desenhar();
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-plano]");
        if (!b) return;
        const p = S.plano(b.dataset.plano);
        const f = E.funcionalidadePorChave(b.dataset.chave);
        const tem = p.funcionalidades.includes(f.chave);
        const ok = await confirmar({
            titulo: tem ? `Remover ${f.nome} do plano ${p.nome}?` : `Incluir ${f.nome} no plano ${p.nome}?`,
            mensagem: `${S.assinaturas().filter((a) => a.planoId === p.id && a.status !== "cancelada").length} assinaturas usam este plano (demonstração).`,
            textoConfirmar: tem ? "Remover" : "Incluir", perigo: tem
        });
        if (!ok) return;
        try {
            E.alternarFuncionalidadePlano(p.id, f.chave);
            mostrarToast(tem ? `${f.nome} removida do ${p.nome}.` : `${f.nome} incluída no ${p.nome}.`, "sucesso");
            desenhar(); atualizarIndicadores();
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

// ---------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------
async function editarFlag(id = null) {
    const atual = id ? E.flag(id) : null;
    const empresas = [...S.barbearias()].filter((b) => b.status !== "cancelada").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const hoje = E.hojeTexto();
    const fim = new Date(Date.now() + 30 * 86400000);
    const salvo = await abrirFormulario({
        titulo: atual ? `Editar flag ${atual.chave}` : "Nova feature flag",
        descricao: "Controle técnico de disponibilização. Não substitui o direito comercial nem a autorização no backend.",
        campos: [
            { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, maxlength: 60, largura: "meia" },
            { nome: "chave", rotulo: "Identificador", tipo: "texto", obrigatorio: true, maxlength: 44, largura: "meia", placeholder: "ff_nome_da_flag" },
            { nome: "funcionalidadeChave", rotulo: "Funcionalidade controlada", tipo: "select", obrigatorio: true, opcoes: E.funcionalidades().map((f) => [f.chave, f.nome]) },
            { nome: "descricao", rotulo: "Descrição", tipo: "textarea", maxlength: 300 },
            { nome: "percentual", rotulo: "Percentual de liberação (%)", tipo: "numero", obrigatorio: true, min: 0, max: 100, passo: 1, largura: "meia",
                validar: (v) => (Number.isInteger(v) ? null : "Use um número inteiro de 0 a 100.") },
            { nome: "inicio", rotulo: "Início", tipo: "data", obrigatorio: true, largura: "meia" },
            { nome: "validade", rotulo: "Validade", tipo: "data", obrigatorio: true, largura: "meia", validar: (v, x) => (x.inicio && v < x.inicio ? "A validade deve ser igual ou posterior ao início." : null) },
            { nome: "barbeariaIds", rotulo: "Empresas específicas (sempre incluídas)", tipo: "checkboxes", opcoes: empresas.map((b) => [b.id, b.nome]) }
        ],
        valores: atual ?? { percentual: 10, inicio: hoje, validade: `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}-${String(fim.getDate()).padStart(2, "0")}`, chave: "ff_" },
        textoSalvar: atual ? "Salvar flag" : "Criar flag",
        aoSalvar: (v) => E.salvarFlag(v, id)
    });
    if (salvo) mostrarToast(atual ? "Flag atualizada." : `Flag ${salvo.chave} criada (desativada).`, "sucesso");
    return Boolean(salvo);
}

async function detalhesFlag(id) {
    const f = E.flag(id);
    const empresas = S.barbearias().filter((b) => b.status !== "cancelada");
    const recebem = empresas.filter((b) => E.flagPermite(f, b.id));
    await abrirPainel({
        titulo: `Flag ${f.chave}`, descricao: f.descricao,
        conteudo: html`
            ${listaDefinicao([
                ["Funcionalidade", E.nomeFuncionalidade(f.funcionalidadeChave)], ["Estado", badgeStatus(ESTADO_FLAG, f.ativa ? "on" : "off")],
                ["Percentual", `${f.percentual}%`], ["Período", `${dataCurta(f.inicio)} a ${dataCurta(f.validade)}`],
                ["Empresas específicas", f.barbeariaIds.map((bid) => S.barbearia(bid)?.nome).join(", ") || "Nenhuma"],
                ["Recebem hoje (simulação)", `${recebem.length} de ${empresas.length} barbearias`]
            ])}
            <p class="texto-terc texto-pequeno secao-topo">A distribuição por percentual é determinística: cada barbearia sempre cai no mesmo grupo para a mesma flag.</p>
            <h4 class="secao__titulo secao__titulo--espaco previa-alcance">Histórico</h4>
            ${linhaDoTempo(E.historicoDe("flag", id))}`
    });
}

function secaoFlags({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        <div class="alerta alerta--info">${icone("toggle-right")}<span><strong>Feature flags</strong> definem quem recebe primeiro uma funcionalidade. A empresa ainda precisa do direito comercial ou de uma liberação individual.</span></div>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Feature flags</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-acao="nova-flag">${icone("plus")}<span>Nova flag</span></button></div>
            <div data-tabela></div>
        </section>`);
    const tabela = criarTabela({
        colunas: [
            { chave: "chave", rotulo: "Flag", render: (f) => html`<button class="link-botao link-forte num" type="button" data-acao="detalhes-flag" data-id="${f.id}">${f.chave}</button><span class="celula-sub">${f.nome}</span>` },
            { chave: "funcionalidadeChave", rotulo: "Funcionalidade", valor: (f) => E.nomeFuncionalidade(f.funcionalidadeChave), render: (f) => E.nomeFuncionalidade(f.funcionalidadeChave) },
            { chave: "percentual", rotulo: "Liberação", classe: "col-num", render: (f) => html`${f.percentual}%<span class="celula-sub">+${f.barbeariaIds.length} específicas</span>` },
            { chave: "validade", rotulo: "Validade", render: (f) => html`${dataCurta(f.validade)}${f.validade < E.hojeTexto() ? html`<span class="celula-sub texto-erro">vencida</span>` : ""}` },
            { chave: "ativa", rotulo: "Estado", valor: (f) => (f.ativa ? 1 : 0), render: (f) => badgeStatus(ESTADO_FLAG, f.ativa ? "on" : "off") },
            {
                chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
                render: (f) => html`<div class="acoes-linha">
                    ${botaoIcone({ acao: "detalhes-flag", id: f.id, nomeIcone: "eye", rotulo: `Detalhes de ${f.chave}` })}
                    ${botaoIcone({ acao: "editar-flag", id: f.id, nomeIcone: "pencil", rotulo: `Editar ${f.chave}` })}
                    ${botaoIcone({ acao: "alternar-flag", id: f.id, nomeIcone: f.ativa ? "toggle-right" : "toggle-left", rotulo: f.ativa ? `Desativar ${f.chave}` : `Ativar ${f.chave}`, perigo: f.ativa })}
                </div>`
            }
        ],
        ordenacao: { chave: "chave", direcao: "asc" }, vazio: "Nenhuma flag.", rotulo: "Feature flags"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(E.flags());
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        try {
            if (b.dataset.acao === "nova-flag" && (await editarFlag())) { tabela.definirLinhas(E.flags()); atualizarIndicadores(); }
            if (b.dataset.acao === "editar-flag" && (await editarFlag(b.dataset.id))) { tabela.atualizarLinhas(E.flags()); atualizarIndicadores(); }
            if (b.dataset.acao === "detalhes-flag") await detalhesFlag(b.dataset.id);
            if (b.dataset.acao === "alternar-flag") {
                const f = E.flag(b.dataset.id);
                if (f.ativa && !(await confirmar({ titulo: `Desativar ${f.chave}?`, mensagem: "As empresas deixam de receber a funcionalidade por esta flag (demonstração).", textoConfirmar: "Desativar", perigo: true }))) return;
                const ativa = E.alternarFlag(f.id);
                mostrarToast(ativa ? "Flag ativada (demonstração)." : "Flag desativada (demonstração).", "sucesso");
                tabela.atualizarLinhas(E.flags()); atualizarIndicadores();
            }
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

// ---------------------------------------------------------------------
// Liberação individual
// ---------------------------------------------------------------------
async function novaLiberacao(barbeariaId, funcionalidadeChave = "", tipo = "liberar") {
    const empresas = [...S.barbearias()].filter((b) => b.status !== "cancelada").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const ok = await abrirFormulario({
        titulo: "Liberação individual", descricao: "Exceção administrativa para uma empresa (demonstração).",
        campos: [
            { nome: "barbeariaId", rotulo: "Barbearia", tipo: "select", obrigatorio: true, opcoes: empresas.map((b) => [b.id, b.nome]) },
            { nome: "funcionalidadeChave", rotulo: "Funcionalidade", tipo: "select", obrigatorio: true, placeholderOpcao: "Selecione", opcoes: E.funcionalidades().map((f) => [f.chave, f.nome]) },
            { nome: "tipo", rotulo: "Tipo", tipo: "select", obrigatorio: true, opcoes: [["liberar", "Liberar"], ["temporario", "Acesso temporário"], ["bloquear", "Bloquear"]], largura: "meia" },
            { nome: "validade", rotulo: "Validade", tipo: "data", largura: "meia", ajuda: "Obrigatória para acesso temporário.",
                validarVazio: true, validar: (v, x) => (x.tipo === "temporario" && !v ? "Informe a validade do acesso temporário." : null) },
            { nome: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true, maxlength: 300 }
        ],
        valores: { barbeariaId, funcionalidadeChave, tipo },
        textoSalvar: "Registrar regra", aoSalvar: (v) => E.registrarLiberacao(v)
    });
    if (ok) mostrarToast("Regra individual registrada (demonstração).", "sucesso");
    return Boolean(ok);
}

function secaoLiberacoes({ secao, atualizarIndicadores }) {
    const empresas = [...S.barbearias()].filter((b) => b.status !== "cancelada").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    renderizar(secao, html`
        <div class="alerta alerta--info">${icone("user-cog")}<span><strong>Liberação individual</strong> é uma exceção ao plano de uma empresa. Um bloqueio individual prevalece sobre o plano e sobre as liberações.</span></div>
        <div class="barra-filtros barra-filtros--solta">
            ${campoSelect({ id: "fLbBarbearia", rotulo: "Barbearia", valor: barbeariaSelecionada, opcoes: [["", "Selecione uma barbearia"], ...empresas.map((b) => [b.id, b.nome])] })}
            <button class="btn btn--primario" type="button" data-acao="nova-liberacao">${icone("plus")}<span>Nova regra</span></button>
        </div>
        <div data-acesso></div>
        <section class="card secao-topo">
            <div class="card__cabecalho"><h2 class="card__titulo">Regras individuais</h2></div>
            <div data-tabela></div>
        </section>`);
    const tabela = criarTabela({
        colunas: [
            { chave: "barbeariaId", rotulo: "Barbearia", valor: (l) => S.barbearia(l.barbeariaId)?.nome ?? "", render: (l) => html`<a class="link-forte" href="#/barbearias/${l.barbeariaId}">${S.barbearia(l.barbeariaId)?.nome ?? "—"}</a>` },
            { chave: "funcionalidadeChave", rotulo: "Funcionalidade", valor: (l) => E.nomeFuncionalidade(l.funcionalidadeChave), render: (l) => E.nomeFuncionalidade(l.funcionalidadeChave) },
            { chave: "tipo", rotulo: "Tipo", valor: (l) => l.tipo, render: (l) => badgeStatus(TIPOS_LIBERACAO, l.tipo) },
            { chave: "validade", rotulo: "Validade", render: (l) => html`${dataCurta(l.validade)}${E.liberacaoVencida(l) ? html`<span class="celula-sub texto-erro">vencida</span>` : ""}` },
            { chave: "motivo", rotulo: "Motivo", render: (l) => html`<span class="celula-limite texto-pequeno">${l.motivo}</span>` },
            { chave: "ativa", rotulo: "Situação", valor: (l) => (l.ativa ? 1 : 0), render: (l) => (l.ativa ? html`<span class="badge badge--sucesso">Ativa</span>` : html`<span class="badge">Revogada</span>`) },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (l) => html`<div class="acoes-linha">
                ${botaoIcone({ acao: "historico-liberacao", id: l.id, nomeIcone: "history", rotulo: "Histórico" })}
                ${l.ativa ? botaoIcone({ acao: "revogar", id: l.id, nomeIcone: "x", rotulo: "Revogar regra", perigo: true }) : ""}</div>` }
        ],
        ordenacao: { chave: "barbeariaId", direcao: "asc" }, vazio: "Nenhuma regra individual.", rotulo: "Regras individuais"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const linhas = () => E.liberacoes().filter((l) => !barbeariaSelecionada || l.barbeariaId === barbeariaSelecionada);

    function desenharAcesso() {
        const alvo = secao.querySelector("[data-acesso]");
        tabela.definirLinhas(linhas());
        if (!barbeariaSelecionada) {
            renderizar(alvo, html`<section class="card">${estadoVazio({ iconeNome: "store", titulo: "Selecione uma barbearia", texto: "Veja o acesso efetivo a cada funcionalidade e de onde ele vem: plano, exceção, flag ou dependência." })}</section>`);
            return;
        }
        const b = S.barbearia(barbeariaSelecionada);
        const plano = S.planoDaBarbearia(b.id);
        const linhasAcesso = E.funcionalidades().map((f) => E.acessoEfetivo(b.id, f.chave));
        renderizar(alvo, html`
            <section class="card">
                <div class="card__cabecalho">
                    <div><h2 class="card__titulo">Acesso efetivo · ${b.nome}</h2><span class="texto-terc texto-pequeno">Plano ${plano?.nome ?? "—"} · ${STATUS_BARBEARIA[b.status].rotulo}</span></div>
                    <span class="badge badge--ouro">${linhasAcesso.filter((a) => a.liberado).length} de ${linhasAcesso.length} liberadas (simulação)</span>
                </div>
                <div class="tabela-rolagem"><table class="tabela">
                    <thead><tr><th scope="col">Funcionalidade</th><th scope="col">Plano</th><th scope="col">Exceção</th><th scope="col">Flag</th><th scope="col">Resultado</th><th scope="col"></th></tr></thead>
                    <tbody>${linhasAcesso.map((a) => html`
                        <tr>
                            <th scope="row" class="celula-normal">${a.funcionalidade.nome}</th>
                            <td>${a.direitoPlano ? html`<span class="marca-sim">${icone("check")}</span>` : html`<span class="marca-nao">${icone("minus")}</span>`}</td>
                            <td>${a.bloqueio ? badgeStatus(TIPOS_LIBERACAO, "bloquear") : a.excecao ? badgeStatus(TIPOS_LIBERACAO, a.excecao.tipo) : a.regrasVencidas.length ? html`<span class="badge badge--erro">Vencida</span>` : "—"}</td>
                            <td>${a.temFlag ? (a.flagOk ? html`<span class="badge badge--sucesso">Recebe</span>` : html`<span class="badge">Fora</span>`) : "—"}</td>
                            <td>${a.liberado ? html`<span class="badge badge--sucesso"><span class="ponto"></span>Liberada</span>` : html`<span class="badge badge--erro" title="${a.motivos.join(" ")}"><span class="ponto"></span>Bloqueada</span><span class="celula-sub celula-limite">${a.motivos.join(" ")}</span>`}</td>
                            <td class="col-acoes"><div class="acoes-linha">
                                ${botaoIcone({ acao: "liberar-rapido", id: a.funcionalidade.chave, nomeIcone: "lock-open", rotulo: `Liberar ${a.funcionalidade.nome}` })}
                                ${botaoIcone({ acao: "temporario-rapido", id: a.funcionalidade.chave, nomeIcone: "clock", rotulo: `Acesso temporário a ${a.funcionalidade.nome}` })}
                                ${botaoIcone({ acao: "bloquear-rapido", id: a.funcionalidade.chave, nomeIcone: "lock", rotulo: `Bloquear ${a.funcionalidade.nome}`, perigo: true })}
                            </div></td>
                        </tr>`)}</tbody>
                </table></div>
            </section>`);
    }
    desenharAcesso();
    secao.querySelector("#fLbBarbearia").addEventListener("change", (e) => { barbeariaSelecionada = e.target.value; desenharAcesso(); });
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        const { acao, id } = b.dataset;
        try {
            let mudou = false;
            if (acao === "nova-liberacao") mudou = await novaLiberacao(barbeariaSelecionada || "");
            if (acao.endsWith("-rapido")) mudou = await novaLiberacao(barbeariaSelecionada, id, acao.replace("-rapido", ""));
            if (acao === "revogar") {
                if (!(await confirmar({ titulo: "Revogar regra individual?", mensagem: "A empresa volta a seguir apenas o plano e as flags.", textoConfirmar: "Revogar", perigo: true }))) return;
                E.revogarLiberacao(id); mostrarToast("Regra revogada.", "sucesso"); mudou = true;
            }
            if (acao === "historico-liberacao") await abrirPainel({ titulo: "Histórico da regra", conteudo: linhaDoTempo(E.historicoDe("liberacao", id)) });
            if (mudou) { desenharAcesso(); atualizarIndicadores(); }
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

function secaoAlertas({ secao }) {
    const alertas = E.alertasFuncionalidades();
    const ICONES = { vencida: "calendar-x", flag_desativada: "toggle-left", conflito: "git-merge", sem_direito: "badge-x", dependencia: "link-2-off" };
    const TOM = { alta: "erro", media: "atencao", baixa: "neutro" };
    renderizar(secao, html`
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Alertas de configuração</h2><span class="badge">${numero(alertas.length)}</span></div>
            ${alertas.length ? html`<ul class="lista">${alertas.map((a) => html`
                <li class="lista__item alerta-atividade alerta-atividade--${TOM[a.gravidade]}">
                    <span class="lista__icone">${icone(ICONES[a.tipo])}</span>
                    <div class="lista__conteudo"><div class="lista__titulo">${a.titulo}</div><div class="lista__meta">${a.descricao}</div></div>
                    <a class="btn btn--pequeno" href="${a.link}">Resolver</a>
                </li>`)}</ul>` : estadoVazio({ iconeNome: "check", titulo: "Nenhum conflito de configuração" })}
        </section>`);
}

// ---------------------------------------------------------------------
// Detalhe da funcionalidade
// ---------------------------------------------------------------------
function renderFuncionalidade(view, chave) {
    const raiz = novaRaiz(view);
    const f = E.funcionalidadePorChave(chave);
    const voltar = { href: "#/funcionalidades", rotulo: "Catálogo" };
    if (!f) {
        renderizar(raiz, html`${cabecalho({ titulo: "Funcionalidade não encontrada", voltar })}<section class="card">${estadoVazio({ iconeNome: "blocks", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const planos = E.planosComFuncionalidade(chave);
    const flagsF = E.flags().filter((x) => x.funcionalidadeChave === chave);
    const regras = E.liberacoes().filter((l) => l.funcionalidadeChave === chave && l.ativa);
    const dependentes = E.funcionalidades().filter((x) => x.dependencias.includes(chave));
    const versoes = E.versoes().filter((v) => v.funcionalidades.includes(chave));
    renderizar(raiz, html`
        ${cabecalho({
            titulo: f.nome, voltar, extra: badgeStatus(STATUS_FUNCIONALIDADE, f.status),
            subtitulo: `${f.chave} · ${CATEGORIAS_FUNCIONALIDADE[f.categoria]} · criada em ${data(f.criadoEm)}`,
            acoes: html`<button class="btn" type="button" data-acao="editar" data-id="${f.id}">${icone("pencil")}<span>Editar</span></button>`
        })}
        ${avisoDemo()}
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Detalhes</h2></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Descrição", f.descricao], ["Identificador técnico", f.chave], ["Categoria", CATEGORIAS_FUNCIONALIDADE[f.categoria]],
                    ["Status", badgeStatus(STATUS_FUNCIONALIDADE, f.status)],
                    ["Dependências", f.dependencias.length ? f.dependencias.map(E.nomeFuncionalidade).join(", ") : "Nenhuma"],
                    ["Usada por", dependentes.length ? dependentes.map((x) => x.nome).join(", ") : "Nenhuma"],
                    ["Planos (direito comercial)", planos.length ? planos.map((p) => p.nome).join(", ") : "Nenhum"],
                    ["Versões relacionadas", versoes.length ? html`${versoes.map((v, i) => html`${i ? ", " : ""}<a class="link-forte" href="#/atualizacoes/versao/${v.id}">${v.numero}</a>`)}` : "Nenhuma"]
                ])}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                <div class="card__corpo">${linhaDoTempo(E.historicoDe("funcionalidade", f.id))}</div>
            </section>
        </div>
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Feature flags</h2><span class="badge">${numero(flagsF.length)}</span></div>
                ${flagsF.length ? html`<ul class="lista">${flagsF.map((x) => html`<li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo num">${x.chave}</div><div class="lista__meta">${x.percentual}% · até ${dataCurta(x.validade)}</div></div>${badgeStatus(ESTADO_FLAG, x.ativa ? "on" : "off")}</li>`)}</ul>`
                    : html`<div class="card__corpo"><p class="texto-terc">Sem flag: segue apenas o plano e as exceções.</p></div>`}
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Liberações individuais</h2><span class="badge">${numero(regras.length)}</span></div>
                ${regras.length ? html`<ul class="lista">${regras.map((l) => html`<li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/barbearias/${l.barbeariaId}">${S.barbearia(l.barbeariaId)?.nome}</a><div class="lista__meta">${l.motivo}</div></div>${badgeStatus(TIPOS_LIBERACAO, l.tipo)}</li>`)}</ul>`
                    : html`<div class="card__corpo"><p class="texto-terc">Nenhuma exceção ativa.</p></div>`}
            </section>
        </div>`);
    raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) return tratarRestauracaoDemo(() => renderFuncionalidade(view, chave));
        if (e.target.closest("[data-acao=editar]")) { try { if (await editarFuncionalidade(f.id)) renderFuncionalidade(view, chave); } catch (falha) { mostrarToast(falha.message, "erro"); } }
    });
}

const RENDER = { "": secaoCatalogo, planos: secaoPlanos, flags: secaoFlags, liberacoes: secaoLiberacoes, alertas: secaoAlertas };

export async function render(view, contexto) {
    // Fora do modo demonstração: dados reais do Supabase (Master + MFA).
    if (!MODO_DEMO) {
        const real = await import("./real.js");
        return real.render(view, contexto);
    }
    const { parametros = [] } = contexto;
    const [primeiro, segundo] = parametros;
    if (primeiro === "funcionalidade" && segundo) return renderFuncionalidade(view, segundo);
    const ativa = SECOES.some(([r]) => r === primeiro) ? primeiro : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Funcionalidades", subtitulo: "Catálogo, planos, feature flags e liberações individuais", base: "#/funcionalidades",
        secoes: SECOES, ativa, kpis, recarregar, classeKpis: "grade--kpi-5"
    });
    RENDER[ativa](ctx);
}
