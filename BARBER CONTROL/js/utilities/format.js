// Formatação pt-BR. Valores nulos viram "—" (nunca zero inventado).

const fmtNumero = new Intl.NumberFormat("pt-BR");
const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const fmtRelativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export const VAZIO = "—";

export function numero(valor) {
    return valor === null || valor === undefined || Number.isNaN(Number(valor)) ? VAZIO : fmtNumero.format(Number(valor));
}

export function moeda(valor) {
    return valor === null || valor === undefined || Number.isNaN(Number(valor)) ? VAZIO : fmtMoeda.format(Number(valor));
}

export function dataHora(iso) {
    if (!iso) return VAZIO;
    const data = new Date(iso);
    return Number.isNaN(data.getTime()) ? VAZIO : fmtDataHora.format(data);
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const fmtMesCurto = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
const fmtMesLongo = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export function data(iso) {
    if (!iso) return VAZIO;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? VAZIO : fmtData.format(d);
}

// "2026-11" → "nov. de 26" (curto) ou "novembro de 2026" (longo)
export function mesReferencia(chave, longo = false) {
    const [ano, mes] = chave.split("-").map(Number);
    const d = new Date(ano, mes - 1, 1);
    return (longo ? fmtMesLongo : fmtMesCurto).format(d).replace(" de ", "/").replace(".", "");
}

export function percentual(valor, casas = 1) {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return VAZIO;
    return `${(Number(valor) * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function tempoRelativo(iso) {
    if (!iso) return VAZIO;
    const segundos = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const escalas = [
        ["year", 31536000], ["month", 2592000], ["day", 86400],
        ["hour", 3600], ["minute", 60], ["second", 1]
    ];
    for (const [unidade, s] of escalas) {
        if (Math.abs(segundos) >= s || unidade === "second") {
            return fmtRelativo.format(Math.round(segundos / s), unidade);
        }
    }
    return VAZIO;
}

export function mesAtual() {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
}
