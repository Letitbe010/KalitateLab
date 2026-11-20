import { LEVELS, TEMPLATES } from '../core/generator';
import { POOL } from '../data/pool';
import { useT } from '../i18n';
import { exerciseTitle } from './describe';
import { hrefOf, randomSeed } from './router';

export function PracticeHome() {
  const { t } = useT();
  const levels = [1, 2, 3] as const;
  return (
    <section className="card">
      <h1>{t('home.title')}</h1>
      <p className="lead">{t('home.lead')}</p>

      <h2 className="sec">{t('home.pool')}</h2>
      <div className="tiles">
        {POOL.map((ex) => (
          <a key={ex.id} className="tile" href={hrefOf({ name: 'pool', id: ex.id })}>
            <span className="tags">
              <span className={`tag origin-${ex.origin}`}>{t(`origin.${ex.origin}`)}</span>
              <span className="tag">{t('home.level', { n: ex.difficulty })}</span>
              {ex.review !== 'approved' && <span className="tag warn">{t('home.review')}</span>}
            </span>
            <b>{exerciseTitle(ex, t)}</b>
          </a>
        ))}
      </div>

      <h2 className="sec">{t('home.generated')}</h2>
      {levels.map((lv) => (
        <div key={lv} className="level">
          <h3>{t('home.level', { n: lv })}</h3>
          <div className="tiles">
            {TEMPLATES.filter((tp) => LEVELS[tp].includes(lv)).map((tp) => (
              <a
                key={tp}
                className="tile"
                href={hrefOf({ name: 'generated', template: tp, level: lv, seed: 1 })}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = hrefOf({ name: 'generated', template: tp, level: lv, seed: randomSeed() });
                }}
              >
                <b>{t(`tpl.${tp}`)}</b>
                <span className="go">{t('home.new')} →</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
