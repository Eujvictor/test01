// =====================================================================
// Ações reutilizadas por vários módulos (sempre com confirmação).
// Cada função retorna true quando houve alteração, para a tela redesenhar.
// =====================================================================
import * as S from "../../services/demo/saas.js";
import { PERIODICIDADES, opcoes } from "../../services/demo/catalogo.js";
import { abrirFormulario } from "../../js/components/formulario.js";
import { confirmar, mostrarToast } from "../../js/utilities/feedback.js";
import { moeda } from "../../js/utilities/format.js";

async function executarConfirmado(confirmacao, acao, sucesso) {
    if (!(await confirmar(confirmacao))) return false;
    try {
        acao();
        mostrarToast(sucesso, "sucesso");
        return true;
    } catch (erro) {
        mostrarToast(erro.message || "Não foi possível concluir a operação.", "erro");
        return false;
    }
}

const MOTIVOS_SUSPENSAO = [
    ["Inadimplência", "Inadimplência"],
    ["Violação dos termos de uso", "Violação dos termos de uso"],
    ["Solicitação do cliente", "Solicitação do cliente"],
    ["Análise de segurança", "Análise de segurança"],
    ["Outro", "Outro"]
];

function camposMotivo(lista) {
    return [
        { nome: "motivo", rotulo: "Motivo", tipo: "select", obrigatorio: true, opcoes: lista, placeholderOpcao: "Selecione" },
        {
            nome: "detalhe", rotulo: "Observação", tipo: "textarea", maxlength: 300,
            validarVazio: true, validar: (v, valores) => (valores.motivo === "Outro" && !v ? "Descreva o motivo." : null)
        }
    ];
}

const juntarMotivo = (v) => (v.detalhe ? `${v.motivo} — ${v.detalhe}` : v.motivo);

// ---------------------------------------------------------------------
// Assinaturas
// ---------------------------------------------------------------------
export async function alterarPlano(assinaturaId) {
    const a = S.assinatura(assinaturaId);
    if (!a) return false;
    if (a.status === "cancelada") {
        mostrarToast("Reative a assinatura antes de alterar o plano.", "atencao");
        return false;
    }
    const b = S.barbearia(a.barbeariaId);
    const atual = S.plano(a.planoId);
    const barbeiros = S.contagens(a.barbeariaId).barbeiros;

    const resultado = await abrirFormulario({
        titulo: "Alterar plano",
        descricao: `${b?.nome ?? ""} · plano atual: ${atual?.nome ?? "—"} (${PERIODICIDADES[a.periodicidade].rotulo.toLowerCase()}). Nenhuma cobrança real é gerada.`,
        campos: [
            {
                nome: "planoId", rotulo: "Novo plano", tipo: "select", obrigatorio: true,
                opcoes: S.planosDisponiveis().map((p) => [p.id, `${p.nome} · ${moeda(p.precoMensal)}/mês · ${moeda(p.precoAnual)}/ano`]),
                validar: (id) => {
                    const p = S.plano(id);
                    return p && p.limiteUsuarios > 0 && barbeiros > p.limiteUsuarios
                        ? `O plano ${p.nome} permite até ${p.limiteUsuarios} barbeiros; esta barbearia tem ${barbeiros}.`
                        : null;
                }
            },
            { nome: "periodicidade", rotulo: "Periodicidade", tipo: "select", obrigatorio: true, opcoes: opcoes(PERIODICIDADES) }
        ],
        valores: { planoId: a.planoId, periodicidade: a.periodicidade },
        textoSalvar: "Alterar plano",
        aoSalvar: (v) => S.alterarPlano(a.id, v.planoId, v.periodicidade)
    });
    if (resultado) mostrarToast("Plano alterado.", "sucesso");
    return Boolean(resultado);
}

