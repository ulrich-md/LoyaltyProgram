import { NextRequest, NextResponse } from "next/server";
import { supabase, appUrl } from "@/lib/server";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code"),
    token_hash = req.nextUrl.searchParams.get("token_hash"),
    type = req.nextUrl.searchParams.get("type");
  const s = await supabase();
  if (code) {
    const { error } = await s.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(appUrl() + "/recuperar");
  }
  if (
    token_hash &&
    (type === "invite" || type === "magiclink" || type === "recovery")
  ) {
    const { error } = await s.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(appUrl() + "/recuperar");
  }
  return NextResponse.redirect(appUrl() + "/login?error=enlace");
}
