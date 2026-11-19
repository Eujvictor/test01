// =====================================================================
// REGRAS DE NEGÓCIO DOS MÓDULOS DEMONSTRATIVOS
// Todas as alterações passam por aqui: validação, unicidade,
// relacionamentos e registro no histórico. Nenhuma operação real
// (cobrança, conta de usuário, e-mail) é executada.
// =====================================================================
import { listar, obter, inserir, atualizar, registrarHistorico, historicoDe } from "./store.js";

export { historicoDe };
export const historicoDaBarbearia = (id) => historicoDe("barbearia", id);
import { PERIODICIDADES, STATUS_BARBEARIA, FUNCIONALIDADES } from "./catalogo.js";
import { somarMeses } from "./seed.js";

export class ErroValidacao extends Error {
    constructor(mensagem, campo = null) {
        super(mensagem);
        this.name = "ErroValidacao";
        this.campo = campo;
    }
}

const normalizar = (texto) => String(texto ?? "").trim().toLowerCase();
const apenasDigitos = (texto) => String(texto ?? "").replace(/\D/g, "");

// ---------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------
export const planos = () => listar("planos");
export const planosDisponiveis = () => listar("planos").filter((p) => !p.arquivado);
export const plano = (id) => obter("planos", id);
export const barbearias = () => listar("barbearias");
export const barbearia = (id) => obter("barbearias", id);
export const assinaturas = () => listar("assinaturas");
export const assinatura = (id) => obter("assinaturas", id);
export const usuarios = () => listar("usuarios");
export const usuario = (id) => obter("usuarios", id);
export const transacoes = () => listar("transacoes");
export const transacao = (id) => obter("transacoes", id);
export const despesas = () => listar("despesas");

// Catálogo de funcionalidades: fonte única mantida pelo módulo 14.
// Retorna [{ id: chave, nome }] para os módulos 02 e 03 (direito comercial dos planos).
export function funcionalidadesCatalogo() {
    const lista = listar("funcionalidades");
    if (!lista) return FUNCIONALIDADES;
    return lista.filter((f) => f.status !== "descontinuada").map((f) => ({ id: f.chave, nome: f.nome }));
}

export function assinaturaDaBarbearia(barbeariaId) {
    return listar("assinaturas").find((a) => a.barbeariaId === barbeariaId) ?? null;
}

export function planoDaBarbearia(barbeariaId) {
    const a = assinaturaDaBarbearia(barbeariaId);
    return a ? plano(a.planoId) : null;
}

export function usuariosDaBarbearia(barbeariaId, tipo = null) {
    return listar("usuarios").filter((u) => u.barbeariaId === barbeariaId && (!tipo || u.tipo === tipo));
}

export function proprietarioDa(barbeariaId) {
    return usuariosDaBarbearia(barbeariaId, "proprietario")[0] ?? null;
}

export function contagens(barbeariaId) {
    const lista = usuariosDaBarbearia(barbeariaId);
    return {
        barbeiros: lista.filter((u) => u.tipo === "barbeiro").length,
        funcionarios: lista.filter((u) => u.tipo === "funcionario").length,
        clientes: lista.filter((u) => u.tipo === "cliente").length,
        total: lista.length
    };
}

export function transacoesDa(filtro) {
    return listar("transacoes").filter((t) => Object.entries(filtro).every(([k, v]) => t[k] === v));
}

export function valorDoPlano(p, periodicidade) {
    return periodicidade === "anual" ? p.precoAnual : p.precoMensal;
}

export function valorMensalEquivalente(a) {
    return a.periodicidade === "anual" ? a.valor / 12 : a.valor;
}

// MRR = assinaturas ativas (pagantes em dia), anual convertida para mês.
export function calcularMrr() {
    return listar("assinaturas").filter((a) => a.status === "ativa").reduce((s, a) => s + valorMensalEquivalente(a), 0);
}

function proximoVencimentoAPartirDeHoje(periodicidade) {
    return somarMeses(new Date(), PERIODICIDADES[periodicidade].meses).toISOString();
}

