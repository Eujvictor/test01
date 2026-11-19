// =====================================================================
// DADOS DEMONSTRATIVOS DE SEGURANÇA, MONITORAMENTO E BACKUPS (Fase 4)
// Todos fictícios e derivados das barbearias, usuários e chamados já
// existentes. Endereços IP usam apenas as faixas reservadas para
// documentação (RFC 5737: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24).
// Nada aqui representa medição, sessão ou backup real.
// =====================================================================
import { criarAleatorio } from "./seed.js";
import { PERFIS_ADMIN, RECURSOS_ADMIN } from "./catalogo.js";

const DIA = 86400000;
const HORA = 3600000;

const CIDADES = ["São Paulo/SP", "Goiânia/GO", "Rio de Janeiro/RJ", "Belo Horizonte/MG", "Curitiba/PR", "Salvador/BA", "Recife/PE", "Brasília/DF"];
const DISPOSITIVOS = ["Chrome · Windows", "Safari · iPhone", "Chrome · Android", "Edge · Windows", "Safari · macOS"];

export function gerarDadosInfra(base, agora = new Date()) {
    const r = criarAleatorio(20261119);
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const escolher = (lista) => lista[Math.floor(r() * lista.length)];
    const ponderado = (pares) => {
        const total = pares.reduce((s, [, p]) => s + p, 0);
        let alvo = r() * total;
        for (const [v, p] of pares) { alvo -= p; if (alvo <= 0) return v; }
        return pares.at(-1)[0];
    };
    const iso = (d) => new Date(d).toISOString();
    const atras = (ms) => new Date(agora.getTime() - ms);
    const ipNormal = () => `198.51.100.${int(2, 250)}`;

    const historico = [];
    let seqHist = 1;
    const evento = (entidade, entidadeId, acao, descricao, data) => {
        historico.push({ id: `hi_inf_${String(seqHist++).padStart(5, "0")}`, entidade, entidadeId, acao, descricao, detalhes: {}, data: iso(data) });
    };

    const barbearias = base.barbearias;
    const ativas = barbearias.filter((b) => b.status !== "cancelada");
    const equipe = base.usuarios.filter((u) => u.tipo !== "cliente" && u.status === "ativo");

    // ---------- Eventos de autenticação (14 dias) ----------
    const eventosAuth = [];
    let seqEv = 1;
    const novoEvento = (dados) => {
        eventosAuth.push({ id: `EV-${String(seqEv++).padStart(6, "0")}`, status: "normal", ...dados });
    };
    for (let d = 13; d >= 0; d--) {
        const quantidade = int(18, 30);
        for (let k = 0; k < quantidade; k++) {
            const data = atras(d * DIA + int(0, 23) * HORA + int(0, 59) * 60000);
            if (data > agora) continue;
            const admin = r() < 0.12;
            const usuario = admin ? null : escolher(equipe);
            const tipo = ponderado([["login_ok", 55], ["logout", 25], ["login_recusado", 10], ["sessao_encerrada", 5], ["credenciais", 2]]);
            novoEvento({
                usuarioId: usuario?.id ?? null, usuarioNome: admin ? "Proprietário do SaaS" : usuario.nome,
                sistema: admin ? "Barber Control" : "Barber",
                tipo, data: iso(data),
                origem: { ip: ipNormal(), cidade: escolher(CIDADES), dispositivo: escolher(DISPOSITIVOS) },
                resultado: tipo === "login_recusado" ? "falha" : "sucesso"
            });
        }
    }
    // Sequência suspeita: várias falhas seguidas contra o mesmo proprietário.
    const alvoSuspeito = base.usuarios.find((u) => u.tipo === "proprietario" && u.barbeariaId === ativas[3]?.id) ?? equipe[0];
    const inicioAtaque = atras(5 * HORA);
    for (let k = 0; k < 8; k++) {
        novoEvento({
            usuarioId: alvoSuspeito.id, usuarioNome: alvoSuspeito.nome, sistema: "Barber", tipo: "login_recusado",
            data: iso(new Date(inicioAtaque.getTime() + k * 70000)),
            origem: { ip: "203.0.113.66", cidade: "Origem desconhecida", dispositivo: "Script automatizado" }, resultado: "falha", status: "analise"
        });
    }
    novoEvento({
        usuarioId: alvoSuspeito.id, usuarioNome: alvoSuspeito.nome, sistema: "Barber", tipo: "suspeita",
        data: iso(new Date(inicioAtaque.getTime() + 9 * 70000)),
        origem: { ip: "203.0.113.66", cidade: "Origem desconhecida", dispositivo: "Script automatizado" }, resultado: "bloqueado", status: "analise"
    });
    novoEvento({
        usuarioId: null, usuarioNome: "Proprietário do SaaS", sistema: "Barber Control", tipo: "suspeita", data: iso(atras(3 * DIA + 2 * HORA)),
        origem: { ip: "192.0.2.14", cidade: "Origem desconhecida", dispositivo: "Firefox · Linux" }, resultado: "bloqueado", status: "revisado"
    });
    eventosAuth.sort((a, b) => a.data.localeCompare(b.data));
    eventosAuth.forEach((e, i) => { e.id = `EV-${String(i + 1).padStart(6, "0")}`; });

    // ---------- Sessões administrativas (demonstrativas) ----------
    const sessoesAdmin = [
        ["ativa", 0.3, "Chrome · Windows", "Goiânia/GO"], ["ativa", 20, "Safari · iPhone", "Goiânia/GO"],
        ["encerrada", 30, "Chrome · Windows", "Goiânia/GO"], ["expirada", 52, "Edge · Windows", "São Paulo/SP"],
        ["encerrada", 75, "Safari · iPhone", "Goiânia/GO"], ["expirada", 120, "Chrome · Windows", "Goiânia/GO"]
    ].map(([status, horas, dispositivo, cidade], i) => ({
        id: `se_${String(i + 1).padStart(3, "0")}`, usuario: "Proprietário do SaaS", status, dispositivo,
        origem: { ip: ipNormal(), cidade }, inicio: iso(atras(horas * HORA + HORA)), ultimoAcesso: iso(atras(horas * HORA)),
        mfa: true
    }));

    // ---------- Incidentes de segurança ----------
    const incidentesSeg = [
        ["Tentativas repetidas de login", "forca_bruta", "alta", "investigacao", alvoSuspeito.barbeariaId, 0.2, "8 tentativas falharam em 10 minutos a partir do IP 203.0.113.66 contra a conta do proprietário."],
        ["Tentativa de acesso a dados de outra empresa", "isolamento", "critica", "tratamento", ativas[6]?.id, 2, "Simulação: requisição tentou ler agendamentos de outra barbearia. Cenário fictício para treinar o fluxo de resposta."],
        ["E-mail de phishing reportado", "phishing", "media", "novo", ativas[9]?.id, 1, "Um barbeiro recebeu e-mail fingindo ser o suporte Barber pedindo a senha."],
        ["Acesso fora do horário habitual", "acesso_indevido", "media", "resolvido", ativas[2]?.id, 9, "Login às 3h de dispositivo desconhecido. O proprietário confirmou que estava viajando."],
        ["Senha compartilhada entre barbeiros", "credenciais", "baixa", "encerrado", ativas[12]?.id, 20, "Dois barbeiros usavam a mesma conta. Contas individuais foram orientadas."],
        ["Configuração de CORS permissiva no ambiente de testes", "configuracao", "alta", "encerrado", null, 35, "Cenário fictício: origem curinga em ambiente de testes. Ajustado para lista de origens permitidas."]
    ].map(([titulo, categoria, gravidade, status, barbeariaId, diasAtras, descricao], i) => {
        const id = `is_${String(i + 1).padStart(3, "0")}`;
        const codigo = `INC-SEG-${String(i + 1).padStart(4, "0")}`;
        const abertoEm = atras(diasAtras * DIA);
        const providencias = status === "novo" ? [] : [{ texto: "Análise inicial realizada e responsável definido.", data: iso(new Date(abertoEm.getTime() + 2 * HORA)) }];
        if (["resolvido", "encerrado"].includes(status)) providencias.push({ texto: "Correção aplicada e cliente orientado.", data: iso(new Date(abertoEm.getTime() + 20 * HORA)) });
        evento("incidente_seg", id, "registrado", `Incidente ${codigo} registrado (${gravidade}).`, abertoEm);
        if (status !== "novo") evento("incidente_seg", id, "status", "Status alterado para Em investigação.", new Date(abertoEm.getTime() + HORA));
        if (["resolvido", "encerrado"].includes(status)) evento("incidente_seg", id, "status", `Status alterado para ${status === "resolvido" ? "Resolvido" : "Encerrado"}.`, new Date(abertoEm.getTime() + 22 * HORA));
        return {
            id, codigo, titulo, categoria, gravidade, status, barbeariaId: barbeariaId ?? null, descricao, providencias,
            responsavel: "Proprietário do SaaS", abertoEm: iso(abertoEm), atualizadoEm: iso(providencias.at(-1)?.data ?? abertoEm),
            encerradoEm: ["resolvido", "encerrado"].includes(status) ? iso(new Date(abertoEm.getTime() + 22 * HORA)) : null
        };
    });

    // ---------- Permissões administrativas (demonstrativas) ----------
    const padrao = {
        proprietario: () => ({ visualizar: true, criar: true, editar: true, excluir: true, critico: true }),
        suporte: (rec) => ({ visualizar: ["barbearias", "usuarios", "suporte", "notificacoes", "monitoramento"].includes(rec), criar: rec === "suporte", editar: rec === "suporte", excluir: false, critico: false }),
        financeiro: (rec) => ({ visualizar: ["barbearias", "assinaturas", "financeiro"].includes(rec), criar: rec === "financeiro", editar: ["financeiro", "assinaturas"].includes(rec), excluir: false, critico: false }),
        marketing: (rec) => ({ visualizar: ["barbearias", "marketing", "notificacoes"].includes(rec), criar: ["marketing", "notificacoes"].includes(rec), editar: ["marketing", "notificacoes"].includes(rec), excluir: false, critico: false })
    };
    const permissoes = [];
    Object.keys(PERFIS_ADMIN).forEach((perfil) => Object.keys(RECURSOS_ADMIN).forEach((recurso) => {
        permissoes.push({
            id: `pm_${perfil}_${recurso}`, perfil, recurso, acoes: padrao[perfil](recurso),
            status: perfil === "marketing" && recurso === "notificacoes" ? "revogado" : "ativo",
            atualizadoEm: iso(atras(int(5, 90) * DIA))
        });
    }));

    // ---------- Verificação de segurança (situação honesta do projeto) ----------
    const verificacoes = [
        ["autenticacao", "Autenticação", "pendente_integracao", "Login com senha e MFA (TOTP) implementados no código da Fase 1. Aguardando a implantação no Supabase para teste real."],
        ["sessoes", "Controle de sessões", "pendente_integracao", "Expiração por inatividade (30 min) e sessão separada do Barber implementadas no navegador. Sem teste em ambiente real."],
        ["apis", "Proteção de APIs", "pendente_integracao", "Edge Functions control-admin e control-login escritas (validação de token, MFA e administrador). Ainda não publicadas."],
        ["rls", "Políticas RLS", "pendente_integracao", "Migração com RLS e testes SQL (fase1_seguranca.sql) preparados. Ainda não executados no banco."],
        ["isolamento", "Isolamento entre empresas", "nao_verificado", "O Barber ainda é de empresa única. O isolamento depende da futura migração multi-tenant (barbearia_id + RLS por empresa)."],
        ["credenciais", "Proteção de credenciais", "nao_verificado", "Revisão do repositório: só a chave publishable aparece no navegador. Falta a verificação no ambiente publicado."],
        ["auditoria", "Auditoria", "pendente_integracao", "Tabela de auditoria imutável definida na migração. Aguardando implantação. Os módulos demonstrativos usam histórico local."]
    ].map(([id, nome, status, descricao]) => ({ id: `vf_${id}`, chave: id, nome, status, descricao, notas: [], atualizadoEm: iso(atras(DIA)) }));

    // ---------- Monitoramento: serviços e métricas (30 dias) ----------
    const servicos = [
        ["barber_app", "Aplicação BARBER", "operacional", 210, "Site de agendamento e painéis das barbearias."],
        ["control_app", "Aplicação BARBER CONTROL", "operacional", 160, "Este painel administrativo."],
        ["banco", "Banco de dados", "atencao", 95, "PostgreSQL (Supabase)."],
        ["api", "API", "operacional", 230, "PostgREST e funções RPC."],
        ["auth", "Autenticação", "operacional", 120, "Supabase Auth."],
        ["storage", "Armazenamento", "operacional", 140, "Supabase Storage (imagens do site)."],
        ["integracoes", "Integrações externas", "nao_monitorado", null, "Mercado Pago e outros. Nenhuma integração conectada."]
    ].map(([chave, nome, status, tempo, descricao]) => ({
        id: `sv_${chave}`, chave, nome, descricao, status, tempoRespostaMs: tempo,
        ultimaVerificacao: status === "nao_monitorado" ? null : iso(atras(int(1, 9) * 60000)),
        historico: status === "nao_monitorado" ? [] : Array.from({ length: 14 }, (_, i) => ({
            data: iso(atras((13 - i) * DIA)),
            disponibilidade: chave === "auth" && i === 9 ? 99.17 : chave === "banco" && i >= 12 ? 99.6 : 100 - r() * 0.04
        }))
    }));

    const metricas = { dias: [] };
    const totalAgendamentosDia = new Map();
    (base.agendamentos ?? []).forEach(([, , , dia]) => totalAgendamentosDia.set(dia, (totalAgendamentosDia.get(dia) ?? 0) + 1));
    const hojeNum = Math.floor(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / DIA);
    for (let d = 29; d >= 0; d--) {
        const ref = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - d);
        const ag = totalAgendamentosDia.get(hojeNum - d) ?? 0;
        const incidenteAuth = d === 4;
        const incidenteLento = d === 11 || d === 12;
        const incidenteBanco = d <= 1;
        metricas.dias.push({
            data: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`,
            disponibilidade: incidenteAuth ? 99.17 : incidenteBanco ? 99.82 : 99.95 + r() * 0.05,
            latenciaMs: Math.round((incidenteLento ? 620 : incidenteBanco ? 340 : 170) + r() * 60),
            requisicoes: Math.round(38000 + ag * 26 + r() * 4000),
            erros: Math.round((incidenteAuth ? 900 : incidenteLento ? 420 : 60) + r() * 40),
            armazenamentoMb: Math.round(820 + (29 - d) * 9.5 + r() * 4),
            bancoMb: Math.round(310 + (29 - d) * 2.4 + r() * 2)
        });
    }

    // ---------- Incidentes técnicos ----------
    const chamadosTecnicos = (base.chamados ?? []).filter((c) => c.categoria === "tecnico");
    const chamadoPorTitulo = (texto) => chamadosTecnicos.find((c) => c.titulo.includes(texto))?.id ?? null;
    const incidentesTec = [
        ["Instabilidade na autenticação", "disponibilidade", "alta", "auth", "encerrado", 4, "Falhas intermitentes no login por cerca de 12 minutos.", null],
        ["Lentidão ao carregar a agenda", "desempenho", "media", "api", "resolvido", 11.5, "Tempo de resposta acima de 600 ms nas consultas da agenda.", chamadoPorTitulo("Lentidão")],
        ["Erro ao salvar horário de funcionamento", "erro_aplicacao", "media", "barber_app", "resolvido", 16, "Erro 500 ao salvar o horário de sábado em algumas barbearias.", chamadoPorTitulo("horário de funcionamento")],
        ["Agenda em branco no celular", "erro_aplicacao", "alta", "barber_app", "investigacao", 2, "Relatos de agenda online em branco em navegadores móveis.", chamadoPorTitulo("celular")],
        ["Uso elevado de CPU no banco", "banco", "alta", "banco", "tratamento", 1, "CPU do banco acima de 85% nos horários de pico.", null],
        ["Armazenamento de imagens acima de 80%", "armazenamento", "baixa", "storage", "novo", 0.5, "O bucket de imagens se aproxima do limite do plano.", null]
    ].map(([titulo, categoria, gravidade, servicoChave, status, diasAtras, descricao, chamadoId], i) => {
        const id = `it_${String(i + 1).padStart(3, "0")}`;
        const codigo = `INC-TEC-${String(i + 1).padStart(4, "0")}`;
        const abertoEm = atras(diasAtras * DIA);
        const fim = ["resolvido", "encerrado"].includes(status) ? new Date(abertoEm.getTime() + int(1, 6) * HORA) : null;
        evento("incidente_tec", id, "registrado", `Incidente ${codigo} registrado no serviço ${servicoChave}.`, abertoEm);
        if (chamadoId) evento("incidente_tec", id, "chamado", "Chamado de suporte relacionado vinculado.", new Date(abertoEm.getTime() + HORA));
        if (fim) evento("incidente_tec", id, "status", `Status alterado para ${status === "resolvido" ? "Resolvido" : "Encerrado"}.`, fim);
        return {
            id, codigo, titulo, categoria, gravidade, status, servico: servicoChave, descricao, chamadoId,
            barbeariaId: chamadoId ? (base.chamados.find((c) => c.id === chamadoId)?.barbeariaId ?? null) : null,
            providencias: status === "novo" ? [] : [{ texto: "Equipe acionada e diagnóstico iniciado.", data: iso(new Date(abertoEm.getTime() + 30 * 60000)) }],
            responsavel: "Suporte nível 2 (demonstrativo)", abertoEm: iso(abertoEm), atualizadoEm: iso(fim ?? abertoEm), encerradoEm: fim ? iso(fim) : null
        };
    });

    // ---------- Backups ----------
    const backups = [];
    let seqBk = 1;
    const novoBackup = (dados) => {
        const id = `bk_${String(seqBk).padStart(4, "0")}`;
        const codigo = `BKP-${String(seqBk++).padStart(5, "0")}`;
        backups.push({ id, codigo, ...dados });
        evento("backup", id, "registrado", `Backup ${codigo} agendado (${dados.tipo}).`, dados.data);
        if (dados.status === "concluido" || dados.status === "arquivado") evento("backup", id, "concluido", `Execução concluída: ${dados.tamanhoMb.toLocaleString("pt-BR")} MB (demonstrativo).`, new Date(new Date(dados.data).getTime() + 18 * 60000));
        if (dados.status === "falhou") evento("backup", id, "falhou", `Falha na execução: ${dados.erro}`, new Date(new Date(dados.data).getTime() + 30 * 60000));
        if (dados.integridade === "verificado_demo") evento("backup", id, "integridade", "Integridade verificada (simulação; nenhum arquivo real lido).", new Date(new Date(dados.data).getTime() + 45 * 60000));
        return id;
    };
    for (let d = 34; d >= 0; d--) {
        const base0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - d);
        const em = (h) => new Date(base0.getFullYear(), base0.getMonth(), base0.getDate(), h);
        const antigo = d > 7;
        if (base0.getDay() === 0) {
            if (em(2) <= agora) novoBackup({ nome: `Backup completo semanal ${base0.toLocaleDateString("pt-BR")}`, tipo: "completo", origem: "plataforma", data: iso(em(2)), tamanhoMb: 1280 + (34 - d) * 6, status: d > 28 ? "arquivado" : "concluido", retencao: "Semanal · 4 semanas", integridade: "verificado_demo" });
        }
        if (em(3) <= agora) {
            const falhou = d === 4;
            novoBackup({
                nome: `Banco de dados ${base0.toLocaleDateString("pt-BR")}`, tipo: "banco", origem: "postgres", data: iso(em(3)),
                tamanhoMb: falhou ? 0 : 300 + (34 - d) * 2.3, status: falhou ? "falhou" : antigo ? "arquivado" : "concluido",
                retencao: "Diária · 7 dias", integridade: falhou ? "falhou" : d % 3 === 0 ? "verificado_demo" : "nao_verificado",
                erro: falhou ? "Tempo limite excedido ao conectar ao banco (simulado)." : null
            });
        }
        if (em(4) <= agora) {
            const falhou = d === 11;
            novoBackup({
                nome: `Arquivos e imagens ${base0.toLocaleDateString("pt-BR")}`, tipo: d % 2 ? "incremental" : "arquivos", origem: "storage", data: iso(em(4)),
                tamanhoMb: falhou ? 0 : d % 2 ? 40 + d : 800 + (34 - d) * 9, status: falhou ? "falhou" : antigo ? "arquivado" : "concluido",
                retencao: "Diária · 7 dias", integridade: falhou ? "falhou" : "nao_verificado",
                erro: falhou ? "Destino de armazenamento externo não configurado (simulado)." : null
            });
        }
    }
    [20, 9, 2].forEach((d) => novoBackup({
        nome: "Configurações do Barber Control", tipo: "configuracoes", origem: "configuracoes", data: iso(atras(d * DIA)),
        tamanhoMb: 0.2, status: "concluido", retencao: "Mensal · 12 meses", integridade: "verificado_demo"
    }));
    const amanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 3);
    novoBackup({ nome: `Banco de dados ${amanha.toLocaleDateString("pt-BR")} (agendado)`, tipo: "banco", origem: "postgres", data: iso(amanha), tamanhoMb: null, status: "pendente", retencao: "Diária · 7 dias", integridade: "nao_verificado" });
    backups.sort((a, b) => a.data.localeCompare(b.data));

    const politicaBackup = {
        frequencia: "diaria", horario: "03:00", retencaoDiaria: 7, retencaoSemanal: 4, retencaoMensal: 12, prazoDias: 365,
        destinoExterno: "Não configurado (pendente de integração)", atualizadoEm: iso(atras(40 * DIA))
    };
    evento("politica_backup", "politica", "definida", "Política inicial: backup diário às 03:00, retenção 7/4/12, prazo de 365 dias.", atras(40 * DIA));

    const ultimoSemanal = [...backups].reverse().find((b) => b.tipo === "completo" && b.status === "concluido");
    const ultimoBanco = [...backups].reverse().find((b) => b.tipo === "banco" && b.status === "concluido");
    const recuperacoes = [
        {
            id: "rc_001", codigo: "REC-0001", backupId: backups.find((b) => b.tipo === "completo")?.id, ambiente: "homologacao",
            motivo: "Teste trimestral de recuperação (simulação).", status: "simulada", etapa: 6,
            solicitadoEm: iso(atras(30 * DIA)), concluidoEm: iso(atras(30 * DIA - 95 * 60000)), solicitante: "Proprietário do SaaS"
        },
        {
            id: "rc_002", codigo: "REC-0002", backupId: ultimoBanco?.id ?? ultimoSemanal?.id, ambiente: "isolado",
            motivo: "Validar dados de agendamentos antes de uma atualização.", status: "solicitada", etapa: 0,
            solicitadoEm: iso(atras(6 * HORA)), concluidoEm: null, solicitante: "Proprietário do SaaS"
        }
    ];
    evento("recuperacao", "rc_001", "solicitada", "Restauração simulada solicitada em homologação.", atras(30 * DIA));
    evento("recuperacao", "rc_001", "simulada", "Simulação concluída em 95 minutos. Nenhum dado real foi restaurado.", atras(30 * DIA - 95 * 60000));
    evento("recuperacao", "rc_002", "solicitada", "Restauração simulada solicitada em ambiente isolado.", atras(6 * HORA));

    const continuidade = {
        rpoHoras: 24, rtoHoras: 4,
        estrategia: "Backup diário do banco às 03:00 e semanal completo aos domingos. Restauração primeiro em ambiente isolado, validação da aplicação e só então troca para produção.",
        responsaveis: "Proprietário do SaaS (decisão e comunicação); Suporte nível 2 (execução técnica)",
        testes: [{ id: "tr_001", data: iso(atras(30 * DIA)), tipo: "Restauração em homologação", resultado: "Simulação concluída", duracaoMin: 95, observacoes: "Cenário demonstrativo. Nenhum dado real foi usado." }],
        atualizadoEm: iso(atras(30 * DIA))
    };

    // ---------- Alertas (central integrada) ----------
    const falhaBackup = backups.find((b) => b.status === "falhou" && b.tipo === "banco");
    const naoVerificado = [...backups].reverse().find((b) => b.status === "concluido" && b.integridade === "nao_verificado" && b.tipo === "banco");
    const alertas = [
        ["seguranca", "login_suspeito", "alta", "investigacao", 0.2, `8 tentativas de login falharam em 10 minutos contra ${alvoSuspeito.nome}.`, { tipo: "barbearia", id: alvoSuspeito.barbeariaId }, `login_suspeito|usuario:${alvoSuspeito.id}`],
        ["seguranca", "incidente_seguranca", "critica", "novo", 2, "Incidente crítico INC-SEG-0002: tentativa de acesso a dados de outra empresa (simulado).", { tipo: "incidente_seg", id: "is_002" }, "incidente_seguranca|incidente_seg:is_002"],
        ["monitoramento", "latencia_elevada", "media", "reconhecido", 1, "Latência média do banco acima de 300 ms nas últimas 24 h (demonstrativo).", { tipo: "servico", id: "sv_banco" }, "latencia_elevada|servico:sv_banco"],
        ["monitoramento", "servico_indisponivel", "alta", "encerrado", 4, "Autenticação indisponível por cerca de 12 minutos (demonstrativo).", { tipo: "servico", id: "sv_auth" }, "servico_indisponivel|servico:sv_auth"],
        ["monitoramento", "aumento_erros", "media", "novo", 2, "Aumento de erros na aplicação Barber em navegadores móveis (demonstrativo).", { tipo: "servico", id: "sv_barber_app" }, "aumento_erros|servico:sv_barber_app"],
        ["backup", "falha_backup", "alta", "novo", 4, `Backup ${falhaBackup?.codigo ?? ""} do banco falhou: tempo limite excedido (simulado).`, { tipo: "backup", id: falhaBackup?.id }, `falha_backup|backup:${falhaBackup?.id}`],
        ["backup", "integridade_pendente", "media", "novo", 1, `Backup ${naoVerificado?.codigo ?? ""} concluído sem verificação de integridade.`, { tipo: "backup", id: naoVerificado?.id }, `integridade_pendente|backup:${naoVerificado?.id}`],
        ["backup", "restauracao_pendente", "baixa", "novo", 0.25, "Solicitação de restauração REC-0002 aguardando análise.", { tipo: "recuperacao", id: "rc_002" }, "restauracao_pendente|recuperacao:rc_002"]
    ].map(([categoria, tipo, gravidade, status, diasAtras, descricao, referencia, chave], i) => {
        const id = `al_${String(i + 1).padStart(4, "0")}`;
        const codigo = `ALR-${String(i + 1).padStart(5, "0")}`;
        const data = atras(diasAtras * DIA);
        evento("alerta", id, "criado", `Alerta ${codigo} gerado automaticamente (demonstração).`, data);
        if (status !== "novo") evento("alerta", id, "reconhecido", "Alerta reconhecido.", new Date(data.getTime() + 20 * 60000));
        if (status === "encerrado") evento("alerta", id, "encerrado", "Alerta encerrado após a normalização do serviço.", new Date(data.getTime() + 3 * HORA));
        return {
            id, codigo, categoria, tipo, gravidade, status, descricao, referencia, chave, ocorrencias: 1, providencias: [],
            comunicadoId: null, data: iso(data), atualizadoEm: iso(data)
        };
    });

    return {
        eventosAuth, sessoesAdmin, incidentesSeg, permissoes, verificacoes,
        servicos, metricas, incidentesTec,
        backups, politicaBackup, recuperacoes, continuidade,
        alertas,
        sequenciasInfra: {
            incidente_seg: incidentesSeg.length, incidente_tec: incidentesTec.length, alerta: alertas.length,
            backup: seqBk - 1, recuperacao: recuperacoes.length, evento: eventosAuth.length
        },
        historicoInfra: historico
    };
}
