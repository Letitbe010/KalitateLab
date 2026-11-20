/**
 * Theory (spec §14.1). Part A: topics 1–6. Status "draft" until the user reviews the texts.
 * No number is written by hand in the prose: examples use {{…}} variables computed by the
 * solvers on verified pool exercises (src/ui/theoryTemplate.ts). Allowed constants in prose
 * (rules, not data): 68 / 95 / 99,73 %, 6σ, 3σ, n − 1, the thresholds 1 and 1,33.
 */
import status from './status.json';
import type { Topic } from './types';

const st = (id: string): Topic['status'] => ((status.status as Record<string, string>)[id] === 'reviewed' ? 'reviewed' : 'draft');

export const TOPICS: Topic[] = [
  // ------------------------------------------------------------------ 1
  {
    id: 'variability',
    title: { eu: 'Aldakortasuna fabrikazioan', es: 'La variabilidad en la fabricación' },
    status: st('variability'),
    blocks: [
      {
        t: 'p',
        eu: 'Prozesu batek ez ditu inoiz bi pieza berdin-berdinak egiten: neurriek beti aldakortasun bat dute. Kalitate-kontrol estatistikoaren helburua ez da aldakortasuna ezabatzea, baizik eta ulertzea, neurtzea eta mugan edukitzea.',
        es: 'Un proceso nunca fabrica dos piezas exactamente iguales: las medidas siempre tienen cierta variabilidad. El objetivo del control estadístico de la calidad no es eliminar la variabilidad, sino entenderla, medirla y mantenerla acotada.',
      },
      {
        t: 'list',
        eu: [
          'Kausa arruntak (naturalak): asko eta txikiak, beti daude (materialaren aldakortasuna, bibrazio txikiak, tenperatura...). Prozesuaren berezko dispertsioa sortzen dute, eta egonkorra da.',
          'Kausa esleigarriak (bereziak): gutxi eta handiak, noizean behin agertzen dira (erreminta hautsia, doikuntza okerra, lehengai-sorta berria...). Prozesua desplazatzen edo desegonkortzen dute, eta identifikatu eta kendu egin behar dira.',
        ],
        es: [
          'Causas comunes (naturales): muchas y pequeñas, siempre presentes (variabilidad del material, pequeñas vibraciones, temperatura...). Producen la dispersión propia del proceso, que es estable.',
          'Causas asignables (especiales): pocas y grandes, aparecen de vez en cuando (herramienta rota, reglaje incorrecto, nuevo lote de materia prima...). Desplazan o desestabilizan el proceso, y hay que identificarlas y eliminarlas.',
        ],
      },
      {
        t: 'p',
        eu: 'Kausa arruntak bakarrik daudenean, prozesua kontrol estatistikoan dago: aurreikusgarria da. Hori da kontrol-grafikoek (7. gaia) egiaztatzen dutena. Prozesua gai den ala ez beste galdera bat da: aurreikusgarria izan daiteke eta, hala ere, pieza akastunak egin (6. gaia).',
        es: 'Cuando solo actúan causas comunes, el proceso está bajo control estadístico: es predecible. Eso es lo que comprueban los gráficos de control (tema 7). Que el proceso sea capaz es otra pregunta: puede ser predecible y, aun así, fabricar piezas defectuosas (tema 6).',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Kontrolpean egotea ≠ gai izatea. Kontrol-mugak prozesutik datoz; espezifikazio-mugak planotik.',
        es: 'Estar bajo control ≠ ser capaz. Los límites de control salen del proceso; los de especificación, del plano.',
      },
    ],
  },

  // ------------------------------------------------------------------ 2
  {
    id: 'descriptive',
    title: { eu: 'Estatistika deskribatzailea', es: 'Estadística descriptiva' },
    status: st('descriptive'),
    blocks: [
      {
        t: 'p',
        eu: 'Datu-multzo bat bi neurrirekin laburtzen da: kokapena (batez bestekoa) eta dispertsioa (desbiderapen estandarra). Maiztasun-taula batean balio bakoitza fᵢ aldiz agertzen da, eta batura guztietan maiztasunarekin biderkatzen da.',
        es: 'Un conjunto de datos se resume con dos medidas: posición (la media) y dispersión (la desviación típica). En una tabla de frecuencias cada valor aparece fᵢ veces, y en todas las sumas se multiplica por la frecuencia.',
      },
      { t: 'f', tex: '\\bar{x} = \\frac{\\sum x_i}{n} \\qquad \\bar{x} = \\frac{\\sum f_i\\,x_i}{n}', check: 'mean-freq' },
      { t: 'f', tex: 's = \\sqrt{\\frac{\\sum f_i\\,(x_i-\\bar{x})^2}{n-1}} \\qquad \\sigma_n = \\sqrt{\\frac{\\sum f_i\\,(x_i-\\bar{x})^2}{n}}', check: 'var-sample' },
      {
        t: 'p',
        eu: 'Zergatik n − 1? Laginaren batez bestekoa datu beretatik kalkulatzen denez, desbideratzeen batura beti zero da: n desbideratzeetatik n − 1 bakarrik dira askeak. n-rekin zatituz gero, populazioaren desbiderapena gutxietsi egiten da (Bessel-en zuzenketa). Populazio osoa neurtzen denean bakarrik erabiltzen da n.',
        es: '¿Por qué n − 1? Como la media muestral se calcula con los mismos datos, la suma de las desviaciones siempre es cero: de las n desviaciones solo n − 1 son libres. Si se divide entre n, la desviación de la población se subestima (corrección de Bessel). Solo se usa n cuando se mide la población entera.',
      },
      {
        t: 'example',
        pool: 'adapted-values-1',
        eu: 'Zerrenda batean (n = {{n}}): x̄ = {{a:m}}; s = {{a:s}}. n-rekin zatituta σₙ = {{sn}} aterako litzateke: txikiagoa.',
        es: 'En una lista (n = {{n}}): x̄ = {{a:m}}; s = {{a:s}}. Dividiendo entre n saldría σₙ = {{sn}}: menor.',
      },
      {
        t: 'example',
        pool: 'adapted-kq5',
        eu: 'Maiztasun-taula batean (n = {{n}}): x̄ = {{a:a1}}; s = {{s}} eta σₙ = {{sn}}.',
        es: 'En una tabla de frecuencias (n = {{n}}): x̄ = {{a:a1}}; s = {{s}} y σₙ = {{sn}}.',
      },
      { t: 'widget', w: 'nvsn1' },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Kalkulagailuan bi tekla daude: σₙ (n) eta σₙ₋₁ edo s (n − 1). Enuntziatuak zein eskatzen duen begiratu; zehazten ez badu, idatzi zein erabili duzun.',
        es: 'La calculadora tiene dos teclas: σₙ (n) y σₙ₋₁ o s (n − 1). Mira cuál pide el enunciado; si no lo especifica, indica cuál has usado.',
      },
    ],
  },

  // ------------------------------------------------------------------ 3
  {
    id: 'normal',
    title: { eu: 'Banaketa normala', es: 'La distribución normal' },
    status: st('normal'),
    blocks: [
      {
        t: 'p',
        eu: 'Kausa arrunt askoren batuketak banaketa normala ematen du (Gauss-en kanpaia): simetrikoa da, eta μ batez bestekoak eta σ desbiderapenak guztiz zehazten dute. Edozein normal tipifikatu egiten da z aldagaiarekin, eta Φ(z) taulan irakurtzen da: P(X ≤ x).',
        es: 'La suma de muchas causas comunes da la distribución normal (campana de Gauss): es simétrica y queda totalmente definida por la media μ y la desviación σ. Cualquier normal se tipifica con la variable z, y Φ(z) se lee en la tabla: P(X ≤ x).',
      },
      { t: 'f', tex: 'z = \\frac{x-\\mu}{\\sigma} \\qquad P(X \\le x) = \\Phi(z) \\qquad P(X > x) = 1-\\Phi(z)', check: 'z' },
      { t: 'figure', f: 'empirical' },
      {
        t: 'list',
        eu: ['μ ± σ: datuen % 68 inguru', 'μ ± 2σ: % 95 inguru', 'μ ± 3σ: % 99,73 (6σ zabalera: prozesuaren tolerantzia naturala)'],
        es: ['μ ± σ: alrededor del 68 % de los datos', 'μ ± 2σ: alrededor del 95 %', 'μ ± 3σ: el 99,73 % (anchura 6σ: tolerancia natural del proceso)'],
      },
      {
        t: 'example',
        pool: 'ope-madrid-2022-3',
        eu: 'μ = {{mu}}, σ = {{sd}}, mugak {{lsl}} eta {{usl}}: z(LSL) = {{zl}} → Φ = {{pl}}; z(USL) = {{zu}} → 1 − Φ = {{pu}}.',
        es: 'μ = {{mu}}, σ = {{sd}}, límites {{lsl}} y {{usl}}: z(LEI) = {{zl}} → Φ = {{pl}}; z(LES) = {{zu}} → 1 − Φ = {{pu}}.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Taulak Φ(z) ematen du (ezkerreko isatsa). Goiko mugaren gainetik dagoena 1 − Φ(z) da. z negatiboetarako: Φ(−z) = 1 − Φ(z).',
        es: 'La tabla da Φ(z) (cola izquierda). Lo que queda por encima del límite superior es 1 − Φ(z). Para z negativos: Φ(−z) = 1 − Φ(z).',
      },
    ],
  },

  // ------------------------------------------------------------------ 4
  {
    id: 'defects',
    title: { eu: '% akastunak: laginean eta populazioan', es: '% defectuosas: en la muestra y en la población' },
    status: st('defects'),
    blocks: [
      {
        t: 'p',
        eu: 'Bi galdera desberdin dira. Laginean dagoen ehunekoa zuzenean zenbatzen da taulatik. Populazioan egongo dena (ekoizpen osoa) ezin da zenbatu: banaketa normalarekin estimatzen da, laginaren x̄ eta s erabiliz.',
        es: 'Son dos preguntas distintas. El porcentaje en la muestra se cuenta directamente en la tabla. El de la población (toda la producción) no se puede contar: se estima con la distribución normal, usando x̄ y s de la muestra.',
      },
      { t: 'f', tex: '\\%_{pop} = 100\\left[\\Phi\\!\\left(\\frac{LSL-\\mu}{\\sigma}\\right) + 1-\\Phi\\!\\left(\\frac{USL-\\mu}{\\sigma}\\right)\\right]', check: 'pct-population' },
      {
        t: 'example',
        pool: 'ope-euskadi-2020-7',
        eu: 'Euskadi OPE 2020: laginean {{a:b}} (inor ez dago muga azpitik), baina populazioan {{a:c}} estimatzen da. Laginean zero izateak ez du esan nahi prozesuak piezarik txarrik egiten ez duenik.',
        es: 'OPE Euskadi 2020: en la muestra {{a:b}} (ninguna por debajo del límite), pero en la población se estima {{a:c}}. Que en la muestra salga cero no quiere decir que el proceso no fabrique piezas malas.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Laginean: < ala ≤ garrantzitsua da (klase-marka mugan badago). Populazioan, banaketa jarraitua denez, < eta ≤ berdinak dira.',
        es: 'En la muestra importa < o ≤ (si una marca de clase cae en el límite). En la población, al ser una distribución continua, < y ≤ dan lo mismo.',
      },
      {
        t: 'note',
        kind: 'ope',
        eu: 'Azterketan, adierazi beti zein ehuneko kalkulatzen ari zaren: "laginean (zenbatuta)" ala "populazioan (normal bidez estimatuta)".',
        es: 'En el examen, indica siempre qué porcentaje calculas: «en la muestra (contado)» o «en la población (estimado con la normal)».',
      },
    ],
  },

  // ------------------------------------------------------------------ 5
  {
    id: 'specs',
    title: { eu: 'Espezifikazioak eta tolerantziak', es: 'Especificaciones y tolerancias' },
    status: st('specs'),
    blocks: [
      {
        t: 'p',
        eu: 'Espezifikazio-mugak (LSL eta USL) planotik datoz: kota nominala eta tolerantzia, edo ISO kodea (zuloa letra larriz, ardatza letra xehez). ISO kode bat agertzen bada, lehenik mugak kalkulatu behar dira ISO 286 taulekin; aplikazio honetan mugak zenbakiz ere ematen dira.',
        es: 'Los límites de especificación (LEI y LES) salen del plano: cota nominal y tolerancia, o código ISO (agujero en mayúscula, eje en minúscula). Si aparece un código ISO, primero hay que calcular los límites con las tablas ISO 286; en esta aplicación los límites se dan también en números.',
      },
      { t: 'f', tex: 'T = USL - LSL \\qquad m = \\frac{USL+LSL}{2}' },
      {
        t: 'example',
        pool: 'ope-madrid-2025-3',
        eu: 'Madril OPE 2025: mugak {{lsl}} – {{usl}}; tolerantzia T = {{tol}}.',
        es: 'OPE Madrid 2025: límites {{lsl}} – {{usl}}; tolerancia T = {{tol}}.',
      },
      {
        t: 'example',
        pool: 'ope-valencia-2025-a3b',
        eu: 'Valentzia OPE 2025 (zuloa): mugak {{lsl}} – {{usl}}; T = {{tol}}.',
        es: 'OPE Valencia 2025 (agujero): límites {{lsl}} – {{usl}}; T = {{tol}}.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Tolerantzia ez dago zertan nominalarekiko simetrikoa izan: erdia ez da beti nominala. Zentratzea tolerantziaren erdiarekiko neurtzen da.',
        es: 'La tolerancia no tiene por qué ser simétrica respecto al nominal: el centro no siempre es el nominal. El centrado se mide respecto al centro de la tolerancia.',
      },
    ],
  },

  // ------------------------------------------------------------------ 6
  {
    id: 'capability',
    title: { eu: 'Prozesuaren gaitasuna: Cp eta Cpk', es: 'Capacidad del proceso: Cp y Cpk' },
    status: st('capability'),
    blocks: [
      {
        t: 'p',
        eu: 'Gaitasunak prozesuaren dispertsio naturala (6σ) tolerantziarekin alderatzen du. Cp-k zabalerak bakarrik alderatzen ditu: prozesua zentratuta balego lor lezakeena da. Cpk-k zentratzea ere kontuan hartzen du: batez bestekotik mugarik hurbilenera dagoen distantzia, 3σ-rekin zatituta.',
        es: 'La capacidad compara la dispersión natural del proceso (6σ) con la tolerancia. Cp compara solo anchuras: es lo que el proceso podría conseguir si estuviera centrado. Cpk tiene en cuenta también el centrado: distancia de la media al límite más cercano, dividida entre 3σ.',
      },
      { t: 'f', tex: 'C_p = \\frac{USL-LSL}{6\\sigma}', check: 'cp' },
      { t: 'f', tex: 'C_{pu} = \\frac{USL-\\mu}{3\\sigma} \\qquad C_{pl} = \\frac{\\mu-LSL}{3\\sigma} \\qquad C_{pk} = \\min(C_{pu}, C_{pl})', check: 'cpk' },
      { t: 'f', tex: 'C_p = \\frac{C_{pu}+C_{pl}}{2} \\qquad C_{pk} \\le C_p', check: 'cp-cpk-mean' },
      {
        t: 'list',
        eu: ['Cp < 1: ez gai (tolerantzia dispertsio naturala baino estuagoa)', '1 ≤ Cp < 1,33: mugan', 'Cp ≥ 1,33: gai (ohiko irizpidea; zenbait sektorek gehiago eskatzen dute)', 'Cpk < Cp: prozesua desplazatuta dago'],
        es: ['Cp < 1: no capaz (tolerancia más estrecha que la dispersión natural)', '1 ≤ Cp < 1,33: límite', 'Cp ≥ 1,33: capaz (criterio habitual; algunos sectores exigen más)', 'Cpk < Cp: el proceso está desplazado'],
      },
      {
        t: 'example',
        pool: 'adapted-kq1',
        eu: 'μ = {{mu}}, σ = {{sd}}, mugak {{lsl}} – {{usl}}: Cp = {{a:cp}}; Cpu = {{a:cpu}}; Cpl = {{a:cpl}}; Cpk = {{a:cpk}} → {{a:cen}}.',
        es: 'μ = {{mu}}, σ = {{sd}}, límites {{lsl}} – {{usl}}: Cp = {{a:cp}}; CpkS = {{a:cpu}}; CpkI = {{a:cpl}}; Cpk = {{a:cpk}} → {{a:cen}}.',
      },
      { t: 'widget', w: 'capability' },
      {
        t: 'p',
        eu: 'σ nola estimatu: datu guztien s (epe luzerako aldakortasuna), edo azpitaldeekin R̄/d₂ edo s̄/c₄ (azpitaldeen barrukoa, epe laburrekoa). Enuntziatuak esaten du zein; esaten ez badu, adierazi zein erabili duzun.',
        es: 'Cómo estimar σ: s de todos los datos (variabilidad a largo plazo), o con subgrupos R̄/d₂ o s̄/c₄ (dentro de los subgrupos, a corto plazo). El enunciado indica cuál; si no lo dice, indica cuál has usado.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Cp-n 6σ eta Cpk-n 3σ. Erabili espezifikazio-mugak (planotik), inoiz ez kontrol-mugak.',
        es: 'En Cp, 6σ y en Cpk, 3σ. Usa los límites de especificación (del plano), nunca los de control.',
      },
    ],
  },
];

export const topicById = (id: string): Topic | undefined => TOPICS.find((x) => x.id === id);
