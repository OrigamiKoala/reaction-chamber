"""
Curated Color and Absorbance Table for Chemical Species
Used for Beer-Lambert visual rendering and fallback hex colors.
"""
from typing import Dict, Any

CURATED_COLORS = {
    "Cu+2": {
        "name": "Copper(II) aqua ion",
        "hex": "#29b6f6",
        "rgb": [41, 182, 246],
        "absorbance_peak_nm": 810,
        "molar_extinction": 12.0,
        "description": "Clear sky blue"
    },
    "Cu(NH3)4+2": {
        "name": "Tetraamminecopper(II)",
        "hex": "#1a237e",
        "rgb": [26, 35, 126],
        "absorbance_peak_nm": 610,
        "molar_extinction": 55.0,
        "description": "Deep brilliant royal blue"
    },
    "Fe+3": {
        "name": "Iron(III) aqua ion",
        "hex": "#f57f17",
        "rgb": [245, 127, 23],
        "absorbance_peak_nm": 350,
        "molar_extinction": 200.0,
        "description": "Yellow-amber to reddish brown"
    },
    "Fe+2": {
        "name": "Iron(II) aqua ion",
        "hex": "#aed581",
        "rgb": [174, 213, 129],
        "absorbance_peak_nm": 900,
        "molar_extinction": 1.8,
        "description": "Pale mint green"
    },
    "Fe(SCN)+2": {
        "name": "Iron(III) thiocyanate complex",
        "hex": "#b71c1c",
        "rgb": [183, 28, 28],
        "absorbance_peak_nm": 450,
        "molar_extinction": 5000.0,
        "description": "Intense blood red"
    },
    "CrO4-2": {
        "name": "Chromate ion",
        "hex": "#ffd600",
        "rgb": [255, 214, 0],
        "absorbance_peak_nm": 375,
        "molar_extinction": 4800.0,
        "description": "Bright canary yellow"
    },
    "Cr2O7-2": {
        "name": "Dichromate ion",
        "hex": "#e65100",
        "rgb": [230, 81, 0],
        "absorbance_peak_nm": 350,
        "molar_extinction": 2500.0,
        "description": "Vivid orange"
    },
    "MnO4-": {
        "name": "Permanganate ion",
        "hex": "#6a1b9a",
        "rgb": [106, 27, 154],
        "absorbance_peak_nm": 525,
        "molar_extinction": 2400.0,
        "description": "Intense deep purple"
    },
    "Mn+2": {
        "name": "Manganese(II) aqua ion",
        "hex": "#fce4ec",
        "rgb": [252, 228, 236],
        "absorbance_peak_nm": 402,
        "molar_extinction": 0.04,
        "description": "Extremely pale rose pink"
    },
    "Co+2": {
        "name": "Cobalt(II) hexaaqua ion",
        "hex": "#f06292",
        "rgb": [240, 98, 146],
        "absorbance_peak_nm": 510,
        "molar_extinction": 4.8,
        "description": "Pink to light magenta"
    },
    "CoCl4-2": {
        "name": "Tetrachlorocobaltate(II)",
        "hex": "#1565c0",
        "rgb": [21, 101, 192],
        "absorbance_peak_nm": 660,
        "molar_extinction": 600.0,
        "description": "Deep cobalt blue"
    },
    "Ni+2": {
        "name": "Nickel(II) aqua ion",
        "hex": "#43a047",
        "rgb": [67, 160, 71],
        "absorbance_peak_nm": 395,
        "molar_extinction": 5.1,
        "description": "Vivid emerald apple green"
    },
    "I3-": {
        "name": "Triiodide complex",
        "hex": "#5d4037",
        "rgb": [93, 64, 55],
        "absorbance_peak_nm": 353,
        "molar_extinction": 26000.0,
        "description": "Dark amber to deep brown"
    },
    "I2": {
        "name": "Iodine in solution",
        "hex": "#8d6e63",
        "rgb": [141, 110, 99],
        "absorbance_peak_nm": 460,
        "molar_extinction": 700.0,
        "description": "Brownish violet"
    },
    "Phenolphthalein_base": {
        "name": "Phenolphthalein (dianion, pH > 8.2)",
        "hex": "#e91e63",
        "rgb": [233, 30, 99],
        "absorbance_peak_nm": 553,
        "molar_extinction": 31000.0,
        "description": "Vibrant magenta fuchsia"
    }
}

def get_color_table() -> Dict[str, Any]:
    return CURATED_COLORS
