// =====================================================================
// CENTRAL DE ALERTAS — integra segurança (10), monitoramento (11) e
// backups (12). Reconhecer, investigar, alterar status, registrar
// providências, encerrar e gerar comunicado (rascunho) no módulo 08.
// Alertas idênticos e abertos são agrupados, não duplicados.
// =====================================================================
import * as I from "../../services/demo/infra.js";
import * as S from "../../services/demo/saas.js";
import { GRAVIDADES, STATUS_ALERTA, CATEGORIAS_ALERTA, TIPOS_ALERTA, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { dataHora, tempoRelativo, numero } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, estadoVazio, listaDefinicao, linhaDoTempo, botaoIcone, campoBusca, campoSelect, novaRaiz
} from "../../js/components/ui.js";

const filtros = { busca: "", categoria: "", gravidade: "", status: "abertos" };
const ICONE_CATEGORIA = { seguranca: "shield-alert", monitoramento: "activity", backup: "database-backup" };

export async function novoAlerta() {
    const empresas = [...S.barbearias()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const resultado = await abrirFormulario({
        titulo: "Registrar alerta",
        descricao: "Alertas abertos idênticos (mesmo tipo e mesma referência) são agrupados automaticamente.",
        campos: [
            { nome: "tipo", rotulo: "Tipo", tipo: "select", obrigatorio: true, opcoes: Object.entries(TIPOS_ALERTA).map(([k, v]) => [k, `${v.rotulo} (${CATEGORIAS_ALERTA[v.categoria]})`]) },
            { nome: "gravidade", rotulo: "Gravidade", tipo: "select", obrigatorio: true, opcoes: opcoes(GRAVIDADES), largura: "meia" },
            { nome: "referencia", rotulo: "Serviço ou empresa relacionada", tipo: "select", largura: "meia", opcoes: [
                ["", "Nenhum"], ...I.servicos().map((s) => [`servico:${s.id}`, `Serviço · ${s.nome}`]), ...empresas.map((b) => [`barbearia:${b.id}`, `Empresa · ${b.nome}`])] },
            { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, maxlength: 500, validar: (v) => (v.length < 10 ? "Descreva com pelo menos 10 caracteres." : null) }
        ],
        valores: { gravidade: "media" },
        textoSalvar: "Registrar alerta",
        aoSalvar: (v) => {
            const [tipoRef, idRef] = v.referencia ? v.referencia.split(":") : [];
            return I.criarAlerta({ tipo: v.tipo, gravidade: v.gravidade, descricao: v.descricao, referencia: idRef ? { tipo: tipoRef, id: idRef } : {} });
        }
    });
    if (resultado) {
        mostrarToast(resultado.duplicado ? `Já existia um alerta aberto idêntico (${resultado.alerta.codigo}): ocorrência agrupada.` : `Alerta ${resultado.alerta.codigo} registrado.`, resultado.duplicado ? "atencao" : "sucesso");
        window.location.hash = `#/seguranca/alerta/${resultado.alerta.id}`;
    }
    return Boolean(resultado);
}

async function acao(nome, id) {
    const a = I.alerta(id);
    switch (nome) {
        case "reconhecer": I.reconhecerAlerta(id); mostrarToast("Alerta reconhecido.", "sucesso"); return true;
        case "investigar": I.alterarStatusAlerta(id, "investigacao"); mostrarToast("Alerta em investigação.", "sucesso"); return true;
        case "status": {
            const ok = await abrirFormulario({
                titulo: "Alterar status do alerta", descricao: `${a.codigo} · atual: ${STATUS_ALERTA[a.status].rotulo}`,
                campos: [
                    { nome: "status", rotulo: "Novo status", tipo: "select", obrigatorio: true, opcoes: opcoes(STATUS_ALERTA).filter(([v]) => v !== "encerrado") },
                    { nome: "comentario", rotulo: "Comentário", tipo: "textarea", maxlength: 300 }
                ],
                valores: { status: a.status }, textoSalvar: "Alterar status",
                aoSalvar: (v) => I.alterarStatusAlerta(id, v.status, v.comentario)
            });
            if (ok) mostrarToast("Status atualizado.", "sucesso");
            return Boolean(ok);
        }
        case "encerrar": {
            const ok = await abrirFormulario({
                titulo: `Encerrar ${a.codigo}`, campos: [{ nome: "resumo", rotulo: "Resumo do encerramento", tipo: "textarea", obrigatorio: true, maxlength: 400 }],
                textoSalvar: "Encerrar alerta", perigo: true, aoSalvar: (v) => I.encerrarAlerta(id, v.resumo)
            });
            if (ok) mostrarToast("Alerta encerrado.", "sucesso");
            return Boolean(ok);
        }
        case "comunicado": {
            const c = I.gerarComunicadoDoAlerta(id);
            mostrarToast("Comunicado criado como rascunho em Notificações (nada foi enviado).", "sucesso");
            window.location.hash = `#/notificacoes/${c.id}`;
            return false;
        }
        default: return false;
    }
}

const COLUNAS = [
    { chave: "codigo", rotulo: "Alerta", render: (a) => html`<a class="link-forte num" href="#/seguranca/alerta/${a.id}">${a.codigo}</a><span class="celula-sub">${TIPOS_ALERTA[a.tipo].rotulo}</span>` },
    { chave: "descricao", rotulo: "Descrição", render: (a) => html`<span class="celula-limite">${a.descricao}</span>${a.ocorrencias > 1 ? html`<span class="celula-sub">${a.ocorrencias} ocorrências agrupadas</span>` : ""}` },
    { chave: "categoria", rotulo: "Categoria", valor: (a) => CATEGORIAS_ALERTA[a.categoria], render: (a) => html`<span class="com-icone">${icone(ICONE_CATEGORIA[a.categoria])}${CATEGORIAS_ALERTA[a.categoria]}</span>` },
    { chave: "gravidade", rotulo: "Gravidade", valor: (a) => GRAVIDADES[a.gravidade].peso, render: (a) => badgeStatus(GRAVIDADES, a.gravidade) },
    { chave: "data", rotulo: "Data", render: (a) => html`<span title="${dataHora(a.data)}">${tempoRelativo(a.data)}</span>` },
    { chave: "status", rotulo: "Status", valor: (a) => STATUS_ALERTA[a.status].rotulo, render: (a) => badgeStatus(STATUS_ALERTA, a.status) },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (a) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "ver-alerta", id: a.id, nomeIcone: "eye", rotulo: `Ver ${a.codigo}` })}
            ${a.status === "novo" ? botaoIcone({ acao: "reconhecer-alerta", id: a.id, nomeIcone: "check", rotulo: `Reconhecer ${a.codigo}` }) : ""}
        </div>`
    }
];

// Central completa (aba "Alertas" do módulo 10).
export function renderCentral(secao, aoMudar) {
    renderizar(secao, html`
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Central de alertas</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-alr="novo">${icone("plus")}<span>Registrar alerta</span></button>
            </div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fAlrBusca", valor: filtros.busca, placeholder: "Pesquisar código ou descrição" })}
                ${campoSelect({ id: "fAlrCategoria", rotulo: "Categoria", valor: filtros.categoria, opcoes: [["", "Todas as categorias"], ...opcoes(CATEGORIAS_ALERTA)] })}
                ${campoSelect({ id: "fAlrGravidade", rotulo: "Gravidade", valor: filtros.gravidade, opcoes: [["", "Todas as gravidades"], ...opcoes(GRAVIDADES)] })}
                ${campoSelect({ id: "fAlrStatus", rotulo: "Status", valor: filtros.status, opcoes: [["abertos", "Abertos"], ["", "Todos os status"], ...opcoes(STATUS_ALERTA)] })}
            </div>
            <div data-tabela></div>
        </section>`);
    const linhas = () => I.alertas().filter((a) =>
        (!filtros.busca || `${a.codigo} ${a.descricao}`.toLowerCase().includes(filtros.busca.toLowerCase())) &&
        (!filtros.categoria || a.categoria === filtros.categoria) && (!filtros.gravidade || a.gravidade === filtros.gravidade) &&
        (filtros.status === "abertos" ? a.status !== "resolvido" && a.status !== "encerrado" : !filtros.status || a.status === filtros.status));
    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "gravidade", direcao: "desc" }, vazio: "Nenhum alerta para os filtros selecionados.", rotulo: "Alertas" });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());

    secao.querySelector("#fAlrBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(linhas()); });
    [["#fAlrCategoria", "categoria"], ["#fAlrGravidade", "gravidade"], ["#fAlrStatus", "status"]].forEach(([sel, chave]) =>
        secao.querySelector(sel).addEventListener("change", (e) => { filtros[chave] = e.target.value; tabela.definirLinhas(linhas()); }));
    secao.addEventListener("click", async (e) => {
        if (e.target.closest("[data-alr=novo]")) { await novoAlerta(); return; }
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        if (botao.dataset.acao === "ver-alerta") window.location.hash = `#/seguranca/alerta/${botao.dataset.id}`;
        if (botao.dataset.acao === "reconhecer-alerta") {
            try { await acao("reconhecer", botao.dataset.id); tabela.atualizarLinhas(linhas()); aoMudar?.(); } catch (falha) { mostrarToast(falha.message, "erro"); }
        }
    });
}

