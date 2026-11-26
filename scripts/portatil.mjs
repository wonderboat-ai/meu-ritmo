// Empacota os mesmos módulos da hospedagem sem instalar dependências ou acessar a rede.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const publico = new URL('../public/', import.meta.url);
const nomeSaida = process.argv.includes('--pages') ? 'index.html' : 'Meu_ritmo.html';
const destino = new URL('../' + nomeSaida, import.meta.url);
const ler = nome => readFile(new URL(nome, publico), 'utf8').then(s => s.replace(/\r\n?/g, '\n'));
const dataUrl = (mime, bytes) => 'data:' + mime + ';base64,' + Buffer.from(bytes).toString('base64');
const hashCsp = conteudo => "'sha256-" + createHash('sha256').update(conteudo).digest('base64') + "'";

// Nomes estáveis no mapa preservam a mesma instância do motor em todos os imports.
const modulos = new Map();
async function incluirModulo(nome) {
  if (modulos.has(nome)) return;
  modulos.set(nome, '');
  const dependencias = new Set();
  const codigo = (await ler(nome)).replace(
    /\b(from\s+|import\s*)(['"])\.\/([\w-]+\.mjs)\2/g,
    (_, palavra, aspas, arquivo) => {
      dependencias.add(arquivo);
      return palavra + aspas + 'meu-ritmo/' + arquivo + aspas;
    }
  );
  modulos.set(nome, dataUrl('text/javascript;charset=utf-8', codigo));
  for (const dependencia of dependencias) await incluirModulo(dependencia);
}

const [modelo, banco] = await Promise.all([ler('index.html'), ler('banco-v1.txt')]);
const linksCss = [...modelo.matchAll(/<link\s+rel="stylesheet"\s+href="\.\/([\w-]+\.css)"\s*>/gi)];
if (!linksCss.length) throw new Error('Nenhuma folha de estilo encontrada no HTML.');
// A ordem é a mesma da página hospedada, inclusive para as regras de impressão.
const estilos = await Promise.all(linksCss.map(match => ler(match[1])));
const estilo = estilos.join('\n');
await incluirModulo('app.mjs');
const imports = Object.fromEntries(Array.from(modulos, ([nome, url]) => ['meu-ritmo/' + nome, url]));
const mapa = JSON.stringify({ imports });
const inicio = 'import "meu-ritmo/app.mjs";';
const politica = [
  "default-src 'none'", 'script-src data: ' + hashCsp(mapa) + ' ' + hashCsp(inicio),
  'style-src ' + hashCsp(estilo), 'img-src data:', "connect-src 'none'",
  "base-uri 'none'", "form-action 'none'", "object-src 'none'", "frame-src 'none'"
].join('; ');
if (/<\/script\b/i.test(banco) || /<\/style\b/i.test(estilo)) {
  throw new Error('Delimitador HTML encontrado dentro de um recurso incorporado.');
}

let html = modelo;
function substituir(alvo, valor) {
  if (!html.includes(alvo)) throw new Error('Referência ausente no HTML original: ' + alvo);
  html = html.replace(alvo, () => valor);
}
const metaCsp = html.match(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/i)?.[0];
if (!metaCsp) throw new Error('A política de conteúdo não foi encontrada no HTML original.');
substituir(metaCsp, '<meta http-equiv="Content-Security-Policy" content="' + politica + '">');
const tiposImagem = { svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const imagens = [...new Set([...modelo.matchAll(/(?:href|src)="\.\/([\w-]+\.(?:svg|webp|png|jpe?g))"/gi)].map(match => match[1]))];
for (const nome of imagens) {
  const bytes = await readFile(new URL(nome, publico));
  const tipo = tiposImagem[nome.split('.').pop().toLowerCase()];
  html = html.replaceAll('"./' + nome + '"', '"' + dataUrl(tipo, bytes) + '"');
}
for (const [indice, match] of linksCss.entries()) substituir(match[0], indice === 0 ? '<style>' + estilo + '</style>' : '');
substituir('<script type="module" src="./app.mjs"></script>', [
  '<script type="text/plain" id="banco-local">' + banco + '</script>',
  '<script type="importmap">' + mapa + '</script>',
  '<script type="module">' + inicio + '</script>'
].join('\n'));

await writeFile(destino, html, 'utf8');
console.log(nomeSaida + ' gerado (' + Buffer.byteLength(html) + ' bytes).');
