# Verificação do Meu ritmo · versão 2.3

A revisão cobriu a devolutiva por frequência, o PDF completo, o retorno ao questionário e as regras do banco. Os cenários de verificação usaram respostas fictícias.

**42 de 42 testes aprovados.** Foram 24 testes de banco, motor, devolutiva e contraste, 14 no Chromium entre a interface e o HTML portátil, e quatro na suíte de acessibilidade.

## Devolutiva e PDF

- O ranking compara, em cada tema, a proporção de “Muitas vezes” e “Quase sempre ou sempre” entre as situações com frequência informada. O numerador e o denominador ficam visíveis. Proporções iguais dividem a posição. Um tema precisa de pelo menos duas frequências informadas e uma resposta nas duas alternativas mais frequentes para ter posição. A devolutiva descreve a rodada de autorreflexão.
- A tela exibe automaticamente até dois exemplos com a pergunta e a resposta originais. A explicação sobre traços de autismo e sinais de TDAH aparece de forma explícita, acompanhada da orientação para consulta. A devolutiva do PDF traz os mesmos exemplos e a mesma explicação.
- O botão de download gera o PDF no dispositivo mesmo sem destaques selecionados. O documento contém as 50 perguntas e respostas, as contagens, a devolutiva e a orientação para consulta. Foram conferidos os 50 pares em rodadas fictícias mista, com respostas frequentes e com todas as perguntas puladas. O texto extraído conservou os acentos. A impressão dos destaques continua disponível.
- O PDF foi conferido em A4, com texto selecionável e numeração de páginas. O arquivo não contém tags de acessibilidade. A devolutiva e as respostas também estão disponíveis na página em HTML.

## Identidade e interação

- Os quatro caminhos vetoriais da logo coincidem com os da versão 2.0. Cada parte recebeu um novo gradiente na sua cor. Verde, vermelho, amarelo e azul também aparecem na cena.
- A cena inicia parada. A entrada por mouse, toque e teclado aciona a rotação ou um pulso curto. O movimento continua apenas pelo tempo necessário para a cena parar. O toque vertical dentro da cena permite rolar a página.
- Desacelerar reduz o número de conexões e a intensidade da luz. Cores suaves e Movimento reduzido podem ser ajustados. Com a preferência de redução de movimento ativa, Enter e o botão de pulso apenas destacam um ponto de luz. Ocultar objeto 3D recolhe a cena.
- A pausa do questionário abre a cena por escolha da pessoa. Voltar da cena e retomar conserva o mesmo enunciado, posição e alternativa escolhida. O conteúdo e o questionário continuam acessíveis quando o Canvas 2D está indisponível.

## Banco e fluxo

O código do sorteio e o banco de 120 perguntas coincidem com os da versão anterior. As 120 linhas coincidem literalmente com o prompt mestre. Os 120 enunciados coincidem com o PDF de referência após normalizar as quebras tipográficas.

SHA-256 do banco em UTF-8 com quebras LF e quebra final:

    de286e3a5c4db7d20a6c34ef77a8e0ae2f04532e354cadaa05b4a15a8233fc60

Com 1.000 sementes determinísticas, a suíte do motor produz 3.000 rodadas. Cada uma tem 50 IDs distintos, com dois temas de cinco itens e dez temas de quatro. A suíte verifica interseção vazia entre rodadas imediatamente consecutivas.

A suíte de interface cobre o avanço sem resposta, voltar e editar, pular, informar que a situação não ocorreu, pausar e retomar, alterar a leitura, concluir, revisar, destacar, imprimir, fazer uma nova rodada e apagar. O resumo apresenta as três contagens separadas. O teste de impressão verifica que apenas os destaques são impressos.

## Acesso e privacidade

Os cenários de acessibilidade usam Chromium, 320 CSS px de largura, tamanho de fonte a 200% e espaçamento amplo. Eles verificam os temas claro, escuro e de alto contraste, as cores forçadas do sistema, a ordem de Tab, o foco desobstruído, o tamanho dos controles e a ausência de rolagem horizontal.

A suíte verificou 48 combinações de tela e modo de cor. A tela de resumo foi testada com os 12 temas no ranking.

Uma revisão visual adicional verificou a abertura no Chromium em 36 combinações de largura, tema e tamanho de texto. Nenhuma apresentou recorte do título ou rolagem horizontal.

A suíte monitora requisições, console, histórico, cookies, Web Storage, IndexedDB, Cache Storage e service workers. A exportação do PDF não gerou requisições nem gravação de respostas em armazenamento web. O download também funcionou no HTML portátil offline. O GitHub Pages pode registrar dados técnicos da visita ao site, conforme descrito na página de privacidade. [Política do GitHub Pages](https://docs.github.com/pt/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)

## Como reproduzir

Os comandos de teste e de empacotamento estão no [README.md](README.md). Em um ambiente que bloqueia conexões de retorno a 127.0.0.1, defina PW_LOCAL_FIXTURES=1 para a suíte entregar ao Chromium os mesmos bytes e cabeçalhos por interceptação local. A cópia publicada é gerada do mesmo código usado no teste offline. [Meu ritmo](https://wonderboat-ai.github.io/meu-ritmo/)

Os dois HTMLs de distribuição coincidem byte a byte. SHA-256:

    de5dfde648dd9c544e4e8229c542f757261b756dd31de8f0bd4e406a82fbf791

## Verificações com pessoas e aparelhos físicos

- Percorrer as opções, a pausa e o resumo com NVDA, VoiceOver e TalkBack. Conferir a clareza dos anúncios da pergunta, da seleção, dos destaques e dos controles da cena.
- Testar com iPhone e Android físicos. Observar fluidez da cena, ampliação do texto, download do PDF e impressão dos destaques.
- Observar adultos autistas e com TDAH usando os dois modos. Perguntar quando desejam usar a cena e quais níveis de movimento e cor consideram confortáveis.

A cena é uma atividade opcional. O conforto e o efeito percebido são questões de experiência de uso. O questionário de autorreflexão segue sem validação clínica.
