/**
 * Composant de vent pour Archery XR (converti depuis system)
 * Génère une force de vent aléatoire qui affecte les trajectoires des flèches
 * Affiche des indicateurs visuels et des flèches directionnelles
 */

AFRAME.registerComponent("wind", {
  schema: {
    enabled: { type: "boolean", default: true },
    baseForce: { type: "number", default: 0.002 },
    forceVariation: { type: "number", default: 0.006 },
    changeInterval: { type: "number", default: 4000 },
    visualEnabled: { type: "boolean", default: true },
    windDuration: { type: "number", default: 8000 },
    calmDuration: { type: "number", default: 20000 },
    rampDuration: { type: "number", default: 800 }
  },

  init: function () {
    this.windForce = new THREE.Vector3(0, 0, 0);
    this.windForceSpeed = new THREE.Vector3(0, 0, 0);
    this.windDirection = new THREE.Euler(0, 0, 0);
    this.windIntensity = 0;
    this.windVisuals = null;
    this.visualsCreated = false;
    this.windActive = false;
    this.windCycleTimeout = null;
    this.windChangeInterval = null;
    this._volumeRampRAF = null;

    const scene = this.el;
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

  },

  startWindCycle: function () {
    const runCycle = () => {
      if (this.windActive) {
        this.windActive = false;
        this.windForce.set(0, 0, 0);
        this.windForceSpeed.set(0, 0, 0);
        this.windIntensity = 0;
        if (this.windChangeInterval) {
          clearInterval(this.windChangeInterval);
          this.windChangeInterval = null;
        }
        const windSound = document.getElementById("wind-sound");
        if (windSound) this.rampWindVolume(windSound, 0.08, this.data.rampDuration);
        this.updateWindVisuals();
        this.windCycleTimeout = setTimeout(runCycle, this.data.calmDuration);
      } else {
        this.windActive = true;
        this.generateWind();
        this.windChangeInterval = setInterval(() => {
          if (this.windActive) this.generateWind();
        }, this.data.changeInterval);
        const windSound = document.getElementById("wind-sound");
        if (windSound) {
          this.rampWindVolume(windSound, 1.0, this.data.rampDuration);
          if (windSound.paused) {
            windSound.play().catch(() => {});
          }
        }
        this.windCycleTimeout = setTimeout(runCycle, this.data.windDuration);
      }
    };

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


    const scene = this.el;
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
    const scene = this.el;
    if (!scene || !scene.hasLoaded) {
      setTimeout(() => this.createWindVisuals(), 500);
      return;
    }

    const camera = scene.querySelector("a-camera") || scene.querySelector("[camera]");
    if (!camera) {
      setTimeout(() => this.createWindVisuals(), 500);
      return;
    }

    this.windVisuals = document.createElement("a-entity");
    this.windVisuals.id = "wind-visuals";
    this.windVisuals.setAttribute("position", "-0.1 0.2 -0.6");
    camera.appendChild(this.windVisuals);

    const background = document.createElement("a-circle");
    background.id = "wind-bg";
    background.setAttribute("radius", "0.1");
    background.setAttribute("color", "#000000");
    background.setAttribute("material", "shader: flat; opacity: 0.7; side: double");
    background.setAttribute("rotation", "0 0 0");
    this.windVisuals.appendChild(background);

    const windText = document.createElement("a-text");
    windText.id = "wind-text";
    windText.setAttribute("value", "CALME");
    windText.setAttribute("position", "0 0.15 0.01");
    windText.setAttribute("color", "#88FF88");
    windText.setAttribute("align", "center");
    windText.setAttribute("width", "1.2");
    windText.setAttribute("font", "mozillavr");
    this.windVisuals.appendChild(windText);

    this.windArrowContainer = document.createElement("a-entity");
    this.windArrowContainer.id = "wind-arrow-main";
    this.windArrowContainer.setAttribute("position", "0 0 0.02");
    this.windArrowContainer.setAttribute("visible", "false");
    this.windVisuals.appendChild(this.windArrowContainer);

    const arrowStem = document.createElement("a-plane");
    arrowStem.id = "wind-arrow-stem";
    arrowStem.setAttribute("width", "0.015");
    arrowStem.setAttribute("height", "0.08");
    arrowStem.setAttribute("position", "0 -0.01 0");
    arrowStem.setAttribute("color", "#00FF00");
    arrowStem.setAttribute("material", "shader: flat; opacity: 1; side: double");
    this.windArrowContainer.appendChild(arrowStem);

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

    this.startWindSound();

    this.el.addEventListener("start-game", () => {
      this.startWindSound();
    });

    this.visualsCreated = true;
  },

  startWindSound: function () {
    const windSound = document.getElementById("wind-sound");
    if (windSound && this.data.enabled) {
      windSound.volume = 0.08;
      windSound.loop = true;
      const playPromise = windSound.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
        }).catch(e => {
          document.addEventListener('click', () => {
            windSound.play().catch(() => {});
          }, { once: true });
        });
      }
    } else {
    }
  },

  updateWindVisuals: function () {
    if (!this.windVisuals) return;
    const windText = this.windVisuals.querySelector("#wind-text");
    const arrowContainer = this.windArrowContainer;
    const background = this.windVisuals.querySelector("#wind-bg");
    const arrowStem = this.windVisuals.querySelector("#wind-arrow-stem");
    const arrowHead = this.windVisuals.querySelector("#wind-arrow-head");

    if (!this.windActive || this.windIntensity < 0.001) {
      if (windText) {
        windText.setAttribute("value", "CALME");
        windText.setAttribute("color", "#88FF88");
      }
      if (background) background.setAttribute("color", "#003300");
      if (arrowContainer) arrowContainer.setAttribute("visible", "false");
      return;
    }

    if (windText) {
      const displayIntensity = Math.min(this.windIntensity * 2000, 100).toFixed(0);
      windText.setAttribute("value", `VENT ${displayIntensity}%`);
      let color = "#00FF00";
      if (this.windIntensity > 0.025) color = "#FF4444";
      else if (this.windIntensity > 0.015) color = "#FFA500";
      else if (this.windIntensity > 0.008) color = "#FFFF00";
      windText.setAttribute("color", color);
      if (arrowStem) arrowStem.setAttribute("color", color);
      if (arrowHead) arrowHead.setAttribute("color", color);
    }

    if (background) background.setAttribute("color", "#001133");

    if (arrowContainer) {
      arrowContainer.setAttribute("visible", "true");
      const windDir = this.windForce.clone();
      windDir.y = 0;
      if (windDir.length() > 0.001) {
        windDir.normalize();
        const angleRad = Math.atan2(windDir.x, -windDir.z);
        const angleDeg = THREE.MathUtils.radToDeg(angleRad);
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

  rampWindVolume: function (soundEl, targetVolume, duration) {
    if (!soundEl) return;
    if (this._volumeRampRAF) {
      cancelAnimationFrame(this._volumeRampRAF);
      this._volumeRampRAF = null;
    }

    const from = Math.max(0, Math.min(1, soundEl.volume || 0));
    const to = Math.max(0, Math.min(1, targetVolume));
    const delta = to - from;
    if (Math.abs(delta) < 0.001 || duration <= 0) {
      soundEl.volume = to;
      return;
    }

    let startTime = null;
    const frame = (now) => {
      if (!startTime) startTime = now;
      const t = Math.min(1, (now - startTime) / Math.max(1, duration));
      soundEl.volume = Math.max(0, Math.min(1, from + delta * t));
      if (t < 1) {
        this._volumeRampRAF = requestAnimationFrame(frame);
      } else {
        this._volumeRampRAF = null;
      }
    };

    this._volumeRampRAF = requestAnimationFrame(frame);
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
    if (this.windVisuals && this.windVisuals.parentNode) this.windVisuals.parentNode.removeChild(this.windVisuals);
    const windSound = document.getElementById("wind-sound");
    if (windSound) windSound.pause();
  }
});
