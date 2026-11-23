// =====================================================================
// MÓDULO 18 — INTELIGÊNCIA DE NEGÓCIO (MODO REAL)
// Rota: #/inteligencia
// Cruza os dados reais (agendamentos, assinaturas, acessos e suporte)
// com REGRAS EXPLÍCITAS, mostradas na tela, para apontar barbearias em
// risco e sugerir o que fazer. Não há IA externa nem números inventados.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda, percentual } from "../../js/utilities/format.js";
import { criarTabela } from "../../js/components/tabela.js";
import { graficoComparativo } from "../../js/components/grafico.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, novaRaiz } from "../../js/components/ui.js";

const NIVEIS = { alto: { rotulo: "Risco alto", tom: "erro" }, medio: { rotulo: "Risco médio", tom: "atencao" }, baixo: { rotulo: "Risco baixo", tom: "neutro" } };
const DIA = 86400000;
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somarDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };

// Regras de risco (pontos). A soma define o nível: 50+ alto, 25–49 médio.
const REGRAS = [
    ["Fatura vencida", 35, "A barbearia tem mensalidade em atraso."],
    ["Atraso maior que 5 dias", 15, "Soma-se à fatura vencida quando o atraso passa de 5 dias."],
    ["Agenda parada", 25, "Nenhum agendamento nos últimos 14 dias (barbearia com mais de 14 dias)."],
    ["Queda de movimento", 15, "Agendamentos dos últimos 30 dias caíram mais da metade em relação aos 30 anteriores."],
    ["Dono sem acessar", 20, "Nenhum dono ou gerente entrou no painel nos últimos 30 dias (ou nunca entrou)."],
    ["Teste terminando", 10, "O período de teste termina em até 5 dias."],
    ["Chamado urgente aberto", 10, "Há chamado de prioridade alta ou crítica sem solução."]
];
const PONTOS = Object.fromEntries(REGRAS.map(([n, p]) => [n, p]));

function avaliar({ barbearias, assinaturas, usuarios, agendamentos, chamados }) {
    const hoje = Date.now();
    const lim30 = somarDias(-29), lim60 = somarDias(-59), lim14 = somarDias(-13);
    return barbearias.filter((b) => b.status !== "cancelada").map((b) => {
        const a = assinaturas.find((x) => x.barbearia_id === b.id);
        const ags = agendamentos.filter((x) => x.barbearia_id === b.id && x.data <= somarDias(0));
        const ult30 = ags.filter((x) => x.data >= lim30).length;
        const ant30 = ags.filter((x) => x.data >= lim60 && x.data < lim30).length;
        const ult14 = ags.filter((x) => x.data >= lim14).length;
        const donos = usuarios.filter((u) => u.barbearia_id === b.id && u.ativo && (u.tipo === "proprietario" || u.tipo === "gerente"));
        const acessoRecente = donos.some((u) => u.ultimo_acesso && hoje - new Date(u.ultimo_acesso).getTime() <= 30 * DIA);
        const idadeDias = (hoje - new Date(b.criado_em).getTime()) / DIA;
        const motivos = [];
        if (a && Number(a.dias_atraso) > 0 && !b.protegida) {
            motivos.push(`Fatura vencida há ${a.dias_atraso} dia(s)`);
            if (Number(a.dias_atraso) > 5) motivos.push("Atraso maior que 5 dias");
        }
        if (idadeDias > 14 && ult14 === 0) motivos.push("Agenda parada");
        if (ant30 >= 4 && ult30 < ant30 / 2) motivos.push("Queda de movimento");
        if (!acessoRecente) motivos.push("Dono sem acessar");
        if (a?.status === "teste" && a.teste_ate && (new Date(`${a.teste_ate}T23:59:59`) - hoje) / DIA <= 5) motivos.push("Teste terminando");
        if (chamados.some((c) => c.barbearia_id === b.id && ["alta", "critica"].includes(c.prioridade) && ["aberto", "em_atendimento", "aguardando"].includes(c.status))) motivos.push("Chamado urgente aberto");
        const pontos = motivos.reduce((s, m) => s + (PONTOS[m] ?? (m.startsWith("Fatura vencida") ? PONTOS["Fatura vencida"] : 0)), 0);
        const nivel = pontos >= 50 ? "alto" : pontos >= 25 ? "medio" : "baixo";
        const variacao = ant30 ? (ult30 - ant30) / ant30 : null;
        return { b, a, ult30, ant30, variacao, motivos, pontos, nivel, donos };
    }).sort((x, y) => y.pontos - x.pontos);
}

