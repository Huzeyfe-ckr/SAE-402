/**
 * Composant bow-logic pour A-Frame
 * Gère le tir à la gâchette de la manette VR
 * Utilise un raycast pour détecter les cibles
 */

AFRAME.registerComponent('bow-logic', {
  schema: {
    arrowSpeed: { type: 'number', default: 25 }
  },

  init: function () {
    this.raycaster = new THREE.Raycaster()
    this.shootDirection = new THREE.Vector3()
    this.mouse = new THREE.Vector2()
    this.triggerPressed = false
    this.lastGamepadState = {}
    
    // Créer le laser visuel pour le VR
    this.createLaserBeam()
    
    // Écouteurs d'événements pour les contrôleurs VR
    this.el.addEventListener('triggerdown', this.shootArrow.bind(this))
    this.el.addEventListener('trigger-start', this.shootArrow.bind(this))
    this.el.addEventListener('xbuttondown', this.shootArrow.bind(this))
    this.el.addEventListener('abuttondown', this.shootArrow.bind(this))
    
    // Écouteur pour la souris
    document.addEventListener('click', this.shootArrowMouse.bind(this))
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    })
    
    console.log('🏹 Composant bow-logic initialisé (tir VR + souris)')
    this.addLog('✓ bow-logic initialisé')
  },

  createLaserBeam: function() {
    // Créer plusieurs sphères espacées pour créer un laser visible
    const laserGroup = document.createElement('a-entity')
    laserGroup.setAttribute('id', 'laser-group')
    laserGroup.setAttribute('position', '0 0 0')
    laserGroup.setAttribute('rotation', '0 0 0')
    
    // Créer 20 GROSSES sphères espacées le long de l'axe Y négatif
    this.laserSpheres = []
    for (let i = 0; i < 20; i++) {
      const sphere = document.createElement('a-sphere')
      sphere.setAttribute('radius', '0.15')  // Plus grosses
      sphere.setAttribute('color', '#00ff00')
      sphere.setAttribute('position', `0 -${i * 0.3} 0`)  // Axe Y négatif
      sphere.setAttribute('material', 'shader: flat; emissive: #00ff00; emissiveIntensity: 3.0; side: double')
      sphere.setAttribute('visible', 'true')
      laserGroup.appendChild(sphere)
      this.laserSpheres.push(sphere)
    }
    
    // ÉNORME sphère de début JAUNE
    const startSphere = document.createElement('a-sphere')
    startSphere.setAttribute('id', 'ray-start')
    startSphere.setAttribute('radius', '0.3')
    startSphere.setAttribute('color', '#ffff00')
    startSphere.setAttribute('position', '0 0 0')
    startSphere.setAttribute('material', 'shader: flat; emissive: #ffff00; emissiveIntensity: 3.0; side: double')
    startSphere.setAttribute('visible', 'true')
    laserGroup.appendChild(startSphere)
    
    // ÉNORME sphère de fin ROUGE
    const endSphere = document.createElement('a-sphere')
    endSphere.setAttribute('id', 'ray-end')
    endSphere.setAttribute('radius', '0.4')
    endSphere.setAttribute('color', '#ff0000')
    endSphere.setAttribute('position', '0 -6 0')
    endSphere.setAttribute('material', 'shader: flat; emissive: #ff0000; emissiveIntensity: 3.0; side: double')
    endSphere.setAttribute('visible', 'true')
    laserGroup.appendChild(endSphere)
    
    this.el.appendChild(laserGroup)
    this.laserGroup = laserGroup
    this.startSphere = startSphere
    this.endSphere = endSphere
    
    console.log('✅ LASER avec 20 GROSSES sphères créé')
  },

  addLog: function(msg) {
    const errorList = document.getElementById('error-list')
    if (errorList) {
      const div = document.createElement('div')
      div.textContent = msg
      div.style.color = msg.includes('✓') ? '#0f0' : '#f0f'
      errorList.appendChild(div)
      // Garder les 15 derniers messages
      while (errorList.children.length > 15) {
        errorList.removeChild(errorList.firstChild)
      }
    }
  },

  updateLaserBeam: function() {
    if (!this.laserSpheres) return
    
    try {
      // Calculer le raycast pour voir si on vise une cible
      const handPos = this.el.object3D.getWorldPosition(new THREE.Vector3())
      const handRot = this.el.object3D.getWorldQuaternion(new THREE.Quaternion())
      
      const forward = new THREE.Vector3(0, -1, 0)  // Demi-tour: axe Y négatif
      forward.applyQuaternion(handRot)
      
      this.raycaster.set(handPos, forward)
      
      // Vérifier si on vise une cible
      const scene = this.el.sceneEl
      const allEntities = scene.querySelectorAll('[target-behavior]')
      const targets = Array.from(allEntities)
      
      let laserLength = 10
      let laserColor = '#00ff00' // Vert par défaut
      
      if (targets.length > 0) {
        const targetObjects = targets.map(t => t.object3D)
        const intersects = this.raycaster.intersectObjects(targetObjects, true)
        
        if (intersects.length > 0) {
          // On vise une cible - laser rouge et s'arrête à la cible
          laserLength = intersects[0].distance
          laserColor = '#ff0000' // Rouge
        }
      }
      
      // Mettre à jour toutes les sphères du laser
      const numSpheres = Math.min(this.laserSpheres.length, Math.ceil(laserLength))
      for (let i = 0; i < this.laserSpheres.length; i++) {
        if (i < numSpheres) {
          const y = -(i * laserLength / this.laserSpheres.length)  // Axe Y négatif
          this.laserSpheres[i].setAttribute('position', `0 ${y} 0`)
          this.laserSpheres[i].setAttribute('color', laserColor)
          this.laserSpheres[i].setAttribute('material', `shader: flat; emissive: ${laserColor}; emissiveIntensity: 2.0`)
          this.laserSpheres[i].setAttribute('visible', 'true')
        } else {
          this.laserSpheres[i].setAttribute('visible', 'false')
        }
      }
      
      // Mettre à jour la sphère de fin
      if (this.endSphere) {
        this.endSphere.setAttribute('position', `0 -${laserLength} 0`)  // Axe Y négatif
        this.endSphere.setAttribute('color', laserColor)
        this.endSphere.setAttribute('material', `shader: flat; emissive: ${laserColor}; emissiveIntensity: 2.0`)
      }
    } catch (e) {
      // Ignorer les erreurs pour ne pas spammer la console
    }
  },

  tick: function(time, timeDelta) {
    // Vérifier les gamepads WebXR/VR
    const gamepads = navigator.getGamepads()
    
    // Update laser beam direction
    this.updateLaserBeam()
    
    // Mettre à jour toutes les flèches en vol
    this.updateFlyingArrows(timeDelta)
    
    // Update debug panel
    const debugPanel = document.getElementById('debug-panel')
    if (!debugPanel) return
    
    if (!gamepads) {
      document.getElementById('debug-gamepad').textContent = 'Gamepads: NOT AVAILABLE'
      return
    }
    
    // Afficher le nombre de gamepads
    const connectedGamepads = Array.from(gamepads).filter(g => g !== null)
    document.getElementById('debug-gamepad').textContent = `Gamepads: ${connectedGamepads.length} connectés`
    
    // Essayer TOUS les gamepads SANS restriction de hand
    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i]
      if (!gamepad) continue
      
      // Log tous les gamepads actifs
      if (!this.lastGamepadState[i]) {
        this.addLog(`📍 Gamepad ${i}: ${gamepad.id}`)
        this.lastGamepadState[i] = true
      }

      // Vérifier TOUS les boutons disponibles
      let pressedButton = null
      let buttonIndex = -1
      
      for (let b = 0; b < gamepad.buttons.length; b++) {
        const button = gamepad.buttons[b]
        if (button && button.pressed) {
          pressedButton = button
          buttonIndex = b
          break
        }
      }
      
      // Vérifier les axes (joysticks)
      let axisActive = false
      let axisValue = 0
      for (let a = 0; a < gamepad.axes.length; a++) {
        if (Math.abs(gamepad.axes[a]) > 0.5) {
          axisActive = true
          axisValue = gamepad.axes[a]
          break
        }
      }
      
      // Update debug info
      if (pressedButton) {
        document.getElementById('debug-trigger').textContent = `Button ${buttonIndex}: ON ✓ (${pressedButton.value.toFixed(2)})`
      } else {
        document.getElementById('debug-trigger').textContent = `Buttons: OFF`
      }
      
      if (axisActive) {
        document.getElementById('debug-thumbstick').textContent = `Axes: ACTIVE ✓ (${axisValue.toFixed(2)})`
      } else {
        document.getElementById('debug-thumbstick').textContent = `Axes: OFF`
      }

      // Déclencher le tir si BOUTON OU AXE activé
      // Ne pas vérifier la main, just tirer avec n'importe quel input
      if (pressedButton || axisActive) {
        if (!this.triggerPressed) {
          this.triggerPressed = true
          this.addLog(`🎯 Input détecté: Button ${buttonIndex} ou Axis!`)
          console.log(`🎮 Gamepad ${i} - Button/Axis activation detected`)
          this.shootArrow()
        }
      } else {
        this.triggerPressed = false
      }
    }
  },

  updateFlyingArrows: function(timeDelta) {
    const scene = this.el.sceneEl
    if (!scene) return
    
    // Utiliser un delta fixe si timeDelta est invalide
    const deltaSeconds = (timeDelta && timeDelta > 0) ? timeDelta / 1000 : 0.016
    
    // Trouver toutes les flèches en vol
    const arrows = scene.querySelectorAll('[gltf-model="#arrow-model"]')
    
    arrows.forEach(arrow => {
      if (!arrow.arrowData) return
      
      const data = arrow.arrowData
      const elapsed = Date.now() - data.startTime
      
      // Supprimer après 5 secondes
      if (elapsed > data.maxTime) {
        if (arrow.parentNode) {
          arrow.parentNode.removeChild(arrow)
        }
        return
      }
      
      // Récupérer la position actuelle
      const currentPos = arrow.getAttribute('position')
      
      // Calculer la nouvelle position
      const newX = currentPos.x + data.velocity.x * deltaSeconds
      const newY = currentPos.y + data.velocity.y * deltaSeconds
      const newZ = currentPos.z + data.velocity.z * deltaSeconds
      
      // Mettre à jour la position
      arrow.setAttribute('position', `${newX} ${newY} ${newZ}`)
      
      // Vérifier collision avec la nouvelle position
      const newPos = new THREE.Vector3(newX, newY, newZ)
      this.checkArrowCollision(arrow, newPos)
    })
  },

  shootArrow: function () {
    console.log('🏹 shootArrow() CALLED - Bow is on:', this.el.id)
    this.addLog('🏹 shootArrow() appelé')
    
    try {
      // Jouer le son de tir
      try {
        const shootSound = document.getElementById('shoot-sound')
        if (shootSound) {
          shootSound.currentTime = 0
          shootSound.play().catch(e => console.log('Son de tir non disponible:', e))
          this.addLog('🔊 Son de tir joué')
        } else {
          this.addLog('❌ shoot-sound element not found')
        }
      } catch (e) {
        console.error('Shoot sound error:', e)
      }

      // Vérifier que l'arc existe
      if (!this.el.object3D) {
        this.addLog('❌ Bow object3D not found')
        console.error('Bow object3D not found')
        return
      }

      const handPos = this.el.object3D.getWorldPosition(new THREE.Vector3())
      const handRot = this.el.object3D.getWorldQuaternion(new THREE.Quaternion())
      
      if (!handPos || !handRot) {
        this.addLog('❌ Hand position/rotation undefined')
        return
      }
      
      console.log('🏹 Tir VR déclenché', { handPos, handRot })
      this.addLog(`📍 Position: ${handPos.x.toFixed(2)}, ${handPos.y.toFixed(2)}, ${handPos.z.toFixed(2)}`)
      
      // Calculer la direction de tir (vers l'avant de la main)
      const forward = new THREE.Vector3(0, -1, 0)  // Demi-tour: axe Y négatif
      forward.applyQuaternion(handRot)
      
      // CRÉER UNE FLÈCHE PHYSIQUE
      this.createFlyingArrow(handPos, forward, handRot)
      
      // Feedback haptique désactivé (non supporté de manière fiable)
      // Utiliser le son et les animations visuelles à la place
    } catch (e) {
      console.error('shootArrow error:', e)
      this.addLog(`❌ shootArrow exception: ${e.message}`)
    }
  },

  shootArrowMouse: function () {
    // Jouer le son de tir
    try {
      const shootSound = document.getElementById('shoot-sound')
      if (shootSound) {
        shootSound.currentTime = 0
        shootSound.play().catch(e => console.log('Son de tir non disponible:', e))
      }
    } catch (e) {
      console.error('Shoot sound error:', e)
    }

    const camera = this.el.sceneEl.camera
    const scene = this.el.sceneEl
    
    // Utiliser la position de la souris pour le raycast
    this.raycaster.setFromCamera(this.mouse, camera)
    
    // Détecter les cibles
    const allEntities = scene.querySelectorAll('[target-behavior]')
    const targets = Array.from(allEntities)
    
    if (targets.length === 0) {
      console.log('❌ Aucune cible détectée')
      return
    }
    
    // Intersections avec les cibles
    const intersects = this.raycaster.intersectObjects(
      targets.map(t => t.object3D),
      true
    )
    
    if (intersects.length > 0) {
      // Première cible touchée
      const hitObject = intersects[0].object
      let targetEntity = null
      
      // Trouver l'entité A-Frame correspondante en cherchant le parent
      for (let target of targets) {
        let current = hitObject
        while (current) {
          if (current === target.object3D) {
            targetEntity = target
            break
          }
          current = current.parent
        }
        if (targetEntity) break
      }
      
      // Fallback: chercher par proximité
      if (!targetEntity) {
        targetEntity = targets[0]
      }
      
      // Appeler le système de dommage de la cible
      if (targetEntity && targetEntity.components && targetEntity.components['target-behavior']) {
        const impactPoint = intersects[0].point
        targetEntity.components['target-behavior'].onArrowHit(null, impactPoint)
        console.log('💥 Cible touchée (souris)!')
      }
    } else {
      console.log('❌ Pas de cible en ligne de mire')
    }
  },

  createFlyingArrow: function(startPos, direction, rotation) {
    const scene = this.el.sceneEl
    
    // Créer l'entité flèche
    const arrow = document.createElement('a-entity')
    arrow.setAttribute('gltf-model', '#arrow-model')
    arrow.setAttribute('scale', '0.5 0.5 0.5')
    arrow.setAttribute('position', `${startPos.x} ${startPos.y} ${startPos.z}`)
    
    // Orienter la flèche dans la direction du tir
    const euler = new THREE.Euler()
    euler.setFromQuaternion(rotation)
    arrow.setAttribute('rotation', `${THREE.MathUtils.radToDeg(euler.x) + 180} ${THREE.MathUtils.radToDeg(euler.y)} ${THREE.MathUtils.radToDeg(euler.z)}`)
    
    // Ajouter à la scène
    scene.appendChild(arrow)
    
    // Stocker les données de vol sur l'élément
    arrow.arrowData = {
      velocity: direction.clone().multiplyScalar(this.data.arrowSpeed),
      startTime: Date.now(),
      maxTime: 5000 // 5 secondes
    }
    
    this.addLog('🏹 Flèche lancée!')
  },
  
  checkArrowCollision: function(arrow, arrowPos) {
    const scene = this.el.sceneEl
    const targets = Array.from(scene.querySelectorAll('[target-behavior]'))
    
    for (let target of targets) {
      const targetPos = target.object3D.position
      const distance = arrowPos.distanceTo(targetPos)
      
      // Distance de collision
      if (distance < 0.5) {
        // Touché !
        if (target.components && target.components['target-behavior']) {
          target.components['target-behavior'].onArrowHit(null, arrowPos)
          this.addLog('✓ Flèche a touché la cible!')
        }
        
        // Supprimer la flèche
        if (arrow.parentNode) {
          arrow.parentNode.removeChild(arrow)
        }
        break
      }
    }
  },

  remove: function () {
    // Cleanup si nécessaire
    document.removeEventListener('click', this.shootArrowMouse)
  }
})
