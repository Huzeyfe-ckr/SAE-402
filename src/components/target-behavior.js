/**
 * Composant target-behavior pour A-Frame
 * Gère les HP, le calcul de précision basé sur la distance au centre
 * et les animations de hit/destruction
 */

AFRAME.registerComponent('target-behavior', {
  schema: {
    points: { type: 'number', default: 10 },
    hp: { type: 'number', default: 1 },
    movable: { type: 'boolean', default: false },
    centerRadius: { type: 'number', default: 0.1 }, // Rayon du centre (bullseye)
    middleRadius: { type: 'number', default: 0.3 }, // Rayon moyen
    outerRadius: { type: 'number', default: 0.5 }   // Rayon extérieur
  },

  init: function () {
    this.currentHp = this.data.hp
    this.hitCount = 0
    
    // Animation de mouvement si activé
    if (this.data.movable) {
      this.setupMovement()
    }

    console.log(`🎯 Cible créée: ${this.data.points} points, ${this.data.hp} HP`)
  },

  /**
   * Méthode appelée quand une flèche touche la cible
   * Calcule le score de précision basé sur la distance au centre
   */
  onArrowHit: function (arrowEl, impactPoint) {
    try {
      if (!impactPoint) {
        console.error('No impact point provided')
        return
      }

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

      console.log(`💥 Cible touchée! Zone: ${hitZone} | Distance: ${distanceToCenter.toFixed(3)}m | Points: ${finalPoints} | HP restants: ${this.currentHp}`)

      // Jouer le son de hit
      try {
        const hitSound = document.getElementById('hit-sound')
        if (hitSound) {
          hitSound.currentTime = 0
          hitSound.play().catch(e => console.log('Son de hit non disponible:', e))
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
          distanceToCenter: distanceToCenter
        })
      } catch (e) {
        console.error('Event emission error:', e)
      }

      // Détruire la cible si HP = 0
      if (this.currentHp <= 0) {
        this.destroy(finalPoints)
      }
    } catch (e) {
      console.error('onArrowHit error:', e)
    }
  },

  playHitAnimation: function (zone) {
    // Animation simplifiée sans utiliser A-Frame animation component
    // qui peut causer des erreurs clipAction
    try {
      const scale = zone === 'bullseye' ? 1.3 : zone === 'middle' ? 1.2 : 1.1
      const originalScale = this.el.getAttribute('scale')
      
      this.el.setAttribute('scale', `${originalScale.x * scale} ${originalScale.y * scale} ${originalScale.z * scale}`)
      
      // Revenir à l'échelle originale après 150ms
      setTimeout(() => {
        this.el.setAttribute('scale', originalScale)
      }, 150)
    } catch (e) {
      console.error('Hit animation error:', e)
    }
  },

  showHitFeedback: function (localPosition, points, zone) {
    // Feedback simple sans animation complexe
    console.log(`✓ Hit feedback: +${points} points in ${zone} zone`)
    
    // On peut ajouter d'autres feedback ici si nécessaire
    // Feedback haptique ou sonore serait plus fiable qu'une animation
  },

  destroy: function (lastPoints) {
    console.log('🎉 Cible détruite!')
    
    try {
      // Animation de destruction simplifiée
      let elapsed = 0
      const duration = 400
      const startScale = this.el.getAttribute('scale')
      const startRotation = this.el.getAttribute('rotation')
      
      const animateDestroy = () => {
        elapsed += 16
        const progress = Math.min(elapsed / duration, 1)
        
        // Scale to 0
        this.el.setAttribute('scale', `${startScale.x * (1 - progress)} ${startScale.y * (1 - progress)} ${startScale.z * (1 - progress)}`)
        
        // Rotation
        this.el.setAttribute('rotation', `${startRotation.x} ${startRotation.y + (progress * 360)} ${startRotation.z}`)
        
        if (progress < 1) {
          requestAnimationFrame(animateDestroy)
        }
      }
      
      animateDestroy()
    } catch (e) {
      console.error('Destroy animation error:', e)
    }

    // Émettre événement de destruction
    try {
      this.el.sceneEl.emit('target-destroyed', {
        points: this.data.points,
        totalHits: this.hitCount,
        bonusPoints: Math.floor(lastPoints * 0.5)
      })
    } catch (e) {
      console.error('Event emission error:', e)
    }

    // Supprimer après l'animation
    setTimeout(() => {
      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el)
      }
    }, 450)
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
      console.log('🎯 Cible mobile activée')
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
  }
})
