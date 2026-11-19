// =====================================================================
// MÓDULO 19 — CONFIGURAÇÕES GERAIS (modo demonstrativo)
// Rotas: #/configuracoes[/<categoria>|historico]
// Formulários com Salvar alterações, Cancelar edição e Restaurar padrão.
// Toda alteração é registrada (anterior → novo, data, responsável) e
// aparece também na auditoria (módulo 20). Valores no localStorage.
// =====================================================================
import * as C from "../../services/demo/configuracoes.js";
import { APP_CONFIG } from "../../config/app.config.js";
import { html, icone, renderizar, bruto } from "../../js/utilities/dom.js";
import { numero, dataHora } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { exportarRelatorio } from "../../js/utilities/exportar.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirPainel } from "../../js/components/painel.js";
import { kpi, estadoVazio, listaDefinicao, campoSelect, molduraComAbas, iniciais } from "../../js/components/ui.js";

const SECOES = [["", "Identidade"], ["comercial", "Comercial"], ["acesso", "Acesso"], ["seguranca", "Segurança"], ["comunicacao", "Comunicação"],
    ["integracoes", "Integrações"], ["aparencia", "Aparência"], ["tecnico", "Técnicas"], ["historico", "Histórico"]];
const categoriaDaRota = (rota) => (rota === "" ? "identidade" : rota);
let filtroHistorico = "";

const ICONES_LOGO = { navalha: "slice", tesoura: "scissors", coroa: "crown" };

function kpis() {
    const hist = C.historicoConfiguracoes();
    const alteradas = Object.keys(C.PADROES).reduce((s, cat) => s + C.diferencas(cat, C.PADROES[cat]).length, 0);
    return html`
        ${kpi({ rotulo: "Categorias", valor: numero(Object.keys(C.CATEGORIAS_CONFIG).length), iconeNome: "layers", nota: "Identidade a configurações técnicas", destaque: true })}
        ${kpi({ rotulo: "Diferentes do padrão", valor: numero(alteradas), iconeNome: "sliders-horizontal", nota: "Configurações personalizadas" })}
        ${kpi({ rotulo: "Alterações registradas", valor: numero(hist.length), iconeNome: "history", nota: hist[0] ? `Última: ${dataHora(hist[0].data)}` : "Nenhuma ainda" })}
        ${kpi({ rotulo: "Integrações conectadas", valor: "0", iconeNome: "plug", nota: `${C.INTEGRACOES.length} pendentes de integração` })}`;
}

