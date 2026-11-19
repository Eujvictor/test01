// =====================================================================
// Formulário em modal com validação por campo.
// campos: [{ nome, rotulo, tipo, obrigatorio, opcoes, min, max, passo,
//            maxlength, padrao, ajuda, largura: "meia"|"inteira",
//            validar?(valor, valores) → mensagem|null }]
// tipo: texto | email | tel | numero | data | select | textarea | checkboxes | secao
// aoSalvar(valores) pode lançar erro com .campo para marcar o campo.
// Resolve com o retorno de aoSalvar, ou null se cancelado.
// =====================================================================
import { html, bruto, icone, renderizar, escapar, definirCarregando } from "../utilities/dom.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIPOS_INPUT = { texto: "text", email: "email", tel: "tel", numero: "number", data: "date" };

function atributos(campo) {
    const partes = [];
    if (campo.obrigatorio) partes.push("required");
    if (campo.somenteLeitura) partes.push("readonly");
    if (campo.min !== undefined) partes.push(`min="${escapar(campo.min)}"`);
    if (campo.max !== undefined) partes.push(`max="${escapar(campo.max)}"`);
    if (campo.passo !== undefined) partes.push(`step="${escapar(campo.passo)}"`);
    if (campo.maxlength !== undefined) partes.push(`maxlength="${escapar(campo.maxlength)}"`);
    if (campo.placeholder) partes.push(`placeholder="${escapar(campo.placeholder)}"`);
    if (campo.inputmode) partes.push(`inputmode="${escapar(campo.inputmode)}"`);
    return bruto(partes.join(" "));
}

function htmlCampo(campo, valor) {
    if (campo.tipo === "secao") return html`<h3 class="formulario__secao">${campo.rotulo}</h3>`;

    const id = `campo-${campo.nome}`;
    const largura = campo.largura === "meia" ? "campo--meia" : "";
    const rotulo = html`<span class="campo__rotulo">${campo.rotulo}${campo.obrigatorio ? html`<span class="campo__obrigatorio" aria-hidden="true"> *</span>` : ""}</span>`;
    const rodape = html`
        <span class="campo__erro" id="${id}-erro" data-erro-para="${campo.nome}" role="alert"></span>
        ${campo.ajuda ? html`<span class="campo__ajuda">${campo.ajuda}</span>` : ""}`;

    if (campo.tipo === "checkboxes") {
        const marcados = new Set(valor ?? []);
        return html`
            <fieldset class="campo campo--inteira campo--grupo" data-campo="${campo.nome}">
                <legend class="campo__rotulo">${campo.rotulo}${campo.obrigatorio ? " *" : ""}</legend>
                <div class="opcoes-marcar">
                    ${campo.opcoes.map(([v, r]) => html`
                        <label class="marcar">
                            <input type="checkbox" name="${campo.nome}" value="${v}" ${marcados.has(v) ? bruto("checked") : ""}>
                            <span>${r}</span>
                        </label>`)}
                </div>
                ${rodape}
            </fieldset>`;
    }

    let controle;
    if (campo.tipo === "select") {
        controle = html`
            <select class="entrada" id="${id}" name="${campo.nome}" ${atributos(campo)} aria-describedby="${id}-erro">
                ${campo.placeholderOpcao ? html`<option value="">${campo.placeholderOpcao}</option>` : ""}
                ${campo.opcoes.map(([v, r]) => html`<option value="${v}" ${String(v) === String(valor ?? "") ? bruto("selected") : ""}>${r}</option>`)}
            </select>`;
    } else if (campo.tipo === "textarea") {
        controle = html`<textarea class="entrada entrada--area" id="${id}" name="${campo.nome}" rows="3" ${atributos(campo)} aria-describedby="${id}-erro">${valor ?? ""}</textarea>`;
    } else {
        controle = html`<input class="entrada" id="${id}" name="${campo.nome}" type="${TIPOS_INPUT[campo.tipo] ?? "text"}"
            value="${valor ?? ""}" ${atributos(campo)} aria-describedby="${id}-erro">`;
    }

    return html`
        <div class="campo ${largura}" data-campo="${campo.nome}">
            <label for="${id}">${rotulo}</label>
            ${controle}
            ${rodape}
        </div>`;
}

function lerValores(form, campos) {
    const valores = {};
    campos.filter((c) => c.tipo !== "secao").forEach((c) => {
        if (c.tipo === "checkboxes") {
            valores[c.nome] = [...form.querySelectorAll(`input[name="${c.nome}"]:checked`)].map((i) => i.value);
            return;
        }
        const bruto = form.elements[c.nome]?.value ?? "";
        valores[c.nome] = c.tipo === "numero" ? (bruto.trim() === "" ? null : Number(bruto)) : bruto.trim();
    });
    return valores;
}

