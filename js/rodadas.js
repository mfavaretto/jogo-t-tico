// ===== Partida e rodadas =====
// Cada rodada tem três fases:
//   preparacao -> bots congelados, arma travada, loja liberada (tecla B)
//   combate    -> bots ativos; vence quem eliminar o outro lado antes do tempo acabar
//   resultado  -> mensagem de vitória/derrota, dinheiro e pausa curta antes da próxima
// A partida termina quando um lado chega a `vitoriasParaGanhar`.
// Também guarda o dinheiro do jogador.

class Partida {
  constructor(jogador, bots, armas, hud) {
    this.jogador = jogador;
    this.bots = bots;
    this.armas = armas;
    this.hud = hud;
    this.loja = null;                // definido em main.js
    this.aoFim = null;               // callback(venceu) quando a partida termina

    // Regras (fáceis de ajustar)
    this.tempoPreparacao = 12;
    this.tempoCombate = 90;
    this.tempoResultado = 4.5;
    this.vitoriasParaGanhar = 5;
    this.dinheiroInicial = 1000;
    this.premioAbate = 300;
    this.premioVitoria = 1700;
    this.premioDerrota = 1000;
    this.dinheiroMax = 9000;

    this.estado = 'parado';          // parado | preparacao | combate | resultado | fim
    this.tempo = 0;
    this.rodada = 0;
    this.placar = { jogador: 0, bots: 0 };
    this.dinheiro = this.dinheiroInicial;
    this.abatesRodada = 0;
    this.venceuRodada = false;

    bots.aoAbate = () => {
      this.abatesRodada++;
      this.ganhar(this.premioAbate);
      this.hud.aviso('+$' + this.premioAbate, 900);
    };
    this._atualizarHud();
  }

  ganhar(valor) {
    this.dinheiro = Math.min(this.dinheiroMax, this.dinheiro + valor);
    this.hud.atualizarDinheiro(this.dinheiro);
  }

  gastar(valor) {
    if (valor > this.dinheiro) return false;
    this.dinheiro -= valor;
    this.hud.atualizarDinheiro(this.dinheiro);
    return true;
  }

  // Começa tudo do zero: placar, dinheiro e equipamento
  novaPartida() {
    this.rodada = 0;
    this.placar = { jogador: 0, bots: 0 };
    this.dinheiro = this.dinheiroInicial;
    this.jogador.armadura = 0;
    this.jogador.zerarPlacar();
    this.armas.perderEquipamento();
    this.jogador.vivo = true;        // evita que a "morte" anterior apague o equipamento de novo
    this.hud.definirModo('rodadas');
    this.iniciarRodada();
  }

  // Volta ao menu sem manter nada da partida
  encerrar() {
    this.estado = 'parado';
    this.bots.ativo = false;
    this.bots.limpar();
    if (this.loja) this.loja.fechar();
    this.hud.esconderBanner();
  }

  resumo() {
    return 'Rodada ' + this.rodada + ' · placar ' + this.placar.jogador + ' x ' + this.placar.bots;
  }

  // Quantidade de bots cresce aos poucos: 3, 3, 4, 4, 5, 5, 6...
  _quantidadeBots() { return Math.min(6, 2 + Math.ceil(this.rodada / 2)); }

  iniciarRodada() {
    this.rodada++;
    // Quem morreu perde o equipamento comprado; quem sobreviveu mantém
    if (!this.jogador.vivo) {
      this.jogador.armadura = 0;
      this.armas.perderEquipamento();
    }
    this.jogador.reiniciar();
    this.armas.prepararRodada();
    this.bots.iniciarRodada(this._quantidadeBots());
    this.bots.ativo = false;
    this.armas.travada = true;
    this.abatesRodada = 0;
    this.estado = 'preparacao';
    this.tempo = this.tempoPreparacao;
    this.hud.esconderBanner();
    this.hud.aviso('RODADA ' + this.rodada, 1800);
    this._atualizarHud();
  }

  iniciarCombate() {
    this.estado = 'combate';
    this.tempo = this.tempoCombate;
    this.bots.ativo = true;
    this.armas.travada = false;
    if (this.loja) this.loja.fechar();
    this.hud.aviso('COMBATE!', 1500);
    this._atualizarHud();
  }

  encerrarRodada(venceu, motivo) {
    this.estado = 'resultado';
    this.tempo = this.tempoResultado;
    this.venceuRodada = venceu;
    this.bots.ativo = false;
    this.armas.travada = true;
    if (this.loja) this.loja.fechar();
    const premio = venceu ? this.premioVitoria : this.premioDerrota;
    this.ganhar(premio);
    if (venceu) this.placar.jogador++; else this.placar.bots++;
    this.hud.banner(venceu ? 'VITÓRIA' : 'DERROTA',
      motivo + '  ·  +$' + premio + (this.abatesRodada ? '  ·  ' + this.abatesRodada + ' abate(s)' : ''),
      venceu ? 'vitoria' : 'derrota');
    this._atualizarHud();
  }

  // Termina a rodada de resultado: próxima rodada ou fim da partida
  _depoisDoResultado() {
    if (this.placar.jogador >= this.vitoriasParaGanhar || this.placar.bots >= this.vitoriasParaGanhar) {
      const venceu = this.placar.jogador > this.placar.bots;
      this.estado = 'fim';
      this.hud.banner(venceu ? 'PARTIDA VENCIDA' : 'PARTIDA PERDIDA',
        'Placar final ' + this.placar.jogador + ' x ' + this.placar.bots, venceu ? 'vitoria' : 'derrota');
      if (this.aoFim) this.aoFim(venceu);
    } else {
      this.iniciarRodada();
    }
  }

  atualizar(dt) {
    if (this.estado === 'parado' || this.estado === 'fim') return;
    this.tempo = Math.max(0, this.tempo - dt);

    if (this.estado === 'preparacao') {
      if (this.tempo <= 0) this.iniciarCombate();
    } else if (this.estado === 'combate') {
      if (!this.jogador.vivo) this.encerrarRodada(false, 'Você foi eliminado');
      else if (!this.bots.lista.length) this.encerrarRodada(true, 'Todos os inimigos eliminados');
      else if (this.tempo <= 0) this.encerrarRodada(false, 'Tempo esgotado');
    } else if (this.estado === 'resultado') {
      if (this.tempo <= 0) this._depoisDoResultado();
    }
    this._atualizarHud();
  }

  _atualizarHud() {
    const rotulo = { parado: '', preparacao: 'PREPARAÇÃO', combate: 'RODADA ' + this.rodada,
                     resultado: 'RODADA ' + this.rodada, fim: 'FIM' }[this.estado];
    this.hud.atualizarTempo(this.tempo, rotulo, this.estado);
    this.hud.atualizarPlacar(this.placar.jogador, this.placar.bots);
    this.hud.atualizarInimigos(this.bots.lista.length);
    this.hud.atualizarDinheiro(this.dinheiro);
  }
}
