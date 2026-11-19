// =====================================================================
// MÓDULO 08 — NOTIFICAÇÕES / COMUNICADOS (modo demonstrativo)
// Rotas: #/notificacoes        → central de comunicados
//        #/notificacoes/<id>   → detalhe
// "Publicar" apenas muda o status do registro: nada é enviado por
// e-mail, WhatsApp, SMS ou para o sistema Barber.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import * as O from "../../services/demo/operacao.js";
import { CATEGORIAS_COMUNICADO, PRIORIDADES_COMUNICADO, STATUS_COMUNICADO, STATUS_BARBEARIA, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, data, dataHora } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { abrirPainel } from "../../js/components/painel.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, kpi, estadoVazio, listaDefinicao,
    linhaDoTempo, botaoIcone, campoBusca, campoSelect, novaRaiz
} from "../../js/components/ui.js";

const filtros = { busca: "", status: "", categoria: "", publico: "" };
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dataCurta = (texto) => (texto ? texto.split("-").reverse().join("/") : "—");

function avisoEnvio() {
    return html`<div class="alerta alerta--info">${icone("info")}<span>Publicação demonstrativa: o comunicado fica registrado apenas neste painel. Nenhum e-mail, WhatsApp, SMS ou aviso no sistema Barber é enviado.</span></div>`;
}

// ---------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------
function campos(atual) {
    const empresas = [...S.barbearias()].filter((b) => b.status !== "cancelada").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return [
        { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, maxlength: 90 },
        { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, maxlength: 1200, validar: (v) => (v.length < 10 ? "Escreva pelo menos 10 caracteres." : null) },
        { nome: "categoria", rotulo: "Categoria", tipo: "select", obrigatorio: true, opcoes: opcoes(CATEGORIAS_COMUNICADO), largura: "meia" },
        { nome: "prioridade", rotulo: "Prioridade", tipo: "select", obrigatorio: true, opcoes: opcoes(PRIORIDADES_COMUNICADO), largura: "meia" },
        { tipo: "secao", rotulo: "Público-alvo" },
        { nome: "publico", rotulo: "Público", tipo: "select", obrigatorio: true, opcoes: O.opcoesPublico() },
        {
            nome: "barbeariaIds", rotulo: "Barbearias específicas", tipo: "checkboxes", opcoes: empresas.map((b) => [b.id, b.nome]),
            ajuda: "Usado apenas quando o público é \"Barbearias específicas\".",
            validarVazio: true, validar: (v, valores) => (valores.publico === "especificas" && !v.length ? "Selecione ao menos uma barbearia." : null)
        },
        { tipo: "secao", rotulo: "Datas e publicação" },
        { nome: "criadoEm", rotulo: "Data de criação", tipo: "texto", largura: "meia", somenteLeitura: true, ajuda: "Preenchida automaticamente." },
        { nome: "acao", rotulo: "Ao salvar", tipo: "select", obrigatorio: true, largura: "meia", opcoes: [
            ["rascunho", "Salvar como rascunho"], ["agendar", "Agendar publicação (demo)"], ["publicar", "Publicar agora (demo)"]] },
        {
            nome: "publicacaoEm", rotulo: "Data de publicação", tipo: "data", largura: "meia",
            validarVazio: true, validar: (v, valores) => (valores.acao === "agendar" && !v ? "Informe a data da publicação agendada." : null)
        },
        { nome: "encerramentoEm", rotulo: "Data de encerramento", tipo: "data", largura: "meia", ajuda: "Opcional." }
    ].map((c) => (c.nome === "criadoEm" ? { ...c, padrao: atual ? dataHora(atual.criadoEm) : "Agora" } : c));
}

