'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabaseServer';
import { query } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function signUpAction(prevState, formData) {
  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  // No emailRedirectTo here — the confirmation link's destination
  // (/auth/confirm) is controlled by the "Confirm signup" email template in
  // the Supabase dashboard, not by this option. See lib/profile.js and
  // app/auth/confirm/route.js for why email confirmation uses token_hash
  // verification instead of a PKCE redirect.
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }

  // Supabase's anti-enumeration protection: signing up with an email that
  // already has an account returns a 200 with no new identity created,
  // rather than an error (so attackers can't probe which emails exist).
  if (!data.user || data.user.identities?.length === 0) {
    return {
      error: 'An account with this email already exists. Try logging in instead — or use "Continue with Google" if that\'s how you originally signed up.',
    };
  }

  // No profiles row yet — it's only created in /auth/callback once the
  // confirmation link is actually clicked, so an unverified signup never
  // gets a usable account.
  return { success: true, message: 'Check your email to confirm your account, then log in.' };
}

export async function signInAction(prevState, formData) {
  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const { rows } = await query('SELECT 1 FROM profiles WHERE email = $1', [email]);
    if (rows.length === 0) {
      return { error: 'No account found for that email.', noAccount: true };
    }
    return { error: error.message };
  }

  // The root layout (Navbar) reads auth state and is cached across
  // client-side navigations — without this, it keeps showing the
  // logged-out view even though the session cookie is now valid.
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signInWithGoogleAction() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${SITE_URL}/auth/callback` },
  });

  if (error || !data?.url) {
    redirect('/login?error=google_oauth_failed');
  }

  redirect(data.url);
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
