function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}

function formatMoney(value) {

    return Number(value)
        .toLocaleString(
            "pt-BR",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}

document.addEventListener(
    "DOMContentLoaded",
    () => {


    /*
    ==========================================
    MÓDULO 06
    GERENCIAMENTO DE BARBEIROS
    ==========================================
    */


    // ==========================================
    // DADOS INICIAIS
    // ==========================================

    const defaultBarbers = [

        {
            id: 1,
            name: "João",
            specialty: "Corte masculino",
            phone: "(62) 99999-1111",
            appointments: 7,
            revenue: 475,
            active: true
        },

        {
            id: 2,
            name: "Carlos",
            specialty: "Barba e acabamento",
            phone: "(62) 99999-2222",
            appointments: 6,
            revenue: 360,
            active: true
        },

        {
            id: 3,
            name: "Pedro",
            specialty: "Corte moderno",
            phone: "(62) 99999-3333",
            appointments: 5,
            revenue: 445,
            active: true
        }

    ];


    /*
    ==========================================
    LOCAL STORAGE

    Enquanto não usamos Supabase,
    os barbeiros ficam salvos no navegador.
    ==========================================
    */

    function getBarbers() {

        const saved =
            localStorage.getItem(
                "navalha_barbers"
            );

        if (saved) {

            try {

                return JSON.parse(saved);

            } catch (error) {

                return defaultBarbers;

            }

        }

        return defaultBarbers;

    }


    let barbers = getBarbers();


    function saveBarbers() {

        localStorage.setItem(
            "navalha_barbers",
            JSON.stringify(barbers)
        );

    }


    // ==========================================
    // ELEMENTOS
    // ==========================================

    const sidebar =
        document.getElementById("sidebar");

    const menuButton =
        document.getElementById("menuButton");

    const navItems =
        document.querySelectorAll(".nav-item");

    const sections =
        document.querySelectorAll(".page-section");


    const barbersGrid =
        document.getElementById("barbersGrid");

    const addBarberButton =
        document.getElementById(
            "addBarberButton"
        );


    const barberModal =
        document.getElementById(
            "barberModal"
        );

    const closeBarberModal =
        document.getElementById(
            "closeBarberModal"
        );

    const cancelBarber =
        document.getElementById(
            "cancelBarber"
        );


    const barberForm =
        document.getElementById(
            "barberForm"
        );


    const modalTitle =
        document.getElementById(
            "modalTitle"
        );


    const submitBarberText =
        document.getElementById(
            "submitBarberText"
        );


    const editingBarberId =
        document.getElementById(
            "editingBarberId"
        );


    const barberName =
        document.getElementById(
            "barberName"
        );


    const barberSpecialty =
        document.getElementById(
            "barberSpecialty"
        );


    const barberPhone =
        document.getElementById(
            "barberPhone"
        );


    // ==========================================
    // DATA ATUAL
    // ==========================================

    const currentDate =
        document.getElementById(
            "currentDate"
        );


    currentDate.textContent =
        capitalize(
            new Date().toLocaleDateString(
                "pt-BR",
                {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                }
            )
        );


    // ==========================================
    // NAVEGAÇÃO
    // ==========================================

    function showSection(sectionId) {

        sections.forEach(
            section => {

                section.classList.remove(
                    "active"
                );

            }
        );


        navItems.forEach(
            item => {

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


        if (window.innerWidth <= 850) {

            sidebar.classList.remove(
                "open"
            );

        }

    }


    navItems.forEach(
        item => {

            item.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    showSection(
                        item.dataset.section
                    );

                    history.replaceState(
                        null,
                        "",
                        "#" +
                        item.dataset.section
                    );

                }
            );

        }
    );


    // ==========================================
    // MENU MOBILE
    // ==========================================

    menuButton.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );

        }
    );


    // ==========================================
    // INICIAIS
    // ==========================================

    function getInitials(name) {

        return name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(
                word =>
                    word
                        .charAt(0)
                        .toUpperCase()
            )
            .join("");

    }


    function capitalize(text) {

        return text.charAt(0).toUpperCase()
            + text.slice(1);

    }


    // ==========================================
    // RENDERIZA BARBEIROS
    // ==========================================

    function renderBarbers() {

        barbersGrid.innerHTML = "";


        if (barbers.length === 0) {

            barbersGrid.innerHTML = `

                <div class="content-card">

                    <p>
                        Nenhum barbeiro cadastrado.
                    </p>

                </div>

            `;

            updateTeamSummary();

            return;

        }


        barbers.forEach(
            barber => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "barber-card" +
                    (
                        barber.active
                            ? ""
                            : " inactive"
                    );


                card.innerHTML = `

                    <div class="barber-card-header">

                        <div class="barber-avatar">

                            ${getInitials(
                                barber.name
                            )}

                        </div>

                        <div>

                            <h3>
                                ${escapeHTML(
                                    barber.name
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    barber.specialty
                                )}
                            </p>

                        </div>

                    </div>


                    <div class="barber-phone">

                        📱
                        ${escapeHTML(
                            barber.phone
                        )}

                    </div>


                    <div class="barber-data">

                        <div>

                            <span>
                                Atendimentos
                            </span>

                            <strong>
                                ${barber.appointments}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Faturamento
                            </span>

                            <strong>
                                R$ ${formatMoney(
                                    barber.revenue
                                )}
                            </strong>

                        </div>

                    </div>


                    <span class="
                        barber-status
                        ${barber.active
                            ? "active"
                            : "inactive"}
                    ">

                        ${barber.active
                            ? "● ATIVO"
                            : "● INATIVO"}

                    </span>


                    <div class="barber-actions">

                        <button
                            class="edit-button"
                            data-action="edit"
                            data-id="${barber.id}">

                            EDITAR

                        </button>


                        <button
                            class="toggle-button
                            ${barber.active
                                ? ""
                                : "activate"}"
                            data-action="toggle"
                            data-id="${barber.id}">

                            ${barber.active
                                ? "DESATIVAR"
                                : "ATIVAR"}

                        </button>

                    </div>

                `;


                barbersGrid.appendChild(
                    card
                );

            }
        );


        updateTeamSummary();

    }


    // ==========================================
    // RESUMO DA EQUIPE
    // ==========================================

    function updateTeamSummary() {

        const total =
            barbers.length;


        const active =
            barbers.filter(
                barber =>
                    barber.active
            ).length;


        const inactive =
            total - active;


        document.getElementById(
            "totalBarbers"
        ).textContent = total;


        document.getElementById(
            "activeBarbers"
        ).textContent = active;


        document.getElementById(
            "inactiveBarbers"
        ).textContent = inactive;


        document.getElementById(
            "dashboardBarberCount"
        ).textContent = active;


        renderDashboardTeam();

    }


    // ==========================================
    // EVENTOS DOS CARDS
    // ==========================================

    barbersGrid.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "button"
                );


            if (!button) {
                return;
            }


            const id =
                Number(
                    button.dataset.id
                );


            const action =
                button.dataset.action;


            if (action === "edit") {

                openEditModal(id);

            }


            if (action === "toggle") {

                toggleBarber(id);

            }

        }
    );


    // ==========================================
    // ABRIR MODAL — NOVO
    // ==========================================

    addBarberButton.addEventListener(
        "click",
        () => {

            openAddModal();

        }
    );


    function openAddModal() {

        barberForm.reset();

        editingBarberId.value = "";

        modalTitle.textContent =
            "Adicionar barbeiro";


        submitBarberText.textContent =
            "Adicionar barbeiro";


        barberModal.classList.add(
            "active"
        );


        setTimeout(
            () => barberName.focus(),
            100
        );

    }


    // ==========================================
    // ABRIR MODAL — EDITAR
    // ==========================================

    function openEditModal(id) {

        const barber =
            barbers.find(
                item =>
                    item.id === id
            );


        if (!barber) {
            return;
        }


        editingBarberId.value =
            barber.id;


        barberName.value =
            barber.name;


        barberSpecialty.value =
            barber.specialty;


        barberPhone.value =
            barber.phone;


        modalTitle.textContent =
            "Editar barbeiro";


        submitBarberText.textContent =
            "Salvar alterações";


        barberModal.classList.add(
            "active"
        );


        setTimeout(
            () => barberName.focus(),
            100
        );

    }


    // ==========================================
    // FECHAR MODAL
    // ==========================================

    function closeModal() {

        barberModal.classList.remove(
            "active"
        );

        barberForm.reset();

        editingBarberId.value = "";

    }


    closeBarberModal.addEventListener(
        "click",
        closeModal
    );


    cancelBarber.addEventListener(
        "click",
        closeModal
    );


    barberModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                barberModal
            ) {

                closeModal();

            }

        }
    );


    // ==========================================
    // SALVAR / EDITAR
    // ==========================================

    barberForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const name =
                barberName.value.trim();


            const specialty =
                barberSpecialty.value.trim();


            const phone =
                barberPhone.value.trim();


            if (
                !name ||
                !specialty ||
                !phone
            ) {

                alert(
                    "Preencha todos os campos."
                );

                return;

            }


            const id =
                Number(
                    editingBarberId.value
                );


            // EDITAR
            if (id) {

                const barber =
                    barbers.find(
                        item =>
                            item.id === id
                    );


                if (barber) {

                    barber.name =
                        name;

                    barber.specialty =
                        specialty;

                    barber.phone =
                        phone;

                }

            }

            // ADICIONAR
            else {

                const newBarber = {

                    id:
                        Date.now(),

                    name:
                        name,

                    specialty:
                        specialty,

                    phone:
                        phone,

                    appointments:
                        0,

                    revenue:
                        0,

                    active:
                        true

                };


                barbers.push(
                    newBarber
                );

            }


            saveBarbers();

            renderBarbers();

            closeModal();

        }
    );


    // ==========================================
    // ATIVAR / DESATIVAR
    // ==========================================

    function toggleBarber(id) {

        const barber =
            barbers.find(
                item =>
                    item.id === id
            );


        if (!barber) {
            return;
        }


        if (barber.active) {

            const confirmed =
                confirm(
                    `Deseja desativar ${barber.name}?`
                );


            if (!confirmed) {
                return;
            }


            barber.active = false;

        }

        else {

            barber.active = true;

        }


        saveBarbers();

        renderBarbers();

    }


    // ==========================================
    // DASHBOARD — EQUIPE
    // ==========================================

    function renderDashboardTeam() {

        const container =
            document.getElementById(
                "dashboardTeam"
            );


        if (!container) {
            return;
        }


        const active =
            barbers.filter(
                barber =>
                    barber.active
            );


        if (active.length === 0) {

            container.innerHTML = `
                <p>
                    Nenhum barbeiro ativo.
                </p>
            `;

            return;

        }


        container.innerHTML =
            active.map(
                barber => `

                    <div class="simple-list">

                        <div>

                            <strong>
                                ${escapeHTML(
                                    barber.name
                                )}
                            </strong>

                            <span>
                                ${barber.appointments}
                                atendimentos
                            </span>

                        </div>

                    </div>

                `
            ).join("");

    }


    // ==========================================
