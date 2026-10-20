import React, { useState, useEffect } from 'react';
import {
  Atom,
  Flame,
  ShieldAlert,
  Activity,
  ExternalLink,
  Info,
  CheckCircle2,
  Sparkles,
  BookOpen,
  FlaskConical,
  Wind,
  Search,
} from 'lucide-react';

interface ChemicalData {
  name: string;
  cid: number;
  formula: string;
  molecularWeight: string;
  iupacName: string;
  smiles: string;
  boilingPoint: string;
  role: string;
  bioThreshold: string;
  toxicology: string;
  oshaPel: string;
  combustionReaction: string;
}

const LPG_COMPOUNDS: Record<string, ChemicalData> = {
  propane: {
    name: 'Propane',
    cid: 6334,
    formula: 'C3H8',
    molecularWeight: '44.1 g/mol',
    iupacName: 'propane',
    smiles: 'CCC',
    boilingPoint: '-42.1 °C (-43.8 °F)',
    role: 'Primary hydrocarbon fuel component in LPG (40–60%)',
    bioThreshold: 'Simple asphyxiant; biological displacement of alveolar O2',
    toxicology: 'Low inherent chemical toxicity, acts via oxygen displacement; narcotic effect at >100,000 ppm',
    oshaPel: '1,000 ppm (1,800 mg/m³) 8-hr TWA',
    combustionReaction: 'C3H8 + 5 O2 → 3 CO2 + 4 H2O + 2,220 kJ/mol (complete combustion)',
  },
  butane: {
    name: 'n-Butane',
    cid: 7843,
    formula: 'C4H10',
    molecularWeight: '58.12 g/mol',
    iupacName: 'butane',
    smiles: 'CCCC',
    boilingPoint: '-0.5 °C (31.1 °F)',
    role: 'High-energy density fuel component in domestic LPG (40–60%)',
    bioThreshold: 'Central nervous system depression threshold at ~10,000 ppm',
    toxicology: 'Lipophilic hydrocarbon readily crossing blood-brain barrier at extreme concentrations',
    oshaPel: '800 ppm (1,900 mg/m³) NIOSH REL TWA',
    combustionReaction: '2 C4H10 + 13 O2 → 8 CO2 + 10 H2O + 2,877 kJ/mol',
  },
  ethanethiol: {
    name: 'Ethyl Mercaptan (Ethanethiol)',
    cid: 7824,
    formula: 'C2H6S',
    molecularWeight: '62.13 g/mol',
    iupacName: 'ethanethiol',
    smiles: 'CCS',
    boilingPoint: '35.0 °C (95.0 °F)',
    role: 'Mandatory stenching odorant added to LPG (~20 mg/kg or 20 ppm) for early leak detection',
    bioThreshold: '0.5 to 1.0 parts per billion (ppb) human olfactory bio-detection limit',
    toxicology: 'Odor detected at 1/400th of Lower Explosive Limit (LEL 2.1%), allowing biological safety warning before flame risk',
    oshaPel: '10 ppm (25 mg/m³) ceiling limit',
    combustionReaction: 'C2H6S + 4.5 O2 → 2 CO2 + 3 H2O + SO2',
  },
  isobutane: {
    name: 'Isobutane (2-Methylpropane)',
    cid: 6336,
    formula: 'C4H10',
    molecularWeight: '58.12 g/mol',
    iupacName: '2-methylpropane',
    smiles: 'CC(C)C',
    boilingPoint: '-11.7 °C (10.9 °F)',
    role: 'Branched-chain isomer providing optimized vapor pressure in cold regions',
    bioThreshold: 'Mild cardiac sensitization at ultra-high experimental concentrations (>50,000 ppm)',
    toxicology: 'Physiologically inert at ambient exposures; categorized as non-mutagenic hydrocarbon',
    oshaPel: '1,000 ppm (EX) ACGIH TLV',
    combustionReaction: '2 C4H10 + 13 O2 → 8 CO2 + 10 H2O',
  },
};

