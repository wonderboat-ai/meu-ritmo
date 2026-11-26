import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const origem = "http://meu-ritmo.localhost";
const tipos = {
  ".html": "text/html", ".css": "text/css", ".mjs": "text/javascript",
  ".txt": "text/plain", ".svg": "image/svg+xml", ".webp": "image/webp",
};

let navegador;
before(async () => {
  navegador = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH && { executablePath: process.env.CHROME_PATH }),
  });
});
after(async () => { await navegador?.close(); });

// A página recebe os próprios arquivos estáticos, sem abrir portas ou alcançar a internet.
async function servirArquivo(route) {
  const url = new URL(route.request().url());
  if (url.origin !== origem) return route.abort();
  const caminho = resolve(publicDir, "." + (url.pathname === "/" ? "/index.html" : url.pathname));
  const tipo = tipos[extname(caminho)];
  if (!tipo || !caminho.startsWith(resolve(publicDir) + sep)) return route.abort();
  await route.fulfill({ body: await readFile(caminho), contentType: tipo });
}

async function verificarTela(pagina, tela) {
  // Tab ativa a modalidade de teclado. O foco programático inspeciona também as
  // alternativas alcançáveis por setas, que não recebem tabulação individual.
  await pagina.keyboard.press("Tab");
  const resultado = await pagina.evaluate(() => {
    const dialogo = document.querySelector("dialog[open]");
    const escopo = dialogo || document;
    const controles = [...escopo.querySelectorAll('button,input,summary,a[href],[tabindex="0"]')].filter(el =>
      !el.disabled && el.checkVisibility() && el.getClientRects().length > 0);
    const falhas = [];
    // Verifica texto sobre superfícies CSS sólidas. Ilustrações, marca gráfica
    // e o desenho do canvas permanecem fora desta medição de texto.
    const textoVisivel = (el) => el.checkVisibility() &&
      !el.closest('svg,canvas,script,style,template,noscript,.sr-only,[aria-hidden="true"],:disabled') &&
      [...el.childNodes].some(no => no.nodeType === Node.TEXT_NODE && no.textContent.trim());
    function corSrgb(valor) {
      const numeros = valor.match(/^rgba?\(([^)]+)\)$/);
      return numeros ? numeros[1].split(",").map(Number) : null;
    }
    function fundoSolido(el) {
      for (let atual = el; atual; atual = atual.parentElement) {
        const estilo = getComputedStyle(atual);
        if (estilo.backgroundImage !== "none") return null;
        const cor = corSrgb(estilo.backgroundColor);
        if (!cor || (cor.length === 4 && cor[3] > 0 && cor[3] < 1)) return null;
        if (cor.length === 3 || cor[3] === 1) return cor;
      }
      return null;
    }
    function luminancia(rgb) {
      const linear = rgb.slice(0, 3).map(n => n / 255).map(n =>
        n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    }
    let textos = 0;
    for (const el of escopo.querySelectorAll("*")) {
      if (!textoVisivel(el)) continue;
      const fundo = fundoSolido(el);
      const cor = corSrgb(getComputedStyle(el).color);
      if (!fundo || !cor || cor[3] < 1) continue;
      const a = luminancia(cor), b = luminancia(fundo);
      const razao = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      textos++;
      if (razao < 4.5) falhas.push(el.tagName + " “" + el.textContent.trim().slice(0, 32) +
        "”: contraste do texto " + razao.toFixed(2) + ":1.");
    }
    for (const [indice, controle] of controles.entries()) {
      controle.focus();
      const alvo = controle.matches("input") ? controle.labels[0] || controle : controle;
      const area = alvo.getBoundingClientRect();
      const nome = controle.getAttribute("aria-label") || controle.textContent.trim() || controle.getAttribute("name");
      const identificacao = controle.tagName + " " + (nome || (indice + 1));
      const estilo = getComputedStyle(controle);
      if (document.activeElement !== controle || estilo.outlineStyle === "none" || parseFloat(estilo.outlineWidth) < 2) {
        falhas.push(identificacao + ": sem contorno de foco de ao menos 2 px.");
      }
      if (area.width < 43.99 || area.height < 43.99) {
        falhas.push(identificacao + ": área de ação menor que 44 × 44 px.");
      }
      const esquerda = Math.max(0, area.left);
      const direita = Math.min(innerWidth, area.right);
      const topo = Math.max(0, area.top);
      const base = Math.min(innerHeight, area.bottom);
      const centro = document.elementFromPoint((esquerda + direita) / 2, (topo + base) / 2);
      if (direita <= esquerda || base <= topo || !alvo.contains(centro)) {
        falhas.push(identificacao + ": centro da área visível fora do alvo.");
      }
    }
    const raiz = document.documentElement;
    if (raiz.scrollWidth > raiz.clientWidth) falhas.push("Rolagem horizontal na página.");
    if (dialogo && dialogo.scrollWidth > dialogo.clientWidth) falhas.push("Rolagem horizontal nos ajustes.");
    return { quantidade: controles.length, textos, falhas };
  });
  assert.ok(resultado.quantidade > 0, tela + ": a tela precisa apresentar controles.");
  assert.ok(resultado.textos > 0, tela + ": a leitura deve incluir texto sobre superfície sólida.");
  assert.deepEqual(resultado.falhas, [], tela);
  return resultado.quantidade;
}

