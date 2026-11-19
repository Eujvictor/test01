// =====================================================================
// MÓDULO 02 — BARBEARIAS (modo demonstrativo, persistência local)
// Rotas: #/barbearias            → lista
//        #/barbearias/<id>       → perfil com abas
// =====================================================================
import * as S from "../../services/demo/saas.js";
import { MODO_DEMO } from "../../js/demo.js";
import { STATUS_BARBEARIA, STATUS_ASSINATURA, STATUS_USUARIO, STATUS_TRANSACAO, TIPOS_USUARIO, PERIODICIDADES, UFS, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda, data, tempoRelativo, mesReferencia } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { montarAbas } from "../../js/components/abas.js";
import { graficoBarras } from "../../js/components/grafico.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, kpi, estadoVazio, listaDefinicao,
    linhaDoTempo, botaoIcone, campoBusca, campoSelect, iniciais
} from "../../js/components/ui.js";
import * as Acoes from "../compartilhado/acoes.js";

// Filtros e aba ativa sobrevivem à navegação lista ⇄ perfil.
const filtros = { busca: "", plano: "", status: "" };
const abaPorBarbearia = new Map();

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digitos = (t) => String(t ?? "").replace(/\D/g, "");

// ---------------------------------------------------------------------
// Formulário de cadastro/edição
// ---------------------------------------------------------------------
function camposBarbearia(novo) {
    return [
        { tipo: "secao", rotulo: "Dados comerciais" },
        { nome: "nome", rotulo: "Nome da barbearia", tipo: "texto", obrigatorio: true, maxlength: 80, largura: "meia" },
        { nome: "razaoSocial", rotulo: "Razão social", tipo: "texto", maxlength: 120, largura: "meia" },
        {
            nome: "documento", rotulo: "CNPJ", tipo: "texto", maxlength: 18, largura: "meia", placeholder: "00.000.000/0000-00",
            inputmode: "numeric", validar: (v) => (digitos(v).length === 14 ? null : "O CNPJ deve ter 14 dígitos.")
        },
        { nome: "email", rotulo: "E-mail comercial", tipo: "email", obrigatorio: true, maxlength: 120, largura: "meia" },
        {
            nome: "telefone", rotulo: "Telefone", tipo: "tel", obrigatorio: true, maxlength: 20, largura: "meia", placeholder: "(11) 98888-7777",
            validar: (v) => ([10, 11].includes(digitos(v).length) ? null : "Informe DDD + número (10 ou 11 dígitos).")
        },
        { nome: "endereco", rotulo: "Endereço", tipo: "texto", maxlength: 120, largura: "meia" },
        { nome: "cidade", rotulo: "Cidade", tipo: "texto", obrigatorio: true, maxlength: 60, largura: "meia" },
        { nome: "estado", rotulo: "UF", tipo: "select", obrigatorio: true, opcoes: UFS.map((u) => [u, u]), placeholderOpcao: "Selecione", largura: "meia" },
        { tipo: "secao", rotulo: "Proprietário" },
        { nome: "proprietarioNome", rotulo: "Nome completo", tipo: "texto", obrigatorio: true, maxlength: 80, largura: "meia" },
        { nome: "proprietarioEmail", rotulo: "E-mail", tipo: "email", obrigatorio: true, maxlength: 120, largura: "meia" },
        {
            nome: "proprietarioTelefone", rotulo: "Telefone", tipo: "tel", maxlength: 20, largura: "meia",
            validar: (v) => (!v || [10, 11].includes(digitos(v).length) ? null : "Informe DDD + número (10 ou 11 dígitos).")
        },
        ...(novo ? [
            { tipo: "secao", rotulo: "Plano inicial" },
            {
                nome: "planoId", rotulo: "Plano", tipo: "select", obrigatorio: true, largura: "meia", placeholderOpcao: "Selecione",
                opcoes: S.planosDisponiveis().map((p) => [p.id, `${p.nome} · ${moeda(p.precoMensal)}/mês`])
            },
            {
                nome: "status", rotulo: "Início", tipo: "select", obrigatorio: true, largura: "meia",
                opcoes: [["teste", "Período de teste"], ["ativa", "Assinatura ativa"]]
            },
            {
                nome: "periodicidade", rotulo: "Periodicidade", tipo: "select", obrigatorio: true, largura: "meia",
                opcoes: opcoes(PERIODICIDADES), ajuda: "No período de teste a cobrança é sempre mensal."
            }
        ] : []),
        { tipo: "secao", rotulo: "Observações" },
        { nome: "observacoes", rotulo: "Observações internas", tipo: "textarea", maxlength: 500 }
    ];
}

