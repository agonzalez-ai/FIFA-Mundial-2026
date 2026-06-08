// model.js — FASE 3: modelo de partido transparente (Elo -> goles -> Poisson).
//
// FORMULA EXACTA (cada parametro vive en config.MODELO y se documenta en README):
//   dr  = (Elo_local + HFA) - Elo_visita           ventaja de localia en puntos Elo
//   We  = 1 / (1 + 10^(-dr/400))                    expectativa Elo de victoria local
//   sup = beta * (dr / 400)                         supremacia esperada en goles
//   lambda_local  = max(lambdaMin, lambda0 + sup/2)
//   lambda_visita = max(lambdaMin, lambda0 - sup/2)
//   Marcador ~ Poisson(lambda_local) x Poisson(lambda_visita)  (independientes)
//
// De la matriz de marcadores se obtienen P(local), P(empate), P(visita),
// el marcador mas probable y los goles esperados. Esto da W/D/L y diferencia de
// goles, insumos de los desempates de la Fase 4.
//
// Todas las funciones de calculo son PURAS (testeables sin red ni disco).

import fs from 'node:fs';
import path from 'node:path';
import { MODELO, TORNEO, PATHS } from './config.js';
import { aCSV, objetosDesdeDelimitado } from './lib/csv.js';
import { hfaDePartido } from './lib/venues.js';
import { info, warn } from './lib/logger.js';

// --- Nucleo matematico (puro) ----------------------------------------------

// Expectativa Elo de victoria del local dado el diferencial dr.
export function expectativaVictoria(dr) {
  return 1 / (1 + Math.pow(10, -dr / 400));
}

// Goles esperados (lambdas) por equipo a partir de los Elo y la HFA en puntos Elo.
export function lambdasDesdeElo(eloLocal, eloVisita, hfaElo = 0, params = MODELO) {
  const { lambda0, beta, lambdaMin } = params;
  const dr = (eloLocal + hfaElo) - eloVisita;
  const sup = beta * (dr / 400); // supremacia esperada en goles
  const lambdaLocal = Math.max(lambdaMin, lambda0 + sup / 2);
  const lambdaVisita = Math.max(lambdaMin, lambda0 - sup / 2);
  return { dr, sup, lambdaLocal, lambdaVisita };
}

// pmf de Poisson: P(X=k) con media lambda.
export function poissonPmf(k, lambda) {
  // k! por producto (k chico). exp(-lambda) * lambda^k / k!
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / fact;
}

// Matriz de marcadores P(i,j) = P(local=i) * P(visita=j), i,j en 0..maxGoles.
// Se renormaliza para que sume 1 (la cola > maxGoles se reparte proporcionalmente).
export function matrizMarcadores(lambdaLocal, lambdaVisita, maxGoles = 10) {
  const pl = Array.from({ length: maxGoles + 1 }, (_, i) => poissonPmf(i, lambdaLocal));
  const pv = Array.from({ length: maxGoles + 1 }, (_, j) => poissonPmf(j, lambdaVisita));
  const M = [];
  let total = 0;
  for (let i = 0; i <= maxGoles; i++) {
    M[i] = [];
    for (let j = 0; j <= maxGoles; j++) {
      const p = pl[i] * pv[j];
      M[i][j] = p;
      total += p;
    }
  }
  for (let i = 0; i <= maxGoles; i++) {
    for (let j = 0; j <= maxGoles; j++) M[i][j] /= total; // renormaliza
  }
  return M;
}

// Resume una matriz de marcadores en probabilidades de resultado y marcador modal.
export function resumenPartido(M) {
  let pLocal = 0, pEmpate = 0, pVisita = 0;
  let mejor = { p: -1, i: 0, j: 0 };
  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < M[i].length; j++) {
      const p = M[i][j];
      if (i > j) pLocal += p; else if (i === j) pEmpate += p; else pVisita += p;
      if (p > mejor.p) mejor = { p, i, j };
    }
  }
  return { pLocal, pEmpate, pVisita, marcadorProb: `${mejor.i}-${mejor.j}`, pMarcadorProb: mejor.p };
}

