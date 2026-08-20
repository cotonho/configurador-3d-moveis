(function () {
  const roomConfig = (window.SD_CONFIG && window.SD_CONFIG.room) || {};
  const THREE_URL = "https://unpkg.com/three@0.160.0/build/three.min.js";

  const wallCulling = roomConfig.wallCulling || {};
  const WALL_CULLING_ENABLED = wallCulling.enabled !== false;
  const UNITS_PER_M = roomConfig.unitsPerMeter || 100;
  const WIDTH = (roomConfig.widthM || 3.2) * UNITS_PER_M;
  const DEPTH = (roomConfig.depthM || 2.8) * UNITS_PER_M;
  const HEIGHT = (roomConfig.heightM || 2.7) * UNITS_PER_M;
  const WALL_THICKNESS = (roomConfig.wallThicknessM || 0.15) * UNITS_PER_M;
  const FLOOR_THICKNESS = (roomConfig.floorThicknessM || 0.1) * UNITS_PER_M;
  const FURNITURE_SCALE = roomConfig.furnitureScale || 1;
  const CENTER = roomConfig.furnitureCenter || [0, 0.9, 0];

  function makeWoodTexture(THREE) {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const planks = 4;
    const plank = size / planks;
    for (let i = 0; i < planks; i++) {
      for (let j = 0; j < planks; j++) {
        const base = 170 + Math.round(Math.random() * 40);
        const r = base;
        const g = Math.round(base * 0.84);
        const b = Math.round(base * 0.62);
        const grad = ctx.createLinearGradient(0, j * plank, 0, (j + 1) * plank);
        grad.addColorStop(0, "rgb(" + r + "," + g + "," + b + ")");
        grad.addColorStop(
          1,
          "rgb(" +
            Math.round(r * 0.9) +
            "," +
            Math.round(g * 0.9) +
            "," +
            Math.round(b * 0.9) +
            ")"
        );
        ctx.fillStyle = grad;
        ctx.fillRect(i * plank, j * plank, plank, plank);
        ctx.strokeStyle = "rgba(60,40,20,0.55)";
        ctx.lineWidth = 2;
        ctx.strokeRect(i * plank, j * plank, plank, plank);
        for (let k = 0; k < 5; k++) {
          const y = j * plank + (k + 1) * (plank / 6);
          ctx.strokeStyle = "rgba(120,90,50,0.25)";
          ctx.beginPath();
          ctx.moveTo(i * plank, y);
          ctx.lineTo((i + 1) * plank, y);
          ctx.stroke();
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(
      Math.max(1, Math.round(WIDTH / 160)),
      Math.max(1, Math.round(DEPTH / 160))
    );
    return texture;
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
      console.error("room.js: nao foi possivel carregar three.js de " + THREE_URL);
    document.head.appendChild(script);
  }

  function buildRoom(THREE) {
    const viewport = window.shapediverAPI.getViewport();
    if (!viewport) {
      throw new Error("Viewport indisponivel para criar a sala.");
    }
    if (viewport.groundPlaneVisibility !== undefined) {
      viewport.groundPlaneVisibility = false;
    }
    if (viewport.contactShadowVisibility !== undefined) {
      viewport.contactShadowVisibility = false;
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
      color: 0xffffff,
      map: makeWoodTexture(THREE),
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(WIDTH, DEPTH, FLOOR_THICKNESS),
      floorMat
    );
    floor.position.z = -FLOOR_THICKNESS / 2;
    room.add(floor);

    const wallDefs = [
      { pos: [0, -DEPTH / 2 + WALL_THICKNESS / 2, HEIGHT / 2], size: [WIDTH, WALL_THICKNESS, HEIGHT], normal: [0, 1, 0], name: "back", along: "x", halfAlong: WIDTH / 2, halfZ: HEIGHT / 2 },
      { pos: [-WIDTH / 2 + WALL_THICKNESS / 2, 0, HEIGHT / 2], size: [WALL_THICKNESS, DEPTH, HEIGHT], normal: [1, 0, 0], name: "left", along: "y", halfAlong: DEPTH / 2, halfZ: HEIGHT / 2 },
      { pos: [WIDTH / 2 - WALL_THICKNESS / 2, 0, HEIGHT / 2], size: [WALL_THICKNESS, DEPTH, HEIGHT], normal: [-1, 0, 0], name: "right", along: "y", halfAlong: DEPTH / 2, halfZ: HEIGHT / 2 }
    ];

    const walls = wallDefs.map((def) => {
      const mat = new THREE.MeshStandardMaterial({
        color: roomConfig.wallColor || 0xe4dfd6,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0
      });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(def.size[0], def.size[1], def.size[2]),
        mat
      );
      mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
      mesh.userData = {
        normal: new THREE.Vector3(...def.normal),
        name: def.name,
        along: def.along,
        halfSpanAlong: def.halfAlong,
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
    const floorTarget = new THREE.Vector3();
    floorTarget.copy(center);
    floorTarget.z = room.position.z + 1;
    const tmp = new THREE.Vector3();
    const tmp3 = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const hit = new THREE.Vector3();
    const furnitureBox = new THREE.Box3();
    let lastCenterUpdate = 0;
    const targetVec = new THREE.Vector3();
    let probeSlider = null;

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

    function createProbe() {
      if (probeSlider || roomConfig.debug !== true) {
        return;
      }
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;left:16px;bottom:20px;z-index:20;font:11px monospace;color:#1d2733;background:rgba(255,255,255,0.85);padding:4px 10px;border-radius:8px;border:1px solid #dfe5ec;display:flex;align-items:center;gap:8px;";
      const label = document.createElement("span");
      label.textContent = "dist alvo:";
      probeSlider = document.createElement("input");
      probeSlider.type = "range";
      probeSlider.min = "0";
      probeSlider.max = "2000";
      probeSlider.step = "0.5";
      probeSlider.value = "1000";
      probeSlider.style.width = "240px";
      probeSlider.addEventListener("input", () => {
        const d = Number(probeSlider.value);
        const toTarget = tmp3.copy(targetVec).sub(camPos);
        if (toTarget.lengthSq() > 1e-9) {
          toTarget.normalize();
        }
        camPos.copy(targetVec).addScaledVector(toTarget, -d);
        camera.position = [camPos.x, camPos.y, camPos.z];
      });
      el.append(label, probeSlider);
      document.body.appendChild(el);
    }

    function updateDebug(box, limit) {
      if (roomConfig.debug !== true) {
        return;
      }
      if (!debugEl) {
        debugEl = document.createElement("div");
        debugEl.id = "room-debug";
        debugEl.style.cssText =
          "position:absolute;left:16px;bottom:64px;z-index:20;font:11px monospace;color:#1d2733;background:rgba(255,255,255,0.85);padding:6px 10px;border-radius:8px;border:1px solid #dfe5ec;white-space:pre;";
        document.body.appendChild(debugEl);
      }
      createProbe();
      const wallsState = walls
        .map((w) => w.userData.name + ":" + (w.userData.hidden ? "S" : "N"))
        .join(" ");
      debugEl.textContent =
        "cam(" +
        camPos.x.toFixed(0) +
        "," +
        camPos.y.toFixed(0) +
        "," +
        camPos.z.toFixed(0) +
        ") | dist: " +
        camPos.distanceTo(targetVec).toFixed(0) +
        " | chao(z): " +
        room.position.z.toFixed(0) +
        " | pes(z): " +
        box.min.z.toFixed(0) +
        " | gap: " +
        (box.min.z - room.position.z).toFixed(0) +
        " | lim: " +
        Math.round(limit) +
        " | paredes: " +
        wallsState;
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
      const limit = furnitureDiagLimit();
      hideScenery(limit);
      box.getCenter(center);
      floorTarget.copy(center);
      floorTarget.z = room.position.z + 1;
      updateDebug(box, limit);
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

    function update() {
      updateFurnitureCenter(performance.now());
      vec3Of(
        camera.position ||
        camera.worldPosition ||
        (camera.matrixWorld
          ? new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)
          : new THREE.Vector3()),
        camPos
      );
      if (camera.target !== undefined) {
        vec3Of(camera.target, targetVec);
      }
      if (probeSlider && probeSlider !== document.activeElement) {
        probeSlider.value = String(camPos.distanceTo(targetVec));
      }

      if (WALL_CULLING_ENABLED) {
        const targets = [center, floorTarget];
        walls.forEach((wall) => {
          const wallPos = tmp3.copy(wall.position).add(room.position);
          const n = wall.userData.normal;
          const nPlane = n.dot(wallPos);
          let between = false;

          for (let i = 0; i < targets.length && !between; i++) {
            const target = targets[i];
            const lineDir = tmp.copy(target).sub(camPos);
            const denom = lineDir.dot(n);
            if (Math.abs(denom) < 1e-6) {
              continue;
            }

            const camSide = n.dot(camPos) - nPlane;
            const tgtSide = n.dot(target) - nPlane;
            if (camSide * tgtSide >= 0) {
              continue;
            }

            const tLine = (nPlane - n.dot(camPos)) / denom;
            hit.copy(camPos).addScaledVector(lineDir, tLine);
            const along = wall.userData.along;
            const dAlong = Math.abs(hit[along] - wallPos[along]);
            const dZ = Math.abs(hit.z - wallPos.z);
            between =
              dAlong < wall.userData.halfSpanAlong &&
              dZ < wall.userData.halfSpanZ;
          }

          wall.userData.hidden = between;
          wall.visible = !between;
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
