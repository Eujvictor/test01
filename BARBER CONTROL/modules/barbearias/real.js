// =====================================================================
// MÓDULO 02 — BARBEARIAS (MODO REAL: painel Master)
// Rotas: #/barbearias            → lista de barbearias (Supabase)
//        #/barbearias/<uuid>     → detalhe, status e acessos
//
// Toda operação passa pelas funções control_api (administrador + MFA,
// validados no servidor) e fica registrada em control.auditoria.
// A conta do proprietário é criada pela Edge Function control-admin
// (a chave secreta fica só no servidor).
// =====================================================================
import { rpc, invocarFuncao } from "../../services/control-api.js";
import { APP_CONFIG } from "../../config/app.config.js";
import { STATUS_BARBEARIA, UFS } from "../../services/demo/catalogo.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero, dataHora, tempoRelativo } from "../../js/utilities/format.js";
import { mostrarToast, confirmar } from "../../js/utilities/feedback.js";
import { criarTabela } from "../../js/components/tabela.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { abrirPainel } from "../../js/components/painel.js";
import {
    cabecalho, kpi, badgeStatus, estadoVazio, listaDefinicao, botaoIcone, campoBusca, campoSelect, novaRaiz
} from "../../js/components/ui.js";

const filtros = { busca: "", status: "" };
const PAPEIS = { proprietario: "Proprietário", gerente: "Gerente" };
const SLUG = /^[a-z0-9-]{3,40}$/;

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sugerirSlug = (nome) => normalizar(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const urlSite = (slug) => `${APP_CONFIG.sitePublicoUrl}?b=${encodeURIComponent(slug)}`;

function erroNaTela(raiz, erro) {
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Barbearias", subtitulo: "Painel Master" })}
        <section class="card">${estadoVazio({ iconeNome: "plug-zap", titulo: "Não foi possível carregar as barbearias", texto: erro.message })}</section>`);
}

// ---------------------------------------------------------------------
// Formulário de cadastro/edição
// ---------------------------------------------------------------------
async function editarBarbearia(atual = null) {
    return abrirFormulario({
        titulo: atual ? `Editar ${atual.nome}` : "Nova barbearia",
        descricao: atual ? "" : "A barbearia começa em teste, já com site e horários próprios. Depois crie o acesso do proprietário.",
        campos: [
            { tipo: "secao", rotulo: "Barbearia" },
            { nome: "nome", rotulo: "Nome da barbearia", tipo: "texto", obrigatorio: true, maxlength: 80, largura: "meia" },
            { nome: "slug", rotulo: "Endereço do site (slug)", tipo: "texto", obrigatorio: Boolean(atual), maxlength: 40, largura: "meia",
                ajuda: atual ? "Mudar o endereço muda o link do site." : "Em branco: gerado a partir do nome. Letras minúsculas, números e hífen.",
                validar: (v) => (SLUG.test(v) ? null : "Use 3 a 40 letras minúsculas, números ou hífen.") },
            { nome: "cidade", rotulo: "Cidade", tipo: "texto", maxlength: 80, largura: "meia" },
            { nome: "estado", rotulo: "Estado", tipo: "select", largura: "meia", opcoes: [["", "—"], ...UFS.map((u) => [u, u])] },
            { nome: "razao_social", rotulo: "Razão social", tipo: "texto", maxlength: 120, largura: "meia" },
            { nome: "documento", rotulo: "CNPJ/CPF", tipo: "texto", maxlength: 20, largura: "meia" },
            { nome: "dominio", rotulo: "Domínio próprio (opcional)", tipo: "texto", maxlength: 120, ajuda: "Para uso futuro. Ex.: www.barbeariaa.com.br" },
            { tipo: "secao", rotulo: "Proprietário (contato)" },
            { nome: "proprietario_nome", rotulo: "Nome", tipo: "texto", maxlength: 120, largura: "meia" },
            { nome: "proprietario_email", rotulo: "E-mail", tipo: "email", maxlength: 120, largura: "meia", ajuda: "Usado como sugestão ao criar o acesso." },
            { nome: "proprietario_telefone", rotulo: "Telefone", tipo: "tel", maxlength: 20, largura: "meia" },
            { nome: "observacoes", rotulo: "Observações internas", tipo: "textarea", maxlength: 500 }
        ],
        valores: atual ? { ...atual, slug: atual.slug } : {},
        textoSalvar: atual ? "Salvar alterações" : "Cadastrar barbearia",
        aoSalvar: async (v) => {
            const dados = { ...v, slug: v.slug || sugerirSlug(v.nome) };
            try {
                return await rpc("salvar_barbearia", { p_id: atual?.id ?? null, p_dados: dados });
            } catch (erro) {
                const texto = `${erro.message} ${erro.original?.message ?? ""}`;
                if (texto.includes("slug_em_uso")) throw Object.assign(new Error("Este endereço já é usado por outra barbearia."), { campo: "slug" });
                if (texto.includes("slug_invalido")) throw Object.assign(new Error("Endereço inválido."), { campo: "slug" });
                if (texto.includes("estado_invalido")) throw Object.assign(new Error("Estado inválido."), { campo: "estado" });
                throw erro;
            }
        }
    });
}

// ---------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------
async function renderLista(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Barbearias", subtitulo: "Carregando do Supabase…" })}`);
    let lista;
    try {
        lista = await rpc("listar_barbearias");
    } catch (erro) {
        return erroNaTela(raiz, erro);
    }

    const cont = (st) => lista.filter((b) => b.status === st).length;
    renderizar(raiz, html`
        ${cabecalho({
            titulo: "Barbearias", subtitulo: "Painel Master · dados reais do Supabase",
            acoes: html`<button class="btn btn--primario" type="button" data-acao="nova">${icone("plus")}<span>Nova barbearia</span></button>`
        })}
        <section class="grade grade--kpi secao">
            ${kpi({ rotulo: "Barbearias", valor: numero(lista.length), iconeNome: "store", nota: "Cadastradas no SaaS", destaque: true })}
            ${kpi({ rotulo: "Ativas", valor: numero(cont("ativa")), iconeNome: "circle-check", nota: "Site e painel liberados" })}
            ${kpi({ rotulo: "Em teste", valor: numero(cont("teste")), iconeNome: "hourglass", nota: "Período de teste" })}
            ${kpi({ rotulo: "Suspensas ou canceladas", valor: numero(cont("suspensa") + cont("cancelada")), iconeNome: "ban", nota: "Site fora do ar" })}
        </section>
        <div class="barra-filtros barra-filtros--solta">
            ${campoBusca({ id: "rBusca", valor: filtros.busca, placeholder: "Pesquisar nome, endereço, cidade ou proprietário" })}
            ${campoSelect({ id: "rStatus", rotulo: "Status", valor: filtros.status, opcoes: [["", "Todos os status"], ...Object.entries(STATUS_BARBEARIA).map(([k, v]) => [k, v.rotulo])] })}
        </div>
        <section class="card"><div data-tabela></div></section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "nome", rotulo: "Barbearia", render: (b) => html`<a class="link-forte" href="#/barbearias/${b.id}">${b.nome}</a>${b.protegida ? html` <span class="badge badge--ouro" title="Barbearia de referência: não pode ser suspensa nem cancelada">Referência</span>` : ""}<span class="celula-sub">?b=${b.slug}</span>` },
            { chave: "status", rotulo: "Status", valor: (b) => STATUS_BARBEARIA[b.status]?.rotulo, render: (b) => badgeStatus(STATUS_BARBEARIA, b.status) },
            { chave: "cidade", rotulo: "Cidade", valor: (b) => `${b.cidade ?? ""} ${b.estado ?? ""}`, render: (b) => (b.cidade ? `${b.cidade}${b.estado ? `/${b.estado}` : ""}` : "—") },
            { chave: "proprietario_nome", rotulo: "Proprietário", render: (b) => html`${b.proprietario_nome || "—"}<span class="celula-sub">${b.proprietario_email || ""}</span>` },
            { chave: "membros", rotulo: "Acessos", classe: "col-num", valor: (b) => Number(b.membros), render: (b) => numero(b.membros) },
            { chave: "servicos", rotulo: "Serviços", classe: "col-num", valor: (b) => Number(b.servicos), render: (b) => numero(b.servicos) },
            { chave: "agendamentos_30d", rotulo: "Agend. 30 dias", classe: "col-num", valor: (b) => Number(b.agendamentos_30d), render: (b) => numero(b.agendamentos_30d) },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (b) => html`
                ${botaoIcone({ acao: "abrir", id: b.id, nomeIcone: "eye", rotulo: `Abrir ${b.nome}` })}
                <a class="btn btn--fantasma btn--icone btn--pequeno" href="${urlSite(b.slug)}" target="_blank" rel="noopener" title="Abrir o site público" aria-label="Abrir o site público de ${b.nome}">${icone("external-link")}</a>` }
        ],
        ordenacao: { chave: "nome", direcao: "asc" }, vazio: "Nenhuma barbearia com os filtros atuais.", rotulo: "Barbearias"
    });
    raiz.querySelector("[data-tabela]").appendChild(tabela.elemento);
    const filtrar = () => lista.filter((b) =>
        (!filtros.status || b.status === filtros.status) &&
        (!filtros.busca || normalizar(`${b.nome} ${b.slug} ${b.cidade} ${b.proprietario_nome} ${b.proprietario_email}`).includes(normalizar(filtros.busca))));
    tabela.definirLinhas(filtrar());

    raiz.querySelector("#rBusca").addEventListener("input", (e) => { filtros.busca = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.querySelector("#rStatus").addEventListener("change", (e) => { filtros.status = e.target.value; tabela.definirLinhas(filtrar()); });
    raiz.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-acao]");
        if (!b) return;
        if (b.dataset.acao === "abrir") window.location.hash = `#/barbearias/${b.dataset.id}`;
        if (b.dataset.acao === "nova") {
            const id = await editarBarbearia();
            if (id) {
                mostrarToast("Barbearia cadastrada em teste, com site e horários próprios.", "sucesso");
                window.location.hash = `#/barbearias/${id}`;
            }
        }
    });
}

