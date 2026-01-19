/* CS Warmup Mini App (vanilla JS)
 * MVP: Home -> 3-mode warmup -> Result
 * Works in Telegram Web App (Mini App) and in a normal browser.
 */

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  // optional: match theme
  try {
    document.documentElement.style.setProperty('--bg', tg.themeParams.bg_color || '#0b0f14');
    document.documentElement.style.setProperty('--text', tg.themeParams.text_color || '#e8eef7');
  } catch {}
}

const $ = (id) => document.getElementById(id);

const screenHome = $('screenHome');
const screenPlay = $('screenPlay');
const screenResult = $('screenResult');
const screenSettings = $('screenSettings');

const btnStart = $('btnStart');
const btnSettings = $('btnSettings');
const btnCloseSettings = $('btnCloseSettings');
const btnExit = $('btnExit');
const btnAgain = $('btnAgain');
const btnGoPlay = $('btnGoPlay');

const durationSelect = $('duration');
const soundToggle = $('sound');

const streakEl = $('streak');
const lastEl = $('last');
const statReaction = $('statReaction');
const statFlick = $('statFlick');
const statTrack = $('statTrack');

const modeNameEl = $('modeName');
const timeLeftEl = $('timeLeft');
const hintEl = $('hint');

const resReaction = $('resReaction');
const resFlick = $('resFlick');
const resTrack = $('resTrack');

const canvas = $('canvas');
const ctx = canvas.getContext('2d');

// -------------------- persistence
const STORAGE_KEY = 'cs_warmup_state_v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { streak: 0, lastDate: null, best: {}, settings: { duration: 180, sound: true } };
    const parsed = JSON.parse(raw);
    return {
      streak: parsed.streak || 0,
      lastDate: parsed.lastDate || null,
      best: parsed.best || {},
      settings: {
        duration: Number(parsed.settings?.duration ?? 180),
        sound: Boolean(parsed.settings?.sound ?? true)
      }
    };
  } catch {
    return { streak: 0, lastDate: null, best: {}, settings: { duration: 180, sound: true } };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function isYesterdayISO(iso) {
  if (!iso) return false;
  const t = new Date();
  t.setHours(0,0,0,0);
  const y = new Date(t);
  y.setDate(t.getDate() - 1);
  const yISO = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
  return iso === yISO;
}

let state = loadState();

// -------------------- audio
let audioCtx = null;
function beep(freq = 660, ms = 50) {
  if (!state.settings.sound) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    o.type = 'square';
    o.connect(g);
    g.connect(audioCtx.destination);
    g.gain.value = 0.04;
    o.start();
    setTimeout(() => { o.stop(); }, ms);
  } catch {}
}

// -------------------- navigation
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function goHome() {
  hide(screenPlay);
  hide(screenResult);
  hide(screenSettings);
  show(screenHome);
  renderHomeStats();
  if (tg) tg.MainButton.hide();
}

function goSettings() {
  hide(screenHome);
  hide(screenPlay);
  hide(screenResult);
  show(screenSettings);
}

function goResult() {
  hide(screenHome);
  hide(screenPlay);
  hide(screenSettings);
  show(screenResult);
}

// -------------------- home stats
function renderHomeStats() {
  streakEl.textContent = `🔥 Streak: ${state.streak}`;
  lastEl.textContent = `Последний раз: ${formatDate(state.lastDate)}`;

  const tISO = todayISO();
  const today = state.best?.[tISO];
  statReaction.textContent = today?.reactionMs ? `${Math.round(today.reactionMs)} ms` : '—';
  statFlick.textContent = typeof today?.flickAcc === 'number' ? `${Math.round(today.flickAcc * 100)}%` : '—';
  statTrack.textContent = typeof today?.trackOnTarget === 'number' ? `${Math.round(today.trackOnTarget * 100)}%` : '—';

  durationSelect.value = String(state.settings.duration);
  soundToggle.checked = state.settings.sound;
}

