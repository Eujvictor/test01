// =====================================================================
// MÓDULO 17 — DEFINIÇÃO DOS RELATÓRIOS
// Cada relatório declara a origem dos dados e calcula, a partir de
// services/demo/indicadores.js, os indicadores (com comparação ao
// período anterior), as séries mensais e a tabela exibida/exportada.
// f = { periodo, barbeariaId, planoId, status }
// =====================================================================
import * as K from "../../services/demo/indicadores.js";
import * as S from "../../services/demo/saas.js";
import { STATUS_BARBEARIA, PERIODICIDADES } from "../../services/demo/catalogo.js";
import { mesReferencia, data } from "../../js/utilities/format.js";

export const CATEGORIAS = {
    empresarial: { rotulo: "Empresariais", icone: "building-2" },
    financeiro: { rotulo: "Financeiros", icone: "wallet" },
    utilizacao: { rotulo: "Utilização", icone: "gauge" },
    crescimento: { rotulo: "Crescimento", icone: "trending-up" },
    retencao: { rotulo: "Retenção", icone: "shield-check" },
    cancelamentos: { rotulo: "Cancelamentos", icone: "user-x" },
    assinaturas: { rotulo: "Assinaturas", icone: "badge-check" },
    atividade: { rotulo: "Atividade", icone: "calendar-clock" },
    operacional: { rotulo: "Desempenho operacional", icone: "activity" }
};

const escopoDe = (f) => ({ barbeariaId: f.barbeariaId || "", planoId: f.planoId || "", status: f.status || "" });
const mesCol = { rotulo: "Mês", valor: (l) => mesReferencia(l.mes, true) };
const pares = (serie, campo) => serie.map((x) => ({ mes: x.mes, valor: x[campo] }));
const somar = (serie, campo) => {
    const v = serie.filter((x) => x[campo] !== null && x[campo] !== undefined);
    return v.length ? v.reduce((s, x) => s + x[campo], 0) : null;
};
const mediaDe = (serie, campo) => {
    const v = serie.filter((x) => x[campo] !== null && x[campo] !== undefined);
    return v.length ? v.reduce((s, x) => s + x[campo], 0) / v.length : null;
};

function meses(f) {
    const atuais = K.mesesDoPeriodo(f.periodo);
    return { atuais, anteriores: K.mesesAnteriores(atuais) };
}

