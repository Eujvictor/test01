// Exportação CSV compatível com Excel em português (separador ";" e BOM UTF-8).

function celula(valor) {
    if (valor === null || valor === undefined) return "";
    const texto = typeof valor === "number" ? String(valor).replace(".", ",") : String(valor);
    // Evita injeção de fórmulas ao abrir no Excel.
    const seguro = /^[=+\-@]/.test(texto) && typeof valor !== "number" ? `'${texto}` : texto;
    return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function gerarCsv(colunas, linhas) {
    const cabecalho = colunas.map((c) => celula(c.rotulo)).join(";");
    const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(";"));
    return [cabecalho, ...corpo].join("\r\n");
}

export function baixarCsv(nomeArquivo, colunas, linhas) {
    const conteudo = "﻿" + gerarCsv(colunas, linhas);
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