async function editar(id = null) {
    const atual = id ? O.comunicado(id) : null;
    const salvo = await abrirFormulario({
        titulo: atual ? "Editar comunicado" : "Novo comunicado",
        descricao: "A publicação é demonstrativa: nada é enviado.",
        campos: campos(atual),
        valores: atual ? {
            ...atual, publico: O.valorDoPublico(atual.publico), barbeariaIds: atual.publico.barbeariaIds ?? [],
            acao: atual.status === "agendado" ? "agendar" : "rascunho", criadoEm: dataHora(atual.criadoEm)
        } : { categoria: "geral", prioridade: "normal", publico: "todas", acao: "rascunho" },
        textoSalvar: atual ? "Salvar alterações" : "Salvar comunicado",
        aoSalvar: (v) => O.salvarComunicado(v, id)
    });
    if (salvo) {
        const mensagens = { rascunho: "Rascunho salvo.", agendado: "Publicação demonstrativa agendada.", publicado: "Comunicado publicado (demonstração)." };
        mostrarToast(mensagens[salvo.status], "sucesso");
        if (!id) window.location.hash = `#/notificacoes/${salvo.id}`;
    }
    return Boolean(salvo);
}

function previa(c) {
    const alcance = O.alcancePublico(c.publico);
    return html`
        <article class="previa-comunicado previa-comunicado--${c.prioridade}">
            <div class="previa-comunicado__topo">
                <span class="badge">${CATEGORIAS_COMUNICADO[c.categoria]}</span>
                ${badgeStatus(PRIORIDADES_COMUNICADO, c.prioridade)}
            </div>
            <h3>${c.titulo}</h3>
            <p>${c.descricao}</p>
            <span class="texto-terc">Barber Control · ${c.publicacaoEm ? dataCurta(c.publicacaoEm) : "data da publicação"}</span>
        </article>
        <h4 class="secao__titulo secao__titulo--espaco previa-alcance">Alcance estimado: ${numero(alcance.length)} barbearias · ${O.descreverPublico(c.publico)}</h4>
        ${alcance.length ? html`<ul class="chips">${alcance.slice(0, 30).map((b) => html`<li class="chip">${b.nome}</li>`)}${alcance.length > 30 ? html`<li class="chip">+${alcance.length - 30}</li>` : ""}</ul>`
            : html`<p class="texto-terc">Nenhuma barbearia corresponde a este público.</p>`}
        ${avisoEnvio()}`;
}

async function visualizarEPublicar(id) {
    const c = O.comunicado(id);
    const podePublicar = c.status === "rascunho" || c.status === "agendado";
    const escolha = await abrirPainel({
        titulo: "Pré-visualização",
        descricao: "Assim o comunicado aparecerá no painel de avisos das barbearias.",
        conteudo: previa(c),
        acoes: podePublicar ? [{ valor: "publicar", rotulo: "Publicar agora (demonstração)" }] : []
    });
    if (escolha !== "publicar") return false;
    O.publicarComunicado(id);
    mostrarToast("Comunicado publicado (demonstração; nada foi enviado).", "sucesso");
    return true;
}

async function arquivar(id) {
    const ok = await confirmar({ titulo: "Arquivar comunicado?", mensagem: "Ele sai da lista ativa, mas continua no histórico.", textoConfirmar: "Arquivar", perigo: true });
    if (!ok) return false;
    O.arquivarComunicado(id);
    mostrarToast("Comunicado arquivado.", "sucesso");
    return true;
}

async function executar(acao, id) {
    try {
        if (acao === "novo") return await editar();
        if (acao === "editar") return await editar(id);
        if (acao === "visualizar") return await visualizarEPublicar(id);
        if (acao === "arquivar") return await arquivar(id);
        if (acao === "ver") { window.location.hash = `#/notificacoes/${id}`; return false; }
    } catch (falha) {
        mostrarToast(falha.message, "erro");
    }
    return false;
}

// ---------------------------------------------------------------------
// Central
// ---------------------------------------------------------------------
function linhas() {
    const termo = normalizar(filtros.busca);
    return O.comunicados().filter((c) =>
        (!termo || normalizar(c.titulo).includes(termo)) &&
        (!filtros.status || c.status === filtros.status) &&
        (!filtros.categoria || c.categoria === filtros.categoria) &&
        (!filtros.publico || O.valorDoPublico(c.publico) === filtros.publico));
}

