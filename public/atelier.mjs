// Escultura original. Os anéis da malha seguem um nó de trevo em três dimensões.
const VOLTA = 2 * Math.PI;
const PASSO = Math.PI * 2 / 15;
const INCLINACAO = Math.PI / 12;
const CORES = [[49, 79, 225], [27, 155, 127], [247, 181, 35], [234, 93, 75]];
const perfil = { giro: 0, altura: 0, oculto: false, suaves: false };
const instalados = new WeakSet();

const somar = (a, b) => a.map((v, i) => v + b[i]);
const subtrair = (a, b) => a.map((v, i) => v - b[i]);
const escalar = (a, k) => a.map(v => v * k);
const produto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalizar = a => escalar(a, 1 / (Math.hypot(...a) || 1));
const cruzar = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const limitar = (n, a, b) => Math.max(a, Math.min(b, n));

function trajetoria(t) {
  const r = 1.53 + .83 * Math.cos(3*t);
  return [r * Math.cos(2*t), r * Math.sin(2*t), .94 * Math.sin(3*t)];
}

function ponto(t, a, escala) {
  const tangente = normalizar(subtrair(trajetoria(t + .0001), trajetoria(t - .0001)));
  const lado = normalizar(cruzar([0, 0, 1], tangente));
  const cima = cruzar(tangente, lado);
  const toro = .36 * Math.cos(3*t - .9) + .18 * Math.sin(t + .3);
  // Superelipse: faces largas de fita e bordas arredondadas, com espessura real.
  const suave = v => Math.sign(v) * Math.abs(v) ** .58;
  const l = .54 * suave(Math.cos(a)) * escala;
  const h = .24 * suave(Math.sin(a)) * escala;
  return somar(trajetoria(t), somar(
    escalar(lado, l * Math.cos(toro) - h * Math.sin(toro)),
    escalar(cima, l * Math.sin(toro) + h * Math.cos(toro))
  ));
}

function criarEscultura() {
  const pontos = [], faces = [];
  const secoes = 52, lados = 30;
  const eixo = Array.from({length: 96}, (_, i) => trajetoria(i / 96 * VOLTA));
  for (let peca = 0; peca < 4; peca++) {
    const base = pontos.length;
    const inicio = peca * VOLTA / 4 + .32 + .012;
    const fim = inicio + VOLTA / 4 - .024;
    const anel = (t, a) => {
      const d = limitar(Math.min(t - inicio, fim - t) / .052, 0, 1);
      return ponto(t, a, Math.sqrt(1 - (1-d)**2) || .0001);
    };
    for (let i = 0; i <= secoes; i++) {
      const t = inicio + (fim-inicio) * i/secoes;
      for (let j = 0; j < lados; j++) {
        const a = j / lados * VOLTA;
        const pos = anel(t, a);
        const dt = subtrair(anel(Math.min(fim, t+.0005), a), anel(Math.max(inicio, t-.0005), a));
        const da = subtrair(anel(t, a+.0005), anel(t, a-.0005));
        const normal = normalizar(cruzar(da, dt));
        // Escurecimento discreto onde outras voltas da peça ficam muito próximas.
        let oclusao = 0;
        for (let k=0; k < eixo.length; k++) {
          const dif = Math.abs(Math.atan2(Math.sin(t-k/96*VOLTA), Math.cos(t-k/96*VOLTA)));
          if (dif < .42) continue;
          const v = subtrair(eixo[k], pos), distancia = Math.hypot(...v);
          const influencia = Math.max(0, produto(normal, v)/distancia);
          oclusao = Math.max(oclusao, influencia * Math.max(0, 1 - distancia/2.0));
        }
        pontos.push({
          pos: [pos[0]*1.25, pos[1]*.93, pos[2]],
          normal: normalizar([normal[0]/1.25, normal[1]/.93, normal[2]]),
          oclusao, cor: CORES[peca]
        });
      }
    }
    for (let i=0; i < secoes; i++) for (let j=0; j < lados; j++) {
      const a = base + i*lados + j;
      const b = base + i*lados + (j+1)%lados;
      faces.push([a, b, b + lados], [a, b + lados, a + lados]);
    }
  }
  return {pontos, faces};
}
let malha;

function rotacao() {
  const ax = .15 + perfil.altura * INCLINACAO;
  const ay = -.19 + perfil.giro * PASSO;
  const az = .29;
  const [sx, sy, sz] = [ax, ay, az].map(Math.sin);
  const [cx, cy, cz] = [ax, ay, az].map(Math.cos);
  return ([x,y,z]) => {
    const a = x * cy + z * sy, b = -x * sy + z * cy;
    const c = y * cx - b * sx;
    return [a * cz - c * sz, a * sz + c * cz, y * sx + b * cx];
  };
}

