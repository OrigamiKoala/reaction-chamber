"""The elements the engine's periodic table (engine/src/ions.rs ATOMIC_MASS) knows; data rows with any other element are dropped."""
import re
from pathlib import Path

_SRC = Path(__file__).resolve().parents[2] / "engine" / "src" / "ions.rs"


def known_elements():
    text = _SRC.read_text()
    i = text.index("ATOMIC_MASS")
    j = text.index("];", i)
    return set(re.findall(r'\("([A-Z][a-z]?)",\s*[\d.]+\)', text[i:j]))
