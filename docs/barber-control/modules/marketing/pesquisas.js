// =====================================================================
// PESQUISAS DE SATISFAÇÃO — perguntas, respostas fictícias, NPS,
// satisfação média e sugestões recorrentes (por temas).
// Nenhum convite é enviado; respostas são simuladas e identificadas.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import * as O from "../../services/demo/operacao.js";
import { STATUS_PESQUISA, TIPOS_PERGUNTA, opcoes } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, percentual, dataHora } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { barrasHorizontais } from "../../js/components/grafico.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, kpi, estadoVazio, linhaDoTempo, novaRaiz
} from "../../js/components/ui.js";

const fmt1 = (v) => (v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

function campos() {
    const perguntas = [1, 2, 3, 4].flatMap((n) => [
        { nome: `pergunta${n}`, rotulo: `Pergunta ${n}`, tipo: "texto", obrigatorio: n === 1, maxlength: 160, largura: "meia" },
        { nome: `tipo${n}`, rotulo: `Tipo da pergunta ${n}`, tipo: "select", opcoes: opcoes(TIPOS_PERGUNTA), largura: "meia" }
    ]);
    return [
        { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, maxlength: 80 },
        { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, maxlength: 300 },
        { nome: "publico", rotulo: "Público", tipo: "select", obrigatorio: true, opcoes: O.opcoesPublico().filter(([v]) => v !== "especificas") },
        { tipo: "secao", rotulo: "Perguntas (até 4)" },
        ...perguntas
    ];
}

async function editar(id = null) {
    const atual = id ? O.pesquisa(id) : null;
    const valores = atual
        ? { titulo: atual.titulo, descricao: atual.descricao, publico: O.valorDoPublico(atual.publico),
            ...Object.fromEntries(atual.perguntas.flatMap((q, i) => [[`pergunta${i + 1}`, q.texto], [`tipo${i + 1}`, q.tipo]])) }
        : { publico: "todas", pergunta1: "De 0 a 10, quanto você recomendaria o Barber?", tipo1: "nps", tipo2: "escala", tipo3: "texto", tipo4: "texto" };
    const salvo = await abrirFormulario({
        titulo: atual ? "Editar pesquisa" : "Nova pesquisa",
        descricao: "A pesquisa é criada como rascunho. Nenhum convite é enviado.",
        campos: campos(), valores,
        textoSalvar: atual ? "Salvar pesquisa" : "Criar pesquisa",
        aoSalvar: (v) => O.salvarPesquisa(v, id)
    });
    if (salvo) {
        mostrarToast(atual ? "Pesquisa atualizada." : "Pesquisa criada como rascunho.", "sucesso");
        if (!atual) window.location.hash = `#/marketing/pesquisa/${salvo.id}`;
    }
    return Boolean(salvo);
}

async function executar(acao, id) {
    try {
        if (acao === "nova-pesquisa") return await editar();
        if (acao === "editar-pesquisa") return await editar(id);
        if (acao === "ativar-pesquisa") {
            if (!(await confirmar({ titulo: "Iniciar coleta?", mensagem: "Demonstração: nenhum convite é enviado às barbearias. Use \"Simular respostas\" para gerar respostas fictícias.", textoConfirmar: "Iniciar coleta" }))) return false;
            O.alterarStatusPesquisa(id, "ativa"); mostrarToast("Coleta iniciada (demonstração).", "sucesso"); return true;
        }
        if (acao === "simular-pesquisa") {
            const n = O.simularRespostas(id, 5);
            mostrarToast(`${n} respostas fictícias adicionadas.`, "sucesso");
            return true;
        }
        if (acao === "encerrar-pesquisa") {
            if (!(await confirmar({ titulo: "Encerrar coleta?", mensagem: "Os resultados ficam disponíveis para consulta.", textoConfirmar: "Encerrar" }))) return false;
            O.alterarStatusPesquisa(id, "encerrada"); mostrarToast("Coleta encerrada.", "sucesso"); return true;
        }
    } catch (falha) {
        mostrarToast(falha.message, "erro");
    }
    return false;
}

function cartaoPesquisa(p) {
    const ind = O.indicadoresPesquisa(p);
    return html`
        <article class="card pesquisa-card">
            <div class="card__cabecalho">
                <div><h3 class="card__titulo"><a class="link-forte" href="#/marketing/pesquisa/${p.id}">${p.titulo}</a></h3>
                    <span class="texto-terc texto-pequeno">${p.perguntas.length} perguntas · ${O.descreverPublico(p.publico)}</span></div>
                ${badgeStatus(STATUS_PESQUISA, p.status)}
            </div>
            <div class="card__corpo pesquisa-card__numeros">
                <div><span class="texto-terc">Respostas</span><strong class="num">${numero(ind.respostas)}</strong></div>
                <div><span class="texto-terc">NPS</span><strong class="num">${ind.nps?.nps ?? "—"}</strong></div>
                <div><span class="texto-terc">Satisfação</span><strong class="num">${fmt1(ind.satisfacaoMedia)}${ind.satisfacaoMedia ? html`<small>/5</small>` : ""}</strong></div>
                <a class="btn btn--pequeno" href="#/marketing/pesquisa/${p.id}">${icone("chart-column")}<span>Resultados</span></a>
            </div>
        </article>`;
}

export function renderSecao({ secao, atualizarIndicadores }) {
    const lista = O.pesquisas();
    renderizar(secao, html`
        <div class="secao__cabecalho">
            <h2 class="secao__titulo">Pesquisas de satisfação</h2>
            <button class="btn btn--primario btn--pequeno" type="button" data-acao="nova-pesquisa">${icone("plus")}<span>Nova pesquisa</span></button>
        </div>
        ${lista.length ? html`<div class="grade grade--planos">${lista.map(cartaoPesquisa)}</div>`
            : html`<section class="card">${estadoVazio({ iconeNome: "clipboard-list", titulo: "Nenhuma pesquisa criada" })}</section>`}`);
    secao.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (botao?.dataset.acao === "nova-pesquisa" && (await executar("nova-pesquisa"))) atualizarIndicadores();
    });
}

