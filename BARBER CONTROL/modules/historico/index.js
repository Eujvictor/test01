// =====================================================================
// MÓDULO 15 — HISTÓRICO DE ALTERAÇÕES (modo demonstrativo)
// Rotas: #/historico[/versoes|categorias|auditoria]  ·  #/historico/mudanca/<id>
// Referências técnicas (commit, branch, arquivo) são campos para uso
// futuro: o GitHub NÃO está conectado e nenhum commit real é inventado.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import * as E from "../../services/demo/evolucao.js";
import { CATEGORIAS_MUDANCA, NATUREZAS_MUDANCA, STATUS_MUDANCA, STATUS_VERSAO, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, data, dataHora } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { baixarCsv } from "../../js/utilities/csv.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { barrasHorizontais } from "../../js/components/grafico.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, kpi, badgeStatus, estadoVazio, listaDefinicao, linhaDoTempo, botaoIcone, campoBusca, campoSelect, molduraComAbas, novaRaiz
} from "../../js/components/ui.js";

const SECOES = [["", "Alterações"], ["versoes", "Por versão"], ["categorias", "Por categoria"], ["auditoria", "Auditoria"]];
const filtros = { busca: "", categoria: "", natureza: "", status: "", versaoId: "", dias: "" };
let versaoSelecionada = "";
let categoriaSelecionada = "";

const descreverPublico = (m) => (m.publico?.tipo === "nenhum" ? "Nenhuma (interna)" : E.descreverPublicoVersao(m.publico));
const versaoDe = (m) => (m.versaoId ? E.versao(m.versaoId) : null);

function avisoGithub() {
    return html`<div class="alerta alerta--info">${icone("git-pull-request")}<span><strong>GitHub não conectado.</strong> Os campos de commit, repositório, branch e arquivo estão prontos para a integração, mas nenhum commit real é mostrado ou inventado.</span></div>`;
}

function kpis() {
    const lista = E.mudancas();
    const recentes = lista.filter((m) => Date.now() - new Date(m.data) < 30 * 86400000);
    return html`
        ${kpi({ rotulo: "Total de alterações", valor: numero(lista.length), iconeNome: "history", nota: "Registros demonstrativos", destaque: true })}
        ${kpi({ rotulo: "Recentes", valor: numero(recentes.length), iconeNome: "clock", nota: "Últimos 30 dias" })}
        ${kpi({ rotulo: "Correções", valor: numero(lista.filter((m) => m.natureza === "correcao").length), iconeNome: "wrench", nota: "Natureza correção" })}
        ${kpi({ rotulo: "Funcionalidades adicionadas", valor: numero(lista.filter((m) => m.natureza === "nova_funcionalidade").length), iconeNome: "blocks", nota: "Natureza nova funcionalidade" })}
        ${kpi({ rotulo: "Alterações administrativas", valor: numero(lista.filter((m) => m.natureza === "administrativa").length), iconeNome: "user-cog", nota: "Planos, permissões, flags" })}
        ${kpi({ rotulo: "Versões registradas", valor: numero(E.versoes().filter((v) => !v.arquivada).length), iconeNome: "git-branch", nota: "Módulo 13" })}`;
}

