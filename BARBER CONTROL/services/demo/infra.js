// =====================================================================
// REGRAS DE NEGÓCIO — SEGURANÇA, MONITORAMENTO, BACKUPS E ALERTAS
// (módulos 10, 11 e 12). Tudo é demonstrativo: nenhuma sessão é
// encerrada de verdade, nenhum serviço é medido, nenhum backup é
// criado ou restaurado. As mensagens deixam isso explícito.
// =====================================================================
import { listar, obter, atualizar, inserir, registrarHistorico, historicoDe, proximaSequencia, salvar, obterConfig, salvarConfig } from "./store.js";
import {
    GRAVIDADES, STATUS_INCIDENTE, STATUS_ALERTA, TIPOS_ALERTA, PERFIS_ADMIN, ACOES_PERMISSAO, STATUS_VERIFICACAO,
    STATUS_BACKUP, ETAPAS_RECUPERACAO, AMBIENTES_RECUPERACAO, TIPOS_BACKUP, ORIGENS_BACKUP
} from "./catalogo.js";
import { ErroValidacao, barbearia, barbearias, usuario } from "./saas.js";
import * as O from "./operacao.js";

export { historicoDe };

const HORA = 3600000;
const DIA = 24 * HORA;
const agoraIso = () => new Date().toISOString();
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const codigo = (prefixo, seq, casas = 4) => `${prefixo}-${String(seq).padStart(casas, "0")}`;

// =====================================================================
// INCIDENTES (segurança e técnicos compartilham as regras)
// =====================================================================
const COLECAO_INCIDENTE = { seguranca: "incidentesSeg", tecnico: "incidentesTec" };
const ENTIDADE_INCIDENTE = { seguranca: "incidente_seg", tecnico: "incidente_tec" };

export const incidentes = (tipo) => listar(COLECAO_INCIDENTE[tipo]);
export const incidente = (tipo, id) => obter(COLECAO_INCIDENTE[tipo], id);
export const historicoIncidente = (tipo, id) => historicoDe(ENTIDADE_INCIDENTE[tipo], id);

export function registrarIncidente(tipo, dados) {
    if (dados.barbeariaId && !barbearia(dados.barbeariaId)) throw new ErroValidacao("Barbearia inválida.", "barbeariaId");
    if (tipo === "tecnico" && !servico(`sv_${dados.servico}`)) throw new ErroValidacao("Selecione o serviço afetado.", "servico");
    const prefixo = tipo === "seguranca" ? "INC-SEG" : "INC-TEC";
    const novo = inserir(COLECAO_INCIDENTE[tipo], {
        codigo: codigo(prefixo, proximaSequencia(ENTIDADE_INCIDENTE[tipo])),
        titulo: dados.titulo.trim(), categoria: dados.categoria, gravidade: dados.gravidade, status: "novo",
        descricao: dados.descricao.trim(), barbeariaId: dados.barbeariaId || null, servico: dados.servico || null,
        chamadoId: dados.chamadoId || null, providencias: [], responsavel: dados.responsavel || "Proprietário do SaaS",
        abertoEm: dados.ocorridoEm ? new Date(`${dados.ocorridoEm}T12:00:00`).toISOString() : agoraIso(), encerradoEm: null
    });
    registrarHistorico({ entidade: ENTIDADE_INCIDENTE[tipo], entidadeId: novo.id, acao: "registrado", descricao: `Incidente ${novo.codigo} registrado com gravidade ${GRAVIDADES[novo.gravidade].rotulo.toLowerCase()}.` });
    // Gravidade alta ou crítica gera alerta automaticamente (sem duplicar).
    if (novo.gravidade === "alta" || novo.gravidade === "critica") {
        const tipoAlerta = tipo === "seguranca" ? "incidente_seguranca" : "servico_indisponivel";
        criarAlerta({
            tipo: tipoAlerta, gravidade: novo.gravidade,
            descricao: `Incidente ${novo.codigo}: ${novo.titulo}.`,
            referencia: { tipo: ENTIDADE_INCIDENTE[tipo], id: novo.id }
        });
    }
    return novo;
}

export function alterarGravidade(tipo, id, gravidade) {
    const i = incidente(tipo, id);
    if (!i) throw new Error("Incidente não encontrado.");
    if (i.gravidade === gravidade) throw new ErroValidacao("O incidente já tem esta gravidade.", "gravidade");
    const anterior = i.gravidade;
    atualizar(COLECAO_INCIDENTE[tipo], id, { gravidade });
    registrarHistorico({ entidade: ENTIDADE_INCIDENTE[tipo], entidadeId: id, acao: "gravidade", descricao: `Gravidade alterada de ${GRAVIDADES[anterior].rotulo} para ${GRAVIDADES[gravidade].rotulo}.` });
}

