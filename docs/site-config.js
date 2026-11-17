// ==========================================
// SITE PÚBLICO — CONFIGURAÇÕES DO PAINEL
// Lê configuracoes_site (conteúdo) e
// configuracoes_horarios (WhatsApp e horários)
// e aplica no index.html.
// Somente leitura. Todo texto entra por
// textContent; links e imagens são validados.
// ==========================================

(function () {
    "use strict";

    const PADRAO = window.SITE_PADRAO || {};
    const CACHE_KEY = "navalha_site_config_v1";

    const DIAS = [
        { key: "segunda", label: "Segunda" },
        { key: "terca", label: "Terça" },
        { key: "quarta", label: "Quarta" },
        { key: "quinta", label: "Quinta" },
        { key: "sexta", label: "Sexta" },
        { key: "sabado", label: "Sábado" },
        { key: "domingo", label: "Domingo" }
    ];

    const SECOES = {
        servicos: "mostrar_servicos",
        portfolio: "mostrar_portfolio",
        equipe: "mostrar_equipe",
        avaliacoes: "mostrar_avaliacoes",
        instagram: "mostrar_instagram",
        localizacao: "mostrar_localizacao"
    };

    // ------------------------------------------
    // UTILITÁRIOS
    // ------------------------------------------

    function texto(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function valor(config, key) {
        const v = texto(config[key]);
        return v || texto(PADRAO[key]);
    }

    function booleano(config, key) {
        if (typeof config[key] === "boolean") return config[key];
        return PADRAO[key] !== false;
    }

    // Aceita https/http, âncoras (#secao) e páginas locais (agendar.html).
    function linkSeguro(value, fallback) {
        const v = texto(value);

        if (!v) return fallback || "";

        if (/^#[\w-]*$/.test(v)) return v;

        if (/^[\w-]+\.html(#[\w-]+)?$/.test(v)) return v;

        try {
            const url = new URL(v);

            if (url.protocol === "https:" || url.protocol === "http:") {
                return url.href;
            }
        } catch {
            // inválido
        }

        return fallback || "";
    }

    function imagemSegura(value) {
        const v = texto(value);

        if (!v) return "";

        try {
            const url = new URL(v);
            return url.protocol === "https:" ? url.href : "";
        } catch {
            return "";
        }
    }

    function corSegura(value) {
        const v = texto(value);
        return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : "";
    }

    function setTexto(selector, value) {
        document.querySelectorAll(selector).forEach(el => {
            el.textContent = value;
        });
    }

    function setLink(el, href) {
        if (!el || !href) return;

        el.setAttribute("href", href);

        if (/^https?:/.test(href)) {
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noopener noreferrer");
        } else {
            el.removeAttribute("target");
            el.removeAttribute("rel");
        }
    }

    function parseJSON(value, fallback) {
        if (value && typeof value === "object") return value;

        if (typeof value !== "string") return fallback;

        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }

    function linhas(container, lista) {
        if (!container) return;

        container.innerHTML = "";

        lista.forEach(item => {
            const p = document.createElement("p");

            item.forEach((parte, index) => {
                if (index > 0) p.appendChild(document.createElement("br"));
                p.appendChild(document.createTextNode(parte));
            });

            container.appendChild(p);
        });
    }

    // ------------------------------------------
    // HORÁRIOS E WHATSAPP (configuracoes_horarios)
    // ------------------------------------------

    function agruparDias(diasAtivos) {
        const ativos = new Set(
            (Array.isArray(diasAtivos) ? diasAtivos : [])
                .map(d => String(d).toLowerCase())
        );

        const grupos = [];
        let atual = [];

        DIAS.forEach(dia => {
            if (ativos.has(dia.key)) {
                atual.push(dia.label);
            } else if (atual.length) {
                grupos.push(atual);
                atual = [];
            }
        });

        if (atual.length) grupos.push(atual);

        return grupos.map(grupo => {
            if (grupo.length === 1) return grupo[0];
            if (grupo.length === 2) return `${grupo[0]} e ${grupo[1]}`;
            return `${grupo[0]} a ${grupo[grupo.length - 1]}`;
        }).join(", ");
    }

    function lerHorarios(horarios) {
        if (!horarios) return null;

        const dias = parseJSON(horarios.dias_funcionamento, null) ||
            String(horarios.dias_funcionamento || "")
                .split(",")
                .map(d => d.trim())
                .filter(Boolean);

        const abertura = String(horarios.horario_abertura || "").substring(0, 5);
        const fechamento = String(horarios.horario_fechamento || "").substring(0, 5);
        const diasTexto = agruparDias(dias);

        if (!diasTexto || !abertura || !fechamento) return null;

        return {
            dias: diasTexto,
            horas: `${abertura} — ${fechamento}`
        };
    }

    function lerWhatsapp(horarios) {
        if (!horarios) return "";

        const bloqueados = parseJSON(horarios.horarios_bloqueados, {}) || {};
        const config = bloqueados.__whatsapp_config || {};
        let digits = String(config.phone || "").replace(/\D/g, "");

        if (!digits) return "";

        if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
            digits = `55${digits}`;
        }

        return digits.length >= 12 ? digits : "";
    }

    // ------------------------------------------
    // APLICAR NO HTML
    // ------------------------------------------

    function aplicarIdentidade(config) {
        const nome = valor(config, "nome_barbearia");
        const logo = imagemSegura(config.logo_url);

        document.querySelectorAll("[data-site-logo]").forEach(el => {
            el.textContent = "";

            if (logo) {
                const img = document.createElement("img");
                img.src = logo;
                img.alt = nome;
                img.className = "logo-img";
                el.appendChild(img);
            } else {
                el.textContent = nome;
            }

            el.setAttribute("aria-label", nome);
        });

        setTexto("[data-site-nome]", nome);

        document.title = texto(config.titulo_pagina) ||
            (texto(config.nome_barbearia)
                ? `${texto(config.nome_barbearia)} — Barbearia`
                : PADRAO.titulo_pagina);

        const meta = document.querySelector('meta[name="description"]');

        if (meta) meta.setAttribute("content", valor(config, "descricao_curta"));

        [
            "texto_identificacao",
            "titulo_principal",
            "descricao_principal",
            "texto_botao_cabecalho",
            "estatistica_1_numero",
            "estatistica_1_texto",
            "estatistica_2_numero",
            "estatistica_2_texto",
            "estatistica_3_numero",
            "estatistica_3_texto",
            "servicos_titulo",
            "servicos_descricao",
            "portfolio_titulo",
            "portfolio_descricao",
            "equipe_titulo",
            "equipe_descricao",
            "avaliacoes_titulo",
            "instagram",
            "instagram_descricao",
            "texto_botao_instagram",
            "texto_botao_google",
            "texto_rodape"
        ].forEach(key => setTexto(`[data-site="${key}"]`, valor(config, key)));

        // Textos opcionais: somem quando vazios.
        ["avaliacoes_descricao", "texto_botao_avaliacao"].forEach(key => {
            const v = valor(config, key);

            document.querySelectorAll(`[data-site="${key}"]`).forEach(el => {
                el.textContent = v;
                el.hidden = !v;
            });
        });

        const banner = imagemSegura(config.banner_url);
        const hero = document.querySelector("[data-site-banner]");

        if (hero && banner) {
            hero.style.backgroundImage = `url("${banner}")`;
        }
    }

    function aplicarBotoes(config) {
        const principal = document.querySelector('[data-site-btn="principal"]');
        const secundario = document.querySelector('[data-site-btn="secundario"]');
        const cabecalho = document.querySelector('[data-site-btn="cabecalho"]');

        if (principal) {
            principal.textContent = valor(config, "texto_botao_principal");
            setLink(principal, linkSeguro(config.link_botao_principal, PADRAO.link_botao_principal));
        }

        if (secundario) {
            secundario.textContent = valor(config, "texto_botao_secundario");
            setLink(secundario, linkSeguro(config.link_botao_secundario, PADRAO.link_botao_secundario));
        }

        if (cabecalho) {
            cabecalho.textContent = valor(config, "texto_botao_cabecalho");
        }
    }

    function aplicarSecoes(config) {
        Object.entries(SECOES).forEach(([secao, key]) => {
            const visivel = booleano(config, key);

            document
                .querySelectorAll(`[data-site-secao="${secao}"], [data-site-nav="${secao}"]`)
                .forEach(el => {
                    el.hidden = !visivel;
                });
        });

        document.querySelectorAll("[data-site-direitos]").forEach(el => {
            el.hidden = !booleano(config, "mostrar_direitos");
        });

        setTexto("[data-site-direitos]", valor(config, "texto_direitos_autorais"));
    }

    function aplicarPortfolio(config) {
        const grid = document.getElementById("portfolioGrid");

        if (!grid) return;

        const salvos = parseJSON(config.portfolio_itens, null);
        const itens = (Array.isArray(salvos) ? salvos : PADRAO.portfolio_itens || [])
            .map(item => ({
                url: imagemSegura(item && item.url),
                legenda: texto(item && item.legenda)
            }))
            .filter(item => item.url);

        grid.innerHTML = "";

        itens.forEach(item => {
            const div = document.createElement("div");
            div.className = "portfolio-item";

            const img = document.createElement("img");
            img.src = item.url;
            img.alt = item.legenda || "Trabalho da barbearia";
            img.loading = "lazy";
            div.appendChild(img);

            if (item.legenda) {
                const span = document.createElement("span");
                span.textContent = item.legenda;
                div.appendChild(span);
            }

            grid.appendChild(div);
        });

        grid.hidden = itens.length === 0;
    }

    function aplicarAvaliacoes(config) {
        const grid = document.getElementById("reviewsGrid");

        if (!grid) return;

        const salvas = parseJSON(config.avaliacoes, null);
        const lista = (Array.isArray(salvas) ? salvas : PADRAO.avaliacoes || [])
            .map(item => ({
                estrelas: Math.min(5, Math.max(1, Number(item && item.estrelas) || 5)),
                nome: texto(item && item.nome),
                texto: texto(item && item.texto)
            }))
            .filter(item => item.nome && item.texto);

        grid.innerHTML = "";

        lista.forEach(item => {
            const card = document.createElement("article");
            card.className = "review-card";

            const stars = document.createElement("div");
            stars.className = "stars";
            stars.textContent = "★".repeat(item.estrelas) + "☆".repeat(5 - item.estrelas);
            stars.setAttribute("aria-label", `${item.estrelas} de 5 estrelas`);

            const p = document.createElement("p");
            p.textContent = `“${item.texto}”`;

            const strong = document.createElement("strong");
            strong.textContent = item.nome;

            card.append(stars, p, strong);
            grid.appendChild(card);
        });

        grid.hidden = lista.length === 0;

        setLink(
            document.querySelector("[data-site-link-google]"),
            linkSeguro(config.link_avaliacao_google, PADRAO.link_avaliacao_google)
        );
    }

    function aplicarInstagram(config) {
        const link = linkSeguro(config.instagram_link, PADRAO.instagram_link);

        document.querySelectorAll("[data-site-link-instagram]").forEach(el => {
            setLink(el, link);
        });
    }

    function aplicarLocalizacao(config, horarios) {
        const endereco = valor(config, "endereco");
        const cidade = valor(config, "cidade");
        const estado = valor(config, "estado");
        const cep = texto(config.cep);

        const cidadeUf = [cidade, estado].filter(Boolean).join(" — ");
        const enderecoCompleto = [endereco, cidadeUf].filter(Boolean).join(", ");
        const linhaEndereco = [enderecoCompleto, cep ? `CEP ${cep}` : ""]
            .filter(Boolean)
            .join(" · ");

        setTexto('[data-site="endereco_completo"]', linhaEndereco);
        setTexto('[data-site="endereco"]', endereco);
        setTexto('[data-site="telefone"]', valor(config, "telefone"));

        const mapsBusca =
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [endereco, cidade, estado, cep].filter(Boolean).join(", ")
            )}`;

        setLink(
            document.querySelector("[data-site-link-maps]"),
            linkSeguro(config.google_maps_link, mapsBusca)
        );

        // WhatsApp: mesmo número configurado no card "WhatsApp" do painel.
        const whatsapp = lerWhatsapp(horarios);

        document.querySelectorAll("[data-site-link-whatsapp]").forEach(el => {
            if (horarios) {
                el.hidden = !whatsapp;
            }

            if (whatsapp) setLink(el, `https://wa.me/${whatsapp}`);
        });

        // Horários: mesmos dias/horas da aba "Horários" do painel.
        const funcionamento = lerHorarios(horarios);

        if (funcionamento) {
            document.querySelectorAll("[data-site-horarios]").forEach(el => {
                const modo = el.getAttribute("data-site-horarios");

                linhas(
                    el,
                    modo === "rodape"
                        ? [[funcionamento.dias, funcionamento.horas]]
                        : [[`${funcionamento.dias} · ${funcionamento.horas}`]]
                );
            });
        }
    }

    function aplicarCores(config) {
        const root = document.documentElement;
        const principal = corSegura(config.cor_principal);
        const fundo = corSegura(config.cor_fundo);
        const destaque = corSegura(config.cor_destaque);

        if (principal) {
            root.style.setProperty("--gold", principal);
        }

        if (destaque) {
            root.style.setProperty("--gold-light", destaque);
        }

        if (fundo) {
            root.style.setProperty("--bg", fundo);
        }

        const fonte = texto(config.fonte);

        if (/^[A-Za-z0-9 ]{2,40}$/.test(fonte)) {
            const sistema = /^(arial|helvetica|verdana|georgia|tahoma|times new roman)$/i;

            if (!sistema.test(fonte) && !document.getElementById("siteFonteLink")) {
                const link = document.createElement("link");
                link.id = "siteFonteLink";
                link.rel = "stylesheet";
                link.href =
                    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonte).replace(/%20/g, "+")}:wght@400;600;700;800&display=swap`;
                document.head.appendChild(link);
            }

            document.body.style.fontFamily = `"${fonte}", Arial, Helvetica, sans-serif`;
        }
    }

    function aplicar(config, horarios) {
        config = config || {};

        aplicarIdentidade(config);
        aplicarBotoes(config);
        aplicarSecoes(config);
        aplicarPortfolio(config);
        aplicarAvaliacoes(config);
        aplicarInstagram(config);
        aplicarLocalizacao(config, horarios);
        aplicarCores(config);
    }

    // ------------------------------------------
    // CARREGAR
    // ------------------------------------------

    function lerCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        } catch {
            return null;
        }
    }

    function salvarCache(dados) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(dados));
        } catch {
            // armazenamento indisponível: segue sem cache
        }
    }

    async function carregar() {
        // 1) Aplica a última versão conhecida na hora (evita "piscar").
        const cache = lerCache();

        if (cache && cache.site) {
            aplicar(cache.site, cache.horarios);
        }

        // 2) Busca a versão atual no Supabase.
        if (!window.supabaseClient) {
            console.error("Supabase não carregado: usando conteúdo padrão do site.");
            return;
        }

        try {
            const [siteRes, horariosRes] = await Promise.all([
                window.supabaseClient
                    .from("configuracoes_site")
                    .select("*")
                    .order("id", { ascending: true })
                    .limit(1)
                    .maybeSingle(),
                window.supabaseClient
                    .from("configuracoes_horarios")
                    .select("horario_abertura, horario_fechamento, dias_funcionamento, horarios_bloqueados")
                    .order("id", { ascending: false })
                    .limit(1)
                    .maybeSingle()
            ]);

            if (siteRes.error) {
                console.error("Erro ao carregar configurações do site:", siteRes.error);
            }

            if (horariosRes.error) {
                console.error("Erro ao carregar horários do site:", horariosRes.error);
            }

            if (siteRes.error && horariosRes.error) return;

            const dados = {
                site: siteRes.data || (cache && cache.site) || {},
                horarios: horariosRes.data || (cache && cache.horarios) || null
            };

            aplicar(dados.site, dados.horarios);
            salvarCache(dados);
        } catch (error) {
            console.error("Falha de conexão ao carregar configurações do site:", error);
        }
    }

    window.NavalhaSiteConfig = {
        aplicar,
        carregar,
        _util: { agruparDias, linkSeguro, lerWhatsapp }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", carregar);
    } else {
        carregar();
    }
})();