async function editarMudanca(id = null) {
    const atual = id ? E.mudanca(id) : null;
    const versoes = E.versoes().slice().sort((a, b) => E.compararVersoes(b.numero, a.numero));
    const hoje = E.hojeTexto();
    const salvo = await abrirFormulario({
        titulo: atual ? `Editar ${atual.codigo}` : "Registrar alteração",
        descricao: "Registro demonstrativo. As referências técnicas ficam vazias até a integração com o GitHub.",
        campos: [
            { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, maxlength: 100 },
            { nome: "categoria", rotulo: "Categoria", tipo: "select", obrigatorio: true, opcoes: opcoes(CATEGORIAS_MUDANCA), largura: "meia" },
            { nome: "natureza", rotulo: "Natureza", tipo: "select", obrigatorio: true, opcoes: opcoes(NATUREZAS_MUDANCA), largura: "meia" },
            { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, maxlength: 1000 },
            { nome: "versaoId", rotulo: "Versão relacionada", tipo: "select", largura: "meia", opcoes: [["", "Nenhuma"], ...versoes.map((v) => [v.id, `${v.numero} · ${v.nome}`])] },
            { nome: "funcionalidadeChave", rotulo: "Funcionalidade relacionada", tipo: "select", largura: "meia", opcoes: [["", "Nenhuma"], ...E.funcionalidades().map((f) => [f.chave, f.nome])] },
            { nome: "data", rotulo: "Data", tipo: "data", obrigatorio: true, largura: "meia", validar: (v) => (v > hoje ? "A data não pode estar no futuro." : null) },
            { nome: "responsavel", rotulo: "Responsável", tipo: "texto", obrigatorio: true, maxlength: 80, largura: "meia" },
            { nome: "publico", rotulo: "Empresas afetadas", tipo: "select", obrigatorio: true, largura: "meia",
                opcoes: [["nenhum", "Nenhuma (alteração interna)"], ["todas", "Todas as barbearias"], ...S.planos().map((p) => [`plano:${p.id}`, `Plano ${p.nome}`]), ["grupo_testes", "Grupo de testes"]] },
            { nome: "status", rotulo: "Status", tipo: "select", obrigatorio: true, opcoes: opcoes(STATUS_MUDANCA), largura: "meia" },
            { tipo: "secao", rotulo: "Referências técnicas (preparadas para o GitHub)" },
            { nome: "repositorio", rotulo: "Repositório", tipo: "texto", maxlength: 120, largura: "meia" },
            { nome: "branch", rotulo: "Branch", tipo: "texto", maxlength: 120, largura: "meia" },
            { nome: "commit", rotulo: "Identificador do commit", tipo: "texto", maxlength: 40, largura: "meia", ajuda: "Opcional. 7 a 40 caracteres hexadecimais.",
                validar: (v) => (v && !/^[0-9a-f]{7,40}$/i.test(v.trim()) ? "Use 7 a 40 caracteres hexadecimais." : null) },
            { nome: "arquivo", rotulo: "Arquivo relacionado", tipo: "texto", maxlength: 200, largura: "meia" },
            { nome: "referencia", rotulo: "Referência da alteração", tipo: "texto", maxlength: 120, ajuda: "Ex.: número do pull request ou do chamado." }
        ],
        valores: atual
            ? { ...atual, ...atual.referencias, data: atual.data.slice(0, 10), versaoId: atual.versaoId ?? "", funcionalidadeChave: atual.funcionalidadeChave ?? "",
                publico: atual.publico?.tipo === "plano" ? `plano:${atual.publico.planoId}` : atual.publico?.tipo ?? "todas" }
            : { data: hoje, responsavel: "Proprietário do SaaS", status: "concluida", publico: "todas", categoria: "desenvolvimento", natureza: "melhoria" },
        textoSalvar: atual ? "Salvar alteração" : "Registrar",
        aoSalvar: (v) => E.salvarMudanca(v, id)
    });
    if (salvo) mostrarToast(atual ? "Registro atualizado." : `Alteração ${salvo.codigo} registrada.`, "sucesso");
    return salvo;
}

