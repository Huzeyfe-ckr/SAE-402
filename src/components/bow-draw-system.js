AFRAME.registerComponent("bow-draw-system", {
  schema: {
    maxArrowSpeed: { type: "number", default: 80 }, // Vitesse maximale de la flèche
    minArrowSpeed: { type: "number", default: 8 },
    maxDrawDistance: { type: "number", default: 0.45 }, // Distance maximale de tirage en mètres des mains
    minDrawDistance: { type: "number", default: 0.25 }, // Distance minimale pour tirer (ANTI-EXPLOIT: augmenté de 0.12 à 0.25m)
    snapDistance: { type: "number", default: 0.2 }, // Distance pour "accrocher" la corde
    shotCooldown: { type: "number", default: 500 }, // Cooldown entre les tirs en ms (ANTI-EXPLOIT)
  },

  init: function () {
    this.leftHand = null;
    this.rightHand = null;

    this.isDrawing = false;
    this.drawDistance = 0;
    this.triggerPressed = false;
    this.lastShotTime = 0; // ANTI-EXPLOIT: tracker le dernier tir
    this.canShoot = true; // ANTI-EXPLOIT: flag de cooldown

    this.tempVectorLeft = new THREE.Vector3();
    this.tempVectorRight = new THREE.Vector3();

    // Indicateur visuel de la corde tendue
    this.createDrawIndicator();

  },

  play: function () {
    // Récupérer les références des mains
    this.leftHand = document.querySelector("#leftHand");
    this.rightHand = document.querySelector("#rightHand");

    if (!this.leftHand || !this.rightHand) {
      setTimeout(() => this.play(), 500);
      return;
    }

    // Événements de la gâchette droite
    this.onTriggerDown = this.handleTriggerDown.bind(this);
    this.onTriggerUp = this.handleTriggerUp.bind(this);

    this.rightHand.addEventListener("triggerdown", this.onTriggerDown);
    this.rightHand.addEventListener("triggerup", this.onTriggerUp);
    this.rightHand.addEventListener("abuttondown", this.onTriggerDown);
    this.rightHand.addEventListener("abuttonup", this.onTriggerUp);

  },

  createDrawIndicator: function () {
    // Ligne visuelle pour montrer la corde tendue
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([0, 0, 0, 0, 0, 0]);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 3,
      transparent: true,
      opacity: 0.8,
    });

    this.drawLine = new THREE.Line(geometry, material);
    this.drawLine.visible = false;
    this.el.sceneEl.object3D.add(this.drawLine);

    // Sphère pour montrer où est la main droite
    const sphereGeo = new THREE.SphereGeometry(0.03, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.6,
    });
    this.handIndicator = new THREE.Mesh(sphereGeo, sphereMat);
    this.handIndicator.visible = false;
    this.el.sceneEl.object3D.add(this.handIndicator);

    // ANTI-EXPLOIT: Indicateur de puissance (anneau qui change de taille)
    const ringGeo = new THREE.RingGeometry(0.05, 0.06, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    this.powerRing = new THREE.Mesh(ringGeo, ringMat);
    this.powerRing.visible = false;
    this.el.sceneEl.object3D.add(this.powerRing);
  },

  handleTriggerDown: function () {
    if (!this.leftHand || !this.rightHand) return;

    this.triggerPressed = true;

    // Vérifier si les mains sont assez proches pour "accrocher" la corde
    this.leftHand.object3D.getWorldPosition(this.tempVectorLeft);
    this.rightHand.object3D.getWorldPosition(this.tempVectorRight);

    const distance = this.tempVectorLeft.distanceTo(this.tempVectorRight);

    if (distance < this.data.snapDistance) {
      this.isDrawing = true;
      this.drawLine.visible = true; // Afficher la ligne de puissance
      this.handIndicator.visible = true; // Afficher l'indicateur de main

      // Son de grincement de la corde
      const creakSound = document.getElementById("bow-creak-sound");
      if (creakSound) {
        creakSound.currentTime = 0;
        creakSound.play().catch((e) => {});
      }
    }
  },

  handleTriggerUp: function () {
    this.triggerPressed = false;

    if (this.isDrawing) {
      // Tirer la flèche !
      this.shootArrow();
      this.isDrawing = false;
      this.drawLine.visible = false;
      this.handIndicator.visible = false;
      
      // CORRECTION: Reset immédiat de l'indicateur de puissance après le tir
      if (this.powerRing) {
        this.powerRing.visible = false;
        this.powerRing.scale.set(0.5, 0.5, 1); // Taille minimale
      }
      this.drawDistance = 0; // Reset la distance de tirage
    }
  },

  tick: function () {
    if (!this.isDrawing || !this.leftHand || !this.rightHand) return;

    // Calculer la distance de tirage
    this.leftHand.object3D.getWorldPosition(this.tempVectorLeft);
    this.rightHand.object3D.getWorldPosition(this.tempVectorRight);

    this.drawDistance = this.tempVectorLeft.distanceTo(this.tempVectorRight);

    // Mettre à jour la ligne visuelle
    const positions = this.drawLine.geometry.attributes.position.array;
    positions[0] = this.tempVectorLeft.x;
    positions[1] = this.tempVectorLeft.y;
    positions[2] = this.tempVectorLeft.z;
    positions[3] = this.tempVectorRight.x;
    positions[4] = this.tempVectorRight.y;
    positions[5] = this.tempVectorRight.z;
    this.drawLine.geometry.attributes.position.needsUpdate = true;

    // Mettre à jour l'indicateur de main
    this.handIndicator.position.copy(this.tempVectorRight);

    // Changer la couleur en fonction de la puissance
    const drawRatio = Math.min(
      this.drawDistance / this.data.maxDrawDistance,
      1,
    );
    const color = new THREE.Color();
    
    // ANTI-EXPLOIT: Couleur rouge si distance insuffisante
    const isValidDraw = this.drawDistance >= this.data.minDrawDistance;
    if (isValidDraw) {
      color.setHSL(0.3 - drawRatio * 0.3, 1.0, 0.5); // De vert à rouge
    } else {
      color.setRGB(0.5, 0.0, 0.0); // Rouge sombre si invalide
    }
    
    this.drawLine.material.color = color;
    this.handIndicator.material.color = color;

    // ANTI-EXPLOIT: Afficher l'anneau de puissance à la main gauche
    if (this.powerRing) {
      this.powerRing.visible = true;
      this.powerRing.position.copy(this.tempVectorLeft);
      this.powerRing.lookAt(this.el.sceneEl.camera.getWorldPosition(new THREE.Vector3()));
      
      // Taille de l'anneau en fonction de la puissance
      const ringScale = 0.5 + drawRatio * 1.5;
      this.powerRing.scale.set(ringScale, ringScale, 1);
      this.powerRing.material.color.copy(color);
      this.powerRing.material.opacity = isValidDraw ? 0.8 : 0.4;
    }
  },

  shootArrow: function () {
    // ANTI-EXPLOIT: Vérifier le cooldown
    const now = Date.now();
    if (now - this.lastShotTime < this.data.shotCooldown) {
      const remaining = ((this.data.shotCooldown - (now - this.lastShotTime)) / 1000).toFixed(1);
      
      // Son d'erreur
      const errorSound = document.getElementById("error-sound");
      if (errorSound) {
        errorSound.currentTime = 0;
        errorSound.volume = 0.3;
        errorSound.play().catch((e) => {});
      }
      return;
    }

    // ANTI-EXPLOIT: Vérifier la distance minimale (25cm)
    if (this.drawDistance < this.data.minDrawDistance) {
      
      // Feedback visuel: flash rouge
      if (this.handIndicator) {
        this.handIndicator.material.color.setRGB(1.0, 0.0, 0.0);
        this.handIndicator.material.opacity = 1.0;
      }
      
      // Son d'erreur
      const errorSound = document.getElementById("error-sound");
      if (errorSound) {
        errorSound.currentTime = 0;
        errorSound.volume = 0.5;
        errorSound.play().catch((e) => {});
      }
      
      // Vibration haptique sur les contrôleurs (WebXR native)
      try {
        const session = this.el.sceneEl.renderer.xr.getSession();
        if (session && session.inputSources) {
          session.inputSources.forEach(source => {
            if (source.gamepad && source.gamepad.hapticActuators && source.gamepad.hapticActuators[0]) {
              source.gamepad.hapticActuators[0].pulse(0.5, 100); // intensité 0.5, durée 100ms
            }
          });
        }
      } catch (e) {
        // Pas de support haptique
      }
      
      return;
    }

    // Calcul puissance
    const drawRatio = Math.min(
      this.drawDistance / this.data.maxDrawDistance,
      1,
    );
    const arrowSpeed =
      this.data.minArrowSpeed +
      (this.data.maxArrowSpeed - this.data.minArrowSpeed) * drawRatio;

    // --- DIRECTION : Basée sur l'orientation de la main gauche (arc) ---
    this.leftHand.object3D.getWorldPosition(this.tempVectorLeft);
    this.rightHand.object3D.getWorldPosition(this.tempVectorRight);
    
    // La flèche part dans la direction où pointe la main gauche (l'arc)
    // On utilise l'axe Y négatif car le contrôleur pointe vers le haut par défaut
    const shootDirection = new THREE.Vector3(0, -1, 0);
    const leftHandQuat = this.leftHand.object3D.getWorldQuaternion(new THREE.Quaternion());
    shootDirection.applyQuaternion(leftHandQuat);
    shootDirection.normalize();
    
    // Créer le quaternion de rotation pour la flèche
    const aimQuaternion = new THREE.Quaternion();
    aimQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), shootDirection);

    // Son de tir de l'arc
    const shootSound = document.getElementById("shoot-sound");
    if (shootSound) {
      shootSound.currentTime = 0;
      shootSound.play().catch((e) => {});
    }

    // Son de sifflement de la flèche
    const arrowFlySound = document.getElementById("arrow-fly-sound");
    if (arrowFlySound) {
      arrowFlySound.currentTime = 0;
      arrowFlySound.play().catch((e) => {});
    }

    // Tirer avec la nouvelle rotation calculée
    this.createFlyingArrow(this.tempVectorLeft, aimQuaternion, arrowSpeed);

    // Émettre l'événement pour le compteur de flèches
    this.el.sceneEl.emit("arrow-shot");
    
    // ANTI-EXPLOIT: Enregistrer le temps du dernier tir
    this.lastShotTime = Date.now();
    this.canShoot = false;
    
    // ANTI-EXPLOIT: Réactiver après le cooldown
    setTimeout(() => {
      this.canShoot = true;
    }, this.data.shotCooldown);
  },

  createFlyingArrow: function (position, rotation, speed) {
    const scene = this.el.sceneEl;
    const arrow = document.createElement("a-entity");

    arrow.setAttribute("gltf-model", "fleche.glb");
    arrow.setAttribute("position", position);
    arrow.object3D.quaternion.copy(rotation);
    arrow.setAttribute("arrow-physics", `speed: ${speed}`);

    scene.appendChild(arrow);
  },

  /**
   * Désactiver le laser blanc des manettes au lancement du jeu
   * Appelé quand "Lancer la game" est pressé
   */
  disableLasers: function () {
    
    if (this.leftHand) {
      this.leftHand.removeAttribute('laser-controls');
      const raycaster = this.leftHand.components.raycaster;
      if (raycaster) {
        this.leftHand.setAttribute('raycaster', 'enabled', false);
      }
    }
    
    if (this.rightHand) {
      this.rightHand.removeAttribute('laser-controls');
      const raycaster = this.rightHand.components.raycaster;
      if (raycaster) {
        this.rightHand.setAttribute('raycaster', 'enabled', false);
      }
    }
  },

  remove: function () {
    if (this.rightHand) {
      this.rightHand.removeEventListener("triggerdown", this.onTriggerDown);
      this.rightHand.removeEventListener("triggerup", this.onTriggerUp);
      this.rightHand.removeEventListener("abuttondown", this.onTriggerDown);
      this.rightHand.removeEventListener("abuttonup", this.onTriggerUp);
    }
    if (this.drawLine) this.el.sceneEl.object3D.remove(this.drawLine);
    if (this.handIndicator) this.el.sceneEl.object3D.remove(this.handIndicator);
    if (this.powerRing) this.el.sceneEl.object3D.remove(this.powerRing); // ANTI-EXPLOIT: nettoyer l'anneau
  },
});
