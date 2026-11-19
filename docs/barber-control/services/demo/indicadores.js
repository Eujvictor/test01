// =====================================================================
// INDICADORES CENTRAIS (módulos 17 e 18)
// Fonte única dos números de relatórios e inteligência. Tudo é calculado
// a partir dos registros já existentes dos módulos 02–16 (barbearias,
// assinaturas, transações, despesas, usuários, agendamentos, chamados,
// funcionalidades). Nenhum dado novo é inventado aqui.
//
// Convenções:
// - Meses são chaves "AAAA-MM".
// - "Base" = barbearias cadastradas até o fim do mês e não canceladas.
// - Filtros de status e plano usam a situação ATUAL de cada barbearia
//   (o histórico de mudanças de plano não é versionado nos dados demo).
// - Valor ausente = null (nunca zero inventado).
// =====================================================================
import * as S from "./saas.js";
import * as O from "./operacao.js";
import * as E from "./evolucao.js";
import * as I from "./infra.js";
import { geracaoDados, listar } from "./store.js";

const DIA = 86400000;

export const PERIODOS_RELATORIO = {
    "3m": "Últimos 3 meses",
    "6m": "Últimos 6 meses",
    "12m": "Últimos 12 meses",
    ano: "Ano atual",
    tudo: "Todo o histórico"
};

// ---------------------------------------------------------------------
// Meses e períodos
// ---------------------------------------------------------------------
export const chaveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const inicioDoMes = (k) => { const [a, m] = k.split("-").map(Number); return new Date(a, m - 1, 1); };
export const fimDoMes = (k) => { const [a, m] = k.split("-").map(Number); return new Date(a, m, 0, 23, 59, 59, 999); };

