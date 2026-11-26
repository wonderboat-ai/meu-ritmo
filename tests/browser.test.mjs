import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.txt': 'text/plain', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp' };
const options = ['Nunca', 'Às vezes', 'Muitas vezes', 'Quase sempre ou sempre',
  'Não vivi essa situação', 'Prefiro pular'];
const officialSources = [
  'https://www.autismresearchcentre.com/tests/autism-spectrum-quotient-aq-adult/',
  'https://www.autismresearchcentre.com/research/tests/',
  'https://docs.autismresearchcentre.com/tests/AQ_Portugues_Brasil.pdf',
  'https://license.tov.med.nyu.edu/product/asrs6Qscreener',
  'https://www.who.int/news-room/fact-sheets/detail/Autism-spectrum-disorders',
  'https://www.gov.br/saude/pt-br/assuntos/pcdt/t/transtorno-do-deficit-de-atencao-com-hiperatividade-tdah/view',
  'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/autismo/atencao-especializada'
];
let browser, server, origin, questions;

async function staticResponse(url) {
  const path = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!path.startsWith(resolve(root) + sep)) return { status: 400, body: '', contentType: 'text/plain' };
  try {
    return { status: 200, body: await readFile(path),
      contentType: (types[extname(path)] || 'application/octet-stream') + '; charset=utf-8' };
  } catch { return { status: 404, body: '', contentType: 'text/plain' }; }
}

before(async () => {
  const lines = (await readFile(resolve(root, 'banco-v1.txt'), 'utf8')).trim().split(/\r?\n/);
  questions = new Map(lines.map(line => {
    const [, tema, texto] = line.split(' | ');
    return [texto, tema];
  }));
  server = createServer(async (req, res) => {
    const { status, body, contentType } = await staticResponse(new URL(req.url, 'http://localhost'));
    res.writeHead(status, { 'Content-Type': contentType });
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH && { executablePath: process.env.CHROME_PATH }) });
});
after(async () => {
  if (browser) await browser.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
});

