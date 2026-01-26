/**
 * Composant arrow-physics pour A-Frame avec aframe-physics-system
 * Applique une impulsion initiale basée sur la tension de l'arc
 * Gère les collisions et le plantage dans les surfaces
 */

AFRAME.registerComponent('arrow-physics', {
  schema: {
    tension: { type: 'number', default: 1.0 },
    speed: { type: 'number', default: 25 },
    windForce: { type: 'vec3', default: { x: 0, y: 0, z: 0 } }
  },

  init: function () {
    this.hasCollided = false
    this.lifetime = 0
    this.maxLifetime = 15000 // 15 secondes max
    
    // Attendre que le corps physique soit initialisé
    this.el.addEventListener('body-loaded', () => {
      this.applyInitialImpulse()
      // Activer CCD pour éviter le tunneling (A-Frame 1.7+ avec Ammo.js)
      if (this.el.body && this.el.body.setCcdMotionThreshold) {
        this.el.body.setCcdMotionThreshold(0.01)
        this.el.body.setCcdSweptSphereRadius(0.005)
        console.log('✅ CCD activé pour la flèche (anti-tunneling)')
      }
    })

    // Gérer les collisions
    this.el.addEventListener('collide', this.onCollide.bind(this))
    
    console.log('➡️ Physique de flèche activée (Ammo.js avec CCD)')
  },

  applyInitialImpulse: function () {
    const body = this.el.body
    if (!body) {
      console.warn('⚠️ Corps physique non trouvé')
      return
    }

    // Calculer la direction de tir basée sur la rotation de la flèche
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(this.el.object3D.quaternion)
    
    // Calculer la force basée sur la tension
    const force = direction.multiplyScalar(this.data.speed * this.data.tension)
    
    // Appliquer l'impulsion (via Ammo.js)
    const impulse = new Ammo.btVector3(force.x, force.y, force.z)
    body.applyCentralImpulse(impulse)
    Ammo.destroy(impulse)
    
    console.log(`🚀 Impulsion appliquée: ${force.length().toFixed(2)} m/s`)
  },

  tick: function (time, deltaTime) {
    this.lifetime += deltaTime

    // Supprimer la flèche après un certain temps
    if (this.lifetime > this.maxLifetime) {
      this.el.parentNode.removeChild(this.el)
      return
    }

    // Si la flèche n'a pas encore collisionné, appliquer le vent
    if (!this.hasCollided && this.el.body) {
      this.applyWind(deltaTime)
      this.alignWithVelocity()
    }
  },

  applyWind: function (deltaTime) {
    if (!this.el.body) return
    
    const dt = deltaTime / 1000
    const windForce = new Ammo.btVector3(
      this.data.windForce.x * dt,
      this.data.windForce.y * dt,
      this.data.windForce.z * dt
    )
    
    this.el.body.applyCentralForce(windForce)
    Ammo.destroy(windForce)
  },

  alignWithVelocity: function () {
    // Orienter la flèche dans la direction du mouvement
    if (!this.el.body) return
    
    const velocity = this.el.body.getLinearVelocity()
    const vel = new THREE.Vector3(velocity.x(), velocity.y(), velocity.z())
    
    if (vel.length() > 0.1) {
      const direction = vel.normalize()
      this.el.object3D.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction
      )
    }
  },

  onCollide: function (evt) {
    if (this.hasCollided) return
    
    const targetEl = evt.detail.body.el
    this.hasCollided = true
    
    console.log(`💥 Collision détectée avec: ${targetEl.id || 'surface'}`)

    // Récupérer le point d'impact
    const impactPoint = this.el.object3D.position.clone()
    
    // Vérifier si c'est une cible
    if (targetEl.hasAttribute('target-behavior')) {
      const targetComponent = targetEl.components['target-behavior']
      targetComponent.onArrowHit(this.el, impactPoint)
    }

    // Transformer la flèche en corps cinématique (elle se plante)
    if (this.el.body) {
      this.el.removeAttribute('dynamic-body')
      this.el.setAttribute('static-body', {
        shape: 'cylinder'
      })
      
      // Figer la flèche à sa position actuelle
      const currentPos = this.el.object3D.position
      const currentRot = this.el.object3D.rotation
      
      setTimeout(() => {
        this.el.setAttribute('position', `${currentPos.x} ${currentPos.y} ${currentPos.z}`)
        this.el.setAttribute('rotation', `${currentRot.x * 180/Math.PI} ${currentRot.y * 180/Math.PI} ${currentRot.z * 180/Math.PI}`)
      }, 50)
    }

    // Retirer la flèche après 5 secondes
    setTimeout(() => {
      if (this.el && this.el.parentNode) {
        // Animation de disparition manuelle
        let elapsed = 0
        const duration = 500
        const startScale = this.el.getAttribute('scale')
        
        const animateRemove = () => {
          elapsed += 16
          const progress = Math.min(elapsed / duration, 1)
          const scale = startScale.x * (1 - progress)
          this.el.setAttribute('scale', `${scale} ${scale} ${scale}`)
          
          if (progress < 1) {
            requestAnimationFrame(animateRemove)
          } else {
            if (this.el && this.el.parentNode) {
              this.el.parentNode.removeChild(this.el)
            }
          }
        }
        
        animateRemove()
      }
    }, 5000)
  }
})

