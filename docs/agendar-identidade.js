// ==========================================
// AGENDAR — IDENTIDADE DA BARBEARIA
// Troca o nome, as iniciais e o endereço fixos do HTML pelos da
// barbearia aberta (?b=slug), lidos de configuracoes_site (já filtrado
// por barbearia pelo tenant-cliente.js). Somente leitura; todo texto
// entra por textContent.
// ==========================================

(function () {
    "use strict";

    const client = window.supabaseClient;
    const atual = window.BarbeariaAtual;
    if (!client || !atual) return;

    const texto = (v) => (typeof v === "string" ? v.trim() : "");

    function iniciais(nome) {
        const palavras = nome.split(/\s+/).filter((p) => p && !/^(de|da|do|das|dos|e)$/i.test(p));
        return palavras.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "B";
    }

    function aplicar(nome, endereco) {
        if (nome) {
            document.querySelectorAll("a.logo").forEach((el) => { el.textContent = nome.toUpperCase(); });
            document.querySelectorAll(".booking-summary h2").forEach((el) => { el.textContent = nome; });
            document.querySelectorAll(".summary-logo").forEach((el) => { el.textContent = iniciais(nome); });
            document.title = `Agendar horário — ${nome}`;
            const meta = document.querySelector('meta[name="description"]');
            if (meta) meta.setAttribute("content", `Agende seu horário na ${nome}.`);
        }
        document.querySelectorAll(".summary-address").forEach((el) => {
            el.textContent = endereco;
            el.hidden = !endereco;
        });
    }

    atual.pronta.then(async (estado) => {
        if (!estado || estado.modo !== "multi" || !estado.id) return;
        const referencia = estado.slug === (atual.slugReferencia || "navalha-de-ouro");

        let config = {};
        try {
            const { data } = await client
                .from("configuracoes_site")
                .select("nome_barbearia, endereco, cidade, estado")
                .limit(1);
            config = (Array.isArray(data) && data[0]) || {};
        } catch (erro) {
            console.error("Identidade da barbearia:", erro);
        }

        const nome = texto(config.nome_barbearia) || texto(estado.nome);
        const cidadeUf = [texto(config.cidade), texto(config.estado)].filter(Boolean).join(" — ");
        const endereco = [texto(config.endereco), cidadeUf].filter(Boolean).join(" · ");

        // Na barbearia de referência, mantém o endereço do HTML se o painel não tiver um.
        if (referencia && !endereco) return aplicar(nome, document.querySelector(".summary-address")?.textContent.trim() || "");
        aplicar(nome, endereco);
    });
})();
