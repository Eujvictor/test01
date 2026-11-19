// =====================================================================
// REGRAS DE NEGÓCIO — OPERAÇÃO E RELACIONAMENTO (módulos 06 a 09)
// Usa as mesmas barbearias, planos, assinaturas e usuários dos módulos
// 02–05. Nada é enviado: comunicados, campanhas e pesquisas são
// apenas registros demonstrativos.
// =====================================================================
import { listar, obter, inserir, atualizar, registrarHistorico, historicoDe, proximaSequencia, salvar, geracaoDados } from "./store.js";
import { SERVICOS, STATUS_CHAMADO, PRIORIDADES, RESPONSAVEIS_SUPORTE, CATEGORIAS_COMUNICADO, TIPOS_CAMPANHA } from "./catalogo.js";
import { numeroDoDia, dataDoNumero } from "./seed-operacao.js";
import { ErroValidacao, barbearia, barbearias, plano, assinaturaDaBarbearia, usuario, usuarios } from "./saas.js";

export { historicoDe };

const DIA = 86400000;
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const hojeNumero = () => numeroDoDia(new Date());
const hojeTexto = () => dataDoNumero(hojeNumero());
const STATUS_LETRA = { r: "realizado", p: "pendente", c: "cancelado" };

// =====================================================================
// AGENDAMENTOS E ATIVIDADE (módulo 06)
// =====================================================================
let memo = { geracao: -1, lista: [] };

export function agendamentos() {
    const g = geracaoDados();
    if (memo.geracao !== g) {
        memo = {
            geracao: g,
            lista: listar("agendamentos").map(([barbeariaId, servicoId, barbeiroId, dia, minuto, st], i) => ({
                id: `AG-${String(i + 1).padStart(6, "0")}`,
                barbeariaId, servicoId, barbeiroId, dia, minuto,
                data: dataDoNumero(dia),
                hora: `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`,
                status: STATUS_LETRA[st]
            }))
        };
    }
    return memo.lista;
}

export const servico = (id) => SERVICOS[id] ?? null;

// Janela: últimos N dias (incluindo hoje) + agenda futura dos próximos 14 dias.
export function janela(periodo) {
    const hoje = hojeNumero();
    return { inicio: hoje - Number(periodo) + 1, fim: hoje + 14, hoje };
}

export function filtrarAgendamentos({ periodo = 30, barbeariaId = "", status = "", servicoId = "", busca = "" } = {}) {
    const { inicio, fim } = janela(periodo);
    const termo = normalizar(busca);
    return agendamentos().filter((a) =>
        a.dia >= inicio && a.dia <= fim &&
        (!barbeariaId || a.barbeariaId === barbeariaId) &&
        (!status || a.status === status) &&
        (servicoId === "" || servicoId === null || a.servicoId === Number(servicoId)) &&
        (!termo || normalizar(a.id).includes(termo) || normalizar(usuario(a.barbeiroId)?.nome).includes(termo) ||
            normalizar(barbearia(a.barbeariaId)?.nome).includes(termo)));
}

export function resumoAgendamentos(lista, quantidadeBarbearias) {
    const realizados = lista.filter((a) => a.status === "realizado").length;
    const cancelados = lista.filter((a) => a.status === "cancelado").length;
    const pendentes = lista.filter((a) => a.status === "pendente").length;
    const encerrados = realizados + cancelados;
    return {
        total: lista.length, realizados, cancelados, pendentes,
        taxaCancelamento: encerrados ? cancelados / encerrados : 0,
        mediaPorBarbearia: quantidadeBarbearias ? lista.length / quantidadeBarbearias : 0
    };
}

export function rankingBarbearias(lista) {
    const contagem = new Map(barbearias().filter((b) => b.status !== "cancelada").map((b) => [b.id, 0]));
    lista.forEach((a) => { if (contagem.has(a.barbeariaId)) contagem.set(a.barbeariaId, contagem.get(a.barbeariaId) + 1); });
    return [...contagem.entries()].map(([id, total]) => ({ barbearia: barbearia(id), total })).sort((a, b) => b.total - a.total);
}

const rotuloDia = (dia) => dataDoNumero(dia).split("-").reverse().slice(0, 2).join("/");
const semanaDe = (dia) => dia - ((new Date(dia * DIA).getUTCDay() + 6) % 7);

export function seriePorDia(lista, dias) {
    const { hoje } = janela(1);
    const inicio = hoje - Math.min(dias, 30) + 1;
    const totais = new Map();
    for (let d = inicio; d <= hoje; d++) totais.set(d, 0);
    lista.forEach((a) => { if (totais.has(a.dia)) totais.set(a.dia, totais.get(a.dia) + 1); });
    return [...totais.entries()].map(([dia, valor]) => ({ rotulo: rotuloDia(dia), rotuloLongo: dataDoNumero(dia).split("-").reverse().join("/"), valor }));
}

export function seriePorSemana(lista, dias) {
    const { hoje } = janela(1);
    const totais = new Map();
    for (let d = semanaDe(hoje - dias + 1); d <= hoje; d += 7) totais.set(d, 0);
    lista.forEach((a) => {
        if (a.dia > hoje) return;
        const s = semanaDe(a.dia);
        if (totais.has(s)) totais.set(s, totais.get(s) + 1);
    });
    return [...totais.entries()].map(([s, valor]) => ({ rotulo: rotuloDia(s), rotuloLongo: `Semana de ${dataDoNumero(s).split("-").reverse().join("/")}`, valor }));
}

export function seriePorMes(lista, meses = 6) {
    const agora = new Date();
    const chaves = [];
    for (let m = meses - 1; m >= 0; m--) {
        const ref = new Date(agora.getFullYear(), agora.getMonth() - m, 1);
        chaves.push(`${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`);
    }
    const totais = new Map(chaves.map((c) => [c, 0]));
    const hoje = hojeNumero();
    lista.forEach((a) => {
        if (a.dia > hoje) return;
        const chave = a.data.slice(0, 7);
        if (totais.has(chave)) totais.set(chave, totais.get(chave) + 1);
    });
    return chaves.map((mes) => ({ mes, valor: totais.get(mes) }));
}

