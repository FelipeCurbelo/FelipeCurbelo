# 🌱 Rutina Quest

**Un juego de motivación para quienes aman procrastinar.** Registra tus tareas
diarias, complétalas para ganar recompensas y conviértelas en hábitos mientras
haces crecer a tu compañero.

Pensado para **teléfono y tablet**: es una app web (PWA) instalable, funciona
**sin conexión** y guarda todo el progreso en el propio dispositivo. No necesita
cuenta, servidor ni instalación de tiendas de apps.

<p align="center">
  <img src="icons/icon-512.png" width="140" alt="Rutina Quest" />
</p>

## 🎮 Cómo se juega

1. Elige tu nombre y un **compañero** (planta, pollito, gato o dragón).
2. Registra tus tareas en tres categorías:
   - 🧍 **Personales** — levantarme temprano, cepillarme los dientes, beber agua…
   - 🏠 **Hogar** — tender la cama, lavar los platos, lavar la ropa, hacer la comida…
   - 💼 **Trabajo** — terminar el reporte, hacer la presentación, responder correos…
3. Cada vez que completas una tarea recibes una **recompensa** (🪙 monedas + XP),
   confeti y un mensaje de ánimo.
4. Repite la tarea día tras día para subir tu **racha** 🔥. Al llegar a la meta
   (21 días por defecto), la tarea se convierte en un **hábito** 🌟.

## ✨ Mecánicas de motivación

- **Recompensa inmediata:** monedas, experiencia y celebración en cada tarea, para
  vencer la procrastinación con gratificación instantánea.
- **Rachas y hábitos:** barra de progreso por tarea que muestra cuánto falta para
  formar el hábito. Bonus de monedas creciente por mantener la racha.
- **Tu compañero crece contigo:** la mascota-planta evoluciona (🌱→🌿→🪴→🌳→🌸)
  a medida que subes de nivel.
- **Progreso del día:** anillo circular con el porcentaje de tareas completadas y
  mensajes que cambian según tu avance.
- **Logros** 🏆 desbloqueables (primer hábito, semana perfecta, nivel 10…).
- **Tienda** 🛍️ para gastar monedas en temas de color (Océano, Bosque, Atardecer,
  Medianoche).
- **Estadísticas** 📊 de tareas completadas, mejor racha, hábitos formados y más.
- Recordatorio háptico opcional (vibración) al completar una tarea.

## 🚀 Cómo abrirlo


```bash
cd rutina-quest
python3 -m http.server 8099
# abre http://localhost:8099 en el navegador del teléfono/PC
```

**En el teléfono/tablet:** abre la URL y usa *"Añadir a pantalla de inicio"* para
instalarlo como app a pantalla completa.


## 🧩 Estructura

```
rutina-quest/
├── index.html            Estructura de la interfaz
├── styles.css            Diseño móvil, temas y animaciones
├── app.js                Lógica del juego (tareas, rachas, recompensas, tienda…)
├── manifest.webmanifest  Configuración PWA (instalable)
├── sw.js                 Service worker (funciona sin conexión)
└── icons/                Iconos de la app (+ script que los genera)
```

El progreso se guarda en `localStorage`, así que es privado y vive solo en tu dispositivo.
