# Meu ritmo · versão 2.2

Um questionário sobre o seu cotidiano. Uma pessoa adulta pode recordar as últimas quatro semanas, responder a 50 situações e baixar a devolutiva e todas as respostas em PDF com um clique.

## Abrir e experimentar

[Abrir o site público Meu ritmo](https://wonderboat-ai.github.io/meu-ritmo/)

Para usar offline, baixe o ZIP do repositório, extraia os arquivos e abra **index.html** na raiz em um navegador atualizado. O comando `npm run portatil` também gera uma cópia chamada **Meu_ritmo.html**. A leitura, a rodada e o resumo funcionam offline. Para visitar uma fonte externa, é preciso estar conectado.

O conteúdo educativo e os ajustes de leitura estão disponíveis para qualquer idade. A rodada pede apenas a confirmação “Tenho 18 anos ou mais”. O banco é autoral e não foi validado para rastrear ou diagnosticar autismo ou TDAH. AQ de adultos e ASRS-v1.1 de seis itens têm descrições e links oficiais na página informativa.

O resumo ordena temas pela proporção de “Muitas vezes” e “Quase sempre ou sempre” entre as respostas com frequência. A tela mostra o numerador e o denominador, conserva os empates e apresenta à parte temas com base insuficiente ou sem essas respostas. O botão **Baixar PDF completo** inclui todas as perguntas e as escolhas literais da rodada. **Imprimir meus destaques** continua disponível para levar apenas exemplos selecionados. O PDF é gerado no próprio dispositivo e traz uma orientação para preparar a consulta.

A rede neural em 3D fica parada até a pessoa escolher interagir. Em **Explorar**, é possível girar a rede, mudar o ângulo e enviar um pulso de luz. **Desacelerar** apresenta menos conexões e luz mais suave. A interação aceita mouse, toque, botões e teclado. Com o foco no desenho, as setas controlam a rotação e a inclinação. A tecla Home restaura a posição.

Em **Mais ajustes do objeto**, a pessoa pode reduzir a intensidade das cores e escolher movimento reduzido. A cena também respeita a preferência de movimento reduzido do sistema. **Ocultar objeto 3D** recolhe a cena. A pausa no questionário oferece um atalho para a rede neural e preserva o ponto da rodada ao voltar. É uma atividade opcional de exploração sensorial.

## Rodar e testar o código

Na pasta do projeto, com Node.js 20 ou superior, execute os comandos abaixo. O primeiro roda os testes do banco, do sorteio, do contraste e da devolutiva. O segundo inicia o servidor local.

```sh
npm test
npm start
```

Abra [a página local](http://127.0.0.1:4173/). Para parar o servidor, pressione Ctrl+C. Outra porta pode ser escolhida com `npm start -- --port=4174`.

Para executar os testes de interface, impressão local e acessibilidade no Chromium, use um terminal na mesma pasta.

```sh
npm install
npx playwright install chromium
npm run test:browser
npm run test:a11y
```

A suíte de interface inicia o próprio servidor e recria o HTML portátil. Os resultados desta edição e as verificações com pessoas e equipamentos reais estão em [VERIFICACAO.md](VERIFICACAO.md).

## Gerar os arquivos de distribuição

Edite os arquivos-fonte em **public/**. Os comandos abaixo geram, na raiz do repositório, duas cópias autossuficientes a partir desses mesmos arquivos.

```sh
npm run portatil
npm run pages
```

| Arquivo gerado | Uso |
| --- | --- |
| `Meu_ritmo.html` | Abrir diretamente no navegador, inclusive sem internet. |
| `index.html` | Servir como página de entrada no GitHub Pages ou em outra hospedagem estática com HTTPS. |

## Publicar uma atualização

1. Revise os destinos das fontes e o contato do responsável em `public/informacao.mjs`. Para o projeto original, o canal de problemas técnicos é público. Ao receber contribuições, mantenha respostas ao questionário e relatos de saúde fora das mensagens. [Canal do projeto](https://github.com/wonderboat-ai/meu-ritmo/issues)
2. Confira a política e a retenção de registros da hospedagem. O GitHub Pages registra o IP da visita para segurança, inclusive sem login. Em outro provedor, atualize a explicação de privacidade e confira se há scripts de métricas ou de terceiros adicionados à página. [Coleta de dados do GitHub Pages](https://docs.github.com/pt/pages/getting-started-with-github-pages/what-is-github-pages#data-collection) · [Declaração de privacidade do GitHub](https://docs.github.com/pt/site-policy/privacy-policies/github-general-privacy-statement)
3. Rode os testes e gere `index.html` com `npm run pages`. No repositório `wonderboat-ai/meu-ritmo`, o destino de publicação é a raiz da branch `main`. Em **Settings → Pages → Build and deployment**, use **Deploy from a branch → main → / (root)**. Ao enviar a alteração aprovada para essa branch, inclua os arquivos-fonte atualizados e o `index.html` gerado. [Repositório](https://github.com/wonderboat-ai/meu-ritmo) · [Documentação de publicação do GitHub Pages](https://docs.github.com/pt/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
4. Quando o GitHub concluir a implantação, abra o endereço HTTPS indicado em **Settings → Pages**. Faça uma rodada com respostas fictícias, revise, destaque, confira a prévia de impressão e apague. Em **Rede**, confira que responder não gera requisições. Em outro provedor, basta servir o `index.html` gerado como página de entrada. Para manter a edição modular, publique todo o conteúdo de `public/`, preservando nomes, UTF-8 e o tipo MIME JavaScript dos módulos `.mjs`.

## Onde alterar

| Caminho | Conteúdo |
| --- | --- |
| `public/banco-v1.txt` | Banco canônico versionado com 120 linhas. |
| `public/motor.mjs` e `public/fluxo.mjs` | Sorteio, respostas, pausa, revisão, resumo e impressão dos destaques. |
| `public/devolutiva.mjs` e `public/relatorio.mjs` | Ordenação dos temas por frequência e exportação local em PDF. |
| `public/informacao.mjs` | Textos educativos, fontes oficiais, privacidade e contato público. |
| `public/atelier.mjs`, `public/constelacao.mjs` e `public/atelier.css` | Controles, desenho da rede neural em perspectiva e estilos da experiência 3D. |
| `public/index.html`, `public/app.mjs`, `public/estilo.css` e `public/rodada.css` | Entrada, navegação, temas, legibilidade e impressão. |
| `scripts/` e `tests/` | Servidor, geração dos dois arquivos de distribuição e testes. |

A rodada e os destaques ficam na memória da página. Pausar os preserva enquanto a aba está aberta. Atualizar, fechar a aba ou confirmar **Apagar e sair** descarta o progresso. PDFs e impressões que a pessoa decidir guardar permanecem sob o controle dela.