function resultadoPergunta(x) {
    const q = x.pergunta;
    if (q.tipo === "nps") {
        const total = x.quantidade || 1;
        return html`
            <div class="nps">
                <div class="nps__valor"><strong class="num">${x.nps ?? "—"}</strong><span class="texto-terc">NPS</span></div>
                ${barrasHorizontais({ titulo: "Distribuição NPS", formatar: (v) => `${numero(v)} (${percentual(v / total, 0)})`, itens: [
                    { rotulo: "Promotores (9–10)", valor: x.promotores }, { rotulo: "Neutros (7–8)", valor: x.neutros }, { rotulo: "Detratores (0–6)", valor: x.detratores }] })}
            </div>`;
    }
    if (q.tipo === "escala") {
        return html`
            <p class="texto-sec">Média <strong class="num">${fmt1(x.media)}</strong> de 5 · ${numero(x.quantidade)} respostas</p>
            ${barrasHorizontais({ titulo: q.texto, formatar: numero, itens: [5, 4, 3, 2, 1].map((n) => ({ rotulo: `${n} ${n === 1 ? "ponto" : "pontos"}`, valor: x.distribuicao[n - 1] })) })}`;
    }
    return x.textos.length
        ? html`<ul class="respostas-abertas">${x.textos.slice(0, 8).map((t) => html`<li>“${t}”</li>`)}</ul>${x.textos.length > 8 ? html`<p class="texto-terc">+${x.textos.length - 8} respostas</p>` : ""}`
        : html`<p class="texto-terc">Sem respostas abertas.</p>`;
}

