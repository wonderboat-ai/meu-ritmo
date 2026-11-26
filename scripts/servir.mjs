import { readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const portArgument = args.length ? /^--port=(\d{1,5})$/.exec(args[0]) : null;
if (args.length > 1 || (args.length && (!portArgument || Number(portArgument[1]) > 65535))) {
  console.error('Uso: node scripts/servir.mjs [--port=4173]');
  process.exit(1);
}
const port = portArgument ? Number(portArgument[1]) : 4173;
const root = await realpath(fileURLToPath(new URL('../public/', import.meta.url)));
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
]);

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const path = decodeURIComponent(req.url.split('?')[0]);
    const parts = (path === '/' ? '/index.html' : path).slice(1).split('/');
    if (!path.startsWith('/') || !parts.every(part => /^[a-z\d_-][a-z\d._-]*$/i.test(part))) {
      res.writeHead(404).end();
      return;
    }
    const type = types.get(extname(parts.at(-1)).toLowerCase());
    if (!type) {
      res.writeHead(404).end();
      return;
    }
    const file = await realpath(join(root, ...parts));
    const inside = relative(root, file);
    if (inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) {
      res.writeHead(404).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404).end();
  }
});

server.on('error', () => {
  console.error('Não foi possível iniciar o servidor local. Confira se a porta está disponível.');
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log('Meu ritmo disponível em http://127.0.0.1:' + server.address().port + '/');
});
