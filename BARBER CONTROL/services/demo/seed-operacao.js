// =====================================================================
// DADOS DEMONSTRATIVOS DA OPERAÇÃO (Fase 3) — todos fictícios
// Gerados A PARTIR das barbearias, usuários e planos já existentes
// (nenhuma empresa é criada aqui). Também usado como migração para
// quem já tinha dados da Fase 2 salvos no navegador.
//
// Agendamentos são guardados em formato compacto (tupla) para caber
// com folga no localStorage:
//   [barbeariaId, servicoId, barbeiroId, dia (dias desde 1970, UTC), minuto do dia, status r|p|c]
// =====================================================================
import { criarAleatorio } from "./seed.js";
import { SERVICOS } from "./catalogo.js";

const DIA = 86400000;

export function numeroDoDia(data) {
    const d = new Date(data);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DIA);
}

export function dataDoNumero(n) {
    return new Date(n * DIA).toISOString().slice(0, 10);
}

const PESO_HORA = { 8: 0.5, 9: 0.8, 10: 1.2, 11: 1.2, 12: 0.6, 13: 0.6, 14: 0.8, 15: 0.9, 16: 1.0, 17: 1.3, 18: 1.4, 19: 1.1 };
const PESO_DIA_SEMANA = [0.2, 0.6, 0.9, 0.9, 1.0, 1.2, 1.5]; // dom..sáb

const MODELOS_CHAMADO = [
    ["tecnico", "Agenda não carrega no celular", "Desde ontem a agenda online fica em branco quando os clientes abrem pelo celular. No computador funciona."],
    ["tecnico", "Erro ao salvar horário de funcionamento", "Tento alterar o horário de sábado e aparece uma mensagem de erro ao salvar."],
    ["agendamentos", "Cliente agendou em horário bloqueado", "Bloqueei o feriado mas um cliente conseguiu marcar às 10h. Como evitar?"],
    ["agendamentos", "Agendamentos duplicados", "Apareceram dois agendamentos iguais para o mesmo cliente no mesmo horário."],
    ["financeiro", "Cobrança em duplicidade", "Recebi duas cobranças da mensalidade deste mês. Preciso do estorno de uma delas."],
    ["financeiro", "Nota fiscal da assinatura", "Preciso da nota fiscal das últimas três mensalidades para a contabilidade."],
    ["assinaturas", "Quero mudar para o plano anual", "Gostaria de migrar para o plano anual. Como fica o valor proporcional?"],
    ["assinaturas", "Dúvida sobre limite de barbeiros", "Contratei mais um barbeiro e o sistema não deixa cadastrar. Preciso trocar de plano?"],
    ["acesso", "Não consigo entrar na conta", "Esqueci a senha e o e-mail de recuperação não chega."],
    ["acesso", "Barbeiro sem acesso ao painel", "Um dos barbeiros diz que o login dele foi bloqueado."],
    ["duvidas", "Como configurar lembretes", "Onde ativo os lembretes automáticos para os clientes?"],
    ["duvidas", "Relatório de comissões", "Existe um relatório com a comissão de cada barbeiro por mês?"],
    ["solicitacoes", "Sugestão: pagamento online", "Seria ótimo os clientes pagarem um sinal no momento do agendamento."],
    ["solicitacoes", "Personalizar cores do site", "Gostaria de usar as cores da minha marca no site de agendamento."],
    ["outros", "Parceria para evento", "Vamos fazer um evento na barbearia e queríamos divulgar pelo sistema."],
    ["tecnico", "Lentidão no painel", "O painel administrativo está demorando muito para abrir a lista de clientes."]
];

const RESPOSTAS_SUPORTE = [
    "Olá! Recebemos seu chamado e já estamos analisando. Retornamos em breve.",
    "Conseguimos reproduzir o comportamento. Poderia confirmar o navegador e o modelo do celular?",
    "Fizemos o ajuste necessário. Pode verificar se agora está tudo certo?",
    "Encaminhamos para a equipe responsável. Atualizaremos este chamado assim que houver novidades."
];

