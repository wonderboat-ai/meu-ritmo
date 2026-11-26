import { OPCOES, criarRodada, responder, resumir } from './motor.mjs';
import { montarDevolutiva, ORIENTACAO_CONSULTA, PASSOS_CONSULTA, URL_SUS } from './devolutiva.mjs';
import { baixarRelatorio } from './relatorio.mjs';

const LIMITE_DA_RODADA = 'Este questionário descreve suas experiências nas últimas quatro semanas. As 50 perguntas não foram validadas para confirmar ou descartar traços de autismo ou sinais de TDAH. Em uma avaliação, o profissional considera desde quando essas experiências acontecem, em quais ambientes e como afetam sua rotina.';
const CRITERIO_DO_RANKING = 'A ordem usa a proporção de “Muitas vezes” ou “Quase sempre ou sempre” entre as respostas com frequência de cada tema. Para ter posição, o tema precisa de duas ou mais frequências informadas e ao menos uma das duas respostas mais altas. “Não vivi essa situação” e “Prefiro pular” ficam fora da conta.';
const TAMANHO_ETAPA = 10;
const ETAPAS = 5;
const INICIO_DA_RODADA = 'A jornada tem cinco etapas de dez perguntas. Pular uma situação também conclui aquele passo. Você pode pausar, voltar e retomar no seu ritmo.';
const MARCAS = [
  { estado: 'low', simbolo: '○', legenda: 'Nunca ou às vezes' },
  { estado: 'high', simbolo: '●', legenda: 'Muitas vezes ou quase sempre' },
  { estado: 'none', simbolo: '◇', legenda: 'Não vivi essa situação' },
  { estado: 'skipped', simbolo: '–', legenda: 'Prefiro pular' }
];

let banco = [];
let rodada = null;
let posicao = 0;
let maiorDeIdade = false;
let revisando = false;
let telaAtual = 'comecar';
let origemDaExclusao = 'pergunta';

export function iniciarFluxo(itens) {
  banco = itens;
}

export function temSessao() {
  return rodada !== null;
}

export function telaSessao() {
  return rodada ? telaAtual : 'comecar';
}

