// =====================================================================
// CONVERSÃO DE IMAGENS PARA WEBP (no navegador, antes do envio)
// Redimensiona para o tamanho máximo do uso (logo, banner, portfólio) e
// converte para WebP. O arquivo resultante é o MESMO usado na
// pré-visualização e no envio: nenhum arquivo extra é criado.
// Se o navegador não gerar WebP, mantém JPEG/PNG (também aceitos).
// =====================================================================

(function () {
    "use strict";

    const ACEITOS = ["image/jpeg", "image/png", "image/webp"];

    function carregar(arquivo) {
        return new Promise((resolver, rejeitar) => {
            const url = URL.createObjectURL(arquivo);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolver(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                rejeitar(new Error("Não foi possível ler a imagem."));
            };
            img.src = url;
        });
    }

    function gerar(canvas, tipo, qualidade) {
        return new Promise((resolver) => canvas.toBlob(resolver, tipo, qualidade));
    }

    // opcoes: { maxLado, qualidade, nome }
    async function converter(arquivo, { maxLado = 1600, qualidade = 0.85, nome = "imagem" } = {}) {
        if (!arquivo || !ACEITOS.includes(arquivo.type)) {
            throw new Error("Formato inválido. Use JPG, PNG ou WebP.");
        }
        const img = await carregar(arquivo);
        const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
        const largura = Math.max(1, Math.round(img.naturalWidth * escala));
        const altura = Math.max(1, Math.round(img.naturalHeight * escala));

        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, largura, altura);

        let blob = await gerar(canvas, "image/webp", qualidade);
        let tipo = "image/webp";
        if (!blob || blob.type !== "image/webp") {
            // Navegador sem codificador WebP: mantém o formato original.
            tipo = arquivo.type === "image/png" ? "image/png" : "image/jpeg";
            blob = await gerar(canvas, tipo, qualidade);
        }
        if (!blob) throw new Error("Não foi possível processar a imagem.");

        const extensao = tipo === "image/webp" ? "webp" : tipo === "image/png" ? "png" : "jpg";
        return new File([blob], `${nome}.${extensao}`, { type: tipo, lastModified: Date.now() });
    }

    window.ImagemWebp = { converter, ACEITOS };
})();
