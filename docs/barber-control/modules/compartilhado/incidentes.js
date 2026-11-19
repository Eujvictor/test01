// =====================================================================
// INCIDENTES — componente compartilhado pelos módulos 10 (segurança)
// e 11 (técnicos). Lista com filtros, registro, detalhe, gravidade,
// status, providências, encerramento e vínculo com chamados.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import * as O from "../../services/demo/operacao.js";
import * as I from "../../services/demo/infra.js";
import {
    GRAVIDADES, STATUS_INCIDENTE, CATEGORIAS_INCIDENTE_SEG, CATEGORIAS_INCIDENTE_TEC, STATUS_CHAMADO, opcoes
} from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { dataHora, tempoRelativo, numero } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, badgeStatus, estadoVazio, listaDefinicao, linhaDoTempo, botaoIcone, campoBusca, campoSelect, novaRaiz
} from "../../js/components/ui.js";

const CONFIG = {
    seguranca: { categorias: CATEGORIAS_INCIDENTE_SEG, rota: "#/seguranca/incidente", voltar: { href: "#/seguranca/incidentes", rotulo: "Incidentes de segurança" } },
    tecnico: { categorias: CATEGORIAS_INCIDENTE_TEC, rota: "#/monitoramento/incidente", voltar: { href: "#/monitoramento/incidentes", rotulo: "Incidentes técnicos" } }
};

const filtrosPorTipo = {
    seguranca: { busca: "", gravidade: "", status: "", dias: "" },
    tecnico: { busca: "", gravidade: "", status: "", dias: "", servico: "" }
};

