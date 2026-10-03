#!/usr/bin/env python3
"""Builds ``engine/data/optics_seed.json``: the optical seed rows of the species store (Stage 10, item 1).

This replaces the hand-written ``match`` tables of the old ``engine/src/spectra.rs`` (21 band rows, 9 solid rows, 11 fume
rows) with *data rows that carry a tier and a source*. They are the lowest-effort rows to spot check: every value is
recalled from the cited reference (tier ``estimated``), none comes from a database download. They are intrinsic optical
properties of species (absorption bands in a solvent, band gaps, gas cross-sections, molar refractions), never reaction
outcomes; reaction products get their appearance from these rows plus the models in ``engine/src/optics/``.

Run ``python3 pipeline/db/build_optics_seed.py`` to regenerate; ``tests/test_optics_seed.py`` checks the JSON is current.
The measured-set sources of the plan (A8: Joung 2020 / Beard 2019 UV/Vis sets, MPI-Mainz gas atlas, Materials Project band
gaps) replace these rows when the pipeline can fetch them; the row format is the same.
"""
import json
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "engine", "data", "optics_seed.json")
OUT_FLAME = os.path.join(os.path.dirname(__file__), "..", "..", "engine", "data", "flame_emitters.json")

LEGACY = "legacy hand-entered row of engine/src/spectra.rs (2026-10-03), recalled, unverified"


def band(nm, eps, fwhm, solvent="water", kind=None):
    b = {"nm": nm, "eps": eps, "fwhm": fwhm}
    if solvent:
        b["solvent"] = solvent
    if kind:
        b["kind"] = kind
    return b


def datum(value, unit, source, tier="estimated"):
    return {"value": value, "unit": unit, "tier": tier, "source": source}


species = {}


def solute(sid, bands, source, tier="estimated"):
    species[sid] = {"bands": bands, "tier": tier, "source": source}


# ------------------------------------------------------------------------------------------------ solution bands
solute("Cu+2", [band(800, 12, 250, "water", "d-d")], "Lever, Inorganic Electronic Spectroscopy 2nd ed. (1984): [Cu(H2O)6]2+ 12,500 cm-1, eps ~12 (recalled)")
solute("Cu(NH3)4+2", [band(610, 55, 120, "water", "d-d")], "[Cu(NH3)4(H2O)2]2+ lambda_max ~600-610 nm, eps ~55 (recalled)")
solute("Co+2", [band(510, 5, 80, "water", "d-d")], "[Co(H2O)6]2+ 19,400 cm-1, eps ~5 (recalled)")
solute("CoCl4-2", [band(625, 420, 45, "water", "d-d"), band(660, 600, 45, "water", "d-d"), band(690, 480, 45, "water", "d-d")],
       "tetrahedral [CoCl4]2- 4A2 -> 4T1(P) triplet 625-690 nm (recalled)")
solute("HIn_btb", [band(430, 22000, 65, "water", "pi-pi*")], LEGACY)
solute("In_btb-", [band(615, 35000, 65, "water", "pi-pi*")], LEGACY)
solute("HIn_mo", [band(505, 56000, 75, "water", "pi-pi*")], LEGACY)
solute("In_mo-", [band(460, 25000, 65, "water", "pi-pi*")], LEGACY)
solute("HIn_mr", [band(520, 37000, 80, "water", "pi-pi*")], LEGACY)
solute("In_mr-", [band(430, 24000, 70, "water", "pi-pi*")], LEGACY)
solute("In_phph-", [band(552, 31000, 50, "water", "pi-pi*")], LEGACY)
# iodine is solvatochromic: brown in water, violet in alkanes (lambda_max ~ 460 nm vs ~ 520 nm)
solute("I2(aq)", [band(460, 750, 95, "water", "ct"), band(520, 920, 80, "alkane", "ct")],
       "I2 visible band: ~460 nm (eps ~750) in water, ~520 nm (eps ~920) in alkanes (recalled)")
solute("I3-", [band(353, 26400, 60, "water", "ct"), band(460, 975, 80, "water", "ct")],
       "Awtrey & Connick, J. Am. Chem. Soc. 73, 1842 (1951) for the 353 nm band (recalled); the 460 nm row is the legacy hand row")
