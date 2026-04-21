const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
const fileInput = document.getElementById('fileInput');
const cameraBtn = document.getElementById('cameraBtn');
const shutterBtn = document.getElementById('shutterBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const zoomEl = document.getElementById('zoom');
const rotateEl = document.getElementById('rotate');
const emptyState = document.getElementById('emptyState');
const video = document.getElementById('camera');

const state = {
  img: null,
  source: null,
  sourceWidth: 0,
  sourceHeight: 0,
  centerX: 0,
  centerY: 0,
  zoom: parseFloat(zoomEl.value),
  rotate: parseFloat(rotateEl.value) * Math.PI / 180,
  dragging: false,
  pointerId: null,
  lastX: 0,
  lastY: 0,
  drawScale: 1,
  stream: null,
  rafId: 0,
  liveCamera: false,
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const size = Math.max(1, Math.floor(Math.min(rect.width, rect.height) * dpr));
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  draw();
}

function setSource(src, width, height) {
  state.source = src;
  state.sourceWidth = width;
  state.sourceHeight = height;
  state.centerX = width / 2;
  state.centerY = height / 2;
  emptyState.style.display = 'none';
  draw();
}

function loadImageFromFile(file) {
  if (!file) return;
  stopCamera();
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.img = img;
    setSource(img, img.width, img.height);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

async function openCamera() {
  try {
    stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    state.stream = stream;
    video.srcObject = stream;
    await video.play();
    state.liveCamera = true;
    shutterBtn.disabled = false;
    state.img = null;
    setSource(video, video.videoWidth || 1280, video.videoHeight || 720);
    startLoop();
  } catch (err) {
    alert('Camera could not be opened.');
  }
}

function startLoop() {
  cancelAnimationFrame(state.rafId);
  const loop = () => {
    if (state.liveCamera) draw();
    state.rafId = requestAnimationFrame(loop);
  };
  state.rafId = requestAnimationFrame(loop);
}

function stopCamera() {
  state.liveCamera = false;
  shutterBtn.disabled = true;
  cancelAnimationFrame(state.rafId);
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  video.srcObject = null;
}

function captureFrame() {
  if (!state.liveCamera || !video.videoWidth || !video.videoHeight) return;
  const off = document.createElement('canvas');
  off.width = video.videoWidth;
  off.height = video.videoHeight;
  off.getContext('2d').drawImage(video, 0, 0);
  const img = new Image();
  img.onload = () => {
    state.img = img;
    stopCamera();
    setSource(img, img.width, img.height);
  };
  img.src = off.toDataURL('image/jpeg', 0.96);
}

function resetView() {
  if (!state.source) return;
  state.centerX = state.sourceWidth / 2;
  state.centerY = state.sourceHeight / 2;
  state.zoom = 1.35;
  state.rotate = 0;
  zoomEl.value = String(state.zoom);
  rotateEl.value = '0';
  draw();
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const src = state.source;
  if (!src || !state.sourceWidth || !state.sourceHeight) return;

  const cx = w / 2;
  const cy = h / 2;
  const slices = 36;
  const step = (Math.PI * 2) / slices;
  const radius = Math.sqrt(w * w + h * h);

  const cover = Math.max(w / state.sourceWidth, h / state.sourceHeight);
  const scale = cover * 1.9 * state.zoom;
  state.drawScale = scale;

  for (let i = 0; i < slices; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * step);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, -step / 2 - 0.004, step / 2 + 0.004);
    ctx.closePath();
    ctx.clip();

    if (i % 2 === 1) ctx.scale(-1, 1);
    ctx.rotate(state.rotate);
    ctx.scale(scale, scale);
    ctx.translate(-state.centerX, -state.centerY);
    ctx.drawImage(src, 0, 0, state.sourceWidth, state.sourceHeight);
    ctx.restore();
  }
}

function saveJPEG() {
  const name = `kaleidoscope-${timestamp()}.jpg`;
  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      if (!blob) {
        saveDataURL(name, canvas.toDataURL('image/jpeg', 0.94));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }, 'image/jpeg', 0.94);
  } else {
    saveDataURL(name, canvas.toDataURL('image/jpeg', 0.94));
  }
}

function saveDataURL(name, dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

fileInput.addEventListener('change', (e) => loadImageFromFile(e.target.files?.[0]));
cameraBtn.addEventListener('click', openCamera);
shutterBtn.addEventListener('click', captureFrame);
zoomEl.addEventListener('input', () => {
  state.zoom = parseFloat(zoomEl.value);
  draw();
});
rotateEl.addEventListener('input', () => {
  state.rotate = parseFloat(rotateEl.value) * Math.PI / 180;
  draw();
});
saveBtn.addEventListener('click', saveJPEG);
resetBtn.addEventListener('click', resetView);

canvas.addEventListener('pointerdown', (e) => {
  if (!state.source) return;
  state.dragging = true;
  state.pointerId = e.pointerId;
  state.lastX = e.clientX;
  state.lastY = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (!state.dragging || e.pointerId !== state.pointerId || !state.source) return;
  const dx = e.clientX - state.lastX;
  const dy = e.clientY - state.lastY;
  state.lastX = e.clientX;
  state.lastY = e.clientY;
  state.centerX -= dx / state.drawScale;
  state.centerY -= dy / state.drawScale;
  state.centerX = Math.max(0, Math.min(state.sourceWidth, state.centerX));
  state.centerY = Math.max(0, Math.min(state.sourceHeight, state.centerY));
  draw();
  e.preventDefault();
});
function endPointer(e) {
  if (e.pointerId !== state.pointerId) return;
  state.dragging = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 80));
window.addEventListener('beforeunload', stopCamera);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

resize();