async function novaBarbearia() {
    const criada = await abrirFormulario({
        titulo: "Nova barbearia",
        descricao: "Cadastro demonstrativo: nenhuma conta de acesso real é criada.",
        campos: camposBarbearia(true),
        valores: { status: "teste", periodicidade: "mensal" },
        textoSalvar: "Cadastrar",
        aoSalvar: (v) => S.cadastrarBarbearia(v)
    });
    if (criada) {
        mostrarToast(`${criada.nome} cadastrada.`, "sucesso");
        window.location.hash = `#/barbearias/${criada.id}`;
    }
    return Boolean(criada);
}

async function editarBarbearia(id) {
    const b = S.barbearia(id);
    if (!b) return false;
    const dono = S.proprietarioDa(id);
    const salvo = await abrirFormulario({
        titulo: `Editar ${b.nome}`,
        campos: camposBarbearia(false),
        valores: {
            ...b, proprietarioNome: dono?.nome ?? "", proprietarioEmail: dono?.email ?? "", proprietarioTelefone: dono?.telefone ?? ""
        },
        textoSalvar: "Salvar alterações",
        aoSalvar: (v) => S.editarBarbearia(id, v)
    });
    if (salvo) mostrarToast("Alterações salvas.", "sucesso");
    return Boolean(salvo);
}

// Despacha as ações (data-acao) comuns à lista e ao perfil.
async function executarAcao(acao, id) {
    switch (acao) {
        case "ver": window.location.hash = `#/barbearias/${id}`; return false;
        case "nova": return novaBarbearia();
        case "editar": return editarBarbearia(id);
        case "suspender": return Acoes.suspenderBarbearia(id);
        case "reativar": return Acoes.reativarBarbearia(id);
        case "alterar-plano": {
            const a = S.assinaturaDaBarbearia(id);
            return a ? Acoes.alterarPlano(a.id) : false;
        }
        default: return false;
    }
}

// ---------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------
function linhas() {
    const termo = normalizar(filtros.busca);
    return S.barbearias().map((b) => {
        const a = S.assinaturaDaBarbearia(b.id);
        const c = S.contagens(b.id);
        return { ...b, assinatura: a, plano: a ? S.plano(a.planoId) : null, dono: S.proprietarioDa(b.id), barbeiros: c.barbeiros, clientes: c.clientes };
    }).filter((l) =>
        (!termo || [l.nome, l.dono?.nome, l.cidade].some((t) => normalizar(t).includes(termo))) &&
        (!filtros.plano || l.plano?.id === filtros.plano) &&
        (!filtros.status || l.status === filtros.status));
}

function kpis() {
    const todas = S.barbearias();
    const contar = (st) => numero(todas.filter((b) => b.status === st).length);
    return html`
        ${kpi({ rotulo: "Total", valor: numero(todas.length), iconeNome: "store", nota: "Barbearias cadastradas" })}
        ${kpi({ rotulo: "Ativas", valor: contar("ativa"), iconeNome: "circle-check", nota: "Com acesso liberado" })}
        ${kpi({ rotulo: "Em teste", valor: contar("teste"), iconeNome: "flask-conical", nota: "Período de avaliação" })}
        ${kpi({ rotulo: "Suspensas", valor: contar("suspensa"), iconeNome: "circle-pause", nota: "Acesso bloqueado" })}
        ${kpi({ rotulo: "Canceladas", valor: contar("cancelada"), iconeNome: "circle-x", nota: "Assinatura encerrada" })}`;
}

