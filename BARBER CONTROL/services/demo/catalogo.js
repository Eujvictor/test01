// =====================================================================
// Catálogos e rótulos compartilhados pelos módulos demonstrativos.
// "tom" mapeia para as classes de badge: sucesso | atencao | erro | ouro | neutro
// =====================================================================

export const FUNCIONALIDADES = [
    { id: "agenda_online", nome: "Agenda online" },
    { id: "painel_barbeiro", nome: "Painel do barbeiro" },
    { id: "lembretes_whatsapp", nome: "Lembretes por WhatsApp" },
    { id: "relatorios", nome: "Relatórios avançados" },
    { id: "site_personalizado", nome: "Site personalizado" },
    { id: "programa_fidelidade", nome: "Programa de fidelidade" },
    { id: "multi_unidade", nome: "Múltiplas unidades" },
    { id: "suporte_prioritario", nome: "Suporte prioritário" }
];

export const STATUS_BARBEARIA = {
    ativa: { rotulo: "Ativa", tom: "sucesso" },
    teste: { rotulo: "Em teste", tom: "atencao" },
    suspensa: { rotulo: "Suspensa", tom: "erro" },
    cancelada: { rotulo: "Cancelada", tom: "neutro" }
};

export const STATUS_ASSINATURA = {
    ativa: { rotulo: "Ativa", tom: "sucesso" },
    teste: { rotulo: "Em teste", tom: "atencao" },
    vencida: { rotulo: "Vencida", tom: "erro" },
    cancelada: { rotulo: "Cancelada", tom: "neutro" }
};

export const STATUS_TRANSACAO = {
    pago: { rotulo: "Pago", tom: "sucesso" },
    pendente: { rotulo: "Pendente", tom: "atencao" },
    atrasado: { rotulo: "Atrasado", tom: "erro" },
    estornado: { rotulo: "Estornado", tom: "neutro" }
};

export const STATUS_USUARIO = {
    ativo: { rotulo: "Ativo", tom: "sucesso" },
    suspenso: { rotulo: "Suspenso", tom: "erro" }
};

export const TIPOS_USUARIO = {
    proprietario: { rotulo: "Proprietário", plural: "Proprietários", icone: "crown" },
    barbeiro: { rotulo: "Barbeiro", plural: "Barbeiros", icone: "scissors" },
    funcionario: { rotulo: "Funcionário", plural: "Funcionários", icone: "id-card" },
    cliente: { rotulo: "Cliente", plural: "Clientes", icone: "user-round" }
};

export const PERIODICIDADES = {
    mensal: { rotulo: "Mensal", meses: 1 },
    anual: { rotulo: "Anual", meses: 12 }
};

export const METODOS_PAGAMENTO = {
    pix: { rotulo: "Pix", taxaPercentual: 0.0099, taxaFixa: 0 },
    cartao: { rotulo: "Cartão de crédito", taxaPercentual: 0.0399, taxaFixa: 0 },
    boleto: { rotulo: "Boleto", taxaPercentual: 0, taxaFixa: 3.49 }
};

export const PERIODOS = {
    mes: "Mês atual",
    "3m": "Últimos 3 meses",
    "6m": "Últimos 6 meses",
    "12m": "Últimos 12 meses",
    ano: "Ano atual",
    tudo: "Todo o período"
};

export const UFS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function opcoes(mapa) {
    return Object.entries(mapa).map(([valor, info]) => [valor, typeof info === "string" ? info : info.rotulo]);
}

// =====================================================================
// FASE 3 — Operação e relacionamento
// =====================================================================

export const SERVICOS = [
    { id: 0, nome: "Corte masculino", preco: 40, peso: 30 },
    { id: 1, nome: "Barba", preco: 30, peso: 14 },
    { id: 2, nome: "Corte + barba", preco: 65, peso: 22 },
    { id: 3, nome: "Degradê", preco: 45, peso: 14 },
    { id: 4, nome: "Pigmentação", preco: 50, peso: 5 },
    { id: 5, nome: "Sobrancelha", preco: 15, peso: 7 },
    { id: 6, nome: "Hidratação", preco: 35, peso: 5 },
    { id: 7, nome: "Platinado", preco: 120, peso: 3 }
];

export const STATUS_AGENDAMENTO = {
    realizado: { rotulo: "Realizado", tom: "sucesso" },
    pendente: { rotulo: "Pendente", tom: "atencao" },
    cancelado: { rotulo: "Cancelado", tom: "erro" }
};

