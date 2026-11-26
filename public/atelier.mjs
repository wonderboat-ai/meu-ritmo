import { criarConstelacao } from './constelacao.mjs';

const POSICAO_INICIAL = { x: -.13, y: -.22 };
const PASSO = Math.PI / 9;
const VOLTA = 2 * Math.PI;
const PERFIL = { alvo: { ...POSICAO_INICIAL }, oculto: false, suaves: false, reduzir: false, modo: 'explorar' };
const instalados = new WeakMap();
const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(valor, maximo));

const glifos = {
  esquerda: '<path d="M8 5 4 9l4 4M5 9h8a6 6 0 1 1-2.6 11.4"/>',
  direita: '<path d="m16 5 4 4-4 4m3-4h-8a6 6 0 1 0 2.6 11.4"/>',
  restaurar: '<path d="M4 5v5h5M4.6 9A8 8 0 1 1 4 15"/>',
  cima: '<path d="m7 13 5-5 5 5M12 8v11"/>',
  baixo: '<path d="m7 11 5 5 5-5M12 16V5"/>',
  pulso: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  ocultar: '<path d="m3 3 18 18M10.6 5.6c4.1-.8 7.7 1.5 11 6.4a21 21 0 0 1-3.1 3.7M7.3 7.1A19.6 19.6 0 0 0 2.4 12c4.6 6.6 9.5 8 14.2 5.1"/>',
  mostrar: '<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
};

function icone(chave) {
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + glifos[chave] + '</svg>';
}

function rotular(botao, nome, glifo) {
  botao.innerHTML = icone(glifo) + '<span>' + nome + '</span>';
}

function criarBotao(nome, glifo, acao) {
  const botao = document.createElement('button');
  botao.type = 'button';
  rotular(botao, nome, glifo);
  botao.addEventListener('click', acao);
  return botao;
}

export function suspenderAtelier(container) {
  instalados.get(container)?.suspender();
}