const dataHoje = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function registrar(tipo) {
    const empresas = [...S.barbearias()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const campos = [
        { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, maxlength: 100 },
        { nome: "categoria", rotulo: "Categoria", tipo: "select", obrigatorio: true, opcoes: opcoes(CONFIG[tipo].categorias), largura: "meia" },
        { nome: "gravidade", rotulo: "Gravidade", tipo: "select", obrigatorio: true, opcoes: opcoes(GRAVIDADES), largura: "meia",
            ajuda: "Alta ou crítica gera um alerta automaticamente." },
        ...(tipo === "tecnico" ? [{ nome: "servico", rotulo: "Serviço afetado", tipo: "select", obrigatorio: true, placeholderOpcao: "Selecione", largura: "meia",
            opcoes: I.servicos().map((s) => [s.chave, s.nome]) }] : []),
        { nome: "barbeariaId", rotulo: tipo === "seguranca" ? "Empresa associada" : "Empresa afetada (opcional)", tipo: "select", largura: "meia",
            opcoes: [["", "Nenhuma / plataforma"], ...empresas.map((b) => [b.id, b.nome])] },
        { nome: "ocorridoEm", rotulo: "Data da ocorrência", tipo: "data", obrigatorio: true, largura: "meia",
            validar: (v) => (v > dataHoje() ? "A data não pode estar no futuro." : null) },
        { nome: "descricao", rotulo: "Descrição da ocorrência", tipo: "textarea", obrigatorio: true, maxlength: 1500, validar: (v) => (v.length < 10 ? "Descreva com pelo menos 10 caracteres." : null) }
    ];
    const novo = await abrirFormulario({
        titulo: tipo === "seguranca" ? "Registrar incidente de segurança" : "Registrar incidente técnico",
        descricao: "Registro demonstrativo. Nenhuma ação real é executada na infraestrutura.",
        campos, valores: { gravidade: "media", ocorridoEm: dataHoje() }, textoSalvar: "Registrar incidente",
        aoSalvar: (v) => I.registrarIncidente(tipo, v)
    });
    if (novo) {
        mostrarToast(`Incidente ${novo.codigo} registrado${novo.gravidade === "alta" || novo.gravidade === "critica" ? " e alerta gerado" : ""}.`, "sucesso");
        window.location.hash = `${CONFIG[tipo].rota}/${novo.id}`;
    }
    return Boolean(novo);
}

async function acao(tipo, nome, id) {
    const i = I.incidente(tipo, id);
    const formularios = {
        status: () => abrirFormulario({
            titulo: "Alterar status", descricao: `${i.codigo} · atual: ${STATUS_INCIDENTE[i.status].rotulo}`,
            campos: [
                { nome: "status", rotulo: "Novo status", tipo: "select", obrigatorio: true, opcoes: opcoes(STATUS_INCIDENTE).filter(([v]) => v !== "encerrado") },
                { nome: "comentario", rotulo: "Comentário", tipo: "textarea", maxlength: 300 }
            ],
            valores: { status: i.status }, textoSalvar: "Alterar status",
            aoSalvar: (v) => I.alterarStatusIncidente(tipo, id, v.status, v.comentario)
        }),
        gravidade: () => abrirFormulario({
            titulo: "Alterar gravidade", descricao: `${i.codigo} · atual: ${GRAVIDADES[i.gravidade].rotulo}`,
            campos: [{ nome: "gravidade", rotulo: "Nova gravidade", tipo: "select", obrigatorio: true, opcoes: opcoes(GRAVIDADES) }],
            valores: { gravidade: i.gravidade }, textoSalvar: "Alterar gravidade",
            aoSalvar: (v) => I.alterarGravidade(tipo, id, v.gravidade)
        }),
        encerrar: () => abrirFormulario({
            titulo: `Encerrar ${i.codigo}`, descricao: "Registre o resumo da solução. O incidente fica disponível no histórico.",
            campos: [{ nome: "resumo", rotulo: "Resumo do encerramento", tipo: "textarea", obrigatorio: true, maxlength: 500 }],
            textoSalvar: "Encerrar incidente", perigo: true,
            aoSalvar: (v) => I.encerrarIncidente(tipo, id, v.resumo)
        }),
        chamado: () => abrirFormulario({
            titulo: "Vincular chamado de suporte", descricao: "Relacione o incidente a um chamado do módulo Suporte.",
            campos: [{ nome: "chamadoId", rotulo: "Chamado", tipo: "select", obrigatorio: true, placeholderOpcao: "Selecione",
                opcoes: O.chamados().slice().sort((a, b) => b.abertoEm.localeCompare(a.abertoEm)).map((c) => [c.id, `${c.protocolo} · ${c.titulo} (${S.barbearia(c.barbeariaId)?.nome ?? "—"})`]) }],
            valores: { chamadoId: i.chamadoId ?? "" }, textoSalvar: "Vincular",
            aoSalvar: (v) => I.vincularChamado(id, v.chamadoId)
        })
    };
    const ok = await formularios[nome]();
    if (ok) mostrarToast({ status: "Status atualizado.", gravidade: "Gravidade atualizada.", encerrar: "Incidente encerrado.", chamado: "Chamado vinculado." }[nome], "sucesso");
    return Boolean(ok);
}

// ---------------------------------------------------------------------
// Lista (renderizada dentro da seção de um módulo)
// ---------------------------------------------------------------------
export function renderLista(secao, tipo, aoMudar) {
    const filtros = filtrosPorTipo[tipo];
    const categorias = CONFIG[tipo].categorias;
    renderizar(secao, html`
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">${tipo === "seguranca" ? "Central de incidentes de segurança" : "Central de incidentes técnicos"}</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-inc="novo">${icone("plus")}<span>Registrar incidente</span></button>
            </div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fIncBusca", valor: filtros.busca, placeholder: "Pesquisar código ou título" })}
                ${campoSelect({ id: "fIncDias", rotulo: "Período", valor: filtros.dias, opcoes: [["", "Todo o período"], ["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"]] })}
                ${tipo === "tecnico" ? campoSelect({ id: "fIncServico", rotulo: "Serviço", valor: filtros.servico, opcoes: [["", "Todos os serviços"], ...I.servicos().map((s) => [s.chave, s.nome])] }) : ""}
                ${campoSelect({ id: "fIncGravidade", rotulo: "Gravidade", valor: filtros.gravidade, opcoes: [["", "Todas as gravidades"], ...opcoes(GRAVIDADES)] })}
                ${campoSelect({ id: "fIncStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_INCIDENTE)] })}
            </div>
            <div data-tabela></div>
        </section>`);

    const linhas = () => (tipo === "tecnico"
        ? I.filtrarIncidentesTec(filtros)
        : I.incidentes("seguranca").filter((i) =>
            (!filtros.busca || `${i.codigo} ${i.titulo}`.toLowerCase().includes(filtros.busca.toLowerCase())) &&
            (!filtros.gravidade || i.gravidade === filtros.gravidade) && (!filtros.status || i.status === filtros.status) &&
            (!filtros.dias || new Date(i.abertoEm) >= Date.now() - Number(filtros.dias) * 86400000)));

    const tabela = criarTabela({
        colunas: [
            { chave: "codigo", rotulo: "Código", render: (i) => html`<a class="link-forte num" href="${CONFIG[tipo].rota}/${i.id}">${i.codigo}</a>` },
            { chave: "titulo", rotulo: "Incidente", render: (i) => html`${i.titulo}<span class="celula-sub">${categorias[i.categoria]}</span>` },
            tipo === "tecnico"
                ? { chave: "servico", rotulo: "Serviço", valor: (i) => I.servico(`sv_${i.servico}`)?.nome ?? "", render: (i) => I.servico(`sv_${i.servico}`)?.nome ?? "—" }
                : { chave: "empresa", rotulo: "Empresa", valor: (i) => S.barbearia(i.barbeariaId)?.nome ?? "", render: (i) => S.barbearia(i.barbeariaId)?.nome ?? "Plataforma" },
            { chave: "gravidade", rotulo: "Gravidade", valor: (i) => GRAVIDADES[i.gravidade].peso, render: (i) => badgeStatus(GRAVIDADES, i.gravidade) },
            { chave: "abertoEm", rotulo: "Data", render: (i) => html`<span title="${dataHora(i.abertoEm)}">${tempoRelativo(i.abertoEm)}</span>` },
            { chave: "status", rotulo: "Status", valor: (i) => STATUS_INCIDENTE[i.status].rotulo, render: (i) => badgeStatus(STATUS_INCIDENTE, i.status) },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (i) => botaoIcone({ acao: "ver-incidente", id: i.id, nomeIcone: "eye", rotulo: `Ver ${i.codigo}` }) }
        ],
        ordenacao: { chave: "abertoEm", direcao: "desc" }, vazio: "Nenhum incidente para os filtros selecionados.", rotulo: "Incidentes"
    });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    tabela.definirLinhas(linhas());

    let espera;
    secao.querySelector("#fIncBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { filtros.busca = e.target.value; tabela.definirLinhas(linhas()); }, 150);
    });
    [["#fIncDias", "dias"], ["#fIncServico", "servico"], ["#fIncGravidade", "gravidade"], ["#fIncStatus", "status"]].forEach(([sel, chave]) =>
        secao.querySelector(sel)?.addEventListener("change", (e) => { filtros[chave] = e.target.value; tabela.definirLinhas(linhas()); }));
    secao.addEventListener("click", async (e) => {
        if (e.target.closest("[data-inc=novo]")) { if (await registrar(tipo)) aoMudar?.(); return; }
        const ver = e.target.closest("[data-acao=ver-incidente]");
        if (ver) window.location.hash = `${CONFIG[tipo].rota}/${ver.dataset.id}`;
    });
}

