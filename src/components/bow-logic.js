AFRAME.registerComponent('bow-logic', {
  schema: {
    arrowSpeed: { type: 'number', default: 25 },
    color: { type: 'color', default: '#00ff00' },
    hitColor: { type: 'color', default: '#ff0000' },
    // angle pour baisser/monter le tir, 
    // aimAngle: { type: 'number', default: -90 } 
  },

  init: function () {
    this.raycaster = new THREE.Raycaster();
    this.tempVector = new THREE.Vector3();
    this.tempQuaternion = new THREE.Quaternion();

    // --- CORRECTION MAJEURE : LE GUIDE DE VISÉE (MUZZLE) ---
    // Au lieu de calculer des vecteurs compliqués, on crée un objet invisible
    // attaché à la main. On le fait pivoter pour qu'il pointe où on veut.
    this.aimGuide = new THREE.Object3D();
    this.el.object3D.add(this.aimGuide);
    
    // Application de la correction d'angle (en degrés convertis en radians)
    // Si ça tire trop vers le HAUT, essaye une valeur négative dans le schema HTML
    // this.aimGuide.rotation.x = THREE.MathUtils.degToRad(this.data.aimAngle);

    this.raycaster.near = 0.1; 
    
    this.createLaserBeam();

    // Events
    this.onTriggerDown = this.shootArrow.bind(this);
    this.el.addEventListener('triggerdown', this.onTriggerDown);
    this.el.addEventListener('abuttondown', this.onTriggerDown);
    
    // Debug PC
    this.onMouseClick = this.shootArrowMouse.bind(this);
    document.addEventListener('click', this.onMouseClick);
    
    console.log('🏹 Arc initialisé avec guide de visée');
  },

  update: function() {
    // Si on change l'angle en direct dans l'inspecteur A-Frame
    if (this.aimGuide) {
        // this.aimGuide.rotation.x = THREE.MathUtils.degToRad(this.data.aimAngle);
    }
  },

  createLaserBeam: function() {
    const geometry = new THREE.CylinderGeometry(0.003, 0.003, 1, 8); 
    
    // Le cylindre s'aligne sur -Z (l'avant)
    geometry.rotateX(-Math.PI / 2); 
    geometry.translate(0, 0, -0.5);

    const material = new THREE.MeshBasicMaterial({
      color: this.data.color,
      transparent: true,
      opacity: 0.5,
      depthTest: false
    });

    this.laserMesh = new THREE.Mesh(geometry, material);
    
    // IMPORTANT : On attache le laser au GUIDE, pas directement à la main
    // Comme ça, si on tourne le guide pour corriger le tir, le laser suit visuellement.
    this.aimGuide.add(this.laserMesh); 
    
    // Curseur d'impact
    const dotGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: this.data.hitColor });
    this.cursorMesh = new THREE.Mesh(dotGeo, dotMat);
    this.cursorMesh.visible = false;
    this.el.sceneEl.object3D.add(this.cursorMesh);
  },

  tick: function () {
    if (!this.laserMesh || !this.aimGuide) return;

    // 1. Obtenir la position absolue et la direction du GUIDE (et non de la main brute)
    this.aimGuide.getWorldPosition(this.tempVector);
    this.aimGuide.getWorldDirection(this.tempQuaternion); // Note: getWorldDirection renvoie un Vecteur, pas un Quat dans ThreeJS standard, mais A-Frame simplifie parfois.
    // Utilisons la méthode sûre pour la direction :
    
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.aimGuide.getWorldQuaternion(new THREE.Quaternion()));

    this.raycaster.set(this.tempVector, direction);

    // 2. Détection cibles
    const targets = Array.from(this.el.sceneEl.querySelectorAll('[target-behavior]'))
                          .map(el => el.object3D);

    let distance = 50;
    let hittingTarget = false;

    if (targets.length > 0) {
      const intersects = this.raycaster.intersectObjects(targets, true);
      if (intersects.length > 0) {
        distance = intersects[0].distance;
        hittingTarget = true;
        this.cursorMesh.position.copy(intersects[0].point);
        this.cursorMesh.visible = true;
      } else {
        this.cursorMesh.visible = false;
      }
    } else {
      this.cursorMesh.visible = false;
    }

    // 3. Mise à jour visuelle
    this.laserMesh.scale.z = distance;
    
    if (hittingTarget) {
      this.laserMesh.material.color.set(this.data.hitColor);
      this.laserMesh.material.opacity = 0.8;
    } else {
      this.laserMesh.material.color.set(this.data.color);
      this.laserMesh.material.opacity = 0.4;
    }
  },

  shootArrow: function () {
    if (!this.aimGuide) return;
    
    const shootSound = document.getElementById('shoot-sound');
    if (shootSound) { 
        shootSound.currentTime = 0; 
        shootSound.play().catch(e => {}); 
    }

    // On récupère la pos/rot du GUIDE (déjà corrigé)
    this.aimGuide.getWorldPosition(this.tempVector);
    this.aimGuide.getWorldQuaternion(this.tempQuaternion);

    this.createFlyingArrow(this.tempVector, this.tempQuaternion);
  },
  
  shootArrowMouse: function() {
      if (!this.el.sceneEl.is('vr-mode')) this.shootArrow();
  },

  createFlyingArrow: function(position, rotation) {
    const scene = this.el.sceneEl;
    const arrow = document.createElement('a-entity');
    
    arrow.setAttribute('gltf-model', 'fleche.glb');
    arrow.setAttribute('position', position);
    arrow.object3D.quaternion.copy(rotation);
    arrow.setAttribute('arrow-physics', `speed: ${this.data.arrowSpeed}`);
    
    scene.appendChild(arrow);
  },

  remove: function () {
    document.removeEventListener('click', this.onMouseClick);
    this.el.removeEventListener('triggerdown', this.onTriggerDown);
    this.el.removeEventListener('abuttondown', this.onTriggerDown);
    if (this.laserMesh) this.aimGuide.remove(this.laserMesh); // Retiré du guide
    if (this.cursorMesh) this.el.sceneEl.object3D.remove(this.cursorMesh);
  }
});