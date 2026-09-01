document.addEventListener(
    "DOMContentLoaded",
    async function () {

        // ==========================================
        // SERVIÇOS DA PÁGINA INICIAL
        // ==========================================

        const servicesGrid =
            document.getElementById("servicesGrid");


        // Se a seção não existir nesta página,
        // não faz nada.
        if (!servicesGrid) {
            return;
        }


        // ==========================================
        // FUNÇÃO DE SEGURANÇA
        // ==========================================

        function escapeHTML(value) {

            return String(value)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");

        }


        // ==========================================
        // FORMATAR PREÇO
        // ==========================================

        function formatPrice(value) {

            return Number(value ?? 0)
                .toLocaleString(
                    "pt-BR",
                    {
                        style: "currency",
                        currency: "BRL"
                    }
                );

        }


        // ==========================================
        // CARREGAR SERVIÇOS
        // ==========================================

        async function loadHomeServices() {

            servicesGrid.innerHTML = `
                <p class="services-loading">
                    Carregando serviços...
                </p>
            `;


            // Confirma se o Supabase já foi carregado
            if (!window.supabaseClient) {

                console.error(
                    "Supabase não foi carregado na página inicial."
                );

                servicesGrid.innerHTML = `
                    <p class="services-error">
                        Não foi possível carregar os serviços.
                    </p>
                `;

                return;
            }


            const {
                data: services,
                error
            } =
                await window.supabaseClient
                    .from("SERVIÇOS")
                    .select(
                        'id, nome, "preço", "duraçao", ativo'
                    )
                    .eq(
                        "ativo",
                        true
                    )
                    .order(
                        "id",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                console.error(
                    "Erro ao carregar serviços da página inicial:",
                    error
                );


                servicesGrid.innerHTML = `
                    <p class="services-error">
                        Não foi possível carregar os serviços.
                    </p>
                `;

                return;
            }


            if (
                !services ||
                services.length === 0
            ) {

                servicesGrid.innerHTML = `
                    <p class="services-empty">
                        Nenhum serviço disponível.
                    </p>
                `;

                return;
            }


            // Limpa os serviços antigos
            servicesGrid.innerHTML = "";


            // ==========================================
            // CRIAR CARDS
            // ==========================================

            services.forEach(
                function (service) {

                    const card =
                        document.createElement(
                            "article"
                        );


                    card.className =
                        "service-card";


                    card.innerHTML = `

                        <div>

                            <h3>
                                ${escapeHTML(
                                    service.nome
                                )}
                            </h3>


                            <p>
                                Serviço da barbearia,
                                com acabamento e atendimento
                                profissional.
                            </p>


                            <span class="duration">

                                ${Number(
                                    service["duraçao"] ?? 0
                                )}
                                min

                            </span>

                        </div>


                        <div class="service-bottom">

                            <strong>
                                ${formatPrice(
                                    service["preço"]
                                )}
                            </strong>


                            <a href="agendar.html">
                                Agendar
                            </a>

                        </div>

                    `;


                    servicesGrid.appendChild(
                        card
                    );

                }
            );

        }


        // ==========================================
        // INICIAR
        // ==========================================

        await loadHomeServices();

    }
);