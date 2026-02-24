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
    flySpeed: 0.8,  // Réduit de 1.5
    difficulty: 'easy',
    deathAnimation: {
      rotation: '360 360 360',
      scale: '0 0 0',
      duration: 300,
      easing: 'easeInQuad'
    }
  },

  // Chauve-souris
  bat: {
    name: 'Chauve-souris',
    assetId: 'bat',
    animationClip: 'BatArmature|Bat_Flying',
    scale: 0.1,
    points: 15,
    hp: 2,
    flySpeed: 1.0,  // Réduit de 2.0
    difficulty: 'medium',
    deathAnimation: {
      rotation: '0 720 0',
      scale: '0 0 0',
      duration: 350,
      easing: 'easeInCubic'
    }
  },

  // Abeille armée
  armabee: {
    name: 'Abeille armée',
    assetId: 'armabee',
    animationClip: 'CharacterArmature|Flying_Idle',
    scale: 0.1,
    points: 20,
    hp: 3,
    flySpeed: 0.6,  // Réduit de 1.2
    difficulty: 'hard',
    deathAnimation: {
      rotation: '180 360 180',
      scale: '0 0 0',
      duration: 400,
      easing: 'easeInQuart'
    }
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
 * Retourne l'animation de mort pour un type de cible
 */
export function getDeathAnimation(targetTypeOrAssetId) {
  let targetType = targetTypeOrAssetId;
  
  // Si on passe un assetId, trouver le type correspondant
  if (typeof targetTypeOrAssetId === 'string') {
    for (const type of Object.values(TARGET_TYPES)) {
      if (type.assetId === targetTypeOrAssetId) {
        targetType = type;
        break;
      }
    }
  }
  
  return targetType?.deathAnimation || {
    rotation: '360 360 360',
    scale: '0 0 0',
    duration: 300,
    easing: 'easeInQuad'
  };
}

/**
 * Crée le HTML entité pour une cible
 */
export function createTargetHTML(targetType) {
  return `
    <a-entity 
      gltf-model="#${targetType.assetId}" 
      scale="${targetType.scale} ${targetType.scale} ${targetType.scale}" 
      animation-mixer="clip: ${targetType.animationClip}; loop: repeat; timeScale: 0.7"
    ></a-entity>
  `;
}
