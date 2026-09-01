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

    if (camera.input !== undefined) {
      camera.input = {
        mouse: { rotate: 0, zoom: 1, pan: 2 },
        touch: { rotate: 1, zoom: 2, pan: 2 }
      };
    }

    console.log("camera.js: restricoes aplicadas", {
      rotationRestriction: camera.rotationRestriction,
      zoomRestriction: camera.zoomRestriction,
      enablePan: typeof camera.enablePan !== "undefined" ? camera.enablePan : "N/A",
      enableTurntableControls: typeof camera.enableTurntableControls !== "undefined" ? camera.enableTurntableControls : "N/A"
    });
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