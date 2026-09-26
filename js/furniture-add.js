(function () {
  function status(msg) {
    const el = document.getElementById("add-model-status");
    if (el) el.textContent = msg || "";
  }

  function sessionRoot(viewport, session) {
    try {
      if (!viewport || !session || !session.node) return null;
      const converted = session.node.convertedObject;
      if (!converted) return null;
      const root = converted[viewport.id];
      return root && root.parent ? root : null;
    } catch (e) {
      return null;
    }
  }

  const instanceCount = {};

  function refreshCatalog() {}

  function init() {
    const list = document.getElementById("catalog-list");
    if (!list) return;
    const catalog =
      (window.SD_CONFIG && window.SD_CONFIG.catalog) || [];
    list.innerHTML = "";
    if (!catalog.length) {
      const hint = document.createElement("div");
      hint.className = "control-hint";
      hint.textContent = "Nenhum móvel no catálogo.";
      list.appendChild(hint);
      return;
    }
    catalog.forEach((item, i) => {
      const base = item.id || "catalog" + (i + 1);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = item.label || base;
      btn.setAttribute("data-model-id", base);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        // Cada clique = uma instância nova (permite 2+ iguais).
        const n = (instanceCount[base] || 0) + 1;
        instanceCount[base] = n;
        const id = base + "-" + n;
        const label = (item.label || base) + (n > 1 ? " " + n : "");
        status("Carregando " + label + "...");
        try {
          const api = window.shapediverAPI;
          const added = await api.addModel({
            id: id,
            label: label,
            ticket: item.ticket,
            modelViewUrl: item.modelViewUrl,
            modelUnits: item.modelUnits || null
          });
          const viewport = api.getViewport();
          const session = api.getSession(added.id);
          window.registerFurniture({
            id: added.id,
            label: added.label,
            // Raiz viva da sessao (getter, como em menu.js): root estatico
            // null fazia a cota cair na cena toda (uniao dos moveis).
            get root() { return sessionRoot(viewport, session); },
            getRoot: () => sessionRoot(viewport, session),
            getParameters: () => api.getParameters(added.id)
          });
          window.selectFurniture(added.id);
          status("");
          btn.disabled = false;
        } catch (error) {
          console.error("furniture-add.js:", error);
          status(
            "Falha: " +
              ((error && error.message) || String(error)) +
              " (confira ticket, URL e domínio)"
          );
          btn.disabled = false;
        }
      });
      list.appendChild(btn);
    });
    refreshCatalog();
  }

  window.addEventListener("sdv-ready", () => {
    try {
      init();
    } catch (error) {
      console.error("furniture-add.js: falha ao iniciar.", error);
    }
  });
  window.refreshCatalog = refreshCatalog;
})();
