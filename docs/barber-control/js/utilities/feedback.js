// Feedback visual reutilizável: toasts e modal de confirmação.
import { escapar, atualizarIcones } from "./dom.js";

const ICONES_TOAST = { info: "info", sucesso: "circle-check-big", erro: "octagon-alert", atencao: "triangle-alert" };

export function mostrarToast(mensagem, tipo = "info", duracaoMs = 4500) {
    let pilha = document.querySelector(".toasts");
    if (!pilha) {
        pilha = document.createElement("div");
        pilha.className = "toasts";
        pilha.setAttribute("role", "status");
        pilha.setAttribute("aria-live", "polite");
        document.body.appendChild(pilha);
    }
    const toast = document.createElement("div");
    toast.className = `toast toast--${tipo}`;
    toast.innerHTML = `<i data-lucide="${ICONES_TOAST[tipo] ?? "info"}" aria-hidden="true"></i><span>${escapar(mensagem)}</span>`;
    pilha.appendChild(toast);
    atualizarIcones();
    setTimeout(() => toast.remove(), duracaoMs);
}

// Retorna Promise<boolean>. Use em toda operação crítica.
export function confirmar({ titulo, mensagem, textoConfirmar = "Confirmar", perigo = false }) {
    return new Promise((resolver) => {
        const dialogo = document.createElement("dialog");
        dialogo.className = "modal";
        dialogo.innerHTML = `
            <form method="dialog">
                <div class="modal__corpo">
                    <h2>${escapar(titulo)}</h2>
                    <p>${escapar(mensagem)}</p>
                </div>
                <div class="modal__acoes">
                    <button class="btn btn--fantasma" value="cancelar">Cancelar</button>
                    <button class="btn ${perigo ? "btn--perigo" : "btn--primario"}" value="confirmar">${escapar(textoConfirmar)}</button>
                </div>
            </form>`;
        document.body.appendChild(dialogo);
        dialogo.addEventListener("close", () => {
            resolver(dialogo.returnValue === "confirmar");
            dialogo.remove();
        });
        dialogo.showModal();
    });
}
