# Reporte — Pronóstico Mundial FIFA 2026 (grupos + eliminatoria)

_Generado: 2026-06-08T22:48:52.565Z_

## Supuestos y parámetros del modelo

- **Iteraciones Monte Carlo:** 50,000 (RNG sembrado: 20260611, reproducible).
- **Partidos de fase de grupos simulados:** 72 / 72.
- **Fuerza:** modelo Poisson Dixon-Coles ajustado a los resultados de las eliminatorias (Fase 2).
- **Modelo de gol:** Poisson independiente por equipo: log λ_local = base + localía·h + ataque_local + defensa_visita; log λ_visita = base + ataque_visita + defensa_local.
- **Parámetros ajustados:** base=0.173, h (ventaja de local)=0.280, ρ (Dixon-Coles)=-0.030.
- **Ventaja de localía:** se aplica h solo al anfitrión (USA/México/Canadá) jugando en su país (mapa sede→país); 0 en sede neutral.

## Desempates aplicados (orden oficial FIFA 2026, verificado)

1. Puntos head-to-head (entre empatados) · 2. Dif. goles h2h · 3. Goles h2h
4. Dif. goles global · 5. Goles global · 6. _Fair-play (OMITIDO: sin datos de tarjetas)_ · 7. Ranking FIFA · 8. Sorteo→azar sembrado.
- **Empates resueltos por azar (último recurso):** 0 en 50000 iteraciones.
- _Nota de integridad:_ el criterio de fair-play no se modela porque no se simulan tarjetas (no se inventan datos disciplinarios).

## Fuentes y fechas de corte

- **Resultados de eliminatorias / fixtures / grupos / equipos:** API-Football v3. Crudo versionado en `data/raw/`.
- **Fuerza (ataque/defensa):** ajuste Dixon-Coles sobre resultados de eliminatorias. Fecha de corte: 2026-06-07.
- **Ranking FIFA (ancla de comparabilidad + desempate):** FIFA/Coca-Cola Men's World Ranking (fifa.com/ranking). Corte: ver fifa_ranking.csv.

## 🏆 Pronóstico del torneo (fase de eliminación)

> **Cuadro aproximado:** se usa la estructura publicada del formato 2026 (R32: 8 ganador-vs-3º, 4 ganador-vs-2º, 4 segundo-vs-2º; sin reencuentros de grupo) con árbol simétrico. **No** es la asignación exacta Annex C de FIFA (495 escenarios para ubicar a los 8 mejores terceros); impacto bajo en P(campeón), moderado en subcampeón/3º. Partidos a sede neutral; empates a penales = 50/50.

### 🥇 Campeón más probable: **Argentina** (8.1%)

**Los 3 con mayor probabilidad de subir al podio (top-3):**
1. Argentina — 19.0%
2. Spain — 18.5%
3. France — 18.1%

_(El Mundial es muy abierto con 48 equipos: hasta el favorito ronda ~8% de título. Para un 1º-2º-3º concreto y distinto, ver el "torneo representativo" abajo.)_

### Probabilidades por equipo (top 12 por título)

| Equipo | Semis | Final | 🏆 Campeón | Podio (top-3) |
|---|--:|--:|--:|--:|
| Argentina | 22.4% | 13.8% | **8.1%** | 19.0% |
| France | 21.4% | 13.1% | **7.8%** | 18.1% |
| Spain | 21.9% | 13.5% | **7.7%** | 18.5% |
| England | 19.0% | 11.0% | **6.4%** | 15.9% |
| Belgium | 18.6% | 9.8% | **5.4%** | 14.7% |
| Portugal | 15.3% | 8.6% | **4.7%** | 12.5% |
| Netherlands | 15.4% | 8.5% | **4.6%** | 12.4% |
| Brazil | 15.0% | 8.2% | **4.4%** | 12.1% |
| Colombia | 14.0% | 7.5% | **3.9%** | 11.0% |
| Germany | 12.3% | 6.5% | **3.2%** | 9.6% |
| Croatia | 12.4% | 6.4% | **3.2%** | 9.6% |
| Uruguay | 11.9% | 6.0% | **3.0%** | 9.1% |