const modos = [
  { nome: "claro", tema: "claro", forcedColors: "none" },
  { nome: "escuro", tema: "escuro", forcedColors: "none" },
  { nome: "alto contraste", tema: "contraste", forcedColors: "none" },
  { nome: "cores forçadas do sistema", tema: "contraste", forcedColors: "active" },
];

for (const modo of modos) {
  test("320 px, fonte a 200%, espaçamento amplo e ateliê 3D em " + modo.nome, async t => {
    const contexto = await navegador.newContext({
      locale: "pt-BR", viewport: { width: 320, height: 720 }, deviceScaleFactor: 1,
      forcedColors: modo.forcedColors, reducedMotion: "reduce",
    });
    t.after(() => contexto.close());
    await contexto.route("**/*", servirArquivo);
    const pagina = await contexto.newPage();
    const cdp = await contexto.newCDPSession(pagina);
    await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
    await pagina.goto(origem);
    const botao = nome => pagina.getByRole("button", { name: nome, exact: true });
    const ajustes = botao("Ajustar leitura");
    await ajustes.click();
    await pagina.locator('input[name="tema"][value="' + modo.tema + '"]').check();
    await pagina.locator('input[name="espacamento"][value="amplo"]').check();
    await botao("Concluir ajustes").click();
    assert.deepEqual(await pagina.evaluate(() => ({
      largura: innerWidth, fonte: getComputedStyle(document.documentElement).fontSize,
      coresForcadas: matchMedia("(forced-colors: active)").matches,
    })), { largura: 320, fonte: "36px", coresForcadas: modo.forcedColors === "active" });

    let controles = 0;
    let telas = 0;
    async function conferir(nome) {
      controles += await verificarTela(pagina, nome);
      telas++;
    }
    await conferir("Início");
    const atelie = pagina.locator("#atelier");
    const objeto = atelie.locator('canvas[role="img"]');
    assert.equal(await objeto.isVisible(), true);
    assert.equal(await objeto.getAttribute("tabindex"), "0");
    const maisAjustes = atelie.locator("summary", { hasText: "Mais ajustes do objeto" });
    await maisAjustes.click();
    const suaves = atelie.getByRole("checkbox", { name: "Cores suaves", exact: true });
    await suaves.check();
    await atelie.getByRole("button", { name: "Inclinar para cima", exact: true }).click();
    await atelie.getByRole("button", { name: "Inclinar para baixo", exact: true }).click();
    await conferir("Início com mais ajustes do objeto abertos");
    await suaves.uncheck();
    await maisAjustes.click();
    await atelie.getByRole("button", { name: "Girar à direita", exact: true }).click();
    await atelie.getByRole("button", { name: "Ocultar objeto 3D", exact: true }).click();
    assert.equal(await objeto.isVisible(), false);
    await conferir("Início com objeto oculto");
    await atelie.getByRole("button", { name: "Mostrar objeto 3D", exact: true }).click();
    await atelie.getByRole("button", { name: "Restaurar posição", exact: true }).click();
    await ajustes.click();
    await conferir("Ajustes de leitura");
    await pagina.keyboard.press("Escape");
    await botao("Começar").click();
    await conferir("Confirmação de idade");
    await pagina.getByLabel("Tenho 18 anos ou mais").check();
    await botao("Iniciar questionário").click();
    await conferir("Pergunta");
    await pagina.getByRole("radio", { name: "Nunca", exact: true }).check();
    await botao("Pausar").click();
    await conferir("Pausa");
    await botao("Continuar de onde parei").click();
    await botao("Apagar e sair").click();
    await conferir("Confirmação de exclusão");
    await botao("Voltar sem apagar").click();

    // Exercita os controles do formulário com escolhas sintéticas até o resumo.
    await pagina.evaluate(() => {
      for (let i = 0; i < 50; i++) {
        document.querySelectorAll('input[name="frequencia"]')[i % 2 ? 2 : 3].click();
        document.querySelector(".flow-form button[type=submit]").click();
      }
    });
    await botao("Revisar respostas").waitFor();
    assert.equal(await botao("Baixar PDF completo").isVisible(), true);
    assert.equal(await pagina.locator("[data-ranking] [data-tema-ranking]").count(), 12);
    await conferir("Resumo");
    await botao("Revisar respostas").click();
    await conferir("Revisão");
    await pagina.locator('nav [data-go="sobre"]').click();
    await conferir("Sobre autismo e TDAH");
    await pagina.locator('footer [data-go="privacidade"]').click();
    await conferir("Privacidade");
    assert.equal(telas, 12);
    t.diagnostic(telas + " estados de tela e " + controles + " ocorrências de controles visíveis conferidas.");
  });
}
