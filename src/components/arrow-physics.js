/**
 * Composant arrow-physics ULTRA-SIMPLIFIÉ pour A-Frame
 * Flèche qui part en ligne droite le long du raycast
 * Aucune physique, juste un mouvement rectiligne
 */

AFRAME.registerComponent("arrow-physics", {
  schema: {
    speed: { type: "number", default: 25 },
  },

  init: function () {
    this.hasCollided = false;
    this.lifetime = 0;
    this.maxLifetime = 8000; // 15 secondes max

    // CORRECTION : Utiliser getWorldQuaternion pour l'orientation globale
    const worldQuaternion = new THREE.Quaternion();
    this.el.object3D.getWorldQuaternion(worldQuaternion);

    // Direction fixe de la flèche (ne change JAMAIS)
    // L'axe forward en Three.js est (0, 0, -1)
    this.direction = new THREE.Vector3(0, 0, -1);
    this.direction.applyQuaternion(worldQuaternion);
    this.direction.normalize();

    // Log pour debug
    console.log("➡️ Flèche créée avec direction:", {
      x: this.direction.x.toFixed(2),
      y: this.direction.y.toFixed(2),
      z: this.direction.z.toFixed(2),
    });

    // Raycaster pour détecter les collisions
    this.raycaster = new THREE.Raycaster();

    // Récupérer tous les objets de collision
    this.collisionObjects = [];
    this.updateCollisionObjects();
  },

  updateCollisionObjects: function () {
    const scene = this.el.sceneEl;

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

    // Meshes de la scène (planes, sols, environnement, etc.)
    const sceneMeshes = scene.querySelectorAll("[geometry]");
    sceneMeshes.forEach((mesh) => {
      if (
        mesh.object3D &&
        mesh !== this.el &&
        !mesh.hasAttribute("target-behavior")
      ) {
        this.collisionObjects.push({
          object: mesh.object3D,
          entity: mesh,
          type: "environment",
        });
      }
    });

    console.log(
      `🎯 ${this.collisionObjects.length} objets de collision détectés`,
    );
  },

  tick: function (time, deltaTime) {
    if (this.hasCollided) return;

    this.lifetime += deltaTime;

    // Supprimer la flèche après un certain temps
    if (this.lifetime > this.maxLifetime) {
      this.removeArrow();
      return;
    }

    const dt = deltaTime / 1000;

    // Calculer le déplacement en ligne droite
    const displacement = this.direction
      .clone()
      .multiplyScalar(this.data.speed * dt);

    // Raycast dans la direction du mouvement
    const currentPos = this.el.object3D.position.clone();
    const rayDistance = displacement.length();

    // IMPORTANT: Vérifier si on touche le bouton du menu VR EN PREMIER
    const menuEl = this.el.sceneEl.querySelector("[vr-menu]");
    if (menuEl && menuEl.components["vr-menu"]) {
      const worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      if (menuEl.components["vr-menu"].checkArrowHit(worldPos)) {
        // On a touché le bouton, supprimer la flèche
        console.log("🎯 Menu touché ! Démarrage du jeu...");
        this.hasCollided = true;
        this.removeArrow();
        return;
      }
    }

    this.raycaster.set(currentPos, this.direction);
    this.raycaster.far = rayDistance * 1.2;

    // Détecter les intersections
    const allObjects = this.collisionObjects.map((obj) => obj.object);
    const intersects = this.raycaster.intersectObjects(allObjects, true);

    if (intersects.length > 0 && intersects[0].distance <= rayDistance) {
      // Collision détectée !
      this.handleCollision(intersects[0]);
    } else {
      // Pas de collision, avancer en ligne droite
      this.el.object3D.position.add(displacement);
    }
  },

  handleCollision: function (intersection) {
    if (this.hasCollided) return;
    this.hasCollided = true;

    const impactPoint = intersection.point;

    // Trouver l'entité touchée
    let hitEntity = null;
    let hitType = "environment";

    for (let collisionObj of this.collisionObjects) {
      let current = intersection.object;
      while (current) {
        if (current === collisionObj.object) {
          hitEntity = collisionObj.entity;
          hitType = collisionObj.type;
          break;
        }
        current = current.parent;
      }
      if (hitEntity) break;
    }

    console.log(`💥 Collision: ${hitType}`);

    // Si c'est une cible, appeler son composant
    if (hitType === "target" && hitEntity.components["target-behavior"]) {
      hitEntity.components["target-behavior"].onArrowHit(this.el, impactPoint);
    }

    // Planter la flèche à la position d'impact
    this.el.object3D.position.copy(impactPoint);

    // Ajuster position pour que la flèche dépasse de la surface
    if (intersection.face && intersection.face.normal) {
      const offset = intersection.face.normal.clone().multiplyScalar(0.1);
      this.el.object3D.position.add(offset);
    }

    // Retirer la flèche après 5 secondes
    setTimeout(() => {
      this.animateRemoval();
    }, 5000);
  },

  animateRemoval: function () {
    if (!this.el || !this.el.parentNode) return;

    let elapsed = 0;
    const duration = 500;
    const startScale = this.el.getAttribute("scale") || { x: 1, y: 1, z: 1 };

    const animate = () => {
      elapsed += 16;
      const progress = Math.min(elapsed / duration, 1);
      const scale = startScale.x * (1 - progress);
      this.el.setAttribute("scale", `${scale} ${scale} ${scale}`);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.removeArrow();
      }
    };

    animate();
  },

  removeArrow: function () {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  },
});
