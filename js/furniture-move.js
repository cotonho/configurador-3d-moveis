(function () {
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
      console.error("furniture-move.js: nao foi possivel carregar three.js de " + THREE_URL);
    document.head.appendChild(script);
  }

  function setMoveMode(on) {
    window.furnitureMoveMode = !!on;
    if (on && typeof window.setFurnitureRotateMode === "function") {
      window.setFurnitureRotateMode(false);
    }
    const btn = document.getElementById("move-toggle");
    if (btn) btn.classList.toggle("active", !!on);
    const canvas =
      document.getElementById(
        (window.SD_CONFIG && window.SD_CONFIG.canvasId) || "canvas"
      ) || document.getElementById("canvas");
    if (canvas) canvas.style.cursor = on ? "grab" : "";
  }

  function selectedRoots() {
    let entry = null;
    if (typeof window.getSelectedFurniture === "function") {
      entry = window.getSelectedFurniture();
    }
    if (entry && entry.root && entry.root.parent) return [entry.root];
    const known = window._furnitureGroups || [];
    return known.filter((g) => g && g.parent);
  }

  function initMove(THREE) {
    const viewport = window.shapediverAPI.getViewport();
    if (!viewport || !viewport.camera) return;
    const cameraApi = viewport.camera;
    const threeCamera = viewport.threeJsCoreObjects.camera;
    const cfg = (window.SD_CONFIG && window.SD_CONFIG.canvasId) || "canvas";
    const canvas =
      document.getElementById(cfg) || document.getElementById("canvas");
    if (!canvas) return;

    let dragging = null;

    const toggle = document.getElementById("move-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        setMoveMode(!(window.furnitureMoveMode === true));
      });
    }
    setMoveMode(window.furnitureMoveMode === true);

    function roomHalf() {
      const L = window._roomLimits || { x: 500, y: 500 };
      return { x: L.x, y: L.y };
    }

    function clampToRoom(group) {
      // Trava pela caixa inteira: nenhuma parte do móvel atravessa a parede
      // (face interna = metade da sala menos a grossura da parede).
      const cfg = (window.SD_CONFIG && window.SD_CONFIG.room) || {};
      const wall =
        (cfg.wallThicknessM || 0.15) * (cfg.unitsPerMeter || 100);
      const half = roomHalf();
      const box = new THREE.Box3();
      group.traverse((o) => {
        if (o.isMesh && o.geometry && o.visible !== false) {
          box.union(new THREE.Box3().setFromObject(o));
        }
      });
      if (box.isEmpty()) return;
      let dx = 0;
      let dy = 0;
      if (box.min.x < -half.x + wall) dx = -half.x + wall - box.min.x;
      else if (box.max.x > half.x - wall) dx = half.x - wall - box.max.x;
      if (box.min.y < -half.y + wall) dy = -half.y + wall - box.min.y;
      else if (box.max.y > half.y - wall) dy = half.y - wall - box.max.y;
      if (dx || dy) {
        group.position.x += dx;
        group.position.y += dy;
        group.updateMatrixWorld(true);
      }
    }

    canvas.addEventListener("pointerdown", function (e) {
      if (window.furnitureMoveMode !== true || e.button !== 0) return;
      const roots = selectedRoots();
      if (!roots.length) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(
        {
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: -((e.clientY - rect.top) / rect.height) * 2 + 1
        },
        threeCamera
      );
      const hits = raycaster.intersectObjects(roots, true);
      if (!hits.length) return;
      dragging = {
        roots: roots,
        lastX: e.clientX,
        lastY: e.clientY,
        prevRotate: cameraApi.enableRotation
      };
      cameraApi.enableRotation = false;
      canvas.style.cursor = "grabbing";
    });

    function stopDrag() {
      if (!dragging) return;
      dragging.roots.forEach((g) => {
        g.userData = g.userData || {};
        g.userData._wantXY = [g.position.x, g.position.y];
      });
      cameraApi.enableRotation = dragging.prevRotate;
      dragging = null;
      canvas.style.cursor = window.furnitureMoveMode === true ? "grab" : "";
    }
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    window.addEventListener("blur", stopDrag);

    // Só 1 movimento por frame: o evento só guarda a posição; o rAF abaixo
    // executa o trabalho completo uma vez (sem o resto das otimizações).
    function doDragMove() {
      const d = dragging;
      if (!d) return;
      d.raf = false;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Agarrar de verdade: projeta o cursor anterior e o atual no plano do
      // piso (z=0) e move o móvel pela diferença — independe de fov e zoom,
      // o ponto sob o cursor fica sob o cursor. Shift = modo fino (0.1x).
      const raycaster = new THREE.Raycaster();
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      function floorPoint(clientX, clientY) {
        raycaster.setFromCamera(
          {
            x: ((clientX - rect.left) / rect.width) * 2 - 1,
            y: -((clientY - rect.top) / rect.height) * 2 + 1
          },
          threeCamera
        );
        const out = new THREE.Vector3();
        return raycaster.ray.intersectPlane(floorPlane, out) ? out : null;
      }
      const p0 = floorPoint(d.lastX, d.lastY);
      d.lastX = d.px;
      d.lastY = d.py;
      if (!p0) return;
      const p1 = floorPoint(d.px, d.py);
      if (!p1) return;
      let mx = p1.x - p0.x;
      let my = p1.y - p0.y;
      if (d.shiftKey) {
        mx *= 0.1;
        my *= 0.1;
      }
      const mlen = Math.sqrt(mx * mx + my * my);
      const MAXD = 120;
      if (mlen > MAXD) {
        mx *= MAXD / mlen;
        my *= MAXD / mlen;
      }
      if (!mx && !my) return;
      d.roots.forEach((g) => {
        g.position.x += mx;
        g.position.y += my;
        g.updateMatrixWorld(true);
        clampToRoom(g);
        g.userData = g.userData || {};
        g.userData._wantXY = [g.position.x, g.position.y];
      });
    }

    window.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      if (typeof e.buttons === "number" && e.buttons !== 0 && !(e.buttons & 1)) {
        stopDrag();
        return;
      }
      dragging.px = e.clientX;
      dragging.py = e.clientY;
      dragging.shiftKey = e.shiftKey;
      if (!dragging.raf) {
        dragging.raf = true;
        requestAnimationFrame(doDragMove);
      }
    });
  }

  window.addEventListener("sdv-ready", () => {
    try {
      setMoveMode(window.furnitureMoveMode === true);
      loadTHREE(initMove);
    } catch (error) {
      console.error("furniture-move.js: falha ao iniciar.", error);
    }
  });

  window.setFurnitureMoveMode = setMoveMode;
})();
