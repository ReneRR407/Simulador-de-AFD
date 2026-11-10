/**
 * ============================================================================
 * LFC - Projeto 01: Linguagens Regulares
 * Seção 2.1 - Simulador de Autômato Finito Determinístico (AFD)
 * ============================================================================
 *
 * Conforme especificado no documento do projeto (Seção 2.1):
 * Um simulador de AFD guarda em variáveis principais:
 *   1. `estadoAtual`: o estado atual do autômato durante a simulação
 *   2. `cadeiaRestante`: quais símbolos da cadeia de entrada ainda precisam ser lidos
 *
 * A cada passo, o simulador lê o primeiro símbolo de `cadeiaRestante`,
 * consulta a função de transição δ(estadoAtual, simbolo) para decidir
 * qual será o próximo estado e atualiza as variáveis.
 */

class SimuladorAFD {
  constructor() {
    // Definição formal do AFD: M = (Q, Σ, δ, q0, F)
    this.estados = new Set();           // Q: Conjunto finito de estados
    this.alfabeto = new Set();          // Σ: Alfabeto de símbolos de entrada
    this.transicoes = {};               // δ: Função de transição { estado: { simbolo: destino } }
    this.estadoInicial = null;          // q0: Estado inicial
    this.estadosAceitacao = new Set();  // F: Conjunto de estados de aceitação (finais)

    // Posições visuais dos estados no editor gráfico { estado: { x, y } }
    this.posicoes = {};

    // ========================================================================
    // Variáveis principais da simulação (Seção 2.1 do PDF)
    // ========================================================================
    this.estadoAtual = null;            // 1. O estado atual do autômato
    this.cadeiaRestante = "";           // 2. Símbolos da cadeia que ainda precisam ser lidos

    // Variáveis auxiliares para visualização passo a passo
    this.cadeiaOriginal = "";
    this.cadeiaLida = "";
    this.indiceAtual = 0;
    this.historicoPassos = [];
    this.statusSimulacao = "PARADO";    // "PARADO" | "EM_ANDAMENTO" | "ACEITA" | "REJEITA"
    this.motivoRejeicao = null;
    this.ultimaTransicao = null;        // { de, simbolo, para }
  }

  // ==========================================================================
  // Métodos de Edição da Estrutura do Autômato
  // ==========================================================================

  limpar() {
    this.estados.clear();
    this.alfabeto.clear();
    this.transicoes = {};
    this.estadoInicial = null;
    this.estadosAceitacao.clear();
    this.posicoes = {};
    this.reiniciarSimulacao("");
  }

  adicionarEstado(nome, opcoes = {}) {
    const id = String(nome).trim();
    if (!id) return false;

    this.estados.add(id);
    if (!this.transicoes[id]) {
      this.transicoes[id] = {};
    }

    if (opcoes.inicial || this.estados.size === 1) {
      if (opcoes.inicial !== false && !this.estadoInicial) {
        this.estadoInicial = id;
      }
      if (opcoes.inicial === true) {
        this.estadoInicial = id;
      }
    }

    if (opcoes.aceitacao) {
      this.estadosAceitacao.add(id);
    }

    if (typeof opcoes.x === "number" && typeof opcoes.y === "number") {
      this.posicoes[id] = { x: opcoes.x, y: opcoes.y };
    } else if (!this.posicoes[id]) {
      // Calcula posição padrão em círculo/grade
      const idx = this.estados.size - 1;
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      this.posicoes[id] = {
        x: 180 + col * 170,
        y: 180 + row * 150 + (col % 2 === 1 ? 30 : 0)
      };
    }

    this.recalcularAlfabeto();
    return true;
  }

  removerEstado(nome) {
    if (!this.estados.has(nome)) return false;

    this.estados.delete(nome);
    this.estadosAceitacao.delete(nome);
    delete this.transicoes[nome];
    delete this.posicoes[nome];

    // Remove transições que apontam para o estado removido
    for (const origem of Object.keys(this.transicoes)) {
      for (const [simbolo, destino] of Object.entries(this.transicoes[origem])) {
        if (destino === nome) {
          delete this.transicoes[origem][simbolo];
        }
      }
    }

    if (this.estadoInicial === nome) {
      this.estadoInicial = this.estados.size > 0 ? Array.from(this.estados)[0] : null;
    }

    this.recalcularAlfabeto();
    this.reiniciarSimulacao(this.cadeiaOriginal);
    return true;
  }