// O z-buffer mantém os cruzamentos corretos em qualquer ângulo. A interpolação da
// luz em cada triângulo evita depender de WebGL e de bibliotecas externas.
function rasterizar(vertices, faces, largura, altura, imagem) {
  const zBuffer = new Float32Array(largura*altura).fill(-Infinity);
  const pixels = imagem.data;
  for (const face of faces) {
    const [a,b,c] = face.map(i => vertices[i]);
    const denom = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1]);
    if (Math.abs(denom) < .0001) continue;
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const maxX = Math.min(largura-1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const maxY = Math.min(altura-1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y=minY; y <= maxY; y++) for (let x=minX; x <= maxX; x++) {
      const dx = x+.5-c[0], dy = y+.5-c[1];
      const u = ((b[1]-c[1])*dx+(c[0]-b[0])*dy)/denom;
      const v = ((c[1]-a[1])*dx+(a[0]-c[0])*dy)/denom;
      const w = 1-u-v;
      if (u < -.00001 || v < -.00001 || w < -.00001) continue;
      const k = y*largura+x, z = a[2]*u+b[2]*v+c[2]*w;
      if (z <= zBuffer[k]) continue;
      zBuffer[k] = z;
      const grão = ((x*73 + y*37 + x*y*19)%23 - 11) * .17;
      for (let cor = 0; cor < 3; cor++) pixels[k*4+cor] = a[3+cor]*u+b[3+cor]*v+c[3+cor]*w + grão;
      pixels[k*4+3] = 255;
    }
  }
}

