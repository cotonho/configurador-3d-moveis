(function () {
  const cameraConfig = (window.SD_CONFIG && window.SD_CONFIG.camera) || {};

  function initCamera(viewport) {
    if (!viewport || !viewport.camera) {
      console.warn("camera.js: viewport.camera indisponivel");
      return;
    }
    const camera = viewport.camera;
    const cfg = {
      polarMin: (cameraConfig.polarMin ?? 45) * Math.PI / 180,
      polarMax: (cameraConfig.polarMax ?? 60) * Math.PI / 180,
      zoomMin: cameraConfig.zoomMin ?? 300,
      zoomMax: cameraConfig.zoomMax ?? 900,
      enablePan: cameraConfig.enablePan !== false,
      enableRotation: cameraConfig.enableRotation !== false
    };

    camera.rotationRestriction = {
      horizontal: { min: -Infinity, max: Infinity },
      vertical: { min: cfg.polarMin, max: cfg.polarMax }
    };

    camera.zoomRestriction = {
      minDistance: cfg.zoomMin,
      maxDistance: cfg.zoomMax
    };

    if (camera.enablePan !== undefined) {
      camera.enablePan = cfg.enablePan;
    }
    if (camera.enableRotation !== undefined) {
      camera.enableRotation = cfg.enableRotation;
    }

    if (camera.spherePositionRestriction !== undefined) {
      camera.spherePositionRestriction = { radius: 0 };
    }
  }

  function focusOn(target, position) {
    const viewport = window.shapediverAPI?.getViewport?.();
    const camera = viewport?.camera;
    if (!camera) {
      return;
    }
    const anim = [{ position: position, target: target }];
    if (camera.animate) {
      camera.animate(anim, { duration: 600 });
    } else {
      camera.position = position;
      camera.target = target;
    }
  }

  window.addEventListener("sdv-ready", () => {
    const viewport = window.shapediverAPI?.getViewport?.();
    if (viewport) {
      initCamera(viewport);
    }
  });

  window.configuradorCamera = { focusOn };
})();