// =====================================================================
// MÓDULO 10 — SEGURANÇA (MODO REAL)
// Rota: #/seguranca
// Situação de segurança com dados reais: verificação em duas etapas dos
// administradores, tentativas de login, IPs com muitas falhas, contas
// sem vínculo e a lista das proteções que estão ativas no sistema.
// Fontes: listar_usuarios, auditoria_resumo, listar_tentativas_login.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { APP_CONFIG } from "../../config/app.config.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { criarTabela } from "../../js/components/tabela.js";
import { cabecalho, kpi, estadoVazio, novaRaiz } from "../../js/components/ui.js";

const TRINTA_DIAS = 30 * 86400000;

// Proteções implementadas (cada item aponta onde está no sistema).
const PROTECOES = [
    ["shield-check", "Verificação em duas etapas obrigatória no Barber Control", "Toda função do Master confere no banco o administrador e o segundo fator (aal2)."],
    ["lock-keyhole", "Bloqueio de tentativas de login", "5 falhas do mesmo e-mail e IP, ou 20 do mesmo IP, em 15 minutos bloqueiam novas tentativas por 15 minutos."],
    ["timer-off", `Sessão encerrada após ${APP_CONFIG.seguranca.inatividadeMinutos} minutos sem uso`, "O Barber Control sai sozinho por inatividade."],
    ["building-2", "Isolamento entre barbearias no banco", "Regras de acesso (RLS) por barbearia: uma barbearia nunca lê nem altera dados de outra."],
    ["key-round", "Chaves secretas só no servidor", "A chave de serviço e o token do Mercado Pago ficam nas Edge Functions, nunca no navegador."],
    ["scroll-text", "Auditoria que não pode ser alterada", "Cada ação do Master é gravada numa tabela somente de inserção."],
    ["badge-check", "Avisos de pagamento conferidos", "O aviso do Mercado Pago tem a assinatura verificada e o pagamento é consultado direto no Mercado Pago."]
];

