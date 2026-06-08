// config.js — Constantes del pipeline. TODO parametro libre del modelo vive aqui
// y se reproduce en el README para que cada cifra sea auditable.

// ---------------------------------------------------------------------------
// API-Football (API-Sports) v3
// ---------------------------------------------------------------------------
export const API = {
  baseURL: 'https://v3.football.api-sports.io',
  leagueId: 1, // Mundial = league id 1
  season: 2026, // temporada 2026
  // Header de auth segun el modo. CONFIRMA en tu dashboard cual aplica:
  //  - 'apisports' (acceso directo): header x-apisports-key
  //  - 'rapidapi'  (via RapidAPI):   header x-rapidapi-key
  authMode: process.env.APIFOOTBALL_AUTH_MODE || 'apisports',
  // Presupuesto de requests por corrida. Tier gratis = 100/dia; objetivo < 20.
  maxRequestsPorCorrida: 20,
};

// ---------------------------------------------------------------------------
// Estructura verificada del torneo (no re-descubrir en runtime)
// ---------------------------------------------------------------------------
export const TORNEO = {
  equipos: 48,
  grupos: 12, // A..L
  equiposPorGrupo: 4,
  partidosTotales: 104,
  partidosFaseGrupos: 72,
  // Avanzan: 2 primeros de cada grupo (24) + 8 mejores terceros = 32.
  avanzanPorGrupo: 2,
  mejoresTerceros: 8,
  // Paises anfitriones (para la ventaja de localia, ver MODELO.hfaEloAnfitrion).
  anfitriones: ['USA', 'Mexico', 'Canada'],
};

// ---------------------------------------------------------------------------
// Parametros del MODELO de partido (Fase 3). Fuentes documentadas en README.
// ---------------------------------------------------------------------------
export const MODELO = {
  // Goles esperados por equipo en un partido entre rivales de igual Elo.
  // ~1.35 = media historica de goles/equipo en fase de grupos de Mundiales.
  lambda0: 1.35,

  // Escala que convierte el diferencial de Elo normalizado (dr/400) en
  // supremacia esperada de goles. Valor inicial 1.40 (calibrable).
  beta: 1.40,

  // Ventaja de localia EN PUNTOS ELO. Decision del usuario:
  //  - Sede neutral (la mayoria de partidos): 0.
  //  - Anfitrion (USA/Mexico/Canada) jugando en su propio pais: +65.
  // 65 es el valor estandar de ventaja de local de eloratings.net.
  hfaEloAnfitrion: 65,
  hfaEloNeutral: 0,

  // Piso de goles esperados para evitar lambdas <= 0 en partidos muy disparejos.
  lambdaMin: 0.15,

  // Imputacion de Elo para selecciones sin dato (debutantes): percentil 5
  // de la distribucion de Elo de los 48 clasificados. Marcado como 'imputado_p5'.
  percentilImputacionElo: 5,
};

// ---------------------------------------------------------------------------
// Parametros de la SIMULACION Monte Carlo (Fase 4)
// ---------------------------------------------------------------------------
export const SIM = {
  iteraciones: 50000, // N >= 50,000
  // El orden EXACTO de desempates FIFA se verifica en runtime y se documenta
  // en el README antes de codificar la Fase 4 (no se hardcodea de memoria).
};

// ---------------------------------------------------------------------------
// Fase 2 — Fuentes de RATINGS de fuerza
// ---------------------------------------------------------------------------
// Integridad: el formato de la fuente Elo se VERIFICA en runtime. El parser
// valida lo que efectivamente llega (Elo numerico en rango plausible, equipo no
// vacio, conteo de filas razonable) y si no cuadra REPORTA Y SE DETIENE; nunca
// asume un layout de columnas a ciegas.
export const RATINGS = {
  elo: {
    // Fuente primaria: eloratings.net (World Football Elo).
    // URL del export. Confirma el formato vigente en tu dashboard/navegador.
    url: process.env.ELO_SOURCE_URL || 'https://www.eloratings.net/World.tsv',
    // Cache local versionado. Si existe, se usa (reproducible y funciona sin red).
    // Para refrescar: borra el archivo y corre con red, o descarga el TSV a mano.
    cacheFile: 'elo_source', // -> data/raw/elo_source_latest.json + .tsv crudo
    sep: '\t',
    // Rango plausible de Elo de selecciones (para validar que la columna correcta
    // se detecto). Fuera de esto => formato cambiado => detener.
    rangoPlausible: [800, 2300],
    // Conteo minimo de filas para considerar el export integro.
    filasMinimas: 100,
  },
  fifa: {
    // Ranking FIFA (puntos). No hay endpoint libre limpio: se provee como archivo
    // versionado data/raw/fifa_ranking.csv con columnas team,points y se DOCUMENTA
    // la fuente y la fecha de corte. Es fuente de CONTROL, no entra al modelo.
    cacheFile: 'fifa_ranking', // -> data/raw/fifa_ranking.csv (provisto por el usuario)
    // Fecha de corte del ranking FIFA usado. Se rellena al cargar el archivo o aqui.
    fechaCorte: process.env.FIFA_FECHA_CORTE || '',
    fuente: 'FIFA/Coca-Cola Men\'s World Ranking (fifa.com/ranking)',
  },
};

// ---------------------------------------------------------------------------
// Rutas del proyecto
// ---------------------------------------------------------------------------
export const PATHS = {
  raw: 'data/raw', // cache crudo versionado
  out: 'data/out', // resultados del modelo
  logs: 'logs', // bitacora de extracciones
};
