// =====================================================================
// Geração de PDF sem bibliotecas externas (PDF 1.4, fontes padrão
// Helvetica com codificação WinAnsi, que cobre os acentos do português).
// documento: {
//   titulo, subtitulo?, metadados?: [[rotulo, valor]], aviso?,
//   secoes: [{ titulo?, kpis?: [[rotulo, valor]], paragrafos?: [texto],
//              tabela?: { colunas: [{ rotulo, alinhar?: "direita" }], linhas: [[texto]] } }]
// }
// =====================================================================

// Larguras da Helvetica (1/1000 do tamanho da fonte), ASCII 32–126.
const LARGURAS = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

const ESPECIAIS = { 0x20AC: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x202F: 0x20, 0x2009: 0x20 };

// Texto → "string binária" WinAnsi (um caractere por byte).
function winAnsi(texto) {
    let s = "";
    for (const ch of String(texto ?? "")) {
        const cp = ch.codePointAt(0);
        if (cp >= 0x20 && cp <= 0x7E) s += ch;
        else if (cp >= 0xA0 && cp <= 0xFF) s += String.fromCharCode(cp);
        else if (ESPECIAIS[cp]) s += String.fromCharCode(ESPECIAIS[cp]);
        else if (cp === 0x0A || cp === 0x09) s += " ";
        else s += "?";
    }
    return s;
}

const escaparPdf = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function larguraTexto(texto, tamanho, negrito = false) {
    let total = 0;
    for (const ch of String(texto ?? "")) {
        const base = ch.normalize("NFD")[0];
        const cp = base.codePointAt(0);
        total += cp >= 32 && cp <= 126 ? LARGURAS[cp - 32] : 556;
    }
    return (total / 1000) * tamanho * (negrito ? 1.06 : 1);
}

function cortar(texto, largura, tamanho, negrito = false) {
    const t = String(texto ?? "");
    if (larguraTexto(t, tamanho, negrito) <= largura) return t;
    let s = t;
    while (s.length > 1 && larguraTexto(`${s}…`, tamanho, negrito) > largura) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
}

function quebrarLinhas(texto, largura, tamanho) {
    const palavras = String(texto ?? "").split(/\s+/);
    const linhas = [];
    let atual = "";
    palavras.forEach((p) => {
        const teste = atual ? `${atual} ${p}` : p;
        if (larguraTexto(teste, tamanho) > largura && atual) {
            linhas.push(atual);
            atual = p;
        } else atual = teste;
    });
    if (atual) linhas.push(atual);
    return linhas;
}

