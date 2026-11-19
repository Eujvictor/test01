// =====================================================================
// REGRAS DE NEGÓCIO — EVOLUÇÃO DO SAAS (módulos 13, 14, 15 e 16)
// Nada aqui publica, reverte ou implanta código: versões, distribuições
// e rollbacks são registros demonstrativos. Feature flags NÃO substituem
// a autorização do backend: o acesso efetivo combina direito comercial
// (plano), exceções individuais, flags e dependências.
// =====================================================================
import { listar, obter, atualizar, inserir, registrarHistorico, historicoDe, proximaSequencia, obterConfig, salvarConfig } from "./store.js";
import {
    STATUS_VERSAO, STATUS_ROLLBACK, STATUS_IDEIA, PRIORIDADES_IDEIA, CATEGORIAS_MUDANCA, NATUREZAS_MUDANCA
} from "./catalogo.js";
import { ErroValidacao, barbearia, barbearias, plano, planos, assinaturaDaBarbearia } from "./saas.js";

export { historicoDe };

const DIA = 86400000;
const agoraIso = () => new Date().toISOString();
const hojeTexto = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const codigo = (prefixo, seq) => `${prefixo}-${String(seq).padStart(4, "0")}`;

// =====================================================================
// FUNCIONALIDADES (catálogo — fonte única)
// =====================================================================
export const funcionalidades = () => listar("funcionalidades");
export const funcionalidadePorChave = (chave) => funcionalidades().find((f) => f.chave === chave) ?? null;
export const funcionalidade = (id) => obter("funcionalidades", id);
export const nomeFuncionalidade = (chave) => funcionalidadePorChave(chave)?.nome ?? chave;

export function planosComFuncionalidade(chave) {
    return planos().filter((p) => p.funcionalidades.includes(chave));
}

function dependeDe(chave, alvo, visitados = new Set()) {
    if (visitados.has(chave)) return false;
    visitados.add(chave);
    const f = funcionalidadePorChave(chave);
    return (f?.dependencias ?? []).some((d) => d === alvo || dependeDe(d, alvo, visitados));
}

export function salvarFuncionalidade(dados, id = null) {
    const chave = dados.chave.trim();
    if (!/^[a-z][a-z0-9_]{2,40}$/.test(chave)) throw new ErroValidacao("Use letras minúsculas, números e _ (3 a 40 caracteres).", "chave");
    if (funcionalidades().some((f) => f.id !== id && f.chave === chave)) throw new ErroValidacao("Já existe uma funcionalidade com este identificador.", "chave");
    if (funcionalidades().some((f) => f.id !== id && normalizar(f.nome) === normalizar(dados.nome))) throw new ErroValidacao("Já existe uma funcionalidade com este nome.", "nome");
    const dependencias = dados.dependencias ?? [];
    if (dependencias.includes(chave)) throw new ErroValidacao("Uma funcionalidade não pode depender de si mesma.", "dependencias");
    const ciclo = dependencias.find((d) => dependeDe(d, chave));
    if (ciclo) throw new ErroValidacao(`Dependência circular: ${nomeFuncionalidade(ciclo)} já depende desta funcionalidade.`, "dependencias");
    const campos = { chave, nome: dados.nome.trim(), descricao: dados.descricao.trim(), categoria: dados.categoria, status: dados.status, dependencias };
    if (id) {
        const atual = funcionalidade(id);
        if (atual.chave !== chave) throw new ErroValidacao("O identificador técnico não pode ser alterado depois de criado.", "chave");
        atualizar("funcionalidades", id, campos);
        registrarHistorico({ entidade: "funcionalidade", entidadeId: id, acao: "edicao", descricao: `Funcionalidade "${campos.nome}" atualizada.` });
        return funcionalidade(id);
    }
    const nova = inserir("funcionalidades", { ...campos, id: `fn_${chave}` });
    registrarHistorico({ entidade: "funcionalidade", entidadeId: nova.id, acao: "criada", descricao: `Funcionalidade "${nova.nome}" adicionada ao catálogo (${chave}).` });
    registrarMudancaAutomatica({
        chaveAuto: `funcionalidade:${nova.id}`, titulo: `Funcionalidade adicionada ao catálogo: ${nova.nome}`, categoria: "funcionalidades",
        natureza: "nova_funcionalidade", descricao: `Identificador técnico ${chave}. Registro automático do módulo 14.`, funcionalidadeChave: chave, status: "planejada"
    });
    return nova;
}

// Associa/desassocia uma funcionalidade a um plano (direito comercial).
export function alternarFuncionalidadePlano(planoId, chave) {
    const p = plano(planoId);
    const f = funcionalidadePorChave(chave);
    if (!p || !f) throw new Error("Plano ou funcionalidade não encontrados.");
    const incluida = p.funcionalidades.includes(chave);
    if (!incluida) {
        const faltando = f.dependencias.filter((d) => !p.funcionalidades.includes(d));
        if (faltando.length) throw new Error(`Dependência não atendida no plano ${p.nome}: inclua antes ${faltando.map(nomeFuncionalidade).join(", ")}.`);
        if (f.status === "descontinuada") throw new Error("Funcionalidades descontinuadas não podem ser associadas a planos.");
    } else {
        const dependentes = p.funcionalidades.filter((c) => funcionalidadePorChave(c)?.dependencias.includes(chave));
        if (dependentes.length) throw new Error(`Não é possível remover: ${dependentes.map(nomeFuncionalidade).join(", ")} depende(m) desta funcionalidade no plano ${p.nome}.`);
    }
    const lista = incluida ? p.funcionalidades.filter((c) => c !== chave) : [...p.funcionalidades, chave];
    atualizar("planos", planoId, { funcionalidades: lista });
    const descricao = `${f.nome} ${incluida ? "removida do" : "associada ao"} plano ${p.nome} (direito comercial).`;
    registrarHistorico({ entidade: "funcionalidade", entidadeId: f.id, acao: "plano", descricao });
    registrarHistorico({ entidade: "plano", entidadeId: planoId, acao: "funcionalidade", descricao });
    return !incluida;
}