export const PERIODOS_ATIVIDADE = {
    7: "Últimos 7 dias",
    30: "Últimos 30 dias",
    90: "Últimos 90 dias",
    180: "Últimos 180 dias"
};

export const CATEGORIAS_CHAMADO = {
    tecnico: { rotulo: "Problemas técnicos", icone: "bug" },
    agendamentos: { rotulo: "Agendamentos", icone: "calendar" },
    financeiro: { rotulo: "Financeiro", icone: "wallet" },
    assinaturas: { rotulo: "Assinaturas", icone: "badge-check" },
    acesso: { rotulo: "Acesso à conta", icone: "key-round" },
    duvidas: { rotulo: "Dúvidas", icone: "circle-help" },
    solicitacoes: { rotulo: "Solicitações", icone: "inbox" },
    outros: { rotulo: "Outros", icone: "ellipsis" }
};

export const PRIORIDADES = {
    baixa: { rotulo: "Baixa", tom: "neutro", peso: 0 },
    normal: { rotulo: "Normal", tom: "ouro", peso: 1 },
    alta: { rotulo: "Alta", tom: "atencao", peso: 2 },
    critica: { rotulo: "Crítica", tom: "erro", peso: 3 }
};

export const STATUS_CHAMADO = {
    aberto: { rotulo: "Aberto", tom: "ouro" },
    em_atendimento: { rotulo: "Em atendimento", tom: "atencao" },
    aguardando: { rotulo: "Aguardando resposta", tom: "neutro" },
    resolvido: { rotulo: "Resolvido", tom: "sucesso" },
    encerrado: { rotulo: "Encerrado", tom: "neutro" }
};

export const RESPONSAVEIS_SUPORTE = [
    ["proprietario", "Proprietário do SaaS"],
    ["suporte_n1", "Suporte nível 1 (demonstrativo)"],
    ["suporte_n2", "Suporte nível 2 (demonstrativo)"],
    ["financeiro", "Equipe financeira (demonstrativo)"]
];

export const STATUS_ASSISTIDO = {
    nao_solicitado: { rotulo: "Não solicitado", tom: "neutro" },
    solicitado: { rotulo: "Aguardando autorização", tom: "atencao" },
    autorizado: { rotulo: "Autorizado", tom: "sucesso" },
    negado: { rotulo: "Negado", tom: "erro" },
    encerrado: { rotulo: "Encerrado", tom: "neutro" }
};

export const CATEGORIAS_COMUNICADO = {
    atualizacao: "Atualização",
    manutencao: "Manutenção",
    seguranca: "Segurança",
    financeiro: "Financeiro",
    geral: "Comunicado geral",
    novidade: "Novidade",
    importante: "Aviso importante"
};

export const PRIORIDADES_COMUNICADO = {
    baixa: { rotulo: "Baixa", tom: "neutro" },
    normal: { rotulo: "Normal", tom: "ouro" },
    alta: { rotulo: "Alta", tom: "erro" }
};

export const STATUS_COMUNICADO = {
    rascunho: { rotulo: "Rascunho", tom: "neutro" },
    agendado: { rotulo: "Agendado", tom: "atencao" },
    publicado: { rotulo: "Publicado (demo)", tom: "sucesso" },
    arquivado: { rotulo: "Arquivado", tom: "neutro" }
};

export const TIPOS_CAMPANHA = {
    aquisicao: "Aquisição de novas barbearias",
    reativacao: "Reativação de barbearias inativas",
    novos_planos: "Divulgação de novos planos",
    upgrade: "Upgrade de planos",
    retencao: "Retenção",
    indicacoes: "Indicações"
};

export const STATUS_CAMPANHA = {
    rascunho: { rotulo: "Rascunho", tom: "neutro" },
    ativa: { rotulo: "Ativa", tom: "sucesso" },
    finalizada: { rotulo: "Finalizada", tom: "ouro" },
    arquivada: { rotulo: "Arquivada", tom: "neutro" }
};

export const STATUS_CUPOM = {
    ativo: { rotulo: "Ativo", tom: "sucesso" },
    agendado: { rotulo: "Agendado", tom: "atencao" },
    inativo: { rotulo: "Desativado", tom: "neutro" },
    expirado: { rotulo: "Expirado", tom: "erro" },
    esgotado: { rotulo: "Esgotado", tom: "erro" }
};

