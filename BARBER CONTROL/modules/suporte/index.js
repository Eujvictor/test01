// =====================================================================
// MÓDULO 07 — SUPORTE (modo demonstrativo)
// Rotas: #/suporte        → central de chamados
//        #/suporte/<id>   → detalhe do chamado
// Respostas ficam só no registro do chamado: nenhum e-mail, WhatsApp
// ou SMS é enviado. O suporte assistido NÃO dá acesso a contas: apenas
// registra o pedido e a autorização explícita do cliente.
// =====================================================================
import { MODO_DEMO } from "../../js/demo.js";
import * as S from "../../services/demo/saas.js";
import * as O from "../../services/demo/operacao.js";
import {
    CATEGORIAS_CHAMADO, PRIORIDADES, STATUS_CHAMADO, RESPONSAVEIS_SUPORTE, STATUS_ASSISTIDO, STATUS_BARBEARIA, TIPOS_USUARIO, opcoes
} from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, data, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, kpi, estadoVazio, listaDefinicao,
    linhaDoTempo, botaoIcone, campoBusca, campoSelect, novaRaiz, iniciais
} from "../../js/components/ui.js";

const filtros = { busca: "", barbeariaId: "", prioridade: "", status: "", categoria: "" };

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function duracao(horas) {
    if (horas === null) return "—";
    if (horas < 1) return `${Math.round(horas * 60)} min`;
    if (horas < 48) return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
    return `${(horas / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}

// ---------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------
async function novoChamado() {
    const empresas = [...S.barbearias()].filter((b) => b.status !== "cancelada").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const solicitantes = S.usuarios().filter((u) => u.tipo !== "cliente" && empresas.some((b) => b.id === u.barbeariaId))
        .sort((a, b) => (S.barbearia(a.barbeariaId).nome + a.nome).localeCompare(S.barbearia(b.barbeariaId).nome + b.nome, "pt-BR"));
    const criado = await abrirFormulario({
        titulo: "Novo chamado",
        descricao: "Registro demonstrativo. O solicitante não recebe nenhuma notificação.",
        campos: [
            { nome: "barbeariaId", rotulo: "Barbearia", tipo: "select", obrigatorio: true, placeholderOpcao: "Selecione", opcoes: empresas.map((b) => [b.id, b.nome]), largura: "meia" },
            {
                nome: "solicitanteId", rotulo: "Solicitante", tipo: "select", obrigatorio: true, placeholderOpcao: "Selecione", largura: "meia",
                opcoes: solicitantes.map((u) => [u.id, `${u.nome} · ${S.barbearia(u.barbeariaId).nome} (${TIPOS_USUARIO[u.tipo].rotulo})`]),
                validar: (v, valores) => (S.usuario(v)?.barbeariaId !== valores.barbeariaId ? "Escolha alguém da barbearia selecionada." : null)
            },
            { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, maxlength: 90 },
            { nome: "categoria", rotulo: "Categoria", tipo: "select", obrigatorio: true, opcoes: opcoes(CATEGORIAS_CHAMADO), largura: "meia" },
            { nome: "prioridade", rotulo: "Prioridade", tipo: "select", obrigatorio: true, opcoes: opcoes(PRIORIDADES), largura: "meia" },
            { nome: "responsavel", rotulo: "Responsável", tipo: "select", opcoes: [["", "Não atribuído"], ...RESPONSAVEIS_SUPORTE] },
            { nome: "descricao", rotulo: "Descrição do problema", tipo: "textarea", obrigatorio: true, maxlength: 2000, validar: (v) => (v.length < 10 ? "Descreva com pelo menos 10 caracteres." : null) }
        ],
        valores: { prioridade: "normal", categoria: "duvidas" },
        textoSalvar: "Abrir chamado",
        aoSalvar: (v) => O.criarChamado(v)
    });
    if (criado) {
        mostrarToast(`Chamado ${criado.protocolo} aberto.`, "sucesso");
        window.location.hash = `#/suporte/${criado.id}`;
    }
}