export function seriePorHora(lista) {
    const totais = new Map();
    for (let h = 8; h <= 19; h++) totais.set(h, 0);
    lista.forEach((a) => {
        const h = Math.floor(a.minuto / 60);
        if (totais.has(h)) totais.set(h, totais.get(h) + 1);
    });
    return [...totais.entries()].map(([h, valor]) => ({ rotulo: `${h}h`, rotuloLongo: `${h}h às ${h + 1}h`, valor }));
}

export function rankingServicos(lista) {
    const totais = new Map(SERVICOS.map((s) => [s.id, 0]));
    lista.forEach((a) => totais.set(a.servicoId, (totais.get(a.servicoId) ?? 0) + 1));
    return [...totais.entries()].map(([id, valor]) => ({ servico: SERVICOS[id], valor })).sort((a, b) => b.valor - a.valor);
}

// Barbearias com ao menos um agendamento por semana (evolução da atividade).
export function serieBarbeariasAtivas(lista, dias) {
    const { hoje } = janela(1);
    const semanas = new Map();
    for (let d = semanaDe(hoje - dias + 1); d <= hoje; d += 7) semanas.set(d, new Set());
    lista.forEach((a) => {
        if (a.dia > hoje || a.status === "cancelado") return;
        const s = semanaDe(a.dia);
        semanas.get(s)?.add(a.barbeariaId);
    });
    return [...semanas.entries()].map(([s, set]) => ({ rotulo: rotuloDia(s), rotuloLongo: `Semana de ${dataDoNumero(s).split("-").reverse().join("/")}`, valor: set.size }));
}

// Período atual (últimos N dias até hoje) × período anterior de mesmo tamanho.
export function compararPeriodos({ periodo = 30, barbeariaId = "", servicoId = "" } = {}) {
    const hoje = hojeNumero();
    const n = Number(periodo);
    const medir = (inicio, fim) => {
        const l = agendamentos().filter((a) => a.dia >= inicio && a.dia <= fim &&
            (!barbeariaId || a.barbeariaId === barbeariaId) && (servicoId === "" || a.servicoId === Number(servicoId)));
        const realizados = l.filter((a) => a.status === "realizado").length;
        const cancelados = l.filter((a) => a.status === "cancelado").length;
        return {
            total: l.length, realizados, cancelados,
            taxaCancelamento: realizados + cancelados ? cancelados / (realizados + cancelados) : 0,
            barbeariasAtivas: new Set(l.filter((a) => a.status !== "cancelado").map((a) => a.barbeariaId)).size
        };
    };
    const atual = medir(hoje - n + 1, hoje);
    const anterior = medir(hoje - 2 * n + 1, hoje - n);
    const variacao = (a, b) => (b ? (a - b) / b : null);
    return {
        atual, anterior,
        variacao: {
            total: variacao(atual.total, anterior.total),
            realizados: variacao(atual.realizados, anterior.realizados),
            cancelados: variacao(atual.cancelados, anterior.cancelados),
            barbeariasAtivas: variacao(atual.barbeariasAtivas, anterior.barbeariasAtivas)
        }
    };
}

// Alertas demonstrativos calculados sobre os últimos 30 dias × 30 dias anteriores.
export function alertasAtividade() {
    const hoje = hojeNumero();
    const porBarbearia = new Map();
    agendamentos().forEach((a) => {
        if (a.dia > hoje) return;
        let m = porBarbearia.get(a.barbeariaId);
        if (!m) porBarbearia.set(a.barbeariaId, m = { atual: 0, anterior: 0, cancAtual: 0, cancAnterior: 0, ultimo: -Infinity });
        const atras = hoje - a.dia;
        if (a.status !== "cancelado") m.ultimo = Math.max(m.ultimo, a.dia);
        if (atras < 30) { m.atual++; if (a.status === "cancelado") m.cancAtual++; }
        else if (atras < 60) { m.anterior++; if (a.status === "cancelado") m.cancAnterior++; }
    });
    const alertas = [];
    barbearias().filter((b) => b.status !== "cancelada").forEach((b) => {
        const m = porBarbearia.get(b.id) ?? { atual: 0, anterior: 0, cancAtual: 0, cancAnterior: 0, ultimo: -Infinity };
        const diasSemAtividade = hoje - m.ultimo;
        const novo = hoje - numeroDoDia(b.criadoEm) < 30;
        if (diasSemAtividade >= 14 && !novo) {
            alertas.push({ tipo: "inatividade", gravidade: "alta", barbeariaId: b.id, titulo: "Sem atividade recente",
                descricao: Number.isFinite(diasSemAtividade) ? `Nenhum agendamento realizado há ${diasSemAtividade} dias.` : "Nenhum agendamento registrado." });
            return;
        }
        if (m.anterior >= 20 && m.atual <= m.anterior * 0.7) {
            alertas.push({ tipo: "queda", gravidade: "media", barbeariaId: b.id, titulo: "Queda de agendamentos",
                descricao: `${m.atual} agendamentos nos últimos 30 dias contra ${m.anterior} no período anterior (${Math.round((m.atual / m.anterior - 1) * 100)}%).` });
        }
        const taxaAtual = m.atual ? m.cancAtual / m.atual : 0;
        const taxaAnterior = m.anterior ? m.cancAnterior / m.anterior : 0;
        if (m.atual >= 20 && taxaAtual >= 0.15 && taxaAtual >= taxaAnterior * 1.5) {
            alertas.push({ tipo: "cancelamentos", gravidade: "media", barbeariaId: b.id, titulo: "Aumento de cancelamentos",
                descricao: `Taxa de cancelamento de ${Math.round(taxaAtual * 100)}% nos últimos 30 dias (antes: ${Math.round(taxaAnterior * 100)}%).` });
        }
        if (m.anterior >= 20 && m.atual >= m.anterior * 1.3) {
            alertas.push({ tipo: "crescimento", gravidade: "positiva", barbeariaId: b.id, titulo: "Crescimento significativo",
                descricao: `+${Math.round((m.atual / m.anterior - 1) * 100)}% de agendamentos nos últimos 30 dias.` });
        }
    });
    const ordem = { alta: 0, media: 1, positiva: 2 };
    return alertas.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
}

