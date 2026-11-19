// =====================================================================
// AUDITORIA E ACESSOS (módulo 20) — modo demonstrativo
// Consolida, SEM COPIAR, dois registros que já existem:
//   • eventos de autenticação (eventosAuth, módulo 10) → acessos
//   • histórico de operações (historico, módulos 02–19) → operações
// Os registros ficam no localStorage e podem ser alterados por quem usa
// o navegador: NÃO é uma trilha de auditoria inviolável. A versão real
// deve gravar a auditoria no backend, em tabela só de inserção.
// =====================================================================
import { listar, obterConfig, salvarConfig, registrarHistorico } from "./store.js";
import * as I from "./infra.js";
import { configuracao, salvarCategoria, RESPONSAVEL_DEMO } from "./configuracoes.js";

const DIA = 86400000;
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const TIPOS_AUDITORIA = {
    login: { rotulo: "Login", icone: "log-in" },
    logout: { rotulo: "Logout", icone: "log-out" },
    login_recusado: { rotulo: "Login recusado", icone: "circle-x" },
    sessao_encerrada: { rotulo: "Sessão encerrada", icone: "timer-off" },
    tentativa_suspeita: { rotulo: "Tentativa suspeita", icone: "shield-alert" },
    alteracao_credenciais: { rotulo: "Alteração de credenciais", icone: "key-round" },
    cadastro: { rotulo: "Cadastro", icone: "circle-plus" },
    edicao: { rotulo: "Edição", icone: "pencil" },
    arquivamento: { rotulo: "Arquivamento", icone: "archive" },
    alteracao_dados: { rotulo: "Alteração de dados", icone: "refresh-cw" },
    alteracao_configuracao: { rotulo: "Alteração de configurações", icone: "settings" },
    alteracao_funcionalidade: { rotulo: "Alteração de funcionalidades", icone: "toggle-right" },
    alteracao_plano: { rotulo: "Alteração de planos", icone: "badge-check" },
    operacao_administrativa: { rotulo: "Operação administrativa", icone: "user-cog" }
};

export const GRAVIDADES_AUDITORIA = {
    baixa: { rotulo: "Baixa", tom: "neutro", peso: 1 },
    media: { rotulo: "Média", tom: "atencao", peso: 2 },
    alta: { rotulo: "Alta", tom: "erro", peso: 3 },
    critica: { rotulo: "Crítica", tom: "erro", peso: 4 }
};

export const RESULTADOS_AUDITORIA = {
    sucesso: { rotulo: "Sucesso", tom: "sucesso" },
    falha: { rotulo: "Falha", tom: "atencao" },
    bloqueado: { rotulo: "Bloqueado", tom: "erro" }
};

// Entidade do histórico → módulo de origem e rota do registro.
const MODULOS = {
    barbearia: ["02 · Barbearias", (id) => `#/barbearias/${id}`],
    assinatura: ["03 · Assinaturas e planos", (id) => `#/assinaturas/${id}`],
    plano: ["03 · Assinaturas e planos", () => "#/assinaturas/planos"],
    transacao: ["04 · Financeiro", (id) => `#/financeiro/${id}`],
    usuario: ["05 · Usuários", (id) => `#/usuarios/${id}`],
    chamado: ["07 · Suporte", (id) => `#/suporte/${id}`],
    comunicado: ["08 · Notificações", (id) => `#/notificacoes/${id}`],
    campanha: ["09 · Marketing", (id) => `#/marketing/campanha/${id}`],
    pesquisa: ["09 · Marketing", (id) => `#/marketing/pesquisa/${id}`],
    cupom: ["09 · Marketing", () => "#/marketing/cupons"],
    indicacao: ["09 · Marketing", () => "#/marketing/indicacoes"],
    alerta: ["10 · Segurança", (id) => `#/seguranca/alerta/${id}`],
    incidente_seg: ["10 · Segurança", (id) => `#/seguranca/incidente/${id}`],
    evento_auth: ["10 · Segurança", () => "#/seguranca/autenticacao"],
    sessao: ["10 · Segurança", () => "#/auditoria/sessoes"],
    permissao: ["10 · Segurança", () => "#/seguranca/permissoes"],
    verificacao: ["10 · Segurança", () => "#/seguranca/verificacao"],
    servico: ["11 · Monitoramento", (id) => `#/monitoramento/servico/${id}`],
    incidente_tec: ["11 · Monitoramento", (id) => `#/monitoramento/incidente/${id}`],
    backup: ["12 · Backups", (id) => `#/backups/backup/${id}`],
    recuperacao: ["12 · Backups", () => "#/backups/recuperacao"],
    politica_backup: ["12 · Backups", () => "#/backups/politica"],
    continuidade: ["12 · Backups", () => "#/backups/continuidade"],
    versao: ["13 · Atualizações", (id) => `#/atualizacoes/versao/${id}`],
    rollback: ["13 · Atualizações", () => "#/atualizacoes/rollback"],
    grupo_testes: ["13 · Atualizações", () => "#/atualizacoes/distribuicao"],
    funcionalidade: ["14 · Funcionalidades", () => "#/funcionalidades"],
    flag: ["14 · Funcionalidades", () => "#/funcionalidades/flags"],
    liberacao: ["14 · Funcionalidades", () => "#/funcionalidades/liberacoes"],
    mudanca: ["15 · Histórico de alterações", (id) => `#/historico/mudanca/${id}`],
    ideia: ["16 · Roadmap", (id) => `#/roadmap/ideia/${id}`],
    recomendacao: ["18 · Inteligência", () => "#/inteligencia/recomendacoes"],
    configuracao: ["19 · Configurações", (id) => `#/configuracoes/${String(id).split(".")[0] === "identidade" ? "" : String(id).split(".")[0]}`],
    auditoria: ["20 · Auditoria", () => "#/auditoria/retencao"]
};

