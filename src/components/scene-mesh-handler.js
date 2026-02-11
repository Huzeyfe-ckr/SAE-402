/**
 * Composant scene-mesh-handler pour WebXR
 * Gère le Hit Test pour détecter les surfaces réelles
 * et fournit une API simple pour le spawn des cibles
 * NOTE: La création visuelle des surfaces est DÉSACTIVÉE - utiliser wall-debug à la place
 */

AFRAME.registerComponent("scene-mesh-handler", {
  schema: {
    createVisualSurfaces: { type: "boolean", default: false } // Désactivé par défaut
  },

  init: function () {
    this.sceneMeshes = [];
    this.spawnSurfaces = [];
    this.isWebXRSupported = false;
    this.xrSession = null;
    this.xrRefSpace = null;
    this.hitTestSource = null;
    this.detectedSurfaces = [];
    this.lastResultTime = 0;
    this.hasHitTestThisFrame = false;
    this.usesMockSurfaces = false;
    this.visualSurfaces = new Map(); // Map pour stocker les surfaces visuelles
    this.detectedPlanes = new Map(); // Map pour les planes WebXR
    this.surfaceOpacity = 0; // Opacité des surfaces (masqué par défaut)

    // Écouter les événements de visualisation
    this.el.sceneEl.addEventListener("enable-surface-visualization", (evt) => {
      this.surfaceOpacity = evt.detail?.opacity || 0.6;
      this.updateAllSurfacesOpacity();
    });

    this.el.sceneEl.addEventListener("disable-surface-visualization", () => {
      this.surfaceOpacity = 0;
      this.updateAllSurfacesOpacity();
    });

    if ("xr" in navigator) {
      this.checkWebXRSupport();
    } else {
      console.log("⚠️ WebXR non disponible sur ce navigateur");
      this.createMockSceneMesh();
    }
  },

  async checkWebXRSupport() {
    try {
      const isARSupported = await navigator.xr?.isSessionSupported(
        "immersive-ar",
      );
      const isVRSupported = await navigator.xr?.isSessionSupported(
        "immersive-vr",
      );

      this.isWebXRSupported = isARSupported || isVRSupported;

      if (this.isWebXRSupported) {
        console.log(
          `✅ WebXR supporté - AR: ${isARSupported}, VR: ${isVRSupported}`,
        );
        this.setupSceneMeshTracking();
      } else {
        console.log("⚠️ WebXR non supporté sur cet appareil");
      }
    } catch (error) {
      console.log("⚠️ Erreur de vérification WebXR:", error);
    }
  },

  setupSceneMeshTracking: function () {
    const sceneEl = this.el.sceneEl;

    sceneEl.addEventListener("enter-vr", () => {
      console.log("🥽 Entrée en mode VR - Activation du Scene Mesh");
      this.startSceneMeshDetection();
    });

    sceneEl.addEventListener("exit-vr", () => {
      console.log("👋 Sortie du mode VR - Désactivation du Scene Mesh");
      this.stopSceneMeshDetection();
    });
  },

  startSceneMeshDetection: function () {
    const renderer = this.el.sceneEl.renderer;
    this.xrSession = renderer.xr.getSession();
    this.xrRefSpace = renderer.xr.getReferenceSpace();

    if (!this.xrSession) {
      console.warn("⚠️ Session XR non disponible");
      return;
    }

    this.el.sceneEl.emit("scene-mesh-handler-ready", {});
console.log("🎯 Démarrage détection des planes du Quest");
    this.el.sceneEl.emit("scene-mesh-handler-ready", {});

    // Activer la détection des planes WebXR
    this.trackXRPlanes();

    if (this.xrSession.requestHitTestSource) {
      this.initializeHitTest();
    }
  },

async initializeHitTest() {
  try {
    const viewerSpace = await this.xrSession.requestReferenceSpace("viewer");
    this.hitTestSource = await this.xrSession.requestHitTestSource({
      space: viewerSpace,
    });
    console.log("🎯 Hit-test initialisé (viewer space)");
  } catch (error) {
    console.warn("⚠️ Hit-test viewer impossible, fallback local", error);
    try {
      const localSpace = await this.xrSession.requestReferenceSpace("local");
      this.hitTestSource = await this.xrSession.requestHitTestSource({
        space: localSpace,
      });
      console.log("🎯 Hit-test initialisé (local space)");
    } catch (err) {
      console.warn("⚠️ Hit-test indisponible, fallback mock", err);
      console.warn("⚠️ Hit-test indisponible - Surfaces mockées déjà créées");
      this.usesMockSurfaces = true;
    }
  }
},

  trackXRPlanes: function() {
    console.log("🔍 Activation du tracking des planes WebXR du Quest");
    console.log("📊 Nombre de planes déjà détectés:", this.detectedPlanes.size);
    
    // Cette fonction sera appelée à chaque frame dans tick()
    this.planesEnabled = true;
    this.planeCheckCount = 0;
  },

  createMockSceneMesh: function () {
    // Surfaces mockées désactivées - pas d'affichage visuel
    console.log("⚠️ Surfaces mockées désactivées");
    this.emitSceneMeshUpdate();
  },

  tick: function () {
    this.hasHitTestThisFrame = false;

    // Détecter les planes WebXR réels du Quest (limiter à 1 check toutes les 10 frames)
    if (this.xrSession && this.planesEnabled) {
      this.planeCheckCount = (this.planeCheckCount || 0) + 1;
      
      // Limiter les checks pour économiser les ressources
      if (this.planeCheckCount % 10 !== 0) return;
      
      this.updateXRPlanes();
    }

    if (!this.xrSession || !this.hitTestSource) return;

    const frame = this.el.sceneEl.frame;
    if (!frame) return;

    try {
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);
      if (!hitTestResults || hitTestResults.length === 0) return;

      const hit = hitTestResults[0];
      const pose = hit.getPose(this.xrRefSpace);
      if (!pose) return;

      const pos = pose.transform.position;
      const quat = pose.transform.orientation;

      const position = new THREE.Vector3(pos.x, pos.y, pos.z);
      const quaternion = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);
      const normal = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(quaternion)
        .normalize();

      const surface = {
        position,
        quaternion,
        normal,
        width: 1,
        height: 1,
        stability: 1,
      };

      this.detectedSurfaces.unshift(surface);
      if (this.detectedSurfaces.length > 3) {
        this.detectedSurfaces.pop();
      }

      this.hasHitTestThisFrame = true;
      this.lastResultTime = Date.now();

      // Créer une surface visuelle avec hit-test - DÉSACTIVÉ
      // this.createHitTestVisualSurface(position, quaternion, normal);

      this.el.sceneEl.emit("surface-detected", {
        position,
        normal,
        quaternion,
        stability: 1,
        isFloor: normal.y > 0.7,
        isWall: Math.abs(normal.y) < 0.4,
        isCeiling: normal.y < -0.7,
      });
    } catch (error) {
      console.warn("⚠️ Hit-test error:", error.message);
    }
  },

  createHitTestVisualSurface: function(position, quaternion, normal) {
    // Créer une clé unique basée sur la position (arrondie pour regrouper les surfaces proches)
    const key = `${Math.round(position.x * 2)}:${Math.round(position.y * 2)}:${Math.round(position.z * 2)}`;
    
    if (!this.visualSurfaces.has(key)) {
      // Déterminer le type de surface basé sur la normale et la hauteur
      const isHorizontalUp = normal.y > 0.7; // Surface horizontale vers le haut
      const isHorizontalDown = normal.y < -0.7; // Surface horizontale vers le bas
      const isWall = Math.abs(normal.y) < 0.4; // Surface verticale
      
      // Détecter si c'est une table (surface horizontale à hauteur de table)
      const surfaceHeight = position.y;
      const isTable = isHorizontalUp && surfaceHeight > 0.5 && surfaceHeight < 1.3;
      const isFloor = isHorizontalUp && surfaceHeight <= 0.5;
      const isCeiling = isHorizontalDown;
      
      let color = "#0000FF"; // Tout en bleu
      let label = "Surface";
      
      if (isTable) {
        label = "Table (Hit-Test)";
      } else if (isFloor) {
        label = "Sol (Hit-Test)";
      } else if (isWall) {
        label = "Mur (Hit-Test)";
      } else if (isCeiling) {
        label = "Plafond (Hit-Test)";
      }
      
      // Créer l'entité visuelle
      const surfaceEntity = document.createElement("a-plane");
      surfaceEntity.setAttribute("position", `${position.x} ${position.y} ${position.z}`);
      
      // Convertir le quaternion en rotation Euler
      const euler = new THREE.Euler().setFromQuaternion(quaternion);
      surfaceEntity.setAttribute("rotation", {
        x: THREE.MathUtils.radToDeg(euler.x),
        y: THREE.MathUtils.radToDeg(euler.y), 
        z: THREE.MathUtils.radToDeg(euler.z)
      });
      
      surfaceEntity.setAttribute("width", 1);
      surfaceEntity.setAttribute("height", 1);
      surfaceEntity.setAttribute("material", {
        color: color,
        opacity: 0.8,
        transparent: true,
        wireframe: false,
        side: "double"
      });
      surfaceEntity.setAttribute("class", "scene-mesh spawn-surface");
      surfaceEntity.id = `hit-surface-${this.visualSurfaces.size}`;
      
      this.el.sceneEl.appendChild(surfaceEntity);
      this.visualSurfaces.set(key, {
        entity: surfaceEntity,
        lastUpdate: Date.now(),
        label: label
      });
      this.sceneMeshes.push(surfaceEntity);
      this.spawnSurfaces.push(surfaceEntity);
      
      console.log(`🎯 ${label} détecté à (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    } else {
      // Mettre à jour le timestamp de la surface existante
      const surface = this.visualSurfaces.get(key);
      surface.lastUpdate = Date.now();
    }
    
    // Nettoyer les vieilles surfaces (non mises à jour depuis 30 secondes)
    const now = Date.now();
    for (const [key, surface] of this.visualSurfaces.entries()) {
      if (now - surface.lastUpdate > 30000) {
        if (surface.entity.parentNode) {
          surface.entity.parentNode.removeChild(surface.entity);
        }
        this.visualSurfaces.delete(key);
        const index = this.sceneMeshes.indexOf(surface.entity);
        if (index > -1) this.sceneMeshes.splice(index, 1);
      }
    }
  },

  updateXRPlanes: function() {
    const frame = this.el.sceneEl.frame;
    if (!frame) return;

    // Vérifier si detectedPlanes est disponible
    if (!frame.detectedPlanes) {
      // Fallback : utiliser worldInformation si disponible
      if (frame.worldInformation && frame.worldInformation.detectedPlanes) {
        this.processPlanes(frame.worldInformation.detectedPlanes, frame);
        return;
      }
      return;
    }

    const planes = frame.detectedPlanes;
    this.processPlanes(planes, frame);
  },

  processPlanes: function(planes, frame) {
    // DÉSACTIVÉ: Ne pas créer de surfaces visuelles (utiliser wall-debug à la place)
    if (!this.data.createVisualSurfaces) {
      console.log("🔇 Création visuelle des surfaces WebXR désactivée - utilisez wall-debug");
      return;
    }
    
    // Limiter à 12 surfaces max pour éviter le lag
    if (this.detectedPlanes.size >= 12) return;
    
    let newPlanesAdded = false;
    
    // TOUS LES MURS EN BLEU POUR LE DEBUG
    const WALL_COLOR = "#0066FF"; // Bleu vif pour les murs
    const OTHER_COLORS = {
      "Sol Quest": "#DDA0DD", // Violet clair
      "Plafond Quest": "#FFD93D", // Jaune
      "Table Quest": "#FF8C00", // Orange
      "Surface Quest": "#87CEEB" // Bleu clair
    };
    
    for (const plane of planes) {
      // Limiter à 12 surfaces
      if (this.detectedPlanes.size >= 12) break;
      const planeId = plane.planeId || plane.lastChangedTime;
      
      if (!this.detectedPlanes.has(planeId)) {
        // Nouveau plane détecté
        const pose = frame.getPose(plane.planeSpace, this.xrRefSpace);
        if (!pose) continue;

        const position = new THREE.Vector3(
          pose.transform.position.x,
          pose.transform.position.y,
          pose.transform.position.z
        );

        const quaternion = new THREE.Quaternion(
          pose.transform.orientation.x,
          pose.transform.orientation.y,
          pose.transform.orientation.z,
          pose.transform.orientation.w
        );

        // Calculer la normale
        const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
        
        // Déterminer le type de surface
        // Surface horizontale : normale Y proche de 1 ou -1
        // Surface verticale (mur) : normale Y proche de 0
        const isHorizontal = Math.abs(normal.y) > 0.7;
        const isVertical = Math.abs(normal.y) < 0.5; // Murs
        const surfaceHeight = position.y;
        
        // Déterminer le type basé sur la hauteur pour les surfaces horizontales
        const isFloor = isHorizontal && surfaceHeight < 0.3;
        const isCeiling = isHorizontal && surfaceHeight > 2.0;
        const isTable = isHorizontal && surfaceHeight > 0.5 && surfaceHeight < 1.3;
        
        let label = "Surface Quest";
        if (isFloor) label = "Sol Quest";
        else if (isCeiling) label = "Plafond Quest";
        else if (isTable) label = "Table Quest";
        else if (isVertical) {
          // Identifier le mur par sa direction
          const wallDir = new THREE.Vector3(normal.x, 0, normal.z).normalize();
          if (Math.abs(wallDir.x) > Math.abs(wallDir.z)) {
            label = wallDir.x > 0 ? "Mur Est" : "Mur Ouest";
          } else {
            label = wallDir.z > 0 ? "Mur Sud" : "Mur Nord";
          }
        }

        // Obtenir la taille du plane si disponible
        let width = 1;
        let height = 1;
        if (plane.polygon && plane.polygon.length > 0) {
          width = Math.max(1, Math.abs(plane.polygon[0].x - plane.polygon[2]?.x || 1));
          height = Math.max(1, Math.abs(plane.polygon[0].z - plane.polygon[2]?.z || 1));
        }

        // Couleur selon le type de surface - MURS EN BLEU POUR DEBUG
        let color;
        if (isVertical) {
          color = WALL_COLOR; // Tous les murs en bleu
        } else {
          color = OTHER_COLORS[label] || "#87CEEB";
        }
        
        console.log(`🎨 Surface: ${label} - Couleur: ${color} - Hauteur: ${surfaceHeight.toFixed(2)}m - Normal Y: ${normal.y.toFixed(2)} - isVertical: ${isVertical}`);

        // Créer l'entité visuelle
        const planeEntity = document.createElement("a-plane");
        planeEntity.setAttribute("position", `${position.x} ${position.y} ${position.z}`);
        
        // Rotation selon le type de surface
        if (isHorizontal) {
          // Surface horizontale (sol, table, plafond) : plane à plat
          planeEntity.setAttribute("rotation", { x: -90, y: 0, z: 0 });
        } else {
          // Surface verticale (mur) : utiliser le quaternion WebXR
          const euler = new THREE.Euler().setFromQuaternion(quaternion);
          planeEntity.setAttribute("rotation", {
            x: THREE.MathUtils.radToDeg(euler.x),
            y: THREE.MathUtils.radToDeg(euler.y),
            z: THREE.MathUtils.radToDeg(euler.z)
          });
        }
        
        planeEntity.setAttribute("width", width);
        planeEntity.setAttribute("height", height);
        
        // IMPORTANT: Ajouter geometry pour la collision des flèches
        planeEntity.setAttribute("geometry", {
          primitive: "plane",
          width: width,
          height: height
        });
        
        planeEntity.setAttribute("material", {
          color: color,
          opacity: 0.8, // Plus visible pour debug
          transparent: true,
          wireframe: false,
          side: "double"
        });
        planeEntity.setAttribute("class", "scene-mesh spawn-surface collidable");
        planeEntity.id = `xr-plane-${planeId}`;

        this.el.sceneEl.appendChild(planeEntity);
        
        this.detectedPlanes.set(planeId, {
          entity: planeEntity,
          plane: plane,
          label: label,
          position: position,
          quaternion: quaternion,
          normal: normal
        });
        
        this.sceneMeshes.push(planeEntity);
        this.spawnSurfaces.push(planeEntity);
        newPlanesAdded = true;

        // Émettre événement pour le surface-detector
        this.el.sceneEl.emit("surface-detected", {
          position: position,
          quaternion: quaternion,
          normal: normal,
          width: width,
          height: height,
          stability: 1,
          isRealSurface: true
        });

        console.log(`✅ ${label} détecté - Taille: ${width.toFixed(2)}m x ${height.toFixed(2)}m`);
      }
    }
    
    // Émettre mise à jour des surfaces si de nouveaux planes ont été ajoutés
    if (newPlanesAdded) {
      this.emitSceneMeshUpdate();
      
      // Notifier qu'il y a des surfaces disponibles
      const realCount = this.spawnSurfaces.length;
      this.el.sceneEl.emit("surfaces-detected", {
        real: realCount,
        mesh: 0,
        hitTest: 0
      });
    }
  },

  emitSceneMeshUpdate: function () {
    this.el.sceneEl.emit("scene-mesh-updated", {
      surfaces: this.spawnSurfaces.slice(),
    });
  },

  updateAllSurfacesOpacity: function () {
    // Mettre à jour l'opacité de toutes les surfaces existantes
    for (const [planeId, planeData] of this.detectedPlanes.entries()) {
      if (planeData.entity) {
        planeData.entity.setAttribute("material", "opacity", this.surfaceOpacity);
      }
    }
    console.log(`📊 Opacité des surfaces mise à jour: ${this.surfaceOpacity}`);
  },

  createOrUpdateVisualSurface: function(position, quaternion, normal) {
    // Créer une clé unique basée sur la position (arrondie pour regrouper les surfaces proches)
    const key = `${Math.round(position.x * 2)}:${Math.round(position.y * 2)}:${Math.round(position.z * 2)}`;
    
    if (!this.visualSurfaces.has(key)) {
      // Créer une nouvelle surface visuelle
      const surfaceEntity = document.createElement("a-plane");
      
      
      let label = "Surface";
      
      
      surfaceEntity.setAttribute("position", `${position.x} ${position.y} ${position.z}`);
      
      // Convertir le quaternion en rotation Euler
      const euler = new THREE.Euler().setFromQuaternion(quaternion);
    surfaceEntity.setAttribute("rotation", {
      x: THREE.MathUtils.radToDeg(euler.x),
      y: THREE.MathUtils.radToDeg(euler.y), 
      z: THREE.MathUtils.radToDeg(euler.z)
    });
    
    surfaceEntity.setAttribute("width", 1);
      surfaceEntity.setAttribute("height", 1);
      surfaceEntity.setAttribute("material", {
        color: color,
        opacity: 0.5,
        transparent: true,
        wireframe: false,
        side: "double"
      });
      surfaceEntity.setAttribute("class", "scene-mesh spawn-surface");
      surfaceEntity.id = `detected-surface-${this.visualSurfaces.size}`;
      
      this.el.sceneEl.appendChild(surfaceEntity);
      this.visualSurfaces.set(key, {
        entity: surfaceEntity,
        lastUpdate: Date.now(),
        label: label
      });
      this.sceneMeshes.push(surfaceEntity);
      this.spawnSurfaces.push(surfaceEntity);
      
      console.log(`🔵 Surface détectée et visualisée: ${label} à (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    } else {
      // Mettre à jour le timestamp de la surface existante
      const surface = this.visualSurfaces.get(key);
      surface.lastUpdate = Date.now();
      
      // Mettre à jour la position
      surface.entity.setAttribute("position", `${position.x} ${position.y} ${position.z}`);
    }
    
    // Nettoyer les vieilles surfaces (non mises à jour depuis 5 secondes)
    const now = Date.now();
    for (const [key, surface] of this.visualSurfaces.entries()) {
      if (now - surface.lastUpdate > 5000) {
        if (surface.entity.parentNode) {
          surface.entity.parentNode.removeChild(surface.entity);
        }
        this.visualSurfaces.delete(key);
        const index = this.sceneMeshes.indexOf(surface.entity);
        if (index > -1) this.sceneMeshes.splice(index, 1);
      }
    }
  },

  getDetectedSurface: function () {
    if (this.detectedSurfaces.length === 0) return null;

    const surface = this.detectedSurfaces[0];
    const euler = new THREE.Euler().setFromQuaternion(surface.quaternion);

    return {
      position: surface.position,
      rotation: {
        x: THREE.MathUtils.radToDeg(euler.x),
        y: THREE.MathUtils.radToDeg(euler.y),
        z: THREE.MathUtils.radToDeg(euler.z),
      },
      normal: surface.normal,
      type: Math.abs(surface.normal.y) > 0.7 ? "horizontal" : "vertical",
      isRealSurface: true,
    };
  },

  isHitTestActive: function () {
    if (!this.xrSession || !this.hitTestSource) return false;
    if (this.hasHitTestThisFrame) return true;
    if (!this.lastResultTime) return false;
    return Date.now() - this.lastResultTime < 30000;
  },

  async createAnchor(pose) {
    if (!this.xrSession) return null;

    return new Promise((resolve) => {
      this.xrSession.requestAnimationFrame(async (time, frame) => {
        if (!frame || !frame.createAnchor) {
          resolve(null);
          return;
        }

        try {
          const anchor = await frame.createAnchor(pose, this.xrRefSpace);
          resolve(anchor || null);
        } catch (error) {
          resolve(null);
        }
      });
    });
  },

  deleteAnchor: function (anchor) {
    if (anchor && typeof anchor.delete === "function") {
      anchor.delete();
    }
  },

  stopSceneMeshDetection: function () {
    this.sceneMeshes.forEach((mesh) => {
      if (mesh.parentNode) mesh.parentNode.removeChild(mesh);
    });
    this.sceneMeshes = [];
    this.spawnSurfaces = [];
    this.hitTestSource = null;
    this.xrSession = null;
    this.xrRefSpace = null;
    this.detectedSurfaces = [];
    this.detectedPlanes.clear();
    this.planesEnabled = false;
  },

  remove: function () {
    this.stopSceneMeshDetection();
  },
});
