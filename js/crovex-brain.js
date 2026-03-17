// js/crovex-brain.js
// Shared CROVEX brain animation engine
(function () {
  const CANVAS_ID = 'crovexBrain';
  const ASSET_PATH = 'Image/';
  const BRAIN_IMG = ASSET_PATH + 'brain-full.jpeg';
  const CHIP_MASK_IMG = ASSET_PATH + 'chip-masks.png';
  const AI_MASK_IMG = ASSET_PATH + 'ai-brain-masks.png';
  const NERVE_MASK_IMG = ASSET_PATH + 'nerve-masks.png';

  // Timing (seconds)
  const LOOP_DURATION = 2.4;
  const CHIP_FLASH_END = 0.2;
  const DIGITAL_PULSE_END = 1.0;
  const BIO_PULSE_END = 1.4;

  // Colors
  const CHIP_FLASH_COLOR = 'rgba(0,255,255,1)';
  const DIGITAL_PULSE_COLOR = 'rgba(0,255,180,1)';
  const BIO_PULSE_COLOR = 'rgba(255,80,180,1)';
  const AI_GLOW_COLOR = 'rgba(0,180,255,0.4)';

  // Chip origin in mask coordinates (1024x1024)
  const MASK_SIZE = 1024;
  const CHIP_ORIGIN = { x: 760, y: 260 };

  // Ensure canvas exists
  let canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    document.body.appendChild(canvas);
  }
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '-5';
  canvas.setAttribute('aria-hidden', 'true');

  const ctx = canvas.getContext('2d');

  // Offscreen canvases for masks and temp drawing
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  const maskCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const aiMaskCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const nerveMaskCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const tempCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const tempCtx = tempCanvas.getContext('2d');
  // Pre-allocated layer canvases reused every frame to avoid GC pressure
  const aiLayerCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const aiLayerCtx = aiLayerCanvas.getContext('2d');
  const pulseLayerCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const pulseLayerCtx = pulseLayerCanvas.getContext('2d');

  // Load images
  const brainImg = new Image();
  const chipMaskImg = new Image();
  const aiMaskImg = new Image();
  const nerveMaskImg = new Image();

  brainImg.src = BRAIN_IMG;
  chipMaskImg.src = CHIP_MASK_IMG;
  aiMaskImg.src = AI_MASK_IMG;
  nerveMaskImg.src = NERVE_MASK_IMG;

  let loaded = 0;
  function onAssetLoad() {
    loaded++;
    if (loaded === 4) init();
  }

  brainImg.onload = onAssetLoad;
  chipMaskImg.onload = onAssetLoad;
  aiMaskImg.onload = onAssetLoad;
  nerveMaskImg.onload = onAssetLoad;
  // Treat failed loads as loaded so the animation still starts (without masks)
  brainImg.onerror = onAssetLoad;
  chipMaskImg.onerror = onAssetLoad;
  aiMaskImg.onerror = onAssetLoad;
  nerveMaskImg.onerror = onAssetLoad;

  // Draw masks into offscreen canvases at mask resolution
  function prepareMasks() {
    const mctx = maskCanvas.getContext('2d');
    mctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    mctx.drawImage(chipMaskImg, 0, 0, MASK_SIZE, MASK_SIZE);

    const actx = aiMaskCanvas.getContext('2d');
    actx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    actx.drawImage(aiMaskImg, 0, 0, MASK_SIZE, MASK_SIZE);

    const nctx = nerveMaskCanvas.getContext('2d');
    nctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    nctx.drawImage(nerveMaskImg, 0, 0, MASK_SIZE, MASK_SIZE);
  }

  // Resize handling with DPR
  function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Utility: draw a radial gradient masked by a mask canvas
  function drawMaskedRadial(maskSourceCanvas, origin, innerR, outerR, colorStops) {
    tempCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);

    const g = tempCtx.createRadialGradient(origin.x, origin.y, innerR, origin.x, origin.y, outerR);
    for (const stop of colorStops) g.addColorStop(stop[0], stop[1]);
    tempCtx.fillStyle = g;
    tempCtx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);

    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(maskSourceCanvas, 0, 0);
    tempCtx.globalCompositeOperation = 'source-over';
  }

  // Draw the composed tempCanvas scaled to full screen
  function drawTempToScreen() {
    // Draw brain background first (scaled to cover)
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    // Clear screen
    ctx.clearRect(0, 0, w, h);

    // Draw brain image as fallback/background (cover)
    const img = brainImg;
    if (img && img.complete) {
      const imgRatio = img.width / img.height;
      const screenRatio = w / h;
      let dw, dh, dx, dy;
      if (imgRatio > screenRatio) {
        dh = h;
        dw = imgRatio * dh;
        dx = (w - dw) / 2;
        dy = 0;
      } else {
        dw = w;
        dh = dw / imgRatio;
        dx = 0;
        dy = (h - dh) / 2;
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    // Now draw tempCanvas (mask-based effects) scaled from MASK_SIZE -> screen
    ctx.drawImage(tempCanvas, 0, 0, MASK_SIZE, MASK_SIZE, 0, 0, w, h);
  }

  // Effect implementations (operate in mask coordinate space)
  function chipFlashEffect(t) {
    const p = Math.min(1, t / CHIP_FLASH_END);
    const alpha = 1 - p;

    const r = 40 + p * 30;
    const color = CHIP_FLASH_COLOR.replace('1)', alpha.toFixed(3) + ')');

    drawMaskedRadial(maskCanvas, CHIP_ORIGIN, 0, r, [
      [0, color],
      [1, 'rgba(0,0,0,0)']
    ]);
  }

  function digitalPulseEffect(t) {
    const p = Math.max(0, Math.min(1, (t - CHIP_FLASH_END) / (DIGITAL_PULSE_END - CHIP_FLASH_END)));
    const alpha = 1 - p;
    const maxR = Math.max(MASK_SIZE, MASK_SIZE);
    const r = 40 + p * maxR;
    const color = DIGITAL_PULSE_COLOR.replace('1)', alpha.toFixed(3) + ')');

    drawMaskedRadial(maskCanvas, CHIP_ORIGIN, r * 0.2, r, [
      [0, 'rgba(0,0,0,0)'],
      [0.3, color],
      [1, 'rgba(0,0,0,0)']
    ]);
  }

  function bioPulseEffect(t) {
    const p = Math.max(0, Math.min(1, (t - CHIP_FLASH_END) / (BIO_PULSE_END - CHIP_FLASH_END)));
    const alpha = 1 - p;
    const maxR = Math.max(MASK_SIZE, MASK_SIZE) * 1.2;
    const r = 20 + p * maxR;
    const color = BIO_PULSE_COLOR.replace('1)', alpha.toFixed(3) + ')');

    drawMaskedRadial(nerveMaskCanvas, CHIP_ORIGIN, r * 0.1, r, [
      [0, 'rgba(0,0,0,0)'],
      [0.25, color],
      [1, 'rgba(0,0,0,0)']
    ]);
  }

  function aiGlowEffect(t) {
    const p = (t % LOOP_DURATION) / LOOP_DURATION;
    const alpha = 0.3 + Math.sin(p * Math.PI * 2) * 0.2;
    const color = AI_GLOW_COLOR.replace('0.4', alpha.toFixed(3));

    tempCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    tempCtx.fillStyle = color;
    tempCtx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);

    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(aiMaskCanvas, 0, 0);
    tempCtx.globalCompositeOperation = 'source-over';
  }

  // Compose multiple effects into tempCanvas before scaling to screen
  function composeFrame(t) {
    tempCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);

    // Layer 1: AI glow (uses pre-allocated aiLayerCanvas)
    aiLayerCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    const p = (t % LOOP_DURATION) / LOOP_DURATION;
    const alpha = 0.3 + Math.sin(p * Math.PI * 2) * 0.2;
    aiLayerCtx.fillStyle = AI_GLOW_COLOR.replace('0.4', alpha.toFixed(3));
    aiLayerCtx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    aiLayerCtx.globalCompositeOperation = 'destination-in';
    aiLayerCtx.drawImage(aiMaskCanvas, 0, 0);
    aiLayerCtx.globalCompositeOperation = 'source-over';
    tempCtx.drawImage(aiLayerCanvas, 0, 0);

    // Layer 2: chip flash / digital / bio pulses (uses pre-allocated pulseLayerCanvas)
    if (t <= CHIP_FLASH_END) {
      pulseLayerCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
      const p1 = t / CHIP_FLASH_END;
      const alpha1 = 1 - p1;
      const r1 = 40 + p1 * 30;
      const g1 = pulseLayerCtx.createRadialGradient(CHIP_ORIGIN.x, CHIP_ORIGIN.y, 0, CHIP_ORIGIN.x, CHIP_ORIGIN.y, r1);
      g1.addColorStop(0, CHIP_FLASH_COLOR.replace('1)', alpha1.toFixed(3) + ')'));
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      pulseLayerCtx.fillStyle = g1;
      pulseLayerCtx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
      pulseLayerCtx.globalCompositeOperation = 'destination-in';
      pulseLayerCtx.drawImage(maskCanvas, 0, 0);
      pulseLayerCtx.globalCompositeOperation = 'source-over';
      tempCtx.drawImage(pulseLayerCanvas, 0, 0);
    }

    if (t > CHIP_FLASH_END && t <= DIGITAL_PULSE_END) {
      pulseLayerCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
      const p2 = (t - CHIP_FLASH_END) / (DIGITAL_PULSE_END - CHIP_FLASH_END);
      const alpha2 = 1 - p2;
      const r2 = 40 + p2 * MASK_SIZE;
      const g2 = pulseLayerCtx.createRadialGradient(CHIP_ORIGIN.x, CHIP_ORIGIN.y, r2 * 0.2, CHIP_ORIGIN.x, CHIP_ORIGIN.y, r2);
      g2.addColorStop(0, 'rgba(0,0,0,0)');
      g2.addColorStop(0.3, DIGITAL_PULSE_COLOR.replace('1)', alpha2.toFixed(3) + ')'));
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      pulseLayerCtx.fillStyle = g2;
      pulseLayerCtx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
      pulseLayerCtx.globalCompositeOperation = 'destination-in';
      pulseLayerCtx.drawImage(maskCanvas, 0, 0);
      pulseLayerCtx.globalCompositeOperation = 'source-over';
      tempCtx.drawImage(pulseLayerCanvas, 0, 0);
    }

    if (t > CHIP_FLASH_END && t <= BIO_PULSE_END) {
      pulseLayerCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
      const p3 = (t - CHIP_FLASH_END) / (BIO_PULSE_END - CHIP_FLASH_END);
      const alpha3 = 1 - p3;
      const r3 = 20 + p3 * MASK_SIZE * 1.2;
      const g3 = pulseLayerCtx.createRadialGradient(CHIP_ORIGIN.x, CHIP_ORIGIN.y, r3 * 0.1, CHIP_ORIGIN.x, CHIP_ORIGIN.y, r3);
      g3.addColorStop(0, 'rgba(0,0,0,0)');
      g3.addColorStop(0.25, BIO_PULSE_COLOR.replace('1)', alpha3.toFixed(3) + ')'));
      g3.addColorStop(1, 'rgba(0,0,0,0)');
      pulseLayerCtx.fillStyle = g3;
      pulseLayerCtx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
      pulseLayerCtx.globalCompositeOperation = 'destination-in';
      pulseLayerCtx.drawImage(nerveMaskCanvas, 0, 0);
      pulseLayerCtx.globalCompositeOperation = 'source-over';
      tempCtx.drawImage(pulseLayerCanvas, 0, 0);
    }
  }

  // Main loop
  let start = null;
  function frame(ts) {
    if (!start) start = ts;
    const t = ((ts - start) / 1000) % LOOP_DURATION;

    composeFrame(t);
    drawTempToScreen();

    requestAnimationFrame(frame);
  }

  function init() {
    prepareMasks();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    requestAnimationFrame(frame);
  }
})();
