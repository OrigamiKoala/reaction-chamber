import os
import sys
from pathlib import Path

# tblite / OpenMP: the molecules in the tests are tiny, and a thread per core only spins (the m7 suite spent ~12 s of
# system time in 9 s wall; with one thread 4 s). Set before anything imports tblite; an explicit setting still wins.
os.environ.setdefault("OMP_NUM_THREADS", "1")

root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
