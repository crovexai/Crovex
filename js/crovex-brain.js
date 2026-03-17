// js/crovex-brain.js
// CROVEX brain full-screen animation engine
(function () {
  const CANVAS_ID = 'crovexBrain';
  const ASSET_PATH = 'Image/';
  const BRAIN_IMG = ASSET_PATH + 'brain-full.jpeg';
  const CHIP_MASK_IMG = ASSET_PATH + 'chip-mask.png';
  const AI_MASK_IMG = ASSET_PATH + 'ai-brain-mask.png';
  const NERVE_MASK_IMG = ASSET_PATH + 'nerve-mask.png';

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

  // Mask coordinate system (assets are 1024x1024)
  const MASK_SIZE = 1024;
  const CHIP_ORIGIN = { x: 760, y: 260 };

  // Ensure canvas exists and place it inside .bg-wrap if present
  let canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    const bgWrap = document.querySelector('.bg-wrap');
    if (bgWrap) bgWrap.appendChild(canvas);
    else document.body.appendChild(canvas);
  }
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '-10';
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
    if (chipMaskImg.complete && chipMaskImg.naturalWidth) {
      mctx.drawImage(chipMaskImg, 0, 0, MASK_SIZE, MASK_SIZE);
    }

    const actx = aiMaskCanvas.getContext('2d');
    actx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    if (aiMaskImg.complete && aiMaskImg.naturalWidth) {
      actx.drawImage(aiMaskImg, 0, 0, MASK_SIZE, MASK_SIZE);
    }

    const nctx = nerveMaskCanvas.getContext('2d');
    nctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    if (nerveMaskImg.complete && nerveMaskImg.naturalWidth) {
      nctx.drawImage(nerveMaskImg, 0, 0, MASK_SIZE, MASK_SIZE);
    }
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

  // Utility: draw a radial gradient masked by a mask canvas into tempCtx
  function drawMaskedRadialTo(ctxTarget, maskSourceCanvas, origin, innerR, outerR, colorStops) {
    ctxTarget.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    const g = ctxTarget.createRadialGradient(origin.x, origin.y, innerR, origin.x, origin.y, outerR);
    for (const stop of colorStops) g.addColorStop(stop[0], stop[1]);
    ctxTarget.fillStyle = g;
    ctxTarget.fillRect(0, 0, MASK_SIZE, MASK_SIZE);

    ctxTarget.globalCompositeOperation = 'destination-in';
    ctxTarget.drawImage(maskSourceCanvas, 0, 0);
    ctxTarget.globalCompositeOperation = 'source-over';
  }

  // Draw the composed tempCanvas
