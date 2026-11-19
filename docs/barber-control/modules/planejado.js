// Página exibida para módulos ainda não implementados.
// Não mostra dados nem botões de ação: apenas informa o planejamento.
import { html, renderizar, icone } from "../js/utilities/dom.js";

export function render(container, { modulo }) {
    const numero = String(modulo.numero).padStart(2, "0");
    renderizar(container, html`
        <header class="pagina-cabecalho">
            <div>
                <h1>${modulo.titulo}</h1>
                <p>Módulo ${numero} · previsto para a Fase ${modulo.fase}</p>
            </div>
            <span class="badge badge--atencao"><span class="ponto"></span>Não implementado</span>
        </header>

        <section class="card">
            <div class="estado">
                <div class="estado__icone">${icone(modulo.icone)}</div>
                <h3>Este módulo ainda não está ativo</h3>
                <p>Nenhum dado é exibido aqui até a implementação e integração real com o banco,
                   prevista para a Fase ${modulo.fase} do plano de execução.</p>
            </div>
            <div class="card__corpo card__corpo--divisor">
                <h3 class="secao__titulo secao__titulo--espaco">Escopo planejado</h3>
                <ul class="planejado__lista">
                    ${modulo.planejado.map((item) => html`<li>${item}</li>`)}
                </ul>
            </div>
        </section>
    `);
}
