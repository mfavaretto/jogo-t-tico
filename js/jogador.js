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
    this.vidaMax = 100;
    this.armadura = 0;               // colete: absorve parte do dano
    this.vivo = true;
    this.hud = null;                 // definidos depois (main.js)
    this.aoMorrer = null;
    this.agachado = false;
    this.teclas = {};
    this.atirando = false;           // botão do mouse pressionado
    this.lojaAberta = false;         // com a loja aberta, os números compram em vez de trocar de arma
    this.ativo = false;              // true com o Pointer Lock ativo

    this._ligarEntrada(dominio);
  }

  _ligarEntrada(canvas) {
    addEventListener('keydown', e => {
      this.teclas[e.code] = true;
      if (e.code === 'Space' || e.code.startsWith('Control')) e.preventDefault();
      if (!this.ativo || !this.arma || this.lojaAberta) return;
      if (e.code === 'KeyR') this.arma.recarregar();
      if (e.code === 'Digit1') this.arma.trocar('pistola');
      if (e.code === 'Digit2') this.arma.trocar('rifle');
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

  // Dano de um inimigo; (ox, oz) é a posição de quem atirou (para o indicador de direção).
  // O colete absorve metade do dano (enquanto durar).
  receberDano(dano, ox, oz) {
    if (!this.vivo) return;
    if (this.armadura > 0) {
      const absorvido = Math.min(this.armadura, dano * 0.5);
      this.armadura -= absorvido;
      dano -= absorvido;
    }
    this.vida = Math.max(0, this.vida - dano);
    if (this.hud) {
      this.hud.atualizarVida(this.vida);
      this.hud.atualizarColete(this.armadura);
      // Ângulo do atirador em relação a onde estamos olhando (0 = à frente, positivo = direita)
      const dx = ox - this.pos.x, dz = oz - this.pos.z;
      const frente = dx * -Math.sin(this.yaw) + dz * -Math.cos(this.yaw);
      const direita = dx * Math.cos(this.yaw) + dz * -Math.sin(this.yaw);
      this.hud.sofrerDano(Math.atan2(direita, frente));
    }
    if (this.vida <= 0) {
      this.vivo = false;
      this.atirando = false;
      if (this.aoMorrer) this.aoMorrer();
    }
  }

  comprarColete() {
    this.armadura = 100;
    if (this.hud) this.hud.atualizarColete(this.armadura);
  }

  // Posiciona o jogador no início da rodada, com vida cheia. O colete só é mantido
  // se o jogador sobreviveu (quem morre perde o equipamento; ver partida).
  reiniciar() {
    const sp = this.mapa.spawnJogador;
    this.pos.set(sp.x, 0, sp.z);
    this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0; this.recuo = 0;
    this.vida = this.vidaMax;
    this.vivo = true;
    this.agachado = false;
    this.altura = this.alturaEmPe;
    this.teclas = {};
    this.atirando = false;
    if (this.hud) { this.hud.atualizarVida(this.vida); this.hud.atualizarColete(this.armadura); }
  }

  // Chamado pela arma: sobe a mira
  aplicarRecuo(rad, lateral = 0) {
    this.recuo = Math.min(0.16, this.recuo + rad);     // teto: a mira não sobe sem parar
    this.yaw += lateral;
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
    if (!this.vivo) {                // morto: a câmera desce até o chão, sem controle
      this.altura += (0.3 - this.altura) * Math.min(1, dt * 6);
      this.camera.position.set(this.pos.x, this.pos.y + this.altura, this.pos.z);
      this.camera.rotation.x += (-0.3 - this.camera.rotation.x) * Math.min(1, dt * 3);
      return;
    }
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

    // --- Tiro automático (fuzil): segura o botão para continuar atirando ---
    if (this.atirando && this.arma && this.arma.atual.def.auto) this.arma.atirar();

    // --- Câmera ---
    // A mira volta suavemente; durante uma rajada volta bem devagar (o recuo se acumula)
    this.recuo *= Math.max(0, 1 - dt * (this.arma && this.arma.emRajada ? 1.5 : 9));
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
