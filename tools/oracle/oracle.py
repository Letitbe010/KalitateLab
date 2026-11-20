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


# ---------------------------------------------------------------- pool exercises


def raw_values(ds):
    if ds["kind"] == "values":
        return [F(v) for v in ds["values"]]
    if ds["kind"] == "subgroups":
        return [F(v) for g in ds["groups"] for v in g]
    if ds["kind"] == "freq":
        out = []
        for c in ds["classes"]:
            x = F(c["x"]) if "x" in c else (F(c["a"]) + F(c["b"])) / 2
            out += [x] * c["f"]
        return out
    return None


def rbar_d2(groups):
    gs = [[F(v) for v in g] for g in groups]
    n = len(gs[0])
    rbar = sum(max(g) - min(g) for g in gs) / len(gs)
    return float(rbar / k(n, "d2"))


def sbar_c4(groups):
    n = len(groups[0])
    sbar = sum(statistics.stdev([float(F(v)) for v in g]) for g in groups) / len(groups)
    return sbar / float(k(n, "c4"))


def process_stats(ex):
    """(mu, [sigma variants]) following the exercise rules; first variant is the primary answer."""
    ds, rules = ex["dataset"], ex["rules"]
    if ds["kind"] == "summary":
        return float(F(ds["mean"])), [float(F(ds["sd"]))]
    xs = raw_values(ds)
    mu = float(sum(xs) / len(xs))
    s = float(np.sqrt(float(statistics.variance(xs))))
    sig = float(np.sqrt(float(statistics.pvariance(xs))))
    rule = rules.get("sigmaHat")
    if rule == "either":
        return mu, [rbar_d2(ds["groups"]), s]
    if rule == "Rbar/d2":
        return mu, [rbar_d2(ds["groups"])]
    if rule == "sbar/c4":
        return mu, [sbar_c4(ds["groups"])]
    return mu, {"s": [s], "sigma": [sig], "either": [s, sig]}[rules["sd"]]


def pop_fraction(ask, ex, mu, sd):
    if "bound" in ask:
        b = float(F(ask["bound"]))
        return float(norm.cdf((b - mu) / sd)) if ask["side"] in ("lt", "le") else float(norm.sf((b - mu) / sd))
    sp = ex.get("spec", {})
    tails = ask.get("tails", "outside")
    p = 0.0
    if tails != "above" and "lsl" in sp:
        p += float(norm.cdf((float(F(sp["lsl"])) - mu) / sd))
    if tails != "below" and "usl" in sp:
        p += float(norm.sf((float(F(sp["usl"])) - mu) / sd))
    return p


def cap_indices(ex, mu, sd):
    sp = ex["spec"]
    lsl = float(F(sp["lsl"])) if "lsl" in sp else None
    usl = float(F(sp["usl"])) if "usl" in sp else None
    out = {}
    if usl is not None:
        out["cpu"] = (usl - mu) / (3 * sd)
    if lsl is not None:
        out["cpl"] = (mu - lsl) / (3 * sd)
    if usl is not None and lsl is not None:
        out["cp"] = (usl - lsl) / (6 * sd)
    out["cpk"] = min(out.get("cpu", np.inf), out.get("cpl", np.inf))
    return out


def verdict(v, th):
    return "not" if v < th[0] else "marginal" if v < th[1] else "capable"


