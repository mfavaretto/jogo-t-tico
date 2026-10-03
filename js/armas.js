// ===== Armas =====
// Pistola em primeira pessoa: tiro por raycast, cadência, munição, recarga,
// recuo (da câmera e do modelo da arma) e marcas de impacto.

class Pistola {
  constructor(camera, mapa, alvos, hud) {
    this.camera = camera;
    this.mapa = mapa;
    this.alvos = alvos;
    this.hud = hud;
    this.jogador = null;            // definido depois (para aplicar o recuo na câmera)

    // Atributos
    this.dano = 25;
    this.intervalo = 0.22;          // segundos entre tiros (cadência)
    this.tamanhoPente = 12;
    this.municao = this.tamanhoPente;
    this.reserva = 36;
    this.tempoRecarga = 1.4;
    this.alcance = 150;

    // Estado
    this.espera = 0;                // tempo até poder atirar de novo
    this.recarregando = 0;          // tempo restante da recarga (0 = não recarrega)
    this.kick = 0;                  // recuo visual do modelo (0..1)
    this.flash = 0;                 // tempo restante do clarão do cano

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = this.alcance;

    this._criarModelo();
    this._criarMarcasImpacto();
    this._atualizarHud();
  }

  // Modelo simples feito de caixas, preso à câmera
  _criarModelo() {
    this.modelo = new THREE.Group();
    const preto = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const cinza = new THREE.MeshLambertMaterial({ color: 0x555a60 });
    const ferrolho = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.28), cinza);
    const empunhadura = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), preto);
    empunhadura.position.set(0, -0.1, 0.08);
    empunhadura.rotation.x = -0.2;
    this.modelo.add(ferrolho, empunhadura);

    // Clarão do tiro (aparece por instantes)
    this.clarao = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xffdd66 })
    );
    this.clarao.position.set(0, 0, -0.17);
    this.clarao.visible = false;
    this.modelo.add(this.clarao);

    this.posBase = new THREE.Vector3(0.2, -0.2, -0.45);
    this.modelo.position.copy(this.posBase);
    this.camera.add(this.modelo);
  }

  // Pequenas esferas escuras reaproveitadas para marcar onde o tiro bateu
  _criarMarcasImpacto() {
    this.marcas = [];
    this.marcaAtual = 0;
    const geo = new THREE.SphereGeometry(0.05, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.mapa.scene.add(m);
      this.marcas.push(m);
    }
  }

  _marcarImpacto(ponto) {
    const m = this.marcas[this.marcaAtual];
    this.marcaAtual = (this.marcaAtual + 1) % this.marcas.length;
    m.position.copy(ponto);
    m.visible = true;
  }

  // Dispara um tiro (chamado ao clicar). Retorna true se atirou.
  atirar() {
    if (this.recarregando > 0 || this.espera > 0) return false;
    if (this.municao <= 0) { this.recarregar(); return false; }

    this.municao--;
    this.espera = this.intervalo;
    this.kick = 1;
    this.flash = 0.04;
    this.clarao.visible = true;
    if (this.jogador) this.jogador.aplicarRecuo(0.022);   // sobe a mira um pouco

    // Raycast a partir do centro da tela contra mapa + alvos vivos
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const objetos = this.mapa.malhas.concat(this.alvos.malhas);
    const hits = this.raycaster.intersectObjects(objetos, false);
    if (hits.length) {
      const hit = hits[0];
      const alvo = hit.object.userData.alvo;
      if (alvo) {
        const morreu = this.alvos.causarDano(alvo, this.dano);
        this.hud.marcarAcerto(morreu);
      } else {
        this._marcarImpacto(hit.point);
      }
    }
    this._atualizarHud();
    if (this.municao === 0 && this.reserva > 0) this.recarregar();  // recarga automática
    return true;
  }

  recarregar() {
    if (this.recarregando > 0) return;
    if (this.municao >= this.tamanhoPente || this.reserva <= 0) return;
    this.recarregando = this.tempoRecarga;
    this._atualizarHud();
  }

  atualizar(dt) {
    if (this.espera > 0) this.espera -= dt;

    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) this.clarao.visible = false;
    }

    if (this.recarregando > 0) {
      this.recarregando -= dt;
      if (this.recarregando <= 0) {
        this.recarregando = 0;
        const falta = this.tamanhoPente - this.municao;
        const carga = Math.min(falta, this.reserva);
        this.municao += carga;
        this.reserva -= carga;
        this._atualizarHud();
      }
    }

    // Animação do modelo: recuo para trás e volta suave; na recarga, a arma abaixa
    this.kick = Math.max(0, this.kick - dt * 8);
    const abaixar = this.recarregando > 0 ? 0.15 : 0;
    this.modelo.position.set(
      this.posBase.x,
      this.posBase.y - abaixar,
      this.posBase.z + this.kick * 0.06
    );
    this.modelo.rotation.x = this.kick * 0.15 + (abaixar ? -0.6 : 0);
  }

  _atualizarHud() {
    this.hud.atualizarMunicao(this.municao, this.reserva, this.recarregando > 0);
  }
}
