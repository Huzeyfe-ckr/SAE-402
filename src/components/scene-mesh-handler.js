/**
 * Composant scene-mesh-handler pour WebXR
 * Gère le Hit Test pour détecter les surfaces réelles
 * et fournit une API simple pour le spawn des cibles
 */

AFRAME.registerComponent("scene-mesh-handler", {
  init: function () {
    this.sceneMeshes = [];
    this.spawnSurfaces = [];
    this.isWebXRSupported = false;
    this.xrSession = null;
    this.xrRefSpace = null;
    this.hitTestSource = null;
    this.detectedSurfaces = [];
    this.lastResultTime = 0;
    this.hasHitTestThisFrame = false;
    this.usesMockSurfaces = false;

    if ("xr" in navigator) {
      this.checkWebXRSupport();
    } else {
      console.log("⚠️ WebXR non disponible sur ce navigateur");
    }
  },

  async checkWebXRSupport() {
    try {
      const isARSupported = await navigator.xr?.isSessionSupported(
        "immersive-ar",
      );
      const isVRSupported = await navigator.xr?.isSessionSupported(
        "immersive-vr",
      );

      this.isWebXRSupported = isARSupported || isVRSupported;

      if (this.isWebXRSupported) {
        console.log(
          `✅ WebXR supporté - AR: ${isARSupported}, VR: ${isVRSupported}`,
        );
        this.setupSceneMeshTracking();
      } else {
        console.log("⚠️ WebXR non supporté sur cet appareil");
      }
    } catch (error) {
      console.log("⚠️ Erreur de vérification WebXR:", error);
    }
  },

  setupSceneMeshTracking: function () {
    const sceneEl = this.el.sceneEl;

    sceneEl.addEventListener("enter-vr", () => {
      console.log("🥽 Entrée en mode VR - Activation du Scene Mesh");
      this.startSceneMeshDetection();
    });

    sceneEl.addEventListener("exit-vr", () => {
      console.log("👋 Sortie du mode VR - Désactivation du Scene Mesh");
      this.stopSceneMeshDetection();
    });
  },

  startSceneMeshDetection: function () {
    const renderer = this.el.sceneEl.renderer;
    this.xrSession = renderer.xr.getSession();
    this.xrRefSpace = renderer.xr.getReferenceSpace();

    if (!this.xrSession) {
      console.warn("⚠️ Session XR non disponible");
      return;
    }

    this.el.sceneEl.emit("scene-mesh-handler-ready", {});

    if (this.xrSession.requestHitTestSource) {
      this.initializeHitTest();
    } else {
      this.trackSceneMeshes();
    }
  },

  async initializeHitTest() {
    try {
      const viewerSpace = await this.xrSession.requestReferenceSpace("viewer");
      this.hitTestSource = await this.xrSession.requestHitTestSource({
        space: viewerSpace,
      });
      console.log("🎯 Hit-test initialisé (viewer space)");
    } catch (error) {
      console.warn("⚠️ Hit-test viewer impossible, fallback local", error);
      try {
        const localSpace = await this.xrSession.requestReferenceSpace("local");
        this.hitTestSource = await this.xrSession.requestHitTestSource({
          space: localSpace,
        });
        console.log("🎯 Hit-test initialisé (local space)");
      } catch (err) {
        console.warn("⚠️ Hit-test indisponible, fallback mock", err);
        this.trackSceneMeshes();
      }
    }
  },

  trackSceneMeshes: function () {
    if (this.hitTestSource) return;

    console.log("⚠️ Hit-test indisponible - Utilisation de surfaces mockées");
    this.usesMockSurfaces = true;
    this.createMockSceneMesh();
  },

  createMockSceneMesh: function () {
    const mockSurfaces = [
      {
        position: "2 1.5 -3",
        rotation: "0 90 0",
        width: 2,
        height: 2,
        label: "Mur droit",
      },
      {
        position: "-2 1.5 -3",
        rotation: "0 -90 0",
        width: 2,
        height: 2,
        label: "Mur gauche",
      },
      {
        position: "0 0 -5",
        rotation: "-90 0 0",
        width: 4,
        height: 4,
        label: "Sol virtuel",
      },
    ];

    mockSurfaces.forEach((surface, index) => {
      const meshEntity = document.createElement("a-plane");
      meshEntity.setAttribute("position", surface.position);
      meshEntity.setAttribute("rotation", surface.rotation);
      meshEntity.setAttribute("width", surface.width);
      meshEntity.setAttribute("height", surface.height);
      meshEntity.setAttribute("material", {
        color: "#4CC3D9",
        opacity: 0.3,
        transparent: true,
        wireframe: true,
      });
      meshEntity.setAttribute("static-body", {
        shape: "box",
      });
      meshEntity.setAttribute("class", "scene-mesh spawn-surface");
      meshEntity.id = `scene-mesh-${index}`;

      this.el.sceneEl.appendChild(meshEntity);
      this.sceneMeshes.push(meshEntity);
      this.spawnSurfaces.push(meshEntity);

      console.log(`✅ Surface détectée ajoutée: ${surface.label}`);
    });

    this.emitSceneMeshUpdate();
  },

  tick: function () {
    this.hasHitTestThisFrame = false;

    if (!this.xrSession || !this.hitTestSource) return;

    const frame = this.el.sceneEl.frame;
    if (!frame) return;

    try {
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);
      if (!hitTestResults || hitTestResults.length === 0) return;

      const hit = hitTestResults[0];
      const pose = hit.getPose(this.xrRefSpace);
      if (!pose) return;

      const pos = pose.transform.position;
      const quat = pose.transform.orientation;

      const position = new THREE.Vector3(pos.x, pos.y, pos.z);
      const quaternion = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);
      const normal = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(quaternion)
        .normalize();

      const surface = {
        position,
        quaternion,
        normal,
        width: 1,
        height: 1,
        stability: 1,
      };

      this.detectedSurfaces.unshift(surface);
      if (this.detectedSurfaces.length > 3) {
        this.detectedSurfaces.pop();
      }

      this.hasHitTestThisFrame = true;
      this.lastResultTime = Date.now();

      this.el.sceneEl.emit("surface-detected", {
        position,
        normal,
        quaternion,
        stability: 1,
        isFloor: normal.y > 0.7,
        isWall: Math.abs(normal.y) < 0.4,
        isCeiling: normal.y < -0.7,
      });
    } catch (error) {
      console.warn("⚠️ Hit-test error:", error.message);
    }
  },

  emitSceneMeshUpdate: function () {
    this.el.sceneEl.emit("scene-mesh-updated", {
      surfaces: this.spawnSurfaces.slice(),
    });
  },

  getDetectedSurface: function () {
    if (this.detectedSurfaces.length === 0) return null;

    const surface = this.detectedSurfaces[0];
    const euler = new THREE.Euler().setFromQuaternion(surface.quaternion);

    return {
      position: surface.position,
      rotation: {
        x: THREE.MathUtils.radToDeg(euler.x),
        y: THREE.MathUtils.radToDeg(euler.y),
        z: THREE.MathUtils.radToDeg(euler.z),
      },
      normal: surface.normal,
      type: Math.abs(surface.normal.y) > 0.7 ? "horizontal" : "vertical",
      isRealSurface: true,
    };
  },

  isHitTestActive: function () {
    if (!this.xrSession || !this.hitTestSource) return false;
    if (this.hasHitTestThisFrame) return true;
    if (!this.lastResultTime) return false;
    return Date.now() - this.lastResultTime < 30000;
  },

  async createAnchor(pose) {
    if (!this.xrSession) return null;

    return new Promise((resolve) => {
      this.xrSession.requestAnimationFrame(async (time, frame) => {
        if (!frame || !frame.createAnchor) {
          resolve(null);
          return;
        }

        try {
          const anchor = await frame.createAnchor(pose, this.xrRefSpace);
          resolve(anchor || null);
        } catch (error) {
          resolve(null);
        }
      });
    });
  },

  deleteAnchor: function (anchor) {
    if (anchor && typeof anchor.delete === "function") {
      anchor.delete();
    }
  },

  stopSceneMeshDetection: function () {
    this.sceneMeshes.forEach((mesh) => {
      if (mesh.parentNode) mesh.parentNode.removeChild(mesh);
    });
    this.sceneMeshes = [];
    this.spawnSurfaces = [];
    this.hitTestSource = null;
    this.xrSession = null;
    this.xrRefSpace = null;
    this.detectedSurfaces = [];
  },

  remove: function () {
    this.stopSceneMeshDetection();
  },
});
