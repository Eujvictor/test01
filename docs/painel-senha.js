// =====================================================================
// PAINEL — ALTERAR MINHA SENHA
// Confirma a senha atual (novo login com ela) e grava a nova pelo
// Supabase Auth. Pensado para o primeiro acesso do proprietário, que
// recebe uma senha temporária do painel Master.
// =====================================================================

(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const modal = $("senhaModal");
    const form = $("senhaForm");
    if (!modal || !form) return;

    const campos = { atual: $("senhaAtual"), nova: $("senhaNova"), confirmar: $("senhaConfirmar") };
    const erro = $("senhaErro");
    const salvar = $("salvarSenha");
    let ultimoFoco = null;

    const REGRAS = {
        tamanho: (s) => s.length >= 10,
        maiuscula: (s) => /[A-ZÀ-Ý]/.test(s),
        minuscula: (s) => /[a-zß-ÿ]/.test(s),
        numero: (s) => /[0-9]/.test(s),
        diferente: (s, atual) => Boolean(s) && s !== atual
    };

    function avisar(mensagem, tipo) {
        if (window.PainelUI) window.PainelUI.aviso(mensagem, tipo);
        else alert(mensagem);
    }

    function atualizarRegras() {
        const nova = campos.nova.value;
        let todas = true;
        form.querySelectorAll("[data-regra]").forEach((li) => {
            const ok = REGRAS[li.dataset.regra](nova, campos.atual.value);
            li.classList.toggle("is-ok", ok);
            if (!ok) todas = false;
        });
        return todas;
    }

    function mostrarErro(texto, campo) {
        erro.textContent = texto || "";
        Object.values(campos).forEach((c) => c.removeAttribute("aria-invalid"));
        if (campo) {
            campo.setAttribute("aria-invalid", "true");
            campo.focus();
        }
    }

    function abrir() {
        ultimoFoco = document.activeElement;
        form.reset();
        mostrarErro("");
        atualizarRegras();
        modal.classList.add("active");
        campos.atual.focus();
    }

    function fechar() {
        modal.classList.remove("active");
        form.reset();
        if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }

    function traduzir(error) {
        const texto = `${error && error.code} ${error && error.message}`.toLowerCase();
        if (texto.includes("same_password") || texto.includes("different from the old")) return "A nova senha precisa ser diferente da atual.";
        if (texto.includes("weak_password") || texto.includes("weak")) return "Senha fraca: use mais caracteres, letras e números.";
        if (texto.includes("reauthentication")) return "Por segurança, saia e entre novamente antes de trocar a senha.";
        if (texto.includes("rate") || texto.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
        if (texto.includes("failed to fetch") || texto.includes("network")) return "Sem conexão com o servidor. Tente de novo.";
        return "Não foi possível alterar a senha. Tente novamente.";
    }

    async function enviar(evento) {
        evento.preventDefault();
        if (salvar.disabled) return;

        const atual = campos.atual.value;
        const nova = campos.nova.value;
        if (!atual) return mostrarErro("Informe a senha atual.", campos.atual);
        if (!atualizarRegras()) return mostrarErro("A nova senha não atende a todas as regras.", campos.nova);
        if (nova !== campos.confirmar.value) return mostrarErro("A confirmação não confere com a nova senha.", campos.confirmar);

        const textoOriginal = salvar.textContent;
        salvar.disabled = true;
        salvar.textContent = "Salvando…";
        mostrarErro("");

        try {
            const client = window.supabaseClient;
            const { data: dadosUsuario } = await client.auth.getUser();
            const email = dadosUsuario && dadosUsuario.user && dadosUsuario.user.email;
            if (!email) {
                mostrarErro("Sessão expirada. Entre novamente.");
                return;
            }

            // Confirma a senha atual no servidor.
            const { error: erroLogin } = await client.auth.signInWithPassword({ email, password: atual });
            if (erroLogin) {
                mostrarErro("Senha atual incorreta.", campos.atual);
                return;
            }

            const { error: erroTroca } = await client.auth.updateUser({ password: nova });
            if (erroTroca) {
                console.error("Erro ao alterar a senha:", erroTroca);
                mostrarErro(traduzir(erroTroca), campos.nova);
                return;
            }

            fechar();
            avisar("Senha alterada. Use a nova senha nos próximos acessos.", "sucesso");
        } catch (falha) {
            console.error("Erro ao alterar a senha:", falha);
            mostrarErro(traduzir(falha));
        } finally {
            salvar.disabled = false;
            salvar.textContent = textoOriginal;
        }
    }

    $("abrirAlterarSenha")?.addEventListener("click", abrir);
    $("fecharSenhaModal")?.addEventListener("click", fechar);
    $("cancelarSenha")?.addEventListener("click", fechar);
    modal.addEventListener("click", (e) => { if (e.target === modal) fechar(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("active")) fechar(); });
    campos.nova.addEventListener("input", atualizarRegras);
    campos.atual.addEventListener("input", atualizarRegras);
    $("senhaMostrar")?.addEventListener("change", (e) => {
        Object.values(campos).forEach((c) => { c.type = e.target.checked ? "text" : "password"; });
    });
    form.addEventListener("submit", enviar);
})();
