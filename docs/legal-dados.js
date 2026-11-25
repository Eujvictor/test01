// =====================================================================
// DADOS DA EMPRESA USADOS NOS TERMOS DE USO E NA POLÍTICA DE PRIVACIDADE
// Preencha aqui (um lugar só). Enquanto estiver "(a preencher)", as
// páginas mostram o campo destacado em amarelo.
// =====================================================================
window.BARBER_LEGAL = Object.freeze({
    empresa: "João Victor Pereira da Silva",
    documento: "pessoa física",
    email: "barbercontato2@gmail.com",
    cidade: "Anápolis/GO",
    atualizado: "25/11/2026"
});

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-legal]").forEach((el) => {
        const valor = window.BARBER_LEGAL[el.dataset.legal] ?? "";
        el.textContent = valor;
        el.classList.toggle("a-preencher", valor.startsWith("(a preencher"));
    });
});