export const STATUS_INDICACAO = {
    pendente: { rotulo: "Pendente", tom: "atencao" },
    em_teste: { rotulo: "Em teste", tom: "ouro" },
    convertida: { rotulo: "Convertida", tom: "sucesso" },
    expirada: { rotulo: "Expirada", tom: "neutro" }
};

export const STATUS_PESQUISA = {
    rascunho: { rotulo: "Rascunho", tom: "neutro" },
    ativa: { rotulo: "Coletando respostas", tom: "sucesso" },
    encerrada: { rotulo: "Encerrada", tom: "ouro" }
};

export const TIPOS_PERGUNTA = {
    nps: "Nota de 0 a 10 (NPS)",
    escala: "Escala de 1 a 5",
    texto: "Resposta aberta"
};

export const NIVEIS_ATIVIDADE = {
    alta: "Alta (≥ 120 agendamentos em 30 dias)",
    media: "Média (40 a 119)",
    baixa: "Baixa (1 a 39)",
    sem: "Sem atividade"
};

export const FAIXAS_CADASTRO = {
    novo: "Até 30 dias",
    recente: "31 a 180 dias",
    consolidado: "181 a 365 dias",
    antigo: "Mais de 1 ano"
};

export const NIVEIS_UTILIZACAO = {
    alta: "Alta (≥ 70% do limite)",
    media: "Média (30% a 69%)",
    baixa: "Baixa (< 30%)",
    ilimitado: "Plano ilimitado"
};

// =====================================================================
// FASE 4 — Segurança, monitoramento e backups
// =====================================================================

export const GRAVIDADES = {
    baixa: { rotulo: "Baixa", tom: "neutro", peso: 0 },
    media: { rotulo: "Média", tom: "ouro", peso: 1 },
    alta: { rotulo: "Alta", tom: "atencao", peso: 2 },
    critica: { rotulo: "Crítica", tom: "erro", peso: 3 }
};

export const STATUS_INCIDENTE = {
    novo: { rotulo: "Novo", tom: "ouro" },
    investigacao: { rotulo: "Em investigação", tom: "atencao" },
    tratamento: { rotulo: "Em tratamento", tom: "atencao" },
    resolvido: { rotulo: "Resolvido", tom: "sucesso" },
    encerrado: { rotulo: "Encerrado", tom: "neutro" }
};

export const STATUS_ALERTA = {
    novo: { rotulo: "Novo", tom: "erro" },
    reconhecido: { rotulo: "Reconhecido", tom: "ouro" },
    investigacao: { rotulo: "Em investigação", tom: "atencao" },
    resolvido: { rotulo: "Resolvido", tom: "sucesso" },
    encerrado: { rotulo: "Encerrado", tom: "neutro" }
};

export const CATEGORIAS_ALERTA = {
    seguranca: "Segurança",
    monitoramento: "Monitoramento",
    backup: "Backups"
};

export const TIPOS_ALERTA = {
    login_suspeito: { rotulo: "Tentativa suspeita de login", categoria: "seguranca", acao: "Verificar a origem das tentativas e confirmar o bloqueio temporário." },
    incidente_seguranca: { rotulo: "Incidente de segurança", categoria: "seguranca", acao: "Acompanhar o incidente e registrar as providências." },
    servico_indisponivel: { rotulo: "Serviço indisponível", categoria: "monitoramento", acao: "Verificar o serviço afetado e comunicar as barbearias se necessário." },
    aumento_erros: { rotulo: "Aumento de erros", categoria: "monitoramento", acao: "Analisar os erros recentes e identificar a causa." },
    latencia_elevada: { rotulo: "Latência elevada", categoria: "monitoramento", acao: "Investigar consultas lentas e a carga do serviço." },
    falha_backup: { rotulo: "Falha de backup", categoria: "backup", acao: "Reexecutar o backup e verificar o destino de armazenamento." },
    integridade_pendente: { rotulo: "Integridade não verificada", categoria: "backup", acao: "Executar a verificação de integridade do backup." },
    restauracao_pendente: { rotulo: "Restauração pendente", categoria: "backup", acao: "Analisar e concluir ou cancelar a solicitação de restauração." },
    outro: { rotulo: "Outro", categoria: "seguranca", acao: "Avaliar e registrar providências." }
};

