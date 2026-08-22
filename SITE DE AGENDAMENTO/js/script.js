document.addEventListener("DOMContentLoaded", () => {

    const menuButton = document.getElementById("menuButton");
    const nav = document.querySelector(".nav");

    if (menuButton && nav) {

        menuButton.addEventListener("click", () => {

            const isOpen = nav.classList.toggle("mobile-open");

            menuButton.setAttribute(
                "aria-expanded",
                isOpen
            );

        });

    }


    /*
     * Fecha o menu quando o usuário
     * clica em um link.
     */

    const navLinks = document.querySelectorAll(".nav a");

    navLinks.forEach((link) => {

        link.addEventListener("click", () => {

            nav.classList.remove("mobile-open");

        });

    });


    /*
     * Rolagem suave para os links internos.
     */

    document.querySelectorAll('a[href^="#"]').forEach((link) => {

        link.addEventListener("click", (event) => {

            const targetId = link.getAttribute("href");

            if (targetId === "#") {
                return;
            }

            const target = document.querySelector(targetId);

            if (!target) {
                return;
            }

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        });

    });

});

                              "AGENDAR" 

document.addEventListener("DOMContentLoaded", () => {

    let selectedService = null;
    let selectedPrice = 0;
    let selectedBarber = null;
    let selectedDate = null;
    let selectedTime = null;


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

    const dateInput =
        document.getElementById("dateInput");

    const confirmButton =
        document.getElementById("confirmButton");

    const bookingMessage =
        document.getElementById("bookingMessage");


    /*
     * Serviço
     */

    const serviceButtons =
        document.querySelectorAll(".service-option");

    serviceButtons.forEach((button) => {

        button.addEventListener("click", () => {

            serviceButtons.forEach((item) => {
                item.classList.remove("selected");
            });

            button.classList.add("selected");

            selectedService =
                button.dataset.service;

            selectedPrice =
                Number(button.dataset.price);

            summaryService.textContent =
                selectedService;

            summaryPrice.textContent =
                formatCurrency(selectedPrice);

            updateButtonState();

        });

    });


    /*
     * Barbeiro
     */

    const barberButtons =
        document.querySelectorAll(".barber-option");

    barberButtons.forEach((button) => {

        button.addEventListener("click", () => {

            barberButtons.forEach((item) => {
                item.classList.remove("selected");
            });

            button.classList.add("selected");

            selectedBarber =
                button.dataset.barber;

            summaryBarber.textContent =
                selectedBarber;

            updateButtonState();

        });

    });


    /*
     * Data
     */

   // ==============================
// CALENDÁRIO
// ==============================

const calendarDays = document.getElementById("calendarDays");
const calendarMonth = document.getElementById("calendarMonth");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");

let currentCalendarDate = new Date();
currentCalendarDate.setDate(1);

function renderCalendar() {
    calendarDays.innerHTML = "";

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    calendarMonth.textContent = new Date(
        year,
        month
    ).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric"
    });

    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement("span");
        emptyDay.className = "calendar-day empty";
        calendarDays.appendChild(emptyDay);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "calendar-day";
        button.textContent = day;

        const selectedDateObject = new Date(year, month, day);
        selectedDateObject.setHours(0, 0, 0, 0);

        if (selectedDateObject < today) {
            button.disabled = true;
            button.classList.add("disabled");
        }

        button.addEventListener("click", () => {
            document
                .querySelectorAll(".calendar-day.selected")
                .forEach((item) => {
                    item.classList.remove("selected");
                });

            button.classList.add("selected");

            selectedDate =
                `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

            summaryDate.textContent =
                selectedDateObject.toLocaleDateString("pt-BR");
        });

        calendarDays.appendChild(button);
    }
}

const prevMonthButton = document.getElementById('prevMonth');

prevMonthButton.addEventListener("click", () => {
    currentCalendarDate.setMonth(
        currentCalendarDate.getMonth() - 1
    );

    renderCalendar();
});

const nextMonthButton = document.getElementById('nextMonth');

nextMonthButton.addEventListener("click", () => {
    currentCalendarDate.setMonth(
        currentCalendarDate.getMonth() + 1
    );

    renderCalendar();
});

renderCalendar();

renderCalendar();


    /*
     * Horários
     */

    const timeButtons =
        document.querySelectorAll(".time-option");

    timeButtons.forEach((button) => {

        button.addEventListener("click", () => {

            timeButtons.forEach((item) => {
                item.classList.remove("selected");
            });

            button.classList.add("selected");

            selectedTime =
                button.textContent.trim();

            summaryTime.textContent =
                selectedTime;

            updateButtonState();

        });

    });


    /*
     * Confirmar
     */

    confirmButton.addEventListener("click", () => {

        const name =
            document.getElementById("name").value.trim();

        const phone =
            document.getElementById("phone").value.trim();


        if (!selectedService) {

            showMessage(
                "Escolha um serviço."
            );

            return;
        }


        if (!selectedBarber) {

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


        /*
         * POR ENQUANTO:
         *
         * Aqui ainda não salvamos no banco.
         *
         * Na próxima etapa vamos substituir
         * este trecho por uma chamada ao Supabase.
         */

        const appointment = {

            service: selectedService,

            price: selectedPrice,

            barber: selectedBarber,

            date: selectedDate,

            time: selectedTime,

            name: name,

            phone: phone

        };


        console.log(
            "Agendamento:",
            appointment
        );


        showMessage(
            "Agendamento preparado! Na próxima etapa vamos conectá-lo ao banco de dados."
        );

    });


    function updateButtonState() {

        const ready =
            selectedService &&
            selectedBarber &&
            selectedDate &&
            selectedTime;

        confirmButton.disabled = !ready;

    }


    function showMessage(message) {

        bookingMessage.textContent =
            message;

    }


    function formatCurrency(value) {

        return new Intl.NumberFormat(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        ).format(value);

    }


    /*
     * Permite receber o serviço pela URL.
     *
     * Exemplo:
     *
     * agendar.html?servico=barba
     */

    const params =
        new URLSearchParams(
            window.location.search
        );

    const serviceFromUrl =
        params.get("servico");


    if (serviceFromUrl) {

        const serviceMap = {

            "corte-masculino":
                "Corte Masculino",

            "corte-barba":
                "Corte + Barba",

            "barba":
                "Barba",

            "sobrancelha":
                "Sobrancelha",

            "pigmentacao":
                "Pigmentação",

            "corte-infantil":
                "Corte Infantil"

        };


        const serviceName =
            serviceMap[serviceFromUrl];


        if (serviceName) {

            serviceButtons.forEach((button) => {

                if (
                    button.dataset.service ===
                    serviceName
                ) {

                    button.click();

                }

            });

        }
    }
    


    updateButtonState(); 

});