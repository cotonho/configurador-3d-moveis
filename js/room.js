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
  const warnedUnits = {};
  function scaleForUnit(u) {
    const key = String(u || roomConfig.modelUnits || "in").toLowerCase();
    const m = METERS_PER_MODEL_UNIT[key];
    if (!m) {
      if (!warnedUnits[key]) {
        warnedUnits[key] = true;
        console.warn('[ROOM] modelUnits desconhecido: "' + key + '", usando escala 1');
      }
      return 1;
    }
    return UNITS_PER_M * m;
  }
  function defaultFurnitureScale() {
    return scaleForUnit();
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
    window._furnitureGroups = scaledFurniture;

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
    // Math.abs: ancestral espelhado (escala negativa) gerava diag negativa,
    // que passava no filtro (<= limite) e poluía a união com o piso 400x400.
    function modelDiagOf(mesh) {
      const b = new THREE.Box3();
      b.setFromObject(mesh);
      return Math.abs(b.getSize(new THREE.Vector3()).length() / worldScaleOf(mesh));
    }

    // Percentil alto (p90) das diagonais em UNIDADES DO MODELO: modelos com
    // muitos meshes pequenos (parafusos, pes) e poucos paineis grandes nao
    // tem mais a mediana ancorada nos pequenos. Trava minima 100 mantida.
    // Retorna objeto: p90 em unidades do modelo + teto absoluto em cm (rede
    // contra cenario embutido gigante que passe no percentil).
    // Teto configuravel: roomConfig.maxFurniturePieceCm (default 400).
    function limitForMeshes(meshes) {
      const absCm = roomConfig.maxFurniturePieceCm || 400;
      if (!meshes.length) {
        return { p90: Infinity, absCm: absCm };
      }
      const diags = meshes
        .map((mesh) => modelDiagOf(mesh))
        .sort((a, b) => a - b);
      const p90 = diags[Math.min(diags.length - 1, Math.floor(diags.length * 0.9))];
      return {
        p90: Math.max(p90 * (roomConfig.sceneryRatio || 4), 100),
        absCm: absCm,
      };
    }

    // Box só com meshes aprovados no filtro (mesmo critério da escala e das
    // cotas): setFromObject cru incluiria gigantes espúrios (piso espelhado,
    // decoração) e contaminaria ocupação/spawn com área fantasma — a espiral
    // não acha ponto livre e tudo cai no fallback do centro.
    function filteredBoxFor(node) {
      const meshes = [];
      if (node.isMesh === true && node.geometry) meshes.push(node);
      else collectMeshes(node, meshes);
      const box = new THREE.Box3();
      if (!meshes.length) return box;
      const limit = limitForMeshes(meshes);
      // cm/unidade da sessão dona (sobe até raiz conhecida); cai no global.
      let cpu = FURNITURE_SCALE > 0 ? FURNITURE_SCALE : 1;
      let c = node;
      while (c) {
        if (lastSessionScales.has(c)) {
          cpu = lastSessionScales.get(c);
          break;
        }
        c = c.parent;
      }
      meshes.forEach((mesh) => {
        if (mesh.isMesh !== true || !mesh.geometry) return;
        if (!meshFilterResult(mesh, limit, cpu).kept) return;
        box.union(furnitureBox.setFromObject(mesh));
      });
      if (box.isEmpty()) {
        // Nada passou no filtro: usa a crua para o grupo não sumir do mapa.
        box.union(new THREE.Box3().setFromObject(node));
      }
      return box;
    }

    // Box filtrada p/ colisão no arrasto (mesmo critério do spawn/cotas).
    window.furnitureCollisionBox = filteredBoxFor;

    // cm por unidade do modelo de uma sessao (p/ converter o diag estimado).
    function cmPerUnitForUnits(units) {
      const sc = scaleForUnit(units || roomConfig.modelUnits || "in");
      return sc > 0 ? sc : 1;
    }

    // Filtro duplo p/ um mesh: percentil (em unidades do modelo) + teto
    // absoluto (diag estimado em cm). kept=false vem com o motivo.
    function meshFilterResult(mesh, f, cmPerUnit) {
      const d = modelDiagOf(mesh);
      const cm = d * (cmPerUnit > 0 ? cmPerUnit : 1);
      if (d > f.p90) return { kept: false, reason: "percentil", d: d, cm: cm };
      if (cm > f.absCm) return { kept: false, reason: "teto_absoluto", d: d, cm: cm };
      return { kept: true, reason: null, d: d, cm: cm };
    }

    function furnitureDiagLimit() {
      const meshes = [];
      collectMeshes(scene, meshes);
      return limitForMeshes(meshes);
    }

    // Limite dentro da subárvore (mediana local): um modelo gigante não
    // contamina o filtro do outro.
    function limitForRoot(rootObj) {
      const meshes = [];
      collectMeshes(rootObj, meshes);
      return limitForMeshes(meshes);
    }

    window._debugFurnitureBox = function () {
      const box = computeFurnitureBox();
      if (!box) return null;
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      return { cx: c.x, cy: c.y, cz: c.z, sx: s.x, sy: s.y, sz: s.z };
    };

    // Raízes do móvel selecionado (para cotas por seleção). null = tudo.
    function selectedFurnitureRoots() {
      let entry = null;
      if (typeof window.getSelectedFurniture === "function") {
        try {
          entry = window.getSelectedFurniture();
        } catch (e) {
          entry = null;
        }
      }
      if (!entry) return null;
      // Raiz viva primeiro (cobre entradas registradas com root estatico):
      // mesmo padrão de move/rotate/ownerOf.
      if (typeof entry.getRoot === "function") {
        try {
          const r = entry.getRoot();
          if (r && r.parent) return [r];
        } catch (e) {}
      }
      if (Array.isArray(entry.roots)) {
        const r = entry.roots.filter((g) => g && g.parent);
        return r.length ? r : [];
      }
      if (entry.root && entry.root.parent) return [entry.root];
      return null;
    }

    function computeFurnitureBox(roots) {
      const meshes = [];
      if (roots && roots.length) {
        roots.forEach((r) => {
          if (r.isMesh && r.geometry) meshes.push(r);
          else collectMeshes(r, meshes);
        });
      } else if (!roots) {
        collectMeshes(scene, meshes);
      }
      if (!meshes.length) {
        return null;
      }
      // Mede com o yaw zerado (temporário): AABB de caixa girada infla e
      // desgirar os cantos depois NÃO recupera o real (180/41 a 60° vira
      // 215.5/196.9 — provado). Restaura tudo em finally, sem render no meio.
      // Usa modelDiagOf no filtro (unidades do modelo, como o limite).
      const saved = [];
      scaledFurniture.forEach((g) => {
        if (!g.parent) return;
        g.userData = g.userData || {};
        const base =
          typeof g.userData._rotBase === "number" ? g.userData._rotBase : null;
        if (base === null || g.rotation.z === base) return;
        saved.push([g, g.rotation.z]);
        g.rotation.z = base;
        g.updateMatrixWorld(true);
      });
      try {
        const limit = limitForMeshes(meshes);
        // cm/unidade por raiz de sessao (cache do passe): o teto absoluto
        // precisa do diag em cm, e cada sessao tem sua propria unidade.
        const scaleByRoot = lastSessionScales;
        const cmPerUnitOf = (mesh) => {
          let c = mesh;
          while (c) {
            if (scaleByRoot.has(c)) return scaleByRoot.get(c);
            c = c.parent;
          }
          return FURNITURE_SCALE > 0 ? FURNITURE_SCALE : 1;
        };
        const verbose = window.__DIM_VERBOSE === true;
        if (verbose) {
          console.log('[DIM-MESH] grupos em _furnitureGroups: ' +
            scaledFurniture.map((g) => (g.name || g.type) + '#' + String(g.uuid).slice(0, 8)).join(' | '));
          console.log('[DIM-MESH] limite p90=' + Math.round(limit.p90) + ' teto_cm=' + limit.absCm + ' totalMeshes=' + meshes.length);
        }
        const box = new THREE.Box3();
        let used = 0;
        meshes.forEach((mesh) => {
          if (mesh.isMesh !== true) {
            if (verbose) {
              console.log('[DIM-MESH] NAO-MESH pulado:', mesh.type,
                '#' + String(mesh.uuid).slice(0, 8));
            }
            return;
          }
          const fr = meshFilterResult(mesh, limit, cmPerUnitOf(mesh));
          const kept = fr.kept;
          if (verbose) {
            let top = mesh.parent;
            while (top && top.parent && top.parent !== scene) top = top.parent;
            console.log('[DIM-MESH]', mesh.name || mesh.type,
              'ctor=' + (mesh.constructor && mesh.constructor.name),
              '#' + String(mesh.uuid).slice(0, 8),
              'top=' + (top ? (top.name || top.type) : '?'),
              'diag=' + Math.round(fr.d),
              'diag_cm=' + Math.round(fr.cm),
              kept ? 'INCLUIDA' : 'excluida(' + fr.reason + ')');
          }
          if (!kept) {
            return;
          }
          box.union(furnitureBox.setFromObject(mesh));
          used++;
        });
        return used ? box : null;
      } finally {
        saved.forEach(([g, rz]) => {
          g.rotation.z = rz;
          g.updateMatrixWorld(true);
        });
      }
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
        return false;
      }
      const b0 = measureKept(kept);
      if (b0.isEmpty()) return false;
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
      // Spawn só na primeira vez (sem posição salva): re-escalas posteriores
      // (SDV resetou transforms) mantêm o grupo fora de scaledThisPass, para
      // não contaminar a união do spawn com móveis já posicionados. A posição
      // é mantida pelo bloco de restauração via _wantXY.
      if (!node.userData._wantXY) scaledThisPass.push(node);
      diagLog('[ROOM] movel escalado x' + s + ': ' + (node.name || node.type) +
        ' box=' + Math.round(c0.x) + ',' + Math.round(c0.y));
      return true;
    }

    function processFurnitureNode(node, s, limit, floorTop, inMixedRig) {
      if (!node || node === roomRoot || node === room) return false;
      if (node.isCamera || node.isLight) return false;
      if (node.isMesh) {
        if (inMixedRig || !node.geometry) return false;
        const fr = meshFilterResult(node, limit, s);
        if (!fr.kept) {
          if (window.__DIM_VERBOSE === true) {
            console.log('[FILTRO] excluida(' + fr.reason + '):',
              node.name || node.type,
              '#' + String(node.uuid).slice(0, 8),
              'diag=' + Math.round(fr.d) + ' diag_cm=' + Math.round(fr.cm));
          }
          return false;
        }
        return applyFurnitureScale(node, [node], s, floorTop);
      }
      const kids = node.children ? node.children.slice() : [];
      if (!kids.length) return false;
      if (!hasCameraOrLight(node)) {
        const meshes = [];
        collectMeshes(node, meshes);
        const kept = meshes.filter((mesh) => meshFilterResult(mesh, limit, s).kept);
        if (!kept.length) return false;
        return applyFurnitureScale(node, kept, s, floorTop);
      }
      let any = false;
      kids.forEach((k) => {
        if (processFurnitureNode(k, s, limit, floorTop, true)) any = true;
      });
      return any;
    }

    let scaledThisPass = [];
    // Cache raiz-de-sessao -> cm/unidade, atualizado a cada passe em
    // ensureFurnitureScaled (que ja resolve sessionTopRoots). Usado pelo
    // teto absoluto em cm nos pontos de filtro fora do caminho por-sessao.
    let lastSessionScales = new Map();

    // Última pose desejada por ID de sessão: [x, y, rotZ, meio-largura,
    // meio-profundidade]. O tamanho antigo permite reancorar a mesma borda
    // de parede após crescer (não o centro). Sobrevive à troca de identidade
    // dos objetos 3D (rebuild após customize).
    const lastKnownXYBySession = new Map();

    // Log de diagnóstico: só aparece com window.__DIM_VERBOSE = true.
    // Os logs de instrumentação da fase multi-sessão usam este helper para
    // não poluir o console em uso normal.
    function diagLog() {
      if (window.__DIM_VERBOSE === true) {
        console.log.apply(console, arguments);
      }
    }
    // Sessões com raiz 3D resolvida (preguiçoso: só após os outputs).
    function sessionTopRoots() {
      const out = [];
      try {
        const api = window.shapediverAPI;
        if (api && viewport && typeof api.getSessions === "function") {
          api.getSessions().forEach((s, i) => {
            let root = null;
            let nodePresent = false;
            let cvKeys = [];
            try {
              const node = s.session && s.session.node;
              nodePresent = !!node;
              const cv = node && node.convertedObject;
              if (cv) {
                try {
                  cvKeys = Object.keys(cv);
                } catch (e) {
                  cvKeys = ["(keys-falhou)"];
                }
                root = cv[viewport.id] || null;
              }
            } catch (e) {
              root = null;
            }
            if (window.__DIM_VERBOSE === true) {
              console.log('[ROOT] sessao=' + s.id +
                ' node=' + (nodePresent ? 'presente' : 'ausente') +
                ' convertedObject.keys=[' + cvKeys.join(',') + ']' +
                ' viewport.id=' + viewport.id +
                ' root_resolvido=' + !!root);
            }
            out.push({ index: i, id: s.id, units: s.modelUnits, root: root });
          });
        }
      } catch (e) {}
      return out;
    }

    // O top-level contem conteudo de alguma sessao aninhado abaixo dele?
    // Tops compartilhados pelo SDV nunca sao escalados como unidade: cada
    // sessao eh processada direto pela propria raiz (ver ensureFurnitureScaled).
    function topHoldsSessionContent(child, sessions) {
      if (!child || !child.children || !child.children.length) return false;
      const stack = child.children.slice();
      while (stack.length) {
        const n = stack.pop();
        for (const s of sessions) {
          if (s.root && n === s.root) return true;
        }
        if (n.children && n.children.length) {
          for (const k of n.children) stack.push(k);
        }
      }
      return false;
    }

    function ensureFurnitureScaled() {
      if (!(FURNITURE_SCALE > 0)) return;
      const globalLimit = furnitureDiagLimit();
      const floorTop = roomRoot.position.z + room.position.z;
      const sessions = sessionTopRoots();
      lastSessionScales = new Map();
      sessions.forEach((s) => {
        if (s.root) lastSessionScales.set(s.root, cmPerUnitForUnits(s.units));
      });
      const multiSession = sessions.length > 1;
      const verbose = window.__DIM_VERBOSE === true;
      function debugWalk(root, label) {
        if (!root) {
          console.log('[WALK] ' + label + ' root=null');
          return;
        }
        let c = root;
        const path = [c.uuid];
        while (c && c.parent && c.parent !== scene) {
          c = c.parent;
          path.push(c.uuid);
        }
        console.log('[WALK] ' + label + ' root=' + root.uuid +
          ' path=' + path.join(' -> ') +
          ' terminou_em_scene=' + (c && c.parent === scene) +
          ' final=' + (c ? c.uuid : 'null'));
      }
      if (verbose) {
        sessions.forEach((s) => {
          debugWalk(s.root, s.id);
        });
      }
      let scaledAny = false;
      scaledThisPass = [];
      // Fix por RAIZ DE SESSAO direta: cada sessao eh escalada a partir de
      // s.root com a propria unidade e o proprio limite. Tops da cena podem
      // ser compartilhados pelo SDV, entao nunca decidem escala.
      const coveredTops = new Set();
      sessions.forEach((s) => {
        if (!s.root) return;
        const u = s.units || roomConfig.modelUnits || "in";
        const sc = scaleForUnit(u);
        if (!(sc > 0)) return;
        const lim = limitForRoot(s.root);
        let c = s.root;
        while (c && c !== scene) {
          coveredTops.add(c);
          c = c.parent;
        }
        if (verbose) {
          console.log('[ROOM] sessao ' + s.id +
            ' root=' + String(s.root.uuid).slice(0, 8) + ' s=' + sc);
        }
        const nBefore = scaledThisPass.length;
        if (processFurnitureNode(s.root, sc, lim, floorTop, false)) {
          for (let i = nBefore; i < scaledThisPass.length; i++) {
            const gg = scaledThisPass[i];
            gg.userData = gg.userData || {};
            if (!gg.userData._sessId) gg.userData._sessId = s.id;
          }
          diagLog('[SCALE] sessao=' + s.id +
            ' root=' + String(s.root.uuid).slice(0, 8) +
            ' unit=' + u + ' scale=' + sc);
          scaledAny = true;
        }
      });
      // Tops restantes (rigs, sombras, grounding): escala global em sessao
      // unica; em multi-sessao pula — nunca adivinhar escala.
      scene.children.slice().forEach((child) => {
        if (child === roomRoot || child === room) return;
        if (coveredTops.has(child)) return;
        if (topHoldsSessionContent(child, sessions)) return;
        if (multiSession) {
          if (verbose) {
            console.log('[ROOM] sem dono em multi-sessao, pulando: ' +
              (child.name || child.type) + ' uuid=' + child.uuid);
          }
          return;
        }
        let s = FURNITURE_SCALE;
        let limit = globalLimit;
        if (sessions.length === 1 && sessions[0].units) {
          const sc1 = scaleForUnit(sessions[0].units);
          if (sc1 > 0) {
            s = sc1;
            if (sessions[0].root) limit = limitForRoot(sessions[0].root);
          }
        }
        const mBefore = scaledThisPass.length;
        if (processFurnitureNode(child, s, limit, floorTop, false)) {
          for (let i = mBefore; i < scaledThisPass.length; i++) {
            const gg = scaledThisPass[i];
            gg.userData = gg.userData || {};
            if (!gg.userData._sessId) {
              gg.userData._sessId = sessions.length === 1 ? sessions[0].id : '(global)';
            }
          }
          scaledAny = true;
        }
      });
      // Posiciona grupos recém-escalados num ponto livre da sala: sem
      // sobrepor o que já está posicionado e sem sair das paredes. Só roda
      // para escala fresca neste passe — arranjo do usuário nunca é puxado.
      // Primeira candidata: ficar onde nasceu (dx=0); depois, espiral.
      if (scaledAny && scaledThisPass.length) {
        const cfg = (window.SD_CONFIG && window.SD_CONFIG.room) || {};
        const wall =
          (cfg.wallThicknessM || 0.15) * (cfg.unitsPerMeter || 100);
        const GAP = 20;
        const baseX = roomRoot.position.x + room.position.x;
        const baseY = roomRoot.position.y + room.position.y;
        const occ = [];
        scaledFurniture.forEach((g) => {
          if (!g.parent || scaledThisPass.indexOf(g) !== -1) return;
          const ob = filteredBoxFor(g);
          if (!ob.isEmpty()) occ.push(ob);
        });
        const fresh = scaledThisPass.filter((g) => g.parent);
        if (fresh.length) {
          const ub = new THREE.Box3();
          fresh.forEach((g) => {
            const gb = filteredBoxFor(g);
            diagLog('[SPAWN] fresh grupo=' + (g.name || g.type) +
              ' #' + String(g.uuid).slice(0, 8) +
              ' sessao=' + ((g.userData && g.userData._sessId) || '?') +
              ' box=[' + Math.round(gb.min.x) + ',' + Math.round(gb.min.y) + ',' + Math.round(gb.min.z) +
              ']..[' + Math.round(gb.max.x) + ',' + Math.round(gb.max.y) + ',' + Math.round(gb.max.z) + ']');
            ub.union(gb);
          });
          if (!ub.isEmpty()) {
            const uc = ub.getCenter(new THREE.Vector3());
            const hw = (ub.max.x - ub.min.x) / 2;
            const hd = (ub.max.y - ub.min.y) / 2;
            const minCX = -ROOM_LIMIT.x + wall + hw;
            const maxCX = ROOM_LIMIT.x - wall - hw;
            const minCY = -ROOM_LIMIT.y + wall + hd;
            const maxCY = ROOM_LIMIT.y - wall - hd;
            diagLog('[SPAWN] uniao uc=' + Math.round(uc.x) + ',' + Math.round(uc.y) + ',' + Math.round(uc.z) +
              ' hw=' + Math.round(hw) + ' hd=' + Math.round(hd) +
              ' salaX=[' + Math.round(-ROOM_LIMIT.x) + ',' + Math.round(ROOM_LIMIT.x) + ']' +
              ' salaY=[' + Math.round(-ROOM_LIMIT.y) + ',' + Math.round(ROOM_LIMIT.y) + ']' +
              ' wall=' + Math.round(wall) +
              ' cxRange=[' + Math.round(minCX) + ',' + Math.round(maxCX) + ']' +
              ' cyRange=[' + Math.round(minCY) + ',' + Math.round(maxCY) + ']' +
              ' base=' + Math.round(baseX) + ',' + Math.round(baseY) +
              ' occ=' + occ.length);
            const fits = (cx, cy) =>
              cx >= minCX && cx <= maxCX && cy >= minCY && cy <= maxCY;
            const clearOf = (cx, cy) => {
              for (const o of occ) {
                if (
                  cx + hw > o.min.x - GAP &&
                  cx - hw < o.max.x + GAP &&
                  cy + hd > o.min.y - GAP &&
                  cy - hd < o.max.y + GAP
                ) {
                  return false;
                }
              }
              return true;
            };
            // Ponto antigo por sessão (sobrevive a rebuild): se todo o fresh é
            // de uma sessão com posição lembrada, tenta ela antes da espiral.
            let remembered = null;
            const freshSess = fresh.length ? ((fresh[0].userData && fresh[0].userData._sessId) || null) : null;
            if (freshSess && fresh.every((g) => g.userData && g.userData._sessId === freshSess)) {
              remembered = lastKnownXYBySession.get(freshSess) || null;
            }
            let spot = null;
            let spotHow = 'ranges-invalidos';
            if (remembered) {
              // Rebuild nunca teleporta: mantém o ponto antigo. Se a peça
              // estava COLADA numa parede, ancora a MESMA borda (não o
              // centro): crescer não desgruda da parede. Nudge de centro só
              // como trava final de segurança. Sobreposição com outros
              // móveis após crescer fica por conta do usuário (arrasto).
              const EPS_WALL = 2;
              const loX = -ROOM_LIMIT.x + wall, hiX = ROOM_LIMIT.x - wall;
              const loY = -ROOM_LIMIT.y + wall, hiY = ROOM_LIMIT.y - wall;
              let sx = remembered[0], sy = remembered[1];
              if (typeof remembered[3] === "number" && remembered[3] > 0) {
                const oHw = remembered[3];
                if (Math.abs(remembered[0] - oHw - loX) <= EPS_WALL) sx = loX + hw;
                else if (Math.abs(remembered[0] + oHw - hiX) <= EPS_WALL) sx = hiX - hw;
              }
              if (typeof remembered[4] === "number" && remembered[4] > 0) {
                const oHd = remembered[4];
                if (Math.abs(remembered[1] - oHd - loY) <= EPS_WALL) sy = loY + hd;
                else if (Math.abs(remembered[1] + oHd - hiY) <= EPS_WALL) sy = hiY + hd;
              }
              sx = Math.min(maxCX, Math.max(minCX, sx));
              sy = Math.min(maxCY, Math.max(minCY, sy));
              spot = { x: sx, y: sy };
              spotHow = (sx === remembered[0] && sy === remembered[1])
                ? 'memoria-sessao' : 'memoria-sessao-ajustada';
            }
            if (!spot && minCX <= maxCX && minCY <= maxCY) {
              const step = Math.max(hw * 2, hd * 2, 150);
              outer: for (let ring = 0; ring <= 8; ring++) {
                for (let k = 0; k < 8; k++) {
                  const a = (k / 8) * Math.PI * 2 + ring * 0.4;
                  const cx =
                    ring === 0 ? uc.x : baseX + Math.cos(a) * ring * step;
                  const cy =
                    ring === 0 ? uc.y : baseY + Math.sin(a) * ring * step;
                  if (fits(cx, cy) && clearOf(cx, cy)) {
                    spot = { x: cx, y: cy };
                    spotHow = 'ring=' + ring + ' k=' + k;
                    break outer;
                  }
                }
              }
              if (!spot) spotHow = 'espiral-esgotada';
            }
            if (!spot) {
              spot = { x: baseX, y: baseY };
              spotHow = 'fallback-centro';
            }
            diagLog('[SPAWN] resultado spot=' + Math.round(spot.x) + ',' + Math.round(spot.y) +
              ' (' + spotHow + ') dx=' + Math.round(spot.x - uc.x) + ' dy=' + Math.round(spot.y - uc.y));
            const dx = spot.x - uc.x;
            const dy = spot.y - uc.y;
            // Sela a posição mesmo sem deslocamento (dx=dy=0): sem isso o
            // grupo passaria no spawn de novo numa eventual re-escala.
            fresh.forEach((g) => {
              g.userData = g.userData || {};
              if (!g.userData._wantXY) g.userData._wantXY = [g.position.x, g.position.y];
            });
            // Giro lembrado: aplica no objeto novo (que nasceu sem giro).
            // Decompõe em base=nascimento atual + abs=delta, como o slider faz;
            // o bloco de restauração mantém a partir daí. Nunca atropela giro
            // que o usuário já tenha dado neste objeto.
            if (remembered && typeof remembered[2] === "number") {
              fresh.forEach((g) => {
                g.userData = g.userData || {};
                if (typeof g.userData._rotAbs !== "number") {
                  g.userData._rotBase = g.rotation.z || 0;
                  g.userData._rotAbs = remembered[2] - g.userData._rotBase;
                  g.rotation.z = g.userData._rotBase + g.userData._rotAbs;
                  g.updateMatrixWorld(true);
                }
              });
            }
            if (dx || dy) {
              fresh.forEach((g) => {
                g.position.x += dx;
                g.position.y += dy;
                g.updateMatrixWorld(true);
                g.userData = g.userData || {};
                g.userData._wantXY = [g.position.x, g.position.y];
              });
              diagLog('[ROOM] movel posicionado: dx=' +
                Math.round(dx) + ' dy=' + Math.round(dy));
            }
            // Ocupa o ponto para o próximo grupo fresco deste mesmo passe.
            occ.push(
              new THREE.Box3(
                new THREE.Vector3(spot.x - hw, spot.y - hd, ub.min.z),
                new THREE.Vector3(spot.x + hw, spot.y + hd, ub.max.z)
              )
            );
          }
        }
      }
      for (let i = scaledFurniture.length - 1; i >= 0; i--) {
        const g = scaledFurniture[i];
        if (!g.parent) {
          diagLog('[EVICT] removido sem parent: ' + (g.name || g.type) +
            ' #' + String(g.uuid).slice(0, 8) +
            ' sessao=' + ((g.userData && g.userData._sessId) || '?') +
            ' escala=' + ((g.userData && g.userData._furnScaled) || '?') +
            ' wantXY=' + ((g.userData && g.userData._wantXY) ? g.userData._wantXY.map(Math.round).join(',') : '-'));
          // Guarda pose antiga pela sessão antes de descartar o objeto.
          const evSess = g.userData && g.userData._sessId;
          const evWant = g.userData && g.userData._wantXY;
          const evRot = g.userData && typeof g.userData._rotAbs === "number"
            ? (g.userData._rotBase || 0) + g.userData._rotAbs : null;
          if (evSess && evWant) {
            const eb = filteredBoxFor(g);
            lastKnownXYBySession.set(evSess, [evWant[0], evWant[1], evRot,
              (eb.max.x - eb.min.x) / 2, (eb.max.y - eb.min.y) / 2]);
          }
          scaledFurniture.splice(i, 1);
          continue;
        }
        // Reimpõe a posição desejada (arrasto manual) se o SDV resetou.
        const want = g.userData._wantXY;
        if (want && (g.position.x !== want[0] || g.position.y !== want[1])) {
          g.position.x = want[0];
          g.position.y = want[1];
          g.updateMatrixWorld(true);
        }
        // Reimpõe o giro desejado (slider) se o SDV resetou.
        if (typeof g.userData._rotAbs === "number") {
          const wantR = (g.userData._rotBase || 0) + g.userData._rotAbs;
          if (g.rotation.z !== wantR) {
            g.rotation.z = wantR;
            g.updateMatrixWorld(true);
          }
        }
        // Memória por sessão: sincroniza pose desejada a cada passe (cobre
        // spawn, arrasto manual e slider, sem mexer nesses arquivos).
        const memSess = g.userData._sessId;
        const memWant = g.userData._wantXY;
        const memRot = typeof g.userData._rotAbs === "number"
          ? (g.userData._rotBase || 0) + g.userData._rotAbs : null;
        if (memSess && memWant) {
          const prev = lastKnownXYBySession.get(memSess);
          if (!prev || prev[0] !== memWant[0] || prev[1] !== memWant[1] ||
              typeof prev[3] !== "number" || typeof prev[4] !== "number") {
            // Posição nova ou sem tamanho: mede (só aqui; parado não remede).
            const mb = filteredBoxFor(g);
            lastKnownXYBySession.set(memSess, [memWant[0], memWant[1], memRot,
              (mb.max.x - mb.min.x) / 2, (mb.max.y - mb.min.y) / 2]);
          } else if (prev[2] !== memRot) {
            prev[2] = memRot;
          }
        }
      }
    }

    let debugEl = null;

    // Cotas do móvel: 3 linhas (X/Y/Z da caixa) + etiquetas HTML que
    // acompanham a câmera. Medidas em unidades da cena (cm por padrão).
    const dimsOn = roomConfig.dimensions !== false;
    const dimsGroup = new THREE.Group();
    dimsGroup.name = "furniture-dimensions";
    const dimLineMat = new THREE.LineBasicMaterial({
      color:
        roomConfig.dimensionsColor !== undefined ? roomConfig.dimensionsColor : 0x2f6fed,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false
    });
    dimLineMat.renderOrder = 999;
    let dimsKey = null;
    let dimDefs = [];
    const dimLabels = [];
    const dimCanvas =
      document.getElementById(
        (window.SD_CONFIG && window.SD_CONFIG.canvasId) || "canvas"
      ) || document.getElementById("canvas");
    if (dimsOn) {
      scene.add(dimsGroup);
      for (let i = 0; i < 3; i++) {
        const div = document.createElement("div");
        div.className = "dim-label";
        div.style.display = "none";
        document.body.appendChild(div);
        dimLabels.push(div);
      }
    }

    function fmtDim(v) {
      return Math.round(v) + " cm";
    }

    // Yaw do(s) móvel(is) medido(s) — nunca global: com 2+ peças, o giro de
    // uma contaminava as cotas da outra através do dimsGroup único.
    // Sem raízes (cena toda), 0: não há um referencial único para girar.
    function yawOfRoots(roots) {
      if (roots && roots.length) {
        for (const r of roots) {
          const u = r && r.userData;
          if (u && typeof u._rotAbs === "number") return u._rotAbs;
        }
      }
      return 0;
    }

    function rebuildDimensions(box, yawArg) {
      if (!dimsOn) return;
      const yaw = typeof yawArg === "number" ? yawArg : 0;
      if (box) {
        diagLog('[DIM] box cru min=[' + Math.round(box.min.x) + ',' + Math.round(box.min.y) + ',' + Math.round(box.min.z) +
          '] max=[' + Math.round(box.max.x) + ',' + Math.round(box.max.y) + ',' + Math.round(box.max.z) +
          '] yawDeg=' + Math.round((yaw * 180) / Math.PI));
      } else {
        diagLog('[DIM] box cru = null');
      }
      const key = box
        ? [
            box.min.x,
            box.min.y,
            box.min.z,
            box.max.x,
            box.max.y,
            box.max.z,
            (yaw * 180) / Math.PI
          ]
            .map(Math.round)
            .join(",")
        : "null";
      if (key === dimsKey) return;
      dimsKey = key;
      while (dimsGroup.children.length) {
        const child = dimsGroup.children.pop();
        dimsGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
      }
      dimDefs = [];
      dimLabels.forEach((el) => {
        el.style.display = "none";
      });
      if (!box) return;
      // A caixa já vem medida com yaw zerado (ver computeFurnitureBox):
      // tamanhos reais, sem inflação. O grupo posiciona/rotaciona as linhas.
      const cx = (box.min.x + box.max.x) / 2;
      const cy = (box.min.y + box.max.y) / 2;
      const cz = (box.min.z + box.max.z) / 2;
      const lx0 = box.min.x - cx;
      const ly0 = box.min.y - cy;
      const lx1 = box.max.x - cx;
      const ly1 = box.max.y - cy;
      const lz0 = box.min.z - cz;
      const lz1 = box.max.z - cz;
      const m = 8;
      const t = 6;
      const pts = [];
      function seg(ax, ay, az, bx, by, bz) {
        pts.push(ax, ay, az, bx, by, bz);
      }
      seg(lx0, ly1 + m, lz0, lx1, ly1 + m, lz0);
      seg(lx0, ly1 + m - t, lz0, lx0, ly1 + m + t, lz0);
      seg(lx1, ly1 + m - t, lz0, lx1, ly1 + m + t, lz0);
      seg(lx1 + m, ly0, lz0, lx1 + m, ly1, lz0);
      seg(lx1 + m - t, ly0, lz0, lx1 + m + t, ly0, lz0);
      seg(lx1 + m - t, ly1, lz0, lx1 + m + t, ly1, lz0);
      seg(lx1 + m, ly1 + m, lz0, lx1 + m, ly1 + m, lz1);
      seg(lx1 + m - t, ly1 + m, lz0, lx1 + m + t, ly1 + m, lz0);
      seg(lx1 + m - t, ly1 + m, lz1, lx1 + m + t, ly1 + m, lz1);
      // Âncoras das etiquetas: ponto local -> mundo (gira junto).
      const cw = Math.cos(yaw);
      const sw = Math.sin(yaw);
      function wpt(lx, ly, lz) {
        return [cx + lx * cw - ly * sw, cy + lx * sw + ly * cw, cz + lz];
      }
      dimDefs = [
        {
          text: fmtDim(lx1 - lx0),
          at: wpt(0, ly1 + m + 12, lz0)
        },
        {
          text: fmtDim(ly1 - ly0),
          at: wpt(lx1 + m + 12, 0, lz0)
        },
        {
          text: fmtDim(lz1 - lz0),
          at: wpt(lx1 + m + 12, ly1 + m + 12, 0)
        }
      ];
      dimsGroup.position.set(cx, cy, cz);
      dimsGroup.rotation.z = yaw;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const lines = new THREE.LineSegments(g, dimLineMat);
      lines.renderOrder = 999;
      lines.frustumCulled = false;
      dimsGroup.add(lines);
      while (dimLabels.length < dimDefs.length) {
        const div = document.createElement("div");
        div.className = "dim-label";
        div.style.display = "none";
        document.body.appendChild(div);
        dimLabels.push(div);
      }
      dimDefs.forEach((d, i) => {
        dimLabels[i].textContent = d.text;
      });
    }

    function updateDimLabels() {
      if (!dimsOn || !dimDefs.length) return;
      // Oculta cotas quando a câmera passa da distância limite do móvel.
      const maxDist =
        roomConfig.dimensionsMaxDistance !== undefined
          ? roomConfig.dimensionsMaxDistance
          : 600;
      if (camPos.distanceTo(center) > maxDist) {
        dimsGroup.visible = false;
        dimLabels.forEach((el) => {
          el.style.display = "none";
        });
        return;
      }
      dimsGroup.visible = true;
      const tc = viewport.threeJsCoreObjects.camera;
      if (!tc || !dimCanvas) return;
      const rect = dimCanvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dimDefs.forEach((d, i) => {
        const el = dimLabels[i];
        tmp.set(d.at[0], d.at[1], d.at[2]).project(tc);
        if (tmp.z > 1 || tmp.z < -1) {
          el.style.display = "none";
          return;
        }
        el.style.display = "block";
        el.style.left = rect.left + (tmp.x * 0.5 + 0.5) * rect.width + "px";
        el.style.top = rect.top + (-tmp.y * 0.5 + 0.5) * rect.height + "px";
      });
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
        Math.round(limit && limit.p90 !== undefined ? limit.p90 : limit) +
        " | paredes: " +
        wallsState;
    }

    function hideSceneryIn(obj, limit, cmPerUnit) {
      if (roomConfig.hideScenery === false) {
        return;
      }
      const meshes = [];
      collectMeshes(obj, meshes);
      const cpu = cmPerUnit > 0 ? cmPerUnit :
        (FURNITURE_SCALE > 0 ? FURNITURE_SCALE : 1);
      meshes.forEach((mesh) => {
        mesh.visible = meshFilterResult(mesh, limit, cpu).kept;
      });
    }

    function hideScenery(limit) {
      hideSceneryIn(scene, limit);
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
      const measuredRoots = selectedFurnitureRoots();
      const box = computeFurnitureBox(measuredRoots);
      if (!box) {
        rebuildDimensions(null);
        return;
      }
      rebuildDimensions(box, yawOfRoots(measuredRoots));
      // Esconde cenário por sessão (limite próprio): um modelo gigante não
      // revela o piso do outro. O resto (sem dono) usa o limite global.
      (function hidePerSession() {
        if (roomConfig.hideScenery === false) {
          return;
        }
        const claimed = new Set();
        try {
          const api = window.shapediverAPI;
          const vp = viewport;
          if (api && vp && typeof api.getSessions === "function") {
            api.getSessions().forEach((s) => {
              let root = null;
              try {
                const node = s.session && s.session.node;
                const cv = node && node.convertedObject;
                if (cv) root = cv[vp.id] || null;
              } catch (e) {
                root = null;
              }
              if (!root || !root.parent) return;
              let top = root;
              while (top.parent && top.parent !== scene) top = top.parent;
              if (top.parent === scene) claimed.add(top);
              hideSceneryIn(root, limitForRoot(root), cmPerUnitForUnits(s.modelUnits));
            });
          }
        } catch (e) {}
        const strayMeshes = [];
        scene.children.slice().forEach((child) => {
          if (child === roomRoot || child === room || claimed.has(child)) return;
          collectMeshes(child, strayMeshes);
        });
        const strayLimit = limitForMeshes(strayMeshes);
        scene.children.slice().forEach((child) => {
          if (child === roomRoot || child === room || claimed.has(child)) return;
          hideSceneryIn(child, strayLimit);
        });
      })();
      box.getCenter(center);
      floorTarget.copy(center);
      floorTarget.z = roomRoot.position.z + 1;
      updateDebug(box, furnitureDiagLimit());
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
      try {
        updateFurnitureCenter(performance.now());
      } catch (err) {
        console.error("room.js update:", err);
      }
      updateDimLabels();
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

    // Enquadra a câmera na sala uma vez (mantém o ângulo atual, ajusta
    // distância e alvo). Pula se o usuário já mexeu. Reenquadra manual:
    // window.frameRoomCamera().
    let roomFramed = false;
    let userInteracted = false;
    const frameCanvas =
      document.getElementById(
        (window.SD_CONFIG && window.SD_CONFIG.canvasId) || "canvas"
      ) || document.getElementById("canvas");
    function markInteracted() {
      userInteracted = true;
    }
    if (frameCanvas) {
      frameCanvas.addEventListener("pointerdown", markInteracted, { once: true });
      frameCanvas.addEventListener("wheel", markInteracted, { once: true });
    }
    function frameRoomCamera() {
      if (roomFramed || userInteracted) return;
      roomFramed = true;
      const cam = viewport.camera;
      if (!cam) return;
      // Direção fixa de dollhouse (frente + acima), não a pose padrão do SDV.
      let dx = 0;
      let dy = -0.85;
      let dz = 0.53;
      const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx /= dl;
      dy /= dl;
      dz /= dl;
      const cx = roomRoot.position.x + room.position.x;
      const cy = roomRoot.position.y + room.position.y;
      const cz = roomRoot.position.z + room.position.z + HEIGHT * 0.35;
      const dist = Math.max(WIDTH, DEPTH) * 1.2;
      cam.target = [cx, cy, cz];
      cam.position = [cx + dx * dist, cy + dy * dist, cz + dz * dist];
      diagLog("[ROOM] camera enquadrada na sala, dist=" + Math.round(dist));
    }
    window.frameRoomCamera = function () {
      userInteracted = false;
      roomFramed = false;
      frameRoomCamera();
    };
    frameRoomCamera();

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
