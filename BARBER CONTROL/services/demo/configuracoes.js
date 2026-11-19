// =====================================================================
// CONFIGURAÇÕES GERAIS (módulo 19) — modo demonstrativo
// Valores guardados no localStorage. Cada alteração gera um registro
// no histórico (entidade "configuracao") com valor anterior, novo valor,
// data e responsável — o módulo 20 (auditoria) lê esses registros.
// Nenhuma credencial é solicitada ou armazenada: integrações aparecem
// como "Pendente de integração".
// =====================================================================
import { obterConfig, salvarConfig, registrarHistorico, listar } from "./store.js";
import { planosDisponiveis, ErroValidacao } from "./saas.js";

export const RESPONSAVEL_DEMO = "Proprietário do SaaS (demonstrativo)";
export const CHAVE_APARENCIA = "barber-control:aparencia";

export const CATEGORIAS_CONFIG = {
    identidade: { rotulo: "Identidade da plataforma", icone: "id-card", descricao: "Nome, marca e informações institucionais." },
    comercial: { rotulo: "Configurações comerciais", icone: "handshake", descricao: "Regras demonstrativas de teste, renovação, cancelamento e cobrança." },
    acesso: { rotulo: "Configurações de acesso", icone: "key-round", descricao: "Sessão, tentativas de login, senha e autenticação." },
    seguranca: { rotulo: "Segurança", icone: "shield", descricao: "Acesso administrativo, alertas, retenção de registros e auditoria." },
    comunicacao: { rotulo: "Comunicação", icone: "mail", descricao: "Notificações, modelos de comunicados e categorias de avisos." },
    integracoes: { rotulo: "Integrações", icone: "plug", descricao: "Serviços externos previstos. Nenhum está conectado." },
    aparencia: { rotulo: "Aparência", icone: "palette", descricao: "Tema, densidade e preferências de exibição deste painel." },
    tecnico: { rotulo: "Configurações técnicas", icone: "cpu", descricao: "Versão, ambiente, registros e monitoramento planejado." }
};

const CATEGORIAS_AVISO = [["manutencao", "Manutenção"], ["novidade", "Novidades"], ["cobranca", "Cobrança"], ["seguranca", "Segurança"], ["geral", "Geral"]];
const CATEGORIAS_AUDITORIA = [["acesso", "Acessos (login, logout, sessões)"], ["operacao", "Operações administrativas"], ["configuracao", "Alterações de configuração"], ["plano", "Planos e assinaturas"], ["funcionalidade", "Funcionalidades e flags"]];
const ALERTAS_SEGURANCA = [["login_recusado", "Logins recusados em sequência"], ["novo_dispositivo", "Acesso de novo dispositivo"], ["alteracao_critica", "Alteração crítica de configuração"], ["exportacao", "Exportação de dados"]];

