"""Reads `.env` from the repository root into the process environment (no extra package).

Lines are `NAME=value` (an optional leading `export`, `#` comments, optional single or double quotes). A variable that is
already set in the real environment is never overwritten, so Vercel's / the shell's values win over the file. An empty value
counts as not set. The file holds secrets: it is in `.gitignore`; `.env.example` is the committed template.
"""
import os
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def load_env_file(path: Path = ENV_PATH) -> int:
    """Loads `path` if it exists; returns the number of variables it set."""
    if not path.is_file():
        return 0
    n = 0
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        name, _, value = line.partition("=")
        name, value = name.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        if name and value and not os.environ.get(name):
            os.environ[name] = value
            n += 1
    return n