// ---------- Feature flags ----------
export const flags = () => listar("flags");
export const flag = (id) => obter("flags", id);

// Distribuição determinística: a mesma barbearia sempre cai no mesmo grupo.
function balde(texto) {
    let h = 0;
    for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % 100;
}

export function flagPermite(f, barbeariaId) {
    if (!f.ativa) return false;
    const hoje = hojeTexto();
    if (f.inicio > hoje || f.validade < hoje) return false;
    if (f.barbeariaIds.includes(barbeariaId)) return true;
    return balde(`${f.chave}|${barbeariaId}`) < f.percentual;
}

export function salvarFlag(dados, id = null) {
    const chave = dados.chave.trim();
    if (!/^ff_[a-z0-9_]{3,40}$/.test(chave)) throw new ErroValidacao("Use o prefixo ff_ seguido de letras minúsculas, números e _.", "chave");
    if (flags().some((f) => f.id !== id && f.chave === chave)) throw new ErroValidacao("Já existe uma flag com este identificador.", "chave");
    if (!funcionalidadePorChave(dados.funcionalidadeChave)) throw new ErroValidacao("Selecione a funcionalidade controlada.", "funcionalidadeChave");
    if (dados.validade < dados.inicio) throw new ErroValidacao("A validade deve ser igual ou posterior ao início.", "validade");
    const campos = {
        chave, nome: dados.nome.trim(), descricao: dados.descricao.trim(), funcionalidadeChave: dados.funcionalidadeChave,
        percentual: dados.percentual, barbeariaIds: dados.barbeariaIds ?? [], inicio: dados.inicio, validade: dados.validade
    };
    if (id) {
        atualizar("flags", id, campos);
        registrarHistorico({ entidade: "flag", entidadeId: id, acao: "edicao", descricao: `Flag ${chave} atualizada: ${campos.percentual}% e ${campos.barbeariaIds.length} empresas específicas.` });
        return flag(id);
    }
    const nova = inserir("flags", { ...campos, ativa: false });
    registrarHistorico({ entidade: "flag", entidadeId: nova.id, acao: "criada", descricao: `Flag ${chave} criada desativada (${campos.percentual}% de liberação).` });
    return nova;
}

export function alternarFlag(id) {
    const f = flag(id);
    if (!f) throw new Error("Flag não encontrada.");
    if (!f.ativa && f.validade < hojeTexto()) throw new Error("A validade da flag já terminou. Ajuste o período antes de ativar.");
    atualizar("flags", id, { ativa: !f.ativa });
    registrarHistorico({ entidade: "flag", entidadeId: id, acao: f.ativa ? "desativada" : "ativada", descricao: `Flag ${f.chave} ${f.ativa ? "desativada" : "ativada"} (demonstração).` });
    return !f.ativa;
}

// ---------- Liberações individuais ----------
export const liberacoes = () => listar("liberacoes");

export const liberacaoVencida = (l) => l.tipo === "temporario" && l.validade && l.validade < hojeTexto();

export function registrarLiberacao(dados) {
    const b = barbearia(dados.barbeariaId);
    if (!b) throw new ErroValidacao("Selecione uma barbearia cadastrada.", "barbeariaId");
    if (!funcionalidadePorChave(dados.funcionalidadeChave)) throw new ErroValidacao("Selecione a funcionalidade.", "funcionalidadeChave");
    if (dados.tipo === "temporario" && (!dados.validade || dados.validade <= hojeTexto())) throw new ErroValidacao("O acesso temporário precisa de uma validade futura.", "validade");
    const igual = liberacoes().find((l) => l.ativa && l.barbeariaId === b.id && l.funcionalidadeChave === dados.funcionalidadeChave && l.tipo === dados.tipo && !liberacaoVencida(l));
    if (igual) throw new ErroValidacao("Já existe uma regra ativa igual para esta empresa e funcionalidade.", "tipo");
    const nova = inserir("liberacoes", {
        barbeariaId: b.id, funcionalidadeChave: dados.funcionalidadeChave, tipo: dados.tipo,
        validade: dados.tipo === "bloquear" ? (dados.validade || null) : (dados.validade || null), motivo: dados.motivo.trim(), ativa: true
    });
    const rotulo = { liberar: "Liberação", temporario: "Acesso temporário", bloquear: "Bloqueio" }[dados.tipo];
    registrarHistorico({ entidade: "liberacao", entidadeId: nova.id, acao: "registrada", descricao: `${rotulo} de ${nomeFuncionalidade(dados.funcionalidadeChave)} para ${b.nome}${nova.validade ? ` até ${nova.validade.split("-").reverse().join("/")}` : ""}.` });
    registrarHistorico({ entidade: "barbearia", entidadeId: b.id, acao: "liberacao", descricao: `${rotulo} individual de ${nomeFuncionalidade(dados.funcionalidadeChave)} (módulo 14).` });
    return nova;
}

export function revogarLiberacao(id) {
    const l = obter("liberacoes", id);
    if (!l || !l.ativa) throw new Error("Regra não encontrada ou já revogada.");
    atualizar("liberacoes", id, { ativa: false });
    registrarHistorico({ entidade: "liberacao", entidadeId: id, acao: "revogada", descricao: `Regra individual de ${nomeFuncionalidade(l.funcionalidadeChave)} para ${barbearia(l.barbeariaId)?.nome} revogada.` });
}

