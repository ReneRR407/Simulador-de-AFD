/**
 * ============================================================================
 * Editor Visual e Renderizador Gráfico SVG para o AFD
 * ============================================================================
 * Desenha os estados, seta de estado inicial, círculos duplos de aceitação,
 * auto-laços (self-loops) e curvas de Bézier para transições bidirecionais,
 * além de destacar o `estadoAtual` e a transição percorrida na simulação.
 */

class EditorVisualAFD {
  constructor(svgElement, simulador, callbacks = {}) {
    this.svg = svgElement;
    this.afd = simulador;
    this.callbacks = callbacks; // { onChange, onRequestTransitionSymbol, onSelectElement }

    this.raioEstado = 30;
    this.ferramentaAtual = "selecionar"; // selecionar | estado | transicao | inicial | aceitacao | excluir

    // Estado de interação (arrastar nó / criar aresta)
    this.estadoArrastando = null;
    this.offsetArrasto = { x: 0, y: 0 };
    this.origemTransicaoPendente = null;
    this.pontoMouse = { x: 0, y: 0 };

    this.inicializarEventos();
  }

  definirFerramenta(ferramenta) {
    this.ferramentaAtual = ferramenta;
    this.origemTransicaoPendente = null;
    this.svg.setAttribute("data-tool", ferramenta);
    this.renderizar();
  }

  obterCoordenadasSVG(evento) {
    const rect = this.svg.getBoundingClientRect();
    const viewBox = this.svg.viewBox.baseVal;
    const scaleX = viewBox && viewBox.width ? viewBox.width / rect.width : 1;
    const scaleY = viewBox && viewBox.height ? viewBox.height / rect.height : 1;
    return {
      x: (evento.clientX - rect.left) * scaleX,
      y: (evento.clientY - rect.top) * scaleY
    };
  }

  gerarProximoNomeEstado() {
    let indice = 0;
    while (this.afd.estados.has(`q${indice}`)) {
      indice++;
    }
    return `q${indice}`;
  }

  inicializarEventos() {
    this.svg.addEventListener("mousedown", (e) => this.aoPressionarMouse(e));
    window.addEventListener("mousemove", (e) => this.aoMoverMouse(e));
    window.addEventListener("mouseup", (e) => this.aoSoltarMouse(e));
    this.svg.addEventListener("dblclick", (e) => this.aoDuploClique(e));
  }

  aoPressionarMouse(e) {
    if (e.button !== 0) return;
    const pt = this.obterCoordenadasSVG(e);
    const elEstado = e.target.closest("[data-state]");
    const elAresta = e.target.closest("[data-edge-from]");

    if (this.ferramentaAtual === "estado") {
      if (!elEstado) {
        const novoNome = this.gerarProximoNomeEstado();
        this.afd.adicionarEstado(novoNome, { x: Math.round(pt.x), y: Math.round(pt.y) });
        this.notificarMudanca(`Estado '${novoNome}' adicionado.`);
      }
      return;
    }

    if (elEstado) {
      const nomeEstado = elEstado.getAttribute("data-state");

      if (this.ferramentaAtual === "inicial") {
        this.afd.definirEstadoInicial(nomeEstado);
        this.notificarMudanca(`'${nomeEstado}' definido como estado inicial.`);
        return;
      }

      if (this.ferramentaAtual === "aceitacao") {
        this.afd.alternarEstadoAceitacao(nomeEstado);
        const ehFinal = this.afd.estadosAceitacao.has(nomeEstado);
        this.notificarMudanca(
          ehFinal
            ? `'${nomeEstado}' marcado como estado de aceitação.`
            : `'${nomeEstado}' deixou de ser estado de aceitação.`
        );
        return;
      }

      if (this.ferramentaAtual === "excluir") {
        this.afd.removerEstado(nomeEstado);
        this.notificarMudanca(`Estado '${nomeEstado}' removido.`);
        return;
      }

      if (this.ferramentaAtual === "transicao" || e.shiftKey) {
        if (!this.origemTransicaoPendente) {
          this.origemTransicaoPendente = nomeEstado;
          this.pontoMouse = pt;
          this.renderizar();
        } else {
          const origem = this.origemTransicaoPendente;
          const destino = nomeEstado;
          this.origemTransicaoPendente = null;
          this.renderizar();
          if (this.callbacks.onRequestTransitionSymbol) {
            this.callbacks.onRequestTransitionSymbol(origem, destino);
          }
        }
        return;
      }

      // Ferramenta selecionar: iniciar arrasto do estado
      const pos = this.afd.posicoes[nomeEstado] || { x: pt.x, y: pt.y };
      this.estadoArrastando = nomeEstado;
      this.offsetArrasto = { x: pt.x - pos.x, y: pt.y - pos.y };
      return;
    }

    if (elAresta) {
      const origem = elAresta.getAttribute("data-edge-from");
      const destino = elAresta.getAttribute("data-edge-to");

      if (this.ferramentaAtual === "excluir") {
        this.afd.removerTransicoesEntre(origem, destino);
        this.notificarMudanca(`Transição de '${origem}' para '${destino}' removida.`);
        return;
      }

      if (this.callbacks.onRequestTransitionSymbol) {
        this.callbacks.onRequestTransitionSymbol(origem, destino);
      }
      return;
    }

    // Clicou no fundo vazio com transicao pendente -> cancela
    if (this.origemTransicaoPendente) {
      this.origemTransicaoPendente = null;
      this.renderizar();
    }
  }

