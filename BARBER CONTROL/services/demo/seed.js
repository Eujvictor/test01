// =====================================================================
// DADOS INICIAIS DE DEMONSTRAÇÃO (todos fictícios)
// Gerador determinístico: os mesmos números a cada restauração,
// com datas relativas ao dia em que os dados são gerados.
// E-mails usam o domínio reservado "exemplo.com"; CNPJs são aleatórios.
// =====================================================================
import { FUNCIONALIDADES, METODOS_PAGAMENTO } from "./catalogo.js";

export const VERSAO_DADOS = 1;

const DIA = 86400000;

export function criarAleatorio(semente) {
    let s = semente >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function somarMeses(data, meses) {
    const d = new Date(data);
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + meses);
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimoDia));
    return d;
}

export function arredondar(valor) {
    return Math.round(valor * 100) / 100;
}

export function calcularTaxa(valor, metodo) {
    const m = METODOS_PAGAMENTO[metodo];
    return arredondar(valor * m.taxaPercentual + m.taxaFixa);
}

function slug(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}

const NOMES_BARBEARIAS = [
    "Navalha de Ouro", "Dom Bigode", "Corte Fino", "Barba & Navalha", "Studio Black Barber",
    "Vintage Barbershop", "Old School Barber", "Barbearia Imperial", "The Gentleman", "Barbearia do Zé",
    "Kings Barber", "Navalha Afiada", "Barbearia Clássica", "Urban Cuts", "Barbearia Alpha",
    "Estilo Masculino", "Barbearia Central", "Cabelo & Cia", "Barbearia Prime", "Bigode Grosso",
    "Barbearia Bravo", "Mestre da Navalha", "Barbearia Elite", "Tesoura de Prata"
];

const CIDADES = [
    ["São Paulo", "SP", "11"], ["Rio de Janeiro", "RJ", "21"], ["Belo Horizonte", "MG", "31"],
    ["Goiânia", "GO", "62"], ["Curitiba", "PR", "41"], ["Porto Alegre", "RS", "51"],
    ["Salvador", "BA", "71"], ["Recife", "PE", "81"], ["Fortaleza", "CE", "85"],
    ["Brasília", "DF", "61"], ["Campinas", "SP", "19"], ["Florianópolis", "SC", "48"],
    ["Manaus", "AM", "92"], ["Belém", "PA", "91"], ["Uberlândia", "MG", "34"], ["Ribeirão Preto", "SP", "16"]
];

const PRIMEIROS = [
    "Rafael", "Lucas", "Bruno", "Thiago", "Diego", "Gustavo", "Felipe", "André", "Marcelo", "Rodrigo",
    "Carlos", "Eduardo", "Leonardo", "Mateus", "Vinícius", "Pedro", "João", "Gabriel", "Henrique", "Igor",
    "Ana", "Juliana", "Camila", "Fernanda", "Patrícia", "Larissa", "Beatriz", "Mariana", "Renata", "Aline"
];

const SOBRENOMES = [
    "Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Carvalho", "Ferreira", "Rodrigues", "Almeida",
    "Costa", "Gomes", "Martins", "Araújo", "Barbosa", "Ribeiro", "Rocha", "Dias", "Moreira", "Cardoso"
];

const RUAS = ["Rua das Flores", "Av. Brasil", "Rua XV de Novembro", "Av. Paulista", "Rua Augusta", "Av. Goiás", "Rua da Paz", "Av. Central"];

