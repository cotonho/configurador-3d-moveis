(function () {
  const config = window.SD_CONFIG;
  const THREE_URL = "https://unpkg.com/three@0.160.0/build/three.min.js";

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

  function initMenu(THREE) {
    const viewport = window.shapediverAPI.getViewport();
    const canvas = document.getElementById(config.canvasId);
    const core = viewport && viewport.threeJsCoreObjects;
    if (!viewport || !canvas || !core || !core.scene || !core.camera) {
      throw new Error("Viewport/cena indisponiveis para o menu flutuante.");
    }
    const scene = core.scene;
    const camera = core.camera;

    const menu = document.createElement("div");
    menu.id = "float-menu";
    menu.className = "float-menu";
    menu.innerHTML =
      '<div class="float-menu-head">' +
      '<span class="float-menu-title">Atributos do movel</span>' +
      '<button type="button" class="float-menu-close" title="Fechar">&times;</button>' +
      "</div>" +
      '<div class="float-menu-body"></div>';
    document.body.appendChild(menu);

    const body = menu.querySelector(".float-menu-body");

    function hide() {
      menu.classList.remove("visible");
    }

    menu.querySelector(".float-menu-close").addEventListener("click", hide);

    function fillControls() {
      body.innerHTML = "";
      window.shapediverAPI.getParameters().forEach((param) => {
        const row = window.controlsUI.buildControl(param);
        if (row) {
          body.appendChild(row);
        }
      });
    }

    function showAt(clientX, clientY) {
      fillControls();
      menu.classList.add("visible");
      const rect = menu.getBoundingClientRect();
      let left = clientX + 14;
      let top = clientY + 6;
      if (left + rect.width > window.innerWidth - 10) {
        left = clientX - rect.width - 14;
      }
      if (top + rect.height > window.innerHeight - 10) {
        top = clientY - rect.height - 6;
      }
      menu.style.maxHeight = window.innerHeight - 20 + "px";
      menu.style.left = Math.max(10, left) + "px";
      menu.style.top = Math.max(10, top) + "px";
    }

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
      if (menu.contains(event.target)) {
        return;
      }
      if (pick(event.clientX, event.clientY)) {
        showAt(event.clientX, event.clientY);
      } else {
        hide();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hide();
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (
        menu.classList.contains("visible") &&
        !menu.contains(event.target)
      ) {
        hide();
      }
    });

    menu.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
  }

  window.addEventListener("sdv-ready", () => {
    try {
      loadTHREE(initMenu);
    } catch (error) {
      console.error("menu.js: falha ao criar o menu flutuante.", error);
    }
  });
})();