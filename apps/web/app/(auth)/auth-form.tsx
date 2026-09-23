"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MIN_PASSWORD_LENGTH, type AuthState } from "@/lib/auth/credentials";
import { signIn, signUp, signInWithGoogle } from "./actions";
import { buttonPrimary, buttonSecondary, control, label } from "@/components/ui/styles";
import { FormMessage } from "@/components/ui";

function GoogleButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={`${buttonSecondary} w-full`}>{pending ? "Connecting…" : "Continue with Google"}</button>;
}

export function AuthForm({ mode, callbackError = false }: { mode: "login" | "signup"; callbackError?: boolean }) {
  const signup = mode === "signup";
  const [state, action, pending] = useActionState<AuthState, FormData>(signup ? signUp : signIn, {});
  // 16px inputs avoid iOS Safari zooming into the field on focus.
  const inputClass = `${control} text-base`;

  return (
    <section className="w-full">
      <Link href="/" className="text-[13px] font-semibold tracking-[0.18em] text-ink">NORDIC</Link>
      <h1 className="mt-8 text-[28px] font-semibold tracking-[-0.02em] text-ink">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{signup ? "Start your study and career research with an email account." : "Sign in with your email and password, or continue with Google."}</p>
      {callbackError && <p role="alert" className="mt-5 rounded-xl bg-critical/[0.07] px-4 py-3 text-[15px] text-critical">We couldn’t complete authentication. Try again, or use your email and password below. Confirmation links may expire or need to be opened in the browser where you signed up.</p>}
      <form action={action} className="mt-7 space-y-5" aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
          <div><label htmlFor="email" className={label}>Email</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} /></div>
          <div><label htmlFor="password" className={label}>Password</label><input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? MIN_PASSWORD_LENGTH : undefined} maxLength={1024} aria-describedby={signup ? "password-hint" : undefined} className={inputClass} />{signup && <p id="password-hint" className="mt-1.5 text-[13px] text-ink-3">Use at least {MIN_PASSWORD_LENGTH} characters.</p>}</div>
          {signup && <div><label htmlFor="confirmPassword" className={label}>Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={1024} className={inputClass} /></div>}
          <FormMessage error={state.error} message={state.message} />
          <button type="submit" className={`${buttonPrimary} w-full`}>{pending ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>
        </fieldset>
      </form>
      <div className="my-6 flex items-center gap-4 text-[13px] text-ink-3"><span className="h-px flex-1 bg-hairline" />or<span className="h-px flex-1 bg-hairline" /></div>
      <form action={signInWithGoogle}><GoogleButton /></form>
      <p className="mt-7 text-center text-[15px] text-ink-2">{signup ? "Already have an account?" : "New to Nordic?"} <Link className="font-medium text-accent hover:underline underline-offset-4" href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create an account"}</Link></p>
    </section>
  );
}
