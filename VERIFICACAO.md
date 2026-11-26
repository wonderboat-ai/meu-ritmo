# Verificação do Meu ritmo · versão 2.0

**37 testes automatizados aprovados.** Os cenários usaram dados fictícios. A execução local verificou os arquivos de desenvolvimento e o HTML portátil.

| Suíte | Resultado | Cobertura |
| --- | ---: | --- |
| Banco e motor | 13/13 | Fidelidade ao banco, sorteios consecutivos, intercalação, respostas, contagens e destaques. |
| Contraste | 8/8 | Texto, controles, seleção, foco e elementos sobre o gradiente da escultura nos três temas. |
| Navegação | 11/11 | Confirmação de idade, conteúdo aberto, teclado, leitura, escultura, pausa, resumo, revisão, impressão e exclusão. |
| HTML portátil | 1/1 | Rodada completa offline, resumo, destaque, edição e exclusão, abrindo o arquivo diretamente. |
| Acessibilidade | 4/4 | Doze estados da interface nos modos claro, escuro, alto contraste e cores forçadas do sistema. |

## Banco e sorteio

As 120 linhas em UTF-8 coincidiram com o prompt mestre do projeto. Os enunciados também coincidiram com os do PDF de referência após normalizar as quebras tipográficas. São 120 IDs únicos de A01 a L10, 120 textos únicos e dez itens por tema. SHA-256 do banco com quebras LF e uma quebra final:

```text
de286e3a5c4db7d20a6c34ef77a8e0ae2f04532e354cadaa05b4a15a8233fc60
```

Com 1.000 sementes determinísticas, o motor gerou 3.000 rodadas. Cada uma trouxe 50 IDs distintos, com cinco itens em dois temas e quatro nos outros dez. As 2.000 comparações entre rodadas imediatamente consecutivas tiveram interseção vazia.

## Resultados no navegador

O Chromium completou cinco rodadas na aplicação modular e uma no HTML portátil, totalizando 300 escolhas nessas rodadas. Os cenários verificaram também tentativas de avançar em branco, o retorno à pergunta anterior, a pausa e a retomada da mesma sequência, a troca de preferências e o descarte do progresso após recarga ou exclusão confirmada.

As rodadas uniformes registraram 50 escolhas na categoria correspondente. Em uma rodada mista, o resumo mostrou 34 frequências, oito situações não vividas e oito pulos. Depois de editar a última resposta para “Não vivi essa situação”, os totais passaram a 33, nove e oito, e o destaque foi removido. Na prévia de impressão simulada, apenas a pergunta destacada e sua resposta foram incluídas.

O desenho permaneceu estático até a interação. Os testes compararam os pixels antes e depois de girar, inclinar, restaurar a posição e suavizar as cores. Verificaram também o uso por teclado, a ocultação e a preservação das escolhas visuais ao visitar outra tela. Com o Canvas 2D indisponível e o armazenamento bloqueado, o conteúdo educativo e o questionário continuaram acessíveis.

## Legibilidade, foco e ampliação

| Par medido | Claro | Escuro | Alto contraste |
| --- | ---: | ---: | ---: |
| Texto principal sobre o fundo | 13,63:1 | 14,41:1 | 19,03:1 |
| Texto do botão principal sobre seu preenchimento | 7,34:1 | 9,37:1 | 19,03:1 |

Foram verificadas **48 combinações** de estado e modo de leitura, com 320 CSS px de largura, tamanho padrão da fonte do navegador a 200% e espaçamento amplo. As 884 ocorrências de controles examinadas nessa execução tinham área de pelo menos 44 × 44 CSS px, foco identificável e centro visível desobstruído. O total de ocorrências pode variar conforme as perguntas sorteadas. A página e o diálogo não apresentaram rolagem horizontal.

Os 12 estados foram a abertura, a abertura com ajustes do objeto expandidos, a abertura com objeto oculto, o diálogo de leitura, a confirmação de idade, a pergunta, a pausa, a confirmação de exclusão, o resumo, a revisão, o conteúdo informativo e a privacidade. A ordem de Tab no cabeçalho acompanhou a ordem visual no celular. Marcar uma alternativa preservou o foco e a pergunta atual.