// ---------------------------------------------------------------------
// Barbearias
// ---------------------------------------------------------------------
function validarBarbearia(dados, idAtual = null) {
    const nome = normalizar(dados.nome);
    if (listar("barbearias").some((b) => b.id !== idAtual && normalizar(b.nome) === nome)) {
        throw new ErroValidacao("Já existe uma barbearia com este nome.", "nome");
    }
    const doc = apenasDigitos(dados.documento);
    if (doc && listar("barbearias").some((b) => b.id !== idAtual && apenasDigitos(b.documento) === doc)) {
        throw new ErroValidacao("Este CNPJ já está cadastrado.", "documento");
    }
    const donoAtual = idAtual ? proprietarioDa(idAtual) : null;
    const email = normalizar(dados.proprietarioEmail);
    if (listar("usuarios").some((u) => u.id !== donoAtual?.id && normalizar(u.email) === email)) {
        throw new ErroValidacao("Este e-mail já pertence a outro usuário.", "proprietarioEmail");
    }
}

export function cadastrarBarbearia(dados) {
    validarBarbearia(dados);
    const p = plano(dados.planoId);
    if (!p || p.arquivado) throw new ErroValidacao("Selecione um plano disponível.", "planoId");

    const emTeste = dados.status === "teste";
    const b = inserir("barbearias", {
        nome: dados.nome.trim(), razaoSocial: dados.razaoSocial?.trim() ?? "", documento: dados.documento?.trim() ?? "",
        email: dados.email.trim().toLowerCase(), telefone: dados.telefone.trim(),
        cidade: dados.cidade.trim(), estado: dados.estado, endereco: dados.endereco?.trim() ?? "",
        status: emTeste ? "teste" : "ativa", observacoes: dados.observacoes?.trim() ?? "",
        atividade: { agendamentosPorMes: [] }
    });

    const dono = inserir("usuarios", {
        nome: dados.proprietarioNome.trim(), email: dados.proprietarioEmail.trim().toLowerCase(),
        telefone: dados.proprietarioTelefone?.trim() ?? "", tipo: "proprietario", barbeariaId: b.id,
        status: "ativo", ultimoAcesso: null
    });

    const periodicidade = emTeste ? "mensal" : dados.periodicidade;
    const a = inserir("assinaturas", {
        barbeariaId: b.id, planoId: p.id, periodicidade, valor: valorDoPlano(p, periodicidade),
        status: emTeste ? "teste" : "ativa",
        inicio: new Date().toISOString(),
        proximoVencimento: emTeste
            ? new Date(Date.now() + p.diasTeste * 86400000).toISOString()
            : proximoVencimentoAPartirDeHoje(periodicidade),
        canceladaEm: null
    });

    registrarHistorico({ entidade: "barbearia", entidadeId: b.id, acao: "cadastro", descricao: `Barbearia cadastrada (${STATUS_BARBEARIA[b.status].rotulo.toLowerCase()}).` });
    registrarHistorico({ entidade: "assinatura", entidadeId: a.id, acao: "criada", descricao: `Assinatura criada no plano ${p.nome} (${periodicidade}).` });
    registrarHistorico({ entidade: "usuario", entidadeId: dono.id, acao: "cadastro", descricao: `Cadastrado como proprietário de ${b.nome}.` });
    return b;
}

