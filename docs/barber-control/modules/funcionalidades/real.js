// =====================================================================
// MÓDULO 14 — FUNCIONALIDADES (MODO REAL)
// Liga e desliga novidades nos sites das barbearias (migração 15):
//   Planejada / Desligada → ninguém vê
//   Em teste              → só a Navalha de Ouro (site mãe) e as pilotos
//   Liberada para todas   → todas as barbearias
// O "código" é o nome técnico que o site consulta. A regra é conferida
// no banco (control.funcionalidade_ligada), não só nesta tela.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, tempoRelativo, dataHora } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, botaoIcone, campoBusca, campoSelect, novaRaiz } from "../../js/components/ui.js";

const STATUS = {
    beta: { rotulo: "Em teste", tom: "atencao" },
    ativa: { rotulo: "Liberada para todas", tom: "sucesso" },
    planejada: { rotulo: "Planejada", tom: "neutro" },
    desativada: { rotulo: "Desligada", tom: "neutro" }
};
const CATEGORIAS = { agenda: "Agenda", site: "Site da barbearia", painel: "Painel do dono", financeiro: "Financeiro", clientes: "Clientes", outra: "Outra" };
const filtros = { busca: "", status: "" };
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function traduzir(erro) {
    const t = `${erro.message} ${erro.original?.message ?? ""}`;
    const mapa = {
        titulo_obrigatorio: ["Informe o nome da funcionalidade.", "titulo"],
        codigo_invalido: ["Use só letras minúsculas sem acento, números e _ (ex.: fidelidade). Comece com letra; de 3 a 40 caracteres.", "codigo"],
        codigo_em_uso: ["Esse código já é usado por outra funcionalidade.", "codigo"],
        codigo_obrigatorio: ["Defina o código da funcionalidade (botão Editar) antes de colocar em teste ou liberar.", null]
    };
    const chave = Object.keys(mapa).find((k) => t.includes(k));
    return chave ? Object.assign(new Error(mapa[chave][0]), mapa[chave][1] ? { campo: mapa[chave][1] } : {}) : erro;
}

function quemVe(r, protegidas) {
    if (r.status === "ativa") return html`<strong>Todas</strong><span class="celula-sub">${numero(r.barbearias_com_acesso)} barbearia(s)</span>`;
    if (r.status === "beta") {
        const nomes = [...protegidas, ...(r.pilotos_nomes ?? [])];
        return html`<strong>${nomes.length ? nomes.join(", ") : "—"}</strong><span class="celula-sub">site mãe${r.pilotos_nomes?.length ? ` + ${r.pilotos_nomes.length} piloto(s)` : ""}</span>`;
    }
    return html`<span class="texto-terc">Ninguém</span>`;
}

function acoes(r) {
    const botao = (acao, rotulo, ic, classe = "") => html`<button class="btn btn--pequeno ${classe}" type="button" data-acao="${acao}" data-id="${r.id}">${icone(ic)}<span>${rotulo}</span></button>`;
    return html`<div class="acoes-linha" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
        ${r.status !== "beta" && r.status !== "ativa" ? botao("teste", "Colocar em teste", "flask-conical") : ""}
        ${r.status === "beta" ? botao("todas", "Liberar para todas", "rocket", "btn--primario") : ""}
        ${r.status === "beta" ? botao("pilotos", "Pilotos", "users") : ""}
        ${r.status === "beta" || r.status === "ativa" ? botao("desligar", "Desligar", "power", "btn--perigo") : ""}
        ${botaoIcone({ acao: "editar", id: r.id, nomeIcone: "pencil", rotulo: `Editar ${r.titulo}` })}
        ${botaoIcone({ acao: "excluir", id: r.id, nomeIcone: "trash-2", rotulo: `Excluir ${r.titulo}`, perigo: true })}
    </div>`;
}