## Privacidade e fontes

Na rodada monitorada, responder, revisar, destacar, abrir a impressão, começar outra rodada e apagar geraram **zero novas requisições**. A URL e o tamanho do histórico permaneceram constantes. O console ficou sem mensagens. O navegador terminou com cookies, Web Storage, IndexedDB, Cache Storage e registros de service worker vazios. O monitor de Web Storage também não registrou escritas transitórias.

Abertura de um link oficial e uso da hospedagem são visitas a serviços externos. Os sete destinos educativos foram conferidos e têm rótulo e proteção da origem. A página de privacidade identifica o perfil mantenedor, liga ao canal público de problemas técnicos e descreve o registro de IP pelo GitHub Pages. A presença de um canal técnico público pede especial cuidado com o que se posta ali. [GitHub Pages e coleta de dados](https://docs.github.com/pt/pages/getting-started-with-github-pages/what-is-github-pages#data-collection) · [Canal público do projeto](https://github.com/wonderboat-ai/meu-ritmo/issues)

## Como reproduzir e interpretar a execução

As instruções de instalação e os três comandos de teste estão no [README.md](README.md). Os testes de navegador desta edição foram executados em Windows com Playwright 1.64.0 e Chrome 157.0.8103.79. As 12 verificações de navegação e do HTML portátil terminaram em cerca de 65 segundos.

A suíte usa HTTP local por padrão. O ambiente de verificação bloqueou conexões de retorno a `127.0.0.1`. Na edição modular, o Playwright entregou os bytes de `public/` ao Chromium por interceptação local das requisições. A edição portátil foi aberta por `file://`, offline, sem arquivos auxiliares. Não foram observados erros nem violações da política de conteúdo nesse percurso. Para reproduzir o caminho com interceptação, defina `PW_LOCAL_FIXTURES=1` antes de rodar a suíte. As variáveis opcionais `CHROME_PATH` e `PLAYWRIGHT_MODULE` permitem apontar instalações compatíveis.

## Conferência do endereço público

O código foi enviado ao novo repositório público `wonderboat-ai/meu-ritmo`. O GitHub Pages está configurado para servir a raiz de `main` com HTTPS. O arquivo de entrada do commit `2a2bc39` tem o mesmo conteúdo do HTML que passou pela rodada de teste offline. SHA-256 da distribuição: `f61c012e03677e147ccb81af663574996089f00ebc0af78f282851b145ed77b4`.

A URL pública abriu a tela “Seu cotidiano, no seu ritmo.” em um navegador. Na página hospedada, “Mais ajustes do objeto” revelou os comandos de inclinação e a opção “Cores suaves”. Após ativar essa opção, inclinar e girar, o controle anunciou 24 graus de rotação e 15 graus de inclinação. O console ficou sem avisos e erros nesse percurso. [Site em produção](https://wonderboat-ai.github.io/meu-ritmo/)

## Verificações com pessoas e equipamentos reais

- **Leitores de tela.** Percorrer uma rodada com NVDA no Windows, VoiceOver no iPhone e TalkBack no Android. Conferir ordem e clareza dos anúncios do enunciado, posição, alternativas, erros e destaques. Ouvir a descrição da escultura e o retorno dos ajustes por teclado.
- **Toque, ampliação e impressão.** Usar iPhone e Android físicos com tamanho de texto ampliado, zoom real e alto contraste do sistema. Conferir seleção, navegação, controles da escultura e paginação dos destaques na impressão e no PDF. Verificar se os cabeçalhos e rodapés opcionais do navegador acrescentam endereço ou caminho do arquivo.
- **Experiência vivida.** Convidar adultos autistas e com TDAH a experimentar a rodada e o conteúdo. Observar se identificam como pausar e retomar, distinguem “Nunca” de “Não vivi essa situação”, encontram os destaques e conseguem ocultar a escultura ou suavizar as cores quando desejarem. Pedir que contem o que facilitou ou dificultou sua participação.

Os testes de software verificam o comportamento observado da implementação. As avaliações com pessoas podem revelar dificuldades de compreensão e conforto. O banco de autorreflexão segue sem validação clínica.
