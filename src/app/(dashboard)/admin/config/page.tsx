import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { ConfigWorkspace } from "@/components/admin/config-workspace";
import { getIcpProfiles, getSectorTaxonomy } from "@/lib/data/icp-profiles";
import { requireAdmin } from "@/lib/supabase/auth-server";

// Admins edit this live — never freeze it.
export const dynamic = "force-dynamic";

// Blueprint/spec-sheet type family, matching
// docs/Lignum_ICP_Scoring_System_Map.html — loaded only for this page.
const displayFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const monoFont = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export default async function ModelConfigPage() {
  await requireAdmin();
  const [profiles, taxonomy] = await Promise.all([getIcpProfiles(), getSectorTaxonomy()]);

  return (
    <div className={`${displayFont.variable} ${monoFont.variable}`}>
      <ConfigWorkspace profiles={profiles} taxonomy={taxonomy} />
    </div>
  );
}
