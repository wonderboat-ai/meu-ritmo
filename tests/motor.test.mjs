import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { OPCOES, criarRodada, lerBanco, responder, resumir } from "../public/motor.mjs";

const arquivo = await readFile(new URL("../public/banco-v1.txt", import.meta.url), "utf8");
const banco = lerBanco(arquivo);
const temas = [
  "Conversas", "Convívio e recuperação", "Mudanças e previsibilidade", "Ambiente sensorial",
  "Interesses e envolvimento", "Comunicação de necessidades", "Atenção no cotidiano",
  "Início e retomada de tarefas", "Organização de materiais", "Tempo e compromissos",
  "Ritmo e pausas", "Memória de intenções",
];

// Gerador Mulberry32 para repetição de falhas usando a semente no nome da asserção.
function gerador(semente) {
  return () => {
    let n = semente = (semente + 0x6D2B79F5) | 0;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 2 ** 32;
  };
}

const ids = rodada => rodada.itens.map(item => item.id);

test("os 120 IDs, temas, sinais e textos correspondem à referência original", () => {
  // Referência obtida por segunda transcrição independente das 120 linhas entregues.
  // Não recalcular esta assinatura a partir do arquivo que está sendo testado.
  const canonico = arquivo.replace(/\r\n/g, "\n").replace(/\n$/, "");
  assert.equal(createHash("sha256").update(canonico, "utf8").digest("hex"),
    "f448c333b5b58a4a02968109dbf91621b4b4fd59ba02f9458f6de38b5c783bce");
  assert.equal(banco.length, 120);
  assert.equal(new Set(banco.map(item => item.id)).size, 120);
  assert.equal(new Set(banco.map(item => item.texto)).size, 120);
  for (const [indice, tema] of temas.entries()) {
    const letra = String.fromCharCode(65 + indice);
    const esperados = Array.from({ length: 10 }, (_, i) => letra + String(i + 1).padStart(2, "0"));
    assert.deepEqual(banco.filter(item => item.tema === tema).map(item => item.id), esperados);
  }
});

test("o leitor recusa texto ou ID repetido, tema inconsistente e linhas faltantes", () => {
  assert.throws(() => lerBanco(arquivo.replace(banco[0].texto, banco[1].texto)));
  assert.throws(() => lerBanco(arquivo.replace("A01 |", "A02 |")));
  assert.throws(() => lerBanco(arquivo.replace("A02 | Conversas", "A02 | Ambiente sensorial")));
  assert.throws(() => lerBanco(arquivo.slice(arquivo.indexOf("\n") + 1)));
});

function verificarRodada(rodada, anteriores, contexto) {
  const escolhidos = ids(rodada);
  assert.equal(escolhidos.length, 50, contexto);
  assert.equal(new Set(escolhidos).size, 50, contexto);
  const excluidos = new Set(anteriores);
  assert.ok(escolhidos.every(id => !excluidos.has(id)), contexto);
  assert.deepEqual(temas.map(tema => rodada.itens.filter(item => item.tema === tema).length).sort(),
    [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5], contexto);
  for (let i = 0; i < 50; i += 12) {
    const volta = rodada.itens.slice(i, i + 12);
    assert.equal(new Set(volta.map(item => item.tema)).size, volta.length, contexto);
  }
  assert.ok(rodada.itens.every((item, i, todos) => !i || item.tema !== todos[i - 1].tema), contexto);
  assert.equal(rodada.respostas.size, 0);
}

test("1.000 sementes × três rodadas: cotas, intercalação e exclusão integral da anterior", () => {
  for (let semente = 0; semente < 1000; semente++) {
    let anteriores = [];
    const aleatorio = gerador(semente);
    for (let i = 1; i <= 3; i++) {
      const rodada = criarRodada(banco, anteriores, aleatorio);
      verificarRodada(rodada, anteriores, "Semente " + semente + ", rodada " + i);
      anteriores = ids(rodada);
    }
  }
});

test("o sorteio seguro funciona e o gerador injetado reproduz a mesma sequência", () => {
  verificarRodada(criarRodada(banco), [], "Gerador do sistema");
  assert.deepEqual(ids(criarRodada(banco, [], gerador(42))), ids(criarRodada(banco, [], gerador(42))));
  assert.notDeepEqual(ids(criarRodada(banco, [], gerador(42))), ids(criarRodada(banco, [], gerador(43))));
});

test("as seis alternativas literais mantêm a ordem especificada", () => {
  assert.deepEqual(OPCOES,
    ["Nunca", "Às vezes", "Muitas vezes", "Quase sempre ou sempre", "Não vivi essa situação", "Prefiro pular"]);
});

for (const [indice, opcao] of OPCOES.entries()) {
  test("50 respostas “" + opcao + "” preservam o texto e a categoria de cada item", () => {
    const rodada = criarRodada(banco, [], gerador(10));
    for (const { id } of rodada.itens) responder(rodada, id, opcao);
    const resumo = resumir(rodada);
    assert.equal(resumo.total, 50);
    assert.deepEqual([resumo.frequencias, resumo.naoVividas, resumo.pulos],
      [indice < 4 ? 50 : 0, indice === 4 ? 50 : 0, indice === 5 ? 50 : 0]);
    assert.deepEqual(resumo.temas.map(grupo => grupo.tema), temas);
    for (const grupo of resumo.temas) {
      assert.equal(grupo.total, grupo.itens.length);
      assert.equal(grupo.frequencias + grupo.naoVividas + grupo.pulos, grupo.total);
      for (const item of grupo.itens) {
        assert.equal(item.resposta, opcao);
        assert.equal(item.texto, banco.find(original => original.id === item.id).texto);
      }
    }
  });
}

test("respostas mistas e substituições mantêm totais exatos e a sequência inicial", () => {
  const rodada = criarRodada(banco, [], gerador(5));
  const ordem = ids(rodada);
  rodada.itens.forEach(({ id }, i) => responder(rodada, id, OPCOES[i % 6]));
  const antes = resumir(rodada);
  assert.deepEqual([antes.frequencias, antes.naoVividas, antes.pulos], [34, 8, 8]);
  const ultimo = ordem.at(-1);
  for (const [opcao, esperado] of [
    [OPCOES[0], [34, 8, 8]],
    [OPCOES[4], [33, 9, 8]],
    [OPCOES[5], [33, 8, 9]],
    [OPCOES[3], [34, 8, 8]],
  ]) {
    responder(rodada, ultimo, opcao);
    const resumo = resumir(rodada);
    assert.deepEqual([resumo.frequencias, resumo.naoVividas, resumo.pulos], esperado);
    assert.equal(resumo.total, 50);
    assert.equal(resumo.temas.flatMap(tema => tema.itens).find(item => item.id === ultimo).resposta, opcao);
    assert.deepEqual(ids(rodada), ordem);
  }
});

test("deixar em branco não gera resposta ou resumo", () => {
  const rodada = criarRodada(banco, [], gerador(1));
  const primeiro = rodada.itens[0].id;
  assert.throws(() => responder(rodada, primeiro, ""));
  assert.throws(() => responder(rodada, primeiro, undefined));
  assert.throws(() => responder(rodada, "Z01", "Nunca"));
  assert.throws(() => resumir(rodada));
  assert.equal(rodada.respostas.size, 0);
});
