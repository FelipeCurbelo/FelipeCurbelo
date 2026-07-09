/* =====================================================================
   Kancha — canchas de Arauca.
   Port en JavaScript puro del prototipo de diseño (React → vanilla).
   PWA sin backend: usuario y reservas viven en localStorage.
   Mapa: Leaflet (vendorizado) + tiles oscuros de CARTO.
   ===================================================================== */
(() => {
  "use strict";

  const DOW = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const DOWF = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const MESF = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  // Iconos Material Symbols por codepoint (fuente subconjuntada, sin ligaduras).
  const ICON = {
    arrow_back: "\ue5c4", arrow_forward: "\ue5c8", chat: "\ue0b7", check: "\ue5ca",
    confirmation_number: "\ue638", near_me: "\ue569", schedule: "\ue192", search: "\ue8b6",
    search_off: "\uea76", stadium: "\ueb90", star: "\ue838", map: "\ue55b",
    format_list_bulleted: "\ue241", sports_soccer: "\uea2f", grass: "\uf205",
    local_parking: "\ue54f", wc: "\ue63d", storefront: "\uea12", water_drop: "\ue798",
    mode_fan: "\uf168", roofing: "\uf201", sports: "\uea30", checkroom: "\uf19e",
    groups: "\uf233", light_mode: "\ue518", lightbulb: "\ue0f0",
  };
  const SV_ICON = {
    Parqueadero: ICON.local_parking, "Baños": ICON.wc, Tienda: ICON.storefront, "Graderías": ICON.stadium,
    "Hidratación": ICON.water_drop, Aire: ICON.mode_fan, Techada: ICON.roofing, "Árbitro": ICON.sports, Camerinos: ICON.checkroom,
  };
  const METODOS = [
    { id: "nequi", badge: "N", bg: "#3B1544", fg: "#E9A7FF", name: "Nequi", desc: "Pago inmediato desde tu celular" },
    { id: "davi", badge: "D", bg: "#3D1518", fg: "#FF9AA2", name: "Daviplata", desc: "Transferencia desde la app" },
    { id: "efectivo", badge: "$", bg: "#16281F", fg: "#8FE3B0", name: "Efectivo en la cancha", desc: "Paga al llegar — tu turno queda apartado" },
  ];
  const RAIL_STEP = 332; // ancho tarjeta (320) + gap (12)

  const fmt = (n) => "$" + Number(n).toLocaleString("es-CO");
  const tipoLabel = (c) => (c.tipo === "futsal" ? "Futsal" : "Sintética");
  const tipoIcon = (c) => (c.tipo === "futsal" ? ICON.sports_soccer : ICON.grass);
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

  // --------------------------------------------------------------- Estado
  const S = {
    screen: "onb", onbStep: 0, userName: "", userPhone: "",
    tab: "mapa", query: "", filter: "todas", selCourtId: null,
    overlay: null, detailId: null, dateStr: "", hour: null, dur: 1,
    metodo: "nequi", paying: false, lastCode: null, bookings: [], cancelArm: null,
  };
  let map = null, layer = null, msig = "", railEl = null, cancelTimer = null, payTimer = null;

  // --------------------------------------------------------------- Storage
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // --------------------------------------------------------------- Helpers
  const courts = () => window.CANCHAS || [];
  const pad = (n) => String(n).padStart(2, "0");
  function day(off) {
    const d = new Date(); d.setDate(d.getDate() + off);
    return {
      str: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
      dow: off === 0 ? "HOY" : off === 1 ? "MAÑ" : DOW[d.getDay()],
      dnum: d.getDate(), d,
    };
  }
  const parseD = (str) => new Date(str + "T12:00:00");
  const fechaLarga = (str) => { const d = parseD(str); return DOWF[d.getDay()] + " " + d.getDate() + " de " + MESF[d.getMonth()]; };
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; }
  const seedBusy = (cid, dstr, h) => hash(cid + dstr + h) % 7 < 2;
  const isBooked = (cid, dstr, h) =>
    S.bookings.some((b) => b.estado === "activa" && b.courtId === cid && h >= b.hour && h < b.hour + b.dur && b.dateStr === dstr);
  function slotFree(c, dstr, h, dur) {
    const today = day(0).str;
    if (dstr === today && h <= new Date().getHours()) return false;
    for (let k = h; k < h + dur; k++) {
      if (k < c.horaApertura || k >= c.horaCierre) return false;
      if (seedBusy(c.id, dstr, k) || isBooked(c.id, dstr, k)) return false;
    }
    return true;
  }
  function freeStarts(c, dstr, dur) {
    const out = [];
    for (let h = c.horaApertura; h < c.horaCierre; h++) if (slotFree(c, dstr, h, dur || 1)) out.push(h);
    return out;
  }
  function filtered() {
    const q = S.query.trim().toLowerCase();
    return courts().filter((c) => {
      if (S.filter === "sintetica" && c.tipo !== "sintetica") return false;
      if (S.filter === "futsal" && c.tipo !== "futsal") return false;
      if (S.filter === "techada" && !c.techada) return false;
      if (q && !(c.nombre + " " + c.barrio).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function selCourt() {
    const f = filtered();
    return f.find((c) => c.id === S.selCourtId) || f[0] || courts()[0] || null;
  }
  const initials = () => S.userName.trim()
    ? S.userName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "K";
  const photoTile = (c, big) =>
    `<div class="photo${big ? " big" : ""}" style="--pc:${c.color || "#24402e"}"><span class="msi">${tipoIcon(c)}</span></div>`;

  const $ = (id) => document.getElementById(id);

  // --------------------------------------------------------------- setState
  function setState(patch, opts) {
    Object.assign(S, patch);
    render(opts && opts.only);
  }

  // --------------------------------------------------------------- Mapa
  function initMap() {
    if (map || typeof L === "undefined") return;
    const el = $("kmap");
    if (!el || !el.offsetWidth) return;
    map = L.map(el, {
      zoomControl: false, attributionControl: false,
      scrollWheelZoom: false, dragging: true, touchZoom: true, doubleClickZoom: true,
    }).setView([7.083, -70.759], 14);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19 }).addTo(map);
    layer = L.layerGroup().addTo(map);
    msig = "";
    syncMarkers();
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 300);
  }
  function syncMarkers() {
    if (!map || typeof L === "undefined") return;
    const f = filtered();
    const sel = selCourt();
    const sig = f.map((c) => c.id).join(",") + "|" + (sel && sel.id);
    if (sig === msig) return;
    msig = sig;
    layer.clearLayers();
    f.forEach((c) => {
      const isSel = sel && c.id === sel.id;
      const st = isSel
        ? "background:var(--acc);color:var(--acc-ink);border:1px solid var(--acc)"
        : "background:rgba(13,21,17,.92);color:var(--acc);border:1px solid var(--acc-bord)";
      const html = `<div class="kpin-inner" style="${st}">$${Math.round(c.precioHora / 1000)}k</div>`;
      const mk = L.marker([c.lat, c.lng], { icon: L.divIcon({ className: "kpin", html, iconSize: null }) });
      mk.on("click", () => pickCourt(c.id, true));
      layer.addLayer(mk);
    });
  }
  function pickCourt(id, scrollRail) {
    S.selCourtId = id;
    const c = courts().find((x) => x.id === id);
    if (c && map) map.panTo([c.lat - 0.0038, c.lng], { animate: true });
    renderRail();
    syncMarkers();
    if (scrollRail && railEl) {
      const idx = filtered().findIndex((x) => x.id === id);
      if (idx >= 0) railEl.scrollTo({ left: idx * RAIL_STEP, behavior: "smooth" });
    }
  }
  function recenter() { if (map) map.setView([7.083, -70.759], 14, { animate: true }); }

  // --------------------------------------------------------------- Reservas
  function createBooking() {
    const c = courts().find((x) => x.id === S.detailId);
    const code = "KAN-" + Date.now().toString(36).slice(-4).toUpperCase();
    const b = { code, courtId: c.id, dateStr: S.dateStr, hour: S.hour, dur: S.dur, total: c.precioHora * S.dur, metodo: S.metodo, ts: Date.now(), estado: "activa" };
    const bookings = S.bookings.concat([b]);
    lsSet("kancha_bookings_v1", bookings);
    S.bookings = bookings;
    return b;
  }
  function waHref(b, c) {
    const name = S.userName || "un jugador";
    const txt = "Hola " + c.nombre + "! Reservé por Kancha: " + fechaLarga(b.dateStr) + ", " +
      b.hour + ":00-" + (b.hour + b.dur) + ":00. Código " + b.code + ". A nombre de " + name +
      (S.userPhone ? " (" + S.userPhone + ")" : "") + ". ¿Me confirman? Gracias.";
    return "https://wa.me/" + c.telefono + "?text=" + encodeURIComponent(txt);
  }
  function openDetail(cid, hour) {
    setState({ overlay: "detail", detailId: cid, selCourtId: cid, dateStr: day(0).str, hour: hour != null ? hour : null, dur: 1 });
  }

  // --------------------------------------------------------------- Render raíz
  function render(only) {
    const app = S.screen === "app";
    // Visibilidad de regiones
    show("onboarding", S.screen === "onb");
    show("chrome", app && S.tab !== "reservas");
    show("rail", app && S.tab === "mapa");
    show("screenLista", app && S.tab === "lista");
    show("screenReservas", app && S.tab === "reservas");
    show("tabbar", app);
    show("mapFadeTop", app && S.tab !== "reservas");
    show("mapFadeBottom", app && S.tab === "mapa");
    show("detail", S.overlay === "detail");
    show("pay", S.overlay === "pay");
    show("confirm", S.overlay === "confirm");

    if (S.screen === "onb") { renderOnboarding(); return; }

    renderChrome();
    renderTabbar();
    if (S.tab === "mapa") renderRail();
    if (S.tab === "lista") renderLista();
    if (S.tab === "reservas") renderReservas();
    if (S.overlay === "detail") renderDetail();
    if (S.overlay === "pay") renderPay();
    if (S.overlay === "confirm") renderConfirm();
    syncMarkers();
  }
  function show(id, v) { const el = $(id); if (el) el.classList.toggle("hidden", !v); }

  // --------------------------------------------------------------- Chrome
  let chromeBuilt = false;
  function renderChrome() {
    const el = $("chrome");
    if (S.tab === "reservas") return;
    if (!chromeBuilt) {
      el.innerHTML = `
        <div class="chrome-top">
          <div>
            <div class="wordmark">KANCHA</div>
            <div class="wordsub"><span class="tick"></span><span id="wordSub"></span></div>
          </div>
          <div class="chrome-actions">
            <div class="round-btn" id="recenterBtn"><span class="msi">${ICON.near_me}</span></div>
            <div class="round-btn avatar" id="chromeAvatar"></div>
          </div>
        </div>
        <div class="searchpill">
          <span class="msi">${ICON.search}</span>
          <input id="searchInput" type="search" placeholder="¿Dónde juegas hoy?" autocomplete="off" />
        </div>
        <div class="filters khs" id="filters"></div>`;
      $("recenterBtn").onclick = recenter;
      $("chromeAvatar").onclick = () => setState({ screen: "onb", onbStep: 1, overlay: null });
      const input = $("searchInput");
      input.value = S.query;
      input.oninput = (e) => {
        S.query = e.target.value;
        S.selCourtId = null;
        $("wordSub"); // no-op
        renderRail(); syncMarkers();
        updateChromeAvatar();
      };
      const FL = [["todas", "Todas"], ["sintetica", "Sintética"], ["futsal", "Futsal"], ["techada", "Techadas"]];
      $("filters").innerHTML = FL.map(([k, label]) =>
        `<div class="fchip" data-k="${k}">${label}</div>`).join("");
      $("filters").querySelectorAll(".fchip").forEach((chip) => {
        chip.onclick = () => {
          const k = chip.dataset.k;
          const next = courts().filter((c) => (k === "todas") || (k === "techada" ? c.techada : c.tipo === k));
          setState({ filter: k, selCourtId: next[0] ? next[0].id : null });
        };
      });
      chromeBuilt = true;
    }
    $("wordSub").textContent = "ARAUCA · " + courts().length + " CANCHAS";
    updateChromeAvatar();
    $("filters").querySelectorAll(".fchip").forEach((chip) =>
      chip.classList.toggle("active", chip.dataset.k === S.filter));
  }
  function updateChromeAvatar() { const a = $("chromeAvatar"); if (a) a.textContent = initials(); }

  // --------------------------------------------------------------- Tabbar
  let tabbarBuilt = false;
  function renderTabbar() {
    const el = $("tabbar");
    const TABS = [
      { key: "mapa", icon: ICON.map, label: "Mapa" },
      { key: "lista", icon: ICON.format_list_bulleted, label: "Lista" },
      { key: "reservas", icon: ICON.confirmation_number, label: "Reservas" },
    ];
    if (!tabbarBuilt) {
      el.innerHTML = TABS.map((t) =>
        `<div class="tab" data-key="${t.key}">
           <span class="msi" data-role="icon">${t.icon}</span>
           <span class="tlabel">${t.label}</span>
           <span class="dot hidden"></span>
         </div>`).join("");
      el.querySelectorAll(".tab").forEach((tab) => {
        tab.onclick = () => setState({ tab: tab.dataset.key });
      });
      tabbarBuilt = true;
    }
    const today = day(0).str;
    const upcoming = S.bookings.filter((b) => b.estado === "activa" &&
      (b.dateStr > today || (b.dateStr === today && b.hour + b.dur > new Date().getHours())));
    el.querySelectorAll(".tab").forEach((tab) => {
      const active = tab.dataset.key === S.tab;
      tab.classList.toggle("active", active);
      tab.querySelector('[data-role="icon"]').className = active ? "msi msi-f" : "msi";
      const dot = tab.querySelector(".dot");
      dot.classList.toggle("hidden", !(tab.dataset.key === "reservas" && upcoming.length > 0 && !active));
    });
  }

  // --------------------------------------------------------------- Rail
  function renderRail() {
    const el = $("rail");
    railEl = el;
    const today = day(0).str;
    const f = filtered();
    const sel = selCourt();
    el.innerHTML = f.map((c) => {
      const free = freeStarts(c, today, 1).length;
      const isSel = sel && sel.id === c.id;
      return `
      <div class="rcard${isSel ? " sel" : ""}" data-id="${c.id}">
        ${photoTile(c)}
        <div class="rcard-body">
          <div class="row-between">
            <span class="rcard-name">${esc(c.nombre)}</span>
            <span class="rating"><span class="msi msi-f">${ICON.star}</span><span>${c.rating.toFixed(1)}</span></span>
          </div>
          <div class="meta">${esc((tipoLabel(c) + " · " + c.jugadores + " · " + c.barrio).toUpperCase())}</div>
          <div class="row-between" style="margin-top:9px">
            <span><span class="price">${fmt(c.precioHora)}</span><small> /hora</small></span>
            <span class="free-pill ${free > 0 ? "ok" : "no"}">${free > 0 ? free + " LIBRES HOY" : "COMPLETA HOY"}</span>
          </div>
        </div>
        <div class="rcard-go"><span class="msi">${ICON.arrow_forward}</span></div>
      </div>`;
    }).join("");
    el.querySelectorAll(".rcard").forEach((card) => {
      card.onclick = () => openDetail(card.dataset.id);
    });
    // sincroniza selección al hacer scroll
    el.onscroll = () => {
      clearTimeout(el._st);
      el._st = setTimeout(() => {
        const list = filtered();
        const idx = Math.max(0, Math.min(list.length - 1, Math.round(el.scrollLeft / RAIL_STEP)));
        const c = list[idx];
        if (c && c.id !== (selCourt() || {}).id) {
          S.selCourtId = c.id;
          if (map) map.panTo([c.lat - 0.0038, c.lng], { animate: true });
          el.querySelectorAll(".rcard").forEach((card) => card.classList.toggle("sel", card.dataset.id === c.id));
          syncMarkers();
        }
      }, 140);
    };
  }

  // --------------------------------------------------------------- Lista
  function renderLista() {
    const el = $("screenLista");
    const today = day(0).str;
    const f = filtered();
    const rows = f.map((c) => {
      const starts = freeStarts(c, today, 1);
      const chips = starts.slice(0, 3).map((h) =>
        `<span class="qchip" data-id="${c.id}" data-h="${h}">${h}:00</span>`).join("");
      const noFree = starts.length === 0 ? `<span class="notoday">SIN TURNOS HOY</span>` : "";
      const more = starts.length > 3 ? `<span class="more">+${starts.length - 3}</span>` : "";
      return `
      <div class="lcard" data-id="${c.id}">
        ${photoTile(c)}
        <div class="lcard-body">
          <div class="row-between">
            <span class="lcard-name">${esc(c.nombre)}</span>
            <span class="rating"><span class="msi msi-f">${ICON.star}</span><span>${c.rating.toFixed(1)}</span></span>
          </div>
          <div class="meta" style="color:#7E9689">${esc((tipoLabel(c) + " · " + c.jugadores + " · " + c.barrio).toUpperCase())}</div>
          <div class="lchips">
            ${chips}${noFree}${more}
            <span class="lprice">${fmt(c.precioHora)}<small>/h</small></span>
          </div>
        </div>
      </div>`;
    }).join("");
    el.innerHTML = `
      <div class="list-head">
        <span class="serif">Cerca de ti</span>
        <span class="count">${f.length} DISPONIBLES</span>
      </div>
      ${f.length ? `<div class="stack">${rows}</div>` :
        `<div class="empty"><span class="msi">${ICON.search_off}</span><div class="msg">Sin canchas para ese filtro</div></div>`}`;
    el.querySelectorAll(".lcard").forEach((card) => {
      card.onclick = () => openDetail(card.dataset.id);
    });
    el.querySelectorAll(".qchip").forEach((chip) => {
      chip.onclick = (e) => { e.stopPropagation(); openDetail(chip.dataset.id, Number(chip.dataset.h)); };
    });
  }

  // --------------------------------------------------------------- Reservas
  function renderReservas() {
    const el = $("screenReservas");
    const today = day(0).str;
    const upcoming = S.bookings
      .filter((b) => b.estado === "activa" && (b.dateStr > today || (b.dateStr === today && b.hour + b.dur > new Date().getHours())))
      .sort((a, b) => (a.dateStr === b.dateStr ? a.hour - b.hour : a.dateStr < b.dateStr ? -1 : 1));
    const past = S.bookings.filter((b) => !upcoming.includes(b)).sort((a, b) => b.ts - a.ts);
    const resSub = upcoming.length > 0 ? upcoming.length + " PRÓXIMAS · TU AGENDA DE JUEGO" : "TU AGENDA DE JUEGO";

    const upCard = (b) => {
      const c = courts().find((x) => x.id === b.courtId) || {};
      const d = parseD(b.dateStr);
      const armed = S.cancelArm === b.code;
      const wa = c.telefono ? waHref(b, c) : "#";
      return `
      <div class="bcard">
        <div class="bcard-top">
          <div class="bdate"><div class="dnum">${d.getDate()}</div><div class="mes">${MES[d.getMonth()]}</div></div>
          <div class="bcard-info">
            <div class="name">${esc(c.nombre || "Cancha")}</div>
            <div class="hora">${b.hour}:00–${b.hour + b.dur}:00 · ${b.dur}H</div>
            <div class="metaline">${esc(((c.barrio || "") + " · CÓDIGO " + b.code).toUpperCase())}</div>
          </div>
          <div class="btotal">${fmt(b.total)}</div>
        </div>
        <div class="bcard-actions">
          <a class="wa-btn" href="${wa}" target="_blank" rel="noopener"><span class="msi">${ICON.chat}</span>WhatsApp</a>
          <div class="cancel-btn${armed ? " armed" : ""}" data-cancel="${b.code}">${armed ? "¿Confirmar?" : "Cancelar"}</div>
        </div>
      </div>`;
    };
    const pastRow = (b) => {
      const c = courts().find((x) => x.id === b.courtId) || {};
      const d = parseD(b.dateStr);
      const cancelada = b.estado === "cancelada";
      return `
      <div class="pastrow">
        <div class="pd">${d.getDate()} ${MES[d.getMonth()]}</div>
        <div class="pn">${esc(c.nombre || "Cancha")}</div>
        <span class="estado ${cancelada ? "cancelada" : "jugada"}">${cancelada ? "CANCELADA" : "JUGADA"}</span>
      </div>`;
    };

    let body;
    if (S.bookings.length === 0) {
      body = `
        <div class="res-empty">
          <span class="msi">${ICON.confirmation_number}</span>
          <div class="serif">Aún no tienes reservas</div>
          <div class="txt">Explora el mapa y aparta tu primera<br>hora de juego.</div>
          <div class="cta-ghost" id="resExplore">Explorar canchas</div>
        </div>`;
    } else {
      body =
        (upcoming.length ? `<div class="mono-label">PRÓXIMAS</div><div class="stack">${upcoming.map(upCard).join("")}</div>` : "") +
        (past.length ? `<div class="mono-label">HISTORIAL</div><div class="stack">${past.map(pastRow).join("")}</div>` : "");
    }
    el.innerHTML = `
      <div class="res-head">
        <div>
          <div class="res-title">Mis reservas</div>
          <div class="res-sub">${resSub}</div>
        </div>
        <div class="res-avatar" id="resAvatar">${initials()}</div>
      </div>
      ${body}`;
    const av = $("resAvatar"); if (av) av.onclick = () => setState({ screen: "onb", onbStep: 1, overlay: null });
    const ex = $("resExplore"); if (ex) ex.onclick = () => setState({ overlay: null, tab: "mapa" });
    el.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.onclick = () => armCancel(btn.dataset.cancel);
    });
  }
  function armCancel(code) {
    if (S.cancelArm === code) {
      const bookings = S.bookings.map((x) => (x.code === code ? Object.assign({}, x, { estado: "cancelada" }) : x));
      lsSet("kancha_bookings_v1", bookings);
      setState({ bookings, cancelArm: null });
    } else {
      clearTimeout(cancelTimer);
      setState({ cancelArm: code });
      cancelTimer = setTimeout(() => setState({ cancelArm: null }), 3200);
    }
  }

  // --------------------------------------------------------------- Detalle
  function renderDetail() {
    const c = courts().find((x) => x.id === S.detailId) || selCourt();
    if (!c) return;
    const el = $("detail");
    const nowH = new Date().getHours();
    const abierta = nowH >= c.horaApertura && nowH < c.horaCierre;
    const openChip = abierta ? "ABIERTA · CIERRA " + c.horaCierre + ":00" : "ABRE " + c.horaApertura + ":00";
    const metaChips = [
      { icon: ICON.sports_soccer, label: tipoLabel(c) },
      { icon: ICON.groups, label: c.jugadores },
      c.techada ? { icon: ICON.roofing, label: "Techada" } : { icon: ICON.light_mode, label: "Aire libre" },
    ];
    if (c.iluminada) metaChips.push({ icon: ICON.lightbulb, label: "Iluminada" });

    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = day(i);
      return `<div class="dchip${S.dateStr === d.str ? " sel" : ""}" data-date="${d.str}">
                <span class="dow">${d.dow}</span><span class="dn">${d.dnum}</span></div>`;
    }).join("");

    const durs = [1, 2].map((n) =>
      `<div class="durbtn${S.dur === n ? " sel" : ""}" data-dur="${n}">${n} ${n === 1 ? "hora" : "horas"}</div>`).join("");

    const slots = Array.from({ length: c.horaCierre - c.horaApertura }, (_, i) => {
      const h = c.horaApertura + i;
      const free = slotFree(c, S.dateStr, h, S.dur);
      const sel = S.hour === h;
      const cls = sel ? "slot sel" : free ? "slot" : "slot busy";
      return `<div class="${cls}" ${free && !sel ? `data-hour="${h}"` : sel ? `data-hour="${h}"` : ""}>${h}:00</div>`;
    }).join("");

    const servicios = c.servicios.map((s) =>
      `<span class="info-chip"><span class="msi">${SV_ICON[s] || ICON.check}</span>${esc(s)}</span>`).join("");
    const metaChipsHtml = metaChips.map((m) =>
      `<span class="info-chip"><span class="msi">${m.icon}</span>${m.label}</span>`).join("");

    const total = c.precioHora * S.dur;
    const selD = day([0, 1, 2, 3, 4, 5, 6].find((i) => day(i).str === S.dateStr) || 0);
    const totalSub = S.hour != null
      ? (S.hour + ":00–" + (S.hour + S.dur) + ":00 · " + selD.dow + " " + selD.dnum).toUpperCase()
      : "ELIGE UNA HORA LIBRE";
    const canGo = S.hour != null;

    el.innerHTML = `
      <div class="det-scroll khs">
        <div class="det-photo">
          ${photoTile(c, true)}
          <div class="grad"></div>
          <div class="det-back" id="detBack"><span class="msi">${ICON.arrow_back}</span></div>
          <div class="open-chip">${openChip}</div>
        </div>
        <div class="det-body">
          <div class="det-title-row">
            <span class="det-title">${esc(c.nombre)}</span>
            <span class="rating"><span class="msi msi-f">${ICON.star}</span><span style="font-size:13px">${c.rating.toFixed(1)}</span></span>
          </div>
          <div class="det-addr">${esc((c.direccion + " · " + c.barrio).toUpperCase())} · ${c.resenas} RESEÑAS</div>
          <div class="chip-row">${metaChipsHtml}</div>

          <div class="hr"></div>
          <div class="sec-title">Elige tu horario</div>
          <div class="dates khs" id="detDates">${dates}</div>
          <div class="durseg" id="detDurs">${durs}</div>
          <div class="slots" id="detSlots">${slots}</div>
          <div class="legend">
            <span><span class="sq free"></span>LIBRE</span>
            <span><span class="sq busy"></span>OCUPADO</span>
          </div>

          <div class="hr"></div>
          <div class="sec-title">Servicios</div>
          <div class="chip-row">${servicios}</div>
          <div class="horario-line"><span class="msi">${ICON.schedule}</span>Abierta ${c.horaApertura}:00 – ${c.horaCierre}:00 · ${fmt(c.precioHora)} por hora</div>
        </div>
      </div>
      <div class="det-footer">
        <div class="foot-total">
          <div class="lbl">TOTAL</div>
          <div class="amt">${fmt(total)}</div>
          <div class="sub">${totalSub}</div>
        </div>
        <button class="cta${canGo ? "" : " disabled"}" id="detContinue">Continuar</button>
      </div>`;

    $("detBack").onclick = () => setState({ overlay: null });
    $("detDates").querySelectorAll(".dchip").forEach((d) => {
      d.onclick = () => setState({ dateStr: d.dataset.date, hour: null });
    });
    $("detDurs").querySelectorAll(".durbtn").forEach((b) => {
      b.onclick = () => {
        const n = Number(b.dataset.dur);
        const patch = { dur: n };
        if (S.hour != null && !slotFree(c, S.dateStr, S.hour, n)) patch.hour = null;
        setState(patch);
      };
    });
    $("detSlots").querySelectorAll(".slot[data-hour]").forEach((sl) => {
      if (sl.classList.contains("busy")) return;
      sl.onclick = () => setState({ hour: Number(sl.dataset.hour) });
    });
    $("detContinue").onclick = () => { if (canGo) setState({ overlay: "pay" }); };
  }

  // --------------------------------------------------------------- Pago
  function renderPay() {
    const c = courts().find((x) => x.id === S.detailId) || selCourt();
    if (!c) return;
    const el = $("pay");
    const total = c.precioHora * S.dur;
    const methods = METODOS.map((m) => `
      <div class="paymethod${S.metodo === m.id ? " sel" : ""}" data-m="${m.id}">
        <div class="pm-badge" style="background:${m.bg};color:${m.fg}">${m.badge}</div>
        <div style="flex:1;min-width:0">
          <div class="pm-name">${m.name}</div>
          <div class="pm-desc">${m.desc}</div>
        </div>
        <div class="pm-radio"></div>
      </div>`).join("");

    el.innerHTML = `
      <div class="pay-head">
        <div class="round-btn" id="payBack"><span class="msi">${ICON.arrow_back}</span></div>
        <span class="serif">Confirmar y pagar</span>
      </div>
      <div class="pay-scroll khs">
        <div class="pay-summary">
          <div class="cname">${esc(c.nombre)}</div>
          <div class="cmeta">${esc((tipoLabel(c) + " · " + c.direccion + " · " + c.barrio).toUpperCase())}</div>
          <div class="pay-rows">
            <div><span class="k">Fecha</span><span class="v">${fechaLarga(S.dateStr)}</span></div>
            <div><span class="k">Hora</span><span class="v mono">${S.hour != null ? S.hour + ":00 – " + (S.hour + S.dur) + ":00" : "—"}</span></div>
            <div><span class="k">Duración</span><span class="v">${S.dur} ${S.dur === 1 ? "hora" : "horas"}</span></div>
          </div>
          <div class="pay-total"><span class="k">TOTAL</span><span class="v">${fmt(total)}</span></div>
        </div>
        <div class="mono-label" style="margin:18px 2px 10px">MÉTODO DE PAGO</div>
        <div class="stack" style="gap:8px" id="payMethods">${methods}</div>
        <div class="pay-note">PAGO SIMULADO — PROTOTIPO. LA CANCHA CONFIRMA TU TURNO POR WHATSAPP.</div>
      </div>
      <div class="pay-footer">
        <button class="cta-full" id="payConfirm">Pagar ${fmt(total)}</button>
      </div>
      ${S.paying ? `<div class="paying"><div class="spinner"></div><div class="lbl">PROCESANDO PAGO…</div></div>` : ""}`;

    $("payBack").onclick = () => setState({ overlay: "detail" });
    $("payMethods").querySelectorAll(".paymethod").forEach((row) => {
      row.onclick = () => setState({ metodo: row.dataset.m });
    });
    $("payConfirm").onclick = () => {
      if (S.paying) return;
      setState({ paying: true });
      clearTimeout(payTimer);
      payTimer = setTimeout(() => {
        const b = createBooking();
        setState({ paying: false, overlay: "confirm", lastCode: b.code });
      }, 1400);
    };
  }

  // --------------------------------------------------------------- Confirmación
  function renderConfirm() {
    const el = $("confirm");
    const b = S.bookings.find((x) => x.code === S.lastCode);
    const c = b && courts().find((x) => x.id === b.courtId);
    const firstName = (S.userName || "").trim().split(/\s+/)[0];
    const title = firstName ? "¡Listo, " + firstName + "!" : "¡Reserva confirmada!";
    if (!b || !c) {
      el.innerHTML = `<div class="conf-wrap"><div class="conf-title">${title}</div></div>`;
      return;
    }
    const metodoLabel = (METODOS.find((m) => m.id === b.metodo) || {}).name || "—";
    el.innerHTML = `
      <div class="conf-wrap">
        <div class="conf-check"><span class="msi">${ICON.check}</span></div>
        <div class="conf-title">${title}</div>
        <div class="conf-sub">Tu cancha quedó apartada. Muestra este<br>código al llegar.</div>
        <div class="conf-code">${b.code}</div>
        <div class="conf-card">
          <div><span class="k">Cancha</span><span class="v">${esc(c.nombre)}</span></div>
          <div><span class="k">Fecha</span><span class="v">${fechaLarga(b.dateStr)}</span></div>
          <div><span class="k">Hora</span><span class="v mono">${b.hour}:00 – ${b.hour + b.dur}:00</span></div>
          <div><span class="k">Método</span><span class="v">${metodoLabel}</span></div>
          <div><span class="k">Total</span><span class="v acc">${fmt(b.total)}</span></div>
        </div>
        <a class="conf-wa" href="${waHref(b, c)}" target="_blank" rel="noopener"><span class="msi">${ICON.chat}</span>Confirmar por WhatsApp</a>
        <div class="conf-ghost" id="confReservas">Ver mis reservas</div>
        <div class="conf-back" id="confMapa">VOLVER AL MAPA</div>
      </div>`;
    $("confReservas").onclick = () => setState({ overlay: null, tab: "reservas" });
    $("confMapa").onclick = () => setState({ overlay: null, tab: "mapa" });
  }

  // --------------------------------------------------------------- Onboarding
  function renderOnboarding() {
    const el = $("onboarding");
    const nameOk = S.userName.trim().length > 1;
    if (S.onbStep === 0) {
      el.innerHTML = `
        <div class="onb-cover">
          <div class="photo big" style="--pc:#1f3a2a"><span class="msi">${ICON.stadium}</span></div>
          <div class="grad"></div>
          <div class="onb-brand">
            <div class="wm">KANCHA</div>
            <div class="wordsub"><span class="tick"></span><span>CANCHAS DE ARAUCA</span></div>
          </div>
          <div class="onb-hero">
            <div class="onb-title">Tu cancha,<br>tu hora.</div>
            <div class="onb-desc">Encuentra, reserva y paga las mejores canchas sintéticas y de futsal de Arauca.</div>
            <button class="cta-block" id="onbStart">Empezar</button>
            <div class="onb-skip" id="onbSkip">Ya tengo cuenta — <b>entrar</b></div>
          </div>
        </div>`;
      $("onbStart").onclick = () => setState({ onbStep: 1 });
      $("onbSkip").onclick = () => {
        if (lsGet("kancha_user_v1")) enterApp();
        else setState({ onbStep: 1 });
      };
    } else {
      el.innerHTML = `
        <div class="onb-form">
          <div class="round-btn" id="onbBack"><span class="msi">${ICON.arrow_back}</span></div>
          <div class="serif">Crea tu perfil</div>
          <div class="sub">Solo tu nombre y celular — las canchas te confirman por WhatsApp.</div>
          <div class="fld-label">NOMBRE</div>
          <input id="onbName" placeholder="Ej: Andrés Felipe" value="${esc(S.userName)}" />
          <div class="fld-label tight">CELULAR (WHATSAPP)</div>
          <input id="onbPhone" type="tel" inputmode="numeric" placeholder="300 123 4567" value="${esc(S.userPhone)}" />
          <div class="grow"></div>
          <button class="cta-block${nameOk ? "" : " disabled"}" id="onbFinish">Entrar a Kancha</button>
          <div class="onb-note">PROTOTIPO — TUS DATOS QUEDAN SOLO EN ESTE DISPOSITIVO</div>
        </div>`;
      $("onbBack").onclick = () => setState({ onbStep: 0 });
      const nameInp = $("onbName"), phoneInp = $("onbPhone"), cta = $("onbFinish");
      nameInp.oninput = (e) => {
        S.userName = e.target.value;
        cta.classList.toggle("disabled", S.userName.trim().length <= 1);
      };
      phoneInp.oninput = (e) => { S.userPhone = e.target.value; };
      cta.onclick = () => {
        if (S.userName.trim().length <= 1) return;
        lsSet("kancha_user_v1", { name: S.userName.trim(), phone: S.userPhone.trim() });
        enterApp();
      };
    }
  }
  function enterApp() {
    setState({ screen: "app" });
    setTimeout(() => { initMap(); if (map) { map.invalidateSize(); syncMarkers(); } }, 60);
  }

  // --------------------------------------------------------------- Init
  function init() {
    const user = lsGet("kancha_user_v1");
    S.bookings = lsGet("kancha_bookings_v1") || [];
    S.dateStr = day(0).str;
    S.userName = user ? user.name : "";
    S.userPhone = user ? user.phone : "";
    S.screen = user ? "app" : "onb";
    render();
    if (S.screen === "app") {
      // reintenta montar el mapa hasta que el contenedor tenga tamaño
      let tries = 0;
      const t = setInterval(() => {
        initMap();
        if (map || ++tries > 25) clearInterval(t);
      }, 200);
    }
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
  }
  init();
})();
