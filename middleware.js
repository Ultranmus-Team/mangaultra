import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Redirect signed-in users away from auth pages, and signed-out users away
// from pages that require a session. Role-specific gating (e.g. admin-only)
// still happens at the page level, since it needs a DB lookup that isn't
// available in Edge middleware.
const AUTH_ONLY_PATHS = ['/login', '/signup'];
const PROTECTED_PATHS = ['/dashboard', '/admin'];

function matchesPath(pathname, paths) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Also refreshes the session cookie if it's expired; required for SSR auth to work.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (user && matchesPath(pathname, AUTH_ONLY_PATHS)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!user && matchesPath(pathname, PROTECTED_PATHS)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
