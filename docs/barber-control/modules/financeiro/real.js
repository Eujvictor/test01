// =====================================================================
// MÓDULO 04 — FINANCEIRO (MODO REAL)
// Rotas: #/financeiro           → todas as barbearias
//        #/financeiro/<uuid>    → faturas de uma barbearia
// Receita do SaaS: faturas mensais pagas pelo Mercado Pago (o aviso de
// pagamento é conferido no servidor) ou baixadas manualmente pelo Master.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda, dataHora, mesReferencia } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { baixarCsv } from "../../js/utilities/csv.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { graficoBarras, barrasHorizontais } from "../../js/components/grafico.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, botaoIcone, campoBusca, campoSelect, novaRaiz } from "../../js/components/ui.js";

const SITUACAO = {
    aberta: { rotulo: "A vencer", tom: "atencao" },
    vencida: { rotulo: "Vencida", tom: "erro" },
    paga: { rotulo: "Paga", tom: "sucesso" },
    cancelada: { rotulo: "Cancelada", tom: "neutro" }
};
const METODOS = { pix: "Pix", cartao: "Cartão", boleto: "Boleto", dinheiro: "Dinheiro", transferencia: "Transferência", outro: "Outro" };
const filtros = { situacao: "", busca: "" };

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dia = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const eixoMoeda = (v) => (v >= 1000 ? `R$ ${numero(Math.round(v / 100) / 10)} mil` : moeda(v));

function erroNaTela(raiz, erro, voltar) {
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Financeiro", subtitulo: "Painel Master", voltar })}
        <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar o financeiro", texto: erro.message })}</section>`);
}

