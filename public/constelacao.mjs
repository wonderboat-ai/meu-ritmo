// Cena projetada em perspectiva. As trilhas e conexões são geradas uma vez.
const TAU = 2 * Math.PI;
const AZUL = 0;
const VERDE = 1;
const AMARELO = 2;
const VERMELHO = 3;
const PALETAS = {
  viva: ['81,168,255', '56,239,172', '255,218,98', '255,99,124'],
  suave: ['111,158,211', '115,183,159', '206,176,111', '206,131,149'],
  calma: ['94,147,199', '100,174,150', '184,155,106', '166,110,135'],
  calmaSuave: ['111,137,164', '118,153,141', '159,146,120', '148,119,131']
};

function sorteador(semente) {
  return () => {
    semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0;
    return semente / 4294967296;
  };
}

function criarMalha() {
  const aleatorio = sorteador(14651);
  const anguloDourado = Math.PI * (3 - Math.sqrt(5));
  const quantidade = 178;
  const nos = Array.from({ length: quantidade }, (_, i) => {
    const y = 1 - 2 * (i + .5) / quantidade;
    const angulo = i * anguloDourado + .24 * (aleatorio() - .5);
    const raio = Math.sqrt(1 - y * y) * (.94 + .12 * aleatorio());
    const x = raio * Math.cos(angulo);
    const z = raio * Math.sin(angulo);
    const cor = x > .21 ? (y > -.06 ? AZUL : VERDE)
      : x < -.22 ? (y > .05 ? VERMELHO : AMARELO)
      : Math.floor(aleatorio() * 4);
    const escala = i % 9 === 0 ? .77 : 1;
    const ondulacao = .05 * Math.sin(angulo * 4 + y * 8);
    return {
      x: x * escala * (1.47 + ondulacao),
      y: y * escala * (1.04 - .15 * Math.exp(-48 * x * x) + ondulacao),
      z: z * escala * (1 + ondulacao),
      cor,
      brilho: .42 + .58 * aleatorio()
    };
  });
  const ligacoes = [];
  const usadas = new Set();
  for (const [i, a] of nos.entries()) {
    const maisProximos = nos.map((b, j) => [j, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)])
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1]);
    for (const [j] of maisProximos.slice(0, i % 4 ? 3 : 5)) {
      const chave = Math.min(i, j) * quantidade + Math.max(i, j);
      if (usadas.has(chave)) continue;
      usadas.add(chave);
      ligacoes.push({ a: i, b: j, cor: a.cor });
    }
  }
  return { nos, ligacoes };
}

function criarTrilhas() {
  const voltas = [
    { raio: 1.85, inclinacao: .69, giro: -.19, cor: AZUL, satelite: 20 },
    { raio: 1.98, inclinacao: -.70, giro: .53, cor: VERDE, satelite: 55 },
    { raio: 2.16, inclinacao: .91, giro: .96, cor: AMARELO, satelite: 68 },
    { raio: 2.34, inclinacao: -.41, giro: -.72, cor: VERMELHO, satelite: 42 }
  ];
  return voltas.map(volta => {
    const { raio, inclinacao, giro } = volta;
    const seno = Math.sin(giro);
    const cosseno = Math.cos(giro);
    const pontos = Array.from({ length: 96 }, (_, i) => {
      const angulo = i / 96 * TAU;
      const x = Math.cos(angulo) * raio;
      const y = Math.sin(angulo) * raio * Math.cos(inclinacao) * .56;
      return {
        x: x * cosseno - y * seno,
        y: x * seno + y * cosseno,
        z: Math.sin(angulo) * raio * Math.sin(inclinacao)
      };
    });
    return { ...volta, pontos };
  });
}

const { nos, ligacoes } = criarMalha();
const trilhas = criarTrilhas();
const formarPx = (cor, alfa) => 'rgba(' + cor + ',' + alfa + ')';
const limitar = (valor, menor, maior) => Math.min(maior, Math.max(menor, valor));