export function alterarStatusIncidente(tipo, id, status, comentario = "") {
    const i = incidente(tipo, id);
    if (!i) throw new Error("Incidente não encontrado.");
    if (!STATUS_INCIDENTE[status]) throw new ErroValidacao("Status inválido.", "status");
    if (i.status === status) throw new ErroValidacao("O incidente já está neste status.", "status");
    const anterior = i.status;
    const fechado = status === "resolvido" || status === "encerrado";
    atualizar(COLECAO_INCIDENTE[tipo], id, { status, encerradoEm: fechado ? (i.encerradoEm ?? agoraIso()) : null });
    registrarHistorico({ entidade: ENTIDADE_INCIDENTE[tipo], entidadeId: id, acao: "status",
        descricao: `Status alterado de ${STATUS_INCIDENTE[anterior].rotulo} para ${STATUS_INCIDENTE[status].rotulo}.${comentario ? ` ${comentario}` : ""}` });
}

export function adicionarProvidencia(tipo, id, texto) {
    const i = incidente(tipo, id);
    if (!i) throw new Error("Incidente não encontrado.");
    if (i.status === "encerrado") throw new Error("Incidente encerrado. Reabra para registrar providências.");
    i.providencias.push({ texto: texto.trim(), data: agoraIso() });
    atualizar(COLECAO_INCIDENTE[tipo], id, { providencias: i.providencias });
    registrarHistorico({ entidade: ENTIDADE_INCIDENTE[tipo], entidadeId: id, acao: "providencia", descricao: `Providência registrada: ${texto.trim().slice(0, 80)}` });
}

export function encerrarIncidente(tipo, id, resumo) {
    const i = incidente(tipo, id);
    if (!i) throw new Error("Incidente não encontrado.");
    if (i.status === "encerrado") throw new Error("O incidente já está encerrado.");
    i.providencias.push({ texto: `Encerramento: ${resumo.trim()}`, data: agoraIso() });
    atualizar(COLECAO_INCIDENTE[tipo], id, { status: "encerrado", encerradoEm: agoraIso(), providencias: i.providencias });
    registrarHistorico({ entidade: ENTIDADE_INCIDENTE[tipo], entidadeId: id, acao: "encerrado", descricao: `Incidente encerrado. ${resumo.trim()}` });
}

export function vincularChamado(id, chamadoId) {
    const i = incidente("tecnico", id);
    const ch = O.chamado(chamadoId);
    if (!i || !ch) throw new ErroValidacao("Selecione um chamado existente.", "chamadoId");
    atualizar("incidentesTec", id, { chamadoId, barbeariaId: i.barbeariaId ?? ch.barbeariaId });
    registrarHistorico({ entidade: "incidente_tec", entidadeId: id, acao: "chamado", descricao: `Chamado ${ch.protocolo} vinculado ao incidente.` });
    registrarHistorico({ entidade: "chamado", entidadeId: chamadoId, acao: "incidente", descricao: `Vinculado ao incidente técnico ${i.codigo}.` });
}

// =====================================================================
// CENTRAL DE ALERTAS
// =====================================================================
export const alertas = () => listar("alertas");
export const alerta = (id) => obter("alertas", id);
const ABERTO = (a) => a.status !== "resolvido" && a.status !== "encerrado";

export function descreverReferencia(ref) {
    if (!ref?.id) return { rotulo: "—", link: null };
    switch (ref.tipo) {
        case "barbearia": { const b = barbearia(ref.id); return { rotulo: b?.nome ?? "Barbearia removida", link: b ? `#/barbearias/${b.id}` : null }; }
        case "servico": { const s = servico(ref.id); return { rotulo: s?.nome ?? ref.id, link: s ? `#/monitoramento/servico/${s.id}` : null }; }
        case "backup": { const b = backup(ref.id); return { rotulo: b ? `${b.codigo} · ${b.nome}` : ref.id, link: b ? `#/backups/backup/${b.id}` : null }; }
        case "recuperacao": { const r = recuperacao(ref.id); return { rotulo: r?.codigo ?? ref.id, link: r ? "#/backups/recuperacao" : null }; }
        case "incidente_seg": { const i = incidente("seguranca", ref.id); return { rotulo: i ? `${i.codigo} · ${i.titulo}` : ref.id, link: i ? `#/seguranca/incidente/${i.id}` : null }; }
        case "incidente_tec": { const i = incidente("tecnico", ref.id); return { rotulo: i ? `${i.codigo} · ${i.titulo}` : ref.id, link: i ? `#/monitoramento/incidente/${i.id}` : null }; }
        default: return { rotulo: ref.id, link: null };
    }
}

