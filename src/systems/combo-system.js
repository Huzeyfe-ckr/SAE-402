/**
 * Système combo pour A-Frame
 * Gère les multiplicateurs de score basés sur les combos
 * Utilise aframe-state-component pour synchroniser l'état
 */

AFRAME.registerSystem('combo-system', {
  schema: {
    comboTimeout: { type: 'number', default: 2000 }, // 2 secondes pour maintenir le combo
    maxMultiplier: { type: 'number', default: 5.0 }
  },

  init: function () {
    this.combo = 0
    this.multiplier = 1.0
    this.maxCombo = 0
    this.lastHitTime = 0
    this.comboActive = false
    
    // Écouter les événements de hit
    this.el.addEventListener('target-hit', this.onTargetHit.bind(this))
    
    console.log('🎯 Système de combo initialisé')
  },

  onTargetHit: function (evt) {
    const now = Date.now()
    const { zone } = evt.detail
    
    // Vérifier si le combo continue
    if (this.comboActive && (now - this.lastHitTime) < this.data.comboTimeout) {
      // Combo continue!
      this.combo++
      
      // Bonus supplémentaire pour les bullseyes
      if (zone === 'bullseye') {
        this.combo += 1
      }
    } else {
      // Nouveau combo
      this.combo = 1
      this.comboActive = true
    }

    this.lastHitTime = now
    this.maxCombo = Math.max(this.maxCombo, this.combo)

    // Calculer le multiplicateur (max 5x)
    this.multiplier = Math.min(
      1.0 + (this.combo * 0.2), // +20% par combo
      this.data.maxMultiplier
    )

    // Mettre à jour le state
    this.el.setAttribute('state', 'combo', this.combo)
    this.el.setAttribute('state', 'multiplier', this.multiplier)

    console.log(`🔥 Combo: x${this.combo} | Multiplicateur: ${this.multiplier.toFixed(1)}x`)

    // Afficher le feedback de combo
    if (this.combo >= 3) {
      this.showComboFeedback()
    }

    // Mettre à jour l'affichage
    this.updateComboDisplay()
  },

  showComboFeedback: function () {
    const camera = this.el.querySelector('[camera]')
    if (!camera) return

    const cameraPos = camera.object3D.position
    const feedback = document.createElement('a-text')
    
    let comboText = `🔥 COMBO x${this.combo}!`
    let color = '#FFA500'
    
    if (this.combo >= 10) {
      comboText = `🔥🔥 MEGA COMBO x${this.combo}!! 🔥🔥`
      color = '#FF0000'
    } else if (this.combo >= 5) {
      comboText = `🔥 SUPER COMBO x${this.combo}! 🔥`
      color = '#FF4500'
    }
    
    feedback.setAttribute('value', comboText)
    feedback.setAttribute('position', `${cameraPos.x} ${cameraPos.y + 0.5} ${cameraPos.z - 2}`)
    feedback.setAttribute('align', 'center')
    feedback.setAttribute('color', color)
    feedback.setAttribute('width', '4')
    
    // Animation manuelle au lieu d'utiliser A-Frame animation component
    this.el.appendChild(feedback)
    
    let elapsed = 0
    const scaleDuration = 500
    const fadeDuration = 1500
    
    const animateFeedback = () => {
      elapsed += 16
      
      // Scale animation (0-500ms)
      if (elapsed <= scaleDuration) {
        const progress = elapsed / scaleDuration
        const easeOutElastic = progress === 1 ? 1 : Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
        const scale = 0.5 + (1.5 - 0.5) * easeOutElastic
        feedback.setAttribute('scale', `${scale} ${scale} ${scale}`)
      } else {
        feedback.setAttribute('scale', '1.5 1.5 1.5')
      }
      
      // Fade animation (500-2000ms)
      if (elapsed > 500) {
        const fadeProgress = (elapsed - 500) / fadeDuration
        if (fadeProgress <= 1) {
          const opacity = 1 - fadeProgress
          feedback.setAttribute('material', `opacity: ${opacity}`)
        }
      }
      
      if (elapsed < fadeDuration + 500) {
        requestAnimationFrame(animateFeedback)
      }
    }
    
    requestAnimationFrame(animateFeedback)
    
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback)
      }
    }, 2100)
  },

  updateComboDisplay: function () {
    const comboEl = document.getElementById('combo-value')
    if (comboEl) {
      let displayText = `x${this.combo}`
      
      if (this.multiplier > 1) {
        displayText += ` (${this.multiplier.toFixed(1)}x)`
      }
      
      comboEl.textContent = displayText
      
      // Ajouter une classe pour l'animation CSS
      if (this.combo >= 3) {
        comboEl.classList.add('combo-active')
        setTimeout(() => {
          comboEl.classList.remove('combo-active')
        }, 500)
      }
    }
  },

  tick: function (time, deltaTime) {
    // Vérifier si le combo expire
    if (this.comboActive) {
      const now = Date.now()
      
      if (now - this.lastHitTime > this.data.comboTimeout) {
        // Combo expiré
        this.comboActive = false
        
        if (this.combo > 1) {
          console.log(`❌ Combo perdu: x${this.combo}`)
        }
        
        this.combo = 0
        this.multiplier = 1.0
        
        // Réinitialiser le state
        this.el.setAttribute('state', 'combo', 0)
        this.el.setAttribute('state', 'multiplier', 1.0)
        
        this.updateComboDisplay()
      }
    }
  },

  getStats: function () {
    return {
      currentCombo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.multiplier
    }
  }
})
