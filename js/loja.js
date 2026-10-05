// ===== Loja =====
// Abre com a tecla B, só durante a preparação. Com a loja aberta, as teclas 1, 2 e 3
// compram; o mouse continua preso ao jogo (não precisa clicar). Fecha com B ou
// automaticamente quando o combate começa.

class Loja {
  constructor(partida, armas, jogador, hud) {
    this.partida = partida;
    this.armas = armas;
    this.jogador = jogador;
    this.hud = hud;
    this.aberta = false;
    this.preco = { rifle: 1800, municao: 200, colete: 650 };

    this.el = {
      raiz: document.getElementById('loja'),
      saldo: document.getElementById('loja-saldo-valor'),
      msg: document.getElementById('loja-msg'),
      itens: {
        rifle: document.querySelector('[data-item="rifle"]'),
        municao: document.querySelector('[data-item="municao"]'),
        colete: document.querySelector('[data-item="colete"]'),
      },
      nomeMunicao: document.getElementById('loja-municao-nome'),
    };
    this.el.itens.rifle.querySelector('.preco').textContent = '$' + this.preco.rifle;
    this.el.itens.municao.querySelector('.preco').textContent = '$' + this.preco.municao;
    this.el.itens.colete.querySelector('.preco').textContent = '$' + this.preco.colete;

    addEventListener('keydown', (e) => {
      if (!this.jogador.ativo || e.repeat) return;
      if (e.code === 'KeyB') this.alternar();
      else if (this.aberta) {
        if (e.code === 'Digit1') this.comprar('rifle');
        if (e.code === 'Digit2') this.comprar('municao');
        if (e.code === 'Digit3') this.comprar('colete');
      }
    });
  }

  alternar() {
    if (this.aberta) return this.fechar();
    if (this.partida.estado !== 'preparacao') {
      this.hud.aviso('A loja só abre na preparação', 1500);
      return;
    }
    this.abrir();
  }

  abrir() {
    this.aberta = true;
    this.jogador.lojaAberta = true;
    this.el.msg.textContent = '';
    this.el.raiz.classList.remove('oculto');
    document.getElementById('hud').classList.add('loja-aberta');
    this.atualizar();
  }

  fechar() {
    this.aberta = false;
    this.jogador.lojaAberta = false;
    this.el.raiz.classList.add('oculto');
    document.getElementById('hud').classList.remove('loja-aberta');
  }

  // Motivo pelo qual o item não pode ser comprado agora (ou '' se pode)
  _motivo(item) {
    const p = this.partida;
    if (item === 'rifle' && this.armas.temRifle) return 'Você já tem o fuzil';
    if (item === 'municao' && !this.armas.precisaMunicao()) return 'Munição já está cheia';
    if (item === 'colete' && this.jogador.armadura >= 100) return 'Colete já está completo';
    if (p.dinheiro < this.preco[item]) return 'Dinheiro insuficiente';
    return '';
  }

  comprar(item) {
    if (!this.aberta) return;
    const motivo = this._motivo(item);
    if (motivo) { this._mensagem(motivo, false); return; }
    this.partida.gastar(this.preco[item]);
    if (item === 'rifle') this.armas.comprarRifle();
    if (item === 'municao') this.armas.comprarMunicao();
    if (item === 'colete') this.jogador.comprarColete();
    this._mensagem('Compra realizada!', true);
    this.atualizar();
  }

  _mensagem(texto, ok) {
    this.el.msg.textContent = texto;
    this.el.msg.className = ok ? 'ok' : 'erro';
  }

  // Atualiza saldo e o estado de cada linha (comprável / indisponível)
  atualizar() {
    this.el.saldo.textContent = this.partida.dinheiro;
    this.el.nomeMunicao.textContent = 'Munição (' + this.armas.atual.def.nome.toLowerCase() + ')';
    for (const item of Object.keys(this.el.itens)) {
      const motivo = this._motivo(item);
      const li = this.el.itens[item];
      li.classList.toggle('indisponivel', !!motivo);
      li.querySelector('.estado').textContent = ({
        'Você já tem o fuzil': 'COMPRADO', 'Munição já está cheia': 'CHEIA',
        'Colete já está completo': 'COMPLETO', 'Dinheiro insuficiente': 'SEM SALDO' })[motivo] || '';
    }
  }
}
