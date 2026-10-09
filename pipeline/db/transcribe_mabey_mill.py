#!/usr/bin/env python3
"""Transcribes measured rate constants from W. Mabey and T. Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)
(doi 10.1063/1.555572; open reprint https://srd.nist.gov/jpcrdreprint/1.555572.pdf) into pipeline/data/rates_measured.csv.

Every value below was read from the page images of that reprint (Tables 4.1, 4.2, 4.6, 4.8, 4.10, 4.11, 5.1-5.3, 5.6; printed pages 390-411) and
re-read at 200 dpi against the table cells. A value that is not in those tables is not in this file. Rows of the earlier
CSV that came from memory (other sources, other tables, page numbers that do not exist) are kept, flagged `recalled`, in
pipeline/data/rates_unverified.csv by `split_old_csv()` and are NOT compiled into the engine.

Conversions (all stated in the row's `value_basis` / `notes`):
* Table 4.1 (alkyl halides, kN): the table gives kN at one temperature plus Eyring parameters at 323.2 K and DeltaCp:
  log10 k = -dH/(R' T) + dS/R' + log10 T + 10.32, R' = 0.01914 kJ/(mol K) (= 2.303 R), dH(T) = dH(323.2) + dCp (T - 323.2),
  dS(T) = dS(323.2) + dCp ln(T/323.2). The script evaluates k at 298.15 K and checks that the same formula reproduces
  the tabulated kN at its own temperature to 8 % (a transcription check). Ea = dH(298.15) + R T.
* Table 4.2 (methyl halides, kB at 373 K) and Table 4.10 (amides, kA at 348 K): the measured k at that temperature with the
  tabulated activation energy (E_A, or dH + R T).
* Table 4.8 (aliphatic esters): kB / kA at 298 K unless the table footnotes another temperature; Ea (E, or dH + R T) where given.

Run: python3 pipeline/db/transcribe_mabey_mill.py   (needs RDKit; writes the CSV, then run build_rates_measured.py)
"""
import csv
import hashlib
import math
import shutil
from pathlib import Path

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem

RDLogger.DisableLog('rdApp.*')
ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "pipeline" / "data" / "rates_measured.csv"
UNVERIFIED_PATH = ROOT / "pipeline" / "data" / "rates_unverified.csv"
R = 8.314462618e-3  # kJ/(mol K)
RP = 0.01914  # the paper's R, kJ/(mol K) = 2.303 R

SRC = "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)"
DOI = "10.1063/1.555572"
LICENCE = "AIP / NIST SRD open reprint: flagged in docs/data-licences.md"

COLUMNS = ["kind", "template", "reactants", "products", "k", "k_unit", "t_k", "ea_kj_mol", "ea_source", "orders", "solvent",
           "solvent_class", "ionic_strength_m", "medium", "ph_or_h_conc", "source", "table_or_page", "doi", "licence",
           "extracted_by", "checked_by", "held_out", "notes", "status", "value_basis"]


def smi(m):
    return Chem.MolToSmiles(m)


def ester_products(ester, acid_form):
    """Carboxylate (or acid) and alcohol / phenol of an ester, by RDKit."""
    rxn = AllChem.ReactionFromSmarts("[C:1](=[O:2])[O:3][#6:4]>>[C:1](=[O:2])[OX2H1].[#6:4][O:3]" if acid_form else
                                     "[C:1](=[O:2])[O:3][#6:4]>>[C:1](=[O:2])[O-].[#6:4][O:3]")
    ps = rxn.RunReactants((Chem.MolFromSmiles(ester),))[0]
    out = []
    for p in ps:
        Chem.SanitizeMol(p)
        out.append(smi(p))
    return out


def amide_products(amide):
    rxn = AllChem.ReactionFromSmarts("[C:1](=[O:2])[N:3]>>[C:1](=[O:2])[OX2H1].[N:3]")
    ps = rxn.RunReactants((Chem.MolFromSmiles(amide),))[0]
    out = []
    for p in ps:
        Chem.SanitizeMol(p)
        out.append(smi(p))
    return out


def amide_products_base(amide):
    """Carboxylate and amine of an amide hydrolysed by hydroxide."""
    rxn = AllChem.ReactionFromSmarts("[C:1](=[O:2])[N:3]>>[C:1](=[O:2])[O-].[N:3]")
    out = []
    for p in rxn.RunReactants((Chem.MolFromSmiles(amide),))[0]:
        Chem.SanitizeMol(p)
        out.append(smi(p))
    return out


def carbamate_products(carbamate):
    """Carbamate anion and alcohol / phenol of a carbamate attacked by hydroxide at the carbonyl carbon (the carbamate anion
    then loses CO2; the template stops at the anion, as the ester template stops at the carboxylate)."""
    rxn = AllChem.ReactionFromSmarts("[C:1](=[O:2])([O:3][#6:4])[N:5]>>[C:1](=[O:2])([O-])[N:5].[#6:4][O:3]")
    out = []
    for p in rxn.RunReactants((Chem.MolFromSmiles(carbamate),))[0]:
        Chem.SanitizeMol(p)
        out.append(smi(p))
    return out


rows = []
SKIPPED = []


def add(template, reactants, products, k, unit, t_k, ea, ea_source, table, notes, value_basis="measured", orders="{}"):
    rows.append(dict(
        kind="organic", template=template, reactants=";".join(reactants), products=";".join(products), k=f"{k:.6g}", k_unit=unit,
        t_k=f"{t_k:.2f}", ea_kj_mol="" if ea is None else f"{ea:.2f}", ea_source=ea_source, orders=orders, solvent="water",
        solvent_class="water", ionic_strength_m="", medium="aq", ph_or_h_conc="", source=SRC, table_or_page=table, doi=DOI,
        licence=LICENCE, extracted_by="transcribed from the open reprint page images (this repository, 2026-10-08)",
        checked_by="second read of the page image at 200 dpi", held_out="False", notes=notes, status="verified", value_basis=value_basis))


