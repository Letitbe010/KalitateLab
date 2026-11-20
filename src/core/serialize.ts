/**
 * Exercise ↔ JSON. Decimals are stored as exact strings ("23.5", or "p/q" when not a finite
 * decimal) so the pool files are readable and lossless; parse() reads both forms.
 */
import * as D from './decimal';
import type { Decimal } from './decimal';
import type { Ask, Dataset, Exercise, Spec } from './model';

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export function decToString(x: Decimal): string {
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
  return d === 1n ? D.toFixed(x, Math.max(a, b)) : D.toString(x);
}

const ds2j = (ds: Dataset): Json => {
  switch (ds.kind) {
    case 'values':
      return { kind: ds.kind, unit: ds.unit, values: ds.values.map(decToString) };
    case 'freq':
      return {
        kind: ds.kind,
        unit: ds.unit,
        classes: ds.classes.map((c) => ({ ...(c.x ? { x: decToString(c.x) } : {}), ...(c.a ? { a: decToString(c.a) } : {}), ...(c.b ? { b: decToString(c.b) } : {}), f: c.f })),
      };
    case 'subgroups':
      return { kind: ds.kind, unit: ds.unit, groups: ds.groups.map((g) => g.map(decToString)) };
    case 'summary':
      return { kind: ds.kind, unit: ds.unit, mean: decToString(ds.mean), sd: decToString(ds.sd), sdKind: ds.sdKind, ...(ds.n !== undefined ? { n: ds.n } : {}) };
    case 'attributes':
      return { kind: ds.kind, chart: ds.chart, samples: ds.samples.map((s) => ({ n: s.n, defects: s.defects })) };
    case 'pareto':
      return { kind: ds.kind, items: ds.items.map((i) => ({ label: i.label, value: decToString(i.value) })) };
  }
};

const spec2j = (s: Spec): Json => {
  const o: { [k: string]: Json } = {};
  if (s.lsl) o.lsl = decToString(s.lsl);
  if (s.usl) o.usl = decToString(s.usl);
  if (s.nominal) o.nominal = decToString(s.nominal);
  if (s.designation) o.designation = s.designation;
  return o;
};

const ask2j = (a: Ask): Json => {
  const o: { [k: string]: Json } = { id: a.id, type: a.type };
  if (a.bound) o.bound = decToString(a.bound);
  if (a.side) o.side = a.side;
  if (a.tails) o.tails = a.tails;
  if (a.chart) o.chart = a.chart;
  if (a.index) o.index = a.index;
  return o;
};

export function exerciseToJSON(ex: Exercise): Json {
  const o: { [k: string]: Json } = { id: ex.id, origin: ex.origin };
  if (ex.sourceNote) o.sourceNote = ex.sourceNote;
  if (ex.sourceUrl) o.sourceUrl = ex.sourceUrl;
  if (ex.seed !== undefined) o.seed = ex.seed;
  if (ex.review) o.review = ex.review;
  o.difficulty = ex.difficulty;
  o.dataset = ds2j(ex.dataset);
  if (ex.spec) o.spec = spec2j(ex.spec);
  o.rules = JSON.parse(JSON.stringify(ex.rules)) as Json;
  o.asks = ex.asks.map(ask2j);
  o.weights = ex.weights;
  o.text = ex.text;
  return o;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const p = (s: any): Decimal => D.parse(String(s));

function j2ds(j: any): Dataset {
  switch (j.kind) {
    case 'values':
      return { kind: 'values', unit: j.unit, values: j.values.map(p) };
    case 'freq':
      return {
        kind: 'freq',
        unit: j.unit,
        classes: j.classes.map((c: any) => ({ ...(c.x !== undefined ? { x: p(c.x) } : {}), ...(c.a !== undefined ? { a: p(c.a) } : {}), ...(c.b !== undefined ? { b: p(c.b) } : {}), f: c.f })),
      };
    case 'subgroups':
      return { kind: 'subgroups', unit: j.unit, groups: j.groups.map((g: any[]) => g.map(p)) };
    case 'summary':
      return { kind: 'summary', unit: j.unit, mean: p(j.mean), sd: p(j.sd), sdKind: j.sdKind, ...(j.n !== undefined ? { n: j.n } : {}) };
    case 'attributes':
      return { kind: 'attributes', chart: j.chart, samples: j.samples.map((s: any) => ({ n: s.n, defects: s.defects })) };
    case 'pareto':
      return { kind: 'pareto', items: j.items.map((i: any) => ({ label: i.label, value: p(i.value) })) };
    default:
      throw new Error(`Unknown dataset kind ${j.kind}`);
  }
}

export function exerciseFromJSON(j: any): Exercise {
  const spec: Spec | undefined = j.spec
    ? {
        ...(j.spec.lsl !== undefined ? { lsl: p(j.spec.lsl) } : {}),
        ...(j.spec.usl !== undefined ? { usl: p(j.spec.usl) } : {}),
        ...(j.spec.nominal !== undefined ? { nominal: p(j.spec.nominal) } : {}),
        ...(j.spec.designation ? { designation: j.spec.designation } : {}),
      }
    : undefined;
  return {
    id: j.id,
    origin: j.origin,
    ...(j.sourceNote ? { sourceNote: j.sourceNote } : {}),
    ...(j.sourceUrl ? { sourceUrl: j.sourceUrl } : {}),
    ...(j.seed !== undefined ? { seed: j.seed } : {}),
    ...(j.review ? { review: j.review } : {}),
    difficulty: j.difficulty,
    dataset: j2ds(j.dataset),
    ...(spec ? { spec } : {}),
    rules: j.rules,
    asks: j.asks.map((a: any) => ({ ...a, ...(a.bound !== undefined ? { bound: p(a.bound) } : {}) })),
    weights: j.weights,
    text: j.text,
  };
}
