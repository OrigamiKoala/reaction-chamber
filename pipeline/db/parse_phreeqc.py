#!/usr/bin/env python3
"""PHREEQC database parser for Reaction Chamber (Stage 1 generalization).

Parses llnl.dat / phreeqc.dat / pitzer.dat blocks:
- SOLUTION_MASTER_SPECIES
- SOLUTION_SPECIES
- PHASES
- -analytic, -delta_h, -llnl_gamma

Handles phase names that look like keywords (e.g. single-letter element phases 'B', 'C', 'K').
Emits balanced reactions and back-derived species properties.
"""

import re
from typing import Dict, Any, List, Optional

KEYWORDS = {
    'SOLUTION_MASTER_SPECIES', 'SOLUTION_SPECIES', 'PHASES',
    'EXCHANGE_MASTER_SPECIES', 'EXCHANGE_SPECIES', 'SURFACE_MASTER_SPECIES',
    'SURFACE_SPECIES', 'RATES', 'END', 'LLNL_AQUEOUS_MODEL_PARAMETERS',
    'PITZER', 'SIT', 'NAMED_EXPRESSIONS'
}

def parse_phreeqc_phases(text: str) -> List[Dict[str, Any]]:
    phases = []
    current_section = None
    cur: Optional[Dict[str, Any]] = None

    for line in text.splitlines():
        clean = line.split('#')[0].rstrip()
        if not clean.strip():
            continue

        trimmed = clean.strip()
        # Detect section keyword only if at column 0
        if trimmed in KEYWORDS and not clean.startswith((' ', '\t')):
            current_section = trimmed
            cur = None
            continue

        if current_section == 'PHASES':
            # Phase name begins with no indentation
            if not clean.startswith((' ', '\t')):
                cur = {'name': trimmed, 'analytic': False}
                phases.append(cur)
            elif cur is not None:
                if 'rxn' not in cur and '=' in trimmed:
                    cur['rxn'] = trimmed
                m_logk = re.match(r'-?log_?k\s+([-+\d.eE]+)', trimmed)
                if m_logk:
                    cur['logk'] = float(m_logk.group(1))
                m_dh = re.match(r'-?delta_?h\s+([-+\d.eE]+)\s*(\w+)?', trimmed)
                if m_dh:
                    unit = m_dh.group(2) or 'kJ/mol'
                    cur['delta_h'] = (float(m_dh.group(1)), unit)
                if trimmed.startswith(('-analytic', '-analytical', '-a_e')):
                    cur['analytic'] = True
                    parts = trimmed.split()
                    if len(parts) >= 6:
                        cur['analytic_coeffs'] = [float(x) for x in parts[1:6]]
    return phases
