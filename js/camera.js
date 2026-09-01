(function () {
  const cameraConfig = (window.SD_CONFIG && window.SD_CONFIG.camera) || {};

  function initCamera(viewport) {
    if (!viewport || !viewport.camera) {
      console.warn("camera.js: viewport.camera indisponivel");
      return;
    }
    const camera = viewport.camera;
    const polarMin = (cameraConfig.polarMin ?? 45) * Math.PI / 180;
    const polarMax = (cameraConfig.polarMax ?? 60) * Math.PI / 180;
    const zoomMin = cameraConfig.zoomMin ?? 300;
    const zoomMax = cameraConfig.zoomMax ?? 900;

    console.log("camera.js: aplicando rotationRestriction", { minPolarAngle: polarMin, maxPolarAngle: polarMax });
    camera.rotationRestriction = {
      minPolarAngle: polarMin,
      maxPolarAngle: polarMax
    };

    console.log("camera.js: aplicando zoomRestriction", { minDistance: zoomMin, maxDistance: zoomMax });
    camera.zoomRestriction = {
      minDistance: zoomMin,
      maxDistance: zoomMax
    };

    if (typeof camera.enablePan !== "undefined") {
      camera.enablePan = cameraConfig.enablePan !== false;
    }
    if (typeof camera.enableRotation !== "undefined") {
      camera.enableRotation = cameraConfig.enableRotation !== false;
    }

    console.log("camera.js: restricoes aplicadas com sucesso");
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