// Cria um alerta. Se já houver um alerta aberto com a mesma chave
// (mesmo tipo + mesma referência), agrupa em vez de duplicar.
export function criarAlerta({ tipo, gravidade, descricao, referencia = {}, chave = null }) {
    const info = TIPOS_ALERTA[tipo];
    if (!info) throw new ErroValidacao("Tipo de alerta inválido.", "tipo");
    const chaveFinal = chave ?? `${tipo}|${referencia.tipo ?? "geral"}:${referencia.id ?? normalizar(descricao).slice(0, 40)}`;
    const existente = alertas().find((a) => a.chave === chaveFinal && ABERTO(a));
    if (existente) {
        atualizar("alertas", existente.id, { ocorrencias: existente.ocorrencias + 1, atualizadoEm: agoraIso() });
        registrarHistorico({ entidade: "alerta", entidadeId: existente.id, acao: "agrupado", descricao: "Nova ocorrência idêntica agrupada neste alerta (sem duplicar)." });
        return { alerta: existente, duplicado: true };
    }
    const novo = inserir("alertas", {
        codigo: codigo("ALR", proximaSequencia("alerta"), 5), categoria: info.categoria, tipo, gravidade, status: "novo",
        descricao: descricao.trim(), referencia, chave: chaveFinal, ocorrencias: 1, providencias: [], comunicadoId: null, data: agoraIso()
    });
    registrarHistorico({ entidade: "alerta", entidadeId: novo.id, acao: "criado", descricao: `Alerta ${novo.codigo} criado (${info.rotulo.toLowerCase()}).` });
    return { alerta: novo, duplicado: false };
}

export function reconhecerAlerta(id) {
    const a = alerta(id);
    if (!a) throw new Error("Alerta não encontrado.");
    if (a.status !== "novo") throw new Error("Só alertas novos podem ser reconhecidos.");
    atualizar("alertas", id, { status: "reconhecido" });
    registrarHistorico({ entidade: "alerta", entidadeId: id, acao: "reconhecido", descricao: "Alerta reconhecido." });
}

export function alterarStatusAlerta(id, status, comentario = "") {
    const a = alerta(id);
    if (!a) throw new Error("Alerta não encontrado.");
    if (!STATUS_ALERTA[status]) throw new ErroValidacao("Status inválido.", "status");
    if (a.status === status) throw new ErroValidacao("O alerta já está neste status.", "status");
    const anterior = a.status;
    atualizar("alertas", id, { status });
    registrarHistorico({ entidade: "alerta", entidadeId: id, acao: "status", descricao: `Status alterado de ${STATUS_ALERTA[anterior].rotulo} para ${STATUS_ALERTA[status].rotulo}.${comentario ? ` ${comentario}` : ""}` });
}

export function registrarProvidenciaAlerta(id, texto) {
    const a = alerta(id);
    if (!a) throw new Error("Alerta não encontrado.");
    a.providencias.push({ texto: texto.trim(), data: agoraIso() });
    atualizar("alertas", id, { providencias: a.providencias, status: a.status === "novo" ? "investigacao" : a.status });
    registrarHistorico({ entidade: "alerta", entidadeId: id, acao: "providencia", descricao: `Providência registrada: ${texto.trim().slice(0, 80)}` });
}

export function encerrarAlerta(id, resumo) {
    const a = alerta(id);
    if (!a) throw new Error("Alerta não encontrado.");
    if (a.status === "encerrado") throw new Error("O alerta já está encerrado.");
    a.providencias.push({ texto: `Encerramento: ${resumo.trim()}`, data: agoraIso() });
    atualizar("alertas", id, { status: "encerrado", providencias: a.providencias });
    registrarHistorico({ entidade: "alerta", entidadeId: id, acao: "encerrado", descricao: `Alerta encerrado. ${resumo.trim()}` });
}

// Gera um comunicado em RASCUNHO no módulo 08 (nada é enviado).
export function gerarComunicadoDoAlerta(id) {
    const a = alerta(id);
    if (!a) throw new Error("Alerta não encontrado.");
    if (a.comunicadoId && O.comunicado(a.comunicadoId)) throw new Error("Este alerta já tem um comunicado vinculado.");
    const especifica = a.referencia?.tipo === "barbearia" && barbearia(a.referencia.id);
    const categoria = a.categoria === "seguranca" ? "seguranca" : a.categoria === "backup" ? "manutencao" : "manutencao";
    const c = O.salvarComunicado({
        titulo: `${TIPOS_ALERTA[a.tipo].rotulo} · aviso às barbearias`,
        descricao: `${a.descricao}\n\nEstamos acompanhando a situação e informaremos quando estiver normalizada.`,
        categoria, prioridade: a.gravidade === "critica" || a.gravidade === "alta" ? "alta" : "normal",
        publico: especifica ? "especificas" : "todas", barbeariaIds: especifica ? [a.referencia.id] : [], acao: "rascunho"
    });
    atualizar("alertas", id, { comunicadoId: c.id });
    registrarHistorico({ entidade: "alerta", entidadeId: id, acao: "comunicado", descricao: "Comunicado criado como rascunho no módulo Notificações (nada foi enviado)." });
    registrarHistorico({ entidade: "comunicado", entidadeId: c.id, acao: "origem", descricao: `Criado a partir do alerta ${a.codigo}.` });
    return c;
}

