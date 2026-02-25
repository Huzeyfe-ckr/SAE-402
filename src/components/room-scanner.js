/**
 * Composant room-scanner pour A-Frame
 * Gère la phase de scan de la pièce avant le jeu
 * Détecte les murs, le sol, le plafond et les obstacles
 */

AFRAME.registerComponent("room-scanner", {
  schema: {
    minWalls: { type: "number", default: 3 },
    minSurfaces: { type: "number", default: 4 },
    scanDuration: { type: "number", default: 30000 }, // 30 secondes max
  },

  init: function () {
    this.isScanning = false;
    this.scanComplete = false;
    this.detectedWalls = new Set();
    this.detectedSurfaces = [];
    this.scanStartTime = 0;
    this.scanUI = null;

    // Écouter les événements de surface
    this.el.sceneEl.addEventListener("surface-detected", (evt) => {
      if (this.isScanning) {
        this.onSurfaceDetected(evt.detail);
      }
    });

    // Écouter l'entrée en VR
    this.el.sceneEl.addEventListener("enter-vr", () => {
      setTimeout(() => {
        this.startScan();
      }, 1000);
    });

  },

  startScan: function () {
    if (this.isScanning || this.scanComplete) return;

    this.isScanning = true;
    this.scanStartTime = Date.now();
    this.detectedWalls.clear();
    this.detectedSurfaces = [];

    // Créer l'UI de scan
    this.createScanUI();

    // Activer la visualisation des surfaces
    this.enableSurfaceVisualization();

    // Émettre l'événement de début de scan
    this.el.sceneEl.emit("room-scan-started");
  },

  createScanUI: function () {
    const camera = this.el.sceneEl.camera.el;
    this.scanUI = document.createElement("a-entity");
    this.scanUI.setAttribute("position", "0 0 -1.5");

    // Panneau de fond
    const panel = document.createElement("a-entity");
    panel.setAttribute("geometry", {
      primitive: "plane",
      width: 1.2,
      height: 0.6,
    });
    panel.setAttribute("material", {
      color: "#2d1b0e",
      opacity: 0.9,
      shader: "flat",
    });
    this.scanUI.appendChild(panel);

    // Titre
    const title = document.createElement("a-text");
    title.setAttribute("id", "scan-title");
    title.setAttribute("value", "🔍 SCAN DE LA PIÈCE");
    title.setAttribute("position", "0 0.2 0.01");
    title.setAttribute("align", "center");
    title.setAttribute("color", "#d4af37");
    title.setAttribute("width", "1.8");
    this.scanUI.appendChild(title);

    // Instructions
    const instructions = document.createElement("a-text");
    instructions.setAttribute("id", "scan-instructions");
    instructions.setAttribute("value", "Regardez autour de vous\npour détecter les murs");
    instructions.setAttribute("position", "0 0.05 0.01");
    instructions.setAttribute("align", "center");
    instructions.setAttribute("color", "#f4e4bc");
    instructions.setAttribute("width", "1.5");
    this.scanUI.appendChild(instructions);

    // Compteur de surfaces
    const counter = document.createElement("a-text");
    counter.setAttribute("id", "scan-counter");
    counter.setAttribute("value", "Surfaces: 0");
    counter.setAttribute("position", "0 -0.1 0.01");
    counter.setAttribute("align", "center");
    counter.setAttribute("color", "#ffffff");
    counter.setAttribute("width", "1.5");
    this.scanUI.appendChild(counter);

    // Bouton de démarrage (invisible au début, visible quand scan OK)
    const button = document.createElement("a-entity");
    button.setAttribute("id", "scan-start-button");
    button.setAttribute("geometry", {
      primitive: "plane",
      width: 0.6,
      height: 0.15,
    });
    button.setAttribute("material", {
      color: "#4CAF50",
      opacity: 0,
      shader: "flat",
    });
    button.setAttribute("position", "0 -0.25 0.01");
    button.setAttribute("class", "arrow-targetable");
    this.scanButton = button;
    this.scanButtonWorldPos = new THREE.Vector3();
    this.scanUI.appendChild(button);

    const buttonText = document.createElement("a-text");
    buttonText.setAttribute("id", "scan-button-text");
    buttonText.setAttribute("value", "");
    buttonText.setAttribute("position", "0 -0.25 0.02");
    buttonText.setAttribute("align", "center");
    buttonText.setAttribute("color", "#ffffff");
    buttonText.setAttribute("width", "1");
    this.scanUI.appendChild(buttonText);

    camera.appendChild(this.scanUI);
  },

  enableSurfaceVisualization: function () {
    // Rendre les surfaces visibles pendant le scan
    this.el.sceneEl.emit("enable-surface-visualization", { opacity: 0.6 });
  },

  onSurfaceDetected: function (surfaceData) {
    // Classifier la surface
    const normal = surfaceData.normal;
    const position = surfaceData.position;

    let surfaceType = "other";
    if (normal.y > 0.7) {
      surfaceType = "floor";
    } else if (normal.y < -0.7) {
      surfaceType = "ceiling";
    } else if (Math.abs(normal.y) < 0.5) {
      surfaceType = "wall";
      
      // Déterminer quelle direction de mur
      const wallDir = new THREE.Vector3(normal.x, 0, normal.z).normalize();
      let wallName;
      if (Math.abs(wallDir.x) > Math.abs(wallDir.z)) {
        wallName = wallDir.x > 0 ? "east" : "west";
      } else {
        wallName = wallDir.z > 0 ? "south" : "north";
      }
      this.detectedWalls.add(wallName);
    }

    this.detectedSurfaces.push({
      type: surfaceType,
      position,
      normal,
      timestamp: Date.now(),
    });

    // Mettre à jour l'UI
    this.updateScanUI();
  },

  updateScanUI: function () {
    if (!this.scanUI) return;

    const counter = this.scanUI.querySelector("#scan-counter");
    const instructions = this.scanUI.querySelector("#scan-instructions");
    const button = this.scanUI.querySelector("#scan-start-button");
    const buttonText = this.scanUI.querySelector("#scan-button-text");

    const wallCount = this.detectedWalls.size;
    const totalSurfaces = this.detectedSurfaces.length;

    counter.setAttribute("value", `Surfaces: ${totalSurfaces} | Murs: ${wallCount}/4`);

    // Vérifier si le scan est suffisant
    const hasEnoughSurfaces = totalSurfaces >= this.data.minSurfaces;
    const hasEnoughWalls = wallCount >= this.data.minWalls;

    if (hasEnoughSurfaces && hasEnoughWalls) {
      instructions.setAttribute("value", "✅ Scan complet !\nTirez une flèche pour démarrer");
      instructions.setAttribute("color", "#4CAF50");
      
      // Afficher le bouton
      button.setAttribute("material", "opacity", 1);
      buttonText.setAttribute("value", "🎯 TIREZ ICI");
    } else {
      let message = "Regardez autour de vous\n";
      if (!hasEnoughWalls) {
        message += `Trouvez ${this.data.minWalls - wallCount} mur(s) de plus`;
      } else if (!hasEnoughSurfaces) {
        message += `Trouvez ${this.data.minSurfaces - totalSurfaces} surface(s) de plus`;
      }
      instructions.setAttribute("value", message);
    }
  },

  completeScan: function () {
    if (!this.isScanning) return;


    this.isScanning = false;
    this.scanComplete = true;

    // Masquer l'UI de scan
    if (this.scanUI && this.scanUI.parentNode) {
      this.scanUI.parentNode.removeChild(this.scanUI);
      this.scanUI = null;
    }

    // Rendre les surfaces invisibles après le scan
    this.el.sceneEl.emit("disable-surface-visualization");

    // Émettre l'événement de scan terminé
    this.el.sceneEl.emit("room-scan-complete", {
      surfaces: this.detectedSurfaces,
      walls: Array.from(this.detectedWalls),
    });

    // Démarrer le jeu
    this.el.sceneEl.emit("start-game");
  },

  // Détection de collision avec une flèche
  checkArrowHit: function (arrowPosition) {
    if (!this.isScanning || !this.scanButton) return false;

    this.scanButton.object3D.getWorldPosition(this.scanButtonWorldPos);
    const distance = arrowPosition.distanceTo(this.scanButtonWorldPos);

    // Rayon de détection 0.35m (taille du bouton ~0.6m)
    if (distance < 0.35) {
      this.completeScan();
      return true;
    }

    return false;
  },

  tick: function (time, deltaTime) {
    if (!this.isScanning) return;

    // Auto-complétion après la durée max
    const elapsed = Date.now() - this.scanStartTime;
    if (elapsed > this.data.scanDuration) {
      const hasMinimum = this.detectedSurfaces.length >= this.data.minSurfaces;
      if (hasMinimum) {
        this.completeScan();
      }
    }
  },
});
