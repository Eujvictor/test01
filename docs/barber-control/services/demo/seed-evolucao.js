// =====================================================================
// DADOS DEMONSTRATIVOS DE EVOLUÇÃO DO SAAS (Fase 5) — todos fictícios
// Catálogo de funcionalidades (fonte única, inclui as 8 já usadas pelos
// planos), feature flags, liberações individuais, versões, rollbacks,
// histórico de mudanças e ideias do roadmap. Derivados das barbearias,
// planos e chamados existentes. Nenhum commit, deploy ou publicação real.
// =====================================================================
import { criarAleatorio } from "./seed.js";
import { FUNCIONALIDADES, FUNCIONALIDADES_FASE5 } from "./catalogo.js";

const DIA = 86400000;

const METADADOS_ORIGINAIS = {
    agenda_online: { categoria: "agendamento", dependencias: ["gestao_servicos", "controle_horarios"], descricao: "Agendamento pelo site, com escolha de serviço, barbeiro e horário." },
    painel_barbeiro: { categoria: "plataforma", dependencias: ["gestao_barbeiros"], descricao: "Painel individual do barbeiro com a agenda do dia." },
    lembretes_whatsapp: { categoria: "comunicacao", dependencias: ["agenda_online"], descricao: "Lembretes automáticos de agendamento." },
    relatorios: { categoria: "gestao", dependencias: ["gestao_clientes"], descricao: "Relatórios de desempenho, serviços e clientes." },
    site_personalizado: { categoria: "personalizacao", dependencias: [], descricao: "Site da barbearia com textos, imagens e cores próprias." },
    programa_fidelidade: { categoria: "gestao", dependencias: ["gestao_clientes"], descricao: "Pontos e recompensas para clientes frequentes." },
    multi_unidade: { categoria: "plataforma", dependencias: ["painel_admin"], descricao: "Várias unidades na mesma conta." },
    suporte_prioritario: { categoria: "plataforma", dependencias: [], descricao: "Atendimento com prioridade no suporte." }
};

const DEPENDENCIAS_FASE5 = {
    painel_admin: [], gestao_barbeiros: ["painel_admin"], gestao_clientes: ["painel_admin"], gestao_servicos: ["painel_admin"],
    controle_horarios: ["painel_admin"], notificacoes: ["painel_admin"], controle_financeiro: ["gestao_barbeiros", "relatorios"],
    configuracoes_personalizadas: ["painel_admin"]
};

