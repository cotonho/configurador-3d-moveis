(function () {
  const roomConfig = (window.SD_CONFIG && window.SD_CONFIG.room) || {};
  const THREE_URL = "https://unpkg.com/three@0.160.0/build/three.min.js";

  const TRANSPARENT = roomConfig.transparentOpacity || 0.15;
  const OPAQUE = roomConfig.opaqueOpacity || 0.85;
  const UNITS_PER_M = roomConfig.unitsPerMeter || 100;
  const WIDTH = (roomConfig.widthM || 3.2) * UNITS_PER_M;
  const DEPTH = (roomConfig.depthM || 2.8) * UNITS_PER_M;
  const HEIGHT = (roomConfig.heightM || 2.7) * UNITS_PER_M;
  const FURNITURE_SCALE = roomConfig.furnitureScale || 1;
  const CENTER = roomConfig.furnitureCenter || [0, 0.9, 0];

  function loadTHREE(callback) {
    if (window.THREE) {
      callback(window.THREE);
      return;
    }
    const script = document.createElement("script");
    script.src = THREE_URL;
    script.onload = () => callback(window.THREE);
    script.onerror = () =>
      console.error("room.js: nao foi possivel carregar three.js de " + THREE_URL);
    document.head.appendChild(script);
  }

  function buildRoom(THREE) {
    const viewport = window.shapediverAPI.getViewport();
    if (!viewport) {
      throw new Error("Viewport indisponivel para criar a sala.");
    }

    const scene =
      (viewport.threeJsCoreObjects && viewport.threeJsCoreObjects.scene) ||
      viewport.scene ||
      (window.SDV && window.SDV.sceneTree && window.SDV.sceneTree.scene);
    if (!scene) {
      throw new Error("Cena do viewer indisponivel para criar a sala.");
    }
    const room = new THREE.Group();
    room.name = "room-frontend";
    let wrap = null;
    let feetZ0 = null;
    const manualPos = roomConfig.position;
    if (manualPos) {
      room.position.set(manualPos[0], manualPos[1], manualPos[2]);
    }

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf0ede8,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, DEPTH), floorMat);
    room.add(floor);

    const wallDefs = [
      { pos: [0, -DEPTH / 2, HEIGHT / 2], size: [WIDTH, 0.2, HEIGHT], normal: [0, 1, 0], name: "back", halfX: WIDTH / 2, halfZ: HEIGHT / 2 },
      { pos: [-WIDTH / 2, 0, HEIGHT / 2], size: [0.2, DEPTH, HEIGHT], normal: [1, 0, 0], name: "left", halfX: DEPTH / 2, halfZ: HEIGHT / 2 },
      { pos: [WIDTH / 2, 0, HEIGHT / 2], size: [0.2, DEPTH, HEIGHT], normal: [-1, 0, 0], name: "right", halfX: DEPTH / 2, halfZ: HEIGHT / 2 }
    ];

    const walls = wallDefs.map((def) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xdfe5ec,
        transparent: true,
        opacity: OPAQUE,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(def.size[0], def.size[1], def.size[2]),
        mat
      );
      mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
      mesh.userData = {
        normal: new THREE.Vector3(...def.normal),
        name: def.name,
        halfSpanX: def.halfX,
        halfSpanZ: def.halfZ
      };
      room.add(mesh);
      return mesh;
    });

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(6, 9, 5);
    room.add(ambient, sun);

    scene.add(room);

    const camera = viewport.camera;
    if (!camera) {
      return;
    }

    const center = new THREE.Vector3(CENTER[0], CENTER[1], CENTER[2]);
    const dir = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const tmp2 = new THREE.Vector3();
    const tmp3 = new THREE.Vector3();
    const furnitureBox = new THREE.Box3();
    let lastCenterUpdate = 0;

    function collectMeshes(obj, out) {
      obj.children.forEach((child) => {
        if (child === room) {
          return;
        }
        if (child.isMesh && child.geometry) {
          out.push(child);
        }
        collectMeshes(child, out);
      });
    }

    function furnitureDiagLimit() {
      const diags = [];
      const meshes = [];
      collectMeshes(scene, meshes);
      meshes.forEach((mesh) => {
        const b = new THREE.Box3();
        b.setFromObject(mesh);
        diags.push(b.getSize(new THREE.Vector3()).length());
      });
      diags.sort((a, b) => a - b);
      if (!diags.length) {
        return Infinity;
      }
      const median = diags[Math.floor(diags.length / 2)];
      return Math.max(median * (roomConfig.sceneryRatio || 4), 100);
    }

    function computeFurnitureBox() {
      const meshes = [];
      collectMeshes(scene, meshes);
      if (!meshes.length) {
        return null;
      }
      const limit = furnitureDiagLimit();
      const box = new THREE.Box3();
      let used = 0;
      meshes.forEach((mesh) => {
        const b = new THREE.Box3();
        b.setFromObject(mesh);
        const diag = b.getSize(new THREE.Vector3()).length();
        if (diag > limit) {
          return;
        }
        box.union(furnitureBox.setFromObject(mesh));
        used++;
      });
      return used ? box : null;
    }

    function ensureWrapped() {
      if (FURNITURE_SCALE === 1) {
        return;
      }
      if (!wrap) {
        wrap = new THREE.Group();
        wrap.name = "furniture-wrap";
        scene.add(wrap);
      }
      scene.children.slice().forEach((child) => {
        if (child === room || child === wrap) {
          return;
        }
        scene.remove(child);
        wrap.add(child);
      });
      if (feetZ0 === null) {
        wrap.scale.setScalar(1);
        wrap.updateMatrixWorld(true);
        const meshes = [];
        collectMeshes(scene, meshes);
        const limit = furnitureDiagLimit();
        const bbox = new THREE.Box3();
        meshes.forEach((mesh) => {
          const b = new THREE.Box3();
          b.setFromObject(mesh);
          const diag = b.getSize(new THREE.Vector3()).length();
          if (diag <= limit) {
            bbox.union(b);
          }
        });
        feetZ0 = bbox.isEmpty() ? 0 : bbox.min.z;
      }
      wrap.scale.setScalar(FURNITURE_SCALE);
      const floorZ = room.position.z;
      wrap.position.z = floorZ - FURNITURE_SCALE * feetZ0;
      const offset = roomConfig.furnitureOffset;
      if (offset) {
        wrap.position.x = offset[0] || 0;
        wrap.position.z += offset[1] || 0;
      }
      wrap.updateMatrixWorld(true);
    }

    let debugEl = null;

    function updateDebug(box) {
      if (roomConfig.debug !== true) {
        return;
      }
      if (!debugEl) {
        debugEl = document.createElement("div");
        debugEl.id = "room-debug";
        debugEl.style.cssText =
          "position:absolute;left:16px;bottom:64px;z-index:20;font:11px monospace;color:#1d2733;background:rgba(255,255,255,0.85);padding:6px 10px;border-radius:8px;border:1px solid #dfe5ec;";
        document.body.appendChild(debugEl);
      }
      debugEl.textContent =
        "chao(z): " +
        room.position.z.toFixed(2) +
        " | fundo movel(z): " +
        box.min.z.toFixed(2) +
        " | gap: " +
        (box.min.z - room.position.z).toFixed(2);
    }

    function hideScenery(limit) {
      if (roomConfig.hideScenery === false) {
        return;
      }
      const meshes = [];
      collectMeshes(scene, meshes);
      meshes.forEach((mesh) => {
        const b = new THREE.Box3();
        b.setFromObject(mesh);
        const diag = b.getSize(new THREE.Vector3()).length();
        mesh.visible = diag <= limit;
      });
    }

    function updateFurnitureCenter(now) {
      if (roomConfig.furnitureCenter) {
        center.copy(new THREE.Vector3(CENTER[0], CENTER[1], CENTER[2]));
        return;
      }
      if (now - lastCenterUpdate < 500) {
        return;
      }
      lastCenterUpdate = now;
      ensureWrapped();
      const box = computeFurnitureBox();
      if (!box) {
        return;
      }
      hideScenery(furnitureDiagLimit());
      box.getCenter(center);
      updateDebug(box);
    }

    function vec3Of(obj, out) {
      if (!obj) {
        return out.set(0, 0, 0);
      }
      return out.set(
        obj.x !== undefined ? obj.x : obj[0],
        obj.y !== undefined ? obj.y : obj[1],
        obj.z !== undefined ? obj.z : obj[2]
      );
    }

    function cameraDirection() {
      if (camera.position && camera.target) {
        const p = vec3Of(camera.position, tmp2);
        const t = vec3Of(camera.target, tmp);
        dir.copy(t).sub(p);
        if (dir.lengthSq() > 0) {
          dir.normalize();
        }
        return;
      }
      if (typeof camera.getWorldDirection === "function") {
        camera.getWorldDirection(dir);
        return;
      }
      const m = camera.matrixWorld && camera.matrixWorld.elements;
      if (m) {
        dir.set(-m[8], -m[9], -m[10]).normalize();
        return;
      }
      if (camera.quaternion) {
        dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
        return;
      }
      dir.set(0, 0, -1);
    }

    function update() {
      updateFurnitureCenter(performance.now());
      cameraDirection();
      const camPos = vec3Of(
        camera.position ||
        camera.worldPosition ||
        (camera.matrixWorld
          ? new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)
          : new THREE.Vector3()),
        tmp2
      );
      const camT = tmp.copy(camPos).sub(center).dot(dir);

      if (isFinite(camT)) {
        walls.forEach((wall) => {
          const wallPos = tmp3.copy(wall.position).add(room.position);
          const n = wall.userData.normal;
          const denom = dir.dot(n);
          let between = false;
          if (Math.abs(denom) > 1e-6) {
            const tHit = (n.dot(wallPos) - n.dot(camPos)) / denom;
            if (tHit > 0 && tHit < Math.abs(camT)) {
              const hit = tmp2.copy(camPos).addScaledVector(dir, tHit);
              const dX = Math.abs(hit.x - wallPos.x);
              const dZ = Math.abs(hit.z - wallPos.z);
              between =
                dX < wall.userData.halfSpanX && dZ < wall.userData.halfSpanZ;
            }
          }
          const target = between ? TRANSPARENT : OPAQUE;
          wall.material.opacity += (target - wall.material.opacity) * 0.1;
        });
      }

      requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  function init() {
    if (roomConfig.enabled === false) {
      return;
    }
    window.addEventListener("sdv-ready", () => {
      try {
        loadTHREE(buildRoom);
      } catch (error) {
        console.error("room.js: falha ao criar a sala.", error);
      }
    });
  }

  init();
})();