  renomearEstado(nomeAntigo, nomeNovo) {
    const novo = String(nomeNovo).trim();
    if (!novo || !this.estados.has(nomeAntigo)) return false;
    if (nomeAntigo === novo) return true;
    if (this.estados.has(novo)) return false; // Já existe

    // Recria mantendo ordem aproximada
    const novosEstados = new Set();
    for (const est of this.estados) {
      novosEstados.add(est === nomeAntigo ? novo : est);
    }
    this.estados = novosEstados;

    this.transicoes[novo] = this.transicoes[nomeAntigo] || {};
    delete this.transicoes[nomeAntigo];

    for (const origem of Object.keys(this.transicoes)) {
      for (const [simbolo, destino] of Object.entries(this.transicoes[origem])) {
        if (destino === nomeAntigo) {
          this.transicoes[origem][simbolo] = novo;
        }
      }
    }

    if (this.estadoInicial === nomeAntigo) {
      this.estadoInicial = novo;
    }

    if (this.estadosAceitacao.has(nomeAntigo)) {
      this.estadosAceitacao.delete(nomeAntigo);
      this.estadosAceitacao.add(novo);
    }

    if (this.posicoes[nomeAntigo]) {
      this.posicoes[novo] = this.posicoes[nomeAntigo];
      delete this.posicoes[nomeAntigo];
    }

    this.reiniciarSimulacao(this.cadeiaOriginal);
    return true;
  }

  definirEstadoInicial(nome) {
    if (!this.estados.has(nome)) return false;
    this.estadoInicial = nome;
    this.reiniciarSimulacao(this.cadeiaOriginal);
    return true;
  }

  alternarEstadoAceitacao(nome) {
    if (!this.estados.has(nome)) return false;
    if (this.estadosAceitacao.has(nome)) {
      this.estadosAceitacao.delete(nome);
    } else {
      this.estadosAceitacao.add(nome);
    }
    this.atualizarStatusFinalSeConcluido();
    return true;
  }

  /**
   * Define uma transição δ(origem, simbolo) = destino.
   * Por ser um AFD, cada par (origem, simbolo) possui no máximo um estado destino.
   */
  definirTransicao(origem, simbolo, destino) {
    const o = String(origem).trim();
    const d = String(destino).trim();
    const s = String(simbolo).trim();

    if (!o || !d || !s) return false;
    if (!this.estados.has(o)) this.adicionarEstado(o);
    if (!this.estados.has(d)) this.adicionarEstado(d);

    // Permite múltiplos símbolos separados por vírgula (ex: "a, b" ou "0,1")
    const simbolos = s.split(",").map(item => item.trim()).filter(Boolean);
    for (const simb of simbolos) {
      this.transicoes[o][simb] = d;
    }

    this.recalcularAlfabeto();
    return true;
  }

  removerTransicao(origem, simbolo) {
    if (!this.transicoes[origem]) return false;
    delete this.transicoes[origem][simbolo];
    this.recalcularAlfabeto();
    return true;
  }

  removerTransicoesEntre(origem, destino) {
    if (!this.transicoes[origem]) return false;
    let removeu = false;
    for (const [simb, dest] of Object.entries(this.transicoes[origem])) {
      if (dest === destino) {
        delete this.transicoes[origem][simb];
        removeu = true;
      }
    }
    this.recalcularAlfabeto();
    return removeu;
  }

  recalcularAlfabeto() {
    this.alfabeto.clear();
    for (const origem of Object.keys(this.transicoes)) {
      for (const simbolo of Object.keys(this.transicoes[origem])) {
        this.alfabeto.add(simbolo);
      }
    }
  }

  // ==========================================================================
  // Lógica de Simulação do AFD (Seção 2.1 do PDF)
  // ==========================================================================

