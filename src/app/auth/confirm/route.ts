import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL("/password-recovery/update", request.url);

  if (!code) {
    destination.pathname = "/password-recovery";
    destination.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(destination);
  }

  const supabase = await getSupabaseAuthServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    destination.pathname = "/password-recovery";
    destination.searchParams.set("error", "invalid_link");
  }

  return NextResponse.redirect(destination);
}
