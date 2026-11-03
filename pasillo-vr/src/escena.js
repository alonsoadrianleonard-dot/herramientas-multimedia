// Construye el pasillo de UPIICSA con primitivas (cajas y planos), a escala real en metros.
// Ejes: +X = este, +Y = arriba, -Z = norte (hacia el edificio). Las medidas vienen de plano.js.
import * as THREE from 'three';
import PLANO from './plano.js?v=202611031500';

const cargador = new THREE.TextureLoader();
async function textura(nombre, { repetir = true, srgb = true } = {}) {
    const t = await cargador.loadAsync(`assets/${nombre}`);
    if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (nombre.endsWith('.jpg')) t.userData.mimeType = 'image/jpeg';   // el GLB exportado guarda JPG, no PNG
    return t;
}

// Las caras de BoxGeometry traen UV de 0 a 1; aquí se pasan a metros para que la textura no se estire.
// Orden de las caras: +x, -x, +y, -y, +z, -z.
function uvEnMetros(geo, w, h, d, metros, caraEspecial = null) {
    const uv = geo.attributes.uv;
    const tam = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let cara = 0; cara < 6; cara++) {
        const [su, sv] = caraEspecial && caraEspecial[cara] ? caraEspecial[cara] : [tam[cara][0] / metros, tam[cara][1] / metros];
        for (let i = 0; i < 4; i++) {
            const k = cara * 4 + i;
            uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv);
        }
    }
    return geo;
}

function caja(w, h, d, material, x, y, z, metros = 2) {
    const geo = uvEnMetros(new THREE.BoxGeometry(w, h, d), w, h, d, metros);
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    return m;
}

// Piso: plano horizontal con UV en metros (textura) y UV1 para la luz horneada (luz_piso.png).
function piso([x0, z0, x1, z1], y, metrosTextura, material) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const [lx0, lz0, lx1, lz1] = PLANO.luzPiso;
    const p = geo.attributes.position;
    const uv = new Float32Array(p.count * 2), uv1 = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        uv[2 * i] = x / metrosTextura; uv[2 * i + 1] = -z / metrosTextura;
        uv1[2 * i] = (x - lx0) / (lx1 - lx0); uv1[2 * i + 1] = 1 - (z - lz0) / (lz1 - lz0);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    return new THREE.Mesh(geo, material);
}