# ------------------------------------------------------------------------------------------ Table 4.8, base: kB
# (name, ester SMILES, kB M-1 s-1, T K, Ea kJ/mol or None, Ea source, page, note)
P396, P397 = "Table 4.8, p. 396", "Table 4.8 (cont.), p. 397"
BASE = [
    ("methyl formate", "O=COC", 36.6, 298.15, 40.0, "E (ref 5)", P396, "second methyl formate row; the first (28.6 at 293.3 K, dH 41.0) is not used"),
    ("ethyl formate", "O=COCC", 25.7, 298.15, 37.4, "E (ref 5)", P396, ""),
    ("propyl formate", "O=COCCC", 22.8, 298.15, 35.6, "E (ref 5)", P396, ""),
    ("butyl formate", "O=COCCCC", 21.8, 298.15, 33.5, "E (ref 5)", P396, ""),
    ("methyl acetate", "CC(=O)OC", 0.179, 298.15, None, "", P396, ""),
    ("ethyl acetate", "CC(=O)OCC", 0.1077, 298.15, None, "", P396, "ref 7; ref 12 gives 0.111"),
    ("propyl acetate", "CC(=O)OCCC", 0.0970, 298.15, None, "", P396, "ref 12; ref 10 gives 0.0655 at 293 K"),
    ("butyl acetate", "CC(=O)OCCCC", 0.065, 293.2, 44.4 + R * 293.2, "dH 44.4 + RT (ref 8)", P396, "measured at 293.2 K (footnote d); 0.0705 at 293 K in ref 10"),
    ("isopropyl acetate", "CC(=O)OC(C)C", 0.0262, 298.15, None, "", P396, ""),
    ("sec-butyl acetate", "CC(=O)OC(C)CC", 0.01738, 298.15, None, "", P396, ""),
    ("cyclopentyl acetate", "CC(=O)OC1CCCC1", 0.026, 294.1, 49.8 + R * 294.1, "dH 49.8 + RT (ref 8)", P396, "measured at 294.1 K (footnote e)"),
    ("tert-butyl acetate", "CC(=O)OC(C)(C)C", 0.00150, 298.15, None, "", P396, ""),
    ("allyl acetate", "CC(=O)OCC=C", 0.209, 298.15, None, "", P396, ""),
    ("1-methylallyl acetate", "CC(=O)OC(C)C=C", 0.0717, 298.15, None, "", P396, ""),
    ("3-methylpent-1-en-3-yl acetate", "CC(=O)OC(C)(CC)C=C", 0.00400, 298.15, None, "", P396, ""),
    ("but-3-yn-2-yl acetate", "CC(=O)OC(C)C#C", 0.365, 298.15, None, "", P396, ""),
    ("benzyl acetate", "CC(=O)OCc1ccccc1", 0.197, 298.15, None, "", P396, ""),
    ("phenyl acetate", "CC(=O)Oc1ccccc1", 1.37, 298.15, None, "", P396, "ref 10"),
    ("2,4-dinitrophenyl acetate", "CC(=O)Oc1ccc([N+](=O)[O-])cc1[N+](=O)[O-]", 94.0, 298.15, None, "", P396, "ref 9"),
    ("ethyl chloroacetate", "ClCC(=O)OCC", 36.7, 298.15, None, "", P397, ""),
    ("4-nitrophenyl chloroacetate", "ClCC(=O)Oc1ccc([N+](=O)[O-])cc1", 5920.0, 298.15, None, "", P397, ""),
    ("methyl dichloroacetate", "ClC(Cl)C(=O)OC", 2830.0, 298.15, None, "", P397, ""),
    ("ethyl dichloroacetate", "ClC(Cl)C(=O)OCC", 883.0, 298.15, None, "", P397, ""),
    ("phenyl chloroacetate", "ClCC(=O)Oc1ccccc1", 12800.0, 298.15, None, "", P397, ""),
    ("ethyl difluoroacetate", "FC(F)C(=O)OCC", 4500.0, 298.15, None, "", P397, ""),
    ("ethyl (methylthio)acetate", "CCOC(=O)CSC", 0.92, 298.15, None, "", P397, "ref 15"),
    ("ethyl (methylsulfinyl)acetate", "CCOC(=O)CS(C)=O", 4.2, 298.15, None, "", P397, "ref 15"),
    ("ethyl (methylsulfonyl)acetate", "CCOC(=O)CS(C)(=O)=O", 12.8, 298.15, None, "", P397, "ref 15"),
    ("ethyl propionate", "CCC(=O)OCC", 0.087, 298.15, 44.85, "E (ref 18)", P397, "ref 17 gives 0.059 at 293 K"),
    ("ethyl butyrate", "CCCC(=O)OCC", 0.038, 298.15, 43.18, "E (ref 18)", P397, "ref 17 gives 0.035 at 293 K"),
    ("ethyl isobutyrate", "CC(C)C(=O)OCC", 0.023, 293.2, 42.55, "E (ref 19)", P397, "measured at 293.2 K (footnote d)"),
    ("ethyl acrylate", "C=CC(=O)OCC", 0.078, 298.15, 50.00, "E (ref 20)", P397, "ref 17 gives 0.064 at 293 K"),
    ("ethyl crotonate (trans)", "CC=CC(=O)OCC", 0.013, 298.15, 53.22, "E (ref 20)", P397, "trans; stereochemistry is not part of the structural key"),
    ("ethyl propiolate", "C#CC(=O)OCC", 4.68, 298.15, 51.30, "E (ref 20)", P397, ""),
    ("ethyl 2-butynoate", "CC#CC(=O)OCC", 0.568, 298.15, 53.16, "E (ref 20)", P397, ""),
]
for name, ester, k, t, ea, eas, page, note in BASE:
    prods = ester_products(ester, acid_form=False)
    add("base_ester_hydrolysis", [ester, "[OH-]"], prods, k, "M^-1 s^-1", t, ea, eas, page, f"{name}, kB. {note}".strip())

