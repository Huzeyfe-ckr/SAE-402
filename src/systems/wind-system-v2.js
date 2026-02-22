/**
 * Système de vent pour Archery XR v2
 * Génère une force de vent aléatoire qui affecte les trajectoires des flèches
 * Affiche des indicateurs visuels et des flèches directionnelles
 */

AFRAME.registerSystem("wind", {
  schema: {
    enabled: { type: "boolean", default: true },
    baseForce: { type: "number", default: 0.02 }, // Force de base du vent - RÉDUIT
    forceVariation: { type: "number", default: 0.03 }, // Variation aléatoire - RÉDUIT
    changeInterval: { type: "number", default: 5000 }, // Changement de direction pendant le vent (ms)
    visualEnabled: { type: "boolean", default: true },
    windDuration: { type: "number", default: 15000 }, // Durée du vent actif (15s)
    calmDuration: { type: "number", default: 10000 }, // Durée du calme (10s)
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
        
        // Augmenter le son du vent
        const windSound = document.getElementById("wind-sound");
        if (windSound) {
          windSound.volume = 0.5;
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
    
    // Container principal - positionné en haut à gauche du champ de vue
    this.windVisuals = document.createElement("a-entity");
    this.windVisuals.id = "wind-visuals";
    this.windVisuals.setAttribute("position", "-0.4 0.3 -0.8"); // Attaché à la caméra: gauche, haut, devant
    camera.appendChild(this.windVisuals); // ATTACHÉ À LA CAMÉRA !
    
    console.log("📦 Container du vent attaché à la caméra (-0.4, 0.3, -0.8)");
    
    // Texte indicateur - TAILLE AGRANDIE
    const windText = document.createElement("a-text");
    windText.id = "wind-text";
    windText.setAttribute("value", "VENT: 0.0 m/s");
    windText.setAttribute("position", "0 0.25 0");
    windText.setAttribute("color", "#00FFFF");
    windText.setAttribute("align", "center");
    windText.setAttribute("width", "1.5");
    windText.setAttribute("font", "mozillavr");
    windText.setAttribute("scale", "0.6 0.6 0.6");
    this.windVisuals.appendChild(windText);
    
    // Conteneur flèches - TAILLE AGRANDIE
    const arrowsContainer = document.createElement("a-entity");
    arrowsContainer.id = "wind-arrows";
    arrowsContainer.setAttribute("scale", "0.6 0.6 0.6"); // Taille visible
    this.windVisuals.appendChild(arrowsContainer);
    
    // 8 flèches directionnelles
    const directions = [
      { pos: "0 0 -0.45", rot: "0 0 0" },
      { pos: "0.318 0 -0.318", rot: "0 -45 0" },
      { pos: "0.45 0 0", rot: "0 -90 0" },
      { pos: "0.318 0 0.318", rot: "0 -135 0" },
      { pos: "0 0 0.45", rot: "0 180 0" },
      { pos: "-0.318 0 0.318", rot: "0 135 0" },
      { pos: "-0.45 0 0", rot: "0 90 0" },
      { pos: "-0.318 0 -0.318", rot: "0 45 0" },
    ];
    
    this.windArrows = [];
    directions.forEach((dir, index) => {
      const arrow = this.createWindArrow(dir.pos, dir.rot, index);
      arrowsContainer.appendChild(arrow);
      this.windArrows.push({ element: arrow, index });
    });
    
    // Particules visuelles - TAILLE AGRANDIE
    const particlesContainer = document.createElement("a-entity");
    particlesContainer.id = "wind-particles";
    particlesContainer.setAttribute("scale", "0.6 0.6 0.6");
    this.windVisuals.appendChild(particlesContainer);
    
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement("a-sphere");
      particle.setAttribute("radius", "0.03");
      particle.setAttribute("color", "#00FFFF");
      particle.setAttribute("material", "shader: flat; opacity: 0.8");
      particle.setAttribute("position", `${(Math.random() - 0.5) * 0.4} ${Math.random() * 0.3} ${(Math.random() - 0.5) * 0.4}`);
      particlesContainer.appendChild(particle);
    }
    
    // Démarrer son du vent - déclenché par interaction utilisateur via l'événement start-game
    this.startWindSound();
    
    // Écouter aussi le démarrage du jeu pour relancer le son
    this.el.sceneEl.addEventListener("start-game", () => {
      this.startWindSound();
    });
    
    this.visualsCreated = true;
    console.log("✨ Visuels du vent créés et visibles!");
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

  createWindArrow: function (position, rotation, index) {
    const arrow = document.createElement("a-entity");
    arrow.setAttribute("position", position);
    arrow.setAttribute("rotation", rotation);
    
    const stem = document.createElement("a-cylinder");
    stem.setAttribute("radius", "0.012");
    stem.setAttribute("height", "0.20");
    stem.setAttribute("color", "#00BFFF");
    stem.setAttribute("material", "shader: flat; opacity: 0.8");
    stem.setAttribute("position", "0 0.1 0");
    arrow.appendChild(stem);
    
    const tip = document.createElement("a-cone");
    tip.setAttribute("radius-bottom", "0.025");
    tip.setAttribute("height", "0.12");
    tip.setAttribute("color", "#00BFFF");
    tip.setAttribute("material", "shader: flat; opacity: 1");
    tip.setAttribute("position", "0 0.24 0");
    arrow.appendChild(tip);
    
    arrow.id = `wind-arrow-${index}`;
    return arrow;
  },

  updateWindVisuals: function () {
    if (!this.windVisuals) return;
    
    const windText = this.windVisuals.querySelector("#wind-text");
    
    // Période de calme - afficher "CALME"
    if (!this.windActive || this.windIntensity < 0.001) {
      if (windText) {
        windText.setAttribute("value", "🍃 CALME");
        windText.setAttribute("color", "#88FF88"); // Vert clair
      }
      
      // Masquer toutes les flèches (faible opacité)
      if (this.windArrows) {
        this.windArrows.forEach((arrow) => {
          arrow.element.setAttribute("scale", "0.5 0.5 0.5");
          const stem = arrow.element.querySelector("a-cylinder");
          const tip = arrow.element.querySelector("a-cone");
          if (stem) stem.setAttribute("material", { opacity: 0.15, color: "#888888", shader: "flat" });
          if (tip) tip.setAttribute("material", { opacity: 0.15, color: "#888888", shader: "flat" });
        });
      }
      return;
    }
    
    // Période de vent - afficher l'intensité
    if (windText) {
      const displayIntensity = Math.min(this.windIntensity * 1000, 100).toFixed(0);
      windText.setAttribute("value", `🌬️ VENT: ${displayIntensity}%`);
      
      // Couleurs basées sur l'intensité
      let color = "#00FFFF"; // Cyan - faible
      if (this.windIntensity > 0.08) color = "#FF4444"; // Rouge - très fort
      else if (this.windIntensity > 0.05) color = "#FFA500"; // Orange - fort
      else if (this.windIntensity > 0.03) color = "#FFFF00"; // Jaune - modéré
      
      windText.setAttribute("color", color);
    }
    
    // Mettre à jour les flèches directionnelles
    if (this.windArrows && this.windArrows.length > 0) {
      const windDir = this.windForce.clone().normalize();
      windDir.y = 0; // Ignorer la composante verticale
      
      if (windDir.length() < 0.01) return;
      windDir.normalize();
      
      // Directions des 8 flèches
      const standardDirs = [
        new THREE.Vector3(0, 0, -1),         // 0: Avant
        new THREE.Vector3(0.707, 0, -0.707), // 1: Avant-Droit
        new THREE.Vector3(1, 0, 0),          // 2: Droit
        new THREE.Vector3(0.707, 0, 0.707),  // 3: Arrière-Droit
        new THREE.Vector3(0, 0, 1),          // 4: Arrière
        new THREE.Vector3(-0.707, 0, 0.707), // 5: Arrière-Gauche
        new THREE.Vector3(-1, 0, 0),         // 6: Gauche
        new THREE.Vector3(-0.707, 0, -0.707),// 7: Avant-Gauche
      ];
      
      // Trouver la meilleure direction
      let bestIndex = 0;
      let bestDot = -Infinity;
      standardDirs.forEach((dir, idx) => {
        const dot = windDir.dot(dir);
        if (dot > bestDot) {
          bestDot = dot;
          bestIndex = idx;
        }
      });
      
      // Mettre à jour l'apparence de chaque flèche
      this.windArrows.forEach((arrow, idx) => {
        const isActive = (idx === bestIndex);
        const scale = isActive ? 1.4 : 0.8;
        const color = isActive ? "#00FF00" : "#00BFFF"; // Vert vif pour la direction active
        const opacity = isActive ? 1.0 : 0.3;
        
        arrow.element.setAttribute("scale", `${scale} ${scale} ${scale}`);
        
        const stem = arrow.element.querySelector("a-cylinder");
        const tip = arrow.element.querySelector("a-cone");
        
        if (stem) {
          stem.setAttribute("color", color);
          stem.setAttribute("material", { opacity: opacity, shader: "flat" });
        }
        if (tip) {
          tip.setAttribute("color", color);
          tip.setAttribute("material", { opacity: opacity, shader: "flat" });
        }
      });
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