export async function cancelarAssinatura(assinaturaId) {
    const a = S.assinatura(assinaturaId);
    if (!a) return false;
    const b = S.barbearia(a.barbeariaId);
    const resultado = await abrirFormulario({
        titulo: "Cancelar assinatura",
        descricao: `${b?.nome ?? ""} passará para o status "cancelada". Nenhum estorno ou cobrança real é processado.`,
        campos: camposMotivo([
            ["Solicitação do cliente", "Solicitação do cliente"],
            ["Inadimplência", "Inadimplência"],
            ["Encerramento das atividades", "Encerramento das atividades"],
            ["Migração para concorrente", "Migração para concorrente"],
            ["Outro", "Outro"]
        ]),
        textoSalvar: "Cancelar assinatura",
        perigo: true,
        aoSalvar: (v) => S.cancelarAssinatura(a.id, juntarMotivo(v))
    });
    if (resultado) mostrarToast("Assinatura cancelada.", "sucesso");
    return Boolean(resultado);
}

export function reativarAssinatura(assinaturaId) {
    const a = S.assinatura(assinaturaId);
    const b = a ? S.barbearia(a.barbeariaId) : null;
    return executarConfirmado(
        {
            titulo: "Reativar assinatura?",
            mensagem: `A assinatura de ${b?.nome ?? "—"} volta a ficar ativa, com um novo ciclo a partir de hoje.`,
            textoConfirmar: "Reativar"
        },
        () => S.reativarAssinatura(assinaturaId),
        "Assinatura reativada."
    );
}

// ---------------------------------------------------------------------
// Barbearias
// ---------------------------------------------------------------------
export async function suspenderBarbearia(barbeariaId) {
    const b = S.barbearia(barbeariaId);
    if (!b) return false;
    const resultado = await abrirFormulario({
        titulo: `Suspender ${b.nome}`,
        descricao: "Em produção, o acesso da barbearia e da equipe seria bloqueado. Aqui apenas o status demonstrativo é alterado.",
        campos: camposMotivo(MOTIVOS_SUSPENSAO),
        textoSalvar: "Suspender",
        perigo: true,
        aoSalvar: (v) => S.suspenderBarbearia(barbeariaId, juntarMotivo(v))
    });
    if (resultado) mostrarToast(`${b.nome} suspensa.`, "sucesso");
    return Boolean(resultado);
}

export function reativarBarbearia(barbeariaId) {
    const b = S.barbearia(barbeariaId);
    const a = S.assinaturaDaBarbearia(barbeariaId);
    const extra = a && (a.status === "cancelada" || a.status === "vencida") ? " A assinatura também será reativada com novo ciclo." : "";
    return executarConfirmado(
        { titulo: `Reativar ${b?.nome ?? "barbearia"}?`, mensagem: `O status volta para ativa.${extra}`, textoConfirmar: "Reativar" },
        () => S.reativarBarbearia(barbeariaId),
        "Barbearia reativada."
    );
}

// ---------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------
export async function suspenderUsuario(usuarioId) {
    const u = S.usuario(usuarioId);
    if (!u) return false;
    const resultado = await abrirFormulario({
        titulo: `Suspender ${u.nome}`,
        descricao: "Usuário demonstrativo: nenhuma conta real de acesso existe ou é bloqueada.",
        campos: camposMotivo(MOTIVOS_SUSPENSAO),
        textoSalvar: "Suspender",
        perigo: true,
        aoSalvar: (v) => S.suspenderUsuario(usuarioId, juntarMotivo(v))
    });
    if (resultado) mostrarToast(`${u.nome} suspenso.`, "sucesso");
    return Boolean(resultado);
}

export function reativarUsuario(usuarioId) {
    const u = S.usuario(usuarioId);
    return executarConfirmado(
        { titulo: `Reativar ${u?.nome ?? "usuário"}?`, mensagem: "O status do usuário volta para ativo.", textoConfirmar: "Reativar" },
        () => S.reativarUsuario(usuarioId),
        "Usuário reativado."
    );
}
