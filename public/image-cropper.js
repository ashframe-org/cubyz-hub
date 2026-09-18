(function (global) {
  "use strict";

  let modalEl = null;
  let styleInjected = false;

  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement("style");
    style.textContent = `
.crop-modal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 3000;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  padding: 1rem;
}
.crop-modal.active { display: flex; }
.crop-box {
  width: 100%;
  max-width: 440px;
  background: var(--card-bg, #222825);
  border: 1px solid var(--border, #333);
  border-radius: var(--radius, 10px);
  padding: 1.25rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-height: calc(100vh - 2rem);
  box-sizing: border-box;
}
.crop-box h2 {
  margin: 0;
  text-align: center;
  color: var(--text, #ddd);
  font-size: 1.05rem;
}
.crop-stage {
  position: relative;
  width: 100%;
  aspect-ratio: var(--crop-aspect, 1 / 1);
  max-height: 60vh;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 8px;
  background: #0b0b0b repeating-conic-gradient(#151515 0% 25%, #0b0b0b 0% 50%) 50% / 20px 20px;
  border: 1px solid var(--border, #333);
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.crop-stage.dragging { cursor: grabbing; }
.crop-stage canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.crop-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.crop-controls label {
  color: var(--text-muted, #999);
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
}
.crop-controls input[type="range"] {
  flex: 1;
  accent-color: var(--accent, #5BA65B);
}
.crop-hint {
  color: var(--text-muted, #999);
  font-size: 0.78rem;
  text-align: center;
  margin: 0;
}
.crop-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
}
.crop-actions .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  min-height: 36px;
  transition: background 0.25s ease, color 0.25s ease, transform 0.25s ease;
}
.crop-actions .btn.primary {
  background: var(--accent, #5BA65B);
  color: #000;
}
.crop-actions .btn.primary:hover {
  background: var(--accent-dark, #CC7F39);
  color: #fff;
}
.crop-actions .btn.secondary {
  background: transparent;
  color: var(--text, #ddd);
  border: 1px solid var(--border, #333);
}
.crop-actions .btn.secondary:hover {
  border-color: var(--accent, #5BA65B);
  color: var(--accent, #5BA65B);
}
@media (max-width: 480px) {
  .crop-box {
    padding: 1rem;
    max-width: 100%;
  }
  .crop-stage {
    max-height: 50vh;
  }
  .crop-actions .btn {
    flex: 1;
  }
}
`;
    document.head.appendChild(style);
  }

  function buildModal() {
    if (modalEl) return modalEl;
    injectStyles();

    modalEl = document.createElement("div");
    modalEl.className = "crop-modal";
    modalEl.innerHTML = `
      <div class="crop-box" role="dialog" aria-modal="true" aria-label="Crop image">
        <h2>Adjust image</h2>
        <div class="crop-stage">
          <canvas></canvas>
        </div>
        <div class="crop-controls">
          <label for="crop-zoom">Zoom</label>
          <input id="crop-zoom" type="range" min="1" max="4" step="0.01" value="1">
        </div>
        <p class="crop-hint">Drag to reposition, use the slider to zoom.</p>
        <div class="crop-actions">
          <button type="button" class="btn secondary" data-action="cancel">Cancel</button>
          <button type="button" class="btn primary" data-action="confirm">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
    return modalEl;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function openImageCropper(file, aspectRatio, onConfirm, options) {
    if (!file) return;
    aspectRatio = aspectRatio || 1;
    options = options || {};

    const isSquare = Math.abs(aspectRatio - 1) < 0.001;
    const outputWidth = options.outputWidth || (isSquare ? 512 : 1280);
    const outputHeight = options.outputHeight || (isSquare ? 512 : 720);
    const quality = options.quality != null ? options.quality : 0.9;

    const modal = buildModal();
    const stage = modal.querySelector(".crop-stage");
    const canvas = modal.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const zoomSlider = modal.querySelector("#crop-zoom");
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const confirmBtn = modal.querySelector('[data-action="confirm"]');

    stage.style.setProperty("--crop-aspect", `${aspectRatio} / 1`);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    let baseScale = 1;
    let scale = 1;
    let minScale = 1;
    let maxScale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let stageW = 0;
    let stageH = 0;

    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOffsetStartX = 0;
    let dragOffsetStartY = 0;
    let activePointerId = null;

    function layoutCanvas() {
      const rect = stage.getBoundingClientRect();
      stageW = rect.width;
      stageH = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(stageW * dpr);
      canvas.height = Math.round(stageH * dpr);
      canvas.style.width = stageW + "px";
      canvas.style.height = stageH + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function computeScaleBounds() {
      baseScale = Math.max(stageW / img.naturalWidth, stageH / img.naturalHeight);
      minScale = baseScale;
      maxScale = baseScale * 4;
    }

    function clampOffsets() {
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const minX = stageW - drawW;
      const minY = stageH - drawH;
      offsetX = clamp(offsetX, minX, 0);
      offsetY = clamp(offsetY, minY, 0);
    }

    function draw() {
      ctx.clearRect(0, 0, stageW, stageH);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    }

    function centerImage() {
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      offsetX = (stageW - drawW) / 2;
      offsetY = (stageH - drawH) / 2;
    }

    function setScale(newScale, anchorX, anchorY) {
      const clamped = clamp(newScale, minScale, maxScale);
      if (anchorX == null) anchorX = stageW / 2;
      if (anchorY == null) anchorY = stageH / 2;
      const imgX = (anchorX - offsetX) / scale;
      const imgY = (anchorY - offsetY) / scale;
      scale = clamped;
      offsetX = anchorX - imgX * scale;
      offsetY = anchorY - imgY * scale;
      clampOffsets();
      draw();
      zoomSlider.value = String(scale / baseScale);
    }

    function onPointerDown(e) {
      dragging = true;
      activePointerId = e.pointerId;
      stage.classList.add("dragging");
      stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragOffsetStartX = offsetX;
      dragOffsetStartY = offsetY;
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== activePointerId) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      offsetX = dragOffsetStartX + dx;
      offsetY = dragOffsetStartY + dy;
      clampOffsets();
      draw();
    }

    function onPointerUp(e) {
      if (e.pointerId !== activePointerId) return;
      dragging = false;
      activePointerId = null;
      stage.classList.remove("dragging");
    }

    function onWheel(e) {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const anchorY = e.clientY - rect.top;
      const delta = -e.deltaY * 0.0015;
      setScale(scale * (1 + delta), anchorX, anchorY);
    }

    function onSliderInput() {
      const ratio = parseFloat(zoomSlider.value) || 1;
      setScale(baseScale * ratio);
    }

    function cleanup() {
      modal.classList.remove("active");
      URL.revokeObjectURL(objectUrl);
      stage.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      stage.removeEventListener("wheel", onWheel);
      zoomSlider.removeEventListener("input", onSliderInput);
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirmClick);
      window.removeEventListener("resize", onResize);
    }

    function onCancel() {
      cleanup();
    }

    function onConfirmClick() {
      const outCanvas = document.createElement("canvas");
      outCanvas.width = outputWidth;
      outCanvas.height = outputHeight;
      const outCtx = outCanvas.getContext("2d");

      const sx = outputWidth / stageW;
      const sy = outputHeight / stageH;

      outCtx.drawImage(
        img,
        0, 0, img.naturalWidth, img.naturalHeight,
        offsetX * sx, offsetY * sy,
        img.naturalWidth * scale * sx, img.naturalHeight * scale * sy
      );

      outCanvas.toBlob((blob) => {
        if (!blob) { cleanup(); return; }
        const dot = file.name ? file.name.lastIndexOf(".") : -1;
        const baseName = dot > -1 ? file.name.substring(0, dot) : (file.name || "image");
        const croppedFile = new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        cleanup();
        onConfirm(croppedFile);
      }, "image/jpeg", quality);
    }

    function onResize() {
      layoutCanvas();
      computeScaleBounds();
      scale = clamp(scale, minScale, maxScale);
      clampOffsets();
      draw();
    }

    img.onload = () => {
      modal.classList.add("active");
      requestAnimationFrame(() => {
        layoutCanvas();
        computeScaleBounds();
        scale = minScale;
        zoomSlider.min = "1";
        zoomSlider.max = "4";
        zoomSlider.value = "1";
        centerImage();
        draw();
      });
    };
    img.onerror = () => {
      cleanup();
    };
    img.src = objectUrl;

    stage.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    stage.addEventListener("wheel", onWheel, { passive: false });
    zoomSlider.addEventListener("input", onSliderInput);
    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirmClick);
    window.addEventListener("resize", onResize);
  }

  global.openImageCropper = openImageCropper;
})(window);
