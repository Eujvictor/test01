// =====================================================================
// MÓDULO 12 — BACKUPS E RECUPERAÇÃO (modo demonstrativo)
// Rotas: #/backups[/historico|politica|recuperacao|continuidade]
//        #/backups/backup/<id>
// Nenhum backup é criado, validado ou restaurado de verdade. Todas as
// ações são simulações registradas no histórico e identificadas.
// =====================================================================
import * as I from "../../services/demo/infra.js";
import {
    TIPOS_BACKUP, STATUS_BACKUP, INTEGRIDADE_BACKUP, ORIGENS_BACKUP, AMBIENTES_RECUPERACAO, STATUS_RECUPERACAO, ETAPAS_RECUPERACAO,
    FREQUENCIAS_BACKUP, STATUS_VERIFICACAO, opcoes
} from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, dataHora, tempoRelativo, data } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { graficoLinha } from "../../js/components/grafico.js";
import {
    cabecalho, avisoDemo, tratarRestauracaoDemo, kpi, badgeStatus, estadoVazio, listaDefinicao, linhaDoTempo, botaoIcone, campoBusca, campoSelect, molduraComAbas, novaRaiz
} from "../../js/components/ui.js";
import * as Al from "../compartilhado/alertas.js";

const SECOES = [["", "Visão geral"], ["historico", "Histórico"], ["politica", "Política de retenção"], ["recuperacao", "Recuperação"], ["continuidade", "Continuidade"]];
const filtros = { busca: "", tipo: "", status: "" };
let backupSelecionado = "";

const fmtMb = (v) => (v === null || v === undefined ? "—" : v >= 1024 ? `${(v / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB` : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`);

function avisoBackup() {
    return html`<div class="alerta alerta--info">${icone("info")}<span><strong>Simulação.</strong> Nenhum backup real é criado, verificado ou restaurado neste painel. Os registros são fictícios. A estrutura está preparada para os backups do PostgreSQL/Supabase, para armazenamento externo e para verificação de integridade.</span></div>`;
}

function kpis() {
    const r = I.resumoBackups();
    const p = I.politica();
    return html`
        ${kpi({ rotulo: "Backups registrados", valor: numero(r.total), iconeNome: "database-backup", nota: "Demonstrativos" })}
        ${kpi({ rotulo: "Último backup", valor: r.ultimo ? tempoRelativo(r.ultimo.data) : "—", iconeNome: "clock", nota: r.ultimo ? `${r.ultimo.codigo} · ${STATUS_BACKUP[r.ultimo.status].rotulo}` : "", destaque: true })}
        ${kpi({ rotulo: "Concluídos", valor: numero(r.concluidos), iconeNome: "circle-check", nota: "Inclui arquivados" })}
        ${kpi({ rotulo: "Com falha", valor: numero(r.falhas), iconeNome: "circle-x", nota: "Exigem reexecução" })}
        ${kpi({ rotulo: "Pendentes", valor: numero(r.pendentes), iconeNome: "hourglass", nota: "Agendados ou em andamento" })}
        ${kpi({ rotulo: "Espaço ocupado", valor: fmtMb(r.espacoMb), iconeNome: "hard-drive", nota: "Backups dentro da retenção (demo)" })}
        ${kpi({ rotulo: "Política de retenção", valor: `${p.retencaoDiaria}/${p.retencaoSemanal}/${p.retencaoMensal}`, iconeNome: "calendar-range", nota: "Diários / semanais / mensais" })}
        ${kpi({ rotulo: "Integridade", valor: `${r.integridadeVerificada}/${r.integridadeVerificada + r.integridadePendente}`, iconeNome: "shield-check", nota: "Verificados em simulação" })}`;
}

// ---------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------
async function registrarBackup() {
    const p = I.politica();
    const novo = await abrirFormulario({
        titulo: "Registrar backup demonstrativo",
        descricao: "Cria apenas um registro pendente. Nenhum dado é copiado.",
        campos: [
            { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, maxlength: 80 },
            { nome: "tipo", rotulo: "Tipo", tipo: "select", obrigatorio: true, opcoes: opcoes(TIPOS_BACKUP), largura: "meia" },
            { nome: "origem", rotulo: "Origem", tipo: "select", obrigatorio: true, opcoes: opcoes(ORIGENS_BACKUP), largura: "meia" },
            { nome: "retencao", rotulo: "Retenção", tipo: "select", obrigatorio: true, opcoes: [
                [`Diária · ${p.retencaoDiaria} dias`, `Diária · ${p.retencaoDiaria} dias`], [`Semanal · ${p.retencaoSemanal} semanas`, `Semanal · ${p.retencaoSemanal} semanas`],
                [`Mensal · ${p.retencaoMensal} meses`, `Mensal · ${p.retencaoMensal} meses`]] },
            { nome: "observacao", rotulo: "Observação", tipo: "textarea", maxlength: 300 }
        ],
        valores: { tipo: "banco", origem: "postgres", nome: `Backup manual ${new Date().toLocaleDateString("pt-BR")}` },
        textoSalvar: "Registrar backup",
        aoSalvar: (v) => I.registrarBackup(v)
    });
    if (novo) {
        mostrarToast(`Backup ${novo.codigo} registrado como pendente (demonstração).`, "sucesso");
        window.location.hash = `#/backups/backup/${novo.id}`;
    }
    return Boolean(novo);
}