// ---------------------------------------------------------------------
// Campos por categoria (usados pelo formulário e pelo histórico)
// tipos: texto | textarea | numero | select | booleano | checkboxes | logo
// ---------------------------------------------------------------------
export function camposDe(categoria) {
    const C = {
        identidade: [
            { nome: "nomePlataforma", rotulo: "Nome da plataforma", tipo: "texto", obrigatorio: true, maxlength: 40 },
            { nome: "nomeComercial", rotulo: "Nome comercial", tipo: "texto", obrigatorio: true, maxlength: 60 },
            { nome: "logotipo", rotulo: "Logotipo demonstrativo", tipo: "logo", opcoes: [["navalha", "Navalha"], ["tesoura", "Tesoura"], ["coroa", "Coroa"], ["monograma", "Monograma"]], ajuda: "Marcas ilustrativas; o envio de imagem será feito com armazenamento real." },
            { nome: "descricao", rotulo: "Descrição", tipo: "textarea", maxlength: 240 },
            { nome: "emailContato", rotulo: "E-mail institucional", tipo: "email", maxlength: 120, ajuda: "Exibido em comunicados. Não envia mensagens." },
            { nome: "site", rotulo: "Site", tipo: "url", maxlength: 120 },
            { nome: "informacoes", rotulo: "Informações institucionais", tipo: "textarea", maxlength: 400 }
        ],
        comercial: [
            { nome: "planosOfertados", rotulo: "Planos ofertados na contratação", tipo: "checkboxes", obrigatorio: true, opcoes: planosDisponiveis().map((p) => [p.id, p.nome]), ajuda: "Preços e limites são editados no módulo 03." },
            { nome: "diasTeste", rotulo: "Período de teste padrão (dias)", tipo: "numero", min: 0, max: 60, obrigatorio: true },
            { nome: "renovacaoAutomatica", rotulo: "Renovação automática", tipo: "booleano" },
            { nome: "avisoRenovacaoDias", rotulo: "Aviso antes da renovação (dias)", tipo: "numero", min: 0, max: 30, obrigatorio: true },
            { nome: "politicaCancelamento", rotulo: "Política de cancelamento", tipo: "select", opcoes: [["fim_ciclo", "Acesso até o fim do ciclo pago"], ["imediato", "Encerramento imediato"]] },
            { nome: "toleranciaInadimplenciaDias", rotulo: "Tolerância antes da suspensão (dias)", tipo: "numero", min: 0, max: 60, obrigatorio: true },
            { nome: "multaAtrasoPercentual", rotulo: "Multa por atraso (%)", tipo: "numero", min: 0, max: 2, passo: 0.1, obrigatorio: true, ajuda: "Demonstrativo. O limite legal usual é 2%." },
            { nome: "metodosPagamento", rotulo: "Métodos de pagamento aceitos", tipo: "checkboxes", obrigatorio: true, opcoes: [["pix", "Pix"], ["cartao", "Cartão de crédito"], ["boleto", "Boleto"]] }
        ],
        acesso: [
            { nome: "sessaoHoras", rotulo: "Duração máxima da sessão (horas)", tipo: "numero", min: 1, max: 24, obrigatorio: true },
            { nome: "inatividadeMinutos", rotulo: "Expiração por inatividade (minutos)", tipo: "numero", min: 5, max: 240, obrigatorio: true },
            { nome: "tentativasLogin", rotulo: "Tentativas de login antes do bloqueio", tipo: "numero", min: 3, max: 10, obrigatorio: true },
            { nome: "bloqueioMinutos", rotulo: "Duração do bloqueio (minutos)", tipo: "numero", min: 5, max: 1440, obrigatorio: true },
            { nome: "senhaMinimo", rotulo: "Tamanho mínimo da senha", tipo: "numero", min: 8, max: 64, obrigatorio: true },
            { nome: "senhaRegras", rotulo: "A senha deve conter", tipo: "checkboxes", opcoes: [["maiuscula", "Letra maiúscula"], ["numero", "Número"], ["simbolo", "Símbolo"]] },
            { nome: "senhaExpiracaoDias", rotulo: "Troca obrigatória de senha (dias, 0 = nunca)", tipo: "numero", min: 0, max: 365, obrigatorio: true },
            { nome: "mfa", rotulo: "Autenticação em dois fatores (MFA)", tipo: "select", opcoes: [["obrigatorio_admin", "Obrigatório para administradores (planejado)"], ["obrigatorio_todos", "Obrigatório para todos (planejado)"], ["opcional", "Opcional (planejado)"]], ajuda: "Configuração planejada: será aplicada pelo backend na integração real." }
        ],
        seguranca: [
            { nome: "acessoAdministrativo", rotulo: "Política de acesso administrativo", tipo: "select", opcoes: [["somente_proprietario", "Somente o proprietário do SaaS"], ["equipe_aprovada", "Equipe com aprovação do proprietário"]] },
            { nome: "encerrarSessoesAoTrocarSenha", rotulo: "Encerrar outras sessões ao trocar a senha", tipo: "booleano" },
            { nome: "alertas", rotulo: "Alertas de segurança", tipo: "checkboxes", opcoes: ALERTAS_SEGURANCA },
            { nome: "retencaoAcessosDias", rotulo: "Retenção de eventos de acesso (dias)", tipo: "numero", min: 30, max: 1825, obrigatorio: true },
            { nome: "retencaoOperacoesDias", rotulo: "Retenção de operações administrativas (dias)", tipo: "numero", min: 90, max: 3650, obrigatorio: true },
            { nome: "categoriasAuditadas", rotulo: "Categorias registradas na auditoria", tipo: "checkboxes", obrigatorio: true, opcoes: CATEGORIAS_AUDITORIA },
            { nome: "politicaPreservacao", rotulo: "Política de preservação", tipo: "select", opcoes: [["arquivar", "Arquivar após o prazo (não excluir)"], ["anonimizar", "Anonimizar dados pessoais após o prazo"]], ajuda: "Na versão demonstrativa nenhum registro é excluído." }
        ],
        comunicacao: [
            { nome: "remetente", rotulo: "Nome do remetente", tipo: "texto", obrigatorio: true, maxlength: 60 },
            { nome: "notificacoes", rotulo: "Notificar o proprietário sobre", tipo: "checkboxes", opcoes: [["nova_barbearia", "Nova barbearia"], ["cancelamento", "Cancelamento"], ["chamado_critico", "Chamado crítico"], ["incidente", "Incidente técnico"], ["backup_falhou", "Falha de backup"]] },
            { nome: "canalPreferido", rotulo: "Canal preferido", tipo: "select", opcoes: [["painel", "Somente no painel"], ["email", "E-mail (pendente de integração)"]] },
            { nome: "categoriasAvisos", rotulo: "Categorias de avisos ativas", tipo: "checkboxes", obrigatorio: true, opcoes: CATEGORIAS_AVISO },
            { nome: "modeloManutencao", rotulo: "Modelo · aviso de manutenção", tipo: "textarea", maxlength: 500 },
            { nome: "modeloNovidade", rotulo: "Modelo · novidade", tipo: "textarea", maxlength: 500 },
            { nome: "modeloCobranca", rotulo: "Modelo · lembrete de cobrança", tipo: "textarea", maxlength: 500 }
        ],
        aparencia: [
            { nome: "tema", rotulo: "Tema", tipo: "select", opcoes: [["escuro", "Escuro (identidade oficial)"], ["contraste", "Escuro com alto contraste"]] },
            { nome: "densidade", rotulo: "Densidade da interface", tipo: "select", opcoes: [["confortavel", "Confortável"], ["compacta", "Compacta"]] },
            { nome: "itensPorPagina", rotulo: "Linhas por página nas tabelas", tipo: "select", opcoes: [["10", "10"], ["25", "25"], ["50", "50"]] },
            { nome: "reduzirAnimacoes", rotulo: "Reduzir animações", tipo: "booleano" },
            { nome: "paginaInicial", rotulo: "Página ao abrir o painel", tipo: "select", opcoes: [["dashboard", "Visão geral"], ["relatorios", "Relatórios e métricas"], ["inteligencia", "Inteligência de negócio"], ["auditoria", "Auditoria e acessos"]] }
        ],
        tecnico: [
            { nome: "nivelRegistro", rotulo: "Nível de registro (logs)", tipo: "select", opcoes: [["erros", "Somente erros"], ["avisos", "Erros e avisos"], ["detalhado", "Detalhado"]], ajuda: "Preferência planejada para o backend." },
            { nome: "intervaloVerificacaoMin", rotulo: "Intervalo de verificação dos serviços (min)", tipo: "numero", min: 1, max: 60, obrigatorio: true, ajuda: "Parâmetro planejado; o monitoramento atual é simulado." },
            { nome: "limiteLatenciaMs", rotulo: "Alerta de latência acima de (ms)", tipo: "numero", min: 100, max: 10000, obrigatorio: true },
            { nome: "limiteErroPercentual", rotulo: "Alerta de taxa de erro acima de (%)", tipo: "numero", min: 0.1, max: 50, passo: 0.1, obrigatorio: true }
        ]
    };
    return C[categoria] ?? [];
}