// ---------------------------------------------------------------------
// Formulário em página (com controle de alterações pendentes)
// ---------------------------------------------------------------------
function htmlCampo(campo, valor, categoria) {
    const id = `cfg-${campo.nome}`;
    const critico = (C.CRITICAS[categoria] ?? []).includes(campo.nome);
    const rotulo = html`<span class="campo__rotulo">${campo.rotulo}${campo.obrigatorio ? html`<span class="campo__obrigatorio" aria-hidden="true"> *</span>` : ""}${critico ? html` <span class="badge badge--atencao badge--mini" title="Exige confirmação ao salvar">crítica</span>` : ""}</span>`;
    const rodape = html`<span class="campo__erro" data-erro-para="${campo.nome}" role="alert"></span>${campo.ajuda ? html`<span class="campo__ajuda">${campo.ajuda}</span>` : ""}`;
    const largo = ["textarea", "checkboxes", "logo"].includes(campo.tipo);

    if (campo.tipo === "checkboxes") {
        const marcados = new Set(valor ?? []);
        return html`
            <fieldset class="campo campo--inteira campo--grupo" data-campo="${campo.nome}">
                <legend>${rotulo}</legend>
                <div class="opcoes-marcar">${campo.opcoes.map(([v, r]) => html`
                    <label class="marcar"><input type="checkbox" name="${campo.nome}" value="${v}" ${marcados.has(v) ? bruto("checked") : ""}><span>${r}</span></label>`)}</div>
                ${rodape}
            </fieldset>`;
    }
    if (campo.tipo === "logo") {
        return html`
            <fieldset class="campo campo--inteira campo--grupo" data-campo="${campo.nome}">
                <legend>${rotulo}</legend>
                <div class="logos">${campo.opcoes.map(([v, r]) => html`
                    <label class="logo-opcao">
                        <input type="radio" name="${campo.nome}" value="${v}" ${valor === v ? bruto("checked") : ""}>
                        <span class="logo-opcao__marca" data-logo="${v}">${v === "monograma" ? html`<b data-monograma></b>` : icone(ICONES_LOGO[v])}</span>
                        <span>${r}</span>
                    </label>`)}</div>
                ${rodape}
            </fieldset>`;
    }
    if (campo.tipo === "booleano") {
        return html`
            <div class="campo campo--meia" data-campo="${campo.nome}">
                <span class="campo__rotulo" id="${id}-r">${campo.rotulo}</span>
                <label class="interruptor">
                    <input type="checkbox" id="${id}" name="${campo.nome}" role="switch" aria-labelledby="${id}-r" ${valor ? bruto("checked") : ""}>
                    <span class="interruptor__trilho" aria-hidden="true"></span>
                    <span class="interruptor__texto" data-texto-interruptor>${valor ? "Ativado" : "Desativado"}</span>
                </label>
                ${rodape}
            </div>`;
    }
    let controle;
    const attrs = bruto([
        campo.obrigatorio ? "required" : "", campo.maxlength ? `maxlength="${campo.maxlength}"` : "",
        campo.min !== undefined ? `min="${campo.min}"` : "", campo.max !== undefined ? `max="${campo.max}"` : "",
        campo.passo !== undefined ? `step="${campo.passo}"` : ""
    ].filter(Boolean).join(" "));
    if (campo.tipo === "select") {
        controle = html`<select class="entrada" id="${id}" name="${campo.nome}">${campo.opcoes.map(([v, r]) => html`<option value="${v}" ${String(v) === String(valor) ? bruto("selected") : ""}>${r}</option>`)}</select>`;
    } else if (campo.tipo === "textarea") {
        controle = html`<textarea class="entrada entrada--area" id="${id}" name="${campo.nome}" rows="3" ${attrs}>${valor ?? ""}</textarea>`;
    } else {
        const tipo = { numero: "number", email: "email", url: "url" }[campo.tipo] ?? "text";
        controle = html`<input class="entrada" id="${id}" name="${campo.nome}" type="${tipo}" value="${valor ?? ""}" ${attrs}>`;
    }
    return html`
        <div class="campo ${largo ? "campo--inteira" : "campo--meia"}" data-campo="${campo.nome}">
            <label for="${id}">${rotulo}</label>
            ${controle}
            ${rodape}
        </div>`;
}

function lerFormulario(form, campos) {
    const valores = {};
    campos.forEach((c) => {
        if (c.tipo === "checkboxes") valores[c.nome] = [...form.querySelectorAll(`input[name="${c.nome}"]:checked`)].map((i) => i.value);
        else if (c.tipo === "logo") valores[c.nome] = form.querySelector(`input[name="${c.nome}"]:checked`)?.value ?? "";
        else if (c.tipo === "booleano") valores[c.nome] = form.elements[c.nome].checked;
        else valores[c.nome] = form.elements[c.nome].value;
    });
    return valores;
}