function recomendacoes(avaliacao, chamados) {
    const lista = [];
    avaliacao.forEach(({ b, a, motivos }) => {
        if (motivos.some((m) => m.startsWith("Fatura vencida"))) lista.push(["wallet", `Cobrar ${b.nome}`, `${motivos.find((m) => m.startsWith("Fatura vencida"))}. Lembre o dono de pagar em “Minha assinatura” antes da suspensão automática.`, `#/financeiro/${b.id}`]);
        if (motivos.includes("Agenda parada")) lista.push(["calendar-x", `Ajudar ${b.nome} a usar a agenda`, "Nenhum agendamento em 14 dias. Vale um contato para entender se há dificuldade.", `#/atividade/${b.id}`]);
        if (motivos.includes("Teste terminando")) lista.push(["hourglass", `Converter o teste de ${b.nome}`, `O teste termina em ${a?.teste_ate?.split("-").reverse().join("/")}. Um contato agora aumenta a chance de a assinatura continuar.`, `#/barbearias/${b.id}`]);
        if (motivos.includes("Dono sem acessar")) lista.push(["user-x", `Reativar o dono de ${b.nome}`, "Ninguém da barbearia entrou no painel nos últimos 30 dias.", `#/barbearias/${b.id}`]);
    });
    const semResposta = chamados.filter((c) => c.nao_lido).length;
    if (semResposta) lista.unshift(["mail-warning", `Responder ${numero(semResposta)} chamado(s) de suporte`, "Há mensagens das barbearias sem resposta.", "#/suporte"]);
    return lista.slice(0, 10);
}