// ---------- Acesso efetivo (explica a decisão) ----------
export function acessoEfetivo(barbeariaId, chave, visitados = new Set()) {
    const b = barbearia(barbeariaId);
    const f = funcionalidadePorChave(chave);
    const p = assinaturaDaBarbearia(barbeariaId) ? plano(assinaturaDaBarbearia(barbeariaId).planoId) : null;
    const regras = liberacoes().filter((l) => l.ativa && l.barbeariaId === barbeariaId && l.funcionalidadeChave === chave);
    const vigentes = regras.filter((l) => !liberacaoVencida(l));
    const direitoPlano = Boolean(p?.funcionalidades.includes(chave));
    const excecao = vigentes.find((l) => l.tipo === "liberar" || l.tipo === "temporario");
    const bloqueio = vigentes.find((l) => l.tipo === "bloquear");
    const flagsDaFunc = flags().filter((x) => x.funcionalidadeChave === chave);
    const flagOk = !flagsDaFunc.length || flagsDaFunc.some((x) => flagPermite(x, barbeariaId));
    visitados.add(chave);
    const dependenciasFaltando = (f?.dependencias ?? []).filter((d) => !visitados.has(d) && !acessoEfetivo(barbeariaId, d, new Set(visitados)).liberado);
    const motivos = [];
    if (!b) motivos.push("Barbearia inexistente.");
    if (b && b.status !== "ativa" && b.status !== "teste") motivos.push(`Barbearia ${b.status}.`);
    if (f?.status === "descontinuada" || f?.status === "planejada") motivos.push(`Funcionalidade ${f.status}.`);
    if (!direitoPlano && !excecao) motivos.push("Sem direito comercial no plano e sem liberação individual.");
    if (bloqueio) motivos.push("Bloqueio administrativo individual.");
    if (!flagOk) motivos.push("Feature flag não libera para esta empresa.");
    if (dependenciasFaltando.length) motivos.push(`Dependência não atendida: ${dependenciasFaltando.map(nomeFuncionalidade).join(", ")}.`);
    return {
        barbearia: b, funcionalidade: f, plano: p, direitoPlano, excecao: excecao ?? null, bloqueio: bloqueio ?? null,
        regrasVencidas: regras.filter(liberacaoVencida), temFlag: flagsDaFunc.length > 0, flagOk, dependenciasFaltando,
        liberado: motivos.length === 0, motivos,
        origem: direitoPlano ? "Plano" : excecao ? (excecao.tipo === "temporario" ? "Acesso temporário" : "Liberação individual") : "—"
    };
}

// ---------- Alertas de configuração (calculados) ----------
export function alertasFuncionalidades() {
    const alertas = [];
    const hoje = hojeTexto();
    liberacoes().filter((l) => l.ativa && liberacaoVencida(l)).forEach((l) => alertas.push({
        tipo: "vencida", gravidade: "media", titulo: "Funcionalidade vencida",
        descricao: `Acesso temporário a ${nomeFuncionalidade(l.funcionalidadeChave)} para ${barbearia(l.barbeariaId)?.nome} venceu em ${l.validade.split("-").reverse().join("/")}.`, link: "#/funcionalidades/liberacoes", barbeariaId: l.barbeariaId
    }));
    flags().forEach((f) => {
        if (!f.ativa) alertas.push({ tipo: "flag_desativada", gravidade: "baixa", titulo: "Flag desativada", descricao: `${f.chave} está desativada: ${nomeFuncionalidade(f.funcionalidadeChave)} não é liberada por ela.`, link: "#/funcionalidades/flags" });
        if (f.ativa && f.validade < hoje) alertas.push({ tipo: "conflito", gravidade: "alta", titulo: "Conflito de configuração", descricao: `${f.chave} está ativa, mas a validade terminou em ${f.validade.split("-").reverse().join("/")}.`, link: "#/funcionalidades/flags" });
        f.barbeariaIds.forEach((bid) => {
            const a = acessoEfetivo(bid, f.funcionalidadeChave);
            if (!a.direitoPlano && !a.excecao) alertas.push({ tipo: "sem_direito", gravidade: "media", titulo: "Empresa sem direito comercial", descricao: `${barbearia(bid)?.nome} está na flag ${f.chave}, mas o plano não inclui ${nomeFuncionalidade(f.funcionalidadeChave)}.`, link: "#/funcionalidades/flags", barbeariaId: bid });
        });
    });
    const pares = new Map();
    liberacoes().filter((l) => l.ativa && !liberacaoVencida(l)).forEach((l) => {
        const k = `${l.barbeariaId}|${l.funcionalidadeChave}`;
        pares.set(k, [...(pares.get(k) ?? []), l]);
    });
    pares.forEach((lista) => {
        if (lista.some((l) => l.tipo === "bloquear") && lista.some((l) => l.tipo !== "bloquear")) {
            alertas.push({ tipo: "conflito", gravidade: "alta", titulo: "Conflito de configuração", descricao: `${barbearia(lista[0].barbeariaId)?.nome} tem liberação e bloqueio ativos para ${nomeFuncionalidade(lista[0].funcionalidadeChave)} (o bloqueio prevalece).`, link: "#/funcionalidades/liberacoes", barbeariaId: lista[0].barbeariaId });
        }
        lista.filter((l) => l.tipo !== "bloquear").forEach((l) => {
            const a = acessoEfetivo(l.barbeariaId, l.funcionalidadeChave);
            if (a.dependenciasFaltando.length) alertas.push({ tipo: "dependencia", gravidade: "media", titulo: "Dependência não atendida", descricao: `${nomeFuncionalidade(l.funcionalidadeChave)} liberada para ${barbearia(l.barbeariaId)?.nome}, mas falta ${a.dependenciasFaltando.map(nomeFuncionalidade).join(", ")}.`, link: "#/funcionalidades/liberacoes", barbeariaId: l.barbeariaId });
        });
    });
    planos().filter((p) => !p.arquivado).forEach((p) => p.funcionalidades.forEach((c) => {
        const faltando = (funcionalidadePorChave(c)?.dependencias ?? []).filter((d) => !p.funcionalidades.includes(d));
        if (faltando.length) alertas.push({ tipo: "dependencia", gravidade: "media", titulo: "Dependência não atendida", descricao: `Plano ${p.nome} inclui ${nomeFuncionalidade(c)} sem ${faltando.map(nomeFuncionalidade).join(", ")}.`, link: "#/funcionalidades/planos" });
    }));
    const ordem = { alta: 0, media: 1, baixa: 2 };
    return alertas.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
}

