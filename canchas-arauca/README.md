# CanchApp Arauca ⚽

Un "Google Maps de canchas deportivas" para **Arauca, Arauca (Colombia)**.
Encuentra todas las canchas de **futsal** y **sintética** de la ciudad en un
mapa, consulta qué horarios están libres, reserva tu hora y paga — todo desde
el celular.

Es una **PWA** (aplicación web instalable) hecha con HTML, CSS y JavaScript
puro. No necesita servidor: funciona en GitHub Pages y puede instalarse en el
teléfono como una app.

## ✨ Qué hace

- 🗺️ **Mapa interactivo** con todas las canchas (Leaflet + OpenStreetMap, sin API key).
- 🔎 **Búsqueda y filtros**: por tipo (futsal/sintética), techadas o abiertas ahora, y por barrio.
- 🕒 **Disponibilidad por horario**: elige el día (próximos 7 días) y mira qué franjas de 1 hora están libres, reservadas o ya pasaron.
- ✅ **Reservas** en segundos, guardadas en tu dispositivo.
- 💳 **Pago**: efectivo en la cancha, Nequi/Daviplata o tarjeta/PSE (flujo listo, ver nota abajo).
- 💬 **Confirmación por WhatsApp** con el dueño de la cancha, con el mensaje ya redactado.
- 📋 **Mis reservas**: próximas y anteriores, con opción de cancelar.
- 📍 **Ubicación**: ordena las canchas por cercanía si compartes tu GPS.
- 📱 **Instalable y offline**: service worker + manifest.

## 🚀 Cómo probarla

Como es 100% estática, ábrela con cualquier servidor local:

```bash
cd canchas-arauca
python3 -m http.server 8000
# abre http://localhost:8000
```

O publícala en **GitHub Pages** (Settings → Pages → carpeta `/canchas-arauca`).

## 🗂️ Estructura

```
canchas-arauca/
├── index.html          Interfaz (onboarding, mapa, lista, reservas)
├── styles.css          Estilos (tema oscuro deportivo, mobile-first)
├── app.js              Lógica: mapa, filtros, disponibilidad, reservas, pago
├── data.js             Catálogo de canchas (EDITA ESTO con tus canchas reales)
├── manifest.webmanifest
├── sw.js               Service worker (offline)
├── vendor/leaflet/     Leaflet vendorizado (sin depender de un CDN)
└── icons/              Iconos de la app (+ generador gen_icons.py)
```

## ✏️ Poner tus canchas reales

Edita `data.js`. Cada cancha tiene:

```js
{
  id: "c1",
  nombre: "Cancha Meridiano 70",
  tipo: "sintetica",           // "futsal" | "sintetica"
  barrio: "Meridiano 70",
  direccion: "Cra. 22 con Calle 18",
  lat: 7.0912, lng: -70.7568,  // coordenadas reales (Google Maps → clic derecho)
  telefono: "573001112233",    // WhatsApp: 57 + celular
  precioHora: 90000,
  jugadores: "8 vs 8",
  horaApertura: 8, horaCierre: 23,
  iluminada: true, techada: false,
  rating: 4.7, resenas: 128,
  servicios: ["Parqueadero", "Baños", "Tienda", "Graderías"],
  color: "#0b6e4f",
}
```

> Los datos actuales son **de ejemplo** (coordenadas aproximadas dentro de
> Arauca). Reemplázalos por las canchas reales y sus números de contacto.

## 💰 Sobre los pagos

GitHub Pages no tiene backend, así que la app **no cobra dinero real**: registra
la reserva en el dispositivo y la confirma por WhatsApp con la cancha. El flujo
de pago (efectivo / Nequi / PSE) ya está construido en la interfaz.

Para cobrar de verdad necesitas un pequeño backend y una pasarela colombiana.
Rutas recomendadas:

- **Wompi** (Bancolombia) o **Mercado Pago**: soportan PSE, Nequi y tarjetas.
- **ePayco** o **PayU**: alternativas con PSE.

El siguiente paso sería:
1. Un backend (Node/Firebase/Supabase) que guarde canchas, horarios y reservas de forma compartida entre todos los usuarios (hoy cada reserva vive solo en el teléfono de quien reserva).
2. Crear la transacción con la pasarela y confirmar la reserva con el *webhook* de pago.
3. Panel para que cada dueño de cancha administre sus horarios.

## 🛠️ Tecnología

- HTML + CSS + JavaScript (vanilla), sin frameworks.
- [Leaflet](https://leafletjs.com/) 1.9.4 (vendorizado) sobre tiles de OpenStreetMap.
- `localStorage` para datos del usuario y reservas.
- PWA: `manifest.webmanifest` + service worker.

---

Hecho para la comunidad futbolera de Arauca. ⚽🇨🇴