// AGENDA — DADOS REAIS DO SUPABASE
// ==========================================

let appointments = [];


function formatToday() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


// ==========================================
// RENDERIZAR AGENDA DE HOJE — DASHBOARD
// ==========================================

function renderDashboardAppointments() {

    const container =
        document.getElementById(
            "dashboardAppointments"
        );


    if (!container) {
        return;
    }


    const today =
        formatToday();


    const todayAppointments =
        appointments.filter(
            appointment =>
                appointment.date === today
        );


    if (
        todayAppointments.length === 0
    ) {

        container.innerHTML = `
            <p>
                Nenhum agendamento para hoje.
            </p>
        `;

        return;

    }


    container.innerHTML =
        todayAppointments.map(
            appointment => `

                <div class="simple-list">

                    <div>

                        <strong>
                            ${appointment.time}
                            —
                            ${appointment.client}
                        </strong>

                        <span>
                            ${appointment.service}
                            ·
                            ${appointment.barber}
                        </span>

                    </div>

                </div>

            `
        ).join("");

}


// ==========================================
// RENDERIZAR AGENDA COMPLETA
// ==========================================

function renderAdminAppointments() {

    const container =
        document.getElementById(
            "adminAppointments"
        );


    if (!container) {
        return;
    }


    if (
        appointments.length === 0
    ) {

        container.innerHTML = `
            <p>
                Nenhum agendamento encontrado.
            </p>
        `;

        return;

    }


    container.innerHTML =
        appointments.map(
            appointment => `

                <div class="simple-list">

                    <div>

                        <strong>
                            ${appointment.date}
                            ·
                            ${appointment.time}
                        </strong>

                        <span>
                            ${appointment.client}
                            ·
                            ${appointment.service}
                            ·
                            ${appointment.barber}
                        </span>

                    </div>

                </div>

            `
        ).join("");

}


