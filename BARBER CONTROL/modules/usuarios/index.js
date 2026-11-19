// =====================================================================
// MÓDULO 05 — USUÁRIOS (modo demonstrativo)
// Rotas: #/usuarios            → lista por categoria
//        #/usuarios/<id>       → perfil
// Usuários fictícios: nenhuma conta de acesso real é criada ou alterada.
// =====================================================================
import { MODO_DEMO } from "../../js/demo.js";
import * as S from "../../services/demo/saas.js";
import { STATUS_USUARIO, STATUS_BARBEARIA, TIPOS_USUARIO, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, data, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { criarTabela } from "../../js/components/tabela.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, kpi, estadoVazio, listaDefinicao,
    linhaDoTempo, botaoIcone, campoBusca, campoSelect, iniciais, novaRaiz
} from "../../js/components/ui.js";
import * as Acoes from "../compartilhado/acoes.js";

const filtros = { tipo: "", busca: "", barbearia: "", status: "" };
const SETE_DIAS = 7 * 86400000;

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function tratarAcao(acao, id) {
    switch (acao) {
        case "ver": window.location.hash = `#/usuarios/${id}`; return false;
        case "suspender": return Acoes.suspenderUsuario(id);
        case "reativar": return Acoes.reativarUsuario(id);
        default: return false;
    }
}

function linhas() {
    const termo = normalizar(filtros.busca);
    return S.usuarios().filter((u) =>
        (!filtros.tipo || u.tipo === filtros.tipo) &&
        (!filtros.barbearia || u.barbeariaId === filtros.barbearia) &&
        (!filtros.status || u.status === filtros.status) &&
        (!termo || normalizar(u.nome).includes(termo) || normalizar(u.email).includes(termo)));
}

function kpis() {
    const todos = S.usuarios();
    const agora = Date.now();
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return html`
        ${kpi({ rotulo: "Usuários", valor: numero(todos.length), iconeNome: "users", nota: "Todas as categorias" })}
        ${kpi({ rotulo: "Ativos", valor: numero(todos.filter((u) => u.status === "ativo").length), iconeNome: "user-check", nota: "Com acesso liberado" })}
        ${kpi({ rotulo: "Suspensos", valor: numero(todos.filter((u) => u.status === "suspenso").length), iconeNome: "user-x", nota: "Acesso bloqueado" })}
        ${kpi({ rotulo: "Ativos em 7 dias", valor: numero(todos.filter((u) => u.ultimoAcesso && agora - new Date(u.ultimoAcesso) < SETE_DIAS).length), iconeNome: "activity", nota: "Último acesso demonstrativo" })}
        ${kpi({ rotulo: "Novos no mês", valor: numero(todos.filter((u) => new Date(u.criadoEm).getTime() >= inicioMes).length), iconeNome: "user-plus", nota: "Cadastros desde o dia 1" })}`;
}

function segmentos() {
    const todos = S.usuarios();
    const itens = [["", "Todos", todos.length], ...Object.entries(TIPOS_USUARIO).map(([k, v]) => [k, v.plural, todos.filter((u) => u.tipo === k).length])];
    return html`
        <div class="segmentos" role="group" aria-label="Categoria de usuário">
            ${itens.map(([valor, rotulo, total]) => html`
                <button class="segmentos__item" type="button" data-acao="tipo" data-id="${valor}"
                        aria-pressed="${String(filtros.tipo === valor)}">${rotulo}<span class="num">${numero(total)}</span></button>`)}
        </div>`;
}