async function open(t, { blocked = false, noCanvas = false, bankGate, ...config } = {}) {
  const context = await browser.newContext({ locale: 'pt-BR', reducedMotion: 'reduce', ...config });
  t.after(() => context.close());
  // Em CI sem sockets de loopback, entrega os mesmos bytes e cabeçalhos diretamente
  // a cada requisição da própria origem, sem alterar a aplicação ou gravar respostas.
  if (process.env.PW_LOCAL_FIXTURES === '1') {
    await context.route(origin + '/**', async route => route.fulfill(await staticResponse(new URL(route.request().url()))));
  }
  if (bankGate) {
    await context.route('**/banco-v1.txt', async route => {
      await bankGate;
      await route.fallback();
    });
  }
  if (blocked) {
    await context.addInitScript(() => {
      for (const key of ['localStorage', 'sessionStorage', 'indexedDB', 'caches']) {
        Object.defineProperty(window, key, { configurable: true, get() { throw new DOMException('Bloqueado', 'SecurityError'); } });
      }
    });
  }
  if (noCanvas) {
    await context.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(4500);
  const trace = { requests: [], console: [], errors: [], sockets: [] };
  page.on('request', req => trace.requests.push({ url: req.url(), method: req.method() }));
  page.on('console', msg => trace.console.push([msg.type(), msg.text()]));
  page.on('pageerror', err => trace.errors.push(err.message));
  page.on('websocket', ws => trace.sockets.push(ws.url()));
  await page.goto(origin, { waitUntil: bankGate ? 'commit' : 'networkidle', timeout: 15000 });
  return { page, context, trace };
}

const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' });
const action = (page, name) => button(page, name).or(page.getByRole('link', { name, exact: true })).first();
const radio = (page, label) => page.getByRole('radio', { name: label, exact: true });
const agreement = page => page.getByRole('checkbox', { name: 'Tenho 18 anos ou mais' });
const legend = page => page.getByRole('group').filter({ has: page.getByRole('radio') }).locator('legend');
const advance = page => button(page, /^(Continuar|Ver meu resumo)$/);

async function showEntry(page) {
  if (!(await agreement(page).isVisible())) await action(page, 'Começar').click();
  await agreement(page).waitFor();
}
async function start(page) {
  await showEntry(page);
  await agreement(page).check();
  await button(page, 'Iniciar questionário').click();
  await radio(page, 'Nunca').waitFor();
}
async function answerRound(page, choose) {
  const seen = [];
  for (let i = 0; i < 50; i++) {
    const text = await legend(page).innerText();
    assert(questions.has(text), 'Enunciado corresponde literalmente a uma linha canônica');
    assert.match(await page.getByRole('main').innerText(), new RegExp('Pergunta ' + (i + 1) + ' de 50\\b'));
    seen.push(text);
    await radio(page, choose(i)).check();
    await advance(page).click();
  }
  await button(page, 'Revisar respostas').waitFor();
  assert.equal(new Set(seen).size, 50);
  return seen;
}
async function selectOnlyByKeyboard(page, target, { fromBeginning = false } = {}) {
  if (fromBeginning) await page.keyboard.press('Control+Home');
  for (let i = 0; i < 180; i++) {
    if (await target.evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  assert.fail('Comando não alcançado pela tecla Tab: ' + (await target.innerText()));
}
async function noOverflow(page) {
  const sizes = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
  assert(sizes.page <= sizes.view + 1, 'Largura do conteúdo ' + sizes.page + ' em viewport de ' + sizes.view);
  const clipped = await page.locator('main, dialog[open], dialog[open] .dialog-body').evaluateAll(nodes =>
    nodes.filter(el => el.checkVisibility() && el.scrollWidth > el.clientWidth + 1).map(el => el.tagName + '.' + el.className));
  assert.deepEqual(clipped, [], 'Sem rolagem horizontal interna no conteúdo ou nos ajustes');
}

// Mede as cores efetivamente aplicadas às superfícies sólidas do formulário.
async function checkContrast(page) {
  const failures = await page.evaluate(() => {
    function rgb(value) { return (value.match(/[\d.]+/g) || []).map(Number); }
    function background(el) {
      while (el) {
        const color = rgb(getComputedStyle(el).backgroundColor);
        if (color.length === 3 || color[3] === 1) return color;
        el = el.parentElement;
      }
      return [255, 255, 255];
    }
    function luminance(color) {
      const [r, g, b] = color.slice(0, 3).map(value => {
        const x = value / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const errors = [];
    for (const el of document.querySelectorAll('main :is(h1, legend, p, button, summary, .answer-text), header button, footer button')) {
      if (!el.checkVisibility() || el.disabled) continue;
      const fg = luminance(rgb(getComputedStyle(el).color));
      const bg = luminance(background(el));
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      if (ratio < 4.5) errors.push({ text: el.textContent.trim(), ratio: Number(ratio.toFixed(2)),
        color: getComputedStyle(el).color, background: background(el), theme: document.documentElement.dataset.tema });
    }
    return errors;
  });
  assert.deepEqual(failures, [], 'Contraste de texto no formulário, cabeçalho e rodapé');
}
async function cleanStorage(page, context) {
  const data = await page.evaluate(async () => ({
    local: localStorage.length, session: sessionStorage.length, dbs: await indexedDB.databases(), caches: await caches.keys(),
    workers: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0
  }));
  assert.deepEqual(data, { local: 0, session: 0, dbs: [], caches: [], workers: 0 });
  assert.deepEqual(await context.cookies(), []);
}
function cleanTrace(trace) {
  assert.deepEqual(trace.errors, []);
  assert.deepEqual(trace.console, [], 'Nenhuma mensagem de console');
  assert.deepEqual(trace.sockets, []);
  assert(trace.requests.every(req => new URL(req.url).origin === origin && req.method === 'GET' && !new URL(req.url).search));
}

function scenePixels(canvas) {
  return canvas.evaluate(el => {
    // A captura não modifica o contexto de desenho da aplicação.
    const ctx = new OffscreenCanvas(el.width, el.height).getContext('2d', { willReadFrequently: true });
    ctx.drawImage(el, 0, 0);
    const bytes = ctx.getImageData(0, 0, el.width, el.height).data;
    let hash = 2166136261;
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
    return hash >>> 0;
  });
}

function nextSceneFrame(page) {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('fontes abertas enquanto o banco carrega permanecem na tela; o questionário inicia depois', async t => {
  let release;
  const bankGate = new Promise(resolve => { release = resolve; });
  const { page, trace } = await open(t, { bankGate });
  try {
    await action(page, 'Explorar o conteúdo informativo').click();
    await page.getByRole('heading', { name: 'Sobre autismo, TDAH e os instrumentos' }).waitFor();
  } finally { release(); }
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByRole('heading', { name: 'Sobre autismo, TDAH e os instrumentos' }).isVisible(), true);
  await button(page, 'Voltar ao início').click();
  await start(page);
  assert(questions.has(await legend(page).innerText()));
  cleanTrace(trace);
});

test('ordem de Tab acompanha a ordem visual do cabeçalho a 320 px, após o salto ao conteúdo', async t => {
  const { page } = await open(t, { viewport: { width: 320, height: 640 } });
  const header = page.locator('header');
  const visibleOrder = await header.locator('button:visible').evaluateAll(buttons => buttons.map(el => {
    const { top, height, left } = el.getBoundingClientRect();
    return { name: el.getAttribute('aria-label') || el.textContent.trim(), center: top + height / 2, left };
  }).sort((a, b) => Math.abs(a.center - b.center) > 10 ? a.center - b.center : a.left - b.left).map(item => item.name));
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('link', { name: 'Ir para o conteúdo' }).evaluate(el => el === document.activeElement), true);
  const focusOrder = [];
  for (let i = 0; i < visibleOrder.length; i++) {
    await page.keyboard.press('Tab');
    focusOrder.push(await page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim()));
  }
  assert.deepEqual(focusOrder, visibleOrder);
});

test('entrada livre, confirmação de idade, sete fontes e privacidade de links', async t => {
  const { page, trace } = await open(t, { viewport: { width: 320, height: 640 } });
  assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR');
  await showEntry(page);
  assert.equal(await agreement(page).isChecked(), false);
  if (await button(page, 'Iniciar questionário').isEnabled()) await button(page, 'Iniciar questionário').click();
  assert.equal(await radio(page, 'Nunca').count(), 0);
  await action(page, 'Explorar o conteúdo informativo').click();
  await noOverflow(page);
  for (const href of officialSources) {
    const anchor = page.locator('a[href="' + href + '"]').first();
    await anchor.waitFor();
    assert((await anchor.innerText()).trim().length > 8);
    const noReferrer = await anchor.evaluate(el => el.relList.contains('noreferrer') || el.referrerPolicy === 'no-referrer' ||
      document.querySelector('meta[name="referrer"]')?.content === 'no-referrer');
    assert(noReferrer, href);
  }
  await action(page, 'Privacidade').click();
  await noOverflow(page);
  assert.match(await page.getByRole('main').innerText(), /endere[cç]o IP/i);
  assert.equal(await page.locator('input[type=email], input[type=date], input[type=password]').count(), 0);
  cleanTrace(trace);
});

test('teclado, grupo rotulado, avanço em branco, volta, pausa e recarga com armazenamento bloqueado', async t => {
  const { page, trace } = await open(t, { blocked: true });
  await showEntry(page);
  await selectOnlyByKeyboard(page, agreement(page));
  await page.keyboard.press('Space');
  await selectOnlyByKeyboard(page, button(page, 'Iniciar questionário'));
  await page.keyboard.press('Enter');
  const first = await legend(page).innerText();
  assert.equal(await page.getByRole('group', { name: first, exact: true }).count(), 1);
  assert.equal(await page.getByRole('radio').count(), 6);
  assert.equal(await page.locator('main input[type=radio]:checked').count(), 0);
  for (let i = 0; i < options.length; i++) assert.equal(await radio(page, options[i]).count(), 1);
  await selectOnlyByKeyboard(page, advance(page));
  await page.keyboard.press('Enter');
  assert.equal(await legend(page).innerText(), first);
  assert.equal(await page.locator('main input[type=radio]:checked').count(), 0);
  await selectOnlyByKeyboard(page, radio(page, 'Nunca'));
  await page.keyboard.press('ArrowDown');
  assert.equal(await radio(page, 'Às vezes').isChecked(), true);
  assert.equal(await radio(page, 'Às vezes').evaluate(el => el === document.activeElement), true);
  assert.equal(await legend(page).innerText(), first);
  await selectOnlyByKeyboard(page, advance(page));
  await page.keyboard.press('Enter');
  const second = await legend(page).innerText();
  assert.notEqual(second, first);
  assert.equal(await page.locator('main input[type=radio]:checked').count(), 0);
  await selectOnlyByKeyboard(page, button(page, 'Voltar'));
  await page.keyboard.press('Enter');
  assert.equal(await radio(page, 'Às vezes').isChecked(), true);
  await selectOnlyByKeyboard(page, button(page, 'Pausar'));
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('radio').count(), 0);
  await selectOnlyByKeyboard(page, button(page, 'Abrir a pausa em 3D'));
  await page.keyboard.press('Enter');
  await page.locator('#atelier').getByRole('img').waitFor();
  assert.equal(await page.getByRole('radio').count(), 0);
  await selectOnlyByKeyboard(page, button(page, 'Voltar ao questionário pausado'));
  await page.keyboard.press('Enter');
  await button(page, 'Continuar de onde parei').waitFor();
  assert.equal(await page.getByRole('radio').count(), 0);
  await selectOnlyByKeyboard(page, button(page, 'Apagar e sair'));
  await page.keyboard.press('Enter');
  await selectOnlyByKeyboard(page, button(page, 'Voltar sem apagar'));
  await page.keyboard.press('Enter');
  await selectOnlyByKeyboard(page, button(page, 'Continuar de onde parei'));
  await page.keyboard.press('Enter');
  assert.equal(await legend(page).innerText(), first);
  assert.equal(await radio(page, 'Às vezes').isChecked(), true);
  await page.reload({ waitUntil: 'networkidle' });
  await showEntry(page);
  assert.equal(await agreement(page).isChecked(), false);
  assert.equal(await page.getByRole('radio').count(), 0);
  cleanTrace(trace);
});

test('objeto 3D facultativo, sem movimento automático, ajustável por teclado e sem sair da memória', async t => {
  const { page, context, trace } = await open(t, { reducedMotion: 'reduce' });
  const scene = page.locator('#atelier');
  const canvas = scene.getByRole('img');
  await canvas.waitFor();
  assert(await canvas.getAttribute('aria-label'), 'O desenho tem nome acessível');
  const count = trace.requests.length;
  const pixels = () => scenePixels(canvas);
  const frame = () => nextSceneFrame(page);
  await frame();
  const initial = await pixels();
  await frame();
  assert.equal(await pixels(), initial, 'A cena repousa antes de qualquer ação');
  await selectOnlyByKeyboard(page, canvas);
  await page.keyboard.press('ArrowRight');
  await frame();
  const rotated = await pixels();
  assert.notEqual(rotated, initial);
  await page.keyboard.press('Home');
  await frame();
  assert.equal(await pixels(), initial);
  await selectOnlyByKeyboard(page, button(page, 'Girar à esquerda'));
  await page.keyboard.press('Enter');
  await frame();
  const left = await pixels();
  assert.notEqual(left, initial);
  await button(page, 'Ocultar objeto 3D').click();
  assert.equal(await canvas.isVisible(), false);
  assert.equal(await button(page, 'Girar à direita').isVisible(), false);
  await action(page, 'Explorar o conteúdo informativo').click();
  await button(page, 'Voltar ao início').click();
  assert.equal(await canvas.isVisible(), false);
  await selectOnlyByKeyboard(page, button(page, 'Mostrar objeto 3D'));
  await page.keyboard.press('Enter');
  await frame();
  assert.equal(await pixels(), left);
  await button(page, 'Restaurar posição').click();
  await frame();
  assert.equal(await pixels(), initial);
  const details = scene.locator('details').filter({ hasText: 'Mais ajustes do objeto' });
  const expand = details.locator('summary');
  await selectOnlyByKeyboard(page, expand);
  await page.keyboard.press('Enter');
  const soft = details.getByRole('checkbox', { name: 'Cores suaves' });
  await selectOnlyByKeyboard(page, soft);
  await page.keyboard.press('Space');
  await frame();
  assert.equal(await soft.isChecked(), true);
  const softInitial = await pixels();
  assert.notEqual(softInitial, initial);
  await selectOnlyByKeyboard(page, button(page, 'Inclinar para cima'));
  await page.keyboard.press('Enter');
  await frame();
  assert.notEqual(await pixels(), softInitial);
  await button(page, 'Inclinar para baixo').click();
  await frame();
  assert.equal(await pixels(), softInitial);
  await button(page, 'Girar à direita').click();
  await button(page, 'Restaurar posição').click();
  await frame();
  assert.equal(await pixels(), softInitial);
  assert.equal(await soft.isChecked(), true);
  await action(page, 'Explorar o conteúdo informativo').click();
  await button(page, 'Voltar ao início').click();
  if (!(await soft.isVisible())) await expand.click();
  assert.equal(await soft.isChecked(), true);
  await frame();
  assert.equal(await pixels(), softInitial);
  await soft.uncheck();
  await frame();
  assert.equal(await pixels(), initial);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await frame();
  const resting = await pixels();
  await frame();
  assert.equal(await pixels(), resting);
  await button(page, 'Ocultar objeto 3D').click();
  await start(page);
  await radio(page, 'Prefiro pular').check();
  await button(page, 'Pausar').click();
  await button(page, 'Continuar de onde parei').click();
  assert.equal(await radio(page, 'Prefiro pular').isChecked(), true);
  assert.deepEqual(trace.requests.slice(count), [], 'Manipular o objeto, navegar e pausar não gera requisições');
  await cleanStorage(page, context);
  cleanTrace(trace);
});

test('ateliê responde ao arraste e ao pulso manual, respeitando o movimento reduzido', async t => {
  const { page, context, trace } = await open(t);
  const canvas = page.locator('#atelier').getByRole('img');
  const explorar = button(page, 'Explorar');
  const desacelerar = button(page, 'Desacelerar');
  const pulso = button(page, 'Enviar pulso');
  const contarRequisicoes = trace.requests.length;
  await canvas.waitFor();
  await explorar.click();
  assert.equal(await explorar.getAttribute('aria-pressed'), 'true');
  assert.equal(await desacelerar.getAttribute('aria-pressed'), 'false');
  await canvas.scrollIntoViewIfNeeded();
  const area = await canvas.boundingBox();
  const x = area.x + area.width / 2;
  const y = area.y + area.height / 2;
  await page.mouse.move(x, y);
  await nextSceneFrame(page);
  const inicial = await scenePixels(canvas);
  await page.mouse.down();
  await page.mouse.move(x + area.width / 5, y + area.height / 8, { steps: 8 });
  await page.mouse.up();
  await nextSceneFrame(page);
  assert.notEqual(await scenePixels(canvas), inicial, 'Arrastar muda a projeção em 3D');

  await desacelerar.click();
  assert.equal(await desacelerar.getAttribute('aria-pressed'), 'true');
  assert.equal(await explorar.getAttribute('aria-pressed'), 'false');
  await nextSceneFrame(page);
  const repouso = await scenePixels(canvas);
  await selectOnlyByKeyboard(page, pulso);
  await page.keyboard.press('Enter');
  await nextSceneFrame(page);
  const estatico = await scenePixels(canvas);
  assert.notEqual(estatico, repouso, 'O pulso reduzido ainda dá retorno visual');
  await nextSceneFrame(page);
  assert.equal(await scenePixels(canvas), estatico, 'O pulso reduzido permanece sem movimento');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.clock.runFor(1000);
  const antes = await scenePixels(canvas);
  await page.clock.runFor(1000);
  assert.equal(await scenePixels(canvas), antes, 'A preferência padrão também repousa sem interação');
  await pulso.click();
  await page.clock.runFor(150);
  const faseInicial = await scenePixels(canvas);
  await page.clock.runFor(250);
  assert.notEqual(await scenePixels(canvas), faseInicial, 'O pulso solicitado evolui ao longo do tempo');
  await page.clock.runFor(4000);
  const apos = await scenePixels(canvas);
  await page.clock.runFor(1000);
  assert.equal(await scenePixels(canvas), apos, 'O pulso termina e a cena volta ao repouso');
  assert.deepEqual(trace.requests.slice(contarRequisicoes), []);
  await cleanStorage(page, context);
  cleanTrace(trace);
});

test('em toque, o ateliê gira no arraste horizontal e permite rolar a página na vertical', async t => {
  const { page, context, trace } = await open(t, {
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const canvas = page.locator('#atelier').getByRole('img');
  await canvas.scrollIntoViewIfNeeded();
  const cdp = await context.newCDPSession(page);
  async function deslizar(deltaX, deltaY) {
    const area = await canvas.boundingBox();
    const x = area.x + area.width / 2;
    const y = area.y + area.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let passo = 1; passo <= 8; passo++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: x + deltaX * passo / 8, y: y + deltaY * passo / 8,
      }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await nextSceneFrame(page);
  }

  const contarRequisicoes = trace.requests.length;
  const inicial = await scenePixels(canvas);
  await deslizar(76, 0);
  const girado = await scenePixels(canvas);
  assert.notEqual(girado, inicial);
  const antes = await page.evaluate(() => scrollY);
  await deslizar(0, -86);
  await page.waitForFunction(y => scrollY > y + 20, antes);
  assert.equal(await scenePixels(canvas), girado, 'O toque vertical não inclina nem dispara um pulso');
  await canvas.scrollIntoViewIfNeeded();
  const area = await canvas.boundingBox();
  await page.touchscreen.tap(area.x + area.width / 2, area.y + area.height / 2);
  await nextSceneFrame(page);
  assert.notEqual(await scenePixels(canvas), girado, 'Tocar a cena destaca um ponto de luz');
  await noOverflow(page);
  assert.deepEqual(trace.requests.slice(contarRequisicoes), []);
  cleanTrace(trace);
});

async function settings(page) {
  await button(page, 'Ajustar leitura').first().click();
  return page.getByRole('dialog', { name: 'Ajustar leitura' });
}

test('questionário e conteúdo informativo funcionam quando o desenho 3D está indisponível', async t => {
  const { page, trace } = await open(t, { noCanvas: true, blocked: true });
  assert.equal(await page.getByText(/O recurso de rotação está indisponível neste navegador/).isVisible(), true);
  assert.equal(await page.locator('#atelier').getByRole('img').isVisible(), false);
  assert.equal(await button(page, 'Girar à esquerda').isVisible(), false);
  await action(page, 'Explorar o conteúdo informativo').click();
  await button(page, 'Voltar ao início').click();
  await start(page);
  const first = await legend(page).innerText();
  await radio(page, 'Não vivi essa situação').check();
  await advance(page).click();
  await button(page, 'Voltar').click();
  assert.equal(await legend(page).innerText(), first);
  assert.equal(await radio(page, 'Não vivi essa situação').isChecked(), true);
  cleanTrace(trace);
});
const pref = (dialog, group, label) => dialog.getByRole('group', { name: group }).getByRole('radio', { name: label, exact: true });

test('leitura do sistema, temas manuais, foco no retorno, texto ampliado e reflow a 320 px', async t => {
  const { page } = await open(t, { viewport: { width: 320, height: 640 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  await noOverflow(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32 } });
  assert((await page.locator('html').evaluate(el => parseFloat(getComputedStyle(el).fontSize))) >= 36);
  await noOverflow(page);
  const largeDialog = await settings(page);
  await noOverflow(page);
  await largeDialog.getByRole('button', { name: 'Concluir ajustes' }).click();
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 16 } });
  const systemDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme), 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  const systemLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme), 'light');
  assert.notEqual(systemLight, systemDark);
  await page.emulateMedia({ colorScheme: 'dark' });
  await start(page);
  const first = await legend(page).innerText();
  await radio(page, 'Muitas vezes').check();
  for (const theme of ['Claro', 'Escuro', 'Alto contraste']) {
    const dialog = await settings(page);
    await pref(dialog, 'Tema', theme).check();
    await pref(dialog, 'Tamanho do texto', 'Muito grande').check();
    await pref(dialog, 'Espaçamento', 'Amplo').check();
    await noOverflow(page);
    await dialog.getByRole('checkbox', { name: 'Mostrar barra de progresso' }).uncheck();
    await dialog.getByRole('button', { name: 'Concluir ajustes' }).click();
    const applied = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (theme === 'Claro') assert.equal(applied, systemLight);
    if (theme === 'Escuro') assert.equal(applied, systemDark);
    if (theme === 'Alto contraste') assert.equal(applied, 'rgb(16, 16, 16)');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await button(page, 'Ajustar leitura').first().evaluate(el => document.activeElement === el), true);
    assert.equal(await legend(page).innerText(), first);
    assert.equal(await radio(page, 'Muitas vezes').isChecked(), true);
    assert.match(await page.getByRole('main').innerText(), /Pergunta 1 de 50/);
    assert.equal(await page.locator('progress:visible, [role=progressbar]:visible').count(), 0);
    for (const label of options) {
      const box = await radio(page, label).evaluate(input => {
        const rect = input.labels[0].getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      assert(box.width >= 44 && box.height >= 44, 'Alvo da opção ' + label);
    }
    await noOverflow(page);
    await checkContrast(page);
  }
  const dialog = await settings(page);
  await dialog.getByRole('button', { name: 'Restaurar leitura padrão' }).click();
  for (const [group, label] of [['Tema', 'Sistema'], ['Tamanho do texto', 'Padrão'], ['Espaçamento', 'Padrão']]) {
    assert.equal(await pref(dialog, group, label).isChecked(), true);
  }
  assert.equal(await dialog.getByRole('checkbox', { name: 'Mostrar barra de progresso' }).isChecked(), true);
  await page.keyboard.press('Escape');
  await page.emulateMedia({ forcedColors: 'active' });
  assert.equal(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), true);
  for (const theme of ['Claro', 'Escuro', 'Alto contraste']) {
    const forced = await settings(page);
    await pref(forced, 'Tema', theme).check();
    await forced.getByRole('button', { name: 'Concluir ajustes' }).click();
    await noOverflow(page);
    await checkContrast(page);
  }
  await radio(page, 'Nunca').focus();
  assert.equal(await radio(page, 'Nunca').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Space');
  assert.equal(await radio(page, 'Nunca').isChecked(), true);
});

