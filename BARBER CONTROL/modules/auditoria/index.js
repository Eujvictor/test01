// =====================================================================
// MÓDULO 20 — AUDITORIA E ACESSOS (modo demonstrativo)
// Rotas: #/auditoria[/eventos|acessos|operacoes|sessoes|retencao]
// Consolida os eventos de autenticação (módulo 10) e o histórico de
// operações de todos os módulos. Registros locais e alteráveis: NÃO é
// uma trilha de auditoria inviolável nem prova de segurança.
// =====================================================================
import * as AU from "../../services/demo/auditoria.js";
import { STATUS_SESSAO } from "../../services/demo/catalogo.js";
import { html, icone, renderizar, bruto } from "../../js/utilities/dom.js";
import { numero, dataHora, data, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { exportarRelatorio } from "../../js/utilities/exportar.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirPainel } from "../../js/components/painel.js";
import { graficoBarras, barrasHorizontais } from "../../js/components/grafico.js";
import { kpi, estadoVazio, badgeStatus, listaDefinicao, campoBusca, campoSelect, molduraComAbas, botaoIcone } from "../../js/components/ui.js";

const SECOES = [["", "Visão geral"], ["eventos", "Todos os eventos"], ["acessos", "Acessos"], ["operacoes", "Operações"], ["sessoes", "Sessões"], ["retencao", "Retenção"]];
const PERIODOS = [["", "Todo o período"], ["1", "Últimas 24 horas"], ["7", "Últimos 7 dias"], ["14", "Últimos 14 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"]];
const filtros = { busca: "", dias: "30", usuario: "", modulo: "", tipo: "", resultado: "", gravidade: "" };
const PADRAO = { busca: "", dias: "30", usuario: "", modulo: "", tipo: "", resultado: "", gravidade: "" };
const opcoesDe = (mapa) => Object.entries(mapa).map(([k, v]) => [k, v.rotulo]);

function avisoAuditoria() {
    return html`<div class="alerta alerta--atencao" role="note">${icone("triangle-alert")}<span><strong>Histórico demonstrativo, não inviolável.</strong> Os registros ficam no navegador e podem ser alterados ou apagados por quem o usa (inclusive pelo botão "Restaurar dados iniciais"). Não servem como prova de segurança. Na integração real, a auditoria será gravada no backend em tabela protegida, somente de inserção.</span></div>`;
}

function kpis() {
    const r = AU.resumo();
    return html`
        ${kpi({ rotulo: "Total de eventos", valor: numero(r.total), iconeNome: "scroll-text", nota: r.primeiro ? `Desde ${data(r.primeiro)}` : "", destaque: true })}
        ${kpi({ rotulo: "Logins registrados", valor: numero(r.logins), iconeNome: "log-in", nota: `${numero(r.recusados)} recusados` })}
        ${kpi({ rotulo: "Operações administrativas", valor: numero(r.operacoes), iconeNome: "user-cog", nota: "Todos os módulos" })}
        ${kpi({ rotulo: "Alterações de configurações", valor: numero(r.configuracoes), iconeNome: "settings", nota: "Módulos 12, 13 e 19" })}
        ${kpi({ rotulo: "Eventos suspeitos", valor: numero(r.suspeitos), iconeNome: "shield-alert", nota: "Demonstrativos" })}
        ${kpi({ rotulo: "Sessões registradas", valor: numero(r.sessoes), iconeNome: "monitor-smartphone", nota: `${numero(r.sessoesAtivas)} ativas` })}
        ${kpi({ rotulo: "Eventos críticos", valor: numero(r.criticos), iconeNome: "octagon-alert", nota: "Gravidade crítica" })}`;
}

function verEvento(id) {
    const e = AU.evento(id);
    if (!e) return mostrarToast("Evento não encontrado (pode ter sido removido ao restaurar os dados).", "erro");
    const d = e.detalhes ?? {};
    const extras = e.origem === "acesso"
        ? [["Sistema", d.sistema], ["Endereço IP (fictício)", d.ip], ["Cidade de origem", d.cidade], ["Dispositivo", d.dispositivo], ["Revisão", d.statusRevisao]]
        : [["Entidade", d.entidade], ["Identificador do registro", d.entidadeId], ["Ação registrada", d.acao],
            d.campo ? ["Campo alterado", d.rotulo ?? d.campo] : null,
            d.anterior !== undefined ? ["Valor anterior", JSON.stringify(d.anterior)] : null,
            d.novo !== undefined ? ["Novo valor", JSON.stringify(d.novo)] : null];
    abrirPainel({
        titulo: `Evento ${e.id}`, descricao: `${AU.TIPOS_AUDITORIA[e.tipo]?.rotulo ?? e.tipo} · ${e.modulo}`, largo: true,
        conteudo: html`
            ${listaDefinicao([
                ["Identificador", e.id], ["Origem", e.origem === "acesso" ? "Evento de acesso (autenticação)" : "Operação administrativa"],
                ["Usuário responsável", e.usuario], ["Tipo de ação", AU.TIPOS_AUDITORIA[e.tipo]?.rotulo ?? e.tipo], ["Módulo de origem", e.modulo],
                ["Registro relacionado", e.link ? html`<a class="link-forte" href="${e.link}" data-valor="">${e.registro}</a>` : e.registro],
                ["Data e horário", `${dataHora(e.data)} (${tempoRelativo(e.data)})`], ["Descrição", e.descricao],
                ["Resultado", badgeStatus(AU.RESULTADOS_AUDITORIA, e.resultado)], ["Gravidade", badgeStatus(AU.GRAVIDADES_AUDITORIA, e.gravidade)],
                ...extras.filter(Boolean)
            ])}
            <p class="texto-terc texto-pequeno">Registro demonstrativo armazenado no navegador.</p>`
    });
}

// ---------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------
function secaoVisao({ secao }) {
    const lista = AU.eventos();
    const hoje = new Date();
    const dias = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 13 + i);
        const chave = d.toISOString().slice(0, 10);
        return { rotulo: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, rotuloLongo: d.toLocaleDateString("pt-BR"), chave, valor: 0 };
    });
    const indice = Object.fromEntries(dias.map((d) => [d.chave, d]));
    lista.forEach((e) => { const d = indice[new Date(e.data).toISOString().slice(0, 10)]; if (d) d.valor++; });
    const contar = (campo, rotulos) => {
        const m = new Map();
        lista.forEach((e) => m.set(e[campo], (m.get(e[campo]) ?? 0) + 1));
        return [...m.entries()].map(([k, v]) => ({ rotulo: rotulos ? rotulos[k]?.rotulo ?? k : k, valor: v })).sort((a, b) => b.valor - a.valor);
    };
    const criticos = lista.filter((e) => e.gravidade === "critica").slice(0, 8);
    renderizar(secao, html`
        ${avisoAuditoria()}
        <div class="grade grade--2 grade--2-igual secao">
            <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Eventos por dia</h2><span class="texto-terc">Últimos 14 dias</span></div>
                <div class="card__corpo">${graficoBarras({ dados: dias, formatar: (v) => `${numero(v)} eventos`, formatarEixo: numero, titulo: "Eventos por dia" })}</div></section>
            <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Eventos por tipo</h2></div>
                <div class="card__corpo">${barrasHorizontais({ itens: contar("tipo", AU.TIPOS_AUDITORIA).slice(0, 8), formatar: numero, titulo: "Por tipo" })}</div></section>
            <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Eventos por módulo</h2></div>
                <div class="card__corpo">${barrasHorizontais({ itens: contar("modulo").slice(0, 8), formatar: numero, titulo: "Por módulo" })}</div></section>
            <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Eventos críticos recentes</h2><a class="link-forte texto-pequeno" href="#/auditoria/eventos" data-ver-criticos>Ver todos</a></div>
                <div class="card__corpo">${criticos.length ? html`<ul class="lista">${criticos.map((e) => html`
                    <li class="lista__item">
                        <span class="lista__icone">${icone(AU.TIPOS_AUDITORIA[e.tipo]?.icone ?? "circle")}</span>
                        <div class="lista__conteudo"><button class="lista__titulo link-botao" type="button" data-evento="${e.id}">${e.descricao}</button>
                            <span class="lista__meta">${e.id} · ${e.modulo} · ${dataHora(e.data)}</span></div>
                    </li>`)}</ul>` : estadoVazio({ iconeNome: "shield-check", titulo: "Nenhum evento crítico" })}</div></section>
        </div>`);
    secao.addEventListener("click", (e) => {
        const b = e.target.closest("[data-evento]");
        if (b) verEvento(b.dataset.evento);
        if (e.target.closest("[data-ver-criticos]")) Object.assign(filtros, PADRAO, { gravidade: "critica", dias: "" });
    });
}

