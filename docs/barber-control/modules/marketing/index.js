// =====================================================================
// MÓDULO 09 — MARKETING E RELACIONAMENTO (modo demonstrativo)
// Rotas: #/marketing                     → campanhas
//        #/marketing/cupons | indicacoes | pesquisas | segmentacao
//        #/marketing/campanha/<id>       → detalhe da campanha
//        #/marketing/pesquisa/<id>       → resultados da pesquisa
// Nenhuma mensagem, convite ou cobrança é enviada.
// =====================================================================
import * as O from "../../services/demo/operacao.js";
import { html, renderizar, bruto } from "../../js/utilities/dom.js";
import { numero, percentual } from "../../js/utilities/format.js";
import { cabecalho, avisoDemo, kpi, novaRaiz, tratarRestauracaoDemo } from "../../js/components/ui.js";
import * as Campanhas from "./campanhas.js";
import * as Cupons from "./cupons.js";
import * as Indicacoes from "./indicacoes.js";
import * as Pesquisas from "./pesquisas.js";
import * as Segmentacao from "./segmentacao.js";

const SECOES = [
    ["", "Campanhas", Campanhas], ["cupons", "Cupons", Cupons], ["indicacoes", "Indicações", Indicacoes],
    ["pesquisas", "Pesquisas de satisfação", Pesquisas], ["segmentacao", "Segmentação", Segmentacao]
];

function kpis() {
    const r = O.resumoMarketing();
    return html`
        ${kpi({ rotulo: "Campanhas cadastradas", valor: numero(r.cadastradas), iconeNome: "megaphone", nota: "Todas as campanhas" })}
        ${kpi({ rotulo: "Campanhas ativas", valor: numero(r.ativas), iconeNome: "circle-play", nota: "Dentro do período" })}
        ${kpi({ rotulo: "Finalizadas", valor: numero(r.finalizadas), iconeNome: "flag", nota: "Período encerrado" })}
        ${kpi({ rotulo: "Cupons criados", valor: numero(r.cupons), iconeNome: "ticket-percent", nota: "Todos os status" })}
        ${kpi({ rotulo: "Empresas participantes", valor: numero(r.participantes), iconeNome: "store", nota: "No público das campanhas ativas" })}
        ${kpi({ rotulo: "Conversões", valor: numero(r.conversoes), iconeNome: "target", nota: "Demonstrativas" })}
        ${kpi({ rotulo: "Taxa de conversão", valor: percentual(r.taxaConversao), iconeNome: "percent", nota: "Conversões ÷ público impactado (estimativa)", destaque: true })}`;
}

function abas(ativa) {
    return html`
        <nav class="abas abas--navegacao" aria-label="Seções de marketing">
            ${SECOES.map(([rota, rotulo]) => html`
                <a class="abas__aba" href="#/marketing${rota ? `/${rota}` : ""}" ${rota === ativa ? bruto('aria-current="page"') : ""}>${rotulo}</a>`)}
        </nav>`;
}

// Moldura comum às seções; cada seção desenha seu conteúdo em [data-secao].
export function moldura(view, ativa, recarregar) {
    const raiz = novaRaiz(view);
    renderizar(raiz, html`
        ${cabecalho({ titulo: "Marketing e relacionamento", subtitulo: "Crescimento, retenção e relacionamento com as barbearias" })}
        ${avisoDemo()}
        <section class="grade grade--kpi secao" data-kpis>${kpis()}</section>
        ${abas(ativa)}
        <div data-secao></div>`);
    raiz.addEventListener("click", (e) => {
        if (e.target.closest("[data-acao=restaurar-demo]")) tratarRestauracaoDemo(recarregar);
    });
    return {
        raiz,
        secao: raiz.querySelector("[data-secao]"),
        atualizarIndicadores: () => renderizar(raiz.querySelector("[data-kpis]"), kpis())
    };
}

export function render(view, { parametros = [] }) {
    const [primeiro, segundo] = parametros;
    if (primeiro === "campanha" && segundo) return Campanhas.renderDetalhe(view, segundo);
    if (primeiro === "pesquisa" && segundo) return Pesquisas.renderDetalhe(view, segundo);
    const secao = SECOES.find(([rota]) => rota === (primeiro ?? "")) ?? SECOES[0];
    const recarregar = () => render(view, { parametros });
    const ctx = moldura(view, secao[0], recarregar);
    secao[2].renderSecao(ctx, recarregar);
}
