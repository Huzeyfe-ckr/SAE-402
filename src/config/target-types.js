/**
 * Configuration des différents types de cibles
 * Chaque type a son modèle, son animation, et ses propriétés
 */

export const TARGET_TYPES = {
  // Faucon volant (original - meilleur pour le gameplay)
  fly: {
    name: 'Faucon',
    assetId: 'target-fly',
    animationClip: 'metarig|Fly',
    scale: 0.1,
    points: 10,
    hp: 1,
    flySpeed: 1.5,
    difficulty: 'easy'
  },

  // Chauve-souris
  bat: {
    name: 'Chauve-souris',
    assetId: 'bat',
    animationClip: 'BatArmature|Bat_Flying',
    scale: 0.1,
    points: 15,
    hp: 2,
    flySpeed: 2.0,
    difficulty: 'medium'
  },

  // Abeille armée
  armabee: {
    name: 'Abeille armée',
    assetId: 'armabee',
    animationClip: 'CharacterArmature|Flying_Idle',
    scale: 0.1,
    points: 20,
    hp: 3,
    flySpeed: 1.2,
    difficulty: 'hard'
  }
};

/**
 * Retourne un type de cible aléatoire
 */
export function getRandomTargetType() {
  const types = Object.values(TARGET_TYPES);
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Retourne un type de cible par difficulté
 */
export function getTargetByDifficulty(difficulty) {
  for (const type of Object.values(TARGET_TYPES)) {
    if (type.difficulty === difficulty) {
      return type;
    }
  }
  return TARGET_TYPES.fly; // Fallback
}

/**
 * Crée le HTML entité pour une cible
 */
export function createTargetHTML(targetType) {
  return `
    <a-entity 
      gltf-model="#${targetType.assetId}" 
      scale="${targetType.scale} ${targetType.scale} ${targetType.scale}" 
      animation-mixer="clip: ${targetType.animationClip}; loop: repeat; timeScale: 1"
    ></a-entity>
  `;
}
