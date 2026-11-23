// =====================================================================
// MÓDULO 16 — ROADMAP E SOLICITAÇÕES (MODO REAL)
// Ideias e planos do Barber, com prioridade e previsão. Mostra também os
// pedidos de melhoria que as barbearias abriram pelo Suporte (tipo
// "Pedido de melhoria"), para virarem itens do roadmap.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { html, renderizar } from "../../js/utilities/dom.js";
import { tempoRelativo } from "../../js/utilities/format.js";
import { renderProduto } from "../compartilhado/produto-real.js";

const STATUS = {
    ideia: { rotulo: "Ideia", tom: "neutro" },
    planejada: { rotulo: "Planejada", tom: "ouro" },
    em_andamento: { rotulo: "Em andamento", tom: "atencao" },
    concluida: { rotulo: "Concluída", tom: "sucesso" },
    descartada: { rotulo: "Descartada", tom: "neutro" }
};
const CATEGORIAS = { interna: "Ideia interna", barbearia: "Pedido de barbearia" };

async function pedidosDoSuporte(alvo) {
    const chamados = (await rpc("listar_chamados")).filter((c) => c.categoria === "solicitacoes" && c.status !== "encerrado").slice(0, 6);
    if (!chamados.length) return;
    renderizar(alvo, html`
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Pedidos de melhoria das barbearias</h2><a class="badge" href="#/suporte">Abrir suporte</a></div>
            <ul class="lista">
                ${chamados.map((c) => html`
                    <li class="lista__item">
                        <div class="lista__conteudo">
                            <a class="lista__titulo link-forte" href="#/suporte/${c.id}">#${c.protocolo} · ${c.assunto}</a>
                            <div class="lista__meta">${c.barbearia} · ${tempoRelativo(c.ultima_mensagem_em)}</div>
                        </div>
                    </li>`)}
            </ul>
        </section>`);
}

export function render(view) {
    renderProduto(view, {
        tipo: "ideia", titulo: "Roadmap e solicitações", singular: "Item", novo: "Novo item",
        subtitulo: "Ideias, planos e pedidos das barbearias · dados reais",
        status: STATUS, statusPadrao: "ideia", categorias: CATEGORIAS, campos: ["categoria", "prioridade", "barbearia", "data"], rotuloData: "Previsão",
        vazio: "Nenhum item no roadmap. Use “Novo item”.",
        extra: pedidosDoSuporte,
        kpis: (l) => [
            ["Em andamento", l.filter((r) => r.status === "em_andamento").length, "loader", "Sendo feitos agora"],
            ["Planejados", l.filter((r) => r.status === "planejada").length, "map", "Com previsão"],
            ["Ideias", l.filter((r) => r.status === "ideia").length, "lightbulb", "Ainda em avaliação"],
            ["Concluídos", l.filter((r) => r.status === "concluida").length, "circle-check", "Entregues"]
        ]
    });
}