// -------------------- canvas sizing
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', () => {
  if (!screenPlay.classList.contains('hidden')) {
    resizeCanvas();
  }
});

// -------------------- warmup engine
const MODES = [
  { key: 'reaction', name: 'Реакция', defaultSeconds: 40 },
  { key: 'flick', name: 'Флик', defaultSeconds: 80 },
  { key: 'track', name: 'Контроль', defaultSeconds: 60 }
];

let session = null;

function splitDuration(totalSeconds) {
  // Keep the vibe: reaction short, flick medium, tracking medium.
  // Scale proportionally with total duration.
  const base = MODES.reduce((a, m) => a + m.defaultSeconds, 0);
  const scale = totalSeconds / base;
  return MODES.map(m => ({ ...m, seconds: Math.max(20, Math.round(m.defaultSeconds * scale)) }));
}

function mmss(s) {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

function rand(min, max) { return Math.random() * (max - min) + min; }

function clear() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
}

function drawCircle(x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function startWarmup() {
  const total = Number(state.settings.duration) || 180;
  const plan = splitDuration(total);

  session = {
    startedAt: performance.now(),
    totalSeconds: total,
    remainingTotal: total,
    plan,
    modeIndex: 0,

    // metrics
    reactionMs: [],
    flickHits: 0,
    flickShots: 0,
    trackOnTargetMs: 0,
    trackTotalMs: 0
  };

  // UI
  hide(screenHome);
  hide(screenResult);
  hide(screenSettings);
  show(screenPlay);

  resizeCanvas();

  if (tg) {
    tg.MainButton.setText('Завершить');
    tg.MainButton.show();
    tg.MainButton.onClick(() => finishWarmup());
  }

  runMode();
  tickHUD();
}

let hudTimer = null;
function tickHUD() {
  if (hudTimer) clearInterval(hudTimer);
  hudTimer = setInterval(() => {
    if (!session) return;
    session.remainingTotal = Math.max(0, Math.ceil(session.totalSeconds - (performance.now() - session.startedAt) / 1000));
    timeLeftEl.textContent = mmss(session.remainingTotal);
    if (session.remainingTotal <= 0) finishWarmup();
  }, 200);
}

function currentMode() {
  return session?.plan?.[session.modeIndex];
}

function runMode() {
  const mode = currentMode();
  if (!mode) return finishWarmup();
  modeNameEl.textContent = mode.name;

  if (mode.key === 'reaction') runReaction(mode.seconds);
  if (mode.key === 'flick') runFlick(mode.seconds);
  if (mode.key === 'track') runTrack(mode.seconds);
}

function nextMode() {
  session.modeIndex += 1;
  runMode();
}

// -------------------- mode: reaction
function runReaction(seconds) {
  hintEl.textContent = 'Жми по цели сразу как появится';
  let endAt = performance.now() + seconds * 1000;
  let target = null;
  let canClick = false;
  let shownAt = 0;

  function spawn() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const r = Math.min(w, h) * 0.055;
    const x = rand(r + 16, w - r - 16);
    const y = rand(r + 80, h - r - 24);
    target = { x, y, r };
    canClick = false;
    // delay before showing
    const delay = rand(350, 1100);
    setTimeout(() => {
      if (!session || performance.now() > endAt) return;
      canClick = true;
      shownAt = performance.now();
      beep(740, 35);
    }, delay);
  }

  spawn();

  const onPointer = (e) => {
    if (!session) return;
    if (!target || !canClick) return;
    const { x, y } = pointerPos(e);
    const dx = x - target.x;
    const dy = y - target.y;
    if (dx*dx + dy*dy <= target.r*target.r) {
      const rt = performance.now() - shownAt;
      session.reactionMs.push(rt);
      beep(920, 35);
      spawn();
    }
  };

  const loop = () => {
    if (!session) return;
    const now = performance.now();
    clear();
    if (target && canClick) {
      drawCircle(target.x, target.y, target.r, 'rgba(45,212,191,0.95)', 'rgba(255,255,255,0.35)');
      drawCircle(target.x, target.y, target.r*0.35, 'rgba(11,15,20,0.65)', null);
    }
    if (now < endAt && now - session.startedAt < session.totalSeconds*1000) {
      requestAnimationFrame(loop);
    } else {
      canvas.removeEventListener('pointerdown', onPointer);
      nextMode();
    }
  };

  canvas.addEventListener('pointerdown', onPointer, { passive: true });
  requestAnimationFrame(loop);
}

