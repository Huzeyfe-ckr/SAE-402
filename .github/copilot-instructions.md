# Instructions Copilot pour SAE 4.02 - Archery XR

## Vue d'ensemble du projet

Jeu de tir à l'arc immersif en WebXR utilisant A-Frame, transformant l'environnement réel du joueur en zone de combat.

## 🔍 Règle obligatoire : Vérification avec Context7

**IMPORTANT** : Avant d'utiliser ou de recommander toute fonctionnalité, bibliothèque ou pattern, **toujours vérifier avec Context7** :

- ✅ **Vérifier les versions à jour** des bibliothèques (A-Frame, aframe-physics-system, etc.)
- ✅ **Valider les bonnes pratiques** actuelles de l'écosystème A-Frame
- ✅ **Confirmer les APIs modernes** et les fonctions disponibles
- ✅ **S'assurer de l'utilisation des dernières fonctionnalités** WebXR
- ✅ **Vérifier la syntaxe correcte** des composants et systèmes

### Commandes Context7 à utiliser

```bash
# Vérifier les versions et documentation
mcp_io_github_ups_resolve-library-id("aframe")
mcp_io_github_ups_get-library-docs("/aframevr/aframe", topic="...")

# Vérifier les bonnes pratiques
mcp_io_github_ups_get-library-docs("/aframevr/aframe", mode="info", topic="best practices")
```

**Ne jamais** implémenter de code basé sur des suppositions ou des versions obsolètes. Toujours valider avec Context7 en premier.

## Architecture ECS (Entity-Component-System)

### Composants (`src/components/`)

1. **bow-logic.js**
   - Calcule la tension de l'arc basée sur la distance entre les deux manettes VR
   - Gère le tir via événements `triggerdown`/`triggerup` ou `gripdown`/`gripup`
   - Instancie des flèches avec corps physique dynamique (Ammo.js)
   - Visualise la corde de l'arc pendant le bandage

2. **arrow-physics.js**
   - Applique une impulsion initiale via `body.applyCentralImpulse()` (Ammo.js)
   - Gère l'alignement avec la vélocité (orient la flèche selon sa trajectoire)
   - Applique des forces de vent via `body.applyCentralForce()`
   - Transforme la flèche en `static-body` lors de collision (effet de plantage)
   - Utilise CCD (Continuous Collision Detection) pour éviter le tunneling

3. **target-behavior.js**
   - Calcule le score de précision via `worldToLocal()` pour obtenir la distance au centre
   - 3 zones: bullseye (x3), middle (x2), outer (x1)
   - Gère les HP et la destruction avec animations
   - Supporte les cibles mobiles avec animations oscillantes

4. **scene-mesh-handler.js**
   - Détecte et gère les surfaces réelles via WebXR Scene Understanding API
   - Convertit les meshes détectés en `static-body` A-Frame
   - Permet aux flèches de se planter dans les murs/meubles réels

### Systèmes (`src/systems/`)

1. **game-manager.js**
   - Spawn automatique de cibles selon la difficulté
   - Gère le score global via `state` component
   - Calcule les statistiques (précision, flèches tirées, hits)
   - Met à jour le HUD en temps réel

2. **combo-system.js**
   - Détecte les hits consécutifs dans une fenêtre temporelle (2s)
   - Calcule le multiplicateur progressif (+20% par combo, max 5x)
   - Affiche les feedbacks visuels (texte 3D flottant)
   - Bonus supplémentaire pour les bullseyes

## Stack Technique

### Bibliothèques principales
- **A-Frame 1.7.1** : Framework WebXR avec support hand-tracking et anchors
- **aframe-physics-system 4.0.2** avec **Ammo.js** : Physique réaliste avec CCD
- **aframe-state-component 7.1.1** : Gestion réactive de l'état global
- **aframe-extras 7.6.1** : Animations et utilitaires
- **aframe-environment-component 1.5.0** : Environnements prédéfinis
- **Vite 7.2+** : Build tool ultra-rapide

### Fonctionnalités WebXR modernes (A-Frame 1.7+)
- **Hand Tracking** : Support natif du tracking des mains sans contrôleurs
- **WebXR Anchors** : Ancrage spatial persistant
- **Hit Test API** : Détection de surfaces réelles améliorée
- **Local Floor** : Positionnement au sol réel automatique

### Pourquoi Ammo.js ?
- **CCD (Continuous Collision Detection)** : Empêche les flèches rapides de traverser les murs
- Meilleur pour les projectiles à haute vélocité que Cannon.js
- Support natif dans aframe-physics-system
- Activation CCD recommandée :
```javascript
body.setCcdMotionThreshold(0.01)  // Seuil de mouvement
body.setCcdSweptSphereRadius(0.005) // Rayon de détection
```

