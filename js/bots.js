// ===== Bots inimigos =====
// Soldados com IA simples:
//  - patrulham e, quando não veem o jogador, vão até onde o viram por último;
//  - enxergam só com campo de visão (120°) e linha de visão livre (paredes bloqueiam);
//  - navegam por um grafo de pontos (A*), então contornam prédio e contêineres sem travar;
//  - têm tempo de reação antes do primeiro tiro e precisão que cai com a distância
//    e quando o jogador está em movimento ou agachado.
// O controle de rodadas fica em rodadas.js; aqui só há criação, IA e combate.

class Bots {
  constructor(scene, mapa, jogador) {
    this.scene = scene;
    this.mapa = mapa;
    this.jogador = jogador;
    this.aoAbate = null;             // callback(bot) quando o jogador elimina um bot

    this.lista = [];                 // bots vivos
    this.malhas = [];                // meshes dos bots vivos (para o raycast dos tiros)
    this.mortos = [];                // bots caindo (animação de morte)
    this.ativo = false;              // false = congelados (preparação / resultado)

    // Ajustes de dificuldade
    this.vidaBot = 100;
    this.danoBot = 8;
    this.alcanceVisao = 35;
    this.reacaoMin = 0.55;           // segundos entre ver o jogador e o primeiro tiro
    this.reacaoExtra = 0.35;

    this.raycaster = new THREE.Raycaster();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._criarTracos();
    this._criarGrafo();
  }

  // ---------- Navegação (grafo de pontos + A*) ----------

  // true se um bot (círculo de raio r) consegue andar em linha reta de (x1,z1) a (x2,z2)
  _segLivre(x1, z1, x2, z2, r = 0.4) {
    const dx = x2 - x1, dz = z2 - z1;
    for (const c of this.mapa.colisores) {
      if (c.min.y >= 1.5) continue;
      // Teste segmento x caixa expandida pelo raio (método das "slabs")
      let t0 = 0, t1 = 1;
      for (const [o, d, mn, mx] of [[x1, dx, c.min.x - r, c.max.x + r], [z1, dz, c.min.z - r, c.max.z + r]]) {
        if (Math.abs(d) < 1e-9) { if (o <= mn || o >= mx) { t0 = 2; break; } continue; }
        let a = (mn - o) / d, b = (mx - o) / d;
        if (a > b) { const t = a; a = b; b = t; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) break;
      }
      if (t0 <= t1) return false;
    }
    return true;
  }

  _pontoLivre(x, z, folga) {
    return !this.mapa.colisores.some(c =>
      c.min.y < 1.5 && x > c.min.x - folga && x < c.max.x + folga && z > c.min.z - folga && z < c.max.z + folga);
  }

  _criarGrafo() {
    this.nos = [];
    const passo = 2, lim = 18;
    for (let x = -lim; x <= lim; x += passo) {
      for (let z = -lim; z <= lim; z += passo) {
        if (this._pontoLivre(x, z, 0.55)) this.nos.push({ x, z, viz: [] });
      }
    }
    // Liga pontos vizinhos (até ~2,9 m) quando o caminho em linha reta está livre
    for (let i = 0; i < this.nos.length; i++) {
      for (let j = i + 1; j < this.nos.length; j++) {
        const a = this.nos[i], b = this.nos[j];
        if (Math.abs(a.x - b.x) > 2.01 || Math.abs(a.z - b.z) > 2.01) continue;
        if (this._segLivre(a.x, a.z, b.x, b.z, 0.4)) { a.viz.push(j); b.viz.push(i); }
      }
    }
  }

