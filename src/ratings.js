// ratings.js — FASE 2: ratings de fuerza por seleccion (Elo + ranking FIFA).
//
// Fuente primaria: eloratings.net (World Football Elo). Fuente de control: ranking
// FIFA (puntos), provisto como archivo versionado.
//
// Integridad:
//  - El formato del export Elo se VERIFICA en runtime: se detecta la columna de
//    Elo por sus valores (numericos, en rango plausible) y la de nombre; si el
//    archivo no es reconocible, se REPORTA y SE DETIENE (no se asume layout).
//  - Equipos sin Elo (debutantes) -> imputacion percentil 5 DOCUMENTADA, marcada
//    como fuente 'imputado_p5'. Nunca un numero arbitrario silencioso.
//  - Nada se rellena: nombres que no casan se reportan.
//
// Salida: data/out/ratings.csv (team_id, team, elo, fifa_points, fuente, fecha_corte).

import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { RATINGS, PATHS, MODELO } from './config.js';
import { aCSV, objetosDesdeDelimitado, parseDelimitado } from './lib/csv.js';
import { indexarEquipos, casar } from './lib/names.js';
import { info, warn, error } from './lib/logger.js';

// --- Carga de teams.csv (salida de Fase 1) ---------------------------------

function cargarTeams() {
  const ruta = path.join(PATHS.out, 'teams.csv');
  if (!fs.existsSync(ruta)) {
    throw new Error(`Falta ${ruta}. Corre primero "npm run extract" (Fase 1).`);
  }
  const { rows } = objetosDesdeDelimitado(fs.readFileSync(ruta, 'utf8'), ',');
  if (rows.length === 0) throw new Error(`${ruta} esta vacio.`);
  return rows;
}

// --- Obtencion del texto crudo de Elo (cache local o fetch) ----------------
// Prefiere cache versionado (reproducible y funciona sin red). Para refrescar,
// borra el .tsv cacheado o corre con red disponible.

async function obtenerTextoElo() {
  const baseTs = path.join(PATHS.raw, `${RATINGS.elo.cacheFile}_latest.tsv`);
  if (fs.existsSync(baseTs)) {
    const stat = fs.statSync(baseTs);
    info(`Elo: usando cache local ${baseTs} (corte ${stat.mtime.toISOString()}).`);
    return { texto: fs.readFileSync(baseTs, 'utf8'), fechaCorte: stat.mtime.toISOString(), origen: `cache:${baseTs}` };
  }
  // No hay cache: intentar fetch (requiere red; en sandboxes restringidos fallara).
  info(`Elo: sin cache local, descargando ${RATINGS.elo.url} ...`);
  let res;
  try {
    res = await axios.get(RATINGS.elo.url, { timeout: 30000, responseType: 'text' });
  } catch (e) {
    const detalle = e.response ? `HTTP ${e.response.status}` : e.message;
    error(`No se pudo descargar Elo desde ${RATINGS.elo.url}: ${detalle}`);
    throw new Error(
      `Fuente Elo inaccesible (${detalle}). Descarga el export a "${baseTs}" y reintenta, ` +
      `o corre en un entorno con acceso a eloratings.net. NO se inventan ratings.`
    );
  }
  const texto = String(res.data);
  const ts = new Date().toISOString();
  fs.mkdirSync(PATHS.raw, { recursive: true });
  fs.writeFileSync(baseTs, texto);
  fs.writeFileSync(path.join(PATHS.raw, `${RATINGS.elo.cacheFile}_${ts.replace(/[:.]/g, '-')}.tsv`), texto);
  info(`Elo: descargado y cacheado (${texto.length} bytes).`);
  return { texto, fechaCorte: ts, origen: RATINGS.elo.url };
}

// --- Deteccion y validacion del export Elo (funcion pura) ------------------
// Devuelve { pares: [{name, elo}], meta }. Lanza error claro si el formato no
// es reconocible (verificacion en runtime, sin asumir layout).