## Patterns et Conventions

### Physique
```javascript
// Appliquer une impulsion (tir initial)
const impulse = new Ammo.btVector3(force.x, force.y, force.z)
body.applyCentralImpulse(impulse)
Ammo.destroy(impulse) // Toujours nettoyer la mémoire Ammo

// Appliquer une force continue (vent)
const windForce = new Ammo.btVector3(x, y, z)
body.applyCentralForce(windForce)
Ammo.destroy(windForce)
```

### Calcul de précision
```javascript
// Convertir le point d'impact en coordonnées locales de la cible
const localImpact = targetEl.object3D.worldToLocal(impactPoint.clone())

// Calculer la distance au centre (plan XY)
const distance = Math.sqrt(localImpact.x ** 2 + localImpact.y ** 2)

// Mapper à un multiplicateur
if (distance <= centerRadius) multiplier = 3.0  // Bullseye
else if (distance <= middleRadius) multiplier = 2.0
else multiplier = 1.0
```

### État global avec state-component
```html
<!-- Définir l'état sur la scène -->
<a-scene state="score: 0; combo: 0; multiplier: 1.0">

<!-- Mettre à jour depuis un système -->
this.el.setAttribute('state', 'score', newScore)
```

### Événements personnalisés
```javascript
// Émettre
scene.emit('target-hit', { points, zone, multiplier })

// Écouter
this.el.addEventListener('target-hit', (evt) => {
  const { points, zone } = evt.detail
})
```

## Scene Mesh et Ancrage Spatial

Le composant `scene-mesh-handler` utilise WebXR Scene Understanding pour :
1. Détecter les surfaces réelles (murs, sols, meubles)
2. Les convertir en entités A-Frame avec `static-body`
3. Permettre les collisions physiques réalistes

**Note** : L'API Scene Understanding est en développement. Le code actuel utilise des surfaces mockées pour le développement.

## Gameplay Loop

1. **Initialisation** : `game-manager` démarre après 2s
2. **Spawn** : Cibles spawned toutes les 5s (max 5 actives)
3. **Tir** : Joueur rapproche les manettes → tension calculée → relâche → impulsion appliquée
4. **Collision** : Flèche touche cible → calcul précision → score + combo mis à jour
5. **Destruction** : Cible à 0 HP → animation → bonus points → despawn

## Points d'attention pour le développement

### Performances VR
- Limiter les entités actives (max 20 flèches, 5 cibles)
- Utiliser `static-body` pour objets immobiles
- Nettoyer les entités après usage (éviter les leaks)

### Debugging
- `physics="debug: true"` pour voir les collision shapes
- Console logs avec emojis pour identifier les événements
- Vérifier `this.el.body` avant d'utiliser les méthodes Ammo

### WebXR Testing
- Utiliser WebXR Emulator extension pour Chrome/Edge
- Tester sur Meta Quest 3 pour le Scene Mesh réel
- Fallback desktop avec clics souris

## Prochaines fonctionnalités

- [ ] Power-ups (flèches explosives, multi-cibles)
- [ ] Modes de jeu (contre-la-montre, survie)
- [ ] Effets sonores spatialisés
- [ ] Leaderboards en ligne
- [ ] Vraie intégration Scene Mesh API

## Commandes utiles

```bash
npm run dev        # Lancer le serveur (http://localhost:5173)
npm run build      # Build de production
npm run preview    # Prévisualiser le build
```

## Ressources

- [A-Frame Documentation](https://aframe.io/docs/)
- [aframe-physics-system](https://github.com/c-frame/aframe-physics-system)
- [WebXR Device API](https://www.w3.org/TR/webxr/)
- [Ammo.js Physics](https://github.com/kripken/ammo.js/)

---

**Note pour Copilot** : Ce projet utilise une architecture ECS stricte. Toujours créer des composants réutilisables plutôt que du code inline. Privilégier les événements pour la communication entre composants/systèmes.

**RAPPEL CRITIQUE** : Avant toute implémentation, modification ou recommandation, **utiliser Context7** pour :
1. Vérifier que les bibliothèques sont à jour
2. Confirmer que les fonctions/APIs existent dans la version utilisée
3. Valider les bonnes pratiques actuelles de l'écosystème
4. S'assurer de l'utilisation des dernières fonctionnalités disponibles
5. Vérifier la syntaxe et les patterns recommandés

Ne jamais se fier uniquement à la mémoire ou aux connaissances générales. Context7 est la source de vérité.
