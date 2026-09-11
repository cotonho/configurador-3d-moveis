(function () {
  const config = window.SD_CONFIG;
  const THREE_URL = "https://unpkg.com/three@0.160.0/build/three.min.js";

  // Registro de móveis: cada entrada liga um objeto 3D (raiz) aos seus
  // parâmetros. Hoje há um só (sessão principal); futuros móveis adicionam
  // entradas com { id, label, root, getParameters } via registerFurniture.
  window.furnitureRegistry = window.furnitureRegistry || [];
  let selectedId = null;

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
    entry.getParameters().forEach((param) => {
      const row = window.controlsUI.buildControl(param);
      if (row) {
        body.appendChild(row);
      }
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

  // Sobe na hierarquia até achar a raiz registrada que contém o objeto.
  // Entrada sem root (sessão principal) aceita qualquer acerto fora da sala.
  function ownerOf(obj) {
    let fallback = null;
    for (const entry of window.furnitureRegistry) {
      if (!entry.root) {
        fallback = entry;
        continue;
      }
      let current = obj;
      while (current) {
        if (current === entry.root) {
          return entry;
        }
        current = current.parent;
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

    registerFurniture({
      id: "main",
      label: config.productName || "Atributos do movel",
      root: null,
      getParameters: () => window.shapediverAPI.getParameters()
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
      const owner = ownerOf(hit.object);
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
})();
