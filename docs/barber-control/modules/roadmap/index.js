// =====================================================================
// MÓDULO 16 — ROADMAP E SOLICITAÇÕES (modo demonstrativo)
// Rotas: #/roadmap[/linha-do-tempo|solicitacoes|priorizacao|votacao]
//        #/roadmap/ideia/<id>
// Votos são fictícios e nenhuma solicitação é enviada às barbearias.
// A priorização usa critérios e pesos explícitos (sem aleatoriedade).
// =====================================================================
import { MODO_DEMO } from "../../js/demo.js";
import * as S from "../../services/demo/saas.js";
import * as E from "../../services/demo/evolucao.js";
import {
    COLUNAS_KANBAN, STATUS_IDEIA, ORIGENS_IDEIA, CATEGORIAS_IDEIA, PRIORIDADES_IDEIA, ESCALA_1_5, STATUS_VERSAO, CATEGORIAS_VERSAO, opcoes
} from "../../services/demo/catalogo.js";
import { html, icone, renderizar, escapar } from "../../js/utilities/dom.js";
import { numero, data, dataHora } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { barrasHorizontais } from "../../js/components/grafico.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, kpi, badgeStatus, estadoVazio, listaDefinicao, linhaDoTempo, botaoIcone, campoBusca, campoSelect, molduraComAbas, novaRaiz
} from "../../js/components/ui.js";
import { camposVersao } from "../atualizacoes/index.js";

const SECOES = [["", "Kanban"], ["linha-do-tempo", "Roadmap"], ["solicitacoes", "Solicitações"], ["priorizacao", "Priorização"], ["votacao", "Votação"]];
const COLUNAS = Object.keys(COLUNAS_KANBAN);
const filtros = { busca: "", prioridade: "", origem: "" };
const dataCurta = (t) => (t ? t.split("-").reverse().join("/") : "—");
const CRITERIOS = { impacto: "Impacto no negócio", empresas: "Empresas beneficiadas", urgencia: "Urgência", tecnica: "Importância técnica", esforco: "Esforço estimado (inverso)" };

function kpis() {
    const lista = E.ideias();
    const contar = (st) => numero(lista.filter((i) => i.status === st).length);
    return html`
        ${kpi({ rotulo: "Total de ideias", valor: numero(lista.length), iconeNome: "lightbulb", nota: "Todas as origens", destaque: true })}
        ${kpi({ rotulo: "Solicitações recebidas", valor: numero(lista.filter((i) => i.origem === "barbearia").length), iconeNome: "store", nota: "De barbearias" })}
        ${kpi({ rotulo: "Em análise", valor: contar("analise"), iconeNome: "search", nota: "" })}
        ${kpi({ rotulo: "Aprovadas", valor: contar("aprovada"), iconeNome: "circle-check", nota: "Aguardando planejamento" })}
        ${kpi({ rotulo: "Em desenvolvimento", valor: contar("desenvolvimento"), iconeNome: "hammer", nota: `${lista.filter((i) => i.status === "testes").length} em testes` })}
        ${kpi({ rotulo: "Concluídas", valor: contar("concluida"), iconeNome: "flag", nota: "" })}
        ${kpi({ rotulo: "Canceladas", valor: contar("cancelada"), iconeNome: "circle-x", nota: "" })}`;
}

