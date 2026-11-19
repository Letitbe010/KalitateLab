"""
KalitateLab Python oracle (spec section 5.4).

Solves the golden cases and a fixed set of seeded random cases with Python's `statistics`
(exact Fractions), `numpy` and `scipy.stats.norm`, independently of the TypeScript code, and
writes the inputs and results to JSON. tests/oracle.test.ts recomputes every case with the
TypeScript solvers A and B and compares.

Usage: python tools/oracle/oracle.py <out.json> <golden.json>
"""
import json
import statistics
import sys
from fractions import Fraction
from pathlib import Path

import numpy as np
from scipy.stats import norm

ROOT = Path(__file__).resolve().parents[2]
CONST = json.loads((ROOT / "src/data/constants.json").read_text(encoding="utf8"))["n"]


def F(s):
    """Exact Fraction from a decimal string with comma or point."""
    return Fraction(str(s).replace(",", "."))


def k(n, name):
    return F(CONST[str(n)][name])


def describe(values):
    xs = [F(v) for v in values]
    mean = sum(xs) / len(xs)
    var_p = statistics.pvariance(xs)  # exact Fraction
    var_s = statistics.variance(xs)
    arr = np.array([float(v) for v in xs])
    return {
        "mean": str(mean),
        "varPop": str(var_p),
        "varSample": str(var_s),
        "sigma": float(np.sqrt(float(var_p))),
        "s": float(np.sqrt(float(var_s))),
        "sigmaNumpy": float(np.std(arr, ddof=0)),
        "sNumpy": float(np.std(arr, ddof=1)),
    }


def defects(mu, sigma, lsl, usl):
    zl = (lsl - mu) / sigma
    zu = (usl - mu) / sigma
    below = float(norm.cdf(zl))
    above = float(norm.sf(zu))
    return {"zL": zl, "zU": zu, "below": below, "above": above, "total": below + above}


def capability(lsl, usl, mu, sigma):
    cpu = (usl - mu) / (3 * sigma)
    cpl = (mu - lsl) / (3 * sigma)
    return {"cp": (usl - lsl) / (6 * sigma), "cpu": cpu, "cpl": cpl, "cpk": min(cpu, cpl)}


def xbar_r(groups):
    gs = [[F(v) for v in g] for g in groups]
    n = len(gs[0])
    means = [sum(g) / n for g in gs]
    ranges = [max(g) - min(g) for g in gs]
    xbb = sum(means) / len(gs)
    rbar = sum(ranges) / len(gs)
    ucl, lcl = xbb + k(n, "A2") * rbar, xbb - k(n, "A2") * rbar
    uclr, lclr = k(n, "D4") * rbar, k(n, "D3") * rbar
    return {
        "xbarbar": str(xbb),
        "rbar": str(rbar),
        "uclX": str(ucl),
        "lclX": str(lcl),
        "uclR": str(uclr),
        "lclR": str(lclr),
        "sigmaHat": str(rbar / k(n, "d2")),
        "outXbar": [i + 1 for i, m in enumerate(means) if m > ucl or m < lcl],
        "outR": [i + 1 for i, r in enumerate(ranges) if r > uclr or r < lclr],
    }


def attributes(chart, samples):
    N = sum(s["n"] for s in samples)
    T = sum(s["defects"] for s in samples)
    rows = []
    for s in samples:
        n, d = s["n"], s["defects"]
        if chart == "p":
            cl = T / N
            x = d / n
            sd = np.sqrt(cl * (1 - cl) / n)
        elif chart == "np":
            p = T / N
            cl = n * p
            x = d
            sd = np.sqrt(n * p * (1 - p))
        elif chart == "c":
            cl = T / len(samples)
            x = d
            sd = np.sqrt(cl)
        else:
            cl = T / N
            x = d / n
            sd = np.sqrt(cl / n)
        ucl, lcl_raw = cl + 3 * sd, cl - 3 * sd
        rows.append({"cl": cl, "ucl": float(ucl), "lclRaw": float(lcl_raw), "lcl": max(0.0, float(lcl_raw)), "x": x})
    out = [i + 1 for i, r in enumerate(rows) if r["x"] > r["ucl"] or r["x"] < r["lcl"]]
    return {"limits": rows, "out": out}


def pareto(items, threshold, rule):
    vals = [(lab, F(v), i) for i, (lab, v) in enumerate(items)]
    vals.sort(key=lambda t: (-t[1], t[2]))
    total = sum(v for _, v, _ in vals)
    cum = Fraction(0)
    rows, cls = [], []
    for lab, v, _ in vals:
        cum += v * 100 / total
        rows.append({"label": lab, "cumPct": str(cum)})
    for r in rows:
        c = Fraction(r["cumPct"])
        if rule == "within":
            if c <= threshold:
                cls.append(r["label"])
            else:
                break
        else:
            cls.append(r["label"])
            if c >= threshold:
                break
    return {"total": str(total), "rows": rows, "classA": cls}