// =====================================================================
// VERSÕES, DISTRIBUIÇÃO E ROLLBACK
// =====================================================================
export const versoes = () => listar("versoes");
export const versao = (id) => obter("versoes", id);

export function compararVersoes(a, b) {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
}

export function versaoAtual() {
    return versoes().filter((v) => v.status === "publicada").sort((a, b) => compararVersoes(b.numero, a.numero))[0] ?? null;
}

export function proximoNumero(tipo = "minor") {
    const maior = versoes().map((v) => v.numero).sort(compararVersoes).at(-1) ?? "1.0.0";
    const [ma, mi, pa] = maior.split(".").map(Number);
    let candidato = tipo === "patch" ? `${ma}.${mi}.${pa + 1}` : tipo === "major" ? `${ma + 1}.0.0` : `${ma}.${mi + 1}.0`;
    while (versoes().some((v) => v.numero === candidato)) {
        const [x, y, z] = candidato.split(".").map(Number);
        candidato = `${x}.${y}.${z + 1}`;
    }
    return candidato;
}

export function grupoTestes() {
    return obterConfig("grupoTestes")?.barbeariaIds ?? [];
}

export function salvarGrupoTestes(ids) {
    if (!ids.length) throw new ErroValidacao("O grupo de testes precisa de ao menos uma barbearia.", "barbeariaIds");
    const invalidas = ids.filter((id) => barbearia(id)?.status !== "ativa");
    if (invalidas.length) throw new ErroValidacao("Use apenas barbearias ativas no grupo de testes.", "barbeariaIds");
    salvarConfig("grupoTestes", { barbeariaIds: ids });
    registrarHistorico({ entidade: "grupo_testes", entidadeId: "grupo", acao: "alterado", descricao: `Grupo de testes atualizado: ${ids.length} barbearias.` });
}

export function alcancePublicoVersao(publico) {
    const lista = barbearias().filter((b) => b.status !== "cancelada");
    switch (publico?.tipo) {
        case "todas": return lista;
        case "especificas": return lista.filter((b) => publico.barbeariaIds?.includes(b.id));
        case "plano": return lista.filter((b) => assinaturaDaBarbearia(b.id)?.planoId === publico.planoId);
        case "grupo_testes": return lista.filter((b) => grupoTestes().includes(b.id));
        default: return [];
    }
}

export function descreverPublicoVersao(publico) {
    if (publico?.tipo === "plano") return `Plano ${plano(publico.planoId)?.nome ?? "—"}`;
    if (publico?.tipo === "especificas") return `${publico.barbeariaIds?.length ?? 0} barbearias específicas`;
    return { todas: "Todas as barbearias", grupo_testes: "Grupo de testes" }[publico?.tipo] ?? "—";
}

function validarNumero(numero, id) {
    if (!/^\d+\.\d+\.\d+$/.test(numero)) throw new ErroValidacao("Use o formato MAIOR.MENOR.CORREÇÃO (ex.: 2.5.0).", "numero");
    if (versoes().some((v) => v.id !== id && v.numero === numero)) throw new ErroValidacao("Já existe uma versão com este número.", "numero");
}

export function salvarVersao(dados, id = null) {
    const numero = dados.numero.trim();
    validarNumero(numero, id);
    const desconhecidas = (dados.funcionalidades ?? []).filter((c) => !funcionalidadePorChave(c));
    if (desconhecidas.length) throw new ErroValidacao("Funcionalidade inexistente no catálogo.", "funcionalidades");
    const alteracoes = String(dados.alteracoes ?? "").split("\n").map((l) => l.trim()).filter(Boolean)
        .map((descricao, i) => ({ id: `alt_${Date.now().toString(36)}_${i}`, tipo: dados.categoria, descricao }));
    if (!alteracoes.length) throw new ErroValidacao("Inclua ao menos uma alteração (uma por linha).", "alteracoes");
    const campos = {
        numero, nome: dados.nome.trim(), descricao: dados.descricao.trim(), categoria: dados.categoria, responsavel: dados.responsavel.trim(),
        previsaoLancamento: dados.previsaoLancamento || null, alteracoes, funcionalidades: dados.funcionalidades ?? []
    };
    if (id) {
        const atual = versao(id);
        if (atual.status === "publicada") throw new Error("Versões publicadas não podem ser editadas. Crie uma nova versão.");
        atualizar("versoes", id, campos);
        registrarHistorico({ entidade: "versao", entidadeId: id, acao: "edicao", descricao: `Versão ${numero} atualizada.` });
        return versao(id);
    }
    const nova = inserir("versoes", {
        ...campos, status: "planejada", arquivada: false, publicadaEm: null, ideiaId: dados.ideiaId ?? null,
        distribuicao: { publico: { tipo: "todas" }, modo: "nenhum", percentual: 0, status: "nao_iniciada", atualizadoEm: agoraIso() }
    });
    registrarHistorico({ entidade: "versao", entidadeId: nova.id, acao: "criada", descricao: `Versão ${numero} cadastrada como planejada.` });
    return nova;
}

