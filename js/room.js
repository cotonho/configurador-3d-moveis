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
  // Conversão explícita unidade-do-modelo -> unidade-da-sala.
  // Ex.: modelo em polegadas + sala em cm/m (unitsPerMeter) = 0.0254 * 100.
  const METERS_PER_MODEL_UNIT = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 };
  function defaultFurnitureScale() {
    const u = String(roomConfig.modelUnits || "in").toLowerCase();
    const m = METERS_PER_MODEL_UNIT[u];
    if (!m) {
      console.warn('[ROOM] modelUnits desconhecido: "' + u + '", usando escala 1');
      return 1;
    }
    return UNITS_PER_M * m;
  }
  const FURNITURE_SCALE = roomConfig.furnitureScale || defaultFurnitureScale();
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
    const roomRoot = new THREE.Group();
    roomRoot.name = "room-root";
    scene.add(roomRoot);
    window._roomRoot = roomRoot;
    const ROOM_LIMIT = { x: WIDTH / 2, y: DEPTH / 2, z: HEIGHT / 2 };
    window._roomLimits = ROOM_LIMIT;
    window._clampRoomRoot = function () {
      roomRoot.position.x = Math.max(-ROOM_LIMIT.x, Math.min(ROOM_LIMIT.x, roomRoot.position.x));
      roomRoot.position.y = Math.max(-ROOM_LIMIT.y, Math.min(ROOM_LIMIT.y, roomRoot.position.y));
      roomRoot.position.z = Math.max(-ROOM_LIMIT.z, Math.min(ROOM_LIMIT.z, roomRoot.position.z));
    };
    const scaledFurniture = [];

    const room = new THREE.Group();
    room.name = "room-frontend";
    roomRoot.add(room);

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
      { pos: [0, DEPTH / 2 - WALL_THICKNESS / 2, HEIGHT / 2], size: [WIDTH, WALL_THICKNESS, HEIGHT], normal: [0, -1, 0], name: "front", along: "x", halfAlong: WIDTH / 2, halfZ: HEIGHT / 2 },
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

    const camera = viewport.camera;
    if (!camera) {
      return;
    }

    const center = new THREE.Vector3(CENTER[0], CENTER[1], CENTER[2]);
    const floorTarget = new THREE.Vector3();
    floorTarget.copy(center);
    floorTarget.z = roomRoot.position.z + 1;
    const tmp = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const viewDirV = new THREE.Vector3();
    const relV = new THREE.Vector3();
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

    // Escala acumulada dos ancestrais até a cena (para normalizar medidas).
    function worldScaleOf(obj) {
      let s = 1;
      let c = obj;
      while (c && c !== scene) {
        if (c.scale && c.scale.x) s *= c.scale.x;
        c = c.parent;
      }
      return s || 1;
    }

    // Diagonal da malha em unidades do MODELO (divide a escala acumulada).
    // Estável mesmo depois de escalarmos grupos: o limite nunca explode.
    function modelDiagOf(mesh) {
      const b = new THREE.Box3();
      b.setFromObject(mesh);
      return b.getSize(new THREE.Vector3()).length() / worldScaleOf(mesh);
    }

    function furnitureDiagLimit() {
      const diags = [];
      const meshes = [];
      collectMeshes(scene, meshes);
      meshes.forEach((mesh) => {
        diags.push(modelDiagOf(mesh));
      });
      diags.sort((a, b) => a - b);
      if (!diags.length) {
        return Infinity;
      }
      const median = diags[Math.floor(diags.length / 2)];
      return Math.max(median * (roomConfig.sceneryRatio || 4), 100);
    }

    window._debugFurnitureBox = function () {
      const box = computeFurnitureBox();
      if (!box) return null;
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      return { cx: c.x, cy: c.y, cz: c.z, sx: s.x, sy: s.y, sz: s.z };
    };

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

    // Subárvore com câmera/luz do SDV: nunca tocar (shadow rig etc).
    function hasCameraOrLight(obj) {
      if (!obj) return false;
      if (obj.isCamera || obj.isLight) return true;
      const kids = obj.children;
      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          if (hasCameraOrLight(kids[i])) return true;
        }
      }
      return false;
    }

    // Escala o mobiliário NO LUGAR (sem reparentar: os grupos pertencem ao
    // SDV e ele restaura a hierarquia — briga perdida). Desce recursivamente:
    // subárvore só com malhas = candidata (escala como unidade); subárvore
    // mista (com câmera/luz, ex. shadow rig) = desce sem tocar nas malhas
    // soltas dela. Centro preservado e pés no piso. Reaplicado se o SDV
    // resetar transforms num customize.
    function measureKept(kept) {
      const b = new THREE.Box3();
      kept.forEach((mesh) => {
        b.union(new THREE.Box3().setFromObject(mesh));
      });
      return b;
    }

    function applyFurnitureScale(node, kept, s, floorTop) {
      node.userData = node.userData || {};
      const q0 = (node.scale && node.scale.x) || 1;
      const ps = worldScaleOf(node) / q0;
      const inv = 1 / (ps || 1);
      if (Math.abs(ps * q0 - s) < 1e-9 && node.userData._furnScaled === s) {
        if (node.userData._floorZ !== floorTop) {
          const bz = measureKept(kept);
          if (!bz.isEmpty()) {
            node.position.z += (floorTop - bz.min.z) * inv;
            node.updateMatrixWorld(true);
          }
          node.userData._floorZ = floorTop;
        }
        if (scaledFurniture.indexOf(node) === -1) scaledFurniture.push(node);
        return;
      }
      const b0 = measureKept(kept);
      if (b0.isEmpty()) return;
      const c0 = b0.getCenter(new THREE.Vector3());
      node.scale.setScalar(s / (ps || 1));
      node.updateMatrixWorld(true);
      const b1 = measureKept(kept);
      if (b1.isEmpty()) return;
      const c1 = b1.getCenter(new THREE.Vector3());
      node.position.x += (c0.x - c1.x) * inv;
      node.position.y += (c0.y - c1.y) * inv;
      node.position.z += (floorTop - b1.min.z) * inv;
      node.updateMatrixWorld(true);
      node.userData._furnScaled = s;
      node.userData._floorZ = floorTop;
      if (scaledFurniture.indexOf(node) === -1) scaledFurniture.push(node);
      console.log('[ROOM] movel escalado x' + s + ': ' + (node.name || node.type) +
        ' box=' + Math.round(c0.x) + ',' + Math.round(c0.y));
    }

    function processFurnitureNode(node, s, limit, floorTop, inMixedRig) {
      if (!node || node === roomRoot || node === room) return;
      if (node.isCamera || node.isLight) return;
      if (node.isMesh) {
        if (inMixedRig || !node.geometry) return;
        if (modelDiagOf(node) > limit) return;
        applyFurnitureScale(node, [node], s, floorTop);
        return;
      }
      const kids = node.children ? node.children.slice() : [];
      if (!kids.length) return;
      if (!hasCameraOrLight(node)) {
        const meshes = [];
        collectMeshes(node, meshes);
        const kept = meshes.filter((mesh) => modelDiagOf(mesh) <= limit);
        if (!kept.length) return;
        applyFurnitureScale(node, kept, s, floorTop);
        return;
      }
      kids.forEach((k) => processFurnitureNode(k, s, limit, floorTop, true));
    }

    function ensureFurnitureScaled() {
      const s = FURNITURE_SCALE;
      if (!(s > 0)) return;
      const limit = furnitureDiagLimit();
      const floorTop = roomRoot.position.z + room.position.z;
      scene.children.slice().forEach((child) => {
        processFurnitureNode(child, s, limit, floorTop, false);
      });
      for (let i = scaledFurniture.length - 1; i >= 0; i--) {
        if (!scaledFurniture[i].parent) scaledFurniture.splice(i, 1);
      }
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
        const toTarget = tmp.copy(targetVec).sub(camPos);
        if (toTarget.lengthSq() > 1e-9) {
          toTarget.normalize();
        }
        camPos.copy(targetVec).addScaledVector(toTarget, -d);
        camera.position = [camPos.x, camPos.y, camPos.z];
      });
      el.append(label, probeSlider);
      document.body.appendChild(el);
      createRoomSliders();
    }

    function createRoomSliders() {
      const panel = document.createElement("div");
      panel.style.cssText =
        "position:absolute;left:16px;bottom:56px;z-index:20;font:11px monospace;color:#1d2733;background:rgba(255,255,255,0.85);padding:6px 10px;border-radius:8px;border:1px solid #dfe5ec;display:flex;flex-direction:column;gap:4px;";

      function makeSlider(label, axis, min, max) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:6px;";
        const lbl = document.createElement("span");
        lbl.textContent = label + ":";
        lbl.style.width = "28px";
        const val = document.createElement("span");
        val.style.width = "50px";
        val.textContent = "0";
        const sl = document.createElement("input");
        sl.type = "range";
        sl.min = String(min);
        sl.max = String(max);
        sl.step = "1";
        sl.value = "0";
        sl.style.width = "160px";
        sl.addEventListener("input", () => {
          const v = Number(sl.value);
          const old = roomRoot.position[axis];
          roomRoot.position[axis] = v;
          if (typeof window._clampRoomRoot === "function") window._clampRoomRoot();
          const applied = roomRoot.position[axis] - old;
          // Mantém o pivô (foco) colado na sala: translada o target junto.
          if (applied !== 0 && viewport && viewport.camera) {
            const idx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
            const t = viewport.camera.target;
            if (t && typeof t.length === "number" && t.length >= 3) {
              const nt = [t[0], t[1], t[2]];
              nt[idx] += applied;
              viewport.camera.target = nt;
            }
          }
          // Move o mobiliário junto (translação simples, sem tocar na escala;
          // grupos mortos de customize são podados).
          if (applied !== 0) {
            for (let i = scaledFurniture.length - 1; i >= 0; i--) {
              const g = scaledFurniture[i];
              if (!g.parent) {
                scaledFurniture.splice(i, 1);
                continue;
              }
              if (axis === "x") g.position.x += applied;
              else if (axis === "y") g.position.y += applied;
              else g.position.z += applied;
            }
          }
          sl.value = String(Math.round(roomRoot.position[axis]));
          val.textContent = sl.value;
        });
        row.append(lbl, val, sl);
        return row;
      }

      panel.append(
        makeSlider("X", "x", -Math.round(WIDTH / 2), Math.round(WIDTH / 2)),
        makeSlider("Y", "y", -Math.round(DEPTH / 2), Math.round(DEPTH / 2)),
        makeSlider("Z", "z", -Math.round(HEIGHT / 2), Math.round(HEIGHT / 2))
      );
      document.body.appendChild(panel);
    }

    function updateDebug(box, limit) {
      if (roomConfig.debug !== true) {
        return;
      }
      if (!debugEl) {
        debugEl = document.createElement("div");
        debugEl.id = "room-debug";
        debugEl.style.cssText =
          "position:absolute;left:16px;bottom:140px;z-index:20;font:11px monospace;color:#1d2733;background:rgba(255,255,255,0.85);padding:6px 10px;border-radius:8px;border:1px solid #dfe5ec;white-space:pre;";
        document.body.appendChild(debugEl);
      }
      createProbe();
      const wallsState = walls
        .map((w) => w.userData.name + ":" + (w.userData.hidden ? "S" : "N"))
        .join(" ");
      const wallPositions = walls
        .map((w) => {
          const p = tmp.copy(w.position).add(room.position).add(roomRoot.position);
          return (
            w.userData.name +
            ":" +
            (w.userData.along === "x"
              ? "y=" + Math.round(p.y)
              : "x=" + Math.round(p.x))
          );
        })
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
        " | sala: " +
        Math.round(WIDTH) +
        "x" +
        Math.round(DEPTH) +
        "x" +
        Math.round(HEIGHT) +
        " | " +
        wallPositions +
        " | parede(z): " +
        Math.round(HEIGHT / 2) +
        " | chao(z): " +
        roomRoot.position.z.toFixed(0) +
        " | pes(z): " +
        box.min.z.toFixed(0) +
        " | gap: " +
        (box.min.z - roomRoot.position.z).toFixed(0) +
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
        mesh.visible = modelDiagOf(mesh) <= limit;
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
      ensureFurnitureScaled();
      const box = computeFurnitureBox();
      if (!box) {
        return;
      }
      const limit = furnitureDiagLimit();
      hideScenery(limit);
      box.getCenter(center);
      floorTarget.copy(center);
      floorTarget.z = roomRoot.position.z + 1;
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
        const roomWorld = room.getWorldPosition(tmp);
        const cx = roomWorld.x;
        const cy = roomWorld.y;
        // Yaw da sala (eixo Y local no mundo) para testar os lados no
        // referencial da sala. Ignora o tilt (limitado a ~28°, efeito pequeno).
        tmp.set(0, 1, 0).applyQuaternion(roomRoot.quaternion);
        const yaw = Math.atan2(-tmp.x, tmp.y);
        const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
        const relX = camPos.x - cx, relY = camPos.y - cy;
        const lx = cyaw * relX + syaw * relY;
        const ly = -syaw * relX + cyaw * relY;
        const sideMargin =
          typeof wallCulling.sideMargin === "number" ? wallCulling.sideMargin : 0;
        walls.forEach((wall) => {
          let hidden = false;
          if (wall.userData.name === "back") {
            hidden = ly < 0;
          } else if (wall.userData.name === "front") {
            hidden = ly > 0;
          } else if (wall.userData.name === "left") {
            hidden = lx < -sideMargin;
          } else if (wall.userData.name === "right") {
            hidden = lx > sideMargin;
          }
          wall.userData.hidden = hidden;
          wall.visible = !hidden;
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
