// Entrada: envia para o painel se houver sessão, senão para o login.
// A validação real (admin + MFA) acontece na página de destino.
import { obterSessao } from "./auth.js";

obterSessao()
    .then((sessao) => window.location.replace(sessao ? "dashboard.html" : "login.html"))
    .catch(() => window.location.replace("login.html"));