  aoMoverMouse(e) {
    if (!this.estadoArrastando && !this.origemTransicaoPendente) return;
    const pt = this.obterCoordenadasSVG(e);
    this.pontoMouse = pt;

    if (this.estadoArrastando) {
      const viewBox = this.svg.viewBox.baseVal;
      const largura = viewBox && viewBox.width ? viewBox.width : 800;
      const altura = viewBox && viewBox.height ? viewBox.height : 460;
      const margem = 40;

      const novoX = Math.max(margem, Math.min(largura - margem, Math.round(pt.x - this.offsetArrasto.x)));
      const novoY = Math.max(margem, Math.min(altura - margem, Math.round(pt.y - this.offsetArrasto.y)));

      this.afd.posicoes[this.estadoArrastando] = { x: novoX, y: novoY };
      this.renderizar();
    } else if (this.origemTransicaoPendente) {
      this.renderizar();
    }
  }

  aoSoltarMouse() {
    if (this.estadoArrastando) {
      this.estadoArrastando = null;
      if (this.callbacks.onPositionsUpdated) {
        this.callbacks.onPositionsUpdated();
      }
    }
  }

  aoDuploClique(e) {
    const pt = this.obterCoordenadasSVG(e);
    const elEstado = e.target.closest("[data-state]");

    if (elEstado) {
      const nomeEstado = elEstado.getAttribute("data-state");
      this.afd.alternarEstadoAceitacao(nomeEstado);
      const ehFinal = this.afd.estadosAceitacao.has(nomeEstado);
      this.notificarMudanca(
        ehFinal
          ? `'${nomeEstado}' marcado como estado de aceitação (duplo clique).`
          : `'${nomeEstado}' desmarcado como estado de aceitação (duplo clique).`
      );
      return;
    }

    if (this.ferramentaAtual === "selecionar") {
      const novoNome = this.gerarProximoNomeEstado();
      this.afd.adicionarEstado(novoNome, { x: Math.round(pt.x), y: Math.round(pt.y) });
      this.notificarMudanca(`Estado '${novoNome}' criado (duplo clique).`);
    }
  }

  notificarMudanca(mensagem) {
    this.renderizar();
    if (this.callbacks.onChange) {
      this.callbacks.onChange(mensagem);
    }
  }

  /**
   * Agrupa transições com mesma origem e mesmo destino para desenhar uma única seta
   * com os símbolos separados por vírgula (ex: "a, b").
   */
  agruparArestas() {
    const mapaArestas = new Map();

    for (const [origem, trans] of Object.entries(this.afd.transicoes)) {
      for (const [simbolo, destino] of Object.entries(trans)) {
        if (!this.afd.estados.has(origem) || !this.afd.estados.has(destino)) continue;
        const chave = `${origem}-->${destino}`;
        if (!mapaArestas.has(chave)) {
          mapaArestas.set(chave, {
            origem,
            destino,
            simbolos: []
          });
        }
        mapaArestas.get(chave).simbolos.push(simbolo);
      }
    }

    return Array.from(mapaArestas.values());
  }