# ------------------------------------------------------------------------------------------ Table 4.8, acid: kA x 1e-4
ACID = [
    ("methyl acetate", "CC(=O)OC", 1.133e-4, 298.15, P396, ""),
    ("ethyl acetate", "CC(=O)OCC", 1.097e-4, 298.15, P396, ""),
    ("propyl acetate", "CC(=O)OCCC", 1.100e-4, 298.15, P396, ""),
    ("butyl acetate", "CC(=O)OCCCC", 1.133e-4, 298.15, P396, ""),
    ("isopropyl acetate", "CC(=O)OC(C)C", 0.600e-4, 298.15, P396, ""),
    ("benzyl acetate", "CC(=O)OCc1ccccc1", 1.09e-4, 298.15, P396, ""),
    ("phenyl acetate", "CC(=O)Oc1ccccc1", 0.782e-4, 298.15, P396, "ref 10"),
    ("methyl dichloroacetate", "ClC(Cl)C(=O)OC", 2.33e-4, 298.15, P397, ""),
    ("ethyl propionate", "CCC(=O)OCC", 0.33e-4, 293.0, P397, "measured at 293 K (footnote c)"),
    ("ethyl butyrate", "CCCC(=O)OCC", 0.18e-4, 293.0, P397, "measured at 293 K (footnote c)"),
    ("ethyl acrylate", "C=CC(=O)OCC", 0.012e-4, 293.0, P397, "measured at 293 K (footnote c)"),
    ("ethyl crotonate (trans)", "CC=CC(=O)OCC", 0.063e-4, 293.0, P397, "measured at 293 K (footnote c)"),
]
for name, ester, k, t, page, note in ACID:
    add("acid_ester_hydrolysis_acid", [ester, "O"], ester_products(ester, acid_form=True), k, "M^-1 s^-1", t, None, "", page,
        f"{name}, kA (rate = kA [H+] [ester]). {note}".strip())

# ------------------------------------------------------------------------------------------ Table 4.10: amides, acid, 348 K
P401 = "Table 4.10, p. 401"
AMIDES = [  # (name, SMILES, 1e4 kA at 348 K, dH_A kJ/mol)
    ("acetamide", "CC(N)=O", 10.3, 80.3),
    ("propionamide", "CCC(N)=O", 12.0, 75.7),
    ("valeramide", "CCCCC(N)=O", 5.93, 78.2),
    ("isovaleramide", "CC(C)CC(N)=O", 1.29, 81.7),
    ("phenylacetamide", "NC(=O)Cc1ccccc1", 5.19, 75.3),
    ("methoxyacetamide", "COCC(N)=O", 8.98, 79.1),
    ("chloroacetamide", "ClCC(N)=O", 12.1, 78.2),
    ("bromoacetamide", "BrCC(N)=O", 4.79, 77.4),
    ("cyclohexanecarboxamide", "NC(=O)C1CCCCC1", 3.96, 84.6),
    ("2-methylbutanamide", "CCC(C)C(N)=O", 1.51, 87.0),
    ("N-methylacetamide", "CC(=O)NC", 0.582, 87.0),
    ("N-ethylacetamide", "CC(=O)NCC", 0.233, 92.5),
    ("N,N-dimethylacetamide", "CC(=O)N(C)C", 0.654, 81.6),
    ("N-ethyl-N-methylacetamide", "CC(=O)N(C)CC", 0.102, None),
    ("N,N-diethylacetamide", "CC(=O)N(CC)CC", 0.0227, None),
]
for name, a, k4, dh in AMIDES:
    add("amide_hydrolysis_acid", [a, "O"], amide_products(a), k4 * 1e-4, "M^-1 s^-1", 348.0, None if dh is None else dh + R * 348.0,
        "" if dh is None else "dH_A + RT", P401, f"{name}, kA at 348 K (rate = kA [H+] [amide])")

# ------------------------------------------------------------------------------------------ alkyl halides: kN at 298 K (Table 5.2)
# The review's own evaluated kN at 298 K and pH 7 (Tables 5.1, 5.2, p. 408). Where Table 4.1 gives Eyring parameters (dH, dS at 323.2 K,
# dCp) that reproduce its own tabulated kN to 8 % the activation energy Ea = dH(298.15) + R T is taken from them; where the table
# footnotes a "calculated value" that disagrees with its kN the parameters are not trusted and the rule's Ea is kept.
# (name, SMILES, template, kN(298 K) s-1, (T_meas, kN_meas, dH(323.2), dS(323.2) J/mol/K, -dCp J/mol/K) or None)
HAL = [
    ("chloromethane", "CCl", "halide_neutral_hydrolysis", 2.37e-8, (363.1, 5.64e-5, 105.7, -37.2, 218)),
    ("bromomethane", "CBr", "halide_neutral_hydrolysis", 4.09e-7, (343.7, 1.065e-4, 101.0, -27.8, 195)),
    ("iodomethane", "CI", "halide_neutral_hydrolysis", 7.28e-8, (353.2, 8.19e-5, 108.6, -16.5, 237)),
    ("chloroethane", "CCCl", "halide_neutral_hydrolysis", 2.10e-7, (373.2, 1.148e-4, 104.4, -21.9, 209)),
    ("bromoethane", "CCBr", "halide_neutral_hydrolysis", 2.64e-7, (371.8, 1.395e-3, 101.5, -29.7, 209)),
    ("iodoethane", "CCI", "halide_neutral_hydrolysis", 1.62e-7, (371.8, 8.78e-4, 107.1, -15.1, 209)),
    ("1-bromopropane", "CCCBr", "halide_neutral_hydrolysis", 3.04e-7, (353.2, 1.614e-4, 97.4, -42.3, 209)),
    ("2-chloropropane", "CC(C)Cl", "sn1_ionisation", 2.12e-7, (371.8, 1.00e-3, 104.4, -22.0, 161)),
    ("2-bromopropane", "CC(C)Br", "sn1_ionisation", 3.86e-6, (323.2, 1.129e-4, 101.9, -5.98, 236)),
    ("2-iodopropane", "CC(C)I", "sn1_ionisation", 2.77e-6, (353.2, 2.75e-3, 106.8, 7.78, 247)),
    ("tert-butyl chloride", "CC(C)(C)Cl", "sn1_ionisation", 3.02e-2, (287.2, 6.36e-3, 91.8, 34.8, 188)),
    ("benzyl chloride", "ClCc1ccccc1", "halide_neutral_hydrolysis", 1.28e-5, None),
]


def eyring(t, dh1, ds1, dcp):
    """k (s-1) and Ea (kJ/mol) at t from the paper's Eyring parameters at 323.2 K (dCp in kJ/mol/K, negative)."""
    dh = dh1 + dcp * (t - 323.2)
    ds = ds1 / 1000.0 + dcp * math.log(t / 323.2)
    logk = -dh / (RP * t) + ds / RP + math.log10(t) + 10.32
    return 10 ** logk, dh + R * t


