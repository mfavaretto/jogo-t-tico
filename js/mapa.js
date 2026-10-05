// ===== Mapa: Pátio Industrial =====
// Arena 40 x 40 com prédio central (duas portas), contêineres, sacos de areia e
// barreiras. O jogador nasce ao sul (z positivo) e os bots ao norte (z negativo).
// Cada bloco sólido vira um "colisor" (caixa alinhada aos eixos, AABB) usado pelo
// jogador, pelos bots e pelos tiros. Detalhes visuais (decor) não colidem nem bloqueiam tiros.

class Mapa {
  constructor(scene) {
    this.scene = scene;
    this.colisores = [];   // lista de { min: Vector3, max: Vector3 }
    this.malhas = [];      // meshes sólidos (para o raycast dos tiros)
    this.tamanho = 40;
    this.nome = 'Pátio Industrial';

    this.spawnJogador = { x: 0, z: 16 };
    this.spawnsBots = [
      [-16, -16], [-6, -17], [-2, -17], [5, -17], [12, -17], [15, -16], [-17, -9], [8, -14],
    ];

    this._criarLuzes();
    this._criarChao();
    this._criarParedes();
    this._criarPredioCentral();
    this._criarCoberturas();
    this._criarDetalhes();
    this.scene.updateMatrixWorld(true);   // fixa as posições já agora (tiros e IA não dependem do 1º quadro)
  }