function mostrarErro(form, campo, mensagem) {
    form.querySelectorAll("[data-erro-para]").forEach((e) => { e.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid"));
    if (!campo) return;
    const alvo = form.querySelector(`[data-erro-para="${campo}"]`);
    if (alvo) alvo.textContent = mensagem;
    const el = form.querySelector(`[name="${campo}"]`);
    if (el) { el.setAttribute("aria-invalid", "true"); el.focus(); }
}

function secaoCategoria(ctx, categoria) {
    const { secao } = ctx;
    const info = C.CATEGORIAS_CONFIG[categoria];
    const campos = C.camposDe(categoria);
    const atual = C.configuracao(categoria);
    const tecnico = categoria === "tecnico" ? C.informacoesTecnicas() : null;

    renderizar(secao, html`
        ${categoria === "aparencia" ? html`<div class="alerta alerta--info">${icone("palette")}<span>As preferências de aparência valem para este painel neste navegador e são aplicadas ao salvar. A identidade visual oficial (preto e dourado champagne) é preservada.</span></div>` : ""}
        ${categoria === "acesso" || categoria === "seguranca" ? html`<div class="alerta alerta--info">${icone("shield-alert")}<span><strong>Configurações demonstrativas.</strong> Elas descrevem as regras que o backend vai aplicar na integração real; hoje não alteram nenhum login ou sessão.</span></div>` : ""}
        ${tecnico ? html`
            <section class="card secao">
                <div class="card__cabecalho"><h2 class="card__titulo">Informações técnicas</h2><span class="texto-terc">Somente leitura</span></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Versão da aplicação", APP_CONFIG.versao], ["Ambiente", "Demonstrativo local (dados fictícios no navegador)"],
                    ["Projeto Supabase previsto", APP_CONFIG.supabaseUrl.replace("https://", "")], ["Schema de API previsto", APP_CONFIG.apiSchema],
                    ["Armazenamento local usado", tecnico.armazenamentoKb === null ? "Indisponível" : `${numero(tecnico.armazenamentoKb)} KB`],
                    ["Registros demonstrativos", tecnico.registros.map(([c, n]) => `${c}: ${numero(n)}`).join(" · ")],
                    ["Navegador", tecnico.navegador]
                ])}</div>
            </section>` : ""}
        <form class="card config-form" data-form novalidate>
            <div class="card__cabecalho">
                <div><h2 class="card__titulo">${info.rotulo}</h2><p class="texto-terc texto-pequeno">${info.descricao}</p></div>
                <span class="badge" data-estado-form>Sem alterações</span>
            </div>
            <div class="card__corpo">
                ${categoria === "identidade" ? html`<div class="previa-marca" data-previa-marca></div>` : ""}
                <div class="formulario__grade">${campos.map((c) => htmlCampo(c, atual[c.nome], categoria))}</div>
            </div>
            <div class="config-form__acoes">
                <button class="btn btn--fantasma" type="button" data-acao="restaurar-padrao">${icone("rotate-ccw")}<span>Restaurar padrão</span></button>
                <span class="config-form__espaco"></span>
                <button class="btn btn--fantasma" type="button" data-acao="cancelar" disabled>${icone("undo-2")}<span>Cancelar edição</span></button>
                <button class="btn btn--primario" type="submit" disabled>${icone("save")}<span>Salvar alterações</span></button>
            </div>
        </form>
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Últimas alterações desta categoria</h2><a class="link-forte texto-pequeno" href="#/configuracoes/historico">Ver histórico completo</a></div>
            <div class="card__corpo" data-mini-historico></div>
        </section>`);

    const form = secao.querySelector("[data-form]");
    const botaoSalvar = form.querySelector("button[type=submit]");
    const botaoCancelar = form.querySelector("[data-acao=cancelar]");
    const estadoForm = form.querySelector("[data-estado-form]");

    function miniHistorico() {
        const lista = C.historicoConfiguracoes(categoria).slice(0, 5);
        renderizar(secao.querySelector("[data-mini-historico]"), lista.length ? html`
            <ul class="lista">${lista.map((h) => html`
                <li class="lista__item"><span class="lista__icone">${icone(h.acao === "restaurada" ? "rotate-ccw" : "pencil")}</span>
                    <div class="lista__conteudo"><span class="lista__titulo">${h.descricao}</span><span class="lista__meta">${dataHora(h.data)} · ${h.detalhes?.responsavel ?? C.RESPONSAVEL_DEMO}</span></div></li>`)}</ul>`
            : estadoVazio({ iconeNome: "history", titulo: "Nenhuma alteração registrada nesta categoria" }));
    }

    function previaMarca() {
        const alvo = form.querySelector("[data-previa-marca]");
        if (!alvo) return;
        const v = lerFormulario(form, campos);
        const marca = v.logotipo || "navalha";
        renderizar(alvo, html`
            <span class="previa-marca__simbolo">${marca === "monograma" ? html`<b>${iniciais(v.nomePlataforma || "BC")}</b>` : icone(ICONES_LOGO[marca])}</span>
            <span><strong>${v.nomePlataforma || "—"}</strong><small>${v.nomeComercial || ""}</small></span>
            <span class="badge">Pré-visualização</span>`);
        form.querySelectorAll("[data-monograma]").forEach((b) => { b.textContent = iniciais(v.nomePlataforma || "BC"); });
    }

    function atualizarEstado() {
        const pendentes = C.diferencas(categoria, lerFormulario(form, campos));
        botaoSalvar.disabled = !pendentes.length;
        botaoCancelar.disabled = !pendentes.length;
        estadoForm.textContent = pendentes.length ? `${pendentes.length} ${pendentes.length === 1 ? "alteração pendente" : "alterações pendentes"}` : "Sem alterações";
        estadoForm.className = `badge ${pendentes.length ? "badge--atencao" : ""}`;
        form.querySelectorAll("[data-texto-interruptor]").forEach((t) => { t.textContent = t.parentElement.querySelector("input").checked ? "Ativado" : "Desativado"; });
        previaMarca();
        return pendentes;
    }

    form.addEventListener("input", atualizarEstado);
    form.addEventListener("change", atualizarEstado);
    previaMarca();
    miniHistorico();

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const valores = lerFormulario(form, campos);
        const pendentes = C.diferencas(categoria, valores);
        if (!pendentes.length) return;
        const criticas = pendentes.filter((d) => (C.CRITICAS[categoria] ?? []).includes(d.campo.nome));
        if (criticas.length) {
            const ok = await confirmar({
                titulo: "Confirmar alteração importante",
                mensagem: `Você está alterando: ${criticas.map((d) => `${d.campo.rotulo} (${C.descreverValor(d.campo, d.anterior)} → ${C.descreverValor(d.campo, d.novo)})`).join("; ")}. A alteração será registrada na auditoria.`,
                textoConfirmar: "Salvar alteração"
            });
            if (!ok) return;
        }
        try {
            const salvas = C.salvarCategoria(categoria, valores);
            mostrarErro(form, null);
            mostrarToast(`${salvas.length} ${salvas.length === 1 ? "configuração salva" : "configurações salvas"} e registradas no histórico.`, "sucesso");
            ctx.atualizarIndicadores();
            miniHistorico();
            atualizarEstado();
        } catch (falha) {
            if (falha.campo) mostrarErro(form, falha.campo, falha.message);
            mostrarToast(falha.message, "erro");
        }
    });

    form.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        if (b.dataset.acao === "cancelar") {
            const pendentes = C.diferencas(categoria, lerFormulario(form, campos));
            if (!pendentes.length) return;
            secaoCategoria(ctx, categoria);
            mostrarToast("Edição cancelada: os valores salvos foram recarregados.", "info");
        }
        if (b.dataset.acao === "restaurar-padrao") {
            const diferentes = C.diferencas(categoria, C.PADROES[categoria]);
            if (!diferentes.length) return mostrarToast("Esta categoria já está com os valores padrão.", "info");
            const ok = await confirmar({
                titulo: `Restaurar "${info.rotulo}"?`,
                mensagem: `${diferentes.length} ${diferentes.length === 1 ? "configuração voltará" : "configurações voltarão"} ao valor padrão: ${diferentes.map((d) => d.campo.rotulo).join(", ")}. A restauração fica registrada no histórico.`,
                textoConfirmar: "Restaurar padrão", perigo: true
            });
            if (!ok) return;
            C.restaurarCategoria(categoria);
            mostrarToast("Valores padrão restaurados.", "sucesso");
            ctx.atualizarIndicadores();
            secaoCategoria(ctx, categoria);
        }
    });
}