  /**
   * Inicializa a simulação preparando as duas variáveis fundamentais:
   * 1. `estadoAtual` <- estado inicial (q0)
   * 2. `cadeiaRestante` <- cadeia de entrada completa
   */
  iniciarSimulacao(cadeiaEntrada) {
    this.cadeiaOriginal = String(cadeiaEntrada ?? "");
    this.cadeiaRestante = this.cadeiaOriginal;
    this.cadeiaLida = "";
    this.indiceAtual = 0;
    this.estadoAtual = this.estadoInicial;
    this.motivoRejeicao = null;
    this.ultimaTransicao = null;
    this.historicoPassos = [];

    if (!this.estadoInicial || !this.estados.has(this.estadoInicial)) {
      this.statusSimulacao = "REJEITA";
      this.motivoRejeicao = "O autômato não possui um estado inicial definido.";
      return this.obterEstadoSimulacao();
    }

    // Registra o estado inicial no histórico (Passo 0)
    this.historicoPassos.push({
      passo: 0,
      estadoAnterior: null,
      simboloLido: "Início",
      estadoAtual: this.estadoAtual,
      cadeiaLida: "",
      cadeiaRestante: this.cadeiaRestante,
      descricao: `Estado inicial definido como ${this.estadoAtual}.`
    });

    // Caso a cadeia de entrada seja vazia (ε), já podemos verificar aceitação imediata
    if (this.cadeiaRestante.length === 0) {
      if (this.estadosAceitacao.has(this.estadoAtual)) {
        this.statusSimulacao = "ACEITA";
      } else {
        this.statusSimulacao = "REJEITA";
        this.motivoRejeicao = `Fim da cadeia (ε) em '${this.estadoAtual}', que não é estado de aceitação.`;
      }
    } else {
      this.statusSimulacao = "EM_ANDAMENTO";
    }

    return this.obterEstadoSimulacao();
  }

  reiniciarSimulacao(cadeiaEntrada = this.cadeiaOriginal) {
    this.cadeiaOriginal = String(cadeiaEntrada ?? "");
    this.cadeiaRestante = this.cadeiaOriginal;
    this.cadeiaLida = "";
    this.indiceAtual = 0;
    this.estadoAtual = this.estadoInicial;
    this.motivoRejeicao = null;
    this.ultimaTransicao = null;
    this.historicoPassos = [];
    this.statusSimulacao = "PARADO";
    return this.obterEstadoSimulacao();
  }

  /**
   * Processa exatamente UM símbolo da `cadeiaRestante` usando a função de transição δ.
   * Implementa fielmente o algoritmo descrito na Seção 2.1:
   * - Lê o primeiro símbolo de `cadeiaRestante`
   * - Consulta δ(estadoAtual, simbolo)
   * - Atualiza `estadoAtual` e remove o símbolo lido de `cadeiaRestante`
   */
  executarPasso() {
    if (this.statusSimulacao === "PARADO") {
      this.iniciarSimulacao(this.cadeiaOriginal);
      if (this.cadeiaOriginal.length === 0) {
        return this.obterEstadoSimulacao();
      }
    }

    if (this.statusSimulacao === "ACEITA" || this.statusSimulacao === "REJEITA") {
      return this.obterEstadoSimulacao();
    }

    if (this.cadeiaRestante.length === 0) {
      this.verificarCondicaoDeParada();
      return this.obterEstadoSimulacao();
    }

    // 1. Extrai o próximo símbolo da cadeia de entrada que ainda precisa ser lida
    const simboloAtual = this.cadeiaRestante[0];
    const novaCadeiaRestante = this.cadeiaRestante.slice(1);
    const estadoOrigem = this.estadoAtual;

    // 2. Consulta a função de transição do autômato: δ(estadoAtual, simboloAtual)
    const transicoesDoEstado = this.transicoes[estadoOrigem] || {};
    const proximoEstado = transicoesDoEstado[simboloAtual];

    this.indiceAtual += 1;
    this.cadeiaLida += simboloAtual;
    this.cadeiaRestante = novaCadeiaRestante;

    // Se não houver transição definida para o símbolo lido, o AFD rejeita a cadeia
    if (!proximoEstado) {
      this.ultimaTransicao = {
        de: estadoOrigem,
        simbolo: simboloAtual,
        para: null,
        erro: true
      };
      this.estadoAtual = null;
      this.statusSimulacao = "REJEITA";
      this.motivoRejeicao = !this.alfabeto.has(simboloAtual)
        ? `O símbolo '${simboloAtual}' não pertence ao alfabeto Σ = {${Array.from(this.alfabeto).join(", ")}}.`
        : `Transição indefinida: δ(${estadoOrigem}, '${simboloAtual}') não existe.`;

      this.historicoPassos.push({
        passo: this.indiceAtual,
        estadoAnterior: estadoOrigem,
        simboloLido: simboloAtual,
        estadoAtual: "∅ (Indefinido)",
        cadeiaLida: this.cadeiaLida,
        cadeiaRestante: this.cadeiaRestante,
        erro: true,
        descricao: `δ(${estadoOrigem}, '${simboloAtual}') = ∅ → Cadeia rejeitada (transição inexistente).`
      });

      return this.obterEstadoSimulacao();
    }

    // 3. Atualiza o estado atual do autômato
    this.estadoAtual = proximoEstado;
    this.ultimaTransicao = {
      de: estadoOrigem,
      simbolo: simboloAtual,
      para: proximoEstado,
      erro: false
    };

    this.historicoPassos.push({
      passo: this.indiceAtual,
      estadoAnterior: estadoOrigem,
      simboloLido: simboloAtual,
      estadoAtual: this.estadoAtual,
      cadeiaLida: this.cadeiaLida,
      cadeiaRestante: this.cadeiaRestante,
      erro: false,
      descricao: `δ(${estadoOrigem}, '${simboloAtual}') = ${this.estadoAtual}`
    });

    // 4. Se não há mais símbolos na cadeia de entrada, verifica se o estado atual é de aceitação
    if (this.cadeiaRestante.length === 0) {
      this.verificarCondicaoDeParada();
    }

    return this.obterEstadoSimulacao();
  }

