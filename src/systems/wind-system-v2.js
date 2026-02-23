/**
 * Système de vent pour Archery XR v2
 * Génère une force de vent aléatoire qui affecte les trajectoires des flèches
 * Affiche des indicateurs visuels et des flèches directionnelles
 */

AFRAME.registerSystem("wind", {
  schema: {
    enabled: { type: "boolean", default: true },
    baseForce: { type: "number", default: 0.002 }, // Force de base du vent - RÉDUIT
    forceVariation: { type: "number", default: 0.006 }, // Variation aléatoire - RÉDUIT
    changeInterval: { type: "number", default: 4000 }, // Changement de direction pendant le vent (ms)
    visualEnabled: { type: "boolean", default: true },
    windDuration: { type: "number", default: 8000 }, // Durée du vent actif (8s)
    calmDuration: { type: "number", default: 20000 }, // Durée du calme (20s)
  },

  init: function () {
    this.windForce = new THREE.Vector3(0, 0, 0);
    this.windForceSpeed = new THREE.Vector3(0, 0, 0);
    this.windDirection = new THREE.Euler(0, 0, 0);
    this.windIntensity = 0;
    this.windVisuals = null;
    this.visualsCreated = false;
    this.windActive = false; // Le vent commence désactivé
    this.windCycleTimeout = null;
    this.windChangeInterval = null;
    
    // Attendre que la scène soit chargée pour créer les visuels et démarrer le cycle
    const scene = this.el.sceneEl;
    if (scene && this.data.visualEnabled) {
      if (scene.hasLoaded) {
        setTimeout(() => {
          this.createWindVisuals();
          this.startWindCycle();
        }, 500);
      } else {
        scene.addEventListener('loaded', () => {
          setTimeout(() => {
            this.createWindVisuals();
            this.startWindCycle();
          }, 500);
        });
      }
    } else {
      this.startWindCycle();
    }
    
    console.log("🌪️ Wind System v2 initialisé (cycle intermittent)");
  },

  startWindCycle: function () {
    const runCycle = () => {
      if (this.windActive) {
        // Fin de la période de vent -> calme
        this.windActive = false;
        this.windForce.set(0, 0, 0);
        this.windForceSpeed.set(0, 0, 0);
        this.windIntensity = 0;
        
        // Arrêter les changements de direction
        if (this.windChangeInterval) {
          clearInterval(this.windChangeInterval);
          this.windChangeInterval = null;
        }
        
        // Réduire le son du vent
        const windSound = document.getElementById("wind-sound");
        if (windSound) windSound.volume = 0.05;
        
        console.log("🍃 Période de calme...");
        this.updateWindVisuals();
        
        // Programmer la prochaine période de vent
        this.windCycleTimeout = setTimeout(runCycle, this.data.calmDuration);
      } else {
        // Fin de la période de calme -> vent
        this.windActive = true;
        this.generateWind();
        
        // Changer la direction périodiquement pendant le vent
        this.windChangeInterval = setInterval(() => {
          if (this.windActive) this.generateWind();
        }, this.data.changeInterval);
        
        // Augmenter le son du vent - VOLUME FORT
        const windSound = document.getElementById("wind-sound");
        if (windSound) {
          windSound.volume = 0.8; // Volume élevé pour être clairement audible
          // Relancer le son si pas encore joué
          if (windSound.paused) {
            windSound.play().catch(() => {});
          }
        }
        
        console.log("🌬️ Le vent se lève!");
        
        // Programmer la prochaine période de calme
        this.windCycleTimeout = setTimeout(runCycle, this.data.windDuration);
      }
    };
    
    // Commencer par une période de calme
    console.log("🍃 Démarrage: période de calme initiale...");
    this.updateWindVisuals();
    this.windCycleTimeout = setTimeout(runCycle, this.data.calmDuration);
  },

  generateWind: function () {
    if (!this.data.enabled || !this.windActive) {
      this.windForce.set(0, 0, 0);
      this.windForceSpeed.set(0, 0, 0);
      this.windIntensity = 0;
      return;
    }
    
    const base = this.data.baseForce;
    const variation = this.data.forceVariation;
    
    const forceX = (Math.random() - 0.5) * 2 * (base + Math.random() * variation);
    const forceY = (Math.random() - 0.5) * (base * 0.3 + Math.random() * variation * 0.3);
    const forceZ = (Math.random() - 0.5) * 2 * (base + Math.random() * variation);
    
    this.windForce.set(forceX, forceY, forceZ);
    this.windForceSpeed.copy(this.windForce);
    this.windIntensity = this.windForce.length();
    
    if (this.windIntensity > 0.1) {
      const dir = this.windForce.clone().normalize();
      this.windDirection.setFromVector3(dir);
    }
    
    console.log(`💨 Nouveau vent: Intensité: ${this.windIntensity.toFixed(2)}m/s`);
    
    const scene = this.el.sceneEl;
    if (scene) {
      scene.emit("wind-changed", {
        force: this.windForce.clone(),
        intensity: this.windIntensity
      });
    }
    
    if (this.data.visualEnabled && this.visualsCreated) {
      this.updateWindVisuals();
    }
  },

  createWindVisuals: function () {
    if (this.visualsCreated) return;
    
    const scene = this.el.sceneEl;
    if (!scene || !scene.hasLoaded) {
      console.log("⏳ Attente du chargement pour visuels du vent...");
      setTimeout(() => this.createWindVisuals(), 500);
      return;
    }
    
    // IMPORTANT: Attacher les visuels à la caméra pour qu'ils soient toujours visibles
    const camera = scene.querySelector("a-camera") || scene.querySelector("[camera]");
    if (!camera) {
      console.log("⏳ Caméra non trouvée, retry...");
      setTimeout(() => this.createWindVisuals(), 500);
      return;
    }
    
    // Container principal - positionné en haut du champ de vue (plus centré)
    this.windVisuals = document.createElement("a-entity");
    this.windVisuals.id = "wind-visuals";
    this.windVisuals.setAttribute("position", "-0.1 0.2 -0.6"); // Décalé vers la droite et légèrement plus bas
    camera.appendChild(this.windVisuals);
    
    console.log("📦 Container du vent attaché à la caméra");
    
    // === NOUVEL INDICATEUR SIMPLE ===
    
    // Fond circulaire semi-transparent
    const background = document.createElement("a-circle");
    background.id = "wind-bg";
    background.setAttribute("radius", "0.1");
    background.setAttribute("color", "#000000");
    background.setAttribute("material", "shader: flat; opacity: 0.7; side: double");
    background.setAttribute("rotation", "0 0 0");
    this.windVisuals.appendChild(background);
    
    // Texte d'état - au dessus
    const windText = document.createElement("a-text");
    windText.id = "wind-text";
    windText.setAttribute("value", "CALME");
    windText.setAttribute("position", "0 0.15 0.01");
    windText.setAttribute("color", "#88FF88");
    windText.setAttribute("align", "center");
    windText.setAttribute("width", "1.2");
    windText.setAttribute("font", "mozillavr");
    this.windVisuals.appendChild(windText);
    
    // Flèche directionnelle UNIQUE - utiliser cone + cylinder
    this.windArrowContainer = document.createElement("a-entity");
    this.windArrowContainer.id = "wind-arrow-main";
    this.windArrowContainer.setAttribute("position", "0 0 0.02");
    this.windArrowContainer.setAttribute("visible", "false");
    this.windVisuals.appendChild(this.windArrowContainer);
    
    // Tige de la flèche (rectangle vertical)
    const arrowStem = document.createElement("a-plane");
    arrowStem.id = "wind-arrow-stem";
    arrowStem.setAttribute("width", "0.015");
    arrowStem.setAttribute("height", "0.08");
    arrowStem.setAttribute("position", "0 -0.01 0");
    arrowStem.setAttribute("color", "#00FF00");
    arrowStem.setAttribute("material", "shader: flat; opacity: 1; side: double");
    this.windArrowContainer.appendChild(arrowStem);
    
    // Pointe de la flèche (triangle via 3 planes ou cone aplati)
    const arrowHead = document.createElement("a-cone");
    arrowHead.id = "wind-arrow-head";
    arrowHead.setAttribute("radius-bottom", "0.035");
    arrowHead.setAttribute("radius-top", "0");
    arrowHead.setAttribute("height", "0.05");
    arrowHead.setAttribute("position", "0 0.05 0");
    arrowHead.setAttribute("rotation", "0 0 0");
    arrowHead.setAttribute("color", "#00FF00");
    arrowHead.setAttribute("material", "shader: flat; opacity: 1; side: double");
    this.windArrowContainer.appendChild(arrowHead);
    
    // Démarrer son du vent
    this.startWindSound();
    
    // Écouter le démarrage du jeu
    this.el.sceneEl.addEventListener("start-game", () => {
      this.startWindSound();
    });
    
    this.visualsCreated = true;
    console.log("✨ Nouvel indicateur de vent créé!");
  },

  startWindSound: function () {
    const windSound = document.getElementById("wind-sound");
    if (windSound && this.data.enabled) {
      // Volume bas par défaut (période de calme)
      windSound.volume = 0.05;
      windSound.loop = true;
      
      // Forcer la lecture
      const playPromise = windSound.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log("🔊 Son du vent démarré!");
        }).catch(e => {
          console.log("🔊 Son du vent: en attente d'interaction utilisateur...");
          // Réessayer après un clic
          document.addEventListener('click', () => {
            windSound.play().catch(() => {});
          }, { once: true });
        });
      }
    } else {
      console.log("⚠️ wind-sound non trouvé ou wind désactivé");
    }
  },

  // createWindArrow supprimé - utilisation d'une seule flèche

  updateWindVisuals: function () {
    if (!this.windVisuals) return;
    
    const windText = this.windVisuals.querySelector("#wind-text");
    const arrowContainer = this.windArrowContainer;
    const background = this.windVisuals.querySelector("#wind-bg");
    const arrowStem = this.windVisuals.querySelector("#wind-arrow-stem");
    const arrowHead = this.windVisuals.querySelector("#wind-arrow-head");
    
    // Période de calme - masquer la flèche
    if (!this.windActive || this.windIntensity < 0.001) {
      if (windText) {
        windText.setAttribute("value", "CALME");
        windText.setAttribute("color", "#88FF88");
      }
      if (background) {
        background.setAttribute("color", "#003300");
      }
      if (arrowContainer) {
        arrowContainer.setAttribute("visible", "false");
      }
      return;
    }
    
    // Période de vent - afficher et orienter la flèche
    if (windText) {
      const displayIntensity = Math.min(this.windIntensity * 2000, 100).toFixed(0);
      windText.setAttribute("value", `VENT ${displayIntensity}%`);
      
      // Couleur selon intensité
      let color = "#00FF00"; // Vert - faible
      if (this.windIntensity > 0.025) color = "#FF4444"; // Rouge - fort
      else if (this.windIntensity > 0.015) color = "#FFA500"; // Orange - moyen
      else if (this.windIntensity > 0.008) color = "#FFFF00"; // Jaune - modéré
      
      windText.setAttribute("color", color);
      
      // Mettre à jour la couleur de la flèche
      if (arrowStem) arrowStem.setAttribute("color", color);
      if (arrowHead) arrowHead.setAttribute("color", color);
    }
    
    if (background) {
      background.setAttribute("color", "#001133");
    }
    
    // Orienter la flèche dans la direction du vent
    if (arrowContainer) {
      arrowContainer.setAttribute("visible", "true");
      
      // Calculer l'angle de rotation (sur le plan XZ -> rotation Z pour l'affichage 2D)
      const windDir = this.windForce.clone();
      windDir.y = 0;
      
      if (windDir.length() > 0.001) {
        windDir.normalize();
        // Angle en radians: atan2(x, -z) pour avoir 0° vers l'avant
        const angleRad = Math.atan2(windDir.x, -windDir.z);
        const angleDeg = THREE.MathUtils.radToDeg(angleRad);
        
        // Appliquer la rotation (sur Z car la flèche pointe vers le haut par défaut)
        arrowContainer.setAttribute("rotation", `0 0 ${-angleDeg}`);
      }
    }
  },

  getWindForce: function () {
    return this.windForce.clone();
  },

  getWindIntensity: function () {
    return this.windIntensity;
  },

  getWindDirection: function () {
    if (this.windIntensity > 0.1) {
      return this.windForce.clone().normalize();
    }
    return new THREE.Vector3(0, 0, 0);
  },

  setEnabled: function (enabled) {
    this.data.enabled = enabled;
    if (!enabled) {
      this.windForce.set(0, 0, 0);
      this.windIntensity = 0;
    } else {
      this.generateWind();
    }
  },

  remove: function () {
    if (this.windChangeInterval) clearInterval(this.windChangeInterval);
    if (this.windCycleTimeout) clearTimeout(this.windCycleTimeout);
    if (this.windVisuals && this.windVisuals.parentNode) {
      this.windVisuals.parentNode.removeChild(this.windVisuals);
    }
    const windSound = document.getElementById("wind-sound");
    if (windSound) windSound.pause();
  }
});
