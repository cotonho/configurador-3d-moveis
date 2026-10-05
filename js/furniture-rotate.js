(function () {
  const THREE_URL = "https://unpkg.com/three@0.160.0/build/three.min.js";
  const SNAP_DEG = 6;
  const SNAP_TARGETS = [-180, -90, 0, 90, 180];

  function loadTHREE(callback) {
    if (window.THREE) {
      callback(window.THREE);
      return;
    }
    const script = document.createElement("script");
    script.src = THREE_URL;
    script.onload = () => callback(window.THREE);
    script.onerror = () =>
      console.error("furniture-rotate.js: nao foi possivel carregar three.js de " + THREE_URL);
    document.head.appendChild(script);
  }

  // Único lugar com normalização: wrapPi no delta (caminho mais curto).
  // Todo o resto (slider, snap, _rotAbs, display) usa graus brutos em
  // [-180, 180] — o slider já é limitado pelo próprio min/max do HTML.
  function wrapPi(a) {
    const TAU = 2 * Math.PI;
    const r = ((a % TAU) + TAU) % TAU; // [0, 2π)
    return r > Math.PI ? r - TAU : r; // (-π, π]: prefere +π no limite
  }

  function setRotateMode(on) {
    window.furnitureRotateMode = !!on;
    const btn = document.getElementById("rotate-toggle");
    if (btn) btn.classList.toggle("active", !!on);
    if (on && typeof window.setFurnitureMoveMode === "function") {
      window.setFurnitureMoveMode(false);
    }
    refreshRotatePanel();
  }

  function selectedRoots() {
    let entry = null;
    if (typeof window.getSelectedFurniture === "function") {
      entry = window.getSelectedFurniture();
    }
    if (entry) {
      if (typeof entry.getRoot === "function") {
        try {
          const r = entry.getRoot();
          if (r && r.parent) return [r];
        } catch (e) {}
      }
      if (Array.isArray(entry.roots) && entry.roots.length) {
        const r = entry.roots.filter((g) => g && g.parent);
        if (r.length) return r;
        return [];
      }
      if (entry.root && entry.root.parent) return [entry.root];
      if (!entry.root && !entry.roots) {
        const known = window._furnitureGroups || [];
        return known.filter((g) => g && g.parent);
      }
      return [];
    }
    const known = window._furnitureGroups || [];
    return known.filter((g) => g && g.parent);
  }

  function currentAngleDeg() {
    const roots = selectedRoots();
    if (!roots.length) return 0;
    const u = roots[0].userData || {};
    if (typeof u._rotAbs !== "number") return 0;
    return (u._rotAbs * 180) / Math.PI;
  }

  function refreshRotatePanel() {
    const panel = document.getElementById("rotate-panel");
    const slider = document.getElementById("rotate-slider");
    const out = document.getElementById("rotate-value");
    const on = window.furnitureRotateMode === true;
    const roots = selectedRoots();
    if (panel) panel.style.display = on && roots.length ? "block" : "none";
    if (on && slider) {
      const deg = Math.round(currentAngleDeg());
      slider.value = String(deg);
      if (out) out.textContent = deg + "°";
    }
  }

  function initRotate(THREE) {
    const panel = document.getElementById("rotate-panel");
    const slider = document.getElementById("rotate-slider");
    const out = document.getElementById("rotate-value");
    const toggle = document.getElementById("rotate-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        setRotateMode(!(window.furnitureRotateMode === true));
      });
    }
    if (!slider) return;
    setRotateMode(window.furnitureRotateMode === true);

    const canvas =
      document.getElementById(
        (window.SD_CONFIG && window.SD_CONFIG.canvasId) || "canvas"
      ) || document.getElementById("canvas");
    if (canvas) {
      // Click troca a seleção (menu.js) — atualiza o slider depois.
      canvas.addEventListener("click", () => {
        refreshRotatePanel();
      });
    }

    function roomHalf() {
      const L = window._roomLimits || { x: 500, y: 500 };
      return { x: L.x, y: L.y };
    }

    function clampGroup(group) {
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

    // Pivô ÚNICO: centro da união de todos os grupos. Se cada grupo girasse
    // no próprio centro, a união deformaria e as cotas quebrariam.
    function rotateSelectedTo(deg) {
      const roots = selectedRoots().filter((g) => g && g.parent);
      if (!roots.length) return;
      const ub = new THREE.Box3();
      roots.forEach((g) => {
        ub.union(new THREE.Box3().setFromObject(g));
      });
      if (ub.isEmpty()) return;
      const uc = ub.getCenter(new THREE.Vector3());
      const nabs = (deg * Math.PI) / 180;
      roots.forEach((g) => {
        g.userData = g.userData || {};
        if (g.userData._rotBase === undefined) {
          g.userData._rotBase = g.rotation.z || 0;
        }
        if (typeof g.userData._rotAbs !== "number") {
          g.userData._rotAbs = 0;
        }
        const dtheta = wrapPi(nabs - g.userData._rotAbs);
        if (dtheta) {
          const cos = Math.cos(dtheta);
          const sin = Math.sin(dtheta);
          const relX = uc.x - g.position.x;
          const relY = uc.y - g.position.y;
          g.position.x = uc.x - (relX * cos - relY * sin);
          g.position.y = uc.y - (relX * sin + relY * cos);
          g.rotation.z += dtheta;
          g.updateMatrixWorld(true);
        }
        clampGroup(g);
        g.userData._rotAbs = nabs;
        g.rotation.z = g.userData._rotBase + nabs;
        g.updateMatrixWorld(true);
      });
    }

    slider.addEventListener("input", () => {
      // Durante o arrasto: snap ao vivo, sem reposicionar o polegar
      // (o polegar segue o mouse; só o modelo gruda no snap).
      // Compara o valor cru (slider já limitado a [-180, 180], sem wrap).
      let deg = Number(slider.value);
      for (const t of SNAP_TARGETS) {
        if (Math.abs(deg - t) <= SNAP_DEG) {
          deg = t;
          break;
        }
      }
      rotateSelectedTo(deg);
      if (out) out.textContent = deg + "°";
    });
    slider.addEventListener("change", () => {
      // Ao soltar: garante o snap final e alinha o polegar.
      let deg = Number(slider.value);
      for (const t of SNAP_TARGETS) {
        if (Math.abs(deg - t) <= SNAP_DEG) {
          deg = t;
          break;
        }
      }
      rotateSelectedTo(deg);
      slider.value = String(deg);
      if (out) out.textContent = deg + "°";
    });
  }

  window.addEventListener("sdv-ready", () => {
    try {
      loadTHREE(initRotate);
    } catch (error) {
      console.error("furniture-rotate.js: falha ao iniciar.", error);
    }
  });

  window.setFurnitureRotateMode = setRotateMode;
})();