export const TIPOS_EVENTO_AUTH = {
    login_ok: { rotulo: "Login realizado", icone: "log-in" },
    login_recusado: { rotulo: "Login recusado", icone: "circle-x" },
    logout: { rotulo: "Logout", icone: "log-out" },
    suspeita: { rotulo: "Tentativa suspeita", icone: "shield-alert" },
    sessao_encerrada: { rotulo: "Sessão encerrada", icone: "timer-off" },
    credenciais: { rotulo: "Alteração de credenciais", icone: "key-round" }
};

export const RESULTADOS_EVENTO = {
    sucesso: { rotulo: "Sucesso", tom: "sucesso" },
    falha: { rotulo: "Falha", tom: "atencao" },
    bloqueado: { rotulo: "Bloqueado", tom: "erro" }
};

export const STATUS_EVENTO = {
    normal: { rotulo: "Normal", tom: "neutro" },
    analise: { rotulo: "Em análise", tom: "atencao" },
    revisado: { rotulo: "Revisado", tom: "sucesso" }
};

export const STATUS_SESSAO = {
    ativa: { rotulo: "Ativa", tom: "sucesso" },
    encerrada: { rotulo: "Encerrada", tom: "neutro" },
    expirada: { rotulo: "Expirada", tom: "neutro" }
};

export const PERFIS_ADMIN = {
    proprietario: { rotulo: "Proprietário do SaaS", bloqueado: true },
    suporte: { rotulo: "Analista de suporte (demonstrativo)" },
    financeiro: { rotulo: "Analista financeiro (demonstrativo)" },
    marketing: { rotulo: "Analista de marketing (demonstrativo)" }
};

export const RECURSOS_ADMIN = {
    barbearias: "Barbearias", assinaturas: "Assinaturas e planos", financeiro: "Financeiro", usuarios: "Usuários",
    suporte: "Suporte", notificacoes: "Notificações", marketing: "Marketing", seguranca: "Segurança",
    monitoramento: "Monitoramento", backups: "Backups"
};

export const ACOES_PERMISSAO = {
    visualizar: "Visualização",
    criar: "Criação",
    editar: "Edição",
    excluir: "Exclusão",
    critico: "Operações críticas"
};

export const STATUS_VERIFICACAO = {
    nao_verificado: { rotulo: "Não verificado", tom: "neutro" },
    pendente_integracao: { rotulo: "Pendente de integração", tom: "atencao" },
    demonstracao: { rotulo: "Demonstração", tom: "ouro" },
    verificado_real: { rotulo: "Verificado em ambiente real", tom: "sucesso" }
};

export const STATUS_SERVICO = {
    operacional: { rotulo: "Operacional", tom: "sucesso" },
    atencao: { rotulo: "Atenção", tom: "atencao" },
    degradado: { rotulo: "Degradado", tom: "atencao" },
    indisponivel: { rotulo: "Indisponível", tom: "erro" },
    nao_monitorado: { rotulo: "Não monitorado", tom: "neutro" }
};

export const CATEGORIAS_INCIDENTE_SEG = {
    forca_bruta: "Força bruta / login",
    acesso_indevido: "Acesso indevido",
    credenciais: "Credenciais",
    isolamento: "Isolamento entre empresas",
    phishing: "Phishing / engenharia social",
    configuracao: "Configuração insegura"
};

export const CATEGORIAS_INCIDENTE_TEC = {
    disponibilidade: "Disponibilidade",
    desempenho: "Desempenho",
    erro_aplicacao: "Erro de aplicação",
    banco: "Banco de dados",
    armazenamento: "Armazenamento",
    integracao: "Integração"
};

export const TIPOS_BACKUP = {
    completo: "Completo",
    incremental: "Incremental",
    banco: "Banco de dados",
    arquivos: "Arquivos",
    configuracoes: "Configurações"
};

export const STATUS_BACKUP = {
    concluido: { rotulo: "Concluído", tom: "sucesso" },
    andamento: { rotulo: "Em andamento", tom: "atencao" },
    falhou: { rotulo: "Falhou", tom: "erro" },
    pendente: { rotulo: "Pendente", tom: "ouro" },
    arquivado: { rotulo: "Arquivado", tom: "neutro" }
};

export const INTEGRIDADE_BACKUP = {
    verificado_demo: { rotulo: "Verificada (demonstração)", tom: "ouro" },
    nao_verificado: { rotulo: "Não verificada", tom: "atencao" },
    falhou: { rotulo: "Falhou", tom: "erro" }
};

