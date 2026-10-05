// ===== Armas =====
// Cinco armas: pistola, SMG, fuzil, sniper (com luneta e zoom) e faca. Cada uma tem
// dano, cadência, pente, recarga, padrão de recuo (spray), precisão e ruído próprios.
//  - A precisão piora ao se mover, pular e atirar em rajada, e volta aos poucos ao parar.
//  - O dano depende da região atingida (cabeça, tronco, pernas) e cai com a distância.
//  - Tiros usam raycast contra o mapa e os inimigos: o primeiro objeto atingido vale,
//    então paredes e caixas bloqueiam tudo.

// Padrão de recuo (spray): devolve uma função i -> [subida, deriva lateral] em radianos,
// onde i é o número do tiro na rajada. A mira sobe mais nos primeiros tiros e depois
// balança de lado, como nos jogos táticos (dá para "aprender" e compensar o spray).
function padraoRecuo(sobe, deriva, ate) {
  return (i) => {
    const f = Math.min(i, ate) / ate;
    const subida = sobe * (i < ate ? 0.6 + 0.8 * f : 0.9);
    const lado = Math.sin(i * 0.85) * deriva * (0.2 + f);
    return [subida, lado];
  };
}

// Atributos das armas (todas as distâncias em metros, ângulos em radianos)
const DEFS_ARMAS = {
  pistola: {
    id: 'pistola', nome: 'PISTOLA', tipo: 'arma', auto: false, tecla: 1,
    dano: 25, intervalo: 0.22, pente: 12, reservaMax: 36, recarga: 1.4,
    alcance: 25, queda: 0.02, danoMin: 0.5,          // dano total até `alcance`; depois cai `queda` por metro
    mCabeca: 3, mobilidade: 1.0, ruido: 28,
    padrao: padraoRecuo(0.018, 0.003, 4),
    dispBase: 0.004, dispMov: 0.028, dispTiro: 0.009, dispMax: 0.05, esfriar: 0.08,
    preco: 0,
  },
  smg: {
    id: 'smg', nome: 'SMG', tipo: 'arma', auto: true, tecla: 2,
    dano: 18, intervalo: 0.07, pente: 25, reservaMax: 100, recarga: 1.9,
    alcance: 14, queda: 0.035, danoMin: 0.4,
    mCabeca: 2.5, mobilidade: 1.05, ruido: 30,
    padrao: padraoRecuo(0.006, 0.004, 12),
    dispBase: 0.005, dispMov: 0.03, dispTiro: 0.005, dispMax: 0.07, esfriar: 0.07,
    preco: 1200,
  },
  rifle: {
    id: 'rifle', nome: 'FUZIL TÁTICO', tipo: 'arma', auto: true, tecla: 3,
    dano: 28, intervalo: 0.1, pente: 30, reservaMax: 90, recarga: 2.4,
    alcance: 40, queda: 0.01, danoMin: 0.6,
    mCabeca: 3.5, mobilidade: 0.95, ruido: 38,
    padrao: padraoRecuo(0.011, 0.006, 10),
    dispBase: 0.003, dispMov: 0.05, dispTiro: 0.006, dispMax: 0.085, esfriar: 0.06,
    preco: 1800,
  },
  sniper: {
    id: 'sniper', nome: 'SNIPER', tipo: 'arma', auto: false, tecla: 4,
    dano: 100, intervalo: 1.25, pente: 5, reservaMax: 20, recarga: 3.0,
    alcance: 90, queda: 0.0, danoMin: 1,
    mCabeca: 1.5, mobilidade: 0.85, ruido: 60,
    padrao: () => [0.05, 0.004],                      // coice forte a cada disparo
    dispBase: 0.04,                                   // sem luneta: muito impreciso
    dispLuneta: 0.0004,                               // com luneta e parado: quase perfeito
    dispMov: 0.06, dispTiro: 0.0, dispMax: 0.09, esfriar: 0.1,
    luneta: true, zooms: [3, 8],                      // dois níveis de zoom (botão direito)
    preco: 2800,
  },
  faca: {
    id: 'faca', nome: 'FACA', tipo: 'faca', auto: false, tecla: 5,
    dano: 40, intervalo: 0.55, alcance: 2.4,          // aqui `alcance` é o alcance do golpe
    mCabeca: 1, mobilidade: 1.12, ruido: 4,
    traicao: 3,                                       // golpe pelas costas: dano x3
    preco: 0,
  },
};

// Ordem usada pela roda do mouse
const ORDEM_ARMAS = ['pistola', 'smg', 'rifle', 'sniper', 'faca'];

