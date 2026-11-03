// Visor VR (WebXR): teletransporte con el gatillo y giro por pasos (snap turn) con la palanca.
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const GIRO = THREE.MathUtils.degToRad(30);
const ARRIBA = new THREE.Vector3(0, 1, 0);

export class ControlesVR {
    constructor(renderer, scene, jugador, camera, colisiones) {
        Object.assign(this, { renderer, jugador, camera, colisiones });
        this.destino = null;
        this.palancaSuelta = {};
        this.rayo = new THREE.Raycaster();
        this.origen = new THREE.Vector3();
        this.direccion = new THREE.Vector3();
        this.cabeza = new THREE.Vector3();

        // Marca en el piso donde vas a aparecer
        this.marca = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x800032, fog: false }));
        this.marca.position.y = 0.03;
        this.marca.visible = false;
        scene.add(this.marca);

        const fabrica = new XRControllerModelFactory();
        const geoLinea = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
        this.controles = [0, 1].map((i) => {
            const c = renderer.xr.getController(i);
            c.userData.apuntando = false;
            c.addEventListener('selectstart', () => { c.userData.apuntando = true; });
            c.addEventListener('selectend', () => {
                c.userData.apuntando = false;
                if (this.destino) this.teletransportar(this.destino);
                this.destino = null; this.marca.visible = false;
            });
            const linea = new THREE.Line(geoLinea, new THREE.LineBasicMaterial({ color: 0xffffff }));
            linea.scale.z = 5;
            c.add(linea);
            c.userData.linea = linea;
            jugador.add(c);
            const agarre = renderer.xr.getControllerGrip(i);
            agarre.add(fabrica.createControllerModel(agarre));
            jugador.add(agarre);
            return c;
        });
    }

    rayoDesde(control) {
        this.origen.setFromMatrixPosition(control.matrixWorld);
        this.direccion.set(0, 0, -1).transformDirection(control.matrixWorld);
        this.rayo.set(this.origen, this.direccion);
        return this.rayo;
    }

    // Lleva al jugador para que su cabeza quede sobre el punto elegido (la altura la da el visor)
    teletransportar(p) {
        this.camera.getWorldPosition(this.cabeza);
        this.jugador.position.x += p.x - this.cabeza.x;
        this.jugador.position.z += p.z - this.cabeza.z;
    }

    // Gira el mundo 30° alrededor de la cabeza, de golpe, para no marear
    girar(angulo) {
        this.camera.getWorldPosition(this.cabeza);
        const j = this.jugador.position;
        const d = new THREE.Vector3(j.x - this.cabeza.x, 0, j.z - this.cabeza.z).applyAxisAngle(ARRIBA, angulo);
        j.x = this.cabeza.x + d.x; j.z = this.cabeza.z + d.z;
        this.jugador.rotation.y += angulo;
    }

    // Regresa los objetos que señalan los controles (para el letrero)
    actualizar(objetosSeñalables) {
        const señalados = [];
        let destino = null;
        for (const c of this.controles) {
            const rayo = this.rayoDesde(c);
            const golpe = rayo.intersectObjects(objetosSeñalables, false)[0];
            if (golpe) señalados.push(golpe.object);
            let valido = false;
            if (c.userData.apuntando && this.direccion.y < -0.05) {
                const t = -this.origen.y / this.direccion.y;
                if (t < 25) {
                    const p = this.origen.clone().addScaledVector(this.direccion, t);
                    valido = this.colisiones.libre(p.x, p.z);
                    if (valido) destino = p;
                    c.userData.linea.scale.z = t;
                }
            } else {
                c.userData.linea.scale.z = golpe ? golpe.distance : 5;
            }
            c.userData.linea.material.color.set(valido ? 0x800032 : 0xffffff);
        }
        this.destino = destino;
        this.marca.visible = !!destino;
        if (destino) this.marca.position.set(destino.x, 0.03, destino.z);

        // Palanca a la izquierda o derecha = giro de 30°. Hay que soltarla para volver a girar.
        const sesion = this.renderer.xr.getSession();
        if (sesion) {
            for (const fuente of sesion.inputSources) {
                const ejes = fuente.gamepad && fuente.gamepad.axes;
                if (!ejes || !ejes.length) continue;
                const x = ejes.length >= 4 ? ejes[2] : ejes[0];
                const id = fuente.handedness;
                if (Math.abs(x) > 0.7) {
                    if (this.palancaSuelta[id] !== false) { this.girar(-Math.sign(x) * GIRO); this.palancaSuelta[id] = false; }
                } else if (Math.abs(x) < 0.3) {
                    this.palancaSuelta[id] = true;
                }
            }
        }
        return señalados;
    }
}