export function duplicarVersao(id) {
    const v = versao(id);
    if (!v) throw new Error("Versão não encontrada.");
    const numero = proximoNumero("patch");
    const nova = salvarVersao({
        numero, nome: `${v.nome} (cópia)`, descricao: v.descricao, categoria: v.categoria, responsavel: v.responsavel,
        previsaoLancamento: v.previsaoLancamento, alteracoes: v.alteracoes.map((a) => a.descricao).join("\n"), funcionalidades: [...v.funcionalidades]
    });
    registrarHistorico({ entidade: "versao", entidadeId: nova.id, acao: "duplicada", descricao: `Duplicada a partir da versão ${v.numero}.` });
    return nova;
}

const TRANSICOES = {
    planejada: ["desenvolvimento", "cancelada"],
    desenvolvimento: ["testes", "planejada", "cancelada"],
    testes: ["aprovada", "desenvolvimento", "cancelada"],
    aprovada: ["testes", "cancelada"],
    publicada: [],
    cancelada: ["planejada"]
};

export const transicoesPermitidas = (v) => TRANSICOES[v.status] ?? [];

export function alterarStatusVersao(id, status, comentario = "") {
    const v = versao(id);
    if (!v) throw new Error("Versão não encontrada.");
    if (status === "publicada") throw new ErroValidacao("A publicação acontece pela liberação geral na distribuição.", "status");
    if (!transicoesPermitidas(v).includes(status)) throw new ErroValidacao(`Não é possível passar de ${STATUS_VERSAO[v.status].rotulo} para ${STATUS_VERSAO[status]?.rotulo ?? status}.`, "status");
    const dist = status === "cancelada" && v.distribuicao.status === "em_andamento" ? { ...v.distribuicao, status: "interrompida", atualizadoEm: agoraIso() } : v.distribuicao;
    atualizar("versoes", id, { status, distribuicao: dist });
    registrarHistorico({ entidade: "versao", entidadeId: id, acao: "status", descricao: `Status alterado de ${STATUS_VERSAO[v.status].rotulo} para ${STATUS_VERSAO[status].rotulo}.${comentario ? ` ${comentario}` : ""}` });
}

export function arquivarVersao(id) {
    const v = versao(id);
    if (!v) throw new Error("Versão não encontrada.");
    if (!["planejada", "cancelada"].includes(v.status)) throw new Error("Só versões planejadas ou canceladas podem ser arquivadas. Versões publicadas fazem parte do histórico.");
    atualizar("versoes", id, { arquivada: !v.arquivada });
    registrarHistorico({ entidade: "versao", entidadeId: id, acao: v.arquivada ? "restaurada" : "arquivada", descricao: `Versão ${v.numero} ${v.arquivada ? "restaurada" : "arquivada"}.` });
}

export function definirPublicoVersao(id, publico) {
    const v = versao(id);
    if (v.status === "publicada" || v.distribuicao.status === "em_andamento") throw new Error("Interrompa a distribuição antes de mudar o público.");
    if (publico.tipo === "especificas" && !publico.barbeariaIds?.length) throw new ErroValidacao("Selecione ao menos uma barbearia.", "barbeariaIds");
    atualizar("versoes", id, { distribuicao: { ...v.distribuicao, publico, atualizadoEm: agoraIso() } });
    registrarHistorico({ entidade: "versao", entidadeId: id, acao: "publico", descricao: `Público da distribuição: ${descreverPublicoVersao(publico)} (${alcancePublicoVersao(publico).length} barbearias).` });
}

export function distribuir(id, modo, percentual = 100) {
    const v = versao(id);
    if (!v) throw new Error("Versão não encontrada.");
    if (v.status === "publicada" && modo !== "geral") throw new Error("Esta versão já foi publicada para todos.");
    if (modo === "grupo_testes" && !["testes", "aprovada"].includes(v.status)) throw new Error("Publique para o grupo de testes quando a versão estiver em testes ou aprovada.");
    if ((modo === "gradual" || modo === "geral") && v.status !== "aprovada") throw new Error("A distribuição gradual e a liberação geral exigem a versão aprovada.");
    if (modo === "gradual" && !(percentual > 0 && percentual < 100)) throw new ErroValidacao("Escolha um percentual entre 1 e 99.", "percentual");
    if (modo === "gradual" && v.distribuicao.modo === "gradual" && v.distribuicao.status === "em_andamento" && percentual <= v.distribuicao.percentual) {
        throw new ErroValidacao(`A distribuição já está em ${v.distribuicao.percentual}%. Escolha um percentual maior.`, "percentual");
    }
    const publico = modo === "grupo_testes" ? { tipo: "grupo_testes" } : v.distribuicao.publico.tipo === "grupo_testes" ? { tipo: "todas" } : v.distribuicao.publico;
    const geral = modo === "geral";
    atualizar("versoes", id, {
        status: geral ? "publicada" : v.status, publicadaEm: geral ? agoraIso() : v.publicadaEm,
        distribuicao: { publico, modo, percentual: modo === "grupo_testes" || geral ? 100 : percentual, status: geral ? "concluida" : "em_andamento", atualizadoEm: agoraIso() }
    });
    const textos = {
        grupo_testes: `Publicação demonstrativa para o grupo de testes (${grupoTestes().length} barbearias).`,
        gradual: `Distribuição gradual demonstrativa em ${percentual}% de ${descreverPublicoVersao(publico)}.`,
        geral: `Liberação geral demonstrativa concluída para ${descreverPublicoVersao(publico)}. Nenhum deploy real foi feito.`
    };
    registrarHistorico({ entidade: "versao", entidadeId: id, acao: "distribuicao", descricao: textos[modo] });
    if (geral) {
        registrarMudancaAutomatica({
            chaveAuto: `publicacao:${id}`, titulo: `Publicação da versão ${v.numero} · ${v.nome}`, categoria: "desenvolvimento",
            natureza: v.categoria === "correcao" ? "correcao" : v.categoria === "funcionalidade" ? "nova_funcionalidade" : "melhoria",
            descricao: `Liberação geral demonstrativa. Alterações: ${v.alteracoes.map((a) => a.descricao).join("; ")}.`,
            versaoId: id, funcionalidadeChave: v.funcionalidades[0] ?? null, status: "concluida", publico
        });
    }
}