### Un torneo representativo (una simulación, marcadores concretos)

_Una de las formas en que podría desarrollarse (semilla fija). Otra semilla da otro desenlace válido._

**Semifinales:**
- Mexico 2-0 Ghana → Mexico
- Haiti 0-3 Netherlands → Netherlands

**3er lugar:** Ghana 2-1 Haiti → Ghana

**Final:** Mexico 0-2 Netherlands → CAMPEON Netherlands

Podio de esta simulación: 🥇 Netherlands · 🥈 Mexico · 🥉 Ghana.

## Probabilidades de avance por grupo

P = probabilidad estimada (frecuencia en la simulación). "Avanza" = top-2 del grupo o mejor tercero.

### Grupo A

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Mexico | 48.0% | 27.0% | 74.9% | 12.5% | **87.4%** | 12.6% |
| South Korea | 23.8% | 28.7% | 52.5% | 17.8% | **70.3%** | 29.7% |
| Czech Republic | 15.8% | 23.4% | 39.3% | 18.7% | **58.0%** | 42.0% |
| South Africa | 12.4% | 20.9% | 33.3% | 18.0% | **51.3%** | 48.7% |

### Grupo B

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Canada | 37.6% | 29.3% | 66.9% | 15.2% | **82.2%** | 17.8% |
| Switzerland | 34.7% | 29.4% | 64.0% | 16.0% | **80.0%** | 20.0% |
| Qatar | 17.6% | 23.7% | 41.3% | 19.7% | **61.0%** | 39.0% |
| Bosnia and Herzegovina | 10.1% | 17.6% | 27.7% | 16.9% | **44.6%** | 55.4% |

### Grupo C

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Argentina | 53.5% | 26.2% | 79.7% | 11.1% | **90.8%** | 9.2% |
| Austria | 21.4% | 30.2% | 51.5% | 18.4% | **69.9%** | 30.1% |
| Algeria | 15.4% | 25.1% | 40.5% | 19.3% | **59.8%** | 40.2% |
| Jordan | 9.7% | 18.6% | 28.2% | 17.3% | **45.6%** | 54.4% |

### Grupo D

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| United States | 47.9% | 25.9% | 73.9% | 12.5% | **86.4%** | 13.6% |
| Australia | 20.5% | 27.0% | 47.6% | 17.9% | **65.4%** | 34.6% |
| Turkey | 19.6% | 26.3% | 45.9% | 18.4% | **64.3%** | 35.7% |
| Paraguay | 11.9% | 20.7% | 32.7% | 17.9% | **50.6%** | 49.4% |

### Grupo E

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Belgium | 46.2% | 27.9% | 74.1% | 13.8% | **87.9%** | 12.1% |
| Iran | 28.4% | 31.2% | 59.6% | 17.7% | **77.3%** | 22.7% |
| Egypt | 18.5% | 26.9% | 45.4% | 21.1% | **66.6%** | 33.4% |
| New Zealand | 6.9% | 14.0% | 20.9% | 14.6% | **35.5%** | 64.5% |

### Grupo F

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Brazil | 43.3% | 29.8% | 73.1% | 14.1% | **87.2%** | 12.8% |
| Morocco | 34.0% | 31.9% | 66.0% | 16.3% | **82.2%** | 17.8% |
| Scotland | 15.3% | 23.8% | 39.1% | 21.0% | **60.1%** | 39.9% |
| Haiti | 7.3% | 14.5% | 21.9% | 15.6% | **37.5%** | 62.5% |