// ---------------------------------------------------------------------
// Integrações (somente leitura)
// ---------------------------------------------------------------------
function secaoIntegracoes({ secao }) {
    renderizar(secao, html`
        <div class="alerta alerta--info">${icone("plug")}<span><strong>Nenhuma integração está conectada.</strong> Esta versão não solicita nem armazena credenciais. Chaves e tokens reais devem ficar apenas no backend (Edge Functions), nunca no navegador.</span></div>
        <div class="integracoes secao">${C.INTEGRACOES.map((i) => html`
            <article class="integracao" data-integracao="${i.id}">
                <div class="integracao__topo">
                    <span class="integracao__icone">${icone(i.icone)}</span>
                    <div><h3>${i.nome}</h3><span class="texto-terc texto-pequeno">${i.tipo}</span></div>
                </div>
                <p>${i.descricao}</p>
                ${listaDefinicao([
                    ["Status", html`<span class="badge badge--atencao"><span class="ponto"></span>Pendente de integração</span>`],
                    ["Situação da conexão", "Não conectado"], ["Módulos que dependem", i.modulos]
                ])}
                <button class="btn btn--pequeno" type="button" data-acao="requisitos" data-id="${i.id}">${icone("list-checks")}<span>Configuração necessária</span></button>
            </article>`)}</div>`);
    secao.addEventListener("click", (e) => {
        const b = e.target.closest("[data-acao=requisitos]");
        if (!b) return;
        const i = C.INTEGRACOES.find((x) => x.id === b.dataset.id);
        abrirPainel({
            titulo: `${i.nome} · configuração necessária`, descricao: i.tipo,
            conteudo: html`
                <ol class="passos">${i.configuracao.map((p) => html`<li>${p}</li>`)}</ol>
                <div class="alerta alerta--info">${icone("lock")}<span>Nenhuma credencial é pedida aqui. A conexão será feita na etapa de integração real, com segredos guardados no servidor.</span></div>`
        });
    });
}

