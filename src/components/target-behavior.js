/**
 * Composant target-behavior pour A-Frame
 * Gère les HP, le calcul de précision basé sur la distance au centre
 * et les animations de hit/destruction
 */

AFRAME.registerComponent('target-behavior', {
  schema: {
    points: { type: 'number', default: 10 },
    hp: { type: 'number', default: 1 },
    movable: { type: 'boolean', default: false },
    centerRadius: { type: 'number', default: 0.1 }, // Rayon du centre (bullseye)
    middleRadius: { type: 'number', default: 0.3 }, // Rayon moyen
    outerRadius: { type: 'number', default: 0.5 }   // Rayon extérieur
  },

  init: function () {
    this.currentHp = this.data.hp
    this.hitCount = 0
    this.hitByArrows = new Set() // Tracker les flèches qui ont déjà touché cette cible
    this.arrowElements = [] // Stocker les références des flèches plantées
    this.surfaceType = this.el.getAttribute('surface-type') || 'random'
    
    // Animation de mouvement si activé
    if (this.data.movable) {
      this.setupMovement()
    }

    console.log(`🎯 Cible créée: ${this.data.points} points, ${this.data.hp} HP (surface: ${this.surfaceType})`)
  },

  /**
   * Méthode appelée quand une flèche touche la cible
   * Calcule le score de précision basé sur la distance au centre
   */
  onArrowHit: function (arrowEl, impactPoint) {
    try {
      if (!impactPoint) {
        console.error('No impact point provided')
        return
      }

      // PROTECTION : Vérifier si cette flèche a déjà touché cette cible
      const arrowId = arrowEl.id || arrowEl.uuid || arrowEl
      if (this.hitByArrows.has(arrowId)) {
        console.log('⚠️ Cette flèche a déjà touché cette cible, ignoré')
        return
      }
      
      // Marquer cette flèche comme ayant touché cette cible
      this.hitByArrows.add(arrowId)
      
      // Stocker la référence de la flèche pour la supprimer lors de la destruction
      this.arrowElements.push(arrowEl)

      this.hitCount++
      this.currentHp--

      // Convertir le point d'impact en coordonnées locales de la cible
      const localImpact = this.el.object3D.worldToLocal(impactPoint.clone())
      
      // Calculer la distance au centre (sur le plan XY local)
      const distanceToCenter = Math.sqrt(
        localImpact.x * localImpact.x + 
        localImpact.y * localImpact.y
      )

      // Calculer le multiplicateur de précision
      let precisionMultiplier = 1.0
      let hitZone = 'outer'
      
      if (distanceToCenter <= this.data.centerRadius) {
        precisionMultiplier = 3.0 // Bullseye! x3
        hitZone = 'bullseye'
      } else if (distanceToCenter <= this.data.middleRadius) {
        precisionMultiplier = 2.0 // Zone moyenne x2
        hitZone = 'middle'
      } else if (distanceToCenter <= this.data.outerRadius) {
        precisionMultiplier = 1.0 // Zone extérieure x1
        hitZone = 'outer'
      } else {
        precisionMultiplier = 0.5 // Touché le bord x0.5
        hitZone = 'edge'
      }

      const finalPoints = Math.floor(this.data.points * precisionMultiplier)

      console.log(`💥 Cible touchée! Zone: ${hitZone} | Distance: ${distanceToCenter.toFixed(3)}m | Points: ${finalPoints} | HP restants: ${this.currentHp}`)

      // Jouer le son de hit
      try {
        const hitSound = document.getElementById('hit-sound')
        if (hitSound) {
          hitSound.currentTime = 0
          hitSound.play().catch(e => console.log('Son de hit non disponible:', e))
        }
      } catch (e) {
        console.error('Sound play error:', e)
      }

      // Animations de feedback
      this.playHitAnimation(hitZone)
      this.showHitFeedback(localImpact, finalPoints, hitZone)

      // Émettre un événement de score au système de jeu
      try {
        console.log(`🎯 [TARGET] Émission événement target-hit avec ${finalPoints} points`)
        this.el.sceneEl.emit('target-hit', {
          points: finalPoints,
          zone: hitZone,
          multiplier: precisionMultiplier,
          position: this.el.object3D.position,
          distanceToCenter: distanceToCenter,
          surfaceType: this.surfaceType
        })
        console.log(`✅ [TARGET] Événement target-hit émis avec succès`)
      } catch (e) {
        console.error('❌ [TARGET] Event emission error:', e)
      }

      // Détruire la cible si HP = 0
      if (this.currentHp <= 0) {
        this.destroy(finalPoints)
      }
    } catch (e) {
      console.error('onArrowHit error:', e)
    }
  },

  playHitAnimation: function (zone) {
    // Animation simplifiée
    try {
      const originalScale = this.el.getAttribute('scale')
      const scale = zone === 'bullseye' ? 1.3 : zone === 'middle' ? 1.2 : 1.1
      
      this.el.setAttribute('scale', {
        x: originalScale.x * scale,
        y: originalScale.y * scale,
        z: originalScale.z * scale
      })
      
      // Revenir à l'échelle originale après 150ms
      setTimeout(() => {
        this.el.setAttribute('scale', originalScale)
      }, 150)
    } catch (e) {
      console.error('Hit animation error:', e)
    }
  },

  showHitFeedback: function (localPosition, points, zone) {
    // Créer un texte flottant avec les points
    try {
      const worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      
      // Créer l'entité du texte flottant
      const floatingText = document.createElement('a-entity');
      floatingText.setAttribute('position', {
        x: worldPos.x,
        y: worldPos.y + 0.3,
        z: worldPos.z
      });
      
      // Couleur et taille selon la zone touchée
      let color = '#FFFFFF';
      let textSize = 0.3;
      let prefix = '+';
      
      switch (zone) {
        case 'bullseye':
          color = '#FFD700'; // Or
          textSize = 0.5;
          prefix = '🎯 +';
          break;
        case 'middle':
          color = '#00FF00'; // Vert
          textSize = 0.4;
          prefix = '✨ +';
          break;
        case 'outer':
          color = '#87CEEB'; // Bleu clair
          textSize = 0.35;
          prefix = '+';
          break;
        case 'edge':
          color = '#FFA500'; // Orange
          textSize = 0.3;
          prefix = '+';
          break;
      }
      
      // Texte principal avec les points
      const textEl = document.createElement('a-text');
      textEl.setAttribute('value', `${prefix}${points}`);
      textEl.setAttribute('color', color);
      textEl.setAttribute('align', 'center');
      textEl.setAttribute('scale', `${textSize} ${textSize} ${textSize}`);
      textEl.setAttribute('look-at', '[camera]'); // Toujours face à la caméra
      
      // Ajouter un fond pour meilleure lisibilité
      textEl.setAttribute('font', 'mozillavr');
      
      floatingText.appendChild(textEl);
      this.el.sceneEl.appendChild(floatingText);
      
      // Animation de montée et disparition
      let elapsed = 0;
      const duration = 1500; // 1.5 secondes
      const startY = worldPos.y + 0.3;
      const endY = worldPos.y + 1.2;
      
      const animate = () => {
        elapsed += 16;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing ease-out
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        // Monter le texte
        const newY = startY + (endY - startY) * easeOut;
        floatingText.setAttribute('position', {
          x: worldPos.x,
          y: newY,
          z: worldPos.z
        });
        
        // Fade out progressif (à partir de 50%)
        if (progress > 0.5) {
          const fadeProgress = (progress - 0.5) * 2;
          const opacity = 1 - fadeProgress;
          textEl.setAttribute('opacity', opacity);
        }
        
        // Scale up puis down
        let scaleMultiplier = 1;
        if (progress < 0.2) {
          scaleMultiplier = 1 + (progress / 0.2) * 0.3; // Grandir de 30%
        } else if (progress < 0.4) {
          scaleMultiplier = 1.3 - ((progress - 0.2) / 0.2) * 0.3; // Revenir à la normale
        }
        
        textEl.setAttribute('scale', `${textSize * scaleMultiplier} ${textSize * scaleMultiplier} ${textSize * scaleMultiplier}`);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Supprimer l'élément
          if (floatingText.parentNode) {
            floatingText.parentNode.removeChild(floatingText);
          }
        }
      };
      
      animate();
      
      console.log(`✓ Hit feedback: +${points} points in ${zone} zone`);
      
    } catch (e) {
      console.error('Floating text error:', e);
      console.log(`✓ Hit feedback: +${points} points in ${zone} zone`);
    }
  },

  destroy: function (lastPoints) {
    console.log('🎉 Cible détruite!')
    
    // Récupérer la position pour les effets visuels
    const worldPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(worldPos);
    
    // Créer l'effet de destruction (particules + texte)
    this.createDestroyEffect(worldPos, lastPoints);
    
    // Supprimer toutes les flèches plantées dans cette cible
    this.arrowElements.forEach(arrow => {
      if (arrow && arrow.parentNode) {
        arrow.parentNode.removeChild(arrow)
      }
    })
    this.arrowElements = []
    
    try {
      // Animation de destruction simplifiée
      let elapsed = 0
      const duration = 400
      const startScale = this.el.getAttribute('scale')
      const startRotation = this.el.getAttribute('rotation')
      
      const animateDestroy = () => {
        elapsed += 16
        const progress = Math.min(elapsed / duration, 1)
        
        // Scale to 0
        this.el.setAttribute('scale', `${startScale.x * (1 - progress)} ${startScale.y * (1 - progress)} ${startScale.z * (1 - progress)}`)
        
        // Rotation
        this.el.setAttribute('rotation', `${startRotation.x} ${startRotation.y + (progress * 360)} ${startRotation.z}`)
        
        if (progress < 1) {
          requestAnimationFrame(animateDestroy)
        }
      }
      
      animateDestroy()
    } catch (e) {
      console.error('Destroy animation error:', e)
    }

    // Émettre événement de destruction
    try {
      this.el.sceneEl.emit('target-destroyed', {
        points: this.data.points,
        totalHits: this.hitCount,
        bonusPoints: Math.floor(lastPoints * 0.5),
        surfaceType: this.surfaceType,
        targetId: this.el.id
      })
    } catch (e) {
      console.error('Event emission error:', e)
    }

    // Supprimer après l'animation
    setTimeout(() => {
      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el)
      }
    }, 450)
  },
  
  createDestroyEffect: function(worldPos, points) {
    try {
      // Créer un container pour l'effet
      const effectContainer = document.createElement('a-entity');
      effectContainer.setAttribute('position', worldPos);
      this.el.sceneEl.appendChild(effectContainer);
      
      // Texte "DÉTRUIT!" avec animation
      const destroyText = document.createElement('a-text');
      destroyText.setAttribute('value', `💥 DÉTRUIT! +${Math.floor(points * 0.5)} BONUS`);
      destroyText.setAttribute('color', '#FF4444');
      destroyText.setAttribute('align', 'center');
      destroyText.setAttribute('scale', '0.4 0.4 0.4');
      destroyText.setAttribute('position', '0 0.5 0');
      destroyText.setAttribute('look-at', '[camera]');
      destroyText.setAttribute('font', 'mozillavr');
      effectContainer.appendChild(destroyText);
      
      // Créer des particules qui explosent
      const particleCount = 8;
      const particles = [];
      
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('a-sphere');
        const angle = (i / particleCount) * Math.PI * 2;
        
        // Couleurs variées
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF8C00'];
        const color = colors[i % colors.length];
        
        particle.setAttribute('radius', 0.03 + Math.random() * 0.02);
        particle.setAttribute('color', color);
        particle.setAttribute('position', '0 0 0');
        particle.setAttribute('material', 'shader: flat');
        
        effectContainer.appendChild(particle);
        
        particles.push({
          el: particle,
          vx: Math.cos(angle) * (0.02 + Math.random() * 0.01),
          vy: 0.02 + Math.random() * 0.02,
          vz: Math.sin(angle) * (0.02 + Math.random() * 0.01),
          gravity: 0.001
        });
      }
      
      // Animation des particules et du texte
      let elapsed = 0;
      const duration = 1200;
      
      const animateEffect = () => {
        elapsed += 16;
        const progress = Math.min(elapsed / duration, 1);
        
        // Animer le texte (monte et fade)
        const textY = 0.5 + progress * 0.8;
        destroyText.setAttribute('position', `0 ${textY} 0`);
        
        if (progress > 0.4) {
          const fadeProgress = (progress - 0.4) / 0.6;
          destroyText.setAttribute('opacity', 1 - fadeProgress);
        }
        
        // Scale du texte (pop effect)
        let textScale = 0.4;
        if (progress < 0.15) {
          textScale = 0.4 + (progress / 0.15) * 0.2;
        } else if (progress < 0.3) {
          textScale = 0.6 - ((progress - 0.15) / 0.15) * 0.2;
        }
        destroyText.setAttribute('scale', `${textScale} ${textScale} ${textScale}`);
        
        // Animer les particules
        particles.forEach((p) => {
          if (!p.el.parentNode) return;
          
          const pos = p.el.getAttribute('position');
          p.vy -= p.gravity; // Gravité
          
          p.el.setAttribute('position', {
            x: pos.x + p.vx,
            y: pos.y + p.vy,
            z: pos.z + p.vz
          });
          
          // Fade et shrink
          const particleOpacity = 1 - progress;
          const particleScale = 1 - progress * 0.5;
          p.el.setAttribute('material', 'opacity', particleOpacity);
          p.el.setAttribute('scale', `${particleScale} ${particleScale} ${particleScale}`);
        });
        
        if (progress < 1) {
          requestAnimationFrame(animateEffect);
        } else {
          // Supprimer le container
          if (effectContainer.parentNode) {
            effectContainer.parentNode.removeChild(effectContainer);
          }
        }
      };
      
      animateEffect();
      
    } catch (e) {
      console.error('Destroy effect error:', e);
    }
  },

  setupMovement: function () {
    // Mouvement oscillant pour les cibles mobiles (manuelle, sans A-Frame animation)
    try {
      const basePos = this.el.getAttribute('position')
      const speed = 0.002
      let time = 0
      
      const moveInterval = setInterval(() => {
        if (!this.el || !this.el.parentNode) {
          clearInterval(moveInterval)
          return
        }
        
        time += 16
        const offsetX = Math.sin(time * speed) * 1.5
        const offsetY = Math.cos(time * speed) * 0.5
        const offsetZ = Math.sin(time * speed * 0.5) * 1
        
        this.el.setAttribute('position', `${basePos.x + offsetX} ${basePos.y + offsetY} ${basePos.z + offsetZ}`)
      }, 16)
      
      this.moveInterval = moveInterval
      console.log('🎯 Cible mobile activée')
    } catch (e) {
      console.error('Movement error:', e)
    }
  },

  remove: function () {
    // Nettoyer l'intervalle de mouvement
    if (this.moveInterval) {
      clearInterval(this.moveInterval)
      this.moveInterval = null
    }
  }
})
