import { OPCOES, criarRodada, responder, destacar, resumir } from './motor.mjs';

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

function descartarImpressao() {
  document.getElementById('impressao-destaques')?.remove();
}

export function limparFluxo() {
  descartarImpressao();
  rodada?.respostas.clear();
  rodada?.destaques.clear();
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

function entrada(pagina, go) {
  const abertura = elemento('header', 'flow-heading');
  abertura.append(
    titulo('Antes de começar'),
    descricao('Pense nas últimas quatro semanas. Você verá 50 situações, uma por vez, e poderá voltar ou pausar quando quiser. No fim, suas respostas ficam reunidas por tema.', 'flow-lead')
  );
  pagina.append(
    abertura,
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
  const barra = document.querySelector('.flow-progress');
  if (barra) barra.hidden = !visible;
}

function pergunta(pagina, go, progressoVisivel) {
  const item = rodada.itens[posicao];
  const numero = posicao + 1;
  const total = rodada.itens.length;
  const barra = elemento('progress', 'flow-progress');
  barra.max = total;
  barra.value = numero;
  barra.hidden = !progressoVisivel;
  barra.setAttribute('aria-hidden', 'true');
  const topo = elemento('header', 'flow-topline');
  topo.append(titulo(`Pergunta ${numero} de ${total}`), descricao(item.tema, 'flow-meta'), barra);
  pagina.append(
    topo,
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

function pausa(pagina, go) {
  pagina.append(
    titulo('Questionário pausado'),
    descricao(`Você parou na pergunta ${posicao + 1} de ${rodada.itens.length}. Suas respostas estão ocultas. Pode continuar deste ponto enquanto a página estiver aberta.`),
    descricao('Atualizar ou fechar esta página apaga o progresso.'),
    acoes(botao('Continuar de onde parei', () => go('pergunta'), 'button-primary'), botao('Apagar e sair', () => go('apagar'), 'button-link'))
  );
}

function confirmarExclusao(pagina, go) {
  pagina.append(
    titulo('Apagar e sair?'),
    descricao('As respostas, os destaques e a sequência desta rodada serão apagados. Essa ação é definitiva. Arquivos ou impressões que você já guardou continuam com você.'),
    acoes(
      botao('Voltar sem apagar', () => go(origemDaExclusao)),
      botao('Sim, apagar e sair', () => {
        limparFluxo();
        go('inicio');
      }, 'button-primary')
    )
  );
}

function imprimirDestaques() {
  if (!rodada?.destaques.size) return;
  descartarImpressao();
  const folha = elemento('article');
  folha.id = 'impressao-destaques';
  folha.append(elemento('h1', '', 'Meus destaques'));
  for (const grupo of resumir(rodada).temas) {
    const escolhidos = grupo.itens.filter(item => item.destacado);
    if (!escolhidos.length) continue;
    const secao = elemento('section');
    secao.append(elemento('h2', '', grupo.tema));
    for (const item of escolhidos) {
      const trecho = elemento('div', 'print-item');
      trecho.append(descricao(item.texto), descricao(item.resposta));
      secao.append(trecho);
    }
    folha.append(secao);
  }
  document.body.append(folha);
  window.addEventListener('afterprint', descartarImpressao, { once: true });
  window.print();
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

function grupoDeRespostas(grupo, atualizarDestaques) {
  const painel = elemento('details', 'flow-group');
  const cabecalho = elemento('summary');
  cabecalho.append(
    elemento('span', 'flow-group-title', grupo.tema),
    elemento('span', 'flow-group-total', `${grupo.total} situações`)
  );
  const contagens = descricao(
    `Frequência marcada em ${grupo.frequencias} de ${grupo.total}. “Não vivi essa situação”: ${grupo.naoVividas}. “Prefiro pular”: ${grupo.pulos}.`,
    'flow-subtle'
  );
  const lista = elemento('ul', 'flow-list');
  for (const item of grupo.itens) {
    const linha = elemento('li', 'flow-item');
    linha.append(descricao(item.texto, 'flow-item-question'), descricao(item.resposta, 'flow-answer'));
    if (OPCOES.slice(0, 4).includes(item.resposta)) {
      const rotulo = elemento('label', 'flow-check');
      const check = elemento('input');
      check.type = 'checkbox';
      check.checked = item.destacado;
      check.setAttribute('aria-label', `Destacar: ${item.texto}`);
      check.addEventListener('change', () => {
        destacar(rodada, item.id, check.checked);
        atualizarDestaques();
      });
      rotulo.append(check, elemento('span', '', 'Destacar'));
      linha.append(rotulo);
    }
    lista.append(linha);
  }
  painel.append(cabecalho, contagens, lista);
  return painel;
}

function resumo(pagina, go) {
  revisando = false;
  const dados = resumir(rodada);
  const abertura = elemento('header', 'flow-heading');
  abertura.append(titulo('Meu resumo'), descricao('Suas respostas às 50 situações, reunidas por tema.', 'flow-lead'));
  pagina.append(abertura, totais(dados));
  if (!dados.frequencias) {
    pagina.append(descricao('Você concluiu a rodada sem marcar frequências. Pode rever as perguntas se quiser.', 'flow-callout'));
  }
  pagina.append(acoes(botao('Revisar respostas', () => go('revisao'), 'button-secondary')));
  const grupos = elemento('div', 'flow-groups');
  const alternar = botao('Expandir todos os temas', () => {
    const abrir = paineis.some(painel => !painel.open);
    for (const painel of paineis) painel.open = abrir;
    atualizarAlternancia();
  }, 'button-link');
  const imprimir = botao('Imprimir meus destaques', imprimirDestaques, 'button-primary');
  const contagem = descricao('', 'flow-subtle');
  function atualizarDestaques() {
    descartarImpressao();
    const total = rodada.destaques.size;
    contagem.textContent = total === 1 ? '1 situação destacada.' : `${total} situações destacadas.`;
    imprimir.disabled = total === 0;
  }
  const paineis = dados.temas.map(grupo => grupoDeRespostas(grupo, atualizarDestaques));
  function atualizarAlternancia() {
    alternar.textContent = paineis.every(painel => painel.open) ? 'Recolher todos os temas' : 'Expandir todos os temas';
  }
  for (const painel of paineis) painel.addEventListener('toggle', atualizarAlternancia);
  paineis[0].open = true;
  grupos.append(...paineis);
  atualizarDestaques();
  const tituloTemas = elemento('div', 'flow-section-head');
  tituloTemas.append(elemento('h2', '', 'Respostas por tema'), alternar);
  const porTema = elemento('section', 'flow-section');
  porTema.append(tituloTemas,
    descricao('Abra um tema para ler suas respostas. Se quiser guardar exemplos para uma conversa, marque “Destacar” nas situações em que escolheu uma frequência.'),
    grupos
  );
  const marcados = elemento('section', 'flow-highlights');
  const tituloDestaques = elemento('div', 'flow-section-head');
  tituloDestaques.append(elemento('h2', '', 'Meus destaques'), contagem);
  marcados.append(tituloDestaques,
    descricao('A impressão inclui apenas as situações destacadas e suas respostas. O navegador pode oferecer salvar em PDF. Para omitir o endereço da página ou do arquivo, desative cabeçalhos e rodapés na prévia. Apagar a sessão não exclui o PDF ou o papel que você guardou.'),
    acoes(imprimir)
  );
  pagina.append(porTema, marcados,
    descricao('Se algo aqui afeta sua rotina e você gostaria de apoio, pode levar exemplos a uma pessoa de confiança ou a um profissional de saúde. No SUS, você pode começar pela sua UBS.', 'flow-callout'),
    botao('Sobre autismo, TDAH e os instrumentos', () => go('sobre'), 'button-link'),
    elemento('h2', '', 'Outra rodada'),
    descricao('Ao começar outra rodada, as respostas e os destaques desta serão descartados. Enquanto esta página estiver aberta, as próximas 50 situações serão diferentes das que você acabou de responder.'),
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
  descartarImpressao();
  const destino = !rodada && screen !== 'comecar' ? 'comecar' : screen;
  if (destino === 'apagar' && telaAtual !== 'apagar') origemDaExclusao = telaAtual;
  telaAtual = destino;
  const pagina = elemento('div', `flow-page flow-${destino}`);
  telas[destino](pagina, go, progressVisible);
  main.replaceChildren(pagina);
}
