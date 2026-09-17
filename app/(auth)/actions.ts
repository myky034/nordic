"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { readCredentials, logAuthFailure, type AuthState } from "../../lib/auth/credentials";

class AuthConfigurationError extends Error {}

function callbackUrl() {
  // Use a configured origin rather than trusting a submitted redirect/Host header.
  let url: URL;
  try {
    url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
  } catch {
    throw new AuthConfigurationError("Invalid application origin");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new AuthConfigurationError("Invalid application origin");
  return new URL("/auth/callback", url.origin).toString();
}

export async function signIn(_previous: AuthState, form: FormData): Promise<AuthState> {
  const credentials = readCredentials(form);
  if (credentials.error) return { error: credentials.error };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      logAuthFailure("sign_in", error);
      return { error: error.status === 429 ? "Too many attempts. Please try again later." : "Unable to sign in. Check your email and password, and confirm your email if required." };
    }
  } catch {
    logAuthFailure("sign_in", null);
    return { error: "Sign in is temporarily unavailable. Please try again." };
  }
  // Next.js redirect throws internally, so it must stay outside the catch block.
  redirect("/dashboard");
}

export async function signUp(_previous: AuthState, form: FormData): Promise<AuthState> {
  const credentials = readCredentials(form, true);
  if (credentials.error) return { error: credentials.error };
  try {
    const emailRedirectTo = callbackUrl();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: { emailRedirectTo },
    });
    if (error) {
      logAuthFailure("sign_up", error);
      return { error: error.status === 429 ? "Too many attempts. Please try again later." : error.code === "weak_password" ? "Choose a stronger password that meets the account security requirements." : "Unable to create an account. Try again, or sign in if you already have an account." };
    }
    // A user object alone is not proof of a session (or of a new account).
    if (!data.session) return { message: "Check your inbox for a confirmation link if your email is eligible. Open it in this browser, then sign in. If you already have an account, sign in instead." };
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      logAuthFailure("sign_up_configuration", null);
      return { error: "Account creation is not configured yet. Please contact the site administrator." };
    }
    logAuthFailure("sign_up", null);
    return { error: "Account creation is temporarily unavailable. Please try again." };
  }
  redirect("/dashboard");
}

export async function signInWithGoogle() {
  let destination: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
    if (error || !data.url) {
      logAuthFailure("google_sign_in", error);
      destination = "/login?error=oauth_failed";
    } else {
      destination = data.url;
    }
  } catch {
    logAuthFailure("google_sign_in", null);
    destination = "/login?error=oauth_failed";
  }
  redirect(destination);
}