def golden_case(c):
    i = c["input"]
    kind = c["kind"]
    fl = lambda key: float(F(i[key]))  # noqa: E731
    if kind == "capabilitySummary":
        return capability(fl("lsl"), fl("usl"), fl("mu"), fl("sigma"))
    if kind == "populationDefects":
        return defects(fl("mu"), fl("sigma"), fl("lsl"), fl("usl"))
    if kind == "xbarRLimits":
        n, xbb, rbar = i["n"], F(i["xbarbar"]), F(i["rbar"])
        return {
            "uclX": str(xbb + k(n, "A2") * rbar),
            "lclX": str(xbb - k(n, "A2") * rbar),
            "uclR": str(k(n, "D4") * rbar),
            "lclR": str(k(n, "D3") * rbar),
            "sigmaHat": str(rbar / k(n, "d2")),
        }
    if kind == "pLimits":
        p, n = fl("pbar"), i["n"]
        sd = float(np.sqrt(p * (1 - p) / n))
        return {"sigmaP": sd, "ucl": p + 3 * sd, "lclRaw": p - 3 * sd, "lcl": max(0.0, p - 3 * sd)}
    if kind == "freqTable":
        values = [x for x, f in i["classes"] for _ in range(f)]
        return describe(values)
    if kind == "pareto":
        return pareto(i["items"], i["threshold"], i["rule"])
    raise ValueError(kind)


def random_cases(rng):
    cases = []
    for _ in range(60):  # raw values with 1-3 decimals
        dig = int(rng.integers(1, 4))
        n = int(rng.integers(3, 60))
        vals = [f"{v / 10**dig:.{dig}f}" for v in rng.integers(-5000, 5000, n)]
        cases.append({"kind": "describe", "input": {"values": vals}, "result": describe(vals)})
    for _ in range(60):  # normal tails
        mu = float(rng.uniform(19.9, 20.1))
        sigma = float(rng.uniform(0.003, 0.05))
        lsl, usl = 19.94, 20.06
        cases.append({"kind": "defects", "input": {"mu": mu, "sigma": sigma, "lsl": lsl, "usl": usl}, "result": defects(mu, sigma, lsl, usl)})
    zs = [round(float(z), 3) for z in np.linspace(-6, 6, 241)]
    cases.append({"kind": "phi", "input": {"z": zs}, "result": {"cdf": [float(norm.cdf(z)) for z in zs], "sf": [float(norm.sf(z)) for z in zs]}})
    for t in range(40):  # X-bar R
        n = int(rng.integers(2, 11))
        kk = int(rng.integers(5, 26))
        g = rng.normal(40.0, 0.01, (kk, n))
        if t % 3 == 0:
            g[int(rng.integers(0, kk))] += 0.02  # a shifted subgroup
        groups = [[f"{v:.3f}" for v in row] for row in g]
        cases.append({"kind": "xbarR", "input": {"groups": groups}, "result": xbar_r(groups)})
    for t, chart in enumerate(["p", "np", "c", "u"] * 10):
        kk = int(rng.integers(8, 26))
        const = chart in ("np", "c")
        n0 = int(rng.integers(50, 300))
        samples = []
        for _ in range(kk):
            n = n0 if const else int(rng.integers(50, 300))
            if chart in ("p", "np"):
                d = int(rng.binomial(n, 0.05))
            else:
                d = int(rng.poisson(6 if chart == "c" else 0.04 * n))
            samples.append({"n": n, "defects": d})
        if t % 2 == 0:
            j = int(rng.integers(0, kk))
            samples[j]["defects"] = min(samples[j]["n"], samples[j]["defects"] + 15)
        cases.append({"kind": "attributes", "input": {"chart": chart, "samples": samples}, "result": attributes(chart, samples)})
    for t in range(30):
        m = int(rng.integers(3, 9))
        items = [[chr(65 + j), str(int(rng.integers(1, 50)) * 100)] for j in range(m)]
        rule = "crossing" if t % 2 else "within"
        cases.append({"kind": "pareto", "input": {"items": items, "threshold": 80, "rule": rule}, "result": pareto(items, 80, rule)})
    return cases


def main():
    out_path, golden_path = Path(sys.argv[1]), Path(sys.argv[2])
    golden = json.loads(golden_path.read_text(encoding="utf8"))
    res = {
        "golden": [{"id": c["id"], "kind": c["kind"], "result": golden_case(c)} for c in golden["cases"]],
        "random": random_cases(np.random.default_rng(20261119)),
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf8")
    print(f"oracle: {len(res['golden'])} golden + {len(res['random'])} random cases -> {out_path}")


if __name__ == "__main__":
    main()
