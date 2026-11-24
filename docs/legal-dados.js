// =====================================================================
// DADOS DA EMPRESA USADOS NOS TERMOS DE USO E NA POLÍTICA DE PRIVACIDADE
// Preencha aqui (um lugar só). Enquanto estiver "(a preencher)", as
// páginas mostram o campo destacado em amarelo.
// =====================================================================
window.BARBER_LEGAL = Object.freeze({
    empresa: "(a preencher: nome da empresa ou do responsável)",
    documento: "(a preencher: CNPJ ou CPF)",
    email: "(a preencher: e-mail de contato e privacidade)",
    cidade: "(a preencher: cidade/UF do foro)",
    atualizado: "24/11/2026"
});

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-legal]").forEach((el) => {
        const valor = window.BARBER_LEGAL[el.dataset.legal] ?? "";
        el.textContent = valor;
        el.classList.toggle("a-preencher", valor.startsWith("(a preencher"));
    });
});
