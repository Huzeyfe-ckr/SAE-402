/**
 * Composant vr-menu pour A-Frame
 * Affiche un panneau flottant avec les instructions du jeu
 * et un bouton pour démarrer la partie
 * Style médiéval
 */

AFRAME.registerComponent("vr-menu", {
  init: function () {
    this.isVisible = true;

    // Créer le panneau de menu
    this.createMenuPanel();

    // Écouter l'événement de démarrage du jeu
    this.el.sceneEl.addEventListener("start-game", () => {
      this.hideMenu();
    });

    console.log("📋 VR Menu initialisé");
  },

  createMenuPanel: function () {
    const menu = this.el;

    // Positionner le menu devant le joueur
    menu.setAttribute("position", "0 1.5 -2.5");
    menu.setAttribute("rotation", "0 0 0");

    // Couleurs médiévales
    const COLORS = {
      darkWood: "#2d1b0e",
      lightWood: "#4a3728",
      gold: "#d4af37",
      parchment: "#f4e4bc",
      darkRed: "#8b0000",
    };

    // Bordure dorée extérieure
    const borderOuter = document.createElement("a-entity");
    borderOuter.setAttribute("geometry", {
      primitive: "plane",
      width: 1.5,
      height: 1.7,
    });
    borderOuter.setAttribute("material", {
      color: COLORS.gold,
      opacity: 1,
      shader: "flat",
    });
    borderOuter.setAttribute("position", "0 0 -0.002");
    menu.appendChild(borderOuter);

    // Panneau de bois
    const panel = document.createElement("a-entity");
    panel.setAttribute("geometry", {
      primitive: "plane",
      width: 1.44,
      height: 1.64,
    });
    panel.setAttribute("material", {
      color: COLORS.darkWood,
      opacity: 0.98,
      shader: "flat",
    });
    panel.setAttribute("position", "0 0 -0.001");
    menu.appendChild(panel);

    // Parchemin central
    const parchment = document.createElement("a-entity");
    parchment.setAttribute("geometry", {
      primitive: "plane",
      width: 1.3,
      height: 1.5,
    });
    parchment.setAttribute("material", {
      color: COLORS.parchment,
      opacity: 0.15,
      shader: "flat",
    });
    parchment.setAttribute("position", "0 0 0");
    menu.appendChild(parchment);

    // Titre avec style médiéval
    const title = document.createElement("a-text");
    title.setAttribute("value", "⚔️ ARCHERY XR ⚔️");
    title.setAttribute("position", "0 0.62 0.01");
    title.setAttribute("align", "center");
    title.setAttribute("color", COLORS.gold);
    title.setAttribute("width", "2.2");
    menu.appendChild(title);

    // Ligne décorative sous le titre
    const separator = document.createElement("a-entity");
    separator.setAttribute("geometry", {
      primitive: "plane",
      width: 1.1,
      height: 0.015,
    });
    separator.setAttribute("material", {
      color: COLORS.gold,
      shader: "flat",
    });
    separator.setAttribute("position", "0 0.48 0.01");
    menu.appendChild(separator);

    // Section QUÊTE
    const objectifTitle = document.createElement("a-text");
    objectifTitle.setAttribute("value", "~ QUETE ~");
    objectifTitle.setAttribute("position", "0 0.35 0.01");
    objectifTitle.setAttribute("align", "center");
    objectifTitle.setAttribute("color", COLORS.gold);
    objectifTitle.setAttribute("width", "1.6");
    menu.appendChild(objectifTitle);

    const objectifText = document.createElement("a-text");
    objectifText.setAttribute(
      "value",
      "Abattez les cibles avec vos\nfleches pour gagner des points !",
    );
    objectifText.setAttribute("position", "0 0.2 0.01");
    objectifText.setAttribute("align", "center");
    objectifText.setAttribute("color", "#ddd");
    objectifText.setAttribute("width", "1.3");
    menu.appendChild(objectifText);

    // Section CONTROLES
    const controlesTitle = document.createElement("a-text");
    controlesTitle.setAttribute("value", "~ CONTROLES ~");
    controlesTitle.setAttribute("position", "0 0.02 0.01");
    controlesTitle.setAttribute("align", "center");
    controlesTitle.setAttribute("color", COLORS.gold);
    controlesTitle.setAttribute("width", "1.6");
    menu.appendChild(controlesTitle);

    const controlesText = document.createElement("a-text");
    controlesText.setAttribute(
      "value",
      "Main gauche : Arc\nMain droite : Tirer (Gachette)",
    );
    controlesText.setAttribute("position", "0 -0.12 0.01");
    controlesText.setAttribute("align", "center");
    controlesText.setAttribute("color", "#ddd");
    controlesText.setAttribute("width", "1.3");
    menu.appendChild(controlesText);

    // Section SCORING
    const scoringTitle = document.createElement("a-text");
    scoringTitle.setAttribute("value", "~ RECOMPENSES ~");
    scoringTitle.setAttribute("position", "0 -0.28 0.01");
    scoringTitle.setAttribute("align", "center");
    scoringTitle.setAttribute("color", COLORS.gold);
    scoringTitle.setAttribute("width", "1.6");
    menu.appendChild(scoringTitle);

    const scoringText = document.createElement("a-text");
    scoringText.setAttribute(
      "value",
      "Centre : x3  |  Milieu : x2  |  Bord : x1",
    );
    scoringText.setAttribute("position", "0 -0.4 0.01");
    scoringText.setAttribute("align", "center");
    scoringText.setAttribute("color", "#ddd");
    scoringText.setAttribute("width", "1.3");
    menu.appendChild(scoringText);

    // Bouton cible pour démarrer
    this.createPlayButton(menu, COLORS);
  },

  createPlayButton: function (menu, COLORS) {
    // Conteneur du bouton-cible
    const buttonContainer = document.createElement("a-entity");
    buttonContainer.setAttribute("position", "0 -0.62 0.05");
    buttonContainer.id = "play-button";

    // Cible circulaire rouge
    const target = document.createElement("a-entity");
    target.setAttribute("geometry", {
      primitive: "cylinder",
      radius: 0.18,
      height: 0.05,
    });
    target.setAttribute("material", {
      color: "#8b0000",
      shader: "flat",
    });
    target.setAttribute("rotation", "90 0 0");
    target.setAttribute("position", "0 0 0");
    buttonContainer.appendChild(target);

    // Centre doré
    const bullseye = document.createElement("a-entity");
    bullseye.setAttribute("geometry", {
      primitive: "cylinder",
      radius: 0.07,
      height: 0.06,
    });
    bullseye.setAttribute("material", {
      color: COLORS.gold,
      shader: "flat",
    });
    bullseye.setAttribute("rotation", "90 0 0");
    bullseye.setAttribute("position", "0 0 0.01");
    buttonContainer.appendChild(bullseye);

    // Texte
    const buttonText = document.createElement("a-text");
    buttonText.setAttribute("value", "🎯 TIREZ POUR COMMENCER");
    buttonText.setAttribute("position", "0 -0.28 0");
    buttonText.setAttribute("align", "center");
    buttonText.setAttribute("color", COLORS.gold);
    buttonText.setAttribute("width", "1.6");
    buttonContainer.appendChild(buttonText);

    // Animation pulsante
    target.setAttribute("animation", {
      property: "scale",
      from: "1 1 1",
      to: "1.15 1.15 1.15",
      dur: 700,
      dir: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });

    menu.appendChild(buttonContainer);

    // Stocker la référence pour la détection de collision
    this.playButton = buttonContainer;
    this.playButtonWorldPos = new THREE.Vector3();
  },

  // Méthode appelée par les flèches
  checkArrowHit: function (arrowPosition) {
    if (!this.isVisible || !this.playButton) return false;

    this.playButton.object3D.getWorldPosition(this.playButtonWorldPos);
    const distance = arrowPosition.distanceTo(this.playButtonWorldPos);

    console.log(`📍 Distance flèche-bouton: ${distance.toFixed(2)}`);

    if (distance < 0.5) {
      console.log("🎯 Bouton touché par une flèche !");
      this.onPlayClick();
      return true;
    }

    return false;
  },

  onPlayClick: function () {
    console.log("🎮 Bouton JOUER cliqué !");
    
    // Désactiver les lasers des manettes au lancement du jeu
    const bowDrawSystem = document.querySelector("#rig").components["bow-draw-system"];
    if (bowDrawSystem && bowDrawSystem.disableLasers) {
      bowDrawSystem.disableLasers();
    }
    
    this.el.sceneEl.emit("start-game");
    this.hideMenu();
  },

  hideMenu: function () {
    if (!this.isVisible) return;

    this.isVisible = false;

    this.el.setAttribute("animation", {
      property: "scale",
      to: "0 0 0",
      dur: 300,
      easing: "easeInQuad",
    });

    setTimeout(() => {
      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
    }, 350);

    console.log("📋 Menu VR caché");
  },

  showMenu: function () {
    if (this.isVisible) return;

    this.isVisible = true;
    this.el.setAttribute("scale", "1 1 1");
    this.el.setAttribute("visible", true);

    console.log("📋 Menu VR affiché");
  },
});
