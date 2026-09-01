(function () {
  const cameraConfig = (window.SD_CONFIG && window.SD_CONFIG.camera) || {};

  function applyCameraSettings(camera) {
    const polarMin = cameraConfig.polarMin ?? 10;
    const polarMax = cameraConfig.polarMax ?? 89;
    const zoomMin = cameraConfig.zoomMin ?? 100;
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

    const canvas = viewport.domElement || document.getElementById("canvas");
    if (canvas) {
      setupObjectPan(viewport, canvas, camera);
    }

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

  function getScene(viewport) {
    const core = viewport.threeJsCoreObjects;
    if (core && core.scene) return core.scene;
    return null;
  }

  function setupObjectPan(viewport, canvas, cameraApi) {
    const scene = getScene(viewport);
    if (!scene) {
      console.warn("camera.js: scene Three.js nao encontrada");
      return;
    }

    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener("pointerdown", function (e) {
      if (e.button !== 2) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    }, { capture: true });

    canvas.addEventListener("pointermove", function (e) {
      if (!isPanning) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (dx === 0 && dy === 0) return;

      const pos = cameraApi.position;
      const tgt = cameraApi.target;
      if (!pos || !tgt) return;

      const fX = tgt[0] - pos[0];
      const fY = tgt[1] - pos[1];
      const fZ = tgt[2] - pos[2];
      const fLen = Math.sqrt(fX * fX + fY * fY + fZ * fZ);
      if (fLen === 0) return;
      const nfX = fX / fLen, nfY = fY / fLen, nfZ = fZ / fLen;

      const rX = -nfY, rY = nfX, rZ = 0;
      const rLen = Math.sqrt(rX * rX + rY * rY);
      const nrX = rLen > 0 ? rX / rLen : 0;
      const nrY = rLen > 0 ? rY / rLen : 0;

      const uX = nfY * 0 - nfZ * nrY;
      const uY = nfZ * nrX - nfX * 0;
      const uZ = nfX * nrY - nfY * nrX;
      const uLen = Math.sqrt(uX * uX + uY * uY + uZ * uZ);
      const nuX = uLen > 0 ? uX / uLen : 0;
      const nuY = uLen > 0 ? uY / uLen : 0;
      const nuZ = uLen > 0 ? uZ / uLen : 0;

      const sensitivity = 0.5;
      const offX = (-dx * nrX + dy * nuX) * sensitivity;
      const offY = (-dx * nrY + dy * nuY) * sensitivity;
      const offZ = (-dx * 0 + dy * nuZ) * sensitivity;

      scene.children.forEach(function (child) {
        child.position.x += offX;
        child.position.y += offY;
        child.position.z += offZ;
      });
    }, { capture: true });

    canvas.addEventListener("pointerup", function (e) {
      if (e.button !== 2) return;
      e.stopImmediatePropagation();
      isPanning = false;
      canvas.releasePointerCapture(e.pointerId);
    }, { capture: true });

    canvas.addEventListener("pointerleave", function (e) {
      isPanning = false;
    }, { capture: true });

    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    }, { capture: true });

    console.log("camera.js: object pan configurado via scene.children");
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