// Resumo compacto para os painéis dos módulos 11 e 12.
export function resumoAlertas(lista, vazio = "Nenhum alerta aberto nesta área.") {
    if (!lista.length) return estadoVazio({ iconeNome: "bell-off", titulo: vazio });
    return html`
        <ul class="lista">
            ${lista.slice(0, 6).map((a) => html`
                <li class="lista__item">
                    <span class="lista__icone">${icone(ICONE_CATEGORIA[a.categoria])}</span>
                    <div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/seguranca/alerta/${a.id}">${a.codigo} · ${TIPOS_ALERTA[a.tipo].rotulo}</a>
                        <div class="lista__meta">${a.descricao}</div></div>
                    ${badgeStatus(GRAVIDADES, a.gravidade)}
                </li>`)}
        </ul>`;
}

export function renderDetalhe(view, id) {
    const raiz = novaRaiz(view);
    const a = I.alerta(id);
    const voltar = { href: "#/seguranca/alertas", rotulo: "Central de alertas" };
    if (!a) {
        renderizar(raiz, html`${cabecalho({ titulo: "Alerta não encontrado", voltar })}<section class="card">${estadoVazio({ iconeNome: "bell", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const ref = I.descreverReferencia(a.referencia);
    const aberto = a.status !== "resolvido" && a.status !== "encerrado";
    renderizar(raiz, html`
        ${cabecalho({
            titulo: `${a.codigo} · ${TIPOS_ALERTA[a.tipo].rotulo}`, voltar,
            extra: html`${badgeStatus(STATUS_ALERTA, a.status)}${badgeStatus(GRAVIDADES, a.gravidade)}`,
            subtitulo: `${CATEGORIAS_ALERTA[a.categoria]} · gerado em ${dataHora(a.data)}${a.ocorrencias > 1 ? ` · ${a.ocorrencias} ocorrências agrupadas` : ""}`,
            acoes: html`
                ${a.status === "novo" ? html`<button class="btn btn--primario" type="button" data-alr="reconhecer">${icone("check")}<span>Reconhecer</span></button>` : ""}
                ${aberto && a.status !== "investigacao" ? html`<button class="btn" type="button" data-alr="investigar">${icone("search")}<span>Investigar</span></button>` : ""}
                <button class="btn" type="button" data-alr="status">${icone("refresh-cw")}<span>Alterar status</span></button>
                ${!a.comunicadoId ? html`<button class="btn" type="button" data-alr="comunicado">${icone("megaphone")}<span>Gerar comunicado</span></button>` : ""}
                ${a.status !== "encerrado" ? html`<button class="btn btn--perigo" type="button" data-alr="encerrar">${icone("circle-stop")}<span>Encerrar</span></button>` : ""}`
        })}
        ${avisoDemo()}
        <div class="layout-detalhe">
            <div class="layout-detalhe__principal">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Descrição</h2></div>
                    <div class="card__corpo">
                        <p class="texto-corrido">${a.descricao}</p>
                        <div class="alerta alerta--info acao-recomendada">${icone("lightbulb")}<span><strong>Ação recomendada:</strong> ${TIPOS_ALERTA[a.tipo].acao}</span></div>
                    </div>
                </section>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Providências</h2><span class="badge">${numero(a.providencias.length)}</span></div>
                    <div class="card__corpo">
                        ${a.providencias.length ? html`<ul class="notas">${a.providencias.map((p) => html`<li class="nota"><p>${p.texto}</p><span class="texto-terc">${dataHora(p.data)}</span></li>`)}</ul>`
                            : html`<p class="texto-terc">Nenhuma providência registrada.</p>`}
                        ${a.status !== "encerrado" ? html`
                            <form class="resposta" data-form="providencia" novalidate>
                                <label class="campo"><span class="campo__rotulo">Registrar providência</span>
                                    <textarea class="entrada entrada--area" name="texto" rows="2" maxlength="800"></textarea>
                                    <span class="campo__erro" data-erro></span></label>
                                <div class="resposta__acoes"><span class="campo__ajuda">Alertas novos passam para "Em investigação" ao receber a primeira providência.</span>
                                    <button class="btn btn--primario" type="submit">${icone("clipboard-check")}<span>Registrar</span></button></div>
                            </form>` : ""}
                    </div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                    <div class="card__corpo">${linhaDoTempo(I.historicoDe("alerta", a.id))}</div>
                </section>
            </div>
            <aside class="layout-detalhe__lateral">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Informações</h2></div>
                    <div class="card__corpo">${listaDefinicao([
                        ["Identificador", a.codigo], ["Categoria", CATEGORIAS_ALERTA[a.categoria]], ["Gravidade", badgeStatus(GRAVIDADES, a.gravidade)],
                        ["Status", badgeStatus(STATUS_ALERTA, a.status)], ["Relacionado a", ref.link ? html`<a class="link-forte" href="${ref.link}">${ref.rotulo}</a>` : ref.rotulo],
                        ["Ocorrências", numero(a.ocorrencias)], ["Última atualização", dataHora(a.atualizadoEm)]
                    ])}</div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Comunicado</h2></div>
                    <div class="card__corpo" data-comunicado>${a.comunicadoId
                        ? html`<p class="texto-sec">Comunicado criado a partir deste alerta.</p><a class="btn btn--pequeno secao-topo" href="#/notificacoes/${a.comunicadoId}">${icone("external-link")}<span>Abrir comunicado</span></a>`
                        : html`<p class="texto-terc">Use "Gerar comunicado" para criar um rascunho em Notificações. Nada é enviado.</p>`}</div>
                </section>
            </aside>
        </div>`);

    const recarregar = () => renderDetalhe(view, id);
    raiz.querySelector("form[data-form=providencia]")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const campo = e.currentTarget.elements.texto;
        if (campo.value.trim().length < 3) {
            e.currentTarget.querySelector("[data-erro]").textContent = "Descreva a providência.";
            campo.setAttribute("aria-invalid", "true");
            return;
        }
        try { I.registrarProvidenciaAlerta(id, campo.value); mostrarToast("Providência registrada.", "sucesso"); recarregar(); }
        catch (falha) { mostrarToast(falha.message, "erro"); }
    });
    raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) return tratarRestauracaoDemo(recarregar);
        const botao = e.target.closest("[data-alr]");
        if (!botao) return;
        try { if (await acao(botao.dataset.alr, id)) recarregar(); } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}