const COLUNAS = [
    {
        chave: "nome", rotulo: "Nome",
        render: (u) => html`<div class="celula-pessoa"><span class="avatar avatar--pequeno">${iniciais(u.nome)}</span>
            <a class="link-forte" href="#/usuarios/${u.id}">${u.nome}</a></div>`
    },
    { chave: "email", rotulo: "E-mail (demonstrativo)" },
    {
        chave: "empresa", rotulo: "Empresa", valor: (u) => S.barbearia(u.barbeariaId)?.nome ?? "",
        render: (u) => {
            const b = S.barbearia(u.barbeariaId);
            return b ? html`<a href="#/barbearias/${b.id}">${b.nome}</a>` : "—";
        }
    },
    { chave: "tipo", rotulo: "Tipo", valor: (u) => TIPOS_USUARIO[u.tipo].rotulo, render: (u) => TIPOS_USUARIO[u.tipo].rotulo },
    { chave: "criadoEm", rotulo: "Cadastro", render: (u) => data(u.criadoEm) },
    {
        chave: "ultimoAcesso", rotulo: "Último acesso",
        render: (u) => (u.ultimoAcesso ? html`<span title="${dataHora(u.ultimoAcesso)}">${tempoRelativo(u.ultimoAcesso)}</span>` : "Nunca")
    },
    { chave: "status", rotulo: "Status", valor: (u) => STATUS_USUARIO[u.status].rotulo, render: (u) => badgeStatus(STATUS_USUARIO, u.status) },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (u) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "ver", id: u.id, nomeIcone: "eye", rotulo: `Ver perfil de ${u.nome}` })}
            ${u.status === "suspenso"
                ? botaoIcone({ acao: "reativar", id: u.id, nomeIcone: "user-check", rotulo: `Reativar ${u.nome}` })
                : botaoIcone({ acao: "suspender", id: u.id, nomeIcone: "user-x", rotulo: `Suspender ${u.nome}`, perigo: true })}
        </div>`
    }
];

function renderLista(view) {
    const raiz = novaRaiz(view);
    const empresas = [...S.barbearias()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Usuários", subtitulo: "Proprietários, equipes e clientes das barbearias" })}
        ${avisoDemo()}
        <section class="grade grade--kpi grade--kpi-5 secao" data-kpis>${kpis()}</section>
        <div data-segmentos>${segmentos()}</div>
        <section class="card">
            <div class="barra-filtros">
                ${campoBusca({ id: "filtroBusca", valor: filtros.busca, placeholder: "Pesquisar por nome ou e-mail" })}
                ${campoSelect({ id: "filtroBarbearia", rotulo: "Empresa", valor: filtros.barbearia, opcoes: [["", "Todas as empresas"], ...empresas.map((b) => [b.id, b.nome])] })}
                ${campoSelect({ id: "filtroStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_USUARIO)] })}
                <button class="btn btn--fantasma" type="button" data-acao="limpar-filtros">${icone("filter-x")}<span>Limpar</span></button>
            </div>
            <div data-tabela></div>
        </section>`);

    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "nome", direcao: "asc" }, porPagina: 12, vazio: "Nenhum usuário corresponde aos filtros.", rotulo: "Usuários" });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());

    const atualizar = (mesmaPagina = true) => {
        renderizar(raiz.querySelector("[data-kpis]"), kpis());
        renderizar(raiz.querySelector("[data-segmentos]"), segmentos());
        if (mesmaPagina) tabela.atualizarLinhas(linhas());
        else tabela.definirLinhas(linhas());
    };

    let espera;
    raiz.querySelector("#filtroBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { filtros.busca = e.target.value; atualizar(false); }, 150);
    });
    raiz.querySelector("#filtroBarbearia").addEventListener("change", (e) => { filtros.barbearia = e.target.value; atualizar(false); });
    raiz.querySelector("#filtroStatus").addEventListener("change", (e) => { filtros.status = e.target.value; atualizar(false); });

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderLista(view));
        if (acao === "limpar-filtros") {
            Object.assign(filtros, { tipo: "", busca: "", barbearia: "", status: "" });
            return renderLista(view);
        }
        if (acao === "tipo") {
            filtros.tipo = id;
            return atualizar(false);
        }
        if (await tratarAcao(acao, id)) atualizar();
    });
}

