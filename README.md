# Zona Cinza

Jogo de tiro tático em primeira pessoa, no estilo de rodadas e compras, feito com [Three.js](https://threejs.org/) (r128, via CDN cdnjs). Tudo é gerado por código: sem imagens ou arquivos externos. Hoje é uma partida local contra bots, no mapa **Pátio Industrial**.

**Status: Etapa 3** — rodadas, economia e loja, pistola e fuzil, mapa novo e bots com navegação. Ainda sem bomba, granadas ou multiplayer.

## Como abrir

- **Localmente:** abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox). É necessária conexão com a internet para carregar o Three.js do CDN. Se o navegador reclamar de arquivos locais, rode `python -m http.server 8000` na pasta e abra `http://localhost:8000`.
- **GitHub Pages:** em *Settings → Pages*, escolha a branch e a pasta `/ (root)`.

Clique em **Clique para jogar** para capturar o mouse. (O Pointer Lock não funciona dentro de painéis embutidos; use um navegador normal.)

## Como se joga

A partida vai até **5 rodadas vencidas**. Cada rodada tem três fases:

1. **Preparação (12 s):** os bots ficam congelados e a arma é travada. Aperte `B` para abrir a loja.
2. **Combate (90 s):** elimine todos os inimigos antes do tempo acabar. Você perde a rodada se morrer ou se o tempo esgotar.
3. **Resultado (4,5 s):** aparece VITÓRIA ou DERROTA e a próxima rodada começa. Vida, posição e inimigos são reiniciados.

O número de bots cresce aos poucos (3, 3, 4, 4, 5, 5, 6...).

### Dinheiro e loja

| Item | Preço | Efeito |
|---|---|---|
| Fuzil Tático | $1800 | automático, 30 tiros, 90 de reserva |
| Munição | $200 | completa a reserva da arma na mão |
| Colete | $650 | absorve metade do dano |

- Você começa com **$1000**. Ganha **$300 por abate**, **$1700 pela vitória** e **$1000 pela derrota**. O máximo é $9000.
- Com a loja aberta (`B`), as teclas `1`, `2` e `3` compram. `B` fecha. A loja só abre na preparação.
- Quem sobrevive mantém fuzil e colete. Quem morre perde os dois na rodada seguinte.
- A munição não é reposta de graça: o pente é completado com a reserva no início da rodada, e a reserva só volta pela loja.

### Armas

| | Pistola | Fuzil Tático |
|---|---|---|
| Disparo | um por clique | automático (segure o botão) |
| Dano | 25 | 30 |
| Cadência | ~4,5 tiros/s | 10 tiros/s |
| Pente / reserva | 12 / 36 | 30 / 90 |
| Recarga | 1,4 s | 2,4 s |
| Recuo | médio | pequeno, mas se acumula na rajada |

Tiro na **cabeça** causa dano triplo. A **precisão** diminui quando você corre, pula e atira em sequência (a mira se abre), e se recupera aos poucos ao parar. Agachar ajuda. Paredes e caixas bloqueiam os tiros, seus e dos bots.

## Controles

| Ação | Tecla |
|---|---|
| Mover | `W` `A` `S` `D` |
| Mirar | Mouse |
| Atirar | Botão esquerdo |
| Recarregar | `R` |
| Trocar arma | `1` pistola, `2` fuzil |
| Loja (só na preparação) | `B`; dentro dela `1` `2` `3` compram |
| Pular | `Espaço` |
| Agachar | `Ctrl` ou `C` |
| Andar devagar | `Shift` |
| Pausar / liberar mouse | `Esc` |

## Os bots

Patrulham, enxergam com campo de visão de 120° e linha de visão livre (não veem através de paredes, mas "ouvem" a pouca distância), perseguem o último local onde viram você, andam de lado e atiram. Navegam por um grafo de pontos com A*, então contornam o prédio e os contêineres. Têm tempo de reação (0,55 a 0,9 s) antes do primeiro tiro e a precisão cai com a distância, quando você corre ou agacha. Ajustes de dificuldade ficam no início do construtor de `Bots` (`js/bots.js`) e as regras da partida no construtor de `Partida` (`js/rodadas.js`).

## Estrutura

```
index.html        página principal (HUD, loja e menu)
css/style.css     estilos
js/mapa.js        Pátio Industrial: chão, paredes, prédio, coberturas e colisores
js/jogador.js     movimento em primeira pessoa, colisão, vida e colete
js/armas.js       pistola e fuzil (dispersão, recuo, recarga, efeitos)
js/bots.js        bots: IA, navegação A*, visão e tiro
js/rodadas.js     partida: fases, cronômetro, placar e dinheiro
js/loja.js        loja (tecla B)
js/hud.js         vida, colete, munição, dinheiro, tempo, placar, mira dinâmica
js/main.js        cena, laço principal, menu e Pointer Lock
```

## Desempenho

Cerca de 130 objetos e 1.500 triângulos, uma única luz com sombra (1024 px), sem antialiasing e com pixel ratio limitado a 1,5, para rodar em computadores fracos.

## Limitações conhecidas

- Sem sons nem música.
- Bots não usam cobertura de forma tática, não trabalham em equipe e não pulam.
- Um único mapa e duas armas; sem bomba, granadas ou multiplayer (planejados para etapas futuras).
- Os modelos são blocos simples, sem animação de caminhada.
- Não há salvamento: fechar a página encerra a partida.