// -------------------- mode: flick
function runFlick(seconds) {
  hintEl.textContent = 'Попадай по маленьким целям (как хэдшоты)';
  let endAt = performance.now() + seconds * 1000;
  let target = null;

  function spawn() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const r = Math.min(w, h) * 0.035;
    const x = rand(r + 16, w - r - 16);
    const y = rand(r + 80, h - r - 24);
    target = { x, y, r };
  }

  spawn();

  const onPointer = (e) => {
    if (!session || !target) return;
    session.flickShots += 1;
    const { x, y } = pointerPos(e);
    const dx = x - target.x;
    const dy = y - target.y;
    if (dx*dx + dy*dy <= target.r*target.r) {
      session.flickHits += 1;
      beep(880, 35);
      spawn();
    } else {
      // small penalty: keep target
    }
  };

  const loop = () => {
    if (!session) return;
    const now = performance.now();
    clear();
    if (target) {
      drawCircle(target.x, target.y, target.r, 'rgba(232,238,247,0.10)', 'rgba(232,238,247,0.35)');
      drawCircle(target.x, target.y, target.r*0.55, 'rgba(45,212,191,0.95)', null);
      drawCircle(target.x, target.y, target.r*0.22, 'rgba(11,15,20,0.65)', null);
    }

    if (now < endAt && now - session.startedAt < session.totalSeconds*1000) {
      requestAnimationFrame(loop);
    } else {
      canvas.removeEventListener('pointerdown', onPointer);
      nextMode();
    }
  };

  canvas.addEventListener('pointerdown', onPointer, { passive: true });
  requestAnimationFrame(loop);
}

// -------------------- mode: track
function runTrack(seconds) {
  hintEl.textContent = 'Держи прицел на цели, пока она стрейфит';
  let endAt = performance.now() + seconds * 1000;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const r = Math.min(w, h) * 0.04;

  const target = {
    x: w * 0.5,
    y: h * 0.55,
    vx: rand(180, 260) * (Math.random() < 0.5 ? -1 : 1),
    vy: 0,
    r
  };

  let lastT = performance.now();
  let pointer = { x: w * 0.5, y: h * 0.5, has: false };

  const onMove = (e) => {
    pointer = { ...pointerPos(e), has: true };
  };

  const loop = () => {
    if (!session) return;
    const now = performance.now();
    const dt = Math.min(0.033, (now - lastT) / 1000);
    lastT = now;

    // update target
    target.x += target.vx * dt;
    if (target.x < r + 12) { target.x = r + 12; target.vx *= -1; }
    if (target.x > w - r - 12) { target.x = w - r - 12; target.vx *= -1; }

    clear();

    // score on-target time (if pointer within r)
    session.trackTotalMs += dt * 1000;
    let onTarget = false;
    if (pointer.has) {
      const dx = pointer.x - target.x;
      const dy = pointer.y - target.y;
      onTarget = (dx*dx + dy*dy) <= (target.r*target.r);
      if (onTarget) session.trackOnTargetMs += dt * 1000;
    }

    // draw
    drawCircle(target.x, target.y, target.r, onTarget ? 'rgba(45,212,191,0.95)' : 'rgba(232,238,247,0.12)', 'rgba(232,238,247,0.35)');
    drawCircle(target.x, target.y, target.r*0.3, 'rgba(11,15,20,0.65)', null);

    if (pointer.has) {
      drawCrosshair(pointer.x, pointer.y, onTarget);
    } else {
      // hint crosshair at center
      drawCrosshair(w*0.5, h*0.5, false);
    }

    if (now < endAt && now - session.startedAt < session.totalSeconds*1000) {
      requestAnimationFrame(loop);
    } else {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onMove);
      nextMode();
    }
  };

  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerdown', onMove, { passive: true });
  requestAnimationFrame(loop);
}