export const PADROES = {
    identidade: {
        nomePlataforma: "BARBER CONTROL", nomeComercial: "Barber — sistema para barbearias", logotipo: "navalha",
        descricao: "Central administrativa do SaaS Barber.", emailContato: "", site: "",
        informacoes: "Plataforma de gestão e agendamento para barbearias. Ambiente demonstrativo."
    },
    comercial: {
        planosOfertados: ["pl_basic", "pl_professional", "pl_premium"], diasTeste: 14, renovacaoAutomatica: true, avisoRenovacaoDias: 5,
        politicaCancelamento: "fim_ciclo", toleranciaInadimplenciaDias: 10, multaAtrasoPercentual: 2, metodosPagamento: ["pix", "cartao", "boleto"]
    },
    acesso: {
        sessaoHoras: 8, inatividadeMinutos: 30, tentativasLogin: 5, bloqueioMinutos: 15, senhaMinimo: 12,
        senhaRegras: ["maiuscula", "numero", "simbolo"], senhaExpiracaoDias: 0, mfa: "obrigatorio_admin"
    },
    seguranca: {
        acessoAdministrativo: "somente_proprietario", encerrarSessoesAoTrocarSenha: true, alertas: ["login_recusado", "novo_dispositivo", "alteracao_critica"],
        retencaoAcessosDias: 180, retencaoOperacoesDias: 730, categoriasAuditadas: CATEGORIAS_AUDITORIA.map(([v]) => v), politicaPreservacao: "arquivar"
    },
    comunicacao: {
        remetente: "Equipe Barber", notificacoes: ["cancelamento", "chamado_critico", "incidente", "backup_falhou"], canalPreferido: "painel",
        categoriasAvisos: CATEGORIAS_AVISO.map(([v]) => v),
        modeloManutencao: "Olá, {barbearia}! Faremos uma manutenção programada em {data}, das {inicio} às {fim}. O agendamento online pode ficar indisponível nesse intervalo.",
        modeloNovidade: "Olá, {barbearia}! Lançamos {novidade}. Acesse o painel para conhecer.",
        modeloCobranca: "Olá, {barbearia}! A mensalidade com vencimento em {vencimento} está em aberto. Regularize para evitar a suspensão."
    },
    aparencia: { tema: "escuro", densidade: "confortavel", itensPorPagina: "10", reduzirAnimacoes: false, paginaInicial: "dashboard" },
    tecnico: { nivelRegistro: "avisos", intervaloVerificacaoMin: 5, limiteLatenciaMs: 800, limiteErroPercentual: 2 }
};

