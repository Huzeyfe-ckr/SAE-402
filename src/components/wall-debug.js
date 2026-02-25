/**
 * Composant wall-debug avec WebXR Room Capture
 * Détecte automatiquement les vrais murs, sol et plafond de la pièce
 * Fallback vers une salle manuelle si Room Capture n'est pas disponible
 * 
 * ALIGNEMENT DES MURS:
 * - alignToCamera: true = les murs s'alignent avec la direction où vous regardez
 * - manualRotation: ajustement manuel de l'angle (en degrés) si nécessaire
 */

AFRAME.registerComponent("wall-debug", {
  schema: {
    enabled: { type: "boolean", default: true },
    wallColor: { type: "color", default: "#0066FF" },
    floorColor: { type: "color", default: "#FF0000" },
    ceilingColor: { type: "color", default: "#00FF00" },
    wallOpacity: { type: "number", default: 0.3 },
    floorOpacity: { type: "number", default: 0.5 },
    ceilingOpacity: { type: "number", default: 0.3 },
    roomSize: { type: "number", default: 8 }, // Fallback si pas de Room Capture
    wallHeight: { type: "number", default: 2.5 },
    floorY: { type: "number", default: 0 },
    useRoomCapture: { type: "boolean", default: true },
    detectionTimeout: { type: "number", default: 5000 },
    alignToCamera: { type: "boolean", default: true }, // Aligner murs avec direction du regard
    manualRotation: { type: "number", default: 30 } // Ajustement manuel de rotation (degrés)
  },

  init: function () {
    this.walls = [];
    this.wallData = [];
    this.roomRotation = 0; // Rotation de la salle calculée
    this.wallsCreated = false;
    this.detectedPlanes = new Map();
    this.isDetecting = false;
    this.xrSession = null;
    this.referenceSpace = null;
    
    
    this.el.sceneEl.addEventListener("enter-vr", () => {
      if (this.data.useRoomCapture) {
        this.initRoomCapture();
      } else {
        this.createManualRoom();
      }
    });
    
    this.el.sceneEl.addEventListener("exit-vr", () => {
      this.isDetecting = false;
    });
  },

  initRoomCapture: function () {
    if (!this.data.enabled) return;
    
    const renderer = this.el.sceneEl.renderer;
    this.xrSession = renderer.xr.getSession();
    
    if (!this.xrSession) {
      this.createManualRoom();
      return;
    }
    
    // Vérifier si plane-detection est supporté
    if (!this.xrSession.enabledFeatures || 
        !this.xrSession.enabledFeatures.includes('plane-detection')) {
      this.createManualRoom();
      return;
    }
    
    
    this.isDetecting = true;
    
    this.xrSession.requestReferenceSpace('local').then((refSpace) => {
      this.referenceSpace = refSpace;
      this.startDetectionTimeout();
    }).catch((err) => {
      console.error("🔴 Erreur reference space:", err);
      this.createManualRoom();
    });
  },

  startDetectionTimeout: function () {
    
    setTimeout(() => {
      if (this.detectedPlanes.size > 0) {
        this.createRoomFromPlanes();
      } else {
        this.createManualRoom();
      }
      this.isDetecting = false;
    }, this.data.detectionTimeout);
  },

  tick: function () {
    if (!this.isDetecting || !this.xrSession || this.wallsCreated) return;
    
    const renderer = this.el.sceneEl.renderer;
    const frame = renderer.xr.getFrame();
    
    if (!frame || !frame.detectedPlanes) return;
    
    frame.detectedPlanes.forEach((plane) => {
      if (!this.detectedPlanes.has(plane)) {
        this.processPlane(plane, frame);
      }
    });
  },

  processPlane: function (plane, frame) {
    if (!this.referenceSpace) return;
    
    const pose = frame.getPose(plane.planeSpace, this.referenceSpace);
    if (!pose) return;
    
    const position = pose.transform.position;
    const orientation = pose.transform.orientation;
    
    const quaternion = new THREE.Quaternion(
      orientation.x,
      orientation.y,
      orientation.z,
      orientation.w
    );
    
    const normal = new THREE.Vector3(0, 1, 0);
    normal.applyQuaternion(quaternion);
    
    let planeType = "unknown";
    const normalY = Math.abs(normal.y);
    
    // Classification plus permissive des plans
    if (normalY > 0.7) {
      // Plan horizontal
      if (position.y < 0.8) {
        planeType = "floor";
      } else if (position.y > 1.8) {
        planeType = "ceiling";
      } else {
        // Entre 0.8 et 1.8 = probablement un meuble, on ignore
        planeType = "unknown";
      }
    } else {
      // Plan vertical ou incliné = mur (plus permissif, normalY < 0.7)
      planeType = "wall";
    }
    
    let width = 2;
    let height = 2;
    
    if (plane.polygon && plane.polygon.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      
      plane.polygon.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
      });
      
      width = maxX - minX;
      height = maxZ - minZ;
    }
    
    this.detectedPlanes.set(plane, {
      position: new THREE.Vector3(position.x, position.y, position.z),
      normal: normal.clone(),
      quaternion: quaternion.clone(),
      type: planeType,
      width: Math.max(width, 0.5),
      height: Math.max(height, 0.5),
      orientation: plane.orientation
    });
    
  },

  createRoomFromPlanes: function () {
    if (this.wallsCreated) return;
    this.wallsCreated = true;
    
    
    let wallCount = 0;
    let floorCount = 0;
    let ceilingCount = 0;
    
    // Calculer les limites de la pièce à partir des plans détectés
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    this.detectedPlanes.forEach((planeData, plane) => {
      const { type, position, width, height } = planeData;
      
      // Mettre à jour les limites
      minX = Math.min(minX, position.x - width/2);
      maxX = Math.max(maxX, position.x + width/2);
      minZ = Math.min(minZ, position.z - height/2);
      maxZ = Math.max(maxZ, position.z + height/2);
      minY = Math.min(minY, position.y);
      maxY = Math.max(maxY, position.y);
      
      if (type === "wall") {
        this.createWallFromPlane(planeData, wallCount);
        wallCount++;
      } else if (type === "floor") {
        this.createFloorFromPlane(planeData);
        floorCount++;
      } else if (type === "ceiling") {
        this.createCeilingFromPlane(planeData);
        ceilingCount++;
      }
    });
    
    
    // Calculer le centre et la taille de la pièce détectée
    const camera = this.el.sceneEl.camera;
    const cameraPos = new THREE.Vector3();
    if (camera) camera.getWorldPosition(cameraPos);
    
    // Si des murs ont été détectés, utiliser leurs limites pour le sol/plafond
    let roomCenterX = cameraPos.x;
    let roomCenterZ = cameraPos.z;
    let detectedRoomSize = this.data.roomSize * 2; // Fallback
    let detectedWallHeight = this.data.wallHeight;
    
    // Calculer la taille à partir de TOUS les plans détectés (pas seulement les murs)
    if (minX !== Infinity) {
      roomCenterX = (minX + maxX) / 2;
      roomCenterZ = (minZ + maxZ) / 2;
      detectedRoomSize = Math.max(maxX - minX, maxZ - minZ);
    }
    
    if (maxY > minY && minY < 1 && maxY > 2) {
      detectedWallHeight = maxY - minY;
    }
    
    // NE PAS créer de murs manuels si WebXR a détecté des plans
    // Les murs manuels ne sont créés QUE si aucun plan n'a été détecté du tout
    const totalPlanes = wallCount + floorCount + ceilingCount;
    
    if (wallCount === 0 && totalPlanes === 0) {
      // Aucun plan détecté du tout - fallback complet
      this.createManualWalls();
    } else if (wallCount === 0) {
      // Des plans ont été détectés mais pas de murs - on n'ajoute PAS de murs manuels
    }
    
    if (floorCount === 0) {
      this.createFloor(roomCenterX, roomCenterZ, detectedRoomSize);
    }
    if (ceilingCount === 0) {
      this.createCeiling(roomCenterX, roomCenterZ, detectedRoomSize, detectedWallHeight);
    }
    
    this.emitReadyEvents();
  },

  createWallFromPlane: function (planeData, index) {
    const { position, normal, quaternion, width, height } = planeData;
    
    const wall = document.createElement("a-plane");
    wall.id = `webxr-wall-${index}`;
    
    // Utiliser la hauteur configurée comme minimum pour agrandir les murs WebXR
    const wallHeight = Math.max(height, this.data.wallHeight);
    
    // Calculer la position Y pour que le mur soit centré verticalement à partir du sol (floorY)
    // Le mur doit s'étendre de floorY jusqu'à floorY + wallHeight
    const wallCenterY = this.data.floorY + (wallHeight / 2);
    
    wall.setAttribute("position", {
      x: position.x,
      y: wallCenterY,
      z: position.z
    });
    
    // Pour un mur (plan vertical), calculer la rotation pour que le plan soit face à la normale
    // La normale d'un mur devrait être horizontale (X-Z plane)
    // Un a-plane regarde vers +Z par défaut, donc on doit calculer l'angle Y
    
    // Projeter la normale sur le plan horizontal pour obtenir la direction
    const horizontalNormal = new THREE.Vector3(normal.x, 0, normal.z).normalize();
    
    // Calculer l'angle Y pour que le plan soit perpendiculaire à cette direction
    // atan2(x, z) donne l'angle par rapport à +Z
    const angleY = Math.atan2(horizontalNormal.x, horizontalNormal.z) * (180 / Math.PI);
    
    wall.setAttribute("rotation", {
      x: 0,
      y: angleY,
      z: 0
    });
    
    // Stocker la normale horizontale pour la collision
    const correctedNormal = horizontalNormal.clone();
    
    
    const wallWidth = Math.max(width, 1);
    
    wall.setAttribute("width", wallWidth);
    wall.setAttribute("height", wallHeight);
    
    wall.setAttribute("geometry", {
      primitive: "plane",
      width: wallWidth,
      height: wallHeight
    });
    
    wall.setAttribute("material", {
      color: this.data.wallColor,
      opacity: this.data.wallOpacity,
      transparent: true,
      side: "double"
    });
    
    wall.setAttribute("class", "scene-mesh wall-debug-surface collidable spawn-wall arrow-collidable");
    
    // Forcer la mise à jour du mesh pour le raycaster
    wall.addEventListener('loaded', () => {
      if (wall.object3D && wall.getObject3D('mesh')) {
        wall.getObject3D('mesh').updateMatrixWorld(true);
      }
    });
    
    const label = document.createElement("a-text");
    label.setAttribute("value", `MUR ${index + 1} (XR)`);
    label.setAttribute("color", "#FFFFFF");
    label.setAttribute("align", "center");
    label.setAttribute("scale", "1 1 1");
    label.setAttribute("position", "0 0 0.02");
    wall.appendChild(label);
    
    this.el.sceneEl.appendChild(wall);
    this.walls.push(wall);
    
    this.wallData.push({
      entity: wall,
      name: `MUR ${index + 1}`,
      position: new THREE.Vector3(position.x, wallCenterY, position.z),
      normal: horizontalNormal, // Utiliser la normale horizontale pour la collision
      width: wallWidth,
      height: wallHeight,
      rotation: { x: 0, y: angleY, z: 0 },
      isWebXR: true
    });
    
  },

  createFloorFromPlane: function (planeData) {
    const { position, width, height } = planeData;
    
    const floor = document.createElement("a-plane");
    floor.id = "webxr-floor";
    
    floor.setAttribute("position", {
      x: position.x,
      y: position.y,
      z: position.z
    });
    
    floor.setAttribute("rotation", { x: -90, y: 0, z: 0 });
    
    const floorWidth = Math.max(width, 2);
    const floorHeight = Math.max(height, 2);
    
    floor.setAttribute("width", floorWidth);
    floor.setAttribute("height", floorHeight);
    
    floor.setAttribute("geometry", {
      primitive: "plane",
      width: floorWidth,
      height: floorHeight
    });
    
    floor.setAttribute("material", {
      color: this.data.floorColor,
      opacity: this.data.floorOpacity,
      transparent: true,
      side: "double"
    });
    
    floor.setAttribute("class", "scene-mesh wall-debug-surface collidable floor-surface arrow-collidable");
    
    // Forcer la mise à jour du mesh pour le raycaster
    floor.addEventListener('loaded', () => {
      if (floor.object3D && floor.getObject3D('mesh')) {
        floor.getObject3D('mesh').updateMatrixWorld(true);
      }
    });
    
    const label = document.createElement("a-text");
    label.setAttribute("value", "SOL (XR)");
    label.setAttribute("color", "#FFFFFF");
    label.setAttribute("align", "center");
    label.setAttribute("scale", "2 2 2");
    label.setAttribute("position", "0 0 0.02");
    floor.appendChild(label);
    
    this.el.sceneEl.appendChild(floor);
    this.walls.push(floor);
    
    this.wallData.push({
      entity: floor,
      name: "SOL",
      position: position.clone(),
      normal: new THREE.Vector3(0, 1, 0),
      width: floorWidth,
      height: floorHeight,
      rotation: { x: -90, y: 0, z: 0 },
      isFloor: true,
      isWebXR: true
    });
    
  },

  createCeilingFromPlane: function (planeData) {
    const { position, width, height } = planeData;
    
    const ceiling = document.createElement("a-plane");
    ceiling.id = "webxr-ceiling";
    
    ceiling.setAttribute("position", {
      x: position.x,
      y: position.y,
      z: position.z
    });
    
    ceiling.setAttribute("rotation", { x: 90, y: 0, z: 0 });
    
    const ceilingWidth = Math.max(width, 2);
    const ceilingHeight = Math.max(height, 2);
    
    ceiling.setAttribute("width", ceilingWidth);
    ceiling.setAttribute("height", ceilingHeight);
    
    ceiling.setAttribute("geometry", {
      primitive: "plane",
      width: ceilingWidth,
      height: ceilingHeight
    });
    
    ceiling.setAttribute("material", {
      color: this.data.ceilingColor,
      opacity: this.data.ceilingOpacity,
      transparent: true,
      side: "double"
    });
    
    ceiling.setAttribute("class", "scene-mesh wall-debug-surface collidable ceiling-surface arrow-collidable");
    
    // Forcer la mise à jour du mesh pour le raycaster
    ceiling.addEventListener('loaded', () => {
      if (ceiling.object3D && ceiling.getObject3D('mesh')) {
        ceiling.getObject3D('mesh').updateMatrixWorld(true);
      }
    });
    
    const label = document.createElement("a-text");
    label.setAttribute("value", "PLAFOND (XR)");
    label.setAttribute("color", "#FFFFFF");
    label.setAttribute("align", "center");
    label.setAttribute("scale", "2 2 2");
    label.setAttribute("position", "0 0 0.02");
    ceiling.appendChild(label);
    
    this.el.sceneEl.appendChild(ceiling);
    this.walls.push(ceiling);
    
    this.wallData.push({
      entity: ceiling,
      name: "PLAFOND",
      position: position.clone(),
      normal: new THREE.Vector3(0, -1, 0),
      width: ceilingWidth,
      height: ceilingHeight,
      rotation: { x: 90, y: 0, z: 0 },
      isCeiling: true,
      isWebXR: true
    });
    
  },

  createManualRoom: function () {
    if (this.wallsCreated) return;
    this.wallsCreated = true;
    
    
    // On ne crée PAS de murs manuels - seulement sol et plafond
    // Les murs doivent venir du Room Capture WebXR
    
    const camera = this.el.sceneEl.camera;
    const cameraPos = new THREE.Vector3();
    if (camera) {
      camera.getWorldPosition(cameraPos);
    }
    
    // Créer sol et plafond avec une taille par défaut
    this.createFloor(cameraPos.x, cameraPos.z, this.data.roomSize * 2);
    this.createCeiling(cameraPos.x, cameraPos.z, this.data.roomSize * 2, this.data.wallHeight);
    
    this.emitReadyEvents();
  },

  // Cette fonction n'est plus utilisée - les murs viennent uniquement de WebXR
  createManualWalls: function () {
    // Ne crée rien - les murs doivent venir de WebXR Room Capture
  },

  createFloor: function(centerX, centerZ, floorSize) {
    const floor = document.createElement("a-plane");
    floor.id = "debug-floor";
    
    floor.setAttribute("position", {
      x: centerX,
      y: this.data.floorY,
      z: centerZ
    });
    
    floor.setAttribute("rotation", { x: -90, y: 0, z: 0 });
    floor.setAttribute("width", floorSize);
    floor.setAttribute("height", floorSize);
    
    floor.setAttribute("geometry", {
      primitive: "plane",
      width: floorSize,
      height: floorSize
    });
    
    floor.setAttribute("material", {
      color: this.data.floorColor,
      opacity: this.data.floorOpacity,
      transparent: true,
      side: "double"
    });
    
    floor.setAttribute("class", "scene-mesh wall-debug-surface collidable floor-surface arrow-collidable");
    
    // Forcer la mise à jour du mesh pour le raycaster
    floor.addEventListener('loaded', () => {
      if (floor.object3D && floor.getObject3D('mesh')) {
        floor.getObject3D('mesh').updateMatrixWorld(true);
      }
    });
    
    const label = document.createElement("a-text");
    label.setAttribute("value", "SOL");
    label.setAttribute("color", "#FFFFFF");
    label.setAttribute("align", "center");
    label.setAttribute("scale", "2 2 2");
    label.setAttribute("position", "0 0 0.02");
    floor.appendChild(label);
    
    this.el.sceneEl.appendChild(floor);
    this.walls.push(floor);
    
    this.wallData.push({
      entity: floor,
      name: "SOL",
      position: new THREE.Vector3(centerX, this.data.floorY, centerZ),
      normal: new THREE.Vector3(0, 1, 0),
      width: floorSize,
      height: floorSize,
      rotation: { x: -90, y: 0, z: 0 },
      isFloor: true
    });
    
  },

  createCeiling: function(centerX, centerZ, ceilingSize, wallHeight) {
    const ceiling = document.createElement("a-plane");
    ceiling.id = "debug-ceiling";
    
    const ceilingY = this.data.floorY + wallHeight;
    
    ceiling.setAttribute("position", {
      x: centerX,
      y: ceilingY,
      z: centerZ
    });
    
    ceiling.setAttribute("rotation", { x: 90, y: 0, z: 0 });
    ceiling.setAttribute("width", ceilingSize);
    ceiling.setAttribute("height", ceilingSize);
    
    ceiling.setAttribute("geometry", {
      primitive: "plane",
      width: ceilingSize,
      height: ceilingSize
    });
    
    ceiling.setAttribute("material", {
      color: this.data.ceilingColor,
      opacity: this.data.ceilingOpacity,
      transparent: true,
      side: "double"
    });
    
    ceiling.setAttribute("class", "scene-mesh wall-debug-surface collidable ceiling-surface arrow-collidable");
    
    // Forcer la mise à jour du mesh pour le raycaster
    ceiling.addEventListener('loaded', () => {
      if (ceiling.object3D && ceiling.getObject3D('mesh')) {
        ceiling.getObject3D('mesh').updateMatrixWorld(true);
      }
    });
    
    const label = document.createElement("a-text");
    label.setAttribute("value", "PLAFOND");
    label.setAttribute("color", "#FFFFFF");
    label.setAttribute("align", "center");
    label.setAttribute("scale", "2 2 2");
    label.setAttribute("position", "0 0 0.02");
    ceiling.appendChild(label);
    
    this.el.sceneEl.appendChild(ceiling);
    this.walls.push(ceiling);
    
    this.wallData.push({
      entity: ceiling,
      name: "PLAFOND",
      position: new THREE.Vector3(centerX, ceilingY, centerZ),
      normal: new THREE.Vector3(0, -1, 0),
      width: ceilingSize,
      height: ceilingSize,
      rotation: { x: 90, y: 0, z: 0 },
      isCeiling: true
    });
    
  },

  emitReadyEvents: function () {
    this.el.sceneEl.emit("walls-ready", {
      walls: this.wallData
    });
    
    const webxrCount = this.wallData.filter(w => w.isWebXR).length;
    this.el.sceneEl.emit("surfaces-detected", {
      real: this.wallData.length,
      webxr: webxrCount,
      manual: this.wallData.length - webxrCount
    });
    
  },

  getRandomSpawnPoint: function () {
    const spawnWalls = this.wallData.filter(w => !w.isFloor && !w.isCeiling);
    if (spawnWalls.length === 0) return null;
    
    const wallIndex = Math.floor(Math.random() * spawnWalls.length);
    const wall = spawnWalls[wallIndex];
    
    const halfWidth = wall.width / 2 * 0.8;
    const halfHeight = wall.height / 2 * 0.7;
    
    const offsetX = (Math.random() - 0.5) * 2 * halfWidth;
    const offsetY = (Math.random() - 0.5) * 2 * halfHeight;
    
    const spawnPos = wall.position.clone();
    spawnPos.add(wall.normal.clone().multiplyScalar(0.05));
    
    if (Math.abs(wall.normal.z) > 0.5) {
      spawnPos.x += offsetX;
      spawnPos.y += offsetY;
    } else if (Math.abs(wall.normal.x) > 0.5) {
      spawnPos.z += offsetX;
      spawnPos.y += offsetY;
    } else {
      const right = new THREE.Vector3(1, 0, 0);
      right.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(wall.normal.x, wall.normal.z));
      spawnPos.add(right.multiplyScalar(offsetX));
      spawnPos.y += offsetY;
    }
    
    const rotation = { ...wall.rotation };
    
    return {
      position: spawnPos,
      rotation: rotation,
      normal: wall.normal,
      wallName: wall.name,
      surfaceType: "vertical",
      isRealSurface: wall.isWebXR || false
    };
  },

  remove: function () {
    this.walls.forEach(wall => {
      if (wall.parentNode) {
        wall.parentNode.removeChild(wall);
      }
    });
    this.walls = [];
    this.wallData = [];
    this.detectedPlanes.clear();
  }
});
