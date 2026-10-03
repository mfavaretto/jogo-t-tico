// ===== Jogador em primeira pessoa =====
// Controles (WASD, mouse, pulo, agachar, andar devagar) e colisão com o mapa.
// A posição guardada é a dos PÉS; a câmera fica na altura dos olhos.

class Jogador {
  constructor(camera, mapa, dominio) {
    this.camera = camera;
    this.mapa = mapa;
    camera.rotation.order = 'YXZ';   // yaw (horizontal) e pitch (vertical) sem inclinar

    // Dimensões
    this.raio = 0.35;
    this.alturaEmPe = 1.75;
    this.alturaAgachado = 1.1;
    this.altura = this.alturaEmPe;
    this.olhoOffset = 0.15;          // olhos ficam um pouco abaixo do topo da cabeça

    // Física
    this.velocidadeNormal = 5;
    this.velocidadeLenta = 2.4;      // Shift ou agachado
    this.gravidade = 20;
    this.forcaPulo = 6.8;
    this.pos = new THREE.Vector3(0, 0, 16);   // pés
    this.vel = new THREE.Vector3();
    this.noChao = false;

    // Visão
    this.yaw = 0;
    this.pitch = 0;
    this.recuo = 0;                  // deslocamento extra da mira causado pelos tiros
    this.sensibilidade = 0.0022;

    // Estado
    this.vida = 100;
    this.agachado = false;
    this.teclas = {};
    this.atirando = false;           // botão do mouse pressionado
    this.ativo = false;              // true com o Pointer Lock ativo

    this._ligarEntrada(dominio);
  }

  _ligarEntrada(canvas) {
    addEventListener('keydown', e => {
      this.teclas[e.code] = true;
      if (e.code === 'Space' || e.code.startsWith('Control')) e.preventDefault();
      if (e.code === 'KeyR' && this.ativo && this.arma) this.arma.recarregar();
    });
    addEventListener('keyup', e => { this.teclas[e.code] = false; });

    addEventListener('mousemove', e => {
      if (!this.ativo) return;
      this.yaw -= e.movementX * this.sensibilidade;
      this.pitch -= e.movementY * this.sensibilidade;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    });
    addEventListener('mousedown', e => {
      if (!this.ativo || e.button !== 0) return;
      this.atirando = true;
      if (this.arma) this.arma.atirar();   // pistola semiautomática: um tiro por clique
    });
    addEventListener('mouseup', () => { this.atirando = false; });
    addEventListener('blur', () => { this.teclas = {}; this.atirando = false; });
  }

  // Chamado pela arma: sobe a mira
  aplicarRecuo(rad) {
    this.recuo += rad;
  }

  // Verifica se a caixa do jogador (na posição dada) sobrepõe um colisor
  _sobrepoe(c, x, y, z, altura) {
    return x + this.raio > c.min.x && x - this.raio < c.max.x &&
           z + this.raio > c.min.z && z - this.raio < c.max.z &&
           y + altura > c.min.y + 0.001 && y < c.max.y - 0.001;
  }

  _colideAlgum(x, y, z, altura) {
    return this.mapa.colisores.some(c => this._sobrepoe(c, x, y, z, altura));
  }

  atualizar(dt) {
    const t = this.teclas;

    // --- Agachar: só levanta se houver espaço acima ---
    const querAgachar = !!(t.ControlLeft || t.ControlRight || t.KeyC);
    if (querAgachar) this.agachado = true;
    else if (this.agachado && !this._colideAlgum(this.pos.x, this.pos.y, this.pos.z, this.alturaEmPe)) {
      this.agachado = false;
    }
    const alvoAltura = this.agachado ? this.alturaAgachado : this.alturaEmPe;
    this.altura += (alvoAltura - this.altura) * Math.min(1, dt * 14);

    // --- Direção desejada (relativa para onde olhamos) ---
    let frente = (t.KeyW ? 1 : 0) - (t.KeyS ? 1 : 0);
    let lado = (t.KeyD ? 1 : 0) - (t.KeyA ? 1 : 0);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let dx = -sin * frente + cos * lado;
    let dz = -cos * frente - sin * lado;
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; }

    const lento = t.ShiftLeft || t.ShiftRight || this.agachado;
    const vMax = lento ? this.velocidadeLenta : this.velocidadeNormal;
    // Aceleração suave (menor no ar)
    const acel = (this.noChao ? 12 : 3) * dt;
    this.vel.x += (dx * vMax - this.vel.x) * Math.min(1, acel);
    this.vel.z += (dz * vMax - this.vel.z) * Math.min(1, acel);

    // --- Pulo e gravidade ---
    if (t.Space && this.noChao && !this.agachado) {
      this.vel.y = this.forcaPulo;
      this.noChao = false;
    }
    this.vel.y -= this.gravidade * dt;

    // --- Movimento por eixo, resolvendo colisões ---
    this._moverX(this.vel.x * dt);
    this._moverZ(this.vel.z * dt);
    this._moverY(this.vel.y * dt);

    // --- Câmera ---
    this.recuo *= Math.max(0, 1 - dt * 9);          // mira volta suavemente
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = Math.min(1.55, this.pitch + this.recuo);
    this.camera.position.set(this.pos.x, this.pos.y + this.altura - this.olhoOffset, this.pos.z);
  }

  _moverX(d) {
    if (!d) return;
    this.pos.x += d;
    for (const c of this.mapa.colisores) {
      if (this._sobrepoe(c, this.pos.x, this.pos.y, this.pos.z, this.altura)) {
        this.pos.x = d > 0 ? c.min.x - this.raio : c.max.x + this.raio;
        this.vel.x = 0;
      }
    }
  }

  _moverZ(d) {
    if (!d) return;
    this.pos.z += d;
    for (const c of this.mapa.colisores) {
      if (this._sobrepoe(c, this.pos.x, this.pos.y, this.pos.z, this.altura)) {
        this.pos.z = d > 0 ? c.min.z - this.raio : c.max.z + this.raio;
        this.vel.z = 0;
      }
    }
  }

  _moverY(d) {
    const yAntes = this.pos.y;
    this.pos.y += d;
    this.noChao = false;

    // Chão (y = 0)
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.noChao = true;
    }
    // Topo e fundo das caixas
    for (const c of this.mapa.colisores) {
      if (!this._sobrepoe(c, this.pos.x, this.pos.y, this.pos.z, this.altura)) continue;
      if (d <= 0 && yAntes >= c.max.y - 0.01) {          // aterrissou em cima
        this.pos.y = c.max.y;
        this.vel.y = 0;
        this.noChao = true;
      } else if (d > 0) {                                 // bateu a cabeça
        this.pos.y = c.min.y - this.altura;
        this.vel.y = 0;
      }
    }
  }
}
