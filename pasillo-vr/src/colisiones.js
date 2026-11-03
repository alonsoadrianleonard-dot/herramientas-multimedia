// Colisiones básicas en planta (X, Z): el jugador es un círculo y los obstáculos son cajas.
export class Colisiones {
    constructor(plano, radio = 0.3) {
        this.cajas = plano.colisiones;                 // [x0, z0, x1, z1]
        this.limites = plano.limites;
        this.radio = radio;
    }

    libre(x, z) {
        const r = this.radio, [lx0, lz0, lx1, lz1] = this.limites;
        if (x < lx0 + r || x > lx1 - r || z < lz0 + r || z > lz1 - r) return false;
        for (const [x0, z0, x1, z1] of this.cajas) {
            if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return false;
        }
        return true;
    }

    // Mueve por separado en X y en Z: si choca de frente con una pared, se desliza a lo largo de ella.
    mover(pos, dx, dz) {
        if (this.libre(pos.x + dx, pos.z)) pos.x += dx;
        if (this.libre(pos.x, pos.z + dz)) pos.z += dz;
    }
}