const summaryCounts = async page => Promise.all(['frequencias', 'naoVividas', 'pulos'].map(async key =>
  Number((await page.locator('[data-total="' + key + '"]').innerText()).trim())));

const rankingRows = page => page.locator('[data-ranking] [data-tema-ranking]');

async function checkRanking(page, questionsAnswered, answerAt) {
  const byTheme = new Map();
  for (const [index, question] of questionsAnswered.entries()) {
    const tema = questions.get(question);
    const counts = byTheme.get(tema) ?? { counted: 0, recurring: 0 };
    const answer = answerAt(index);
    if (options.slice(0, 4).includes(answer)) counts.counted++;
    if (options.slice(2, 4).includes(answer)) counts.recurring++;
    byTheme.set(tema, counts);
  }

  const rows = await rankingRows(page).evaluateAll(nodes => nodes.map(node => ({
    tema: node.dataset.temaRanking,
    summary: node.innerText
  })));
  const eligible = [...byTheme].filter(([, counts]) => counts.counted >= 2 && counts.recurring > 0);
  assert.equal(rows.length, eligible.length);
  assert.deepEqual(new Set(rows.map(row => row.tema)), new Set(eligible.map(([tema]) => tema)));
  let lastRatio = 1;
  for (const row of rows) {
    const { recurring, counted } = byTheme.get(row.tema);
    assert.match(row.summary, new RegExp('\\b' + recurring + ' de ' + counted + '\\b'));
    const ratio = recurring / counted;
    assert(ratio <= lastRatio, 'Temas em ordem da maior proporção de respostas frequentes');
    lastRatio = ratio;
  }
}

