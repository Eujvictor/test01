// =====================================================================
// REGISTRO DOS 20 MÓDULOS DO BARBER CONTROL
// "disponivel: true" somente quando o módulo estiver implementado e
// integrado. Os demais abrem uma página que informa a fase planejada,
// sem exibir dados.
// =====================================================================

export const GRUPOS = [
    { id: "gestao", titulo: "Gestão empresarial" },
    { id: "operacao", titulo: "Operação" },
    { id: "infra", titulo: "Segurança e infraestrutura" },
    { id: "desenvolvimento", titulo: "Desenvolvimento" },
    { id: "inteligencia", titulo: "Inteligência" }
];

export const MODULOS = [
    {
        id: "dashboard", numero: 1, titulo: "Visão geral", icone: "layout-dashboard", grupo: "gestao", fase: 2,
        disponivel: true, caminho: "./dashboard/index.js",
        planejado: ["Gráficos de crescimento", "Gráficos financeiros", "Empresas por plano", "Alertas importantes", "Filtros por período", "Atalhos administrativos"]
    },
    {
        id: "barbearias", numero: 2, titulo: "Barbearias", icone: "store", grupo: "gestao", fase: 2,
        disponivel: true, demo: true, real: true, caminho: "./barbearias/index.js",
        planejado: ["Cadastro de empresas", "Listagem, pesquisa e filtros", "Perfil individual", "Dados do proprietário e contatos", "Plano contratado", "Suspender e reativar", "Alterar plano", "Liberar funcionalidades", "Histórico de atividades"]
    },
    {
        id: "assinaturas", numero: 3, titulo: "Assinaturas e planos", icone: "badge-check", grupo: "gestao", fase: 2,
        disponivel: true, demo: true, real: true, caminho: "./assinaturas/index.js",
        planejado: ["Cadastro e arquivamento de planos", "Preços mensais e anuais", "Períodos de teste", "Limites de uso", "Assinaturas via Mercado Pago", "Renovações e cancelamentos", "Cupons e descontos", "Histórico de alterações"]
    },
    {
        id: "financeiro", numero: 4, titulo: "Financeiro", icone: "wallet", grupo: "gestao", fase: 2,
        disponivel: true, demo: true, real: true, caminho: "./financeiro/index.js",
        planejado: ["Receita bruta e líquida", "MRR e ARR", "Pagamentos Mercado Pago", "Pendências e inadimplência", "Taxas do gateway", "Despesas e fluxo de caixa", "Ticket médio", "Exportação de relatórios"]
    },
    {
        id: "usuarios", numero: 5, titulo: "Usuários", icone: "users", grupo: "gestao", fase: 2,
        disponivel: true, demo: true, real: true, caminho: "./usuarios/index.js",
        planejado: ["Proprietários, barbeiros e funcionários", "Clientes", "Empresa vinculada", "Último acesso", "Suspensão e reativação", "Histórico de acesso"]
    },
    {
        id: "atividade", numero: 6, titulo: "Agendamentos e atividade", icone: "calendar-clock", grupo: "operacao", fase: 3,
        disponivel: true, demo: true, real: true, caminho: "./atividade/index.js",
        planejado: ["Agendamentos diários, semanais e mensais", "Cancelamentos", "Serviços mais utilizados", "Empresas mais ativas e inativas", "Horários de pico", "Identificação de falhas"]
    },
    {
        id: "suporte", numero: 7, titulo: "Suporte", icone: "life-buoy", grupo: "operacao", fase: 3,
        disponivel: true, demo: true, caminho: "./suporte/index.js",
        planejado: ["Central de chamados", "Protocolo, categoria e prioridade", "Anexos e respostas", "Observações internas", "Tempo de resolução", "Suporte assistido com autorização"]
    },
    {
        id: "notificacoes", numero: 8, titulo: "Notificações", icone: "bell", grupo: "operacao", fase: 3,
        disponivel: true, demo: true, caminho: "./notificacoes/index.js",
        planejado: ["Comunicados e avisos", "Segmentação por plano", "Avisos de manutenção", "Modelos de mensagens", "Histórico e status de entrega"]
    },
    {
        id: "marketing", numero: 9, titulo: "Marketing e relacionamento", icone: "megaphone", grupo: "operacao", fase: 3,
        disponivel: true, demo: true, caminho: "./marketing/index.js",
        planejado: ["Campanhas e promoções", "Programa de indicação", "Pesquisas de satisfação", "Campanhas de reativação", "Indicadores de conversão"]
    },
    {
        id: "seguranca", numero: 10, titulo: "Segurança", icone: "shield", grupo: "infra", fase: 4,
        disponivel: true, demo: true, caminho: "./seguranca/index.js",
        planejado: ["Monitoramento de logins", "Tentativas suspeitas", "Histórico de autenticação", "Verificação de políticas RLS", "Incidentes e alertas", "Operações críticas"]
    },
    {
        id: "monitoramento", numero: 11, titulo: "Monitoramento técnico", icone: "activity", grupo: "infra", fase: 4,
        disponivel: true, demo: true, caminho: "./monitoramento/index.js",
        planejado: ["Disponibilidade e latência", "Erros e requisições", "Consumo de banco e armazenamento", "Integrações e APIs", "Alertas de infraestrutura"]
    },
    {
        id: "backups", numero: 12, titulo: "Backups e recuperação", icone: "database-backup", grupo: "infra", fase: 4,
        disponivel: true, demo: true, caminho: "./backups/index.js",
        planejado: ["Histórico de backups", "Retenção e armazenamento externo", "Verificação de integridade", "Testes de restauração", "Indicadores de RPO e RTO"]
    },
    {
        id: "atualizacoes", numero: 13, titulo: "Atualizações e versões", icone: "git-branch", grupo: "desenvolvimento", fase: 5,
        disponivel: true, demo: true, caminho: "./atualizacoes/index.js",
        planejado: ["Cadastro de versões", "Distribuição gradual", "Seleção de empresas", "Interrupção e rollback", "Integração com GitHub"]
    },
    {
        id: "funcionalidades", numero: 14, titulo: "Funcionalidades", icone: "toggle-right", grupo: "desenvolvimento", fase: 5,
        disponivel: true, demo: true, caminho: "./funcionalidades/index.js",
        planejado: ["Catálogo de módulos", "Associação com planos", "Liberação e bloqueio individual", "Acesso temporário", "Feature flags e dependências"]
    },
    {
        id: "historico", numero: 15, titulo: "Histórico de alterações", icone: "history", grupo: "desenvolvimento", fase: 5,
        disponivel: true, demo: true, caminho: "./historico/index.js",
        planejado: ["Mudanças no banco", "Funcionalidades e correções", "Referências de commits", "Empresas afetadas", "Filtros e exportação"]
    },
    {
        id: "roadmap", numero: 16, titulo: "Roadmap e solicitações", icone: "map", grupo: "desenvolvimento", fase: 5,
        disponivel: true, demo: true, caminho: "./roadmap/index.js",
        planejado: ["Ideias e sugestões", "Priorização e votação", "Estimativas", "Histórico de decisões"]
    },
    {
        id: "relatorios", numero: 17, titulo: "Relatórios e métricas", icone: "file-chart-column", grupo: "inteligencia", fase: 6,
        disponivel: true, demo: true, caminho: "./relatorios/index.js",
        planejado: ["Relatórios empresariais e financeiros", "Retenção e cancelamentos", "Comparativos", "Exportação PDF, Excel e CSV"]
    },
    {
        id: "inteligencia", numero: 18, titulo: "Inteligência de negócio", icone: "sparkles", grupo: "inteligencia", fase: 6,
        disponivel: true, demo: true, caminho: "./inteligencia/index.js",
        planejado: ["Crescimento e churn", "Rentabilidade", "Uso dos módulos", "Previsões com base no histórico", "Assistente inteligente"]
    },
    {
        id: "configuracoes", numero: 19, titulo: "Configurações gerais", icone: "settings", grupo: "inteligencia", fase: 6,
        disponivel: true, demo: true, caminho: "./configuracoes/index.js",
        planejado: ["Identidade da plataforma", "Regras de cobrança", "Integrações (Mercado Pago)", "Comunicação", "Histórico de alterações"]
    },
    {
        id: "auditoria", numero: 20, titulo: "Auditoria e acessos", icone: "scroll-text", grupo: "inteligencia", fase: 6,
        disponivel: true, demo: true, real: true, caminho: "./auditoria/index.js",
        planejado: ["Histórico de login e sessões", "Operações administrativas", "Acessos suspeitos e IP", "Retenção", "Exportação de auditoria"]
    }
];

export function obterModulo(id) {
    return MODULOS.find((m) => m.id === id) ?? null;
}
