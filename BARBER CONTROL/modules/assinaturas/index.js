// =====================================================================
// MÓDULO 03 — ASSINATURAS E PLANOS (modo demonstrativo)
// Rotas: #/assinaturas              → assinaturas
//        #/assinaturas/planos       → planos
//        #/assinaturas/<id>         → detalhe da assinatura
// Nenhuma cobrança real é realizada.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import { STATUS_ASSINATURA, STATUS_TRANSACAO, PERIODICIDADES, METODOS_PAGAMENTO, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar, bruto } from "../../js/utilities/dom.js";
import { numero, moeda, data, percentual } from "../../js/utilities/format.js";
import { confirmar, mostrarToast } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, kpi, estadoVazio, listaDefinicao,
    linhaDoTempo, botaoIcone, campoBusca, campoSelect, novaRaiz
} from "../../js/components/ui.js";
import * as Acoes from "../compartilhado/acoes.js";

const filtros = { busca: "", plano: "", status: "", periodicidade: "" };
let mostrarArquivados = false;

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const inteiro = (v) => (Number.isInteger(v) ? null : "Use um número inteiro.");
const limite = (v, unidade) => (v ? `${numero(v)} ${unidade}` : "Ilimitado");

function kpis() {
    const todas = S.assinaturas();
    const contar = (st) => numero(todas.filter((a) => a.status === st).length);
    return html`
        ${kpi({ rotulo: "Ativas", valor: contar("ativa"), iconeNome: "circle-check", nota: "Pagantes em dia" })}
        ${kpi({ rotulo: "Em teste", valor: contar("teste"), iconeNome: "flask-conical", nota: "Período de avaliação" })}
        ${kpi({ rotulo: "Vencidas", valor: contar("vencida"), iconeNome: "calendar-x", nota: "Pagamento em atraso" })}
        ${kpi({ rotulo: "Canceladas", valor: contar("cancelada"), iconeNome: "circle-x", nota: "Encerradas" })}
        ${kpi({ rotulo: "Receita recorrente (MRR)", valor: moeda(S.calcularMrr()), iconeNome: "trending-up", nota: "Demonstrativa · anuais ÷ 12", destaque: true })}`;
}

function abasTopo(ativa) {
    return html`
        <nav class="abas abas--navegacao" aria-label="Seções do módulo">
            <a class="abas__aba" href="#/assinaturas" ${ativa === "assinaturas" ? bruto('aria-current="page"') : ""}>Assinaturas</a>
            <a class="abas__aba" href="#/assinaturas/planos" ${ativa === "planos" ? bruto('aria-current="page"') : ""}>Planos</a>
        </nav>`;
}

async function tratarAcaoAssinatura(acao, id) {
    switch (acao) {
        case "ver": window.location.hash = `#/assinaturas/${id}`; return false;
        case "alterar-plano": return Acoes.alterarPlano(id);
        case "cancelar": return Acoes.cancelarAssinatura(id);
        case "reativar": return Acoes.reativarAssinatura(id);
        default: return false;
    }
}

// ---------------------------------------------------------------------
// Assinaturas — lista
// ---------------------------------------------------------------------
function linhas() {
    const termo = normalizar(filtros.busca);
    return S.assinaturas().map((a) => ({ ...a, barbearia: S.barbearia(a.barbeariaId), plano: S.plano(a.planoId) }))
        .filter((l) =>
            (!termo || normalizar(l.barbearia?.nome).includes(termo)) &&
            (!filtros.plano || l.planoId === filtros.plano) &&
            (!filtros.status || l.status === filtros.status) &&
            (!filtros.periodicidade || l.periodicidade === filtros.periodicidade));
}

