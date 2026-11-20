/**
 * Answer form (spec §13.1–13.2): one card per ask, numeric keyboard (inputmode="decimal",
 * comma or point), a unit selector where it applies, and after grading the result of each
 * field with icon + text + colour (never colour alone), the expected value and the diagnosis.
 */
import type { Answer, AskResult, ItemResult } from '../core/grader';
import type { Ask, Exercise } from '../core/model';
import { dataDecimals, solveAsk, type Quantity } from '../core/solve';
import { useT } from '../i18n';
import { askLabel, letter } from './describe';
import { fmt } from './format';

export const UNITS: Record<Quantity, string[]> = { length: ['mm', 'µm'], percent: ['%', 'ppm'], none: [] };

const CHOICES: Partial<Record<Ask['type'], string[]>> = {
  capable: ['not', 'marginal', 'capable'],
  centered: ['yes', 'USL', 'LSL'],
};

type T = (k: string, v?: Record<string, string | number>) => string;

/** Display of an expected/given value of an item (numbers with the precision that matters). */
export function showValue(ex: Exercise, ask: Ask, item: ItemResult, which: 'expected' | 'given', t: T): string {
  const v = item[which];
  if (v === undefined) return '';
  if (typeof v === 'string') return ask.type === 'capable' || ask.type === 'centered' ? t(`choice.${v}`) : v;
  if (Array.isArray(v)) {
    if (v.length === 0) return t('sol.none');
    return v.map((x) => (typeof x === 'number' && item.part === 'cumPct' ? fmt(x, 2) : String(x))).join(', ');
  }
  const exp = solveAsk(ex, ask);
  const raw = ex.dataset.kind === 'values' || ex.dataset.kind === 'freq' || ex.dataset.kind === 'subgroups' || ex.dataset.kind === 'summary';
  const minDec = raw && (exp.kind === 'limits' || ['mean', 'sd', 'sigmaHat'].includes(ask.type)) ? dataDecimals(ex.dataset) + 2 : 0;
  const unit = exp.kind === 'number' ? (exp.quantity === 'percent' ? ' %' : exp.quantity === 'length' ? ` ${'unit' in ex.dataset ? ex.dataset.unit : ''}` : '') : '';
  if (which === 'expected' && exp.kind === 'number' && exp.accepted.length > 1) {
    const SYM: Record<string, string> = { s: 's', sigma: 'σₙ', 'Rbar/d2': 'R̄/d₂', 'sbar/c4': 's̄/c₄' };
    return exp.accepted.map((a) => `${fmt(a.value, minDec, 4, minDec === 0)}${unit} (${SYM[a.note ?? ''] ?? a.note})`).join(' / ');
  }
  return `${fmt(v, minDec, 4, minDec === 0)}${unit}`;
}

function StatusChip({ status }: { status: AskResult['status'] }) {
  const { t } = useT();
  const icon = status === 'correct' ? '✓' : status === 'wrong' ? '✗' : status === 'partial' ? '◐' : '!';
  return (
    <span className={`chip ${status === 'partial' ? 'missing' : status}`}>
      <span aria-hidden="true">{icon}</span> {t(`res.${status}`)}
    </span>
  );
}

interface Props {
  ex: Exercise;
  answers: Record<string, Answer>;
  onChange: (askId: string, patch: Partial<Answer>) => void;
  results?: AskResult[];
  disabled?: boolean;
}

