# KalitateLab

**EU** — Kalitate-kontrol estatistikoko ariketak (estatistika deskribatzailea, banaketa normala eta % akastunak, prozesu-gaitasuna Cp/Cpk, kontrol-grafikoak eta Pareto) entrenatzeko aplikazioa, Euskadiko OPE 1508 espezialitaterako (*Fabrikazio Mekanikoaren Antolamendua eta Proiektuak*). Zuzenketa ebazle matematiko determinista batek egiten du (arrazional zehatzak), ez adimen artifizialak.

**ES** — Aplicación para entrenar ejercicios de control estadístico de calidad (estadística descriptiva, distribución normal y % defectuosas, capacidad de proceso Cp/Cpk, gráficos de control y Pareto) para la OPE de Euskadi, especialidad 1508 (*Organización y Proyectos de Fabricación Mecánica*). La corrección la realiza un solucionador matemático determinista (racionales exactos), no una IA.

Aplikazioa / Aplicación: https://letitbe010.github.io/KalitateLab/ (lehen despliegearen ondoren / tras el primer despliegue)

## Garapena / Desarrollo

```bash
npm install
npm run dev        # garapen-zerbitzaria / servidor de desarrollo
npm test           # testak / tests
npm run lint && npm run typecheck
npm run build
```

### Python orakulua / Oráculo Python (SciPy + NumPy)

```bash
python -m venv tools/oracle/.venv
tools/oracle/.venv/Scripts/python -m pip install -r tools/oracle/requirements.txt   # Windows
tools/oracle/.venv/Scripts/python tools/oracle/oracle.py tools/oracle/out/oracle.json tests/golden/golden.json
ORACLE_REQUIRED=1 npm run oracle
```

## Konbentzioak / Convenciones

- s = laginaren desbiderapena (n − 1); σ = populazioarena (n). / s = desviación muestral (n − 1); σ = poblacional (n).
- SPC konstanteak (A₂, D₃, D₄, d₂...) 3 hamartarreko taulatik, lehen printzipioekin egiaztatuta. / Constantes SPC de tabla a 3 decimales, verificadas desde primeros principios.
- LCL negatiboa → 0. / LCL negativo → 0.

## Lizentzia / Licencia

Kodea / Código: MIT. Edukia / Contenido: CC BY-SA 4.0. Ikus / Ver `LICENSE`.
