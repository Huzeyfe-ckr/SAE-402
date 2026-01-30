/**
 * Composant score-hud pour A-Frame
 * Affiche le score en temps réel dans l'environnement VR
 * Attaché à la caméra pour suivre le regard du joueur
 */

AFRAME.registerComponent('score-hud', {
  schema: {
    fontSize: { type: 'number', default: 0.15 },
    position: { type: 'vec3', default: { x: 0, y: 0.4, z: -1.5 } },
    color: { type: 'color', default: '#00FF00' },
    bgColor: { type: 'color', default: '#000000' },
    bgOpacity: { type: 'number', default: 0.7 }
  },

  init: function () {
    this.score = 0

    // Créer le conteneur du HUD
    this.createHUD()

    // Écouter les événements de changement de score
    this.onScoreUpdateBound = this.onScoreUpdate.bind(this)
    this.el.sceneEl.addEventListener('target-hit', this.onScoreUpdateBound)

    console.log('🎯 Score HUD VR créé')
  },

  createHUD: function () {
    // Panneau de fond
    const background = document.createElement('a-plane')
    background.setAttribute('width', '1.0')
    background.setAttribute('height', '0.25')
    background.setAttribute('color', this.data.bgColor)
    background.setAttribute('opacity', this.data.bgOpacity)
    background.setAttribute('position', this.data.position)
    this.el.appendChild(background)

    // Texte du score principal
    this.scoreText = document.createElement('a-text')
    this.scoreText.setAttribute('value', 'SCORE: 0')
    this.scoreText.setAttribute('align', 'center')
    this.scoreText.setAttribute('color', this.data.color)
    this.scoreText.setAttribute('width', '2.5')
    this.scoreText.setAttribute('font', 'roboto')
    this.scoreText.setAttribute('position', {
      x: this.data.position.x,
      y: this.data.position.y,
      z: this.data.position.z + 0.01
    })
    this.el.appendChild(this.scoreText)

    console.log('🎨 Éléments du HUD créés')
  },

  onScoreUpdate: function (evt) {
    console.log(`🎨 [HUD] Événement target-hit reçu!`, evt.detail)
    
    const { points } = evt.detail

    // Récupérer le score total depuis le game-manager
    const gameManager = this.el.sceneEl.systems['game-manager']
    if (!gameManager) {
      console.error('❌ [HUD] Game manager non trouvé!')
      return
    }
    
    // Solution : setTimeout pour laisser le game-manager finir son calcul (évite la race condition)
    setTimeout(() => {
      console.log(`🎨 [HUD] Game manager trouvé, score actuel: ${gameManager.totalScore}`)
      
      // Mettre à jour le score
      this.score = gameManager.totalScore
      this.scoreText.setAttribute('value', `SCORE: ${this.score}`)
      console.log(`🎨 [HUD] Texte mis à jour: SCORE: ${this.score}`)

      // Animation de flash
      this.flashScore()

      console.log(`✅ [HUD] HUD mis à jour: +${points} points | Score total: ${this.score}`)
    }, 10) // 10ms de délai pour éviter la race condition
  },

  flashScore: function () {
    // Animation simple : flash vert à chaque hit
    const flashColor = '#00FF00'

    // Appliquer l'animation de flash
    this.scoreText.setAttribute('animation', {
      property: 'scale',
      from: '1 1 1',
      to: '1.2 1.2 1',
      dur: 200,
      easing: 'easeOutQuad',
      loop: false
    })

    this.scoreText.setAttribute('color', flashColor)
    
    // Revenir à la couleur normale après 300ms
    setTimeout(() => {
      this.scoreText.setAttribute('color', this.data.color)
    }, 300)
  },

  tick: function (time, deltaTime) {
    // Optionnel: faire osciller légèrement le HUD pour un effet vivant
    if (time % 5000 < 16) { // Toutes les 5 secondes
      const breathe = Math.sin(time / 1000) * 0.02
      this.scoreText.object3D.scale.set(1 + breathe, 1 + breathe, 1)
    }
  },

  remove: function () {
    // Nettoyer les event listeners
    if (this.onScoreUpdateBound) {
      this.el.sceneEl.removeEventListener('target-hit', this.onScoreUpdateBound)
    }
  }
})