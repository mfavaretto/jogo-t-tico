# Jogo Tático

Jogo de tiro tático em primeira pessoa (estilo Counter-Strike), feito com [Three.js](https://threejs.org/) (r128, via CDN cdnjs). Tudo é gerado por código: sem imagens ou arquivos externos.

**Status: Etapa 1** — mapa de teste, jogador, pistola e alvos estáticos. Ainda sem bots, loja, bomba ou rodadas.

## Como abrir

- **Localmente:** abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox). É necessária conexão com a internet para carregar o Three.js do CDN.
- **GitHub Pages:** em *Settings → Pages*, escolha a branch e a pasta `/ (root)`. O jogo abre em `https://<usuario>.github.io/jogo-t-tico/`.

Clique em **Clique para jogar** para capturar o mouse.

## Controles

| Ação | Tecla |
|---|---|
| Mover | `W` `A` `S` `D` |
| Olhar | Mouse |
| Atirar | Botão esquerdo (um tiro por clique) |
| Recarregar | `R` |
| Pular | `Espaço` |
| Agachar | `Ctrl` ou `C` |
| Andar devagar | `Shift` |
| Pausar / liberar mouse | `Esc` |

## Estrutura

```
index.html        página principal
css/style.css     estilos do HUD e do menu
js/mapa.js        chão, paredes, caixas, luzes e colisores
js/jogador.js     movimento em primeira pessoa e colisão
js/armas.js       pistola (raycast, cadência, munição, recarga, recuo)
js/alvos.js       alvos estáticos com vida
js/hud.js         vida, munição, mira e marcador de acerto
js/main.js        cena, laço principal e Pointer Lock
```

## Desempenho

Geometria simples, uma única luz com sombra (1024 px), sem antialiasing e com pixel ratio limitado a 1.5, para rodar em computadores fracos.
