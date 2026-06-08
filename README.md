# Pronóstico fase de grupos — Mundial FIFA 2026

Pipeline reproducible que **extrae los resultados de las eliminatorias** del
Mundial 2026 (API-Football), **estima la fuerza de cada selección a partir de esos
partidos** (modelo Dixon-Coles, con ranking FIFA como ancla de comparabilidad entre
confederaciones) y **simula** la fase de grupos por Monte Carlo para producir
probabilidades de avance por selección.

> **Enfoque (corregido):** el pronóstico se construye desde los **resultados reales
> de la fase de calificación**, no desde un rating externo. La fuerza ataque/defensa
> de cada equipo se ajusta a los goles observados en las eliminatorias.

> **Principio rector:** integridad de datos sobre velocidad. Nunca se inventa un
> dato; si una fuente no responde o cambió de formato, el pipeline **falla con un
> error claro y lo registra**, no rellena.

---

## Estado del proyecto (por fases)

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Extracción: **resultados de eliminatorias** + estructura del torneo final | ✅ Implementada |
| 2 | Fuerza por selección: **Dixon-Coles** sobre resultados + ancla FIFA | 🔄 En desarrollo |
| 3 | Modelo de partido (fuerza → xG → Poisson) | ♻️ Se reaprovecha (cambia origen del xG) |
| 4 | Simulación Monte Carlo + desempates FIFA 2026 | ✅ Sin cambios |

Cada fase se revisa con el responsable **antes** de avanzar a la siguiente.

> **Nota:** el proyecto se reorientó. Originalmente la Fase 2 usaba Elo de
> eloratings.net; ahora la fuerza se **estima de los resultados de clasificación**.
> Las Fases 3–4 (Poisson, Monte Carlo, desempates) se reaprovechan: solo cambia de
> dónde sale el xG que las alimenta.

---

## Contexto verificado del torneo

- Copa Mundial FIFA 2026, 11 jun – 19 jul 2026.
- **48 equipos**, **12 grupos** (A–L) de 4, **104 partidos** (72 de fase de grupos).
- Avanzan: los **2 primeros** de cada grupo + los **8 mejores terceros** ⇒ 32 a dieciseisavos.
- Anfitriones: **USA, México, Canadá** (relevante para la ventaja de localía, ver Fase 3).

---

## Requisitos y configuración

- **Node.js ≥ 20** y `npm`. Única dependencia: `axios`.
- La **API key nunca se hardcodea**: se lee de `process.env.APIFOOTBALL_KEY`.

```bash
npm install
cp .env.example .env      # edita .env y pon tu APIFOOTBALL_KEY
```

Variables de entorno (ver `.env.example`):

| Variable | Descripción | Default |
|----------|-------------|---------|
| `APIFOOTBALL_KEY` | Clave de API-Football (obligatoria para extraer) | — |
| `APIFOOTBALL_AUTH_MODE` | `apisports` (header `x-apisports-key`) o `rapidapi` (`x-rapidapi-key`) | `apisports` |

> **Confirma el header en tu dashboard.** Acceso directo a API-Sports usa
> `x-apisports-key`; si entras vía RapidAPI usa `x-rapidapi-key`
> (`APIFOOTBALL_AUTH_MODE=rapidapi`).

---

## Uso

```bash
npm run extract     # FASE 1: llama la API y escribe data/raw + data/out CSVs
npm run ratings     # FASE 2: ratings de fuerza -> ratings.csv
npm run model       # FASE 3: match_probs.csv (analitico exacto)
npm run simulate    # FASE 3+4: match_probs + group_probs + reporte.md (Monte Carlo)
```

**La corrida de extracción está separada de la del modelo.** `extract` es lo
único que consume cuota de API; `simulate` lee solo de disco (`data/raw`), así
que puedes re-correr el modelo sin volver a llamar la API.

### Presupuesto de API y caché

- Tier gratis = **100 requests/día**. La Fase 1 gasta `1` (leagues) + una por cada
  eliminatoria/temporada del ciclo (~6–14) + `3` del torneo final; el guard aborta
  si se superan **45** por corrida (`API.maxRequestsPorCorrida`). Todo se cachea
  una sola vez.
- Todo crudo se cachea en `data/raw/<nombre>_<timestamp>.json` **+** un puntero
  `<nombre>_latest.json`, ambos versionados en git para reproducibilidad.
- Cada llamada se registra en `logs/extract.log` con fecha/hora, endpoint y
  resultado. Respuestas vacías (`results=0`) se **anotan** y no se rellenan.

---

## Estructura

