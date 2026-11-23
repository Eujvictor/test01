// =====================================================================
// MÓDULO 07 — SUPORTE (MODO REAL)
// Rotas: #/suporte          → chamados de todas as barbearias
//        #/suporte/<uuid>   → conversa do chamado
// O dono abre o chamado pelo painel da barbearia ("Suporte") e vê as
// respostas lá. Nada é enviado por e-mail ou WhatsApp. Fonte: control_api
// (administrador + MFA, validados no servidor).
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { CATEGORIAS_CHAMADO, PRIORIDADES, STATUS_CHAMADO } from "../../services/demo/catalogo.js";
import { html, icone, renderizar, bruto } from "../../js/utilities/dom.js";
import { numero, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, listaDefinicao, campoBusca, campoSelect, novaRaiz, opcoesSelect } from "../../js/components/ui.js";

const STATUS = { ...STATUS_CHAMADO, aguardando: { rotulo: "Aguardando a barbearia", tom: "neutro" } };
const filtros = { busca: "", status: "ativos", prioridade: "" };
const ATIVOS = ["aberto", "em_atendimento", "aguardando"];
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function erroNaTela(raiz, erro, voltar) {
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Suporte", subtitulo: "Painel Master", voltar })}
        <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar o suporte", texto: erro.message })}</section>`);
}

async function renderLista(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Suporte", subtitulo: "Carregando do Supabase…" })}`);
    let lista;
    try {
        lista = await rpc("listar_chamados");
    } catch (erro) {
        return erroNaTela(raiz, erro);
    }
    const cont = (f) => lista.filter(f).length;
    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Suporte", subtitulo: "Chamados abertos pelas barbearias no painel delas · dados reais",
            acoes: html`<button class="btn" type="button" data-acao="atualizar">${icone("refresh-cw")}<span class="btn__texto-opcional">Atualizar</span></button>`
        })}
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Sem resposta", valor: numero(cont((c) => c.nao_lido)), iconeNome: "mail-warning", nota: "Mensagens novas das barbearias", destaque: true })}
            ${kpi({ rotulo: "Em andamento", valor: numero(cont((c) => c.status === "aberto" || c.status === "em_atendimento")), iconeNome: "life-buoy", nota: "Abertos ou em atendimento" })}
            ${kpi({ rotulo: "Aguardando a barbearia", valor: numero(cont((c) => c.status === "aguardando")), iconeNome: "hourglass", nota: "Você já respondeu" })}
            ${kpi({ rotulo: "Prioridade alta", valor: numero(cont((c) => ATIVOS.includes(c.status) && (c.prioridade === "alta" || c.prioridade === "critica"))), iconeNome: "siren", nota: "Alta ou crítica, em andamento" })}
        </section>
        <div class="barra-filtros barra-filtros--solta">
            ${campoBusca({ id: "cBusca", valor: filtros.busca, placeholder: "Pesquisar assunto, barbearia, protocolo ou e-mail" })}
            ${campoSelect({ id: "cStatus", rotulo: "Situação", valor: filtros.status, opcoes: [["ativos", "Em andamento"], ["", "Todos"], ...Object.entries(STATUS).map(([k, v]) => [k, v.rotulo])] })}
            ${campoSelect({ id: "cPrioridade", rotulo: "Prioridade", valor: filtros.prioridade, opcoes: [["", "Todas as prioridades"], ...Object.entries(PRIORIDADES).map(([k, v]) => [k, v.rotulo])] })}
        </div>
        <section class="card"><div data-tabela></div></section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "protocolo", rotulo: "Chamado", valor: (c) => Number(c.protocolo), render: (c) => html`
                <a class="link-forte" href="#/suporte/${c.id}">${c.nao_lido ? html`<span class="ponto ponto--novo" title="Mensagem nova"></span> ` : ""}#${c.protocolo} · ${c.assunto}</a>
                <span class="celula-sub">${c.ultima_de_suporte ? "Você: " : ""}${c.ultima_mensagem ?? ""}</span>` },
            { chave: "barbearia", rotulo: "Barbearia", render: (c) => html`<a href="#/barbearias/${c.barbearia_id}">${c.barbearia}</a><span class="celula-sub">${c.autor_email ?? ""}</span>` },
            { chave: "categoria", rotulo: "Categoria", valor: (c) => CATEGORIAS_CHAMADO[c.categoria]?.rotulo, render: (c) => CATEGORIAS_CHAMADO[c.categoria]?.rotulo ?? c.categoria },
            { chave: "prioridade", rotulo: "Prioridade", valor: (c) => PRIORIDADES[c.prioridade]?.peso, render: (c) => badgeStatus(PRIORIDADES, c.prioridade) },
            { chave: "status", rotulo: "Situação", valor: (c) => STATUS[c.status]?.rotulo, render: (c) => badgeStatus(STATUS, c.status) },
            { chave: "ultima_mensagem_em", rotulo: "Última atividade", render: (c) => html`<span title="${dataHora(c.ultima_mensagem_em)}">${tempoRelativo(c.ultima_mensagem_em)}</span>` }
        ],
        ordenacao: { chave: "ultima_mensagem_em", direcao: "desc" }, vazio: "Nenhum chamado com os filtros atuais.", rotulo: "Chamados"
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => lista.filter((c) =>
        (!filtros.status || (filtros.status === "ativos" ? ATIVOS.includes(c.status) : c.status === filtros.status)) &&
        (!filtros.prioridade || c.prioridade === filtros.prioridade) &&
        (!filtros.busca || normalizar(`${c.protocolo} ${c.assunto} ${c.barbearia} ${c.autor_email}`).includes(normalizar(filtros.busca))));
    tabela.definirLinhas(filtrar());
    raiz.querySelector("#cBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("#cStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("#cPrioridade").addEventListener("change", (e) => { filtros.prioridade = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("[data-acao=atualizar]").addEventListener("click", () => renderLista(view));
}

