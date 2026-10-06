import { AuthForm } from "../auth-form";
import { getLocale } from "@/lib/i18n/server";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return <AuthForm mode="login" locale={await getLocale()} callbackError={typeof error === "string" && ["oauth_failed", "no_code", "auth_failed"].includes(error)} />;
}
