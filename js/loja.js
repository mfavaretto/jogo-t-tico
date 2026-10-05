// ===== Loja (modo Rodadas) =====
// Abre com a tecla B, só durante a preparação. Com a loja aberta, as teclas 1 a 5
// compram; o mouse continua preso ao jogo (não precisa clicar). Fecha com B ou
// automaticamente quando o combate começa.

// Itens à venda: tipo 'arma' (id da arma), 'municao' ou 'colete'
const ITENS_LOJA = [
  { id: 'smg', tipo: 'arma', nome: 'SMG', desc: 'automática · 25 tiros · curto alcance', preco: 1200 },
  { id: 'rifle', tipo: 'arma', nome: 'Fuzil Tático', desc: 'automático · 30 tiros · bom em todas as distâncias', preco: 1800 },
  { id: 'sniper', tipo: 'arma', nome: 'Sniper', desc: 'luneta com zoom (botão direito) · 5 tiros · dano alto', preco: 2800 },
  { id: 'municao', tipo: 'municao', nome: 'Munição', desc: 'completa a reserva da arma na mão', preco: 200 },
  { id: 'colete', tipo: 'colete', nome: 'Colete', desc: 'absorve metade do dano', preco: 650 },
];

class Loja {
  constructor(partida, armas, jogador, hud) {
    this.partida = partida;
    this.armas = armas;
    this.jogador = jogador;
    this.hud = hud;
    this.aberta = false;

    this.el = {
      raiz: document.getElementById('loja'),
      saldo: document.getElementById('loja-saldo-valor'),
      msg: document.getElementById('loja-msg'),
      lista: document.getElementById('loja-lista'),
    };
    // Monta as linhas da loja a partir da lista de itens
    this.linhas = {};
    ITENS_LOJA.forEach((item, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<kbd>' + (i + 1) + '</kbd><span class="nome"><span class="titulo">' + item.nome +
        '</span><small>' + item.desc + '</small></span><span class="estado"></span><span class="preco">$' + item.preco + '</span>';
      this.el.lista.appendChild(li);
      this.linhas[item.id] = li;
    });

    addEventListener('keydown', (e) => {
      if (!this.jogador.ativo || e.repeat) return;
      if (e.code === 'KeyB') this.alternar();
      else if (this.aberta) {
        const n = parseInt(e.code.replace('Digit', ''), 10);
        if (n >= 1 && n <= ITENS_LOJA.length) this.comprar(ITENS_LOJA[n - 1]);
      }
    });
  }

  alternar() {
    if (this.aberta) return this.fechar();
    if (document.getElementById('hud').classList.contains('modo-mata')) return;   // sem loja no mata-mata
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
    if (item.tipo === 'arma' && this.armas.temArma(item.id)) return 'COMPRADO';
    if (item.tipo === 'municao' && !this.armas.precisaMunicao()) return 'CHEIA';
    if (item.tipo === 'colete' && this.jogador.armadura >= 100) return 'COMPLETO';
    if (this.partida.dinheiro < item.preco) return 'SEM SALDO';
    return '';
  }

  comprar(item) {
    if (!this.aberta) return;
    const motivo = this._motivo(item);
    if (motivo) {
      this._mensagem(motivo === 'SEM SALDO' ? 'Dinheiro insuficiente' : motivo === 'CHEIA' ? 'Munição já está cheia' :
        motivo === 'COMPLETO' ? 'Colete já está completo' : 'Você já tem esta arma', false);
      return;
    }
    this.partida.gastar(item.preco);
    if (item.tipo === 'arma') this.armas.comprarArma(item.id);
    if (item.tipo === 'municao') this.armas.comprarMunicao();
    if (item.tipo === 'colete') this.jogador.comprarColete();
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
    for (const item of ITENS_LOJA) {
      const motivo = this._motivo(item);
      const li = this.linhas[item.id];
      li.classList.toggle('indisponivel', !!motivo);
      li.querySelector('.estado').textContent = motivo;
      if (item.tipo === 'municao') {
        li.querySelector('.titulo').textContent = 'Munição (' + this.armas.atual.def.nome.toLowerCase() + ')';
      }
    }
  }
}