// ---------------------------------------------------------------------
// Formulários e ações
// ---------------------------------------------------------------------
function camposIdeia(novo, origemFixa = null) {
    const empresas = [...S.barbearias()].filter((b) => b.status !== "cancelada").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return [
        { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, maxlength: 100 },
        { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, maxlength: 800 },
        { nome: "categoria", rotulo: "Categoria", tipo: "select", obrigatorio: true, opcoes: opcoes(CATEGORIAS_IDEIA), largura: "meia" },
        { nome: "origem", rotulo: "Origem", tipo: "select", obrigatorio: true, largura: "meia", opcoes: origemFixa ? [[origemFixa, ORIGENS_IDEIA[origemFixa]]] : opcoes(ORIGENS_IDEIA) },
        { nome: "barbeariaId", rotulo: "Barbearia solicitante", tipo: "select", largura: "meia", opcoes: [["", "Nenhuma"], ...empresas.map((b) => [b.id, b.nome])],
            validarVazio: true, validar: (v, x) => (x.origem === "barbearia" && !v ? "Selecione a barbearia que fez a solicitação." : null) },
        { nome: "prioridade", rotulo: "Prioridade", tipo: "select", obrigatorio: true, opcoes: opcoes(PRIORIDADES_IDEIA), largura: "meia" },
        ...(novo ? [{ nome: "status", rotulo: "Coluna inicial", tipo: "select", obrigatorio: true, opcoes: opcoes(COLUNAS_KANBAN), largura: "meia" }] : []),
        { nome: "responsavel", rotulo: "Responsável", tipo: "texto", obrigatorio: true, maxlength: 80, largura: "meia" },
        { nome: "previsao", rotulo: "Previsão", tipo: "data", largura: "meia" },
        { tipo: "secao", rotulo: "Critérios de priorização (1 a 5)" },
        { nome: "impacto", rotulo: "Impacto esperado", tipo: "select", obrigatorio: true, opcoes: ESCALA_1_5, largura: "meia" },
        { nome: "urgencia", rotulo: "Urgência", tipo: "select", obrigatorio: true, opcoes: ESCALA_1_5, largura: "meia" },
        { nome: "tecnica", rotulo: "Importância técnica", tipo: "select", obrigatorio: true, opcoes: ESCALA_1_5, largura: "meia" },
        { nome: "esforco", rotulo: "Estimativa de esforço", tipo: "select", obrigatorio: true, opcoes: ESCALA_1_5, largura: "meia" }
    ];
}

async function editarIdeia(id = null, origemFixa = null) {
    const atual = id ? E.ideia(id) : null;
    const salvo = await abrirFormulario({
        titulo: atual ? `Editar ${atual.codigo}` : origemFixa === "barbearia" ? "Nova solicitação de barbearia" : "Nova ideia",
        descricao: "Registro demonstrativo. Nenhuma barbearia é notificada.",
        campos: camposIdeia(!atual, origemFixa),
        valores: atual
            ? { ...atual, barbeariaId: atual.barbeariaId ?? "", ...Object.fromEntries(Object.entries(atual.criterios).map(([k, v]) => [k, String(v)])) }
            : { origem: origemFixa ?? "interna", categoria: "funcionalidade", prioridade: "media", status: "recebida", responsavel: "Proprietário do SaaS", impacto: "3", urgencia: "3", tecnica: "3", esforco: "3" },
        textoSalvar: atual ? "Salvar" : "Registrar",
        aoSalvar: (v) => E.salvarIdeia(v, id)
    });
    if (salvo) mostrarToast(atual ? "Ideia atualizada." : `${salvo.codigo} registrada.`, "sucesso");
    return salvo;
}

