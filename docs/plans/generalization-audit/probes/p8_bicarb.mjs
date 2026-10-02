// P8: acid + bicarbonate: hand-written kinetic path (acetic acid only) vs equilibrium + CO2 degassing path (HCl)
import { vessel, dose, snap, step, ctl } from './common.mjs';
for (const [acid, vol] of [['ch3cooh_5pct', 50], ['hcl_1m', 50]]) {
  for (const stir of [false, true]) {
    const h = vessel(); dose(h, { reagent_id: acid, volume_ml: vol }); if (stir) ctl(h, { stirring: true });
    dose(h, { reagent_id: 'nahco3_s', mass_g: 1.0 });
    let co2 = 0, t50 = null; const tot = 1.0 / 84.007 * 8.314 * 298.15 / 101325 * 1e6; const rows = new Set();
    for (let t = 0; t < 120; t += 0.5) { step(h, 0.5); const s = snap(h); for (const g of s.gas_fluxes) if (g.species === 'CO2(g)') co2 += g.rate_ml_s * 0.5; for (const r of s.reactions) if (r.active && r.rate > 1e-9) rows.add(`${r.kind}:${r.id}`); if (t50 === null && co2 > tot / 2) t50 = t + 0.5; }
    const s = snap(h); const aq = s.species.find((r) => r.id === 'CO2(aq)')?.conc_m ?? 0;
    console.log(`${acid} stir=${stir}: CO2 gas in 120 s ${co2.toFixed(1)} of ${tot.toFixed(1)} mL, t50=${t50}s, CO2(aq) left ${aq.toExponential(2)} M, pH ${s.ph.toFixed(2)}, active: ${[...rows].join(', ')}`);
  }
}