### Grupo G

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Spain | 51.7% | 26.6% | 78.3% | 11.3% | **89.6%** | 10.4% |
| Uruguay | 28.1% | 33.3% | 61.4% | 16.6% | **77.9%** | 22.1% |
| Saudi Arabia | 11.3% | 21.3% | 32.6% | 18.6% | **51.2%** | 48.8% |
| Cape Verde | 9.0% | 18.8% | 27.8% | 17.2% | **45.1%** | 54.9% |

### Grupo H

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Portugal | 40.8% | 28.8% | 69.6% | 13.9% | **83.5%** | 16.5% |
| Colombia | 35.9% | 30.1% | 66.0% | 15.2% | **81.2%** | 18.8% |
| DR Congo | 11.7% | 20.6% | 32.3% | 17.8% | **50.1%** | 49.9% |
| Uzbekistan | 11.5% | 20.5% | 32.0% | 18.0% | **50.0%** | 50.0% |

### Grupo I

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| England | 45.1% | 28.7% | 73.9% | 13.4% | **87.3%** | 12.8% |
| Croatia | 30.8% | 31.2% | 61.9% | 16.9% | **78.8%** | 21.2% |
| Panama | 15.4% | 23.5% | 38.9% | 19.8% | **58.7%** | 41.3% |
| Ghana | 8.7% | 16.6% | 25.3% | 16.6% | **41.9%** | 58.1% |

### Grupo J

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Germany | 45.1% | 26.7% | 71.8% | 13.9% | **85.7%** | 14.3% |
| Ecuador | 23.0% | 29.0% | 52.0% | 18.8% | **70.8%** | 29.2% |
| Ivory Coast | 22.6% | 28.0% | 50.6% | 19.0% | **69.6%** | 30.4% |
| Curaçao | 9.3% | 16.3% | 25.5% | 15.3% | **40.8%** | 59.2% |

### Grupo K

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| France | 50.1% | 26.7% | 76.9% | 11.9% | **88.7%** | 11.3% |
| Senegal | 23.7% | 30.0% | 53.7% | 18.2% | **71.9%** | 28.1% |
| Norway | 15.0% | 22.9% | 37.8% | 18.4% | **56.2%** | 43.8% |
| Iraq | 11.2% | 20.4% | 31.6% | 18.7% | **50.2%** | 49.8% |

### Grupo L

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Netherlands | 39.9% | 27.6% | 67.5% | 14.7% | **82.2%** | 17.8% |
| Japan | 28.5% | 27.7% | 56.2% | 17.1% | **73.3%** | 26.7% |
| Sweden | 16.4% | 22.1% | 38.5% | 18.1% | **56.6%** | 43.4% |
| Tunisia | 15.2% | 22.6% | 37.8% | 18.8% | **56.6%** | 43.4% |

## Pronóstico por partido (goles esperados y marcador)

`xG` = goles esperados por equipo (la proyección; refleja el potencial de goleada cuando hay mucha diferencia). 1/X/2 = P(gana local / empate / gana visita). `+2.5` = probabilidad de 3+ goles. **`Marcador`** = un marcador plausible muestreado *condicionado a que ocurra el resultado más probable* (gana el favorito, o empate si es lo más probable); el margen varía de forma realista (parejo → 1-0/2-1; mucha diferencia → a veces 3-0/4-1). Que gane el no-favorito es una sorpresa que vive en las probabilidades 1/X/2.

### Grupo A

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| Mexico vs South Africa | 1.649–0.840 | 57% | 24% | 19% | 45% | **undefined** |
| South Korea vs Czech Republic | 1.420–1.177 | 43% | 26% | 31% | 48% | **undefined** |
| Czech Republic vs South Africa | 1.269–1.142 | 39% | 28% | 33% | 43% | **undefined** |
| Mexico vs South Korea | 1.529–1.043 | 49% | 26% | 26% | 47% | **undefined** |
| Mexico vs Czech Republic | 1.706–0.966 | 55% | 24% | 21% | 50% | **undefined** |
| South Africa vs South Korea | 1.023–1.371 | 28% | 27% | 45% | 43% | **undefined** |