  /**
   * Volta um passo na simulação (permite navegar para trás durante a explicação/apresentação).
   */
  voltarPasso() {
    if (this.historicoPassos.length <= 1) {
      return this.reiniciarSimulacao(this.cadeiaOriginal);
    }

    const totalPassosDesejado = this.indiceAtual - 1;
    const cadeia = this.cadeiaOriginal;
    this.iniciarSimulacao(cadeia);

    for (let i = 0; i < totalPassosDesejado; i++) {
      this.executarPasso();
    }

    return this.obterEstadoSimulacao();
  }

  /**
   * Executa toda a cadeia de entrada de uma só vez e retorna o resultado.
   */
  executarTudo(cadeiaEntrada = this.cadeiaOriginal) {
    this.iniciarSimulacao(cadeiaEntrada);
    let limiteSeguranca = 10000;
    while (this.statusSimulacao === "EM_ANDAMENTO" && limiteSeguranca > 0) {
      this.executarPasso();
      limiteSeguranca--;
    }
    return this.obterEstadoSimulacao();
  }

  /**
   * Simula uma cadeia de forma isolada (sem alterar a simulação visual atual),
   * útil para a bateria de testes em lote.
   */
  testarCadeiaRapido(cadeia) {
    if (!this.estadoInicial || !this.estados.has(this.estadoInicial)) {
      return {
        aceita: false,
        estadoFinal: null,
        passos: 0,
        motivo: "Sem estado inicial"
      };
    }

    let estadoAtual = this.estadoInicial;
    let cadeiaRestante = String(cadeia ?? "");
    let passos = 0;

    while (cadeiaRestante.length > 0) {
      const simbolo = cadeiaRestante[0];
      cadeiaRestante = cadeiaRestante.slice(1);
      passos++;

      const proximo = (this.transicoes[estadoAtual] || {})[simbolo];
      if (!proximo) {
        return {
          aceita: false,
          estadoFinal: null,
          passos,
          motivo: `δ(${estadoAtual}, '${simbolo}') indefinida`
        };
      }
      estadoAtual = proximo;
    }

    const aceita = this.estadosAceitacao.has(estadoAtual);
    return {
      aceita,
      estadoFinal: estadoAtual,
      passos,
      motivo: aceita
        ? `Parou no estado de aceitação ${estadoAtual}`
        : `Parou em ${estadoAtual} (não é de aceitação)`
    };
  }

  verificarCondicaoDeParada() {
    if (this.cadeiaRestante.length === 0 && this.estadoAtual !== null) {
      if (this.estadosAceitacao.has(this.estadoAtual)) {
        this.statusSimulacao = "ACEITA";
        this.motivoRejeicao = null;
      } else {
        this.statusSimulacao = "REJEITA";
        this.motivoRejeicao = `Toda a cadeia foi lida, mas o estado final '${this.estadoAtual}' não é um estado de aceitação.`;
      }
    }
  }