export function AnswerForm({ ex, answers, onChange, results, disabled }: Props) {
  const { t } = useT();
  return (
    <div className="asks">
      {ex.asks.map((ask, i) => {
        const ans = answers[ask.id] ?? {};
        const res = results?.find((r) => r.id === ask.id);
        const exp = solveAsk(ex, ask);
        const itemStatus = (part: string) => res?.items.find((x) => x.part === part)?.status ?? '';
        const label = askLabel(ex, ask, t);
        const input = (part: keyof Answer, lbl?: string, width = 'w8', value?: string, set?: (v: string) => void) => (
          <label className={`fld ${width} ${itemStatus(part)}`}>
            {lbl !== undefined && <span>{lbl}</span>}
            <input
              type="text"
              inputMode={part === 'order' || part === 'classA' || part === 'set' ? 'text' : 'decimal'}
              autoComplete="off"
              value={value ?? (ans[part] as string | undefined) ?? ''}
              disabled={disabled}
              aria-label={`${letter(i)} ${label}${lbl ? ` — ${lbl}` : ''}`}
              onChange={(e) => (set ? set(e.target.value) : onChange(ask.id, { [part]: e.target.value }))}
            />
          </label>
        );
        const units = exp.kind === 'number' ? UNITS[exp.quantity] : exp.kind === 'limits' && ex.dataset.kind === 'subgroups' ? UNITS.length : [];
        const unitSel =
          units.length > 1 ? (
            <label className="fld">
              <span>{t('field.unit')}</span>
              <select value={ans.unit ?? units[0]} disabled={disabled} onChange={(e) => onChange(ask.id, { unit: e.target.value })}>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          ) : null;
        const choices = CHOICES[ask.type];
        return (
          <article key={ask.id} className={`ask ${res?.status ?? ''}`}>
            <header>
              <b>{letter(i)}</b> <span>{label}</span>
              {res && <StatusChip status={res.status} />}
            </header>
            <div className="row">
              {choices ? (
                <div className="choice" role="radiogroup" aria-label={label}>
                  {choices.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={ans.choice === c}
                      className={ans.choice === c ? 'small sel' : 'small'}
                      disabled={disabled}
                      onClick={() => onChange(ask.id, { choice: c })}
                    >
                      {t(`choice.${c}`)}
                    </button>
                  ))}
                </div>
              ) : exp.kind === 'limits' ? (
                <>
                  {input('cl', t('field.cl'))}
                  {input('ucl', t('field.ucl'))}
                  {input('lcl', t('field.lcl'))}
                  {unitSel}
                </>
              ) : exp.kind === 'set' ? (
                input('set', t('field.set'), 'w16')
              ) : exp.kind === 'pareto' ? (
                <div className="pareto-form">
                  {input('order', t('field.order'), 'w16')}
                  <fieldset className="cum">
                    <legend>{t('field.cumPct')}</legend>
                    {exp.order.map((_, k) => (
                      <span key={k}>
                        {input('cumPct', `${k + 1}.`, 'w5', ans.cumPct?.[k] ?? '', (v) => {
                          const next = [...(ans.cumPct ?? exp.order.map(() => ''))];
                          next[k] = v;
                          onChange(ask.id, { cumPct: next });
                        })}
                      </span>
                    ))}
                  </fieldset>
                  {input('classA', t('field.classA'), 'w16')}
                </div>
              ) : (
                <>
                  {input('value')}
                  {unitSel}
                </>
              )}
            </div>
            {res && res.status !== 'correct' && (
              <div className="feedback">
                {res.items
                  .filter((it) => it.status !== 'correct')
                  .map((it) => (
                    <div key={it.part}>
                      <p>
                        {res.items.length > 1 ? <b>{t(`field.${it.part}`)}: </b> : null}
                        {t('res.expected', { v: showValue(ex, ask, it, 'expected', t) })}
                        {it.status === 'wrong' && it.given !== undefined ? ` · ${t('res.given', { v: showValue(ex, ask, it, 'given', t) })}` : ''}
                      </p>
                      {it.status === 'invalid' && <p className="hint">{t('res.invalidHelp')}</p>}
                      {it.diagnosis && (
                        <div className="diag">
                          <b>{t('diag.title')}</b> {t(`diag.${it.diagnosis}`)}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
            {res && exp.kind === 'number' && exp.accepted.length > 1 && res.items.some((it) => it.status === 'correct' && it.note) && (
              <p className="feedback ok">{res.items.filter((it) => it.note).map((it) => t(`res.note.${it.note}`)).join(' · ')}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
