import { lerBanco } from './motor.mjs';
import { iniciarFluxo, renderFluxo, temSessao, telaSessao, limparFluxo, atualizarProgresso } from './fluxo.mjs';
import { htmlInformacao, htmlPrivacidade } from './informacao.mjs';
import { montarAtelier, suspenderAtelier } from './atelier.mjs';

const main = document.querySelector('main');
const dialog = document.querySelector('#ajustes');
const root = document.documentElement;
const barra = document.querySelector('#barra');
const trigger = document.querySelector('#abrir-leitura');
const header = document.querySelector('.header-inner');
const nav = header.querySelector('nav');
const narrow = window.matchMedia('(max-width: 42em)');
function ordenarCabecalho() {
  const ativo = document.activeElement;
  if (narrow.matches) header.append(nav);
  else trigger.before(nav);
  if (nav.contains(ativo)) ativo.focus({ preventScroll: true });
}
ordenarCabecalho();
narrow.addEventListener('change', ordenarCabecalho);
const home = document.querySelector('#home').content.firstElementChild.cloneNode(true);
const atelier = home.querySelector('#atelier');
const voltarDaPausa = home.querySelector('[data-voltar-da-pausa]');
const titulos = {
  inicio: 'Um questionário sobre o seu cotidiano', comecar: 'Antes de começar',
  sobre: 'Sobre autismo, TDAH e os instrumentos', privacidade: 'Privacidade',
  pergunta: 'Questionário', pausa: 'Questionário pausado', resumo: 'Meu resumo',
  revisao: 'Revisar respostas', apagar: 'Apagar e sair'
};
let bancoPronto = false;
let carregandoBanco = true;
let telaVisivel = 'inicio';

const icones = {
  pages: '<rect x="8" y="4" width="12" height="15" rx="2"/><path d="M5 8v12a2 2 0 0 0 2 2h9M11 9h6m-6 4h5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6m4-6v6"/>'
};
for (const icon of home.querySelectorAll('[data-icon]')) {
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">' + icones[icon.dataset.icon] + '</svg>';
}

function destinoDaRodada() {
  return temSessao() ? telaSessao() : 'comecar';
}
function botaoDeRetorno() {
  const btn = document.createElement('button');
  btn.className = 'button-secondary';
  btn.type = 'button';
  btn.textContent = temSessao() ? 'Voltar à minha rodada' : 'Voltar ao início';
  btn.addEventListener('click', () => go(temSessao() ? telaSessao() : 'inicio'));
  return btn;
}
function go(screen, focus = true) {
  const pausaInterativa = screen === 'atelier' && temSessao() && telaSessao() === 'pausa';
  if (pausaInterativa) screen = 'inicio';
  if (!Object.hasOwn(titulos, screen)) return;
  telaVisivel = screen;
  const isHome = screen === 'inicio';
  const isInfo = screen === 'sobre' || screen === 'privacidade';
  if (!isHome && atelier.isConnected) suspenderAtelier(atelier);
  for (const btn of document.querySelectorAll('header .nav-link')) {
    if (btn.dataset.go === screen) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  document.title = 'Meu ritmo — ' + titulos[screen];
  if (isHome) {
    home.querySelector('[data-start]').textContent = temSessao() ? 'Voltar à minha rodada' : 'Começar';
    voltarDaPausa.hidden = !pausaInterativa;
    main.replaceChildren(home);
    montarAtelier(atelier);
  } else if (isInfo) {
    main.innerHTML = screen === 'sobre' ? htmlInformacao : htmlPrivacidade;
    main.firstElementChild.prepend(botaoDeRetorno());
  } else if (bancoPronto) {
    renderFluxo({ screen, main, go, progressVisible: barra.checked });
  } else if (carregandoBanco) {
    main.innerHTML = '<section class="reading-page"><h1 tabindex="-1" data-page-focus>Carregando as situações</h1><button class="button-secondary" data-go="sobre">Explorar o conteúdo informativo</button></section>';
  } else {
    main.innerHTML = '<section class="reading-page"><h1 tabindex="-1" data-page-focus>O banco de situações está indisponível</h1><p>Atualize a página para tentar carregar as perguntas. O conteúdo informativo continua disponível.</p><button class="button-secondary" data-go="sobre">Explorar o conteúdo informativo</button></section>';
  }
  if (focus) {
    if (pausaInterativa) {
      voltarDaPausa.focus({ preventScroll: true });
      voltarDaPausa.scrollIntoView({ block: 'center' });
      return;
    }
    const heading = main.querySelector('[data-page-focus]');
    heading?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    // No zoom, um cabeçalho em várias linhas pode ocupar a área visível.
    if (heading && heading.getBoundingClientRect().top >= window.innerHeight) heading.scrollIntoView({ block: 'start' });
  }
}
document.addEventListener('click', event => {
  const start = event.target.closest('[data-start]');
  if (start) {
    go(destinoDaRodada());
    return;
  }
  const link = event.target.closest('[data-go]');
  if (link) go(link.dataset.go);
});
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ block: 'start' });
});

function aplicarLeitura() {
  for (const name of ['tema', 'tamanho', 'espacamento']) {
    root.dataset[name] = dialog.querySelector('input[name="' + name + '"]:checked').value;
  }
  atualizarProgresso(barra.checked);
}
trigger.addEventListener('click', () => {
  dialog.showModal();
  dialog.querySelector('.dialog-body').scrollTop = 0;
  document.querySelector('#titulo-ajustes').focus();
});
dialog.addEventListener('change', aplicarLeitura);
for (const close of dialog.querySelectorAll('[data-close]')) {
  close.addEventListener('click', () => dialog.close());
}
dialog.addEventListener('close', () => {
  document.querySelector('#aviso-ajustes').textContent = '';
  if (!dialog.open && document.activeElement === document.body) trigger.focus();
});
document.querySelector('#restaurar').addEventListener('click', () => {
  for (const input of dialog.querySelectorAll('input')) input.checked = input.defaultChecked;
  aplicarLeitura();
  document.querySelector('#aviso-ajustes').textContent = 'Leitura padrão restaurada.';
});
function apagarAoSair() {
  limparFluxo();
  if (dialog.open) dialog.close();
  go('inicio', false);
  suspenderAtelier(atelier);
}
window.addEventListener('pagehide', apagarAoSair);
window.addEventListener('pageshow', event => {
  if (event.persisted) go('inicio');
});
document.addEventListener('visibilitychange', () => {
  if (!atelier.isConnected) return;
  if (document.hidden) suspenderAtelier(atelier);
  else montarAtelier(atelier);
});

aplicarLeitura();
go('inicio', false);
// O pedido HTTP é fixo, anterior à sessão e independe das respostas.
try {
  const incorporado = document.getElementById('banco-local');
  let texto;
  if (incorporado) {
    texto = incorporado.textContent;
  } else {
    const url = new URL('./banco-v1.txt', document.baseURI);
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Banco indisponível');
    texto = await response.text();
  }
  iniciarFluxo(lerBanco(texto));
  bancoPronto = true;
} catch {
  // A educação e as preferências permanecem disponíveis mesmo sem o recurso.
} finally {
  carregandoBanco = false;
  if (telaVisivel === 'comecar') go('comecar');
}
