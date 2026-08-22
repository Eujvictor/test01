document.addEventListener(
    "DOMContentLoaded",
    async function () {

    // ==========================================
    // VARIÁVEIS
    // ==========================================

    let selectedService = "";
    let selectedPrice = 0;
    let selectedBarber = "";
    let selectedDate = "";
    let selectedTime = "";
    let selectedServiceDuration = 0;

    function addMinutesToTime(time, minutes) {

    const [hours, mins] =
        time.split(":").map(Number);

    const totalMinutes =
        hours * 60 +
        mins +
        Number(minutes || 0);

    const resultHours =
        Math.floor(totalMinutes / 60);

    const resultMinutes =
        totalMinutes % 60;

    return (
        String(resultHours).padStart(2, "0") +
        ":" +
        String(resultMinutes).padStart(2, "0")
    );
}

function timeToMinutes(time) {

    const [hours, minutes] =
        time.split(":").map(Number);

    return (
        hours * 60 +
        minutes
    );
}

    function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}

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
// SERVIÇOS — SUPABASE
// ==========================================

const servicesContainer =
    document.getElementById("servicesContainer");


async function loadServicesFromSupabase() {

    if (!servicesContainer) {
        return;
    }


    servicesContainer.innerHTML =
        "<p>Carregando serviços...</p>";


    const {
        data: services,
        error
    } =
        await supabaseClient
            .from("SERVIÇOS")
            .select(
                'id, nome, "preço", "duraçao"'
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
            "Erro ao carregar serviços:",
            error
        );


        servicesContainer.innerHTML =
            "<p>Não foi possível carregar os serviços.</p>";

        return;
    }


    if (
        !services ||
        services.length === 0
    ) {

        servicesContainer.innerHTML =
            "<p>Nenhum serviço disponível.</p>";

        return;

    }


    servicesContainer.innerHTML = "";


    services.forEach(
        function (service) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.classList.add(
                "option",
                "service-option"
            );


            button.dataset.service =
                service.nome;


            button.dataset.price =
                service["preço"];


            button.dataset.duration =
                service["duraçao"];


            button.innerHTML = `

                <div>

                    <strong>
                        ${escapeHTML(
                            service.nome
                        )}
                    </strong>

                    <span>
                        ${Number(
                            service["duraçao"] ?? 0
                        )}
                        min
                    </span>

                </div>

                <strong>
                    ${Number(
                        service["preço"] ?? 0
                    ).toLocaleString(
                        "pt-BR",
                        {
                            style: "currency",
                            currency: "BRL"
                        }
                    )}
                </strong>

            `;


            button.addEventListener(
                "click",
                function () {

                    document
                        .querySelectorAll(
                            ".service-option"
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


                    selectedService =
                        service.nome;


                    selectedPrice =
                        Number(
                            service["preço"] ?? 0
                        );

                        selectedServiceDuration =
                        Number(
                            service["duraçao"] ?? 0
                        );

                    if (summaryService) {

                        summaryService.textContent =
                            selectedService;

                    }


                    if (summaryPrice) {

                        summaryPrice.textContent =
                            new Intl.NumberFormat(
                                "pt-BR",
                                {
                                    style: "currency",
                                    currency: "BRL"
                                }
                            ).format(
                                selectedPrice
                            );

                    }

                    if (selectedDate && selectedBarber) {
                        loadAvailableTimes();
                    } else {
                        renderTimeButtons();
                    }

                    updateButton();

                }
            );


            servicesContainer.appendChild(
                button
            );

        }
    );

}


    // ==========================================
    // BARBEIROS
    // ==========================================

    const barberButtons =
        document.querySelectorAll(".barber-option");

    barberButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            barberButtons.forEach(function (item) {
                item.classList.remove("selected");
            });

            button.classList.add("selected");

            selectedBarber =
                button.dataset.barber;

            if (summaryBarber) {
                summaryBarber.textContent =
                    selectedBarber;
            }

            if (selectedDate) {
                loadAvailableTimes();
            } else {
                renderTimeButtons();
            }

            updateButton();

        });

    });


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

                        // A disponibilidade dos horários depende da data escolhida.
                        selectedTime = "";

                        if (summaryTime) {
                            summaryTime.textContent =
                                "Não selecionado";
                        }

                        loadAvailableTimes();


                        // Atualiza resumo

                        if (summaryDate) {

                            summaryDate.textContent =
                                formatDateBR(
                                    date
                                );

                        }


                        updateButton();

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


let availableTimes = [];

let workingDays = [];

let blockedSlots = {};

let blockedDates = [];

let considerServiceDuration = false;

