(function () {
  const cameraConfig = (window.SD_CONFIG && window.SD_CONFIG.camera) || {};

  function initCamera(viewport) {
    if (!viewport || !viewport.camera) return;
    const cameraApi = viewport.camera;
    const threeCamera = viewport.threeJsCoreObjects.camera;

    applyCameraSettings(cameraApi);

    cameraApi.enablePan = false;
    cameraApi.enableZoom = false;
    cameraApi.enableRotation = true;
    cameraApi.autoAdjust = false;
    cameraApi.initialAutoAdjust = false;

    setupCustomPan(viewport, cameraApi, threeCamera);
  }

  function setupCustomPan(viewport, cameraApi, threeCamera) {
    if (!threeCamera) return;
    var cfg = (window.SD_CONFIG && window.SD_CONFIG.canvasId) || 'canvas';
    var canvas = document.getElementById(cfg) || document.getElementById('canvas');
    if (!canvas) return;

    // Usa o Vector3 do mesmo realm do threeCamera (evita mistura de instâncias de Three.js)
    var V3 = threeCamera.position.constructor;

    // Esquema câmera-órbita: esquerdo = órbita NATIVA da câmera em torno
    // da sala; direito = translada CÂMERA+foco no piso (custom).
    var panning = false;
    var lastX = 0;
    var lastY = 0;

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    canvas.addEventListener('pointerdown', function (e) {
      if (e.button !== 2) return;
      panning = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    function stopPan() { panning = false; }
    window.addEventListener('pointerup', stopPan);
    window.addEventListener('pointercancel', stopPan);
    window.addEventListener('blur', stopPan);

    window.addEventListener('pointermove', function (e) {
      if (!panning) return;
      // Se o browser informar buttons, exige botão direito ainda pressionado
      if (typeof e.buttons === 'number' && e.buttons !== 0 && !(e.buttons & 2)) {
        panning = false;
        return;
      }

      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (!dx && !dy) return;

      var roomRoot = window._roomRoot;
      if (!roomRoot) return;

      // Pan no piso, nos eixos DA CÂMERA (direita e frente projetados no
      // mundo XY, sem Z) — acompanha para onde você está olhando, inclusive
      // após orbitar. Câmera E foco transladam juntos: offset preservado,
      // então o restrict() do SDV nunca corrige. Estilo "agarrar": a sala
      // acompanha o cursor. Foco limitado à caixa da sala.
      var p = toVec3Array(cameraApi.position);
      var t = toVec3Array(cameraApi.target);
      if (!p || !t) return;

      var px = p[0], py = p[1], pz = p[2];
      var tx = t[0], ty = t[1], tz = t[2];
      var ox = px - tx, oy = py - ty, oz = pz - tz;
      var dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (!(dist > 1e-6)) return;
      // Velocidade ancorada na sala: atravessar a tela = atravessar a sala.
      var cw = (canvas && canvas.clientWidth) || 800;
      var span = 1000;
      try {
        var L = window._roomLimits;
        if (L) span = Math.max(L.x, L.y) * 2 || 1000;
      } catch (e) { /* mantém padrão */ }
      var s = span / cw;

      threeCamera.updateMatrixWorld();
      var right = new V3();
      var up = new V3();
      var fwd = new V3();
      if (threeCamera.matrixWorld && typeof threeCamera.matrixWorld.extractBasis === 'function') {
        threeCamera.matrixWorld.extractBasis(right, up, fwd);
      } else {
        return;
      }
      var rx = right.x, ry = right.y;
      var rlen = Math.sqrt(rx * rx + ry * ry);
      if (rlen < 1e-6) { rx = 1; ry = 0; rlen = 1; }
      rx /= rlen; ry /= rlen;
      var fx = tx - px, fy = ty - py;
      var flen = Math.sqrt(fx * fx + fy * fy);
      if (flen < 1e-6) { fx = 0; fy = 1; flen = 1; }
      fx /= flen; fy /= flen;
      var mx = -(rx * (dx * s) + fx * (-dy * s));
      var my = -(ry * (dx * s) + fy * (-dy * s));

      var lim = window._roomLimits || { x: 1e9, y: 1e9, z: 1e9 };
      var ntx = Math.max(-lim.x, Math.min(lim.x, tx + mx));
      var nty = Math.max(-lim.y, Math.min(lim.y, ty + my));
      var ax = ntx - tx, ay = nty - ty;
      cameraApi.position = [px + ax, py + ay, pz];
      cameraApi.target = [ntx, nty, tz];
    });

    // Scroll: dolly clássico — só a câmera anda na direção do olhar,
    // foco fixo. O restrict() do SDV impõe zoomMin/zoomMax sozinho.
    // Scroll p/ baixo afasta, p/ cima aproxima.
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= 400;

      var p = toVec3Array(cameraApi.position);
      var t = toVec3Array(cameraApi.target);
      if (!p || !t) return;
      var fx = t[0] - p[0], fy = t[1] - p[1], fz = t[2] - p[2];
      var d = Math.sqrt(fx * fx + fy * fy + fz * fz);
      if (!(d > 1e-6)) return;
      var step = delta * d * 0.001;
      var maxStep = d * 0.9;
      step = Math.max(-maxStep, Math.min(maxStep, step));
      cameraApi.position = [p[0] - fx / d * step, p[1] - fy / d * step, p[2] - fz / d * step];
    }, { passive: false });

    function toVec3Array(v) {
      if (!v) return null;
      if (typeof v.length === 'number' && v.length >= 3 && typeof v !== 'string') {
        return [v[0], v[1], v[2]];
      }
      if (typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number') {
        return [v.x, v.y, v.z];
      }
      return null;
    }
  }

  function applyCameraSettings(camera) {
    camera.rotationRestriction = {
      minPolarAngle: cameraConfig.polarMin ?? 10,
      maxPolarAngle: cameraConfig.polarMax ?? 89,
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: Infinity
    };
    camera.zoomRestriction = {
      minDistance: cameraConfig.zoomMin ?? 100,
      maxDistance: cameraConfig.zoomMax ?? 900
    };
  }

  window.addEventListener("sdv-ready", function (e) {
    var vp = (e.detail && e.detail.viewport) || (window.shapediverAPI && window.shapediverAPI.getViewport());
    if (vp) initCamera(vp);
  });
})();
