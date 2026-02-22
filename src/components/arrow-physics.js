/**
 * Composant arrow-physics avec simulation de gravité
 * La flèche suit une trajectoire parabolique réaliste
 * La puissance dépend de la distance de tirage de la corde
 */

AFRAME.registerComponent("arrow-physics", {
  schema: {
    speed: { type: "number", default: 45 },
    gravity: { type: "number", default: 0.005 }, // Gravité réduite pour des trajectoires plus droites
    mass: { type: "number", default: 0.001 }, // Masse de la flèche en kg
    dragCoefficient: { type: "number", default: 0.0005 }, // Résistance de l'air réduite
  },

  init: function () {
    this.hasCollided = false;
    this.lifetime = 0;
    this.maxLifetime = 4000; // 4 secondes max

    // Vecteurs pour la physique
    this.velocity = new THREE.Vector3();
    this.acceleration = new THREE.Vector3();

    // CORRECTION : Utiliser getWorldQuaternion pour l'orientation globale
    const worldQuaternion = new THREE.Quaternion();
    this.el.object3D.getWorldQuaternion(worldQuaternion);

    // Direction initiale de la flèche
    // L'axe forward en Three.js est (0, 0, -1)
    const initialDirection = new THREE.Vector3(0, 0, -1);
    initialDirection.applyQuaternion(worldQuaternion);
    initialDirection.normalize();

    // Initialiser la vélocité avec la vitesse et la direction
    this.velocity.copy(initialDirection).multiplyScalar(this.data.speed);

    // Log pour debug
    console.log("➡️ Flèche créée avec vélocité initiale:", {
      x: this.velocity.x.toFixed(2),
      y: this.velocity.y.toFixed(2),
      z: this.velocity.z.toFixed(2),
      vitesse: this.data.speed.toFixed(1),
    });

    // Raycaster pour détecter les collisions
    this.raycaster = new THREE.Raycaster();

    // Récupérer tous les objets de collision
    this.collisionObjects = [];
    this.updateCollisionObjects();
  },

  updateCollisionObjects: function () {
    const scene = this.el.sceneEl;
    
    // Réinitialiser la liste
    this.collisionObjects = [];

    // Cibles uniquement
    const targets = scene.querySelectorAll("[target-behavior]");
    targets.forEach((target) => {
      if (target.object3D) {
        this.collisionObjects.push({
          object: target.object3D,
          entity: target,
          type: "target",
        });
      }
    });

    // Surfaces de la scène (murs, sol, plafond détectés par WebXR)
    // Chercher toutes les surfaces avec les classes appropriées, y compris arrow-collidable
    const sceneSurfaces = scene.querySelectorAll(".scene-mesh, .wall-debug-surface, .collidable, .arrow-collidable, a-plane[geometry], [id^='webxr-wall'], [id^='debug-wall'], [id^='debug-floor'], [id^='debug-ceiling']");
    
    if (this.collisionObjects.length < 10) { // Éviter le spam de logs
      console.log(`🔵 DEBUG: Nombre de surfaces trouvées pour collision: ${sceneSurfaces.length}`);
    }
    
    sceneSurfaces.forEach((mesh, index) => {
      // Vérifier si cet élément ou un de ses parents a l'attribut hud-element
      let isHudElement = false;
      let current = mesh;
      while (current && current !== scene) {
        if (current.hasAttribute && current.hasAttribute("hud-element")) {
          isHudElement = true;
          break;
        }
        current = current.parentNode;
      }
      
      // Exclure: la flèche elle-même, les cibles, et les éléments du HUD
      if (
        mesh.object3D &&
        mesh !== this.el &&
        !mesh.hasAttribute("target-behavior") &&
        !isHudElement
      ) {
        this.collisionObjects.push({
          object: mesh.object3D,
          entity: mesh,
          type: "environment",
        });
        
        const pos = mesh.getAttribute("position");
        console.log(`🔵 Surface #${index} ajoutée pour collision: ${mesh.id || 'anonymous'} à (${pos?.x?.toFixed(2)}, ${pos?.y?.toFixed(2)}, ${pos?.z?.toFixed(2)})`);
      }
    });
    
    // Aussi ajouter les meshes avec geometry comme fallback
    const geometryMeshes = scene.querySelectorAll("[geometry]");
    geometryMeshes.forEach((mesh) => {
      // Éviter les doublons
      const alreadyAdded = this.collisionObjects.some(obj => obj.entity === mesh);
      if (alreadyAdded) return;
      
      let isHudElement = false;
      let current = mesh;
      while (current && current !== scene) {
        if (current.hasAttribute && current.hasAttribute("hud-element")) {
          isHudElement = true;
          break;
        }
        current = current.parentNode;
      }
      
      if (
        mesh.object3D &&
        mesh !== this.el &&
        !mesh.hasAttribute("target-behavior") &&
        !isHudElement
      ) {
        this.collisionObjects.push({
          object: mesh.object3D,
          entity: mesh,
          type: "environment",
        });
      }
    });
  },

tick: function (time, deltaTime) {
  if (this.hasCollided) return;

  // Mettre à jour les objets de collision toutes les 1 seconde pour capter les nouvelles surfaces
  if (!this.lastCollisionUpdate || time - this.lastCollisionUpdate > 1000) {
    this.updateCollisionObjects();
    this.lastCollisionUpdate = time;
  }

  // dt en secondes
  const dt = deltaTime / 1000;

  // Mettre à jour la durée de vie
  this.lifetime += deltaTime;
  if (this.lifetime > this.maxLifetime) {
    this.removeArrow();
    return;
  }

  // 1. Accélération due à la gravité (accélération, pas force)
  const gravityAcc = new THREE.Vector3(0, -this.data.gravity, 0);

  // 2. Calculer la résistance de l'air (force), puis la convertir en accélération
  const velocityMagnitude = this.velocity.length();
  let dragAcc = new THREE.Vector3(0, 0, 0);
  if (velocityMagnitude > 0.0001) {
    const dragForce = this.velocity.clone()
      .normalize()
      .multiplyScalar(-this.data.dragCoefficient * velocityMagnitude * velocityMagnitude);
    dragAcc = dragForce.divideScalar(this.data.mass);
  }

  // 3. NOUVEAU - Appliquer le vent
  let windAcc = new THREE.Vector3(0, 0, 0);
  const windSystem = this.el.sceneEl.systems.wind;
  if (windSystem) {
    const windForce = windSystem.getWindForce();
    // Convertir la force du vent en accélération (F = m*a, donc a = F/m)
    windAcc = windForce.divideScalar(this.data.mass);
  }

  // 4. Somme des accélérations = Gravité + Drag/mass + Vent
  this.acceleration.copy(gravityAcc).add(dragAcc).add(windAcc);

  // 5. Mise à jour de la vélocité: v = v + a * dt
  this.velocity.add(this.acceleration.clone().multiplyScalar(dt));

  // 5. Calculer le déplacement: s = v * dt
  const displacement = this.velocity.clone().multiplyScalar(dt);

  // 6. Orienter la flèche dans la direction de sa vélocité (pour qu'elle pointe vers où elle va)
  if (velocityMagnitude > 0.1) {
    const targetDirection = this.velocity.clone().normalize();
    const targetQuaternion = new THREE.Quaternion();
    targetQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), targetDirection);
    this.el.object3D.quaternion.copy(targetQuaternion);
  }

  // Raycast dans la direction du mouvement
  const currentPos = this.el.object3D.position.clone();
  const rayDistance = displacement.length();

  // IMPORTANT: Vérifier si on touche un bouton de menu EN PREMIER
  const worldPos = new THREE.Vector3();
  this.el.object3D.getWorldPosition(worldPos);

  // Vérifier le menu de démarrage
  const startMenuEl = this.el.sceneEl.querySelector("[vr-menu]");
  if (startMenuEl && startMenuEl.components["vr-menu"]) {
    if (startMenuEl.components["vr-menu"].checkArrowHit(worldPos)) {
      console.log("🎯 Menu démarrage touché !");
      this.hasCollided = true;
      this.removeArrow();
      return;
    }
  }

  // Vérifier le menu de fin
  const endMenuEl = this.el.sceneEl.querySelector("[end-menu]");
  if (endMenuEl && endMenuEl.components["end-menu"]) {
    if (endMenuEl.components["end-menu"].checkArrowHit(worldPos)) {
      console.log("🔄 Menu fin touché !");
      this.hasCollided = true;
      this.removeArrow();
      return;
    }
  }

  // Préparer le raycaster à partir de la position courante dans la direction du déplacement
  const rayDir = displacement.lengthSq() > 0 ? displacement.clone().normalize() : this.velocity.clone().normalize();
  this.raycaster.set(currentPos, rayDir);
  this.raycaster.far = Math.max(rayDistance * 1.2, 0.5); // Minimum 0.5m pour détecter les collisions proches

  // Récupérer les mesh 3D directement pour le raycaster
  const meshesToCheck = [];
  this.collisionObjects.forEach((obj) => {
    if (obj.object) {
      // Récupérer le mesh enfant s'il existe (pour a-plane)
      obj.object.traverse((child) => {
        if (child.isMesh) {
          child.userData.collisionEntity = obj.entity;
          child.userData.collisionType = obj.type;
          meshesToCheck.push(child);
        }
      });
      // Ajouter aussi l'objet parent au cas où
      meshesToCheck.push(obj.object);
    }
  });

  // Détecter les intersections via raycaster
  const intersects = this.raycaster.intersectObjects(meshesToCheck, true);

  if (intersects.length > 0 && intersects[0].distance <= rayDistance * 1.5) {
    // Collision détectée via raycaster !
    console.log(`🔵 Raycaster hit: ${intersects[0].object.name || 'mesh'} à distance ${intersects[0].distance.toFixed(3)}`);
    this.handleCollision(intersects[0]);
  } else {
    // FALLBACK: Vérification par distance pour les cibles (plus fiable avec les modèles GLTF)
    const arrowWorldPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(arrowWorldPos);
    
    for (let collisionObj of this.collisionObjects) {
      if (collisionObj.type === "target" && collisionObj.entity && collisionObj.entity.object3D) {
        const targetWorldPos = new THREE.Vector3();
        collisionObj.entity.object3D.getWorldPosition(targetWorldPos);
        
        const distance = arrowWorldPos.distanceTo(targetWorldPos);
        const hitRadius = 0.5; // Rayon de collision de la cible
        
        if (distance < hitRadius) {
          console.log(`🎯 COLLISION PAR DISTANCE! Distance: ${distance.toFixed(3)}m`);
          // Créer un objet intersection simulé
          const fakeIntersection = {
            point: arrowWorldPos.clone(),
            object: collisionObj.object,
            distance: distance
          };
          this.handleCollision(fakeIntersection);
          return;
        }
      }
    }
    
    // FALLBACK MUR: Utiliser wallData de wall-debug pour les collisions précises
    const wallDebugEl = this.el.sceneEl.querySelector('[wall-debug]');
    if (wallDebugEl && wallDebugEl.components['wall-debug']) {
      const wallData = wallDebugEl.components['wall-debug'].wallData || [];
      
      for (let wall of wallData) {
        // Ignorer sol et plafond (ils sont déjà gérés par le raycaster)
        if (wall.isFloor || wall.isCeiling) continue;
        
        const wallWorldPos = wall.position.clone();
        const wallNormal = wall.normal.clone();
        
        // Calculer la distance perpendiculaire au plan du mur
        const toArrow = arrowWorldPos.clone().sub(wallWorldPos);
        const perpDistance = toArrow.dot(wallNormal);
        
        // On veut détecter quand la flèche traverse le plan (perpDistance proche de 0)
        // et quand elle vient du bon côté (le côté où la normale pointe)
        const absPerpDistance = Math.abs(perpDistance);
        
        // Vérifier si on est dans les limites du mur
        const wallWidth = wall.width || 4;
        const wallHeight = wall.height || 2.5;
        
        // Calculer le vecteur "droite" du mur (perpendiculaire à la normale et à Y)
        const wallUp = new THREE.Vector3(0, 1, 0);
        const wallRight = new THREE.Vector3().crossVectors(wallUp, wallNormal).normalize();
        
        // Position relative sur le mur
        const localX = Math.abs(toArrow.dot(wallRight));
        const localY = toArrow.y;
        
        // Position Y du centre du mur
        const wallCenterY = wallWorldPos.y;
        const relativeY = Math.abs(localY);
        
        // Debug pour comprendre les valeurs
        if (absPerpDistance < 1.0 && localX < wallWidth && relativeY < wallHeight) {
          console.log(`🔍 Mur ${wall.name}: perpDist=${absPerpDistance.toFixed(3)}, localX=${localX.toFixed(2)}, relY=${relativeY.toFixed(2)}`);
        }
        
        // Collision si proche du plan ET dans les limites du mur
        // Distance de 0.5m pour être sûr de détecter
        if (absPerpDistance < 0.5 && localX < wallWidth / 2 && relativeY < wallHeight / 2) {
          console.log(`🧱 COLLISION MUR WebXR! ${wall.name} - perpDistance: ${absPerpDistance.toFixed(3)}m`);
          
          // Point d'impact sur le plan du mur
          const impactPoint = arrowWorldPos.clone();
          impactPoint.sub(wallNormal.clone().multiplyScalar(perpDistance));
          
          const fakeIntersection = {
            point: impactPoint,
            object: wall.entity?.object3D,
            distance: absPerpDistance,
            face: { normal: wallNormal.clone().negate() }
          };
          this.handleCollision(fakeIntersection);
          return;
        }
      }
    }
    
    // Pas de collision, appliquer le déplacement
    this.el.object3D.position.add(displacement);
  }
},

  handleCollision: function (intersection) {
    if (this.hasCollided) return;
    this.hasCollided = true;

    const impactPoint = intersection.point;

    // Trouver l'entité touchée en remontant la hiérarchie THREE.js
    let hitEntity = null;
    let hitType = "environment";

    // Méthode améliorée : parcourir la hiérarchie THREE.js pour trouver l'entité A-Frame
    let currentObj = intersection.object;
    while (currentObj) {
      // Vérifier si cet objet THREE.js est lié à une entité A-Frame
      if (currentObj.el) {
        const entity = currentObj.el;
        // Vérifier si c'est une cible
        if (entity.hasAttribute && entity.hasAttribute('target-behavior')) {
          hitEntity = entity;
          hitType = "target";
          console.log('🎯 Cible trouvée via hiérarchie THREE.js:', entity.id || 'anonymous');
          break;
        }
        // Sinon vérifier si c'est un environnement
        if (!hitEntity) {
          hitEntity = entity;
          hitType = "environment";
        }
      }
      currentObj = currentObj.parent;
    }

    // Fallback : chercher dans notre liste de collision
    if (!hitEntity || hitType !== "target") {
      for (let collisionObj of this.collisionObjects) {
        if (collisionObj.type === "target") {
          // Vérifier si l'objet intersecté est un descendant de cette cible
          let checkObj = intersection.object;
          while (checkObj) {
            if (checkObj === collisionObj.object || 
                (collisionObj.object.children && this.isDescendant(checkObj, collisionObj.object))) {
              hitEntity = collisionObj.entity;
              hitType = "target";
              console.log('🎯 Cible trouvée via fallback:', hitEntity.id || 'anonymous');
              break;
            }
            checkObj = checkObj.parent;
          }
          if (hitType === "target") break;
        }
      }
    }

    // Log détaillé de la collision
    const hitId = hitEntity?.id || "unknown";
    const hitClass = hitEntity?.getAttribute?.("class") || "no-class";
    console.log(`💥 COLLISION DÉTECTÉE!`);
    console.log(`   Type: ${hitType}`);
    console.log(`   Entité: ${hitId}`);
    console.log(`   Classe: ${hitClass}`);
    console.log(`   Point d'impact: (${impactPoint.x.toFixed(2)}, ${impactPoint.y.toFixed(2)}, ${impactPoint.z.toFixed(2)})`);

    // Planter la flèche à la position d'impact (pour tous les types)
    this.el.object3D.position.copy(impactPoint);

    // Ajuster position pour que la flèche dépasse légèrement de la surface (plantée)
    if (intersection.face && intersection.face.normal) {
      // Reculer la flèche dans le sens opposé à la normale (pour qu'elle pénètre dans le mur)
      const offset = intersection.face.normal.clone().multiplyScalar(-0.15);
      this.el.object3D.position.add(offset);
      console.log(`🔵 Flèche plantée avec normal offset`);
    } else {
      // Fallback: utiliser la direction de la vélocité pour planter la flèche
      const velocityDir = this.velocity.clone().normalize();
      const offset = velocityDir.multiplyScalar(0.1);
      this.el.object3D.position.add(offset);
      console.log(`🔵 Flèche plantée avec velocity offset`);
    }

    // Si c'est une cible, appeler son composant
    if (hitType === "target" && hitEntity && hitEntity.components && hitEntity.components["target-behavior"]) {
      console.log('🎯 Appel de onArrowHit sur la cible...');
      hitEntity.components["target-behavior"].onArrowHit(this.el, impactPoint);
      
      // La flèche sera supprimée par le composant target-behavior lors de la destruction
      // Ne pas appeler animateRemoval() ici pour éviter la double suppression
    } else {
      // Surface environnement (mur, sol, plafond)
      console.log('🏹 Flèche plantée dans:', hitId || 'surface');
      
      // Déterminer le temps de disparition selon le type de surface
      let removeDelay = 5000; // 5 secondes par défaut pour les murs
      
      if (hitClass && (hitClass.includes('floor') || hitClass.includes('sol'))) {
        removeDelay = 3000; // 3 secondes pour le sol
      } else if (hitClass && (hitClass.includes('ceiling') || hitClass.includes('plafond'))) {
        removeDelay = 3000; // 3 secondes pour le plafond
      }
      
      console.log(`⏰ Flèche sera retirée dans ${removeDelay/1000}s`);
      
      // Retirer la flèche après le délai
      setTimeout(() => {
        this.animateRemoval();
      }, removeDelay);
    }
  },

  isDescendant: function(obj, parent) {
    let current = obj;
    while (current) {
      if (current === parent) return true;
      current = current.parent;
    }
    return false;
  },

  animateRemoval: function () {
    if (!this.el || !this.el.parentNode) return;

    const arrowEl = this.el;
    const scaleAttr = arrowEl.getAttribute("scale") || { x: 1, y: 1, z: 1 };
    const startScale = { x: scaleAttr.x || 1, y: scaleAttr.y || 1, z: scaleAttr.z || 1 };

    // Utiliser les animations A-Frame natives (compatibles XR)
    arrowEl.removeAttribute('animation__removal');
    arrowEl.setAttribute('animation__removal', {
      property: 'scale',
      to: '0 0 0',
      dur: 300,
      easing: 'easeInQuad'
    });

    // Supprimer après l'animation
    setTimeout(() => {
      this.removeArrow();
    }, 350);
  },

  removeArrow: function () {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  },
});
