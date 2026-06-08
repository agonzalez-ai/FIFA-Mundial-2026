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
| 2 | Fuerza por selección: **Dixon-Coles** sobre resultados + ancla FIFA | ✅ Implementada |
| 3 | Modelo de partido (fuerza → xG → Poisson) | ✅ Implementada (xG desde Dixon-Coles) |
| 4 | Simulación Monte Carlo + desempates FIFA 2026 | ✅ Implementada |

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
npm run extract     # FASE 1 (API-Football): resultados de eliminatorias + torneo final
npm run ingest      # FASE 1 alterna (GitHub): construye los CSV desde un dataset publico
npm run ratings     # FASE 2: fuerza Dixon-Coles -> ratings.csv + dc_params.json
npm run model       # FASE 3: match_probs.csv (analitico exacto)
npm run simulate    # FASE 3+4: match_probs + group_probs + reporte.md (Monte Carlo)
```

### Dos rutas de ingesta de datos
- **`extract`** (preferida si tienes API key y red a API-Football): baja resultados de
  eliminatorias por confederación + estructura del torneo final.
- **`ingest`** (la usada para el pronóstico de este repo): construye los mismos CSV
  desde el dataset público **martj42/international_results** (GitHub), que ya incluye
  los 72 partidos del Mundial 2026 con sedes y miles de partidos internacionales
  jugados. Cruda versionada en `data/raw/intl_results_<fecha>.csv`. Útil cuando el
  entorno solo permite GitHub. Fuerza estimada de **partidos reales** (eliminatorias +
  amistosos + Nations League, ventana 2023–2026); el grafo queda **conectado**, así que
  la comparabilidad entre confederaciones sale de partidos reales (sin ancla FIFA).

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

## Fase 2 — Fuerza por selección: Dixon-Coles sobre resultados (implementada)

`npm run ratings` ajusta un modelo Poisson **Dixon-Coles** a los goles observados en
`quali_results.csv` y produce:
- `data/out/ratings.csv` → `team_id, team, confederacion, ataque, defensa, net, n_partidos, fifa_points, fuente, fecha_corte`
- `data/out/dc_params.json` → `{ base, h, rho, ... }` (parámetros globales que usan las Fases 3–4).

### Modelo (en `src/lib/dixoncoles.js`)
```
log λ_local  = base + h + ataque_i + defensa_j      # i local, j visitante
log λ_visita = base     + ataque_j + defensa_i
```
- `ataque_t` = tendencia goleadora; `defensa_t` = debilidad defensiva (mayor ⇒ le marcan más).
- `h` = ventaja de local **estimada de los datos** (no un supuesto). `base` = nivel de goles.
- Identificabilidad: `media(ataque)=media(defensa)=0`.
- **Corrección Dixon-Coles** `τ(x,y;λ,μ,ρ)` para marcadores bajos (0/1), parámetro `ρ`.
- **Ponderación temporal:** cada partido pesa `exp(−ξ·Δt)` con vida media `vidaMediaDias` (def. 730 d).
- Ajuste por **ascenso de gradiente** con gradientes analíticos (incluida `τ`). Node puro, sin libs.

### Ancla de comparabilidad entre confederaciones (clave)
Las eliminatorias son casi todas **intra-confederación**, así que el nivel relativo
entre confederaciones es una **dirección plana** de la verosimilitud (no identificable
solo con resultados). Se añade un **prior por equipo** sobre el rating neto
`r = ataque − defensa`, atraído al valor implicado por el **ranking FIFA**
(`z-score · sigma`, peso `eta`). Esto fija ese nivel. Es un **prior documentado**, no
el dato principal. Los **anfitriones** (USA/México/Canadá, sin eliminatorias) toman su
nivel **solo del ancla** → `fuente = ancla_fifa`.

### Parámetros (`config.RATINGS.dc`)
| Param | Símbolo | Default | Rol |
|---|---|---|---|
| `vidaMediaDias` | (ξ=ln2/vm) | 730 | peso temporal (recientes pesan más) |
| `eta` | η | 0.10 | peso del ancla FIFA |
| `sigma` | σ | 0.50 | escala `target_net = z_fifa·σ` |
| `ridge` | — | 0.01 | L2 suave sobre ataque/defensa |
| `rhoMax` | — | 0.20 | cota de la corrección DC |

### Ranking FIFA (ancla)
Archivo versionado `data/raw/fifa_ranking.csv` (`team,points[,date]`), casado por nombre
a `team_id` (`src/lib/names.js`, con alias documentado). Si no se provee, se **avisa**:
sin ancla no quedan calibrados ni el nivel entre confederaciones ni los anfitriones.

### Imputación (caso extremo)
Finalista **sin partidos ni FIFA** → `net` = percentil bajo (`imputaPercentil`, def. 5) de
los netos con datos, marcado `fuente = imputado_pX` y reportado. Nunca un número silencioso.

### Verificación (tests offline, sin red)
El estimador recupera fuerzas conocidas (correlación >0.9), recupera `h` y `base`, el
**ancla fija el nivel** entre dos confederaciones desconectadas, y un equipo **sin
partidos toma su nivel del ancla**. Integración completa validada con eliminatorias
sintéticas + anfitrión sin partidos.

> **Nota de entorno:** este sandbox solo permite GitHub. Por eso `extract` (API) y el
> `fifa_ranking.csv` se preparan en tu máquina; el ajuste Dixon-Coles corre offline
> sobre los CSV en `data/`.

---

## Fase 3 — Modelo de partido (implementada)

`npm run model` lee `ratings.csv` + `dc_params.json` (Fase 2), `fixtures.csv` y
`teams.csv`, y escribe `data/out/match_probs.csv` de forma **analítica exacta** (no
Monte Carlo) desde la matriz de Poisson. La matemática vive en `src/model.js` como
**funciones puras**; el xG sale del ajuste Dixon-Coles, **no de un Elo**.

### Fórmula exacta (auditable número a número)

```
xG_local  (λ_L) = exp(base + localía·h + ataque_local  + defensa_visita)
xG_visita (λ_V) = exp(base             + ataque_visita + defensa_local)
P(i,j)          = Poisson(i; λ_L) · Poisson(j; λ_V)   # marcador, equipos independientes
```
- `base`, `h` (ventaja de local) y `ataque/defensa` por equipo vienen del ajuste de
  la **Fase 2** (`dc_params.json` + `ratings.csv`).
- **`localía` ∈ {+1, 0, −1}**: +1 si el local es anfitrión jugando en su país, −1 si
  lo es el visitante, 0 en sede neutral (mapa sede→país de `src/lib/venues.js`, con
  las 16 sedes verificadas). En el Mundial casi todo es neutral.

La matriz `P(i,j)` (0..10 goles) se **renormaliza a 1** (la cola > 10 se reparte
proporcionalmente). De ella salen `P(local)=Σ_{i>j}`, `P(empate)=Σ_{i=j}`,
`P(visita)=Σ_{i<j}` y el marcador modal (`argmax P(i,j)`). Esto da W/D/L y diferencia
de goles para los desempates (Fase 4).

### Reproducibilidad de la simulación
`src/lib/rng.js` ofrece un RNG **sembrable** (mulberry32) y `muestrearPoisson`
(método de Knuth), que la Fase 4 usa con semilla fija.

### Salida `match_probs.csv`
`fixture_id, group, home, away, localia, xg_home, xg_away, p_local, p_empate,
p_visita, marcador_prob`.

---

## Fase 4 — Simulación Monte Carlo (implementada)

`npm run simulate` lee **solo de disco** (cero llamadas a la API) y produce
`match_probs.csv`, `group_probs.csv` y `reporte.md`.

- **N = 50 000** iteraciones (override rápido para pruebas: `SIM_N=3000 npm run simulate`),
  **RNG sembrado** (`SIM.semilla`) → corridas reproducibles.
- Las λ de cada partido se **precomputan** una vez (deterministas dada la fuerza +
  localía); cada iteración solo muestrea Poisson de los 72 partidos, arma las 12
  tablas y rankea.
- **Localía por sede:** se aplica la ventaja de local `h` (estimada en Fase 2) al
  equipo que juega en su país anfitrión usando el mapa sede→país (`src/lib/venues.js`,
  16 sedes verificadas); 0 en sede neutral.

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

### Fuerza y modelo de partido (Fases 2–3)
- Fuerza `ataque/defensa` por equipo + `base` + `h` ajustados por **Dixon-Coles** a
  los resultados de eliminatorias (`config.RATINGS.dc`; ver Fase 2).
- `log λ_local = base + localía·h + ataque_local + defensa_visita` (Fase 3).
- Marcador ~ **Poisson independiente** por equipo → W/D/L y diferencia de goles.

### Ventaja de localía — **decisión tomada**
- Sede neutral (mayoría de partidos): **localía = 0** (sin ventaja).
- Anfitrión (USA/México/Canadá) en su país: se aplica la **`h` estimada** de los datos.

### Ancla e imputación (Fase 2)
- Ancla FIFA (prior sobre `net`) para comparabilidad entre confederaciones.
- Finalista sin partidos ni FIFA: `net` por **percentil bajo**, marcado
  `fuente = imputado_pX`. Nunca un número silencioso.

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

- **Resultados de eliminatorias + torneo final:** API-Football v3 (API-Sports).
- **Fuerza:** ajuste Dixon-Coles propio sobre esos resultados (no hay fuente externa de rating).
- **Ranking FIFA (ancla):** FIFA/Coca-Cola Men's World Ranking ([fifa.com/ranking](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers)).
- **Desempates FIFA 2026 (head-to-head primero), verificados:**
  [FIFA](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers) ·
  [ESPN](https://www.espn.com/soccer/story/_/id/48703925/world-cup-group-stage-explained-tiebreakers-third-place-teams) ·
  [Yahoo Sports](https://sports.yahoo.com/articles/group-stage-tiebreaker-rules-2026-094000319.html) ·
  [FourFourTwo](https://www.fourfourtwo.com/competition/every-world-cup-2026-group-stage-tiebreaker-what-happens-if-teams-finish-with-the-same-points) ·
  [SofaScore](https://www.sofascore.com/news/__trashed-21).

> Fechas de corte (último partido de eliminatoria usado y ranking FIFA) se registran
> en `ratings.csv` / `dc_params.json` y se reflejan en `reporte.md` en cada corrida real.
