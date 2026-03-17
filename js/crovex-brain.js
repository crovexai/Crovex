// js/crovex-brain.js
// High-visibility CROVEX pulse engine
(function () {
  const VERSION = '20260317-10';
  const SIZE = 1024;
  const LOOP_SECONDS = 2.2;

  const CHIP_ORIGIN = { x: 532, y: 540 };

  const ASSET_PATH = 'Image/';
  const BRAIN_SRC = ASSET_PATH + 'brain-full.jpeg?v=' + VERSION;
  const CHIP_MASK_SRC = ASSET_PATH + 'chip-masks.png?v=' + VERSION;
  const AI_MASK_SRC = ASSET_PATH + 'ai-brain-masks.png?v=' + VERSION;
  const NERVE_MASK_SRC = ASSET_PATH + 'nerve-masks.png?v=' + VERSION;

  const canvas = document.getElementById('pulseCanvas') || (function () {
    const c = document.createElement('canvas');
    c.id = 'crovexBrain';
    document.body.appendChild(c);
    return c;
  })();

  const inlineMode = canvas.id === 'pulseCanvas';
  if (!inlineMode && window.getComputedStyle(document.body).position === 'static') {
    document.body.style.position = 'relative';
  }

  canvas.style.position = inlineMode ? 'absolute' : 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = inlineMode ? '2' : '0';

  const ctx = canvas.getContext('2d');

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  const chipMask = makeCanvas(SIZE, SIZE);
  const aiMask = makeCanvas(SIZE, SIZE);
  const nerveMask = makeCanvas(SIZE, SIZE);
  const temp = makeCanvas(SIZE, SIZE);
  const tempCtx = temp.getContext('2d');
  const layer = makeCanvas(SIZE, SIZE);
  const layerCtx = layer.getContext('2d');

  const brainImg = new Image();
  const chipMaskImg = new Image();
  const aiMaskImg = new Image();
  const nerveMaskImg = new Image();

  let loaded = 0;
  function done() {
    loaded += 1;
    if (loaded === 4) {
      init();
    }
  }

  brainImg.onload = done;
  chipMaskImg.onload = done;
  aiMaskImg.onload = done;
  nerveMaskImg.onload = done;

  brainImg.onerror = done;
  chipMaskImg.onerror = done;
  aiMaskImg.onerror = done;
  nerveMaskImg.onerror = done;

  brainImg.src = BRAIN_SRC;
  chipMaskImg.src = CHIP_MASK_SRC;
  aiMaskImg.src = AI_MASK_SRC;
  nerveMaskImg.src = NERVE_MASK_SRC;

  function buildMask(targetCanvas, sourceImg) {
    const t = targetCanvas.getContext('2d');
    t.clearRect(0, 0, SIZE, SIZE);
    t.drawImage(sourceImg, 0, 0, SIZE, SIZE);

    const img = t.getImageData(0, 0, SIZE, SIZE);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      const whiteAlpha = l >= 28 ? Math.floor(Math.pow((l - 28) / (255 - 28), 0.45) * 255) : 0;
      const out = Math.max(whiteAlpha, Math.floor(a * 0.7));

      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = out;
    }

    t.putImageData(img, 0, 0);
  }

  function prepareMasks() {
    buildMask(chipMask, chipMaskImg);
    buildMask(aiMask, aiMaskImg);
    buildMask(nerveMask, nerveMaskImg);
  }

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(inlineMode ? rect.width : window.innerWidth));
    const h = Math.max(1, Math.floor(inlineMode ? rect.height : window.innerHeight));

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawMaskedGradient(mask, gradient) {
    layerCtx.clearRect(0, 0, SIZE, SIZE);
    layerCtx.fillStyle = gradient;
    layerCtx.fillRect(0, 0, SIZE, SIZE);
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.drawImage(mask, 0, 0);
    layerCtx.globalCompositeOperation = 'source-over';

    tempCtx.globalCompositeOperation = 'lighter';
    tempCtx.drawImage(layer, 0, 0);
    tempCtx.globalCompositeOperation = 'source-over';
  }

  function compose(t) {
    tempCtx.clearRect(0, 0, SIZE, SIZE);
    const p = (t % LOOP_SECONDS) / LOOP_SECONDS;

    // Unmasked beacon so automation is always visible.
    const beaconA = 0.75 + 0.25 * Math.sin(p * Math.PI * 2);
    const beacon = layerCtx.createRadialGradient(CHIP_ORIGIN.x, CHIP_ORIGIN.y, 0, CHIP_ORIGIN.x, CHIP_ORIGIN.y, 220);
    beacon.addColorStop(0, 'rgba(255,255,255,' + beaconA.toFixed(3) + ')');
    beacon.addColorStop(0.2, 'rgba(0,255,255,' + (beaconA * 0.95).toFixed(3) + ')');
    beacon.addColorStop(1, 'rgba(0,0,0,0)');
    layerCtx.clearRect(0, 0, SIZE, SIZE);
    layerCtx.fillStyle = beacon;
    layerCtx.fillRect(0, 0, SIZE, SIZE);
    tempCtx.globalCompositeOperation = 'lighter';
    tempCtx.drawImage(layer, 0, 0);
    tempCtx.globalCompositeOperation = 'source-over';

    // chip-mask: microchip flash + motherboard ring pulse
    const flash = Math.max(0, 1 - p / 0.2);
    const chipR = 18 + (1 - flash) * 120;
    const chipGrad = layerCtx.createRadialGradient(CHIP_ORIGIN.x, CHIP_ORIGIN.y, 0, CHIP_ORIGIN.x, CHIP_ORIGIN.y, chipR);
    chipGrad.addColorStop(0, 'rgba(130,255,255,' + Math.min(1, flash * 1.6).toFixed(3) + ')');
    chipGrad.addColorStop(0.28, 'rgba(0,255,220,' + (flash * 0.95).toFixed(3) + ')');
    chipGrad.addColorStop(1, 'rgba(0,0,0,0)');
    drawMaskedGradient(chipMask, chipGrad);

    const boardR = 60 + p * 1450;
    const boardA = Math.max(0, 1.25 - p * 0.95);
    const boardGrad = layerCtx.createRadialGradient(CHIP_ORIGIN.x, CHIP_ORIGIN.y, boardR * 0.22, CHIP_ORIGIN.x, CHIP_ORIGIN.y, boardR);
    boardGrad.addColorStop(0, 'rgba(0,0,0,0)');
    boardGrad.addColorStop(0.25, 'rgba(0,255,200,' + boardA.toFixed(3) + ')');
    boardGrad.addColorStop(0.45, 'rgba(130,255,255,' + (boardA * 0.75).toFixed(3) + ')');
    boardGrad.addColorStop(1, 'rgba(0,0,0,0)');
    drawMaskedGradient(chipMask, boardGrad);

    // ai-brain-mask: right-side AI glow
    const aiR = 40 + p * 1550;
    const aiA = 0.8 + 0.2 * Math.sin(p * Math.PI * 2);
    const aiGrad = layerCtx.createRadialGradient(CHIP_ORIGIN.x, CHIP_ORIGIN.y, aiR * 0.08, CHIP_ORIGIN.x, CHIP_ORIGIN.y, aiR);
    aiGrad.addColorStop(0, 'rgba(120,220,255,' + (aiA * 1.1).toFixed(3) + ')');
    aiGrad.addColorStop(0.55, 'rgba(0,170,255,' + (aiA * 0.6).toFixed(3) + ')');
    aiGrad.addColorStop(1, 'rgba(0,0,0,0)');
    drawMaskedGradient(aiMask, aiGrad);

    // nerve-mask: left-side biological pulse
    const bioR = 35 + p * 1500;
    const bioA = Math.max(0, 1.15 - p * 0.72);
    const bioGrad = layerCtx.createRadialGradient(CHIP_ORIGIN.x, CHIP_ORIGIN.y, bioR * 0.1, CHIP_ORIGIN.x, CHIP_ORIGIN.y, bioR);
    bioGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bioGrad.addColorStop(0.22, 'rgba(255,90,210,' + bioA.toFixed(3) + ')');
    bioGrad.addColorStop(0.45, 'rgba(255,160,220,' + (bioA * 0.6).toFixed(3) + ')');
    bioGrad.addColorStop(1, 'rgba(0,0,0,0)');
    drawMaskedGradient(nerveMask, bioGrad);
  }

  function draw() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);

    const imgRatio = (brainImg.complete && brainImg.naturalWidth)
      ? brainImg.width / brainImg.height
      : 1;
    const screenRatio = w / h;
    let dw;
    let dh;
    let dx;
    let dy;

    // Match CSS object-fit: cover mapping used by the background image.
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

    if (!inlineMode && brainImg.complete && brainImg.naturalWidth) {
      ctx.globalAlpha = 1;
      ctx.drawImage(brainImg, dx, dy, dw, dh);
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    ctx.drawImage(temp, 0, 0, SIZE, SIZE, dx, dy, dw, dh);
    ctx.globalCompositeOperation = 'source-over';

    // Strong visible origin marker.
    const px = dx + (CHIP_ORIGIN.x / SIZE) * dw;
    const py = dy + (CHIP_ORIGIN.y / SIZE) * dh;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  let start = null;
  function frame(ts) {
    if (!start) start = ts;
    const t = (ts - start) / 1000;

    compose(t);
    draw();
    requestAnimationFrame(frame);
  }

  function init() {
    prepareMasks();
    resize();
    window.addEventListener('resize', resize, { passive: true });
    requestAnimationFrame(frame);
  }
})();
