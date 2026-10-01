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
      return { error: error.status === 429 ? "Bạn thử quá nhiều lần. Vui lòng thử lại sau ít phút." : "Chưa đăng nhập được. Kiểm tra email và mật khẩu, và xác nhận email nếu được yêu cầu." };
    }
  } catch {
    logAuthFailure("sign_in", null);
    return { error: "Tạm thời chưa đăng nhập được. Bạn thử lại nhé." };
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
      return { error: error.status === 429 ? "Bạn thử quá nhiều lần. Vui lòng thử lại sau ít phút." : error.code === "weak_password" ? "Mật khẩu chưa đủ mạnh. Hãy chọn mật khẩu dài hơn, khó đoán hơn." : "Chưa tạo được tài khoản. Bạn thử lại, hoặc đăng nhập nếu đã có tài khoản." };
    }
    // A user object alone is not proof of a session (or of a new account).
    if (!data.session) return { message: "Hãy kiểm tra hộp thư để lấy liên kết xác nhận, mở liên kết trên trình duyệt này rồi đăng nhập. Nếu bạn đã có tài khoản, hãy đăng nhập." };
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      logAuthFailure("sign_up_configuration", null);
      return { error: "Chức năng tạo tài khoản chưa được cấu hình. Vui lòng liên hệ quản trị viên." };
    }
    logAuthFailure("sign_up", null);
    return { error: "Tạm thời chưa tạo được tài khoản. Bạn thử lại nhé." };
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

// Sign-out for every page header (public and signed-in). A form + Server
// Action needs no client JavaScript; signOut() clears the session cookies,
// and the redirect re-renders the layouts so the header shows "Đăng nhập".
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