async function checkCompletePdf(page, questionsAnswered, answerAt) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    button(page, 'Baixar PDF completo').click()
  ]);
  assert.equal(download.suggestedFilename(), 'meu-ritmo-respostas.pdf');
  const document = await readFile(await download.path(), 'latin1');
  assert.match(document, /^%PDF-1\./);
  assert.match(document, /%%EOF\s*$/);

  // O PDF local usa texto WinAnsi em fluxos sem compressão. Decodifica as strings literais
  // para conferir pares enunciado/resposta, inclusive quando quebrados em várias linhas.
  const content = [...document.matchAll(/\(((?:\\[^\r\n]|[^\\()\r\n])*)\)\s*Tj/g)]
    .map(match => match[1].replace(/\\([0-7]{3}|[\\()])/g, (_, escape) =>
      escape.length === 3 ? String.fromCharCode(parseInt(escape, 8)) : escape))
    .join(' ').replace(/\s+/g, ' ');
  assert(content.includes('Respostas por tema'));
  assert.match(content, /neuropsicolog/i);
  const responses = content.slice(content.indexOf('Respostas por tema') + 'Respostas por tema'.length);
  for (const [index, question] of questionsAnswered.entries()) {
    assert(responses.includes(question + ' Resposta: ' + answerAt(index)), 'Par literal exportado: ' + question);
  }
}

