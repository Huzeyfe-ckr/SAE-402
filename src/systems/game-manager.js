/**
 * Système game-manager pour A-Frame
 * Gère le cycle de jeu, le spawn des cibles et le score global
 * Utilise aframe-state-component pour la réactivité
 */

AFRAME.registerSystem('game-manager', {
  schema: {
    spawnInterval: { type: 'number', default: 1500 }, // 1.5 secondes
    maxTargets: { type: 'number', default: 5 },
    difficulty: { type: 'string', default: 'normal' } // easy, normal, hard
  },

  init: function () {
    this.activeTargets = []
    this.totalScore = 0
    this.totalArrowsShot = 0
    this.totalHits = 0
    this.spawnTimer = null
    this.gameRunning = false
    
    // Écouter les événements du jeu
    this.el.addEventListener('target-hit', this.onTargetHit.bind(this))
    this.el.addEventListener('target-destroyed', this.onTargetDestroyed.bind(this))
    this.el.addEventListener('arrow-shot', this.onArrowShot.bind(this))
    // Démarrer le jeu après un délai
    setTimeout(() => {
      this.startGame()
    }, 2000)
    
    console.log('🎮 Game Manager initialisé')
  },

  startGame: function () {
    if (this.gameRunning) return
    
    this.gameRunning = true
    this.el.setAttribute('state', 'gameStarted', true)
    
    // Lancer le son de fond
    const bgSound = document.getElementById('background-sound')
    if (bgSound) {
      bgSound.play().catch(e => console.log('Son de fond non disponible:', e))
    }
    
    console.log('🎮 Jeu démarré!')
    
    // Commencer le spawn automatique de cibles
    this.startTargetSpawning()
    
    // Créer l'affichage du score
    this.createScoreDisplay()
  },

  startTargetSpawning: function () {
    this.spawnTimer = setInterval(() => {
      if (this.activeTargets.length < this.data.maxTargets) {
        this.spawnRandomTarget()
      }
    }, this.data.spawnInterval)
  },

  spawnRandomTarget: function () {
    const target = document.createElement('a-entity')
    const targetId = `target-${Date.now()}`
    
    // Position aléatoire avec distance variable
    const x = (Math.random() - 0.5) * 8
    const y = 1 + Math.random() * 2.5
    const z = -4 - Math.random() * 5  // Distance plus variable (4 à 9)
    
    // Taille aléatoire de la cible
    const scale = 0.5 + Math.random() * 1.0  // Entre 0.5 et 1.5
    
    // Paramètres basés sur la difficulté
    let points = 10
    let hp = 1
    let movable = false  // Toujours statique
    
    if (this.data.difficulty === 'hard') {
      points = 20
      hp = Math.floor(Math.random() * 3) + 1
    } else if (this.data.difficulty === 'normal') {
      points = 15
      hp = Math.random() > 0.7 ? 2 : 1
    }
    
    target.id = targetId
    target.setAttribute('position', `${x} ${y} ${z}`)
    target.setAttribute('target-behavior', {
      points: points,
      hp: hp,
      movable: false  // Toujours statique
    })
    
    // Créer la géométrie de la cible avec taille variable
    target.innerHTML = `
      <a-entity gltf-model="#target-model" scale="${scale} ${scale} ${scale}" animation-mixer="clip: NONE"></a-entity>
    `
    
    this.el.appendChild(target)
    this.activeTargets.push(target)
    
    console.log(`🎯 Nouvelle cible spawned: ${targetId} (${points}pts, ${hp}HP, statique)`)
  },

  onTargetHit: function (evt) {
    const { points, zone, multiplier } = evt.detail
    
    this.totalHits++
    
    // Mettre à jour le score via le state
    const state = this.el.getAttribute('state') || {}
    const currentScore = state.score || 0
    const newScore = currentScore + points
    this.el.setAttribute('state', 'score', newScore)
    this.totalScore = newScore
    
    console.log(`📊 Score mis à jour: ${newScore} (+${points} en ${zone})`)
    
    // Mettre à jour l'affichage
    this.updateScoreDisplay()
  },

  onTargetDestroyed: function (evt) {
    const { bonusPoints } = evt.detail
    
    // Retirer la cible de la liste active
    this.activeTargets = this.activeTargets.filter(t => t.parentNode)
    
    // Ajouter les points bonus
    if (bonusPoints > 0) {
      const state = this.el.getAttribute('state') || {}
      const currentScore = state.score || 0
      this.el.setAttribute('state', 'score', currentScore + bonusPoints)
      this.totalScore = currentScore + bonusPoints
      console.log(`🎁 Bonus de destruction: +${bonusPoints}`)
    }
    
    this.updateScoreDisplay()
  },

  onArrowShot: function (evt) {
    this.totalArrowsShot++
    console.log(`🏹 Flèches tirées: ${this.totalArrowsShot}`)
  },

  createScoreDisplay: function () {
    const hud = document.createElement('div')
    hud.id = 'game-hud'
    hud.className = 'hud-overlay'
    hud.innerHTML = `
      <div class="score">Score: <span id="score-value">0</span></div>
      <div>Combo: <span id="combo-value">x1</span></div>
      <div>Précision: <span id="accuracy-value">0%</span></div>
      <div>Cibles actives: <span id="targets-value">0</span></div>
    `
    document.body.appendChild(hud)
  },

  updateScoreDisplay: function () {
    const scoreEl = document.getElementById('score-value')
    const targetsEl = document.getElementById('targets-value')
    const accuracyEl = document.getElementById('accuracy-value')
    
    if (scoreEl) {
      scoreEl.textContent = this.totalScore
    }
    
    if (targetsEl) {
      targetsEl.textContent = this.activeTargets.length
    }
    
    if (accuracyEl && this.totalArrowsShot > 0) {
      const accuracy = Math.round((this.totalHits / this.totalArrowsShot) * 100)
      accuracyEl.textContent = `${accuracy}%`
    }
  },

  stopGame: function () {
    this.gameRunning = false
    if (this.spawnTimer) {
      clearInterval(this.spawnTimer)
      this.spawnTimer = null
    }
    console.log('🎮 Jeu arrêté')
  },

  tick: function (time, deltaTime) {
    // Mise à jour périodique si nécessaire
    if (this.gameRunning && time % 1000 < 16) {
      this.updateScoreDisplay()
    }
  }
})
