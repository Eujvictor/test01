// =====================================================================
// MÓDULO 17 — RELATÓRIOS E MÉTRICAS (MODO REAL)
// Rotas: #/relatorios        → catálogo
//        #/relatorios/<id>   → relatório com indicadores, prévia e
//                              exportação (CSV, Excel, PDF)
// Fontes: funções control_api já usadas pelos outros módulos
// (administrador + MFA). Telefones de clientes nunca entram.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda, dataHora, percentual } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { exportarRelatorio, formatarValor, FORMATOS_EXPORTACAO } from "../../js/utilities/exportar.js";
import { criarTabela } from "../../js/components/tabela.js";
import { cabecalho, kpi, estadoVazio, campoSelect, novaRaiz } from "../../js/components/ui.js";

const dia = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somarDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
const ROTULO = {
    barbearia: { teste: "Em teste", ativa: "Ativa", suspensa: "Suspensa", cancelada: "Cancelada" },
    assinatura: { teste: "Em teste", ativa: "Ativa", atrasada: "Atrasada", isenta: "Isenta", cancelada: "Cancelada" },
    fatura: { aberta: "A vencer", vencida: "Vencida", paga: "Paga", cancelada: "Cancelada" },
    usuario: { master: "Administrador do SaaS", proprietario: "Proprietário", gerente: "Gerente", sem_vinculo: "Sem vínculo" },
    chamado: { aberto: "Aberto", em_atendimento: "Em atendimento", aguardando: "Aguardando a barbearia", resolvido: "Resolvido", encerrado: "Encerrado" }
};
const PERIODOS = [["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["180", "Últimos 180 dias"], ["365", "Últimos 12 meses"]];

// Cada relatório: carregar(dias) → linhas · colunas [{rotulo, valor, formato}] · kpis(linhas) → [[rotulo, texto]]
const RELATORIOS = [
    {
        id: "barbearias", titulo: "Barbearias", icone: "store", descricao: "Cadastro, situação, plano e movimento de cada barbearia.",
        carregar: async () => {
            const [b, a] = await Promise.all([rpc("listar_barbearias"), rpc("listar_assinaturas").catch(() => [])]);
            const porB = new Map(a.map((x) => [x.barbearia_id, x]));
            return b.map((x) => ({ ...x, plano: porB.get(x.id)?.plano ?? "", assinatura: porB.get(x.id)?.status ?? "" }));
        },
        colunas: [
            { rotulo: "Barbearia", valor: (l) => l.nome }, { rotulo: "Endereço do site", valor: (l) => `?b=${l.slug}` },
            { rotulo: "Situação", valor: (l) => ROTULO.barbearia[l.status] ?? l.status }, { rotulo: "Cidade", valor: (l) => [l.cidade, l.estado].filter(Boolean).join("/") },
            { rotulo: "Plano", valor: (l) => l.plano }, { rotulo: "Assinatura", valor: (l) => ROTULO.assinatura[l.assinatura] ?? l.assinatura },
            { rotulo: "Acessos ao painel", valor: (l) => Number(l.membros), formato: "numero" }, { rotulo: "Barbeiros", valor: (l) => Number(l.barbeiros), formato: "numero" },
            { rotulo: "Agendamentos (30 dias)", valor: (l) => Number(l.agendamentos_30d), formato: "numero" }, { rotulo: "Cadastrada em", valor: (l) => dataHora(l.criado_em) }
        ],
        kpis: (l) => [["Barbearias", numero(l.length)], ["Ativas", numero(l.filter((x) => x.status === "ativa").length)], ["Em teste", numero(l.filter((x) => x.status === "teste").length)], ["Agendamentos (30 dias)", numero(l.reduce((s, x) => s + Number(x.agendamentos_30d || 0), 0))]]
    },
    {
        id: "agendamentos", titulo: "Agendamentos", icone: "calendar-check", descricao: "Agendamentos de todas as barbearias no período (sem telefone de clientes).", periodo: true,
        carregar: (dias) => rpc("listar_agendamentos", { p_desde: somarDias(-(dias - 1)), p_ate: somarDias(0), p_barbearia: null, p_status: null, p_limite: 1000 }),
        colunas: [
            { rotulo: "Data", valor: (l) => dia(l.data) }, { rotulo: "Horário", valor: (l) => String(l.horario ?? "").slice(0, 5) },
            { rotulo: "Barbearia", valor: (l) => l.barbearia }, { rotulo: "Cliente", valor: (l) => l.cliente ?? "" },
            { rotulo: "Serviço", valor: (l) => l.servico ?? "" }, { rotulo: "Barbeiro", valor: (l) => l.barbeiro ?? "" },
            { rotulo: "Status", valor: (l) => l.status ?? "" }, { rotulo: "Preço", valor: (l) => l.preco, formato: "moeda" }
        ],
        kpis: (l) => {
            const canc = l.filter((x) => /^cancel/i.test(x.status ?? "")).length;
            const fin = l.filter((x) => ["finalizado", "concluido", "realizado"].includes(String(x.status).toLowerCase()));
            return [["Agendamentos", numero(l.length)], ["Finalizados", numero(fin.length)], ["Taxa de cancelamento", l.length ? percentual(canc / l.length) : "—"], ["Receita estimada", moeda(fin.reduce((s, x) => s + Number(x.preco || 0), 0))]];
        },
        aviso: (l) => (l.length >= 1000 ? "Mostrando os 1.000 agendamentos mais recentes do período. Reduza o período para ver todos." : "")
    },
    {
        id: "faturas", titulo: "Faturas e receita", icone: "receipt", descricao: "Faturas do Barber às barbearias: pagas, a vencer, vencidas e taxas.", periodo: true,
        carregar: (dias) => rpc("listar_faturas", { p_barbearia: null, p_situacao: null, p_desde: somarDias(-(dias - 1)), p_ate: somarDias(60), p_limite: 2000 }),
        colunas: [
            { rotulo: "Vencimento", valor: (l) => dia(l.vencimento) }, { rotulo: "Barbearia", valor: (l) => l.barbearia }, { rotulo: "Plano", valor: (l) => l.plano },
            { rotulo: "Valor", valor: (l) => l.valor, formato: "moeda" }, { rotulo: "Situação", valor: (l) => ROTULO.fatura[l.situacao] ?? l.situacao },
            { rotulo: "Pago em", valor: (l) => (l.pago_em ? dataHora(l.pago_em) : "") }, { rotulo: "Método", valor: (l) => l.metodo ?? "" },
            { rotulo: "Taxa", valor: (l) => l.taxa, formato: "moeda" }
        ],
        kpis: (l) => {
            const pagas = l.filter((x) => x.situacao === "paga");
            return [["Recebido", moeda(pagas.reduce((s, x) => s + Number(x.valor_pago || 0), 0))], ["Taxas", moeda(pagas.reduce((s, x) => s + Number(x.taxa || 0), 0))],
                ["A vencer", moeda(l.filter((x) => x.situacao === "aberta").reduce((s, x) => s + Number(x.valor), 0))], ["Vencido", moeda(l.filter((x) => x.situacao === "vencida").reduce((s, x) => s + Number(x.valor), 0))]];
        }
    },
    {
        id: "assinaturas", titulo: "Assinaturas", icone: "badge-check", descricao: "Plano, situação, valores em aberto e último pagamento de cada barbearia.",
        carregar: () => rpc("listar_assinaturas"),
        colunas: [
            { rotulo: "Barbearia", valor: (l) => l.barbearia }, { rotulo: "Plano", valor: (l) => l.plano }, { rotulo: "Mensalidade", valor: (l) => l.preco_mensal, formato: "moeda" },
            { rotulo: "Situação", valor: (l) => ROTULO.assinatura[l.status] ?? l.status }, { rotulo: "Teste até", valor: (l) => dia(l.teste_ate) },
            { rotulo: "Próximo vencimento", valor: (l) => dia(l.proximo_vencimento) }, { rotulo: "Em aberto", valor: (l) => l.valor_em_aberto, formato: "moeda" },
            { rotulo: "Dias de atraso", valor: (l) => l.dias_atraso ?? 0, formato: "numero" }, { rotulo: "Último pagamento", valor: (l) => (l.ultimo_pagamento ? dataHora(l.ultimo_pagamento) : "") }
        ],
        kpis: (l) => [["Receita recorrente mensal", moeda(l.filter((x) => ["ativa", "atrasada"].includes(x.status)).reduce((s, x) => s + Number(x.preco_mensal), 0))], ["Ativas", numero(l.filter((x) => x.status === "ativa").length)], ["Em teste", numero(l.filter((x) => x.status === "teste").length)], ["Atrasadas", numero(l.filter((x) => x.status === "atrasada").length)]]
    },
    {
        id: "usuarios", titulo: "Usuários e acessos", icone: "users", descricao: "Contas de login, barbearia vinculada, duas etapas e último acesso.",
        carregar: () => rpc("listar_usuarios"),
        colunas: [
            { rotulo: "E-mail", valor: (l) => l.email }, { rotulo: "Tipo", valor: (l) => ROTULO.usuario[l.tipo] ?? l.tipo }, { rotulo: "Barbearia", valor: (l) => l.barbearia ?? "" },
            { rotulo: "Situação", valor: (l) => (l.tipo === "sem_vinculo" ? "Sem acesso" : l.ativo ? "Ativo" : "Desativado") }, { rotulo: "Duas etapas", valor: (l) => (l.mfa ? "Sim" : "Não") },
            { rotulo: "Último acesso", valor: (l) => (l.ultimo_acesso ? dataHora(l.ultimo_acesso) : "Nunca") }
        ],
        kpis: (l) => [["Contas", numero(new Set(l.map((x) => x.user_id)).size)], ["Donos e gerentes ativos", numero(l.filter((x) => ["proprietario", "gerente"].includes(x.tipo) && x.ativo).length)], ["Com duas etapas", numero(l.filter((x) => x.mfa).length)], ["Sem vínculo", numero(l.filter((x) => x.tipo === "sem_vinculo").length)]]
    },
    {
        id: "suporte", titulo: "Chamados de suporte", icone: "life-buoy", descricao: "Chamados das barbearias: assunto, prioridade, situação e tempo de resolução.",
        carregar: () => rpc("listar_chamados"),
        colunas: [
            { rotulo: "Protocolo", valor: (l) => Number(l.protocolo), formato: "numero" }, { rotulo: "Assunto", valor: (l) => l.assunto }, { rotulo: "Barbearia", valor: (l) => l.barbearia },
            { rotulo: "Categoria", valor: (l) => l.categoria }, { rotulo: "Prioridade", valor: (l) => l.prioridade }, { rotulo: "Situação", valor: (l) => ROTULO.chamado[l.status] ?? l.status },
            { rotulo: "Mensagens", valor: (l) => Number(l.mensagens), formato: "numero" }, { rotulo: "Aberto em", valor: (l) => dataHora(l.criado_em) },
            { rotulo: "Horas até resolver", valor: (l) => (l.resolvido_em ? Math.round((new Date(l.resolvido_em) - new Date(l.criado_em)) / 360000) / 10 : null), formato: "decimal" }
        ],
        kpis: (l) => {
            const resolvidos = l.filter((x) => x.resolvido_em);
            const media = resolvidos.length ? resolvidos.reduce((s, x) => s + (new Date(x.resolvido_em) - new Date(x.criado_em)), 0) / resolvidos.length / 3600000 : null;
            return [["Chamados", numero(l.length)], ["Em andamento", numero(l.filter((x) => ["aberto", "em_atendimento", "aguardando"].includes(x.status)).length)], ["Resolvidos", numero(resolvidos.length)], ["Tempo médio até resolver", media === null ? "—" : `${numero(Math.round(media * 10) / 10)} h`]];
        }
    },
    {
        id: "auditoria", titulo: "Auditoria", icone: "scroll-text", descricao: "Ações registradas na trilha imutável (até 500 mais recentes do período).", periodo: true,
        carregar: (dias) => rpc("buscar_auditoria", { p_desde: new Date(Date.now() - dias * 86400000).toISOString(), p_ate: null, p_acao: null, p_busca: null, p_limite: 500, p_antes: null }),
        colunas: [
            { rotulo: "Registro", valor: (l) => Number(l.id), formato: "numero" }, { rotulo: "Quando", valor: (l) => dataHora(l.ocorrido_em) }, { rotulo: "Ação", valor: (l) => l.acao },
            { rotulo: "Quem", valor: (l) => l.ator_email ?? "sistema" }, { rotulo: "Alvo", valor: (l) => `${l.entidade ?? ""} ${l.entidade_id ?? ""}`.trim() }, { rotulo: "IP", valor: (l) => l.ip ?? "" },
            { rotulo: "Detalhes", valor: (l) => JSON.stringify(l.detalhes ?? {}) }
        ],
        kpis: (l) => [["Eventos", numero(l.length)], ["Pessoas", numero(new Set(l.map((x) => x.ator_email ?? "sistema")).size)], ["Ações diferentes", numero(new Set(l.map((x) => x.acao)).size)]]
    }
];

function renderCatalogo(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Relatórios e métricas", subtitulo: "Relatórios com dados reais · exportação em CSV, Excel ou PDF" })}
        <div class="relatorios-catalogo">
            ${RELATORIOS.map((r) => html`
                <article class="relatorio-card">
                    <div class="relatorio-card__topo">
                        <span class="relatorio-card__icone">${icone(r.icone)}</span>
                        <span class="badge badge--sucesso">Dados reais</span>
                    </div>
                    <h3>${r.titulo}</h3>
                    <p>${r.descricao}</p>
                    <a class="btn btn--primario btn--pequeno" href="#/relatorios/${r.id}" data-relatorio="${r.id}">${icone("file-chart-column")}<span>Gerar relatório</span></a>
                </article>`)}
        </div>`);
}

async function renderRelatorio(view, rel, dias) {
    const raiz = novaRaiz(view);
    const voltar = { href: "#/relatorios", rotulo: "Relatórios" };
    renderizar(raiz, html`${cabecalho({ titulo: rel.titulo, subtitulo: "Carregando do Supabase…", voltar })}`);
    let linhas;
    try {
        linhas = await rel.carregar(dias);
    } catch (erro) {
        renderizar(raiz, html`${cabecalho({ titulo: rel.titulo, voltar })}
            <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível gerar o relatório", texto: erro.message })}</section>`);
        return;
    }
    const kpis = rel.kpis(linhas);
    const periodoTexto = rel.periodo ? PERIODOS.find(([v]) => Number(v) === dias)?.[1] : "Situação atual";
    const aviso = rel.aviso?.(linhas);
    renderizar(raiz, html`
        ${cabecalho({
            titulo: rel.titulo, subtitulo: `${rel.descricao} · ${periodoTexto}`, voltar,
            acoes: html`${Object.entries(FORMATOS_EXPORTACAO).map(([f, r]) => html`<button class="btn" type="button" data-exportar="${f}">${icone(f === "pdf" ? "file-text" : f === "xlsx" ? "file-spreadsheet" : "file-down")}<span>${r}</span></button>`)}`
        })}
        ${rel.periodo ? html`<div class="barra-filtros barra-filtros--solta">${campoSelect({ id: "rPeriodo", rotulo: "Período", valor: String(dias), opcoes: PERIODOS })}</div>` : ""}
        <section class="grade grade--kpi secao">${kpis.map(([r, v], i) => kpi({ rotulo: r, valor: v, iconeNome: i === 0 ? rel.icone : "chart-no-axes-column", destaque: i === 0 }))}</section>
        ${aviso ? html`<div class="alerta alerta--atencao secao" role="note">${icone("triangle-alert")}<span>${aviso}</span></div>` : ""}
        <section class="card"><div class="card__cabecalho"><h2 class="card__titulo">Prévia</h2><span class="badge">${numero(linhas.length)} registro(s)</span></div><div data-tabela></div></section>`);

    const tabela = criarTabela({
        colunas: rel.colunas.map((c, i) => ({
            chave: `c${i}`, rotulo: c.rotulo, classe: ["moeda", "numero", "decimal"].includes(c.formato) ? "col-num" : "",
            valor: (l) => c.valor(l), render: (l) => formatarValor(c.valor(l), c.formato) || "—"
        })),
        vazio: "Nenhum registro no período.", rotulo: rel.titulo
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas);
    raiz.querySelector("#rPeriodo")?.addEventListener("change", (e) => renderRelatorio(view, rel, Number(e.target.value)));
    raiz.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-exportar]");
        if (!botao) return;
        if (!linhas.length) return mostrarToast("Nada para exportar.", "atencao");
        try {
            const r = exportarRelatorio(botao.dataset.exportar, {
                real: true, arquivo: `relatorio-${rel.id}`, titulo: `Barber Control · ${rel.titulo}`, subtitulo: rel.descricao,
                metadados: [["Período", periodoTexto]], kpis, colunas: rel.colunas, linhas, observacoes: aviso ? [aviso] : []
            });
            mostrarToast(`Arquivo ${r?.nome ?? ""} gerado.`, "sucesso");
        } catch (erro) {
            mostrarToast(erro.message || "Falha ao exportar.", "erro");
        }
    });
}

export function render(view, { parametros = [] }) {
    const rel = RELATORIOS.find((r) => r.id === parametros[0]);
    if (rel) renderRelatorio(view, rel, 30);
    else renderCatalogo(view);
}