### Grupo B

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| Canada vs Bosnia and Herzegovina | 1.736–0.944 | 56% | 24% | 20% | 50% | **undefined** |
| Qatar vs Switzerland | 1.106–1.544 | 27% | 25% | 47% | 49% | **undefined** |
| Switzerland vs Bosnia and Herzegovina | 1.625–0.917 | 54% | 25% | 21% | 47% | **undefined** |
| Canada vs Qatar | 1.649–1.138 | 49% | 24% | 26% | 53% | **undefined** |
| Canada vs Switzerland | 1.361–1.311 | 38% | 26% | 36% | 50% | **undefined** |
| Bosnia and Herzegovina vs Qatar | 1.112–1.410 | 30% | 27% | 44% | 46% | **undefined** |

### Grupo C

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| Argentina vs Algeria | 1.584–0.793 | 56% | 25% | 19% | 42% | **undefined** |
| Austria vs Jordan | 1.519–1.061 | 48% | 26% | 26% | 48% | **undefined** |
| Argentina vs Austria | 1.436–0.841 | 51% | 27% | 22% | 40% | **undefined** |
| Jordan vs Algeria | 1.171–1.432 | 31% | 26% | 43% | 48% | **undefined** |
| Algeria vs Austria | 1.151–1.347 | 32% | 27% | 41% | 46% | **undefined** |
| Jordan vs Argentina | 0.731–1.787 | 15% | 23% | 63% | 46% | **undefined** |

### Grupo D

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| United States vs Paraguay | 1.706–0.907 | 56% | 24% | 20% | 48% | **undefined** |
| Australia vs Turkey | 1.233–1.209 | 37% | 27% | 36% | 44% | **undefined** |
| United States vs Australia | 1.714–1.152 | 51% | 24% | 26% | 55% | **undefined** |
| Turkey vs Paraguay | 1.203–0.971 | 41% | 29% | 30% | 37% | **undefined** |
| United States vs Turkey | 1.895–1.248 | 53% | 22% | 25% | 61% | **undefined** |
| Paraguay vs Australia | 0.878–1.110 | 29% | 31% | 41% | 32% | **undefined** |

### Grupo E

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| Belgium vs Egypt | 1.405–0.888 | 49% | 27% | 24% | 40% | **undefined** |
| Iran vs New Zealand | 1.767–0.933 | 57% | 23% | 20% | 51% | **undefined** |
| Belgium vs Iran | 1.434–1.107 | 45% | 26% | 29% | 47% | **undefined** |
| New Zealand vs Egypt | 0.915–1.417 | 24% | 27% | 49% | 41% | **undefined** |
| Egypt vs Iran | 0.952–1.163 | 30% | 30% | 41% | 35% | **undefined** |
| New Zealand vs Belgium | 0.870–2.134 | 14% | 19% | 66% | 58% | **undefined** |

### Grupo F

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| Brazil vs Morocco | 1.181–1.048 | 39% | 29% | 32% | 39% | **undefined** |
| Haiti vs Scotland | 1.168–1.576 | 28% | 25% | 47% | 52% | **undefined** |
| Scotland vs Morocco | 0.920–1.400 | 25% | 27% | 48% | 41% | **undefined** |
| Brazil vs Haiti | 2.022–0.875 | 64% | 21% | 15% | 55% | **undefined** |
| Scotland vs Brazil | 0.917–1.571 | 22% | 25% | 53% | 45% | **undefined** |
| Morocco vs Haiti | 1.802–0.878 | 59% | 23% | 18% | 50% | **undefined** |

### Grupo G

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| Spain vs Cape Verde | 1.890–0.799 | 63% | 22% | 15% | 50% | **undefined** |
| Saudi Arabia vs Uruguay | 0.702–1.142 | 23% | 31% | 46% | 28% | **undefined** |
| Spain vs Saudi Arabia | 1.712–0.798 | 59% | 24% | 17% | 46% | **undefined** |
| Uruguay vs Cape Verde | 1.261–0.704 | 50% | 30% | 21% | 31% | **undefined** |
| Cape Verde vs Saudi Arabia | 0.919–1.013 | 32% | 31% | 37% | 31% | **undefined** |
| Uruguay vs Spain | 0.993–1.310 | 28% | 28% | 44% | 40% | **undefined** |