const COLUNAS = [
    {
        chave: "barbearia", rotulo: "Barbearia", valor: (l) => l.barbearia?.nome ?? "",
        render: (l) => html`<a class="link-forte" href="#/assinaturas/${l.id}">${l.barbearia?.nome ?? "—"}</a>`
    },
    { chave: "plano", rotulo: "Plano", valor: (l) => l.plano?.nome ?? "", render: (l) => l.plano?.nome ?? "—" },
    {
        chave: "valor", rotulo: "Valor", classe: "col-num",
        render: (l) => html`${moeda(l.valor)}<span class="celula-sub">${l.periodicidade === "anual" ? "por ano" : "por mês"}</span>`
    },
    { chave: "periodicidade", rotulo: "Periodicidade", valor: (l) => PERIODICIDADES[l.periodicidade].rotulo, render: (l) => PERIODICIDADES[l.periodicidade].rotulo },
    { chave: "inicio", rotulo: "Início", render: (l) => data(l.inicio) },
    {
        chave: "proximoVencimento", rotulo: "Próximo vencimento",
        valor: (l) => (l.status === "cancelada" ? "" : l.proximoVencimento),
        render: (l) => (l.status === "cancelada" ? "—" : data(l.proximoVencimento))
    },
    { chave: "status", rotulo: "Status", valor: (l) => STATUS_ASSINATURA[l.status].rotulo, render: (l) => badgeStatus(STATUS_ASSINATURA, l.status) },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (l) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "ver", id: l.id, nomeIcone: "eye", rotulo: "Ver assinatura" })}
            ${l.status !== "cancelada" ? botaoIcone({ acao: "alterar-plano", id: l.id, nomeIcone: "repeat", rotulo: "Alterar plano" }) : ""}
            ${l.status === "cancelada" || l.status === "vencida"
                ? botaoIcone({ acao: "reativar", id: l.id, nomeIcone: "rotate-ccw", rotulo: "Reativar assinatura" })
                : ""}
            ${l.status !== "cancelada" ? botaoIcone({ acao: "cancelar", id: l.id, nomeIcone: "circle-x", rotulo: "Cancelar assinatura", perigo: true }) : ""}
        </div>`
    }
];

function renderAssinaturas(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Assinaturas e planos", subtitulo: "Contratos das barbearias e catálogo de planos do SaaS" })}
        ${avisoDemo()}
        <section class="grade grade--kpi grade--kpi-5 secao" data-kpis>${kpis()}</section>
        ${abasTopo("assinaturas")}
        <section class="card">
            <div class="barra-filtros">
                ${campoBusca({ id: "filtroBusca", valor: filtros.busca, placeholder: "Pesquisar barbearia" })}
                ${campoSelect({ id: "filtroPlano", rotulo: "Plano", valor: filtros.plano, opcoes: [["", "Todos os planos"], ...S.planos().map((p) => [p.id, p.nome])] })}
                ${campoSelect({ id: "filtroStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_ASSINATURA)] })}
                ${campoSelect({ id: "filtroPeriodicidade", rotulo: "Periodicidade", valor: filtros.periodicidade, opcoes: [["", "Mensal e anual"], ...opcoes(PERIODICIDADES)] })}
                <button class="btn btn--fantasma" type="button" data-acao="limpar-filtros">${icone("filter-x")}<span>Limpar</span></button>
            </div>
            <div data-tabela></div>
        </section>`);

    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "proximoVencimento", direcao: "asc" }, vazio: "Nenhuma assinatura corresponde aos filtros.", rotulo: "Assinaturas" });
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
    [["#filtroPlano", "plano"], ["#filtroStatus", "status"], ["#filtroPeriodicidade", "periodicidade"]].forEach(([sel, chave]) =>
        raiz.querySelector(sel).addEventListener("change", (e) => { filtros[chave] = e.target.value; atualizar(false); }));

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderAssinaturas(view));
        if (acao === "limpar-filtros") {
            Object.assign(filtros, { busca: "", plano: "", status: "", periodicidade: "" });
            return renderAssinaturas(view);
        }
        if (await tratarAcaoAssinatura(acao, id)) atualizar();
    });
}

