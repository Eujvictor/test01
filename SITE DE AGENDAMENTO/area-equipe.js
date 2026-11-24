document.addEventListener("DOMContentLoaded", function () {

    // ==========================================
    // ELEMENTOS
    // ==========================================

    const loginForm =
        document.getElementById("loginForm");

    const emailInput =
        document.getElementById("email");

    const passwordInput =
        document.getElementById("password");

    const loginMessage =
        document.getElementById("loginMessage");

    const togglePassword =
        document.getElementById("togglePassword");

    const forgotPassword =
        document.getElementById("forgotPassword");


    // ==========================================
    // MOSTRAR / ESCONDER SENHA
    // ==========================================

    togglePassword.addEventListener(
        "click",
        function () {

            if (
                passwordInput.type ===
                "password"
            ) {

                passwordInput.type =
                    "text";

                togglePassword.textContent =
                    "Ocultar";

            } else {

                passwordInput.type =
                    "password";

                togglePassword.textContent =
                    "Mostrar";

            }

        }
    );


    // ==========================================
    // LOGIN
    // ==========================================

    loginForm.addEventListener(
        "submit",
       async function (event) {

            event.preventDefault();


            const email =
                emailInput.value
                    .trim()
                    .toLowerCase();


            const password =
                passwordInput.value
                    .trim();


            // Limpa mensagem anterior

            loginMessage.textContent =
                "";

            loginMessage.classList.remove(
                "success"
            );


            // ==================================
            // VALIDAÇÃO
            // ==================================

            if (!email || !password) {

                showMessage(
                    "Preencha seu e-mail e sua senha."
                );

                return;

            }


            // ==================================
// LOGIN REAL COM SUPABASE
// ==================================

try {

    const {
        data,
        error
    } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });


    // ==================================
    // ERRO NO LOGIN
    // ==================================

    if (error) {

        showMessage(
            "E-mail ou senha incorretos."
        );

        return;

    }


    // ==================================
    // USUÁRIO NÃO ENCONTRADO
    // ==================================

    if (!data.user) {

        showMessage(
            "Não foi possível acessar sua conta."
        );

        return;

    }


    // ==================================
    // LOGIN REALIZADO
    // ==================================

    sessionStorage.setItem(
        "userEmail",
        data.user.email
    );


    sessionStorage.setItem(
        "userRole",
        "admin"
    );


    showSuccess(
        "Login realizado com sucesso."
    );


    // Aguarda um instante e abre
    // o painel administrativo

    setTimeout(
        function () {

            window.location.href =
                "painel-admin-.html";

        },
        800
    );


} catch (error) {

    console.error(error);

    showMessage(
        "Ocorreu um erro ao tentar entrar."
    );

}

return;


            // ==================================
            // LOGIN INCORRETO
            // ==================================

            showMessage(
                "E-mail ou senha incorretos."
            );

        }
    );


    // ==========================================
    // ESQUECI MINHA SENHA
    // ==========================================

    // Envia o link de redefinição pelo Supabase Auth. A resposta é sempre a
    // mesma, exista ou não a conta (não revela quais e-mails estão cadastrados).
    let ultimoEnvio = 0;

    forgotPassword.addEventListener(
        "click",
        async function () {

            const email = emailInput.value.trim().toLowerCase();

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
                showMessage("Digite seu e-mail no campo acima e toque de novo em “Esqueci minha senha”.");
                emailInput.focus();
                return;
            }

            if (Date.now() - ultimoEnvio < 60000) {
                showMessage("Aguarde um minuto antes de pedir um novo link.");
                return;
            }

            forgotPassword.disabled = true;
            ultimoEnvio = Date.now();

            try {
                const destino = new URL("redefinir-senha.html", window.location.href).href;
                const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: destino });
                if (error && /rate|too many|seconds/i.test(error.message || "")) {
                    showMessage("Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.");
                    return;
                }
                if (error) console.error("Recuperação de senha:", error);
                showSuccess("Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.");
            } catch (erro) {
                console.error("Recuperação de senha:", erro);
                showMessage("Sem conexão com o servidor. Tente de novo.");
            } finally {
                setTimeout(() => { forgotPassword.disabled = false; }, 3000);
            }

        }
    );


    // ==========================================
    // FUNÇÃO DE ERRO
    // ==========================================

    function showMessage(message) {

        loginMessage.textContent =
            message;

        loginMessage.classList.remove(
            "success"
        );

    }


    // ==========================================
    // FUNÇÃO DE SUCESSO
    // ==========================================

    function showSuccess(message) {

        loginMessage.textContent =
            message;

        loginMessage.classList.add(
            "success"
        );

    }


    // Voltou do painel sem acesso (conta sem barbearia vinculada).
    if (new URLSearchParams(window.location.search).get("motivo") === "sem_acesso") {
        showMessage("Esta conta não está vinculada a nenhuma barbearia ativa. Fale com o suporte do Barber.");
    }

});