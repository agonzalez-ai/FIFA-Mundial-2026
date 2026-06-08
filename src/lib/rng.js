// rng.js — Generador pseudoaleatorio SEMBRABLE (mulberry32) para reproducibilidad.
// La simulacion Monte Carlo (Fase 4) usa una semilla fija para que cada corrida
// sea auditable y re-ejecutable con el mismo resultado.

// Crea un RNG a partir de una semilla entera. Devuelve funcion () -> [0,1).
export function crearRng(semilla) {
  let a = semilla >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Muestrea de una Poisson(lambda) por el metodo de Knuth (lambda chico, ideal aqui).
export function muestrearPoisson(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}