for name, s_, tpl, k298, ey in HAL:
    ea, ea_src, note = None, "", f"{name}, kN at 298 K (evaluated by the review)"
    if ey is not None:
        tm, km, dh1, ds1, cp = ey
        dcp = -cp / 1000.0
        k_chk, _ = eyring(tm, dh1, ds1, dcp)
        if abs(math.log10(k_chk / km)) <= math.log10(1.08):
            _, ea = eyring(298.15, dh1, ds1, dcp)
            ea_src = "dH(298.15) + RT from Table 4.1 dH(323.2) and dCp"
        else:
            SKIPPED.append(f"{name}: Table 4.1 Eyring parameters give {k_chk:.3e} at {tm} K, table {km:.3e}: Ea not taken")
    m = Chem.MolFromSmiles(s_)
    hyd = Chem.MolToSmiles(AllChem.ReactionFromSmarts("[C:1][Cl,Br,I:2]>>[C:1]O").RunReactants((m,))[0][0])
    sym = [a for a in m.GetAtoms() if a.GetSymbol() in ("Cl", "Br", "I")][0].GetSymbol()
    if tpl == "sn1_ionisation":
        # the measured first-order solvolysis rate is the ionisation rate: the carbocation is trapped much faster than it forms
        cation = Chem.MolToSmiles(AllChem.ReactionFromSmarts("[C:1][Cl,Br,I:2]>>[C+:1]").RunReactants((m,))[0][0])
        add(tpl, [s_], [cation, f"[{sym}-]"], k298, "s^-1", 298.15, ea, ea_src, "Table 5.2, p. 408", note + " (solvolysis rate taken as the ionisation rate)",
            value_basis="evaluated at 298 K by the review from its tabulated temperature coefficients; the overall solvolysis rate is the ionisation rate when trapping is fast")
        continue
    add(tpl, [s_, "O"], [hyd, "[H+]", f"[{sym}-]"], k298, "s^-1", 298.15, ea, ea_src, "Table 5.2, p. 408" if name != "benzyl chloride" else "Table 5.1, p. 408",
        note, value_basis="evaluated at 298 K by the review from its tabulated temperature coefficients")

# ------------------------------------------------------------------------------------------ methyl halides + OH-: kB at 298 K (Table 5.1) with E_A (Table 4.2)
for name, s_, kb_oh, ea, logA, prod in [("chloromethane", "CCl", 6.18e-13, 101.7, 12.614, "[Cl-]"), ("bromomethane", "CBr", 1.41e-11, 96.3, 13.017, "[Br-]"),
                                         ("iodomethane", "CI", 6.47e-12, 92.9, 12.093, "[I-]")]:
    add("sn2_substitution", [s_, "[OH-]"], ["CO", prod], kb_oh / 1e-7, "M^-1 s^-1", 298.15, ea, "E_A (Table 4.2, measured at 373 K)", "Table 5.1, p. 408",
        f"{name} + OH-: kB[OH-] = {kb_oh:.3g} s-1 at pH 7 divided by [OH-] = 1e-7 M; E_A and log A = {logA} from Table 4.2 (kB measured at 373 K)",
        value_basis="evaluated at 298 K by the review from its Arrhenius parameters (Table 4.2)")

# ------------------------------------------------------------------------------------------ Table 4.6: benzylic halides measured at 293-303 K
for name, s_, t, k5, note in [("4-methylbenzyl chloride", "Cc1ccc(CCl)cc1", 303.0, 86.2e-5, ""),
                              ("benzyl bromide", "BrCc1ccccc1", 303.0, 27.5e-5, ""),
                              ("4-methylbenzyl bromide", "Cc1ccc(CBr)cc1", 293.0, 140.6e-5, ""),
                              ("2-methylbenzyl bromide", "Cc1ccccc1CBr", 293.0, 56.0e-5, "")]:
    m = Chem.MolFromSmiles(s_)
    hal = [a for a in m.GetAtoms() if a.GetSymbol() in ("Cl", "Br")][0].GetSymbol()
    hyd = Chem.MolToSmiles(AllChem.ReactionFromSmarts("[C:1][Cl,Br:2]>>[C:1]O").RunReactants((m,))[0][0])
    add("halide_neutral_hydrolysis", [s_, "O"], [hyd, "[H+]", "[Cl-]" if hal == "Cl" else "[Br-]"], k5, "s^-1", t, None, "", "Table 4.6, p. 392",
        f"{name}, kN at {t} K. {note}".strip())

# ------------------------------------------------------------------------------------------ extra esters from Table 5.6 (p. 411), kB = kB[OH-] / 1e-7
add("base_ester_hydrolysis", ["ClCC(=O)OC", "[OH-]"], ester_products("ClCC(=O)OC", False), 1.4e-5 / 1e-7, "M^-1 s^-1", 298.15, None, "", "Table 5.6, p. 411",
    "methyl chloroacetate, kB[OH-] = 1.4e-5 s-1 at pH 7 divided by 1e-7 M", value_basis="evaluated at 298 K by the review")
add("acid_ester_hydrolysis_acid", ["ClCC(=O)OC", "O"], ester_products("ClCC(=O)OC", True), 8.5e-12 / 1e-7, "M^-1 s^-1", 298.15, None, "", "Table 5.6, p. 411",
    "methyl chloroacetate, kA[H+] = 8.5e-12 s-1 at pH 7 divided by 1e-7 M", value_basis="evaluated at 298 K by the review")