// Contagem por barbearia calculada uma vez por conjunto de dados e por dia
// (a segmentação chama esta função muitas vezes por tela).
let memo30 = { chave: "", mapa: new Map() };
export function agendamentos30Dias(barbeariaId) {
    const hoje = hojeNumero();
    const chave = `${geracaoDados()}|${hoje}`;
    if (memo30.chave !== chave) {
        const mapa = new Map();
        agendamentos().forEach((a) => {
            if (a.dia <= hoje && a.dia > hoje - 30) mapa.set(a.barbeariaId, (mapa.get(a.barbeariaId) ?? 0) + 1);
        });
        memo30 = { chave, mapa };
    }
    return memo30.mapa.get(barbeariaId) ?? 0;
}

// =====================================================================
// SEGMENTAÇÃO (usada por campanhas e pelo módulo 09)
// =====================================================================
export function metricasBarbearia(b) {
    const a = assinaturaDaBarbearia(b.id);
    const p = a ? plano(a.planoId) : null;
    const dias = Math.floor((Date.now() - new Date(b.criadoEm)) / DIA);
    const ag30 = agendamentos30Dias(b.id);
    const faixaCadastro = dias <= 30 ? "novo" : dias <= 180 ? "recente" : dias <= 365 ? "consolidado" : "antigo";
    const nivelAtividade = ag30 >= 120 ? "alta" : ag30 >= 40 ? "media" : ag30 > 0 ? "baixa" : "sem";
    const utilizacao = p?.limiteAgendamentos ? ag30 / p.limiteAgendamentos : null;
    const nivelUtilizacao = utilizacao === null ? "ilimitado" : utilizacao >= 0.7 ? "alta" : utilizacao >= 0.3 ? "media" : "baixa";
    return { barbearia: b, assinatura: a, plano: p, diasCadastro: dias, faixaCadastro, ag30, nivelAtividade, utilizacao, nivelUtilizacao };
}

// filtros: { planos[], status[], faixas[], atividade[], utilizacao[], assinatura[] } — vazio = qualquer
export function segmentar(filtros = {}) {
    const em = (lista, valor) => !lista?.length || lista.includes(valor);
    return barbearias().map(metricasBarbearia).filter((m) =>
        em(filtros.planos, m.plano?.id) && em(filtros.status, m.barbearia.status) && em(filtros.faixas, m.faixaCadastro) &&
        em(filtros.atividade, m.nivelAtividade) && em(filtros.utilizacao, m.nivelUtilizacao) && em(filtros.assinatura, m.assinatura?.status));
}

export function descreverFiltros(filtros = {}) {
    const partes = [];
    if (filtros.planos?.length) partes.push(`plano ${filtros.planos.map((id) => plano(id)?.nome ?? id).join("/")}`);
    if (filtros.status?.length) partes.push(`status ${filtros.status.join("/")}`);
    if (filtros.faixas?.length) partes.push(`cadastro ${filtros.faixas.join("/")}`);
    if (filtros.atividade?.length) partes.push(`atividade ${filtros.atividade.join("/")}`);
    if (filtros.utilizacao?.length) partes.push(`utilização ${filtros.utilizacao.join("/")}`);
    if (filtros.assinatura?.length) partes.push(`assinatura ${filtros.assinatura.join("/")}`);
    return partes.length ? partes.join(" · ") : "Todas as barbearias";
}

// =====================================================================
// SUPORTE (módulo 07)
// =====================================================================
export const chamados = () => listar("chamados");
export const chamado = (id) => obter("chamados", id);
export const rotuloResponsavel = (id) => RESPONSAVEIS_SUPORTE.find(([v]) => v === id)?.[1] ?? "Não atribuído";

function tocarChamado(c) {
    c.atualizadoEm = new Date().toISOString();
    salvar();
}

export function resumoSuporte() {
    const lista = chamados();
    const contar = (st) => lista.filter((c) => c.status === st).length;
    const resolvidos = lista.filter((c) => c.resolvidoEm);
    const horas = resolvidos.map((c) => (new Date(c.resolvidoEm) - new Date(c.abertoEm)) / 3600000);
    return {
        total: lista.length, abertos: contar("aberto"), emAtendimento: contar("em_atendimento"), aguardando: contar("aguardando"),
        resolvidos: contar("resolvido") + contar("encerrado"),
        prioritarios: lista.filter((c) => (c.prioridade === "alta" || c.prioridade === "critica") && !["resolvido", "encerrado"].includes(c.status)).length,
        tempoMedioHoras: horas.length ? horas.reduce((s, h) => s + h, 0) / horas.length : null
    };
}

