import { getSupabaseServerClient } from "@/lib/supabase/server";

// Mirrors the real `icp_profiles` table. Band/rule columns are stored as
// opaque JSON text — the exact shape is whatever the n8n Scoring Engine
// node parses, so they're edited as raw JSON rather than a bespoke form.
export interface IcpProfileRow {
  id: string;
  icp_name: string;
  weight_icp_fit: number;
  weight_scale_footprint: number;
  weight_hiring_growth: number;
  weight_financial_viability: number;
  target_sectors: string[];
  revenue_bands_usd: string;
  headcount_bands: string;
  hiring_growth_bands: string;
  fit_rules: string;
}

// Mirrors the real `sector_taxonomy` table.
export interface SectorTaxonomyRow {
  id: string;
  sector: string;
  sub_sector: string;
  active: boolean;
  created_at: string;
}

export async function getIcpProfiles(): Promise<IcpProfileRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("icp_profiles").select("*").order("icp_name", { ascending: true });
  if (error) throw new Error(`Failed to load icp_profiles: ${error.message}`);
  return (data ?? []) as IcpProfileRow[];
}

export async function getSectorTaxonomy(): Promise<SectorTaxonomyRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sector_taxonomy")
    .select("*")
    .order("sector", { ascending: true })
    .order("sub_sector", { ascending: true });
  if (error) throw new Error(`Failed to load sector_taxonomy: ${error.message}`);
  return (data ?? []) as SectorTaxonomyRow[];
}