class Armas {
  constructor(camera, mapa, inimigos, hud) {
    this.camera = camera;
    this.mapa = mapa;
    this.inimigos = inimigos;       // precisa ter .malhas, .causarDano(alvo, dano, info) e .ouvirTiro(x, z, raio)
    this.hud = hud;
    this.jogador = null;            // definido depois (recuo da câmera, velocidade, etc.)
    this.travada = false;           // true na preparação e no resultado: não atira
    this.fovNormal = camera.fov;

    this.armas = {};
    for (const id of ORDEM_ARMAS) this.armas[id] = this._novaArma(DEFS_ARMAS[id]);
    this.armas.pistola.possui = true;
    this.armas.faca.possui = true;
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
    this.indiceRajada = 0;          // posição no padrão de recuo
    this.nivelMira = 0;             // 0 = sem luneta; 1.. = nível de zoom da sniper
    this.golpe = 0;                 // animação do golpe de faca

    this.raycaster = new THREE.Raycaster();
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
    return { def, possui: false, municao: def.pente || 0, reserva: def.reservaMax || 0, modelo: null };
  }

  get temRifle() { return this.armas.rifle.possui; }
  get emRajada() { return this.desdeTiro < 0.25; }     // atirando em sequência (recuo e dispersão acumulam)
  get mirando() { return this.nivelMira > 0; }

  // ---------- Modelos (caixas simples presas à câmera) ----------

