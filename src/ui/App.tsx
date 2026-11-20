import { Suspense, lazy, useEffect, useState } from 'react';
import { type Lang, LangContext, translate } from '../i18n';
import { PracticeExercise } from './PracticeExercise';
import { PracticeHome } from './PracticeHome';
import { WorkedItem, WorkedList } from './WorkedView';
import { type Route, hrefOf, useRoute } from './router';
import { loadLang, saveLang } from './store';

// theory (KaTeX + texts) is loaded only when opened
const TheoryList = lazy(() => import('./theory/TheoryView').then((m) => ({ default: m.TheoryList })));
const TheoryTopic = lazy(() => import('./theory/TheoryView').then((m) => ({ default: m.TheoryTopic })));

const NAV: { key: string; route: Route; icon: string; section: string }[] = [
  { key: 'nav.theory', route: { name: 'theory' }, icon: 'T', section: 'teoria' },
  { key: 'nav.worked', route: { name: 'worked' }, icon: 'E', section: 'ebatziak' },
  { key: 'nav.practice', route: { name: 'home' }, icon: 'P', section: 'praktika' },
  { key: 'nav.progress', route: { name: 'soon', section: 'aurrerapena' }, icon: 'A', section: 'aurrerapena' },
];

const sectionOf = (r: Route): string =>
  r.name === 'soon' ? r.section : r.name === 'worked' || r.name === 'workedItem' ? 'ebatziak' : r.name === 'theory' || r.name === 'theoryTopic' ? 'teoria' : 'praktika';
const COMMIT = (import.meta.env.VITE_COMMIT as string | undefined)?.slice(0, 7) ?? 'dev';

export function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const route = useRoute();
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  useEffect(() => {
    document.documentElement.lang = lang;
    saveLang(lang);
  }, [lang]);
  const current = sectionOf(route);
  const link = (n: (typeof NAV)[number]) => {
    const on = n.section === current;
    return (
      <a href={hrefOf(n.route)} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
        <span className="ico" aria-hidden="true">
          {n.icon}
        </span>
        <span>{t(n.key)}</span>
      </a>
    );
  };

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <nav className="side" aria-label={t('nav.home')}>
          <a className="brand" href="#/">
            <small>{t('app.kicker')}</small>
            <b>KalitateLab</b>
          </a>
          <ul>
            {NAV.map((n) => (
              <li key={n.key}>{link(n)}</li>
            ))}
          </ul>
          <p className="meta">v0.7.0 · {COMMIT}</p>
        </nav>
        <div className="main">
          <header className="top">
            <a className="brand mobile-only" href="#/" aria-label={t('nav.home')}>
              <b>KalitateLab</b>
            </a>
            <div className="lang" role="group" aria-label="Hizkuntza / Idioma">
              {(['eu', 'es'] as const).map((l) => (
                <button key={l} className={l === lang ? 'sel' : ''} aria-pressed={l === lang} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </header>
          <main>
            {route.name === 'home' && <PracticeHome />}
            {route.name === 'generated' && (
              <PracticeExercise key={`${route.template}-${route.level}-${route.seed}`} source={{ kind: 'generated', template: route.template, level: route.level, seed: route.seed }} />
            )}
            {route.name === 'pool' && <PracticeExercise key={route.id} source={{ kind: 'pool', id: route.id }} />}
            {route.name === 'worked' && <WorkedList />}
            {route.name === 'workedItem' && <WorkedItem key={route.id} id={route.id} />}
            <Suspense fallback={<p className="note">…</p>}>
              {route.name === 'theory' && <TheoryList />}
              {route.name === 'theoryTopic' && <TheoryTopic key={route.id} id={route.id} />}
            </Suspense>
            {route.name === 'soon' && (
              <section className="card">
                <h1>{t(NAV.find((n) => n.section === route.section)!.key)}</h1>
                <p className="note">{t('nav.soon')}</p>
              </section>
            )}
          </main>
        </div>
        <nav className="bottom" aria-label={t('nav.home')}>
          {NAV.map((n) => (
            <span key={n.key} className="bottom-item">
              {link(n)}
            </span>
          ))}
        </nav>
      </div>
    </LangContext.Provider>
  );
}