export const ORIGENS_BACKUP = {
    postgres: "Banco PostgreSQL (Supabase) · demo",
    storage: "Storage de imagens (Supabase) · demo",
    configuracoes: "Configurações do Barber Control · demo",
    plataforma: "Plataforma completa · demo"
};

export const AMBIENTES_RECUPERACAO = {
    homologacao: "Homologação (cópia de testes)",
    isolado: "Ambiente isolado para validação",
    producao: "Produção"
};

export const STATUS_RECUPERACAO = {
    solicitada: { rotulo: "Solicitada", tom: "ouro" },
    em_simulacao: { rotulo: "Em simulação", tom: "atencao" },
    simulada: { rotulo: "Simulação concluída", tom: "sucesso" },
    cancelada: { rotulo: "Cancelada", tom: "neutro" }
};

export const ETAPAS_RECUPERACAO = [
    "Validar a solicitação e o backup escolhido",
    "Verificar a integridade do backup",
    "Preparar o ambiente de destino",
    "Restaurar os dados no destino",
    "Validar a aplicação após a restauração",
    "Registrar o resultado e encerrar"
];

export const FREQUENCIAS_BACKUP = {
    horaria: "A cada hora",
    seis_horas: "A cada 6 horas",
    diaria: "Diária",
    semanal: "Semanal"
};

// =====================================================================
// FASE 5 — Evolução do SaaS (versões, funcionalidades, mudanças, roadmap)
// =====================================================================

// Funcionalidades acrescentadas ao catálogo na Fase 5 (as 8 originais continuam).
// "base: true" = incluída em todos os planos padrão (Basic, Professional, Premium).
export const FUNCIONALIDADES_FASE5 = [
    { id: "painel_admin", nome: "Painel administrativo", categoria: "plataforma", base: true, descricao: "Painel do proprietário para gerenciar a barbearia." },
    { id: "gestao_barbeiros", nome: "Gestão de barbeiros", categoria: "gestao", base: true, descricao: "Cadastro de profissionais, agenda e comissões." },
    { id: "gestao_clientes", nome: "Gestão de clientes", categoria: "gestao", base: true, descricao: "Cadastro e histórico de clientes." },
    { id: "gestao_servicos", nome: "Gestão de serviços", categoria: "gestao", base: true, descricao: "Catálogo de serviços, preços e durações." },
    { id: "controle_horarios", nome: "Controle de horários", categoria: "agendamento", base: true, descricao: "Horário de funcionamento, bloqueios e feriados." },
    { id: "notificacoes", nome: "Central de notificações", categoria: "comunicacao", base: true, descricao: "Avisos da plataforma dentro do painel." },
    { id: "controle_financeiro", nome: "Controle financeiro", categoria: "financeiro", planos: ["pl_professional", "pl_premium"], descricao: "Caixa, recebimentos e comissões." },
    { id: "configuracoes_personalizadas", nome: "Configurações personalizadas", categoria: "personalizacao", planos: ["pl_premium"], descricao: "Regras avançadas de agenda e personalização." }
];

export const CATEGORIAS_FUNCIONALIDADE = {
    agendamento: "Agendamento",
    gestao: "Gestão",
    financeiro: "Financeiro",
    comunicacao: "Comunicação",
    personalizacao: "Personalização",
    plataforma: "Plataforma"
};

export const STATUS_FUNCIONALIDADE = {
    ativa: { rotulo: "Disponível", tom: "sucesso" },
    beta: { rotulo: "Beta", tom: "ouro" },
    planejada: { rotulo: "Planejada", tom: "neutro" },
    descontinuada: { rotulo: "Descontinuada", tom: "erro" }
};

export const CATEGORIAS_VERSAO = {
    funcionalidade: "Nova funcionalidade",
    melhoria: "Melhoria",
    correcao: "Correção de erro",
    seguranca: "Segurança",
    desempenho: "Desempenho",
    tecnica: "Atualização técnica"
};

export const STATUS_VERSAO = {
    planejada: { rotulo: "Planejada", tom: "neutro" },
    desenvolvimento: { rotulo: "Em desenvolvimento", tom: "ouro" },
    testes: { rotulo: "Em testes", tom: "atencao" },
    aprovada: { rotulo: "Aprovada", tom: "ouro" },
    publicada: { rotulo: "Publicada (demo)", tom: "sucesso" },
    cancelada: { rotulo: "Cancelada", tom: "erro" }
};