// Configurações que pedem confirmação explícita antes de salvar.
export const CRITICAS = {
    acesso: ["tentativasLogin", "senhaMinimo", "mfa"],
    seguranca: ["acessoAdministrativo", "retencaoAcessosDias", "retencaoOperacoesDias", "categoriasAuditadas"]
};

// ---------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------
const copia = (v) => JSON.parse(JSON.stringify(v));

export function configuracoes() {
    const salvo = obterConfig("configuracoesGerais") ?? {};
    const resultado = {};
    Object.keys(PADROES).forEach((cat) => { resultado[cat] = { ...copia(PADROES[cat]), ...(salvo[cat] ?? {}) }; });
    return resultado;
}

export const configuracao = (categoria) => configuracoes()[categoria];

// ---------------------------------------------------------------------
// Validação, comparação e gravação
// ---------------------------------------------------------------------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizarValor(campo, valor) {
    if (campo.tipo === "numero") return valor === "" || valor === null || valor === undefined ? null : Number(valor);
    if (campo.tipo === "booleano") return Boolean(valor);
    if (campo.tipo === "checkboxes") return Array.isArray(valor) ? [...valor] : [];
    return String(valor ?? "").trim();
}

function validarCampo(campo, v) {
    const vazio = v === null || v === "" || (Array.isArray(v) && !v.length);
    if (campo.obrigatorio && vazio) return campo.tipo === "checkboxes" ? "Selecione pelo menos uma opção." : "Campo obrigatório.";
    if (vazio) return null;
    if (campo.tipo === "numero") {
        if (Number.isNaN(v)) return "Informe um número válido.";
        if (campo.min !== undefined && v < campo.min) return `O valor mínimo é ${String(campo.min).replace(".", ",")}.`;
        if (campo.max !== undefined && v > campo.max) return `O valor máximo é ${String(campo.max).replace(".", ",")}.`;
    }
    if (campo.maxlength && String(v).length > campo.maxlength) return `Máximo de ${campo.maxlength} caracteres.`;
    if (campo.tipo === "email" && !EMAIL.test(v)) return "Informe um e-mail válido.";
    if (campo.tipo === "url" && !/^https:\/\/[^\s]+\.[^\s]+$/i.test(v)) return "Use um endereço completo começando com https://";
    if (campo.opcoes && campo.tipo === "select" && !campo.opcoes.some(([o]) => o === v)) return "Opção inválida.";
    if (campo.opcoes && campo.tipo === "checkboxes" && v.some((x) => !campo.opcoes.some(([o]) => o === x))) return "Opção inválida.";
    return null;
}