// Pipeline completo de un partido: de Elo a probabilidades + lambdas.
export function probabilidadesPartido(eloLocal, eloVisita, hfaElo = 0, params = MODELO, maxGoles = 10) {
  const { dr, sup, lambdaLocal, lambdaVisita } = lambdasDesdeElo(eloLocal, eloVisita, hfaElo, params);
  const M = matrizMarcadores(lambdaLocal, lambdaVisita, maxGoles);
  const res = resumenPartido(M);
  return { dr, sup, lambdaLocal, lambdaVisita, we: expectativaVictoria(dr), ...res };
}

// HFA por partido: +65 Elo al equipo que juega en su pais anfitrion (con signo).
// Se determina con el mapa sede->pais de lib/venues.js (ver hfaDePartido).

// --- Orquestacion: genera match_probs.csv (analitico, exacto) ---------------

function cargarCSV(nombre, dir = PATHS.out) {
  const ruta = path.join(dir, nombre);
  if (!fs.existsSync(ruta)) throw new Error(`Falta ${ruta}. Corre las fases previas.`);
  return objetosDesdeDelimitado(fs.readFileSync(ruta, 'utf8'), ',').rows;
}

function main() {
  info('=== FASE 3: modelo de partido (match_probs.csv analitico) ===');
  const ratings = cargarCSV('ratings.csv');
  const fixtures = cargarCSV('fixtures.csv');
  const teams = cargarCSV('teams.csv');

  const eloPorId = new Map(ratings.map((r) => [String(r.team_id), Number(r.elo)]));
  const countryPorId = new Map(teams.map((t) => [String(t.team_id), t.country]));
  const nombrePorId = new Map(teams.map((t) => [String(t.team_id), t.team]));

  // Solo partidos de fase de grupos (tienen group asignado A..L).
  const grupos = fixtures.filter((f) => f.group && /^[A-L]$/.test(f.group));
  if (grupos.length !== TORNEO.partidosFaseGrupos) {
    warn(`Partidos de fase de grupos: ${grupos.length} (esperados ${TORNEO.partidosFaseGrupos}). Se procesa lo disponible.`);
  }

  const filas = [];
  for (const f of grupos) {
    const eloL = eloPorId.get(String(f.home_id));
    const eloV = eloPorId.get(String(f.away_id));
    if (!Number.isFinite(eloL) || !Number.isFinite(eloV)) {
      throw new Error(`Sin Elo para fixture ${f.fixture_id} (${f.home}/${f.away}). Revisa ratings.csv (Fase 2).`);
    }
    const hfa = hfaDePartido(
      nombrePorId.get(String(f.home_id)), countryPorId.get(String(f.home_id)),
      nombrePorId.get(String(f.away_id)), countryPorId.get(String(f.away_id)),
      f.venue_city, f.venue_name,
    );
    const p = probabilidadesPartido(eloL, eloV, hfa);
    filas.push({
      fixture_id: f.fixture_id,
      group: f.group,
      home: f.home,
      away: f.away,
      hfa_elo: hfa,
      elo_home: eloL,
      elo_away: eloV,
      xg_home: p.lambdaLocal.toFixed(3),
      xg_away: p.lambdaVisita.toFixed(3),
      p_local: p.pLocal.toFixed(4),
      p_empate: p.pEmpate.toFixed(4),
      p_visita: p.pVisita.toFixed(4),
      marcador_prob: p.marcadorProb,
    });
  }

  fs.mkdirSync(PATHS.out, { recursive: true });
  const ruta = path.join(PATHS.out, 'match_probs.csv');
  fs.writeFileSync(ruta, aCSV(filas, [
    'fixture_id', 'group', 'home', 'away', 'hfa_elo', 'elo_home', 'elo_away',
    'xg_home', 'xg_away', 'p_local', 'p_empate', 'p_visita', 'marcador_prob',
  ]));
  info(`Escrito ${ruta} (${filas.length} partidos).`);
  info('=== FASE 3 completa ===');
}

const invocadoDirecto = import.meta.url === `file://${process.argv[1]}`;
if (invocadoDirecto) {
  try { main(); }
  catch (e) { console.error(`\nMODELO ABORTADO: ${e.message}\n`); process.exit(1); }
}
