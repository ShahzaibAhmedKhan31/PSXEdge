import type { Constituent } from '../types';

/**
 * KMI-30 constituent snapshot.
 *
 * Source: Pakistan Stock Exchange Data Portal — https://dps.psx.com.pk/indices/KMI30
 * Captured: 17 November 2026, index weight column "IDX WTG (%)".
 *
 * This is a real, clearly-labelled snapshot bundled with the app so that PSXEdge
 * works offline and when PSX blocks cross-origin browser requests (CORS). It is
 * NOT live data. Replace it through Data → Import (CSV/XLSX) or a CORS-enabled feed.
 */
export const SAMPLE_KMI30: readonly Constituent[] = [
  { ticker: 'AIRLINK', companyName: 'Air Link Communication Limited', sector: 'Technology & Communication', weightage: 0.54 },
  { ticker: 'ATRL', companyName: 'Attock Refinery Limited', sector: 'Refinery', weightage: 1.64 },
  { ticker: 'CPHL', companyName: 'Citi Pharma Ltd.', sector: 'Pharmaceuticals', weightage: 0.32 },
  { ticker: 'DGKC', companyName: 'D.G. Khan Cement Company Limited', sector: 'Cement', weightage: 1.79 },
  { ticker: 'EFERT', companyName: 'Engro Fertilizers Limited', sector: 'Fertilizer', weightage: 5.11 },
  { ticker: 'ENGROH', companyName: 'Engro Holdings Limited', sector: 'Fertilizer', weightage: 10.80 },
  { ticker: 'FCCL', companyName: 'Fauji Cement Company Limited', sector: 'Cement', weightage: 2.08 },
  { ticker: 'FFC', companyName: 'Fauji Fertilizer Company Limited', sector: 'Fertilizer', weightage: 12.33 },
  { ticker: 'FFL', companyName: 'Fauji Foods Limited', sector: 'Food & Personal Care Products', weightage: 0.30 },
  { ticker: 'GAL', companyName: 'Ghandhara Automobiles Limited', sector: 'Automobile Assembler', weightage: 0.51 },
  { ticker: 'GHNI', companyName: 'Ghandhara Industries Limited', sector: 'Automobile Assembler', weightage: 0.74 },
  { ticker: 'HCAR', companyName: 'Honda Atlas Cars (Pakistan) Limited', sector: 'Automobile Assembler', weightage: 0.24 },
  { ticker: 'HUBC', companyName: 'The Hub Power Company Limited', sector: 'Power Generation & Distribution', weightage: 8.19 },
  { ticker: 'LUCK', companyName: 'Lucky Cement Limited', sector: 'Cement', weightage: 7.84 },
  { ticker: 'MARI', companyName: 'Mari Energies Limited', sector: 'Oil & Gas Exploration Companies', weightage: 7.07 },
  { ticker: 'MEBL', companyName: 'Meezan Bank Limited', sector: 'Commercial Banks', weightage: 10.16 },
  { ticker: 'MLCF', companyName: 'Maple Leaf Cement Factory Limited', sector: 'Cement', weightage: 2.01 },
  { ticker: 'NML', companyName: 'Nishat Mills Limited', sector: 'Textile Composite', weightage: 0.84 },
  { ticker: 'NRL', companyName: 'National Refinery Limited', sector: 'Refinery', weightage: 0.48 },
  { ticker: 'OGDC', companyName: 'Oil & Gas Development Company Limited', sector: 'Oil & Gas Exploration Companies', weightage: 8.22 },
  { ticker: 'PAEL', companyName: 'Pak Elektron Limited', sector: 'Cable & Electrical Goods', weightage: 0.73 },
  { ticker: 'PPL', companyName: 'Pakistan Petroleum Limited', sector: 'Oil & Gas Exploration Companies', weightage: 6.08 },
  { ticker: 'PRL', companyName: 'Pakistan Refinery Limited', sector: 'Refinery', weightage: 0.73 },
  { ticker: 'PSO', companyName: 'Pakistan State Oil Company Limited', sector: 'Oil & Gas Marketing Companies', weightage: 3.48 },
  { ticker: 'SAZEW', companyName: 'Sazgar Engineering Works Limited', sector: 'Automobile Assembler', weightage: 1.28 },
  { ticker: 'SEARL', companyName: 'The Searle Company Limited', sector: 'Pharmaceuticals', weightage: 0.94 },
  { ticker: 'SNGP', companyName: 'Sui Northern Gas Pipelines Limited', sector: 'Oil & Gas Marketing Companies', weightage: 0.97 },
  { ticker: 'SSGC', companyName: 'Sui Southern Gas Company Limited', sector: 'Oil & Gas Marketing Companies', weightage: 0.32 },
  { ticker: 'SYS', companyName: 'Systems Limited', sector: 'Technology & Communication', weightage: 4.06 },
  { ticker: 'TREET', companyName: 'Treet Corporation Limited', sector: 'Paper, Board & Packaging', weightage: 0.20 },
];