def solve_pool(ex):
    ds, rules = ex["dataset"], ex["rules"]
    res = {}
    for ask in ex["asks"]:
        t, aid = ask["type"], ask["id"]
        if t == "mean":
            xs = raw_values(ds)
            res[aid] = [float(F(ds["mean"]))] if xs is None else [float(sum(xs) / len(xs))]
        elif t == "sd":
            xs = raw_values(ds)
            s = float(np.sqrt(float(statistics.variance(xs))))
            sig = float(np.sqrt(float(statistics.pvariance(xs))))
            res[aid] = {"s": [s], "sigma": [sig], "either": [s, sig]}[rules["sd"]]
        elif t == "pctSample":
            xs = raw_values(ds)
            b = F(ask["bound"])
            test = {"lt": lambda x: x < b, "le": lambda x: x <= b, "gt": lambda x: x > b, "ge": lambda x: x >= b}[ask["side"]]
            res[aid] = [100 * sum(1 for x in xs if test(x)) / len(xs)]
        elif t == "pctPopulation":
            mu, sds = process_stats(ex)
            res[aid] = [100 * pop_fraction(ask, ex, mu, sd) for sd in sds]
        elif t == "z":
            mu, sds = process_stats(ex)
            res[aid] = [(float(F(ask["bound"])) - mu) / sd for sd in sds]
        elif t in ("cp", "cpk", "cpu", "cpl"):
            mu, sds = process_stats(ex)
            res[aid] = [cap_indices(ex, mu, sd)[t] for sd in sds]
        elif t == "capable":
            mu, sds = process_stats(ex)
            th = rules.get("capableThresholds", [1, 1.33])
            res[aid] = sorted({verdict(cap_indices(ex, mu, sd)[ask.get("index", "cp")], th) for sd in sds})
        elif t == "centered":
            sp = ex["spec"]
            mu = F(ds["mean"]) if ds["kind"] == "summary" else sum(raw_values(ds)) / len(raw_values(ds))
            mid = (F(sp["lsl"]) + F(sp["usl"])) / 2
            res[aid] = ["yes" if mu == mid else "USL" if mu > mid else "LSL"]
        elif t == "sigmaHat":
            rule = rules.get("sigmaHat", "s")
            xs = raw_values(ds)
            s = float(np.sqrt(float(statistics.variance(xs))))
            res[aid] = {"s": [s], "Rbar/d2": [rbar_d2(ds["groups"])] if ds["kind"] == "subgroups" else None,
                        "sbar/c4": [sbar_c4(ds["groups"])] if ds["kind"] == "subgroups" else None,
                        "either": [rbar_d2(ds["groups"]), s] if ds["kind"] == "subgroups" else None}[rule]
        elif t in ("controlLimits", "outOfControl"):
            chart = ask.get("chart")
            if ds["kind"] == "subgroups":
                if rules.get("sigmaHat") == "sbar/c4" or chart == "s":
                    n = len(ds["groups"][0])
                    means = [float(sum(F(v) for v in g) / n) for g in ds["groups"]]
                    sds_ = [statistics.stdev([float(F(v)) for v in g]) for g in ds["groups"]]
                    xbb = float(sum(sum(F(v) for v in g) / n for g in ds["groups"]) / len(ds["groups"]))
                    sbar = sum(sds_) / len(sds_)
                    if chart == "s":
                        L = (sbar, float(k(n, "B4")) * sbar, float(k(n, "B3")) * sbar)
                        pts = sds_
                    else:
                        w = float(k(n, "A3")) * sbar
                        L = (xbb, xbb + w, xbb - w)
                        pts = means
                    out = [i + 1 for i, p in enumerate(pts) if p > L[1] or p < L[2]]
                    res[aid] = list(L) if t == "controlLimits" else out
                else:
                    r = xbar_r(ds["groups"])
                    if t == "controlLimits":
                        res[aid] = [float(F(r["xbarbar"])), float(F(r["uclX"])), float(F(r["lclX"]))] if chart == "xbar" else [float(F(r["rbar"])), float(F(r["uclR"])), float(F(r["lclR"]))]
                    else:
                        res[aid] = r["outXbar"] if chart == "xbar" else r["outR"]
            else:
                a = attributes(ds["chart"], ds["samples"])
                if t == "controlLimits":
                    l0 = a["limits"][0]
                    res[aid] = [float(l0["cl"]), l0["ucl"], l0["lcl"]]
                else:
                    res[aid] = a["out"]
        elif t == "pareto":
            r = pareto([[i["label"], i["value"]] for i in ds["items"]], rules.get("paretoThreshold", 80), rules.get("paretoRule", "crossing"))
            res[aid] = {"order": [x["label"] for x in r["rows"]], "cumPct": [float(Fraction(x["cumPct"])) for x in r["rows"]], "classA": r["classA"]}
        else:
            raise ValueError(t)
    return res


def main():
    out_path, golden_path = Path(sys.argv[1]), Path(sys.argv[2])
    golden = json.loads(golden_path.read_text(encoding="utf8"))
    pool_path = Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "src/data/pool.json"
    pool = json.loads(pool_path.read_text(encoding="utf8"))
    res = {
        "golden": [{"id": c["id"], "kind": c["kind"], "result": golden_case(c)} for c in golden["cases"]],
        "random": random_cases(np.random.default_rng(20261119)),
        "pool": [{"id": e["id"], "result": solve_pool(e)} for e in pool],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf8")
    print(f"oracle: {len(res['golden'])} golden + {len(res['random'])} random + {len(res['pool'])} pool cases -> {out_path}")


if __name__ == "__main__":
    main()