solute("starch_I3", [band(600, 40000, 100, "water", "ct")], LEGACY)
solute("Fe+3", [band(400, 150, 80, "water", "ct")], LEGACY + " (lumped LMCT tail of the hydroxo species; the aqua d5 ion has no allowed band)")
solute("Fe(SCN)+2", [band(460, 4500, 90, "water", "ct")], "Bent & French, J. Am. Chem. Soc. 63, 568 (1941): 460 nm, eps ~4,600 (recalled)")
solute("MnO4-", [band(525, 2400, 50, "water", "ct"), band(545, 2400, 50, "water", "ct")], "permanganate 526/546 nm doublet, eps ~2,400 (recalled)")
solute("Cr2O7-2", [band(350, 1500, 80, "water", "ct"), band(450, 370, 85, "water", "ct")], "dichromate 350 nm (eps ~1,500) and 450 nm shoulder (recalled)")
solute("CrO4-2", [band(372, 4800, 60, "water", "ct")], "chromate 372 nm, eps ~4,800 (recalled)")
solute("Fe(CN)6-3", [band(420, 1000, 70, "water", "ct")], "ferricyanide 420 nm LMCT, eps ~1,000 (recalled)")
solute("VO+2", [band(770, 17, 140, "water", "d-d"), band(625, 10, 120, "water", "d-d")],
       "Ballhausen & Gray, Inorg. Chem. 1, 111 (1962): [VO(H2O)5]2+ 13,000 and 16,000 cm-1 (recalled)")

# ------------------------------------------------------------------------------------------------ gases
GAS_SRC = "MPI-Mainz UV/VIS Spectral Atlas (Keller-Rudek et al., ESSD 5, 365, 2013): Gaussian envelope of the visible/near-UV continuum, recalled"


def gas(sid, bands):
    species[sid] = {"gas_bands": bands, "tier": "estimated", "source": GAS_SRC}


gas("NO2(g)", [{"nm": 400, "sigma_cm2": 6.0e-19, "fwhm": 160}])
gas("Cl2(g)", [{"nm": 330, "sigma_cm2": 2.55e-19, "fwhm": 90}])
gas("Br2(g)", [{"nm": 415, "sigma_cm2": 1.6e-19, "fwhm": 100}])
gas("I2(g)", [{"nm": 535, "sigma_cm2": 2.5e-18, "fwhm": 80}])
gas("O3(g)", [{"nm": 602, "sigma_cm2": 5.1e-21, "fwhm": 100}])
gas("ClO2(g)", [{"nm": 360, "sigma_cm2": 1.2e-17, "fwhm": 55}])

# ------------------------------------------------------------------------------------------------ solids
BG_SRC = "optical band gap, recalled from Strehlow & Cook, J. Phys. Chem. Ref. Data 2, 163 (1973) / Madelung, Semiconductors Data Handbook (2004); replaced by the Materials Project slice (A7) when the pipeline ships it"

band_gaps = {
    "AgCl(s)": 3.25, "AgBr(s)": 2.6, "AgI(s)": 2.8, "PbI2(s)": 2.5, "HgI2(s)": 2.1, "CdS(s)": 2.42, "ZnS(s)": 3.6,
    "HgS(s)": 0.5, "PbS(s)": 0.41, "Ag2S(s)": 1.0, "CuS(s)": 0.0, "Cu2S(s)": 1.2, "SnS(s)": 1.3, "SnS2(s)": 2.2,
    "Sb2S3(s)": 1.7, "Bi2S3(s)": 1.3, "As2S3(s)": 2.5, "MnS(s)": 3.1, "FeS(s)": 0.1, "NiS(s)": 0.0, "CoS(s)": 0.0,
    "ZnO(s)": 3.3, "TiO2(s)": 3.2, "CuO(s)": 1.4, "Cu2O(s)": 2.1, "Fe2O3(s)": 2.1, "Fe(OH)3(s)": 2.1, "PbO(s)": 2.7,
    "Ag2O(s)": 1.3, "HgO(s)": 2.2, "CdO(s)": 2.2, "Bi2O3(s)": 2.8, "MnO2(s)": 0.3, "PbO2(s)": 1.5,
    "PbCrO4(s)": 2.3, "BaCrO4(s)": 3.0, "Ag2CrO4(s)": 1.8, "Ag3PO4(s)": 2.4, "CuI(s)": 3.1, "CuBr(s)": 2.9,
    "CuCl(s)": 3.3, "PbBr2(s)": 3.9, "PbCl2(s)": 4.9, "BiI3(s)": 1.7,
}
for sid, eg in band_gaps.items():
    species[sid] = {"band_gap_eV": datum(eg, "eV", BG_SRC), "tier": "estimated", "source": BG_SRC}

# metals: the lustre of a metal is a reflectance, taken from the element's measured colour (copper, gold); every
# other single-element metal falls back to a silvery-grey lustre in the engine
COLOUR_SRC = "measured appearance of the element (sRGB of the bulk metal, recalled)"
species["Cu(s)"] = {"colour": {"rgb_linear": [0.479, 0.171, 0.033], "subject": "solid", "confidence": 0.9, "phrase": "copper-coloured metal"},
                    "tier": "estimated", "source": COLOUR_SRC}
