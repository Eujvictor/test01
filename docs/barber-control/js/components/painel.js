// =====================================================================
// Painel em modal para visualização (detalhes, pré-visualização).
// acoes: [{ valor, rotulo, estilo: "primario"|"perigo"|"fantasma" }]
// Resolve com o "valor" da ação clicada, ou null ao fechar.
// =====================================================================
import { html, icone, renderizar } from "../utilities/dom.js";

export function abrirPainel({ titulo, descricao = "", conteudo, acoes = [], largo = false }) {
    return new Promise((resolver) => {
        const dialogo = document.createElement("dialog");
        dialogo.className = `modal modal--formulario ${largo ? "modal--largo" : ""}`;
        let resultado = null;
        renderizar(dialogo, html`
            <div class="formulario">
                <div class="modal__cabecalho">
                    <div><h2>${titulo}</h2>${descricao ? html`<p>${descricao}</p>` : ""}</div>
                    <button class="btn btn--fantasma btn--icone" type="button" data-valor="" aria-label="Fechar">${icone("x")}</button>
                </div>
                <div class="modal__corpo">${conteudo}</div>
                <div class="modal__acoes">
                    <button class="btn btn--fantasma" type="button" data-valor="">${acoes.length ? "Cancelar" : "Fechar"}</button>
                    ${acoes.map((a) => html`<button class="btn ${a.estilo === "perigo" ? "btn--perigo" : a.estilo === "fantasma" ? "" : "btn--primario"}" type="button" data-valor="${a.valor}">${a.rotulo}</button>`)}
                </div>
            </div>`);
        document.body.appendChild(dialogo);
        dialogo.addEventListener("click", (e) => {
            const botao = e.target.closest("[data-valor]");
            if (!botao) return;
            resultado = botao.dataset.valor || null;
            dialogo.close();
        });
        dialogo.addEventListener("close", () => {
            dialogo.remove();
            resolver(resultado);
        });
        dialogo.showModal();
    });
}
