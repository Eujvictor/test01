// =====================================================================
// MÓDULO 06 — AGENDAMENTOS E ATIVIDADE (MODO REAL)
// Rotas: #/atividade             → todas as barbearias
//        #/atividade/<uuid>      → uma barbearia
// Fonte: control_api.atividade_resumo e control_api.listar_agendamentos
// (administrador + MFA, validados no servidor). O telefone dos clientes
// não sai do banco.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, moeda, percentual } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { baixarCsv } from "../../js/utilities/csv.js";
import { criarTabela } from "../../js/components/tabela.js";
import { graficoBarras, barrasHorizontais } from "../../js/components/grafico.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, campoBusca, campoSelect, novaRaiz } from "../../js/components/ui.js";

const PERIODOS = [["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["180", "Últimos 180 dias"], ["365", "Últimos 12 meses"]];
export const STATUS_AG = {
    agendado: { rotulo: "Agendado", tom: "atencao" },
    pendente: { rotulo: "Pendente", tom: "atencao" },
    confirmado: { rotulo: "Confirmado", tom: "ouro" },
    finalizado: { rotulo: "Finalizado", tom: "sucesso" },
    concluido: { rotulo: "Concluído", tom: "sucesso" },
    realizado: { rotulo: "Realizado", tom: "sucesso" },
    cancelado: { rotulo: "Cancelado", tom: "erro" },
    cancelada: { rotulo: "Cancelado", tom: "erro" },
    nao_compareceu: { rotulo: "Não compareceu", tom: "erro" },
    sem_status: { rotulo: "Sem status", tom: "neutro" }
};
const filtros = { dias: "30", status: "", busca: "" };

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// "2026-11-19" → "19/11/2026" sem passar por Date (evita mudar o dia pelo fuso).
const dia = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const diaCurto = (s) => (s ? String(s).slice(5, 10).split("-").reverse().join("/") : "");
const hora = (h) => (h ? String(h).slice(0, 5) : "—");
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somarDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
const statusChave = (s) => normalizar(s || "sem_status");
// Contagens: o eixo só mostra números inteiros (evita "1, 1, 0" em escalas pequenas).
const eixoInteiro = (v) => (Number.isInteger(v) ? numero(v) : "");
const formatarAg = (v) =>`${numero(v)} agendamento${Number(v) === 1 ? "" : "s"}`;

function erroNaTela(raiz, erro, voltar) {
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Agendamentos e atividade", subtitulo: "Painel Master", voltar })}
        <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar os agendamentos", texto: erro.message })}</section>`);
}

function exportar(linhas, rotulo) {
    if (!linhas.length) return mostrarToast("Nada para exportar com os filtros atuais.", "atencao");
    baixarCsv(`agendamentos-${rotulo}-${isoLocal(new Date())}.csv`, [
        { rotulo: "Data", valor: (l) => dia(l.data) },
        { rotulo: "Horário", valor: (l) => hora(l.horario) },
        { rotulo: "Barbearia", valor: (l) => l.barbearia },
        { rotulo: "Cliente", valor: (l) => l.cliente ?? "" },
        { rotulo: "Serviço", valor: (l) => l.servico ?? "" },
        { rotulo: "Barbeiro", valor: (l) => l.barbeiro ?? "" },
        { rotulo: "Status", valor: (l) => STATUS_AG[statusChave(l.status)]?.rotulo ?? l.status ?? "" },
        { rotulo: "Preço (R$)", valor: (l) => (l.preco === null || l.preco === undefined ? "" : Number(l.preco)) }
    ], linhas);
    mostrarToast("Planilha CSV gerada.", "sucesso");
}

async function renderizarTela(view, barbeariaId) {
    const raiz = novaRaiz(view);
    const voltar = barbeariaId ? { href: "#/atividade", rotulo: "Todas as barbearias" } : null;
    renderizar(raiz, html`${cabecalho({ titulo: "Agendamentos e atividade", subtitulo: "Carregando do Supabase…", voltar })}`);

    const dias = Number(filtros.dias);
    const desde = somarDias(-(dias - 1));
    const ate = somarDias(30);
    let resumo, lista, barbearias;
    try {
        [resumo, lista, barbearias] = await Promise.all([
            rpc("atividade_resumo", { p_dias: dias, p_barbearia: barbeariaId ?? null }),
            rpc("listar_agendamentos", { p_desde: desde, p_ate: ate, p_barbearia: barbeariaId ?? null, p_status: null, p_limite: 1000 }),
            rpc("listar_barbearias")
        ]);
    } catch (erro) {
        return erroNaTela(raiz, erro, voltar);
    }

    const atual = barbeariaId ? barbearias.find((b) => b.id === barbeariaId) : null;
    if (barbeariaId && !atual) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Barbearia não encontrada", voltar })}
            <section class="card">${estadoVazio({ iconeNome: "store", titulo: "Registro inexistente" })}</section>`);
        return;
    }

    const total = Number(resumo.total);
    const cancelados = Number(resumo.cancelados);
    const naoVeio = Number(resumo.nao_compareceu);
    const porDia = (resumo.por_dia ?? []).map((d) => ({ rotulo: diaCurto(d.dia), rotuloLongo: dia(d.dia), valor: Number(d.total) }));
    const porHora = (resumo.por_hora ?? []).map((h) => ({ rotulo: `${h.hora}h`, rotuloLongo: `${h.hora}h às ${h.hora + 1}h`, valor: Number(h.total) }));
    const statusPresentes = [...new Set(lista.map((l) => statusChave(l.status)))].sort();

    renderizar(raiz, html`
        ${cabecalho({
            titulo: atual ? atual.nome : "Agendamentos e atividade",
            subtitulo: atual ? `Atividade da barbearia · ?b=${atual.slug}` : "Dados reais · todas as barbearias",
            voltar,
            acoes: html`
                ${atual ? html`<a class="btn" href="#/barbearias/${atual.id}">${icone("store")}<span>Abrir barbearia</span></a>` : ""}
                <button class="btn" type="button" data-acao="exportar">${icone("download")}<span>Exportar CSV</span></button>
                <button class="btn" type="button" data-acao="atualizar">${icone("refresh-cw")}<span class="btn__texto-opcional">Atualizar</span></button>`
        })}
        <div class="barra-filtros barra-filtros--solta">
            ${campoSelect({ id: "aPeriodo", rotulo: "Período", valor: filtros.dias, opcoes: PERIODOS })}
            ${barbeariaId ? "" : campoSelect({ id: "aBarbearia", rotulo: "Barbearia", valor: "", opcoes: [["", "Todas as barbearias"], ...barbearias.map((b) => [b.id, b.nome])] })}
        </div>
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Agendamentos", valor: numero(total), iconeNome: "calendar-check", nota: `${dia(resumo.desde)} a ${dia(resumo.ate)}`, destaque: true })}
            ${kpi({ rotulo: "Finalizados", valor: numero(resumo.finalizados), iconeNome: "circle-check", nota: total ? `${percentual(Number(resumo.finalizados) / total, 0)} do período` : "Sem agendamentos" })}
            ${kpi({ rotulo: "Cancelados", valor: numero(cancelados), iconeNome: "calendar-x", nota: total ? `Taxa de ${percentual(cancelados / total)}` : "Sem agendamentos" })}
            ${kpi({ rotulo: "Não compareceu", valor: numero(naoVeio), iconeNome: "user-x", nota: total ? `${percentual(naoVeio / total)} do período` : "Sem agendamentos" })}
            ${kpi({ rotulo: "Receita estimada", valor: moeda(resumo.receita_estimada), iconeNome: "wallet", nota: "Preço dos serviços finalizados" })}
            ${kpi({ rotulo: "Próximos 7 dias", valor: numero(resumo.proximos_7_dias), iconeNome: "calendar-clock", nota: "Já agendados, sem cancelados" })}
        </section>
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Agendamentos por dia</h2><span class="badge">pela data do horário</span></div>
            <div class="card__corpo">${total ? graficoBarras({ dados: porDia, formatar: formatarAg, formatarEixo: eixoInteiro, titulo: "Agendamentos por dia", largo: true })
                : estadoVazio({ iconeNome: "calendar", titulo: "Nenhum agendamento no período" })}</div>
        </section>
        <div class="grade grade--2 secao">
            ${barbeariaId ? html`
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Horários de pico</h2></div>
                <div class="card__corpo">${porHora.length ? graficoBarras({ dados: porHora, formatar: formatarAg, formatarEixo: eixoInteiro, titulo: "Agendamentos por hora" })
                    : estadoVazio({ iconeNome: "clock", titulo: "Sem dados no período" })}</div>
            </section>` : html`
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Barbearias mais ativas</h2></div>
                <div class="card__corpo">${resumo.por_barbearia?.length
                    ? barrasHorizontais({ itens: resumo.por_barbearia.map((b) => ({ rotulo: b.nome, valor: Number(b.total), link: `#/atividade/${b.id}` })), formatar: formatarAg, titulo: "Barbearias mais ativas" })
                    : estadoVazio({ iconeNome: "store", titulo: "Nenhuma barbearia com agendamentos no período" })}</div>
            </section>`}
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Serviços mais agendados</h2></div>
                <div class="card__corpo">${resumo.por_servico?.length
                    ? barrasHorizontais({ itens: resumo.por_servico.map((s) => ({ rotulo: s.nome, valor: Number(s.total) })), formatar: formatarAg, titulo: "Serviços mais agendados" })
                    : estadoVazio({ iconeNome: "scissors", titulo: "Sem dados no período" })}</div>
            </section>
        </div>
        ${barbeariaId ? "" : html`
        <section class="card secao">
            <div class="card__cabecalho"><h2 class="card__titulo">Horários de pico</h2><span class="badge">todas as barbearias</span></div>
            <div class="card__corpo">${porHora.length ? graficoBarras({ dados: porHora, formatar: formatarAg, formatarEixo: eixoInteiro, titulo: "Agendamentos por hora", largo: true })
                : estadoVazio({ iconeNome: "clock", titulo: "Sem dados no período" })}</div>
        </section>`}
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Agendamentos</h2>
                <span class="badge" title="Inclui os próximos 30 dias">${dia(desde)} a ${dia(ate)}</span>
            </div>
            <div class="barra-filtros">
                ${campoBusca({ id: "aBusca", valor: filtros.busca, placeholder: "Pesquisar cliente, serviço, barbeiro ou barbearia" })}
                ${campoSelect({ id: "aStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...statusPresentes.map((s) => [s, STATUS_AG[s]?.rotulo ?? s])] })}
            </div>
            <div data-tabela></div>
            ${lista.length >= 1000 ? html`<p class="texto-terc texto-pequeno">Mostrando os 1.000 mais recentes. Reduza o período para ver os demais.</p>` : ""}
        </section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "data", rotulo: "Data", valor: (l) => `${l.data} ${l.horario ?? ""}`, render: (l) => html`${dia(l.data)}<span class="celula-sub">${hora(l.horario)}</span>` },
            ...(barbeariaId ? [] : [{ chave: "barbearia", rotulo: "Barbearia", render: (l) => html`<a class="link-forte" href="#/atividade/${l.barbearia_id}">${l.barbearia}</a>` }]),
            { chave: "cliente", rotulo: "Cliente", render: (l) => l.cliente || "—" },
            { chave: "servico", rotulo: "Serviço", render: (l) => l.servico || "—" },
            { chave: "barbeiro", rotulo: "Barbeiro", render: (l) => l.barbeiro || "—" },
            { chave: "status", rotulo: "Status", valor: (l) => STATUS_AG[statusChave(l.status)]?.rotulo ?? l.status, render: (l) => badgeStatus(STATUS_AG, statusChave(l.status)) },
            { chave: "preco", rotulo: "Preço", classe: "col-num", valor: (l) => (l.preco === null ? null : Number(l.preco)), render: (l) => moeda(l.preco) }
        ],
        ordenacao: { chave: "data", direcao: "desc" }, vazio: "Nenhum agendamento com os filtros atuais.", rotulo: "Agendamentos"
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => lista.filter((l) =>
        (!filtros.status || statusChave(l.status) === filtros.status) &&
        (!filtros.busca || normalizar(`${l.cliente} ${l.servico} ${l.barbeiro} ${l.barbearia}`).includes(normalizar(filtros.busca))));
    tabela.definirLinhas(filtrar());

    raiz.querySelector("#aBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("#aStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("#aPeriodo").addEventListener("change", (e) => { filtros.dias = e.target.value; renderizarTela(view, barbeariaId); });
    raiz.querySelector("#aBarbearia")?.addEventListener("change", (e) => { if (e.target.value) window.location.hash = `#/atividade/${e.target.value}`; });
    raiz.addEventListener("click", (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        if (botao.dataset.acao === "atualizar") renderizarTela(view, barbeariaId);
        if (botao.dataset.acao === "exportar") exportar(filtrar(), atual ? atual.slug : "todas");
    });
}

export function render(view, { parametros = [] }) {
    renderizarTela(view, parametros[0] || null);
}
