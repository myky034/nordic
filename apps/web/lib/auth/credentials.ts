export type AuthState = { error?: string; message?: string };

// This is the app's signup minimum; Supabase may enforce a stricter policy.
export const MIN_PASSWORD_LENGTH = 8;

export function readCredentials(form: FormData, signup = false) {
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) {
    return { error: "Nhập địa chỉ email hợp lệ." } as const;
  }
  if (typeof password !== "string" || !password || password.length > 1024) {
    return { error: "Nhập mật khẩu (tối đa 1024 ký tự)." } as const;
  }
  if (signup && password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` } as const;
  }
  if (signup && password !== form.get("confirmPassword")) {
    return { error: "Hai mật khẩu chưa khớp nhau." } as const;
  }
  // Never trim passwords: spaces can be intentional credentials.
  return { email: email.trim(), password } as const;
}

const diagnosticCodes = new Set([
  "email_address_invalid", "email_address_not_authorized", "email_provider_disabled",
  "signup_disabled", "weak_password", "over_email_send_rate_limit",
  "over_request_rate_limit", "captcha_failed", "unexpected_failure",
  "email_exists", "user_already_exists", "email_not_confirmed", "invalid_credentials",
  "request_timeout", "bad_code_verifier", "flow_state_expired", "flow_state_not_found",
]);

export function logAuthFailure(operation: string, error: unknown) {
  // Log categories only, never raw errors that might contain email or tokens.
  const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : null;
  const rawCode = error && typeof error === "object" && "code" in error ? error.code : null;
  // Only known provider codes are allowed: arbitrary error text may contain PII.
  const code = typeof rawCode === "string" && diagnosticCodes.has(rawCode) ? rawCode : "unknown";
  console.error({ source: "supabase_auth", operation, timestamp: new Date().toISOString(), status, code, category: status === 429 ? "rate_limited" : "authentication_failed" });
}
