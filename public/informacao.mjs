// Somente texto e links. Os destinos externos abrem por escolha de quem lê.
function fonte(url, rotulo) {
  return `<li><a href="${url}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${rotulo}</a></li>`;
}

export const htmlInformacao = `
<article class="reading-page">
  <h1 data-page-focus tabindex="-1">Sobre autismo, TDAH e os instrumentos</h1>
  <p>Você pode ler este conteúdo em qualquer idade, mesmo que prefira ficar fora do questionário. As fontes abrem em outra aba para que você possa voltar ao ponto em que parou.</p>

  <section>
    <h2>Autismo</h2>
    <p>O autismo envolve diferenças no desenvolvimento da comunicação e da interação com outras pessoas. Também pode influenciar interesses, a experiência com sons e texturas e a adaptação a mudanças de rotina. As experiências e as necessidades de apoio variam de pessoa para pessoa.</p>
    <ul class="source-list">
      ${fonte("https://www.who.int/news-room/fact-sheets/detail/Autism-spectrum-disorders", "Organização Mundial da Saúde — informações sobre autismo (em inglês)")}
    </ul>
  </section>

  <section>
    <h2>TDAH</h2>
    <p>O transtorno do déficit de atenção com hiperatividade (TDAH) envolve um padrão persistente de desatenção, de hiperatividade e impulsividade, ou de ambas. Essas características começam na infância e podem afetar atividades em casa, nos estudos ou no trabalho também na vida adulta.</p>
    <ul class="source-list">
      ${fonte("https://www.gov.br/saude/pt-br/assuntos/pcdt/t/transtorno-do-deficit-de-atencao-com-hiperatividade-tdah/view", "Ministério da Saúde — protocolo brasileiro de TDAH")}
    </ul>
  </section>

  <section>
    <h2>O contexto faz diferença</h2>
    <p>Autismo e TDAH podem coexistir. Duas pessoas podem perder o fio da mesma conversa por motivos diferentes. Uma pode ter se distraído com um som. A outra pode ter precisado de mais tempo para entender a pergunta.</p>
    <p>Na avaliação profissional, importa saber quando essas experiências começaram, como foi o desenvolvimento desde a infância e o que acontece em diferentes ambientes. Se quiser conversar sobre algo que afeta sua rotina, você pode procurar a Unidade Básica de Saúde (UBS) que atende seu bairro.</p>
    <ul class="source-list">
      ${fonte("https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/autismo/atencao-especializada", "Ministério da Saúde — atendimento na UBS e na rede especializada")}
    </ul>
  </section>

  <section>
    <h2>Dois instrumentos de rastreio</h2>
    <p>O Meu ritmo usa um banco próprio de situações para reflexão pessoal. Os dois instrumentos abaixo têm finalidades próprias e ficam fora da rodada.</p>
    <h3>AQ de adultos</h3>
    <p>O AQ de adultos é um questionário de 50 itens fixos sobre traços autistas. A tradução brasileira disponível no Autism Research Centre indica uso exclusivo para pesquisa.</p>
    <ul class="source-list">
      ${fonte("https://www.autismresearchcentre.com/tests/autism-spectrum-quotient-aq-adult/", "Universidade de Cambridge — AQ de adultos no Autism Research Centre")}
      ${fonte("https://www.autismresearchcentre.com/research/tests/", "Autism Research Centre — condições de uso dos testes")}
      ${fonte("https://docs.autismresearchcentre.com/tests/AQ_Portugues_Brasil.pdf", "Autism Research Centre — tradução brasileira do AQ de adultos para pesquisa (PDF)")}
    </ul>
    <h3>ASRS-v1.1 de seis itens</h3>
    <p>A versão breve da ASRS-v1.1 é um instrumento de rastreio de TDAH em adultos. Suas seis perguntas ajudam a identificar sinais que merecem investigação profissional.</p>
    <ul class="source-list">
      ${fonte("https://license.tov.med.nyu.edu/product/asrs6Qscreener", "NYU Langone — ASRS-v1.1 de seis itens, versão para o Brasil e condições de uso")}
    </ul>
  </section>
</article>`;

export const htmlPrivacidade = `
<article class="reading-page">
  <h1 data-page-focus tabindex="-1">Privacidade</h1>
  <p>Você pode usar o Meu ritmo sem cadastro. Para entrar no questionário, basta confirmar que tem 18 anos ou mais.</p>
  <section>
    <h2>Enquanto a aba está aberta</h2>
    <p>As perguntas sorteadas, suas respostas e seus destaques ficam na memória desta página. O próprio navegador monta o resumo. Suas escolhas ficam fora do endereço da página e dos registros e estatísticas do site.</p>
    <p>Ao pausar, a pergunta fica oculta. Você pode retomar do mesmo ponto enquanto mantiver esta aba aberta. Fechar ou atualizar a página apaga o progresso. Para encerrar antes, escolha “Apagar e sair” e confirme.</p>
  </section>
  <section>
    <h2>Se você decidir imprimir</h2>
    <p>“Imprimir meus destaques” envia para a janela de impressão apenas as situações e respostas que você destacou. O navegador também pode oferecer a opção de salvar em PDF. Você controla essas cópias. Apagar a sessão não exclui um PDF já salvo ou uma impressão em papel.</p>
  </section>
  <section>
    <h2>Ao visitar este site ou abrir uma fonte</h2>
    <p>Para entregar a página e seus arquivos, o provedor de hospedagem pode registrar informações técnicas da visita, como o endereço IP, o horário e o arquivo solicitado. O que é guardado e por quanto tempo depende do provedor. O questionário não envia suas respostas, seus destaques nem seu resumo à hospedagem ou a serviços de IA.</p>
    <p>Se você acessar o Meu ritmo pelo GitHub Pages, o GitHub registra e guarda o endereço IP da visita para fins de segurança, mesmo quando você está sem login. Abrindo o arquivo HTML diretamente no seu dispositivo, o questionário funciona sem conexão com a hospedagem.</p>
    <p>Os links abaixo abrem em outra aba, se você os escolher. Cada destino recebe a visita segundo sua própria política. O Meu ritmo omite o endereço da página de origem ao abrir links externos.</p>
    <ul class="source-list">
      ${fonte("https://docs.github.com/pt/pages/getting-started-with-github-pages/what-is-github-pages#data-collection", "GitHub Docs — coleta de dados no GitHub Pages")}
      ${fonte("https://docs.github.com/pt/site-policy/privacy-policies/github-general-privacy-statement", "GitHub — declaração geral de privacidade")}
    </ul>
  </section>
  <section>
    <h2>Quem cuida do projeto</h2>
    <p>O responsável pelo Meu ritmo usa o perfil público wonderboat-ai no GitHub.</p>
    <p>Para comunicar um problema com o funcionamento do site, use o canal público do projeto. Qualquer pessoa pode ler o que for publicado ali. Descreva apenas o problema técnico, sem incluir respostas, relatos de saúde, imagens do resumo ou dados pessoais.</p>
    <ul class="source-list">
      ${fonte("https://github.com/wonderboat-ai", "GitHub — perfil público do responsável pelo Meu ritmo")}
      ${fonte("https://github.com/wonderboat-ai/meu-ritmo/issues", "GitHub Issues — canal público para problemas do Meu ritmo")}
    </ul>
  </section>
</article>`;