function validar(campos, valores) {
    const erros = {};
    campos.filter((c) => c.tipo !== "secao").forEach((c) => {
        const v = valores[c.nome];
        const vazio = v === null || v === "" || (Array.isArray(v) && v.length === 0);
        if (c.obrigatorio && vazio) {
            erros[c.nome] = c.tipo === "checkboxes" ? "Selecione pelo menos uma opção." : "Campo obrigatório.";
            return;
        }
        // Regras condicionais (ex.: "obrigatório se X") rodam mesmo com o campo vazio.
        if (vazio) {
            const msg = c.validarVazio && c.validar ? c.validar(v ?? (c.tipo === "checkboxes" ? [] : ""), valores) : null;
            if (msg) erros[c.nome] = msg;
            return;
        }
        if (c.tipo === "email" && !EMAIL.test(v)) erros[c.nome] = "Informe um e-mail válido.";
        else if (c.tipo === "numero" && Number.isNaN(v)) erros[c.nome] = "Informe um número válido.";
        else if (c.tipo === "numero" && c.min !== undefined && v < c.min) erros[c.nome] = `O valor mínimo é ${c.min}.`;
        else if (c.tipo === "numero" && c.max !== undefined && v > c.max) erros[c.nome] = `O valor máximo é ${c.max}.`;
        else if (c.maxlength && String(v).length > c.maxlength) erros[c.nome] = `Máximo de ${c.maxlength} caracteres.`;
        if (!erros[c.nome] && c.validar) {
            const msg = c.validar(v, valores);
            if (msg) erros[c.nome] = msg;
        }
    });
    return erros;
}

function mostrarErros(form, erros) {
    form.querySelectorAll("[data-erro-para]").forEach((el) => { el.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    let primeiro = null;
    Object.entries(erros).forEach(([nome, mensagem]) => {
        const alvo = form.querySelector(`[data-erro-para="${nome}"]`);
        if (alvo) alvo.textContent = mensagem;
        const controle = form.elements[nome];
        const elemento = controle instanceof RadioNodeList ? controle[0] : controle;
        if (elemento) {
            elemento.setAttribute("aria-invalid", "true");
            primeiro ??= elemento;
        }
    });
    primeiro?.focus();
}

export function abrirFormulario({ titulo, descricao = "", campos, valores = {}, textoSalvar = "Salvar", perigo = false, aoSalvar }) {
    return new Promise((resolver) => {
        const dialogo = document.createElement("dialog");
        dialogo.className = "modal modal--formulario";
        dialogo.setAttribute("aria-labelledby", "modal-titulo");
        let resultado = null;

        renderizar(dialogo, html`
            <form class="formulario" novalidate>
                <div class="modal__cabecalho">
                    <div>
                        <h2 id="modal-titulo">${titulo}</h2>
                        ${descricao ? html`<p>${descricao}</p>` : ""}
                    </div>
                    <button class="btn btn--fantasma btn--icone" type="button" data-fechar aria-label="Fechar">${icone("x")}</button>
                </div>
                <div class="modal__corpo">
                    <div class="formulario__grade">${campos.map((c) => htmlCampo(c, valores[c.nome] ?? c.padrao))}</div>
                    <div class="alerta alerta--erro" data-erro-geral role="alert" hidden></div>
                </div>
                <div class="modal__acoes">
                    <button class="btn btn--fantasma" type="button" data-fechar>Cancelar</button>
                    <button class="btn ${perigo ? "btn--perigo" : "btn--primario"}" type="submit">${textoSalvar}</button>
                </div>
            </form>`);

        document.body.appendChild(dialogo);
        const form = dialogo.querySelector("form");
        const erroGeral = dialogo.querySelector("[data-erro-geral]");

        dialogo.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => dialogo.close()));
        dialogo.addEventListener("close", () => {
            dialogo.remove();
            resolver(resultado);
        });

        form.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            erroGeral.hidden = true;
            const valores = lerValores(form, campos);
            const erros = validar(campos, valores);
            mostrarErros(form, erros);
            if (Object.keys(erros).length) return;

            const botao = form.querySelector("button[type=submit]");
            definirCarregando(botao, true, "Salvando…");
            try {
                resultado = (await aoSalvar(valores)) ?? true;
                dialogo.close();
            } catch (erro) {
                definirCarregando(botao, false);
                if (erro?.campo && form.querySelector(`[data-erro-para="${erro.campo}"]`)) {
                    mostrarErros(form, { [erro.campo]: erro.message });
                } else {
                    erroGeral.textContent = erro?.message || "Não foi possível salvar.";
                    erroGeral.hidden = false;
                }
            }
        });

        dialogo.showModal();
        dialogo.querySelector("input:not([type=checkbox]), select, textarea")?.focus();
    });
}