  _criarModelos() {
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const caixa = (g, w, h, d, m, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      g.add(b);
      return b;
    };
    const clarao = (g, x, y, z) => {
      const c = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ color: 0xffdd66 });
      c.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03), m));
      c.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.02), m));
      c.add(new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.02), m));
      c.position.set(x, y, z);
      c.visible = false;
      g.add(c);
      return c;
    };
    const preto = mat(0x222222), grafite = mat(0x2a2d31), cinza = mat(0x555a60), escuro = mat(0x1c1e21);

    // Pistola
    const p = new THREE.Group();
    caixa(p, 0.06, 0.07, 0.28, cinza, 0, 0, 0);
    caixa(p, 0.05, 0.14, 0.07, preto, 0, -0.1, 0.08).rotation.x = -0.2;
    this.armas.pistola.modelo = { grupo: p, pente: caixa(p, 0.04, 0.09, 0.05, mat(0x111111), 0, -0.16, 0.09),
      clarao: clarao(p, 0, 0, -0.18), pos: new THREE.Vector3(0.2, -0.2, -0.45), kick: 0.06 };

    // SMG: compacta, carregador longo e fino
    const s = new THREE.Group();
    caixa(s, 0.065, 0.09, 0.36, grafite, 0, 0, 0);
    caixa(s, 0.04, 0.04, 0.18, escuro, 0, 0.005, -0.26);
    caixa(s, 0.045, 0.12, 0.07, preto, 0, -0.1, 0.1).rotation.x = -0.15;
    caixa(s, 0.05, 0.08, 0.12, mat(0x3a3d42), 0, -0.005, 0.24);
    this.armas.smg.modelo = { grupo: s, pente: caixa(s, 0.04, 0.2, 0.05, mat(0x1a1a1a), 0, -0.16, -0.06),
      clarao: clarao(s, 0, 0.005, -0.38), pos: new THREE.Vector3(0.2, -0.21, -0.46), kick: 0.04 };

    // Fuzil
    const r = new THREE.Group();
    caixa(r, 0.07, 0.1, 0.5, grafite, 0, 0, 0);
    caixa(r, 0.05, 0.05, 0.3, escuro, 0, 0.01, -0.38);
    caixa(r, 0.06, 0.12, 0.2, mat(0x3a3d42), 0, -0.01, 0.34);
    caixa(r, 0.045, 0.14, 0.07, preto, 0, -0.11, 0.1).rotation.x = -0.15;
    caixa(r, 0.04, 0.03, 0.14, escuro, 0, 0.075, -0.05);
    this.armas.rifle.modelo = { grupo: r, pente: caixa(r, 0.05, 0.17, 0.08, mat(0x1a1a1a), 0, -0.13, -0.08),
      clarao: clarao(r, 0, 0.01, -0.58), pos: new THREE.Vector3(0.2, -0.22, -0.5), kick: 0.05 };

    // Sniper: cano longo, luneta e coronha
    const n = new THREE.Group();
    caixa(n, 0.06, 0.09, 0.62, mat(0x2f3a2a), 0, 0, 0);
    caixa(n, 0.035, 0.035, 0.5, escuro, 0, 0.01, -0.55);
    caixa(n, 0.06, 0.13, 0.26, mat(0x3a3d30), 0, -0.01, 0.4);
    caixa(n, 0.045, 0.12, 0.07, preto, 0, -0.1, 0.12).rotation.x = -0.15;
    const luneta = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10), escuro);
    luneta.rotation.x = Math.PI / 2; luneta.position.set(0, 0.095, -0.05); n.add(luneta);
    this.armas.sniper.modelo = { grupo: n, pente: caixa(n, 0.04, 0.08, 0.06, mat(0x1a1a1a), 0, -0.1, -0.08),
      clarao: clarao(n, 0, 0.01, -0.82), pos: new THREE.Vector3(0.2, -0.22, -0.52), kick: 0.1 };

    // Faca
    const f = new THREE.Group();
    caixa(f, 0.025, 0.06, 0.3, mat(0xc7ccd1), 0, 0, -0.17);          // lâmina
    caixa(f, 0.04, 0.05, 0.12, preto, 0, 0, 0.04);                   // cabo
    caixa(f, 0.07, 0.03, 0.025, cinza, 0, 0, -0.015);                // guarda
    this.armas.faca.modelo = { grupo: f, pente: null, clarao: null, pos: new THREE.Vector3(0.22, -0.22, -0.4), kick: 0 };

    for (const a of Object.values(this.armas)) {
      a.modelo.grupo.position.copy(a.modelo.pos);
      a.modelo.grupo.visible = false;
      this.camera.add(a.modelo.grupo);
      if (a.modelo.pente) a.modelo.penteY = a.modelo.pente.position.y;
    }
  }

  _mostrarModelo() {
    for (const a of Object.values(this.armas)) a.modelo.grupo.visible = (a === this.atual) && !this.mirando;
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

  // ---------- Precisão e dano ----------

  // Dispersão atual em radianos (cone em volta da mira)
  dispersao() {
    const d = this.atual.def;
    if (d.tipo === 'faca') return 0;
    const base = (d.luneta && this.mirando) ? d.dispLuneta : d.dispBase;
    return Math.min(d.dispMax, base + this.movimento + this.calor);
  }

  // Dano final: multiplicador da região (cabeça/tronco/pernas) x queda com a distância
  calcularDano(def, regiao, dist) {
    const m = regiao === 'cabeca' ? def.mCabeca : regiao === 'pernas' ? 0.75 : 1;
    const f = dist > def.alcance ? Math.max(def.danoMin, 1 - (dist - def.alcance) * def.queda) : 1;
    return def.dano * m * f;
  }

  // ---------- Ações ----------

  // Dispara (ou golpeia, no caso da faca). Retorna true se atirou.
  atirar() {
    const a = this.atual, d = a.def;
    if (this.travada || (this.jogador && !this.jogador.vivo)) return false;
    if (this.recarregando > 0 || this.espera > 0 || this.troca > 0) return false;
    if (d.tipo === 'faca') return this._golpear();
    if (a.municao <= 0) { this.recarregar(); return false; }

    a.municao--;
    // Padrão de recuo: continua de onde parou se ainda está em rajada; senão recomeça
    this.indiceRajada = this.desdeTiro < 0.3 + d.intervalo ? this.indiceRajada + 1 : 0;
    this.desdeTiro = 0;
    this.espera = d.intervalo;
    this.kick = 1;
    this.flash = 0.045;
    a.modelo.clarao.visible = !this.mirando;
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

    // Recuo em padrão (a câmera sobe e desvia) e aumento da dispersão
    const [subida, lado] = d.padrao(this.indiceRajada);
    if (this.jogador) this.jogador.aplicarRecuo(subida, lado);
    this.calor = Math.min(d.dispMax, this.calor + d.dispTiro);
    if (d.luneta) this.nivelMira = 0, this._aplicarZoom(true);        // a sniper sai da luneta ao atirar
    if (this.inimigos.ouvirTiro && this.jogador) this.inimigos.ouvirTiro(this.jogador.pos.x, this.jogador.pos.z, d.ruido);

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
        const regiao = hit.object.userData.regiao || 'tronco';
        const morreu = this.inimigos.causarDano(alvo, this.calcularDano(d, regiao, hit.distance),
          { arma: d.nome, cabeca: regiao === 'cabeca' });
        this.hud.marcarAcerto(morreu, regiao === 'cabeca');
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

  // Golpe de faca: acerta o que estiver na frente, a poucos metros; pelas costas causa mais dano
  _golpear() {
    const d = this.atual.def;
    this.espera = d.intervalo;
    this.golpe = 1;
    if (this.inimigos.ouvirTiro && this.jogador) this.inimigos.ouvirTiro(this.jogador.pos.x, this.jogador.pos.z, d.ruido);
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = d.alcance;
    const hits = this.raycaster.intersectObjects(this.mapa.malhas.concat(this.inimigos.malhas), false);
    if (hits.length && hits[0].object.userData.alvo) {
      const alvo = hits[0].object.userData.alvo;
      // Pelas costas: o bot olha na mesma direção do golpe
      const rot = alvo.grupo.rotation.y;
      const costas = (-Math.sin(rot)) * this.raycaster.ray.direction.x + (-Math.cos(rot)) * this.raycaster.ray.direction.z > 0.5;
      const dano = d.dano * (costas ? d.traicao : 1);
      const morreu = this.inimigos.causarDano(alvo, dano, { arma: d.nome, cabeca: false });
      this.hud.marcarAcerto(morreu, costas);
    }
    return true;
  }

  recarregar() {
    const a = this.atual;
    if (a.def.tipo === 'faca') return;
    if (this.recarregando > 0 || this.troca > 0) return;
    if (a.municao >= a.def.pente || a.reserva <= 0) return;
    this.recarregando = a.def.recarga;
    this.nivelMira = 0; this._aplicarZoom(true);               // sai da luneta para recarregar
    this._atualizarHud();
  }

  // Botão direito: liga/desliga a luneta da sniper e alterna os níveis de zoom
  alternarMira() {
    const d = this.atual.def;
    if (!d.luneta || this.recarregando > 0 || this.troca > 0 || this.travada) return;
    this.nivelMira = (this.nivelMira + 1) % (d.zooms.length + 1);
    this._aplicarZoom(false);
  }

  _aplicarZoom(imediato) {
    const d = this.atual.def;
    const zoom = this.nivelMira > 0 ? d.zooms[this.nivelMira - 1] : 1;
    this.fovAlvo = this.fovNormal / zoom;
    if (imediato) this._ajustarFov(this.fovAlvo);
    this.hud.luneta(this.nivelMira > 0, zoom);
    this._mostrarModelo();
  }

  _ajustarFov(f) {
    this.camera.fov = f;
    this.camera.updateProjectionMatrix();
    if (this.jogador) this.jogador.escalaSensibilidade = f / this.fovNormal;   // zoom maior = mouse mais lento
  }

  // Troca a arma na mão pelo id; só se o jogador a possui
  trocar(id) {
    const nova = this.armas[id];
    if (!nova || !nova.possui || nova === this.atual) return false;
    this.atual = nova;
    this.recarregando = 0;
    this.troca = 0.3;
    this.calor = 0;
    this.indiceRajada = 0;
    this.nivelMira = 0;
    this._aplicarZoom(true);
    this._mostrarModelo();
    this._atualizarHud();
    return true;
  }

  // Roda do mouse: passa para a próxima/anterior arma que o jogador possui
  trocarRelativo(passo) {
    const lista = ORDEM_ARMAS.filter(id => this.armas[id].possui);
    if (lista.length < 2) return;
    const i = lista.indexOf(this.atual.def.id);
    this.trocar(lista[(i + passo + lista.length) % lista.length]);
  }

  // ----- Compras e equipamento -----

  temArma(id) { return this.armas[id].possui; }

  comprarArma(id) {
    const a = this.armas[id];
    a.possui = true; a.municao = a.def.pente; a.reserva = a.def.reservaMax;
    this.trocar(id);
  }

  // true se a arma atual ainda pode receber munição
  precisaMunicao() { return this.atual.def.tipo === 'arma' && this.atual.reserva < this.atual.def.reservaMax; }

  comprarMunicao() {
    this.atual.reserva = this.atual.def.reservaMax;
    this._atualizarHud();
  }

  // Mata-mata: todas as armas liberadas e com munição cheia
  liberarTodas() {
    for (const a of Object.values(this.armas)) {
      a.possui = true; a.municao = a.def.pente || 0; a.reserva = a.def.reservaMax || 0;
    }
    this.recarregando = 0; this.troca = 0; this.calor = 0; this.indiceRajada = 0;
    this._atualizarHud();
  }

  // Início de cada rodada: completa os pentes com a reserva. Garante munição mínima.
  prepararRodada() {
    const p = this.armas.pistola;
    if (p.municao + p.reserva === 0) p.reserva = 12;     // ajuda para quem ficou sem nada
    for (const a of Object.values(this.armas)) {
      if (!a.possui || a.def.tipo === 'faca') continue;
      const carga = Math.min(a.def.pente - a.municao, a.reserva);
      a.municao += carga; a.reserva -= carga;
    }
    this.recarregando = 0; this.troca = 0; this.calor = 0; this.indiceRajada = 0;
    this.nivelMira = 0; this._aplicarZoom(true);
    this._atualizarHud();
  }

  // Morreu ou nova partida: volta à pistola e à faca, com munição inicial
  perderEquipamento() {
    for (const a of Object.values(this.armas)) {
      a.possui = (a.def.id === 'pistola' || a.def.id === 'faca');
      a.municao = a.def.pente || 0; a.reserva = a.def.reservaMax || 0;
    }
    this.atual = this.armas.pistola;
    this.recarregando = 0; this.troca = 0; this.calor = 0; this.indiceRajada = 0;
    this.nivelMira = 0; this._aplicarZoom(true);
    this._mostrarModelo();
    this._atualizarHud();
  }

  // ---------- Laço ----------

  atualizar(dt) {
    const a = this.atual, d = a.def, j = this.jogador;
    if (this.espera > 0) this.espera -= dt;
    if (this.troca > 0) this.troca -= dt;
    this.desdeTiro += dt;

    // Zoom suave da luneta
    if (this.fovAlvo !== undefined && Math.abs(this.camera.fov - this.fovAlvo) > 0.05) {
      this._ajustarFov(this.camera.fov + (this.fovAlvo - this.camera.fov) * Math.min(1, dt * 14));
    }

    // Dispersão pelo movimento: sobe rápido, desce devagar ("recupera ao parar")
    let alvoMov = 0;
    if (j && j.vivo && d.tipo === 'arma') {
      const v = Math.min(1, Math.hypot(j.vel.x, j.vel.z) / j.velocidadeNormal);
      alvoMov = d.dispMov * v;
      if (!j.noChao) alvoMov = d.dispMov * 1.4;           // no ar: muito impreciso
      if (j.agachado) alvoMov *= 0.5;
    }
    const taxa = alvoMov > this.movimento ? 25 : 6;
    this.movimento += (alvoMov - this.movimento) * Math.min(1, taxa * dt);
    // (em rajada esfria devagar, então a dispersão sobe; ao parar, volta em ~0,5 s)
    this.calor = Math.max(0, this.calor - (d.esfriar || 0) * dt * (this.emRajada ? 0.3 : 2.5));
    this.hud.atualizarMira(this.mirando || d.tipo === 'faca' ? 0 : this._miraEmPixels(), d.tipo === 'faca' || this.mirando);

    // Clarão e efeitos
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0 && a.modelo.clarao) a.modelo.clarao.visible = false;
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
    this.golpe = Math.max(0, this.golpe - dt * 5);
    let baixo = 0, giro = 0, penteDesce = 0, girarZ = 0, avanco = 0;
    if (this.recarregando > 0) {
      const p = 1 - this.recarregando / d.recarga;          // 0..1 durante a recarga
      const curva = Math.sin(Math.min(1, p * 1.05) * Math.PI);
      baixo = 0.16 * curva;
      giro = -0.7 * curva;
      penteDesce = (p > 0.25 && p < 0.6) ? 0.14 : 0;        // pente sai e volta
    }
    if (this.troca > 0) baixo += 0.4 * (this.troca / 0.3);   // arma sobe ao ser sacada
    if (this.golpe > 0) {                                    // golpe da faca: arco da direita para a esquerda
      const t = 1 - this.golpe;
      avanco = -0.25 * Math.sin(t * Math.PI);
      girarZ = 1.1 - 2.2 * t;
      giro = -0.5 * Math.sin(t * Math.PI);
    }
    m.grupo.position.set(m.pos.x - girarZ * 0.05, m.pos.y - baixo, m.pos.z + this.kick * m.kick + avanco);
    m.grupo.rotation.set(this.kick * 0.15 + giro, 0, girarZ * 0.5);
    if (m.pente) m.pente.position.y = m.penteY - penteDesce;
  }

  // Converte a dispersão (rad) em pixels de afastamento da mira
  _miraEmPixels() {
    const fovTan = Math.tan(this.camera.fov * Math.PI / 360);
    return 4 + Math.tan(this.dispersao()) / fovTan * (innerHeight / 2);
  }

  _atualizarHud() {
    const a = this.atual;
    const faca = a.def.tipo === 'faca';
    this.hud.atualizarMunicao(faca ? null : a.municao, a.reserva, this.recarregando > 0, a.def.nome);
    this.hud.atualizarArmas(ORDEM_ARMAS.map(id => ({ tecla: DEFS_ARMAS[id].tecla, nome: DEFS_ARMAS[id].nome,
      possui: this.armas[id].possui, ativo: this.armas[id] === a })));
  }
}
