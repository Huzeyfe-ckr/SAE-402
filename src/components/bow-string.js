/**
 * Composant bow-string
 * Crée et anime la corde de l'arc en Three.js
 * La corde se courbe en fonction de la distance de tirage
 */

AFRAME.registerComponent('bow-string', {
  schema: {
    stringColor: { type: 'color', default: '#ffffff' }, // Couleur par défaut
    stringWidth: { type: 'number', default: 0.001 }, // Épaisseur
    topAnchor: { type: 'vec3', default: { x: 0, y: 0.35, z: 0 } }, // Point d'attache haut
    bottomAnchor: { type: 'vec3', default: { x: 0, y: -0.35, z: 0 } }, // Point d'attache bas
    restOffset: { type: 'number', default: 0.08 }, // Courbure au repos
    rotation: { type: 'vec3', default: { x: 0, y: 0, z: 0 } } // Rotation de la corde (en degrés)
  },

  init: function () {
    this.rightHand = null;
    this.leftHand = null;
    this.bowDrawSystem = null;

    this.isDrawing = false;
    this.currentDrawDistance = 0;

    this.tempVectorLeft = new THREE.Vector3();
    this.tempVectorRight = new THREE.Vector3();
    this.tempBowPosition = new THREE.Vector3();

    this.debugLog('🎻 INIT bow-string component');

    // Créer la géométrie de la corde
    this.createBowString();

    // Chercher les entités auxiliaires (mains et système de tir)
    this.findSystems();
  },

  debugLog: function (message) {
    const debugDiv = document.getElementById('debug-errors');
    if (debugDiv) {
      const errorList = document.getElementById('error-list');
      if (errorList) {
        const li = document.createElement('li');
        li.textContent = message;
        errorList.appendChild(li);
      }
    }
  },

  findSystems: function () {
    // Tenter de trouver les mains (hand-controls) et le bow-draw-system
    // Recherche courante : <a-entity hand-controls="hand: left"> etc.
    this.leftHand = document.querySelector('[hand-controls][hand="left"]') || document.querySelector('#leftHand') || null;
    this.rightHand = document.querySelector('[hand-controls][hand="right"]') || document.querySelector('#rightHand') || null;

    const bowDrawEntity = document.querySelector('[bow-draw-system]');
    if (bowDrawEntity && bowDrawEntity.components) {
      this.bowDrawSystem = bowDrawEntity.components['bow-draw-system'] || null;
      if (this.bowDrawSystem) {
        this.debugLog('✅ bow-draw-system connecté');
      }
    }

    this.debugLog(`Mains trouvées: left=${!!this.leftHand} right=${!!this.rightHand}`);
  },

  createBowString: function () {
    this.debugLog('Création de la corde...');

    const points = [];
    const segments = 20;

    // Initialiser avec des points droits (seront mis à jour dans tick)
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      points.push(new THREE.Vector3(0, -0.35 + (t * 0.7), 0));
    }

    // Créer la géométrie de tube qui suit la courbe
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, this.data.stringWidth, 8, false);

    const material = new THREE.MeshBasicMaterial({
      color: this.data.stringColor,
      side: THREE.DoubleSide
    });

    this.bowStringMesh = new THREE.Mesh(tubeGeometry, material);

    // Attacher à la SCÈNE (coordonnées monde)
    if (this.el && this.el.sceneEl && this.el.sceneEl.object3D) {
      this.el.sceneEl.object3D.add(this.bowStringMesh);
    }

    this.debugLog(`Mesh ajouté à la scène - Couleur: ${this.data.stringColor}`);

    // Garder une référence à la courbe pour la mettre à jour
    this.curve = curve;
    this.points = points;
    this.segments = segments;
    
    // Créer le quaternion de rotation locale
    this.localRotation = new THREE.Quaternion();
    this.localRotation.setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(this.data.rotation.x),
      THREE.MathUtils.degToRad(this.data.rotation.y),
      THREE.MathUtils.degToRad(this.data.rotation.z),
      'XYZ'
    ));

  },

  tick: function () {
    if (!this.bowStringMesh) return;

    // Si les mains n'ont pas été trouvées, essayer de les retrouver
    if (!this.leftHand || !this.rightHand || !this.bowDrawSystem) {
      this.findSystems();
    }

    // Vérifier si on est en train de tirer
    if (this.bowDrawSystem) {
      this.isDrawing = !!this.bowDrawSystem.isDrawing;
      this.currentDrawDistance = this.bowDrawSystem.drawDistance || 0;
    }

    if (!this.leftHand) return;

    // Obtenir la position de l'arc (main gauche) dans le référentiel monde
    this.leftHand.object3D.getWorldPosition(this.tempBowPosition);

    // Convertir les points d'ancrage locaux en coordonnées monde
    const topAnchor = new THREE.Vector3(
      this.data.topAnchor.x,
      this.data.topAnchor.y,
      this.data.topAnchor.z
    );
    const bottomAnchor = new THREE.Vector3(
      this.data.bottomAnchor.x,
      this.data.bottomAnchor.y,
      this.data.bottomAnchor.z
    );

    // Appliquer d'abord la rotation locale de la corde
    if (this.localRotation) {
      topAnchor.applyQuaternion(this.localRotation);
      bottomAnchor.applyQuaternion(this.localRotation);
    }

    // Transformer les ancrages par la rotation de la main gauche
    const bowRotation = new THREE.Quaternion();
    this.leftHand.object3D.getWorldQuaternion(bowRotation);
    topAnchor.applyQuaternion(bowRotation);
    bottomAnchor.applyQuaternion(bowRotation);

    // Ajouter la position de l'arc
    topAnchor.add(this.tempBowPosition);
    bottomAnchor.add(this.tempBowPosition);

    // Debug: positionner la sphère rouge au point du haut
    if (this.debugSphere) {
      this.debugSphere.position.copy(topAnchor);
    }

    let middlePoint;

    if (this.isDrawing && this.rightHand) {
      // Quand on tire : utiliser la position de la main droite
      this.rightHand.object3D.getWorldPosition(this.tempVectorRight);
      middlePoint = this.tempVectorRight.clone();
    } else {
      // Au repos : courber légèrement la corde vers l'avant
      middlePoint = new THREE.Vector3(
        (topAnchor.x + bottomAnchor.x) / 2,
        (topAnchor.y + bottomAnchor.y) / 2,
        (topAnchor.z + bottomAnchor.z) / 2
      );

      // Ajouter un léger offset vers l'avant (direction locale)
      const forwardDir = new THREE.Vector3(0, 0, this.data.restOffset);
      forwardDir.applyQuaternion(bowRotation);
      middlePoint.add(forwardDir);
    }

    // Mettre à jour la courbe avec une courbe de Bézier quadratique
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const oneMinusT = 1 - t;
      const point = this.points[i];

      point.x = oneMinusT * oneMinusT * topAnchor.x +
                2 * oneMinusT * t * middlePoint.x +
                t * t * bottomAnchor.x;

      point.y = oneMinusT * oneMinusT * topAnchor.y +
                2 * oneMinusT * t * middlePoint.y +
                t * t * bottomAnchor.y;

      point.z = oneMinusT * oneMinusT * topAnchor.z +
                2 * oneMinusT * t * middlePoint.z +
                t * t * bottomAnchor.z;
    }

    // Reconstruire la géométrie du tube avec la nouvelle courbe
    this.curve.points = this.points;

    // Remplacer géométrie
    if (this.bowStringMesh.geometry) {
      this.bowStringMesh.geometry.dispose();
    }
    this.bowStringMesh.geometry = new THREE.TubeGeometry(
      this.curve,
      this.segments,
      this.data.stringWidth,
      8,
      false
    );
  },

  remove: function () {
    if (this.bowStringMesh) {
      if (this.bowStringMesh.geometry) this.bowStringMesh.geometry.dispose();
      if (this.bowStringMesh.material) this.bowStringMesh.material.dispose();
      if (this.el && this.el.sceneEl && this.el.sceneEl.object3D) {
        this.el.sceneEl.object3D.remove(this.bowStringMesh);
      }
      this.bowStringMesh = null;
    }

    if (this.debugSphere) {
      if (this.debugSphere.geometry) this.debugSphere.geometry.dispose();
      if (this.debugSphere.material) this.debugSphere.material.dispose();
      if (this.el && this.el.sceneEl && this.el.sceneEl.object3D) {
        this.el.sceneEl.object3D.remove(this.debugSphere);
      }
      this.debugSphere = null;
    }
  }
});
