/**
 * Composant webxr-anchor-manager pour A-Frame
 * Gère le cycle de vie des anchors WebXR
 */

AFRAME.registerComponent("webxr-anchor-manager", {
  schema: {
    maxAnchors: { type: "number", default: 30 },
    autoCleanup: { type: "boolean", default: true },
    cleanupInterval: { type: "number", default: 5000 },
  },

  init: function () {
    this.anchors = new Map();
    this.anchoredEntities = new Map();
    this.sceneMeshHandler = null;
    this.cleanupTimer = null;

    this.el.sceneEl.addEventListener("enter-vr", () => this.onEnterVR());
    this.el.sceneEl.addEventListener("exit-vr", () => this.onExitVR());

  },

  onEnterVR: function () {
    const sceneMeshEntity = this.el.sceneEl.querySelector("[scene-mesh-handler]");
    if (sceneMeshEntity && sceneMeshEntity.components["scene-mesh-handler"]) {
      this.sceneMeshHandler = sceneMeshEntity.components["scene-mesh-handler"];
    }

    if (this.data.autoCleanup) {
      this.startAutoCleanup();
    }

    this.el.sceneEl.emit("anchor-manager-ready");
  },

  onExitVR: function () {
    this.cleanup();
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  },

  createAnchor: async function (pose) {
    if (!this.sceneMeshHandler) return null;

    if (this.anchors.size >= this.data.maxAnchors) {
      const firstKey = this.anchors.keys().next().value;
      this.deleteAnchor(firstKey);
    }

    let xrPose = pose;
    if (pose && pose.position && pose.quaternion) {
      xrPose = new XRRigidTransform(
        { x: pose.position.x, y: pose.position.y, z: pose.position.z },
        {
          x: pose.quaternion.x,
          y: pose.quaternion.y,
          z: pose.quaternion.z,
          w: pose.quaternion.w,
        },
      );
    }

    const anchor = await this.sceneMeshHandler.createAnchor(xrPose);
    if (!anchor) return null;

    const anchorId = `anchor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    anchor.id = anchorId;
    this.anchors.set(anchorId, anchor);

    this.el.sceneEl.emit("anchor-created", { anchorId, position: pose.position, quaternion: pose.quaternion });

    return anchorId;
  },

  attachToAnchor: function (entity, anchorId) {
    if (!this.anchors.has(anchorId)) return false;

    const entityId = entity.id || `entity-${Date.now()}`;
    entity.id = entityId;

    entity.setAttribute("data-anchor-id", anchorId);
    this.anchoredEntities.set(entityId, anchorId);

    const anchor = this.anchors.get(anchorId);
    if (anchor) {
      this.updateEntityFromAnchor(entity, anchor);
    }

    return true;
  },

  updateEntityFromAnchor: function (entity, anchor) {
    if (!anchor || !anchor.anchorSpace) return false;

    const frame = this.el.sceneEl.frame;
    if (!frame) return false;

    const xrRefSpace = this.el.sceneEl.renderer?.xr?.getReferenceSpace();
    if (!xrRefSpace) return false;

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace);
    if (!anchorPose) return false;

    const pos = anchorPose.transform.position;
    const quat = anchorPose.transform.orientation;
    entity.object3D.position.set(pos.x, pos.y, pos.z);
    entity.object3D.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    return true;
  },

  deleteAnchor: function (anchorId) {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return false;

    if (this.sceneMeshHandler) {
      this.sceneMeshHandler.deleteAnchor(anchor);
    }

    this.anchors.delete(anchorId);
    for (const [entityId, aId] of this.anchoredEntities.entries()) {
      if (aId === anchorId) {
        const entity = document.getElementById(entityId);
        if (entity) entity.removeAttribute("data-anchor-id");
        this.anchoredEntities.delete(entityId);
      }
    }

    return true;
  },

  startAutoCleanup: function () {
    this.cleanupTimer = setInterval(() => {
      for (const [entityId] of this.anchoredEntities.entries()) {
        const entity = document.getElementById(entityId);
        if (!entity) {
          this.anchoredEntities.delete(entityId);
        }
      }
    }, this.data.cleanupInterval);
  },

  cleanup: function () {
    for (const [anchorId, anchor] of this.anchors.entries()) {
      if (this.sceneMeshHandler) {
        this.sceneMeshHandler.deleteAnchor(anchor);
      }
      this.anchors.delete(anchorId);
    }
    this.anchoredEntities.clear();
  },

  tick: function () {
    if (!this.sceneMeshHandler || this.anchoredEntities.size === 0) return;

    const frame = this.el.sceneEl.frame;
    if (!frame) return;

    for (const [entityId, anchorId] of this.anchoredEntities.entries()) {
      const entity = document.getElementById(entityId);
      const anchor = this.anchors.get(anchorId);
      if (!entity || !anchor) continue;
      this.updateEntityFromAnchor(entity, anchor);
    }
  },
});
