(function () {
  const cameraConfig = (window.SD_CONFIG && window.SD_CONFIG.camera) || {};

  function initCamera(viewport) {
    if (!viewport || !viewport.camera) {
      console.warn("camera.js: viewport.camera não disponível");
      return;
    }
    const camera = viewport.camera;
    const restrictions = cameraConfig.restrictions || {};
    const enabled = restrictions.enabled !== false;

    if (enabled) {
      if (restrictions.zoomMin !== undefined || restrictions.zoomMax !== undefined) {
        camera.zoomRestriction = {
          minDistance: restrictions.zoomMin ?? 0,
          maxDistance: restrictions.zoomMax ?? Infinity
        };
      }

      if (restrictions.sphereRadius !== undefined && restrictions.sphereRadius > 0) {
        camera.spherePositionRestriction = {
          center: [0, 0, 0],
          radius: restrictions.sphereRadius
        };
      }

      if (restrictions.yawMin !== undefined || restrictions.yawMax !== undefined ||
          restrictions.pitchMin !== undefined || restrictions.pitchMax !== undefined) {
        camera.rotationRestriction = {
          horizontal: {
            min: restrictions.yawMin ?? -Infinity,
            max: restrictions.yawMax ?? Infinity
          },
          vertical: {
            min: (restrictions.pitchMin ?? -80) * Math.PI / 180,
            max: (restrictions.pitchMax ?? 80) * Math.PI / 180
          }
        };
      }

      if (restrictions.targetRestriction) {
        camera.targetRestriction = restrictions.targetRestriction;
      }
    }

    const rightButton = cameraConfig.rightButton || "turntable";
    if (rightButton === "pan") {
      setupRightClickPan(viewport);
    }
  }

  function setupRightClickPan(viewport) {
    const canvas = viewport.domElement || viewport.canvas;
    if (!canvas) {
      console.warn("camera.js: canvas não encontrado para right-click pan");
      return;
    }

    let isPanning = false;
    let lastClientX = 0;
    let lastClientY = 0;

    const camera = viewport.camera;

    function onPointerDown(event) {
      if (event.button !== 2) return;
      event.preventDefault();
      isPanning = true;
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event) {
      if (!isPanning) return;
      const dx = event.clientX - lastClientX;
      const dy = event.clientY - lastClientY;
      lastClientX = event.clientX;
      lastClientY = event.clientY;

      if (camera.pan) {
        camera.pan(-dx * 0.005, dy * 0.005);
      }
    }

    function onPointerUp(event) {
      if (event.button !== 2) return;
      isPanning = false;
      canvas.releasePointerCapture(event.pointerId);
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  window.addEventListener("sdv-ready", () => {
    const viewport = window.shapediverAPI?.getViewport?.();
    if (viewport) {
      initCamera(viewport);
    }
  });
})();