const COLUNAS = [
    { chave: "codigo", rotulo: "Identificador", render: (m) => html`<a class="link-forte num" href="#/historico/mudanca/${m.id}">${m.codigo}</a>` },
    { chave: "titulo", rotulo: "Título", render: (m) => html`<span class="celula-limite">${m.titulo}</span><span class="celula-sub">${NATUREZAS_MUDANCA[m.natureza]}</span>` },
    { chave: "categoria", rotulo: "Categoria", valor: (m) => CATEGORIAS_MUDANCA[m.categoria], render: (m) => CATEGORIAS_MUDANCA[m.categoria] },
    { chave: "descricao", rotulo: "Descrição", ordenavel: false, render: (m) => html`<span class="celula-limite texto-pequeno">${m.descricao}</span>` },
    { chave: "versao", rotulo: "Versão", valor: (m) => versaoDe(m)?.numero ?? "", render: (m) => (versaoDe(m) ? html`<a class="link-forte" href="#/atualizacoes/versao/${m.versaoId}">${versaoDe(m).numero}</a>` : "—") },
    { chave: "data", rotulo: "Data", render: (m) => data(m.data) },
    { chave: "responsavel", rotulo: "Responsável", render: (m) => html`<span class="celula-limite texto-pequeno">${m.responsavel}</span>` },
    { chave: "empresas", rotulo: "Empresas afetadas", classe: "col-num", valor: (m) => E.empresasAfetadas(m), render: (m) => numero(E.empresasAfetadas(m)) },
    { chave: "status", rotulo: "Status", valor: (m) => m.status, render: (m) => badgeStatus(STATUS_MUDANCA, m.status) },
    { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (m) => html`<div class="acoes-linha">
        ${botaoIcone({ acao: "ver", id: m.id, nomeIcone: "eye", rotulo: `Ver ${m.codigo}` })}${botaoIcone({ acao: "editar", id: m.id, nomeIcone: "pencil", rotulo: `Editar ${m.codigo}` })}</div>` }
];

const COLUNAS_CSV = [
    { rotulo: "Identificador", valor: (m) => m.codigo }, { rotulo: "Título", valor: (m) => m.titulo },
    { rotulo: "Categoria", valor: (m) => CATEGORIAS_MUDANCA[m.categoria] }, { rotulo: "Natureza", valor: (m) => NATUREZAS_MUDANCA[m.natureza] },
    { rotulo: "Descrição", valor: (m) => m.descricao }, { rotulo: "Versão", valor: (m) => versaoDe(m)?.numero ?? "" },
    { rotulo: "Funcionalidade", valor: (m) => (m.funcionalidadeChave ? E.nomeFuncionalidade(m.funcionalidadeChave) : "") },
    { rotulo: "Data", valor: (m) => data(m.data) }, { rotulo: "Responsável", valor: (m) => m.responsavel },
    { rotulo: "Empresas afetadas", valor: (m) => E.empresasAfetadas(m) }, { rotulo: "Status", valor: (m) => STATUS_MUDANCA[m.status].rotulo },
    { rotulo: "Commit", valor: (m) => m.referencias.commit }, { rotulo: "Branch", valor: (m) => m.referencias.branch },
    { rotulo: "Observação", valor: () => "DADOS DEMONSTRATIVOS · GitHub não conectado" }
];

function tabelaMudancas(container, linhas, porPagina = 12) {
    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "data", direcao: "desc" }, porPagina, vazio: "Nenhuma alteração encontrada.", rotulo: "Alterações" });
    container.appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());
    return tabela;
}