async function renderizarTela(view, barbeariaId) {
    const raiz = novaRaiz(view);
    const voltar = barbeariaId ? { href: "#/financeiro", rotulo: "Todas as barbearias" } : null;
    renderizar(raiz, html`${cabecalho({ titulo: "Financeiro", subtitulo: "Carregando do Supabase…", voltar })}`);
    let resumo, faturas, informados;
    try {
        [resumo, faturas, informados] = await Promise.all([
            rpc("financeiro_resumo", { p_meses: 12 }),
            rpc("listar_faturas", { p_barbearia: barbeariaId ?? null, p_situacao: null, p_desde: null, p_ate: null, p_limite: 2000 }),
            rpc("pagamentos_informados").catch(() => [])
        ]);
        if (barbeariaId) informados = informados.filter((i) => i.barbearia_id === barbeariaId);
    } catch (erro) {
        return erroNaTela(raiz, erro, voltar);
    }
    const nomeBarbearia = barbeariaId ? (faturas[0]?.barbearia ?? "Barbearia") : null;
    const liquido = Number(resumo.recebido_mes) - Number(resumo.taxas_mes);
    const porMes = (resumo.por_mes ?? []).map((m) => ({ rotulo: mesReferencia(m.mes), rotuloLongo: mesReferencia(m.mes, true), valor: Number(m.recebido) }));
    const algumRecebido = porMes.some((m) => m.valor > 0);

    renderizar(raiz, html`
        ${cabecalho({
            titulo: nomeBarbearia ? `Faturas · ${nomeBarbearia}` : "Financeiro",
            subtitulo: nomeBarbearia ? "Histórico de cobrança da barbearia" : "Receita do Barber · Pix e baixas manuais",
            voltar,
            acoes: html`
                <a class="btn" href="#/assinaturas">${icone("badge-check")}<span>Assinaturas</span></a>
                <button class="btn" type="button" data-acao="exportar">${icone("download")}<span>Exportar CSV</span></button>
                <button class="btn" type="button" data-acao="atualizar">${icone("refresh-cw")}<span class="btn__texto-opcional">Atualizar</span></button>`
        })}
        ${informados.length ? html`
        <section class="card secao card--destaque-pix">
            <div class="card__cabecalho"><h2 class="card__titulo">Pix informados para conferir</h2><span class="badge badge--atencao">${numero(informados.length)}</span></div>
            <p class="card__corpo texto-sec texto-pequeno">O dono tocou em “Já paguei”. Confira no extrato do seu banco e confirme. Enquanto você não confere, a suspensão automática espera até 3 dias.</p>
            <ul class="lista">
                ${informados.map((i) => html`
                    <li class="lista__item">
                        <span class="lista__icone">${icone("qr-code")}</span>
                        <div class="lista__conteudo">
                            <div class="lista__titulo">${i.barbearia} · ${moeda(i.valor)}</div>
                            <div class="lista__meta">Vencimento ${dia(i.vencimento)} · avisado ${dataHora(i.informado_em)}${i.informado_por ? ` por ${i.informado_por}` : ""}${i.observacao ? ` · “${i.observacao}”` : ""}</div>
                        </div>
                        <div class="acoes-linha">
                            <button class="btn btn--primario btn--pequeno" type="button" data-acao="confirmar-pix" data-id="${i.fatura_id}">${icone("check")}<span>Confirmar</span></button>
                            <button class="btn btn--pequeno" type="button" data-acao="recusar-pix" data-id="${i.fatura_id}">${icone("x")}<span>Não encontrei</span></button>
                        </div>
                    </li>`)}
            </ul>
        </section>` : ""}
        ${barbeariaId ? "" : html`
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Receita recorrente mensal", valor: moeda(resumo.mrr), iconeNome: "trending-up", nota: `Anual: ${moeda(Number(resumo.mrr) * 12)}`, destaque: true })}
            ${kpi({ rotulo: "Recebido no mês", valor: moeda(resumo.recebido_mes), iconeNome: "wallet", nota: `Líquido: ${moeda(liquido)}` })}
            ${kpi({ rotulo: "Taxas do Mercado Pago", valor: moeda(resumo.taxas_mes), iconeNome: "percent", nota: "No mês" })}
            ${kpi({ rotulo: "A vencer", valor: moeda(resumo.em_aberto), iconeNome: "hourglass", nota: "Faturas em aberto no prazo" })}
            ${kpi({ rotulo: "Vencido", valor: moeda(resumo.vencido), iconeNome: "alarm-clock", nota: `${numero(resumo.faturas_vencidas)} fatura(s)` })}
        </section>
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Recebido por mês</h2><span class="badge">12 meses</span></div>
                <div class="card__corpo">${algumRecebido ? graficoBarras({ dados: porMes, formatar: moeda, formatarEixo: eixoMoeda, titulo: "Recebido por mês" })
                    : estadoVazio({ iconeNome: "wallet", titulo: "Nenhum pagamento recebido ainda", texto: "Os pagamentos aparecem aqui assim que o Mercado Pago confirmar." })}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Receita recorrente por plano</h2></div>
                <div class="card__corpo">${resumo.por_plano?.length
                    ? barrasHorizontais({ itens: resumo.por_plano.map((p) => ({ rotulo: `${p.plano} · ${numero(p.assinaturas)} barbearia(s)`, valor: Number(p.mrr) })), formatar: moeda, titulo: "Receita por plano" })
                    : estadoVazio({ iconeNome: "badge-check", titulo: "Nenhuma assinatura paga ainda" })}</div>
            </section>
        </div>`}
        <section class="card">
            <div class="card__cabecalho"><h2 class="card__titulo">Faturas</h2></div>
            <div class="barra-filtros">
                ${barbeariaId ? "" : campoBusca({ id: "fBusca", valor: filtros.busca, placeholder: "Pesquisar barbearia ou plano" })}
                ${campoSelect({ id: "fSituacao", rotulo: "Situação", valor: filtros.situacao, opcoes: [["", "Todas as situações"], ...Object.entries(SITUACAO).map(([k, v]) => [k, v.rotulo])] })}
            </div>
            <div data-tabela></div>
        </section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "vencimento", rotulo: "Vencimento", render: (f) => html`${dia(f.vencimento)}${f.dias_atraso ? html`<span class="celula-sub">${numero(f.dias_atraso)} dia(s) de atraso</span>` : ""}` },
            ...(barbeariaId ? [] : [{ chave: "barbearia", rotulo: "Barbearia", render: (f) => html`<a class="link-forte" href="#/financeiro/${f.barbearia_id}">${f.barbearia}</a>` }]),
            { chave: "plano", rotulo: "Plano" },
            { chave: "valor", rotulo: "Valor", classe: "col-num", valor: (f) => Number(f.valor), render: (f) => moeda(f.valor) },
            { chave: "situacao", rotulo: "Situação", valor: (f) => SITUACAO[f.situacao]?.rotulo, render: (f) => badgeStatus(SITUACAO, f.situacao) },
            { chave: "pago_em", rotulo: "Pagamento", valor: (f) => f.pago_em ?? "", render: (f) => (f.pago_em ? html`${dataHora(f.pago_em)}<span class="celula-sub">${METODOS[f.metodo] ?? f.metodo ?? ""}${Number(f.taxa) ? ` · taxa ${moeda(f.taxa)}` : ""}${f.mp_pagamento_id ? ` · MP ${f.mp_pagamento_id}` : ""}</span>` : (f.observacao ? html`<span class="celula-sub">${f.observacao}</span>` : "—")) },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (f) => (f.status === "aberta" ? html`
                ${botaoIcone({ acao: "baixar", id: f.id, nomeIcone: "check-check", rotulo: "Marcar como paga (baixa manual)" })}
                ${botaoIcone({ acao: "cancelar", id: f.id, nomeIcone: "ban", rotulo: "Cancelar fatura", perigo: true })}` : "") }
        ],
        ordenacao: { chave: "vencimento", direcao: "desc" }, vazio: "Nenhuma fatura com os filtros atuais.", rotulo: "Faturas"
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => faturas.filter((f) =>
        (!filtros.situacao || f.situacao === filtros.situacao) &&
        (!filtros.busca || normalizar(`${f.barbearia} ${f.plano}`).includes(normalizar(filtros.busca))));
    tabela.definirLinhas(filtrar());
    raiz.querySelector("#fBusca")?.addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("#fSituacao").addEventListener("change", (e) => { filtros.situacao = e.target.value; tabela.definirLinhas(filtrar()); });

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao } = botao.dataset;
        const f = faturas.find((x) => x.id === botao.dataset.id);
        try {
            if (acao === "atualizar") return renderizarTela(view, barbeariaId);
            if (acao === "exportar") {
                const linhas = filtrar();
                if (!linhas.length) return mostrarToast("Nada para exportar com os filtros atuais.", "atencao");
                baixarCsv(`faturas-${isoLocal(new Date())}.csv`, [
                    { rotulo: "Vencimento", valor: (x) => dia(x.vencimento) },
                    { rotulo: "Barbearia", valor: (x) => x.barbearia },
                    { rotulo: "Plano", valor: (x) => x.plano },
                    { rotulo: "Valor (R$)", valor: (x) => Number(x.valor) },
                    { rotulo: "Situação", valor: (x) => SITUACAO[x.situacao]?.rotulo ?? x.situacao },
                    { rotulo: "Pago em", valor: (x) => (x.pago_em ? dataHora(x.pago_em) : "") },
                    { rotulo: "Método", valor: (x) => METODOS[x.metodo] ?? x.metodo ?? "" },
                    { rotulo: "Valor pago (R$)", valor: (x) => (x.valor_pago === null ? "" : Number(x.valor_pago)) },
                    { rotulo: "Taxa (R$)", valor: (x) => (x.taxa === null ? "" : Number(x.taxa)) },
                    { rotulo: "Pagamento Mercado Pago", valor: (x) => x.mp_pagamento_id ?? "" },
                    { rotulo: "Observação", valor: (x) => x.observacao ?? "" }
                ], linhas);
                return mostrarToast("Planilha CSV gerada.", "sucesso");
            }
            if (acao === "confirmar-pix") {
                const i = informados.find((x) => x.fatura_id === botao.dataset.id);
                const ok = await confirmar({
                    titulo: "Confirmar o recebimento?",
                    mensagem: `Você encontrou no seu banco o Pix de ${moeda(i.valor)} da ${i.barbearia}? A fatura fica paga e, se a barbearia estava suspensa por atraso, ela volta ao ar.`,
                    textoConfirmar: "Confirmar recebimento"
                });
                if (!ok) return;
                const r = await rpc("marcar_fatura_paga", { p_fatura: i.fatura_id, p_metodo: "pix", p_observacao: "Pix direto conferido no extrato" });
                mostrarToast(r === "paga" ? "Pagamento confirmado." : "A fatura já estava paga ou cancelada.", r === "paga" ? "sucesso" : "atencao");
                return renderizarTela(view, barbeariaId);
            }
            if (acao === "recusar-pix") {
                const i = informados.find((x) => x.fatura_id === botao.dataset.id);
                const salvo = await abrirFormulario({
                    titulo: `Pix não encontrado · ${i.barbearia}`,
                    descricao: "O dono verá este motivo em “Minha assinatura” e poderá avisar de novo depois de pagar.",
                    campos: [{ nome: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true, maxlength: 300, validar: (v) => (v.trim().length >= 3 ? null : "Descreva o motivo.") }],
                    valores: { motivo: "Não encontrei o Pix no extrato." },
                    textoSalvar: "Enviar ao dono",
                    aoSalvar: (v) => rpc("recusar_pagamento_informado", { p_fatura: i.fatura_id, p_motivo: v.motivo }).then(() => true)
                });
                if (salvo) { mostrarToast("Aviso devolvido ao dono.", "sucesso"); renderizarTela(view, barbeariaId); }
                return;
            }
            if (acao === "baixar") {
                const salvo = await abrirFormulario({
                    titulo: `Baixa manual · ${f.barbearia}`,
                    descricao: `Fatura de ${moeda(f.valor)} com vencimento em ${dia(f.vencimento)}. Use só para pagamentos recebidos fora do Mercado Pago. Se a barbearia estava suspensa por atraso, ela volta ao ar.`,
                    campos: [
                        { nome: "metodo", rotulo: "Como foi pago", tipo: "select", obrigatorio: true, opcoes: [["pix", "Pix direto"], ["transferencia", "Transferência"], ["dinheiro", "Dinheiro"], ["cartao", "Cartão"], ["boleto", "Boleto"], ["outro", "Outro"]] },
                        { nome: "observacao", rotulo: "Observação (fica na auditoria)", tipo: "textarea", maxlength: 300 }
                    ],
                    textoSalvar: "Confirmar pagamento",
                    aoSalvar: (v) => rpc("marcar_fatura_paga", { p_fatura: f.id, p_metodo: v.metodo, p_observacao: v.observacao || null })
                });
                if (salvo) { mostrarToast(salvo === "paga" ? "Fatura marcada como paga." : "A fatura já estava paga ou cancelada.", salvo === "paga" ? "sucesso" : "atencao"); renderizarTela(view, barbeariaId); }
            }
            if (acao === "cancelar") {
                const salvo = await abrirFormulario({
                    titulo: `Cancelar fatura · ${f.barbearia}`,
                    descricao: `Fatura de ${moeda(f.valor)} com vencimento em ${dia(f.vencimento)}. Ela deixa de ser cobrada.`,
                    campos: [{ nome: "motivo", rotulo: "Motivo (fica na auditoria)", tipo: "textarea", obrigatorio: true, maxlength: 300, validar: (v) => (v.trim().length >= 3 ? null : "Descreva o motivo.") }],
                    textoSalvar: "Cancelar fatura", perigo: true,
                    aoSalvar: (v) => rpc("cancelar_fatura", { p_fatura: f.id, p_motivo: v.motivo }).then(() => true)
                });
                if (salvo) { mostrarToast("Fatura cancelada.", "sucesso"); renderizarTela(view, barbeariaId); }
            }
        } catch (erro) {
            mostrarToast(erro.message, "erro");
        }
    });
}

export function render(view, { parametros = [] }) {
    renderizarTela(view, parametros[0] || null);
}
