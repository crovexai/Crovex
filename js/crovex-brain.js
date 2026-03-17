// js/crovex-brain.js
// CROVEX brain animation engine
(function () {
  const CANVAS_ID = 'crovexBrain';
  const ASSET_VERSION = '20260317-5';
  const ASSET_PATH = 'Image/';
  const BRAIN_IMG = ASSET_PATH + 'brain-full.jpeg?v=' + ASSET_VERSION;
  const CHIP_MASK_IMG = ASSET_PATH + 'chip-masks.png?v=' + ASSET_VERSION;
  const AI_MASK_IMG = ASSET_PATH + 'ai-brain-masks.png?v=' + ASSET_VERSION;
  const NERVE_MASK_IMG = ASSET_PATH + 'nerve-masks.png?v=' + ASSET_VERSION;

  const LOOP_DURATION = 2.4;
  const MASK_SIZE = 1024;
  const CHIP_ORIGIN = { x: 760, y: 260 };
  const MASK_WHITE_START = 90;
  const MASK_WHITE_END = 255;

  const CHIP_FLASH_COLOR = 'rgba(0,255,255,1)';
  const DIGITAL_PULSE_COLOR = 'rgba(0,255,180,1)';
  const BIO_PULSE_COLOR = 'rgba(255,80,180,1)';
  const AI_GLOW_COLOR = 'rgba(0,180,255,0.4)';

  let canvas = document.getElementById('pulseCanvas') || document.getElementById(CANVAS_ID);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    document.body.appendChild(canvas);
  }

  const useInlinePulseCanvas = canvas.id === 'pulseCanvas';
  if (!useInlinePulseCanvas && window.getComputedStyle(document.body).position === 'static') {
    document.body.style.position = 'relative';
  }

  canvas.style.position = useInlinePulseCanvas ? 'absolute' : 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = useInlinePulseCanvas ? '2' : '0';
  canvas.setAttribute('aria-hidden', 'true');

  const ctx = canvas.getContext('2d');

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  const chipMaskCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const aiMaskCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const nerveMaskCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);

  const tempCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const tempCtx = tempCanvas.getContext('2d');

  const layerCanvas = makeCanvas(MASK_SIZE, MASK_SIZE);
  const layerCtx = layerCanvas.getContext('2d');

  const brainImg = new Image();
  const chipMaskImg = new Image();
  const aiMaskImg = new Image();
  const nerveMaskImg = new Image();

  let loaded = 0;
  function markAssetReady(name, ok) {
    loaded += 1;
    if (!ok) {
      console.warn('[crovex-brain] asset failed to load:', name);
    }
    if (loaded === 4) {
      init();
    }
  }

  brainImg.onload = function () { markAssetReady('brain-full.jpeg', true); };
  chipMaskImg.onload = function () { markAssetReady('chip-masks.png', true); };
  aiMaskImg.onload = function () { markAssetReady('ai-brain-masks.png', true); };
  nerveMaskImg.onload = function () { markAssetReady('nerve-masks.png', true); };

  brainImg.onerror = function () { markAssetReady('brain-full.jpeg', false); };
  chipMaskImg.onerror = function () { markAssetReady('chip-masks.png', false); };
  aiMaskImg.onerror = function () { markAssetReady('ai-brain-masks.png', false); };
  nerveMaskImg.onerror = function () { markAssetReady('nerve-masks.png', false); };

  brainImg.src = BRAIN_IMG;
  chipMaskImg.src = CHIP_MASK_IMG;
  aiMaskImg.src = AI_MASK_IMG;
  nerveMaskImg.src = NERVE_MASK_IMG;

  function writeWhitePointMask(targetCanvas, sourceImg) {
    const tctx = targetCanvas.getContext('2d');
    tctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    tctx.drawImage(sourceImg, 0, 0, MASK_SIZE, MASK_SIZE);

    const img = tctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      let alphaFromWhite = 0;
      if (luminance >= MASK_WHITE_START) {
        const normalized = Math.min(1, (luminance - MASK_WHITE_START) / (MASK_WHITE_END - MASK_WHITE_START));
        alphaFromWhite = Math.floor(normalized * 255);
      }

      const outAlpha = Math.min(alphaFromWhite, a);
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = outAlpha;
    }
    tctx.putImageData(img, 0, 0);
  }

  function prepareMasks() {
    writeWhitePointMask(chipMaskCanvas, chipMaskImg);
    writeWhitePointMask(aiMaskCanvas, aiMaskImg);
    writeWhitePointMask(nerveMaskCanvas, nerveMaskImg);
  }

  function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(useInlinePulseCanvas ? rect.width : window.innerWidth));
    const h = Math.max(1, Math.floor(useInlinePulseCanvas ? rect.height : window.innerHeight));

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawLayer(maskSource, gradient) {
    layerCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    layerCtx.fillStyle = gradient;
    layerCtx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.drawImage(maskSource, 0, 0);
    layerCtx.globalCompositeOperation = 'source-over';
    tempCtx.drawImage(layerCanvas, 0, 0);
  }

  function composeFrame(t) {
    tempCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    const phase = (t % LOOP_DURATION) / LOOP_DURATION;

    const chipBurst = Math.max(0, 1 - phase / 0.14);
    if (chipBurst > 0) {
      const chipRadius = 18 + (1 - chipBurst) * 55;
      const chipGrad = layerCtx.createRadialGradient(
        CHIP_ORIGIN.x,
        CHIP_ORIGIN.y,
        0,
        CHIP_ORIGIN.x,
        CHIP_ORIGIN.y,
        chipRadius
      );
      chipGrad.addColorStop(0, CHIP_FLASH_COLOR.replace('1)', Math.min(1, chipBurst * 1.2).toFixed(3) + ')'));
      chipGrad.addColorStop(1, 'rgba(0,0,0,0)');
      drawLayer(chipMaskCanvas, chipGrad);
    }

    const boardRadius = 34 + phase * (MASK_SIZE * 1.25);
    const boardAlpha = Math.max(0, 0.95 - phase);
    const boardGrad = layerCtx.createRadialGradient(
      CHIP_ORIGIN.x,
      CHIP_ORIGIN.y,
      boardRadius * 0.28,
      CHIP_ORIGIN.x,
      CHIP_ORIGIN.y,
      boardRadius
    );
    boardGrad.addColorStop(0, 'rgba(0,0,0,0)');
    boardGrad.addColorStop(0.34, DIGITAL_PULSE_COLOR.replace('1)', boardAlpha.toFixed(3) + ')'));
    boardGrad.addColorStop(1, 'rgba(0,0,0,0)');
    drawLayer(chipMaskCanvas, boardGrad);

    const aiWave = 0.62 + 0.38 * Math.sin(phase * Math.PI * 2);
    const aiRadius = 80 + phase * (MASK_SIZE * 1.4);
    const aiGrad = layerCtx.createRadialGradient(
      CHIP_ORIGIN.x,
      CHIP_ORIGIN.y,
      aiRadius * 0.12,
      CHIP_ORIGIN.x,
      CHIP_ORIGIN.y,
      aiRadius
    );
    aiGrad.addColorStop(0, AI_GLOW_COLOR.replace('0.4', (aiWave * 0.45).toFixed(3)));
    aiGrad.addColorStop(0.55, AI_GLOW_COLOR.replace('0.4', (aiWave * 0.22).toFixed(3)));
    aiGrad.addColorStop(1, 'rgba(0,0,0,0)');
    drawLayer(aiMaskCanvas, aiGrad);

    const bioRadius = 22 + phase * (MASK_SIZE * 1.35);
    const bioAlpha = Math.max(0, 0.9 - phase * 0.85);
    const bioGrad = layerCtx.createRadialGradient(
      CHIP_ORIGIN.x,
      CHIP_ORIGIN.y,
      bioRadius * 0.14,
      CHIP_ORIGIN.x,
      CHIP_ORIGIN.y,
      bioRadius
    );
    bioGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bioGrad.addColorStop(0.27, BIO_PULSE_COLOR.replace('1)', bioAlpha.toFixed(3) + ')'));
    bioGrad.addColorStop(1, 'rgba(0,0,0,0)');
    drawLayer(nerveMaskCanvas, bioGrad);
  }

  function drawFrameToScreen() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);

    if (brainImg.complete && brainImg.naturalWidth) {
      const imgRatio = brainImg.width / brainImg.height;
      const screenRatio = w / h;
      let dw;
      let dh;
      let dx;
      let dy;

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

      ctx.globalAlpha = useInlinePulseCanvas ? 0.9 : 1;
      ctx.drawImage(brainImg, dx, dy, dw, dh);
    }

    ctx.globalAlpha = 1;
    ctx.drawImage(tempCanvas, 0, 0, MASK_SIZE, MASK_SIZE, 0, 0, w, h);
  }

  let start = null;
  function frame(ts) {
    if (!start) {
      start = ts;
    }
    const t = ((ts - start) / 1000) % LOOP_DURATION;

    composeFrame(t);
    drawFrameToScreen();
    requestAnimationFrame(frame);
  }

  function init() {
    prepareMasks();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    requestAnimationFrame(frame);
  }
})();
