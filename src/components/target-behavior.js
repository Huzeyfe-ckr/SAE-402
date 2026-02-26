/**
 * Composant target-behavior pour A-Frame
 * Gère les HP, le calcul de précision basé sur la distance au centre
 * et les animations de hit/destruction
 * 
 * NOUVEAU: Les oiseaux volent autour de la zone après spawn
 */

import { getDeathAnimation } from '../config/target-types.js';

AFRAME.registerComponent('target-behavior', {
  schema: {
    points: { type: 'number', default: 10 },
    hp: { type: 'number', default: 1 },
    movable: { type: 'boolean', default: true }, // Activé par défaut pour les oiseaux
    flySpeed: { type: 'number', default: 1.5 }, // Vitesse de vol (m/s)
    flyRadius: { type: 'number', default: 3 }, // Rayon de la zone de vol
    flyHeight: { type: 'number', default: 0.5 }, // Variation de hauteur pendant le vol
    centerRadius: { type: 'number', default: 0.1 }, // Rayon du centre (bullseye)
    middleRadius: { type: 'number', default: 0.3 }, // Rayon moyen
    outerRadius: { type: 'number', default: 0.5 }   // Rayon extérieur
  },

  init: function () {
    this.currentHp = this.data.hp
    this.hitCount = 0
    this.hitByArrows = new Set()
    this.arrowElements = []
    this.surfaceType = this.el.getAttribute('surface-type') || 'random'
    
    // Variables pour le vol
    this.isFlying = false
    this.flightTime = 0
    this.startPosition = null
    this.roomBounds = null
    this.flyStartDelay = 200 + Math.random() * 500
    this.initTime = Date.now()
    this.lastTickTime = Date.now()
    this.tickInterval = null

    // Navigation par waypoints
    this.currentVelocity = new THREE.Vector3()
    this.targetWaypoint = null
    this.waypointReachDistance = 0.4
    
    const self = this
    setTimeout(() => {
      if (!self.tickLogged && self.data.movable) {
        self.startBackupInterval()
      }
    }, 2000)
  },

  /**
   * Démarre le vol de l'oiseau
   */
  startFlying: function () {
    if (this.isFlying) return
    if (!this.el.object3D) return

    // Récupérer les limites de la pièce
    const wallDebugEl = this.el.sceneEl.querySelector('[wall-debug]')
    if (wallDebugEl && wallDebugEl.components['wall-debug']) {
      this.calculateRoomBounds(wallDebugEl.components['wall-debug'].wallData || [])
    } else {
      this.roomBounds = { minX: -4, maxX: 4, minY: 1.0, maxY: 2.8, minZ: -4, maxZ: 4 }
    }

    // Vélocité initiale aléatoire
    const angle = Math.random() * Math.PI * 2
    const speed = this.data.flySpeed
    this.currentVelocity.set(
      Math.cos(angle) * speed,
      (Math.random() - 0.5) * speed * 0.3,
      Math.sin(angle) * speed
    )

    // Premier waypoint
    this.pickNewWaypoint()

    this.isFlying = true
    this.flightTime = 0
  },

  /**
   * Choisit un nouveau point de destination aléatoire dans la pièce
   */
  pickNewWaypoint: function () {
    if (!this.roomBounds) return
    const b = this.roomBounds
    const margin = 0.4
    this.targetWaypoint = new THREE.Vector3(
      b.minX + margin + Math.random() * (b.maxX - b.minX - margin * 2),
      b.minY + margin + Math.random() * (b.maxY - b.minY - margin * 2),
      b.minZ + margin + Math.random() * (b.maxZ - b.minZ - margin * 2)
    )
  },

  /**
   * Calcule les limites de la pièce pour garder l'oiseau dans la zone
   */
  calculateRoomBounds: function (wallData) {
    if (!wallData || wallData.length === 0) {
      // Limites par défaut - hauteur à niveau joueur (1m à 2.8m)
      this.roomBounds = {
        minX: -4, maxX: 4,
        minY: 1.0, maxY: 2.8,
        minZ: -4, maxZ: 4
      }
      return
    }
    
    let minX = Infinity, maxX = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    let minY = 1.0, maxY = 2.8 // Hauteurs à hauteur de joueur (1m à 2.8m)
    
    wallData.forEach(wall => {
      if (wall.isFloor) {
        minY = wall.position.y + 1.0 // 1m au-dessus du sol
        maxY = wall.position.y + 2.8 // Max 2.8m au-dessus du sol (même sans plafond)
      } else if (wall.isCeiling) {
        maxY = Math.min(wall.position.y - 0.3, minY + 2.0) // Max 2m de range vertical
      } else {
        // C'est un mur
        const pos = wall.position
        const halfWidth = (wall.width || 2) / 2
        
        minX = Math.min(minX, pos.x - halfWidth)
        maxX = Math.max(maxX, pos.x + halfWidth)
        minZ = Math.min(minZ, pos.z - halfWidth)
        maxZ = Math.max(maxZ, pos.z + halfWidth)
      }
    })
    
    // Grande marge pour garder les cibles au centre de la pièce (1.5m des murs)
    const margin = 1.5
    this.roomBounds = {
      minX: minX === Infinity ? -4 : minX + margin,
      maxX: maxX === -Infinity ? 4 : maxX - margin,
      minY: minY,
      maxY: maxY,
      minZ: minZ === Infinity ? -4 : minZ + margin,
      maxZ: maxZ === -Infinity ? 4 : maxZ - margin
    }
    
    // Stocker aussi les murs pour la détection de proximité
    this.wallsData = wallData
    
  },

  /**
   * Met à jour la position de l'oiseau en vol (appelé chaque frame)
   */
  tick: function (time, deltaTime) {
    // Déléguer à updateFlight() - même logique que le backup interval
    this.updateFlight(time, deltaTime)
  },

  /**
   * Arrête le vol (appelé quand l'oiseau est touché)
   */
  stopFlying: function () {
    this.isFlying = false
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
  },

  /**
   * Backup: Démarre un interval si tick() n'est pas appelé par A-Frame
   */
  startBackupInterval: function () {
    if (this.tickInterval) return // Déjà démarré
    
    const self = this
    this.lastTickTime = Date.now()
    
    this.tickInterval = setInterval(() => {
      const now = Date.now()
      const deltaTime = now - self.lastTickTime
      self.lastTickTime = now
      
      // Appeler la logique de tick manuellement
      self.updateFlight(now, deltaTime)
    }, 16) // ~60fps
    
  },

  /**
   * Logique de vol extraite pour pouvoir être appelée par tick() ou interval
   */
  updateFlight: function (time, deltaTime) {
    // Vérifier si on doit démarrer le vol (après le délai)
    if (this.data.movable && !this.isFlying && this.initTime) {
      if (Date.now() - this.initTime >= this.flyStartDelay) {
        this.startFlying()
      }
      return
    }

    if (!this.isFlying || !this.targetWaypoint || !this.roomBounds) return

    if (!deltaTime || deltaTime <= 0 || deltaTime > 1000) deltaTime = 16
    const dt = deltaTime / 1000
    this.flightTime += dt

    const speed = this.data.flySpeed
    const pos = this.el.object3D.position

    // Direction vers le waypoint
    const toWaypoint = new THREE.Vector3().subVectors(this.targetWaypoint, pos)
    const distToWaypoint = toWaypoint.length()

    // Nouveau waypoint si on est arrivé
    if (distToWaypoint < this.waypointReachDistance) {
      this.pickNewWaypoint()
      return
    }

    // Désiré : aller vers le waypoint à la bonne vitesse
    const desiredVelocity = toWaypoint.normalize().multiplyScalar(speed)

    // Virage progressif (steering) : lerp entre vélocité actuelle et désirée
    const turnSpeed = 2.5 // Plus haut = virage plus serré
    this.currentVelocity.lerp(desiredVelocity, Math.min(1, turnSpeed * dt))

    // Garder une vitesse constante
    if (this.currentVelocity.lengthSq() > 0.001) {
      this.currentVelocity.normalize().multiplyScalar(speed)
    }

    // Nouvelle position
    let newX = pos.x + this.currentVelocity.x * dt
    let newY = pos.y + this.currentVelocity.y * dt
    let newZ = pos.z + this.currentVelocity.z * dt

    // Clamping dans les limites de la pièce + choisir nouveau waypoint si on frappe un bord
    const b = this.roomBounds
    const m = 0.3
    if (newX < b.minX + m || newX > b.maxX - m ||
        newY < b.minY + m || newY > b.maxY - m ||
        newZ < b.minZ + m || newZ > b.maxZ - m) {
      newX = Math.max(b.minX + m, Math.min(b.maxX - m, newX))
      newY = Math.max(b.minY + m, Math.min(b.maxY - m, newY))
      newZ = Math.max(b.minZ + m, Math.min(b.maxZ - m, newZ))
      this.pickNewWaypoint() // Choisir une nouvelle destination immédiatement
    }

    this.el.object3D.position.set(newX, newY, newZ)

    // Orienter la cible dans la direction du vol
    if (this.currentVelocity.lengthSq() > 0.01) {
      this.el.object3D.rotation.order = 'YXZ'
      const angleY = Math.atan2(this.currentVelocity.x, this.currentVelocity.z)
      const flatLen = Math.sqrt(this.currentVelocity.x ** 2 + this.currentVelocity.z ** 2)
      const angleX = -Math.atan2(this.currentVelocity.y, flatLen) * 0.4
      const angleZ = Math.sin(this.flightTime * speed * 0.5) * 0.15
      this.el.object3D.rotation.set(angleX, angleY, angleZ)
    }
  },

  /**
   * Méthode appelée quand une flèche touche la cible
   * Calcule le score de précision basé sur la distance au centre
   */
  onArrowHit: function (arrowEl, impactPoint) {
    
    // Arrêter le vol quand touché
    this.stopFlying()
    
    try {
      if (!impactPoint) {
        console.error('No impact point provided')
        return
      }

      // PROTECTION : Vérifier si cette flèche a déjà touché cette cible
      const arrowId = arrowEl.id || arrowEl.uuid || arrowEl
      if (this.hitByArrows.has(arrowId)) {
        return
      }
      
      // Marquer cette flèche comme ayant touché cette cible
      this.hitByArrows.add(arrowId)
      
      // Stocker la référence de la flèche pour la supprimer lors de la destruction
      this.arrowElements.push(arrowEl)

      this.hitCount++
      this.currentHp--
      

      // Convertir le point d'impact en coordonnées locales de la cible
      const localImpact = this.el.object3D.worldToLocal(impactPoint.clone())
      
      // Calculer la distance au centre (sur le plan XY local)
      const distanceToCenter = Math.sqrt(
        localImpact.x * localImpact.x + 
        localImpact.y * localImpact.y
      )

      // Calculer le multiplicateur de précision
      let precisionMultiplier = 1.0
      let hitZone = 'outer'
      
      if (distanceToCenter <= this.data.centerRadius) {
        precisionMultiplier = 3.0 // Bullseye! x3
        hitZone = 'bullseye'
      } else if (distanceToCenter <= this.data.middleRadius) {
        precisionMultiplier = 2.0 // Zone moyenne x2
        hitZone = 'middle'
      } else if (distanceToCenter <= this.data.outerRadius) {
        precisionMultiplier = 1.0 // Zone extérieure x1
        hitZone = 'outer'
      } else {
        precisionMultiplier = 0.5 // Touché le bord x0.5
        hitZone = 'edge'
      }

      const finalPoints = Math.floor(this.data.points * precisionMultiplier)


      // Jouer le son de hit
      try {
        const hitSound = document.getElementById('hit-sound')
        if (hitSound) {
          hitSound.currentTime = 0
        }
      } catch (e) {
        console.error('Sound play error:', e)
      }

      // Animations de feedback
      this.playHitAnimation(hitZone)
      this.showHitFeedback(localImpact, finalPoints, hitZone)

      // Émettre un événement de score au système de jeu
      try {
        this.el.sceneEl.emit('target-hit', {
          points: finalPoints,
          zone: hitZone,
          multiplier: precisionMultiplier,
          position: this.el.object3D.position,
          distanceToCenter: distanceToCenter,
          surfaceType: this.surfaceType
        })
      } catch (e) {
        console.error('❌ [TARGET] Event emission error:', e)
      }

      // Détruire la cible si HP = 0
      if (this.currentHp <= 0) {
        this.destroy(finalPoints)
      } else {
        // Si la cible n'est pas détruite, supprimer quand même la flèche après un délai
        setTimeout(() => {
          if (arrowEl && arrowEl.parentNode) {
            arrowEl.parentNode.removeChild(arrowEl)
          }
        }, 2000)
      }
    } catch (e) {
      console.error('onArrowHit error:', e)
    }
  },

  playHitAnimation: function (zone) {
    // Animation de hit utilisant les animations A-Frame natives (compatibles XR)
    try {
      const scaleAttr = this.el.getAttribute('scale') || { x: 1, y: 1, z: 1 }
      const originalScale = { x: scaleAttr.x || 1, y: scaleAttr.y || 1, z: scaleAttr.z || 1 }
      const scaleFactor = zone === 'bullseye' ? 1.3 : zone === 'middle' ? 1.2 : 1.1
      
      // Supprimer l'ancienne animation si elle existe
      this.el.removeAttribute('animation__hit')
      
      // Animation de pulse avec A-Frame
      this.el.setAttribute('animation__hit', {
        property: 'scale',
        from: `${originalScale.x * scaleFactor} ${originalScale.y * scaleFactor} ${originalScale.z * scaleFactor}`,
        to: `${originalScale.x} ${originalScale.y} ${originalScale.z}`,
        dur: 150,
        easing: 'easeOutQuad'
      })
    } catch (e) {
      console.error('Hit animation error:', e)
    }
  },

  showHitFeedback: function (localPosition, points, zone) {
    // Créer un texte flottant avec les points - utilise animations A-Frame pour XR
    try {
      const worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      
      // Créer l'entité du container
      const feedbackContainer = document.createElement('a-entity');
      feedbackContainer.setAttribute('position', {
        x: worldPos.x,
        y: worldPos.y + 0.3,
        z: worldPos.z
      });
      
      // Couleur et taille selon la zone touchée
      let color = '#FFFFFF';
      let textSize = 0.4;
      let prefix = '+';
      let particleCount = 6;
      
      switch (zone) {
        case 'bullseye':
          color = '#FFD700'; // Or
          textSize = 0.6;
          prefix = '🎯 +';
          particleCount = 15;
          break;
        case 'middle':
          color = '#00FF00'; // Vert
          textSize = 0.5;
          prefix = '✨ +';
          particleCount = 10;
          break;
        case 'outer':
          color = '#87CEEB'; // Bleu clair
          textSize = 0.45;
          prefix = '✓ +';
          particleCount = 8;
          break;
        case 'edge':
          color = '#FFA500'; // Orange
          textSize = 0.4;
          prefix = '+';
          particleCount = 6;
          break;
      }
      
      // Texte principal avec les points
      const textEl = document.createElement('a-text');
      textEl.setAttribute('value', `${prefix}${points}`);
      textEl.setAttribute('color', color);
      textEl.setAttribute('align', 'center');
      textEl.setAttribute('scale', '0 0 0');
      textEl.setAttribute('look-at', '[camera]');
      textEl.setAttribute('font', 'mozillavr');
      textEl.setAttribute('width', 1.5);
      
      // Animation d'apparition avec bounce
      textEl.setAttribute('animation__appear', {
        property: 'scale',
        to: `${textSize} ${textSize} ${textSize}`,
        dur: 300,
        easing: 'easeOutBack'
      });
      
      // Animation de montée
      textEl.setAttribute('animation__rise', {
        property: 'position',
        from: '0 0 0',
        to: '0 0.8 0',
        dur: 1500,
        easing: 'easeOutCubic'
      });
      
      // Animation de disparition
      textEl.setAttribute('animation__fade', {
        property: 'opacity',
        from: 1,
        to: 0,
        dur: 800,
        delay: 700,
        easing: 'easeInQuad'
      });
      
      // Pulse pour bullseye
      if (zone === 'bullseye') {
        textEl.setAttribute('animation__pulse', {
          property: 'scale',
          from: `${textSize} ${textSize} ${textSize}`,
          to: `${textSize * 1.2} ${textSize * 1.2} ${textSize * 1.2}`,
          dur: 150,
          dir: 'alternate',
          loop: 3,
          delay: 100,
          easing: 'easeInOutQuad'
        });
      }
      
      feedbackContainer.appendChild(textEl);
      
      // Créer des particules d'impact
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('a-sphere');
        const angle = (i / particleCount) * Math.PI * 2;
        
        // Couleurs variées selon la zone
        let particleColor = color;
        if (zone === 'bullseye') {
          const colors = ['#FFD700', '#FFA500', '#FFFF00'];
          particleColor = colors[i % colors.length];
        }
        
        const radius = 0.015 + Math.random() * 0.015;
        particle.setAttribute('radius', radius);
        particle.setAttribute('color', particleColor);
        particle.setAttribute('material', 'shader: flat; opacity: 1');
        particle.setAttribute('position', '0 0 0');
        
        // Distance d'explosion
        const distance = 0.3 + Math.random() * 0.3;
        const endX = Math.cos(angle) * distance;
        const endY = 0.1 + Math.random() * 0.2;
        const endZ = Math.sin(angle) * distance;
        
        // Animation d'explosion
        particle.setAttribute('animation__explode', {
          property: 'position',
          to: `${endX} ${endY} ${endZ}`,
          dur: 600 + Math.random() * 200,
          easing: 'easeOutQuad'
        });
        
        // Animation de shrink
        particle.setAttribute('animation__shrink', {
          property: 'scale',
          to: '0 0 0',
          dur: 800,
          delay: 400,
          easing: 'easeInQuad'
        });
        
        // Animation d'opacité
        particle.setAttribute('animation__fade', {
          property: 'material.opacity',
          to: 0,
          dur: 800,
          delay: 400,
          easing: 'easeInQuad'
        });
        
        feedbackContainer.appendChild(particle);
      }
      
      // Anneau d'impact pour bullseye et middle
      if (zone === 'bullseye' || zone === 'middle') {
        const ring = document.createElement('a-torus');
        ring.setAttribute('radius', 0.05);
        ring.setAttribute('radius-tubular', 0.01);
        ring.setAttribute('color', color);
        ring.setAttribute('material', 'shader: flat; opacity: 0.8; side: double');
        ring.setAttribute('position', '0 0 0');
        
        // Orienter l'anneau vers la caméra
        ring.setAttribute('look-at', '[camera]');
        
        // Animation d'expansion
        ring.setAttribute('animation__expand', {
          property: 'radius',
          to: zone === 'bullseye' ? 0.6 : 0.4,
          dur: 800,
          easing: 'easeOutQuad'
        });
        
        // Animation de disparition
        ring.setAttribute('animation__fade', {
          property: 'material.opacity',
          to: 0,
          dur: 800,
          easing: 'easeInQuad'
        });
        
        feedbackContainer.appendChild(ring);
      }
      
      this.el.sceneEl.appendChild(feedbackContainer);
      
      // Supprimer après l'animation
      setTimeout(() => {
        if (feedbackContainer.parentNode) {
          feedbackContainer.parentNode.removeChild(feedbackContainer);
        }
      }, 1800);
      
      
    } catch (e) {
      console.error('Floating text error:', e);
    }
  },

  /**
   * NOUVEAU: Détecte les collisions avec les murs et applique des rebonds
   */
  checkAndApplyBouncing: function (currentX, currentY, currentZ) {
    let finalX = currentX
    let finalY = currentY
    let finalZ = currentZ
    let bounced = false
    
    const now = Date.now()
    const canBounce = (now - this.lastBounceTime) > this.bounceTimelock
    
    // Détection de proximité avec les murs X (gauche et droit)
    if (currentX < this.roomBounds.minX + this.reboundDistance) {
      // Clamper et rebondir
      finalX = this.roomBounds.minX + this.reboundDistance + 0.1
      if (canBounce && this.flightDirection > 0) {
        this.flightDirection *= -1
        this.lastBounceTime = now
        bounced = true
      }
    } else if (currentX > this.roomBounds.maxX - this.reboundDistance) {
      // Clamper et rebondir
      finalX = this.roomBounds.maxX - this.reboundDistance - 0.1
      if (canBounce && this.flightDirection < 0) {
        this.flightDirection *= -1
        this.lastBounceTime = now
        bounced = true
      }
    }
    
    // Détection de proximité avec les murs Z (avant et arrière)
    if (currentZ < this.roomBounds.minZ + this.reboundDistance) {
      // Clamper et rebondir
      finalZ = this.roomBounds.minZ + this.reboundDistance + 0.1
      if (canBounce) {
        this.flightDirection *= -1
        this.lastBounceTime = now
        bounced = true
      }
    } else if (currentZ > this.roomBounds.maxZ - this.reboundDistance) {
      // Clamper et rebondir
      finalZ = this.roomBounds.maxZ - this.reboundDistance - 0.1
      if (canBounce) {
        this.flightDirection *= -1
        this.lastBounceTime = now
        bounced = true
      }
    }
    
    // Détection de proximité avec le sol et plafond (mais pas de rebond horizontal)
    if (currentY < this.roomBounds.minY + this.reboundDistance) {
      finalY = this.roomBounds.minY + this.reboundDistance + 0.1
    } else if (currentY > this.roomBounds.maxY - this.reboundDistance) {
      finalY = this.roomBounds.maxY - this.reboundDistance - 0.1
    }
    
    return { x: finalX, y: finalY, z: finalZ }
  },

  destroy: function (lastPoints) {
    
    // Marquer comme étant en cours de destruction pour éviter les doubles appels
    if (this.isDestroying) {
      return
    }
    this.isDestroying = true
    
    // Référence à this.el pour utilisation dans les callbacks
    const targetEl = this.el
    const sceneEl = this.el.sceneEl
    
    // Récupérer la position pour les effets visuels
    const worldPos = new THREE.Vector3();
    targetEl.object3D.getWorldPosition(worldPos);
    
    // Créer l'effet de destruction (particules + texte)
    this.createDestroyEffect(worldPos, lastPoints);
    
    // Supprimer toutes les flèches plantées dans cette cible IMMÉDIATEMENT
    this.arrowElements.forEach(arrow => {
      if (arrow && arrow.parentNode) {
        arrow.parentNode.removeChild(arrow)
      }
    })
    this.arrowElements = []
    
    // Émettre événement de destruction IMMÉDIATEMENT
    try {
      sceneEl.emit('target-destroyed', {
        points: this.data.points,
        totalHits: this.hitCount,
        bonusPoints: Math.floor(lastPoints * 0.5),
        surfaceType: this.surfaceType,
        targetId: targetEl.id
      })
    } catch (e) {
      console.error('Event emission error:', e)
    }
    
    // SOLUTION XR: Utiliser les animations A-Frame natives qui fonctionnent en WebXR
    // au lieu de requestAnimationFrame qui ne fonctionne pas en mode XR
    try {
      // Obtenir l'animation de mort spécifique au type de cible
      const glbChild = targetEl.querySelector('[gltf-model]')
      let deathAnim = {
        rotation: '360 360 360',
        scale: '0 0 0',
        duration: 300,
        easing: 'easeInQuad'
      }
      
      if (glbChild) {
        const glbModelAttr = glbChild.getAttribute('gltf-model')
        if (glbModelAttr) {
          // Extraire l'assetId (format: #asset-id)
          const assetId = glbModelAttr.replace('#', '')
          deathAnim = getDeathAnimation(assetId)
        }
      }
      
      // Supprimer les anciennes animations si elles existent
      targetEl.removeAttribute('animation__scale')
      targetEl.removeAttribute('animation__rotation')
      
      // Animation de scale vers 0 avec A-Frame animation
      targetEl.setAttribute('animation__scale', {
        property: 'scale',
        to: deathAnim.scale,
        dur: deathAnim.duration,
        easing: deathAnim.easing
      })
      
      // Animation de rotation avec A-Frame animation
      targetEl.setAttribute('animation__rotation', {
        property: 'rotation',
        to: deathAnim.rotation,
        dur: deathAnim.duration,
        easing: deathAnim.easing
      })
      
      // Écouter la fin de l'animation pour supprimer l'élément
      const onAnimationComplete = () => {
        targetEl.removeEventListener('animationcomplete__scale', onAnimationComplete)
        if (targetEl.parentNode) {
          targetEl.parentNode.removeChild(targetEl)
        }
      }
      
      targetEl.addEventListener('animationcomplete__scale', onAnimationComplete)
      
      // Sécurité: supprimer après timeout si l'animation ne se termine pas
      const timeout = deathAnim.duration + 100
      setTimeout(() => {
        if (targetEl && targetEl.parentNode) {
          targetEl.parentNode.removeChild(targetEl)
        }
      }, timeout)
      
    } catch (e) {
      console.error('Destroy animation error:', e)
      // En cas d'erreur, supprimer immédiatement
      if (targetEl && targetEl.parentNode) {
        targetEl.parentNode.removeChild(targetEl)
      }
    }
  },
  
  createDestroyEffect: function(worldPos, points) {
    try {
      // Créer un container pour l'effet
      const effectContainer = document.createElement('a-entity');
      effectContainer.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);
      this.el.sceneEl.appendChild(effectContainer);
      
      // Texte "DÉTRUIT!" avec animation A-Frame native
      const destroyText = document.createElement('a-text');
      destroyText.setAttribute('value', `💥 DETRUIT! +${Math.floor(points * 0.5)} BONUS`);
      destroyText.setAttribute('color', '#FF4444');
      destroyText.setAttribute('align', 'center');
      destroyText.setAttribute('scale', '0.4 0.4 0.4');
      destroyText.setAttribute('position', '0 0.5 0');
      destroyText.setAttribute('look-at', '[camera]');
      destroyText.setAttribute('font', 'mozillavr');
      
      // Animations A-Frame natives pour le texte
      destroyText.setAttribute('animation__position', {
        property: 'position',
        to: '0 1.3 0',
        dur: 1200,
        easing: 'easeOutCubic'
      });
      
      destroyText.setAttribute('animation__scale', {
        property: 'scale',
        from: '0.4 0.4 0.4',
        to: '0.6 0.6 0.6',
        dur: 150,
        easing: 'easeOutQuad'
      });
      
      destroyText.setAttribute('animation__opacity', {
        property: 'opacity',
        from: 1,
        to: 0,
        dur: 1200,
        delay: 400,
        easing: 'easeInQuad'
      });
      
      effectContainer.appendChild(destroyText);
      
      // Créer des particules qui explosent avec animations A-Frame
      const particleCount = 8;
      
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('a-sphere');
        const angle = (i / particleCount) * Math.PI * 2;
        
        // Couleurs variées
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF8C00'];
        const color = colors[i % colors.length];
        
        const radius = 0.03 + Math.random() * 0.02;
        particle.setAttribute('radius', radius);
        particle.setAttribute('color', color);
        particle.setAttribute('position', '0 0 0');
        particle.setAttribute('material', 'shader: flat');
        
        // Position finale de la particule
        const distance = 0.8 + Math.random() * 0.4;
        const endX = Math.cos(angle) * distance;
        const endY = 0.3 + Math.random() * 0.5;
        const endZ = Math.sin(angle) * distance;
        
        // Animation de position avec A-Frame
        particle.setAttribute('animation__position', {
          property: 'position',
          to: `${endX} ${endY} ${endZ}`,
          dur: 800,
          easing: 'easeOutQuad'
        });
        
        // Animation de scale (shrink)
        particle.setAttribute('animation__scale', {
          property: 'scale',
          to: '0 0 0',
          dur: 1000,
          easing: 'easeInQuad'
        });
        
        // Animation d'opacité
        particle.setAttribute('animation__opacity', {
          property: 'material.opacity',
          to: 0,
          dur: 1000,
          easing: 'easeInQuad'
        });
        
        effectContainer.appendChild(particle);
      }
      
      // Supprimer le container après les animations
      setTimeout(() => {
        if (effectContainer.parentNode) {
          effectContainer.parentNode.removeChild(effectContainer);
        }
      }, 1300);
      
    } catch (e) {
      console.error('Destroy effect error:', e);
    }
  },

  setupMovement: function () {
    // Mouvement oscillant pour les cibles mobiles (manuelle, sans A-Frame animation)
    try {
      const basePos = this.el.getAttribute('position')
      const speed = 0.002
      let time = 0
      
      const moveInterval = setInterval(() => {
        if (!this.el || !this.el.parentNode) {
          clearInterval(moveInterval)
          return
        }
        
        time += 16
        const offsetX = Math.sin(time * speed) * 1.5
        const offsetY = Math.cos(time * speed) * 0.5
        const offsetZ = Math.sin(time * speed * 0.5) * 1
        
        this.el.setAttribute('position', `${basePos.x + offsetX} ${basePos.y + offsetY} ${basePos.z + offsetZ}`)
      }, 16)
      
      this.moveInterval = moveInterval
    } catch (e) {
      console.error('Movement error:', e)
    }
  },

  remove: function () {
    // Nettoyer l'intervalle de mouvement
    if (this.moveInterval) {
      clearInterval(this.moveInterval)
      this.moveInterval = null
    }
    // Nettoyer l'intervalle de vol backup
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
  }
})
