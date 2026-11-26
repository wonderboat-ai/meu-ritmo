import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = new URL('../Meu_ritmo.html', import.meta.url).href;

test('HTML portátil completa uma rodada offline, sem arquivos auxiliares ou serviços', async t => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH && { executablePath: process.env.CHROME_PATH })
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ offline: true, locale: 'pt-BR' });
  const erros = [], dependencias = [], violacoes = [];
  page.on('pageerror', error => erros.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') erros.push(msg.text()); });
  page.on('request', req => {
    if (req.url() !== url && !req.url().startsWith('data:')) dependencias.push(req.url());
  });
  await page.exposeFunction('registrarViolacaoDeTeste', tipo => violacoes.push(tipo));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      window.registrarViolacaoDeTeste(event.violatedDirective);
    });
  });
  await page.goto(url);
  const botao = name => page.getByRole('button', { name, exact: typeof name === 'string' });
  const objeto = page.locator('#atelier').getByRole('img');
  await objeto.waitFor();
  await botao('Girar à direita').click();
  const ajustesObjeto = page.locator('#atelier details').filter({ hasText: 'Mais ajustes do objeto' });
  await ajustesObjeto.locator('summary').click();
  await ajustesObjeto.getByRole('checkbox', { name: 'Cores suaves' }).check();
  await botao('Inclinar para cima').click();
  await botao('Restaurar posição').click();
  await botao('Ocultar objeto 3D').click();
  assert.equal(await objeto.isVisible(), false);
  await botao('Mostrar objeto 3D').click();
  assert.equal(await objeto.isVisible(), true);
  await botao('Começar').click();
  await page.getByRole('checkbox', { name: 'Tenho 18 anos ou mais' }).check();
  await botao('Iniciar questionário').click();
  for (let indice = 0; indice < 50; indice++) {
    const opcao = indice % 2 ? 'Às vezes' : 'Nunca';
    await page.getByRole('radio', { name: opcao, exact: true }).check();
    await botao(indice === 49 ? 'Ver meu resumo' : 'Continuar').click();
  }
  assert.equal(await page.locator('[data-total="frequencias"]').innerText(), '50');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    botao('Baixar PDF completo').click()
  ]);
  assert.equal(download.suggestedFilename(), 'meu-ritmo-respostas.pdf');
  const pdf = await readFile(await download.path(), 'latin1');
  assert.match(pdf, /^%PDF-1\./);
  assert.match(pdf, /%%EOF\s*$/);
  await botao('Expandir todos os temas').click();
  const destaques = page.getByRole('main').getByRole('checkbox');
  assert.equal(await destaques.count(), 50);
  await destaques.first().check();
  await botao('Revisar respostas').click();
  await botao(/^Editar pergunta 50:/).click();
  await botao('Ver meu resumo').click();
  await botao('Apagar e sair').click();
  await botao('Sim, apagar e sair').click();
  await botao('Começar').waitFor();
  assert.deepEqual(dependencias, []);
  assert.deepEqual(erros, []);
  assert.deepEqual(violacoes, []);
});