export async function render(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Inteligência de negócio", subtitulo: "Carregando do Supabase…" })}`);
    let dados;
    try {
        const [barbearias, assinaturas, usuarios, agendamentos, chamados] = await Promise.all([
            rpc("listar_barbearias"), rpc("listar_assinaturas").catch(() => []), rpc("listar_usuarios"),
            rpc("listar_agendamentos", { p_desde: somarDias(-59), p_ate: somarDias(0), p_barbearia: null, p_status: null, p_limite: 1000 }),
            rpc("listar_chamados").catch(() => [])
        ]);
        dados = { barbearias, assinaturas, usuarios, agendamentos, chamados };
    } catch (erro) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Inteligência de negócio", subtitulo: "Painel Master" })}
            <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar os dados", texto: erro.message })}</section>`);
        return;
    }
    const avaliacao = avaliar(dados);
    const recs = recomendacoes(avaliacao, dados.chamados);
    const ult30 = avaliacao.reduce((s, x) => s + x.ult30, 0);
    const ant30 = avaliacao.reduce((s, x) => s + x.ant30, 0);
    const variacao = ant30 ? (ult30 - ant30) / ant30 : null;
    const ativas = dados.assinaturas.filter((a) => ["ativa", "atrasada"].includes(a.status));
    const mrr = ativas.reduce((s, a) => s + Number(a.preco_mensal), 0);
    const potencial = dados.assinaturas.filter((a) => a.status === "teste").reduce((s, a) => s + Number(a.preco_mensal), 0);
    const emRisco = avaliacao.filter((x) => x.nivel === "alto");
    const receitaRisco = emRisco.reduce((s, x) => s + (["ativa", "atrasada"].includes(x.a?.status) ? Number(x.a.preco_mensal) : 0), 0);
    const comparativo = avaliacao.filter((x) => x.ult30 || x.ant30).slice(0, 8).map((x) => ({ rotulo: x.b.nome.length > 12 ? `${x.b.nome.slice(0, 11)}…` : x.b.nome, rotuloLongo: x.b.nome, atual: x.ult30, anterior: x.ant30, rotuloAnterior: x.b.nome }));

    renderizar(raiz, html`
        ${cabecalho({ titulo: "Inteligência de negócio", subtitulo: "Regras explícitas sobre os dados reais · sem IA externa, sem números inventados" })}
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Agendamentos (30 dias)", valor: numero(ult30), iconeNome: "trending-up", nota: variacao === null ? "Sem base anterior" : `${variacao >= 0 ? "+" : ""}${percentual(variacao)} vs. 30 dias anteriores`, destaque: true })}
            ${kpi({ rotulo: "Barbearias em risco alto", valor: numero(emRisco.length), iconeNome: "siren", nota: `${numero(avaliacao.filter((x) => x.nivel === "medio").length)} em risco médio` })}
            ${kpi({ rotulo: "Receita em risco", valor: moeda(receitaRisco), iconeNome: "shield-alert", nota: "Mensalidades das barbearias em risco alto" })}
            ${kpi({ rotulo: "Receita potencial dos testes", valor: moeda(potencial), iconeNome: "sparkles", nota: `Hoje: ${moeda(mrr)}/mês · se todos os testes virarem assinatura: ${moeda(mrr + potencial)}/mês` })}
        </section>
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">O que fazer agora</h2><span class="badge">${numero(recs.length)}</span></div>
                ${recs.length ? html`<ul class="lista">${recs.map(([ic, t, m, link]) => html`
                    <li class="lista__item"><span class="lista__icone">${icone(ic)}</span>
                        <div class="lista__conteudo"><a class="lista__titulo link-forte" href="${link}">${t}</a><div class="lista__meta">${m}</div></div></li>`)}</ul>`
                    : estadoVazio({ iconeNome: "circle-check", titulo: "Nada urgente", texto: "Nenhuma barbearia com sinal de risco agora." })}
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Movimento por barbearia</h2><span class="badge">últimos 30 dias × anteriores</span></div>
                <div class="card__corpo">${comparativo.length
                    ? graficoComparativo({ dados: comparativo, formatar: (v) => `${numero(v)} agendamento(s)`, formatarEixo: (v) => (Number.isInteger(v) ? numero(v) : ""), titulo: "Agendamentos por barbearia", legendas: ["Últimos 30 dias", "30 dias anteriores"] })
                    : estadoVazio({ iconeNome: "calendar", titulo: "Sem agendamentos nos últimos 60 dias" })}</div>
            </section>
        </div>
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Risco de cancelamento por barbearia</h2></div>
            <div data-tabela></div>
        </section>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Como o risco é calculado</h2><span class="badge">50+ pontos: alto · 25 a 49: médio</span></div>
            <ul class="lista">${REGRAS.map(([n, p, d]) => html`
                <li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">${n} · +${p} pontos</div><div class="lista__meta">${d}</div></div></li>`)}</ul>
            ${dados.agendamentos.length >= 1000 ? html`<p class="texto-terc texto-pequeno">Considerados os 1.000 agendamentos mais recentes dos últimos 60 dias.</p>` : ""}
        </section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "nome", rotulo: "Barbearia", valor: (x) => x.b.nome, render: (x) => html`<a class="link-forte" href="#/barbearias/${x.b.id}">${x.b.nome}</a><span class="celula-sub">${x.a ? `${x.a.plano} · ${x.a.status}` : ""}</span>` },
            { chave: "nivel", rotulo: "Risco", valor: (x) => x.pontos, render: (x) => html`${badgeStatus(NIVEIS, x.nivel)}<span class="celula-sub">${numero(x.pontos)} pontos</span>` },
            { chave: "motivos", rotulo: "Sinais", ordenavel: false, render: (x) => (x.motivos.length ? x.motivos.join(" · ") : "Nenhum sinal") },
            { chave: "ult30", rotulo: "Agend. 30 dias", classe: "col-num", valor: (x) => x.ult30, render: (x) => html`${numero(x.ult30)}${x.variacao === null ? "" : html`<span class="celula-sub">${x.variacao >= 0 ? "+" : ""}${percentual(x.variacao, 0)}</span>`}` }
        ],
        ordenacao: { chave: "nivel", direcao: "desc" }, vazio: "Nenhuma barbearia ativa.", rotulo: "Risco por barbearia"
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(avaliacao);
}
