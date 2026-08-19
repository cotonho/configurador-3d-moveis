(function () {
  let session = null;
  let viewport = null;
  let onChanged = null;
  const timers = {};

  function waitForSDV() {
    return new Promise(function (resolve, reject) {
      if (window.SDV) {
        resolve(window.SDV);
        return;
      }
      window.addEventListener(
        "sdv-bundle-ready",
        function () {
          resolve(window.SDV);
        },
        { once: true }
      );
      window.addEventListener(
        "sdv-bundle-failed",
        function (event) {
          reject(
            (event.detail && event.detail.error) ||
              new Error("Viewer indisponivel")
          );
        },
        { once: true }
      );
    });
  }

  window.shapediverAPI = {
    async init(config) {
      const SDV = await waitForSDV();

      viewport = await SDV.createViewport({
        canvas: document.getElementById(config.canvasId),
        id: "mainViewport"
      });

      session = await SDV.createSession({
        ticket: config.ticket,
        modelViewUrl: config.modelViewUrl,
        id: "mainSession"
      });

      session.updateCallback = function () {
        if (onChanged) {
          onChanged();
        }
      };

      window.dispatchEvent(
        new CustomEvent("sdv-ready", { detail: { viewport, session } })
      );
    },

    getViewport() {
      return viewport;
    },

    getSession() {
      return session;
    },

    getParameters() {
      if (!session) {
        return [];
      }
      if (typeof session.getParameters === "function") {
        return session.getParameters();
      }
      const map = session.parameters || session.parameterValues || {};
      return Object.keys(map).map((name) => map[name]);
    },

    getParameter(name) {
      return session ? session.getParameterByName(name)[0] : null;
    },

    setParameter(param, value) {
      param.value = value;
      if (timers[param.name]) {
        clearTimeout(timers[param.name]);
      }
      timers[param.name] = setTimeout(async () => {
        await session.customize();
        if (onChanged) {
          onChanged();
        }
      }, 300);
    },

    setOnChanged(callback) {
      onChanged = callback;
    }
  };
})();