async function alterarStatus(id) {
    const c = O.chamado(id);
    const ok = await abrirFormulario({
        titulo: "Alterar status",
        descricao: `${c.protocolo} · status atual: ${STATUS_CHAMADO[c.status].rotulo}`,
        campos: [
            { nome: "status", rotulo: "Novo status", tipo: "select", obrigatorio: true, opcoes: opcoes(STATUS_CHAMADO) },
            { nome: "comentario", rotulo: "Comentário para o histórico", tipo: "textarea", maxlength: 300 }
        ],
        valores: { status: c.status },
        textoSalvar: "Alterar status",
        aoSalvar: (v) => O.alterarStatusChamado(id, v.status, v.comentario)
    });
    if (ok) mostrarToast("Status atualizado.", "sucesso");
    return Boolean(ok);
}

async function alterarPrioridade(id) {
    const c = O.chamado(id);
    const ok = await abrirFormulario({
        titulo: "Alterar prioridade",
        descricao: `${c.protocolo} · prioridade atual: ${PRIORIDADES[c.prioridade].rotulo}`,
        campos: [{ nome: "prioridade", rotulo: "Nova prioridade", tipo: "select", obrigatorio: true, opcoes: opcoes(PRIORIDADES) }],
        valores: { prioridade: c.prioridade },
        textoSalvar: "Alterar prioridade",
        aoSalvar: (v) => O.alterarPrioridade(id, v.prioridade)
    });
    if (ok) mostrarToast("Prioridade atualizada.", "sucesso");
    return Boolean(ok);
}

async function atribuir(id) {
    const c = O.chamado(id);
    const ok = await abrirFormulario({
        titulo: "Responsável pelo atendimento",
        campos: [{ nome: "responsavel", rotulo: "Responsável", tipo: "select", obrigatorio: true, opcoes: RESPONSAVEIS_SUPORTE }],
        valores: { responsavel: c.responsavel ?? "proprietario" },
        textoSalvar: "Salvar",
        aoSalvar: (v) => O.atribuirResponsavel(id, v.responsavel)
    });
    if (ok) mostrarToast("Responsável definido.", "sucesso");
    return Boolean(ok);
}

async function solicitarAssistido(id) {
    const ok = await abrirFormulario({
        titulo: "Solicitar suporte assistido",
        descricao: "O cliente precisa autorizar explicitamente. Enquanto não houver autorização registrada, nenhum acesso é permitido. Nesta demonstração não existe acesso remoto real.",
        campos: [
            { nome: "escopo", rotulo: "Escopo do acesso", tipo: "select", obrigatorio: true, opcoes: [
                ["Configurações da agenda", "Configurações da agenda"], ["Cadastro de serviços", "Cadastro de serviços"],
                ["Configurações do site", "Configurações do site"], ["Relatórios (somente leitura)", "Relatórios (somente leitura)"]] },
            { nome: "motivo", rotulo: "Motivo apresentado ao cliente", tipo: "textarea", obrigatorio: true, maxlength: 300 }
        ],
        textoSalvar: "Registrar solicitação",
        aoSalvar: (v) => O.solicitarSuporteAssistido(id, v)
    });
    if (ok) mostrarToast("Solicitação registrada. Aguardando autorização do cliente.", "sucesso");
    return Boolean(ok);
}

async function registrarDecisao(id) {
    const c = O.chamado(id);
    const solicitante = S.usuario(c.solicitanteId);
    const ok = await abrirFormulario({
        titulo: "Registrar resposta do cliente",
        descricao: "Registre aqui a decisão informada pelo cliente. A autorização precisa ser explícita.",
        campos: [
            { nome: "decisao", rotulo: "Decisão do cliente", tipo: "select", obrigatorio: true, opcoes: [["autorizado", "Autorizou"], ["negado", "Não autorizou"]] },
            { nome: "autorizadoPor", rotulo: "Nome de quem respondeu", tipo: "texto", obrigatorio: true, maxlength: 80, largura: "meia" },
            { nome: "validadeHoras", rotulo: "Validade da autorização (horas)", tipo: "numero", min: 1, max: 24, passo: 1, largura: "meia", padrao: 2,
                validarVazio: true, validar: (v, valores) => (valores.decisao === "autorizado" && !v ? "Informe a validade." : null) },
            { nome: "confirmacao", rotulo: "Confirmação", tipo: "checkboxes", opcoes: [["sim", "Confirmo que o cliente autorizou de forma explícita, para o escopo informado"]],
                validarVazio: true, validar: (v, valores) => (valores.decisao === "autorizado" && !v.includes("sim") ? "A autorização explícita precisa ser confirmada." : null) }
        ],
        valores: { autorizadoPor: solicitante?.nome ?? "", validadeHoras: 2 },
        textoSalvar: "Registrar decisão",
        aoSalvar: (v) => O.registrarDecisaoAssistido(id, { ...v, confirmacao: v.confirmacao.includes("sim") })
    });
    if (ok) mostrarToast("Decisão registrada no histórico.", "sucesso");
    return Boolean(ok);
}