  _noProximo(x, z) {
    let melhor = 0, md = Infinity;
    for (let i = 0; i < this.nos.length; i++) {
      const n = this.nos[i];
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < md && this._segLivre(x, z, n.x, n.z, 0.3)) { md = d; melhor = i; }
    }
    if (md === Infinity) {                       // nada visível: usa o mais próximo mesmo assim
      for (let i = 0; i < this.nos.length; i++) {
        const d = Math.hypot(this.nos[i].x - x, this.nos[i].z - z);
        if (d < md) { md = d; melhor = i; }
      }
    }
    return melhor;
  }

  // A*: devolve lista de pontos {x,z} do início até o destino
  _caminho(x1, z1, x2, z2) {
    const ini = this._noProximo(x1, z1), fim = this._noProximo(x2, z2);
    const n = this.nos.length;
    const g = new Float32Array(n).fill(Infinity), pai = new Int16Array(n).fill(-1);
    const aberto = [ini], fechado = new Uint8Array(n);
    g[ini] = 0;
    const h = (i) => Math.hypot(this.nos[i].x - this.nos[fim].x, this.nos[i].z - this.nos[fim].z);
    while (aberto.length) {
      let k = 0;
      for (let i = 1; i < aberto.length; i++) if (g[aberto[i]] + h(aberto[i]) < g[aberto[k]] + h(aberto[k])) k = i;
      const atual = aberto.splice(k, 1)[0];
      if (atual === fim) break;
      fechado[atual] = 1;
      for (const v of this.nos[atual].viz) {
        if (fechado[v]) continue;
        const custo = g[atual] + Math.hypot(this.nos[atual].x - this.nos[v].x, this.nos[atual].z - this.nos[v].z);
        if (custo < g[v]) {
          g[v] = custo; pai[v] = atual;
          if (!aberto.includes(v)) aberto.push(v);
        }
      }
    }
    const rota = [];
    for (let i = fim; i !== -1; i = pai[i]) rota.unshift({ x: this.nos[i].x, z: this.nos[i].z });
    rota.push({ x: x2, z: z2 });
    return rota;
  }

  // ---------- Tiros dos bots (traços visuais) ----------

  _criarTracos() {
    this.tracos = [];
    const mat = new THREE.LineBasicMaterial({ color: 0xffee88 });
    for (let i = 0; i < 12; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const linha = new THREE.Line(geo, mat);
      linha.frustumCulled = false;
      linha.visible = false;
      this.scene.add(linha);
      this.tracos.push({ linha, t: 0 });
    }
    this.tracoAtual = 0;
  }

  _traco(de, para) {
    const tr = this.tracos[this.tracoAtual];
    this.tracoAtual = (this.tracoAtual + 1) % this.tracos.length;
    const p = tr.linha.geometry.attributes.position;
    p.setXYZ(0, de.x, de.y, de.z);
    p.setXYZ(1, para.x, para.y, para.z);
    p.needsUpdate = true;
    tr.linha.visible = true;
    tr.t = 0.07;
  }

  // ---------- Criação / remoção ----------

  criar(x, z) {
    const grupo = new THREE.Group();
    grupo.rotation.order = 'YXZ';
    const mats = {
      roupa: new THREE.MeshLambertMaterial({ color: 0x3b4a3a }),     // uniforme verde-oliva
      colete: new THREE.MeshLambertMaterial({ color: 0x2b2f33 }),
      pele: new THREE.MeshLambertMaterial({ color: 0xe0b48a }),
      perna: new THREE.MeshLambertMaterial({ color: 0x2c3328 }),
    };
    const parte = (w, h, d, mat, y, cabeca = false) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.y = y;
      m.castShadow = true;
      m.userData.cabeca = cabeca;
      grupo.add(m);
      return m;
    };
    const malhas = [
      parte(0.5, 0.65, 0.3, mats.perna, 0.33),
      parte(0.62, 0.62, 0.36, mats.roupa, 0.96),
      parte(0.34, 0.34, 0.34, mats.pele, 1.42, true),
    ];
    // Colete tático e capacete (visuais; o capacete conta como cabeça)
    const colete = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.42, 0.4), mats.colete);
    colete.position.y = 1.0;
    grupo.add(colete);
    const capacete = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), mats.colete);
    capacete.position.y = 1.64;
    capacete.userData.cabeca = true;
    grupo.add(capacete);
    malhas.push(colete, capacete);
    colete.userData.cabeca = false;

    // Arma + clarão do cano
    const arma = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.5), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    arma.position.set(0.28, 1.0, -0.3);
    grupo.add(arma);
    const clarao = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), new THREE.MeshBasicMaterial({ color: 0xffdd66 }));
    clarao.position.set(0, 0, -0.3);
    clarao.visible = false;
    arma.add(clarao);

    grupo.position.set(x, 0, z);
    this.scene.add(grupo);

    const bot = {
      grupo, mats, malhas, arma, clarao, flashArma: 0,
      vida: this.vidaBot, flash: 0,
      ve: false, tVisao: Math.random() * 0.2,       // vê o jogador agora?
      reacao: 0,                                      // tempo vendo o jogador
      reacaoMax: this.reacaoMin + Math.random() * this.reacaoExtra,
      espera: 0,                                      // tempo até o próximo tiro
      memoria: 0, ultima: new THREE.Vector3(),       // última posição conhecida do jogador
      destino: null, rota: null, metaRota: null,
      strafe: 1, tStrafe: 0, preso: 0,
    };
    for (const m of malhas) m.userData.alvo = bot;
    this.lista.push(bot);
    this.malhas.push(...malhas);
    return bot;
  }

  limpar() {
    for (const b of this.lista.concat(this.mortos)) this.scene.remove(b.grupo);
    this.lista = []; this.malhas = []; this.mortos = [];
    for (const t of this.tracos) { t.linha.visible = false; t.t = 0; }
  }

  // Cria n bots nos pontos de nascimento (lado norte do mapa)
  iniciarRodada(n) {
    this.limpar();
    const pontos = this.mapa.spawnsBots.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) {
      const [x, z] = pontos[i % pontos.length];
      const b = this.criar(x, z);
      b.grupo.rotation.y = 0;                    // olhando para o sul (para o jogador)
      b.espera = 0.6 + Math.random() * 0.8;
    }
  }

  // Dano vindo do jogador; retorna true se o bot morreu
  causarDano(bot, dano) {
    bot.vida -= dano;
    bot.flash = 0.1;
    for (const m of Object.values(bot.mats)) m.emissive.set(0xffffff);
    // Ao ser atingido, o bot descobre onde o jogador está
    bot.memoria = 5;
    bot.ultima.set(this.jogador.pos.x, 0, this.jogador.pos.z);
    bot.reacao = Math.max(bot.reacao, bot.reacaoMax * 0.5);
    if (bot.vida > 0) return false;

    this.lista.splice(this.lista.indexOf(bot), 1);
    this.malhas = this.malhas.filter(m => !bot.malhas.includes(m));
    bot.tMorte = 0;
    bot.clarao.visible = false;
    this.mortos.push(bot);
    if (this.aoAbate) this.aoAbate(bot);
    return true;
  }

  // ---------- Percepção ----------

  // Campo de visão (120°) + linha de visão livre. Muito perto, ele "ouve" mesmo pelas costas.
  _enxerga(b, dx, dz, dist) {
    if (dist > this.alcanceVisao) return false;
    const g = b.grupo;
    const fx = -Math.sin(g.rotation.y), fz = -Math.cos(g.rotation.y);
    if (dist > 6 && (dx * fx + dz * fz) / dist < 0.5) return false;
    const j = this.jogador;
    this._a.set(g.position.x, 1.5, g.position.z);
    this._b.set(j.pos.x, j.pos.y + j.altura * 0.6, j.pos.z);
    return this._livre(this._a, this._b);
  }

  // true se não há parede/caixa entre os dois pontos (usa os meshes do mapa)
  _livre(a, b) {
    this._dir.subVectors(b, a);
    const d = this._dir.length();
    this.raycaster.set(a, this._dir.normalize());
    this.raycaster.far = d;
    return this.raycaster.intersectObjects(this.mapa.malhas, false).length === 0;
  }

  // ---------- Movimento ----------

  _bloqueia(x, z) {
    const r = 0.35;
    return this.mapa.colisores.some(c =>
      c.min.y < 1.5 && x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z);
  }

  _mover(b, vx, vz, dt) {
    const p = b.grupo.position;
    const nx = p.x + vx * dt;
    if (!this._bloqueia(nx, p.z)) p.x = nx;
    const nz = p.z + vz * dt;
    if (!this._bloqueia(p.x, nz)) p.z = nz;
    // Separação simples entre bots para não ficarem empilhados
    for (const o of this.lista) {
      if (o === b) continue;
      const ox = p.x - o.grupo.position.x, oz = p.z - o.grupo.position.z;
      const d = Math.hypot(ox, oz);
      if (d > 0 && d < 0.7) {
        const sx = p.x + (ox / d) * (0.7 - d) * 0.5, sz = p.z + (oz / d) * (0.7 - d) * 0.5;
        if (!this._bloqueia(sx, p.z)) p.x = sx;
        if (!this._bloqueia(p.x, sz)) p.z = sz;
      }
    }
  }

  // Sorteia um destino de patrulha; prefere pontos até ~14 m do jogador para manter a ação
  _novoDestino(b) {
    const p = b.grupo.position, j = this.jogador;
    const longe = this.nos.filter(n => Math.hypot(n.x - p.x, n.z - p.z) > 5);
    const perto = longe.filter(n => Math.hypot(n.x - j.pos.x, n.z - j.pos.z) < 14);
    const base = (perto.length && Math.random() < 0.7) ? perto : longe;
    return base[Math.floor(Math.random() * base.length)] || this.nos[0];
  }

  // Calcula a direção para chegar em (mx, mz): reto se livre, senão pela rota A*.
  // Retorna { chegou, ax, az } (direção desejada).
  _rumo(b, mx, mz) {
    const p = b.grupo.position;
    if (Math.hypot(mx - p.x, mz - p.z) < 0.8) return { chegou: true };
    let alvo = { x: mx, z: mz };
    if (this._segLivre(p.x, p.z, mx, mz, 0.4)) {
      b.rota = null;
    } else {
      if (!b.rota || !b.rota.length || !b.metaRota || Math.hypot(b.metaRota.x - mx, b.metaRota.z - mz) > 1.5) {
        b.rota = this._caminho(p.x, p.z, mx, mz);
        b.metaRota = { x: mx, z: mz };
      }
      // Descarta pontos já alcançados ou que dá para pular em linha reta
      while (b.rota.length > 1 && (Math.hypot(b.rota[0].x - p.x, b.rota[0].z - p.z) < 0.7 ||
             this._segLivre(p.x, p.z, b.rota[1].x, b.rota[1].z, 0.4))) b.rota.shift();
      alvo = b.rota[0] || alvo;
    }
    return { chegou: false, ax: alvo.x - p.x, az: alvo.z - p.z };
  }

  // ---------- Combate ----------

  _atirar(b, dist) {
    const j = this.jogador;
    b.grupo.updateMatrixWorld(true);
    const origem = b.arma.getWorldPosition(new THREE.Vector3());
    const alvo = new THREE.Vector3(j.pos.x, j.pos.y + j.altura * 0.6, j.pos.z);

    // Precisão: cai com a distância; piora se o jogador se move rápido ou está agachado
    const vel = Math.hypot(j.vel.x, j.vel.z);
    let chance = Math.min(0.5, Math.max(0.12, 0.62 - dist * 0.02));
    if (vel > 3) chance *= 0.65;
    if (j.agachado) chance *= 0.8;
    let acertou = Math.random() < chance;
    if (!acertou) alvo.add(new THREE.Vector3((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.8));

    // O tiro só atinge se não houver parede/obstáculo no caminho
    this._dir.subVectors(alvo, origem);
    const d = this._dir.length();
    this.raycaster.set(origem, this._dir.normalize());
    this.raycaster.far = d;
    const bloqueio = this.raycaster.intersectObjects(this.mapa.malhas, false);
    if (bloqueio.length) { alvo.copy(bloqueio[0].point); acertou = false; }

    this._traco(origem, alvo);
    b.clarao.visible = true;
    b.flashArma = 0.05;
    if (acertou) j.receberDano(this.danoBot, b.grupo.position.x, b.grupo.position.z);
  }

  // ---------- Laço ----------

  _atualizarBot(b, dt) {
    const j = this.jogador, g = b.grupo;
    const dx = j.pos.x - g.position.x, dz = j.pos.z - g.position.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    b.espera -= dt;
    b.tVisao -= dt;
    if (b.tVisao <= 0) {                 // checa visão ~6x por segundo (mais leve)
      b.tVisao = 0.15 + Math.random() * 0.1;
      b.ve = j.vivo && this._enxerga(b, dx, dz, dist);
    }

    let vx = 0, vz = 0, olharX = null, olharZ = null;
    const irPara = (mx, mz, vel) => {
      const r = this._rumo(b, mx, mz);
      if (r.chegou) return true;
      const d = Math.hypot(r.ax, r.az) || 1;
      vx = r.ax / d * vel; vz = r.az / d * vel; olharX = r.ax; olharZ = r.az;
      return false;
    };

    if (b.ve) {
      // Combate: encara o jogador, anda de lado e se aproxima/afasta conforme a distância
      b.memoria = 4;
      b.ultima.set(j.pos.x, 0, j.pos.z);
      b.reacao += dt;
      olharX = dx; olharZ = dz;
      b.tStrafe -= dt;
      if (b.tStrafe <= 0) { b.tStrafe = 0.8 + Math.random() * 1.4; b.strafe = Math.random() < 0.5 ? -1 : 1; }
      const nx = dx / dist, nz = dz / dist;
      const avanco = dist > 14 ? 1 : dist < 6 ? -1 : 0;
      vx = (-nz * b.strafe * 0.7 + nx * avanco) * 2.6;
      vz = (nx * b.strafe * 0.7 + nz * avanco) * 2.6;
      if (b.reacao >= b.reacaoMax && b.espera <= 0) {
        b.espera = 0.9 + Math.random() * 0.6;
        this._atirar(b, dist);
      }
    } else if (b.memoria > 0) {
      // Perdeu o jogador de vista: vai até onde o viu por último (contornando obstáculos)
      b.reacao = 0;
      b.memoria -= dt;
      if (irPara(b.ultima.x, b.ultima.z, 3.2)) b.memoria = 0;
    } else {
      // Patrulha
      b.reacao = 0;
      if (!b.destino) { b.destino = this._novoDestino(b); b.rota = null; }
      if (irPara(b.destino.x, b.destino.z, 1.9)) b.destino = null;
    }

    const px = g.position.x, pz = g.position.z;
    this._mover(b, vx, vz, dt);
    const esperado = Math.hypot(vx, vz) * dt;
    if (esperado > 0 && Math.hypot(g.position.x - px, g.position.z - pz) < esperado * 0.25) b.preso += dt;
    else b.preso = 0;
    if (b.preso > 0.6) {                  // travado: recalcula tudo
      b.preso = 0;
      b.destino = null;
      b.rota = null;
      b.strafe *= -1;
      if (!b.ve) b.memoria = 0;
    }

    if (olharX !== null) {                // gira suavemente para o lado desejado
      const alvoRot = Math.atan2(-olharX, -olharZ);
      let diff = alvoRot - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 9);
    }
  }

  // Efeitos visuais dos bots (clarão do cano, flash de acerto)
  _efeitos(b, dt) {
    if (b.flashArma > 0) {
      b.flashArma -= dt;
      if (b.flashArma <= 0) b.clarao.visible = false;
    }
    if (b.flash > 0) {
      b.flash -= dt;
      if (b.flash <= 0) for (const m of Object.values(b.mats)) m.emissive.set(0x000000);
    }
  }

  atualizar(dt) {
    for (const b of this.lista) {
      if (this.ativo) this._atualizarBot(b, dt);
      this._efeitos(b, dt);
    }

    // Animação de morte: cai para frente e some depois de um tempo
    for (let i = this.mortos.length - 1; i >= 0; i--) {
      const m = this.mortos[i];
      m.tMorte += dt;
      m.grupo.rotation.x = -Math.min(1, m.tMorte / 0.35) * Math.PI / 2;
      this._efeitos(m, dt);
      if (m.tMorte > 3) { this.scene.remove(m.grupo); this.mortos.splice(i, 1); }
    }

    for (const t of this.tracos) {
      if (t.t > 0) { t.t -= dt; if (t.t <= 0) t.linha.visible = false; }
    }
  }
}
