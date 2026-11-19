// =====================================================================
// ASSISTENTE ADMINISTRATIVO (módulo 18) — consultas LOCAIS
// Não existe conexão com inteligência artificial externa. O assistente
// reconhece um conjunto definido de perguntas por palavras-chave,
// consulta os dados demonstrativos e responde mostrando os indicadores
// usados. Fora desse conjunto, informa que não tem dados para responder.
// =====================================================================
import * as K from "./indicadores.js";
import * as S from "./saas.js";
import * as O from "./operacao.js";
import * as I from "./infra.js";

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = new Intl.NumberFormat("pt-BR");
const pct = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

// "último mês", "últimos 3 meses", "6 meses", "ano" → chave de período
function periodoDa(texto) {
    if (/(12|doze) meses|ultimo ano|ano passado/.test(texto)) return { chave: "12m", rotulo: "nos últimos 12 meses" };
    if (/(6|seis) meses|semestre/.test(texto)) return { chave: "6m", rotulo: "nos últimos 6 meses" };
    if (/este ano|ano atual|neste ano/.test(texto)) return { chave: "ano", rotulo: "no ano atual" };
    if (/(3|tres) meses|trimestre/.test(texto)) return { chave: "3m", rotulo: "nos últimos 3 meses" };
    if (/ultimo mes|mes passado|neste mes|este mes/.test(texto)) return { chave: "1m", rotulo: "no mês atual" };
    return null;
}

function mesesDe(periodo) {
    if (periodo.chave === "1m") return [K.chaveMes(new Date())];
    return K.mesesDoPeriodo(periodo.chave);
}

const resposta = (texto, indicadores = [], extra = {}) => ({ texto, indicadores, ...extra });