```
src/
  config.js          # TODOS los parámetros del modelo, documentados
  lib/
    apiClient.js     # axios + auth + guard de rate-limit + logging
    cache.js         # crudo JSON con timestamp (data/raw)
    csv.js           # writer CSV minimalista (RFC 4180)
    logger.js        # bitácora a consola y logs/extract.log
  extract.js         # FASE 1
data/
  raw/               # cache crudo versionado (reproducibilidad)
  out/               # CSVs y reportes auditables
logs/
  extract.log        # bitácora de extracciones
```

---

## Fase 1 — Extracción (implementada)

Baja los **resultados de las eliminatorias** (base para estimar fuerzas) y la
**estructura del torneo final** (qué hay que pronosticar).

| Endpoint | Para qué | Salida normalizada |
|----------|----------|--------------------|
| `leagues?search=world cup` | **Resuelve en runtime** los `league id` de las eliminatorias por confederación (no se hardcodean) | — |
| `fixtures?league=<quali>&season=<y>` | Partidos de cada eliminatoria, con goles | `data/out/quali_results.csv` |
| `teams` (league=1) | 48 selecciones, IDs y nombres canónicos | `data/out/teams.csv` |
| `standings` (league=1) | Estructura de los 12 grupos (equipo → grupo) | `data/out/groups.csv` |
| `fixtures` (league=1) | Los 104 partidos del torneo | `data/out/fixtures.csv` |

- **Eliminatorias cubiertas:** UEFA, CONMEBOL, CAF, AFC, CONCACAF, OFC y repechaje
  intercontinental (configurables por patrón de nombre en `config.QUALIFIERS`). Si
  una confederación no se resuelve en `/leagues`, se **reporta y se omite** (no se
  inventa).
- **`quali_results.csv`** → `fixture_id, fecha, confederacion, league_id, season,
  round, home_id, home, away_id, away, goles_local, goles_visita, status`. Solo
  partidos **finalizados** (`FT/AET/PEN`) con marcador válido; los no jugados se
  excluyen (no se inventan resultados).

**Tablas limpias del torneo final:**

- `teams.csv` → `team_id, team, code, country`
- `groups.csv` → `group (A–L), team_id, team, rank_inicial`
- `fixtures.csv` → `fixture_id, fecha, round, group, home_id, home, away_id, away, venue_name, venue_city, status`
  - El `group` del partido se **deriva** del grupo de sus equipos (ambos comparten
    grupo en fase de grupos); queda vacío en rondas eliminatorias.

**Manejo de vacíos (advertencia del brief):** si `standings` aún no expone la
estructura de grupos, o si no llegan exactamente 48 equipos / 104 partidos, se
escribe lo recibido **sin rellenar** y se deja un `WARN` en el log.

---

## Fase 2 — Ratings de fuerza (implementada)

Produce `data/out/ratings.csv` → `team_id, team, elo, fifa_points, fuente, fecha_corte`.

### Fuente primaria: Elo (eloratings.net)
- URL del export: `https://www.eloratings.net/World.tsv` (configurable con
  `ELO_SOURCE_URL`). El export se **cachea** en `data/raw/elo_source_latest.tsv`
  (versionado, reproducible). Si el cache existe se usa; si no, se descarga.
- **Verificación de formato en runtime (no se asume layout):** el parser detecta
  la columna de Elo por sus valores —enteros en rango plausible `[800, 2300]` y
  con alta diversidad (el Elo varía por equipo; una columna constante como un año
  no se confunde)— y la columna de nombre por su texto. Si **no** encuentra una
  columna de Elo plausible, si hay **ambigüedad**, o si llegan **menos de 100
  filas**, el proceso **reporta y se detiene**. Nunca produce ratings a ciegas.

### Fuente de control: ranking FIFA (puntos)
- No hay endpoint libre limpio, así que se provee como archivo versionado
  `data/raw/fifa_ranking.csv` (columnas reconocibles tipo `team,points[,date]`).
  Fuente: *FIFA/Coca-Cola Men's World Ranking* (`fifa.com/ranking`); la **fecha de
  corte** se toma de la columna `date` del archivo o de `FIFA_FECHA_CORTE`.
- Es **control**, no entra al modelo. Si el archivo no está, `fifa_points` queda
  vacío y se anota en el log (no se inventa).

### Reconciliación de nombres
Las fuentes externas nombran países distinto a API-Football. Se normaliza
(minúsculas, sin acentos/puntuación) y se aplica un **mapa de alias documentado**
(`src/lib/names.js`): p.ej. *United States→USA*, *South Korea→Korea Republic*,
*Ivory Coast→Cote d'Ivoire*. Filas Elo que no corresponden a participantes se
ignoran (son selecciones fuera del torneo); equipos del torneo que no casan con
ningún Elo se **imputan** (ver abajo) y se listan en el log.

