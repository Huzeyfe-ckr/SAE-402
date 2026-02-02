AFRAME.registerComponent("bow-draw-system", {
  schema: {
    maxArrowSpeed: { type: "number", default: 30 },
    minArrowSpeed: { type: "number", default: 10 },
    maxDrawDistance: { type: "number", default: 0.5 }, // Distance maximale de tirage en mètres
    minDrawDistance: { type: "number", default: 0.15 }, // Distance minimale pour tirer
    snapDistance: { type: "number", default: 0.2 }, // Distance pour "accrocher" la corde
  },

  init: function () {
    this.leftHand = null;
    this.rightHand = null;

    this.isDrawing = false;
    this.drawDistance = 0;
    this.triggerPressed = false;

    this.tempVectorLeft = new THREE.Vector3();
    this.tempVectorRight = new THREE.Vector3();

    // Indicateur visuel de la corde tendue
    this.createDrawIndicator();

    console.log("🏹 Bow Draw System initialisé");
  },

  play: function () {
    // Récupérer les références des mains
    this.leftHand = document.querySelector("#leftHand");
    this.rightHand = document.querySelector("#rightHand");

    if (!this.leftHand || !this.rightHand) {
      console.warn("⚠️ Mains non trouvées, retry...");
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

    console.log("✅ Events attachés aux mains");
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
      this.drawLine.visible = true;
      this.handIndicator.visible = true;
      console.log("🎯 Corde accrochée !");

      // Son de grincement de la corde
      const creakSound = document.getElementById("bow-creak-sound");
      if (creakSound) {
        creakSound.currentTime = 0;
        creakSound.play().catch((e) => {});
      }
    } else {
      console.log(
        `❌ Trop loin pour accrocher (${distance.toFixed(2)}m > ${this.data.snapDistance}m)`,
      );
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
    color.setHSL(0.3 - drawRatio * 0.3, 1.0, 0.5); // De vert à rouge
    this.drawLine.material.color = color;
    this.handIndicator.material.color = color;
  },

  shootArrow: function () {
    if (this.drawDistance < this.data.minDrawDistance) {
      console.log("⚠️ Pas assez tiré !");
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

    // --- CORRECTION MAJEURE : VECTEUR DE VISÉE ---
    this.leftHand.object3D.getWorldPosition(this.tempVectorLeft);
    this.rightHand.object3D.getWorldPosition(this.tempVectorRight);

    // 1. Calculer la direction : De la main droite (corde) VERS la main gauche (arc)
    const aimDirection = new THREE.Vector3();
    aimDirection
      .subVectors(this.tempVectorLeft, this.tempVectorRight)
      .normalize();

    // 2. Créer une rotation (Quaternion) basée sur ce vecteur
    // On dit à A-Frame : "Tourne l'objet pour que son avant (-Z) s'aligne sur aimDirection"
    const aimQuaternion = new THREE.Quaternion();
    aimQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), aimDirection);

    console.log(
      `🏹 TIRE ! Distance: ${this.drawDistance.toFixed(2)}m, Puissance: ${(drawRatio * 100).toFixed(0)}%, Vitesse: ${arrowSpeed.toFixed(1)}`,
    );
    console.log("🎯 Direction visée:", {
      x: aimDirection.x.toFixed(2),
      y: aimDirection.y.toFixed(2),
      z: aimDirection.z.toFixed(2),
    });

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

  remove: function () {
    if (this.rightHand) {
      this.rightHand.removeEventListener("triggerdown", this.onTriggerDown);
      this.rightHand.removeEventListener("triggerup", this.onTriggerUp);
      this.rightHand.removeEventListener("abuttondown", this.onTriggerDown);
      this.rightHand.removeEventListener("abuttonup", this.onTriggerUp);
    }
    if (this.drawLine) this.el.sceneEl.object3D.remove(this.drawLine);
    if (this.handIndicator) this.el.sceneEl.object3D.remove(this.handIndicator);
  },
});
