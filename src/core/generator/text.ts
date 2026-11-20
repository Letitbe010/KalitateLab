/**
 * Bilingual statements for generated exercises (spec §13.3 terminology; es: ISO 3534-2 terms
 * LES/LEI). DRAFT wording: every text is to be reviewed by the user. The data tables are shown
 * by the UI from the dataset; statements only refer to them.
 */
import * as D from '../decimal';
import type { Decimal } from '../decimal';
import type { Rules, Spec } from '../model';

/** Exact decimal with comma separator: 23,5 → "23,5"; keeps the digits the value has. */
export function fd(x: Decimal): string {
  let d = x.d;
  let a = 0;
  let b = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    a++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    b++;
  }
  const digits = d === 1n ? Math.max(a, b) : 6;
  return D.toFixed(x, digits).replace('.', ',');
}

export function specText(spec: Spec, unit = 'mm'): { eu: string; es: string } {
  const { lsl, usl, nominal, designation } = spec;
  const lim = lsl && usl ? `${fd(lsl)} – ${fd(usl)} ${unit}` : lsl ? `≥ ${fd(lsl)} ${unit}` : `≤ ${fd(usl!)} ${unit}`;
  if (nominal && lsl && usl && D.eq(D.sub(usl, nominal), D.sub(nominal, lsl))) {
    const t = `${fd(nominal)} ± ${fd(D.sub(usl, nominal))} ${unit}`;
    return { eu: t, es: t };
  }
  if (designation) return { eu: `${designation} (${lim})`, es: `${designation} (${lim})` };
  return { eu: lim, es: lim };
}

export function sdRuleText(rules: Rules): { eu: string; es: string } {
  switch (rules.sd) {
    case 's':
      return { eu: 'laginaren desbiderapen estandarra (n − 1)', es: 'la desviación típica muestral (n − 1)' };
    case 'sigma':
      return { eu: 'desbiderapen estandarra, n-z zatituta (σₙ)', es: 'la desviación típica dividiendo entre n (σₙ)' };
    case 'either':
      return { eu: 'desbiderapen estandarra', es: 'la desviación típica' };
  }
}

export const sideText = {
  lt: { eu: 'baino txikiagoa', es: 'menor que' },
  le: { eu: 'edo txikiagoa', es: 'menor o igual que' },
  gt: { eu: 'baino handiagoa', es: 'mayor que' },
  ge: { eu: 'edo handiagoa', es: 'mayor o igual que' },
} as const;

export const thresholdsText = (t: [number, number] = [1, 1.33]): { eu: string; es: string } => {
  const a = String(t[0]).replace('.', ',');
  const b = String(t[1]).replace('.', ',');
  return {
    eu: `Irizpidea: indizea < ${a} → ez gai; ${a} ≤ indizea < ${b} → mugan; indizea ≥ ${b} → gai.`,
    es: `Criterio: índice < ${a} → no capaz; ${a} ≤ índice < ${b} → límite; índice ≥ ${b} → capaz.`,
  };
};

/** Pareto cause names (labels A, B, … are what the user types). */
export const CAUSES: { eu: string; es: string }[] = [
  { eu: 'Erremintaren doikuntza okerra', es: 'Ajuste incorrecto de la herramienta' },
  { eu: 'Programatu gabeko geldialdiak', es: 'Paradas no programadas' },
  { eu: 'Ertzaren higadura', es: 'Desgaste del filo' },
  { eu: 'Erreminta-aldaketaren denbora', es: 'Tiempo de cambio de herramienta' },
  { eu: 'Ebaketa akastunengatiko berrlanak', es: 'Retrabajos por cortes defectuosos' },
  { eu: 'Isuri hidraulikoak', es: 'Fugas hidráulicas' },
  { eu: 'Lehengai akastuna', es: 'Materia prima defectuosa' },
  { eu: 'Neurketa-akatsak', es: 'Errores de medición' },
  { eu: 'Hozgarriaren falta', es: 'Falta de refrigerante' },
  { eu: 'Plano okerrak', es: 'Errores en los planos' },
];