// ---------------------------------------------------------------------
// Detalhe: dados, status e acessos
// ---------------------------------------------------------------------
async function renderDetalhe(view, id) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Barbearia", subtitulo: "Carregando…", voltar: { href: "#/barbearias", rotulo: "Barbearias" } })}`);
    let b;
    let membros;
    try {
        [b, membros] = await Promise.all([
            rpc("listar_barbearias").then((l) => l.find((x) => x.id === id)),
            rpc("listar_membros", { p_barbearia: id })
        ]);
    } catch (erro) {
        return erroNaTela(raiz, erro);
    }
    if (!b) {
        renderizar(raiz, html`
            ${cabecalho({ titulo: "Barbearia não encontrada", voltar: { href: "#/barbearias", rotulo: "Barbearias" } })}
            <section class="card">${estadoVazio({ iconeNome: "store", titulo: "Registro inexistente" })}</section>`);
        return;
    }

    const acoesStatus = [
        ["ativa", "Ativar", "circle-check"], ["teste", "Colocar em teste", "hourglass"],
        ["suspensa", "Suspender", "pause-circle"], ["cancelada", "Cancelar", "x-circle"]
    ].filter(([st]) => st !== b.status && !(b.protegida && (st === "suspensa" || st === "cancelada")));

    renderizar(raiz, html`
        ${cabecalho({
            titulo: b.nome, voltar: { href: "#/barbearias", rotulo: "Barbearias" },
            extra: html`${badgeStatus(STATUS_BARBEARIA, b.status)}${b.protegida ? html` <span class="badge badge--ouro">Referência protegida</span>` : ""}`,
            subtitulo: `Endereço do site: ?b=${b.slug}`,
            acoes: html`
                <a class="btn" href="${urlSite(b.slug)}" target="_blank" rel="noopener">${icone("external-link")}<span>Abrir site</span></a>
                <button class="btn" type="button" data-acao="editar">${icone("pencil")}<span>Editar</span></button>`
        })}
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Dados</h2></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Cidade", b.cidade ? `${b.cidade}${b.estado ? `/${b.estado}` : ""}` : "—"],
                    ["Proprietário", b.proprietario_nome], ["E-mail de contato", b.proprietario_email],
                    ["Domínio próprio", b.dominio], ["Barbeiros ativos", numero(b.barbeiros)], ["Serviços ativos", numero(b.servicos)],
                    ["Agendamentos (30 dias)", numero(b.agendamentos_30d)], ["Cadastrada em", dataHora(b.criado_em)]
                ])}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Status</h2></div>
                <div class="card__corpo">
                    <p class="texto-sec texto-pequeno">Ativa e Em teste: site no ar e painel liberado. Suspensa: site fora do ar e painel só para consulta. Cancelada: sem acesso.</p>
                    <div class="acoes-linha">${acoesStatus.map(([st, rot, ic]) => html`
                        <button class="btn ${st === "suspensa" || st === "cancelada" ? "btn--perigo" : ""}" type="button" data-acao="status" data-status="${st}">${icone(ic)}<span>${rot}</span></button>`)}</div>
                    ${b.protegida ? html`<p class="texto-terc texto-pequeno">Esta é a barbearia de referência: o banco recusa suspensão e cancelamento.</p>` : ""}
                </div>
            </section>
        </div>
        <section class="card">
            <div class="card__cabecalho">
                <h2 class="card__titulo">Acessos ao painel da barbearia</h2>
                <div class="acoes-linha">
                    <button class="btn btn--primario btn--pequeno" type="button" data-acao="criar-acesso">${icone("user-plus")}<span>Criar acesso do proprietário</span></button>
                    <button class="btn btn--pequeno" type="button" data-acao="vincular">${icone("link")}<span>Vincular conta existente</span></button>
                </div>
            </div>
            <div data-membros></div>
        </section>`);

    const tabela = criarTabela({
        colunas: [
            { chave: "email", rotulo: "E-mail" },
            { chave: "papel", rotulo: "Papel", valor: (m) => PAPEIS[m.papel], render: (m) => PAPEIS[m.papel] ?? m.papel },
            { chave: "ativo", rotulo: "Situação", valor: (m) => (m.ativo ? 1 : 0), render: (m) => badgeStatus({ sim: { rotulo: "Ativo", tom: "sucesso" }, nao: { rotulo: "Desativado", tom: "neutro" } }, m.ativo ? "sim" : "nao") },
            { chave: "ultimo_acesso", rotulo: "Último acesso", render: (m) => (m.ultimo_acesso ? tempoRelativo(m.ultimo_acesso) : "Nunca entrou") },
            { chave: "acoes", rotulo: "", ordenavel: false, classe: "col-acoes", render: (m) => (m.ativo
                ? botaoIcone({ acao: "desativar-membro", id: m.id, nomeIcone: "user-x", rotulo: `Desativar o acesso de ${m.email}`, perigo: true })
                : botaoIcone({ acao: "reativar-membro", id: m.id, nomeIcone: "user-check", rotulo: `Reativar o acesso de ${m.email}` })) }
        ],
        vazio: "Nenhum acesso criado. Use “Criar acesso do proprietário”.", rotulo: "Acessos"
    });
    raiz.querySelector("[data-membros]").appendChild(tabela.elemento);
    tabela.definirLinhas(membros);

    const recarregar = () => renderDetalhe(view, id);

    raiz.addEventListener("click", async (e) => {
        const botao = e.target.closest("[data-acao]");
        if (!botao) return;
        const { acao } = botao.dataset;
        try {
            if (acao === "editar") {
                if (await editarBarbearia(b)) { mostrarToast("Barbearia atualizada.", "sucesso"); recarregar(); }
            }
            if (acao === "status") {
                const novo = botao.dataset.status;
                const grave = novo === "suspensa" || novo === "cancelada";
                const salvo = await abrirFormulario({
                    titulo: `${STATUS_BARBEARIA[novo].rotulo}: ${b.nome}`,
                    descricao: grave ? "O site sai do ar na hora. Suspensa: o dono só consulta o painel. Cancelada: o dono perde o acesso." : "O site e o painel voltam a funcionar.",
                    campos: [{ nome: "motivo", rotulo: "Motivo (fica na auditoria)", tipo: "textarea", maxlength: 300, obrigatorio: grave }],
                    textoSalvar: STATUS_BARBEARIA[novo].rotulo, perigo: grave,
                    aoSalvar: (v) => rpc("alterar_status_barbearia", { p_id: id, p_status: novo, p_motivo: v.motivo || null })
                });
                if (salvo) { mostrarToast(`Status alterado para ${STATUS_BARBEARIA[novo].rotulo}.`, "sucesso"); recarregar(); }
            }
            if (acao === "criar-acesso") {
                const resultado = await abrirFormulario({
                    titulo: "Criar acesso do proprietário",
                    descricao: "Cria a conta de login com uma senha temporária, mostrada uma única vez, e libera o painel desta barbearia.",
                    campos: [
                        { nome: "email", rotulo: "E-mail do proprietário", tipo: "email", obrigatorio: true, maxlength: 120 },
                        { nome: "nome", rotulo: "Nome", tipo: "texto", maxlength: 120 }
                    ],
                    valores: { email: b.proprietario_email ?? "", nome: b.proprietario_nome ?? "" },
                    textoSalvar: "Criar acesso",
                    aoSalvar: (v) => invocarFuncao("control-admin", { acao: "criar_proprietario", barbearia_id: id, email: v.email, nome: v.nome })
                });
                if (resultado) {
                    await abrirPainel({
                        titulo: resultado.conta_existente ? "Conta existente vinculada" : "Acesso criado",
                        conteudo: resultado.conta_existente
                            ? html`<p>A conta <strong>${resultado.email}</strong> já existia e agora administra <strong>${b.nome}</strong>. A senha dela não foi alterada.</p>`
                            : html`
                                <p>Envie estes dados ao proprietário por um canal seguro. <strong>A senha não será mostrada de novo.</strong></p>
                                ${listaDefinicao([["Endereço de login", `${APP_CONFIG.sitePublicoUrl}area-equipe.html`], ["E-mail", resultado.email], ["Senha temporária", html`<code class="senha-temporaria">${resultado.senha_temporaria}</code>`]])}
                                <button class="btn btn--pequeno" type="button" data-copiar="${resultado.senha_temporaria}">${icone("copy")}<span>Copiar senha</span></button>
                                <p class="texto-terc texto-pequeno">Oriente o proprietário a trocar a senha no primeiro acesso.</p>`
                    });
                    recarregar();
                }
            }
            if (acao === "vincular") {
                const salvo = await abrirFormulario({
                    titulo: "Vincular conta existente",
                    descricao: "A conta precisa já existir no Supabase (Authentication → Users).",
                    campos: [
                        { nome: "email", rotulo: "E-mail da conta", tipo: "email", obrigatorio: true, maxlength: 120 },
                        { nome: "papel", rotulo: "Papel", tipo: "select", opcoes: Object.entries(PAPEIS), padrao: "proprietario" }
                    ],
                    textoSalvar: "Vincular",
                    aoSalvar: async (v) => {
                        try {
                            return await rpc("vincular_proprietario", { p_barbearia: id, p_email: v.email, p_papel: v.papel });
                        } catch (erro) {
                            const texto = `${erro.message} ${erro.original?.message ?? ""}`;
                            if (texto.includes("conta_inexistente")) throw Object.assign(new Error("Não existe conta com este e-mail. Use “Criar acesso do proprietário”."), { campo: "email" });
                            if (texto.includes("conta_master")) throw Object.assign(new Error("A conta do administrador do SaaS não pode ser vinculada."), { campo: "email" });
                            throw erro;
                        }
                    }
                });
                if (salvo) { mostrarToast("Conta vinculada à barbearia.", "sucesso"); recarregar(); }
            }
            if (acao === "desativar-membro" || acao === "reativar-membro") {
                const ativar = acao === "reativar-membro";
                const ok = await confirmar({
                    titulo: ativar ? "Reativar acesso?" : "Desativar acesso?",
                    mensagem: ativar ? "A pessoa volta a entrar no painel desta barbearia." : "A pessoa deixa de entrar no painel desta barbearia na próxima ação. A conta não é apagada.",
                    textoConfirmar: ativar ? "Reativar" : "Desativar", perigo: !ativar
                });
                if (!ok) return;
                await rpc("alterar_membro", { p_membro: botao.dataset.id, p_ativo: ativar });
                mostrarToast(ativar ? "Acesso reativado." : "Acesso desativado.", "sucesso");
                recarregar();
            }
        } catch (erro) {
            const texto = `${erro.message} ${erro.original?.message ?? ""}`;
            mostrarToast(texto.includes("barbearia_protegida") ? "A barbearia de referência não pode ser suspensa nem cancelada." : erro.message, "erro");
        }
    });

}

// Copiar senha (o painel é aberto fora da raiz do módulo): um único ouvinte.
document.addEventListener("click", async (e) => {
    const botao = e.target.closest("[data-copiar]");
    if (!botao) return;
    try {
        await navigator.clipboard.writeText(botao.dataset.copiar);
        mostrarToast("Senha copiada.", "sucesso");
    } catch {
        mostrarToast("Não foi possível copiar. Selecione e copie manualmente.", "atencao");
    }
});

export function render(view, { parametros = [] }) {
    if (parametros[0]) renderDetalhe(view, parametros[0]);
    else renderLista(view);
}

