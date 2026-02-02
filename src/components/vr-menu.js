/**
 * Composant vr-menu pour A-Frame
 * Affiche un panneau flottant avec les instructions du jeu
 * et un bouton pour démarrer la partie
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

    // Positionner le menu devant le joueur (un peu plus loin)
    menu.setAttribute("position", "0 1.5 -2.5");
    menu.setAttribute("rotation", "0 0 0");

    // Panneau de fond
    const panel = document.createElement("a-entity");
    panel.setAttribute("geometry", {
      primitive: "plane",
      width: 1.4,
      height: 1.6,
    });
    panel.setAttribute("material", {
      color: "#1a1a2e",
      opacity: 0.95,
      shader: "flat",
    });
    panel.setAttribute("position", "0 0 0");
    menu.appendChild(panel);

    // Bordure lumineuse
    const border = document.createElement("a-entity");
    border.setAttribute("geometry", {
      primitive: "plane",
      width: 1.44,
      height: 1.64,
    });
    border.setAttribute("material", {
      color: "#667eea",
      opacity: 0.8,
      shader: "flat",
    });
    border.setAttribute("position", "0 0 -0.001");
    menu.appendChild(border);

    // Titre
    const title = document.createElement("a-text");
    title.setAttribute("value", "🏹 ARCHERY XR");
    title.setAttribute("position", "0 0.6 0.01");
    title.setAttribute("align", "center");
    title.setAttribute("color", "#fff");
    title.setAttribute("width", "2.5");
    title.setAttribute("font", "mozillavr");
    menu.appendChild(title);

    // Ligne de séparation
    const separator = document.createElement("a-entity");
    separator.setAttribute("geometry", {
      primitive: "plane",
      width: 1.2,
      height: 0.01,
    });
    separator.setAttribute("material", {
      color: "#667eea",
      shader: "flat",
    });
    separator.setAttribute("position", "0 0.45 0.01");
    menu.appendChild(separator);

    // Section OBJECTIF
    const objectifTitle = document.createElement("a-text");
    objectifTitle.setAttribute("value", "OBJECTIF");
    objectifTitle.setAttribute("position", "-0.55 0.32 0.01");
    objectifTitle.setAttribute("align", "left");
    objectifTitle.setAttribute("color", "#667eea");
    objectifTitle.setAttribute("width", "1.8");
    menu.appendChild(objectifTitle);

    const objectifText = document.createElement("a-text");
    objectifText.setAttribute(
      "value",
      "Touchez les cibles avec vos\nfleches pour marquer des points !",
    );
    objectifText.setAttribute("position", "-0.55 0.18 0.01");
    objectifText.setAttribute("align", "left");
    objectifText.setAttribute("color", "#ccc");
    objectifText.setAttribute("width", "1.4");
    menu.appendChild(objectifText);

    // Section CONTROLES
    const controlesTitle = document.createElement("a-text");
    controlesTitle.setAttribute("value", "CONTROLES");
    controlesTitle.setAttribute("position", "-0.55 0.0 0.01");
    controlesTitle.setAttribute("align", "left");
    controlesTitle.setAttribute("color", "#667eea");
    controlesTitle.setAttribute("width", "1.8");
    menu.appendChild(controlesTitle);

    const controlesText = document.createElement("a-text");
    controlesText.setAttribute(
      "value",
      "Main gauche : Arc\nMain droite : Tirer (Trigger)",
    );
    controlesText.setAttribute("position", "-0.55 -0.12 0.01");
    controlesText.setAttribute("align", "left");
    controlesText.setAttribute("color", "#ccc");
    controlesText.setAttribute("width", "1.4");
    menu.appendChild(controlesText);

    // Section SCORING
    const scoringTitle = document.createElement("a-text");
    scoringTitle.setAttribute("value", "SCORING");
    scoringTitle.setAttribute("position", "-0.55 -0.28 0.01");
    scoringTitle.setAttribute("align", "left");
    scoringTitle.setAttribute("color", "#667eea");
    scoringTitle.setAttribute("width", "1.8");
    menu.appendChild(scoringTitle);

    const scoringText = document.createElement("a-text");
    scoringText.setAttribute(
      "value",
      "Centre : x3 points\nMilieu : x2 points\nExterieur : x1 point",
    );
    scoringText.setAttribute("position", "-0.55 -0.45 0.01");
    scoringText.setAttribute("align", "left");
    scoringText.setAttribute("color", "#ccc");
    scoringText.setAttribute("width", "1.4");
    menu.appendChild(scoringText);

    // Bouton JOUER
    this.createPlayButton(menu);
  },

  createPlayButton: function (menu) {
    // Conteneur du bouton-cible
    const buttonContainer = document.createElement("a-entity");
    buttonContainer.setAttribute("position", "0 -0.65 0.05");
    buttonContainer.id = "play-button";

    // Cible circulaire (comme les vraies cibles du jeu)
    const target = document.createElement("a-entity");
    target.setAttribute("geometry", {
      primitive: "cylinder",
      radius: 0.2,
      height: 0.05,
    });
    target.setAttribute("material", {
      color: "#e74c3c",
      shader: "flat",
    });
    target.setAttribute("rotation", "90 0 0");
    target.setAttribute("position", "0 0 0");
    buttonContainer.appendChild(target);

    // Centre de la cible (bullseye)
    const bullseye = document.createElement("a-entity");
    bullseye.setAttribute("geometry", {
      primitive: "cylinder",
      radius: 0.08,
      height: 0.06,
    });
    bullseye.setAttribute("material", {
      color: "#f1c40f",
      shader: "flat",
    });
    bullseye.setAttribute("rotation", "90 0 0");
    bullseye.setAttribute("position", "0 0 0.01");
    buttonContainer.appendChild(bullseye);

    // Texte "TIREZ ICI"
    const buttonText = document.createElement("a-text");
    buttonText.setAttribute("value", "🎯 TIREZ ICI !");
    buttonText.setAttribute("position", "0 -0.3 0");
    buttonText.setAttribute("align", "center");
    buttonText.setAttribute("color", "#fff");
    buttonText.setAttribute("width", "2");
    buttonContainer.appendChild(buttonText);

    // Animation pulsante pour attirer l'attention
    target.setAttribute("animation", {
      property: "scale",
      from: "1 1 1",
      to: "1.1 1.1 1.1",
      dur: 800,
      dir: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });

    menu.appendChild(buttonContainer);

    // Stocker la référence pour la détection de collision
    this.playButton = buttonContainer;
    this.playButtonWorldPos = new THREE.Vector3();
  },

  // Méthode appelée par les flèches quand elles touchent quelque chose
  checkArrowHit: function (arrowPosition) {
    if (!this.isVisible || !this.playButton) return false;

    // Calculer la position mondiale du bouton
    this.playButton.object3D.getWorldPosition(this.playButtonWorldPos);

    // Vérifier si la flèche est proche du bouton (rayon généreux de 0.5)
    const distance = arrowPosition.distanceTo(this.playButtonWorldPos);

    // Debug
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

    // Émettre l'événement de démarrage du jeu
    this.el.sceneEl.emit("start-game");

    // Cacher le menu
    this.hideMenu();
  },

  hideMenu: function () {
    if (!this.isVisible) return;

    this.isVisible = false;

    // Animation de disparition
    this.el.setAttribute("animation", {
      property: "scale",
      to: "0 0 0",
      dur: 300,
      easing: "easeInQuad",
    });

    this.el.setAttribute("animation__opacity", {
      property: "components.material.material.opacity",
      to: 0,
      dur: 300,
    });

    // Supprimer après l'animation
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
