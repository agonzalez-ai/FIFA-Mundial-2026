# Reporte — Pronóstico fase de grupos, Mundial FIFA 2026

_Generado: 2026-06-08T21:33:35.331Z_

## Supuestos y parámetros del modelo

- **Iteraciones Monte Carlo:** 50,000 (RNG sembrado: 20260611, reproducible).
- **Partidos de fase de grupos simulados:** 72 / 72.
- **Fuerza:** modelo Poisson Dixon-Coles ajustado a los resultados de las eliminatorias (Fase 2).
- **Modelo de gol:** Poisson independiente por equipo: log λ_local = base + localía·h + ataque_local + defensa_visita; log λ_visita = base + ataque_visita + defensa_local.
- **Parámetros ajustados:** base=0.153, h (ventaja de local)=0.305, ρ (Dixon-Coles)=-0.041.
- **Ventaja de localía:** se aplica h solo al anfitrión (USA/México/Canadá) jugando en su país (mapa sede→país); 0 en sede neutral.

## Desempates aplicados (orden oficial FIFA 2026, verificado)

1. Puntos head-to-head (entre empatados) · 2. Dif. goles h2h · 3. Goles h2h
4. Dif. goles global · 5. Goles global · 6. _Fair-play (OMITIDO: sin datos de tarjetas)_ · 7. Ranking FIFA · 8. Sorteo→azar sembrado.
- **Empates resueltos por azar (último recurso):** 67394 en 50000 iteraciones.
- _Nota de integridad:_ el criterio de fair-play no se modela porque no se simulan tarjetas (no se inventan datos disciplinarios).

## Fuentes y fechas de corte

- **Resultados de eliminatorias / fixtures / grupos / equipos:** API-Football v3. Crudo versionado en `data/raw/`.
- **Fuerza (ataque/defensa):** ajuste Dixon-Coles sobre resultados de eliminatorias. Fecha de corte: 2026-06-07.
- **Ranking FIFA (ancla de comparabilidad + desempate):** FIFA/Coca-Cola Men's World Ranking (fifa.com/ranking). Corte: ver fifa_ranking.csv.

## Probabilidades de avance por grupo

P = probabilidad estimada (frecuencia en la simulación). "Avanza" = top-2 del grupo o mejor tercero.

### Grupo A

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Mexico | 41.1% | 27.2% | 68.3% | 14.2% | **82.5%** | 17.4% |
| South Korea | 26.0% | 27.4% | 53.4% | 17.4% | **70.8%** | 29.2% |
| Czech Republic | 17.3% | 23.0% | 40.3% | 17.7% | **58.0%** | 42.0% |
| South Africa | 15.5% | 22.5% | 38.0% | 17.8% | **55.8%** | 44.2% |

### Grupo B

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Canada | 45.1% | 30.0% | 75.1% | 12.7% | **87.8%** | 12.2% |
| Switzerland | 35.2% | 32.4% | 67.5% | 15.0% | **82.5%** | 17.5% |
| Qatar | 10.3% | 19.3% | 29.6% | 18.1% | **47.7%** | 52.3% |
| Bosnia and Herzegovina | 9.4% | 18.3% | 27.8% | 18.0% | **45.8%** | 54.2% |

### Grupo C

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Argentina | 36.0% | 28.2% | 64.2% | 15.6% | **79.9%** | 20.1% |
| Algeria | 29.7% | 27.8% | 57.5% | 17.3% | **74.8%** | 25.2% |
| Austria | 22.7% | 25.9% | 48.6% | 18.2% | **66.8%** | 33.1% |
| Jordan | 11.5% | 18.1% | 29.6% | 16.4% | **46.0%** | 54.0% |

### Grupo D

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| United States | 33.3% | 26.0% | 59.3% | 15.9% | **75.2%** | 24.8% |
| Australia | 29.1% | 27.1% | 56.3% | 16.9% | **73.1%** | 26.9% |
| Turkey | 21.7% | 25.0% | 46.8% | 17.3% | **64.1%** | 35.9% |
| Paraguay | 15.9% | 21.8% | 37.7% | 17.9% | **55.6%** | 44.4% |

