// =====================================================================
// CRIAR NOVA SENHA (link "Esqueci minha senha" enviado por e-mail)
// O Supabase Auth abre esta página com uma sessão temporária de
// recuperação. A pessoa escolhe a senha nova (mesmas regras do
// "Alterar minha senha"), a sessão é encerrada e ela volta ao login.
// =====================================================================

(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const client = window.supabaseClient;
    const form = $("redefinirForm");
    const ajuda = $("redefinirAjuda");
    const mensagem = $("redefinirMensagem");
    const nova = $("novaSenha");
    const confirmar = $("confirmarSenha");
    const botao = $("salvarNovaSenha");
    let pronta = false;

    const REGRAS = {
        tamanho: (s) => s.length >= 10,
        maiuscula: (s) => /[A-ZÀ-Ý]/.test(s),
        minuscula: (s) => /[a-zß-ÿ]/.test(s),
        numero: (s) => /[0-9]/.test(s)
    };

    function erro(texto) {
        mensagem.textContent = texto;
        mensagem.classList.remove("success");
    }

    function sucesso(texto) {
        mensagem.textContent = texto;
        mensagem.classList.add("success");
    }

    function regrasOk() {
        let todas = true;
        form.querySelectorAll("[data-regra]").forEach((li) => {
            const ok = REGRAS[li.dataset.regra](nova.value);
            li.classList.toggle("is-ok", ok);
            if (!ok) todas = false;
        });
        return todas;
    }

    function liberar() {
        if (pronta) return;
        pronta = true;
        ajuda.textContent = "Escolha a sua nova senha.";
        form.hidden = false;
        nova.focus();
    }

    function linkInvalido(texto) {
        ajuda.textContent = texto || "Este link é inválido ou expirou. Volte ao login e peça um novo em “Esqueci minha senha”.";
        form.hidden = true;
    }

    // Erros devolvidos pelo Supabase na própria URL (link vencido ou já usado).
    const parametros = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
    if (parametros.get("error") || parametros.get("error_code")) {
        linkInvalido();
        return;
    }

    client.auth.onAuthStateChange((evento, sessao) => {
        if ((evento === "PASSWORD_RECOVERY" || evento === "SIGNED_IN") && sessao) liberar();
    });

    (async () => {
        // Fluxo com código (?code=...): troca o código pela sessão de recuperação.
        const codigo = new URLSearchParams(window.location.search).get("code");
        if (codigo) {
            const { error } = await client.auth.exchangeCodeForSession(codigo);
            if (error) console.warn("Troca do código:", error.message);
        }
        const { data } = await client.auth.getSession();
        if (data && data.session) return liberar();
        // Dá um tempo para o Supabase ler o link; sem sessão, o link não vale.
        setTimeout(() => { if (!pronta) linkInvalido(); }, 4000);
    })();

    $("mostrarSenha").addEventListener("click", (e) => {
        const mostrar = nova.type === "password";
        nova.type = confirmar.type = mostrar ? "text" : "password";
        e.currentTarget.textContent = mostrar ? "Ocultar" : "Mostrar";
    });
    nova.addEventListener("input", regrasOk);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (botao.disabled) return;
        if (!regrasOk()) return erro("A nova senha não atende a todas as regras.");
        if (nova.value !== confirmar.value) return erro("A confirmação não confere com a nova senha.");
        botao.disabled = true;
        botao.textContent = "Salvando…";
        erro("");
        try {
            const { error } = await client.auth.updateUser({ password: nova.value });
            if (error) {
                const t = `${error.code} ${error.message}`.toLowerCase();
                erro(t.includes("same_password") || t.includes("different from the old")
                    ? "A nova senha precisa ser diferente da anterior."
                    : t.includes("weak") ? "Senha fraca: use mais caracteres, letras e números."
                        : "Não foi possível salvar. O link pode ter expirado: peça um novo.");
                return;
            }
            await client.auth.signOut();
            form.hidden = true;
            ajuda.textContent = "Senha alterada! Entre com a nova senha.";
            sucesso("");
            setTimeout(() => { window.location.replace("area-equipe.html"); }, 2500);
        } catch (falha) {
            console.error("Nova senha:", falha);
            erro("Sem conexão com o servidor. Tente de novo.");
        } finally {
            botao.disabled = false;
            botao.textContent = "Salvar nova senha";
        }
    });
})();
