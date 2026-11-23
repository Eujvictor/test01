// =====================================================================
// Cadastro real dos registros do produto (migração 12), compartilhado por:
//   13 Atualizações (versao) · 14 Funcionalidades (funcionalidade) ·
//   15 Histórico (mudanca) · 16 Roadmap (ideia)
// Só o Master (administrador + MFA) lê e altera; tudo fica na auditoria.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, tempoRelativo, dataHora } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { baixarCsv } from "../../js/utilities/csv.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, botaoIcone, campoBusca, campoSelect, novaRaiz } from "../../js/components/ui.js";

export const PRIORIDADES_PRODUTO = {
    baixa: { rotulo: "Baixa", tom: "neutro" }, media: { rotulo: "Média", tom: "ouro" },
    alta: { rotulo: "Alta", tom: "atencao" }, critica: { rotulo: "Crítica", tom: "erro" }
};
const PESO = { baixa: 0, media: 1, alta: 2, critica: 3 };
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dia = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * cfg: { tipo, titulo, subtitulo, singular, novo, status:{k:{rotulo,tom}}, statusPadrao,
 *        categorias?:{k:rotulo}, campos:[ "versao"|"data"|"prioridade"|"barbearia"|"categoria" ],
 *        rotuloData?, kpis(lista) → [[rotulo, valor, icone, nota]], extra?(raiz) async, vazio }
 */
