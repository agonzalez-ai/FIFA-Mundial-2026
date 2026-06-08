// knockout.js — FASE 5: simulacion de la fase de eliminacion (R32 -> campeon + 3er lugar).
//
// IMPORTANTE (integridad): la asignacion EXACTA de FIFA (Annex C, 495 escenarios para
// ubicar a los 8 mejores terceros) no se reproduce aqui. Se usa un cuadro que respeta
// las reglas publicadas del formato 2026:
//   - 16 partidos de R32: 8 (ganador vs 3º), 4 (ganador vs 2º), 4 (2º vs 2º).
//   - Ningun equipo enfrenta a otro de su mismo grupo en R32.
//   - Arbol simetrico: R32 -> R16 -> 4tos -> semis -> final (+ 3er lugar).
// Es una APROXIMACION del sembrado oficial; impacto bajo en P(campeon), moderado en
// subcampeon/3º. Documentado en el README.
//
// Partidos de eliminacion: sede neutral (sin ventaja de local). Empate en
// tiempo reglamentario -> penales = volado 50/50 (no se simulan tarjetas/forma).

import { lambdasDC } from './dixoncoles.js';
import { muestrearPoisson } from './rng.js';

// Grupos cuyos GANADORES enfrentan a un tercero (8) y a un subcampeon (4).
const W_VS_3 = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'];
// Plantilla de los 16 cruces de R32 (en orden de bracket; cada par juega y el ganador
// avanza emparejado consecutivamente: (0,1)->R16, etc.).
const R32 = [
  [{ t: 'W', g: 'A' }, { t: 'T', i: 0 }],
  [{ t: 'W', g: 'B' }, { t: 'T', i: 1 }],
  [{ t: 'W', g: 'D' }, { t: 'T', i: 2 }],
  [{ t: 'W', g: 'E' }, { t: 'T', i: 3 }],
  [{ t: 'W', g: 'G' }, { t: 'T', i: 4 }],
  [{ t: 'W', g: 'I' }, { t: 'T', i: 5 }],
  [{ t: 'W', g: 'K' }, { t: 'T', i: 6 }],
  [{ t: 'W', g: 'L' }, { t: 'T', i: 7 }],
  [{ t: 'W', g: 'C' }, { t: 'R', g: 'F' }],
  [{ t: 'W', g: 'F' }, { t: 'R', g: 'C' }],
  [{ t: 'W', g: 'H' }, { t: 'R', g: 'J' }],
  [{ t: 'W', g: 'J' }, { t: 'R', g: 'H' }],
  [{ t: 'R', g: 'A' }, { t: 'R', g: 'B' }],
  [{ t: 'R', g: 'D' }, { t: 'R', g: 'E' }],
  [{ t: 'R', g: 'G' }, { t: 'R', g: 'I' }],
  [{ t: 'R', g: 'K' }, { t: 'R', g: 'L' }],
];

// Asigna los 8 mejores terceros a las ranuras T0..T7 evitando que un tercero
// enfrente al ganador de su propio grupo. thirds: [{id, group}] ya ordenados.
function asignarTerceros(thirds) {
  const slots = new Array(8).fill(null);
  const pend = [];
  for (const t of thirds) {
    let puesto = false;
    for (let i = 0; i < 8; i++) {
      if (!slots[i] && W_VS_3[i] !== t.group) { slots[i] = t.id; puesto = true; break; }
    }
    if (!puesto) pend.push(t);
  }
  for (const t of pend) { const i = slots.indexOf(null); if (i >= 0) slots[i] = t.id; }
  return slots;
}

// Resuelve un partido de eliminacion. Devuelve { ganador, perdedor, marcador }.
function jugar(a, b, fit, rng) {
  const { lambdaLocal, lambdaVisita } = lambdasDC(fit, a, b, { neutral: true });
  let ga = muestrearPoisson(lambdaLocal, rng), gb = muestrearPoisson(lambdaVisita, rng);
  let pen = '';
  if (ga === gb) { // penales (volado)
    const aGana = rng() < 0.5;
    pen = ' (pen.)';
    return { ganador: aGana ? a : b, perdedor: aGana ? b : a, marcador: `${ga}-${gb}${pen}` };
  }
  return ga > gb ? { ganador: a, perdedor: b, marcador: `${ga}-${gb}` }
                 : { ganador: b, perdedor: a, marcador: `${ga}-${gb}` };
}

// Simula toda la eliminatoria. W/R: Map<group, teamId>. thirds: [{id, group}] (8, ordenados).
// Devuelve { champion, runnerUp, third, reached: Map<id, ronda> }, ronda en {32,16,8,4,2,1}
// = ronda MAS PROFUNDA alcanzada como participante. trace=true agrega { bracket }.
export function simularKnockout(W, R, thirds, fit, rng, trace = false) {
  const tslots = asignarTerceros(thirds);
  const resolver = (d) => (d.t === 'W' ? W.get(d.g) : d.t === 'R' ? R.get(d.g) : tslots[d.i]);

  const equipos = [];
  for (const [da, db] of R32) equipos.push(resolver(da), resolver(db));

  const reached = new Map();
  for (const id of equipos) if (id != null) reached.set(id, 32);
  const bracket = {};

  // Juega una ronda (emparejando consecutivos) y marca a los ganadores con `sig`.
  const correr = (arr, sig, etiqueta) => {
    const gan = [], perd = [], log = [];
    for (let k = 0; k < arr.length; k += 2) {
      const r = jugar(arr[k], arr[k + 1], fit, rng);
      gan.push(r.ganador); perd.push(r.perdedor); reached.set(r.ganador, sig);
      if (trace) log.push(`${arr[k]} ${r.marcador} ${arr[k + 1]} -> ${r.ganador}`);
    }
    if (trace) bracket[etiqueta] = log;
    return { gan, perd };
  };

  const r16 = correr(equipos, 16, 'R16').gan;     // 32 -> 16
  const qf = correr(r16, 8, '4tos').gan;          // 16 -> 8
  const sf = correr(qf, 4, 'Semis_in').gan;       // 8 -> 4 (semifinalistas)
  // Semis: 4 -> 2 finalistas (+ 2 perdedores para 3er lugar)
  const semA = jugar(sf[0], sf[1], fit, rng);
  const semB = jugar(sf[2], sf[3], fit, rng);
  reached.set(semA.ganador, 2); reached.set(semB.ganador, 2);
  const finalM = jugar(semA.ganador, semB.ganador, fit, rng);
  const tercerM = jugar(semA.perdedor, semB.perdedor, fit, rng);
  reached.set(finalM.ganador, 1);

  if (trace) {
    bracket['Semis'] = [`${sf[0]} ${semA.marcador} ${sf[1]} -> ${semA.ganador}`,
                        `${sf[2]} ${semB.marcador} ${sf[3]} -> ${semB.ganador}`];
    delete bracket['Semis_in'];
    bracket['3er lugar'] = [`${semA.perdedor} ${tercerM.marcador} ${semB.perdedor} -> ${tercerM.ganador}`];
    bracket['Final'] = [`${semA.ganador} ${finalM.marcador} ${semB.ganador} -> CAMPEON ${finalM.ganador}`];
  }

  return { champion: finalM.ganador, runnerUp: finalM.perdedor, third: tercerM.ganador, reached, bracket: trace ? bracket : undefined };
}
