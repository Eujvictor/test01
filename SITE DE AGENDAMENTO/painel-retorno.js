// =====================================================================
// CHAMAR DE VOLTA — reativação de clientes pelo WhatsApp
// ---------------------------------------------------------------------
// Funcionalidade "chamar_de_volta", ligada pelo Barber Control
// (Funcionalidades): em teste só aparece na barbearia de referência e
// nas pilotos; liberada, aparece em todas. Desligada, este arquivo não
// muda nada no módulo Clientes.
//
// Dados (Supabase, migração 16):
//   clientes.ultimo_contato         → quando o dono chamou o cliente
//   configuracoes_site.retorno_config → { dias, mensagem, link }
// O banco só aceita gravar essas colunas com a funcionalidade ligada.
//
// Carregar depois de painel-admin-.js. Usa a ponte window.PainelClientes
// e o evento "painel:clientes-renderizados" de lá, além de escapeHTML,
// painelAviso e markSettingsDirty.
// =====================================================================

(function () {
    "use strict";

    const CODIGO = "chamar_de_volta";
    const DIAS_RECENTE = 7; // não chamar de novo antes disso sem confirmar
    const MENSAGEM_PADRAO =
        "Olá, {nome}! Tudo bem? 💈 Aqui é da {barbearia}. Percebi que já faz {dias} dias desde o seu último corte. " +
        "Que tal deixar o visual em dia? Me diga o melhor dia e horário pra você que a gente já reserva tudo, " +
        "ou agende direto por aqui: {link_agendamento}";
    const PADRAO = { dias: 15, mensagem: MENSAGEM_PADRAO, link: "" };

    let ligado = false;
    let config = { ...PADRAO };
    let configSalva = JSON.stringify(config);
    let filtro = "todos";

    const $ = (id) => document.getElementById(id);
    const esc = (v) => (typeof escapeHTML === "function" ? escapeHTML(v) : String(v ?? ""));
    const aviso = (msg, tipo) => (typeof painelAviso === "function" ? painelAviso(msg, tipo) : alert(msg));

    // ------------------------------------------
    // Datas (sempre no dia local, AAAA-MM-DD)
    // ------------------------------------------
    const isoLocal = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hoje = () => isoLocal(new Date());
    function diasEntre(deISO, ateISO) {
        const [a, b] = [deISO, ateISO].map((s) => {
            const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
            return Date.UTC(y, m - 1, d);
        });
        return Math.round((b - a) / 86400000);
    }
    const ddmm = (iso) => {
        const p = String(iso || "").slice(0, 10).split("-");
        return p.length === 3 ? `${p[2]}/${p[1]}` : "";
    };
    const ddmmaaaa = (iso) => {
        const p = String(iso || "").slice(0, 10).split("-");
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : "Nenhum";
    };

    // ------------------------------------------
    // Situação de cada cliente
    // ------------------------------------------
    function situacao(cliente) {
        const dia = hoje();
        const datas = (cliente.historico || []).map((a) => String(a.data || "").slice(0, 10)).filter(Boolean).sort();
        const passados = datas.filter((d) => d <= dia);            // já realizados (até hoje)
        const futuros = datas.filter((d) => d > dia);              // marcados para depois de hoje
        const ultimo = passados.length ? passados[passados.length - 1] : null;
        const proximo = futuros.length ? futuros[0] : null;
        const dias = ultimo ? Math.max(0, diasEntre(ultimo, dia)) : null;
        const contato = cliente.ultimoContato ? isoLocal(new Date(cliente.ultimoContato)) : null;
        const diasContato = contato ? Math.max(0, diasEntre(contato, dia)) : null;
        const inativo = !proximo && dias !== null && dias >= config.dias;
        const contatadoRecente = diasContato !== null && diasContato < DIAS_RECENTE;
        return { ultimo, proximo, dias, contato, inativo, contatadoRecente, elegivel: inativo && !contatadoRecente };
    }

    const listaClientes = () => {
        const lista = window.PainelClientes && window.PainelClientes.lista();
        return Array.isArray(lista) ? lista : [];
    };
    const elegiveis = () => listaClientes().filter((c) => situacao(c).elegivel);

    // ------------------------------------------
    // Mensagem e número
    // ------------------------------------------
    function primeiroNome(nome) {
        const p = String(nome || "").trim().split(/\s+/)[0] || "";
        return p ? p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR") : "";
    }

    function nomeBarbearia() {
        const atual = window.BarbeariaAtual && window.BarbeariaAtual.atual;
        const campo = $("barbershopName");
        return (atual && atual.nome) || (campo && campo.value.trim()) || "nossa barbearia";
    }

    function linkAgendamento() {
        if (config.link) return config.link;
        const atual = window.BarbeariaAtual && window.BarbeariaAtual.atual;
        const base = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}agendar.html`;
        const slug = atual && atual.slug;
        return slug && slug !== (window.BarbeariaAtual.slugReferencia || "navalha-de-ouro") ? `${base}?b=${slug}` : base;
    }

    function montarMensagem(cliente, sit, modelo = config.mensagem) {
        const valores = {
            nome: primeiroNome(cliente.name) || "tudo bem",
            dias: sit && sit.dias !== null ? String(sit.dias) : "alguns",
            barbearia: nomeBarbearia(),
            link_agendamento: linkAgendamento()
        };
        return String(modelo || MENSAGEM_PADRAO).replace(/\{(nome|dias|barbearia|link_agendamento)\}/g, (_, k) => valores[k]);
    }

    // Brasil: só dígitos; com DDD (10 ou 11 dígitos) recebe o 55 na frente.
    // Retorna null quando o número não é válido.
    function numeroWhatsapp(telefone) {
        let d = String(telefone || "").replace(/\D/g, "");
        if (d.length === 10 || d.length === 11) d = "55" + d;
        if (!d.startsWith("55")) return null;
        const nacional = d.slice(2);
        return nacional.length === 10 || nacional.length === 11 ? d : null;
    }

    // =================================================================
    // ENVIO — único ponto que fala com o WhatsApp.
    // Hoje abre o wa.me com a mensagem pronta (o dono só aperta Enviar).
    // Para envio 100% automático no futuro (WhatsApp Business API, Z-API,
    // Evolution API...), troque SÓ esta função por uma chamada ao servidor
    // (Edge Function do Supabase, nunca com a chave da API no navegador).
    // O resto (lista, filtros, registro do contato) continua igual.
    // =================================================================
    function enviarMensagem(cliente, texto) {
        const numero = numeroWhatsapp(cliente.phone);
        if (!numero) return false;
        window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
        return true;
    }

    async function registrarContato(cliente) {
        const agora = new Date().toISOString();
        const { error } = await window.supabaseClient
            .from("clientes")
            .update({ ultimo_contato: agora })
            .eq("id", cliente.id);
        if (error) {
            console.error("Erro ao registrar o contato:", error);
            aviso("O WhatsApp abriu, mas não foi possível registrar o contato no sistema.", "erro");
            return false;
        }
        cliente.ultimoContato = agora;
        return true;
    }

    function atualizarTela() {
        if (window.PainelClientes) window.PainelClientes.renderizar();
    }

    // Botão "Chamar de volta" do cartão.
    async function chamar(cliente) {
        const sit = situacao(cliente);
        if (!numeroWhatsapp(cliente.phone)) {
            aviso(`O WhatsApp de ${cliente.name} parece inválido (${cliente.phone || "vazio"}). Corrija o número antes de chamar.`, "erro");
            return;
        }
        if (sit.proximo && !confirm(`${cliente.name} já tem horário marcado para ${ddmm(sit.proximo)}. Chamar mesmo assim?`)) return;
        if (sit.contatadoRecente && !confirm(`Você já chamou ${cliente.name} em ${ddmm(sit.contato)}. Abrir o WhatsApp de novo?`)) return;
        if (!enviarMensagem(cliente, montarMensagem(cliente, sit))) return;
        if (await registrarContato(cliente)) atualizarTela();
    }

    // ------------------------------------------
    // Cartões: selo, botão e "Contatado em"
    // ------------------------------------------
    // Ícone oficial do WhatsApp (Simple Icons, licença CC0).
    const ICONE_WA =
        '<svg class="icone-whatsapp" viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

    function decorarCartoes() {
        const grade = $("clientsGrid");
        if (!grade) return;
        grade.querySelectorAll(".client-card").forEach((cartao) => {
            const lixeira = cartao.querySelector("[data-client-action='delete']");
            const cliente = lixeira && listaClientes().find((c) => String(c.id) === String(lixeira.dataset.id));
            if (!cliente || cartao.dataset.retorno) return;
            cartao.dataset.retorno = "1";
            const sit = situacao(cliente);

            const status = cartao.querySelector(".client-card-identity p");
            if (status) {
                let selo = esc(status.textContent.trim());
                if (sit.proximo) selo = `<span class="retorno-selo retorno-selo--agendado">Agendado para ${ddmm(sit.proximo)}</span>`;
                else if (sit.inativo) selo = `<span class="retorno-selo retorno-selo--inativo">Sem vir há ${sit.dias} dias</span>`;
                if (sit.contato) selo += ` <span class="retorno-selo retorno-selo--contato">Contatado em ${ddmm(sit.contato)}</span>`;
                status.innerHTML = selo;
                status.classList.add("retorno-status");
            }

            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "client-retorno-button" + (sit.elegivel ? " destaque" : "");
            botao.dataset.retorno = "chamar";
            botao.dataset.id = cliente.id;
            botao.title = "Chamar de volta pelo WhatsApp";
            botao.setAttribute("aria-label", `Chamar ${cliente.name} de volta pelo WhatsApp`);
            botao.innerHTML = ICONE_WA;
            lixeira.parentNode.insertBefore(botao, lixeira);

            // "Último atendimento" passa a ignorar horários futuros.
            const ultimo = cartao.querySelector(".client-data > div:nth-child(2) strong");
            if (ultimo) ultimo.textContent = ddmmaaaa(sit.ultimo);
        });
    }

    function passaFiltro(cliente) {
        if (filtro === "todos") return true;
        const sit = situacao(cliente);
        if (filtro === "inativos") return sit.inativo;
        if (filtro === "contatados") return Boolean(sit.contato);
        if (filtro === "agendados") return Boolean(sit.proximo);
        return true;
    }

    // Depois que o módulo Clientes desenha os cartões (evento da ponte em
    // painel-admin-.js): aplica o filtro, os selos, o botão e o resumo.
    function aoRenderizar() {
        if (!ligado) return;
        const grade = $("clientsGrid");
        if (!grade) return;
        decorarCartoes();
        let visiveis = 0;
        grade.querySelectorAll(".client-card").forEach((cartao) => {
            const lixeira = cartao.querySelector("[data-client-action='delete']");
            const cliente = lixeira && listaClientes().find((c) => String(c.id) === String(lixeira.dataset.id));
            const mostra = !cliente || passaFiltro(cliente);
            cartao.classList.toggle("retorno-oculto", !mostra);
            if (mostra) visiveis += 1;
        });
        grade.querySelector(".retorno-vazio")?.remove();
        if (grade.querySelector(".client-card") && !visiveis) {
            grade.insertAdjacentHTML("beforeend", '<div class="content-card retorno-vazio"><p>Nenhum cliente encontrado neste filtro.</p></div>');
        }
        const total = $("retornoTotal");
        if (total) total.textContent = elegiveis().length;
    }
    document.addEventListener("painel:clientes-renderizados", aoRenderizar);

    // A ponte do módulo Clientes é criada no DOMContentLoaded do painel.
    const ponteClientes = new Promise((ok) => {
        if (window.PainelClientes) return ok();
        document.addEventListener("painel:clientes-pronto", () => ok(), { once: true });
    });

    // ------------------------------------------
    // Filtros
    // ------------------------------------------
    document.addEventListener("click", (e) => {
        const botaoFiltro = e.target.closest("[data-retorno-filtro]");
        if (botaoFiltro) {
            filtro = botaoFiltro.dataset.retornoFiltro;
            document.querySelectorAll("[data-retorno-filtro]").forEach((b) => {
                const ativo = b === botaoFiltro;
                b.classList.toggle("ativo", ativo);
                b.setAttribute("aria-pressed", String(ativo));
            });
            atualizarTela();
            return;
        }
        const botaoChamar = e.target.closest("[data-retorno='chamar']");
        if (botaoChamar) {
            const cliente = listaClientes().find((c) => String(c.id) === String(botaoChamar.dataset.id));
            if (cliente) chamar(cliente);
        }
    });

    // ------------------------------------------
    // "Chamar todos os inativos" — um por vez
    // (o navegador bloqueia várias abas abertas de uma vez)
    // ------------------------------------------
    const modal = () => $("retornoModal");
    const fecharModal = () => modal() && modal().classList.remove("active");

    function abrirSelecao() {
        const lista = elegiveis();
        const corpo = $("retornoModalCorpo");
        const acoes = $("retornoModalAcoes");
        $("retornoModalTitulo").textContent = "Chamar todos os inativos";
        if (!lista.length) {
            corpo.innerHTML = `<p class="retorno-modal-texto">Nenhum cliente para chamar agora: todos vieram há menos de ${config.dias} dias, têm horário marcado ou já foram chamados nos últimos ${DIAS_RECENTE} dias.</p>`;
            acoes.innerHTML = `<button type="button" class="primary-button" data-retorno-modal="fechar">Entendi</button>`;
        } else {
            corpo.innerHTML = `
                <p class="retorno-modal-texto">Clientes sem vir há ${config.dias}+ dias e não chamados nos últimos ${DIAS_RECENTE} dias. Desmarque quem não quiser chamar.</p>
                <label class="retorno-marcar-todos"><input type="checkbox" id="retornoMarcarTodos" checked> <span>Marcar todos (${lista.length})</span></label>
                <ul class="retorno-lista">
                    ${lista.map((c) => {
                        const sit = situacao(c);
                        const valido = Boolean(numeroWhatsapp(c.phone));
                        return `<li><label><input type="checkbox" value="${esc(c.id)}" ${valido ? "checked" : "disabled"}>
                            <span><strong>${esc(c.name)}</strong><small>${valido ? `Sem vir há ${sit.dias} dias · ${esc(c.phone)}` : "WhatsApp inválido"}</small></span></label></li>`;
                    }).join("")}
                </ul>`;
            acoes.innerHTML = `<button type="button" class="secondary-button" data-retorno-modal="fechar">Cancelar</button>
                <button type="button" class="primary-button" data-retorno-modal="comecar">Começar</button>`;
        }
        modal().classList.add("active");
    }

    let fila = [];
    let posicao = 0;

    function mostrarPasso(mensagem) {
        const corpo = $("retornoModalCorpo");
        const acoes = $("retornoModalAcoes");
        const total = fila.length;
        const feito = posicao;
        const proximo = fila[posicao];
        $("retornoModalTitulo").textContent = feito >= total ? "Pronto!" : `Chamando ${feito + 1} de ${total}`;
        corpo.innerHTML = `
            <div class="retorno-progresso" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${feito}">
                <span style="width:${total ? Math.round((feito / total) * 100) : 0}%"></span>
            </div>
            <p class="retorno-modal-texto"><strong>${feito} de ${total}</strong> chamados.${mensagem ? ` ${esc(mensagem)}` : ""}</p>
            ${proximo ? `<p class="retorno-modal-texto">Próximo: <strong>${esc(proximo.name)}</strong></p>` : `<p class="retorno-modal-texto">Todos os clientes selecionados foram chamados.</p>`}`;
        acoes.innerHTML = proximo
            ? `<button type="button" class="secondary-button" data-retorno-modal="fechar">Parar aqui</button>
               <button type="button" class="primary-button" data-retorno-modal="proximo">${feito === 0 ? "Abrir o primeiro" : "Próximo cliente"}</button>`
            : `<button type="button" class="primary-button" data-retorno-modal="fechar">Concluir</button>`;
    }

    async function enviarProximo() {
        const cliente = fila[posicao];
        if (!cliente) return;
        const aberto = enviarMensagem(cliente, montarMensagem(cliente, situacao(cliente)));
        posicao += 1;
        if (aberto) await registrarContato(cliente);
        mostrarPasso(aberto ? `WhatsApp de ${cliente.name} aberto.` : `${cliente.name} pulado (WhatsApp inválido).`);
        atualizarTela();
    }

    document.addEventListener("click", async (e) => {
        if (e.target.closest("#retornoTodosButton")) return abrirSelecao();
        if (e.target.closest("#closeRetornoModal")) return fecharModal();
        if (e.target.id === "retornoMarcarTodos") {
            document.querySelectorAll(".retorno-lista input:not(:disabled)").forEach((c) => { c.checked = e.target.checked; });
            return;
        }
        const acao = e.target.closest("[data-retorno-modal]");
        if (!acao) return;
        const tipo = acao.dataset.retornoModal;
        if (tipo === "fechar") return fecharModal();
        if (tipo === "comecar") {
            const ids = [...document.querySelectorAll(".retorno-lista input:checked")].map((c) => c.value);
            fila = listaClientes().filter((c) => ids.includes(String(c.id)));
            posicao = 0;
            if (!fila.length) return aviso("Marque pelo menos um cliente.", "erro");
            await enviarProximo(); // primeiro abre no mesmo clique (o navegador permite)
            return;
        }
        if (tipo === "proximo") await enviarProximo();
    });

    // ------------------------------------------
    // Configurações → Mensagem de retorno
    // ------------------------------------------
    function preencherCampos() {
        if ($("retornoDias")) $("retornoDias").value = config.dias;
        if ($("retornoMensagem")) $("retornoMensagem").value = config.mensagem;
        if ($("retornoLink")) $("retornoLink").value = config.link;
        document.querySelectorAll("[data-retorno-dias]").forEach((el) => { el.textContent = config.dias; });
        atualizarPrevia();
    }

    function lerCampos() {
        return {
            dias: Number(($("retornoDias") || {}).value),
            mensagem: String(($("retornoMensagem") || {}).value || "").trim(),
            link: String(($("retornoLink") || {}).value || "").trim()
        };
    }

    function atualizarPrevia() {
        const previa = $("retornoPrevia");
        if (!previa) return;
        const campos = lerCampos();
        const exemplo = { name: "carlos silva" };
        const antes = config;
        config = { ...config, link: campos.link };
        const dias = Number.isFinite(campos.dias) && campos.dias > 0 ? campos.dias + 3 : 18;
        previa.textContent = montarMensagem(exemplo, { dias }, campos.mensagem || MENSAGEM_PADRAO);
        config = antes;
    }

    ["retornoDias", "retornoMensagem", "retornoLink"].forEach((id) => {
        document.addEventListener("input", (e) => {
            if (e.target.id !== id) return;
            atualizarPrevia();
            if (typeof markSettingsDirty === "function") markSettingsDirty();
        });
    });
    document.addEventListener("click", (e) => {
        if (e.target.closest("#retornoRestaurar")) {
            $("retornoMensagem").value = MENSAGEM_PADRAO;
            atualizarPrevia();
            if (typeof markSettingsDirty === "function") markSettingsDirty();
        }
    });

    function normalizarConfig(bruto) {
        const c = bruto && typeof bruto === "object" ? bruto : {};
        const dias = Math.round(Number(c.dias));
        return {
            dias: dias >= 1 && dias <= 365 ? dias : PADRAO.dias,
            mensagem: typeof c.mensagem === "string" && c.mensagem.trim() ? c.mensagem.slice(0, 1000) : MENSAGEM_PADRAO,
            link: typeof c.link === "string" ? c.link.slice(0, 300) : ""
        };
    }

    async function carregarConfig() {
        try {
            const { data, error } = await window.supabaseClient.from("configuracoes_site").select("retorno_config").limit(1);
            if (!error && Array.isArray(data) && data[0]) config = normalizarConfig(data[0].retorno_config);
        } catch (erro) {
            console.error("Mensagem de retorno: usando o padrão.", erro);
        }
        configSalva = JSON.stringify(config);
        preencherCampos();
    }

    // Chamado pelo botão "Salvar" das Configurações (painel-admin-.js).
    window.salvarConfigRetorno = async function () {
        if (!ligado) return true;
        const campos = lerCampos();
        if (!Number.isInteger(campos.dias) || campos.dias < 1 || campos.dias > 365) {
            aviso("Mensagem de retorno: os dias sem vir precisam ser um número de 1 a 365.", "erro");
            return false;
        }
        if (campos.link && !/^https?:\/\/\S+$/i.test(campos.link)) {
            aviso("Mensagem de retorno: o link de agendamento precisa começar com http:// ou https://.", "erro");
            return false;
        }
        const novo = normalizarConfig(campos);
        if (JSON.stringify(novo) === configSalva) return true;
        const { error } = await window.supabaseClient.from("configuracoes_site").update({ retorno_config: novo });
        if (error) {
            console.error("Erro ao salvar a mensagem de retorno:", error);
            aviso("Não foi possível salvar a mensagem de retorno.", "erro");
            return false;
        }
        config = novo;
        configSalva = JSON.stringify(novo);
        preencherCampos();
        atualizarTela();
        return true;
    };

    // ------------------------------------------
    // Início: só liga se o Barber Control liberou para esta barbearia
    // ------------------------------------------
    async function iniciar() {
        if (!window.BarbeariaAtual || typeof window.BarbeariaAtual.tem !== "function") return;
        if (!(await window.BarbeariaAtual.tem(CODIGO))) return;
        await ponteClientes;
        ligado = true;
        document.getElementById("clientes")?.classList.add("retorno-ligado");
        await carregarConfig();
        atualizarTela();
    }

    iniciar();

    // Exposto para testes e para a futura troca do envio.
    window.ChamarDeVolta = { situacao, montarMensagem, numeroWhatsapp, enviarMensagem, primeiroNome };
})();