async function solicitarRestauracao(backupId = "") {
    const disponiveis = I.backups().filter((b) => b.status === "concluido").sort((a, b) => b.data.localeCompare(a.data));
    const nova = await abrirFormulario({
        titulo: "Solicitar restauração (simulação)",
        descricao: "Nada será restaurado. A solicitação percorre as etapas apenas como simulação, registrada no histórico.",
        campos: [
            { nome: "backupId", rotulo: "Backup", tipo: "select", obrigatorio: true, placeholderOpcao: "Selecione", opcoes: disponiveis.map((b) => [b.id, `${b.codigo} · ${b.nome} · ${fmtMb(b.tamanhoMb)}`]) },
            { nome: "ambiente", rotulo: "Ambiente de recuperação", tipo: "select", obrigatorio: true, opcoes: opcoes(AMBIENTES_RECUPERACAO), largura: "meia" },
            { nome: "confirmacaoTexto", rotulo: "Confirmação (só para produção)", tipo: "texto", maxlength: 10, largura: "meia", ajuda: "Para produção, digite SIMULAR.",
                validarVazio: true, validar: (v, x) => (x.ambiente === "producao" && v !== "SIMULAR" ? "Digite SIMULAR para confirmar." : null) },
            { nome: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true, maxlength: 300 }
        ],
        valores: { backupId, ambiente: "homologacao" },
        textoSalvar: "Solicitar (simulação)",
        aoSalvar: (v) => I.solicitarRestauracao(v)
    });
    if (nova) {
        mostrarToast(`Solicitação ${nova.codigo} registrada (simulação). Um alerta de restauração pendente foi criado.`, "sucesso");
        window.location.hash = "#/backups/recuperacao";
    }
    return Boolean(nova);
}

async function acaoBackup(nome, id) {
    switch (nome) {
        case "executar": {
            const st = I.simularExecucao(id);
            mostrarToast(st === "andamento" ? "Execução simulada iniciada." : "Execução simulada concluída (nenhum backup real criado).", "sucesso");
            return true;
        }
        case "integridade": I.verificarIntegridade(id); mostrarToast("Integridade verificada em simulação.", "sucesso"); return true;
        case "restaurar": return solicitarRestauracao(id);
        case "arquivar":
            if (!(await confirmar({ titulo: "Arquivar backup?", mensagem: "O registro sai da lista ativa. Nenhum dado é excluído.", textoConfirmar: "Arquivar" }))) return false;
            I.arquivarBackup(id); mostrarToast("Backup arquivado.", "sucesso"); return true;
        default: return false;
    }
}

