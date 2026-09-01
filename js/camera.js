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
      camera.enablePan = true;
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

      if (camera.pan) {
        camera.pan(-dx * 0.005, dy * 0.005);
      }
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

    console.log("camera.js: right-click pan configurado no canvas");
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