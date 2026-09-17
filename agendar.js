const SUPABASE_URL = "https://cjwmzbknarafinftpqsv.supabase.co";
const SUPABASE_KEY = "sb_publishable_k1KkMm2f4-xRDy07B7f46w_0WddyoUj";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
window.supabaseClient = supabaseClient;

console.log("SUPABASE CLIENT:", supabaseClient);

supabaseClient.auth.getSession().then(({ data, error }) => {
    console.log("SESSÃO SUPABASE:", data.session);
    console.log("ERRO DA SESSÃO:", error);
});


document.addEventListener("DOMContentLoaded", function () {

    // ==========================================
    // VARIÁVEIS
    // ==========================================

    let selectedService = "";
    let selectedPrice = 0;
    let selectedServiceId = "";
    let selectedServiceDuration = 0;
    let selectedBarber = "";
    let selectedBarberId = "";
    let selectedBarberPhone = "";
    let selectedDate = "";
    let selectedTime = "";
    let serviceDurationMap = new Map();
    let scheduleRealtimeChannel = null;
    let smartRefreshTimer = null;

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
    // SERVIÇOS — CARREGAMENTO DINÂMICO
    // ==========================================

    const servicesContainer =
        document.getElementById("servicesContainer");

    async function loadServices() {

        if (!servicesContainer) {
            return;
        }

        servicesContainer.innerHTML =
            "<p>Carregando serviços...</p>";

        const { data, error } =
            await supabaseClient
                .from("SERVIÇOS")
                .select('id, nome, "preço", "duraçao", ativo')
                .eq("ativo", true)
                .order("nome", { ascending: true });

        if (error) {

            console.error(
                "Erro ao carregar serviços:",
                error
            );

            servicesContainer.innerHTML =
                "<p>Não foi possível carregar os serviços.</p>";

            return;
        }

        if (!data || data.length === 0) {

            selectedService = "";
            selectedServiceId = "";
            selectedPrice = 0;
            selectedServiceDuration = 0;

            servicesContainer.innerHTML =
                "<p>Nenhum serviço disponível no momento.</p>";

            if (summaryService) {
                summaryService.textContent =
                    "Nenhum serviço disponível";
            }

            if (summaryPrice) {
                summaryPrice.textContent =
                    "R$ 0,00";
            }

            updateButton();
            return;
        }

        serviceDurationMap = new Map(data.map(function (service) {
            return [String(service.id), Number(service["duraçao"] ?? 0)];
        }));

        servicesContainer.innerHTML =
            data.map(function (service) {

                const name =
                    service.nome ?? "";

                const price =
                    Number(service["preço"] ?? 0);

                const duration =
                    Number(service["duraçao"] ?? 0);

                return `
                    <button
                        type="button"
                        class="option service-option"
                        data-service-id="${escapeHTML(service.id)}"
                        data-service="${escapeHTML(name)}"
                        data-price="${price}"
                        data-duration="${duration}"
                    >
                        <div>
                            <strong>${escapeHTML(name)}</strong>
                            <small>${duration} min</small>
                        </div>
                        <span>${new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL"
                        }).format(price)}</span>
                    </button>
                `;

            }).join("");

        servicesContainer
            .querySelectorAll(".service-option")
            .forEach(function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        servicesContainer
                            .querySelectorAll(".service-option")
                            .forEach(function (item) {
                                item.classList.remove("selected");
                            });

                        button.classList.add("selected");

                        selectedServiceId =
                            button.dataset.serviceId || "";

                        selectedService =
                            button.dataset.service || "";

                        selectedPrice =
                            Number(button.dataset.price || 0);

                        selectedServiceDuration =
                            Number(button.dataset.duration || 0);

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

                        selectedTime = "";

                        document
                            .querySelectorAll(".time-option")
                            .forEach(function (item) {
                                item.classList.remove("selected");
                            });

                        if (summaryTime) {
                            summaryTime.textContent =
                                "Não selecionado";
                        }

                        updateButton();

                        if (selectedDate && selectedBarberId) {
                            loadAvailableTimes();
                        }
                    }
                );

            });

    }


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
                .select("id, nome, especialidade, telefone, ativo")
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
            selectedBarberPhone = "";

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
                        data-barber-phone="${escapeHTML(barber.telefone ?? "")}"
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

                        selectedBarberPhone =
                            button.dataset.barberPhone || "";

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
    // CONFIGURAÇÕES DA AGENDA — SUPABASE
    // ==========================================

    const scheduleDefaults = {
        openingTime: "09:00",
        closingTime: "19:00",
        interval: 60,
        workingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
        blockedDates: [],
        blockedSlots: {},
        considerServiceDuration: false
    };

    let scheduleSettings = {
        ...scheduleDefaults
    };

    const WEEKDAY_KEYS = [
        "domingo",
        "segunda",
        "terca",
        "quarta",
        "quinta",
        "sexta",
        "sabado"
    ];

    function normalizeArray(value, fallback = []) {
        if (Array.isArray(value)) return value;
        if (typeof value !== "string") return [...fallback];
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : value.split(",").map(v => v.trim()).filter(Boolean);
        } catch {
            return value.split(",").map(v => v.trim()).filter(Boolean);
        }
    }

    function normalizeObject(value, fallback = {}) {
        if (value && typeof value === "object" && !Array.isArray(value)) return value;
        if (typeof value !== "string") return { ...fallback };
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed
                : { ...fallback };
        } catch {
            return { ...fallback };
        }
    }

    async function loadScheduleSettings() {

    if (!supabaseClient) {
        console.error("Supabase não foi carregado.");
        return false;
    }

    const { data, error } = await supabaseClient
        .from("configuracoes_horarios")
        .select("*")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error(
            "Erro ao carregar configurações de horários:",
            error
        );
        return false;
    }

    if (!data) {
        console.error(
            "Nenhuma configuração de horários encontrada no Supabase."
        );
        return false;
    }

    scheduleSettings = {

        openingTime:
            String(
                data.horario_abertura ?? "09:00"
            ).substring(0, 5),

        closingTime:
            String(
                data.horario_fechamento ?? "19:00"
            ).substring(0, 5),

        interval:
            Number(
                data.intervalo ?? 60
            ),

        workingDays:
            normalizeArray(
                data.dias_funcionamento,
                scheduleDefaults.workingDays
            ),

        blockedDates:
            normalizeArray(
                data.datas_bloqueadas,
                []
            ),

        blockedSlots:
            normalizeObject(
                data.horarios_bloqueados,
                {}
            ),

        considerServiceDuration:
            Boolean(
                data.considerar_duracao_servicos
            ),

        smartToleranceMinutes: 5,
        whatsapp: { phone: "", enabled: false, mode: "barbearia" }

    };

    const savedWhatsappConfig = scheduleSettings.blockedSlots && scheduleSettings.blockedSlots.__whatsapp_config;
    if (savedWhatsappConfig && typeof savedWhatsappConfig === "object") {
        scheduleSettings.whatsapp = {
            phone: String(savedWhatsappConfig.phone || ""),
            enabled: Boolean(savedWhatsappConfig.enabled),
            mode: savedWhatsappConfig.mode === "barbeiro" ? "barbeiro" : "barbearia"
        };
    }

    const smartConfig = scheduleSettings.blockedSlots && scheduleSettings.blockedSlots.__smart_config;
    if (smartConfig && typeof smartConfig === "object") {
        const tolerance = Number(smartConfig.toleranceMinutes);
        if ([5, 10, 15].includes(tolerance)) scheduleSettings.smartToleranceMinutes = tolerance;
    }

    console.log(
        "CONFIGURAÇÕES RECEBIDAS DO SUPABASE:",
        scheduleSettings
    );

    return true;
}

    function timeToMinutes(time) {
        const [hours, minutes] = String(time || "00:00").split(":").map(Number);
        return (hours * 60) + minutes;
    }

    function minutesToTime(minutes) {
        const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
        const mins = String(minutes % 60).padStart(2, "0");
        return `${hours}:${mins}`;
    }

    function generateConfiguredTimes() {
        const result = [];
        const opening = timeToMinutes(scheduleSettings.openingTime);
        const closing = timeToMinutes(scheduleSettings.closingTime);
        const interval = Math.max(1, Number(scheduleSettings.interval || 60));

        for (let current = opening; current < closing; current += interval) {
            result.push(minutesToTime(current));
        }

        return result;
    }

    function isWorkingDay(date) {
        return scheduleSettings.workingDays.includes(WEEKDAY_KEYS[date.getDay()]);
    }

    function isDateBlockedBySettings(dateString) {
        return scheduleSettings.blockedDates.includes(dateString);
    }

    // ==========================================
    // CALENDÁRIO
    // ==========================================

    const calendarDays =
        document.getElementById("calendarDays");

    const timesContainer =
        document.getElementById("timesContainer");

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

        const dateString = formatDate(date);

        return (
            date >= today &&
            date <= maximumDate &&
            isWorkingDay(date) &&
            !isDateBlockedBySettings(dateString)
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

    // ==========================================


    function getSmartToleranceMinutes() {
        const tolerance = Number(scheduleSettings.smartToleranceMinutes);
        return [5, 10, 15].includes(tolerance) ? tolerance : 5;
    }

    function getServiceDuration(serviceId) {
        return Number(serviceDurationMap.get(String(serviceId)) || 0);
    }

    function buildAppointmentRanges(appointments) {
        return (appointments || []).map(function (appointment) {
            const start = timeToMinutes(appointment.horario);
            const duration = getServiceDuration(appointment.servico_id) || Number(scheduleSettings.interval || 60);
            return { start, end: start + Math.max(1, duration) };
        });
    }

    function hasBlockedTimeInsideRange(start, end, blockedTimes) {
        return (blockedTimes || []).some(function (blocked) {
            const minute = timeToMinutes(blocked);
            return minute >= start && minute < end;
        });
    }

    function canBookSmartStart(startTime, appointments, blockedTimes) {
        const duration = Number(selectedServiceDuration || 0);
        if (duration <= 0) return false;
        const opening = timeToMinutes(scheduleSettings.openingTime);
        const closing = timeToMinutes(scheduleSettings.closingTime);
        const start = timeToMinutes(startTime);
        const end = start + duration;
        const tolerance = getSmartToleranceMinutes();
        if (start < opening || end > closing) return false;
        if (hasBlockedTimeInsideRange(start, end, blockedTimes)) return false;
        return !buildAppointmentRanges(appointments).some(function (range) {
            return start < range.end + tolerance && end + tolerance > range.start;
        });
    }

    async function fetchAppointmentsForSelectedDate() {
        return await supabaseClient
            .schema("api")
            .rpc(
                "consultar_horarios_ocupados",
                {
                    p_barbeiro_id: selectedBarberId,
                    p_data: selectedDate
                }
            );
    }

    async function isSelectedTimeStillAvailable() {
        await loadScheduleSettings();
        const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
        if (!isWorkingDay(selectedDateObject) || isDateBlockedBySettings(selectedDate)) return false;
        const { data: appointments, error } = await fetchAppointmentsForSelectedDate();
        if (error) { console.error("Erro ao revalidar horário:", error); return false; }
        const blockedTimes = scheduleSettings.blockedSlots[selectedDate] || [];
        if (scheduleSettings.considerServiceDuration) return canBookSmartStart(selectedTime, appointments || [], blockedTimes);
        return !(appointments || []).some(function (appointment) { return String(appointment.horario || "").substring(0, 5) === selectedTime; }) && !blockedTimes.includes(selectedTime);
    }

    function renderTimeButton(time, disabled, label) {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("time-option");
        button.textContent = label || time;
        if (disabled) {
            button.disabled = true;
            button.classList.add("disabled");
        } else {
            button.addEventListener("click", function () {
                document.querySelectorAll(".time-option").forEach(function (item) { item.classList.remove("selected"); });
                button.classList.add("selected");
                selectedTime = time;
                if (summaryTime) summaryTime.textContent = selectedTime;
                updateButton();
            });
        }
        timesContainer.appendChild(button);
    }

    async function loadAvailableTimes() {
        if (!timesContainer) return;
        if (!selectedDate || !selectedBarberId) {
            timesContainer.innerHTML = "<p>Escolha o barbeiro e a data para ver os horários.</p>";
            return;
        }
        timesContainer.innerHTML = "<p>Carregando horários...</p>";
        const settingsLoaded = await loadScheduleSettings();
        if (!settingsLoaded) { timesContainer.innerHTML = "<p>Não foi possível carregar os horários.</p>"; return; }
        const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
        if (!isWorkingDay(selectedDateObject) || isDateBlockedBySettings(selectedDate)) {
            timesContainer.innerHTML = "<p>Nenhum horário disponível nesta data.</p>"; selectedTime = ""; updateButton(); return;
        }
        const { data: appointments, error } = await fetchAppointmentsForSelectedDate();
        if (error) { console.error("Erro ao buscar agendamentos:", error); timesContainer.innerHTML = "<p>Erro ao carregar horários.</p>"; return; }
        const blockedTimes = scheduleSettings.blockedSlots[selectedDate] || [];
        const now = new Date();
        const isToday = selectedDate === formatDate(now);
        timesContainer.innerHTML = "";

        if (scheduleSettings.considerServiceDuration) {
            if (selectedServiceDuration <= 0) { timesContainer.innerHTML = "<p>Este serviço não possui duração configurada.</p>"; return; }
            const opening = timeToMinutes(scheduleSettings.openingTime);
            const closing = timeToMinutes(scheduleSettings.closingTime);
            let availableCount = 0;
            for (let current = opening; current < closing; current += 5) {
                const time = minutesToTime(current);
                if (current + selectedServiceDuration > closing) continue;
                if (isToday) {
                    const [hours, minutes] = time.split(":").map(Number);
                    const timeDate = new Date();
                    timeDate.setHours(hours, minutes, 0, 0);
                    if (timeDate <= now) continue;
                }
                if (canBookSmartStart(time, appointments || [], blockedTimes)) { renderTimeButton(time, false, time); availableCount++; }
            }
            if (availableCount === 0) timesContainer.innerHTML = "<p>Nenhum horário disponível para este serviço.</p>";
            return;
        }

        const configuredTimes = generateConfiguredTimes();
        if (configuredTimes.length === 0) { timesContainer.innerHTML = "<p>Nenhum horário configurado.</p>"; return; }
        configuredTimes.forEach(function (time) {
            const isOccupied = (appointments || []).some(function (appointment) { return String(appointment.horario || "").substring(0, 5) === time; });
            const isBlocked = blockedTimes.includes(time);
            let isPast = false;
            if (isToday) {
                const [hours, minutes] = time.split(":").map(Number);
                const timeDate = new Date(); timeDate.setHours(hours, minutes, 0, 0); isPast = timeDate <= now;
            }
            if (isBlocked) renderTimeButton(time, true, `${time} — Indisponível`);
            else if (isOccupied) renderTimeButton(time, true, `${time} — Ocupado`);
            else if (isPast) renderTimeButton(time, true, `${time} — Encerrado`);
            else renderTimeButton(time, false, time);
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

    confirmButton.addEventListener("click", async function () {

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

        // ==============================
        // VALIDAÇÕES
        // ==============================

        if (!selectedServiceId) {
            showMessage("Escolha um serviço.");
            return;
        }

        if (!selectedBarberId) {
            showMessage("Escolha um barbeiro.");
            return;
        }

        if (!selectedDate) {
            showMessage("Escolha uma data.");
            return;
        }

        if (!selectedTime) {
            showMessage("Escolha um horário.");
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

        try {

            showMessage("Salvando agendamento...");

            // ==============================
            // 1. NORMALIZAR TELEFONE
            // ==============================

            const normalizedPhone = phone.replace(/\D/g, "");

            if (normalizedPhone.length < 10) {
                showMessage("Digite um WhatsApp válido.");
                return;
            }

            // ==============================
            // 3. REVALIDAR HORÁRIO NO CLIENTE
            //    (A FUNÇÃO TAMBÉM REVALIDA NO BANCO)
            // ==============================

            const stillAvailable = await isSelectedTimeStillAvailable();
            if (!stillAvailable) {
                selectedTime = "";
                if (summaryTime) summaryTime.textContent = "—";
                updateButton();
                await loadAvailableTimes();
                showMessage("Esse horário acabou de ficar indisponível. Escolha outro horário.");
                return;
            }

            // ==============================
            // 4. CRIAR AGENDAMENTO
            //    ATRAVÉS DE FUNÇÃO SEGURA
            // ==============================

            const {
                data: appointmentId,
                error: appointmentError
            } = await supabaseClient
                .schema("api")
                .rpc(
                    "criar_agendamento_publico",
                    {
                        p_nome: name,
                        p_telefone: normalizedPhone,
                        p_barbeiro_id: Number(selectedBarberId),
                        p_servico_id: Number(selectedServiceId),
                        p_data: selectedDate,
                        p_horario: selectedTime
                    }
                );

            if (appointmentError) {

                console.error(
                    "Erro ao criar agendamento pela função segura:",
                    appointmentError
                );

                const message = String(appointmentError.message || "");

                if (message.toLowerCase().includes("agendamento ativo")) {
                    showMessage("Esse número já tem um agendamento ativo. Não pode fazer outro.");
                } else if (message.toLowerCase().includes("indisponível") || message.toLowerCase().includes("ocupado")) {
                    selectedTime = "";
                    if (summaryTime) summaryTime.textContent = "—";
                    updateButton();
                    await loadAvailableTimes();
                    showMessage("Esse horário acabou de ficar indisponível. Escolha outro horário.");
                } else {
                    showMessage("Não foi possível realizar o agendamento. Tente novamente.");
                }

                return;
            }

            if (!appointmentId) {
                console.error("A função não retornou o ID do agendamento.");
                showMessage("Não foi possível confirmar o agendamento.");
                return;
            }

            // ==============================
            // 6. SUCESSO + WHATSAPP
            // ==============================

            showMessage(
                "Agendamento realizado com sucesso!"
            );

            confirmButton.disabled = true;

            const whatsappConfig = scheduleSettings.whatsapp || {};
            if (whatsappConfig.enabled) {
                const configuredMode =
                    whatsappConfig.mode === "barbeiro" ? "barbeiro" : "barbearia";

                const targetPhone = configuredMode === "barbeiro"
                    ? selectedBarberPhone
                    : whatsappConfig.phone;

                const normalizedTargetPhone = normalizeWhatsappDestination(targetPhone);

                if (normalizedTargetPhone) {
                    const formattedDate = formatBookingDateForWhatsapp(selectedDate);
                    const message = [
                        "Olá! Gostaria de confirmar meu agendamento na Navalha de Ouro.",
                        "",
                        `Cliente: ${name}`,
                        `Barbeiro: ${selectedBarber}`,
                        `Serviço: ${selectedService}`,
                        `Data: ${formattedDate}`,
                        `Horário: ${selectedTime}`,
                        `Meu WhatsApp: ${normalizedPhone}`
                    ].join("\n");

                    const whatsappUrl =
                        `https://wa.me/${normalizedTargetPhone}?text=${encodeURIComponent(message)}`;

                    window.location.href = whatsappUrl;
                    return;
                }

                const destinationLabel = configuredMode === "barbeiro"
                    ? `o WhatsApp de ${selectedBarber}`
                    : "o WhatsApp da barbearia";

                showMessage(
                    `Agendamento realizado! Não foi possível abrir ${destinationLabel} porque o número não está configurado.`
                );
            }

        } catch (error) {

            console.error(
                "Erro inesperado:",
                error
            );

            showMessage(
                "Ocorreu um erro inesperado."
            );
        }

    });

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
    // ATUALIZAR BOTÃO
    // ==========================================



    // ==========================================
    // MENSAGEM
    // ==========================================

    function showMessage(message) {

        if (bookingMessage) {

            bookingMessage.textContent =
                message;

        }

    }


    function normalizeWhatsappDestination(value) {
        let digits = String(value || "").replace(/\D/g, "");
        if (!digits) return "";
        if (digits.startsWith("55")) return digits;
        if (digits.length === 10 || digits.length === 11) return `55${digits}`;
        return digits;
    }

    function formatBookingDateForWhatsapp(value) {
        const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "");
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================

    updateButton();

    loadScheduleSettings().then(function () {
        renderCalendar();
        if (selectedDate && selectedBarberId) {
            loadAvailableTimes();
        }
    });

    loadServices();
    loadBarbers();

    window.addEventListener(
        "focus",
        function () {
            loadServices();
            loadBarbers();
            loadScheduleSettings().then(function () {
                renderCalendar();
                if (selectedDate && selectedBarberId) {
                    loadAvailableTimes();
                }
            });
        }
    );

    function setupRealtimeAvailability() {
        if (!supabaseClient || scheduleRealtimeChannel) return;
        scheduleRealtimeChannel = supabaseClient
            .channel("navalha-agendamentos-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "agendamentos" }, function () {
                if (selectedDate && selectedBarberId) loadAvailableTimes();
            })
            .subscribe();
        smartRefreshTimer = window.setInterval(function () {
            if (selectedDate && selectedBarberId) loadAvailableTimes();
        }, 15000);
    }

    setupRealtimeAvailability();

});