// ---------------------------------------------------------------------
// Seções
// ---------------------------------------------------------------------
function secaoVisao({ secao }) {
    const banco = I.backups().filter((b) => b.tipo === "banco" && b.tamanhoMb).sort((a, b) => a.data.localeCompare(b.data)).slice(-30);
    const recentes = I.backups().filter((b) => b.status !== "pendente").sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
    const proximo = I.backups().filter((b) => b.status === "pendente").sort((a, b) => a.data.localeCompare(b.data))[0];
    renderizar(secao, html`
        ${avisoBackup()}
        <div class="grade grade--2 grade--2-igual secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Tamanho do backup do banco</h2><span class="texto-terc">MB por execução · demo</span></div>
                <div class="card__corpo">${graficoLinha({ dados: banco.map((b) => ({ rotulo: data(b.data).slice(0, 5), rotuloLongo: `${b.codigo} · ${dataHora(b.data)}`, valor: b.tamanhoMb })), formatar: fmtMb, formatarEixo: (v) => numero(Math.round(v)), titulo: "Tamanho do backup do banco" })}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Alertas de backup abertos</h2><a class="btn btn--pequeno" href="#/seguranca/alertas">Central</a></div>
                ${Al.resumoAlertas(I.alertasAbertos((a) => a.categoria === "backup"))}
            </section>
        </div>
        <div class="grade grade--2 grade--2-igual">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Execuções recentes</h2><a class="btn btn--pequeno" href="#/backups/historico">Histórico</a></div>
                <ul class="lista">${recentes.map((b) => html`
                    <li class="lista__item">
                        <div class="lista__conteudo"><a class="lista__titulo link-forte" href="#/backups/backup/${b.id}">${b.codigo} · ${b.nome}</a>
                            <div class="lista__meta">${TIPOS_BACKUP[b.tipo]} · ${fmtMb(b.tamanhoMb)} · ${tempoRelativo(b.data)}</div></div>
                        ${badgeStatus(STATUS_BACKUP, b.status)}
                    </li>`)}</ul>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Próxima execução e retenção</h2></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Próximo backup agendado", proximo ? `${proximo.codigo} · ${dataHora(proximo.data)}` : "Nenhum"],
                    ["Frequência", `${FREQUENCIAS_BACKUP[I.politica().frequencia]} às ${I.politica().horario}`],
                    ["Retenção", `${I.politica().retencaoDiaria} diários · ${I.politica().retencaoSemanal} semanais · ${I.politica().retencaoMensal} mensais`],
                    ["Destino externo", I.politica().destinoExterno],
                    ["Verificação de integridade", "Simulada (pendente de integração)"]
                ])}</div>
            </section>
        </div>`);
}

const COLUNAS = [
    { chave: "codigo", rotulo: "Identificador", render: (b) => html`<a class="link-forte num" href="#/backups/backup/${b.id}">${b.codigo}</a>` },
    { chave: "nome", rotulo: "Nome", render: (b) => html`<span class="celula-limite">${b.nome}</span>` },
    { chave: "tipo", rotulo: "Tipo", valor: (b) => TIPOS_BACKUP[b.tipo], render: (b) => TIPOS_BACKUP[b.tipo] },
    { chave: "data", rotulo: "Data e horário", render: (b) => dataHora(b.data) },
    { chave: "tamanhoMb", rotulo: "Tamanho", classe: "col-num", valor: (b) => b.tamanhoMb ?? -1, render: (b) => fmtMb(b.tamanhoMb) },
    { chave: "origem", rotulo: "Origem", valor: (b) => ORIGENS_BACKUP[b.origem], render: (b) => html`<span class="celula-sub celula-sub--normal">${ORIGENS_BACKUP[b.origem]}</span>` },
    { chave: "status", rotulo: "Status", valor: (b) => STATUS_BACKUP[b.status].rotulo, render: (b) => badgeStatus(STATUS_BACKUP, b.status) },
    { chave: "retencao", rotulo: "Retenção", render: (b) => b.retencao },
    {
        chave: "acoes", rotulo: "Ações", ordenavel: false, classe: "col-acoes",
        render: (b) => html`<div class="acoes-linha">
            ${botaoIcone({ acao: "ver-backup", id: b.id, nomeIcone: "eye", rotulo: `Ver ${b.codigo}` })}
            ${b.status === "pendente" || b.status === "andamento" ? botaoIcone({ acao: "executar", id: b.id, nomeIcone: "play", rotulo: "Simular execução" }) : ""}
            ${b.status === "concluido" && b.integridade !== "verificado_demo" ? botaoIcone({ acao: "integridade", id: b.id, nomeIcone: "shield-check", rotulo: "Verificar integridade (simulação)" }) : ""}
            ${b.status === "concluido" ? botaoIcone({ acao: "restaurar", id: b.id, nomeIcone: "rotate-ccw", rotulo: "Solicitar restauração (simulação)" }) : ""}
        </div>`
    }
];

