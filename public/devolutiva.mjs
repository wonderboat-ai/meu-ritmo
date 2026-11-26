import { OPCOES } from './motor.mjs';

const maisFrequentes = new Set(OPCOES.slice(2, 4));
const minimoParaOrdenar = 2;
const ordemFrequencia = [...maisFrequentes].reverse();

export const ORIENTACAO_CONSULTA = 'Se essas situações afetam sua rotina ou você quer entendê-las melhor, leve o resumo a um psicólogo com formação em neuropsicologia ou a uma clínica com experiência em avaliação de autismo e TDAH em adultos. Pelo SUS, você pode começar pela UBS.';

function compararProporcao(a, b) {
  return b.recorrentes * a.frequencias - a.recorrentes * b.frequencias;
}

function contarTema(grupo) {
  const { tema, frequencias, total, naoVividas, pulos } = grupo;
  const recorrentes = grupo.itens.filter(item => maisFrequentes.has(item.resposta)).length;
  return { tema, frequencias, total, naoVividas, pulos, recorrentes, poucasRespostas: frequencias < 3 };
}

function escolherExemplo(grupo) {
  for (const resposta of ordemFrequencia) {
    const encontrado = grupo.itens.find(item => item.resposta === resposta);
    if (encontrado) return encontrado;
  }
  return null;
}

function descreverDevolutiva(frequencias, recorrentes, ranking) {
  if (!frequencias) return 'Você concluiu a rodada sem escolher frequências.';
  if (!recorrentes) return 'Nas situações com frequência informada, suas escolhas foram “Nunca” ou “Às vezes”.';

  const inicio = recorrentes === 1
    ? 'Você marcou uma das duas maiores frequências em 1 situação.'
    : `Você marcou “Muitas vezes” ou “Quase sempre ou sempre” em ${recorrentes} das ${frequencias} situações com frequência informada.`;
  if (!ranking.length) return inicio + ' Para entrar no ranking, um tema precisa de pelo menos duas situações com frequência informada.';
  const primeiros = ranking.filter(tema => tema.posicao === 1);
  if (primeiros.length > 1 && primeiros.length <= 3) {
    const nomes = new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(primeiros.map(tema => tema.tema));
    return inicio + ` A maior proporção apareceu em ${nomes}, com empate.`;
  }
  if (primeiros.length > 1) return inicio + ` A maior proporção ficou empatada entre ${primeiros.length} temas.`;
  return inicio + ` A maior proporção de respostas frequentes entre os temas ordenados apareceu em “${primeiros[0].tema}”.`;
}

export function montarDevolutiva(dados) {
  const temas = dados.temas.map(contarTema);
  const temasOrdenaveis = temas.filter(tema => tema.frequencias >= minimoParaOrdenar && tema.recorrentes > 0);
  // Produtos cruzados mantêm empates exatos sem arredondar as proporções.
  temasOrdenaveis.sort((a, b) => compararProporcao(a, b) || b.frequencias - a.frequencias);
  const comPosicao = new Map();
  let posicao = 0;
  for (const [indice, tema] of temasOrdenaveis.entries()) {
    if (indice === 0 || compararProporcao(temasOrdenaveis[indice - 1], tema) !== 0) posicao = indice + 1;
    comPosicao.set(tema.tema, { ...tema, posicao });
  }

  const ranking = [...comPosicao.values()];
  const temasSemPosicao = temas.filter(tema => !comPosicao.has(tema.tema));
  const recorrentes = temas.reduce((soma, tema) => soma + tema.recorrentes, 0);
  const porTema = new Map(dados.temas.map(grupo => [grupo.tema, grupo]));
  const exemplos = [...ranking, ...temasSemPosicao]
    .filter(tema => tema.recorrentes > 0)
    .slice(0, 3)
    .map(tema => escolherExemplo(porTema.get(tema.tema)));
  const leitura = descreverDevolutiva(dados.frequencias, recorrentes, ranking);
  return { ranking, temasSemPosicao, exemplos, recorrentes, leitura };
}
