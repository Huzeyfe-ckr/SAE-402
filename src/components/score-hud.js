/**
 * Composant score-hud pour A-Frame
 * Affiche le score et le timer en temps réel dans l'environnement VR
 * Attaché à la caméra pour suivre le regard du joueur
 * Style médiéval
 */

AFRAME.registerComponent("score-hud", {
  schema: {
    position: { type: "vec3", default: { x: 0, y: 0.35, z: -1.2 } },
  },

  init: function () {
    this.score = 0;
    this.timeRemaining = 10;

    // Couleurs médiévales
    this.COLORS = {
      darkWood: "#2d1b0e",
      gold: "#d4af37",
      parchment: "#f4e4bc",
      white: "#ffffff",
      red: "#e74c3c",
    };

    // Écouter les événements
    this.onScoreUpdateBound = this.onScoreUpdate.bind(this);
    this.el.sceneEl.addEventListener("target-hit", this.onScoreUpdateBound);

    // Écouter le démarrage du jeu pour créer le HUD
    this.el.sceneEl.addEventListener("start-game", () => {
      this.createHUD();
      this.showHUD();
    });

    // Cacher le HUD quand le jeu se termine (retour au menu)
    this.el.sceneEl.addEventListener("game-ended", () => {
      this.hideHUD();
    });

  },

  showHUD: function () {
    if (this.hudContainer) {
      this.hudContainer.setAttribute("visible", true);
    }
  },

  hideHUD: function () {
    if (this.hudContainer) {
      this.hudContainer.setAttribute("visible", false);
    }
  },

  createHUD: function () {
    // Supprimer l'ancien HUD s'il existe
    if (this.hudContainer) {
      this.hudContainer.parentNode.removeChild(this.hudContainer);
    }

    // Conteneur principal
    this.hudContainer = document.createElement("a-entity");
    this.hudContainer.setAttribute("position", this.data.position);
    this.hudContainer.setAttribute("hud-element", "");
    this.el.appendChild(this.hudContainer);

    // Panneau de fond (bois)
    const bgOuter = document.createElement("a-entity");
    bgOuter.setAttribute("geometry", {
      primitive: "plane",
      width: 0.6,
      height: 0.35,
    });
    bgOuter.setAttribute("material", {
      color: this.COLORS.gold,
      shader: "flat",
      opacity: 1,
    });
    bgOuter.setAttribute("position", "0 0 -0.002");
    this.hudContainer.appendChild(bgOuter);

    const bgInner = document.createElement("a-entity");
    bgInner.setAttribute("geometry", {
      primitive: "plane",
      width: 0.56,
      height: 0.31,
    });
    bgInner.setAttribute("material", {
      color: this.COLORS.darkWood,
      shader: "flat",
      opacity: 0.95,
    });
    bgInner.setAttribute("position", "0 0 -0.001");
    this.hudContainer.appendChild(bgInner);

    // Timer (gros au centre)
    this.timerText = document.createElement("a-text");
    this.timerText.setAttribute("value", "10");
    this.timerText.setAttribute("align", "center");
    this.timerText.setAttribute("color", this.COLORS.white);
    this.timerText.setAttribute("width", "3");
    this.timerText.setAttribute("position", "0 0.06 0.01");
    this.hudContainer.appendChild(this.timerText);

    // Label timer
    const timerLabel = document.createElement("a-text");
    timerLabel.setAttribute("value", "seconds");
    timerLabel.setAttribute("align", "center");
    timerLabel.setAttribute("color", this.COLORS.gold);
    timerLabel.setAttribute("width", "0.8");
    timerLabel.setAttribute("position", "0 -0.02 0.01");
    this.hudContainer.appendChild(timerLabel);

    // Séparateur
    const separator = document.createElement("a-entity");
    separator.setAttribute("geometry", {
      primitive: "plane",
      width: 0.45,
      height: 0.005,
    });
    separator.setAttribute("material", {
      color: this.COLORS.gold,
      shader: "flat",
    });
    separator.setAttribute("position", "0 -0.06 0.01");
    this.hudContainer.appendChild(separator);

    // Score
    this.scoreText = document.createElement("a-text");
    this.scoreText.setAttribute("value", "Loot: 0");
    this.scoreText.setAttribute("align", "center");
    this.scoreText.setAttribute("color", this.COLORS.parchment);
    this.scoreText.setAttribute("width", "1.2");
    this.scoreText.setAttribute("position", "0 -0.1 0.01");
    this.hudContainer.appendChild(this.scoreText);

  },

  onScoreUpdate: function (evt) {
    const gameManager = this.el.sceneEl.systems["game-manager"];
    if (!gameManager) return;

    setTimeout(() => {
      const oldScore = this.score
      this.score = gameManager.totalScore;
      const pointsGained = this.score - oldScore
      
      if (this.scoreText) {
        this.scoreText.setAttribute("value", `Loot: ${this.score}`);
      }
      
      // Animation différente selon les points gagnés
      this.flashScore(pointsGained);
      
      // Créer un feedback flottant pour les gros gains
      if (pointsGained >= 50) {
        this.showScorePopup(pointsGained)
      }
    }, 10);
  },

  flashScore: function (pointsGained) {
    if (!this.scoreText) return;

    // Déterminer l'intensité de l'animation selon les points
    let scale = 1.3
    let color = '#00ff00'
    let duration = 150
    
    if (pointsGained >= 100) {
      scale = 1.8
      color = '#FFD700'
      duration = 250
    } else if (pointsGained >= 50) {
      scale = 1.5
      color = '#FFA500'
      duration = 200
    }

    // Animation de scale avec bounce
    this.scoreText.setAttribute("animation__flash", {
      property: "scale",
      from: "1 1 1",
      to: `${scale} ${scale} 1`,
      dur: duration,
      easing: "easeOutBack",
    });
    
    // Animation de retour
    setTimeout(() => {
      if (this.scoreText) {
        this.scoreText.setAttribute("animation__return", {
          property: "scale",
          to: "1 1 1",
          dur: duration,
          easing: "easeInOutQuad",
        });
      }
    }, duration)

    // Changer la couleur temporairement
    this.scoreText.setAttribute("color", color);

    setTimeout(() => {
      if (this.scoreText) {
        this.scoreText.setAttribute("color", this.COLORS.parchment);
      }
    }, duration * 2);
  },
  
  showScorePopup: function (points) {
    if (!this.hudContainer) return
    
    // Créer un popup de score qui flotte au-dessus du HUD
    const popup = document.createElement('a-text')
    popup.setAttribute('value', `+${points}`)
    popup.setAttribute('align', 'center')
    popup.setAttribute('width', 1.5)
    popup.setAttribute('font', 'mozillavr')
    popup.setAttribute('position', '0 0.2 0.02')
    
    // Couleur selon les points
    let color = '#00ff00'
    if (points >= 200) {
      color = '#FFD700'
    } else if (points >= 100) {
      color = '#FFA500'
    }
    popup.setAttribute('color', color)
    
    // Animation d'apparition
    popup.setAttribute('scale', '0 0 0')
    popup.setAttribute('animation__appear', {
      property: 'scale',
      to: '1.2 1.2 1.2',
      dur: 200,
      easing: 'easeOutBack'
    })
    
    // Animation de montée
    popup.setAttribute('animation__rise', {
      property: 'position',
      to: '0 0.6 0.02',
      dur: 1200,
      easing: 'easeOutCubic'
    })
    
    // Animation de disparition
    popup.setAttribute('animation__fade', {
      property: 'opacity',
      from: 1,
      to: 0,
      dur: 600,
      delay: 600,
      easing: 'easeInQuad'
    })
    
    this.hudContainer.appendChild(popup)
    
    // Supprimer après l'animation
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup)
      }
    }, 1500)
  },

  tick: function (time, deltaTime) {
    // Mettre à jour le timer depuis le game manager
    const gameManager = this.el.sceneEl.systems["game-manager"];
    if (gameManager && gameManager.gameRunning && this.timerText) {
      const newTime = gameManager.gameTime;
      if (newTime !== this.timeRemaining) {
        this.timeRemaining = newTime;
        this.timerText.setAttribute("value", this.timeRemaining.toString());

        // Rouge et pulsant si <= 3 secondes
        if (this.timeRemaining <= 3) {
          this.timerText.setAttribute("color", this.COLORS.red);
          this.timerText.setAttribute("animation", {
            property: "scale",
            from: "1 1 1",
            to: "1.2 1.2 1",
            dur: 300,
            dir: "alternate",
            loop: true,
          });
        }
      }
    }
  },

  remove: function () {
    if (this.onScoreUpdateBound) {
      this.el.sceneEl.removeEventListener(
        "target-hit",
        this.onScoreUpdateBound,
      );
    }
    if (this.hudContainer && this.hudContainer.parentNode) {
      this.hudContainer.parentNode.removeChild(this.hudContainer);
    }
  },
});