const COLUNAS = [
    {
        chave: "nome", rotulo: "Barbearia",
        render: (l) => html`<a class="link-forte" href="#/barbearias/${l.id}">${l.nome}</a>`
    },
    { chave: "dono", rotulo: "Proprietário", valor: (l) => l.dono?.nome ?? "", render: (l) => l.dono?.nome ?? "—" },
    { chave: "cidade", rotulo: "Cidade", valor: (l) => `${l.cidade}/${l.estado}`, render: (l) => `${l.cidade}/${l.estado}` },
    { chave: "plano", rotulo: "Plano", valor: (l) => l.plano?.nome ?? "", render: (l) => l.plano?.nome ?? "—" },
    { chave: "criadoEm", rotulo: "Cadastro", render: (l) => data(l.criadoEm) },
    { chave: "barbeiros", rotulo: "Barbeiros", classe: "col-num", render: (l) => numero(l.barbeiros) },
    { chave: "clientes", rotulo: "Clientes", classe: "col-num", render: (l) => numero(l.clientes) },
    { chave: "status", rotulo: "Status", valor: (l) => STATUS_BARBEARIA[l.status]?.rotulo, render: (l) => badgeStatus(STATUS_BARBEARIA, l.status) },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (l) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "ver", id: l.id, nomeIcone: "eye", rotulo: `Ver perfil de ${l.nome}` })}
            ${botaoIcone({ acao: "editar", id: l.id, nomeIcone: "pencil", rotulo: `Editar ${l.nome}` })}
            ${l.status !== "cancelada" ? botaoIcone({ acao: "alterar-plano", id: l.id, nomeIcone: "repeat", rotulo: `Alterar plano de ${l.nome}` }) : ""}
            ${l.status === "suspensa" || l.status === "cancelada"
                ? botaoIcone({ acao: "reativar", id: l.id, nomeIcone: "circle-play", rotulo: `Reativar ${l.nome}` })
                : botaoIcone({ acao: "suspender", id: l.id, nomeIcone: "circle-pause", rotulo: `Suspender ${l.nome}`, perigo: true })}
        </div>`
    }
];

// Cada desenho usa uma raiz nova: evita acumular ouvintes de eventos.
function novaRaiz(view) {
    const raiz = document.createElement("div");
    view.replaceChildren(raiz);
    return raiz;
}

function renderLista(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Barbearias",
            subtitulo: "Empresas clientes da plataforma Barber",
            acoes: html`<button class="btn btn--primario" type="button" data-acao="nova">${icone("plus")}<span>Nova barbearia</span></button>`
        })}
        ${avisoDemo()}
        <section class="grade grade--kpi grade--kpi-5 secao" data-kpis>${kpis()}</section>
        <section class="card">
            <div class="barra-filtros">
                ${campoBusca({ id: "filtroBusca", valor: filtros.busca, placeholder: "Pesquisar por nome, proprietário ou cidade" })}
                ${campoSelect({ id: "filtroPlano", rotulo: "Filtrar por plano", valor: filtros.plano, opcoes: [["", "Todos os planos"], ...S.planos().map((p) => [p.id, p.nome])] })}
                ${campoSelect({ id: "filtroStatus", rotulo: "Filtrar por status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_BARBEARIA)] })}
                <button class="btn btn--fantasma" type="button" data-acao="limpar-filtros">${icone("filter-x")}<span>Limpar</span></button>
            </div>
            <div data-tabela></div>
        </section>`);

    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "nome", direcao: "asc" }, vazio: "Nenhuma barbearia corresponde aos filtros.", rotulo: "Barbearias" });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());

    const atualizar = (mesmaPagina = true) => {
        renderizar(raiz.querySelector("[data-kpis]"), kpis());
        if (mesmaPagina) tabela.atualizarLinhas(linhas());
        else tabela.definirLinhas(linhas());
    };

    let espera;
    raiz.querySelector("#filtroBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { filtros.busca = e.target.value; atualizar(false); }, 150);
    });
    raiz.querySelector("#filtroPlano").addEventListener("change", (e) => { filtros.plano = e.target.value; atualizar(false); });
    raiz.querySelector("#filtroStatus").addEventListener("change", (e) => { filtros.status = e.target.value; atualizar(false); });

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderLista(view));
        if (acao === "limpar-filtros") {
            Object.assign(filtros, { busca: "", plano: "", status: "" });
            return renderLista(view);
        }
        if (await executarAcao(acao, id)) atualizar();
    });
}

// ---------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------
function serieAgendamentos(b) {
    return (b.atividade?.agendamentosPorMes ?? []).map((m) => ({
        rotulo: mesReferencia(m.mes), rotuloLongo: mesReferencia(m.mes, true), valor: m.total
    }));
}

