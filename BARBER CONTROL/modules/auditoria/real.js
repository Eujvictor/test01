// =====================================================================
// MÓDULO 20 — AUDITORIA E ACESSOS (MODO REAL)
// Rotas: #/auditoria          → eventos registrados (control.auditoria)
//        #/auditoria/acessos  → tentativas de login no Barber Control
// A trilha fica no banco, em tabela somente de inserção (um gatilho
// impede alterar ou apagar registros). Leitura exclusiva do Master com
// verificação em duas etapas, validada no servidor.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { html, icone, renderizar, bruto } from "../../js/utilities/dom.js";
import { numero, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { baixarCsv } from "../../js/utilities/csv.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirPainel } from "../../js/components/painel.js";
import { graficoBarras, barrasHorizontais } from "../../js/components/grafico.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, listaDefinicao, botaoIcone, campoBusca, campoSelect, novaRaiz } from "../../js/components/ui.js";
import { rotuloAcao, resumoDetalhes } from "../compartilhado/rotulos-auditoria.js";

const SECOES = [["", "Eventos"], ["acessos", "Tentativas de login"]];
const PERIODOS = [["1", "Hoje"],["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["365", "Últimos 12 meses"]];
const LOTE = 200;
const filtros = { dias: "30", acao: "", busca: "", resultado: "" };
const RESULTADO = { sucesso: { rotulo: "Sucesso", tom: "sucesso" }, falha: { rotulo: "Falha", tom: "erro" } };

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const diaCurto = (s) => (s ? String(s).slice(5, 10).split("-").reverse().join("/") : "");
const eixoInteiro = (v) => (Number.isInteger(v) ? numero(v) : "");
const diaLongo =(s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");

function moldura(view, ativa, resumo) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Auditoria e acessos",
            subtitulo: "Trilha gravada no banco · somente inserção, não pode ser alterada nem apagada",
            acoes: html`
                <button class="btn" type="button" data-acao="exportar">${icone("download")}<span>Exportar CSV</span></button>
                <button class="btn" type="button" data-acao="atualizar">${icone("refresh-cw")}<span class="btn__texto-opcional">Atualizar</span></button>`
        })}
        <div class="barra-filtros barra-filtros--solta">
            ${campoSelect({ id: "auPeriodo", rotulo: "Período", valor: filtros.dias, opcoes: PERIODOS })}
        </div>
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Eventos registrados", valor: numero(resumo.eventos), iconeNome: "scroll-text", nota: "No período", destaque: true })}
            ${kpi({ rotulo: "Pessoas que agiram", valor: numero(resumo.atores), iconeNome: "user-round", nota: "Contas distintas" })}
            ${kpi({ rotulo: "Logins com sucesso", valor: numero(resumo.logins_sucesso), iconeNome: "log-in", nota: "Barber Control" })}
            ${kpi({ rotulo: "Logins com falha", valor: numero(resumo.logins_falha), iconeNome: "shield-alert", nota: Number(resumo.ips_falha) ? `${numero(resumo.ips_falha)} IP(s) diferentes` : "Nenhuma falha" })}
        </section>
        <nav class="abas abas--navegacao" aria-label="Seções da auditoria">
            ${SECOES.map(([rota, rotulo]) => html`
                <a class="abas__aba" href="#/auditoria${rota ? `/${rota}` : ""}" ${rota === ativa ? bruto('aria-current="page"') : ""}>${rotulo}</a>`)}
        </nav>
        <div data-secao></div>`);
    return { raiz, secao: raiz.querySelector("[data-secao]") };
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------
function detalhesEvento(ev) {
    const r = rotuloAcao(ev.acao);
    const extras = Object.entries(ev.detalhes ?? {}).filter(([, v]) => v !== null && v !== "");
    abrirPainel({
        titulo: r.texto,
        descricao: `${dataHora(ev.ocorrido_em)} · registro nº ${ev.id}`,
        conteudo: html`
            ${listaDefinicao([
                ["Quem", ev.ator_email ?? "sistema"],
                ["Ação (código)", ev.acao],
                ["Alvo", ev.entidade ? `${ev.entidade}${ev.entidade_id ? ` · ${ev.entidade_id}` : ""}` : "—"],
                ["IP", ev.ip ?? "—"],
                ["Navegador", ev.user_agent ?? "—"],
                ...extras.map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)])
            ])}`
    });
}

async function secaoEventos(view, resumo) {
    const { raiz, secao } = moldura(view, "", resumo);
    const acoes = (resumo.acoes ?? []).map((a) => [a, rotuloAcao(a).texto]);
    const porDia = (resumo.por_dia ?? []).map((d) => ({ rotulo: diaCurto(d.dia), rotuloLongo: diaLongo(d.dia), valor: Number(d.total) }));
    const formatarEv = (v) => `${numero(v)} evento${Number(v) === 1 ? "" : "s"}`;
    let eventos = [];
    let fim = false;

    renderizar(secao, html`
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Eventos por dia</h2></div>
                <div class="card__corpo">${Number(resumo.eventos) ? graficoBarras({ dados: porDia, formatar: formatarEv, formatarEixo: eixoInteiro, titulo: "Eventos por dia" })
                    : estadoVazio({ iconeNome: "scroll-text", titulo: "Nenhum evento no período" })}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Ações mais frequentes</h2></div>
                <div class="card__corpo">${resumo.por_acao?.length
                    ? barrasHorizontais({ itens: resumo.por_acao.slice(0, 8).map((a) => ({ rotulo: rotuloAcao(a.acao).texto, valor: Number(a.total) })), formatar: formatarEv, titulo: "Ações mais frequentes" })
                    : estadoVazio({ iconeNome: "list", titulo: "Nenhuma ação no período" })}</div>
            </section>
        </div>
        <section class="card">
            <div class="barra-filtros">
                ${campoBusca({ id: "auBusca", valor: filtros.busca, placeholder: "Pesquisar e-mail, ação, barbearia, motivo ou IP" })}
                ${campoSelect({ id: "auAcao", rotulo: "Ação", valor: filtros.acao, opcoes: [["", "Todas as ações"], ...acoes] })}
            </div>
            <div data-tabela></div>
            <div class="acoes-linha" data-mais hidden><button class="btn btn--pequeno" type="button" data-acao="mais">${icone("chevrons-down")}<span>Carregar mais antigos</span></button></div>
        </section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "ocorrido_em", rotulo: "Quando", valor: (e) => e.id, render: (e) => html`<span title="${dataHora(e.ocorrido_em)}">${dataHora(e.ocorrido_em)}</span><span class="celula-sub">${tempoRelativo(e.ocorrido_em)}</span>` },
            { chave: "acao", rotulo: "Ação", valor: (e) => rotuloAcao(e.acao).texto, render: (e) => html`<span class="celula-icone">${icone(rotuloAcao(e.acao).icone)}${rotuloAcao(e.acao).texto}</span>${resumoDetalhes(e) ? html`<span class="celula-sub">${resumoDetalhes(e)}</span>` : ""}` },
            { chave: "ator_email", rotulo: "Quem", render: (e) => e.ator_email ?? "sistema" },
            { chave: "ip", rotulo: "IP", render: (e) => e.ip ?? "—" },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (e) => botaoIcone({ acao: "ver", id: String(e.id), nomeIcone: "eye", rotulo: "Ver detalhes do evento" }) }
        ],
        ordenacao: { chave: "ocorrido_em", direcao: "desc" }, vazio: "Nenhum evento com os filtros atuais.", rotulo: "Eventos"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);

    async function carregar(reiniciar) {
        if (reiniciar) { eventos = []; fim = false; }
        try {
            const lote = await rpc("buscar_auditoria", {
                p_desde: resumo.desde, p_ate: null, p_acao: filtros.acao || null, p_busca: filtros.busca || null,
                p_limite: LOTE, p_antes: eventos.length ? eventos.at(-1).id : null
            });
            eventos = eventos.concat(lote);
            fim = lote.length < LOTE;
            tabela.definirLinhas(eventos);
            secao.querySelector("[data-mais]").hidden = fim;
        } catch (erro) {
            mostrarToast(erro.message, "erro");
        }
    }
    await carregar(true);

    let espera;
    secao.querySelector("#auBusca").addEventListener("input", (e) => {
        filtros.busca = e.target.value;
        clearTimeout(espera);
        espera = setTimeout(() => carregar(true), 350);
    });
    secao.querySelector("#auAcao").addEventListener("change", (e) => { filtros.acao = e.target.value; carregar(true); });
    raiz.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        if (botao.dataset.acao === "mais") carregar(false);
        if (botao.dataset.acao === "ver") detalhesEvento(eventos.find((x) => String(x.id) === botao.dataset.id));
        if (botao.dataset.acao === "exportar") {
            if (!eventos.length) return mostrarToast("Nada para exportar com os filtros atuais.", "atencao");
            baixarCsv(`auditoria-${isoLocal(new Date())}.csv`, [
                { rotulo: "Registro", valor: (x) => x.id },
                { rotulo: "Quando", valor: (x) => dataHora(x.ocorrido_em) },
                { rotulo: "Ação", valor: (x) => rotuloAcao(x.acao).texto },
                { rotulo: "Código da ação", valor: (x) => x.acao },
                { rotulo: "Resumo", valor: (x) => resumoDetalhes(x) },
                { rotulo: "Quem", valor: (x) => x.ator_email ?? "sistema" },
                { rotulo: "Alvo", valor: (x) => `${x.entidade ?? ""} ${x.entidade_id ?? ""}`.trim() },
                { rotulo: "IP", valor: (x) => x.ip ?? "" },
                { rotulo: "Detalhes", valor: (x) => JSON.stringify(x.detalhes ?? {}) }
            ], eventos);
            mostrarToast(eventos.length === 1 ? "CSV gerado com 1 evento." : `CSV gerado com ${numero(eventos.length)} eventos carregados.`, "sucesso");
        }
    });
}