function drawCrosshair(x, y, active) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? 'rgba(45,212,191,0.85)' : 'rgba(232,238,247,0.55)';
  const len = 10;
  const gap = 4;
  ctx.beginPath();
  // up
  ctx.moveTo(0, -gap);
  ctx.lineTo(0, -gap - len);
  // down
  ctx.moveTo(0, gap);
  ctx.lineTo(0, gap + len);
  // left
  ctx.moveTo(-gap, 0);
  ctx.lineTo(-gap - len, 0);
  // right
  ctx.moveTo(gap, 0);
  ctx.lineTo(gap + len, 0);
  ctx.stroke();
  ctx.restore();
}

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX ?? (e.touches?.[0]?.clientX);
  const clientY = e.clientY ?? (e.touches?.[0]?.clientY);
  return {
    x: (clientX - rect.left),
    y: (clientY - rect.top)
  };
}

function finishWarmup() {
  if (!session) return;

  if (hudTimer) { clearInterval(hudTimer); hudTimer = null; }
  if (tg) {
    try { tg.MainButton.offClick(() => finishWarmup()); } catch {}
    tg.MainButton.hide();
  }

  // compute metrics
  const reactionAvg = session.reactionMs.length
    ? session.reactionMs.reduce((a,b) => a + b, 0) / session.reactionMs.length
    : null;

  const flickAcc = session.flickShots > 0 ? session.flickHits / session.flickShots : null;

  const trackOnTarget = session.trackTotalMs > 0 ? session.trackOnTargetMs / session.trackTotalMs : null;

  // streak update
  const tISO = todayISO();
  if (state.lastDate !== tISO) {
    if (isYesterdayISO(state.lastDate)) state.streak += 1;
    else state.streak = 1;
    state.lastDate = tISO;
  }

  state.best[tISO] = {
    reactionMs: reactionAvg,
    flickAcc,
    trackOnTarget
  };

  // save settings
  state.settings.duration = Number(durationSelect.value || state.settings.duration);
  state.settings.sound = soundToggle.checked;

  saveState();

  // render results
  resReaction.textContent = reactionAvg ? `${Math.round(reactionAvg)} ms` : '—';
  resFlick.textContent = (typeof flickAcc === 'number') ? `${Math.round(flickAcc * 100)}%` : '—';
  resTrack.textContent = (typeof trackOnTarget === 'number') ? `${Math.round(trackOnTarget * 100)}%` : '—';

  // also update home quick stats
  renderHomeStats();

  // clean session
  session = null;

  goResult();
}

// -------------------- bindings
btnStart.addEventListener('click', () => {
  // sync settings before start
  state.settings.duration = Number(durationSelect.value || state.settings.duration);
  state.settings.sound = soundToggle.checked;
  saveState();
  startWarmup();
});

btnSettings.addEventListener('click', () => goSettings());
btnCloseSettings.addEventListener('click', () => goHome());

btnExit.addEventListener('click', () => {
  session = null;
  if (hudTimer) { clearInterval(hudTimer); hudTimer = null; }
  goHome();
});

btnAgain.addEventListener('click', () => {
  goHome();
  startWarmup();
});

btnGoPlay.addEventListener('click', () => {
  // In Telegram: close the webview. In browser: go home.
  if (tg) tg.close();
  else goHome();
});

// Settings live save
durationSelect.addEventListener('change', () => {
  state.settings.duration = Number(durationSelect.value || 180);
  saveState();
});

soundToggle.addEventListener('change', () => {
  state.settings.sound = soundToggle.checked;
  saveState();
});

// Start
renderHomeStats();
goHome();