export function resumoAlertas(categoria = null) {
    const lista = alertas().filter((a) => !categoria || a.categoria === categoria);
    return {
        total: lista.length, abertos: lista.filter(ABERTO).length, novos: lista.filter((a) => a.status === "novo").length,
        criticos: lista.filter((a) => ABERTO(a) && (a.gravidade === "critica" || a.gravidade === "alta")).length
    };
}

export const alertasAbertos = (filtro = () => true) => alertas().filter((a) => ABERTO(a) && filtro(a));

// =====================================================================
// SEGURANÇA
// =====================================================================
export const eventos = () => listar("eventosAuth");
export const sessoes = () => listar("sessoesAdmin");
export const permissoes = () => listar("permissoes");
export const verificacoes = () => listar("verificacoes");

export function filtrarEventos({ busca = "", tipo = "", resultado = "", usuarioId = "", dias = 14 } = {}) {
    const limite = Date.now() - Number(dias) * DIA;
    const termo = normalizar(busca);
    return eventos().filter((e) =>
        new Date(e.data).getTime() >= limite &&
        (!tipo || e.tipo === tipo) && (!resultado || e.resultado === resultado) &&
        (!usuarioId || (usuarioId === "admin" ? e.usuarioId === null : e.usuarioId === usuarioId)) &&
        (!termo || normalizar(`${e.id} ${e.usuarioNome} ${e.origem.ip} ${e.origem.cidade}`).includes(termo)));
}

export function revisarEvento(id) {
    const e = obter("eventosAuth", id);
    if (!e) throw new Error("Evento não encontrado.");
    if (e.status === "revisado") throw new Error("Evento já revisado.");
    atualizar("eventosAuth", id, { status: "revisado" });
    registrarHistorico({ entidade: "evento_auth", entidadeId: id, acao: "revisado", descricao: `Evento ${e.id} marcado como revisado.` });
}

export function encerrarSessao(id) {
    const s = obter("sessoesAdmin", id);
    if (!s) throw new Error("Sessão não encontrada.");
    if (s.status !== "ativa") throw new Error("A sessão não está ativa.");
    atualizar("sessoesAdmin", id, { status: "encerrada" });
    inserirEvento({ usuarioId: null, usuarioNome: s.usuario, sistema: "Barber Control", tipo: "sessao_encerrada", origem: s.origem, resultado: "sucesso" });
    registrarHistorico({ entidade: "sessao", entidadeId: id, acao: "encerrada", descricao: `Sessão demonstrativa (${s.dispositivo}) encerrada. Nenhuma sessão real foi afetada.` });
}

function inserirEvento(dados) {
    const lista = eventos();
    lista.push({ id: codigo("EV", proximaSequencia("evento"), 6), status: "normal", data: agoraIso(), ...dados });
    salvar();
}

export function resumoSeguranca() {
    const dia = Date.now() - DIA;
    const ev = eventos();
    const recentes = ev.filter((e) => new Date(e.data).getTime() >= dia);
    const incs = incidentes("seguranca");
    const abertos = incs.filter((i) => i.status !== "resolvido" && i.status !== "encerrado");
    const alertasSeg = alertasAbertos((a) => a.categoria === "seguranca");
    const naoReais = verificacoes().filter((v) => v.status !== "verificado_real").length;
    // Indicador demonstrativo: começa em 100 e desconta pendências. Não mede segurança real.
    let indice = 100;
    indice -= abertos.filter((i) => i.gravidade === "critica").length * 15;
    indice -= abertos.filter((i) => i.gravidade === "alta").length * 8;
    indice -= abertos.filter((i) => i.gravidade === "media").length * 3;
    indice -= Math.min(10, alertasSeg.length * 2);
    indice -= naoReais * 3;
    return {
        indice: Math.max(0, Math.min(100, indice)),
        tentativas24h: recentes.filter((e) => e.tipo === "login_ok" || e.tipo === "login_recusado").length,
        recusadas24h: recentes.filter((e) => e.tipo === "login_recusado").length,
        suspeitas: ev.filter((e) => e.tipo === "suspeita").length,
        incidentes: incs.length, incidentesAbertos: abertos.length,
        criticos: abertos.filter((i) => i.gravidade === "critica").length,
        sessoesAtivas: sessoes().filter((s) => s.status === "ativa").length,
        alertasPendentes: alertasSeg.length, verificacoesPendentes: naoReais
    };
}

