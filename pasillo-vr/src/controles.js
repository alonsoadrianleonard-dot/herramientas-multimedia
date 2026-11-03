// Controles fuera de VR: computadora (WASD + mouse) y celular (joystick táctil + mover el teléfono).
import * as THREE from 'three';

const ARRIBA = new THREE.Vector3(0, 1, 0);
const frente = new THREE.Vector3(), derecha = new THREE.Vector3();

// Mueve al jugador en el plano del piso según hacia dónde mira la cámara.
function caminar(camera, jugador, colisiones, adelante, lado, distancia) {
    camera.getWorldDirection(frente);
    frente.y = 0;
    if (frente.lengthSq() < 1e-6) return;
    frente.normalize();
    derecha.crossVectors(frente, ARRIBA);
    const dx = (frente.x * adelante + derecha.x * lado) * distancia;
    const dz = (frente.z * adelante + derecha.z * lado) * distancia;
    colisiones.mover(jugador.position, dx, dz);
}

// El recorrido empieza aunque el navegador no deje capturar el mouse (pointer lock),
// por ejemplo dentro de un iframe: en ese caso se mira arrastrando con el botón presionado.
export class ControlesEscritorio extends THREE.EventDispatcher {
    constructor(camera, dom) {
        super();
        this.camera = camera;
        this.dom = dom;
        this.activo = false;
        this.arrastrando = false;
        this.giro = new THREE.Euler(0, 0, 0, 'YXZ');
        this.teclas = new Set();
        addEventListener('keydown', (e) => {
            if (!this.activo) return;
            this.teclas.add(e.code);
            if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();   // que no se mueva la página de fuera
        });
        addEventListener('keyup', (e) => this.teclas.delete(e.code));
        addEventListener('blur', () => { this.teclas.clear(); this.arrastrando = false; });

        dom.addEventListener('mousedown', (e) => {
            if (!this.activo) return;
            if (!this.capturado) this.capturar();          // con un clic se intenta capturar el mouse otra vez
            this.arrastrando = true;
        });
        addEventListener('mouseup', () => { this.arrastrando = false; });
        addEventListener('mousemove', (e) => {
            if (!this.activo || !(this.capturado || this.arrastrando)) return;
            this.giro.setFromQuaternion(this.camera.quaternion);
            this.giro.y -= e.movementX * 0.0025;
            this.giro.x = THREE.MathUtils.clamp(this.giro.x - e.movementY * 0.0025, -1.4, 1.4);
            this.camera.quaternion.setFromEuler(this.giro);
        });
        document.addEventListener('pointerlockchange', () => {
            if (!this.capturado && this.estabaCapturado && this.activo) {   // Esc: pausa
                this.activo = false;
                this.dispatchEvent({ type: 'pausa' });
            }
            this.estabaCapturado = this.capturado;
        });
    }

    get capturado() { return document.pointerLockElement === this.dom; }

    capturar() {
        try {
            const r = this.dom.requestPointerLock && this.dom.requestPointerLock();
            if (r && r.catch) r.catch(() => { /* sin captura: se mira arrastrando */ });
        } catch { /* el navegador no lo permite aquí */ }
    }

    activar() {
        this.activo = true;
        this.capturar();
    }

    pausar() {
        this.activo = false;
        if (this.capturado) document.exitPointerLock();
    }

    actualizar(dt, jugador, colisiones) {
        if (!this.activo) return;
        const t = this.teclas;
        const adelante = (t.has('KeyW') || t.has('ArrowUp') ? 1 : 0) - (t.has('KeyS') || t.has('ArrowDown') ? 1 : 0);
        const lado = (t.has('KeyD') || t.has('ArrowRight') ? 1 : 0) - (t.has('KeyA') || t.has('ArrowLeft') ? 1 : 0);
        if (!adelante && !lado) return;
        const norma = Math.hypot(adelante, lado);
        const velocidad = t.has('ShiftLeft') || t.has('ShiftRight') ? 4.5 : 2.2;      // m/s (caminar / correr)
        caminar(this.camera, jugador, colisiones, adelante / norma, lado / norma, velocidad * dt);
    }
}