function renderPerfil(view, id) {
    const raiz = novaRaiz(view);
    const u = S.usuario(id);
    if (!u) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Usuário não encontrado", voltar: { href: "#/usuarios", rotulo: "Usuários" } })}
            <section class="card">${estadoVazio({ iconeNome: "user-x", titulo: "Registro inexistente", texto: "Pode ter sido removido ao restaurar os dados demonstrativos." })}</section>`);
        return;
    }
    const b = S.barbearia(u.barbeariaId);
    const plano = b ? S.planoDaBarbearia(b.id) : null;
    const eventos = [
        ...S.historicoDe("usuario", u.id),
        ...(u.ultimoAcesso ? [{ descricao: "Último acesso registrado (demonstrativo).", data: u.ultimoAcesso }] : []),
        { descricao: `Conta criada como ${TIPOS_USUARIO[u.tipo].rotulo.toLowerCase()}${b ? ` de ${b.nome}` : ""}.`, data: u.criadoEm }
    ].sort((x, y) => y.data.localeCompare(x.data));
    // O cadastro já registrado no histórico não aparece duas vezes.
    const unicos = eventos.filter((e, i) => !(e.descricao.startsWith("Conta criada") && eventos.some((o, j) => j !== i && o.acao === "cadastro")));

    renderizar(raiz, html`
        ${cabecalho({
            titulo: u.nome,
            voltar: { href: "#/usuarios", rotulo: "Usuários" },
            extra: badgeStatus(STATUS_USUARIO, u.status),
            subtitulo: `${TIPOS_USUARIO[u.tipo].rotulo}${b ? ` · ${b.nome}` : ""}`,
            acoes: html`
                ${b ? html`<a class="btn" href="#/barbearias/${b.id}">${icone("store")}<span>Ver empresa</span></a>` : ""}
                ${u.status === "suspenso"
                    ? html`<button class="btn btn--primario" type="button" data-acao="reativar" data-id="${u.id}">${icone("user-check")}<span>Reativar</span></button>`
                    : html`<button class="btn btn--perigo" type="button" data-acao="suspender" data-id="${u.id}">${icone("user-x")}<span>Suspender</span></button>`}`
        })}
        ${avisoDemo()}
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho">
                    <div class="perfil-mini">
                        <span class="avatar">${iniciais(u.nome)}</span>
                        <div><h2 class="card__titulo">Dados do usuário</h2><span class="texto-terc">${TIPOS_USUARIO[u.tipo].rotulo}</span></div>
                    </div>
                </div>
                <div class="card__corpo">
                    ${listaDefinicao([
                        ["Nome", u.nome],
                        ["E-mail (demonstrativo)", u.email],
                        ["Telefone", u.telefone],
                        ["Tipo de usuário", TIPOS_USUARIO[u.tipo].rotulo],
                        ["Status", badgeStatus(STATUS_USUARIO, u.status)],
                        ["Cadastro", data(u.criadoEm)],
                        ["Último acesso", u.ultimoAcesso ? `${dataHora(u.ultimoAcesso)} · ${tempoRelativo(u.ultimoAcesso)}` : "Nunca acessou"],
                        ["Identificador", u.id]
                    ])}
                </div>
            </section>
            <section class="card">
                <div class="card__cabecalho">
                    <h2 class="card__titulo">Empresa vinculada</h2>
                    ${b ? html`<a class="btn btn--pequeno" href="#/barbearias/${b.id}">${icone("external-link")}<span>Abrir</span></a>` : ""}
                </div>
                <div class="card__corpo">
                    ${b ? listaDefinicao([
                        ["Barbearia", html`<a class="link-forte" href="#/barbearias/${b.id}">${b.nome}</a>`],
                        ["Status", badgeStatus(STATUS_BARBEARIA, b.status)],
                        ["Plano", plano?.nome],
                        ["Cidade/UF", `${b.cidade}/${b.estado}`],
                        ["Proprietário", S.proprietarioDa(b.id)?.nome]
                    ]) : estadoVazio({ iconeNome: "store", titulo: "Sem empresa vinculada" })}
                </div>
            </section>
        </div>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2><span class="badge badge--atencao">Demonstrativo</span></div>
            <div class="card__corpo">${linhaDoTempo(unicos)}</div>
        </section>`);

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        if (botao.dataset.acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderPerfil(view, id));
        if (await tratarAcao(botao.dataset.acao, botao.dataset.id)) renderPerfil(view, id);
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
    else renderLista(view);
}
