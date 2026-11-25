// =====================================================================
// BARBER CONTROL — CONFIGURAÇÃO PÚBLICA
// Apenas valores que PODEM estar no navegador.
// A chave publishable é pública por definição; a segurança está nas
// funções do schema control_api (admin + MFA) e nas Edge Functions.
// NUNCA coloque aqui service_role, tokens do Mercado Pago ou e-mails
// de administrador.
// =====================================================================
export const APP_CONFIG = Object.freeze({
    nome: "BARBER CONTROL",
    versao: "1.1.0",

    supabaseUrl: "https://cjwmzbknarafinftpqsv.supabase.co",
    supabasePublishableKey: "sb_publishable_k1KkMm2f4-xRDy07B7f46w_0WddyoUj",

    // Chave própria de armazenamento da sessão: não mistura com o login
    // do Barber, mesmo se os dois sistemas estiverem no mesmo domínio.
    authStorageKey: "barber-control-auth",

    apiSchema: "control_api",

    // Site público das barbearias (cada uma em ?b=<slug>).
    sitePublicoUrl: "https://eujvictor.github.io/test01/",

    funcoes: Object.freeze({
        login: "control-login",
        admin: "control-admin"
    }),

    seguranca: Object.freeze({
        // Sem a Edge Function control-login publicada, o login é recusado.
        exigirProtecaoLogin: true,
        inatividadeMinutos: 30
    })
});
