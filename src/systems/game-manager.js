/**
 * Système game-manager pour A-Frame
 * Gère le cycle de jeu, le spawn des cibles et le score global
 * Utilise aframe-state-component pour la réactivité
 */

AFRAME.registerSystem("game-manager", {
  schema: {
    spawnInterval: { type: "number", default: 1500 }, // 1.5 secondes
    maxTargets: { type: "number", default: 5 },
    difficulty: { type: "string", default: "normal" }, // easy, normal, hard
  },

  init: function () {
    this.activeTargets = [];
    this.totalScore = 0;
    this.totalArrowsShot = 0;
    this.totalHits = 0;
    this.spawnTimer = null;
    this.gameRunning = false;

    // Écouter les événements du jeu
    this.el.addEventListener("target-hit", this.onTargetHit.bind(this));
    this.el.addEventListener(
      "target-destroyed",
      this.onTargetDestroyed.bind(this),
    );
    this.el.addEventListener("arrow-shot", this.onArrowShot.bind(this));

    // Écouter l'événement de démarrage depuis le menu VR
    this.el.addEventListener("start-game", () => {
      this.startGame();
    });

    console.log("🎮 Game Manager initialisé");
  },

  startGame: function () {
    if (this.gameRunning) return;

    this.gameRunning = true;
    this.totalScore = 0;
    this.totalHits = 0;
    this.totalArrowsShot = 0;
    this.gameTime = 60; // 60 secondes de jeu
    this.el.setAttribute("state", "gameStarted", true);

    // Lancer le son de fond
    const bgSound = document.getElementById("background-sound");
    if (bgSound) {
      bgSound.volume = 0.3;
      bgSound
        .play()
        .catch((e) => console.log("Son de fond non disponible:", e));
    }

    console.log("🎮 Jeu démarré! Temps: 10s");

    // Commencer le spawn automatique de cibles
    this.startTargetSpawning();

    // Créer l'affichage du score
    this.createScoreDisplay();

    // Démarrer le compte à rebours
    this.startCountdown();
  },

  startCountdown: function () {
    this.countdownTimer = setInterval(() => {
      this.gameTime--;
      this.updateTimerDisplay();

      console.log(`⏱️ Temps restant: ${this.gameTime}s`);

      if (this.gameTime <= 0) {
        this.endGame();
      }
    }, 1000);
  },

  updateTimerDisplay: function () {
    const timerEl = document.getElementById("timer-value");
    if (timerEl) {
      timerEl.textContent = this.gameTime;
      // Animation pulsante si moins de 3 secondes
      if (this.gameTime <= 3) {
        timerEl.classList.add("warning");
      } else {
        timerEl.classList.remove("warning");
      }
    }
  },

  endGame: function () {
    console.log("🏁 Fin du jeu!");

    // Arrêter le jeu
    this.stopGame();

    // Arrêter le compte à rebours
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    // Arrêter la musique
    const bgSound = document.getElementById("background-sound");
    if (bgSound) {
      bgSound.pause();
    }

    // Émettre l'événement de fin de jeu pour cacher le HUD VR
    this.el.emit("game-ended");

    // Afficher le menu de fin
    this.showEndMenu();
  },

  showEndMenu: function () {
    // Créer l'entité du menu de fin
    const endMenu = document.createElement("a-entity");
    endMenu.setAttribute("end-menu", {
      score: this.totalScore,
      hits: this.totalHits,
      arrows: this.totalArrowsShot,
    });
    this.el.appendChild(endMenu);
  },

  startTargetSpawning: function () {
    this.spawnTimer = setInterval(() => {
      if (this.activeTargets.length < this.data.maxTargets) {
        this.spawnRandomTarget();
      }
    }, this.data.spawnInterval);
  },

  spawnRandomTarget: function () {
    const target = document.createElement("a-entity");
    const targetId = `target-${Date.now()}`;

    // Position aléatoire avec distance variable
    const x = (Math.random() - 0.5) * 8;
    const y = 1 + Math.random() * 2.5;
    const z = -4 - Math.random() * 5; // Distance plus variable (4 à 9)

    // Taille aléatoire de la cible
    const scale = 0.5 + Math.random() * 1.0; // Entre 0.5 et 1.5

    // Paramètres basés sur la difficulté
    let points = 10;
    let hp = 1;
    let movable = false; // Toujours statique

    if (this.data.difficulty === "hard") {
      points = 20;
      hp = Math.floor(Math.random() * 3) + 1;
    } else if (this.data.difficulty === "normal") {
      points = 15;
      hp = Math.random() > 0.7 ? 2 : 1;
    }

    target.id = targetId;
    target.setAttribute("position", `${x} ${y} ${z}`);

    // Ajouter le corps physique AVANT le comportement
    target.setAttribute("static-body", {
      shape: "cylinder",
      cylinderAxis: "z",
    });

    target.setAttribute("target-behavior", {
      points: points,
      hp: hp,
      movable: false, // Toujours statique
    });

    // Créer la géométrie de la cible avec taille variable
    target.innerHTML = `
      <a-entity gltf-model="#target-model" scale="${scale} ${scale} ${scale}"></a-entity>
    `;

    this.el.appendChild(target);
    this.activeTargets.push(target);

    console.log(
      `🎯 Nouvelle cible spawned: ${targetId} (${points}pts, ${hp}HP, statique)`,
    );
  },

  onTargetHit: function (evt) {
    console.log(`🎮 [GAME-MANAGER] Événement target-hit reçu!`, evt.detail);
    console.log(
      `🎮 [GAME-MANAGER] AVANT calcul - this.totalScore = ${this.totalScore}`,
    );

    const { points } = evt.detail;

    if (!points) {
      console.error("❌ [GAME-MANAGER] Points non définis dans evt.detail!");
      return;
    }

    this.totalHits++;

    // Calculer le nouveau score
    const currentScore = this.totalScore;
    const newScore = currentScore + points;

    console.log(
      `📊 [GAME-MANAGER] Calcul: ${currentScore} + ${points} = ${newScore}`,
    );

    // Mettre à jour le score
    this.totalScore = newScore;
    this.el.setAttribute("state", "score", newScore);

    console.log(
      `✅ [GAME-MANAGER] APRÈS update - this.totalScore = ${this.totalScore}`,
    );
    console.log(`✅ [GAME-MANAGER] Total hits: ${this.totalHits}`);

    // Mettre à jour l'affichage
    this.updateScoreDisplay();
  },

  onTargetDestroyed: function (evt) {
    const { bonusPoints } = evt.detail;

    // Retirer la cible de la liste active
    this.activeTargets = this.activeTargets.filter((t) => t.parentNode);

    // Ajouter les points bonus
    if (bonusPoints > 0) {
      const currentScore = this.totalScore; // CORRECTION : utiliser this.totalScore au lieu du state
      const newScore = currentScore + bonusPoints;

      this.totalScore = newScore;
      this.el.setAttribute("state", "score", newScore);

      console.log(
        `🎁 Bonus de destruction: +${bonusPoints} | Nouveau score: ${newScore}`,
      );
    }

    this.updateScoreDisplay();
  },

  onArrowShot: function (evt) {
    this.totalArrowsShot++;
    console.log(`🏹 Flèches tirées: ${this.totalArrowsShot}`);
  },

  createScoreDisplay: function () {
    const hud = document.createElement("div");
    hud.id = "game-hud";
    hud.innerHTML = `
      <style>
        #game-hud {
          position: fixed;
          top: 20px;
          left: 20px;
          background: linear-gradient(135deg, #2d1b0e 0%, #4a3728 100%);
          border: 3px solid #d4af37;
          border-radius: 8px;
          padding: 15px 25px;
          font-family: 'Georgia', serif;
          color: #f4e4bc;
          z-index: 1000;
          pointer-events: none;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3);
          min-width: 180px;
        }
        #game-hud .hud-title {
          text-align: center;
          font-size: 14px;
          color: #d4af37;
          border-bottom: 2px solid #d4af37;
          padding-bottom: 8px;
          margin-bottom: 12px;
          letter-spacing: 2px;
        }
        #game-hud .hud-timer {
          text-align: center;
          font-size: 42px;
          font-weight: bold;
          color: #fff;
          text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
          margin: 8px 0;
        }
        #game-hud .hud-timer-label {
          text-align: center;
          font-size: 12px;
          color: #d4af37;
          margin-bottom: 12px;
        }
        #game-hud .hud-timer.warning {
          color: #e74c3c;
          animation: pulse-warning 0.5s ease-in-out infinite;
        }
        @keyframes pulse-warning {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        #game-hud .hud-stat {
          display: flex;
          justify-content: space-between;
          margin: 6px 0;
          font-size: 16px;
        }
        #game-hud .hud-stat-label {
          color: #d4af37;
        }
        #game-hud .hud-stat-value {
          color: #fff;
          font-weight: bold;
        }
        #game-hud .hud-separator {
          height: 1px;
          background: linear-gradient(90deg, transparent, #d4af37, transparent);
          margin: 10px 0;
        }
      </style>
      <div class="hud-title">⚔️ CHASSE EN COURS ⚔️</div>
      <div class="hud-timer" id="timer-value">10</div>
      <div class="hud-timer-label">secondes restantes</div>
      <div class="hud-separator"></div>
      <div class="hud-stat">
        <span class="hud-stat-label">Butin :</span>
        <span class="hud-stat-value" id="score-value">0</span>
      </div>
      <div class="hud-stat">
        <span class="hud-stat-label">Cibles :</span>
        <span class="hud-stat-value" id="targets-value">0</span>
      </div>
    `;
    document.body.appendChild(hud);
  },

  updateScoreDisplay: function () {
    const scoreEl = document.getElementById("score-value");
    const targetsEl = document.getElementById("targets-value");

    if (scoreEl) {
      scoreEl.textContent = this.totalScore;
    }

    if (targetsEl) {
      targetsEl.textContent = this.activeTargets.length;
    }
  },

  stopGame: function () {
    this.gameRunning = false;
    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }
    console.log("🎮 Jeu arrêté");
  },

  tick: function (time, deltaTime) {
    // Mise à jour périodique si nécessaire
    if (this.gameRunning && time % 1000 < 16) {
      this.updateScoreDisplay();
    }
  },
});
