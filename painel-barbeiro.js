document.addEventListener("DOMContentLoaded", function () {

    // ==========================================
    // DADOS DE DEMONSTRAÇÃO
    // ==========================================

    const appointments = [

        {
            id: 1,
            time: "09:00",
            client: "Pedro Santos",
            service: "Corte Masculino",
            price: 60,
            phone: "(62) 98888-1111",
            status: "completed"
        },

        {
            id: 2,
            time: "10:30",
            client: "Lucas Oliveira",
            service: "Barba",
            price: 45,
            phone: "(62) 98888-2222",
            status: "completed"
        },

        {
            id: 3,
            time: "13:30",
            client: "Rafael Costa",
            service: "Corte Masculino",
            price: 60,
            phone: "(62) 98888-3333",
            status: "confirmed"
        },

        {
            id: 4,
            time: "15:30",
            client: "João Victor",
            service: "Corte + Barba",
            price: 95,
            phone: "(62) 99999-9999",
            status: "confirmed"
        },

        {
            id: 5,
            time: "17:00",
            client: "Gabriel Souza",
            service: "Corte Masculino",
            price: 60,
            phone: "(62) 98888-5555",
            status: "confirmed"
        }

    ];


    const clients = [

        {
            name: "João Victor",
            phone: "(62) 99999-9999",
            visits: 8,
            lastService: "Corte + Barba"
        },

        {
            name: "Pedro Santos",
            phone: "(62) 98888-1111",
            visits: 5,
            lastService: "Corte Masculino"
        },

        {
            name: "Lucas Oliveira",
            phone: "(62) 98888-2222",
            visits: 3,
            lastService: "Barba"
        },

        {
            name: "Rafael Costa",
            phone: "(62) 98888-3333",
            visits: 6,
            lastService: "Corte Masculino"
        },

        {
            name: "Gabriel Souza",
            phone: "(62) 98888-5555",
            visits: 2,
            lastService: "Corte Masculino"
        }

    ];


    // ==========================================
    // ELEMENTOS
    // ==========================================

    const sidebar =
        document.getElementById("sidebar");

    const menuButton =
        document.getElementById("menuButton");

    const logoutButton =
        document.getElementById("logoutButton");

    const navItems =
        document.querySelectorAll(".nav-item");

    const sections =
        document.querySelectorAll(".page-section");

    const goButtons =
        document.querySelectorAll("[data-go]");

    const dashboardAppointments =
        document.getElementById(
            "dashboardAppointments"
        );

    const fullAppointments =
        document.getElementById(
            "fullAppointments"
        );

    const clientsGrid =
        document.getElementById(
            "clientsGrid"
        );

    const clientSearch =
        document.getElementById(
            "clientSearch"
        );

    const appointmentModal =
        document.getElementById(
            "appointmentModal"
        );

    const closeModal =
        document.getElementById(
            "closeModal"
        );

    const nextClientButton =
        document.getElementById(
            "nextClientButton"
        );

    const modalConfirm =
        document.getElementById(
            "modalConfirm"
        );

    const modalCancel =
        document.getElementById(
            "modalCancel"
        );

    const previousDay =
        document.getElementById(
            "previousDay"
        );

    const nextDay =
        document.getElementById(
            "nextDay"
        );

    const selectedDate =
        document.getElementById(
            "selectedDate"
        );


    // ==========================================
    // DATA ATUAL
    // ==========================================

    let currentDayOffset = 0;

    let selectedAppointment =
        null;


    // ==========================================
    // DATA FORMATADA
    // ==========================================

    function getDateLabel(offset) {

        const date =
            new Date();

        date.setDate(
            date.getDate() + offset
        );


        if (offset === 0) {

            return "Hoje";

        }


        return date.toLocaleDateString(
            "pt-BR",
            {
                weekday: "long",
                day: "2-digit",
                month: "long"
            }
        );

    }


    function getFullDate() {

        const date =
            new Date();

        return date.toLocaleDateString(
            "pt-BR",
            {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );

    }


    const currentDate =
        document.getElementById(
            "currentDate"
        );


    if (currentDate) {

        currentDate.textContent =
            capitalize(
                getFullDate()
            );

    }


    // ==========================================
    // CAPITALIZAR
    // ==========================================

    function capitalize(text) {

        return text.charAt(0).toUpperCase()
            + text.slice(1);

    }


    // ==========================================
    // STATUS
    // ==========================================

    function getStatusLabel(status) {

        const labels = {

            confirmed:
                "Confirmado",

            progress:
                "Em atendimento",

            completed:
                "Concluído",

            cancelled:
                "Cancelado"

        };


        return labels[status] ||
            "Confirmado";

    }


    // ==========================================
    // RENDERIZAR AGENDAMENTO
    // ==========================================

    function createAppointmentHTML(
        appointment
    ) {

        return `

            <div
                class="appointment-item"
                data-id="${appointment.id}"
            >

                <div class="appointment-time">
                    ${appointment.time}
                </div>


                <div class="appointment-client">

                    <strong>
                        ${appointment.client}
                    </strong>

                    <span>
                        ${appointment.service}
                    </span>

                </div>


                <div class="appointment-price">

                    R$ ${appointment.price}

                </div>


                <span
                    class="status-badge
                    status-${appointment.status}"
                >
                    ${getStatusLabel(
                        appointment.status
                    )}
                </span>

            </div>

        `;

    }


    // ==========================================
    // AGENDA DO DASHBOARD
    // ==========================================

    function renderDashboardAppointments() {

        dashboardAppointments.innerHTML =
            appointments
                .map(createAppointmentHTML)
                .join("");

        addAppointmentEvents(
            dashboardAppointments
        );

    }


    // ==========================================
    // AGENDA COMPLETA
    // ==========================================

    function renderFullAppointments() {

        fullAppointments.innerHTML =
            appointments
                .map(createAppointmentHTML)
                .join("");

        addAppointmentEvents(
            fullAppointments
        );

    }


    // ==========================================
    // EVENTO DOS AGENDAMENTOS
    // ==========================================

    function addAppointmentEvents(container) {

        const items =
            container.querySelectorAll(
                ".appointment-item"
            );


        items.forEach(function (item) {

            item.addEventListener(
                "click",
                function () {

                    const id =
                        Number(
                            item.dataset.id
                        );


                    const appointment =
                        appointments.find(
                            function (item) {
                                return item.id === id;
                            }
                        );


                    if (appointment) {

                        openAppointment(
                            appointment
                        );

                    }

                }
            );

        });

    }


    // ==========================================
    // CLIENTES
    // ==========================================

    function renderClients(
        search = ""
    ) {

        const normalizedSearch =
            search.toLowerCase().trim();


        const filtered =
            clients.filter(
                function (client) {

                    return client.name
                        .toLowerCase()
                        .includes(
                            normalizedSearch
                        );

                }
            );


        if (filtered.length === 0) {

            clientsGrid.innerHTML = `

                <div class="content-card">

                    <p>
                        Nenhum cliente encontrado.
                    </p>

                </div>

            `;

            return;

        }


        clientsGrid.innerHTML =
            filtered.map(
                function (client) {

                    const initials =
                        getInitials(
                            client.name
                        );


                    return `

                        <div class="client-card">

                            <div class="client-avatar">
                                ${initials}
                            </div>

                            <h3>
                                ${client.name}
                            </h3>

                            <p>
                                ${client.phone}
                            </p>

                            <div class="client-history">

                                <span>
                                    ${client.visits}
                                    atendimentos
                                </span>

                                <span>
                                    ${client.lastService}
                                </span>

                            </div>

                        </div>

                    `;

                }
            ).join("");

    }


    // ==========================================
    // INICIAIS
    // ==========================================

    function getInitials(name) {

        return name
            .split(" ")
            .slice(0, 2)
            .map(
                function (word) {
                    return word.charAt(0);
                }
            )
            .join("")
            .toUpperCase();

    }


    // ==========================================
    // NAVEGAÇÃO
    // ==========================================

    function showSection(sectionId) {

        sections.forEach(
            function (section) {

                section.classList.remove(
                    "active"
                );

            }
        );


        navItems.forEach(
            function (item) {

                item.classList.remove(
                    "active"
                );

            }
        );


        const section =
            document.getElementById(
                sectionId
            );


        const navItem =
            document.querySelector(
                `[data-section="${sectionId}"]`
            );


        if (section) {

            section.classList.add(
                "active"
            );

        }


        if (navItem) {

            navItem.classList.add(
                "active"
            );

        }


        if (window.innerWidth <= 800) {

            sidebar.classList.remove(
                "open"
            );

        }


        window.scrollTo(
            {
                top: 0,
                behavior: "smooth"
            }
        );

    }


    navItems.forEach(
        function (item) {

            item.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    const section =
                        item.dataset.section;

                    showSection(section);

                    history.replaceState(
                        null,
                        "",
                        "#" + section
                    );

                }
            );

        }
    );


    goButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const section =
                        button.dataset.go;

                    showSection(section);

                }
            );

        }
    );


    // ==========================================
    // MENU MOBILE
    // ==========================================

    menuButton.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "open"
            );

        }
    );


    // ==========================================
    // BUSCA DE CLIENTES
    // ==========================================

    clientSearch.addEventListener(
        "input",
        function () {

            renderClients(
                clientSearch.value
            );

        }
    );


    // ==========================================
    // ABRIR MODAL
    // ==========================================

    function openAppointment(
        appointment
    ) {

        selectedAppointment =
            appointment;


        document.getElementById(
            "modalClientName"
        ).textContent =
            appointment.client;


        document.getElementById(
            "modalDate"
        ).textContent =
            getDateLabel(
                currentDayOffset
            );


        document.getElementById(
            "modalTime"
        ).textContent =
            appointment.time;


        document.getElementById(
            "modalPrice"
        ).textContent =
            "R$ " +
            appointment.price;


        document.getElementById(
            "modalPhone"
        ).textContent =
            appointment.phone;


        appointmentModal.classList.add(
            "active"
        );

    }


    // ==========================================
    // FECHAR MODAL
    // ==========================================

    function closeAppointment() {

        appointmentModal.classList.remove(
            "active"
        );

        selectedAppointment =
            null;

    }


    closeModal.addEventListener(
        "click",
        closeAppointment
    );


    appointmentModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                appointmentModal
            ) {

                closeAppointment();

            }

        }
    );


    // ==========================================
    // PRÓXIMO CLIENTE
    // ==========================================

    nextClientButton.addEventListener(
        "click",
        function () {

            const next =
                appointments.find(
                    function (appointment) {

                        return (
                            appointment.status ===
                            "confirmed"
                        );

                    }
                );


            if (next) {

                openAppointment(next);

            }

        }
    );


    // ==========================================
    // CONFIRMAR ATENDIMENTO
    // ==========================================

    modalConfirm.addEventListener(
        "click",
        function () {

            if (!selectedAppointment) {
                return;
            }


            selectedAppointment.status =
                "progress";


            renderDashboardAppointments();

            renderFullAppointments();


            closeAppointment();

        }
    );


    // ==========================================
    // CANCELAR
    // ==========================================

    modalCancel.addEventListener(
        "click",
        function () {

            if (!selectedAppointment) {
                return;
            }


            const confirmed =
                window.confirm(
                    "Deseja realmente cancelar este atendimento?"
                );


            if (!confirmed) {
                return;
            }


            selectedAppointment.status =
                "cancelled";


            renderDashboardAppointments();

            renderFullAppointments();


            closeAppointment();

        }
    );


    // ==========================================
    // NAVEGAR ENTRE DIAS
    // ==========================================

    previousDay.addEventListener(
        "click",
        function () {

            currentDayOffset--;

            updateSelectedDay();

        }
    );


    nextDay.addEventListener(
        "click",
        function () {

            currentDayOffset++;

            updateSelectedDay();

        }
    );


    function updateSelectedDay() {

        selectedDate.textContent =
            capitalize(
                getDateLabel(
                    currentDayOffset
                )
            );

    }


    // ==========================================
    // LOGOUT
    // ==========================================

    logoutButton.addEventListener(
        "click",
        function () {

            sessionStorage.removeItem(
                "userRole"
            );

            sessionStorage.removeItem(
                "userEmail"
            );


            window.location.href =
                "area-equipe.html";

        }
    );


    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================

    renderDashboardAppointments();

    renderFullAppointments();

    renderClients();

    updateSelectedDay();

});