  // Luz de fim de tarde: ambiente fria + sol quente com sombra leve (1 sombra só)
  _criarLuzes() {
    this.scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x5a5348, 0.8));
    const sol = new THREE.DirectionalLight(0xffe2b8, 0.75);
    sol.position.set(14, 26, 10);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);   // resolução baixa = mais leve
    const c = sol.shadow.camera;
    c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 1; c.far = 70;
    this.scene.add(sol);
  }

  _criarChao() {
    const chao = new THREE.Mesh(
      new THREE.PlaneGeometry(this.tamanho, this.tamanho),
      new THREE.MeshLambertMaterial({ color: 0x55585c })      // asfalto
    );
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    this.scene.add(chao);
    this.malhas.push(chao);

    // Faixas amarelas e áreas de concreto (só visuais, deitadas sobre o chão)
    const amarelo = new THREE.MeshBasicMaterial({ color: 0xd9b43a });
    for (let x = -18; x <= 18; x += 4) this._marca(x, 9, 1.8, 0.18, amarelo);
    for (let x = -18; x <= 18; x += 4) this._marca(x, -9, 1.8, 0.18, amarelo);
    const concreto = new THREE.MeshLambertMaterial({ color: 0x74777a });
    this._marca(0, 0, 14, 12, concreto, 0.015).receiveShadow = true;           // piso do prédio
    this._marca(-16.5, 14, 6, 6, concreto, 0.015).receiveShadow = true;        // pátio de spawn
    this._marca(16.5, -14, 6, 6, concreto, 0.015).receiveShadow = true;
  }

  _marca(x, z, w, d, mat, y = 0.02) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    this.scene.add(m);
    return m;
  }

  // Bloco sólido: centro (x, z), largura (w), profundidade (d), altura (h), cor e y da base.
  // Registra malha e colisor.
  adicionarBloco(x, z, w, d, h, cor, baseY = 0) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: cor })
    );
    mesh.position.set(x, baseY + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.malhas.push(mesh);
    this.colisores.push({
      min: new THREE.Vector3(x - w / 2, baseY, z - d / 2),
      max: new THREE.Vector3(x + w / 2, baseY + h, z + d / 2),
    });
    return mesh;
  }

  // Enfeite visual sem colisão e sem bloquear tiros
  _decor(x, y, z, w, h, d, cor) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: cor }));
    m.position.set(x, y, z);
    this.scene.add(m);
    return m;
  }

  _criarParedes() {
    const t = this.tamanho, e = 1, h = 4.5, cor = 0x8c8f91;
    const m = t / 2 + e / 2;
    this.adicionarBloco(0, -m, t + 2 * e, e, h, cor);
    this.adicionarBloco(0, m, t + 2 * e, e, h, cor);
    this.adicionarBloco(-m, 0, e, t, h, cor);
    this.adicionarBloco(m, 0, e, t, h, cor);
    // Faixa de aviso no topo das paredes (visual)
    this._decor(0, h - 0.3, -(t / 2) + 0.02, t, 0.35, 0.05, 0xb8892a);
    this._decor(0, h - 0.3, (t / 2) - 0.02, t, 0.35, 0.05, 0xb8892a);
    this._decor(-(t / 2) + 0.02, h - 0.3, 0, 0.05, 0.35, t, 0xb8892a);
    this._decor((t / 2) - 0.02, h - 0.3, 0, 0.05, 0.35, t, 0xb8892a);
  }

  // Prédio de 10 x 8 com portas largas (3 m) ao norte e ao sul. Lados leste/oeste fechados.
  _criarPredioCentral() {
    const h = 3.4, cor = 0x9b9a92, esp = 0.5;
    // Parede norte e sul, cada uma em dois segmentos (porta no meio)
    for (const z of [-4, 4]) {
      this.adicionarBloco(-3.25, z, 3.5, esp, h, cor);
      this.adicionarBloco(3.25, z, 3.5, esp, h, cor);
    }
    this.adicionarBloco(-5, 0, esp, 8.5, h, cor);
    this.adicionarBloco(5, 0, esp, 8.5, h, cor);
    // Caixas dentro do prédio
    this.adicionarBloco(-3, 2, 1.4, 1.4, 1.1, 0xb5854a);
    this.adicionarBloco(3, -2, 1.4, 1.4, 1.1, 0xb5854a);
    // Janelas escuras (visual) nas paredes leste e oeste
    for (const lado of [-1, 1]) {
      for (const z of [-2, 2]) this._decor(lado * 5.27, 2, z, 0.06, 0.9, 1.3, 0x1c2630);
    }
    // Letreiro sobre a porta norte
    this._decor(0, 3.1, -4.28, 3, 0.3, 0.05, 0xc0392b);
  }

  _criarCoberturas() {
    const ferrugem = 0x9c4a32, verde = 0x3f6b4f, azul = 0x3d5f7a;
    const saco = 0xb5a272, barreira = 0x9a9d9f, madeira = 0xb5854a;

    // --- Corredor oeste: dois contêineres com um vão no meio ---
    this._conteiner(-13, -7, 2.4, 10, ferrugem);
    this._conteiner(-13, 9, 2.4, 6, verde);
    // --- Corredor leste: parede alta com vão, barreiras baixas em zigue-zague ---
    this.adicionarBloco(15, -4, 0.8, 5, 2.6, barreira);
    this.adicionarBloco(15, 8, 0.8, 5, 2.6, barreira);
    this.adicionarBloco(10.5, -9, 4, 0.8, 1.1, barreira);
    this.adicionarBloco(10.5, 11, 4, 0.8, 1.1, barreira);
    // --- Linhas de sacos de areia (cobertura baixa: dá para atirar por cima) ---
    this.adicionarBloco(-4, -12, 4, 0.8, 1.1, saco);
    this.adicionarBloco(4, -12, 4, 0.8, 1.1, saco);
    this.adicionarBloco(-4, 12, 4, 0.8, 1.1, saco);
    this.adicionarBloco(4, 12, 4, 0.8, 1.1, saco);
    this.adicionarBloco(-8, 0, 0.8, 3.5, 1.1, saco);
    // --- Caixas e pilhas (algumas dá para pular em cima) ---
    this.adicionarBloco(8.5, 0, 1.6, 1.6, 1.6, madeira);
    this.adicionarBloco(8.5, 0, 1.0, 1.0, 0.9, azul, 1.6);       // caixa empilhada
    this.adicionarBloco(-17, -4, 2, 2, 1.0, madeira);             // degrau
    this.adicionarBloco(-17, 4, 2, 2, 2.2, azul);
    this.adicionarBloco(18, -12, 2, 2, 2.2, madeira);
    this.adicionarBloco(-9, -16, 2, 2, 1.0, madeira);
    this.adicionarBloco(-17, 12, 2.4, 1.2, 1.0, barreira);
    this.adicionarBloco(13, 16, 2, 2, 1.0, madeira);
    this.adicionarBloco(6, 6, 1.2, 1.2, 1.2, verde);
  }

  // Contêiner: bloco alto com "nervuras" decorativas nas laterais
  _conteiner(x, z, w, d, cor) {
    this.adicionarBloco(x, z, w, d, 2.6, cor);
    const costela = new THREE.Color(cor).multiplyScalar(0.7).getHex();
    for (let i = -d / 2 + 0.6; i < d / 2; i += 1.2) {
      this._decor(x - w / 2 - 0.03, 1.3, z + i, 0.06, 2.4, 0.18, costela);
      this._decor(x + w / 2 + 0.03, 1.3, z + i, 0.06, 2.4, 0.18, costela);
    }
  }

  _criarDetalhes() {
    // Barris (colisor quadrado pequeno, aparência cilíndrica)
    const barril = (x, z, cor) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 10), new THREE.MeshLambertMaterial({ color: cor }));
      m.position.set(x, 0.5, z);
      m.castShadow = true;
      this.scene.add(m);
      this.malhas.push(m);
      this.colisores.push({
        min: new THREE.Vector3(x - 0.4, 0, z - 0.4), max: new THREE.Vector3(x + 0.4, 1, z + 0.4),
      });
    };
    barril(-10.2, -1.5, 0xb03a2e);
    barril(-10.2, -0.5, 0xb03a2e);
    barril(11.5, 3, 0x2e6da4);
    barril(2.5, -9.2, 0x5d6d3a);
    barril(-6.5, 8.5, 0x2e6da4);
  }
}