async function renderChamado(view, id) {
    const raiz = novaRaiz(view);
    const voltar = { href: "#/suporte", rotulo: "Chamados" };
    renderizar(raiz, html`${cabecalho({ titulo: "Chamado", subtitulo: "Carregando…", voltar })}`);
    let c;
    try {
        c = await rpc("ver_chamado", { p_chamado: id });
    } catch (erro) {
        return erroNaTela(raiz, erro, voltar);
    }
    const encerrado = c.status === "encerrado";
    renderizar(raiz, html`
        ${cabecalho({
            titulo: `#${c.protocolo} · ${c.assunto}`, voltar,
            extra: html`${badgeStatus(STATUS, c.status)} ${badgeStatus(PRIORIDADES, c.prioridade)}`,
            subtitulo: `${c.barbearia} · aberto ${tempoRelativo(c.criado_em)}`
        })}
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Conversa</h2><span class="badge">${numero(c.mensagens.length)} mensagem(ns)</span></div>
                <div class="card__corpo">
                    <ol class="conversa">
                        ${c.mensagens.map((m) => html`
                            <li class="conversa__msg conversa__msg--${m.de_suporte ? "suporte" : "cliente"}">
                                <span class="avatar avatar--pequeno">${m.de_suporte ? "BC" : String(m.autor ?? "B").slice(0, 2).toUpperCase()}</span>
                                <div class="conversa__balao">
                                    <div class="conversa__cabecalho"><strong>${m.de_suporte ? "Suporte Barber" : m.autor}</strong><time datetime="${m.criado_em}" title="${dataHora(m.criado_em)}">${tempoRelativo(m.criado_em)}</time></div>
                                    <p>${m.texto}</p>
                                </div>
                            </li>`)}
                    </ol>
                    ${encerrado ? html`<p class="texto-terc texto-pequeno">Chamado encerrado: a barbearia não pode mais responder. Reabra mudando a situação.</p>` : ""}
                    <form class="resposta" data-form="resposta" novalidate>
                        <label class="campo">
                            <span class="campo__rotulo">Responder à barbearia</span>
                            <textarea class="entrada entrada--area" name="texto" rows="4" maxlength="4000" placeholder="Escreva a resposta…"></textarea>
                            <span class="campo__erro" data-erro="resposta"></span>
                        </label>
                        <div class="resposta__acoes">
                            <label class="filtro"><span class="sr-only">Situação depois de enviar</span>
                                <select class="entrada" name="status" aria-label="Situação depois de enviar">
                                    ${opcoesSelect([["", "Aguardar a barbearia (padrão)"], ["em_atendimento", "Continuar em atendimento"], ["resolvido", "Marcar como resolvido"], ["encerrado", "Encerrar"]], "")}
                                </select></label>
                            <button class="btn btn--primario" type="submit">${icone("send")}<span>Enviar resposta</span></button>
                        </div>
                        <span class="campo__ajuda">A resposta aparece no painel da barbearia, em “Suporte”, assinada como “Suporte Barber”.</span>
                    </form>
                </div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Detalhes</h2></div>
                <div class="card__corpo">
                    ${listaDefinicao([
                        ["Barbearia", html`<a class="link-forte" href="#/barbearias/${c.barbearia_id}">${c.barbearia}</a>`],
                        ["Aberto por", c.autor_email ?? "—"],
                        ["Categoria", CATEGORIAS_CHAMADO[c.categoria]?.rotulo ?? c.categoria],
                        ["Aberto em", dataHora(c.criado_em)],
                        ["Resolvido em", c.resolvido_em ? dataHora(c.resolvido_em) : "—"]
                    ])}
                    <form class="formulario-linha" data-form="ajustes">
                        <label class="campo"><span class="campo__rotulo">Situação</span>
                            <select class="entrada" name="status">${opcoesSelect(Object.entries(STATUS).map(([k, v]) => [k, v.rotulo]), c.status)}</select></label>
                        <label class="campo"><span class="campo__rotulo">Prioridade</span>
                            <select class="entrada" name="prioridade">${opcoesSelect(Object.entries(PRIORIDADES).map(([k, v]) => [k, v.rotulo]), c.prioridade)}</select></label>
                        <button class="btn" type="submit">${icone("save")}<span>Salvar ajustes</span></button>
                    </form>
                </div>
            </section>
        </div>`);

    const formResposta = raiz.querySelector("[data-form=resposta]");
    formResposta.addEventListener("submit", async (e) => {
        e.preventDefault();
        const texto = formResposta.elements.texto.value.trim();
        const erro = formResposta.querySelector("[data-erro=resposta]");
        if (!texto) { erro.textContent = "Escreva a resposta."; formResposta.elements.texto.focus(); return; }
        erro.textContent = "";
        const botao = formResposta.querySelector("[type=submit]");
        botao.disabled = true;
        try {
            await rpc("responder_chamado", { p_chamado: id, p_texto: texto, p_status: formResposta.elements.status.value || null, p_prioridade: null });
            mostrarToast("Resposta enviada. A barbearia vê no painel dela.", "sucesso");
            renderChamado(view, id);
        } catch (falha) {
            botao.disabled = false;
            mostrarToast(falha.message, "erro");
        }
    });
    const formAjustes = raiz.querySelector("[data-form=ajustes]");
    formAjustes.addEventListener("submit", async (e) => {
        e.preventDefault();
        const status = formAjustes.elements.status.value;
        const prioridade = formAjustes.elements.prioridade.value;
        if (status === c.status && prioridade === c.prioridade) return mostrarToast("Nada mudou.", "atencao");
        try {
            await rpc("responder_chamado", { p_chamado: id, p_texto: null, p_status: status === c.status ? null : status, p_prioridade: prioridade === c.prioridade ? null : prioridade });
            mostrarToast("Chamado atualizado.", "sucesso");
            renderChamado(view, id);
        } catch (falha) {
            mostrarToast(falha.message, "erro");
        }
    });
}

export function render(view, { parametros = [] }) {
    if (parametros[0]) renderChamado(view, parametros[0]);
    else renderLista(view);
}