// ==========================================
// CARREGAR AGENDA DO SUPABASE
// ==========================================

async function loadDashboardAndAgenda() {

    if (!window.supabaseClient) {

        console.error(
            "Supabase não foi carregado."
        );

        return;

    }


    const [
        appointmentsResponse,
        clientsResponse,
        barbersResponse,
        servicesResponse
    ] = await Promise.all([

        window.supabaseClient
            .from("agendamentos")
            .select("*")
            .neq(
                "status",
                "cancelado"
            ),

        window.supabaseClient
            .from("clientes")
            .select("*"),

        window.supabaseClient
            .from("BARBEIROS")
            .select("*"),

        window.supabaseClient
            .from("SERVIÇOS")
            .select("*")

    ]);


    if (
        appointmentsResponse.error
    ) {

        console.error(
            "Erro ao carregar agendamentos:",
            appointmentsResponse.error
        );

        return;

    }


    const clientsMap =
        new Map(
            (
                clientsResponse.data || []
            ).map(
                client => [

                    String(
                        client.id
                    ),

                    client.nome ??
                    client.name ??
                    "Cliente"

                ]
            )
        );


    const barbersMap =
        new Map(
            (
                barbersResponse.data || []
            ).map(
                barber => [

                    String(
                        barber.id
                    ),

                    barber.nome ??
                    barber.name ??
                    "Barbeiro"

                ]
            )
        );


   const servicesMap =
    new Map(
        (
            servicesResponse.data || []
        ).map(
            service => [

                String(
                    service.id
                ),

                {
                    nome:
                        service.nome ??
                        service.name ??
                        "Serviço",

                    preco:
                        Number(
                            service["preço"] ?? 0
                        )
                }

            ]
        )
    );


    appointments =
        (
            appointmentsResponse.data || []
        ).map(
            appointment => ({

                id:
                    appointment.id,

                date:
                    String(
                        appointment.data ?? ""
                    ).substring(0, 10),

                time:
                    String(
                        appointment.horario ?? ""
                    ).substring(0, 5),

                status:
                       appointment.status ??
                               "agendado",

                client:
                    clientsMap.get(
                        String(
                            appointment.cliente_id
                        )
                    ) ??
                    "Cliente",

                barber:
                    barbersMap.get(
                        String(
                            appointment.barbeiro_id
                        )
                    ) ??
                    "Barbeiro",

                service:
    servicesMap.get(
        String(
            appointment.servico_id
        )
    )?.nome ??
    "Serviço",

price:
    servicesMap.get(
        String(
            appointment.servico_id
        )
    )?.preco ??
    0,

            })
        );


    appointments.sort(
        (a, b) => {

            const first =
                `${a.date}T${a.time}`;

            const second =
                `${b.date}T${b.time}`;

            return (
                new Date(first) -
                new Date(second)
            );

        }
    );


    renderDashboardAppointments();

    renderAdminAppointments();

    const today =
    formatToday();


const finalizedAppointments =
    appointments.filter(
        appointment =>
            appointment.status === "finalizado" &&
            appointment.date === today
    );


const revenue =
    finalizedAppointments.reduce(
        (total, appointment) =>
            total + Number(appointment.price || 0),
        0
    );


const revenueElement =
    document.getElementById(
        "dashboardRevenue"
    );


if (revenueElement) {

    revenueElement.textContent =
        `R$ ${revenue.toFixed(2).replace(".", ",")}`;

}

 const dashboardToday =
    formatToday();


const todayAppointments =
    appointments.filter(
        appointment =>
            appointment.date === dashboardToday
    );


const appointmentCount =
    document.getElementById(
        "dashboardAppointmentCount"
    );


if (appointmentCount) {

    appointmentCount.textContent =
        todayAppointments.length;

}

}

// ==========================================
// MÓDULO CLIENTES
// ==========================================

const clientsGrid =
    document.getElementById("clientsGrid");

const clientSearch =
    document.getElementById("clientSearch");

const totalClientsElement =
    document.getElementById("totalClients");

const activeClientsElement =
    document.getElementById("activeClients");

const totalClientAppointmentsElement =
    document.getElementById(
        "totalClientAppointments"
    );


let adminClients = [];


async function loadAdminClients() {

    if (!window.supabaseClient) {
        console.error(
            "Supabase não foi carregado."
        );
        return;
    }


    if (clientsGrid) {

        clientsGrid.innerHTML =
            "<p>Carregando clientes...</p>";

    }


    const [
        clientsResponse,
        appointmentsResponse
    ] = await Promise.all([

        window.supabaseClient
            .from("clientes")
            .select("*")
            .order(
                "nome",
                {
                    ascending: true
                }
            ),

        window.supabaseClient
            .from("agendamentos")
            .select("*")
            .neq(
                "status",
                "cancelado"
            )

    ]);


    if (clientsResponse.error) {

        console.error(
            "Erro ao carregar clientes:",
            clientsResponse.error
        );

        if (clientsGrid) {

            clientsGrid.innerHTML =
                "<p>Não foi possível carregar os clientes.</p>";

        }

        return;
    }


    const clientsData =
        clientsResponse.data || [];

    const appointmentsData =
        appointmentsResponse.data || [];


    adminClients =
        clientsData.map(client => {

            const clientAppointments =
                appointmentsData.filter(
                    appointment =>
                        String(
                            appointment.cliente_id
                        ) === String(client.id)
                );


            clientAppointments.sort(
                (a, b) => {

                    const first =
                        `${a.data}T${a.horario || "00:00"}`;

                    const second =
                        `${b.data}T${b.horario || "00:00"}`;

                    return (
                        new Date(second) -
                        new Date(first)
                    );

                }
            );


            return {

                id:
                    client.id,

                name:
                    client.nome ??
                    client.name ??
                    "Cliente",

                phone:
                    client.telefone ??
                    client.phone ??
                    "",

                active:
                    client.ativo !== false,

                appointments:
                    clientAppointments.length,

                lastAppointment:
                    clientAppointments.length > 0
                        ? clientAppointments[0].data
                        : null

            };

        });


    updateAdminClientsSummary();

    renderAdminClients();

}