const COLUNAS = [
    { chave: "titulo", rotulo: "Comunicado", render: (c) => html`<a class="link-forte" href="#/notificacoes/${c.id}">${c.titulo}</a><span class="celula-sub">${CATEGORIAS_COMUNICADO[c.categoria]}</span>` },
    { chave: "publico", rotulo: "Público-alvo", valor: (c) => O.descreverPublico(c.publico), render: (c) => O.descreverPublico(c.publico) },
    { chave: "data", rotulo: "Data", valor: (c) => c.publicacaoEm ?? c.criadoEm.slice(0, 10), render: (c) => html`${dataCurta(c.publicacaoEm ?? c.criadoEm.slice(0, 10))}<span class="celula-sub">${c.publicacaoEm ? "publicação" : "criação"}</span>` },
    { chave: "alcance", rotulo: "Alcance", classe: "col-num", valor: (c) => O.alcanceComunicado(c), render: (c) => html`${numero(O.alcanceComunicado(c))}<span class="celula-sub">${c.alcanceRegistrado !== null && c.alcanceRegistrado !== undefined ? "registrado" : "estimado"}</span>` },
    { chave: "status", rotulo: "Status", valor: (c) => STATUS_COMUNICADO[c.status].rotulo, render: (c) => badgeStatus(STATUS_COMUNICADO, c.status) },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (c) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "visualizar", id: c.id, nomeIcone: "eye", rotulo: "Pré-visualizar" })}
            ${c.status === "rascunho" || c.status === "agendado" ? botaoIcone({ acao: "editar", id: c.id, nomeIcone: "pencil", rotulo: "Editar" }) : ""}
            ${c.status !== "arquivado" ? botaoIcone({ acao: "arquivar", id: c.id, nomeIcone: "archive", rotulo: "Arquivar", perigo: true }) : ""}
        </div>`
    }
];

function kpis() {
    const lista = O.comunicados();
    const contar = (st) => numero(lista.filter((c) => c.status === st).length);
    return html`
        ${kpi({ rotulo: "Total de comunicados", valor: numero(lista.length), iconeNome: "megaphone", nota: "Todos os registros" })}
        ${kpi({ rotulo: "Publicados", valor: contar("publicado"), iconeNome: "circle-check", nota: "Publicação demonstrativa" })}
        ${kpi({ rotulo: "Agendados", valor: contar("agendado"), iconeNome: "calendar-clock", nota: "Aguardando a data" })}
        ${kpi({ rotulo: "Rascunhos", valor: contar("rascunho"), iconeNome: "file-pen", nota: "Não publicados" })}
        ${kpi({ rotulo: "Arquivados", valor: contar("arquivado"), iconeNome: "archive", nota: "Fora da lista ativa" })}`;
}

function renderLista(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Notificações", subtitulo: "Comunicados administrativos para as barbearias",
            acoes: html`<button class="btn btn--primario" type="button" data-acao="novo">${icone("plus")}<span>Novo comunicado</span></button>`
        })}
        ${avisoDemo()}
        ${avisoEnvio()}
        <section class="grade grade--kpi grade--kpi-5 secao" data-kpis>${kpis()}</section>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Histórico de comunicados</h2></div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fBusca", valor: filtros.busca, placeholder: "Pesquisar comunicado" })}
                ${campoSelect({ id: "fStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_COMUNICADO)] })}
                ${campoSelect({ id: "fCategoria", rotulo: "Categoria", valor: filtros.categoria, opcoes: [["", "Todas as categorias"], ...opcoes(CATEGORIAS_COMUNICADO)] })}
                ${campoSelect({ id: "fPublico", rotulo: "Público", valor: filtros.publico, opcoes: [["", "Todos os públicos"], ...O.opcoesPublico()] })}
                <button class="btn btn--fantasma" type="button" data-acao="limpar">${icone("filter-x")}<span>Limpar</span></button>
            </div>
            <div data-tabela></div>
        </section>`);

    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "data", direcao: "desc" }, vazio: "Nenhum comunicado corresponde aos filtros.", rotulo: "Comunicados" });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());

    const atualizar = () => { renderizar(raiz.querySelector("[data-kpis]"), kpis()); tabela.atualizarLinhas(linhas()); };
    let espera;
    raiz.querySelector("#fBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { filtros.busca = e.target.value; tabela.definirLinhas(linhas()); }, 150);
    });
    [["#fStatus", "status"], ["#fCategoria", "categoria"], ["#fPublico", "publico"]].forEach(([sel, chave]) =>
        raiz.querySelector(sel).addEventListener("change", (e) => { filtros[chave] = e.target.value; tabela.definirLinhas(linhas()); }));

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderLista(view));
        if (acao === "limpar") { Object.assign(filtros, { busca: "", status: "", categoria: "", publico: "" }); return renderLista(view); }
        if (await executar(acao, id)) atualizar();
    });
}