// ---------------------------------------------------------------------
// Tentativas de login
// ---------------------------------------------------------------------
async function secaoAcessos(view, resumo) {
    const { raiz, secao } = moldura(view, "acessos", resumo);
    let lista = [];
    try {
        lista = await rpc("listar_tentativas_login", { p_dias: Number(filtros.dias), p_limite: 1000 });
    } catch (erro) {
        renderizar(secao, html`<section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar as tentativas", texto: erro.message })}</section>`);
        return;
    }
    const falhasPorIp = new Map();
    lista.filter((t) => !t.sucesso).forEach((t) => falhasPorIp.set(t.ip ?? "desconhecido", (falhasPorIp.get(t.ip ?? "desconhecido") ?? 0) + 1));
    const suspeitos = [...falhasPorIp.entries()].filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]);

    renderizar(secao, html`
        ${suspeitos.length ? html`<div class="alerta alerta--atencao secao" role="note">${icone("shield-alert")}<span><strong>Atenção:</strong> ${suspeitos.map(([ip, n]) => `${ip} (${n} falhas)`).join(", ")}. Cinco falhas seguidas bloqueiam novas tentativas por 15 minutos.</span></div>` : ""}
        <section class="card">
            <div class="barra-filtros">
                ${campoBusca({ id: "tBusca", valor: "", placeholder: "Pesquisar e-mail ou IP" })}
                ${campoSelect({ id: "tResultado", rotulo: "Resultado", valor: filtros.resultado, opcoes: [["", "Todos os resultados"], ["sucesso", "Sucesso"], ["falha", "Falha"]] })}
            </div>
            <div data-tabela></div>
            <p class="texto-terc texto-pequeno">Tentativas de entrar no Barber Control (painel Master). O login dos donos de barbearia é feito pelo Supabase e não passa por aqui.</p>
        </section>`);

    let busca = "";
    const tabela = criarTabela({
        colunas: [
            { chave: "ocorrido_em", rotulo: "Quando", valor: (t) => t.id, render: (t) => html`${dataHora(t.ocorrido_em)}<span class="celula-sub">${tempoRelativo(t.ocorrido_em)}</span>` },
            { chave: "email", rotulo: "E-mail digitado" },
            { chave: "sucesso", rotulo: "Resultado", valor: (t) => (t.sucesso ? 1 : 0), render: (t) => badgeStatus(RESULTADO, t.sucesso ? "sucesso" : "falha") },
            { chave: "ip", rotulo: "IP", render: (t) => t.ip ?? "—" },
            { chave: "user_agent", rotulo: "Navegador", render: (t) => html`<span class="celula-sub" title="${t.user_agent ?? ""}">${String(t.user_agent ?? "—").slice(0, 60)}</span>` }
        ],
        ordenacao: { chave: "ocorrido_em", direcao: "desc" }, vazio: "Nenhuma tentativa no período.", rotulo: "Tentativas de login"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => lista.filter((t) =>
        (!filtros.resultado || (filtros.resultado === "sucesso") === t.sucesso) &&
        (!busca || `${t.email} ${t.ip ?? ""}`.toLowerCase().includes(busca.toLowerCase())));
    tabela.definirLinhas(filtrar());
    secao.querySelector("#tBusca").addEventListener("input", (e) => { busca = e.target.value; tabela.definirLinhas(filtrar()); });
    secao.querySelector("#tResultado").addEventListener("change", (e) => { filtros.resultado = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.addEventListener("click", (e) => {
        if (!e.target.closest("[data-acao=exportar]")) return;
        const linhas = filtrar();
        if (!linhas.length) return mostrarToast("Nada para exportar com os filtros atuais.", "atencao");
        baixarCsv(`tentativas-login-${isoLocal(new Date())}.csv`, [
            { rotulo: "Quando", valor: (t) => dataHora(t.ocorrido_em) },
            { rotulo: "E-mail digitado", valor: (t) => t.email },
            { rotulo: "Resultado", valor: (t) => (t.sucesso ? "Sucesso" : "Falha") },
            { rotulo: "IP", valor: (t) => t.ip ?? "" },
            { rotulo: "Navegador", valor: (t) => t.user_agent ?? "" }
        ], linhas);
        mostrarToast("Planilha CSV gerada.", "sucesso");
    });
}

export async function render(view, { parametros = [] }) {
    const ativa = parametros[0] === "acessos" ? "acessos" : "";
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Auditoria e acessos", subtitulo: "Carregando do Supabase…" })}`);
    let resumo;
    try {
        resumo = await rpc("auditoria_resumo", { p_dias: Number(filtros.dias) });
    } catch (erro) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Auditoria e acessos", subtitulo: "Painel Master" })}
            <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar a auditoria", texto: erro.message })}</section>`);
        return;
    }
    if (ativa === "acessos") await secaoAcessos(view, resumo);
    else await secaoEventos(view, resumo);

    // Período e atualizar valem para as duas seções.
    const raizAtual = view.firstElementChild;
    raizAtual.querySelector("#auPeriodo").addEventListener("change", (e) => { filtros.dias = e.target.value; render(view, { parametros }); });
    raizAtual.addEventListener("click", (e) => {
        if (e.target.closest("[data-acao=atualizar]")) render(view, { parametros });
    });
}