export function editarBarbearia(id, dados) {
    const atual = barbearia(id);
    if (!atual) throw new Error("Barbearia não encontrada.");
    validarBarbearia(dados, id);

    const campos = {
        nome: dados.nome.trim(), razaoSocial: dados.razaoSocial?.trim() ?? "", documento: dados.documento?.trim() ?? "",
        email: dados.email.trim().toLowerCase(), telefone: dados.telefone.trim(),
        cidade: dados.cidade.trim(), estado: dados.estado, endereco: dados.endereco?.trim() ?? "",
        observacoes: dados.observacoes?.trim() ?? ""
    };
    const alterados = Object.keys(campos).filter((k) => String(atual[k] ?? "") !== String(campos[k]));
    atualizar("barbearias", id, campos);

    const dono = proprietarioDa(id);
    const camposDono = {
        nome: dados.proprietarioNome.trim(), email: dados.proprietarioEmail.trim().toLowerCase(),
        telefone: dados.proprietarioTelefone?.trim() ?? ""
    };
    let donoAlterado = false;
    if (dono) {
        donoAlterado = Object.keys(camposDono).some((k) => String(dono[k] ?? "") !== camposDono[k]);
        if (donoAlterado) atualizar("usuarios", dono.id, camposDono);
    }

    if (alterados.length || donoAlterado) {
        const partes = [...alterados.map((k) => ROTULOS_CAMPOS[k] ?? k), ...(donoAlterado ? ["dados do proprietário"] : [])];
        registrarHistorico({ entidade: "barbearia", entidadeId: id, acao: "edicao", descricao: `Cadastro atualizado: ${partes.join(", ")}.` });
    }
    return barbearia(id);
}

const ROTULOS_CAMPOS = {
    nome: "nome", razaoSocial: "razão social", documento: "CNPJ", email: "e-mail", telefone: "telefone",
    cidade: "cidade", estado: "UF", endereco: "endereço", observacoes: "observações"
};

export function suspenderBarbearia(id, motivo) {
    const b = barbearia(id);
    if (!b) throw new Error("Barbearia não encontrada.");
    if (b.status === "suspensa") throw new Error("A barbearia já está suspensa.");
    if (b.status === "cancelada") throw new Error("Barbearias canceladas não podem ser suspensas.");
    atualizar("barbearias", id, { status: "suspensa", statusAnterior: b.status });
    registrarHistorico({ entidade: "barbearia", entidadeId: id, acao: "suspensa", descricao: `Barbearia suspensa. Motivo: ${motivo}` });
}

export function reativarBarbearia(id) {
    const b = barbearia(id);
    if (!b) throw new Error("Barbearia não encontrada.");
    if (b.status !== "suspensa" && b.status !== "cancelada") throw new Error("A barbearia já está ativa.");
    const a = assinaturaDaBarbearia(id);
    if (a && (a.status === "cancelada" || a.status === "vencida")) reativarAssinatura(a.id, { silenciosoBarbearia: true });
    const novoStatus = b.status === "suspensa" && b.statusAnterior === "teste" && a?.status === "teste" ? "teste" : "ativa";
    atualizar("barbearias", id, { status: novoStatus, statusAnterior: null });
    registrarHistorico({ entidade: "barbearia", entidadeId: id, acao: "reativada", descricao: "Barbearia reativada." });
}

// ---------------------------------------------------------------------
// Assinaturas
// ---------------------------------------------------------------------
export function alterarPlano(assinaturaId, planoId, periodicidade) {
    const a = assinatura(assinaturaId);
    if (!a) throw new Error("Assinatura não encontrada.");
    const novo = plano(planoId);
    if (!novo || novo.arquivado) throw new ErroValidacao("Selecione um plano disponível.", "planoId");
    if (!PERIODICIDADES[periodicidade]) throw new ErroValidacao("Periodicidade inválida.", "periodicidade");
    if (a.status === "cancelada") throw new Error("Reative a assinatura antes de alterar o plano.");
    if (a.planoId === planoId && a.periodicidade === periodicidade) {
        throw new ErroValidacao("A assinatura já está neste plano e periodicidade.", "planoId");
    }
    // Descrição montada ANTES da atualização (o registro é alterado no lugar).
    const anterior = plano(a.planoId);
    const descricao = `Plano alterado de ${anterior?.nome ?? "—"} (${a.periodicidade}) para ${novo.nome} (${periodicidade}).`;
    atualizar("assinaturas", a.id, { planoId, periodicidade, valor: valorDoPlano(novo, periodicidade) });
    registrarHistorico({ entidade: "assinatura", entidadeId: a.id, acao: "plano_alterado", descricao, detalhes: { de: a.planoId, para: planoId } });
    registrarHistorico({ entidade: "barbearia", entidadeId: a.barbeariaId, acao: "plano_alterado", descricao });
}

