import "./style.css";
import "aframe";
import "aframe-physics-system";
import "aframe-state-component";
import "aframe-extras";
import "aframe-environment-component";

// Import des composants personnalisés
import "./components/bow-logic.js";
import "./components/bow-draw-system.js";
import "./components/bow-string.js";
import "./components/arrow-physics.js";
import "./components/target-behavior.js";
import "./components/scene-mesh-handler.js";
import "./components/surface-detector.js";
import "./components/webxr-anchor-manager.js";
import "./components/score-hud.js";
import "./components/vr-menu.js";
import "./components/end-menu.js";
import "./components/room-scanner.js";
import "./components/wall-debug.js";
// model-debug.js supprimé - fichier de debug

// Import des systèmes
import "./systems/game-manager.js";
import "./systems/combo-system.js";
import "./components/wind-system.js";

document.addEventListener("DOMContentLoaded", () => {
  const scene = document.querySelector("a-scene");

  scene.addEventListener("loaded", () => {

    // Afficher les instructions
    showInstructions();
  });
});

function showInstructions() {
  const instructions = document.createElement("div");
  instructions.className = "instructions";
  instructions.innerHTML = `
    <strong>🎯 Instructions VR</strong><br>
    1. Rapprochez la manette droite de la gauche<br>
    2. Maintenez la gâchette droite<br>
    3. Tirez la manette droite vers vous<br>
    4. Relâchez pour tirer la flèche
  `;
  document.body.appendChild(instructions);

  // Masquer après 7 secondes
  setTimeout(() => {
    instructions.style.opacity = "0";
    instructions.style.transition = "opacity 1s";
    setTimeout(() => instructions.remove(), 1000);
  }, 7000);
}
