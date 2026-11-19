// =====================================================================
// Nomes legíveis das ações gravadas em control.auditoria (modo real).
// Usado pela Visão geral, Usuários e Auditoria.
// =====================================================================

export const ACOES_AUDITORIA = {
    login: { texto: "Login realizado", icone: "log-in", grupo: "acesso" },
    logout: { texto: "Logout", icone: "log-out", grupo: "acesso" },
    sessao_expirada: { texto: "Sessão expirada por inatividade", icone: "timer-off", grupo: "acesso" },
    mfa_ativado: { texto: "Verificação em duas etapas ativada", icone: "shield-check", grupo: "acesso" },
    barbearia_cadastrada: { texto: "Barbearia cadastrada", icone: "store", grupo: "operacao" },
    barbearia_editada: { texto: "Barbearia editada", icone: "pencil", grupo: "operacao" },
    barbearia_status: { texto: "Status de barbearia alterado", icone: "toggle-right", grupo: "operacao" },
    membro_vinculado: { texto: "Acesso ao painel vinculado", icone: "user-plus", grupo: "operacao" },
    membro_reativado: { texto: "Acesso ao painel reativado", icone: "user-check", grupo: "operacao" },
    membro_desativado: { texto: "Acesso ao painel desativado", icone: "user-x", grupo: "operacao" }
};

const STATUS = { teste: "Em teste", ativa: "Ativa", suspensa: "Suspensa", cancelada: "Cancelada" };
const PAPEIS = { proprietario: "Proprietário", gerente: "Gerente" };

export function rotuloAcao(acao) {
    return ACOES_AUDITORIA[acao] ?? { texto: acao ?? "—", icone: "dot", grupo: "outro" };
}

// Resumo de uma linha dos detalhes de um evento (sem exibir dados técnicos crus).
export function resumoDetalhes(evento) {
    const d = evento?.detalhes ?? {};
    const partes = [];
    if (d.nome) partes.push(d.nome);
    if (d.slug && !d.nome) partes.push(`?b=${d.slug}`);
    if (d.anterior && d.novo) partes.push(`${STATUS[d.anterior] ?? d.anterior} → ${STATUS[d.novo] ?? d.novo}`);
    if (d.motivo) partes.push(`motivo: ${d.motivo}`);
    if (d.papel) partes.push(PAPEIS[d.papel] ?? d.papel);
    if (d.origem && !partes.length) partes.push(`origem: ${d.origem}`);
    return partes.join(" · ");
}