export function interromperDistribuicao(id, motivo) {
    const v = versao(id);
    if (v.distribuicao.status !== "em_andamento") throw new Error("Não há distribuição em andamento.");
    atualizar("versoes", id, { distribuicao: { ...v.distribuicao, status: "interrompida", atualizadoEm: agoraIso() } });
    registrarHistorico({ entidade: "versao", entidadeId: id, acao: "interrompida", descricao: `Distribuição interrompida em ${v.distribuicao.percentual}%. Motivo: ${motivo.trim()}` });
}

export function retomarDistribuicao(id) {
    const v = versao(id);
    if (v.distribuicao.status !== "interrompida") throw new Error("A distribuição não está interrompida.");
    atualizar("versoes", id, { distribuicao: { ...v.distribuicao, status: "em_andamento", atualizadoEm: agoraIso() } });
    registrarHistorico({ entidade: "versao", entidadeId: id, acao: "retomada", descricao: `Distribuição retomada em ${v.distribuicao.percentual}%.` });
}

// Resultados demonstrativos, calculados a partir do alcance e do percentual.
export function resultadosDistribuicao(v) {
    const alcance = alcancePublicoVersao(v.distribuicao.publico);
    const atualizadas = v.distribuicao.status === "nao_iniciada" ? 0 : Math.round(alcance.length * (v.distribuicao.percentual / 100));
    const falhas = atualizadas ? Math.max(0, Math.round(atualizadas * 0.04)) : 0;
    return { alcance: alcance.length, atualizadas, pendentes: alcance.length - atualizadas, falhas, empresas: alcance };
}

export const rollbacks = () => listar("rollbacks");

export function solicitarRollback(dados) {
    const atual = versao(dados.versaoAtualId);
    const destino = versao(dados.versaoDestinoId);
    if (!atual || atual.status !== "publicada") throw new ErroValidacao("A versão atual precisa estar publicada.", "versaoAtualId");
    if (!destino || destino.status !== "publicada") throw new ErroValidacao("A versão de destino precisa ter sido publicada.", "versaoDestinoId");
    if (compararVersoes(destino.numero, atual.numero) >= 0) throw new ErroValidacao("A versão de destino deve ser anterior à versão atual.", "versaoDestinoId");
    if (rollbacks().some((r) => r.versaoAtualId === atual.id && ["solicitado", "em_analise", "aprovado"].includes(r.status))) {
        throw new ErroValidacao("Já existe uma solicitação de reversão em aberto para esta versão.", "versaoAtualId");
    }
    const novo = inserir("rollbacks", {
        codigo: codigo("RB", proximaSequencia("rollback")), versaoAtualId: atual.id, versaoDestinoId: destino.id,
        motivo: dados.motivo.trim(), responsavel: dados.responsavel.trim(), status: "solicitado", data: agoraIso()
    });
    registrarHistorico({ entidade: "rollback", entidadeId: novo.id, acao: "solicitado", descricao: `Reversão de ${atual.numero} para ${destino.numero} solicitada (registro demonstrativo).` });
    registrarHistorico({ entidade: "versao", entidadeId: atual.id, acao: "rollback", descricao: `Solicitação de reversão ${novo.codigo} para a versão ${destino.numero}.` });
    return novo;
}

const PASSOS_ROLLBACK = { analisar: ["solicitado", "em_analise"], aprovar: ["em_analise", "aprovado"], recusar: ["em_analise", "recusado"], concluir: ["aprovado", "concluido"] };

export function avancarRollback(id, acao, comentario = "") {
    const r = obter("rollbacks", id);
    const [de, para] = PASSOS_ROLLBACK[acao] ?? [];
    if (!r || r.status !== de) throw new Error("Esta ação não é possível no status atual.");
    atualizar("rollbacks", id, { status: para });
    registrarHistorico({ entidade: "rollback", entidadeId: id, acao, descricao: `${STATUS_ROLLBACK[para].rotulo}.${comentario ? ` ${comentario}` : ""}${para === "concluido" ? " Nenhum código foi alterado e nenhum deploy foi feito." : ""}` });
    if (para === "concluido") {
        const atual = versao(r.versaoAtualId);
        const destino = versao(r.versaoDestinoId);
        registrarMudancaAutomatica({
            chaveAuto: `rollback:${id}`, titulo: `Reversão simulada de ${atual?.numero} para ${destino?.numero}`, categoria: "desenvolvimento", natureza: "correcao",
            descricao: `${r.codigo}: ${r.motivo}`, versaoId: r.versaoAtualId, funcionalidadeChave: null, status: "concluida"
        });
    }
}

// =====================================================================
// HISTÓRICO DE MUDANÇAS
// =====================================================================
export const mudancas = () => listar("mudancas");
export const mudanca = (id) => obter("mudancas", id);

export function empresasAfetadas(m) {
    if (!m.publico || m.publico.tipo === "nenhum") return 0;
    return alcancePublicoVersao(m.publico).length;
}

