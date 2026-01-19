const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const screens = {
  home: document.getElementById("home"),
  game: document.getElementById("game"),
  result: document.getElementById("result")
};

const playfield = document.getElementById("playfield");
const timerEl = document.getElementById("timer");
const scoreEl = document.getElementById("score");
const modeLabel = document.getElementById("modeLabel");

let mode = "warmup";
let score = 0;
let best = Number(localStorage.getItem("bestScore") || 0);
let timeLeft = 0;
let timer;
let activeTarget = null;

/* ---------- SOUND ---------- */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playHitSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.value = 880;

  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.13);
}

/* ---------- UTILS ---------- */
function show(screen) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function randomTarget() {
  if (activeTarget) activeTarget.remove();

  const t = document.createElement("div");
  t.className = "target";

  t.style.left = Math.random() * (playfield.clientWidth - 30) + "px";
  t.style.top = Math.random() * (playfield.clientHeight - 30) + "px";

  t.onclick = e => {
    e.stopPropagation();
    hit();
  };

  playfield.appendChild(t);
  activeTarget = t;
}

function hit() {
  playHitSound();
  score++;
  scoreEl.textContent = score;
  randomTarget();
}

function miss() {
  endGame("Промах");
}

/* ---------- GAME LOGIC ---------- */
function startWarmup() {
  mode = "warmup";
  score = 0;
  timeLeft = 180;
  modeLabel.textContent = "Разминка";
  scoreEl.textContent = "";

  show(screens.game);
  randomTarget();

  playfield.onclick = miss;

  timer = setInterval(() => {
    timeLeft--;
    timerEl.textContent = `⏱ ${timeLeft}s`;
    if (timeLeft <= 0) endGame("Разминка завершена");
  }, 1000);
}

function startEndless() {
  mode = "endless";
  score = 0;
  modeLabel.textContent = "∞ Endless";
  scoreEl.textContent = "0";
  timerEl.textContent = "";

  show(screens.game);
  randomTarget();

  playfield.onclick = miss;
}

function endGame(title) {
  clearInterval(timer);
  if (activeTarget) activeTarget.remove();

  if (mode === "endless" && score > best) {
    best = score;
    localStorage.setItem("bestScore", best);
  }

  document.getElementById("resultTitle").textContent = title;
  document.getElementById("resultStats").innerHTML =
    mode === "endless"
      ? `Счёт: <b>${score}</b><br>Рекорд: <b>${best}</b>`
      : `Попаданий: <b>${score}</b>`;

  show(screens.result);
}

/* ---------- EVENTS ---------- */
document.getElementById("startWarmup").onclick = startWarmup;
document.getElementById("startEndless").onclick = startEndless;
document.getElementById("backHome").onclick = () => show(screens.home);

/* ---------- STREAK (простая версия) ---------- */
const today = new Date().toDateString();
const last = localStorage.getItem("lastDay");
let streak = Number(localStorage.getItem("streak") || 0);

if (last !== today) {
  streak = last ? streak + 1 : 1;
  localStorage.setItem("streak", streak);
  localStorage.setItem("lastDay", today);
}

document.getElementById("streak").textContent = `🔥 Streak: ${streak}`;
