// =====================================================================
// MÓDULO 03 — ASSINATURAS E PLANOS (MODO REAL)
// Rotas: #/assinaturas          → assinatura de cada barbearia
//        #/assinaturas/planos   → planos, regras de cobrança e rotina
// Fonte: control_api (administrador + MFA, validados no servidor).
// Cobrança: fatura mensal pelo Mercado Pago (Pix, cartão, boleto); com
// fatura vencida há N dias (padrão 7) a barbearia é suspensa sozinha e
// volta quando o pagamento é confirmado. A barbearia de referência é isenta.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { STATUS_BARBEARIA } from "../../services/demo/catalogo.js";
import { html, icone, renderizar, bruto } from "../../js/utilities/dom.js";
import { numero, moeda, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, botaoIcone, campoBusca, campoSelect, novaRaiz } from "../../js/components/ui.js";

export const STATUS_ASSINATURA_REAL = {
    teste: { rotulo: "Em teste", tom: "atencao" },
    ativa: { rotulo: "Ativa", tom: "sucesso" },
    atrasada: { rotulo: "Atrasada", tom: "erro" },
    isenta: { rotulo: "Isenta", tom: "ouro" },
    cancelada: { rotulo: "Cancelada", tom: "neutro" }
};
const SECOES = [["", "Assinaturas"], ["planos", "Planos e regras"]];
const filtros = { busca: "", status: "", plano: "" };

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dia = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const traduzir = (erro) => {
    const t = `${erro.message} ${erro.original?.message ?? ""}`;
    const mapa = {
        codigo_em_uso: ["Já existe um plano com este código.", "codigo"], codigo_invalido: ["Use 2 a 40 letras minúsculas, números ou hífen.", "codigo"],
        preco_invalido: ["Preço inválido.", "preco_mensal"], dias_teste_invalido: ["Use de 0 a 90 dias.", "dias_teste"],
        nome_obrigatorio: ["Informe o nome.", "nome"], teste_sem_data: ["Informe até quando vai o teste.", "teste_ate"]
    };
    const chave = Object.keys(mapa).find((k) => t.includes(k));
    return chave ? Object.assign(new Error(mapa[chave][0]), { campo: mapa[chave][1] }) : erro;
};

function moldura(view, ativa, acoes = "") {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Assinaturas e planos", subtitulo: "Cobrança mensal pelo Mercado Pago · dados reais", acoes })}
        <nav class="abas abas--navegacao" aria-label="Seções de assinaturas">
            ${SECOES.map(([rota, rotulo]) => html`
                <a class="abas__aba" href="#/assinaturas${rota ? `/${rota}` : ""}" ${rota === ativa ? bruto('aria-current="page"') : ""}>${rotulo}</a>`)}
        </nav>
        <div data-secao></div>`);
    return { raiz, secao: raiz.querySelector("[data-secao]") };
}

function erroNaTela(view, erro) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Assinaturas e planos", subtitulo: "Painel Master" })}
        <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar as assinaturas", texto: erro.message })}</section>`);
}

async function gerenciar(a, planos) {
    return abrirFormulario({
        titulo: `Assinatura · ${a.barbearia}`,
        descricao: "A troca de plano vale a partir da próxima fatura. Isenta ou cancelada: as faturas em aberto são canceladas.",
        campos: [
            { nome: "plano_id", rotulo: "Plano", tipo: "select", largura: "meia", opcoes: planos.filter((p) => p.ativo || p.id === a.plano_id).map((p) => [p.id, `${p.nome} · ${moeda(p.preco_mensal)}/mês`]) },
            { nome: "status", rotulo: "Situação", tipo: "select", largura: "meia", opcoes: [["", `Manter (${STATUS_ASSINATURA_REAL[a.status]?.rotulo ?? a.status})`], ["teste", "Em teste"], ["ativa", "Ativa (cobrar)"], ["isenta", "Isenta (não cobrar)"], ["cancelada", "Cancelada"]] },
            { nome: "teste_ate", rotulo: "Teste até", tipo: "data", largura: "meia", ajuda: "Obrigatório para “Em teste”. A primeira fatura vence nesta data." },
            { nome: "motivo", rotulo: "Motivo (fica na auditoria)", tipo: "textarea", maxlength: 300 }
        ],
        valores: { plano_id: a.plano_id, status: "", teste_ate: a.status === "teste" ? (a.teste_ate ?? "") : "" },
        textoSalvar: "Salvar",
        aoSalvar: async (v) => {
            try {
                await rpc("alterar_assinatura", { p_barbearia: a.barbearia_id, p_dados: { plano_id: v.plano_id === a.plano_id ? null : v.plano_id, status: v.status || null, teste_ate: v.teste_ate || null, motivo: v.motivo || null } });
                return true;
            } catch (erro) { throw traduzir(erro); }
        }
    });
}

