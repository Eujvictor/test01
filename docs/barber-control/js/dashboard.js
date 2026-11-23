// =====================================================================
// Serviço de dados da Visão Geral.
// Cada fonte é carregada de forma independente: uma falha não esconde
// as demais, e cada card mostra seu próprio estado.
// =====================================================================
import { rpc } from "../services/control-api.js";
import { statusServidor } from "./auth.js";
import { MODO_DEMO, visaoGeralDemo } from "./demo.js";

export async function carregarVisaoGeral() {
    if (MODO_DEMO) return await visaoGeralDemo();

    const inicio = performance.now();
    const [resumo, atividades, servidor, financeiro, suporte] = await Promise.allSettled([
        rpc("painel_resumo"),
        rpc("listar_auditoria", { p_limite: 8 }),
        statusServidor(),
        rpc("financeiro_resumo", { p_meses: 1 }),
        rpc("suporte_resumo")
    ]);
    return {
        resumo,
        atividades,
        servidor,
        financeiro,
        suporte,
        latenciaMs: Math.round(performance.now() - inicio)
    };
}
