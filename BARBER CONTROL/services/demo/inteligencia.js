// =====================================================================
// INTELIGÊNCIA DE NEGÓCIO (módulo 18)
// Recomendações e análises por REGRAS EXPLÍCITAS sobre os indicadores
// de indicadores.js. Não há modelo de IA nem serviço externo: cada
// recomendação mostra o indicador, o valor e a justificativa usados.
// O estado (concluída/descartada) fica no localStorage.
// =====================================================================
import * as K from "./indicadores.js";
import * as S from "./saas.js";
import * as O from "./operacao.js";
import { obterConfig, salvarConfig, registrarHistorico } from "./store.js";

const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const hoje = () => new Date().toISOString();

// ---------------------------------------------------------------------
// Regras de recomendação
// ---------------------------------------------------------------------
const REGRAS = [
    {
        id: "baixa-atividade",
        avaliar() {
            const lista = S.barbearias().filter((b) => b.status === "ativa").map(O.metricasBarbearia).filter((m) => m.nivelAtividade === "baixa" || m.nivelAtividade === "sem");
            if (!lista.length) return null;
            const mrr = lista.reduce((s, m) => s + (m.assinatura?.status === "ativa" ? S.valorMensalEquivalente(m.assinatura) : 0), 0);
            return {
                titulo: `${lista.length} ${lista.length === 1 ? "barbearia ativa com baixa atividade" : "barbearias ativas com baixa atividade"}`,
                descricao: "Empresas pagantes que quase não usam a agenda tendem a cancelar. Um contato de reativação pode evitar a perda.",
                indicador: "Agendamentos nos últimos 30 dias (módulo 06)",
                valor: `${lista.length} empresas com menos de 40 agendamentos`,
                justificativa: `Nível de atividade "baixa" (1–39) ou "sem atividade" (0) nos últimos 30 dias: ${lista.slice(0, 5).map((m) => m.barbearia.nome).join(", ")}${lista.length > 5 ? "…" : ""}.`,
                impacto: lista.length >= 3 ? "alto" : "medio",
                impactoTexto: `${fmtMoeda.format(mrr)} de MRR nessas empresas`,
                acao: "Criar uma campanha de reativação para o segmento de baixa atividade.",
                link: "#/marketing", rotuloLink: "Abrir campanhas"
            };
        }
    },
    {
        id: "upgrade",
        avaliar() {
            const lista = S.barbearias().filter((b) => b.status === "ativa").map(O.metricasBarbearia).filter((m) => m.utilizacao !== null && m.utilizacao >= 0.8);
            if (!lista.length) return null;
            return {
                titulo: `Oportunidade de upgrade em ${lista.length} ${lista.length === 1 ? "barbearia" : "barbearias"}`,
                descricao: "Estas empresas usam 80% ou mais do limite de agendamentos do plano atual.",
                indicador: "Uso do limite de agendamentos do plano (módulos 03 e 06)",
                valor: lista.map((m) => `${m.barbearia.nome} (${pct(m.utilizacao)})`).slice(0, 4).join(", "),
                justificativa: "Uso ≥ 80% do limite mensal indica que a empresa pode precisar de um plano maior em breve.",
                impacto: "medio",
                impactoTexto: "Aumento de receita recorrente por mudança de plano",
                acao: "Oferecer a mudança para o plano seguinte com condição especial.",
                link: "#/barbearias", rotuloLink: "Abrir barbearias"
            };
        }
    },
    {
        id: "aumento-cancelamentos",
        avaliar() {
            const meses = K.mesesDoPeriodo("6m");
            const serie = K.serieEmpresas(meses);
            const recentes = serie.slice(-3).reduce((s, x) => s + x.canceladas, 0);
            const antes = serie.slice(0, 3).reduce((s, x) => s + x.canceladas, 0);
            if (recentes <= antes || recentes === 0) return null;
            return {
                titulo: "Cancelamentos aumentaram nos últimos 3 meses",
                descricao: `Foram ${recentes} cancelamentos nos últimos 3 meses, contra ${antes} nos 3 meses anteriores.`,
                indicador: "Cancelamentos por mês (relatório de retenção)",
                valor: `${recentes} vs ${antes}`,
                justificativa: "Comparação direta de dois trimestres consecutivos da série de cancelamentos.",
                impacto: "alto",
                impactoTexto: "Perda de receita recorrente e da base de clientes",
                acao: "Revisar os motivos de cancelamento e contatar empresas em risco.",
                link: "#/relatorios/cancelamentos", rotuloLink: "Ver cancelamentos"
            };
        }
    },
    {
        id: "funcionalidades-pouco-liberadas",
        avaliar() {
            const lista = K.acessoFuncionalidades().filter((f) => f.cobertura !== null && f.cobertura < 0.3);
            if (!lista.length) return null;
            return {
                titulo: `${lista.length} ${lista.length === 1 ? "funcionalidade liberada" : "funcionalidades liberadas"} para menos de 30% da base`,
                descricao: "Funcionalidades com pouca cobertura podem estar mal posicionadas nos planos ou ser pouco conhecidas.",
                indicador: "Empresas com acesso por funcionalidade (módulo 14)",
                valor: lista.map((f) => `${f.rotulo} (${pct(f.cobertura)})`).join(", "),
                justificativa: "Cobertura = empresas ativas/em teste com acesso efetivo ÷ total. Acesso não é uso medido: não há telemetria de uso nos dados demonstrativos.",
                impacto: "baixo",
                impactoTexto: "Valor percebido dos planos",
                acao: "Avaliar incluir essas funcionalidades em mais planos ou divulgá-las.",
                link: "#/funcionalidades/planos", rotuloLink: "Abrir planos × funcionalidades"
            };
        }
    },
    {
        id: "plano-destaque",
        avaliar() {
            const lista = K.desempenhoPlanos("12m").filter((p) => p.baseInicio >= 3 && p.retencao !== null);
            if (lista.length < 2) return null;
            const melhor = lista.slice().sort((a, b) => b.retencao - a.retencao || b.mrr - a.mrr)[0];
            return {
                titulo: `Plano ${melhor.plano} tem a melhor retenção`,
                descricao: `Retenção de ${pct(melhor.retencao)} nos últimos 12 meses, com ${melhor.base} empresas na base.`,
                indicador: "Retenção por plano em 12 meses (módulos 02 e 03)",
                valor: lista.map((p) => `${p.plano}: ${pct(p.retencao)}`).join(" · "),
                justificativa: "Retenção = 1 − cancelamentos no período ÷ base no início (apenas planos com 3 ou mais empresas no início).",
                impacto: "medio",
                impactoTexto: "Direcionar aquisição para o plano mais estável",
                acao: `Destacar o plano ${melhor.plano} nas campanhas de aquisição.`,
                link: "#/assinaturas/planos", rotuloLink: "Abrir planos"
            };
        }
    },
    {
        id: "risco-cancelamento",
        avaliar() {
            const lista = K.barbeariasEmRisco();
            const altos = lista.filter((r) => r.nivel === "alto");
            if (!altos.length) return null;
            const mrr = altos.reduce((s, r) => s + r.mrrEmRisco, 0);
            return {
                titulo: `${altos.length} ${altos.length === 1 ? "barbearia com risco alto" : "barbearias com risco alto"} de cancelamento`,
                descricao: "Pontuação de risco igual ou acima de 50 pelos critérios do módulo 18.",
                indicador: "Pontuação de risco (critérios explícitos)",
                valor: altos.slice(0, 4).map((r) => `${r.barbearia.nome} (${r.pontos} pts)`).join(", "),
                justificativa: "Critérios: queda de agendamentos, assinatura vencida, suspensão, proprietário sem acesso, chamado prioritário aberto e baixa atividade.",
                impacto: "alto",
                impactoTexto: `${fmtMoeda.format(mrr)} de MRR em risco`,
                acao: "Fazer contato de retenção com cada empresa da lista.",
                link: "#/inteligencia/risco", rotuloLink: "Ver empresas em risco"
            };
        }
    },
    {
        id: "inadimplencia",
        avaliar() {
            const vencidas = S.assinaturas().filter((a) => a.status === "vencida");
            if (!vencidas.length) return null;
            const valor = vencidas.reduce((s, a) => s + S.valorMensalEquivalente(a), 0);
            return {
                titulo: `${vencidas.length} ${vencidas.length === 1 ? "assinatura vencida" : "assinaturas vencidas"}`,
                descricao: "Pagamentos em atraso aumentam o risco de suspensão e cancelamento.",
                indicador: "Assinaturas com status vencida (módulo 03)",
                valor: `${vencidas.length} assinaturas · ${fmtMoeda.format(valor)}/mês`,
                justificativa: "Contagem direta das assinaturas vencidas no momento.",
                impacto: vencidas.length >= 3 ? "alto" : "medio",
                impactoTexto: `${fmtMoeda.format(valor)} de receita mensal pendente`,
                acao: "Enviar lembrete de pagamento e oferecer renegociação.",
                link: "#/financeiro", rotuloLink: "Abrir financeiro"
            };
        }
    }
];

