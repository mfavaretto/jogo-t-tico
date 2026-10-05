// ===== Ponto de entrada =====
// Cria a cena, liga os módulos e roda o laço principal do jogo.

(function () {
  const canvas = document.getElementById('jogo');
  const menu = document.getElementById('menu');
  const menuTitulo = document.getElementById('menu-titulo');
  const menuSub = document.getElementById('menu-sub');
  const btnJogar = document.getElementById('btn-jogar');

  // Renderizador leve: sem antialias, pixel ratio limitado, sombras suaves simples
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Céu de fim de tarde com névoa na mesma cor (esconde o limite do mapa e poupa processamento)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc2b8a8);
  scene.fog = new THREE.Fog(0xc2b8a8, 28, 75);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 100);
  scene.add(camera);   // necessário para a arma (filha da câmera) aparecer

  // Módulos
  const hud = new HUD();
  const mapa = new Mapa(scene);
  const jogador = new Jogador(camera, mapa, canvas);
  const bots = new Bots(scene, mapa, jogador);
  const armas = new Armas(camera, mapa, bots, hud);
  const partida = new Partida(jogador, bots, armas, hud);
  const loja = new Loja(partida, armas, jogador, hud);
  jogador.arma = armas;
  jogador.hud = hud;
  armas.jogador = jogador;
  partida.loja = loja;
  hud.atualizarVida(jogador.vida);
  hud.atualizarColete(jogador.armadura);

  function redimensionar() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', redimensionar);
  redimensionar();

  // Liga/desliga o jogo e atualiza o menu (início, pausa ou fim de partida)
  function definirAtivo(ativo) {
    jogador.ativo = ativo;
    if (!ativo) {
      jogador.atirando = false;
      loja.fechar();
      if (partida.estado === 'fim') {
        const venceu = partida.placar.jogador > partida.placar.bots;
        menuTitulo.textContent = venceu ? 'PARTIDA VENCIDA' : 'PARTIDA PERDIDA';
        menuSub.textContent = 'Placar final ' + partida.placar.jogador + ' x ' + partida.placar.bots;
        btnJogar.textContent = 'Jogar novamente';
      } else if (partida.estado === 'parado') {
        menuTitulo.textContent = 'ZONA CINZA';
        menuSub.textContent = 'Pátio Industrial — você contra os bots';
        btnJogar.textContent = 'Clique para jogar';
      } else {
        menuTitulo.textContent = 'PAUSADO';
        menuSub.textContent = 'Rodada ' + partida.rodada + ' · placar ' + partida.placar.jogador + ' x ' + partida.placar.bots;
        btnJogar.textContent = 'Continuar';
      }
    }
    menu.classList.toggle('oculto', ativo);
    hud.mostrar(ativo);
  }

  // Fim da partida: solta o mouse e mostra o menu com o resultado
  partida.aoFim = () => {
    document.exitPointerLock();
    definirAtivo(false);   // garante a tela mesmo se o Pointer Lock não estiver ativo
  };

  // Pointer Lock: o menu aparece quando o mouse é liberado (Esc)
  function iniciar() {
    if (partida.estado === 'parado' || partida.estado === 'fim') partida.novaPartida();
    canvas.requestPointerLock();
  }
  btnJogar.addEventListener('click', iniciar);
  canvas.addEventListener('click', () => { if (!jogador.ativo) iniciar(); });
  document.addEventListener('pointerlockchange', () => {
    definirAtivo(document.pointerLockElement === canvas);
  });
  definirAtivo(false);

  window.jogo = { jogador, armas, bots, mapa, camera, partida, loja, definirAtivo };   // útil para depurar no console

  // Laço principal
  let ultimo = performance.now();
  function laco(agora) {
    requestAnimationFrame(laco);
    const dt = Math.min(0.05, (agora - ultimo) / 1000);   // limita saltos grandes de tempo
    ultimo = agora;
    if (jogador.ativo) {          // pausado quando o mouse está liberado
      jogador.atualizar(dt);
      armas.atualizar(dt);
      bots.atualizar(dt);
      partida.atualizar(dt);
      if (loja.aberta) loja.atualizar();
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(laco);
})();