export function atividadesAdministrativas(limite = 200) {
    return listar("historico").slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, limite);
}

export function salvarPermissao(id, acoes) {
    const p = obter("permissoes", id);
    if (!p) throw new Error("Permissão não encontrada.");
    if (PERFIS_ADMIN[p.perfil].bloqueado) throw new Error("As permissões do proprietário do SaaS não podem ser reduzidas.");
    const novas = Object.fromEntries(Object.keys(ACOES_PERMISSAO).map((k) => [k, acoes.includes(k)]));
    if ((novas.criar || novas.editar || novas.excluir || novas.critico) && !novas.visualizar) {
        throw new ErroValidacao("Para criar, editar, excluir ou operar, a visualização também precisa estar liberada.", "acoes");
    }
    const antes = Object.entries(p.acoes).filter(([, v]) => v).map(([k]) => ACOES_PERMISSAO[k]).join(", ") || "nenhuma";
    const depois = Object.entries(novas).filter(([, v]) => v).map(([k]) => ACOES_PERMISSAO[k]).join(", ") || "nenhuma";
    atualizar("permissoes", id, { acoes: novas });
    registrarHistorico({ entidade: "permissao", entidadeId: id, acao: "alterada", descricao: `${PERFIS_ADMIN[p.perfil].rotulo} · ${p.recurso}: ${antes} → ${depois} (demonstrativo; nenhum acesso real alterado).` });
}

export function alternarStatusPermissao(id) {
    const p = obter("permissoes", id);
    if (PERFIS_ADMIN[p.perfil].bloqueado) throw new Error("O acesso do proprietário do SaaS não pode ser revogado.");
    const status = p.status === "ativo" ? "revogado" : "ativo";
    atualizar("permissoes", id, { status });
    registrarHistorico({ entidade: "permissao", entidadeId: id, acao: status, descricao: `${PERFIS_ADMIN[p.perfil].rotulo} · ${p.recurso}: acesso ${status === "ativo" ? "reativado" : "revogado"} (demonstrativo).` });
}

export function registrarNotaVerificacao(id, { status, nota }) {
    const v = obter("verificacoes", id);
    if (!v) throw new Error("Item não encontrado.");
    if (status === "verificado_real") {
        throw new ErroValidacao("Disponível só depois da integração e de um teste real no ambiente publicado.", "status");
    }
    if (!STATUS_VERIFICACAO[status]) throw new ErroValidacao("Status inválido.", "status");
    v.notas.push({ texto: nota.trim(), status, data: agoraIso() });
    atualizar("verificacoes", id, { status, notas: v.notas });
    registrarHistorico({ entidade: "verificacao", entidadeId: id, acao: "nota", descricao: `${v.nome}: ${STATUS_VERIFICACAO[status].rotulo}. ${nota.trim()}` });
}

// =====================================================================
// MONITORAMENTO
// =====================================================================
export const servicos = () => listar("servicos");
export const servico = (id) => obter("servicos", id);
export const metricasDias = () => obterConfig("metricas").dias;

export function metricasPeriodo(dias = 30) {
    return metricasDias().slice(-Number(dias));
}

export function resumoMonitoramento(dias = 30) {
    const m = metricasPeriodo(dias);
    const soma = (k) => m.reduce((s, x) => s + x[k], 0);
    const ultimo = m.at(-1);
    const requisicoes = soma("requisicoes");
    const erros = soma("erros");
    const svc = servicos();
    return {
        disponibilidade: m.length ? soma("disponibilidade") / m.length : null,
        latenciaMedia: m.length ? soma("latenciaMs") / m.length : null,
        latenciaPico: Math.max(...m.map((x) => x.latenciaMs)),
        requisicoes, erros, taxaErro: requisicoes ? erros / requisicoes : 0,
        armazenamentoMb: ultimo?.armazenamentoMb ?? null, bancoMb: ultimo?.bancoMb ?? null,
        integracoesMonitoradas: svc.filter((s) => s.status !== "nao_monitorado").length, servicosTotal: svc.length,
        integracoesNaoMonitoradas: svc.filter((s) => s.status === "nao_monitorado").length,
        incidentesAbertos: incidentes("tecnico").filter((i) => i.status !== "resolvido" && i.status !== "encerrado").length
    };
}

