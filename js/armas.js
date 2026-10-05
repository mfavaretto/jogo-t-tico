// ===== Armas =====
// Duas armas (pistola e fuzil tático) com atributos próprios: dano, cadência, pente,
// recarga, recuo e dispersão. A precisão piora ao se mover, pular e atirar em
// sequência, e se recupera aos poucos ao parar. Tiros usam raycast contra o mapa e os
// inimigos: a primeira coisa atingida vale, então paredes e caixas bloqueiam tudo.

const DEFS_ARMAS = {
  pistola: {
    id: 'pistola', nome: 'PISTOLA', auto: false,
    dano: 25, intervalo: 0.22, pente: 12, reservaMax: 36, recarga: 1.4,
    recuo: 0.020, recuoLateral: 0.003,           // sobe a mira (rad) e desvia um pouco para os lados
    dispBase: 0.004,                              // dispersão parada e sem atirar (rad)
    dispMov: 0.028,                               // acréscimo ao correr
    dispTiro: 0.009, dispMax: 0.05,               // acréscimo por tiro seguido e teto total
    esfriar: 0.08,                                // quanto da dispersão por tiro some por segundo
    preco: 0,
  },
  rifle: {
    id: 'rifle', nome: 'FUZIL TÁTICO', auto: true,
    dano: 30, intervalo: 0.1, pente: 30, reservaMax: 90, recarga: 2.4,
    recuo: 0.010, recuoLateral: 0.006,
    dispBase: 0.003, dispMov: 0.050,
    dispTiro: 0.006, dispMax: 0.085,
    esfriar: 0.06,
    preco: 1800,
  },
};

class Armas {
  constructor(camera, mapa, inimigos, hud) {
    this.camera = camera;
    this.mapa = mapa;
    this.inimigos = inimigos;       // precisa ter .malhas e .causarDano(alvo, dano)
    this.hud = hud;
    this.jogador = null;            // definido depois (recuo da câmera, velocidade, etc.)
    this.travada = false;           // true na preparação e no resultado: não atira

    this.armas = {};
    for (const id of Object.keys(DEFS_ARMAS)) this.armas[id] = this._novaArma(DEFS_ARMAS[id]);
    this.armas.pistola.possui = true;
    this.atual = this.armas.pistola;

    // Estado de uso
    this.espera = 0;                // tempo até poder atirar de novo
    this.recarregando = 0;          // tempo restante da recarga (0 = não recarrega)
    this.troca = 0;                 // tempo restante da troca de arma
    this.kick = 0;                  // recuo visual do modelo (0..1)
    this.flash = 0;                 // tempo restante do clarão do cano
    this.calor = 0;                 // dispersão acumulada por tiros seguidos
    this.movimento = 0;             // dispersão causada pelo movimento (suavizada)
    this.desdeTiro = 9;             // segundos desde o último tiro

    this.raycaster = new THREE.Raycaster();
    this._dir = new THREE.Vector3();
    this._dir2 = new THREE.Vector3();
    this._lado = new THREE.Vector3();
    this._cima = new THREE.Vector3();
    this._ponta = new THREE.Vector3();

    this._criarModelos();
    this._criarEfeitos();
    this._mostrarModelo();
    this._atualizarHud();
  }

  _novaArma(def) {
    return { def, possui: false, municao: def.pente, reserva: def.reservaMax, modelo: null };
  }

  get temRifle() { return this.armas.rifle.possui; }
  get emRajada() { return this.desdeTiro < 0.25; }     // atirando em sequência (recuo e dispersão acumulam)

  // ---------- Modelos (caixas simples presas à câmera) ----------

