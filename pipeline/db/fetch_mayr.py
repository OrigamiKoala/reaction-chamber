#!/usr/bin/env python3
"""Fetch the detail pages of Mayr's Database of Reactivity Parameters (https://www.cup.lmu.de/oc/mayr/reaktionsdatenbank/)
into pipeline/raw/mayr/details/<id>.html (raw, not committed). Polite: 4 workers, retries, skips what is already on disk.
Usage: fetch_mayr.py [max_id]"""
import os, sys, time, urllib.request, concurrent.futures as cf

BASE = "https://www.cup.lmu.de/oc/mayr/reaktionsdatenbank/fe/details/"
OUT = os.path.join(os.path.dirname(__file__), "..", "raw", "mayr", "details")

def get(i):
    path = os.path.join(OUT, f"{i}.html")
    if os.path.exists(path) and os.path.getsize(path) > 500:
        return i, "cached"
    for attempt in range(4):
        try:
            req = urllib.request.Request(BASE + str(i), headers={"User-Agent": "reaction-chamber-data-pipeline/1.0 (research)"})
            data = urllib.request.urlopen(req, timeout=30).read()
            open(path, "wb").write(data)
            time.sleep(0.15)
            return i, "ok"
        except Exception as e:
            time.sleep(1 + attempt)
    return i, "fail"

if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2200
    os.makedirs(OUT, exist_ok=True)
    with cf.ThreadPoolExecutor(4) as ex:
        res = list(ex.map(get, range(1, n + 1)))
    from collections import Counter
    print(Counter(s for _, s in res))
