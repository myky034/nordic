import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithOAuth: vi.fn() } }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { signIn, signUp, signInWithGoogle } from "./actions";

function form(password = "a strong password", confirmation = password) {
  const data = new FormData();
  data.set("email", " user@example.com ");
  data.set("password", password);
  data.set("confirmPassword", confirmation);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("email authentication", () => {
  it.each([undefined, "", "not-a-url", "javascript:alert(1)"])("reports invalid app origin %s before signup", async (origin) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    expect((await signUp({}, form())).error).toContain("not configured");
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it("rejects malformed email before contacting Supabase", async () => {
    const data = form(); data.set("email", "invalid");
    expect((await signIn({}, data)).error).toBeTruthy();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("rejects mismatched and short signup passwords", async () => {
    expect((await signUp({}, form("long password", "different"))).error).toContain("match");
    expect((await signUp({}, form("short"))).error).toContain("8");
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it("preserves password whitespace and redirects successful login", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signIn({}, form(" password "))).rejects.toThrow("REDIRECT:/dashboard");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: " password " });
  });
  it("does not apply signup minimum to existing login passwords", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signIn({}, form("short"))).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("returns a safe error and does not log credentials", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { status: 400, message: "user@example.com secret" } });
    expect((await signIn({}, form())).error).toContain("Unable to sign in");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("user@example.com");
  });
  it("handles network failures", async () => {
    auth.signInWithPassword.mockRejectedValue(new Error("network"));
    expect((await signIn({}, form())).error).toContain("temporarily unavailable");
  });
  it("shows confirmation instructions without granting access", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    expect((await signUp({}, form())).message).toContain("Check your inbox");
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: "http://localhost:3000/auth/callback" } }));
  });
  it("redirects signup only when Supabase returns a session", async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
    await expect(signUp({}, form())).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("handles signup rate limiting", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { status: 429 } });
    expect((await signUp({}, form())).error).toContain("Too many attempts");
  });
  it("provides an email fallback after Google fails", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: { status: 400 } });
    await expect(signInWithGoogle()).rejects.toThrow("REDIRECT:/login?error=oauth_failed");
  });
});
