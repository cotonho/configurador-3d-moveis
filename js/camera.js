(function () {
  const cameraConfig = (window.SD_CONFIG && window.SD_CONFIG.camera) || {};

  function applyCameraSettings(camera) {
    const polarMin = cameraConfig.polarMin ?? 45;
    const polarMax = cameraConfig.polarMax ?? 60;
    const zoomMin = cameraConfig.zoomMin ?? 300;
    const zoomMax = cameraConfig.zoomMax ?? 900;

    camera.rotationRestriction = {
      minPolarAngle: polarMin,
      maxPolarAngle: polarMax,
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: Infinity
    };

    camera.zoomRestriction = {
      minDistance: zoomMin,
      maxDistance: zoomMax
    };

    camera.enablePan = true;
    camera.enableRotation = true;
    camera.enableTurntableControls = false;
  }

  function initCamera(viewport) {
    if (!viewport || !viewport.camera) {
      console.warn("camera.js: viewport.camera indisponivel");
      return;
    }
    const camera = viewport.camera;
    applyCameraSettings(camera);

    setupRightClickPan(viewport, camera);

    const session = window.shapediverAPI && window.shapediverAPI.getSession && window.shapediverAPI.getSession();
    if (session && session.updateCallback) {
      const origCallback = session.updateCallback;
      session.updateCallback = function () {
        if (origCallback) origCallback();
        applyCameraSettings(camera);
      };
    }

    let attempts = 0;
    const interval = setInterval(function () {
      applyCameraSettings(camera);
      attempts++;
      if (attempts >= 10) clearInterval(interval);
    }, 500);

    console.log("camera.js: tudo configurado");
  }

  function setupRightClickPan(viewport, camera) {
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    document.addEventListener("pointerdown", function (e) {
      if (e.button !== 2) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }, { capture: true });

    document.addEventListener("pointermove", function (e) {
      if (!isPanning) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (dx === 0 && dy === 0) return;

      const pos = camera.position;
      const tgt = camera.target;
      if (!pos || !tgt) return;

      const dirX = tgt[0] - pos[0];
      const dirY = tgt[1] - pos[1];
      const dirZ = tgt[2] - pos[2];
      const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
      if (len === 0) return;

      const fX = dirX / len, fY = dirY / len, fZ = dirZ / len;
      const rX = -fY, rY = fX, rZ = 0;
      const rLen = Math.sqrt(rX * rX + rY * rY + rZ * rZ);
      const rightX = rLen > 0 ? rX / rLen : 0;
      const rightY = rLen > 0 ? rY / rLen : 0;
      const rightZ = 0;
      const upX = fY * rightZ - fZ * rightY;
      const upY = fZ * rightX - fX * rightZ;
      const upZ = fX * rightY - fY * rightX;

      const sensitivity = 0.5;
      const offX = (-dx * rightX + dy * upX) * sensitivity;
      const offY = (-dx * rightY + dy * upY) * sensitivity;
      const offZ = (-dx * rightZ + dy * upZ) * sensitivity;

      camera.position = [pos[0] + offX, pos[1] + offY, pos[2] + offZ];
      camera.target = [tgt[0] + offX, tgt[1] + offY, tgt[2] + offZ];
    }, { capture: true });

    document.addEventListener("pointerup", function (e) {
      if (e.button !== 2) return;
      e.stopImmediatePropagation();
      isPanning = false;
    }, { capture: true });

    document.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    }, { capture: true });

    console.log("camera.js: right-click pan via document com stopImmediatePropagation");
  }

  window.addEventListener("sdv-ready", function (e) {
    const vp = (e.detail && e.detail.viewport) || (window.shapediverAPI && window.shapediverAPI.getViewport());
    if (vp) {
      initCamera(vp);
    } else {
      console.warn("camera.js: viewport nao encontrado");
    }
  });
})();