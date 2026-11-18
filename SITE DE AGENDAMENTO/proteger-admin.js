// ==========================================
// SEGURANÇA DO PAINEL ADMINISTRATIVO
// ------------------------------------------
// Multi-tenant: entra quem é membro ativo de uma barbearia
// (api.minha_barbearia, via tenant-cliente.js). A proteção real
// dos dados está nas políticas RLS do banco; aqui só decidimos
// quem vê a interface.
// Banco ainda sem as migrações: mantém a regra antiga (e-mail
// da barbearia de referência).
// ==========================================

(function () {
    "use strict";

    const EMAIL_LEGADO = "navalhadeouro@gmail.com";

    function irParaLogin(motivo) {
        window.location.replace(`area-equipe.html${motivo ? `?motivo=${encodeURIComponent(motivo)}` : ""}`);
    }

    async function sair(motivo) {
        try {
            await window.supabaseClient.auth.signOut();
        } catch {
            /* segue para o login mesmo assim */
        }
        irParaLogin(motivo);
    }

    // Barbearia suspensa: painel abre só para consulta.
    function ativarSomenteConsulta(atual) {
        document.body.classList.add("somente-consulta");
        const aviso = document.createElement("div");
        aviso.className = "aviso-somente-consulta";
        aviso.setAttribute("role", "status");
        aviso.textContent = `${atual.nome || "Esta barbearia"} está suspensa: o painel está em modo consulta e nenhuma alteração pode ser salva. Fale com o suporte do Barber.`;
        const principal = document.querySelector(".main-content") || document.body;
        principal.prepend(aviso);
    }

    function mostrarNome(atual) {
        if (!atual.nome) return;
        document.title = `Painel Administrativo | ${atual.nome}`;
        const mobile = document.querySelector(".mobile-header strong");
        if (mobile) mobile.textContent = atual.nome.toUpperCase();
        const marca = document.querySelector(".brand-text");
        if (marca) {
            const partes = atual.nome.trim().split(/\s+/);
            const forte = marca.querySelector("strong");
            const linha = marca.querySelector("span");
            if (forte) forte.textContent = (partes.shift() || "").toUpperCase();
            if (linha) linha.textContent = partes.join(" ").toUpperCase();
        }
        const simbolo = document.querySelector(".brand-symbol");
        if (simbolo) simbolo.textContent = atual.nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    }

    async function verificar() {
        const { data, error } = await window.supabaseClient.auth.getUser();
        const user = data && data.user;
        if (error || !user) return irParaLogin();

        const atual = window.BarbeariaAtual ? await window.BarbeariaAtual.pronta : null;

        if (atual && atual.modo === "multi") {
            if (atual.semAcesso || !atual.id) return sair("sem_acesso");
            document.documentElement.dataset.barbearia = atual.slug;
            mostrarNome(atual);
            if (!atual.podeEditar) ativarSomenteConsulta(atual);
            console.log("Painel autorizado:", atual.nome, `(${atual.papel})`);
            return;
        }

        // Modo antigo (banco sem as migrações multi-tenant).
        if (String(user.email || "").toLowerCase() !== EMAIL_LEGADO) return sair("sem_acesso");
        console.log("Administrador autorizado:", user.email);
    }

    document.addEventListener("DOMContentLoaded", () => {
        verificar().catch((erro) => {
            console.error("Erro na proteção do painel:", erro);
            irParaLogin();
        });
    });
})();