export function renderDetalhe(view, id) {
    const raiz = novaRaiz(view);
    const p = O.pesquisa(id);
    if (!p) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Pesquisa não encontrada", voltar: { href: "#/marketing/pesquisas", rotulo: "Pesquisas" } })}
            <section class="card">${estadoVazio({ iconeNome: "clipboard-list", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const ind = O.indicadoresPesquisa(p);
    const simuladas = p.respostas.filter((r) => r.simulada).length;

    renderizar(raiz, html`
        ${cabecalho({
            titulo: p.titulo,
            voltar: { href: "#/marketing/pesquisas", rotulo: "Pesquisas" },
            extra: badgeStatus(STATUS_PESQUISA, p.status),
            subtitulo: p.descricao,
            acoes: html`
                ${p.status === "rascunho" ? html`
                    <button class="btn" type="button" data-acao="editar-pesquisa" data-id="${p.id}">${icone("pencil")}<span>Editar</span></button>
                    <button class="btn btn--primario" type="button" data-acao="ativar-pesquisa" data-id="${p.id}">${icone("circle-play")}<span>Iniciar coleta</span></button>` : ""}
                ${p.status === "ativa" ? html`
                    <button class="btn" type="button" data-acao="simular-pesquisa" data-id="${p.id}">${icone("flask-conical")}<span>Simular respostas</span></button>
                    <button class="btn btn--primario" type="button" data-acao="encerrar-pesquisa" data-id="${p.id}">${icone("circle-stop")}<span>Encerrar coleta</span></button>` : ""}`
        })}
        ${avisoDemo()}
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Respostas", valor: numero(ind.respostas), iconeNome: "message-square", nota: `Fictícias${simuladas ? ` · ${simuladas} geradas agora` : ""}` })}
            ${kpi({ rotulo: "Taxa de resposta", valor: percentual(ind.taxaResposta, 0), iconeNome: "percent", nota: `${numero(ind.publicoAlvo)} barbearias no público` })}
            ${kpi({ rotulo: "NPS", valor: ind.nps?.nps ?? "—", iconeNome: "gauge", nota: ind.nps ? "Promotores − detratores (%)" : "Sem pergunta NPS", destaque: true })}
            ${kpi({ rotulo: "Satisfação média", valor: ind.satisfacaoMedia === null ? "—" : `${fmt1(ind.satisfacaoMedia)}/5`, iconeNome: "star", nota: "Perguntas de escala" })}
        </section>
        ${ind.respostas ? html`
            <div class="grade grade--2 grade--2-igual secao">
                ${ind.porPergunta.map((x) => html`
                    <section class="card">
                        <div class="card__cabecalho"><h2 class="card__titulo">${x.pergunta.texto}</h2><span class="badge">${TIPOS_PERGUNTA[x.pergunta.tipo]}</span></div>
                        <div class="card__corpo">${resultadoPergunta(x)}</div>
                    </section>`)}
            </div>` : html`<section class="card secao">${estadoVazio({ iconeNome: "message-square", titulo: "Ainda sem respostas", texto: p.status === "rascunho" ? "Inicie a coleta e use \"Simular respostas\" para gerar respostas fictícias." : "Use \"Simular respostas\" para gerar respostas fictícias." })}</section>`}
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Sugestões recorrentes</h2><span class="texto-terc">Temas nas respostas abertas</span></div>
                <div class="card__corpo">${ind.temas.length
                    ? barrasHorizontais({ titulo: "Sugestões recorrentes", formatar: (v) => `${v} menç${v === 1 ? "ão" : "ões"}`, itens: ind.temas.map((t) => ({ rotulo: t.tema, valor: t.quantidade })) })
                    : html`<p class="texto-terc">Nenhum tema identificado.</p>`}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                <div class="card__corpo">${linhaDoTempo(O.historicoDe("pesquisa", p.id))}</div>
            </section>
        </div>
        ${ind.respostas ? html`
            <section class="card secao-topo">
                <div class="card__cabecalho"><h2 class="card__titulo">Respondentes</h2><span class="badge">${numero(ind.respostas)}</span></div>
                <ul class="lista">${p.respostas.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10).map((r) => html`
                    <li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/barbearias/${r.barbeariaId}">${S.barbearia(r.barbeariaId)?.nome ?? "—"}</a>
                    <div class="lista__meta">${dataHora(r.data)}${r.simulada ? " · resposta simulada" : " · resposta fictícia"}</div></div></li>`)}</ul>
            </section>` : ""}`);

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        if (botao.dataset.acao === "restaurar-demo") return tratarRestauracaoDemo(() => renderDetalhe(view, id));
        if (await executar(botao.dataset.acao, botao.dataset.id)) renderDetalhe(view, id);
    });
}
