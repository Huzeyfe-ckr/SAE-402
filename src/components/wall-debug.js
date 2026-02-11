/**
 * Composant wall-debug pour visualiser et déboguer les murs
 * Crée une salle carrée avec 4 murs (Nord, Sud, Est, Ouest) qui se touchent
 * Les flèches se plantent sur ces murs et les cibles y spawn
 */

AFRAME.registerComponent("wall-debug", {
  schema: {
    enabled: { type: "boolean", default: true },
    wallColor: { type: "color", default: "#0066FF" },
    wallOpacity: { type: "number", default: 0.7 },
    roomSize: { type: "number", default: 4 }, // Taille de la salle (distance du centre aux murs)
    wallHeight: { type: "number", default: 2.5 }, // Hauteur des murs
    floorY: { type: "number", default: 0 } // Hauteur du sol
  },

  init: function () {
    this.walls = [];
    this.wallData = []; // Données des murs pour le spawn des cibles
    this.wallsCreated = false;
    
    console.log("🔵 Wall Debug System - Salle carrée avec 4 murs");
    
    // Créer les 4 murs au démarrage en VR
    this.el.sceneEl.addEventListener("enter-vr", () => {
      console.log("🔵 Mode VR - Création de la salle carrée");
      setTimeout(() => {
        if (!this.wallsCreated) {
          this.createRoom();
          this.wallsCreated = true;
        }
      }, 500);
    });
  },

  createRoom: function () {
    if (!this.data.enabled) return;
    
    console.log("🔵 Création de la salle carrée...");
    
    const camera = this.el.sceneEl.camera;
    const cameraPos = new THREE.Vector3();
    if (camera) {
      camera.getWorldPosition(cameraPos);
    } else {
      cameraPos.set(0, 1.6, 0);
    }
    
    const roomSize = this.data.roomSize; // Distance du centre aux murs
    const wallWidth = roomSize * 2; // Largeur des murs = taille de la salle
    const height = this.data.wallHeight;
    const floorY = this.data.floorY;
    const centerY = floorY + (height / 2); // Centre vertical des murs
    
    // Centre de la salle = position du joueur (X, Z uniquement)
    const centerX = cameraPos.x;
    const centerZ = cameraPos.z;
    
    console.log(`🔵 Centre de la salle: (${centerX.toFixed(2)}, ${centerZ.toFixed(2)})`);
    console.log(`🔵 Taille de la salle: ${wallWidth}m x ${wallWidth}m, Hauteur: ${height}m`);
    
    // Définition des 4 murs qui forment un carré
    // Les murs ont leur centre sur les bords de la salle
    const wallConfigs = [
      { 
        name: "MUR NORD", 
        position: { x: centerX, y: centerY, z: centerZ - roomSize },
        rotation: { x: 0, y: 0, z: 0 }, // Face vers +Z (vers le joueur)
        width: wallWidth,
        normal: new THREE.Vector3(0, 0, 1)
      },
      { 
        name: "MUR SUD", 
        position: { x: centerX, y: centerY, z: centerZ + roomSize },
        rotation: { x: 0, y: 180, z: 0 }, // Face vers -Z (vers le joueur)
        width: wallWidth,
        normal: new THREE.Vector3(0, 0, -1)
      },
      { 
        name: "MUR EST", 
        position: { x: centerX + roomSize, y: centerY, z: centerZ },
        rotation: { x: 0, y: -90, z: 0 }, // Face vers -X (vers le joueur)
        width: wallWidth,
        normal: new THREE.Vector3(-1, 0, 0)
      },
      { 
        name: "MUR OUEST", 
        position: { x: centerX - roomSize, y: centerY, z: centerZ },
        rotation: { x: 0, y: 90, z: 0 }, // Face vers +X (vers le joueur)
        width: wallWidth,
        normal: new THREE.Vector3(1, 0, 0)
      }
    ];
    
    wallConfigs.forEach((config, index) => {
      const wall = document.createElement("a-plane");
      wall.id = `debug-wall-${config.name.toLowerCase().replace(" ", "-")}`;
      
      // Position
      wall.setAttribute("position", config.position);
      
      // Rotation
      wall.setAttribute("rotation", config.rotation);
      
      // Dimensions - largeur = taille de la salle pour que les murs se touchent
      wall.setAttribute("width", config.width);
      wall.setAttribute("height", height);
      
      // Géométrie pour collision
      wall.setAttribute("geometry", {
        primitive: "plane",
        width: config.width,
        height: height
      });
      
      // Matériau bleu visible
      wall.setAttribute("material", {
        color: this.data.wallColor,
        opacity: this.data.wallOpacity,
        transparent: true,
        side: "double"
      });
      
      // Classes pour la collision et le spawn
      wall.setAttribute("class", "scene-mesh wall-debug-surface collidable spawn-wall");
      
      // Ajouter le label
      const label = document.createElement("a-text");
      label.setAttribute("value", config.name);
      label.setAttribute("color", "#FFFFFF");
      label.setAttribute("align", "center");
      label.setAttribute("scale", "1.5 1.5 1.5");
      label.setAttribute("position", "0 0 0.02");
      wall.appendChild(label);
      
      this.el.sceneEl.appendChild(wall);
      this.walls.push(wall);
      
      // Stocker les données du mur pour le spawn des cibles
      this.wallData.push({
        entity: wall,
        name: config.name,
        position: new THREE.Vector3(config.position.x, config.position.y, config.position.z),
        normal: config.normal,
        width: config.width,
        height: height,
        rotation: config.rotation
      });
      
      console.log(`🔵 ${config.name} créé à (${config.position.x.toFixed(1)}, ${config.position.y.toFixed(1)}, ${config.position.z.toFixed(1)}) - Taille: ${config.width}m x ${height}m`);
    });
    
    console.log("🔵 ✅ Salle carrée créée avec 4 murs qui se touchent!");
    
    // Émettre un événement pour indiquer que les murs sont prêts
    this.el.sceneEl.emit("walls-ready", {
      walls: this.wallData
    });
    
    // Émettre surfaces-detected pour le game-manager
    this.el.sceneEl.emit("surfaces-detected", {
      real: 4,
      mesh: 0,
      hitTest: 0
    });
  },
  
  // Méthode pour obtenir un point de spawn aléatoire sur un mur
  getRandomSpawnPoint: function () {
    if (this.wallData.length === 0) return null;
    
    // Choisir un mur aléatoire
    const wallIndex = Math.floor(Math.random() * this.wallData.length);
    const wall = this.wallData[wallIndex];
    
    // Position aléatoire sur le mur
    const halfWidth = wall.width / 2 * 0.8; // 80% de la largeur pour éviter les bords
    const halfHeight = wall.height / 2 * 0.7; // 70% de la hauteur
    
    const offsetX = (Math.random() - 0.5) * 2 * halfWidth;
    const offsetY = (Math.random() - 0.5) * 2 * halfHeight;
    
    // Calculer la position finale selon l'orientation du mur
    const spawnPos = wall.position.clone();
    
    // Décaler légèrement devant le mur (vers le centre de la salle)
    spawnPos.add(wall.normal.clone().multiplyScalar(0.05));
    
    // Appliquer les offsets selon l'orientation
    if (Math.abs(wall.normal.z) > 0.5) {
      // Mur Nord ou Sud
      spawnPos.x += offsetX;
      spawnPos.y += offsetY;
    } else {
      // Mur Est ou Ouest
      spawnPos.z += offsetX;
      spawnPos.y += offsetY;
    }
    
    // Calculer la rotation pour que la cible fasse face au centre
    const rotation = { ...wall.rotation };
    
    return {
      position: spawnPos,
      rotation: rotation,
      normal: wall.normal,
      wallName: wall.name,
      surfaceType: "vertical",
      isRealSurface: true
    };
  },

  remove: function () {
    // Nettoyer les murs
    this.walls.forEach(wall => {
      if (wall.parentNode) {
        wall.parentNode.removeChild(wall);
      }
    });
    this.walls = [];
    this.wallData = [];
  }
});
