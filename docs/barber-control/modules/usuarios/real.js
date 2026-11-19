// =====================================================================
// MÓDULO 05 — USUÁRIOS (MODO REAL)
// Rota: #/usuarios
// Contas de login do Supabase: administradores do SaaS, donos e gerentes
// de barbearias e contas sem vínculo. Fonte: control_api.listar_usuarios
// (administrador + MFA, validados no servidor).
// Ações: ativar/desativar o acesso de um dono ou gerente ao painel da
// barbearia (control_api.alterar_membro, com auditoria). Nenhuma conta é
// apagada e nenhuma senha é vista ou alterada aqui.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { STATUS_BARBEARIA } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { baixarCsv } from "../../js/utilities/csv.js";
import { criarTabela } from "../../js/components/tabela.js";
import { cabecalho, kpi, badgeStatus, estadoVazio, botaoIcone, campoBusca, campoSelect, novaRaiz } from "../../js/components/ui.js";

const TIPOS = {
    master: { rotulo: "Administrador do SaaS", tom: "ouro" },
    proprietario: { rotulo: "Proprietário", tom: "sucesso" },
    gerente: { rotulo: "Gerente", tom: "neutro" },
    sem_vinculo: { rotulo: "Sem vínculo", tom: "atencao" }
};
const SITUACAO = {
    ativo: { rotulo: "Ativo", tom: "sucesso" },
    desativado: { rotulo: "Desativado", tom: "neutro" },
    sem_acesso: { rotulo: "Sem acesso", tom: "atencao" }
};
const TRINTA_DIAS = 30 * 86400000;
const filtros = { busca: "", tipo: "", barbearia: "", situacao: "" };

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const situacao = (u) => (u.tipo === "sem_vinculo" ? "sem_acesso" : u.ativo ? "ativo" : "desativado");
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function erroNaTela(raiz, erro) {
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Usuários", subtitulo: "Painel Master" })}
        <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar os usuários", texto: erro.message })}</section>`);
}

