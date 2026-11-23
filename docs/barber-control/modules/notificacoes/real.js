// =====================================================================
// MÓDULO 08 — NOTIFICAÇÕES / COMUNICADOS (MODO REAL)
// Rota: #/notificacoes
// Comunicados publicados aqui aparecem no topo do painel das barbearias
// escolhidas (todas ou algumas), até o dono marcar “Entendi” ou até a
// data de expiração. Nada é enviado por e-mail ou WhatsApp.
// Fonte: control_api (administrador + MFA, validados no servidor).
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { CATEGORIAS_COMUNICADO, PRIORIDADES_COMUNICADO } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, botaoIcone, campoBusca, campoSelect, novaRaiz } from "../../js/components/ui.js";

const SITUACAO = {
    no_ar: { rotulo: "No ar", tom: "sucesso" },
    agendado: { rotulo: "Agendado", tom: "atencao" },
    rascunho: { rotulo: "Rascunho", tom: "neutro" },
    expirado: { rotulo: "Expirado", tom: "neutro" },
    arquivado: { rotulo: "Arquivado", tom: "neutro" }
};
const filtros = { busca: "", situacao: "" };
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const paraData = (iso) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : "");
// Datas do formulário no horário de Brasília: início do dia para publicar, fim do dia para expirar.
const inicioDia = (d) => (d ? `${d}T00:00:00-03:00` : null);
const fimDia = (d) => (d ? `${d}T23:59:59-03:00` : null);

function traduzir(erro) {
    const t = `${erro.message} ${erro.original?.message ?? ""}`;
    const mapa = {
        sem_destinatarios: ["Escolha pelo menos uma barbearia.", "barbearias"],
        expiracao_invalida: ["A expiração precisa ser depois da publicação.", "expira_em"],
        titulo_obrigatorio: ["Informe um título com pelo menos 3 letras.", "titulo"],
        mensagem_obrigatoria: ["Escreva a mensagem.", "mensagem"]
    };
    const chave = Object.keys(mapa).find((k) => t.includes(k));
    return chave ? Object.assign(new Error(mapa[chave][0]), { campo: mapa[chave][1] }) : erro;
}

async function editar(atual, barbearias) {
    return abrirFormulario({
        titulo: atual ? "Editar comunicado" : "Novo comunicado",
        descricao: "Aparece no topo do painel das barbearias escolhidas até o dono clicar em “Entendi” ou até a data de expiração.",
        campos: [
            { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, maxlength: 120 },
            { nome: "mensagem", rotulo: "Mensagem", tipo: "textarea", obrigatorio: true, maxlength: 2000 },
            { nome: "categoria", rotulo: "Categoria", tipo: "select", largura: "meia", opcoes: Object.entries(CATEGORIAS_COMUNICADO) },
            { nome: "prioridade", rotulo: "Prioridade", tipo: "select", largura: "meia", opcoes: Object.entries(PRIORIDADES_COMUNICADO).map(([k, v]) => [k, v.rotulo]), ajuda: "Alta aparece em destaque." },
            { nome: "destino", rotulo: "Para quem", tipo: "select", largura: "meia", opcoes: [["todas", "Todas as barbearias"], ["selecionadas", "Só as barbearias escolhidas"]] },
            { nome: "status", rotulo: "Situação", tipo: "select", largura: "meia", opcoes: [["publicado", "Publicar"], ["rascunho", "Rascunho (não aparece)"], ["arquivado", "Arquivado (sai do ar)"]] },
            { nome: "barbearias", rotulo: "Barbearias (se “só as escolhidas”)", tipo: "checkboxes", opcoes: barbearias.map((b) => [b.id, b.nome]),
                validarVazio: true, validar: (v, valores) => (valores.destino === "selecionadas" && !v.length ? "Escolha pelo menos uma barbearia." : null) },
            { nome: "publicar_em", rotulo: "Publicar a partir de", tipo: "data", largura: "meia", ajuda: "Em branco: agora." },
            { nome: "expira_em", rotulo: "Sair do ar depois de", tipo: "data", largura: "meia", ajuda: "Em branco: não expira." }
        ],
        valores: atual
            ? { ...atual, barbearias: atual.barbearias ?? [], publicar_em: paraData(atual.publicar_em), expira_em: paraData(atual.expira_em) }
            : { categoria: "geral", prioridade: "normal", destino: "todas", status: "publicado", barbearias: [] },
        textoSalvar: atual ? "Salvar" : "Salvar comunicado",
        aoSalvar: async (v) => {
            try {
                return await rpc("salvar_comunicado", {
                    p_id: atual?.id ?? null,
                    p_dados: { ...v, barbearias: v.destino === "selecionadas" ? v.barbearias : [], publicar_em: inicioDia(v.publicar_em), expira_em: fimDia(v.expira_em) }
                });
            } catch (erro) { throw traduzir(erro); }
        }
    });
}

