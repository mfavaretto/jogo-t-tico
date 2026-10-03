// ===== HUD =====
// Atualiza os elementos HTML de vida, munição, mira e marcador de acerto.

class HUD {
  constructor() {
    this.el = {
      raiz: document.getElementById('hud'),
      vida: document.getElementById('vida-valor'),
      atual: document.getElementById('municao-atual'),
      reserva: document.getElementById('municao-reserva'),
      estado: document.getElementById('municao-estado'),
      caixaMunicao: document.getElementById('hud-municao'),
      acerto: document.getElementById('marcador-acerto'),
      alvos: document.getElementById('alvos-restantes'),
    };
    this._timerAcerto = null;
  }

  mostrar(sim) { this.el.raiz.classList.toggle('oculto', !sim); }

  atualizarVida(v) { this.el.vida.textContent = Math.max(0, Math.round(v)); }

  atualizarMunicao(atual, reserva, recarregando) {
    this.el.atual.textContent = atual;
    this.el.reserva.textContent = reserva;
    this.el.estado.textContent = recarregando ? 'RECARREGANDO...' : 'PISTOLA';
    this.el.caixaMunicao.classList.toggle('vazia', atual === 0);
  }

  atualizarAlvos(n) { this.el.alvos.textContent = n; }

  // Mostra o X vermelho por um instante (mais forte se o alvo morreu)
  marcarAcerto(morreu) {
    const a = this.el.acerto;
    a.classList.add('ativo');
    a.style.transform = morreu ? 'scale(1.6)' : 'scale(1)';
    clearTimeout(this._timerAcerto);
    this._timerAcerto = setTimeout(() => a.classList.remove('ativo'), morreu ? 250 : 120);
  }
}