export function extraerElo(texto, sep = '\t', rango = [800, 2300], filasMin = 100) {
  const filas = parseDelimitado(texto, sep);
  if (filas.length < filasMin) {
    throw new Error(
      `Export Elo con ${filas.length} filas (< ${filasMin} esperadas). ` +
      `Formato inesperado o archivo truncado: ME DETENGO sin asumir.`
    );
  }
  const nCols = Math.max(...filas.map((f) => f.length));
  const [lo, hi] = rango;

  // Por columna: nro de enteros en rango Elo, sus valores distintos, y texto no
  // numerico (candidato a nombre) con su diversidad.
  const numericoEnRango = new Array(nCols).fill(0);
  const distintosNum = Array.from({ length: nCols }, () => new Set());
  const textoNoNum = new Array(nCols).fill(0);
  const distintosTxt = Array.from({ length: nCols }, () => new Set());
  for (const f of filas) {
    for (let c = 0; c < nCols; c++) {
      const v = (f[c] ?? '').trim();
      if (v === '') continue;
      const num = Number(v);
      if (Number.isFinite(num) && Number.isInteger(num) && num >= lo && num <= hi) {
        numericoEnRango[c]++;
        distintosNum[c].add(num);
      } else if (!/^-?\d+(\.\d+)?$/.test(v)) {
        textoNoNum[c]++;
        distintosTxt[c].add(v.toLowerCase());
      }
    }
  }

  // Candidatas a Elo: columnas con >50% de enteros en rango.
  const candidatas = [];
  numericoEnRango.forEach((n, c) => { if (n >= filas.length * 0.5) candidatas.push(c); });
  if (candidatas.length === 0) {
    throw new Error(
      `No se detecto una columna de Elo plausible (valores en [${lo},${hi}]). ` +
      `El formato de eloratings.net pudo cambiar: REPORTO Y ME DETENGO.`
    );
  }
  // Elo varia mucho por equipo: elegimos la candidata con MAS valores distintos
  // (asi una columna constante en rango, p.ej. un anio, no se confunde con Elo).
  candidatas.sort((a, b) => distintosNum[b].size - distintosNum[a].size);
  const colElo = candidatas[0];
  if (distintosNum[colElo].size < filas.length * 0.3) {
    throw new Error(
      `La columna Elo candidata tiene muy pocos valores distintos (${distintosNum[colElo].size}). ` +
      `Formato inesperado: REPORTO Y ME DETENGO.`
    );
  }
  // Ambiguedad real: dos columnas igual de diversas dentro del rango.
  if (candidatas[1] !== undefined &&
      distintosNum[candidatas[1]].size > distintosNum[colElo].size * 0.8) {
    throw new Error(
      `Deteccion de columna Elo AMBIGUA (cols ${colElo} y ${candidatas[1]} igual de diversas). ` +
      `Me detengo para no elegir mal.`
    );
  }

  // Columna nombre = la de mas texto no numerico con buena diversidad.
  let colNom = -1, mejorNom = 0;
  textoNoNum.forEach((n, c) => {
    if (c === colElo) return;
    if (n > mejorNom && distintosTxt[c].size > filas.length * 0.5) { mejorNom = n; colNom = c; }
  });
  if (colNom < 0) {
    throw new Error('No se detecto columna de nombre de seleccion. REPORTO Y ME DETENGO.');
  }

  const pares = [];
  for (const f of filas) {
    const name = (f[colNom] ?? '').trim();
    const elo = Number((f[colElo] ?? '').trim());
    if (name && Number.isFinite(elo) && elo >= lo && elo <= hi) pares.push({ name, elo });
  }
  return { pares, meta: { colElo, colNom, filas: filas.length, detectados: pares.length } };
}

// --- Carga opcional del ranking FIFA (control) -----------------------------

// Carga el ranking FIFA y devuelve Map<team_id, points> casado contra el indice.
function cargarFifa(idx) {
  const ruta = path.join(PATHS.raw, `${RATINGS.fifa.cacheFile}.csv`);
  if (!fs.existsSync(ruta)) {
    warn(`Ranking FIFA no provisto (${ruta}). fifa_points quedara vacio (es fuente de control, opcional).`);
    return { porTeamId: new Map(), fechaCorte: RATINGS.fifa.fechaCorte };
  }
  const { headers, rows } = objetosDesdeDelimitado(fs.readFileSync(ruta, 'utf8'), ',');
  const colTeam = headers.find((h) => /team|seleccion|country|pais|name/i.test(h));
  const colPts = headers.find((h) => /point|puntos|pts|rating/i.test(h));
  const colDate = headers.find((h) => /date|fecha|corte/i.test(h));
  if (!colTeam || !colPts) {
    throw new Error(`fifa_ranking.csv sin columnas reconocibles de equipo/puntos (headers: ${headers.join(',')}).`);
  }
  const porTeamId = new Map();
  for (const r of rows) {
    const eq = casar(r[colTeam], idx);
    const pts = Number(r[colPts]);
    if (eq && Number.isFinite(pts)) porTeamId.set(eq.team_id, pts);
  }
  const fechaCorte = (colDate && rows[0]?.[colDate]) || RATINGS.fifa.fechaCorte;
  info(`Ranking FIFA cargado: ${porTeamId.size}/${idx.size} equipos casados (corte ${fechaCorte || 'sin fecha'}).`);
  return { porTeamId, fechaCorte };
}

