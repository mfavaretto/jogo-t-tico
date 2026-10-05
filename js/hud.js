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
      feed: $('kill-feed'), kd: $('hud-kd'), luneta: $('luneta'), lunetaZoom: $('luneta-zoom'),
      armas: $('hud-armas'), rotuloJog: $('rotulo-jog'), rotuloIni: $('rotulo-ini'),
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

  // atual === null: arma sem munição (faca)
  atualizarMunicao(atual, reserva, recarregando, nome) {
    const faca = atual === null;
    this.el.atual.textContent = faca ? '—' : atual;
    this.el.reserva.textContent = reserva;
    this.el.caixaMunicao.classList.toggle('sem-reserva', faca);
    this.el.estado.textContent = recarregando ? 'RECARREGANDO...' : nome;
    this.el.caixaMunicao.classList.toggle('vazia', atual === 0);
  }

  // Barra de armas: número da tecla, nome e destaque da arma na mão
  atualizarArmas(lista) {
    this.el.armas.innerHTML = '';
    for (const a of lista) {
      const d = document.createElement('div');
      d.className = 'slot' + (a.ativo ? ' ativo' : '') + (a.possui ? '' : ' sem');
      d.textContent = a.tecla + ' ' + a.nome;
      this.el.armas.appendChild(d);
    }
  }

  // Contador de abates e mortes
  atualizarKD(abates, mortes) {
    this.el.kd.innerHTML = 'ABATES <b>' + abates + '</b> &nbsp; MORTES <b>' + mortes + '</b>';
  }

  // Kill feed: mostra "quem [arma] quem" no canto, some depois de alguns segundos
  matou(autor, vitima, arma, cabeca) {
    const l = document.createElement('div');
    const euAutor = autor === 'Você', euVitima = vitima === 'Você';
    l.className = 'abate' + (euAutor || euVitima ? ' meu' : '');
    const nome = (t, eu) => '<span class="' + (eu ? 'eu' : '') + '">' + t + '</span>';
    l.innerHTML = nome(autor, euAutor) + ' <i>' + arma + (cabeca ? ' ◎' : '') + '</i> ' + nome(vitima, euVitima);
    this.el.feed.prepend(l);
    while (this.el.feed.children.length > 5) this.el.feed.lastChild.remove();
    setTimeout(() => l.remove(), 5000);
  }

  // Luneta da sniper: moldura escura com o nível de zoom
  luneta(ligada, zoom) {
    this.el.luneta.classList.toggle('oculto', !ligada);
    this.el.lunetaZoom.textContent = zoom + 'x';
    this.el.raiz.classList.toggle('com-luneta', ligada);
  }

  // Modo de jogo: 'rodadas' ou 'mata' (esconde o que não se aplica)
  definirModo(modo) {
    this.el.raiz.classList.toggle('modo-mata', modo === 'mata');
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
  // `esconder` oculta a mira (luneta e faca têm a própria)
  atualizarMira(px, esconder) {
    this.el.mira.classList.toggle('oculto', !!esconder);
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
