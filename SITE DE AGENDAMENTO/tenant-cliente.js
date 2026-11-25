// =====================================================================
// BARBEARIA ATUAL (multi-tenant) — site público e painel da barbearia
// ---------------------------------------------------------------------
// Carregar logo depois de criar window.supabaseClient.
//   <script src="tenant-cliente.js" data-modo="site"></script>    (site)
//   <script src="tenant-cliente.js" data-modo="painel"></script>  (painel)
//
// Site:   identifica a barbearia pelo endereço (?b=slug). Sem ?b=, abre a
//         barbearia de referência (navalha-de-ouro).
// Painel: identifica a barbearia que o usuário logado administra.
//
// Todas as consultas às 6 tabelas do Barber passam a esperar essa
// identificação e recebem o filtro barbearia_id (e, nas inserções do
// painel, o próprio barbearia_id). A SEGURANÇA de verdade está nas
// políticas RLS do banco; este filtro só garante que cada tela mostre
// a barbearia certa.
//
// Compatível com o banco ANTES das migrações multi-tenant: se as funções
// ou colunas novas ainda não existem, segue no modo antigo (sem filtro).
// =====================================================================

(function () {
    "use strict";

    const script = document.currentScript;
    const MODO = script && script.dataset.modo === "painel" ? "painel" : "site";
    const client = window.supabaseClient;
    const SLUG_PADRAO = "navalha-de-ouro";
    const TABELAS = ["BARBEIROS", "SERVIÇOS", "clientes", "agendamentos", "configuracoes_site", "configuracoes_horarios"];
    const COLUNAS_PUBLICAS_BARBEIROS = "id, nome, especialidade, ativo, barbearia_id";

    if (!client || typeof client.from !== "function") {
        console.error("tenant-cliente.js: carregue depois de criar window.supabaseClient.");
        return;
    }

    const parametro = (new URLSearchParams(window.location.search).get("b") || "").trim().toLowerCase();
    const slugPedido = /^[a-z0-9-]{3,40}$/.test(parametro) ? parametro : "";

    // Função/tabela/coluna ainda não criada no banco (migração não aplicada).
    function naoExiste(erro) {
        if (!erro) return false;
        const codigo = String(erro.code || "");
        return ["PGRST202", "PGRST205", "PGRST106", "42883", "42P01", "42703"].includes(codigo) ||
            /could not find|does not exist|not found|schema must be one of/i.test(String(erro.message || ""));
    }

    const fromOriginal = client.from.bind(client);

    async function identificar() {
        const estado = {
            modo: "legado", id: null, slug: slugPedido || SLUG_PADRAO, nome: null, status: null,
            disponivel: true, podeEditar: true, papel: null, semSessao: false, semAcesso: false,
            inexistente: false, usarViewBarbeiros: false, todas: []
        };

        try {
            if (MODO === "painel") {
                const { data: sessao } = await client.auth.getSession();
                if (!sessao || !sessao.session) {
                    estado.semSessao = true;
                    return estado;
                }
                const { data, error } = await client.schema("api").rpc("minha_barbearia");
                if (error) {
                    if (naoExiste(error)) return estado;
                    throw error;
                }
                const lista = Array.isArray(data) ? data : [];
                estado.modo = "multi";
                estado.todas = lista;
                if (!lista.length) {
                    estado.semAcesso = true;
                    return estado;
                }
                const escolhida = lista.find((b) => b.slug === slugPedido) || lista[0];
                Object.assign(estado, {
                    id: escolhida.barbearia_id, slug: escolhida.slug, nome: escolhida.nome,
                    status: escolhida.status, papel: escolhida.papel, podeEditar: escolhida.pode_editar !== false
                });
            } else {
                const { data, error } = await client.schema("api").rpc("barbearia_por_slug", { p_slug: estado.slug });
                if (error) {
                    if (naoExiste(error)) return estado;
                    throw error;
                }
                const b = Array.isArray(data) ? data[0] : data;
                estado.modo = "multi";
                if (!b) {
                    estado.inexistente = true;
                    estado.disponivel = false;
                    return estado;
                }
                Object.assign(estado, { id: b.id, slug: b.slug, nome: b.nome, status: b.status, disponivel: b.disponivel !== false });
            }

            // Migração 03 aplicada, mas a 04 (coluna barbearia_id) ainda não: modo antigo.
            const { error: erroColuna } = await fromOriginal("configuracoes_horarios").select("barbearia_id").limit(1);
            if (erroColuna && naoExiste(erroColuna)) {
                estado.modo = "legado";
                estado.id = null;
                return estado;
            }

            // Equipe pública sem telefone (view criada pela migração 06).
            if (MODO === "site") {
                const { error: erroView } = await client.schema("api").from("barbeiros_publicos").select("id").limit(1);
                estado.usarViewBarbeiros = !erroView;
            }
        } catch (erro) {
            console.error("Não foi possível identificar a barbearia:", erro);
            estado.erro = String((erro && erro.message) || erro);
        }
        return estado;
    }

    const pronta = identificar();
    // Guarda a barbearia identificada (usado por site-padrao.js para não
    // mostrar dados da barbearia de referência em outra barbearia).
    pronta.then((estado) => {
        if (window.BarbeariaAtual) window.BarbeariaAtual.atual = estado;
    });

    // ------------------------------------------
    // Consultas: grava as chamadas e só executa depois de identificar
    // ------------------------------------------
    function colunasPublicas(selecao) {
        const texto = String(selecao || "*").trim();
        if (texto === "*" || texto === "") return COLUNAS_PUBLICAS_BARBEIROS;
        const colunas = texto.split(",").map((c) => c.trim()).filter((c) => c && c !== "telefone");
        return colunas.length ? colunas.join(", ") : COLUNAS_PUBLICAS_BARBEIROS;
    }

    function comBarbearia(valor, id) {
        if (Array.isArray(valor)) return valor.map((v) => ({ ...v, barbearia_id: id }));
        return { ...valor, barbearia_id: id };
    }

    function montar(tabela, chamadas, estado) {
        const usarView = MODO === "site" && tabela === "BARBEIROS" && estado.usarViewBarbeiros;
        let consulta = usarView ? client.schema("api").from("barbeiros_publicos") : fromOriginal(tabela);
        const filtrar = estado.modo === "multi" && estado.id;

        chamadas.forEach(([metodo, args], indice) => {
            let a = args;
            if (indice === 0) {
                if (usarView && metodo === "select") a = [colunasPublicas(args[0]), ...args.slice(1)];
                if (filtrar && (metodo === "insert" || metodo === "upsert")) a = [comBarbearia(args[0], estado.id), ...args.slice(1)];
                consulta = consulta[metodo](...a);
                if (filtrar && (metodo === "select" || metodo === "update" || metodo === "delete")) {
                    consulta = consulta.eq("barbearia_id", estado.id);
                }
                return;
            }
            consulta = consulta[metodo](...a);
        });

        // Site de barbearia inexistente: nenhuma consulta retorna dados.
        if (MODO === "site" && estado.modo === "multi" && !estado.id) {
            return Promise.resolve({ data: [], error: null, count: 0, status: 200 });
        }
        return consulta;
    }

    client.from = function (tabela) {
        if (!TABELAS.includes(tabela)) return fromOriginal(tabela);
        const chamadas = [];
        const executar = () => pronta.then((estado) => montar(tabela, chamadas, estado));
        const proxy = new Proxy(function () {}, {
            get(_alvo, metodo) {
                if (metodo === "then") return (ok, falha) => executar().then(ok, falha);
                if (metodo === "catch") return (falha) => executar().catch(falha);
                if (metodo === "finally") return (fim) => executar().finally(fim);
                return (...args) => {
                    chamadas.push([metodo, args]);
                    return proxy;
                };
            }
        });
        return proxy;
    };

    // ------------------------------------------
    // Site: links internos levam o ?b= e aviso de indisponível
    // ------------------------------------------
    function manterSlugNosLinks() {
        if (!slugPedido) return;
        document.querySelectorAll("a[href]").forEach((a) => {
            const href = a.getAttribute("href");
            if (!href || /^(https?:|mailto:|tel:|#|javascript:)/i.test(href) || !/\.html(\?|#|$)/.test(href)) return;
            const url = new URL(href, window.location.href);
            if (url.searchParams.has("b")) return; // já está certo: não regravar (evita laço)
            url.searchParams.set("b", slugPedido);
            a.setAttribute("href", url.pathname.split("/").pop() + url.search + url.hash);
        });
    }

    function avisoIndisponivel(estado) {
        const caixa = document.createElement("div");
        caixa.className = "barbearia-indisponivel";
        caixa.setAttribute("role", "alert");
        const titulo = document.createElement("strong");
        titulo.textContent = estado.inexistente ? "Barbearia não encontrada" : "Site temporariamente indisponível";
        const texto = document.createElement("span");
        texto.textContent = estado.inexistente
            ? "Confira o endereço digitado."
            : `${estado.nome || "Esta barbearia"} não está recebendo agendamentos pelo site no momento.`;
        caixa.append(titulo, texto);
        const estilo = document.createElement("style");
        estilo.textContent = ".barbearia-indisponivel{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;background:#0b0b0b;color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;text-align:center}.barbearia-indisponivel strong{font-size:24px}.barbearia-indisponivel span{color:#a3a3a3}";
        document.head.appendChild(estilo);
        document.body.appendChild(caixa);
    }

    function aoCarregar(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
        else fn();
    }

    if (MODO === "site") {
        aoCarregar(() => {
            manterSlugNosLinks();
            // site-config.js troca links depois de carregar (botões configuráveis):
            // reaplica o ?b= quando algum href mudar.
            if (slugPedido && window.MutationObserver) {
                let agendado = false;
                new MutationObserver(() => {
                    if (agendado) return;
                    agendado = true;
                    queueMicrotask(() => { agendado = false; manterSlugNosLinks(); });
                }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
            }
        });
        pronta.then((estado) => {
            if (estado.modo === "multi" && !estado.disponivel) aoCarregar(() => avisoIndisponivel(estado));
        });
    }

    // ------------------------------------------
    // Funcionalidades liberadas pelo Barber Control (migração 15)
    //   if (await BarbeariaAtual.tem("fidelidade")) { ...mostra a novidade... }
    // "Em teste" só aparece na barbearia de referência e nas pilotos;
    // "Liberada" aparece em todas. Qualquer falha = desligada.
    // ------------------------------------------
    const funcionalidades = pronta.then(async (estado) => {
        if (estado.modo !== "multi" || !estado.id) return [];
        try {
            const { data, error } = await client.schema("api").rpc("funcionalidades_ligadas", { p_barbearia: estado.id });
            return !error && Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    });

    // Atalho no HTML: <div data-funcionalidade="fidelidade">…</div> fica
    // escondido e só aparece quando a funcionalidade está ligada.
    const estilo = document.createElement("style");
    estilo.textContent = "[data-funcionalidade]:not(.funcionalidade-ligada){display:none !important}";
    document.head.appendChild(estilo);
    const mostrarLigadas = (lista) => document.querySelectorAll("[data-funcionalidade]").forEach((el) => {
        el.classList.toggle("funcionalidade-ligada", lista.includes(el.dataset.funcionalidade));
    });
    funcionalidades.then((lista) => {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mostrarLigadas(lista));
        else mostrarLigadas(lista);
    });

    window.BarbeariaAtual = {
        modo: MODO,
        slugPedido,
        slugReferencia: SLUG_PADRAO,
        atual: null,
        pronta,
        funcionalidades,
        // Reaplica o atalho data-funcionalidade em conteúdo criado depois.
        mostrarFuncionalidades() {
            return funcionalidades.then(mostrarLigadas);
        },
        tem(codigo) {
            return funcionalidades.then((lista) => lista.includes(String(codigo || "").trim().toLowerCase()));
        },
        // Chave de cache por barbearia (site-config.js e site-tema.js).
        chaveCache(base) {
            return slugPedido && slugPedido !== SLUG_PADRAO ? `${base}:${slugPedido}` : base;
        }
    };
})();
