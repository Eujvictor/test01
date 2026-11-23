// =====================================================================
// MÓDULO 13 — ATUALIZAÇÕES E VERSÕES (MODO REAL)
// Registro das versões do Barber: planejadas, em desenvolvimento e
// publicadas, com as notas de cada uma. Não publica nada nos painéis.
// =====================================================================
import { renderProduto } from "../compartilhado/produto-real.js";

const STATUS = {
    planejada: { rotulo: "Planejada", tom: "neutro" },
    em_desenvolvimento: { rotulo: "Em desenvolvimento", tom: "atencao" },
    publicada: { rotulo: "Publicada", tom: "sucesso" },
    cancelada: { rotulo: "Cancelada", tom: "neutro" }
};

export function render(view) {
    renderProduto(view, {
        tipo: "versao", titulo: "Atualizações e versões", singular: "Versão", novo: "Nova versão",
        subtitulo: "Versões do Barber e o que mudou em cada uma · dados reais",
        status: STATUS, statusPadrao: "planejada", campos: ["versao", "data"], rotuloData: "Data de publicação",
        vazio: "Nenhuma versão registrada. Use “Nova versão”.",
        kpis: (l) => {
            const ultima = l.find((r) => r.status === "publicada");
            return [
                ["Versões publicadas", l.filter((r) => r.status === "publicada").length, "rocket", ultima?.versao ? `Última: ${ultima.versao}` : "Nenhuma ainda"],
                ["Em desenvolvimento", l.filter((r) => r.status === "em_desenvolvimento").length, "hammer", "Sendo construídas"],
                ["Planejadas", l.filter((r) => r.status === "planejada").length, "calendar-range", "Próximas versões"]
            ];
        }
    });
}