const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function descreverValor(campo, v) {
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return "(vazio)";
    if (campo.tipo === "booleano") return v ? "Ativado" : "Desativado";
    if (campo.opcoes) {
        const mapa = Object.fromEntries(campo.opcoes);
        return Array.isArray(v) ? v.map((x) => mapa[x] ?? x).join(", ") : (mapa[v] ?? v);
    }
    const texto = String(v);
    return texto.length > 80 ? `${texto.slice(0, 77)}…` : texto;
}

// Retorna as diferenças entre o valor atual e o proposto (sem gravar).
export function diferencas(categoria, valores) {
    const atual = configuracao(categoria);
    return camposDe(categoria)
        .filter((c) => c.nome in valores)
        .map((c) => ({ campo: c, anterior: atual[c.nome], novo: normalizarValor(c, valores[c.nome]) }))
        .filter((d) => !iguais(d.anterior, d.novo));
}

function gravarCategoria(categoria, novos) {
    const salvo = obterConfig("configuracoesGerais") ?? {};
    const tudo = { ...salvo, [categoria]: novos };
    delete tudo.atualizadoEm;
    salvarConfig("configuracoesGerais", tudo);
    if (categoria === "aparencia") gravarAparenciaLocal(novos);
}

export function salvarCategoria(categoria, valores, responsavel = RESPONSAVEL_DEMO) {
    if (!CATEGORIAS_CONFIG[categoria] || categoria === "integracoes") throw new Error("Categoria inválida.");
    const campos = camposDe(categoria).filter((c) => c.nome in valores);
    campos.forEach((c) => {
        const erro = validarCampo(c, normalizarValor(c, valores[c.nome]));
        if (erro) throw new ErroValidacao(erro, c.nome);
    });
    if (categoria === "acesso" && Number(valores.bloqueioMinutos ?? configuracao("acesso").bloqueioMinutos) < 5) {
        throw new ErroValidacao("O bloqueio precisa durar pelo menos 5 minutos.", "bloqueioMinutos");
    }
    const lista = diferencas(categoria, valores);
    if (!lista.length) return [];
    const novos = { ...configuracao(categoria) };
    lista.forEach((d) => { novos[d.campo.nome] = d.novo; });
    gravarCategoria(categoria, novos);
    lista.forEach((d) => registrarHistorico({
        entidade: "configuracao", entidadeId: `${categoria}.${d.campo.nome}`, acao: "alterada",
        descricao: `${CATEGORIAS_CONFIG[categoria].rotulo} › ${d.campo.rotulo}: ${descreverValor(d.campo, d.anterior)} → ${descreverValor(d.campo, d.novo)}.`,
        detalhes: { categoria, campo: d.campo.nome, rotulo: d.campo.rotulo, anterior: d.anterior, novo: d.novo, responsavel }
    }));
    return lista;
}

export function restaurarCategoria(categoria, responsavel = RESPONSAVEL_DEMO) {
    if (!PADROES[categoria]) throw new Error("Categoria inválida.");
    const lista = diferencas(categoria, PADROES[categoria]);
    if (!lista.length) return [];
    gravarCategoria(categoria, copia(PADROES[categoria]));
    lista.forEach((d) => registrarHistorico({
        entidade: "configuracao", entidadeId: `${categoria}.${d.campo.nome}`, acao: "restaurada",
        descricao: `${CATEGORIAS_CONFIG[categoria].rotulo} › ${d.campo.rotulo} restaurado ao padrão: ${descreverValor(d.campo, d.anterior)} → ${descreverValor(d.campo, d.novo)}.`,
        detalhes: { categoria, campo: d.campo.nome, rotulo: d.campo.rotulo, anterior: d.anterior, novo: d.novo, responsavel, restauracao: true }
    }));
    return lista;
}

export function historicoConfiguracoes(categoria = "") {
    return listar("historico")
        .filter((h) => h.entidade === "configuracao" && (!categoria || h.detalhes?.categoria === categoria))
        .sort((a, b) => b.data.localeCompare(a.data));
}

// ---------------------------------------------------------------------
// Aparência: cópia em chave própria, lida na abertura do painel
// (js/app.js) sem precisar carregar os dados demonstrativos.
// ---------------------------------------------------------------------
function gravarAparenciaLocal(valores) {
    try {
        window.localStorage.setItem(CHAVE_APARENCIA, JSON.stringify(valores));
    } catch {
        /* armazenamento bloqueado: vale só nesta aba */
    }
    aplicarAparencia(valores);
}

