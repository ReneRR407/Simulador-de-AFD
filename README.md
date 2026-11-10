# Projeto 01 – Linguagens Regulares: Simulador e Editor Visual de AFD (Seção 2.1)

Aplicação web interativa desenvolvida para a disciplina de **Linguagens Formais e Computabilidade (LFC)**, implementando o **Projeto 2.1 (Simulador de AFD)** integrado ao **Editor Gráfico e Importação/Exportação em JSON**.

---

## Como Executar

Não é necessário instalar dependências externas. Basta abrir o arquivo [`index.html`](./index.html) diretamente em qualquer navegador moderno (Chrome, Edge, Firefox) ou utilizar uma extensão como *Live Server* no VS Code.

---

## Conexão com os Conceitos da Seção 2.1 do PDF

Conforme descrito pelo Prof. Andrei Formiga na **Seção 2.1 (Simuladores)** do documento de especificação:

> *"Um simulador de AFD é simples de fazer: a ideia geral é guardar em variáveis:*
> *1. o estado atual do autômato*
> *2. quais símbolos da cadeia de entrada ainda precisam ser lidas*
> *e processar cada símbolo separadamente, usando a função de transição do autômato para decidir qual será o próximo estado."*

Na implementação em [`js/afd.js`](./js/afd.js) (classe `SimuladorAFD`), essas duas variáveis estão explicitamente modeladas e visíveis em tempo real na interface:

1. **`this.estadoAtual`**: inicia em $q_0$ (`estadoInicial`) e é atualizado a cada passo com o resultado de $\delta(\text{estadoAtual}, \text{símbolo})$.
2. **`this.cadeiaRestante`**: armazena os símbolos da cadeia de entrada que ainda precisam ser processados. Em cada chamada de `executarPasso()`, o primeiro símbolo (`cadeiaRestante[0]`) é consumido e a cadeia restante passa a ser `cadeiaRestante.slice(1)`.
3. **Critério de Parada e Aceitação**: quando `cadeiaRestante` torna-se vazia ($\varepsilon$), o simulador verifica se `estadoAtual` pertence ao conjunto de estados de aceitação $F$ (`estadosAceitacao`). Caso pertença, a cadeia é **ACEITA**; caso contrário (ou se alguma transição $\delta(q, a)$ não estiver definida), a cadeia é **REJEITADA**.

---

## Especificação em JSON

O simulador suporta nativamente o formato JSON simplificado apresentado na **página 3 do PDF**:

```json
{
  "q0" : { "a" : "q1", "b" : "q0" },
  "q1" : { "a" : "q0", "b" : "q1" }
}
```

Além disso, também suporta o **Formato Completo**, que preserva o estado inicial, o conjunto de estados de aceitação e as coordenadas visuais dos estados no diagrama:

```json
{
  "estadoInicial": "q0",
  "estadosAceitacao": ["q0"],
  "transicoes": {
    "q0": { "a": "q1", "b": "q0" },
    "q1": { "a": "q0", "b": "q1" }
  }
}
```

---

## Estrutura de Arquivos

- [`index.html`](./index.html) — Estrutura da interface web (Editor Visual, Painel de Simulação Passo a Passo, Tabela $\delta$, Painel JSON e Bateria de Testes).
- [`css/styles.css`](./css/styles.css) — Estilização visual dos componentes, animações do autômato e fita de leitura.
- [`js/afd.js`](./js/afd.js) — Núcleo lógico do AFD (`SimuladorAFD`), algoritmo de simulação passo a passo, validação formal e importação/exportação JSON.
- [`js/canvas.js`](./js/canvas.js) — Renderizador e editor gráfico interativo em SVG (criação e arrasto de estados, auto-laços, curvas de Bézier para transições bidirecionais).
- [`js/app.js`](./js/app.js) — Controlador de eventos e sincronização entre o núcleo do AFD e a interface gráfica.
- [`exemplos/exemplo_pdf.json`](./exemplos/exemplo_pdf.json) — Arquivo JSON idêntico ao exemplo da página 3 do PDF.
- [`exemplos/exemplo_completo.json`](./exemplos/exemplo_completo.json) — Arquivo JSON com metadados completos.
