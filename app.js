(() => {
  "use strict";

  /* ==========================
     Telegram-safe integration
     ========================== */
  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  function tgSafe(fn, ...args) {
    try { if (tg && typeof fn === "function") fn(...args); } catch (_) {}
  }

  if (tg) {
    tgSafe(tg.ready.bind(tg));
    tgSafe(tg.expand.bind(tg));
  }

  /* ==========
     DOM helpers
     ========== */
  const $ = (id) => document.getElementById(id);

  const el = {
    loader: $("loader"),
    loaderBar: $("loaderBar"),
    loaderPct: $("loaderPct"),

    toast: $("toast"),

    home: $("home"),
    game: $("game"),
    result: $("result"),

    startWarmup: $("startWarmup"),
    startEndless: $("startEndless"),

    modeShrink: $("modeShrink"),
    modeFalling: $("modeFalling"),
    modeFallingShrink: $("modeFallingShrink"),

    sheetOverlay: $("sheetOverlay"),
    sheetClose: $("sheetClose"),
    sheetTitle: $("sheetTitle"),
    sheetSubtitle: $("sheetSubtitle"),
    diffEasy: $("diffEasy"),
    diffMed: $("diffMed"),
    diffHard: $("diffHard"),
    diffEasyMeta: $("diffEasyMeta"),
    diffMedMeta: $("diffMedMeta"),
    diffHardMeta: $("diffHardMeta"),

    playfield: $("playfield"),
    pace: $("pace"),
    paceFill: $("paceFill"),
    fieldFlash: $("fieldFlash"),

    quitBtn: $("quitBtn"),
    modePill: $("modePill"),
    phasePill: $("phasePill"),
    timer: $("timer"),
    score: $("score"),
    lives: $("lives"),
    hint: $("hint"),

    streak: $("streak"),
    best: $("best"),

    resultTitle: $("resultTitle"),
    resultSubtitle: $("resultSubtitle"),
    resultStats: $("resultStats"),

    replayBtn: $("replayBtn"),
    homeBtn: $("homeBtn"),
    closeBtn: $("closeBtn"),
  };

  const screens = [el.home, el.game, el.result];

  function showScreen(node) {
    screens.forEach(s => s.classList.remove("active"));
    node.classList.add("active");
  }

  /* ==========
     Theme (Telegram)
     ========== */
  function hexToRgb(hex) {
    if (!hex || typeof hex !== "string") return null;
    const h = hex.replace("#", "").trim();
    if (h.length !== 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }

  function applyTelegramTheme() {
    if (!tg || !tg.themeParams) return;
    const root = document.documentElement;
    const rgb = hexToRgb(tg.themeParams.button_color);
    if (rgb) {
      root.style.setProperty("--accent", tg.themeParams.button_color);
      root.style.setProperty("--accentRgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
  }

  /* ==========
     Toast
     ========== */
  let toastTimer = null;
  function toast(msg) {
    if (!msg) return;
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1200);
  }

  /* ==========
     Haptics
     ========== */
  const Haptic = {
    light() {
      if (!tg?.HapticFeedback?.impactOccurred) return;
      tgSafe(tg.HapticFeedback.impactOccurred.bind(tg.HapticFeedback), "light");
    },
    error() {
      if (!tg?.HapticFeedback?.notificationOccurred) return;
      tgSafe(tg.HapticFeedback.notificationOccurred.bind(tg.HapticFeedback), "error");
    },
  };

  /* ==========
     Sound (pleasant, short)
     ========== */
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  }

  function playHitSound() {
    ensureAudio();
    const now = audioCtx.currentTime;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);

    const o1 = audioCtx.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(820, now);
    o1.frequency.exponentialRampToValueAtTime(620, now + 0.08);

    const o2 = audioCtx.createOscillator();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(410, now);
    o2.frequency.exponentialRampToValueAtTime(320, now + 0.08);

    o1.connect(gain);
    o2.connect(gain);
    gain.connect(audioCtx.destination);

    o1.start(now); o2.start(now);
    o1.stop(now + 0.11); o2.stop(now + 0.11);
  }

  function playMissSound() {
    ensureAudio();
    const now = audioCtx.currentTime;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    const o = audioCtx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(120, now + 0.12);

    o.connect(gain);
    gain.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + 0.15);
  }

  /* ==========
     Storage
     ========== */
  const store = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch {}
    }
  };

  const KEYS = {
    bestEndless: "csaim.bestEndless",
    streak: "csaim.streak",
    lastTrainingDay: "csaim.lastTrainingDay",
  };

  function bestKey(mode, diff) {
    return `csaim.best.${mode}.${diff}`;
  }

  function dayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function diffDays(aKey, bKey) {
    const [ay, am, ad] = aKey.split("-").map(Number);
    const [by, bm, bd] = bKey.split("-").map(Number);
    const a = new Date(ay, am - 1, ad);
    const b = new Date(by, bm - 1, bd);
    return Math.round((b - a) / (24 * 60 * 60 * 1000));
  }

  function markTrainingComplete() {
    const today = dayKey();
    const last = store.get(KEYS.lastTrainingDay, null);
    let streak = Number(store.get(KEYS.streak, "0"));

    if (last === today) return;
    if (!last) streak = 1;
    else streak = (diffDays(last, today) === 1) ? (streak + 1) : 1;

    store.set(KEYS.lastTrainingDay, today);
    store.set(KEYS.streak, String(streak));
  }

  function updateHomeStats() {
    const streak = Number(store.get(KEYS.streak, "0"));
    const best = Number(store.get(KEYS.bestEndless, "0"));
    el.streak.textContent = streak ? `🔥 ${streak}` : "—";
    el.best.textContent = best ? `${best}` : "—";
  }

  /* ==========
     Loader (2.5s)
     ========== */
  function runLoader(ms = 2500) {
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      const pct = Math.round(t * 100);
      el.loaderBar.style.width = `${pct}%`;
      el.loaderPct.textContent = `${pct}%`;

      if (t < 1) requestAnimationFrame(tick);
      else {
        el.loader.classList.add("done");
        setTimeout(() => {
          el.loader.style.display = "none";
          showScreen(el.home);
        }, 240);
      }
    }
    requestAnimationFrame(tick);
  }

  /* ==========
     Small helpers
     ========== */
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  function fieldSize() {
    const r = el.playfield.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function setPaceHidden(hidden) {
    el.pace.classList.toggle("pace--hidden", !!hidden);
  }

  function animatePace(ms) {
    setPaceHidden(false);
    el.paceFill.style.transition = "none";
    el.paceFill.style.width = "100%";
    el.paceFill.offsetHeight;
    el.paceFill.style.transition = `width ${ms}ms linear`;
    el.paceFill.style.width = "0%";
  }

  function flashMiss() {
    el.fieldFlash.style.opacity = "1";
    el.playfield.classList.add("shake");
    setTimeout(() => { el.fieldFlash.style.opacity = "0"; }, 160);
    setTimeout(() => { el.playfield.classList.remove("shake"); }, 240);
  }

  /* ==========================
     Difficulty Sheet
     ========================== */
  const modeInfo = {
    shrink: {
      title: "Shrink Arena",
      subtitle: "На экране несколько больших шаров. Они сами уменьшаются — успей нажать до исчезновения.",
      meta: {
        easy: "3 шара • ~3.2с жизни",
        med:  "4 шара • ~2.7с жизни",
        hard: "5 шаров • ~2.3с жизни",
      }
    },
    falling: {
      title: "Falling",
      subtitle: "Шары падают сверху вниз. Успей нажать до нижней границы.",
      meta: {
        easy: "до 6 • темп ×1.0",
        med:  "до 10 • темп ×1.25",
        hard: "до 15 • темп ×1.55",
      }
    },
    fallshrink: {
      title: "Falling + Shrink",
      subtitle: "Падают и одновременно уменьшаются. Успей нажать до исчезновения или падения.",
      meta: {
        easy: "до 6 • shrink мягкий",
        med:  "до 10 • shrink быстрее",
        hard: "до 15 • shrink жёсткий",
      }
    }
  };

  let pendingMode = null;

  function openSheet(modeKey) {
    pendingMode = modeKey;
    const info = modeInfo[modeKey];

    el.sheetTitle.textContent = info.title;
    el.sheetSubtitle.textContent = info.subtitle;
    el.diffEasyMeta.textContent = info.meta.easy;
    el.diffMedMeta.textContent = info.meta.med;
    el.diffHardMeta.textContent = info.meta.hard;

    el.sheetOverlay.classList.remove("hidden");
    el.sheetOverlay.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    el.sheetOverlay.classList.add("hidden");
    el.sheetOverlay.setAttribute("aria-hidden", "true");
    pendingMode = null;
  }

  el.sheetClose.addEventListener("click", closeSheet);
  el.sheetOverlay.addEventListener("click", (e) => {
    if (e.target === el.sheetOverlay) closeSheet();
  });

  /* ==========================
     Sessions: Warmup + Endless
     ========================== */
  const WARMUP = {
    totalSec: 180,
    lives: 3,
    phases: [
      { key: "reaction", label: "Reaction", sec: 45, size: 34, lifetimeMs: 1300, delayMin: 360, delayMax: 920, moving: false },
      { key: "flick",    label: "Flick",    sec: 70, size: 28, lifetimeMs: 1600, delayMin: 0,   delayMax: 0,   moving: false },
      { key: "control",  label: "Control",  sec: 65, size: 28, lifetimeMs: 0,    delayMin: 0,   delayMax: 0,   moving: true,  speed: 0.22 },
    ]
  };

  /* ==========================
     New Modes (Arcade)
     Правило: любой промах = поражение
     ========================== */

  // Под "реально ставить рекорды" — значит, что темпы не безумные:
  // hard должен быть сложным, но проходимым и на телефоне.
  const ARCADE = {
    // Mode 1: Shrink Arena
    // N шаров одновременно. Каждый шар сам уменьшается.
    // Если шар исчез (достиг minSize) => поражение.
    shrink: {
      easy: { balls: 3, baseSize: 58, minSize: 12, shrinkTimeMs: 3200, respawnDelayMs: 230 },
      med:  { balls: 4, baseSize: 54, minSize: 12, shrinkTimeMs: 2700, respawnDelayMs: 210 },
      hard: { balls: 5, baseSize: 50, minSize: 12, shrinkTimeMs: 2300, respawnDelayMs: 190 },
    },
    // Mode 2: Falling
    // Шары падают, если коснулись низа => поражение.
    falling: {
      easy: { maxActive: 6,  size: 36, spawnEveryMs: 600, fallSpeed: 0.24 },
      med:  { maxActive: 10, size: 34, spawnEveryMs: 470, fallSpeed: 0.32 },
      hard: { maxActive: 15, size: 32, spawnEveryMs: 380, fallSpeed: 0.40 },
    },
    // Mode 3: Falling + Shrink
    // Падают и уменьшаются одновременно. Исчез или упал => поражение.
    fallshrink: {
      easy: { maxActive: 6,  baseSize: 40, minSize: 12, shrinkTimeMs: 2600, spawnEveryMs: 650, fallSpeed: 0.20 },
      med:  { maxActive: 10, baseSize: 38, minSize: 12, shrinkTimeMs: 2200, spawnEveryMs: 520, fallSpeed: 0.27 },
      hard: { maxActive: 15, baseSize: 36, minSize: 12, shrinkTimeMs: 1900, spawnEveryMs: 440, fallSpeed: 0.34 },
    }
  };

  /* ==========================
     Runtime state
     ========================== */
  const state = {
    mode: null,        // warmup | endless | shrink | falling | fallshrink
    diff: null,        // easy | med | hard
    running: false,

    // warmup
    totalLeft: 0,
    phaseIndex: 0,
    phaseLeft: 0,
    lives: 0,

    // common stats
    hits: 0,
    misses: 0,

    // warmup stats
    reactionMs: [],
    flickMs: [],
    controlHits: 0,

    // warmup target
    targetEl: null,
    spawnedAt: 0,
    targetLifeId: null,
    spawnDelayId: null,

    // warmup moving
    rafId: null,
    lastRaf: 0,
    vel: { x: 0, y: 0 },

    // arcade objects
    objects: [],
    arcadeRaf: null,
    lastArcade: 0,
    spawnTimer: null,
  };

  let tickId = null;

  function clearTimers() {
    if (tickId) { clearInterval(tickId); tickId = null; }
    if (state.targetLifeId) { clearTimeout(state.targetLifeId); state.targetLifeId = null; }
    if (state.spawnDelayId) { clearTimeout(state.spawnDelayId); state.spawnDelayId = null; }
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    if (state.arcadeRaf) { cancelAnimationFrame(state.arcadeRaf); state.arcadeRaf = null; }
    if (state.spawnTimer) { clearInterval(state.spawnTimer); state.spawnTimer = null; }
  }

  function clearTarget() {
    if (state.targetEl) {
      state.targetEl.remove();
      state.targetEl = null;
    }
  }

  function clearArcadeObjects() {
    for (const o of state.objects) o.el?.remove();
    state.objects = [];
  }

  function setHint(text) { el.hint.textContent = text || ""; }

  function renderLives() {
    el.lives.innerHTML = "";
    for (let i = 0; i < WARMUP.lives; i++) {
      const dot = document.createElement("div");
      dot.className = "lifeDot" + (i < state.lives ? " lifeDot--on" : "");
      el.lives.appendChild(dot);
    }
  }

  function setHeaderUI() {
    const isWarmup = state.mode === "warmup";
    const isEndless = state.mode === "endless";
    const isArcade = state.mode === "shrink" || state.mode === "falling" || state.mode === "fallshrink";

    if (isWarmup) {
      el.modePill.textContent = "Warm-up";
      el.phasePill.style.display = "inline-flex";
      el.timer.style.display = "inline-flex";
      el.score.style.display = "inline-flex";
      el.timer.textContent = fmtTime(state.totalLeft);
      el.score.textContent = `Hits ${state.hits}`;
      renderLives();
      setPaceHidden(true);
      return;
    }

    if (isEndless) {
      el.modePill.textContent = "Endless";
      el.phasePill.style.display = "none";
      el.timer.style.display = "none";
      el.score.style.display = "inline-flex";
      el.score.textContent = `Score ${state.hits}`;
      el.lives.innerHTML = "";
      setPaceHidden(false);
      return;
    }

    if (isArcade) {
      const nice =
        state.mode === "shrink" ? "Shrink" :
        state.mode === "falling" ? "Falling" :
        "Fall+Shrink";

      const d = state.diff ? state.diff.toUpperCase() : "";
      el.modePill.textContent = `${nice} ${d}`;
      el.phasePill.style.display = "none";
      el.timer.style.display = "none";
      el.score.style.display = "inline-flex";
      el.score.textContent = `Score ${state.hits}`;
      el.lives.innerHTML = "";
      setPaceHidden(true);
    }
  }

  /* ==========================
     Warm-up + Endless mechanics
     ========================== */
  function currentPhase() { return WARMUP.phases[state.phaseIndex]; }

  function stopMotion() {
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
  }

  function setTargetPos(t, x, y) { t.style.left = `${x}px`; t.style.top = `${y}px`; }

  function startMotion(speed) {
    stopMotion();
    const angle = Math.random() * Math.PI * 2;
    const v = clamp(speed || 0.20, 0.12, 0.55);
    state.vel.x = Math.cos(angle) * v;
    state.vel.y = Math.sin(angle) * v;
    state.lastRaf = performance.now();

    const step = (now) => {
      if (!state.running || !state.targetEl) return;
      const dt = now - state.lastRaf;
      state.lastRaf = now;

      const size = state.targetEl.getBoundingClientRect().width;
      const { w, h } = fieldSize();

      let x = parseFloat(state.targetEl.style.left || "0");
      let y = parseFloat(state.targetEl.style.top || "0");

      x += state.vel.x * dt;
      y += state.vel.y * dt;

      if (x <= 0) { x = 0; state.vel.x *= -1; }
      if (y <= 0) { y = 0; state.vel.y *= -1; }
      if (x >= (w - size)) { x = Math.max(0, w - size); state.vel.x *= -1; }
      if (y >= (h - size)) { y = Math.max(0, h - size); state.vel.y *= -1; }

      setTargetPos(state.targetEl, x, y);
      state.rafId = requestAnimationFrame(step);
    };

    state.rafId = requestAnimationFrame(step);
  }

  function randomPos(size) {
    const { w, h } = fieldSize();
    return {
      x: Math.random() * Math.max(0, (w - size)),
      y: Math.random() * Math.max(0, (h - size)),
    };
  }

  function spawnSingleTarget({ size, lifetimeMs, moving, speed, withPace } = {}) {
    clearTarget();
    clearTimeout(state.targetLifeId);

    const t = document.createElement("div");
    t.className = "target";
    t.style.width = `${size}px`;
    t.style.height = `${size}px`;

    const pos = randomPos(size);
    setTargetPos(t, pos.x, pos.y);

    t.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onHit();
    }, { passive: false });

    el.playfield.appendChild(t);
    state.targetEl = t;
    state.spawnedAt = performance.now();

    if (moving) startMotion(speed);
    else stopMotion();

    if (lifetimeMs && lifetimeMs > 0) {
      state.targetLifeId = setTimeout(() => registerMiss("timeout"), lifetimeMs);
    }

    if (withPace && lifetimeMs && lifetimeMs > 0) animatePace(lifetimeMs);
  }

  function scheduleReactionSpawn() {
    clearTimeout(state.spawnDelayId);
    clearTarget();

    const ph = currentPhase();
    const delay = ph.delayMin + Math.random() * (ph.delayMax - ph.delayMin);

    state.spawnDelayId = setTimeout(() => {
      if (!state.running || state.mode !== "warmup") return;
      spawnSingleTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
    }, delay);
  }

  function startPhase(index) {
    state.phaseIndex = index;
    const ph = currentPhase();
    state.phaseLeft = ph.sec;

    toast(ph.label);
    el.phasePill.textContent = ph.label;
    setHeaderUI();

    if (ph.key === "reaction") {
      scheduleReactionSpawn();
      setHint("Жди цель → нажми быстро");
    } else if (ph.key === "flick") {
      spawnSingleTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
      setHint("Флик. Точность важнее скорости");
    } else {
      spawnSingleTarget({ size: ph.size, lifetimeMs: 0, moving: true, speed: ph.speed });
      setHint("Контроль. Попади по движущейся цели");
    }
  }

  function advancePhaseIfNeeded() {
    if (state.mode !== "warmup") return;
    if (state.phaseLeft > 0) return;
    const next = state.phaseIndex + 1;
    if (next >= WARMUP.phases.length) {
      endSession("Разминка завершена");
      return;
    }
    startPhase(next);
  }

  function endlessParams(score) {
    const size = clamp(32 - Math.floor(score / 6), 18, 32);
    const lifetimeMs = clamp(1400 - score * 18, 380, 1400);
    const moving = score >= 18;
    const speed = clamp(0.14 + score * 0.003, 0.14, 0.46);
    return { size, lifetimeMs, moving, speed };
  }

  /* ==========================
     Arcade object engine
     ========================== */

  function makeBall({ x, y, size, vy = 0, shrinkTimeMs = 0, minSize = 0, kind }) {
    const b = document.createElement("div");
    b.className = "target";
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;

    const shrinkRate = (shrinkTimeMs > 0 && size > minSize)
      ? (size - minSize) / shrinkTimeMs
      : 0;

    const obj = {
      id: (crypto?.randomUUID ? crypto.randomUUID() : String(Math.random())),
      el: b,
      x, y,
      size,
      vy, // px/ms
      minSize,
      shrinkRate, // px/ms
      kind,
      alive: true,
    };

    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      arcadeHit(obj);
    }, { passive: false });

    el.playfield.appendChild(b);
    return obj;
  }

  function removeBall(obj) {
    obj.alive = false;
    obj.el?.remove();
  }

  function arcadeHit(obj) {
    if (!state.running) return;

    playHitSound();
    Haptic.light();

    // В новых режимах клик по шару = remove + score
    removeBall(obj);
    state.hits += 1;
    el.score.textContent = `Score ${state.hits}`;

    // Для Shrink Arena: держим постоянное число шаров — спавним замену с небольшой задержкой
    if (state.mode === "shrink") {
      const p = ARCADE.shrink[state.diff];
      setTimeout(() => {
        if (!state.running || state.mode !== "shrink") return;
        spawnShrinkBall();
      }, p.respawnDelayMs);
    }
  }

  function arcadeDefeat(reason) {
    if (!state.running) return;

    state.misses += 1;
    playMissSound();
    Haptic.error();
    flashMiss();

    if (reason === "empty") endSession("Промах");
    else if (reason === "shrink") endSession("Шар исчез");
    else if (reason === "bottom") endSession("Шар упал вниз");
    else endSession("Поражение");
  }

  /* ---- Mode 1: Shrink Arena ---- */
  function spawnShrinkBall() {
    const p = ARCADE.shrink[state.diff];
    const { w, h } = fieldSize();

    const size = p.baseSize;
    const x = Math.random() * Math.max(0, w - size);
    const y = Math.random() * Math.max(0, h - size);

    const obj = makeBall({
      x, y,
      size,
      vy: 0,
      shrinkTimeMs: p.shrinkTimeMs,
      minSize: p.minSize,
      kind: "shrink"
    });

    state.objects.push(obj);
  }

  function startShrinkArena(diff) {
    state.mode = "shrink";
    state.diff = diff;
    state.running = true;
    state.hits = 0;
    state.misses = 0;

    clearTimers();
    clearTarget();
    clearArcadeObjects();
    stopMotion();

    setPaceHidden(true);
    showScreen(el.game);

    el.phasePill.style.display = "none";
    el.timer.style.display = "none";
    el.lives.innerHTML = "";
    setHeaderUI();

    const p = ARCADE.shrink[diff];
    setHint("Шары уменьшаются сами. Успей нажать до исчезновения. Любой промах = поражение.");

    // initial spawn
    for (let i = 0; i < p.balls; i++) spawnShrinkBall();

    state.lastArcade = performance.now();
    state.arcadeRaf = requestAnimationFrame(function loop(now){
      if (!state.running || state.mode !== "shrink") return;
      const dt = now - state.lastArcade;
      state.lastArcade = now;

      const { w, h } = fieldSize();

      for (const obj of state.objects) {
        if (!obj.alive) continue;

        // auto-shrink
        if (obj.shrinkRate > 0) {
          const old = obj.size;
          const next = old - obj.shrinkRate * dt;

          if (next <= obj.minSize) {
            removeBall(obj);
            arcadeDefeat("shrink");
            return;
          }

          // keep center while shrinking
          const delta = old - next;
          obj.size = next;
          obj.x += delta / 2;
          obj.y += delta / 2;

          // clamp inside playfield
          obj.x = clamp(obj.x, 0, Math.max(0, w - obj.size));
          obj.y = clamp(obj.y, 0, Math.max(0, h - obj.size));

          obj.el.style.width = `${obj.size}px`;
          obj.el.style.height = `${obj.size}px`;
          obj.el.style.left = `${obj.x}px`;
          obj.el.style.top = `${obj.y}px`;
        }
      }

      state.objects = state.objects.filter(o => o.alive);
      state.arcadeRaf = requestAnimationFrame(loop);
    });
  }

  /* ---- Mode 2: Falling ---- */
  function spawnFallingBall() {
    const p = ARCADE.falling[state.diff];
    const { w } = fieldSize();

    const size = p.size;
    const x = Math.random() * Math.max(0, w - size);
    const y = -size - 6;

    const obj = makeBall({
      x, y,
      size,
      vy: p.fallSpeed,
      shrinkTimeMs: 0,
      minSize: 0,
      kind: "falling"
    });

    state.objects.push(obj);
  }

  function startFalling(diff) {
    state.mode = "falling";
    state.diff = diff;
    state.running = true;
    state.hits = 0;
    state.misses = 0;

    clearTimers();
    clearTarget();
    clearArcadeObjects();
    stopMotion();

    setPaceHidden(true);
    showScreen(el.game);

    el.phasePill.style.display = "none";
    el.timer.style.display = "none";
    el.lives.innerHTML = "";
    setHeaderUI();

    const p = ARCADE.falling[diff];
    setHint(`Сбей шар до падения. Макс на экране: ${p.maxActive}. Любой промах = поражение.`);

    state.spawnTimer = setInterval(() => {
      if (!state.running || state.mode !== "falling") return;
      const alive = state.objects.filter(o => o.alive).length;
      if (alive < p.maxActive) spawnFallingBall();
    }, p.spawnEveryMs);

    state.lastArcade = performance.now();
    state.arcadeRaf = requestAnimationFrame(function loop(now){
      if (!state.running || state.mode !== "falling") return;
      const dt = now - state.lastArcade;
      state.lastArcade = now;

      const { h } = fieldSize();

      for (const obj of state.objects) {
        if (!obj.alive) continue;

        obj.y += obj.vy * dt;
        obj.el.style.top = `${obj.y}px`;

        if (obj.y + obj.size >= h - 2) {
          removeBall(obj);
          arcadeDefeat("bottom");
          return;
        }
      }

      state.objects = state.objects.filter(o => o.alive);
      state.arcadeRaf = requestAnimationFrame(loop);
    });
  }

  /* ---- Mode 3: Falling + Shrink ---- */
  function spawnFallingShrinkBall() {
    const p = ARCADE.fallshrink[state.diff];
    const { w } = fieldSize();

    const size = p.baseSize;
    const x = Math.random() * Math.max(0, w - size);
    const y = -size - 6;

    const obj = makeBall({
      x, y,
      size,
      vy: p.fallSpeed,
      shrinkTimeMs: p.shrinkTimeMs,
      minSize: p.minSize,
      kind: "fallshrink"
    });

    state.objects.push(obj);
  }

  function startFallingShrink(diff) {
    state.mode = "fallshrink";
    state.diff = diff;
    state.running = true;
    state.hits = 0;
    state.misses = 0;

    clearTimers();
    clearTarget();
    clearArcadeObjects();
    stopMotion();

    setPaceHidden(true);
    showScreen(el.game);

    el.phasePill.style.display = "none";
    el.timer.style.display = "none";
    el.lives.innerHTML = "";
    setHeaderUI();

    const p = ARCADE.fallshrink[diff];
    setHint(`Падают и уменьшаются. Успей нажать до исчезновения/падения. Любой промах = поражение.`);

    state.spawnTimer = setInterval(() => {
      if (!state.running || state.mode !== "fallshrink") return;
      const alive = state.objects.filter(o => o.alive).length;
      if (alive < p.maxActive) spawnFallingShrinkBall();
    }, p.spawnEveryMs);

    state.lastArcade = performance.now();
    state.arcadeRaf = requestAnimationFrame(function loop(now){
      if (!state.running || state.mode !== "fallshrink") return;
      const dt = now - state.lastArcade;
      state.lastArcade = now;

      const { w, h } = fieldSize();

      for (const obj of state.objects) {
        if (!obj.alive) continue;

        // fall
        obj.y += obj.vy * dt;

        // shrink
        if (obj.shrinkRate > 0) {
          const old = obj.size;
          const next = old - obj.shrinkRate * dt;

          if (next <= obj.minSize) {
            removeBall(obj);
            arcadeDefeat("shrink");
            return;
          }

          const delta = old - next;
          obj.size = next;

          // keep center while shrinking
          obj.x += delta / 2;
          obj.y += delta / 2;

          obj.x = clamp(obj.x, 0, Math.max(0, w - obj.size));
          // y can be negative while above top
          obj.y = clamp(obj.y, -obj.size - 60, Math.max(0, h - obj.size));

          obj.el.style.width = `${obj.size}px`;
          obj.el.style.height = `${obj.size}px`;
        }

        obj.el.style.left = `${obj.x}px`;
        obj.el.style.top = `${obj.y}px`;

        if (obj.y + obj.size >= h - 2) {
          removeBall(obj);
          arcadeDefeat("bottom");
          return;
        }
      }

      state.objects = state.objects.filter(o => o.alive);
      state.arcadeRaf = requestAnimationFrame(loop);
    });
  }

  /* ==========================
     Hit/Miss (Warmup/Endless)
     ========================== */
  function onHit() {
    if (!state.running) return;

    const now = performance.now();
    const dt = now - state.spawnedAt;

    state.hits += 1;

    if (state.mode === "warmup") {
      const ph = currentPhase();
      if (ph?.key === "reaction") state.reactionMs.push(dt);
      if (ph?.key === "flick") state.flickMs.push(dt);
      if (ph?.key === "control") state.controlHits += 1;
    }

    playHitSound();
    Haptic.light();

    setHeaderUI();

    if (state.mode === "warmup") {
      const ph = currentPhase();
      clearTimeout(state.targetLifeId);
      state.targetLifeId = null;

      if (ph.key === "reaction") scheduleReactionSpawn();
      else if (ph.key === "flick") spawnSingleTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
      else spawnSingleTarget({ size: ph.size, lifetimeMs: 0, moving: true, speed: ph.speed });
      return;
    }

    if (state.mode === "endless") {
      const p = endlessParams(state.hits);
      spawnSingleTarget({ size: p.size, lifetimeMs: p.lifetimeMs, moving: p.moving, speed: p.speed, withPace: true });
      el.score.textContent = `Score ${state.hits}`;
    }
  }

  function registerMiss(reason = "miss") {
    if (!state.running) return;

    // Arcade: клик по пустоте = поражение
    if (state.mode === "shrink" || state.mode === "falling" || state.mode === "fallshrink") {
      arcadeDefeat("empty");
      return;
    }

    // Warmup: in reaction phase ignore early click if no target yet
    if (state.mode === "warmup") {
      const ph = currentPhase();
      if (ph?.key === "reaction" && !state.targetEl && reason === "click") {
        toast("Рано 🙂");
        return;
      }
    }

    state.misses += 1;
    playMissSound();
    Haptic.error();
    flashMiss();

    if (state.mode === "warmup") {
      state.lives -= 1;
      setHeaderUI();

      if (state.lives <= 0) {
        endSession("Ошибки закончились");
        return;
      }

      toast("Минус жизнь");

      const ph = currentPhase();
      clearTimeout(state.targetLifeId);
      state.targetLifeId = null;

      if (ph.key === "reaction") scheduleReactionSpawn();
      else if (ph.key === "flick") spawnSingleTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
      else spawnSingleTarget({ size: ph.size, lifetimeMs: 0, moving: true, speed: ph.speed });

      return;
    }

    endSession(reason === "timeout" ? "Время вышло" : "Промах");
  }

  /* ==========================
     Session start/stop
     ========================== */
  function resetBase(mode) {
    clearTimers();
    clearTarget();
    clearArcadeObjects();
    stopMotion();

    state.mode = mode;
    state.diff = null;
    state.running = true;

    state.hits = 0;
    state.misses = 0;

    state.reactionMs = [];
    state.flickMs = [];
    state.controlHits = 0;
  }

  function startWarmup() {
    resetBase("warmup");
    state.totalLeft = WARMUP.totalSec;
    state.phaseIndex = 0;
    state.phaseLeft = WARMUP.phases[0].sec;
    state.lives = WARMUP.lives;

    showScreen(el.game);

    el.phasePill.style.display = "inline-flex";
    el.timer.style.display = "inline-flex";
    el.score.style.display = "inline-flex";

    setHeaderUI();
    startPhase(0);

    tickId = setInterval(() => {
      if (!state.running || state.mode !== "warmup") return;

      state.totalLeft -= 1;
      state.phaseLeft -= 1;

      el.timer.textContent = fmtTime(Math.max(0, state.totalLeft));
      el.score.textContent = `Hits ${state.hits}`;

      if (state.totalLeft <= 0) {
        endSession("Разминка завершена");
        return;
      }
      advancePhaseIfNeeded();
    }, 1000);
  }

  function startEndless() {
    resetBase("endless");
    showScreen(el.game);

    setHeaderUI();
    setHint("Endless: промах или таймаут = конец");

    const p = endlessParams(0);
    spawnSingleTarget({ size: p.size, lifetimeMs: p.lifetimeMs, moving: p.moving, speed: p.speed, withPace: true });
    el.score.textContent = `Score ${state.hits}`;
  }

  function endSession(title) {
    if (!state.running) return;

    state.running = false;
    clearTimers();
    clearTarget();
    clearArcadeObjects();
    stopMotion();

    // Save best
    if (state.mode === "endless") {
      const best = Number(store.get(KEYS.bestEndless, "0"));
      store.set(KEYS.bestEndless, String(Math.max(best, state.hits)));
    }

    if (state.mode === "shrink" || state.mode === "falling" || state.mode === "fallshrink") {
      const key = bestKey(state.mode, state.diff);
      const best = Number(store.get(key, "0"));
      store.set(key, String(Math.max(best, state.hits)));
    }

    markTrainingComplete();
    updateHomeStats();

    el.resultTitle.textContent = title || "Готово";

    if (state.mode === "warmup") el.resultSubtitle.textContent = "Разогрелся. Дальше — катка.";
    else if (state.mode === "endless") el.resultSubtitle.textContent = "Ещё попытка — и будет выше.";
    else el.resultSubtitle.textContent = "Жёстко. Но рекорды именно так и делаются.";

    if (state.mode === "warmup") {
      const hits = state.hits;
      const misses = state.misses;
      const acc = (hits + misses) > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
      const avg = (arr) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0) / arr.length) : null;

      const avgReaction = avg(state.reactionMs);
      const avgFlick = avg(state.flickMs);

      el.resultStats.innerHTML = `
        <div><b>Сводка</b></div>
        <div>Попаданий: <b>${hits}</b></div>
        <div>Ошибок: <b>${misses}</b> (жизни: ${WARMUP.lives})</div>
        <div>Точность: <b>${acc}%</b></div>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:12px 0;">
        <div><b>Фазы</b></div>
        <div>Reaction: ${avgReaction === null ? "—" : `<b>${avgReaction} ms</b> (avg)`}</div>
        <div>Flick: ${avgFlick === null ? "—" : `<b>${avgFlick} ms</b> (avg)`}</div>
        <div>Control: <b>${state.controlHits}</b> попаданий</div>
      `;
      el.replayBtn.textContent = "Ещё разминка";
    } else if (state.mode === "endless") {
      const score = state.hits;
      const best = Number(store.get(KEYS.bestEndless, "0"));
      el.resultStats.innerHTML = `
        <div><b>Endless</b></div>
        <div>Счёт: <b>${score}</b></div>
        <div>Рекорд: <b>${best}</b></div>
        <div style="color: rgba(255,255,255,0.62); margin-top: 6px;">Промах или таймаут завершает раунд.</div>
      `;
      el.replayBtn.textContent = "Играть ещё";
    } else {
      const score = state.hits;
      const key = bestKey(state.mode, state.diff);
      const best = Number(store.get(key, "0"));

      const nice =
        state.mode === "shrink" ? "Shrink Arena" :
        state.mode === "falling" ? "Falling" :
        "Falling + Shrink";

      el.resultStats.innerHTML = `
        <div><b>${nice}</b> • ${String(state.diff).toUpperCase()}</div>
        <div>Счёт: <b>${score}</b></div>
        <div>Рекорд: <b>${best}</b></div>
        <div style="color: rgba(255,255,255,0.62); margin-top: 6px;">Любой промах завершает раунд.</div>
      `;
      el.replayBtn.textContent = "Ещё попытка";
    }

    setHint("");
    showScreen(el.result);
  }

  /* ==========================
     Input (miss)
     ========================== */
  el.playfield.addEventListener("pointerdown", () => {
    if (!state.running) return;
    registerMiss("click");
  });

  el.quitBtn.addEventListener("click", () => {
    if (!state.running) return;
    endSession("Остановлено");
  });

  /* ==========================
     Result actions
     ========================== */
  el.replayBtn.addEventListener("click", () => {
    ensureAudio();
    if (state.mode === "endless") startEndless();
    else if (state.mode === "warmup") startWarmup();
    else if (state.mode === "shrink") startShrinkArena(state.diff);
    else if (state.mode === "falling") startFalling(state.diff);
    else if (state.mode === "fallshrink") startFallingShrink(state.diff);
  });

  el.homeBtn.addEventListener("click", () => showScreen(el.home));

  el.closeBtn.addEventListener("click", () => {
    if (tg && typeof tg.close === "function") tgSafe(tg.close.bind(tg));
    else showScreen(el.home);
  });

  /* ==========================
     Home actions
     ========================== */
  el.startWarmup.addEventListener("click", () => { ensureAudio(); startWarmup(); });
  el.startEndless.addEventListener("click", () => { ensureAudio(); startEndless(); });

  el.modeShrink.addEventListener("click", () => openSheet("shrink"));
  el.modeFalling.addEventListener("click", () => openSheet("falling"));
  el.modeFallingShrink.addEventListener("click", () => openSheet("fallshrink"));

  function startPendingDiff(diff) {
    if (!pendingMode) return;
    ensureAudio();
    const mode = pendingMode; // preserve before close
    closeSheet();

    requestAnimationFrame(() => {
      if (mode === "shrink") startShrinkArena(diff);
      if (mode === "falling") startFalling(diff);
      if (mode === "fallshrink") startFallingShrink(diff);
    });
  }

  el.diffEasy.addEventListener("click", () => startPendingDiff("easy"));
  el.diffMed.addEventListener("click", () => startPendingDiff("med"));
  el.diffHard.addEventListener("click", () => startPendingDiff("hard"));

  /* ==========================
     Resize safety
     ========================== */
  window.addEventListener("resize", () => {
    if (!state.running) return;

    // Arcade: clamp objects into bounds (avoid offscreen after rotate)
    if (state.mode === "shrink" || state.mode === "falling" || state.mode === "fallshrink") {
      const { w, h } = fieldSize();
      for (const obj of state.objects) {
        if (!obj.alive) continue;
        obj.x = clamp(obj.x, 0, Math.max(0, w - obj.size));
        obj.y = clamp(obj.y, -obj.size - 80, Math.max(0, h - obj.size));
        obj.el.style.left = `${obj.x}px`;
        obj.el.style.top = `${obj.y}px`;
      }
      return;
    }

    // Warmup/Endless: respawn target
    if (state.mode === "warmup") {
      const ph = currentPhase();
      if (!ph) return;
      if (ph.key === "reaction") { if (state.targetEl) spawnSingleTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false }); }
      else if (ph.key === "flick") spawnSingleTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
      else spawnSingleTarget({ size: ph.size, lifetimeMs: 0, moving: true, speed: ph.speed });
    } else if (state.mode === "endless") {
      const p = endlessParams(state.hits);
      spawnSingleTarget({ size: p.size, lifetimeMs: p.lifetimeMs, moving: p.moving, speed: p.speed, withPace: true });
    }
  });

  /* ==========================
     Init
     ========================== */
  applyTelegramTheme();
  updateHomeStats();
  showScreen(el.home);
  runLoader(2500);

})();