async function renderLista(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Usuários", subtitulo: "Carregando do Supabase…" })}`);
    let lista;
    try {
        lista = await rpc("listar_usuarios");
    } catch (erro) {
        return erroNaTela(raiz, erro);
    }

    const agora = Date.now();
    const contas = new Set(lista.map((u) => u.user_id));
    const donos = lista.filter((u) => u.tipo === "proprietario" || u.tipo === "gerente");
    const semMfaMaster = lista.filter((u) => u.tipo === "master" && !u.mfa).length;
    const inativos30 = donos.filter((u) => u.ativo && (!u.ultimo_acesso || agora - new Date(u.ultimo_acesso).getTime() > TRINTA_DIAS)).length;
    const comAcesso = new Set(donos.filter((u) => u.ativo).map((u) => u.barbearia_id)).size;
    const nuncaEntraram =donos.filter((u) => u.ativo && !u.ultimo_acesso).length;
    const barbearias = [...new Map(donos.map((u) => [u.barbearia_id, u.barbearia])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "pt-BR"));

    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Usuários", subtitulo: "Contas de login · dados reais do Supabase",
            acoes: html`
                <button class="btn" type="button" data-acao="exportar">${icone("download")}<span>Exportar CSV</span></button>
                <button class="btn" type="button" data-acao="atualizar">${icone("refresh-cw")}<span class="btn__texto-opcional">Atualizar</span></button>`
        })}
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Contas de login", valor: numero(contas.size), iconeNome: "users", nota: "Contas distintas no Supabase", destaque: true })}
            ${kpi({ rotulo: "Donos e gerentes ativos", valor: numero(donos.filter((u) => u.ativo).length), iconeNome: "crown", nota: comAcesso === 1 ? "1 barbearia com acesso" : `${numero(comAcesso)} barbearias com acesso` })}
            ${kpi({ rotulo: "Sem acesso há 30 dias", valor: numero(inativos30), iconeNome: "clock", nota: nuncaEntraram ? `${numero(nuncaEntraram)} nunca entraram` : "Donos e gerentes ativos" })}
            ${kpi({ rotulo: "Contas sem vínculo", valor: numero(lista.filter((u) => u.tipo === "sem_vinculo").length), iconeNome: "user-round-x", nota: "Não acessam nenhum painel" })}
        </section>
        ${semMfaMaster ? html`<div class="alerta alerta--atencao secao" role="note">${icone("shield-alert")}<span>${numero(semMfaMaster)} administrador(es) do SaaS ainda sem verificação em duas etapas. O primeiro login no Barber Control pede o cadastro.</span></div>` : ""}
        <div class="barra-filtros barra-filtros--solta">
            ${campoBusca({ id: "uBusca", valor: filtros.busca, placeholder: "Pesquisar e-mail, nome ou barbearia" })}
            ${campoSelect({ id: "uTipo", rotulo: "Tipo", valor: filtros.tipo, opcoes: [["", "Todos os tipos"], ...Object.entries(TIPOS).map(([k, v]) => [k, v.rotulo])] })}
            ${campoSelect({ id: "uBarbearia", rotulo: "Barbearia", valor: filtros.barbearia, opcoes: [["", "Todas as barbearias"], ...barbearias] })}
            ${campoSelect({ id: "uSituacao", rotulo: "Situação", valor: filtros.situacao, opcoes: [["", "Todas as situações"], ...Object.entries(SITUACAO).map(([k, v]) => [k, v.rotulo])] })}
        </div>
        <section class="card"><div data-tabela></div></section>
        <p class="texto-terc texto-pequeno">Senhas não são exibidas. Para criar o acesso de um dono, use a página da barbearia. Desativar um acesso não apaga a conta.</p>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "email", rotulo: "Conta", render: (u) => html`<strong>${u.email}</strong>${u.nome ? html`<span class="celula-sub">${u.nome}</span>` : ""}` },
            { chave: "tipo", rotulo: "Tipo", valor: (u) => TIPOS[u.tipo]?.rotulo, render: (u) => badgeStatus(TIPOS, u.tipo) },
            { chave: "barbearia", rotulo: "Barbearia", render: (u) => (u.barbearia_id
                ? html`<a class="link-forte" href="#/barbearias/${u.barbearia_id}">${u.barbearia}</a>${u.barbearia_status && u.barbearia_status !== "ativa" ? html`<span class="celula-sub">${STATUS_BARBEARIA[u.barbearia_status]?.rotulo ?? u.barbearia_status}</span>` : ""}`
                : "—") },
            { chave: "situacao", rotulo: "Situação", valor: (u) => SITUACAO[situacao(u)].rotulo, render: (u) => badgeStatus(SITUACAO, situacao(u)) },
            { chave: "mfa", rotulo: "Duas etapas", valor: (u) => (u.mfa ? 1 : 0), render: (u) => (u.mfa ? html`<span class="badge badge--sucesso">${icone("shield-check")}Ativa</span>` : html`<span class="texto-terc">Não</span>`) },
            { chave: "ultimo_acesso", rotulo: "Último acesso", valor: (u) => u.ultimo_acesso ?? "", render: (u) => (u.ultimo_acesso ? html`<span title="${dataHora(u.ultimo_acesso)}">${tempoRelativo(u.ultimo_acesso)}</span>` : "Nunca entrou") },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (u) => (u.membro_id
                ? (u.ativo
                    ? botaoIcone({ acao: "desativar", id: u.membro_id, nomeIcone: "user-x", rotulo: `Desativar o acesso de ${u.email} a ${u.barbearia}`, perigo: true })
                    : botaoIcone({ acao: "reativar", id: u.membro_id, nomeIcone: "user-check", rotulo: `Reativar o acesso de ${u.email} a ${u.barbearia}` }))
                : "") }
        ],
        ordenacao: { chave: "tipo", direcao: "asc" }, vazio: "Nenhuma conta com os filtros atuais.", rotulo: "Usuários"
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => lista.filter((u) =>
        (!filtros.tipo || u.tipo === filtros.tipo) &&
        (!filtros.barbearia || u.barbearia_id === filtros.barbearia) &&
        (!filtros.situacao || situacao(u) === filtros.situacao) &&
        (!filtros.busca || normalizar(`${u.email} ${u.nome} ${u.barbearia}`).includes(normalizar(filtros.busca))));
    tabela.definirLinhas(filtrar());

    const ao = (id, evento, chave) => raiz.querySelector(id).addEventListener(evento, (e) => { filtros[chave] = e.target.value; tabela.definirLinhas(filtrar()); });
    ao("#uBusca", "input", "busca");
    ao("#uTipo", "change", "tipo");
    ao("#uBarbearia", "change", "barbearia");
    ao("#uSituacao", "change", "situacao");

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao } = botao.dataset;
        if (acao === "atualizar") return renderLista(view);
        if (acao === "exportar") {
            const linhas = filtrar();
            if (!linhas.length) return mostrarToast("Nada para exportar com os filtros atuais.", "atencao");
            baixarCsv(`usuarios-${isoLocal(new Date())}.csv`, [
                { rotulo: "E-mail", valor: (u) => u.email },
                { rotulo: "Nome", valor: (u) => u.nome ?? "" },
                { rotulo: "Tipo", valor: (u) => TIPOS[u.tipo]?.rotulo ?? u.tipo },
                { rotulo: "Barbearia", valor: (u) => u.barbearia ?? "" },
                { rotulo: "Situação", valor: (u) => SITUACAO[situacao(u)].rotulo },
                { rotulo: "Duas etapas", valor: (u) => (u.mfa ? "Sim" : "Não") },
                { rotulo: "E-mail confirmado", valor: (u) => (u.email_confirmado ? "Sim" : "Não") },
                { rotulo: "Último acesso", valor: (u) => (u.ultimo_acesso ? dataHora(u.ultimo_acesso) : "Nunca") },
                { rotulo: "Desde", valor: (u) => dataHora(u.criado_em) }
            ], linhas);
            return mostrarToast("Planilha CSV gerada.", "sucesso");
        }
        if (acao === "desativar" || acao === "reativar") {
            const u = lista.find((x) => x.membro_id === botao.dataset.id);
            const ativar = acao === "reativar";
            const ok = await confirmar({
                titulo: ativar ? "Reativar acesso?" : "Desativar acesso?",
                mensagem: ativar
                    ? `${u.email} volta a entrar no painel de ${u.barbearia}.`
                    : `${u.email} deixa de entrar no painel de ${u.barbearia}. A conta não é apagada e pode ser reativada.`,
                textoConfirmar: ativar ? "Reativar" : "Desativar", perigo: !ativar
            });
            if (!ok) return;
            try {
                await rpc("alterar_membro", { p_membro: u.membro_id, p_ativo: ativar });
                mostrarToast(ativar ? "Acesso reativado." : "Acesso desativado.", "sucesso");
                renderLista(view);
            } catch (erro) {
                mostrarToast(erro.message, "erro");
            }
        }
    });
}

export function render(view) {
    renderLista(view);
}
