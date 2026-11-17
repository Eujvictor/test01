// ==========================================
// CONTEÚDO PADRÃO DO SITE
// Usado quando um campo de configuracoes_site
// estiver vazio. Compartilhado entre o site
// público (site-config.js) e o painel admin.
// ==========================================

window.SITE_PADRAO = Object.freeze({
    nome_barbearia: "NAVALHA DE OURO",
    titulo_pagina: "Navalha de Ouro — Barbearia Premium",
    descricao_curta:
        "Barbearia premium para cortes precisos, barba desenhada e atendimento de qualidade.",
    texto_identificacao: "BARBEARIA PREMIUM · SÃO PAULO",

    titulo_principal: "Seu estilo começa aqui.",
    descricao_principal:
        "Barbearia premium para o homem que valoriza detalhe e presença. Cortes precisos, barba desenhada e um ambiente pensado para você sair com a melhor versão de si.",

    texto_botao_principal: "Agendar horário",
    link_botao_principal: "agendar.html",
    texto_botao_secundario: "Ver serviços",
    link_botao_secundario: "#servicos",
    texto_botao_cabecalho: "Agendar",

    estatistica_1_numero: "+8",
    estatistica_1_texto: "anos de estrada",
    estatistica_2_numero: "+12 mil",
    estatistica_2_texto: "cortes feitos",
    estatistica_3_numero: "4,9",
    estatistica_3_texto: "de avaliação",

    mostrar_servicos: true,
    mostrar_portfolio: true,
    mostrar_equipe: true,
    mostrar_avaliacoes: true,
    mostrar_instagram: true,
    mostrar_localizacao: true,
    mostrar_direitos: true,

    servicos_titulo: "O que fazemos",
    servicos_descricao:
        "Preços justos, tempo respeitado e acabamento de barbearia premium.",

    portfolio_titulo: "Nossos trabalhos",
    portfolio_descricao:
        "Um pouco do que sai das nossas cadeiras toda semana.",
    portfolio_itens: [
        {
            url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80",
            legenda: "Fade"
        },
        {
            url: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=900&q=80",
            legenda: "Degradê"
        },
        {
            url: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=80",
            legenda: "Corte social"
        },
        {
            url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=80",
            legenda: "Corte moderno"
        }
    ],

    equipe_titulo: "Nossa equipe",
    equipe_descricao:
        "Barbeiros especializados, cada um com a sua assinatura.",

    avaliacoes_titulo: "O que nossos clientes dizem",
    avaliacoes_descricao: "",
    avaliacoes: [
        {
            estrelas: 5,
            nome: "Rafael M.",
            texto: "Melhor fade que já fiz na vida. Ambiente impecável e atendimento no horário."
        },
        {
            estrelas: 5,
            nome: "Lucas A.",
            texto: "A barba ficou perfeita, com toalha quente e tudo. Virei cliente fixo."
        },
        {
            estrelas: 5,
            nome: "Diego S.",
            texto: "Profissionais que entendem do assunto. Saí com a autoestima em outro nível."
        }
    ],
    texto_botao_avaliacao: "",
    texto_botao_google: "Ver no Google →",
    link_avaliacao_google: "https://www.google.com/",

    instagram: "@navalhadeouro",
    instagram_descricao:
        "Acompanhe os cortes do dia, novidades e promoções exclusivas para quem segue.",
    instagram_link: "https://instagram.com/",
    texto_botao_instagram: "Seguir no Instagram",

    endereco: "Rua Augusta, 1024 — Consolação",
    cidade: "São Paulo",
    estado: "SP",
    cep: "",
    telefone: "(11) 4002-8922",
    google_maps_link: "",

    texto_rodape: "Seu estilo começa aqui.",
    texto_direitos_autorais:
        "© 2026 Navalha de Ouro. Todos os direitos reservados."
});