async function renderLista(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Notificações", subtitulo: "Carregando do Supabase…" })}`);
    let lista, barbearias;
    try {
        [lista, barbearias] = await Promise.all([rpc("listar_comunicados"), rpc("listar_barbearias")]);
    } catch (erro) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Notificações", subtitulo: "Painel Master" })}
            <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar os comunicados", texto: erro.message })}</section>`);
        return;
    }
    const ativas = barbearias.filter((b) => b.status !== "cancelada");
    const nomes = new Map(barbearias.map((b) => [b.id, b.nome]));
    const cont = (s) => lista.filter((c) => c.situacao === s).length;
    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Notificações", subtitulo: "Comunicados no painel das barbearias · dados reais",
            acoes: html`<button class="btn btn--primario" type="button" data-acao="novo">${icone("plus")}<span>Novo comunicado</span></button>`
        })}
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "No ar", valor: numero(cont("no_ar")), iconeNome: "megaphone", nota: "Aparecendo nos painéis", destaque: true })}
            ${kpi({ rotulo: "Agendados", valor: numero(cont("agendado")), iconeNome: "calendar-clock", nota: "Entram no ar na data marcada" })}
            ${kpi({ rotulo: "Rascunhos", valor: numero(cont("rascunho")), iconeNome: "file-pen", nota: "Ainda não publicados" })}
            ${kpi({ rotulo: "Barbearias alcançáveis", valor: numero(ativas.length), iconeNome: "store", nota: "Não canceladas" })}
        </section>
        <div class="barra-filtros barra-filtros--solta">
            ${campoBusca({ id: "nBusca", valor: filtros.busca, placeholder: "Pesquisar título ou mensagem" })}
            ${campoSelect({ id: "nSituacao", rotulo: "Situação", valor: filtros.situacao, opcoes: [["", "Todas as situações"], ...Object.entries(SITUACAO).map(([k, v]) => [k, v.rotulo])] })}
        </div>
        <section class="card"><div data-tabela></div></section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "titulo", rotulo: "Comunicado", render: (c) => html`<strong>${c.titulo}</strong>${c.prioridade === "alta" ? html` <span class="badge badge--erro">Alta</span>` : ""}<span class="celula-sub">${String(c.mensagem).slice(0, 110)}${c.mensagem.length > 110 ? "…" : ""}</span>` },
            { chave: "categoria", rotulo: "Categoria", valor: (c) => CATEGORIAS_COMUNICADO[c.categoria], render: (c) => CATEGORIAS_COMUNICADO[c.categoria] ?? c.categoria },
            { chave: "destino", rotulo: "Para", valor: (c) => (c.destino === "todas" ? "Todas" : c.barbearias.length), render: (c) => (c.destino === "todas" ? "Todas" : html`<span title="${c.barbearias.map((id) => nomes.get(id) ?? "?").join(", ")}">${numero(c.barbearias.length)} barbearia(s)</span>`) },
            { chave: "situacao", rotulo: "Situação", valor: (c) => SITUACAO[c.situacao]?.rotulo, render: (c) => html`${badgeStatus(SITUACAO, c.situacao)}${c.situacao === "agendado" ? html`<span class="celula-sub">${dataHora(c.publicar_em)}</span>` : c.expira_em && c.situacao === "no_ar" ? html`<span class="celula-sub">até ${dataHora(c.expira_em)}</span>` : ""}` },
            { chave: "leituras", rotulo: "Lido por", classe: "col-num", valor: (c) => Number(c.leituras), render: (c) => (c.situacao === "rascunho" ? "—" : `${numero(c.leituras)} de ${numero(c.alcance)}`) },
            { chave: "atualizado_em", rotulo: "Atualizado", render: (c) => html`<span title="${dataHora(c.atualizado_em)}">${tempoRelativo(c.atualizado_em)}</span>` },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (c) => html`
                ${botaoIcone({ acao: "editar", id: c.id, nomeIcone: "pencil", rotulo: `Editar ${c.titulo}` })}
                ${c.status === "publicado" ? botaoIcone({ acao: "arquivar", id: c.id, nomeIcone: "archive", rotulo: `Tirar do ar: ${c.titulo}` }) : ""}` }
        ],
        ordenacao: { chave: "atualizado_em", direcao: "desc" }, vazio: "Nenhum comunicado ainda. Use “Novo comunicado”.", rotulo: "Comunicados"
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => lista.filter((c) =>
        (!filtros.situacao || c.situacao === filtros.situacao) &&
        (!filtros.busca || normalizar(`${c.titulo} ${c.mensagem}`).includes(normalizar(filtros.busca))));
    tabela.definirLinhas(filtrar());
    raiz.querySelector("#nBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("#nSituacao").addEventListener("change", (e) => { filtros.situacao = e.target.value; tabela.definirLinhas(filtrar()); });

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const c = lista.find((x) => x.id === botao.dataset.id);
        try {
            if (botao.dataset.acao === "novo" && await editar(null, ativas)) { mostrarToast("Comunicado salvo.", "sucesso"); renderLista(view); }
            if (botao.dataset.acao === "editar" && await editar(c, ativas)) { mostrarToast("Comunicado atualizado.", "sucesso"); renderLista(view); }
            if (botao.dataset.acao === "arquivar") {
                await rpc("salvar_comunicado", { p_id: c.id, p_dados: { ...c, status: "arquivado" } });
                mostrarToast("Comunicado tirado do ar.", "sucesso");
                renderLista(view);
            }
        } catch (erro) {
            mostrarToast(erro.message, "erro");
        }
    });
}

export function render(view) {
    renderLista(view);
}
