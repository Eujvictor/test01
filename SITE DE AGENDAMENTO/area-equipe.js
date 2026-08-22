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
        function (event) {

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
            // LOGIN DE TESTE
            // ==================================
            //
            // IMPORTANTE:
            // Estes dados são apenas para
            // testar a estrutura enquanto
            // ainda não usamos Supabase.
            //
            // Depois serão substituídos
            // pela autenticação real.
            // ==================================


            const adminEmail =
                "admin@navalhadeouro.com";

            const adminPassword =
                "admin123";


            const barberEmail =
                "barbeiro@navalhadeouro.com";

            const barberPassword =
                "barbeiro123";


            // ==================================
            // ADMINISTRADOR
            // ==================================

            if (
                email === adminEmail &&
                password === adminPassword
            ) {

                sessionStorage.setItem(
                    "userRole",
                    "admin"
                );


                sessionStorage.setItem(
                    "userEmail",
                    email
                );


                showSuccess(
                    "Login realizado. Área administrativa será aberta."
                );


                /*
                 * O painel administrativo
                 * será criado no Módulo 05.
                 *
                 * Por enquanto deixamos
                 * a mensagem de acesso.
                 */


                return;

            }


            // ==================================
            // BARBEIRO
            // ==================================

            if (
                email === barberEmail &&
                password === barberPassword
            ) {

                sessionStorage.setItem(
                    "userRole",
                    "barbeiro"
                );


                sessionStorage.setItem(
                    "userEmail",
                    email
                );


                showSuccess(
                    "Login realizado. Painel do barbeiro será aberto."
                );


                /*
                 * O painel do barbeiro
                 * será criado no Módulo 04.
                 *
                 * Por enquanto deixamos
                 * a mensagem de acesso.
                 */


                return;

            }


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