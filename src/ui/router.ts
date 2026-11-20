/**
 * Hash router (GitHub Pages has no SPA routing, spec §13.1).
 *   #/                                       → start (practice for now)
 *   #/praktika                               → practice home
 *   #/praktika/<template>/<level>/seed/<n>   → generated exercise
 *   #/praktika/pool/<id>                     → pool exercise
 *   #/teoria, #/ebatziak, #/aurrerapena      → sections of later phases
 */
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'generated'; template: string; level: number; seed: number }
  | { name: 'pool'; id: string }
  | { name: 'soon'; section: 'teoria' | 'ebatziak' | 'aurrerapena' };

export function parseHash(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (p[0] === 'praktika' && p[1] === 'pool' && p[2]) return { name: 'pool', id: p[2] };
  if (p[0] === 'praktika' && p[1] && p[2] && /^\d$/.test(p[2]) && p[3] === 'seed' && p[4] && /^\d+$/.test(p[4]))
    return { name: 'generated', template: p[1], level: Number(p[2]), seed: Number(p[4]) };
  if (p[0] === 'teoria' || p[0] === 'ebatziak' || p[0] === 'aurrerapena') return { name: 'soon', section: p[0] };
  return { name: 'home' };
}

export function hrefOf(r: Route): string {
  switch (r.name) {
    case 'generated':
      return `#/praktika/${encodeURIComponent(r.template)}/${r.level}/seed/${r.seed}`;
    case 'pool':
      return `#/praktika/pool/${encodeURIComponent(r.id)}`;
    case 'soon':
      return `#/${r.section}`;
    default:
      return '#/praktika';
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);
