// =====================================================================
// DASHBOARD — VISÃO GERAL DA BARBEARIA
// ---------------------------------------------------------------------
// Lê as mesmas tabelas da versão anterior (agendamentos, clientes,
// BARBEIROS, SERVIÇOS), já filtradas pela barbearia de quem está logado
// (tenant-cliente.js + RLS do banco). Nada é gravado aqui.
//
// Regras (iguais às da versão anterior):
//   • Período: agendamentos com data a partir do início do período
//     (Hoje, 7 dias, 30 dias ou Tudo).
//   • Faturamento: soma do preço do serviço dos atendimentos com status
//     "finalizado". O sistema não guarda o valor cobrado em cada
//     atendimento, então vale o preço atual do serviço.
//   • Comparação: o mesmo número de dias imediatamente antes do período.
// Visual: painel-dashboard.css (temas claro/escuro de painel-tema.js).
// =====================================================================

(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const PERIODO_PADRAO = "30";
    let periodo = PERIODO_PADRAO;
    let carregando = null;

    // ------------------------------------------
    // Utilitários
    // ------------------------------------------
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hoje = () => isoLocal(new Date());
    const somarDias = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return isoLocal(new Date(y, m - 1, d + n)); };
    const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const moedaCurta = (v) => {
        const n = Number(v || 0);
        if (n >= 1000) return "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
        return "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    };
    const inteiro = (v) => Number(v || 0).toLocaleString("pt-BR");
    const plural = (n, um, varios) => `${inteiro(n)} ${n === 1 ? um : varios}`;
    const ddmm = (iso) => { const p = String(iso).split("-"); return `${p[2]}/${p[1]}`; };
    const iniciais = (nome) => String(nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
    const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

    function normalizarStatus(valor) {
        return String(valor || "agendado").toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
    }

    // Grupo de status usado no card e nas etiquetas.
    function grupoStatus(status) {
        if (status === "finalizado") return "finalizado";
        if (status === "confirmado") return "confirmado";
        if (status === "cancelado" || status === "nao_compareceu") return "cancelado";
        return "pendente"; // agendado, pendente e qualquer outro valor em aberto
    }
    const ROTULO_STATUS = {
        agendado: "Pendente", pendente: "Pendente", confirmado: "Confirmado",
        finalizado: "Finalizado", cancelado: "Cancelado", nao_compareceu: "Faltou"
    };
    const rotuloStatus = (s) => ROTULO_STATUS[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "Pendente");

    // Início do período (igual à versão anterior); null = todo o período.
    function inicioPeriodo(p) {
        if (p === "all") return null;
        if (p === "today") return hoje();
        return somarDias(hoje(), -((Number(p) || 30) - 1));
    }
    const diasDoPeriodo = (p) => (p === "today" ? 1 : p === "all" ? null : Number(p) || 30);

    // ------------------------------------------
    // Carregamento
    // ------------------------------------------
    async function carregar() {
        const sb = window.supabaseClient;
        if (!sb || !$("dshHoje")) return;
        const minha = (carregando = Symbol("carga"));
        document.querySelector(".dsh")?.classList.add("dsh--atualizando");
        try {
            const [ag, cl, ba, se] = await Promise.all([
                sb.from("agendamentos").select("*").order("data", { ascending: true }).order("horario", { ascending: true }),
                sb.from("clientes").select("*"),
                sb.from("BARBEIROS").select("*").order("nome", { ascending: true }),
                sb.from("SERVIÇOS").select("*")
            ]);
            if (minha !== carregando) return; // outro período foi escolhido no meio
            if (ag.error) throw ag.error;
            [cl, ba, se].forEach((r) => r.error && console.error("Dashboard:", r.error));
            desenhar(montarDados(ag.data || [], cl.data || [], ba.data || [], se.data || []));
        } catch (erro) {
            console.error("Dashboard:", erro);
            mostrarErro();
        } finally {
            if (minha === carregando) document.querySelector(".dsh")?.classList.remove("dsh--atualizando");
        }
    }

    function montarDados(brutos, clientes, barbeiros, servicos) {
        const mapaCliente = new Map(clientes.map((c) => [String(c.id), c]));
        const mapaBarbeiro = new Map(barbeiros.map((b) => [String(b.id), b]));
        const mapaServico = new Map(servicos.map((s) => [String(s.id), s]));

        const agendamentos = brutos.map((a) => {
            const cliente = mapaCliente.get(String(a.cliente_id));
            const barbeiro = mapaBarbeiro.get(String(a.barbeiro_id));
            const servico = mapaServico.get(String(a.servico_id));
            const status = normalizarStatus(a.status);
            return {
                id: a.id,
                data: String(a.data || "").slice(0, 10),
                hora: String(a.horario || "").slice(0, 5),
                status,
                grupo: grupoStatus(status),
                cliente: cliente?.nome ?? cliente?.name ?? "Cliente",
                barbeiro: barbeiro?.nome ?? barbeiro?.name ?? "Barbeiro",
                servico: servico?.nome ?? servico?.name ?? "Serviço",
                barbeiroId: String(a.barbeiro_id),
                servicoId: String(a.servico_id),
                preco: Number(a.valor ?? a.preco ?? servico?.["preço"] ?? servico?.preco ?? 0) || 0
            };
        }).sort((x, y) => `${x.data}T${x.hora}`.localeCompare(`${y.data}T${y.hora}`));

        return { agendamentos, clientes, barbeiros, servicos };
    }

    // ------------------------------------------
    // Desenho
    // ------------------------------------------
    function desenhar({ agendamentos, clientes, barbeiros, servicos }) {
        const dia = hoje();
        const inicio = inicioPeriodo(periodo);
        const noPeriodo = agendamentos.filter((a) => !inicio || a.data >= inicio);
        const finalizados = noPeriodo.filter((a) => a.status === "finalizado");
        const faturamento = finalizados.reduce((t, a) => t + a.preco, 0);
        const textoPeriodo = { today: "Hoje", 7: "Últimos 7 dias", 30: "Últimos 30 dias", all: "Todo o período" }[periodo];

        // Período anterior (mesmo tamanho), só quando o período tem tamanho.
        const dias = diasDoPeriodo(periodo);
        let anterior = null;
        if (dias) {
            const ini = somarDias(inicio, -dias);
            const fim = somarDias(inicio, -1);
            const fins = agendamentos.filter((a) => a.status === "finalizado" && a.data >= ini && a.data <= fim);
            anterior = { faturamento: fins.reduce((t, a) => t + a.preco, 0), atendimentos: fins.length };
        }

        desenharKpis({ agendamentos, noPeriodo, finalizados, faturamento, clientes, inicio, dia, anterior });
        desenharProximos(agendamentos, dia);
        desenharStatus(noPeriodo, textoPeriodo);
        desenharBarbeiros(barbeiros, finalizados);
        desenharServicos(servicos, noPeriodo);
        desenharFinanceiro({ agendamentos, finalizados, faturamento, inicio, dia, anterior, textoPeriodo });
    }

    function variacao(atual, antes) {
        if (!antes) return null; // sem base para comparar
        return ((atual - antes) / antes) * 100;
    }
    function htmlVariacao(pct, sufixo) {
        if (pct === null) return "";
        const arred = Math.round(pct);
        const classe = arred > 0 ? "sobe" : arred < 0 ? "desce" : "igual";
        const seta = arred > 0 ? "↑" : arred < 0 ? "↓" : "→";
        return `<span class="dsh-variacao dsh-variacao--${classe}">${seta} ${Math.abs(arred)}%</span> ${esc(sufixo)}`;
    }
    const sufixoComparacao = () => (periodo === "today" ? "vs. ontem" : `vs. ${periodo} dias anteriores`);

    function desenharKpis({ agendamentos, noPeriodo, finalizados, faturamento, clientes, inicio, dia, anterior }) {
        const deHoje = agendamentos.filter((a) => a.data === dia);
        const ativosHoje = deHoje.filter((a) => a.grupo !== "cancelado");
        const confirmadosHoje = deHoje.filter((a) => a.grupo === "confirmado").length;
        const finalizadosHoje = deHoje.filter((a) => a.grupo === "finalizado").length;
        $("dshHoje").textContent = inteiro(deHoje.length);
        $("dshHojeMeta").textContent = deHoje.length
            ? [`${inteiro(confirmadosHoje)} confirmados`, `${inteiro(finalizadosHoje)} finalizados`, `${inteiro(ativosHoje.length - confirmadosHoje - finalizadosHoje)} pendentes`].join(" · ")
            : "Nenhum horário marcado para hoje";

        const validos = noPeriodo.filter((a) => a.grupo !== "cancelado").length;
        $("dshFinalizados").textContent = inteiro(finalizados.length);
        $("dshFinalizadosBarra").style.width = validos ? `${Math.min(100, Math.round((finalizados.length / validos) * 100))}%` : "0%";
        $("dshFinalizadosMeta").textContent = validos
            ? `${Math.round((finalizados.length / validos) * 100)}% dos ${plural(validos, "agendamento", "agendamentos")} do período`
            : "Nenhum agendamento no período";

        $("dshClientes").textContent = inteiro(clientes.length);
        const temData = clientes.some((c) => c.created_at || c.created_em);
        if (temData && inicio) {
            const novos = clientes.filter((c) => String(c.created_at || c.created_em || "").slice(0, 10) >= inicio).length;
            $("dshClientesMeta").textContent = novos ? `${plural(novos, "novo", "novos")} no período` : "Nenhum cliente novo no período";
        } else {
            $("dshClientesMeta").textContent = "Clientes cadastrados";
        }

        $("dshFaturamento").textContent = moeda(faturamento);
        const pct = anterior ? variacao(faturamento, anterior.faturamento) : null;
        $("dshFaturamentoMeta").innerHTML = pct !== null
            ? htmlVariacao(pct, sufixoComparacao())
            : esc(plural(finalizados.length, "atendimento finalizado", "atendimentos finalizados"));
    }

    function rotuloDia(iso, dia) {
        if (iso === dia) return "Hoje";
        if (iso === somarDias(dia, 1)) return "Amanhã";
        const [y, m, d] = iso.split("-").map(Number);
        return `${DIAS_SEMANA[new Date(y, m - 1, d).getDay()]}, ${ddmm(iso)}`;
    }

    function desenharProximos(agendamentos, dia) {
        const caixa = $("dshProximos");
        const agora = new Date().toTimeString().slice(0, 5);
        const abertos = (a) => a.grupo !== "cancelado" && a.grupo !== "finalizado";
        const lista = agendamentos.filter((a) => abertos(a) && (a.data > dia || (a.data === dia && a.hora >= agora))).slice(0, 6);
        $("dshProximosSub").textContent = lista.length ? "Os próximos horários marcados" : "Nada marcado daqui para frente";
        if (!lista.length) {
            caixa.innerHTML = vazio("calendar", "Nenhum próximo agendamento", "Quando um cliente marcar horário, ele aparece aqui.");
            return;
        }
        caixa.innerHTML = lista.map((a) => `
            <div class="dsh-agenda__linha">
                <div class="dsh-agenda__hora"><strong>${esc(a.hora || "--:--")}</strong><span>${esc(rotuloDia(a.data, dia))}</span></div>
                <div class="dsh-agenda__info">
                    <strong>${esc(a.cliente)}</strong>
                    <span>${esc(a.servico)} · ${esc(a.barbeiro)}</span>
                </div>
                <span class="dsh-pilula dsh-pilula--${a.grupo}">${esc(rotuloStatus(a.status))}</span>
            </div>`).join("");
    }

    // Ordem escolhida para que cores vizinhas se distingam também para
    // quem tem daltonismo (validado): finalizado, confirmado, pendente, cancelado.
    const GRUPOS = [
        ["finalizado", "Finalizados"],
        ["confirmado", "Confirmados"],
        ["pendente", "Pendentes"],
        ["cancelado", "Cancelados / faltas"]
    ];

    function desenharStatus(noPeriodo, textoPeriodo) {
        const total = noPeriodo.length;
        const conta = Object.fromEntries(GRUPOS.map(([g]) => [g, noPeriodo.filter((a) => a.grupo === g).length]));
        $("dshStatusTotal").textContent = inteiro(total);
        $("dshStatusSub").textContent = `${textoPeriodo} · ${plural(total, "agendamento", "agendamentos")}`;
        const barra = $("dshStatusBarra");
        barra.innerHTML = total
            ? GRUPOS.filter(([g]) => conta[g]).map(([g, rotulo]) =>
                `<i class="dsh-cor--${g}" style="flex-grow:${conta[g]}" title="${esc(rotulo)}: ${inteiro(conta[g])}"></i>`).join("")
            : '<i class="dsh-status-barra__vazia"></i>';
        barra.setAttribute("aria-label", total
            ? GRUPOS.map(([g, r]) => `${r}: ${conta[g]}`).join(", ")
            : "Nenhum atendimento no período");
        $("dshStatusLista").innerHTML = GRUPOS.map(([g, rotulo]) => {
            const pct = total ? Math.round((conta[g] / total) * 100) : 0;
            return `<li>
                <span class="dsh-status__nome"><i class="dsh-ponto dsh-cor--${g}" aria-hidden="true"></i>${esc(rotulo)}</span>
                <strong>${inteiro(conta[g])}</strong>
                <span class="dsh-status__pct">${pct}%</span>
            </li>`;
        }).join("");
    }

    function desenharBarbeiros(barbeiros, finalizados) {
        const ativos = barbeiros.filter((b) => b.ativo !== false);
        $("dshBarbeirosAtivos").textContent = plural(ativos.length, "ativo", "ativos");
        const caixa = $("dshBarbeiros");
        if (!ativos.length) {
            caixa.innerHTML = vazio("users", "Nenhum barbeiro ativo", "Cadastre a equipe no menu Barbeiros.");
            return;
        }
        const totalFat = finalizados.reduce((t, a) => t + a.preco, 0);
        const linhas = ativos.map((b) => {
            const deles = finalizados.filter((a) => a.barbeiroId === String(b.id));
            return { nome: b.nome ?? b.name ?? "Barbeiro", atendimentos: deles.length, faturamento: deles.reduce((t, a) => t + a.preco, 0) };
        }).sort((x, y) => y.atendimentos - x.atendimentos || y.faturamento - x.faturamento || x.nome.localeCompare(y.nome));
        const maximo = Math.max(1, ...linhas.map((l) => l.atendimentos));
        const algumAtendimento = linhas.some((l) => l.atendimentos > 0);
        caixa.innerHTML = linhas.map((l, i) => {
            const posicao = algumAtendimento && l.atendimentos > 0 ? i + 1 : null;
            const parte = totalFat ? Math.round((l.faturamento / totalFat) * 100) : 0;
            return `<div class="dsh-ranking__linha">
                <span class="dsh-ranking__pos${posicao === 1 ? " dsh-ranking__pos--primeiro" : ""}" ${posicao ? `aria-label="${posicao}º lugar"` : 'aria-hidden="true"'}>${posicao ? `${posicao}º` : "–"}</span>
                <span class="dsh-avatar" aria-hidden="true">${esc(iniciais(l.nome))}</span>
                <div class="dsh-ranking__info">
                    <div class="dsh-ranking__titulo"><strong>${esc(l.nome)}</strong><span>${esc(moeda(l.faturamento))}</span></div>
                    <div class="dsh-trilho" aria-hidden="true"><i style="width:${Math.round((l.atendimentos / maximo) * 100)}%"></i></div>
                    <span class="dsh-ranking__meta">${esc(plural(l.atendimentos, "atendimento", "atendimentos"))}${totalFat ? ` · ${parte}% do faturamento` : ""}</span>
                </div>
            </div>`;
        }).join("");
    }

    function desenharServicos(servicos, noPeriodo) {
        const ativos = servicos.filter((s) => s.ativo !== false);
        $("dshServicosAtivos").textContent = plural(ativos.length, "ativo", "ativos");
        const caixa = $("dshServicos");
        const total = noPeriodo.length;
        const linhas = servicos.map((s) => ({
            nome: s.nome ?? s.name ?? "Serviço",
            qtd: noPeriodo.filter((a) => a.servicoId === String(s.id)).length
        })).filter((l) => l.qtd > 0).sort((x, y) => y.qtd - x.qtd || x.nome.localeCompare(y.nome)).slice(0, 6);
        if (!linhas.length) {
            caixa.innerHTML = vazio("scissors", "Nenhum agendamento no período", "Os serviços mais pedidos aparecem aqui.");
            return;
        }
        const maximo = Math.max(1, ...linhas.map((l) => l.qtd));
        caixa.innerHTML = linhas.map((l) => {
            const pct = total ? Math.round((l.qtd / total) * 100) : 0;
            return `<div class="dsh-ranking__linha dsh-ranking__linha--servico">
                <div class="dsh-ranking__info">
                    <div class="dsh-ranking__titulo"><strong>${esc(l.nome)}</strong><span>${pct}%</span></div>
                    <div class="dsh-trilho" aria-hidden="true"><i style="width:${Math.round((l.qtd / maximo) * 100)}%"></i></div>
                    <span class="dsh-ranking__meta">${esc(plural(l.qtd, "agendamento", "agendamentos"))}</span>
                </div>
            </div>`;
        }).join("");
    }

    // ------------------------------------------
    // Visão financeira (gráfico de colunas, uma série)
    // ------------------------------------------
    function faixasDoGrafico(finalizados, inicio, dia) {
        if (periodo === "today") {
            const horas = finalizados.filter((a) => a.data === dia).map((a) => Number(a.hora.slice(0, 2))).filter((h) => !Number.isNaN(h));
            const de = Math.min(8, ...horas), ate = Math.max(20, ...horas);
            return Array.from({ length: ate - de + 1 }, (_, i) => {
                const h = de + i;
                return { chave: String(h), rotulo: `${String(h).padStart(2, "0")}h`, dica: `Hoje, ${String(h).padStart(2, "0")}h`,
                    teste: (a) => a.data === dia && Number(a.hora.slice(0, 2)) === h };
            });
        }
        if (periodo === "all") {
            const meses = finalizados.map((a) => a.data.slice(0, 7)).filter(Boolean).sort();
            const atual = dia.slice(0, 7);
            let [y, m] = (meses[0] || atual).split("-").map(Number);
            const lista = [];
            while (`${y}-${String(m).padStart(2, "0")}` <= atual) {
                const chave = `${y}-${String(m).padStart(2, "0")}`;
                lista.push({ chave, rotulo: `${MESES[m - 1]}/${String(y).slice(2)}`, dica: `${MESES[m - 1]} de ${y}`, teste: (a) => a.data.startsWith(chave) });
                m += 1; if (m > 12) { m = 1; y += 1; }
            }
            return lista.slice(-24);
        }
        const n = diasDoPeriodo(periodo);
        return Array.from({ length: n }, (_, i) => {
            const iso = somarDias(inicio, i);
            const [y, m, d] = iso.split("-").map(Number);
            return { chave: iso, rotulo: ddmm(iso), dica: `${DIAS_SEMANA[new Date(y, m - 1, d).getDay()]}, ${ddmm(iso)}`, teste: (a) => a.data === iso };
        });
    }

    function escalaBonita(maximo) {
        if (maximo <= 0) return 100;
        const pot = Math.pow(10, Math.floor(Math.log10(maximo)));
        for (const f of [1, 2, 2.5, 5, 10]) if (f * pot >= maximo) return f * pot;
        return 10 * pot;
    }

    let ultimoFinanceiro = null;
    let esperaRedimensionar = null;
    window.addEventListener("resize", () => {
        clearTimeout(esperaRedimensionar);
        esperaRedimensionar = setTimeout(() => ultimoFinanceiro && desenharFinanceiro(ultimoFinanceiro), 150);
    });

    function desenharFinanceiro(dados) {
        ultimoFinanceiro = dados;
        const { finalizados, faturamento, inicio, dia, anterior, textoPeriodo } = dados;
        const comReceita = finalizados.filter((a) => a.preco > 0);
        $("dshFinSub").textContent = `${textoPeriodo} · atendimentos finalizados`;
        $("dshFinTotal").textContent = moeda(faturamento);
        const pct = anterior ? variacao(faturamento, anterior.faturamento) : null;
        $("dshFinComparacao").innerHTML = pct !== null
            ? htmlVariacao(pct, sufixoComparacao())
            : anterior ? "Sem faturamento no período anterior para comparar" : "Escolha um período para comparar";
        $("dshFinTicket").textContent = comReceita.length ? moeda(faturamento / comReceita.length) : "–";
        $("dshFinAtendimentos").textContent = inteiro(comReceita.length);
        $("dshFinAtendimentosMeta").textContent = anterior
            ? `${plural(anterior.atendimentos, "atendimento", "atendimentos")} no período anterior`
            : "No período";

        const area = $("dshGrafico");
        const faixas = faixasDoGrafico(finalizados, inicio, dia).map((f) => {
            const itens = finalizados.filter(f.teste);
            return { ...f, valor: itens.reduce((t, a) => t + a.preco, 0), qtd: itens.length };
        });
        if (!faturamento) {
            area.innerHTML = vazio("chart", "Nenhum faturamento no período", "Os atendimentos finalizados aparecem aqui como faturamento.");
            return;
        }

        // O desenho usa a largura real da área (1 unidade = 1 px), para o
        // texto ficar legível também no celular.
        const L = Math.max(280, Math.round(area.clientWidth || 640));
        const A = L < 480 ? 200 : 220, esq = 52, dir = 8, topo = 12, base = 26;
        const larguraUtil = L - esq - dir, alturaUtil = A - topo - base;
        const teto = escalaBonita(Math.max(...faixas.map((f) => f.valor)));
        const passo = larguraUtil / faixas.length;
        const largura = Math.max(2, Math.min(28, passo - 2)); // 2px de espaço entre colunas
        const y = (v) => topo + alturaUtil - (v / teto) * alturaUtil;
        // Rótulos do eixo contados a partir do fim: o último dia sempre aparece
        // e nenhum rótulo encosta no outro.
        const cadaRotulo = Math.max(1, Math.ceil(faixas.length / Math.max(2, Math.floor(larguraUtil / 64))));

        const grade = [0, 0.5, 1].map((f) => {
            const v = teto * f;
            return `<line class="dsh-g-grade" x1="${esq}" x2="${L - dir}" y1="${y(v)}" y2="${y(v)}"/>
                <text class="dsh-g-eixo" x="${esq - 8}" y="${y(v) + 4}" text-anchor="end">${esc(moedaCurta(v))}</text>`;
        }).join("");

        const colunas = faixas.map((f, i) => {
            const x = esq + i * passo + (passo - largura) / 2;
            const h = f.valor > 0 ? Math.max(3, (f.valor / teto) * alturaUtil) : 0;
            const r = Math.min(4, largura / 2, h);
            const yTopo = topo + alturaUtil - h;
            // Coluna com cantos arredondados só em cima, apoiada na linha de base.
            const caminho = h > 0
                ? `M${x},${topo + alturaUtil} V${yTopo + r} Q${x},${yTopo} ${x + r},${yTopo} H${x + largura - r} Q${x + largura},${yTopo} ${x + largura},${yTopo + r} V${topo + alturaUtil} Z`
                : "";
            const rotulo = (faixas.length - 1 - i) % cadaRotulo === 0
                ?`<text class="dsh-g-eixo" x="${x + largura / 2}" y="${A - 8}" text-anchor="middle">${esc(f.rotulo)}</text>` : "";
            return `<g class="dsh-g-coluna" data-i="${i}">
                <rect class="dsh-g-alvo" x="${esq + i * passo}" y="${topo}" width="${passo}" height="${alturaUtil}"/>
                ${caminho ? `<path class="dsh-g-barra" d="${caminho}"/>` : ""}
                ${rotulo}
            </g>`;
        }).join("");

        area.innerHTML = `<svg viewBox="0 0 ${L} ${A}" class="dsh-g" role="img" aria-label="Faturamento por ${periodo === "all" ? "mês" : periodo === "today" ? "hora" : "dia"}: total ${esc(moeda(faturamento))}">
            ${grade}
            <line class="dsh-g-base" x1="${esq}" x2="${L - dir}" y1="${topo + alturaUtil}" y2="${topo + alturaUtil}"/>
            ${colunas}
        </svg>
        <table class="dsh-sr">
            <caption>Faturamento por período</caption>
            <tr><th>Período</th><th>Faturamento</th><th>Atendimentos</th></tr>
            ${faixas.filter((f) => f.valor > 0).map((f) => `<tr><td>${esc(f.dica)}</td><td>${esc(moeda(f.valor))}</td><td>${f.qtd}</td></tr>`).join("")}
        </table>`;

        const dica = $("dshGraficoDica");
        const svg = area.querySelector("svg");
        const mostrar = (g) => {
            const f = faixas[Number(g.dataset.i)];
            svg.querySelectorAll(".dsh-g-coluna.ativa").forEach((x) => x.classList.remove("ativa"));
            g.classList.add("ativa");
            dica.innerHTML = `<strong>${esc(moeda(f.valor))}</strong><span>${esc(f.dica)} · ${esc(plural(f.qtd, "atendimento", "atendimentos"))}</span>`;
            dica.hidden = false;
            const caixaSvg = svg.getBoundingClientRect();
            const caixaG = g.getBoundingClientRect();
            const centro = caixaG.left + caixaG.width / 2 - caixaSvg.left;
            dica.style.left = `${Math.min(Math.max(centro, 70), caixaSvg.width - 70)}px`;
        };
        const esconder = () => {
            dica.hidden = true;
            svg.querySelectorAll(".dsh-g-coluna.ativa").forEach((x) => x.classList.remove("ativa"));
        };
        svg.addEventListener("pointermove", (e) => { const g = e.target.closest(".dsh-g-coluna"); if (g) mostrar(g); });
        svg.addEventListener("pointerleave", esconder);
    }

    // ------------------------------------------
    // Estados vazio e de erro
    // ------------------------------------------
    const ICONES = {
        calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
        users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.6-4.8 5.5-4.8s4.9 1.6 5.5 4.8"/>',
        scissors: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5 20 18M8 15.5 20 6"/>',
        chart: '<path d="M4 20V10M10 20V4M16 20v-7M3 20h18"/>',
        alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h.01"/>'
    };
    function vazio(icone, titulo, texto) {
        return `<div class="dsh-vazio">
            <span class="dsh-vazio__icone" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONES[icone]}</svg></span>
            <strong>${esc(titulo)}</strong><span>${esc(texto)}</span>
        </div>`;
    }
    function mostrarErro() {
        ["dshProximos", "dshBarbeiros", "dshServicos", "dshGrafico"].forEach((id) => {
            const el = $(id);
            if (el) el.innerHTML = vazio("alert", "Não foi possível carregar", "Verifique a conexão e atualize a página.");
        });
        ["dshHojeMeta", "dshFinalizadosMeta", "dshFaturamentoMeta"].forEach((id) => { if ($(id)) $(id).textContent = "Não foi possível carregar"; });
    }

    // ------------------------------------------
    // Início
    // ------------------------------------------
    function iniciar() {
        if (!$("dshHoje")) return;
        document.querySelectorAll("[data-dsh-periodo]").forEach((botao) => {
            botao.addEventListener("click", () => {
                periodo = botao.dataset.dshPeriodo;
                document.querySelectorAll("[data-dsh-periodo]").forEach((b) => {
                    const ativo = b === botao;
                    b.classList.toggle("ativo", ativo);
                    b.setAttribute("aria-pressed", String(ativo));
                });
                carregar();
            });
        });
        $("dshAbrirAgenda")?.addEventListener("click", () => document.querySelector('[data-section="agenda"]')?.click());
        // Ao voltar para a Visão geral, atualiza os números.
        document.querySelectorAll('[data-section="dashboard"]').forEach((link) => link.addEventListener("click", () => carregar()));
        carregar();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();

    window.PainelDashboard = { recarregar: carregar };
})();