export async function construirEscena(scene) {
    const [tConcreto, tClaro, tPiso, tPasto, tFachada, tLetrero, tPanel, tLuz] = await Promise.all([
        textura('concreto.jpg'), textura('concreto_claro.jpg'), textura('piso.jpg'), textura('pasto.jpg'),
        textura('fachada.jpg'), textura('letrero.png', { repetir: false }), textura('panel.png', { repetir: false }),
        textura('luz_piso.png', { repetir: false }),
    ]);
    tLuz.channel = 1;                                   // usa el atributo uv1

    const grupo = new THREE.Group();
    grupo.name = 'pasillo_upiicsa';
    scene.add(grupo);

    /* ---------- luz: sol fijo sin sombras en tiempo real + cielo; las sombras del piso están horneadas ---------- */
    const sol = new THREE.DirectionalLight(0xfff4e0, 2.3);
    sol.position.set(...PLANO.sol).multiplyScalar(50);
    scene.add(sol, new THREE.HemisphereLight(0xdceeff, 0x8d8a74, 1.5));

    // Cielo: una esfera con degradado (no usa luces)
    const cieloGeo = new THREE.SphereGeometry(320, 16, 10);
    const col = [], cAlto = new THREE.Color(0x4f8fd6), cBajo = new THREE.Color(0xd6e7f5), c = new THREE.Color();
    const pos = cieloGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        c.copy(cBajo).lerp(cAlto, Math.max(0, pos.getY(i) / 320) ** 0.6);
        col.push(c.r, c.g, c.b);
    }
    cieloGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const cielo = new THREE.Mesh(cieloGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    cielo.name = 'cielo';
    scene.add(cielo);
    scene.fog = new THREE.Fog(0xd6e7f5, 70, 300);

    /* ---------- materiales ---------- */
    const horneado = (map) => new THREE.MeshBasicMaterial({ map, lightMap: tLuz, lightMapIntensity: Math.PI });
    const matPasto = horneado(tPasto);
    const matPiso = horneado(tPiso);
    matPiso.polygonOffset = true; matPiso.polygonOffsetFactor = -1; matPiso.polygonOffsetUnits = -1;
    const matConcreto = new THREE.MeshLambertMaterial({ map: tConcreto });
    const matClaro = new THREE.MeshLambertMaterial({ map: tClaro });
    const matMetal = new THREE.MeshLambertMaterial({ color: 0x8e959c });
    const matVidrio = new THREE.MeshPhongMaterial({ color: 0x24343d, specular: 0x9db4c2, shininess: 90, transparent: true, opacity: 0.88 });
    const matSeto = new THREE.MeshLambertMaterial({ color: 0xa8a23c });

    /* ---------- piso ---------- */
    grupo.add(piso([-80, -80, 80, 80], 0, 1.5, matPasto));
    for (const zona of PLANO.pisos) grupo.add(piso(zona, 0.01, 2, matPiso));

    /* ---------- pasillo techado ---------- */
    const P = PLANO.pasillo;
    const zCentro = -P.largo / 2;
    grupo.add(caja(P.ancho, P.losa, P.largo, matConcreto, 0, P.alto + P.losa / 2, zCentro));          // losa
    const pil = PLANO.pilares;
    for (const z of pil.z) {
        grupo.add(caja(pil.ancho, P.alto, pil.fondo, matConcreto, pil.x, P.alto / 2, z));             // pilar
        grupo.add(caja(P.ancho, 0.35, 0.3, matConcreto, 0, P.alto - 0.175, z));                        // trabe
    }

    /* ---------- edificio con las dos puertas de vidrio ---------- */
    const E = PLANO.edificio;
    const geoE = uvEnMetros(new THREE.BoxGeometry(E.ancho, E.alto, E.fondo), E.ancho, E.alto, E.fondo, 2,
        { 4: [E.ancho / 4, 1] });                                                                       // la cara +z lleva ventanas
    const matFachada = new THREE.MeshLambertMaterial({ map: tFachada });
    const edificio = new THREE.Mesh(geoE, [matConcreto, matConcreto, matConcreto, matConcreto, matFachada, matConcreto]);
    edificio.position.set(0, E.alto / 2, E.zFrente - E.fondo / 2);
    grupo.add(edificio);
    const Po = PLANO.portal;
    const zPortal = E.zFrente + Po.fondo / 2;
    grupo.add(caja(Po.ancho, Po.alto, Po.fondo, matClaro, 0, Po.alto / 2, zPortal));
    const zPuerta = E.zFrente + Po.fondo + 0.005;
    const D = PLANO.puertas;
    for (const x of D.x) {
        const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(D.ancho, D.alto), matVidrio);
        vidrio.position.set(x, D.alto / 2, zPuerta);
        grupo.add(vidrio);
        const marco = 0.07, z = zPuerta + 0.03;
        grupo.add(caja(marco, D.alto, 0.06, matMetal, x - D.ancho / 2 + marco / 2, D.alto / 2, z));
        grupo.add(caja(marco, D.alto, 0.06, matMetal, x + D.ancho / 2 - marco / 2, D.alto / 2, z));
        grupo.add(caja(D.ancho, marco, 0.06, matMetal, x, D.alto - marco / 2, z));
        grupo.add(caja(D.ancho, 0.12, 0.06, matMetal, x, 0.06, z));
        grupo.add(caja(D.ancho, 0.05, 0.06, matMetal, x, 2.1, z));                                     // travesaño
        const jaladera = x < 0 ? x + D.ancho / 2 - 0.18 : x - D.ancho / 2 + 0.18;
        grupo.add(caja(0.035, 0.6, 0.05, matMetal, jaladera, 1.05, z + 0.06));
    }

    /* ---------- otros edificios ---------- */
    const caras = { px: 0, nx: 1, pz: 4, nz: 5 };
    for (const b of PLANO.otrosEdificios) {
        const esp = {};
        for (const nombre of b.caras) {
            const i = caras[nombre];
            const largo = i < 2 ? b.fondo : b.ancho;
            esp[i] = [largo / 4, b.alto / 9.6];
        }
        const geo = uvEnMetros(new THREE.BoxGeometry(b.ancho, b.alto, b.fondo), b.ancho, b.alto, b.fondo, 2, esp);
        const mats = [0, 1, 2, 3, 4, 5].map((i) => (esp[i] ? matFachada : matConcreto));
        const m = new THREE.Mesh(geo, mats);
        m.position.set(b.x, b.alto / 2, b.z);
        grupo.add(m);
    }

    /* ---------- jardineras, postes y árboles ---------- */
    for (const [x0, z0, x1, z1] of PLANO.jardineras) {
        const w = x1 - x0, d = z1 - z0;
        grupo.add(caja(w, 0.45, d, matClaro, (x0 + x1) / 2, 0.225, (z0 + z1) / 2, 1));
        grupo.add(caja(w - 0.1, 0.3, d - 0.1, matSeto, (x0 + x1) / 2, 0.6, (z0 + z1) / 2, 1));
    }
    const geoPoste = new THREE.CylinderGeometry(0.06, 0.08, 6, 8);
    for (const [x, z] of PLANO.postes) {
        const poste = new THREE.Mesh(geoPoste, matMetal);
        poste.position.set(x, 3, z);
        grupo.add(poste, caja(0.25, 0.12, 0.6, matMetal, x, 6.0, z));
    }
    const A = PLANO.arboles;
    const geoTronco = new THREE.CylinderGeometry(0.13, 0.2, 1, 6);
    geoTronco.translate(0, 0.5, 0);
    const geoCopa = new THREE.IcosahedronGeometry(1, 1);
    const troncos = new THREE.InstancedMesh(geoTronco, new THREE.MeshLambertMaterial({ color: 0x5b4a3a }), A.length);
    const copas = new THREE.InstancedMesh(geoCopa, new THREE.MeshLambertMaterial({ color: 0xffffff }), A.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const verde = new THREE.Color(0x4f7a37), jacaranda = new THREE.Color(0x9a80cc);
    A.forEach(([x, z, alto, radio, tipo], i) => {
        troncos.setMatrixAt(i, mtx.compose(p.set(x, 0, z), q.identity(), s.set(1, alto + radio * 0.4, 1)));
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7);
        copas.setMatrixAt(i, mtx.compose(p.set(x, alto + radio * 0.8, z), q, s.set(radio, radio * 0.8, radio)));
        copas.setColorAt(i, tipo ? jacaranda : verde);
    });
    grupo.add(troncos, copas);

    /* ---------- letrero UPIICSA (al señalarlo aparece la información) ---------- */
    const L = PLANO.letrero;
    const matFrente = new THREE.MeshLambertMaterial({ map: tLetrero });
    const geoL = new THREE.BoxGeometry(L.ancho, L.alto, L.fondo);
    const letrero = new THREE.Mesh(geoL, [matClaro, matClaro, matClaro, matClaro, matFrente, matClaro]);
    letrero.position.set(L.x, L.alto / 2, L.z);
    letrero.rotation.y = L.giroY;
    letrero.name = 'letrero_upiicsa';
    grupo.add(letrero);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: tPanel, transparent: true, fog: false }));
    panel.position.set(L.x, L.alto + 1.05, L.z);
    panel.visible = false;
    panel.name = 'panel_informacion';
    scene.add(panel);                                  // fuera de «grupo» para que no se exporte al GLB

    return { grupo, letrero, panel };
}