### Grupo H

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| Portugal vs DR Congo | 1.449–0.791 | 53% | 27% | 20% | 39% | **undefined** |
| Uzbekistan vs Colombia | 0.802–1.408 | 21% | 27% | 51% | 38% | **undefined** |
| Portugal vs Uzbekistan | 1.562–0.851 | 54% | 25% | 20% | 43% | **undefined** |
| Colombia vs DR Congo | 1.306–0.745 | 50% | 29% | 21% | 34% | **undefined** |
| Colombia vs Portugal | 1.313–1.373 | 36% | 26% | 38% | 50% | **undefined** |
| DR Congo vs Uzbekistan | 0.848–0.846 | 33% | 34% | 33% | 24% | **undefined** |

### Grupo I

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| England vs Croatia | 1.272–1.014 | 42% | 28% | 30% | 40% | **undefined** |
| Ghana vs Panama | 1.029–1.327 | 29% | 28% | 43% | 42% | **undefined** |
| England vs Ghana | 1.678–0.728 | 60% | 24% | 16% | 43% | **undefined** |
| Panama vs Croatia | 1.006–1.433 | 26% | 27% | 47% | 44% | **undefined** |
| Panama vs England | 0.862–1.540 | 21% | 26% | 53% | 43% | **undefined** |
| Croatia vs Ghana | 1.561–0.850 | 54% | 25% | 20% | 43% | **undefined** |

### Grupo J

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| Germany vs Curaçao | 1.995–0.922 | 62% | 21% | 17% | 56% | **undefined** |
| Ivory Coast vs Ecuador | 0.813–0.844 | 32% | 35% | 34% | 23% | **undefined** |
| Germany vs Ivory Coast | 1.421–1.022 | 46% | 27% | 27% | 44% | **undefined** |
| Ecuador vs Curaçao | 1.185–0.733 | 47% | 31% | 23% | 30% | **undefined** |
| Curaçao vs Ivory Coast | 0.892–1.389 | 24% | 27% | 48% | 40% | **undefined** |
| Ecuador vs Germany | 0.873–1.169 | 27% | 30% | 43% | 33% | **undefined** |

### Grupo K

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| France vs Senegal | 1.409–0.951 | 48% | 27% | 25% | 42% | **undefined** |
| Iraq vs Norway | 1.223–1.382 | 33% | 26% | 41% | 48% | **undefined** |
| France vs Iraq | 1.545–0.728 | 57% | 26% | 18% | 40% | **undefined** |
| Norway vs Senegal | 1.260–1.597 | 30% | 25% | 45% | 54% | **undefined** |
| Norway vs France | 1.062–1.995 | 20% | 21% | 59% | 59% | **undefined** |
| Senegal vs Iraq | 1.237–0.863 | 45% | 29% | 26% | 35% | **undefined** |

### Grupo L

| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |
|---|:--:|--:|--:|--:|--:|:--:|
| Netherlands vs Japan | 1.617–1.350 | 44% | 24% | 32% | 57% | **undefined** |
| Sweden vs Tunisia | 1.214–1.185 | 37% | 28% | 35% | 43% | **undefined** |
| Netherlands vs Sweden | 1.858–1.203 | 53% | 23% | 25% | 59% | **undefined** |
| Tunisia vs Japan | 1.032–1.361 | 28% | 27% | 44% | 43% | **undefined** |
| Japan vs Sweden | 1.706–1.324 | 46% | 24% | 30% | 58% | **undefined** |
| Tunisia vs Netherlands | 0.938–1.482 | 24% | 26% | 50% | 44% | **undefined** |