function updateAdminClientsSummary() {

    if (totalClientsElement) {

        totalClientsElement.textContent =
            adminClients.length;

    }


    if (activeClientsElement) {

        activeClientsElement.textContent =
            adminClients.filter(
                client =>
                    client.active
            ).length;

    }


    if (totalClientAppointmentsElement) {

        totalClientAppointmentsElement.textContent =
            adminClients.reduce(
                (
                    total,
                    client
                ) =>
                    total +
                    client.appointments,
                0
            );

    }

}


function renderAdminClients(
    search = ""
) {

    if (!clientsGrid) {
        return;
    }


    const query =
        String(search)
            .toLowerCase()
            .trim();


    const filteredClients =
        adminClients.filter(
            client => {

                const name =
                    String(
                        client.name
                    ).toLowerCase();

                const phone =
                    String(
                        client.phone
                    ).toLowerCase();


                return (
                    name.includes(query) ||
                    phone.includes(query)
                );

            }
        );


    if (
        filteredClients.length === 0
    ) {

        clientsGrid.innerHTML =
            `
            <div class="content-card">

                <p>
                    Nenhum cliente encontrado.
                </p>

            </div>
            `;

        return;

    }


    clientsGrid.innerHTML =
        filteredClients.map(
            client => {

                const lastAppointment =
                    client.lastAppointment
                        ? formatDateForClient(
                            client.lastAppointment
                        )
                        : "Nenhum";


                return `

                    <div class="client-card">

                        <div class="client-card-header">

                            <div class="client-avatar">
                                ${getInitials(
                                    client.name
                                )}
                            </div>

                            <div>

                                <h3>
                                    ${escapeHTML(
                                        client.name
                                    )}
                                </h3>

                                <p>
                                    ${client.active
                                        ? "Cliente ativo"
                                        : "Cliente inativo"}
                                </p>

                            </div>

                        </div>


                        <div class="client-phone">

                            📱
                            ${escapeHTML(
                                client.phone
                            )}

                        </div>


                        <div class="client-data">

                            <div>

                                <span>
                                    Atendimentos
                                </span>

                                <strong>
                                    ${client.appointments}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Último atendimento
                                </span>

                                <strong>
                                    ${lastAppointment}
                                </strong>

                            </div>

                        </div>

                    </div>

                `;

            }
        ).join("");

}


function formatDateForClient(
    date
) {

    if (!date) {
        return "Nenhum";
    }


    const parts =
        String(date).split("-");


    if (
        parts.length !== 3
    ) {

        return date;

    }


    return `${parts[2]}/${parts[1]}/${parts[0]}`;

}


if (clientSearch) {

    clientSearch.addEventListener(
        "input",
        () => {

            renderAdminClients(
                clientSearch.value
            );

        }
    );

}


loadAdminClients();
    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================

renderBarbers();

loadDashboardAndAgenda();

    // ==========================================
    // ABRIR HASH
    // ==========================================

    const hash =
        window.location.hash
            .replace("#", "");


    if (
        hash &&
        document.getElementById(hash)
    ) {

        showSection(hash);

    }

});

/* ==========================================
   MÓDULO 07
   SERVIÇOS — SUPABASE
   ========================================== */

let services = [];


// ==========================================
// ELEMENTOS
// ==========================================

const servicesGrid =
    document.getElementById("servicesGrid");

const addServiceButton =
    document.getElementById("addServiceButton");

const serviceModal =
    document.getElementById("serviceModal");

const closeServiceModal =
    document.getElementById("closeServiceModal");

const cancelService =
    document.getElementById("cancelService");

const serviceForm =
    document.getElementById("serviceForm");

const serviceModalTitle =
    document.getElementById("serviceModalTitle");

const submitServiceText =
    document.getElementById("submitServiceText");

const editingServiceId =
    document.getElementById("editingServiceId");

const serviceName =
    document.getElementById("serviceName");

const servicePrice =
    document.getElementById("servicePrice");

const serviceDuration =
    document.getElementById("serviceDuration");

const totalServicesElement =
    document.getElementById("totalServices");

const activeServicesElement =
    document.getElementById("activeServices");

const inactiveServicesElement =
    document.getElementById("inactiveServices");


// ==========================================
// CARREGAR SERVIÇOS DO SUPABASE
// ==========================================

async function loadServices() {

    if (!window.supabaseClient) {

        console.error(
            "Supabase não foi carregado."
        );

        return;
    }


    if (servicesGrid) {

        servicesGrid.innerHTML =
            "<p>Carregando serviços...</p>";

    }


    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("SERVIÇOS")
            .select("*")
            .order(
                "id",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Erro ao carregar serviços:",
            error
        );


        if (servicesGrid) {

            servicesGrid.innerHTML =
                "<p>Não foi possível carregar os serviços.</p>";

        }

        return;
    }


    services =
        data || [];


    renderServices();

}


// ==========================================
// RESUMO DOS SERVIÇOS
// ==========================================

function updateServiceSummary() {

    const total =
        services.length;

    const active =
        services.filter(
            service => Boolean(service.ativo)
        ).length;

    const inactive =
        total - active;


    if (totalServicesElement) {

        totalServicesElement.textContent =
            total;

    }


    if (activeServicesElement) {

        activeServicesElement.textContent =
            active;

    }


    if (inactiveServicesElement) {

        inactiveServicesElement.textContent =
            inactive;

    }

}


// ==========================================
// RENDERIZAR SERVIÇOS
// ==========================================