async function acaoIdeia(acao, id) {
    const i = E.ideia(id);
    switch (acao) {
        case "ver": window.location.hash = `#/roadmap/ideia/${id}`; return false;
        case "editar": return Boolean(await editarIdeia(id));
        case "mover": {
            const ok = await abrirFormulario({
                titulo: `Mover ${i.codigo}`, campos: [{ nome: "status", rotulo: "Coluna", tipo: "select", obrigatorio: true, opcoes: opcoes(STATUS_IDEIA) }],
                valores: { status: i.status }, textoSalvar: "Mover", aoSalvar: (v) => E.moverIdeia(id, v.status)
            });
            if (ok) mostrarToast("Ideia movida.", "sucesso");
            return Boolean(ok);
        }
        case "prioridade": {
            const ok = await abrirFormulario({
                titulo: `Prioridade · ${i.codigo}`, descricao: `Atual: ${PRIORIDADES_IDEIA[i.prioridade].rotulo}`,
                campos: [{ nome: "prioridade", rotulo: "Nova prioridade", tipo: "select", obrigatorio: true, opcoes: opcoes(PRIORIDADES_IDEIA) }],
                valores: { prioridade: i.prioridade }, textoSalvar: "Alterar prioridade", aoSalvar: (v) => E.alterarPrioridadeIdeia(id, v.prioridade)
            });
            if (ok) mostrarToast("Prioridade alterada.", "sucesso");
            return Boolean(ok);
        }
        case "decisao": {
            const ok = await abrirFormulario({
                titulo: `Decisão administrativa · ${i.codigo}`, descricao: "Registro interno. A barbearia não é notificada (demonstração).",
                campos: [
                    { nome: "status", rotulo: "Decisão", tipo: "select", obrigatorio: true, opcoes: opcoes(STATUS_IDEIA) },
                    { nome: "decisao", rotulo: "Justificativa", tipo: "textarea", obrigatorio: true, maxlength: 400 }
                ],
                valores: { status: i.status, decisao: i.decisao }, textoSalvar: "Registrar decisão", aoSalvar: (v) => E.registrarDecisao(id, v)
            });
            if (ok) mostrarToast("Decisão registrada.", "sucesso");
            return Boolean(ok);
        }
        case "votar": {
            const empresas = [...S.barbearias()].filter((b) => b.status !== "cancelada" && !i.votos.some((v) => v.barbeariaId === b.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
            const ok = await abrirFormulario({
                titulo: `Registrar voto fictício · ${i.codigo}`, descricao: "Voto demonstrativo. Nenhuma empresa foi consultada.",
                campos: [{ nome: "barbeariaId", rotulo: "Votante", tipo: "select", opcoes: [["", "Voto interno da equipe"], ...empresas.map((b) => [b.id, b.nome])] }],
                textoSalvar: "Registrar voto", aoSalvar: (v) => E.votar(id, v.barbeariaId)
            });
            if (ok) mostrarToast("Voto fictício registrado.", "sucesso");
            return Boolean(ok);
        }
        case "versao": {
            const v = await abrirFormulario({
                titulo: `Criar versão planejada · ${i.codigo}`, descricao: "A versão é criada no módulo 13 como planejada e fica vinculada a esta ideia.",
                campos: camposVersao(),
                valores: {
                    numero: E.proximoNumero("minor"), nome: i.titulo, descricao: i.descricao, responsavel: i.responsavel, previsaoLancamento: i.previsao ?? "",
                    categoria: i.categoria === "funcionalidade" ? "funcionalidade" : i.categoria === "seguranca" ? "seguranca" : i.categoria === "desempenho" ? "desempenho" : "melhoria",
                    alteracoes: i.titulo
                },
                textoSalvar: "Criar versão", aoSalvar: (x) => E.converterEmVersao(id, x)
            });
            if (v) { mostrarToast(`Versão ${v.numero} criada como planejada.`, "sucesso"); window.location.hash = `#/atualizacoes/versao/${v.id}`; }
            return false;
        }
        default: return false;
    }
}

// ---------------------------------------------------------------------
// Kanban
// ---------------------------------------------------------------------
function cartao(i) {
    const p = E.pontuacao(i);
    const b = i.barbeariaId ? S.barbearia(i.barbeariaId) : null;
    const idx = COLUNAS.indexOf(i.status);
    return html`
        <article class="kanban__cartao" draggable="true" data-ideia="${i.id}" aria-label="${i.codigo}: ${i.titulo}">
            <div class="kanban__topo"><span class="num texto-terc">${i.codigo}</span>${badgeStatus(PRIORIDADES_IDEIA, i.prioridade)}</div>
            <a class="kanban__titulo link-forte" href="#/roadmap/ideia/${i.id}">${i.titulo}</a>
            <div class="kanban__meta">${ORIGENS_IDEIA[i.origem]}${b ? ` · ${b.nome}` : ""}</div>
            <div class="kanban__rodape">
                <span class="com-icone" title="Votos">${icone("thumbs-up")}${numero(i.votos.length)}</span>
                <span class="com-icone" title="Pontuação de priorização">${icone("gauge")}${p.total}</span>
                <span class="kanban__setas">
                    <button class="btn btn--fantasma btn--icone btn--pequeno" type="button" data-mover="${i.id}" data-para="${COLUNAS[idx - 1] ?? ""}" ${idx <= 0 ? "disabled" : ""} aria-label="Mover ${i.codigo} para ${COLUNAS_KANBAN[COLUNAS[idx - 1]] ?? "—"}">${icone("chevron-left")}</button>
                    <button class="btn btn--fantasma btn--icone btn--pequeno" type="button" data-mover="${i.id}" data-para="${COLUNAS[idx + 1] ?? ""}" ${idx >= COLUNAS.length - 1 ? "disabled" : ""} aria-label="Mover ${i.codigo} para ${COLUNAS_KANBAN[COLUNAS[idx + 1]] ?? "—"}">${icone("chevron-right")}</button>
                </span>
            </div>
        </article>`;
}

function secaoKanban({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        <div class="barra-filtros barra-filtros--solta">
            ${campoBusca({ id: "fKbBusca", valor: filtros.busca, placeholder: "Pesquisar ideia" })}
            ${campoSelect({ id: "fKbPrioridade", rotulo: "Prioridade", valor: filtros.prioridade, opcoes: [["", "Todas as prioridades"], ...opcoes(PRIORIDADES_IDEIA)] })}
            ${campoSelect({ id: "fKbOrigem", rotulo: "Origem", valor: filtros.origem, opcoes: [["", "Todas as origens"], ...opcoes(ORIGENS_IDEIA)] })}
            <button class="btn btn--primario" type="button" data-acao="nova">${icone("plus")}<span>Nova ideia</span></button>
        </div>
        <p class="nota-periodo texto-terc">${icone("info")}<span>Arraste os cartões entre as colunas ou use as setas de cada cartão.</span></p>
        <div class="kanban" data-kanban></div>
        <div data-canceladas></div>`);
    const desenhar = () => {
        const visiveis = E.ideias().filter((i) => (!filtros.prioridade || i.prioridade === filtros.prioridade) && (!filtros.origem || i.origem === filtros.origem) &&
            (!filtros.busca || `${i.codigo} ${i.titulo}`.toLowerCase().includes(filtros.busca.toLowerCase())));
        renderizar(secao.querySelector("[data-kanban]"), html`${COLUNAS.map((col) => {
            const lista = visiveis.filter((i) => i.status === col).sort((a, b) => E.pontuacao(b).total - E.pontuacao(a).total);
            return html`
                <section class="kanban__coluna" data-coluna="${col}" aria-label="${COLUNAS_KANBAN[col]}">
                    <header class="kanban__cabecalho"><h3>${COLUNAS_KANBAN[col]}</h3><span class="badge">${numero(lista.length)}</span></header>
                    <div class="kanban__lista">${lista.length ? lista.map(cartao) : html`<p class="kanban__vazio">Sem cartões</p>`}</div>
                </section>`;
        })}`);
        const canceladas = visiveis.filter((i) => i.status === "cancelada");
        renderizar(secao.querySelector("[data-canceladas]"), canceladas.length ? html`
            <section class="card secao-topo"><div class="card__cabecalho"><h2 class="card__titulo">Canceladas</h2><span class="badge">${numero(canceladas.length)}</span></div>
                <ul class="lista">${canceladas.map((i) => html`<li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/roadmap/ideia/${i.id}">${i.codigo} · ${i.titulo}</a><div class="lista__meta">${i.decisao}</div></div>
                    <button class="btn btn--pequeno" type="button" data-mover="${i.id}" data-para="recebida">${icone("rotate-ccw")}<span>Reabrir</span></button></li>`)}</ul></section>` : "");
    };
    desenhar();
    const mover = (id, para) => {
        if (!para) return;
        try { E.moverIdeia(id, para); mostrarToast(`Movida para ${STATUS_IDEIA[para].rotulo}.`, "sucesso"); desenhar(); atualizarIndicadores(); }
        catch (falha) { mostrarToast(falha.message, "erro"); }
    };
    secao.querySelector("#fKbBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; desenhar(); });
    secao.querySelector("#fKbPrioridade").addEventListener("change", (e) => { filtros.prioridade = e.target.value; desenhar(); });
    secao.querySelector("#fKbOrigem").addEventListener("change", (e) => { filtros.origem = e.target.value; desenhar(); });
    secao.addEventListener("click", async (e) => {
        const m = e.target.closest("[data-mover]");
        if (m && !m.disabled) return mover(m.dataset.mover, m.dataset.para);
        if (e.target.closest("[data-acao=nova]") && (await editarIdeia())) { desenhar(); atualizarIndicadores(); }
    });
    // Arrastar e soltar
    secao.addEventListener("dragstart", (e) => {
        const c = e.target.closest("[data-ideia]");
        if (!c) return;
        e.dataTransfer.setData("text/plain", c.dataset.ideia);
        c.classList.add("is-arrastando");
    });
    secao.addEventListener("dragend", (e) => e.target.closest("[data-ideia]")?.classList.remove("is-arrastando"));
    secao.addEventListener("dragover", (e) => { const col = e.target.closest("[data-coluna]"); if (col) { e.preventDefault(); col.classList.add("is-alvo"); } });
    secao.addEventListener("dragleave", (e) => e.target.closest("[data-coluna]")?.classList.remove("is-alvo"));
    secao.addEventListener("drop", (e) => {
        const col = e.target.closest("[data-coluna]");
        if (!col) return;
        e.preventDefault();
        col.classList.remove("is-alvo");
        const id = e.dataTransfer.getData("text/plain");
        if (id && E.ideia(id)?.status !== col.dataset.coluna) mover(id, col.dataset.coluna);
    });
}

// ---------------------------------------------------------------------
// Roadmap cronológico (ideias + versões do módulo 13)
// ---------------------------------------------------------------------
function trimestre(dataTexto) {
    const [a, m] = dataTexto.split("-").map(Number);
    return { chave: `${a}-T${Math.ceil(m / 3)}`, rotulo: `${Math.ceil(m / 3)}º trimestre de ${a}` };
}

function secaoLinhaDoTempo({ secao }) {
    const itens = [
        ...E.ideias().filter((i) => i.previsao && i.status !== "cancelada" && !i.versaoId).map((i) => ({
            tipo: "Ideia", data: i.previsao, titulo: i.titulo, link: `#/roadmap/ideia/${i.id}`, status: badgeStatus(STATUS_IDEIA, i.status),
            prioridade: badgeStatus(PRIORIDADES_IDEIA, i.prioridade), responsavel: i.responsavel, categoria: CATEGORIAS_IDEIA[i.categoria]
        })),
        ...E.versoes().filter((v) => !v.arquivada && v.status !== "cancelada" && (v.previsaoLancamento || v.publicadaEm)).map((v) => {
            const ideia = v.ideiaId ? E.ideia(v.ideiaId) : null;
            return {
                tipo: "Versão", data: (v.publicadaEm ?? "").slice(0, 10) || v.previsaoLancamento, titulo: `${v.numero} · ${v.nome}`, link: `#/atualizacoes/versao/${v.id}`,
                status: badgeStatus(STATUS_VERSAO, v.status), prioridade: ideia ? badgeStatus(PRIORIDADES_IDEIA, ideia.prioridade) : "",
                responsavel: v.responsavel, categoria: CATEGORIAS_VERSAO[v.categoria]
            };
        })
    ].sort((a, b) => a.data.localeCompare(b.data));
    const grupos = new Map();
    itens.forEach((it) => {
        const t = trimestre(it.data);
        if (!grupos.has(t.chave)) grupos.set(t.chave, { rotulo: t.rotulo, itens: [] });
        grupos.get(t.chave).itens.push(it);
    });
    const hoje = E.hojeTexto();
    renderizar(secao, html`
        <div class="alerta alerta--info">${icone("info")}<span>Previsões demonstrativas. Ideias já convertidas aparecem pela versão correspondente (módulo 13).</span></div>
        ${grupos.size ? html`<div class="roadmap">${[...grupos.entries()].map(([chave, g]) => html`
            <section class="roadmap__trimestre ${chave === trimestre(hoje).chave ? "is-atual" : ""}">
                <header class="roadmap__cabecalho"><h3>${g.rotulo}</h3>${chave === trimestre(hoje).chave ? html`<span class="badge badge--ouro">Trimestre atual</span>` : ""}</header>
                <ul class="roadmap__lista">${g.itens.map((it) => html`
                    <li class="roadmap__item roadmap__item--${it.tipo === "Versão" ? "versao" : "ideia"}">
                        <div class="roadmap__data num">${dataCurta(it.data)}</div>
                        <div class="roadmap__conteudo">
                            <a class="link-forte" href="${it.link}">${it.titulo}</a>
                            <div class="roadmap__etiquetas"><span class="badge">${it.tipo}</span>${it.status}${it.prioridade}</div>
                            <div class="lista__meta">${it.categoria} · ${it.responsavel}</div>
                        </div>
                    </li>`)}</ul>
            </section>`)}</div>` : html`<section class="card">${estadoVazio({ iconeNome: "map", titulo: "Nada planejado com previsão" })}</section>`}`);
}

