// ===== HUD =====
// Atualiza os elementos HTML: vida, colete, munição, dinheiro, tempo, placar,
// mira dinâmica, marcador de acerto, avisos, banner de resultado e feedback de dano.

class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      raiz: $('hud'),
      vida: $('vida-valor'), caixaVida: $('hud-vida'), colete: $('colete-valor'),
      atual: $('municao-atual'), reserva: $('municao-reserva'), estado: $('municao-estado'),
      caixaMunicao: $('hud-municao'),
      dinheiro: $('dinheiro'),
      tempo: $('tempo'), fase: $('fase'), topo: $('hud-topo'),
      placarJog: $('placar-jog'), placarIni: $('placar-ini'), inimigos: $('info-inimigos'),
      mira: $('mira'), acerto: $('marcador-acerto'),
      aviso: $('aviso'),
      banner: $('banner'), bannerTitulo: $('banner-titulo'), bannerSub: $('banner-sub'),
      danoFlash: $('dano-flash'), danoDir: $('dano-dir'),
      dica: $('dica'),
    };
    this._timerAcerto = null;
    this._timerAviso = null;
    this._miraPx = -1;
  }

  mostrar(sim) { this.el.raiz.classList.toggle('oculto', !sim); }

  atualizarVida(v) {
    this.el.vida.textContent = Math.max(0, Math.round(v));
    this.el.caixaVida.classList.toggle('baixa', v <= 30);
  }

  atualizarColete(v) { this.el.colete.textContent = Math.round(v); }

  atualizarMunicao(atual, reserva, recarregando, nome) {
    this.el.atual.textContent = atual;
    this.el.reserva.textContent = reserva;
    this.el.estado.textContent = recarregando ? 'RECARREGANDO...' : nome;
    this.el.caixaMunicao.classList.toggle('vazia', atual === 0);
  }

  atualizarDinheiro(v) { this.el.dinheiro.textContent = v; }
  atualizarInimigos(n) { this.el.inimigos.textContent = n; }
  atualizarPlacar(j, i) { this.el.placarJog.textContent = j; this.el.placarIni.textContent = i; }

  // Cronômetro mm:ss, nome da fase e cor da barra do topo conforme a fase
  atualizarTempo(seg, fase, estado) {
    const s = Math.ceil(seg);
    this.el.tempo.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    this.el.fase.textContent = fase;
    this.el.topo.dataset.estado = estado;
    this.el.topo.classList.toggle('urgente', estado === 'combate' && seg <= 10);
    // Dica de controles visível só na preparação
    this.el.dica.classList.toggle('oculto', estado !== 'preparacao');
  }

  // Mira dinâmica: afasta os quatro traços conforme a dispersão da arma (em pixels)
  atualizarMira(px) {
    px = Math.round(px);
    if (px === this._miraPx) return;
    this._miraPx = px;
    this.el.mira.style.setProperty('--abre', px + 'px');
  }

  // Mensagem grande no topo da tela por alguns segundos
  aviso(texto, ms = 2200) {
    const a = this.el.aviso;
    a.textContent = texto;
    a.classList.add('ativo');
    clearTimeout(this._timerAviso);
    this._timerAviso = setTimeout(() => a.classList.remove('ativo'), ms);
  }

  // Resultado da rodada / da partida (tipo: 'vitoria' ou 'derrota')
  banner(titulo, sub, tipo) {
    this.el.bannerTitulo.textContent = titulo;
    this.el.bannerSub.textContent = sub;
    this.el.banner.className = tipo;
  }
  esconderBanner() { this.el.banner.className = 'oculto'; }

  // Borda vermelha na tela + seta indicando de onde veio o tiro (angulo em radianos, 0 = à frente)
  sofrerDano(angulo) {
    const f = this.el.danoFlash, d = this.el.danoDir;
    for (const e of [f, d]) { e.style.transition = 'none'; }
    f.style.opacity = 0.9;
    d.style.opacity = 1;
    d.style.transform = 'rotate(' + angulo + 'rad)';
    void f.offsetWidth;                       // força o navegador a aplicar o estado inicial
    f.style.transition = 'opacity .6s';
    d.style.transition = 'opacity 1.2s';
    f.style.opacity = 0;
    d.style.opacity = 0;
  }

  // X no centro ao acertar: branco no corpo, vermelho na cabeça, maior se matou
  marcarAcerto(morreu, cabeca) {
    const a = this.el.acerto;
    a.classList.add('ativo');
    a.classList.toggle('cabeca', !!cabeca);
    a.style.transform = morreu ? 'scale(1.6)' : 'scale(1)';
    clearTimeout(this._timerAcerto);
    this._timerAcerto = setTimeout(() => a.classList.remove('ativo'), morreu ? 300 : 130);
  }
}
