// =====================================================================
// MÓDULO 19 — CONFIGURAÇÕES (MODO REAL)
// Rota: #/configuracoes
// • Aparência: preferências deste navegador (tema, densidade, linhas por
//   página, animações, página inicial), lidas pelo app ao abrir.
// • Cobrança, segurança de acesso e integrações: situação REAL do sistema,
//   com atalho para onde cada regra é alterada.
// =====================================================================
import { rpc } from "../../services/control-api.js";
import { statusServidor } from "../../js/auth.js";
import { APP_CONFIG } from "../../config/app.config.js";
import { html, icone, renderizar } from "../../js/utilities/dom.js";
import { numero } from "../../js/utilities/format.js";
import { mostrarToast } from "../../js/utilities/feedback.js";
import { cabecalho, listaDefinicao, novaRaiz, opcoesSelect } from "../../js/components/ui.js";

const CHAVE = "barber-control:aparencia";
const PADRAO = { tema: "escuro", densidade: "confortavel", itensPorPagina: "10", reduzirAnimacoes: false, paginaInicial: "dashboard" };
const CAMPOS = [
    ["tema", "Tema", [["escuro", "Escuro (padrão)"], ["contraste", "Escuro com alto contraste"]]],
    ["densidade", "Densidade da interface", [["confortavel", "Confortável"], ["compacta", "Compacta"]]],
    ["itensPorPagina", "Linhas por página nas tabelas", [["10", "10"], ["25", "25"], ["50", "50"]]],
    ["reduzirAnimacoes", "Animações", [["false", "Normais"], ["true", "Reduzidas"]]],
    ["paginaInicial", "Página ao abrir o painel", [["dashboard", "Visão geral"], ["relatorios", "Relatórios e métricas"], ["inteligencia", "Inteligência de negócio"], ["auditoria", "Auditoria e acessos"]]]
];

function lerAparencia() {
    try {
        return { ...PADRAO, ...(JSON.parse(window.localStorage.getItem(CHAVE) || "null") || {}) };
    } catch {
        return { ...PADRAO };
    }
}

function badge(ok, textoOk, textoNao, tomNao = "atencao") {
    return ok ? html`<span class="badge badge--sucesso"><span class="ponto"></span>${textoOk}</span>`
        : html`<span class="badge badge--${tomNao}"><span class="ponto"></span>${textoNao}</span>`;
}

export async function render(view) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`${cabecalho({ titulo: "Configurações", subtitulo: "Carregando…" })}`);
    const [financeiro, servidor] = await Promise.allSettled([rpc("financeiro_resumo", { p_meses: 1 }), statusServidor()]);
    const fin = financeiro.status === "fulfilled" ? financeiro.value : null;
    const cfg = fin?.config ?? {};
    const metodos = fin?.por_metodo ?? {};
    const mpAtivo = ["pix", "cartao", "boleto"].some((m) => Number(metodos[m]) > 0);
    const funcaoOk = servidor.status === "fulfilled" && servidor.value?.ok;
    const ap = lerAparencia();

    renderizar(raiz, html`
        ${cabecalho({ titulo: "Configurações", subtitulo: "Preferências deste navegador e regras reais do sistema" })}
        <div class="grade grade--2 secao">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Aparência</h2><span class="badge">só neste navegador</span></div>
                <form class="card__corpo formulario-linha" data-form="aparencia">
                    ${CAMPOS.map(([nome, rotulo, opcoes]) => html`
                        <label class="campo"><span class="campo__rotulo">${rotulo}</span>
                            <select class="entrada" name="${nome}">${opcoesSelect(opcoes, String(ap[nome]))}</select></label>`)}
                    <div class="acoes-linha">
                        <button class="btn btn--primario" type="submit">${icone("save")}<span>Salvar aparência</span></button>
                        <button class="btn" type="button" data-acao="padrao">${icone("rotate-ccw")}<span>Restaurar padrão</span></button>
                    </div>
                </form>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Integrações</h2></div>
                <ul class="lista">
                    <li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">Supabase (banco e login)</div><div class="lista__meta">${APP_CONFIG.supabaseUrl.replace("https://", "")}</div></div>${badge(Boolean(fin), "Operacional", "Sem resposta", "erro")}</li>
                    <li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">Edge Function control-admin</div><div class="lista__meta">${funcaoOk ? `Versão ${servidor.value.versao}` : "Criação de acessos dos donos"}</div></div>${badge(funcaoOk, "Operacional", "Sem resposta", "erro")}</li>
                    <li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">Mercado Pago (pagamento online)</div><div class="lista__meta">${mpAtivo ? "Pagamentos confirmados pelo webhook" : "Falta publicar a função cobranca e configurar os Secrets (guia ATIVAR-MERCADO-PAGO.md)"}</div></div>${badge(mpAtivo, "Ativo", "Pendente")}</li>
                    <li class="lista__item"><div class="lista__conteudo"><div class="lista__titulo">Rotina diária de cobrança</div><div class="lista__meta">Gera faturas, marca atrasos e suspende quem passou do prazo</div></div>${badge(Boolean(fin?.rotina_agendada), "Agendada · 6h", "Não agendada")}</li>
                </ul>
            </section>
        </div>
        <div class="grade grade--2">
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Cobrança</h2><a class="badge" href="#/assinaturas/planos">Alterar em Assinaturas</a></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Fatura gerada antes do vencimento", fin ? `${numero(cfg.dias_antecedencia)} dia(s)` : "—"],
                    ["Suspensão automática por atraso", fin ? `${numero(cfg.dias_tolerancia)} dia(s)` : "—"],
                    ["Barbearia de referência", "Isenta e nunca suspensa"],
                    ["Pagamento", "Fatura mensal: Pix, cartão ou boleto (Mercado Pago)"]
                ])}</div>
            </section>
            <section class="card">
                <div class="card__cabecalho"><h2 class="card__titulo">Segurança de acesso</h2><a class="badge" href="#/seguranca">Ver Segurança</a></div>
                <div class="card__corpo">${listaDefinicao([
                    ["Verificação em duas etapas", "Obrigatória para o Barber Control"],
                    ["Sessão sem uso", `Encerrada após ${numero(APP_CONFIG.seguranca.inatividadeMinutos)} minutos`],
                    ["Tentativas de login", "Bloqueio após 5 falhas (mesmo e-mail e IP) em 15 minutos"],
                    ["Versão do painel", APP_CONFIG.versao]
                ])}</div>
            </section>
        </div>`);

    const form = raiz.querySelector("[data-form=aparencia]");
    const salvar = (valores) => {
        try {
            window.localStorage.setItem(CHAVE, JSON.stringify(valores));
        } catch {
            mostrarToast("Este navegador bloqueou o armazenamento local.", "erro");
            return;
        }
        const r = document.documentElement;
        r.dataset.tema = valores.tema === "contraste" ? "contraste" : "escuro";
        r.dataset.densidade = valores.densidade === "compacta" ? "compacta" : "confortavel";
        r.dataset.animacoes = valores.reduzirAnimacoes ? "reduzidas" : "normais";
        mostrarToast("Aparência salva neste navegador.", "sucesso");
    };
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = Object.fromEntries(CAMPOS.map(([nome]) => [nome, form.elements[nome].value]));
        salvar({ ...v, reduzirAnimacoes: v.reduzirAnimacoes === "true" });
    });
    raiz.querySelector("[data-acao=padrao]").addEventListener("click", () => {
        salvar({ ...PADRAO });
        render(view);
    });
}
