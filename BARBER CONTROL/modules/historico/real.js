// =====================================================================
// MÓDULO 15 — HISTÓRICO DE ALTERAÇÕES (MODO REAL)
// Registro das mudanças feitas no Barber (novidades, melhorias,
// correções e segurança), ligadas à versão em que entraram.
// As ações administrativas do Master ficam na Auditoria (módulo 20).
// =====================================================================
import { renderProduto } from "../compartilhado/produto-real.js";

const STATUS = { publicada: { rotulo: "Publicada", tom: "sucesso" }, pendente: { rotulo: "Pendente", tom: "atencao" } };
const CATEGORIAS = { nova: "Novidade", melhoria: "Melhoria", correcao: "Correção", seguranca: "Segurança", outra: "Outra" };

export function render(view) {
    renderProduto(view, {
        tipo: "mudanca", titulo: "Histórico de alterações", singular: "Mudança", novo: "Registrar mudança",
        subtitulo: "O que mudou no Barber, por versão · dados reais (ações do Master ficam na Auditoria)",
        status: STATUS, statusPadrao: "publicada", categorias: CATEGORIAS, campos: ["categoria", "versao", "data"],
        vazio: "Nenhuma mudança registrada. Use “Registrar mudança”.",
        kpis: (l) => [
            ["Mudanças registradas", l.length, "history", "Desde o início"],
            ["Correções", l.filter((r) => r.categoria === "correcao").length, "bug", "Problemas resolvidos"],
            ["Segurança", l.filter((r) => r.categoria === "seguranca").length, "shield-check", "Reforços de segurança"]
        ]
    });
}
