// ===== Alvos estáticos =====
// Bonecos simples (corpo + cabeça) que recebem dano e somem ao morrer.

class Alvos {
  constructor(scene) {
    this.scene = scene;
    this.lista = [];        // alvos vivos
    this.malhas = [];       // meshes dos alvos vivos (para o raycast)
  }

  // Cria um alvo com a base em (x, z)
  criar(x, z, vida = 100) {
    const grupo = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.35), mat);
    corpo.position.y = 0.6;
    const cabeca = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), mat);
    cabeca.position.y = 1.4;
    for (const m of [corpo, cabeca]) { m.castShadow = true; grupo.add(m); }
    grupo.position.set(x, 0, z);
    this.scene.add(grupo);

    const alvo = { grupo, mat, vida, vidaMax: vida, flash: 0, malhas: [corpo, cabeca] };
    for (const m of alvo.malhas) m.userData.alvo = alvo;
    this.lista.push(alvo);
    this.malhas.push(...alvo.malhas);
    return alvo;
  }

  // Aplica dano; retorna true se o alvo morreu
  causarDano(alvo, dano) {
    alvo.vida -= dano;
    alvo.flash = 0.1;
    alvo.mat.color.set(0xffffff);
    if (alvo.vida > 0) return false;
    this.scene.remove(alvo.grupo);
    this.lista.splice(this.lista.indexOf(alvo), 1);
    this.malhas = this.malhas.filter(m => !alvo.malhas.includes(m));
    return true;
  }

  // Volta a cor normal depois do flash de acerto
  atualizar(dt) {
    for (const a of this.lista) {
      if (a.flash > 0) {
        a.flash -= dt;
        if (a.flash <= 0) a.mat.color.set(0xc0392b);
      }
    }
  }
}