export function cancelarAssinatura(id, motivo) {
    const a = assinatura(id);
    if (!a) throw new Error("Assinatura não encontrada.");
    if (a.status === "cancelada") throw new Error("A assinatura já está cancelada.");
    atualizar("assinaturas", id, { status: "cancelada", canceladaEm: new Date().toISOString() });
    atualizar("barbearias", a.barbeariaId, { status: "cancelada" });
    registrarHistorico({ entidade: "assinatura", entidadeId: id, acao: "cancelada", descricao: `Assinatura cancelada. Motivo: ${motivo}` });
    registrarHistorico({ entidade: "barbearia", entidadeId: a.barbeariaId, acao: "cancelada", descricao: "Barbearia cancelada junto com a assinatura." });
}

export function reativarAssinatura(id, { silenciosoBarbearia = false } = {}) {
    const a = assinatura(id);
    if (!a) throw new Error("Assinatura não encontrada.");
    if (a.status === "ativa" || a.status === "teste") throw new Error("A assinatura já está ativa.");
    atualizar("assinaturas", id, {
        status: "ativa", canceladaEm: null, proximoVencimento: proximoVencimentoAPartirDeHoje(a.periodicidade)
    });
    registrarHistorico({ entidade: "assinatura", entidadeId: id, acao: "reativada", descricao: "Assinatura reativada; novo ciclo iniciado hoje." });
    const b = barbearia(a.barbeariaId);
    if (!silenciosoBarbearia && b?.status === "cancelada") {
        atualizar("barbearias", b.id, { status: "ativa" });
        registrarHistorico({ entidade: "barbearia", entidadeId: b.id, acao: "reativada", descricao: "Barbearia reativada junto com a assinatura." });
    }
}

// ---------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------
export function salvarPlano(dados, id = null) {
    const nome = normalizar(dados.nome);
    if (listar("planos").some((p) => p.id !== id && normalizar(p.nome) === nome)) {
        throw new ErroValidacao("Já existe um plano com este nome.", "nome");
    }
    const campos = {
        nome: dados.nome.trim(), descricao: dados.descricao?.trim() ?? "",
        precoMensal: dados.precoMensal, precoAnual: dados.precoAnual, diasTeste: dados.diasTeste,
        limiteUsuarios: dados.limiteUsuarios, limiteAgendamentos: dados.limiteAgendamentos,
        funcionalidades: dados.funcionalidades
    };
    if (id) {
        atualizar("planos", id, campos);
        registrarHistorico({ entidade: "plano", entidadeId: id, acao: "edicao", descricao: `Plano ${campos.nome} atualizado. Assinaturas existentes mantêm o valor contratado.` });
        return plano(id);
    }
    const novo = inserir("planos", { ...campos, arquivado: false });
    registrarHistorico({ entidade: "plano", entidadeId: novo.id, acao: "criado", descricao: `Plano ${novo.nome} criado.` });
    return novo;
}

export function arquivarPlano(id) {
    const p = plano(id);
    if (!p) throw new Error("Plano não encontrado.");
    if (planosDisponiveis().length <= 1) throw new Error("Mantenha pelo menos um plano disponível.");
    atualizar("planos", id, { arquivado: true });
    registrarHistorico({ entidade: "plano", entidadeId: id, acao: "arquivado", descricao: `Plano ${p.nome} arquivado.` });
}

export function restaurarPlano(id) {
    const p = plano(id);
    if (!p) throw new Error("Plano não encontrado.");
    atualizar("planos", id, { arquivado: false });
    registrarHistorico({ entidade: "plano", entidadeId: id, acao: "restaurado", descricao: `Plano ${p.nome} restaurado.` });
}

export function assinaturasDoPlano(planoId) {
    return listar("assinaturas").filter((a) => a.planoId === planoId && a.status !== "cancelada").length;
}

