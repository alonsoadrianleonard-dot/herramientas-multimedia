# Pasillo UPIICSA en realidad virtual

Recorrido de un pasillo techado de UPIICSA que se abre en el navegador de la computadora, del celular o de un visor de realidad virtual (Meta Quest u otro compatible con WebXR). Está hecho con [Three.js](https://threejs.org/) 0.160.

El pasillo mide 10.5 m de largo, 5 m de ancho y 3 m de alto. Tiene una losa de concreto sobre una fila de pilares y lleva a las dos puertas de vidrio de un edificio largo de concreto. Alrededor hay pasto, jardineras, árboles (algunos son jacarandas), postes y las fachadas de otros edificios. Es de día y no tiene sonido. En la plaza hay un letrero que dice UPIICSA: al apuntarle aparece la información de la escuela.

Las texturas se hicieron por código tomando como referencia las fotos de UPIICSA en Google Maps. Las fotos no se copiaron porque tienen derechos de sus autores.

## Carpetas

```
pasillo-vr/
├── index.html            la página
├── src/
│   ├── main.js           arranque, pantalla de inicio y ciclo de dibujo
│   ├── escena.js         geometría: piso, pasillo, edificios, árboles y letrero
│   ├── controles.js      computadora (WASD + mouse) y celular (joystick + giroscopio)
│   ├── vr.js             visor: teletransporte y giro por pasos
│   ├── colisiones.js     choques con pilares, edificios y límites
│   ├── plano.js          medidas del pasillo (lo genera tools/generar_assets.py)
│   └── estilos.css
├── assets/               texturas JPG/PNG de 1024 px como máximo y pasillo_upiicsa.glb
├── tools/
│   ├── generar_assets.py plano, texturas y luz horneada del piso
│   └── verificar.py      pruebas con Playwright y exportación del GLB
└── capturas/             capturas y reporte de la última prueba
```

## Controles

| Dispositivo | Caminar | Mirar | Otros |
|---|---|---|---|
| Computadora | W A S D o flechas (Shift para correr) | Mouse. Si el navegador no deja capturarlo (por ejemplo dentro de un iframe), mantén el clic y arrastra | Esc o el botón ? para pausar |
| Celular | Joystick de la esquina inferior izquierda | Mover el teléfono o deslizar el dedo | Botón ? para ver la ayuda |
| Visor VR | Mantén el gatillo, apunta al piso y suelta para teletransportarte | Mover la cabeza | Palanca a la izquierda o derecha: giro de 30° |

Para ver la información del letrero, apúntale con el círculo del centro de la pantalla o con el rayo del control.

## Cómo correrlo en tu computadora

La página usa módulos de JavaScript y carga texturas, así que necesita un servidor. Si la abres con doble clic, no funciona. Dentro de la carpeta `pasillo-vr` ejecuta:

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000`. Three.js se descarga de jsDelivr, así que la primera vez necesitas internet.

## Probarlo en el visor o en el celular

WebXR y el giroscopio del celular solo funcionan en páginas con **HTTPS** (o en `localhost`). Hay dos formas:

1. **Publicarlo** (lo más sencillo): abre la dirección `https://…` en el navegador del Meta Quest y presiona **Entrar en VR**.
2. **Sin publicarlo:** con el servidor local encendido, crea un túnel HTTPS con `npx localtunnel --port 8000` o `cloudflared tunnel --url http://localhost:8000` y abre en el visor la dirección que te da.

## Publicarlo gratis con HTTPS

**GitHub Pages**

1. Crea un repositorio en GitHub y sube el contenido de esta carpeta (`index.html` tiene que quedar en la raíz).
2. En el repositorio entra a **Settings → Pages**, en **Source** elige **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`.
3. En uno o dos minutos queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`.

**Netlify**

1. Entra a [app.netlify.com/drop](https://app.netlify.com/drop).
2. Arrastra la carpeta `pasillo-vr` a la página.
3. Netlify te da una dirección `https://….netlify.app`.

Este proyecto también está dentro de mi página, en la sección ENTORNO VIRTUAL.

## Cómo está hecho

- **Escala real:** todo está en metros. El pasillo y los edificios son cajas y planos de Three.js con las texturas acomodadas en metros, para que no se estiren.
- **Luz:** las sombras del piso están horneadas en `assets/luz_piso.png` (se calculan una vez en Python a partir de la posición del sol). El piso usa `MeshBasicMaterial` con esa imagen como *lightMap*, así que no calcula luz. Los demás objetos usan una luz direccional sin sombras y una luz de cielo, y no hay sombras en tiempo real. Por eso corre bien en el Quest y en celulares.
- **Colisiones:** el jugador es un círculo de 30 cm y los obstáculos son cajas en planta. Si chocas, te deslizas a lo largo de la pared. El teletransporte solo acepta puntos libres.
- **Tamaño:** 2 940 triángulos en toda la escena, 8 texturas y unas 65 llamadas de dibujo.

## Volver a generar las texturas o cambiar medidas

Las medidas están en `tools/generar_assets.py`. Después de cambiarlas ejecuta:

```bash
pip install numpy pillow
python tools/generar_assets.py
```

Eso vuelve a escribir `src/plano.js`, las texturas y la luz del piso.

## Pruebas y exportación del GLB

```bash
pip install playwright
playwright install chromium
python tools/verificar.py
```

Este comando toma capturas desde la entrada, la mitad del pasillo y el letrero (en computadora y celular), revisa la consola, prueba las colisiones, el teclado y el joystick, cuenta los triángulos y guarda `assets/pasillo_upiicsa.glb`.

El GLB tiene la geometría y las texturas, en metros y con el eje Y hacia arriba, y se puede abrir en Blender u otro programa 3D. La luz horneada del piso no se exporta: en el GLB el piso aparece sin sombras.
