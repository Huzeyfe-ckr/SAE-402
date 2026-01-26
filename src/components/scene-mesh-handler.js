/**
 * Composant scene-mesh-handler pour WebXR
 * Gère le Scene Mesh (surfaces réelles détectées par le casque)
 * et les transforme en corps physiques statiques
 */

AFRAME.registerComponent('scene-mesh-handler', {
  init: function () {
    this.sceneMeshes = []
    this.isWebXRSupported = false
    
    // Vérifier le support WebXR
    if ('xr' in navigator) {
      this.checkWebXRSupport()
    } else {
      console.log('⚠️ WebXR non disponible sur ce navigateur')
    }
  },

  async checkWebXRSupport() {
    try {
      // Vérifier support AR et VR
      const isARSupported = await navigator.xr?.isSessionSupported('immersive-ar')
      const isVRSupported = await navigator.xr?.isSessionSupported('immersive-vr')
      
      this.isWebXRSupported = isARSupported || isVRSupported
      
      if (this.isWebXRSupported) {
        console.log(`✅ WebXR supporté - AR: ${isARSupported}, VR: ${isVRSupported}`)
        console.log('🌍 Scene Mesh / Anchors disponibles')
        this.setupSceneMeshTracking()
      } else {
        console.log('⚠️ WebXR non supporté sur cet appareil')
      }
    } catch (error) {
      console.log('⚠️ Erreur de vérification WebXR:', error)
    }
  },

  setupSceneMeshTracking: function () {
    const sceneEl = this.el.sceneEl
    
    // Écouter les événements de session XR
    sceneEl.addEventListener('enter-vr', () => {
      console.log('🥽 Entrée en mode VR - Activation du Scene Mesh')
      this.startSceneMeshDetection()
    })
    
    sceneEl.addEventListener('exit-vr', () => {
      console.log('👋 Sortie du mode VR - Désactivation du Scene Mesh')
      this.stopSceneMeshDetection()
    })
  },

  startSceneMeshDetection: function () {
    const renderer = this.el.sceneEl.renderer
    const xrSession = renderer.xr.getSession()
    
    if (!xrSession) {
      console.warn('⚠️ Session XR non disponible')
      return
    }

    console.log('🌍 Initialisation du Scene Mesh tracking...')
    
    // Vérifier support des anchors (A-Frame 1.6+)
    if (xrSession.requestHitTestSource) {
      this.trackSceneMeshes()
    }
    
    // Support pour WebXR Anchors API (A-Frame 1.7+)
    if ('createAnchor' in xrSession) {
      console.log('⚓ WebXR Anchors API disponible')
      this.setupAnchorSupport()
    }
  },

  setupAnchorSupport: function () {
    // Support moderne pour les anchors persistants
    this.el.sceneEl.addEventListener('enter-vr', () => {
      const xrSession = this.el.sceneEl.renderer.xr.getSession()
      if (xrSession && xrSession.persistentAnchors) {
        console.log('⚓ Anchors persistants supportés')
      }
    })
  },

  trackSceneMeshes: function () {
    // Placeholder pour la détection de surfaces
    // Dans une vraie implémentation, on utiliserait l'API Scene Understanding
    console.log('🔍 Détection des surfaces en cours...')
    
    // Simuler la création de surfaces détectées (pour le développement)
    this.createMockSceneMesh()
  },

  createMockSceneMesh: function () {
    // Créer des surfaces de test qui représenteraient les murs/sols détectés
    const mockSurfaces = [
      { position: '2 1.5 -3', rotation: '0 90 0', width: 2, height: 2, label: 'Mur droit' },
      { position: '-2 1.5 -3', rotation: '0 -90 0', width: 2, height: 2, label: 'Mur gauche' },
      { position: '0 0 -5', rotation: '-90 0 0', width: 4, height: 4, label: 'Sol virtuel' }
    ]

    mockSurfaces.forEach((surface, index) => {
      const meshEntity = document.createElement('a-plane')
      meshEntity.setAttribute('position', surface.position)
      meshEntity.setAttribute('rotation', surface.rotation)
      meshEntity.setAttribute('width', surface.width)
      meshEntity.setAttribute('height', surface.height)
      meshEntity.setAttribute('material', {
        color: '#4CC3D9',
        opacity: 0.3,
        transparent: true,
        wireframe: true
      })
      meshEntity.setAttribute('static-body', {
        shape: 'box'
      })
      meshEntity.setAttribute('class', 'scene-mesh')
      meshEntity.id = `scene-mesh-${index}`
      
      this.el.sceneEl.appendChild(meshEntity)
      this.sceneMeshes.push(meshEntity)
      
      console.log(`✅ Surface détectée ajoutée: ${surface.label}`)
    })
  },

  stopSceneMeshDetection: function () {
    // Nettoyer les meshes créés
    this.sceneMeshes.forEach(mesh => {
      if (mesh.parentNode) {
        mesh.parentNode.removeChild(mesh)
      }
    })
    this.sceneMeshes = []
    console.log('🧹 Scene Meshes nettoyés')
  },

  /**
   * Convertit un mesh WebXR en entité A-Frame avec corps physique
   */
  createPhysicalSurface: function (meshData) {
    const entity = document.createElement('a-entity')
    
    // Créer une géométrie basée sur le mesh détecté
    entity.setAttribute('geometry', {
      primitive: 'plane',
      width: meshData.width || 1,
      height: meshData.height || 1
    })
    
    // Matériau semi-transparent pour la visualisation
    entity.setAttribute('material', {
      color: '#4CC3D9',
      opacity: 0.2,
      transparent: true,
      side: 'double'
    })
    
    // Ajouter le corps physique statique
    entity.setAttribute('static-body', {
      shape: 'box'
    })
    
    // Positionner selon les données du mesh
    if (meshData.position) {
      entity.setAttribute('position', meshData.position)
    }
    if (meshData.rotation) {
      entity.setAttribute('rotation', meshData.rotation)
    }
    
    entity.classList.add('scene-mesh', 'physical-surface')
    
    return entity
  },

  remove: function () {
    this.stopSceneMeshDetection()
  }
})
