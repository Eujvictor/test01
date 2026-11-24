// =====================================================================
// Camada de acesso ao backend do Barber Control.
//   rpc()             → funções do schema control_api (Postgres)
//   invocarFuncao()   → Edge Functions (operações privilegiadas)
// Todas as mensagens de erro são traduzidas para o usuário.
// =====================================================================
import { supabase } from "../js/supabase.js";
import { APP_CONFIG } from "../config/app.config.js";

export class ErroControl extends Error {
    constructor(mensagem, { codigo = "desconhecido", original = null } = {}) {
        super(mensagem);
        this.name = "ErroControl";
        this.codigo = codigo;
        this.original = original;
    }
}

function traduzirErroBanco(erro) {
    const msg = `${erro?.message ?? ""} ${erro?.details ?? ""}`;
    const codigo = erro?.code ?? "";

    if (msg.includes("acesso_negado")) {
        return new ErroControl("Acesso negado para esta conta.", { codigo: "acesso_negado", original: erro });
    }
    if (msg.includes("mfa_obrigatorio")) {
        return new ErroControl("Verificação em duas etapas obrigatória.", { codigo: "mfa_obrigatorio", original: erro });
    }
    if (codigo === "PGRST106" || /schema must be one of|Invalid schema/i.test(msg)) {
        return new ErroControl(
            "O schema control_api não está exposto na API do Supabase (Settings → Data API → Exposed schemas).",
            { codigo: "schema_nao_exposto", original: erro }
        );
    }
    if (codigo === "PGRST202" || /Could not find the function/i.test(msg)) {
        return new ErroControl(
            "Função do banco não encontrada. Rode no SQL Editor do Supabase a migração mais recente (pasta supabase/migrations).",
            { codigo: "funcao_ausente", original: erro }
        );
    }
    if (codigo === "42501" || /permission denied/i.test(msg)) {
        return new ErroControl("Permissão negada pelo banco de dados.", { codigo: "permissao", original: erro });
    }
    if (/Failed to fetch|NetworkError/i.test(msg)) {
        return new ErroControl("Sem conexão com o servidor.", { codigo: "rede", original: erro });
    }
    return new ErroControl("Não foi possível concluir a operação.", { codigo: codigo || "desconhecido", original: erro });
}

export async function rpc(nome, parametros = {}) {
    const { data, error } = await supabase.schema(APP_CONFIG.apiSchema).rpc(nome, parametros);
    if (error) throw traduzirErroBanco(error);
    return data;
}

// Chama a Edge Function. Se o login venceu (401), renova a sessão e tenta
// uma única vez de novo; sem renovação possível, pede para entrar de novo.
export async function invocarFuncao(nome, corpo = {}, jaRenovou = false) {
    const { data, error } = await supabase.functions.invoke(nome, { body: corpo });
    if (!error) return data;

    if (error.context?.status === 401 && !jaRenovou) {
        const { data: renovada, error: erroRenovar } = await supabase.auth.refreshSession();
        if (!erroRenovar && renovada?.session) return invocarFuncao(nome, corpo, true);
        throw new ErroControl("Sua sessão expirou. Clique em Sair e entre de novo (com o código do autenticador).", {
            codigo: "sessao_expirada", original: error
        });
    }

    let mensagem = null;
    let status = null;
    try {
        status = error.context?.status ?? null;
        const conteudo = await error.context?.json?.();
        mensagem = conteudo?.erro ?? null;
    } catch {
        /* resposta sem JSON */
    }

    if (!mensagem && (error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError")) {
        throw new ErroControl(
            `Edge Function "${nome}" indisponível. Verifique se ela foi publicada no Supabase.`,
            { codigo: "funcao_indisponivel", original: error }
        );
    }
    throw new ErroControl(mensagem ?? `Falha na função "${nome}".`, {
        codigo: status ? `http_${status}` : "funcao_erro",
        original: error
    });
}
