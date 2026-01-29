import './style.css'
import 'aframe'
import 'aframe-physics-system'
import 'aframe-state-component'
import 'aframe-extras'
import 'aframe-environment-component'

// Import des composants personnalisés
import './components/bow-logic.js'
import './components/bow-draw-system.js'
import './components/arrow-physics.js'
import './components/target-behavior.js'
import './components/scene-mesh-handler.js'

// Import des systèmes
import './systems/game-manager.js'
import './systems/combo-system.js'

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene')
  
  scene.addEventListener('loaded', () => {
    console.log('🏹 SAE 4.02 - Archery XR initialisé')
    console.log('📦 Moteur physique: Ammo.js (aframe-physics-system)')
    console.log('🎮 WebXR ready - Utilisez un casque VR pour une expérience immersive')
    console.log('🌍 Scene Mesh activé pour l\'ancrage spatial')
    
    // Afficher les instructions
    showInstructions()
  })
})

function showInstructions() {
  const instructions = document.createElement('div')
  instructions.className = 'instructions'
  instructions.innerHTML = `
    <strong>🎯 Instructions VR</strong><br>
    1. Rapprochez la manette droite de la gauche<br>
    2. Maintenez la gâchette droite<br>
    3. Tirez la manette droite vers vous<br>
    4. Relâchez pour tirer la flèche
  `
  document.body.appendChild(instructions)
  
  // Masquer après 7 secondes
  setTimeout(() => {
    instructions.style.opacity = '0'
    instructions.style.transition = 'opacity 1s'
    setTimeout(() => instructions.remove(), 1000)
  }, 7000)
}
