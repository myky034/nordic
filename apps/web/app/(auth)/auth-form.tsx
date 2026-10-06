"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MIN_PASSWORD_LENGTH, type AuthState } from "@/lib/auth/credentials";
import { signIn, signUp, signInWithGoogle } from "./actions";
import { buttonPrimary, buttonSecondary, control, label } from "@/components/ui/styles";
import { FormMessage } from "@/components/ui";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

function GoogleButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={`${buttonSecondary} w-full`}>{pending ? pendingLabel : label}</button>;
}

export function AuthForm({ mode, callbackError = false, locale }: { mode: "login" | "signup"; callbackError?: boolean; locale: Locale }) {
  const signup = mode === "signup";
  const t = dictionaries[locale].auth;
  const [state, action, pending] = useActionState<AuthState, FormData>(signup ? signUp : signIn, {});
  // 16px inputs avoid iOS Safari zooming into the field on focus.
  const inputClass = `${control} text-base`;

  return (
    <section className="w-full">
      <Link href="/" className="text-[13px] font-semibold tracking-[0.18em] text-ink">NORDIC</Link>
      <h1 className="mt-8 text-[28px] font-semibold tracking-[-0.02em] text-ink">{signup ? t.signupTitle : t.loginTitle}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{signup ? t.signupIntro : t.loginIntro}</p>
      {callbackError && <p role="alert" className="mt-5 rounded-xl bg-critical/[0.07] px-4 py-3 text-[15px] text-critical">{t.callbackError}</p>}
      <form action={action} className="mt-7 space-y-5" aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
          <div><label htmlFor="email" className={label}>{t.email}</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} /></div>
          <div><label htmlFor="password" className={label}>{t.password}</label><input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? MIN_PASSWORD_LENGTH : undefined} maxLength={1024} aria-describedby={signup ? "password-hint" : undefined} className={inputClass} />{signup && <p id="password-hint" className="mt-1.5 text-[13px] text-ink-3">{t.passwordHint(MIN_PASSWORD_LENGTH)}</p>}</div>
          {signup && <div><label htmlFor="confirmPassword" className={label}>{t.confirmPassword}</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={1024} className={inputClass} /></div>}
          <FormMessage error={state.error} message={state.message} />
          <button type="submit" className={`${buttonPrimary} w-full`}>{pending ? t.wait : signup ? t.signUp : t.signIn}</button>
        </fieldset>
      </form>
      <div className="my-6 flex items-center gap-4 text-[13px] text-ink-3"><span className="h-px flex-1 bg-hairline" />{t.or}<span className="h-px flex-1 bg-hairline" /></div>
      <form action={signInWithGoogle}><GoogleButton label={t.google} pendingLabel={t.googleConnecting} /></form>
      <p className="mt-7 text-center text-[15px] text-ink-2">{signup ? t.haveAccount : t.firstTime} <Link className="font-medium text-accent hover:underline underline-offset-4" href={signup ? "/login" : "/signup"}>{signup ? t.signIn : t.signUp}</Link></p>
    </section>
  );
}
