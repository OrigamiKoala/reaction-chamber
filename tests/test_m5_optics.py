"""Tests for M5 optics, spectral calculations, and color conversions."""
import math
import json
import pytest

# Test constants
N_BINS = 32
BIN_NM0 = 400.0
BIN_STEP_NM = 10.0

# Precomputed normalized D65 / CMF sRGB weights for 32 bins
RGB_WEIGHTS = [
    0.00093632474, -0.00080665328, 0.0056853705,
    0.0030992647, -0.0027067814, 0.019213132,
    0.0095163259, -0.0084750023, 0.061065865,
    0.017367187, -0.016053169, 0.12152093,
    0.022092962, -0.021997851, 0.1851348,
    0.016368571, -0.020021962, 0.20911071,
    0.0020042278, -0.011134304, 0.19760125,
    -0.016192552, 0.0037836741, 0.14744606,
    -0.033959889, 0.022131938, 0.091949805,
    -0.046201223, 0.038953927, 0.046552506,
    -0.063873752, 0.063340994, 0.023015095,
    -0.083987251, 0.095951963, 0.0066598781,
    -0.091917327, 0.12624359, -0.005824444,
    -0.082658632, 0.14853406, -0.012468499,
    -0.053001599, 0.14900864, -0.015547509,
    -0.012739436, 0.14236344, -0.016737796,
    0.037447646, 0.12204945, -0.015723692,
    0.091782637, 0.095415452, -0.013667078,
    0.14810465, 0.067403753, -0.011334458,
    0.18171983, 0.035682653, -0.008089336,
    0.21088794, 0.013129519, -0.0058719208,
    0.21025407, -0.0023842908, -0.0039483457,
    0.18148252, -0.0094069866, -0.0024941205,
    0.13218911, -0.0098862762, -0.0014429899,
    0.093811378, -0.0083771582, -0.00085414099,
    0.057214441, -0.0056047485, -0.00045961309,
    0.033498695, -0.003443465, -0.0002487352,
    0.01825282, -0.0019205345, -0.0001299652,
    0.0093068577, -0.00099499024, -6.4288184e-05,
    0.0040273342, -0.00043518768, -2.7237198e-05,
    0.0020709758, -0.00022478411, -1.3880712e-05,
    0.0010958969, -0.0001189129, -7.3497705e-06,
]

def transmitted_rgb(a_per_cm, path_cm):
    r, g, b = 0.0, 0.0, 0.0
    for i in range(N_BINS):
        t = 10.0 ** (-a_per_cm[i] * path_cm)
        r += RGB_WEIGHTS[i * 3] * t
        g += RGB_WEIGHTS[i * 3 + 1] * t
        b += RGB_WEIGHTS[i * 3 + 2] * t
    return max(0.0, min(1.0, r)), max(0.0, min(1.0, g)), max(0.0, min(1.0, b))

def calc_absorbance(bands, conc_m):
    a = [0.0] * N_BINS
    ln2_4 = 4.0 * math.log(2.0)
    for band in bands:
        c_nm, fwhm, eps = band["centre_nm"], band["fwhm_nm"], band["eps"]
        for i in range(N_BINS):
            lam = BIN_NM0 + i * BIN_STEP_NM
            diff = lam - c_nm
            exp_term = -ln2_4 * (diff / fwhm) ** 2
            if exp_term > -20.0:
                a[i] += conc_m * eps * math.exp(exp_term)
    return a

def test_m5_optics_white_balance():
    """Unit transmittance across all bins must produce white linear sRGB (1,1,1)."""
    zero_absorbance = [0.0] * N_BINS
    r, g, b = transmitted_rgb(zero_absorbance, 1.0)
    assert abs(r - 1.0) < 1e-4
    assert abs(g - 1.0) < 1e-4
    assert abs(b - 1.0) < 1e-4

def test_m5_optics_copper_sulfate_color():
    """0.1 M Cu2+ has pale sky blue color (high B, lower R)."""
    cu_bands = [{"centre_nm": 800.0, "fwhm_nm": 250.0, "eps": 12.0}]
    a = calc_absorbance(cu_bands, 0.1)
    r, g, b = transmitted_rgb(a, 2.0)
    assert b > r, f"Cu2+ must have higher blue ({b:.3f}) than red ({r:.3f})"
    assert r < 0.95, "Red must be attenuated by near-IR/red band"

def test_m5_optics_copper_tetrammine_color():
    """[Cu(NH3)4]2+ has deep royal blue color (lambda_max ~ 610 nm)."""
    cu_nh3_bands = [{"centre_nm": 610.0, "fwhm_nm": 120.0, "eps": 55.0}]
    a = calc_absorbance(cu_nh3_bands, 0.1)
    r, g, b = transmitted_rgb(a, 2.0)
    assert b > 0.4 and r < 0.2, f"Deep royal blue: B={b:.3f} >> R={r:.3f}"
    assert b > g, "Blue dominates over green"

def test_m5_optics_phenolphthalein_switch():
    """HIn_phph is colorless; In_phph- is deep magenta / pink."""
    in_bands = [{"centre_nm": 552.0, "fwhm_nm": 50.0, "eps": 31000.0}]
    # 5e-5 M indicator (dilute drop)
    a_acid = [0.0] * N_BINS
    r_acid, g_acid, b_acid = transmitted_rgb(a_acid, 2.0)
    assert r_acid > 0.99 and g_acid > 0.99 and b_acid > 0.99

    a_base = calc_absorbance(in_bands, 5e-5)
    r_base, g_base, b_base = transmitted_rgb(a_base, 2.0)
    # Magenta absorbs green (550 nm), transmits red and blue
    assert g_base < r_base, "Green strongly absorbed"
    assert g_base < b_base, "Green lower than blue"
    assert r_base > 0.4 and b_base > 0.3, "Red and blue transmitted (pink/magenta)"

def test_m5_optics_cobalt_equilibrium_colors():
    """Pink [Co(H2O)6]2+ vs blue [CoCl4]2-."""
    co_pink = [{"centre_nm": 510.0, "fwhm_nm": 80.0, "eps": 5.0}]
    co_blue = [
        {"centre_nm": 625.0, "fwhm_nm": 45.0, "eps": 420.0},
        {"centre_nm": 660.0, "fwhm_nm": 45.0, "eps": 600.0},
        {"centre_nm": 690.0, "fwhm_nm": 45.0, "eps": 480.0},
    ]
    a_pink = calc_absorbance(co_pink, 0.1)
    r_p, g_p, b_p = transmitted_rgb(a_pink, 2.0)
    # Pink transmits red and blue, green slightly absorbed
    assert r_p > g_p

    a_blue = calc_absorbance(co_blue, 0.05)
    r_b, g_b, b_b = transmitted_rgb(a_blue, 2.0)
    # Deep blue absorbs red (620-700 nm), transmits blue
    assert b_b > r_b * 2.0, f"Blue ({b_b:.3f}) must strongly exceed red ({r_b:.3f})"

def test_m5_optics_beer_lambert_depth_shift():
    """Colour deepens with path length (thicker liquid is darker and shifts hue)."""
    fe_scn_bands = [{"centre_nm": 460.0, "fwhm_nm": 90.0, "eps": 4500.0}]
    a = calc_absorbance(fe_scn_bands, 0.001)
    r1, g1, b1 = transmitted_rgb(a, 0.5)
    r2, g2, b2 = transmitted_rgb(a, 3.0)
    # Intensity drops significantly
    assert (r2 + g2 + b2) < (r1 + g1 + b1)
    # 460 nm absorbs blue, leaving deep blood-red
    assert r2 > b2 * 3.0