// "Verificação" simulada: atualiza só o horário; não consulta nenhum serviço real.
export function verificarServico(id) {
    const s = servico(id);
    if (!s) throw new Error("Serviço não encontrado.");
    if (s.status === "nao_monitorado") throw new Error("Serviço não monitorado: não há integração configurada para verificar.");
    atualizar("servicos", id, { ultimaVerificacao: agoraIso() });
    registrarHistorico({ entidade: "servico", entidadeId: id, acao: "verificacao", descricao: `Verificação simulada de ${s.nome}. Nenhuma chamada real foi feita.` });
}

export function filtrarIncidentesTec({ dias = "", servico: svc = "", gravidade = "", status = "", busca = "" } = {}) {
    const limite = dias ? Date.now() - Number(dias) * DIA : 0;
    const termo = normalizar(busca);
    return incidentes("tecnico").filter((i) =>
        new Date(i.abertoEm).getTime() >= limite && (!svc || i.servico === svc) && (!gravidade || i.gravidade === gravidade) &&
        (!status || i.status === status) && (!termo || normalizar(`${i.codigo} ${i.titulo}`).includes(termo)));
}

// Monitoramento por barbearia: derivado da atividade de agendamentos (demonstrativo).
export function monitoramentoBarbearia(id) {
    const b = barbearia(id);
    if (!b) return null;
    const m = O.metricasBarbearia(b);
    const serie = O.seriePorDia(O.filtrarAgendamentos({ periodo: 30, barbeariaId: id }), 30);
    const requisicoes = serie.map((d) => ({ ...d, valor: Math.round(d.valor * 26 + 120) }));
    const incs = incidentes("tecnico").filter((i) => i.barbeariaId === id);
    const chamadosTec = O.chamados().filter((c) => c.barbeariaId === id && c.categoria === "tecnico");
    const errosRegistrados = incs.length * 37 + chamadosTec.length * 12 + Math.round(m.ag30 * 0.004);
    return {
        barbearia: b, metricas: m, requisicoes, requisicoesTotal: requisicoes.reduce((s, x) => s + x.valor, 0),
        errosRegistrados, incidentes: incs, chamadosTecnicos: chamadosTec,
        alertas: alertas().filter((a) => a.referencia?.tipo === "barbearia" && a.referencia.id === id),
        alertasAtividade: O.alertasAtividade().filter((a) => a.barbeariaId === id)
    };
}

// =====================================================================
// BACKUPS E RECUPERAÇÃO
// =====================================================================
export const backups = () => listar("backups");
export const backup = (id) => obter("backups", id);
export const recuperacoes = () => listar("recuperacoes");
export const recuperacao = (id) => obter("recuperacoes", id);
export const politica = () => obterConfig("politicaBackup");
export const continuidade = () => obterConfig("continuidade");

export function filtrarBackups({ busca = "", tipo = "", status = "" } = {}) {
    const termo = normalizar(busca);
    return backups().filter((b) => (!tipo || b.tipo === tipo) && (!status || b.status === status) &&
        (!termo || normalizar(`${b.codigo} ${b.nome}`).includes(termo)));
}

export function resumoBackups() {
    const lista = backups();
    const concluidos = lista.filter((b) => b.status === "concluido" || b.status === "arquivado");
    const agora = agoraIso();
    const ultimo = [...lista].filter((b) => b.status !== "pendente" && b.data <= agora).sort((a, b) => b.data.localeCompare(a.data))[0];
    const recentes = lista.filter((b) => b.status === "concluido");
    return {
        total: lista.length, concluidos: concluidos.length, falhas: lista.filter((b) => b.status === "falhou").length,
        pendentes: lista.filter((b) => b.status === "pendente" || b.status === "andamento").length,
        ultimo, espacoMb: lista.filter((b) => b.status === "concluido").reduce((s, b) => s + (b.tamanhoMb ?? 0), 0),
        integridadeVerificada: recentes.filter((b) => b.integridade === "verificado_demo").length,
        integridadePendente: recentes.filter((b) => b.integridade !== "verificado_demo").length
    };
}

export function registrarBackup(dados) {
    if (!TIPOS_BACKUP[dados.tipo]) throw new ErroValidacao("Selecione o tipo.", "tipo");
    if (!ORIGENS_BACKUP[dados.origem]) throw new ErroValidacao("Selecione a origem.", "origem");
    if (backups().some((b) => normalizar(b.nome) === normalizar(dados.nome) && b.status === "pendente")) {
        throw new ErroValidacao("Já existe um backup pendente com este nome.", "nome");
    }
    const novo = inserir("backups", {
        codigo: codigo("BKP", proximaSequencia("backup"), 5), nome: dados.nome.trim(), tipo: dados.tipo, origem: dados.origem,
        data: agoraIso(), tamanhoMb: null, status: "pendente", retencao: dados.retencao, integridade: "nao_verificado",
        observacao: dados.observacao?.trim() ?? "", erro: null
    });
    registrarHistorico({ entidade: "backup", entidadeId: novo.id, acao: "registrado", descricao: `Backup ${novo.codigo} registrado como pendente (demonstração; nada foi copiado).` });
    return novo;
}