  renderizar() {
    const r = this.raioEstado;
    const estadoSim = this.afd.obterEstadoSimulacao();
    const arestas = this.agruparArestas();
    const conjuntoChaves = new Set(arestas.map(a => `${a.origem}-->${a.destino}`));

    let html = `
      <defs>
        <marker id="arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#94a3b8" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
        </marker>
        <marker id="arrow-initial" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#818cf8" />
        </marker>
        <filter id="glow-active" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    `;

    // Linha guia temporária ao criar uma transição
    if (this.origemTransicaoPendente && this.afd.posicoes[this.origemTransicaoPendente]) {
      const pOrigem = this.afd.posicoes[this.origemTransicaoPendente];
      html += `
        <line x1="${pOrigem.x}" y1="${pOrigem.y}" x2="${this.pontoMouse.x}" y2="${this.pontoMouse.y}"
              stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="6 4" marker-end="url(#arrow-active)" />
      `;
    }

    // 1. Renderizar Arestas (Transições)
    for (const aresta of arestas) {
      const { origem, destino, simbolos } = aresta;
      const p1 = this.afd.posicoes[origem];
      const p2 = this.afd.posicoes[destino];
      if (!p1 || !p2) continue;

      const ehTransicaoAtiva =
        estadoSim.ultimaTransicao &&
        !estadoSim.ultimaTransicao.erro &&
        estadoSim.ultimaTransicao.de === origem &&
        estadoSim.ultimaTransicao.para === destino &&
        simbolos.includes(estadoSim.ultimaTransicao.simbolo);

      const corLinha = ehTransicaoAtiva ? "#38bdf8" : "#94a3b8";
      const espessura = ehTransicaoAtiva ? "3" : "2";
      const marcador = ehTransicaoAtiva ? "url(#arrow-active)" : "url(#arrow-default)";
      const classeAresta = ehTransicaoAtiva ? "edge-group active-edge" : "edge-group";
      const rotulo = simbolos.sort().join(", ");

      if (origem === destino) {
        // Auto-laço (Self-loop) no topo do estado, igual à figura da página 3 do PDF
        const anguloSaida = -Math.PI * 0.72;
        const anguloChegada = -Math.PI * 0.28;
        const sx = p1.x + r * Math.cos(anguloSaida);
        const sy = p1.y + r * Math.sin(anguloSaida);
        const ex = p1.x + (r + 3) * Math.cos(anguloChegada);
        const ey = p1.y + (r + 3) * Math.sin(anguloChegada);

        const c1x = p1.x - 38;
        const c1y = p1.y - 82;
        const c2x = p1.x + 38;
        const c2y = p1.y - 82;
        const labelX = p1.x;
        const labelY = p1.y - 74;

        html += `
          <g class="${classeAresta}" data-edge-from="${origem}" data-edge-to="${destino}">
            <path d="M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}"
                  fill="none" stroke="transparent" stroke-width="14" class="edge-hitbox" />
            <path d="M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}"
                  fill="none" stroke="${corLinha}" stroke-width="${espessura}" marker-end="${marcador}" />
            <rect x="${labelX - (rotulo.length * 4 + 10)}" y="${labelY - 12}"
                  width="${rotulo.length * 8 + 20}" height="22" rx="6"
                  class="edge-label-bg ${ehTransicaoAtiva ? 'active' : ''}" />
            <text x="${labelX}" y="${labelY + 3}" text-anchor="middle"
                  class="edge-label-text ${ehTransicaoAtiva ? 'active' : ''}">${this.escaparHTML(rotulo)}</text>
          </g>
        `;
      } else {
        // Transição entre dois estados distintos
        const temInversa = conjuntoChaves.has(`${destino}-->${origem}`);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;

        // Vetor normal perpendicular
        const nx = -uy;
        const ny = ux;

        const curvatura = temInversa ? 36 : 0;
        const anguloOffset = temInversa ? 0.22 : 0;

        const anguloBase = Math.atan2(dy, dx);
        const sx = p1.x + r * Math.cos(anguloBase + anguloOffset);
        const sy = p1.y + r * Math.sin(anguloBase + anguloOffset);
        const ex = p2.x - (r + 4) * Math.cos(anguloBase - anguloOffset);
        const ey = p2.y - (r + 4) * Math.sin(anguloBase - anguloOffset);

        const mx = (p1.x + p2.x) / 2 + nx * curvatura;
        const my = (p1.y + p2.y) / 2 + ny * curvatura;

        // Ponto médio na curva quadrática de Bézier (t = 0.5)
        const labelX = 0.25 * sx + 0.5 * mx + 0.25 * ex;
        const labelY = 0.25 * sy + 0.5 * my + 0.25 * ey;

        html += `
          <g class="${classeAresta}" data-edge-from="${origem}" data-edge-to="${destino}">
            <path d="M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}"
                  fill="none" stroke="transparent" stroke-width="14" class="edge-hitbox" />
            <path d="M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}"
                  fill="none" stroke="${corLinha}" stroke-width="${espessura}" marker-end="${marcador}" />
            <rect x="${labelX - (rotulo.length * 4 + 10)}" y="${labelY - 11}"
                  width="${rotulo.length * 8 + 20}" height="22" rx="6"
                  class="edge-label-bg ${ehTransicaoAtiva ? 'active' : ''}" />
            <text x="${labelX}" y="${labelY + 4}" text-anchor="middle"
                  class="edge-label-text ${ehTransicaoAtiva ? 'active' : ''}">${this.escaparHTML(rotulo)}</text>
          </g>
        `;
      }
    }

    // 2. Renderizar Estados
    for (const estado of this.afd.estados) {
      const pos = this.afd.posicoes[estado] || { x: 200, y: 200 };
      const ehInicial = this.afd.estadoInicial === estado;
      const ehAceitacao = this.afd.estadosAceitacao.has(estado);
      const ehEstadoAtual =
        estadoSim.status !== "PARADO" && estadoSim.estadoAtual === estado;
      const ehOrigemPendente = this.origemTransicaoPendente === estado;

      let classeEstado = "state-node";
      if (ehEstadoAtual) {
        if (estadoSim.status === "ACEITA") classeEstado += " state-accepted";
        else if (estadoSim.status === "REJEITA") classeEstado += " state-rejected";
        else classeEstado += " state-active";
      } else if (ehOrigemPendente) {
        classeEstado += " state-pending-source";
      }

      // Seta de estado inicial (à esquerda do nó, como no diagrama do PDF)
      if (ehInicial) {
        const ix1 = pos.x - r - 44;
        const iy1 = pos.y;
        const ix2 = pos.x - r - 4;
        const iy2 = pos.y;
        html += `
          <g class="initial-arrow">
            <line x1="${ix1}" y1="${iy1}" x2="${ix2}" y2="${iy2}"
                  stroke="#818cf8" stroke-width="2.5" marker-end="url(#arrow-initial)" />
            <text x="${ix1 - 6}" y="${iy1 + 4}" text-anchor="end" class="initial-label">Início</text>
          </g>
        `;
      }

      html += `
        <g class="${classeEstado}" data-state="${this.escaparHTML(estado)}" transform="translate(${pos.x}, ${pos.y})">
          ${ehEstadoAtual ? `<circle r="${r + 7}" class="state-halo" />` : ""}
          <circle r="${r}" class="state-circle-outer" />
          ${ehAceitacao ? `<circle r="${r - 6}" class="state-circle-inner" />` : ""}
          <text dy="5" text-anchor="middle" class="state-label">${this.escaparHTML(estado)}</text>
        </g>
      `;
    }

    if (this.afd.estados.size === 0) {
      html += `
        <text x="380" y="230" text-anchor="middle" fill="#64748b" font-size="15">
          Nenhum estado no autômato. Dê duplo clique aqui ou use a barra de ferramentas para adicionar estados.
        </text>
      `;
    }

    this.svg.innerHTML = html;
  }

  escaparHTML(texto) {
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

window.EditorVisualAFD = EditorVisualAFD;
