import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [css, cssAtelie] = await Promise.all(["estilo.css", "atelier.css"].map(
  nome => readFile(new URL("../public/" + nome, import.meta.url), "utf8")));

function bloco(seletor, folha = css) {
  const inicio = folha.indexOf(seletor + " {");
  assert.notEqual(inicio, -1, "Seletor ausente: " + seletor);
  return folha.slice(inicio, folha.indexOf("}", inicio));
}

function paleta(seletor, folha) {
  return Object.fromEntries(Array.from(bloco(seletor, folha).matchAll(/--([\w-]+):\s*(#[\da-f]{3,6})\b/gi),
    ([, chave, valor]) => [chave, valor]));
}

// Luminância relativa sRGB, linearizada antes da soma ponderada (WCAG 2.2).
function luminancia(cor) {
  let hex = cor.slice(1);
  if (hex.length === 3) hex = [...hex].map(char => char + char).join("");
  const [r, g, b] = hex.match(/../g).map(par => {
    const canal = Number.parseInt(par, 16) / 255;
    return canal <= .04045 ? canal / 12.92 : ((canal + .055) / 1.055) ** 2.4;
  });
  return r * .2126 + g * .7152 + b * .0722;
}

function verificar(p, primeiro, segundo, minimo) {
  const a = luminancia(p[primeiro]);
  const b = luminancia(p[segundo]);
  const razao = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  assert.ok(razao >= minimo, primeiro + "/" + segundo + ": " + razao.toFixed(3) + " < " + minimo);
}

const temas = { claro: ":root", escuro: ':root[data-tema="escuro"]', altoContraste: ':root[data-tema="contraste"]' };
for (const [tema, seletor] of Object.entries(temas)) {
  test("contraste de texto, componentes, seleção e foco no tema " + tema, () => {
    const p = paleta(seletor);
    for (const fundo of ["bg", "paper", "wash", "selection"]) {
      for (const texto of ["ink", "soft", "accent"]) verificar(p, texto, fundo, 4.5);
      for (const componente of ["edge", "focus"]) verificar(p, componente, fundo, 3);
    }
    verificar(p, "on-accent", "accent", 4.5);
    verificar(p, "accent", "selection", 3);
    verificar(p, "accent", "wash", 3); // Barra e trilho de progresso.
  });
  test("rótulos, controles e foco contrastam com todo o gradiente do ateliê em " + tema, () => {
    const seletorAtelie = tema === "claro" ? "#atelier" : seletor + " #atelier";
    const p = { ...paleta(seletor), ...paleta(seletorAtelie, cssAtelie) };
    // Os três pontos do gradiente variam no mesmo sentido em todos os canais
    // sRGB deste tema. Seus extremos, portanto, limitam a luminância do fundo.
    for (const fundo of ["atelier-btn", "atelier-sky", "atelier-cloud", "atelier-ground"]) {
      verificar(p, "atelier-ink", fundo, 4.5);
      verificar(p, "atelier-line", fundo, 3);
      verificar(p, "focus", fundo, 3);
    }
  });
}

test("o foco tem espaço externo que o separa de botões preenchidos", () => {
  const regra = bloco(":where(a, button, input, summary, [tabindex]):focus-visible");
  assert.match(regra, /outline:\s*3px solid var\(--focus\)/);
  assert.match(regra, /outline-offset:\s*3px/);
  assert.match(regra, /box-shadow:\s*0 0 0 3px var\(--bg\)/);
});

test("o tema escuro do sistema usa os mesmos pares já verificados na escolha manual", () => {
  assert.deepEqual(paleta(':root:not([data-tema]), :root[data-tema="sistema"]'), paleta(temas.escuro));
});