// --- Imputacion percentil (funcion pura) -----------------------------------
// Percentil p (0-100) por nearest-rank sobre valores ascendentes.
export function percentil(valores, p) {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const idx = Math.min(orden.length - 1, Math.floor((p / 100) * (orden.length - 1)));
  return orden[idx];
}

// --- Orquestacion ----------------------------------------------------------

async function main() {
  info('=== FASE 2: ratings de fuerza (Elo + FIFA) ===');
  const teams = cargarTeams();
  const idx = indexarEquipos(teams);
  info(`Equipos canonicos cargados: ${teams.length}.`);

  // Elo
  const { texto, fechaCorte: eloCorte, origen } = await obtenerTextoElo();
  const { pares, meta } = extraerElo(texto, RATINGS.elo.sep, RATINGS.elo.rangoPlausible, RATINGS.elo.filasMinimas);
  info(`Elo detectado: ${meta.detectados} selecciones (col nombre=${meta.colNom}, col elo=${meta.colElo}). Origen: ${origen}.`);

  // Join Elo -> equipos canonicos
  const eloPorTeamId = new Map();
  let sinCasar = 0;
  for (const { name, elo } of pares) {
    const eq = casar(name, idx);
    if (eq) eloPorTeamId.set(eq.team_id, elo);
    else sinCasar++;
  }
  info(`Elo casado a ${eloPorTeamId.size}/${teams.length} selecciones del torneo (${sinCasar} filas Elo externas no participantes, ignoradas).`);

  // FIFA (control, opcional)
  const fifa = cargarFifa(idx);

  // Imputacion percentil DOCUMENTADA (MODELO.percentilImputacionElo) para sin-Elo
  const elosConocidos = [...eloPorTeamId.values()];
  const pImput = percentil(elosConocidos, MODELO.percentilImputacionElo);
  const filasSalida = teams.map((t) => {
    const tieneElo = eloPorTeamId.has(t.team_id);
    const elo = tieneElo ? eloPorTeamId.get(t.team_id) : pImput;
    const fifaPts = fifa.porTeamId.get(t.team_id);
    return {
      team_id: t.team_id,
      team: t.team,
      elo,
      fifa_points: Number.isFinite(fifaPts) ? fifaPts : '',
      fuente: tieneElo ? 'eloratings.net' : `imputado_p${MODELO.percentilImputacionElo}`,
      fecha_corte: eloCorte.slice(0, 10),
    };
  });

  const imputados = filasSalida.filter((r) => r.fuente.startsWith('imputado_'));
  if (imputados.length) {
    warn(`Selecciones SIN Elo (imputadas a p${MODELO.percentilImputacionElo}=${pImput}): ${imputados.map((r) => r.team).join(', ')}.`);
  }

  // Escritura
  fs.mkdirSync(PATHS.out, { recursive: true });
  const ruta = path.join(PATHS.out, 'ratings.csv');
  fs.writeFileSync(ruta, aCSV(filasSalida, [
    'team_id', 'team', 'elo', 'fifa_points', 'fuente', 'fecha_corte',
  ]));
  info(`Escrito ${ruta} (${filasSalida.length} filas; ${imputados.length} imputadas).`);
  info('=== FASE 2 completa ===');
}

const invocadoDirecto = import.meta.url === `file://${process.argv[1]}`;
if (invocadoDirecto) {
  main().catch((e) => {
    console.error(`\nRATINGS ABORTADO: ${e.message}\n`);
    process.exit(1);
  });
}
