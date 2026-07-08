/* =====================================================================
   CanchApp Arauca — lógica principal
   App PWA sin backend: los datos del usuario y las reservas se guardan
   en localStorage (este dispositivo). El mapa usa Leaflet + OpenStreetMap.
   ===================================================================== */
(() => {
  "use strict";

  const ARAUCA_CENTER = [7.0847, -70.7591];
  const CANCHAS = window.CANCHAS || [];
  const STORE_KEY = "canchapp_arauca_v1";
  const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  // ---------------------------------------------------------------- Estado
  let state = {
    user: null,                 // { nombre, telefono }
    bookings: [],               // reservas del usuario
  };
  let userPos = null;           // { lat, lng } si el usuario comparte ubicación
  let currentFilter = "all";
  let currentSearch = "";
  let currentSort = "cercania"; // "cercania" | "precio" | "rating"
  let currentView = "map";
  let map, markers = {};        // marcadores por id de cancha
  let selected = null;          // cancha abierta en el detalle
  let selectedDate = new Date();

  // ---------------------------------------------------------------- Storage
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) state = Object.assign(state, JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---------------------------------------------------------------- Utilidades
  const $ = (sel) => document.querySelector(sel);
  const money = (n) => "$" + n.toLocaleString("es-CO");
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isSameDay = (a, b) => dateKey(a) === dateKey(b);

  function haversine(a, b) {
    const R = 6371, toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  function distanceLabel(c) {
    if (!userPos) return null;
    const km = haversine(userPos, { lat: c.lat, lng: c.lng });
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }

  function isOpenNow(c) {
    const h = new Date().getHours();
    return h >= c.horaApertura && h < c.horaCierre;
  }
  const tipoLabel = (t) => (t === "futsal" ? "Futsal" : "Sintética");
  const tipoIcon = (t) => (t === "futsal" ? "🥅" : "🌿");

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  // ---------------------------------------------------------------- Reservas
  function slotKey(canchaId, date, hora) {
    return `${canchaId}|${dateKey(date)}|${hora}`;
  }
  function isBooked(canchaId, date, hora) {
    const key = slotKey(canchaId, date, hora);
    return state.bookings.some((b) => b.key === key && b.estado !== "cancelada");
  }
  function slotIsPast(date, hora) {
    const now = new Date();
    if (!isSameDay(date, now)) return date < now && !isSameDay(date, now);
    return hora <= now.getHours();
  }
  function availableSlots(c, date) {
    const slots = [];
    for (let h = c.horaApertura; h < c.horaCierre; h++) {
      slots.push({
        hora: h,
        label: `${pad(h)}:00 - ${pad(h + 1)}:00`,
        booked: isBooked(c.id, date, h),
        past: slotIsPast(date, h),
      });
    }
    return slots;
  }
  function freeCountToday(c) {
    return availableSlots(c, new Date()).filter((s) => !s.booked && !s.past).length;
  }

  // ---------------------------------------------------------------- Filtrado
  function filteredCanchas() {
    let list = CANCHAS.slice();
    if (currentFilter === "futsal") list = list.filter((c) => c.tipo === "futsal");
    else if (currentFilter === "sintetica") list = list.filter((c) => c.tipo === "sintetica");
    else if (currentFilter === "techada") list = list.filter((c) => c.techada);
    else if (currentFilter === "abierta") list = list.filter(isOpenNow);

    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      list = list.filter(
        (c) => c.nombre.toLowerCase().includes(q) || c.barrio.toLowerCase().includes(q)
      );
    }
    if (currentSort === "precio") list.sort((a, b) => a.precioHora - b.precioHora);
    else if (currentSort === "rating") list.sort((a, b) => b.rating - a.rating);
    else if (currentSort === "cercania" && userPos) {
      list.sort((a, b) =>
        haversine(userPos, a) - haversine(userPos, b));
    }
    return list;
  }

  // ---------------------------------------------------------------- Mapa
  function initMap() {
    if (typeof L === "undefined") {
      $("#map").innerHTML =
        `<div class="empty">🗺️ No se pudo cargar el mapa.<br>Revisa tu conexión y usa la pestaña <b>Lista</b>.</div>`;
      return;
    }
    // Los iconos por defecto de Leaflet apuntan a rutas relativas; los fijamos.
    L.Icon.Default.prototype.options.imagePath = "vendor/leaflet/images/";
    map = L.map("map", { zoomControl: true, attributionControl: true })
      .setView(ARAUCA_CENTER, 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    CANCHAS.forEach((c) => {
      const libres = freeCountToday(c);
      const icon = L.divIcon({
        className: "court-pin-wrap",
        html: `<div class="court-pin" style="--pin:${c.color}">
                 <span>${tipoIcon(c.tipo)}</span>
               </div>
               <div class="court-pin-dot ${libres ? "free" : "busy"}"></div>`,
        iconSize: [40, 48],
        iconAnchor: [20, 46],
      });
      const m = L.marker([c.lat, c.lng], { icon }).addTo(map);
      m.on("click", () => { showMapCard(c); });
      markers[c.id] = m;
    });
    map.on("click", () => $("#mapCard").classList.add("hidden"));
  }

  function refreshMarkers() {
    if (!map) return;
    const visible = new Set(filteredCanchas().map((c) => c.id));
    CANCHAS.forEach((c) => {
      const m = markers[c.id];
      if (!m) return;
      if (visible.has(c.id)) { if (!map.hasLayer(m)) m.addTo(map); }
      else { if (map.hasLayer(m)) map.removeLayer(m); }
    });
    $("#mapCount").textContent = `${visible.size} cancha${visible.size !== 1 ? "s" : ""} en Arauca`;
  }

  function showMapCard(c) {
    const dist = distanceLabel(c);
    const libres = freeCountToday(c);
    const el = $("#mapCard");
    el.innerHTML = `
      <div class="map-card-body" data-id="${c.id}">
        <div class="map-card-thumb" style="--c:${c.color}">${tipoIcon(c.tipo)}</div>
        <div class="map-card-info">
          <strong>${c.nombre}</strong>
          <div class="map-card-meta">${tipoLabel(c.tipo)} · ${c.barrio}${dist ? " · " + dist : ""}</div>
          <div class="map-card-tags">
            <span class="tag">${money(c.precioHora)}/h</span>
            <span class="tag ${libres ? "ok" : "no"}">${libres ? libres + " libres hoy" : "Sin cupos hoy"}</span>
            <span class="tag">⭐ ${c.rating}</span>
          </div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm map-card-btn">Ver y reservar</button>`;
    el.classList.remove("hidden");
    el.querySelector(".map-card-btn").onclick = () => openDetail(c);
    el.querySelector(".map-card-body").onclick = () => openDetail(c);
    map.panTo([c.lat, c.lng]);
  }

  // ---------------------------------------------------------------- Lista
  function renderList() {
    const list = filteredCanchas();
    $("#listCount").textContent = `${list.length} cancha${list.length !== 1 ? "s" : ""}`;
    const sortNames = { cercania: "Cercanía", precio: "Precio", rating: "Calificación" };
    $("#sortBtn").textContent = `Ordenar: ${sortNames[currentSort]} ▾`;

    const wrap = $("#cardList");
    if (!list.length) {
      wrap.innerHTML = `<div class="empty">😕 No hay canchas con ese filtro.</div>`;
      return;
    }
    wrap.innerHTML = list.map((c) => {
      const dist = distanceLabel(c);
      const libres = freeCountToday(c);
      const abierta = isOpenNow(c);
      return `
      <article class="card" data-id="${c.id}">
        <div class="card-thumb" style="--c:${c.color}">
          <span class="card-emoji">${tipoIcon(c.tipo)}</span>
          <span class="card-status ${abierta ? "open" : "closed"}">${abierta ? "Abierta" : "Cerrada"}</span>
        </div>
        <div class="card-body">
          <div class="card-top">
            <h3>${c.nombre}</h3>
            <span class="card-rating">⭐ ${c.rating}</span>
          </div>
          <div class="card-sub">${tipoLabel(c.tipo)} · ${c.jugadores} · ${c.barrio}</div>
          <div class="card-sub small">📍 ${c.direccion}${dist ? " · " + dist : ""}</div>
          <div class="card-foot">
            <span class="price">${money(c.precioHora)}<small>/hora</small></span>
            <span class="chip-mini ${libres ? "ok" : "no"}">${libres ? "🟢 " + libres + " libres hoy" : "🔴 Lleno hoy"}</span>
          </div>
        </div>
      </article>`;
    }).join("");

    wrap.querySelectorAll(".card").forEach((el) => {
      el.onclick = () => openDetail(CANCHAS.find((c) => c.id === el.dataset.id));
    });
  }

  // ---------------------------------------------------------------- Detalle
  function next7Days() {
    const out = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      out.push(d);
    }
    return out;
  }

  function openDetail(c) {
    if (!c) return;
    selected = c;
    selectedDate = new Date();
    $("#mapCard").classList.add("hidden");
    renderDetail();
    const sheet = $("#detailSheet");
    sheet.classList.remove("hidden");
    requestAnimationFrame(() => sheet.classList.add("show"));
  }
  function closeDetail() {
    const sheet = $("#detailSheet");
    sheet.classList.remove("show");
    setTimeout(() => sheet.classList.add("hidden"), 220);
  }

  function renderDetail() {
    const c = selected;
    const dist = distanceLabel(c);
    const servicios = c.servicios.map((s) => `<span class="serv">${s}</span>`).join("");
    const days = next7Days().map((d) => {
      const isSel = isSameDay(d, selectedDate);
      const hoy = isSameDay(d, new Date());
      return `<button class="day ${isSel ? "sel" : ""}" data-date="${dateKey(d)}">
                <small>${hoy ? "Hoy" : DIAS[d.getDay()]}</small>
                <strong>${d.getDate()}</strong>
                <em>${MESES[d.getMonth()]}</em>
              </button>`;
    }).join("");

    const slots = availableSlots(c, selectedDate).map((s) => {
      const cls = s.booked ? "taken" : s.past ? "past" : "free";
      const dis = s.booked || s.past ? "disabled" : "";
      return `<button class="slot ${cls}" data-hora="${s.hora}" ${dis}>${s.label}</button>`;
    }).join("");

    $("#detailContent").innerHTML = `
      <div class="detail-hero" style="--c:${c.color}">
        <span class="detail-emoji">${tipoIcon(c.tipo)}</span>
        <span class="detail-status ${isOpenNow(c) ? "open" : "closed"}">
          ${isOpenNow(c) ? "🟢 Abierta ahora" : "🔴 Cerrada"}
        </span>
      </div>
      <div class="detail-main">
        <div class="detail-title">
          <h2>${c.nombre}</h2>
          <span class="card-rating big">⭐ ${c.rating} <small>(${c.resenas})</small></span>
        </div>
        <p class="detail-sub">${tipoLabel(c.tipo)} · ${c.jugadores} · ${c.barrio}</p>
        <p class="detail-addr">📍 ${c.direccion}${dist ? " · a " + dist : ""}</p>

        <div class="detail-badges">
          <span class="badge">${c.iluminada ? "💡 Iluminada" : "🌙 Sin luces"}</span>
          <span class="badge">${c.techada ? "🏟️ Techada" : "☀️ Al aire libre"}</span>
          <span class="badge">🕒 ${pad(c.horaApertura)}:00–${pad(c.horaCierre)}:00</span>
        </div>

        <div class="detail-price-row">
          <div><span class="price big">${money(c.precioHora)}</span><small>/hora</small></div>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
             href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}">🧭 Cómo llegar</a>
        </div>

        <h3 class="detail-h">Servicios</h3>
        <div class="serv-list">${servicios}</div>

        <h3 class="detail-h">Elige el día</h3>
        <div class="days" id="daysRow">${days}</div>

        <h3 class="detail-h">Horarios disponibles</h3>
        <div class="legend">
          <span><i class="dot free"></i> Libre</span>
          <span><i class="dot taken"></i> Reservado</span>
          <span><i class="dot past"></i> No disponible</span>
        </div>
        <div class="slots" id="slotsGrid">${slots}</div>
      </div>`;

    $("#daysRow").querySelectorAll(".day").forEach((el) => {
      el.onclick = () => {
        const [y, m, d] = el.dataset.date.split("-").map(Number);
        selectedDate = new Date(y, m - 1, d);
        renderDetail();
      };
    });
    $("#slotsGrid").querySelectorAll(".slot.free").forEach((el) => {
      el.onclick = () => openBooking(c, selectedDate, Number(el.dataset.hora));
    });
  }

  // ---------------------------------------------------------------- Reserva + pago
  let pending = null; // { c, date, hora, metodo }

  function openBooking(c, date, hora) {
    pending = { c, date, hora, metodo: "efectivo" };
    $("#bookModalTitle").textContent = "Confirmar reserva";
    renderBookingStep1();
    const m = $("#bookModal");
    m.classList.remove("hidden");
    requestAnimationFrame(() => m.classList.add("show"));
  }
  function closeBooking() {
    const m = $("#bookModal");
    m.classList.remove("show");
    setTimeout(() => m.classList.add("hidden"), 200);
  }

  function fechaBonita(d) {
    return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
  }

  function renderBookingStep1() {
    const { c, date, hora } = pending;
    const metodos = [
      { id: "efectivo", icon: "💵", label: "Efectivo en la cancha", desc: "Pagas al llegar" },
      { id: "nequi", icon: "📲", label: "Nequi / Daviplata", desc: "Transferencia al dueño" },
      { id: "online", icon: "💳", label: "Tarjeta / PSE (en línea)", desc: "Pago inmediato" },
    ];
    $("#bookModalBody").innerHTML = `
      <div class="resumen">
        <div class="resumen-row"><span>Cancha</span><strong>${c.nombre}</strong></div>
        <div class="resumen-row"><span>Fecha</span><strong>${fechaBonita(date)}</strong></div>
        <div class="resumen-row"><span>Hora</span><strong>${pad(hora)}:00 - ${pad(hora + 1)}:00</strong></div>
        <div class="resumen-row total"><span>Total (1 hora)</span><strong>${money(c.precioHora)}</strong></div>
      </div>
      <h3 class="detail-h">¿Cómo quieres pagar?</h3>
      <div class="pay-methods" id="payMethods">
        ${metodos.map((m) => `
          <button class="pay-opt ${m.id === pending.metodo ? "sel" : ""}" data-metodo="${m.id}">
            <span class="pay-icon">${m.icon}</span>
            <span class="pay-text"><strong>${m.label}</strong><small>${m.desc}</small></span>
            <span class="pay-check">✓</span>
          </button>`).join("")}
      </div>
      <button class="btn btn-primary btn-lg" id="confirmBookBtn">Confirmar reserva · ${money(c.precioHora)}</button>
      <p class="pay-note">Demo: no se cobra dinero real. La reserva queda registrada en este dispositivo y se confirma por WhatsApp con la cancha.</p>`;

    $("#payMethods").querySelectorAll(".pay-opt").forEach((el) => {
      el.onclick = () => {
        pending.metodo = el.dataset.metodo;
        $("#payMethods").querySelectorAll(".pay-opt").forEach((x) => x.classList.remove("sel"));
        el.classList.add("sel");
      };
    });
    $("#confirmBookBtn").onclick = confirmBooking;
  }

  function confirmBooking() {
    const { c, date, hora, metodo } = pending;
    if (isBooked(c.id, date, hora)) {
      toast("Ese horario acaba de ser reservado 😕");
      closeBooking(); renderDetail();
      return;
    }
    const metodoLabel = { efectivo: "Efectivo en la cancha", nequi: "Nequi / Daviplata", online: "Tarjeta / PSE" }[metodo];
    const booking = {
      id: "b" + Date.now(),
      key: slotKey(c.id, date, hora),
      canchaId: c.id,
      canchaNombre: c.nombre,
      barrio: c.barrio,
      telefono: c.telefono,
      fecha: dateKey(date),
      fechaLabel: fechaBonita(date),
      hora,
      precio: c.precioHora,
      metodo, metodoLabel,
      estado: metodo === "online" ? "pagada" : "confirmada",
      createdAt: Date.now(),
    };
    state.bookings.push(booking);
    save();

    // Paso final: éxito + WhatsApp
    $("#bookModalTitle").textContent = "¡Reserva lista! 🎉";
    const waText = encodeURIComponent(
      `Hola ${c.nombre} 👋, soy ${state.user?.nombre || ""}. ` +
      `Reservé por CanchApp para el ${fechaBonita(date)} de ${pad(hora)}:00 a ${pad(hora + 1)}:00. ` +
      `Pago: ${metodoLabel}. ¿Me confirmas por favor?`
    );
    const waLink = `https://wa.me/${c.telefono}?text=${waText}`;
    $("#bookModalBody").innerHTML = `
      <div class="success">
        <div class="success-emoji">✅</div>
        <p>Tu cancha quedó reservada:</p>
        <div class="resumen">
          <div class="resumen-row"><span>Cancha</span><strong>${c.nombre}</strong></div>
          <div class="resumen-row"><span>Fecha</span><strong>${fechaBonita(date)}</strong></div>
          <div class="resumen-row"><span>Hora</span><strong>${pad(hora)}:00 - ${pad(hora + 1)}:00</strong></div>
          <div class="resumen-row"><span>Pago</span><strong>${metodoLabel}</strong></div>
        </div>
        <a class="btn btn-wa btn-lg" href="${waLink}" target="_blank" rel="noopener">💬 Confirmar por WhatsApp</a>
        <button class="btn btn-ghost" id="doneBookBtn">Ver mis reservas</button>
      </div>`;
    $("#doneBookBtn").onclick = () => { closeBooking(); closeDetail(); switchView("bookings"); };
    toast("Reserva registrada ⚽");
  }

  // ---------------------------------------------------------------- Mis reservas
  function renderBookings() {
    const wrap = $("#bookingList");
    const list = state.bookings.slice().sort((a, b) => {
      return (a.fecha + pad(a.hora)).localeCompare(b.fecha + pad(b.hora));
    });
    const now = new Date();
    const upcoming = list.filter((b) => {
      const d = new Date(b.fecha + "T00:00:00");
      d.setHours(b.hora);
      return d >= now && b.estado !== "cancelada";
    });
    const past = list.filter((b) => !upcoming.includes(b));

    if (!list.length) {
      wrap.innerHTML = `<div class="empty">📭 Aún no tienes reservas.<br>Explora el mapa y aparta tu cancha.</div>`;
      return;
    }
    const card = (b) => {
      const c = CANCHAS.find((x) => x.id === b.canchaId) || {};
      const cancelada = b.estado === "cancelada";
      const esFutura = upcoming.includes(b);
      return `
      <article class="booking ${cancelada ? "cancelled" : ""}">
        <div class="booking-side" style="--c:${c.color || "#666"}">${tipoIcon(c.tipo || "")}</div>
        <div class="booking-info">
          <strong>${b.canchaNombre}</strong>
          <div class="booking-meta">📅 ${b.fechaLabel} · 🕒 ${pad(b.hora)}:00-${pad(b.hora + 1)}:00</div>
          <div class="booking-meta small">${b.barrio} · ${money(b.precio)} · ${b.metodoLabel}</div>
          <span class="estado ${b.estado}">${estadoLabel(b.estado)}</span>
        </div>
        <div class="booking-actions">
          ${esFutura && !cancelada ? `
            <a class="mini-btn" href="https://wa.me/${b.telefono}" target="_blank" rel="noopener" title="WhatsApp">💬</a>
            <button class="mini-btn danger" data-cancel="${b.id}" title="Cancelar">🗑️</button>` : ""}
        </div>
      </article>`;
    };
    wrap.innerHTML = `
      ${upcoming.length ? `<h3 class="section-h">Próximas</h3>${upcoming.map(card).join("")}` : ""}
      ${past.length ? `<h3 class="section-h">Anteriores</h3>${past.map(card).join("")}` : ""}`;

    wrap.querySelectorAll("[data-cancel]").forEach((el) => {
      el.onclick = () => cancelBooking(el.dataset.cancel);
    });
  }
  function estadoLabel(e) {
    return { confirmada: "✅ Confirmada", pagada: "💳 Pagada", cancelada: "❌ Cancelada" }[e] || e;
  }
  function cancelBooking(id) {
    const b = state.bookings.find((x) => x.id === id);
    if (!b) return;
    if (!confirm(`¿Cancelar la reserva de ${b.canchaNombre} el ${b.fechaLabel}?`)) return;
    b.estado = "cancelada";
    save();
    renderBookings();
    toast("Reserva cancelada");
  }

  // ---------------------------------------------------------------- Vistas
  function switchView(view) {
    currentView = view;
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.view === view));
    $("#mapView").classList.toggle("hidden", view !== "map");
    $("#listView").classList.toggle("hidden", view !== "list");
    $("#bookingsView").classList.toggle("hidden", view !== "bookings");
    const showSearch = view === "map" || view === "list";
    $(".searchbar").classList.toggle("hidden", !showSearch);
    $("#filters").classList.toggle("hidden", !showSearch);

    if (view === "map") setTimeout(() => { if (map) { map.invalidateSize(); refreshMarkers(); } }, 60);
    if (view === "list") renderList();
    if (view === "bookings") renderBookings();
  }

  function applyFilters() {
    refreshMarkers();
    if (currentView === "list") renderList();
  }

  // ---------------------------------------------------------------- Geolocalización
  function locate() {
    if (!navigator.geolocation) { toast("Tu dispositivo no comparte ubicación"); return; }
    toast("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (map) {
          if (locate._m) map.removeLayer(locate._m);
          locate._m = L.circleMarker([userPos.lat, userPos.lng], {
            radius: 8, color: "#1e6091", fillColor: "#4dabf7", fillOpacity: 0.9, weight: 3,
          }).addTo(map).bindPopup("Estás aquí");
          map.setView([userPos.lat, userPos.lng], 15);
        }
        applyFilters();
        if (currentView === "list") renderList();
        toast("Ubicación lista 📍 ordenando por cercanía");
      },
      () => toast("No pudimos obtener tu ubicación"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // ---------------------------------------------------------------- Onboarding / Ajustes
  function showApp() {
    $("#onboarding").classList.add("hidden");
    $("#app").classList.remove("hidden");
    if (!map) initMap();
    setTimeout(() => { if (map) { map.invalidateSize(); refreshMarkers(); } }, 100);
  }

  function bindOnboarding() {
    $("#startBtn").onclick = () => {
      const nombre = $("#playerNameInput").value.trim();
      const telefono = $("#playerPhoneInput").value.trim();
      if (!nombre) { toast("Escribe tu nombre para continuar"); return; }
      state.user = { nombre, telefono };
      save();
      showApp();
    };
  }

  function openSettings() {
    $("#settingsNameInput").value = state.user?.nombre || "";
    $("#settingsPhoneInput").value = state.user?.telefono || "";
    const m = $("#settingsModal");
    m.classList.remove("hidden");
    requestAnimationFrame(() => m.classList.add("show"));
  }
  function bindSettings() {
    $("#settingsBtn").onclick = openSettings;
    $("#closeSettingsModal").onclick = () => closeModal("#settingsModal");
    $("#saveSettingsBtn").onclick = () => {
      state.user = {
        nombre: $("#settingsNameInput").value.trim() || state.user?.nombre,
        telefono: $("#settingsPhoneInput").value.trim(),
      };
      save();
      closeModal("#settingsModal");
      toast("Datos guardados");
    };
    $("#resetBtn").onclick = () => {
      if (!confirm("¿Borrar tus datos y todas tus reservas de este dispositivo?")) return;
      localStorage.removeItem(STORE_KEY);
      location.reload();
    };
  }
  function closeModal(sel) {
    const m = $(sel);
    m.classList.remove("show");
    setTimeout(() => m.classList.add("hidden"), 200);
  }

  // ---------------------------------------------------------------- Eventos
  function bindEvents() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.onclick = () => switchView(t.dataset.view);
    });
    document.querySelectorAll("#filters .chip").forEach((ch) => {
      ch.onclick = () => {
        document.querySelectorAll("#filters .chip").forEach((x) => x.classList.remove("active"));
        ch.classList.add("active");
        currentFilter = ch.dataset.filter;
        applyFilters();
      };
    });
    $("#searchInput").oninput = (e) => { currentSearch = e.target.value.trim(); applyFilters(); };
    $("#sortBtn").onclick = () => {
      currentSort = currentSort === "cercania" ? "precio" : currentSort === "precio" ? "rating" : "cercania";
      if (currentSort === "cercania" && !userPos) toast("Toca 📍 para ordenar por cercanía");
      renderList();
    };
    $("#locateBtn").onclick = locate;
    $("#closeDetail").onclick = closeDetail;
    $("#detailSheet").onclick = (e) => { if (e.target.id === "detailSheet") closeDetail(); };
    $("#closeBookModal").onclick = closeBooking;
    $("#bookModal").onclick = (e) => { if (e.target.id === "bookModal") closeBooking(); };
    $("#settingsModal").onclick = (e) => { if (e.target.id === "settingsModal") closeModal("#settingsModal"); };
  }

  // ---------------------------------------------------------------- Init
  function init() {
    load();
    bindOnboarding();
    bindSettings();
    bindEvents();
    if (state.user) showApp();
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () =>
        navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
  }
  init();
})();