// Cada intenção: palavras que precisam aparecer (todas as listas) e a função que responde.
const INTENCOES = [
    {
        id: "ajuda", exemplos: ["O que você sabe responder?"],
        casa: (t) => /^(ajuda|help|\?)$|o que (voce )?(sabe|pode)|quais perguntas/.test(t),
        responder: () => resposta(`Respondo perguntas sobre os dados demonstrativos do Barber Control. Exemplos: ${EXEMPLOS.join(" · ")}`, [], { ajuda: true })
    },
    {
        id: "ativas", exemplos: ["Quantas barbearias estão ativas?"],
        casa: (t) => /ativ/.test(t) && /(barbearia|empresa|cliente)/.test(t) && !/mais ativ/.test(t),
        responder() {
            const lista = S.barbearias();
            const c = (st) => lista.filter((b) => b.status === st).length;
            return resposta(`Há ${c("ativa")} barbearias ativas, de ${lista.length} cadastradas. Além delas, ${c("teste")} estão em teste, ${c("suspensa")} suspensas e ${c("cancelada")} canceladas.`, [
                { rotulo: "Ativas", valor: fmtNum.format(c("ativa")), origem: "Módulo 02 · status atual" },
                { rotulo: "Em teste", valor: fmtNum.format(c("teste")), origem: "Módulo 02" },
                { rotulo: "Cadastradas", valor: fmtNum.format(lista.length), origem: "Módulo 02" }
            ], { link: "#/barbearias" });
        }
    },
    {
        id: "total-barbearias", exemplos: ["Quantas barbearias estão cadastradas?"],
        casa: (t) => /(quantas|total|numero)/.test(t) && /(barbearia|empresa)/.test(t),
        responder() {
            const lista = S.barbearias();
            return resposta(`Existem ${lista.length} barbearias cadastradas (inclui ativas, em teste, suspensas e canceladas).`, [
                { rotulo: "Cadastradas", valor: fmtNum.format(lista.length), origem: "Módulo 02" }
            ], { link: "#/barbearias" });
        }
    },
    {
        id: "plano-lider", exemplos: ["Qual plano possui mais empresas?"],
        casa: (t) => /plano/.test(t) && /(mais|maior|lider|popular)/.test(t),
        responder() {
            const dist = K.distribuicaoPlanos();
            if (!dist.length || !dist[0].valor) return resposta("Não há barbearias com plano para comparar.");
            const [lider] = dist;
            return resposta(`O plano ${lider.rotulo} tem mais empresas: ${lider.valor} (${pct(lider.participacao)} das barbearias não canceladas).`,
                dist.map((d) => ({ rotulo: d.rotulo, valor: `${d.valor} empresas · ${pct(d.participacao)}`, origem: "Módulos 02 e 03" })), { link: "#/relatorios/assinaturas" });
        }
    },
    {
        id: "receita", exemplos: ["Como está a evolução da receita?"],
        casa: (t) => /(receita|faturamento|faturou|arrecad)/.test(t),
        responder(t) {
            const periodo = periodoDa(t) ?? { chave: "6m", rotulo: "nos últimos 6 meses" };
            const meses = mesesDe(periodo);
            const serie = K.serieReceita(meses);
            const total = serie.reduce((s, x) => s + x.bruta, 0);
            const anterior = K.serieReceita(K.mesesAnteriores(meses)).reduce((s, x) => s + x.bruta, 0);
            const tend = K.tendencia(serie.map((x) => x.bruta));
            const v = K.variacao(total, anterior);
            return resposta(`A receita confirmada ${periodo.rotulo} foi de ${fmtMoeda.format(total)}${v === null ? "" : `, ${v >= 0 ? "alta" : "queda"} de ${pct(Math.abs(v))} em relação ao período anterior (${fmtMoeda.format(anterior)})`}. ${meses.length >= 3 ? tend.texto : ""}`, [
                { rotulo: `Receita ${periodo.rotulo}`, valor: fmtMoeda.format(total), origem: "Módulo 04 · transações pagas" },
                { rotulo: "Período anterior", valor: fmtMoeda.format(anterior), origem: "Módulo 04" },
                ...serie.slice(-3).map((x) => ({ rotulo: `Receita em ${x.mes.split("-").reverse().join("/")}`, valor: fmtMoeda.format(x.bruta), origem: "Módulo 04" }))
            ], { link: "#/relatorios/receita" });
        }
    },
    {
        id: "mrr", exemplos: ["Qual é o MRR?"],
        casa: (t) => /\b(mrr|arr)\b|receita recorrente/.test(t),
        responder() {
            const mrr = K.mrrAtual();
            const ativas = S.assinaturas().filter((a) => a.status === "ativa").length;
            return resposta(`O MRR atual é ${fmtMoeda.format(mrr)} (${ativas} assinaturas ativas, anuais convertidas para valor mensal). O ARR correspondente é ${fmtMoeda.format(mrr * 12)}.`, [
                { rotulo: "MRR", valor: fmtMoeda.format(mrr), origem: "Módulo 03 · assinaturas ativas" },
                { rotulo: "ARR", valor: fmtMoeda.format(mrr * 12), origem: "MRR × 12" }
            ], { link: "#/financeiro" });
        }
    },
    {
        id: "risco", exemplos: ["Quantas empresas estão em risco?"],
        casa: (t) => /risco/.test(t),
        responder() {
            const lista = K.barbeariasEmRisco();
            const altos = lista.filter((r) => r.nivel === "alto");
            const mrr = lista.reduce((s, r) => s + r.mrrEmRisco, 0);
            if (!lista.length) return resposta("Nenhuma barbearia ativa ou suspensa atinge o nível de risco médio ou alto pelos critérios atuais.", [], { link: "#/inteligencia/risco" });
            return resposta(`${lista.length} empresas estão em risco de cancelamento: ${altos.length} com risco alto e ${lista.length - altos.length} com risco médio, somando ${fmtMoeda.format(mrr)} de MRR. As de maior pontuação: ${lista.slice(0, 3).map((r) => `${r.barbearia.nome} (${r.pontos} pts)`).join(", ")}.`, [
                { rotulo: "Risco alto (≥ 50 pts)", valor: fmtNum.format(altos.length), origem: "Critérios do módulo 18" },
                { rotulo: "Risco médio (30–49 pts)", valor: fmtNum.format(lista.length - altos.length), origem: "Critérios do módulo 18" },
                { rotulo: "MRR em risco", valor: fmtMoeda.format(mrr), origem: "Módulo 03" }
            ], { link: "#/inteligencia/risco" });
        }
    },
    {
        id: "funcionalidades", exemplos: ["Quais funcionalidades são mais utilizadas?"],
        casa: (t) => /(funcionalidade|recurso|modulo|feature)/.test(t),
        responder() {
            const lista = K.acessoFuncionalidades();
            return resposta(`Não tenho dados de uso efetivo por funcionalidade: o ambiente demonstrativo não registra quantas vezes cada recurso é usado. O dado disponível é o acesso liberado. As funcionalidades com mais empresas com acesso são: ${lista.slice(0, 3).map((f) => `${f.rotulo} (${f.valor})`).join(", ")}.`,
                lista.slice(0, 5).map((f) => ({ rotulo: f.rotulo, valor: `${f.valor} empresas com acesso`, origem: "Módulo 14 · acesso efetivo" })), { link: "#/relatorios/utilizacao", parcial: true });
        }
    },
    {
        id: "crescimento", exemplos: ["Qual foi o crescimento no último período?"],
        casa: (t) => /(cresc|cresceu|evolu.*base|novas barbearias|novos clientes)/.test(t),
        responder(t) {
            const periodo = periodoDa(t) ?? { chave: "3m", rotulo: "nos últimos 3 meses" };
            const meses = mesesDe(periodo);
            const s = K.serieEmpresas(meses);
            const novas = s.reduce((a, x) => a + x.novas, 0);
            const canc = s.reduce((a, x) => a + x.canceladas, 0);
            const ini = s[0]?.baseInicio ?? 0;
            const fim = s.at(-1)?.base ?? 0;
            return resposta(`${periodo.rotulo[0].toUpperCase()}${periodo.rotulo.slice(1)}, entraram ${novas} barbearias e saíram ${canc}. A base passou de ${ini} para ${fim}${ini ? ` (${fim >= ini ? "+" : ""}${pct((fim - ini) / ini)})` : ""}.`, [
                { rotulo: "Novas", valor: fmtNum.format(novas), origem: "Módulo 02 · data de cadastro" },
                { rotulo: "Cancelamentos", valor: fmtNum.format(canc), origem: "Módulo 03 · data de cancelamento" },
                { rotulo: "Base no início → fim", valor: `${ini} → ${fim}`, origem: "Indicadores do módulo 17" }
            ], { link: "#/relatorios/crescimento" });
        }
    },
    {
        id: "churn", exemplos: ["Qual é o churn?"],
        casa: (t) => /(churn|cancel|retencao|perd)/.test(t),
        responder(t) {
            const periodo = periodoDa(t) ?? { chave: "12m", rotulo: "nos últimos 12 meses" };
            const s = K.serieEmpresas(mesesDe(periodo));
            const canc = s.reduce((a, x) => a + x.canceladas, 0);
            const ini = s[0]?.baseInicio ?? 0;
            const churn = ini ? canc / ini : null;
            return resposta(churn === null ? "Não há base inicial suficiente para calcular o churn nesse período." :
                `${periodo.rotulo[0].toUpperCase()}${periodo.rotulo.slice(1)}, houve ${canc} cancelamentos sobre uma base inicial de ${ini}: churn de ${pct(churn)} e retenção de ${pct(1 - churn)}.`, [
                { rotulo: "Cancelamentos", valor: fmtNum.format(canc), origem: "Módulo 03" },
                { rotulo: "Churn", valor: pct(churn), origem: "Cancelamentos ÷ base inicial" },
                { rotulo: "Retenção", valor: pct(churn === null ? null : 1 - churn), origem: "1 − churn" }
            ], { link: "#/relatorios/retencao" });
        }
    },
    {
        id: "agendamentos", exemplos: ["Quantos agendamentos foram feitos?"],
        casa: (t) => /agendamento|agenda/.test(t),
        responder(t) {
            const periodo = periodoDa(t) ?? { chave: "3m", rotulo: "nos últimos 3 meses" };
            const s = K.serieAgendamentos(mesesDe(periodo));
            if (s.every((x) => x.total === null)) return resposta(`Não há registros de agendamento ${periodo.rotulo}. Os registros começam em ${K.inicioDosAgendamentos() ?? "—"}.`);
            const total = s.reduce((a, x) => a + (x.total ?? 0), 0);
            const canc = s.reduce((a, x) => a + (x.cancelados ?? 0), 0);
            const incompleto = s.some((x) => x.total === null);
            return resposta(`${periodo.rotulo[0].toUpperCase()}${periodo.rotulo.slice(1)}, foram ${fmtNum.format(total)} agendamentos (${pct(total ? canc / total : null)} cancelados).${incompleto ? " Parte do período não tem registros." : ""}`, [
                { rotulo: "Agendamentos", valor: fmtNum.format(total), origem: "Módulo 06" },
                { rotulo: "Cancelados", valor: fmtNum.format(canc), origem: "Módulo 06" }
            ], { link: "#/relatorios/atividade" });
        }
    },
    {
        id: "usuarios", exemplos: ["Quantos usuários existem?"],
        casa: (t) => /usuario/.test(t),
        responder() {
            const lista = S.usuarios();
            const c = (tipo) => lista.filter((u) => u.tipo === tipo).length;
            return resposta(`Há ${fmtNum.format(lista.length)} usuários: ${c("proprietario")} proprietários, ${c("barbeiro")} barbeiros, ${c("funcionario")} funcionários e ${c("cliente")} clientes.`, [
                { rotulo: "Usuários", valor: fmtNum.format(lista.length), origem: "Módulo 05" },
                { rotulo: "Suspensos", valor: fmtNum.format(lista.filter((u) => u.status === "suspenso").length), origem: "Módulo 05" }
            ], { link: "#/usuarios" });
        }
    },
    {
        id: "inadimplencia", exemplos: ["Há pagamentos em atraso?"],
        casa: (t) => /(inadimpl|atras|vencid|devend)/.test(t),
        responder() {
            const vencidas = S.assinaturas().filter((a) => a.status === "vencida");
            const valor = vencidas.reduce((s, a) => s + S.valorMensalEquivalente(a), 0);
            return resposta(vencidas.length ? `${vencidas.length} assinaturas estão vencidas, somando ${fmtMoeda.format(valor)} por mês.` : "Nenhuma assinatura está vencida no momento.", [
                { rotulo: "Assinaturas vencidas", valor: fmtNum.format(vencidas.length), origem: "Módulo 03" },
                { rotulo: "Valor mensal", valor: fmtMoeda.format(valor), origem: "Módulo 03" }
            ], { link: "#/financeiro" });
        }
    },
    {
        id: "suporte", exemplos: ["Quantos chamados estão abertos?"],
        casa: (t) => /(chamado|suporte|ticket)/.test(t),
        responder() {
            const r = O.resumoSuporte();
            return resposta(`Há ${r.abertos + r.emAtendimento + r.aguardando} chamados em andamento (${r.abertos} abertos, ${r.emAtendimento} em atendimento, ${r.aguardando} aguardando o cliente), ${r.prioritarios} de prioridade alta ou crítica.`, [
                { rotulo: "Total de chamados", valor: fmtNum.format(r.total), origem: "Módulo 07" },
                { rotulo: "Tempo médio de resolução", valor: r.tempoMedioHoras === null ? "—" : `${r.tempoMedioHoras.toFixed(1).replace(".", ",")} h`, origem: "Módulo 07" }
            ], { link: "#/suporte" });
        }
    },
    {
        id: "mais-ativas", exemplos: ["Quais são as empresas mais ativas?"],
        casa: (t) => /mais ativ|mais agend|top|ranking/.test(t),
        responder() {
            const lista = K.rankingAtividade({}, 5);
            return resposta(`As barbearias mais ativas nos últimos 30 dias são: ${lista.map((r) => `${r.barbearia.nome} (${r.ag30})`).join(", ")}.`,
                lista.map((r) => ({ rotulo: r.barbearia.nome, valor: `${r.ag30} agendamentos`, origem: "Módulo 06 · 30 dias" })), { link: "#/relatorios/atividade" });
        }
    },
    {
        id: "seguranca", exemplos: ["Houve tentativas suspeitas de login?"],
        casa: (t) => /(suspeit|seguranca|login|invas)/.test(t),
        responder() {
            const r = I.resumoSeguranca();
            return resposta(`Há ${r.suspeitas} eventos de tentativa suspeita registrados e ${r.recusadas24h} logins recusados nas últimas 24 horas. Incidentes de segurança abertos: ${r.incidentesAbertos}. (Eventos demonstrativos.)`, [
                { rotulo: "Tentativas suspeitas", valor: fmtNum.format(r.suspeitas), origem: "Módulo 10" },
                { rotulo: "Incidentes abertos", valor: fmtNum.format(r.incidentesAbertos), origem: "Módulo 10" }
            ], { link: "#/auditoria/acessos" });
        }
    }
];

