// =====================================================================
// Exportação de relatórios em CSV, Excel (.xlsx) e PDF.
// Os três formatos usam as MESMAS colunas e linhas exibidas na tela
// (já filtradas pelo módulo), então o arquivo reflete o que foi visto.
// colunas: [{ rotulo, valor(linha), formato?: "texto"|"numero"|"moeda"|"percentual"|"decimal" }]
// =====================================================================
import { gerarCsv } from "./csv.js";
import { gerarXlsx } from "./xlsx.js";
import { gerarPdf } from "./pdf.js";
import { numero, moeda, percentual } from "./format.js";

export const FORMATOS_EXPORTACAO = { csv: "CSV", xlsx: "Excel (.xlsx)", pdf: "PDF" };

export function formatarValor(valor, formato) {
    if (valor === null || valor === undefined || valor === "") return "—";
    if (formato === "moeda") return moeda(valor);
    if (formato === "percentual") return percentual(valor);
    if (formato === "numero") return numero(valor);
    if (formato === "decimal") return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return String(valor);
}

export function baixarArquivo(nome, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const AVISO = "Dados demonstrativos: valores fictícios gerados no navegador. Não representam resultados reais nem integrações ativas.";

// Valor "cru" para planilhas: números como números (percentual em pontos, ex.: 12,5).
function valorPlanilha(valor, formato) {
    if (valor === null || valor === undefined || valor === "") return "";
    if (formato === "percentual") return Math.round(Number(valor) * 10000) / 100;
    if (["moeda", "numero", "decimal"].includes(formato)) return Math.round(Number(valor) * 100) / 100;
    return String(valor);
}

const rotuloPlanilha = (c) => (c.formato === "percentual" ? `${c.rotulo} (%)` : c.formato === "moeda" ? `${c.rotulo} (R$)` : c.rotulo);

/**
 * relatorio: { arquivo, titulo, subtitulo?, metadados: [[rotulo, valor]], kpis?: [[rotulo, valor]],
 *              colunas, linhas, observacoes?: [texto] }
 */
export function exportarRelatorio(formato, relatorio) {
    const { arquivo, titulo, subtitulo = "", metadados = [], kpis = [], colunas, linhas, observacoes = [] } = relatorio;
    const data = new Date().toISOString().slice(0, 10);
    const base = `${arquivo}-DEMO-${data}`;

    if (formato === "csv") {
        const conteudo = "﻿" + gerarCsv(
            colunas.map((c) => ({ rotulo: rotuloPlanilha(c), valor: (l) => valorPlanilha(c.valor(l), c.formato) })),
            linhas);
        const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
        baixarArquivo(`${base}.csv`, blob);
        return { nome: `${base}.csv`, blob };
    }

    if (formato === "xlsx") {
        const dados = [colunas.map(rotuloPlanilha), ...linhas.map((l) => colunas.map((c) => valorPlanilha(c.valor(l), c.formato)))];
        const info = [
            ["Relatório", titulo],
            ...(subtitulo ? [["Descrição", subtitulo]] : []),
            ["Gerado em", new Date().toLocaleString("pt-BR")],
            ...metadados,
            ["Registros", linhas.length],
            ...kpis.map(([r, v]) => [`Indicador · ${r}`, v]),
            ...observacoes.map((o, i) => [`Observação ${i + 1}`, o]),
            ["Aviso", AVISO]
        ];
        const blob = gerarXlsx([
            { nome: "Relatório", linhas: dados, cabecalho: 1 },
            { nome: "Informações", linhas: [["Campo", "Valor"], ...info], cabecalho: 1, larguras: [28, 90] }
        ]);
        baixarArquivo(`${base}.xlsx`, blob);
        return { nome: `${base}.xlsx`, blob };
    }

    if (formato === "pdf") {
        const blob = gerarPdf({
            titulo, subtitulo, metadados: [["Gerado em", new Date().toLocaleString("pt-BR")], ...metadados], aviso: AVISO,
            secoes: [
                ...(kpis.length ? [{ titulo: "Indicadores", kpis }] : []),
                ...(observacoes.length ? [{ titulo: "Leitura e critérios", paragrafos: observacoes }] : []),
                {
                    titulo: `Dados (${linhas.length} registros)`,
                    tabela: {
                        colunas: colunas.map((c) => ({ rotulo: c.rotulo, alinhar: ["moeda", "numero", "percentual", "decimal"].includes(c.formato) ? "direita" : "esquerda" })),
                        linhas: linhas.map((l) => colunas.map((c) => formatarValor(c.valor(l), c.formato)))
                    }
                }
            ]
        });
        baixarArquivo(`${base}.pdf`, blob);
        return { nome: `${base}.pdf`, blob };
    }

    throw new Error("Formato de exportação desconhecido.");
}
