export interface SourceLicence {
  id: string;
  name: string;
  licence: string;
  url: string;
  commercial_allowed: boolean;
  redistribution_allowed: boolean;
}

export const LICENCE_REGISTRY: Record<string, SourceLicence> = {
  'nbs-tables': {
    id: 'nbs-tables',
    name: 'NBS Tables of Chemical Thermodynamic Properties (NIST)',
    licence: 'NIST Open License / Public Domain',
    url: 'https://data.nist.gov/od/id/mds2-2124',
    commercial_allowed: true,
    redistribution_allowed: true,
  },
  'phreeqc-llnl': {
    id: 'phreeqc-llnl',
    name: 'USGS PHREEQC llnl.dat / pitzer.dat',
    licence: 'USGS Public Domain',
    url: 'https://www.usgs.gov/software/phreeqc-version-3',
    commercial_allowed: true,
    redistribution_allowed: true,
  },
  'nasa-cea': {
    id: 'nasa-cea',
    name: 'NASA CEA thermo.inp',
    licence: 'Apache-2.0',
    url: 'https://www.grc.nasa.gov/WWW/CEAWeb/',
    commercial_allowed: true,
    redistribution_allowed: true,
  },
  'wikidata': {
    id: 'wikidata',
    name: 'Wikidata Chemical Properties Extract',
    licence: 'CC0 1.0 Universal',
    url: 'https://www.wikidata.org',
    commercial_allowed: true,
    redistribution_allowed: true,
  },
  'pubchem': {
    id: 'pubchem',
    name: 'PubChem PUG REST / View',
    licence: 'NLM Public Domain / Open Data',
    url: 'https://pubchem.ncbi.nlm.nih.gov',
    commercial_allowed: true,
    redistribution_allowed: true,
  },
  'aqsoldb': {
    id: 'aqsoldb',
    name: 'AqSolDB / BigSolDB',
    licence: 'CC0 / CC BY 4.0',
    url: 'https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/OVHAW1',
    commercial_allowed: true,
    redistribution_allowed: true,
  },
  'materials-project': {
    id: 'materials-project',
    name: 'Materials Project Bulk Release',
    licence: 'CC BY 4.0',
    url: 'https://materialsproject.org',
    commercial_allowed: true,
    redistribution_allowed: true,
  },
  'nist-webbook': {
    id: 'nist-webbook',
    name: 'NIST Chemistry WebBook (SRD 69)',
    licence: 'NIST SRD Terms (Per-user retrieval, not redistributed)',
    url: 'https://webbook.nist.gov/chemistry/',
    commercial_allowed: false,
    redistribution_allowed: false,
  },
};