export function montarAtelier(container) {
  if (!container) return;
  if (instalados.has(container)) {
    instalados.get(container).retomar();
    return;
  }
  container.classList.add('atelier');
  container.innerHTML = `
    <div class="atelier-head">
      <h2 class="atelier-name">Constelação neural</h2>
      <div class="atelier-actions"></div>
    </div>
    <div class="atelier-body" id="atelier-conteudo">
      <div class="atelier-mode" role="group" aria-label="Modo da constelação">
        <button type="button" data-mode="explorar" aria-pressed="true">Explorar</button>
        <button type="button" data-mode="calmo" aria-pressed="false">Desacelerar</button>
      </div>
      <div class="atelier-stage">
        <div class="atelier-visor">
          <canvas tabindex="0" role="img" aria-label="Rede de pontos luminosos em órbitas tridimensionais"
            aria-describedby="atelier-teclado">Pontos de luz conectados formam uma rede dentro de quatro órbitas.</canvas>
        </div>
        <p class="atelier-caption"></p>
        <p class="sr-only" id="atelier-teclado">As setas giram a cena. Use Home para voltar à posição inicial. Enter envia um pulso de luz. Você também pode usar os botões.</p>
      </div>
      <div class="atelier-tools" role="group" aria-label="Controles do objeto 3D"></div>
      <details class="atelier-extra">
        <summary>Mais ajustes do objeto</summary>
        <div class="atelier-extra-opcoes">
          <label><input type="checkbox" data-suaves> Cores suaves</label>
          <label><input type="checkbox" data-reduzir> Movimento reduzido</label>
        </div>
      </details>
    </div>
    <p class="sr-only" role="status"></p>`;

  const body = container.querySelector('.atelier-body');
  const cabecalho = container.querySelector('.atelier-actions');
  const modos = container.querySelector('.atelier-mode');
  const tela = container.querySelector('canvas');
  const visor = container.querySelector('.atelier-visor');
  const comandos = container.querySelector('.atelier-tools');
  const extras = container.querySelector('.atelier-extra');
  const extrasOpcoes = extras.querySelector('.atelier-extra-opcoes');
  const coresSuaves = extras.querySelector('[data-suaves]');
  const reduzir = extras.querySelector('[data-reduzir]');
  const legenda = container.querySelector('.atelier-caption');
  const aviso = container.querySelector('[role=status]');
  const renderizador = criarConstelacao(tela);
  const preferencia = matchMedia('(prefers-reduced-motion: reduce)');
  const coresForcadas = matchMedia('(forced-colors: active)');
  const root = document.documentElement;
  const contraste = () => coresForcadas.matches || root.dataset.tema === 'contraste';
  const acalmarMovimento = () => PERFIL.reduzir || preferencia.matches || contraste();
  const camera = { ...PERFIL.alvo };
  let pontoAtivo = null;
  let pulso = null;
  let quadro = 0;
  let ultimoQuadro = 0;
  let toque = null;
  let ativo = false;

  if (!renderizador) {
    const mensagem = document.createElement('p');
    mensagem.className = 'atelier-legenda';
    mensagem.textContent = 'Pontos de luz conectados formam uma constelação cercada por quatro órbitas. O recurso de rotação está indisponível neste navegador.';
    tela.hidden = true;
    visor.append(mensagem);
    modos.hidden = comandos.hidden = extras.hidden = legenda.hidden = true;
  }

  function podeDesenhar() {
    return ativo && renderizador && !PERFIL.oculto && container.isConnected && !document.hidden;
  }

  function pararQuadro() {
    if (quadro) cancelAnimationFrame(quadro);
    quadro = ultimoQuadro = 0;
  }

  function estabilizarCamera() {
    if (!toque && Math.abs(PERFIL.alvo.y) > Math.PI) {
      PERFIL.alvo.y -= Math.round(PERFIL.alvo.y / VOLTA) * VOLTA;
    }
    Object.assign(camera, PERFIL.alvo);
  }

  function desenhar(progresso = null) {
    if (!podeDesenhar()) return;
    renderizador.desenhar({
      camera, modo: PERFIL.modo, suaves: PERFIL.suaves,
      contraste: contraste(), selecionado: pontoAtivo, progresso
    });
  }

  function desenharQuadro(agora) {
    quadro = 0;
    if (!podeDesenhar()) {
      ultimoQuadro = 0;
      pulso = null;
      return;
    }
    const dt = ultimoQuadro ? Math.min(50, agora - ultimoQuadro) : 16;
    ultimoQuadro = agora;
    const inercia = PERFIL.modo === 'calmo' ? 85 : 53;
    const fator = 1 - Math.exp(-dt / inercia);
    const distancia = Math.hypot(PERFIL.alvo.x - camera.x, PERFIL.alvo.y - camera.y);
    const seguindo = distancia > .0015;
    if (seguindo) {
      camera.x += (PERFIL.alvo.x - camera.x) * fator;
      camera.y += (PERFIL.alvo.y - camera.y) * fator;
    } else {
      estabilizarCamera();
    }
    let progresso = null;
    if (pulso) {
      progresso = limitar((agora - pulso.inicio) / pulso.duracao, 0, 1);
      if (progresso >= 1) {
        progresso = null;
        pulso = null;
      }
    }
    desenhar(progresso);
    if (seguindo || pulso) quadro = requestAnimationFrame(desenharQuadro);
    else ultimoQuadro = 0;
  }

  function atualizar() {
    if (!podeDesenhar()) return;
    if (acalmarMovimento()) {
      pararQuadro();
      pulso = null;
      estabilizarCamera();
      desenhar();
      return;
    }
    if (!quadro) quadro = requestAnimationFrame(desenharQuadro);
  }

  function mover(x, y) {
    PERFIL.alvo.x = limitar(x, -1.10, 1.05);
    PERFIL.alvo.y = y;
    atualizar();
  }

  function passo(horizontal, vertical) {
    mover(PERFIL.alvo.x + vertical * PASSO * .76, PERFIL.alvo.y + horizontal * PASSO);
    const giro = Math.round(((PERFIL.alvo.y - POSICAO_INICIAL.y) * 180 / Math.PI % 360 + 360) % 360);
    const inclinacao = Math.round((PERFIL.alvo.x - POSICAO_INICIAL.x) * 180 / Math.PI);
    aviso.textContent = 'Rotação horizontal de ' + giro + ' graus. Inclinação de ' + inclinacao + ' graus.';
  }

  function restaurar() {
    pontoAtivo = null;
    pulso = null;
    const voltasCompletas = Math.round((camera.y - POSICAO_INICIAL.y) / VOLTA);
    mover(POSICAO_INICIAL.x, POSICAO_INICIAL.y + voltasCompletas * VOLTA);
    aviso.textContent = 'Posição inicial restaurada.';
  }

  function enviarPulso(indice = null) {
    if (!podeDesenhar()) return;
    const limite = renderizador.quantidade;
    pontoAtivo = indice ?? ((pontoAtivo ?? 59) + 23) % limite;
    if (!acalmarMovimento()) {
      pulso = { inicio: performance.now(), duracao: PERFIL.modo === 'calmo' ? 700 : 820 };
    }
    aviso.textContent = acalmarMovimento() ? 'Ponto de luz destacado.' : 'Pulso de luz enviado.';
    atualizar();
  }

  const pulsoBotao = criarBotao('Enviar pulso', 'pulso', () => enviarPulso());
  pulsoBotao.classList.add('atelier-signal');
  comandos.append(
    criarBotao('Girar à esquerda', 'esquerda', () => passo(-1, 0)),
    criarBotao('Girar à direita', 'direita', () => passo(1, 0)),
    criarBotao('Restaurar posição', 'restaurar', restaurar),
    pulsoBotao
  );
  extrasOpcoes.append(
    criarBotao('Inclinar para cima', 'cima', () => passo(0, 1)),
    criarBotao('Inclinar para baixo', 'baixo', () => passo(0, -1))
  );
  coresSuaves.checked = PERFIL.suaves;
  coresSuaves.addEventListener('change', () => {
    PERFIL.suaves = coresSuaves.checked;
    atualizar();
  });
  reduzir.checked = PERFIL.reduzir;
  reduzir.addEventListener('change', () => {
    PERFIL.reduzir = reduzir.checked;
    atualizar();
  });

  function aplicarModo() {
    const calmo = PERFIL.modo === 'calmo';
    container.dataset.modo = PERFIL.modo;
    for (const botao of modos.querySelectorAll('button')) {
      botao.setAttribute('aria-pressed', String(botao.dataset.mode === PERFIL.modo));
    }
    legenda.textContent = calmo
      ? 'Explore devagar, um pulso de luz de cada vez.'
      : 'Arraste para girar. Toque na cena ou envie um pulso de luz.';
  }

  modos.addEventListener('click', event => {
    const botao = event.target.closest('button[data-mode]');
    if (!botao || botao.dataset.mode === PERFIL.modo) return;
    PERFIL.modo = botao.dataset.mode;
    pulso = null;
    pontoAtivo = null;
    aplicarModo();
    atualizar();
  });

  const teclas = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1]
  };
  tela.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (Object.hasOwn(teclas, event.key)) {
      event.preventDefault();
      passo(...teclas[event.key]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      restaurar();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) enviarPulso();
    }
  });

  function encerrarToque() {
    const id = toque?.id;
    toque = null;
    delete tela.dataset.arrastando;
    if (id !== undefined && tela.hasPointerCapture(id)) tela.releasePointerCapture(id);
  }

  tela.addEventListener('pointerdown', event => {
    if (!event.isPrimary) {
      encerrarToque();
      return;
    }
    if (event.button !== 0) return;
    toque = {
      id: event.pointerId,
      origemX: event.clientX, origemY: event.clientY,
      anteriorX: event.clientX, anteriorY: event.clientY,
      instante: event.timeStamp, velocidadeX: 0, velocidadeY: 0,
      inicio: { ...PERFIL.alvo },
      arrastando: false
    };
    if (event.pointerType === 'mouse') tela.setPointerCapture(event.pointerId);
  });
  function sensibilidade() {
    return (PERFIL.modo === 'calmo' ? 2.05 : 3.65) / Math.max(250, tela.clientWidth);
  }
  function arrastar(dx, dy) {
    const ganho = sensibilidade();
    mover(toque.inicio.x + dy * ganho, toque.inicio.y + dx * ganho);
  }
  tela.addEventListener('pointermove', event => {
    if (toque?.id !== event.pointerId) return;
    const dx = event.clientX - toque.origemX;
    const dy = event.clientY - toque.origemY;
    if (!toque.arrastando) {
      if (Math.hypot(dx, dy) < 7) return;
      if (event.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) {
        encerrarToque();
        return;
      }
      toque.arrastando = true;
      tela.dataset.arrastando = 'true';
      tela.setPointerCapture(event.pointerId);
    }
    const dt = Math.max(1, event.timeStamp - toque.instante);
    toque.velocidadeX = (event.clientX - toque.anteriorX) / dt;
    toque.velocidadeY = (event.clientY - toque.anteriorY) / dt;
    toque.anteriorX = event.clientX;
    toque.anteriorY = event.clientY;
    toque.instante = event.timeStamp;
    if (!acalmarMovimento()) arrastar(dx, dy);
  });
  tela.addEventListener('pointerup', event => {
    if (toque?.id !== event.pointerId) return;
    if (toque.arrastando) {
      const dx = event.clientX - toque.origemX;
      const dy = event.clientY - toque.origemY;
      const impulso = !acalmarMovimento() && PERFIL.modo === 'explorar' && event.timeStamp - toque.instante < 90 ? 63 : 0;
      arrastar(dx + limitar(toque.velocidadeX * impulso, -52, 52),
        dy + limitar(toque.velocidadeY * impulso, -42, 42));
    } else {
      const dimensoes = tela.getBoundingClientRect();
      enviarPulso(renderizador.noMaisProximo(event.clientX - dimensoes.left, event.clientY - dimensoes.top));
    }
    encerrarToque();
  });
  tela.addEventListener('pointercancel', encerrarToque);
  tela.addEventListener('lostpointercapture', encerrarToque);

  const alternar = criarBotao('Ocultar objeto 3D', 'ocultar', () => {
    PERFIL.oculto = !PERFIL.oculto;
    atualizarVisibilidade();
  });
  alternar.setAttribute('aria-controls', body.id);
  cabecalho.append(alternar);

  function atualizarVisibilidade() {
    body.hidden = PERFIL.oculto;
    const oculto = PERFIL.oculto;
    const nome = oculto ? 'Mostrar objeto 3D' : 'Ocultar objeto 3D';
    rotular(alternar, nome, oculto ? 'mostrar' : 'ocultar');
    alternar.setAttribute('aria-expanded', String(!oculto));
    if (oculto) {
      pararQuadro();
      encerrarToque();
      pulso = null;
      estabilizarCamera();
    } else {
      desenhar();
    }
  }

  const tamanho = new ResizeObserver(() => desenhar());
  const tema = new MutationObserver(() => atualizar());
  const estado = {
    retomar() {
      if (!ativo) {
        ativo = true;
        tamanho.observe(visor);
        tema.observe(root, { attributes: true, attributeFilter: ['data-tema'] });
        preferencia.addEventListener('change', atualizar);
        coresForcadas.addEventListener('change', atualizar);
      }
      aplicarModo();
      atualizarVisibilidade();
    },
    suspender() {
      ativo = false;
      tamanho.disconnect();
      tema.disconnect();
      preferencia.removeEventListener('change', atualizar);
      coresForcadas.removeEventListener('change', atualizar);
      pararQuadro();
      encerrarToque();
      pontoAtivo = pulso = null;
      estabilizarCamera();
    }
  };
  instalados.set(container, estado);
  estado.retomar();
}