export const IMPACTOS = {
    alto: { rotulo: "Impacto alto", tom: "erro" },
    medio: { rotulo: "Impacto médio", tom: "atencao" },
    baixo: { rotulo: "Impacto baixo", tom: "neutro" }
};

export const STATUS_RECOMENDACAO = {
    ativa: { rotulo: "Ativa", tom: "ouro" },
    concluida: { rotulo: "Concluída", tom: "sucesso" },
    descartada: { rotulo: "Descartada", tom: "neutro" }
};

const estados = () => obterConfig("recomendacoes") ?? {};

// Avalia as regras com os dados de agora. Recomendações que deixaram de
// valer não aparecem; as que valem mantêm o estado salvo.
export function recomendacoes() {
    const salvo = estados();
    return REGRAS.map((regra) => {
        const r = regra.avaliar();
        if (!r) return null;
        const estado = salvo[regra.id] ?? {};
        return { id: regra.id, ...r, status: estado.status ?? "ativa", data: estado.data ?? hoje(), observacao: estado.observacao ?? "" };
    }).filter(Boolean);
}

export function alterarRecomendacao(id, status, observacao = "") {
    const regra = REGRAS.find((r) => r.id === id);
    if (!regra) throw new Error("Recomendação não encontrada.");
    const r = regra.avaliar();
    if (!r) throw new Error("Esta recomendação não se aplica mais aos dados atuais.");
    if (!STATUS_RECOMENDACAO[status]) throw new Error("Status inválido.");
    const novo = { ...estados(), [id]: { status, data: hoje(), observacao } };
    delete novo.atualizadoEm;
    salvarConfig("recomendacoes", novo);
    registrarHistorico({
        entidade: "recomendacao", entidadeId: id, acao: status,
        descricao: `Recomendação "${r.titulo}" marcada como ${STATUS_RECOMENDACAO[status].rotulo.toLowerCase()}${observacao ? `: ${observacao}` : ""}.`
    });
}