function abaVisaoGeral(b) {
    const a = S.assinaturaDaBarbearia(b.id);
    const p = a ? S.plano(a.planoId) : null;
    const c = S.contagens(b.id);
    const serie = serieAgendamentos(b);
    const ultimoMes = serie.at(-1)?.valor ?? null;
    return html`
        <div class="grade grade--kpi secao">
            ${kpi({ rotulo: "Plano", valor: p?.nome ?? "—", iconeNome: "badge-check", nota: a ? `${moeda(a.valor)} · ${PERIODICIDADES[a.periodicidade].rotulo.toLowerCase()}` : "" })}
            ${kpi({ rotulo: "Barbeiros", valor: numero(c.barbeiros), iconeNome: "scissors", nota: p?.limiteUsuarios ? `Limite do plano: ${p.limiteUsuarios}` : "Sem limite no plano" })}
            ${kpi({ rotulo: "Clientes", valor: numero(c.clientes), iconeNome: "users", nota: "Cadastrados (demonstração)" })}
            ${kpi({ rotulo: "Agendamentos no mês", valor: ultimoMes === null ? "—" : numero(ultimoMes), iconeNome: "calendar-check", nota: "Valor fictício" })}
        </div>
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Agendamentos por mês</h2><span class="badge">Últimos 6 meses</span></div>
                <div class="card__corpo">
                    ${serie.some((s) => s.valor > 0)
                        ? graficoBarras({ dados: serie, formatar: (v) => `${numero(v)} agendamentos`, formatarEixo: (v) => numero(v), titulo: "Agendamentos por mês" })
                        : estadoVazio({ iconeNome: "calendar", titulo: "Sem agendamentos registrados" })}
                </div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Resumo</h2></div>
                <div class="card__corpo">
                    ${listaDefinicao([
                        ["Status", badgeStatus(STATUS_BARBEARIA, b.status)],
                        ["Assinatura", a ? badgeStatus(STATUS_ASSINATURA, a.status) : "—"],
                        ["Próximo vencimento", a && a.status !== "cancelada" ? data(a.proximoVencimento) : "—"],
                        ["Cliente desde", data(b.criadoEm)],
                        ["Equipe", `${numero(c.barbeiros)} barbeiros · ${numero(c.funcionarios)} funcionários`]
                    ])}
                </div>
            </section>
        </div>`;
}

function abaComercial(b) {
    return html`
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Dados comerciais</h2>
                <button class="btn btn--pequeno" type="button" data-acao="editar" data-id="${b.id}">${icone("pencil")}<span>Editar</span></button>
            </div>
            <div class="card__corpo">
                ${listaDefinicao([
                    ["Nome comercial", b.nome],
                    ["Razão social", b.razaoSocial],
                    ["CNPJ (fictício)", b.documento],
                    ["E-mail comercial", b.email],
                    ["Telefone", b.telefone],
                    ["Endereço", b.endereco],
                    ["Cidade/UF", `${b.cidade}/${b.estado}`],
                    ["Cadastro", data(b.criadoEm)],
                    ["Última atualização", data(b.atualizadoEm)],
                    ["Observações internas", b.observacoes]
                ])}
            </div>
        </section>`;
}

function abaProprietario(b) {
    const dono = S.proprietarioDa(b.id);
    if (!dono) return estadoVazio({ iconeNome: "user-x", titulo: "Nenhum proprietário vinculado" });
    return html`
        <section class="card">
            <div class="card__cabecalho">
                <div class="perfil-mini">
                    <span class="avatar">${iniciais(dono.nome)}</span>
                    <div><h2 class="card__titulo">${dono.nome}</h2><span class="texto-terc">Proprietário</span></div>
                </div>
                <div class="pagina-cabecalho__acoes">
                    <button class="btn btn--pequeno" type="button" data-acao="editar" data-id="${b.id}">${icone("pencil")}<span>Editar</span></button>
                    <a class="btn btn--pequeno" href="#/usuarios/${dono.id}">${icone("external-link")}<span>Perfil do usuário</span></a>
                </div>
            </div>
            <div class="card__corpo">
                ${listaDefinicao([
                    ["E-mail (demonstrativo)", dono.email],
                    ["Telefone", dono.telefone],
                    ["Status", badgeStatus(STATUS_USUARIO, dono.status)],
                    ["Cadastro", data(dono.criadoEm)],
                    ["Último acesso", dono.ultimoAcesso ? `${data(dono.ultimoAcesso)} · ${tempoRelativo(dono.ultimoAcesso)}` : "Nunca acessou"]
                ])}
            </div>
        </section>`;
}