function registrarMudancaAutomatica({ chaveAuto, publico = { tipo: "todas" }, ...dados }) {
    if (mudancas().some((m) => m.chaveAuto === chaveAuto)) return null;
    const m = inserir("mudancas", {
        codigo: codigo("CHG", proximaSequencia("mudanca")), ...dados, publico, data: agoraIso(), responsavel: "Registro automático do painel",
        referencias: { repositorio: "", branch: "", commit: "", arquivo: "", referencia: "" }, origem: "automatica", chaveAuto
    });
    registrarHistorico({ entidade: "mudanca", entidadeId: m.id, acao: "registrada", descricao: `Mudança ${m.codigo} registrada automaticamente.` });
    return m;
}

export function salvarMudanca(dados, id = null) {
    if (!CATEGORIAS_MUDANCA[dados.categoria]) throw new ErroValidacao("Selecione a categoria.", "categoria");
    if (!NATUREZAS_MUDANCA[dados.natureza]) throw new ErroValidacao("Selecione a natureza.", "natureza");
    if (dados.versaoId && !versao(dados.versaoId)) throw new ErroValidacao("Versão inválida.", "versaoId");
    if (dados.funcionalidadeChave && !funcionalidadePorChave(dados.funcionalidadeChave)) throw new ErroValidacao("Funcionalidade inválida.", "funcionalidadeChave");
    if (dados.commit && !/^[0-9a-f]{7,40}$/i.test(dados.commit)) throw new ErroValidacao("Use um identificador de commit com 7 a 40 caracteres hexadecimais.", "commit");
    const publico = dados.publico === "nenhum" ? { tipo: "nenhum" } : dados.publico?.startsWith("plano:") ? { tipo: "plano", planoId: dados.publico.slice(6) } : { tipo: dados.publico || "todas" };
    const campos = {
        titulo: dados.titulo.trim(), categoria: dados.categoria, natureza: dados.natureza, descricao: dados.descricao.trim(),
        versaoId: dados.versaoId || null, funcionalidadeChave: dados.funcionalidadeChave || null, responsavel: dados.responsavel.trim(),
        status: dados.status, publico,
        data: dados.data ? new Date(`${dados.data}T12:00:00`).toISOString() : agoraIso(),
        referencias: { repositorio: dados.repositorio?.trim() ?? "", branch: dados.branch?.trim() ?? "", commit: dados.commit?.trim() ?? "", arquivo: dados.arquivo?.trim() ?? "", referencia: dados.referencia?.trim() ?? "" }
    };
    if (id) {
        atualizar("mudancas", id, campos);
        registrarHistorico({ entidade: "mudanca", entidadeId: id, acao: "edicao", descricao: `Registro ${mudanca(id).codigo} editado.` });
        return mudanca(id);
    }
    const nova = inserir("mudancas", { ...campos, codigo: codigo("CHG", proximaSequencia("mudanca")), origem: "manual" });
    registrarHistorico({ entidade: "mudanca", entidadeId: nova.id, acao: "registrada", descricao: `Mudança ${nova.codigo} registrada manualmente.` });
    return nova;
}

export function filtrarMudancas({ busca = "", categoria = "", natureza = "", status = "", versaoId = "", dias = "" } = {}) {
    const termo = normalizar(busca);
    const limite = dias ? Date.now() - Number(dias) * DIA : 0;
    return mudancas().filter((m) =>
        (!categoria || m.categoria === categoria) && (!natureza || m.natureza === natureza) && (!status || m.status === status) &&
        (!versaoId || (versaoId === "sem" ? !m.versaoId : m.versaoId === versaoId)) && new Date(m.data).getTime() >= limite &&
        (!termo || normalizar(`${m.codigo} ${m.titulo} ${m.descricao}`).includes(termo)));
}

const ENTIDADES_AUDITORIA = ["versao", "rollback", "grupo_testes", "funcionalidade", "flag", "liberacao", "plano"];
export function auditoriaEvolucao() {
    return listar("historico").filter((h) => ENTIDADES_AUDITORIA.includes(h.entidade)).sort((a, b) => b.data.localeCompare(a.data));
}

// =====================================================================
// ROADMAP, SOLICITAÇÕES, PRIORIZAÇÃO E VOTAÇÃO
// =====================================================================
export const ideias = () => listar("ideias");
export const ideia = (id) => obter("ideias", id);

// Empresas beneficiadas: solicitante + barbearias que votaram (sem repetir).
export function empresasBeneficiadas(i) {
    return new Set([i.barbeariaId, ...i.votos.map((v) => v.barbeariaId)].filter(Boolean)).size;
}

// Pontuação transparente (0 a 100). Pesos: impacto 30, empresas 25,
// urgência 20, importância técnica 15, esforço 10 (menos esforço = mais pontos).
export const PESOS_PRIORIZACAO = { impacto: 30, empresas: 25, urgencia: 20, tecnica: 15, esforco: 10 };
export function pontuacao(i) {
    const empresas = Math.min(5, Math.ceil(empresasBeneficiadas(i) / 2));
    const fatores = {
        impacto: i.criterios.impacto / 5, empresas: empresas / 5, urgencia: i.criterios.urgencia / 5,
        tecnica: i.criterios.tecnica / 5, esforco: (6 - i.criterios.esforco) / 5
    };
    const partes = Object.fromEntries(Object.entries(fatores).map(([k, f]) => [k, Math.round(f * PESOS_PRIORIZACAO[k] * 10) / 10]));
    return { total: Math.round(Object.values(partes).reduce((s, x) => s + x, 0)), partes, notaEmpresas: empresas };
}

