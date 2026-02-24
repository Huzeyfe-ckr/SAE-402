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
    
    // NOUVEAU: Système de kills cumulatifs pour les sons
    this.totalKills = 0  // Compteur de kills total
    this.killMilestones = [1, 2, 3, 4, 5]  // Jalons pour déclencher les sons
    this.milestonesReached = new Set()  // Tracker les jalons déjà atteints
    
    // Écouter les événements de hit
    this.el.addEventListener('target-hit', this.onTargetHit.bind(this))
    
    // NOUVEAU: Écouter les destruction de cibles pour compter les kills
    this.el.addEventListener('target-destroyed', this.onTargetDestroyed.bind(this))
    
    console.log('🎯 Système de combo initialisé')
    console.log('🎯 Écoute des événements target-destroyed pour les sons de kills')
    
    // Vérifier que tous les audios existent
    const audioIds = ['combo-double-sound', 'combo-triple-sound', 'combo-quad-sound', 'combo-penta-sound']
    audioIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) {
        console.log(`✅ Audio trouvé: ${id} - ${el.src}`)
      } else {
        console.log(`🔴 Audio MANQUANT: ${id}`)
      }
    })
  },

  onTargetDestroyed: function (evt) {
    // Incrémenter le compteur total de kills
    this.totalKills++
    console.log(`☠️ Kill #${this.totalKills} détecté par combo-system!`)
    
    // Vérifier si on a atteint un jalon et déclencher le son correspondant
    this.playKillMilestoneSound(this.totalKills)
  },

  playKillMilestoneSound: function (killCount) {
    // Déterminer le son à jouer basé sur le nombre total de kills
    let soundId = null
    
    if (killCount === 1) {
      console.log(`🎯 Kill #1 - Pas de son pour le premier kill`)
      soundId = null  // Pas de son pour le 1er kill
    } else if (killCount === 2) {
      console.log(`🎵 Kill #2 - Tentative de jouer: combo-double-sound`)
      soundId = 'combo-double-sound'  // "Doublé!"
    } else if (killCount === 3) {
      console.log(`🎵 Kill #3 - Tentative de jouer: combo-triple-sound`)
      soundId = 'combo-triple-sound'  // "Triplé!"
    } else if (killCount === 4) {
      console.log(`🎵 Kill #4 - Tentative de jouer: combo-quad-sound`)
      soundId = 'combo-quad-sound'    // "Quadruplé!"
    } else if (killCount >= 5) {
      console.log(`🎵 Kill #${killCount} - Tentative de jouer: combo-penta-sound`)
      soundId = 'combo-penta-sound'   // "5+ kills!"
    }
    
    // Jouer le son s'il existe et n'a pas déjà été joué
    if (soundId && !this.milestonesReached.has(killCount)) {
      this.milestonesReached.add(killCount)
      console.log(`🔊 [Kill #${killCount}] Cherche élément audio: ${soundId}`)
      
      try {
        const soundEl = document.getElementById(soundId)
        if (soundEl) {
          console.log(`✅ [Kill #${killCount}] Élément trouvé - Volume: ${soundEl.volume}, SrcAttr: ${soundEl.src}`)
          soundEl.currentTime = 0
          soundEl.volume = 0.8
          
          // Vérifier que l'audio est prêt
          if (soundEl.readyState < 2) {
            console.log(`⚠️ [Kill #${killCount}] Audio pas prêt (readyState=${soundEl.readyState}), attend...`)
            soundEl.addEventListener('canplay', () => {
              console.log(`✅ [Kill #${killCount}] Audio prêt, play()`)
              soundEl.play().catch(e => {
                console.log(`🔴 [Kill #${killCount}] Erreur play(): ${e}`)
              })
            }, { once: true })
          } else {
            console.log(`✅ [Kill #${killCount}] Audio prêt (readyState=${soundEl.readyState}), play()`)
            soundEl.play().catch(e => {
              console.log(`🔴 [Kill #${killCount}] Erreur play(): ${e}`)
            })
          }
        } else {
          console.log(`🔴 [Kill #${killCount}] Élément audio INTROUVABLE: ${soundId}`)
        }
      } catch (e) {
        console.error(`[Kill #${killCount}] Kill sound error:`, e)
      }
    } else {
      if (!soundId) {
        console.log(`🎯 [Kill #${killCount}] Pas de son assigné`)
      } else {
        console.log(`⚠️  [Kill #${killCount}] Son ${soundId} déjà joué (dans milestonesReached)`)
      }
    }
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
      this.playComboSound()
    }

    // Mettre à jour l'affichage
    this.updateComboDisplay()
  },

  showComboFeedback: function () {
    const camera = this.el.querySelector('[camera]')
    if (!camera) return

    // Obtenir la position de la caméra
    const cameraWorldPos = new THREE.Vector3()
    camera.object3D.getWorldPosition(cameraWorldPos)
    
    // Créer le container principal
    const comboContainer = document.createElement('a-entity')
    comboContainer.setAttribute('position', {
      x: cameraWorldPos.x,
      y: cameraWorldPos.y + 0.3,
      z: cameraWorldPos.z - 1.5
    })
    
    // Déterminer le niveau de combo et les paramètres visuels
    let comboText = ''
    let color = '#FFA500'
    let textScale = 0.8
    let particleCount = 8
    let comboLevel = 'normal'
    
    if (this.combo === 2) {
      comboText = '⚡ DOUBLE HIT! ⚡'
      color = '#FFFF00'
      textScale = 0.9
      particleCount = 10
      comboLevel = 'double'
    } else if (this.combo === 3) {
      comboText = '🔥 TRIPLE KILL! 🔥'
      color = '#FFA500'
      textScale = 1.0
      particleCount = 12
      comboLevel = 'triple'
    } else if (this.combo === 4) {
      comboText = '💥 QUAD DAMAGE! 💥'
      color = '#FF6B00'
      textScale = 1.1
      particleCount = 15
      comboLevel = 'quad'
    } else if (this.combo === 5) {
      comboText = '⭐ PENTA STRIKE! ⭐'
      color = '#FF4500'
      textScale = 1.2
      particleCount = 18
      comboLevel = 'penta'
    } else if (this.combo >= 10) {
      comboText = `🌟 LEGENDARY x${this.combo}!! 🌟`
      color = '#FF0000'
      textScale = 1.4
      particleCount = 25
      comboLevel = 'legendary'
    } else if (this.combo >= 7) {
      comboText = `💫 UNSTOPPABLE x${this.combo}! 💫`
      color = '#FF1493'
      textScale = 1.3
      particleCount = 20
      comboLevel = 'unstoppable'
    } else {
      comboText = `🔥 COMBO x${this.combo}! 🔥`
      color = '#FF6B00'
      textScale = 1.0
      particleCount = this.combo + 8
    }
    
    // Texte principal du combo
    const mainText = document.createElement('a-text')
    mainText.setAttribute('value', comboText)
    mainText.setAttribute('align', 'center')
    mainText.setAttribute('color', color)
    mainText.setAttribute('width', 2.5)
    mainText.setAttribute('font', 'mozillavr')
    mainText.setAttribute('position', '0 0 0')
    mainText.setAttribute('look-at', '[camera]')
    
    // Animation d'apparition élastique avec A-Frame
    mainText.setAttribute('scale', '0 0 0')
    mainText.setAttribute('animation__appear', {
      property: 'scale',
      to: `${textScale} ${textScale} ${textScale}`,
      dur: 400,
      easing: 'easeOutElastic'
    })
    
    // Animation de montée
    mainText.setAttribute('animation__rise', {
      property: 'position',
      to: '0 0.6 0',
      dur: 1500,
      easing: 'easeOutCubic'
    })
    
    // Animation de disparition
    mainText.setAttribute('animation__fade', {
      property: 'opacity',
      from: 1,
      to: 0,
      dur: 800,
      delay: 700,
      easing: 'easeInQuad'
    })
    
    // Animation de pulse pour les gros combos
    if (this.combo >= 5) {
      mainText.setAttribute('animation__pulse', {
        property: 'scale',
        from: `${textScale} ${textScale} ${textScale}`,
        to: `${textScale * 1.15} ${textScale * 1.15} ${textScale * 1.15}`,
        dur: 200,
        dir: 'alternate',
        loop: 3,
        easing: 'easeInOutQuad'
      })
    }
    
    comboContainer.appendChild(mainText)
    
    // Texte secondaire avec le multiplicateur
    const multiplierText = document.createElement('a-text')
    multiplierText.setAttribute('value', `Multiplicateur: ${this.multiplier.toFixed(1)}x`)
    multiplierText.setAttribute('align', 'center')
    multiplierText.setAttribute('color', '#FFD700')
    multiplierText.setAttribute('width', 1.5)
    multiplierText.setAttribute('font', 'mozillavr')
    multiplierText.setAttribute('position', '0 -0.25 0')
    multiplierText.setAttribute('look-at', '[camera]')
    multiplierText.setAttribute('scale', '0 0 0')
    
    multiplierText.setAttribute('animation__appear', {
      property: 'scale',
      to: '0.6 0.6 0.6',
      dur: 300,
      delay: 200,
      easing: 'easeOutBack'
    })
    
    multiplierText.setAttribute('animation__fade', {
      property: 'opacity',
      from: 1,
      to: 0,
      dur: 800,
      delay: 700,
      easing: 'easeInQuad'
    })
    
    comboContainer.appendChild(multiplierText)
    
    // Créer des particules d'explosion autour du texte
    this.createComboParticles(comboContainer, particleCount, color, comboLevel)
    
    // Ajouter à la scène
    this.el.appendChild(comboContainer)
    
    // Supprimer après l'animation
    setTimeout(() => {
      if (comboContainer.parentNode) {
        comboContainer.parentNode.removeChild(comboContainer)
      }
    }, 2000)
    
    console.log(`✨ Animation combo: ${comboLevel} (x${this.combo})`)
  },
  
  createComboParticles: function (container, count, baseColor, level) {
    // Créer des particules qui explosent radialement
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('a-sphere')
      const angle = (i / count) * Math.PI * 2
      
      // Varier les couleurs selon le niveau
      let particleColor = baseColor
      if (level === 'legendary' || level === 'unstoppable') {
        const colors = ['#FF0000', '#FFD700', '#FF1493', '#FF6B00', '#FFFF00']
        particleColor = colors[i % colors.length]
      } else if (level === 'penta' || level === 'quad') {
        const colors = ['#FFA500', '#FFD700', '#FF4500']
        particleColor = colors[i % colors.length]
      }
      
      const radius = 0.02 + Math.random() * 0.02
      particle.setAttribute('radius', radius)
      particle.setAttribute('color', particleColor)
      particle.setAttribute('material', 'shader: flat; opacity: 1')
      particle.setAttribute('position', '0 0 0')
      
      // Distance d'explosion variable
      const distance = 0.8 + Math.random() * 0.6
      const heightVariation = (Math.random() - 0.5) * 0.4
      const endX = Math.cos(angle) * distance
      const endY = heightVariation
      const endZ = Math.sin(angle) * distance
      
      // Animation de position (explosion)
      particle.setAttribute('animation__explode', {
        property: 'position',
        to: `${endX} ${endY} ${endZ}`,
        dur: 800 + Math.random() * 400,
        easing: 'easeOutQuad'
      })
      
      // Animation de scale (shrink)
      particle.setAttribute('animation__shrink', {
        property: 'scale',
        to: '0 0 0',
        dur: 1000,
        delay: 500,
        easing: 'easeInQuad'
      })
      
      // Animation d'opacité
      particle.setAttribute('animation__fade', {
        property: 'material.opacity',
        to: 0,
        dur: 1000,
        delay: 500,
        easing: 'easeInQuad'
      })
      
      container.appendChild(particle)
    }
    
    // Ajouter un anneau d'énergie qui se dilate
    if (level === 'triple' || level === 'quad' || level === 'penta' || level === 'legendary' || level === 'unstoppable') {
      const ring = document.createElement('a-torus')
      ring.setAttribute('radius', 0.1)
      ring.setAttribute('radius-tubular', 0.02)
      ring.setAttribute('color', baseColor)
      ring.setAttribute('material', 'shader: flat; opacity: 0.8; side: double')
      ring.setAttribute('position', '0 0 0')
      ring.setAttribute('rotation', '90 0 0')
      
      ring.setAttribute('animation__expand', {
        property: 'radius',
        to: 1.5,
        dur: 1000,
        easing: 'easeOutQuad'
      })
      
      ring.setAttribute('animation__fade', {
        property: 'material.opacity',
        to: 0,
        dur: 1000,
        easing: 'easeInQuad'
      })
      
      container.appendChild(ring)
    }
  },

  playComboSound: function () {
    try {
      let soundId = null
      
      if (this.combo === 3) {
        soundId = 'combo-triple-sound'
      } else if (this.combo === 4) {
        soundId = 'combo-quad-sound'
      } else if (this.combo === 5) {
        soundId = 'combo-penta-sound'
      } else if (this.combo === 2) {
        soundId = 'combo-double-sound'
      } else if (this.combo >= 7) {
        // Utiliser combo-penta pour les gros combos aussi
        soundId = 'combo-penta-sound'
      }
      
      if (soundId) {
        const soundEl = document.getElementById(soundId)
        if (soundEl) {
          soundEl.currentTime = 0
          soundEl.volume = 0.8
          soundEl.play().catch(e => {
            console.log(`🔊 Son combo non disponible: ${soundId}`)
          })
        }
      }
    } catch (e) {
      console.error('Combo sound error:', e)
    }
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
