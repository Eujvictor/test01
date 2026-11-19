// =====================================================================
// Gráfico de barras de série única (SVG puro).
// Regras: barras finas com topo arredondado e base reta na linha zero,
// grade discreta, sem legenda (o título do card nomeia a série),
// tooltip por barra com área de toque maior que a barra.
// =====================================================================
import { html, bruto, escapar } from "../utilities/dom.js";

function escalaBonita(maximo) {
    if (maximo <= 0) return 1;
    const potencia = 10 ** Math.floor(Math.log10(maximo));
    const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => maximo / p <= 4) ?? potencia * 10;
    return Math.ceil(maximo / passo) * passo;
}

// Linha de série única (disponibilidade, latência). O eixo pode não partir
// do zero ("dominio"), o que é adequado a linhas (não a barras).
export function graficoLinha({ dados, formatar, formatarEixo = formatar, titulo, dominio = null, tom = "ouro", largo = false }) {
    const largura = largo ? 1120 : 560;
    const altura = 220;
    const margem = { topo: 14, direita: 12, base: 30, esquerda: 64 };
    const areaL = largura - margem.esquerda - margem.direita;
    const areaA = altura - margem.topo - margem.base;
    const valores = dados.map((d) => d.valor);
    let [min, max] = dominio ?? [Math.min(0, ...valores), Math.max(...valores)];
    if (!dominio) max = escalaBonita(max);
    if (max === min) max = min + 1;
    const x = (i) => margem.esquerda + (dados.length <= 1 ? areaL / 2 : (i / (dados.length - 1)) * areaL);
    const y = (v) => margem.topo + areaA - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * areaA;
    const passoRotulo = Math.ceil(dados.length / (largo ? 12 : 6));
    const grade = [0, 0.5, 1].map((f) => {
        const v = min + (max - min) * f;
        return `<line class="grafico__grade" x1="${margem.esquerda}" x2="${largura - margem.direita}" y1="${y(v)}" y2="${y(v)}"/>
                <text class="grafico__eixo" x="${margem.esquerda - 8}" y="${y(v) + 4}" text-anchor="end">${escapar(formatarEixo(v))}</text>`;
    }).join("");
    const caminho = dados.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.valor).toFixed(1)}`).join(" ");
    const fatia = areaL / Math.max(1, dados.length - 1);
    const pontos = dados.map((d, i) => {
        const dica = `${d.rotuloLongo ?? d.rotulo}: ${formatar(d.valor)}`;
        return `<g class="grafico__ponto" tabindex="0" role="img" aria-label="${escapar(dica)}">
                    <title>${escapar(dica)}</title>
                    <rect class="grafico__alvo" x="${x(i) - fatia / 2}" y="${margem.topo}" width="${fatia}" height="${areaA}"/>
                    <circle class="grafico__marcador grafico__marcador--${tom}" cx="${x(i)}" cy="${y(d.valor)}" r="4"/>
                    ${i % passoRotulo === 0 ? `<text class="grafico__eixo" x="${x(i)}" y="${altura - 8}" text-anchor="middle">${escapar(d.rotulo)}</text>` : ""}
                </g>`;
    }).join("");
    return html`
        <figure class="grafico">
            <svg viewBox="0 0 ${largura} ${altura}" role="group" aria-label="${titulo}" preserveAspectRatio="xMidYMid meet">
                ${bruto(grade)}
                <path class="grafico__linha grafico__linha--${tom}" d="${caminho}"/>
                ${bruto(pontos)}
            </svg>
        </figure>`;
}

// Ranking em barras horizontais (HTML): itens [{ rotulo, valor, link? }]
export function barrasHorizontais({ itens, formatar, titulo }) {
    const maximo = Math.max(1, ...itens.map((i) => i.valor));
    return html`
        <ol class="ranking" aria-label="${titulo}">
            ${itens.map((i) => html`
                <li class="ranking__item" title="${i.rotulo}: ${formatar(i.valor)}">
                    <div class="ranking__topo">
                        ${i.link ? html`<a class="ranking__rotulo link-forte" href="${i.link}">${i.rotulo}</a>` : html`<span class="ranking__rotulo">${i.rotulo}</span>`}
                        <span class="ranking__valor num">${formatar(i.valor)}</span>
                    </div>
                    <div class="ranking__trilha"><span class="ranking__barra" data-largura="${Math.round((i.valor / maximo) * 1000) / 10}"></span></div>
                </li>`)}
        </ol>`;
}

// As larguras são aplicadas via CSSOM (compatível com a CSP sem estilos inline).
export function aplicarLarguras(raiz) {
    raiz.querySelectorAll(".ranking__barra[data-largura]").forEach((el) => { el.style.width = `${el.dataset.largura}%`; });
}

// dados: [{ rotulo, rotuloLongo, valor }]
// largo: para cartões de largura total (mantém texto e altura na mesma escala dos demais).
export function graficoBarras({ dados, formatar, formatarEixo = formatar, tom = "ouro", titulo, largo = false }) {
    const largura = largo ? 1120 : 560;
    const altura = largo ? 260 : 240;
    const margem = { topo: 12, direita: 8, base: 30, esquerda: 64 };
    const areaL = largura - margem.esquerda - margem.direita;
    const areaA = altura - margem.topo - margem.base;
    const maximo = escalaBonita(Math.max(0, ...dados.map((d) => d.valor)));
    const fatia = areaL / Math.max(1, dados.length);
    const larguraBarra = Math.max(4, Math.min(28, fatia * 0.55));
    // Até 6 rótulos no eixo X; todos os meses continuam no tooltip de cada barra.
    const passoRotulo = Math.ceil(dados.length / (largo ? 12 : 6));
    const y = (v) => margem.topo + areaA - (v / maximo) * areaA;
    const raio = Math.min(4, larguraBarra / 2);

    const grade = [0, 0.5, 1].map((f) => {
        const v = maximo * f;
        return `<line class="grafico__grade" x1="${margem.esquerda}" x2="${largura - margem.direita}" y1="${y(v)}" y2="${y(v)}"/>
                <text class="grafico__eixo" x="${margem.esquerda - 8}" y="${y(v) + 4}" text-anchor="end">${escapar(formatarEixo(v))}</text>`;
    }).join("");

    const barras = dados.map((d, i) => {
        const cx = margem.esquerda + fatia * i + fatia / 2;
        const x = cx - larguraBarra / 2;
        const h = Math.max(0, margem.topo + areaA - y(d.valor));
        const topo = margem.topo + areaA - h;
        const r = Math.min(raio, h);
        // Caminho: topo arredondado, base reta apoiada na linha zero.
        const caminho = h > 0
            ? `M${x},${topo + h} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + larguraBarra - r} Q${x + larguraBarra},${topo} ${x + larguraBarra},${topo + r} V${topo + h} Z`
            : "";
        const dica = `${d.rotuloLongo ?? d.rotulo}: ${formatar(d.valor)}${d.nota ? ` (${d.nota})` : ""}`;
        return `<g class="grafico__ponto" tabindex="0" role="img" aria-label="${escapar(dica)}">
                    <title>${escapar(dica)}</title>
                    <rect class="grafico__alvo" x="${margem.esquerda + fatia * i}" y="${margem.topo}" width="${fatia}" height="${areaA}"/>
                    ${caminho ? `<path class="grafico__barra grafico__barra--${d.tom ?? tom}" d="${caminho}"/>` : ""}
                    ${i % passoRotulo === 0 ? `<text class="grafico__eixo" x="${cx}" y="${altura - 8}" text-anchor="middle">${escapar(d.rotulo)}</text>` : ""}
                </g>`;
    }).join("");

    return html`
        <figure class="grafico">
            <svg viewBox="0 0 ${largura} ${altura}" role="group" aria-label="${titulo}" preserveAspectRatio="xMidYMid meet">
                ${bruto(grade)}
                <line class="grafico__base" x1="${margem.esquerda}" x2="${largura - margem.direita}" y1="${y(0)}" y2="${y(0)}"/>
                ${bruto(barras)}
            </svg>
        </figure>`;
}

// Comparação de dois períodos (atual × anterior), mês a mês por posição.
// dados: [{ rotulo, rotuloLongo, atual, anterior, rotuloAnterior }]
// Legenda sempre visível (duas séries). Barras lado a lado com 2px de folga.
export function graficoComparativo({ dados, formatar, formatarEixo = formatar, titulo, legendas = ["Período atual", "Período anterior"] }) {
    const largura = 560;
    const altura = 240;
    const margem = { topo: 12, direita: 8, base: 30, esquerda: 64 };
    const areaL = largura - margem.esquerda - margem.direita;
    const areaA = altura - margem.topo - margem.base;
    const valores = dados.flatMap((d) => [d.atual ?? 0, d.anterior ?? 0]);
    const maximo = escalaBonita(Math.max(0, ...valores));
    const fatia = areaL / Math.max(1, dados.length);
    const larguraBarra = Math.max(3, Math.min(16, fatia * 0.3));
    const y = (v) => margem.topo + areaA - (v / maximo) * areaA;
    const passoRotulo = Math.ceil(dados.length / 6);
    const barra = (x, v, classe) => {
        if (v === null || v === undefined || v <= 0) return "";
        const topo = y(v);
        const h = margem.topo + areaA - topo;
        const r = Math.min(3, larguraBarra / 2, h);
        return `<path class="grafico__barra ${classe}" d="M${x},${topo + h} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + larguraBarra - r} Q${x + larguraBarra},${topo} ${x + larguraBarra},${topo + r} V${topo + h} Z"/>`;
    };
    const grade = [0, 0.5, 1].map((f) => {
        const v = maximo * f;
        return `<line class="grafico__grade" x1="${margem.esquerda}" x2="${largura - margem.direita}" y1="${y(v)}" y2="${y(v)}"/>
                <text class="grafico__eixo" x="${margem.esquerda - 8}" y="${y(v) + 4}" text-anchor="end">${escapar(formatarEixo(v))}</text>`;
    }).join("");
    const barras = dados.map((d, i) => {
        const cx = margem.esquerda + fatia * i + fatia / 2;
        const dica = `${d.rotuloLongo ?? d.rotulo}: ${d.atual === null ? "sem dados" : formatar(d.atual)} · ${d.rotuloAnterior ?? legendas[1]}: ${d.anterior === null ? "sem dados" : formatar(d.anterior)}`;
        return `<g class="grafico__ponto" tabindex="0" role="img" aria-label="${escapar(dica)}">
                    <title>${escapar(dica)}</title>
                    <rect class="grafico__alvo" x="${margem.esquerda + fatia * i}" y="${margem.topo}" width="${fatia}" height="${areaA}"/>
                    ${barra(cx - larguraBarra - 1, d.atual, "grafico__barra--ouro")}
                    ${barra(cx + 1, d.anterior, "grafico__barra--neutro")}
                    ${i % passoRotulo === 0 ? `<text class="grafico__eixo" x="${cx}" y="${altura - 8}" text-anchor="middle">${escapar(d.rotulo)}</text>` : ""}
                </g>`;
    }).join("");
    return html`
        <figure class="grafico">
            <div class="grafico__legenda">
                <span><i class="grafico__chave grafico__chave--ouro" aria-hidden="true"></i>${legendas[0]}</span>
                <span><i class="grafico__chave grafico__chave--neutro" aria-hidden="true"></i>${legendas[1]}</span>
            </div>
            <svg viewBox="0 0 ${largura} ${altura}" role="group" aria-label="${titulo}" preserveAspectRatio="xMidYMid meet">
                ${bruto(grade)}
                <line class="grafico__base" x1="${margem.esquerda}" x2="${largura - margem.direita}" y1="${y(0)}" y2="${y(0)}"/>
                ${bruto(barras)}
            </svg>
        </figure>`;
}