function secaoAlteracoes({ secao, atualizarIndicadores }) {
    const versoes = E.versoes().slice().sort((a, b) => E.compararVersoes(b.numero, a.numero));
    renderizar(secao, html`
        ${avisoGithub()}
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Tabela de alterações</h2>
                <div class="pagina-cabecalho__acoes">
                    <span class="badge" data-contagem></span>
                    <button class="btn btn--pequeno" type="button" data-acao="exportar">${icone("download")}<span>Exportar CSV</span></button>
                    <button class="btn btn--primario btn--pequeno" type="button" data-acao="nova">${icone("plus")}<span>Registrar alteração</span></button>
                </div>
            </div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fMdBusca", valor: filtros.busca, placeholder: "Pesquisar identificador, título ou descrição" })}
                ${campoSelect({ id: "fMdCategoria", rotulo: "Categoria", valor: filtros.categoria, opcoes: [["", "Todas as categorias"], ...opcoes(CATEGORIAS_MUDANCA)] })}
                ${campoSelect({ id: "fMdNatureza", rotulo: "Natureza", valor: filtros.natureza, opcoes: [["", "Todas as naturezas"], ...opcoes(NATUREZAS_MUDANCA)] })}
                ${campoSelect({ id: "fMdVersao", rotulo: "Versão", valor: filtros.versaoId, opcoes: [["", "Todas as versões"], ["sem", "Sem versão"], ...versoes.map((v) => [v.id, v.numero])] })}
                ${campoSelect({ id: "fMdStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_MUDANCA)] })}
                ${campoSelect({ id: "fMdDias", rotulo: "Período", valor: filtros.dias, opcoes: [["", "Todo o período"], ["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"]] })}
            </div>
            <div data-tabela></div>
        </section>`);
    const linhas = () => E.filtrarMudancas(filtros);
    const tabela = tabelaMudancas(secao.querySelector("[data-tabela]"), linhas);
    const contar = () => { secao.querySelector("[data-contagem]").textContent = `${numero(linhas().length)} registros`; };
    contar();
    const refiltrar = () => { tabela.definirLinhas(linhas()); contar(); };
    secao.querySelector("#fMdBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; refiltrar(); });
    [["#fMdCategoria", "categoria"], ["#fMdNatureza", "natureza"], ["#fMdVersao", "versaoId"], ["#fMdStatus", "status"], ["#fMdDias", "dias"]].forEach(([sel, chave]) =>
        secao.querySelector(sel).addEventListener("change", (e) => { filtros[chave] = e.target.value; refiltrar(); }));
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b || b.dataset.acao === "restaurar-demo") return;
        try {
            if (b.dataset.acao === "nova" && (await editarMudanca())) { refiltrar(); atualizarIndicadores(); }
            if (b.dataset.acao === "editar" && (await editarMudanca(b.dataset.id))) { tabela.atualizarLinhas(linhas()); atualizarIndicadores(); }
            if (b.dataset.acao === "ver") window.location.hash = `#/historico/mudanca/${b.dataset.id}`;
            if (b.dataset.acao === "exportar") {
                const lista = linhas().sort((x, y) => y.data.localeCompare(x.data));
                if (!lista.length) return mostrarToast("Nada para exportar com os filtros atuais.", "atencao");
                baixarCsv(`barber-control-historico-DEMO-${E.hojeTexto()}.csv`, COLUNAS_CSV, lista);
                mostrarToast(`${numero(lista.length)} alterações exportadas (dados demonstrativos).`, "sucesso");
            }
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

function secaoPorVersao({ secao }) {
    const versoes = E.versoes().slice().sort((a, b) => E.compararVersoes(b.numero, a.numero));
    if (!versaoSelecionada) versaoSelecionada = versoes[0]?.id ?? "";
    renderizar(secao, html`
        <div class="barra-filtros barra-filtros--solta">${campoSelect({ id: "fPorVersao", rotulo: "Versão", valor: versaoSelecionada, opcoes: versoes.map((v) => [v.id, `${v.numero} · ${v.nome}`]) })}</div>
        <div data-conteudo></div>`);
    const desenhar = () => {
        const v = E.versao(versaoSelecionada);
        const alvo = secao.querySelector("[data-conteudo]");
        if (!v) { renderizar(alvo, estadoVazio({ iconeNome: "git-branch", titulo: "Nenhuma versão" })); return; }
        renderizar(alvo, html`
            <div class="grade grade--2 secao">
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">${v.numero} · ${v.nome}</h2>${badgeStatus(STATUS_VERSAO, v.status)}</div>
                    <div class="card__corpo">${listaDefinicao([
                        ["Alterações planejadas", v.alteracoes.map((a) => a.descricao).join("; ")],
                        ["Funcionalidades", v.funcionalidades.map(E.nomeFuncionalidade).join(", ") || "—"],
                        ["Publicada em", v.publicadaEm ? dataHora(v.publicadaEm) : "—"]
                    ])}<a class="btn btn--pequeno secao-topo" href="#/atualizacoes/versao/${v.id}">${icone("external-link")}<span>Abrir versão</span></a></div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Linha do tempo da versão</h2></div>
                    <div class="card__corpo">${linhaDoTempo(E.historicoDe("versao", v.id))}</div>
                </section>
            </div>
            <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Mudanças registradas</h2></div><div data-tabela></div></section>`);
        tabelaMudancas(alvo.querySelector("[data-tabela]"), () => E.mudancas().filter((m) => m.versaoId === v.id), 8);
    };
    desenhar();
    secao.querySelector("#fPorVersao").addEventListener("change", (e) => { versaoSelecionada = e.target.value; desenhar(); });
}

function secaoPorCategoria({ secao }) {
    const contagem = Object.entries(CATEGORIAS_MUDANCA).map(([k, rotulo]) => ({ chave: k, rotulo, valor: E.mudancas().filter((m) => m.categoria === k).length }));
    renderizar(secao, html`
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Alterações por categoria</h2></div>
                <div class="card__corpo">${barrasHorizontais({ titulo: "Alterações por categoria", formatar: numero, itens: contagem.map((c) => ({ rotulo: c.rotulo, valor: c.valor })) })}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Consultar categoria</h2></div>
                <div class="card__corpo">
                    <div class="segmentos" role="group" aria-label="Categoria">${contagem.map((c) => html`
                        <button class="segmentos__item" type="button" data-categoria="${c.chave}" aria-pressed="${String(categoriaSelecionada === c.chave)}">${c.rotulo}<span class="num">${c.valor}</span></button>`)}</div>
                </div>
            </section>
        </div>
        <section class="card"><div class="card__cabecalho"><h2 class="card__titulo" data-titulo>Selecione uma categoria</h2></div><div data-tabela></div></section>`);

    const desenhar = () => {
        const alvo = secao.querySelector("[data-tabela]");
        alvo.replaceChildren();
        secao.querySelector("[data-titulo]").textContent = categoriaSelecionada ? `Alterações · ${CATEGORIAS_MUDANCA[categoriaSelecionada]}` : "Selecione uma categoria";
        if (!categoriaSelecionada) { renderizar(alvo, estadoVazio({ iconeNome: "folder-search", titulo: "Escolha uma categoria acima" })); return; }
        tabelaMudancas(alvo, () => E.mudancas().filter((m) => m.categoria === categoriaSelecionada), 10);
    };
    desenhar();
    secao.addEventListener("click", (e) => {
        const b = e.target.closest("[data-categoria]");
        if (!b) return;
        categoriaSelecionada = b.dataset.categoria;
        secao.querySelectorAll("[data-categoria]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        desenhar();
    });

}

function secaoAuditoria({ secao }) {
    const ROTULOS = { versao: "Versão", rollback: "Rollback", grupo_testes: "Grupo de testes", funcionalidade: "Funcionalidade", flag: "Feature flag", liberacao: "Liberação individual", plano: "Plano" };
    renderizar(secao, html`
        <div class="alerta alerta--info">${icone("scroll-text")}<span>Operações administrativas dos módulos 13 (versões) e 14 (funcionalidades), registradas pelo painel (demonstração).</span></div>
        <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Auditoria de evolução</h2><span class="badge">${numero(E.auditoriaEvolucao().length)}</span></div><div data-tabela></div></section>`);
    const tabela = criarTabela({
        colunas: [
            { chave: "data", rotulo: "Data", render: (h) => dataHora(h.data) },
            { chave: "entidade", rotulo: "Área", valor: (h) => ROTULOS[h.entidade], render: (h) => ROTULOS[h.entidade] },
            { chave: "acao", rotulo: "Operação" },
            { chave: "descricao", rotulo: "Descrição", render: (h) => html`<span class="celula-limite">${h.descricao}</span>` }
        ],
        ordenacao: { chave: "data", direcao: "desc" }, porPagina: 15, rotulo: "Auditoria"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(E.auditoriaEvolucao());
}

function renderMudanca(view, id) {
    const raiz = novaRaiz(view);
    const m = E.mudanca(id);
    const voltar = { href: "#/historico", rotulo: "Histórico de alterações" };
    if (!m) {
        renderizar(raiz, html`${cabecalho({ titulo: "Registro não encontrado", voltar })}<section class="card">${estadoVazio({ iconeNome: "history", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const v = versaoDe(m);
    const ref = m.referencias;
    const semRef = html`<span class="texto-terc">Não informado (GitHub não conectado)</span>`;
    renderizar(raiz, html`
        ${cabecalho({
            titulo: m.titulo, voltar, extra: badgeStatus(STATUS_MUDANCA, m.status),
            subtitulo: `${m.codigo} · ${CATEGORIAS_MUDANCA[m.categoria]} · ${NATUREZAS_MUDANCA[m.natureza]} · ${data(m.data)}`,
            acoes: html`<button class="btn" type="button" data-acao="editar">${icone("pencil")}<span>Editar</span></button>`
        })}
        ${avisoDemo()}
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Detalhes</h2></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Descrição", m.descricao], ["Versão relacionada", v ? html`<a class="link-forte" href="#/atualizacoes/versao/${v.id}">${v.numero} · ${v.nome}</a>` : "—"],
                    ["Funcionalidade", m.funcionalidadeChave ? html`<a class="link-forte" href="#/funcionalidades/funcionalidade/${m.funcionalidadeChave}">${E.nomeFuncionalidade(m.funcionalidadeChave)}</a>` : "—"],
                    ["Responsável", m.responsavel], ["Empresas afetadas", `${numero(E.empresasAfetadas(m))} · ${descreverPublico(m)}`],
                    ["Origem do registro", m.origem === "automatica" ? "Automática (módulos 13/14)" : m.origem === "seed" ? "Dado inicial de demonstração" : "Manual"]
                ])}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Referências técnicas</h2></div>
                <div class="card__corpo">
                    ${listaDefinicao([
                        ["Repositório", ref.repositorio || semRef], ["Branch", ref.branch || semRef], ["Commit", ref.commit ? html`<code>${ref.commit}</code>` : semRef],
                        ["Arquivo", ref.arquivo || semRef], ["Referência", ref.referencia || semRef], ["Versão associada", v?.numero ?? "—"]
                    ])}
                    ${avisoGithub()}
                </div>
            </section>
        </div>
        <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Histórico do registro</h2></div><div class="card__corpo">${linhaDoTempo(E.historicoDe("mudanca", m.id))}</div></section>`);
    raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) return tratarRestauracaoDemo(() => renderMudanca(view, id));
        if (e.target.closest("[data-acao=editar]")) { try { if (await editarMudanca(id)) renderMudanca(view, id); } catch (falha) { mostrarToast(falha.message, "erro"); } }
    });
}

const RENDER = { "": secaoAlteracoes, versoes: secaoPorVersao, categorias: secaoPorCategoria, auditoria: secaoAuditoria };

export function render(view, { parametros = [] }) {
    const [primeiro, segundo] = parametros;
    if (primeiro === "mudanca" && segundo) return renderMudanca(view, segundo);
    const ativa = SECOES.some(([r]) => r === primeiro) ? primeiro : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Histórico de alterações", subtitulo: "Mudanças de desenvolvimento, banco, interface, segurança e administração", base: "#/historico",
        secoes: SECOES, ativa, kpis, recarregar, classeKpis: "grade--kpi-3"
    });
    RENDER[ativa](ctx);
}
