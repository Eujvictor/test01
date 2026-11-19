// =====================================================================
// Tabela com ordenação por coluna e paginação.
// colunas: [{ chave, rotulo, render?(linha), valor?(linha), ordenavel?, classe? }]
// As ações das linhas usam data-acao/data-id e são tratadas pelo módulo.
// =====================================================================
import { html, icone, renderizar } from "../utilities/dom.js";
import { numero } from "../utilities/format.js";

// Collator reaproveitado: ~10x mais rápido que String.localeCompare em listas grandes.
const COMPARADOR = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

// Linhas por página preferidas (módulo 19 · Aparência). Padrão: 10.
function linhasPreferidas() {
    try {
        const n = Number(JSON.parse(window.localStorage.getItem("barber-control:aparencia") || "{}").itensPorPagina);
        return [10, 25, 50].includes(n) ? n : 10;
    } catch {
        return 10;
    }
}

export function criarTabela({ colunas, porPagina = linhasPreferidas(), ordenacao = null, vazio = "Nenhum registro encontrado.", rotulo = "Tabela" }) {
    const estado = { linhas: [], chave: ordenacao?.chave ?? null, direcao: ordenacao?.direcao ?? "asc", pagina: 1 };
    const elemento = document.createElement("div");
    elemento.className = "tabela-bloco";

    const valorDe = (coluna, linha) => (coluna.valor ? coluna.valor(linha) : linha[coluna.chave]);

    function ordenar(linhas) {
        const coluna = colunas.find((c) => c.chave === estado.chave);
        if (!coluna) return linhas;
        const fator = estado.direcao === "asc" ? 1 : -1;
        return [...linhas].sort((a, b) => {
            const va = valorDe(coluna, a);
            const vb = valorDe(coluna, b);
            if (va === vb) return 0;
            if (va === null || va === undefined || va === "") return 1;
            if (vb === null || vb === undefined || vb === "") return -1;
            const cmp = typeof va === "number" && typeof vb === "number"
                ? va - vb
                : COMPARADOR.compare(String(va), String(vb));
            return cmp * fator;
        });
    }

    function cabecalhoColuna(c) {
        if (c.ordenavel === false) return html`<th scope="col" class="${c.classe ?? ""}">${c.rotulo}</th>`;
        const ativa = estado.chave === c.chave;
        const aria = ativa ? (estado.direcao === "asc" ? "ascending" : "descending") : "none";
        const nomeIcone = ativa ? (estado.direcao === "asc" ? "chevron-up" : "chevron-down") : "chevrons-up-down";
        return html`
            <th scope="col" class="${c.classe ?? ""}" aria-sort="${aria}">
                <button type="button" class="tabela__ordenar ${ativa ? "is-ativa" : ""}" data-ordenar="${c.chave}">
                    <span>${c.rotulo}</span>${icone(nomeIcone)}
                </button>
            </th>`;
    }

    function desenhar() {
        const ordenadas = ordenar(estado.linhas);
        const total = ordenadas.length;
        const paginas = Math.max(1, Math.ceil(total / porPagina));
        estado.pagina = Math.min(Math.max(1, estado.pagina), paginas);
        const inicio = (estado.pagina - 1) * porPagina;
        const pagina = ordenadas.slice(inicio, inicio + porPagina);

        renderizar(elemento, html`
            <div class="tabela-rolagem">
                <table class="tabela" aria-label="${rotulo}">
                    <thead><tr>${colunas.map(cabecalhoColuna)}</tr></thead>
                    <tbody>
                        ${pagina.length
                            ? pagina.map((linha) => html`
                                <tr>${colunas.map((c) => html`<td class="${c.classe ?? ""}">${c.render ? c.render(linha) : (linha[c.chave] ?? "—")}</td>`)}</tr>`)
                            : html`<tr><td class="tabela__vazia" colspan="${colunas.length}">${icone("search-x")}<span>${vazio}</span></td></tr>`}
                    </tbody>
                </table>
            </div>
            <div class="tabela-rodape">
                <span class="texto-terc">${total ? `${numero(inicio + 1)}–${numero(inicio + pagina.length)} de ${numero(total)}` : "0 registros"}</span>
                ${paginas > 1 ? html`
                    <div class="paginacao">
                        <button class="btn btn--fantasma btn--icone btn--pequeno" type="button" data-pagina="${estado.pagina - 1}"
                                aria-label="Página anterior" ${estado.pagina === 1 ? "disabled" : ""}>${icone("chevron-left")}</button>
                        <span class="texto-sec num">${estado.pagina} / ${paginas}</span>
                        <button class="btn btn--fantasma btn--icone btn--pequeno" type="button" data-pagina="${estado.pagina + 1}"
                                aria-label="Próxima página" ${estado.pagina === paginas ? "disabled" : ""}>${icone("chevron-right")}</button>
                    </div>` : ""}
            </div>`);
    }

    elemento.addEventListener("click", (evento) => {
        const ordenar = evento.target.closest("[data-ordenar]");
        if (ordenar) {
            const chave = ordenar.dataset.ordenar;
            estado.direcao = estado.chave === chave && estado.direcao === "asc" ? "desc" : "asc";
            estado.chave = chave;
            desenhar();
            return;
        }
        const pagina = evento.target.closest("[data-pagina]");
        if (pagina && !pagina.disabled) {
            estado.pagina = Number(pagina.dataset.pagina);
            desenhar();
            elemento.scrollIntoView({ block: "nearest" });
        }
    });

    return {
        elemento,
        // Novo conjunto de dados (filtro/pesquisa): volta para a página 1.
        definirLinhas(linhas) {
            estado.linhas = linhas;
            estado.pagina = 1;
            desenhar();
        },
        // Mesmo conjunto atualizado (ação em uma linha): mantém a página.
        atualizarLinhas(linhas) {
            estado.linhas = linhas;
            desenhar();
        }
    };
}