// ---------------------------------------------------------------------
// Assinatura — detalhe
// ---------------------------------------------------------------------
function renderDetalhe(view, id) {
    const raiz = novaRaiz(view);
    const a = S.assinatura(id);
    if (!a) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Assinatura não encontrada", voltar: { href: "#/assinaturas", rotulo: "Assinaturas" } })}
            <section class="card">${estadoVazio({ iconeNome: "badge-x", titulo: "Registro inexistente", texto: "Pode ter sido removido ao restaurar os dados demonstrativos." })}</section>`);
        return;
    }
    const b = S.barbearia(a.barbeariaId);
    const p = S.plano(a.planoId);
    const incluidas = new Set(p?.funcionalidades ?? []);
    const cobrancas = S.transacoesDa({ assinaturaId: a.id }).sort((x, y) => y.vencimento.localeCompare(x.vencimento));

    renderizar(raiz, html`
        ${cabecalho({
            titulo: `Assinatura · ${b?.nome ?? "—"}`,
            voltar: { href: "#/assinaturas", rotulo: "Assinaturas" },
            extra: badgeStatus(STATUS_ASSINATURA, a.status),
            subtitulo: `${p?.nome ?? "—"} · ${PERIODICIDADES[a.periodicidade].rotulo.toLowerCase()} · desde ${data(a.inicio)}`,
            acoes: html`
                <a class="btn" href="#/barbearias/${a.barbeariaId}">${icone("store")}<span>Ver barbearia</span></a>
                ${a.status !== "cancelada" ? html`<button class="btn" type="button" data-acao="alterar-plano" data-id="${a.id}">${icone("repeat")}<span>Alterar plano</span></button>` : ""}
                ${a.status === "cancelada" || a.status === "vencida"
                    ? html`<button class="btn btn--primario" type="button" data-acao="reativar" data-id="${a.id}">${icone("rotate-ccw")}<span>Reativar</span></button>`
                    : ""}
                ${a.status !== "cancelada" ? html`<button class="btn btn--perigo" type="button" data-acao="cancelar" data-id="${a.id}">${icone("circle-x")}<span>Cancelar</span></button>` : ""}`
        })}
        ${avisoDemo()}
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Dados da assinatura</h2></div>
                <div class="card__corpo">
                    ${listaDefinicao([
                        ["Barbearia", b ? html`<a class="link-forte" href="#/barbearias/${b.id}">${b.nome}</a>` : "—"],
                        ["Plano", p?.nome],
                        ["Periodicidade", PERIODICIDADES[a.periodicidade].rotulo],
                        ["Valor contratado", moeda(a.valor)],
                        ["Equivalente mensal", moeda(S.valorMensalEquivalente(a))],
                        ["Início", data(a.inicio)],
                        ["Próximo vencimento", a.status === "cancelada" ? "—" : data(a.proximoVencimento)],
                        a.canceladaEm ? ["Cancelada em", data(a.canceladaEm)] : null,
                        ["Identificador", a.id]
                    ])}
                </div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Recursos do plano ${p?.nome ?? ""}</h2></div>
                <div class="card__corpo">
                    <ul class="lista-recursos">
                        ${S.funcionalidadesCatalogo().map((f) => html`<li class="${incluidas.has(f.id) ? "" : "is-ausente"}">${icone(incluidas.has(f.id) ? "check" : "minus")}<span>${f.nome}</span></li>`)}
                    </ul>
                </div>
            </section>
        </div>
        <div class="grade grade--2">
            <section class="card" data-cobrancas>
                <div class="card__cabecalho"><h2 class="card__titulo">Cobranças</h2><span class="badge">${numero(cobrancas.length)}</span></div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                <div class="card__corpo">${linhaDoTempo(S.historicoDe("assinatura", a.id))}</div>
            </section>
        </div>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "vencimento", rotulo: "Vencimento", render: (t) => html`<a class="link-forte" href="#/financeiro/${t.id}">${data(t.vencimento)}</a>` },
            { chave: "valorBruto", rotulo: "Valor", classe: "col-num", render: (t) => moeda(t.valorBruto) },
            { chave: "metodo", rotulo: "Método", valor: (t) => METODOS_PAGAMENTO[t.metodo].rotulo, render: (t) => METODOS_PAGAMENTO[t.metodo].rotulo },
            { chave: "status", rotulo: "Status", valor: (t) => t.status, render: (t) => badgeStatus(STATUS_TRANSACAO, t.status) }
        ],
        porPagina: 6,
        ordenacao: { chave: "vencimento", direcao: "desc" },
        vazio: a.status === "teste" ? "Em período de teste: ainda sem cobranças." : "Nenhuma cobrança registrada.",
        rotulo: "Cobranças da assinatura"
    });
    raiz.querySelector("[data-cobrancas]").appendChild(tabela.elemento);
    tabela.definirLinhas(cobrancas);

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        if (botao.dataset.acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderDetalhe(view, id));
        if (await tratarAcaoAssinatura(botao.dataset.acao, botao.dataset.id)) renderDetalhe(view, id);
    });
}

