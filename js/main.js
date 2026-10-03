// ===== Ponto de entrada =====
// Cria a cena, liga os módulos e roda o laço principal do jogo.

(function () {
  const canvas = document.getElementById('jogo');
  const menu = document.getElementById('menu');

  // Renderizador leve: sem antialias, pixel ratio limitado, sombras suaves simples
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb8d0);
  scene.fog = new THREE.Fog(0x9fb8d0, 25, 70);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 100);
  scene.add(camera);   // necessário para a arma (filha da câmera) aparecer

  // Módulos
  const hud = new HUD();
  const mapa = new Mapa(scene);
  const alvos = new Alvos(scene);
  const jogador = new Jogador(camera, mapa, canvas);
  const arma = new Pistola(camera, mapa, alvos, hud);
  jogador.arma = arma;
  arma.jogador = jogador;

  // Alvos de teste espalhados pelo mapa
  [[-14, -16], [-3, -14], [10, -16], [16, -8], [-16, 2], [4, 6],
   [-8, 14], [16, 14], [0, -4], [-17, 15]].forEach(([x, z]) => alvos.criar(x, z));
  hud.atualizarAlvos(alvos.lista.length);
  hud.atualizarVida(jogador.vida);

  function redimensionar() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', redimensionar);
  redimensionar();

  // Pointer Lock: o menu aparece quando o mouse é liberado (Esc)
  document.getElementById('btn-jogar').addEventListener('click', () => canvas.requestPointerLock());
  canvas.addEventListener('click', () => { if (!jogador.ativo) canvas.requestPointerLock(); });
  document.addEventListener('pointerlockchange', () => {
    jogador.ativo = document.pointerLockElement === canvas;
    menu.classList.toggle('oculto', jogador.ativo);
    hud.mostrar(jogador.ativo);
    if (!jogador.ativo) jogador.atirando = false;
  });

  // Laço principal
  let ultimo = performance.now();
  function laco(agora) {
    requestAnimationFrame(laco);
    const dt = Math.min(0.05, (agora - ultimo) / 1000);   // limita saltos grandes de tempo
    ultimo = agora;
    if (jogador.ativo) {          // pausado quando o mouse está liberado
      jogador.atualizar(dt);
      arma.atualizar(dt);
      alvos.atualizar(dt);
      hud.atualizarAlvos(alvos.lista.length);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(laco);
})();