### Imputación de Elo faltante
Selecciones sin Elo (debutantes) → **percentil 5** (`MODELO.percentilImputacionElo`,
nearest-rank) de la distribución de Elo de los equipos que **sí** casaron. Se
marcan con `fuente = imputado_p5`. Nunca un número arbitrario silencioso.

> **Nota de entorno:** este sandbox de Claude Code on the web tiene una política
> de red que **solo permite GitHub** (`eloratings.net`, `api-sports.io` y
> `fifa.com` devuelven `host_not_allowed`). Por eso `extract` y la descarga de
> Elo deben correrse en tu máquina (o dejas el `World.tsv` / `fifa_ranking.csv`
> en `data/raw/`). El parser y el join están verificados con tests unitarios
> offline.

---

## Fase 3 — Modelo de partido (implementada)

`npm run model` lee `ratings.csv`, `fixtures.csv`, `teams.csv` y escribe
`data/out/match_probs.csv` de forma **analítica exacta** (no Monte Carlo) desde la
matriz de Poisson. Toda la matemática vive en `src/model.js` como **funciones puras**.

### Fórmula exacta (auditable número a número)

```
dr            = (Elo_local + HFA) − Elo_visita        # diferencial efectivo
We_local      = 1 / (1 + 10^(−dr/400))                # expectativa Elo (referencia)
sup           = β · (dr / 400)                         # supremacía esperada en goles
xG_local  (λ_L) = max(λ_min, λ₀ + sup/2)
xG_visita (λ_V) = max(λ_min, λ₀ − sup/2)
P(i,j)        = Poisson(i; λ_L) · Poisson(j; λ_V)      # marcador, equipos independientes
```

La matriz `P(i,j)` (0..10 goles por equipo) se **renormaliza a 1** (la cola
> 10 se reparte proporcionalmente). De ella salen `P(local)=Σ_{i>j}`,
`P(empate)=Σ_{i=j}`, `P(visita)=Σ_{i<j}` y el marcador más probable
(`argmax P(i,j)`). Esto da W/D/L y diferencia de goles para los desempates (Fase 4).

### Parámetros (en `src/config.js → MODELO`)

| Parámetro | Símbolo | Valor | Origen |
|-----------|---------|-------|--------|
| Goles base por equipo | `λ₀` | **1.35** | media histórica goles/equipo en fase de grupos de Mundiales |
| Escala Elo→goles | `β` | **1.40** | calibración inicial documentada (ajustable) |
| Ventaja local anfitrión | `HFA` | **+65 Elo** | estándar de eloratings.net; **0** en sede neutral |
| Piso de goles | `λ_min` | **0.15** | evita λ ≤ 0 en partidos muy disparejos |

**HFA por partido:** +65 solo si el equipo local es anfitrión (USA/México/Canadá).
*Caveat documentado:* `/fixtures` trae `venue.city` pero **no el país de la sede**;
se usa "local es anfitrión" como proxy (los anfitriones juegan sus partidos de
grupo en casa). Se refinará con un mapa sede→país en Fase 4 si hace falta.

### Reproducibilidad de la simulación
`src/lib/rng.js` ofrece un RNG **sembrable** (mulberry32) y `muestrearPoisson`
(método de Knuth). La Fase 4 los usará con semilla fija para que cada corrida
Monte Carlo sea re-ejecutable y auditable.

### Salida `match_probs.csv`
`fixture_id, group, home, away, hfa_elo, elo_home, elo_away, xg_home, xg_away,
p_local, p_empate, p_visita, marcador_prob`.

---

## Fase 4 — Simulación Monte Carlo (implementada)

`npm run simulate` lee **solo de disco** (cero llamadas a la API) y produce
`match_probs.csv`, `group_probs.csv` y `reporte.md`.

- **N = 50 000** iteraciones (override rápido para pruebas: `SIM_N=3000 npm run simulate`),
  **RNG sembrado** (`SIM.semilla`) → corridas reproducibles.
- Las λ de cada partido se **precomputan** una vez (deterministas dado Elo+HFA); cada
  iteración solo muestrea Poisson de los 72 partidos, arma las 12 tablas y rankea.
- **HFA por sede:** +65 Elo al equipo que juega en su país anfitrión usando el mapa
  sede→país (`src/lib/venues.js`, 16 sedes verificadas); −65 al rival si el anfitrión
  figura como visitante en su país; 0 en sede neutral.

### Desempates — orden oficial FIFA 2026 (**verificado en runtime**)

⚠️ **Cambio clave 2026:** el head-to-head se aplica **antes** que la diferencia de goles
global (al revés que en 2022). Verificado contra múltiples fuentes (FIFA, ESPN, Yahoo,
FourFourTwo, SofaScore) — ver "Fuentes". Implementado en `src/lib/standings.js`:

**Dentro del grupo** (equipos igualados en puntos):
1. Puntos head-to-head (solo partidos entre los empatados)
2. Diferencia de goles head-to-head
3. Goles a favor head-to-head
4. Diferencia de goles global
5. Goles a favor global
6. _Fair-play / conducta_ — **OMITIDO** (no se simulan tarjetas; no se inventan datos)
7. Ranking FIFA (puntos)
8. _Sorteo_ → azar sembrado (último recurso, **contabilizado y reportado**)

Los criterios 1–3 se **re-aplican** exclusivamente entre los equipos que sigan
empatados (recursión), tal como especifica el reglamento.

**Mejores terceros** (entre grupos, sin head-to-head): puntos → dif. goles → goles a
favor → _[fair-play omitido]_ → ranking FIFA → azar. Avanzan los **8** mejores.

### Salidas
- `group_probs.csv` → `group, team_id, team, p_1, p_2, p_top2, p_mejor_tercero, p_avanza, p_eliminado`
- `reporte.md` → tablas por grupo + supuestos + parámetros + fuentes + fechas de corte + uso de azar.

### Invariantes verificadas (tests)
Por grupo Σ`p_1`≈1 y Σ`p_top2`≈2; global Σ`p_avanza`≈32 y Σ`p_mejor_tercero`≈8;
identidades por fila `p_avanza = p_top2 + p_mejor_tercero`, `p_eliminado = 1 − p_avanza`.
Más tests del tiebreak: el ganador head-to-head queda por encima pese a peor dif. de
goles global (comportamiento 2026).

---

## Parámetros del modelo (resumen — todos en `src/config.js`)

Resumen de los parámetros libres, reproducidos aquí para auditoría rápida (el
detalle y las fórmulas están en las secciones de cada fase).

### Ventaja de localía (HFA) — **decisión tomada**
- Sede neutral (mayoría de partidos): **HFA = 0 Elo**.
- Anfitrión (USA/México/Canadá) jugando en su país: **HFA = +65 Elo**
  (valor estándar de ventaja de local de eloratings.net).

### Modelo de partido (Fase 3, propuesto)
- `λ₀ = 1.35` — goles esperados/equipo entre rivales de igual Elo (media histórica
  de fase de grupos de Mundiales).
- Diferencial: `dr = (Elo_local + HFA) − Elo_visita`.
- Supremacía esperada: `sup = β · (dr / 400)`, con `β = 1.40` (calibrable).
- `λ_local = max(0.15, λ₀ + sup/2)`, `λ_visita = max(0.15, λ₀ − sup/2)`.
- Marcador ~ **Poisson independiente** por equipo → W/D/L y diferencia de goles.

### Imputación de Elo faltante (Fase 2)
- Selecciones sin Elo (debutantes): **percentil 5** de la distribución de Elo de
  los 48 clasificados, marcado como `fuente = imputado_p5`. Nunca un número
  silencioso.

### Simulación (Fase 4)
- **N = 50 000** iteraciones Monte Carlo, RNG sembrado (`SIM.semilla`).
- Desempates oficiales FIFA 2026 verificados en runtime (ver sección Fase 4).

---

## Reglas de integridad (innegociables)

1. Cada cifra del reporte es trazable a una fuente o a una fórmula con sus inputs.
2. Se loggea fecha/hora y endpoint de cada extracción.
3. Si `predictions`/`odds` de la API vienen vacíos, **no se usan**; se anotan y se dejan fuera.
4. El crudo se versiona para re-correr el modelo sin re-llamar la API.
5. Datos no disponibles (p.ej. tarjetas para fair-play) se **omiten y documentan**, no se inventan.

---

## Fuentes y referencias

- **Datos del torneo:** API-Football v3 (API-Sports), `league=1, season=2026`.
- **Elo:** [eloratings.net](https://www.eloratings.net/) (World Football Elo).
- **Ranking FIFA:** FIFA/Coca-Cola Men's World Ranking ([fifa.com/ranking](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers)).
- **Desempates FIFA 2026 (head-to-head primero), verificados:**
  [FIFA](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers) ·
  [ESPN](https://www.espn.com/soccer/story/_/id/48703925/world-cup-group-stage-explained-tiebreakers-third-place-teams) ·
  [Yahoo Sports](https://sports.yahoo.com/articles/group-stage-tiebreaker-rules-2026-094000319.html) ·
  [FourFourTwo](https://www.fourfourtwo.com/competition/every-world-cup-2026-group-stage-tiebreaker-what-happens-if-teams-finish-with-the-same-points) ·
  [SofaScore](https://www.sofascore.com/news/__trashed-21).

> Fechas de corte concretas de Elo y ranking FIFA se registran por fila en
> `ratings.csv` y se reflejan en `reporte.md` en cada corrida real.
