// PDF local, em A4, com fontes padrão do formato e texto selecionável.
const LARGURA = 595;
const ALTURA = 842;
const MARGEM = 45;
const COLUNA = LARGURA - 2 * MARGEM;
const TINTA = '0.08 0.14 0.25';
const AZUL = '0.10 0.31 0.62';
const CINZA = '0.26 0.33 0.43';

// Larguras Helvetica e Helvetica-Bold, em milésimos de em, do espaço a ~.
const LARGURAS = {
  regular: [
    278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
    1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
    667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
    333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
    556,556,333,500,278,556,500,722,500,500,500,334,260,334,584
  ],
  forte: [
    278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
    975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,
    667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
    333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
    611,611,389,556,333,611,556,778,556,556,500,389,280,389,584
  ]
};
const WIN_ANSI = new Map([
  ['€', 128], ['…', 133], ['‘', 145], ['’', 146], ['“', 147], ['”', 148],
  ['•', 149], ['–', 150], ['—', 151], ['™', 153]
]);

function literalPDF(texto) {
  const caracteres = [...texto.normalize('NFC')].map(letra => {
    const codigo = letra.codePointAt(0);
    if (codigo >= 32 && codigo < 127) return /[()\\]/.test(letra) ? '\\' + letra : letra;
    const byte = codigo >= 160 && codigo <= 255 ? codigo : WIN_ANSI.get(letra) ?? 63;
    return '\\' + byte.toString(8).padStart(3, '0');
  });
  return '(' + caracteres.join('') + ')';
}

function larguraTexto(texto, tamanho, fonte) {
  let unidades = 0;
  for (const letra of texto.normalize('NFD').replace(/\p{Mark}/gu, '')) {
    unidades += LARGURAS[fonte][letra.codePointAt(0) - 32] ?? 1000;
  }
  return unidades * tamanho / 1000;
}

function quebrarLinhas(texto, tamanho, fonte, largura = COLUNA) {
  const linhas = [];
  let linha = '';
  for (const palavra of texto.trim().split(/\s+/u)) {
    const candidata = linha ? linha + ' ' + palavra : palavra;
    if (linha && larguraTexto(candidata, tamanho, fonte) > largura) {
      linhas.push(linha);
      linha = palavra;
    } else linha = candidata;
  }
  if (linha) linhas.push(linha);
  return linhas;
}

function desenharTexto(texto, x, y, fonte, tamanho, cor) {
  const idFonte = fonte === 'forte' ? 'F2' : 'F1';
  return `BT /${idFonte} ${tamanho} Tf ${cor} rg ${x} ${y} Td ${literalPDF(texto)} Tj ET`;
}

function regra(y) {
  return `0.76 0.81 0.88 RG 0.55 w ${MARGEM} ${y} m ${LARGURA - MARGEM} ${y} l S`;
}

