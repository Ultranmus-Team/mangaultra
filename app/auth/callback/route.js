import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabaseServer';
import { ensureProfile } from '@/lib/profile';

// Handles the Google OAuth redirect (PKCE code exchange). This is safe to
// use PKCE for because the whole flow — start, Google consent, return —
// happens in one continuous browser session, so the code_verifier cookie
// set at the start is still there when we exchange the code here.
// Email confirmation links use /auth/confirm instead — see that route for why.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      await ensureProfile(data.user);
      revalidatePath('/', 'layout');
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