  _criarModelos() {
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const caixa = (g, w, h, d, m, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      g.add(b);
      return b;
    };
    const clarao = () => {
      const g = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ color: 0xffdd66 });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03), m));
      const cruz = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.02), m);
      const cruz2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.02), m);
      g.add(cruz, cruz2);
      g.visible = false;
      return g;
    };

    // Pistola
    const p = new THREE.Group();
    caixa(p, 0.06, 0.07, 0.28, mat(0x555a60), 0, 0, 0);                   // ferrolho
    caixa(p, 0.05, 0.14, 0.07, mat(0x222222), 0, -0.1, 0.08).rotation.x = -0.2;   // empunhadura
    const penteP = caixa(p, 0.04, 0.09, 0.05, mat(0x111111), 0, -0.16, 0.09);
    const clP = clarao(); clP.position.set(0, 0, -0.18); p.add(clP);
    this.armas.pistola.modelo = { grupo: p, pente: penteP, clarao: clP, pos: new THREE.Vector3(0.2, -0.2, -0.45), kick: 0.06 };

    // Fuzil
    const r = new THREE.Group();
    caixa(r, 0.07, 0.1, 0.5, mat(0x2a2d31), 0, 0, 0);                      // corpo
    caixa(r, 0.05, 0.05, 0.3, mat(0x1c1e21), 0, 0.01, -0.38);              // cano / guarda-mão
    caixa(r, 0.06, 0.12, 0.2, mat(0x3a3d42), 0, -0.01, 0.34);              // coronha
    caixa(r, 0.045, 0.14, 0.07, mat(0x222222), 0, -0.11, 0.1).rotation.x = -0.15;   // empunhadura
    caixa(r, 0.04, 0.03, 0.14, mat(0x1c1e21), 0, 0.075, -0.05);            // mira
    const penteR = caixa(r, 0.05, 0.17, 0.08, mat(0x1a1a1a), 0, -0.13, -0.08);
    const clR = clarao(); clR.position.set(0, 0.01, -0.58); r.add(clR);
    this.armas.rifle.modelo = { grupo: r, pente: penteR, clarao: clR, pos: new THREE.Vector3(0.2, -0.22, -0.5), kick: 0.05 };

    for (const a of Object.values(this.armas)) {
      a.modelo.grupo.position.copy(a.modelo.pos);
      a.modelo.grupo.visible = false;
      this.camera.add(a.modelo.grupo);
      a.modelo.penteY = a.modelo.pente.position.y;
    }
  }

  _mostrarModelo() {
    for (const a of Object.values(this.armas)) a.modelo.grupo.visible = (a === this.atual);
  }

  // ---------- Efeitos: marcas de impacto, faíscas e rastro dos tiros ----------

  _criarEfeitos() {
    const scene = this.mapa.scene;
    this.marcas = []; this.marcaAtual = 0;
    const geoMarca = new THREE.SphereGeometry(0.05, 6, 4), matMarca = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(geoMarca, matMarca);
      m.visible = false; scene.add(m); this.marcas.push(m);
    }
    this.faiscas = []; this.faiscaAtual = 0;
    const geoF = new THREE.BoxGeometry(0.1, 0.1, 0.1), matF = new THREE.MeshBasicMaterial({ color: 0xffd36b });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(geoF, matF);
      m.visible = false; scene.add(m); this.faiscas.push({ m, t: 0 });
    }
    this.rastros = []; this.rastroAtual = 0;
    const matR = new THREE.LineBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(geo, matR);
      l.frustumCulled = false; l.visible = false; scene.add(l);
      this.rastros.push({ l, t: 0 });
    }
  }

  _impacto(ponto) {
    const m = this.marcas[this.marcaAtual];
    this.marcaAtual = (this.marcaAtual + 1) % this.marcas.length;
    m.position.copy(ponto); m.visible = true;
    const f = this.faiscas[this.faiscaAtual];
    this.faiscaAtual = (this.faiscaAtual + 1) % this.faiscas.length;
    f.m.position.copy(ponto); f.m.scale.setScalar(1); f.m.visible = true; f.t = 0.12;
  }

  _rastro(de, para) {
    const r = this.rastros[this.rastroAtual];
    this.rastroAtual = (this.rastroAtual + 1) % this.rastros.length;
    const p = r.l.geometry.attributes.position;
    p.setXYZ(0, de.x, de.y, de.z); p.setXYZ(1, para.x, para.y, para.z);
    p.needsUpdate = true; r.l.visible = true; r.t = 0.05;
  }

  // ---------- Precisão ----------

  // Dispersão atual em radianos (cone em volta da mira)
  dispersao() {
    const d = this.atual.def;
    return Math.min(d.dispMax, d.dispBase + this.movimento + this.calor);
  }

  // ---------- Ações ----------

  // Dispara um tiro. Retorna true se atirou.
  atirar() {
    const a = this.atual, d = a.def;
    if (this.travada || (this.jogador && !this.jogador.vivo)) return false;
    if (this.recarregando > 0 || this.espera > 0 || this.troca > 0) return false;
    if (a.municao <= 0) { this.recarregar(); return false; }

    a.municao--;
    this.desdeTiro = 0;
    this.espera = d.intervalo;
    this.kick = 1;
    this.flash = 0.045;
    a.modelo.clarao.visible = true;
    a.modelo.clarao.rotation.z = Math.random() * 3;

    // Direção do tiro: centro da tela + desvio aleatório dentro do cone de dispersão
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = 150;
    const disp = this.dispersao();
    const raio = Math.sqrt(Math.random()) * disp, ang = Math.random() * Math.PI * 2;
    this._lado.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this._cima.setFromMatrixColumn(this.camera.matrixWorld, 1);
    const dir = this.raycaster.ray.direction;
    dir.addScaledVector(this._lado, Math.cos(ang) * raio).addScaledVector(this._cima, Math.sin(ang) * raio).normalize();

    // Recuo da câmera e aumento da dispersão
    if (this.jogador) this.jogador.aplicarRecuo(d.recuo, (Math.random() - 0.5) * 2 * d.recuoLateral);
    this.calor = Math.min(d.dispMax, this.calor + d.dispTiro);

    // O primeiro objeto atingido vale: parede/caixa protege o inimigo
    const objetos = this.mapa.malhas.concat(this.inimigos.malhas);
    const hits = this.raycaster.intersectObjects(objetos, false);
    a.modelo.grupo.updateMatrixWorld(true);
    const origem = a.modelo.clarao.getWorldPosition(this._ponta);
    if (hits.length) {
      const hit = hits[0];
      const alvo = hit.object.userData.alvo;
      this._rastro(origem, hit.point);
      if (alvo) {
        const cabeca = !!hit.object.userData.cabeca;
        const morreu = this.inimigos.causarDano(alvo, cabeca ? d.dano * 3 : d.dano);
        this.hud.marcarAcerto(morreu, cabeca);
      } else {
        this._impacto(hit.point);
      }
    } else {
      this._rastro(origem, this._dir2.copy(origem).addScaledVector(dir, 60));
    }

    this._atualizarHud();
    if (a.municao === 0 && a.reserva > 0) this.recarregar();   // recarga automática
    return true;
  }

  recarregar() {
    const a = this.atual;
    if (this.recarregando > 0 || this.troca > 0) return;
    if (a.municao >= a.def.pente || a.reserva <= 0) return;
    this.recarregando = a.def.recarga;
    this._atualizarHud();
  }

  // Troca a arma na mão ('pistola' ou 'rifle'); só se o jogador a possui
  trocar(id) {
    const nova = this.armas[id];
    if (!nova || !nova.possui || nova === this.atual) return false;
    this.atual = nova;
    this.recarregando = 0;
    this.troca = 0.3;
    this.calor = 0;
    this._mostrarModelo();
    this._atualizarHud();
    return true;
  }

  // ----- Compras (a loja decide o preço; aqui só aplicamos o efeito) -----

  comprarRifle() {
    const r = this.armas.rifle;
    r.possui = true; r.municao = r.def.pente; r.reserva = r.def.reservaMax;
    this.trocar('rifle');
  }

  // true se a arma atual ainda pode receber munição
  precisaMunicao() { return this.atual.reserva < this.atual.def.reservaMax; }

  comprarMunicao() {
    this.atual.reserva = this.atual.def.reservaMax;
    this._atualizarHud();
  }

  // ----- Estado entre rodadas -----

  // Início de cada rodada: completa os pentes com a reserva. Garante munição mínima.
  prepararRodada() {
    const p = this.armas.pistola;
    if (p.municao + p.reserva === 0) p.reserva = 12;     // ajuda para quem ficou sem nada
    for (const a of Object.values(this.armas)) {
      if (!a.possui) continue;
      const falta = a.def.pente - a.municao;
      const carga = Math.min(falta, a.reserva);
      a.municao += carga; a.reserva -= carga;
    }
    this.recarregando = 0; this.troca = 0; this.calor = 0;
    this._atualizarHud();
  }

  // Morreu ou nova partida: volta à pistola com munição inicial
  perderEquipamento() {
    this.armas.rifle.possui = false;
    const p = this.armas.pistola;
    p.municao = p.def.pente; p.reserva = p.def.reservaMax;
    this.atual = p;
    this.recarregando = 0; this.troca = 0; this.calor = 0;
    this._mostrarModelo();
    this._atualizarHud();
  }

  // ---------- Laço ----------

  atualizar(dt) {
    const a = this.atual, d = a.def, j = this.jogador;
    if (this.espera > 0) this.espera -= dt;
    if (this.troca > 0) this.troca -= dt;
    this.desdeTiro += dt;

    // Dispersão pelo movimento: sobe rápido, desce devagar ("recupera ao parar")
    let alvoMov = 0;
    if (j && j.vivo) {
      const v = Math.min(1, Math.hypot(j.vel.x, j.vel.z) / j.velocidadeNormal);
      alvoMov = d.dispMov * v;
      if (!j.noChao) alvoMov = d.dispMov * 1.4;           // no ar: muito impreciso
      if (j.agachado) alvoMov *= 0.5;
    }
    const taxa = alvoMov > this.movimento ? 25 : 6;
    this.movimento += (alvoMov - this.movimento) * Math.min(1, taxa * dt);
    // Dispersão dos tiros seguidos volta com o tempo
    // (em rajada esfria devagar, então a dispersão sobe; ao parar, volta em ~0,5 s)
    this.calor = Math.max(0, this.calor - d.esfriar * dt * (this.emRajada ? 0.3 : 2.5));
    this.hud.atualizarMira(this._miraEmPixels());

    // Clarão e efeitos
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) a.modelo.clarao.visible = false;
    }
    for (const f of this.faiscas) {
      if (f.t > 0) { f.t -= dt; f.m.scale.setScalar(Math.max(0.01, f.t / 0.12)); if (f.t <= 0) f.m.visible = false; }
    }
    for (const r of this.rastros) {
      if (r.t > 0) { r.t -= dt; if (r.t <= 0) r.l.visible = false; }
    }

    // Recarga
    if (this.recarregando > 0) {
      this.recarregando -= dt;
      if (this.recarregando <= 0) {
        this.recarregando = 0;
        const carga = Math.min(d.pente - a.municao, a.reserva);
        a.municao += carga; a.reserva -= carga;
        this._atualizarHud();
      }
    }

    // Animação do modelo
    const m = a.modelo;
    this.kick = Math.max(0, this.kick - dt * 8);
    let baixo = 0, giro = 0, penteDesce = 0;
    if (this.recarregando > 0) {
      const p = 1 - this.recarregando / d.recarga;          // 0..1 durante a recarga
      const curva = Math.sin(Math.min(1, p * 1.05) * Math.PI);
      baixo = 0.16 * curva;
      giro = -0.7 * curva;
      penteDesce = (p > 0.25 && p < 0.6) ? 0.14 : 0;        // pente sai e volta
    }
    if (this.troca > 0) baixo += 0.4 * (this.troca / 0.3);   // arma sobe ao ser sacada
    m.grupo.position.set(m.pos.x, m.pos.y - baixo, m.pos.z + this.kick * m.kick);
    m.grupo.rotation.x = this.kick * 0.15 + giro;
    m.pente.position.y = m.penteY - penteDesce;
  }

  // Converte a dispersão (rad) em pixels de afastamento da mira
  _miraEmPixels() {
    const fovTan = Math.tan(this.camera.fov * Math.PI / 360);
    return 4 + Math.tan(this.dispersao()) / fovTan * (innerHeight / 2);
  }

  _atualizarHud() {
    const a = this.atual;
    this.hud.atualizarMunicao(a.municao, a.reserva, this.recarregando > 0, a.def.nome);
  }
}