const TAMANHO_ESTIMADO = { completo: 1450, incremental: 55, banco: 382, arquivos: 1100, configuracoes: 0.2 };

// Avança a execução simulada: pendente → em andamento → concluído.
export function simularExecucao(id) {
    const b = backup(id);
    if (!b) throw new Error("Backup não encontrado.");
    if (b.status === "pendente") {
        // Execução antecipada de um agendado: a data passa a ser a do início real da simulação.
        atualizar("backups", id, { status: "andamento", data: agoraIso() });
        registrarHistorico({ entidade: "backup", entidadeId: id, acao: "andamento", descricao: "Execução simulada iniciada." });
        return "andamento";
    }
    if (b.status === "andamento") {
        atualizar("backups", id, { status: "concluido", tamanhoMb: TAMANHO_ESTIMADO[b.tipo] });
        registrarHistorico({ entidade: "backup", entidadeId: id, acao: "concluido", descricao: `Execução simulada concluída (${TAMANHO_ESTIMADO[b.tipo]} MB estimados). Nenhum backup real foi criado.` });
        return "concluido";
    }
    throw new Error("Só backups pendentes ou em andamento podem avançar.");
}

export function verificarIntegridade(id) {
    const b = backup(id);
    if (!b) throw new Error("Backup não encontrado.");
    if (b.status !== "concluido") throw new Error("Só backups concluídos podem ter a integridade verificada.");
    if (b.integridade === "verificado_demo") throw new Error("Integridade já verificada (demonstração).");
    atualizar("backups", id, { integridade: "verificado_demo" });
    registrarHistorico({ entidade: "backup", entidadeId: id, acao: "integridade", descricao: "Integridade verificada em simulação. Nenhum arquivo real foi lido." });
    const aberto = alertasAbertos((a) => a.tipo === "integridade_pendente" && a.referencia?.id === id)[0];
    if (aberto) alterarStatusAlerta(aberto.id, "resolvido", "Integridade verificada (demonstração).");
}

export function arquivarBackup(id) {
    const b = backup(id);
    if (!b) throw new Error("Backup não encontrado.");
    if (b.status === "arquivado" || b.status === "pendente" || b.status === "andamento") throw new Error("Este backup não pode ser arquivado agora.");
    atualizar("backups", id, { status: "arquivado" });
    registrarHistorico({ entidade: "backup", entidadeId: id, acao: "arquivado", descricao: "Backup arquivado (nenhum dado foi excluído)." });
}

export function salvarPolitica(dados) {
    if (dados.retencaoDiaria > dados.prazoDias) throw new ErroValidacao("A retenção diária não pode superar o prazo de armazenamento.", "retencaoDiaria");
    if (dados.retencaoSemanal * 7 > dados.prazoDias) throw new ErroValidacao("A retenção semanal excede o prazo de armazenamento.", "retencaoSemanal");
    if (dados.retencaoMensal * 30 > dados.prazoDias) throw new ErroValidacao("A retenção mensal excede o prazo de armazenamento.", "retencaoMensal");
    const antes = politica();
    const nova = salvarConfig("politicaBackup", {
        frequencia: dados.frequencia, horario: dados.horario, retencaoDiaria: dados.retencaoDiaria,
        retencaoSemanal: dados.retencaoSemanal, retencaoMensal: dados.retencaoMensal, prazoDias: dados.prazoDias,
        destinoExterno: dados.destinoExterno.trim() || "Não configurado (pendente de integração)"
    });
    const mudancas = ["frequencia", "horario", "retencaoDiaria", "retencaoSemanal", "retencaoMensal", "prazoDias", "destinoExterno"]
        .filter((k) => String(antes[k]) !== String(nova[k]));
    registrarHistorico({ entidade: "politica_backup", entidadeId: "politica", acao: "alterada",
        descricao: mudancas.length ? `Política demonstrativa atualizada: ${mudancas.join(", ")}.` : "Política salva sem alterações." });
    return nova;
}