async function encerrarAssistido(id) {
    const ok = await confirmar({ titulo: "Encerrar suporte assistido?", mensagem: "A autorização será revogada e registrada no histórico.", textoConfirmar: "Encerrar", perigo: true });
    if (!ok) return false;
    O.encerrarSuporteAssistido(id);
    mostrarToast("Sessão de suporte assistido encerrada.", "sucesso");
    return true;
}

// ---------------------------------------------------------------------
// Central de chamados
// ---------------------------------------------------------------------
function linhas() {
    const termo = normalizar(filtros.busca);
    return O.chamados().filter((c) =>
        (!termo || normalizar(c.protocolo).includes(termo) || normalizar(c.titulo).includes(termo)) &&
        (!filtros.barbeariaId || c.barbeariaId === filtros.barbeariaId) &&
        (!filtros.prioridade || c.prioridade === filtros.prioridade) &&
        (!filtros.status || c.status === filtros.status) &&
        (!filtros.categoria || c.categoria === filtros.categoria));
}

const COLUNAS = [
    { chave: "protocolo", rotulo: "Protocolo", render: (c) => html`<a class="link-forte num" href="#/suporte/${c.id}">${c.protocolo}</a>` },
    { chave: "titulo", rotulo: "Título", render: (c) => html`${c.titulo}<span class="celula-sub">${CATEGORIAS_CHAMADO[c.categoria].rotulo}</span>` },
    { chave: "barbearia", rotulo: "Barbearia", valor: (c) => S.barbearia(c.barbeariaId)?.nome ?? "", render: (c) => html`${S.barbearia(c.barbeariaId)?.nome ?? "—"}<span class="celula-sub">${S.usuario(c.solicitanteId)?.nome ?? ""}</span>` },
    { chave: "prioridade", rotulo: "Prioridade", valor: (c) => PRIORIDADES[c.prioridade].peso, render: (c) => badgeStatus(PRIORIDADES, c.prioridade) },
    { chave: "abertoEm", rotulo: "Abertura", render: (c) => data(c.abertoEm) },
    { chave: "atualizadoEm", rotulo: "Atualização", render: (c) => html`<span title="${dataHora(c.atualizadoEm)}">${tempoRelativo(c.atualizadoEm)}</span>` },
    { chave: "status", rotulo: "Status", valor: (c) => STATUS_CHAMADO[c.status].rotulo, render: (c) => badgeStatus(STATUS_CHAMADO, c.status) },
    { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (c) => botaoIcone({ acao: "ver", id: c.id, nomeIcone: "eye", rotulo: `Ver ${c.protocolo}` }) }
];

function kpis() {
    const r = O.resumoSuporte();
    return html`
        ${kpi({ rotulo: "Total de chamados", valor: numero(r.total), iconeNome: "life-buoy", nota: "Todos os registros" })}
        ${kpi({ rotulo: "Abertos", valor: numero(r.abertos), iconeNome: "inbox", nota: "Sem atendimento iniciado" })}
        ${kpi({ rotulo: "Em atendimento", valor: numero(r.emAtendimento), iconeNome: "headset", nota: "Com a equipe" })}
        ${kpi({ rotulo: "Aguardando resposta", valor: numero(r.aguardando), iconeNome: "hourglass", nota: "Aguardando o cliente" })}
        ${kpi({ rotulo: "Resolvidos", valor: numero(r.resolvidos), iconeNome: "circle-check", nota: "Resolvidos e encerrados" })}
        ${kpi({ rotulo: "Prioritários", valor: numero(r.prioritarios), iconeNome: "siren", nota: "Alta ou crítica, em aberto", destaque: r.prioritarios > 0 })}
        ${kpi({ rotulo: "Tempo médio de resolução", valor: duracao(r.tempoMedioHoras), iconeNome: "timer", nota: "Demonstrativo" })}`;
}