### Grupo E

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Belgium | 32.4% | 26.9% | 59.3% | 16.1% | **75.4%** | 24.6% |
| Iran | 30.0% | 26.7% | 56.7% | 16.4% | **73.2%** | 26.9% |
| Egypt | 20.5% | 23.9% | 44.4% | 18.1% | **62.5%** | 37.5% |
| New Zealand | 17.1% | 22.5% | 39.6% | 17.1% | **56.7%** | 43.3% |

### Grupo F

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Morocco | 44.7% | 27.3% | 72.0% | 13.4% | **85.4%** | 14.6% |
| Brazil | 24.5% | 27.9% | 52.4% | 17.8% | **70.2%** | 29.8% |
| Haiti | 17.5% | 24.3% | 41.8% | 18.2% | **60.0%** | 40.0% |
| Scotland | 13.2% | 20.5% | 33.7% | 17.6% | **51.3%** | 48.7% |

### Grupo G

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Spain | 51.4% | 25.4% | 76.8% | 11.4% | **88.2%** | 11.8% |
| Uruguay | 21.8% | 29.0% | 50.8% | 17.5% | **68.4%** | 31.6% |
| Saudi Arabia | 14.1% | 23.7% | 37.9% | 17.9% | **55.7%** | 44.3% |
| Cape Verde | 12.7% | 21.8% | 34.5% | 16.9% | **51.4%** | 48.6% |

### Grupo H

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Portugal | 33.4% | 26.6% | 60.0% | 15.5% | **75.5%** | 24.5% |
| Colombia | 29.9% | 26.3% | 56.2% | 16.3% | **72.5%** | 27.5% |
| DR Congo | 19.6% | 24.3% | 43.9% | 17.5% | **61.4%** | 38.6% |
| Uzbekistan | 17.1% | 22.8% | 39.9% | 17.4% | **57.3%** | 42.7% |

### Grupo I

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| England | 39.7% | 28.0% | 67.6% | 14.7% | **82.3%** | 17.6% |
| Croatia | 27.7% | 28.1% | 55.7% | 16.7% | **72.4%** | 27.6% |
| Panama | 18.4% | 23.6% | 42.0% | 18.4% | **60.3%** | 39.7% |
| Ghana | 14.3% | 20.4% | 34.7% | 17.3% | **52.0%** | 48.0% |

### Grupo J

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Germany | 32.9% | 26.8% | 59.7% | 15.9% | **75.6%** | 24.4% |
| Ivory Coast | 29.8% | 27.3% | 57.1% | 16.7% | **73.7%** | 26.3% |
| Ecuador | 22.4% | 25.7% | 48.1% | 18.3% | **66.4%** | 33.6% |
| Curaçao | 14.9% | 20.3% | 35.2% | 16.8% | **52.0%** | 48.0% |

### Grupo K

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Senegal | 32.6% | 27.6% | 60.2% | 16.1% | **76.3%** | 23.7% |
| Norway | 27.6% | 26.7% | 54.2% | 17.1% | **71.4%** | 28.6% |
| France | 27.6% | 26.7% | 54.3% | 16.9% | **71.2%** | 28.8% |
| Iraq | 12.2% | 19.0% | 31.3% | 17.1% | **48.4%** | 51.6% |

### Grupo L

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Japan | 45.8% | 27.7% | 73.5% | 13.2% | **86.7%** | 13.3% |
| Netherlands | 28.0% | 29.8% | 57.8% | 17.2% | **75.0%** | 25.0% |
| Tunisia | 15.8% | 24.1% | 40.0% | 19.4% | **59.4%** | 40.6% |
| Sweden | 10.3% | 18.4% | 28.7% | 16.3% | **45.1%** | 54.9% |