export const moduloDe = (entidade) => MODULOS[entidade]?.[0] ?? "Outros";
export const MODULOS_AUDITORIA = [...new Set(["10 · Autenticação", ...Object.values(MODULOS).map(([m]) => m), "Outros"])].sort();

// ---------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------
const TIPO_AUTH = { login_ok: "login", logout: "logout", login_recusado: "login_recusado", sessao_encerrada: "sessao_encerrada", suspeita: "tentativa_suspeita", credenciais: "alteracao_credenciais" };

function tipoDaOperacao(h) {
    const a = normalizar(h.acao);
    if (["configuracao", "politica_backup", "continuidade", "grupo_testes"].includes(h.entidade)) return "alteracao_configuracao";
    if (["funcionalidade", "flag", "liberacao"].includes(h.entidade)) return "alteracao_funcionalidade";
    if (h.entidade === "plano") return "alteracao_plano";
    if (/arquiv/.test(a)) return "arquivamento";
    if (/cadastr|criad|registrad|^nov|inser|aberto|solicitad/.test(a)) return "cadastro";
    if (/edit|alterad|atualiz|editad/.test(a)) return "edicao";
    if (/suspen|reativ|cancel|status|encerr|resolv|conclu|descart|aprov|revog|ativ|publica|distribu|interromp|retom/.test(a)) return "alteracao_dados";
    return "operacao_administrativa";
}

function gravidadeDaOperacao(h, tipo) {
    const a = normalizar(h.acao);
    if (/suspen|cancel|revog|exclu|rollback/.test(a) || ["permissao", "rollback", "incidente_seg"].includes(h.entidade)) return "critica";
    if (h.entidade === "configuracao" && ["acesso", "seguranca"].includes(h.detalhes?.categoria)) return "alta";
    if (["plano", "flag", "recuperacao", "versao"].includes(h.entidade) || tipo === "alteracao_plano") return "alta";
    if (["edicao", "alteracao_dados", "alteracao_configuracao", "alteracao_funcionalidade", "arquivamento"].includes(tipo)) return "media";
    return "baixa";
}

function gravidadeDoAcesso(e) {
    if (e.tipo === "suspeita") return "critica";
    if (e.tipo === "credenciais") return "alta";
    if (e.tipo === "login_recusado") return e.status === "analise" ? "alta" : "media";
    return "baixa";
}

// ---------------------------------------------------------------------
// Consolidação (sem copiar registros)
// ---------------------------------------------------------------------
function deAcesso(e) {
    const tipo = TIPO_AUTH[e.tipo] ?? "operacao_administrativa";
    return {
        id: e.id, origem: "acesso", usuario: e.usuarioNome ?? "—", tipo, modulo: "10 · Autenticação",
        registro: e.id, link: "#/seguranca/autenticacao", data: e.data,
        descricao: `${TIPOS_AUDITORIA[tipo].rotulo} no ${e.sistema ?? "sistema"} a partir de ${e.origem?.cidade ?? "origem desconhecida"} (${e.origem?.dispositivo ?? "dispositivo não informado"}).`,
        resultado: e.resultado ?? "sucesso", gravidade: gravidadeDoAcesso(e),
        detalhes: { sistema: e.sistema, ip: e.origem?.ip, cidade: e.origem?.cidade, dispositivo: e.origem?.dispositivo, statusRevisao: e.status, tipoOriginal: e.tipo }
    };
}

function deOperacao(h) {
    const tipo = tipoDaOperacao(h);
    const mod = MODULOS[h.entidade];
    return {
        id: h.id, origem: "operacao", usuario: h.detalhes?.responsavel ?? RESPONSAVEL_DEMO, tipo, modulo: mod?.[0] ?? "Outros",
        registro: `${h.entidade} · ${h.entidadeId}`, link: mod ? mod[1](h.entidadeId) : "", data: h.data,
        descricao: h.descricao, resultado: "sucesso", gravidade: gravidadeDaOperacao(h, tipo),
        detalhes: { entidade: h.entidade, entidadeId: h.entidadeId, acao: h.acao, ...(h.detalhes ?? {}) }
    };
}