// ---------------------------------------------------------------------
// Análises (texto gerado a partir de números calculados)
// ---------------------------------------------------------------------
export function analises(periodo = "12m") {
    const meses = K.mesesDoPeriodo(periodo);
    const empresas = K.serieEmpresas(meses);
    const mrr = K.serieMrr(meses);
    const receita = K.serieReceita(meses);
    const uso = K.utilizacaoDosPlanos();
    const acesso = K.acessoFuncionalidades();
    const planos = K.desempenhoPlanos(periodo);
    const risco = K.barbeariasEmRisco();
    const ag = K.serieAgendamentos(meses).filter((x) => x.total !== null);
    const tB = K.tendencia(empresas.map((e) => e.base));
    const tM = K.tendencia(mrr.map((m) => m.valor));
    const tR = K.tendencia(receita.map((r) => r.bruta));
    const cancel = empresas.reduce((s, e) => s + e.canceladas, 0);
    const baseIni = empresas[0]?.baseInicio ?? 0;
    const churnMedio = (() => { const v = empresas.filter((e) => e.churn !== null); return v.length ? v.reduce((s, e) => s + e.churn, 0) / v.length : null; })();
    const melhorPlano = planos.slice().sort((a, b) => b.mrr - a.mrr)[0];
    const topAcesso = acesso[0];
    const menorAcesso = acesso.at(-1);
    const mediaAg = ag.length ? ag.reduce((s, x) => s + x.total, 0) / ag.length : null;
    const novas = empresas.reduce((s, e) => s + e.novas, 0);
    const emTeste = S.barbearias().filter((b) => b.status === "teste").length;

    return [
        { id: "crescimento", titulo: "Crescimento empresarial", icone: "trending-up", link: "#/relatorios/base-barbearias",
            numeros: [["Base no início", baseIni], ["Base no fim", empresas.at(-1)?.base ?? 0], ["Novas", novas]],
            leitura: `A base foi de ${baseIni} para ${empresas.at(-1)?.base ?? 0} barbearias. ${tB.texto}` },
        { id: "retencao", titulo: "Retenção", icone: "shield-check", link: "#/relatorios/retencao",
            numeros: [["Retenção no período", baseIni ? pct(1 - cancel / baseIni) : "—"], ["Cancelamentos", cancel]],
            leitura: baseIni ? `De cada 100 barbearias da base inicial, cerca de ${Math.round((1 - cancel / baseIni) * 100)} continuaram até o fim do período.` : "Sem base inicial suficiente para calcular a retenção." },
        { id: "churn", titulo: "Churn", icone: "trending-down", link: "#/relatorios/retencao",
            numeros: [["Churn mensal médio", churnMedio === null ? "—" : pct(churnMedio)], ["Cancelamentos", cancel]],
            leitura: churnMedio === null ? "Dados insuficientes para o churn mensal." : `Em média, ${pct(churnMedio)} da base cancela por mês. ${churnMedio > 0.03 ? "Acima de 3% ao mês, o que merece atenção." : "Dentro de um patamar considerado saudável (até 3% ao mês)."}` },
        { id: "receita", titulo: "Receita recorrente", icone: "repeat", link: "#/relatorios/crescimento",
            numeros: [["MRR atual", fmtMoeda.format(K.mrrAtual())], ["MRR estimado no início", fmtMoeda.format(mrr[0]?.valor ?? 0)]],
            leitura: `${tM.texto} Receita confirmada: ${tR.texto.toLowerCase()}` },
        { id: "planos", titulo: "Desempenho dos planos", icone: "badge-check", link: "#/relatorios/assinaturas",
            numeros: planos.map((p) => [p.plano, `${p.base} empresas · ${fmtMoeda.format(p.mrr)}`]),
            leitura: melhorPlano ? `O plano ${melhorPlano.plano} gera a maior receita recorrente (${fmtMoeda.format(melhorPlano.mrr)} por mês).` : "Sem planos com empresas." },
        { id: "recursos", titulo: "Utilização dos recursos", icone: "gauge", link: "#/relatorios/utilizacao",
            numeros: [["Uso alto do limite", uso.alta], ["Uso baixo do limite", uso.baixa], ["Plano sem limite", uso.ilimitado]],
            leitura: topAcesso ? `"${topAcesso.rotulo}" é a funcionalidade com mais empresas com acesso (${topAcesso.valor}); "${menorAcesso.rotulo}" a com menos (${menorAcesso.valor}). Não há medição de uso por funcionalidade.` : "Sem funcionalidades ativas." },
        { id: "comportamento", titulo: "Comportamento das barbearias", icone: "calendar-clock", link: "#/relatorios/atividade",
            numeros: [["Agendamentos por mês (média)", mediaAg === null ? "—" : Math.round(mediaAg).toLocaleString("pt-BR")], ["Em risco", risco.length]],
            leitura: mediaAg === null ? "Sem registros de agendamento no período." : `As barbearias fazem em média ${Math.round(mediaAg).toLocaleString("pt-BR")} agendamentos por mês no total (registros desde ${K.inicioDosAgendamentos()?.split("-").reverse().join("/")}). ${risco.length} empresas estão com risco médio ou alto.` },
        { id: "oportunidades", titulo: "Oportunidades de crescimento", icone: "lightbulb", link: "#/inteligencia/recomendacoes",
            numeros: [["Em teste agora", emTeste], ["Uso alto (candidatas a upgrade)", uso.alta]],
            leitura: `${emTeste} barbearias estão em teste e podem ser convertidas; ${uso.alta} usam 70% ou mais do limite do plano e são candidatas a upgrade.` }
    ];
}