// ---------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------
export function suspenderUsuario(id, motivo) {
    const u = usuario(id);
    if (!u) throw new Error("Usuário não encontrado.");
    if (u.status === "suspenso") throw new Error("O usuário já está suspenso.");
    atualizar("usuarios", id, { status: "suspenso" });
    registrarHistorico({ entidade: "usuario", entidadeId: id, acao: "suspenso", descricao: `Acesso suspenso. Motivo: ${motivo}` });
}

export function reativarUsuario(id) {
    const u = usuario(id);
    if (!u) throw new Error("Usuário não encontrado.");
    if (u.status === "ativo") throw new Error("O usuário já está ativo.");
    atualizar("usuarios", id, { status: "ativo" });
    registrarHistorico({ entidade: "usuario", entidadeId: id, acao: "reativado", descricao: "Acesso reativado." });
}

// ---------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------
export function intervaloDoPeriodo(chave, agora = new Date()) {
    const inicioMes = (deslocamento) => new Date(agora.getFullYear(), agora.getMonth() - deslocamento, 1);
    const inicio = {
        mes: inicioMes(0), "3m": inicioMes(2), "6m": inicioMes(5), "12m": inicioMes(11),
        ano: new Date(agora.getFullYear(), 0, 1), tudo: null
    }[chave] ?? null;
    return { inicio, fim: agora };
}

export function filtrarTransacoes({ periodo = "12m", status = "", busca = "" } = {}) {
    const { inicio, fim } = intervaloDoPeriodo(periodo);
    const termo = normalizar(busca);
    return listar("transacoes").filter((t) => {
        const data = new Date(t.vencimento);
        if (inicio && data < inicio) return false;
        if (data > fim) return false;
        if (status && t.status !== status) return false;
        if (termo && !normalizar(barbearia(t.barbeariaId)?.nome).includes(termo)) return false;
        return true;
    });
}

export function despesasDoPeriodo(periodo) {
    const { inicio, fim } = intervaloDoPeriodo(periodo);
    return listar("despesas").filter((d) => {
        const data = new Date(d.data);
        return (!inicio || data >= inicio) && data <= fim;
    });
}

export function resumoFinanceiro(lista, listaDespesas) {
    const soma = (arr, campo) => arr.reduce((s, x) => s + x[campo], 0);
    const pagas = lista.filter((t) => t.status === "pago");
    const pendentes = lista.filter((t) => t.status === "pendente");
    const atrasadas = lista.filter((t) => t.status === "atrasado");
    const bruto = soma(pagas, "valorBruto");
    const taxas = soma(pagas, "taxa");
    const devido = bruto + soma(pendentes, "valorBruto") + soma(atrasadas, "valorBruto");
    const mrr = calcularMrr();
    return {
        receitaBruta: bruto,
        taxas,
        receitaLiquida: bruto - taxas,
        mrr,
        arr: mrr * 12,
        recebidos: { quantidade: pagas.length, valor: bruto },
        pendentes: { quantidade: pendentes.length + atrasadas.length, valor: soma(pendentes, "valorBruto") + soma(atrasadas, "valorBruto") },
        inadimplencia: devido > 0 ? soma(atrasadas, "valorBruto") / devido : 0,
        ticketMedio: pagas.length ? bruto / pagas.length : 0,
        despesas: soma(listaDespesas, "valor")
    };
}

export function mesesDoPeriodo(periodo, agora = new Date()) {
    let { inicio } = intervaloDoPeriodo(periodo, agora);
    if (!inicio) {
        const datas = listar("transacoes").map((t) => t.vencimento).sort();
        inicio = datas.length ? new Date(datas[0]) : new Date(agora.getFullYear(), agora.getMonth(), 1);
        inicio = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    }
    const meses = [];
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    while (cursor <= agora && meses.length < 36) {
        meses.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return meses;
}

export function serieMensal(meses, registros, campoData, campoValor) {
    const totais = Object.fromEntries(meses.map((m) => [m, 0]));
    registros.forEach((r) => {
        const chave = r[campoData].slice(0, 7);
        if (chave in totais) totais[chave] += r[campoValor];
    });
    return meses.map((m) => ({ mes: m, valor: totais[m] }));
}
