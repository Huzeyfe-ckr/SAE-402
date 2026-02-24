/**
 * Debug component pour inspecter les animations d'un modèle GLTF
 * Affiche toutes les animations disponibles dans la console
 */

AFRAME.registerComponent('model-debug', {
  schema: {
    verbose: { type: 'boolean', default: true }
  },

  init: function () {
    console.log(`🔍 [model-debug] Component INIT sur entity: ${this.el.id}`);
    
    // Estratégie 1: Écouter model-loaded
    this.el.addEventListener('model-loaded', (evt) => {
      console.log(`📌 [model-debug] EVENT 'model-loaded' déclenché!`);
      setTimeout(() => this.inspectModel(), 50);
    });
    
    // Stratégie 2: Vérifier le mesh toutes les 500ms pendant 5s
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      const model = this.el.getObject3D('mesh');
      
      if (model) {
        console.log(`✅ [model-debug] Mesh trouvé à l'attempt ${attempts}!`);
        clearInterval(checkInterval);
        this.inspectModel();
      } else if (attempts >= 10) {
        console.warn(`⚠️ [model-debug] Mesh NOT trouvé après 5s pour ${this.el.id}`);
        clearInterval(checkInterval);
      }
    }, 500);
  },

  inspectModel: function () {
    const model = this.el.getObject3D('mesh');
    
    let output = `\n${'═'.repeat(60)}\n`;
    output += `🔍 [model-debug] ========= ANIMATION ANALYZER =========\n`;
    output += `   Entity: ${this.el.id}\n`;
    
    if (!model) {
      output += `❌ ERREUR: getObject3D('mesh') retourne null!\n`;
      output += `${'═'.repeat(60)}\n`;
      console.log(output);
      return;
    }

    output += `✅ Model trouvé: ${model.type}\n`;
    output += `   model.animations: ${model.animations ? model.animations.length : 'undefined'} clip(s)\n`;

    if (model.animations && model.animations.length > 0) {
      output += `\n✅ ANIMATIONS DANS LE ROOT:\n`;
      for (let i = 0; i < model.animations.length; i++) {
        const clip = model.animations[i];
        output += `   [${i}] "${clip.name}" | ${clip.duration}s | ${clip.tracks.length} tracks\n`;
      }
    }

    // Chercher dans les enfants
    output += `\n🔍 Children avec animations:\n`;
    let childCount = 0;
    model.traverse((child) => {
      if (child !== model && child.animations && child.animations.length > 0) {
        childCount++;
        output += `   ✅ "${child.name}": ${child.animations.length} clip(s)\n`;
        for (let i = 0; i < child.animations.length; i++) {
          const clip = child.animations[i];
          output += `      [${i}] "${clip.name}" | ${clip.duration}s\n`;
        }
      }
    });
    
    if (childCount === 0) {
      output += `   (aucun enfant avec animations)\n`;
    }

    if ((!model.animations || model.animations.length === 0) && childCount === 0) {
      output += `\n⚠️ AUCUNE ANIMATION TROUVÉE!\n`;
    }

    output += `\n${'═'.repeat(60)}\n`;
    console.log(output);
  }
});