function elemento(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

function botao(rotulo, acao, classe = 'button-secondary') {
  const no = elemento('button', classe, rotulo);
  no.type = 'button';
  no.addEventListener('click', acao);
  return no;
}

function titulo(texto) {
  const no = elemento('h1', '', texto);
  no.tabIndex = -1;
  no.setAttribute('data-page-focus', '');
  return no;
}

function descricao(texto, classe = 'flow-note') {
  return elemento('p', classe, texto);
}

function acoes(...nos) {
  const linha = elemento('div', 'flow-actions');
  linha.append(...nos);
  return linha;
}

function erroDeEscolha(texto) {
  const erro = descricao(texto, 'flow-error');
  erro.hidden = true;
  erro.tabIndex = -1;
  return erro;
}

function mostrarErro(no) {
  no.hidden = false;
  no.focus();
}

function iniciarRodada(idsExcluidos = []) {
  rodada = criarRodada(banco, idsExcluidos);
  posicao = 0;
  revisando = false;
}

export function limparFluxo() {
  rodada?.respostas.clear();
  rodada = null;
  posicao = 0;
  maiorDeIdade = false;
  revisando = false;
  telaAtual = 'comecar';
  origemDaExclusao = 'pergunta';
}

function orientacao() {
  const ajuda = elemento('details', 'flow-help');
  ajuda.append(
    elemento('summary', '', 'Como escolher uma resposta'),
    descricao('“Nunca” significa que você viveu a situação e o fato descrito não aconteceu. Marque “Não vivi essa situação” quando não surgiu uma ocasião para responder. Você também pode escolher “Prefiro pular”.')
  );
  return ajuda;
}

function jornada(etapaAtual, concluidas, visivel, descricaoEtapa) {
  const bloco = elemento('section', 'journey');
  bloco.dataset.jornada = '';
  bloco.dataset.progressoVisual = '';
  bloco.hidden = !visivel;
  const cabecalho = elemento('div', 'journey-header');
  const lista = elemento('ol', 'journey-route');
  lista.setAttribute('aria-label', 'Etapas da jornada');
  lista.setAttribute('role', 'list');
  for (let etapa = 1; etapa <= ETAPAS; etapa++) {
    const marco = elemento('li');
    marco.dataset.etapa = etapa;
    marco.dataset.state = etapa === etapaAtual ? 'current' : etapa <= concluidas ? 'complete' : 'upcoming';
    const numero = elemento('span', 'journey-step-number', String(etapa));
    numero.setAttribute('aria-hidden', 'true');
    const rotulo = elemento('span', 'sr-only', `Etapa ${etapa}`);
    marco.append(numero, rotulo);
    if (etapa === etapaAtual) marco.setAttribute('aria-current', 'step');
    if (etapa <= concluidas) marco.append(elemento('span', 'sr-only', 'Concluída'));
    lista.append(marco);
  }
  cabecalho.append(elemento('h2', '', 'Sua jornada'));
  bloco.append(cabecalho, lista, descricao(descricaoEtapa, 'journey-caption'));
  return bloco;
}

function etapaDaPergunta(numero) {
  return Math.ceil(numero / TAMANHO_ETAPA);
}

function entrada(pagina, go, progressoVisivel) {
  const abertura = elemento('header', 'flow-heading');
  abertura.append(
    titulo('Antes de começar'),
    descricao('Pense nas últimas quatro semanas. Você verá 50 situações, uma por vez, e poderá voltar ou pausar quando quiser. No fim, você verá os temas com respostas mais frequentes e poderá baixar todas as suas respostas em PDF.', 'flow-lead')
  );
  pagina.append(
    abertura,
    jornada(null, 0, progressoVisivel, INICIO_DA_RODADA),
    descricao('Este questionário é de reflexão pessoal. Não foi validado para rastrear ou diagnosticar autismo ou TDAH.', 'flow-callout'),
    descricao('A pausa funciona enquanto esta aba estiver aberta. Atualizar ou fechar esta página apaga suas respostas e seu progresso.'),
    orientacao()
  );
  const form = elemento('form', 'flow-form flow-start');
  form.autocomplete = 'off';
  const erro = erroDeEscolha('Para começar o questionário, confirme que tem 18 anos ou mais. Você também pode explorar o conteúdo informativo.');
  const rotulo = elemento('label', 'flow-check');
  const idade = elemento('input');
  idade.type = 'checkbox';
  idade.checked = maiorDeIdade;
  idade.addEventListener('change', () => {
    maiorDeIdade = idade.checked;
    erro.hidden = true;
  });
  rotulo.append(idade, elemento('span', '', 'Tenho 18 anos ou mais'));
  const iniciar = elemento('button', 'button-primary', rodada ? 'Continuar questionário' : 'Iniciar questionário');
  iniciar.type = 'submit';
  form.addEventListener('submit', evento => {
    evento.preventDefault();
    if (!idade.checked) {
      mostrarErro(erro);
      return;
    }
    maiorDeIdade = true;
    if (!rodada) iniciarRodada();
    go('pergunta');
  });
  form.append(erro, rotulo, acoes(iniciar, botao('Explorar o conteúdo informativo', () => go('sobre'), 'button-link')));
  pagina.append(form);
  if (rodada) pagina.append(botao('Apagar e sair', () => go('apagar'), 'button-link'));
}

export function atualizarProgresso(visible) {
  for (const indicador of document.querySelectorAll('[data-progresso-visual]')) {
    indicador.hidden = !visible;
  }
}

function pergunta(pagina, go, progressoVisivel) {
  const item = rodada.itens[posicao];
  const numero = posicao + 1;
  const total = rodada.itens.length;
  const barra = elemento('progress', 'flow-progress');
  barra.max = total;
  barra.value = numero;
  barra.dataset.progressoVisual = '';
  barra.hidden = !progressoVisivel;
  barra.setAttribute('aria-hidden', 'true');
  const topo = elemento('header', 'flow-topline');
  topo.append(titulo(`Pergunta ${numero} de ${total}`), descricao(item.tema, 'flow-meta'), barra);
  const etapa = etapaDaPergunta(numero);
  const concluidas = Math.floor(rodada.respostas.size / TAMANHO_ETAPA);
  const entradaNaEtapa = !revisando && etapa > 1 && numero % TAMANHO_ETAPA === 1 && etapa - 1 === concluidas;
  const situacaoDaEtapa = entradaNaEtapa
    ? `Etapa ${etapa - 1} concluída. Você chegou à etapa ${etapa} de ${ETAPAS}.`
    : `Etapa ${etapa} de ${ETAPAS} · Perguntas ${(etapa - 1) * TAMANHO_ETAPA + 1} a ${Math.min(total, etapa * TAMANHO_ETAPA)}`;
  pagina.append(
    topo,
    jornada(etapa, concluidas, progressoVisivel, situacaoDaEtapa),
    descricao('Nas últimas quatro semanas, com que frequência isso aconteceu nas ocasiões em que essa situação surgiu?', 'flow-intro')
  );

  const form = elemento('form', 'flow-form');
  form.autocomplete = 'off';
  const opcoes = elemento('fieldset', 'flow-question');
  const legenda = elemento('legend', '', item.texto);
  const erro = erroDeEscolha('Escolha uma das seis alternativas para continuar. Se preferir, marque “Prefiro pular”.');
  const lista = elemento('div', 'answer-options');
  opcoes.append(legenda, erro, lista);

  for (const opcao of OPCOES) {
    const linha = elemento('label', 'answer-row');
    const radio = elemento('input');
    radio.type = 'radio';
    radio.name = 'frequencia';
    radio.value = opcao;
    radio.checked = rodada.respostas.get(item.id) === opcao;
    const marca = elemento('span', 'flow-tag', 'Selecionada');
    marca.hidden = !radio.checked;
    marca.setAttribute('aria-hidden', 'true');
    radio.addEventListener('change', () => {
      responder(rodada, item.id, opcao);
      for (const rotulo of lista.children) {
        rotulo.querySelector('.flow-tag').hidden = !rotulo.querySelector('input').checked;
      }
      erro.hidden = true;
    });
    linha.append(radio, elemento('span', 'answer-text', opcao), marca);
    lista.append(linha);
  }

  const proximo = elemento('button', 'button-primary', numero === total ? 'Ver meu resumo' : 'Continuar');
  proximo.type = 'submit';
  form.addEventListener('submit', evento => {
    evento.preventDefault();
    if (!rodada.respostas.has(item.id)) {
      mostrarErro(erro);
      return;
    }
    if (numero === total) {
      go('resumo');
    } else {
      posicao += 1;
      go('pergunta');
    }
  });
  const voltar = botao('Voltar', () => {
    if (posicao > 0) {
      posicao -= 1;
      go('pergunta');
    } else {
      go(revisando ? 'revisao' : 'comecar');
    }
  });
  const controles = acoes(voltar, proximo, botao('Pausar', () => go('pausa'), 'button-link'));
  controles.classList.add('flow-step-controls');
  form.append(opcoes, controles);
  pagina.append(form, orientacao());
  const secundarias = acoes(botao('Apagar e sair', () => go('apagar'), 'button-link'));
  if (revisando) secundarias.prepend(botao('Voltar ao resumo', () => go('resumo'), 'button-link'));
  pagina.append(secundarias);
}

function pausa(pagina, go, progressoVisivel) {
  pagina.append(
    titulo('Questionário pausado'),
    jornada(etapaDaPergunta(posicao + 1), Math.floor(rodada.respostas.size / TAMANHO_ETAPA), progressoVisivel, 'Sua jornada fica neste ponto enquanto a aba estiver aberta.'),
    descricao(`Você parou na pergunta ${posicao + 1} de ${rodada.itens.length}. Suas respostas estão ocultas. Pode continuar deste ponto enquanto a página estiver aberta.`),
    descricao('Atualizar ou fechar esta página apaga o progresso.'),
    acoes(
      botao('Continuar de onde parei', () => go('pergunta'), 'button-primary'),
      botao('Abrir a pausa em 3D', () => go('atelier')),
      botao('Apagar e sair', () => go('apagar'), 'button-link')
    )
  );
}

function confirmarExclusao(pagina, go) {
  pagina.append(
    titulo('Apagar e sair?'),
    descricao('As respostas e a sequência desta rodada serão apagadas. Essa ação é definitiva. Arquivos que você já guardou continuam com você.'),
    acoes(
      botao('Voltar sem apagar', () => go(origemDaExclusao)),
      botao('Sim, apagar e sair', () => {
        limparFluxo();
        go('inicio');
      }, 'button-primary')
    )
  );
}

function totais(dados) {
  const lista = elemento('dl', 'flow-counts');
  for (const [rotulo, chave] of [
    ['Com frequência marcada', 'frequencias'],
    ['Não vivi essa situação', 'naoVividas'],
    ['Prefiro pular', 'pulos']
  ]) {
    const par = elemento('div');
    const numero = elemento('dd', '', String(dados[chave]));
    numero.dataset.total = chave;
    par.append(elemento('dt', '', rotulo), numero);
    lista.append(par);
  }
  return lista;
}

function marcaDaResposta(resposta) {
  const indice = OPCOES.indexOf(resposta);
  return MARCAS[indice < 4 ? Math.floor(indice / 2) : indice - 2];
}

function faixaDoMapa(marcas, legenda = false) {
  const faixa = elemento('ul', 'mapa-faixa');
  faixa.setAttribute('role', 'list');
  if (!legenda) faixa.setAttribute('aria-hidden', 'true');
  for (const marca of marcas) {
    const ponto = elemento('li', 'mapa-fase', legenda ? `${marca.simbolo} ${marca.legenda}` : marca.simbolo);
    ponto.dataset.state = marca.estado;
    faixa.append(ponto);
  }
  return faixa;
}

function cartaoDoTema(grupo, itens, registrarAbertura) {
  const cartao = elemento('li', 'mapa-tema');
  if (grupo.posicao) cartao.dataset.temaRanking = grupo.tema;
  const painel = elemento('div', 'mapa-detalhe');
  painel.id = `respostas-tema-${itens[0].id.charAt(0)}`;
  painel.hidden = true;
  const contagem = grupo.frequencias
    ? `${grupo.recorrentes} de ${grupo.frequencias} com alta frequência`
    : 'Sem frequência marcada';
  const botaoTema = botao(undefined, () => {
    painel.hidden = !painel.hidden;
    botaoTema.setAttribute('aria-expanded', String(!painel.hidden));
    if (!painel.hidden) registrarAbertura(grupo.tema);
  }, 'mapa-tema-botao');
  botaoTema.setAttribute('aria-expanded', 'false');
  botaoTema.setAttribute('aria-controls', painel.id);
  botaoTema.append(
    elemento('span', '', grupo.posicao ? `${grupo.posicao}º · ${grupo.tema}` : grupo.tema),
    elemento('span', 'mapa-contagem', contagem)
  );
  const lista = elemento('ul', 'flow-list');
  lista.setAttribute('role', 'list');
  for (const item of itens) {
    const linha = elemento('li', 'flow-item');
    linha.append(descricao(item.texto, 'flow-item-question'), descricao(item.resposta, 'flow-answer'));
    lista.append(linha);
  }
  painel.append(
    descricao(`Frequência marcada em ${grupo.frequencias} de ${grupo.total} situações. Não vivi: ${grupo.naoVividas}. Pulei: ${grupo.pulos}.`, 'flow-subtle'),
    lista
  );
  cartao.append(botaoTema, faixaDoMapa(itens.map(item => marcaDaResposta(item.resposta))), painel);
  return cartao;
}

function secaoDevolutiva(leitura, dados) {
  const secao = elemento('section', 'flow-devolutiva mapa-resultado');
  const porTema = new Map(dados.temas.map(grupo => [grupo.tema, grupo.itens]));
  const lista = elemento('ul', 'mapa-temas');
  lista.setAttribute('role', 'list');
  lista.dataset.ranking = '';
  const abertos = new Set();
  const explorados = descricao(`Temas explorados neste resumo: 0 de ${dados.temas.length}.`, 'flow-subtle');
  explorados.setAttribute('role', 'status');
  function registrarAbertura(tema) {
    if (abertos.has(tema)) return;
    abertos.add(tema);
    explorados.textContent = `Temas explorados neste resumo: ${abertos.size} de ${dados.temas.length}.`;
  }
  const comPosicao = leitura.ranking.map(grupo => cartaoDoTema(grupo, porTema.get(grupo.tema), registrarAbertura));
  const semPosicao = leitura.temasSemPosicao.map(grupo => cartaoDoTema(grupo, porTema.get(grupo.tema), registrarAbertura));
  lista.append(...comPosicao, ...semPosicao);
  const controles = elemento('div', 'mapa-controles');
  controles.setAttribute('role', 'group');
  controles.setAttribute('aria-label', 'Temas exibidos');
  const status = descricao('', 'sr-only');
  status.setAttribute('role', 'status');
  const soRanking = botao('Ranking por frequência', () => filtrar(false));
  const todos = botao('Todos os temas', () => filtrar(true));
  soRanking.disabled = !comPosicao.length;
  function filtrar(mostrarTodos, anunciar = true) {
    for (const cartao of semPosicao) cartao.hidden = !mostrarTodos;
    soRanking.setAttribute('aria-pressed', String(!mostrarTodos));
    todos.setAttribute('aria-pressed', String(mostrarTodos));
    if (anunciar) status.textContent = mostrarTodos ? 'Todos os 12 temas estão visíveis.' : `${comPosicao.length} temas com posição estão visíveis.`;
  }
  controles.append(soRanking, todos);
  filtrar(!comPosicao.length, false);
  const criterio = elemento('details', 'flow-help');
  criterio.append(elemento('summary', '', 'Como o ranking é calculado'), descricao(CRITERIO_DO_RANKING));
  secao.append(
    elemento('h2', '', 'O que apareceu com mais frequência'),
    descricao(leitura.leitura, 'flow-lead'),
    descricao('Abra um tema no mapa para ver suas perguntas e respostas. Cada símbolo corresponde a uma situação.'),
    controles, status, explorados, faixaDoMapa(MARCAS, true), lista, criterio
  );
  return secao;
}

function secaoExemplos(itens) {
  const secao = elemento('section', 'flow-section flow-exemplos-consulta');
  secao.append(elemento('h2', '', 'Exemplos para levar à consulta'));
  if (!itens.length) {
    secao.append(descricao('Se quiser conversar sobre alguma situação, veja suas respostas por tema e escolha o que faz sentido levar.'));
    return secao;
  }
  const lista = elemento('ul', 'flow-exemplos');
  for (const item of itens) {
    const linha = elemento('li');
    linha.append(descricao(item.texto), elemento('strong', '', item.resposta));
    lista.append(linha);
  }
  secao.append(
    descricao('Estas situações receberam frequências entre as mais altas da sua rodada. Se fizerem sentido para você, conte o que acontece e o que costuma ajudar.'),
    lista
  );
  return secao;
}

function secaoConsulta(go) {
  const secao = elemento('section', 'flow-consulta');
  const sus = elemento('a', 'button-link', 'Como buscar atendimento pelo SUS');
  sus.href = URL_SUS;
  sus.target = '_blank';
  sus.rel = 'noopener noreferrer';
  sus.referrerPolicy = 'no-referrer';
  const passos = elemento('ol', 'guia-passos');
  for (const passo of PASSOS_CONSULTA) {
    const linha = elemento('li');
    linha.append(elemento('strong', '', passo.titulo), descricao(passo.texto));
    passos.append(linha);
  }
  secao.append(
    elemento('h2', '', 'Sobre traços de autismo e sinais de TDAH'),
    descricao(LIMITE_DA_RODADA),
    elemento('h2', '', 'Preparar minha consulta'),
    descricao(ORIENTACAO_CONSULTA),
    elemento('h3', '', 'Passo a passo para buscar avaliação'), passos,
    acoes(sus, botao('Sobre autismo, TDAH e os instrumentos', () => go('sobre'), 'button-link'))
  );
  return secao;
}

function resumo(pagina, go, progressoVisivel) {
  revisando = false;
  const dados = resumir(rodada);
  const leitura = montarDevolutiva(dados);
  const abertura = elemento('header', 'flow-heading');
  abertura.append(titulo('Meu resumo'), elemento('p', 'journey-completion', 'Jornada concluída'), descricao('Suas respostas às 50 situações, reunidas por tema.', 'flow-lead'));
  pagina.append(abertura, jornada(null, ETAPAS, progressoVisivel, 'Você passou pelas cinco etapas.'), totais(dados));
  if (!dados.frequencias) {
    pagina.append(descricao('Você concluiu a rodada sem marcar frequências. Pode rever as perguntas se quiser.', 'flow-callout'));
  }
  const statusPdf = descricao('', 'flow-subtle');
  statusPdf.hidden = true;
  statusPdf.setAttribute('role', 'status');
  const baixar = botao('Baixar PDF completo', () => {
    statusPdf.hidden = true;
    statusPdf.textContent = '';
    try {
      baixarRelatorio(resumir(rodada), {
        introducao: LIMITE_DA_RODADA,
        resumo: leitura.leitura,
        orientacao: ORIENTACAO_CONSULTA,
        criterio: CRITERIO_DO_RANKING,
        ranking: leitura.ranking,
        exemplos: leitura.exemplos,
        passos: PASSOS_CONSULTA,
        susUrl: URL_SUS
      });
    } catch {
      statusPdf.hidden = false;
      statusPdf.textContent = 'O navegador não conseguiu baixar o PDF. Tente novamente.';
    }
  }, 'button-primary');
  pagina.append(
    acoes(baixar, botao('Revisar respostas', () => go('revisao'))),
    statusPdf,
    descricao('O PDF reúne as 50 perguntas com suas respostas, o ranking e o passo a passo para buscar avaliação. O arquivo é criado neste dispositivo.', 'flow-subtle'),
    secaoDevolutiva(leitura, dados),
    secaoExemplos(leitura.exemplos),
    secaoConsulta(go)
  );
  pagina.append(
    elemento('h2', '', 'Outra rodada'),
    descricao('Ao começar outra rodada, suas respostas atuais serão descartadas. Enquanto esta página estiver aberta, as próximas 50 situações serão diferentes das que você acabou de responder.'),
    acoes(
      botao('Fazer outra rodada', () => {
        iniciarRodada(rodada.itens.map(item => item.id));
        go('pergunta');
      }),
      botao('Apagar e sair', () => go('apagar'), 'button-link')
    )
  );
}

function revisao(pagina, go) {
  pagina.append(
    titulo('Revisar respostas'),
    descricao('Escolha a pergunta que quer rever. Ao marcar uma nova alternativa, ela substitui sua escolha anterior.'),
    botao('Voltar ao resumo', () => go('resumo'), 'button-link')
  );
  const lista = elemento('ol', 'flow-list');
  rodada.itens.forEach((item, indice) => {
    const linha = elemento('li', 'flow-item');
    const numero = indice + 1;
    const editar = botao(`Editar pergunta ${numero}`, () => {
      revisando = true;
      posicao = indice;
      go('pergunta');
    });
    editar.setAttribute('aria-label', `Editar pergunta ${numero}: ${item.texto}`);
    linha.append(descricao(item.texto, 'flow-item-question'), descricao(rodada.respostas.get(item.id), 'flow-answer'), editar);
    lista.append(linha);
  });
  pagina.append(lista, acoes(botao('Voltar ao resumo', () => go('resumo')), botao('Apagar e sair', () => go('apagar'), 'button-link')));
}

const telas = {
  comecar: entrada,
  pergunta,
  pausa,
  apagar: confirmarExclusao,
  resumo,
  revisao
};

export function renderFluxo({ screen, main, go, progressVisible = true }) {
  const destino = !rodada && screen !== 'comecar' ? 'comecar' : screen;
  if (destino === 'apagar' && telaAtual !== 'apagar') origemDaExclusao = telaAtual;
  telaAtual = destino;
  const pagina = elemento('div', `flow-page flow-${destino}`);
  telas[destino](pagina, go, progressVisible);
  main.replaceChildren(pagina);
}
