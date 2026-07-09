# Kancha ⚽ · Canchas de Arauca

App para encontrar, reservar y pagar canchas de **futsal** y **sintética** en
**Arauca, Arauca (Colombia)**. Un mapa con todas las canchas de la ciudad,
disponibilidad por horario, reserva en segundos y pago simulado con
confirmación por WhatsApp.

Es una **PWA** (aplicación web instalable) en HTML, CSS y JavaScript puro, sin
backend ni dependencias de CDN: funciona en GitHub Pages y se instala en el
teléfono como una app.

Esta versión implementa el prototipo de diseño **“Kancha”** (marca oscura con
acento lima, tipografías Space Grotesk / Space Mono / Instrument Serif e iconos
Material Symbols), portado de React a JavaScript puro.

## ✨ Pantallas y funciones

- **Onboarding** en dos pasos (portada + perfil: nombre y WhatsApp).
- **Mapa** a pantalla completa (Leaflet + tiles oscuros de CARTO) con
  marcadores de precio y un carrusel inferior de tarjetas sincronizado con el mapa.
- **Búsqueda** por cancha/barrio y **filtros** (todas, sintética, futsal, techadas).
- **Lista** “Cerca de ti” con turnos rápidos del día.
- **Detalle** de cancha: fotos, calificación, servicios, selector de día (7 días),
  duración (1 o 2 horas) y grilla de horarios (libre / ocupado).
- **Pago** simulado con métodos (Nequi, Daviplata, efectivo) y resumen.
- **Confirmación** con código de reserva (`KAN-XXXX`) y botón de WhatsApp.
- **Mis reservas**: próximas e historial, con cancelación.
- **PWA**: instalable y offline (manifest + service worker).

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
├── index.html          Estructura y montaje de la app
├── styles.css          Sistema de diseño (tema oscuro, acento lima)
├── app.js              Lógica: mapa, filtros, disponibilidad, reserva, pago
├── data.js             Catálogo de canchas (EDITA ESTO con tus canchas reales)
├── manifest.webmanifest
├── sw.js               Service worker (offline)
├── vendor/
│   ├── leaflet/        Leaflet vendorizado (sin CDN)
│   └── fonts/          Space Grotesk / Mono, Instrument Serif y Material
│                       Symbols (subconjunto de ~25 KB), vendorizados
└── icons/              Iconos de la app (+ generador gen_icons.py)
```

Todo se sirve desde el mismo origen: **no hay llamadas a CDN** (fuentes, iconos
y mapa base van vendorizados; solo los *tiles* del mapa se piden a CARTO).

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

## ⏱️ Disponibilidad y reservas

- La disponibilidad se genera de forma determinista (algunas franjas aparecen
  “ocupadas”) más las reservas que haces tú, que se guardan en el dispositivo
  (`localStorage`: `kancha_user_v1`, `kancha_bookings_v1`).
- Las franjas ya pasadas del día de hoy se deshabilitan automáticamente.

## 💰 Sobre los pagos

GitHub Pages no tiene backend, así que la app **no cobra dinero real**: el pago
es un flujo simulado y la reserva se confirma por WhatsApp con la cancha. Para
cobrar de verdad hace falta un backend y una pasarela colombiana (Wompi,
Mercado Pago, ePayco/PayU) que soporte PSE, Nequi y tarjetas. El siguiente paso
sería, además, un backend que comparta canchas y reservas entre todos los
usuarios (hoy cada reserva vive solo en el teléfono de quien reserva).

## 🛠️ Regenerar recursos

- **Iconos de la app**: `python3 icons/gen_icons.py`.
- **Fuentes**: se vendorizaron desde npm (`material-symbols`,
  `@fontsource-variable/space-grotesk`, `@fontsource/space-mono`,
  `@fontsource/instrument-serif`); Material Symbols se subconjuntó con
  `pyftsubset` a los ~25 iconos usados.

---

Hecho para la comunidad futbolera de Arauca. ⚽🇨🇴
