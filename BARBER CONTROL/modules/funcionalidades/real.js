// =====================================================================
// MÓDULO 14 — FUNCIONALIDADES (MODO REAL)
// Catálogo do que o Barber oferece às barbearias e em que estágio cada
// funcionalidade está. É um registro de gestão: não liga nem desliga
// nada nos painéis (a autorização real fica no banco).
// =====================================================================
import { renderProduto } from "../compartilhado/produto-real.js";

const STATUS = {
    planejada: { rotulo: "Planejada", tom: "neutro" },
    beta: { rotulo: "Beta", tom: "atencao" },
    ativa: { rotulo: "Ativa", tom: "sucesso" },
    desativada: { rotulo: "Desativada", tom: "neutro" }
};
const CATEGORIAS = { agenda: "Agenda", site: "Site da barbearia", painel: "Painel do dono", financeiro: "Financeiro", clientes: "Clientes", outra: "Outra" };

export function render(view) {
    renderProduto(view, {
        tipo: "funcionalidade", titulo: "Funcionalidades", singular: "Funcionalidade", novo: "Nova funcionalidade",
        subtitulo: "Catálogo do que o Barber oferece às barbearias · dados reais",
        status: STATUS, statusPadrao: "planejada", categorias: CATEGORIAS, campos: ["categoria", "data"], rotuloData: "Disponível desde",
        vazio: "Nenhuma funcionalidade registrada. Use “Nova funcionalidade”.",
        kpis: (l) => [
            ["Ativas", l.filter((r) => r.status === "ativa").length, "circle-check", "Disponíveis para as barbearias"],
            ["Em beta", l.filter((r) => r.status === "beta").length, "flask-conical", "Em teste"],
            ["Planejadas", l.filter((r) => r.status === "planejada").length, "lightbulb", "Ainda não lançadas"]
        ]
    });
}