// ---------------------------------------------------------------------
// Tabelas de eventos (todos, acessos, operações)
// ---------------------------------------------------------------------
function secaoEventos({ secao }, origem) {
    const titulo = origem === "acesso" ? "Histórico de acessos" : origem === "operacao" ? "Histórico de operações" : "Todos os eventos";
    const tiposDaOrigem = Object.entries(AU.TIPOS_AUDITORIA).filter(([k]) => {
        const acesso = ["login", "logout", "login_recusado", "sessao_encerrada", "tentativa_suspeita", "alteracao_credenciais"].includes(k);
        return !origem || (origem === "acesso" ? acesso : !acesso);
    }).map(([k, v]) => [k, v.rotulo]);
    if (filtros.tipo && !tiposDaOrigem.some(([k]) => k === filtros.tipo)) filtros.tipo = "";
    renderizar(secao, html`
        ${avisoAuditoria()}
        <div class="barra-filtros barra-filtros--solta" role="search" aria-label="Filtros da auditoria">
            ${campoBusca({ id: "aBusca", valor: filtros.busca, placeholder: "Pesquisar identificador, usuário, descrição ou IP" })}
            ${campoSelect({ id: "aDias", rotulo: "Período", valor: filtros.dias, opcoes: PERIODOS })}
            ${campoSelect({ id: "aUsuario", rotulo: "Usuário", valor: filtros.usuario, opcoes: [["", "Todos os usuários"], ...AU.usuariosAuditoria().map((u) => [u, u])] })}
            ${origem === "acesso" ? "" : campoSelect({ id: "aModulo", rotulo: "Módulo", valor: filtros.modulo, opcoes: [["", "Todos os módulos"], ...AU.MODULOS_AUDITORIA.map((m) => [m, m])] })}
            ${campoSelect({ id: "aTipo", rotulo: "Tipo de evento", valor: filtros.tipo, opcoes: [["", "Todos os tipos"], ...tiposDaOrigem] })}
            ${campoSelect({ id: "aResultado", rotulo: "Resultado", valor: filtros.resultado, opcoes: [["", "Todos os resultados"], ...opcoesDe(AU.RESULTADOS_AUDITORIA)] })}
            ${campoSelect({ id: "aGravidade", rotulo: "Gravidade", valor: filtros.gravidade, opcoes: [["", "Todas as gravidades"], ...opcoesDe(AU.GRAVIDADES_AUDITORIA)] })}
            <button class="btn btn--fantasma" type="button" data-acao="limpar">${icone("filter-x")}<span>Limpar</span></button>
        </div>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">${titulo}</h2>
                <div class="acoes-linha"><span class="badge" data-contagem></span>
                <button class="btn btn--pequeno" type="button" data-acao="exportar">${icone("file-down")}<span>Exportar CSV</span></button></div></div>
            <div data-tabela></div>
        </section>`);

    const colunas = [
        { chave: "id", rotulo: "Identificador", render: (e) => html`<button class="link-botao link-forte num" type="button" data-evento="${e.id}">${e.id}</button>` },
        { chave: "usuario", rotulo: "Usuário", render: (e) => html`<span class="celula-limite">${e.usuario}</span>` },
        { chave: "tipo", rotulo: "Tipo de evento", valor: (e) => AU.TIPOS_AUDITORIA[e.tipo]?.rotulo, render: (e) => html`<span class="com-icone">${icone(AU.TIPOS_AUDITORIA[e.tipo]?.icone ?? "circle")}${AU.TIPOS_AUDITORIA[e.tipo]?.rotulo}</span>` },
        ...(origem === "acesso"
            ? [{ chave: "origemDemo", rotulo: "Origem demonstrativa", valor: (e) => e.detalhes.cidade, render: (e) => html`${e.detalhes.cidade ?? "—"}<span class="celula-sub">${e.detalhes.ip ?? ""} · ${e.detalhes.dispositivo ?? ""}</span>` }]
            : [{ chave: "modulo", rotulo: "Módulo", render: (e) => e.modulo }, { chave: "descricao", rotulo: "Descrição", ordenavel: false, render: (e) => html`<span class="celula-limite">${e.descricao}</span>` }]),
        { chave: "data", rotulo: "Data", render: (e) => data(e.data) },
        { chave: "hora", rotulo: "Horário", valor: (e) => e.data, render: (e) => new Date(e.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) },
        { chave: "resultado", rotulo: "Resultado", valor: (e) => AU.RESULTADOS_AUDITORIA[e.resultado]?.rotulo, render: (e) => badgeStatus(AU.RESULTADOS_AUDITORIA, e.resultado) },
        { chave: "gravidade", rotulo: "Gravidade", valor: (e) => AU.GRAVIDADES_AUDITORIA[e.gravidade]?.peso, render: (e) => badgeStatus(AU.GRAVIDADES_AUDITORIA, e.gravidade) },
        { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (e) => botaoIcone({ acao: "ver", id: e.id, nomeIcone: "eye", rotulo: `Ver detalhes do evento ${e.id}` }) }
    ];
    const tabela = criarTabela({ colunas, ordenacao: { chave: "data", direcao: "desc" }, vazio: "Nenhum evento com os filtros selecionados.", rotulo: titulo });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const lista = () => AU.filtrar({ ...filtros, origem, modulo: origem === "acesso" ? "" : filtros.modulo });
    const atualizar = () => {
        const l = lista();
        tabela.definirLinhas(l);
        secao.querySelector("[data-contagem]").textContent = `${numero(l.length)} eventos`;
    };
    atualizar();

    let espera;
    secao.querySelector("#aBusca").addEventListener("input", (e) => { clearTimeout(espera); espera = setTimeout(() => { filtros.busca = e.target.value; atualizar(); }, 150); });
    const mapa = { aDias: "dias", aUsuario: "usuario", aModulo: "modulo", aTipo: "tipo", aResultado: "resultado", aGravidade: "gravidade" };
    Object.entries(mapa).forEach(([id, campo]) => secao.querySelector(`#${id}`)?.addEventListener("change", (e) => { filtros[campo] = e.target.value; atualizar(); }));

    secao.addEventListener("click", (e) => {
        const ev = e.target.closest("[data-evento]");
        if (ev) return verEvento(ev.dataset.evento);
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        if (b.dataset.acao === "ver") verEvento(b.dataset.id);
        if (b.dataset.acao === "limpar") { Object.assign(filtros, PADRAO); secaoEventos({ secao }, origem); }
        if (b.dataset.acao === "exportar") {
            const l = lista();
            if (!l.length) return mostrarToast("Nada para exportar com os filtros atuais.", "atencao");
            const r = exportarRelatorio("csv", {
                arquivo: `barber-control-auditoria-${origem || "eventos"}`, titulo,
                colunas: [
                    { rotulo: "Identificador", valor: (x) => x.id }, { rotulo: "Origem", valor: (x) => (x.origem === "acesso" ? "Acesso" : "Operação") },
                    { rotulo: "Usuário", valor: (x) => x.usuario }, { rotulo: "Tipo de evento", valor: (x) => AU.TIPOS_AUDITORIA[x.tipo]?.rotulo },
                    { rotulo: "Módulo", valor: (x) => x.modulo }, { rotulo: "Registro relacionado", valor: (x) => x.registro },
                    { rotulo: "Data", valor: (x) => data(x.data) }, { rotulo: "Horário", valor: (x) => new Date(x.data).toLocaleTimeString("pt-BR") },
                    { rotulo: "Descrição", valor: (x) => x.descricao }, { rotulo: "Resultado", valor: (x) => AU.RESULTADOS_AUDITORIA[x.resultado]?.rotulo },
                    { rotulo: "Gravidade", valor: (x) => AU.GRAVIDADES_AUDITORIA[x.gravidade]?.rotulo },
                    { rotulo: "IP (fictício)", valor: (x) => x.detalhes?.ip ?? "" }, { rotulo: "Observação", valor: () => "REGISTRO DEMONSTRATIVO - NÃO INVIOLÁVEL" }
                ],
                linhas: l
            });
            mostrarToast(`${numero(l.length)} eventos exportados: ${r.nome}`, "sucesso");
        }
    });
}