const NOTAS_INTERNAS = [
    "Cliente antigo, priorizar retorno.",
    "Verificar se o problema se repete em outras barbearias.",
    "Possível relação com a última atualização do painel.",
    "Aguardando confirmação da equipe financeira."
];

const SUGESTOES = [
    "Relatório de comissão por barbeiro seria muito útil",
    "Pagamento online no momento do agendamento",
    "Ter um aplicativo próprio para celular",
    "Lembretes automáticos no WhatsApp mais personalizáveis",
    "Mais opções no relatório financeiro",
    "Integração com o Instagram para agendar",
    "Programa de fidelidade mais flexível",
    "Agenda mais rápida no celular",
    "Pagamento por Pix direto na agenda",
    "Relatório de clientes que não voltam"
];

const LEADS = [
    "Barbearia Fio de Navalha", "Studio Corte Nobre", "Barbearia Pente Fino", "Clube do Bigode",
    "Barbearia Lâmina", "Corte & Estilo", "Barbearia Raiz", "Navalha Urbana"
];

export function gerarDadosOperacao(base, agora = new Date()) {
    const r = criarAleatorio(20261118);
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const escolher = (lista) => lista[Math.floor(r() * lista.length)];
    const ponderado = (pares) => {
        const total = pares.reduce((s, [, p]) => s + p, 0);
        let alvo = r() * total;
        for (const [valor, peso] of pares) { alvo -= peso; if (alvo <= 0) return valor; }
        return pares.at(-1)[0];
    };
    const iso = (d) => new Date(d).toISOString();
    const diasAtras = (dias, horas = 0) => new Date(agora.getTime() - dias * DIA - horas * 3600000);
    const hoje = numeroDoDia(agora);
    const minutoAgora = agora.getHours() * 60 + agora.getMinutes();

    const historico = [];
    let seqHistorico = 1;
    const evento = (entidade, entidadeId, acao, descricao, data, detalhes = {}) => {
        historico.push({ id: `hi_op_${String(seqHistorico++).padStart(5, "0")}`, entidade, entidadeId, acao, descricao, detalhes, data: iso(data) });
    };

    const barbearias = base.barbearias;
    const usuarios = base.usuarios;
    const assinaturaDe = (id) => base.assinaturas.find((a) => a.barbeariaId === id);
    const equipeDe = (id, tipo) => usuarios.filter((u) => u.barbeariaId === id && u.tipo === tipo);

    // ---------- Agendamentos ----------
    const agendamentos = [];
    const pesosServico = SERVICOS.map((s) => [s.id, s.peso]);
    const pesosHora = Object.entries(PESO_HORA).map(([h, p]) => [Number(h), p]);

    barbearias.forEach((b, indice) => {
        const barbeiros = equipeDe(b.id, "barbeiro");
        const equipe = barbeiros.length ? barbeiros : equipeDe(b.id, "proprietario");
        if (!equipe.length) return;
        const assinatura = assinaturaDe(b.id);
        const perfil = indice % 7 === 1 ? "crescimento" : indice % 7 === 3 ? "queda" : indice % 7 === 5 ? "cancelamentos" : "estavel";
        b.perfilAtividade = perfil;

        const inicio = Math.max(numeroDoDia(b.criadoEm), hoje - 180);
        const fimAtividade = b.status === "cancelada" && assinatura?.canceladaEm ? numeroDoDia(assinatura.canceladaEm) : hoje + 14;
        const taxaBase = equipe.length * 1.2;

        for (let dia = inicio; dia <= fimAtividade; dia++) {
            const atras = hoje - dia;
            let fator = PESO_DIA_SEMANA[new Date(dia * DIA).getUTCDay()];
            if (perfil === "crescimento") fator *= atras < 30 ? 1.7 : atras < 60 ? 1.25 : 1;
            if (perfil === "queda") fator *= atras < 30 ? 0.4 : atras < 60 ? 0.85 : 1;
            if (b.status === "suspensa" && atras < 25) fator *= 0.04;
            if (dia > hoje) fator *= 0.55; // agenda futura ainda sendo preenchida
            const esperado = taxaBase * fator;
            const quantidade = Math.max(0, Math.round(esperado + (r() - 0.5) * esperado * 0.7));

            for (let k = 0; k < quantidade; k++) {
                const minuto = ponderado(pesosHora) * 60 + (r() < 0.5 ? 0 : 30);
                const futuro = dia > hoje || (dia === hoje && minuto > minutoAgora);
                const chanceCancelamento = perfil === "cancelamentos" && atras < 30 ? 0.24 : futuro ? 0.04 : 0.07;
                const status = r() < chanceCancelamento ? "c" : futuro ? "p" : "r";
                agendamentos.push([b.id, ponderado(pesosServico), escolher(equipe).id, dia, minuto, status]);
            }
        }
    });

    // Atualiza os totais mensais usados no perfil da barbearia (módulo 02),
    // para que os números sejam os mesmos nos dois módulos.
    const porBarbeariaMes = new Map();
    agendamentos.forEach(([bid, , , dia]) => {
        if (dia > hoje) return;
        const chave = `${bid}|${dataDoNumero(dia).slice(0, 7)}`;
        porBarbeariaMes.set(chave, (porBarbeariaMes.get(chave) ?? 0) + 1);
    });
    barbearias.forEach((b) => {
        const meses = [];
        for (let m = 5; m >= 0; m--) {
            const ref = new Date(agora.getFullYear(), agora.getMonth() - m, 1);
            const mes = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
            meses.push({ mes, total: porBarbeariaMes.get(`${b.id}|${mes}`) ?? 0 });
        }
        b.atividade = { ...(b.atividade ?? {}), agendamentosPorMes: meses };
    });

    // ---------- Chamados ----------
    const ativas = barbearias.filter((b) => b.status !== "cancelada");
    const chamados = [];
    const ano = agora.getFullYear();
    for (let i = 0; i < 34; i++) {
        const [categoria, titulo, descricao] = MODELOS_CHAMADO[i % MODELOS_CHAMADO.length];
        const b = escolher(ativas);
        const dono = equipeDe(b.id, "proprietario")[0];
        const outros = usuarios.filter((u) => u.barbeariaId === b.id && (u.tipo === "funcionario" || u.tipo === "barbeiro"));
        const solicitante = r() < 0.7 || !outros.length ? dono : escolher(outros);
        const idadeDias = i < 8 ? int(0, 3) : i < 16 ? int(3, 15) : int(15, 90);
        const abertoEm = diasAtras(idadeDias, int(0, 10));
        const status = i < 5 ? "aberto" : i < 9 ? "em_atendimento" : i < 13 ? "aguardando" : i < 30 ? "resolvido" : "encerrado";
        const prioridade = ponderado([["baixa", 2], ["normal", 5], ["alta", 2], ["critica", categoria === "tecnico" || categoria === "acesso" ? 1.5 : 0.3]]);
        const id = `ch_${String(i + 1).padStart(4, "0")}`;
        const protocolo = `BC-${ano}-${String(i + 1).padStart(5, "0")}`;
        const mensagens = [{ id: `${id}_m1`, autor: "cliente", nome: solicitante?.nome ?? "Cliente", texto: descricao, data: iso(abertoEm) }];
        let cursor = abertoEm.getTime();
        const passo = () => { cursor = Math.min(agora.getTime() - 60000, cursor + int(1, 20) * 3600000); return new Date(cursor); };
        if (status !== "aberto") mensagens.push({ id: `${id}_m2`, autor: "suporte", nome: "Suporte Barber", texto: RESPOSTAS_SUPORTE[0], data: iso(passo()) });
        if (status === "aguardando") mensagens.push({ id: `${id}_m3`, autor: "suporte", nome: "Suporte Barber", texto: RESPOSTAS_SUPORTE[1], data: iso(passo()) });
        if (status === "resolvido" || status === "encerrado") {
            mensagens.push({ id: `${id}_m3`, autor: "suporte", nome: "Suporte Barber", texto: RESPOSTAS_SUPORTE[2], data: iso(passo()) });
            mensagens.push({ id: `${id}_m4`, autor: "cliente", nome: solicitante?.nome ?? "Cliente", texto: "Funcionou, obrigado!", data: iso(passo()) });
        }
        const resolvidoEm = status === "resolvido" || status === "encerrado" ? iso(passo()) : null;
        const notas = r() < 0.35 ? [{ id: `${id}_n1`, texto: escolher(NOTAS_INTERNAS), autor: "Proprietário do SaaS", data: iso(passo()) }] : [];

        let suporteAssistido = { status: "nao_solicitado" };
        if (i === 6) suporteAssistido = { status: "solicitado", solicitadoEm: iso(passo()), motivo: "Verificar a configuração da agenda online.", escopo: "Configurações da agenda" };
        if (i === 14 || i === 20) {
            const solicitadoEm = new Date(abertoEm.getTime() + 2 * 3600000);
            suporteAssistido = {
                status: "encerrado", motivo: "Analisar a configuração de horários.", escopo: "Configurações da agenda",
                solicitadoEm: iso(solicitadoEm), respondidoEm: iso(new Date(solicitadoEm.getTime() + 1800000)),
                autorizadoPor: solicitante?.nome ?? "Proprietário", validadeHoras: 2,
                encerradoEm: iso(new Date(solicitadoEm.getTime() + 5400000))
            };
            evento("chamado", id, "assistido_solicitado", "Autorização de suporte assistido solicitada ao cliente (demonstração).", solicitadoEm);
            evento("chamado", id, "assistido_autorizado", `Cliente ${suporteAssistido.autorizadoPor} autorizou o suporte assistido por 2 h · escopo: ${suporteAssistido.escopo}.`, suporteAssistido.respondidoEm);
            evento("chamado", id, "assistido_encerrado", "Sessão de suporte assistido encerrada.", suporteAssistido.encerradoEm);
        }

        chamados.push({
            id, protocolo, titulo, descricao, categoria, prioridade, status,
            barbeariaId: b.id, solicitanteId: solicitante?.id ?? null,
            responsavel: status === "aberto" && r() < 0.6 ? null : escolher(["proprietario", "suporte_n1", "suporte_n2"]),
            mensagens, notas, suporteAssistido,
            abertoEm: iso(abertoEm), atualizadoEm: mensagens.at(-1).data, resolvidoEm
        });
        evento("chamado", id, "aberto", `Chamado ${protocolo} aberto por ${solicitante?.nome ?? "cliente"}.`, abertoEm);
        if (resolvidoEm) evento("chamado", id, "status", `Status alterado para ${status === "resolvido" ? "Resolvido" : "Encerrado"}.`, resolvidoEm);
    }

    // ---------- Comunicados ----------
    const dataDia = (deslocamento) => {
        const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + deslocamento);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const comunicados = [
        ["Nova agenda online mais rápida", "A agenda online foi otimizada e agora carrega até duas vezes mais rápido no celular.", "atualizacao", "normal", "publicado", { tipo: "todas" }, -40, null],
        ["Manutenção programada no domingo", "O sistema ficará indisponível no domingo, das 2h às 4h, para manutenção preventiva.", "manutencao", "alta", "publicado", { tipo: "todas" }, -12, -10],
        ["Ative a verificação em duas etapas", "Recomendamos que todos os proprietários ativem a verificação em duas etapas no painel.", "seguranca", "alta", "publicado", { tipo: "todas" }, -6, null],
        ["Relatórios avançados liberados", "O plano Professional agora inclui relatórios de desempenho por barbeiro.", "novidade", "normal", "publicado", { tipo: "plano", planoId: "pl_professional" }, -20, null],
        ["Seu período de teste está acabando", "Escolha um plano para continuar usando todos os recursos sem interrupção.", "financeiro", "normal", "agendado", { tipo: "teste" }, 3, 20],
        ["Regularize sua assinatura", "Identificamos pendências na sua assinatura. Regularize para reativar o acesso.", "importante", "alta", "rascunho", { tipo: "suspensas" }, null, null],
        ["Novidades de dezembro", "Prévia das novidades previstas para o fim do ano.", "geral", "baixa", "rascunho", { tipo: "todas" }, null, null],
        ["Mudança no horário de suporte", "O atendimento passou a funcionar das 8h às 20h.", "geral", "normal", "arquivado", { tipo: "todas" }, -120, -60]
    ].map(([titulo, descricao, categoria, prioridade, status, publico, pub, fim], i) => {
        const id = `cm_${String(i + 1).padStart(3, "0")}`;
        const criadoEm = diasAtras(pub !== null ? Math.max(1, -pub + 2) : int(1, 5));
        const c = {
            id, titulo, descricao, categoria, prioridade, status, publico,
            publicacaoEm: pub !== null ? dataDia(pub) : null, encerramentoEm: fim !== null ? dataDia(fim) : null,
            publicadoEm: status === "publicado" || status === "arquivado" ? iso(new Date(`${dataDia(pub)}T09:00:00`)) : null,
            alcanceRegistrado: null, criadoEm: iso(criadoEm), atualizadoEm: iso(criadoEm)
        };
        evento("comunicado", id, "criado", "Comunicado criado como rascunho.", criadoEm);
        if (status === "agendado") evento("comunicado", id, "agendado", `Publicação demonstrativa agendada para ${c.publicacaoEm.split("-").reverse().join("/")}.`, criadoEm);
        if (c.publicadoEm) evento("comunicado", id, "publicado", "Publicado no painel de comunicados (demonstração; nenhum envio realizado).", c.publicadoEm);
        if (status === "arquivado") evento("comunicado", id, "arquivado", "Comunicado arquivado.", diasAtras(55));
        return c;
    });

    // ---------- Cupons ----------
    const cupons = [
        ["BEMVINDO20", "20% na primeira mensalidade para novas barbearias", "percentual", 20, -90, 60, 100, 37, true],
        ["UPGRADE50", "R$ 50 de desconto ao migrar para um plano superior", "valor", 50, -30, 30, 50, 12, true],
        ["BLACK30", "30% na Black Friday Barber", "percentual", 30, -10, 15, 200, 21, true],
        ["VOLTA25", "25% para barbearias que retornam", "percentual", 25, -150, -20, 80, 19, true],
        ["NATAL15", "15% nas assinaturas de dezembro", "percentual", 15, 14, 45, 150, 0, true],
        ["PARCEIRO10", "10% para parceiros comerciais", "percentual", 10, -200, 100, 30, 4, false]
    ].map(([codigo, descricao, tipoDesconto, valor, ini, val, limiteUsos, usos, ativo], i) => {
        const id = `cp_${String(i + 1).padStart(3, "0")}`;
        const criadoEm = diasAtras(Math.max(1, -ini + 3));
        evento("cupom", id, "criado", `Cupom ${codigo} criado.`, criadoEm);
        if (!ativo) evento("cupom", id, "desativado", `Cupom ${codigo} desativado.`, diasAtras(20));
        return { id, codigo, descricao, tipoDesconto, valor, inicio: dataDia(ini), validade: dataDia(val), limiteUsos, usos, ativo, criadoEm: iso(criadoEm), atualizadoEm: iso(criadoEm) };
    });

    // ---------- Campanhas ----------
    const campanhas = [
        ["Black Friday Barber", "upgrade", "Converter barbearias do plano Basic para planos superiores.", { tipo: "segmento", filtros: { planos: ["pl_basic"], status: ["ativa"] } }, -10, 15, 1500, "ativa", "cp_003", [42, 9, 3]],
        ["Volta pra agenda", "reativacao", "Reativar barbearias suspensas e canceladas.", { tipo: "segmento", filtros: { status: ["suspensa", "cancelada"] } }, -20, 25, 800, "ativa", "cp_004", [18, 5, 1]],
        ["Indique e ganhe", "indicacoes", "Estimular indicações de novas barbearias.", { tipo: "segmento", filtros: { status: ["ativa"] } }, -60, 60, 600, "ativa", null, [65, 14, 4]],
        ["Lançamento do Premium", "novos_planos", "Apresentar o plano Premium para clientes Professional.", { tipo: "segmento", filtros: { planos: ["pl_professional"] } }, -150, -100, 1200, "ativa", null, [30, 11, 4]],
        ["Aquisição Centro-Oeste", "aquisicao", "Atrair barbearias de Goiânia e Brasília.", { tipo: "prospects", prospectsEstimados: 400 }, -120, -60, 2500, "ativa", "cp_001", [400, 52, 6]],
        ["Retenção trimestral", "retencao", "Contato preventivo com barbearias de baixa atividade.", { tipo: "segmento", filtros: { atividade: ["baixa", "sem"] } }, 5, 40, 500, "rascunho", null, [0, 0, 0]]
    ].map(([nome, tipo, objetivo, publico, ini, fim, orcamento, status, cupomId, [impactadas, interacoes, conversoes]], i) => {
        const id = `ca_${String(i + 1).padStart(3, "0")}`;
        const criadoEm = diasAtras(Math.max(1, -ini + 5));
        evento("campanha", id, "criada", `Campanha "${nome}" criada.`, criadoEm);
        if (status === "ativa") evento("campanha", id, "ativada", "Campanha ativada (demonstração; nenhuma mensagem enviada).", diasAtras(Math.max(0, -ini)));
        return {
            id, nome, tipo, objetivo, publico, inicio: dataDia(ini), fim: dataDia(fim), orcamento, status, cupomId,
            resultados: { impactadas, interacoes, conversoes, investido: status === "rascunho" ? 0 : Math.round(orcamento * (fim < 0 ? 1 : 0.5)) },
            criadoEm: iso(criadoEm), atualizadoEm: iso(criadoEm)
        };
    });

    // ---------- Indicações ----------
    const indicacoes = [];
    const recentes = barbearias.filter((b) => b.status !== "cancelada" && agora - new Date(b.criadoEm) < 220 * DIA);
    const indicadoras = barbearias.filter((b) => b.status === "ativa" && agora - new Date(b.criadoEm) > 200 * DIA);
    const codigoDe = (b) => `IND-${b.nome.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 5)}`;
    recentes.slice(0, 5).forEach((indicada, i) => {
        const indicadora = indicadoras[i % indicadoras.length];
        if (!indicadora || indicadora.id === indicada.id) return;
        const id = `in_${String(indicacoes.length + 1).padStart(3, "0")}`;
        const data = new Date(new Date(indicada.criadoEm).getTime() - int(2, 10) * DIA);
        const status = indicada.status === "teste" ? "em_teste" : "convertida";
        indicacoes.push({
            id, indicadoraId: indicadora.id, codigo: codigoDe(indicadora), indicadaNome: indicada.nome, indicadaId: indicada.id,
            contato: indicada.email, data: iso(data), status, recompensa: "1 mensalidade grátis",
            recompensaStatus: status === "convertida" ? (i % 2 ? "pendente" : "concedida") : "pendente",
            criadoEm: iso(data), atualizadoEm: iso(data)
        });
        evento("indicacao", id, "registrada", `Indicação de ${indicada.nome} registrada por ${indicadora.nome}.`, data);
        if (status === "convertida") evento("indicacao", id, "convertida", `${indicada.nome} assinou um plano.`, indicada.criadoEm);
    });
    LEADS.slice(0, 6).forEach((nome, i) => {
        const indicadora = indicadoras[(i + 2) % indicadoras.length];
        if (!indicadora) return;
        const id = `in_${String(indicacoes.length + 1).padStart(3, "0")}`;
        const data = diasAtras(i < 4 ? int(2, 40) : int(70, 120));
        indicacoes.push({
            id, indicadoraId: indicadora.id, codigo: codigoDe(indicadora), indicadaNome: nome, indicadaId: null,
            contato: `contato@${nome.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase()}.exemplo.com`,
            data: iso(data), status: i < 4 ? "pendente" : "expirada", recompensa: "1 mensalidade grátis", recompensaStatus: "pendente",
            criadoEm: iso(data), atualizadoEm: iso(data)
        });
        evento("indicacao", id, "registrada", `Indicação de ${nome} registrada por ${indicadora.nome}.`, data);
    });

    // ---------- Pesquisas ----------
    const responderPesquisa = (perguntas, respondentes, diasMax) => respondentes.map((b) => ({
        barbeariaId: b.id,
        data: iso(diasAtras(int(1, diasMax), int(0, 12))),
        valores: Object.fromEntries(perguntas.map((p) => [p.id,
            p.tipo === "nps" ? ponderado([[10, 4], [9, 4], [8, 3], [7, 2], [6, 1], [5, 1], [3, 0.5]])
                : p.tipo === "escala" ? ponderado([[5, 4], [4, 4], [3, 2], [2, 0.6], [1, 0.3]])
                    : (r() < 0.75 ? escolher(SUGESTOES) : "")]))
    }));
    const embaralhadas = [...barbearias.filter((b) => b.status !== "cancelada")].sort(() => r() - 0.5);
    const p1 = [
        { id: "q1", tipo: "nps", texto: "De 0 a 10, quanto você recomendaria o Barber a outro dono de barbearia?" },
        { id: "q2", tipo: "escala", texto: "Como você avalia a facilidade de uso da agenda?" },
        { id: "q3", tipo: "texto", texto: "O que podemos melhorar?" }
    ];
    const p2 = [
        { id: "q1", tipo: "escala", texto: "Os lembretes reduziram as faltas dos clientes?" },
        { id: "q2", tipo: "texto", texto: "Que recurso você gostaria de ver nos lembretes?" }
    ];
    const pesquisas = [
        {
            id: "ps_001", titulo: "NPS do trimestre", descricao: "Pesquisa trimestral de satisfação com a plataforma.",
            status: "encerrada", publico: { tipo: "todas" }, perguntas: p1,
            respostas: responderPesquisa(p1, embaralhadas.slice(0, 16), 60), criadoEm: iso(diasAtras(75)), atualizadoEm: iso(diasAtras(10))
        },
        {
            id: "ps_002", titulo: "Satisfação com os lembretes", descricao: "Avaliação dos lembretes automáticos de agendamento.",
            status: "ativa", publico: { tipo: "todas" }, perguntas: p2,
            respostas: responderPesquisa(p2, embaralhadas.slice(5, 12), 12), criadoEm: iso(diasAtras(15)), atualizadoEm: iso(diasAtras(1))
        }
    ];
    pesquisas.forEach((p) => {
        evento("pesquisa", p.id, "criada", `Pesquisa "${p.titulo}" criada.`, p.criadoEm);
        evento("pesquisa", p.id, "ativada", "Coleta de respostas iniciada (demonstração).", new Date(new Date(p.criadoEm).getTime() + DIA));
        if (p.status === "encerrada") evento("pesquisa", p.id, "encerrada", "Coleta encerrada.", p.atualizadoEm);
    });

    return {
        agendamentos, chamados, comunicados, cupons, campanhas, indicacoes, pesquisas,
        sequencias: { chamado: chamados.length },
        historicoOperacao: historico
    };
}
