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
    // Barbearia aberta no painel (o dono pode administrar mais de uma).
    const barbeariaAberta = () => (window.BarbeariaAtual && window.BarbeariaAtual.atual && window.BarbeariaAtual.atual.id) || null;
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
    // Pix direto: BR Code ("Pix copia e cola") no padrão do Banco Central
    // ------------------------------------------
    const ascii = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").trim();
    const campoPix = (id, valor) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;

    function crc16(texto) {
        let crc = 0xFFFF;
        for (let i = 0; i < texto.length; i++) {
            crc ^= texto.charCodeAt(i) << 8;
            for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
        }
        return crc.toString(16).toUpperCase().padStart(4, "0");
    }

    function normalizarChave(chave) {
        const c = String(chave ?? "").trim();
        const digitos = c.replace(/\D/g, "");
        // CPF/CNPJ digitados com pontuação viram só números; e-mail, telefone (+55…) e chave aleatória ficam como estão.
        if (/^[\d.\-/\s]+$/.test(c) && (digitos.length === 11 || digitos.length === 14)) return digitos;
        return c;
    }

    function codigoPix(pix, fatura) {
        const txid = ("BARBER" + String(fatura.id).replace(/[^0-9a-z]/gi, "")).slice(0, 25);
        const conta = campoPix("00", "br.gov.bcb.pix") + campoPix("01", normalizarChave(pix.chave));
        const corpo = campoPix("00", "01") + campoPix("26", conta) + campoPix("52", "0000") + campoPix("53", "986") +
            campoPix("54", Number(fatura.valor).toFixed(2)) + campoPix("58", "BR") +
            campoPix("59", ascii(pix.nome).slice(0, 25) || "BARBER") + campoPix("60", ascii(pix.cidade).slice(0, 15) || "BRASIL") +
            campoPix("62", campoPix("05", txid)) + "6304";
        return corpo + crc16(corpo);
    }

    // QR Code desenhado por biblioteca pública (carregada só quando precisa).
    let carregandoQr = null;
    function carregarQr() {
        if (window.qrcode) return Promise.resolve(window.qrcode);
        if (!carregandoQr) {
            carregandoQr = new Promise((resolve, reject) => {
                const s = document.createElement("script");
                s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
                s.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error("QR indisponível")));
                s.onerror = () => { carregandoQr = null; reject(new Error("QR indisponível")); };
                document.head.appendChild(s);
            });
        }
        return carregandoQr;
    }

    async function copiar(texto, botao) {
        try {
            await navigator.clipboard.writeText(texto);
            const original = botao.textContent;
            botao.textContent = "Copiado!";
            setTimeout(() => { botao.textContent = original; }, 2000);
        } catch {
            avisar("Não foi possível copiar. Selecione o código e copie manualmente.", "erro");
        }
    }

    async function informarPagamento(fatura, botao) {
        if (botao.disabled) return;
        botao.disabled = true;
        botao.textContent = "Enviando…";
        try {
            const { error } = await window.supabaseClient.schema("api").rpc("informar_pagamento", { p_fatura: fatura.id, p_observacao: null });
            if (error) throw error;
            avisar("Aviso enviado. Assim que o pagamento for conferido, a fatura muda para paga.", "sucesso");
            await carregar();
            desenhar();
            mostrarAviso();
        } catch (erro) {
            console.error("Aviso de pagamento:", erro);
            avisar(String(erro && erro.message).includes("fatura_nao_aberta") ? "Esta fatura já foi paga ou cancelada." : "Não foi possível enviar o aviso. Tente de novo.", "erro");
            botao.disabled = false;
            botao.textContent = "Já paguei";
        }
    }

    function painelPix(fatura) {
        const caixa = elemento("div", "assinatura-pix");
        const codigo = codigoPix(dados.pix, fatura);
        const qr = elemento("div", "assinatura-pix__qr");
        qr.appendChild(elemento("span", "assinatura-nota", "Carregando QR Code…"));
        carregarQr().then((gerador) => {
            const q = gerador(0, "M");
            q.addData(codigo);
            q.make();
            const img = document.createElement("img");
            img.src = q.createDataURL(5, 2);
            img.alt = `QR Code Pix de ${moeda(fatura.valor)}`;
            img.width = 200;
            img.height = 200;
            qr.replaceChildren(img);
        }).catch(() => qr.replaceChildren(elemento("span", "assinatura-nota", "QR Code indisponível. Use o Pix copia e cola.")));

        const info = elemento("div", "assinatura-pix__info");
        info.append(
            elemento("strong", "", `Pix de ${moeda(fatura.valor)}`),
            elemento("span", "", `Para: ${dados.pix.nome || "Barber"} · Chave: ${dados.pix.chave}`)
        );
        const campo = elemento("textarea", "assinatura-pix__codigo");
        campo.readOnly = true;
        campo.rows = 3;
        campo.value = codigo;
        campo.setAttribute("aria-label", "Pix copia e cola");
        campo.addEventListener("focus", () => campo.select());
        const botoes = elemento("div", "assinatura-pix__botoes");
        const btnCopiar = elemento("button", "secondary-button", "Copiar código Pix");
        btnCopiar.type = "button";
        btnCopiar.addEventListener("click", () => copiar(codigo, btnCopiar));
        botoes.appendChild(btnCopiar);
        if (fatura.informado_em) {
            info.appendChild(elemento("span", "assinatura-pix__aviso", `Você avisou o pagamento em ${dia(fatura.informado_em)}. Aguardando a confirmação.`));
        } else {
            const btnPaguei = elemento("button", "primary-button assinatura-pagar", "Já paguei");
            btnPaguei.type = "button";
            btnPaguei.addEventListener("click", () => informarPagamento(fatura, btnPaguei));
            botoes.appendChild(btnPaguei);
        }
        info.append(campo, botoes, elemento("span", "assinatura-nota", "Abra o app do seu banco, escolha Pix → Ler QR Code ou Pix copia e cola. Depois de pagar, toque em “Já paguei”."));
        caixa.append(qr, info);
        return caixa;
    }

    // ------------------------------------------
    // Pagamento pelo Mercado Pago (usado quando o Pix direto não está ativo)
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
            ["Barbearia", dados.barbearia || "—"],
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
            corpo.appendChild(elemento("p", "assinatura-nota", `${dados.barbearia || "Esta barbearia"} é isenta: não há mensalidade.`));
            return;
        }
        const temAberta = (dados.faturas || []).some((f) => f.status === "aberta");
        if (!temAberta && (dados.faturas || []).length && dados.status !== "cancelada") {
            corpo.appendChild(elemento("p", "assinatura-nota", dados.status === "teste"
                ? `Nada para pagar agora: a primeira fatura aparece aqui perto do fim do teste (${dia(dados.teste_ate)}).`
                : `Nada para pagar agora. A próxima fatura vence em ${dia(dados.proximo_vencimento)} e aparece aqui alguns dias antes.`));
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
            const informado = f.status === "aberta" && f.informado_em;
            lado.appendChild(elemento("span", `assinatura-selo ${informado ? "is-informado" : sit.classe}`, informado ? "Aguardando confirmação" : sit.texto));
            if (f.status === "aberta" && dados.pix) {
                const botao = elemento("button", "primary-button assinatura-pagar", informado ? "Ver Pix" : "Pagar com Pix");
                botao.type = "button";
                botao.setAttribute("aria-expanded", "false");
                botao.addEventListener("click", () => {
                    const aberto = item.querySelector(".assinatura-pix");
                    if (aberto) { aberto.remove(); botao.setAttribute("aria-expanded", "false"); return; }
                    item.appendChild(painelPix(f));
                    botao.setAttribute("aria-expanded", "true");
                });
                lado.appendChild(botao);
            } else if (f.status === "aberta") {
                const botao = elemento("button", "primary-button assinatura-pagar", "Pagar");
                botao.type = "button";
                botao.addEventListener("click", () => pagar(f.id, botao));
                lado.appendChild(botao);
            }
            item.append(info, lado);
            if (f.status === "aberta" && f.recusa) item.appendChild(elemento("p", "assinatura-recusa", `Pagamento não localizado: ${f.recusa}. Confira e avise de novo depois de pagar.`));
            lista.appendChild(item);
        });
        corpo.appendChild(lista);
        corpo.appendChild(elemento("p", "assinatura-nota", dados.pix
            ? "Pague por Pix e toque em “Já paguei”. A confirmação aparece aqui depois da conferência."
            : "Pagamento seguro pelo Mercado Pago: Pix, cartão de crédito ou boleto. A confirmação chega aqui automaticamente."));
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
        } else if (vencida && vencida.informado_em) {
            texto = `Pagamento de ${moeda(vencida.valor)} informado. Aguardando a confirmação do Barber.`;
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
            const { data, error } = await window.supabaseClient.schema("api").rpc("minha_assinatura", { p_barbearia: barbeariaAberta() });
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
