# Excerpt of the structure of thermo/unifac.py (MIT licence, C. Bell): a few real UFSG / UFMG statements, including a
# multi-line statement, a trailing comment and a duplicate subgroup name (aldehyde CHO and ether CHO).
UFMG = {}
UFMG[1] = ("CH2", [1, 2, 3, 4])
UFMG[5] = ("OH", [14])
UFMG[7] = ("H2O", [16])
UFMG[10] = ("CHO", [20])
UFMG[13] = ("CH2O", [24, 25, 26, 27])

UFSG = {}
UFSG[1] = UNIFAC_subgroup(1, "CH3", 1, "CH2", 0.9011, 0.848, smarts="[CX4;H3]", atoms={"C": 1, "H": 3})
UFSG[2] = UNIFAC_subgroup(2, "CH2", 1, "CH2", 0.6744, 0.54, smarts="[CX4;H2]", atoms={"C": 1, "H": 2})
UFSG[14] = UNIFAC_subgroup(14, "OH", 5, "OH", 1, 1.2, smarts="[OX2;H1]", atoms={"O": 1, "H": 1},
                           ) # trailing comment
UFSG[16] = UNIFAC_subgroup(16, "H2O", 7, "H2O", 0.92, 1.4, smarts="[OH2]", atoms={"O": 1, "H": 2})
UFSG[20] = UNIFAC_subgroup(20, "CHO", 10, "CHO", 0.998, 0.948, smarts="[CX3H1](=O)", atoms={"C": 1, "H": 1, "O": 1})
UFSG[26] = UNIFAC_subgroup(26, "CHO", 13, "CH2O", 0.6908, 0.468, smarts="[C;H1][O]", atoms={"C": 1, "H": 1, "O": 1}, bonds={SINGLE_BOND: 1})
UFSG[27] = UNIFAC_subgroup(27, "THF", 13, "CH2O", 0.9183, 1.1, smarts=["[CX4;H2;R][OX2;R]", "[CX3;H1;R][OX2;R]"], atoms={"O": 1, "C": 1, "H": 2})
UFSG[2001] = UNIFAC_subgroup(2001, "NOT_ORIGINAL", 99, "X", 1.0, 1.0, smarts="[C]", atoms={"C": 1})

DOUFSG = {}
DOUFSG[1] = UNIFAC_subgroup(1, "CH3", 1, "CH2", 0.6325, 1.0608, atoms=UFSG[1].atoms, smarts=UFSG[1].smarts)
