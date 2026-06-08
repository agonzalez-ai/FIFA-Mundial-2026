# Pronóstico fase de grupos — Mundial FIFA 2026

Pipeline reproducible que **extrae** datos del Mundial 2026 (API-Football), los
**enriquece** con ratings de fuerza y **simula** la fase de grupos por Monte
Carlo para producir probabilidades de avance por selección.

> **Principio rector:** integridad de datos sobre velocidad. Nunca se inventa un
> dato; si una fuente no responde o cambió de formato, el pipeline **falla con un
> error claro y lo registra**, no rellena.

---

## Estado del proyecto (por fases)

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Extracción API-Football → CSVs normalizados | ✅ Implementada |
| 2 | Ratings de fuerza (Elo + ranking FIFA) | ✅ Implementada |
| 3 | Modelo de partido (Elo → xG → Poisson) | ⏳ Pendiente |
| 4 | Simulación Monte Carlo + desempates FIFA | ⏳ Pendiente |

Cada fase se revisa con el responsable **antes** de avanzar a la siguiente.

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
npm run ratings     # FASE 2: ratings de fuerza            (pendiente)
npm run simulate    # FASE 3+4: modelo + Monte Carlo       (pendiente)
```

**La corrida de extracción está separada de la del modelo.** `extract` es lo
único que consume cuota de API; `simulate` lee solo de disco (`data/raw`), así
que puedes re-correr el modelo sin volver a llamar la API.

### Presupuesto de API y caché

- Tier gratis = **100 requests/día**. La Fase 1 gasta **3 requests** (teams,
  standings, fixtures); el guard aborta si se superan **20** por corrida
  (`API.maxRequestsPorCorrida`).
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

Tres endpoints de API-Football v3 (`league=1`, `season=2026`):

| Endpoint | Para qué | Salida normalizada |
|----------|----------|--------------------|
| `teams` | 48 selecciones, IDs y nombres canónicos | `data/out/teams.csv` |
| `standings` | Estructura de los 12 grupos (equipo → grupo) | `data/out/groups.csv` |
| `fixtures` | Los 104 partidos | `data/out/fixtures.csv` |

**Tablas limpias:**

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

## Parámetros del modelo acordados (para Fases 2–4)

Todos viven en `src/config.js`. Se reproducen aquí para auditoría; las fórmulas
exactas se documentarán al implementar cada fase.

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
- **N = 50 000** iteraciones Monte Carlo.
- Desempates oficiales FIFA: el **orden vigente se verifica en runtime** y se
  documentará aquí antes de codificar — no se hardcodea de memoria.

---

## Reglas de integridad (innegociables)

1. Cada cifra del reporte es trazable a una fuente o a una fórmula con sus inputs.
2. Se loggea fecha/hora y endpoint de cada extracción.
3. Si `predictions`/`odds` de la API vienen vacíos, **no se usan**; se anotan y se dejan fuera.
4. El crudo se versiona para re-correr el modelo sin re-llamar la API.