function renderLista(view) {
    const raiz = novaRaiz(view);
    const empresas = [...S.barbearias()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Suporte", subtitulo: "Central de chamados das barbearias",
            acoes: html`<button class="btn btn--primario" type="button" data-acao="novo">${icone("plus")}<span>Novo chamado</span></button>`
        })}
        ${avisoDemo()}
        <section class="grade grade--kpi secao" data-kpis>${kpis()}</section>
        <section class="card">
            <div class="barra-filtros">
                ${campoBusca({ id: "fBusca", valor: filtros.busca, placeholder: "Pesquisar protocolo ou título" })}
                ${campoSelect({ id: "fBarbearia", rotulo: "Empresa", valor: filtros.barbeariaId, opcoes: [["", "Todas as empresas"], ...empresas.map((b) => [b.id, b.nome])] })}
                ${campoSelect({ id: "fPrioridade", rotulo: "Prioridade", valor: filtros.prioridade, opcoes: [["", "Todas as prioridades"], ...opcoes(PRIORIDADES)] })}
                ${campoSelect({ id: "fStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_CHAMADO)] })}
                ${campoSelect({ id: "fCategoria", rotulo: "Categoria", valor: filtros.categoria, opcoes: [["", "Todas as categorias"], ...opcoes(CATEGORIAS_CHAMADO)] })}
                <button class="btn btn--fantasma" type="button" data-acao="limpar">${icone("filter-x")}<span>Limpar</span></button>
            </div>
            <div data-tabela></div>
        </section>`);

    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "atualizadoEm", direcao: "desc" }, vazio: "Nenhum chamado corresponde aos filtros.", rotulo: "Chamados" });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());

    let espera;
    raiz.querySelector("#fBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { filtros.busca = e.target.value; tabela.definirLinhas(linhas()); }, 150);
    });
    [["#fBarbearia", "barbeariaId"], ["#fPrioridade", "prioridade"], ["#fStatus", "status"], ["#fCategoria", "categoria"]].forEach(([sel, chave]) =>
        raiz.querySelector(sel).addEventListener("change", (e) => { filtros[chave] = e.target.value; tabela.definirLinhas(linhas()); }));

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao, id } = botao.dataset;
        if (acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderLista(view));
        if (acao === "limpar") { Object.assign(filtros, { busca: "", barbeariaId: "", prioridade: "", status: "", categoria: "" }); return renderLista(view); }
        if (acao === "novo") return novoChamado();
        if (acao === "ver") window.location.hash = `#/suporte/${id}`;
    });
}

// ---------------------------------------------------------------------
// Detalhe do chamado
// ---------------------------------------------------------------------
function conversa(c) {
    return html`
        <ol class="conversa">
            ${c.mensagens.map((m) => html`
                <li class="conversa__msg conversa__msg--${m.autor}">
                    <span class="avatar avatar--pequeno">${m.autor === "suporte" ? "BC" : iniciais(m.nome)}</span>
                    <div class="conversa__balao">
                        <div class="conversa__cabecalho"><strong>${m.nome}</strong><time datetime="${m.data}" title="${dataHora(m.data)}">${tempoRelativo(m.data)}</time></div>
                        <p>${m.texto}</p>
                    </div>
                </li>`)}
        </ol>`;
}

