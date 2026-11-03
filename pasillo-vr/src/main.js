// Recorrido del pasillo de UPIICSA en el navegador: computadora, celular y visor VR (WebXR).
import * as THREE from 'three';
import PLANO from './plano.js?v=202611031500';
import { construirEscena } from './escena.js?v=202611031500';
import { Colisiones } from './colisiones.js?v=202611031500';
import { ControlesEscritorio, ControlesCelular } from './controles.js?v=202611031500';
import { ControlesVR } from './vr.js?v=202611031500';

const $ = (id) => document.getElementById(id);
const esCelular = matchMedia('(pointer: coarse)').matches;

/* ---------- render ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 400);
const jugador = new THREE.Group();                // se mueve el jugador; la cámara va dentro a la altura de los ojos
jugador.add(camera);
scene.add(jugador);
camera.position.set(0, PLANO.alturaOjos, 0);
jugador.position.set(...PLANO.inicio);

addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

const { grupo, letrero, panel } = await construirEscena(scene);
const colisiones = new Colisiones(PLANO);
const escritorio = new ControlesEscritorio(camera, renderer.domElement);
const celular = esCelular ? new ControlesCelular(camera, $('joystick'), $('palanca'), renderer.domElement) : null;
const vr = new ControlesVR(renderer, scene, jugador, camera, colisiones);

/* ---------- pantalla de inicio ---------- */
$('ayuda').innerHTML = esCelular
    ? 'Usa el <b>joystick</b> de la izquierda para caminar y <b>mueve el teléfono</b> para mirar (también puedes deslizar el dedo). Apunta el círculo del centro al letrero para ver la información.'
    : '<b>W A S D</b> o flechas para caminar y <b>Shift</b> para correr. Mira con el <b>mouse</b>; si la flecha del mouse sigue visible, <b>mantén el clic y arrastra</b>. <b>Esc</b> o el botón <b>?</b> para pausar. Apunta el círculo del centro al letrero para ver la información.';
$('estado').textContent = '';
$('btnEntrar').disabled = false;                  // hasta aquí ya cargó todo

function mostrarInicio(si) {
    $('inicio').hidden = !si;
    $('mira').hidden = si;
    $('joystick').hidden = si || !esCelular;
    $('btnPausa').hidden = si;
}

// El recorrido empieza siempre con el clic; ya no depende de que el navegador deje capturar el mouse
$('btnEntrar').addEventListener('click', async () => {
    mostrarInicio(false);
    if (esCelular) await celular.activar();
    else escritorio.activar();
});
escritorio.addEventListener('pausa', () => { if (!renderer.xr.isPresenting) mostrarInicio(true); });
$('btnPausa').addEventListener('click', () => { escritorio.pausar(); mostrarInicio(true); });

// Botón «Entrar en VR»: solo aparece si el navegador tiene WebXR y un visor disponible
if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
        if (!ok) return;
        $('btnVR').hidden = false;
        $('btnVR').addEventListener('click', async () => {
            const sesion = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
            sesion.addEventListener('end', () => {
                camera.position.set(0, PLANO.alturaOjos, 0);
                camera.quaternion.identity();
                mostrarInicio(true);
            });
            await renderer.xr.setSession(sesion);
            $('inicio').hidden = true;
        });
    });
} else if (!window.isSecureContext) {
    $('estado').textContent = 'Para el modo VR abre la página con HTTPS (o en localhost).';
}

/* ---------- letrero: se muestra la información al señalarlo ---------- */
const mirada = new THREE.Raycaster();
mirada.far = 9;
const centro = new THREE.Vector2(0, 0);
let ocultarEn = 0;
function revisarLetrero(t, señaladoPorControl) {
    mirada.setFromCamera(centro, camera);
    const visto = señaladoPorControl || mirada.intersectObject(letrero, false).length > 0;
    if (visto) { panel.visible = true; ocultarEn = t + 1500; }
    else if (t > ocultarEn) panel.visible = false;
    $('mira').classList.toggle('activa', visto);
    if (panel.visible) {                           // el panel siempre mira hacia ti
        const ojo = new THREE.Vector3();
        camera.getWorldPosition(ojo);
        panel.lookAt(ojo.x, panel.position.y, ojo.z);
    }
}

/* ---------- ciclo ---------- */
const reloj = new THREE.Clock();
let triangulos = 0;
renderer.setAnimationLoop((t) => {
    const dt = Math.min(reloj.getDelta(), 0.1);
    let señalado = false;
    if (renderer.xr.isPresenting) {
        señalado = vr.actualizar([letrero]).length > 0;
    } else if (esCelular) {
        celular.actualizar(dt, jugador, colisiones);
    } else {
        escritorio.actualizar(dt, jugador, colisiones);
    }
    revisarLetrero(t, señalado);
    renderer.render(scene, camera);
    triangulos = renderer.info.render.triangles;
});

/* ---------- para las pruebas automáticas y la exportación ---------- */
window.__ir = (x, z, grados = 0, inclinacion = 0) => {
    jugador.position.set(x, 0, z);
    camera.rotation.set(THREE.MathUtils.degToRad(inclinacion), THREE.MathUtils.degToRad(grados), 0, 'YXZ');
};
window.__info = () => {
    let total = 0;                                 // triángulos de toda la escena (no solo lo que se ve)
    scene.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry;
        const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
        total += n * (o.isInstancedMesh ? o.count : 1);
    });
    return { triangulosVistos: triangulos, triangulosEscena: total, llamadas: renderer.info.render.calls,
             geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures };
};
window.__pruebas = { escritorio, celular, colisiones, jugador, camera };
window.__exportarGLB = async () => {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    // Los árboles usan InstancedMesh; para que el GLB abra en cualquier programa se vuelven mallas normales
    const copia = grupo.clone();
    copia.traverse((o) => {
        if (!o.isInstancedMesh) return;
        const sueltos = new THREE.Group();
        sueltos.name = o.name || 'arboles';
        const m = new THREE.Matrix4(), c = new THREE.Color();
        for (let i = 0; i < o.count; i++) {
            const mat = o.material.clone();
            if (o.instanceColor) { o.getColorAt(i, c); mat.color.copy(c); }
            const malla = new THREE.Mesh(o.geometry, mat);
            o.getMatrixAt(i, m);
            m.decompose(malla.position, malla.quaternion, malla.scale);
            sueltos.add(malla);
        }
        o.userData.reemplazo = sueltos;
    });
    const instanciados = [];
    copia.traverse((o) => { if (o.userData.reemplazo) instanciados.push(o); });
    for (const o of instanciados) { o.parent.add(o.userData.reemplazo); o.removeFromParent(); }
    const glb = await new GLTFExporter().parseAsync(copia, { binary: true, maxTextureSize: 1024 });
    let bin = '';
    const bytes = new Uint8Array(glb);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
};
window.__listo = true;
