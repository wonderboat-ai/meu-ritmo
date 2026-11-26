import assert from 'node:assert/strict';
import test from 'node:test';
import { montarDevolutiva } from '../public/devolutiva.mjs';
import { OPCOES, responder, resumir } from '../public/motor.mjs';

function prepararDados(respostasPorTema) {
  const rodada = { itens: [], respostas: new Map(), destaques: new Set() };
  const escolhas = [];
  for (const [indice, respostas] of respostasPorTema.entries()) {
    const tema = 'Tema ' + String.fromCharCode(65 + indice);
    for (const [numero, opcao] of respostas.entries()) {
      const id = String.fromCharCode(65 + indice) + '0' + (numero + 1);
      rodada.itens.push({ id, tema, texto: `Pergunta original ${id} com acentuação?` });
      escolhas.push([id, OPCOES[opcao]]);
    }
  }
  for (const [id, opcao] of escolhas) responder(rodada, id, opcao);
  return resumir(rodada);
}

test('ordena pelas proporções exatas, preserva empates e usa as respostas originais', () => {
  const dados = prepararDados([
    [2, 3, 0, 1], [2, 3, 1, 4, 5], [3, 0, 4, 5],
    [3, 4, 4, 5], [0, 1, 4, 5], [2, 0, 1, 1],
  ]);
  const antes = structuredClone(dados);
  const { ranking, temasSemPosicao, exemplos, recorrentes, leitura } = montarDevolutiva(dados);

  assert.deepEqual(ranking.map(({ tema, posicao, recorrentes, frequencias }) => [tema, posicao, recorrentes, frequencias]), [
    ['Tema B', 1, 2, 3], ['Tema A', 2, 2, 4], ['Tema C', 2, 1, 2], ['Tema F', 4, 1, 4],
  ]);
  assert.equal(recorrentes, 7);
  assert.match(leitura, /7 das 16 situações/);
  assert.match(leitura, /Tema B/);
  assert.equal(ranking[2].poucasRespostas, true);
  assert.deepEqual(temasSemPosicao.map(({ tema, naoVividas, pulos }) => [tema, naoVividas, pulos]), [
    ['Tema D', 2, 1], ['Tema E', 1, 1],
  ]);
  assert.deepEqual(exemplos, [dados.temas[1].itens[1], dados.temas[0].itens[1]]);
  assert.deepEqual(dados, antes);
});

test('mostra uma resposta frequente isolada sem ordenar o tema', () => {
  const devolutiva = montarDevolutiva(prepararDados([[3, 4, 4, 5], [0, 1, 4, 5]]));
  assert.equal(devolutiva.ranking.length, 0);
  assert.equal(devolutiva.temasSemPosicao[0].frequencias, 1);
  assert.equal(devolutiva.exemplos[0].resposta, OPCOES[3]);
  assert.match(devolutiva.leitura, /pelo menos duas situações com frequência informada/);
});

test('explica quando todas as respostas são pulos, situações não vividas ou frequências menores', () => {
  const semFrequencias = montarDevolutiva(prepararDados([[4, 4, 5, 5]]));
  const frequenciasMenores = montarDevolutiva(prepararDados([[0, 1, 4, 5]]));
  for (const devolutiva of [semFrequencias, frequenciasMenores]) {
    assert.deepEqual(devolutiva.ranking, []);
    assert.deepEqual(devolutiva.exemplos, []);
    assert.equal(devolutiva.recorrentes, 0);
  }
  assert.match(semFrequencias.leitura, /sem escolher frequências/);
  assert.match(frequenciasMenores.leitura, /“Nunca” ou “Às vezes”/);
});