function renderServices() {

    updateServiceSummary();


    if (!servicesGrid) {
        return;
    }


    servicesGrid.innerHTML = "";


    if (services.length === 0) {

        servicesGrid.innerHTML = `

            <div class="content-card">

                <p>
                    Nenhum serviço cadastrado.
                </p>

            </div>

        `;

        return;
    }


    services.forEach(
        service => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "service-card" +
                (
                    service.ativo
                        ? ""
                        : " inactive"
                );


            card.innerHTML = `

                <div class="service-card-header">

                    <div>

                        <h3>
                            ${escapeHTML(
                                service.nome ?? ""
                            )}
                        </h3>

                        <p class="service-description">
                            Serviço da barbearia
                        </p>

                    </div>


                    <div class="service-icon">
                        ✂
                    </div>

                </div>


                <div class="service-price">

                    R$ ${formatMoney(
                        Number(
                            service["preço"] ?? 0
                        )
                    )}

                </div>


                <div class="service-duration">

                    ⏱
                    ${Number(
                        service["duraçao"]?? 0
                    )}
                    minutos

                </div>


                <div class="service-info">

                    <span class="
                        service-status
                        ${service.ativo
                            ? "active"
                            : "inactive"}
                    ">

                        ${service.ativo
                            ? "● ATIVO"
                            : "● INATIVO"}

                    </span>

                </div>


                <div class="service-actions">

                    <button
                        class="service-edit-button"
                        data-action="edit-service"
                        data-id="${service.id}">

                        EDITAR

                    </button>


                    <button
                        class="
                            service-toggle-button
                            ${service.ativo
                                ? ""
                                : "activate"}
                        "
                        data-action="toggle-service"
                        data-id="${service.id}">

                        ${service.ativo
                            ? "DESATIVAR"
                            : "ATIVAR"}

                    </button>


                    <button
                        class="service-delete-button"
                        data-action="delete-service"
                        data-id="${service.id}">

                        EXCLUIR

                    </button>

                </div>

            `;


            servicesGrid.appendChild(
                card
            );

        }
    );

}


// ==========================================
// ABRIR — ADICIONAR
// ==========================================

if (addServiceButton) {

    addServiceButton.addEventListener(
        "click",
        () => {

            if (serviceForm) {
                serviceForm.reset();
            }


            if (editingServiceId) {
                editingServiceId.value = "";
            }


            if (serviceModalTitle) {

                serviceModalTitle.textContent =
                    "Adicionar serviço";

            }


            if (submitServiceText) {

                submitServiceText.textContent =
                    "Adicionar serviço";

            }


            if (serviceModal) {

                serviceModal.classList.add(
                    "active"
                );

            }

        }
    );

}


// ==========================================
// EDITAR SERVIÇO
// ==========================================

function openEditServiceModal(id) {

    const service =
        services.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!service) {
        return;
    }


    if (editingServiceId) {

        editingServiceId.value =
            service.id;

    }


    if (serviceName) {

        serviceName.value =
            service.nome ?? "";

    }


    if (servicePrice) {

        servicePrice.value =
            Number(
                service["preço"] ?? 0
            );

    }


    if (serviceDuration) {

        serviceDuration.value =
            Number(
                service.sduraçao ?? 0
            );

    }


    if (serviceModalTitle) {

        serviceModalTitle.textContent =
            "Editar serviço";

    }


    if (submitServiceText) {

        submitServiceText.textContent =
            "Salvar alterações";

    }


    if (serviceModal) {

        serviceModal.classList.add(
            "active"
        );

    }

}


// ==========================================
// FECHAR MODAL
// ==========================================

function closeServiceModalWindow() {

    if (serviceModal) {

        serviceModal.classList.remove(
            "active"
        );

    }


    if (serviceForm) {
        serviceForm.reset();
    }


    if (editingServiceId) {
        editingServiceId.value = "";
    }

}


if (closeServiceModal) {

    closeServiceModal.addEventListener(
        "click",
        closeServiceModalWindow
    );

}


if (cancelService) {

    cancelService.addEventListener(
        "click",
        closeServiceModalWindow
    );

}


if (serviceModal) {

    serviceModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                serviceModal
            ) {

                closeServiceModalWindow();

            }

        }
    );

}


// ==========================================
// SALVAR / EDITAR SERVIÇO
// ==========================================

if (serviceForm) {

    serviceForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const name =
                serviceName
                    ? serviceName.value.trim()
                    : "";


            const price =
                servicePrice
                    ? Number(
                        servicePrice.value
                    )
                    : NaN;


            const duration =
                serviceDuration
                    ? Number(
                        serviceDuration.value
                    )
                    : NaN;


            if (!name) {

                alert(
                    "Digite o nome do serviço."
                );

                return;

            }


            if (
                Number.isNaN(price) ||
                price < 0
            ) {

                alert(
                    "Digite um preço válido."
                );

                return;

            }


            if (
                Number.isNaN(duration) ||
                duration <= 0
            ) {

                alert(
                    "Digite uma duração válida."
                );

                return;

            }


            const id =
                editingServiceId
                    ? editingServiceId.value
                    : "";


            const serviceData = {

                nome:
                    name,

                "preço":
                    price,

                "duraçao":
                    duration

            };


            let response;


            if (id) {

                response =
                    await window.supabaseClient
                        .from("SERVIÇOS")
                        .update(
                            serviceData
                        )
                        .eq(
                            "id",
                            id
                        );

            } else {

                response =
                    await window.supabaseClient
                        .from("SERVIÇOS")
                        .insert([
                            {
                                ...serviceData,
                                ativo: true
                            }
                        ]);

            }


            if (response.error) {

                console.error(
                    "Erro ao salvar serviço:",
                    response.error
                );

                alert(
                    "Não foi possível salvar o serviço."
                );

                return;

            }


            closeServiceModalWindow();

            await loadServices();

        }
    );

}


// ==========================================
// BOTÕES DOS SERVIÇOS
// ==========================================

