// =====================================================================
// MODO DEMONSTRAÇÃO — somente para visualizar a interface localmente.
// * Só ativa com ?demo na URL E em localhost/127.0.0.1.
// * Não faz login e não acessa o banco: todos os números são FICTÍCIOS.
// * Não oferece risco: os dados reais exigem administrador + MFA no
//   servidor, independentemente do que o navegador faça.
// =====================================================================
const HOSTS_LOCAIS = ["localhost", "127.0.0.1", "[::1]"];

export const DEMO_DISPONIVEL = HOSTS_LOCAIS.includes(window.location.hostname);

export const MODO_DEMO = DEMO_DISPONIVEL && new URLSearchParams(window.location.search).has("demo");

export const CONTEXTO_DEMO = Object.freeze({
    sessao: null,
    usuario: { email: "demonstracao@local" },
    acesso: { admin: true, mfa: true },
    demo: true
});

function minutosAtras(min) {
    return new Date(Date.now() - min * 60000).toISOString();
}

// Usa os mesmos dados locais dos módulos demonstrativos (02–05),
// para que os números sejam coerentes entre as telas.
export async function visaoGeralDemo() {
    const S = await import("../services/demo/saas.js");
    const lista = S.barbearias();
    const contar = (st) => lista.filter((b) => b.status === st).length;
    const usuarios = S.usuarios();
    const agendamentosMes = lista.reduce((s, b) => s + (b.atividade?.agendamentosPorMes?.at(-1)?.total ?? 0), 0);
    const resumo = {
        plataforma: {
            total: lista.length, ativas: contar("ativa"), teste: contar("teste"), suspensas: contar("suspensa"),
            canceladas: contar("cancelada"), proprietarios: usuarios.filter((u) => u.tipo === "proprietario").length
        },
        barber: {
            barbeiros: usuarios.filter((u) => u.tipo === "barbeiro").length,
            clientes: usuarios.filter((u) => u.tipo === "cliente").length,
            agendamentos_mes: agendamentosMes,
            cancelamentos_mes: Math.round(agendamentosMes * 0.04)
        },
        gerado_em: new Date().toISOString()
    };
    const atividades = [
        { id: 4, ocorrido_em: minutosAtras(2), ator_email: "demonstracao@local", acao: "login", ip: "127.0.0.1" },
        { id: 3, ocorrido_em: minutosAtras(95), ator_email: "demonstracao@local", acao: "logout", ip: "127.0.0.1" },
        { id: 2, ocorrido_em: minutosAtras(180), ator_email: "demonstracao@local", acao: "sessao_expirada", ip: null },
        { id: 1, ocorrido_em: minutosAtras(1440), ator_email: "demonstracao@local", acao: "mfa_ativado", ip: "127.0.0.1" }
    ];
    return {
        resumo: { status: "fulfilled", value: resumo },
        atividades: { status: "fulfilled", value: atividades },
        servidor: { status: "fulfilled", value: { ok: true, versao: "demonstração" } },
        latenciaMs: 0,
        demo: true
    };
}
