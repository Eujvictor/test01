document.addEventListener("DOMContentLoaded", () => {
    // ==============================
    // MENU MOBILE
    // ==============================
    const menuButton = document.getElementById("menuButton");
    const nav = document.querySelector(".nav");

    if (menuButton && nav) {
        menuButton.addEventListener("click", () => {
            const isOpen = nav.classList.toggle("mobile-open");

            menuButton.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        });

        const navLinks = nav.querySelectorAll("a");

        navLinks.forEach((link) => {
            link.addEventListener("click", () => {
                nav.classList.remove("mobile-open");
                menuButton.setAttribute("aria-expanded", "false");
            });
        });
    }

    // ==============================
    // ROLAGEM SUAVE
    // ==============================
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            const targetId = link.getAttribute("href");

            if (!targetId || targetId === "#") {
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

    // ==============================
    // EQUIPE — BARBEIROS ATIVOS
    // ==============================
    const teamGrid = document.getElementById("teamGrid");

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
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "B";
    }

    async function loadHomeBarbersFromSupabase() {
        if (!teamGrid) {
            return;
        }

        if (!window.supabaseClient) {
            console.error("supabaseClient não foi encontrado.");
            teamGrid.innerHTML =
                "<p>Não foi possível carregar a equipe.</p>";
            return;
        }

        teamGrid.innerHTML =
            "<p>Carregando equipe...</p>";

        const { data, error } = await window.supabaseClient
            .from("BARBEIROS")
            .select("id, nome, especialidade, ativo")
            .eq("ativo", true)
            .order("nome", { ascending: true });

        if (error) {
            console.error("Erro ao carregar barbeiros:", error);

            teamGrid.innerHTML =
                "<p>Não foi possível carregar a equipe.</p>";

            return;
        }

        if (!data || data.length === 0) {
            teamGrid.innerHTML =
                "<p>Nenhum barbeiro disponível no momento.</p>";

            return;
        }

        teamGrid.innerHTML = data.map((barber) => `
            <article class="team-card">
                <div class="team-avatar">
                    ${getInitials(barber.nome)}
                </div>

                <div>
                    <h3>${escapeHTML(barber.nome)}</h3>
                    <p>${escapeHTML(
                        barber.especialidade || "Barbeiro"
                    )}</p>
                </div>
            </article>
        `).join("");
    }

    loadHomeBarbersFromSupabase();
});