export function gerarDadosIniciais(agora = new Date()) {
    const r = criarAleatorio(20261117);
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const escolher = (lista) => lista[Math.floor(r() * lista.length)];
    const iso = (data) => new Date(data).toISOString();
    const diasAtras = (dias) => new Date(agora.getTime() - dias * DIA);

    const emailsUsados = new Set();
    function emailUnico(nome, dominio) {
        const base = slug(nome);
        let email = `${base}@${dominio}`;
        let n = 2;
        while (emailsUsados.has(email)) email = `${base}${n++}@${dominio}`;
        emailsUsados.add(email);
        return email;
    }
    const nomePessoa = () => `${escolher(PRIMEIROS)} ${escolher(SOBRENOMES)}`;
    const telefone = (ddd) => `(${ddd}) 9${int(1000, 9999)}-${int(1000, 9999)}`;
    const cnpj = () => {
        const d = Array.from({ length: 14 }, () => int(0, 9)).join("");
        return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    };

    // ---------- Planos ----------
    const todas = FUNCIONALIDADES.map((f) => f.id);
    const planos = [
        {
            id: "pl_basic", nome: "Basic", descricao: "Para barbearias com até 3 profissionais.",
            precoMensal: 79.9, precoAnual: 799, diasTeste: 14, limiteUsuarios: 3, limiteAgendamentos: 500,
            funcionalidades: ["agenda_online", "painel_barbeiro", "lembretes_whatsapp"], arquivado: false
        },
        {
            id: "pl_professional", nome: "Professional", descricao: "Equipes em crescimento com relatórios e site próprio.",
            precoMensal: 149.9, precoAnual: 1499, diasTeste: 14, limiteUsuarios: 8, limiteAgendamentos: 2000,
            funcionalidades: ["agenda_online", "painel_barbeiro", "lembretes_whatsapp", "relatorios", "site_personalizado", "programa_fidelidade"],
            arquivado: false
        },
        {
            id: "pl_premium", nome: "Premium", descricao: "Recursos completos, múltiplas unidades e suporte prioritário.",
            precoMensal: 249.9, precoAnual: 2499, diasTeste: 30, limiteUsuarios: 0, limiteAgendamentos: 0,
            funcionalidades: todas, arquivado: false
        }
    ].map((p) => ({ ...p, criadoEm: iso(diasAtras(720)), atualizadoEm: iso(diasAtras(720)) }));

    // ---------- Distribuição de status ----------
    const status = [
        ...Array(15).fill("ativa"), ...Array(4).fill("teste"), ...Array(3).fill("suspensa"), ...Array(2).fill("cancelada")
    ];
    for (let i = status.length - 1; i > 1; i--) {
        const j = 1 + Math.floor(r() * i);
        [status[i], status[j]] = [status[j], status[i]];
    }
    status[0] = "ativa";
    let vencidasAtivas = 2;

    const barbearias = [];
    const assinaturas = [];
    const transacoes = [];
    const usuarios = [];
    const historico = [];
    let seqTransacao = 1;
    let seqUsuario = 1;
    let seqHistorico = 1;

    const evento = (entidade, entidadeId, acao, descricao, data, detalhes = {}) => {
        historico.push({ id: `hi_${String(seqHistorico++).padStart(5, "0")}`, entidade, entidadeId, acao, descricao, detalhes, data: iso(data) });
    };

    NOMES_BARBEARIAS.forEach((nome, i) => {
        const id = `bb_${String(i + 1).padStart(3, "0")}`;
        const st = status[i];
        const [cidade, uf, ddd] = CIDADES[i % CIDADES.length];
        const sorteio = r();
        const plano = st === "teste" ? escolher(planos) : sorteio < 0.4 ? planos[0] : sorteio < 0.8 ? planos[1] : planos[2];
        const diasCadastro = { ativa: int(60, 700), teste: int(1, 12), suspensa: int(150, 520), cancelada: int(240, 620) }[st];
        const criadoEm = diasAtras(diasCadastro);
        const periodicidade = st !== "teste" && r() < 0.25 ? "anual" : "mensal";
        const donoNome = nomePessoa();
        const dominio = `${slug(nome).replace(/\./g, "")}.exemplo.com`;

        // ---------- Assinatura ----------
        const assinaturaId = `as_${String(i + 1).padStart(3, "0")}`;
        let statusAssinatura;
        let proximoVencimento;
        let canceladaEm = null;
        const meses = periodicidade === "anual" ? 12 : 1;
        // Ciclos de cobrança começam após o período de teste (mesma regra das transações).
        let ciclo = new Date(criadoEm.getTime() + plano.diasTeste * DIA);

        if (st === "teste") {
            statusAssinatura = "teste";
            proximoVencimento = new Date(criadoEm.getTime() + plano.diasTeste * DIA);
        } else {
            while (somarMeses(ciclo, meses) <= agora) ciclo = somarMeses(ciclo, meses);
            proximoVencimento = somarMeses(ciclo, meses);
            statusAssinatura = "ativa";
            if (st === "ativa" && vencidasAtivas > 0 && periodicidade === "mensal" && r() < 0.35) {
                vencidasAtivas--;
                statusAssinatura = "vencida";
                proximoVencimento = ciclo;
            }
            if (st === "suspensa") {
                statusAssinatura = "vencida";
                proximoVencimento = ciclo;
            }
            if (st === "cancelada") {
                statusAssinatura = "cancelada";
                canceladaEm = diasAtras(int(30, 150));
            }
        }

        assinaturas.push({
            id: assinaturaId, barbeariaId: id, planoId: plano.id, periodicidade,
            valor: periodicidade === "anual" ? plano.precoAnual : plano.precoMensal,
            status: statusAssinatura, inicio: iso(criadoEm), proximoVencimento: iso(proximoVencimento),
            canceladaEm: canceladaEm ? iso(canceladaEm) : null,
            criadoEm: iso(criadoEm), atualizadoEm: iso(canceladaEm ?? criadoEm)
        });
        evento("assinatura", assinaturaId, "criada", `Assinatura criada no plano ${plano.nome} (${periodicidade}).`, criadoEm);
        if (statusAssinatura === "cancelada") evento("assinatura", assinaturaId, "cancelada", "Assinatura cancelada a pedido do cliente.", canceladaEm);

        // ---------- Transações (somente ciclos pagos/cobrados) ----------
        if (st !== "teste") {
            let venc = new Date(criadoEm.getTime() + plano.diasTeste * DIA);
            const limite = canceladaEm ?? agora;
            const ciclos = [];
            while (venc <= limite) {
                ciclos.push(new Date(venc));
                venc = somarMeses(venc, meses);
            }
            const metodoPreferido = r() < 0.55 ? "pix" : r() < 0.7 ? "cartao" : "boleto";
            ciclos.forEach((dataVenc, k) => {
                const ultimo = k === ciclos.length - 1;
                const penultimo = k === ciclos.length - 2;
                let st2 = "pago";
                if (statusAssinatura === "vencida" && (ultimo || (st === "suspensa" && penultimo))) st2 = "atrasado";
                else if (ultimo && agora - dataVenc < 5 * DIA && r() < 0.5) st2 = "pendente";
                else if (r() < 0.025) st2 = "estornado";

                const valor = periodicidade === "anual" ? plano.precoAnual : plano.precoMensal;
                const metodo = r() < 0.85 ? metodoPreferido : escolher(Object.keys(METODOS_PAGAMENTO));
                const taxa = calcularTaxa(valor, metodo);
                const pagoEm = st2 === "pago" || st2 === "estornado" ? new Date(dataVenc.getTime() + int(0, 3) * DIA) : null;
                transacoes.push({
                    id: `tx_${String(seqTransacao++).padStart(5, "0")}`,
                    barbeariaId: id, assinaturaId, planoId: plano.id,
                    descricao: `Assinatura ${plano.nome} · ${periodicidade === "anual" ? "anual" : "mensal"}`,
                    valorBruto: valor, taxa, valorLiquido: arredondar(valor - taxa),
                    metodo, status: st2,
                    vencimento: iso(dataVenc), pagoEm: pagoEm ? iso(pagoEm) : null,
                    criadoEm: iso(dataVenc)
                });
            });
        }

        // ---------- Barbearia ----------
        const faixaBarbeiros = st === "teste" ? [1, 3] : plano.id === "pl_basic" ? [1, 3] : plano.id === "pl_professional" ? [2, 6] : [3, 9];
        const qtdBarbeiros = int(faixaBarbeiros[0], faixaBarbeiros[1]);
        const agendamentosPorMes = [];
        for (let m = 5; m >= 0; m--) {
            const ref = somarMeses(new Date(agora.getFullYear(), agora.getMonth(), 1), -m);
            let total = qtdBarbeiros * int(45, 110);
            if (ref < new Date(criadoEm.getFullYear(), criadoEm.getMonth(), 1)) total = 0;
            if (canceladaEm && ref > canceladaEm) total = 0;
            if (st === "suspensa" && m <= 1) total = Math.round(total * 0.15);
            if (m === 0) total = Math.round(total * Math.min(1, agora.getDate() / 30));
            agendamentosPorMes.push({ mes: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`, total });
        }

        barbearias.push({
            id, nome, razaoSocial: `${nome} Serviços de Barbearia Ltda.`, documento: cnpj(),
            email: `contato@${dominio}`, telefone: telefone(ddd),
            cidade, estado: uf, endereco: `${escolher(RUAS)}, ${int(10, 2400)}`,
            status: st, observacoes: "",
            atividade: { agendamentosPorMes },
            criadoEm: iso(criadoEm), atualizadoEm: iso(criadoEm)
        });
        evento("barbearia", id, "cadastro", "Barbearia cadastrada na plataforma.", criadoEm);
        if (st === "teste") evento("barbearia", id, "teste", `Período de teste de ${plano.diasTeste} dias iniciado.`, criadoEm);
        if (st === "suspensa") evento("barbearia", id, "suspensa", "Barbearia suspensa por inadimplência.", diasAtras(int(3, 25)));
        if (st === "cancelada") evento("barbearia", id, "cancelada", "Assinatura cancelada; acesso encerrado.", canceladaEm);

        // ---------- Usuários ----------
        const ultimoAcessoDono = { ativa: int(0, 5), teste: int(0, 2), suspensa: int(15, 60), cancelada: int(60, 200) }[st];
        const novoUsuario = (tipo, nomeU, diasCriacao, diasAcesso) => {
            const criado = new Date(Math.max(criadoEm.getTime(), agora.getTime() - diasCriacao * DIA));
            const usuario = {
                id: `us_${String(seqUsuario++).padStart(4, "0")}`,
                nome: nomeU, email: emailUnico(nomeU, dominio), telefone: telefone(ddd),
                tipo, barbeariaId: id,
                status: r() < 0.03 ? "suspenso" : "ativo",
                ultimoAcesso: iso(new Date(Math.max(criado.getTime(), agora.getTime() - diasAcesso * DIA))),
                criadoEm: iso(criado), atualizadoEm: iso(criado)
            };
            usuarios.push(usuario);
            return usuario;
        };
        const dono = novoUsuario("proprietario", donoNome, diasCadastro, ultimoAcessoDono);
        dono.status = "ativo";
        dono.ultimoAcesso = iso(diasAtras(ultimoAcessoDono));
        for (let k = 0; k < qtdBarbeiros; k++) novoUsuario("barbeiro", nomePessoa(), int(1, diasCadastro), int(0, 20) + ultimoAcessoDono);
        for (let k = 0; k < int(0, 2); k++) novoUsuario("funcionario", nomePessoa(), int(1, diasCadastro), int(0, 15) + ultimoAcessoDono);
        for (let k = 0; k < int(3, 10); k++) novoUsuario("cliente", nomePessoa(), int(1, diasCadastro), int(0, 45) + ultimoAcessoDono);
    });

    // ---------- Despesas (últimos 12 meses) ----------
    const despesas = [];
    let seqDespesa = 1;
    for (let m = 11; m >= 0; m--) {
        const ref = somarMeses(new Date(agora.getFullYear(), agora.getMonth(), 5), -m);
        if (ref > agora) continue;
        const chaveMes = ref.toISOString().slice(0, 7);
        const receitaMes = transacoes
            .filter((t) => t.status === "pago" && t.vencimento.slice(0, 7) === chaveMes)
            .reduce((s, t) => s + t.valorBruto, 0);
        [
            ["Infraestrutura (banco de dados e hospedagem)", "infraestrutura", int(180, 320)],
            ["Ferramentas e licenças", "ferramentas", int(90, 160)],
            ["Marketing digital", "marketing", int(300, 1200)],
            ["Contabilidade", "administrativo", 350],
            ["Impostos estimados (6%)", "impostos", arredondar(receitaMes * 0.06)]
        ].forEach(([descricao, categoria, valor]) => {
            despesas.push({ id: `dp_${String(seqDespesa++).padStart(4, "0")}`, descricao, categoria, valor, data: iso(ref) });
        });
    }

    return {
        versao: VERSAO_DADOS,
        geradoEm: iso(agora),
        planos, barbearias, assinaturas, transacoes, usuarios, despesas,
        historico: historico.sort((a, b) => b.data.localeCompare(a.data))
    };
}