function comporPaginas(dados, leitura) {
  const paginas = [];
  let pagina;
  let y;

  function novaPagina() {
    pagina = [desenharTexto('Meu ritmo', MARGEM, 805, 'forte', 12, AZUL), regra(793)];
    paginas.push(pagina);
    y = 768;
  }

  function caber(altura) {
    if (y - altura >= 57) return false;
    novaPagina();
    return true;
  }

  function linha(texto, tamanho, fonte, cor, passo, x = MARGEM) {
    pagina.push(desenharTexto(texto, x, y, fonte, tamanho, cor));
    y -= passo;
  }

  function paragrafo(texto, tamanho = 11, fonte = 'regular', cor = TINTA, recuo = 0) {
    for (const textoLinha of quebrarLinhas(texto, tamanho, fonte, COLUNA - recuo)) {
      linha(textoLinha, tamanho, fonte, cor, tamanho + 4, MARGEM + recuo);
    }
  }

  function titulo(texto) {
    linha(texto, 15, 'forte', AZUL, 22);
  }

  novaPagina();
  linha('Meu resumo para consulta', 26, 'forte', TINTA, 32);
  paragrafo(`${dados.total} situações do cotidiano nas últimas quatro semanas.`);
  y -= 11;
  paragrafo(`${dados.frequencias} com frequência marcada  |  ${dados.naoVividas} não vividas  |  ${dados.pulos} em “Prefiro pular”`, 11, 'forte');
  y -= 15;
  titulo('O que apareceu na sua rodada');
  if (leitura.resumo) paragrafo(leitura.resumo);
  else paragrafo('A frequência pode descrever uma dificuldade, uma estratégia que ajuda ou uma preferência.');
  y -= 14;

  const ranking = leitura.ranking ?? [];
  if (ranking.length) {
    titulo('Situações mais recorrentes por tema');
    paragrafo(leitura.criterio ?? 'A ordem considera a proporção de “Muitas vezes” ou “Quase sempre ou sempre” entre as respostas com frequência do tema. Cada tema ordenado tem duas ou mais respostas com frequência informada e pelo menos uma nas duas maiores frequências.');
    y -= 5;
    for (const tema of ranking) {
      if (tema.posicao == null) continue;
      paragrafo(`${tema.posicao}º. ${tema.tema}  |  ${tema.recorrentes} de ${tema.frequencias}`, 11, 'regular', TINTA, 4);
    }
    y -= 13;
  }

  const exemplos = (leitura.exemplos ?? []).slice(0, 2);
  if (exemplos.length) {
    const linhas = exemplos.reduce((total, item) => {
      return total + quebrarLinhas(item.texto, 11, 'regular', COLUNA - 6).length
        + quebrarLinhas(`Resposta: ${item.resposta}`, 11, 'forte', COLUNA - 6).length;
    }, 0);
    caber(22 + linhas * 15 + exemplos.length * 8);
    titulo('Exemplos para levar à consulta');
    for (const item of exemplos) {
      paragrafo(item.texto, 11, 'regular', TINTA, 6);
      paragrafo(`Resposta: ${item.resposta}`, 11, 'forte', AZUL, 6);
      y -= 8;
    }
    y -= 6;
  }

  const limite = leitura.introducao ?? 'Este questionário descreve suas experiências nas últimas quatro semanas. As 50 perguntas não foram validadas para confirmar ou descartar traços de autismo ou sinais de TDAH. Em uma avaliação, o profissional considera desde quando essas experiências acontecem, em quais ambientes e como afetam sua rotina.';
  caber(22 + quebrarLinhas(limite, 11, 'regular').length * 15);
  titulo('Sobre traços de autismo e sinais de TDAH');
  paragrafo(limite);
  y -= 14;

  const orientacao = leitura.orientacao ?? 'Se alguma situação afeta sua rotina ou você quer entendê-la melhor, leve este resumo a um psicólogo com formação em neuropsicologia ou a uma clínica com experiência em avaliação de autismo e TDAH em adultos. Pelo SUS, você pode começar pela UBS.';
  caber(22 + quebrarLinhas(orientacao, 11, 'regular').length * 15);
  titulo('Para levar à consulta');
  paragrafo(orientacao);
  y -= 20;

  caber(122);
  titulo('Respostas por tema');
  for (const grupo of dados.temas) {
    y -= 5;
    caber(85);
    paragrafo(grupo.tema, 13, 'forte', TINTA);
    for (const item of grupo.itens) {
      const linhas = quebrarLinhas(item.texto, 11, 'regular', COLUNA - 6);
      const altura = linhas.length * 15 + (item.destacado ? 38 : 26);
      if (caber(altura)) paragrafo(`${grupo.tema} (continuação)`, 13, 'forte', TINTA);
      for (const textoLinha of linhas) linha(textoLinha, 11, 'regular', TINTA, 15, MARGEM + 6);
      paragrafo(`Resposta: ${item.resposta}`, 11, 'forte', AZUL, 6);
      if (item.destacado) paragrafo('Destaque escolhido', 9, 'regular', CINZA, 6);
      y -= 11;
    }
  }

  return paginas.map((conteudo, i) => {
    const rodape = `Página ${i + 1} de ${paginas.length}`;
    conteudo.push(regra(45), desenharTexto(rodape, MARGEM, 30, 'regular', 9, CINZA));
    return conteudo.join('\n') + '\n';
  });
}

export function gerarRelatorio(dados, leitura = {}) {
  const paginas = comporPaginas(dados, leitura);
  const filhos = paginas.map((_, i) => `${6 + 2 * i} 0 R`).join(' ');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R /Lang (pt-BR) /ViewerPreferences << /DisplayDocTitle true >> >>',
    `<< /Type /Pages /Count ${paginas.length} /Kids [${filhos}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Title (Meu ritmo - Meu resumo para consulta) >>'
  ];
  for (const conteudo of paginas) {
    const numeroConteudo = objetos.length + 2;
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA} ${ALTURA}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${numeroConteudo} 0 R >>`,
      `<< /Length ${conteudo.length} >>\nstream\n${conteudo}endstream`
    );
  }
  // Os caracteres fora de ASCII já foram escapados, então as posições são offsets em bytes.
  let pdf = '%PDF-1.4\n';
  const referencias = ['0000000000 65535 f \n'];
  for (const [i, objeto] of objetos.entries()) {
    referencias.push(`${String(pdf.length).padStart(10, '0')} 00000 n \n`);
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  }
  const inicioTabela = pdf.length;
  pdf += `xref\n0 ${referencias.length}\n${referencias.join('')}trailer\n<< /Size ${referencias.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${inicioTabela}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

export function baixarRelatorio(dados, leitura) {
  const arquivo = new Blob([gerarRelatorio(dados, leitura)], { type: 'application/pdf' });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'meu-ritmo-respostas.pdf';
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Dá tempo ao navegador de iniciar a gravação antes de liberar os bytes.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