export function eventos() {
    return [...listar("eventosAuth").map(deAcesso), ...listar("historico").map(deOperacao)].sort((a, b) => b.data.localeCompare(a.data));
}

export function evento(id) {
    const e = listar("eventosAuth").find((x) => x.id === id);
    if (e) return deAcesso(e);
    const h = listar("historico").find((x) => x.id === id);
    return h ? deOperacao(h) : null;
}

export function usuariosAuditoria() {
    return [...new Set(eventos().map((e) => e.usuario))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function filtrar({ busca = "", dias = "", usuario = "", modulo = "", tipo = "", resultado = "", gravidade = "", origem = "" } = {}) {
    const limite = dias ? Date.now() - Number(dias) * DIA : null;
    const termo = normalizar(busca);
    return eventos().filter((e) =>
        (!limite || new Date(e.data).getTime() >= limite) && (!usuario || e.usuario === usuario) && (!modulo || e.modulo === modulo) &&
        (!tipo || e.tipo === tipo) && (!resultado || e.resultado === resultado) && (!gravidade || e.gravidade === gravidade) &&
        (!origem || e.origem === origem) &&
        (!termo || normalizar(`${e.id} ${e.usuario} ${e.descricao} ${e.registro} ${e.detalhes?.ip ?? ""}`).includes(termo)));
}

export function resumo() {
    const lista = eventos();
    const cont = (f) => lista.filter(f).length;
    return {
        total: lista.length,
        logins: cont((e) => e.tipo === "login"),
        recusados: cont((e) => e.tipo === "login_recusado"),
        operacoes: cont((e) => e.origem === "operacao"),
        configuracoes: cont((e) => e.tipo === "alteracao_configuracao"),
        suspeitos: cont((e) => e.tipo === "tentativa_suspeita" || (e.origem === "acesso" && e.detalhes.statusRevisao === "analise")),
        sessoes: listar("sessoesAdmin").length,
        sessoesAtivas: listar("sessoesAdmin").filter((s) => s.status === "ativa").length,
        criticos: cont((e) => e.gravidade === "critica"),
        primeiro: lista.at(-1)?.data ?? null
    };
}

// ---------------------------------------------------------------------
// Sessões (as mesmas do módulo 10)
// ---------------------------------------------------------------------
export function sessoes() {
    return listar("sessoesAdmin").map((s) => {
        const fim = s.status === "ativa" ? Date.now() : new Date(s.ultimoAcesso).getTime();
        return { ...s, duracaoMin: Math.max(0, Math.round((fim - new Date(s.inicio).getTime()) / 60000)) };
    }).sort((a, b) => b.inicio.localeCompare(a.inicio));
}

export const encerrarSessao = (id) => I.encerrarSessao(id);

// ---------------------------------------------------------------------
// Retenção (mesma configuração do módulo 19 › Segurança)
// ---------------------------------------------------------------------
export function retencao() {
    const c = configuracao("seguranca");
    return {
        acessosDias: c.retencaoAcessosDias, operacoesDias: c.retencaoOperacoesDias,
        categorias: c.categoriasAuditadas, politica: c.politicaPreservacao
    };
}

export function salvarRetencao(valores) {
    return salvarCategoria("seguranca", {
        retencaoAcessosDias: valores.acessosDias, retencaoOperacoesDias: valores.operacoesDias,
        categoriasAuditadas: valores.categorias, politicaPreservacao: valores.politica
    });
}

// Quantos registros já passaram do prazo (seriam arquivados no backend).
export function previaArquivamento() {
    const r = retencao();
    const limiteAcessos = Date.now() - r.acessosDias * DIA;
    const limiteOps = Date.now() - r.operacoesDias * DIA;
    return {
        acessos: listar("eventosAuth").filter((e) => new Date(e.data).getTime() < limiteAcessos).length,
        operacoes: listar("historico").filter((h) => new Date(h.data).getTime() < limiteOps).length,
        ...r
    };
}

export const historicoArquivamento = () => obterConfig("arquivamentosAuditoria")?.execucoes ?? [];

// Simulação: registra a execução e NÃO exclui nenhum registro.
export function simularArquivamento() {
    const p = previaArquivamento();
    const execucao = {
        id: `arq_${Date.now().toString(36)}`, data: new Date().toISOString(), acessos: p.acessos, operacoes: p.operacoes,
        politica: p.politica, prazoAcessos: p.acessosDias, prazoOperacoes: p.operacoesDias, responsavel: RESPONSAVEL_DEMO
    };
    salvarConfig("arquivamentosAuditoria", { execucoes: [execucao, ...historicoArquivamento()].slice(0, 50) });
    registrarHistorico({
        entidade: "auditoria", entidadeId: execucao.id, acao: "arquivamento_simulado",
        descricao: `Arquivamento simulado: ${p.acessos} eventos de acesso e ${p.operacoes} operações passaram do prazo de retenção. Nenhum registro foi excluído (demonstração).`,
        detalhes: { responsavel: RESPONSAVEL_DEMO, acessos: p.acessos, operacoes: p.operacoes }
    });
    return execucao;
}
