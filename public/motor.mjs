// Regras da rodada. Este módulo não acessa rede, URL, DOM ou armazenamento.
export const OPCOES = Object.freeze([
  "Nunca",
  "Às vezes",
  "Muitas vezes",
  "Quase sempre ou sempre",
  "Não vivi essa situação",
  "Prefiro pular",
]);

const frequencias = new Set(OPCOES.slice(0, 4));
const [naoVivida, pulo] = OPCOES.slice(4);

export function lerBanco(conteudo) {
  const linhas = conteudo.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  if (linhas.length !== 120) throw new Error("O banco precisa conter 120 linhas.");

  const temas = new Map();
  const textos = new Set();
  const itens = linhas.map((linha, indice) => {
    const partes = linha.split(" | ");
    const [id, tema, texto] = partes;
    const letra = String.fromCharCode(65 + Math.floor(indice / 10));
    const idEsperado = letra + String((indice % 10) + 1).padStart(2, "0");
    if (partes.length !== 3 || id !== idEsperado || !tema?.trim() || !texto?.trim()) {
      throw new Error("Linha inválida no banco, na posição " + (indice + 1) + ".");
    }
    if (temas.has(letra) && temas.get(letra) !== tema) {
      throw new Error("Um grupo de IDs possui nomes de tema diferentes.");
    }
    if (textos.has(texto)) throw new Error("Há uma pergunta repetida no banco.");
    temas.set(letra, tema);
    textos.add(texto);
    return Object.freeze({ id, tema, texto });
  });
  if (new Set(temas.values()).size !== 12) throw new Error("O banco precisa conter 12 temas.");
  return Object.freeze(itens);
}

function inteiroSeguro(limite) {
  const amostra = new Uint32Array(1);
  // Descarte o intervalo incompleto antes do módulo para manter índices equiprováveis.
  const teto = 2 ** 32 - (2 ** 32 % limite);
  do {
    globalThis.crypto.getRandomValues(amostra);
  } while (amostra[0] >= teto);
  return amostra[0] % limite;
}

function embaralhar(valores, inteiro) {
  const copia = [...valores];
  for (let fim = copia.length - 1; fim > 0; fim--) {
    const sorteado = inteiro(fim + 1);
    [copia[fim], copia[sorteado]] = [copia[sorteado], copia[fim]];
  }
  return copia;
}

export function criarRodada(banco, idsAnteriores = [], aleatorio) {
  // Nos testes, aleatorio() fornece um valor reproduzível no intervalo [0, 1).
  const inteiro = aleatorio ? limite => Math.floor(aleatorio() * limite) : inteiroSeguro;
  const excluidos = new Set(idsAnteriores);
  const disponiveis = new Map();
  for (const item of banco) {
    if (!disponiveis.has(item.tema)) disponiveis.set(item.tema, []);
    if (!excluidos.has(item.id)) disponiveis.get(item.tema).push(item);
  }

  const temas = [...disponiveis.keys()];
  const extras = new Set(embaralhar(temas, inteiro).slice(0, 2));
  const porTema = new Map();
  for (const tema of temas) {
    const itens = disponiveis.get(tema);
    const quantidade = extras.has(tema) ? 5 : 4;
    if (itens.length < quantidade) throw new Error("Faltam situações disponíveis para este tema.");
    porTema.set(tema, embaralhar(itens, inteiro).slice(0, quantidade));
  }

  const itens = [];
  for (let volta = 0; volta < 5; volta++) {
    const ordem = embaralhar(volta === 4 ? extras : temas, inteiro);
    if (ordem[0] === itens.at(-1)?.tema) {
      const outro = 1 + inteiro(ordem.length - 1);
      [ordem[0], ordem[outro]] = [ordem[outro], ordem[0]];
    }
    for (const tema of ordem) itens.push(porTema.get(tema)[volta]);
  }
  return { itens: Object.freeze(itens), respostas: new Map(), destaques: new Set() };
}

function exigirItem(rodada, id) {
  if (!rodada.itens.some(item => item.id === id)) throw new Error("Situação fora da rodada.");
}

export function responder(rodada, id, opcao) {
  exigirItem(rodada, id);
  if (!OPCOES.includes(opcao)) throw new Error("Escolha uma das seis respostas disponíveis.");
  rodada.respostas.set(id, opcao);
  if (!frequencias.has(opcao)) rodada.destaques.delete(id);
}

export function destacar(rodada, id, ativo) {
  exigirItem(rodada, id);
  if (ativo && frequencias.has(rodada.respostas.get(id))) rodada.destaques.add(id);
  else rodada.destaques.delete(id);
}

function contagemVazia() {
  return { frequencias: 0, naoVividas: 0, pulos: 0, total: 0 };
}

export function resumir(rodada) {
  if (rodada.respostas.size !== rodada.itens.length) {
    throw new Error("Cada situação precisa de uma escolha antes de abrir o resumo.");
  }
  const totais = contagemVazia();
  const grupos = new Map();
  // Os prefixos e números de dois dígitos seguem a ordem canônica do arquivo.
  const ordenados = [...rodada.itens].sort((a, b) => a.id.localeCompare(b.id, "en"));
  for (const item of ordenados) {
    const { id, tema } = item;
    if (!grupos.has(tema)) grupos.set(tema, { tema, ...contagemVazia(), itens: [] });
    const grupo = grupos.get(tema);
    const resposta = rodada.respostas.get(id);
    const categoria = resposta === pulo ? "pulos" : resposta === naoVivida ? "naoVividas" : "frequencias";
    totais[categoria]++;
    grupo[categoria]++;
    totais.total++;
    grupo.total++;
    grupo.itens.push({ ...item, resposta, destacado: rodada.destaques.has(id) });
  }
  return { ...totais, temas: [...grupos.values()] };
}
