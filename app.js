(() => {
  "use strict";

  /* ==========================
     Telegram-safe integration
     ========================== */
  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  function tgSafe(fn, ...args) {
    try {
      if (!tg) return;
      if (typeof fn === "function") fn(...args);
    } catch (_) {}
  }

  // Make it feel native inside Telegram
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
    for (const s of screens) s.classList.remove("active");
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
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  function applyTelegramTheme() {
    if (!tg || !tg.themeParams) return;

    const root = document.documentElement;
    const p = tg.themeParams;

    // Prefer Telegram button color as accent if it looks valid.
    const rgb = hexToRgb(p.button_color);
    if (rgb) {
      root.style.setProperty("--accent", p.button_color);
      root.style.setProperty("--accentRgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }

    // Optional: align Telegram container colors (best effort)
    if (typeof tg.setBackgroundColor === "function" && p.bg_color) {
      tgSafe(tg.setBackgroundColor.bind(tg), p.bg_color);
    }
    if (typeof tg.setHeaderColor === "function" && p.secondary_bg_color) {
      tgSafe(tg.setHeaderColor.bind(tg), p.secondary_bg_color);
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
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function playHitSound() {
    ensureAudio();
    if (!audioCtx) return;

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

    o1.start(now);
    o2.start(now);
    o1.stop(now + 0.11);
    o2.stop(now + 0.11);
  }

  function playMissSound() {
    ensureAudio();
    if (!audioCtx) return;

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
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    }
  };

  const KEYS = {
    bestEndless: "csaim.bestEndless",
    streak: "csaim.streak",
    lastTrainingDay: "csaim.lastTrainingDay",
  };

  function dayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function diffDays(aKey, bKey) {
    // local date diff in days (approx reliable for our use)
    const [ay, am, ad] = aKey.split("-").map(Number);
    const [by, bm, bd] = bKey.split("-").map(Number);
    const a = new Date(ay, am - 1, ad);
    const b = new Date(by, bm - 1, bd);
    const ms = b - a;
    return Math.round(ms / (24 * 60 * 60 * 1000));
  }

  function markTrainingComplete() {
    const today = dayKey();
    const last = store.get(KEYS.lastTrainingDay, null);
    let streak = Number(store.get(KEYS.streak, "0"));

    if (last === today) return;

    if (!last) {
      streak = 1;
    } else {
      const d = diffDays(last, today);
      streak = (d === 1) ? (streak + 1) : 1;
    }

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
    // start hidden app (but loader overlay covers anyway)
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      const pct = Math.round(t * 100);

      el.loaderBar.style.width = `${pct}%`;
      el.loaderPct.textContent = `${pct}%`;
      el.loader.querySelector(".loader__bar")?.setAttribute("aria-valuenow", String(pct));

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // fade out loader
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
     Game: config
     ========== */
  const WARMUP = {
    totalSec: 180,   // 3:00
    lives: 3,
    phases: [
      { key: "reaction", label: "Reaction", sec: 45, size: 34, lifetimeMs: 1300, delayMin: 360, delayMax: 920, moving: false },
      { key: "flick",    label: "Flick",    sec: 70, size: 28, lifetimeMs: 1600, delayMin: 0,   delayMax: 0,   moving: false },
      { key: "control",  label: "Control",  sec: 65, size: 28, lifetimeMs: 0,    delayMin: 0,   delayMax: 0,   moving: true,  speed: 0.22 },
    ]
  };

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  /* ==========
     Game: runtime state
     ========== */
  const state = {
    mode: null, // "warmup" | "endless"
    running: false,

    // warmup time
    totalLeft: 0,
    phaseIndex: 0,
    phaseLeft: 0,

    // lives
    lives: 0,

    // stats
    hits: 0,
    misses: 0,
    reactionMs: [],
    flickMs: [],
    controlHits: 0,

    // target
    targetEl: null,
    spawnedAt: 0,
    targetLifeId: null,
    spawnDelayId: null,

    // moving
    rafId: null,
    lastRaf: 0,
    vel: { x: 0, y: 0 },

    // endless pacing
    paceId: null,
  };

  let tickId = null;

  function clearTimers() {
    if (tickId) { clearInterval(tickId); tickId = null; }
    if (state.targetLifeId) { clearTimeout(state.targetLifeId); state.targetLifeId = null; }
    if (state.spawnDelayId) { clearTimeout(state.spawnDelayId); state.spawnDelayId = null; }
    if (state.paceId) { clearTimeout(state.paceId); state.paceId = null; }
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
  }

  function clearTarget() {
    if (state.targetEl) {
      state.targetEl.remove();
      state.targetEl = null;
    }
  }

  function setHint(text) {
    el.hint.textContent = text || "";
  }

  function setPaceHidden(hidden) {
    el.pace.classList.toggle("pace--hidden", !!hidden);
  }

  function animatePace(ms) {
    // visual pacing bar for Endless (time-to-hit)
    setPaceHidden(false);

    el.paceFill.style.transition = "none";
    el.paceFill.style.width = "100%";
    // force reflow
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

  function renderLives() {
    el.lives.innerHTML = "";
    for (let i = 0; i < WARMUP.lives; i++) {
      const dot = document.createElement("div");
      dot.className = "lifeDot" + (i < state.lives ? " lifeDot--on" : "");
      el.lives.appendChild(dot);
    }
  }

  function setHeaderUI() {
    if (state.mode === "warmup") {
      el.modePill.textContent = "Warm‑up";
      el.phasePill.style.display = "inline-flex";
      el.timer.style.display = "inline-flex";
      el.score.style.display = "inline-flex";

      el.timer.textContent = fmtTime(state.totalLeft);
      el.score.textContent = `Hits ${state.hits}`;

      const phase = WARMUP.phases[state.phaseIndex];
      el.phasePill.textContent = phase ? phase.label : "—";

      renderLives();
      setPaceHidden(true);
    } else {
      el.modePill.textContent = "Endless";
      el.phasePill.style.display = "none";
      el.timer.style.display = "none";
      el.score.style.display = "inline-flex";

      el.score.textContent = `Score ${state.hits}`;
      el.lives.innerHTML = ""; // endless has no lives
      setPaceHidden(false);
    }
  }

  /* ==========
     Target spawn / movement
     ========== */
  function fieldSize() {
    const r = el.playfield.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function randomPos(size) {
    const { w, h } = fieldSize();
    const x = Math.random() * Math.max(0, (w - size));
    const y = Math.random() * Math.max(0, (h - size));
    return { x, y };
  }

  function setTargetPos(t, x, y) {
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
  }

  function stopMotion() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function startMotion(speed) {
    stopMotion();

    // random velocity (px/ms)
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

      // bounce
      if (x <= 0) { x = 0; state.vel.x *= -1; }
      if (y <= 0) { y = 0; state.vel.y *= -1; }
      if (x >= (w - size)) { x = Math.max(0, w - size); state.vel.x *= -1; }
      if (y >= (h - size)) { y = Math.max(0, h - size); state.vel.y *= -1; }

      setTargetPos(state.targetEl, x, y);
      state.rafId = requestAnimationFrame(step);
    };

    state.rafId = requestAnimationFrame(step);
  }

  function spawnTarget({ size, lifetimeMs, moving, speed, withPace } = {}) {
    clearTarget();
    clearTimeout(state.targetLifeId);
    clearTimeout(state.paceId);

    const t = document.createElement("div");
    t.className = "target";
    t.style.width = `${size}px`;
    t.style.height = `${size}px`;

    const pos = randomPos(size);
    setTargetPos(t, pos.x, pos.y);

    // Hit
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

    // Lifetime -> counts as miss
    if (lifetimeMs && lifetimeMs > 0) {
      state.targetLifeId = setTimeout(() => registerMiss("timeout"), lifetimeMs);
    }

    // Pace bar animation (Endless)
    if (withPace && lifetimeMs && lifetimeMs > 0) {
      animatePace(lifetimeMs);
      state.paceId = setTimeout(() => {
        // if still running and target alive -> miss triggers anyway by lifetime,
        // but paceId helps keep logic consistent
      }, lifetimeMs);
    }
  }

  /* ==========
     Warm-up phase control
     ========== */
  function currentPhase() {
    return WARMUP.phases[state.phaseIndex];
  }

  function clearPhaseDelays() {
    if (state.spawnDelayId) { clearTimeout(state.spawnDelayId); state.spawnDelayId = null; }
  }

  function scheduleReactionSpawn() {
    clearPhaseDelays();
    clearTarget();

    const ph = currentPhase();
    const delay = ph.delayMin + Math.random() * (ph.delayMax - ph.delayMin);

    state.spawnDelayId = setTimeout(() => {
      if (!state.running || state.mode !== "warmup") return;
      // reaction target: time-limited to encourage quick response
      spawnTarget({
        size: ph.size,
        lifetimeMs: ph.lifetimeMs,
        moving: false
      });
    }, delay);
  }

  function startPhase(index) {
    state.phaseIndex = index;
    const ph = currentPhase();
    state.phaseLeft = ph.sec;

    toast(`${ph.label}`);
    setHeaderUI();

    if (ph.key === "reaction") {
      scheduleReactionSpawn();
      setHint("Жди цель → нажми быстро");
    } else if (ph.key === "flick") {
      spawnTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
      setHint("Флик. Точность важнее скорости");
    } else {
      spawnTarget({ size: ph.size, lifetimeMs: 0, moving: true, speed: ph.speed });
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

  /* ==========
     Endless config
     ========== */
  function endlessParams(score) {
    // Premium difficulty ramp:
    // - smaller target
    // - limited time-to-hit
    // - moving after some score
    const size = clamp(32 - Math.floor(score / 6), 18, 32);
    const lifetimeMs = clamp(1400 - score * 18, 380, 1400);
    const moving = score >= 18;
    const speed = clamp(0.14 + score * 0.003, 0.14, 0.46);
    return { size, lifetimeMs, moving, speed };
  }

  /* ==========
     Hit / Miss logic
     ========== */
  function onHit() {
    if (!state.running) return;

    const now = performance.now();
    const dt = now - state.spawnedAt;

    state.hits += 1;

    // Stats per phase
    if (state.mode === "warmup") {
      const ph = currentPhase();
      if (ph?.key === "reaction") state.reactionMs.push(dt);
      if (ph?.key === "flick") state.flickMs.push(dt);
      if (ph?.key === "control") state.controlHits += 1;
    }

    // Feedback
    playHitSound();
    Haptic.light();

    // Next target depending on mode
    setHeaderUI();

    if (state.mode === "warmup") {
      const ph = currentPhase();

      // Clear timers for current target
      clearTimeout(state.targetLifeId);
      state.targetLifeId = null;

      if (ph.key === "reaction") {
        // after hit, hide and wait random delay for next appearance
        scheduleReactionSpawn();
      } else if (ph.key === "flick") {
        spawnTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
      } else {
        spawnTarget({ size: ph.size, lifetimeMs: 0, moving: true, speed: ph.speed });
      }
    } else {
      // Endless: ramp difficulty
      const p = endlessParams(state.hits);
      spawnTarget({ size: p.size, lifetimeMs: p.lifetimeMs, moving: p.moving, speed: p.speed, withPace: true });
      el.score.textContent = `Score ${state.hits}`;
    }
  }

  function registerMiss(reason = "miss") {
    if (!state.running) return;

    // In reaction phase, if there is NO target yet, ignore random clicks (avoid раздражение)
    if (state.mode === "warmup") {
      const ph = currentPhase();
      const hasTarget = !!state.targetEl;
      if (ph?.key === "reaction" && !hasTarget && reason === "click") {
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

      // Continue session: respawn depending on phase
      const ph = currentPhase();
      clearTimeout(state.targetLifeId);
      state.targetLifeId = null;

      if (ph.key === "reaction") scheduleReactionSpawn();
      else if (ph.key === "flick") spawnTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
      else spawnTarget({ size: ph.size, lifetimeMs: 0, moving: true, speed: ph.speed });

      return;
    }

    // Endless: miss ends immediately
    endSession(reason === "timeout" ? "Время вышло" : "Промах");
  }

  /* ==========
     Start / Stop sessions
     ========== */
  function resetStateFor(mode) {
    clearTimers();
    clearTarget();

    state.mode = mode;
    state.running = true;

    state.hits = 0;
    state.misses = 0;
    state.reactionMs = [];
    state.flickMs = [];
    state.controlHits = 0;

    if (mode === "warmup") {
      state.totalLeft = WARMUP.totalSec;
      state.phaseIndex = 0;
      state.phaseLeft = WARMUP.phases[0].sec;
      state.lives = WARMUP.lives;

      setPaceHidden(true);
    } else {
      state.totalLeft = 0;
      state.phaseIndex = 0;
      state.phaseLeft = 0;
      state.lives = 0;

      setPaceHidden(false);
    }
  }

  function startWarmup() {
    resetStateFor("warmup");
    showScreen(el.game);

    // Ensure layout measured before spawn
    requestAnimationFrame(() => {
      setHeaderUI();
      setHint("Разминка: 3 фазы • 3 жизни");
      startPhase(0);

      // Tick each second
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
    });
  }

  function startEndless() {
    resetStateFor("endless");
    showScreen(el.game);

    requestAnimationFrame(() => {
      setHeaderUI();
      setHint("Endless: промах или таймаут = конец");
      const p = endlessParams(0);
      spawnTarget({ size: p.size, lifetimeMs: p.lifetimeMs, moving: p.moving, speed: p.speed, withPace: true });
      el.score.textContent = `Score ${state.hits}`;
    });
  }

  function endSession(title) {
    if (!state.running) return;

    state.running = false;
    clearTimers();
    clearTarget();
    stopMotion();

    // Save best for Endless
    if (state.mode === "endless") {
      const best = Number(store.get(KEYS.bestEndless, "0"));
      const next = Math.max(best, state.hits);
      store.set(KEYS.bestEndless, String(next));
    }

    // Mark streak on any completed session
    markTrainingComplete();
    updateHomeStats();

    // Build results
    el.resultTitle.textContent = title || "Готово";

    if (state.mode === "warmup") {
      const hits = state.hits;
      const misses = state.misses;
      const acc = (hits + misses) > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;

      const avg = (arr) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0) / arr.length) : null;
      const avgReaction = avg(state.reactionMs);
      const avgFlick = avg(state.flickMs);

      // “Ready” subtitle, neutral but motivating
      let subtitle = "Разогрелся. Дальше — катка.";
      if (acc >= 86 && (avgReaction !== null && avgReaction <= 230)) subtitle = "Чисто. Ты готов играть.";
      else if (acc >= 78) subtitle = "Хорошо. Разгон есть.";
      el.resultSubtitle.textContent = subtitle;

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
    } else {
      const score = state.hits;
      const best = Number(store.get(KEYS.bestEndless, "0"));
      const acc = (score + state.misses) > 0 ? Math.round((score / (score + state.misses)) * 100) : 0;

      let subtitle = "Ещё попытка — и будет выше.";
      if (score >= best && score > 0) subtitle = "Новый рекорд. Красиво.";
      else if (score >= 20) subtitle = "Уже уверенно. Дальше — больше.";
      el.resultSubtitle.textContent = subtitle;

      el.resultStats.innerHTML = `
        <div><b>Endless</b></div>
        <div>Счёт: <b>${score}</b></div>
        <div>Рекорд: <b>${best}</b></div>
        <div style="color: rgba(255,255,255,0.62); margin-top: 6px;">Промах или таймаут завершает раунд.</div>
      `;
    }

    // buttons
    el.replayBtn.textContent = (state.mode === "endless") ? "Играть ещё" : "Ещё разминка";
    setHint("");

    showScreen(el.result);
  }

  /* ==========
     Input events (miss detection)
     ========== */
  // Miss on click/tap on playfield (target stops propagation)
  el.playfield.addEventListener("pointerdown", () => {
    if (!state.running) return;
    registerMiss("click");
  });

  // Quit
  el.quitBtn.addEventListener("click", () => {
    if (!state.running) return;
    endSession("Остановлено");
  });

  /* ==========
     Result actions
     ========== */
  el.replayBtn.addEventListener("click", () => {
    ensureAudio();
    if (state.mode === "endless") startEndless();
    else startWarmup();
  });

  el.homeBtn.addEventListener("click", () => {
    showScreen(el.home);
  });

  el.closeBtn.addEventListener("click", () => {
    if (tg && typeof tg.close === "function") {
      tgSafe(tg.close.bind(tg));
      return;
    }
    // fallback: go home
    showScreen(el.home);
  });

  /* ==========
     Home actions
     ========== */
  el.startWarmup.addEventListener("click", () => {
    ensureAudio();
    startWarmup();
  });

  el.startEndless.addEventListener("click", () => {
    ensureAudio();
    startEndless();
  });

  /* ==========
     Resize safety
     ========== */
  window.addEventListener("resize", () => {
    // If running, re-spawn target to keep it inside bounds after orientation change
    if (!state.running) return;

    if (state.mode === "warmup") {
      const ph = currentPhase();
      if (!ph) return;

      if (ph.key === "reaction") {
        // if target is visible, re-spawn quickly; else keep schedule
        if (state.targetEl) spawnTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
      } else if (ph.key === "flick") {
        spawnTarget({ size: ph.size, lifetimeMs: ph.lifetimeMs, moving: false });
      } else {
        spawnTarget({ size: ph.size, lifetimeMs: 0, moving: true, speed: ph.speed });
      }
    } else {
      const p = endlessParams(state.hits);
      spawnTarget({ size: p.size, lifetimeMs: p.lifetimeMs, moving: p.moving, speed: p.speed, withPace: true });
    }
  });

  /* ==========
     Init
     ========== */
  applyTelegramTheme();
  updateHomeStats();

  // show loader first, then home
  showScreen(el.home); // home is there but loader covers it anyway
  runLoader(2500);

})();