function abaPlano(b) {
    const a = S.assinaturaDaBarbearia(b.id);
    if (!a) return estadoVazio({ iconeNome: "badge-x", titulo: "Sem assinatura vinculada" });
    const p = S.plano(a.planoId);
    const incluidas = new Set(p?.funcionalidades ?? []);
    return html`
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho">
                    <h2 class="card__titulo">Assinatura</h2>
                    <div class="pagina-cabecalho__acoes">
                        ${a.status !== "cancelada" ? html`<button class="btn btn--pequeno" type="button" data-acao="alterar-plano" data-id="${b.id}">${icone("repeat")}<span>Alterar plano</span></button>` : ""}
                        <a class="btn btn--pequeno" href="#/assinaturas/${a.id}">${icone("external-link")}<span>Abrir assinatura</span></a>
                    </div>
                </div>
                <div class="card__corpo">
                    ${listaDefinicao([
                        ["Status", badgeStatus(STATUS_ASSINATURA, a.status)],
                        ["Plano", p?.nome],
                        ["Periodicidade", PERIODICIDADES[a.periodicidade].rotulo],
                        ["Valor contratado", moeda(a.valor)],
                        ["Início", data(a.inicio)],
                        ["Próximo vencimento", a.status === "cancelada" ? "—" : data(a.proximoVencimento)],
                        a.canceladaEm ? ["Cancelada em", data(a.canceladaEm)] : null
                    ])}
                </div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Funcionalidades do plano ${p?.nome ?? ""}</h2></div>
                <div class="card__corpo">
                    <ul class="lista-recursos">
                        ${S.funcionalidadesCatalogo().map((f) => html`
                            <li class="${incluidas.has(f.id) ? "" : "is-ausente"}">${icone(incluidas.has(f.id) ? "check" : "minus")}<span>${f.nome}</span></li>`)}
                    </ul>
                </div>
            </section>
        </div>`;
}

function abaUsuarios(b, painel) {
    const tabela = criarTabela({
        colunas: [
            { chave: "nome", rotulo: "Nome", render: (u) => html`<a class="link-forte" href="#/usuarios/${u.id}">${u.nome}</a><span class="celula-sub">${u.email}</span>` },
            { chave: "tipo", rotulo: "Tipo", valor: (u) => TIPOS_USUARIO[u.tipo].rotulo, render: (u) => TIPOS_USUARIO[u.tipo].rotulo },
            { chave: "ultimoAcesso", rotulo: "Último acesso", render: (u) => (u.ultimoAcesso ? tempoRelativo(u.ultimoAcesso) : "Nunca") },
            { chave: "status", rotulo: "Status", valor: (u) => u.status, render: (u) => badgeStatus(STATUS_USUARIO, u.status) }
        ],
        ordenacao: { chave: "tipo", direcao: "desc" },
        vazio: "Nenhum usuário vinculado.",
        rotulo: `Usuários de ${b.nome}`
    });
    renderizar(painel, html`<section class="card" data-tabela-usuarios></section>`);
    painel.querySelector("[data-tabela-usuarios]").appendChild(tabela.elemento);
    tabela.definirLinhas(S.usuariosDaBarbearia(b.id));
}

function abaAtividade(b) {
    const serie = serieAgendamentos(b);
    const recentes = S.transacoesDa({ barbeariaId: b.id }).sort((x, y) => y.vencimento.localeCompare(x.vencimento)).slice(0, 5);
    const acessos = S.usuariosDaBarbearia(b.id).filter((u) => u.ultimoAcesso && u.tipo !== "cliente")
        .sort((x, y) => y.ultimoAcesso.localeCompare(x.ultimoAcesso)).slice(0, 5);
    return html`
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Agendamentos por mês</h2><span class="badge badge--atencao">Valores fictícios</span></div>
            <div class="card__corpo">
                ${serie.some((s) => s.valor > 0)
                    ? graficoBarras({ dados: serie, formatar: (v) => `${numero(v)} agendamentos`, formatarEixo: (v) => numero(v), titulo: "Agendamentos por mês" })
                    : estadoVazio({ iconeNome: "calendar", titulo: "Sem agendamentos registrados" })}
            </div>
        </section>
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Cobranças recentes</h2><a class="btn btn--pequeno btn--fantasma" href="#/financeiro">Financeiro</a></div>
                ${recentes.length ? html`<ul class="lista">${recentes.map((t) => html`
                    <li class="lista__item">
                        <div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/financeiro/${t.id}">${t.descricao}</a>
                            <div class="lista__meta">Vencimento ${data(t.vencimento)} · ${moeda(t.valorBruto)}</div></div>
                        ${badgeStatus(STATUS_TRANSACAO, t.status)}
                    </li>`)}</ul>` : estadoVazio({ iconeNome: "receipt", titulo: "Nenhuma cobrança", texto: "Barbearias em teste ainda não geram cobranças." })}
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Últimos acessos da equipe</h2></div>
                ${acessos.length ? html`<ul class="lista">${acessos.map((u) => html`
                    <li class="lista__item">
                        <span class="avatar avatar--pequeno">${iniciais(u.nome)}</span>
                        <div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/usuarios/${u.id}">${u.nome}</a>
                            <div class="lista__meta">${TIPOS_USUARIO[u.tipo].rotulo}</div></div>
                        <time class="lista__meta" datetime="${u.ultimoAcesso}">${tempoRelativo(u.ultimoAcesso)}</time>
                    </li>`)}</ul>` : estadoVazio({ iconeNome: "log-in", titulo: "Nenhum acesso registrado" })}
            </section>
        </div>`;
}