  atualizarStatusFinalSeConcluido() {
    if (this.statusSimulacao === "ACEITA" || this.statusSimulacao === "REJEITA") {
      if (this.cadeiaRestante.length === 0 && this.estadoAtual !== null) {
        this.verificarCondicaoDeParada();
      }
    }
  }

  obterEstadoSimulacao() {
    return {
      estadoAtual: this.estadoAtual,
      cadeiaRestante: this.cadeiaRestante,
      cadeiaLida: this.cadeiaLida,
      cadeiaOriginal: this.cadeiaOriginal,
      indiceAtual: this.indiceAtual,
      proximoSimbolo: this.cadeiaRestante.length > 0 ? this.cadeiaRestante[0] : null,
      status: this.statusSimulacao,
      motivoRejeicao: this.motivoRejeicao,
      ultimaTransicao: this.ultimaTransicao,
      historicoPassos: [...this.historicoPassos]
    };
  }

  /**
   * Verifica propriedades do AFD (se possui estado inicial, estados finais e se a função δ é total).
   */
  validarAFD() {
    const avisos = [];
    const alfabetoArr = Array.from(this.alfabeto).sort();

    if (this.estados.size === 0) {
      avisos.push("O autômato não possui estados.");
    }
    if (!this.estadoInicial) {
      avisos.push("Nenhum estado inicial foi definido.");
    }
    if (this.estadosAceitacao.size === 0) {
      avisos.push("Nenhum estado de aceitação (final) foi definido (o AFD rejeitará todas as cadeias).");
    }

    const transicoesFaltantes = [];
    for (const estado of this.estados) {
      for (const simbolo of alfabetoArr) {
        if (!this.transicoes[estado] || !this.transicoes[estado][simbolo]) {
          transicoesFaltantes.push(`δ(${estado}, '${simbolo}')`);
        }
      }
    }

    return {
      valido: this.estados.size > 0 && Boolean(this.estadoInicial),
      completo: transicoesFaltantes.length === 0 && alfabetoArr.length > 0,
      transicoesFaltantes,
      avisos
    };
  }

  // ==========================================================================
  // Importação e Exportação em JSON (Compatível com a Seção 2.1 do PDF)
  // ==========================================================================

  /**
   * Exporta o AFD em formato JSON.
   * @param {"pdf" | "completo"} formato
   * - "pdf": Exporta exatamente na estrutura mostrada na página 3 do PDF:
   *   {
   *     "q0": { "a": "q1", "b": "q0" },
   *     "q1": { "a": "q0", "b": "q1" }
   *   }
   * - "completo": Inclui estadoInicial, estadosAceitacao, transicoes e posicoes visuais.
   */
  exportarJSON(formato = "pdf") {
    if (formato === "pdf") {
      const objSimples = {};
      for (const estado of this.estados) {
        objSimples[estado] = { ...(this.transicoes[estado] || {}) };
      }
      return JSON.stringify(objSimples, null, 2);
    }

    const objCompleto = {
      estadoInicial: this.estadoInicial,
      estadosAceitacao: Array.from(this.estadosAceitacao),
      alfabeto: Array.from(this.alfabeto).sort(),
      estados: Array.from(this.estados),
      transicoes: {},
      posicoes: this.posicoes
    };

    for (const estado of this.estados) {
      objCompleto.transicoes[estado] = { ...(this.transicoes[estado] || {}) };
    }

    return JSON.stringify(objCompleto, null, 2);
  }

  /**
   * Importa um AFD a partir de uma string ou objeto JSON.
   * Reconhece automaticamente:
   * 1. O formato direto da página 3 do PDF:
   *    { "q0": { "a": "q1", "b": "q0" }, "q1": { "a": "q0", "b": "q1" } }
   * 2. O formato completo com metadados (`estadoInicial`, `estadosAceitacao`, `transicoes`, etc.)
   */
  importarJSON(entradaJSON, opcoesExtras = {}) {
    let dados;
    if (typeof entradaJSON === "string") {
      dados = JSON.parse(entradaJSON);
    } else {
      dados = entradaJSON;
    }

    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new Error("O JSON fornecido deve ser um objeto válido.");
    }

    this.limpar();

    // Verifica se é o formato completo ou o formato simplificado do PDF
    const ehFormatoCompleto =
      "transicoes" in dados ||
      "transitions" in dados ||
      "estadoInicial" in dados ||
      "initialState" in dados ||
      "estadosAceitacao" in dados ||
      "acceptStates" in dados;

