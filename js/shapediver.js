console.log("shapediver.js carregado - v3-multisession");
(function () {
  const sessions = new Map();
  let sessionOrder = [];
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

  function modelsFromConfig(config) {
    if (Array.isArray(config.models) && config.models.length) {
      return config.models.map((m, i) => ({
        id: m.id || "model" + (i + 1),
        label: m.label || m.id || "Movel " + (i + 1),
        ticket: m.ticket,
        modelViewUrl: m.modelViewUrl,
        modelUnits: m.modelUnits || null
      }));
    }
    return [
      {
        id: "main",
        label: config.productName || "Movel",
        ticket: config.ticket,
        modelViewUrl: config.modelViewUrl
      }
    ];
  }

  function paramsOf(session) {
    if (!session) {
      return [];
    }
    if (typeof session.getParameters === "function") {
      return session.getParameters();
    }
    const map = session.parameters || session.parameterValues || {};
    return Object.keys(map).map((name) => map[name]);
  }

  function findOwnerSession(param) {
    for (const id of sessionOrder) {
      const entry = sessions.get(id);
      if (entry && paramsOf(entry.session).indexOf(param) !== -1) {
        return entry;
      }
    }
    return null;
  }

  // Parâmetros inteiros rejeitam float no setter (isValid lança). Sonda:
  // se o valor cru é inválido mas o arredondado é válido, usa o arredondado.
  function coerceParamValue(param, value) {
    if (typeof value !== "number" || !param || typeof param.isValid !== "function") {
      return value;
    }
    try {
      if (param.isValid(value, false)) return value;
      const r = Math.round(value);
      if (param.isValid(r, false)) return r;
    } catch (e) {}
    return value;
  }

  window.shapediverAPI = {
    async init(config) {
      const SDV = await waitForSDV();

      viewport = await SDV.createViewport({
        canvas: document.getElementById(config.canvasId),
        id: "mainViewport",
        initialAutoAdjust: false
      });

      const models = modelsFromConfig(config);
      sessionOrder = [];
      for (const m of models) {
        const session = await SDV.createSession({
          ticket: m.ticket,
          modelViewUrl: m.modelViewUrl,
          id: m.id + "Session"
        });
        sessions.set(m.id, { id: m.id, label: m.label, session: session });
        sessionOrder.push(m.id);
        session.updateCallback = function () {
          if (onChanged) {
            onChanged();
          }
        };
      }

      window.dispatchEvent(
        new CustomEvent("sdv-ready", {
          detail: { viewport: viewport, session: this.getSession() }
        })
      );
    },

    getViewport() {
      return viewport;
    },

    getSession(id) {
      if (!id) {
        const first = sessionOrder[0];
        return first ? sessions.get(first).session : null;
      }
      const entry = sessions.get(id);
      return entry ? entry.session : null;
    },

    async addModel(m) {
      const SDV = await waitForSDV();
      if (!viewport) {
        throw new Error("Viewport ainda nao criado");
      }
      if (!m || !m.ticket || !m.modelViewUrl) {
        throw new Error("Ticket e Model URL sao obrigatorios");
      }
      const id = m.id || ("model" + (sessionOrder.length + 1));
      if (sessions.has(id)) {
        throw new Error('Modelo "' + id + '" ja existe');
      }
      const label = m.label || id;
      const session = await SDV.createSession({
        ticket: m.ticket,
        modelViewUrl: m.modelViewUrl,
        id: id + "Session"
      });
      sessions.set(id, {
        id: id,
        label: label,
        session: session,
        modelUnits: m.modelUnits || null
      });
      sessionOrder.push(id);
      session.updateCallback = function () {
        if (onChanged) {
          onChanged();
        }
      };
      return { id: id, label: label, modelUnits: m.modelUnits || null };
    },

    getSessions() {
      return sessionOrder.map((id) => {
        const entry = sessions.get(id);
        return {
          id: entry.id,
          label: entry.label,
          session: entry.session,
          modelUnits: entry.modelUnits || null
        };
      });
    },

    getParameters(sessionId) {
      if (sessionId) {
        const entry = sessions.get(sessionId);
        return paramsOf(entry ? entry.session : null);
      }
      return paramsOf(this.getSession());
    },

    getParameter(name) {
      const session = this.getSession();
      return session ? session.getParameterByName(name)[0] : null;
    },

    setParameter(param, value, sessionId) {
      let entry = null;
      if (sessionId) {
        entry = sessions.get(sessionId) || null;
      } else {
        entry = findOwnerSession(param);
      }
      if (!entry) {
        return;
      }
      value = coerceParamValue(param, value);
      try {
        param.value = value;
      } catch (error) {
        console.error(
          'shapediverAPI.setParameter rejeitado (sessao "' + entry.id + '", parametro "' + param.name + '"):',
          (error && error.message) || error
        );
        return;
      }
      const key = entry.id + ":" + param.name;
      if (timers[key]) {
        clearTimeout(timers[key]);
      }
      timers[key] = setTimeout(async () => {
        try {
          await entry.session.customize();
        } catch (error) {
          console.error(
            'shapediverAPI.customize falhou (sessao "' + entry.id + '", parametro "' + param.name + '"):',
            (error && error.message) || error
          );
          window.dispatchEvent(
            new CustomEvent("sdv-customize-failed", {
              detail: {
                sessionId: entry.id,
                param: param.name,
                message: (error && error.message) || String(error)
              }
            })
          );
          return;
        }
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