// ---------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------
export function renderDetalhe(view, tipo, id) {
    const raiz = novaRaiz(view);
    const i = I.incidente(tipo, id);
    const cfg = CONFIG[tipo];
    if (!i) {
        renderizar(raiz, html`${cabecalho({ titulo: "Incidente não encontrado", voltar: cfg.voltar })}
            <section class="card">${estadoVazio({ iconeNome: "shield-alert", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const b = S.barbearia(i.barbeariaId);
    const ch = i.chamadoId ? O.chamado(i.chamadoId) : null;
    const svc = i.servico ? I.servico(`sv_${i.servico}`) : null;
    const encerrado = i.status === "encerrado";
    const alertas = I.alertas().filter((a) => a.referencia?.id === i.id);

    renderizar(raiz, html`
        ${cabecalho({
            titulo: i.titulo, voltar: cfg.voltar,
            extra: html`${badgeStatus(STATUS_INCIDENTE, i.status)}${badgeStatus(GRAVIDADES, i.gravidade)}`,
            subtitulo: `${i.codigo} · ${cfg.categorias[i.categoria]} · registrado em ${dataHora(i.abertoEm)}`,
            acoes: html`
                <button class="btn" type="button" data-inc="status">${icone("refresh-cw")}<span>Alterar status</span></button>
                <button class="btn" type="button" data-inc="gravidade">${icone("gauge")}<span>Gravidade</span></button>
                ${tipo === "tecnico" ? html`<button class="btn" type="button" data-inc="chamado">${icone("link")}<span>Vincular chamado</span></button>` : ""}
                ${!encerrado ? html`<button class="btn btn--perigo" type="button" data-inc="encerrar">${icone("circle-stop")}<span>Encerrar</span></button>` : ""}`
        })}
        ${avisoDemo()}
        <div class="layout-detalhe">
            <div class="layout-detalhe__principal">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Descrição da ocorrência</h2></div>
                    <div class="card__corpo"><p class="texto-corrido">${i.descricao}</p></div>
                </section>
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Providências</h2><span class="badge">${numero(i.providencias.length)}</span></div>
                    <div class="card__corpo">
                        ${i.providencias.length ? html`<ul class="notas">${i.providencias.map((p) => html`<li class="nota"><p>${p.texto}</p><span class="texto-terc">${dataHora(p.data)}</span></li>`)}</ul>`
                            : html`<p class="texto-terc">Nenhuma providência registrada.</p>`}
                        ${encerrado ? html`<div class="alerta alerta--info">${icone("lock")}<span>Incidente encerrado. Altere o status para registrar novas providências.</span></div>` : html`
                            <form class="resposta" data-form="providencia" novalidate>
                                <label class="campo"><span class="campo__rotulo">Registrar providência</span>
                                    <textarea class="entrada entrada--area" name="texto" rows="2" maxlength="800" placeholder="O que foi feito?"></textarea>
                                    <span class="campo__erro" data-erro></span></label>
                                <div class="resposta__acoes"><span class="campo__ajuda">Registro demonstrativo; nenhuma ação real é executada.</span>
                                    <button class="btn btn--primario" type="submit">${icone("clipboard-check")}<span>Registrar</span></button></div>
                            </form>`}
                    </div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Histórico</h2></div>
                    <div class="card__corpo">${linhaDoTempo(I.historicoIncidente(tipo, i.id))}</div>
                </section>
            </div>
            <aside class="layout-detalhe__lateral">
                <section class="card secao">
                    <div class="card__cabecalho"><h2 class="card__titulo">Informações</h2></div>
                    <div class="card__corpo">${listaDefinicao([
                        ["Gravidade", badgeStatus(GRAVIDADES, i.gravidade)],
                        ["Status", badgeStatus(STATUS_INCIDENTE, i.status)],
                        tipo === "tecnico" ? ["Serviço afetado", svc ? html`<a class="link-forte" href="#/monitoramento/servico/${svc.id}">${svc.nome}</a>` : "—"] : null,
                        ["Empresa", b ? html`<a class="link-forte" href="#/barbearias/${b.id}">${b.nome}</a>` : "Plataforma (nenhuma específica)"],
                        ["Responsável", i.responsavel],
                        ["Encerrado em", i.encerradoEm ? dataHora(i.encerradoEm) : "—"]
                    ])}</div>
                </section>
                ${tipo === "tecnico" ? html`
                    <section class="card secao">
                        <div class="card__cabecalho"><h2 class="card__titulo">Chamado relacionado</h2></div>
                        <div class="card__corpo">${ch ? listaDefinicao([
                            ["Protocolo", html`<a class="link-forte" href="#/suporte/${ch.id}">${ch.protocolo}</a>`],
                            ["Título", ch.titulo], ["Status", badgeStatus(STATUS_CHAMADO, ch.status)]
                        ]) : html`<p class="texto-terc">Nenhum chamado vinculado.</p>`}</div>
                    </section>` : ""}
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Alertas relacionados</h2><span class="badge">${numero(alertas.length)}</span></div>
                    ${alertas.length ? html`<ul class="lista">${alertas.map((a) => html`
                        <li class="lista__item"><div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/seguranca/alerta/${a.id}">${a.codigo}</a>
                        <div class="lista__meta">${a.descricao}</div></div></li>`)}</ul>` : html`<div class="card__corpo"><p class="texto-terc">Nenhum alerta vinculado.</p></div>`}
                </section>
            </aside>
        </div>`);

    const recarregar = () => renderDetalhe(view, tipo, id);
    raiz.querySelector("form[data-form=providencia]")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const campo = e.currentTarget.elements.texto;
        if (campo.value.trim().length < 3) {
            e.currentTarget.querySelector("[data-erro]").textContent = "Descreva a providência.";
            campo.setAttribute("aria-invalid", "true");
            return;
        }
        try {
            I.adicionarProvidencia(tipo, id, campo.value);
            mostrarToast("Providência registrada.", "sucesso");
            recarregar();
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
    raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) return tratarRestauracaoDemo(recarregar);
        const botao = e.target.closest("[data-inc]");
        if (!botao) return;
        try { if (await acao(tipo, botao.dataset.inc, id)) recarregar(); } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}
