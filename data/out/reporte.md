# Reporte — Pronóstico fase de grupos, Mundial FIFA 2026

_Generado: 2026-06-08T22:15:30.968Z_

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

## Probabilidades de avance por grupo

P = probabilidad estimada (frecuencia en la simulación). "Avanza" = top-2 del grupo o mejor tercero.

### Grupo A

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Mexico | 48.1% | 26.5% | 74.6% | 12.7% | **87.3%** | 12.7% |
| South Korea | 23.5% | 28.8% | 52.3% | 17.8% | **70.1%** | 29.9% |
| Czech Republic | 16.0% | 23.6% | 39.6% | 18.8% | **58.4%** | 41.6% |
| South Africa | 12.4% | 21.1% | 33.5% | 17.8% | **51.3%** | 48.7% |

### Grupo B

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Canada | 37.6% | 28.9% | 66.5% | 15.4% | **81.9%** | 18.1% |
| Switzerland | 34.6% | 29.4% | 64.0% | 15.9% | **80.0%** | 20.0% |
| Qatar | 17.8% | 24.0% | 41.8% | 19.4% | **61.2%** | 38.9% |
| Bosnia and Herzegovina | 10.0% | 17.8% | 27.7% | 17.2% | **44.9%** | 55.1% |

### Grupo C

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Argentina | 53.0% | 26.4% | 79.4% | 10.9% | **90.3%** | 9.7% |
| Austria | 21.7% | 29.5% | 51.2% | 18.8% | **70.0%** | 30.0% |
| Algeria | 15.4% | 25.2% | 40.6% | 19.4% | **60.0%** | 40.0% |
| Jordan | 9.9% | 18.9% | 28.8% | 17.0% | **45.8%** | 54.2% |

### Grupo D

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| United States | 48.1% | 25.9% | 74.0% | 12.3% | **86.3%** | 13.7% |
| Australia | 20.1% | 26.7% | 46.8% | 18.4% | **65.3%** | 34.7% |
| Turkey | 19.6% | 26.5% | 46.1% | 18.0% | **64.1%** | 35.9% |
| Paraguay | 12.2% | 20.9% | 33.1% | 17.8% | **50.8%** | 49.2% |

### Grupo E

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Belgium | 46.5% | 28.5% | 75.0% | 13.2% | **88.3%** | 11.7% |
| Iran | 28.3% | 30.9% | 59.2% | 18.1% | **77.3%** | 22.7% |
| Egypt | 18.3% | 26.6% | 45.0% | 21.1% | **66.1%** | 33.9% |
| New Zealand | 6.8% | 14.0% | 20.9% | 14.8% | **35.7%** | 64.3% |

### Grupo F

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Brazil | 42.8% | 29.8% | 72.6% | 14.3% | **86.9%** | 13.1% |
| Morocco | 34.4% | 31.9% | 66.3% | 16.1% | **82.4%** | 17.6% |
| Scotland | 15.5% | 23.8% | 39.3% | 21.1% | **60.4%** | 39.6% |
| Haiti | 7.3% | 14.5% | 21.8% | 15.6% | **37.4%** | 62.6% |

### Grupo G

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Spain | 51.4% | 26.9% | 78.3% | 11.4% | **89.8%** | 10.2% |
| Uruguay | 28.0% | 33.1% | 61.1% | 16.3% | **77.5%** | 22.5% |
| Saudi Arabia | 11.3% | 21.5% | 32.8% | 18.7% | **51.5%** | 48.5% |
| Cape Verde | 9.2% | 18.5% | 27.7% | 17.2% | **44.9%** | 55.1% |

### Grupo H

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Portugal | 40.8% | 28.8% | 69.6% | 13.9% | **83.5%** | 16.5% |
| Colombia | 36.1% | 30.2% | 66.3% | 15.1% | **81.4%** | 18.6% |
| DR Congo | 11.6% | 20.9% | 32.5% | 17.8% | **50.3%** | 49.7% |
| Uzbekistan | 11.5% | 20.1% | 31.6% | 18.3% | **49.8%** | 50.2% |

### Grupo I

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| England | 44.9% | 28.8% | 73.7% | 13.4% | **87.1%** | 12.9% |
| Croatia | 30.8% | 31.2% | 62.0% | 16.9% | **78.9%** | 21.1% |
| Panama | 15.6% | 23.3% | 38.9% | 19.8% | **58.7%** | 41.3% |
| Ghana | 8.7% | 16.8% | 25.5% | 16.5% | **41.9%** | 58.1% |

### Grupo J

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Germany | 44.9% | 26.6% | 71.5% | 14.0% | **85.5%** | 14.5% |
| Ecuador | 23.5% | 28.8% | 52.2% | 18.5% | **70.7%** | 29.3% |
| Ivory Coast | 22.7% | 27.8% | 50.4% | 19.1% | **69.6%** | 30.4% |
| Curaçao | 8.9% | 16.9% | 25.9% | 15.7% | **41.5%** | 58.5% |

### Grupo K

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| France | 49.3% | 26.9% | 76.2% | 12.3% | **88.5%** | 11.5% |
| Senegal | 24.4% | 30.1% | 54.5% | 17.7% | **72.2%** | 27.8% |
| Norway | 15.1% | 22.7% | 37.9% | 18.1% | **56.0%** | 44.0% |
| Iraq | 11.1% | 20.3% | 31.4% | 18.4% | **49.9%** | 50.1% |

### Grupo L

| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |
|---|---:|---:|---:|---:|---:|---:|
| Netherlands | 40.4% | 27.5% | 67.9% | 14.8% | **82.7%** | 17.3% |
| Japan | 28.4% | 27.9% | 56.3% | 17.2% | **73.5%** | 26.5% |
| Sweden | 16.1% | 22.4% | 38.6% | 18.2% | **56.8%** | 43.3% |
| Tunisia | 15.1% | 22.1% | 37.2% | 18.8% | **56.0%** | 44.0% |

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