export function solicitarRestauracao(dados) {
    const b = backup(dados.backupId);
    if (!b || b.status !== "concluido") throw new ErroValidacao("Escolha um backup concluído (não arquivado).", "backupId");
    if (!AMBIENTES_RECUPERACAO[dados.ambiente]) throw new ErroValidacao("Selecione o ambiente.", "ambiente");
    if (dados.ambiente === "producao" && dados.confirmacaoTexto !== "SIMULAR") {
        throw new ErroValidacao("Para produção, digite SIMULAR para confirmar que entende que é uma simulação.", "confirmacaoTexto");
    }
    const nova = inserir("recuperacoes", {
        codigo: codigo("REC", proximaSequencia("recuperacao")), backupId: b.id, ambiente: dados.ambiente, motivo: dados.motivo.trim(),
        status: "solicitada", etapa: 0, solicitadoEm: agoraIso(), concluidoEm: null, solicitante: "Proprietário do SaaS"
    });
    registrarHistorico({ entidade: "recuperacao", entidadeId: nova.id, acao: "solicitada", descricao: `Restauração simulada de ${b.codigo} solicitada para ${AMBIENTES_RECUPERACAO[dados.ambiente]}. Nada será restaurado.` });
    registrarHistorico({ entidade: "backup", entidadeId: b.id, acao: "restauracao", descricao: `Usado na solicitação de restauração simulada ${nova.codigo}.` });
    criarAlerta({ tipo: "restauracao_pendente", gravidade: dados.ambiente === "producao" ? "alta" : "baixa", descricao: `Solicitação de restauração ${nova.codigo} aguardando andamento.`, referencia: { tipo: "recuperacao", id: nova.id } });
    return nova;
}

export function avancarRestauracao(id) {
    const r = recuperacao(id);
    if (!r) throw new Error("Solicitação não encontrada.");
    if (r.status === "simulada" || r.status === "cancelada") throw new Error("Esta solicitação já foi finalizada.");
    const etapa = r.etapa + 1;
    const terminou = etapa >= ETAPAS_RECUPERACAO.length;
    atualizar("recuperacoes", id, { etapa, status: terminou ? "simulada" : "em_simulacao", concluidoEm: terminou ? agoraIso() : null });
    registrarHistorico({ entidade: "recuperacao", entidadeId: id, acao: "etapa",
        descricao: terminou ? "Simulação concluída. Nenhum dado real foi restaurado." : `Etapa simulada concluída: ${ETAPAS_RECUPERACAO[etapa - 1]}.` });
    if (terminou) fecharAlertasRecuperacao(id, "Simulação de restauração concluída.");
}

export function cancelarRestauracao(id, motivo) {
    const r = recuperacao(id);
    if (!r) throw new Error("Solicitação não encontrada.");
    if (r.status === "simulada" || r.status === "cancelada") throw new Error("Esta solicitação já foi finalizada.");
    atualizar("recuperacoes", id, { status: "cancelada" });
    registrarHistorico({ entidade: "recuperacao", entidadeId: id, acao: "cancelada", descricao: `Solicitação cancelada. ${motivo.trim()}` });
    fecharAlertasRecuperacao(id, "Solicitação de restauração cancelada.");
}

function fecharAlertasRecuperacao(id, comentario) {
    alertasAbertos((a) => a.tipo === "restauracao_pendente" && a.referencia?.id === id).forEach((a) => alterarStatusAlerta(a.id, "resolvido", comentario));
}

export function salvarContinuidade(dados) {
    if (dados.rtoHoras > 72) throw new ErroValidacao("Um RTO acima de 72 horas é inviável para um SaaS de agendamentos.", "rtoHoras");
    const nova = salvarConfig("continuidade", { rpoHoras: dados.rpoHoras, rtoHoras: dados.rtoHoras, estrategia: dados.estrategia.trim(), responsaveis: dados.responsaveis.trim() });
    registrarHistorico({ entidade: "continuidade", entidadeId: "plano", acao: "alterado", descricao: `Plano de continuidade atualizado: RPO ${nova.rpoHoras} h, RTO ${nova.rtoHoras} h.` });
    return nova;
}

export function registrarTesteRecuperacao(dados) {
    const c = continuidade();
    const teste = { id: `tr_${Date.now().toString(36)}`, data: new Date(`${dados.data}T12:00:00`).toISOString(), tipo: dados.tipo.trim(), resultado: dados.resultado, duracaoMin: dados.duracaoMin, observacoes: dados.observacoes.trim() };
    salvarConfig("continuidade", { testes: [...c.testes, teste] });
    registrarHistorico({ entidade: "continuidade", entidadeId: "plano", acao: "teste", descricao: `Teste registrado: ${teste.tipo} · ${teste.resultado} · ${teste.duracaoMin} min (demonstrativo).` });
    return teste;
}

export { usuario, barbearias };