species["Au(s)"] = {"colour": {"rgb_linear": [0.658, 0.429, 0.038], "subject": "solid", "confidence": 0.9, "phrase": "yellow metal"},
                    "tier": "estimated", "source": COLOUR_SRC}

# ------------------------------------------------------------------------------------------------ molar refraction (R_D, cm3/mol)
MR_SRC = "Vogel/Eisenlohr molar refractions and Shannon & Fischer (2006) ionic polarisabilities (R = 2.52 alpha / A^3), recalled"
molar_refraction = {
    "H2O": 3.712, "C2H5OH": 12.96, "C3H6O": 16.14, "C6H14": 29.90, "C7H8": 31.06, "OH-": 4.70, "Na+": 0.65, "K+": 2.25,
    "Li+": 0.20, "NH4+": 4.40, "Ag+": 4.30, "Ca+2": 1.33, "Mg+2": 0.45, "Ba+2": 3.80, "Fe+2": 2.20, "Fe+3": 1.80,
    "Cu+2": 1.60, "Zn+2": 1.25, "Cl-": 9.00, "Br-": 12.60, "I-": 19.20, "F-": 2.50, "NO3-": 11.00, "SO4-2": 14.80,
    "HCO3-": 12.80, "CO3-2": 11.50, "CH3COO-": 13.30,
}
for sid, rm in molar_refraction.items():
    rec = species.setdefault(sid, {"tier": "estimated", "source": MR_SRC})
    rec["molar_refraction"] = datum(rm, "cm3/mol", MR_SRC)

# atomic refractions (Eisenlohr / Vogel, cm3/mol) for the additive estimate of species without a row
atomic_refraction = {
    "H": 1.10, "C": 2.42, "N": 2.32, "O": 1.64, "F": 0.81, "Cl": 5.97, "Br": 8.87, "I": 13.90, "S": 7.69, "P": 3.75,
    "Li": 0.2, "Na": 0.65, "K": 2.25, "Mg": 0.45, "Ca": 1.33, "Al": 0.17, "Zn": 1.25, "Fe": 1.8, "Cu": 1.6, "Ag": 4.3,
    "Ba": 3.8, "Pb": 9.0, "Mn": 2.0, "Cr": 2.0, "Ni": 1.5, "Co": 1.5, "Sn": 8.0, "Hg": 8.0, "Cd": 5.0,
}

# ------------------------------------------------------------------------------------------------ flame emitters
# Emission lines per element: wavelength (nm), upper-level statistical weight g_k, Einstein A_ki (1/s), upper-level energy
# E_k (eV), whether the line belongs to the singly ionised species. Ionisation energy and ground-level weights feed the Saha
# equation. Molecular emitters (hydroxides, chlorides) carry the band centre, width, excitation energy, an effective emission
# rate and the bond dissociation energy D0 of M-X that sets how much of the metal is bound at flame temperature.
# Recalled from the NIST Atomic Spectra Database (lines, A, E_k, ionisation energies) and from Pearse & Gaydon, The
# Identification of Molecular Spectra (bands); the pipeline step that reduces the full ASD is not run yet (tier estimated).
FLAME_SRC = "NIST Atomic Spectra Database (lines) and Pearse & Gaydon (molecular bands), recalled; to be replaced by the ASD reduction in the pipeline"


def line(nm, gk, a, ek, ion=False):
    r = {"nm": nm, "gk": gk, "a": a, "ek_ev": ek}
    if ion:
        r["ion"] = True
    return r


def mband(nm, fwhm, e_ev, a_eff, partner="OH", d0_ev=None, label=None):
    return {"nm": nm, "fwhm": fwhm, "e_ev": e_ev, "a_eff": a_eff, "partner": partner, "d0_ev": d0_ev, "label": label}