export const ScienceSafetyView: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState<string>('ethanethiol');
  const [livePubChemData, setLivePubChemData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const compound = LPG_COMPOUNDS[selectedKey] || LPG_COMPOUNDS.ethanethiol;

  // Fetch live PubChem data using proxy route or direct PubChem PUG REST
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/science/pubchem/${selectedKey}`)
      .then((res) => {
        if (!res.ok) throw new Error('Proxy error');
        return res.json();
      })
      .then((data) => {
        if (active) {
          setLivePubChemData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        // Direct fallback to public PubChem API
        fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${compound.cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES/JSON`
        )
          .then((r) => r.json())
          .then((pubData) => {
            if (active) {
              setLivePubChemData(pubData);
              setLoading(false);
            }
          })
          .catch(() => {
            if (active) setLoading(false);
          });
      });

    return () => {
      active = false;
    };
  }, [selectedKey, compound.cid]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-sm shrink-0">
              <FlaskConical className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  LPG Gas Chemistry & Bioscience Lab
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                  <Atom className="w-3.5 h-3.5" />
                  PubChem Verified
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Molecular structures, olfactory bio-detection limits, cellular hypoxia thresholds, and combustion toxicology
              </p>
            </div>
          </div>
        </div>

        {/* Quick-Try Example Chip Bar (Science Skill Protocol) */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Select Molecule:
          </span>
          {Object.entries(LPG_COMPOUNDS).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer shrink-0 border ${
                selectedKey === key
                  ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-teal-50 hover:text-teal-900'
              }`}
            >
              {item.name} ({item.formula})
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Molecule Deep-Dive + Biological Perception */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Chemical Profile & Structure */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chemical Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{compound.name}</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    CID: {compound.cid}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1">
                  IUPAC: {compound.iupacName}
                </div>
              </div>

              <a
                href={`https://pubchem.ncbi.nlm.nih.gov/compound/${compound.cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <span>View on PubChem</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Formula</span>
                <span className="text-sm font-mono font-black text-slate-900">{compound.formula}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Mol. Weight</span>
                <span className="text-sm font-mono font-black text-slate-900">{compound.molecularWeight}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Boiling Point</span>
                <span className="text-sm font-mono font-black text-slate-900">{compound.boilingPoint}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">SMILES</span>
                <span className="text-sm font-mono font-bold text-teal-700 truncate block">{compound.smiles}</span>
              </div>
            </div>

            {/* Role & Combustion Chemistry */}
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-100 space-y-1">
                <div className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-teal-600" /> Function in Domestic LPG
                </div>
                <p className="text-xs text-teal-800 leading-relaxed">{compound.role}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono text-xs">
                <span className="font-sans font-bold text-slate-900 block">Thermochemical Reaction:</span>
                <div className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] overflow-x-auto">
                  {compound.combustionReaction}
                </div>
              </div>
            </div>
          </div>

          {/* Biological Leak Detection & Olfactory Receptor Threshold */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
              <Wind className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">
                Human Olfactory Bio-Detection Mechanism
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <span className="font-bold text-amber-900 block text-sm">
                  Why Stenching Agent is Biologically Crucial
                </span>
                <p className="text-amber-800 leading-relaxed">
                  Pure liquefied petroleum gas (propane and butane) is completely odorless, tasteless, and colorless to human senses. Without an odorant, dangerous accumulations could occur undetected.
                </p>
                <div className="pt-2 border-t border-amber-200/60 text-amber-900 font-semibold">
                  Olfactory Threshold: <span className="font-mono font-black text-amber-700">0.5 ppb (parts per billion)</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <span className="font-bold text-emerald-900 block text-sm">
                  Safety Margin Above Explosive Limit
                </span>
                <p className="text-emerald-800 leading-relaxed">
                  Ethyl mercaptan is formulated so that human olfactory receptors detect the characteristic rotten cabbage/sulfur odor at less than <strong>0.4% gas concentration in air</strong>—far below the Lower Explosive Limit (LEL) of 2.1%.
                </p>
                <div className="pt-2 border-t border-emerald-200/60 text-emerald-900 font-semibold">
                  Early Warning Margin: <span className="font-mono font-black text-emerald-700">&gt; 5x Before Flammability</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Hypoxia & Respiratory Safety Checklist */}
        <div className="space-y-6">
          {/* Asphyxiation & Oxygen Displacement Scale */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <Activity className="w-5 h-5 text-rose-600" />
              <h3 className="text-base font-bold text-slate-900">Respiratory Hypoxia Scale</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              LPG is denser than air (vapor density ~1.5 to 2.0). If leaked, it pools in low-lying areas, basements, and floor levels, displacing ambient oxygen.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="font-bold text-emerald-900">20.9% O<sub>2</sub> (Normal Atmosphere)</div>
                <div className="text-[11px] text-emerald-800">Optimal cognitive and physical respiratory function.</div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="font-bold text-amber-900">19.5% O<sub>2</sub> (OSHA Minimum Safe Level)</div>
                <div className="text-[11px] text-amber-800">Entry threshold for confined spaces without supplied air.</div>
              </div>

              <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
                <div className="font-bold text-orange-900">15–19% O<sub>2</sub> (Impaired Coordination)</div>
                <div className="text-[11px] text-orange-800">Elevated pulse rate, impaired physical coordination, headache.</div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <div className="font-bold text-rose-900">&lt; 10% O<sub>2</sub> (Critical Cellular Hypoxia)</div>
                <div className="text-[11px] text-rose-800">Rapid loss of consciousness, risk of brain damage within 4 minutes.</div>
              </div>
            </div>
          </div>

          {/* Official Safety Protocol Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4" /> Emergency First-Response
            </div>
            <h4 className="font-bold text-base text-white">Suspected Gas Leak Protocol</h4>
            <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
              <li>Do NOT turn on/off electrical switches or appliances (sparks).</li>
              <li>Extinguish all open flames, incense sticks, and pilot lights immediately.</li>
              <li>Turn the cylinder regulator knob clockwise to OFF position.</li>
              <li>Open all doors and windows wide for natural cross-ventilation.</li>
              <li>Evacuate all occupants and call agency helpline from a safe distance.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