export function criarChamado(dados) {
    const b = barbearia(dados.barbeariaId);
    if (!b) throw new ErroValidacao("Selecione uma barbearia.", "barbeariaId");
    const solicitante = usuario(dados.solicitanteId);
    if (!solicitante || solicitante.barbeariaId !== b.id) {
        throw new ErroValidacao("O solicitante precisa pertencer à barbearia selecionada.", "solicitanteId");
    }
    const seq = proximaSequencia("chamado");
    const protocolo = `BC-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
    const agora = new Date().toISOString();
    const novo = inserir("chamados", {
        protocolo, titulo: dados.titulo.trim(), descricao: dados.descricao.trim(), categoria: dados.categoria, prioridade: dados.prioridade,
        status: "aberto", barbeariaId: b.id, solicitanteId: solicitante.id, responsavel: dados.responsavel || null,
        mensagens: [{ id: `m_${Date.now().toString(36)}`, autor: "cliente", nome: solicitante.nome, texto: dados.descricao.trim(), data: agora }],
        notas: [], suporteAssistido: { status: "nao_solicitado" }, abertoEm: agora, resolvidoEm: null
    });
    registrarHistorico({ entidade: "chamado", entidadeId: novo.id, acao: "aberto", descricao: `Chamado ${protocolo} registrado pelo painel em nome de ${solicitante.nome}.` });
    return novo;
}

export function responderChamado(id, texto, { aguardarCliente = false } = {}) {
    const c = chamado(id);
    if (!c) throw new Error("Chamado não encontrado.");
    if (c.status === "encerrado") throw new Error("Chamados encerrados não recebem respostas. Reabra o chamado.");
    c.mensagens.push({ id: `m_${Date.now().toString(36)}`, autor: "suporte", nome: "Suporte Barber", texto: texto.trim(), data: new Date().toISOString() });
    const anterior = c.status;
    if (aguardarCliente) c.status = "aguardando";
    else if (c.status === "aberto") c.status = "em_atendimento";
    if (!c.responsavel) c.responsavel = "proprietario";
    tocarChamado(c);
    registrarHistorico({ entidade: "chamado", entidadeId: id, acao: "resposta", descricao: "Resposta adicionada à conversa (demonstração; nenhum e-mail enviado)." });
    if (anterior !== c.status) registrarHistorico({ entidade: "chamado", entidadeId: id, acao: "status", descricao: `Status alterado de ${STATUS_CHAMADO[anterior].rotulo} para ${STATUS_CHAMADO[c.status].rotulo}.` });
}

export function adicionarNota(id, texto) {
    const c = chamado(id);
    if (!c) throw new Error("Chamado não encontrado.");
    c.notas.push({ id: `n_${Date.now().toString(36)}`, texto: texto.trim(), autor: "Proprietário do SaaS", data: new Date().toISOString() });
    tocarChamado(c);
    registrarHistorico({ entidade: "chamado", entidadeId: id, acao: "nota", descricao: "Observação interna adicionada (visível só para a equipe)." });
}

export function alterarStatusChamado(id, status, comentario = "") {
    const c = chamado(id);
    if (!c) throw new Error("Chamado não encontrado.");
    if (!STATUS_CHAMADO[status]) throw new ErroValidacao("Status inválido.", "status");
    if (c.status === status) throw new ErroValidacao("O chamado já está neste status.", "status");
    const anterior = c.status;
    c.status = status;
    if (status === "resolvido" || status === "encerrado") c.resolvidoEm ??= new Date().toISOString();
    else c.resolvidoEm = null;
    if (c.suporteAssistido?.status === "autorizado" && (status === "resolvido" || status === "encerrado")) {
        c.suporteAssistido = { ...c.suporteAssistido, status: "encerrado", encerradoEm: new Date().toISOString() };
        registrarHistorico({ entidade: "chamado", entidadeId: id, acao: "assistido_encerrado", descricao: "Sessão de suporte assistido encerrada junto com o chamado." });
    }
    tocarChamado(c);
    registrarHistorico({ entidade: "chamado", entidadeId: id, acao: "status", descricao: `Status alterado de ${STATUS_CHAMADO[anterior].rotulo} para ${STATUS_CHAMADO[status].rotulo}.${comentario ? ` ${comentario}` : ""}` });
}

export function alterarPrioridade(id, prioridade) {
    const c = chamado(id);
    if (!c) throw new Error("Chamado não encontrado.");
    if (c.prioridade === prioridade) throw new ErroValidacao("O chamado já tem esta prioridade.", "prioridade");
    const anterior = c.prioridade;
    c.prioridade = prioridade;
    tocarChamado(c);
    registrarHistorico({ entidade: "chamado", entidadeId: id, acao: "prioridade", descricao: `Prioridade alterada de ${PRIORIDADES[anterior].rotulo} para ${PRIORIDADES[prioridade].rotulo}.` });
}

export function atribuirResponsavel(id, responsavel) {
    const c = chamado(id);
    if (!c) throw new Error("Chamado não encontrado.");
    if (c.responsavel === responsavel) throw new ErroValidacao("Este já é o responsável atual.", "responsavel");
    c.responsavel = responsavel;
    tocarChamado(c);
    registrarHistorico({ entidade: "chamado", entidadeId: id, acao: "responsavel", descricao: `Responsável definido: ${rotuloResponsavel(responsavel)}.` });
}

// ---------- Suporte assistido: sempre com autorização explícita ----------
export function solicitarSuporteAssistido(id, { motivo, escopo }) {
    const c = chamado(id);
    if (!c) throw new Error("Chamado não encontrado.");
    if (["solicitado", "autorizado"].includes(c.suporteAssistido?.status)) throw new Error("Já existe uma solicitação em andamento.");
    c.suporteAssistido = { status: "solicitado", motivo: motivo.trim(), escopo, solicitadoEm: new Date().toISOString() };
    tocarChamado(c);
    registrarHistorico({ entidade: "chamado", entidadeId: id, acao: "assistido_solicitado", descricao: `Autorização de suporte assistido solicitada · escopo: ${escopo}. Nenhum acesso é concedido sem a resposta do cliente.` });
}

export function registrarDecisaoAssistido(id, { decisao, autorizadoPor, validadeHoras, confirmacao }) {
    const c = chamado(id);
    if (!c) throw new Error("Chamado não encontrado.");
    if (c.suporteAssistido?.status !== "solicitado") throw new Error("Não há solicitação aguardando resposta.");
    if (decisao === "autorizado" && !confirmacao) {
        throw new ErroValidacao("Confirme que a autorização foi dada de forma explícita pelo cliente.", "confirmacao");
    }
    const agora = new Date().toISOString();
    c.suporteAssistido = {
        ...c.suporteAssistido, status: decisao, respondidoEm: agora, autorizadoPor: autorizadoPor.trim(),
        validadeHoras: decisao === "autorizado" ? validadeHoras : null
    };
    tocarChamado(c);
    registrarHistorico({
        entidade: "chamado", entidadeId: id, acao: decisao === "autorizado" ? "assistido_autorizado" : "assistido_negado",
        descricao: decisao === "autorizado"
            ? `${autorizadoPor.trim()} autorizou explicitamente o suporte assistido por ${validadeHoras} h · escopo: ${c.suporteAssistido.escopo} (registro demonstrativo).`
            : `${autorizadoPor.trim()} não autorizou o suporte assistido.`
    });
}

export function encerrarSuporteAssistido(id) {
    const c = chamado(id);
    if (!c) throw new Error("Chamado não encontrado.");
    if (c.suporteAssistido?.status !== "autorizado") throw new Error("Não há sessão autorizada em andamento.");
    c.suporteAssistido = { ...c.suporteAssistido, status: "encerrado", encerradoEm: new Date().toISOString() };
    tocarChamado(c);
    registrarHistorico({ entidade: "chamado", entidadeId: id, acao: "assistido_encerrado", descricao: "Sessão de suporte assistido encerrada; autorização revogada." });
}

export function assistidoExpirado(c) {
    const s = c.suporteAssistido;
    return s?.status === "autorizado" && s.respondidoEm && Date.now() > new Date(s.respondidoEm).getTime() + s.validadeHoras * 3600000;
}

// =====================================================================
// COMUNICADOS (módulo 08)
// =====================================================================
export function opcoesPublico() {
    return [
        ["todas", "Todas as barbearias"],
        ["especificas", "Barbearias específicas"],
        ...listar("planos").filter((p) => !p.arquivado).map((p) => [`plano:${p.id}`, `Plano ${p.nome}`]),
        ["teste", "Barbearias em teste"],
        ["suspensas", "Barbearias suspensas"]
    ];
}

export function publicoDeValor(valor, barbeariaIds = []) {
    if (valor?.startsWith("plano:")) return { tipo: "plano", planoId: valor.slice(6) };
    if (valor === "especificas") return { tipo: "especificas", barbeariaIds };
    return { tipo: valor };
}

export function valorDoPublico(publico) {
    return publico.tipo === "plano" ? `plano:${publico.planoId}` : publico.tipo;
}

export function descreverPublico(publico) {
    if (publico.tipo === "plano") return `Plano ${plano(publico.planoId)?.nome ?? "—"}`;
    if (publico.tipo === "especificas") return `${publico.barbeariaIds?.length ?? 0} barbearias específicas`;
    return { todas: "Todas as barbearias", teste: "Barbearias em teste", suspensas: "Barbearias suspensas" }[publico.tipo] ?? "—";
}

export function alcancePublico(publico) {
    const lista = barbearias();
    switch (publico.tipo) {
        case "todas": return lista.filter((b) => b.status !== "cancelada");
        case "especificas": return lista.filter((b) => publico.barbeariaIds?.includes(b.id));
        case "plano": return lista.filter((b) => b.status !== "cancelada" && assinaturaDaBarbearia(b.id)?.planoId === publico.planoId);
        case "teste": return lista.filter((b) => b.status === "teste");
        case "suspensas": return lista.filter((b) => b.status === "suspensa");
        default: return [];
    }
}

// Publica os agendados cuja data chegou (publicação demonstrativa).
export function processarComunicadosAgendados() {
    const hoje = hojeTexto();
    listar("comunicados").filter((c) => c.status === "agendado" && c.publicacaoEm <= hoje).forEach((c) => {
        Object.assign(c, { status: "publicado", publicadoEm: new Date(`${c.publicacaoEm}T09:00:00`).toISOString(), alcanceRegistrado: alcancePublico(c.publico).length });
        registrarHistorico({ entidade: "comunicado", entidadeId: c.id, acao: "publicado", descricao: "Publicação agendada concluída (demonstração; nenhum envio realizado)." });
    });
}

export const comunicados = () => { processarComunicadosAgendados(); return listar("comunicados"); };
export const comunicado = (id) => obter("comunicados", id);
export const alcanceComunicado = (c) => (c.alcanceRegistrado ?? alcancePublico(c.publico).length);

export function salvarComunicado(dados, id = null) {
    const publico = publicoDeValor(dados.publico, dados.barbeariaIds ?? []);
    if (publico.tipo === "especificas" && !publico.barbeariaIds.length) throw new ErroValidacao("Selecione ao menos uma barbearia.", "barbeariaIds");
    const hoje = hojeTexto();
    let status = "rascunho";
    let publicacaoEm = dados.publicacaoEm || null;
    if (dados.acao === "agendar") {
        if (!publicacaoEm || publicacaoEm <= hoje) throw new ErroValidacao("Para agendar, escolha uma data posterior a hoje.", "publicacaoEm");
        status = "agendado";
    }
    if (dados.acao === "publicar") { status = "publicado"; publicacaoEm = hoje; }
    if (dados.encerramentoEm && publicacaoEm && dados.encerramentoEm < publicacaoEm) {
        throw new ErroValidacao("O encerramento deve ser igual ou posterior à publicação.", "encerramentoEm");
    }
    const campos = {
        titulo: dados.titulo.trim(), descricao: dados.descricao.trim(), categoria: dados.categoria, prioridade: dados.prioridade,
        publico, publicacaoEm, encerramentoEm: dados.encerramentoEm || null, status,
        publicadoEm: status === "publicado" ? new Date().toISOString() : null,
        alcanceRegistrado: status === "publicado" ? alcancePublico(publico).length : null
    };
    let registro;
    if (id) {
        const atual = comunicado(id);
        if (!atual) throw new Error("Comunicado não encontrado.");
        if (atual.status === "publicado" || atual.status === "arquivado") throw new Error("Comunicados publicados ou arquivados não podem ser editados.");
        registro = atualizar("comunicados", id, campos);
        registrarHistorico({ entidade: "comunicado", entidadeId: id, acao: "edicao", descricao: "Conteúdo do comunicado atualizado." });
    } else {
        registro = inserir("comunicados", campos);
        registrarHistorico({ entidade: "comunicado", entidadeId: registro.id, acao: "criado", descricao: `Comunicado criado (${CATEGORIAS_COMUNICADO[campos.categoria]}).` });
    }
    if (status === "agendado") registrarHistorico({ entidade: "comunicado", entidadeId: registro.id, acao: "agendado", descricao: `Publicação demonstrativa agendada para ${publicacaoEm.split("-").reverse().join("/")}.` });
    if (status === "publicado") registrarHistorico({ entidade: "comunicado", entidadeId: registro.id, acao: "publicado", descricao: `Publicado no painel de comunicados para ${registro.alcanceRegistrado} barbearias (demonstração; nenhum envio realizado).` });
    return registro;
}

export function publicarComunicado(id) {
    const c = comunicado(id);
    if (!c) throw new Error("Comunicado não encontrado.");
    if (c.status === "publicado" || c.status === "arquivado") throw new Error("Este comunicado não pode ser publicado.");
    const alcance = alcancePublico(c.publico).length;
    if (!alcance) throw new Error("O público selecionado não tem nenhuma barbearia.");
    atualizar("comunicados", id, { status: "publicado", publicacaoEm: hojeTexto(), publicadoEm: new Date().toISOString(), alcanceRegistrado: alcance });
    registrarHistorico({ entidade: "comunicado", entidadeId: id, acao: "publicado", descricao: `Publicado no painel de comunicados para ${alcance} barbearias (demonstração; nenhum envio realizado).` });
}

export function arquivarComunicado(id) {
    const c = comunicado(id);
    if (!c) throw new Error("Comunicado não encontrado.");
    if (c.status === "arquivado") throw new Error("O comunicado já está arquivado.");
    atualizar("comunicados", id, { status: "arquivado" });
    registrarHistorico({ entidade: "comunicado", entidadeId: id, acao: "arquivado", descricao: "Comunicado arquivado." });
}

// =====================================================================
// MARKETING (módulo 09)
// =====================================================================

// ---------- Cupons ----------
export const cupons = () => listar("cupons");
export const cupom = (id) => obter("cupons", id);

export function statusCupom(c) {
    const hoje = hojeTexto();
    if (!c.ativo) return "inativo";
    if (c.limiteUsos && c.usos >= c.limiteUsos) return "esgotado";
    if (c.inicio > hoje) return "agendado";
    if (c.validade < hoje) return "expirado";
    return "ativo";
}

export function salvarCupom(dados, id = null) {
    const codigo = dados.codigo.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(codigo)) throw new ErroValidacao("Use de 4 a 20 letras ou números, sem espaços.", "codigo");
    if (cupons().some((c) => c.id !== id && c.codigo === codigo)) throw new ErroValidacao("Já existe um cupom com este código.", "codigo");
    if (dados.tipoDesconto === "percentual" && (dados.valor <= 0 || dados.valor > 100)) throw new ErroValidacao("O percentual deve estar entre 1 e 100.", "valor");
    if (dados.validade < dados.inicio) throw new ErroValidacao("A validade deve ser igual ou posterior ao início.", "validade");
    const campos = { codigo, descricao: dados.descricao.trim(), tipoDesconto: dados.tipoDesconto, valor: dados.valor, inicio: dados.inicio, validade: dados.validade, limiteUsos: dados.limiteUsos };
    if (id) {
        const atual = cupom(id);
        if (dados.limiteUsos && dados.limiteUsos < atual.usos) throw new ErroValidacao(`O cupom já foi usado ${atual.usos} vezes.`, "limiteUsos");
        atualizar("cupons", id, campos);
        registrarHistorico({ entidade: "cupom", entidadeId: id, acao: "edicao", descricao: `Cupom ${codigo} atualizado.` });
        return cupom(id);
    }
    const novo = inserir("cupons", { ...campos, usos: 0, ativo: true });
    registrarHistorico({ entidade: "cupom", entidadeId: novo.id, acao: "criado", descricao: `Cupom ${codigo} criado.` });
    return novo;
}

export function alternarCupom(id) {
    const c = cupom(id);
    if (!c) throw new Error("Cupom não encontrado.");
    atualizar("cupons", id, { ativo: !c.ativo });
    registrarHistorico({ entidade: "cupom", entidadeId: id, acao: c.ativo ? "desativado" : "ativado", descricao: `Cupom ${c.codigo} ${c.ativo ? "desativado" : "ativado"}.` });
}

// ---------- Campanhas ----------
export const campanhas = () => listar("campanhas");
export const campanha = (id) => obter("campanhas", id);

export function statusCampanha(c) {
    if (c.status === "ativa" && c.fim < hojeTexto()) return "finalizada";
    return c.status;
}

export function publicoCampanha(c) {
    if (c.publico.tipo === "prospects") return [];
    if (c.publico.tipo === "especificas") return barbearias().filter((b) => c.publico.barbeariaIds.includes(b.id));
    return segmentar(c.publico.filtros).map((m) => m.barbearia);
}

export function alcanceCampanha(c) {
    return c.publico.tipo === "prospects" ? c.publico.prospectsEstimados : publicoCampanha(c).length;
}

function camposCampanha(dados) {
    if (!TIPOS_CAMPANHA[dados.tipo]) throw new ErroValidacao("Selecione o tipo.", "tipo");
    if (dados.fim < dados.inicio) throw new ErroValidacao("O fim deve ser igual ou posterior ao início.", "fim");
    if (dados.cupomId && !cupom(dados.cupomId)) throw new ErroValidacao("Cupom inválido.", "cupomId");
    const publico = dados.tipo === "aquisicao"
        ? { tipo: "prospects", prospectsEstimados: dados.prospectsEstimados }
        : { tipo: "segmento", filtros: dados.filtros ?? {} };
    if (publico.tipo === "prospects" && !(dados.prospectsEstimados > 0)) {
        throw new ErroValidacao("Informe quantos prospects a campanha pretende alcançar.", "prospectsEstimados");
    }
    return {
        nome: dados.nome.trim(), tipo: dados.tipo, objetivo: dados.objetivo.trim(), publico,
        inicio: dados.inicio, fim: dados.fim, orcamento: dados.orcamento, cupomId: dados.cupomId || null
    };
}

export function salvarCampanha(dados, id = null) {
    if (campanhas().some((c) => c.id !== id && normalizar(c.nome) === normalizar(dados.nome))) {
        throw new ErroValidacao("Já existe uma campanha com este nome.", "nome");
    }
    const campos = camposCampanha(dados);
    if (id) {
        if (campanha(id).status === "arquivada") throw new Error("Restaure a campanha antes de editar.");
        atualizar("campanhas", id, campos);
        registrarHistorico({ entidade: "campanha", entidadeId: id, acao: "edicao", descricao: "Campanha atualizada." });
        return campanha(id);
    }
    const nova = inserir("campanhas", { ...campos, status: "rascunho", resultados: { impactadas: 0, interacoes: 0, conversoes: 0, investido: 0 } });
    registrarHistorico({ entidade: "campanha", entidadeId: nova.id, acao: "criada", descricao: `Campanha "${nova.nome}" criada como rascunho.` });
    return nova;
}

export function duplicarCampanha(id) {
    const c = campanha(id);
    if (!c) throw new Error("Campanha não encontrada.");
    let nome = `${c.nome} (cópia)`;
    let n = 2;
    while (campanhas().some((x) => normalizar(x.nome) === normalizar(nome))) nome = `${c.nome} (cópia ${n++})`;
    const nova = inserir("campanhas", {
        nome, tipo: c.tipo, objetivo: c.objetivo, publico: structuredClone(c.publico), inicio: c.inicio, fim: c.fim,
        orcamento: c.orcamento, cupomId: c.cupomId, status: "rascunho", resultados: { impactadas: 0, interacoes: 0, conversoes: 0, investido: 0 }
    });
    registrarHistorico({ entidade: "campanha", entidadeId: nova.id, acao: "criada", descricao: `Campanha duplicada a partir de "${c.nome}".` });
    return nova;
}

export function ativarCampanha(id) {
    const c = campanha(id);
    if (!c) throw new Error("Campanha não encontrada.");
    if (c.status !== "rascunho") throw new Error("Só campanhas em rascunho podem ser ativadas.");
    if (c.fim < hojeTexto()) throw new Error("O período da campanha já terminou. Ajuste as datas.");
    const alcance = alcanceCampanha(c);
    if (!alcance) throw new Error("O público da campanha está vazio.");
    atualizar("campanhas", id, { status: "ativa", resultados: { ...c.resultados, impactadas: alcance } });
    registrarHistorico({ entidade: "campanha", entidadeId: id, acao: "ativada", descricao: `Campanha ativada para ${alcance} ${c.publico.tipo === "prospects" ? "prospects estimados" : "barbearias"} (demonstração; nenhuma mensagem enviada).` });
}

export function arquivarCampanha(id) {
    const c = campanha(id);
    if (!c) throw new Error("Campanha não encontrada.");
    atualizar("campanhas", id, { status: "arquivada", statusAntesArquivo: statusCampanha(c) === "ativa" ? "finalizada" : c.status });
    registrarHistorico({ entidade: "campanha", entidadeId: id, acao: "arquivada", descricao: "Campanha arquivada." });
}

export function restaurarCampanha(id) {
    const c = campanha(id);
    atualizar("campanhas", id, { status: c.statusAntesArquivo === "rascunho" ? "rascunho" : "ativa" });
    registrarHistorico({ entidade: "campanha", entidadeId: id, acao: "restaurada", descricao: "Campanha restaurada do arquivo." });
}

// Avança os resultados fictícios de uma campanha ativa (apenas para demonstração).
export function simularResultados(id) {
    const c = campanha(id);
    if (!c || statusCampanha(c) !== "ativa") throw new Error("Só campanhas ativas recebem resultados simulados.");
    const alcance = alcanceCampanha(c);
    const r = c.resultados;
    const interacoes = Math.min(alcance, r.interacoes + Math.max(1, Math.round(alcance * 0.08)));
    const conversoes = Math.min(interacoes, r.conversoes + Math.max(1, Math.round(alcance * 0.02)));
    const investido = Math.min(c.orcamento, r.investido + Math.round(c.orcamento * 0.1));
    atualizar("campanhas", id, { resultados: { impactadas: alcance, interacoes, conversoes, investido } });
    registrarHistorico({ entidade: "campanha", entidadeId: id, acao: "resultado", descricao: `Resultados simulados atualizados: ${interacoes} interações, ${conversoes} conversões (fictício).` });
}

export function resumoMarketing() {
    const lista = campanhas();
    const ativas = lista.filter((c) => statusCampanha(c) === "ativa");
    const participantes = new Set();
    ativas.forEach((c) => publicoCampanha(c).forEach((b) => participantes.add(b.id)));
    const impactadas = lista.reduce((s, c) => s + c.resultados.impactadas, 0);
    const conversoes = lista.reduce((s, c) => s + c.resultados.conversoes, 0);
    return {
        cadastradas: lista.length, ativas: ativas.length, finalizadas: lista.filter((c) => statusCampanha(c) === "finalizada").length,
        cupons: cupons().length, participantes: participantes.size, conversoes, taxaConversao: impactadas ? conversoes / impactadas : 0
    };
}

// ---------- Indicações ----------
export const indicacoes = () => listar("indicacoes");
export const indicacao = (id) => obter("indicacoes", id);

export function codigoIndicacao(b) {
    return `IND-${b.nome.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 5)}`;
}

export function registrarIndicacao(dados) {
    const indicadora = barbearia(dados.indicadoraId);
    if (!indicadora) throw new ErroValidacao("Selecione a barbearia indicadora.", "indicadoraId");
    const nome = normalizar(dados.indicadaNome);
    if (barbearias().some((b) => normalizar(b.nome) === nome)) {
        throw new ErroValidacao("Esta barbearia já é cliente. Registre a conversão na indicação existente ou escolha outro nome.", "indicadaNome");
    }
    if (indicacoes().some((i) => normalizar(i.indicadaNome) === nome && i.status !== "expirada")) {
        throw new ErroValidacao("Esta barbearia já foi indicada.", "indicadaNome");
    }
    const nova = inserir("indicacoes", {
        indicadoraId: indicadora.id, codigo: codigoIndicacao(indicadora), indicadaNome: dados.indicadaNome.trim(), indicadaId: null,
        contato: dados.contato.trim().toLowerCase(), data: new Date().toISOString(), status: "pendente",
        recompensa: dados.recompensa.trim(), recompensaStatus: "pendente"
    });
    registrarHistorico({ entidade: "indicacao", entidadeId: nova.id, acao: "registrada", descricao: `Indicação de ${nova.indicadaNome} registrada por ${indicadora.nome}.` });
    return nova;
}

export function barbeariasDisponiveisParaConversao(indicacaoId) {
    const i = indicacao(indicacaoId);
    const usadas = new Set(indicacoes().filter((x) => x.indicadaId).map((x) => x.indicadaId));
    return barbearias().filter((b) => b.id !== i?.indicadoraId && !usadas.has(b.id) && b.status !== "cancelada");
}

export function converterIndicacao(id, barbeariaId) {
    const i = indicacao(id);
    if (!i) throw new Error("Indicação não encontrada.");
    if (i.indicadaId) throw new Error("Esta indicação já foi convertida.");
    const b = barbearia(barbeariaId);
    if (!b || !barbeariasDisponiveisParaConversao(id).some((x) => x.id === b.id)) throw new ErroValidacao("Selecione uma barbearia cadastrada que ainda não tenha sido vinculada.", "barbeariaId");
    atualizar("indicacoes", id, { indicadaId: b.id, indicadaNome: b.nome, status: b.status === "teste" ? "em_teste" : "convertida" });
    registrarHistorico({ entidade: "indicacao", entidadeId: id, acao: "convertida", descricao: `Indicação vinculada à barbearia cadastrada ${b.nome}.` });
}

export function concederRecompensa(id) {
    const i = indicacao(id);
    if (!i) throw new Error("Indicação não encontrada.");
    if (i.status !== "convertida") throw new Error("A recompensa só é concedida após a conversão (assinatura ativa).");
    if (i.recompensaStatus === "concedida") throw new Error("A recompensa já foi concedida.");
    atualizar("indicacoes", id, { recompensaStatus: "concedida" });
    registrarHistorico({ entidade: "indicacao", entidadeId: id, acao: "recompensa", descricao: `Recompensa "${i.recompensa}" registrada como concedida (demonstração; nenhum crédito real aplicado).` });
}

export function expirarIndicacao(id) {
    const i = indicacao(id);
    if (!i || i.status !== "pendente") throw new Error("Só indicações pendentes podem expirar.");
    atualizar("indicacoes", id, { status: "expirada" });
    registrarHistorico({ entidade: "indicacao", entidadeId: id, acao: "expirada", descricao: "Indicação marcada como expirada." });
}

// ---------- Pesquisas ----------
export const pesquisas = () => listar("pesquisas");
export const pesquisa = (id) => obter("pesquisas", id);

const TEMAS = [
    ["Relatórios e comissões", ["relatorio", "comissao"]],
    ["Pagamento online / Pix", ["pagamento", "pix", "sinal"]],
    ["Aplicativo e celular", ["aplicativo", "app ", "celular"]],
    ["WhatsApp e lembretes", ["whatsapp", "lembrete"]],
    ["Fidelidade", ["fidelidade"]],
    ["Instagram", ["instagram"]],
    ["Retorno de clientes", ["nao voltam", "retorno"]]
];

export function indicadoresPesquisa(p) {
    const respostas = p.respostas ?? [];
    const alvo = alcancePublico(p.publico ?? { tipo: "todas" }).length;
    const porPergunta = p.perguntas.map((q) => {
        const valores = respostas.map((r) => r.valores[q.id]).filter((v) => v !== undefined && v !== "" && v !== null);
        if (q.tipo === "nps") {
            const prom = valores.filter((v) => v >= 9).length;
            const det = valores.filter((v) => v <= 6).length;
            return { pergunta: q, quantidade: valores.length, nps: valores.length ? Math.round(((prom - det) / valores.length) * 100) : null,
                promotores: prom, neutros: valores.length - prom - det, detratores: det,
                media: valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null };
        }
        if (q.tipo === "escala") {
            return { pergunta: q, quantidade: valores.length, media: valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null,
                distribuicao: [1, 2, 3, 4, 5].map((n) => valores.filter((v) => v === n).length) };
        }
        return { pergunta: q, quantidade: valores.length, textos: valores };
    });
    const textos = porPergunta.filter((x) => x.textos).flatMap((x) => x.textos);
    const temas = TEMAS.map(([tema, chaves]) => ({ tema, quantidade: textos.filter((t) => chaves.some((k) => normalizar(` ${t} `).includes(k))).length }))
        .filter((t) => t.quantidade > 0).sort((a, b) => b.quantidade - a.quantidade);
    const escalas = porPergunta.filter((x) => x.pergunta.tipo === "escala" && x.media !== null);
    return {
        respostas: respostas.length, publicoAlvo: alvo, taxaResposta: alvo ? respostas.length / alvo : 0,
        nps: porPergunta.find((x) => x.pergunta.tipo === "nps") ?? null,
        satisfacaoMedia: escalas.length ? escalas.reduce((s, x) => s + x.media, 0) / escalas.length : null,
        porPergunta, temas
    };
}

export function salvarPesquisa(dados, id = null) {
    const perguntas = [1, 2, 3, 4]
        .map((n) => ({ id: `q${n}`, texto: (dados[`pergunta${n}`] ?? "").trim(), tipo: dados[`tipo${n}`] }))
        .filter((q) => q.texto);
    if (!perguntas.length) throw new ErroValidacao("Inclua ao menos uma pergunta.", "pergunta1");
    const campos = { titulo: dados.titulo.trim(), descricao: dados.descricao.trim(), perguntas, publico: publicoDeValor(dados.publico) };
    if (id) {
        const atual = pesquisa(id);
        if (atual.status !== "rascunho") throw new Error("Só pesquisas em rascunho podem ser editadas.");
        atualizar("pesquisas", id, campos);
        registrarHistorico({ entidade: "pesquisa", entidadeId: id, acao: "edicao", descricao: "Perguntas da pesquisa atualizadas." });
        return pesquisa(id);
    }
    const nova = inserir("pesquisas", { ...campos, status: "rascunho", respostas: [] });
    registrarHistorico({ entidade: "pesquisa", entidadeId: nova.id, acao: "criada", descricao: `Pesquisa "${nova.titulo}" criada.` });
    return nova;
}

export function alterarStatusPesquisa(id, status) {
    const p = pesquisa(id);
    if (!p) throw new Error("Pesquisa não encontrada.");
    atualizar("pesquisas", id, { status });
    registrarHistorico({ entidade: "pesquisa", entidadeId: id, acao: status, descricao: status === "ativa" ? "Coleta de respostas iniciada (demonstração; nenhum convite enviado)." : "Coleta encerrada." });
}

// Gera respostas FICTÍCIAS de barbearias do público que ainda não responderam.
export function simularRespostas(id, quantidade = 5) {
    const p = pesquisa(id);
    if (!p || p.status !== "ativa") throw new Error("Só pesquisas em coleta recebem respostas simuladas.");
    const ja = new Set(p.respostas.map((r) => r.barbeariaId));
    const candidatas = alcancePublico(p.publico).filter((b) => !ja.has(b.id)).slice(0, quantidade);
    if (!candidatas.length) throw new Error("Todo o público já respondeu.");
    const sugestoes = ["Relatório de comissão por barbeiro", "Pagamento por Pix na agenda", "Aplicativo para celular", "Lembretes no WhatsApp com foto do serviço", "Programa de fidelidade"];
    let semente = p.respostas.length + 7;
    const aleatorio = () => { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };
    candidatas.forEach((b) => {
        p.respostas.push({
            barbeariaId: b.id, data: new Date().toISOString(), simulada: true,
            valores: Object.fromEntries(p.perguntas.map((q) => [q.id,
                q.tipo === "nps" ? Math.min(10, 5 + Math.floor(aleatorio() * 6)) : q.tipo === "escala" ? 2 + Math.floor(aleatorio() * 4) : sugestoes[Math.floor(aleatorio() * sugestoes.length)]]))
        });
    });
    salvar();
    registrarHistorico({ entidade: "pesquisa", entidadeId: id, acao: "respostas", descricao: `${candidatas.length} respostas fictícias geradas para demonstração.` });
    return candidatas.length;
}

export { hojeTexto, usuarios };
