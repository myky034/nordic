import { AuthForm } from "../auth-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return <AuthForm mode="login" callbackError={typeof error === "string" && ["oauth_failed", "no_code", "auth_failed"].includes(error)} />;
}