# ------------------------------------------------------------------------------------------ Table 4.10: amides, base (kB), 348 K
# Same page as the acid rows: 10^4 kB / M-1 s-1 and the activation enthalpy dH_B (kJ/mol); Ea = dH_B + RT. Rows named
# "dimethylacetamide", "t-butylacetamide" and "diethylacetamide" in the C-substituted block are left out: the table does not
# say which carbon carries the substituents. chloro-, dichloro- and trichloroacetamide have a kB only.
AMIDES_B = [  # (name, SMILES, 1e4 kB at 348 K, dH_B kJ/mol or None)
    ("acetamide", "CC(N)=O", 13.6, 55.31),
    ("propionamide", "CCC(N)=O", 13.1, 61.7),
    ("valeramide", "CCCCC(N)=O", 5.52, 60.58),
    ("isovaleramide", "CC(C)CC(N)=O", 1.97, 72.68),
    ("phenylacetamide", "NC(=O)Cc1ccccc1", 17.7, 49.25),
    ("cyclohexylacetamide", "NC(=O)CC1CCCCC1", 1.77, 68.87),
    ("trimethylacetamide (pivalamide)", "CC(C)(C)C(N)=O", 2.57, 71.1),
    ("methoxyacetamide", "COCC(N)=O", 8.56, 56.2),
    ("chloroacetamide", "ClCC(N)=O", 1400.0, None),
    ("dichloroacetamide", "ClC(Cl)C(N)=O", 18400.0, None),
    ("trichloroacetamide", "ClC(Cl)(Cl)C(N)=O", 135000.0, None),
    ("cyclohexanecarboxamide", "NC(=O)C1CCCCC1", 4.24, 53.6),
    ("2-methylbutanamide", "CCC(C)C(N)=O", 1.65, 64.2),
    ("N-methylacetamide", "CC(=O)NC", 3.58, 69.4),
    ("N-ethylacetamide", "CC(=O)NCC", 1.80, 67.4),
    ("N-isopropylacetamide", "CC(=O)NC(C)C", 0.367, 73.2),
    ("N,N-dimethylacetamide", "CC(=O)N(C)C", 5.18, 63.2),
    ("N,N-diethylacetamide", "CC(=O)N(CC)CC", 0.1167, 75.3),
    ("N-ethyl-N-methylacetamide", "CC(=O)N(C)CC", 0.983, 67.8),
]
for name, a, k4, dh in AMIDES_B:
    add("amide_base_hydrolysis", [a, "[OH-]"], amide_products_base(a), k4 * 1e-4, "M^-1 s^-1", 348.0, None if dh is None else dh + R * 348.0,
        "" if dh is None else "dH_B + RT", P401, f"{name}, kB at 348 K (rate = kB [OH-] [amide])")
# acid rows of the same table that the first pass skipped (names unambiguous): cyclohexylacetamide, pivalamide, N-isopropylacetamide
for name, a, k4, dh in [("cyclohexylacetamide", "NC(=O)CC1CCCCC1", 1.24, 87.03), ("trimethylacetamide (pivalamide)", "CC(C)(C)C(N)=O", 2.26, 83.3),
                        ("N-isopropylacetamide", "CC(=O)NC(C)C", 0.090, None)]:
    add("amide_hydrolysis_acid", [a, "O"], amide_products(a), k4 * 1e-4, "M^-1 s^-1", 348.0, None if dh is None else dh + R * 348.0,
        "" if dh is None else "dH_A + RT", P401, f"{name}, kA at 348 K (rate = kA [H+] [amide])")

# ------------------------------------------------------------------------------------------ Table 4.11: carbamates, kB at 298 K
# Skipped: phenyl N-phenylcarbamate (the table value 4.7(-1) contradicts its own footnote f, 5.2(1) from the temperature
# coefficients, and the other workers' 5.42(1)); 1-naphthyl N-methylcarbamate (carbaryl: 3.4 is stated at 296 K and the
# tabulated Arrhenius line gives 0.46 at 298 K) and its N,N-dimethyl analogue (4.55(-5) against 1.4e-7 from its line);
# 4-nitrophenyl N-methylcarbamate (kB 3.0(-3), eight orders below the N-phenyl analogue although both eliminate through the
# isocyanate: the row cannot be reconciled with its neighbours, reference 3 only).
P403 = "Table 4.11, p. 403"
CARB = [  # (SMILES, kB M-1 s-1 at 298 K, dH_B kJ/mol or None, note)
    ("COC(=O)Nc1ccccc1", 5.5e-5, None, "methyl N-phenylcarbamate"),
    ("CCOC(=O)Nc1ccccc1", 3.3e-5, 66.5, "ethyl N-phenylcarbamate"),
    ("CCOC(=O)N(C)c1ccccc1", 5.0e-6, 54.0, "ethyl N-methyl-N-phenylcarbamate"),
    ("O=C(N(C)c1ccccc1)Oc1ccccc1", 4.2e-5, 62.8, "phenyl N-methyl-N-phenylcarbamate"),
    ("COc1ccc(OC(=O)Nc2ccccc2)cc1", 25.2, None, "4-methoxyphenyl N-phenylcarbamate"),
    ("O=C(Nc1ccccc1)Oc1cccc(Cl)c1", 1830.0, None, "3-chlorophenyl N-phenylcarbamate"),
    ("O=C(Nc1ccccc1)Oc1ccc([N+](=O)[O-])cc1", 2.71e5, None, "4-nitrophenyl N-phenylcarbamate (measured at pH 6.5)"),
    ("CN(C(=O)Oc1ccc([N+](=O)[O-])cc1)c1ccccc1", 7.98e-4, None, "4-nitrophenyl N-methyl-N-phenylcarbamate"),
    ("CCN(CC)CCOC(=O)Nc1ccccc1", 2.6e-5, 73.2, "2-(diethylamino)ethyl N-phenylcarbamate"),
    ("CCN(CC)CCOC(=O)Nc1c(C)cc(C)cc1C", 9.2e-7, 103.3, "2-(diethylamino)ethyl N-mesitylcarbamate"),
    ("C[N+](C)(C)c1cccc(OC(=O)NC)c1", 0.67, 76.6, "3-(trimethylammonio)phenyl N-methylcarbamate"),
    ("C[N+](C)(C)c1cccc(OC(=O)N(C)C)c1", 2.8e-4, 59.4, "3-(trimethylammonio)phenyl N,N-dimethylcarbamate"),
    ("ClCCOC(=O)Nc1ccccc1", 1.59e-3, None, "2-chloroethyl N-phenylcarbamate"),
    ("ClC(Cl)COC(=O)Nc1ccccc1", 5.00e-2, None, "2,2-dichloroethyl N-phenylcarbamate"),
    ("ClC(Cl)(Cl)COC(=O)Nc1ccccc1", 0.316, None, "2,2,2-trichloroethyl N-phenylcarbamate"),
    ("FC(F)(F)COC(=O)Nc1ccccc1", 0.100, None, "2,2,2-trifluoroethyl N-phenylcarbamate"),
]
for sm, kb, dh, note in CARB:
    add("carbamate_base_hydrolysis", [sm, "[OH-]"], carbamate_products(sm), kb, "M^-1 s^-1", 298.15, None if dh is None else dh + R * 298.15,
        "" if dh is None else "dH_B + RT", P403, f"{note}, kB at 298 K")

