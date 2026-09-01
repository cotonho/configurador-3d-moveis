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

    console.log("camera.js: restricoes reaplicadas", {
      rotation: camera.rotationRestriction,
      zoom: camera.zoomRestriction,
      enablePan: camera.enablePan,
      enableTurntableControls: camera.enableTurntableControls
    });
  }

  function initCamera(viewport) {
    if (!viewport || !viewport.camera) {
      console.warn("camera.js: viewport.camera indisponivel");
      return;
    }
    const camera = viewport.camera;
    applyCameraSettings(camera);

    const session = window.shapediverAPI && window.shapediverAPI.getSession && window.shapediverAPI.getSession();
    if (session && session.updateCallback) {
      const origCallback = session.updateCallback;
      session.updateCallback = function () {
        if (origCallback) origCallback();
        applyCameraSettings(camera);
        console.log("camera.js: reaplicado apos updateCallback");
      };
    }

    let attempts = 0;
    const interval = setInterval(function () {
      applyCameraSettings(camera);
      attempts++;
      if (attempts >= 10) clearInterval(interval);
    }, 500);

    console.log("camera.js: restricoes aplicadas, agendado reaplicacao a cada 500ms por 5s");
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