(function () {
  const cameraConfig = (window.SD_CONFIG && window.SD_CONFIG.camera) || {};

  function findControls(viewport) {
    const camera = viewport.camera;
    const candidates = [
      camera._camera,
      camera._controls,
      camera.controls,
      viewport._controls,
      viewport.controls
    ];
    for (const c of candidates) {
      if (c && c._input) return c;
      if (c && c.controls && c.controls._input) return c.controls;
    }
    return null;
  }

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

    const controls = findControls(viewport);
    if (controls) {
      console.log("camera.js: controls interno encontrado", controls);
      console.log("camera.js: input atual", JSON.stringify(controls._input));
      controls._input.mouse = { rotate: 0, zoom: 1, pan: 2 };
      console.log("camera.js: input atualizado", JSON.stringify(controls._input));
    } else {
      console.warn("camera.js: controls interno NAO encontrado");
      console.log("camera.js: tentativas de acesso:");
      console.log("  camera._camera:", camera._camera);
      console.log("  camera._controls:", camera._controls);
      console.log("  camera.controls:", camera.controls);
      console.log("  viewport._controls:", viewport._controls);
      console.log("  viewport.controls:", viewport.controls);
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