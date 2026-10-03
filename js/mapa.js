// ===== Mapa de teste =====
// Monta chão, paredes e caixas. Cada bloco sólido também vira um "colisor"
// (caixa alinhada aos eixos, AABB) usado pelo jogador e pelos tiros.

class Mapa {
  constructor(scene) {
    this.scene = scene;
    this.colisores = [];   // lista de { min: Vector3, max: Vector3 }
    this.malhas = [];      // meshes sólidos (para o raycast dos tiros)
    this.tamanho = 40;     // arena quadrada de 40 x 40

    this._criarLuzes();
    this._criarChao();
    this._criarParedes();
    this._criarCaixas();
  }

  // Iluminação simples: luz ambiente + uma luz direcional com sombra leve
  _criarLuzes() {
    this.scene.add(new THREE.HemisphereLight(0xdde8ff, 0x555555, 0.75));
    const sol = new THREE.DirectionalLight(0xffffff, 0.6);
    sol.position.set(12, 25, 8);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);   // resolução baixa = mais leve
    const c = sol.shadow.camera;
    c.left = -25; c.right = 25; c.top = 25; c.bottom = -25; c.near = 1; c.far = 60;
    this.scene.add(sol);
  }

  _criarChao() {
    const geo = new THREE.PlaneGeometry(this.tamanho, this.tamanho);
    const chao = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x8a8f78 }));
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    this.scene.add(chao);
    this.malhas.push(chao);
    // Grade só para dar noção de movimento/escala (sem texturas)
    const grade = new THREE.GridHelper(this.tamanho, this.tamanho / 2, 0x6a6f5a, 0x6a6f5a);
    grade.position.y = 0.01;
    this.scene.add(grade);
  }

  // Cria um bloco sólido: centro (x, z), largura (w), profundidade (d), altura (h)
  // e y da base (por padrão no chão). Registra malha e colisor.
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

  _criarParedes() {
    const t = this.tamanho, e = 1, h = 4, cor = 0x9a8f80;
    const m = t / 2 + e / 2;
    // Quatro paredes externas
    this.adicionarBloco(0, -m, t + 2 * e, e, h, cor);
    this.adicionarBloco(0, m, t + 2 * e, e, h, cor);
    this.adicionarBloco(-m, 0, e, t, h, cor);
    this.adicionarBloco(m, 0, e, t, h, cor);
    // Duas paredes internas com passagem no meio
    this.adicionarBloco(-8, -6, 12, 0.6, h, 0x877c6e);
    this.adicionarBloco(9, 4, 10, 0.6, h, 0x877c6e);
  }

  _criarCaixas() {
    const madeira = 0xb5854a, metal = 0x5d7a8c;
    this.adicionarBloco(4, -10, 2, 2, 1.2, madeira);      // baixa (dá para pular em cima)
    this.adicionarBloco(6.2, -10, 2, 2, 2.4, madeira);    // alta
    this.adicionarBloco(-12, 8, 3, 1.5, 1.2, metal);
    this.adicionarBloco(-4, 10, 2, 2, 2.2, metal);
    this.adicionarBloco(0, 0, 2.5, 2.5, 1.5, madeira);    // centro do mapa
    this.adicionarBloco(14, -4, 1.5, 4, 2.2, metal);
    this.adicionarBloco(-14, -12, 2, 2, 1.0, madeira);
    this.adicionarBloco(12, 12, 2, 2, 1.2, madeira);
    this.adicionarBloco(12, 12, 1.2, 1.2, 1.0, metal, 1.2); // caixa empilhada
  }
}
