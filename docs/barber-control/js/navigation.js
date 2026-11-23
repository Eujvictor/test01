// =====================================================================
// BARBER CONTROL — NAVEGAÇÃO (sidebar + roteador por hash)
// Cada módulo é carregado sob demanda (import dinâmico).
// =====================================================================
import { GRUPOS, MODULOS, obterModulo } from "../modules/registry.js";
import { html, renderizar, icone, $$ } from "./utilities/dom.js";
import { MODO_DEMO } from "./demo.js";

export function montarSidebar(nav) {
    renderizar(nav, GRUPOS.map((grupo) => {
        // Fora do modo demonstração, módulos que dependem de serviços externos
        // ainda não contratados (somenteDemo) não aparecem no menu.
        const itens = MODULOS.filter((m) => m.grupo === grupo.id && (MODO_DEMO || !m.somenteDemo));
        if (!itens.length) return "";
        return html`
            <div class="nav-grupo">
                <div class="nav-grupo__titulo">${grupo.titulo}</div>
                ${itens.map((m) => html`
                    <a class="nav-item" href="#/${m.id}" data-modulo="${m.id}">
                        ${icone(m.icone)}
                        <span class="nav-item__rotulo">${m.titulo}</span>
                        ${m.disponivel
                            ? (m.demo && (MODO_DEMO || !m.real) ? html`<span class="nav-item__fase nav-item__fase--demo" title="Módulo funcional com dados demonstrativos">Demo</span>` : "")
                            : html`<span class="nav-item__fase" title="Previsto para a Fase ${m.fase}">F${m.fase}</span>`}
                    </a>`)}
            </div>`;
    }));
}

function esqueleto() {
    return html`
        <div class="skeleton skeleton--titulo"></div>
        <div class="skeleton skeleton--linha"></div>
        <div class="grade grade--kpi">
            ${[1, 2, 3, 4].map(() => html`<div class="skeleton skeleton--kpi"></div>`)}
        </div>`;
}

export function iniciarRoteador({ view, titulo, contexto, aoNavegar }) {
    let navegacaoAtual = 0;

    async function rotear() {
        // #/modulo/param1/param2 → módulo + parâmetros (ex.: #/barbearias/bb_001)
        const partes = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
        const modulo = obterModulo(partes[0] ?? "dashboard") ?? obterModulo("dashboard");
        const parametros = modulo.id === partes[0] ? partes.slice(1) : [];
        const minhaNavegacao = ++navegacaoAtual;

        $$(".nav-item").forEach((item) => {
            const ativo = item.dataset.modulo === modulo.id;
            item.classList.toggle("is-ativo", ativo);
            if (ativo) item.setAttribute("aria-current", "page");
            else item.removeAttribute("aria-current");
        });
        titulo.textContent = modulo.titulo;
        document.title = `${modulo.titulo} · Barber Control`;
        renderizar(view, esqueleto());

        if (!MODO_DEMO && modulo.somenteDemo) {
            renderizar(view, html`
                <div class="card"><div class="estado">
                    <div class="estado__icone">${icone(modulo.icone)}</div>
                    <h3>${modulo.titulo}: disponível só na demonstração</h3>
                    <p>Este módulo depende de serviços externos ainda não contratados (envio de e-mail/WhatsApp, monitoramento ou armazenamento de cópias). O Supabase já faz os backups do banco. Para ver como ficaria, abra o painel em modo demonstração.</p>
                    <a class="btn" href="dashboard.html?demo#/${modulo.id}">${icone("flask-conical")}<span>Ver na demonstração</span></a>
                </div></div>`);
            aoNavegar?.(modulo);
            return;
        }

        try {
            const implementacao = modulo.disponivel
                ? await import(`../modules/${modulo.caminho.replace(/^\.\//, "")}`)
                : await import("../modules/planejado.js");
            if (minhaNavegacao !== navegacaoAtual) return;
            await implementacao.render(view, { ...contexto, modulo, parametros });
        } catch (erro) {
            console.error(erro);
            if (minhaNavegacao !== navegacaoAtual) return;
            renderizar(view, html`
                <div class="card"><div class="estado">
                    <div class="estado__icone">${icone("octagon-alert")}</div>
                    <h3>Não foi possível abrir este módulo</h3>
                    <p>${erro.message || "Erro inesperado."}</p>
                </div></div>`);
        }

        view.focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
        aoNavegar?.(modulo);
    }

    window.addEventListener("hashchange", rotear);
    rotear();
}
