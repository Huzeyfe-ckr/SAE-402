/**
 * Composant bow-string
 * Crée et anime la corde de l'arc en Three.js
 * La corde se courbe en fonction de la distance de tirage
 */

AFRAME.registerComponent('bow-string', {
  schema: {
    stringColor: { type: 'color', default: '#8B4513' }, // Couleur marron pour la corde
    stringWidth: { type: 'number', default: 0.003 }, // Épaisseur de la corde
    topAnchor: { type: 'vec3', default: { x: 0, y: 0.4, z: 0 } }, // Point d'attache haut
    bottomAnchor: { type: 'vec3', default: { x: 0, y: -0.4, z: 0 } }, // Point d'attache bas
    restOffset: { type: 'number', default: 0.05 } // Courbure au repos
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
    
    // Créer la géométrie de la corde
    this.createBowString();
    
    console.log('🎻 Corde de l\'arc créée');
  },

  play: function() {
    // Récupérer les références des mains
    this.leftHand = document.querySelector('#leftHand');
    this.rightHand = document.querySelector('#rightHand');
    
    if (!this.leftHand || !this.rightHand) {
      console.warn('⚠️ Mains non trouvées pour la corde, retry...');
      setTimeout(() => this.play(), 500);
      return;
    }
    
    // Trouver le bow-draw-system
    const bowDrawEntity = document.querySelector('[bow-draw-system]');
    if (bowDrawEntity) {
      this.bowDrawSystem = bowDrawEntity.components['bow-draw-system'];
    }
    
    console.log('✅ Corde attachée aux mains');
  },

  createBowString: function() {
    // Créer une courbe pour la corde (on va l'utiliser comme template)
    // On créera une géométrie tubulaire pour avoir un cylindre qui suit la courbe
    
    const points = [];
    const segments = 20;
    
    // Initialiser avec des points droits (seront mis à jour dans tick)
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      points.push(new THREE.Vector3(0, -0.4 + (t * 0.8), 0));
    }
    
    // Créer la géométrie de tube qui suit la courbe
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, this.data.stringWidth, 8, false);
    
    const material = new THREE.MeshStandardMaterial({
      color: this.data.stringColor,
      roughness: 0.8,
      metalness: 0.2
    });
    
    this.bowStringMesh = new THREE.Mesh(tubeGeometry, material);
    this.el.object3D.add(this.bowStringMesh);
    
    // Garder une référence à la courbe pour la mettre à jour
    this.curve = curve;
    this.points = points;
    this.segments = segments;
  },

  tick: function() {
    if (!this.bowStringMesh || !this.leftHand || !this.rightHand) return;
    
    // Vérifier si on est en train de tirer
    if (this.bowDrawSystem) {
      this.isDrawing = this.bowDrawSystem.isDrawing;
      this.currentDrawDistance = this.bowDrawSystem.drawDistance || 0;
    }
    
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
    
    // Transformer les ancrages par la rotation de la main gauche
    const bowRotation = new THREE.Quaternion();
    this.leftHand.object3D.getWorldQuaternion(bowRotation);
    topAnchor.applyQuaternion(bowRotation);
    bottomAnchor.applyQuaternion(bowRotation);
    
    // Ajouter la position de l'arc
    topAnchor.add(this.tempBowPosition);
    bottomAnchor.add(this.tempBowPosition);
    
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
      
      // Ajouter un léger offset vers l'avant (direction -Z locale de l'arc)
      const forwardDir = new THREE.Vector3(0, 0, this.data.restOffset);
      forwardDir.applyQuaternion(bowRotation);
      middlePoint.add(forwardDir);
    }
    
    // Mettre à jour la courbe avec une courbe de Bézier quadratique
    // On va créer des points intermédiaires le long de cette courbe
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      
      // Formule de Bézier quadratique: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
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
    
    // Supprimer l'ancienne géométrie et en créer une nouvelle
    this.bowStringMesh.geometry.dispose();
    this.bowStringMesh.geometry = new THREE.TubeGeometry(
      this.curve,
      this.segments,
      this.data.stringWidth,
      8,
      false
    );
  },

  remove: function() {
    if (this.bowStringMesh) {
      this.bowStringMesh.geometry.dispose();
      this.bowStringMesh.material.dispose();
      this.el.object3D.remove(this.bowStringMesh);
    }
  }
});
