"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MIN_PASSWORD_LENGTH, type AuthState } from "@/lib/auth/credentials";
import { signIn, signUp, signInWithGoogle } from "./actions";

function GoogleButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900">{pending ? "Connecting…" : "Continue with Google"}</button>;
}

export function AuthForm({ mode, callbackError = false }: { mode: "login" | "signup"; callbackError?: boolean }) {
  const signup = mode === "signup";
  const [state, action, pending] = useActionState<AuthState, FormData>(signup ? signUp : signIn, {});
  const inputClass = "mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-base outline-none focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-700";

  return (
    <section className="w-full max-w-sm">
      <Link href="/" className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Nordic</Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{signup ? "Start your study and career research with an email account." : "Sign in with your email and password, or continue with Google."}</p>
      {callbackError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">We couldn’t complete authentication. Try again, or use your email and password below. Confirmation links may expire or need to be opened in the browser where you signed up.</p>}
      <form action={action} className="mt-7 space-y-5" aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
          <div><label htmlFor="email" className="text-sm font-medium">Email</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} /></div>
          <div><label htmlFor="password" className="text-sm font-medium">Password</label><input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? MIN_PASSWORD_LENGTH : undefined} maxLength={1024} aria-describedby={signup ? "password-hint" : undefined} className={inputClass} />{signup && <p id="password-hint" className="mt-2 text-xs text-zinc-500">Use at least {MIN_PASSWORD_LENGTH} characters.</p>}</div>
          {signup && <div><label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={1024} className={inputClass} /></div>}
          {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
          {state.message && <p role="status" className="rounded-xl bg-zinc-100 p-4 text-sm leading-6 dark:bg-zinc-900">{state.message}</p>}
          <button type="submit" className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">{pending ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>
        </fieldset>
      </form>
      <div className="my-6 flex items-center gap-4 text-xs text-zinc-500"><span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />or<span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /></div>
      <form action={signInWithGoogle}><GoogleButton /></form>
      <p className="mt-7 text-center text-sm text-zinc-500">{signup ? "Already have an account?" : "New to Nordic?"} <Link className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100" href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create an account"}</Link></p>
    </section>
  );
}