async function secaoAssinaturas(view) {
    let lista, planos;
    try {
        [lista, planos] = await Promise.all([rpc("listar_assinaturas"), rpc("listar_planos")]);
    } catch (erro) {
        return erroNaTela(view, erro);
    }
    const { raiz, secao } = moldura(view, "");
    const cont = (st) => lista.filter((a) => a.status === st).length;
    const mrr = lista.filter((a) => a.status === "ativa" || a.status === "atrasada").reduce((s, a) => s + Number(a.preco_mensal), 0);
    const emAberto = lista.reduce((s, a) => s + Number(a.valor_em_aberto), 0);

    renderizar(secao, html`
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Receita recorrente mensal", valor: moeda(mrr), iconeNome: "trending-up", nota: "Assinaturas ativas e atrasadas", destaque: true })}
            ${kpi({ rotulo: "Ativas", valor: numero(cont("ativa")), iconeNome: "circle-check", nota: "Pagando em dia" })}
            ${kpi({ rotulo: "Em teste", valor: numero(cont("teste")), iconeNome: "hourglass", nota: "Período gratuito" })}
            ${kpi({ rotulo: "Atrasadas", valor: numero(cont("atrasada")), iconeNome: "alarm-clock", nota: emAberto ? `${moeda(emAberto)} em aberto` : "Nenhum valor em aberto" })}
        </section>
        <div class="barra-filtros barra-filtros--solta">
            ${campoBusca({ id: "sBusca", valor: filtros.busca, placeholder: "Pesquisar barbearia" })}
            ${campoSelect({ id: "sStatus", rotulo: "Situação", valor: filtros.status, opcoes: [["", "Todas as situações"], ...Object.entries(STATUS_ASSINATURA_REAL).map(([k, v]) => [k, v.rotulo])] })}
            ${campoSelect({ id: "sPlano", rotulo: "Plano", valor: filtros.plano, opcoes: [["", "Todos os planos"], ...planos.map((p) => [p.id, p.nome])] })}
        </div>
        <section class="card"><div data-tabela></div></section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "barbearia", rotulo: "Barbearia", render: (a) => html`<a class="link-forte" href="#/barbearias/${a.barbearia_id}">${a.barbearia}</a>${a.barbearia_status !== "ativa" ? html`<span class="celula-sub">Site: ${STATUS_BARBEARIA[a.barbearia_status]?.rotulo ?? a.barbearia_status}${a.suspensa_por_inadimplencia ? " (por atraso)" : ""}</span>` : ""}` },
            { chave: "plano", rotulo: "Plano", render: (a) => html`${a.plano}<span class="celula-sub">${moeda(a.preco_mensal)}/mês</span>` },
            { chave: "status", rotulo: "Situação", valor: (a) => STATUS_ASSINATURA_REAL[a.status]?.rotulo, render: (a) => badgeStatus(STATUS_ASSINATURA_REAL, a.status) },
            { chave: "proximo_vencimento", rotulo: "Próximo vencimento", valor: (a) => (a.status === "teste" ? a.teste_ate : a.proximo_vencimento) ?? "", render: (a) => (a.status === "teste" ? html`${dia(a.teste_ate)}<span class="celula-sub">fim do teste</span>` : ["isenta", "cancelada"].includes(a.status) ? "—" : dia(a.proximo_vencimento)) },
            { chave: "valor_em_aberto", rotulo: "Em aberto", classe: "col-num", valor: (a) => Number(a.valor_em_aberto), render: (a) => (Number(a.valor_em_aberto) ? html`${moeda(a.valor_em_aberto)}${a.dias_atraso ? html`<span class="celula-sub">${numero(a.dias_atraso)} dia(s) de atraso</span>` : ""}` : "—") },
            { chave: "ultimo_pagamento", rotulo: "Último pagamento", valor: (a) => a.ultimo_pagamento ?? "", render: (a) => (a.ultimo_pagamento ? html`<span title="${dataHora(a.ultimo_pagamento)}">${tempoRelativo(a.ultimo_pagamento)}</span>` : "—") },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (a) => html`
                <a class="btn btn--fantasma btn--icone btn--pequeno" href="#/financeiro/${a.barbearia_id}" title="Faturas" aria-label="Faturas de ${a.barbearia}">${icone("receipt")}</a>
                ${a.protegida ? "" : botaoIcone({ acao: "gerenciar", id: a.barbearia_id, nomeIcone: "settings-2", rotulo: `Gerenciar a assinatura de ${a.barbearia}` })}` }
        ],
        ordenacao: { chave: "barbearia", direcao: "asc" }, vazio: "Nenhuma assinatura com os filtros atuais.", rotulo: "Assinaturas"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => lista.filter((a) =>
        (!filtros.status || a.status === filtros.status) && (!filtros.plano || a.plano_id === filtros.plano) &&
        (!filtros.busca || normalizar(`${a.barbearia} ${a.slug}`).includes(normalizar(filtros.busca))));
    tabela.definirLinhas(filtrar());
    secao.querySelector("#sBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(filtrar()); });
    secao.querySelector("#sStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(filtrar()); });
    secao.querySelector("#sPlano").addEventListener("change", (e) => { filtros.plano = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao=gerenciar]");
        if (!botao) return;
        const a = lista.find((x) => x.barbearia_id === botao.dataset.id);
        if (await gerenciar(a, planos)) { mostrarToast("Assinatura atualizada.", "sucesso"); secaoAssinaturas(view); }
    });
}

async function editarPlano(plano = null) {
    return abrirFormulario({
        titulo: plano ? `Editar plano ${plano.nome}` : "Novo plano",
        descricao: plano ? "O novo preço vale para as próximas faturas. Faturas já geradas não mudam." : "",
        campos: [
            { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, maxlength: 60, largura: "meia" },
            ...(plano ? [] : [{ nome: "codigo", rotulo: "Código", tipo: "texto", obrigatorio: true, maxlength: 40, largura: "meia", ajuda: "Ex.: basic. Não muda depois.", validar: (v) => (/^[a-z0-9-]{2,40}$/.test(v) ? null : "Use letras minúsculas, números ou hífen.") }]),
            { nome: "preco_mensal", rotulo: "Preço mensal (R$)", tipo: "numero", obrigatorio: true, min: 0, max: 100000, passo: "0.01", largura: "meia" },
            { nome: "dias_teste", rotulo: "Dias de teste grátis", tipo: "numero", obrigatorio: true, min: 0, max: 90, passo: 1, largura: "meia" },
            { nome: "descricao", rotulo: "Descrição", tipo: "textarea", maxlength: 300 },
            { nome: "ativo", rotulo: "Disponível", tipo: "select", opcoes: [["true", "Sim: pode ser escolhido para novas barbearias"], ["false", "Não: só mantém quem já tem"]] }
        ],
        valores: plano ? { ...plano, ativo: String(plano.ativo) } : { dias_teste: 14, ativo: "true" },
        textoSalvar: plano ? "Salvar plano" : "Criar plano",
        aoSalvar: async (v) => {
            try {
                return await rpc("salvar_plano", { p_id: plano?.id ?? null, p_dados: { ...v, ativo: v.ativo === "true" } });
            } catch (erro) { throw traduzir(erro); }
        }
    });
}

async function secaoPlanos(view) {
    let planos, fin;
    try {
        [planos, fin] = await Promise.all([rpc("listar_planos"), rpc("financeiro_resumo", { p_meses: 1 })]);
    } catch (erro) {
        return erroNaTela(view, erro);
    }
    const { raiz, secao } = moldura(view, "planos", html`<button class="btn btn--primario" type="button" data-acao="novo-plano">${icone("plus")}<span>Novo plano</span></button>`);
    const cfg = fin.config ?? {};
    renderizar(secao, html`
        <section class="card secao"><div data-tabela></div></section>
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Regras de cobrança</h2>
                    <button class="btn btn--pequeno" type="button" data-acao="regras">${icone("pencil")}<span>Alterar</span></button></div>
                <div class="card__corpo">
                    <ul class="lista">
                        <li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">Fatura gerada ${numero(cfg.dias_antecedencia)} dia(s) antes do vencimento</div><div class="lista__meta">O dono vê e paga no painel dele (Pix, cartão ou boleto).</div></div></li>
                        <li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">Suspensão automática com ${numero(cfg.dias_tolerancia)} dia(s) de atraso</div><div class="lista__meta">O site sai do ar e volta sozinho quando o pagamento é confirmado. A barbearia de referência nunca é suspensa.</div></div></li>
                    </ul>
                </div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Rotina diária</h2>
                    ${fin.rotina_agendada ? html`<span class="badge badge--sucesso"><span class="ponto"></span>Agendada · 6h</span>` : html`<span class="badge badge--atencao"><span class="ponto"></span>Não agendada</span>`}</div>
                <div class="card__corpo">
                    <p class="texto-sec texto-pequeno">Gera as faturas, encerra os períodos de teste, marca atrasos e suspende quem passou do prazo. ${fin.rotina_agendada ? "Roda todo dia às 6h (Brasília)." : "O agendador (pg_cron) não está ativo no Supabase: use o botão abaixo ou ative a extensão pg_cron."}</p>
                    <button class="btn" type="button" data-acao="rotina">${icone("play")}<span>Executar rotina agora</span></button>
                </div>
            </section>
        </div>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "nome", rotulo: "Plano", render: (p) => html`<strong>${p.nome}</strong><span class="celula-sub">${p.descricao ?? p.codigo}</span>` },
            { chave: "preco_mensal", rotulo: "Preço mensal", classe: "col-num", valor: (p) => Number(p.preco_mensal), render: (p) => moeda(p.preco_mensal) },
            { chave: "dias_teste", rotulo: "Teste grátis", classe: "col-num", valor: (p) => p.dias_teste, render: (p) => (p.dias_teste ? `${p.dias_teste} dias` : "Sem teste") },
            { chave: "assinaturas", rotulo: "Barbearias", classe: "col-num", valor: (p) => Number(p.assinaturas), render: (p) => numero(p.assinaturas) },
            { chave: "ativo", rotulo: "Disponível", valor: (p) => (p.ativo ? 1 : 0), render: (p) => badgeStatus({ s: { rotulo: "Sim", tom: "sucesso" }, n: { rotulo: "Não", tom: "neutro" } }, p.ativo ? "s" : "n") },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (p) => botaoIcone({ acao: "editar-plano", id: p.id, nomeIcone: "pencil", rotulo: `Editar o plano ${p.nome}` }) }
        ],
        ordenacao: { chave: "preco_mensal", direcao: "asc" }, vazio: "Nenhum plano cadastrado.", rotulo: "Planos"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(planos);

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao } = botao.dataset;
        try {
            if (acao === "novo-plano" && await editarPlano()) { mostrarToast("Plano criado.", "sucesso"); secaoPlanos(view); }
            if (acao === "editar-plano" && await editarPlano(planos.find((p) => p.id === botao.dataset.id))) { mostrarToast("Plano atualizado.", "sucesso"); secaoPlanos(view); }
            if (acao === "regras") {
                const salvo = await abrirFormulario({
                    titulo: "Regras de cobrança",
                    campos: [
                        { nome: "dias_antecedencia", rotulo: "Gerar a fatura quantos dias antes do vencimento", tipo: "numero", obrigatorio: true, min: 0, max: 28, passo: 1 },
                        { nome: "dias_tolerancia", rotulo: "Suspender com quantos dias de atraso", tipo: "numero", obrigatorio: true, min: 1, max: 60, passo: 1 }
                    ],
                    valores: { dias_antecedencia: cfg.dias_antecedencia, dias_tolerancia: cfg.dias_tolerancia },
                    textoSalvar: "Salvar regras",
                    aoSalvar: (v) => rpc("salvar_config_cobranca", { p_dias_tolerancia: v.dias_tolerancia, p_dias_antecedencia: v.dias_antecedencia }).then(() => true)
                });
                if (salvo) { mostrarToast("Regras de cobrança atualizadas.", "sucesso"); secaoPlanos(view); }
            }
            if (acao === "rotina") {
                const ok = await confirmar({ titulo: "Executar a rotina de cobrança agora?", mensagem: "Gera as faturas do período, marca atrasos e suspende quem passou do prazo. Rodar mais de uma vez no mesmo dia não duplica nada.", textoConfirmar: "Executar" });
                if (!ok) return;
                const r = await rpc("executar_rotina_cobranca");
                mostrarToast(`Rotina concluída: ${numero(r.faturas_geradas)} fatura(s) gerada(s), ${numero(r.testes_encerrados)} teste(s) encerrado(s), ${numero(r.barbearias_suspensas)} suspensão(ões).`, "sucesso", 6000);
            }
        } catch (erro) {
            mostrarToast(erro.message, "erro");
        }
    });
}

export function render(view, { parametros = [] }) {
    if (parametros[0] === "planos") secaoPlanos(view);
    else secaoAssinaturas(view);
}
