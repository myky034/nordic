// =============================================================================
// Login Page — app/(auth)/login/page.tsx  →  route: /login
// =============================================================================
//
// Slice 1 supports Google OAuth only. Email/password and magic link are
// deferred to a later slice per the approved plan.
//
// HOW Google OAuth works with Supabase (PKCE flow):
//   1. User clicks "Sign in with Google".
//   2. The Server Action calls supabase.auth.signInWithOAuth().
//   3. Supabase returns a URL pointing to Google's OAuth consent screen,
//      including a PKCE code verifier stored server-side.
//   4. The Server Action redirects the browser to that URL.
//   5. After Google authenticates the user, it redirects back to our
//      /auth/callback route with an authorization code.
//   6. /auth/callback exchanges the code for a Supabase session.
//
// WHY a Server Action instead of a client-side redirect?
//   signInWithOAuth() needs the server-side Supabase client (which reads
//   cookies correctly). Server Actions run on the server and can safely
//   call redirect(), keeping auth logic off the client.
// =============================================================================

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Server Action — 'use server' marks this function as a server-side action
// that can be called from a <form action={...}> element.
async function signInWithGoogle() {
  "use server";

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // The browser will be redirected here after Google authenticates the user.
      // Must match one of the Redirect URLs configured in your Supabase project
      // under Authentication → URL Configuration.
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error || !data.url) {
    // Redirect back to login with an error indicator if OAuth initiation fails.
    redirect("/login?error=oauth_failed");
  }

  // Redirect the browser to Google's OAuth consent screen.
  redirect(data.url);
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Sign in
      </h1>

      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Use your Google account to access the portal.
      </p>

      {/* Form submits the Server Action — no client-side JS needed. */}
      <form action={signInWithGoogle} className="mt-6">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          {/* Google "G" icon — inline SVG avoids an extra network request */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