function projetor(largura, altura, camera) {
  const centroX = largura * .5;
  const centroY = altura * .46;
  const escala = Math.min(largura / 5.55, altura / 3.72);
  const senoX = Math.sin(camera.x);
  const cossenoX = Math.cos(camera.x);
  const senoY = Math.sin(camera.y);
  const cossenoY = Math.cos(camera.y);
  return ponto => {
    const x = ponto.x * cossenoY + ponto.z * senoY;
    const z = ponto.z * cossenoY - ponto.x * senoY;
    const y = ponto.y * cossenoX - z * senoX;
    const profundidade = ponto.y * senoX + z * cossenoX;
    const perspectiva = 7.3 / (7.3 - profundidade);
    return {
      x: centroX + x * escala * perspectiva,
      y: centroY - y * escala * perspectiva,
      z: profundidade,
      escala: perspectiva
    };
  };
}

function circulo(ctx, x, y, raio, cor) {
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, TAU);
  ctx.fillStyle = cor;
  ctx.fill();
}

function segmento(ctx, a, b, cor, espessura = 1) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = cor;
  ctx.lineWidth = espessura;
  ctx.stroke();
}

function elipse(ctx, x, y, raioX, raioY, cor, espessura = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, raioX, raioY, 0, 0, TAU);
  ctx.strokeStyle = cor;
  ctx.lineWidth = espessura;
  ctx.stroke();
}

