# Zona Cinza

Jogo de tiro tático em primeira pessoa, feito com [Three.js](https://threejs.org/) (r128, via CDN cdnjs). Tudo é gerado por código: sem imagens ou arquivos externos. É uma partida local contra bots, no mapa **Pátio Industrial**. Usa scripts comuns (sem módulos ES), então abre por duplo clique no `index.html` ou pelo GitHub Pages.

**Status:** armas variadas (pistola, SMG, fuzil, sniper e faca), bots com 3 dificuldades, dois modos de jogo (**Rodadas com loja** e **Mata-mata**), kill feed e contador de abates/mortes. Ainda sem bomba, granadas ou multiplayer.

## Como abrir

- **Localmente:** abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox). É necessária conexão com a internet para carregar o Three.js do CDN. Se o navegador reclamar de arquivos locais, rode `python -m http.server 8000` na pasta e abra `http://localhost:8000`.
- **GitHub Pages:** em *Settings → Pages*, escolha a branch e a pasta `/ (root)`.

No menu, escolha o **modo** e a **dificuldade** e clique em **Clique para jogar** para capturar o mouse. (O Pointer Lock não funciona dentro de painéis embutidos; use um navegador normal.)

## Modos de jogo

| Modo | Como funciona |
|---|---|
| **Rodadas com loja** | Preparação (12 s), combate (90 s) e resultado. Elimine todos os bots antes do tempo acabar. Ganhe dinheiro e compre armas e colete na loja. Vença 5 rodadas. |
| **Mata-mata** | 4 bots patrulham e atiram em você. Quem morre **reaparece** (bots em 4 s, fora da sua vista; você em 3 s, com 2 s de proteção). Todas as armas liberadas, sem loja nem dinheiro. Não tem fim: vale o placar de abates e mortes. |

### Rodadas: dinheiro e loja

| Item | Preço |
|---|---|
| SMG | $1200 |
| Fuzil Tático | $1800 |
| Sniper | $2800 |
| Munição (arma na mão) | $200 |
| Colete (absorve metade do dano) | $650 |

Você começa com **$1000** e ganha **$300 por abate**, **$1700 pela vitória** e **$1000 pela derrota** (máximo $9000). Aperte `B` na preparação para abrir a loja; dentro dela, `1` a `5` compram e `B` fecha. Quem morre perde as armas compradas e o colete na rodada seguinte.

## Controles

| Ação | Tecla |
|---|---|
| Mover | `W` `A` `S` `D` |
| Mirar | Mouse |
| Atirar / golpear | Botão esquerdo (segure nas automáticas) |
| Luneta da sniper | Botão direito (clique de novo para mais zoom) |
| Recarregar | `R` |
| Trocar arma | `1` pistola, `2` SMG, `3` fuzil, `4` sniper, `5` faca, ou **roda do mouse** |
| Loja (modo Rodadas, na preparação) | `B`; dentro dela `1` a `5` compram |
| Pular | `Espaço` |
| Agachar | `Ctrl` ou `C` |
| Andar devagar (silencioso) | `Shift` |
| Pausar / liberar mouse | `Esc` |

## Armas

| | Pistola | SMG | Fuzil | Sniper | Faca |
|---|---|---|---|---|---|
| Disparo | semi | automático | automático | semi (ferrolho) | golpe |
| Dano (tronco) | 25 | 18 | 28 | 100 | 40 (x3 pelas costas) |
| Cadência | ~4,5/s | ~14/s | 10/s | 0,8/s | 1,8/s |
| Pente / reserva | 12 / 36 | 25 / 100 | 30 / 90 | 5 / 20 | n/a |
| Recarga | 1,4 s | 1,9 s | 2,4 s | 3,0 s | n/a |
| Alcance sem perda de dano | 25 m | 14 m | 40 m | 90 m | 2,4 m |
| Cabeça | x3 | x2,5 | x3,5 | x1,5 | x1 |
| Mobilidade | normal | +5% | -5% | -15% | +12% |

