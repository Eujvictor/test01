// ==========================================
// SEGURANÇA DO PAINEL ADMINISTRATIVO
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        try {

            const {
                data: {
                    user
                },
                error
            } =
                await window.supabaseClient
                    .auth
                    .getUser();


            // ==========================================
            // USUÁRIO NÃO ESTÁ LOGADO
            // ==========================================

            if (
                error ||
                !user
            ) {

                window.location.replace(
                    "area-equipe.html"
                );

                return;

            }


            // ==========================================
            // VERIFICAR ADMINISTRADOR
            // ==========================================

            const adminEmail =
                "navalhadeouro@gmail.com";


            if (
                !user.email ||
                user.email.toLowerCase() !==
                adminEmail.toLowerCase()
            ) {

                await window.supabaseClient
                    .auth
                    .signOut();


                window.location.replace(
                    "area-equipe.html"
                );

                return;

            }


            // ==========================================
            // ACESSO LIBERADO
            // ==========================================

            console.log(
                "Administrador autorizado:",
                user.email
            );

        } catch (error) {

            console.error(
                "Erro na proteção do painel:",
                error
            );


            window.location.replace(
                "area-equipe.html"
            );

        }

    }
);