if (servicesGrid) {

    servicesGrid.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "button"
                );


            if (!button) {
                return;
            }


            const id =
                button.dataset.id;


            const action =
                button.dataset.action;


            if (
                action ===
                "edit-service"
            ) {

                openEditServiceModal(id);

                return;

            }


            if (
                action ===
                "toggle-service"
            ) {

                const service =
                    services.find(
                        item =>
                            String(item.id) ===
                            String(id)
                    );


                if (!service) {
                    return;
                }


                const newStatus =
                    !Boolean(
                        service.ativo
                    );


                const {
                    error
                } =
                    await window.supabaseClient
                        .from("SERVIÇOS")
                        .update({
                            ativo:
                                newStatus
                        })
                        .eq(
                            "id",
                            id
                        );


                if (error) {

                    console.error(
                        "Erro ao alterar status do serviço:",
                        error
                    );

                    alert(
                        "Não foi possível alterar o status do serviço."
                    );

                    return;

                }


                await loadServices();

                return;

            }


            if (
                action ===
                "delete-service"
            ) {

                const service =
                    services.find(
                        item =>
                            String(item.id) ===
                            String(id)
                    );


                if (!service) {
                    return;
                }


                const serviceNameText =
                    service.nome ??
                    "este serviço";


                const confirmed =
                    confirm(
                        `Deseja excluir o serviço "${serviceNameText}"?`
                    );


                if (!confirmed) {
                    return;
                }


                // ==========================================
                // VERIFICAR AGENDAMENTOS VINCULADOS
                // ==========================================

                const appointmentsResponse =
                    await window.supabaseClient
                        .from("agendamentos")
                        .select("id")
                        .eq(
                            "servico_id",
                            id
                        )
                        .limit(1);


                if (
                    appointmentsResponse.error
                ) {

                    console.error(
                        "Erro ao verificar agendamentos do serviço:",
                        appointmentsResponse.error
                    );

                    alert(
                        "Não foi possível verificar os agendamentos deste serviço."
                    );

                    return;
                }


                const hasAppointments =
                    (
                        appointmentsResponse.data ||
                        []
                    ).length > 0;


                // ==========================================
                // COM HISTÓRICO:
                // DESATIVA PARA PRESERVAR AGENDAMENTOS
                // ==========================================

                if (hasAppointments) {

                    const {
                        error
                    } =
                        await window.supabaseClient
                            .from("SERVIÇOS")
                            .update({
                                ativo: false
                            })
                            .eq(
                                "id",
                                id
                            );


                    if (error) {

                        console.error(
                            "Erro ao desativar serviço com histórico:",
                            error
                        );

                        alert(
                            "Não foi possível desativar o serviço."
                        );

                        return;
                    }


                    alert(
                        `O serviço "${serviceNameText}" possui agendamentos registrados e não pode ser excluído. Ele foi desativado para preservar o histórico.`
                    );


                    await loadServices();

                    return;
                }


                // ==========================================
                // SEM HISTÓRICO:
                // EXCLUIR DEFINITIVAMENTE
                // ==========================================

                const {
                    error
                } =
                    await window.supabaseClient
                        .from("SERVIÇOS")
                        .delete()
                        .eq(
                            "id",
                            id
                        );


                if (error) {

                    console.error(
                        "Erro ao excluir serviço:",
                        error
                    );

                    alert(
                        "Não foi possível excluir o serviço."
                    );

                    return;
                }


                await loadServices();

            }

        }
    );

}


// ==========================================
// INICIALIZAÇÃO DOS SERVIÇOS
// ==========================================

loadServices();


/* ==========================================
   MÓDULO 08
   HORÁRIOS E DISPONIBILIDADE
   ========================================== */

const defaultScheduleSettings = {
    openingTime: "09:00",
    closingTime: "19:00",
    interval: 60,
    workingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    blockedDates: [],
    blockedSlots: {},
    considerServiceDuration: false
};

let scheduleSettings = { ...defaultScheduleSettings };
let selectedScheduleDateKey = null;

const openingTimeInput = document.getElementById("openingTime");
const closingTimeInput = document.getElementById("closingTime");
const slotIntervalInput = document.getElementById("slotInterval");
const availabilityCalendar = document.getElementById("availabilityCalendar");
const scheduleSlots = document.getElementById("scheduleSlots");
const selectedScheduleDate = document.getElementById("selectedScheduleDate");
const saveScheduleButton = document.getElementById("saveScheduleSettings");
const modeIntervalInput = document.getElementById("modeInterval");
const modeDurationInput = document.getElementById("modeDuration");
const schedulingModeSwitch = document.getElementById("schedulingModeSwitch");
const schedulingModeSwitchText = document.getElementById("schedulingModeSwitchText");
const schedulingModeTitle = document.getElementById("schedulingModeTitle");
const schedulingModeDescription = document.getElementById("schedulingModeDescription");



const WEEKDAY_KEYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const WEEKDAY_LABELS = {
    domingo: "Domingo",
    segunda: "Segunda-feira",
    terca: "Terça-feira",
    quarta: "Quarta-feira",
    quinta: "Quinta-feira",
    sexta: "Sexta-feira",
    sabado: "Sábado"
};

function normalizeWorkingDays(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : value.split(",").map(item => item.trim()).filter(Boolean);
        } catch {
            return value.split(",").map(item => item.trim()).filter(Boolean);
        }
    }
    return [...defaultScheduleSettings.workingDays];
}

