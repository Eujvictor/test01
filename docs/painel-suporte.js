// =====================================================================
// PAINEL — SUPORTE E COMUNICADOS DO BARBER
// Suporte: o dono abre chamados e conversa com o suporte do Barber
//   (api.meus_chamados, api.ver_chamado, api.abrir_chamado,
//   api.responder_chamado). As respostas aparecem aqui mesmo.
// Comunicados: avisos publicados pelo Barber aparecem no topo do painel
//   até o dono clicar em "Entendi" (api.meus_comunicados).
// Tudo é conferido no servidor por barbearia. Funciona também com a
// barbearia suspensa (modo consulta).
// =====================================================================

(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const modal = $("suporteModal");
    const abrirBotao = $("abrirSuporte");
    if (!modal || !abrirBotao) return;

    const corpo = $("suporteConteudo");
    const contador = $("suporteContador");
    const CATEGORIAS = {
        duvidas: "Dúvida", tecnico: "Problema técnico", agendamentos: "Agendamentos", financeiro: "Financeiro",
        assinaturas: "Assinatura", acesso: "Acesso à conta", solicitacoes: "Pedido de melhoria", outros: "Outro assunto"
    };
    const STATUS = {
        aberto: ["Aberto", "is-aberto"], em_atendimento: ["Em atendimento", "is-aberto"], aguardando: ["Respondido", "is-respondido"],
        resolvido: ["Resolvido", "is-resolvido"], encerrado: ["Encerrado", "is-encerrado"]
    };
    const api = () => window.supabaseClient.schema("api");
    const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
    let ultimoFoco = null;
    let chamados = [];

    function avisar(mensagem, tipo) {
        if (window.PainelUI) window.PainelUI.aviso(mensagem, tipo);
        else alert(mensagem);
    }

    function el(tag, classe, texto) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (texto !== undefined) e.textContent = texto;
        return e;
    }

    function botao(texto, classe, acao) {
        const b = el("button", classe, texto);
        b.type = "button";
        b.addEventListener("click", acao);
        return b;
    }

    function traduzir(erro) {
        const t = `${erro && erro.code} ${erro && erro.message}`;
        if (t.includes("limite_chamados")) return "Você já tem muitos chamados em andamento. Aguarde a resposta dos atuais.";
        if (t.includes("limite_mensagens")) return "Muitas mensagens em pouco tempo. Aguarde alguns minutos.";
        if (t.includes("chamado_encerrado")) return "Este chamado foi encerrado. Abra um novo, se precisar.";
        if (t.includes("assunto_obrigatorio")) return "Escreva um assunto com pelo menos 3 letras.";
        if (t.includes("mensagem_obrigatoria")) return "Escreva a mensagem.";
        return "Não foi possível concluir. Tente de novo.";
    }

    function atualizarContador() {
        const novos = chamados.filter((c) => c.nao_lido).length;
        contador.textContent = novos ? String(novos) : "";
        contador.hidden = !novos;
        abrirBotao.setAttribute("aria-label", novos ? `Suporte: ${novos} resposta(s) nova(s)` : "Suporte");
    }

    async function carregarChamados() {
        const { data, error } = await api().rpc("meus_chamados");
        if (error) throw error;
        chamados = Array.isArray(data) ? data : [];
        atualizarContador();
        return chamados;
    }

    // ------------------------------------------
    // Telas da janela
    // ------------------------------------------
    function telaLista() {
        corpo.replaceChildren();
        const topo = el("div", "suporte-topo");
        topo.append(el("p", "suporte-ajuda", "Fale com o suporte do Barber. As respostas aparecem aqui."), botao("Novo chamado", "primary-button suporte-acao", telaNovo));
        corpo.appendChild(topo);
        if (!chamados.length) {
            corpo.appendChild(el("p", "suporte-vazio", "Nenhum chamado ainda."));
            return;
        }
        const lista = el("ul", "suporte-lista");
        chamados.forEach((c) => {
            const [rotulo, classe] = STATUS[c.status] || [c.status, ""];
            const item = el("li");
            const b = el("button", `suporte-item${c.nao_lido ? " is-novo" : ""}`);
            b.type = "button";
            const linha = el("div", "suporte-item__linha");
            linha.append(el("strong", "", `#${c.protocolo} · ${c.assunto}`), el("span", `suporte-selo ${classe}`, c.nao_lido ? "Resposta nova" : rotulo));
            b.append(linha, el("span", "suporte-item__sub", `${CATEGORIAS[c.categoria] || c.categoria} · ${dataHora(c.ultima_mensagem_em)}`));
            if (c.ultima_mensagem) b.appendChild(el("span", "suporte-item__previa", c.ultima_mensagem));
            b.addEventListener("click", () => telaChamado(c.id));
            item.appendChild(b);
            lista.appendChild(item);
        });
        corpo.appendChild(lista);
    }

    function telaNovo() {
        corpo.replaceChildren();
        const form = el("form", "suporte-form");
        form.noValidate = true;
        const grupo = (rotulo, campo) => {
            const g = el("div", "form-group");
            const l = el("label", "", rotulo);
            l.htmlFor = campo.id;
            g.append(l, campo);
            return g;
        };
        const assunto = el("input");
        Object.assign(assunto, { id: "suporteAssunto", maxLength: 120, required: true, placeholder: "Ex.: A agenda não abre no celular" });
        const categoria = el("select");
        categoria.id = "suporteCategoria";
        Object.entries(CATEGORIAS).forEach(([v, r]) => { const o = el("option", "", r); o.value = v; categoria.appendChild(o); });
        const mensagem = el("textarea");
        Object.assign(mensagem, { id: "suporteMensagem", rows: 5, maxLength: 4000, required: true, placeholder: "Conte o que aconteceu, com o máximo de detalhes." });
        const erro = el("p", "suporte-erro");
        erro.setAttribute("role", "alert");
        const acoes = el("div", "modal-actions");
        const enviar = el("button", "primary-button suporte-acao", "Enviar chamado");
        enviar.type = "submit";
        acoes.append(botao("Voltar", "secondary-button", telaLista), enviar);
        form.append(grupo("Assunto", assunto), grupo("Tipo", categoria), grupo("Mensagem", mensagem), erro, acoes);
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (enviar.disabled) return;
            if (assunto.value.trim().length < 3) { erro.textContent = "Escreva um assunto com pelo menos 3 letras."; assunto.focus(); return; }
            if (mensagem.value.trim().length < 3) { erro.textContent = "Escreva a mensagem."; mensagem.focus(); return; }
            enviar.disabled = true;
            enviar.textContent = "Enviando…";
            erro.textContent = "";
            try {
                const { data, error } = await api().rpc("abrir_chamado", { p_assunto: assunto.value.trim(), p_categoria: categoria.value, p_mensagem: mensagem.value.trim() });
                if (error) throw error;
                avisar("Chamado enviado. Você verá a resposta aqui em Suporte.", "sucesso");
                await carregarChamados();
                telaChamado(data);
            } catch (falha) {
                console.error("Suporte:", falha);
                erro.textContent = traduzir(falha);
                enviar.disabled = false;
                enviar.textContent = "Enviar chamado";
            }
        });
        corpo.appendChild(form);
        assunto.focus();
    }

    async function telaChamado(id) {
        corpo.replaceChildren(el("p", "suporte-vazio", "Carregando…"));
        let c;
        try {
            const { data, error } = await api().rpc("ver_chamado", { p_chamado: id });
            if (error) throw error;
            c = data;
        } catch (falha) {
            console.error("Suporte:", falha);
            corpo.replaceChildren(el("p", "suporte-erro", "Não foi possível abrir o chamado."), botao("Voltar", "secondary-button", telaLista));
            return;
        }
        const local = chamados.find((x) => x.id === id);
        if (local) local.nao_lido = false;
        atualizarContador();

        corpo.replaceChildren();
        const [rotulo, classe] = STATUS[c.status] || [c.status, ""];
        const cab = el("div", "suporte-chamado__cabecalho");
        cab.append(el("strong", "", `#${c.protocolo} · ${c.assunto}`), el("span", `suporte-selo ${classe}`, rotulo));
        corpo.appendChild(cab);
        const conversa = el("ol", "suporte-conversa");
        (c.mensagens || []).forEach((m) => {
            const li = el("li", `suporte-msg${m.de_suporte ? " is-suporte" : ""}`);
            const topo = el("div", "suporte-msg__topo");
            topo.append(el("strong", "", m.de_suporte ? "Suporte Barber" : "Você"), el("time", "", dataHora(m.criado_em)));
            li.append(topo, el("p", "", m.texto));
            conversa.appendChild(li);
        });
        corpo.appendChild(conversa);

        const acoes = el("div", "modal-actions");
        acoes.appendChild(botao("Voltar", "secondary-button", () => { carregarChamados().then(telaLista).catch(telaLista); }));
        if (c.status === "encerrado") {
            corpo.appendChild(el("p", "suporte-ajuda", "Este chamado foi encerrado. Se precisar, abra um novo."));
            corpo.appendChild(acoes);
            return;
        }
        const form = el("form", "suporte-form");
        form.noValidate = true;
        const texto = el("textarea");
        Object.assign(texto, { rows: 3, maxLength: 4000, placeholder: "Escreva sua resposta…" });
        texto.setAttribute("aria-label", "Sua resposta");
        const erro = el("p", "suporte-erro");
        erro.setAttribute("role", "alert");
        const enviar = el("button", "primary-button suporte-acao", "Responder");
        enviar.type = "submit";
        acoes.appendChild(enviar);
        form.append(texto, erro, acoes);
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (enviar.disabled) return;
            if (!texto.value.trim()) { erro.textContent = "Escreva a resposta."; texto.focus(); return; }
            enviar.disabled = true;
            try {
                const { error } = await api().rpc("responder_chamado", { p_chamado: id, p_texto: texto.value.trim() });
                if (error) throw error;
                telaChamado(id);
            } catch (falha) {
                console.error("Suporte:", falha);
                erro.textContent = traduzir(falha);
                enviar.disabled = false;
            }
        });
        corpo.appendChild(form);
        conversa.lastElementChild?.scrollIntoView({ block: "nearest" });
    }

    async function abrir() {
        ultimoFoco = document.activeElement;
        modal.classList.add("active");
        corpo.replaceChildren(el("p", "suporte-vazio", "Carregando…"));
        $("fecharSuporteModal")?.focus();
        try {
            await carregarChamados();
            telaLista();
        } catch (falha) {
            console.error("Suporte:", falha);
            corpo.replaceChildren(el("p", "suporte-erro", "Não foi possível carregar o suporte."));
        }
    }

    function fechar() {
        modal.classList.remove("active");
        if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }

    // ------------------------------------------
    // Comunicados no topo do painel
    // ------------------------------------------
    async function mostrarComunicados() {
        let lista = [];
        try {
            const { data, error } = await api().rpc("meus_comunicados");
            if (error) throw error;
            lista = (Array.isArray(data) ? data : []).filter((c) => !c.lido).slice(0, 3);
        } catch (falha) {
            if (!["PGRST202", "PGRST106", "42883"].includes(String(falha && falha.code || ""))) console.error("Comunicados:", falha);
            return;
        }
        const area = document.querySelector(".main-content") || document.body;
        lista.reverse().forEach((c) => {
            const caixa = el("div", `comunicado-aviso${c.prioridade === "alta" ? " is-alta" : ""}`);
            caixa.setAttribute("role", "status");
            const texto = el("div", "comunicado-aviso__texto");
            texto.append(el("strong", "", c.titulo), el("p", "", c.mensagem));
            caixa.append(texto, botao("Entendi", "comunicado-aviso__botao", async (e) => {
                e.currentTarget.disabled = true;
                try {
                    const { error } = await api().rpc("marcar_comunicado_lido", { p_comunicado: c.id });
                    if (error) throw error;
                    caixa.remove();
                } catch (falha) {
                    console.error("Comunicados:", falha);
                    e.currentTarget.disabled = false;
                    avisar("Não foi possível marcar como lido.", "erro");
                }
            }));
            area.prepend(caixa);
        });
    }

    abrirBotao.addEventListener("click", abrir);
    $("fecharSuporteModal")?.addEventListener("click", fechar);
    modal.addEventListener("click", (e) => { if (e.target === modal) fechar(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("active")) fechar(); });

    async function iniciar() {
        const atual = window.BarbeariaAtual;
        if (!atual) { abrirBotao.hidden = true; return; }
        const estado = await atual.pronta;
        if (!estado || estado.modo !== "multi" || !estado.id) { abrirBotao.hidden = true; return; }
        try {
            await carregarChamados();
        } catch (falha) {
            // Banco sem a migração de suporte: a opção some.
            if (["PGRST202", "PGRST106", "42883"].includes(String(falha && falha.code || ""))) { abrirBotao.hidden = true; return; }
            console.error("Suporte:", falha);
        }
        mostrarComunicados();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
