/**
 * ============================================================================
 * Controlador Principal da Interface (UI) - Simulador de AFD (LFC Projeto 01)
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const afd = new SimuladorAFD();
  const svgCanvas = document.getElementById("afd-canvas");

  // Estado do Auto-Play e Formato JSON selecionado
  let intervaloAutoPlay = null;
  let formatoJSONAtivo = "pdf"; // "pdf" | "completo"
  let modalTransicaoContexto = null; // { origem, destino }

  // Instancia o Editor Visual SVG
  const editorVisual = new EditorVisualAFD(svgCanvas, afd, {
    onChange: (msg) => {
      pararAutoPlay();
      atualizarTudo();
      if (msg) mostrarToast(msg);
    },
    onPositionsUpdated: () => {
      sincronizarPainelJSON();
    },
    onRequestTransitionSymbol: (origem, destino) => {
      abrirModalTransicao(origem, destino);
    }
  });

  // ==========================================================================
  // Inicialização e Exemplos Pré-configurados
  // ==========================================================================

  const seletorExemplo = document.getElementById("select-preset");
  const descExemplo = document.getElementById("preset-description");
  const inputCadeia = document.getElementById("input-string");

  function carregarExemplo(chave) {
    pararAutoPlay();
    const exemplo = EXEMPLOS_AFD[chave];
    if (!exemplo) return;

    afd.importarJSON(exemplo.completo);
    inputCadeia.value = exemplo.cadeiaSugerida;
    afd.reiniciarSimulacao(exemplo.cadeiaSugerida);

    if (descExemplo) {
      descExemplo.textContent = exemplo.descricao;
    }

    popularBateriaDeTestes(exemplo.testesSugeridos || []);
    atualizarTudo();
    mostrarToast(`Carregado: ${exemplo.titulo}`);
  }

  seletorExemplo.addEventListener("change", (e) => {
    carregarExemplo(e.target.value);
  });

  // ==========================================================================
  // Barra de Ferramentas do Editor Visual
  // ==========================================================================

  const botoesFerramenta = document.querySelectorAll("[data-tool-btn]");
  const dicaFerramenta = document.getElementById("tool-hint");

  const dicasPorFerramenta = {
    selecionar: "Arraste estados para movê-los • Duplo clique no fundo cria estado • Duplo clique no estado alterna Aceitação • Shift+Clique cria transição.",
    estado: "Clique em qualquer área livre do quadro para criar um novo estado (q0, q1, q2...).",
    transicao: "Clique primeiro no estado de origem e depois no estado de destino para definir δ(q, símbolo).",
    inicial: "Clique sobre um estado para defini-lo como o Estado Inicial (q0) do AFD.",
    aceitacao: "Clique sobre um estado para marcar ou desmarcar como Estado de Aceitação (círculo duplo).",
    excluir: "Clique sobre um estado ou sobre uma transição (seta/rótulo) para removê-lo."
  };

  botoesFerramenta.forEach((btn) => {
    btn.addEventListener("click", () => {
      const ferramenta = btn.getAttribute("data-tool-btn");
      botoesFerramenta.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      editorVisual.definirFerramenta(ferramenta);
      if (dicaFerramenta) {
        dicaFerramenta.textContent = dicasPorFerramenta[ferramenta] || "";
      }
    });
  });

  document.getElementById("btn-clear-automaton").addEventListener("click", () => {
    pararAutoPlay();
    afd.limpar();
    atualizarTudo();
    mostrarToast("Autômato limpo. Adicione estados no quadro ou importe um JSON.");
  });

  // ==========================================================================
  // Modal de Edição de Transição δ(origem, simbolo) = destino
  // ==========================================================================

  const modalTransicao = document.getElementById("modal-transition");
  const textoModalTransicao = document.getElementById("modal-transition-title");
  const inputModalSimbolo = document.getElementById("modal-transition-symbol");
  const btnSalvarTransicao = document.getElementById("btn-save-transition");
  const btnRemoverTransicaoModal = document.getElementById("btn-delete-transition");
  const btnCancelarTransicao = document.getElementById("btn-cancel-transition");

  function abrirModalTransicao(origem, destino) {
    modalTransicaoContexto = { origem, destino };
    textoModalTransicao.textContent = `Transição de ${origem} → ${destino}`;

    // Verifica se já existem símbolos entre origem e destino
    const simbolosAtuais = [];
    const mapaOrigem = afd.transicoes[origem] || {};
    for (const [simb, dest] of Object.entries(mapaOrigem)) {
      if (dest === destino) simbolosAtuais.push(simb);
    }

    inputModalSimbolo.value = simbolosAtuais.join(", ");
    btnRemoverTransicaoModal.style.display = simbolosAtuais.length > 0 ? "inline-flex" : "none";
    modalTransicao.classList.add("open");
    setTimeout(() => {
      inputModalSimbolo.focus();
      inputModalSimbolo.select();
    }, 50);
  }

  function fecharModalTransicao() {
    modalTransicao.classList.remove("open");
    modalTransicaoContexto = null;
  }

  function confirmarModalTransicao() {
    if (!modalTransicaoContexto) return;
    const { origem, destino } = modalTransicaoContexto;
    const valor = inputModalSimbolo.value.trim();

    // Remove transições anteriores que iam de origem para destino antes de regravar
    afd.removerTransicoesEntre(origem, destino);

    if (valor) {
      afd.definirTransicao(origem, valor, destino);
      mostrarToast(`Transição δ(${origem}, '${valor}') = ${destino} salva.`);
    } else {
      mostrarToast(`Transições de ${origem} para ${destino} removidas.`);
    }

    fecharModalTransicao();
    atualizarTudo();
  }

  btnSalvarTransicao.addEventListener("click", confirmarModalTransicao);
  btnCancelarTransicao.addEventListener("click", fecharModalTransicao);
  btnRemoverTransicaoModal.addEventListener("click", () => {
    if (!modalTransicaoContexto) return;
    const { origem, destino } = modalTransicaoContexto;
    afd.removerTransicoesEntre(origem, destino);
    fecharModalTransicao();
    atualizarTudo();
    mostrarToast(`Transição ${origem} → ${destino} removida.`);
  });

  inputModalSimbolo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmarModalTransicao();
    if (e.key === "Escape") fecharModalTransicao();
  });

  // ==========================================================================
  // Controles de Simulação Passo a Passo (Seção 2.1 do PDF)
  // ==========================================================================

  const btnIniciar = document.getElementById("btn-sim-reset");
  const btnPassoAnterior = document.getElementById("btn-sim-prev");
  const btnProximoPasso = document.getElementById("btn-sim-next");
  const btnAutoPlay = document.getElementById("btn-sim-autoplay");
  const btnExecutarTudo = document.getElementById("btn-sim-run-all");
  const sliderVelocidade = document.getElementById("sim-speed");

  inputCadeia.addEventListener("input", () => {
    pararAutoPlay();
    afd.reiniciarSimulacao(inputCadeia.value);
    atualizarPainelSimulacao();
    editorVisual.renderizar();
  });

  document.getElementById("btn-empty-string").addEventListener("click", () => {
    pararAutoPlay();
    inputCadeia.value = "";
    afd.iniciarSimulacao("");
    atualizarPainelSimulacao();
    editorVisual.renderizar();
  });

  btnIniciar.addEventListener("click", () => {
    pararAutoPlay();
    afd.iniciarSimulacao(inputCadeia.value);
    atualizarPainelSimulacao();
    editorVisual.renderizar();
  });

  btnPassoAnterior.addEventListener("click", () => {
    pararAutoPlay();
    afd.voltarPasso();
    atualizarPainelSimulacao();
    editorVisual.renderizar();
  });

  btnProximoPasso.addEventListener("click", () => {
    pararAutoPlay();
    avançarUmPasso();
  });

  btnExecutarTudo.addEventListener("click", () => {
    pararAutoPlay();
    afd.executarTudo(inputCadeia.value);
    atualizarPainelSimulacao();
    editorVisual.renderizar();
  });

  btnAutoPlay.addEventListener("click", () => {
    if (intervaloAutoPlay) {
      pararAutoPlay();
    } else {
      iniciarAutoPlay();
    }
  });

  function avançarUmPasso() {
    const estadoAntes = afd.obterEstadoSimulacao();
    if (estadoAntes.status === "PARADO") {
      afd.iniciarSimulacao(inputCadeia.value);
    } else if (estadoAntes.status === "ACEITA" || estadoAntes.status === "REJEITA") {
      // Se já terminou e clicou em próximo, reinicia no passo 0 para facilitar testes
      afd.iniciarSimulacao(inputCadeia.value);
    } else {
      afd.executarPasso();
    }
    atualizarPainelSimulacao();
    editorVisual.renderizar();
  }

  function iniciarAutoPlay() {
    const estadoAtual = afd.obterEstadoSimulacao();
    if (estadoAtual.status === "PARADO" || estadoAtual.status === "ACEITA" || estadoAtual.status === "REJEITA") {
      afd.iniciarSimulacao(inputCadeia.value);
      atualizarPainelSimulacao();
      editorVisual.renderizar();
    }

    btnAutoPlay.classList.add("playing");
    btnAutoPlay.innerHTML = `<span>⏸</span> Pausar`;

    const atraso = Number(sliderVelocidade.value) || 650;
    intervaloAutoPlay = setInterval(() => {
      const sim = afd.obterEstadoSimulacao();
      if (sim.status === "ACEITA" || sim.status === "REJEITA") {
        pararAutoPlay();
        return;
      }
      afd.executarPasso();
      atualizarPainelSimulacao();
      editorVisual.renderizar();

      const apos = afd.obterEstadoSimulacao();
      if (apos.status === "ACEITA" || apos.status === "REJEITA") {
        pararAutoPlay();
      }
    }, atraso);
  }

  function pararAutoPlay() {
    if (intervaloAutoPlay) {
      clearInterval(intervaloAutoPlay);
      intervaloAutoPlay = null;
    }
    btnAutoPlay.classList.remove("playing");
    btnAutoPlay.innerHTML = `<span>▶</span> Auto`;
  }

  // ==========================================================================
  // Atualização do Painel de Variáveis de Simulação, Fita e Histórico
  // ==========================================================================

  function atualizarPainelSimulacao() {
    const sim = afd.obterEstadoSimulacao();

    // 1. Variável `estadoAtual` (Seção 2.1 do PDF)
    const elEstadoAtual = document.getElementById("var-estado-atual");
    const elEstadoBadge = document.getElementById("var-estado-badge");
    if (sim.status === "PARADO") {
      elEstadoAtual.textContent = afd.estadoInicial || "—";
      elEstadoBadge.textContent = "Aguardando início";
      elEstadoBadge.className = "var-subbadge neutral";
    } else if (sim.estadoAtual) {
      elEstadoAtual.textContent = sim.estadoAtual;
      const ehFinal = afd.estadosAceitacao.has(sim.estadoAtual);
      elEstadoBadge.textContent = ehFinal ? "Estado de Aceitação (∈ F)" : "Estado Não-Final (∉ F)";
      elEstadoBadge.className = ehFinal ? "var-subbadge accept" : "var-subbadge neutral";
    } else {
      elEstadoAtual.textContent = "∅ (Morto)";
      elEstadoBadge.textContent = "Transição indefinida";
      elEstadoBadge.className = "var-subbadge reject";
    }

    // 2. Variável `cadeiaRestante` (Seção 2.1 do PDF)
    const elCadeiaRestante = document.getElementById("var-cadeia-restante");
    const elCadeiaRestanteInfo = document.getElementById("var-cadeia-info");
    const restanteTexto = sim.status === "PARADO" ? inputCadeia.value : sim.cadeiaRestante;
    elCadeiaRestante.textContent = restanteTexto.length > 0 ? `"${restanteTexto}"` : "ε (vazia)";
    elCadeiaRestanteInfo.textContent =
      restanteTexto.length > 0
        ? `${restanteTexto.length} símbolo(s) restante(s) • Próximo: '${restanteTexto[0]}'`
        : "Todos os símbolos foram processados";

    // 3. Última Transição Aplicada δ(q, a)
    const elTransicaoAtual = document.getElementById("var-transicao-aplicada");
    const elTransicaoDetalhe = document.getElementById("var-transicao-detalhe");
    if (sim.ultimaTransicao) {
      const { de, simbolo, para, erro } = sim.ultimaTransicao;
      elTransicaoAtual.textContent = `δ(${de}, '${simbolo}') = ${erro ? "∅" : para}`;
      elTransicaoDetalhe.textContent = erro
        ? "Transição não definida no AFD"
        : `Leu '${simbolo}' e foi de ${de} para ${para}`;
    } else if (sim.status === "EM_ANDAMENTO" && sim.proximoSimbolo) {
      const proxDest = (afd.transicoes[sim.estadoAtual] || {})[sim.proximoSimbolo];
      elTransicaoAtual.textContent = `Próxima: δ(${sim.estadoAtual}, '${sim.proximoSimbolo}')`;
      elTransicaoDetalhe.textContent = proxDest
        ? `Irá para o estado '${proxDest}'`
        : "Transição indefinida (rejeitará)";
    } else {
      elTransicaoAtual.textContent = "δ(q, a)";
      elTransicaoDetalhe.textContent = "Nenhum símbolo processado ainda";
    }

    // 4. Banner de Status Geral (PARADO / EM ANDAMENTO / ACEITA / REJEITA)
    const bannerStatus = document.getElementById("sim-status-banner");
    const tituloStatus = document.getElementById("sim-status-title");
    const descStatus = document.getElementById("sim-status-desc");

    bannerStatus.className = "status-banner";
    if (sim.status === "ACEITA") {
      bannerStatus.classList.add("status-accepted");
      tituloStatus.textContent = "CADEIA ACEITA";
      descStatus.textContent = `A cadeia "${sim.cadeiaOriginal || "ε"}" foi totalmente lida e terminou no estado de aceitação '${sim.estadoAtual}'.`;
    } else if (sim.status === "REJEITA") {
      bannerStatus.classList.add("status-rejected");
      tituloStatus.textContent = "CADEIA REJEITADA";
      descStatus.textContent = sim.motivoRejeicao || `A cadeia "${sim.cadeiaOriginal}" foi rejeitada pelo AFD.`;
    } else if (sim.status === "EM_ANDAMENTO") {
      bannerStatus.classList.add("status-running");
      tituloStatus.textContent = `SIMULAÇÃO EM ANDAMENTO (Passo ${sim.indiceAtual}/${sim.cadeiaOriginal.length})`;
      descStatus.textContent = `Estado atual: ${sim.estadoAtual} • Próximo símbolo a ler: '${sim.proximoSimbolo}'`;
    } else {
      bannerStatus.classList.add("status-idle");
      tituloStatus.textContent = "PRONTO PARA SIMULAR";
      descStatus.textContent = "Clique em 'Próximo Passo' para processar símbolo por símbolo ou 'Executar Tudo'.";
    }

    // 5. Renderiza Fita Visual da Cadeia de Entrada
    renderizarFitaEntrada(sim);

    // 6. Renderiza Tabela de Histórico de Passos
    renderizarHistoricoPassos(sim);

    // Habilita/desabilita botões conforme estado
    btnPassoAnterior.disabled = sim.historicoPassos.length <= 1;
  }

  function renderizarFitaEntrada(sim) {
    const containerFita = document.getElementById("tape-cells");
    const cadeia = sim.status === "PARADO" ? inputCadeia.value : sim.cadeiaOriginal;

    if (cadeia.length === 0) {
      containerFita.innerHTML = `
        <div class="tape-cell empty-epsilon active-head">
          <span class="cell-index">0</span>
          <span class="cell-char">ε</span>
          <span class="cell-status">Cadeia vazia</span>
        </div>
      `;
      return;
    }

    let html = "";
    for (let i = 0; i < cadeia.length; i++) {
      const char = cadeia[i];
      let classe = "tape-cell";
      let etiqueta = "";

      if (sim.status !== "PARADO") {
        if (i < sim.indiceAtual) {
          classe += " cell-read";
          etiqueta = "Lido";
        } else if (i === sim.indiceAtual && sim.status === "EM_ANDAMENTO") {
          classe += " active-head";
          etiqueta = "Cabeçote ▲";
        } else {
          classe += " cell-remaining";
          etiqueta = "Restante";
        }
      } else if (i === 0) {
        classe += " active-head";
        etiqueta = "Início ▲";
      }

      html += `
        <div class="${classe}">
          <span class="cell-index">${i + 1}</span>
          <span class="cell-char">${escaparHTML(char)}</span>
          <span class="cell-status">${etiqueta}</span>
        </div>
      `;
    }
    containerFita.innerHTML = html;
  }

  function renderizarHistoricoPassos(sim) {
    const tbody = document.getElementById("trace-table-body");
    if (!sim.historicoPassos || sim.historicoPassos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-table-msg">
            Inicie a simulação para visualizar o rastreamento passo a passo das variáveis.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = sim.historicoPassos
      .map((item, idx) => {
        const ehUltimo = idx === sim.historicoPassos.length - 1;
        const classeLinha = `${ehUltimo ? "current-step-row" : ""} ${item.erro ? "error-step-row" : ""}`;
        const restanteFmt = item.cadeiaRestante.length > 0 ? item.cadeiaRestante : "ε";
        return `
          <tr class="${classeLinha}">
            <td><span class="step-badge">#${item.passo}</span></td>
            <td><code>${escaparHTML(item.descricao)}</code></td>
            <td><strong class="state-pill">${escaparHTML(item.estadoAtual)}</strong></td>
            <td><code class="remaining-code">${escaparHTML(restanteFmt)}</code></td>
          </tr>
        `;
      })
      .join("");
  }

  // ==========================================================================
  // Definição Formal M = (Q, Σ, δ, q0, F) e Tabela de Transições Interativa
  // ==========================================================================

  function atualizarTabelaEFormalismo() {
    const estadosArr = Array.from(afd.estados);
    const alfabetoArr = Array.from(afd.alfabeto).sort();
    const finaisArr = Array.from(afd.estadosAceitacao);

    // Quíntupla Formal
    document.getElementById("formal-q").textContent = `{ ${estadosArr.join(", ")} }`;
    document.getElementById("formal-sigma").textContent = `{ ${alfabetoArr.join(", ")} }`;
    document.getElementById("formal-q0").textContent = afd.estadoInicial || "∅";
    document.getElementById("formal-f").textContent = `{ ${finaisArr.join(", ")} }`;

    // Validação do AFD
    const validacao = afd.validarAFD();
    const badgeValidacao = document.getElementById("afd-validation-badge");
    if (!validacao.valido) {
      badgeValidacao.className = "validation-badge invalid";
      badgeValidacao.textContent = "AFD Incompleto (Sem estado inicial)";
    } else if (validacao.completo) {
      badgeValidacao.className = "validation-badge complete";
      badgeValidacao.textContent = "AFD Completo (Função δ total)";
    } else {
      badgeValidacao.className = "validation-badge partial";
      badgeValidacao.textContent = `AFD Parcial (${validacao.transicoesFaltantes.length} transição(ões) omitida(s))`;
    }

    // Cabeçalho da Tabela de Transições δ
    const thead = document.getElementById("transition-table-head");
    const tbody = document.getElementById("transition-table-body");

    const colunasSimbolos = alfabetoArr.length > 0 ? alfabetoArr : ["a", "b"];

    thead.innerHTML = `
      <tr>
        <th>Inicial</th>
        <th>Final (F)</th>
        <th>Estado</th>
        ${colunasSimbolos.map((s) => `<th>δ(q, '${escaparHTML(s)}')</th>`).join("")}
      </tr>
    `;

    if (estadosArr.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${3 + colunasSimbolos.length}" class="empty-table-msg">
            Nenhum estado cadastrado.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = estadosArr
      .map((estado) => {
        const ehInicial = afd.estadoInicial === estado;
        const ehFinal = afd.estadosAceitacao.has(estado);

        const celulasSimbolos = colunasSimbolos
          .map((simbolo) => {
            const destinoAtual = (afd.transicoes[estado] || {})[simbolo] || "";
            return `
              <td>
                <input type="text"
                       class="delta-cell-input"
                       data-from="${escaparHTML(estado)}"
                       data-symbol="${escaparHTML(simbolo)}"
                       value="${escaparHTML(destinoAtual)}"
                       placeholder="∅" />
              </td>
            `;
          })
          .join("");

        return `
          <tr>
            <td class="center-cell">
              <input type="radio" name="radio-initial-state"
                     data-set-initial="${escaparHTML(estado)}"
                     ${ehInicial ? "checked" : ""} />
            </td>
            <td class="center-cell">
              <input type="checkbox"
                     data-toggle-accept="${escaparHTML(estado)}"
                     ${ehFinal ? "checked" : ""} />
            </td>
            <td>
              <span class="table-state-label">
                ${ehInicial ? "→ " : ""}${ehFinal ? "*" : ""}${escaparHTML(estado)}
              </span>
            </td>
            ${celulasSimbolos}
          </tr>
        `;
      })
      .join("");

    // Eventos dos inputs da tabela de transição
    tbody.querySelectorAll("[data-set-initial]").forEach((radio) => {
      radio.addEventListener("change", () => {
        const est = radio.getAttribute("data-set-initial");
        afd.definirEstadoInicial(est);
        atualizarTudo();
        mostrarToast(`Estado inicial alterado para '${est}'.`);
      });
    });

    tbody.querySelectorAll("[data-toggle-accept]").forEach((chk) => {
      chk.addEventListener("change", () => {
        const est = chk.getAttribute("data-toggle-accept");
        afd.alternarEstadoAceitacao(est);
        atualizarTudo();
      });
    });

    tbody.querySelectorAll(".delta-cell-input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const origem = inp.getAttribute("data-from");
        const simbolo = inp.getAttribute("data-symbol");
        const destino = inp.value.trim();

        if (!destino || destino === "∅" || destino === "-") {
          afd.removerTransicao(origem, simbolo);
        } else {
          afd.definirTransicao(origem, simbolo, destino);
        }
        atualizarTudo();
      });
    });
  }

  // Botão rápido para adicionar estado ou símbolo pela tabela
  document.getElementById("btn-quick-add-state").addEventListener("click", () => {
    const novoNome = editorVisual.gerarProximoNomeEstado();
    afd.adicionarEstado(novoNome);
    atualizarTudo();
    mostrarToast(`Estado '${novoNome}' adicionado.`);
  });

  document.getElementById("btn-quick-add-symbol").addEventListener("click", () => {
    const inpSimb = document.getElementById("input-new-symbol");
    const simb = inpSimb.value.trim();
    if (!simb) return;
    const primeiroEstado = afd.estadoInicial || Array.from(afd.estados)[0];
    if (!primeiroEstado) {
      mostrarToast("Adicione pelo menos um estado antes de adicionar transições.");
      return;
    }
    afd.definirTransicao(primeiroEstado, simb, primeiroEstado);
    inpSimb.value = "";
    atualizarTudo();
    mostrarToast(`Símbolo '${simb}' adicionado (laço inicial em ${primeiroEstado}, edite na tabela).`);
  });

  // ==========================================================================
  // Importação e Exportação JSON (Compatível com Seção 2.1 do PDF)
  // ==========================================================================

  const textareaJSON = document.getElementById("json-editor-textarea");
  const btnTabJSONPdf = document.getElementById("btn-json-format-pdf");
  const btnTabJSONCompleto = document.getElementById("btn-json-format-full");
  const feedbackJSON = document.getElementById("json-status-msg");

  function sincronizarPainelJSON() {
    textareaJSON.value = afd.exportarJSON(formatoJSONAtivo);
    feedbackJSON.textContent =
      formatoJSONAtivo === "pdf"
        ? "Exibindo formato simplificado (mapeamento direto de estados e transições)."
        : "Exibindo formato completo (inclui estadoInicial, estadosAceitacao e posições).";
    feedbackJSON.className = "json-feedback-msg info";
  }

  btnTabJSONPdf.addEventListener("click", () => {
    formatoJSONAtivo = "pdf";
    btnTabJSONPdf.classList.add("active");
    btnTabJSONCompleto.classList.remove("active");
    sincronizarPainelJSON();
  });

  btnTabJSONCompleto.addEventListener("click", () => {
    formatoJSONAtivo = "completo";
    btnTabJSONCompleto.classList.add("active");
    btnTabJSONPdf.classList.remove("active");
    sincronizarPainelJSON();
  });

  document.getElementById("btn-import-json").addEventListener("click", () => {
    try {
      pararAutoPlay();
      afd.importarJSON(textareaJSON.value);
      atualizarTudo();
      feedbackJSON.textContent = "JSON importado com sucesso para o simulador!";
      feedbackJSON.className = "json-feedback-msg success";
      mostrarToast("Autômato importado do JSON com sucesso!");
    } catch (erro) {
      feedbackJSON.textContent = `Erro no JSON: ${erro.message}`;
      feedbackJSON.className = "json-feedback-msg error";
    }
  });

  document.getElementById("btn-copy-json").addEventListener("click", () => {
    navigator.clipboard.writeText(textareaJSON.value).then(() => {
      mostrarToast("JSON copiado para a área de transferência!");
    });
  });

  document.getElementById("btn-download-json").addEventListener("click", () => {
    const conteudo = afd.exportarJSON(formatoJSONAtivo);
    const blob = new Blob([conteudo], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = formatoJSONAtivo === "pdf" ? "afd_simplificado.json" : "afd_completo.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  const inputFileJSON = document.getElementById("input-file-json");
  document.getElementById("btn-upload-json").addEventListener("click", () => {
    inputFileJSON.click();
  });

  inputFileJSON.addEventListener("change", (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = (ev) => {
      try {
        textareaJSON.value = ev.target.result;
        afd.importarJSON(ev.target.result);
        atualizarTudo();
        feedbackJSON.textContent = `Arquivo '${arquivo.name}' carregado com sucesso!`;
        feedbackJSON.className = "json-feedback-msg success";
        mostrarToast(`Arquivo '${arquivo.name}' importado!`);
      } catch (err) {
        feedbackJSON.textContent = `Erro ao ler '${arquivo.name}': ${err.message}`;
        feedbackJSON.className = "json-feedback-msg error";
      }
    };
    leitor.readAsText(arquivo);
    inputFileJSON.value = "";
  });

  // ==========================================================================
  // Bateria de Testes em Lote (Múltiplas Cadeias)
  // ==========================================================================

  let listaCadeiasTeste = [];

  function popularBateriaDeTestes(testesIniciais) {
    listaCadeiasTeste = testesIniciais.map((t) => ({
      cadeia: t.cadeia,
      nota: t.nota || ""
    }));
    renderizarBateriaDeTestes();
  }

  function renderizarBateriaDeTestes() {
    const tbody = document.getElementById("batch-test-body");
    if (listaCadeiasTeste.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-table-msg">Adicione cadeias acima para testar em lote.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = listaCadeiasTeste
      .map((item, idx) => {
        const res = afd.testarCadeiaRapido(item.cadeia);
        const cadeiaExibicao = item.cadeia.length > 0 ? `"${item.cadeia}"` : "ε (vazia)";
        return `
          <tr>
            <td>
              <code class="batch-string-code">${escaparHTML(cadeiaExibicao)}</code>
              ${item.nota ? `<span class="batch-note">${escaparHTML(item.nota)}</span>` : ""}
            </td>
            <td>
              <span class="batch-state-pill">${escaparHTML(res.estadoFinal || "∅")}</span>
            </td>
            <td>
              <span class="result-badge ${res.aceita ? "accept" : "reject"}">
                ${res.aceita ? "✓ ACEITA" : "✕ REJEITA"}
              </span>
            </td>
            <td class="right-cell">
              <button class="btn-mini-load" data-load-test="${idx}" title="Carregar no simulador passo a passo">
                Simular ▶
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll("[data-load-test]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-load-test"));
        const item = listaCadeiasTeste[idx];
        if (!item) return;
        pararAutoPlay();
        inputCadeia.value = item.cadeia;
        afd.iniciarSimulacao(item.cadeia);
        atualizarPainelSimulacao();
        editorVisual.renderizar();
        mostrarToast(`Cadeia "${item.cadeia || "ε"}" carregada na simulação passo a passo.`);
      });
    });
  }

  const inputNovaCadeiaTeste = document.getElementById("input-batch-string");
  document.getElementById("btn-add-batch-test").addEventListener("click", () => {
    const valor = inputNovaCadeiaTeste.value;
    listaCadeiasTeste.push({ cadeia: valor, nota: "Teste personalizado" });
    inputNovaCadeiaTeste.value = "";
    renderizarBateriaDeTestes();
  });

  inputNovaCadeiaTeste.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("btn-add-batch-test").click();
    }
  });

  // ==========================================================================
  // Sincronização Global da Interface
  // ==========================================================================

  function atualizarTudo() {
    editorVisual.renderizar();
    atualizarPainelSimulacao();
    atualizarTabelaEFormalismo();
    sincronizarPainelJSON();
    renderizarBateriaDeTestes();
  }

  function mostrarToast(mensagem) {
    const toast = document.getElementById("app-toast");
    if (!toast) return;
    toast.textContent = mensagem;
    toast.classList.add("visible");
    clearTimeout(mostrarToast._timer);
    mostrarToast._timer = setTimeout(() => {
      toast.classList.remove("visible");
    }, 2800);
  }

  function escaparHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Carrega o Exemplo da Página 3 do PDF por padrão ao abrir a aplicação
  carregarExemplo("pdf_pag3");
});