function normalizeBlockedDates(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function normalizeBlockedSlots(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

function loadScheduleFromLocalStorage() {
    try {
        const saved = localStorage.getItem("navalha_schedule_settings");
        if (!saved) return;
        const parsed = JSON.parse(saved);
        scheduleSettings = {
            ...defaultScheduleSettings,
            ...parsed,
            workingDays: normalizeWorkingDays(parsed.workingDays),
            blockedDates: normalizeBlockedDates(parsed.blockedDates),
            blockedSlots: normalizeBlockedSlots(parsed.blockedSlots)
        };
    } catch (error) {
        console.warn("Não foi possível carregar os horários salvos localmente.", error);
    }
}

function saveScheduleToLocalStorage() {
    localStorage.setItem("navalha_schedule_settings", JSON.stringify(scheduleSettings));
}

async function loadScheduleSettings() {
    loadScheduleFromLocalStorage();
    loadScheduleInputs();
    updateScheduleSummary();
    renderAvailabilityCalendar();

    if (!window.supabaseClient) return;

    const { data, error } = await window.supabaseClient
        .from("configuracoes_horarios")
        .select("*")
        .limit(1)
        .maybeSingle();

    if (error) {
        console.warn("Configurações de horários ainda não foram carregadas do Supabase.", error.message);
        return;
    }

    if (data) {
        scheduleSettings = {
            openingTime: data.horario_abertura ?? data.opening_time ?? defaultScheduleSettings.openingTime,
            closingTime: data.horario_fechamento ?? data.closing_time ?? defaultScheduleSettings.closingTime,
            interval: Number(data.intervalo ?? data.interval ?? defaultScheduleSettings.interval),
            workingDays: normalizeWorkingDays(data.dias_funcionamento ?? data.working_days),
            blockedDates: normalizeBlockedDates(data.datas_bloqueadas ?? data.blocked_dates),
            blockedSlots: normalizeBlockedSlots(data.horarios_bloqueados ?? data.blocked_slots),
            considerServiceDuration: data.considerar_duracao_servicos ?? false
        };
        saveScheduleToLocalStorage();
    }

    loadScheduleInputs();
    updateScheduleSummary();
    renderAvailabilityCalendar();
}

async function saveScheduleSettings() {
    saveScheduleToLocalStorage();

    if (!window.supabaseClient) return true;

    const payload = {
        horario_abertura: scheduleSettings.openingTime,
        horario_fechamento: scheduleSettings.closingTime,
        intervalo: scheduleSettings.interval,
        dias_funcionamento: scheduleSettings.workingDays,
        datas_bloqueadas: scheduleSettings.blockedDates,
        horarios_bloqueados: scheduleSettings.blockedSlots,
        considerar_duracao_servicos: scheduleSettings.considerServiceDuration
    };

    const { data: existing, error: existingError } = await window.supabaseClient
        .from("configuracoes_horarios")
        .select("id")
        .limit(1)
        .maybeSingle();

    if (existingError) {
        console.error("Erro ao verificar configurações:", existingError);
        alert("As alterações foram salvas neste navegador, mas ainda não foram sincronizadas com o Supabase.");
        return true;
    }

    const response = existing
        ? await window.supabaseClient.from("configuracoes_horarios").update(payload).eq("id", existing.id)
        : await window.supabaseClient.from("configuracoes_horarios").insert(payload);

    if (response.error) {
        console.error("Erro ao salvar horários:", response.error);
        alert("As alterações foram salvas neste navegador, mas houve um problema ao sincronizar com o Supabase.");
    }

    return true;
}

function updateSchedulingModeUI() {

    const durationMode =
        Boolean(
            scheduleSettings.considerServiceDuration
        );


    if (modeIntervalInput) {
        modeIntervalInput.checked =
            !durationMode;
    }


    if (modeDurationInput) {
        modeDurationInput.checked =
            durationMode;
    }


    if (slotIntervalInput) {
        slotIntervalInput.disabled =
            durationMode;
    }


    if (schedulingModeSwitch) {

        schedulingModeSwitch.classList.toggle(
            "active",
            durationMode
        );


        schedulingModeSwitch.setAttribute(
            "aria-pressed",
            durationMode
                ? "true"
                : "false"
        );

    }


    if (schedulingModeSwitchText) {

        schedulingModeSwitchText.textContent =
            durationMode
                ? "ON"
                : "OFF";

    }


    if (schedulingModeTitle) {

        schedulingModeTitle.textContent =
            durationMode
                ? "Considerar duração dos serviços"
                : "Intervalo entre horários";

    }


    if (schedulingModeDescription) {

        schedulingModeDescription.textContent =
            durationMode
                ? "Cada atendimento respeita o tempo definido no serviço."
                : "Os horários seguem o intervalo definido acima.";

    }
}

if (modeIntervalInput) {
    modeIntervalInput.addEventListener(
        "change",
        () => {
            scheduleSettings.considerServiceDuration = false;
            updateSchedulingModeUI();
            previewScheduleSettings();
        }
    );
}

if (modeDurationInput) {
    modeDurationInput.addEventListener(
        "change",
        () => {
            scheduleSettings.considerServiceDuration = true;
            updateSchedulingModeUI();
            previewScheduleSettings();
        }
    );
}


if (schedulingModeSwitch) {

    schedulingModeSwitch.addEventListener(
        "click",
        () => {

            scheduleSettings.considerServiceDuration =
                !scheduleSettings.considerServiceDuration;

            updateSchedulingModeUI();
            previewScheduleSettings();

        }
    );

}


function loadScheduleInputs() {
    if (openingTimeInput) openingTimeInput.value = scheduleSettings.openingTime;
    if (closingTimeInput) closingTimeInput.value = scheduleSettings.closingTime;
    if (slotIntervalInput) slotIntervalInput.value = String(scheduleSettings.interval);

    document.querySelectorAll(".day-option input").forEach(checkbox => {
        checkbox.checked = scheduleSettings.workingDays.includes(checkbox.value);
    });
    updateSchedulingModeUI();
}

function getSelectedWorkingDays() {
    return [...document.querySelectorAll(".day-option input:checked")].map(input => input.value);
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function generateSlots() {
    const slots = [];
    const [openHour, openMinute] = scheduleSettings.openingTime.split(":").map(Number);
    const [closeHour, closeMinute] = scheduleSettings.closingTime.split(":").map(Number);
    let current = openHour * 60 + openMinute;
    const closing = closeHour * 60 + closeMinute;
    const interval = Math.max(1, Number(scheduleSettings.interval || 60));

    while (current < closing) {
        const hour = String(Math.floor(current / 60)).padStart(2, "0");
        const minute = String(current % 60).padStart(2, "0");
        slots.push(`${hour}:${minute}`);
        current += interval;
    }

    return slots;
}

function renderAvailabilityCalendar() {
    if (!availabilityCalendar) return;

    availabilityCalendar.innerHTML = "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const key = formatDateKey(date);
        const weekdayKey = WEEKDAY_KEYS[date.getDay()];
        const weekdayLabel = WEEKDAY_LABELS[weekdayKey];
        const unavailable = !scheduleSettings.workingDays.includes(weekdayKey) || scheduleSettings.blockedDates.includes(key);

        const button = document.createElement("button");
        button.type = "button";
        button.className = `availability-day ${unavailable ? "closed" : "open"}${selectedScheduleDateKey === key ? " selected" : ""}`;
        button.dataset.date = key;

        button.innerHTML = `
            <span class="day-name">${weekdayLabel}</span>
            <strong class="day-number">${String(date.getDate()).padStart(2, "0")}</strong>
            <span class="day-status">${unavailable ? "INDISPONÍVEL" : "DISPONÍVEL"}</span>
        `;

        button.addEventListener("click", () => {
            selectedScheduleDateKey = key;
            renderAvailabilityCalendar();
            renderScheduleSlots(key, date);
        });

        availabilityCalendar.appendChild(button);
    }
}

function renderScheduleSlots(dateKey, date) {
    if (selectedScheduleDate) {
        selectedScheduleDate.textContent = date.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    if (!scheduleSlots) return;

    const weekday = WEEKDAY_KEYS[date.getDay()];
    const outsideWorkingDays = !scheduleSettings.workingDays.includes(weekday);
    const manuallyBlocked = scheduleSettings.blockedDates.includes(dateKey);

    if (outsideWorkingDays || manuallyBlocked) {
        const message = outsideWorkingDays
            ? "Este dia está fora do funcionamento da barbearia."
            : "Este dia foi bloqueado manualmente.";

        scheduleSlots.innerHTML = `
            <p class="empty-schedule">
                ${message}
                ${manuallyBlocked ? '<button type="button" id="toggleDateAvailability">DESBLOQUEAR DIA</button>' : ""}
            </p>
        `;

        const toggle = document.getElementById("toggleDateAvailability");
        if (toggle) {
            toggle.addEventListener("click", () => toggleDateBlock(dateKey));
        }

        return;
    }

    const blocked =
    scheduleSettings.blockedSlots[dateKey] || [];

const isDateBlocked =
    scheduleSettings.blockedDates.includes(dateKey);


scheduleSlots.innerHTML =

    generateSlots().map(time => `

        <button
            type="button"
            class="schedule-slot${blocked.includes(time) ? " blocked" : " available"}"
            data-time="${time}"
        >
            ${time}${blocked.includes(time)
                ? " · BLOQUEADO"
                : " · DISPONÍVEL"}
        </button>

    `).join("")

    +

    `
        <button
            type="button"
            id="toggleDateAvailability"
            class="schedule-day-action"
        >
            ${
                isDateBlocked
                    ? "DESBLOQUEAR DIA"
                    : "BLOQUEAR DIA"
            }
        </button>
    `;


scheduleSlots
    .querySelectorAll(".schedule-slot")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => toggleSlot(
                dateKey,
                button.dataset.time,
                date
            )
        );

    });


const toggleDateAvailability =
    document.getElementById(
        "toggleDateAvailability"
    );


if (toggleDateAvailability) {

    toggleDateAvailability.addEventListener(
        "click",
        () => toggleDateBlock(dateKey)
    );

}

}