function renderDetalhe(view, id) {
    const raiz = novaRaiz(view);
    const c = O.comunicados().find((x) => x.id === id);
    if (!c) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Comunicado não encontrado", voltar: { href: "#/notificacoes", rotulo: "Notificações" } })}
            <section class="card">${estadoVazio({ iconeNome: "megaphone", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const editavel = c.status === "rascunho" || c.status === "agendado";
    const alcance = O.alcancePublico(c.publico);
    renderizar(raiz, html`
        ${cabecalho({
            titulo: c.titulo,
            voltar: { href: "#/notificacoes", rotulo: "Notificações" },
            extra: badgeStatus(STATUS_COMUNICADO, c.status),
            subtitulo: `${CATEGORIAS_COMUNICADO[c.categoria]} · ${O.descreverPublico(c.publico)}`,
            acoes: html`
                <button class="btn ${editavel ? "btn--primario" : ""}" type="button" data-acao="visualizar" data-id="${c.id}">${icone("eye")}<span>${editavel ? "Visualizar e publicar" : "Pré-visualizar"}</span></button>
                ${editavel ? html`<button class="btn" type="button" data-acao="editar" data-id="${c.id}">${icone("pencil")}<span>Editar</span></button>` : ""}
                ${c.status !== "arquivado" ? html`<button class="btn btn--perigo" type="button" data-acao="arquivar" data-id="${c.id}">${icone("archive")}<span>Arquivar</span></button>` : ""}`
        })}
        ${avisoEnvio()}
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Conteúdo</h2>${badgeStatus(PRIORIDADES_COMUNICADO, c.prioridade)}</div>
                <div class="card__corpo"><p class="texto-corrido">${c.descricao}</p></div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Informações</h2></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Status", badgeStatus(STATUS_COMUNICADO, c.status)],
                    ["Criado em", dataHora(c.criadoEm)],
                    ["Publicação", c.publicadoEm ? dataHora(c.publicadoEm) : c.publicacaoEm ? `${dataCurta(c.publicacaoEm)} (agendada)` : "—"],
                    ["Encerramento", dataCurta(c.encerramentoEm)],
                    ["Público-alvo", O.descreverPublico(c.publico)],
                    ["Empresas alcançadas", c.alcanceRegistrado !== null && c.alcanceRegistrado !== undefined ? `${numero(c.alcanceRegistrado)} (registrado na publicação)` : `${numero(alcance.length)} (estimativa atual)`]
                ])}</div>
            </section>
        </div>
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Barbearias no público atual</h2><span class="badge">${numero(alcance.length)}</span></div>
                ${alcance.length ? html`<ul class="lista">${alcance.slice(0, 12).map((b) => html`
                    <li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/barbearias/${b.id}">${b.nome}</a>
                        <div class="lista__meta">${b.cidade}/${b.estado}</div></div>${badgeStatus(STATUS_BARBEARIA, b.status)}</li>`)}</ul>
                    ${alcance.length > 12 ? html`<p class="card__corpo texto-terc">+${alcance.length - 12} barbearias</p>` : ""}`
                    : estadoVazio({ iconeNome: "store", titulo: "Público vazio" })}
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                <div class="card__corpo">${linhaDoTempo(O.historicoDe("comunicado", c.id))}</div>
            </section>
        </div>`);

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        if (await executar(botao.dataset.acao, botao.dataset.id)) renderDetalhe(view, id);
    });
}

export function render(view, { parametros = [] }) {
    if (parametros[0]) renderDetalhe(view, parametros[0]);
    else renderLista(view);
}