- **Região do corpo:** cabeça usa o multiplicador da arma, tronco dano normal, **pernas 75%**.
- **Queda de dano:** passando do alcance da arma, o dano cai por metro (até um mínimo). A SMG perde força rápido; a sniper quase não perde.
- **Recuo em padrão (spray):** cada arma sobe a mira de um jeito e desvia para os lados ao longo da rajada; ao parar de atirar o padrão recomeça.
- **Precisão:** a mira se abre ao **correr, pular e atirar em rajada** e se recupera aos poucos ao parar; agachar ajuda. A sniper sem luneta é muito imprecisa; **com luneta e parado é quase perfeita** (2 níveis de zoom: 3x e 8x), mas correr estraga a mira.
- **Ruído:** cada arma faz um barulho que os bots ouvem (a faca é quase silenciosa).
- Paredes e caixas bloqueiam os tiros, seus e dos bots.

## Bots e dificuldades

Os bots patrulham, enxergam com campo de visão e distância limitados, **só atiram com linha de visão livre** (raycast), perseguem o último lugar onde viram você e navegam por pontos de passagem (waypoints com A*), contornando prédio e contêineres. Também **reagem a barulho**: tiros e **passos** (correr é ouvido de longe; andar devagar ou agachado só de muito perto).

A dificuldade é escolhida no menu e fica em uma variável no topo de [js/bots.js](js/bots.js):

```js
let DIFICULDADE = 'medio';   // 'facil', 'medio' ou 'dificil'
```

| | Fácil | Médio | Difícil |
|---|---|---|---|
| Tempo de reação (1º tiro) | 0,9 a 1,4 s | 0,55 a 0,9 s | 0,3 a 0,5 s |
| Precisão (a curta distância) | 45% | 62% | 72% |
| Dano por tiro | 6 | 8 | 9 |
| Tempo entre tiros | 1,3 a 2,1 s | 0,9 a 1,5 s | 0,7 a 1,2 s |
| Distância de visão | 28 m | 35 m | 45 m |
| Audição | curta (x0,6) | normal | longa (x1,4) |

A tabela completa (`NIVEIS_DIFICULDADE`) está no mesmo arquivo e pode ser ajustada à vontade.

## Estrutura

```
index.html        página principal (HUD, loja e menu)
css/style.css     estilos
js/mapa.js        Pátio Industrial: chão, paredes, prédio, coberturas e colisores
js/jogador.js     movimento, colisão, vida, colete, abates e mortes
js/armas.js       cinco armas: dispersão, spray, dano por região, luneta, efeitos
js/bots.js        bots: dificuldade, IA, visão, audição, navegação A*, respawn
js/rodadas.js     modo Rodadas: fases, cronômetro, placar e dinheiro
js/mata.js        modo Mata-mata: bots e jogador reaparecem
js/loja.js        loja (tecla B)
js/hud.js         vida, munição, dinheiro, tempo, kill feed, luneta, mira dinâmica
js/main.js        cena, laço principal, menu e Pointer Lock
```

## Desempenho

Cerca de 130 objetos e 1.500 triângulos, uma única luz com sombra (1024 px), sem antialiasing e com pixel ratio limitado a 1,5. A visão dos bots é checada ~6 vezes por segundo (não a cada quadro) e a navegação usa um grafo pré-calculado.

## Limitações conhecidas

- Sem sons nem música.
- Bots não usam cobertura de forma tática, não trabalham em equipe e não pulam; a arma que mostram no kill feed é só um rótulo (o dano segue a dificuldade).
- Um único mapa; sem bomba, granadas ou multiplayer (planejados para etapas futuras).
- Os modelos são blocos simples, sem animação de caminhada.
- Não há salvamento: fechar a página encerra a partida (o modo e a dificuldade escolhidos são lembrados pelo navegador).
