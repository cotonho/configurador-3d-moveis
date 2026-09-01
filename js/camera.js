(function () {
  const cameraConfig = (window.SD_CONFIG && window.SD_CONFIG.camera) || {};

  function initCamera(viewport) {
    if (!viewport || !viewport.camera) {
      console.warn("camera.js: viewport.camera indisponivel");
      return;
    }
    const camera = viewport.camera;
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

    if (typeof camera.enablePan !== "undefined") {
      camera.enablePan = false;
    }
    if (typeof camera.enableTurntableControls !== "undefined") {
      camera.enableTurntableControls = false;
    }
    if (typeof camera.enableRotation !== "undefined") {
      camera.enableRotation = true;
    }

    const canvas = viewport.domElement || document.getElementById("canvas");
    if (canvas) {
      setupRightClickPan(viewport, canvas);
    }

    console.log("camera.js: restricoes aplicadas com sucesso");
  }

  function setupRightClickPan(viewport, canvas) {
    const camera = viewport.camera;
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    function onPointerDown(e) {
      if (e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!isPanning) return;
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

      const forwardX = dirX / len;
      const forwardY = dirY / len;
      const forwardZ = dirZ / len;

      const upX = 0, upY = 0, upZ = 1;

      const rightX = upY * forwardZ - upZ * forwardY;
      const rightY = upZ * forwardX - upX * forwardZ;
      const rightZ = upX * forwardY - upY * forwardX;
      const rightLen = Math.sqrt(rightX * rightX + rightY * rightY + rightZ * rightZ);
      const rX = rightLen > 0 ? rightX / rightLen : 0;
      const rY = rightLen > 0 ? rightY / rightLen : 0;
      const rZ = rightLen > 0 ? rightZ / rightLen : 0;

      const camUpX = forwardY * rZ - forwardZ * rY;
      const camUpY = forwardZ * rX - forwardX * rZ;
      const camUpZ = forwardX * rY - forwardY * rX;

      const sensitivity = 0.5;
      const offsetX = (-dx * rX + dy * camUpX) * sensitivity;
      const offsetY = (-dx * rY + dy * camUpY) * sensitivity;
      const offsetZ = (-dx * rZ + dy * camUpZ) * sensitivity;

      camera.position = [pos[0] + offsetX, pos[1] + offsetY, pos[2] + offsetZ];
      camera.target = [tgt[0] + offsetX, tgt[1] + offsetY, tgt[2] + offsetZ];
    }

    function onPointerUp(e) {
      if (e.button !== 2) return;
      isPanning = false;
      canvas.releasePointerCapture(e.pointerId);
    }

    canvas.addEventListener("pointerdown", onPointerDown, { capture: true });
    canvas.addEventListener("pointermove", onPointerMove, { capture: true });
    canvas.addEventListener("pointerup", onPointerUp, { capture: true });
    canvas.addEventListener("pointerleave", onPointerUp, { capture: true });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); }, { capture: true });

    console.log("camera.js: right-click pan configurado via position/target");
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