// ---------------------------------------------------------------------
// Solicitações de barbearias
// ---------------------------------------------------------------------
function secaoSolicitacoes({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Solicitações de barbearias</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-acao="nova-solicitacao">${icone("plus")}<span>Nova solicitação</span></button></div>
            <div data-tabela></div>
        </section>`);
    const linhas = () => E.ideias().filter((i) => i.origem === "barbearia");
    const tabela = criarTabela({
        colunas: [
            { chave: "empresa", rotulo: "Empresa", valor: (i) => S.barbearia(i.barbeariaId)?.nome ?? "", render: (i) => html`<a class="link-forte" href="#/barbearias/${i.barbeariaId}">${S.barbearia(i.barbeariaId)?.nome ?? "—"}</a>` },
            { chave: "titulo", rotulo: "Solicitação", render: (i) => html`<a class="link-forte" href="#/roadmap/ideia/${i.id}">${i.titulo}</a><span class="celula-sub">${i.codigo}</span>` },
            { chave: "criadoEm", rotulo: "Data", render: (i) => data(i.criadoEm) },
            { chave: "categoria", rotulo: "Categoria", valor: (i) => CATEGORIAS_IDEIA[i.categoria], render: (i) => CATEGORIAS_IDEIA[i.categoria] },
            { chave: "prioridade", rotulo: "Prioridade", valor: (i) => i.prioridade, render: (i) => badgeStatus(PRIORIDADES_IDEIA, i.prioridade) },
            { chave: "status", rotulo: "Status", valor: (i) => i.status, render: (i) => badgeStatus(STATUS_IDEIA, i.status) },
            { chave: "decisao", rotulo: "Decisão administrativa", render: (i) => html`<span class="celula-limite texto-pequeno">${i.decisao || "Sem decisão"}</span>` },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (i) => html`<div class="acoes-linha">
                ${botaoIcone({ acao: "ver", id: i.id, nomeIcone: "eye", rotulo: `Ver ${i.codigo}` })}${botaoIcone({ acao: "decisao", id: i.id, nomeIcone: "gavel", rotulo: "Registrar decisão" })}</div>` }
        ],
        ordenacao: { chave: "criadoEm", direcao: "desc" }, vazio: "Nenhuma solicitação.", rotulo: "Solicitações"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b || b.dataset.acao === "restaurar-demo") return;
        try {
            if (b.dataset.acao === "nova-solicitacao") { if (await editarIdeia(null, "barbearia")) { tabela.definirLinhas(linhas()); atualizarIndicadores(); } return; }
            if (await acaoIdeia(b.dataset.acao, b.dataset.id)) { tabela.atualizarLinhas(linhas()); atualizarIndicadores(); }
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

// ---------------------------------------------------------------------
// Priorização (critérios explícitos)
// ---------------------------------------------------------------------
function secaoPriorizacao({ secao }) {
    const ativas = E.ideias().filter((i) => !["concluida", "cancelada"].includes(i.status));
    renderizar(secao, html`
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Como a pontuação é calculada</h2></div>
            <div class="card__corpo">
                <p class="texto-sec texto-pequeno">Cada critério vale de 1 a 5 e é convertido em pontos pelo peso abaixo. Esforço é inverso: quanto menor, mais pontos. "Empresas beneficiadas" conta a solicitante e as que votaram (cada 2 empresas = 1 nível, máximo 5). Total de 0 a 100, sem nenhum componente aleatório.</p>
                <ul class="chips secao-topo">${Object.entries(E.PESOS_PRIORIZACAO).map(([k, peso]) => html`<li class="chip">${CRITERIOS[k]} · ${peso} pts</li>`)}</ul>
            </div>
        </section>
        <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Ranking de priorização</h2><span class="badge">${numero(ativas.length)} ideias ativas</span></div><div data-tabela></div></section>`);
    const tabela = criarTabela({
        colunas: [
            { chave: "titulo", rotulo: "Ideia", render: (i) => html`<a class="link-forte" href="#/roadmap/ideia/${i.id}">${i.titulo}</a><span class="celula-sub">${i.codigo} · ${STATUS_IDEIA[i.status].rotulo}</span>` },
            { chave: "impacto", rotulo: "Impacto", classe: "col-num", valor: (i) => i.criterios.impacto, render: (i) => `${i.criterios.impacto}/5` },
            { chave: "empresas", rotulo: "Empresas", classe: "col-num", valor: (i) => E.empresasBeneficiadas(i), render: (i) => html`${E.empresasBeneficiadas(i)}<span class="celula-sub">nível ${E.pontuacao(i).notaEmpresas}/5</span>` },
            { chave: "urgencia", rotulo: "Urgência", classe: "col-num", valor: (i) => i.criterios.urgencia, render: (i) => `${i.criterios.urgencia}/5` },
            { chave: "tecnica", rotulo: "Técnica", classe: "col-num", valor: (i) => i.criterios.tecnica, render: (i) => `${i.criterios.tecnica}/5` },
            { chave: "esforco", rotulo: "Esforço", classe: "col-num", valor: (i) => i.criterios.esforco, render: (i) => `${i.criterios.esforco}/5` },
            {
                chave: "pontuacao", rotulo: "Pontuação", classe: "col-num", valor: (i) => E.pontuacao(i).total,
                render: (i) => { const p = E.pontuacao(i); return html`<strong class="num" title="${escapar(Object.entries(p.partes).map(([k, v]) => `${CRITERIOS[k]}: ${v}`).join(" · "))}">${p.total}</strong>`; }
            }
        ],
        ordenacao: { chave: "pontuacao", direcao: "desc" }, porPagina: 15, rotulo: "Ranking de priorização"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(ativas);
}

// ---------------------------------------------------------------------
// Votação
// ---------------------------------------------------------------------
function secaoVotacao({ secao }) {
    const desenhar = () => {
        const lista = E.ideias().filter((i) => i.status !== "cancelada").sort((a, b) => b.votos.length - a.votos.length);
        renderizar(secao, html`
            <div class="alerta alerta--info">${icone("info")}<span>Votação demonstrativa: os votos são fictícios e nenhuma empresa é consultada.</span></div>
            <div class="grade grade--2">
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Mais votadas</h2></div>
                    <div class="card__corpo">${barrasHorizontais({ titulo: "Mais votadas", formatar: (v) => `${v} voto${v === 1 ? "" : "s"}`, itens: lista.slice(0, 8).map((i) => ({ rotulo: i.titulo, valor: i.votos.length, link: `#/roadmap/ideia/${i.id}` })) })}</div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Registrar votos</h2></div>
                    <ul class="lista">${lista.slice(0, 10).map((i) => html`
                        <li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/roadmap/ideia/${i.id}">${i.titulo}</a>
                            <div class="lista__meta">${numero(i.votos.length)} votos · ${E.empresasBeneficiadas(i)} empresas</div></div>
                            <button class="btn btn--pequeno" type="button" data-acao="votar" data-id="${i.id}">${icone("thumbs-up")}<span>Votar</span></button></li>`)}</ul>
                </section>
            </div>`);
    };
    desenhar();
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao=votar]");
        if (!b) return;
        try { if (await acaoIdeia("votar", b.dataset.id)) desenhar(); } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

// ---------------------------------------------------------------------
// Detalhe da ideia
// ---------------------------------------------------------------------
function renderIdeia(view, id) {
    const raiz = novaRaiz(view);
    const i = E.ideia(id);
    const voltar = { href: "#/roadmap", rotulo: "Roadmap" };
    if (!i) {
        renderizar(raiz, html`${cabecalho({ titulo: "Ideia não encontrada", voltar })}<section class="card">${estadoVazio({ iconeNome: "lightbulb", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const b = i.barbeariaId ? S.barbearia(i.barbeariaId) : null;
    const v = i.versaoId ? E.versao(i.versaoId) : null;
    const p = E.pontuacao(i);
    const podeVersao = ["aprovada", "planejada"].includes(i.status) && !v;
    renderizar(raiz, html`
        ${cabecalho({
            titulo: i.titulo, voltar, extra: html`${badgeStatus(STATUS_IDEIA, i.status)}${badgeStatus(PRIORIDADES_IDEIA, i.prioridade)}`,
            subtitulo: `${i.codigo} · ${ORIGENS_IDEIA[i.origem]} · ${CATEGORIAS_IDEIA[i.categoria]} · ${data(i.criadoEm)}`,
            acoes: html`
                ${podeVersao ? html`<button class="btn btn--primario" type="button" data-acao="versao">${icone("git-branch-plus")}<span>Criar versão planejada</span></button>` : ""}
                <button class="btn" type="button" data-acao="mover">${icone("columns-3")}<span>Mover</span></button>
                <button class="btn" type="button" data-acao="prioridade">${icone("flag")}<span>Prioridade</span></button>
                <button class="btn" type="button" data-acao="decisao">${icone("gavel")}<span>Decisão</span></button>
                <button class="btn" type="button" data-acao="votar">${icone("thumbs-up")}<span>Votar</span></button>
                <button class="btn" type="button" data-acao="editar">${icone("pencil")}<span>Editar</span></button>`
        })}
        ${avisoDemo()}
        <div class="layout-detalhe">
            <div class="layout-detalhe__principal">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Descrição</h2></div>
                    <div class="card__corpo"><p class="texto-corrido">${i.descricao}</p>
                        ${i.decisao ? html`<div class="alerta alerta--info secao-topo">${icone("gavel")}<span><strong>Decisão administrativa:</strong> ${i.decisao}</span></div>` : ""}</div>
                </section>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Priorização</h2><span class="badge badge--ouro">${p.total} de 100 pontos</span></div>
                    <div class="card__corpo">${barrasHorizontais({ titulo: "Composição da pontuação", formatar: (x) => `${x.toLocaleString("pt-BR")} pts`,
                        itens: Object.entries(p.partes).map(([k, x]) => ({ rotulo: `${CRITERIOS[k]} · ${k === "empresas" ? `${E.empresasBeneficiadas(i)} empresas` : `${i.criterios[k]}/5`} · peso ${E.PESOS_PRIORIZACAO[k]}`, valor: x })) })}</div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                    <div class="card__corpo">${linhaDoTempo(E.historicoDe("ideia", i.id))}</div>
                </section>
            </div>
            <aside class="layout-detalhe__lateral">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Informações</h2></div>
                    <div class="card__corpo">${listaDefinicao([
                        ["Status", badgeStatus(STATUS_IDEIA, i.status)], ["Prioridade", badgeStatus(PRIORIDADES_IDEIA, i.prioridade)],
                        ["Origem", ORIGENS_IDEIA[i.origem]], ["Barbearia", b ? html`<a class="link-forte" href="#/barbearias/${b.id}">${b.nome}</a>` : "—"],
                        ["Responsável", i.responsavel], ["Previsão", dataCurta(i.previsao)],
                        ["Versão vinculada", v ? html`<a class="link-forte" href="#/atualizacoes/versao/${v.id}">${v.numero} · ${v.nome}</a>` : "Nenhuma"]
                    ])}</div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Votos fictícios</h2><span class="badge">${numero(i.votos.length)}</span></div>
                    ${i.votos.length ? html`<ul class="lista">${i.votos.slice().reverse().slice(0, 10).map((x) => html`<li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">${x.barbeariaId ? S.barbearia(x.barbeariaId)?.nome : "Voto interno"}</div><div class="lista__meta">${dataHora(x.data)}</div></div></li>`)}</ul>`
                        : html`<div class="card__corpo"><p class="texto-terc">Nenhum voto.</p></div>`}
                </section>
            </aside>
        </div>`);
    raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) return tratarRestauracaoDemo(() => renderIdeia(view, id));
        const btn = e.target.closest("[data-acao]");
        if (!btn) return;
        try { if (await acaoIdeia(btn.dataset.acao, id)) renderIdeia(view, id); } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

const RENDER = { "": secaoKanban, "linha-do-tempo": secaoLinhaDoTempo, solicitacoes: secaoSolicitacoes, priorizacao: secaoPriorizacao, votacao: secaoVotacao };

export async function render(view, contexto) {
    // Fora do modo demonstração: dados reais do Supabase (Master + MFA).
    if (!MODO_DEMO) {
        const real = await import("./real.js");
        return real.render(view, contexto);
    }
    const { parametros = [] } = contexto;
    const [primeiro, segundo] = parametros;
    if (primeiro === "ideia" && segundo) return renderIdeia(view, segundo);
    const ativa = SECOES.some(([r]) => r === primeiro) ? primeiro : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Roadmap e solicitações", subtitulo: "Ideias, solicitações das barbearias, priorização e planejamento", base: "#/roadmap",
        secoes: SECOES, ativa, kpis, recarregar,
        acoes: html`<button class="btn btn--primario" type="button" data-topo="ideia">${icone("plus")}<span>Nova ideia</span></button>`
    });
    ctx.raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-topo=ideia]") && (await editarIdeia())) recarregar();
    });
    RENDER[ativa](ctx);
}