export const MODOS_DISTRIBUICAO = {
    nenhum: "Não iniciada",
    grupo_testes: "Grupo de testes",
    gradual: "Distribuição gradual",
    geral: "Liberação geral"
};

export const STATUS_DISTRIBUICAO = {
    nao_iniciada: { rotulo: "Não iniciada", tom: "neutro" },
    em_andamento: { rotulo: "Em andamento", tom: "atencao" },
    interrompida: { rotulo: "Interrompida", tom: "erro" },
    concluida: { rotulo: "Concluída", tom: "sucesso" }
};

export const STATUS_ROLLBACK = {
    solicitado: { rotulo: "Solicitado", tom: "ouro" },
    em_analise: { rotulo: "Em análise", tom: "atencao" },
    aprovado: { rotulo: "Aprovado (simulação)", tom: "ouro" },
    recusado: { rotulo: "Recusado", tom: "neutro" },
    concluido: { rotulo: "Simulação concluída", tom: "sucesso" }
};

export const TIPOS_LIBERACAO = {
    liberar: { rotulo: "Liberação", tom: "sucesso" },
    temporario: { rotulo: "Acesso temporário", tom: "ouro" },
    bloquear: { rotulo: "Bloqueio", tom: "erro" }
};

export const CATEGORIAS_MUDANCA = {
    desenvolvimento: "Desenvolvimento",
    banco: "Banco de dados",
    interface: "Interface",
    seguranca: "Segurança",
    funcionalidades: "Funcionalidades",
    configuracoes: "Configurações",
    administracao: "Administração",
    infraestrutura: "Infraestrutura"
};

export const NATUREZAS_MUDANCA = {
    correcao: "Correção",
    nova_funcionalidade: "Funcionalidade adicionada",
    melhoria: "Melhoria",
    administrativa: "Alteração administrativa",
    tecnica: "Alteração técnica"
};

export const STATUS_MUDANCA = {
    planejada: { rotulo: "Planejada", tom: "neutro" },
    em_andamento: { rotulo: "Em andamento", tom: "atencao" },
    concluida: { rotulo: "Concluída", tom: "sucesso" },
    revertida: { rotulo: "Revertida", tom: "erro" }
};

export const COLUNAS_KANBAN = {
    recebida: "Recebidas",
    analise: "Em análise",
    aprovada: "Aprovadas",
    planejada: "Planejadas",
    desenvolvimento: "Em desenvolvimento",
    testes: "Em testes",
    concluida: "Concluídas"
};

export const STATUS_IDEIA = {
    recebida: { rotulo: "Recebida", tom: "neutro" },
    analise: { rotulo: "Em análise", tom: "atencao" },
    aprovada: { rotulo: "Aprovada", tom: "ouro" },
    planejada: { rotulo: "Planejada", tom: "ouro" },
    desenvolvimento: { rotulo: "Em desenvolvimento", tom: "atencao" },
    testes: { rotulo: "Em testes", tom: "atencao" },
    concluida: { rotulo: "Concluída", tom: "sucesso" },
    cancelada: { rotulo: "Cancelada", tom: "erro" }
};

export const ORIGENS_IDEIA = {
    interna: "Ideia interna",
    barbearia: "Solicitação de barbearia",
    usuario: "Sugestão de usuário",
    tecnica: "Necessidade técnica",
    seguranca: "Segurança",
    operacional: "Melhoria operacional"
};

export const CATEGORIAS_IDEIA = {
    funcionalidade: "Nova funcionalidade",
    melhoria: "Melhoria",
    integracao: "Integração",
    seguranca: "Segurança",
    desempenho: "Desempenho",
    operacional: "Operacional"
};

export const PRIORIDADES_IDEIA = {
    baixa: { rotulo: "Baixa", tom: "neutro" },
    media: { rotulo: "Média", tom: "ouro" },
    alta: { rotulo: "Alta", tom: "atencao" },
    critica: { rotulo: "Crítica", tom: "erro" }
};

export const ESCALA_1_5 = [["1", "1 · muito baixo"], ["2", "2 · baixo"], ["3", "3 · médio"], ["4", "4 · alto"], ["5", "5 · muito alto"]];