export function gerarDadosEvolucao(base, agora = new Date()) {
    const r = criarAleatorio(20261120);
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const iso = (d) => new Date(d).toISOString();
    const atras = (dias) => new Date(agora.getTime() - dias * DIA);
    const dataDia = (deslocamento) => {
        const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + deslocamento);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const historico = [];
    let seqHist = 1;
    const evento = (entidade, entidadeId, acao, descricao, data) => {
        historico.push({ id: `hi_evo_${String(seqHist++).padStart(5, "0")}`, entidade, entidadeId, acao, descricao, detalhes: {}, data: iso(data) });
    };

    // ---------- Catálogo de funcionalidades (fonte única) ----------
    const funcionalidades = [
        ...FUNCIONALIDADES.map((f) => ({ chave: f.id, nome: f.nome, status: "ativa", ...METADADOS_ORIGINAIS[f.id], criadoDias: 700 })),
        ...FUNCIONALIDADES_FASE5.map((f) => ({ chave: f.id, nome: f.nome, categoria: f.categoria, descricao: f.descricao, status: "ativa", dependencias: DEPENDENCIAS_FASE5[f.id], criadoDias: 650 })),
        { chave: "agenda_mobile_v2", nome: "Nova agenda mobile", categoria: "agendamento", descricao: "Agenda redesenhada para celular (em teste gradual).", status: "beta", dependencias: ["agenda_online"], criadoDias: 30 },
        { chave: "pagamento_online", nome: "Pagamento online no agendamento", categoria: "financeiro", descricao: "Cobrança de sinal ou valor total ao agendar.", status: "planejada", dependencias: ["agenda_online", "controle_financeiro"], criadoDias: 5 }
    ].map((f) => {
        const id = `fn_${f.chave}`;
        const criadoEm = atras(f.criadoDias);
        evento("funcionalidade", id, "criada", `Funcionalidade "${f.nome}" adicionada ao catálogo.`, criadoEm);
        return { id, chave: f.chave, nome: f.nome, descricao: f.descricao, categoria: f.categoria, status: f.status, dependencias: f.dependencias ?? [], criadoEm: iso(criadoEm), atualizadoEm: iso(criadoEm) };
    });

    // Direito comercial: completa os planos padrão com as funcionalidades novas.
    const planosAtualizados = base.planos.map((p) => {
        if (!["pl_basic", "pl_professional", "pl_premium"].includes(p.id)) return p;
        const extras = FUNCIONALIDADES_FASE5.filter((f) => f.base || f.planos?.includes(p.id)).map((f) => f.id);
        if (p.id === "pl_premium") extras.push("agenda_mobile_v2");
        return { ...p, funcionalidades: [...new Set([...p.funcionalidades, ...extras])] };
    });

    // ---------- Grupo de testes ----------
    const ativas = base.barbearias.filter((b) => b.status === "ativa");
    const planoDe = (bid) => base.assinaturas.find((a) => a.barbeariaId === bid)?.planoId;
    const grupoTestes = { barbeariaIds: ativas.slice(0, 3).map((b) => b.id), atualizadoEm: iso(atras(40)) };
    const basicas = ativas.filter((b) => planoDe(b.id) === "pl_basic");
    const profissionais = ativas.filter((b) => planoDe(b.id) === "pl_professional");
    const lojaA = basicas[0] ?? ativas[4];
    const lojaB = basicas[1] ?? ativas[5];
    const lojaC = profissionais[0] ?? ativas[6];
    const lojaD = profissionais[1] ?? ativas[7];

    // ---------- Feature flags ----------
    const flags = [
        ["ff_agenda_mobile_v2", "Nova agenda mobile", "agenda_mobile_v2", true, 25, grupoTestes.barbeariaIds, -15, 45, "Liberação gradual da nova agenda para celular."],
        ["ff_relatorio_comissoes", "Relatório de comissões", "relatorios", true, 100, [], -60, -3, "Novo relatório de comissões dentro de Relatórios."],
        ["ff_pagamento_pix", "Pagamento por Pix na agenda", "pagamento_online", false, 0, [lojaA.id], -5, 60, "Piloto de pagamento online (ainda não disponível)."],
        ["ff_lembretes_v2", "Lembretes com confirmação", "lembretes_whatsapp", true, 50, [], -20, 30, "Lembrete com botão de confirmação de presença."]
    ].map(([chave, nome, funcionalidadeChave, ativa, percentual, barbeariaIds, ini, fim, descricao], i) => {
        const id = `fl_${String(i + 1).padStart(3, "0")}`;
        evento("flag", id, "criada", `Flag ${chave} criada (${percentual}% de liberação).`, atras(-ini + 1));
        if (!ativa) evento("flag", id, "desativada", `Flag ${chave} desativada.`, atras(-ini));
        return { id, chave, nome, descricao, funcionalidadeChave, ativa, percentual, barbeariaIds, inicio: dataDia(ini), validade: dataDia(fim), criadoEm: iso(atras(-ini + 1)), atualizadoEm: iso(atras(-ini)) };
    });

    // ---------- Liberações individuais (exceções administrativas) ----------
    const liberacoes = [
        [lojaA.id, "relatorios", "liberar", null, "Cortesia comercial por 6 meses de casa."],
        [lojaA.id, "relatorios", "bloquear", null, "Bloqueio solicitado pelo financeiro (gera conflito com a liberação)."],
        [lojaA.id, "controle_financeiro", "temporario", 10, "Avaliação do controle financeiro antes do upgrade."],
        [lojaC.id, "configuracoes_personalizadas", "temporario", -2, "Teste de configurações avançadas (vencido)."],
        [lojaD.id, "lembretes_whatsapp", "bloquear", null, "Envio excessivo de lembretes reportado."],
        [lojaB.id, "programa_fidelidade", "liberar", null, "Parceria de lançamento do programa de fidelidade."]
    ].map(([barbeariaId, funcionalidadeChave, tipo, validadeDias, motivo], i) => {
        const id = `lb_${String(i + 1).padStart(3, "0")}`;
        const criadoEm = atras(int(3, 25));
        evento("liberacao", id, "registrada", `${tipo === "bloquear" ? "Bloqueio" : tipo === "temporario" ? "Acesso temporário" : "Liberação"} de ${funcionalidadeChave} para ${base.barbearias.find((b) => b.id === barbeariaId)?.nome}.`, criadoEm);
        return { id, barbeariaId, funcionalidadeChave, tipo, validade: validadeDias === null ? null : dataDia(validadeDias), motivo, ativa: true, criadoEm: iso(criadoEm), atualizadoEm: iso(criadoEm) };
    });

    // ---------- Versões ----------
    const publicoTodas = { tipo: "todas" };
    const versoes = [
        ["2.0.0", "Nova agenda online", "funcionalidade", "publicada", 200, -150, ["agenda_online", "controle_horarios"], "geral", 100, "concluida", ["Agenda online refeita com escolha de barbeiro", "Bloqueio de horários e feriados"]],
        ["2.1.0", "Relatórios avançados", "funcionalidade", "publicada", 110, -80, ["relatorios"], "geral", 100, "concluida", ["Relatório de serviços mais vendidos", "Relatório de retorno de clientes"]],
        ["2.1.1", "Correção na exportação de relatórios", "correcao", "cancelada", 90, null, ["relatorios"], "nenhum", 0, "nao_iniciada", ["Correção do CSV com acentos (absorvida pela 2.2.0)"]],
        ["2.2.0", "Lembretes por WhatsApp 2.0", "melhoria", "publicada", 60, -25, ["lembretes_whatsapp"], "geral", 100, "concluida", ["Novo modelo de mensagem", "Confirmação de presença"]],
        ["2.2.1", "Correção no salvamento de horários", "correcao", "publicada", 20, -14, ["controle_horarios"], "geral", 100, "concluida", ["Erro 500 ao salvar horário de sábado", "Validação de horários sobrepostos"]],
        ["2.3.0", "Nova agenda mobile (beta)", "funcionalidade", "aprovada", 30, 10, ["agenda_mobile_v2"], "gradual", 25, "em_andamento", ["Agenda redesenhada para celular", "Carregamento 2x mais rápido"]],
        ["2.3.1", "Ajustes de segurança no login", "seguranca", "testes", 8, 5, ["painel_admin"], "grupo_testes", 0, "em_andamento", ["Bloqueio após tentativas repetidas", "Aviso de login em novo dispositivo"]],
        ["2.4.0", "Controle financeiro", "funcionalidade", "desenvolvimento", 15, 40, ["controle_financeiro"], "nenhum", 0, "nao_iniciada", ["Caixa diário", "Comissões por barbeiro"]],
        ["3.0.0", "Pagamento online", "funcionalidade", "planejada", 5, 120, ["pagamento_online"], "nenhum", 0, "nao_iniciada", ["Pagamento de sinal por Pix", "Conciliação com o financeiro"]]
    ].map(([numero, nome, categoria, status, criadoDias, previsao, funcs, modo, percentual, statusDist, itens], i) => {
        const id = `vs_${String(i + 1).padStart(3, "0")}`;
        const criadoEm = atras(criadoDias);
        const publicadaEm = status === "publicada" ? atras(-previsao) : null;
        evento("versao", id, "criada", `Versão ${numero} cadastrada como planejada.`, criadoEm);
        if (status !== "planejada") evento("versao", id, "status", `Status alterado para ${status}.`, new Date(criadoEm.getTime() + 3 * DIA));
        if (modo === "grupo_testes") evento("versao", id, "distribuicao", "Publicação para o grupo de testes iniciada (demonstração).", atras(3));
        if (modo === "gradual") evento("versao", id, "distribuicao", "Distribuição gradual iniciada em 25% (demonstração).", atras(6));
        if (publicadaEm) evento("versao", id, "publicada", "Liberação geral concluída (demonstração; nenhum deploy real).", publicadaEm);
        return {
            id, numero, nome, categoria, status, arquivada: false,
            descricao: `${nome}. ${itens.join(". ")}.`,
            responsavel: i % 2 ? "Equipe de desenvolvimento (demonstrativo)" : "Proprietário do SaaS",
            previsaoLancamento: previsao === null ? null : dataDia(previsao),
            publicadaEm: publicadaEm ? iso(publicadaEm) : null,
            alteracoes: itens.map((texto, k) => ({ id: `${id}_a${k + 1}`, tipo: categoria, descricao: texto })),
            funcionalidades: funcs,
            distribuicao: { publico: modo === "grupo_testes" ? { tipo: "grupo_testes" } : publicoTodas, modo, percentual: modo === "grupo_testes" ? 100 : percentual, status: statusDist, atualizadoEm: iso(atras(modo === "nenhum" ? criadoDias : 3)) },
            ideiaId: null, criadoEm: iso(criadoEm), atualizadoEm: iso(publicadaEm ?? criadoEm)
        };
    });
    const v = (numero) => versoes.find((x) => x.numero === numero);

    // ---------- Rollbacks (somente simulações) ----------
    const rollbacks = [
        { id: "rb_001", codigo: "RB-0001", versaoAtualId: v("2.2.0").id, versaoDestinoId: v("2.1.0").id, motivo: "Falha no envio de lembretes logo após a publicação.", responsavel: "Proprietário do SaaS", status: "concluido", data: iso(atras(24)), atualizadoEm: iso(atras(23)) },
        { id: "rb_002", codigo: "RB-0002", versaoAtualId: v("2.2.1").id, versaoDestinoId: v("2.2.0").id, motivo: "Relatos de lentidão ao salvar horários após a correção.", responsavel: "Proprietário do SaaS", status: "em_analise", data: iso(atras(1)), atualizadoEm: iso(atras(1)) }
    ];
    evento("rollback", "rb_001", "solicitado", "Reversão de 2.2.0 para 2.1.0 solicitada.", atras(24));
    evento("rollback", "rb_001", "concluido", "Reversão simulada concluída. Nenhum código foi alterado.", atras(23));
    evento("rollback", "rb_002", "solicitado", "Reversão de 2.2.1 para 2.2.0 solicitada.", atras(1));
    evento("rollback", "rb_002", "em_analise", "Solicitação em análise.", atras(0.5));

    // ---------- Histórico de mudanças ----------
    const mudancas = [];
    const novaMudanca = (titulo, categoria, natureza, descricao, versao, funcionalidadeChave, dias, status = "concluida", branch = "") => {
        const id = `md_${String(mudancas.length + 1).padStart(4, "0")}`;
        mudancas.push({
            id, codigo: `CHG-${String(mudancas.length + 1).padStart(4, "0")}`, titulo, categoria, natureza, descricao,
            versaoId: versao?.id ?? null, funcionalidadeChave, data: iso(atras(dias)),
            responsavel: dias % 2 ? "Equipe de desenvolvimento (demonstrativo)" : "Proprietário do SaaS",
            publico: { tipo: natureza === "administrativa" ? "nenhum" : "todas" }, status,
            referencias: { repositorio: "", branch, commit: "", arquivo: "", referencia: "" }, origem: "seed"
        });
    };
    novaMudanca("Agenda online com escolha de barbeiro", "funcionalidades", "nova_funcionalidade", "Nova etapa de escolha do barbeiro no agendamento.", v("2.0.0"), "agenda_online", 152, "concluida", "feature/agenda-online (exemplo)");
    novaMudanca("Tabela de bloqueios de horário", "banco", "tecnica", "Nova estrutura para bloqueios de horário e feriados.", v("2.0.0"), "controle_horarios", 155);
    novaMudanca("Relatório de serviços mais vendidos", "funcionalidades", "nova_funcionalidade", "Relatório com ranking de serviços por período.", v("2.1.0"), "relatorios", 82);
    novaMudanca("Índice para consultas de relatório", "banco", "melhoria", "Consultas de relatório até 3x mais rápidas.", v("2.1.0"), "relatorios", 83);
    novaMudanca("Novo modelo de lembrete", "interface", "melhoria", "Mensagem de lembrete mais clara, com endereço e horário.", v("2.2.0"), "lembretes_whatsapp", 27);
    novaMudanca("Reversão de emergência dos lembretes", "desenvolvimento", "correcao", "Reversão simulada RB-0001 após falha de envio.", v("2.2.0"), "lembretes_whatsapp", 23);
    novaMudanca("Correção do salvamento de horário de sábado", "desenvolvimento", "correcao", "Erro 500 ao salvar o horário de sábado em algumas barbearias.", v("2.2.1"), "controle_horarios", 15, "concluida", "fix/horario-sabado (exemplo)");
    novaMudanca("Validação de horários sobrepostos", "interface", "correcao", "Aviso ao cadastrar horários que se sobrepõem.", v("2.2.1"), "controle_horarios", 14);
    novaMudanca("Layout da agenda para celular", "interface", "nova_funcionalidade", "Nova agenda mobile em distribuição gradual.", v("2.3.0"), "agenda_mobile_v2", 9, "em_andamento", "feature/agenda-mobile (exemplo)");
    novaMudanca("Bloqueio após tentativas de login", "seguranca", "melhoria", "Bloqueio temporário após 5 tentativas sem sucesso.", v("2.3.1"), "painel_admin", 6, "em_andamento");
    novaMudanca("Modelo de dados do caixa", "banco", "nova_funcionalidade", "Estrutura inicial do controle financeiro.", v("2.4.0"), "controle_financeiro", 10, "em_andamento");
    novaMudanca("Plano Premium recebe nova agenda mobile", "administracao", "administrativa", "Funcionalidade beta associada ao plano Premium.", null, "agenda_mobile_v2", 28);
    novaMudanca("Política de backup revisada", "infraestrutura", "administrativa", "Backup diário às 03:00 e retenção 7/4/12.", null, null, 40);
    novaMudanca("Flag de relatório de comissões", "configuracoes", "administrativa", "Flag ff_relatorio_comissoes criada com liberação total.", null, "relatorios", 60);
    novaMudanca("Permissões do perfil de marketing", "seguranca", "administrativa", "Acesso a notificações revogado para o perfil de marketing.", null, null, 18);
    novaMudanca("Atualização de dependências do painel", "infraestrutura", "tecnica", "Atualização das bibliotecas do painel (demonstrativo).", null, null, 33);

    // ---------- Ideias e solicitações (roadmap) ----------
    const comVotos = (n) => ativas.slice().sort(() => r() - 0.5).slice(0, n).map((b) => ({ barbeariaId: b.id, data: iso(atras(int(1, 40))) }));
    const ideias = [
        ["Pagamento online no agendamento", "funcionalidade", "barbearia", "alta", "planejada", ativas[1], 4, 5, 4, 4, 3, 9, 120, v("3.0.0")],
        ["Controle financeiro com comissões", "funcionalidade", "barbearia", "alta", "desenvolvimento", ativas[2], 5, 4, 3, 4, 4, 7, 40, v("2.4.0")],
        ["Nova agenda mobile", "melhoria", "interna", "media", "testes", null, 4, 3, 3, 3, 4, 5, 10, v("2.3.0")],
        ["Aplicativo próprio para celular", "funcionalidade", "usuario", "media", "analise", null, 4, 5, 2, 5, 3, 6, 200, null],
        ["Integração com Instagram", "integracao", "barbearia", "baixa", "recebida", ativas[3], 2, 3, 2, 3, 2, 3, null, null],
        ["Relatório de clientes que não voltam", "melhoria", "barbearia", "media", "aprovada", ativas[4], 4, 4, 3, 2, 3, 6, 75, null],
        ["Lista de espera para horários lotados", "funcionalidade", "barbearia", "media", "aprovada", ativas[5], 3, 3, 3, 2, 3, 4, 90, null],
        ["Bloqueio de login por tentativas", "seguranca", "seguranca", "critica", "testes", null, 4, 5, 5, 2, 5, 1, 5, v("2.3.1")],
        ["Fila de envio para lembretes", "desempenho", "tecnica", "alta", "planejada", null, 3, 4, 4, 3, 5, 0, 60, null],
        ["Multi-idioma no site de agendamento", "funcionalidade", "interna", "baixa", "recebida", null, 2, 2, 1, 4, 2, 1, null, null],
        ["Importação de clientes por planilha", "operacional", "operacional", "media", "analise", null, 3, 3, 3, 2, 2, 4, null, null],
        ["Programa de fidelidade com cashback", "funcionalidade", "barbearia", "media", "recebida", ativas[6], 3, 3, 2, 4, 2, 5, null, null],
        ["Exportação de agenda para Google Agenda", "integracao", "usuario", "baixa", "concluida", null, 2, 3, 2, 2, 2, 3, -30, null],
        ["Assinatura mensal de clientes (clube)", "funcionalidade", "barbearia", "alta", "analise", ativas[7], 5, 4, 3, 5, 3, 8, null, null],
        ["Tema escuro no painel do barbeiro", "melhoria", "usuario", "baixa", "cancelada", null, 1, 2, 1, 2, 1, 2, null, null]
    ].map(([titulo, categoria, origem, prioridade, status, barbearia, impacto, urgencia, tecnica, esforco, _peso, votos, previsao, versao], i) => {
        const id = `id_${String(i + 1).padStart(3, "0")}`;
        const criadoEm = atras(int(10, 120));
        evento("ideia", id, "registrada", `Ideia "${titulo}" registrada (${origem === "barbearia" ? "solicitação de barbearia" : origem}).`, criadoEm);
        if (status !== "recebida") evento("ideia", id, "status", `Movida para ${status}.`, new Date(criadoEm.getTime() + 5 * DIA));
        return {
            id, codigo: `IDEA-${String(i + 1).padStart(4, "0")}`, titulo,
            descricao: barbearia ? `Solicitação de ${barbearia.nome}: ${titulo.toLowerCase()}.` : `${titulo}.`,
            categoria, origem, prioridade, status, barbeariaId: barbearia?.id ?? null,
            responsavel: i % 3 ? "Proprietário do SaaS" : "Equipe de desenvolvimento (demonstrativo)",
            criterios: { impacto, urgencia, tecnica, esforco },
            decisao: status === "cancelada" ? "Baixa demanda; mantido o tema claro." : status === "recebida" ? "" : "Em avaliação pela equipe de produto.",
            previsao: previsao === null ? null : dataDia(previsao),
            votos: comVotos(votos), versaoId: versao?.id ?? null,
            criadoEm: iso(criadoEm), atualizadoEm: iso(criadoEm)
        };
    });
    // Vincula as versões às ideias de origem.
    ideias.forEach((i) => { if (i.versaoId) { const vs = versoes.find((x) => x.id === i.versaoId); if (vs && !vs.ideiaId) vs.ideiaId = i.id; } });

    return {
        funcionalidades, planosAtualizados, flags, liberacoes, grupoTestes, versoes, rollbacks, mudancas, ideias,
        sequenciasEvolucao: { versao: versoes.length, rollback: rollbacks.length, mudanca: mudancas.length, ideia: ideias.length, flag: flags.length, liberacao: liberacoes.length },
        historicoEvolucao: historico
    };
}
