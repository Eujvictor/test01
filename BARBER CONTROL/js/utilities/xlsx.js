// =====================================================================
// Geração de planilhas Excel (.xlsx) sem bibliotecas externas.
// Um .xlsx é um ZIP com arquivos XML (Office Open XML). Aqui o ZIP é
// montado sem compressão ("store"), o que todo leitor aceita.
// planilhas: [{ nome, linhas: [[valor, ...], ...], cabecalho?: número de linhas em negrito, larguras?: [n] }]
// Valores numéricos viram células numéricas; o resto, texto.
// =====================================================================

const codificador = new TextEncoder();

// ---------- CRC-32 (exigido pelo formato ZIP) ----------
const TABELA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---------- ZIP (método 0 = armazenado) ----------
export function montarZip(arquivos) {
    const partes = [];
    const central = [];
    let deslocamento = 0;
    const agora = new Date();
    const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2);
    const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();

    arquivos.forEach(({ nome, conteudo }) => {
        const nomeBytes = codificador.encode(nome);
        const dados = typeof conteudo === "string" ? codificador.encode(conteudo) : conteudo;
        const crc = crc32(dados);

        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034B50, true);
        local.setUint16(4, 20, true);          // versão necessária
        local.setUint16(6, 0x0800, true);      // nomes em UTF-8
        local.setUint16(8, 0, true);           // sem compressão
        local.setUint16(10, hora, true);
        local.setUint16(12, data, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, dados.length, true);
        local.setUint32(22, dados.length, true);
        local.setUint16(26, nomeBytes.length, true);
        local.setUint16(28, 0, true);
        partes.push(new Uint8Array(local.buffer), nomeBytes, dados);

        const cd = new DataView(new ArrayBuffer(46));
        cd.setUint32(0, 0x02014B50, true);
        cd.setUint16(4, 20, true);
        cd.setUint16(6, 20, true);
        cd.setUint16(8, 0x0800, true);
        cd.setUint16(10, 0, true);
        cd.setUint16(12, hora, true);
        cd.setUint16(14, data, true);
        cd.setUint32(16, crc, true);
        cd.setUint32(20, dados.length, true);
        cd.setUint32(24, dados.length, true);
        cd.setUint16(28, nomeBytes.length, true);
        cd.setUint32(42, deslocamento, true);
        central.push(new Uint8Array(cd.buffer), nomeBytes);

        deslocamento += 30 + nomeBytes.length + dados.length;
    });

    const tamanhoCentral = central.reduce((s, p) => s + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054B50, true);
    fim.setUint16(8, arquivos.length, true);
    fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamanhoCentral, true);
    fim.setUint32(16, deslocamento, true);

    return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: "application/zip" });
}

// ---------- Planilha ----------
const xml = (texto) => String(texto)
    // Remove caracteres de controle inválidos em XML.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function colunaLetra(indice) {
    let s = "";
    let n = indice + 1;
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

function folha({ linhas, cabecalho = 1, larguras = [] }) {
    const colunas = Math.max(1, ...linhas.map((l) => l.length));
    const cols = Array.from({ length: colunas }, (_, i) => {
        const auto = Math.min(60, Math.max(10, ...linhas.map((l) => String(l[i] ?? "").length + 2)));
        return `<col min="${i + 1}" max="${i + 1}" width="${larguras[i] ?? auto}" customWidth="1"/>`;
    }).join("");
    const corpo = linhas.map((linha, r) => {
        const celulas = linha.map((v, c) => {
            const ref = `${colunaLetra(c)}${r + 1}`;
            const estilo = r < cabecalho ? ' s="1"' : "";
            if (v === null || v === undefined || v === "") return `<c r="${ref}"${estilo}/>`;
            if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${estilo}><v>${v}</v></c>`;
            return `<c r="${ref}" t="inlineStr"${estilo}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
        }).join("");
        return `<row r="${r + 1}">${celulas}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${corpo}</sheetData></worksheet>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`;

// Nome de aba: até 31 caracteres, sem : \ / ? * [ ]
const nomeAba = (n, i) => (String(n || `Planilha ${i + 1}`).replace(/[:\\/?*[\]]/g, " ").slice(0, 31).trim() || `Planilha ${i + 1}`);

export function gerarXlsx(planilhas) {
    const abas = planilhas.map((p, i) => ({ ...p, nome: nomeAba(p.nome, i) }));
    const arquivos = [
        {
            nome: "[Content_Types].xml",
            conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`
        },
        {
            nome: "_rels/.rels",
            conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
        },
        {
            nome: "xl/workbook.xml",
            conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${xml(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`
        },
        {
            nome: "xl/_rels/workbook.xml.rels",
            conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
        },
        { nome: "xl/styles.xml", conteudo: ESTILOS },
        ...abas.map((a, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo: folha(a) }))
    ];
    const zip = montarZip(arquivos);
    return new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
