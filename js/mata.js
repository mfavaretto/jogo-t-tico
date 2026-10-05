// ===== Modo Mata-mata =====
// 4 bots patrulham o mapa e atiram. Quem morre reaparece depois de alguns segundos em um
// ponto definido (o jogador, longe dos bots; os bots, longe e fora da vista do jogador).
// Não há loja, dinheiro nem rodadas: todas as armas já vêm liberadas, e vale o placar
// de abates e mortes. Tem a mesma interface de `Partida` (estado, novaPartida, atualizar...).

class MataMata {
  constructor(jogador, bots, armas, hud, mapa) {
    this.jogador = jogador;
    this.bots = bots;
    this.armas = armas;
    this.hud = hud;
    this.mapa = mapa;
    this.aoFim = null;               // não usado (o mata-mata não termina), mantido por compatibilidade

    this.quantidadeBots = 4;
    this.tempoRespawnJogador = 3;    // segundos até o jogador reaparecer
    this.protecaoSpawn = 2;          // segundos sem levar dano depois de reaparecer

    this.estado = 'parado';          // parado | jogando
    this.tempo = 0;                  // tempo de partida (sobe)
    this.contagem = 0;               // contagem regressiva do respawn do jogador
    this.placar = { jogador: 0, bots: 0 };   // não usado; existe para a interface comum
    this.rodada = 0;
  }

  novaPartida() {
    this.estado = 'jogando';
    this.tempo = 0;
    this.jogador.zerarPlacar();
    this.jogador.armadura = 0;
    this.jogador.vivo = true;
    this.armas.liberarTodas();
    this.armas.travada = false;
    this.hud.definirModo('mata');
    this.hud.esconderBanner();
    this._reaparecerJogador(true);
    this.bots.iniciarMataMata(this.quantidadeBots);
    this.bots.ativo = true;
  }

  // Volta ao menu sem manter nada da partida
  encerrar() {
    this.estado = 'parado';
    this.bots.ativo = false;
    this.bots.limpar();
    this.hud.esconderBanner();
  }

  resumo() {
    return 'Mata-mata · ' + this.jogador.abates + ' abate(s) · ' + this.jogador.mortes + ' morte(s)';
  }

  // Escolhe o ponto de reaparecimento mais distante dos bots vivos (e fora da vista deles)
  _escolherSpawn() {
    let melhor = this.mapa.spawnsJogador[0], pontuacao = -Infinity;
    for (const sp of this.mapa.spawnsJogador) {
      let menor = Infinity;
      for (const b of this.bots.lista) {
        menor = Math.min(menor, Math.hypot(b.grupo.position.x - sp.x, b.grupo.position.z - sp.z));
      }
      const p = menor + Math.random() * 3;        // um pouco de aleatoriedade
      if (p > pontuacao) { pontuacao = p; melhor = sp; }
    }
    return melhor;
  }

  _reaparecerJogador(primeira) {
    this.jogador.reiniciar(this._escolherSpawn());
    this.jogador.protecao = primeira ? 0 : this.protecaoSpawn;
    this.armas.liberarTodas();                    // volta com todas as armas e munição cheia
    this.hud.atualizarColete(this.jogador.armadura);
    this.hud.esconderBanner();
  }

  atualizar(dt) {
    if (this.estado !== 'jogando') return;
    this.tempo += dt;

    if (!this.jogador.vivo) {
      if (this.contagem <= 0) this.contagem = this.tempoRespawnJogador;   // acabou de morrer
      this.contagem -= dt;
      this.hud.banner('VOCÊ MORREU', 'Reaparecendo em ' + Math.max(1, Math.ceil(this.contagem)) + '…', 'derrota');
      if (this.contagem <= 0) { this.contagem = 0; this._reaparecerJogador(false); }
    }
    this.hud.atualizarTempo(this.tempo, 'MATA-MATA · ' + NIVEIS_DIFICULDADE[DIFICULDADE].nome, 'mata');
    this.hud.atualizarInimigos(this.bots.lista.length);
  }
}
