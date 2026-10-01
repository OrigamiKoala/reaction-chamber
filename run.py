#!/usr/bin/env python3
"""
Reaction Chamber — One-command launch script.
Starts the local server, opens the browser with the session token,
or runs the M7 data flywheel to generate training data for the ML model.
"""
import sys
import os
import argparse
from pathlib import Path

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from server.main import start_server
from server.flywheel_runner import run_flywheel
from server.storage import get_flywheel_stats, export_ml_training_data

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Launch Reaction Chamber or Data Flywheel")
    parser.add_argument("--host", default="127.0.0.1", help="Host (default 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default 8000)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser automatically")
    parser.add_argument("--flywheel", action="store_true", help="Run the M7 data flywheel to generate ML barrier data")
    parser.add_argument("--flywheel-count", type=int, default=20, help="Number of barrier jobs to compute in flywheel run (default: 20)")
    parser.add_argument("--flywheel-workers", type=int, default=1, help="Concurrent worker count for flywheel (default: 1)")
    parser.add_argument("--flywheel-continuous", action="store_true", help="Run flywheel continuously in background")
    parser.add_argument("--flywheel-stats", action="store_true", help="Show current flywheel statistics")
    parser.add_argument("--export-ml", type=str, default="", help="Export ML training dataset to path (e.g. dataset.json)")
    args = parser.parse_args()

    if args.flywheel_stats:
        stats = get_flywheel_stats()
        print("📊 Reaction Chamber Flywheel Statistics:")
        for k, v in stats.items():
            print(f"  {k}: {v}")
        sys.exit(0)

    if args.export_ml:
        out = Path(args.export_ml)
        data = export_ml_training_data(out)
        print(f"✅ Exported {len(data)} ML training samples to {out.resolve()}")
        sys.exit(0)

    if args.flywheel:
        run_flywheel(count=args.flywheel_count, continuous=args.flywheel_continuous, workers=args.flywheel_workers, verbose=True)
        sys.exit(0)

    start_server(host=args.host, port=args.port, open_browser=not args.no_browser)
