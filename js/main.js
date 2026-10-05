// ===== Ponto de entrada =====
// Cria a cena, liga os módulos e roda o laço principal do jogo.
// Há dois modos de jogo, escolhidos no menu:
//   rodadas -> Partida (rodadas.js) com preparação, loja e economia
//   mata    -> MataMata (mata.js) com bots que reaparecem e todas as armas liberadas

(function () {
  const canvas = document.getElementById('jogo');
  const menu = document.getElementById('menu');
  const menuTitulo = document.getElementById('menu-titulo');
  const menuSub = document.getElementById('menu-sub');
  const btnJogar = document.getElementById('btn-jogar');
  const btnSair = document.getElementById('btn-sair');
  const opcoes = document.getElementById('menu-opcoes');
  const descModo = document.getElementById('desc-modo');

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
  scene.add(camera);   // necessário para as armas (filhas da câmera) aparecerem

  // Módulos
  const hud = new HUD();
  const mapa = new Mapa(scene);
  const jogador = new Jogador(camera, mapa, canvas);
  const bots = new Bots(scene, mapa, jogador, hud);
  const armas = new Armas(camera, mapa, bots, hud);
  const partida = new Partida(jogador, bots, armas, hud);
  const mata = new MataMata(jogador, bots, armas, hud, mapa);
  const loja = new Loja(partida, armas, jogador, hud);
  jogador.arma = armas;
  jogador.hud = hud;
  armas.jogador = jogador;
  partida.loja = loja;
  hud.atualizarVida(jogador.vida);
  hud.atualizarColete(jogador.armadura);
  hud.atualizarKD(0, 0);

  // ----- Escolhas do menu (lembradas entre visitas, se o navegador permitir) -----
  const MODOS = {
    rodadas: { jogo: partida, desc: 'Preparação, combate e resultado. Ganhe dinheiro e compre armas e colete na loja. Vença 5 rodadas.' },
    mata: { jogo: mata, desc: '4 bots atiram em você. Quem morre reaparece. Todas as armas liberadas, sem loja nem dinheiro.' },
  };
  let modo = 'rodadas';
  try {
    modo = localStorage.getItem('zc_modo') || modo;
    definirDificuldade(localStorage.getItem('zc_dif') || DIFICULDADE);
  } catch (e) { /* sem armazenamento: usa os padrões */ }
  if (!MODOS[modo]) modo = 'rodadas';
  let atual = MODOS[modo].jogo;          // modo em andamento (ou escolhido)

  function marcarOpcoes() {
    for (const b of opcoes.querySelectorAll('[data-modo]')) b.classList.toggle('sel', b.dataset.modo === modo);
    for (const b of opcoes.querySelectorAll('[data-dif]')) b.classList.toggle('sel', b.dataset.dif === DIFICULDADE);
    descModo.textContent = MODOS[modo].desc;
  }
  opcoes.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.modo) modo = b.dataset.modo;
    if (b.dataset.dif) definirDificuldade(b.dataset.dif);
    atual = MODOS[modo].jogo;
    try { localStorage.setItem('zc_modo', modo); localStorage.setItem('zc_dif', DIFICULDADE); } catch (err) { /* ok */ }
    marcarOpcoes();
  });
  marcarOpcoes();

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
      armas.nivelMira = 0; armas._aplicarZoom(true);     // sai da luneta ao pausar
      const emAndamento = atual.estado !== 'parado' && atual.estado !== 'fim';
      if (atual.estado === 'fim') {
        const venceu = atual.placar.jogador > atual.placar.bots;
        menuTitulo.textContent = venceu ? 'PARTIDA VENCIDA' : 'PARTIDA PERDIDA';
        menuSub.textContent = 'Placar final ' + atual.placar.jogador + ' x ' + atual.placar.bots;
        btnJogar.textContent = 'Jogar novamente';
      } else if (!emAndamento) {
        menuTitulo.textContent = 'ZONA CINZA';
        menuSub.textContent = 'Pátio Industrial — você contra os bots';
        btnJogar.textContent = 'Clique para jogar';
      } else {
        menuTitulo.textContent = 'PAUSADO';
        menuSub.textContent = atual.resumo();
        btnJogar.textContent = 'Continuar';
      }
      // Modo e dificuldade só mudam entre partidas
      opcoes.classList.toggle('oculto', emAndamento);
      btnSair.classList.toggle('oculto', !emAndamento);
    }
    menu.classList.toggle('oculto', ativo);
    hud.mostrar(ativo);
  }

  // Fim da partida (modo rodadas): solta o mouse e mostra o menu com o resultado
  partida.aoFim = () => {
    document.exitPointerLock();
    definirAtivo(false);   // garante a tela mesmo se o Pointer Lock não estiver ativo
  };

  // Começa (ou continua) a partida e prende o mouse
  function iniciar() {
    if (atual.estado === 'parado' || atual.estado === 'fim') {
      hud.definirModo(modo);
      atual.novaPartida();
    }
    canvas.requestPointerLock();
  }
  btnJogar.addEventListener('click', iniciar);
  btnSair.addEventListener('click', () => {
    atual.encerrar();
    hud.mostrar(false);
    definirAtivo(false);
  });
  canvas.addEventListener('click', () => { if (!jogador.ativo) iniciar(); });
  document.addEventListener('pointerlockchange', () => {
    definirAtivo(document.pointerLockElement === canvas);
  });
  definirAtivo(false);

  // útil para depurar no console
  window.jogo = { jogador, armas, bots, mapa, camera, partida, mata, loja, definirAtivo, hud,
    get atual() { return atual; }, escolher(m) { modo = m; atual = MODOS[m].jogo; marcarOpcoes(); } };

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
      atual.atualizar(dt);
      if (loja.aberta) loja.atualizar();
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(laco);
})();