function cartaoAssistido(c) {
    const s = c.suporteAssistido ?? { status: "nao_solicitado" };
    const expirado = O.assistidoExpirado(c);
    const acoes = {
        nao_solicitado: html`<button class="btn btn--pequeno" type="button" data-acao="assistido-solicitar">${icone("shield-question")}<span>Solicitar autorização</span></button>`,
        solicitado: html`<button class="btn btn--pequeno btn--primario" type="button" data-acao="assistido-decisao">${icone("clipboard-check")}<span>Registrar resposta do cliente</span></button>`,
        autorizado: html`<button class="btn btn--pequeno btn--perigo" type="button" data-acao="assistido-encerrar">${icone("shield-off")}<span>Encerrar e revogar</span></button>`,
        negado: html`<button class="btn btn--pequeno" type="button" data-acao="assistido-solicitar">${icone("shield-question")}<span>Nova solicitação</span></button>`,
        encerrado: html`<button class="btn btn--pequeno" type="button" data-acao="assistido-solicitar">${icone("shield-question")}<span>Nova solicitação</span></button>`
    }[s.status];
    return html`
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Suporte assistido</h2>${badgeStatus(STATUS_ASSISTIDO, s.status)}</div>
            <div class="card__corpo">
                <p class="texto-sec texto-pequeno">Acesso somente com autorização explícita do cliente, registrada no histórico. Nesta demonstração não existe acesso remoto nem visualização de contas.</p>
                ${s.status !== "nao_solicitado" ? listaDefinicao([
                    ["Escopo", s.escopo],
                    ["Motivo", s.motivo],
                    ["Solicitado em", dataHora(s.solicitadoEm)],
                    s.respondidoEm ? ["Resposta", `${s.status === "negado" ? "Negado" : "Autorizado"} por ${s.autorizadoPor} em ${dataHora(s.respondidoEm)}`] : null,
                    s.validadeHoras ? ["Validade", `${s.validadeHoras} h${expirado ? " · expirada" : ""}`] : null,
                    s.encerradoEm ? ["Encerrado em", dataHora(s.encerradoEm)] : null
                ]) : ""}
                <div class="acoes-cartao">${acoes}</div>
            </div>
        </section>`;
}