function renderPerfil(view, id) {
    const raiz = novaRaiz(view);
    const b = S.barbearia(id);
    if (!b) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Barbearia não encontrada", voltar: { href: "#/barbearias", rotulo: "Barbearias" } })}
            <section class="card">${estadoVazio({ iconeNome: "store", titulo: "Registro inexistente", texto: "A barbearia pode ter sido removida ao restaurar os dados demonstrativos." })}</section>`);
        return;
    }
    const inativa = b.status === "suspensa" || b.status === "cancelada";

    renderizar(raiz, html`
        ${cabecalho({
            titulo: b.nome,
            voltar: { href: "#/barbearias", rotulo: "Barbearias" },
            extra: badgeStatus(STATUS_BARBEARIA, b.status),
            subtitulo: `${b.cidade}/${b.estado} · cliente desde ${data(b.criadoEm)}`,
            acoes: html`
                <button class="btn" type="button" data-acao="editar" data-id="${b.id}">${icone("pencil")}<span>Editar</span></button>
                ${b.status !== "cancelada" ? html`<button class="btn" type="button" data-acao="alterar-plano" data-id="${b.id}">${icone("repeat")}<span>Alterar plano</span></button>` : ""}
                ${inativa
                    ? html`<button class="btn btn--primario" type="button" data-acao="reativar" data-id="${b.id}">${icone("circle-play")}<span>Reativar</span></button>`
                    : html`<button class="btn btn--perigo" type="button" data-acao="suspender" data-id="${b.id}">${icone("circle-pause")}<span>Suspender</span></button>`}`
        })}
        ${avisoDemo()}
        <div data-abas></div>`);

    montarAbas(raiz.querySelector("[data-abas]"), {
        rotulo: `Perfil de ${b.nome}`,
        ativa: abaPorBarbearia.get(id) ?? "visao",
        aoTrocar: (aba) => abaPorBarbearia.set(id, aba),
        abas: [
            { id: "visao", rotulo: "Visão geral", render: (p) => renderizar(p, abaVisaoGeral(b)) },
            { id: "comercial", rotulo: "Dados comerciais", render: (p) => renderizar(p, abaComercial(b)) },
            { id: "proprietario", rotulo: "Proprietário", render: (p) => renderizar(p, abaProprietario(b)) },
            { id: "plano", rotulo: "Plano e assinatura", render: (p) => renderizar(p, abaPlano(b)) },
            { id: "usuarios", rotulo: "Usuários", render: (p) => abaUsuarios(b, p) },
            { id: "atividade", rotulo: "Atividade", render: (p) => renderizar(p, abaAtividade(b)) },
            {
                id: "historico", rotulo: "Histórico",
                render: (p) => renderizar(p, html`<section class="card"><div class="card__corpo">${linhaDoTempo(S.historicoDaBarbearia(b.id))}</div></section>`)
            }
        ]
    });

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao } = botao.dataset;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderPerfil(view, id));
        if (await executarAcao(acao, botao.dataset.id || id)) renderPerfil(view, id);
    });
}

export async function render(view, contexto) {
    // Fora do modo demonstração: painel Master com dados reais do Supabase.
    if (!MODO_DEMO) {
        const real = await import("./real.js");
        return real.render(view, contexto);
    }
    const { parametros = [] } = contexto;
    if (parametros[0]) renderPerfil(view, parametros[0]);
    else renderLista(view);
}