    if (ehFormatoCompleto) {
      const mapaTransicoes = dados.transicoes || dados.transitions || {};
      const listaEstados = dados.estados || dados.states || Object.keys(mapaTransicoes);
      const posicoesSalvas = dados.posicoes || dados.positions || {};

      for (const est of listaEstados) {
        this.adicionarEstado(est, posicoesSalvas[est] ? { x: posicoesSalvas[est].x, y: posicoesSalvas[est].y } : {});
      }

      for (const [origem, trans] of Object.entries(mapaTransicoes)) {
        if (!this.estados.has(origem)) {
          this.adicionarEstado(origem, posicoesSalvas[origem] || {});
        }
        if (trans && typeof trans === "object") {
          for (const [simbolo, destino] of Object.entries(trans)) {
            if (typeof destino === "string") {
              this.definirTransicao(origem, simbolo, destino);
            }
          }
        }
      }

      const inicial = dados.estadoInicial || dados.initialState || dados.initial;
      if (inicial && this.estados.has(inicial)) {
        this.estadoInicial = inicial;
      }

      const finais = dados.estadosAceitacao || dados.acceptStates || dados.finals || [];
      if (Array.isArray(finais)) {
        for (const f of finais) {
          if (this.estados.has(f)) {
            this.estadosAceitacao.add(f);
          }
        }
      }
    } else {
      // Formato simplificado do PDF (Página 3):
      // Cada chave na raiz é um estado e seu valor é um objeto { simbolo: estadoDestino }
      const chavesEstados = Object.keys(dados);
      if (chavesEstados.length === 0) {
        throw new Error("O objeto JSON não contém estados.");
      }

      for (const est of chavesEstados) {
        if (typeof dados[est] !== "object" || dados[est] === null || Array.isArray(dados[est])) {
          throw new Error(`O valor do estado '${est}' deve ser um objeto de transições.`);
        }
        this.adicionarEstado(est);
      }

      for (const [origem, trans] of Object.entries(dados)) {
        for (const [simbolo, destino] of Object.entries(trans)) {
          if (typeof destino !== "string") {
            throw new Error(`O destino de δ(${origem}, '${simbolo}') deve ser o nome de um estado (string).`);
          }
          this.definirTransicao(origem, simbolo, destino);
        }
      }

      // Define estado inicial padrão (primeiro estado ou 'q0')
      const primeiroEstado = this.estados.has("q0") ? "q0" : chavesEstados[0];
      this.estadoInicial = opcoesExtras.estadoInicial || primeiroEstado;

      // Se for exatamente o exemplo do PDF (q0 e q1) ou se opcoesExtras informar estados de aceitação:
      if (Array.isArray(opcoesExtras.estadosAceitacao)) {
        for (const f of opcoesExtras.estadosAceitacao) {
          if (this.estados.has(f)) this.estadosAceitacao.add(f);
        }
      } else {
        // Por padrão no formato simplificado do PDF (onde q0 no diagrama da pág. 3 tem círculo duplo),
        // marcamos o primeiro estado (ex: q0) como aceitação, podendo ser alterado no editor visual.
        this.estadosAceitacao.add(this.estadoInicial);
      }
    }

    this.recalcularAlfabeto();
    this.reiniciarSimulacao("");
    return true;
  }
}