export async function render(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Segurança", subtitulo: "Carregando do Supabase…" })}`);
    let usuarios, resumo, tentativas;
    try {
        [usuarios, resumo, tentativas] = await Promise.all([
            rpc("listar_usuarios"), rpc("auditoria_resumo", { p_dias: 30 }), rpc("listar_tentativas_login", { p_dias: 30, p_limite: 1000 })
        ]);
    } catch (erro) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Segurança", subtitulo: "Painel Master" })}
            <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar a segurança", texto: erro.message })}</section>`);
        return;
    }

    const masters = usuarios.filter((u) => u.tipo === "master");
    const mastersSemMfa = masters.filter((u) => !u.mfa);
    const donos = usuarios.filter((u) => (u.tipo === "proprietario" || u.tipo === "gerente") && u.ativo);
    const semAcesso = donos.filter((u) => !u.ultimo_acesso || Date.now() - new Date(u.ultimo_acesso).getTime() > TRINTA_DIAS);
    const semVinculo = usuarios.filter((u) => u.tipo === "sem_vinculo");
    const falhas = tentativas.filter((t) => !t.sucesso);
    const porIp = new Map();
    falhas.forEach((t) => porIp.set(t.ip ?? "desconhecido", (porIp.get(t.ip ?? "desconhecido") ?? 0) + 1));
    const ipsSuspeitos = [...porIp.entries()].filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]);

    const atencao = [
        ...mastersSemMfa.map((u) => ["shield-alert", `Administrador sem verificação em duas etapas: ${u.email}`, "Ele precisa concluir o cadastro do autenticador no próximo login."]),
        ...ipsSuspeitos.slice(0, 5).map(([ip, n]) => ["siren", `IP ${ip} com ${n} falhas de login em 30 dias`, "Pode ser alguém tentando adivinhar a senha. Veja em Auditoria → Tentativas de login."]),
        ...(semVinculo.length ? [["user-round-x", `${numero(semVinculo.length)} conta(s) de login sem vínculo`, "Contas que não acessam nenhum painel. Veja em Usuários e, se forem de teste antigas, apague no Supabase (Authentication → Users)."]] : []),
        ...(semAcesso.length ? [["clock", `${numero(semAcesso.length)} dono(s) ou gerente(s) sem acesso há 30 dias`, "Acessos parados podem ser desativados em Usuários."]] : [])
    ];

    renderizar(raiz, html`
        ${cabecalho({ titulo: "Segurança", subtitulo: "Situação real de acesso e proteção · últimos 30 dias" })}
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Duas etapas nos administradores", valor: `${numero(masters.length - mastersSemMfa.length)} de ${numero(masters.length)}`, iconeNome: "shield-check", nota: mastersSemMfa.length ? "Há administrador sem autenticador" : "Todos protegidos", destaque: true })}
            ${kpi({ rotulo: "Logins com falha", valor: numero(falhas.length), iconeNome: "shield-alert", nota: `${numero(tentativas.length - falhas.length)} com sucesso` })}
            ${kpi({ rotulo: "IPs suspeitos", valor: numero(ipsSuspeitos.length), iconeNome: "siren", nota: "5 ou mais falhas" })}
            ${kpi({ rotulo: "Eventos auditados", valor: numero(resumo.eventos), iconeNome: "scroll-text", nota: "Ações registradas" })}
        </section>
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Pontos de atenção</h2>
                    ${atencao.length ? html`<span class="badge badge--atencao">${numero(atencao.length)}</span>` : html`<span class="badge badge--sucesso"><span class="ponto"></span>Tudo certo</span>`}</div>
                ${atencao.length ? html`
                <ul class="lista">
                    ${atencao.map(([ic, titulo, meta]) => html`
                        <li class="lista__item"><span class="lista__icone">${icone(ic)}</span>
                            <div class="lista__conteudo"><div class="lista__titulo">${titulo}</div><div class="lista__meta">${meta}</div></div></li>`)}
                </ul>` : estadoVazio({ iconeNome: "shield-check", titulo: "Nenhum ponto de atenção", texto: "Administradores com autenticador, sem IPs suspeitos e sem contas soltas." })}
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Proteções ativas</h2><span class="badge badge--sucesso"><span class="ponto"></span>${numero(PROTECOES.length)}</span></div>
                <ul class="lista">
                    ${PROTECOES.map(([ic, titulo, meta]) => html`
                        <li class="lista__item"><span class="lista__icone">${icone(ic)}</span>
                            <div class="lista__conteudo"><div class="lista__titulo">${titulo}</div><div class="lista__meta">${meta}</div></div></li>`)}
                </ul>
            </section>
        </div>
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Últimas falhas de login</h2><a class="badge" href="#/auditoria/acessos">Ver todas as tentativas</a></div>
            <div data-tabela></div>
        </section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "ocorrido_em", rotulo: "Quando", valor: (t) => t.id, render: (t) => html`${dataHora(t.ocorrido_em)}<span class="celula-sub">${tempoRelativo(t.ocorrido_em)}</span>` },
            { chave: "email", rotulo: "E-mail digitado" },
            { chave: "ip", rotulo: "IP", render: (t) => html`${t.ip ?? "—"}${(porIp.get(t.ip ?? "desconhecido") ?? 0) >= 5 ? html` <span class="badge badge--erro">suspeito</span>` : ""}` },
            { chave: "user_agent", rotulo: "Navegador", render: (t) => html`<span class="celula-sub" title="${t.user_agent ?? ""}">${String(t.user_agent ?? "—").slice(0, 60)}</span>` }
        ],
        ordenacao: { chave: "ocorrido_em", direcao: "desc" }, vazio: "Nenhuma falha de login nos últimos 30 dias.", rotulo: "Falhas de login"
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(falhas);
}