flame_elements = {
    "Li": {"ionisation_ev": 5.392, "g_atom": 2, "g_ion": 1, "lines": [line(670.78, 6, 3.69e7, 1.848), line(610.36, 10, 7.0e7, 3.879)], "bands": []},
    "Na": {"ionisation_ev": 5.139, "g_atom": 2, "g_ion": 1, "lines": [line(588.995, 4, 6.16e7, 2.104), line(589.592, 2, 6.14e7, 2.102)], "bands": []},
    "K": {"ionisation_ev": 4.341, "g_atom": 2, "g_ion": 1,
          "lines": [line(766.49, 4, 3.87e7, 1.617), line(769.90, 2, 3.82e7, 1.610), line(404.41, 4, 1.16e6, 3.063), line(404.72, 2, 1.4e6, 3.062)], "bands": []},
    "Rb": {"ionisation_ev": 4.177, "g_atom": 2, "g_ion": 1,
           "lines": [line(780.03, 4, 3.81e7, 1.589), line(794.76, 2, 3.61e7, 1.560), line(420.18, 4, 1.77e6, 2.953), line(421.55, 2, 1.5e6, 2.941)], "bands": []},
    "Cs": {"ionisation_ev": 3.894, "g_atom": 2, "g_ion": 1,
           "lines": [line(852.11, 4, 3.28e7, 1.455), line(894.35, 2, 2.87e7, 1.386), line(455.53, 4, 1.88e6, 2.721), line(459.32, 2, 8.0e5, 2.699)], "bands": []},
    "Ca": {"ionisation_ev": 6.113, "g_atom": 1, "g_ion": 2,
           "lines": [line(422.67, 3, 2.18e8, 2.932), line(393.37, 4, 1.47e8, 3.151, True), line(396.85, 2, 1.4e8, 3.123, True)],
           "bands": [mband(554.0, 20.0, 2.24, 4.0e7, "OH", 4.3, "CaOH"), mband(622.0, 18.0, 1.99, 4.0e7, "OH", 4.3, "CaOH")]},
    "Sr": {"ionisation_ev": 5.695, "g_atom": 1, "g_ion": 2,
           "lines": [line(460.73, 3, 2.01e8, 2.690), line(407.77, 4, 1.42e8, 3.04, True), line(421.55, 2, 1.27e8, 2.94, True)],
           "bands": [mband(606.0, 12.0, 2.05, 3.0e7, "OH", 4.2, "SrOH"), mband(646.0, 12.0, 1.92, 3.0e7, "OH", 4.2, "SrOH"), mband(682.0, 15.0, 1.82, 3.0e7, "OH", 4.2, "SrOH"),
                     mband(636.0, 10.0, 1.95, 4.0e7, "Cl", 4.1, "SrCl")]},
    "Ba": {"ionisation_ev": 5.212, "g_atom": 1, "g_ion": 2,
           "lines": [line(553.55, 3, 1.19e8, 2.239), line(455.40, 4, 1.11e8, 2.722, True), line(493.41, 2, 9.5e7, 2.512, True)],
           "bands": [mband(512.0, 18.0, 2.42, 3.0e7, "OH", 4.6, "BaOH"), mband(487.0, 15.0, 2.55, 3.0e7, "OH", 4.6, "BaOH"), mband(525.0, 15.0, 2.36, 3.0e7, "OH", 4.6, "BaOH")]},
    "Cu": {"ionisation_ev": 7.726, "g_atom": 2, "g_ion": 1,
           "lines": [line(324.75, 4, 1.39e8, 3.817), line(510.55, 4, 2.0e6, 3.786), line(578.21, 4, 1.65e6, 3.786)],
           "bands": [mband(540.0, 40.0, 2.30, 2.0e7, "OH", 3.5, "CuOH"), mband(435.0, 25.0, 2.85, 2.0e7, "Cl", 3.9, "CuCl")]},
    "Tl": {"ionisation_ev": 6.108, "g_atom": 2, "g_ion": 1, "lines": [line(535.05, 2, 7.0e7, 3.283), line(377.57, 2, 6.3e7, 3.283)], "bands": []},
    "In": {"ionisation_ev": 5.786, "g_atom": 2, "g_ion": 1, "lines": [line(451.13, 4, 8.9e7, 3.022), line(410.18, 2, 5.6e7, 3.022)], "bands": []},
    # boron burns to BO2 whose 493-579 nm bands colour the flame green; the oxide forms completely at flame temperature
    "B": {"ionisation_ev": 8.298, "g_atom": 2, "g_ion": 1, "lines": [],
          "bands": [mband(518.0, 12.0, 2.40, 1.0e7, "O2", None, "BO2"), mband(546.0, 12.0, 2.27, 1.0e7, "O2", None, "BO2"), mband(493.0, 12.0, 2.51, 1.0e7, "O2", None, "BO2")]},
}

flame_out = {
    "_comment": "Generated by pipeline/db/build_optics_seed.py. Flame-test emitters per element (atomic and ionic lines, molecular bands). Tier estimated, source: " + FLAME_SRC,
    "source": FLAME_SRC,
    "tier": "estimated",
    "elements": flame_elements,
}

out = {
    "_comment": "Generated by pipeline/db/build_optics_seed.py. Optical seed rows of the species store (tier + source on every row): solution bands per solvent class, gas cross-sections, solid band gaps and colours, molar refractions. Intrinsic optical data only.",
    "version": 1,
    "species": species,
    "atomic_refraction": atomic_refraction,
}

if __name__ == "__main__":
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1, sort_keys=True)
        f.write("\n")
    with open(OUT_FLAME, "w") as f:
        json.dump(flame_out, f, indent=1, sort_keys=True)
        f.write("\n")
    print("wrote", os.path.normpath(OUT), len(species), "species rows")
