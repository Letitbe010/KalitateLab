/** Labels and titles shown in the UI (no numbers are computed here). */
import type { Ask, Exercise } from '../core/model';
import { fmtDec } from './format';

type T = (k: string, v?: Record<string, string | number>) => string;

const OPE_TITLES: Record<string, string> = {
  'ope-euskadi-2020-7': 'Euskadi 2020 · 7',
  'ope-madrid-2025-3': 'Madrid 2025 · 3',
  'ope-madrid-2025-10': 'Madrid 2025 · 10',
  'ope-madrid-2022-3': 'Madrid 2022 · 3',
  'ope-valencia-2025-a3b': 'València 2025 · A.3 b',
  'ope-castillayleon-2020-6': 'Castilla y León 2020 · 6',
};

export const templateOf = (ex: Exercise): string | undefined => (ex.origin === 'generated' ? ex.id.split('-')[0] : undefined);

const ADAPTED_TITLES: Record<string, string> = {
  'adapted-kq1': 'KQ1 · Cp, Cpk, % ',
  'adapted-kq5': 'KQ5 · x̄, s, %',
};

export function exerciseTitle(ex: Exercise, t: T): string {
  const ope = OPE_TITLES[ex.id];
  if (ope) return `OPE ${ope}`;
  const ad = ADAPTED_TITLES[ex.id];
  if (ad) return ad.trim();
  const tpl = templateOf(ex);
  return tpl ? t(`tpl.${tpl}`) : ex.id;
}

export function askLabel(ex: Exercise, ask: Ask, t: T): string {
  const unit = 'unit' in ex.dataset ? ex.dataset.unit : '';
  const side = ask.side ? t(`side.${ask.side}`) : '';
  const b = ask.bound ? fmtDec(ask.bound) : '';
  switch (ask.type) {
    case 'sd':
      return t(`ask.sd.${ex.rules.sd}`);
    case 'pctSample':
      return t('ask.pctSample', { side, b, u: unit });
    case 'pctPopulation':
      return ask.bound ? t('ask.pctPopulation.bound', { side, b, u: unit }) : t(`ask.pctPopulation.${ask.tails ?? 'outside'}`);
    case 'z':
      return t('ask.z', { b, u: unit });
    case 'capable':
      return t(`ask.capable.${ask.index ?? 'cp'}`);
    case 'controlLimits':
    case 'outOfControl':
      return t(`ask.${ask.type}`, { chart: t(`chart.${ask.chart ?? ''}`) });
    default:
      return t(`ask.${ask.type}`);
  }
}

export const letter = (i: number): string => `${String.fromCharCode(97 + i)})`;