// ---------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------
function camposPlano() {
    return [
        { nome: "nome", rotulo: "Nome do plano", tipo: "texto", obrigatorio: true, maxlength: 40, largura: "meia" },
        { nome: "diasTeste", rotulo: "Período de teste (dias)", tipo: "numero", obrigatorio: true, min: 0, max: 90, passo: 1, largura: "meia", validar: inteiro },
        { nome: "descricao", rotulo: "Descrição", tipo: "textarea", maxlength: 200 },
        { tipo: "secao", rotulo: "Preços" },
        { nome: "precoMensal", rotulo: "Preço mensal (R$)", tipo: "numero", obrigatorio: true, min: 1, max: 99999, passo: 0.01, largura: "meia" },
        {
            nome: "precoAnual", rotulo: "Preço anual (R$)", tipo: "numero", obrigatorio: true, min: 1, max: 999999, passo: 0.01, largura: "meia",
            validar: (v, valores) => (valores.precoMensal && v > valores.precoMensal * 12 ? "O preço anual não pode superar 12 mensalidades." : null)
        },
        { tipo: "secao", rotulo: "Limites de utilização" },
        { nome: "limiteUsuarios", rotulo: "Barbeiros permitidos", tipo: "numero", obrigatorio: true, min: 0, max: 999, passo: 1, largura: "meia", ajuda: "0 = ilimitado", validar: inteiro },
        { nome: "limiteAgendamentos", rotulo: "Agendamentos por mês", tipo: "numero", obrigatorio: true, min: 0, max: 999999, passo: 1, largura: "meia", ajuda: "0 = ilimitado", validar: inteiro },
        { tipo: "secao", rotulo: "Funcionalidades incluídas" },
        { nome: "funcionalidades", rotulo: "Funcionalidades", tipo: "checkboxes", obrigatorio: true, opcoes: S.funcionalidadesCatalogo().map((f) => [f.id, f.nome]) }
    ];
}

async function editarPlano(id = null) {
    const atual = id ? S.plano(id) : null;
    const salvo = await abrirFormulario({
        titulo: atual ? `Editar plano ${atual.nome}` : "Novo plano",
        descricao: atual ? "Assinaturas existentes mantêm o valor contratado; o novo preço vale para novas contratações e mudanças de plano." : "",
        campos: camposPlano(),
        valores: atual ?? { diasTeste: 14, limiteUsuarios: 0, limiteAgendamentos: 0, funcionalidades: ["agenda_online"] },
        textoSalvar: atual ? "Salvar plano" : "Criar plano",
        aoSalvar: (v) => S.salvarPlano(v, id)
    });
    if (salvo) mostrarToast(atual ? "Plano atualizado." : `Plano ${salvo.nome} criado.`, "sucesso");
    return Boolean(salvo);
}

async function arquivarPlano(id) {
    const p = S.plano(id);
    const emUso = S.assinaturasDoPlano(id);
    const ok = await confirmar({
        titulo: `Arquivar o plano ${p.nome}?`,
        mensagem: `Ele deixa de aparecer para novas contratações e mudanças de plano. ${emUso ? `As ${emUso} assinaturas atuais continuam ativas.` : "Nenhuma assinatura usa este plano."}`,
        textoConfirmar: "Arquivar",
        perigo: true
    });
    if (!ok) return false;
    try {
        S.arquivarPlano(id);
        mostrarToast(`Plano ${p.nome} arquivado.`, "sucesso");
        return true;
    } catch (erro) {
        mostrarToast(erro.message, "erro");
        return false;
    }
}