export const RELATORIOS = [
    // ------------------------------------------------------------------
    {
        id: "base-barbearias", categoria: "empresarial", tipo: "volume",
        titulo: "Base de barbearias",
        descricao: "Evolução da base de clientes empresariais: entradas, saídas e tamanho da base mês a mês.",
        origem: ["Módulo 02 · Barbearias (data de cadastro e status)", "Módulo 03 · Assinaturas (data de cancelamento)"],
        calcular(f) {
            const { atuais, anteriores } = meses(f);
            const esc = escopoDe(f);
            const s = K.serieEmpresas(atuais, esc);
            const p = K.serieEmpresas(anteriores, esc);
            const cresc = (serie) => (serie[0]?.baseInicio ? (serie.at(-1).base - serie[0].baseInicio) / serie[0].baseInicio : null);
            return {
                kpis: [
                    { rotulo: "Cadastradas (total)", atual: K.barbeariasNoEscopo(esc).length, formato: "numero", nota: "Situação atual" },
                    { rotulo: "Base no fim do período", atual: s.at(-1)?.base ?? 0, anterior: p.at(-1)?.base ?? 0, formato: "numero", melhor: "alta" },
                    { rotulo: "Novas barbearias", atual: somar(s, "novas"), anterior: somar(p, "novas"), formato: "numero", melhor: "alta" },
                    { rotulo: "Cancelamentos", atual: somar(s, "canceladas"), anterior: somar(p, "canceladas"), formato: "numero", melhor: "baixa" },
                    { rotulo: "Crescimento da base", atual: cresc(s), anterior: cresc(p), formato: "percentual", melhor: "alta" }
                ],
                series: [
                    { id: "base", rotulo: "Base no fim do mês", formato: "numero", dados: pares(s, "base"), anterior: pares(p, "base") },
                    { id: "novas", rotulo: "Novas barbearias", formato: "numero", dados: pares(s, "novas"), anterior: pares(p, "novas") },
                    { id: "canceladas", rotulo: "Cancelamentos", formato: "numero", tom: "erro", dados: pares(s, "canceladas"), anterior: pares(p, "canceladas") }
                ],
                colunas: [
                    mesCol,
                    { rotulo: "Base no início", valor: (l) => l.baseInicio, formato: "numero" },
                    { rotulo: "Novas", valor: (l) => l.novas, formato: "numero" },
                    { rotulo: "Canceladas", valor: (l) => l.canceladas, formato: "numero" },
                    { rotulo: "Base no fim", valor: (l) => l.base, formato: "numero" },
                    { rotulo: "Variação no mês", valor: (l) => (l.baseInicio ? (l.base - l.baseInicio) / l.baseInicio : null), formato: "percentual" }
                ],
                linhas: s
            };
        }
    },
    // ------------------------------------------------------------------
    {
        id: "carteira", categoria: "empresarial", tipo: "volume", semPeriodo: true,
        titulo: "Carteira de barbearias",
        descricao: "Lista das barbearias com plano, status, atividade recente, valor mensal e nível de risco.",
        origem: ["Módulo 02 · Barbearias", "Módulo 03 · Assinaturas", "Módulo 06 · Agendamentos (últimos 30 dias)", "Módulo 18 · Critérios de risco"],
        calcular(f) {
            const esc = escopoDe(f);
            const lista = K.barbeariasNoEscopo(esc);
            const cont = (st) => lista.filter((b) => b.status === st).length;
            const linhas = lista.map((b) => {
                const a = S.assinaturaDaBarbearia(b.id);
                const risco = b.status === "ativa" || b.status === "suspensa" ? K.riscoDaBarbearia(b) : null;
                return {
                    id: b.id, nome: b.nome, local: `${b.cidade}/${b.estado}`, plano: a ? S.plano(a.planoId)?.nome : "—",
                    status: STATUS_BARBEARIA[b.status]?.rotulo ?? b.status, cadastro: b.criadoEm,
                    ag30: K.agendamentosUltimos30(b.id), valor: a && a.status === "ativa" ? S.valorMensalEquivalente(a) : 0,
                    risco: risco ? { alto: "Alto", medio: "Médio", baixo: "Baixo" }[risco.nivel] : "—"
                };
            }).sort((a, b) => b.ag30 - a.ag30);
            return {
                kpis: [
                    { rotulo: "Barbearias", atual: lista.length, formato: "numero", nota: "Situação atual" },
                    { rotulo: "Ativas", atual: cont("ativa"), formato: "numero" },
                    { rotulo: "Em teste", atual: cont("teste"), formato: "numero" },
                    { rotulo: "Suspensas", atual: cont("suspensa"), formato: "numero" },
                    { rotulo: "Canceladas", atual: cont("cancelada"), formato: "numero" }
                ],
                series: [],
                ranking: { titulo: "Mais agendamentos nos últimos 30 dias", formato: "numero", itens: linhas.slice(0, 8).map((l) => ({ rotulo: l.nome, valor: l.ag30, link: `#/barbearias/${l.id}` })) },
                colunas: [
                    { rotulo: "Barbearia", valor: (l) => l.nome },
                    { rotulo: "Cidade/UF", valor: (l) => l.local },
                    { rotulo: "Plano", valor: (l) => l.plano },
                    { rotulo: "Status", valor: (l) => l.status },
                    { rotulo: "Cadastro", valor: (l) => data(l.cadastro) },
                    { rotulo: "Agendamentos (30 dias)", valor: (l) => l.ag30, formato: "numero" },
                    { rotulo: "Valor mensal", valor: (l) => l.valor, formato: "moeda" },
                    { rotulo: "Risco", valor: (l) => l.risco }
                ],
                linhas,
                observacoes: ["Relatório de situação atual: o filtro de período não se aplica."]
            };
        }
    },
    // ------------------------------------------------------------------
    {
        id: "receita", categoria: "financeiro", tipo: "financeiro",
        titulo: "Receita e resultado",
        descricao: "Receita bruta e líquida, taxas estimadas, despesas, resultado e inadimplência por mês.",
        origem: ["Módulo 04 · Financeiro (transações pagas por mês de vencimento, taxas estimadas e despesas)", "Módulo 03 · Assinaturas (MRR)"],
        calcular(f) {
            const { atuais, anteriores } = meses(f);
            const esc = escopoDe(f);
            const s = K.serieReceita(atuais, esc);
            const p = K.serieReceita(anteriores, esc);
            const mrr = K.mrrAtual(esc);
            const ticket = (serie) => { const pg = somar(serie, "pagamentos"); return pg ? somar(serie, "bruta") / pg : null; };
            const filtrado = esc.barbeariaId || esc.planoId || esc.status;
            return {
                kpis: [
                    { rotulo: "Receita bruta", atual: somar(s, "bruta"), anterior: somar(p, "bruta"), formato: "moeda", melhor: "alta" },
                    { rotulo: "Receita líquida estimada", atual: somar(s, "liquida"), anterior: somar(p, "liquida"), formato: "moeda", melhor: "alta" },
                    { rotulo: "MRR atual", atual: mrr, formato: "moeda", nota: "Assinaturas ativas hoje" },
                    { rotulo: "ARR", atual: mrr * 12, formato: "moeda", nota: "MRR × 12" },
                    { rotulo: "Ticket médio", atual: ticket(s), anterior: ticket(p), formato: "moeda", melhor: "alta" },
                    { rotulo: "Inadimplência média", atual: mediaDe(s, "inadimplencia"), anterior: mediaDe(p, "inadimplencia"), formato: "percentual", melhor: "baixa" }
                ],
                series: [
                    { id: "bruta", rotulo: "Receita bruta", formato: "moeda", dados: pares(s, "bruta"), anterior: pares(p, "bruta") },
                    { id: "liquida", rotulo: "Receita líquida estimada", formato: "moeda", dados: pares(s, "liquida"), anterior: pares(p, "liquida") },
                    ...(filtrado ? [] : [
                        { id: "despesas", rotulo: "Despesas", formato: "moeda", tom: "neutro", dados: pares(s, "despesas"), anterior: pares(p, "despesas") },
                        { id: "resultado", rotulo: "Resultado estimado", formato: "moeda", dados: pares(s, "resultado"), anterior: pares(p, "resultado") }
                    ])
                ],
                colunas: [
                    mesCol,
                    { rotulo: "Pagamentos", valor: (l) => l.pagamentos, formato: "numero" },
                    { rotulo: "Receita bruta", valor: (l) => l.bruta, formato: "moeda" },
                    { rotulo: "Taxas estimadas", valor: (l) => l.taxas, formato: "moeda" },
                    { rotulo: "Receita líquida", valor: (l) => l.liquida, formato: "moeda" },
                    { rotulo: "Despesas", valor: (l) => l.despesas, formato: "moeda" },
                    { rotulo: "Resultado", valor: (l) => l.resultado, formato: "moeda" },
                    { rotulo: "Inadimplência", valor: (l) => l.inadimplencia, formato: "percentual" }
                ],
                linhas: s,
                observacoes: filtrado ? ["Despesas e resultado aparecem só sem filtro de barbearia, plano ou status: as despesas são da plataforma e não têm rateio por empresa."] : []
            };
        }
    },
    // ------------------------------------------------------------------
    {
        id: "utilizacao", categoria: "utilizacao", tipo: "taxa", semPeriodo: true,
        titulo: "Utilização dos recursos",
        descricao: "Funcionalidades liberadas para as barbearias e uso do limite de agendamentos de cada plano.",
        origem: ["Módulo 14 · Funcionalidades (acesso efetivo: plano + liberações + flags)", "Módulo 06 · Agendamentos (últimos 30 dias) × limite do plano (módulo 03)"],
        calcular(f) {
            const esc = escopoDe(f);
            const acesso = K.acessoFuncionalidades(esc);
            const uso = K.utilizacaoDosPlanos(esc);
            return {
                kpis: [
                    { rotulo: "Empresas analisadas", atual: uso.total, formato: "numero", nota: "Ativas e em teste" },
                    { rotulo: "Uso alto do limite (≥ 70%)", atual: uso.alta, formato: "numero" },
                    { rotulo: "Uso médio (30–69%)", atual: uso.media, formato: "numero" },
                    { rotulo: "Uso baixo (< 30%)", atual: uso.baixa, formato: "numero" },
                    { rotulo: "Plano sem limite", atual: uso.ilimitado, formato: "numero" }
                ],
                series: [],
                ranking: { titulo: "Empresas com acesso liberado por funcionalidade", formato: "numero", itens: acesso.slice(0, 10).map((a) => ({ rotulo: a.rotulo, valor: a.valor, link: `#/funcionalidades/funcionalidade/${a.chave}` })) },
                colunas: [
                    { rotulo: "Funcionalidade", valor: (l) => l.rotulo },
                    { rotulo: "Categoria", valor: (l) => l.categoria },
                    { rotulo: "Empresas com acesso", valor: (l) => l.valor, formato: "numero" },
                    { rotulo: "Cobertura da base", valor: (l) => l.cobertura, formato: "percentual" }
                ],
                linhas: acesso,
                observacoes: ["Acesso liberado indica direito de uso, não uso efetivo: o ambiente demonstrativo não mede quantas vezes cada funcionalidade é usada.", "Relatório de situação atual: o filtro de período não se aplica."]
            };
        }
    },
    // ------------------------------------------------------------------
    {
        id: "crescimento", categoria: "crescimento", tipo: "volume",
        titulo: "Crescimento da plataforma",
        descricao: "Novas barbearias, novos usuários e receita recorrente estimada mês a mês.",
        origem: ["Módulo 02 · Barbearias (data de cadastro)", "Módulo 05 · Usuários (data de criação)", "Módulo 03 · Assinaturas (MRR estimado por mês)"],
        calcular(f) {
            const { atuais, anteriores } = meses(f);
            const esc = escopoDe(f);
            const e = K.serieEmpresas(atuais, esc), ep = K.serieEmpresas(anteriores, esc);
            const u = K.serieUsuarios(atuais, esc), up = K.serieUsuarios(anteriores, esc);
            const m = K.serieMrr(atuais, esc), mp = K.serieMrr(anteriores, esc);
            const linhas = atuais.map((k, i) => ({ mes: k, novas: e[i].novas, usuarios: u[i].novos, mrr: m[i].valor, pagantes: m[i].pagantes }));
            return {
                kpis: [
                    { rotulo: "Novas barbearias", atual: somar(e, "novas"), anterior: somar(ep, "novas"), formato: "numero", melhor: "alta" },
                    { rotulo: "Novos usuários", atual: somar(u, "novos"), anterior: somar(up, "novos"), formato: "numero", melhor: "alta" },
                    { rotulo: "MRR estimado no fim", atual: m.at(-1)?.valor ?? 0, anterior: mp.at(-1)?.valor ?? 0, formato: "moeda", melhor: "alta" },
                    { rotulo: "Assinaturas pagantes no fim", atual: m.at(-1)?.pagantes ?? 0, anterior: mp.at(-1)?.pagantes ?? 0, formato: "numero", melhor: "alta" }
                ],
                series: [
                    { id: "novas", rotulo: "Novas barbearias", formato: "numero", dados: pares(e, "novas"), anterior: pares(ep, "novas") },
                    { id: "usuarios", rotulo: "Novos usuários", formato: "numero", dados: pares(u, "novos"), anterior: pares(up, "novos") },
                    { id: "mrr", rotulo: "MRR estimado", formato: "moeda", dados: pares(m, "valor"), anterior: pares(mp, "valor") }
                ],
                colunas: [
                    mesCol,
                    { rotulo: "Novas barbearias", valor: (l) => l.novas, formato: "numero" },
                    { rotulo: "Novos usuários", valor: (l) => l.usuarios, formato: "numero" },
                    { rotulo: "MRR estimado", valor: (l) => l.mrr, formato: "moeda" },
                    { rotulo: "Assinaturas pagantes", valor: (l) => l.pagantes, formato: "numero" }
                ],
                linhas,
                observacoes: ["MRR estimado por mês: soma do valor mensal atual das assinaturas que já tinham saído do teste e não estavam canceladas no fim de cada mês (o histórico de troca de plano não é versionado)."]
            };
        }
    },
    // ------------------------------------------------------------------
    {
        id: "retencao", categoria: "retencao", tipo: "taxa",
        titulo: "Retenção e churn",
        descricao: "Percentual de barbearias mantidas e perdidas a cada mês, sobre a base do início do mês.",
        origem: ["Módulo 02 · Barbearias (base por mês)", "Módulo 03 · Assinaturas (data de cancelamento)"],
        calcular(f) {
            const { atuais, anteriores } = meses(f);
            const esc = escopoDe(f);
            const s = K.serieEmpresas(atuais, esc);
            const p = K.serieEmpresas(anteriores, esc);
            const churnPeriodo = (serie) => (serie[0]?.baseInicio ? somar(serie, "canceladas") / serie[0].baseInicio : null);
            const linhas = s.map((x) => ({ ...x, retencao: x.churn === null ? null : 1 - x.churn }));
            return {
                kpis: [
                    { rotulo: "Retenção no período", atual: churnPeriodo(s) === null ? null : 1 - churnPeriodo(s), anterior: churnPeriodo(p) === null ? null : 1 - churnPeriodo(p), formato: "percentual", melhor: "alta" },
                    { rotulo: "Churn no período", atual: churnPeriodo(s), anterior: churnPeriodo(p), formato: "percentual", melhor: "baixa" },
                    { rotulo: "Churn mensal médio", atual: mediaDe(s, "churn"), anterior: mediaDe(p, "churn"), formato: "percentual", melhor: "baixa" },
                    { rotulo: "Base no início do período", atual: s[0]?.baseInicio ?? 0, anterior: p[0]?.baseInicio ?? 0, formato: "numero" }
                ],
                series: [
                    { id: "retencao", rotulo: "Retenção mensal", formato: "percentual", tipo: "linha", dados: linhas.map((x) => ({ mes: x.mes, valor: x.retencao })), anterior: p.map((x) => ({ mes: x.mes, valor: x.churn === null ? null : 1 - x.churn })) },
                    { id: "churn", rotulo: "Churn mensal", formato: "percentual", tipo: "linha", tom: "erro", dados: pares(s, "churn"), anterior: pares(p, "churn") }
                ],
                colunas: [
                    mesCol,
                    { rotulo: "Base no início", valor: (l) => l.baseInicio, formato: "numero" },
                    { rotulo: "Cancelamentos", valor: (l) => l.canceladas, formato: "numero" },
                    { rotulo: "Churn", valor: (l) => l.churn, formato: "percentual" },
                    { rotulo: "Retenção", valor: (l) => l.retencao, formato: "percentual" }
                ],
                linhas,
                observacoes: ["Churn do mês = cancelamentos no mês ÷ base no início do mês. Retenção = 1 − churn."]
            };
        }
    },
    // ------------------------------------------------------------------
    {
        id: "cancelamentos", categoria: "cancelamentos", tipo: "volume",
        titulo: "Cancelamentos",
        descricao: "Assinaturas canceladas no período, com tempo de casa, valor mensal perdido e motivo registrado.",
        origem: ["Módulo 03 · Assinaturas (canceladas e data)", "Histórico das assinaturas (motivo informado)"],
        calcular(f) {
            const { atuais, anteriores } = meses(f);
            const esc = escopoDe(f);
            const ids = new Set(K.barbeariasNoEscopo(esc).map((b) => b.id));
            const noIntervalo = (lista) => {
                const ini = K.inicioDoMes(lista[0]);
                const fim = K.fimDoMes(lista.at(-1));
                return S.assinaturas().filter((a) => ids.has(a.barbeariaId) && a.canceladaEm && new Date(a.canceladaEm) >= ini && new Date(a.canceladaEm) <= fim);
            };
            const atuaisLista = noIntervalo(atuais);
            const anterioresLista = noIntervalo(anteriores);
            const motivo = (a) => {
                const h = S.historicoDe("assinatura", a.id).find((x) => x.acao === "cancelada");
                const m = h?.descricao.match(/Motivo:\s*(.+)$/);
                return m ? m[1] : h ? h.descricao : "Não informado";
            };
            const linhas = atuaisLista.map((a) => ({
                id: a.id, barbearia: S.barbearia(a.barbeariaId)?.nome ?? "—", plano: S.plano(a.planoId)?.nome ?? "—",
                periodicidade: PERIODICIDADES[a.periodicidade]?.rotulo ?? a.periodicidade, canceladaEm: a.canceladaEm,
                meses: Math.max(0, Math.round((new Date(a.canceladaEm) - new Date(a.inicio)) / (30.44 * 86400000))),
                valor: S.valorMensalEquivalente(a), motivo: motivo(a)
            })).sort((a, b) => b.canceladaEm.localeCompare(a.canceladaEm));
            const perdido = (lista) => lista.reduce((s, a) => s + S.valorMensalEquivalente(a), 0);
            const porMes = (lista, ms) => ms.map((k) => ({ mes: k, valor: lista.filter((a) => a.canceladaEm.slice(0, 7) === k).length }));
            return {
                kpis: [
                    { rotulo: "Cancelamentos", atual: atuaisLista.length, anterior: anterioresLista.length, formato: "numero", melhor: "baixa" },
                    { rotulo: "Receita mensal perdida", atual: perdido(atuaisLista), anterior: perdido(anterioresLista), formato: "moeda", melhor: "baixa" },
                    { rotulo: "Tempo médio de casa", atual: linhas.length ? linhas.reduce((s, l) => s + l.meses, 0) / linhas.length : null, formato: "decimal", nota: "Meses até o cancelamento" }
                ],
                series: [
                    { id: "cancelamentos", rotulo: "Cancelamentos por mês", formato: "numero", tom: "erro", dados: porMes(atuaisLista, atuais), anterior: porMes(anterioresLista, anteriores) }
                ],
                colunas: [
                    { rotulo: "Barbearia", valor: (l) => l.barbearia },
                    { rotulo: "Plano", valor: (l) => l.plano },
                    { rotulo: "Periodicidade", valor: (l) => l.periodicidade },
                    { rotulo: "Cancelada em", valor: (l) => data(l.canceladaEm) },
                    { rotulo: "Tempo de casa (meses)", valor: (l) => l.meses, formato: "numero" },
                    { rotulo: "Valor mensal perdido", valor: (l) => l.valor, formato: "moeda" },
                    { rotulo: "Motivo", valor: (l) => l.motivo }
                ],
                linhas
            };
        }
    },
    // ------------------------------------------------------------------
    {
        id: "assinaturas", categoria: "assinaturas", tipo: "volume",
        titulo: "Assinaturas por plano",
        descricao: "Situação atual das assinaturas por plano e evolução das assinaturas pagantes.",
        origem: ["Módulo 03 · Assinaturas e planos"],
        calcular(f) {
            const { atuais, anteriores } = meses(f);
            const esc = escopoDe(f);
            const porPlano = K.assinaturasPorPlano(esc);
            const tot = (campo) => porPlano.reduce((s, x) => s + x[campo], 0);
            const m = K.serieMrr(atuais, esc), mp = K.serieMrr(anteriores, esc);
            return {
                kpis: [
                    { rotulo: "Assinaturas ativas", atual: tot("ativas"), formato: "numero", nota: "Situação atual" },
                    { rotulo: "Em teste", atual: tot("teste"), formato: "numero" },
                    { rotulo: "Vencidas", atual: tot("vencidas"), formato: "numero" },
                    { rotulo: "Canceladas", atual: tot("canceladas"), formato: "numero" },
                    { rotulo: "MRR atual", atual: tot("mrr"), formato: "moeda" },
                    { rotulo: "Pagantes no fim do período", atual: m.at(-1)?.pagantes ?? 0, anterior: mp.at(-1)?.pagantes ?? 0, formato: "numero", melhor: "alta" }
                ],
                series: [
                    { id: "pagantes", rotulo: "Assinaturas pagantes (fim do mês)", formato: "numero", dados: pares(m, "pagantes"), anterior: pares(mp, "pagantes") }
                ],
                colunas: [
                    { rotulo: "Plano", valor: (l) => l.plano },
                    { rotulo: "Ativas", valor: (l) => l.ativas, formato: "numero" },
                    { rotulo: "Em teste", valor: (l) => l.teste, formato: "numero" },
                    { rotulo: "Vencidas", valor: (l) => l.vencidas, formato: "numero" },
                    { rotulo: "Canceladas", valor: (l) => l.canceladas, formato: "numero" },
                    { rotulo: "Total", valor: (l) => l.total, formato: "numero" },
                    { rotulo: "MRR", valor: (l) => l.mrr, formato: "moeda" }
                ],
                linhas: porPlano,
                observacoes: ["A tabela mostra a situação atual; o gráfico mostra a evolução no período selecionado."]
            };
        }
    },
    // ------------------------------------------------------------------
    {
        id: "atividade", categoria: "atividade", tipo: "volume",
        titulo: "Atividade das barbearias",
        descricao: "Agendamentos realizados e cancelados e quantidade de empresas com movimento a cada mês.",
        origem: ["Módulo 06 · Agendamentos e atividade (registros dos últimos 180 dias)"],
        calcular(f) {
            const { atuais, anteriores } = meses(f);
            const esc = escopoDe(f);
            const s = K.serieAgendamentos(atuais, esc);
            const p = K.serieAgendamentos(anteriores, esc);
            const taxa = (serie) => { const t = somar(serie, "total"); return t ? somar(serie, "cancelados") / t : null; };
            const inicio = K.inicioDosAgendamentos();
            const linhas = s.map((x) => ({ ...x, taxa: x.total ? x.cancelados / x.total : null }));
            const observacoes = [];
            if (inicio) observacoes.push(`Os registros de agendamento começam em ${data(`${inicio}T12:00:00`)}. Meses anteriores aparecem como "sem dados", não como zero.`);
            if (s.some((x) => x.parcial)) observacoes.push("O primeiro mês com registros é parcial.");
            if (s.at(-1)?.mes === K.chaveMes(new Date())) observacoes.push("O mês atual está em andamento (até hoje).");
            return {
                kpis: [
                    { rotulo: "Agendamentos", atual: somar(s, "total"), anterior: somar(p, "total"), formato: "numero", melhor: "alta" },
                    { rotulo: "Realizados", atual: somar(s, "realizados"), anterior: somar(p, "realizados"), formato: "numero", melhor: "alta" },
                    { rotulo: "Taxa de cancelamento", atual: taxa(s), anterior: taxa(p), formato: "percentual", melhor: "baixa" },
                    { rotulo: "Empresas com atividade (média)", atual: mediaDe(s, "empresasAtivas"), anterior: mediaDe(p, "empresasAtivas"), formato: "decimal", melhor: "alta" }
                ],
                series: [
                    { id: "total", rotulo: "Agendamentos por mês", formato: "numero", dados: pares(s, "total"), anterior: pares(p, "total") },
                    { id: "empresas", rotulo: "Empresas com atividade", formato: "numero", dados: pares(s, "empresasAtivas"), anterior: pares(p, "empresasAtivas") }
                ],
                ranking: { titulo: "Empresas mais ativas (30 dias)", formato: "numero", itens: K.rankingAtividade(esc, 8).map((r) => ({ rotulo: r.barbearia.nome, valor: r.ag30, link: `#/barbearias/${r.barbearia.id}` })) },
                colunas: [
                    mesCol,
                    { rotulo: "Agendamentos", valor: (l) => l.total, formato: "numero" },
                    { rotulo: "Realizados", valor: (l) => l.realizados, formato: "numero" },
                    { rotulo: "Cancelados", valor: (l) => l.cancelados, formato: "numero" },
                    { rotulo: "Taxa de cancelamento", valor: (l) => l.taxa, formato: "percentual" },
                    { rotulo: "Empresas com atividade", valor: (l) => l.empresasAtivas, formato: "numero" }
                ],
                linhas,
                observacoes
            };
        }
    },
    // ------------------------------------------------------------------
    {
        id: "operacional", categoria: "operacional", tipo: "volume",
        titulo: "Desempenho operacional",
        descricao: "Chamados de suporte abertos e resolvidos, tempo médio de resolução, incidentes técnicos e disponibilidade.",
        origem: ["Módulo 07 · Suporte (chamados)", "Módulo 11 · Monitoramento técnico (incidentes e disponibilidade simulada de 30 dias)"],
        calcular(f) {
            const { atuais, anteriores } = meses(f);
            const esc = escopoDe(f);
            const s = K.serieSuporte(atuais, esc);
            const p = K.serieSuporte(anteriores, esc);
            const inc = K.serieIncidentesTecnicos(atuais);
            const incP = K.serieIncidentesTecnicos(anteriores);
            const mon = K.monitoramento30();
            const linhas = s.map((x, i) => ({ ...x, incidentes: inc[i].valor }));
            const tempo = (serie) => {
                const v = serie.filter((x) => x.tempoMedioHoras !== null);
                const total = v.reduce((t, x) => t + x.resolvidos, 0);
                return total ? v.reduce((t, x) => t + x.tempoMedioHoras * x.resolvidos, 0) / total : null;
            };
            return {
                kpis: [
                    { rotulo: "Chamados abertos", atual: somar(s, "abertos"), anterior: somar(p, "abertos"), formato: "numero", melhor: "baixa" },
                    { rotulo: "Chamados resolvidos", atual: somar(s, "resolvidos"), anterior: somar(p, "resolvidos"), formato: "numero", melhor: "alta" },
                    { rotulo: "Tempo médio de resolução (h)", atual: tempo(s), anterior: tempo(p), formato: "decimal", melhor: "baixa" },
                    { rotulo: "Incidentes técnicos", atual: somar(inc, "valor"), anterior: somar(incP, "valor"), formato: "numero", melhor: "baixa" },
                    { rotulo: "Disponibilidade (30 dias)", atual: mon.disponibilidade === null ? null : mon.disponibilidade / 100, formato: "percentual", nota: "Simulada · módulo 11" }
                ],
                series: [
                    { id: "abertos", rotulo: "Chamados abertos", formato: "numero", dados: pares(s, "abertos"), anterior: pares(p, "abertos") },
                    { id: "resolvidos", rotulo: "Chamados resolvidos", formato: "numero", dados: pares(s, "resolvidos"), anterior: pares(p, "resolvidos") },
                    { id: "incidentes", rotulo: "Incidentes técnicos", formato: "numero", tom: "erro", dados: inc, anterior: incP }
                ],
                colunas: [
                    mesCol,
                    { rotulo: "Chamados abertos", valor: (l) => l.abertos, formato: "numero" },
                    { rotulo: "Resolvidos", valor: (l) => l.resolvidos, formato: "numero" },
                    { rotulo: "Tempo médio (h)", valor: (l) => l.tempoMedioHoras, formato: "decimal" },
                    { rotulo: "Incidentes técnicos", valor: (l) => l.incidentes, formato: "numero" }
                ],
                linhas,
                observacoes: ["Incidentes técnicos e disponibilidade são da plataforma inteira (não filtram por barbearia).", "A disponibilidade vem de métricas simuladas do módulo 11; nenhum serviço real é monitorado."]
            };
        }
    }
];

export const relatorio = (id) => RELATORIOS.find((r) => r.id === id) ?? null;