// Convierte la orientación del teléfono (alpha, beta, gamma) en la rotación de la cámara.
const zee = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));   // la cámara mira por la parte de atrás del teléfono
const euler = new THREE.Euler(), q0 = new THREE.Quaternion();
function orientacionACuaternion(q, alpha, beta, gamma, pantalla) {
    euler.set(beta, alpha, -gamma, 'YXZ');
    q.setFromEuler(euler);
    q.multiply(q1);
    q.multiply(q0.setFromAxisAngle(zee, -pantalla));
}

export class ControlesCelular {
    constructor(camera, base, palanca, dom) {
        this.camera = camera;
        this.mover = { x: 0, y: 0 };
        this.giroExtra = 0;       // giro que se suma al deslizar el dedo
        this.inclinacion = 0;     // solo si el teléfono no tiene giroscopio
        this.orientacion = null;
        this.giroInicial = null;
        this.activo = false;
        this.qTel = new THREE.Quaternion();
        this.qGiro = new THREE.Quaternion();
        camera.rotation.order = 'YXZ';

        // Joystick: la distancia de la palanca al centro es la velocidad
        let dedoJoy = null;
        const radio = 50;
        const mover = (e) => {
            const r = base.getBoundingClientRect();
            let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
            const d = Math.hypot(dx, dy);
            if (d > radio) { dx *= radio / d; dy *= radio / d; }
            palanca.style.transform = `translate(${dx}px, ${dy}px)`;
            this.mover.x = dx / radio; this.mover.y = dy / radio;
        };
        base.addEventListener('pointerdown', (e) => {
            dedoJoy = e.pointerId;
            try { base.setPointerCapture(e.pointerId); } catch { /* el dedo ya se soltó */ }
            mover(e);
            e.stopPropagation();
        });
        base.addEventListener('pointermove', (e) => { if (e.pointerId === dedoJoy) mover(e); });
        const soltar = (e) => {
            if (e.pointerId !== dedoJoy) return;
            dedoJoy = null; this.mover.x = this.mover.y = 0; palanca.style.transform = '';
        };
        base.addEventListener('pointerup', soltar);
        base.addEventListener('pointercancel', soltar);

        // Deslizar el dedo en el resto de la pantalla también gira la vista
        let dedoVista = null, ultimo = null;
        dom.addEventListener('pointerdown', (e) => { dedoVista = e.pointerId; ultimo = { x: e.clientX, y: e.clientY }; });
        dom.addEventListener('pointermove', (e) => {
            if (e.pointerId !== dedoVista || !ultimo) return;
            this.giroExtra += (e.clientX - ultimo.x) * 0.005;
            if (!this.orientacion) this.inclinacion = THREE.MathUtils.clamp(this.inclinacion + (e.clientY - ultimo.y) * 0.005, -1.2, 1.2);
            ultimo = { x: e.clientX, y: e.clientY };
        });
        const fin = (e) => { if (e.pointerId === dedoVista) { dedoVista = null; ultimo = null; } };
        dom.addEventListener('pointerup', fin);
        dom.addEventListener('pointercancel', fin);

        addEventListener('deviceorientation', (e) => { if (e.alpha !== null) this.orientacion = e; });
    }

    // iPhone pide permiso para usar el giroscopio, y solo se puede pedir después de un toque
    async activar() {
        this.activo = true;
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try { await DeviceOrientationEvent.requestPermission(); } catch { /* sin giroscopio: se usa el dedo */ }
        }
    }

    actualizar(dt, jugador, colisiones) {
        if (!this.activo) return;
        const o = this.orientacion;
        if (o) {
            const g = THREE.MathUtils.degToRad;
            const pantalla = g((screen.orientation && screen.orientation.angle) || window.orientation || 0);
            orientacionACuaternion(this.qTel, g(o.alpha), g(o.beta), g(o.gamma || 0), pantalla);
            if (this.giroInicial === null) {                       // al empezar, mirar hacia el pasillo
                this.giroInicial = new THREE.Euler().setFromQuaternion(this.qTel, 'YXZ').y;
            }
            this.qGiro.setFromAxisAngle(ARRIBA, -this.giroExtra - this.giroInicial);
            this.camera.quaternion.copy(this.qGiro).multiply(this.qTel);
        } else {
            this.camera.rotation.set(-this.inclinacion, -this.giroExtra, 0, 'YXZ');
        }
        const adelante = -this.mover.y, lado = this.mover.x;
        if (Math.abs(adelante) + Math.abs(lado) > 0.05) caminar(this.camera, jugador, colisiones, adelante, lado, 2.2 * dt);
    }
}
