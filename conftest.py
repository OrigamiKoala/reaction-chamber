import os
import sys
from pathlib import Path

# OpenMP (numpy / scipy / RDKit): the test inputs are tiny, and a thread per core only spins. An explicit setting wins.
os.environ.setdefault("OMP_NUM_THREADS", "1")

root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