function aura(ctx, x, y, raio, cor, intensidade) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, raio);
  halo.addColorStop(0, formarPx(cor, intensidade));
  halo.addColorStop(.38, formarPx(cor, intensidade * .32));
  halo.addColorStop(1, formarPx(cor, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
}

function desenharFundo(ctx, largura, altura, paleta, calmo) {
  ctx.fillStyle = '#070f22';
  ctx.fillRect(0, 0, largura, altura);
  aura(ctx, largura * .5, altura * .51, largura * .59, paleta[AZUL], calmo ? .13 : .27);
  if (!calmo) {
    aura(ctx, largura * .13, altura * .26, largura * .45, paleta[VERMELHO], .071);
    aura(ctx, largura * .84, altura * .28, largura * .38, paleta[VERDE], .06);
  }
  const aleatorio = sorteador(1801);
  const alturaHorizonte = altura * .69;
  for (let i = 0; i < (calmo ? 31 : 112); i++) {
    const x = aleatorio() * largura;
    const y = aleatorio() * alturaHorizonte;
    const tamanho = aleatorio();
    const alfa = (calmo ? .23 : .49) * (.18 + tamanho * .82);
    circulo(ctx, x, y, .36 + tamanho * .77, formarPx('201,223,255', alfa));
    if (!calmo && i % 19 === 0) {
      segmento(ctx, { x: x - 2.8, y }, { x: x + 2.8, y }, formarPx('151,202,255', alfa));
      segmento(ctx, { x, y: y - 2.8 }, { x, y: y + 2.8 }, formarPx('151,202,255', alfa));
    }
  }

  const plataformaY = altura * .81;
  const modulo = Math.min(largura, altura * 1.35);
  const centro = largura * .5;
  const linha = formarPx(paleta[AZUL], calmo ? .10 : .16);
  for (let i = -8; i <= 8; i++) {
    segmento(ctx, { x: centro + i * largura * .045, y: alturaHorizonte },
      { x: centro + i * largura * .102, y: altura }, linha, .65);
  }
  for (const fracao of [.695, .717, .752, .80, .874, .979]) {
    const y = altura * fracao;
    segmento(ctx, { x: 0, y }, { x: largura, y }, linha, .65);
  }

  const r = modulo * .258;
  aura(ctx, centro, plataformaY, r * 1.21, paleta[AZUL], calmo ? .15 : .27);
  const bordo = formarPx(paleta[AZUL], calmo ? .34 : .61);
  elipse(ctx, centro, plataformaY, r * 1.26, r * .225, bordo, 1);
  elipse(ctx, centro, plataformaY, r * 1.14, r * .192, linha, 1);
  elipse(ctx, centro, plataformaY, r * .84, r * .146, bordo, .7);
  elipse(ctx, centro, plataformaY, r * .55, r * .093, linha, .8);
  elipse(ctx, centro, plataformaY, r * .27, r * .052, bordo, .75);

  if (calmo) return;
  const feixe = ctx.createLinearGradient(0, altura * .43, 0, plataformaY);
  feixe.addColorStop(0, formarPx(paleta[AZUL], 0));
  feixe.addColorStop(.72, formarPx(paleta[AZUL], .04));
  feixe.addColorStop(1, formarPx(paleta[AZUL], .47));
  ctx.fillStyle = feixe;
  ctx.beginPath();
  ctx.moveTo(centro - r * .7, altura * .43);
  ctx.lineTo(centro + r * .7, altura * .43);
  ctx.lineTo(centro + r * .12, plataformaY);
  ctx.lineTo(centro - r * .12, plataformaY);
  ctx.closePath();
  ctx.fill();
  for (let cor = 0; cor < paleta.length; cor++) {
    const sinal = cor % 2 ? 1 : -1;
    const larguraTrilha = .17 + Math.floor(cor / 2) * .073;
    const pontos = [
      { x: centro + sinal * r * 1.2, y: plataformaY + r * .09 * (cor - 1.5) },
      { x: centro + sinal * largura * larguraTrilha, y: plataformaY + r * .09 * (cor - 1.5) },
      { x: centro + sinal * largura * (larguraTrilha + .063), y: altura * (.911 + cor * .007) },
      { x: centro + sinal * largura * .467, y: altura * (.911 + cor * .007) }
    ];
    for (let i = 1; i < pontos.length; i++) {
      segmento(ctx, pontos[i - 1], pontos[i], formarPx(paleta[cor], .25), .8);
    }
    const terminal = pontos.at(-1);
    circulo(ctx, terminal.x, terminal.y, 2.2, formarPx(paleta[cor], .70));
  }
}

function desenharOrbitas(ctx, plano, paleta, frente, calmo) {
  for (const orbita of plano) {
    if (calmo && orbita.cor !== AZUL && orbita.cor !== VERDE) continue;
    const cor = paleta[orbita.cor];
    for (let i = 0; i < orbita.pontos.length; i++) {
      const a = orbita.pontos[i];
      const b = orbita.pontos[(i + 1) % orbita.pontos.length];
      const z = (a.z + b.z) * .5;
      if ((z > .08) !== frente) continue;
      const onda = .65 + .35 * Math.cos(i / orbita.pontos.length * TAU + orbita.cor);
      const intensidade = (frente ? .65 : .22) * onda * (calmo ? .64 : 1);
      if (frente && !calmo) segmento(ctx, a, b, formarPx(cor, intensidade * .21), 3.2);
      segmento(ctx, a, b, formarPx(cor, intensidade), frente ? 1.08 : .74);
    }
    const marcador = orbita.pontos[orbita.satelite];
    if ((marcador.z > .08) === frente) {
      aura(ctx, marcador.x, marcador.y, frente ? 13 : 8, cor, calmo ? .16 : .54);
      circulo(ctx, marcador.x, marcador.y, frente ? 2.6 : 1.5, formarPx(cor, frente ? .9 : .46));
    }
  }
}

function desenharMalha(ctx, plano, paleta, calmo, indiceSelecionado) {
  for (const [i, { a, b, cor }] of ligacoes.entries()) {
    if (calmo && i % 3 === 0) continue;
    const esquerda = plano[a];
    const direita = plano[b];
    const frente = limitar(((esquerda.z + direita.z) * .5 + 1) / 2, 0, 1);
    segmento(ctx, esquerda, direita, formarPx(paleta[cor], (.12 + frente * .39) * (calmo ? .58 : 1)), .56 + frente * .46);
  }
  for (const [indice, ponto] of plano.entries()) {
    if (calmo && indice % 3 === 0 && indice !== indiceSelecionado) continue;
    const no = nos[indice];
    const frente = limitar((ponto.z + 1) / 2, 0, 1);
    const raio = (.77 + no.brilho * .84) * ponto.escala;
    const cor = paleta[no.cor];
    if (!calmo && frente > .53 && indice % 5 === 0) aura(ctx, ponto.x, ponto.y, raio * 4.5, cor, .42);
    circulo(ctx, ponto.x, ponto.y, raio, formarPx(cor, (.40 + frente * .58) * (calmo ? .76 : 1)));
    if (!calmo && frente > .68 && indice % 5 === 0) circulo(ctx, ponto.x, ponto.y, raio * .39, 'rgba(229,246,255,.91)');
  }
}

function desenharPulso(ctx, plano, paleta, indice, progresso, calmo) {
  const centro = plano[indice];
  const cor = paleta[nos[indice].cor];
  aura(ctx, centro.x, centro.y, 17, cor, calmo ? .25 : .54);
  elipse(ctx, centro.x, centro.y, 5.6, 5.6, formarPx(cor, .84), 1);
  circulo(ctx, centro.x, centro.y, 2.1, '#f1f7ff');
  if (progresso === null) return;
  const distancia = progresso * (calmo ? 48 : 92);
  const alfa = Math.sin(progresso * Math.PI) * (calmo ? .30 : .66);
  if (distancia > 1) elipse(ctx, centro.x, centro.y, distancia, distancia, formarPx(cor, alfa), 1);
  for (const ligacao of ligacoes) {
    if (ligacao.a !== indice && ligacao.b !== indice) continue;
    const destino = plano[ligacao.a === indice ? ligacao.b : ligacao.a];
    const alcance = Math.min(1, progresso * 2.1);
    segmento(ctx, centro, {
      x: centro.x + (destino.x - centro.x) * alcance,
      y: centro.y + (destino.y - centro.y) * alcance
    }, formarPx(cor, alfa), 1.5);
  }
}

export function criarConstelacao(canvas) {
  let ctx;
  try { ctx = canvas.getContext('2d'); } catch { return null; }
  if (!ctx) return null;
  const brilho = canvas.ownerDocument.createElement('canvas');
  const fundo = brilho.getContext('2d');
  let plano = [];
  let chaveFundo = '';

  function desenhar({ camera, modo, suaves, contraste, selecionado, progresso }) {
    if (!canvas.isConnected || canvas.closest('[hidden]')) return;
    const { width: largura, height: altura } = canvas.getBoundingClientRect();
    if (largura < 1 || altura < 1) return;
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    const pixelsX = Math.round(largura * dpr);
    const pixelsY = Math.round(altura * dpr);
    const calmo = modo === 'calmo' || contraste;
    const gama = calmo ? (suaves ? 'calmaSuave' : 'calma') : (suaves ? 'suave' : 'viva');
    const paleta = PALETAS[gama];
    if (canvas.width !== pixelsX || canvas.height !== pixelsY) {
      canvas.width = pixelsX;
      canvas.height = pixelsY;
    }
    const chave = pixelsX + 'x' + pixelsY + '/' + gama;
    if (fundo && chave !== chaveFundo) {
      brilho.width = pixelsX;
      brilho.height = pixelsY;
      fundo.setTransform(pixelsX / largura, 0, 0, pixelsY / altura, 0, 0);
      desenharFundo(fundo, largura, altura, paleta, calmo);
      chaveFundo = chave;
    }
    ctx.setTransform(pixelsX / largura, 0, 0, pixelsY / altura, 0, 0);
    if (fundo) ctx.drawImage(brilho, 0, 0, largura, altura);
    else desenharFundo(ctx, largura, altura, paleta, calmo);
    const projetar = projetor(largura, altura, camera);
    plano = nos.map(projetar);
    const orbital = trilhas.map(trilha => ({ ...trilha, pontos: trilha.pontos.map(projetar) }));
    desenharOrbitas(ctx, orbital, paleta, false, calmo);
    const centro = projetar({ x: 0, y: 0, z: 0 });
    aura(ctx, centro.x, centro.y, altura * .335, paleta[AZUL], calmo ? .11 : .22);
    desenharMalha(ctx, plano, paleta, calmo, selecionado);
    desenharOrbitas(ctx, orbital, paleta, true, calmo);
    if (selecionado !== null) desenharPulso(ctx, plano, paleta, selecionado, progresso, calmo);
  }

  function noMaisProximo(x, y) {
    let menor = Infinity;
    let indice = 0;
    for (const [i, ponto] of plano.entries()) {
      const distancia = Math.hypot(ponto.x - x, ponto.y - y) - ponto.z * 2.5;
      if (distancia >= menor) continue;
      menor = distancia;
      indice = i;
    }
    return indice;
  }

  return { desenhar, noMaisProximo, quantidade: nos.length };
}
