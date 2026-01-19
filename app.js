/* ---------- Telegram safe init ---------- */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  tg.expand();
}

/* ---------- DOM ---------- */
const screens = {
  home: document.getElementById("home"),
  game: document.getElementById("game"),
  result: document.getElementById("result")
};

const loader = document.getElementById("loader");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const playfield = document.getElementById("playfield");
const timerEl = document.getElementById("timer");
const scoreEl = document.getElementById("score");
const modeLabel = document.getElementById("modeLabel");

const streakEl = document.getElementById("streak");
const bestEl = document.getElementById("best");

/* ---------- State ---------- */
let mode = "warmup";        // warmup | endless
let score = 0;
let best = Number(localStorage.getItem("bestScore") || 0);
let timeLeft = 0;

let timerId = null;
let activeTarget = null;
let running = false;

/* ---------- Sound (pleasant click) ---------- */
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
}

function playHitSound() {
  // Soft “ui click”: short sine + subtle triangle, no harsh square
  ensureAudio();

  const now = audioCtx.currentTime;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.10, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);

  const osc1 = audioCtx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(780, now);
  osc1.frequency.exponentialRampToValueAtTime(620, now + 0.08);

  const osc2 = audioCtx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(390, now);
  osc2.frequency.exponentialRampToValueAtTime(310, now + 0.08);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.11);
  osc2.stop(now + 0.11);
}

/* ---------- Helpers ---------- */
function show(screen) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function clearTarget() {
  if (activeTarget) {
    activeTarget.remove();
    activeTarget = null;
  }
}

function setHUD() {
  if (mode === "warmup") {
    modeLabel.textContent = "Разминка";
    scoreEl.textContent = "";
    timerEl.textContent = `⏱ ${timeLeft}s`;
  } else {
    modeLabel.textContent = "∞ Endless";
    scoreEl.textContent = String(score);
    timerEl.textContent = "";
  }
}

function spawnTarget() {
  clearTarget();

  const t = document.createElement("div");
  t.className = "target";

  // Размер можно потом адаптировать по счёту
  const size = 30;
  t.style.width = `${size}px`;
  t.style.height = `${size}px`;

  const maxX = Math.max(0, playfield.clientWidth - size);
  const maxY = Math.max(0, playfield.clientHeight - size);

  t.style.left = `${Math.random() * maxX}px`;
  t.style.top = `${Math.random() * maxY}px`;

  // Hit: stop propagation so playfield click doesn't count as miss
  t.addEventListener("click", (e) => {
    e.stopPropagation();
    onHit();
  });

  playfield.appendChild(t);
  activeTarget = t;
}

function onHit() {
  if (!running) return;
  playHitSound();

  score += 1;
  if (mode === "endless") scoreEl.textContent = String(score);

  spawnTarget();
}

function onMiss() {
  if (!running) return;
  endGame("Промах");
}

/* ---------- Game control ---------- */
function cleanupTimers() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startWarmup() {
  cleanupTimers();
  clearTarget();

  mode = "warmup";
  score = 0;
  timeLeft = 180;
  running = true;

  show(screens.game);
  setHUD();
  spawnTarget();

  // Miss = end
  playfield.onclick = onMiss;

  timerId = setInterval(() => {
    if (!running) return;
    timeLeft -= 1;
    timerEl.textContent = `⏱ ${timeLeft}s`;
    if (timeLeft <= 0) endGame("Разминка завершена");
  }, 1000);
}

function startEndless() {
  cleanupTimers();
  clearTarget();

  mode = "endless";
  score = 0;
  running = true;

  show(screens.game);
  setHUD();
  spawnTarget();

  // Miss = end
  playfield.onclick = onMiss;
}

function endGame(title) {
  running = false;
  cleanupTimers();
  clearTarget();

  if (mode === "endless" && score > best) {
    best = score;
    localStorage.setItem("bestScore", String(best));
  }

  document.getElementById("resultTitle").textContent = title;

  const stats =
    mode === "endless"
      ? `Счёт: <b>${score}</b><br>Рекорд: <b>${best}</b><br><span style="opacity:.7">Промах завершает раунд</span>`
      : `Попаданий: <b>${score}</b><br><span style="opacity:.7">Промах завершает разминку</span>`;

  document.getElementById("resultStats").innerHTML = stats;

  show(screens.result);
}

/* ---------- Streak (simple daily open) ---------- */
function updateStreakUI() {
  const today = new Date().toDateString();
  const last = localStorage.getItem("lastDay");
  let streak = Number(localStorage.getItem("streak") || 0);

  if (last !== today) {
    streak = last ? streak + 1 : 1;
    localStorage.setItem("streak", String(streak));
    localStorage.setItem("lastDay", today);
  }

  streakEl.textContent = `🔥 Streak: ${streak}`;
  bestEl.textContent = `🏆 Рекорд (Endless): ${best}`;
}

/* ---------- Loader (2.5s) ---------- */
function runLoader(durationMs = 2500) {
  // hide screens until loaded
  Object.values(screens).forEach(s => s.classList.remove("active"));
  loader.style.display = "flex";

  const start = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const pct = Math.round(t * 100);

    progressBar.style.width = `${pct}%`;
    progressText.textContent = `${pct}%`;

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      loader.style.display = "none";
      show(screens.home);
    }
  }

  requestAnimationFrame(tick);
}

/* ---------- Events ---------- */
document.getElementById("startWarmup").addEventListener("click", () => {
  // make sure audio can start on first user gesture
  ensureAudio();
  startWarmup();
});

document.getElementById("startEndless").addEventListener("click", () => {
  ensureAudio();
  startEndless();
});

document.getElementById("backHome").addEventListener("click", () => {
  show(screens.home);
});

/* ---------- Init ---------- */
updateStreakUI();
runLoader(2500);