function renderDetalhe(view, id) {
    const raiz = novaRaiz(view);
    const c = O.chamado(id);
    if (!c) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Chamado não encontrado", voltar: { href: "#/suporte", rotulo: "Suporte" } })}
            <section class="card">${estadoVazio({ iconeNome: "life-buoy", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const b = S.barbearia(c.barbeariaId);
    const sol = S.usuario(c.solicitanteId);
    const plano = S.planoDaBarbearia(c.barbeariaId);
    const encerrado = c.status === "encerrado";

    renderizar(raiz, html`
        ${cabecalho({
            titulo: c.titulo,
            voltar: { href: "#/suporte", rotulo: "Suporte" },
            extra: html`${badgeStatus(STATUS_CHAMADO, c.status)}${badgeStatus(PRIORIDADES, c.prioridade)}`,
            subtitulo: `${c.protocolo} · ${CATEGORIAS_CHAMADO[c.categoria].rotulo} · aberto em ${dataHora(c.abertoEm)}`,
            acoes: html`
                <button class="btn" type="button" data-acao="status">${icone("refresh-cw")}<span>Alterar status</span></button>
                <button class="btn" type="button" data-acao="prioridade">${icone("flag")}<span>Prioridade</span></button>
                <button class="btn" type="button" data-acao="responsavel">${icone("user-cog")}<span>Responsável</span></button>`
        })}
        ${avisoDemo()}
        <div class="layout-detalhe">
            <div class="layout-detalhe__principal">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Descrição do problema</h2></div>
                    <div class="card__corpo"><p class="texto-corrido">${c.descricao}</p></div>
                </section>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Conversa</h2><span class="badge">${numero(c.mensagens.length)} mensagens</span></div>
                    <div class="card__corpo">
                        ${conversa(c)}
                        ${encerrado
                            ? html`<div class="alerta alerta--info">${icone("lock")}<span>Chamado encerrado. Altere o status para responder.</span></div>`
                            : html`
                                <form class="resposta" data-form="resposta" novalidate>
                                    <label class="campo">
                                        <span class="campo__rotulo">Responder ao cliente</span>
                                        <textarea class="entrada entrada--area" name="texto" rows="3" maxlength="2000" placeholder="Escreva a resposta…"></textarea>
                                        <span class="campo__erro" data-erro="resposta"></span>
                                    </label>
                                    <div class="resposta__acoes">
                                        <label class="marcar"><input type="checkbox" name="aguardar"><span>Aguardar retorno do cliente</span></label>
                                        <button class="btn btn--primario" type="submit">${icone("send")}<span>Enviar resposta</span></button>
                                    </div>
                                    <span class="campo__ajuda">A resposta fica registrada no chamado (demonstração). Nenhum e-mail ou mensagem é enviado.</span>
                                </form>`}
                    </div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Observações internas</h2><span class="badge">Visível só para a equipe</span></div>
                    <div class="card__corpo">
                        ${c.notas.length ? html`<ul class="notas">${c.notas.map((n) => html`
                            <li class="nota"><p>${n.texto}</p><span class="texto-terc">${n.autor} · ${dataHora(n.data)}</span></li>`)}</ul>`
                            : html`<p class="texto-terc">Nenhuma observação interna.</p>`}
                        <form class="resposta" data-form="nota" novalidate>
                            <label class="campo">
                                <span class="sr-only">Nova observação interna</span>
                                <textarea class="entrada entrada--area" name="texto" rows="2" maxlength="1000" placeholder="Adicionar observação interna…"></textarea>
                                <span class="campo__erro" data-erro="nota"></span>
                            </label>
                            <div class="resposta__acoes"><span></span><button class="btn" type="submit">${icone("sticky-note")}<span>Adicionar observação</span></button></div>
                        </form>
                    </div>
                </section>
            </div>
            <aside class="layout-detalhe__lateral">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Empresa</h2><a class="btn btn--pequeno" href="#/barbearias/${b?.id}">${icone("external-link")}<span>Abrir</span></a></div>
                    <div class="card__corpo">${listaDefinicao([
                        ["Barbearia", b?.nome], ["Status", b ? badgeStatus(STATUS_BARBEARIA, b.status) : "—"], ["Plano", plano?.nome], ["Cidade/UF", b ? `${b.cidade}/${b.estado}` : "—"]
                    ])}</div>
                </section>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Solicitante</h2>${sol ? html`<a class="btn btn--pequeno" href="#/usuarios/${sol.id}">${icone("external-link")}<span>Perfil</span></a>` : ""}</div>
                    <div class="card__corpo">${listaDefinicao([
                        ["Nome", sol?.nome], ["Tipo", sol ? TIPOS_USUARIO[sol.tipo].rotulo : "—"], ["E-mail (demonstrativo)", sol?.email], ["Telefone", sol?.telefone]
                    ])}</div>
                </section>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Atendimento</h2></div>
                    <div class="card__corpo">${listaDefinicao([
                        ["Responsável", O.rotuloResponsavel(c.responsavel)], ["Última atualização", dataHora(c.atualizadoEm)],
                        ["Resolvido em", c.resolvidoEm ? dataHora(c.resolvidoEm) : "—"]
                    ])}</div>
                </section>
                <div class="secao">${cartaoAssistido(c)}</div>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Histórico de alterações</h2></div>
                    <div class="card__corpo">${linhaDoTempo(O.historicoDe("chamado", c.id))}</div>
                </section>
            </aside>
        </div>`);

    const recarregar = () => renderDetalhe(view, id);

    raiz.querySelectorAll("form[data-form]").forEach((form) => form.addEventListener("submit", (e) => {
        e.preventDefault();
        const tipo = form.dataset.form;
        const texto = form.elements.texto.value.trim();
        const erro = form.querySelector("[data-erro]");
        if (texto.length < 2) {
            erro.textContent = "Escreva uma mensagem antes de enviar.";
            form.elements.texto.setAttribute("aria-invalid", "true");
            form.elements.texto.focus();
            return;
        }
        try {
            if (tipo === "resposta") {
                O.responderChamado(id, texto, { aguardarCliente: form.elements.aguardar.checked });
                mostrarToast("Resposta registrada no chamado.", "sucesso");
            } else {
                O.adicionarNota(id, texto);
                mostrarToast("Observação interna adicionada.", "sucesso");
            }
            recarregar();
        } catch (falha) {
            mostrarToast(falha.message, "erro");
        }
    }));

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const acoes = {
            "restaurar-demo": () => tratarRestauracaoDemo(recarregar),
            status: () => alterarStatus(id),
            prioridade: () => alterarPrioridade(id),
            responsavel: () => atribuir(id),
            "assistido-solicitar": () => solicitarAssistido(id),
            "assistido-decisao": () => registrarDecisao(id),
            "assistido-encerrar": () => encerrarAssistido(id)
        };
        const executar = acoes[botao.dataset.acao];
        if (!executar) return;
        try {
            if (await executar()) recarregar();
        } catch (falha) {
            mostrarToast(falha.message, "erro");
        }
    });
}

export async function render(view, contexto) {
    // Fora do modo demonstração: dados reais do Supabase (Master + MFA).
    if (!MODO_DEMO) {
        const real = await import("./real.js");
        return real.render(view, contexto);
    }
    const { parametros = [] } = contexto;
    if (parametros[0]) renderDetalhe(view, parametros[0]);
    else renderLista(view);
}