function desenhar(tela) {
  if (perfil.oculto || !tela.isConnected || !tela.clientWidth) return;
  const ctx = tela.getContext('2d');
  if (!ctx) return;
  const largura = limitar(Math.round(tela.clientWidth * Math.max(1.4, window.devicePixelRatio || 1)), 340, 1100);
  const altura = Math.round(largura / 1.55);
  tela.width = largura;
  tela.height = altura;
  malha ??= criarEscultura();
  const rotar = rotacao();
  const luz = normalizar([-.52, .87, .82]), reflexo = normalizar(somar(luz, [0,0,1]));
  const borda = normalizar([.8,.68,-.62]);
  const vertices = malha.pontos.map(({pos, normal, oclusao, cor}) => {
    const [x,y,z] = rotar(pos);
    const n = rotar(normal), perspectiva = 10 / (10-z);
    const incidencia = Math.max(0, produto(n, luz));
    const difusa = (.67 + .37 * incidencia + .11 * n[1]) * (1-.48*oclusao);
    const brilho = 29*Math.max(0, produto(n, reflexo))**14;
    const recorte = 12 * Math.max(0, produto(n, borda))**4;
    const tom = produto(cor,[.2126,.7152,.0722]);
    const pigmento = perfil.suaves ? cor.map(c => (c*.55 + tom*.45)*.79 + 47) : cor;
    return [x*perspectiva, -y*perspectiva, z, ...pigmento.map(c => c*difusa + brilho + recorte)];
  });
  const x = vertices.map(v => v[0]), y = vertices.map(v => v[1]);
  const minX=Math.min(...x), maxX=Math.max(...x), minY=Math.min(...y), maxY=Math.max(...y);
  const zoom = Math.min(largura*.84/(maxX-minX), altura*.84/(maxY-minY));
  for (const v of vertices) {
    v[0] = largura*.5 + (v[0]-(maxX+minX)/2)*zoom;
    v[1] = altura*.47 + (v[1]-(maxY+minY)/2)*zoom;
  }
  const imagem = ctx.createImageData(largura, altura);
  rasterizar(vertices, malha.faces, largura, altura, imagem);
  ctx.putImageData(imagem, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.translate(largura*.52, altura*.899);
  ctx.scale(largura*.30, altura*.06);
  const sombra = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  sombra.addColorStop(0,'rgba(41,43,86,.23)');
  sombra.addColorStop(.34,'rgba(51,55,99,.14)');
  sombra.addColorStop(1,'rgba(70,74,121,0)');
  ctx.fillStyle = sombra;
  ctx.fillRect(-1,-1,2,2);
  ctx.restore();
}

const glifos = {
  esquerda: '<path d="M8 5 4 9l4 4M5 9h8a6 6 0 1 1-2.6 11.4"/>',
  direita: '<path d="m16 5 4 4-4 4m3-4h-8a6 6 0 1 0 2.6 11.4"/>',
  restaurar: '<path d="M4 5v5h5M4.6 9A8 8 0 1 1 4 15"/>',
  cima: '<path d="m7 13 5-5 5 5M12 8v11"/>',
  baixo: '<path d="m7 11 5 5 5-5M12 16V5"/>',
  ocultar: '<path d="m3 3 18 18M10.6 5.6c4.1-.8 7.7 1.5 11 6.4a21 21 0 0 1-3.1 3.7M7.3 7.1A19.6 19.6 0 0 0 2.4 12c4.6 6.6 9.5 8 14.2 5.1"/>',
  mostrar: '<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
};
function icone(chave) {
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+glifos[chave]+'</svg>';
}
function botao(nome, glifo, acao) {
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', nome);
  el.title = nome;
  el.innerHTML = icone(glifo) + '<span>' + nome + '</span>';
  el.addEventListener('click', acao);
  return el;
}
export function montarAtelier(container) {
  if (!container || instalados.has(container)) return;
  instalados.add(container);
  container.classList.add('atelier');
  container.innerHTML = '<div class="atelier-head"><span class="atelier-name">Objeto 3D</span></div>' +
    '<div class="atelier-visor"><canvas tabindex="0" role="img" aria-label="Escultura abstrata de quatro fitas entrelaçadas, em azul, verde, amarelo e coral" aria-describedby="atelier-ajuda">Quatro fitas coloridas formam um nó aberto.</canvas></div>' +
    '<p class="sr-only" id="atelier-ajuda">As setas giram e inclinam o objeto. A tecla Home restaura a posição. Você também pode usar os botões.</p>' +
    '<div class="atelier-tools" role="group" aria-label="Controles do objeto 3D"></div>' +
    '<details class="atelier-extra"><summary>Mais ajustes do objeto</summary><div class="atelier-extra-opcoes">' +
    '<label><input type="checkbox"> Cores suaves</label></div></details><span class="sr-only" role="status"></span>';
  const cabecalho=container.querySelector('.atelier-head'), visor=container.querySelector('.atelier-visor');
  const tela=container.querySelector('canvas'), comandos=container.querySelector('.atelier-tools');
  const aviso=container.querySelector('[role=status]');
  const extras=container.querySelector('.atelier-extra'), extrasOpcoes=extras.querySelector('.atelier-extra-opcoes');
  const coresSuaves=extras.querySelector('input');
  let disponivel = false;
  try { disponivel = !!tela.getContext('2d'); } catch { /* Alguns navegadores bloqueiam o canvas. */ }
  if (!disponivel) {
    const legenda = document.createElement('p');
    legenda.className = 'atelier-legenda';
    legenda.textContent = 'Quatro fitas de bordas arredondadas, em azul, verde, amarelo e coral, se entrelaçam para formar um nó aberto. O recurso de rotação está indisponível neste navegador.';
    tela.hidden = true;
    visor.append(legenda);
    container.querySelector('#atelier-ajuda').hidden = true;
  }
  function alterar(giro, altura) {
    perfil.giro = ((giro % 15)+15)%15;
    perfil.altura = limitar(altura,-4,4);
    desenhar(tela);
    aviso.textContent = 'Rotação horizontal de '+(perfil.giro*24)+' graus. Inclinação de '+(perfil.altura*15)+' graus.';
  }
  comandos.append(
    botao('Girar à esquerda','esquerda', () => alterar(perfil.giro-1,perfil.altura)),
    botao('Girar à direita','direita', () => alterar(perfil.giro+1,perfil.altura)),
    botao('Restaurar posição','restaurar', () => alterar(0,0))
  );
  coresSuaves.checked = perfil.suaves;
  coresSuaves.addEventListener('change', () => {
    perfil.suaves = coresSuaves.checked;
    desenhar(tela);
  });
  extrasOpcoes.append(
    botao('Inclinar para cima','cima', () => alterar(perfil.giro,perfil.altura+1)),
    botao('Inclinar para baixo','baixo', () => alterar(perfil.giro,perfil.altura-1))
  );
  tela.addEventListener('keydown', e => {
    const chaves = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,1], ArrowDown:[0,-1] };
    if (e.key === 'Home') { e.preventDefault(); alterar(0,0); }
    else if (Object.hasOwn(chaves,e.key)) {
      e.preventDefault();
      const [x,y]=chaves[e.key];
      alterar(perfil.giro+x,perfil.altura+y);
    }
  });
  const alternar = botao('Ocultar objeto 3D','ocultar',() => {
    perfil.oculto = !perfil.oculto;
    visibilidade();
  });
  cabecalho.append(alternar);
  function visibilidade() {
    visor.hidden = perfil.oculto;
    comandos.hidden = extras.hidden = perfil.oculto || !disponivel;
    const nome = perfil.oculto ? 'Mostrar objeto 3D' : 'Ocultar objeto 3D';
    alternar.title = nome;
    alternar.setAttribute('aria-label',nome);
    alternar.setAttribute('aria-expanded',String(!perfil.oculto));
    alternar.innerHTML=icone(perfil.oculto ? 'mostrar' : 'ocultar') + '<span>'+nome+'</span>';
    if (!perfil.oculto && disponivel) desenhar(tela);
  }
  visibilidade();
  // Também redesenha quando a abertura volta ao documento depois de outra tela.
  let larguraAnterior = -1;
  new ResizeObserver(([medida]) => {
    const largura = Math.round(medida.contentRect.width);
    if (largura === larguraAnterior) return;
    larguraAnterior = largura;
    if (largura > 0 && disponivel) desenhar(tela);
  }).observe(visor);
}
