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

    forgotPassword.addEventListener(
        "click",
        function () {

            showMessage(
                "A recuperação de senha será ativada quando conectarmos a autenticação real."
            );

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

});