// ---------------------------------------------------------------------
// Projeções demonstrativas
// ---------------------------------------------------------------------
export function projecoes(horizonte = 6) {
    const meses = K.mesesDoPeriodo("12m");
    const empresas = K.serieEmpresas(meses);
    const mrr = K.serieMrr(meses);
    const receita = K.serieReceita(meses);
    const churnSerie = empresas.map((e) => ({ mes: e.mes, valor: e.churn }));
    const validos = churnSerie.filter((c) => c.valor !== null);
    const churnMedio = validos.length ? validos.reduce((s, c) => s + c.valor, 0) / validos.length : null;
    const baseAtual = empresas.at(-1)?.base ?? 0;
    return {
        horizonte,
        itens: [
            { id: "barbearias", titulo: "Barbearias na base", formato: "numero", projecao: K.projetar(empresas.map((e) => ({ mes: e.mes, valor: e.base })), horizonte, { inteiro: true }) },
            { id: "receita", titulo: "Receita mensal confirmada", formato: "moeda", projecao: K.projetar(receita.map((r) => ({ mes: r.mes, valor: r.bruta })), horizonte) },
            { id: "assinaturas", titulo: "Assinaturas pagantes", formato: "numero", projecao: K.projetar(mrr.map((m) => ({ mes: m.mes, valor: m.pagantes })), horizonte, { inteiro: true }) },
            { id: "mrr", titulo: "MRR estimado", formato: "moeda", projecao: K.projetar(mrr.map((m) => ({ mes: m.mes, valor: m.valor })), horizonte) }
        ],
        cancelamentos: churnMedio === null ? { suficiente: false, motivo: "Sem meses com base para calcular o churn." } : {
            suficiente: true, churnMedio, meses: validos.length,
            estimativa: Math.round(baseAtual * churnMedio * horizonte * 10) / 10,
            criterio: `Churn mensal médio dos últimos ${validos.length} meses (${pct(churnMedio)}) × base atual (${baseAtual}) × ${horizonte} meses. Não considera novas entradas nem sazonalidade.`
        }
    };
}