async function loadScheduleSettingsFromSupabase() {
    const { data, error } =
        await supabaseClient
            .from("configuracoes_horarios")
            .select("*")
            .limit(1)
            .maybeSingle();


    if (error) {

        console.error(
            "Erro ao carregar configurações de horários:",
            error
        );

        return;
    }


    if (!data) {

        console.warn(
            "Nenhuma configuração de horário encontrada."
        );

        return;
    }


    const openingTime =
        data.horario_abertura ?? "09:00";


    const closingTime =
        data.horario_fechamento ?? "19:00";


    const interval =
    Number(
        data.intervalo ?? 60
    );
considerServiceDuration =
    Boolean(
        data.considerar_duracao_servicos
    );





workingDays =
    Array.isArray(data.dias_funcionamento)
        ? data.dias_funcionamento
        : [];


workingDays =
    Array.isArray(data.dias_funcionamento)
        ? data.dias_funcionamento
        : [];


blockedDates =
    Array.isArray(data.datas_bloqueadas)
        ? data.datas_bloqueadas
        : [];


const savedBlockedSlots =
    data.horarios_bloqueados;


if (
    savedBlockedSlots &&
    typeof savedBlockedSlots === "object" &&
    !Array.isArray(savedBlockedSlots)
) {

    blockedSlots =
        savedBlockedSlots;

} else {

    blockedSlots = {};

}


const times = [];


    const [openingHour, openingMinute] =
        openingTime
            .split(":")
            .map(Number);


    const [closingHour, closingMinute] =
        closingTime
            .split(":")
            .map(Number);


    let current =
        openingHour * 60 +
        openingMinute;


    const closing =
        closingHour * 60 +
        closingMinute;


    while (current < closing) {

        const stepForSlot =
            considerServiceDuration &&
            selectedServiceDuration > 0
                ? selectedServiceDuration
                : interval;

        if (current + stepForSlot > closing) {
            break;
        }

        const hour =
            String(
                Math.floor(current / 60)
            ).padStart(2, "0");


        const minute =
            String(
                current % 60
            ).padStart(2, "0");


        times.push(
            `${hour}:${minute}`
        );


        current += stepForSlot;

    }


    availableTimes = times;

}


    async function loadAppointmentBlocks(barberId, date) {

        const { data: appointments, error } =
            await supabaseClient
                .from("agendamentos")
                .select("horario, servico_id")
                .eq("barbeiro_id", barberId)
                .eq("data", date)
                .neq("status", "cancelado");

        if (error) {
            throw error;
        }

        const appointmentBlocks = [];

        for (const appointment of appointments || []) {

            const start =
                String(appointment.horario).substring(0, 5);

            const { data: serviceData, error: serviceError } =
                await supabaseClient
                    .from("SERVIÇOS")
                    .select('"duraçao"')
                    .eq("id", appointment.servico_id)
                    .maybeSingle();

            appointmentBlocks.push({
                start,
                duration:
                    !serviceError && serviceData
                        ? Number(serviceData["duraçao"] ?? 0)
                        : 0
            });
        }

        return appointmentBlocks;
    }


    function hasDurationConflict(startTime, duration, appointmentBlocks) {

        if (!considerServiceDuration || !duration) {
            return false;
        }

        const selectedStart = timeToMinutes(startTime);
        const selectedEnd =
            selectedStart + Number(duration);

        return appointmentBlocks.some(appointment => {

            const appointmentStart =
                timeToMinutes(appointment.start);

            const appointmentEnd =
                appointmentStart +
                Number(appointment.duration || 0);

            return (
                selectedStart < appointmentEnd &&
                selectedEnd > appointmentStart
            );
        });
    }


    function renderTimeButtons(
    occupiedTimes = [],
    appointmentBlocks = []
) {

        if (!timesContainer) {
            return;
        }

        timesContainer.innerHTML = "";

        const now = new Date();

        const todayString =
            formatDate(now);

        const isToday =
            selectedDate === todayString;


        availableTimes.forEach(function (time) {

            const button =
                document.createElement("button");

            button.type = "button";

            button.classList.add(
                "time-option"
            );

            button.textContent = time;


            let isOccupied =
                occupiedTimes.includes(time);

            if (hasDurationConflict(
                time,
                selectedServiceDuration,
                appointmentBlocks
            )) {
                isOccupied = true;
            }


            const blockedTimesForDate =
    Array.isArray(
        blockedSlots[selectedDate]
    )
        ? blockedSlots[selectedDate]
        : [];


const isBlocked =
    blockedTimesForDate.includes(time);


let isPast = false;


            // Se for hoje, não permite horários que já passaram.
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


            if (isOccupied) {

    button.disabled = true;

    button.classList.add(
        "disabled"
    );

    button.textContent =
        time + " — Ocupado";

} else if (isBlocked) {

    button.disabled = true;

    button.classList.add(
        "disabled"
    );

    button.textContent =
        time + " — Bloqueado";

} else if (isPast) {

                button.disabled = true;

                button.classList.add(
                    "disabled"
                );

                button.textContent =
                    time + " — Encerrado";

            } else {

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


    async function loadAvailableTimes() {

        if (!timesContainer) {
            return;
        }

      await loadScheduleSettingsFromSupabase();


if (
    selectedDate &&
    blockedDates.includes(selectedDate)
) {

    timesContainer.innerHTML =
        "<p>Este dia está bloqueado pela barbearia.</p>";

    return;
}


console.log(
    "Dias de funcionamento carregados:",
    workingDays
);

console.log(
    "Data selecionada:",
    selectedDate
);


if (selectedDate) {  




    const selectedDateObject =
        new Date(
            selectedDate + "T12:00:00"
        );


    const dayNames = [
        "domingo",
        "segunda",
        "terca",
        "quarta",
        "quinta",
        "sexta",
        "sabado"
    ];


    const selectedDay =
        dayNames[
            selectedDateObject.getDay()
        ];


    if (
        workingDays.length > 0 &&
        !workingDays.includes(selectedDay)
    ) {

        timesContainer.innerHTML =
            "<p>A barbearia não funciona neste dia.</p>";

        return;

    }

}

        // Antes da data ser escolhida, os horários aparecem normalmente.
        // Depois que a data for escolhida, o Supabase verifica a disponibilidade.
        if (!selectedDate || !selectedBarber) {

            renderTimeButtons();

            return;
        }


        timesContainer.innerHTML =
            "<p>Verificando disponibilidade...</p>";


        // ==========================================
        // ENCONTRAR O BARBEIRO
        // ==========================================

        const { data: barberData, error: barberError } =
            await supabaseClient
                .from("BARBEIROS")
                .select("id")
                .eq("nome", selectedBarber)
                .eq("ativo", true)
                .maybeSingle();


        if (barberError || !barberData) {

            console.error(
                "Erro ao encontrar barbeiro:",
                barberError
            );

            timesContainer.innerHTML =
                "<p>Não foi possível carregar os horários.</p>";

            return;
        }


        const barberId =
            barberData.id;


        // ==========================================
        // BUSCAR HORÁRIOS JÁ RESERVADOS
        // ==========================================

        let appointmentBlocks = [];

        try {

            appointmentBlocks =
                await loadAppointmentBlocks(
                    barberId,
                    selectedDate
                );

        } catch (error) {

            console.error(
                "Erro ao buscar agendamentos:",
                error
            );

            timesContainer.innerHTML =
                "<p>Erro ao carregar horários.</p>";

            return;
        }


        const occupiedTimes =
            appointmentBlocks.map(
                appointment => appointment.start
            );

        renderTimeButtons(
    occupiedTimes,
    appointmentBlocks
);

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
            async function () {

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
                    showMessage("Escolha um serviço.");
                    return;
                }

                if (!selectedBarber) {
                    showMessage("Escolha um barbeiro.");
                    return;
                }

                if (!selectedDate) {
                    showMessage("Escolha uma data.");
                    return;
                }

                if (!selectedTime) {
                    showMessage("Escolha um horário disponível.");
                    return;
                }

                if (!name) {
                    showMessage("Digite seu nome.");
                    return;
                }

                if (!phone) {
                    showMessage("Digite seu WhatsApp.");
                    return;
                }


                confirmButton.disabled = true;

                showMessage(
                    "Confirmando agendamento..."
                );


                // ==========================================
                // ENCONTRAR BARBEIRO
                // ==========================================

                const { data: barberData, error: barberError } =
                    await supabaseClient
                        .from("BARBEIROS")
                        .select("id")
                        .eq("nome", selectedBarber)
                        .eq("ativo", true)
                        .maybeSingle();


                if (barberError || !barberData) {

                    console.error(
                        "Erro ao encontrar barbeiro:",
                        barberError
                    );

                    showMessage(
                        "Não foi possível encontrar o barbeiro."
                    );

                    updateButton();
                    return;
                }


                // ==========================================
                // ENCONTRAR SERVIÇO
                // ==========================================

                const { data: serviceData, error: serviceError } =
                    await supabaseClient
                        .from("SERVIÇOS")
                        .select("id")
                        .eq("nome", selectedService)
                        .maybeSingle();


                if (serviceError || !serviceData) {

                    console.error(
                        "Erro ao encontrar serviço:",
                        serviceError
                    );

                    showMessage(
                        "Não foi possível encontrar o serviço."
                    );

                    updateButton();
                    return;
                }


                // ==========================================
                // VERIFICAR NOVAMENTE O HORÁRIO
                // ==========================================

                const { data: existingAppointment, error: checkError } =
                    await supabaseClient
                        .from("agendamentos")
                        .select("id")
                        .eq("barbeiro_id", barberData.id)
                        .eq("data", selectedDate)
                        .eq("horario", selectedTime)
                        .neq("status", "cancelado")
                        .maybeSingle();


                if (checkError) {

                    console.error(
                        "Erro ao verificar horário:",
                        checkError
                    );

                    showMessage(
                        "Erro ao verificar a disponibilidade."
                    );

                    updateButton();
                    return;
                }


                if (considerServiceDuration) {

                    try {

                        const confirmationBlocks =
                            await loadAppointmentBlocks(
                                barberData.id,
                                selectedDate
                            );

                        if (hasDurationConflict(
                            selectedTime,
                            selectedServiceDuration,
                            confirmationBlocks
                        )) {

                            showMessage(
                                "Esse horário entra em conflito com outro atendimento. Escolha outro."
                            );

                            await loadAvailableTimes();
                            updateButton();
                            return;
                        }

                    } catch (error) {

                        console.error(
                            "Erro ao validar duração do serviço:",
                            error
                        );

                        showMessage(
                            "Não foi possível validar a duração do atendimento."
                        );

                        updateButton();
                        return;
                    }
                }


                if (existingAppointment) {

                    selectedTime = "";

                    if (summaryTime) {
                        summaryTime.textContent =
                            "Não selecionado";
                    }

                    showMessage(
                        "Esse horário acabou de ser reservado. Escolha outro."
                    );

                    await load();

                    updateButton();
                    return;
                }


                // ==========================================
                // PROCURAR CLIENTE
                // ==========================================

                const { data: existingClient, error: clientSearchError } =
                    await supabaseClient
                        .from("clientes")
                        .select("id")
                        .eq("telefone", phone)
                        .maybeSingle();


                if (clientSearchError) {

                    console.error(
                        "Erro ao procurar cliente:",
                        clientSearchError
                    );

                    showMessage(
                        "Erro ao verificar seus dados."
                    );

                    updateButton();
                    return;
                }


                let clientId;


                if (existingClient) {

                    clientId =
                        existingClient.id;

                } else {

                    // ==========================================
                    // CRIAR CLIENTE
                    // ==========================================

                    const { data: newClient, error: clientInsertError } =
                        await supabaseClient
                            .from("clientes")
                            .insert({
                                nome: name,
                                telefone: phone,
                                ativo: true
                            })
                            .select("id")
                            .single();


                    if (clientInsertError) {

                        console.error(
                            "Erro ao criar cliente:",
                            clientInsertError
                        );

                        showMessage(
                            "Não foi possível cadastrar seus dados."
                        );

                        updateButton();
                        return;
                    }


                    clientId =
                        newClient.id;
                }


                // ==========================================
                // SALVAR AGENDAMENTO
                // ==========================================

                const { data: newAppointment, error: appointmentError } =
                    await supabaseClient
                        .from("agendamentos")
                        .insert({
                            cliente_id: clientId,
                            barbeiro_id: barberData.id,
                            servico_id: serviceData.id,
                            data: selectedDate,
                            horario: selectedTime,
                            status: "confirmado"
                        })
                        .select()
                        .single();


                if (appointmentError) {

                    console.error(
                        "Erro ao criar agendamento:",
                        appointmentError
                    );


                    // A constraint UNIQUE protege contra duas pessoas
                    // reservando o mesmo barbeiro/data/horário ao mesmo tempo.
                    if (
                        appointmentError.code === "23505"
                    ) {

                        selectedTime = "";

                        if (summaryTime) {
                            summaryTime.textContent =
                                "Não selecionado";
                        }

                        showMessage(
                            "Esse horário acabou de ser reservado por outra pessoa. Escolha outro."
                        );

                        await loadAvailableTimes();

                        updateButton();
                        return;
                    }


                    showMessage(
                        "Não foi possível confirmar o agendamento."
                    );

                    updateButton();
                    return;
                }


                console.log(
                    "Agendamento salvo:",
                    newAppointment
                );


                showMessage(
                    "Agendamento confirmado com sucesso!"
                );


                // Atualiza a tela: o horário recém-reservado
                // passa a aparecer como ocupado.
                await loadAvailableTimes();

                updateButton();

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
loadServicesFromSupabase();

renderTimeButtons();

updateButton();
    
});