export function gerarPdf(documento) {
    const maxColunas = Math.max(0, ...documento.secoes.map((s) => s.tabela?.colunas.length ?? 0));
    const paisagem = maxColunas > 6;
    const L = paisagem ? 842 : 595;
    const A = paisagem ? 595 : 842;
    const M = 40;
    const util = L - 2 * M;
    const paginas = [];
    let ops = [];
    let y = 0;

    const texto = (x, yy, t, tam = 9, negrito = false, cor = "0.12 g") =>
        ops.push(`${cor} BT /${negrito ? "F2" : "F1"} ${tam} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${escaparPdf(winAnsi(t))}) Tj ET`);
    const retangulo = (x, yy, w, h, cor) => ops.push(`${cor} ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    const linha = (x1, y1, x2, y2, cor = "0.85 G", esp = 0.5) => ops.push(`${cor} ${esp} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);

    function novaPagina() {
        if (ops.length) paginas.push(ops);
        ops = [];
        y = A - M;
        // Faixa superior
        texto(M, y - 4, "BARBER CONTROL", 8, true, "0.776 0.647 0.408 rg");
        texto(M + 90, y - 4, "· Central administrativa · DADOS DEMONSTRATIVOS", 8, false, "0.45 g");
        linha(M, y - 10, L - M, y - 10, "0.776 0.647 0.408 RG", 0.8);
        y -= 28;
    }
    const garantir = (altura) => { if (y - altura < M + 24) novaPagina(); };

    novaPagina();
    texto(M, y, documento.titulo, 17, true, "0.07 g");
    y -= 18;
    if (documento.subtitulo) { texto(M, y, documento.subtitulo, 10, false, "0.35 g"); y -= 16; }
    (documento.metadados ?? []).forEach(([r, v]) => {
        texto(M, y, `${r}:`, 8.5, true, "0.3 g");
        texto(M + larguraTexto(`${r}: `, 8.5, true) + 2, y, cortar(v, util - 120, 8.5), 8.5, false, "0.2 g");
        y -= 12;
    });
    if (documento.aviso) {
        y -= 4;
        const linhasAviso = quebrarLinhas(documento.aviso, util - 16, 8);
        const h = linhasAviso.length * 11 + 10;
        retangulo(M, y - h + 8, util, h, "0.97 0.94 0.86 rg");
        linhasAviso.forEach((l, i) => texto(M + 8, y - i * 11, l, 8, false, "0.35 0.27 0.1 rg"));
        y -= h + 6;
    }
    y -= 6;

    documento.secoes.forEach((secao) => {
        if (secao.titulo) {
            garantir(40);
            texto(M, y, secao.titulo, 12, true, "0.07 g");
            y -= 6;
            linha(M, y, L - M, y);
            y -= 14;
        }
        if (secao.kpis?.length) {
            const porLinha = paisagem ? 4 : 3;
            const w = util / porLinha;
            secao.kpis.forEach(([r, v], i) => {
                if (i % porLinha === 0) { garantir(34); if (i) y -= 34; }
                const x = M + (i % porLinha) * w;
                texto(x, y, cortar(r, w - 10, 7.5), 7.5, false, "0.4 g");
                texto(x, y - 13, cortar(v, w - 10, 11, true), 11, true, "0.07 g");
            });
            y -= 40;
        }
        (secao.paragrafos ?? []).forEach((p) => {
            quebrarLinhas(p, util, 9).forEach((l) => { garantir(13); texto(M, y, l, 9, false, "0.2 g"); y -= 12; });
            y -= 4;
        });
        if (secao.tabela) {
            const { colunas, linhas } = secao.tabela;
            const tam = colunas.length > 8 ? 7 : 8;
            const medidas = colunas.map((c, i) => Math.min(220, Math.max(larguraTexto(c.rotulo, tam, true),
                ...linhas.slice(0, 200).map((l) => larguraTexto(l[i], tam))) + 10));
            const somaMedidas = medidas.reduce((s, m) => s + m, 0);
            const larguras = medidas.map((m) => (m / somaMedidas) * util);
            const altura = tam + 7;
            const cabecalho = () => {
                retangulo(M, y - 4, util, altura, "0.93 0.91 0.86 rg");
                let x = M;
                colunas.forEach((c, i) => {
                    const t = cortar(c.rotulo, larguras[i] - 8, tam, true);
                    const dx = c.alinhar === "direita" ? larguras[i] - 4 - larguraTexto(t, tam, true) : 4;
                    texto(x + dx, y, t, tam, true, "0.15 g");
                    x += larguras[i];
                });
                y -= altura;
            };
            garantir(altura * 3);
            cabecalho();
            if (!linhas.length) { texto(M + 4, y, "Nenhum registro com os filtros selecionados.", tam, false, "0.4 g"); y -= altura; }
            linhas.forEach((l, r) => {
                if (y - altura < M + 24) { novaPagina(); cabecalho(); }
                if (r % 2 === 1) retangulo(M, y - 4, util, altura, "0.975 g");
                let x = M;
                colunas.forEach((c, i) => {
                    const t = cortar(l[i], larguras[i] - 8, tam);
                    const dx = c.alinhar === "direita" ? larguras[i] - 4 - larguraTexto(t, tam) : 4;
                    texto(x + dx, y, t, tam, false, "0.15 g");
                    x += larguras[i];
                });
                y -= altura;
            });
            y -= 10;
        }
    });
    paginas.push(ops);

    // ---------- Montagem dos objetos ----------
    const objetos = [];
    const add = (conteudo) => { objetos.push(conteudo); return objetos.length; };
    const catalogo = add(null);
    const paginasId = add(null);
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const total = paginas.length;
    const kids = paginas.map((p, i) => {
        const rodape = [
            `0.5 g BT /F1 7.5 Tf ${M} 22 Td (${escaparPdf(winAnsi(`Gerado em ${new Date().toLocaleString("pt-BR")} · Dados fictícios do ambiente demonstrativo; não representam resultados reais.`))}) Tj ET`,
            `0.5 g BT /F1 7.5 Tf ${L - M - 50} 22 Td (${escaparPdf(winAnsi(`Página ${i + 1} de ${total}`))}) Tj ET`
        ];
        const fluxo = [...p, ...rodape].join("\n");
        const conteudo = add(`<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`);
        return add(`<< /Type /Page /Parent ${paginasId} 0 R /MediaBox [0 0 ${L} ${A}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${conteudo} 0 R >>`);
    });
    objetos[catalogo - 1] = `<< /Type /Catalog /Pages ${paginasId} 0 R >>`;
    objetos[paginasId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${total} >>`;
    const info = add(`<< /Title (${escaparPdf(winAnsi(documento.titulo))}) /Producer (Barber Control - demonstrativo) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}) >>`);

    let saida = "%PDF-1.4\n%âãÏÓ\n";
    const posicoes = [];
    objetos.forEach((o, i) => {
        posicoes.push(saida.length);
        saida += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = saida.length;
    saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
    saida += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    // Cada caractere já é um byte (0–255).
    const bytes = new Uint8Array(saida.length);
    for (let i = 0; i < saida.length; i++) bytes[i] = saida.charCodeAt(i) & 0xFF;
    return new Blob([bytes], { type: "application/pdf" });
}
