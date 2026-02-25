/**
 * Composant end-menu pour A-Frame
 * Affiche un panneau de fin de partie avec le score
 * et un bouton pour rejouer
 * Style médiéval
 */

AFRAME.registerComponent("end-menu", {
  schema: {
    score: { type: "number", default: 0 },
    hits: { type: "number", default: 0 },
    arrows: { type: "number", default: 0 },
  },

  init: function () {
    this.isVisible = true;

    // Créer le panneau de fin
    this.createEndPanel();

  },

  createEndPanel: function () {
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
      bronze: "#cd7f32",
    };

    // Bordure dorée extérieure
    const borderOuter = document.createElement("a-entity");
    borderOuter.setAttribute("geometry", {
      primitive: "plane",
      width: 1.5,
      height: 1.6,
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
      height: 1.54,
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
      height: 1.4,
    });
    parchment.setAttribute("material", {
      color: COLORS.parchment,
      opacity: 0.15,
      shader: "flat",
    });
    parchment.setAttribute("position", "0 0 0");
    menu.appendChild(parchment);

    // Titre "FIN DE QUÊTE"
    const title = document.createElement("a-text");
    title.setAttribute("value", "⚔️ FIN DE QUETE ⚔️");
    title.setAttribute("position", "0 0.58 0.01");
    title.setAttribute("align", "center");
    title.setAttribute("color", COLORS.gold);
    title.setAttribute("width", "2");
    menu.appendChild(title);

    // Ligne décorative
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
    separator.setAttribute("position", "0 0.45 0.01");
    menu.appendChild(separator);

    // Label SCORE
    const scoreLabel = document.createElement("a-text");
    scoreLabel.setAttribute("value", "~ VOTRE BUTIN ~");
    scoreLabel.setAttribute("position", "0 0.32 0.01");
    scoreLabel.setAttribute("align", "center");
    scoreLabel.setAttribute("color", COLORS.gold);
    scoreLabel.setAttribute("width", "1.5");
    menu.appendChild(scoreLabel);

    // Score principal (gros et espacé)
    const scoreValue = document.createElement("a-text");
    scoreValue.setAttribute("value", this.data.score.toString());
    scoreValue.setAttribute("position", "0 0.12 0.01");
    scoreValue.setAttribute("align", "center");
    scoreValue.setAttribute("color", "#fff");
    scoreValue.setAttribute("width", "5");
    menu.appendChild(scoreValue);

    // Unité "points"
    const pointsLabel = document.createElement("a-text");
    pointsLabel.setAttribute("value", "points");
    pointsLabel.setAttribute("position", "0 -0.02 0.01");
    pointsLabel.setAttribute("align", "center");
    pointsLabel.setAttribute("color", COLORS.bronze);
    pointsLabel.setAttribute("width", "1.2");
    menu.appendChild(pointsLabel);

    // Ligne de séparation avant stats
    const separator2 = document.createElement("a-entity");
    separator2.setAttribute("geometry", {
      primitive: "plane",
      width: 0.8,
      height: 0.008,
    });
    separator2.setAttribute("material", {
      color: COLORS.gold,
      opacity: 0.5,
      shader: "flat",
    });
    separator2.setAttribute("position", "0 -0.15 0.01");
    menu.appendChild(separator2);

    // Statistiques (bien espacées)
    const accuracy =
      this.data.arrows > 0
        ? Math.round((this.data.hits / this.data.arrows) * 100)
        : 0;

    const statsText = document.createElement("a-text");
    statsText.setAttribute(
      "value",
      `Touches: ${this.data.hits}  |  Fleches: ${this.data.arrows}  |  Precision: ${accuracy}%`,
    );
    statsText.setAttribute("position", "0 -0.28 0.01");
    statsText.setAttribute("align", "center");
    statsText.setAttribute("color", "#bbb");
    statsText.setAttribute("width", "1.2");
    menu.appendChild(statsText);

    // Bouton REJOUER
    this.createReplayButton(menu, COLORS);
  },

  createReplayButton: function (menu, COLORS) {
    // Conteneur du bouton-cible
    const buttonContainer = document.createElement("a-entity");
    buttonContainer.setAttribute("position", "0 -0.52 0.05");
    buttonContainer.id = "replay-button";
    buttonContainer.classList.add("clickable");

    // Cible circulaire verte
    const target = document.createElement("a-entity");
    target.setAttribute("geometry", {
      primitive: "cylinder",
      radius: 0.16,
      height: 0.05,
    });
    target.setAttribute("material", {
      color: "#1a5f1a",
      shader: "flat",
    });
    target.setAttribute("rotation", "90 0 0");
    target.setAttribute("position", "0 0 0");
    target.classList.add("clickable");
    buttonContainer.appendChild(target);

    // Centre doré
    const bullseye = document.createElement("a-entity");
    bullseye.setAttribute("geometry", {
      primitive: "cylinder",
      radius: 0.06,
      height: 0.06,
    });
    bullseye.setAttribute("material", {
      color: COLORS.gold,
      shader: "flat",
    });
    bullseye.setAttribute("rotation", "90 0 0");
    bullseye.setAttribute("position", "0 0 0.01");
    bullseye.classList.add("clickable");
    buttonContainer.appendChild(bullseye);

    // Texte
    const buttonText = document.createElement("a-text");
    buttonText.setAttribute("value", "🔄 NOUVELLE QUETE");
    buttonText.setAttribute("position", "0 -0.22 0");
    buttonText.setAttribute("align", "center");
    buttonText.setAttribute("color", COLORS.gold);
    buttonText.setAttribute("width", "1.5");
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
    this.replayButton = buttonContainer;
    this.replayButtonWorldPos = new THREE.Vector3();
    
    // Ajouter un écouteur d'événements pour le clic VR
    buttonContainer.addEventListener("click", () => {
      this.onReplayClick();
    });
    
    // Détecter le survol du curseur/raycast
    buttonContainer.addEventListener("mouseenter", () => {
      target.setAttribute("material", "color", "#2a8f2a");
    });
    
    buttonContainer.addEventListener("mouseleave", () => {
      target.setAttribute("material", "color", "#1a5f1a");
    });
  },

  // Méthode appelée par les flèches
  checkArrowHit: function (arrowPosition) {
    if (!this.isVisible || !this.replayButton) return false;

    this.replayButton.object3D.getWorldPosition(this.replayButtonWorldPos);
    const distance = arrowPosition.distanceTo(this.replayButtonWorldPos);

    if (distance < 0.5) {
      this.onReplayClick();
      return true;
    }

    return false;
  },

  onReplayClick: function () {

    // Supprimer le HUD actuel
    const hud = document.getElementById("game-hud");
    if (hud) hud.remove();

    // Supprimer toutes les cibles existantes
    const targets = this.el.sceneEl.querySelectorAll("[target-behavior]");
    targets.forEach((t) => t.remove());

    // Supprimer toutes les flèches
    const arrows = this.el.sceneEl.querySelectorAll("[arrow-physics]");
    arrows.forEach((a) => a.remove());

    // Cacher le menu de fin
    this.hideMenu();

    // Recréer le menu de démarrage
    const startMenu = document.createElement("a-entity");
    startMenu.setAttribute("vr-menu", "");
    this.el.sceneEl.appendChild(startMenu);
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

  },
});