# ------------------------------------------------------------------------------------------ Table 5.3: allyl halides (kh = kN at 298 K, pH 7)
# The benzylic rows of the same table are derived by the review from the 293-303 K data of Table 4.6 (footnote b), which are
# already in this file, and are not repeated.
for name, s_, k298 in [("allyl chloride", "C=CCCl", 1.157e-7), ("allyl bromide", "C=CCBr", 1.674e-5), ("allyl iodide", "C=CCI", 4.01e-6)]:
    m = Chem.MolFromSmiles(s_)
    hyd = Chem.MolToSmiles(AllChem.ReactionFromSmarts("[C:1][Cl,Br,I:2]>>[C:1]O").RunReactants((m,))[0][0])
    sym = [a for a in m.GetAtoms() if a.GetSymbol() in ("Cl", "Br", "I")][0].GetSymbol()
    add("halide_neutral_hydrolysis", [s_, "O"], [hyd, "[H+]", f"[{sym}-]"], k298, "s^-1", 298.15, None, "", "Table 5.3, p. 409",
        f"{name}, kh = kN at 298 K and pH 7 (the review assumes no base catalysis)")

# ------------------------------------------------------------------------------------------ Table 4.18 (p. 407): methyl chloroformate
# The only acyl halide of the table with a clean kN in water at 298 K (benzoyl chloride is in 70:30 water-acetone, dimethylcarbamoyl
# chloride is a lower bound). The product is the monomethyl carbonate (which then loses CO2).
add("acyl_halide_substitution", ["COC(=O)Cl", "O"], ["COC(=O)O", "[H+]", "[Cl-]"], 5.642e-4, "s^-1", 298.15, None, "", "Table 4.18, p. 407",
    "methyl chloroformate, kN at 298 K (5.642 +- 0.002e-4)")

# ------------------------------------------------------------------------------------------ Tables 4.12-4.14: phosphonate and phosphate esters
# Table 4.12 (acid, kA x 1e5 M-1 s-1) and Table 4.13 (base, kB x 1e4 M-1 s-1) list dialkyl alkylphosphonates R1P(O)(OR2)2 at the
# temperature shown (322-393 K, not 298 K: the row carries its T), with E (kJ/mol; the paper's R' = 2.303 R makes E the activation energy
# itself) where a line is given; the tabulated lines were checked against the tabulated k (all within 10 %). Table 4.14 (kB) lists
# phosphate triesters; only rows in water are used (acetone / water and dioxane / water rows, (EtS)3PO, paraoxon, the mixed
# (MeO)2P(O)OEt whose leaving group is not stated, and every kN, whose C-O mechanism has no template here, are not).
P405, P404 = "Table 4.13, p. 405", "Table 4.12, p. 404"
NP = "c1ccc([N+](=O)[O-])cc1"
# (R1, R2 name, SMILES of the diester, leaving alcohol, hydroxide: T, 1e4 kB, E) / (acid: T, 1e5 kA, E)
PHOS = [
    ("Me", "Me", "COP(C)(=O)OC", "CO", (322.8, 146.0, 56.5), (372.8, 1.14, 111.6)),
    ("Me", "Et", "CCOP(C)(=O)OCC", "CCO", (333.0, 26.0, 58.6), (382.0, 2.05, 111.6)),
    ("Me", "i-Pr", "CC(C)OP(C)(=O)OC(C)C", "CC(C)O", (353.0, 0.153, 62.3), (366.6, 12.86, 107.0)),
    ("Me", "t-BuCH2", "CC(C)(C)COP(C)(=O)OCC(C)(C)C", "CC(C)(C)CO", (361.0, 0.958, None), (376.0, 0.944, None)),
    ("Et", "Et", "CCOP(=O)(CC)OCC", "CCO", (342.5, 17.8, 59.4), None),
    ("Et", "i-Pr", "CCP(=O)(OC(C)C)OC(C)C", "CC(C)O", (377.9, 1.06, 67.8), (365.5, 3.4, 108.7)),
    ("n-Pr", "n-Pr", "CCCOP(=O)(CCC)OCCC", "CCCO", (368.0, 3.58, None), None),
    ("n-Pr", "i-Pr", "CCCP(=O)(OC(C)C)OC(C)C", "CC(C)O", (382.9, 0.516, 66.5), (369.0, 4.9, 108.7)),
    ("C6H5", "Et", "CCOP(=O)(OCC)c1ccccc1", "CCO", (332.8, 44.7, None), (374.0, 1.05, 111.5)),
    ("n-Bu", "Et", "CCCCP(=O)(OCC)OCC", "CCO", None, (383.0, 1.05, None)),
    ("n-Bu", "i-Pr", "CCCCP(=O)(OC(C)C)OC(C)C", "CC(C)O", None, (369.0, 6.47, None)),
    ("t-Bu", "Me", "COP(=O)(OC)C(C)(C)C", "CO", None, (393.0, 2.25, None)),
    ("t-Bu", "i-Pr", "CC(C)OP(=O)(OC(C)C)C(C)(C)C", "CC(C)O", None, (388.2, 32.8, None)),
    ("Me", "C6H5", "CP(=O)(Oc1ccccc1)Oc1ccccc1", "Oc1ccccc1", None, (383.0, 0.50, None)),
]
for r1, r2, sm, alc, base, acid in PHOS:
    name = f"dialkyl {r1}-phosphonate, OR = {r2}"
    # monoester: replace one OR2 by O- (or OH): done on the SMILES string, all OR2 groups being equal
    rx_a = AllChem.ReactionFromSmarts("[P:1][O:2][#6:3]>>[P:1][O-:2].[#6:3][O]")
    rx_h = AllChem.ReactionFromSmarts("[P:1][O:2][#6:3]>>[P:1][OH:2].[#6:3][O]")
    mol = Chem.MolFromSmiles(sm)
    if base is not None:
        ps = rx_a.RunReactants((mol,))[0]
        out = []
        for q in ps:
            Chem.SanitizeMol(q)
            out.append(smi(q))
        t, k4, e = base
        add("phosphoryl_ester_base_hydrolysis", [sm, "[OH-]"], out, k4 * 1e-4, "M^-1 s^-1", t, e, "E of the tabulated line" if e else "", P405,
            f"{name}, kB at {t} K (rate = kB [OH-] [ester]; the table does not state the medium, no co-solvent is flagged)")
    if acid is not None:
        ps = rx_h.RunReactants((mol,))[0]
        out = []
        for q in ps:
            Chem.SanitizeMol(q)
            out.append(smi(q))
        t, k5, e = acid
        add("phosphoryl_ester_acid_hydrolysis_acid", [sm, "O"], out, k5 * 1e-5, "M^-1 s^-1", t, e, "E of the tabulated line" if e else "", P404,
            f"{name}, kA at {t} K (rate = kA [H+] [ester])", orders="{}")
