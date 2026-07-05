/* ============================================================
   Rutina Quest — lógica del juego
   Sin dependencias. Todo el progreso vive en localStorage.
   ============================================================ */
(function () {
  "use strict";

  const STORAGE_KEY = "rutinaquest_v1";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ----------------------------------------------------------
     Datos de configuración del juego
     ---------------------------------------------------------- */
  const CATEGORIES = {
    personal: { label: "Personales", emoji: "🧍", color: "#4b9fff", xp: 10, coins: 5 },
    hogar:    { label: "Hogar",      emoji: "🏠", color: "#2ec4b6", xp: 15, coins: 8 },
    trabajo:  { label: "Trabajo",    emoji: "💼", color: "#ff8a5b", xp: 25, coins: 15 },
  };

  const COMPANIONS = ["🌱", "🐣", "🐱", "🐉"];

  // Fases de crecimiento de la mascota planta según el nivel del jugador.
  const PLANT_STAGES = ["🌱", "🌿", "🪴", "🌳", "🌸", "🌳✨"];

  const EMOJI_CHOICES = [
    "☀️","🛏️","🦷","🚿","🧘","💧","🏃","📖","💊","🧴","🥗","😴",
    "🍽️","🧺","🧹","🍳","🗑️","🪴","🛒","🧽","🐕","🚰",
    "📊","📝","💻","📞","📧","📅","🎯","📈","🖥️","✅",
  ];

  const SUGGESTIONS = {
    personal: [
      { name: "Levantarme temprano", icon: "☀️" },
      { name: "Cepillarme los dientes", icon: "🦷" },
      { name: "Ducharme", icon: "🚿" },
      { name: "Beber agua", icon: "💧" },
      { name: "Hacer ejercicio", icon: "🏃" },
      { name: "Leer 10 minutos", icon: "📖" },
      { name: "Meditar", icon: "🧘" },
      { name: "Dormir 8 horas", icon: "😴" },
    ],
    hogar: [
      { name: "Tender la cama", icon: "🛏️" },
      { name: "Lavar los platos", icon: "🍽️" },
      { name: "Lavar la ropa", icon: "🧺" },
      { name: "Hacer la comida", icon: "🍳" },
      { name: "Barrer / limpiar", icon: "🧹" },
      { name: "Sacar la basura", icon: "🗑️" },
      { name: "Regar las plantas", icon: "🪴" },
      { name: "Hacer las compras", icon: "🛒" },
    ],
    trabajo: [
      { name: "Terminar el reporte", icon: "📊" },
      { name: "Hacer la presentación", icon: "📈" },
      { name: "Responder correos", icon: "📧" },
      { name: "Llamada de equipo", icon: "📞" },
      { name: "Planear el día", icon: "📅" },
      { name: "Tarea prioritaria", icon: "🎯" },
      { name: "Revisar pendientes", icon: "✅" },
      { name: "Estudiar / aprender", icon: "💻" },
    ],
  };

  const THEMES = [
    { id: "default",  name: "Lavanda",     cost: 0,   c1: "#6c5ce7", c2: "#ff7aa2" },
    { id: "ocean",    name: "Océano",      cost: 80,  c1: "#0097a7", c2: "#26c6da" },
    { id: "forest",   name: "Bosque",      cost: 120, c1: "#2f9e44", c2: "#94d82d" },
    { id: "sunset",   name: "Atardecer",   cost: 180, c1: "#ff7e5f", c2: "#feb47b" },
    { id: "midnight", name: "Medianoche",  cost: 250, c1: "#8b7dff", c2: "#ff6ec7" },
  ];

  const ACHIEVEMENTS = [
    { id: "first",     icon: "🎉", name: "¡El primer paso!",   desc: "Completa tu primera tarea",            test: (s) => s.stats.totalDone >= 1 },
    { id: "streak3",   icon: "🔥", name: "En marcha",          desc: "Consigue una racha de 3 días",         test: (s) => maxStreak(s) >= 3 },
    { id: "streak7",   icon: "⚡", name: "Semana perfecta",    desc: "Consigue una racha de 7 días",         test: (s) => maxStreak(s) >= 7 },
    { id: "habit1",    icon: "🌟", name: "Primer hábito",      desc: "Convierte una tarea en hábito",        test: (s) => s.tasks.some((t) => t.streak >= s.settings.habitGoal) },
    { id: "level5",    icon: "🏅", name: "Aventurero",         desc: "Alcanza el nivel 5",                   test: (s) => level(s.xp) >= 5 },
    { id: "level10",   icon: "👑", name: "Maestro de rutinas", desc: "Alcanza el nivel 10",                  test: (s) => level(s.xp) >= 10 },
    { id: "coins200",  icon: "💰", name: "Ahorrador",          desc: "Acumula 200 monedas en total",         test: (s) => s.stats.totalCoins >= 200 },
    { id: "perfect",   icon: "✨", name: "Día redondo",        desc: "Completa todas tus tareas en un día",  test: (s) => s.stats.perfectDays >= 1 },
    { id: "done50",    icon: "💪", name: "Imparable",          desc: "Completa 50 tareas en total",          test: (s) => s.stats.totalDone >= 50 },
    { id: "allcats",   icon: "🌈", name: "Equilibrio",         desc: "Ten tareas en las 3 categorías",       test: (s) => new Set(s.tasks.map((t) => t.cat)).size >= 3 },
    { id: "deadline1", icon: "🎯", name: "Cumplidor",          desc: "Termina una tarea con fecha límite",   test: (s) => (s.stats.deadlinesDone || 0) >= 1 },
    { id: "planner",   icon: "🗓️", name: "Organizado",         desc: "Programa 3 tareas con fecha",          test: (s) => s.tasks.filter((t) => t.type === "deadline").length >= 3 },
  ];

  /* ----------------------------------------------------------
     Estado + persistencia
     ---------------------------------------------------------- */
  let state = null;
  let currentFilter = "all";
  let editingId = null;
  let draft = { cat: "personal", icon: "☀️", type: "daily", due: "" };
  let calView = null;          // { year, month } del calendario visible
  let progressTaskId = null;   // tarea abierta en el modal de avance

  // Recompensa total de una tarea con fecha (se reparte según el avance).
  const DEADLINE_REWARD = { xp: 45, coins: 35 };

  function todayStr(d) {
    const x = d || new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  function defaultState() {
    return {
      player: { name: "Aventurero", companion: "🌱" },
      xp: 0,
      coins: 0,
      tasks: [],
      unlockedThemes: ["default"],
      activeTheme: "default",
      achievements: [],
      settings: { habitGoal: 21, haptics: true },
      stats: { totalDone: 0, totalCoins: 0, perfectDays: 0, deadlinesDone: 0 },
      lastOpen: todayStr(),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = Object.assign(defaultState(), JSON.parse(raw));
        // Migración: valores nuevos que pueden faltar en partidas anteriores.
        state.stats = Object.assign({ totalDone: 0, totalCoins: 0, perfectDays: 0, deadlinesDone: 0 }, state.stats);
        state.tasks.forEach((t) => { if (!t.type) t.type = "daily"; });
      }
    } catch (e) { /* ignora datos corruptos */ }
    if (!state) state = null;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ----------------------------------------------------------
     Reset diario: al cambiar de día, las tareas vuelven a estar
     "por hacer" y se rompen las rachas de las que no se hicieron ayer.
     ---------------------------------------------------------- */
  function dailyRollover() {
    const today = todayStr();
    if (state.lastOpen === today) return;

    const yesterday = todayStr(new Date(Date.now() - 86400000));
    state.tasks.forEach((t) => {
      if ((t.type || "daily") !== "daily") return; // las tareas con fecha no se reinician
      // Si la última vez completada no fue hoy ni ayer, la racha se rompe.
      if (t.lastDone && t.lastDone !== today && t.lastDone !== yesterday) {
        t.streak = 0;
      }
      t.doneToday = t.lastDone === today;
    });
    state.lastOpen = today;
    save();
  }

  /* ----------------------------------------------------------
     Progresión: XP → nivel
     ---------------------------------------------------------- */
  function xpForLevel(lvl) { return Math.round(50 * lvl * lvl + 50 * lvl); } // acumulado para alcanzar 'lvl'
  function level(xp) {
    let lvl = 1;
    while (xp >= xpForLevel(lvl)) lvl++;
    return lvl;
  }
  function levelProgress(xp) {
    const lvl = level(xp);
    const cur = lvl === 1 ? 0 : xpForLevel(lvl - 1);
    const next = xpForLevel(lvl);
    return { lvl, into: xp - cur, need: next - cur };
  }
  function maxStreak(s) { return s.tasks.reduce((m, t) => Math.max(m, t.bestStreak || 0), 0); }

  /* ----------------------------------------------------------
     Acción principal: completar una tarea
     ---------------------------------------------------------- */
  function completeTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t || t.doneToday) return;

    const today = todayStr();
    const yesterday = todayStr(new Date(Date.now() - 86400000));

    // Racha
    if (t.lastDone === yesterday) t.streak = (t.streak || 0) + 1;
    else t.streak = 1;
    t.bestStreak = Math.max(t.bestStreak || 0, t.streak);
    t.lastDone = today;
    t.doneToday = true;
    t.totalDone = (t.totalDone || 0) + 1;

    // Recompensas
    const cat = CATEGORIES[t.cat];
    let xpGain = cat.xp;
    let coinGain = cat.coins;
    // Bonus por racha: +1 moneda por cada día de racha (tope +15)
    const streakBonus = Math.min(t.streak - 1, 15);
    coinGain += streakBonus;

    const beforeLevel = level(state.xp);
    state.xp += xpGain;
    state.coins += coinGain;
    state.stats.totalDone += 1;
    state.stats.totalCoins += coinGain;
    const afterLevel = level(state.xp);

    // ¿Se acaba de formar el hábito?
    const habitJustFormed = t.streak === state.settings.habitGoal;

    // ¿Día perfecto? (solo cuentan los hábitos diarios)
    const daily = state.tasks.filter((x) => (x.type || "daily") === "daily");
    const allDone = daily.length > 0 && daily.every((x) => x.doneToday);
    if (allDone && state.stats.lastPerfect !== today) {
      state.stats.perfectDays += 1;
      state.stats.lastPerfect = today;
    }

    save();
    haptic();
    render();

    // Efectos visuales
    burstConfetti();
    showReward({ xpGain, coinGain, streak: t.streak, streakBonus, task: t });

    if (afterLevel > beforeLevel) {
      setTimeout(() => toast(`🎊 ¡Subiste al nivel ${afterLevel}! Tu compañero está más fuerte.`), 1500);
    }
    if (habitJustFormed) {
      setTimeout(() => toast(`🌟 ¡"${t.name}" es ahora un HÁBITO! ${state.settings.habitGoal} días seguidos.`), 2200);
    }
    checkAchievements();
  }

  function checkAchievements() {
    let newlyUnlocked = null;
    ACHIEVEMENTS.forEach((a) => {
      if (!state.achievements.includes(a.id) && a.test(state)) {
        state.achievements.push(a.id);
        newlyUnlocked = a;
      }
    });
    if (newlyUnlocked) {
      save();
      setTimeout(() => toast(`🏆 Logro desbloqueado: ${newlyUnlocked.name}`), 2900);
      renderAchievements();
    }
  }

  /* ----------------------------------------------------------
     Registrar avance de una tarea con fecha límite.
     Cada avance da recompensa proporcional; al 100% se completa.
     ---------------------------------------------------------- */
  function advanceDeadline(id, addPct) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t || t.type !== "deadline") return;
    const before = t.progress || 0;
    if (before >= 100) return;
    const after = Math.min(100, before + addPct);
    const delta = after - before;
    if (delta <= 0) return;

    t.progress = after;
    const xpGain = Math.max(1, Math.round((DEADLINE_REWARD.xp * delta) / 100));
    const coinGain = Math.max(1, Math.round((DEADLINE_REWARD.coins * delta) / 100));

    const beforeLevel = level(state.xp);
    state.xp += xpGain;
    state.coins += coinGain;
    state.stats.totalCoins += coinGain;

    const finished = after >= 100 && !t.completedDate;
    if (finished) {
      t.completedDate = todayStr();
      state.stats.deadlinesDone = (state.stats.deadlinesDone || 0) + 1;
      state.stats.totalDone += 1;
    }
    const afterLevel = level(state.xp);

    save();
    haptic();
    render();
    if (!$("#agendaPanel").classList.contains("hidden")) renderAgenda();
    if (progressTaskId === id) renderProgressModal();

    burstConfetti();
    showReward({
      xpGain, coinGain, task: t,
      title: finished ? "¡Entrega terminada! 🎯" : "¡Buen avance! 🚀",
      subtitle: finished ? "¡Tarea completada al 100%!" : `Progreso: ${after}%`,
    });

    if (afterLevel > beforeLevel) {
      setTimeout(() => toast(`🎊 ¡Subiste al nivel ${afterLevel}!`), 1500);
    }
    if (finished) {
      setTimeout(() => { $("#progressModal").classList.add("hidden"); progressTaskId = null; }, 1200);
    }
    checkAchievements();
  }

  /* ----------------------------------------------------------
     Render principal
     ---------------------------------------------------------- */
  function applyTheme() {
    const t = THEMES.find((x) => x.id === state.activeTheme) || THEMES[0];
    if (t.id === "default") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t.id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t.c1);
  }

  function render() {
    // Cabecera
    $("#playerName").textContent = state.player.name;
    $("#coinCount").textContent = state.coins;
    const lp = levelProgress(state.xp);
    $("#levelBadge").textContent = "Nv. " + lp.lvl;
    $("#xpFill").style.width = Math.min(100, (lp.into / lp.need) * 100) + "%";
    $("#xpText").textContent = `${lp.into}/${lp.need} XP`;

    // Mascota: si eligió planta, evoluciona con el nivel; si no, muestra su compañero.
    const stage = PLANT_STAGES[Math.min(PLANT_STAGES.length - 1, Math.floor((lp.lvl - 1) / 2))];
    const mascot = state.player.companion === "🌱" ? stage : state.player.companion;
    $("#playerAvatar").textContent = mascot;
    $("#heroMascot").textContent = mascot;

    // Progreso del día (solo hábitos diarios)
    const daily = state.tasks.filter((t) => (t.type || "daily") === "daily");
    const total = daily.length;
    const done = daily.filter((t) => t.doneToday).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("#heroPercent").textContent = pct + "%";
    const C = 2 * Math.PI * 52;
    $("#ringFill").style.strokeDashoffset = C - (C * pct) / 100;
    $("#heroMood").textContent = moodText(pct, total, done);

    renderReminders();
    renderTasks();
    save();
  }

  function moodText(pct, total, done) {
    if (total === 0) return "Añade tu primera tarea con el botón ＋ y empieza pequeño.";
    if (pct === 0) return "Tu compañero está esperando… ¡empieza con la tarea más fácil! 💪";
    if (pct === 100) return "¡Día perfecto! Tu compañero está radiante. Descansa, te lo ganaste. 🌟";
    if (pct >= 60) return "¡Vas genial! Ya casi completas el día. 🚀";
    if (pct >= 30) return "Buen ritmo. Cada tarea hace crecer a tu compañero. 🌱";
    return "¡Buen comienzo! No pares, la inercia está de tu lado. ✨";
  }

  function renderTasks() {
    const list = $("#taskList");
    // "Hoy" muestra solo los hábitos diarios; las tareas con fecha viven en Agenda.
    let tasks = state.tasks.filter((t) => (t.type || "daily") === "daily");
    const totalDaily = tasks.length;
    if (currentFilter !== "all") tasks = tasks.filter((t) => t.cat === currentFilter);

    if (tasks.length === 0) {
      list.innerHTML = `<div class="empty"><div class="big">${totalDaily === 0 ? "🗒️" : "🔍"}</div>
        <p>${totalDaily === 0 ? "Aún no tienes hábitos diarios.<br>Toca ＋ para crear el primero." : "No hay hábitos en esta categoría."}</p></div>`;
      return;
    }

    // Orden: pendientes primero, luego por categoría
    tasks.sort((a, b) => (a.doneToday - b.doneToday) || 0);

    const order = ["personal", "hogar", "trabajo"];
    let html = "";
    if (currentFilter === "all") {
      order.forEach((catKey) => {
        const inCat = tasks.filter((t) => t.cat === catKey);
        if (!inCat.length) return;
        html += `<div class="cat-group-label">${CATEGORIES[catKey].emoji} ${CATEGORIES[catKey].label}</div>`;
        inCat.forEach((t) => (html += taskHTML(t)));
      });
    } else {
      tasks.forEach((t) => (html += taskHTML(t)));
    }
    list.innerHTML = html;

    // Eventos
    $$(".task-check").forEach((el) => el.addEventListener("click", (e) => {
      e.stopPropagation();
      completeTask(el.dataset.id);
    }));
    $$(".task-edit").forEach((el) => el.addEventListener("click", (e) => {
      e.stopPropagation();
      openTaskModal(el.dataset.id);
    }));
  }

  function taskHTML(t) {
    const cat = CATEGORIES[t.cat];
    const goal = state.settings.habitGoal;
    const habitPct = Math.min(100, (t.streak / goal) * 100);
    const formed = t.streak >= goal;
    return `
      <div class="task ${t.doneToday ? "done" : ""}" style="--cat-color:${cat.color}">
        <button class="task-check ${t.doneToday ? "done" : ""}" data-id="${t.id}" aria-label="Completar">${t.doneToday ? "✓" : ""}</button>
        <div class="task-icon">${t.icon}</div>
        <div class="task-body">
          <div class="task-name">${escapeHTML(t.name)}</div>
          <div class="task-sub">
            ${t.streak > 0 ? `<span class="streak-pill">🔥 ${t.streak}${formed ? " · hábito" : ""}</span>` : ""}
            <div class="habit-mini ${formed ? "formed" : ""}"><i style="width:${habitPct}%"></i></div>
          </div>
        </div>
        <button class="task-edit" data-id="${t.id}" aria-label="Editar">⋯</button>
      </div>`;
  }

  /* ----------------------------------------------------------
     Paneles: Logros, Tienda, Estadísticas
     ---------------------------------------------------------- */
  function renderAchievements() {
    $("#achievementsGrid").innerHTML = ACHIEVEMENTS.map((a) => {
      const on = state.achievements.includes(a.id);
      return `<div class="ach ${on ? "unlocked" : ""}">
        <div class="ach-icon">${on ? a.icon : "🔒"}</div>
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>`;
    }).join("");
  }

  function renderShop() {
    $("#shopGrid").innerHTML = THEMES.map((th) => {
      const owned = state.unlockedThemes.includes(th.id);
      const active = state.activeTheme === th.id;
      let btn;
      if (active) btn = `<button class="shop-btn active-theme" disabled>✓ En uso</button>`;
      else if (owned) btn = `<button class="shop-btn owned" data-use="${th.id}">Usar</button>`;
      else btn = `<button class="shop-btn" data-buy="${th.id}" ${state.coins < th.cost ? "disabled" : ""}>🪙 ${th.cost}</button>`;
      return `<div class="shop-item">
        <div class="shop-preview" style="background:linear-gradient(135deg, ${th.c1}, ${th.c2})"></div>
        <div class="shop-name">${th.name}</div>
        ${btn}
      </div>`;
    }).join("");

    $$("[data-buy]").forEach((el) => el.addEventListener("click", () => buyTheme(el.dataset.buy)));
    $$("[data-use]").forEach((el) => el.addEventListener("click", () => {
      state.activeTheme = el.dataset.use; applyTheme(); save(); renderShop();
    }));
  }

  function buyTheme(id) {
    const th = THEMES.find((x) => x.id === id);
    if (!th || state.coins < th.cost) return;
    state.coins -= th.cost;
    state.unlockedThemes.push(id);
    state.activeTheme = id;
    applyTheme(); save(); render(); renderShop();
    toast(`🎨 ¡Tema "${th.name}" desbloqueado!`);
    haptic();
  }

  function renderStats() {
    const s = state;
    const dailyTasks = s.tasks.filter((t) => (t.type || "daily") === "daily");
    const habitsFormed = dailyTasks.filter((t) => (t.streak || 0) >= s.settings.habitGoal).length;
    const cards = [
      { n: s.stats.totalDone, l: "Tareas completadas" },
      { n: "🔥 " + maxStreak(s), l: "Mejor racha" },
      { n: habitsFormed, l: "Hábitos formados" },
      { n: "🎯 " + (s.stats.deadlinesDone || 0), l: "Entregas cumplidas" },
      { n: s.stats.perfectDays, l: "Días perfectos" },
      { n: "🪙 " + s.stats.totalCoins, l: "Monedas ganadas" },
    ];
    $("#statsGrid").innerHTML = cards.map((c) =>
      `<div class="stat-card"><div class="stat-num">${c.n}</div><div class="stat-label">${c.l}</div></div>`
    ).join("");

    const list = $("#habitsList");
    if (!dailyTasks.length) {
      list.innerHTML = `<div class="empty"><p>Crea hábitos diarios para ver aquí su progreso.</p></div>`;
      return;
    }
    const sorted = dailyTasks.slice().sort((a, b) => (b.streak || 0) - (a.streak || 0));
    list.innerHTML = sorted.map((t) => {
      const goal = s.settings.habitGoal;
      const pct = Math.min(100, ((t.streak || 0) / goal) * 100);
      const formed = (t.streak || 0) >= goal;
      return `<div class="habit-row">
        <div class="habit-row-top">
          <span class="task-icon">${t.icon}</span>
          <span class="habit-row-name">${escapeHTML(t.name)}</span>
          ${formed ? `<span class="habit-badge">🌟 Hábito</span>` : `<span class="habit-row-count">${t.streak || 0}/${goal} días</span>`}
        </div>
        <div class="habit-bar ${formed ? "formed" : ""}"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join("");
  }

  /* ----------------------------------------------------------
     AGENDA / tareas con fecha límite
     ---------------------------------------------------------- */
  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  function daysUntil(dateStr) {
    return daysBetween(todayStr(), dateStr);
  }
  function urgencyColor(days, done) {
    if (done) return "#26c281";
    if (days < 0) return "#ff5a6a";       // vencida
    if (days <= 3) return "#ff8a5b";      // urgente
    if (days <= 10) return "#ffb020";     // pronto
    return "#4b9fff";                     // con tiempo
  }
  function dueText(days, done) {
    if (done) return "✓ Completada";
    if (days < 0) return `Vencida hace ${Math.abs(days)} d`;
    if (days === 0) return "¡Vence hoy!";
    if (days === 1) return "Vence mañana";
    return `Faltan ${days} días`;
  }
  function deadlineTasks() {
    return state.tasks.filter((t) => t.type === "deadline");
  }

  // Recordatorio compacto en la pantalla Hoy (entregas de los próximos 10 días).
  function renderReminders() {
    const el = $("#deadlineReminder");
    const near = deadlineTasks()
      .filter((t) => (t.progress || 0) < 100 && daysUntil(t.due) <= 10)
      .sort((a, b) => daysUntil(a.due) - daysUntil(b.due));
    if (!near.length) { el.classList.add("hidden"); el.innerHTML = ""; return; }
    el.classList.remove("hidden");
    el.innerHTML = near.map((t) => {
      const d = daysUntil(t.due);
      return `<button class="remind-chip" data-goagenda="1" style="--urg:${urgencyColor(d, false)}">
        <span>${t.icon}</span><span>${escapeHTML(t.name)}</span>
        <span class="rc-days">· ${dueText(d, false)}</span></button>`;
    }).join("");
    $$("#deadlineReminder .remind-chip").forEach((c) => c.addEventListener("click", () => switchView("agenda")));
  }

  function renderAgenda() {
    if (!calView) { const n = new Date(); calView = { year: n.getFullYear(), month: n.getMonth() }; }
    renderCalendar();
    renderDeadlineList();
  }

  function renderCalendar() {
    $("#calMonthLabel").textContent = `${MONTHS[calView.month]} ${calView.year}`;
    const first = new Date(calView.year, calView.month, 1);
    const startCol = (first.getDay() + 6) % 7;         // lunes = 0
    const daysInMonth = new Date(calView.year, calView.month + 1, 0).getDate();
    const today = todayStr();

    // Mapa día -> entrega más urgente de ese día
    const byDay = {};
    deadlineTasks().forEach((t) => {
      const d = new Date(t.due);
      if (d.getFullYear() === calView.year && d.getMonth() === calView.month) {
        const day = d.getDate();
        const done = (t.progress || 0) >= 100;
        const days = daysUntil(t.due);
        if (!byDay[day] || (!done && urgencyRank(days) < urgencyRank(byDay[day].days))) {
          byDay[day] = { days, done };
        }
      }
    });

    let cells = "";
    for (let i = 0; i < startCol; i++) cells += `<div class="cal-day empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${calView.year}-${String(calView.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const info = byDay[day];
      let cls = "cal-day";
      if (ds === today) cls += " today";
      let dot = "";
      if (info) {
        if (info.done) { cls += " due-far"; dot = `<span class="dot" style="--dotc:#26c281"></span>`; }
        else if (info.days < 0) cls += " due-over";
        else if (info.days <= 3) cls += " due-soon";
        else cls += " due-far";
        if (!info.done) dot = `<span class="dot" style="--dotc:${urgencyColor(info.days, false)}"></span>`;
      }
      cells += `<button class="${cls}" data-day="${ds}">${day}${dot}</button>`;
    }
    $("#calGrid").innerHTML = cells;
    // Tocar un día abre el modal para programar una entrega ese día.
    $$("#calGrid .cal-day[data-day]").forEach((c) => c.addEventListener("click", () => {
      openTaskModal(null, { type: "deadline", due: c.dataset.day });
    }));
  }
  function urgencyRank(days) { return days < 0 ? 0 : days; }

  function renderDeadlineList() {
    const list = $("#deadlineList");
    const tasks = deadlineTasks().slice().sort((a, b) => {
      const da = (a.progress || 0) >= 100, db = (b.progress || 0) >= 100;
      if (da !== db) return da ? 1 : -1;                 // completadas al final
      return daysUntil(a.due) - daysUntil(b.due);        // por cercanía
    });
    if (!tasks.length) {
      list.innerHTML = `<div class="empty"><div class="big">📅</div>
        <p>No tienes tareas con fecha.<br>Toca ＋ y elige "Con fecha límite", o toca un día del calendario.</p></div>`;
      return;
    }
    list.innerHTML = tasks.map((t) => {
      const pct = t.progress || 0;
      const done = pct >= 100;
      const d = daysUntil(t.due);
      const col = urgencyColor(d, done);
      return `<div class="deadline-card ${done ? "done" : ""}" style="--urg:${col}">
        <div class="dc-top">
          <span class="dc-icon">${t.icon}</span>
          <div class="dc-body">
            <div class="dc-name ${done ? "done" : ""}">${escapeHTML(t.name)}</div>
            <div class="dc-due" style="color:${col}">📅 ${fmtDate(t.due)} · ${dueText(d, done)}</div>
          </div>
          <div class="dc-pct">${pct}%</div>
        </div>
        <div class="dc-bar ${done ? "done" : ""}"><i style="width:${pct}%"></i></div>
        <button class="dc-advance ${done ? "done" : ""}" data-adv="${t.id}">
          ${done ? "✓ Terminada — ver detalles" : "＋ Registrar avance"}
        </button>
      </div>`;
    }).join("");
    $$("#deadlineList .dc-advance").forEach((b) => b.addEventListener("click", () => openProgressModal(b.dataset.adv)));
  }

  function fmtDate(ds) {
    const d = new Date(ds + "T00:00:00");
    return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toLowerCase()}`;
  }

  /* ----- Modal de avance ----- */
  function openProgressModal(id) {
    progressTaskId = id;
    renderProgressModal();
    $("#progressModal").classList.remove("hidden");
  }
  function renderProgressModal() {
    const t = state.tasks.find((x) => x.id === progressTaskId);
    if (!t) return;
    const pct = t.progress || 0;
    const done = pct >= 100;
    const d = daysUntil(t.due);
    $("#progressTitle").textContent = done ? "Tarea completada 🎯" : "Registrar avance";
    $("#progressBigName").textContent = t.name;
    $("#progressBigDue").textContent = `${t.icon} ${fmtDate(t.due)} · ${dueText(d, done)}`;
    $("#progressBigPct").textContent = pct + "%";
    $("#progressBigFill").style.width = pct + "%";
    $(".progress-big-circle").style.setProperty("--p", pct + "%");
    $("#progressQuick").style.display = done ? "none" : "flex";
    $("#completeDeadlineBtn").style.display = done ? "none" : "block";
  }
  function closeProgressModal() { $("#progressModal").classList.add("hidden"); progressTaskId = null; }

  /* ----------------------------------------------------------
     Navegación entre vistas
     ---------------------------------------------------------- */
  const VIEWS = {
    home: ["hero", "filters", "taskList"],
  };
  function switchView(view) {
    // Muestra/oculta secciones
    const homeEls = [$(".hero"), $("#deadlineReminder"), $("#filters"), $("#taskList")];
    const panels = {
      stats: $("#statsPanel"), shop: $("#shopPanel"),
      achievements: $("#achievementsPanel"), agenda: $("#agendaPanel"),
    };

    Object.values(panels).forEach((p) => p.classList.add("hidden"));
    if (view === "home") {
      homeEls.forEach((e) => e.classList.remove("hidden"));
      renderReminders();
    } else {
      homeEls.forEach((e) => e.classList.add("hidden"));
      panels[view].classList.remove("hidden");
      if (view === "stats") renderStats();
      if (view === "shop") renderShop();
      if (view === "achievements") renderAchievements();
      if (view === "agenda") renderAgenda();
    }
    $$(".tab[data-view]").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ----------------------------------------------------------
     Modal de tareas
     ---------------------------------------------------------- */
  function openTaskModal(id, prefill) {
    editingId = id || null;
    const modal = $("#taskModal");
    if (editingId) {
      const t = state.tasks.find((x) => x.id === id);
      draft = { cat: t.cat, icon: t.icon, type: t.type || "daily", due: t.due || "" };
      $("#taskModalTitle").textContent = "Editar tarea";
      $("#taskNameInput").value = t.name;
      $("#deleteTaskBtn").classList.remove("hidden");
    } else {
      draft = {
        cat: (prefill && prefill.type === "deadline") ? "trabajo" : (currentFilter !== "all" ? currentFilter : "personal"),
        icon: "☀️",
        type: (prefill && prefill.type) || "daily",
        due: (prefill && prefill.due) || "",
      };
      $("#taskModalTitle").textContent = "Nueva tarea";
      $("#taskNameInput").value = "";
      $("#deleteTaskBtn").classList.add("hidden");
    }
    renderTypeSelect();
    renderCatSelect();
    renderEmojiGrid();
    renderSuggestions();
    modal.classList.remove("hidden");
    setTimeout(() => $("#taskNameInput").focus(), 100);
  }
  function closeTaskModal() { $("#taskModal").classList.add("hidden"); editingId = null; }

  function renderTypeSelect() {
    $$("#typeSelect .type-opt").forEach((el) => el.classList.toggle("active", el.dataset.type === draft.type));
    const isDeadline = draft.type === "deadline";
    $("#dueField").classList.toggle("hidden", !isDeadline);
    $("#typeHint").textContent = isDeadline
      ? "Persiste hasta la fecha. Registras tu avance poco a poco."
      : "Se repite cada día para formar un hábito.";
    // Fecha por defecto: dentro de 7 días si no hay ninguna.
    const input = $("#taskDueInput");
    if (isDeadline && !input.value) {
      input.value = draft.due || todayStr(new Date(Date.now() + 7 * 86400000));
    }
    input.min = todayStr();
  }

  function renderCatSelect() {
    $$("#catSelect .cat-opt").forEach((el) => {
      el.classList.toggle("active", el.dataset.cat === draft.cat);
    });
  }
  function renderEmojiGrid() {
    $("#emojiGrid").innerHTML = EMOJI_CHOICES.map((e) =>
      `<button type="button" class="emoji-opt ${e === draft.icon ? "active" : ""}" data-emoji="${e}">${e}</button>`
    ).join("");
    $$("#emojiGrid .emoji-opt").forEach((el) => el.addEventListener("click", () => {
      draft.icon = el.dataset.emoji; renderEmojiGrid();
    }));
  }
  function renderSuggestions() {
    $("#suggestions").innerHTML = SUGGESTIONS[draft.cat].map((s) =>
      `<button type="button" class="suggestion" data-name="${escapeHTML(s.name)}" data-icon="${s.icon}">${s.icon} ${s.name}</button>`
    ).join("");
    $$("#suggestions .suggestion").forEach((el) => el.addEventListener("click", () => {
      $("#taskNameInput").value = el.dataset.name;
      draft.icon = el.dataset.icon;
      renderEmojiGrid();
    }));
  }

  function saveTask() {
    const name = $("#taskNameInput").value.trim();
    if (!name) { $("#taskNameInput").focus(); return; }
    const isDeadline = draft.type === "deadline";
    const due = isDeadline ? ($("#taskDueInput").value || todayStr()) : "";

    if (editingId) {
      const t = state.tasks.find((x) => x.id === editingId);
      t.name = name; t.cat = draft.cat; t.icon = draft.icon; t.type = draft.type;
      if (isDeadline) {
        t.due = due;
        if (typeof t.progress !== "number") t.progress = 0;
        if (t.streak === undefined) t.streak = 0;
      }
    } else if (isDeadline) {
      state.tasks.push({
        id: "t" + state.xp + "_" + state.tasks.length + "_" + name.length + Math.floor(performance.now()),
        name, cat: draft.cat, icon: draft.icon, type: "deadline",
        due, progress: 0, createdDate: todayStr(), completedDate: null,
      });
    } else {
      state.tasks.push({
        id: "t" + state.xp + "_" + state.tasks.length + "_" + name.length + Math.floor(performance.now()),
        name, cat: draft.cat, icon: draft.icon, type: "daily",
        streak: 0, bestStreak: 0, totalDone: 0, lastDone: null, doneToday: false,
      });
    }
    const goToAgenda = isDeadline;
    save(); closeTaskModal(); render();
    checkAchievements();
    if (goToAgenda) switchView("agenda");
  }

  function deleteTask() {
    if (!editingId) return;
    state.tasks = state.tasks.filter((x) => x.id !== editingId);
    save(); closeTaskModal(); render();
  }

  /* ----------------------------------------------------------
     Recompensa + confeti + toast + haptics
     ---------------------------------------------------------- */
  function showReward({ xpGain, coinGain, streak, streakBonus, task, title, subtitle }) {
    const s = streak || 0;
    const emojis = ["🎉", "⭐", "🌟", "💫", "🎊", "🥳", "🙌", "✅"];
    $("#rewardEmoji").textContent = emojis[Math.floor(task.name.length + s) % emojis.length];
    $("#rewardTitle").textContent = title || pickPraise(s);
    $("#rewardGains").innerHTML =
      `<div class="reward-gain">+${xpGain} XP</div><div class="reward-gain">🪙 +${coinGain}</div>`;
    $("#rewardStreak").textContent = subtitle !== undefined ? subtitle : (s > 1
      ? `🔥 Racha de ${s} días${streakBonus > 0 ? ` (+${streakBonus} bonus)` : ""}`
      : "¡Empiezas una nueva racha!");
    const pop = $("#rewardPopup");
    pop.classList.remove("hidden");
    // Animación de la mascota
    $("#heroMascot").classList.add("celebrate");
    setTimeout(() => $("#heroMascot").classList.remove("celebrate"), 600);
    clearTimeout(showReward._t);
    showReward._t = setTimeout(() => pop.classList.add("hidden"), 1400);
  }

  function pickPraise(streak) {
    if (streak >= 21) return "¡Es un hábito! 🌟";
    if (streak >= 7) return "¡Imparable! 🔥";
    if (streak >= 3) return "¡Sigue así! 💪";
    const opts = ["¡Bien hecho!", "¡Genial!", "¡Lo lograste!", "¡Excelente!", "¡Un paso más!"];
    return opts[streak % opts.length];
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 3200);
  }

  function haptic() {
    if (state.settings.haptics && navigator.vibrate) navigator.vibrate(30);
  }

  // Confeti en canvas
  const canvas = $("#confetti");
  const ctx = canvas.getContext("2d");
  let confettiPieces = [];
  let confettiRAF = null;
  function sizeCanvas() { canvas.width = innerWidth; canvas.height = innerHeight; }
  function burstConfetti() {
    sizeCanvas();
    const colors = ["#6c5ce7", "#ff7aa2", "#ffb020", "#26c281", "#4b9fff", "#ff8a5b"];
    for (let i = 0; i < 90; i++) {
      confettiPieces.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 120,
        y: canvas.height / 3,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -12 - 4,
        g: 0.35 + Math.random() * 0.2,
        size: 5 + Math.random() * 7,
        color: colors[i % colors.length],
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        life: 90 + Math.random() * 40,
      });
    }
    if (!confettiRAF) confettiRAF = requestAnimationFrame(stepConfetti);
  }
  function stepConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiPieces.forEach((p) => {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    confettiPieces = confettiPieces.filter((p) => p.life > 0 && p.y < canvas.height + 30);
    if (confettiPieces.length) {
      confettiRAF = requestAnimationFrame(stepConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confettiRAF = null;
    }
  }
  addEventListener("resize", sizeCanvas);

  /* ----------------------------------------------------------
     Utilidades
     ---------------------------------------------------------- */
  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ----------------------------------------------------------
     Onboarding
     ---------------------------------------------------------- */
  function renderCompanionPicker() {
    const picker = $("#companionPicker");
    const labels = { "🌱": "Planta", "🐣": "Pollito", "🐱": "Gato", "🐉": "Dragón" };
    picker.innerHTML = COMPANIONS.map((c, i) =>
      `<button type="button" class="companion-opt ${i === 0 ? "active" : ""}" data-c="${c}" title="${labels[c]}">${c}</button>`
    ).join("");
    let chosen = COMPANIONS[0];
    $$("#companionPicker .companion-opt").forEach((el) => el.addEventListener("click", () => {
      $$("#companionPicker .companion-opt").forEach((x) => x.classList.remove("active"));
      el.classList.add("active");
      chosen = el.dataset.c;
    }));
    $("#startBtn").addEventListener("click", () => {
      const name = $("#playerNameInput").value.trim() || "Aventurero";
      state = defaultState();
      state.player.name = name;
      state.player.companion = chosen;
      // Semillas de ejemplo para arrancar rápido
      state.tasks = [
        { id: "seed1", name: "Levantarme temprano", cat: "personal", icon: "☀️", type: "daily", streak: 0, bestStreak: 0, totalDone: 0, lastDone: null, doneToday: false },
        { id: "seed2", name: "Tender la cama", cat: "hogar", icon: "🛏️", type: "daily", streak: 0, bestStreak: 0, totalDone: 0, lastDone: null, doneToday: false },
        { id: "seed3", name: "Beber agua", cat: "personal", icon: "💧", type: "daily", streak: 0, bestStreak: 0, totalDone: 0, lastDone: null, doneToday: false },
      ];
      save();
      boot();
    });
  }

  /* ----------------------------------------------------------
     Arranque
     ---------------------------------------------------------- */
  function boot() {
    $("#onboarding").classList.add("hidden");
    $("#app").classList.remove("hidden");
    dailyRollover();
    applyTheme();
    render();
    switchView("home");
  }

  function wireEvents() {
    // Filtros
    $$("#filters .chip").forEach((el) => el.addEventListener("click", () => {
      $$("#filters .chip").forEach((x) => x.classList.remove("active"));
      el.classList.add("active");
      currentFilter = el.dataset.filter;
      renderTasks();
    }));

    // Tabbar
    $$(".tab[data-view]").forEach((el) => el.addEventListener("click", () => switchView(el.dataset.view)));
    $("#addTaskFab").addEventListener("click", () => openTaskModal(null));

    // Tienda (ahora accesible desde el botón del encabezado)
    $("#shopBtn").addEventListener("click", () => switchView("shop"));

    // Modal tareas
    $("#closeTaskModal").addEventListener("click", closeTaskModal);
    $("#taskModal").addEventListener("click", (e) => { if (e.target.id === "taskModal") closeTaskModal(); });
    $("#saveTaskBtn").addEventListener("click", saveTask);
    $("#deleteTaskBtn").addEventListener("click", deleteTask);
    $$("#catSelect .cat-opt").forEach((el) => el.addEventListener("click", () => {
      draft.cat = el.dataset.cat; renderCatSelect(); renderSuggestions();
    }));
    $$("#typeSelect .type-opt").forEach((el) => el.addEventListener("click", () => {
      draft.type = el.dataset.type; renderTypeSelect();
    }));
    $("#taskDueInput").addEventListener("change", (e) => { draft.due = e.target.value; });

    // Calendario
    $("#calPrev").addEventListener("click", () => {
      calView.month--; if (calView.month < 0) { calView.month = 11; calView.year--; } renderCalendar();
    });
    $("#calNext").addEventListener("click", () => {
      calView.month++; if (calView.month > 11) { calView.month = 0; calView.year++; } renderCalendar();
    });

    // Modal de avance
    $("#closeProgressModal").addEventListener("click", closeProgressModal);
    $("#progressModal").addEventListener("click", (e) => { if (e.target.id === "progressModal") closeProgressModal(); });
    $$("#progressQuick button").forEach((b) => b.addEventListener("click", () => advanceDeadline(progressTaskId, parseInt(b.dataset.add, 10))));
    $("#completeDeadlineBtn").addEventListener("click", () => {
      const t = state.tasks.find((x) => x.id === progressTaskId);
      if (t) advanceDeadline(progressTaskId, 100 - (t.progress || 0));
    });
    $("#deleteDeadlineBtn").addEventListener("click", () => {
      if (!progressTaskId) return;
      state.tasks = state.tasks.filter((x) => x.id !== progressTaskId);
      closeProgressModal(); save(); render(); renderAgenda();
    });

    // Ajustes
    $("#settingsBtn").addEventListener("click", openSettings);
    $("#closeSettingsModal").addEventListener("click", () => $("#settingsModal").classList.add("hidden"));
    $("#settingsModal").addEventListener("click", (e) => { if (e.target.id === "settingsModal") $("#settingsModal").classList.add("hidden"); });
    $("#saveSettingsBtn").addEventListener("click", saveSettings);
    $("#resetBtn").addEventListener("click", resetAll);

    // Cerrar recompensa al tocar
    $("#rewardPopup").addEventListener("click", () => $("#rewardPopup").classList.add("hidden"));
  }

  function openSettings() {
    $("#settingsNameInput").value = state.player.name;
    $("#habitGoalInput").value = state.settings.habitGoal;
    $("#hapticsToggle").checked = !!state.settings.haptics;
    $("#settingsModal").classList.remove("hidden");
  }
  function saveSettings() {
    const name = $("#settingsNameInput").value.trim();
    if (name) state.player.name = name;
    const goal = parseInt($("#habitGoalInput").value, 10);
    if (goal >= 3 && goal <= 90) state.settings.habitGoal = goal;
    state.settings.haptics = $("#hapticsToggle").checked;
    save(); $("#settingsModal").classList.add("hidden"); render();
  }
  function resetAll() {
    if (!confirm("¿Seguro que quieres borrar todo tu progreso? Esto no se puede deshacer.")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */
  function init() {
    load();
    wireEvents();
    if (state) {
      boot();
    } else {
      renderCompanionPicker();
      $("#onboarding").classList.remove("hidden");
    }
    // Registro del service worker (offline / instalable)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