function cartaoPlano(p) {
    const incluidas = new Set(p.funcionalidades);
    const economia = p.precoMensal ? 1 - p.precoAnual / (p.precoMensal * 12) : 0;
    return html`
        <article class="card plano-card ${p.arquivado ? "is-arquivado" : ""}">
            <header class="plano-card__topo">
                <div class="plano-card__nome"><h3>${p.nome}</h3>${p.arquivado ? html`<span class="badge">Arquivado</span>` : ""}</div>
                <p class="texto-sec">${p.descricao || "Sem descrição."}</p>
            </header>
            <div class="plano-card__preco">
                <strong class="num">${moeda(p.precoMensal)}</strong><span>/mês</span>
            </div>
            <p class="texto-terc plano-card__anual">ou ${moeda(p.precoAnual)}/ano${economia > 0.005 ? ` · economia de ${percentual(economia, 0)}` : ""}</p>
            ${listaDefinicao([
                ["Teste grátis", p.diasTeste ? `${p.diasTeste} dias` : "Sem teste"],
                ["Barbeiros", limite(p.limiteUsuarios, "")],
                ["Agendamentos/mês", limite(p.limiteAgendamentos, "")],
                ["Assinaturas em uso", numero(S.assinaturasDoPlano(p.id))]
            ])}
            <ul class="lista-recursos lista-recursos--compacta">
                ${S.funcionalidadesCatalogo().map((f) => html`<li class="${incluidas.has(f.id) ? "" : "is-ausente"}">${icone(incluidas.has(f.id) ? "check" : "minus")}<span>${f.nome}</span></li>`)}
            </ul>
            <footer class="plano-card__acoes">
                <button class="btn btn--pequeno" type="button" data-acao="editar-plano" data-id="${p.id}">${icone("pencil")}<span>Editar</span></button>
                ${p.arquivado
                    ? html`<button class="btn btn--pequeno" type="button" data-acao="restaurar-plano" data-id="${p.id}">${icone("archive-restore")}<span>Restaurar</span></button>`
                    : html`<button class="btn btn--pequeno btn--fantasma" type="button" data-acao="arquivar-plano" data-id="${p.id}">${icone("archive")}<span>Arquivar</span></button>`}
            </footer>
        </article>`;
}

function renderPlanos(view) {
    const raiz = novaRaiz(view);
    const lista = S.planos().filter((p) => mostrarArquivados || !p.arquivado);
    const arquivados = S.planos().filter((p) => p.arquivado).length;

    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Assinaturas e planos",
            subtitulo: "Contratos das barbearias e catálogo de planos do SaaS",
            acoes: html`<button class="btn btn--primario" type="button" data-acao="novo-plano">${icone("plus")}<span>Novo plano</span></button>`
        })}
        ${avisoDemo()}
        <section class="grade grade--kpi grade--kpi-5 secao">${kpis()}</section>
        ${abasTopo("planos")}
        <div class="barra-filtros barra-filtros--solta">
            <label class="marcar">
                <input type="checkbox" id="mostrarArquivados" ${mostrarArquivados ? bruto("checked") : ""}>
                <span>Mostrar arquivados (${numero(arquivados)})</span>
            </label>
        </div>
        ${lista.length
            ? html`<div class="grade grade--planos">${lista.map(cartaoPlano)}</div>`
            : html`<section class="card">${estadoVazio({ iconeNome: "badge-check", titulo: "Nenhum plano para exibir" })}</section>`}`);

    raiz.querySelector("#mostrarArquivados").addEventListener("change", (e) => {
        mostrarArquivados = e.target.checked;
        renderPlanos(view);
    });

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        let mudou = false;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderPlanos(view));
        if (acao === "novo-plano") mudou = await editarPlano();
        if (acao === "editar-plano") mudou = await editarPlano(id);
        if (acao === "arquivar-plano") mudou = await arquivarPlano(id);
        if (acao === "restaurar-plano") {
            S.restaurarPlano(id);
            mostrarToast("Plano restaurado.", "sucesso");
            mudou = true;
        }
        if (mudou) renderPlanos(view);
    });
}

export function render(view, { parametros = [] }) {
    if (parametros[0] === "planos") renderPlanos(view);
    else if (parametros[0]) renderDetalhe(view, parametros[0]);
    else renderAssinaturas(view);
}