# p-nitrophenyl ethyl methylphosphonate: base releases p-nitrophenol (Table 4.13 footnote c), acid releases ethanol (Table 4.12 footnote c)
NPE = "CCOP(C)(=O)Oc1ccc([N+](=O)[O-])cc1"
add("phosphoryl_ester_base_hydrolysis", [NPE, "[OH-]"], ["CCOP(C)(=O)[O-]", "Oc1ccc([N+](=O)[O-])cc1"], 400e-4, "M^-1 s^-1", 298.0, 50.2, "E of the tabulated line",
    P405, "ethyl p-nitrophenyl methylphosphonate, kB at 298 K (the product is p-nitrophenol, footnote c)")
add("phosphoryl_ester_acid_hydrolysis_acid", [NPE, "O"], ["CP(=O)(O)Oc1ccc([N+](=O)[O-])cc1", "CCO"], 1.53e-5, "M^-1 s^-1", 383.4, None, "", P404,
    "ethyl p-nitrophenyl methylphosphonate, kA at 383.4 K (the product is ethanol, footnote c)")
# Table 4.14, p. 405: kB of the phosphate triesters in water (log kB = 8.1 - 67.8/RT for trimethyl phosphate)
P405b = "Table 4.14, p. 405"
add("phosphoryl_ester_base_hydrolysis", ["COP(=O)(OC)OC", "[OH-]"], ["COP(=O)([O-])OC", "CO"], 1.3e-4, "M^-1 s^-1", 298.0, 67.8, "E of the tabulated line", P405b,
    "trimethyl phosphate, kB at 298 K")
add("phosphoryl_ester_base_hydrolysis", ["CCOP(=O)(OCC)OCC", "[OH-]"], ["CCOP(=O)([O-])OCC", "CCO"], 4.49e-2, "M^-1 s^-1", 374.0, None, "", P405b,
    "triethyl phosphate, kB at 374 K (the 298 K value of the table is in dioxane / water and is not used)")
add("phosphoryl_ester_base_hydrolysis", ["O=P(Oc1ccccc1)(Oc1ccccc1)Oc1ccccc1", "[OH-]"], ["O=P([O-])(Oc1ccccc1)Oc1ccccc1", "Oc1ccccc1"], 1.06e-2, "M^-1 s^-1",
    298.0, 45.9, "E of the tabulated line (the table notes the original reference miscalculated A and E)", P405b, "triphenyl phosphate, kB at 298 K")

# ------------------------------------------------------------------------------------------ Table 4.18, p. 407: alkylating agents
# Beta-propiolactone: kN 3.3e-3 s-1 at 298 K. The tabulated line (log kN = 10.04 - 81.59/RT) gives 5.5e-5 s-1 at 298 K, 60 times below the
# tabulated k, so A is taken from k and only E = 81.59 kJ/mol is kept. 1,3-propane sultone: kN 2.15e-5 s-1. Dimethyl sulfate: kN 1.66e-4
# s-1 and kB 1.48e-2 M-1 s-1. Bis(chloromethyl) ether (kN 1.8e-2 s-1 at 293 K, log kN = 9.80 - 64.78/RT, no acid / base term) has no template
# (it is an alpha-halo ether, SN1-like through the oxocarbenium ion). Aziridine, azobenzene-type, captan, methoxychlor, atrazine: see
# docs/plans/rates-from-data-plan.md 14.2 (atrazine's tabulated 7.6e-5 s-1 would be a 2.5 h half-life against a year in the literature: not used).
P407 = "Table 4.18, p. 407"
add("sn1_ionisation", ["ClCOCCl"], ["ClCO[CH2+]", "[Cl-]"], 1.8e-2, "s^-1", 293.0, 64.78,
    "E of the tabulated line (footnote d: its log A, 9.80, was calculated from k and E)", P407,
    "bis(chloromethyl) ether, kN at 293 K; no acid or base term was observed. The print shows 1.8( 2) with the sign of the exponent lost: "
    "the tabulated line, whose A was calculated from this k, gives 1.8e-2 s-1 at 293 K, so that is the value")
add("lactone_neutral_hydrolysis", ["O=C1CCO1", "O"], ["OCCC(=O)[O-]", "[H+]"], 3.3e-3, "s^-1", 298.15, 81.59,
    "E of the tabulated line (its log A, 10.04, does not reproduce the tabulated k, so A is fitted to k)", P407,
    "beta-propiolactone, kN at 298 K (no acid or base term tabulated)")
add("alkyl_sulfate_neutral_hydrolysis", ["O=S1(=O)CCCO1", "O"], ["OCCCS(=O)(=O)[O-]", "[H+]"], 2.15e-5, "s^-1", 298.15, None, "", P407,
    "1,3-propane sultone, kN at 298 K")
add("alkyl_sulfate_neutral_hydrolysis", ["COS(=O)(=O)OC", "O"], ["CO", "COS(=O)(=O)[O-]", "[H+]"], 1.66e-4, "s^-1", 298.15, None, "", P407,
    "dimethyl sulfate, kN at 298 K")
