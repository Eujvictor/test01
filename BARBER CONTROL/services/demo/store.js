// =====================================================================
// PERSISTÊNCIA LOCAL DOS DADOS DEMONSTRATIVOS (localStorage)
// Uma única chave versionada guarda todas as coleções relacionadas:
//   planos · barbearias · assinaturas · transacoes · usuarios · despesas · historico
// Se o navegador bloquear o armazenamento, os dados ficam só em memória
// e a interface avisa (persistenciaAtiva() === false).
// =====================================================================
import { gerarDadosIniciais, VERSAO_DADOS } from "./seed.js";
import { gerarDadosOperacao } from "./seed-operacao.js";
import { gerarDadosInfra } from "./seed-infra.js";
import { gerarDadosEvolucao } from "./seed-evolucao.js";

const CHAVE = "barber-control:demo:v1";

const PREFIXOS = {
    planos: "pl", barbearias: "bb", assinaturas: "as", transacoes: "tx", usuarios: "us", despesas: "dp", historico: "hi",
    chamados: "ch", comunicados: "cm", cupons: "cp", campanhas: "ca", indicacoes: "in", pesquisas: "ps",
    eventosAuth: "ev", sessoesAdmin: "se", incidentesSeg: "is", incidentesTec: "it", permissoes: "pm",
    verificacoes: "vf", servicos: "sv", backups: "bk", recuperacoes: "rc", alertas: "al",
    funcionalidades: "fn", flags: "fl", liberacoes: "lb", versoes: "vs", rollbacks: "rb", mudancas: "md", ideias: "id"
};

// Objetos únicos (configurações) guardados fora das coleções.
export function obterConfig(nome) {
    return banco()[nome];
}

export function salvarConfig(nome, valores) {
    banco()[nome] = { ...banco()[nome], ...valores, atualizadoEm: new Date().toISOString() };
    gravar();
    return banco()[nome];
}

// Acrescenta as coleções da Fase 3 (operação) sem tocar nos dados existentes.
// Também serve de migração para quem já tinha dados da Fase 2 salvos.
function completarOperacao(dados) {
    if (dados.agendamentos) return false;
    const { historicoOperacao, ...operacao } = gerarDadosOperacao(dados);
    Object.assign(dados, operacao);
    dados.historico = [...historicoOperacao, ...dados.historico].sort((a, b) => b.data.localeCompare(a.data));
    return true;
}

// Acrescenta as coleções da Fase 4 (segurança, monitoramento, backups e alertas).
function completarInfra(dados) {
    if (dados.alertas) return false;
    const { historicoInfra, sequenciasInfra, ...infra } = gerarDadosInfra(dados);
    Object.assign(dados, infra);
    dados.sequencias = { ...(dados.sequencias ?? {}), ...sequenciasInfra };
    dados.historico = [...historicoInfra, ...dados.historico].sort((a, b) => b.data.localeCompare(a.data));
    return true;
}

// Acrescenta as coleções da Fase 5 (versões, funcionalidades, mudanças, roadmap).
// O catálogo de funcionalidades passa a ser a fonte única usada pelos planos.
function completarEvolucao(dados) {
    if (dados.versoes) return false;
    const { historicoEvolucao, sequenciasEvolucao, planosAtualizados, ...evolucao } = gerarDadosEvolucao(dados);
    Object.assign(dados, evolucao);
    dados.planos = planosAtualizados;
    dados.sequencias = { ...(dados.sequencias ?? {}), ...sequenciasEvolucao };
    dados.historico = [...historicoEvolucao, ...dados.historico].sort((a, b) => b.data.localeCompare(a.data));
    return true;
}

function completarTudo(dados) {
    const operacao = completarOperacao(dados);
    const infra = completarInfra(dados);
    const evolucao = completarEvolucao(dados);
    return operacao || infra || evolucao;
}

function dadosNovos() {
    const dados = gerarDadosIniciais();
    completarTudo(dados);
    return dados;
}

let cache = null;
let persistente = true;

function lerArmazenamento() {
    try {
        const bruto = window.localStorage.getItem(CHAVE);
        if (!bruto) return null;
        const dados = JSON.parse(bruto);
        return dados?.versao === VERSAO_DADOS ? dados : null;
    } catch {
        return null;
    }
}

function gravar() {
    try {
        window.localStorage.setItem(CHAVE, JSON.stringify(cache));
        persistente = true;
    } catch (erro) {
        persistente = false;
        console.warn("Persistência local indisponível; os dados ficam apenas nesta aba.", erro);
    }
}

function banco() {
    if (!cache) {
        cache = lerArmazenamento();
        if (!cache) {
            cache = dadosNovos();
            gravar();
        } else if (completarTudo(cache)) {
            gravar();
        }
        geracao++;
    }
    return cache;
}

// Muda sempre que o conjunto de dados é recarregado ou restaurado
// (usado para invalidar caches derivados, como a lista de agendamentos).
let geracao = 0;
export function geracaoDados() {
    banco();
    return geracao;
}

export function persistenciaAtiva() {
    banco();
    return persistente;
}

export function restaurarDadosIniciais() {
    cache = dadosNovos();
    geracao++;
    gravar();
}

export function proximaSequencia(nome) {
    const dados = banco();
    dados.sequencias ??= {};
    dados.sequencias[nome] = (dados.sequencias[nome] ?? 0) + 1;
    gravar();
    return dados.sequencias[nome];
}

export function salvar() {
    gravar();
}

export function listar(colecao) {
    return banco()[colecao];
}

export function obter(colecao, id) {
    return banco()[colecao].find((r) => r.id === id) ?? null;
}

export function novoId(colecao) {
    return `${PREFIXOS[colecao] ?? "id"}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function inserir(colecao, registro) {
    const agora = new Date().toISOString();
    const novo = { id: novoId(colecao), criadoEm: agora, atualizadoEm: agora, ...registro };
    banco()[colecao].push(novo);
    gravar();
    return novo;
}

export function atualizar(colecao, id, alteracoes) {
    const registro = obter(colecao, id);
    if (!registro) throw new Error("Registro não encontrado.");
    Object.assign(registro, alteracoes, { atualizadoEm: new Date().toISOString() });
    gravar();
    return registro;
}

export function registrarHistorico({ entidade, entidadeId, acao, descricao, detalhes = {} }) {
    banco().historico.unshift({
        id: novoId("historico"), entidade, entidadeId, acao, descricao, detalhes, data: new Date().toISOString()
    });
    gravar();
}

export function historicoDe(entidade, entidadeId) {
    return banco().historico
        .filter((h) => h.entidade === entidade && h.entidadeId === entidadeId)
        .sort((a, b) => b.data.localeCompare(a.data));
}

// Outra aba alterou os dados: recarrega na próxima leitura.
window.addEventListener("storage", (evento) => {
    if (evento.key === CHAVE) cache = null;
});