// Para "tudo", começa no cadastro mais antigo (não nas transações).
export function mesesDoPeriodo(periodo, agora = new Date()) {
    if (periodo !== "tudo") return S.mesesDoPeriodo(periodo, agora);
    const datas = S.barbearias().map((b) => b.criadoEm).sort();
    const inicio = datas.length ? new Date(datas[0]) : agora;
    const meses = [];
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    while (cursor <= agora && meses.length < 36) {
        meses.push(chaveMes(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return meses;
}

// Mesmo número de meses imediatamente antes (para comparação).
export function mesesAnteriores(meses) {
    if (!meses.length) return [];
    const inicio = inicioDoMes(meses[0]);
    return meses.map((_, i) => chaveMes(new Date(inicio.getFullYear(), inicio.getMonth() - meses.length + i, 1)));
}

export function descreverMeses(meses) {
    if (!meses.length) return "—";
    const fmt = (k) => new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(inicioDoMes(k)).replace(".", "");
    return meses.length === 1 ? fmt(meses[0]) : `${fmt(meses[0])} a ${fmt(meses.at(-1))}`;
}

// ---------------------------------------------------------------------
// Escopo (filtros de barbearia, plano e status)
// ---------------------------------------------------------------------
export function barbeariasNoEscopo(escopo = {}) {
    return S.barbearias().filter((b) =>
        (!escopo.barbeariaId || b.id === escopo.barbeariaId) &&
        (!escopo.status || b.status === escopo.status) &&
        (!escopo.planoId || S.assinaturaDaBarbearia(b.id)?.planoId === escopo.planoId));
}

export function descreverEscopo(escopo = {}) {
    const partes = [];
    if (escopo.barbeariaId) partes.push(`Barbearia: ${S.barbearia(escopo.barbeariaId)?.nome ?? escopo.barbeariaId}`);
    if (escopo.planoId) partes.push(`Plano: ${S.plano(escopo.planoId)?.nome ?? escopo.planoId}`);
    if (escopo.status) partes.push(`Status atual: ${escopo.status}`);
    return partes.length ? partes.join(" · ") : "Todas as barbearias";
}

const conjunto = (lista) => new Set(lista.map((b) => b.id));

// ---------------------------------------------------------------------
// Barbearias por mês (base, novas, canceladas)
// ---------------------------------------------------------------------
function canceladaEm(b) {
    const a = S.assinaturaDaBarbearia(b.id);
    if (a?.canceladaEm) return new Date(a.canceladaEm);
    return b.status === "cancelada" ? new Date(b.atualizadoEm) : null;
}

const naBaseEm = (b, data) => new Date(b.criadoEm) <= data && !(canceladaEm(b) && canceladaEm(b) <= data);

export function baseEm(lista, data) {
    return lista.filter((b) => naBaseEm(b, data)).length;
}

export function serieEmpresas(meses, escopo = {}) {
    const lista = barbeariasNoEscopo(escopo);
    return meses.map((k) => {
        const ini = inicioDoMes(k);
        const fim = fimDoMes(k);
        const novas = lista.filter((b) => { const d = new Date(b.criadoEm); return d >= ini && d <= fim; }).length;
        const canceladas = lista.filter((b) => { const d = canceladaEm(b); return d && d >= ini && d <= fim; }).length;
        const baseInicio = baseEm(lista, new Date(ini.getTime() - 1));
        const baseFim = baseEm(lista, fim);
        return { mes: k, novas, canceladas, baseInicio, base: baseFim, churn: baseInicio ? canceladas / baseInicio : null };
    });
}

// ---------------------------------------------------------------------
// Assinaturas e receita
// ---------------------------------------------------------------------
function assinaturasNoEscopo(escopo) {
    const ids = conjunto(barbeariasNoEscopo(escopo));
    return S.assinaturas().filter((a) => ids.has(a.barbeariaId));
}

// Pagante no fim do mês: já saiu do teste e não estava cancelada.
function paganteEm(a, data) {
    const p = S.plano(a.planoId);
    const fimTeste = new Date(new Date(a.inicio).getTime() + (p?.diasTeste ?? 0) * DIA);
    if (fimTeste > data) return false;
    return !(a.canceladaEm && new Date(a.canceladaEm) <= data);
}

// MRR estimado por mês (usa o valor atual de cada assinatura).
export function serieMrr(meses, escopo = {}) {
    const lista = assinaturasNoEscopo(escopo);
    return meses.map((k) => {
        const fim = fimDoMes(k);
        const pagantes = lista.filter((a) => paganteEm(a, fim));
        return { mes: k, valor: pagantes.reduce((s, a) => s + S.valorMensalEquivalente(a), 0), pagantes: pagantes.length };
    });
}

// MRR atual: mesma definição do módulo 04 (assinaturas com status "ativa").
export function mrrAtual(escopo = {}) {
    return assinaturasNoEscopo(escopo).filter((a) => a.status === "ativa").reduce((s, a) => s + S.valorMensalEquivalente(a), 0);
}

export function serieReceita(meses, escopo = {}) {
    const ids = conjunto(barbeariasNoEscopo(escopo));
    const tx = S.transacoes().filter((t) => ids.has(t.barbeariaId));
    const despesas = escopo.barbeariaId || escopo.planoId || escopo.status ? null : S.despesas();
    return meses.map((k) => {
        const doMes = tx.filter((t) => t.vencimento.slice(0, 7) === k);
        const pagas = doMes.filter((t) => t.status === "pago");
        const bruta = pagas.reduce((s, t) => s + t.valorBruto, 0);
        const taxas = pagas.reduce((s, t) => s + t.taxa, 0);
        const atrasado = doMes.filter((t) => t.status === "atrasado").reduce((s, t) => s + t.valorBruto, 0);
        const cobrado = doMes.filter((t) => t.status !== "estornado").reduce((s, t) => s + t.valorBruto, 0);
        const desp = despesas ? despesas.filter((d) => d.data.slice(0, 7) === k).reduce((s, d) => s + d.valor, 0) : null;
        return {
            mes: k, bruta, taxas, liquida: bruta - taxas, pagamentos: pagas.length,
            ticket: pagas.length ? bruta / pagas.length : null,
            inadimplencia: cobrado ? atrasado / cobrado : null,
            despesas: desp, resultado: desp === null ? null : bruta - taxas - desp
        };
    });
}

export function distribuicaoPlanos(escopo = {}) {
    const lista = barbeariasNoEscopo(escopo).filter((b) => b.status !== "cancelada");
    const contagem = new Map();
    lista.forEach((b) => {
        const a = S.assinaturaDaBarbearia(b.id);
        if (!a) return;
        contagem.set(a.planoId, (contagem.get(a.planoId) ?? 0) + 1);
    });
    const total = lista.length;
    return S.planos()
        .map((p) => ({ planoId: p.id, rotulo: p.nome, valor: contagem.get(p.id) ?? 0, participacao: total ? (contagem.get(p.id) ?? 0) / total : 0 }))
        .filter((x) => x.valor > 0)
        .sort((a, b) => b.valor - a.valor);
}

export function assinaturasPorPlano(escopo = {}) {
    const lista = assinaturasNoEscopo(escopo);
    return S.planos().map((p) => {
        const doPlano = lista.filter((a) => a.planoId === p.id);
        const cont = (st) => doPlano.filter((a) => a.status === st).length;
        return {
            planoId: p.id, plano: p.nome, ativas: cont("ativa"), teste: cont("teste"), vencidas: cont("vencida"), canceladas: cont("cancelada"),
            mrr: doPlano.filter((a) => a.status === "ativa").reduce((s, a) => s + S.valorMensalEquivalente(a), 0),
            total: doPlano.length
        };
    }).filter((x) => x.total > 0);
}

// ---------------------------------------------------------------------
// Agendamentos (registros de até 180 dias atrás, módulo 06)
// ---------------------------------------------------------------------
let memoAg = { chave: "", porMes: new Map(), inicio: null, ultimos: new Map(), anteriores: new Map() };

function indiceAgendamentos() {
    const hoje = new Date().toISOString().slice(0, 10);
    const chave = `${geracaoDados()}|${hoje}`;
    if (memoAg.chave === chave) return memoAg;
    const porMes = new Map();           // "AAAA-MM|barbeariaId" → {total, realizados, cancelados}
    const ultimos = new Map();          // barbeariaId → agendamentos nos últimos 30 dias
    const anteriores = new Map();       // barbeariaId → agendamentos 31–60 dias atrás
    let inicio = null;
    const limite30 = new Date(Date.now() - 30 * DIA).toISOString().slice(0, 10);
    const limite60 = new Date(Date.now() - 60 * DIA).toISOString().slice(0, 10);
    O.agendamentos().forEach((a) => {
        if (a.data > hoje) return; // agenda futura não conta como atividade realizada
        if (!inicio || a.data < inicio) inicio = a.data;
        const k = `${a.data.slice(0, 7)}|${a.barbeariaId}`;
        const reg = porMes.get(k) ?? { total: 0, realizados: 0, cancelados: 0 };
        reg.total++;
        if (a.status === "realizado") reg.realizados++;
        if (a.status === "cancelado") reg.cancelados++;
        porMes.set(k, reg);
        if (a.data > limite30) ultimos.set(a.barbeariaId, (ultimos.get(a.barbeariaId) ?? 0) + 1);
        else if (a.data > limite60) anteriores.set(a.barbeariaId, (anteriores.get(a.barbeariaId) ?? 0) + 1);
    });
    memoAg = { chave, porMes, inicio, ultimos, anteriores };
    return memoAg;
}

// Primeiro dia com registros de agendamento (antes disso: sem dados).
export const inicioDosAgendamentos = () => indiceAgendamentos().inicio;

export function serieAgendamentos(meses, escopo = {}) {
    const { porMes, inicio } = indiceAgendamentos();
    const lista = barbeariasNoEscopo(escopo);
    return meses.map((k) => {
        if (!inicio || k < inicio.slice(0, 7)) return { mes: k, total: null, realizados: null, cancelados: null, empresasAtivas: null, parcial: false };
        let total = 0, realizados = 0, cancelados = 0, empresasAtivas = 0;
        lista.forEach((b) => {
            const r = porMes.get(`${k}|${b.id}`);
            if (!r) return;
            total += r.total; realizados += r.realizados; cancelados += r.cancelados;
            if (r.total > 0) empresasAtivas++;
        });
        return { mes: k, total, realizados, cancelados, empresasAtivas, parcial: k === inicio.slice(0, 7) && inicio.slice(8) !== "01" };
    });
}

export const agendamentosUltimos30 = (barbeariaId) => indiceAgendamentos().ultimos.get(barbeariaId) ?? 0;
export const agendamentos31a60 = (barbeariaId) => indiceAgendamentos().anteriores.get(barbeariaId) ?? 0;

export function rankingAtividade(escopo = {}, limite = 10) {
    return barbeariasNoEscopo(escopo)
        .filter((b) => b.status !== "cancelada")
        .map((b) => ({ barbearia: b, ag30: agendamentosUltimos30(b.id), anterior: agendamentos31a60(b.id) }))
        .sort((a, b) => b.ag30 - a.ag30)
        .slice(0, limite);
}

// ---------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------
export function serieUsuarios(meses, escopo = {}) {
    const ids = conjunto(barbeariasNoEscopo(escopo));
    const lista = S.usuarios().filter((u) => ids.has(u.barbeariaId));
    return meses.map((k) => {
        const ini = inicioDoMes(k);
        const fim = fimDoMes(k);
        return {
            mes: k,
            novos: lista.filter((u) => { const d = new Date(u.criadoEm); return d >= ini && d <= fim; }).length,
            total: lista.filter((u) => new Date(u.criadoEm) <= fim).length
        };
    });
}

export function totalUsuarios(escopo = {}) {
    const ids = conjunto(barbeariasNoEscopo(escopo));
    return S.usuarios().filter((u) => ids.has(u.barbeariaId)).length;
}

// ---------------------------------------------------------------------
// Utilização (acesso às funcionalidades e uso do limite do plano)
// Não existe medição de uso por funcionalidade nos dados demonstrativos:
// "acesso liberado" indica direito de uso, não uso efetivo.
// ---------------------------------------------------------------------
export function acessoFuncionalidades(escopo = {}) {
    const base = barbeariasNoEscopo(escopo).filter((b) => b.status === "ativa" || b.status === "teste");
    return E.funcionalidades()
        .filter((f) => f.status !== "descontinuada" && f.status !== "planejada")
        .map((f) => {
            const comAcesso = base.filter((b) => E.acessoEfetivo(b.id, f.chave).liberado).length;
            return { chave: f.chave, rotulo: f.nome, categoria: f.categoria, valor: comAcesso, cobertura: base.length ? comAcesso / base.length : null, base: base.length };
        })
        .sort((a, b) => b.valor - a.valor);
}

export function utilizacaoDosPlanos(escopo = {}) {
    const ids = conjunto(barbeariasNoEscopo(escopo));
    const metricas = S.barbearias().filter((b) => ids.has(b.id) && (b.status === "ativa" || b.status === "teste")).map(O.metricasBarbearia);
    const cont = (nivel) => metricas.filter((m) => m.nivelUtilizacao === nivel).length;
    return { alta: cont("alta"), media: cont("media"), baixa: cont("baixa"), ilimitado: cont("ilimitado"), total: metricas.length, metricas };
}

// ---------------------------------------------------------------------
// Operação (suporte e monitoramento)
// ---------------------------------------------------------------------
export function serieSuporte(meses, escopo = {}) {
    const filtrar = escopo.barbeariaId || escopo.planoId || escopo.status;
    const ids = conjunto(barbeariasNoEscopo(escopo));
    const lista = O.chamados().filter((c) => !filtrar || ids.has(c.barbeariaId));
    return meses.map((k) => {
        const abertos = lista.filter((c) => c.abertoEm.slice(0, 7) === k);
        const resolvidos = lista.filter((c) => c.resolvidoEm && c.resolvidoEm.slice(0, 7) === k);
        const horas = resolvidos.map((c) => (new Date(c.resolvidoEm) - new Date(c.abertoEm)) / 3600000);
        return { mes: k, abertos: abertos.length, resolvidos: resolvidos.length, tempoMedioHoras: horas.length ? horas.reduce((s, h) => s + h, 0) / horas.length : null };
    });
}

export function serieIncidentesTecnicos(meses) {
    const lista = I.incidentes("tecnico");
    return meses.map((k) => ({ mes: k, valor: lista.filter((i) => (i.abertoEm ?? i.criadoEm ?? "").slice(0, 7) === k).length }));
}

export const monitoramento30 = () => I.resumoMonitoramento(30);

// ---------------------------------------------------------------------
// Resumo do período com comparação ao período anterior
// ---------------------------------------------------------------------
const soma = (serie, campo) => {
    const validos = serie.filter((x) => x[campo] !== null && x[campo] !== undefined);
    return validos.length ? validos.reduce((s, x) => s + x[campo], 0) : null;
};

function resumoMeses(meses, escopo) {
    const empresas = serieEmpresas(meses, escopo);
    const receita = serieReceita(meses, escopo);
    const mrr = serieMrr(meses, escopo);
    const ag = serieAgendamentos(meses, escopo);
    const usuarios = serieUsuarios(meses, escopo);
    const baseInicio = empresas[0]?.baseInicio ?? 0;
    const baseFim = empresas.at(-1)?.base ?? 0;
    const cancelamentos = soma(empresas, "canceladas") ?? 0;
    const novas = soma(empresas, "novas") ?? 0;
    const churn = baseInicio ? cancelamentos / baseInicio : null;
    return {
        meses,
        totalCadastradas: barbeariasNoEscopo(escopo).filter((b) => new Date(b.criadoEm) <= fimDoMes(meses.at(-1))).length,
        baseInicio, baseFim, novas, cancelamentos,
        crescimento: baseInicio ? (baseFim - baseInicio) / baseInicio : null,
        churn, retencao: churn === null ? null : 1 - churn,
        receita: soma(receita, "bruta"), receitaLiquida: soma(receita, "liquida"),
        despesas: soma(receita, "despesas"), resultado: soma(receita, "resultado"),
        mrrFim: mrr.at(-1)?.valor ?? 0,
        agendamentos: soma(ag, "total"),
        agendamentosCompletos: ag.every((x) => x.total !== null),
        usuariosNovos: soma(usuarios, "novos") ?? 0,
        usuariosTotal: usuarios.at(-1)?.total ?? 0
    };
}

export function resumoComparado(periodo, escopo = {}) {
    const meses = mesesDoPeriodo(periodo);
    const anteriores = mesesAnteriores(meses);
    return { atual: resumoMeses(meses, escopo), anterior: resumoMeses(anteriores, escopo) };
}

export function variacao(atual, anterior) {
    if (atual === null || anterior === null || atual === undefined || anterior === undefined) return null;
    if (anterior === 0) return atual === 0 ? 0 : null;
    return (atual - anterior) / Math.abs(anterior);
}

// Painel do módulo 17: indicadores atuais + comparação.
export function painelIndicadores(periodo, escopo = {}) {
    const { atual, anterior } = resumoComparado(periodo, escopo);
    const lista = barbeariasNoEscopo(escopo);
    const mrr = mrrAtual(escopo);
    return {
        atual, anterior,
        totalBarbearias: lista.length,
        ativas: lista.filter((b) => b.status === "ativa").length,
        emTeste: lista.filter((b) => b.status === "teste").length,
        totalUsuarios: totalUsuarios(escopo),
        mrr, arr: mrr * 12,
        distribuicao: distribuicaoPlanos(escopo)
    };
}

// ---------------------------------------------------------------------
// Tendência e projeção (regressão linear simples)
// ---------------------------------------------------------------------
export function regressao(valores) {
    const pontos = valores.map((v, i) => [i, v]).filter(([, v]) => v !== null && v !== undefined && Number.isFinite(v));
    const n = pontos.length;
    if (n < 2) return null;
    const mx = pontos.reduce((s, [x]) => s + x, 0) / n;
    const my = pontos.reduce((s, [, y]) => s + y, 0) / n;
    const sxx = pontos.reduce((s, [x]) => s + (x - mx) ** 2, 0);
    const sxy = pontos.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
    const inclinacao = sxx ? sxy / sxx : 0;
    const intercepto = my - inclinacao * mx;
    const residuos = pontos.map(([x, y]) => y - (intercepto + inclinacao * x));
    const sqr = residuos.reduce((s, r) => s + r * r, 0);
    const sqt = pontos.reduce((s, [, y]) => s + (y - my) ** 2, 0);
    return {
        n, inclinacao, intercepto, media: my,
        r2: sqt ? 1 - sqr / sqt : 1,
        desvio: n > 2 ? Math.sqrt(sqr / (n - 2)) : 0,
        prever: (x) => intercepto + inclinacao * x
    };
}

export function tendencia(valores) {
    const r = regressao(valores);
    if (!r || r.n < 3) return { direcao: "insuficiente", texto: "Dados insuficientes para indicar tendência (menos de 3 meses com registros)." };
    const relativa = r.media ? r.inclinacao / Math.abs(r.media) : 0;
    const direcao = relativa > 0.02 ? "alta" : relativa < -0.02 ? "queda" : "estavel";
    const texto = { alta: "Tendência de alta", queda: "Tendência de queda", estavel: "Estável" }[direcao];
    return { direcao, texto: `${texto} (${relativa >= 0 ? "+" : ""}${(relativa * 100).toFixed(1).replace(".", ",")}% ao mês em média, ${r.n} meses).`, relativa, r };
}

// Projeção demonstrativa: últimos até 12 meses → próximos "horizonte" meses.
export function projetar(serie, horizonte = 6, { minimo = 0, inteiro = false } = {}) {
    const historico = serie.filter((p) => p.valor !== null && p.valor !== undefined).slice(-12);
    if (historico.length < 4) return { suficiente: false, historico, motivo: `São necessários pelo menos 4 meses com registros; há ${historico.length}.` };
    const r = regressao(historico.map((p) => p.valor));
    const ultimo = inicioDoMes(historico.at(-1).mes);
    const ajustar = (v) => { const x = Math.max(minimo, v); return inteiro ? Math.round(x) : x; };
    const futuros = Array.from({ length: horizonte }, (_, i) => {
        const x = historico.length + i;
        const previsto = r.prever(x);
        const margem = r.desvio * 1.28; // ~80% se os resíduos forem aproximadamente normais
        return {
            mes: chaveMes(new Date(ultimo.getFullYear(), ultimo.getMonth() + i + 1, 1)),
            valor: ajustar(previsto), minimo: ajustar(previsto - margem), maximo: ajustar(previsto + margem)
        };
    });
    return {
        suficiente: true, historico, futuros, r2: r.r2, inclinacao: r.inclinacao, mesesUsados: historico.length,
        ajusteFraco: r.r2 < 0.3,
        criterio: `Regressão linear simples sobre ${historico.length} meses (${descreverMeses(historico.map((h) => h.mes))}). Faixa = ±1,28 × desvio dos resíduos (≈80%). R² = ${r.r2.toFixed(2).replace(".", ",")}.` +
            (r.r2 < 0.3 ? " Ajuste fraco: a reta explica pouco da variação mensal (ex.: picos de anuidades); use apenas como referência geral." : "")
    };
}

// ---------------------------------------------------------------------
// Risco de cancelamento (critérios explícitos e somáveis)
// ---------------------------------------------------------------------
export const CRITERIOS_RISCO = [
    { id: "queda", pontos: 30, rotulo: "Queda de 40% ou mais nos agendamentos (30 dias vs 30 dias anteriores)" },
    { id: "vencida", pontos: 30, rotulo: "Assinatura vencida (pagamento em atraso)" },
    { id: "suspensa", pontos: 25, rotulo: "Barbearia suspensa" },
    { id: "sem_acesso", pontos: 15, rotulo: "Proprietário sem acesso há mais de 14 dias" },
    { id: "chamado", pontos: 10, rotulo: "Chamado de prioridade alta/crítica em aberto" },
    { id: "baixa_atividade", pontos: 10, rotulo: "Menos de 40 agendamentos nos últimos 30 dias" }
];

export function riscoDaBarbearia(b) {
    const motivos = [];
    const ag = agendamentosUltimos30(b.id);
    const ant = agendamentos31a60(b.id);
    if (ant >= 10 && ag <= ant * 0.6) motivos.push("queda");
    const a = S.assinaturaDaBarbearia(b.id);
    if (a?.status === "vencida") motivos.push("vencida");
    if (b.status === "suspensa") motivos.push("suspensa");
    const dono = S.proprietarioDa(b.id);
    if (dono && Date.now() - new Date(dono.ultimoAcesso) > 14 * DIA) motivos.push("sem_acesso");
    if (O.chamados().some((c) => c.barbeariaId === b.id && ["alta", "critica"].includes(c.prioridade) && !["resolvido", "encerrado"].includes(c.status))) motivos.push("chamado");
    if (b.status !== "suspensa" && ag < 40) motivos.push("baixa_atividade");
    const pontos = CRITERIOS_RISCO.filter((c) => motivos.includes(c.id)).reduce((s, c) => s + c.pontos, 0);
    return {
        barbearia: b, pontos, motivos, ag30: ag, anterior: ant,
        nivel: pontos >= 50 ? "alto" : pontos >= 30 ? "medio" : "baixo",
        mrrEmRisco: a && a.status !== "cancelada" && a.status !== "teste" ? S.valorMensalEquivalente(a) : 0
    };
}

export function barbeariasEmRisco(escopo = {}) {
    return barbeariasNoEscopo(escopo)
        .filter((b) => b.status === "ativa" || b.status === "suspensa")
        .map(riscoDaBarbearia)
        .filter((r) => r.nivel !== "baixo")
        .sort((a, b) => b.pontos - a.pontos || b.mrrEmRisco - a.mrrEmRisco);
}

// ---------------------------------------------------------------------
// Rentabilidade estimada (plataforma inteira; despesas não têm rateio)
// ---------------------------------------------------------------------
export function rentabilidade(periodo) {
    const meses = mesesDoPeriodo(periodo);
    const serie = serieReceita(meses);
    const bruta = soma(serie, "bruta") ?? 0;
    const taxas = soma(serie, "taxas") ?? 0;
    const despesas = soma(serie, "despesas") ?? 0;
    const resultado = bruta - taxas - despesas;
    return { meses, bruta, taxas, despesas, resultado, margem: bruta ? resultado / bruta : null, serie };
}

// Desempenho por plano: base, MRR, cancelamentos no período e retenção.
export function desempenhoPlanos(periodo) {
    const meses = mesesDoPeriodo(periodo);
    const ini = inicioDoMes(meses[0]);
    const fim = fimDoMes(meses.at(-1));
    return S.planos().map((p) => {
        const lista = barbeariasNoEscopo({ planoId: p.id });
        const baseInicio = baseEm(lista, new Date(ini.getTime() - 1));
        const canceladas = lista.filter((b) => { const d = canceladaEm(b); return d && d >= ini && d <= fim; }).length;
        const novas = lista.filter((b) => { const d = new Date(b.criadoEm); return d >= ini && d <= fim; }).length;
        return {
            planoId: p.id, plano: p.nome, base: baseEm(lista, fim), baseInicio, novas, canceladas,
            retencao: baseInicio ? 1 - canceladas / baseInicio : null,
            mrr: mrrAtual({ planoId: p.id }), preco: p.precoMensal
        };
    }).filter((x) => x.base > 0 || x.canceladas > 0);
}

export { listar };