// ---------------------------------------------------------------------
// Histórico de alterações de configuração
// ---------------------------------------------------------------------
function secaoHistorico({ secao }) {
    renderizar(secao, html`
        <div class="barra-filtros barra-filtros--solta">
            ${campoSelect({ id: "fCatHist", rotulo: "Categoria", valor: filtroHistorico, opcoes: [["", "Todas as categorias"], ...Object.entries(C.CATEGORIAS_CONFIG).filter(([k]) => k !== "integracoes").map(([k, v]) => [k, v.rotulo])] })}
            <button class="btn" type="button" data-acao="exportar-historico">${icone("file-down")}<span>Exportar CSV</span></button>
        </div>
        <section class="card"><div data-tabela></div></section>`);
    const tabela = criarTabela({
        colunas: [
            { chave: "data", rotulo: "Data", render: (h) => dataHora(h.data) },
            { chave: "configuracao", rotulo: "Configuração alterada", valor: (h) => h.detalhes?.rotulo ?? h.entidadeId, render: (h) => html`${h.detalhes?.rotulo ?? h.entidadeId}<span class="celula-sub">${C.CATEGORIAS_CONFIG[h.detalhes?.categoria]?.rotulo ?? ""}</span>` },
            { chave: "anterior", rotulo: "Valor anterior", valor: (h) => valorTexto(h, "anterior"), render: (h) => html`<span class="celula-limite">${valorTexto(h, "anterior")}</span>` },
            { chave: "novo", rotulo: "Novo valor", valor: (h) => valorTexto(h, "novo"), render: (h) => html`<span class="celula-limite">${valorTexto(h, "novo")}</span>` },
            { chave: "acao", rotulo: "Tipo", valor: (h) => (h.acao === "restaurada" ? "Restauração" : "Alteração") },
            { chave: "responsavel", rotulo: "Responsável", valor: (h) => h.detalhes?.responsavel ?? C.RESPONSAVEL_DEMO }
        ],
        ordenacao: { chave: "data", direcao: "desc" }, vazio: "Nenhuma alteração de configuração registrada.", rotulo: "Histórico de configurações"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const lista = () => C.historicoConfiguracoes(filtroHistorico);
    tabela.definirLinhas(lista());
    secao.querySelector("#fCatHist").addEventListener("change", (e) => { filtroHistorico = e.target.value; tabela.definirLinhas(lista()); });
    secao.addEventListener("click", (e) => {
        if (!e.target.closest("[data-acao=exportar-historico]")) return;
        const linhas = lista();
        if (!linhas.length) return mostrarToast("Nada para exportar.", "atencao");
        exportarRelatorio("csv", {
            arquivo: "barber-control-historico-configuracoes", titulo: "Histórico de configurações",
            colunas: [
                { rotulo: "Data", valor: (h) => dataHora(h.data) }, { rotulo: "Categoria", valor: (h) => C.CATEGORIAS_CONFIG[h.detalhes?.categoria]?.rotulo ?? "" },
                { rotulo: "Configuração", valor: (h) => h.detalhes?.rotulo ?? h.entidadeId }, { rotulo: "Valor anterior", valor: (h) => valorTexto(h, "anterior") },
                { rotulo: "Novo valor", valor: (h) => valorTexto(h, "novo") }, { rotulo: "Tipo", valor: (h) => (h.acao === "restaurada" ? "Restauração" : "Alteração") },
                { rotulo: "Responsável", valor: (h) => h.detalhes?.responsavel ?? C.RESPONSAVEL_DEMO }
            ],
            linhas
        });
        mostrarToast(`${numero(linhas.length)} registros exportados.`, "sucesso");
    });
}

function valorTexto(h, lado) {
    const d = h.detalhes ?? {};
    const campo = C.camposDe(d.categoria).find((c) => c.nome === d.campo);
    return campo ? C.descreverValor(campo, d[lado]) : String(d[lado] ?? "—");
}

export function render(view, { parametros = [] }) {
    const rota = SECOES.some(([r]) => r === parametros[0]) ? parametros[0] : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Configurações gerais", subtitulo: "Preferências globais do Barber Control (demonstrativas, salvas neste navegador)", base: "#/configuracoes",
        secoes: SECOES, ativa: rota, kpis, recarregar
    });
    if (rota === "historico") return secaoHistorico(ctx);
    if (rota === "integracoes") return secaoIntegracoes(ctx);
    secaoCategoria(ctx, categoriaDaRota(rota));
}
