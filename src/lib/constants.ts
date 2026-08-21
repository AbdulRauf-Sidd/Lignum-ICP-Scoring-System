export interface SectorDefinition {
  sector: string;
  subSectors: string[];
}

export const SECTORS: SectorDefinition[] = [
  {
    sector: "Data Centres",
    subSectors: ["Mechanical – Liquid Cooling/ HVAC", "Electrical – Power Distribution"],
  },
  {
    sector: "Modular and Pre-Fabrication",
    subSectors: [
      "Volumetric Modular",
      "Structural Precast Concrete",
      "Architectural Precast Concrete",
    ],
  },
  {
    sector: "Filtration Solutions",
    subSectors: ["Filtration Manufacturer"],
  },
  {
    sector: "Commercial Construction",
    subSectors: [
      "Curtain Wall Specialists",
      "Exterior Wall Panel Specialists",
      "Woodworking Specialists",
      "Roofing Specialists",
      "Interiors Specialists",
    ],
  },
];

export const ALL_SUB_SECTORS = SECTORS.flatMap((s) => s.subSectors);

export const ICP_NAMES = SECTORS.map((s) => s.sector);

export const SCORE_CATEGORY_LABELS: Record<string, string> = {
  icp_fit: "ICP fit",
  scale_footprint: "Scale & footprint",
  hiring_growth: "Hiring & growth",
  financial_viability: "Financial viability",
};