for (const [label, counts] of [
  ['Nunca', [50, 0, 0]], ['Prefiro pular', [0, 0, 50]], ['Não vivi essa situação', [0, 50, 0]]
]) {
  test('rodada completa com 50 respostas “' + label + '”', async t => {
    const { page, trace } = await open(t);
    await start(page);
    await answerRound(page, () => label);
    assert.deepEqual(await summaryCounts(page), counts);
    const empty = page.getByText('Você concluiu a rodada sem marcar frequências. Pode rever as perguntas se quiser.', { exact: true });
    assert.equal(await empty.isVisible(), label !== 'Nunca');
    assert.equal(await button(page, 'Revisar respostas').isVisible(), true);
    assert.equal(await button(page, 'Baixar PDF completo').isEnabled(), true);
    assert.equal(await rankingRows(page).count(), 0);
    cleanTrace(trace);
  });
}

test('resultado misto, ranking, PDF completo, destaque, revisão, nova rodada e exclusão', async t => {
  const { page, context, trace } = await open(t, { viewport: { width: 320, height: 640 } });
  const mutations = [];
  const cdp = await context.newCDPSession(page);
  await cdp.send('DOMStorage.enable');
  for (const name of ['domStorageItemAdded', 'domStorageItemUpdated', 'domStorageItemRemoved', 'domStorageItemsCleared']) {
    cdp.on('DOMStorage.' + name, () => mutations.push(name));
  }
  await start(page);
  const beforeRequests = trace.requests.length;
  const history = await page.evaluate(() => history.length);
  const firstAnswer = i => i === 49 ? 'Nunca' : options[i % options.length];
  const firstRound = await answerRound(page, firstAnswer);
  // As posições 1–48 completam oito ciclos, 49–50 são frequências.
  assert.deepEqual(await summaryCounts(page), [34, 8, 8]);
  assert.equal(await page.getByRole('heading', { name: 'O que apareceu com mais frequência' }).isVisible(), true);
  assert.equal(await page.getByRole('heading', { name: 'Preparar minha consulta' }).isVisible(), true);
  const sus = page.getByRole('link', { name: 'Como buscar atendimento pelo SUS', exact: true });
  assert.equal(new URL(await sus.getAttribute('href')).hostname, 'www.gov.br');
  assert.equal(await page.locator('main input[type=checkbox]:checked').count(), 0);
  await checkRanking(page, firstRound, firstAnswer);
  await checkCompletePdf(page, firstRound, firstAnswer);
  await button(page, 'Expandir todos os temas').click();
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32 } });
  await noOverflow(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 16 } });
  const picked = firstRound[49];
  const highlight = page.getByRole('checkbox', { name: 'Destacar: ' + picked, exact: true });
  await highlight.check();
  assert.equal(await highlight.isChecked(), true);
  await highlight.uncheck();
  assert.equal(await button(page, 'Imprimir meus destaques').isDisabled(), true);
  await highlight.check();
  // Intercepta somente a caixa de impressão do sistema. O DOM e o CSS usados são os da aplicação.
  await page.evaluate(() => { window.print = () => { window.__impressoesDeTeste = (window.__impressoesDeTeste || 0) + 1; }; });
  await button(page, 'Imprimir meus destaques').click();
  assert.equal(await page.evaluate(() => window.__impressoesDeTeste), 1);
  await page.emulateMedia({ media: 'print' });
  const printable = await page.locator('body').innerText();
  assert(printable.includes(picked));
  assert(printable.includes('Nunca'));
  assert(firstRound.every(text => text === picked || !printable.includes(text)), 'A impressão omite todos os demais enunciados');
  assert(!printable.includes('Revisar respostas'));
  await page.emulateMedia({ media: 'screen' });
  await button(page, 'Revisar respostas').click();
  await noOverflow(page);
  await button(page, /^Editar pergunta 50:/).click();
  assert.equal(await legend(page).innerText(), picked);
  assert.equal(await radio(page, 'Nunca').isChecked(), true);
  await radio(page, 'Não vivi essa situação').check();
  await button(page, 'Ver meu resumo').click();
  assert.deepEqual(await summaryCounts(page), [33, 9, 8]);
  assert.equal(await button(page, 'Imprimir meus destaques').isDisabled(), true);
  const editedAnswer = i => i === 49 ? 'Não vivi essa situação' : firstAnswer(i);
  await checkRanking(page, firstRound, editedAnswer);
  await checkCompletePdf(page, firstRound, editedAnswer);
  await button(page, 'Fazer outra rodada').click();
  const nextRound = await answerRound(page, () => 'Às vezes');
  assert(nextRound.every(text => !firstRound.includes(text)));
  assert.deepEqual(await summaryCounts(page), [50, 0, 0]);
  await button(page, 'Apagar e sair').click();
  await button(page, 'Sim, apagar e sair').click();
  await showEntry(page);
  assert.equal(await agreement(page).isChecked(), false);
  assert.equal(await page.getByRole('radio').count(), 0);
  assert.deepEqual(trace.requests.slice(beforeRequests), [], 'Responder, revisar, exportar, imprimir, ressorteio e exclusão sem requisições');
  assert.equal(await page.evaluate(() => history.length), history);
  assert.equal(page.url(), origin + '/');
  assert.deepEqual(mutations, [], 'Sem escrita transitória em Web Storage');
  await cleanStorage(page, context);
  cleanTrace(trace);
});