// Exemplos pré-configurados para demonstração e testes
const EXEMPLOS_AFD = {
  pdf_pag3: {
    titulo: "Número par de 'a's sobre {a, b}",
    descricao: "Aceita cadeias sobre o alfabeto {a, b} que possuem uma quantidade par de símbolos 'a' (incluindo zero).",
    cadeiaSugerida: "abbaab",
    testesSugeridos: [
      { cadeia: "", esperado: true, nota: "Cadeia vazia (0 'a's = par)" },
      { cadeia: "b", esperado: true, nota: "Apenas 'b' (0 'a's = par)" },
      { cadeia: "a", esperado: false, nota: "1 'a' (ímpar)" },
      { cadeia: "aa", esperado: true, nota: "2 'a's (par)" },
      { cadeia: "aba", esperado: true, nota: "2 'a's e 1 'b' (par)" },
      { cadeia: "abbaab", esperado: false, nota: "3 'a's (ímpar)" },
      { cadeia: "abbaaa", esperado: true, nota: "4 'a's e 2 'b's (par)" }
    ],
    jsonPDF: {
      "q0": { "a": "q1", "b": "q0" },
      "q1": { "a": "q0", "b": "q1" }
    },
    completo: {
      estadoInicial: "q0",
      estadosAceitacao: ["q0"],
      estados: ["q0", "q1"],
      transicoes: {
        "q0": { "a": "q1", "b": "q0" },
        "q1": { "a": "q0", "b": "q1" }
      },
      posicoes: {
        "q0": { x: 240, y: 230 },
        "q1": { x: 500, y: 230 }
      }
    }
  },

  termina_ab: {
    titulo: "Cadeias que terminam com 'ab'",
    descricao: "Reconhece todas as cadeias sobre o alfabeto {a, b} cujo sufixo é exatamente 'ab'.",
    cadeiaSugerida: "aabab",
    testesSugeridos: [
      { cadeia: "ab", esperado: true },
      { cadeia: "aabab", esperado: true },
      { cadeia: "bbab", esperado: true },
      { cadeia: "aba", esperado: false },
      { cadeia: "abba", esperado: false },
      { cadeia: "", esperado: false }
    ],
    completo: {
      estadoInicial: "q0",
      estadosAceitacao: ["q2"],
      estados: ["q0", "q1", "q2"],
      transicoes: {
        "q0": { "a": "q1", "b": "q0" },
        "q1": { "a": "q1", "b": "q2" },
        "q2": { "a": "q1", "b": "q0" }
      },
      posicoes: {
        "q0": { x: 170, y: 230 },
        "q1": { x: 380, y: 230 },
        "q2": { x: 590, y: 230 }
      }
    }
  },

  divisivel_por_3: {
    titulo: "Binário Divisível por 3",
    descricao: "Reconhece números binários sobre {0, 1} cujo valor decimal é múltiplo de 3 (q0 = resto 0, q1 = resto 1, q2 = resto 2).",
    cadeiaSugerida: "110",
    testesSugeridos: [
      { cadeia: "0", esperado: true, nota: "0 em decimal" },
      { cadeia: "11", esperado: true, nota: "3 em decimal" },
      { cadeia: "110", esperado: true, nota: "6 em decimal" },
      { cadeia: "1001", esperado: true, nota: "9 em decimal" },
      { cadeia: "10", esperado: false, nota: "2 em decimal" },
      { cadeia: "101", esperado: false, nota: "5 em decimal" }
    ],
    completo: {
      estadoInicial: "q0",
      estadosAceitacao: ["q0"],
      estados: ["q0", "q1", "q2"],
      transicoes: {
        "q0": { "0": "q0", "1": "q1" },
        "q1": { "0": "q2", "1": "q0" },
        "q2": { "0": "q1", "1": "q2" }
      },
      posicoes: {
        "q0": { x: 170, y: 230 },
        "q1": { x: 380, y: 150 },
        "q2": { x: 590, y: 230 }
      }
    }
  },

  contem_010: {
    titulo: "Contém a subcadeia '010'",
    descricao: "Aceita qualquer cadeia binária sobre {0, 1} que contenha pelo menos uma ocorrência da subcadeia '010'.",
    cadeiaSugerida: "100101",
    testesSugeridos: [
      { cadeia: "010", esperado: true },
      { cadeia: "100101", esperado: true },
      { cadeia: "0010", esperado: true },
      { cadeia: "0110", esperado: false },
      { cadeia: "111", esperado: false },
      { cadeia: "", esperado: false }
    ],
    completo: {
      estadoInicial: "q0",
      estadosAceitacao: ["q3"],
      estados: ["q0", "q1", "q2", "q3"],
      transicoes: {
        "q0": { "0": "q1", "1": "q0" },
        "q1": { "0": "q1", "1": "q2" },
        "q2": { "0": "q3", "1": "q0" },
        "q3": { "0": "q3", "1": "q3" }
      },
      posicoes: {
        "q0": { x: 130, y: 230 },
        "q1": { x: 295, y: 230 },
        "q2": { x: 460, y: 230 },
        "q3": { x: 625, y: 230 }
      }
    }
  }
};

window.SimuladorAFD = SimuladorAFD;
window.EXEMPLOS_AFD = EXEMPLOS_AFD;
