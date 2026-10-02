import { imp, vessel, dose, step, summary, ctl } from './lib.mjs';
const I = (name, formula, smiles, state, extra = {}) => { const id = 'x_' + name.replace(/\W/g, ''); const m = imp({ id, name, formula, smiles, state, ...extra }); return id; };
const HCl = I('HCl', 'ClH', 'Cl', 'liquid', { molarity: 1.0 });
const NaOH = I('NaOH', 'HNaO', '[OH-].[Na+]', 'liquid', { molarity: 1.0 });
const run = (label, doses, n = 60, controls) => {
  const h = vessel();
  for (const d of doses) dose(h, d);
  if (controls) ctl(h, controls);
  step(h, n);
  return summary(h, label);
};
// 1 F1 check: NaOH + NaCl
run('NaOH + NaCl (F1)', [{ reagent_id: 'naoh_0_1m', volume_ml: 20 }, { reagent_id: 'nacl_0_1m', volume_ml: 20 }]);
// 2 carbonate + acid
run('Na2CO3 + HCl', [{ reagent_id: I('Na2CO3', 'CNa2O3', '[Na+].[Na+].[O-]C(=O)[O-]', 'solid'), mass_g: 1.0 }, { reagent_id: 'water', volume_ml: 30 }, { reagent_id: HCl, volume_ml: 20 }]);
// 3 AgCl + NH3 (junk SN2?)
run('AgNO3 + NaCl then NH3', [{ reagent_id: 'agno3_0_1m', volume_ml: 20 }, { reagent_id: 'nacl_0_1m', volume_ml: 20 }, { reagent_id: 'nh3_2m', volume_ml: 10 }]);
// 4 CoCl2 + NaOH
run('CoCl2(conc Cl) + NaOH', [{ reagent_id: 'cocl2_10m_cl', volume_ml: 10 }, { reagent_id: 'naoh_0_1m', volume_ml: 5 }]);
// 5 Zn + HCl
run('Zn + HCl', [{ reagent_id: HCl, volume_ml: 30 }, { reagent_id: I('Zinc', 'Zn', '[Zn]', 'solid'), mass_g: 1 }]);
// 6 Mg (imported) + HCl
run('Mg(imported) + HCl', [{ reagent_id: HCl, volume_ml: 30 }, { reagent_id: I('Magnesium', 'Mg', '[Mg]', 'solid'), mass_g: 0.1 }]);
// 7 Fe + CuSO4
run('Fe + CuSO4', [{ reagent_id: 'cuso4_0_1m', volume_ml: 30 }, { reagent_id: I('Iron', 'Fe', '[Fe]', 'solid'), mass_g: 1 }]);
// 8 CuO + H2SO4
run('CuO + H2SO4', [{ reagent_id: I('H2SO4', 'H2O4S', 'OS(=O)(=O)O', 'liquid', { molarity: 1 }), volume_ml: 30 }, { reagent_id: I('CuO', 'CuO', 'O=[Cu]', 'solid'), mass_g: 1 }]);
// 9 Na2S + HCl
run('Na2S + HCl', [{ reagent_id: 'water', volume_ml: 30 }, { reagent_id: I('Na2S', 'Na2S', '[Na+].[Na+].[S-2]', 'solid'), mass_g: 0.5 }, { reagent_id: HCl, volume_ml: 20 }]);
// 10 NH4Cl + NaOH
run('NH4Cl + NaOH', [{ reagent_id: 'water', volume_ml: 20 }, { reagent_id: I('NH4Cl', 'ClH4N', '[NH4+].[Cl-]', 'solid'), mass_g: 2 }, { reagent_id: NaOH, volume_ml: 30 }], 60, { heater_w: 200 });
// 11 Na2SO3 + HCl
run('Na2SO3 + HCl', [{ reagent_id: 'water', volume_ml: 20 }, { reagent_id: I('Na2SO3', 'Na2O3S', '[O-]S(=O)[O-].[Na+].[Na+]', 'solid'), mass_g: 1 }, { reagent_id: HCl, volume_ml: 30 }]);
// 12 FeSO4 + KMnO4 + H2SO4
run('FeSO4 + KMnO4 (acid)', [{ reagent_id: I('H2SO4', 'H2O4S', 'OS(=O)(=O)O', 'liquid', { molarity: 1 }), volume_ml: 30 }, { reagent_id: I('FeSO4', 'FeO4S', '[O-]S(=O)(=O)[O-].[Fe+2]', 'solid'), mass_g: 0.5 }, { reagent_id: I('KMnO4', 'KMnO4', '[O-][Mn](=O)(=O)=O.[K+]', 'solid'), mass_g: 0.1 }]);
// 13 Citric acid 0.1 M pH
run('citric acid 0.1 M', [{ reagent_id: I('Citric', 'C6H8O7', 'C(C(=O)O)C(CC(=O)O)(C(=O)O)O', 'liquid', { molarity: 0.1 }), volume_ml: 50 }], 2);
// 14 Methyl formate + water pH
run('methyl formate 0.1 M', [{ reagent_id: I('MeFormate', 'C2H4O2', 'COC=O', 'liquid', { molarity: 0.1 }), volume_ml: 50 }], 2);
// 15 AlCl3 + excess NaOH (amphoteric)
run('AlCl3 + excess NaOH', [{ reagent_id: I('AlCl3', 'AlCl3', 'Cl[Al](Cl)Cl', 'liquid', { molarity: 0.1 }), volume_ml: 10 }, { reagent_id: NaOH, volume_ml: 20 }]);
// 16 AgNO3 + NaOH
run('AgNO3 + NaOH', [{ reagent_id: 'agno3_0_1m', volume_ml: 10 }, { reagent_id: 'naoh_0_1m', volume_ml: 10 }]);
// 17 Pb(NO3)2 + NaCl
run('Pb(NO3)2 + NaCl', [{ reagent_id: I('PbNO3', 'N2O6Pb', '[N+](=O)([O-])[O-].[N+](=O)([O-])[O-].[Pb+2]', 'liquid', { molarity: 0.1 }), volume_ml: 10 }, { reagent_id: 'nacl_0_1m', volume_ml: 20 }]);
// 18 CuSO4 + excess NH3
run('CuSO4 + NH3 excess', [{ reagent_id: 'cuso4_0_1m', volume_ml: 10 }, { reagent_id: 'nh3_2m', volume_ml: 20 }]);
// 19 Fe(III)+ ferrocyanide (prussian blue)
run('FeCl3 + K4Fe(CN)6', [{ reagent_id: I('FeCl3', 'Cl3Fe', 'Cl[Fe](Cl)Cl', 'liquid', { molarity: 0.1 }), volume_ml: 10 }, { reagent_id: I('K4FeCN6', 'C6FeK4N6', '[C-]#N.[C-]#N.[C-]#N.[C-]#N.[C-]#N.[C-]#N.[K+].[K+].[K+].[K+].[Fe+2]', 'liquid', { molarity: 0.1 }), volume_ml: 10 }]);
// 20 Ethyl acetate + NaOH, bromoethane + NaOH (organic)
run('EtOAc + NaOH', [{ reagent_id: NaOH, volume_ml: 20 }, { reagent_id: I('EtOAc', 'C4H8O2', 'CCOC(C)=O', 'liquid'), volume_ml: 5 }]);
run('Bromoethane + NaOH', [{ reagent_id: NaOH, volume_ml: 20 }, { reagent_id: I('EtBr', 'C2H5Br', 'CCBr', 'liquid'), volume_ml: 5 }]);
// 21 Cl2 water + KI
run('Cl2(aq) + KI', [{ reagent_id: I('Cl2', 'Cl2', 'ClCl', 'gas'), volume_ml: 20 }, { reagent_id: 'ki_0_5m', volume_ml: 5 }]);
// 22 H2O2 + MnO2 (conservation)
run('H2O2 + MnO2', [{ reagent_id: 'h2o2_3pct', volume_ml: 20 }, { reagent_id: 'mno2_s', mass_g: 0.2 }], 120);
// 23 ethanol + igniter (no O2)
run('ethanol + igniter', [{ reagent_id: 'ethanol', volume_ml: 10 }], 20, { igniter: true });
// 24 NaHCO3 heated dry
run('NaHCO3 dry, heated', [{ reagent_id: 'nahco3_s', mass_g: 5 }], 300, { heater_w: 300 });
// 25 CaO + water
run('CaO + water', [{ reagent_id: 'water', volume_ml: 20 }, { reagent_id: I('CaO', 'CaO', '[O-2].[Ca+2]', 'solid'), mass_g: 1 }]);
// 26 Na + water
run('Na + water', [{ reagent_id: 'water', volume_ml: 20 }, { reagent_id: I('Sodium', 'Na', '[Na]', 'solid'), mass_g: 0.2 }]);
// 27 NaOCl + HCl (Cl2 evolution)
run('NaOCl + HCl', [{ reagent_id: I('NaOCl', 'ClNaO', '[O-]Cl.[Na+]', 'liquid', { molarity: 0.5 }), volume_ml: 20 }, { reagent_id: HCl, volume_ml: 20 }]);
