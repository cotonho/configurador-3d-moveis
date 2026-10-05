(function () {
  const config = window.SD_CONFIG;
  const THREE_URL = "https://unpkg.com/three@0.160.0/build/three.min.js";

  // Registro de móveis: cada entrada liga um objeto 3D (raiz) aos seus
  // parâmetros. Hoje há um só (sessão principal); futuros móveis adicionam
  // entradas com { id, label, root, getParameters } via registerFurniture.
  window.furnitureRegistry = window.furnitureRegistry || [];
  let selectedId = null;
  // Colapsado por seção (nome -> bool), clicado pelo usuário. Sobrevive às
  // re-renderizações da sidebar; o estado inicial vem de controls.groups.
  const collapsedByUser = new Map();

  // Estado inicial de uma seção: toggle do usuário > listas collapsed/
  // expanded (nome exato) > defaultCollapsed global. Tudo opcional.
  function isGroupCollapsed(name) {
    if (collapsedByUser.has(name)) return collapsedByUser.get(name);
    const gc = (config.controls && config.controls.groups) || {};
    if (Array.isArray(gc.collapsed) && gc.collapsed.indexOf(name) !== -1) {
      return true;
    }
    if (Array.isArray(gc.expanded) && gc.expanded.indexOf(name) !== -1) {
      return false;
    }
    // Padrão: guardado. Só abre por padrão com defaultCollapsed: false.
    return gc.defaultCollapsed !== false;
  }

  function loadTHREE(callback) {
    if (window.THREE) {
      callback(window.THREE);
      return;
    }
    const script = document.createElement("script");
    script.src = THREE_URL;
    script.onload = () => callback(window.THREE);
    script.onerror = () =>
      console.error("menu.js: nao foi possivel carregar three.js de " + THREE_URL);
    document.head.appendChild(script);
  }

  function registerFurniture(entry) {
    if (!entry || !entry.id || typeof entry.getParameters !== "function") {
      console.error("menu.js: entrada de movel invalida.", entry);
      return;
    }
    const i = window.furnitureRegistry.findIndex((e) => e.id === entry.id);
    if (i >= 0) {
      window.furnitureRegistry[i] = entry;
    } else {
      window.furnitureRegistry.push(entry);
    }
    if (selectedId === null) {
      selectFurniture(entry.id);
    }
  }

  function selectFurniture(id) {
    const entry = window.furnitureRegistry.find((e) => e.id === id);
    if (!entry) {
      return;
    }
    selectedId = id;
    renderSidebar(entry);
  }

  function renderSidebar(entry) {
    const title = document.getElementById("side-panel-title");
    if (title) {
      title.textContent = entry.label || "Atributos do movel";
    }
    const body = document.getElementById("side-panel-body");
    if (!body) {
      console.error("menu.js: #side-panel-body nao encontrado.");
      return;
    }
    body.innerHTML = "";
    // Ordem do autor do modelo (param.order) + cabeçalhos por grupo
    // (param.group.name): organização genérica, funciona para qualquer
    // móvel sem configuração individual. Sem order, mantém a ordem vinda
    // do modelo; grupos ignorados (buildControl=null) não geram cabeçalho.
    const ordered = entry.getParameters().map((p, i) => [p, i]);
    ordered.sort((A, B) => {
      const oa = typeof A[0].order === "number" ? A[0].order : null;
      const ob = typeof B[0].order === "number" ? B[0].order : null;
      if (oa === null && ob === null) return A[1] - B[1];
      if (oa === null) return 1;
      if (ob === null) return -1;
      return oa - ob || A[1] - B[1];
    });
    let lastGroup = null;
    let rowsWrap = null;
    ordered.forEach(([param]) => {
      const row = window.controlsUI.buildControl(param);
      if (!row) {
        return;
      }
      const g = param.group && param.group.name ? String(param.group.name) : "";
      if (!g) {
        lastGroup = null;
        rowsWrap = null;
        body.appendChild(row);
        return;
      }
      if (g !== lastGroup) {
        lastGroup = g;
        const section = document.createElement("div");
        section.className = "control-section";
        const h = document.createElement("div");
        h.className = "control-group collapsible";
        h.setAttribute("role", "button");
        h.setAttribute("tabindex", "0");
        const caret = document.createElement("span");
        caret.className = "group-caret";
        h.appendChild(caret);
        h.appendChild(document.createTextNode(g));
        rowsWrap = document.createElement("div");
        rowsWrap.className = "control-rows";
        const applyState = () => {
          const c = isGroupCollapsed(g);
          section.classList.toggle("collapsed", c);
          caret.textContent = c ? "▸" : "▾";
          h.setAttribute("aria-expanded", String(!c));
        };
        applyState();
        const toggle = () => {
          collapsedByUser.set(g, !isGroupCollapsed(g));
          applyState();
        };
        h.addEventListener("click", toggle);
        h.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        });
        section.appendChild(h);
        section.appendChild(rowsWrap);
        body.appendChild(section);
      }
      rowsWrap.appendChild(row);
    });
  }

  function isRoomPart(obj) {
    let current = obj;
    while (current.parent) {
      if (current.name === "room-frontend") {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  // Resolve a raiz 3D da sessão (preguiçoso: só existe após os outputs).
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

  // Sobe na hierarquia até achar a raiz registrada que contém o objeto.
  // Entrada sem root/roots (sessão principal legada) aceita qualquer acerto.
  function ownerOf(viewport, obj) {
    let fallback = null;
    for (const entry of window.furnitureRegistry) {
      const roots = [];
      if (entry.root) roots.push(entry.root);
      if (typeof entry.getRoot === "function") {
        try {
          const r = entry.getRoot();
          if (r) roots.push(r);
        } catch (e) {}
      }
      if (!roots.length) {
        fallback = entry;
        continue;
      }
      for (const root of roots) {
        let current = obj;
        while (current) {
          if (current === root) {
            return entry;
          }
          current = current.parent;
        }
      }
    }
    return fallback;
  }

  function initMenu(THREE) {
    const viewport = window.shapediverAPI.getViewport();
    const canvas = document.getElementById(config.canvasId);
    const core = viewport && viewport.threeJsCoreObjects;
    if (!viewport || !canvas || !core || !core.scene || !core.camera) {
      throw new Error("Viewport/cena indisponiveis para a barra lateral.");
    }
    const scene = core.scene;
    const camera = core.camera;

    window.shapediverAPI.getSessions().forEach((s) => {
      registerFurniture({
        id: s.id,
        label: s.label,
        // Raiz viva da SESSAO (getter: resolve na hora de ler, nunca stale).
        // Sem o array compartilhado window._furnitureGroups aqui — ele
        // juntava todos os moveis e fazia as cotas operarem sobre a cena
        // toda. (move/rotate/ownerOf resolvem por getRoot() primeiro; o campo
        // `roots` plural segue suportado como fallback, mas nao e usado aqui.)
        get root() { return sessionRoot(viewport, s.session); },
        getRoot: () => sessionRoot(viewport, s.session),
        getParameters: () => window.shapediverAPI.getParameters(s.id)
      });
    });

    function furnitureDiagLimit() {
      const meshes = [];
      const collect = (obj) => {
        obj.children.forEach((child) => {
          if (child.name === "room-frontend") {
            return;
          }
          if (child.isMesh && child.geometry) {
            meshes.push(child);
          }
          collect(child);
        });
      };
      collect(scene);
      if (!meshes.length) {
        return Infinity;
      }
      const diags = meshes.map((mesh) => {
        const b = new THREE.Box3();
        b.setFromObject(mesh);
        return b.getSize(new THREE.Vector3()).length();
      });
      diags.sort((a, b) => a - b);
      const median = diags[Math.floor(diags.length / 2)];
      return Math.max(median * 4, 100);
    }

    function pick(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return null;
      }
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(
        {
          x: ((clientX - rect.left) / rect.width) * 2 - 1,
          y: -((clientY - rect.top) / rect.height) * 2 + 1
        },
        camera
      );
      const limit = furnitureDiagLimit();
      const hits = raycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        if (isRoomPart(hit.object)) {
          continue;
        }
        const b = new THREE.Box3();
        b.setFromObject(hit.object);
        const diag = b.getSize(new THREE.Vector3()).length();
        if (diag <= limit) {
          return hit;
        }
      }
      return null;
    }

    canvas.addEventListener("click", (event) => {
      const hit = pick(event.clientX, event.clientY);
      if (!hit) {
        return;
      }
      const owner = ownerOf(viewport, hit.object);
      if (owner && owner.id !== selectedId) {
        selectFurniture(owner.id);
      }
    });
  }

  window.addEventListener("sdv-ready", () => {
    try {
      loadTHREE(initMenu);
    } catch (error) {
      console.error("menu.js: falha ao iniciar a barra lateral.", error);
    }
  });

  window.registerFurniture = registerFurniture;
  window.selectFurniture = selectFurniture;
  window.getSelectedFurniture = function () {
    return window.furnitureRegistry.find((e) => e.id === selectedId) || null;
  };
})();