export async function render(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Funcionalidades", subtitulo: "Carregando do Supabase…" })}`);
    let lista, barbearias;
    try {
        [lista, barbearias] = await Promise.all([rpc("listar_funcionalidades"), rpc("listar_barbearias")]);
    } catch (erro) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Funcionalidades", subtitulo: "Painel Master" })}
            <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar", texto: erro.message })}</section>`);
        return;
    }
    const protegidas = barbearias.filter((b) => b.protegida).map((b) => b.nome);
    const candidatas = barbearias.filter((b) => !b.protegida && b.status !== "cancelada");

    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Funcionalidades",
            subtitulo: "Teste as novidades no site mãe e depois libere para todas as barbearias · dados reais",
            acoes: html`<button class="btn btn--primario" type="button" data-acao="novo">${icone("plus")}<span>Nova funcionalidade</span></button>`
        })}
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Em teste", valor: numero(lista.filter((r) => r.status === "beta").length), iconeNome: "flask-conical", nota: `Só em ${protegidas.join(", ") || "site mãe"} e pilotos`, destaque: true })}
            ${kpi({ rotulo: "Liberadas", valor: numero(lista.filter((r) => r.status === "ativa").length), iconeNome: "rocket", nota: "Em todas as barbearias" })}
            ${kpi({ rotulo: "Planejadas", valor: numero(lista.filter((r) => r.status === "planejada").length), iconeNome: "lightbulb", nota: "Ainda não lançadas" })}
        </section>
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Como lançar uma novidade</h2></div>
            <ol class="texto-sec" style="margin:8px 0 0 18px;line-height:1.7">
                <li><strong>Colocar em teste</strong>: aparece só em ${protegidas.join(", ") || "na barbearia de referência"} (e nas pilotos, se escolher).</li>
                <li>Teste com calma. Se algo der errado, <strong>Desligar</strong> esconde na hora.</li>
                <li><strong>Liberar para todas</strong>: aparece em todas as barbearias, os donos recebem um comunicado e fica registrado no Histórico.</li>
            </ol>
        </section>
        <div class="barra-filtros barra-filtros--solta">
            ${campoBusca({ id: "fBusca", valor: filtros.busca, placeholder: "Pesquisar nome, descrição ou código" })}
            ${campoSelect({ id: "fStatus", rotulo: "Situação", valor: filtros.status, opcoes: [["", "Todas as situações"], ...Object.entries(STATUS).map(([k, v]) => [k, v.rotulo])] })}
        </div>
        <section class="card"><div data-tabela></div></section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "titulo", rotulo: "Funcionalidade", render: (r) => html`<strong>${r.titulo}</strong>${r.descricao ? html`<span class="celula-sub">${String(r.descricao).slice(0, 110)}${r.descricao.length > 110 ? "…" : ""}</span>` : ""}` },
            { chave: "codigo", rotulo: "Código", valor: (r) => r.codigo ?? "", render: (r) => (r.codigo ? html`<code>${r.codigo}</code>` : html`<span class="texto-terc" title="Sem código: só registro, não liga nada no site">—</span>`) },
            { chave: "status", rotulo: "Situação", valor: (r) => STATUS[r.status]?.rotulo, render: (r) => badgeStatus(STATUS, r.status) },
            { chave: "quem", rotulo: "Quem vê", ordenavel: false, render: (r) => quemVe(r, protegidas) },
            { chave: "atualizado_em", rotulo: "Atualizado", render: (r) => html`<span title="${dataHora(r.atualizado_em)}">${tempoRelativo(r.atualizado_em)}</span>` },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: acoes }
        ],
        ordenacao: null,
        vazio: "Nenhuma funcionalidade registrada. Use “Nova funcionalidade”.",
        rotulo: "Funcionalidades"
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => lista.filter((r) =>
        (!filtros.status || r.status === filtros.status) &&
        (!filtros.busca || normalizar(`${r.titulo} ${r.descricao} ${r.codigo}`).includes(normalizar(filtros.busca))));
    tabela.definirLinhas(filtrar());
    raiz.querySelector("#fBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("#fStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(filtrar()); });

    const formulario = (atual) => abrirFormulario({
        titulo: atual ? "Editar funcionalidade" : "Nova funcionalidade",
        descricao: "Para ligar e desligar nos sites, a funcionalidade precisa de um código, combinado com quem programou a novidade. Sem código ela fica só como registro.",
        campos: [
            { nome: "titulo", rotulo: "Nome", tipo: "texto", obrigatorio: true, maxlength: 160, placeholder: "Ex.: Programa de fidelidade" },
            { nome: "descricao", rotulo: "Descrição (vira o texto do comunicado ao liberar)", tipo: "textarea", maxlength: 4000 },
            { nome: "codigo", rotulo: "Código", tipo: "texto", maxlength: 40, largura: "meia", placeholder: "Ex.: fidelidade", ajuda: "Letras minúsculas, números e _." },
            { nome: "categoria", rotulo: "Categoria", tipo: "select", largura: "meia", opcoes: [["", "—"], ...Object.entries(CATEGORIAS)] },
            ...(atual ? [] : [{ nome: "status", rotulo: "Situação inicial", tipo: "select", largura: "meia", opcoes: [["planejada", "Planejada (ninguém vê)"], ["ativa", "Já existe para todas (só registro)"]] }])
        ],
        valores: atual ? { titulo: atual.titulo, descricao: atual.descricao ?? "", codigo: atual.codigo ?? "", categoria: atual.categoria ?? "" } : { status: "planejada" },
        textoSalvar: "Salvar",
        aoSalvar: async (v) => {
            try {
                return await rpc("salvar_produto", { p_id: atual?.id ?? null, p_dados: { ...v, tipo: "funcionalidade", status: atual?.status ?? v.status } });
            } catch (erro) { throw traduzir(erro); }
        }
    });

    const recarregar = () => render(view);

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const r = lista.find((x) => x.id === botao.dataset.id);
        const acao = botao.dataset.acao;
        try {
            if (acao === "novo" && await formulario(null)) { mostrarToast("Funcionalidade salva.", "sucesso"); recarregar(); }
            if (acao === "editar" && await formulario(r)) { mostrarToast("Funcionalidade atualizada.", "sucesso"); recarregar(); }
            if (acao === "teste") {
                const ok = await confirmar({ titulo: "Colocar em teste?", mensagem: `“${r.titulo}” vai aparecer só em ${protegidas.join(", ") || "na barbearia de referência"}${r.pilotos_nomes?.length ? ` e nas pilotos (${r.pilotos_nomes.join(", ")})` : ""}. As outras barbearias não veem nada.`, textoConfirmar: "Colocar em teste" });
                if (!ok) return;
                await rpc("mudar_liberacao", { p_id: r.id, p_acao: "teste" });
                mostrarToast("Em teste no site mãe.", "sucesso"); recarregar();
            }
            if (acao === "todas") {
                const v = await abrirFormulario({
                    titulo: "Liberar para todas as barbearias?",
                    descricao: `“${r.titulo}” vai aparecer em todas as barbearias agora. Fica registrado no Histórico.`,
                    campos: [{ nome: "avisar", rotulo: "Avisar os donos", tipo: "select", opcoes: [["sim", "Sim, publicar o comunicado “Novidade: …”"], ["nao", "Não avisar"]] }],
                    valores: { avisar: "sim" },
                    textoSalvar: "Liberar para todas",
                    aoSalvar: async (x) => rpc("mudar_liberacao", { p_id: r.id, p_acao: "todas", p_avisar: x.avisar === "sim" })
                });
                if (!v) return;
                mostrarToast(v.comunicado ? "Liberada para todas. Os donos receberam o comunicado." : "Liberada para todas.", "sucesso"); recarregar();
            }
            if (acao === "desligar") {
                const ok = await confirmar({ titulo: "Desligar funcionalidade?", mensagem: `“${r.titulo}” some de todas as barbearias na hora. Dá para colocar em teste de novo depois.`, textoConfirmar: "Desligar", perigo: true });
                if (!ok) return;
                await rpc("mudar_liberacao", { p_id: r.id, p_acao: "desligar" });
                mostrarToast("Funcionalidade desligada.", "sucesso"); recarregar();
            }
            if (acao === "pilotos") {
                if (!candidatas.length) return mostrarToast("Ainda não há outras barbearias para testar junto.", "atencao");
                const v = await abrirFormulario({
                    titulo: "Barbearias piloto",
                    descricao: `Testam “${r.titulo}” junto com ${protegidas.join(", ") || "a barbearia de referência"}. Deixe tudo desmarcado para testar só no site mãe.`,
                    campos: [{ nome: "barbearias", rotulo: "Barbearias", tipo: "checkboxes", opcoes: candidatas.map((b) => [b.id, b.nome]) }],
                    valores: { barbearias: r.pilotos ?? [] },
                    textoSalvar: "Salvar pilotos",
                    aoSalvar: async (x) => { await rpc("definir_piloto", { p_id: r.id, p_barbearias: x.barbearias ?? [] }); return true; }
                });
                if (v) { mostrarToast("Pilotos atualizadas.", "sucesso"); recarregar(); }
            }
            if (acao === "excluir") {
                const ok = await confirmar({ titulo: "Excluir funcionalidade?", mensagem: `“${r.titulo}” será apagada do cadastro${r.codigo ? " e deixa de aparecer em todas as barbearias" : ""}. A exclusão fica na auditoria.`, textoConfirmar: "Excluir", perigo: true });
                if (!ok) return;
                await rpc("excluir_produto", { p_id: r.id });
                mostrarToast("Funcionalidade excluída.", "sucesso"); recarregar();
            }
        } catch (erro) {
            mostrarToast(traduzir(erro).message, "erro");
        }
    });
}