// Ordem de avaliação: intenções específicas antes das genéricas
// (ex.: "quantas empresas em risco" é risco, não total de empresas).
const ORDEM = ["ajuda", "risco", "mais-ativas", "ativas", "plano-lider", "mrr", "receita", "funcionalidades", "crescimento",
    "churn", "agendamentos", "usuarios", "inadimplencia", "suporte", "seguranca", "total-barbearias"];
INTENCOES.sort((a, b) => ORDEM.indexOf(a.id) - ORDEM.indexOf(b.id));

export const EXEMPLOS = [
    "Quantas barbearias estão ativas?", "Qual plano possui mais empresas?", "Como está a evolução da receita?",
    "Quantas empresas estão em risco?", "Quais funcionalidades são mais utilizadas?", "Qual foi o crescimento no último período?"
];

// Assuntos que o assistente reconhece mas para os quais não há dados.
const SEM_DADOS = [
    [/(lucro|margem) (por|de cada) (barbeiro|cliente)/, "Não há custos por barbeiro ou cliente nos dados; só existem despesas da plataforma inteira."],
    [/(nps|satisfacao)/, "Os indicadores de satisfação ficam nas pesquisas do módulo 09; não consolido NPS aqui. Abra Marketing › Pesquisas."],
    [/(previs|projec|futuro|proximo mes|vai crescer)/, "As projeções ficam na aba Previsões deste módulo, com os critérios usados. Não faço previsões pelo assistente."],
    [/(concorr|mercado|outras empresas do setor)/, "Não tenho dados de mercado nem de concorrentes: só os registros do próprio Barber Control."]
];

export function perguntar(pergunta) {
    const texto = normalizar(pergunta).trim();
    if (!texto) return resposta("Digite uma pergunta sobre os dados do Barber Control.", [], { semDados: true });
    for (const [padrao, mensagem] of SEM_DADOS) {
        if (padrao.test(texto)) return resposta(mensagem, [], { semDados: true, link: /previs|projec|futuro|proximo mes|vai crescer/.test(texto) ? "#/inteligencia/previsoes" : undefined });
    }
    const intencao = INTENCOES.find((i) => i.casa(texto));
    if (!intencao) {
        return resposta(`Não encontrei dados para responder a essa pergunta. Posso responder sobre barbearias, planos, receita, MRR, crescimento, churn, risco, agendamentos, usuários, inadimplência, suporte e segurança. Experimente: "${EXEMPLOS[0]}"`, [], { semDados: true });
    }
    return { ...intencao.responder(texto), intencao: intencao.id };
}

export const intencoesSuportadas = () => INTENCOES.map((i) => ({ id: i.id, exemplo: i.exemplos[0] }));
