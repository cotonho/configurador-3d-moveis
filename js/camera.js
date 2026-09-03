console.log('camera.js carregado - versão TESTE18');

try {
  var _dbgVp = window.shapediverAPI ? window.shapediverAPI.getViewport() : null;
  var _dbgTc = _dbgVp && _dbgVp.threeJsCoreObjects ? _dbgVp.threeJsCoreObjects.camera : null;
  console.log('[PAN] fov-check: threeCamera.fov=' + (_dbgTc ? _dbgTc.fov : 'n/a') +
    ' aspect=' + (_dbgTc ? _dbgTc.aspect : 'n/a') +
    ' canvasW=' + (document.getElementById('canvas') ? document.getElementById('canvas').clientWidth : 'n/a'));
} catch (err) {
  console.log('[PAN] fov-check indisponivel (viewport ainda nao criado)');
}

(function () {
  const cameraConfig = (window.SD_CONFIG && window.SD_CONFIG.camera) || {};

  function initCamera(viewport) {
    if (!viewport || !viewport.camera) return;
    const cameraApi = viewport.camera;
    window.__debugCameraApi = cameraApi;
    const threeCamera = viewport.threeJsCoreObjects.camera;

    applyCameraSettings(cameraApi);

    console.log('[CAMERA INIT] enablePan antes=' + cameraApi.enablePan);
    cameraApi.enablePan = false;
    console.log('[CAMERA INIT] enablePan depois=' + cameraApi.enablePan);
    console.log('[CAMERA INIT] enableZoom antes=' + cameraApi.enableZoom);
    cameraApi.enableZoom = false;
    console.log('[CAMERA INIT] enableZoom depois=' + cameraApi.enableZoom);
    console.log('[CAMERA INIT] enableRotation antes=' + cameraApi.enableRotation);
    cameraApi.enableRotation = true;
    console.log('[CAMERA INIT] enableRotation depois=' + cameraApi.enableRotation);
    console.log('[CAMERA INIT] autoAdjust antes=' + cameraApi.autoAdjust);
    cameraApi.autoAdjust = false;
    cameraApi.initialAutoAdjust = false;
    console.log('[CAMERA INIT] autoAdjust depois=' + cameraApi.autoAdjust);

    // Hook diagnóstico (baixo volume): bbox via event engine do SDV
    try {
      var SDV = window.SDV || {};
      var sdvType = (SDV.EVENTTYPE_SCENE && SDV.EVENTTYPE_SCENE.SCENE_BOUNDING_BOX_CHANGE) || 'scene.boundingBoxChange';
      if (typeof SDV.addListener === 'function') {
        SDV.addListener(sdvType, function (e) {
          console.log('[BOUNDING BOX CHANGE] raw=' + safeStringify(e));
        });
        console.log('[HOOK] boundingBox listener registrado, type=' + sdvType);
      }
    } catch (err) {
      console.log('[HOOK] falha bbox: ' + (err && err.message));
    }

    setupCustomPan(viewport, cameraApi, threeCamera);

    console.log('[CAMERA INIT] autoRotation=' + cameraApi.enableAutoRotation +
      ' speed=' + cameraApi.autoRotationSpeed +
      ' revert=' + cameraApi.revertAtMouseUp +
      ' damping=' + cameraApi.damping);
    try {
      var _c = document.getElementById(((window.SD_CONFIG && window.SD_CONFIG.canvasId) || 'canvas'));
      console.log('[CAMERA INIT] three fov=' + threeCamera.fov + ' aspect=' + threeCamera.aspect +
        ' canvas=' + (_c ? _c.clientWidth + 'x' + _c.clientHeight : '?') +
        ' autoUpdate=' + threeCamera.matrixAutoUpdate);
    } catch (err) {
      console.log('[CAMERA INIT] fov-check falhou: ' + (err && err.message));
    }

    // Amostrador diagnóstico: loga a cada 500ms SOMENTE se posição/foco mudaram.
    // Inclui sala (mundo), centro do móvel (mundo) e projeção NDC do móvel
    // na tela (0,0 = centro): decide se o móvel está pregado no centro.
    var lastSample = null;
    setInterval(function () {
      var tp = null;
      try {
        var tcp = threeCamera.position;
        tp = '[' + tcp.x.toFixed(1) + ',' + tcp.y.toFixed(1) + ',' + tcp.z.toFixed(1) + ']';
        var me = threeCamera.matrixWorld ? threeCamera.matrixWorld.elements : null;
        if (me) tp += ' mW=[' + me[12].toFixed(1) + ',' + me[13].toFixed(1) + ',' + me[14].toFixed(1) + ']';
      } catch (e) { tp = '?'; }
      var s = safeStringify(cameraApi.position) + '|' + safeStringify(cameraApi.target) + '|three=' + tp;
      if (s !== lastSample) {
        var extra = '';
        try {
          var rr = window._roomRoot;
          var rp = rr ? rr.position : null;
          var b = (typeof window._debugFurnitureBox === 'function') ? window._debugFurnitureBox() : null;
          var ndc = null;
          if (b) {
            var VC = threeCamera.position.constructor;
            var v = new VC(b.cx, b.cy, b.cz);
            v.project(threeCamera);
            ndc = [v.x, v.y];
          }
          extra = ' room=' + (rp ? '[' + Math.round(rp.x) + ',' + Math.round(rp.y) + ',' + Math.round(rp.z) + ']' : '?') +
            ' furn=' + (b ? '[' + Math.round(b.cx) + ',' + Math.round(b.cy) + ',' + Math.round(b.cz) + ']' : '?') +
            ' ndc=' + (ndc ? '[' + ndc[0].toFixed(2) + ',' + ndc[1].toFixed(2) + ']' : '?');
        } catch (err) {
          extra = ' furnErr=' + (err && err.message);
        }
        console.log('[CAM SAMPLER] pos|target=' + s + extra);
        lastSample = s;
      }
    }, 500);
  }

  function setupCustomPan(viewport, cameraApi, threeCamera) {
    if (!threeCamera) return;
    var cfg = (window.SD_CONFIG && window.SD_CONFIG.canvasId) || 'canvas';
    var canvas = document.getElementById(cfg) || document.getElementById('canvas');
    if (!canvas) {
      console.log('[PAN] canvas nao encontrado');
      return;
    }

    // Usa o Vector3 do mesmo realm do threeCamera (evita mistura de instâncias de Three.js)
    var V3 = threeCamera.position.constructor;

    // Esquema câmera-órbita: esquerdo = órbita NATIVA da câmera em torno
    // da sala; direito = desliza a SALA no piso (custom). Nativo só no esquerdo.
    var panning = false;
    var lastX = 0;
    var lastY = 0;
    var panTick = 0;

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    try {
      var sdvCanvas = viewport.threeJsCoreObjects.renderer.domElement;
      console.log('[PAN] canvas é o do SDV=' + (sdvCanvas === canvas) +
        ' roomRoot=' + (!!window._roomRoot));
    } catch (err) {
      console.log('[PAN] checagem canvas falhou: ' + (err && err.message));
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.button !== 2) return;
      panning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      console.log('[PAN] down ok');
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

      // Pan estilo IKEA: só no piso (mundo XY), sem Z. Câmera E foco
      // transladam juntos — offset preservado, restrict() nunca corrige.
      // dx → direita-da-câmera no piso; dy → frente-no-piso.
      var p = toVec3Array(cameraApi.position);
      var t = toVec3Array(cameraApi.target);
      if (!p || !t) return;

      var px = p[0], py = p[1], pz = p[2];
      var tx = t[0], ty = t[1], tz = t[2];
      var ox = px - tx, oy = py - ty, oz = pz - tz;
      var dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (!(dist > 1e-6)) return;
      // Velocidade ancorada na sala (independente de fov, que se mostrou
      // defasado): atravessar a tela = atravessar a sala.
      var cw = (canvas && canvas.clientWidth) || 800;
      var span = 1000;
      try {
        var L = window._roomLimits;
        if (L) span = Math.max(L.x, L.y) * 2 || 1000;
      } catch (e) { /* mantém padrão */ }
      var s = span / cw;

      // Botão direito: translada CÂMERA+foco só nos eixos X e Y do mundo
      // (sem Z). Translação pura em eixos fixos → orbitar é impossível por
      // construção. Horizontal invertido (estilo "agarrar": arrastar p/
      // direita leva a sala p/ direita); vertical segue o mouse. O foco vai
      // junto (offset preservado → restrict() nunca corrige), limitado à
      // caixa da sala.
      var mx = -dx * s;
      var my = dy * s;

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

    console.log('[PAN] esquerdo=orbita nativa, direito=move camera+foco XY, scroll=dolly');

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

  function safeStringify(v) {
    try {
      if (v === null || v === undefined) return String(v);
      if (typeof v.length === 'number' && typeof v !== 'string') {
        try { return JSON.stringify(Array.from(v)); } catch (e) { /* fallback */ }
      }
      return JSON.stringify(v);
    } catch (e) {
      return Object.prototype.toString.call(v);
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
