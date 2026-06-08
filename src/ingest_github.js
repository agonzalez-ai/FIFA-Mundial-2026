// ingest_github.js — Ruta de ingesta ALTERNATIVA a API-Football, usando el dataset
// publico de resultados internacionales martj42/international_results (alojado en
// GitHub, unico host alcanzable en este entorno). Construye los CSV canonicos:
//   data/out/quali_results.csv  (partidos reales jugados, base del ajuste)
//   data/out/teams.csv          (48 finalistas)
//   data/out/groups.csv         (12 grupos, reconstruidos de los fixtures)
//   data/out/fixtures.csv       (72 partidos de fase de grupos, con sede)
//
// Fuente cruda versionada: data/raw/intl_results_<fecha>.csv
// Integridad: solo partidos efectivamente jugados (score numerico). Los 72 del
// Mundial vienen SIN marcador (son los que se pronostican). Nada se inventa.

import fs from 'node:fs';
import path from 'node:path';
import { objetosDesdeDelimitado, aCSV } from './lib/csv.js';
import { info, warn } from './lib/logger.js';
import { PATHS } from './config.js';

const VENTANA_DESDE = '2023-01-01'; // 3 anios -> fuerza reciente (con decaimiento en Fase 2)
const VENTANA_HASTA = '2026-06-10'; // vispera del torneo
// Convencion de letras de los anfitriones (FIFA 2026): Mexico A, Canada B, USA D.
const LETRA_HOST = { 'Mexico': 'A', 'Canada': 'B', 'United States': 'D' };
const LETRAS = 'ABCDEFGHIJKL'.split('');

function ultimoRaw() {
  const files = fs.readdirSync(PATHS.raw).filter((f) => /^intl_results_.*\.csv$/.test(f)).sort();
  if (files.length === 0) throw new Error(`No hay dataset crudo en ${PATHS.raw}/intl_results_*.csv (descargalo primero).`);
  return path.join(PATHS.raw, files[files.length - 1]);
}

// Asigna letras A-L a los grupos: anfitriones por convencion, resto secuencial.
function asignarLetras(grupos) {
  const usadas = new Set();
  const letraDe = new Map(); // index de grupo -> letra
  grupos.forEach((g, i) => {
    const host = g.find((t) => LETRA_HOST[t]);
    if (host) { letraDe.set(i, LETRA_HOST[host]); usadas.add(LETRA_HOST[host]); }
  });
  const libres = LETRAS.filter((l) => !usadas.has(l));
  // grupos sin anfitrion: orden determinista por su equipo alfabeticamente menor
  const restantes = grupos.map((g, i) => i).filter((i) => !letraDe.has(i))
    .sort((a, b) => [...grupos[a]].sort()[0].localeCompare([...grupos[b]].sort()[0]));
  restantes.forEach((i, k) => letraDe.set(i, libres[k]));
  return letraDe;
}

function main() {
  info('=== INGESTA (GitHub: martj42/international_results) ===');
  const ruta = ultimoRaw();
  const { rows } = objetosDesdeDelimitado(fs.readFileSync(ruta, 'utf8'), ',');
  info(`Dataset crudo: ${path.basename(ruta)} (${rows.length} partidos historicos).`);

  // (1) Fixtures del Mundial 2026 (72 de fase de grupos; sin marcador)
  const wc = rows.filter((r) => r.tournament === 'FIFA World Cup' && r.date >= '2026-01-01');
  if (wc.length !== 72) warn(`Partidos WC2026 con equipos definidos: ${wc.length} (esperados 72).`);

  // (2) Reconstruir grupos por componentes conexas de los fixtures
  const parent = {};
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const r of wc) for (const t of [r.home_team, r.away_team]) if (!(t in parent)) parent[t] = t;
  for (const r of wc) parent[find(r.home_team)] = find(r.away_team);
  const comp = {};
  for (const t of Object.keys(parent)) (comp[find(t)] ??= []).push(t);
  const grupos = Object.values(comp);
  if (grupos.length !== 12 || grupos.some((g) => g.length !== 4)) {
    throw new Error(`Reconstruccion de grupos invalida: ${grupos.length} grupos de tamaños ${grupos.map((g) => g.length)}.`);
  }
  const letraDe = asignarLetras(grupos);
  const grupoDeEquipo = new Map();
  grupos.forEach((g, i) => g.forEach((t) => grupoDeEquipo.set(t, letraDe.get(i))));
  const finalistas = [...grupoDeEquipo.keys()];

  // (3) Partidos jugados reales en la ventana (base del ajuste de fuerza)
  const jugados = rows.filter((r) =>
    r.tournament !== 'FIFA World Cup' &&
    r.home_score !== 'NA' && r.away_score !== 'NA' &&
    r.date >= VENTANA_DESDE && r.date <= VENTANA_HASTA &&
    Number.isFinite(Number(r.home_score)) && Number.isFinite(Number(r.away_score)));
  info(`Partidos jugados en ventana ${VENTANA_DESDE}..${VENTANA_HASTA}: ${jugados.length}.`);

  // --- Escritura de CSV canonicos (team_id = nombre; join consistente) ---
  fs.mkdirSync(PATHS.out, { recursive: true });
  const w = (nombre, filas, cols) => {
    fs.writeFileSync(path.join(PATHS.out, nombre), aCSV(filas, cols));
    info(`Escrito data/out/${nombre} (${filas.length} filas).`);
  };

  w('quali_results.csv', jugados.map((r, i) => ({
    fixture_id: i + 1, fecha: r.date, confederacion: r.tournament, league_id: '', season: r.date.slice(0, 4),
    round: '', home_id: r.home_team, home: r.home_team, away_id: r.away_team, away: r.away_team,
    goles_local: r.home_score, goles_visita: r.away_score, status: 'FT',
  })), ['fixture_id', 'fecha', 'confederacion', 'league_id', 'season', 'round', 'home_id', 'home', 'away_id', 'away', 'goles_local', 'goles_visita', 'status']);

  w('teams.csv', finalistas.map((t) => ({ team_id: t, team: t, code: '', country: t })),
    ['team_id', 'team', 'code', 'country']);

  const filasGrupos = [];
  grupos.forEach((g, i) => g.forEach((t, k) => filasGrupos.push({ group: letraDe.get(i), team_id: t, team: t, rank_inicial: k + 1 })));
  filasGrupos.sort((a, b) => a.group.localeCompare(b.group));
  w('groups.csv', filasGrupos, ['group', 'team_id', 'team', 'rank_inicial']);

  w('fixtures.csv', wc.map((r, i) => ({
    fixture_id: 100000 + i, fecha: r.date, round: 'Group Stage', group: grupoDeEquipo.get(r.home_team) || '',
    home_id: r.home_team, home: r.home_team, away_id: r.away_team, away: r.away_team,
    venue_name: '', venue_city: r.city, status: 'NS',
  })), ['fixture_id', 'fecha', 'round', 'group', 'home_id', 'home', 'away_id', 'away', 'venue_name', 'venue_city', 'status']);

  info('=== INGESTA completa. Ahora: npm run ratings && npm run simulate ===');
}

const invocadoDirecto = import.meta.url === `file://${process.argv[1]}`;
if (invocadoDirecto) {
  try { main(); } catch (e) { console.error(`\nINGESTA ABORTADA: ${e.message}\n`); process.exit(1); }
}
