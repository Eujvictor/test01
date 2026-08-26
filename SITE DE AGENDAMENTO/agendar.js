const SUPABASE_URL = "https://cjwmzbknarafinftpqsv.supabase.co";
const SUPABASE_KEY = "sb_publishable_k1KkMm2f4-xRDy07B7f46w_0WddyoUj";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


document.addEventListener("DOMContentLoaded", function () {

    // ==========================================
    // VARIÁVEIS
    // ==========================================

    let selectedService = "";
    let selectedPrice = 0;
    let selectedBarber = "";
    let selectedBarberId = "";
    let selectedDate = "";
    let selectedTime = "";

    // ==========================================
    // ELEMENTOS DO RESUMO
    // ==========================================

    const summaryService =
        document.getElementById("summaryService");

    const summaryBarber =
        document.getElementById("summaryBarber");

    const summaryDate =
        document.getElementById("summaryDate");

    const summaryTime =
        document.getElementById("summaryTime");

    const summaryPrice =
        document.getElementById("summaryPrice");

    // ==========================================
    // SERVIÇOS
    // ==========================================

    const serviceButtons =
        document.querySelectorAll(".service-option");

    serviceButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            serviceButtons.forEach(function (item) {
                item.classList.remove("selected");
            });

            button.classList.add("selected");

            selectedService =
                button.dataset.service;

            selectedPrice =
                Number(button.dataset.price);

            if (summaryService) {
                summaryService.textContent =
                    selectedService;
            }

            if (summaryPrice) {
                summaryPrice.textContent =
                    new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                    }).format(selectedPrice);
            }

            updateButton();

        });

    });


    // ==========================================
    // BARBEIROS — CARREGAMENTO DINÂMICO
    // ==========================================

    const barbersGrid =
        document.getElementById("barbersGrid");


    function escapeHTML(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    function getInitials(name) {

        return String(name ?? "")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(word =>
                word.charAt(0).toUpperCase()
            )
            .join("") || "B";

    }


    async function loadBarbers() {

        if (!barbersGrid) {
            return;
        }

        barbersGrid.innerHTML =
            "<p class=\"barbers-loading\">Carregando barbeiros...</p>";

        const { data, error } =
            await supabaseClient
                .from("BARBEIROS")
                .select("id, nome, especialidade, ativo")
                .eq("ativo", true)
                .order("nome", { ascending: true });

        if (error) {

            console.error(
                "Erro ao carregar barbeiros:",
                error
            );

            barbersGrid.innerHTML =
                "<p>Não foi possível carregar os barbeiros.</p>";

            return;
        }

        renderBarbers(data || []);

    }


    function renderBarbers(barbers) {

        if (!barbersGrid) {
            return;
        }

        if (barbers.length === 0) {

            selectedBarber = "";
            selectedBarberId = "";

            if (summaryBarber) {
                summaryBarber.textContent =
                    "Nenhum barbeiro disponível";
            }

            barbersGrid.innerHTML =
                "<p>Nenhum barbeiro disponível no momento.</p>";

            updateButton();

            return;
        }

        barbersGrid.innerHTML =
            barbers.map(function (barber) {

                const name =
                    barber.nome ?? "";

                const specialty =
                    barber.especialidade ??
                    "Barbeiro";

                return `
                    <button
                        type="button"
                        class="barber-option"
                        data-barber-id="${escapeHTML(barber.id)}"
                        data-barber-name="${escapeHTML(name)}"
                    >
                        <div class="barber-avatar">
                            ${escapeHTML(getInitials(name))}
                        </div>

                        <div>
                            <strong>
                                ${escapeHTML(name)}
                            </strong>

                            <small>
                                ${escapeHTML(specialty)}
                            </small>
                        </div>
                    </button>
                `;

            }).join("");

        document
            .querySelectorAll(".barber-option")
            .forEach(function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        document
                            .querySelectorAll(".barber-option")
                            .forEach(function (item) {
                                item.classList.remove(
                                    "selected"
                                );
                            });

                        button.classList.add(
                            "selected"
                        );

                        selectedBarberId =
                            button.dataset.barberId;

                        selectedBarber =
                            button.dataset.barberName;

                        selectedTime = "";

                        document
                            .querySelectorAll(
                                ".time-option"
                            )
                            .forEach(function (item) {
                                item.classList.remove(
                                    "selected"
                                );
                            });

                        if (summaryBarber) {
                            summaryBarber.textContent =
                                selectedBarber;
                        }

                        if (summaryTime) {
                            summaryTime.textContent =
                                "—";
                        }

                        updateButton();

                        if (selectedDate) {
                            loadAvailableTimes();
                        }

                    }
                );

            });

    }


    // ==========================================
    // CALENDÁRIO
    // ==========================================

    const calendarDays =
        document.getElementById("calendarDays");

    const calendarMonth =
        document.getElementById("calendarMonth");

    const prevMonthButton =
        document.getElementById("prevMonth");

    const nextMonthButton =
        document.getElementById("nextMonth");


    const today = new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    // Hoje + 13 dias
    // Total de 14 dias disponíveis

    const maximumDate =
        new Date(today);

    maximumDate.setDate(
        maximumDate.getDate() + 13
    );


    // Mês que está sendo visualizado

    let currentMonth =
        new Date(
            today.getFullYear(),
            today.getMonth(),
            1
        );


    // ==========================================
    // FORMATAR DATA
    // ==========================================

    function formatDate(date) {

        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                date.getDate()
            ).padStart(2, "0");

        return (
            year +
            "-" +
            month +
            "-" +
            day
        );

    }


    // ==========================================
    // FORMATAR DATA PARA BRASIL
    // ==========================================

    function formatDateBR(date) {

        return date.toLocaleDateString(
            "pt-BR"
        );

    }


    // ==========================================
    // NOME DO MÊS
    // ==========================================

    function getMonthName(date) {

        return date.toLocaleDateString(
            "pt-BR",
            {
                month: "long",
                year: "numeric"
            }
        );

    }


    // ==========================================
    // COMPARAR DATAS
    // ==========================================

    function isSameDate(date1, date2) {

        return (
            date1.getFullYear() ===
            date2.getFullYear() &&

            date1.getMonth() ===
            date2.getMonth() &&

            date1.getDate() ===
            date2.getDate()
        );

    }


    // ==========================================
    // VERIFICAR SE DATA ESTÁ DISPONÍVEL
    // ==========================================

    function isDateAvailable(date) {

        return (
            date >= today &&
            date <= maximumDate
        );

    }


    // ==========================================
    // RENDERIZAR CALENDÁRIO
    // ==========================================

    function renderCalendar() {

        if (!calendarDays || !calendarMonth) {
            return;
        }


        calendarDays.innerHTML = "";


        // Nome do mês

        calendarMonth.textContent =
            getMonthName(currentMonth);


        // Primeiro dia do mês

        const firstDay =
            new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth(),
                1
            );


        // Último dia do mês

        const lastDay =
            new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() + 1,
                0
            );


        // Domingo = 0
        // Segunda = 1
        // etc.

        const firstDayOfWeek =
            firstDay.getDay();


        // Espaços antes do primeiro dia

        for (
            let i = 0;
            i < firstDayOfWeek;
            i++
        ) {

            const emptyDay =
                document.createElement("div");

            emptyDay.classList.add(
                "calendar-day",
                "empty"
            );

            calendarDays.appendChild(
                emptyDay
            );

        }


        // Criar todos os dias

        for (
            let day = 1;
            day <= lastDay.getDate();
            day++
        ) {

            const date =
                new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth(),
                    day
                );


            const button =
                document.createElement("button");


            button.type =
                "button";


            button.classList.add(
                "calendar-day"
            );


            button.textContent =
                day;


            const dateString =
                formatDate(date);


            button.dataset.date =
                dateString;


            // ==================================
            // HOJE
            // ==================================

            if (
                isSameDate(
                    date,
                    today
                )
            ) {

                button.classList.add(
                    "today"
                );

            }


            // ==================================
            // DATA SELECIONADA
            // ==================================

            if (
                selectedDate ===
                dateString
            ) {

                button.classList.add(
                    "selected"
                );

            }


            // ==================================
            // DATA DISPONÍVEL
            // ==================================

            if (
                isDateAvailable(date)
            ) {

                button.addEventListener(
                    "click",
                    function () {

                        // Remove seleção anterior

                        document
                            .querySelectorAll(
                                ".calendar-day.selected"
                            )
                            .forEach(
                                function (item) {
                                    item.classList.remove(
                                        "selected"
                                    );
                                }
                            );


                        // Seleciona nova data

                        button.classList.add(
                            "selected"
                        );


                        selectedDate =
                            button.dataset.date;


                        

                        selectedTime = "";

                        if (summaryTime) {
                            summaryTime.textContent =
                                "—";
                        }

                        if (summaryDate) {

                            summaryDate.textContent =
                                formatDateBR(
                                    date
                                );

                        }


                        updateButton();

                        if (selectedBarberId) {
                            loadAvailableTimes();
                        }

                    }
                );

            } else {

                button.classList.add(
                    "disabled"
                );

                button.disabled =
                    true;

            }


            calendarDays.appendChild(
                button
            );

        }


        updateCalendarNavigation();

    }


    // ==========================================
    // CONTROLE DOS MESES
    // ==========================================

    function updateCalendarNavigation() {

        if (
            !prevMonthButton ||
            !nextMonthButton
        ) {
            return;
        }


        const firstAvailableMonth =
            new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            );


        const lastAvailableMonth =
            new Date(
                maximumDate.getFullYear(),
                maximumDate.getMonth(),
                1
            );


        // Bloqueia mês anterior

        prevMonthButton.disabled =
            currentMonth <=
            firstAvailableMonth;


        // Bloqueia próximo mês

        nextMonthButton.disabled =
            currentMonth >=
            lastAvailableMonth;

    }


    // ==========================================
    // MÊS ANTERIOR
    // ==========================================

    if (prevMonthButton) {

        prevMonthButton.addEventListener(
            "click",
            function () {

                if (
                    prevMonthButton.disabled
                ) {
                    return;
                }


                currentMonth =
                    new Date(
                        currentMonth.getFullYear(),
                        currentMonth.getMonth() - 1,
                        1
                    );


                renderCalendar();

            }
        );

    }


    // ==========================================
    // PRÓXIMO MÊS
    // ==========================================

    if (nextMonthButton) {

        nextMonthButton.addEventListener(
            "click",
            function () {

                if (
                    nextMonthButton.disabled
                ) {
                    return;
                }


                currentMonth =
                    new Date(
                        currentMonth.getFullYear(),
                        currentMonth.getMonth() + 1,
                        1
                    );


                renderCalendar();

            }
        );

    }


    // ==========================================
    // INICIAR CALENDÁRIO
    // ==========================================

    renderCalendar();


    async function loadAvailableTimes() {

    if (!timesContainer) {
        return;
    }

    if (!selectedDate || !selectedBarberId) {

        timesContainer.innerHTML =
            "<p>Escolha o barbeiro e a data para ver os horários.</p>";

        return;
    }


    timesContainer.innerHTML =
        "<p>Carregando horários...</p>";


    // ==========================================
    // BARBEIRO JÁ SELECIONADO
    // ==========================================

    const barberId =
        selectedBarberId;


    // ==========================================
    // BUSCAR HORÁRIOS JÁ RESERVADOS
    // ==========================================

    const { data: appointments, error } =
        await supabaseClient
            .from("agendamentos")
            .select("horario")
            .eq("barbeiro_id", barberId)
            .eq("data", selectedDate)
            .neq("status", "cancelado");


    if (error) {

        console.error(
            "Erro ao buscar agendamentos:",
            error
        );

        timesContainer.innerHTML =
            "<p>Erro ao carregar horários.</p>";

        return;
    }


    const occupiedTimes =
        (appointments || []).map(function (appointment) {

            return appointment.horario.substring(0, 5);

        });


    // ==========================================
    // VERIFICAR SE A DATA É HOJE
    // ==========================================

    const now =
        new Date();

    const todayString =
        formatDate(now);


    const isToday =
        selectedDate === todayString;


    // ==========================================
    // LIMPAR HORÁRIOS
    // ==========================================

    timesContainer.innerHTML = "";


    // ==========================================
    // CRIAR HORÁRIOS
    // ==========================================

    availableTimes.forEach(function (time) {

        let isOccupied =
            occupiedTimes.includes(time);


        let isPast =
            false;


        // ==========================================
        // SE FOR HOJE, VERIFICAR HORÁRIO PASSADO
        // ==========================================

        if (isToday) {

            const [hours, minutes] =
                time.split(":").map(Number);


            const timeDate =
                new Date();

            timeDate.setHours(
                hours,
                minutes,
                0,
                0
            );


            isPast =
                timeDate <= now;
        }


        // ==========================================
        // CRIAR BOTÃO
        // ==========================================

        const button =
            document.createElement("button");


        button.type =
            "button";


        button.classList.add(
            "time-option"
        );


        button.textContent =
            time;


        // ==========================================
        // HORÁRIO OCUPADO
        // ==========================================

        if (isOccupied) {

            button.disabled =
                true;

            button.classList.add(
                "disabled"
            );

            button.textContent =
                time + " — Ocupado";
        }


        // ==========================================
        // HORÁRIO JÁ PASSOU
        // ==========================================

        else if (isPast) {

            button.disabled =
                true;

            button.classList.add(
                "disabled"
            );

            button.textContent =
                time + " — Encerrado";
        }


        // ==========================================
        // HORÁRIO DISPONÍVEL
        // ==========================================

        else {

            button.addEventListener(
                "click",
                function () {

                    document
                        .querySelectorAll(
                            ".time-option"
                        )
                        .forEach(
                            function (item) {

                                item.classList.remove(
                                    "selected"
                                );

                            }
                        );


                    button.classList.add(
                        "selected"
                    );


                    selectedTime =
                        time;


                    if (summaryTime) {

                        summaryTime.textContent =
                            selectedTime;

                    }


                    updateButton();

                }
            );
        }


        timesContainer.appendChild(
            button
        );

    });

}

    // ==========================================
    // CONFIRMAR AGENDAMENTO
    // ==========================================

    const confirmButton =
        document.getElementById("confirmButton");

    const bookingMessage =
        document.getElementById("bookingMessage");


    if (confirmButton) {

        confirmButton.addEventListener(
            "click",
            function () {

                const nameElement =
                    document.getElementById("name");

                const phoneElement =
                    document.getElementById("phone");


                const name =
                    nameElement
                        ? nameElement.value.trim()
                        : "";


                const phone =
                    phoneElement
                        ? phoneElement.value.trim()
                        : "";


                if (!selectedService) {

                    showMessage(
                        "Escolha um serviço."
                    );

                    return;
                }


                if (!selectedBarber || !selectedBarberId) {

                    showMessage(
                        "Escolha um barbeiro."
                    );

                    return;
                }


                if (!selectedDate) {

                    showMessage(
                        "Escolha uma data."
                    );

                    return;
                }


                if (!selectedTime) {

                    showMessage(
                        "Escolha um horário."
                    );

                    return;
                }


                if (!name) {

                    showMessage(
                        "Digite seu nome."
                    );

                    return;
                }


                if (!phone) {

                    showMessage(
                        "Digite seu WhatsApp."
                    );

                    return;
                }


                const appointment = {

                    service:
                        selectedService,

                    price:
                        selectedPrice,

                    barber:
                        selectedBarber,

                    barberId:
                        selectedBarberId,

                    date:
                        selectedDate,

                    time:
                        selectedTime,

                    name:
                        name,

                    phone:
                        phone

                };


                console.log(
                    "Agendamento:",
                    appointment
                );


                showMessage(
                    "Agendamento preenchido com sucesso!"
                );

            }
        );

    }


    // ==========================================
    // ATUALIZAR BOTÃO
    // ==========================================

    function updateButton() {

        if (!confirmButton) {
            return;
        }


        const ready =
            selectedService !== "" &&
            selectedBarber !== "" &&
            selectedBarberId !== "" &&
            selectedDate !== "" &&
            selectedTime !== "";


        confirmButton.disabled =
            !ready;

    }


    // ==========================================
    // MENSAGEM
    // ==========================================

    function showMessage(message) {

        if (bookingMessage) {

            bookingMessage.textContent =
                message;

        }

    }


    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================

    updateButton();

    loadBarbers();

    window.addEventListener(
        "focus",
        loadBarbers
    );

});