export function aplicarAparencia(valores) {
    const raiz = document.documentElement;
    raiz.dataset.tema = valores.tema === "contraste" ? "contraste" : "escuro";
    raiz.dataset.densidade = valores.densidade === "compacta" ? "compacta" : "confortavel";
    raiz.dataset.animacoes = valores.reduzirAnimacoes ? "reduzidas" : "normais";
}

// ---------------------------------------------------------------------
// Integrações previstas (somente leitura; nenhuma credencial)
// ---------------------------------------------------------------------
export const INTEGRACOES = [
    {
        id: "supabase", nome: "Supabase", tipo: "Banco de dados, autenticação e funções", icone: "database",
        descricao: "Banco PostgreSQL com RLS, autenticação com MFA e Edge Functions do Barber Control.",
        configuracao: ["Aplicar as migrações do schema control (Fase 1)", "Expor apenas o schema control_api", "Publicar as Edge Functions control-login e control-admin", "Trocar os serviços demonstrativos pelas chamadas reais"],
        modulos: "Todos os módulos"
    },
    {
        id: "github", nome: "GitHub", tipo: "Versionamento e implantação", icone: "github",
        descricao: "Vincular versões (módulo 13) e alterações (módulo 15) a commits, branches e pull requests reais.",
        configuracao: ["Criar um GitHub App com permissão somente de leitura", "Guardar o token apenas no backend (Edge Function)", "Mapear repositórios e branches"],
        modulos: "Módulos 13 e 15"
    },
    {
        id: "email", nome: "Serviço de e-mail", tipo: "Envio de mensagens", icone: "mail",
        descricao: "Enviar comunicados, avisos de cobrança e alertas por e-mail.",
        configuracao: ["Escolher o provedor (SMTP ou API transacional)", "Validar o domínio remetente (SPF, DKIM, DMARC)", "Guardar a chave apenas no backend"],
        modulos: "Módulos 08, 09 e 19"
    },
    {
        id: "pagamento", nome: "Gateway de pagamento (Mercado Pago)", tipo: "Cobrança recorrente", icone: "credit-card",
        descricao: "Assinaturas recorrentes, cobranças, webhooks de pagamento e conciliação financeira.",
        configuracao: ["Criar a aplicação no Mercado Pago", "Configurar o webhook em uma Edge Function", "Guardar o access token apenas no backend", "Conciliar transações com o módulo 04"],
        modulos: "Módulos 03 e 04"
    },
    {
        id: "monitoramento", nome: "Monitoramento", tipo: "Disponibilidade e erros", icone: "activity",
        descricao: "Coletar disponibilidade, latência e erros reais da plataforma.",
        configuracao: ["Escolher a ferramenta de monitoramento", "Instrumentar as Edge Functions", "Definir limites de alerta (ver Configurações técnicas)"],
        modulos: "Módulo 11"
    },
    {
        id: "armazenamento", nome: "Armazenamento externo", tipo: "Cópias de segurança e arquivos", icone: "hard-drive",
        descricao: "Guardar backups e anexos fora do provedor principal.",
        configuracao: ["Criar o bucket com criptografia e versionamento", "Configurar a política de retenção", "Testar a restauração periodicamente"],
        modulos: "Módulos 07 e 12"
    }
];

// Informações técnicas calculadas (somente leitura).
export function informacoesTecnicas() {
    let bytes = null;
    try {
        bytes = Object.keys(window.localStorage).filter((k) => k.startsWith("barber-control")).reduce((s, k) => s + (window.localStorage.getItem(k)?.length ?? 0) * 2, 0);
    } catch {
        bytes = null;
    }
    const colecoes = ["barbearias", "assinaturas", "transacoes", "usuarios", "chamados", "historico", "eventosAuth", "versoes", "ideias"];
    return {
        armazenamentoKb: bytes === null ? null : Math.round(bytes / 1024),
        registros: colecoes.map((c) => [c, listar(c)?.length ?? 0]),
        navegador: navigator.userAgent.replace(/\s*\(.*?\)\s*/, " ").slice(0, 120)
    };
}
