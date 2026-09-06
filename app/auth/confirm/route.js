import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabaseServer';
import { ensureProfile } from '@/lib/profile';

// Handles email confirmation links (signup confirmation, and would also
// cover magic-link/recovery if added later). Uses OTP token_hash
// verification rather than a PKCE code exchange, because the link is
// opened in whatever browser/device/tab the user's email client happens to
// use — not necessarily the one that started the signup — so there's no
// guarantee the PKCE code_verifier cookie survives to be there. token_hash
// verification doesn't depend on any cookie set earlier, so it works
// reliably across that context switch.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';

  if (token_hash && type) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error && data.user) {
      await ensureProfile(data.user);
      revalidatePath('/', 'layout');
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_confirm_failed`);
}