// ---------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------
function secaoSessoes(ctx) {
    const { secao } = ctx;
    const duracao = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`);
    renderizar(secao, html`
        <div class="alerta alerta--info">${icone("monitor-smartphone")}<span>Sessões administrativas demonstrativas (as mesmas do módulo 10). Encerrar uma sessão aqui não afeta nenhum acesso real.</span></div>
        <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Sessões</h2></div><div data-tabela></div></section>`);
    const tabela = criarTabela({
        colunas: [
            { chave: "id", rotulo: "Sessão", render: (s) => html`<span class="num">${s.id}</span><span class="celula-sub">${s.usuario}</span>` },
            { chave: "inicio", rotulo: "Início", render: (s) => dataHora(s.inicio) },
            { chave: "ultimoAcesso", rotulo: "Último acesso", render: (s) => html`${dataHora(s.ultimoAcesso)}<span class="celula-sub">${tempoRelativo(s.ultimoAcesso)}</span>` },
            { chave: "origem", rotulo: "Origem", valor: (s) => s.origem?.cidade, render: (s) => html`${s.dispositivo}<span class="celula-sub">${s.origem?.cidade ?? "—"} · ${s.origem?.ip ?? ""}</span>` },
            { chave: "status", rotulo: "Status", valor: (s) => STATUS_SESSAO[s.status]?.rotulo, render: (s) => badgeStatus(STATUS_SESSAO, s.status) },
            { chave: "duracaoMin", rotulo: "Duração", classe: "col-num", render: (s) => duracao(s.duracaoMin) },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (s) => (s.status === "ativa" ? botaoIcone({ acao: "encerrar", id: s.id, nomeIcone: "power", rotulo: `Encerrar sessão ${s.id}`, perigo: true }) : "") }
        ],
        ordenacao: { chave: "inicio", direcao: "desc" }, vazio: "Nenhuma sessão registrada.", rotulo: "Sessões"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(AU.sessoes());
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao=encerrar]");
        if (!b) return;
        const ok = await confirmar({ titulo: "Encerrar sessão?", mensagem: "A sessão demonstrativa será marcada como encerrada e o evento ficará registrado na auditoria.", textoConfirmar: "Encerrar", perigo: true });
        if (!ok) return;
        try {
            AU.encerrarSessao(b.dataset.id);
            tabela.atualizarLinhas(AU.sessoes());
            ctx.atualizarIndicadores();
            mostrarToast("Sessão encerrada (demonstração).", "sucesso");
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

// ---------------------------------------------------------------------
// Retenção
// ---------------------------------------------------------------------
function secaoRetencao(ctx) {
    const { secao } = ctx;
    const r = AU.retencao();
    const previa = AU.previaArquivamento();
    const execucoes = AU.historicoArquivamento();
    const CATEGORIAS = [["acesso", "Acessos (login, logout, sessões)"], ["operacao", "Operações administrativas"], ["configuracao", "Alterações de configuração"], ["plano", "Planos e assinaturas"], ["funcionalidade", "Funcionalidades e flags"]];
    renderizar(secao, html`
        <div class="alerta alerta--info">${icone("archive")}<span>Estas configurações são as mesmas de <a class="link-forte" href="#/configuracoes/seguranca">Configurações › Segurança</a> (fonte única). Na demonstração, nenhum registro é excluído: o arquivamento apenas calcula e registra quantos registros passaram do prazo.</span></div>
        <div class="grade grade--2 secao">
            <form class="card" data-form novalidate>
                <div class="card__cabecalho"><h2 class="card__titulo">Política de retenção</h2></div>
                <div class="card__corpo formulario__grade">
                    <div class="campo campo--meia" data-campo="acessosDias"><label for="rAcessos"><span class="campo__rotulo">Prazo dos eventos de acesso (dias)</span></label>
                        <input class="entrada" id="rAcessos" name="acessosDias" type="number" min="30" max="1825" value="${r.acessosDias}"><span class="campo__erro" data-erro-para="retencaoAcessosDias"></span></div>
                    <div class="campo campo--meia" data-campo="operacoesDias"><label for="rOperacoes"><span class="campo__rotulo">Prazo das operações (dias)</span></label>
                        <input class="entrada" id="rOperacoes" name="operacoesDias" type="number" min="90" max="3650" value="${r.operacoesDias}"><span class="campo__erro" data-erro-para="retencaoOperacoesDias"></span></div>
                    <fieldset class="campo campo--inteira campo--grupo"><legend class="campo__rotulo">Categorias de eventos registradas</legend>
                        <div class="opcoes-marcar">${CATEGORIAS.map(([v, rot]) => html`<label class="marcar"><input type="checkbox" name="categorias" value="${v}" ${r.categorias.includes(v) ? bruto("checked") : ""}><span>${rot}</span></label>`)}</div>
                        <span class="campo__erro" data-erro-para="categoriasAuditadas"></span></fieldset>
                    <div class="campo campo--inteira"><label for="rPolitica"><span class="campo__rotulo">Política de preservação</span></label>
                        <select class="entrada" id="rPolitica" name="politica">
                            <option value="arquivar" ${r.politica === "arquivar" ? bruto("selected") : ""}>Arquivar após o prazo (não excluir)</option>
                            <option value="anonimizar" ${r.politica === "anonimizar" ? bruto("selected") : ""}>Anonimizar dados pessoais após o prazo</option>
                        </select></div>
                </div>
                <div class="config-form__acoes"><span class="config-form__espaco"></span><button class="btn btn--primario" type="submit">${icone("save")}<span>Salvar política</span></button></div>
            </form>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Prévia do arquivamento</h2></div>
                <div class="card__corpo">
                    ${listaDefinicao([["Eventos de acesso além do prazo", numero(previa.acessos)], ["Operações além do prazo", numero(previa.operacoes)], ["Política", previa.politica === "arquivar" ? "Arquivar (não excluir)" : "Anonimizar"]])}
                    <button class="btn" type="button" data-acao="arquivar">${icone("archive")}<span>Simular arquivamento</span></button>
                </div>
            </section>
        </div>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Histórico de arquivamento</h2></div>
            <div class="card__corpo">${execucoes.length ? html`<ul class="lista">${execucoes.map((x) => html`
                <li class="lista__item"><span class="lista__icone">${icone("archive")}</span>
                    <div class="lista__conteudo"><span class="lista__titulo">${numero(x.acessos)} acessos e ${numero(x.operacoes)} operações além do prazo (${x.prazoAcessos} / ${x.prazoOperacoes} dias)</span>
                    <span class="lista__meta">${dataHora(x.data)} · ${x.responsavel} · simulação, nada excluído</span></div></li>`)}</ul>`
                : estadoVazio({ iconeNome: "archive", titulo: "Nenhum arquivamento executado", texto: "Use “Simular arquivamento” para registrar uma execução." })}</div>
        </section>`);

    const form = secao.querySelector("[data-form]");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        form.querySelectorAll("[data-erro-para]").forEach((x) => { x.textContent = ""; });
        const valores = {
            acessosDias: form.elements.acessosDias.value === "" ? null : Number(form.elements.acessosDias.value),
            operacoesDias: form.elements.operacoesDias.value === "" ? null : Number(form.elements.operacoesDias.value),
            categorias: [...form.querySelectorAll("input[name=categorias]:checked")].map((i) => i.value),
            politica: form.elements.politica.value
        };
        const ok = await confirmar({ titulo: "Salvar a política de retenção?", mensagem: "A alteração será registrada no histórico de configurações e na auditoria.", textoConfirmar: "Salvar" });
        if (!ok) return;
        try {
            const salvas = AU.salvarRetencao(valores);
            mostrarToast(salvas.length ? `${salvas.length} ${salvas.length === 1 ? "configuração atualizada" : "configurações atualizadas"}.` : "Nenhuma alteração para salvar.", salvas.length ? "sucesso" : "info");
            ctx.atualizarIndicadores();
            secaoRetencao(ctx);
        } catch (falha) {
            const alvo = falha.campo && form.querySelector(`[data-erro-para="${falha.campo}"]`);
            if (alvo) alvo.textContent = falha.message;
            mostrarToast(falha.message, "erro");
        }
    });
    secao.addEventListener("click", async (e) => {
        if (!e.target.closest("[data-acao=arquivar]")) return;
        const ok = await confirmar({ titulo: "Simular arquivamento?", mensagem: `Serão contabilizados ${previa.acessos} eventos de acesso e ${previa.operacoes} operações além do prazo. Nenhum registro será excluído.`, textoConfirmar: "Simular" });
        if (!ok) return;
        AU.simularArquivamento();
        mostrarToast("Arquivamento simulado e registrado.", "sucesso");
        ctx.atualizarIndicadores();
        secaoRetencao(ctx);
    });
}

const RENDER = {
    "": secaoVisao, eventos: (c) => secaoEventos(c, ""), acessos: (c) => secaoEventos(c, "acesso"),
    operacoes: (c) => secaoEventos(c, "operacao"), sessoes: secaoSessoes, retencao: secaoRetencao
};

export function render(view, { parametros = [] }) {
    const ativa = SECOES.some(([r]) => r === parametros[0]) ? parametros[0] : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Auditoria e acessos", subtitulo: "Acessos, operações administrativas, sessões e retenção dos registros", base: "#/auditoria",
        secoes: SECOES, ativa, kpis, recarregar
    });
    RENDER[ativa](ctx);
}
