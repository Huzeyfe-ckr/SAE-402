/**
 * Composant surface-detector pour A-Frame
 * Détecte les surfaces (horizontales/verticales) pour le spawn de cibles
 * Priorise les surfaces réelles issues du hit-test
 */

AFRAME.registerComponent("surface-detector", {
  schema: {
    enabled: { type: "boolean", default: true },
    debugMode: { type: "boolean", default: false },
    defaultTargetHeight: { type: "number", default: 0.5 },
    maxDistance: { type: "number", default: 10 },
    minSurfaceArea: { type: "number", default: 0.25 },
    stabilityFrames: { type: "number", default: 3 },
    allowFallback: { type: "boolean", default: false },
    visualizeSurfaces: { type: "boolean", default: false },
  },

  init: function () {
    this.surfaces = { horizontal: [], vertical: [] };
    this.surfaceHistory = new Map();
    this.realSurfaceMap = new Map();
    this.realSurfacesEnabled = false;
    this.pendingDetect = null;

    this.el.sceneEl.addEventListener("surface-detected", (evt) => {
      this.onRealSurfaceDetected(evt.detail);
    });

    this.el.sceneEl.addEventListener("scene-mesh-handler-ready", () => {
      this.realSurfacesEnabled = true;
    });

    if (this.el.sceneEl.hasLoaded) {
      this.initializeSurfaceDetection();
    } else {
      this.el.sceneEl.addEventListener("loaded", () => {
        this.initializeSurfaceDetection();
      });
    }

  },

  initializeSurfaceDetection: function () {
    this.detectSurfaces();
  },

  onRealSurfaceDetected: function (surfaceData) {
    if (!this.data.enabled || !surfaceData) return;

    const key = this.getSurfaceKey(surfaceData.position);
    const position = new THREE.Vector3(
      surfaceData.position.x,
      surfaceData.position.y,
      surfaceData.position.z,
    );
    const quaternion = new THREE.Quaternion(
      surfaceData.quaternion.x,
      surfaceData.quaternion.y,
      surfaceData.quaternion.z,
      surfaceData.quaternion.w,
    );
    const normal = new THREE.Vector3(
      surfaceData.normal.x,
      surfaceData.normal.y,
      surfaceData.normal.z,
    ).normalize();

    const surface = {
      position,
      quaternion,
      normal,
      width: surfaceData.width || 1,
      height: surfaceData.height || 1,
      isRealSurface: true,
      stability: surfaceData.stability || 1,
    };

    this.realSurfaceMap.set(key, surface);
    this.updateSurfaceStability(key, surface);

    if (!this.pendingDetect) {
      this.pendingDetect = setTimeout(() => {
        this.detectSurfaces();
        this.pendingDetect = null;
      }, 100);
    }
  },

  detectSurfaces: function () {
    if (!this.data.enabled) return;

    this.surfaces.horizontal = [];
    this.surfaces.vertical = [];

    let realCount = 0;
    if (this.realSurfacesEnabled && this.realSurfaceMap.size > 0) {
      for (const surface of this.realSurfaceMap.values()) {
        const classified = this.classifySurface(surface);
        if (classified) {
          this.surfaces[classified.type].push(classified);
          realCount++;
        }
      }
    }

    if (this.data.allowFallback) {
      this.el.sceneEl.object3D.traverse((object) => {
        const el = object.el;
        if (!el || !el.getAttribute) return;

        if (!el.classList.contains("scene-mesh")) return;

        const geometry = el.getAttribute("geometry") || {};
        const width = el.getAttribute("width") || geometry.width || 1;
        const height = el.getAttribute("height") || geometry.height || 1;

        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        el.object3D.getWorldPosition(worldPos);
        el.object3D.getWorldQuaternion(worldQuat);

        const normal = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(worldQuat)
          .normalize();

        const surface = {
          position: worldPos,
          quaternion: worldQuat,
          normal,
          width,
          height,
          isRealSurface: false,
          stability: 0,
        };

        const classified = this.classifySurface(surface);
        if (classified) {
          this.surfaces[classified.type].push(classified);
        }
      });
    }

    this.el.sceneEl.emit("surfaces-detected", {
      horizontal: this.surfaces.horizontal.length,
      vertical: this.surfaces.vertical.length,
      real: realCount,
      hitTest: realCount,
      mesh: 0,
      mock:
        this.surfaces.horizontal.length +
        this.surfaces.vertical.length -
        realCount,
    });
  },

  classifySurface: function (surface) {
    const normal = surface.normal.clone().normalize();
    const isHorizontal = Math.abs(normal.y) > 0.7;
    const type = isHorizontal ? "horizontal" : "vertical";

    const cameraPos = this.el.sceneEl.camera
      ? this.el.sceneEl.camera.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3(0, 1.6, 0);

    const validation = this.validateSurface(surface, cameraPos);
    if (!validation.valid) {
      return null;
    }

    return {
      ...surface,
      type,
      outwardNormal: normal,
      worldPosition: surface.position,
      worldQuaternion: surface.quaternion,
    };
  },

  validateSurface: function (surface, cameraPos) {
    const distance = cameraPos.distanceTo(surface.position);
    if (distance > this.data.maxDistance) {
      return { valid: false, reason: "distance" };
    }

    const width = surface.width || 1;
    const height = surface.height || 1;
    const area = width * height;
    if (area < this.data.minSurfaceArea) {
      return { valid: false, reason: "area" };
    }

    const key = this.getSurfaceKey(surface.position);
    const stability = this.getSurfaceStability(key);
    if (surface.isRealSurface && stability < this.data.stabilityFrames) {
      return { valid: false, reason: "stability" };
    }

    return { valid: true };
  },

  updateSurfaceStability: function (key, surface) {
    const now = Date.now();
    if (!this.surfaceHistory.has(key)) {
      this.surfaceHistory.set(key, {
        count: 1,
        lastSeen: now,
        surface,
      });
    } else {
      const entry = this.surfaceHistory.get(key);
      entry.count += 1;
      entry.lastSeen = now;
      entry.surface = surface;
    }

    for (const [k, entry] of this.surfaceHistory.entries()) {
      if (now - entry.lastSeen > 3000) {
        this.surfaceHistory.delete(k);
      }
    }
  },

  getSurfaceStability: function (key) {
    const entry = this.surfaceHistory.get(key);
    return entry ? entry.count : 0;
  },

  getSurfaceKey: function (position) {
    return `${Math.round(position.x * 10)}-${Math.round(position.y * 10)}-${Math.round(position.z * 10)}`;
  },

  getRandomSpawnPoint: function () {
    const total =
      this.surfaces.horizontal.length + this.surfaces.vertical.length;
    if (total === 0) return null;

    // Privilégier les surfaces verticales (murs) avec 80% de chance
    const useVertical = this.surfaces.vertical.length > 0 && Math.random() < 0.8;

    return useVertical
      ? this.getRandomVerticalSpawnPoint()
      : this.getRandomHorizontalSpawnPoint();
  },

  getRandomHorizontalSpawnPoint: function () {
    if (this.surfaces.horizontal.length === 0) return null;

    const surface = this.surfaces.horizontal[0];
    const normal = surface.outwardNormal || new THREE.Vector3(0, 1, 0);
    const position = surface.position.clone();

    const offsetX = (Math.random() - 0.5) * (surface.width || 2) * 0.6;
    const offsetZ = (Math.random() - 0.5) * (surface.height || 2) * 0.6;
    position.x += offsetX;
    position.z += offsetZ;

    const isCeiling = normal.y < -0.5;
    if (isCeiling) {
      position.add(normal.clone().multiplyScalar(0.5));
    } else {
      position.y += this.data.defaultTargetHeight;
    }

    const camera = this.el.sceneEl.camera;
    const cameraPos = camera
      ? camera.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3(0, 1.6, 0);

    const tempObj = new THREE.Object3D();
    tempObj.position.copy(position);
    tempObj.lookAt(cameraPos);

    return {
      position,
      rotation: {
        x: 0,
        y: THREE.MathUtils.radToDeg(tempObj.rotation.y),
        z: 0,
      },
      surfaceType: "horizontal",
      isRealSurface: surface.isRealSurface || false,
      stability: surface.stability || 0,
      normal,
    };
  },

  getRandomVerticalSpawnPoint: function () {
    if (this.surfaces.vertical.length === 0) return null;

    const surface = this.surfaces.vertical[0];
    const normal = surface.outwardNormal || new THREE.Vector3(0, 0, 1);
    const position = surface.position.clone();

    const offsetY = (Math.random() - 0.5) * (surface.height || 2) * 0.6;
    const offsetX = (Math.random() - 0.5) * (surface.width || 2) * 0.6;

    const perpendicular = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
    position.add(perpendicular.multiplyScalar(offsetX));
    position.y += offsetY;

    position.add(normal.clone().multiplyScalar(0.2));

    const qAlign = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      normal.clone().normalize(),
    );
    const eAlign = new THREE.Euler().setFromQuaternion(qAlign, "XYZ");

    return {
      position,
      rotation: {
        x: THREE.MathUtils.radToDeg(eAlign.x),
        y: THREE.MathUtils.radToDeg(eAlign.y),
        z: THREE.MathUtils.radToDeg(eAlign.z),
      },
      surfaceType: "vertical",
      isRealSurface: surface.isRealSurface || false,
      stability: surface.stability || 0,
      normal,
    };
  },
});
