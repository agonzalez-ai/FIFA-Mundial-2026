// config.js — Constantes del pipeline. TODO parametro libre del modelo vive aqui
// y se reproduce en el README para que cada cifra sea auditable.

// ---------------------------------------------------------------------------
// API-Football (API-Sports) v3
// ---------------------------------------------------------------------------
export const API = {
  baseURL: 'https://v3.football.api-sports.io',
  finalLeagueId: 1, // Mundial (torneo final) = league id 1
  season: 2026, // temporada del torneo final
  // Header de auth segun el modo. CONFIRMA en tu dashboard cual aplica:
  //  - 'apisports' (acceso directo): header x-apisports-key
  //  - 'rapidapi'  (via RapidAPI):   header x-rapidapi-key
  authMode: process.env.APIFOOTBALL_AUTH_MODE || 'apisports',
  // Presupuesto de requests por corrida. Tier gratis = 100/dia. Las eliminatorias
  // requieren mas calls que el torneo final (1 leagues + ~6-7 ligas x temporadas
  // del ciclo + 3 del torneo final); se cachea todo una sola vez.
  maxRequestsPorCorrida: 45,
};

// ---------------------------------------------------------------------------
// Eliminatorias del ciclo 2026, por confederacion. Los `league id` se RESUELVEN
// en runtime desde el endpoint /leagues por coincidencia de NOMBRE (no se
// hardcodean de memoria). Si un patron no casa, se reporta y se omite (no se
// inventan datos).
// ---------------------------------------------------------------------------
export const QUALIFIERS = [
  { confederacion: 'UEFA', patron: /world cup.*qualif.*europe/i },
  { confederacion: 'CONMEBOL', patron: /world cup.*qualif.*south america/i },
  { confederacion: 'CAF', patron: /world cup.*qualif.*africa/i },
  { confederacion: 'AFC', patron: /world cup.*qualif.*asia/i },
  { confederacion: 'CONCACAF', patron: /world cup.*qualif.*(concacaf|north america)/i },
  { confederacion: 'OFC', patron: /world cup.*qualif.*oceania/i },
  { confederacion: 'PLAYOFF', patron: /world cup.*qualif.*(intercontinental|play-?offs?)/i },
];
// Temporadas del ciclo a intentar; solo se bajan las que el endpoint /leagues
// reporte como existentes para cada liga (frugalidad de requests).
export const CICLO_SEASONS = [2023, 2024, 2025, 2026];
// Estados de partido considerados "jugado con marcador valido".
export const ESTADOS_FINALIZADO = ['FT', 'AET', 'PEN'];

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
  // Paises anfitriones: solo ellos reciben ventaja de local (en su pais).
  anfitriones: ['USA', 'Mexico', 'Canada'],
};

// La fuerza de partido (xG) ya NO usa Elo: se deriva del ajuste Dixon-Coles de la
// Fase 2 (ataque/defensa + base + ventaja de local h). Ver RATINGS.dc mas abajo.

// ---------------------------------------------------------------------------
// Parametros de la SIMULACION Monte Carlo (Fase 4)
// ---------------------------------------------------------------------------
export const SIM = {
  // N >= 50,000 (override opcional con SIM_N para corridas rapidas de prueba)
  iteraciones: Number(process.env.SIM_N) || 50000,
  semilla: 20260611, // RNG sembrado (fecha de apertura) -> corridas reproducibles
  maxGoles: 10, // truncado de la matriz de Poisson para match_probs analitico
  // Orden de desempates FIFA 2026 VERIFICADO en runtime (ver README "Desempates"):
  // h2h pts -> h2h dif -> h2h goles -> dif global -> goles global ->
  // [fair-play OMITIDO: sin datos de tarjetas] -> ranking FIFA -> azar (contabilizado).
};

// ---------------------------------------------------------------------------
// Fase 2 — Fuentes de RATINGS de fuerza
// ---------------------------------------------------------------------------
export const RATINGS = {
  // Archivo de resultados de eliminatorias (salida de Fase 1).
  resultsFile: 'quali_results.csv',
  // Parametros del ajuste Dixon-Coles (todos documentados en el README).
  dc: {
    vidaMediaDias: 730,  // ponderacion temporal: vida media 2 anios (xi = ln2/vidaMedia)
    eta: 0.1,            // peso del ancla FIFA (prior sobre r = ataque - defensa)
    sigma: 0.5,          // escala: target_net = z_fifa * sigma (unidades log-goles)
    ridge: 0.01,         // L2 suave sobre ataque/defensa (estabilidad numerica)
    lr: 0.05,            // tasa de aprendizaje del ascenso de gradiente
    iters: 5000,         // iteraciones de optimizacion
    rhoMax: 0.2,         // cota de |rho| (correccion Dixon-Coles)
    pesoAmistoso: 0.34,  // los amistosos pesan ~1/3 de un partido oficial
  },
  // Imputacion para finalistas sin partidos NI ancla FIFA (caso extremo): percentil
  // bajo del rating neto. Marcado como 'imputado_pX'. Nunca un numero silencioso.
  imputaPercentil: 5,
  fifa: {
    // Ranking FIFA (puntos). No hay endpoint libre limpio: se provee como archivo
    // versionado data/raw/fifa_ranking.csv (columnas team,points[,date]). Se usa como
    // ANCLA de comparabilidad entre confederaciones (prior documentado, no dato base).
    cacheFile: 'fifa_ranking',
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
