// =====================================================================
// PAINEL — MINHA ASSINATURA (mensalidade do Barber)
// Mostra o plano, a situação e as faturas da barbearia (api.minha_assinatura)
// e abre o pagamento no Mercado Pago (Pix, cartão ou boleto) pela Edge
// Function "cobranca". Nenhuma chave do Mercado Pago passa pelo navegador.
// Funciona também com a barbearia suspensa (modo consulta), para o dono
// conseguir pagar e reativar o site.
// =====================================================================

(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const modal = $("assinaturaModal");
    const abrirBotao = $("abrirAssinatura");
    if (!modal || !abrirBotao) return;

    const corpo = $("assinaturaConteudo");
    const SITUACAO = {
        aberta: { texto: "A vencer", classe: "is-aberta" },
        vencida: { texto: "Vencida", classe: "is-vencida" },
        paga: { texto: "Paga", classe: "is-paga" }
    };
    const STATUS = {
        teste: "Período de teste",
        ativa: "Ativa",
        atrasada: "Pagamento atrasado",
        isenta: "Isenta",
        cancelada: "Cancelada"
    };
    const METODOS = { pix: "Pix", cartao: "Cartão", boleto: "Boleto", dinheiro: "Dinheiro", transferencia: "Transferência" };
    const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dia = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
    let dados = null;
    let ultimoFoco = null;

    function avisar(mensagem, tipo) {
        if (window.PainelUI) window.PainelUI.aviso(mensagem, tipo);
        else alert(mensagem);
    }

    function elemento(tag, classe, texto) {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto !== undefined) el.textContent = texto;
        return el;
    }

    // ------------------------------------------
    // Pagamento
    // ------------------------------------------
    async function pagar(faturaId, botao) {
        if (botao.disabled) return;
        const original = botao.textContent;
        botao.disabled = true;
        botao.textContent = "Abrindo o Mercado Pago…";
        try {
            const { data, error } = await window.supabaseClient.functions.invoke("cobranca", { body: { acao: "pagar", fatura_id: faturaId } });
            if (error) {
                let mensagem = "Não foi possível abrir o pagamento. Tente de novo.";
                try {
                    const conteudo = await error.context?.json?.();
                    if (conteudo && conteudo.erro) mensagem = conteudo.erro;
                } catch { /* sem detalhes */ }
                throw new Error(mensagem);
            }
            if (!data || !data.link) throw new Error("O Mercado Pago não devolveu o link de pagamento.");
            window.location.href = data.link;
        } catch (erro) {
            console.error("Pagamento:", erro);
            avisar(erro.message, "erro");
            botao.disabled = false;
            botao.textContent = original;
        }
    }

    // ------------------------------------------
    // Janela "Minha assinatura"
    // ------------------------------------------
    function desenhar() {
        corpo.replaceChildren();
        if (!dados) {
            corpo.appendChild(elemento("p", "assinatura-vazio", "Não foi possível carregar a assinatura."));
            return;
        }

        const resumo = elemento("div", "assinatura-resumo");
        const itens = [
            ["Plano", `${dados.plano} · ${moeda(dados.preco_mensal)}/mês`],
            ["Situação", STATUS[dados.status] || dados.status],
            dados.status === "teste"
                ? ["Teste grátis até", dia(dados.teste_ate)]
                : ["Próximo vencimento", ["isenta", "cancelada"].includes(dados.status) ? "—" : dia(dados.proximo_vencimento)]
        ];
        itens.forEach(([rotulo, valor]) => {
            const bloco = elemento("div", "assinatura-resumo__item");
            bloco.append(elemento("span", "", rotulo), elemento("strong", "", valor));
            resumo.appendChild(bloco);
        });
        corpo.appendChild(resumo);

        if (dados.status === "isenta") {
            corpo.appendChild(elemento("p", "assinatura-nota", "Esta barbearia é isenta: não há mensalidade."));
            return;
        }

        const titulo = elemento("h3", "assinatura-subtitulo", "Faturas");
        corpo.appendChild(titulo);
        const faturas = Array.isArray(dados.faturas) ? dados.faturas : [];
        if (!faturas.length) {
            corpo.appendChild(elemento("p", "assinatura-vazio",
                dados.status === "teste" ? `Nenhuma fatura ainda. A primeira vence no fim do teste (${dia(dados.teste_ate)}).` : "Nenhuma fatura ainda."));
            return;
        }

        const lista = elemento("ul", "assinatura-faturas");
        faturas.forEach((f) => {
            const sit = SITUACAO[f.situacao] || { texto: f.situacao, classe: "" };
            const item = elemento("li", `assinatura-fatura ${sit.classe}`);
            const info = elemento("div", "assinatura-fatura__info");
            info.append(
                elemento("strong", "", `${moeda(f.valor)} · ${f.plano}`),
                elemento("span", "", f.status === "paga"
                    ? `Paga em ${dia(f.pago_em)}${f.metodo ? ` · ${METODOS[f.metodo] || f.metodo}` : ""}`
                    : `Vence em ${dia(f.vencimento)}${f.dias_atraso ? ` · ${f.dias_atraso} dia(s) de atraso` : ""}`)
            );
            const lado = elemento("div", "assinatura-fatura__lado");
            lado.appendChild(elemento("span", `assinatura-selo ${sit.classe}`, sit.texto));
            if (f.status === "aberta") {
                const botao = elemento("button", "primary-button assinatura-pagar", "Pagar");
                botao.type = "button";
                botao.addEventListener("click", () => pagar(f.id, botao));
                lado.appendChild(botao);
            }
            item.append(info, lado);
            lista.appendChild(item);
        });
        corpo.appendChild(lista);
        corpo.appendChild(elemento("p", "assinatura-nota", "Pagamento seguro pelo Mercado Pago: Pix, cartão de crédito ou boleto. A confirmação chega aqui automaticamente."));
    }

    function abrir() {
        ultimoFoco = document.activeElement;
        desenhar();
        modal.classList.add("active");
        $("fecharAssinaturaModal")?.focus();
        carregar().then(desenhar);
    }

    function fechar() {
        modal.classList.remove("active");
        if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }

    // ------------------------------------------
    // Aviso no topo do painel (atraso, suspensão, fim do teste)
    // ------------------------------------------
    function mostrarAviso() {
        document.querySelector(".assinatura-aviso")?.remove();
        if (!dados || ["isenta", "cancelada"].includes(dados.status)) return;
        const faturas = Array.isArray(dados.faturas) ? dados.faturas : [];
        const vencida = faturas.find((f) => f.situacao === "vencida");
        const aberta = faturas.find((f) => f.status === "aberta");
        let texto = "";
        let grave = false;

        if (dados.barbearia_status === "suspensa" && dados.suspensa_por_inadimplencia) {
            texto = "Site suspenso por falta de pagamento. Pague a fatura em aberto e ele volta ao ar automaticamente.";
            grave = true;
            const consulta = document.querySelector(".aviso-somente-consulta");
            if (consulta) consulta.textContent = "Painel em modo consulta até a confirmação do pagamento. Use “Minha assinatura” para pagar.";
        } else if (vencida) {
            const restam = Math.max(0, Number(dados.dias_tolerancia || 7) - Number(vencida.dias_atraso || 0));
            texto = `Sua mensalidade de ${moeda(vencida.valor)} venceu em ${dia(vencida.vencimento)}. ` +
                (restam > 0 ? `O site será suspenso em ${restam} dia(s) se não houver pagamento.` : "O site pode ser suspenso a qualquer momento.");
            grave = true;
        } else if (aberta) {
            texto = `Mensalidade de ${moeda(aberta.valor)} disponível, com vencimento em ${dia(aberta.vencimento)}.`;
        } else {
            return;
        }

        const aviso = elemento("div", `assinatura-aviso${grave ? " is-grave" : ""}`);
        aviso.setAttribute("role", grave ? "alert" : "status");
        aviso.appendChild(elemento("span", "", texto));
        const botao = elemento("button", "assinatura-aviso__botao", grave ? "Pagar agora" : "Ver fatura");
        botao.type = "button";
        botao.addEventListener("click", abrir);
        aviso.appendChild(botao);
        (document.querySelector(".main-content") || document.body).prepend(aviso);
    }

    async function carregar() {
        try {
            const { data, error } = await window.supabaseClient.schema("api").rpc("minha_assinatura");
            if (error) throw error;
            dados = data;
        } catch (erro) {
            const codigo = String(erro && erro.code || "");
            // Banco sem a migração de cobrança: a opção some.
            if (["PGRST202", "PGRST106", "42883"].includes(codigo)) abrirBotao.hidden = true;
            else console.error("Assinatura:", erro);
            dados = null;
        }
        return dados;
    }

    // Volta do Mercado Pago: ?pagamento=aprovado|pendente|recusado
    function tratarRetorno() {
        const url = new URL(window.location.href);
        const retorno = url.searchParams.get("pagamento");
        if (!retorno) return;
        const mensagens = {
            aprovado: ["Pagamento aprovado! A confirmação aparece em instantes.", "sucesso"],
            pendente: ["Pagamento em processamento (Pix ou boleto). Assim que for confirmado, a fatura muda para paga.", "info"],
            recusado: ["O pagamento não foi concluído. Você pode tentar de novo em Minha assinatura.", "erro"]
        };
        const [texto, tipo] = mensagens[retorno] || mensagens.pendente;
        avisar(texto, tipo);
        ["pagamento", "collection_id", "collection_status", "payment_id", "status", "external_reference", "payment_type",
            "merchant_order_id", "preference_id", "site_id", "processing_mode", "merchant_account_id"].forEach((p) => url.searchParams.delete(p));
        window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
        // O aviso do Mercado Pago pode chegar segundos depois: recarrega a situação.
        if (retorno === "aprovado") setTimeout(() => carregar().then(mostrarAviso), 6000);
    }

    abrirBotao.addEventListener("click", abrir);
    $("fecharAssinaturaModal")?.addEventListener("click", fechar);
    $("fecharAssinatura")?.addEventListener("click", fechar);
    modal.addEventListener("click", (e) => { if (e.target === modal) fechar(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("active")) fechar(); });

    async function iniciar() {
        const atual = window.BarbeariaAtual;
        if (!atual) { abrirBotao.hidden = true; return; }
        const estado = await atual.pronta;
        if (!estado || estado.modo !== "multi" || !estado.id) { abrirBotao.hidden = true; return; }
        tratarRetorno();
        await carregar();
        mostrarAviso();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