export function salvarIdeia(dados, id = null) {
    if (dados.origem === "barbearia" && !barbearia(dados.barbeariaId)) throw new ErroValidacao("Solicitações de barbearia precisam de uma barbearia cadastrada.", "barbeariaId");
    if (ideias().some((i) => i.id !== id && normalizar(i.titulo) === normalizar(dados.titulo) && i.status !== "cancelada")) {
        throw new ErroValidacao("Já existe uma ideia com este título. Registre um voto nela em vez de duplicar.", "titulo");
    }
    const campos = {
        titulo: dados.titulo.trim(), descricao: dados.descricao.trim(), categoria: dados.categoria, origem: dados.origem, prioridade: dados.prioridade,
        barbeariaId: dados.barbeariaId || null, responsavel: dados.responsavel.trim(), previsao: dados.previsao || null,
        criterios: { impacto: Number(dados.impacto), urgencia: Number(dados.urgencia), tecnica: Number(dados.tecnica), esforco: Number(dados.esforco) }
    };
    if (id) {
        atualizar("ideias", id, campos);
        registrarHistorico({ entidade: "ideia", entidadeId: id, acao: "edicao", descricao: "Ideia atualizada." });
        return ideia(id);
    }
    const nova = inserir("ideias", { ...campos, codigo: codigo("IDEA", proximaSequencia("ideia")), status: dados.status || "recebida", decisao: "", votos: [], versaoId: null, data: agoraIso() });
    registrarHistorico({ entidade: "ideia", entidadeId: nova.id, acao: "registrada", descricao: `Ideia "${nova.titulo}" registrada${nova.barbeariaId ? ` por solicitação de ${barbearia(nova.barbeariaId).nome}` : ""}.` });
    if (nova.barbeariaId) registrarHistorico({ entidade: "barbearia", entidadeId: nova.barbeariaId, acao: "solicitacao", descricao: `Solicitação registrada no roadmap: ${nova.titulo}.` });
    return nova;
}

export function moverIdeia(id, status) {
    const i = ideia(id);
    if (!i) throw new Error("Ideia não encontrada.");
    if (!STATUS_IDEIA[status]) throw new Error("Coluna inválida.");
    if (i.status === status) return;
    const anterior = i.status;
    atualizar("ideias", id, { status });
    registrarHistorico({ entidade: "ideia", entidadeId: id, acao: "status", descricao: `Movida de ${STATUS_IDEIA[anterior].rotulo} para ${STATUS_IDEIA[status].rotulo}.` });
}

export function alterarPrioridadeIdeia(id, prioridade) {
    const i = ideia(id);
    if (!PRIORIDADES_IDEIA[prioridade]) throw new ErroValidacao("Prioridade inválida.", "prioridade");
    if (i.prioridade === prioridade) throw new ErroValidacao("A ideia já tem esta prioridade.", "prioridade");
    const anterior = i.prioridade;
    atualizar("ideias", id, { prioridade });
    registrarHistorico({ entidade: "ideia", entidadeId: id, acao: "prioridade", descricao: `Prioridade alterada de ${PRIORIDADES_IDEIA[anterior].rotulo} para ${PRIORIDADES_IDEIA[prioridade].rotulo}.` });
}

export function registrarDecisao(id, { status, decisao }) {
    const i = ideia(id);
    atualizar("ideias", id, { decisao: decisao.trim(), status });
    registrarHistorico({ entidade: "ideia", entidadeId: id, acao: "decisao", descricao: `Decisão administrativa: ${STATUS_IDEIA[status].rotulo}. ${decisao.trim()}` });
    if (i.barbeariaId) registrarHistorico({ entidade: "barbearia", entidadeId: i.barbeariaId, acao: "decisao", descricao: `Decisão sobre a solicitação "${i.titulo}": ${STATUS_IDEIA[status].rotulo}.` });
}

export function votar(id, barbeariaId = "") {
    const i = ideia(id);
    if (!i) throw new Error("Ideia não encontrada.");
    if (barbeariaId && !barbearia(barbeariaId)) throw new ErroValidacao("Barbearia inválida.", "barbeariaId");
    if (barbeariaId && i.votos.some((v) => v.barbeariaId === barbeariaId)) throw new ErroValidacao("Esta barbearia já votou nesta ideia.", "barbeariaId");
    i.votos.push({ barbeariaId: barbeariaId || null, data: agoraIso(), ficticio: true });
    atualizar("ideias", id, { votos: i.votos });
    registrarHistorico({ entidade: "ideia", entidadeId: id, acao: "voto", descricao: `Voto fictício registrado (${barbeariaId ? barbearia(barbeariaId).nome : "voto interno"}). Nenhuma empresa foi consultada.` });
}

// Transforma uma ideia aprovada em versão planejada (módulo 13).
export function converterEmVersao(id, dadosVersao) {
    const i = ideia(id);
    if (!i) throw new Error("Ideia não encontrada.");
    if (!["aprovada", "planejada"].includes(i.status)) throw new Error("Só ideias aprovadas ou planejadas viram versão.");
    if (i.versaoId && versao(i.versaoId)) throw new Error(`Esta ideia já está vinculada à versão ${versao(i.versaoId).numero}.`);
    const v = salvarVersao({ ...dadosVersao, ideiaId: id });
    atualizar("ideias", id, { versaoId: v.id, status: "planejada" });
    registrarHistorico({ entidade: "ideia", entidadeId: id, acao: "versao", descricao: `Convertida na versão planejada ${v.numero}.` });
    registrarHistorico({ entidade: "versao", entidadeId: v.id, acao: "origem", descricao: `Criada a partir da ideia ${i.codigo}: ${i.titulo}.` });
    return v;
}

export { hojeTexto, barbearias, planos };