export async function renderProduto(view, cfg) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: cfg.titulo, subtitulo: "Carregando do Supabase…" })}`);
    let lista, barbearias = [];
    try {
        [lista, barbearias] = await Promise.all([
            rpc("listar_produto", { p_tipo: cfg.tipo }),
            cfg.campos.includes("barbearia") ? rpc("listar_barbearias") : Promise.resolve([])
        ]);
    } catch (erro) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: cfg.titulo, subtitulo: "Painel Master" })}
            <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar", texto: erro.message })}</section>`);
        return;
    }
    const filtros = { busca: "", status: "" };
    const usa = (c) => cfg.campos.includes(c);

    renderizar(raiz, html`
        ${cabecalho({
            titulo: cfg.titulo, subtitulo: cfg.subtitulo,
            acoes: html`
                <button class="btn" type="button" data-acao="exportar">${icone("download")}<span>Exportar CSV</span></button>
                <button class="btn btn--primario" type="button" data-acao="novo">${icone("plus")}<span>${cfg.novo}</span></button>`
        })}
        <section class="grade grade--kpi secao">
            ${cfg.kpis(lista).map(([rotulo, valor, ic, nota], i) => kpi({ rotulo, valor: numero(valor), iconeNome: ic, nota, destaque: i === 0 }))}
        </section>
        <div data-extra></div>
        <div class="barra-filtros barra-filtros--solta">
            ${campoBusca({ id: "pBusca", valor: "", placeholder: "Pesquisar título, descrição ou versão" })}
            ${campoSelect({ id: "pStatus", rotulo: "Situação", valor: "", opcoes: [["", "Todas as situações"], ...Object.entries(cfg.status).map(([k, v]) => [k, v.rotulo])] })}
        </div>
        <section class="card"><div data-tabela></div></section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "titulo", rotulo: cfg.singular, render: (r) => html`<strong>${r.titulo}</strong>${r.descricao ? html`<span class="celula-sub">${String(r.descricao).slice(0, 120)}${r.descricao.length > 120 ? "…" : ""}</span>` : ""}` },
            ...(usa("versao") ? [{ chave: "versao", rotulo: "Versão", render: (r) => r.versao ?? "—" }] : []),
            ...(usa("categoria") ? [{ chave: "categoria", rotulo: "Categoria", valor: (r) => cfg.categorias[r.categoria] ?? "", render: (r) => cfg.categorias[r.categoria] ?? "—" }] : []),
            ...(usa("prioridade") ? [{ chave: "prioridade", rotulo: "Prioridade", valor: (r) => PESO[r.prioridade] ?? -1, render: (r) => (r.prioridade ? badgeStatus(PRIORIDADES_PRODUTO, r.prioridade) : "—") }] : []),
            ...(usa("barbearia") ? [{ chave: "barbearia", rotulo: "Pedido por", render: (r) => (r.barbearia_id ? html`<a href="#/barbearias/${r.barbearia_id}">${r.barbearia}</a>` : "Interno") }] : []),
            { chave: "status", rotulo: "Situação", valor: (r) => cfg.status[r.status]?.rotulo, render: (r) => badgeStatus(cfg.status, r.status) },
            ...(usa("data") ? [{ chave: "data", rotulo: cfg.rotuloData ?? "Data", valor: (r) => r.data ?? "", render: (r) => dia(r.data) }] : []),
            { chave: "atualizado_em", rotulo: "Atualizado", render: (r) => html`<span title="${dataHora(r.atualizado_em)}">${tempoRelativo(r.atualizado_em)}</span>` },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (r) => html`
                ${botaoIcone({ acao: "editar", id: r.id, nomeIcone: "pencil", rotulo: `Editar ${r.titulo}` })}
                ${botaoIcone({ acao: "excluir", id: r.id, nomeIcone: "trash-2", rotulo: `Excluir ${r.titulo}`, perigo: true })}` }
        ],
        ordenacao: usa("data") ? { chave: "data", direcao: "desc" } : { chave: "atualizado_em", direcao: "desc" },
        vazio: cfg.vazio, rotulo: cfg.titulo
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => lista.filter((r) =>
        (!filtros.status || r.status === filtros.status) &&
        (!filtros.busca || normalizar(`${r.titulo} ${r.descricao} ${r.versao}`).includes(normalizar(filtros.busca))));
    tabela.definirLinhas(filtrar());
    raiz.querySelector("#pBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("#pStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(filtrar()); });
    if (cfg.extra) cfg.extra(raiz.querySelector("[data-extra]")).catch((e) => console.error(e));

    const formulario = (atual) => abrirFormulario({
        titulo: atual ? `Editar ${cfg.singular.toLowerCase()}` : cfg.novo,
        campos: [
            { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, maxlength: 160 },
            { nome: "descricao", rotulo: "Descrição", tipo: "textarea", maxlength: 4000 },
            { nome: "status", rotulo: "Situação", tipo: "select", largura: "meia", opcoes: Object.entries(cfg.status).map(([k, v]) => [k, v.rotulo]) },
            ...(usa("categoria") ? [{ nome: "categoria", rotulo: "Categoria", tipo: "select", largura: "meia", opcoes: [["", "—"], ...Object.entries(cfg.categorias)] }] : []),
            ...(usa("prioridade") ? [{ nome: "prioridade", rotulo: "Prioridade", tipo: "select", largura: "meia", opcoes: [["", "—"], ...Object.entries(PRIORIDADES_PRODUTO).map(([k, v]) => [k, v.rotulo])] }] : []),
            ...(usa("versao") ? [{ nome: "versao", rotulo: "Versão", tipo: "texto", maxlength: 40, largura: "meia", placeholder: "Ex.: 1.4.0" }] : []),
            ...(usa("data") ? [{ nome: "data", rotulo: cfg.rotuloData ?? "Data", tipo: "data", largura: "meia" }] : []),
            ...(usa("barbearia") ? [{ nome: "barbearia_id", rotulo: "Pedido por (opcional)", tipo: "select", largura: "meia", opcoes: [["", "Interno"], ...barbearias.map((b) => [b.id, b.nome])] }] : [])
        ],
        valores: atual ? { ...atual, categoria: atual.categoria ?? "", prioridade: atual.prioridade ?? "", barbearia_id: atual.barbearia_id ?? "", data: atual.data ?? "" } : { status: cfg.statusPadrao },
        textoSalvar: "Salvar",
        aoSalvar: async (v) => {
            try {
                return await rpc("salvar_produto", { p_id: atual?.id ?? null, p_dados: { ...v, tipo: cfg.tipo } });
            } catch (erro) {
                if (`${erro.message} ${erro.original?.message ?? ""}`.includes("titulo_obrigatorio")) throw Object.assign(new Error("Informe o título."), { campo: "titulo" });
                throw erro;
            }
        }
    });

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const r = lista.find((x) => x.id === botao.dataset.id);
        try {
            if (botao.dataset.acao === "novo" && await formulario(null)) { mostrarToast("Registro salvo.", "sucesso"); renderProduto(view, cfg); }
            if (botao.dataset.acao === "editar" && await formulario(r)) { mostrarToast("Registro atualizado.", "sucesso"); renderProduto(view, cfg); }
            if (botao.dataset.acao === "excluir") {
                const ok = await confirmar({ titulo: "Excluir registro?", mensagem: `“${r.titulo}” será apagado. A exclusão fica registrada na auditoria.`, textoConfirmar: "Excluir", perigo: true });
                if (!ok) return;
                await rpc("excluir_produto", { p_id: r.id });
                mostrarToast("Registro excluído.", "sucesso");
                renderProduto(view, cfg);
            }
            if (botao.dataset.acao === "exportar") {
                const linhas = filtrar();
                if (!linhas.length) return mostrarToast("Nada para exportar com os filtros atuais.", "atencao");
                baixarCsv(`${cfg.tipo}-${isoLocal(new Date())}.csv`, [
                    { rotulo: "Título", valor: (x) => x.titulo },
                    { rotulo: "Descrição", valor: (x) => x.descricao ?? "" },
                    { rotulo: "Situação", valor: (x) => cfg.status[x.status]?.rotulo ?? x.status },
                    ...(usa("versao") ? [{ rotulo: "Versão", valor: (x) => x.versao ?? "" }] : []),
                    ...(usa("categoria") ? [{ rotulo: "Categoria", valor: (x) => cfg.categorias[x.categoria] ?? "" }] : []),
                    ...(usa("prioridade") ? [{ rotulo: "Prioridade", valor: (x) => PRIORIDADES_PRODUTO[x.prioridade]?.rotulo ?? "" }] : []),
                    ...(usa("barbearia") ? [{ rotulo: "Pedido por", valor: (x) => x.barbearia ?? "Interno" }] : []),
                    ...(usa("data") ? [{ rotulo: cfg.rotuloData ?? "Data", valor: (x) => dia(x.data) }] : [])
                ], linhas);
                mostrarToast("Planilha CSV gerada.", "sucesso");
            }
        } catch (erro) {
            mostrarToast(erro.message, "erro");
        }
    });
}