async function toggleSlot(dateKey, time, date) {
    if (!scheduleSettings.blockedSlots[dateKey]) scheduleSettings.blockedSlots[dateKey] = [];

    const blocked = scheduleSettings.blockedSlots[dateKey];
    const index = blocked.indexOf(time);

    if (index === -1) blocked.push(time);
    else blocked.splice(index, 1);

    await saveScheduleSettings();
    renderScheduleSlots(dateKey, date);
    renderAvailabilityCalendar();
}

async function toggleDateBlock(dateKey) {
    const index = scheduleSettings.blockedDates.indexOf(dateKey);

    if (index === -1) scheduleSettings.blockedDates.push(dateKey);
    else scheduleSettings.blockedDates.splice(index, 1);

    await saveScheduleSettings();
    renderAvailabilityCalendar();

    if (selectedScheduleDateKey === dateKey) {
        const [year, month, day] = dateKey.split("-").map(Number);
        renderScheduleSlots(dateKey, new Date(year, month - 1, day));
    }
}

function updateActiveDaysCount() {
    const element = document.getElementById("activeDaysCount");
    if (element) element.textContent = scheduleSettings.workingDays.length;
}

function updateIntervalDisplay() {
    const element = document.getElementById("slotIntervalDisplay");
    if (element) element.textContent = `${scheduleSettings.interval} min`;
}

function updateWorkingHoursDisplay() {
    const element = document.getElementById("workingHoursDisplay");
    if (element) {
        element.textContent = `${scheduleSettings.openingTime} — ${scheduleSettings.closingTime}`;
    }
}

function updateScheduleSummary() {
    updateWorkingHoursDisplay();
    updateIntervalDisplay();
    updateActiveDaysCount();
}

function previewScheduleSettings() {
    if (modeDurationInput) {
        scheduleSettings.considerServiceDuration =
            Boolean(modeDurationInput.checked);
    }

    if (openingTimeInput && openingTimeInput.value) scheduleSettings.openingTime = openingTimeInput.value;
    if (closingTimeInput && closingTimeInput.value) scheduleSettings.closingTime = closingTimeInput.value;
    if (slotIntervalInput && slotIntervalInput.value) scheduleSettings.interval = Number(slotIntervalInput.value);
    scheduleSettings.workingDays = getSelectedWorkingDays();

    updateScheduleSummary();
    renderAvailabilityCalendar();

    if (selectedScheduleDateKey) {
        const [year, month, day] = selectedScheduleDateKey.split("-").map(Number);
        renderScheduleSlots(selectedScheduleDateKey, new Date(year, month - 1, day));
    }
}

if (saveScheduleButton) {
    saveScheduleButton.addEventListener("click", async () => {
        const opening = openingTimeInput ? openingTimeInput.value : "";
        const closing = closingTimeInput ? closingTimeInput.value : "";
        const interval = Number(slotIntervalInput ? slotIntervalInput.value : 0);
        const workingDays = getSelectedWorkingDays();

        if (!opening || !closing) {
            alert("Informe o horário de abertura e fechamento.");
            return;
        }

        if (opening >= closing) {
            alert("O horário de abertura precisa ser antes do fechamento.");
            return;
        }

        if (!interval || interval <= 0) {
            alert("Informe um intervalo válido.");
            return;
        }

        if (workingDays.length === 0) {
            alert("Selecione pelo menos um dia de funcionamento.");
            return;
        }

        scheduleSettings.openingTime = opening;
        scheduleSettings.closingTime = closing;
        scheduleSettings.interval = interval;
        scheduleSettings.workingDays = workingDays;
        scheduleSettings.considerServiceDuration =
            Boolean(modeDurationInput && modeDurationInput.checked);

        updateSchedulingModeUI();

        await saveScheduleSettings();
        updateScheduleSummary();
        renderAvailabilityCalendar();
        alert("Configurações de horários salvas.");
    });
}

[openingTimeInput, closingTimeInput, slotIntervalInput].filter(Boolean).forEach(input => {
    input.addEventListener("change", previewScheduleSettings);
});

if (modeIntervalInput) {
    modeIntervalInput.addEventListener("change", previewScheduleSettings);
}

if (modeDurationInput) {
    modeDurationInput.addEventListener("change", previewScheduleSettings);
}

document.querySelectorAll(".day-option input").forEach(checkbox => {
    checkbox.addEventListener("change", previewScheduleSettings);

});
loadScheduleSettings();git pull origin main --allow-unrelated-histories