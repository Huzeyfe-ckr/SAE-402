/**
 * Système game-manager pour A-Frame
 * Gère le cycle de jeu, le spawn des cibles et le score global
 * Spawn sur les murs créés par wall-debug
 */

import { TARGET_TYPES, getRandomTargetType, createTargetHTML } from "../config/target-types.js";

AFRAME.registerSystem("game-manager", {
  schema: {
    spawnInterval: { type: "number", default: 5 }, // 50ms entre les spawns, réduit pour plus de dynamisme
    maxTargets: { type: "number", default: 12 }, // Réduit de 30 pour moins de lag
    difficulty: { type: "string", default: "normal" }, // easy, normal, hard
    requireRealSurfaces: { type: "boolean", default: true },
  },

  init: function () {
    this.activeTargets = [];
    this.totalScore = 0;
    this.totalArrowsShot = 0;
    this.totalHits = 0;
    this.spawnTimer = null;
    this.gameRunning = false;
    this.surfacesReady = false;
    this.surfaceDetector = null;
    this.sceneMeshHandler = null;
    this.wallDebug = null; // Référence au composant wall-debug
    this.anchorManager = null;
    this.useAnchors = false;
    this.firstTargetSpawned = false;

    this.el.addEventListener("target-hit", this.onTargetHit.bind(this));
    this.el.addEventListener("target-destroyed", this.onTargetDestroyed.bind(this));
    this.el.addEventListener("arrow-shot", this.onArrowShot.bind(this));

    this.el.addEventListener("anchor-manager-ready", () => {
      const anchorManagerEl = this.el.querySelector("[webxr-anchor-manager]");
      if (anchorManagerEl && anchorManagerEl.components["webxr-anchor-manager"]) {
        this.anchorManager = anchorManagerEl.components["webxr-anchor-manager"];
        this.useAnchors = true;
      }
    });

    // Écouter quand les murs sont prêts (wall-debug)
    this.el.addEventListener("walls-ready", (evt) => {
      const wallDebugEl = this.el.querySelector("[wall-debug]");
      if (wallDebugEl && wallDebugEl.components["wall-debug"]) {
        this.wallDebug = wallDebugEl.components["wall-debug"];
      }
    });

    this.el.addEventListener("scene-mesh-handler-ready", () => {
      const handlerEl = this.el.querySelector("[scene-mesh-handler]");
      if (handlerEl && handlerEl.components["scene-mesh-handler"]) {
        this.sceneMeshHandler = handlerEl.components["scene-mesh-handler"];
      }
    });

    this.el.addEventListener("surfaces-detected", (evt) => {
      const realCount = Number(evt.detail?.real || 0);
      const meshCount = Number(evt.detail?.mesh || 0);
      const hitTestCount = Number(evt.detail?.hitTest || 0);
      const hasRealSurface = realCount + meshCount + hitTestCount > 0;

      if (this.data.requireRealSurfaces && !hasRealSurface) {
        return;
      }

      this.surfacesReady = true;
      
      // Récupérer le wall-debug s'il existe
      const wallDebugEl = this.el.querySelector("[wall-debug]");
      if (wallDebugEl && wallDebugEl.components["wall-debug"]) {
        this.wallDebug = wallDebugEl.components["wall-debug"];
      }
      
      const detectorEl = this.el.querySelector("[surface-detector]");
      if (detectorEl && detectorEl.components["surface-detector"]) {
        this.surfaceDetector = detectorEl.components["surface-detector"];
      }

      if (!this.gameRunning) {
        this.startGame();
      }
    });

    this.el.addEventListener("start-game", () => {
      this.startGame();
    });

  },

  startGame: function () {
    if (this.gameRunning) return;

    this.gameRunning = true;
    this.totalScore = 0;
    this.totalHits = 0;
    this.totalArrowsShot = 0;
    this.gameTime = 1060;
    this.el.setAttribute("state", "gameStarted", true);

    const bgSound = document.getElementById("background-sound");
    if (bgSound) {
      bgSound.volume = 0.3;
      bgSound
        .play()
    }

    this.startTargetSpawning();
    this.createScoreDisplay();
    this.startCountdown();
  },

  startCountdown: function () {
    this.countdownTimer = setInterval(() => {
      this.gameTime--;
      this.updateTimerDisplay();


      if (this.gameTime <= 0) {
        this.endGame();
      }
    }, 1000);
  }, 

  updateTimerDisplay: function () {
    const timerEl = document.getElementById("timer-value");
    if (timerEl) {
      timerEl.textContent = this.gameTime;
      // Animation pulsante si moins de 3 secondes
      if (this.gameTime <= 3) {
        timerEl.classList.add("warning");
      } else {
        timerEl.classList.remove("warning");
      }
    }
  },

  endGame: function () {

    // Arrêter le jeu
    this.stopGame();

    // Arrêter le compte à rebours
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    // Arrêter la musique
    const bgSound = document.getElementById("background-sound");
    if (bgSound) {
      bgSound.pause();
    }

    // Émettre l'événement de fin de jeu pour cacher le HUD VR
    this.el.emit("game-ended");

    // Afficher le menu de fin
    this.showEndMenu();
  },

  showEndMenu: function () {
    // Créer l'entité du menu de fin
    const endMenu = document.createElement("a-entity");
    endMenu.setAttribute("end-menu", {
      score: this.totalScore,
      hits: this.totalHits,
      arrows: this.totalArrowsShot,
    });
    this.el.appendChild(endMenu);
  },

  startTargetSpawning: function () {
    this.spawnTimer = setInterval(() => {
      if (this.activeTargets.length >= this.data.maxTargets) return;
      if (!this.hasAvailableSurface()) return;
      this.spawnRandomTarget();
    }, this.data.spawnInterval);
  },

  hasAvailableSurface: function () {
    // Priorité 1: Utiliser les murs du wall-debug
    if (this.wallDebug && this.wallDebug.wallData && this.wallDebug.wallData.length > 0) {
      return true;
    }
    
    // Fallback: hit-test ou surface-detector
    if (this.sceneMeshHandler && this.sceneMeshHandler.isHitTestActive()) {
      const detected = this.sceneMeshHandler.getDetectedSurface();
      if (detected && detected.isRealSurface) return true;
    }

    if (!this.surfaceDetector || !this.surfaceDetector.surfaces) return false;

    const horizontal = this.surfaceDetector.surfaces.horizontal || [];
    const vertical = this.surfaceDetector.surfaces.vertical || [];
    const total = horizontal.length + vertical.length;
    if (total === 0) return false;

    if (!this.data.requireRealSurfaces) return true;

    const realHorizontal = horizontal.filter((s) => s.isRealSurface).length;
    const realVertical = vertical.filter((s) => s.isRealSurface).length;
    return realHorizontal + realVertical > 0;
  },

  calculateSpawnFromHitTest: function (detectedSurface) {
    const position = detectedSurface.position.clone
      ? detectedSurface.position.clone()
      : new THREE.Vector3(
          detectedSurface.position.x,
          detectedSurface.position.y,
          detectedSurface.position.z,
        );
    const normal = detectedSurface.normal.clone
      ? detectedSurface.normal.clone()
      : new THREE.Vector3(
          detectedSurface.normal.x,
          detectedSurface.normal.y,
          detectedSurface.normal.z,
        );

    const isCeiling = normal.y <= -0.5;
    const isHorizontal = normal.y >= 0.5;
    const isVertical = Math.abs(normal.y) < 0.4;

    let surfaceType = "vertical";
    let rotation = { x: 0, y: 0, z: 0 };

    // Privilégier les murs (surfaces verticales)
    if (isVertical) {
      surfaceType = "vertical";
      position.add(normal.clone().multiplyScalar(0.005));
      const qAlign = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        normal.clone().normalize(),
      );
      const eAlign = new THREE.Euler().setFromQuaternion(qAlign, "XYZ");
      rotation = {
        x: THREE.MathUtils.radToDeg(eAlign.x),
        y: THREE.MathUtils.radToDeg(eAlign.y),
        z: THREE.MathUtils.radToDeg(eAlign.z),
      };
    } else if (isHorizontal || isCeiling) {
      surfaceType = "horizontal";
      position.add(normal.clone().multiplyScalar(isCeiling ? 0.6 : 0.5));

      const camera = this.el.sceneEl.camera;
      if (camera) {
        const cameraPos = camera.getWorldPosition(new THREE.Vector3());
        const temp = new THREE.Object3D();
        temp.position.copy(position);
        temp.lookAt(cameraPos);
        rotation = { x: 0, y: THREE.MathUtils.radToDeg(temp.rotation.y), z: 0 };
        if (isCeiling) rotation.x = 180;
      }
    }

    return {
      position,
      rotation,
      surfaceType,
      isRealSurface: true,
      normal,
      isVertical,
    };
  },

  ensureFacingCamera: function (spawnData) {
    const camera = this.el.sceneEl.camera;
    if (!camera || !spawnData?.rotation) return;

    const position = spawnData.position instanceof THREE.Vector3
      ? spawnData.position
      : new THREE.Vector3(
          spawnData.position.x,
          spawnData.position.y,
          spawnData.position.z,
        );

    const cameraPos = camera.getWorldPosition(new THREE.Vector3());
    const toCamera = new THREE.Vector3()
      .subVectors(cameraPos, position)
      .normalize();

    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(spawnData.rotation.x || 0),
      THREE.MathUtils.degToRad(spawnData.rotation.y || 0),
      THREE.MathUtils.degToRad(spawnData.rotation.z || 0),
      "YXZ",
    );
    const forwardNegZ = new THREE.Vector3(0, 0, -1)
      .applyEuler(euler)
      .normalize();
    const forwardPosZ = new THREE.Vector3(0, 0, 1)
      .applyEuler(euler)
      .normalize();

    // Choisir l'axe qui regarde le plus la caméra, puis corriger si besoin
    if (forwardNegZ.dot(toCamera) < forwardPosZ.dot(toCamera)) {
      spawnData.rotation.y = (spawnData.rotation.y || 0) + 180;
    } else if (forwardNegZ.dot(toCamera) < 0) {
      spawnData.rotation.y = (spawnData.rotation.y || 0) + 180;
    }
  },

  /**
   * Calcule un point de spawn dans la zone centrale de la pièce (loin des murs)
   */
  calculateCenterSpawnPoint: function () {
    const camera = this.el.sceneEl.camera;
    const cameraPos = camera
      ? camera.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3(0, 1.6, 0);

    let roomCenterX = cameraPos.x;
    let roomCenterZ = cameraPos.z;
    let safeHalfX = 1.5; // demi-largueur sécurisée par défaut
    let safeHalfZ = 1.5;

    // Calculer les bornes réelles depuis les murs détectés
    if (this.wallDebug && this.wallDebug.wallData && this.wallDebug.wallData.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      this.wallDebug.wallData.forEach(w => {
        if (!w.isFloor && !w.isCeiling) {
          const halfW = (w.width || 2) / 2;
          minX = Math.min(minX, w.position.x - halfW);
          maxX = Math.max(maxX, w.position.x + halfW);
          minZ = Math.min(minZ, w.position.z - halfW);
          maxZ = Math.max(maxZ, w.position.z + halfW);
        }
      });

      if (minX !== Infinity) {
        roomCenterX = (minX + maxX) / 2;
        roomCenterZ = (minZ + maxZ) / 2;
        const wallMargin = 1.5; // 1.5m loin des murs
        safeHalfX = Math.max(0.5, (maxX - minX) / 2 - wallMargin);
        safeHalfZ = Math.max(0.5, (maxZ - minZ) / 2 - wallMargin);
      }
    }

    // Position aléatoire dans la zone centrale de la pièce
    const spawnX = roomCenterX + (Math.random() - 0.5) * 2 * safeHalfX;
    const spawnZ = roomCenterZ + (Math.random() - 0.5) * 2 * safeHalfZ;
    const spawnY = 1.6 + Math.random() * 1.2; // Entre 1.6m et 2.8m de hauteur

    const pos = new THREE.Vector3(spawnX, spawnY, spawnZ);

    // Orienter la cible vers le joueur
    const toCamera = new THREE.Vector3().subVectors(cameraPos, pos);
    const angleY = Math.atan2(toCamera.x, toCamera.z) * (180 / Math.PI);

    return {
      position: pos,
      rotation: { x: 0, y: angleY, z: 0 },
      surfaceType: "air",
      isRealSurface: true,
      normal: new THREE.Vector3(0, 0, 1)
    };
  },

  spawnRandomTarget: function () {
    const target = document.createElement("a-entity");
    const targetId = `target-${Date.now()}`;

    // Toujours spawner au centre de la pièce dans les airs
    let spawnData = this.calculateCenterSpawnPoint();

    if (!spawnData) return;

    const camera = this.el.sceneEl.camera;
    const cameraPos = camera
      ? camera.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3(0, 1.6, 0);

    const pos = spawnData.position instanceof THREE.Vector3
      ? spawnData.position
      : new THREE.Vector3(
          spawnData.position.x,
          spawnData.position.y,
          spawnData.position.z,
        );

    const distance = pos.distanceTo(cameraPos);
    if (distance < 0.5 || distance > 8) return;

    // Pas de filtre d'angle : cibles partout autour du joueur (360°)

    this.ensureFacingCamera(spawnData);

    const minDistance = 0.5;
    for (const existing of this.activeTargets) {
      if (!existing || !existing.object3D) continue;
      if (existing.object3D.position.distanceTo(pos) < minDistance) return;
    }

    const scale = 0.12 + Math.random() * 0.06; // Entre 0.12 et 0.18 - plus visible

    // Sélectionner un type de cible aléatoire
    const targetType = getRandomTargetType();

    let points = targetType.points;
    let hp = targetType.hp;
    let flySpeed = targetType.flySpeed * 0.8; // Réduire de 20% pour moins de lag

    if (this.data.difficulty === "hard") {
      points = Math.floor(points * 1.5);
      hp = Math.floor(Math.random() * 3) + 2;
      flySpeed *= 1.2; // Augmenter un peu pour hard mais pas trop
    } else if (this.data.difficulty === "normal") {
      points = Math.floor(points * 1.1);
      hp = Math.random() > 0.6 ? targetType.hp + 1 : targetType.hp;
      flySpeed *= 1.05;
    }

    if (spawnData.surfaceType === "vertical") {
      points = Math.floor(points * 1.2);
    }

    target.id = targetId;
    target.setAttribute("position", pos);
    target.setAttribute("rotation", spawnData.rotation);
    target.setAttribute("surface-type", spawnData.surfaceType || "random");

    // NE PAS utiliser static-body car ça bloque le mouvement
    // Les collisions sont gérées par arrow-physics

    // Créer la géométrie de la cible avec le bon type
    target.innerHTML = createTargetHTML(targetType);

    // IMPORTANT: Ajouter l'élément au DOM AVANT d'ajouter target-behavior
    // pour que tick() soit appelé correctement
    this.el.appendChild(target);
    this.activeTargets.push(target);
    this.firstTargetSpawned = true;

    // Les oiseaux volent toujours (movable: true)
    // Ajouter target-behavior APRÈS l'ajout au DOM
    target.setAttribute("target-behavior", {
      points,
      hp,
      movable: true,
      flySpeed,
      flyRadius: 2.0 + Math.random() * 2.0, // Rayon entre 2.0 et 4.0
      flyHeight: 0.3 + Math.random() * 0.4 // Variation hauteur entre 0.3 et 0.7
    });


    if (this.useAnchors && this.anchorManager) {
      setTimeout(() => {
        this.anchorTarget(target, pos, spawnData.rotation);
      }, 100);
    }
  },

  onTargetHit: function (evt) {
    const { points } = evt.detail;

    if (!points) return;

    this.totalHits++;
    const currentScore = this.totalScore;
    const newScore = currentScore + points;
    this.totalScore = newScore;
    this.el.setAttribute("state", "score", newScore);
    this.updateScoreDisplay();
  },

  onTargetDestroyed: function (evt) {
    const { bonusPoints } = evt.detail;
    this.activeTargets = this.activeTargets.filter((t) => t.parentNode);

    if (bonusPoints > 0) {
      const newScore = this.totalScore + bonusPoints;
      this.totalScore = newScore;
      this.el.setAttribute("state", "score", newScore);
    }

    this.updateScoreDisplay();
  },

  onArrowShot: function (evt) {
    this.totalArrowsShot++;
  },

  createScoreDisplay: function () {
    const hud = document.createElement("div");
    hud.id = "game-hud";
    hud.innerHTML = `
      <style>
        #game-hud {
          position: fixed;
          top: 20px;
          left: 20px;
          background: linear-gradient(135deg, #2d1b0e 0%, #4a3728 100%);
          border: 3px solid #d4af37;
          border-radius: 8px;
          padding: 15px 25px;
          font-family: 'Georgia', serif;
          color: #f4e4bc;
          z-index: 1000;
          pointer-events: none;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3);
          min-width: 180px;
        }
        #game-hud .hud-title {
          text-align: center;
          font-size: 14px;
          color: #d4af37;
          border-bottom: 2px solid #d4af37;
          padding-bottom: 8px;
          margin-bottom: 12px;
          letter-spacing: 2px;
        }
        #game-hud .hud-timer {
          text-align: center;
          font-size: 42px;
          font-weight: bold;
          color: #fff;
          text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
          margin: 8px 0;
        }
        #game-hud .hud-timer-label {
          text-align: center;
          font-size: 12px;
          color: #d4af37;
          margin-bottom: 12px;
        }
        #game-hud .hud-timer.warning {
          color: #e74c3c;
          animation: pulse-warning 0.5s ease-in-out infinite;
        }
        @keyframes pulse-warning {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        #game-hud .hud-stat {
          display: flex;
          justify-content: space-between;
          margin: 6px 0;
          font-size: 16px;
        }
        #game-hud .hud-stat-label {
          color: #d4af37;
        }
        #game-hud .hud-stat-value {
          color: #fff;
          font-weight: bold;
        }
        #game-hud .hud-separator {
          height: 1px;
          background: linear-gradient(90deg, transparent, #d4af37, transparent);
          margin: 10px 0;
        }
      </style>
      <div class="hud-title">⚔️ HUNT IN PROGRESS ⚔️</div>
      <div class="hud-timer" id="timer-value">10</div>
      <div class="hud-timer-label">seconds remaining</div>
      <div class="hud-separator"></div>
      <div class="hud-stat">
        <span class="hud-stat-label">Loot:</span>
        <span class="hud-stat-value" id="score-value">0</span>
      </div>
      <div class="hud-stat">
        <span class="hud-stat-label">Targets:</span>
        <span class="hud-stat-value" id="targets-value">0</span>
      </div>
    `;
    document.body.appendChild(hud);
  },

  updateScoreDisplay: function () {
    const scoreEl = document.getElementById("score-value");
    const targetsEl = document.getElementById("targets-value");

    if (scoreEl) {
      scoreEl.textContent = this.totalScore;
    }

    if (targetsEl) {
      targetsEl.textContent = this.activeTargets.length;
    }
  },

  anchorTarget: async function (target, position, rotation) {
    if (!this.anchorManager) return;

    try {
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rotation.x || 0),
        THREE.MathUtils.degToRad(rotation.y || 0),
        THREE.MathUtils.degToRad(rotation.z || 0),
        "XYZ",
      );
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      const anchorId = await this.anchorManager.createAnchor({
        position: new THREE.Vector3(position.x, position.y, position.z),
        quaternion,
      });

      if (anchorId) {
        this.anchorManager.attachToAnchor(target, anchorId);
      }
    } catch (error) {
    }
  },

  stopGame: function () {
    this.gameRunning = false;
    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }
  },

  tick: function (time, deltaTime) {
    // Mise à jour périodique si nécessaire
    if (this.gameRunning && time % 1000 < 16) {
      this.updateScoreDisplay();
    }
  },
});