function secaoHistorico({ secao, atualizarIndicadores }) {
    renderizar(secao, html`
        ${avisoBackup()}
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Histórico de backups</h2>
                <button class="btn btn--primario btn--pequeno" type="button" data-bk="novo">${icone("plus")}<span>Registrar backup demonstrativo</span></button>
            </div>
            <div class="barra-filtros">
                ${campoBusca({ id: "fBkBusca", valor: filtros.busca, placeholder: "Pesquisar identificador ou nome" })}
                ${campoSelect({ id: "fBkTipo", rotulo: "Tipo", valor: filtros.tipo, opcoes: [["", "Todos os tipos"], ...opcoes(TIPOS_BACKUP)] })}
                ${campoSelect({ id: "fBkStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...opcoes(STATUS_BACKUP)] })}
            </div>
            <div data-tabela></div>
        </section>`);
    const tabela = criarTabela({ colunas: COLUNAS, ordenacao: { chave: "data", direcao: "desc" }, porPagina: 12, vazio: "Nenhum backup para os filtros selecionados.", rotulo: "Backups" });
    secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const linhas = () => I.filtrarBackups(filtros);
    tabela.definirLinhas(linhas());
    let espera;
    secao.querySelector("#fBkBusca").addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { filtros.busca = e.target.value; tabela.definirLinhas(linhas()); }, 150);
    });
    [["#fBkTipo", "tipo"], ["#fBkStatus", "status"]].forEach(([sel, chave]) =>
        secao.querySelector(sel).addEventListener("change", (e) => { filtros[chave] = e.target.value; tabela.definirLinhas(linhas()); }));
    secao.addEventListener("click", async (e) => {
        if (e.target.closest("[data-bk=novo]")) { await registrarBackup(); return; }
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        if (b.dataset.acao === "ver-backup") { window.location.hash = `#/backups/backup/${b.dataset.id}`; return; }
        try { if (await acaoBackup(b.dataset.acao, b.dataset.id)) { tabela.atualizarLinhas(linhas()); atualizarIndicadores(); } }
        catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

function secaoPolitica({ secao, atualizarIndicadores }) {
    const desenhar = () => {
        const p = I.politica();
        renderizar(secao, html`
            ${avisoBackup()}
            <div class="grade grade--2">
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Política de retenção atual</h2>
                        <button class="btn btn--primario btn--pequeno" type="button" data-pol="editar">${icone("pencil")}<span>Configurar política</span></button></div>
                    <div class="card__corpo">${listaDefinicao([
                        ["Frequência", FREQUENCIAS_BACKUP[p.frequencia]], ["Horário", p.horario],
                        ["Retenção diária", `${p.retencaoDiaria} backups`], ["Retenção semanal", `${p.retencaoSemanal} backups`],
                        ["Retenção mensal", `${p.retencaoMensal} backups`], ["Prazo de armazenamento", `${p.prazoDias} dias`],
                        ["Destino externo", p.destinoExterno], ["Última alteração", dataHora(p.atualizadoEm)]
                    ])}</div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Histórico da política</h2></div>
                    <div class="card__corpo">${linhaDoTempo(I.historicoDe("politica_backup", "politica"))}</div>
                </section>
            </div>`);
    };
    desenhar();
    secao.addEventListener("click", async (e) => {
        if (!e.target.closest("[data-pol=editar]")) return;
        const p = I.politica();
        const inteiro = (v) => (Number.isInteger(v) ? null : "Use um número inteiro.");
        const ok = await abrirFormulario({
            titulo: "Configurar política de retenção", descricao: "Configuração demonstrativa: nenhum agendamento real é alterado.",
            campos: [
                { nome: "frequencia", rotulo: "Frequência", tipo: "select", obrigatorio: true, opcoes: opcoes(FREQUENCIAS_BACKUP), largura: "meia" },
                { nome: "horario", rotulo: "Horário (HH:MM)", tipo: "texto", obrigatorio: true, maxlength: 5, largura: "meia",
                    validar: (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? null : "Use o formato HH:MM.") },
                { nome: "retencaoDiaria", rotulo: "Retenção diária (backups)", tipo: "numero", obrigatorio: true, min: 1, max: 90, passo: 1, largura: "meia", validar: inteiro },
                { nome: "retencaoSemanal", rotulo: "Retenção semanal (backups)", tipo: "numero", obrigatorio: true, min: 0, max: 52, passo: 1, largura: "meia", validar: inteiro },
                { nome: "retencaoMensal", rotulo: "Retenção mensal (backups)", tipo: "numero", obrigatorio: true, min: 0, max: 60, passo: 1, largura: "meia", validar: inteiro },
                { nome: "prazoDias", rotulo: "Prazo de armazenamento (dias)", tipo: "numero", obrigatorio: true, min: 7, max: 3650, passo: 1, largura: "meia", validar: inteiro },
                { nome: "destinoExterno", rotulo: "Destino externo", tipo: "texto", maxlength: 120, ajuda: "Ex.: bucket externo. Deixe vazio enquanto não houver integração." }
            ],
            valores: { ...p, destinoExterno: p.destinoExterno.startsWith("Não configurado") ? "" : p.destinoExterno },
            textoSalvar: "Salvar política",
            aoSalvar: (v) => I.salvarPolitica(v)
        });
        if (ok) { mostrarToast("Política demonstrativa salva.", "sucesso"); desenhar(); atualizarIndicadores(); }
    });
}

function secaoRecuperacao({ secao, atualizarIndicadores }) {
    const desenhar = () => {
        const disponiveis = I.backups().filter((b) => b.status === "concluido").sort((a, b) => b.data.localeCompare(a.data));
        const sel = I.backup(backupSelecionado);
        const ativas = I.recuperacoes().filter((r) => r.status === "solicitada" || r.status === "em_simulacao");
        renderizar(secao, html`
            ${avisoBackup()}
            <div class="grade grade--2 secao">
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">1. Selecionar backup</h2></div>
                    <div class="card__corpo">
                        <div class="barra-filtros barra-filtros--solta">${campoSelect({ id: "fRecBackup", rotulo: "Backup", valor: backupSelecionado, opcoes: [["", "Selecione um backup concluído"], ...disponiveis.map((b) => [b.id, `${b.codigo} · ${b.nome}`])] })}</div>
                        ${sel ? html`${listaDefinicao([
                            ["Tipo", TIPOS_BACKUP[sel.tipo]], ["Data", dataHora(sel.data)], ["Tamanho", fmtMb(sel.tamanhoMb)], ["Origem", ORIGENS_BACKUP[sel.origem]],
                            ["Integridade", badgeStatus(INTEGRIDADE_BACKUP, sel.integridade)]
                        ])}
                            ${sel.integridade !== "verificado_demo" ? html`<div class="alerta alerta--erro secao-topo">${icone("triangle-alert")}<span>Integridade não verificada. Recomenda-se verificar antes de restaurar.</span></div>` : ""}
                            <div class="acoes-cartao"><button class="btn btn--primario" type="button" data-rec="solicitar">${icone("rotate-ccw")}<span>Solicitar restauração (simulação)</span></button></div>`
                            : html`<p class="texto-terc">Escolha um backup para ver as informações e solicitar a restauração simulada.</p>`}
                    </div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">2. Etapas da recuperação</h2></div>
                    <div class="card__corpo">
                        <ol class="etapas">${ETAPAS_RECUPERACAO.map((e, i) => html`<li class="etapas__item"><span class="etapas__numero">${i + 1}</span><span>${e}</span></li>`)}</ol>
                        <p class="texto-terc texto-pequeno secao-topo">Em produção, a restauração deve ocorrer primeiro em ambiente isolado. Aqui, cada etapa é apenas simulada.</p>
                    </div>
                </section>
            </div>
            ${ativas.length ? html`<div class="grade grade--2 secao">${ativas.map((r) => {
                const b = I.backup(r.backupId);
                return html`
                    <section class="card">
                        <div class="card__cabecalho"><h2 class="card__titulo">${r.codigo} · ${AMBIENTES_RECUPERACAO[r.ambiente]}</h2>${badgeStatus(STATUS_RECUPERACAO, r.status)}</div>
                        <div class="card__corpo">
                            <p class="texto-sec texto-pequeno">${b?.codigo ?? "—"} · ${r.motivo}</p>
                            <ol class="etapas etapas--progresso">${ETAPAS_RECUPERACAO.map((e, i) => html`
                                <li class="etapas__item ${i < r.etapa ? "is-feita" : i === r.etapa ? "is-atual" : ""}"><span class="etapas__numero">${i < r.etapa ? icone("check") : i + 1}</span><span>${e}</span></li>`)}</ol>
                            <div class="acoes-cartao">
                                <button class="btn btn--primario btn--pequeno" type="button" data-rec="avancar" data-id="${r.id}">${icone("skip-forward")}<span>Avançar etapa (simulação)</span></button>
                                <button class="btn btn--pequeno btn--fantasma" type="button" data-rec="cancelar" data-id="${r.id}">${icone("x")}<span>Cancelar</span></button>
                            </div>
                        </div>
                    </section>`;
            })}</div>` : ""}
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Histórico de recuperação</h2><span class="badge">${numero(I.recuperacoes().length)}</span></div>
                <div data-tabela></div>
            </section>`);
        const tabela = criarTabela({
            colunas: [
                { chave: "codigo", rotulo: "Solicitação", render: (r) => html`<span class="num">${r.codigo}</span>` },
                { chave: "backup", rotulo: "Backup", valor: (r) => I.backup(r.backupId)?.codigo ?? "", render: (r) => { const b = I.backup(r.backupId); return b ? html`<a class="link-forte" href="#/backups/backup/${b.id}">${b.codigo}</a>` : "—"; } },
                { chave: "ambiente", rotulo: "Ambiente", valor: (r) => AMBIENTES_RECUPERACAO[r.ambiente], render: (r) => AMBIENTES_RECUPERACAO[r.ambiente] },
                { chave: "solicitadoEm", rotulo: "Solicitada em", render: (r) => dataHora(r.solicitadoEm) },
                { chave: "etapa", rotulo: "Etapas", classe: "col-num", render: (r) => `${r.etapa}/${ETAPAS_RECUPERACAO.length}` },
                { chave: "status", rotulo: "Status", valor: (r) => r.status, render: (r) => badgeStatus(STATUS_RECUPERACAO, r.status) }
            ],
            ordenacao: { chave: "solicitadoEm", direcao: "desc" }, vazio: "Nenhuma solicitação.", rotulo: "Histórico de recuperação"
        });
        secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
        tabela.definirLinhas(I.recuperacoes());
        secao.querySelector("#fRecBackup").addEventListener("change", (e) => { backupSelecionado = e.target.value; desenhar(); });
    };
    desenhar();
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-rec]");
        if (!b) return;
        try {
            if (b.dataset.rec === "solicitar") { await solicitarRestauracao(backupSelecionado); desenhar(); atualizarIndicadores(); }
            if (b.dataset.rec === "avancar") {
                I.avancarRestauracao(b.dataset.id);
                const r = I.recuperacao(b.dataset.id);
                mostrarToast(r.status === "simulada" ? "Simulação concluída. Nenhum dado foi restaurado." : "Etapa simulada concluída.", "sucesso");
                desenhar();
            }
            if (b.dataset.rec === "cancelar") {
                const ok = await abrirFormulario({
                    titulo: "Cancelar solicitação", campos: [{ nome: "motivo", rotulo: "Motivo do cancelamento", tipo: "textarea", obrigatorio: true, maxlength: 300 }],
                    textoSalvar: "Cancelar solicitação", perigo: true, aoSalvar: (v) => I.cancelarRestauracao(b.dataset.id, v.motivo)
                });
                if (ok) { mostrarToast("Solicitação cancelada.", "sucesso"); desenhar(); }
            }
        } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

function secaoContinuidade({ secao }) {
    const preparacao = [
        ["Backups do PostgreSQL", "pendente_integracao", "Backups diários automáticos do Supabase e, nos planos pagos, recuperação a um ponto no tempo (PITR)."],
        ["Supabase", "pendente_integracao", "Leitura do status e do histórico de backups pela API de gerenciamento, via Edge Function e token guardado em segredo."],
        ["Armazenamento externo", "nao_verificado", "Cópia adicional fora do Supabase (outro provedor), com criptografia."],
        ["Verificação de integridade", "pendente_integracao", "Restauração periódica automatizada em ambiente isolado, com checagem de contagens e somas."],
        ["Recuperação de desastres", "nao_verificado", "Procedimento documentado, testado e com responsáveis definidos."]
    ];
    const desenhar = () => {
        const c = I.continuidade();
        renderizar(secao, html`
            ${avisoBackup()}
            <section class="grade grade--kpi secao">
                ${kpi({ rotulo: "RPO", valor: `${c.rpoHoras} h`, iconeNome: "history", nota: "Perda máxima de dados aceitável" })}
                ${kpi({ rotulo: "RTO", valor: `${c.rtoHoras} h`, iconeNome: "timer", nota: "Tempo máximo para voltar a operar" })}
                ${kpi({ rotulo: "Testes registrados", valor: numero(c.testes.length), iconeNome: "flask-conical", nota: "Demonstrativos" })}
                ${kpi({ rotulo: "Último teste", valor: c.testes.length ? tempoRelativo(c.testes.at(-1).data) : "Nunca", iconeNome: "calendar-check", nota: c.testes.at(-1)?.resultado ?? "" })}
            </section>
            <div class="grade grade--2 secao">
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Plano de continuidade</h2>
                        <button class="btn btn--pequeno" type="button" data-cont="editar">${icone("pencil")}<span>Editar plano</span></button></div>
                    <div class="card__corpo">${listaDefinicao([
                        ["RPO (objetivo de ponto de recuperação)", `${c.rpoHoras} horas`], ["RTO (objetivo de tempo de recuperação)", `${c.rtoHoras} horas`],
                        ["Estratégia de recuperação", c.estrategia], ["Responsáveis", c.responsaveis], ["Última alteração", dataHora(c.atualizadoEm)]
                    ])}</div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Preparação para produção</h2></div>
                    <ul class="lista">${preparacao.map(([nome, st, texto]) => html`
                        <li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">${nome}</div><div class="lista__meta">${texto}</div></div>
                        ${badgeStatus(STATUS_VERIFICACAO, st)}</li>`)}</ul>
                </section>
            </div>
            <div class="grade grade--2">
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Histórico de testes</h2>
                        <button class="btn btn--primario btn--pequeno" type="button" data-cont="teste">${icone("plus")}<span>Registrar teste</span></button></div>
                    <div data-tabela></div>
                </section>
                <section class="card">
                    <div class="card__cabecalho"><h2 class="card__titulo">Histórico do plano</h2></div>
                    <div class="card__corpo">${linhaDoTempo(I.historicoDe("continuidade", "plano"), "Nenhuma alteração registrada.")}</div>
                </section>
            </div>`);
        const tabela = criarTabela({
            colunas: [
                { chave: "data", rotulo: "Data", render: (t) => data(t.data) },
                { chave: "tipo", rotulo: "Teste", render: (t) => html`${t.tipo}<span class="celula-sub">${t.observacoes}</span>` },
                { chave: "duracaoMin", rotulo: "Duração", classe: "col-num", render: (t) => `${numero(t.duracaoMin)} min` },
                { chave: "resultado", rotulo: "Resultado" }
            ],
            ordenacao: { chave: "data", direcao: "desc" }, vazio: "Nenhum teste registrado.", rotulo: "Testes de recuperação"
        });
        secao.querySelector("[data-tabela]").appendChild(tabela.elemento);
        tabela.definirLinhas(c.testes);
    };
    desenhar();
    secao.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-cont]");
        if (!b) return;
        const c = I.continuidade();
        let ok = false;
        if (b.dataset.cont === "editar") {
            ok = await abrirFormulario({
                titulo: "Plano de continuidade", descricao: "Plano demonstrativo. Ajuste conforme o contrato e o plano do Supabase.",
                campos: [
                    { nome: "rpoHoras", rotulo: "RPO (horas)", tipo: "numero", obrigatorio: true, min: 0, max: 168, passo: 1, largura: "meia" },
                    { nome: "rtoHoras", rotulo: "RTO (horas)", tipo: "numero", obrigatorio: true, min: 0.5, max: 168, passo: 0.5, largura: "meia" },
                    { nome: "estrategia", rotulo: "Estratégia de recuperação", tipo: "textarea", obrigatorio: true, maxlength: 800 },
                    { nome: "responsaveis", rotulo: "Responsáveis", tipo: "textarea", obrigatorio: true, maxlength: 300 }
                ],
                valores: c, textoSalvar: "Salvar plano", aoSalvar: (v) => I.salvarContinuidade(v)
            });
            if (ok) mostrarToast("Plano de continuidade salvo.", "sucesso");
        }
        if (b.dataset.cont === "teste") {
            const hoje = new Date();
            ok = await abrirFormulario({
                titulo: "Registrar teste de recuperação", descricao: "Registro demonstrativo de um teste (simulado) de recuperação.",
                campos: [
                    { nome: "data", rotulo: "Data", tipo: "data", obrigatorio: true, largura: "meia" },
                    { nome: "duracaoMin", rotulo: "Duração (min)", tipo: "numero", obrigatorio: true, min: 1, max: 10000, passo: 1, largura: "meia" },
                    { nome: "tipo", rotulo: "Tipo de teste", tipo: "texto", obrigatorio: true, maxlength: 80 },
                    { nome: "resultado", rotulo: "Resultado", tipo: "select", obrigatorio: true, opcoes: [["Simulação concluída", "Simulação concluída"], ["Concluído com ressalvas", "Concluído com ressalvas"], ["Falhou", "Falhou"]] },
                    { nome: "observacoes", rotulo: "Observações", tipo: "textarea", maxlength: 400 }
                ],
                valores: { data: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`, tipo: "Restauração em homologação" },
                textoSalvar: "Registrar teste", aoSalvar: (v) => I.registrarTesteRecuperacao(v)
            });
            if (ok) mostrarToast("Teste registrado.", "sucesso");
        }
        if (ok) desenhar();
    });
}

// ---------------------------------------------------------------------
// Detalhe do backup
// ---------------------------------------------------------------------
function renderBackup(view, id) {
    const raiz = novaRaiz(view);
    const b = I.backup(id);
    const voltar = { href: "#/backups/historico", rotulo: "Histórico de backups" };
    if (!b) {
        renderizar(raiz, html`${cabecalho({ titulo: "Backup não encontrado", voltar })}<section class="card">${estadoVazio({ iconeNome: "database-backup", titulo: "Registro inexistente" })}</section>`);
        return;
    }
    const alertas = I.alertas().filter((a) => a.referencia?.tipo === "backup" && a.referencia.id === id);
    const recs = I.recuperacoes().filter((r) => r.backupId === id);
    renderizar(raiz, html`
        ${cabecalho({
            titulo: b.nome, voltar, extra: badgeStatus(STATUS_BACKUP, b.status),
            subtitulo: `${b.codigo} · ${TIPOS_BACKUP[b.tipo]} · ${dataHora(b.data)}`,
            acoes: html`
                ${b.status === "pendente" || b.status === "andamento" ? html`<button class="btn btn--primario" type="button" data-bk="executar">${icone("play")}<span>${b.status === "pendente" ? "Simular execução" : "Concluir execução (simulação)"}</span></button>` : ""}
                ${b.status === "concluido" && b.integridade !== "verificado_demo" ? html`<button class="btn" type="button" data-bk="integridade">${icone("shield-check")}<span>Verificar integridade</span></button>` : ""}
                ${b.status === "concluido" ? html`<button class="btn" type="button" data-bk="restaurar">${icone("rotate-ccw")}<span>Solicitar restauração</span></button>` : ""}
                ${b.status === "concluido" || b.status === "falhou" ? html`<button class="btn btn--fantasma" type="button" data-bk="arquivar">${icone("archive")}<span>Arquivar</span></button>` : ""}`
        })}
        ${avisoDemo()}
        ${avisoBackup()}
        ${b.erro ? html`<div class="alerta alerta--erro">${icone("octagon-alert")}<span><strong>Falha:</strong> ${b.erro}</span></div>` : ""}
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Detalhes do backup</h2></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Identificação", b.codigo], ["Data", dataHora(b.data)], ["Tipo", TIPOS_BACKUP[b.tipo]], ["Tamanho", fmtMb(b.tamanhoMb)],
                    ["Origem", ORIGENS_BACKUP[b.origem]], ["Status", badgeStatus(STATUS_BACKUP, b.status)],
                    ["Integridade", badgeStatus(INTEGRIDADE_BACKUP, b.integridade)], ["Política de retenção", b.retencao],
                    b.observacao ? ["Observação", b.observacao] : null
                ])}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Histórico de operações</h2></div>
                <div class="card__corpo">${linhaDoTempo(I.historicoDe("backup", id))}</div>
            </section>
        </div>
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Alertas relacionados</h2></div>
                ${Al.resumoAlertas(alertas, "Nenhum alerta para este backup.")}
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Restaurações solicitadas</h2><span class="badge">${numero(recs.length)}</span></div>
                ${recs.length ? html`<ul class="lista">${recs.map((r) => html`<li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">${r.codigo} · ${AMBIENTES_RECUPERACAO[r.ambiente]}</div>
                    <div class="lista__meta">${dataHora(r.solicitadoEm)}</div></div>${badgeStatus(STATUS_RECUPERACAO, r.status)}</li>`)}</ul>`
                    : html`<div class="card__corpo"><p class="texto-terc">Nenhuma restauração solicitada.</p></div>`}
            </section>
        </div>`);
    raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) return tratarRestauracaoDemo(() => renderBackup(view, id));
        const botao = e.target.closest("[data-bk]");
        if (!botao) return;
        try { if (await acaoBackup(botao.dataset.bk, id)) renderBackup(view, id); } catch (falha) { mostrarToast(falha.message, "erro"); }
    });
}

const RENDER = { "": secaoVisao, historico: secaoHistorico, politica: secaoPolitica, recuperacao: secaoRecuperacao, continuidade: secaoContinuidade };

export function render(view, { parametros = [] }) {
    const [primeiro, segundo] = parametros;
    if (primeiro === "backup" && segundo) return renderBackup(view, segundo);
    const ativa = SECOES.some(([r]) => r === primeiro) ? primeiro : "";
    const recarregar = () => render(view, { parametros });
    const ctx = molduraComAbas(view, {
        titulo: "Backups e recuperação", subtitulo: "Histórico, retenção, recuperação e continuidade operacional", base: "#/backups",
        secoes: SECOES, ativa, kpis, recarregar,
        acoes: html`<button class="btn btn--primario" type="button" data-topo="backup">${icone("plus")}<span>Registrar backup</span></button>`
    });
    ctx.raiz.addEventListener("click", async (e) => {
        if (e.target.closest("[data-topo=backup]")) await registrarBackup();
    });
    RENDER[ativa](ctx);
}