add("alkyl_sulfate_base_hydrolysis", ["COS(=O)(=O)OC", "[OH-]"], ["CO", "COS(=O)(=O)[O-]"], 1.48e-2, "M^-1 s^-1", 298.15, None, "", P407,
    "dimethyl sulfate, kB at 298 K")

# ------------------------------------------------------------------------------------------ held out: every 4th row of a rule class, by hash
ESTER_SIGNATURE = [Chem.MolFromSmarts(x) for x in ("[CX3;H1](=O)O", "[CX3]([CX4][F,Cl,Br])", "[CX3][OX2]c", "[CX3][OX2][CX4;H1]", "[CX3][OX2][CX4;H0]", "[CX3][CX3]=[CX3]", "[CX3][CX4][CX4]", "[CX3][CX4][SX3,SX4]=O")]


def rule_class(r):
    """Rows that can inform one another share a class: the rule they fall under and, for esters, the structural features the rule
    fit uses (formate, alpha halogen, aryl ester, secondary / tertiary alkoxy carbon, conjugated acyl). Held-out rows are taken only from classes of
    >= 4 rows, so a feature that the fit needs is never held out entirely (the held-out error then measures interpolation within the
    classes seen in training, which is what a rule can be asked for)."""
    t = r["template"]
    if t in ("sn1_ionisation", "halide_neutral_hydrolysis", "sn2_substitution"):
        m = Chem.MolFromSmiles(r["reactants"].split(";")[0])
        c = [a for a in m.GetAtoms() if a.GetSymbol() in ("Cl", "Br", "I")][0].GetNeighbors()[0]
        kind = "benzylic" if any(n.GetIsAromatic() for n in c.GetNeighbors()) else "allylic" if any(any(b.GetBondTypeAsDouble() == 2 for b in n.GetBonds()) for n in c.GetNeighbors()) else "alkyl"
        return f"{t}/{c.GetTotalNumHs()}H/{kind}"
    if t.startswith("phosphoryl_ester"):
        # the leaving-group classes the rule distinguishes (secondary: ~1000 x slower in base; neopentyl; methoxy: ~10 x faster than
        # ethoxy): a class with a single row is never held out, so the alkoxy effects stay in training where they can be fitted
        m = Chem.MolFromSmiles(r["reactants"].split(";")[0])
        has = lambda sma: m.HasSubstructMatch(Chem.MolFromSmarts(sma))
        kind = ("aryl" if has("P(=O)Oc") else "triester" if not has("P[#6]") else "secondary" if has("P(=O)O[CX4;H1]") else
                "neopentyl" if has("P(=O)O[CX4][CX4;D4]") else "methoxy" if has("P(=O)O[CH3]") else "primary")
        return f"{t}/{kind}"
    if t == "carbamate_base_hydrolysis":
        m = Chem.MolFromSmiles(r["reactants"].split(";")[0])
        # N,N-disubstituted (4 rows) and N-H aryl esters (4 rows spanning six orders of magnitude, an interpolation set in the
        # leaving-group acidity) are too small to hold a row out of: each row is its own class, so none is held out
        if not m.HasSubstructMatch(Chem.MolFromSmarts("[NX3;H1]C(=O)O")) or m.HasSubstructMatch(Chem.MolFromSmarts("C(=O)([NX3;H1])Oc")):
            return t + "/" + r["reactants"]
        return t + "/NH-alkyl-O"
    if t in ("base_ester_hydrolysis", "acid_ester_hydrolysis_acid"):
        m = Chem.MolFromSmiles(r["reactants"].split(";")[0])
        return t + "/" + "".join("1" if m.HasSubstructMatch(p) else "0" for p in ESTER_SIGNATURE)
    return t


# Textbook reactions of the bench are never held out: they must run on their measured values, not on the rule's estimate.
PINNED = {("base_ester_hydrolysis", "CC(=O)OCC"), ("base_ester_hydrolysis", "CC(=O)OC"),
          ("acid_ester_hydrolysis_acid", "CC(=O)OC"), ("acid_ester_hydrolysis_acid", "CC(=O)OCC"),
          ("sn1_ionisation", "CC(C)(C)Cl"), ("sn2_substitution", "CBr"),
          ("phosphoryl_ester_base_hydrolysis", "COP(=O)(OC)OC")}
by_t = {}
for r in rows:
    r["held_out"] = "False"
    if (r["template"], r["reactants"].split(";")[0]) in PINNED:
        continue
    by_t.setdefault(rule_class(r), []).append(r)
for t, rs in by_t.items():
    rs.sort(key=lambda r: hashlib.md5(r["reactants"].encode()).hexdigest())
    for i, r in enumerate(rs):
        r["held_out"] = str(i % 4 == 3 and len(rs) >= 4)


def split_old_csv():
    """Moves the rows of the previous CSV (values written from memory, citations not checked) to rates_unverified.csv once."""
    if UNVERIFIED_PATH.exists() or not CSV_PATH.exists():
        return
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        old = list(csv.DictReader(f))
    if old and "status" in old[0]:
        return
    with open(UNVERIFIED_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in old:
            r["status"] = "recalled"
            r["value_basis"] = "written from memory; the cited table / page was not opened and is partly wrong (checked 2026-10-08)"
            r["checked_by"] = "NOT verified"
            r["extracted_by"] = "recalled"
            w.writerow({c: r.get(c, "") for c in COLUMNS})
    shutil.copy(UNVERIFIED_PATH, UNVERIFIED_PATH.with_suffix(".csv.bak"))


def main():
    split_old_csv()
    # the redox rows of the old file stay in the engine table as recalled / Speculative (see build_rates_measured.py)
    redox = []
    if UNVERIFIED_PATH.exists():
        with open(UNVERIFIED_PATH, newline="", encoding="utf-8") as f:
            redox = [r for r in csv.DictReader(f) if r["kind"] == "redox"]
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow(r)
        for r in redox:
            w.writerow({c: r.get(c, "") for c in COLUMNS})
    for line in SKIPPED:
        print("skipped (table kN and Eyring parameters disagree by > 8 %):", line)
    n_ho = sum(r["held_out"] == "True" for r in rows)
    print(f"wrote {len(rows)} verified organic rows ({n_ho} held out) and {len(redox)} recalled redox rows to {CSV_PATH}")


if __name__ == "__main__":
    main()
