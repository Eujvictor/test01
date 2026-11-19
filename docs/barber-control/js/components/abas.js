// =====================================================================
// Abas acessíveis (setas ← → navegam entre as abas).
// abas: [{ id, rotulo, render(painel) }]
// =====================================================================
import { html, renderizar } from "../utilities/dom.js";

export function montarAbas(container, { abas, ativa, aoTrocar, rotulo = "Seções" }) {
    renderizar(container, html`
        <div class="abas" role="tablist" aria-label="${rotulo}">
            ${abas.map((a) => html`
                <button class="abas__aba" type="button" role="tab" id="aba-${a.id}" data-aba="${a.id}"
                        aria-controls="painel-abas" aria-selected="false" tabindex="-1">${a.rotulo}</button>`)}
        </div>
        <div class="abas__painel" id="painel-abas" role="tabpanel" tabindex="0"></div>`);

    const painel = container.querySelector(".abas__painel");
    const botoes = [...container.querySelectorAll("[data-aba]")];

    function ativar(id, focar = false) {
        const aba = abas.find((a) => a.id === id) ?? abas[0];
        botoes.forEach((b) => {
            const selecionada = b.dataset.aba === aba.id;
            b.setAttribute("aria-selected", String(selecionada));
            b.tabIndex = selecionada ? 0 : -1;
            if (selecionada && focar) b.focus();
        });
        painel.setAttribute("aria-labelledby", `aba-${aba.id}`);
        aba.render(painel);
        aoTrocar?.(aba.id);
    }

    container.querySelector(".abas").addEventListener("click", (e) => {
        const botao = e.target.closest("[data-aba]");
        if (botao) ativar(botao.dataset.aba);
    });
    container.querySelector(".abas").addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const atual = botoes.findIndex((b) => b.getAttribute("aria-selected") === "true");
        const proximo = (atual + (e.key === "ArrowRight" ? 1 : -1) + botoes.length) % botoes.length;
        ativar(botoes[proximo].dataset.aba, true);
    });

    ativar(ativa);
    return { ativar };
}
